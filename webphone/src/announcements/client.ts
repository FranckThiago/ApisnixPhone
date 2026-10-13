import { t } from '../i18n';

/** Announcement kinds as written in the PBX administration; anything else is shown as information. */
export const ANNOUNCEMENT_TYPES = ['info', 'astuce', 'facture', 'maj', 'alerte'] as const;
export type AnnouncementType = typeof ANNOUNCEMENT_TYPES[number];

/** One announcement written by APISNIX, as served by the PBX page `annonces.json.php?cible=telephone`. */
export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  /** Plain text with `\n` line breaks. Never HTML: it is always rendered as text. */
  text: string;
  /** Empty, or an http(s) address opened in a new tab. */
  link: string;
  linkLabel: string;
  /** « AAAA-MM-JJ HH:MM » of the last edit: an edited announcement shows again after being hidden. */
  updatedAt: string;
}

export const MAX_ANNOUNCEMENTS = 10;
/** Same bounds as the supervision relay, so every screen shows the same thing. */
const LIMITS = { id: 40, type: 20, titre: 120, texte: 1000, lien: 300, lien_libelle: 60, maj: 20 } as const;

function field(item: Record<string, unknown>, key: keyof typeof LIMITS): string {
  const value = item[key];
  return (typeof value === 'string' || typeof value === 'number' ? String(value) : '').slice(0, LIMITS[key]).trim();
}

/**
 * Keeps only well-formed announcements: an id, a title or a text, bounded fields, a known type
 * (information otherwise), http(s) links only, ten at most. Never throws, whatever the PBX served.
 */
export function parseAnnouncements(raw: unknown): Announcement[] {
  if (!Array.isArray(raw)) return [];
  const list: Announcement[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (list.length >= MAX_ANNOUNCEMENTS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const id = field(record, 'id');
    const title = field(record, 'titre');
    const text = field(record, 'texte').replace(/\r\n?/g, '\n');
    if (!id || seen.has(id) || (!title && !text)) continue;
    const type = field(record, 'type');
    const link = field(record, 'lien');
    seen.add(id);
    list.push({
      id, title, text,
      type: (ANNOUNCEMENT_TYPES as readonly string[]).includes(type) ? type as AnnouncementType : 'info',
      link: /^https?:\/\/\S+$/i.test(link) ? link : '',
      linkLabel: field(record, 'lien_libelle'),
      updatedAt: field(record, 'maj'),
    });
  }
  return list;
}

/** Key prefix shared with the agent screen and the supervision: one browser hides an announcement everywhere alike. */
export const SEEN_KEY_PREFIX = 'apisnix-annonce-vue-';

/** The subset of `localStorage` the hiding needs; tests give a map, private windows may give nothing. */
export interface SeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function localSeenStore(): SeenStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Hidden by this browser at its current version. Alerts never hide. A refusing storage hides nothing. */
export function isHidden(announcement: Announcement, storage: SeenStore | null): boolean {
  if (announcement.type === 'alerte' || !storage) return false;
  try {
    return storage.getItem(SEEN_KEY_PREFIX + announcement.id) === announcement.updatedAt;
  } catch {
    return false;
  }
}

/** Remembers the version read, so the same announcement comes back only once APISNIX edits it. */
export function hideAnnouncement(announcement: Announcement, storage: SeenStore | null): void {
  if (announcement.type === 'alerte') return;
  try {
    storage?.setItem(SEEN_KEY_PREFIX + announcement.id, announcement.updatedAt);
  } catch {
    /* Private window or full storage: hidden for this session only. */
  }
}

export interface AnnouncementsSource {
  /** The current list, or null when it could not be fetched: the previous list then stays on screen. */
  load(): Promise<Announcement[] | null>;
}

/** Reads the public PBX page directly; its origin is allowed by the site's connection policy. Every failure is silent. */
export class HttpAnnouncementsSource implements AnnouncementsSource {
  constructor(private readonly url: string, private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async load(): Promise<Announcement[] | null> {
    try {
      const response = await this.fetchImpl(this.url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      return parseAnnouncements(await response.json());
    } catch {
      return null;
    }
  }
}

/** Fictional cards for the demonstration, which never calls the network. */
export class DemoAnnouncementsSource implements AnnouncementsSource {
  async load(): Promise<Announcement[]> {
    return [
      { id: 'demo-astuce', type: 'astuce', title: t('annonces.demoTipTitle'), text: t('annonces.demoTipText'), link: '', linkLabel: '', updatedAt: '2026-10-13 10:00' },
      { id: 'demo-maj', type: 'maj', title: t('annonces.demoUpdateTitle'), text: t('annonces.demoUpdateText'), link: '', linkLabel: '', updatedAt: '2026-10-13 10:00' },
    ];
  }
}

/** The PBX page listing the announcements meant for the web phone, next to the block-status page. */
export function announcementsUrlFromEnv(env: ImportMetaEnv): string {
  const explicit = String(env.VITE_ANNOUNCEMENTS_URL ?? '').trim();
  if (explicit) return explicit;
  return `https://${String(env.VITE_SIP_DOMAIN ?? '').trim()}/agc/apisnix/annonces.json.php?cible=telephone`;
}

export const REFRESH_INTERVAL = 10 * 60_000;

/**
 * Loads once, then every ten minutes while the page is visible. A failed load keeps the previous
 * list: the cards are a courtesy and must never flicker or disturb a call. Returns the stop function.
 */
export function watchAnnouncements(source: AnnouncementsSource, onList: (list: Announcement[]) => void,
  hidden: () => boolean = () => document.hidden, every = REFRESH_INTERVAL): () => void {
  let stopped = false;
  const load = async () => {
    const list = await source.load();
    if (!stopped && list) onList(list);
  };
  void load();
  const timer = setInterval(() => { if (!hidden()) void load(); }, every);
  return () => { stopped = true; clearInterval(timer); };
}
