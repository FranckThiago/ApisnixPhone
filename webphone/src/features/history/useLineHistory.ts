import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_HISTORY, watchLineHistory } from '../../recordings/lineHistory';
import { matchingServerOutcome } from '../../telephony/serverCallOutcome';
import type { CallSnapshot, PhoneController } from '../../telephony/types';
import type { RecordingsSource } from '../../recordings/types';

export function useLineHistory(source: RecordingsSource, enabled: boolean, connection: string) {
  const [state, setState] = useState(EMPTY_HISTORY);
  const feed = useRef<ReturnType<typeof watchLineHistory> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const active = watchLineHistory(source, setState, document, window);
    feed.current = active;
    return () => { active.stop(); feed.current = null; };
  }, [source, enabled, connection]);
  const refresh = useCallback(() => { void feed.current?.refresh(); }, []);
  return { ...(enabled ? state : EMPTY_HISTORY), refresh };
}

/** Reuse the existing first page, with three bounded refreshes only for an unexplained 480. */
export function useServerCallOutcome(phone: PhoneController, call: CallSnapshot | null, state: ReturnType<typeof useLineHistory>, enabled: boolean) {
  const { refresh, history, error } = state;
  const pending = enabled && call?.phase === 'ended' && call.awaitingServerOutcome;
  const id = pending ? call.id : undefined;
  useEffect(() => {
    if (!id) return;
    const timers = [1000, 4000, 10000].map(delay => setTimeout(refresh, delay));
    return () => timers.forEach(clearTimeout);
  }, [id, refresh]);
  useEffect(() => {
    if (!pending || !call || !history || history.stale || error) return;
    const outcome = matchingServerOutcome(call, history.calls);
    if (outcome) phone.confirmFailure?.(call.id, outcome);
  }, [phone, call, pending, history, error]);
}
