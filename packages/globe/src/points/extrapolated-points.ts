import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three';
import { EARTH_OCCLUSION_RADIUS_KM, MU_EARTH } from '@earthos/gis';

/**
 * The 100k moving-objects pipeline.
 *
 * Workers deliver (position, velocity) batches roughly once per 10-30 sim
 * seconds; the vertex shader extrapolates per frame:
 *
 *     p(t) = p0 + v0 * dt - 0.5 * mu * p0 / |p0|^3 * dt^2
 *
 * so the per-frame main-thread cost is one uniform write. One THREE.Points
 * per layer = one draw call. Horizon (behind-the-Earth) culling happens in
 * the vertex shader; frustum culling is free GPU clipping.
 */

const VERT = /* glsl */ `
attribute vec3 aVel;
attribute float aT0;
attribute vec4 aMeta; // x: palette index, y: size px, z: flags(0 hidden), w: highlight
uniform float uNow;
uniform float uMu;
uniform float uOcclusionRadius;
uniform float uPixelRatio;
uniform float uShape; // 0 = dot, 1 = heading arrow
uniform float uAspect;
uniform float uMaxDt; // clamp |uNow - aT0|: Taylor extrapolation diverges past it
uniform vec3 uPalette[8];
varying vec3 vColor;
varying float vHighlight;
varying float vAngle;

void main() {
  // Bound the extrapolation window. At extreme time rates the sim clock races
  // ahead of the worker's next snapshot; without this clamp the 2nd-order
  // Taylor term flings orbital points off on tangents (an expanding halo).
  // Clamped, each point freezes on-orbit at its last-good position until the
  // next batch arrives, then snaps forward. Symmetric so reverse time matches.
  float dt = clamp(uNow - aT0, -uMaxDt, uMaxDt);
  vec3 p = position + aVel * dt;
  if (uMu > 0.0) {
    float r2 = dot(position, position);
    if (r2 > 1.0) {
      p -= (0.5 * uMu * dt * dt / (r2 * sqrt(r2))) * position;
    }
  }
  vec4 world = modelMatrix * vec4(p, 1.0);

  // Occlusion by the Earth (world origin): closest approach of the
  // camera->point segment to the Earth's center.
  vec3 d = world.xyz - cameraPosition;
  float dd = max(dot(d, d), 1e-6);
  float t = clamp(dot(-cameraPosition, d) / dd, 0.0, 1.0);
  vec3 closest = cameraPosition + t * d;
  bool occluded = t > 0.001 && t < 0.999
    && dot(closest, closest) < uOcclusionRadius * uOcclusionRadius;
  bool hidden = aMeta.z < 0.5 || occluded;

  if (hidden) {
    gl_Position = vec4(2e10, 2e10, 2e10, 1.0);
    gl_PointSize = 0.0;
    vColor = vec3(0.0);
    vHighlight = 0.0;
    return;
  }

  vec4 clipA = projectionMatrix * viewMatrix * world;
  gl_Position = clipA;
  gl_PointSize = aMeta.y * uPixelRatio * (1.0 + aMeta.w * 0.9);
  int ci = int(aMeta.x + 0.5);
  vColor = uPalette[ci];
  vHighlight = aMeta.w;
  vAngle = 0.0;
  if (uShape > 0.5 && dot(aVel, aVel) > 1e-10) {
    // Screen-space direction of motion: project a point one minute ahead.
    vec4 worldB = modelMatrix * vec4(p + aVel * 60.0, 1.0);
    vec4 clipB = projectionMatrix * viewMatrix * worldB;
    vec2 dir = clipB.xy / clipB.w - clipA.xy / clipA.w;
    dir.x *= uAspect;
    if (dot(dir, dir) > 1e-12) vAngle = atan(dir.y, dir.x);
  }
}
`;

