import { describe, expect, it } from 'vitest';
import { describeNumber, filterDialCharacters, parseDialInput } from '../src/domain/numbers';

describe('dial input', () => {
  it('keeps digits, zeros, + and extensions exactly', () => {
    expect(parseDialInput('+33 1 00 00 00 01').dialTarget).toBe('+33100000001');
    expect(parseDialInput('06 99 00 (01)-02').dialTarget).toBe('0699000102');
    expect(parseDialInput('0033100000001').dialTarget).toBe('0033100000001');
    expect(parseDialInput('699000102').dialTarget).toBe('699000102');
    expect(parseDialInput('*72#').dialTarget).toBe('*72#');
    expect(parseDialInput('8523').dialTarget).toBe('8523');
  });

  it('never adds a prefix and rejects what is not a number', () => {
    for (const raw of ['699000102', '0699000102', '1001']) expect(parseDialInput(raw).dialTarget.startsWith('+')).toBe(false);
    expect(parseDialInput('').reason).toBe('empty');
    expect(parseDialInput('sip:bob@example.org').reason).toBe('characters');
    expect(parseDialInput('12+34').reason).toBe('plus');
    expect(parseDialInput('+').valid).toBe(false);
    expect(parseDialInput('1' + String.fromCharCode(0) + '2').valid).toBe(false);
    expect(filterDialCharacters('<b>+33 1</b> 02;x')).toBe('+33 1 02');
  });
});

describe('display metadata', () => {
  it('finds France and Cameroon without touching the dialled digits', () => {
    expect(describeNumber('+33100000001')).toMatchObject({ kind: 'international', country: 'FR', countryName: 'France' });
    expect(describeNumber('+237699000102')).toMatchObject({ country: 'CM', countryName: 'Cameroun' });
    expect(describeNumber('00237699000102')).toMatchObject({ country: 'CM', display: '00237699000102' });
  });

  it('does not guess a country for a shared code, a national or an internal number', () => {
    expect(describeNumber('+1').country).toBeUndefined();
    expect(describeNumber('+12').country).toBeUndefined();
    expect(describeNumber('+14165550100').country).toBe('CA');
    expect(describeNumber('0699000102').kind).toBe('national');
    expect(describeNumber('0699000102').country).toBeUndefined();
    expect(describeNumber('8523').kind).toBe('internal');
    expect(describeNumber('8523').country).toBeUndefined();
    expect(describeNumber('*72#').kind).toBe('unknown');
  });
});
