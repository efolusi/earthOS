import { describe, expect, it } from 'vitest';
import {
  observerLookAngles,
  pathLengthKm,
  sampleGreatCircle,
  sphericalPolygonAreaKm2,
} from '../src/measure';
import { geodeticToEcef } from '../src/geodesy';

describe('pathLengthKm', () => {
  it('sums great-circle legs (JFK → LHR ≈ 5555 km)', () => {
    const d = pathLengthKm([
      [40.64, -73.78],
      [51.47, -0.45],
    ]);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(5600);
  });

  it('is zero for a single point and additive across legs', () => {
    expect(pathLengthKm([[0, 0]])).toBe(0);
    const one = pathLengthKm([
      [0, 0],
      [0, 10],
    ]);
    const two = pathLengthKm([
      [0, 0],
      [0, 10],
      [0, 20],
    ]);
    expect(two).toBeCloseTo(one * 2, 3);
  });
});

describe('sphericalPolygonAreaKm2', () => {
  it('approximates a 10°×10° equatorial box (~1.22M km²)', () => {
    const area = sphericalPolygonAreaKm2([
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ]);
    // ~ (10*111.3) * (10*111.3) with mild spherical shrink; ballpark 1.2M km².
    expect(area).toBeGreaterThan(1.1e6);
    expect(area).toBeLessThan(1.3e6);
  });

  it('is zero for fewer than three points and robust across the dateline', () => {
    expect(
      sphericalPolygonAreaKm2([
        [0, 0],
        [1, 1],
      ]),
    ).toBe(0);
    const box = sphericalPolygonAreaKm2([
      [0, 175],
      [0, -175], // crosses the antimeridian; wrapped delta keeps it a 10° box
      [10, -175],
      [10, 175],
    ]);
    expect(box).toBeGreaterThan(1.1e6);
    expect(box).toBeLessThan(1.3e6);
  });
});

describe('observerLookAngles', () => {
  it('reads ~90° elevation for an object straight overhead', () => {
    const sat = geodeticToEcef(10, 20, 500); // 500 km above the observer
    const { elDeg, rangeKm } = observerLookAngles(10, 20, 0, sat[0], sat[1], sat[2]);
    expect(elDeg).toBeGreaterThan(89.5);
    expect(rangeKm).toBeCloseTo(500, 0);
  });

  it('reads negative elevation for an object on the far side of the Earth', () => {
    const sat = geodeticToEcef(-10, 200, 500); // antipodal-ish, below the horizon
    const { elDeg } = observerLookAngles(10, 20, 0, sat[0], sat[1], sat[2]);
    expect(elDeg).toBeLessThan(0);
  });

  it('azimuth points north (~0°/360°) for an object due north', () => {
    const sat = geodeticToEcef(20, 20, 500); // 10° further north, same lon
    const { azDeg } = observerLookAngles(10, 20, 0, sat[0], sat[1], sat[2]);
    expect(Math.min(azDeg, 360 - azDeg)).toBeLessThan(1);
  });
});

describe('sampleGreatCircle', () => {
  it('returns endpoints and a midpoint on the arc', () => {
    const pts = sampleGreatCircle(0, 0, 0, 90, 2);
    expect(pts).toHaveLength(3);
    expect(pts[0]![0]).toBeCloseTo(0, 5);
    expect(pts[0]![1]).toBeCloseTo(0, 5);
    // Midpoint of two equatorial points is on the equator, halfway in longitude.
    expect(pts[1]![0]).toBeCloseTo(0, 5);
    expect(pts[1]![1]).toBeCloseTo(45, 5);
    expect(pts[2]![1]).toBeCloseTo(90, 5);
  });
});
