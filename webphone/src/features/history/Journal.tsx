import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock3, Info, Phone, PhoneMissed, PhoneOutgoing, Search, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { Avatar } from '../../components/Avatar';
import { CallbackScheduler } from '../callbacks/CallbackScheduler';
import { Flag } from '../../components/Flag';
import { dayKey, fold, formatDay, formatDuration, formatLongDuration, formatTime } from '../../domain/format';
import { countryLabel, countryName, describeNumber } from '../../domain/numbers';
import { CALL_TAGS, CALLBACK_TAG, outcomeLabel, tagLabel, talkSeconds, type CallRecord } from '../../domain/types';
import { useI18n, type MessageKey } from '../../i18n';
import { findContact } from '../../storage/DataStore';
import type { LineHistory } from '../../recordings/types';

type Filter = 'all' | 'outbound' | 'inbound' | 'missed';
const FILTERS: Array<[Filter, MessageKey]> = [['all', 'filter.all'], ['outbound', 'filter.outbound'], ['inbound', 'filter.inbound'], ['missed', 'filter.missed']];

function DirectionIcon({ call }: { call: CallRecord }) {
  const { t } = useI18n();
  if (call.outcome === 'missed') return <span className="direction missed" title={t('direction.missed')}><PhoneMissed size={16} /></span>;
  return call.direction === 'inbound'
    ? <span className="direction inbound" title={t('direction.inbound')}><ArrowDownLeft size={16} /></span>
    : <span className="direction outbound" title={t('direction.outbound')}><ArrowUpRight size={16} /></span>;
}

