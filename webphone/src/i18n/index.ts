import { createElement, Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { en } from './en';
import { es } from './es';
import { fr, type MessageKey } from './fr';

export type { MessageKey } from './fr';
export type Language = 'fr' | 'en' | 'es';

/** Each language is offered under its own name, so anyone finds theirs. French is the default. */
export const LANGUAGES: ReadonlyArray<{ id: Language; name: string }> = [
  { id: 'fr', name: 'Français' }, { id: 'en', name: 'English' }, { id: 'es', name: 'Español' },
];

const LOCALES: Record<Language, string> = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES' };
export const MESSAGES: Record<Language, Record<MessageKey, string>> = { fr, en, es };
const LANGUAGE_KEY = 'apisnixphone.language';

function storedLanguage(): Language {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return value === 'en' || value === 'es' ? value : 'fr';
  } catch {
    return 'fr';
  }
}

// Chosen on the sign-in screen and remembered by this browser, like the theme.
let current: Language = storedLanguage();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const language = () => current;
/** Locale used for dates, times, country names and sorting. */
export const locale = () => LOCALES[current];

export function setLanguage(next: Language) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* private mode */ }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  plurals = new Intl.PluralRules(LOCALES[next]);
  listeners.forEach(notify => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type Params = Record<string, string | number>;

/** The sentence in the current language; `{name}` placeholders are filled from `params`. */
export function t(key: MessageKey, params?: Params): string {
  const template = MESSAGES[current][key] || fr[key];
  return params ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : template;
}

let plurals = new Intl.PluralRules(LOCALES[current]);
type PluralKey = MessageKey extends infer K ? K extends `${infer Base}.one` ? Base : never : never;

/** Singular or plural, by the rule of the language: in French, 0 takes the singular. */
export function tp(key: PluralKey, count: number, params?: Params): string {
  return t(`${key}.${plurals.select(count) === 'one' ? 'one' : 'other'}` as MessageKey, { count, ...params });
}

/** Same as `t`, with placeholders filled by React nodes (a bold word, a link). */
export function rich(key: MessageKey, nodes: Record<string, ReactNode>): ReactNode {
  const parts = t(key).split(/\{(\w+)\}/);
  return createElement(Fragment, null, ...parts.map((part, index) => (index % 2 ? createElement(Fragment, { key: index }, nodes[part] ?? `{${part}}`) : part)));
}

const formats = new Map<string, Intl.DateTimeFormat>();
/** Date and time formatters of the current language, built once each. */
export function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = locale() + JSON.stringify(options);
  let format = formats.get(id);
  if (!format) formats.set(id, format = new Intl.DateTimeFormat(locale(), options));
  return format;
}

/** Re-renders the component when the language changes. */
export function useI18n() {
  const lang = useSyncExternalStore(subscribe, language, language);
  return { language: lang, t, tp, rich };
}
