import { afterEach, describe, expect, it } from 'vitest';
import { formatDue, quickOptions } from '../src/domain/callbacks';
import { formatDay } from '../src/domain/format';
import { countryLabel, describeNumber } from '../src/domain/numbers';
import { CALL_TAGS, outcomeLabel, tagLabel } from '../src/domain/types';
import { language, LANGUAGES, MESSAGES, setLanguage, t, tp, type Language } from '../src/i18n';
import { HttpRecordingsSource } from '../src/recordings/client';
import { demoSeed } from '../src/telephony/demoSeed';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe('languages', () => {
  afterEach(() => setLanguage('fr'));

  it('starts in French and offers English and Spanish under their own names', () => {
    expect(language()).toBe('fr');
    expect(LANGUAGES.map(({ id, name }) => `${id}:${name}`)).toEqual(['fr:Français', 'en:English', 'es:Español']);
  });

  it('translates every sentence, with the same placeholders in each language', () => {
    for (const [key, french] of Object.entries(MESSAGES.fr)) {
      for (const other of ['en', 'es'] as Language[]) {
        const text = MESSAGES[other][key as keyof typeof MESSAGES.fr];
        expect(text.trim(), `${other} ${key}`).not.toBe('');
        expect(placeholders(text), `${other} ${key}`).toEqual(placeholders(french));
      }
    }
  });

  it('switches the words, the plurals and the dates together', () => {
    const monday = new Date(2026, 8, 28, 10, 0).getTime();
    setLanguage('en');
    expect(t('login.submit')).toBe('Sign in');
    expect(tp('rec.ready', 1)).toBe('1 file available');
    expect(tp('rec.ready', 0)).toBe('0 files available');
    expect(formatDay(monday, monday)).toBe('Today');
    expect(formatDay(monday - 3 * 86_400_000, monday)).toBe('Friday 25 September');
    expect(quickOptions(monday).map(option => option.label)).toContain('Tomorrow 9 am');
    expect(formatDue(monday + 86_400_000, monday)).toBe('Tomorrow 10:00');
    setLanguage('es');
    expect(t('login.submit')).toBe('Iniciar sesión');
    expect(formatDay(monday - 86_400_000, monday)).toBe('Ayer');
    expect(outcomeLabel('missed')).toBe('Perdida');
    setLanguage('fr');
    // French keeps the singular for zero.
    expect(tp('rec.ready', 0)).toBe('0 fichier disponible');
  });

  it('names countries in the chosen language, never changing the number', () => {
    setLanguage('en');
    expect(describeNumber('41442201515')).toMatchObject({ country: 'CH', countryName: 'Switzerland', display: '41442201515' });
    expect(countryLabel(describeNumber('1001'))).toBe('Internal number');
    setLanguage('es');
    expect(describeNumber('+237699000102').countryName).toBe('Camerún');
  });

  it('keeps tags stored under their French name and shows them translated', () => {
    setLanguage('en');
    expect(CALL_TAGS.map(tagLabel)).toEqual(['Interested', 'Call back', 'Meeting', 'Not interested', 'Wrong number', 'Voicemail']);
    expect(tagLabel('Libre')).toBe('Libre');
    const seed = demoSeed(Date.now());
    expect(seed.calls.flatMap(call => call.tags).every(tag => (CALL_TAGS as readonly string[]).includes(tag))).toBe(true);
    expect(seed.calls.find(call => call.note)?.note).toBe('Quote to send before Friday.');
  });

  it('translates the recordings service refusal outside French, and keeps its own sentence in French', async () => {
    const refusing = async () => new Response(JSON.stringify({ error: 'Accès refusé.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    const source = new HttpRecordingsSource('/api', refusing);
    await expect(source.list('today')).rejects.toMatchObject({ message: 'Accès refusé.' });
    setLanguage('es');
    await expect(source.list('today')).rejects.toMatchObject({ message: 'El servicio de grabaciones rechazó la solicitud (403).' });
  });
});
