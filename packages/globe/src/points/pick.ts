import { EARTH_OCCLUSION_RADIUS_KM } from '@earthos/gis';

export interface PickSource {
  position: Float32Array; // stride 3, layer-frame km
  vel: Float32Array; // stride 3, km/s
  t0: Float32Array; // seconds relative to layer epoch
  meta: Float32Array; // stride 4; meta[i*4+2] < 0.5 means hidden
  count: number;
  mu: number;
}

/**
 * CPU picking with EXACTLY the same extrapolation the GPU draws, so the hit
 * test matches what is on screen. Brute force: at 10-100k objects this is a
 * few hundred microseconds on click, and only runs on click/hover ticks.
 *
 * `origin`/`dir` must be in the LAYER's local frame (world for inertial
 * layers; callers of earth-fixed layers transform the ray first).
 * Returns the picked index or -1.
 */
export function pickExtrapolated(
  src: PickSource,
  nowSec: number,
  origin: readonly [number, number, number],
  dir: readonly [number, number, number],
  tolRad: number,
  occlusionRadiusKm = EARTH_OCCLUSION_RADIUS_KM,
): number {
  const { position, vel, t0, meta, count, mu } = src;
  const tan2 = Math.tan(tolRad) ** 2;
  const occ2 = occlusionRadiusKm * occlusionRadiusKm;
  const [ox, oy, oz] = origin;
  const [dx, dy, dz] = dir;

  let best = -1;
  let bestPerpRatio = tan2;

  for (let i = 0; i < count; i++) {
    if (meta[i * 4 + 2]! < 0.5) continue;
    const b = i * 3;
    const dt = nowSec - t0[i]!;
    let px = position[b]!;
    let py = position[b + 1]!;
    let pz = position[b + 2]!;
    if (mu > 0) {
      const r2 = px * px + py * py + pz * pz;
      if (r2 > 1) {
        const k = (0.5 * mu * dt * dt) / (r2 * Math.sqrt(r2));
        px -= k * px;
        py -= k * py;
        pz -= k * pz;
      }
    }
    px += vel[b]! * dt;
    py += vel[b + 1]! * dt;
    pz += vel[b + 2]! * dt;

    const vx = px - ox;
    const vy = py - oy;
    const vz = pz - oz;
    const along = vx * dx + vy * dy + vz * dz;
    if (along <= 0) continue;
    const len2 = vx * vx + vy * vy + vz * vz;
    const perp2 = Math.max(0, len2 - along * along);
    const ratio = perp2 / (along * along);
    if (ratio >= bestPerpRatio) continue;

    // Earth occlusion: closest approach of the origin->point segment.
    const t = Math.min(1, Math.max(0, -(ox * vx + oy * vy + oz * vz) / len2));
    if (t > 0.001 && t < 0.999) {
      const cx = ox + t * vx;
      const cy = oy + t * vy;
      const cz = oz + t * vz;
      if (cx * cx + cy * cy + cz * cz < occ2) continue;
    }

    bestPerpRatio = ratio;
    best = i;
  }
  return best;
}

/** Angular pick tolerance for a click, from pixel radius and viewport. */
export function pickToleranceRad(pixelRadius: number, viewportHeightPx: number, fovYDeg: number): number {
  return (pixelRadius / viewportHeightPx) * (fovYDeg * Math.PI) / 180;
}
