/** Just enough of Web Audio to see what a sound schedules, without a sound card. */
export class FakeParam {
  value = 1;
  events: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time: number) { this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value: number, time: number) { this.events.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value: number, time: number) { this.events.push(['exponential', value, time]); }
  setTargetAtTime(value: number, time: number) { this.events.push(['target', value, time]); }
}

export class FakeNode {
  connections: unknown[] = [];
  disconnected = false;
  constructor(readonly context: FakeContext) {}
  connect<T>(node: T) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
}

export class FakeGain extends FakeNode { gain = new FakeParam(); }

export class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  window: [number, number] = [0, 0];
  start(time: number) { this.window[0] = time; }
  stop(time: number) { this.window[1] = time; }
}

export class FakeContext {
  static last?: FakeContext;
  state = 'running';
  currentTime = 10;
  destination = new FakeNode(this);
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  constructor() { FakeContext.last = this; }
  resume() { return Promise.resolve(); }
  createOscillator() { const node = new FakeOscillator(this); this.oscillators.push(node); return node; }
  createGain() { const node = new FakeGain(this); this.gains.push(node); return node; }
}
