import { DEG2RAD, RAD2DEG, WGS84_A, WGS84_B, WGS84_E2 } from './constants';

export interface Geodetic {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export type Vec3 = [number, number, number];

/** Geodetic (WGS84) to ECEF, km. */
export function geodeticToEcef(latDeg: number, lonDeg: number, altKm = 0, out?: Vec3): Vec3 {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const x = (n + altKm) * cosLat * Math.cos(lon);
  const y = (n + altKm) * cosLat * Math.sin(lon);
  const z = (n * (1 - WGS84_E2) + altKm) * sinLat;
  if (out) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
  }
  return [x, y, z];
}

/** ECEF (km) to geodetic (WGS84), via Bowring's method (sub-mm for Earth). */
export function ecefToGeodetic(x: number, y: number, z: number): Geodetic {
  const lonDeg = Math.atan2(y, x) * RAD2DEG;
  const p = Math.hypot(x, y);
  if (p < 1e-9) {
    // On the polar axis.
    const altKm = Math.abs(z) - WGS84_B;
    return { latDeg: z >= 0 ? 90 : -90, lonDeg: 0, altKm };
  }
  const ePrime2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
  const theta = Math.atan2(z * WGS84_A, p * WGS84_B);
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const lat = Math.atan2(
    z + ePrime2 * WGS84_B * sinT * sinT * sinT,
    p - WGS84_E2 * WGS84_A * cosT * cosT * cosT,
  );
  const sinLat = Math.sin(lat);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);
  const altKm = p / Math.cos(lat) - n;
  return { latDeg: lat * RAD2DEG, lonDeg, altKm };
}

/** Great-circle distance between two geodetic points (spherical, km). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088; // mean radius for distance
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Normalize a longitude to (-180, 180]. */
export function normalizeLonDeg(lonDeg: number): number {
  let lon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  if (lon === -180) lon = 180;
  return lon;
}

/** Initial great-circle bearing from point 1 to point 2, degrees clockwise from north. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG2RAD;
  const p2 = lat2 * DEG2RAD;
  const dLon = (lon2 - lon1) * DEG2RAD;
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360;
}
