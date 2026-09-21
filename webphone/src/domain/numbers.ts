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

/**
 * The flag describes the numbering plan of the number, not where the person is.
 * A shared calling code (+1…) stays undetermined until the digits settle it.
 */
export function describeNumber(dialTarget: string): NumberInfo {
  if (!dialTarget || /[*#]/.test(dialTarget)) return { kind: 'unknown', display: dialTarget };
  // `00` is only read as an international prefix to show a country; the dialled digits stay `00…`.
  const international = dialTarget.startsWith('+') ? dialTarget : dialTarget.startsWith('00') ? '+' + dialTarget.slice(2) : null;
  if (international) {
    const typer = new AsYouType();
    const formatted = typer.input(international);
    const country = typer.getCountry();
    return {
      kind: 'international',
      country,
      countryName: countryName(country),
      display: dialTarget.startsWith('+') ? formatted : dialTarget,
    };
  }
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
