import { describe, expect, it } from 'vitest';
import { groupCallbacks, quickOptions, toLocalInput } from '../src/domain/callbacks';
import { DataStore } from '../src/storage/DataStore';

describe('callbacks', () => {
  it('offers sensible delays in the future', () => {
    const tuesdayMorning = new Date(2026, 8, 22, 10, 30).getTime();
    const options = quickOptions(tuesdayMorning);
    expect(options.map(option => option.label)).toEqual(['Dans 15 min', 'Dans 1 h', 'Cet après-midi 14 h', 'Demain 9 h', 'Lundi 9 h']);
    expect(options.every(option => option.at > tuesdayMorning)).toBe(true);
    expect(new Date(options[4]!.at).getDay()).toBe(1);
    const sundayEvening = new Date(2026, 8, 27, 19, 0).getTime();
    expect(quickOptions(sundayEvening).map(option => option.label)).toEqual(['Dans 15 min', 'Dans 1 h', 'Demain 9 h']);
    expect(toLocalInput(tuesdayMorning)).toBe('2026-09-22T10:30');
  });

  it('sorts into overdue, today, upcoming and done, and closes them once the person is reached', async () => {
    const store = new DataStore();
    await store.open('p', false);
    const now = new Date(2026, 8, 22, 10, 0).getTime();
    store.scheduleCallback({ number: '+33 1 00 00 00 01', dueAt: now - 60_000, name: 'Camille' });
    store.scheduleCallback({ number: '+33 1 00 00 00 01', dueAt: now + 3_600_000 });
    store.scheduleCallback({ number: '0612345678', dueAt: now + 30 * 3_600_000 });
    let groups = groupCallbacks(store.getSnapshot().callbacks, now);
    expect([groups.overdue.length, groups.today.length, groups.upcoming.length, groups.done.length]).toEqual([1, 1, 1, 0]);
    expect(store.completeCallbacksFor('+33100000001', now)).toBe(2);
    expect(store.completeCallbacksFor('+33100000001', now)).toBe(0);
    groups = groupCallbacks(store.getSnapshot().callbacks, now);
    expect([groups.overdue.length, groups.today.length, groups.upcoming.length, groups.done.length]).toEqual([0, 0, 1, 2]);
    const later = groups.upcoming[0]!;
    store.updateCallback(later.id, { dueAt: now - 1 });
    expect(groupCallbacks(store.getSnapshot().callbacks, now).overdue).toHaveLength(1);
    store.removeCallback(later.id);
    expect(store.getSnapshot().callbacks).toHaveLength(2);
  });
});
