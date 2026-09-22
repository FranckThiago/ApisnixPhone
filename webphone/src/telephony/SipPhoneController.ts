import type { CallOutcome } from '../domain/types';
import { CallProgressSounds, type CallProgressSoundPlayer, MicPipeline, microphoneErrorMessage, primeElement, Ringer } from './audio';
import type { AudioSettings, CallSnapshot, Credentials, PhoneController, PhoneSnapshot } from './types';

/** The part of SIP.js `Web.SessionManager` this application relies on. */
export interface ManagedSession {
  id: string;
  remoteIdentity: { displayName?: string; uri: { user?: string } };
}

interface Rejection { message: { statusCode?: number } }

export interface ManagerDelegate {
  onServerConnect(): void;
  onServerDisconnect(error?: Error): void;
  onRegistered(): void;
  onUnregistered(): void;
  onCallCreated(session: ManagedSession): void;
  onCallReceived(session: ManagedSession): void;
  onCallAnswered(session: ManagedSession): void;
  onCallHangup(session: ManagedSession): void;
  onCallHold(session: ManagedSession, held: boolean): void;
}

export interface Manager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  register(options: { requestDelegate: { onReject(response: Rejection): void } }): Promise<void>;
  unregister(): Promise<void>;
  call(destination: string, inviterOptions: undefined, inviteOptions: {
    requestDelegate: { onProgress(response: Rejection): void; onReject(response: Rejection): void };
  }): Promise<unknown>;
  answer(session: ManagedSession): Promise<void>;
  decline(session: ManagedSession): Promise<void>;
  hangup(session: ManagedSession): Promise<void>;
  hold(session: ManagedSession): Promise<void>;
  unhold(session: ManagedSession): Promise<void>;
  mute(session: ManagedSession): void;
  unmute(session: ManagedSession): void;
  sendDTMF(session: ManagedSession, tone: string): Promise<void>;
  /**
   * Leaves without un-registering. The PBX keeps ONE contact per account: an un-REGISTER from
   * the device that lost the line would disconnect the device that now holds it.
   */
  dropSilently(): Promise<void>;
  /** True when the PBX says this browser holds the account, false when another device does, null when unknown. */
  holdsLine(): Promise<boolean | null>;
  /** Audio packets sent so far on this call, or null when the browser cannot tell. */
  sentAudioPackets(session: ManagedSession): Promise<number | null>;
}

export interface SipConfig {
  /** Public connection information only: never a key or a password. */
  domain: string;
  wssUrl: string;
  iceServers?: string[];
}

export interface SipEnvironment {
  createManager(config: SipConfig, credentials: Credentials, delegate: ManagerDelegate, microphone: () => Promise<MediaStream>, remoteAudio: HTMLAudioElement | undefined): Promise<Manager> | Manager;
  createRemoteAudio(): HTMLAudioElement | undefined;
  /** Resolves to a release function, or null when another tab of this origin holds the line. */
  acquireLine(name: string): Promise<(() => void | Promise<void>) | null>;
}

const REJECTIONS: Record<number, CallOutcome> = { 486: 'busy', 600: 'busy', 603: 'declined', 408: 'no-answer', 487: 'cancelled' };
const SIP_CALL_FAILURES: Record<number, string> = {
  403: 'SIP 403 Forbidden — appel interdit par le serveur.',
  404: 'SIP 404 Not Found — numéro ou destination introuvable.',
  480: 'SIP 480 Temporarily Unavailable — correspondant temporairement indisponible.',
  486: 'SIP 486 Busy Here — ligne occupée.',
  488: 'SIP 488 Not Acceptable Here — média ou codec refusé.',
  503: 'SIP 503 Service Unavailable — service téléphonique indisponible.',
};
const RECONNECT_GRACE = 3 * 4000 + 6000;
/** How often the PBX is asked who holds the account: quick enough to stop shared credentials, light for the server. */
const LINE_CHECK = 45_000;
const HOLD_PATIENCE = 8000;

/**
 * SIP.js behind the application's contract. A connected WebSocket is not a
 * registered account, and a registered account is not an established call:
 * each state is only shown once the server confirmed it.
 */
