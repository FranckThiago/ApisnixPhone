/**
 * Phone or computer layout. « Automatique » follows the screen width, as before;
 * a forced choice is remembered by this browser only (Franck, 23 Nov 2026).
 * The effective layout lands on <html data-layout>, which app.css reads instead of a width query.
 */
export type LayoutMode = 'auto' | 'mobile' | 'desktop';

const LAYOUT_KEY = 'apisnixphone.layout';
/** Same width as before the setting existed: at or under it, the phone view. */
const NARROW = '(max-width: 920px)';
const EVENT = 'apisnixphone:layout';

let mode: LayoutMode = 'auto';
let listening = false;

function update() {
  const mobile = mode === 'mobile' || (mode === 'auto' && matchMedia(NARROW).matches);
  const value = mobile ? 'mobile' : 'desktop';
  const root = document.documentElement;
  if (root.dataset.layout === value) return;
  root.dataset.layout = value;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Applies a layout without remembering it. Called by every entry point before rendering,
 * so the CSS always has a layout to read; the embed and the native module stay automatic.
 */
export function startLayout(next: LayoutMode = 'auto') {
  mode = next;
  if (!listening) { matchMedia(NARROW).addEventListener('change', update); listening = true; }
  update();
}

/** The person's choice in Settings: applied at once and remembered. */
export function applyLayout(next: LayoutMode) {
  startLayout(next);
  try { if (next === 'auto') localStorage.removeItem(LAYOUT_KEY); else localStorage.setItem(LAYOUT_KEY, next); } catch { /* private mode */ }
}

export function storedLayout(): LayoutMode {
  try {
    const value = localStorage.getItem(LAYOUT_KEY);
    return value === 'mobile' || value === 'desktop' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

export function isMobileLayout(): boolean {
  return document.documentElement.dataset.layout === 'mobile';
}

/** Calls back when the effective layout flips; returns the unsubscribe. */
export function onLayoutChange(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
