import { describe, expect, it } from 'vitest';
import { describeNumber, incomingNumber, filterDialCharacters, parseDialInput } from '../src/domain/numbers';

describe('dial input', () => {
  it('adapts leading + while preserving national zeros and carrier/service prefixes', () => {
    expect(parseDialInput('+33 1 00 00 00 01').dialTarget).toBe('0033100000001');
    expect(parseDialInput('06 99 00 (01)-02').dialTarget).toBe('0699000102');
    expect(parseDialInput('0033100000001').dialTarget).toBe('0033100000001');
    expect(parseDialInput('699000102').dialTarget).toBe('699000102');
    expect(parseDialInput('*72#').dialTarget).toBe('*72#');
    expect(parseDialInput('+1 514 555 0100').dialTarget).toBe('15145550100');
    expect(parseDialInput('+41 44 220 15 15').dialTarget).toBe('41442201515');
    expect(parseDialInput('90033100000001').dialTarget).toBe('90033100000001');
    expect(parseDialInput('815145550100').dialTarget).toBe('815145550100');
    expect(parseDialInput('+*72').valid).toBe(false);
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

  it('reads a long number without + and without 0 as carrying its country code, as the PBX dials abroad', () => {
    expect(describeNumber('41442201515')).toMatchObject({ kind: 'international', country: 'CH', countryName: 'Suisse', display: '41442201515' });
    expect(describeNumber('33612345678')).toMatchObject({ country: 'FR', display: '33612345678' });
    expect(describeNumber('237699000102')).toMatchObject({ country: 'CM', display: '237699000102' });
    expect(describeNumber('0442201515')).toMatchObject({ kind: 'national', country: 'FR' });
    expect(describeNumber('414422').kind).toBe('internal');
  });

  it('reads a leading 0 as France and a leading 1 as North America, Canada told apart from the USA', () => {
    expect(describeNumber('0612345678')).toMatchObject({ kind: 'national', country: 'FR', display: '0612345678' });
    expect(describeNumber('06').country).toBe('FR');
    for (const target of ['1514', '15145550100', '+15145550100', '0015145550100', '18195550100', '14165550100']) expect(describeNumber(target).country).toBe('CA');
    for (const target of ['1212', '12125550100', '+12125550100', '13055550100']) expect(describeNumber(target).country).toBe('US');
    expect(describeNumber('+18095550100').country).toBe('DO');
    expect(describeNumber('+1').country).toBe('CA');
    expect(describeNumber('15145550100').display).toBe('15145550100');
  });

  it('does not guess a country for an extension, a service code or an unknown plan', () => {
    expect(describeNumber('1001').kind).toBe('internal');
    expect(describeNumber('1001').country).toBeUndefined();
    expect(describeNumber('8523').kind).toBe('internal');
    expect(describeNumber('8523').country).toBeUndefined();
    expect(describeNumber('999000102')).toMatchObject({ kind: 'international', country: undefined });
    expect(describeNumber('*72#').kind).toBe('unknown');
  });
});

// Synthetic numbers only: incoming national IDs do not become US numbers.
it('leaves incoming national formats unknown without altering caller IDs or explicit international codes', () => {
  for (const number of ['612345678', '123456789']) {
    expect(describeNumber(number, 'inbound')).toMatchObject({ kind: 'unknown', display: number });
  }
  expect(describeNumber('15145550100', 'inbound').country).toBe('CA');
  expect(describeNumber('12125550100', 'inbound').country).toBe('US');
  expect(describeNumber('+41220000001', 'inbound').country).toBe('CH');
  expect(describeNumber('1001', 'inbound').country).toBeUndefined();
  expect(describeNumber('90033123456789', 'outbound')).toMatchObject({ country: 'FR', display: '90033123456789' });
  expect(describeNumber(parseDialInput('+33123456789').dialTarget).country).toBe('FR');
});

// Fictional Canadian subscriber; both national and explicit international forms.
it('does not mistake a Canadian national ID for Peru, nor a French one for another country', () => {
  for (const value of ['5145550100', '4185550100', '2125550100', '123456789', '0612345678']) {
    expect(describeNumber(value, 'inbound')).toMatchObject({ kind: 'unknown', display: value });
    expect(describeNumber(value, 'inbound').country).toBeUndefined();
  }
  expect(describeNumber('+15145550100', 'inbound').country).toBe('CA');
  expect(describeNumber('0015145550100', 'inbound').country).toBe('CA');
  expect(describeNumber('+51987654321', 'inbound').country).toBe('PE');
  expect(describeNumber('33612345678', 'inbound').country).toBe('FR');
  expect(describeNumber('+1514', 'inbound').country).toBeUndefined();
  expect(describeNumber('0612345678', 'outbound').country).toBe('FR');
});

it('recovers only a complete, valid and concordant provider identity', () => {
  expect(incomingNumber('5145550100', ['+15145550100'])).toBe('+15145550100');
  expect(incomingNumber('5145550100', ['15145550100'])).toBe('+15145550100');
  expect(incomingNumber('612345678', ['0033612345678'])).toBe('+33612345678');
  expect(incomingNumber('0612345678', ['+33612345678'])).toBe('+33612345678');
  expect(incomingNumber('+15145550100', ['+12125550100'])).toBe('+15145550100');
  for (const candidates of [[], ['Canada'], ['+12125550100'], ['call +15145550100'], ['+1514']]) {
    expect(incomingNumber('5145550100', candidates)).toBe('5145550100');
  }
  expect(incomingNumber('anonymous', ['+15145550100'])).toBe('anonymous');
  expect(incomingNumber('1001', ['+15145550100'])).toBe('1001');
  // Both +1 and +51 can validate: conflicting evidence must not choose one.
  expect(incomingNumber('5143650100', ['+15143650100', '+5143650100'])).toBe('5143650100');
});
