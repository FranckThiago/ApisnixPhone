import { describe, expect, it } from 'vitest';
import { customerNumber, describeNumber, parseDialInput, sameNumber } from '../src/domain/numbers';
import { DataStore, emptyData } from '../src/storage/DataStore';

describe('France carrier selector 633', () => {
  it('keeps country, display and recall consistent for old journal formats', () => {
    for (const number of ['633612345678', '+633612345678', '00633612345678', '+63 36 12 34 56 78']) {
      expect(customerNumber(number)).toBe('33612345678');
      expect(describeNumber(number)).toMatchObject({ country: 'FR', display: '33612345678' });
      expect(describeNumber(number, 'inbound')).toMatchObject({ country: 'FR' });
      expect(parseDialInput(number).dialTarget).toBe('33612345678');
      expect(sameNumber(number, '33612345678')).toBe(true);
    }
  });
  it('does not alter extensions, other selectors or incomplete numbers', () => {
    for (const number of ['633', '63361234567', '6336123456789', '633012345678', '0612345678', '+237699000001', '90033612345678', '*633#', '632123456789']) {
      expect(customerNumber(number)).toBe(number);
    }
  });
  it('repairs saved journal and callbacks without losing annotations or IDs', async () => {
    const old = emptyData(); const now = Date.now();
    old.calls = [{ id:'old', direction:'outbound', dialTarget:'633612345678', startedAt:now, endedAt:now, outcome:'answered', tags:['important'], note:'keep' }];
    old.callbacks = [{ id:'reminder', number:'633612345678', dueAt:now, createdAt:now, note:'keep too' }];
    const store = new DataStore({ server:true, load:async()=>old, save:async()=>{}, clear:async()=>{} });
    await store.open('line', true);
    expect(store.getSnapshot().calls[0]).toEqual({ ...old.calls[0], dialTarget:'33612345678' });
    expect(store.getSnapshot().callbacks[0]).toEqual({ ...old.callbacks[0], number:'33612345678' });
    expect(store.completeCallbacksFor('33612345678')).toBe(1);
    await store.flush();
  });
});
