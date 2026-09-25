/**
 * The ringtone library. Every ringtone is a short score generated in the
 * browser: no audio file to ship or license, and it stops the instant a call
 * is answered. Calm ones use soft sine and triangle tones; loud ones use
 * square and sawtooth waves, whose bright harmonics carry over an open space.
 */

/** One sound of a ringtone cycle; times are in seconds from the start of the cycle. */
export interface RingNote {
  at: number;
  frequency: number;
  /** Until silence, fade included. */
  length: number;
  /** Peak level before the listening volume, 0–1. */
  level: number;
  type?: OscillatorType;
  /** Rise time, short by default so the note is struck. */
  attack?: number;
  /** A held note keeps its level and fades over this time; without it the note decays like a bell. */
  release?: number;
}

export interface Ringtone {
  id: string;
  label: string;
  hint: string;
  loud: boolean;
  /** Seconds between the start of two cycles. */
  period: number;
  notes: readonly RingNote[];
}

/** A bell: a fundamental plus quieter, faster-fading overtones. */
function bell(at: number, frequency: number, level: number, length: number): RingNote[] {
  return [
    { at, frequency, level, length },
    { at, frequency: frequency * 2, level: level * 0.3, length: length * 0.6 },
    { at, frequency: frequency * 3.01, level: level * 0.12, length: length * 0.35 },
  ];
}

/** A marimba bar: a round fundamental and the short « tock » of its fourth partial. */
function marimba(at: number, frequency: number): RingNote[] {
  return [
    { at, frequency, level: 0.2, length: 0.55, attack: 0.005 },
    { at, frequency: frequency * 3.93, level: 0.045, length: 0.12, attack: 0.003 },
  ];
}

/** A soft chord that swells in, lightly strummed. */
function swell(at: number, frequencies: number[]): RingNote[] {
  return frequencies.map((frequency, index) => ({ at: at + index * 0.1, frequency, level: 0.075, length: 1.4, type: 'triangle', attack: 0.45, release: 0.8 }));
}

/** A clapper hammering two bells about 25 times a second, as in an old handset. */
function hammer(at: number, strikes: number): RingNote[] {
  return Array.from({ length: strikes }, (_, index) => ({ at: at + index * 0.04, frequency: index % 2 ? 1470 : 1180, level: 0.22, length: 0.25, type: 'square', attack: 0.002 }));
}

/** Two tones alternating quickly, like an electronic desk phone. */
function warble(at: number, seconds: number): RingNote[] {
  return Array.from({ length: Math.round(seconds / 0.05) }, (_, index) => ({ at: at + index * 0.05, frequency: index % 2 ? 1600 : 1250, level: 0.28, length: 0.05, type: 'square', attack: 0.003, release: 0.008 }));
}

function beep(at: number, frequency: number, length: number, level: number, type: OscillatorType): RingNote {
  return { at, frequency, level, length, type, attack: 0.004, release: 0.02 };
}

/** The original two-tone ring, kept as the default. */
const CLASSIQUE: Ringtone = {
  id: 'classique', label: 'Classique', hint: 'Deux notes brèves, la sonnerie d’origine.', loud: false, period: 1.6,
  notes: [{ at: 0, frequency: 740, level: 0.18, length: 0.22, attack: 0.03 }, { at: 0.22, frequency: 587, level: 0.18, length: 0.22, attack: 0.03 }],
};

export const DEFAULT_RINGTONE = CLASSIQUE.id;

export const RINGTONES: readonly Ringtone[] = [
  CLASSIQUE,
  {
    id: 'carillon', label: 'Carillon', hint: 'Quatre notes de cloche, comme une horloge.', loud: false, period: 4,
    notes: [659.25, 523.25, 587.33, 392].flatMap((frequency, index) => bell(index * 0.5, frequency, 0.16, 1.8)),
  },
  {
    id: 'marimba', label: 'Marimba', hint: 'Notes boisées, légères et rondes.', loud: false, period: 2.4,
    notes: [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25].flatMap((frequency, index) => marimba(index * 0.15, frequency)),
  },
  {
    id: 'douce', label: 'Douce', hint: 'Deux accords qui montent sans brusquer.', loud: false, period: 3.6,
    notes: [...swell(0, [440, 554.37, 659.25]), ...swell(1.5, [440, 587.33, 739.99])],
  },
  {
    id: 'retro', label: 'Rétro', hint: 'La cloche mécanique d’un vieux téléphone.', loud: true, period: 3,
    notes: [...hammer(0, 10), ...hammer(0.6, 10)],
  },
  {
    id: 'trille', label: 'Trille', hint: 'Deux tons vifs, comme un standard de bureau.', loud: true, period: 2.2,
    notes: warble(0, 1),
  },
  {
    id: 'alarme', label: 'Alarme', hint: 'Bips aigus et rapides, impossibles à manquer.', loud: true, period: 1.2,
    notes: [0, 0.16, 0.32, 0.48].map(at => beep(at, 1600, 0.1, 0.35, 'square')),
  },
  {
    id: 'clairon', label: 'Clairon', hint: 'Fanfare cuivrée qui perce le bruit ambiant.', loud: true, period: 2.2,
    notes: ([[0, 392, 0.16], [0.18, 523.25, 0.16], [0.36, 659.25, 0.16], [0.54, 783.99, 0.5]] as const).map(([at, frequency, length]) => beep(at, frequency, length, 0.26, 'sawtooth')),
  },
];

/** An unknown or retired choice falls back to the original ringtone. */
export function findRingtone(id: string | undefined): Ringtone {
  return RINGTONES.find(ringtone => ringtone.id === id) ?? CLASSIQUE;
}

/** When the last note of a cycle has fallen silent. */
export function soundLength(ringtone: Ringtone): number {
  return Math.max(...ringtone.notes.map(note => note.at + note.length));
}

/** Enough whole cycles to judge a ringtone, about three seconds, never cut in the middle of a note. */
export function previewSeconds(ringtone: Ringtone): number {
  let cycles = 1;
  while (cycles < 3 && (cycles - 1) * ringtone.period + soundLength(ringtone) < 2.5) cycles += 1;
  return (cycles - 1) * ringtone.period + soundLength(ringtone);
}

/** Schedules one cycle on `output`, starting at the context time `start`. */
export function scheduleRingtone(context: BaseAudioContext, output: AudioNode, start: number, ringtone: Ringtone) {
  for (const note of ringtone.notes) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const begin = start + note.at;
    const end = begin + note.length;
    const peak = begin + (note.attack ?? 0.01);
    oscillator.type = note.type ?? 'sine';
    oscillator.frequency.value = note.frequency;
    envelope.gain.setValueAtTime(0, begin);
    envelope.gain.linearRampToValueAtTime(note.level, peak);
    if (note.release) envelope.gain.setValueAtTime(note.level, Math.max(peak, end - note.release));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope).connect(output);
    oscillator.start(begin);
    oscillator.stop(end + 0.02);
  }
}
