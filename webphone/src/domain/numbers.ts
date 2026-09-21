import { AsYouType, type CountryCode } from 'libphonenumber-js';

/**
 * What the user typed, what will really be dialled, and display-only metadata
 * are kept apart: the digits, the + and leading zeros are never rewritten.
 */
export interface DialInput {
  rawInput: string;
  dialTarget: string;
  valid: boolean;
  reason?: 'empty' | 'characters' | 'plus' | 'length';
}

export interface NumberInfo {
  kind: 'international' | 'national' | 'internal' | 'unknown';
  country?: CountryCode;
  countryName?: string;
  /** Pretty version for reading only; never send it to the phone. */
  display: string;
}

const VISUAL_SEPARATORS = /[\s\u00a0().-]/g;
const regionNames = new Intl.DisplayNames(['fr'], { type: 'region' });

export function parseDialInput(rawInput: string): DialInput {
  const dialTarget = rawInput.replace(VISUAL_SEPARATORS, '');
  if (!dialTarget) return { rawInput, dialTarget, valid: false, reason: 'empty' };
  if (!/^[+\d*#]+$/.test(dialTarget)) return { rawInput, dialTarget, valid: false, reason: 'characters' };
  if (dialTarget.lastIndexOf('+') > 0) return { rawInput, dialTarget, valid: false, reason: 'plus' };
  if (dialTarget.length > 32 || dialTarget === '+') return { rawInput, dialTarget, valid: false, reason: 'length' };
  return { rawInput, dialTarget, valid: true };
}

/** Keeps only what a keypad or a paste may add to the dial field. */
export function filterDialCharacters(value: string): string {
  return value.replace(/[^\d+*#\s().-]/g, '').slice(0, 40);
}

export function countryName(country: CountryCode | undefined): string | undefined {
  if (!country) return undefined;
  try {
    return regionNames.of(country) ?? country;
  } catch {
    return country;
  }
}

/** Canadian area codes supplied by APISNIX; any other +1 code is read as the United States unless the metadata knows better. */
const CANADIAN_AREA_CODES = new Set([
  '204', '226', '236', '249', '250', '289', '306', '343', '365', '367', '368', '403', '416', '418', '431', '437', '438', '450',
  '506', '514', '519', '548', '579', '581', '587', '600', '604', '613', '639', '647', '672', '705', '709', '778', '780', '782',
  '819', '825', '879', '888', '902', '905',
]);

/** Country of the PBX's national dial plan: a number typed `06…` is a French national number here. */
export const NATIONAL_COUNTRY: CountryCode = 'FR';

function northAmerica(digitsAfterOne: string): CountryCode | undefined {
  const area = digitsAfterOne.slice(0, 3);
  if (area.length < 3) return 'CA';
  if (CANADIAN_AREA_CODES.has(area)) return 'CA';
  const typer = new AsYouType();
  typer.input('+1' + digitsAfterOne);
  // Caribbean and other members of the +1 plan keep their own flag.
  const known = typer.getCountry();
  return known && known !== 'CA' ? known : 'US';
}

/**
 * Display only: the flag describes the numbering plan of the number, not where
 * the person is, and nothing here ever changes the digits that are dialled.
 */
export function describeNumber(dialTarget: string): NumberInfo {
  if (!dialTarget || /[*#]/.test(dialTarget)) return { kind: 'unknown', display: dialTarget };
  // `00` is only read as an international prefix to show a country; the dialled digits stay `00…`.
  const international = dialTarget.startsWith('+') ? dialTarget : dialTarget.startsWith('00') ? '+' + dialTarget.slice(2) : null;
  if (international) {
    const typer = new AsYouType();
    const formatted = typer.input(international);
    const country = international.startsWith('+1') ? northAmerica(international.slice(2)) : typer.getCountry();
    return { kind: 'international', country, countryName: countryName(country), display: dialTarget.startsWith('+') ? formatted : dialTarget };
  }
  // `1` followed by an area code (2–9): North American number typed without the +. `1001` stays an extension.
  if (/^1[2-9]\d{2}/.test(dialTarget)) {
    const country = northAmerica(dialTarget.slice(1));
    return { kind: 'international', country, countryName: countryName(country), display: dialTarget };
  }
  // A leading 0 is the national format of the PBX's country.
  if (/^0[1-9]/.test(dialTarget)) return { kind: 'national', country: NATIONAL_COUNTRY, countryName: countryName(NATIONAL_COUNTRY), display: dialTarget };
  if (dialTarget.length <= 6) return { kind: 'internal', display: dialTarget };
  return { kind: 'national', display: dialTarget };
}

export function sameNumber(a: string, b: string): boolean {
  return parseDialInput(a).dialTarget === parseDialInput(b).dialTarget;
}

export function countryLabel(info: NumberInfo): string {
  if (info.countryName) return info.countryName;
  if (info.kind === 'internal') return 'Numéro interne';
  if (info.kind === 'national') return 'Numéro national';
  return 'Pays non déterminé';
}
