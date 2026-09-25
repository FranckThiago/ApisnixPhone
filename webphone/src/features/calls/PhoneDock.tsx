import { AlarmClock, Delete, Grid3x3, Headphones, Mic, MicOff, Pause, Phone, PhoneIncoming, PhoneOff, Play, RotateCcw, StickyNote, UserPlus, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { Avatar } from '../../components/Avatar';
import { CallbackScheduler } from '../callbacks/CallbackScheduler';
import { formatDue, groupCallbacks } from '../../domain/callbacks';
import { Flag } from '../../components/Flag';
import { Kbd } from '../../components/Kbd';
import { formatDuration } from '../../domain/format';
import { countryLabel, describeNumber, filterDialCharacters, parseDialInput } from '../../domain/numbers';
import { CALL_TAGS, OUTCOME_LABELS } from '../../domain/types';
import { findContact, searchContacts } from '../../storage/DataStore';
import { keypadTone } from '../../telephony/audio';
import type { CallSnapshot, ConnectionState } from '../../telephony/types';

const KEYS: Array<[string, string]> = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', ''],
];

const CONNECTION: Record<ConnectionState, [string, 'ok' | 'wait' | 'bad']> = {
  ready: ['Ligne prête', 'ok'], connecting: ['Connexion…', 'wait'], registering: ['Enregistrement…', 'wait'],
  reconnecting: ['Reconnexion…', 'wait'], offline: ['Hors ligne', 'bad'], 'auth-error': ['Identifiants refusés', 'bad'],
  'network-error': ['Réseau indisponible', 'bad'], 'other-tab-active': ['Actif dans un autre onglet', 'bad'],
};

export function ConnectionPill() {
  const { connection, demo, lineTaken } = usePhone();
  const [label, tone] = CONNECTION[connection];
  if (lineTaken) return <span className="pill pill-bad"><i aria-hidden="true" />Ligne ouverte ailleurs</span>;
  return <span className={`pill pill-${tone}`}><i aria-hidden="true" />{demo && connection === 'ready' ? 'Démo · ligne prête' : label}</span>;
}

function Keypad({ onKey, compact = false }: { onKey(key: string): void; compact?: boolean }) {
  const { preferences } = useData();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const beep = (digit: string) => { if (preferences.keypadTones) keypadTone(digit, preferences.volume / 100); };
  return (
    <div className={'keypad' + (compact ? ' keypad-compact' : '')} role="group" aria-label="Clavier téléphonique">
      {KEYS.map(([digit, letters]) => (
        <button key={digit} type="button" className="key" aria-label={digit === '0' ? '0, maintenir pour +' : digit}
          onPointerDown={() => {
            // Heard as soon as the key goes down, like a real phone.
            beep(digit);
            held.current = false;
            // Holding 0 types the international +, as on a phone.
            if (digit === '0' && !compact) hold.current = setTimeout(() => { held.current = true; onKey('+'); }, 550);
          }}
          onPointerUp={() => { if (hold.current) clearTimeout(hold.current); }}
          onPointerLeave={() => { if (hold.current) clearTimeout(hold.current); }}
          onClick={event => {
            // A key pressed from the keyboard (Entrée, Espace) has no pointer: it sounds here.
            if (event.detail === 0) beep(digit);
            if (!held.current) onKey(digit);
          }}>
          <b>{digit}</b><small>{letters}</small>
        </button>
      ))}
    </div>
  );
}

