export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${String(m).padStart(2, '0')}:${rest}`;
}

export function formatLongDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export const formatTime = (stamp: number) => time.format(stamp);

export function dayKey(stamp: number): string {
  const d = new Date(stamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function formatDay(stamp: number, now = Date.now()): string {
  if (dayKey(stamp) === dayKey(now)) return 'Aujourd’hui';
  if (dayKey(stamp) === dayKey(now - 86_400_000)) return 'Hier';
  const label = day.format(stamp);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Accent-insensitive search on names. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Stable soft colour per name, from a small on-brand palette. */
export function hueFor(value: string): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}
