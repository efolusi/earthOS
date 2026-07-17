import {
  twoline2satrec,
  json2satrec,
  propagate,
  sgp4,
  eciToGeodetic,
  degreesLat,
  degreesLong,
  type SatRec,
  type OMMJsonObject,
} from 'satellite.js';
import { gmstRad } from './frames';
import type { Vec3 } from './geodesy';

export type { SatRec };

export interface TemeState {
  /** km, TEME */
  position: Vec3;
  /** km/s, TEME */
  velocity: Vec3;
}

/** Parse classic two-line elements. */
export function parseTle(line1: string, line2: string): SatRec {
  return twoline2satrec(line1, line2);
}

/** Parse a CelesTrak GP record (OMM JSON). */
export function parseOmm(omm: OMMJsonObject): SatRec {
  return json2satrec(omm);
}

/**
 * Propagate to a sim epoch (ms). Returns null when SGP4 signals decay or a
 * numeric failure: callers must skip such objects, not render NaNs.
 */
export function propagateTeme(satrec: SatRec, epochMs: number): TemeState | null {
  const result = propagate(satrec, new Date(epochMs));
  if (!result || typeof result.position === 'boolean' || typeof result.velocity === 'boolean') {
    return null;
  }
  const p = result.position;
  const v = result.velocity;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
  return {
    position: [p.x, p.y, p.z],
    velocity: [v.x, v.y, v.z],
  };
}

/**
 * Fast path for worker loops: propagate by minutes-since-epoch, skipping
 * Date construction. `tsinceMin` is minutes since the TLE epoch.
 */
export function propagateFast(satrec: SatRec, tsinceMin: number): TemeState | null {
  const result = sgp4(satrec, tsinceMin);
  if (!result || typeof result.position === 'boolean' || typeof result.velocity === 'boolean') {
    return null;
  }
  const p = result.position;
  const v = result.velocity;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) return null;
  return {
    position: [p.x, p.y, p.z],
    velocity: [v.x, v.y, v.z],
  };
}

/** Minutes since a satrec's TLE epoch for a given sim time (ms). */
export function minutesSinceEpoch(satrec: SatRec, epochMs: number): number {
  // satrec.jdsatepoch is the Julian date of the TLE epoch.
  const jdNow = epochMs / 86_400_000 + 2440587.5;
  return (jdNow - satrec.jdsatepoch) * 1440;
}

export interface SatGeodetic {
  latDeg: number;
  lonDeg: number;
  altKm: number;
  /** ground speed irrelevant here: this is inertial speed, km/s */
  speedKms: number;
}

/** Geodetic sub-point + speed for one satellite at a sim epoch. */
export function satGeodetic(satrec: SatRec, epochMs: number): SatGeodetic | null {
  const state = propagateTeme(satrec, epochMs);
  if (!state) return null;
  const gmst = gmstRad(epochMs);
  const geo = eciToGeodetic(
    { x: state.position[0], y: state.position[1], z: state.position[2] },
    gmst,
  );
  return {
    latDeg: degreesLat(geo.latitude),
    lonDeg: degreesLong(geo.longitude),
    altKm: geo.height,
    speedKms: Math.hypot(...state.velocity),
  };
}

/** Orbital period from SGP4 mean motion (radians/min), in minutes. */
export function orbitalPeriodMin(satrec: SatRec): number {
  return (2 * Math.PI) / satrec.no;
}
