import type { CallOutcome } from '../domain/types';
import { CallProgressSounds, type CallProgressSoundPlayer, Ringer } from './audio';
import { DEFAULT_RINGTONE } from './ringtones';
import type { AudioSettings, CallSnapshot, Credentials, PhoneController, PhoneSnapshot } from './types';

/**
 * Same events as the real controller, without any network: it never opens a
 * WebSocket, never asks for the microphone and never reaches the PBX.
 * Scripted endings make every screen reachable: a target ending in 9 is busy,
 * in 8 never answers, in 7 fails; anything else answers.
 */
export class DemoPhoneController implements PhoneController {
  private snapshot: PhoneSnapshot = { demo: true, connection: 'offline', account: null, call: null };
  private listeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private sequence = 0;
  private ringer = new Ringer();
  private ringtone = { enabled: true, volume: 0.8, sound: DEFAULT_RINGTONE };

  constructor(private callProgress: CallProgressSoundPlayer = new CallProgressSounds()) {}

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(patch: Partial<PhoneSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }

  private updateCall(id: string, patch: Partial<CallSnapshot>) {
    const call = this.snapshot.call;
    if (call && call.id === id) this.update({ call: { ...call, ...patch } });
  }

  private later(delay: number, action: () => void) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      action();
    }, delay);
    this.timers.add(timer);
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  async connect({ username, password }: Credentials) {
    if (this.snapshot.connection === 'connecting' || this.snapshot.connection === 'registering') return;
    this.update({ connection: 'connecting', error: undefined });
    await new Promise<void>(resolve => this.later(450, resolve));
    this.update({ connection: 'registering' });
    await new Promise<void>(resolve => this.later(550, resolve));
    if (!username.trim() || !password) {
      // A terminal refusal: no retry loop.
      this.update({ connection: 'auth-error', error: 'Identifiant ou mot de passe refusé.' });
      return;
    }
    this.update({ connection: 'ready', account: { username: username.trim(), domain: 'demonstration.invalid' } });
  }

  async disconnect() {
    this.clearTimers();
    this.ringer.stop();
    this.callProgress.stop();
    this.update({ connection: 'offline', account: null, call: null, error: undefined });
  }

  call(rawInput: string, dialTarget: string, remoteName?: string) {
    // One click, one call: a second request while a call exists is ignored.
    if (this.snapshot.connection !== 'ready' || this.snapshot.call || !dialTarget) return;
    const id = `demo-${++this.sequence}`;
    this.update({
      call: { id, direction: 'outbound', rawInput, dialTarget, remoteName, phase: 'dialing', muted: false,
              holdPending: false, startedAt: Date.now(), dtmf: '' },
    });
    this.later(800, () => {
      this.updateCall(id, { phase: 'ringing-out' });
      this.callProgress.startRingback(this.ringtone.volume);
    });
    const last = dialTarget.slice(-1);
    const script: Record<string, [number, CallOutcome]> = { '9': [2600, 'busy'], '8': [9000, 'no-answer'], '7': [1800, 'failed'] };
    const ending = script[last];
    if (ending) this.later(ending[0], () => this.finish(id, ending[1]));
    // Talk time starts at the answer, never at the ringing.
    else this.later(3400, () => {
      this.callProgress.answered(this.ringtone.volume);
      this.updateCall(id, { phase: 'active', answeredAt: Date.now() });
    });
  }

  /** Demo only: lets the incoming-call screens be tried. */
  simulateIncoming(dialTarget: string, remoteName?: string) {
    if (this.snapshot.connection !== 'ready' || this.snapshot.call) return false;
    const id = `demo-${++this.sequence}`;
    this.update({
      call: { id, direction: 'inbound', rawInput: dialTarget, dialTarget, remoteName, phase: 'ringing-in',
              muted: false, holdPending: false, startedAt: Date.now(), dtmf: '' },
    });
    if (this.ringtone.enabled) this.ringer.start(this.ringtone.volume, this.ringtone.sound);
    this.later(20000, () => {
      if (this.snapshot.call?.id === id && this.snapshot.call.phase === 'ringing-in') this.finish(id, 'missed');
    });
    return true;
  }

  answer() {
    const call = this.snapshot.call;
    this.ringer.stop();
    if (call?.phase === 'ringing-in') this.updateCall(call.id, { phase: 'active', answeredAt: Date.now() });
  }

  decline() {
    const call = this.snapshot.call;
    if (call?.phase === 'ringing-in') this.finish(call.id, 'declined');
  }

  hangup() {
    const call = this.snapshot.call;
    if (!call || call.phase === 'ended' || call.phase === 'ending') return;
    if (call.phase === 'ringing-in') return this.decline();
    this.finish(call.id, call.answeredAt ? 'answered' : 'cancelled');
  }

  private finish(id: string, outcome: CallOutcome) {
    const call = this.snapshot.call;
    if (!call || call.id !== id || call.phase === 'ended') return;
    this.clearTimers();
    this.ringer.stop();
    this.callProgress.stop();
    this.updateCall(id, { phase: 'ended', outcome, endedAt: Date.now(), holdPending: false });
  }

  dismiss() {
    if (this.snapshot.call?.phase === 'ended') this.update({ call: null });
  }

  setMuted(muted: boolean) {
    const call = this.snapshot.call;
    if (call && (call.phase === 'active' || call.phase === 'held')) this.updateCall(call.id, { muted });
  }

  setHeld(held: boolean) {
    const call = this.snapshot.call;
    if (!call || call.holdPending || call.phase !== (held ? 'active' : 'held')) return;
    // The UI changes only once the far end has confirmed, as with a real re-INVITE.
    this.updateCall(call.id, { holdPending: true });
    this.later(500, () => {
      const current = this.snapshot.call;
      if (current?.id === call.id && current.holdPending) this.updateCall(call.id, { phase: held ? 'held' : 'active', holdPending: false });
    });
  }

  sendDtmf(tone: string) {
    const call = this.snapshot.call;
    if (call?.phase === 'active' && /^[\d*#]$/.test(tone)) this.updateCall(call.id, { dtmf: (call.dtmf + tone).slice(-32) });
  }

  async setInputDevice() {}
  async setOutputDevice() {}
  applyAudio(settings: AudioSettings) {
    this.ringtone = { enabled: settings.ringtone, volume: settings.volume / 100, sound: settings.ringtoneSound };
    if (!settings.ringtone) this.ringer.stop();
  }
  resumeAudio() {}
  retakeLine() {}
}
