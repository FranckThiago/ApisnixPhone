import { customerNumber } from '../domain/numbers';
import type { LineCall } from '../recordings/types';
import type { CallSnapshot } from './types';

const numberKey = (value: string) => {
  const digits = customerNumber(value).replace(/[\s().-]/g, '').replace(/^(?:\+|00)/, '');
  return /^0[1-9]\d{8}$/.test(digits) ? '33' + digits.slice(1) : digits;
};

/** A conservative temporal correlation: do not choose between nearby retries. */
export function matchingServerOutcome(call: CallSnapshot, entries: readonly LineCall[]): 'busy' | 'no-answer' | undefined {
  if (!call.awaitingServerOutcome || call.phase !== 'ended' || call.direction !== 'outbound' || call.answeredAt || call.outcome !== 'failed' || !call.endedAt) return;
  const number = numberKey(call.dialTarget);
  if (!number) return;
  const candidates = entries.filter(entry => entry.direction === 'outbound' && numberKey(entry.number) === number
    && Math.abs(entry.startedAt - call.startedAt) <= 1500);
  if (candidates.length !== 1) return;
  const entry = candidates[0]!;
  if (!entry.endedAt || entry.answeredAt || Math.abs(entry.endedAt - call.endedAt) > 2000) return;
  return entry.outcome === 'busy' || entry.outcome === 'no-answer' ? entry.outcome : undefined;
}