export function Journal() {
  const { placeCall, store, openContact, notify, recordings, recordingsAccess, reopenRecordings } = useApp();
  const { calls: localCalls, contacts } = useData();
  const { demo } = usePhone();
  const { t, language } = useI18n();
  const [scope, setScope] = useState<'line' | 'device'>(demo ? 'device' : 'line');
  const [history, setHistory] = useState<LineHistory | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (scope !== 'line' || recordingsAccess.state !== 'open') return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await recordings.history(30);
        if (!cancelled) { setHistory(result); setHistoryError(''); }
      } catch (error) {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : t('journal.historyUnavailable'));
      } finally { if (!cancelled) setLoading(false); }
    };
    void load();
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [scope, recordings, recordingsAccess.state, refresh, t]);

  const calls: CallRecord[] = useMemo(() => scope === 'device' ? localCalls : (history?.calls ?? []).map((call): CallRecord => ({
    id: call.id, direction: call.direction, dialTarget: call.number, startedAt: call.startedAt,
    answeredAt: call.answeredAt, endedAt: call.endedAt ?? call.startedAt,
    outcome: call.outcome, tags: [],
  })), [scope, localCalls, history]);

  const todayKey = dayKey(useNow());
  const today = useMemo(() => calls.filter(call => dayKey(call.startedAt) === todayKey), [calls, todayKey]);
  const stats = {
    count: today.length,
    talk: today.reduce((total, call) => total + talkSeconds(call), 0),
    missed: today.filter(call => call.outcome === 'missed').length,
    reached: today.filter(call => call.direction === 'outbound').length
      ? Math.round(100 * today.filter(call => call.direction === 'outbound' && call.outcome === 'answered').length / today.filter(call => call.direction === 'outbound').length) : null,
  };

  const rows = useMemo(() => {
    const text = fold(query.trim());
    const digits = query.replace(/[^\d+]/g, '');
    return calls.filter(call => {
      if (filter === 'missed' ? call.outcome !== 'missed' : filter !== 'all' && call.direction !== filter) return false;
      if (!text) return true;
      const name = findContact(contacts, call.dialTarget)?.name ?? call.remoteName ?? '';
      // Country names and tag labels are searched in the language on screen.
      const country = countryName(describeNumber(call.dialTarget).country, language) ?? '';
      return fold(name).includes(text) || fold(country).includes(text) || (digits.length > 1 && call.dialTarget.includes(digits))
        || call.tags.some(tag => fold(tag).includes(text) || fold(tagLabel(tag)).includes(text));
    });
  }, [calls, contacts, filter, query, language]);

  const groups = useMemo(() => {
    const result: Array<{ key: string; calls: CallRecord[] }> = [];
    for (const call of rows) {
      const key = dayKey(call.startedAt);
      const last = result[result.length - 1];
      if (last?.key === key) last.calls.push(call);
      else result.push({ key, calls: [call] });
    }
    return result;
  }, [rows]);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">{t('journal.eyebrow')}</p><h1><span className="swoosh">{t('journal.titleStrong')}</span>{t('journal.titleRest')}</h1>
          <p className="lead">{t('journal.lead')}</p></div>
        <span className="scope" title={t(scope === 'line' ? 'journal.scopeLineTitle' : 'journal.scopeDeviceTitle')}><Info size={14} /> {t(scope === 'line' ? 'journal.scopeLine' : 'journal.scopeDevice')}{demo ? ` · ${t('demo.fictional')}` : ''}</span>
      </header>

      {!demo && <div className="tabs" role="tablist" aria-label={t('journal.source')}>
        <button role="tab" aria-selected={scope === 'line'} className={scope === 'line' ? 'active' : ''} onClick={() => setScope('line')}>{t('journal.tabLine')}</button>
        <button role="tab" aria-selected={scope === 'device'} className={scope === 'device' ? 'active' : ''} onClick={() => setScope('device')}>{t('journal.tabDevice')}</button>
      </div>}
      {scope === 'line' && <div className="scope" role="status">
        {recordingsAccess.state === 'opening' ? t('journal.opening') :
          recordingsAccess.state === 'failed' ? <>{recordingsAccess.message} <button type="button" className="ghost small" onClick={() => void reopenRecordings()}>{t('action.retry')}</button></> :
          recordingsAccess.state !== 'open' ? t('journal.connectFirst') :
          historyError ? <>{historyError} <button type="button" className="ghost small" onClick={() => setRefresh(value => value + 1)}>{t('action.retry')}</button></> :
          loading && !history ? t('journal.loading') :
          history?.truncated ? t('journal.truncated') :
          history?.stale ? t('journal.stale') :
          history?.catchingUp ? t('journal.catchingUp') : t('journal.auto')}
      </div>}

      <section className="stats" aria-label={t(scope === 'line' ? 'stats.labelLine' : 'stats.labelDevice')}>
        <article><Phone size={18} /><span>{t('stats.calls')}</span><strong>{stats.count}</strong></article>
        <article className="accent"><Clock3 size={18} /><span>{t('stats.talk')}</span><strong>{formatLongDuration(stats.talk)}</strong></article>
        <article><PhoneOutgoing size={18} /><span>{t('stats.reached')}</span><strong>{stats.reached === null ? '—' : `${stats.reached} %`}</strong></article>
        <article className={stats.missed ? 'alert' : ''}><PhoneMissed size={18} /><span>{t('stats.missed')}</span><strong>{stats.missed}</strong></article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label={t('journal.filter')}>
            {FILTERS.map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{t(label)}</button>)}
          </div>
          <label className="search"><Search size={16} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('journal.searchPlaceholder')} aria-label={t('journal.search')} /></label>
        </div>

        {scope === 'line' && (!history || historyError || recordingsAccess.state !== 'open') ? null : groups.length === 0 ? (
          <div className="empty"><Phone size={28} /><b>{t(calls.length ? 'journal.noMatch' : 'journal.noCalls')}</b>
            <p>{t(calls.length ? 'journal.tryOther' : scope === 'line' ? 'journal.noLineCalls' : 'journal.dialHint')}</p></div>
        ) : groups.map(group => (
          <div key={group.key} className="day-group">
            <h2 className="day-label">{formatDay(group.calls[0]!.startedAt)}<span>{group.calls.length}</span></h2>
            <ul className="call-list">
              {group.calls.map(call => {
                const contact = findContact(contacts, call.dialTarget);
                const info = describeNumber(call.dialTarget);
                const name = contact?.name ?? call.remoteName;
                const open = openId === call.id;
                const seconds = talkSeconds(call);
                return (
                  <li key={call.id} className={'call-row' + (open ? ' open' : '') + (call.outcome === 'missed' ? ' is-missed' : '')}>
                    <div className="call-main">
                      <button type="button" className="call-summary" aria-expanded={open} onClick={() => setOpenId(open ? null : call.id)}>
                        <DirectionIcon call={call} />
                        <Avatar name={name} size={38} />
                        <span className="who"><b>{name ?? info.display}</b><small>{name ? info.display : countryLabel(info)}</small></span>
                        <span className="where"><Flag info={info} />{countryLabel(info)}</span>
                        <span className="row-tags">{call.tags.slice(0, 2).map(tag => <i key={tag} className="tag-mini">{tagLabel(tag)}</i>)}</span>
                        <span className={`result result-${call.outcome}`}>{call.outcome === 'answered' ? formatDuration(seconds) : outcomeLabel(call.outcome)}</span>
                        <span className="when">{formatTime(call.startedAt)}</span>
                        <ChevronDown size={16} className="chevron" aria-hidden="true" />
                      </button>
                      <button type="button" className="row-call" aria-label={t('journal.callBack', { name: name ?? call.dialTarget })} onClick={() => placeCall(call.dialTarget)}><Phone size={17} /></button>
                    </div>
                    {open && (
                      <div className="call-detail">
                        <dl>
                          <div><dt>{t(call.direction === 'inbound' ? 'detail.callerNumber' : 'detail.dialledNumber')}</dt><dd className="mono">{call.dialTarget || t('detail.unknown')}</dd></div>
                          <div><dt>{t('detail.start')}</dt><dd>{t('detail.startValue', { day: formatDay(call.startedAt), time: formatTime(call.startedAt) })}</dd></div>
                          <div><dt>{t('detail.outcome')}</dt><dd>{outcomeLabel(call.outcome)}</dd></div>
                          {call.failure && <div><dt>{t('detail.diagnostic')}</dt><dd>{call.failure}</dd></div>}
                          <div><dt>{t('detail.talk')}</dt><dd>{seconds ? formatDuration(seconds) : '—'}</dd></div>
                        </dl>
                        {scope === 'device' && <div className="tags" role="group" aria-label={t('detail.tags')}>
                          {CALL_TAGS.map(tag => {
                            const active = call.tags.includes(tag);
                            return <button key={tag} type="button" className={'tag' + (active ? ' active' : '')} aria-pressed={active}
                              onClick={() => store.updateCall(call.id, { tags: active ? call.tags.filter(other => other !== tag) : [...call.tags, tag] })}>{tagLabel(tag)}</button>;
                          })}
                        </div>}
                        {scope === 'device' && <textarea className="note" rows={2} maxLength={500} placeholder={t('detail.notePlaceholder')} aria-label={t('detail.note')}
                          value={call.note ?? ''} onChange={event => store.updateCall(call.id, { note: event.target.value })} />}
                        <div className="detail-actions">
                          <CallbackScheduler number={call.dialTarget} name={name}
                            onScheduled={() => { if (scope === 'device' && !call.tags.includes(CALLBACK_TAG)) store.updateCall(call.id, { tags: [...call.tags, CALLBACK_TAG] }); }} />
                          {contact ? <button type="button" className="ghost" onClick={() => openContact(contact.id)}>{t('detail.viewContact')}</button>
                            : <button type="button" className="ghost" onClick={() => {
                              const created = store.saveContact({ name: call.remoteName || call.dialTarget, numbers: [{ label: t('contact.mainLabel'), value: call.dialTarget }], favorite: false });
                              openContact(created.id);
                              notify(t('contact.createdToast'), 'success');
                            }}><UserPlus size={15} /> {t('detail.addContact')}</button>}
                          {scope === 'device' && <button type="button" className="ghost danger" onClick={() => { store.removeCall(call.id); setOpenId(null); }}><Trash2 size={15} /> {t('detail.remove')}</button>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
