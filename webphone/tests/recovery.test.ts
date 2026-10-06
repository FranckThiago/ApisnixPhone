import { afterEach, describe, expect, it, vi } from 'vitest';
import { automaticSignInAllowed, clearRecoveryMarker, requireManualSignIn } from '../src/features/auth/recovery';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

function environment(search = '', hash = '') {
  const values = new Map<string, string>();
  const get = vi.fn(async () => ({ type: 'password', id: 'test-line', password: 'test-only' }));
  const replaceState = vi.fn();
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  vi.stubGlobal('location', { search, hash, pathname: '/' });
  vi.stubGlobal('history', { state: null, replaceState });
  vi.stubGlobal('PasswordCredential', class {});
  vi.stubGlobal('navigator', { credentials: { get } });
  return { get, replaceState };
}

describe('manual sign-in recovery', () => {
  it('never queries saved passwords on the manual URL and wipes an attached sign-in fragment', async () => {
    const { get, replaceState } = environment('?connexion=manuelle', '#u=test&p=test-only');
    const { savedCredentials, pendingSignInLink } = await import('../src/features/auth/credentials');
    expect(await savedCredentials()).toBeNull();
    expect(pendingSignInLink()).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/?connexion=manuelle');
  });
  it('does not retry saved access after a display crash, until a manual sign-in succeeds', async () => {
    const { get } = environment();
    requireManualSignIn();
    const { savedCredentials } = await import('../src/features/auth/credentials');
    expect(await savedCredentials()).toBeNull();
    expect(get).not.toHaveBeenCalled();
    clearRecoveryMarker();
    expect(await savedCredentials()).toEqual({ username: 'test-line', password: 'test-only' });
  });
  it('ignores a vault response that arrives after recovery was requested', async () => {
    const { get } = environment();
    let deliver!: (value: { type: string; id: string; password: string }) => void;
    get.mockImplementation(() => new Promise(resolve => { deliver = resolve; }));
    const { savedCredentials } = await import('../src/features/auth/credentials');
    const pending = savedCredentials();
    requireManualSignIn();
    deliver({ type: 'password', id: 'test-line', password: 'test-only' });
    expect(await pending).toBeNull();
  });
  it('preserves normal sign-in links and saved access outside recovery', async () => {
    environment('', '#u=test&p=test-only');
    const { pendingSignInLink, savedCredentials } = await import('../src/features/auth/credentials');
    expect(pendingSignInLink()).toEqual({ username: 'test', password: 'test-only' });
    expect(await savedCredentials()).not.toBeNull();
  });
  it('still offers manual sign-in when browser storage is blocked', () => {
    environment('?connexion=manuelle');
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } });
    expect(() => requireManualSignIn()).not.toThrow();
    expect(() => clearRecoveryMarker()).not.toThrow();
    expect(automaticSignInAllowed()).toBe(false);
  });
});
