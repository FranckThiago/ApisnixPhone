import { describe, expect, it } from 'vitest';
import { allowedOrigins, authorizedMessage, command, envelope, phoneEvent, phoneHint, PROTOCOL, safeOrigin } from '../src/embed/protocol';
import { prepareResult, publicCall, publicState } from '../src/embed/state';
import type { CallSnapshot, PhoneSnapshot } from '../src/telephony/types';
const parent = {} as Window;
const channel = '12345678-1234-1234-1234-123456789012';
const origin = 'https://crm.example';
const base = { protocol: PROTOCOL, channel };
const call: CallSnapshot = { id: 'call-1', direction: 'outbound', rawInput: '+33100000001', dialTarget: '0033100000001', phase: 'active', muted: false, holdPending: false, startedAt: 100, answeredAt: 200, dtmf: '1234', remoteName: 'Private name', failure: 'Internal error detail' };
const snapshot: PhoneSnapshot = { demo: false, account: { username: '1001', domain: 'private.example' }, connection: 'ready', call: null, error: 'Private debug data' };
describe('embedded origin boundary', () => {
  it('fails closed live, and never grants a wildcard or a URL path', () => {
    expect([...allowedOrigins(undefined, origin, false)]).toEqual([]);
    expect([...allowedOrigins('*, null, https://crm.example/path, http://crm.example, https://user:secret@crm.example', origin, false)]).toEqual([]);
    expect([...allowedOrigins('https://crm.example, https://crm.example/', 'https://phone.example', false)]).toEqual([origin]);
  });
  it('allows local demonstration only on explicit origins including ports', () => {
    expect([...allowedOrigins('http://localhost:5191', 'http://127.0.0.1:5185', true)]).toEqual(['http://localhost:5191', 'http://127.0.0.1:5185']);
    expect(safeOrigin('http://127.0.0.1:5185', false)).toBeNull();
    expect(safeOrigin('https://crm.example?token=secret', false)).toBeNull();
    expect(safeOrigin('https://crm.example#secret', false)).toBeNull();
  });
  it('requires the parent window, exact origin, protocol and channel together', () => {
    const message = { source: parent, origin, data: { ...base, type: 'hello' } };
    expect(authorizedMessage(message, parent, new Set([origin]), channel)).toBe(true);
    for (const patch of [{ origin: 'https://evil.example' }, { origin: 'https://crm.example.evil.test' }, { source: {} as Window }, { source: null }, { data: { ...base, type: 'hello', channel: '00000000-0000-0000' } }, { data: { ...base, protocol: 'other', type: 'hello' } }])
      expect(authorizedMessage({ ...message, ...patch }, parent, new Set([origin]), channel)).toBe(false);
  });
  it('accepts a public phone hint only, never a link with credentials', () => {
    expect(phoneHint('?phone=1001')).toBe('1001');
    expect(phoneHint('?phone=%3Cscript%3E')).toBe('');
    expect(phoneHint('?username=1001&password=secret')).toBe('');
    expect(phoneHint('?phone=' + 'a'.repeat(101))).toBe('');
  });
});
describe('embedded commands and public events', () => {
  it('accepts only bounded prepare-call commands, not credential or call-control commands', () => {
    expect(command({ ...base, type: 'prepare-call', requestId: 'req-1', number: '+33 1 00 00 00 01' })).toBe(true);
    for (const value of [null, [], {}, { ...base, type: 'login', username: '1001', password: 'secret' }, { ...base, type: 'call', number: '1001' }, { ...base, type: 'prepare-call', requestId: 'req-1', number: '1'.repeat(41) }, { ...base, type: 'prepare-call', requestId: 'req-1', number: 1001 }]) expect(command(value)).toBe(false);
    expect(envelope({ ...base, channel: '*', type: 'hello' })).toBe(false);
  });
  it('requires both a session and a ready line; protects both ongoing calls', () => {
    expect(prepareResult('1001', snapshot, true)).toBe('prepared');
    expect(prepareResult('1001', snapshot, false)).toBe('not-connected');
    expect(prepareResult('1001', { ...snapshot, connection: 'reconnecting' }, true)).toBe('not-connected');
    expect(prepareResult('1001', { ...snapshot, call }, true)).toBe('call-in-progress');
    expect(prepareResult('1001', { ...snapshot, otherCall: call }, true)).toBe('call-in-progress');
    expect(prepareResult('<script>', snapshot, true)).toBe('invalid-number');
    expect(prepareResult('+', snapshot, true)).toBe('invalid-number');
  });
  it('exports a small allowlist, without raw SIP, passwords, contacts, DTMF or failures', () => {
    expect(publicState(snapshot, true)).toEqual({ connection: 'ready', phone: '1001', sessionOpen: true, demo: false, inCall: false });
    expect(publicState(snapshot, false).phone).toBeNull();
    expect(publicState({ ...snapshot, otherCall: call }, true).inCall).toBe(true);
    expect(publicCall(call)).toEqual({ id: 'call-1', direction: 'outbound', number: '0033100000001', phase: 'active', startedAt: 100, answeredAt: 200, endedAt: undefined, outcome: undefined });
    expect(JSON.stringify(publicCall(call))).not.toContain('Private');
    expect(JSON.stringify(publicState(snapshot, true))).not.toContain('private.example');
  });
  it('validates incoming SDK events instead of trusting arbitrary message data', () => {
    expect(phoneEvent({ ...base, type: 'state', state: publicState(snapshot, true) })).toBe(true);
    expect(phoneEvent({ ...base, type: 'call', call: publicCall(call) })).toBe(true);
    expect(phoneEvent({ ...base, type: 'result', requestId: 'req-1', code: 'prepared' })).toBe(true);
    expect(phoneEvent({ ...base, type: 'state', state: {} })).toBe(false);
    expect(phoneEvent({ ...base, type: 'call', call: null })).toBe(false);
    expect(phoneEvent({ ...base, type: 'result', requestId: 'req-1', code: 'unknown' })).toBe(false);
  });
});
