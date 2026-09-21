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

  constructor(private settings: MicSettings) {}

  private constraints(): MediaStreamConstraints {
    const { deviceId, echoCancellation, noiseSuppression } = this.settings;
    return { audio: { deviceId: deviceId === 'default' ? undefined : { exact: deviceId }, echoCancellation, noiseSuppression, autoGainControl: true }, video: false };
  }

  /** Asks for the microphone; rejects with the browser's error when refused or missing. */
  async open(): Promise<MediaStream> {
    const input = await navigator.mediaDevices.getUserMedia(this.constraints());
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume().catch(() => undefined);
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
    if (!this.context || !this.input) return;
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

/** A generated two-tone ring: no audio file to ship, stops instantly. */
export class Ringer {
  private context?: AudioContext;
  private timer?: ReturnType<typeof setInterval>;

  start(volume: number) {
    if (this.timer || typeof AudioContext === 'undefined') return;
    const context = (this.context ??= new AudioContext());
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

export function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Le microphone est bloqué. Autorisez-le dans la barre d’adresse du navigateur, puis réessayez.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Aucun microphone trouvé. Branchez votre casque, puis réessayez.';
  if (name === 'NotReadableError') return 'Le microphone est utilisé par une autre application.';
  return 'Le microphone est indisponible.';
}
