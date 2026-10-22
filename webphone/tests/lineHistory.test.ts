import { afterEach, describe, expect, it, vi } from 'vitest';
import { missedStamp, unseenMissedCalls, watchLineHistory, type HistoryState } from '../src/recordings/lineHistory';
import type { LineHistory } from '../src/recordings/types';

const journal = (ids = ['offline-1', 'offline-2']): LineHistory => ({ calls: ids.map((id, i) => ({
  id, number: '0100', direction: 'inbound', outcome: 'missed', startedAt: 100 + i, endedAt: 200 + i,
})), truncated: false, catchingUp: false, stale: false });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function setup(history = vi.fn<() => Promise<LineHistory>>().mockResolvedValue(journal())) {
  const page = Object.assign(new EventTarget(), { hidden: false });
  const network = new EventTarget();
  let state: HistoryState | undefined;
  const publish = vi.fn((next: HistoryState) => { state = next; });
  const feed = watchLineHistory({ history }, publish, page, network);
  return { feed, page, network, history, publish, get state() { return state!; } };
}
afterEach(() => vi.useRealTimers());

describe('line history for the journal badge', () => {
  it('counts offline server calls after a delayed connection, without acknowledging them at load', async () => {
    const response = deferred<LineHistory>();
    const env = setup(vi.fn().mockReturnValue(response.promise));
    expect(env.state.history).toBeNull();
    response.resolve(journal()); await response.promise;
    expect(unseenMissedCalls(env.state.history!.calls, 0)).toHaveLength(2);
    expect(env.history).toHaveBeenCalledWith(30);
    env.feed.stop();
  });
  it('does not add a second copy of calls on refresh and keeps new completions unseen', async () => {
    const env = setup(); await env.feed.refresh();
    const seen = Math.max(...env.state.history!.calls.map(missedStamp));
    expect(unseenMissedCalls(env.state.history!.calls, seen)).toHaveLength(0);
    env.history.mockResolvedValue({ ...journal(), calls: [...journal().calls, { ...journal().calls[0]!, id: 'new', endedAt: 250 }] });
    await env.feed.refresh();
    expect(unseenMissedCalls(env.state.history!.calls, seen)).toHaveLength(1);
    await env.feed.refresh();
    expect(unseenMissedCalls(env.state.history!.calls, seen)).toHaveLength(1);
    env.feed.stop();
  });
  it('never counts answered, outgoing unanswered or unknown calls', () => {
    const base = journal().calls[0]!;
    expect(unseenMissedCalls(['answered', 'no-answer', 'busy', 'unknown', 'cancelled'].map(outcome => ({ ...base, outcome })), 0)).toEqual([]);
  });
  it('refreshes on return to the page or network and once a minute while visible', async () => {
    vi.useFakeTimers(); const env = setup(); await env.feed.refresh();
    env.page.hidden = true; await vi.advanceTimersByTimeAsync(60_000);
    expect(env.history).toHaveBeenCalledTimes(1);
    env.page.hidden = false; env.page.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
    env.network.dispatchEvent(new Event('online')); await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.history).toHaveBeenCalledTimes(4);
    env.feed.stop(); await vi.advanceTimersByTimeAsync(60_000);
    env.network.dispatchEvent(new Event('online'));
    expect(env.history).toHaveBeenCalledTimes(4);
  });
  it('preserves the known count on an API failure and recovers on retry', async () => {
    const env = setup(); await env.feed.refresh();
    env.history.mockRejectedValueOnce(new Error('Offline'));
    await env.feed.refresh();
    expect(env.state.error).toBe('Offline');
    expect(unseenMissedCalls(env.state.history!.calls, 0)).toHaveLength(2);
    await env.feed.refresh(); expect(env.state.error).toBe('');
    env.feed.stop();
  });
  it('ignores a late response after logout and keeps the next line isolated', async () => {
    const response = deferred<LineHistory>();
    const first = setup(vi.fn().mockReturnValue(response.promise));
    await first.feed.refresh(); expect(first.history).toHaveBeenCalledTimes(1);
    first.feed.stop();
    const second = setup(vi.fn().mockResolvedValue(journal([]))); await second.feed.refresh();
    response.resolve(journal()); await response.promise;
    expect(first.publish).toHaveBeenCalledTimes(1);
    expect(second.state.history!.calls).toEqual([]);
    second.feed.stop();
  });
});
