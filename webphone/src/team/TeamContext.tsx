import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { useApp, usePhone } from '../app/AppContext';
import { HttpTeamClient, TeamError, type CallbackPage, type Objective, type Review, type Workspace } from './client';
import { TeamContext } from './context';
import { DemoTeamClient } from './demo';
import { createSerialRefresh } from './serialRefresh';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { store, recordingsAccess } = useApp();
  const { demo } = usePhone();
  const client = useMemo(() => demo ? new DemoTeamClient()
    : new HttpTeamClient(String(import.meta.env.VITE_RECORDINGS_URL ?? '/api').replace(/\/$/, '')), [demo]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const active = useRef(false);
  const epoch = useRef(0);

  const fetchOnce = useCallback(async () => {
    const current = epoch.current;
    const stale = () => !active.current || current !== epoch.current;
    try {
      const next = await client.request<Workspace>();
      const shared = next.policy.shared_enabled;
      const [quality, goals, callbacks] = await Promise.all([
        client.request<{ reviews: Review[] }>('/quality'),
        shared ? client.request<{ objectives: Objective[] }>('/objectives') : Promise.resolve({ objectives: [] }),
        shared ? client.request<CallbackPage>('/callbacks') : Promise.resolve(null),
      ]);
      if (stale()) return;
      setWorkspace(next);
      setReviews(quality.reviews);
      setObjectives(goals.objectives);
      setError('');
      setVersion(value => value + 1);
      if (callbacks?.promoted.length) {
        const promoted = new Set(callbacks.promoted);
        for (const callback of store.getSnapshot().callbacks) if (promoted.has(callback.id)) store.removeCallback(callback.id);
      }
    } catch (raised) {
      if (stale()) return;
      setError(raised instanceof Error ? raised.message : '');
      if (raised instanceof TeamError && (raised.status === 401 || raised.status === 403)) {
        setWorkspace(null);
        setReviews([]);
        setObjectives([]);
      }
    }
  }, [client, store]);

  const [serial] = useState(createSerialRefresh);
  const refresh = useCallback(() => serial(fetchOnce, () => active.current), [serial, fetchOnce]);

  useEffect(() => {
    active.current = demo || recordingsAccess.state === 'open';
    const current = ++epoch.current;
    const update = () => { if (!document.hidden) void refresh(); };
    const initial = setTimeout(() => { void refresh(); }, 0);
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      active.current = false;
      epoch.current = current + 1;
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [demo, recordingsAccess.state, refresh]);

  const request = useCallback(async <T,>(path: string, body?: unknown): Promise<T> => {
    const current = epoch.current;
    const valid = () => { if (!active.current || current !== epoch.current) throw new TeamError(403, t('team.accessDenied')); };
    valid();
    const result = await client.request<T>(path, body);
    valid();
    if (body !== undefined && path !== '/transfer') await refresh();
    valid();
    return result;
  }, [client, refresh]);

  const accessible = demo || recordingsAccess.state === 'open';
  const value = useMemo(() => ({
    workspace: accessible ? workspace : null, reviews: accessible ? reviews : [], objectives: accessible ? objectives : [],
    error, version, refresh, request,
  }), [accessible, workspace, reviews, objectives, error, version, refresh, request]);
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