function Dialer() {
  const { dial, setDial, placeCall, openContact } = useApp();
  const { connection } = usePhone();
  const { contacts, preferences } = useData();
  const { store } = useApp();
  const field = useRef<HTMLInputElement>(null);
  const input = parseDialInput(dial);
  const info = describeNumber(input.dialTarget);
  const known = input.valid ? findContact(contacts, input.dialTarget) : undefined;
  const suggestions = useMemo(() => (dial.trim().length > 1 && !known ? searchContacts(contacts, dial).slice(0, 3) : []), [dial, contacts, known]);
  const ready = connection === 'ready' && input.valid;

  const press = (key: string) => {
    setDial(filterDialCharacters(dial + key));
    field.current?.focus();
  };

  return (
    <>
      <section className="dock-card dialer" aria-label="Composer un numéro">
        <header className="dock-head"><h2>Nouvel appel</h2><ConnectionPill /></header>
        <div className={'dial-field' + (dial && !input.valid ? ' invalid' : '')}>
          <label htmlFor="dial-input">Numéro à appeler</label>
          <div className="dial-row">
            <input id="dial-input" ref={field} value={dial} inputMode="tel" autoComplete="off" spellCheck={false}
              placeholder="Nom ou numéro" aria-describedby="dial-hint"
              onChange={event => setDial(/[a-zA-ZÀ-ÿ]/.test(event.target.value) ? event.target.value.slice(0, 40) : filterDialCharacters(event.target.value))}
              onKeyDown={event => { if (event.key === 'Enter' && ready) placeCall(dial); }} />
            {dial && <button type="button" className="icon-button" aria-label="Effacer le dernier caractère" onClick={() => { setDial(dial.slice(0, -1)); field.current?.focus(); }}><Delete size={18} /></button>}
          </div>
          <p id="dial-hint" className="dial-hint">
            {input.valid ? <><Flag info={info} size={18} /><span>{known ? `${known.name} · ` : ''}{countryLabel(info)}</span><span className="dial-exact" title="Numéro exactement composé">{input.dialTarget}</span></>
              : dial && suggestions.length === 0 ? <span>Chiffres, +, * et # uniquement.</span>
              : <span>Le numéro est composé tel que vous le saisissez.</span>}
          </p>
        </div>
        {suggestions.length > 0 && (
          <ul className="suggestions" aria-label="Contacts correspondants">
            {suggestions.map(contact => (
              <li key={contact.id}>
                <button type="button" onClick={() => setDial(contact.numbers[0]?.value ?? '')}>
                  <Avatar name={contact.name} size={30} /><span><b>{contact.name}</b><small>{contact.numbers[0]?.value}</small></span>
                </button>
                <button type="button" className="icon-button" aria-label={`Ouvrir la fiche de ${contact.name}`} onClick={() => openContact(contact.id)}><UserPlus size={16} /></button>
              </li>
            ))}
          </ul>
        )}
        <Keypad onKey={press} />
        <button type="button" className="call-button" disabled={!ready} onClick={() => placeCall(dial)}>
          <Phone size={20} /> Appeler <Kbd>↵</Kbd>
        </button>
      </section>
      <DueCallbacks />
      <section className="dock-card audio-card" aria-label="Audio">
        <Headphones size={20} aria-hidden="true" />
        <div><b>Volume d’écoute</b><small>{preferences.volume} %</small></div>
        <label className="volume"><Volume2 size={16} aria-hidden="true" />
          <input type="range" min={0} max={100} value={preferences.volume} aria-label="Volume d’écoute"
            onChange={event => store.setPreferences({ volume: Number(event.target.value) })} />
        </label>
      </section>
    </>
  );
}

/** The next promises to keep, right under the keypad. */
function DueCallbacks() {
  const { placeCall, setView } = useApp();
  const { callbacks } = useData();
  const now = useNow();
  const groups = groupCallbacks(callbacks, now);
  const next = [...groups.overdue, ...groups.today].slice(0, 2);
  if (!next.length) return null;
  return (
    <section className="dock-card due-card" aria-label="Rappels à faire">
      <header><AlarmClock size={17} aria-hidden="true" /><b>Rappels</b><button type="button" onClick={() => setView('callbacks')}>Tout voir</button></header>
      <ul>{next.map(callback => (
        <li key={callback.id} className={callback.dueAt <= now ? 'overdue' : ''}>
          <span><b>{callback.name ?? callback.number}</b><small>{callback.dueAt <= now ? 'À faire maintenant' : formatDue(callback.dueAt, now)}{callback.note ? ` · ${callback.note}` : ''}</small></span>
          <button type="button" className="row-call always" aria-label={`Appeler ${callback.name ?? callback.number}`} onClick={() => placeCall(callback.number)}><Phone size={16} /></button>
        </li>))}
      </ul>
    </section>
  );
}

