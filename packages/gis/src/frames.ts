import { gstime } from 'satellite.js';
import { geodeticToEcef, type Vec3 } from './geodesy';

/**
 * Coordinate conventions (the one decision everything obeys):
 *
 * - Logical frame: TEME/ECI as produced by SGP4, kilometers.
 * - Scene frame: Y-up right-handed, 1 unit = 1 km, mapped as
 *       scene = (x_eci, z_eci, -y_eci)
 * - Earth-fixed content lives under one group with `rotation.y = gmst`;
 *   its children use swizzled-ECEF local coordinates from `ecefToScene`.
 *   Proof: eci = Rz(g) ecef and S(Rz(g) v) = Ry(g) S(v) for this swizzle,
 *   so a single group rotation converts every child at once.
 *
 * With this mapping, an equirectangular texture on a default three.js
 * SphereGeometry lands with longitude 0 on ECEF +X: no phi offset needed
 * (verified by the frames known-answer tests).
 */

/** Greenwich Mean Sidereal Time, radians, for a sim epoch in ms. */
export function gmstRad(epochMs: number): number {
  return gstime(new Date(epochMs));
}

/** TEME/ECI km -> scene units (Y-up swizzle). */
export function eciToScene(x: number, y: number, z: number, out?: Vec3): Vec3 {
  if (out) {
    out[0] = x;
    out[1] = z;
    out[2] = -y;
    return out;
  }
  return [x, z, -y];
}

/** ECEF km -> earth-fixed-group LOCAL scene units (same swizzle). */
export function ecefToScene(x: number, y: number, z: number, out?: Vec3): Vec3 {
  return eciToScene(x, y, z, out);
}

/** Scene units -> TEME/ECI km (inverse swizzle). */
export function sceneToEci(x: number, y: number, z: number, out?: Vec3): Vec3 {
  if (out) {
    out[0] = x;
    out[1] = -z;
    out[2] = y;
    return out;
  }
  return [x, -z, y];
}

/** Geodetic -> earth-fixed-group LOCAL scene position. */
export function geodeticToScene(latDeg: number, lonDeg: number, altKm = 0, out?: Vec3): Vec3 {
  const ecef = geodeticToEcef(latDeg, lonDeg, altKm);
  return ecefToScene(ecef[0], ecef[1], ecef[2], out);
}

/**
 * Local ENU velocity (east/north/up, km/s) at a geodetic point -> the
 * earth-fixed group's LOCAL scene frame. Used by surface traffic layers
 * (aircraft, ships) whose feeds report ground speed + track.
 */
export function enuVelocityToScene(
  latDeg: number,
  lonDeg: number,
  vEast: number,
  vNorth: number,
  vUp: number,
  out?: Vec3,
): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  // ENU basis in ECEF.
  const x = -sinLon * vEast - sinLat * cosLon * vNorth + cosLat * cosLon * vUp;
  const y = cosLon * vEast - sinLat * sinLon * vNorth + cosLat * sinLon * vUp;
  const z = cosLat * vNorth + sinLat * vUp;
  return ecefToScene(x, y, z, out);
}

/** ECI km -> ECEF km at a given time (rotation about z by -gmst). */
export function eciToEcefAt(x: number, y: number, z: number, epochMs: number, out?: Vec3): Vec3 {
  const g = gmstRad(epochMs);
  const cos = Math.cos(g);
  const sin = Math.sin(g);
  const ex = cos * x + sin * y;
  const ey = -sin * x + cos * y;
  if (out) {
    out[0] = ex;
    out[1] = ey;
    out[2] = z;
    return out;
  }
  return [ex, ey, z];
}
