import { describe, expect, it } from 'vitest';
import { ecefToGeodetic, geodeticToEcef, haversineKm, normalizeLonDeg } from '../src/geodesy';
import { WGS84_A, WGS84_B } from '../src/constants';

describe('geodeticToEcef known answers', () => {
  it('equator/prime meridian sits on +X at the semi-major axis', () => {
    const [x, y, z] = geodeticToEcef(0, 0, 0);
    expect(x).toBeCloseTo(WGS84_A, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('north pole sits on +Z at the semi-minor axis', () => {
    const [x, y, z] = geodeticToEcef(90, 0, 0);
    expect(Math.hypot(x, y)).toBeLessThan(1e-6);
    expect(z).toBeCloseTo(WGS84_B, 6);
  });

  it('lon +90 sits on +Y (east positive)', () => {
    const [x, y] = geodeticToEcef(0, 90, 0);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(WGS84_A, 6);
  });

  it('altitude adds along the normal', () => {
    const [x] = geodeticToEcef(0, 0, 400);
    expect(x).toBeCloseTo(WGS84_A + 400, 6);
  });
});

describe('ecefToGeodetic round trip', () => {
  const cases: Array<[number, number, number]> = [
    [0, 0, 0],
    [45, 45, 100],
    [-33.86, 151.2, 0.05], // Sydney
    [89.9, -170, 800],
    [-89.9, 10, 0],
    [51.4778, 0, 0.045], // Greenwich
  ];
  for (const [lat, lon, alt] of cases) {
    it(`round-trips lat=${lat} lon=${lon} alt=${alt}`, () => {
      const [x, y, z] = geodeticToEcef(lat, lon, alt);
      const geo = ecefToGeodetic(x, y, z);
      expect(geo.latDeg).toBeCloseTo(lat, 6);
      expect(Math.abs(normalizeLonDeg(geo.lonDeg - lon))).toBeLessThan(1e-6);
      expect(geo.altKm).toBeCloseTo(alt, 6);
    });
  }
});

describe('haversine', () => {
  it('LHR to JFK is about 5540 km', () => {
    const d = haversineKm(51.4775, -0.4614, 40.6413, -73.7781);
    expect(d).toBeGreaterThan(5500);
    expect(d).toBeLessThan(5600);
  });
  it('antipodal points are half the circumference', () => {
    const d = haversineKm(0, 0, 0, 180);
    expect(d).toBeCloseTo(Math.PI * 6371.0088, 0);
  });
});

describe('normalizeLonDeg', () => {
  it('wraps into (-180, 180]', () => {
    expect(normalizeLonDeg(190)).toBe(-170);
    expect(normalizeLonDeg(-190)).toBe(170);
    expect(normalizeLonDeg(540)).toBe(180);
    expect(normalizeLonDeg(-180)).toBe(180);
    expect(normalizeLonDeg(0)).toBe(0);
  });
});
