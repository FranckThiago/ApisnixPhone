/** Per-call TURN settings and technical counters. No SDP, addresses, numbers or audio are retained. */
export interface MediaAccess {
  enabled: true;
  account: string;
  expiresAt: number;
  iceTransportPolicy: RTCIceTransportPolicy;
  /** Empty when the line keeps its direct path only. */
  iceServers: RTCIceServer[];
  /** Apply the 183 answer so ICE and DTLS run while the far end still rings. */
  earlyMedia: boolean;
  csrf: string;
}
export type MediaMetrics = Record<string, number | string>;

export class MediaAccessClient {
  private cached?: MediaAccess;
  private checkedAt = -Infinity;
  private pending?: Promise<MediaAccess | undefined>;
  // Native fetch must not receive this client as its `this` (Illegal invocation in browsers).
  constructor(private account: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  load(): Promise<MediaAccess | undefined> {
    if (this.pending) return this.pending;
    if (Date.now() - this.checkedAt < 60_000 && (!this.cached || this.cached.expiresAt > Date.now() + 60_000)) return Promise.resolve(this.cached);
    this.pending = this.request().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  private async request(): Promise<MediaAccess | undefined> {
    this.checkedAt = Date.now();
    try {
      const response = await this.fetcher('/api/webphone-ice', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(1800) });
      if (!response.ok) throw new Error('ICE service unavailable');
      const value = await response.json() as Partial<MediaAccess>;
      if (value.enabled !== true) { this.cached = undefined; return; }
      if (value.account !== this.account || !Number.isFinite(value.expiresAt) || value.expiresAt! <= Date.now() + 60_000 ||
          !['all', 'relay'].includes(value.iceTransportPolicy ?? '') || typeof value.csrf !== 'string' ||
          !Array.isArray(value.iceServers) || value.iceServers.length > 4 || (value.iceTransportPolicy === 'relay' && !value.iceServers.length) ||
          !value.iceServers.every(server => typeof server.username === 'string' && typeof server.credential === 'string' &&
            Array.isArray(server.urls) && server.urls.length > 0 && server.urls.length <= 4 &&
            server.urls.every(url => typeof url === 'string' && /^turns?:[^\s]+$/i.test(url)))) throw new Error('Invalid ICE settings');
      this.cached = { ...value, earlyMedia: value.earlyMedia === true } as MediaAccess;
      return this.cached;
    } catch {
      // A temporary HTTP failure must not reuse expired credentials or another account's settings.
      return this.cached && this.cached.expiresAt > Date.now() + 60_000 ? this.cached : undefined;
    }
  }

  async report(access: MediaAccess, metrics: MediaMetrics) {
    try {
      await this.fetcher('/api/webphone-media-report', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': access.csrf },
        body: JSON.stringify({ account: this.account, metrics }), keepalive: true, signal: AbortSignal.timeout(3000) });
    } catch { /* Diagnostics never block a call or its termination. */ }
  }
}

export function observeMedia(pc: RTCPeerConnection, policy: RTCIceTransportPolicy, send: (metrics: MediaMetrics) => void) {
  const started = performance.now();
  const metrics: MediaMetrics = { policy, disconnects: 0 };
  let stopped = false, sampling = false;
  let lastIce: RTCIceConnectionState | undefined;
  const elapsed = () => Math.round(performance.now() - started);
  const state = () => {
    if (stopped) return;
    if (['connected', 'completed'].includes(pc.iceConnectionState) && metrics.iceConnectedMs === undefined) metrics.iceConnectedMs = elapsed();
    if (pc.connectionState === 'connected' && metrics.dtlsConnectedMs === undefined) metrics.dtlsConnectedMs = elapsed();
    if (pc.iceConnectionState === 'disconnected' && lastIce !== 'disconnected') metrics.disconnects = Number(metrics.disconnects) + 1;
    lastIce = pc.iceConnectionState;
  };
  const sample = async () => {
    if (stopped || sampling || pc.connectionState === 'closed') return;
    sampling = true;
    try {
      const stats = await pc.getStats();
      metrics.policy = pc.getConfiguration().iceTransportPolicy ?? policy;
      if (stopped) return;
      stats.forEach(report => {
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          metrics.sentPackets = report.packetsSent ?? 0;
          if (report.packetsSent > 0 && metrics.firstSentMs === undefined) metrics.firstSentMs = elapsed();
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          metrics.receivedPackets = report.packetsReceived ?? 0;
          metrics.lostPackets = report.packetsLost ?? 0;
          metrics.jitterMs = Math.round((report.jitter ?? 0) * 1000);
          metrics.concealedSamples = report.concealedSamples ?? 0;
          metrics.totalSamples = report.totalSamplesReceived ?? 0;
          if (report.packetsReceived > 0 && metrics.firstReceivedMs === undefined) metrics.firstReceivedMs = elapsed();
        }
        if (report.type === 'media-source' && report.kind === 'audio' && typeof report.totalAudioEnergy === 'number') metrics.audioEnergy = report.totalAudioEnergy;
        if (report.type === 'transport' && report.selectedCandidatePairId) {
          const pair = stats.get(report.selectedCandidatePairId);
          if (!pair) return;
          const local = stats.get(pair.localCandidateId), remote = stats.get(pair.remoteCandidateId);
          const types = ['host', 'srflx', 'prflx', 'relay'];
          metrics.localType = types.includes(local?.candidateType) ? local.candidateType : 'unknown';
          metrics.remoteType = types.includes(remote?.candidateType) ? remote.candidateType : 'unknown';
          metrics.protocol = ['udp', 'tcp'].includes(local?.relayProtocol ?? local?.protocol) ? local.relayProtocol ?? local.protocol : 'unknown';
          if (typeof pair.currentRoundTripTime === 'number') metrics.rttMs = Math.round(pair.currentRoundTripTime * 1000);
        }
      });
    } catch { /* Unsupported/closed stats are not an audio error. */ }
    finally { sampling = false; }
  };
  pc.addEventListener('iceconnectionstatechange', state);
  pc.addEventListener('connectionstatechange', state);
  const timer = setInterval(() => { state(); void sample(); }, 500);
  state(); void sample();
  return {
    answered() { metrics.answeredMs ??= elapsed(); },
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      pc.removeEventListener('iceconnectionstatechange', state);
      pc.removeEventListener('connectionstatechange', state);
      metrics.durationMs = elapsed();
      send({ ...metrics });
    },
  };
}

/** Validate a relay before constructing the call connection: some browsers reject setConfiguration. */
export async function relayAvailable(servers: RTCIceServer[], create = (config: RTCConfiguration) => new RTCPeerConnection(config)): Promise<boolean> {
  let pc: RTCPeerConnection | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    pc = create({ iceServers: servers, iceTransportPolicy: 'relay' });
    const connection = pc;
    const result = new Promise<boolean>(resolve => {
      timer = setTimeout(() => resolve(false), 1800);
      connection.addEventListener('icecandidate', event => {
        if (event.candidate?.type === 'relay') resolve(true);
        else if (!event.candidate) resolve(false);
      });
      connection.createDataChannel('connectivity-check');
      // A rejected or slow offer is bounded by the same deadline.
      void connection.createOffer().then(offer => {
        if (connection.signalingState !== 'closed') return connection.setLocalDescription(offer);
      }).catch(() => resolve(false));
    });
    return await result;
  } catch { return false; }
  finally { clearTimeout(timer); pc?.close(); }
}
