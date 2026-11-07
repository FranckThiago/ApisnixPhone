import { sessionFetch } from '../http/embeddedSession';

export interface CallScript { title: string; content: string; revision: number }

/** The server derives the only eligible script from the line's current assignment. */
export async function loadCallScript(base: string, fetchImpl: typeof fetch = sessionFetch): Promise<CallScript | null> {
  const response = await fetchImpl(base.replace(/\/$/, '') + '/call-script', {
    credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error('Call script unavailable');
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('script' in data)) throw new Error('Invalid call script');
  if (data.script === null) return null;
  const script = data.script as Partial<CallScript> | undefined;
  if (!script || typeof script.title !== 'string' || !script.title.trim() || script.title.length > 120
    || typeof script.content !== 'string' || !script.content.trim() || script.content.length > 12000
    || !Number.isInteger(script.revision) || script.revision! < 1) throw new Error('Invalid call script');
  return { title: script.title, content: script.content, revision: script.revision! };
}

/** In-memory only. Stopped requests can never publish a previous account's script. */
export function watchCallScript(load: () => Promise<CallScript | null>, publish: (script: CallScript | null) => void,
  page: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>,
  network: Pick<Window, 'addEventListener' | 'removeEventListener'>) {
  let stopped = false, pending = false;
  const refresh = async () => {
    if (stopped || pending || page.hidden) return;
    pending = true;
    try { const script = await load(); if (!stopped) publish(script); }
    catch { /* Keep the current script readable during a temporary network outage. */ }
    finally { pending = false; }
  };
  const visible = () => { void refresh(); };
  const timer = setInterval(visible, 60000);
  page.addEventListener('visibilitychange', visible);
  network.addEventListener('focus', visible);
  network.addEventListener('online', visible);
  void refresh();
  return () => {
    stopped = true; clearInterval(timer);
    page.removeEventListener('visibilitychange', visible);
    network.removeEventListener('focus', visible);
    network.removeEventListener('online', visible);
  };
}