export class SipPhoneController implements PhoneController {
  private snapshot: PhoneSnapshot = { demo: false, connection: 'offline', account: null, call: null };
  private listeners = new Set<() => void>();
  private manager?: Manager;
  private session?: ManagedSession;
  private releaseLine?: () => void | Promise<void>;
  private wanted = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private rejection?: CallOutcome;
  private rejectionReason?: string;
  private localHangup = false;
  private dtmfQueue: Promise<void> = Promise.resolve();
  private micFailure?: string;
  private interruption?: string;
  private lineWatch?: ReturnType<typeof setInterval>;
  private quietTimer?: ReturnType<typeof setTimeout>;
  private holdTimer?: ReturnType<typeof setTimeout>;
  /** Memory only, for « Reprendre la ligne ici »; cleared on sign-out. Never written anywhere. */
  private credentials?: Credentials;
  private remoteAudio?: HTMLAudioElement;
  private ringer = new Ringer();
  private audio: AudioSettings = { volume: 80, micGain: 100, ringtone: true, echoCancellation: true, noiseSuppression: true };
  private mic = new MicPipeline({ deviceId: 'default', gain: 100, echoCancellation: true, noiseSuppression: true });

  constructor(private config: SipConfig, private environment: SipEnvironment,
              private callProgress: CallProgressSoundPlayer = new CallProgressSounds()) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<PhoneSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  private updateCall(patch: Partial<CallSnapshot>) {
    if (this.snapshot.call) this.update({ call: { ...this.snapshot.call, ...patch } });
  }

  async connect(credentials: Credentials) {
    if (this.wanted) return;
    const username = credentials.username.trim();
    if (!username || !credentials.password) return this.update({ connection: 'auth-error', error: 'Saisissez votre identifiant et votre mot de passe.' });
    this.wanted = true;
    this.credentials = { username, password: credentials.password };
    // Still inside the sign-in click: the only moment the browser lets us unlock the voice output.
    // Without it the first incoming call is silent, because nothing was clicked just before the sound starts.
    this.remoteAudio ??= this.environment.createRemoteAudio();
    if (this.remoteAudio) primeElement(this.remoteAudio);
    this.update({ connection: 'connecting', error: undefined });
    try {
      // One registration per browser: a second tab must not silently take the line.
      const release = await this.environment.acquireLine(`apisnixphone:${this.config.domain}:${username}`);
      if (!release) {
        this.wanted = false;
        return this.update({ connection: 'other-tab-active', error: 'Cette ligne est déjà ouverte dans un autre onglet de ce navigateur.' });
      }
      this.releaseLine = release;
      this.applyAudio(this.audio);
      this.manager = await this.environment.createManager(this.config, { username, password: credentials.password }, this.delegate, () => this.openMicrophone(), this.remoteAudio);
      this.update({ account: { username, domain: this.config.domain } });
      await this.manager.connect();
    } catch {
      // No retry loop here: the person decides to try again.
      await this.teardown();
      this.update({ connection: 'network-error', account: null, error: 'Connexion au serveur impossible. Vérifiez votre réseau, puis réessayez.' });
    }
  }

