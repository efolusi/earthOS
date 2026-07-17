import { describe, expect, it } from 'vitest';
import {
  minutesSinceEpoch,
  orbitalPeriodMin,
  parseTle,
  propagateFast,
  propagateTeme,
  satGeodetic,
} from '../src/tle';

// ISS (ZARYA), epoch 2024-01-01. Historical TLE: propagation physics does not
// change, so this stays a stable known-answer fixture.
const ISS_L1 = '1 25544U 98067A   24001.00000000  .00016717  00000-0  30777-3 0  9990';
const ISS_L2 = '2 25544  51.6416 339.5000 0004257  98.0000 262.0000 15.49564479430000';

const EPOCH_MS = Date.UTC(2024, 0, 1, 0, 0, 0);

describe('SGP4 wrappers', () => {
  it('parses a TLE and reports the ISS orbital period ~92.9 min', () => {
    const rec = parseTle(ISS_L1, ISS_L2);
    expect(orbitalPeriodMin(rec)).toBeGreaterThan(90);
    expect(orbitalPeriodMin(rec)).toBeLessThan(95);
  });

  it('propagates to a LEO position with a plausible radius and speed', () => {
    const rec = parseTle(ISS_L1, ISS_L2);
    const state = propagateTeme(rec, EPOCH_MS);
    expect(state).not.toBeNull();
    const r = Math.hypot(...state!.position);
    const v = Math.hypot(...state!.velocity);
    expect(r).toBeGreaterThan(6371 + 350); // above 350 km
    expect(r).toBeLessThan(6371 + 500); // below 500 km
    expect(v).toBeGreaterThan(7.5);
    expect(v).toBeLessThan(7.8);
  });

  it('propagateFast(minutesSinceEpoch) matches propagateTeme(date)', () => {
    const rec = parseTle(ISS_L1, ISS_L2);
    const t = EPOCH_MS + 47 * 60_000;
    const a = propagateTeme(rec, t)!;
    const rec2 = parseTle(ISS_L1, ISS_L2);
    const b = propagateFast(rec2, minutesSinceEpoch(rec2, t))!;
    for (let i = 0; i < 3; i++) {
      expect(b.position[i]).toBeCloseTo(a.position[i]!, 6);
      expect(b.velocity[i]).toBeCloseTo(a.velocity[i]!, 9);
    }
  });

  it('returns to nearly the same position after one orbital period', () => {
    const rec = parseTle(ISS_L1, ISS_L2);
    const period = orbitalPeriodMin(rec);
    const a = propagateTeme(rec, EPOCH_MS)!;
    const b = propagateTeme(rec, EPOCH_MS + period * 60_000)!;
    const drift = Math.hypot(
      a.position[0] - b.position[0],
      a.position[1] - b.position[1],
      a.position[2] - b.position[2],
    );
    // J2 nodal regression and drag cause some drift; well under 300 km.
    expect(drift).toBeLessThan(300);
  });

  it('satGeodetic yields a sub-point within the inclination band', () => {
    const rec = parseTle(ISS_L1, ISS_L2);
    const geo = satGeodetic(rec, EPOCH_MS + 13 * 60_000)!;
    expect(Math.abs(geo.latDeg)).toBeLessThanOrEqual(52);
    expect(geo.altKm).toBeGreaterThan(350);
    expect(geo.altKm).toBeLessThan(500);
    expect(geo.speedKms).toBeGreaterThan(7.5);
  });
});
