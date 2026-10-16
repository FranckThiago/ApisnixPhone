import { t } from '../i18n';
import { MicPipeline } from './audio';
import { SipPhoneController, type ManagedSession, type Manager, type ManagerDelegate, type SipConfig, type SipEnvironment } from './SipPhoneController';
import type { AudioSettings, CallSnapshot, Credentials, PhoneController, PhoneSnapshot } from './types';

type Slot = 0 | 1;
const other = (slot: Slot): Slot => slot === 0 ? 1 : 0;
const live = (call: CallSnapshot | null | undefined) => !!call && call.phase !== 'ended';
const stable = (call: CallSnapshot | null | undefined) => !!call && ['active', 'held'].includes(call.phase) && !call.holdPending;

/** One capture, independent cloned tracks: closing/muting one leg cannot stop the other. */
export class PilotMicrophone {
  private pipeline = new MicPipeline({ deviceId: 'default', echoCancellation: true, noiseSuppression: true });
  private opening?: Promise<MediaStream>;
  private generation = 0;
  async clone() {
    const generation = this.generation;
    this.opening ??= this.pipeline.open().catch(error => { if (generation === this.generation) this.opening = undefined; throw error; });
    const stream = await this.opening;
    if (generation !== this.generation) throw new DOMException('Call ended', 'AbortError');
    return stream.clone();
  }
  update(audio: AudioSettings) { this.pipeline.update({ echoCancellation: audio.echoCancellation, noiseSuppression: audio.noiseSuppression }); }
  setDevice(id: string) { return this.pipeline.switchDevice(id); }
  close() { if (!this.opening) return; this.generation++; this.pipeline.close(); this.opening = undefined; }
}

/**
 * Account-scoped pilot. Two isolated single-call controllers share ONE SIP registration.
 * Non-pilot accounts keep the original controller/environment path and one-call limit.
 */
export class CallWaitingPhoneController implements PhoneController {
  private children: [SipPhoneController, SipPhoneController];
  private delegates: Array<ManagerDelegate | undefined> = [];
  private sessions: Array<ManagedSession | undefined> = [];
  private outputs: Array<HTMLAudioElement | undefined> = [];
  private owners = new Map<string, Slot>();
  private manager?: Manager;
  private listeners = new Set<() => void>();
  private snapshot!: PhoneSnapshot;
  private selected: Slot = 0;
  private enabled = false;
  private closing = false;
  private switching = false;
  private operation = 0;
  private generation = 0;
  private operationError?: string;
  private completed: CallSnapshot[] = [];
  private audio?: AudioSettings;
  private outputDevice = 'default';
  private mic = new PilotMicrophone();

  constructor(private config: SipConfig, environment: SipEnvironment) {
    this.children = [0, 1].map(index => {
      const slot = index as Slot;
      return new SipPhoneController(config, {
        ...environment,
        hasOtherCalls: () => this.enabled && live(this.children?.[other(slot)].getSnapshot().call),
        createRemoteAudio: () => (this.outputs[slot] = environment.createRemoteAudio()),
        createManager: async (cfg, credentials, delegate, microphone, remoteAudio, recoveryContact) => {
          this.delegates[slot] = delegate;
          if (slot === 1) return this.virtualManager(delegate);
          if (!this.enabled) return environment.createManager(cfg, credentials, delegate, microphone, remoteAudio, recoveryContact);
          const dispatch = (session: ManagedSession, callback: (owner: ManagerDelegate) => void) => {
            const owner = this.owners.get(session.id);
            if (owner !== undefined && this.delegates[owner]) callback(this.delegates[owner]!);
          };
          const generation = ++this.generation;
          const bridge: ManagerDelegate = {
            ...delegate,
            canReceiveCall: () => this.canReceive(),
            onRegistered: () => { delegate.onRegistered(); this.delegates[1]?.onRegistered(); },
            onUnregistered: () => { delegate.onUnregistered(); this.delegates[1]?.onUnregistered(); },
            onServerDisconnect: error => { delegate.onServerDisconnect(error); this.delegates[1]?.onServerDisconnect(error); },
            onCallCreated: session => {
              const slot: Slot = !this.sessions[0] && this.children[0].getSnapshot().call?.phase === 'dialing' ? 0
                : !live(this.children[0].getSnapshot().call) ? 0 : 1;
              this.owners.set(session.id, slot); this.sessions[slot] = session;
              this.delegates[slot]!.onCallCreated(session);
            },
            onCallReceived: session => dispatch(session, target => {
              const slot = this.owners.get(session.id)!;
              if (!live(this.children[other(slot)].getSnapshot().call)) this.selected = slot;
              if (this.audio) this.children[slot].applyAudio({ ...this.audio, ringtone: this.audio.ringtone && !live(this.children[other(slot)].getSnapshot().call) });
              target.onCallReceived(session);
            }),
            onCallAnswered: session => dispatch(session, target => target.onCallAnswered(session)),
            onCallHold: (session, held) => dispatch(session, target => target.onCallHold(session, held)),
            onCallHangup: session => {
              dispatch(session, target => target.onCallHangup(session));
              const owner = this.owners.get(session.id);
              if (owner !== undefined && this.sessions[owner]?.id === session.id) this.sessions[owner] = undefined;
              this.owners.delete(session.id); this.rebuild();
            },
          };
          const scoped = { ...Object.fromEntries(Object.entries(bridge).map(([name, handler]) => [name,
            (...args: unknown[]) => { if (generation === this.generation) handler(...args); },
          ])), canReceiveCall: () => generation === this.generation && bridge.canReceiveCall() } as ManagerDelegate;
          this.manager = await environment.createManager({ ...cfg, maxCalls: 2 }, credentials, scoped, microphone, remoteAudio, recoveryContact, session => {
            const slot = this.owners.get(session.id);
            if (slot === undefined) throw new Error('Unknown call media owner');
            return { audio: this.outputs[slot], microphone: async () => {
              const stream = await this.mic.clone();
              if (!this.owners.has(session.id)) { stream.getTracks().forEach(track => track.stop()); throw new DOMException('Call ended', 'AbortError'); }
              stream.getAudioTracks().forEach(track => { track.enabled = this.selected === slot; });
              return stream;
            } };
          });
          return this.manager;
        },
      });
    }) as [SipPhoneController, SipPhoneController];
    this.children.forEach(child => child.subscribe(() => this.rebuild()));
    this.rebuild();
  }

