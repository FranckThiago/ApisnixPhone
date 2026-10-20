import { t } from '../i18n';
import { findRingtone, previewSeconds, scheduleRingtone } from './ringtones';

/** The call always receives the original microphone track, independently of Web Audio. */
export interface MicSettings {
  deviceId: string;
  /** Legacy input, ignored: microphone level is always 100 %. */
  gain?: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export class MicPipeline {
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private input?: MediaStream;
  private generation = 0;

  constructor(private settings: MicSettings) {}

  private constraints(): MediaStreamConstraints {
    const { deviceId, echoCancellation, noiseSuppression } = this.settings;
    return { audio: { deviceId: deviceId === 'default' ? undefined : { exact: deviceId }, echoCancellation, noiseSuppression, autoGainControl: true }, video: false };
  }

  /** The optional meter observes the raw input; it is never in the call's audio path. */
  async open(withMeter = false): Promise<MediaStream> {
    const generation = ++this.generation;
    const input = await navigator.mediaDevices.getUserMedia(this.constraints());
    // A hangup or a closed test can precede the browser's permission response.
    if (generation !== this.generation) {
      input.getTracks().forEach(track => track.stop());
      throw new DOMException('Microphone request cancelled', 'AbortError');
    }
    this.close();
    this.input = input;
    if (withMeter) {
      try {
        this.context = soundContext();
        if (this.context) {
          this.source = this.context.createMediaStreamSource(input);
          this.analyser = this.context.createAnalyser();
          this.analyser.fftSize = 512;
          this.source.connect(this.analyser);
        }
      } catch {
        this.source?.disconnect();
        this.source = undefined;
        this.analyser = undefined;
      }
    }
    return input;
  }

  update(patch: Partial<MicSettings>) { Object.assign(this.settings, patch); }

  /** Device selection applies at the next call, without replacing its live track. */
  async switchDevice(deviceId: string) { this.settings.deviceId = deviceId; }

  close() {
    this.generation++;
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.input?.getTracks().forEach(track => track.stop());
    this.source = undefined;
    this.analyser = undefined;
    this.input = undefined;
  }

  createMeter(): (() => number) | null {
    const analyser = this.analyser;
    if (!analyser) return null;
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

/** A hard ceiling just under full scale: louder than 100 %, peaks are held there instead of crackling. */
function limiter(context: BaseAudioContext): AudioNode {
  const node = context.createDynamicsCompressor();
  node.threshold.value = -2;
  node.knee.value = 0;
  node.ratio.value = 20;
  node.attack.value = 0.002;
  node.release.value = 0.15;
  return node;
}

const outputs = new WeakMap<BaseAudioContext, AudioNode>();

/** Where every generated sound goes: the listening volume reaches 200 %, the limiter keeps it clean. */
function soundOutput(context: BaseAudioContext): AudioNode {
  let output = outputs.get(context);
  if (!output) {
    output = limiter(context);
    output.connect(context.destination);
    outputs.set(context, output);
  }
  return output;
}

let keepAwake = false;
// Elements the browser refused to start: a sign-in without a click (after a reload) cannot unlock them yet.
const locked = new Set<HTMLAudioElement>();
// Other outputs of the page, such as the voice amplifier, woken up with the shared one.
const sleepers = new Set<AudioContext>();

/** Browsers may put the sound output back to sleep after a while: any click or key wakes it up again. */
function keepSoundAwake() {
  if (keepAwake || typeof document === 'undefined') return;
  keepAwake = true;
  const wake = () => {
    for (const context of [sharedContext, ...sleepers]) if (context && context.state !== 'running') void context.resume().catch(() => undefined);
    for (const audio of locked) void audio.play().then(() => locked.delete(audio)).catch(() => undefined);
  };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('click', wake, true);
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

/** Highest listening level: 2 = 200 %. */
export const MAX_LISTENING_LEVEL = 2;

type SinkContext = AudioContext & { setSinkId?(id: string): Promise<void> };

/**
 * The far end's voice. Up to 100 % it plays through its media element, as it always did. A media
 * element cannot go louder: above, during a call, the element is silenced — it keeps playing, which
 * some browsers need to hand a call's sound to Web Audio — and the stream is amplified behind a
 * limiter. Whenever that chain cannot run (output asleep, headset it cannot reach), the element
 * plays at full volume instead: the voice is never lost to the amplifier.
 */
export class RemoteVoice {
  private context?: SinkContext;
  private gain?: GainNode;
  private source?: MediaStreamAudioSourceNode;
  private track?: MediaStreamTrack;
  private level = 1;
  private quiet = false;
  private inCall = false;
  private sink = 'default';
  private sinkApplied = 'default';

  constructor(private element: HTMLAudioElement) {
    // SIP.js assigns the call's stream, and reloads the element when a new track arrives: follow it.
    element.addEventListener('loadstart', () => this.apply());
    this.apply();
  }

  /** 0–2; 1 is the element's full volume. */
  setLevel(level: number) {
    this.level = Math.min(MAX_LISTENING_LEVEL, Math.max(0, level));
    this.apply();
  }

  /** Silences the far end for an instant, e.g. while a hold is renegotiated. */
  setQuiet(quiet: boolean) {
    this.quiet = quiet;
    this.apply();
  }

  startCall() {
    this.inCall = true;
    this.apply();
  }

  endCall() {
    this.inCall = false;
    this.quiet = false;
    this.source?.disconnect();
    this.source = undefined;
    this.track = undefined;
    this.apply();
  }

  /** The amplifier must reach the headset chosen for the voice, or stay out of the way. */
  async setSink(deviceId: string) {
    this.sink = deviceId;
    await this.syncSink();
    this.apply();
  }

  private apply() {
    const amplify = this.level > 1 && this.inCall && this.connect();
    this.element.volume = amplify ? 1 : Math.min(1, this.level);
    this.element.muted = this.quiet || amplify;
    if (this.gain) this.gain.gain.value = amplify && !this.quiet ? this.level : 0;
  }

  private connect(): boolean {
    const stream = this.element.srcObject as MediaStream | null;
    const track = stream?.getAudioTracks?.()[0];
    if (!stream || !track || track.readyState === 'ended' || typeof AudioContext === 'undefined') return false;
    if (!this.context) {
      // Its own output, so the headset chosen for the voice does not also take the ringtone.
      const context: SinkContext = new AudioContext();
      this.context = context;
      this.gain = context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(limiter(context)).connect(context.destination);
      context.addEventListener('statechange', () => this.apply());
      sleepers.add(context);
      keepSoundAwake();
      void this.syncSink().then(() => this.apply());
    }
    if (this.context.state !== 'running') {
      void this.context.resume().catch(() => undefined);
      return false;
    }
    if (this.sinkApplied !== this.sink) return false;
    if (this.track !== track) {
      this.source?.disconnect();
      this.source = this.context.createMediaStreamSource(stream);
      this.source.connect(this.gain!);
      this.track = track;
    }
    return true;
  }

  private async syncSink() {
    const context = this.context;
    if (!context || this.sinkApplied === this.sink || !context.setSinkId) return;
    try {
      await context.setSinkId(this.sink === 'default' ? '' : this.sink);
      this.sinkApplied = this.sink;
    } catch {
      // The element keeps the voice on the chosen headset, at full volume.
    }
  }
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
    output.connect(soundOutput(context));
    this.output = output;
    let resuming = false;
    const play = () => {
      if (this.output === output && context.state === 'running') {
        scheduleRingtone(context, output, context.currentTime + 0.02, ringtone);
      }
    };
    const cycle = () => {
      if (context.state === 'running') return play();
      // Do not accumulate notes on a frozen audio clock. Resume only this active ring.
      if (resuming) return;
      resuming = true;
      void context.resume().then(play).catch(() => undefined).finally(() => { resuming = false; });
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
        envelope.gain.exponentialRampToValueAtTime(0.21 * volume, start + 0.025);
        envelope.gain.setValueAtTime(0.21 * volume, start + 0.18);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        oscillator.connect(envelope).connect(soundOutput(context));
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
    for (const [ratio, level, decay] of [[1, 0.288, 0.85], [2.01, 0.128, 0.52], [3.9, 0.056, 0.3]] as const) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880 * ratio;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(level * volume, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + decay);
      oscillator.connect(envelope).connect(soundOutput(context));
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

/** Row and column frequencies of each key, as on every tone-dialling telephone. */
export const DTMF_FREQUENCIES: Readonly<Record<string, readonly [number, number]>> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

/**
 * The short « bip » a classic phone plays under each key: the key's two tones
 * for about 150 ms. Heard only here; what reaches the far end during a call is
 * the DTMF sent by the line, never this sound.
 */
export function keypadTone(key: string, volume: number) {
  const pair = DTMF_FREQUENCIES[key];
  const context = soundContext();
  if (!pair || !context || volume <= 0) return;
  if (context.state !== 'running') {
    void context.resume().then(() => { if (context.state === 'running') keypadTone(key, volume); }).catch(() => undefined);
    return;
  }
  const start = context.currentTime + 0.005;
  for (const frequency of pair) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(0.24 * volume, start + 0.005);
    envelope.gain.setValueAtTime(0.24 * volume, start + 0.13);
    envelope.gain.linearRampToValueAtTime(0, start + 0.15);
    oscillator.connect(envelope).connect(soundOutput(context));
    oscillator.start(start);
    oscillator.stop(start + 0.16);
  }
}

/**
 * Public-address chime, like the one before an airport announcement, for a line
 * that is ready. A dropped line gets a different sound on purpose (Franck,
 * 20 October 2026: the two bells were too alike): three short falling beeps,
 * like a low-battery warning. Generated on the fly, no audio file.
 */
export function chime(kind: 'ready' | 'lost', volume: number) {
  const context = soundContext();
  if (!context || volume <= 0) return;
  // Notes scheduled on a sleeping output are lost on Safari: wait for it to run.
  if (context.state !== 'running') {
    void context.resume().then(() => { if (context.state === 'running') chime(kind, volume); }).catch(() => undefined);
    return;
  }
  if (kind === 'lost') {
    // Triangle beeps, each sagging a little, every one lower than the last.
    [784, 587.33, 392].forEach((frequency, index) => {
      const start = context.currentTime + index * 0.2;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.85, start + 0.14);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(0.3 * volume, start + 0.008);
      envelope.gain.setValueAtTime(0.3 * volume, start + 0.11);
      envelope.gain.linearRampToValueAtTime(0, start + 0.14);
      oscillator.connect(envelope).connect(soundOutput(context));
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    });
    return;
  }
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
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
      oscillator.connect(envelope).connect(soundOutput(context));
      oscillator.start(start);
      oscillator.stop(start + decay + 0.05);
    }
  });
}

export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return t('mic.blocked');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t('mic.notFound');
  if (name === 'NotReadableError') return t('mic.inUse');
  return t('mic.unavailable');
}
