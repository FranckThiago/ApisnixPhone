import { dayKey } from './format';
import type { Callback } from './types';

export interface QuickOption { label: string; at: number }

function at(base: Date, days: number, hour: number): number {
  const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, 0, 0, 0);
  return date.getTime();
}

/** One-tap delays, the way people actually say them on the phone. */
export function quickOptions(now: number): QuickOption[] {
  const today = new Date(now);
  const options: QuickOption[] = [
    { label: 'Dans 15 min', at: now + 15 * 60_000 },
    { label: 'Dans 1 h', at: now + 60 * 60_000 },
  ];
  if (today.getHours() < 13) options.push({ label: 'Cet après-midi 14 h', at: at(today, 0, 14) });
  options.push({ label: 'Demain 9 h', at: at(today, 1, 9) });
  // Next Monday, or the one after when today is already Monday.
  const untilMonday = ((8 - today.getDay()) % 7) || 7;
  if (untilMonday > 1) options.push({ label: 'Lundi 9 h', at: at(today, untilMonday, 9) });
  return options;
}

export interface CallbackGroups { overdue: Callback[]; today: Callback[]; upcoming: Callback[]; done: Callback[] }

export function groupCallbacks(callbacks: Callback[], now: number): CallbackGroups {
  const pending = callbacks.filter(callback => !callback.doneAt).sort((a, b) => a.dueAt - b.dueAt);
  return {
    overdue: pending.filter(callback => callback.dueAt <= now),
    today: pending.filter(callback => callback.dueAt > now && dayKey(callback.dueAt) === dayKey(now)),
    upcoming: pending.filter(callback => callback.dueAt > now && dayKey(callback.dueAt) !== dayKey(now)),
    done: callbacks.filter(callback => callback.doneAt).sort((a, b) => b.doneAt! - a.doneAt!).slice(0, 20),
  };
}

const dateTime = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const timeOnly = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function formatDue(dueAt: number, now: number): string {
  if (dayKey(dueAt) === dayKey(now)) return `Aujourd’hui ${timeOnly.format(dueAt)}`;
  if (dayKey(dueAt) === dayKey(now + 86_400_000)) return `Demain ${timeOnly.format(dueAt)}`;
  return dateTime.format(dueAt);
}

/** Value for an `<input type="datetime-local">`, in local time. */
export function toLocalInput(stamp: number): string {
  const date = new Date(stamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
