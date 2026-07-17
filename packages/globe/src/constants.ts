import { EARTH_RADIUS_KM } from '@earthos/gis';

/** Scene radii (1 unit = 1 km). */
export const GLOBE_RADIUS = EARTH_RADIUS_KM; // 6371
export const CLOUD_RADIUS = GLOBE_RADIUS + 7;
export const ATMOSPHERE_RADIUS = GLOBE_RADIUS * 1.025;
export const STARFIELD_RADIUS = 400_000;

/** Camera limits. Min altitude keeps float32 jitter far below one pixel. */
export const MIN_CAMERA_ALTITUDE_KM = 30;
export const MAX_CAMERA_DISTANCE = 350_000;
export const DEFAULT_FOV_DEG = 50;
export const CAMERA_FAR = 500_000;
