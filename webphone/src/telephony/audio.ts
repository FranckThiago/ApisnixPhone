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
  async open(): Promise<MediaStream> {
    const input = await navigator.mediaDevices.getUserMedia(this.constraints());
    // The output unlocked at sign-in is reused: a context created here, without a recent click, may stay
    // asleep, and a sleeping chain produces no audio at all — the far end would hear nothing.
    this.context ??= soundContext() ?? new AudioContext();
    if (this.context.state !== 'running') await this.context.resume().catch(() => undefined);
    if (this.context.state !== 'running') {
      // Being heard matters more than the sensitivity setting: send the microphone as it is.
      this.input?.getTracks().forEach(track => track.stop());
      this.source?.disconnect();
      this.source = undefined;
      this.input = input;
      this.bypassed = true;
      return input;
    }
    this.bypassed = false;
    this.gainNode ??= this.context.createGain();
    this.destination ??= this.context.createMediaStreamDestination();
    this.gainNode.gain.value = this.settings.gain / 100;
    this.gainNode.connect(this.destination);
    this.attach(input);
    return this.destination.stream;
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

/** A generated two-tone ring: no audio file to ship, stops instantly. */
export class Ringer {
  private timer?: ReturnType<typeof setInterval>;

  start(volume: number) {
    const context = soundContext();
    if (this.timer || !context) return;
    const burst = () => {
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
      for (const [frequency, offset] of [[740, 0], [587, 0.22]] as const) {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        oscillator.frequency.value = frequency;
        const start = context.currentTime + offset;
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(0.18 * volume, start + 0.03);
        envelope.gain.linearRampToValueAtTime(0, start + 0.2);
        oscillator.connect(envelope).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.22);
      }
    };
    burst();
    this.timer = setInterval(burst, 1600);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
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
