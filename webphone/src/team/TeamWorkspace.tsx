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

export function TeamWorkspace() {
  const { workspace, reviews, objectives, error, request, refresh } = useTeam();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  const [help, setHelp] = useState('');
  const [search, setSearch] = useState('');
  const notices = workspace?.resources.filter(resource => resource.kind === 'notice') ?? [];
  const needle = search.toLocaleLowerCase();
  const objections = workspace?.resources.filter(resource => resource.kind === 'objection'
    && (resource.title + ' ' + resource.content).toLocaleLowerCase().includes(needle)) ?? [];
  const openHelp = workspace?.help.filter(item => item.status !== 'closed') ?? [];

  return (
    <div className="page team-page">
      <header className="page-head">
        <div><p className="eyebrow">APISNIX</p><h1>{t('team.title')}</h1><p className="lead">{t('team.lead')}</p></div>
        <button className="ghost" onClick={() => { void refresh(); }}>{t('team.refresh')}</button>
      </header>
      {error && <p role="alert">{error}</p>}
      {workspace?.policy.shared_enabled && <>
        <section className="panel team-section">
          <h2>{t('team.notices')}</h2>
          {notices.map(resource => (
            <article className="team-card" key={resource.id}>
              <h3>{resource.title}</h3>
              <p className="team-copy">{resource.content}</p>
              <button className="ghost" disabled={busy || resource.read}
                onClick={() => { void run(() => request('/read', { id: resource.id, revision: resource.revision })); }}>{t(resource.read ? 'team.read' : 'team.markRead')}</button>
            </article>
          ))}
          {!notices.length && <p>{t('team.empty')}</p>}
        </section>
        <GroupCallbacks />
        <section className="panel team-section">
          <h2>{t('team.help')}</h2>
          {openHelp.map(item => <article className="team-card" key={item.id}><p>{item.message}</p><b>{item.reply || t('team.helpPending')}</b></article>)}
          {!openHelp.length && (
            <form onSubmit={event => { event.preventDefault(); void run(async () => { await request('/help', { message: help }); setHelp(''); }); }}>
              <label>{t('team.helpPrompt')}<textarea value={help} onChange={event => setHelp(event.target.value)} maxLength={1000} required /></label>
              <button className="primary" disabled={busy || !help.trim()} type="submit">{t('team.send')}</button>
            </form>
          )}
        </section>
        <section className="panel team-section">
          <h2>{t('team.objections')}</h2>
          <label>{t('team.search')}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
          {objections.map(resource => <details className="team-card" key={resource.id}><summary>{resource.title}</summary><p className="team-copy">{resource.content}</p></details>)}
        </section>
        <section className="panel team-section">
          <h2>{t('team.goals')}</h2>
          {objectives.map(goal => (
            <article className="team-card" key={goal.id}>
              <h3>{goal.qualification}</h3>
              <strong>{goal.achieved} / {goal.target}</strong>
              <progress value={goal.achieved} max={goal.target} />
              <p>{date(goal.starts_at * 1000)} → {date(goal.ends_at * 1000)}</p>
            </article>
          ))}
          {!objectives.length && <p>{t('team.empty')}</p>}
        </section>
      </>}
      <section className="panel team-section">
        <h2>{t('team.coaching')}</h2>
        {reviews.map(review => {
          const read = review.ack_revision === review.revision;
          return (
            <article className="team-card" key={review.id}>
              <h3>{review.number} · {date(review.started_at * 1000)}</h3>
              <strong>{review.score} / 100</strong>
              {review.criteria.map(criterion => <p key={criterion.label}>{criterion.label} : {criterion.score} / 5 {criterion.comment && '— ' + criterion.comment}</p>)}
              <p className="team-copy">{review.comment}</p>
              <p className="team-copy"><b>{t('team.nextAction')}</b> {review.action_plan}</p>
              {review.audio_second !== null && <p>{t('team.audioMark', { second: review.audio_second })}</p>}
              {review.follow_up && <p>{t('team.followUp')} {date(review.follow_up * 1000)}</p>}
              <button className="ghost" disabled={busy || read}
                onClick={() => { void run(() => request('/quality/' + encodeURIComponent(review.id) + '/read', { revision: review.revision })); }}>{t(read ? 'team.read' : 'team.markRead')}</button>
            </article>
          );
        })}
        {!reviews.length && <p>{t('team.empty')}</p>}
      </section>
    </div>
  );
}
