import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Texture,
} from 'three';
import { geodeticToScene } from '@earthos/gis';
import {
  childrenOf,
  computeVisibleTiles,
  mercatorV,
  parentOf,
  tileBounds,
  tileKey,
  type TileId,
} from './quadtree';

/** Grid resolution per tile mesh (curved quad). */
const GRID = 8;
/** Tile drape altitude; deeper zooms sit higher so children cover parents. */
const BASE_ALT_KM = 4;
const ALT_PER_ZOOM_KM = 0.25;
const MAX_CACHED_TILES = 220;
const MAX_CONCURRENT_FETCHES = 8;

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalDir;
void main() {
  vUv = uv;
  vNormalDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSunDirLocal;
varying vec2 vUv;
varying vec3 vNormalDir;
void main() {
  vec3 tex = texture2D(uMap, vUv).rgb;
  // Match the base globe's day/night response so tiles blend at the terminator.
  float ndots = dot(vNormalDir, uSunDirLocal);
  float light = max(ndots, 0.0) * 1.25 + 0.02;
  float dayF = smoothstep(-0.12, 0.12, ndots);
  gl_FragColor = vec4(tex * light * dayF + tex * 0.02, 1.0);
  #include <colorspace_fragment>
}
`;

interface TileEntry {
  id: TileId;
  state: 'loading' | 'ready' | 'failed';
  mesh: Mesh | null;
  texture: Texture | null;
  lastWanted: number;
}

/**
 * Streams and drapes web-mercator raster tiles on the globe. Lives outside
 * React: the renderer calls `update` at ~4 Hz with the camera's earth-fixed
 * position and the local-frame sun direction, and mounts `group` in the
 * rotating frame. Textures are LRU-evicted; a coarser ancestor stays visible
 * until all four children of a refined tile have arrived.
 */
export class TileEngine {
  readonly group = new Group();
  private tiles = new Map<string, TileEntry>();
  private loader = new TextureLoader();
  private inflight = 0;
  private fetchQueue: TileEntry[] = [];
  private generation = 0;
  private sunUniform = { value: new Vector3(1, 0, 0) };

  constructor(
    private template: string,
    private maxZoom: number,
  ) {
    this.loader.setCrossOrigin('anonymous');
  }

  setSource(template: string, maxZoom: number): void {
    if (template === this.template && maxZoom === this.maxZoom) return;
    this.template = template;
    this.maxZoom = maxZoom;
    this.disposeAll();
  }

  setSunDirLocal(x: number, y: number, z: number): void {
    this.sunUniform.value.set(x, y, z);
  }

  update(camLocal: [number, number, number], viewportHeightPx: number, fovYDeg: number): void {
    this.generation += 1;
    const desired = computeVisibleTiles({
      camLocal,
      viewportHeightPx,
      fovYDeg,
      maxZoom: this.maxZoom,
    });

    const wantedKeys = new Set<string>();
    for (const id of desired) {
      wantedKeys.add(tileKey(id));
      // Keep coarser ancestors warm as fallback while children stream in.
      let p = parentOf(id);
      while (p && p.z >= 3) {
        wantedKeys.add(tileKey(p));
        p = parentOf(p);
      }
    }

    for (const key of wantedKeys) {
      const [z, x, y] = key.split('/').map(Number);
      let entry = this.tiles.get(key);
      if (!entry) {
        entry = {
          id: { z: z!, x: x!, y: y! },
          state: 'loading',
          mesh: null,
          texture: null,
          lastWanted: 0,
        };
        this.tiles.set(key, entry);
        this.fetchQueue.push(entry);
      }
      entry.lastWanted = this.generation;
    }
    this.pumpQueue();

    // Visibility: a desired tile shows when ready; otherwise its nearest
    // ready ancestor covers the hole. Ancestors of fully-ready children hide.
    const showKeys = new Set<string>();
    for (const id of desired) {
      let cursor: TileId | null = id;
      while (cursor && cursor.z >= 3) {
        const entry = this.tiles.get(tileKey(cursor));
        if (entry?.state === 'ready') {
          showKeys.add(tileKey(cursor));
          break;
        }
        cursor = parentOf(cursor);
      }
    }
    for (const entry of this.tiles.values()) {
      if (entry.mesh) entry.mesh.visible = showKeys.has(tileKey(entry.id));
    }

    this.evict();
  }

  private pumpQueue(): void {
    this.fetchQueue.sort((a, b) => a.id.z - b.id.z); // coarse first
    while (this.inflight < MAX_CONCURRENT_FETCHES && this.fetchQueue.length > 0) {
      const entry = this.fetchQueue.shift()!;
      if (entry.state !== 'loading') continue;
      this.inflight += 1;
      const url = this.template
        .replaceAll('{z}', String(entry.id.z))
        .replaceAll('{x}', String(entry.id.x))
        .replaceAll('{y}', String(entry.id.y));
      this.loader.load(
        url,
        (texture) => {
          this.inflight -= 1;
          texture.colorSpace = SRGBColorSpace;
          texture.anisotropy = 8;
          entry.texture = texture;
          entry.mesh = this.buildMesh(entry.id, texture);
          entry.mesh.visible = false;
          this.group.add(entry.mesh);
          entry.state = 'ready';
          this.pumpQueue();
        },
        undefined,
        () => {
          this.inflight -= 1;
          entry.state = 'failed';
          this.pumpQueue();
        },
      );
    }
  }

  private buildMesh(id: TileId, texture: Texture): Mesh {
    const b = tileBounds(id);
    const altKm = BASE_ALT_KM + id.z * ALT_PER_ZOOM_KM;
    const verts = (GRID + 1) * (GRID + 1);
    const positions = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const scratch: [number, number, number] = [0, 0, 0];
    let i = 0;
    for (let row = 0; row <= GRID; row++) {
      // Rows are uniform in MERCATOR space so texels stay square.
      const v = row / GRID;
      const lat = mercatorLatAt(b.northDeg, b.southDeg, v);
      for (let col = 0; col <= GRID; col++) {
        const lon = b.westDeg + ((b.eastDeg - b.westDeg) * col) / GRID;
        geodeticToScene(lat, lon, altKm, scratch);
        positions[i * 3] = scratch[0];
        positions[i * 3 + 1] = scratch[1];
        positions[i * 3 + 2] = scratch[2];
        uvs[i * 2] = col / GRID;
        uvs[i * 2 + 1] = 1 - mercatorV(lat, b);
        i += 1;
      }
    }
    const indices: number[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        const a = row * (GRID + 1) + col;
        const d = a + GRID + 1;
        indices.push(a, d, a + 1, a + 1, d, d + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMap: { value: texture }, uSunDirLocal: this.sunUniform },
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = id.z; // deeper tiles draw over their ancestors
    return mesh;
  }

  private evict(): void {
    if (this.tiles.size <= MAX_CACHED_TILES) return;
    const entries = [...this.tiles.values()].sort((a, b) => a.lastWanted - b.lastWanted);
    const doomed = entries.slice(0, this.tiles.size - MAX_CACHED_TILES);
    for (const entry of doomed) {
      if (entry.lastWanted === this.generation) continue; // still wanted
      this.disposeEntry(entry);
      this.tiles.delete(tileKey(entry.id));
    }
  }

  private disposeEntry(entry: TileEntry): void {
    if (entry.mesh) {
      this.group.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      (entry.mesh.material as ShaderMaterial).dispose();
    }
    entry.texture?.dispose();
  }

  disposeAll(): void {
    for (const entry of this.tiles.values()) this.disposeEntry(entry);
    this.tiles.clear();
    this.fetchQueue = [];
  }

  get stats(): { cached: number; visible: number } {
    let visible = 0;
    for (const entry of this.tiles.values()) if (entry.mesh?.visible) visible += 1;
    return { cached: this.tiles.size, visible };
  }
}

/** Latitude at mercator-linear fraction v between a tile's north and south. */
function mercatorLatAt(northDeg: number, southDeg: number, v: number): number {
  const merc = (lat: number) => Math.asinh(Math.tan((lat * Math.PI) / 180));
  const top = merc(northDeg);
  const bottom = merc(southDeg);
  const m = top + (bottom - top) * v;
  return (Math.atan(Math.sinh(m)) * 180) / Math.PI;
}

// re-exported for the renderer's coarse-first warmup
export { childrenOf };
