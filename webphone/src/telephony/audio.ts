import { t } from '../i18n';
import { findRingtone, previewSeconds, scheduleRingtone } from './ringtones';

/**
 * Microphone chain: device → gain → the track sent to the call.
 * Each call owns its output track: SIP.js stops that track when it closes the
 * session. Never reuse an amplified destination across calls.
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
    this.gainNode?.disconnect();
    this.destination?.stream.getTracks().forEach(track => track.stop());
    this.destination?.disconnect();
    this.source = undefined;
    this.input = undefined;
    this.gainNode = undefined;
    this.destination = undefined;
    // The shared AudioContext also plays sounds and the far end; keep it alive.
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
