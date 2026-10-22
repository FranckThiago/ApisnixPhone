import { AlarmClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { useId, useState } from 'react';
import { useApp } from '../../app/AppContext';
import { useNow } from '../../app/clock';
import { calendarDays, formatDue, parseCallbackMoment, quickOptions, toLocalInput } from '../../domain/callbacks';
import { dateFormat, useI18n } from '../../i18n';

/** Choose a moment, review it, then explicitly save the callback. */
export function CallbackScheduler({ number, name, tone = 'page', onScheduled }: { number: string; name?: string; tone?: 'page' | 'call'; onScheduled?(): void }) {
  const { store, notify } = useApp();
  const { t } = useI18n();
  const now = useNow();
  const summaryId = useId();
  const hourId = useId();
  const minuteId = useId();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [month, setMonth] = useState('');
  const [note, setNote] = useState('');
  const today = toLocalInput(now).slice(0, 10);
  const dueAt = parseCallbackMoment(date, time);
  const future = Number.isFinite(dueAt) && dueAt > now;

  const choose = (stamp: number) => {
    const value = toLocalInput(stamp);
    setDate(value.slice(0, 10));
    setTime(value.slice(11));
    setMonth(value.slice(0, 7));
  };
  const schedule = (confirmedNow: number) => {
    // Recheck the real clock at confirmation, even after an inactive tab resumes.
    if (!Number.isFinite(dueAt) || dueAt <= confirmedNow) return notify(t('scheduler.future'), 'danger');
    store.scheduleCallback({ number, name, dueAt, note: note.trim() || undefined });
    notify(t('scheduler.planned', { when: formatDue(dueAt, confirmedNow).toLowerCase() }), 'success');
    setOpen(false);
    setNote('');
    onScheduled?.();
  };

  if (!open) return <button type="button" className={tone === 'call' ? 'ghost-call' : 'ghost'} onClick={() => { choose(Date.now() + 15 * 60_000); setOpen(true); }}><AlarmClock size={16} /> {t('scheduler.open')}</button>;

  const monthStart = new Date(`${month}-01T12:00`);
  const changeMonth = (offset: number) => setMonth(toLocalInput(new Date(monthStart.getFullYear(), monthStart.getMonth() + offset, 1, 12).getTime()).slice(0, 7));
  const zone = dateFormat({ timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value ?? '';

  return (
    <div className={`scheduler scheduler-${tone}`} role="group" aria-label={t('scheduler.open')}>
      <p className="scheduler-title"><AlarmClock size={18} /> {t('scheduler.title', { name: name ?? number })}</p>
      <p className="scheduler-help">{t('scheduler.help')}</p>
      <div className="scheduler-presets" role="group" aria-label={t('scheduler.shortcuts')}>
        {quickOptions(now).map(option => <button key={option.label} type="button" aria-pressed={`${date}T${time}` === toLocalInput(option.at)} onClick={() => choose(option.at)}>{option.label}</button>)}
      </div>
      <div className="scheduler-calendar" role="group" aria-label={t('scheduler.chooseDate')}>
        <div className="scheduler-month">
          <button type="button" className="icon-button" aria-label={t('scheduler.previousMonth')} disabled={month <= today.slice(0, 7)} onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
          <b aria-live="polite">{dateFormat({ month: 'long', year: 'numeric' }).format(monthStart)}</b>
          <button type="button" className="icon-button" aria-label={t('scheduler.nextMonth')} onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
        </div>
        <div className="scheduler-days">
          {Array.from({ length: 7 }, (_, day) => <span key={day} className="scheduler-weekday" aria-hidden="true">{dateFormat({ weekday: 'short' }).format(new Date(2026, 0, 5 + day))}</span>)}
          {calendarDays(month).map((day, index) => day ? <button key={day} type="button" disabled={day < today} aria-pressed={day === date} aria-current={day === today ? 'date' : undefined}
            aria-label={dateFormat({ dateStyle: 'full' }).format(new Date(`${day}T12:00`))} onClick={() => setDate(day)}>{Number(day.slice(8))}</button> : <span key={`blank-${index}`} />)}
        </div>
      </div>
      <div className="scheduler-time">
        <span><Clock3 size={16} /> {t('scheduler.chooseTime')}</span>
        <div className="scheduler-time-fields">
          <div><label htmlFor={hourId}>{t('scheduler.hours')}</label><select id={hourId} value={time.slice(0, 2)} onChange={event => setTime(`${event.target.value}:${time.slice(3)}`)}>
            {Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')).map(hour => <option key={hour} value={hour}>{hour}</option>)}
          </select></div>
          <span aria-hidden="true">:</span>
          <div><label htmlFor={minuteId}>{t('scheduler.minutes')}</label><select id={minuteId} value={time.slice(3)} onChange={event => setTime(`${time.slice(0, 2)}:${event.target.value}`)}>
            {Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0')).map(minute => <option key={minute} value={minute}>{minute}</option>)}
          </select></div>
        </div>
        <small>{t('scheduler.localTime', { zone })}</small>
      </div>
      <label className="scheduler-note-label">{t('scheduler.notePlaceholder')}
        <input value={note} maxLength={200} aria-label={t('scheduler.note')} onChange={event => setNote(event.target.value)} />
      </label>
      <div className="scheduler-summary" id={summaryId} aria-live="polite">
        <CalendarDays size={18} />
        {future ? <span>{t('scheduler.summary')}<strong>{dateFormat({ dateStyle: 'full', timeStyle: 'short' }).format(dueAt)}</strong></span> : <span className="scheduler-error">{t('scheduler.future')}</span>}
      </div>
      <button type="button" className="primary scheduler-confirm" disabled={!future} aria-describedby={summaryId} onClick={() => schedule(Date.now())}><Check size={17} /> {t('scheduler.save')}</button>
      <button type="button" className="scheduler-cancel" onClick={() => setOpen(false)}>{t('action.cancel')}</button>
    </div>
  );
}
