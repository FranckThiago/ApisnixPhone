import { describe, expect, it } from 'vitest';
import { MAX_VOLUME, volumeTone } from '../src/domain/types';

describe('volumeTone', () => {
  it('is red below 40 %', () => {
    expect(volumeTone(0)).toBe('bad');
    expect(volumeTone(35)).toBe('bad');
  });
  it('is orange between 40 and 69 %', () => {
    expect(volumeTone(40)).toBe('warn');
    expect(volumeTone(65)).toBe('warn');
  });
  it('is green from 70 % to 119 %', () => {
    expect(volumeTone(70)).toBe('ok');
    expect(volumeTone(100)).toBe('ok');
    expect(volumeTone(115)).toBe('ok');
  });
  it('is brown from 120 to 150 %, where amplification starts to carry risks', () => {
    expect(volumeTone(120)).toBe('hot');
    expect(volumeTone(150)).toBe('hot');
  });
  it('is black above 150 %, up to the top', () => {
    expect(volumeTone(155)).toBe('max');
    expect(volumeTone(MAX_VOLUME)).toBe('max');
  });
});
