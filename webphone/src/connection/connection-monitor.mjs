// Kept identical in ApisnixPhone webphone/src/connection/connection-monitor.mjs.
// Passive measurements only: never register, reconnect, alter or end a call.
export function createQualityGate() {
  let level = 'unknown', kind, count = 0, since = 0, source;
  return {
    reset() { kind = undefined; count = 0; source = undefined; },
    sample(value, now) {
      if (value.source !== source) { kind = undefined; count = 0; source = value.source; }
      const next = value.lost ? 'lost' : Number.isFinite(value.rttMs) && value.rttMs >= 0
        ? value.rttMs > 400 ? 'slow' : value.rttMs < 300 ? 'good' : 'middle' : 'unknown';
      if (next !== kind) { kind = next; count = 0; since = now; }
      count++;
      if (value.source === 'offline' && value.lost) level = 'lost';
      else if (count >= 3 && now - since >= 4000) {
        if (next === 'good') level = 'good';
        else if (next === 'slow') level = 'slow';
        else if (next === 'lost') level = 'lost';
        // An intermediate/unavailable measurement never declares recovery.
      }
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
      if (!old || old.id !== pair.id || old.marker !== marker) seen.set(pc, { id: pair.id, marker, at: now });
      else if (now - old.at > 10000) return null;
      return { source: 'media', rttMs: pair.currentRoundTripTime * 1000 };
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
