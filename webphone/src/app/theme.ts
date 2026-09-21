import type { Theme } from '../domain/types';

const THEME_KEY = 'apisnixphone.theme';

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* private mode */ }
}

export function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'dark' || value === 'system' ? value : 'light';
  } catch {
    return 'light';
  }
}
