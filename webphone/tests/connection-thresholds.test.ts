import { test, assert } from 'vitest';
import { createQualityGate, createMediaReader } from '../src/connection/connection-monitor.mjs';

test('audio at 450 or 600 ms is tolerated; above 600 ms needs ten sustained seconds', () => {
  for (const rttMs of [450, 600]) {
    const gate = createQualityGate();
    for (let t = 0; t <= 20000; t += 2000)
      assert.notEqual(gate.sample({source: 'media', rttMs}, t).level, 'slow');
  }
  const gate = createQualityGate();
  for (let t = 0; t < 10000; t += 2000)
    assert.notEqual(gate.sample({source: 'media', rttMs: 601}, t).level, 'slow');
  assert.equal(gate.sample({source: 'media', rttMs: 601}, 10000).level, 'slow');
});
test('HTTP has its own 1500 ms boundary and ten-second confirmation', () => {
  const gate = createQualityGate();
  for (let t = 0; t <= 10000; t += 2000)
    assert.notEqual(gate.sample({source: 'http', rttMs: 1500}, t).level, 'slow');
  for (let t = 12000; t < 22000; t += 2000)
    assert.notEqual(gate.sample({source: 'http', rttMs: 1501}, t).level, 'slow');
  assert.equal(gate.sample({source: 'http', rttMs: 1501}, 22000).level, 'slow');
});
test('an isolated spike, short degradation and rapid duplicates never warn', () => {
  const gate = createQualityGate();
  for (const [time, rttMs] of [[0,900],[2000,100],[4000,900],[6000,900],[8000,900],[10000,100],[12000,900],[12001,900],[12002,900]] as const)
    assert.notEqual(gate.sample({source: 'media', rttMs}, time).level, 'slow');
});
test('loss above five percent needs ten seconds, exactly five percent is tolerated', () => {
  const gate = createQualityGate();
  for (let t = 0; t <= 10000; t += 2000)
    assert.notEqual(gate.sample({source: 'media', rttMs: 80, lossPct: 5}, t).level, 'slow');
  for (let t = 12000; t < 22000; t += 2000)
    assert.notEqual(gate.sample({source: 'media', rttMs: 80, lossPct: 5.1}, t).level, 'slow');
  assert.equal(gate.sample({source: 'media', rttMs: 80, lossPct: 5.1}, 22000).level, 'slow');
});
test('four intermittent failures warn; ten healthy seconds clear the warning and old incidents', () => {
  for (const source of ['http', 'media'] as const) {
    const gate = createQualityGate();
    for (let t = 0; t < 12000; t += 2000)
      assert.notEqual(gate.sample({source, rttMs: 450, lost: t % 4000 === 0}, t).level, 'slow');
    assert.equal(gate.sample({source, lost: true}, 12000).level, 'slow');
    for (let t = 14000; t < 24000; t += 2000)
      assert.equal(gate.sample({source, rttMs: 450}, t).level, 'slow');
    assert.equal(gate.sample({source, rttMs: 450}, 24000).level, 'good');
    assert.equal(gate.sample({source, lost: true}, 26000).level, 'good');
  }
});
test('four loss observations at ten percent count as incidents; below ten they do not', () => {
  for (const lossPct of [9.9, 10]) {
    const gate = createQualityGate();
    for (let t = 0; t <= 12000; t += 2000) {
      const state = gate.sample({source: 'media', rttMs: 80, lossPct: t % 4000 === 0 ? lossPct : 0}, t);
      assert.equal(state.level === 'slow', t === 12000 && lossPct === 10);
    }
  }
});
test('incidents outside the thirty-second window do not accumulate', () => {
  const gate = createQualityGate();
  for (const t of [0, 10000, 20000, 30001]) {
    assert.notEqual(gate.sample({source: 'http', lost: true}, t).level, 'slow');
    gate.sample({source: 'http', rttMs: 550}, t + 1);
  }
});
test('three sustained failures still turn red after four seconds; offline is immediate', () => {
  for (const source of ['http', 'media'] as const) {
    const gate = createQualityGate();
    for (const t of [0, 2000]) assert.notEqual(gate.sample({source, lost: true}, t).level, 'lost');
    assert.equal(gate.sample({source, lost: true}, 4000).level, 'lost');
  }
  assert.equal(createQualityGate().sample({source: 'offline', lost: true}, 0).level, 'lost');
});
test('orange and red recover only below 500 ms with at most five percent loss for ten seconds', () => {
  for (const level of ['slow', 'lost']) {
    const gate = createQualityGate();
    for (let t = 0; t <= 10000; t += 2000)
      gate.sample({source: 'media', rttMs: 700, lost: level === 'lost'}, t);
    for (let t = 12000; t <= 24000; t += 2000)
      assert.equal(gate.sample({source: 'media', rttMs: 500}, t).level, level);
    for (let t = 26000; t <= 38000; t += 2000)
      assert.notEqual(gate.sample({source: 'media', rttMs: 499, lossPct: 5.1}, t).level, 'good');
    for (let t = 40000; t < 50000; t += 2000)
      assert.notEqual(gate.sample({source: 'media', rttMs: 499, lossPct: 5}, t).level, 'good');
    assert.equal(gate.sample({source: 'media', rttMs: 499, lossPct: 5}, 50000).level, 'good');
  }
});
test('missing readings, source changes and reset break confirmation without claiming recovery', () => {
  const gate = createQualityGate();
  assert.equal(gate.sample({source: 'offline', lost: true}, 0).level, 'lost');
  for (const t of [2000, 4000, 6000, 8000]) gate.sample({source: 'media', rttMs: 100}, t);
  assert.equal(gate.sample({source: 'media', rttMs: NaN}, 10000).level, 'lost');
  for (const t of [12000, 14000, 16000, 18000, 20000]) gate.sample({source: 'media', rttMs: 100}, t);
  assert.equal(gate.sample({source: 'http', rttMs: 100}, 22000).level, 'lost');
  gate.reset();
  assert.equal(gate.sample({source: 'http', rttMs: 100}, 32000).level, 'lost');
});
test('changing the measurement source also resets intermittent incidents', () => {
  const gate = createQualityGate();
  for (const t of [0, 4000, 8000]) {
    gate.sample({source: 'http', lost: true}, t);
    gate.sample({source: 'http', rttMs: 100}, t + 2000);
  }
  assert.notEqual(gate.sample({source: 'media', lost: true}, 12000).level, 'slow');
});
test('native media reader selects the nominated path and only reads stats', async () => {
  const read = createMediaReader();
  const pc = {connectionState: 'connected', getStats: async () => new Map<string, object>([
    ['bad',{type:'candidate-pair',state:'succeeded',currentRoundTripTime:.1}],
    ['chosen',{id:'chosen',type:'candidate-pair',nominated:true,state:'succeeded',responsesReceived:2,currentRoundTripTime:.55}]
  ])};
  assert.deepEqual(await read(pc as unknown as RTCPeerConnection), {source:'media', rttMs:550});
  pc.getStats = async () => {throw new Error('unsupported')};
  assert.equal(await read(pc as unknown as RTCPeerConnection), null);
  pc.connectionState = 'failed';
  assert.deepEqual(await read(pc as unknown as RTCPeerConnection), {source:'media', lost:true});
});
