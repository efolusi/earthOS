import { describe, expect, it } from 'vitest';
import {
  moonEquatorial,
  subsolarPoint,
  sublunarPoint,
  sunEquatorial,
  terminatorRing,
  equatorialToSceneDir,
} from '../src/astronomy';
import { haversineKm } from '../src/geodesy';

describe('subsolar point', () => {
  it('sits near the equator at the March 2026 equinox', () => {
    // Equinox 2026-03-20 ~14:46 UTC.
    const { latDeg } = subsolarPoint(Date.UTC(2026, 2, 20, 14, 46));
    expect(Math.abs(latDeg)).toBeLessThan(0.5);
  });

  it('reaches ~+23.4 at the June solstice and ~-23.4 in December', () => {
    const june = subsolarPoint(Date.UTC(2026, 5, 21, 12));
    const dec = subsolarPoint(Date.UTC(2026, 11, 21, 12));
    expect(june.latDeg).toBeGreaterThan(23);
    expect(june.latDeg).toBeLessThan(23.9);
    expect(dec.latDeg).toBeLessThan(-23);
    expect(dec.latDeg).toBeGreaterThan(-23.9);
  });

  it('longitude is near 0 at 12:00 UTC (within equation of time)', () => {
    const { lonDeg } = subsolarPoint(Date.UTC(2026, 2, 20, 12));
    expect(Math.abs(lonDeg)).toBeLessThan(3); // EoT is at most ~4 deg
  });

  it('moves ~15 deg west per hour', () => {
    const a = subsolarPoint(Date.UTC(2026, 6, 1, 12));
    const b = subsolarPoint(Date.UTC(2026, 6, 1, 13));
    let delta = a.lonDeg - b.lonDeg;
    if (delta < 0) delta += 360;
    expect(delta).toBeCloseTo(15, 0);
  });
});

describe('moon', () => {
  it('distance stays within the true perigee/apogee band', () => {
    for (let d = 0; d < 30; d++) {
      const { distKm } = moonEquatorial(Date.UTC(2026, 0, 1 + d));
      expect(distKm).toBeGreaterThan(354_000);
      expect(distKm).toBeLessThan(407_000);
    }
  });

  it('sublunar latitude stays within the maximum declination band', () => {
    for (let d = 0; d < 28; d++) {
      const { latDeg } = sublunarPoint(Date.UTC(2026, 3, 1 + d));
      expect(Math.abs(latDeg)).toBeLessThan(29);
    }
  });

  it('scene direction is a unit vector', () => {
    const dir = equatorialToSceneDir(moonEquatorial(Date.UTC(2026, 4, 10)));
    expect(Math.hypot(...dir)).toBeCloseTo(1, 9);
  });
});

describe('terminator ring', () => {
  it('every point is ~90 deg (10000 km) from the subsolar point', () => {
    const t = Date.UTC(2026, 6, 18, 6, 0);
    const sub = subsolarPoint(t);
    const ring = terminatorRing(t, 64);
    expect(ring.length).toBe(65);
    for (const [lon, lat] of ring) {
      const d = haversineKm(sub.latDeg, sub.lonDeg, lat, lon);
      // Quarter of Earth's circumference ~ 10007 km.
      expect(d).toBeGreaterThan(9900);
      expect(d).toBeLessThan(10100);
    }
  });
});

describe('sun scene direction', () => {
  it('is a unit vector pointing at positive latitude side in July', () => {
    const eq = sunEquatorial(Date.UTC(2026, 6, 1, 12));
    const dir = equatorialToSceneDir(eq);
    expect(Math.hypot(...dir)).toBeCloseTo(1, 9);
    // Scene Y is north: July sun has positive declination.
    expect(dir[1]).toBeGreaterThan(0.3);
  });
});
