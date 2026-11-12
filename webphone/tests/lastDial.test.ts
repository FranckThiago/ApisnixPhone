import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLastDial, writeLastDial } from '../src/app/lastDial';

describe('last dialled input kept per line', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('returns the exact input of the same line only, and survives a missing storage', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } });
    writeLastDial('8522', '90033 612345678');
    expect(readLastDial(' 8522 ')).toBe('90033 612345678');
    expect(readLastDial('8523')).toBe('');
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(readLastDial('8522')).toBe(''); expect(() => writeLastDial('8522', '1')).not.toThrow();
  });
});
