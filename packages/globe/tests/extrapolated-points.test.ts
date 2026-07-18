import { describe, expect, it } from 'vitest';
import { ExtrapolatedPointsLayer } from '../src/points/extrapolated-points';
import { pickExtrapolated, pickToleranceRad } from '../src/points/pick';
import { MU_EARTH } from '@earthos/gis';

function makeLayer(capacity = 8) {
  return new ExtrapolatedPointsLayer({ capacity, mu: MU_EARTH, palette: ['#ffffff', '#ff0000'] });
}

describe('ExtrapolatedPointsLayer buffers', () => {
  it('writeBatch de-interleaves pos+vel and converts t0 to relative seconds', () => {
    const layer = makeLayer();
    const t0Ms = 1_000_000_000;
    const posVel = new Float32Array([
      7000,
      0,
      0,
      0,
      7.5,
      0, //
      0,
      7000,
      0,
      -7.5,
      0,
      0,
    ]);
    layer.writeBatch({ posVel, count: 2, t0Ms, offset: 0 });
    layer.setCount(2);

    const v = layer.views();
    expect([...v.position.subarray(0, 6)]).toEqual([7000, 0, 0, 0, 7000, 0]);
    expect([...v.vel.subarray(0, 6)]).toEqual([0, 7.5, 0, -7.5, 0, 0]);
    expect(v.t0[0]).toBe(0); // first batch defines the epoch base
    expect(layer.epochBase).toBe(t0Ms);
    expect(layer.geometry.drawRange.count).toBe(2);
  });

  it('second batch at a later epoch lands at a positive relative t0', () => {
    const layer = makeLayer();
    const posVel = new Float32Array(6);
    layer.writeBatch({ posVel, count: 1, t0Ms: 1_000_000_000, offset: 0 });
    layer.writeBatch({ posVel, count: 1, t0Ms: 1_000_030_000, offset: 1 });
    expect(layer.views().t0[1]).toBeCloseTo(30, 5);
  });

  it('updateTime writes uNow and rebases after the horizon', () => {
    const layer = makeLayer();
    const base = 2_000_000_000;
    const posVel = new Float32Array(6);
    layer.writeBatch({ posVel, count: 1, t0Ms: base, offset: 0 });

    layer.updateTime(base + 60_000);
    expect(layer.nowSec).toBeCloseTo(60, 6);

    // Beyond the 7200 s rebase horizon: epoch shifts, t0 compensates.
    layer.updateTime(base + 8000_000);
    expect(layer.nowSec).toBe(0);
    expect(layer.epochBase).toBe(base + 8000_000);
    expect(layer.views().t0[0]).toBeCloseTo(-8000, 3);
  });

  it('meta packing round-trips color/size/visibility/highlight', () => {
    const layer = makeLayer();
    layer.setMeta(3, 1, 4.5, true, 0.5);
    const m = layer.views().meta;
    expect(m[12]).toBe(1);
    expect(m[13]).toBe(4.5);
    expect(m[14]).toBe(1);
    expect(m[15]).toBe(0.5);

    layer.fillMeta(0, 2, 0, 3);
    expect(m[0]).toBe(0);
    expect(m[1]).toBe(3);
    expect(m[2]).toBe(1);
  });

  it('rejects batches beyond capacity', () => {
    const layer = makeLayer(2);
    expect(() =>
      layer.writeBatch({ posVel: new Float32Array(12), count: 2, t0Ms: 0, offset: 1 }),
    ).toThrow(/capacity/);
  });
});

