import { Body, GeoVector, MakeTime, Rotation_EQJ_EQD, RotateVector } from 'astronomy-engine';
import { EARTH_RADIUS_KM, eciToEcefAt, ecefToGeodetic } from '@earthos/gis';

const AU_KM = 1.495978707e8;
const SUN_RADIUS_KM = 695_700;
const MOON_RADIUS_KM = 1737.4;

export interface ShadowState {
  /** does the umbra/antumbra axis hit the Earth right now */
  hit: boolean;
  latDeg: number;
  lonDeg: number;
  /** umbra radius at the ground, km; negative = annular (antumbra) */
  umbraKm: number;
  /** penumbra radius at the ground, km */
  penumbraKm: number;
}

/**
 * Geometric solar-eclipse shadow from high-precision ephemerides
 * (astronomy-engine, sub-arcminute): find where the sun-moon axis pierces
 * the sphere and size the umbra/penumbra cones there. Equator-of-date
 * vectors keep this consistent with the rest of EarthOS's TEME/GMST frame.
 */
export function shadowAt(epochMs: number): ShadowState {
  const time = MakeTime(new Date(epochMs));
  const rot = Rotation_EQJ_EQD(time);
  const moonV = RotateVector(rot, GeoVector(Body.Moon, time, true));
  const sunV = RotateVector(rot, GeoVector(Body.Sun, time, true));
  const moon = [moonV.x * AU_KM, moonV.y * AU_KM, moonV.z * AU_KM] as const;
  const sun = [sunV.x * AU_KM, sunV.y * AU_KM, sunV.z * AU_KM] as const;

  // Shadow axis: from the moon, pointing away from the sun.
  const ax = moon[0] - sun[0];
  const ay = moon[1] - sun[1];
  const az = moon[2] - sun[2];
  const aLen = Math.hypot(ax, ay, az);
  const d = [ax / aLen, ay / aLen, az / aLen] as const;

  // Intersect moon + t·d with the sphere |p| = R (smallest positive root).
  const b = 2 * (moon[0] * d[0] + moon[1] * d[1] + moon[2] * d[2]);
  const c = moon[0] ** 2 + moon[1] ** 2 + moon[2] ** 2 - EARTH_RADIUS_KM ** 2;
  const disc = b * b - 4 * c;
  if (disc < 0) {
    return { hit: false, latDeg: 0, lonDeg: 0, umbraKm: 0, penumbraKm: 0 };
  }
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t < 0) {
    return { hit: false, latDeg: 0, lonDeg: 0, umbraKm: 0, penumbraKm: 0 };
  }
  const p = [moon[0] + t * d[0], moon[1] + t * d[1], moon[2] + t * d[2]] as const;

  // Cone radii at the ground (linear taper along the axis).
  const sunMoonDist = aLen;
  const umbraKm = MOON_RADIUS_KM - (t * (SUN_RADIUS_KM - MOON_RADIUS_KM)) / sunMoonDist;
  const penumbraKm = MOON_RADIUS_KM + (t * (SUN_RADIUS_KM + MOON_RADIUS_KM)) / sunMoonDist;

  // Equator-of-date -> ECEF via GMST, then geodetic.
  const ecef = eciToEcefAt(p[0], p[1], p[2], epochMs);
  const geo = ecefToGeodetic(ecef[0], ecef[1], ecef[2]);
  return { hit: true, latDeg: geo.latDeg, lonDeg: geo.lonDeg, umbraKm, penumbraKm };
}