function useSeconds(from: number | undefined, until?: number) {
  const now = useNow();
  return from ? Math.max(0, Math.floor(((until ?? now) - from) / 1000)) : 0;
}

function WrapUp({ call }: { call: CallSnapshot }) {
  const { phone, store, wrapUpRecordId, placeCall, openContact, notify } = useApp();
  const { calls, contacts } = useData();
  const record = calls.find(item => item.id === wrapUpRecordId);
  const contact = findContact(contacts, call.dialTarget);
  const talked = call.answeredAt && call.endedAt ? Math.round((call.endedAt - call.answeredAt) / 1000) : 0;

  const addContact = () => {
    const created = store.saveContact({ name: call.remoteName || call.dialTarget, numbers: [{ label: 'Principal', value: call.rawInput }], favorite: false });
    phone.dismiss();
    openContact(created.id);
    notify('Contact créé. Complétez son nom.', 'success');
  };

  return (
    <div className="wrapup">
      {call.failure && <p className="call-failure" role="alert">{call.failure}</p>}
      <p className={`outcome outcome-${call.outcome}`}>{OUTCOME_LABELS[call.outcome ?? 'failed']}{talked ? ` · ${formatDuration(talked)}` : ''}</p>
      {record && (
        <>
          <div className="tags" role="group" aria-label="Qualifier l’appel">
            {CALL_TAGS.map(tag => {
              const active = record.tags.includes(tag);
              return <button key={tag} type="button" className={'tag' + (active ? ' active' : '')} aria-pressed={active}
                onClick={() => store.updateCall(record.id, { tags: active ? record.tags.filter(t => t !== tag) : [...record.tags, tag] })}>{tag}</button>;
            })}
          </div>
          <textarea className="note" rows={3} maxLength={500} placeholder="Note sur cet appel…" aria-label="Note sur cet appel"
            value={record.note ?? ''} onChange={event => store.updateCall(record.id, { note: event.target.value })} />
        </>
      )}
      {/* Scheduling from a call also tags it, so the journal tells the same story. */}
      <CallbackScheduler number={call.rawInput} name={contact?.name ?? call.remoteName} tone="dark"
        onScheduled={() => { if (record && !record.tags.includes('À rappeler')) store.updateCall(record.id, { tags: [...record.tags, 'À rappeler'] }); }} />
      <div className="wrapup-actions">
        <button type="button" className="ghost-light" onClick={() => { phone.dismiss(); placeCall(call.rawInput); }}><RotateCcw size={16} /> Rappeler</button>
        {!contact && <button type="button" className="ghost-light" onClick={addContact}><UserPlus size={16} /> Ajouter</button>}
        <button type="button" className="done" onClick={() => phone.dismiss()}>Terminer</button>
      </div>
    </div>
  );
}

