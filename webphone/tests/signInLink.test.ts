import { describe, expect, it } from 'vitest';
import { buildSignInLink, parseSignInLink } from '../src/features/auth/credentials';

describe('sign-in link', () => {
  it('reads the username and the password from the fragment', () => {
    expect(parseSignInLink('#u=edu001&p=secret')).toEqual({ username: 'edu001', password: 'secret' });
    expect(parseSignInLink('#p=secret&u=edu001')).toEqual({ username: 'edu001', password: 'secret' });
  });

  it('decodes an encoded password and keeps a plus as typed', () => {
    expect(parseSignInLink('#u=edu001&p=a%26b%23c%3Dd%25')).toEqual({ username: 'edu001', password: 'a&b#c=d%' });
    expect(parseSignInLink('#u=edu001&p=a+b')).toEqual({ username: 'edu001', password: 'a+b' });
    expect(parseSignInLink('#u=edu001&p=100%')).toEqual({ username: 'edu001', password: '100%' });
  });

  it('keeps the spaces of a password but not around the username', () => {
    expect(parseSignInLink('#u=%20edu001%20&p=%20pass')).toEqual({ username: 'edu001', password: ' pass' });
  });

  it('needs both values', () => {
    expect(parseSignInLink('')).toBeNull();
    expect(parseSignInLink('#')).toBeNull();
    expect(parseSignInLink('#u=edu001')).toBeNull();
    expect(parseSignInLink('#p=secret')).toBeNull();
    expect(parseSignInLink('#u=&p=secret')).toBeNull();
    expect(parseSignInLink('#user=edu001&pass=secret')).toBeNull();
  });
});

describe('sign-in link generator', () => {
  it('builds a link the phone reads back exactly', () => {
    const credentials = { username: 'edu001', password: 'a&b#c=d%e+f g/é' };
    const link = buildSignInLink('https://phone.apisnix-crm.com', credentials);
    expect(link.startsWith('https://phone.apisnix-crm.com/#u=edu001&p=')).toBe(true);
    expect(parseSignInLink(new URL(link).hash)).toEqual(credentials);
  });

  it('writes a plain password as it is', () => {
    expect(buildSignInLink('https://phone.apisnix-crm.com', { username: ' edu001 ', password: 'Abc123' })).toBe('https://phone.apisnix-crm.com/#u=edu001&p=Abc123');
  });
});
