import { describe, expect, it } from 'vitest';
import { icaoHexToCountry } from '../src/icao-country';

describe('icaoHexToCountry', () => {
  it('resolves representative ICAO 24-bit blocks across the world', () => {
    expect(icaoHexToCountry('4cac24')).toBe('Ireland'); // RYR (Ryanair)
    expect(icaoHexToCountry('ac308f')).toBe('United States'); // N-registered
    expect(icaoHexToCountry('4840d6')).toBe('Netherlands'); // KLM
    expect(icaoHexToCountry('8a01ff')).toBe('Indonesia');
    expect(icaoHexToCountry('899139')).toBe('Taiwan'); // distinct from China's block
    expect(icaoHexToCountry('780abc')).toBe('China');
    expect(icaoHexToCountry('7c1234')).toBe('Australia');
    expect(icaoHexToCountry('e48000')).toBe('Brazil');
    expect(icaoHexToCountry('c01234')).toBe('Canada');
  });

  it('is case-insensitive and tolerates the 0x prefix', () => {
    expect(icaoHexToCountry('AC308F')).toBe('United States');
    expect(icaoHexToCountry('0x4cac24')).toBe('Ireland');
  });

  it('returns empty string for unallocated or unparseable addresses', () => {
    expect(icaoHexToCountry('')).toBe('');
    expect(icaoHexToCountry(undefined)).toBe('');
    expect(icaoHexToCountry('zzzz')).toBe('');
    expect(icaoHexToCountry('200000')).toBe(''); // gap between allocated blocks
  });
});
