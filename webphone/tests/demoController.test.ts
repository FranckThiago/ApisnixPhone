import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoPhoneController } from '../src/telephony/DemoPhoneController';

describe('demo controller', () => {
  let phone: DemoPhoneController;
  beforeEach(async () => {
    vi.useFakeTimers();
    phone = new DemoPhoneController();
    const ready = phone.connect({ username: 'demo', password: 'x' });
    await vi.advanceTimersByTimeAsync(1100);
    await ready;
  });
  afterEach(() => vi.useRealTimers());

  it('registers, and refuses empty credentials without retrying', async () => {
    expect(phone.getSnapshot().connection).toBe('ready');
    const other = new DemoPhoneController();
    const attempt = other.connect({ username: 'demo', password: '' });
    await vi.advanceTimersByTimeAsync(1100);
    await attempt;
    expect(other.getSnapshot().connection).toBe('auth-error');
    await vi.advanceTimersByTimeAsync(60000);
    expect(other.getSnapshot().connection).toBe('auth-error');
  });

  it('places one call per click and starts talk time at the answer', async () => {
    phone.call('+33 1 00 00 00 01', '+33100000001');
    phone.call('+33 1 00 00 00 02', '+33100000002');
    expect(phone.getSnapshot().call).toMatchObject({ dialTarget: '+33100000001', phase: 'dialing' });
    await vi.advanceTimersByTimeAsync(900);
    expect(phone.getSnapshot().call?.phase).toBe('ringing-out');
    expect(phone.getSnapshot().call?.answeredAt).toBeUndefined();
    await vi.advanceTimersByTimeAsync(3000);
    const call = phone.getSnapshot().call!;
    expect(call.phase).toBe('active');
    expect(call.answeredAt! - call.startedAt).toBeGreaterThanOrEqual(3000);
    phone.hangup();
    expect(phone.getSnapshot().call).toMatchObject({ phase: 'ended', outcome: 'answered' });
    phone.dismiss();
    expect(phone.getSnapshot().call).toBeNull();
  });

  it('reports busy, no answer and cancelled; an outgoing call is never missed', async () => {
    phone.call('x', '+33100000009');
    await vi.advanceTimersByTimeAsync(3000);
    expect(phone.getSnapshot().call?.outcome).toBe('busy');
    expect(phone.getSnapshot().call?.answeredAt).toBeUndefined();
    phone.dismiss();
    phone.call('x', '+33100000008');
    await vi.advanceTimersByTimeAsync(9500);
    expect(phone.getSnapshot().call?.outcome).toBe('no-answer');
    phone.dismiss();
    phone.call('x', '+33100000001');
    await vi.advanceTimersByTimeAsync(1000);
    phone.hangup();
    expect(phone.getSnapshot().call?.outcome).toBe('cancelled');
  });

  it('confirms hold before showing it, and mutes only an established call', async () => {
    phone.call('x', '+33100000001');
    phone.setMuted(true);
    expect(phone.getSnapshot().call?.muted).toBe(false);
    await vi.advanceTimersByTimeAsync(3600);
    phone.setMuted(true);
    phone.setHeld(true);
    expect(phone.getSnapshot().call).toMatchObject({ phase: 'active', holdPending: true, muted: true });
    await vi.advanceTimersByTimeAsync(600);
    expect(phone.getSnapshot().call).toMatchObject({ phase: 'held', holdPending: false });
    phone.sendDtmf('5');
    expect(phone.getSnapshot().call?.dtmf).toBe('');
    phone.setHeld(false);
    await vi.advanceTimersByTimeAsync(600);
    phone.sendDtmf('5');
    phone.sendDtmf('#');
    phone.sendDtmf('<');
    expect(phone.getSnapshot().call?.dtmf).toBe('5#');
  });

  it('never answers an incoming call by itself', async () => {
    expect(phone.simulateIncoming('+2250000000001', '<img src=x>')).toBe(true);
    expect(phone.simulateIncoming('+2250000000002')).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(phone.getSnapshot().call).toMatchObject({ phase: 'ringing-in', remoteName: '<img src=x>' });
    await vi.advanceTimersByTimeAsync(16000);
    expect(phone.getSnapshot().call?.outcome).toBe('missed');
    phone.dismiss();
    phone.simulateIncoming('+2250000000001');
    phone.decline();
    expect(phone.getSnapshot().call?.outcome).toBe('declined');
  });

  it('frees the call and the account on disconnect', async () => {
    phone.call('x', '+33100000001');
    await phone.disconnect();
    await vi.advanceTimersByTimeAsync(10000);
    expect(phone.getSnapshot()).toMatchObject({ connection: 'offline', call: null, account: null });
  });
});