  private delegate: ManagerDelegate = {
    onServerConnect: () => {
      if (!this.wanted || !this.manager) return;
      clearTimeout(this.reconnectTimer);
      this.update({ connection: 'registering' });
      this.manager.register({
        requestDelegate: {
          // A 401/407 challenge is answered by the library; only a final refusal lands here.
          onReject: response => {
            const status = response.message.statusCode ?? 0;
            const refused = status === 401 || status === 403 || status === 404 || status === 407;
            void this.teardown();
            this.update({ connection: refused ? 'auth-error' : 'network-error', account: null,
                          error: refused ? 'Identifiant ou mot de passe refusé.' : `Le serveur a refusé l’enregistrement (${status}).` });
          },
        },
      }).catch(() => undefined);
    },
    onServerDisconnect: () => {
      if (!this.wanted) return;
      // A dropped call is never resumed or redialled automatically.
      const call = this.snapshot.call;
      if (call && call.phase !== 'ended') {
        // A conversation that took place stays « answered »; only say how it ended.
        this.interruption = 'Appel interrompu : la connexion au serveur a été perdue.';
        this.finish(call.answeredAt ? 'answered' : 'failed');
      }
      this.update({ connection: 'reconnecting', error: undefined });
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.snapshot.connection !== 'reconnecting') return;
        void this.teardown();
        this.update({ connection: 'network-error', account: null, error: 'Connexion perdue. Vérifiez votre réseau, puis reconnectez-vous.' });
      }, RECONNECT_GRACE);
    },
    onRegistered: () => {
      if (!this.wanted) return;
      this.update({ connection: 'ready', error: undefined, lineTaken: false });
      this.watchLine();
    },
    onUnregistered: () => { if (this.wanted && this.snapshot.connection === 'ready') this.update({ connection: 'registering' }); },
    onCallCreated: session => { this.session = session; },
    onCallReceived: session => {
      this.session = session;
      this.rejection = undefined;
      this.rejectionReason = undefined;
      this.localHangup = false;
      const number = session.remoteIdentity.uri.user ?? '';
      this.update({ call: { id: session.id, direction: 'inbound', rawInput: number, dialTarget: number, remoteName: session.remoteIdentity.displayName || undefined,
                            phase: 'ringing-in', muted: false, holdPending: false, startedAt: Date.now(), dtmf: '' } });
      if (this.audio.ringtone) this.ringer.start(this.audio.volume / 100);
    },
    onCallAnswered: () => {
      this.ringer.stop();
      const call = this.snapshot.call;
      const outbound = call?.direction === 'outbound' && call.phase !== 'active';
      this.callProgress.stop();
      if (outbound) this.callProgress.answered(this.audio.volume / 100);
      // Talk time starts here, never at the ringing or early media.
      this.updateCall({ phase: 'active', answeredAt: Date.now() });
      void this.remoteAudio?.play().catch(() => this.update({ audioBlocked: true }));
      // One-way audio must never go unnoticed: check that our voice really leaves the browser.
      const session = this.session, manager = this.manager;
      if (session && manager) setTimeout(() => {
        if (this.session !== session || this.snapshot.call?.phase !== 'active' || this.snapshot.call.muted) return;
        void manager.sentAudioPackets(session).then(packets => {
          if (packets === 0 && this.session === session) this.update({ error: 'Votre correspondant ne vous entend pas : votre micro n’émet rien. Raccrochez, vérifiez le micro dans Réglages, puis rappelez.' });
        }).catch(() => undefined);
      }, 5000);
      // Safety net: SIP.js starts the sound itself and stays quiet when the browser refuses.
      setTimeout(() => {
        if (this.snapshot.call?.phase === 'active' && this.remoteAudio?.paused) this.update({ audioBlocked: true });
      }, 1200);
    },
    onCallHangup: () => {
      const call = this.snapshot.call;
      if (!call || call.phase === 'ended') return;
      this.finish(call.answeredAt ? 'answered' : this.rejection ?? (call.direction === 'inbound' ? (this.localHangup ? 'declined' : 'missed') : this.localHangup ? 'cancelled' : 'failed'));
    },
    // Only the far end's confirmation changes what the screen says.
    onCallHold: (_session, held) => {
      clearTimeout(this.holdTimer);
      this.updateCall({ phase: held ? 'held' : 'active', holdPending: false });
      this.quietRemote(false);
    },
  };

  /** SIP.js ends the call without saying why when the microphone fails: keep the reason ourselves. */
  private async openMicrophone() {
    this.micFailure = undefined;
    try {
      return await this.mic.open();
    } catch (error) {
      this.micFailure = microphoneErrorMessage(error);
      throw error;
    }
  }

  /**
   * The PBX keeps one device per account. Rather than guessing from silence (its periodic checks also
   * stop for ordinary network reasons, which once paused the legitimate device), ask it and compare.
   */
  private watchLine() {
    clearInterval(this.lineWatch);
    let strikes = 0;
    this.lineWatch = setInterval(() => {
      const manager = this.manager;
      if (this.snapshot.connection !== 'ready' || !manager || this.snapshot.lineTaken) return;
      void manager.holdsLine().then(holds => {
        if (manager !== this.manager) return;
        strikes = holds === false ? strikes + 1 : 0;
        // Two consecutive answers, so one odd reply during a re-registration changes nothing.
        if (strikes < 2) return;
        // Never in the middle of a conversation: the call in progress is still ours.
        if (this.snapshot.call && this.snapshot.call.phase !== 'ended') return;
        void this.stepAside();
      }).catch(() => undefined);
    }, LINE_CHECK);
  }

  /**
   * Another device registered on this account. Renewing our registration would steal the line
   * back every few minutes and the two devices would take turns for ever: stop instead, quietly,
   * and let the person decide.
   */
  private async stepAside() {
    this.wanted = false;
    clearInterval(this.lineWatch);
    clearTimeout(this.reconnectTimer);
    const manager = this.manager;
    this.manager = undefined;
    this.update({ connection: 'other-tab-active', lineTaken: true, error: undefined });
    await manager?.dropSilently().catch(() => undefined);
    await this.releaseLine?.();
    this.releaseLine = undefined;
  }

  retakeLine() {
    const credentials = this.credentials;
    if (!this.snapshot.lineTaken || !credentials) return;
    this.update({ lineTaken: false });
    void this.connect(credentials);
  }

  private finish(outcome: CallOutcome) {
    this.ringer.stop();
    this.callProgress.stop();
    this.mic.close();
    this.session = undefined;
    clearTimeout(this.quietTimer);
    if (this.remoteAudio) this.remoteAudio.muted = false;
    const micFailure = this.micFailure;
    const failure = micFailure ?? this.interruption ?? this.rejectionReason;
    this.micFailure = this.interruption = this.rejectionReason = undefined;
    clearTimeout(this.holdTimer);
    this.updateCall({ phase: 'ended', outcome: micFailure ? 'failed' : outcome, failure, endedAt: Date.now(), holdPending: false });
    // Said out loud as well: a failed call must never leave the person wondering why.
    if (failure) this.update({ error: failure });
    if (this.snapshot.audioBlocked) this.update({ audioBlocked: false });
  }

  /**
   * The audio is renegotiated when a call is held or resumed, and the first packets can come out
   * as a short burst of noise. The far end is silenced for that instant, then faded back in.
   */
  private quietRemote(quiet: boolean) {
    const audio = this.remoteAudio;
    if (!audio) return;
    clearTimeout(this.quietTimer);
    if (quiet) {
      audio.muted = true;
      // Never stay silent if the confirmation does not come.
      this.quietTimer = setTimeout(() => { audio.muted = false; }, 4000);
    } else {
      this.quietTimer = setTimeout(() => { audio.muted = false; }, 350);
    }
  }

  resumeAudio() {
    void this.remoteAudio?.play().then(() => this.update({ audioBlocked: false })).catch(() => undefined);
  }

  private async teardown() {
    this.wanted = false;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.lineWatch);
    this.ringer.stop();
    this.callProgress.stop();
    this.mic.close();
    const manager = this.manager;
    this.manager = undefined;
    this.session = undefined;
    if (manager) {
      await manager.unregister().catch(() => undefined);
      await manager.disconnect().catch(() => undefined);
    }
    await this.releaseLine?.();
    this.releaseLine = undefined;
  }

  async disconnect() {
    if (this.session && this.manager) await this.manager.hangup(this.session).catch(() => undefined);
    await this.teardown();
    this.credentials = undefined;
    this.update({ connection: 'offline', account: null, call: null, error: undefined, lineTaken: false });
  }

  call(rawInput: string, dialTarget: string, remoteName?: string) {
    if (this.snapshot.connection !== 'ready' || this.snapshot.call || !this.manager || !/^[+\d*#]+$/.test(dialTarget)) return;
    this.rejection = undefined;
    this.rejectionReason = undefined;
    this.localHangup = false;
    const id = `sip-${Date.now()}`;
    this.update({ call: { id, direction: 'outbound', rawInput, dialTarget, remoteName, phase: 'dialing', muted: false, holdPending: false, startedAt: Date.now(), dtmf: '' }, error: undefined });
    // Digits, + and * go out exactly as typed; only # must be escaped inside a SIP URI.
    const destination = `sip:${dialTarget.replace(/#/g, '%23')}@${this.config.domain}`;
    this.manager.call(destination, undefined, {
      requestDelegate: {
        onProgress: () => {
          if (this.snapshot.call?.id !== id || this.snapshot.call.phase !== 'dialing') return;
          this.updateCall({ phase: 'ringing-out' });
          this.callProgress.startRingback(this.audio.volume / 100);
        },
        onReject: response => {
          this.callProgress.stop();
          const status = response.message.statusCode ?? 0;
          this.rejection = REJECTIONS[status] ?? 'failed';
          this.rejectionReason = SIP_CALL_FAILURES[status];
        },
      },
    }).catch(error => {
      if (this.snapshot.call?.id !== id || this.snapshot.call.phase === 'ended') return;
      this.finish('failed');
      this.update({ error: error instanceof DOMException ? microphoneErrorMessage(error) : 'L’appel n’a pas pu être lancé.' });
    });
  }

  answer() {
    if (this.snapshot.call?.phase !== 'ringing-in' || !this.session || !this.manager) return;
    this.ringer.stop();
    this.manager.answer(this.session).catch(error => {
      this.update({ error: error instanceof DOMException ? microphoneErrorMessage(error) : 'Impossible de répondre à cet appel.' });
    });
  }

  decline() {
    if (this.snapshot.call?.phase !== 'ringing-in' || !this.session || !this.manager) return;
    this.localHangup = true;
    this.manager.decline(this.session).catch(() => this.finish('declined'));
  }

  hangup() {
    const call = this.snapshot.call;
    if (!call || call.phase === 'ended' || call.phase === 'ending') return;
    if (call.phase === 'ringing-in') return this.decline();
    this.localHangup = true;
    this.callProgress.stop();
    if (!this.session || !this.manager) return this.finish(call.answeredAt ? 'answered' : 'cancelled');
    this.updateCall({ phase: 'ending' });
    this.manager.hangup(this.session).catch(() => this.finish(call.answeredAt ? 'answered' : 'cancelled'));
  }

  dismiss() {
    if (this.snapshot.call?.phase === 'ended') this.update({ call: null, error: undefined });
  }

  setMuted(muted: boolean) {
    const call = this.snapshot.call;
    if (!call || !this.session || !this.manager || (call.phase !== 'active' && call.phase !== 'held')) return;
    if (muted) this.manager.mute(this.session); else this.manager.unmute(this.session);
    this.updateCall({ muted });
  }

  setHeld(held: boolean) {
    const call = this.snapshot.call;
    if (!call || call.holdPending || !this.session || !this.manager || call.phase !== (held ? 'active' : 'held')) return;
    this.updateCall({ holdPending: true });
    this.quietRemote(true);
    // An unanswered request must not leave the button stuck on « Patientez… ».
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (!this.snapshot.call?.holdPending) return;
      this.updateCall({ holdPending: false });
      this.quietRemote(false);
      this.update({ error: 'Le serveur n’a pas confirmé. Votre connexion semble instable : réessayez.' });
    }, HOLD_PATIENCE);
    (held ? this.manager.hold(this.session) : this.manager.unhold(this.session)).catch(() => {
      this.updateCall({ holdPending: false });
      this.quietRemote(false);
      this.update({ error: held ? 'La mise en attente a été refusée.' : 'La reprise de l’appel a échoué.' });
    });
  }

  sendDtmf(tone: string) {
    const session = this.session, manager = this.manager;
    if (this.snapshot.call?.phase !== 'active' || !session || !manager || !/^[\d*#]$/.test(tone)) return;
    // One tone at a time, in the order they were pressed.
    this.dtmfQueue = this.dtmfQueue.then(() => manager.sendDTMF(session, tone)).then(() => {
      if (this.session === session) this.updateCall({ dtmf: ((this.snapshot.call?.dtmf ?? '') + tone).slice(-32) });
    }).catch(() => undefined);
  }

  async setInputDevice(deviceId: string) {
    try {
      await this.mic.switchDevice(deviceId);
    } catch (error) {
      this.update({ error: microphoneErrorMessage(error) + ' Le micro précédent reste utilisé.' });
    }
  }

  async setOutputDevice(deviceId: string) {
    const audio = this.remoteAudio as (HTMLAudioElement & { setSinkId?(id: string): Promise<void> }) | undefined;
    if (!audio?.setSinkId) return;
    await audio.setSinkId(deviceId === 'default' ? '' : deviceId).catch(() => this.update({ error: 'Ce casque ne peut pas être sélectionné ; la sortie du système est utilisée.' }));
  }

  applyAudio(settings: AudioSettings) {
    this.audio = settings;
    if (this.remoteAudio) this.remoteAudio.volume = Math.min(1, Math.max(0, settings.volume / 100));
    this.mic.setGain(settings.micGain);
    this.mic.update({ echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression });
    if (!settings.ringtone) this.ringer.stop();
    if (this.snapshot.call?.phase === 'ringing-out') {
      this.callProgress.stop();
      this.callProgress.startRingback(settings.volume / 100);
    }
  }
}
