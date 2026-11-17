import { AlarmClock, Check, ChevronLeft, ChevronRight, Clock3, LogOut, Phone, RefreshCw, Search, Undo2, Users } from 'lucide-react';
import { useNow } from '../app/clock';
import { Avatar } from '../components/Avatar';
import { formatDue } from '../domain/callbacks';
import { useEffect, useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeamAction } from './useTeamAction';
import { useTeam } from './context';
import type { CallbackPage, GroupCallback } from './client';
import type { Callback } from '../domain/types';

const callbackPath = (id: string) => '/callbacks/' + encodeURIComponent(id);

export function PromoteCallback({ callback }: { callback: Callback }) {
  const { workspace, request } = useTeam();
  const { store } = useApp();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  if (!workspace?.policy.shared_enabled || workspace.policy.features?.callbacks === false || callback.doneAt) return null;
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
  // Group callbacks also follow the team's switch in Gestion.
  const shared = Boolean(workspace?.policy.shared_enabled) && workspace?.policy.features?.callbacks !== false;

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
  const pages = result?.pages || 1;
  // Typing nothing again shows the whole list without pressing Enter.
  const typed = (value: string) => { setSearch(value); if (!value.trim() && query) { setQuery(''); setPage(1); } };
  const showState = (next: boolean) => { if (next !== done) { setDone(next); setPage(1); } };

  return (
    <section className="panel group-callbacks" aria-labelledby="group-callbacks-title">
      <header className="gc-head">
        <span className="gc-mark" aria-hidden="true"><Users size={19} /></span>
        <div><h2 id="group-callbacks-title">{t('team.groupCallbacks')}{result && <span className="gc-count">{result.count}</span>}</h2>
          <p>{t('team.claimHelp')}</p></div>
        <button type="button" className="icon-button" aria-label={t('team.refresh')} title={t('team.refresh')} onClick={() => { void refresh(); }}><RefreshCw size={17} /></button>
      </header>
      <div className="gc-toolbar">
        <form className="gc-search" role="search" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); }}>
          <Search size={16} aria-hidden="true" />
          <input type="search" maxLength={100} value={search} aria-label={t('team.search')} placeholder={t('team.searchPlaceholder')} onChange={event => typed(event.target.value)} />
        </form>
        <div className="tabs" role="group" aria-label={t('team.groupCallbacks')}>
          <button type="button" className={done ? '' : 'active'} aria-pressed={!done} onClick={() => showState(false)}>{t('team.toDo')}</button>
          <button type="button" className={done ? 'active' : ''} aria-pressed={done} onClick={() => showState(true)}>{t('team.completed')}</button>
        </div>
      </div>
      {error && <p className="gc-error" role="alert">{error}</p>}
      {result && result.callbacks.length > 0 && <ul className="gc-list">{result.callbacks.map(callback => {
        const mine = callback.claimed_by === workspace.endpoint_id;
        const overdue = !callback.doneAt && callback.dueAt < now;
        const status = callback.claimed_by ? (mine ? t('team.claimedByYou') : t('team.claimedBy', { name: callback.claimed_name || '' })) : t('team.available');
        return (
          <li className={'gc-row' + (overdue ? ' overdue' : '') + (callback.doneAt ? ' done' : '')} key={callback.id}>
            <Avatar name={callback.name || undefined} size={40} />
            <span className="who"><b>{callback.name || callback.number}</b><small>{callback.name ? callback.number : status}</small></span>
            <span className="due"><Clock3 size={14} aria-hidden="true" />{formatDue(callback.doneAt ?? callback.dueAt, now)}{overdue && <i>{t('callbacks.late')}</i>}</span>
            <span className="gc-actions">
              {!callback.doneAt && !callback.claimed_by && (
                <button type="button" className="mini-call" disabled={busy || !available} title={t('team.claimCall')} onClick={() => claimAndCall(callback)}><Phone size={16} /> {t('team.claimShort')}</button>
              )}
              {mine && !callback.doneAt && <>
                <button type="button" className="mini-call" disabled={busy || !available} onClick={() => placeCall(callback.number)}><Phone size={16} /> {t('action.call')}</button>
                <button type="button" className="icon-button" disabled={busy} aria-label={t('team.later')} title={t('team.later')} onClick={() => act(callback, 'postpone', { dueAt: Math.max(Date.now(), callback.dueAt) + 3600000 })}><AlarmClock size={17} /></button>
                <button type="button" className="icon-button" disabled={busy} aria-label={t('callbacks.markDone')} title={t('callbacks.markDone')} onClick={() => act(callback, 'done')}><Check size={18} /></button>
                <button type="button" className="icon-button" disabled={busy} aria-label={t('team.release')} title={t('team.release')} onClick={() => act(callback, 'release')}><LogOut size={16} /></button>
              </>}
              {mine && callback.doneAt && <button type="button" className="icon-button" disabled={busy} aria-label={t('callbacks.reopen')} title={t('callbacks.reopen')} onClick={() => act(callback, 'reopen')}><Undo2 size={17} /></button>}
            </span>
            <div className="gc-meta">
              <span className={'gc-status' + (callback.claimed_by ? mine ? ' mine' : ' taken' : ' free')}>{status}</span>
              {callback.note && <p className="gc-note">{callback.note}</p>}
            </div>
          </li>
        );
      })}</ul>}
      {result?.count === 0 && <p className="gc-empty">{t('team.noCallbacks')}</p>}
      {pages > 1 && <nav className="gc-pager" aria-label={t('team.groupCallbacks')}>
        <button type="button" className="icon-button" aria-label={t('pagination.previous')} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17} /></button>
        <span>{currentPage} / {pages}</span>
        <button type="button" className="icon-button" aria-label={t('pagination.next')} disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17} /></button>
      </nav>}
    </section>
  );
}
