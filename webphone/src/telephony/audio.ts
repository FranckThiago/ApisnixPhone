import { findRingtone, previewSeconds, scheduleRingtone } from './ringtones';

/**
 * Microphone chain: device → gain → the track sent to the call.
 * The sent track never changes, so sensitivity and even the microphone itself
 * can be changed during a call without renegotiating it.
 */
export interface MicSettings {
  deviceId: string;
  /** 0–200 %, 100 = unchanged. */
  gain: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export class MicPipeline {
  private context?: AudioContext;
  private gainNode?: GainNode;
  private destination?: MediaStreamAudioDestinationNode;
  private source?: MediaStreamAudioSourceNode;
  private input?: MediaStream;
  /** True when the raw microphone is sent because the gain chain could not run. */
  bypassed = false;

  constructor(private settings: MicSettings) {}

  private constraints(): MediaStreamConstraints {
    const { deviceId, echoCancellation, noiseSuppression } = this.settings;
    return { audio: { deviceId: deviceId === 'default' ? undefined : { exact: deviceId }, echoCancellation, noiseSuppression, autoGainControl: true }, video: false };
  }

  /** Asks for the microphone; rejects with the browser's error when refused or missing. */
  /** `forceChain` is for the settings' level meter, which needs the chain even at 100 %. */
  async open(forceChain = false): Promise<MediaStream> {
    const input = await navigator.mediaDevices.getUserMedia(this.constraints());
    // At the original level there is nothing to adjust: the microphone goes straight to the call.
    // The gain chain is one more thing that can fail, so only those who move the setting go through it.
    if (this.settings.gain === 100 && !forceChain) return this.direct(input);
    // The output unlocked at sign-in is reused: a context created here, without a recent click, may stay
    // asleep, and a sleeping chain produces no audio at all — the far end would hear nothing.
    this.context ??= soundContext() ?? new AudioContext();
    if (this.context.state !== 'running') await this.context.resume().catch(() => undefined);
    // Being heard matters more than the sensitivity setting: send the microphone as it is.
    if (this.context.state !== 'running') return this.direct(input);
    this.bypassed = false;
    this.gainNode ??= this.context.createGain();
    this.destination ??= this.context.createMediaStreamDestination();
    this.gainNode.gain.value = this.settings.gain / 100;
    this.gainNode.connect(this.destination);
    this.attach(input);
    return this.destination.stream;
  }

  private direct(input: MediaStream) {
    this.input?.getTracks().forEach(track => track.stop());
    this.source?.disconnect();
    this.source = undefined;
    this.input = input;
    this.bypassed = true;
    return input;
  }

  private attach(input: MediaStream) {
    this.source?.disconnect();
    this.input?.getTracks().forEach(track => track.stop());
    this.input = input;
    this.source = this.context!.createMediaStreamSource(input);
    this.source.connect(this.gainNode!);
  }

  setGain(gain: number) {
    this.settings.gain = gain;
    if (this.gainNode) this.gainNode.gain.value = gain / 100;
  }

  update(patch: Partial<MicSettings>) {
    Object.assign(this.settings, patch);
  }

  /** The previous microphone keeps working until the new one is really open. */
  async switchDevice(deviceId: string) {
    const previous = this.settings.deviceId;
    this.settings.deviceId = deviceId;
    if (!this.context || !this.input || this.bypassed) return;
    try {
      this.attach(await navigator.mediaDevices.getUserMedia(this.constraints()));
    } catch (error) {
      this.settings.deviceId = previous;
      throw error;
    }
  }

  /** Releases the microphone: nothing keeps listening after a call or a test. */
  close() {
    this.source?.disconnect();
    this.input?.getTracks().forEach(track => track.stop());
    this.source = undefined;
    this.input = undefined;
  }

  /** Level after the gain, 0–1, for the settings meter. */
  createMeter(): (() => number) | null {
    if (!this.context || !this.gainNode) return null;
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 512;
    this.gainNode.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    return () => {
      analyser.getFloatTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      return Math.min(1, peak);
    };
  }
}

let sharedContext: AudioContext | undefined;

function soundContext(): AudioContext | undefined {
  if (typeof AudioContext === 'undefined') return undefined;
  sharedContext ??= new AudioContext();
  // Safari also reports « interrupted »: anything but running needs a nudge.
  if (sharedContext.state !== 'running') void sharedContext.resume().catch(() => undefined);
  return sharedContext;
}

let keepAwake = false;
// Elements the browser refused to start: a sign-in without a click (after a reload) cannot unlock them yet.
const locked = new Set<HTMLAudioElement>();

/** Browsers may put the sound output back to sleep after a while: any click or key wakes it up again. */
function keepSoundAwake() {
  if (keepAwake || typeof document === 'undefined') return;
  keepAwake = true;
  const wake = () => {
    if (sharedContext && sharedContext.state !== 'running') void sharedContext.resume().catch(() => undefined);
    for (const audio of locked) void audio.play().then(() => locked.delete(audio)).catch(() => undefined);
  };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('keydown', wake, true);
}

/**
 * Unlocks a media element from a click, so the far end's voice can start later without one.
 * It plays a silent stream now; SIP.js swaps in the real one when the call connects.
 */
export function primeElement(audio: HTMLAudioElement) {
  const context = soundContext();
  if (!context || audio.srcObject) return;
  audio.srcObject = context.createMediaStreamDestination().stream;
  keepSoundAwake();
  void audio.play().catch(() => { locked.add(audio); });
}

/**
 * Browsers only let a page make sound right after a click. The real line takes a
 * few seconds to register, by which time that permission is gone: call this from
 * the sign-in click so the chime and the ringtone can play later.
 */
export function primeAudio() {
  const context = soundContext();
  if (!context) return;
  keepSoundAwake();
  // A silent blip is what actually unlocks the output on Safari.
  const source = context.createBufferSource();
  source.buffer = context.createBuffer(1, 1, 22050);
  source.connect(context.destination);
  source.start();
}

/** Plays a ringtone of the library in a loop: generated, no audio file to ship, silent at once when stopped. */
export class Ringer {
  private timer?: ReturnType<typeof setInterval>;
  private output?: GainNode;

