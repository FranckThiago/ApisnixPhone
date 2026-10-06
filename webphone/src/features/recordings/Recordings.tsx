import { ArrowDownLeft, ArrowUpRight, AudioLines, Clock3, Download, Info, KeyRound, LogOut, Play, RefreshCw, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { Avatar } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { dayKey, formatDay, formatDuration, formatTime } from '../../domain/format';
import { countryLabel, describeNumber } from '../../domain/numbers';
import { RecordingsError, type Period, type RecordedCall, type RecordingsIdentity, type RecordingsListing } from '../../recordings/types';
import { findContact } from '../../storage/DataStore';
import { t, useI18n, type MessageKey } from '../../i18n';

const PERIODS: Array<[Period, MessageKey]> = [['today', 'day.today'], ['yesterday', 'day.yesterday'], ['week', 'rec.week'], ['month', 'rec.month']];

function message(error: unknown): string {
  return error instanceof RecordingsError ? error.message : t('rec.unreachable');
}

/** The access could not be opened with the line: say why, offer to try again, never ask for a password. */
function Unavailable({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry(): void }) {
  const { t } = useI18n();
  return (
    <section className="panel access-panel">
      <div className="access-copy">
        <KeyRound size={26} aria-hidden="true" />
        <h2>{t('rec.accessTitle')}</h2>
        <p>{t('rec.accessText')}</p>
        <p>{t('rec.accessAuto')}</p>
      </div>
      <div className="access-form">
        <p className="form-error" role="alert">{message}</p>
        <button type="button" className="primary" disabled={retrying} onClick={onRetry}><RefreshCw size={16} className={retrying ? 'spin' : ''} /> {t(retrying ? 'rec.opening' : 'action.retry')}</button>
      </div>
    </section>
  );
}

function Row({ call, playingId, onPlay }: { call: RecordedCall; playingId: string | null; onPlay(fileId: string | null): void }) {
  const { recordings } = useApp();
  const { contacts } = useData();
  const { t } = useI18n();
  const info = describeNumber(call.number, call.direction);
  const contact = call.number ? findContact(contacts, call.number) : undefined;
  const name = contact?.name ?? (call.number ? info.display : t('rec.unknownNumber'));
  return (
    <li className="audio-row">
      <div className="audio-main">
      <span className={'direction ' + (call.direction === 'inbound' ? 'inbound' : 'outbound')} title={t(call.direction === 'inbound' ? 'direction.inbound' : 'direction.outbound')}>
        {call.direction === 'inbound' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
      <Avatar name={contact?.name ?? call.number} size={38} />
      <span className="who"><b>{name}</b><small>{contact ? info.display : countryLabel(info)}</small></span>
      <span className="where"><Flag info={info} />{countryLabel(info)}</span>
      <span className="when">{formatTime(call.startedAt)}</span>
      </div>
      <span className="audio-files">
        {call.files.map(file => file.state !== 'available'
          ? <span key={file.id} className="pill pill-wait" title={t('rec.processingTitle')}><i />{t('rec.processing')}</span>
          : <span key={file.id} className="audio-actions">
              <span className="audio-length mono"><Clock3 size={13} aria-hidden="true" />{file.durationSeconds === null ? '—' : formatDuration(file.durationSeconds)}</span>
              <button type="button" className={'ghost small' + (playingId === file.id ? ' active-audio' : '')} aria-pressed={playingId === file.id}
                onClick={() => onPlay(playingId === file.id ? null : file.id)}>{playingId === file.id ? <Square size={14} /> : <Play size={14} />} {t(playingId === file.id ? 'rec.stop' : 'rec.listen')}</button>
              <a className="ghost small" href={recordings.audioUrl(file.id, true)} download title={t('rec.downloadTitle')}><Download size={14} /> {t('rec.download')}</a>
            </span>)}
      </span>
    </li>
  );
}

export function Recordings() {
  const { recordings, notify, recordingsAccess, reopenRecordings } = useApp();
  const { demo } = usePhone();
  const { contacts } = useData();
  const { t, tp } = useI18n();
  const [identity, setIdentity] = useState<RecordingsIdentity | null | undefined>(undefined);
  const [period, setPeriod] = useState<Period>('today');
  const [listing, setListing] = useState<RecordingsListing | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The player is declarative: the chosen file is state, the element follows it (autoplay on change).
  const [playing, setPlaying] = useState<{ id: string; src: string; label: string } | null>(null);
  const playingId = playing?.id ?? null;

  // The access was opened with the line at sign-in; here we only read who the service says we are.
  useEffect(() => {
    if (recordingsAccess.state === 'opening') return;
    let cancelled = false;
    recordings.session().then(found => { if (!cancelled) setIdentity(found); }).catch(raised => { if (!cancelled) { setIdentity(null); setError(message(raised)); } });
    return () => { cancelled = true; };
  }, [recordings, recordingsAccess.state]);

  const load = useCallback(async () => {
    if (!identity) return;
    setLoading(true);
    try { setListing(await recordings.list(period)); setError(''); }
    catch (raised) {
      if (raised instanceof RecordingsError && raised.status === 401) { setIdentity(null); setListing(null); }
      setError(message(raised));
    } finally { setLoading(false); }
  }, [identity, period, recordings]);

  // Refreshed on opening, on each period change, then every minute: a file finishes processing on its own.
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);

  const play = (fileId: string | null, label: string) => {
    setPlaying(fileId && fileId !== playingId ? { id: fileId, src: recordings.audioUrl(fileId, false), label } : null);
  };

  const groups = useMemo(() => {
    const result: Array<{ key: string; calls: RecordedCall[] }> = [];
    for (const call of listing?.calls ?? []) {
      const key = dayKey(call.startedAt);
      const last = result[result.length - 1];
      if (last?.key === key) last.calls.push(call); else result.push({ key, calls: [call] });
    }
    return result;
  }, [listing]);
  const ready = listing?.calls.reduce((total, call) => total + call.files.filter(file => file.state === 'available').length, 0) ?? 0;
  const pending = listing?.calls.reduce((total, call) => total + call.files.filter(file => file.state !== 'available').length, 0) ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">{t('rec.eyebrow')}</p><h1><span className="swoosh">{t('rec.titleStrong')}</span>{t('rec.titleRest')}</h1>
          <p className="lead">{t('rec.lead')}</p></div>
        {identity && (
          <span className="scope" title={t('rec.scopeTitle')}><Info size={14} /> {t('rec.extension', { name: identity.alias ?? identity.extension })}{demo ? ` · ${t('demo.fictional')}` : ''}</span>
        )}
      </header>

      {identity === undefined || recordingsAccess.state === 'opening' ? <div className="panel empty"><AudioLines size={28} /><b>{t('rec.openingAll')}</b></div>
        : identity === null ? <Unavailable retrying={false} onRetry={() => void reopenRecordings()}
            message={recordingsAccess.state === 'failed' ? recordingsAccess.message : error || t('rec.notOpen')} />
        : (
          <section className="panel">
            <div className="toolbar">
              <div className="tabs" role="tablist" aria-label={t('rec.period')}>
                {PERIODS.map(([key, label]) => <button key={key} role="tab" aria-selected={period === key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{t(label)}</button>)}
              </div>
              <div className="head-actions">
                <button type="button" className="ghost small" onClick={() => void load()} disabled={loading} aria-label={t('rec.refresh')}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('rec.refresh')}</button>
                <button type="button" className="ghost small" onClick={async () => { play(null, ''); await recordings.signOut(); setIdentity(null); setListing(null); }}><LogOut size={14} /> {t('rec.closeAccess')}</button>
              </div>
            </div>
            {(pending > 0 || listing?.catchingUp || listing?.stale || error) && (
              <p className="audio-notice" role="status">
                {error ? error : listing?.stale ? t('rec.stale')
                  : listing?.catchingUp ? t('rec.catchingUp')
                  : tp('rec.pending', pending)}
              </p>
            )}
            {listing?.truncated && <p className="audio-notice" role="status">{t('rec.truncated')}</p>}
            {groups.length === 0 ? (
              <div className="empty"><AudioLines size={28} /><b>{t(loading && !listing ? 'rec.loading' : 'rec.empty')}</b>
                <p>{t('rec.emptyHint')}</p></div>
            ) : groups.map(group => (
              <div key={group.key} className="day-group">
                <h2 className="day-label">{formatDay(group.calls[0]!.startedAt)}<span>{group.calls.length}</span></h2>
                <ul className="audio-list">
                  {group.calls.map(call => <Row key={call.id} call={call} playingId={playingId}
                    onPlay={fileId => play(fileId, `${(call.number && findContact(contacts, call.number)?.name) || call.number || t('rec.unknownNumber')} · ${formatDay(call.startedAt)} ${formatTime(call.startedAt)}`)} />)}
                </ul>
              </div>
            ))}
            <footer className="audio-foot"><span>{tp('rec.ready', ready)}</span>
              <span className="playing-now" hidden={!playing}><AudioLines size={14} aria-hidden="true" /> {playing?.label}</span></footer>
          </section>
        )}
      {/* Outside the list: a refresh never interrupts the listening. */}
      {playing && (
        <audio key={playing.id} className="audio-player" src={playing.src} controls autoPlay preload="none" aria-label={t('rec.playing', { label: playing.label })}
          onEnded={() => setPlaying(null)} onError={() => { setPlaying(null); notify(t('rec.fileError'), 'danger'); }} />
      )}
    </div>
  );
}