function CallCard({ call }: { call: CallSnapshot }) {
  const { phone } = useApp();
  const { audioBlocked } = usePhone();
  const { contacts } = useData();
  const [keypad, setKeypad] = useState(false);
  const info = describeNumber(call.dialTarget);
  const contact = findContact(contacts, call.dialTarget);
  // The remote identity is untrusted: React renders it as text, never as markup.
  const name = contact?.name ?? call.remoteName;
  const live = call.phase === 'active' || call.phase === 'held';
  // « K » opens and closes the in-call keypad, like the hint on the button says.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() !== 'k' || event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, dialog')) return;
      if (call.phase === 'active') setKeypad(open => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [call.phase]);
  const seconds = useSeconds(call.answeredAt, call.endedAt);
  const ringing = call.phase === 'dialing' || call.phase === 'ringing-out' || call.phase === 'ringing-in';
  const status = call.phase === 'dialing' ? 'Connexion…' : call.phase === 'ringing-out' ? 'Ça sonne…'
    : call.phase === 'ringing-in' ? 'Appel entrant' : call.phase === 'held' ? 'En attente' : call.phase === 'ended' ? 'Appel terminé' : formatDuration(seconds);

  return (
    <section className={`dock-card call-card phase-${call.phase}`} aria-label="Appel en cours">
      <header className="call-top">
        <span className="call-direction">{call.direction === 'inbound' ? <PhoneIncoming size={14} /> : <Phone size={14} />}{call.direction === 'inbound' ? 'Entrant' : 'Sortant'}</span>
        {call.muted && call.phase !== 'ended' && <span className="chip-warning"><MicOff size={13} /> Micro coupé</span>}
      </header>
      <div className={'call-identity' + (ringing ? ' ringing' : '')}>
        <Avatar name={name} size={84} ring />
        <h2>{name ?? info.display}</h2>
        <p className="call-number"><Flag info={info} size={18} />{name ? info.display : countryLabel(info)}</p>
        <p className="call-status" role="status" aria-live="polite">{status}</p>
        {audioBlocked && live && <button type="button" className="done" onClick={() => phone.resumeAudio()}>Activer le son</button>}
        {call.dtmf && <p className="dtmf" aria-label="Touches envoyées">{call.dtmf}</p>}
      </div>

      {call.phase === 'ended' ? <WrapUp call={call} />
        : call.phase === 'ringing-in' ? (
          <div className="incoming-actions">
            <button type="button" className="round decline" onClick={() => phone.decline()}><PhoneOff size={24} /><span>Refuser</span></button>
            <button type="button" className="round accept" onClick={() => phone.answer()}><Phone size={24} /><span>Accepter</span></button>
          </div>
        ) : (
          <>
            {keypad && live ? (
              <div className="dtmf-pad"><Keypad compact onKey={key => phone.sendDtmf(key)} />
                <button type="button" className="ghost-light" onClick={() => setKeypad(false)}><X size={15} /> Masquer le clavier</button></div>
            ) : (
              <div className="call-controls">
                <button type="button" className={'control' + (call.muted ? ' on' : '')} disabled={!live} aria-pressed={call.muted} onClick={() => phone.setMuted(!call.muted)}>
                  {call.muted ? <MicOff size={21} /> : <Mic size={21} />}<span>{call.muted ? 'Réactiver' : 'Muet'}</span><Kbd>M</Kbd></button>
                <button type="button" className={'control' + (call.phase === 'held' ? ' on' : '')} disabled={!live || call.holdPending} aria-pressed={call.phase === 'held'}
                  onClick={() => phone.setHeld(call.phase !== 'held')}>
                  {call.phase === 'held' ? <Play size={21} /> : <Pause size={21} />}<span>{call.holdPending ? 'Patientez…' : call.phase === 'held' ? 'Reprendre' : 'Attente'}</span><Kbd>H</Kbd></button>
                <button type="button" className="control" disabled={call.phase !== 'active'} onClick={() => setKeypad(true)}><Grid3x3 size={21} /><span>Clavier</span><Kbd>K</Kbd></button>
              </div>
            )}
            <button type="button" className="hangup" onClick={() => phone.hangup()}><PhoneOff size={22} />{live ? 'Raccrocher' : 'Annuler'}</button>
          </>
        )}
    </section>
  );
}

export function PhoneDock() {
  const { call } = usePhone();
  return <aside className="dock" aria-label="Téléphone">{call ? <CallCard call={call} /> : <Dialer />}
    {call && call.phase !== 'ended' && <p className="dock-note"><StickyNote size={14} /> Vous pourrez noter et qualifier l’appel à la fin.</p>}</aside>;
}
