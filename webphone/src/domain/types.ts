export type CallDirection = 'outbound' | 'inbound';
export type CallOutcome = 'answered' | 'no-answer' | 'busy' | 'failed' | 'cancelled' | 'declined' | 'missed';

export interface ContactNumber {
  label: string;
  /** Exactly as the user entered it. */
  value: string;
}

export interface Contact {
  id: string;
  name: string;
  company?: string;
  numbers: ContactNumber[];
  favorite: boolean;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

/** A call observed by this browser only, never the whole line. */
export interface CallRecord {
  id: string;
  direction: CallDirection;
  dialTarget: string;
  remoteName?: string;
  startedAt: number;
  answeredAt?: number;
  endedAt: number;
  outcome: CallOutcome;
  note?: string;
  tags: string[];
}

/** A promise to call someone back, kept on this device like the rest of the data. */
export interface Callback {
  id: string;
  /** Exactly as it will be dialled. */
  number: string;
  name?: string;
  dueAt: number;
  note?: string;
  createdAt: number;
  doneAt?: number;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Preferences {
  theme: Theme;
  density: 'comfortable' | 'compact';
  volume: number;
  /** Microphone sensitivity, 0–200 %. */
  micGain: number;
  ringtone: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  inputDevice: string;
  outputDevice: string;
  notifications: boolean;
  /** « Conserver sur cet appareil » : off on a first visit. */
  persist: boolean;
  /** Missed calls older than this were already looked at: they no longer raise the badge. */
  missedSeenAt: number;
  /** Same idea for callbacks that came due: opening « Rappels » acknowledges them. */
  callbacksSeenAt: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  density: 'comfortable',
  volume: 80,
  micGain: 100,
  ringtone: true,
  echoCancellation: true,
  noiseSuppression: true,
  inputDevice: 'default',
  outputDevice: 'default',
  notifications: false,
  persist: false,
  missedSeenAt: 0,
  callbacksSeenAt: 0,
};

export const CALL_TAGS = ['Intéressé', 'À rappeler', 'Rendez-vous', 'Pas intéressé', 'Mauvais numéro', 'Messagerie'] as const;

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  answered: 'Répondu',
  'no-answer': 'Sans réponse',
  busy: 'Occupé',
  failed: 'Échec',
  cancelled: 'Annulé',
  declined: 'Refusé',
  missed: 'Manqué',
};

export function talkSeconds(call: Pick<CallRecord, 'answeredAt' | 'endedAt'>): number {
  // Ringing and early media are not a conversation.
  return call.answeredAt ? Math.max(0, Math.round((call.endedAt - call.answeredAt) / 1000)) : 0;
}
