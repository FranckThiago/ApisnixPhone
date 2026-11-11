import { useNow } from '../app/clock';
import { useEffect, useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n, dateFormat } from '../i18n';
import { useTeamAction } from './useTeamAction';
import { useTeam } from './context';
import type { CallbackPage, GroupCallback } from './client';
import type { Callback } from '../domain/types';

const date = (ms: number) => dateFormat({ dateStyle: 'short', timeStyle: 'short' }).format(ms);
const callbackPath = (id: string) => '/callbacks/' + encodeURIComponent(id);

export function PromoteCallback({ callback }: { callback: Callback }) {
  const { workspace, request } = useTeam();
  const { store } = useApp();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  if (!workspace?.policy.shared_enabled || callback.doneAt) return null;
  const promote = () => {
    if (!window.confirm(t('team.shareConfirm', { number: callback.number }))) return;
    void run(async () => {
      await request('/callbacks/promote', { callback, assignment_version: workspace.assignment_version });
      store.removeCallback(callback.id);
    });
  };
  return <button type="button" className="ghost" disabled={busy} onClick={promote}>{t('team.share')}</button>;
}

export function GroupCallbacks() {
  const now = useNow();
  const { workspace, request, version, refresh } = useTeam();
  const { placeCall, notify, phone: controller } = useApp();
  const phone = usePhone();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  const [result, setResult] = useState<CallbackPage | null>(null);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const shared = Boolean(workspace?.policy.shared_enabled);

  useEffect(() => {
    if (!shared) return;
    let alive = true;
    const params = new URLSearchParams({ page: String(page), state: done ? 'done' : 'pending', q: query });
    request<CallbackPage>('/callbacks?' + params)
      .then(next => { if (alive) { setResult(next); setError(''); } })
      .catch(raised => { if (alive) setError(raised instanceof Error ? raised.message : t('team.failed')); });
    return () => { alive = false; };
  }, [shared, request, version, page, done, query, t]);

  if (!workspace || !shared) return null;
  const free = (snapshot: typeof phone) => snapshot.connection === 'ready' && (!snapshot.call || snapshot.call.phase === 'ended');
  const available = free(phone);
  const act = (callback: GroupCallback, action: string, extra: Record<string, unknown> = {}) =>
    void run(() => request(callbackPath(callback.id), { action, revision: callback.revision, ...extra }));
  const claimAndCall = (callback: GroupCallback) => void run(async () => {
    await request(callbackPath(callback.id), { action: 'claim', revision: callback.revision });
    // The line may have changed while the server reserved the callback.
    if (free(controller.getSnapshot())) placeCall(callback.number);
    else notify(t('team.callUnavailable'));
  });
  const currentPage = result?.page ?? 1;

  return (
    <section className="panel team-section">
      <header><h2>{t('team.groupCallbacks')}</h2><button className="ghost" type="button" onClick={() => { void refresh(); }}>{t('team.refresh')}</button></header>
      <p>{t('team.claimHelp')}</p>
      <form className="team-controls" onSubmit={event => { event.preventDefault(); setQuery(search); setPage(1); }}>
        <label>{t('team.search')}<input type="search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <button className="ghost" type="submit">{t('team.search')}</button>
        <label><input type="checkbox" checked={done} onChange={event => { setDone(event.target.checked); setPage(1); }} /> {t('team.completed')}</label>
      </form>
      {error && <p role="alert">{error}</p>}
      {result?.callbacks.map(callback => {
        const mine = callback.claimed_by === workspace.endpoint_id;
        return (
          <article className={'team-card' + (!callback.doneAt && callback.dueAt < now ? ' overdue' : '')} key={callback.id}>
            <h3>{callback.name || callback.number}</h3>
            <p>{callback.number} · {date(callback.dueAt)}</p>
            <p className="team-copy">{callback.note}</p>
            <small>{callback.claimed_by ? t('team.claimedBy', { name: callback.claimed_name || '' }) : t('team.available')}</small>
            <div className="team-controls">
              {!callback.doneAt && !callback.claimed_by && (
                <button className="primary" disabled={busy || !available} onClick={() => claimAndCall(callback)}>{t('team.claimCall')}</button>
              )}
              {mine && !callback.doneAt && <>
                <button className="primary" disabled={busy || !available} onClick={() => placeCall(callback.number)}>{t('action.call')}</button>
                <button className="ghost" disabled={busy} onClick={() => act(callback, 'done')}>{t('callbacks.markDone')}</button>
                <button className="ghost" disabled={busy} onClick={() => act(callback, 'postpone', { dueAt: Math.max(Date.now(), callback.dueAt) + 3600000 })}>{t('team.later')}</button>
                <button className="ghost" disabled={busy} onClick={() => act(callback, 'release')}>{t('team.release')}</button>
              </>}
              {mine && callback.doneAt && <button className="ghost" disabled={busy} onClick={() => act(callback, 'reopen')}>{t('callbacks.reopen')}</button>}
            </div>
          </article>
        );
      })}
      {result?.count === 0 && <p>{t('team.noCallbacks')}</p>}
      <div className="team-controls">
        <button className="ghost" aria-label={t('pagination.previous')} disabled={!result || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>←</button>
        <span>{result?.count ?? '…'} · {currentPage} / {result?.pages || 1}</span>
        <button className="ghost" aria-label={t('pagination.next')} disabled={!result || currentPage >= result.pages} onClick={() => setPage(currentPage + 1)}>→</button>
      </div>
    </section>
  );
}
