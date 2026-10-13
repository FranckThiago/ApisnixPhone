import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announcementsUrlFromEnv, DemoAnnouncementsSource, hideAnnouncement, HttpAnnouncementsSource, isHidden, MAX_ANNOUNCEMENTS, parseAnnouncements, SEEN_KEY_PREFIX, watchAnnouncements, type Announcement, type SeenStore } from '../src/announcements/client';
import { AnnouncementList } from '../src/features/announcements/Announcements';
import { setLanguage } from '../src/i18n';

// The two announcements on line on 13 October 2026, as the PBX serves them.
const served = [
  { id: 'a1013003', type: 'astuce', titre: 'Appeler en France : trois façons d’écrire le numéro', texte: 'Pour joindre un numéro français :\n- 0 puis le numéro\n- 33 puis le numéro sans le 0', lien: '', lien_libelle: '', maj: '2026-10-13 11:43' },
  { id: 'a1013001', type: 'maj', titre: 'Nouveautés de l’écran agent', texte: 'Pendant un appel, le clavier envoie les chiffres au serveur vocal.', lien: '', lien_libelle: '', maj: '2026-10-13 10:40' },
];

function memoryStore(): SeenStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

const tip: Announcement = { id: 'a1', type: 'astuce', title: 'Astuce', text: 'Ligne 1\nLigne 2', link: '', linkLabel: '', updatedAt: '2026-10-13 11:43' };
const alert: Announcement = { ...tip, id: 'a2', type: 'alerte', title: 'Alerte' };
const render = (items: Announcement[]) => renderToStaticMarkup(createElement(AnnouncementList, { items, onHide: () => undefined }));

describe('announcements feed', () => {
  it('keeps the announcements as served, with their line breaks as plain text', () => {
    expect(parseAnnouncements(served)).toEqual([
      { id: 'a1013003', type: 'astuce', title: 'Appeler en France : trois façons d’écrire le numéro', text: 'Pour joindre un numéro français :\n- 0 puis le numéro\n- 33 puis le numéro sans le 0', link: '', linkLabel: '', updatedAt: '2026-10-13 11:43' },
      { id: 'a1013001', type: 'maj', title: 'Nouveautés de l’écran agent', text: 'Pendant un appel, le clavier envoie les chiffres au serveur vocal.', link: '', linkLabel: '', updatedAt: '2026-10-13 10:40' },
    ]);
  });

  it('drops malformed data without throwing', () => {
    for (const bad of [null, undefined, 'texte', 42, {}, [null, 'x', 7, [], {}, { titre: 'sans identifiant' }, { id: 'vide' }, { id: 'a', titre: '   ' }]])
      expect(parseAnnouncements(bad)).toEqual([]);
    expect(parseAnnouncements([{ id: 'dup', titre: 'Un' }, { id: 'dup', titre: 'Deux' }])).toHaveLength(1);
  });

  it('bounds the fields, shows unknown kinds as information and keeps http(s) links only', () => {
    const [weird, scripted, long] = parseAnnouncements([
      { id: 1013, type: 'promo', titre: 'Titre', texte: 'a\r\nb\rc', lien: 'https://apisnix-crm.com/aide', lien_libelle: 'Lire', maj: 20261013 },
      { id: 'js', type: 'info', titre: 'Lien refusé', lien: 'javascript:alert(1)' },
      { id: 'long', type: 'alerte', titre: 'T'.repeat(500), texte: 'x'.repeat(2000), lien: 'ftp://no', lien_libelle: 'L'.repeat(100) },
    ]);
    expect(weird).toEqual({ id: '1013', type: 'info', title: 'Titre', text: 'a\nb\nc', link: 'https://apisnix-crm.com/aide', linkLabel: 'Lire', updatedAt: '20261013' });
    expect(scripted!.link).toBe('');
    expect(long).toMatchObject({ type: 'alerte', link: '' });
    expect(long!.title).toHaveLength(120);
    expect(long!.text).toHaveLength(1000);
    expect(long!.linkLabel).toHaveLength(60);
  });

  it('shows ten announcements at most', () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ id: `n${index}`, titre: `Annonce ${index}` }));
    const list = parseAnnouncements(many);
    expect(list).toHaveLength(MAX_ANNOUNCEMENTS);
    expect(list[0]!.id).toBe('n0');
  });
});

describe('announcements hiding', () => {
  it('hides an announcement for this browser under the shared key, and shows it again once edited', () => {
    const storage = memoryStore();
    expect(isHidden(tip, storage)).toBe(false);
    hideAnnouncement(tip, storage);
    expect(storage.map.get(SEEN_KEY_PREFIX + 'a1')).toBe('2026-10-13 11:43');
    expect(isHidden(tip, storage)).toBe(true);
    expect(isHidden({ ...tip, updatedAt: '2026-10-14 09:00' }, storage)).toBe(false);
  });

  it('never hides an alert', () => {
    const storage = memoryStore();
    hideAnnouncement(alert, storage);
    expect(storage.map.size).toBe(0);
    storage.map.set(SEEN_KEY_PREFIX + 'a2', alert.updatedAt);
    expect(isHidden(alert, storage)).toBe(false);
  });

  it('tolerates a browser that refuses to store anything', () => {
    const refusing: SeenStore = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceeded'); } };
    expect(() => hideAnnouncement(tip, refusing)).not.toThrow();
    expect(isHidden(tip, refusing)).toBe(false);
    expect(isHidden(tip, null)).toBe(false);
  });
});

