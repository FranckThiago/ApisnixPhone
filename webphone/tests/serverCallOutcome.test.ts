import { describe, expect, it } from 'vitest';
import { matchingServerOutcome } from '../src/telephony/serverCallOutcome';
import type { CallSnapshot } from '../src/telephony/types';
import type { LineCall } from '../src/recordings/types';
const call: CallSnapshot = { id: 'browser-call', direction: 'outbound', rawInput: '0100000001', dialTarget: '0100000001', phase: 'ended', muted: false, holdPending: false,
  startedAt: 100000, endedAt: 100500, outcome: 'failed', failure: 'generic', awaitingServerOutcome: true, dtmf: '' };
const observed: LineCall = { id: 'call:server', number: '33100000001', direction: 'outbound', startedAt: 100100, endedAt: 100600, outcome: 'busy' };
describe('correlation with the authenticated own-line journal', () => {
  it('refines a matching completed call and accepts supported number spellings', () => {
    for (const dialTarget of ['0100000001', '33100000001', '+33100000001', '0033100000001'])
      expect(matchingServerOutcome({ ...call, dialTarget }, [observed])).toBe('busy');
    expect(matchingServerOutcome(call, [{ ...observed, outcome: 'no-answer' }])).toBe('no-answer');
  });
  it('never chooses between close retries, including a nearby unfinished one', () => {
    expect(matchingServerOutcome(call, [observed, { ...observed, id: 'other', endedAt: undefined, outcome: 'unknown' }])).toBeUndefined();
  });
  it.each([
    { number: '33100000002' }, { startedAt: 90000 }, { endedAt: 130000 }, { endedAt: undefined },
    { direction: 'inbound' as const }, { outcome: 'unknown' as const }, { outcome: 'answered' as const }, { answeredAt: 100200 },
  ])('ignores a different, old, unfinished or answered server call %j', patch => {
    expect(matchingServerOutcome(call, [{ ...observed, ...patch }])).toBeUndefined();
  });
  it.each([{ awaitingServerOutcome: false }, { phase: 'active' as const }, { direction: 'inbound' as const }, { outcome: 'cancelled' as const }, { answeredAt: 100200 }])('preserves a specific diagnostic or active/local call %j', patch => {
    expect(matchingServerOutcome({ ...call, ...patch }, [observed])).toBeUndefined();
  });
});
