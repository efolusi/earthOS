import { EARTH_RADIUS_KM } from './constants';
import { haversineKm } from './geodesy';

const DEG2RAD = Math.PI / 180;

/** Total path length along the great-circle legs of a polyline, km. */
export function pathLengthKm(points: ReadonlyArray<readonly [number, number]>): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1]![0], points[i - 1]![1], points[i]![0], points[i]![1]);
  }
  return total;
}

/** Wrap a longitude delta to [-180, 180] so legs never cross the dateline the long way. */
function wrapLonDeltaRad(deltaDeg: number): number {
  let d = deltaDeg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d * DEG2RAD;
}

/**
 * Area of a spherical polygon (closed automatically), km². Chamberlain &
 * Duquette spherical-excess formula; longitude steps are wrapped so it is
 * robust across the antimeridian. Points are [lat, lon] in degrees.
 */
export function sphericalPolygonAreaKm2(
  points: ReadonlyArray<readonly [number, number]>,
): number {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const [lat1, lon1] = points[i]!;
    const [lat2, lon2] = points[(i + 1) % n]!;
    const dLambda = wrapLonDeltaRad(lon2 - lon1);
    sum += dLambda * (2 + Math.sin(lat1 * DEG2RAD) + Math.sin(lat2 * DEG2RAD));
  }
  return (Math.abs(sum) * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2;
}

/**
 * Sample `segments + 1` points along the great circle from a to b (inclusive),
 * via slerp on the unit sphere. Returns [lat, lon] degrees; used to draw a
 * curved leg that hugs the globe instead of a straight chord.
 */
export function sampleGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  segments: number,
): Array<[number, number]> {
  const p1 = unit(lat1, lon1);
  const p2 = unit(lat2, lon2);
  const dot = Math.min(1, Math.max(-1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const omega = Math.acos(dot);
  const out: Array<[number, number]> = [];
  if (omega < 1e-9) return [[lat1, lon1], [lat2, lon2]];
  const sinOmega = Math.sin(omega);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    const x = a * p1[0] + b * p2[0];
    const y = a * p1[1] + b * p2[1];
    const z = a * p1[2] + b * p2[2];
    out.push([Math.asin(z / Math.hypot(x, y, z)) / DEG2RAD, Math.atan2(y, x) / DEG2RAD]);
  }
  return out;
}

function unit(latDeg: number, lonDeg: number): [number, number, number] {
  const phi = latDeg * DEG2RAD;
  const lambda = lonDeg * DEG2RAD;
  const c = Math.cos(phi);
  return [c * Math.cos(lambda), c * Math.sin(lambda), Math.sin(phi)];
}
