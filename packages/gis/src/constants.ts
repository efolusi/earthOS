/** Scene convention: 1 scene unit = 1 km. */
export const KM_PER_UNIT = 1;

/** Mean Earth radius (km): the render sphere's radius. */
export const EARTH_RADIUS_KM = 6371;

/** Radius used for horizon occlusion culling (slightly inside the surface). */
export const EARTH_OCCLUSION_RADIUS_KM = 6360;

/** WGS84 ellipsoid. */
export const WGS84_A = 6378.137; // semi-major axis, km
export const WGS84_F = 1 / 298.257223563;
export const WGS84_B = WGS84_A * (1 - WGS84_F);
export const WGS84_E2 = WGS84_F * (2 - WGS84_F); // first eccentricity squared

/** Earth gravitational parameter, km^3/s^2 (for GPU orbit extrapolation). */
export const MU_EARTH = 398600.4418;

/** Sidereal rates. */
export const EARTH_ROTATION_RAD_PER_SEC = 7.292115e-5;

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** Mean distance to the Moon (km), for scene placement sanity checks. */
export const MOON_MEAN_DISTANCE_KM = 384_400;
export const MOON_RADIUS_KM = 1737.4;
export const SUN_DISTANCE_KM = 149_597_870;
