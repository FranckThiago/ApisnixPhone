import { AlarmClock, Check, Clock3, Phone, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useApp, useData } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { Avatar } from '../../components/Avatar';
import { Flag } from '../../components/Flag';
import { formatDue, groupCallbacks } from '../../domain/callbacks';
import { countryLabel, describeNumber, parseDialInput } from '../../domain/numbers';
import type { Callback } from '../../domain/types';
import { findContact } from '../../storage/DataStore';
import { CallbackScheduler } from './CallbackScheduler';

function Row({ callback, now, overdue = false }: { callback: Callback; now: number; overdue?: boolean }) {
  const { store, placeCall } = useApp();
  const { contacts } = useData();
  const target = parseDialInput(callback.number).dialTarget;
  const info = describeNumber(target);
  const name = findContact(contacts, target)?.name ?? callback.name;
  const done = Boolean(callback.doneAt);
  return (
    <li className={'callback-row' + (overdue ? ' overdue' : '') + (done ? ' done' : '')}>
      <Avatar name={name} size={40} />
      <span className="who"><b>{name ?? callback.number}</b><small><Flag info={info} size={16} /> {name ? callback.number : countryLabel(info)}</small></span>
      <span className="due"><Clock3 size={14} />{done ? `Fait · ${formatDue(callback.doneAt!, now)}` : formatDue(callback.dueAt, now)}{overdue && <i>En retard</i>}</span>
      <span className="callback-note">{callback.note}</span>
      <span className="callback-actions">
        {done ? <button type="button" className="icon-button" aria-label="Remettre à faire" title="Remettre à faire" onClick={() => store.updateCallback(callback.id, { doneAt: undefined })}><Undo2 size={17} /></button> : (
          <>
            <button type="button" className="mini-call" onClick={() => placeCall(callback.number)}><Phone size={16} /> Appeler</button>
            <button type="button" className="icon-button" aria-label="Reporter d’une heure" title="Reporter d’une heure" onClick={() => store.updateCallback(callback.id, { dueAt: Math.max(now, callback.dueAt) + 3_600_000 })}><AlarmClock size={17} /></button>
            <button type="button" className="icon-button" aria-label="Marquer comme fait" title="Marquer comme fait" onClick={() => store.updateCallback(callback.id, { doneAt: Date.now() })}><Check size={18} /></button>
          </>
        )}
        <button type="button" className="icon-button danger" aria-label="Supprimer le rappel" title="Supprimer" onClick={() => store.removeCallback(callback.id)}><Trash2 size={16} /></button>
      </span>
    </li>
  );
}

export function Callbacks() {
  const { callbacks } = useData();
  const { dial } = useApp();
  const now = useNow();
  const [showDone, setShowDone] = useState(false);
  const groups = groupCallbacks(callbacks, now);
  const pending = groups.overdue.length + groups.today.length + groups.upcoming.length;
  const typed = parseDialInput(dial);

  return (
    <div className="page">
      <header className="page-head">
        <div><p className="eyebrow">Ne perdez aucune promesse</p><h1><span className="swoosh">Rappels</span></h1>
          <p className="lead">Planifiez depuis la fin d’un appel, le journal ou une fiche. Un rappel se clôt seul quand la personne a été jointe.</p></div>
        {typed.valid && <CallbackScheduler number={dial} />}
      </header>
      {pending === 0 && groups.done.length === 0 ? (
        <div className="panel empty"><AlarmClock size={28} /><b>Aucun rappel prévu</b><p>À la fin d’un appel, touchez « Planifier un rappel » : il apparaîtra ici et vous préviendra à l’heure.</p></div>
      ) : (
        <>
          {([['overdue', 'À faire maintenant'], ['today', 'Plus tard aujourd’hui'], ['upcoming', 'À venir']] as const).map(([key, label]) => groups[key].length > 0 && (
            <section key={key} className={'panel callback-group' + (key === 'overdue' ? ' urgent' : '')}>
              <h2 className="day-label">{label}<span>{groups[key].length}</span></h2>
              <ul>{groups[key].map(callback => <Row key={callback.id} callback={callback} now={now} overdue={key === 'overdue'} />)}</ul>
            </section>
          ))}
          {groups.done.length > 0 && (
            <section className="panel callback-group">
              <button type="button" className="day-label as-button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>Faits récemment<span>{groups.done.length}</span></button>
              {showDone && <ul>{groups.done.map(callback => <Row key={callback.id} callback={callback} now={now} />)}</ul>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
