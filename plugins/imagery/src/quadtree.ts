import { DEG2RAD, EARTH_RADIUS_KM, RAD2DEG } from '@earthos/gis';

/**
 * Pure Web-Mercator quadtree math: tile addressing, bounds, and the
 * refinement pass that picks which tiles to stream for a camera position.
 * No three.js here so every branch is unit-testable.
 */

export interface TileId {
  z: number;
  x: number;
  y: number;
}

export const tileKey = (t: TileId): string => `${t.z}/${t.x}/${t.y}`;

export interface TileBounds {
  westDeg: number;
  eastDeg: number;
  southDeg: number;
  northDeg: number;
}

/** Geographic bounds of a mercator tile. */
export function tileBounds(t: TileId): TileBounds {
  const n = 2 ** t.z;
  const westDeg = (t.x / n) * 360 - 180;
  const eastDeg = ((t.x + 1) / n) * 360 - 180;
  const mercN = Math.PI * (1 - (2 * t.y) / n);
  const mercS = Math.PI * (1 - (2 * (t.y + 1)) / n);
  const northDeg = Math.atan(Math.sinh(mercN)) * RAD2DEG;
  const southDeg = Math.atan(Math.sinh(mercS)) * RAD2DEG;
  return { westDeg, eastDeg, southDeg, northDeg };
}

/** Fraction [0..1] of `latDeg` between a tile's north (0) and south (1) edges, mercator-linear. */
export function mercatorV(latDeg: number, bounds: TileBounds): number {
  const merc = (lat: number) => Math.asinh(Math.tan(lat * DEG2RAD));
  const top = merc(bounds.northDeg);
  const bottom = merc(bounds.southDeg);
  return (top - merc(latDeg)) / (top - bottom);
}

export function childrenOf(t: TileId): TileId[] {
  return [
    { z: t.z + 1, x: t.x * 2, y: t.y * 2 },
    { z: t.z + 1, x: t.x * 2 + 1, y: t.y * 2 },
    { z: t.z + 1, x: t.x * 2, y: t.y * 2 + 1 },
    { z: t.z + 1, x: t.x * 2 + 1, y: t.y * 2 + 1 },
  ];
}

export function parentOf(t: TileId): TileId | null {
  if (t.z === 0) return null;
  return { z: t.z - 1, x: Math.floor(t.x / 2), y: Math.floor(t.y / 2) };
}

/** Approximate ground size of a tile edge at its center latitude, km. */
export function tileGroundSizeKm(t: TileId): number {
  const b = tileBounds(t);
  const latMid = (b.northDeg + b.southDeg) / 2;
  return ((2 * Math.PI * EARTH_RADIUS_KM) / 2 ** t.z) * Math.cos(latMid * DEG2RAD);
}

/** Unit direction (earth-fixed scene frame swizzle applied by caller) of a tile center. */
export function tileCenterDir(t: TileId): [number, number, number] {
  const b = tileBounds(t);
  const lat = ((b.northDeg + b.southDeg) / 2) * DEG2RAD;
  const lon = ((b.westDeg + b.eastDeg) / 2) * DEG2RAD;
  // ECEF direction swizzled to the scene's earth-fixed local frame (x, z, -y).
  const x = Math.cos(lat) * Math.cos(lon);
  const y = Math.cos(lat) * Math.sin(lon);
  const z = Math.sin(lat);
  return [x, z, -y];
}

export interface RefineInput {
  /** camera position in the earth-fixed LOCAL frame, km */
  camLocal: [number, number, number];
  viewportHeightPx: number;
  fovYDeg: number;
  maxZoom: number;
  /** refine while a tile would span more than this many screen pixels */
  screenSpaceErrorPx?: number;
  /** hard cap on returned tiles (worst-case safety) */
  maxTiles?: number;
}

/**
 * Pick the tile set for a camera: breadth-first refinement from z=3 roots,
 * culling tiles beyond the horizon or outside the (center-locked) view cone,
 * splitting while a tile's screen footprint exceeds the error budget.
 */
export function computeVisibleTiles(input: RefineInput): TileId[] {
  const {
    camLocal,
    viewportHeightPx,
    fovYDeg,
    maxZoom,
    screenSpaceErrorPx = 320,
    maxTiles = 96,
  } = input;
  const r = Math.hypot(...camLocal);
  if (r <= EARTH_RADIUS_KM + 1) return [];
  const camDir: [number, number, number] = [camLocal[0] / r, camLocal[1] / r, camLocal[2] / r];
  const altitude = r - EARTH_RADIUS_KM;
  const fovYRad = fovYDeg * DEG2RAD;
  const pixelsPerRadian = viewportHeightPx / fovYRad;

  // Ground visibility cone around the nadir: capped by the horizon and by
  // what the field of view can contain (with a diagonal margin).
  const horizonAngle = Math.acos(EARTH_RADIUS_KM / r);
  const groundHalfWidthKm = altitude * Math.tan(fovYRad / 2) * 1.9;
  const fovGroundAngle = groundHalfWidthKm / EARTH_RADIUS_KM;
  const visibleAngle = Math.min(horizonAngle, fovGroundAngle);

  const visible = (t: TileId): boolean => {
    const dir = tileCenterDir(t);
    const angularRadius = tileGroundSizeKm(t) / EARTH_RADIUS_KM; // generous (~diagonal)
    const dot = dir[0] * camDir[0] + dir[1] * camDir[1] + dir[2] * camDir[2];
    return Math.acos(Math.min(1, Math.max(-1, dot))) < visibleAngle + angularRadius;
  };

  const screenPx = (t: TileId): number => {
    const dir = tileCenterDir(t);
    const dx = dir[0] * EARTH_RADIUS_KM - camLocal[0];
    const dy = dir[1] * EARTH_RADIUS_KM - camLocal[1];
    const dz = dir[2] * EARTH_RADIUS_KM - camLocal[2];
    const dist = Math.max(Math.hypot(dx, dy, dz), altitude * 0.5, 1);
    return (tileGroundSizeKm(t) / dist) * pixelsPerRadian;
  };

  const out: TileId[] = [];
  const queue: TileId[] = [];
  const rootZ = 3;
  const n = 2 ** rootZ;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) queue.push({ z: rootZ, x, y });
  }

  while (queue.length > 0 && out.length < maxTiles) {
    const tile = queue.shift()!;
    if (!visible(tile)) continue;
    if (tile.z < maxZoom && screenPx(tile) > screenSpaceErrorPx) {
      queue.push(...childrenOf(tile));
    } else {
      out.push(tile);
    }
  }
  return out;
}
