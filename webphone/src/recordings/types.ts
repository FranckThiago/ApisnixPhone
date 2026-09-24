/** One audio file of a call, as the recordings service knows it. */
export interface RecordingFile {
  id: string;
  /** `available` can be played or downloaded; `processing` will be, a few minutes after the call. */
  state: 'available' | 'processing';
  /** Recorded seconds when the service knows them. */
  durationSeconds: number | null;
  createdAt: number;
}

/** A call of the person's own phone, as the service saw it, with its audio files. */
export interface RecordedCall {
  id: string;
  number: string;
  direction: 'outbound' | 'inbound' | 'unknown';
  startedAt: number;
  files: RecordingFile[];
}

export interface RecordingsIdentity {
  name: string;
  /** Extension of the phone whose recordings are served. */
  extension: string;
  /** Display name chosen in supervision, if any. */
  alias?: string;
}

export interface RecordingsListing {
  calls: RecordedCall[];
  /** The service is still importing recent calls: the list may grow on the next refresh. */
  catchingUp: boolean;
  /** The service no longer receives data: what is shown may be stale. */
  stale: boolean;
}

export type Period = 'today' | 'yesterday' | 'week';

/**
 * Access to the recordings of one's own phone. The SIP line proves nothing here:
 * the service authenticates the person itself and serves only their phone.
 */
export interface RecordingsSource {
  /** True when this browser holds a valid session on the service. */
  session(): Promise<RecordingsIdentity | null>;
  /** Opens the recordings of the line itself: the PBX confirms the line's credentials, nothing else is typed. */
  openWithLine(username: string, password: string): Promise<RecordingsIdentity>;
  signOut(): Promise<void>;
  list(period: Period): Promise<RecordingsListing>;
  /** Same file, streamed for listening or sent as an attachment for download. */
  audioUrl(fileId: string, download: boolean): string;
}

export class RecordingsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
