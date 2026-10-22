import { t } from '../i18n';
import type { LineCall, LineHistory, RecordingsSource } from './types';

export interface HistoryState { history: LineHistory | null; error: string; loading: boolean }
export const EMPTY_HISTORY: HistoryState = { history: null, error: '', loading: false };

/** One feed for both the journal and navigation; late responses cannot cross sessions. */
export function watchLineHistory(source: Pick<RecordingsSource, 'history'>, publish: (state: HistoryState) => void,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  network: Pick<Window, 'addEventListener' | 'removeEventListener'>) {
  let state = EMPTY_HISTORY, stopped = false, pending = false;
  const refresh = async () => {
    if (stopped || pending) return;
    pending = true;
    publish(state = { ...state, loading: true });
    try {
      const history = await source.history(30);
      if (!stopped) state = { history, error: '', loading: false };
    } catch (error) {
      if (!stopped) state = { ...state, error: error instanceof Error ? error.message : t('journal.historyUnavailable'), loading: false };
    } finally {
      pending = false;
      if (!stopped) publish(state);
    }
  };
  const visible = () => { if (!page.hidden) void refresh(); };
  const online = () => { void refresh(); };
  page.addEventListener('visibilitychange', visible);
  network.addEventListener('online', online);
  const timer = setInterval(visible, 60_000);
  void refresh();
  return { refresh, stop() {
    stopped = true;
    clearInterval(timer);
    page.removeEventListener('visibilitychange', visible);
    network.removeEventListener('online', online);
  } };
}

/** Use completion time: a call still ringing during consultation must remain unseen. */
export const missedStamp = (call: Pick<LineCall, 'startedAt' | 'endedAt'>) => call.endedAt ?? call.startedAt;
export function unseenMissedCalls(calls: ReadonlyArray<Pick<LineCall, 'startedAt' | 'endedAt'> & { outcome: string }>, seenAt: number) {
  return calls.filter(call => call.outcome === 'missed' && missedStamp(call) > seenAt);
}
