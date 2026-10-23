import type { PhoneSnapshot, CallSnapshot } from '../telephony/types';
import type { PublicCall, PublicState, ResultCode } from './protocol';
import { parseDialInput } from '../domain/numbers';
export function publicState(snapshot: PhoneSnapshot, sessionOpen: boolean): PublicState {
  return { connection: snapshot.connection, phone: sessionOpen ? snapshot.account?.username ?? null : null,
    sessionOpen, demo: snapshot.demo, inCall: [snapshot.call, snapshot.otherCall].some(call => call && call.phase !== 'ended') };
}
export function publicCall(call: CallSnapshot): PublicCall {
  return { id: call.id, direction: call.direction, number: call.dialTarget, phase: call.phase,
    startedAt: call.startedAt, answeredAt: call.answeredAt, endedAt: call.endedAt, outcome: call.outcome };
}
export function prepareResult(number: string, snapshot: PhoneSnapshot, sessionOpen: boolean): ResultCode {
  if (!sessionOpen || snapshot.connection !== 'ready') return 'not-connected';
  if ([snapshot.call, snapshot.otherCall].some(call => call && call.phase !== 'ended')) return 'call-in-progress';
  if (number.length > 40 || !parseDialInput(number).valid) return 'invalid-number';
  return 'prepared';
}
