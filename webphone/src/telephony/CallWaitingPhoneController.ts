import { t } from '../i18n';
import { MicPipeline, WaitingTone } from './audio';
import { SipPhoneController, type ManagedSession, type Manager, type ManagerDelegate, type SipConfig, type SipEnvironment } from './SipPhoneController';
import type { AudioSettings, CallSnapshot, Credentials, PhoneController, PhoneSnapshot } from './types';

type Slot = number;
/** Lines of a multi-call account: the server decides how many it really offers. */
export const DEFAULT_LINES = 5;
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
 * Account-scoped multi-call. Isolated single-call controllers (one per line) share ONE SIP
 * registration; a single conversation is audible at a time, the others ring or wait on hold.
 * Other accounts keep the original controller/environment path and one-call limit.
 */
export class CallWaitingPhoneController implements PhoneController {
  private children: SipPhoneController[];
  private lines: number;
  private dialing?: Slot;
  private waitingTone = new WaitingTone();
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
    this.lines = Math.max(2, Math.min(DEFAULT_LINES, config.maxLines ?? DEFAULT_LINES));
    this.children = Array.from({ length: this.lines }, (_, slot) => {
      return new SipPhoneController(config, {
        ...environment,
        hasOtherCalls: () => this.enabled && this.othersLive(slot),
        createRemoteAudio: () => (this.outputs[slot] = environment.createRemoteAudio()),
        createManager: async (cfg, credentials, delegate, microphone, remoteAudio, recoveryContact) => {
          this.delegates[slot] = delegate;
          if (slot > 0) return this.virtualManager(delegate);
          if (!this.enabled) return environment.createManager(cfg, credentials, delegate, microphone, remoteAudio, recoveryContact);
          const dispatch = (session: ManagedSession, callback: (owner: ManagerDelegate) => void) => {
            const owner = this.owners.get(session.id);
            if (owner !== undefined && this.delegates[owner]) callback(this.delegates[owner]!);
          };
          const generation = ++this.generation;
          const bridge: ManagerDelegate = {
            ...delegate,
            canReceiveCall: () => this.canReceive(),
            onRegistered: () => { delegate.onRegistered(); this.delegates.slice(1).forEach(d => d?.onRegistered()); },
            onUnregistered: () => { delegate.onUnregistered(); this.delegates.slice(1).forEach(d => d?.onUnregistered()); },
            onServerDisconnect: error => { delegate.onServerDisconnect(error); this.delegates.slice(1).forEach(d => d?.onServerDisconnect(error)); },
            onCallCreated: session => {
              // An outgoing call belongs to the line that is dialling; an incoming one takes the first free line.
              const dialing = this.dialing;
              const outgoing = dialing !== undefined && !this.sessions[dialing] && this.children[dialing]!.getSnapshot().call?.phase === 'dialing';
              const slot = outgoing ? dialing : this.freeSlot();
              if (outgoing) this.dialing = undefined;
              if (slot === undefined) return;
              this.owners.set(session.id, slot); this.sessions[slot] = session;
              this.delegates[slot]!.onCallCreated(session);
            },
            onCallReceived: session => dispatch(session, target => {
              const slot = this.owners.get(session.id)!;
              if (!this.othersLive(slot)) this.selected = slot;
              if (this.audio) this.children[slot]!.applyAudio({ ...this.audio, ringtone: this.audio.ringtone && !this.othersLive(slot) });
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
          this.manager = await environment.createManager({ ...cfg, maxCalls: this.lines }, credentials, scoped, microphone, remoteAudio, recoveryContact, session => {
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
    });
    this.children.forEach(child => child.subscribe(() => this.rebuild()));
    this.rebuild();
  }

  private virtualManager(delegate: ManagerDelegate): Manager {
    const manager = () => { if (!this.manager) throw new Error('Line unavailable'); return this.manager; };
    return {
      contactName: 'shared-registration',
      readConnectionQuality: s => manager().readConnectionQuality?.(s) ?? Promise.resolve(null),
      connect: async () => { delegate.onServerConnect(); },
      isConnected: () => this.manager?.isConnected() ?? false,
      register: async () => { delegate.onRegistered(); },
      unregister: async () => undefined, disconnect: async () => undefined, dropSilently: async () => undefined,
      holdsLine: async () => true,
      call: (...args) => manager().call(...args),
      answer: s => manager().answer(s), decline: s => manager().decline(s), hangup: s => manager().hangup(s),
      transfer: (s, destination) => {
        const shared = manager();
        return shared.transfer ? shared.transfer(s, destination) : Promise.reject(new Error(t('team.transferFailed')));
      },
      prepareMedia: () => manager().prepareMedia?.() ?? Promise.resolve(),
      hold: s => manager().hold(s), unhold: s => manager().unhold(s),
      mute: s => manager().mute(s), unmute: s => manager().unmute(s),
      sendDTMF: (s, tone) => manager().sendDTMF(s, tone), sentAudioPackets: s => manager().sentAudioPackets(s),
    };
  }

  private canReceive() {
    if (this.closing || this.switching || this.children[0]!.getSnapshot().connection !== 'ready') return false;
    const calls = this.children.map(child => child.getSnapshot().call);
    const occupied = calls.filter(live);
    // Several calls may ring together; a call being set up or renegotiated blocks a new one.
    if (occupied.length >= this.lines || occupied.some(call => !stable(call) && call!.phase !== 'ringing-in')) return false;
    return calls.some((call, index) => !live(call) && !this.sessions[index] && this.delegates[index]?.canReceiveCall());
  }

  private rebuild() {
    const calls = this.children.map(child => child.getSnapshot().call);
    for (const call of calls) if (call?.phase === 'ended' && !this.completed.some(c => c.id === call.id)) this.completed = [...this.completed.slice(-31), call];
    const previous = this.selected;
    if (this.enabled && !live(calls[this.selected])) {
      // A conversation left on hold comes back before a call that is still ringing.
      const next = calls.findIndex(call => live(call) && call!.phase !== 'ringing-in');
      const fallback = next >= 0 ? next : calls.findIndex(live);
      if (fallback >= 0) this.selected = fallback;
    }
    // The mix stops as soon as one of its two calls is gone; the other goes on as an ordinary call.
    if (this.conference && !this.liveConsult()) { this.conference = false; this.conferenceMuted = false; this.manager?.setConference?.(undefined); }
    const main = this.conference && calls[this.selected] ? { ...calls[this.selected]!, muted: this.conferenceMuted } : calls[this.selected];
    const others = this.enabled ? calls.filter((call, index) => index !== this.selected && live(call)) as CallSnapshot[] : [];
    this.snapshot = { ...this.children[0]!.getSnapshot(), ...this.children[this.selected]!.getSnapshot(),
      connection: this.children[0]!.getSnapshot().connection, account: this.children[0]!.getSnapshot().account,
      lineTaken: this.children[0]!.getSnapshot().lineTaken, recoverySince: this.children[0]!.getSnapshot().recoverySince,
      retryAt: this.children[0]!.getSnapshot().retryAt, blockedUntil: this.children[0]!.getSnapshot().blockedUntil,
      call: main ?? null, otherCall: others[0], otherCalls: others,
      lines: this.enabled ? this.lines : 1, consulting: this.enabled && this.liveConsult(true) !== undefined, conference: this.conference,
      completedCalls: this.completed, switchingCall: this.switching,
      error: this.operationError ?? this.children[this.selected]!.getSnapshot().error ?? this.children[0]!.getSnapshot().error,
    };
    if (this.enabled) {
      if (!this.conference) this.manager?.focusSession?.(live(main) ? this.sessions[this.selected] : undefined);
      if (!calls.some(live)) this.mic.close();
      // A call ringing behind a conversation announces itself with a discreet double beep.
      const ringingBehind = others.some(call => call.phase === 'ringing-in') && live(main) && main!.phase !== 'ringing-in';
      if (ringingBehind && this.audio?.ringtone) this.waitingTone.start(this.audio.volume / 100); else this.waitingTone.stop();
    }
    this.listeners.forEach(listener => listener());
    if (previous !== this.selected && main?.phase === 'held' && !this.switching && !this.closing) {
      queueMicrotask(() => { if (!this.closing && !this.switching && this.snapshot.call?.id === main.id) this.setHeld(false); });
    }
  }
  getSnapshot = () => this.snapshot;
  readConnectionQuality = () => this.children[this.selected]!.readConnectionQuality();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  async connect(credentials: Credentials) {
    if (this.children[0]!.getSnapshot().connection === 'ready') return;
    this.enabled = this.config.callWaitingLines?.includes(credentials.username.trim()) === true;
    this.selected = 0; this.closing = false; this.operationError = undefined;
    await Promise.all(this.children.slice(0, this.enabled ? this.lines : 1).map(child => child.connect(credentials)));
    if (this.audio) this.applyAudio(this.audio);
    await this.setOutputDevice(this.outputDevice);
  }
  async disconnect() {
    this.closing = true; this.operation++; this.switching = false;
    this.waitingTone.stop();
    for (const child of [...this.children].reverse()) await child.disconnect();
    this.generation++; this.manager = undefined; this.mic.close(); this.sessions = []; this.owners.clear(); this.completed = []; this.selected = 0; this.dialing = undefined; this.conference = false; this.consult = undefined; this.rebuild();
  }
  checkConnection = () => this.children[0]!.checkConnection();
  reconnect = () => this.children[0]!.reconnect();
  retakeLine = () => this.children[0]!.retakeLine();
  call(raw: string, target: string, name?: string) {
    if (this.switching || this.children.some(child => live(child.getSnapshot().call))) return;
    this.children.forEach(child => child.dismiss()); this.selected = 0; this.operationError = undefined;
    this.dialing = 0;
    this.children[0]!.call(raw, target, name);
  }

  /** « Attente puis appeler » : the conversation waits on hold while a second, internal call is placed. */
  async callSecond(raw: string, target: string, name?: string, route?: string) {
    if (!this.enabled || this.switching) return;
    const from = this.selected, a = this.children[from]!, source = a.getSnapshot().call;
    const to = this.freeSlot();
    if (!stable(source) || to === undefined || this.children.filter(child => live(child.getSnapshot().call)).length !== 1) return;
    const token = ++this.operation;
    this.switching = true; this.operationError = undefined; this.rebuild();
    try {
      const held = source!.phase === 'held' || await this.waitFor(from, 'held', () => a.setHeld(true), true);
      if (token !== this.operation) return;
      if (!held) { if (live(a.getSnapshot().call)) this.operationError = t('waiting.holdFailed'); return; }
      const b = this.children[to]!;
      b.dismiss(); this.dialing = to; this.consult = { held: source!.id, placed: '' };
      b.call(raw, target, name, route);
      const placed = b.getSnapshot().call;
      if (!placed) { this.dialing = undefined; this.consult = undefined; this.operationError = t('waiting.resumeFailed'); return; }
      this.consult.placed = placed.id;
      this.selected = to;
    } finally {
      if (token === this.operation) {
        this.switching = false; this.rebuild();
        // Nothing was dialled: give the conversation back at once.
        if (this.selected === from && a.getSnapshot().call?.phase === 'held' && source?.phase !== 'held') a.setHeld(false);
      }
    }
  }

  /** Connects the held party to the consulted one and leaves; resolves once the PBX confirms. */
  async completeTransfer() {
    const consult = this.liveConsult();
    const shared = this.manager;
    if (!consult || this.switching || !shared?.attendedTransfer) throw new Error(t('team.transferFailed'));
    const [heldSlot, placedSlot] = consult;
    const held = this.sessions[heldSlot], placed = this.sessions[placedSlot];
    if (!held || !placed || this.children[placedSlot]!.getSnapshot().call?.phase !== 'active') throw new Error(t('team.transferFailed'));
    const token = ++this.operation;
    this.switching = true; this.rebuild();
    try {
      await shared.attendedTransfer(held, placed);
      // The PBX bridged both parties: leave whatever dialog it has not closed yet.
      for (const slot of [placedSlot, heldSlot]) if (live(this.children[slot]!.getSnapshot().call)) this.children[slot]!.hangup();
    } catch {
      throw new Error(t('team.transferFailed'));
    } finally {
      if (token === this.operation) { this.switching = false; this.rebuild(); }
    }
  }

  /** Conference: the held party comes back and both calls are mixed with this phone. */
  async startConference() {
    const consult = this.liveConsult();
    const shared = this.manager;
    if (!consult || this.conference || this.switching || !shared?.setConference) throw new Error(t('threeWay.failed'));
    const [heldSlot, placedSlot] = consult;
    if (this.children[placedSlot]!.getSnapshot().call?.phase !== 'active') throw new Error(t('threeWay.failed'));
    const token = ++this.operation;
    this.switching = true; this.rebuild();
    try {
      const held = this.children[heldSlot]!;
      const resumed = held.getSnapshot().call?.phase === 'active' || await this.waitFor(heldSlot, 'active', () => held.setHeld(false), true);
      if (token !== this.operation) return;
      const sessions = [this.sessions[heldSlot], this.sessions[placedSlot]];
      if (!resumed || !sessions[0] || !sessions[1] || !this.liveConsult()) throw new Error(t('threeWay.failed'));
      this.conference = true; this.conferenceMuted = false;
      shared.setConference(sessions as ManagedSession[], false);
    } finally {
      if (token === this.operation) { this.switching = false; this.rebuild(); }
    }
  }

  /** « Raccrocher le tiers » : ends the consulted call; the held conversation resumes by itself. */
  hangupSecond() {
    const consult = this.liveConsult(true);
    if (!consult || this.switching) return;
    this.children[consult[1]]!.hangup(); this.rebuild();
  }

  /** « Raccrocher les deux » : ends every call of this phone. */
  hangupAll() {
    this.operation++; this.switching = false;
    for (const child of this.children) {
      const call = child.getSnapshot().call;
      if (!live(call)) continue;
      if (call!.phase === 'ringing-in') child.decline(); else child.hangup();
    }
    this.rebuild();
  }

  private consult?: { held: string; placed: string };
  private conference = false;
  private conferenceMuted = false;
  /** Slots of the held party and of the consulted one, while both calls are still up. */
  private liveConsult(dialingToo = false): [Slot, Slot] | undefined {
    if (!this.consult) return undefined;
    const slotOf = (id: string) => this.children.findIndex(child => { const call = child.getSnapshot().call; return live(call) && call!.id === id; });
    const held = slotOf(this.consult.held), placed = slotOf(this.consult.placed);
    if (held < 0 || placed < 0) return undefined;
    if (!dialingToo && !stable(this.children[placed]!.getSnapshot().call)) return undefined;
    return [held, placed];
  }
  private freeSlot(): Slot | undefined {
    const index = this.children.findIndex((child, slot) => !live(child.getSnapshot().call) && !this.sessions[slot]);
    return index >= 0 ? index : undefined;
  }
  private othersLive(slot: Slot) { return this.children.some((child, index) => index !== slot && live(child.getSnapshot().call)); }
  private slotOfCall(id?: string, phase?: (call: CallSnapshot) => boolean): Slot | undefined {
    const index = this.children.findIndex((child, slot) => {
      const call = child.getSnapshot().call;
      return slot !== this.selected && live(call) && (id ? call!.id === id : !phase || phase(call!));
    });
    return index >= 0 ? index : undefined;
  }
  answer = () => { if (!this.switching) this.children[this.selected]!.answer(); };
  decline = () => { if (!this.switching) this.children[this.selected]!.decline(); };
  hangup() {
    this.operation++; this.switching = false;
    // Leaving a consultation that has not been answered must not hang up on the held party.
    this.children[this.selected]!.hangup(); this.rebuild();
  }
  async transfer(extension: string) {
    if (this.switching || this.children.filter(child => live(child.getSnapshot().call)).length !== 1) throw new Error(t('team.transferFailed'));
    return this.children[this.selected]!.transfer(extension);
  }
  dismiss() { if (!this.children.some(child => live(child.getSnapshot().call))) this.children.forEach(child => child.dismiss()); }
  setMuted(muted: boolean) {
    if (this.switching) return;
    // In a conference only the microphone is cut: both parties keep hearing each other.
    if (this.conference) { this.conferenceMuted = muted; this.manager?.setConference?.(this.conferenceSessions(), muted); this.rebuild(); return; }
    this.children[this.selected]!.setMuted(muted);
  }
  setHeld(held: boolean) { if (!this.switching && !this.conference) this.children[this.selected]!.setHeld(held); }
  private conferenceSessions() {
    const consult = this.liveConsult();
    return consult ? consult.map(slot => this.sessions[slot]).filter((session): session is ManagedSession => !!session) : undefined;
  }
  sendDtmf(tone: string) { if (!this.switching) this.children[this.selected]!.sendDtmf(tone); }
  resumeAudio() { this.children[this.selected]!.resumeAudio(); }
  async setInputDevice(id: string) { await this.mic.setDevice(id); await Promise.all(this.children.map(child => child.setInputDevice(id))); }
  async setOutputDevice(id: string) { this.outputDevice = id; await Promise.all(this.children.map(child => child.setOutputDevice(id))); }
  applyAudio(audio: AudioSettings) { this.audio = audio; this.mic.update(audio); this.children.forEach((child, index) => child.applyAudio({ ...audio, ringtone: audio.ringtone && !(child.getSnapshot().call?.phase === 'ringing-in' && this.othersLive(index)) })); }

  private waitFor(slot: Slot, phase: 'held' | 'active' | 'ended', action: () => void, hold = false): Promise<boolean> {
    const child = this.children[slot]!, before = child.getSnapshot();
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

  /** Without an id, the first call that is ringing (or, to switch, the first one on hold). */
  declineWaiting(id?: string) {
    const slot = this.slotOfCall(id, call => call.phase === 'ringing-in');
    const waiting = slot === undefined ? undefined : this.children[slot]!;
    if (!this.switching && waiting?.getSnapshot().call?.phase === 'ringing-in') waiting.decline();
  }
  answerWaiting(id?: string) { void this.changeCall(true, this.slotOfCall(id, call => call.phase === 'ringing-in')); }
  switchCall(id?: string) { void this.changeCall(false, this.slotOfCall(id, call => call.phase !== 'ringing-in')); }

  private async changeCall(answer: boolean, to: Slot | undefined) {
    if (!this.enabled || this.switching || to === undefined) return;
    const from = this.selected, a = this.children[from]!, b = this.children[to]!;
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