describe('pickExtrapolated', () => {
  it('picks the object nearest to the ray using the same extrapolation as the GPU', () => {
    const layer = makeLayer(4);
    // Two objects on +X at 7000 km, one slightly north of the other.
    // Velocity moves object 0 along +Y at 1 km/s.
    const posVel = new Float32Array([
      7000,
      0,
      0,
      0,
      1,
      0, //
      7000,
      300,
      0,
      0,
      0,
      0,
    ]);
    layer.writeBatch({ posVel, count: 2, t0Ms: 0, offset: 0 });
    layer.setCount(2);
    layer.fillMeta(0, 2, 0, 3);
    layer.updateTime(100_000); // dt = 100 s: object 0 is now near y=+100 (minus mu pull)

    const v = layer.views();
    // Camera on +X axis at 20000 km looking toward -X, aimed at y=100.
    const origin: [number, number, number] = [20_000, 0, 0];
    const gravityDrop = 0.5 * (MU_EARTH / 7000 ** 2) * 100 ** 2; // radial pull over 100 s
    const expectedX = 7000 - gravityDrop;
    const dir0: [number, number, number] = norm([expectedX - 20_000, 100, 0]);

    const tol = pickToleranceRad(8, 1080, 50);
    const hit = pickExtrapolated(v, layer.nowSec, origin, dir0, tol);
    expect(hit).toBe(0);

    // Aiming at the static object picks index 1.
    const dir1: [number, number, number] = norm([7000 - 20_000, 300, 0]);
    expect(pickExtrapolated(v, layer.nowSec, origin, dir1, tol)).toBe(1);
  });

  it('ignores hidden objects and objects behind the Earth', () => {
    const layer = makeLayer(4);
    const posVel = new Float32Array([
      -7000,
      0,
      0,
      0,
      0,
      0, // behind the globe as seen from +X
      7000,
      0,
      0,
      0,
      0,
      0,
    ]);
    layer.writeBatch({ posVel, count: 2, t0Ms: 0, offset: 0 });
    layer.setCount(2);
    layer.fillMeta(0, 2, 0, 3);
    layer.updateTime(0);
    const v = layer.views();

    const origin: [number, number, number] = [20_000, 0, 0];
    const towardOccluded: [number, number, number] = [-1, 0, 0];
    // The ray toward -X passes through the Earth: occluded object is not picked
    // even though it is exactly on the ray. The near object IS on the ray too
    // (same direction) and must win.
    expect(pickExtrapolated(v, 0, origin, towardOccluded, 0.01)).toBe(1);

    // Hide the near object: now nothing is pickable on that ray.
    layer.setMeta(1, 0, 3, false);
    expect(pickExtrapolated(v, 0, origin, towardOccluded, 0.01)).toBe(-1);
  });
});

describe('extrapolation clamp (uMaxDt / maxDtSec)', () => {
  it('exposes the configured clamp through views(), unbounded by default', () => {
    expect(makeLayer().views().maxDtSec).toBe(1e9);
    const clamped = new ExtrapolatedPointsLayer({
      capacity: 4,
      mu: 0,
      maxExtrapolationSec: 120,
    });
    expect(clamped.views().maxDtSec).toBe(120);
  });

  it('freezes picking at the clamp so a far-future sim time still hits on-arc', () => {
    // mu = 0: pure straight-line so the frozen position is exact to reason about.
    const layer = new ExtrapolatedPointsLayer({ capacity: 4, mu: 0, maxExtrapolationSec: 120 });
    // Object at (7000,0,0) drifting +Y at 1 km/s. At t0+120 s it sits at y=120;
    // clamped, it stays there no matter how far the sim clock runs.
    const posVel = new Float32Array([7000, 0, 0, 0, 1, 0]);
    layer.writeBatch({ posVel, count: 1, t0Ms: 0, offset: 0 });
    layer.setCount(1);
    layer.fillMeta(0, 1, 0, 3);
    layer.updateTime(3_600_000); // 3600 s ahead: unclamped would be at y=3600

    const v = layer.views();
    const origin: [number, number, number] = [20_000, 0, 0];
    const tol = pickToleranceRad(8, 1080, 50);
    // Aiming at the clamped position (y=120) hits.
    expect(pickExtrapolated(v, layer.nowSec, origin, norm([7000 - 20_000, 120, 0]), tol)).toBe(0);
    // Aiming where the UNCLAMPED extrapolation would have flung it misses.
    expect(pickExtrapolated(v, layer.nowSec, origin, norm([7000 - 20_000, 3600, 0]), tol)).toBe(-1);
  });

  it('clamp is symmetric for reverse time', () => {
    const layer = new ExtrapolatedPointsLayer({ capacity: 4, mu: 0, maxExtrapolationSec: 120 });
    const posVel = new Float32Array([7000, 0, 0, 0, 1, 0]);
    layer.writeBatch({ posVel, count: 1, t0Ms: 1_000_000, offset: 0 });
    layer.setCount(1);
    layer.fillMeta(0, 1, 0, 3);
    layer.updateTime(1_000_000 - 3_600_000); // 3600 s in the past

    const v = layer.views();
    const origin: [number, number, number] = [20_000, 0, 0];
    const tol = pickToleranceRad(8, 1080, 50);
    // Frozen at y = -120 (not -3600).
    expect(pickExtrapolated(v, layer.nowSec, origin, norm([7000 - 20_000, -120, 0]), tol)).toBe(0);
  });
});

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
}
