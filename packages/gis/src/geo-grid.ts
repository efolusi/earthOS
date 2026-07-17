import { haversineKm } from './geodesy';

/**
 * CSR bucket grid over lat/lon cells, built with a counting sort into
 * preallocated typed arrays: zero allocation after construction, O(n)
 * rebuilds, cluster counts for free. Rebuild in a worker at ~1 Hz for
 * moving layers; queries run anywhere.
 */
export class GeoGrid {
  readonly cellSizeDeg: number;
  readonly nLon: number;
  readonly nLat: number;
  readonly nCells: number;

  private cellStart: Uint32Array; // nCells + 1
  private ids: Uint32Array; // capacity
  private counts: Uint32Array; // nCells scratch
  private cellOfId: Uint32Array; // capacity scratch
  private count = 0;
  private lat: Float32Array | Float64Array | null = null;
  private lon: Float32Array | Float64Array | null = null;

  constructor(capacity: number, cellSizeDeg = 5) {
    if (360 % cellSizeDeg !== 0 || 180 % cellSizeDeg !== 0) {
      throw new Error('cellSizeDeg must divide 360 and 180');
    }
    this.cellSizeDeg = cellSizeDeg;
    this.nLon = 360 / cellSizeDeg;
    this.nLat = 180 / cellSizeDeg;
    this.nCells = this.nLon * this.nLat;
    this.cellStart = new Uint32Array(this.nCells + 1);
    this.ids = new Uint32Array(capacity);
    this.counts = new Uint32Array(this.nCells);
    this.cellOfId = new Uint32Array(capacity);
  }

  /** Cell index for a geodetic position. */
  cellOf(latDeg: number, lonDeg: number): number {
    let latIdx = Math.floor((latDeg + 90) / this.cellSizeDeg);
    if (latIdx < 0) latIdx = 0;
    if (latIdx >= this.nLat) latIdx = this.nLat - 1;
    let lonIdx = Math.floor((((lonDeg % 360) + 360) % 360) / this.cellSizeDeg);
    if (lonIdx >= this.nLon) lonIdx = this.nLon - 1;
    return latIdx * this.nLon + lonIdx;
  }

  /**
   * Rebuild from parallel lat/lon arrays (degrees). Keeps references for
   * radius filtering: the caller must not shrink them until the next build.
   */
  build(lat: Float32Array | Float64Array, lon: Float32Array | Float64Array, count: number): void {
    if (count > this.ids.length) throw new Error('GeoGrid capacity exceeded');
    this.lat = lat;
    this.lon = lon;
    this.count = count;
    this.counts.fill(0);

    for (let i = 0; i < count; i++) {
      const cell = this.cellOf(lat[i]!, lon[i]!);
      this.cellOfId[i] = cell;
      this.counts[cell]!++;
    }
    let acc = 0;
    for (let c = 0; c < this.nCells; c++) {
      this.cellStart[c] = acc;
      acc += this.counts[c]!;
    }
    this.cellStart[this.nCells] = acc;
    // Scatter, reusing counts as per-cell cursors.
    this.counts.set(this.cellStart.subarray(0, this.nCells));
    for (let i = 0; i < count; i++) {
      const cell = this.cellOfId[i]!;
      this.ids[this.counts[cell]!] = i;
      this.counts[cell]!++;
    }
  }

  countInCell(cell: number): number {
    return this.cellStart[cell + 1]! - this.cellStart[cell]!;
  }

  /** Ids in a cell as a typed-array view (no copy). */
  idsInCell(cell: number): Uint32Array {
    return this.ids.subarray(this.cellStart[cell]!, this.cellStart[cell + 1]!);
  }

  /**
   * Ids within radiusKm of a geodetic point, written into `out`.
   * Returns the hit count (clamped to out.length).
   */
  queryRadius(latDeg: number, lonDeg: number, radiusKm: number, out: Uint32Array): number {
    if (!this.lat || !this.lon) return 0;
    const dLat = radiusKm / 111.195; // deg per km meridian
    const latMin = Math.max(-90, latDeg - dLat);
    const latMax = Math.min(90, latDeg + dLat);
    const cosLat = Math.cos((Math.PI / 180) * Math.min(89.999, Math.abs(latDeg) + dLat));
    const dLon = cosLat > 1e-6 ? Math.min(180, radiusKm / (111.195 * cosLat)) : 180;

    const latIdxMin = Math.max(0, Math.floor((latMin + 90) / this.cellSizeDeg));
    const latIdxMax = Math.min(this.nLat - 1, Math.floor((latMax + 90) / this.cellSizeDeg));
    const lonSpanCells = Math.min(
      this.nLon,
      2 * Math.ceil(dLon / this.cellSizeDeg) + 1,
    );
    const lonIdxCenter = Math.floor((((lonDeg % 360) + 360) % 360) / this.cellSizeDeg);

    let hits = 0;
    for (let li = latIdxMin; li <= latIdxMax; li++) {
      for (let k = 0; k < lonSpanCells; k++) {
        // Walk outward with longitude wraparound.
        const offset = k % 2 === 0 ? k / 2 : -(k + 1) / 2;
        const lj = (((lonIdxCenter + offset) % this.nLon) + this.nLon) % this.nLon;
        const cell = li * this.nLon + lj;
        const start = this.cellStart[cell]!;
        const end = this.cellStart[cell + 1]!;
        for (let s = start; s < end; s++) {
          const id = this.ids[s]!;
          if (haversineKm(latDeg, lonDeg, this.lat[id]!, this.lon[id]!) <= radiusKm) {
            if (hits < out.length) out[hits] = id;
            hits++;
            if (hits >= out.length) return hits;
          }
        }
      }
    }
    return hits;
  }

  /** Iterate non-empty cells: `cb(cellIndex, count)`. For cluster badges. */
  forEachNonEmptyCell(cb: (cell: number, count: number) => void): void {
    for (let c = 0; c < this.nCells; c++) {
      const n = this.countInCell(c);
      if (n > 0) cb(c, n);
    }
  }

  /** Geodetic center of a cell. */
  cellCenter(cell: number): { latDeg: number; lonDeg: number } {
    const latIdx = Math.floor(cell / this.nLon);
    const lonIdx = cell % this.nLon;
    // lonIdx 0 covers [0, cellSize) east of Greenwich (see cellOf).
    const rawLon = lonIdx * this.cellSizeDeg + this.cellSizeDeg / 2;
    return {
      latDeg: latIdx * this.cellSizeDeg - 90 + this.cellSizeDeg / 2,
      lonDeg: rawLon > 180 ? rawLon - 360 : rawLon,
    };
  }

  get size(): number {
    return this.count;
  }
}
