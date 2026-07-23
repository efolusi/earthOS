import { describe, expect, it } from 'vitest';
import { applyExclude, parseExcludeTerms } from '../src/filter';

const catalog = [
  { OBJECT_NAME: 'STARLINK-1007', NORAD_CAT_ID: 44713 },
  { OBJECT_NAME: 'ISS (ZARYA)', NORAD_CAT_ID: 25544 },
  { OBJECT_NAME: 'ONEWEB-0012', NORAD_CAT_ID: 44057 },
  { OBJECT_NAME: 'NOAA 19', NORAD_CAT_ID: 33591 },
  { OBJECT_NAME: 'starlink-4000', NORAD_CAT_ID: 53000 },
];

const names = (records: { OBJECT_NAME?: string }[]) => records.map((r) => r.OBJECT_NAME);

describe('parseExcludeTerms', () => {
  it('splits on commas, trims, and lowercases', () => {
    expect(parseExcludeTerms(' Starlink , ONEWEB ')).toEqual(['starlink', 'oneweb']);
  });

  it('drops blank terms so a trailing comma is harmless', () => {
    expect(parseExcludeTerms('starlink,,  ,')).toEqual(['starlink']);
  });

  it('treats a non-string (unset setting) as no terms', () => {
    expect(parseExcludeTerms(undefined)).toEqual([]);
    expect(parseExcludeTerms(null)).toEqual([]);
  });
});

describe('applyExclude', () => {
  it('hides every entry whose name contains the term, regardless of case', () => {
    // Both STARLINK-1007 and starlink-4000 must go: the catalog is not
    // consistently cased, so a case-sensitive match would leak objects through.
    expect(names(applyExclude(catalog, 'starlink'))).toEqual([
      'ISS (ZARYA)',
      'ONEWEB-0012',
      'NOAA 19',
    ]);
  });

  it('hides several constellations at once', () => {
    expect(names(applyExclude(catalog, 'starlink, oneweb'))).toEqual(['ISS (ZARYA)', 'NOAA 19']);
  });

  it('returns the same array when nothing is excluded', () => {
    // Identity matters: the no-filter path is the common one and must not
    // allocate a copy that would churn the renderer on every catalog update.
    expect(applyExclude(catalog, '')).toBe(catalog);
    expect(applyExclude(catalog, '   ')).toBe(catalog);
    expect(applyExclude(catalog, undefined)).toBe(catalog);
  });

  it('keeps records that have no name rather than dropping them', () => {
    const withUnnamed = [{ NORAD_CAT_ID: 1 }, { OBJECT_NAME: 'STARLINK-9', NORAD_CAT_ID: 2 }];
    expect(applyExclude(withUnnamed, 'starlink')).toEqual([{ NORAD_CAT_ID: 1 }]);
  });

  it('matches substrings anywhere, not just as a prefix', () => {
    const odd = [{ OBJECT_NAME: 'TBA - TO BE ASSIGNED (STARLINK)' }, { OBJECT_NAME: 'GPS BIIF-2' }];
    expect(names(applyExclude(odd, 'starlink'))).toEqual(['GPS BIIF-2']);
  });
});
