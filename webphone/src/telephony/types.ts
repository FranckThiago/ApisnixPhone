import type { CallDirection, CallOutcome } from '../domain/types';

/** An open WebSocket is not a registered account; a registered account is not an established call. */
export type ConnectionState =
  | 'offline' | 'connecting' | 'registering' | 'ready'
  | 'auth-error' | 'network-error' | 'reconnecting' | 'other-tab-active';

export type CallPhase = 'dialing' | 'ringing-out' | 'ringing-in' | 'active' | 'held' | 'ending' | 'ended';

export interface CallSnapshot {
  id: string;
  direction: CallDirection;
  rawInput: string;
  dialTarget: string;
  /** Remote identity is untrusted text: always rendered as text, never as HTML. */
  remoteName?: string;
  phase: CallPhase;
  muted: boolean;
  /** Hold was requested but the far end has not confirmed it yet. */
  holdPending: boolean;
  startedAt: number;
  answeredAt?: number;
  endedAt?: number;
  outcome?: CallOutcome;
  dtmf: string;
}

export interface Account {
  username: string;
  domain: string;
}

export interface PhoneSnapshot {
  demo: boolean;
  connection: ConnectionState;
  account: Account | null;
  call: CallSnapshot | null;
  error?: string;
}

export interface Credentials {
  username: string;
  /** Kept in memory for the session only; never written to any storage. */
  password: string;
}

export interface PhoneController {
  getSnapshot(): PhoneSnapshot;
  subscribe(listener: () => void): () => void;
  connect(credentials: Credentials): Promise<void>;
  disconnect(): Promise<void>;
  call(rawInput: string, dialTarget: string, remoteName?: string): void;
  answer(): void;
  decline(): void;
  hangup(): void;
  /** Clears an ended call once its wrap-up is done. */
  dismiss(): void;
  setMuted(muted: boolean): void;
  setHeld(held: boolean): void;
  sendDtmf(tone: string): void;
  setInputDevice(deviceId: string): Promise<void>;
  setOutputDevice(deviceId: string): Promise<void>;
  /** Everything the user tuned for sound; applied live, even during a call. */
  applyAudio(settings: AudioSettings): void;
}

export interface AudioSettings {
  /** Listening volume of this application, 0–100; not the computer's volume. */
  volume: number;
  /** Microphone sensitivity, 0–200 %, 100 = unchanged. */
  micGain: number;
  ringtone: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}
