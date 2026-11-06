export interface ConnectionSample { source: 'http' | 'media' | 'offline'; rttMs?: number; lost?: boolean; key?: object }
export interface ConnectionQuality { level: 'unknown' | 'good' | 'slow' | 'lost'; source: ConnectionSample['source'] }
export function createQualityGate(): { reset(): void; sample(value: ConnectionSample, now: number): ConnectionQuality };
export function createMediaReader(): (pc?: RTCPeerConnection) => Promise<ConnectionSample | null>;
export function startConnectionMonitor(options: {
  url: string; readMedia?: () => Promise<ConnectionSample | null>;
  onChange: (state: ConnectionQuality) => void; target?: Window; doc?: Document;
}): () => void;
