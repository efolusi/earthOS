import { describe, expect, it } from 'vitest';
import { GeoGrid } from '../src/geo-grid';
import { haversineKm } from '../src/geodesy';

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('GeoGrid', () => {
  it('build + idsInCell places points where cellOf says', () => {
    const grid = new GeoGrid(4, 5);
    const lat = new Float64Array([0, 0, 52.5, -89]);
    const lon = new Float64Array([0.1, 2, 13.4, 179]);
    grid.build(lat, lon, 4);

    const c0 = grid.cellOf(0, 0.1);
    expect([...grid.idsInCell(c0)].sort()).toEqual([0, 1]); // both in the same 5-deg cell
    expect(grid.countInCell(grid.cellOf(52.5, 13.4))).toBe(1);
    expect(grid.countInCell(grid.cellOf(-89, 179))).toBe(1);
    expect(grid.size).toBe(4);
  });

  it('queryRadius matches brute force on 2000 random points', () => {
    const n = 2000;
    const rnd = seededRandom(42);
    const lat = new Float64Array(n);
    const lon = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      lat[i] = Math.asin(2 * rnd() - 1) * (180 / Math.PI); // uniform on sphere
      lon[i] = rnd() * 360 - 180;
    }
    const grid = new GeoGrid(n, 5);
    grid.build(lat, lon, n);

    const queries: Array<[number, number, number]> = [
      [0, 0, 500],
      [51.5, -0.1, 1000],
      [-33, 151, 800],
      [80, 10, 1200],
      [0, 179.5, 700], // antimeridian wraparound
      [-88, 0, 900], // near pole
    ];
    const out = new Uint32Array(n);
    for (const [qlat, qlon, r] of queries) {
      const hits = grid.queryRadius(qlat, qlon, r, out);
      const got = new Set([...out.subarray(0, hits)]);
      const expected = new Set<number>();
      for (let i = 0; i < n; i++) {
        if (haversineKm(qlat, qlon, lat[i]!, lon[i]!) <= r) expected.add(i);
      }
      expect(got).toEqual(expected);
    }
  });

  it('rebuild reuses buffers without allocation errors and clears state', () => {
    const grid = new GeoGrid(10, 5);
    const lat = new Float64Array([10, 20, 30]);
    const lon = new Float64Array([10, 20, 30]);
    grid.build(lat, lon, 3);
    expect(grid.size).toBe(3);
    grid.build(lat, lon, 1);
    expect(grid.size).toBe(1);
    expect(grid.countInCell(grid.cellOf(20, 20))).toBe(0);
  });

  it('cluster iteration reports non-empty cells with counts', () => {
    const grid = new GeoGrid(5, 10);
    const lat = new Float64Array([1, 2, 3, 55, 56]);
    const lon = new Float64Array([1, 2, 3, 100, 101]);
    grid.build(lat, lon, 5);
    const cells: Array<[number, number]> = [];
    grid.forEachNonEmptyCell((c, count) => cells.push([c, count]));
    expect(cells.map(([, c]) => c).sort()).toEqual([2, 3]);
  });

  it('throws when capacity is exceeded', () => {
    const grid = new GeoGrid(2, 5);
    const arr = new Float64Array([0, 0, 0]);
    expect(() => grid.build(arr, arr, 3)).toThrow(/capacity/);
  });
});
