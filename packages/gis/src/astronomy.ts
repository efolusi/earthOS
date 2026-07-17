import { DEG2RAD, RAD2DEG, SUN_DISTANCE_KM } from './constants';
import { gmstRad } from './frames';
import { normalizeLonDeg, type Vec3 } from './geodesy';
import { eciToScene } from './frames';

/**
 * Compact solar/lunar positions. Accuracy: sun ~0.01 deg (NOAA low-precision
 * series), moon ~1 deg (truncated Meeus): both far below one pixel at globe
 * viewing scale. Deliberately dependency-free; swap for a full ephemeris if
 * analytics ever need arc-second truth.
 */

export interface EquatorialDir {
  /** right ascension, radians */
  raRad: number;
  /** declination, radians */
  decRad: number;
  /** distance, km */
  distKm: number;
}

/** Days since J2000.0 for a sim epoch (ms). */
function daysSinceJ2000(epochMs: number): number {
  return epochMs / 86_400_000 - 10957.5;
}

/** Geocentric solar position (equatorial, ~TEME-aligned). */
export function sunEquatorial(epochMs: number): EquatorialDir {
  const n = daysSinceJ2000(epochMs);
  const L = (280.46 + 0.9856474 * n) % 360; // mean longitude, deg
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG2RAD; // mean anomaly
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG2RAD; // ecliptic lon
  const eps = (23.439 - 4e-7 * n) * DEG2RAD; // obliquity
  const raRad = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const decRad = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const distKm = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * SUN_DISTANCE_KM;
  return { raRad, decRad, distKm };
}

/** Geocentric lunar position (truncated Meeus, ~1 deg). */
export function moonEquatorial(epochMs: number): EquatorialDir {
  const n = daysSinceJ2000(epochMs);
  const T = n / 36525;
  // Mean elements (deg).
  const Lp = 218.316 + 13.176396 * n; // mean longitude
  const M = (134.963 + 13.064993 * n) * DEG2RAD; // mean anomaly
  const Ms = (357.529 + 0.98560028 * n) * DEG2RAD; // sun mean anomaly
  const D = (297.85 + 12.190749 * n) * DEG2RAD; // mean elongation
  const F = (93.272 + 13.22935 * n) * DEG2RAD; // argument of latitude

  const lonDeg =
    Lp +
    6.289 * Math.sin(M) +
    1.274 * Math.sin(2 * D - M) +
    0.658 * Math.sin(2 * D) +
    0.214 * Math.sin(2 * M) -
    0.186 * Math.sin(Ms) -
    0.114 * Math.sin(2 * F);
  const latDeg =
    5.128 * Math.sin(F) +
    0.28 * Math.sin(M + F) +
    0.28 * Math.sin(M - F) -
    0.17 * Math.sin(2 * D - F);
  const distKm = 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D);

  const lambda = lonDeg * DEG2RAD;
  const beta = latDeg * DEG2RAD;
  const eps = (23.439 - 0.013 * T) * DEG2RAD;
  const sinDec = Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda);
  const decRad = Math.asin(sinDec);
  const raRad = Math.atan2(
    Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps),
    Math.cos(lambda),
  );
  return { raRad, decRad, distKm };
}

/** Sub-body geodetic point (spherical Earth is fine at these accuracies). */
export function subPoint(eq: EquatorialDir, epochMs: number): { latDeg: number; lonDeg: number } {
  const gmst = gmstRad(epochMs);
  return {
    latDeg: eq.decRad * RAD2DEG,
    lonDeg: normalizeLonDeg((eq.raRad - gmst) * RAD2DEG),
  };
}

export function subsolarPoint(epochMs: number): { latDeg: number; lonDeg: number } {
  return subPoint(sunEquatorial(epochMs), epochMs);
}

export function sublunarPoint(epochMs: number): { latDeg: number; lonDeg: number } {
  return subPoint(moonEquatorial(epochMs), epochMs);
}

/** Unit direction to a body in SCENE coordinates (ECI-aligned world frame). */
export function equatorialToSceneDir(eq: EquatorialDir, out?: Vec3): Vec3 {
  const x = Math.cos(eq.decRad) * Math.cos(eq.raRad);
  const y = Math.cos(eq.decRad) * Math.sin(eq.raRad);
  const z = Math.sin(eq.decRad);
  return eciToScene(x, y, z, out);
}

/** Scene-frame position of a body (direction times distance in km). */
export function equatorialToScenePos(eq: EquatorialDir, out?: Vec3): Vec3 {
  const dir = equatorialToSceneDir(eq, out);
  dir[0] *= eq.distKm;
  dir[1] *= eq.distKm;
  dir[2] *= eq.distKm;
  return dir;
}

/**
 * Solar day/night terminator: `steps` geodetic points where sun altitude is
 * ~zero, as [lonDeg, latDeg] pairs (GeoJSON order), plus the night-side pole.
 * Used by the daynight plugin to build its polygon.
 */
export function terminatorRing(epochMs: number, steps = 128): Array<[number, number]> {
  const sub = subsolarPoint(epochMs);
  const lat0 = sub.latDeg * DEG2RAD;
  const lon0 = sub.lonDeg * DEG2RAD;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    // Circle of 90 deg angular radius around the subsolar point.
    const bearing = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(Math.cos(lat0) * Math.cos(bearing));
    const lon = lon0 + Math.atan2(Math.sin(bearing) * 1, -Math.sin(lat0) * Math.cos(bearing) * 1);
    points.push([normalizeLonDeg(lon * RAD2DEG), lat * RAD2DEG]);
  }
  return points;
}
