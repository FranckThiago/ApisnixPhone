import { incomingNumber } from '../domain/numbers';
import type { CallOutcome } from '../domain/types';
import { t, type MessageKey } from '../i18n';
import { CallProgressSounds, type CallProgressSoundPlayer, MicPipeline, microphoneErrorMessage, primeElement, RemoteVoice, Ringer } from './audio';
import { DEFAULT_RINGTONE } from './ringtones';
import type { AudioSettings, CallSnapshot, Credentials, PhoneController, PhoneSnapshot } from './types';

/** The part of SIP.js `Web.SessionManager` this application relies on. */
export interface ManagedSession {
  id: string;
  remoteIdentity: { displayName?: string; uri: { user?: string } };
  assertedIdentity?: { uri: { user?: string } };
  request?: { getHeader(name: string): string | undefined };
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
  /** Page of the PBX web server saying whether this site is blocked after too many refused sign-ins. */
  statusUrl?: string;
}

/**
 * Answer of the block-status page: blocked for `remaining` more seconds, or not blocked. With the counter:
 * `weighted` failures as the PBX counts them, `left` before a block, `nextBlock` length of that block in seconds.
 */
export interface BlockStatus { blocked: boolean; remaining: number; weighted?: number; left?: number; nextBlock?: number }

export interface SipEnvironment {
  createManager(config: SipConfig, credentials: Credentials, delegate: ManagerDelegate, microphone: () => Promise<MediaStream>, remoteAudio: HTMLAudioElement | undefined): Promise<Manager> | Manager;
  createRemoteAudio(): HTMLAudioElement | undefined;
  /** Reads the block status of this site; null when the page cannot be reached. */
  blockStatus?(url: string): Promise<BlockStatus | null>;
}

const REJECTIONS: Record<number, CallOutcome> = { 486: 'busy', 600: 'busy', 603: 'declined', 408: 'no-answer', 487: 'cancelled' };
const SIP_CALL_FAILURES: Record<number, MessageKey> = { 403: 'sip.403', 404: 'sip.404', 480: 'sip.480', 486: 'sip.486', 488: 'sip.488', 503: 'sip.503' };
const RECONNECT_GRACE = 3 * 4000 + 6000;

/** Whole lengths only: « 1 min », « 15 min », « 1 h », « 24 h ». */
export function blockLength(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 3600 && s % 3600 === 0) return `${s / 3600} h`;
  if (s >= 60 && s % 60 === 0) return `${s / 60} min`;
  return blockDuration(s);
}

