import { describe, expect, it } from 'vitest';
import type { Workspace } from './client';
import { allowedView, screenOn } from './screens';

const workspace = (features?: Workspace['policy']['features']): Workspace => ({
  endpoint_id: 'e', assignment_version: 1, team_id: 't', policy: { shared_enabled: true, transfers_enabled: true, features },
  resources: [], help: [], peers: [],
});

describe('phone screens a supervisor can switch off', () => {
  it('stay on while the policy is unknown or silent', () => {
    for (const value of [null, undefined, workspace(), workspace({}), workspace({ journal: true, audio: true, contacts: true })])
      for (const key of ['journal', 'contacts', 'audio'] as const) expect(screenOn(value, key)).toBe(true);
  });
  it('are off only when the server says so', () => {
    const off = workspace({ journal: false, audio: false });
    expect(screenOn(off, 'journal')).toBe(false);
    expect(screenOn(off, 'audio')).toBe(false);
    expect(screenOn(off, 'contacts')).toBe(true);
  });
  it('send a switched-off view to one that is allowed', () => {
    expect(allowedView('journal', workspace({ journal: false }))).toBe('callbacks');
    expect(allowedView('audio', workspace({ audio: false }))).toBe('journal');
    expect(allowedView('contacts', workspace({ contacts: false, journal: false }))).toBe('callbacks');
    for (const view of ['journal', 'contacts', 'audio', 'phone', 'settings', 'callbacks'] as const) expect(allowedView(view, null)).toBe(view);
    expect(allowedView('phone', workspace({ journal: false, audio: false, contacts: false }))).toBe('phone');
  });
});
