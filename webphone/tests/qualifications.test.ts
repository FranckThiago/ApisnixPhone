import { describe, expect, it, vi } from 'vitest';
import { loadCallTags } from '../src/qualifications/client';
import { CALL_TAGS } from '../src/domain/types';

describe('team qualification catalogue', () => {
  it('uses the authenticated line and retains standard and custom labels', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ teams: [{ id: 'own', labels: [...CALL_TAGS, 'Dossier envoyé'] }] }));
    expect(await loadCallTags('/api/', fetcher)).toEqual([...CALL_TAGS, 'Dossier envoyé']);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/qualifications');
  });
  it('rejects a scope with another group and invalid catalogues', async () => {
    for (const teams of [[], [{ labels: CALL_TAGS }, { labels: CALL_TAGS }], [{ labels: ['x'] }], [{ labels: [...CALL_TAGS, null] }]]) {
      await expect(loadCallTags('/api', async () => Response.json({ teams }))).rejects.toThrow();
    }
    await expect(loadCallTags('/api', async () => new Response('', { status: 403 }))).rejects.toThrow();
  });
});