/** « 4 min 12 s », « 1 h 05 min » or « 40 s »: readable in the three languages of the interface. */
export function blockDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds)), m = Math.floor(s / 60);
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (m >= 60) return `${Math.floor(m / 60)} h ${two(m % 60)} min`;
  if (m > 0) return `${m} min ${two(s % 60)} s`;
  return `${s} s`;
}
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
  private blockTicker?: ReturnType<typeof setInterval>;
  /** Memory only, for « Reprendre la ligne ici »; cleared on sign-out. Never written anywhere. */
  private credentials?: Credentials;
  private remoteAudio?: HTMLAudioElement;
  private voice?: RemoteVoice;
  private ringer = new Ringer();
  private audio: AudioSettings = { volume: 100, micGain: 100, ringtone: true, ringtoneSound: DEFAULT_RINGTONE, echoCancellation: true, noiseSuppression: true };
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
    // While the site is blocked, a new attempt would only be refused: the countdown stays on screen.
    if ((this.snapshot.blockedUntil ?? 0) > Date.now()) return;
    const username = credentials.username.trim();
    if (!username || !credentials.password) return this.update({ connection: 'auth-error', error: t('sip.missingCredentials') });
    this.wanted = true;
    this.credentials = { username, password: credentials.password };
    // Still inside the sign-in click: the only moment the browser lets us unlock the voice output.
    // Without it the first incoming call is silent, because nothing was clicked just before the sound starts.
    this.remoteAudio ??= this.environment.createRemoteAudio();
    if (this.remoteAudio) {
      primeElement(this.remoteAudio);
      this.voice ??= new RemoteVoice(this.remoteAudio);
    }
    this.update({ connection: 'connecting', error: undefined });
    try {
      // A stale browser lock must never prevent sign-in. The PBX owns registration;
      // watchLine() asks displaced sessions to stop renewing without un-registering the new one.
      this.applyAudio(this.audio);
      this.manager = await this.environment.createManager(this.config, { username, password: credentials.password }, this.delegate, () => this.openMicrophone(), this.remoteAudio);
      this.update({ account: { username, domain: this.config.domain } });
      await this.manager.connect();
    } catch {
      // No retry loop here: the person decides to try again.
      await this.teardown();
      // A refused socket is also what a blocked site sees: say so, with the time left, rather than « check your network ».
      if (await this.checkBlock()) return;
      this.update({ connection: 'network-error', account: null, error: t('sip.serverUnreachable') });
    }
  }

  /** Asks the PBX web server whether this site is blocked; shows the countdown and returns true when it is. */
  private async checkBlock(withCounter = false): Promise<boolean> {
    const status = await this.blockStatus(withCounter);
    if (!status?.blocked || !(status.remaining > 0)) return false;
    this.startBlock(Date.now() + Math.ceil(status.remaining) * 1000);
    return true;
  }

  private async blockStatus(withCounter: boolean): Promise<BlockStatus | null> {
    const url = this.config.statusUrl, ask = this.environment.blockStatus;
    if (!url || !ask) return null;
    return ask(withCounter ? `${url}${url.includes('?') ? '&' : '?'}echecs=1` : url).catch(() => null);
  }

  /**
   * After a refused sign-in: the block may have just started (countdown), or be close. Nothing alarming for one
   * or two mistakes; from the sixth counted failure, say how many are left and how long the block would last.
   */
  private async afterRefusal() {
    const status = await this.blockStatus(true);
    if (this.snapshot.connection !== 'auth-error') return;
    if (status?.blocked && status.remaining > 0) return this.startBlock(Date.now() + Math.ceil(status.remaining) * 1000);
    if (!status || !(status.weighted! >= 6) || !(status.left! > 0) || !(status.nextBlock! > 0)) return;
    const left = status.left!, time = blockLength(status.nextBlock!);
    this.update({ error: `${this.snapshot.error ?? t('sip.authRefused')} ${t(left === 1 ? 'sip.attemptLeft' : 'sip.attemptsLeft', { count: left, time })}` });
  }

  private startBlock(until: number) {
    clearInterval(this.blockTicker);
    this.update({ connection: 'blocked', account: null, blockedUntil: until });
    const tick = () => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left > 0) return this.update({ error: t('sip.blocked', { time: blockDuration(left) }) });
      clearInterval(this.blockTicker); this.blockTicker = undefined;
      this.update({ connection: 'offline', blockedUntil: undefined, error: t('sip.blockLifted') });
    };
    tick();
    if (this.blockTicker === undefined && (this.snapshot.blockedUntil ?? 0) > Date.now()) this.blockTicker = setInterval(tick, 1000);
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
                          error: refused ? t(status === 401 || status === 407 ? 'sip.authRefused' : 'sip.accessRefused') : t('sip.registerRefused', { status }) });
            // Repeated refusals block the whole site: warn when it gets close, show the countdown once it started.
            if (refused) void this.afterRefusal();
          },
        },
      }).catch(() => undefined);
    },
    onServerDisconnect: () => {
      if (!this.wanted) return;
      // A dropped call is never resumed or redialled automatically.
      const call = this.snapshot.call;
      if (call && call.phase !== 'ended') {
        // Keep the session until termination has been requested, including a clean socket
        // close: SIP.js only disposes sessions automatically on an errored disconnect.
        if (this.session && this.manager) void this.manager.hangup(this.session).catch(() => undefined);
        // A conversation that took place stays « answered »; only say how it ended.
        this.interruption = t('sip.interrupted');
        this.finish(call.answeredAt ? 'answered' : 'failed');
      }
      this.update({ connection: 'reconnecting', error: undefined });
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (this.snapshot.connection !== 'reconnecting') return;
        void this.teardown();
        this.update({ connection: 'network-error', account: null, error: t('sip.connectionLost') });
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
      const privateIdentity = /(?:^|;)\s*(?:id|user|header)\s*(?:;|$)/i.test(session.request?.getHeader('Privacy') ?? '');
      const canonical = privateIdentity ? number : incomingNumber(number, [session.assertedIdentity?.uri.user, session.remoteIdentity.displayName]);
      const remoteName = session.remoteIdentity.displayName;
      this.update({ call: { id: session.id, direction: 'inbound', rawInput: number, dialTarget: canonical,
                            remoteName: remoteName === number ? undefined : remoteName || undefined,
                            phase: 'ringing-in', muted: false, holdPending: false, startedAt: Date.now(), dtmf: '' } });
      if (this.audio.ringtone) this.ringer.start(this.audio.volume / 100, this.audio.ringtoneSound);
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
      this.voice?.startCall();
      // One-way audio must never go unnoticed: check that our voice really leaves the browser.
      const session = this.session, manager = this.manager;
      if (session && manager) setTimeout(() => {
        if (this.session !== session || this.snapshot.call?.phase !== 'active' || this.snapshot.call.muted) return;
        void manager.sentAudioPackets(session).then(packets => {
          if (packets === 0 && this.session === session) this.update({ error: t('sip.silentMic') });
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
      // SIP.js emits Terminated before its INVITE onReject callback. Let that
      // callback supply the status before recording the finished call.
      if (call.direction === 'outbound' && !call.answeredAt && !this.localHangup && !this.micFailure && !this.rejection) {
        queueMicrotask(() => {
          if (this.snapshot.call?.id === call.id && this.snapshot.call.phase !== 'ended') this.finish(this.rejection ?? 'failed');
        });
        return;
      }
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
    this.voice?.endCall();
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
    const voice = this.voice;
    if (!voice) return;
    clearTimeout(this.quietTimer);
    if (quiet) {
      voice.setQuiet(true);
      // Never stay silent if the confirmation does not come.
      this.quietTimer = setTimeout(() => voice.setQuiet(false), 4000);
    } else {
      this.quietTimer = setTimeout(() => voice.setQuiet(false), 350);
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
    this.voice?.endCall();
    const manager = this.manager;
    this.manager = undefined;
    this.session = undefined;
    if (manager) {
      // A later tab may already own the PBX contact. Never unregister its line.
      const mine = this.snapshot.connection === 'ready' ? await manager.holdsLine().catch(() => null) : null;
      if (mine === true) {
        await manager.unregister().catch(() => undefined);
        await manager.disconnect().catch(() => undefined);
      } else await manager.dropSilently().catch(() => undefined);
    }
  }

  async disconnect() {
    if (this.session && this.manager) await this.manager.hangup(this.session).catch(() => undefined);
    await this.teardown();
    this.credentials = undefined;
    clearInterval(this.blockTicker); this.blockTicker = undefined;
    this.update({ connection: 'offline', account: null, call: null, error: undefined, lineTaken: false, blockedUntil: undefined });
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
          this.rejectionReason = status in SIP_CALL_FAILURES ? t(SIP_CALL_FAILURES[status]!) : undefined;
        },
      },
    }).catch(error => {
      if (this.snapshot.call?.id !== id || this.snapshot.call.phase === 'ended') return;
      this.finish('failed');
      this.update({ error: error instanceof DOMException ? microphoneErrorMessage(error) : t('sip.callFailed') });
    });
  }

  answer() {
    if (this.snapshot.call?.phase !== 'ringing-in' || !this.session || !this.manager) return;
    this.ringer.stop();
    this.manager.answer(this.session).catch(error => {
      this.update({ error: error instanceof DOMException ? microphoneErrorMessage(error) : t('sip.answerFailed') });
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
      this.update({ error: t('sip.holdUnconfirmed') });
    }, HOLD_PATIENCE);
    (held ? this.manager.hold(this.session) : this.manager.unhold(this.session)).catch(() => {
      this.updateCall({ holdPending: false });
      this.quietRemote(false);
      this.update({ error: t(held ? 'sip.holdRefused' : 'sip.resumeFailed') });
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
      this.update({ error: t('sip.micKept', { reason: microphoneErrorMessage(error) }) });
    }
  }

  async setOutputDevice(deviceId: string) {
    const audio = this.remoteAudio as (HTMLAudioElement & { setSinkId?(id: string): Promise<void> }) | undefined;
    if (!audio?.setSinkId) return;
    const chosen = await audio.setSinkId(deviceId === 'default' ? '' : deviceId).then(() => true, () => {
      this.update({ error: t('sip.outputFailed') });
      return false;
    });
    // The amplified voice follows the element, never a headset the element could not reach.
    if (chosen) await this.voice?.setSink(deviceId);
  }

  applyAudio(settings: AudioSettings) {
    this.audio = settings;
    this.voice?.setLevel(settings.volume / 100);
    this.mic.setGain(settings.micGain);
    this.mic.update({ echoCancellation: settings.echoCancellation, noiseSuppression: settings.noiseSuppression });
    if (!settings.ringtone) this.ringer.stop();
    if (this.snapshot.call?.phase === 'ringing-out') {
      this.callProgress.stop();
      this.callProgress.startRingback(settings.volume / 100);
    }
  }
}
