import { DemoPhoneController } from '../telephony/DemoPhoneController';
import { allowedOrigins, safeOrigin } from '../embed/protocol';
import { pilotEnabled } from './pilotGate';
export { pilotEnabled } from './pilotGate';

/** Local experiment, deliberately separate from the supported embed SDK. */
export const PILOT_PROTOCOL = 'apisnixphone.conference-pilot.v1';
export type BridgeState = { connected: boolean; bridgeId: string | null; muted: boolean };
export const disconnectedBridge: BridgeState = { connected: false, bridgeId: null, muted: false };
export function bridgeState(phone: DemoPhoneController): BridgeState {
  const snapshot = phone.getSnapshot();
  const connected = snapshot.connection === 'ready' && snapshot.call?.phase === 'active';
  return { connected, bridgeId: connected ? snapshot.call!.id : null, muted: connected && snapshot.call!.muted };
}
export function validBridge(value: unknown): value is BridgeState {
  if (!value || typeof value !== 'object') return false;
  const state = value as BridgeState;
  return typeof state.connected === 'boolean' && typeof state.muted === 'boolean'
    && (state.connected ? typeof state.bridgeId === 'string' && state.bridgeId.length > 0 : state.bridgeId === null);
}
export function pilotOrigins() {
  return allowedOrigins(import.meta.env.VITE_EMBED_ALLOWED_ORIGINS, location.origin, true, true);
}

/** A real demo-controller session; no SIP registration, credentials or media capture. */
export class ConferenceSimulation {
  readonly phone = new DemoPhoneController({ startRingback() {}, stop() {}, answered() {} });
  private joining = false;
  constructor() {
    this.phone.applyAudio({ volume: 100, micGain: 100, ringtone: false, ringtoneSound: '', echoCancellation: true, noiseSuppression: true });
  }
  async join() {
    if (this.joining || bridgeState(this.phone).connected) return;
    this.joining = true;
    try {
      await this.phone.connect({ username: 'DEMO-CONFERENCE', password: 'demo-only' });
      this.phone.simulateIncoming('conference-demo');
      this.phone.answer();
    } finally { this.joining = false; }
  }
  async leave() { await this.phone.disconnect(); }
}

/** Receives audio-session state only. Customer calls stay entirely in VICIdial. */
export function mountConferencePilot(container: HTMLElement, origin: string, onState: (state: BridgeState) => void) {
  if (!safeOrigin(origin, true) || !pilotEnabled(import.meta.env.DEV, import.meta.env.VITE_APP_MODE, new URL(origin).hostname)) throw new Error('local-pilot-only');
  const frame = document.createElement('iframe');
  const channel = crypto.randomUUID();
  frame.src = origin + '/vicidial-pilot-phone';
  frame.title = 'ApisnixPhone API — démonstration conférence';
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'width:100%;height:330px;border:0;display:block;border-radius:12px';
  let receivedAt = 0;
  let wasConnected = false;
  let lastState = '';
  const publish = (state: BridgeState) => {
    const signature = JSON.stringify(state);
    if (signature !== lastState) { lastState = signature; onState(state); }
  };
  const reset = () => { receivedAt = 0; wasConnected = false; publish(disconnectedBridge); };
  const hello = () => frame.contentWindow?.postMessage({ protocol: PILOT_PROTOCOL, channel, type: 'hello' }, origin);
  const receive = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== origin || event.data?.protocol !== PILOT_PROTOCOL || event.data?.channel !== channel || event.data?.type !== 'bridge' || !validBridge(event.data.state)) return;
    receivedAt = Date.now(); wasConnected = event.data.state.connected;
    publish(event.data.state);
  };
  const loaded = () => { reset(); hello(); };
  window.addEventListener('message', receive);
  frame.addEventListener('load', loaded);
  container.append(frame); reset();
  const timer = setInterval(() => {
    hello();
    if (wasConnected && Date.now() - receivedAt > 3500) reset();
  }, 1000);
  return { destroy() { clearInterval(timer); window.removeEventListener('message', receive); frame.removeEventListener('load', loaded); frame.remove(); reset(); } };
}
