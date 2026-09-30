import type { Credentials } from '../../telephony/types';

/**
 * The application never stores the password. The browser's own password manager may:
 * the person agrees in the browser's dialog, the secret stays in the browser's vault,
 * and a reload signs back in without typing. Chrome and Edge support this API; elsewhere
 * (Safari, Firefox) the ordinary autofill of the sign-in form does the job.
 */
interface PasswordCredentialLike { id: string; password?: string; type: string }
type PasswordCredentialConstructor = new (data: { id: string; password: string; name?: string }) => PasswordCredentialLike;

const Constructor = (globalThis as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
const container = typeof navigator === 'undefined' ? undefined : navigator.credentials;

export const browserVaultAvailable = Boolean(Constructor && container);

export async function savedCredentials(): Promise<Credentials | null> {
  if (!Constructor || !container) return null;
  try {
    // Silent when one access was saved and the person did not sign out; otherwise the browser asks or returns nothing.
    const found = await container.get({ password: true, mediation: 'optional' } as CredentialRequestOptions) as PasswordCredentialLike | null;
    return found?.type === 'password' && found.password ? { username: found.id, password: found.password } : null;
  } catch {
    return null;
  }
}

export async function offerToSave({ username, password }: Credentials) {
  if (!Constructor || !container) return;
  await container.store(new Constructor({ id: username, password, name: `ApisnixPhone · ${username}` }) as unknown as Credential).catch(() => undefined);
}

/**
 * Sign-in link `https://phone…/#u=<username>&p=<password>`. The fragment never reaches the server.
 * Values are percent-decoded, `+` stays a plus: a password may contain one.
 */
export function parseSignInLink(hash: string): Credentials | null {
  const values = new Map<string, string>();
  for (const pair of hash.replace(/^#/, '').split('&')) {
    const at = pair.indexOf('=');
    if (at < 1) continue;
    const raw = pair.slice(at + 1);
    let value = raw;
    try { value = decodeURIComponent(raw); } catch { /* a lone % is kept as typed */ }
    values.set(pair.slice(0, at), value);
  }
  const username = values.get('u')?.trim();
  const password = values.get('p');
  return username && password ? { username, password } : null;
}

/** Reads the link, then wipes it from the address bar: the password must not stay on screen, in a bookmark or a screen share. */
function takeSignInLink() {
  if (typeof location === 'undefined' || !location.hash) return null;
  const found = parseSignInLink(location.hash);
  history.replaceState(history.state, '', location.pathname + location.search);
  return found;
}

// Read at page load, before anything is drawn.
let linkCredentials = takeSignInLink();

/** The access of the link that opened the page, until it has been sent once. */
export const pendingSignInLink = () => linkCredentials;

/** A sign-out must not be followed by the link signing back in. */
export function consumeSignInLink() {
  linkCredentials = null;
}

// A link pasted into an open tab only changes the fragment, without reloading: wipe it too,
// and hand it to the sign-in form if it is on screen. Once connected, it is simply ignored.
const LINK_EVENT = 'apisnix-sign-in-link';
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const found = takeSignInLink();
    if (found) window.dispatchEvent(new CustomEvent(LINK_EVENT, { detail: found }));
  });
}

export function onSignInLink(listener: (credentials: Credentials) => void) {
  const handle = (event: Event) => listener((event as CustomEvent<Credentials>).detail);
  window.addEventListener(LINK_EVENT, handle);
  return () => window.removeEventListener(LINK_EVENT, handle);
}

/** After an explicit sign-out, a reload must show the form instead of signing back in. */
export async function forgetSilentAccess() {
  await container?.preventSilentAccess().catch(() => undefined);
}
