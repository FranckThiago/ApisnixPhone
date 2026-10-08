import { t, type MessageKey } from '../i18n';

export type CallDirection = 'outbound' | 'inbound';
export type CallOutcome = 'answered' | 'no-answer' | 'busy' | 'failed' | 'cancelled' | 'declined' | 'missed' | 'unknown';

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
  /** Original incoming caller ID, before concordant provider metadata recovery. */
  receivedNumber?: string;
  remoteName?: string;
  startedAt: number;
  answeredAt?: number;
  endedAt: number;
  outcome: CallOutcome;
  /** Diagnostic shown in this device's journal when an observed call failed. */
  failure?: string;
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
  language?: 'fr' | 'en' | 'es';
  density: 'comfortable' | 'compact';
  /** Listening volume, 0–200 %: above 100 % the voice and the sounds are amplified. */
  volume: number;
  /** Microphone sensitivity, 0–200 %. */
  micGain: number;
  ringtone: boolean;
  /** Ringtone of the library; an unknown one falls back to the original. */
  ringtoneSound: string;
  /** Short cues when the line becomes ready or is lost. */
  lineSounds: boolean;
  /** The dual tone of a classic phone under each key of the pad. */
  keypadTones: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  inputDevice: string;
  outputDevice: string;
  notifications: boolean;
  /** Always on for live server profiles; legacy opt-in for device profiles. */
  persist: boolean;
  /** Missed calls older than this were already looked at: they no longer raise the badge. */
  missedSeenAt: number;
  /** Same idea for callbacks that came due: opening « Rappels » acknowledges them. */
  callbacksSeenAt: number;
}

/** Top of the listening volume, in %: a media element stops at 100, the rest is amplified. */
export const MAX_VOLUME = 200;
/**
 * Colour of the listening volume: red below 40 %, orange to 69 %, green to 119 %, then brown from 120 % and
 * black above 150 %, because amplifying carries risks (echo for the other person, distortion). The icon follows it.
 */
export type VolumeTone = 'bad' | 'warn' | 'ok' | 'hot' | 'max';
export const volumeTone = (volume: number): VolumeTone =>
  (volume > 150 ? 'max' : volume >= 120 ? 'hot' : volume >= 70 ? 'ok' : volume >= 40 ? 'warn' : 'bad');

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  density: 'comfortable',
  volume: 100,
  micGain: 100,
  ringtone: true,
  ringtoneSound: 'classique',
  lineSounds: true,
  keypadTones: true,
  echoCancellation: true,
  noiseSuppression: true,
  inputDevice: 'default',
  outputDevice: 'default',
  notifications: false,
  persist: false,
  missedSeenAt: 0,
  callbacksSeenAt: 0,
};

/** Stored under their French name, whatever the language: data saved before stays readable. */
export const CALL_TAGS = ['Intéressé', 'À rappeler', 'Rendez-vous', 'Pas intéressé', 'Mauvais numéro', 'Messagerie'] as const;
export type CallTag = typeof CALL_TAGS[number];
/** The tag a scheduled callback adds to its call. */
export const CALLBACK_TAG: CallTag = 'À rappeler';

const TAG_LABELS: Record<CallTag, MessageKey> = {
  'Intéressé': 'tag.interested', 'À rappeler': 'tag.callBack', 'Rendez-vous': 'tag.meeting',
  'Pas intéressé': 'tag.notInterested', 'Mauvais numéro': 'tag.wrongNumber', 'Messagerie': 'tag.voicemail',
};

/** A tag as shown in the current language. */
export const tagLabel = (tag: string) => (tag in TAG_LABELS ? t(TAG_LABELS[tag as CallTag]) : tag);

export const outcomeLabel = (outcome: CallOutcome) => t(`outcome.${outcome}`);

export function talkSeconds(call: Pick<CallRecord, 'answeredAt' | 'endedAt'>): number {
  // Ringing and early media are not a conversation.
  return call.answeredAt ? Math.max(0, Math.round((call.endedAt - call.answeredAt) / 1000)) : 0;
}
