export interface ConnectionSample { source: 'http' | 'media' | 'offline'; rttMs?: number; lossPct?: number; lost?: boolean; key?: object }
export interface ConnectionQuality { level: 'unknown' | 'good' | 'slow' | 'lost'; source: ConnectionSample['source'] }
export const BURST_WINDOW_MS: number, BURST_COUNT: number, LOSS_SLOW_PCT: number, LOSS_EVENT_PCT: number;
export function createQualityGate(): { reset(): void; sample(value: ConnectionSample, now: number): ConnectionQuality };
export function createMediaReader(): (pc?: RTCPeerConnection) => Promise<ConnectionSample | null>;
export function startConnectionMonitor(options: {
  url: string; readMedia?: () => Promise<ConnectionSample | null>;
  onChange: (state: ConnectionQuality) => void; target?: Window; doc?: Document;
}): () => void;