const FRAG = /* glsl */ `
uniform float uShape;
varying vec3 vColor;
varying float vHighlight;
varying float vAngle;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  c.y = -c.y; // gl_PointCoord is y-down
  float alpha;
  if (uShape > 0.5) {
    // Dart aligned to the motion direction (nose along +x before rotation).
    float ca = cos(vAngle);
    float sa = sin(vAngle);
    vec2 q = vec2(ca * c.x + sa * c.y, -sa * c.x + ca * c.y);
    float t = clamp(q.x + 0.5, 0.0, 1.0); // tail 0 .. nose 1
    float halfWidth = mix(0.30, 0.015, t);
    float inside = step(abs(q.y), halfWidth) * step(-0.42, q.x) * step(q.x, 0.5);
    // Notched tail so the dart reads as an aircraft, not a triangle.
    inside *= 1.0 - step(abs(q.y), halfWidth * 0.4) * step(q.x, -0.22);
    if (inside < 0.5) discard;
    alpha = 0.95;
  } else {
    float r = length(c);
    if (r > 0.5) discard;
    alpha = smoothstep(0.5, 0.30, r) * 0.95;
  }
  vec3 col = vColor * (1.0 + vHighlight * 1.2);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;

/** Rebase horizon: keeps float32 seconds precise (~0.6 ms ULP at 2h). */
const REBASE_AFTER_SEC = 7200;

export interface ExtrapolatedPointsOptions {
  capacity: number;
  /** MU_EARTH for orbital layers, 0 for earth-fixed dead-reckoning layers. */
  mu?: number;
  /** Up to 8 colors selectable per point via meta palette index. */
  palette?: string[];
  occlusionRadiusKm?: number;
  pixelRatio?: number;
  /** 'arrow' rotates a dart glyph along the motion direction (aircraft). */
  shape?: 'dot' | 'arrow';
  /**
   * Max |sim - epoch| seconds the Taylor extrapolation is trusted. Beyond it
   * points freeze on their last-good arc instead of diverging at high time
   * rates. Default effectively unbounded; orbital layers should set ~120 s.
   */
  maxExtrapolationSec?: number;
}

export interface BatchView {
  /** interleaved x,y,z,vx,vy,vz per object, km / km-per-s, layer frame */
  posVel: Float32Array;
  count: number;
  /** absolute sim epoch of the batch, ms */
  t0Ms: number;
  /** first object index this batch writes */
  offset: number;
}

export class ExtrapolatedPointsLayer {
  readonly geometry: BufferGeometry;
  readonly material: ShaderMaterial;
  readonly points: Points;
  readonly capacity: number;

  private position: Float32Array;
  private vel: Float32Array;
  private t0: Float32Array;
  private meta: Float32Array;
  private posAttr: BufferAttribute;
  private velAttr: BufferAttribute;
  private t0Attr: BufferAttribute;
  private metaAttr: BufferAttribute;
  private epochBaseMs: number | null = null;
  private count = 0;
  private readonly mu: number;
  private readonly maxDtSec: number;

  constructor(opts: ExtrapolatedPointsOptions) {
    this.capacity = opts.capacity;
    this.mu = opts.mu ?? MU_EARTH;
    // 1e9 s (~32 years) is an effective no-op, preserving unbounded layers.
    this.maxDtSec = opts.maxExtrapolationSec ?? 1e9;
    this.position = new Float32Array(opts.capacity * 3);
    this.vel = new Float32Array(opts.capacity * 3);
    this.t0 = new Float32Array(opts.capacity);
    this.meta = new Float32Array(opts.capacity * 4);

    this.geometry = new BufferGeometry();
    this.posAttr = new BufferAttribute(this.position, 3);
    this.velAttr = new BufferAttribute(this.vel, 3);
    this.t0Attr = new BufferAttribute(this.t0, 1);
    this.metaAttr = new BufferAttribute(this.meta, 4);
    for (const attr of [this.posAttr, this.velAttr, this.t0Attr, this.metaAttr]) {
      attr.setUsage(DynamicDrawUsage);
    }
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aVel', this.velAttr);
    this.geometry.setAttribute('aT0', this.t0Attr);
    this.geometry.setAttribute('aMeta', this.metaAttr);
    this.geometry.setDrawRange(0, 0);
    // Never let three compute bounds from extrapolated data.
    this.geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0), 500_000);

    const palette = (opts.palette ?? ['#7dd3fc']).slice(0, 8).map((c) => new Color(c));
    while (palette.length < 8) palette.push(palette[palette.length - 1]!.clone());

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uNow: { value: 0 },
        uMu: { value: this.mu },
        uOcclusionRadius: { value: opts.occlusionRadiusKm ?? EARTH_OCCLUSION_RADIUS_KM },
        uPixelRatio: { value: opts.pixelRatio ?? 1 },
        uShape: { value: opts.shape === 'arrow' ? 1 : 0 },
        uAspect: { value: 1 },
        uMaxDt: { value: this.maxDtSec },
        uPalette: { value: palette },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  get activeCount(): number {
    return this.count;
  }

  get epochBase(): number | null {
    return this.epochBaseMs;
  }

  setPixelRatio(dpr: number): void {
    this.material.uniforms.uPixelRatio!.value = dpr;
  }

  /** Viewport aspect (width/height): needed for screen-space arrow angles. */
  setAspect(aspect: number): void {
    this.material.uniforms.uAspect!.value = aspect;
  }

  /** Total number of live objects (draw range). */
  setCount(n: number): void {
    this.count = Math.min(n, this.capacity);
    this.geometry.setDrawRange(0, this.count);
  }

  /** Adopt a worker batch (interleaved pos+vel) for an index range. */
  writeBatch(batch: BatchView): void {
    const { posVel, count, t0Ms, offset } = batch;
    if (offset + count > this.capacity) throw new Error('batch exceeds capacity');
    if (this.epochBaseMs === null) this.epochBaseMs = t0Ms;
    const t0Sec = (t0Ms - this.epochBaseMs) / 1000;

    for (let i = 0; i < count; i++) {
      const src = i * 6;
      const dst = (offset + i) * 3;
      this.position[dst] = posVel[src]!;
      this.position[dst + 1] = posVel[src + 1]!;
      this.position[dst + 2] = posVel[src + 2]!;
      this.vel[dst] = posVel[src + 3]!;
      this.vel[dst + 1] = posVel[src + 4]!;
      this.vel[dst + 2] = posVel[src + 5]!;
      this.t0[offset + i] = t0Sec;
    }
    this.markRange(this.posAttr, offset * 3, count * 3);
    this.markRange(this.velAttr, offset * 3, count * 3);
    this.markRange(this.t0Attr, offset, count);
  }

  /** Per-object display metadata. */
  setMeta(
    index: number,
    paletteIndex: number,
    sizePx: number,
    visible: boolean,
    highlight = 0,
  ): void {
    const base = index * 4;
    this.meta[base] = Math.min(7, Math.max(0, paletteIndex));
    this.meta[base + 1] = sizePx;
    this.meta[base + 2] = visible ? 1 : 0;
    this.meta[base + 3] = highlight;
    this.markRange(this.metaAttr, base, 4);
  }

  setHighlight(index: number, highlight: number): void {
    const base = index * 4;
    this.meta[base + 3] = highlight;
    this.markRange(this.metaAttr, base, 4);
  }

  /** Batch visibility flags from a worker validity mask (decayed objects). */
  applyValidity(offset: number, valid: Uint8Array): void {
    for (let i = 0; i < valid.length; i++) {
      this.meta[(offset + i) * 4 + 2] = valid[i]! ? 1 : 0;
    }
    this.markRange(this.metaAttr, offset * 4, valid.length * 4);
  }

  /** Update one palette slot in place (settings-driven recolor). */
  setPaletteColor(index: number, color: string): void {
    const arr = this.material.uniforms.uPalette!.value as Color[];
    arr[index]?.set(color);
  }

  /** Fill meta for a range in one call (initial load). */
  fillMeta(offset: number, count: number, paletteIndex: number, sizePx: number): void {
    for (let i = offset; i < offset + count; i++) {
      const base = i * 4;
      this.meta[base] = paletteIndex;
      this.meta[base + 1] = sizePx;
      this.meta[base + 2] = 1;
      this.meta[base + 3] = 0;
    }
    this.markRange(this.metaAttr, offset * 4, count * 4);
  }

  /**
   * Per-frame time update: one uniform write. Rebases the epoch when the
   * offset grows past float32 comfort.
   */
  updateTime(nowMs: number): void {
    if (this.epochBaseMs === null) this.epochBaseMs = nowMs;
    let nowSec = (nowMs - this.epochBaseMs) / 1000;
    if (Math.abs(nowSec) > REBASE_AFTER_SEC) {
      const deltaSec = nowSec;
      for (let i = 0; i < this.capacity; i++) this.t0[i] = this.t0[i]! - deltaSec;
      this.t0Attr.needsUpdate = true;
      this.epochBaseMs = nowMs;
      nowSec = 0;
    }
    this.material.uniforms.uNow!.value = nowSec;
  }

  /** Current uNow in seconds (for CPU-side picking against the same math). */
  get nowSec(): number {
    return this.material.uniforms.uNow!.value as number;
  }

  /** Raw views for CPU picking/search. Do not mutate. */
  views(): {
    position: Float32Array;
    vel: Float32Array;
    t0: Float32Array;
    meta: Float32Array;
    count: number;
    mu: number;
    maxDtSec: number;
  } {
    return {
      position: this.position,
      vel: this.vel,
      t0: this.t0,
      meta: this.meta,
      count: this.count,
      mu: this.mu,
      maxDtSec: this.maxDtSec,
    };
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private markRange(attr: BufferAttribute, start: number, count: number): void {
    attr.addUpdateRange(start, count);
    attr.needsUpdate = true;
  }
}
