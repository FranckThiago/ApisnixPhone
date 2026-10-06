import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';
import { locale, t } from '../i18n';

/**
 * What the user typed, what will really be dialled, and display-only metadata
 * are kept apart. A leading + uses the PBX format: +33 becomes 0033, otherwise
 * only + is removed. Carrier prefixes and national zeros stay unchanged.
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
const regionNames = new Map<string, Intl.DisplayNames>();

export function parseDialInput(rawInput: string): DialInput {
  let dialTarget = rawInput.replace(VISUAL_SEPARATORS, '');
  if (!dialTarget) return { rawInput, dialTarget, valid: false, reason: 'empty' };
  if (!/^[+\d*#]+$/.test(dialTarget)) return { rawInput, dialTarget, valid: false, reason: 'characters' };
  if (dialTarget.lastIndexOf('+') > 0) return { rawInput, dialTarget, valid: false, reason: 'plus' };
  if (dialTarget.length > 32 || dialTarget === '+') return { rawInput, dialTarget, valid: false, reason: 'length' };
  if (dialTarget.startsWith('+')) {
    if (!/^\+\d+$/.test(dialTarget)) return { rawInput, dialTarget, valid: false, reason: 'plus' };
    dialTarget = dialTarget.startsWith('+33') ? '00' + dialTarget.slice(1) : dialTarget.slice(1);
  }
  return { rawInput, dialTarget, valid: true };
}

/** Keeps only what a keypad or a paste may add to the dial field. */
export function filterDialCharacters(value: string): string {
  return value.replace(/[^\d+*#\s().-]/g, '').slice(0, 40);
}

/** Country name in the language of the interface, or in the one given. */
export function countryName(country: CountryCode | undefined, language = locale()): string | undefined {
  if (!country) return undefined;
  try {
    let names = regionNames.get(language);
    if (!names) regionNames.set(language, names = new Intl.DisplayNames([language], { type: 'region' }));
    return names.of(country) ?? country;
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

/** Longest number read as an internal extension when it has no country code. */
const INTERNAL_MAX_LENGTH = 6;

/**
 * The number with its country code in front, or null for a national number or
 * an extension. The PBX dials abroad with the bare country code (`41…` =
 * Switzerland), so a long number without + and without a leading 0 carries one.
 */
function withCountryCode(dialTarget: string): string | null {
  if (dialTarget.startsWith('+')) return dialTarget;
  // `00` is only read as an international prefix to show a country; the dialled digits stay `00…`.
  if (dialTarget.startsWith('00')) return '+' + dialTarget.slice(2);
  // `1` followed by an area code (2–9) is North American from the fourth digit. `1001` stays an extension.
  if (/^1[2-9]\d{2}/.test(dialTarget)) return '+' + dialTarget;
  if (!dialTarget.startsWith('0') && dialTarget.length > INTERNAL_MAX_LENGTH) return '+' + dialTarget;
  return null;
}

/**
 * Display only: the flag describes the numbering plan of the number, not where
 * the person is, and nothing here ever changes the digits that are dialled.
 */
export function describeNumber(dialTarget: string, direction?: 'inbound' | 'outbound' | 'unknown'): NumberInfo {
  if (!dialTarget || /[*#]/.test(dialTarget)) return { kind: 'unknown', display: dialTarget };
  // The PBX can deliver a French national caller ID without its trunk zero.
  // Restrict this fallback to incoming, complete nine-digit French numbers;
  // keep the actual caller ID intact and never reinterpret explicit +/00 codes.
  if (direction === 'inbound' && /^[1-9]\d{8}$/.test(dialTarget)
      && parsePhoneNumberFromString('0' + dialTarget, 'FR')?.isValid()) {
    return { kind: 'national', country: 'FR', countryName: countryName('FR'), display: dialTarget };
  }
  // Known France carrier selector: metadata only, the leading 9 is still dialled.
  const countryTarget = /^90033[1-9]\d{8}$/.test(dialTarget) && direction !== 'inbound' ? dialTarget.slice(1) : dialTarget;
  const international = withCountryCode(countryTarget);
  if (international) {
    const typer = new AsYouType();
    const formatted = typer.input(international);
    const country = international.startsWith('+1') ? northAmerica(international.slice(2)) : typer.getCountry();
    // Only a typed + gets the spaced form; `00…` and bare country codes are shown as dialled.
    return { kind: 'international', country, countryName: countryName(country), display: dialTarget.startsWith('+') ? formatted : dialTarget };
  }
  // A leading 0 is the national format of the PBX's country.
  if (/^0[1-9]/.test(dialTarget)) return { kind: 'national', country: NATIONAL_COUNTRY, countryName: countryName(NATIONAL_COUNTRY), display: dialTarget };
  return { kind: 'internal', display: dialTarget };
}

export function sameNumber(a: string, b: string): boolean {
  return parseDialInput(a).dialTarget === parseDialInput(b).dialTarget;
}

export function countryLabel(info: NumberInfo): string {
  if (info.countryName) return info.countryName;
  if (info.kind === 'internal') return t('number.internal');
  if (info.kind === 'national') return t('number.national');
  return t('number.unknownCountry');
}
