import { describe, expect, it } from 'vitest';
import { createSerialRefresh } from '../src/team/serialRefresh';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('team refresh', () => {
  it('runs a refresh asked during another one, and its caller waits for it', async () => {
    const gates = [deferred(), deferred()];
    let calls = 0;
    const serial = createSerialRefresh();
    const refresh = () => serial(() => gates[calls++]!.promise, () => true);
    const periodic = refresh();
    let afterAction = false;
    const action = refresh().then(() => { afterAction = true; });
    expect(calls).toBe(1);
    gates[0]!.resolve();
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toBe(2);
    expect(afterAction).toBe(false);
    gates[1]!.resolve();
    await Promise.all([periodic, action]);
    expect(afterAction).toBe(true);
    expect(calls).toBe(2);
  });

  it('coalesces several requests into one follow-up and stops when access closes', async () => {
    let active = true;
    const gate = deferred();
    let calls = 0;
    const serial = createSerialRefresh();
    const refresh = () => serial(() => { calls++; return calls === 1 ? gate.promise : Promise.resolve(); }, () => active);
    const first = refresh();
    void refresh(); void refresh();
    active = false;
    gate.resolve();
    await first;
    expect(calls).toBe(1);
    expect(await refresh()).toBeUndefined();
    expect(calls).toBe(1);
  });
});