  private virtualManager(delegate: ManagerDelegate): Manager {
    const manager = () => { if (!this.manager) throw new Error('Line unavailable'); return this.manager; };
    return {
      contactName: 'shared-registration',
      connect: async () => { delegate.onServerConnect(); },
      isConnected: () => this.manager?.isConnected() ?? false,
      register: async () => { delegate.onRegistered(); },
      unregister: async () => undefined, disconnect: async () => undefined, dropSilently: async () => undefined,
      holdsLine: async () => true,
      call: async () => { throw new Error('Only an incoming second call is supported'); },
      answer: s => manager().answer(s), decline: s => manager().decline(s), hangup: s => manager().hangup(s),
      hold: s => manager().hold(s), unhold: s => manager().unhold(s),
      mute: s => manager().mute(s), unmute: s => manager().unmute(s),
      sendDTMF: (s, tone) => manager().sendDTMF(s, tone), sentAudioPackets: s => manager().sentAudioPackets(s),
    };
  }

  private canReceive() {
    if (this.closing || this.switching || this.children[0].getSnapshot().connection !== 'ready') return false;
    const calls = this.children.map(child => child.getSnapshot().call);
    const occupied = calls.filter(live);
    if (occupied.length >= 2 || (occupied.length === 1 && !stable(occupied[0]))) return false;
    return calls.some((call, index) => !live(call) && this.delegates[index]?.canReceiveCall());
  }

