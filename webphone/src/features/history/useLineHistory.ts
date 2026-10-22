import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_HISTORY, watchLineHistory } from '../../recordings/lineHistory';
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
