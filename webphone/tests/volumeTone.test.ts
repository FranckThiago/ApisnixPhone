import { describe, expect, it } from 'vitest';
import { MAX_VOLUME, volumeTone } from '../src/domain/types';

describe('volumeTone', () => {
  it('is green from 70 %, up to the amplified top', () => {
    expect(volumeTone(70)).toBe('ok');
    expect(volumeTone(100)).toBe('ok');
    expect(volumeTone(MAX_VOLUME)).toBe('ok');
  });
  it('is orange between 40 and 69 %', () => {
    expect(volumeTone(40)).toBe('warn');
    expect(volumeTone(65)).toBe('warn');
  });
  it('is red below 40 %', () => {
    expect(volumeTone(35)).toBe('bad');
    expect(volumeTone(0)).toBe('bad');
  });
});