  private rebuild() {
    const calls = this.children.map(child => child.getSnapshot().call);
    for (const call of calls) if (call?.phase === 'ended' && !this.completed.some(c => c.id === call.id)) this.completed = [...this.completed.slice(-31), call];
    const previous = this.selected;
    if (this.enabled && !live(calls[this.selected]) && live(calls[other(this.selected)])) this.selected = other(this.selected);
    const main = calls[this.selected];
    this.snapshot = { ...this.children[0].getSnapshot(), ...this.children[this.selected].getSnapshot(),
      connection: this.children[0].getSnapshot().connection, account: this.children[0].getSnapshot().account,
      lineTaken: this.children[0].getSnapshot().lineTaken, recoverySince: this.children[0].getSnapshot().recoverySince,
      retryAt: this.children[0].getSnapshot().retryAt, blockedUntil: this.children[0].getSnapshot().blockedUntil,
      call: main ?? null, otherCall: this.enabled && live(calls[other(this.selected)]) ? calls[other(this.selected)]! : undefined,
      completedCalls: this.completed, switchingCall: this.switching,
      error: this.operationError ?? this.children[this.selected].getSnapshot().error ?? this.children[0].getSnapshot().error,
    };
    if (this.enabled) {
      this.manager?.focusSession?.(live(main) ? this.sessions[this.selected] : undefined);
      if (!calls.some(live)) this.mic.close();
    }
    this.listeners.forEach(listener => listener());
    if (previous !== this.selected && main?.phase === 'held' && !this.switching && !this.closing) {
      queueMicrotask(() => { if (!this.closing && !this.switching && this.snapshot.call?.id === main.id) this.setHeld(false); });
    }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  async connect(credentials: Credentials) {
    if (this.children[0].getSnapshot().connection === 'ready') return;
    this.enabled = this.config.callWaitingLines?.includes(credentials.username.trim()) === true;
    this.selected = 0; this.closing = false; this.operationError = undefined;
    await Promise.all([this.children[0].connect(credentials), ...(this.enabled ? [this.children[1].connect(credentials)] : [])]);
    if (this.audio) this.applyAudio(this.audio);
    await this.setOutputDevice(this.outputDevice);
  }
  async disconnect() {
    this.closing = true; this.operation++; this.switching = false;
    await this.children[1].disconnect(); await this.children[0].disconnect();
    this.generation++; this.manager = undefined; this.mic.close(); this.sessions = []; this.owners.clear(); this.completed = []; this.selected = 0; this.rebuild();
  }
  checkConnection = () => this.children[0].checkConnection();
  reconnect = () => this.children[0].reconnect();
  retakeLine = () => this.children[0].retakeLine();
  call(raw: string, target: string, name?: string) {
    if (this.switching || this.children.some(child => live(child.getSnapshot().call))) return;
    this.children.forEach(child => child.dismiss()); this.selected = 0; this.operationError = undefined;
    this.children[0].call(raw, target, name);
  }
  answer = () => { if (!this.switching) this.children[this.selected].answer(); };
  decline = () => { if (!this.switching) this.children[this.selected].decline(); };
  hangup() { this.operation++; this.switching = false; this.children[this.selected].hangup(); this.rebuild(); }
  dismiss() { if (!this.children.some(child => live(child.getSnapshot().call))) this.children.forEach(child => child.dismiss()); }
  setMuted(muted: boolean) { if (!this.switching) this.children[this.selected].setMuted(muted); }
  setHeld(held: boolean) { if (!this.switching) this.children[this.selected].setHeld(held); }
  sendDtmf(tone: string) { if (!this.switching) this.children[this.selected].sendDtmf(tone); }
  resumeAudio() { this.children[this.selected].resumeAudio(); }
  async setInputDevice(id: string) { await this.mic.setDevice(id); await Promise.all(this.children.map(child => child.setInputDevice(id))); }
  async setOutputDevice(id: string) { this.outputDevice = id; await Promise.all(this.children.map(child => child.setOutputDevice(id))); }
  applyAudio(audio: AudioSettings) { this.audio = audio; this.mic.update(audio); this.children.forEach((child, index) => child.applyAudio({ ...audio, ringtone: audio.ringtone && !(child.getSnapshot().call?.phase === 'ringing-in' && live(this.children[other(index as Slot)].getSnapshot().call)) })); }

  private waitFor(slot: Slot, phase: 'held' | 'active' | 'ended', action: () => void, hold = false): Promise<boolean> {
    const child = this.children[slot], before = child.getSnapshot();
    if (before.call?.phase === phase) return Promise.resolve(true);
    return new Promise(resolve => {
      let done = false;
      const finish = (ok: boolean) => { if (done) return; done = true; clearTimeout(timer); unsubscribe(); resolve(ok); };
      const check = () => {
        const current = child.getSnapshot();
        if (!current.call || current.call.id !== before.call?.id) return finish(false);
        if (current.call.phase === phase) return finish(true);
        if (current.call.phase === 'ended' || (hold && !current.call.holdPending)
          || (current.error && current.error !== before.error)) finish(false);
      };
      const unsubscribe = child.subscribe(check);
      const timer = setTimeout(() => finish(false), 15000);
      action(); check();
    });
  }

  declineWaiting() {
    const waiting = this.children[other(this.selected)];
    if (!this.switching && waiting.getSnapshot().call?.phase === 'ringing-in') waiting.decline();
  }
  answerWaiting() { void this.changeCall(true); }
  switchCall() { void this.changeCall(false); }

  private async changeCall(answer: boolean) {
    if (!this.enabled || this.switching) return;
    const from = this.selected, to = other(from), a = this.children[from], b = this.children[to];
    const source = a.getSnapshot().call, target = b.getSnapshot().call;
    if (!stable(source) || !target || (answer ? target.phase !== 'ringing-in' : !stable(target))) return;
    const token = ++this.operation;
    this.switching = true; this.operationError = undefined; this.rebuild();
    const wasHeld = source!.phase === 'held';
    try {
      const held = wasHeld || await this.waitFor(from, 'held', () => a.setHeld(true), true);
      if (token !== this.operation) return;
      // A remote hangup also frees the media; a failed hold never permits answering B.
      if (!held && live(a.getSnapshot().call)) { this.operationError = t('waiting.holdFailed'); return; }
      if (b.getSnapshot().call?.id !== target.id || !live(b.getSnapshot().call)) return;
      this.selected = to; this.rebuild();
      const accepted = await this.waitFor(to, 'active', () => answer ? b.answer() : b.setHeld(false), !answer);
      if (token !== this.operation) return;
      if (!accepted) {
        if (answer && live(b.getSnapshot().call)) await this.waitFor(to, 'ended', () => b.hangup());
        this.operationError = t('waiting.resumeFailed');
        this.selected = from; this.rebuild();
      }
    } finally {
      if (token === this.operation) {
        // Restore A after cancellation/failure. Media focus prevents a late B response
        // from sending microphone audio to both parties even if its signalling lags.
        if (this.selected === from && !wasHeld && a.getSnapshot().call?.phase === 'held') {
          await this.waitFor(from, 'active', () => a.setHeld(false), true);
        }
        this.switching = false; this.rebuild();
      }
    }
  }
}
