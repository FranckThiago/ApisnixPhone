import { sessionFetch } from '../http/embeddedSession';

/** The authenticated line selects its group; never accept an endpoint or team from the browser. */
export async function loadCallTags(base: string, fetchImpl: typeof fetch = sessionFetch): Promise<readonly string[]> {
  const response = await fetchImpl(base.replace(/\/$/, '') + '/qualifications', {
    credentials: 'include', signal: AbortSignal.timeout(10000), cache: 'no-store',
  });
  if (!response.ok) throw new Error('Qualification catalogue unavailable');
  const data: unknown = await response.json();
  const teams = (data as { teams?: unknown })?.teams;
  if (!Array.isArray(teams) || teams.length !== 1) throw new Error('Invalid qualification scope');
  const labels: unknown = teams[0]?.labels;
  if (!Array.isArray(labels) || labels.length < 6 || labels.length > 30
    || !labels.every(label => typeof label === 'string' && label.length > 0 && label.length <= 200)
    || new Set(labels).size !== labels.length) throw new Error('Invalid qualification catalogue');
  return labels;
}
