import { AlarmClock, Check } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { formatDue, quickOptions, toLocalInput } from '../../domain/callbacks';
import { useI18n } from '../../i18n';

/** Plan a callback in one tap, or pick an exact moment. */
export function CallbackScheduler({ number, name, tone = 'page', onScheduled }: { number: string; name?: string; tone?: 'page' | 'call'; onScheduled?(): void }) {
  const { store, notify } = useApp();
  const { t } = useI18n();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');

  const schedule = (dueAt: number) => {
    if (!Number.isFinite(dueAt) || dueAt <= now) return notify(t('scheduler.future'), 'danger');
    store.scheduleCallback({ number, name, dueAt, note: note.trim() || undefined });
    notify(t('scheduler.planned', { when: formatDue(dueAt, now).toLowerCase() }), 'success');
    setOpen(false);
    setNote('');
    setCustom('');
    onScheduled?.();
  };

  if (!open) return <button type="button" className={tone === 'call' ? 'ghost-call' : 'ghost'} onClick={() => setOpen(true)}><AlarmClock size={16} /> {t('scheduler.open')}</button>;

  return (
    <div className={`scheduler scheduler-${tone}`} role="group" aria-label={t('scheduler.open')}>
      <p className="scheduler-title"><AlarmClock size={15} /> {t('scheduler.title', { name: name ?? number })}</p>
      <div className="tags">
        {quickOptions(now).map(option => <button key={option.label} type="button" className="tag" onClick={() => schedule(option.at)}>{option.label}</button>)}
      </div>
      <div className="scheduler-custom">
        <input type="datetime-local" aria-label={t('scheduler.date')} value={custom} min={toLocalInput(now)} onChange={event => setCustom(event.target.value)} />
        <button type="button" className="tag active" disabled={!custom} onClick={() => schedule(new Date(custom).getTime())}><Check size={14} /> {t('scheduler.confirm')}</button>
      </div>
      <input className="scheduler-note" value={note} maxLength={200} placeholder={t('scheduler.notePlaceholder')} aria-label={t('scheduler.note')} onChange={event => setNote(event.target.value)} />
      <button type="button" className="scheduler-cancel" onClick={() => setOpen(false)}>{t('action.cancel')}</button>
    </div>
  );
}
