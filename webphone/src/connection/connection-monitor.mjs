// Kept identical in ApisnixPhone webphone/src/connection/connection-monitor.mjs and agent-skin/connection-monitor.js.
// Passive measurements only: never register, reconnect, alter or end a call.
// Intermittent failures (timeouts, refused probes, heavy audio packet loss) are
// counted on a sliding window: three within 30 s mean an unstable connection
// even when good answers are interleaved. Sustained failures still mean "lost".
export const BURST_WINDOW_MS = 30000, BURST_COUNT = 3, LOSS_SLOW_PCT = 5, LOSS_EVENT_PCT = 10;
export function createQualityGate() {
  let level = 'unknown', kind, count = 0, since = 0, source, events = [];
  const burst = now => (events = events.filter(at => now - at <= BURST_WINDOW_MS)).length >= BURST_COUNT;
  return {
    reset() { kind = undefined; count = 0; source = undefined; events = []; },
    sample(value, now) {
      if (value.source !== source) { kind = undefined; count = 0; source = value.source; events = []; }
      const loss = Number.isFinite(value.lossPct) ? value.lossPct : 0;
      if (value.lost || loss >= LOSS_EVENT_PCT) events.push(now);
      const next = value.lost ? 'lost' : Number.isFinite(value.rttMs) && value.rttMs >= 0
        ? value.rttMs > 400 || loss > LOSS_SLOW_PCT ? 'slow' : value.rttMs < 350 ? 'good' : 'middle' : 'unknown';
      if (next !== kind) { kind = next; count = 0; since = now; }
      count++;
      if (value.source === 'offline' && value.lost) level = 'lost';
      else if (count >= 3 && now - since >= 4000) {
        if (next === 'lost') { level = 'lost'; events = []; } // Already announced as interrupted.
        else if (next === 'slow') level = 'slow';
        else if (next === 'good' && !burst(now)) level = 'good';
        // An intermediate/unavailable measurement never declares recovery.
      }
      if (level !== 'lost' && burst(now)) level = 'slow';
      return { level, source: value.source };
    },
  };
}

// Only the selected ICE pair, never an arbitrary successful candidate.
// Discard a frozen response counter after 10 s instead of reusing an old RTT forever.
export function createMediaReader() {
  const seen = new WeakMap();
  return async function read(pc) {
    if (!pc || pc.connectionState === 'closed' || pc.signalingState === 'closed') return null;
    if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' ||
        pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected')
      return { source: 'media', lost: true };
    try {
      const stats = await pc.getStats();
      let pair;
      stats.forEach(report => {
        if (report.type === 'transport' && report.selectedCandidatePairId) pair = stats.get(report.selectedCandidatePairId);
      });
      if (!pair) stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.nominated) pair = report;
      });
      if (!pair || !Number.isFinite(pair.currentRoundTripTime) || pair.currentRoundTripTime < 0) return null;
      const marker = pair.responsesReceived ?? pair.totalRoundTripTime ?? pair.timestamp;
      const old = seen.get(pc), now = performance.now();
      // Received audio: packets lost since the previous reading, never the whole call average.
      let lost = 0, received = 0, audio = false;
      stats.forEach(report => {
        if (report.type === 'inbound-rtp' && (report.kind ?? report.mediaType) === 'audio' && !report.isRemote) {
          audio = true; lost += Math.max(0, report.packetsLost || 0); received += report.packetsReceived || 0;
        }
      });
      const previous = old && old.id === pair.id ? { lost: old.lost, received: old.received } : null;
      if (!old || old.id !== pair.id || old.marker !== marker) seen.set(pc, { id: pair.id, marker, at: now, lost, received });
      else if (now - old.at > 10000) return null;
      else { old.lost = lost; old.received = received; }
      const result = { source: 'media', rttMs: pair.currentRoundTripTime * 1000 };
      const lostDelta = previous ? lost - previous.lost : 0, total = previous ? lostDelta + received - previous.received : 0;
      if (audio && total >= 20 && lostDelta >= 0) result.lossPct = 100 * lostDelta / total;
      return result;
    } catch { return null; }
  };
}

export function startConnectionMonitor({ url, readMedia, onChange, target = window, doc = document }) {
  const gate = createQualityGate();
  let stopped = false, timer, active, generation = 0, last, mediaKey;
  const publish = value => {
    const state = gate.sample(value, performance.now());
    // Do not announce a changing millisecond counter to screen readers.
    if (!last || last.level !== state.level || last.source !== state.source) { last = state; onChange(state); }
  };
  const cancel = () => { generation++; clearTimeout(timer); active?.abort(); active = undefined; gate.reset(); };
  const poll = async () => {
    if (stopped || doc.hidden) return;
    const current = ++generation;
    const control = new AbortController(); active = control;
    const timeout = setTimeout(() => control.abort(), 4000);
    try {
      if (target.navigator.onLine === false) { publish({ source: 'offline', lost: true }); return; }
      // getStats is normally immediate, but a broken media provider must not stop HTTP checks.
      let mediaTimer;
      let media;
      try {
        media = await Promise.race([
          Promise.resolve().then(() => readMedia?.()).catch(() => null),
          new Promise(resolve => { mediaTimer = setTimeout(() => resolve(null), 700); }),
        ]);
      } finally { clearTimeout(mediaTimer); }
      if (stopped || current !== generation) return;
      if (media && (media.lost || Number.isFinite(media.rttMs))) {
        if (media.key !== mediaKey) { gate.reset(); mediaKey = media.key; }
        publish(media); return;
      }
      mediaKey = undefined;
      const started = performance.now();
      const response = await target.fetch(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(), {
        method: 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: control.signal,
      });
      if (response.status !== 204) throw new Error('Probe unavailable');
      if (!stopped && current === generation) publish({ source: 'http', rttMs: performance.now() - started });
    } catch {
      if (!stopped && current === generation) publish({ source: 'http', lost: true });
    } finally {
      clearTimeout(timeout);
      if (!stopped && current === generation) { active = undefined; timer = setTimeout(poll, 2000); }
    }
  };
  const resume = () => { cancel(); if (!doc.hidden) void poll(); };
  const offline = () => { cancel(); publish({ source: 'offline', lost: true }); };
  target.addEventListener('offline', offline);
  target.addEventListener('online', resume);
  doc.addEventListener('visibilitychange', resume);
  void poll();
  return () => {
    stopped = true; cancel();
    target.removeEventListener('offline', offline);
    target.removeEventListener('online', resume);
    doc.removeEventListener('visibilitychange', resume);
  };
}
