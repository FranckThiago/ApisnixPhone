import { AlarmClock, Check } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { formatDue, quickOptions, toLocalInput } from '../../domain/callbacks';

/** Plan a callback in one tap, or pick an exact moment. */
export function CallbackScheduler({ number, name, tone = 'light', onScheduled }: { number: string; name?: string; tone?: 'light' | 'dark'; onScheduled?(): void }) {
  const { store, notify } = useApp();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');

  const schedule = (dueAt: number) => {
    if (!Number.isFinite(dueAt) || dueAt <= now) return notify('Choisissez un moment à venir.', 'danger');
    store.scheduleCallback({ number, name, dueAt, note: note.trim() || undefined });
    notify(`Rappel planifié : ${formatDue(dueAt, now).toLowerCase()}.`, 'success');
    setOpen(false);
    setNote('');
    setCustom('');
    onScheduled?.();
  };

  if (!open) return <button type="button" className={tone === 'dark' ? 'ghost-light' : 'ghost'} onClick={() => setOpen(true)}><AlarmClock size={16} /> Planifier un rappel</button>;

  return (
    <div className={`scheduler scheduler-${tone}`} role="group" aria-label="Planifier un rappel">
      <p className="scheduler-title"><AlarmClock size={15} /> Rappeler {name ?? number}</p>
      <div className="tags">
        {quickOptions(now).map(option => <button key={option.label} type="button" className="tag" onClick={() => schedule(option.at)}>{option.label}</button>)}
      </div>
      <div className="scheduler-custom">
        <input type="datetime-local" aria-label="Date et heure du rappel" value={custom} min={toLocalInput(now)} onChange={event => setCustom(event.target.value)} />
        <button type="button" className="tag active" disabled={!custom} onClick={() => schedule(new Date(custom).getTime())}><Check size={14} /> Valider</button>
      </div>
      <input className="scheduler-note" value={note} maxLength={200} placeholder="Motif du rappel (facultatif)" aria-label="Motif du rappel" onChange={event => setNote(event.target.value)} />
      <button type="button" className="scheduler-cancel" onClick={() => setOpen(false)}>Annuler</button>
    </div>
  );
}
