import { CheckCheck, Clock3, Download, Play, RefreshCw, Square, Trash2, Voicemail as VoicemailIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp, useData } from '../../app/AppContext';
import { Avatar } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { formatDay, formatDuration, formatTime } from '../../domain/format';
import { countryLabel, describeNumber } from '../../domain/numbers';
import { useI18n } from '../../i18n';
import { findContact } from '../../storage/DataStore';
import type { VoiceMessage } from '../../voicemail/client';
import { RecordingPlayer } from './RecordingPlayer';

/** Messages left on the voicemail of this phone: listen, download, delete. */
export function Voicemail({ tabs, onCount }: { tabs: ReactNode; onCount(unread: number): void }) {
  const { voicemail, notify, recordingsAccess, placeCall } = useApp();
  const { contacts } = useData();
  const { t, tp } = useI18n();
  const [messages, setMessages] = useState<VoiceMessage[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ id: string; src: string; label: string } | null>(null);
  const generation = useRef(0);
  const open = recordingsAccess.state === 'open';

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const next = await voicemail.list();
      setMessages(next); setError(''); onCount(next.filter(message => message.unread).length);
    } catch (raised) { setError(raised instanceof Error ? raised.message : t('voicemail.unavailable')); }
    finally { setLoading(false); }
  }, [open, voicemail, onCount, t]);
  useEffect(() => {
    const first = setTimeout(() => { void load(); }, 0);
    const timer = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [load]);
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => () => { if (playing?.src.startsWith('blob:')) URL.revokeObjectURL(playing.src); }, [playing]);

  const label = (message: VoiceMessage) => {
    const contact = message.caller ? findContact(contacts, message.caller) : undefined;
    return contact?.name ?? (message.name || (message.caller ? describeNumber(message.caller, 'inbound').display : t('rec.unknownNumber')));
  };
  const play = async (message: VoiceMessage | null) => {
    const current = ++generation.current;
    setPlaying(null);
    if (!message || message.id === playing?.id) return;
    setBusy(message.id);
    try {
      const src = await voicemail.audioUrl(message.id);
      if (current !== generation.current) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); return; }
      setPlaying({ id: message.id, src, label: `${label(message)} · ${formatDay(message.receivedAt)} ${formatTime(message.receivedAt)}` });
      // Listening is reading: the badge follows at once, the service remembers it.
      if (message.unread) void voicemail.markRead([message.id]).then(load).catch(() => undefined);
    } catch (raised) { if (current === generation.current) notify(raised instanceof Error ? raised.message : t('rec.fileError'), 'danger'); }
    finally { setBusy(null); }
  };
  const download = async (message: VoiceMessage) => {
    try {
      const src = await voicemail.audioUrl(message.id);
      const link = document.createElement('a'); link.href = src; link.download = `message-vocal-${message.id}.wav`;
      document.body.append(link); link.click(); link.remove();
      if (src.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(src), 60_000);
    } catch (raised) { notify(raised instanceof Error ? raised.message : t('rec.fileError'), 'danger'); }
  };
  const remove = async (message: VoiceMessage) => {
    if (!window.confirm(t('voicemail.confirmDelete', { name: label(message) }))) return;
    setBusy(message.id);
    try {
      await voicemail.remove(message.id);
      if (playing?.id === message.id) void play(null);
      notify(t('voicemail.deleted'), 'success');
      await load();
    } catch (raised) { notify(raised instanceof Error ? raised.message : t('voicemail.unavailable'), 'danger'); }
    finally { setBusy(null); }
  };

  const unread = messages?.filter(message => message.unread).length ?? 0;
  const readAll = async () => {
    setLoading(true);
    try { await voicemail.markRead(); await load(); }
    catch (raised) { notify(raised instanceof Error ? raised.message : t('voicemail.unavailable'), 'danger'); setLoading(false); }
  };
  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">{t('rec.eyebrow')}</p><h1><span className="swoosh">{t('voicemail.titleStrong')}</span>{t('voicemail.titleRest')}</h1>
          <p className="lead">{t('voicemail.lead')}</p></div>
      </header>
      {tabs}
      {playing && <RecordingPlayer key={playing.id} src={playing.src} label={playing.label}
        onClose={() => { void play(null); }} onError={() => { setPlaying(null); notify(t('rec.fileError'), 'danger'); }} />}
      <section className={'panel' + (playing ? ' below-recording-player' : '')}>
        <div className="toolbar">
          <span className="voicemail-count" role="status">{messages ? tp('voicemail.count', messages.length) : ''}{unread ? ` · ${tp('voicemail.unread', unread)}` : ''}</span>
          <div className="head-actions">
            {unread > 0 && <button type="button" className="ghost small" disabled={loading || !open} onClick={() => { void readAll(); }}><CheckCheck size={14} /> {t('voicemail.readAll')}</button>}
            <button type="button" className="ghost small" disabled={loading || !open} onClick={() => { void load(); }}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {t('rec.refresh')}</button>
          </div>
        </div>
        {(error || !open) && <p className="audio-notice" role="status">{!open ? t('voicemail.signIn') : error}</p>}
        {!messages?.length ? (
          <div className="empty" role="status"><VoicemailIcon size={28} /><b>{t(loading && !messages ? 'rec.loading' : 'voicemail.empty')}</b>
            {!loading && <p>{t('voicemail.emptyHint')}</p>}</div>
        ) : (
          <ul className="audio-list voicemail-list">
            {messages.map(message => {
              const info = describeNumber(message.caller, 'inbound');
              const name = label(message);
              const active = playing?.id === message.id;
              return (
                <li key={message.id} className={'audio-row' + (message.unread ? ' unread' : '')}>
                  <div className="audio-main">
                    <span className={'voicemail-dot' + (message.unread ? ' on' : '')} title={t(message.unread ? 'voicemail.new' : 'voicemail.heard')} />
                    <Avatar name={name} size={38} />
                    <span className="who"><b>{name}</b><small>{message.caller ? info.display : t('rec.unknownNumber')}</small></span>
                    <span className="where"><Flag info={info} />{countryLabel(info)}</span>
                    <span className="when">{formatDay(message.receivedAt)} · {formatTime(message.receivedAt)}</span>
                  </div>
                  <span className="audio-files"><span className="audio-actions">
                    <span className="audio-length mono"><Clock3 size={13} aria-hidden="true" />{message.durationSeconds === null ? '—' : formatDuration(message.durationSeconds)}</span>
                    <button type="button" className={'ghost small' + (active ? ' active-audio' : '')} aria-pressed={active} disabled={busy === message.id}
                      onClick={() => { void play(active ? null : message); }}>{active ? <Square size={14} /> : <Play size={14} />} {t(active ? 'rec.stop' : 'rec.listen')}</button>
                    <button type="button" className="ghost small" onClick={() => { void download(message); }} title={t('rec.downloadTitle')}><Download size={14} /> {t('rec.download')}</button>
                    {message.caller && <button type="button" className="ghost small" onClick={() => placeCall(message.caller)}>{t('action.call')}</button>}
                    <button type="button" className="ghost small danger" disabled={busy === message.id} onClick={() => { void remove(message); }}
                      aria-label={t('voicemail.delete')} title={t('voicemail.delete')}><Trash2 size={14} /></button>
                  </span></span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
