import { ArrowDownLeft, ArrowUpRight, ChevronDown, Clock3, Phone, PhoneMissed, PhoneOutgoing, Search, Trash2, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { Avatar } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { dayKey, fold, formatDay, formatDuration, formatLongDuration, formatTime } from '../../domain/format';
import { countryLabel, describeNumber } from '../../domain/numbers';
import { CALL_TAGS, OUTCOME_LABELS, talkSeconds, type CallRecord } from '../../domain/types';
import { findContact } from '../../storage/DataStore';

type Filter = 'all' | 'outbound' | 'inbound' | 'missed';
const FILTERS: Array<[Filter, string]> = [['all', 'Tous'], ['outbound', 'Sortants'], ['inbound', 'Entrants'], ['missed', 'Manqués']];

function DirectionIcon({ call }: { call: CallRecord }) {
  if (call.outcome === 'missed') return <span className="direction missed" title="Appel manqué"><PhoneMissed size={16} /></span>;
  return call.direction === 'inbound'
    ? <span className="direction inbound" title="Appel entrant"><ArrowDownLeft size={16} /></span>
    : <span className="direction outbound" title="Appel sortant"><ArrowUpRight size={16} /></span>;
}

export function Journal() {
  const { placeCall, store, openContact, notify } = useApp();
  const { calls, contacts } = useData();
  const { demo } = usePhone();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

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
      const country = describeNumber(call.dialTarget).countryName ?? '';
      return fold(name).includes(text) || fold(country).includes(text) || (digits.length > 1 && call.dialTarget.includes(digits))
        || call.tags.some(tag => fold(tag).includes(text));
    });
  }, [calls, contacts, filter, query]);

  const groups = useMemo(() => {
    const result: Array<{ key: string; label: string; calls: CallRecord[] }> = [];
    for (const call of rows) {
      const key = dayKey(call.startedAt);
      const last = result[result.length - 1];
      if (last?.key === key) last.calls.push(call);
      else result.push({ key, label: formatDay(call.startedAt), calls: [call] });
    }
    return result;
  }, [rows]);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">Votre téléphonie, simplement</p><h1><span className="swoosh">Journal</span> d’appels</h1>
          <p className="lead">Retrouvez vos échanges et reprenez la conversation.</p></div>
        <span className="scope" title="Seuls les appels passés depuis ce navigateur apparaissent ici.">Ce navigateur{demo ? ' · données fictives' : ''}</span>
      </header>

      <section className="stats" aria-label="Aujourd’hui sur ce navigateur">
        <article><Phone size={18} /><span>Appels aujourd’hui</span><strong>{stats.count}</strong></article>
        <article className="accent"><Clock3 size={18} /><span>Temps en conversation</span><strong>{formatLongDuration(stats.talk)}</strong></article>
        <article><PhoneOutgoing size={18} /><span>Sortants aboutis</span><strong>{stats.reached === null ? '—' : `${stats.reached} %`}</strong></article>
        <article className={stats.missed ? 'alert' : ''}><PhoneMissed size={18} /><span>Manqués</span><strong>{stats.missed}</strong></article>
      </section>

      <section className="panel">
        <div className="toolbar">
          <div className="tabs" role="tablist" aria-label="Filtrer le journal">
            {FILTERS.map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
          <label className="search"><Search size={16} aria-hidden="true" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nom, numéro, pays, tag…" aria-label="Rechercher dans le journal" /></label>
        </div>

        {groups.length === 0 ? (
          <div className="empty"><Phone size={28} /><b>{calls.length ? 'Aucun appel ne correspond' : 'Aucun appel pour le moment'}</b>
            <p>{calls.length ? 'Essayez un autre filtre ou une autre recherche.' : 'Composez un numéro à droite : vos appels apparaîtront ici.'}</p></div>
        ) : groups.map(group => (
          <div key={group.key} className="day-group">
            <h2 className="day-label">{group.label}<span>{group.calls.length}</span></h2>
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
                        <span className="row-tags">{call.tags.slice(0, 2).map(tag => <i key={tag} className="tag-mini">{tag}</i>)}</span>
                        <span className={`result result-${call.outcome}`}>{call.outcome === 'answered' ? formatDuration(seconds) : OUTCOME_LABELS[call.outcome]}</span>
                        <span className="when">{formatTime(call.startedAt)}</span>
                        <ChevronDown size={16} className="chevron" aria-hidden="true" />
                      </button>
                      <button type="button" className="row-call" aria-label={`Rappeler ${name ?? call.dialTarget}`} onClick={() => placeCall(call.dialTarget)}><Phone size={17} /></button>
                    </div>
                    {open && (
                      <div className="call-detail">
                        <dl>
                          <div><dt>Numéro composé</dt><dd className="mono">{call.dialTarget}</dd></div>
                          <div><dt>Début</dt><dd>{formatDay(call.startedAt)} à {formatTime(call.startedAt)}</dd></div>
                          <div><dt>Issue observée</dt><dd>{OUTCOME_LABELS[call.outcome]}</dd></div>
                          <div><dt>Conversation</dt><dd>{seconds ? formatDuration(seconds) : '—'}</dd></div>
                        </dl>
                        <div className="tags" role="group" aria-label="Tags de l’appel">
                          {CALL_TAGS.map(tag => {
                            const active = call.tags.includes(tag);
                            return <button key={tag} type="button" className={'tag' + (active ? ' active' : '')} aria-pressed={active}
                              onClick={() => store.updateCall(call.id, { tags: active ? call.tags.filter(t => t !== tag) : [...call.tags, tag] })}>{tag}</button>;
                          })}
                        </div>
                        <textarea className="note" rows={2} maxLength={500} placeholder="Ajouter une note…" aria-label="Note de l’appel"
                          value={call.note ?? ''} onChange={event => store.updateCall(call.id, { note: event.target.value })} />
                        <div className="detail-actions">
                          {contact ? <button type="button" className="ghost" onClick={() => openContact(contact.id)}>Voir la fiche</button>
                            : <button type="button" className="ghost" onClick={() => {
                              const created = store.saveContact({ name: call.remoteName || call.dialTarget, numbers: [{ label: 'Principal', value: call.dialTarget }], favorite: false });
                              openContact(created.id);
                              notify('Contact créé. Complétez son nom.', 'success');
                            }}><UserPlus size={15} /> Ajouter aux contacts</button>}
                          <button type="button" className="ghost danger" onClick={() => { store.removeCall(call.id); setOpenId(null); }}><Trash2 size={15} /> Retirer du journal</button>
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
