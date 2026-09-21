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

/** After an explicit sign-out, a reload must show the form instead of signing back in. */
export async function forgetSilentAccess() {
  await container?.preventSilentAccess().catch(() => undefined);
}
