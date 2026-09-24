import { ArrowDownLeft, ArrowUpRight, AudioLines, Clock3, Download, Info, KeyRound, LogOut, Play, RefreshCw, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { Avatar } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { dayKey, formatDay, formatDuration, formatTime } from '../../domain/format';
import { countryLabel, describeNumber } from '../../domain/numbers';
import { RecordingsError, type Period, type RecordedCall, type RecordingsIdentity, type RecordingsListing } from '../../recordings/types';
import { findContact } from '../../storage/DataStore';

const PERIODS: Array<[Period, string]> = [['today', 'Aujourd’hui'], ['yesterday', 'Hier'], ['week', '7 derniers jours']];

function message(error: unknown): string {
  return error instanceof RecordingsError ? error.message : 'Le service des enregistrements est momentanément injoignable.';
}

/** One-time sign-in to the recordings access: a separate account, never the SIP password. */
function Access({ onOpened }: { onOpened(identity: RecordingsIdentity): void }) {
  const { recordings } = useApp();
  const { account, demo } = usePhone();
  const [username, setUsername] = useState(account?.username ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  return (
    <section className="panel access-panel">
      <div className="access-copy">
        <KeyRound size={26} aria-hidden="true" />
        <h2>Vos enregistrements d’appels</h2>
        <p>Chaque appel de votre poste est enregistré par le serveur. Quelques minutes après l’appel, l’audio est prêt : vous pouvez l’écouter ici ou le télécharger.</p>
        <p>Cet accès est distinct de la ligne téléphonique : utilisez l’identifiant et le mot de passe d’accès aux enregistrements remis par APISNIX.{demo ? ' En démonstration, n’importe quel mot de passe ouvre des données fictives.' : ''}</p>
      </div>
      <form className="access-form" onSubmit={async event => {
        event.preventDefault();
        setBusy(true); setError('');
        try { onOpened(await recordings.signIn(username.trim(), password)); }
        catch (raised) { setError(message(raised)); }
        finally { setBusy(false); setPassword(''); }
      }}>
        <label>Identifiant<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required maxLength={100} /></label>
        <label>Mot de passe<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={256} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="primary" disabled={busy || !username.trim() || !password}>Ouvrir mes enregistrements</button>
      </form>
    </section>
  );
}

function Row({ call, playingId, onPlay }: { call: RecordedCall; playingId: string | null; onPlay(fileId: string | null): void }) {
  const { recordings } = useApp();
  const { contacts } = useData();
  const info = describeNumber(call.number);
  const contact = call.number ? findContact(contacts, call.number) : undefined;
  const name = contact?.name ?? (call.number ? info.display : 'Numéro inconnu');
  return (
    <li className="audio-row">
      <div className="audio-main">
      <span className={'direction ' + (call.direction === 'inbound' ? 'inbound' : 'outbound')} title={call.direction === 'inbound' ? 'Appel entrant' : 'Appel sortant'}>
        {call.direction === 'inbound' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
      <Avatar name={contact?.name ?? call.number} size={38} />
      <span className="who"><b>{name}</b><small>{contact ? info.display : countryLabel(info)}</small></span>
      <span className="where"><Flag info={info} />{countryLabel(info)}</span>
      <span className="when">{formatTime(call.startedAt)}</span>
      </div>
      <span className="audio-files">
        {call.files.map(file => file.state !== 'available'
          ? <span key={file.id} className="pill pill-wait" title="Le serveur prépare le fichier : il sera disponible dans quelques minutes."><i />En traitement</span>
          : <span key={file.id} className="audio-actions">
              <span className="audio-length mono"><Clock3 size={13} aria-hidden="true" />{file.durationSeconds === null ? '—' : formatDuration(file.durationSeconds)}</span>
              <button type="button" className={'ghost small' + (playingId === file.id ? ' active-audio' : '')} aria-pressed={playingId === file.id}
                onClick={() => onPlay(playingId === file.id ? null : file.id)}>{playingId === file.id ? <Square size={14} /> : <Play size={14} />} {playingId === file.id ? 'Arrêter' : 'Écouter'}</button>
              <a className="ghost small" href={recordings.audioUrl(file.id, true)} download title="Télécharger ce fichier sur cet appareil"><Download size={14} /> Télécharger</a>
            </span>)}
      </span>
    </li>
  );
}

export function Recordings() {
  const { recordings, notify } = useApp();
  const { demo } = usePhone();
  const { contacts } = useData();
  const [identity, setIdentity] = useState<RecordingsIdentity | null | undefined>(undefined);
  const [period, setPeriod] = useState<Period>('today');
  const [listing, setListing] = useState<RecordingsListing | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The player is declarative: the chosen file is state, the element follows it (autoplay on change).
  const [playing, setPlaying] = useState<{ id: string; src: string; label: string } | null>(null);
  const playingId = playing?.id ?? null;

  // Is a session already open on the service? Only then do we ask for anything.
  useEffect(() => {
    let cancelled = false;
    recordings.session().then(found => { if (!cancelled) setIdentity(found); }).catch(raised => { if (!cancelled) { setIdentity(null); setError(message(raised)); } });
    return () => { cancelled = true; };
  }, [recordings]);

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
    const result: Array<{ key: string; label: string; calls: RecordedCall[] }> = [];
    for (const call of listing?.calls ?? []) {
      const key = dayKey(call.startedAt);
      const last = result[result.length - 1];
      if (last?.key === key) last.calls.push(call); else result.push({ key, label: formatDay(call.startedAt), calls: [call] });
    }
    return result;
  }, [listing]);
  const ready = listing?.calls.reduce((total, call) => total + call.files.filter(file => file.state === 'available').length, 0) ?? 0;
  const pending = listing?.calls.reduce((total, call) => total + call.files.filter(file => file.state !== 'available').length, 0) ?? 0;

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">Vos enregistrements</p><h1><span className="swoosh">Audio</span> de vos appels</h1>
          <p className="lead">Écoutez ou téléchargez les enregistrements de votre poste.</p></div>
        {identity && (
          <span className="scope" title="Les enregistrements sont ceux du serveur, pour votre poste uniquement, quel que soit l’appareil utilisé pour appeler."><Info size={14} /> Poste {identity.alias ?? identity.extension}{demo ? ' · données fictives' : ''}</span>
        )}
      </header>

      {identity === undefined ? <div className="panel empty"><AudioLines size={28} /><b>Connexion au service…</b></div>
        : identity === null ? <>{error && <p className="line-banner" role="status">{error}</p>}<Access onOpened={found => { setIdentity(found); setError(''); }} /></>
        : (
          <section className="panel">
            <div className="toolbar">
              <div className="tabs" role="tablist" aria-label="Période">
                {PERIODS.map(([key, label]) => <button key={key} role="tab" aria-selected={period === key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>{label}</button>)}
              </div>
              <div className="head-actions">
                <button type="button" className="ghost small" onClick={() => void load()} disabled={loading} aria-label="Actualiser"><RefreshCw size={14} className={loading ? 'spin' : ''} /> Actualiser</button>
                <button type="button" className="ghost small" onClick={async () => { play(null, ''); await recordings.signOut(); setIdentity(null); setListing(null); }}><LogOut size={14} /> Fermer l’accès</button>
              </div>
            </div>
            {(pending > 0 || listing?.catchingUp || listing?.stale || error) && (
              <p className="audio-notice" role="status">
                {error ? error : listing?.stale ? 'Le service ne reçoit plus de nouvelles données : la liste peut être incomplète.'
                  : listing?.catchingUp ? 'Import des appels récents en cours : la liste se complète toute seule.'
                  : `${pending} fichier${pending > 1 ? 's' : ''} en préparation : disponible${pending > 1 ? 's' : ''} dans quelques minutes, sans rien faire.`}
              </p>
            )}
            {groups.length === 0 ? (
              <div className="empty"><AudioLines size={28} /><b>{loading && !listing ? 'Chargement…' : 'Aucun enregistrement sur cette période'}</b>
                <p>Un enregistrement apparaît ici quelques minutes après la fin de l’appel.</p></div>
            ) : groups.map(group => (
              <div key={group.key} className="day-group">
                <h2 className="day-label">{group.label}<span>{group.calls.length}</span></h2>
                <ul className="audio-list">
                  {group.calls.map(call => <Row key={call.id} call={call} playingId={playingId}
                    onPlay={fileId => play(fileId, `${(call.number && findContact(contacts, call.number)?.name) || call.number || 'Numéro inconnu'} · ${formatDay(call.startedAt)} ${formatTime(call.startedAt)}`)} />)}
                </ul>
              </div>
            ))}
            <footer className="audio-foot"><span>{ready} fichier{ready > 1 ? 's' : ''} disponible{ready > 1 ? 's' : ''}</span>
              <span className="playing-now" hidden={!playing}><AudioLines size={14} aria-hidden="true" /> {playing?.label}</span></footer>
          </section>
        )}
      {/* Outside the list: a refresh never interrupts the listening. */}
      {playing && (
        <audio key={playing.id} className="audio-player" src={playing.src} controls autoPlay preload="none" aria-label={'Lecture : ' + playing.label}
          onEnded={() => setPlaying(null)} onError={() => { setPlaying(null); notify('Ce fichier est momentanément inaccessible. Réessayez dans quelques minutes.', 'danger'); }} />
      )}
    </div>
  );
}
