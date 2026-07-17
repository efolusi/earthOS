import { describe, expect, it } from 'vitest';
import { eciToScene, sceneToEci, ecefToScene, gmstRad, eciToEcefAt, geodeticToScene } from '../src/frames';

describe('scene swizzle', () => {
  it('maps (x, y, z) -> (x, z, -y) and inverts cleanly', () => {
    expect(eciToScene(1, 2, 3)).toEqual([1, 3, -2]);
    expect(sceneToEci(...eciToScene(7, -4, 2))).toEqual([7, -4, 2]);
  });

  it('preserves handedness (determinant +1): cross products survive', () => {
    // ECI: x cross y = z. Scene images must satisfy the same relation.
    const sx = eciToScene(1, 0, 0);
    const sy = eciToScene(0, 1, 0);
    const sz = eciToScene(0, 0, 1);
    const cross = [
      sx[1] * sy[2] - sx[2] * sy[1],
      sx[2] * sy[0] - sx[0] * sy[2],
      sx[0] * sy[1] - sx[1] * sy[0],
    ];
    for (let i = 0; i < 3; i++) {
      expect(cross[i]).toBeCloseTo(sz[i]!, 12);
    }
  });
});

describe('earth-fixed group equivalence', () => {
  it('S(eci) equals Ry(gmst) applied to S(ecef) for any epoch', () => {
    const epoch = Date.UTC(2026, 6, 18, 9, 30, 0);
    const g = gmstRad(epoch);
    const ecef: [number, number, number] = [4000, -2500, 3000];

    // ECI from ECEF: rotate by +gmst about z.
    const cos = Math.cos(g);
    const sin = Math.sin(g);
    const eci: [number, number, number] = [
      cos * ecef[0] - sin * ecef[1],
      sin * ecef[0] + cos * ecef[1],
      ecef[2],
    ];

    const sceneFromEci = eciToScene(...eci);

    // Ry(gmst) applied to swizzled ECEF (what the earthFixedGroup does).
    const local = ecefToScene(...ecef);
    const rotated: [number, number, number] = [
      cos * local[0] + sin * local[2],
      local[1],
      -sin * local[0] + cos * local[2],
    ];

    for (let i = 0; i < 3; i++) {
      expect(rotated[i]).toBeCloseTo(sceneFromEci[i]!, 9);
    }
  });

  it('eciToEcefAt inverts the rotation', () => {
    const epoch = Date.UTC(2026, 0, 1);
    const g = gmstRad(epoch);
    const cos = Math.cos(g);
    const sin = Math.sin(g);
    const ecef: [number, number, number] = [1234, 5678, -910];
    const eci: [number, number, number] = [
      cos * ecef[0] - sin * ecef[1],
      sin * ecef[0] + cos * ecef[1],
      ecef[2],
    ];
    const back = eciToEcefAt(...eci, epoch);
    expect(back[0]).toBeCloseTo(ecef[0], 8);
    expect(back[1]).toBeCloseTo(ecef[1], 8);
    expect(back[2]).toBeCloseTo(ecef[2], 8);
  });
});

describe('texture alignment invariants', () => {
  it('lon 0 lands on local +X (three.js equirect texture center)', () => {
    const [x, y, z] = geodeticToScene(0, 0, 0);
    expect(x).toBeGreaterThan(6000);
    expect(Math.abs(y)).toBeLessThan(1e-6);
    expect(Math.abs(z)).toBeLessThan(1e-6);
  });

  it('lon +90 lands on local -Z (east of the texture center)', () => {
    const [x, , z] = geodeticToScene(0, 90, 0);
    expect(Math.abs(x)).toBeLessThan(1e-6);
    expect(z).toBeLessThan(-6000);
  });

  it('north pole lands on local +Y', () => {
    const [, y] = geodeticToScene(90, 0, 0);
    expect(y).toBeGreaterThan(6000);
  });
});

describe('gmst', () => {
  it('is in [0, 2pi) and advances ~360.9856 deg per day', () => {
    const t0 = Date.UTC(2026, 2, 20, 0, 0, 0);
    const g0 = gmstRad(t0);
    const g1 = gmstRad(t0 + 86_400_000);
    expect(g0).toBeGreaterThanOrEqual(0);
    expect(g0).toBeLessThan(2 * Math.PI);
    let delta = g1 - g0;
    if (delta < 0) delta += 2 * Math.PI;
    const degPerDay = (delta * 180) / Math.PI;
    expect(degPerDay).toBeCloseTo(0.9856, 3); // extra rotation beyond 360
  });
});