  start(volume: number, ringtoneId?: string) {
    const context = soundContext();
    if (this.timer || !context) return;
    const ringtone = findRingtone(ringtoneId);
    const output = context.createGain();
    output.gain.value = volume;
    output.connect(context.destination);
    this.output = output;
    const cycle = () => {
      if (context.state !== 'running') void context.resume().catch(() => undefined);
      scheduleRingtone(context, output, context.currentTime + 0.02, ringtone);
    };
    cycle();
    this.timer = setInterval(cycle, ringtone.period * 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const output = this.output;
    this.output = undefined;
    if (!output) return;
    // Notes already scheduled are cut with their output; a few milliseconds of fade avoid a click.
    output.gain.setTargetAtTime(0, output.context.currentTime, 0.015);
    setTimeout(() => output.disconnect(), 150);
  }
}

/** Plays a ringtone for about three seconds, from a click in the settings; returns a way to cut it short. */
export function previewRingtone(ringtoneId: string, volume: number, onEnd: () => void): () => void {
  const ringer = new Ringer();
  ringer.start(volume, ringtoneId);
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    ringer.stop();
    onEnd();
  };
  const timer = setTimeout(stop, previewSeconds(findRingtone(ringtoneId)) * 1000);
  return stop;
}

export interface CallProgressSoundPlayer {
  startRingback(volume: number): void;
  answered(volume: number): void;
  stop(): void;
}

/**
 * Local feedback for an outbound call. The two short telephone pulses repeat
 * only while the far end is ringing; a single bright bell confirms the answer.
 * Everything is generated in the browser, so there is no media file to load.
 */
export class CallProgressSounds implements CallProgressSoundPlayer {
  private timer?: ReturnType<typeof setInterval>;
  private active = new Set<OscillatorNode>();

  startRingback(volume: number) {
    const context = soundContext();
    if (this.timer || !context || volume <= 0) return;
    const cycle = () => {
      if (context.state !== 'running') void context.resume().catch(() => undefined);
      // Two short, rounded pulses: the familiar « toup toup » heard while waiting.
      for (const offset of [0, 0.38]) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 440;
        const start = context.currentTime + offset;
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(0.13 * volume, start + 0.025);
        envelope.gain.setValueAtTime(0.13 * volume, start + 0.18);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        oscillator.connect(envelope).connect(context.destination);
        oscillator.addEventListener('ended', () => this.active.delete(oscillator));
        this.active.add(oscillator);
        oscillator.start(start);
        oscillator.stop(start + 0.3);
      }
    };
    cycle();
    this.timer = setInterval(cycle, 2600);
  }

  answered(volume: number) {
    this.stop();
    const context = soundContext();
    if (!context || volume <= 0) return;
    if (context.state !== 'running') {
      void context.resume().then(() => { if (context.state === 'running') this.answered(volume); }).catch(() => undefined);
      return;
    }
    const start = context.currentTime;
    // A compact service-bell « gling »: a clear strike with two quick overtones.
    for (const [ratio, level, decay] of [[1, 0.18, 0.85], [2.01, 0.08, 0.52], [3.9, 0.035, 0.3]] as const) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880 * ratio;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(level * volume, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + decay + 0.03);
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const oscillator of this.active) {
      try { oscillator.stop(); } catch { /* Already stopped by its envelope. */ }
    }
    this.active.clear();
  }
}

/**
 * Public-address chime, like the one before an airport announcement: three bell
 * notes for a line that is ready, two falling ones for a line that dropped.
 * Generated on the fly, about 2.5 s, no audio file.
 */
export function chime(kind: 'ready' | 'lost', volume: number) {
  const context = soundContext();
  if (!context || volume <= 0) return;
  // Notes scheduled on a sleeping output are lost on Safari: wait for it to run.
  if (context.state !== 'running') {
    void context.resume().then(() => { if (context.state === 'running') chime(kind, volume); }).catch(() => undefined);
    return;
  }
  const notes = kind === 'ready' ? [523.25, 659.25, 783.99] : [659.25, 440];
  notes.forEach((frequency, index) => {
    const start = context.currentTime + index * 0.42;
    // A bell is a fundamental plus quieter, faster-fading overtones.
    for (const [ratio, level, decay] of [[1, 0.2, 1.7], [2, 0.07, 1.0], [3.01, 0.03, 0.6]] as const) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * ratio;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(level * volume, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + decay + 0.05);
    }
  });
}

export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Le microphone est bloqué. Autorisez-le dans la barre d’adresse du navigateur, puis réessayez.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucun microphone trouvé. Branchez votre casque, puis réessayez.';
  if (name === 'NotReadableError') return 'Le microphone est utilisé par une autre application.';
  return 'Le microphone est indisponible.';
}