describe('announcements loading', () => {
  afterEach(() => vi.useRealTimers());

  it('parses a good answer, and stays silent on network failure, HTTP errors and invalid JSON', async () => {
    const answers: Array<() => Promise<Response>> = [
      async () => new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      async () => { throw new TypeError('Failed to fetch'); },
      async () => new Response('Service Unavailable', { status: 503 }),
      async () => new Response('<html>pas du JSON</html>', { status: 200 }),
    ];
    const urls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => { urls.push(String(input)); return answers.shift()!(); }) as typeof fetch;
    const source = new HttpAnnouncementsSource('https://pbx.example/agc/apisnix/annonces.json.php?cible=telephone', fetchImpl);
    expect((await source.load())?.map(item => item.id)).toEqual(['a1013003', 'a1013001']);
    expect(await source.load()).toBeNull();
    expect(await source.load()).toBeNull();
    expect(await source.load()).toBeNull();
    expect(new Set(urls)).toEqual(new Set(['https://pbx.example/agc/apisnix/annonces.json.php?cible=telephone']));
  });

  it('loads at once, then every ten minutes while the page is visible, keeping the last list on failure', async () => {
    vi.useFakeTimers();
    const lists: Array<Announcement[] | null> = [[tip], null, [tip, alert], [alert]];
    const load = vi.fn(async () => lists.shift() ?? null);
    const shown: Announcement[][] = [];
    let hidden = false;
    const stop = watchAnnouncements({ load }, list => shown.push(list), () => hidden, 600_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(shown).toEqual([[tip]]);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(shown).toEqual([[tip]]);
    hidden = true;
    await vi.advanceTimersByTimeAsync(600_000);
    expect(load).toHaveBeenCalledTimes(2);
    hidden = false;
    await vi.advanceTimersByTimeAsync(600_000);
    expect(shown).toEqual([[tip], [tip, alert]]);
    stop();
    await vi.advanceTimersByTimeAsync(1_200_000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('reads the PBX page of the SIP domain unless another address is given', () => {
    expect(announcementsUrlFromEnv({ VITE_SIP_DOMAIN: 'apisnix-crm.com' } as ImportMetaEnv)).toBe('https://apisnix-crm.com/agc/apisnix/annonces.json.php?cible=telephone');
    expect(announcementsUrlFromEnv({ VITE_SIP_DOMAIN: 'apisnix-crm.com', VITE_ANNOUNCEMENTS_URL: ' https://autre.example/annonces.json ' } as ImportMetaEnv)).toBe('https://autre.example/annonces.json');
  });

  it('gives the demonstration fictional cards in the chosen language, without any network', async () => {
    setLanguage('es');
    const cards = await new DemoAnnouncementsSource().load();
    setLanguage('fr');
    expect(cards.map(card => card.type)).toEqual(['astuce', 'maj']);
    expect(cards[0]!.title).toBe('Atajos durante una llamada');
  });
});

describe('announcements rendering', () => {
  afterEach(() => setLanguage('fr'));

  it('renders the title in bold, the text with line breaks, and escapes everything', () => {
    const html = render([{ ...tip, title: 'Titre <b>gras</b>', text: 'Ligne 1\n<script>alert(1)</script>\nLigne 3' }]);
    expect(html).toContain('<strong>Titre &lt;b&gt;gras&lt;/b&gt;</strong>');
    expect(html).toContain('Ligne 1<br/>&lt;script&gt;alert(1)&lt;/script&gt;<br/>Ligne 3');
    expect(html).not.toContain('<script>');
    expect(html).toContain('annonce annonce-astuce');
    expect(html).toContain('💡');
    expect(render([])).toBe('');
  });

  it('opens the link in a new tab without opener, labelled by the announcement or by default', () => {
    const labelled = render([{ ...tip, link: 'https://apisnix-crm.com/factures', linkLabel: 'Voir la facture' }]);
    expect(labelled).toContain('<a class="annonce-link" href="https://apisnix-crm.com/factures" target="_blank" rel="noopener noreferrer">Voir la facture</a>');
    expect(render([{ ...tip, link: 'https://apisnix-crm.com/aide' }])).toContain('>En savoir plus</a>');
    expect(render([tip])).not.toContain('<a ');
  });

  it('offers « Masquer » on everything but an alert, in the chosen language', () => {
    const html = render([tip, alert]);
    expect(html.match(/aria-label="Masquer"/g)).toHaveLength(1);
    expect(html).toContain('annonce annonce-alerte');
    expect(html).toContain('⚠️');
    setLanguage('en');
    const english = render([tip]);
    expect(english).toContain('aria-label="Hide"');
    expect(english).toContain('APISNIX announcements');
  });
});
