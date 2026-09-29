import { DEFAULT_PREFERENCES, type CallOutcome, type CallRecord, type Contact } from '../domain/types';
import { t, type MessageKey } from '../i18n';
import type { AppData } from '../storage/DataStore';

// Entirely fictional people and numbers, shown only under the « Démonstration » label.
// Notes and shared names are keys: the sample data is written in the language chosen at sign-in.
const PEOPLE: Array<[string | MessageKey, string, string, boolean, MessageKey?]> = [
  ['Camille Martin', 'Atelier Lumen', '+33 1 00 00 00 01', true, 'demo.noteCamille'],
  ['Alex Laurent', 'Nordia Conseil', '+32 2 000 00 01', true],
  ['Sarah Moreau', 'Studio Océane', '+33 1 00 00 00 02', false],
  ['demo.teamAbidjan', 'Baobab Services', '+225 00 00 00 00 01', true, 'demo.noteAbidjan'],
  ['Yann Kouassi', 'Baobab Services', '+225 00 00 00 00 02', false],
  ['Nadia Essomba', 'Wouri Logistique', '+237 600 00 00 01', true],
  ['Marc Tremblay', 'Érable & Cie', '+1 416 555 0100', false],
  ['Inès Haddad', 'Atlas Voyages', '+212 500 00 00 01', false],
  ['Lucas Meyer', 'Alpen Digital', '+41 22 000 00 01', false],
  ['demo.reception', 'APISNIX', '1001', false],
];

export function demoSeed(now = Date.now()): AppData {
  const contacts: Contact[] = PEOPLE.map(([name, company, value, favorite, note], index) => ({
    id: `demo-contact-${index}`, name: name.startsWith('demo.') ? t(name as MessageKey) : name, company, favorite, note: note && t(note),
    numbers: [{ label: t(index === 9 ? 'demo.extension' : 'demo.office'), value }], createdAt: now, updatedAt: now,
  }));
  const script: Array<[number, number, 'outbound' | 'inbound', CallOutcome, number, string[]?, MessageKey?]> = [
    [0, 18, 'outbound', 'answered', 258, ['Intéressé'], 'demo.noteQuote'],
    [1, 47, 'inbound', 'answered', 166],
    [2, 64, 'inbound', 'missed', 0],
    [3, 146, 'outbound', 'answered', 369, ['Rendez-vous']],
    [5, 171, 'outbound', 'no-answer', 0, ['À rappeler']],
    [0, 175, 'outbound', 'answered', 202],
    [6, 236, 'outbound', 'busy', 0],
    [2, 251, 'outbound', 'answered', 114],
    [7, 1500, 'outbound', 'answered', 431, ['Intéressé']],
    [4, 1560, 'inbound', 'answered', 95],
    [8, 1610, 'outbound', 'cancelled', 0],
    [1, 1700, 'inbound', 'missed', 0],
    [3, 2950, 'outbound', 'answered', 512],
    [9, 3010, 'outbound', 'answered', 41],
    [5, 3100, 'inbound', 'answered', 288, ['Rendez-vous']],
  ];
  const calls: CallRecord[] = script.map(([person, minutesAgo, direction, outcome, seconds, tags, note], index) => {
    const startedAt = now - minutesAgo * 60_000;
    const answeredAt = outcome === 'answered' ? startedAt + 7000 : undefined;
    const contact = contacts[person]!;
    return {
      id: `demo-call-${index}`, direction, outcome, startedAt, answeredAt, tags: tags ?? [], note: note && t(note),
      dialTarget: contact.numbers[0]!.value.replace(/\s/g, ''), remoteName: undefined,
      endedAt: (answeredAt ?? startedAt + 12_000) + seconds * 1000,
    };
  });
  // An unknown number, to show the « add to contacts » path.
  calls.splice(3, 0, { id: 'demo-call-x', direction: 'inbound', outcome: 'answered', dialTarget: '+221300000001', tags: [],
                       startedAt: now - 98 * 60_000, answeredAt: now - 98 * 60_000 + 5000, endedAt: now - 96 * 60_000 });
  const callbacks = [
    { id: 'demo-cb-0', number: '+237 600 00 00 01', name: 'Nadia Essomba', dueAt: now - 20 * 60_000, note: t('demo.noteNoAnswer'), createdAt: now - 171 * 60_000 },
    { id: 'demo-cb-1', number: '+33 1 00 00 00 01', name: 'Camille Martin', dueAt: now + 95 * 60_000, note: t('demo.noteConfirm'), createdAt: now - 18 * 60_000 },
    { id: 'demo-cb-2', number: '+1 416 555 0100', name: 'Marc Tremblay', dueAt: now + 26 * 3_600_000, createdAt: now - 236 * 60_000 },
  ];
  return { schema: 1, contacts, calls, callbacks, preferences: { ...DEFAULT_PREFERENCES } };
}

export const DEMO_CALLERS: Array<[string, string?]> = [['+33100000002', undefined], ['+221300000001', undefined], ['+2250000000002', undefined]];
