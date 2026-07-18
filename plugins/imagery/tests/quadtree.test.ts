import { describe, expect, it } from 'vitest';
import {
  childrenOf,
  computeVisibleTiles,
  mercatorV,
  parentOf,
  tileBounds,
  tileCenterDir,
  tileGroundSizeKm,
  tileKey,
} from '../src/quadtree';
import { EARTH_RADIUS_KM } from '@earthos/gis';

describe('tile math', () => {
  it('z0 covers the mercator world; z1 splits at Greenwich and the equator', () => {
    const world = tileBounds({ z: 0, x: 0, y: 0 });
    expect(world.westDeg).toBe(-180);
    expect(world.eastDeg).toBe(180);
    expect(world.northDeg).toBeCloseTo(85.051, 2);
    expect(world.southDeg).toBeCloseTo(-85.051, 2);

    const ne = tileBounds({ z: 1, x: 1, y: 0 });
    expect(ne.westDeg).toBe(0);
    expect(ne.southDeg).toBeCloseTo(0, 9);
  });

  it('mercatorV is 0 at the north edge, 1 at the south, 0.5 mid-mercator', () => {
    const b = tileBounds({ z: 2, x: 1, y: 1 });
    expect(mercatorV(b.northDeg, b)).toBeCloseTo(0, 9);
    expect(mercatorV(b.southDeg, b)).toBeCloseTo(1, 9);
    // Mercator is nonlinear: the geographic midpoint sits south of v=0.5.
    const mid = mercatorV((b.northDeg + b.southDeg) / 2, b);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(0.7);
  });

  it('children/parent round-trip and keys are stable', () => {
    const t = { z: 5, x: 9, y: 20 };
    for (const child of childrenOf(t)) {
      expect(parentOf(child)).toEqual(t);
    }
    expect(tileKey(t)).toBe('5/9/20');
  });

  it('tile ground size halves per zoom and shrinks toward the poles', () => {
    const equator = tileGroundSizeKm({ z: 4, x: 8, y: 8 });
    const deeper = tileGroundSizeKm({ z: 5, x: 16, y: 16 });
    expect(equator / deeper).toBeCloseTo(2, 0);
    const polar = tileGroundSizeKm({ z: 4, x: 8, y: 1 });
    expect(polar).toBeLessThan(equator);
  });

  it('tileCenterDir is a unit vector matching the scene frame (lat 0, lon 0 -> +x)', () => {
    const dir = tileCenterDir({ z: 3, x: 4, y: 4 }); // touches lat 0, lon 0 corner
    expect(Math.hypot(...dir)).toBeCloseTo(1, 9);
    const greenwich = tileCenterDir({ z: 8, x: 128, y: 128 });
    expect(greenwich[0]).toBeGreaterThan(0.99);
  });
});

describe('computeVisibleTiles', () => {
  const highCam: [number, number, number] = [EARTH_RADIUS_KM + 12_000, 0, 0];

  it('from high altitude returns coarse near-side tiles only', () => {
    const tiles = computeVisibleTiles({
      camLocal: highCam,
      viewportHeightPx: 900,
      fovYDeg: 50,
      maxZoom: 12,
    });
    expect(tiles.length).toBeGreaterThan(4);
    expect(tiles.length).toBeLessThanOrEqual(96);
    expect(Math.max(...tiles.map((t) => t.z))).toBeLessThanOrEqual(6);
    // Everything returned at least touches the visible hemisphere (tile
    // centers may sit past the horizon while an edge peeks over it).
    for (const t of tiles) {
      expect(tileCenterDir(t)[0]).toBeGreaterThan(-0.5);
    }
  });

  it('from low altitude refines deep around the nadir and culls the far side', () => {
    const lowCam: [number, number, number] = [EARTH_RADIUS_KM + 120, 0, 0];
    const tiles = computeVisibleTiles({
      camLocal: lowCam,
      viewportHeightPx: 900,
      fovYDeg: 50,
      maxZoom: 12,
    });
    // Deep refinement near the nadir (exact depth depends on the SSE budget).
    expect(Math.max(...tiles.map((t) => t.z))).toBeGreaterThanOrEqual(10);
    // Nadir (lat 0, lon 0) must be covered by one of the returned tiles.
    const covers = tiles.some((t) => {
      const b = tileBounds(t);
      return b.westDeg <= 0 && b.eastDeg >= 0 && b.southDeg <= 0 && b.northDeg >= 0;
    });
    expect(covers).toBe(true);
    // The antipode must not be.
    const farSide = tiles.some((t) => Math.abs(tileCenterDir(t)[0] + 1) < 0.1);
    expect(farSide).toBe(false);
  });

  it('inside the Earth returns nothing', () => {
    expect(
      computeVisibleTiles({
        camLocal: [1000, 0, 0],
        viewportHeightPx: 900,
        fovYDeg: 50,
        maxZoom: 10,
      }),
    ).toEqual([]);
  });
});
