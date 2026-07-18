import type { EarthEngine, EntityRef } from '@earthos/core';

/**
 * Shareable state in the URL hash: camera, time, layers, selection.
 *   #lat=-6.2&lon=106.8&alt=400&t=1786500000000&rate=100&layers=imagery,satellites&sel=aircraft:ab6fdd
 * `?embed` (query, not hash) additionally strips the chrome for iframes.
 */

export interface PermalinkState {
  lat?: number;
  lon?: number;
  altKm?: number;
  /** absolute sim epoch ms; undefined = live */
  tMs?: number;
  rate?: number;
  layers?: string[];
  sel?: EntityRef;
}

export function readPermalink(): PermalinkState {
  if (typeof window === 'undefined' || !window.location.hash) return {};
  const params = new URLSearchParams(window.location.hash.slice(1));
  const num = (key: string) => {
    const raw = params.get(key);
    const value = raw === null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const state: PermalinkState = {};
  const lat = num('lat');
  const lon = num('lon');
  const alt = num('alt');
  if (lat !== undefined && lon !== undefined) {
    state.lat = lat;
    state.lon = lon;
    state.altKm = alt ?? 12_000;
  }
  const t = num('t');
  if (t !== undefined) state.tMs = t;
  const rate = num('rate');
  if (rate !== undefined) state.rate = rate;
  const layers = params.get('layers');
  if (layers) state.layers = layers.split(',').filter(Boolean);
  const sel = params.get('sel');
  if (sel?.includes(':')) {
    const [layerId, entityId] = sel.split(':');
    if (layerId && entityId) state.sel = { layerId, entityId };
  }
  return state;
}

/** Apply time + selection (camera is seeded pre-mount by the caller). */
export function applyPermalinkDynamics(engine: EarthEngine, state: PermalinkState): void {
  if (state.tMs !== undefined) {
    engine.time.jumpTo(state.tMs);
    if (state.rate !== undefined) engine.time.setRate(state.rate);
  } else if (state.rate !== undefined && state.rate !== 1) {
    engine.time.setRate(state.rate);
  }
  if (state.sel) engine.store.getState().setSelected(state.sel);
}

export function buildPermalink(engine: EarthEngine): string {
  const s = engine.store.getState();
  const params = new URLSearchParams();
  params.set('lat', s.camera.lat.toFixed(3));
  params.set('lon', s.camera.lon.toFixed(3));
  params.set('alt', String(Math.round(s.camera.altKm)));
  if (!engine.time.live) {
    params.set('t', String(Math.round(engine.time.now())));
    params.set('rate', String(engine.time.rate));
  }
  const active = Object.entries(s.layers)
    .filter(([, layer]) => layer.status === 'active' || layer.status === 'loading')
    .map(([id]) => id);
  if (active.length > 0) params.set('layers', active.join(','));
  if (s.selection.picked) {
    params.set('sel', `${s.selection.picked.layerId}:${s.selection.picked.entityId}`);
  }
  return `#${params.toString()}`;
}

/** Keep the URL hash in sync (debounced) so copy-address always shares. */
export function startPermalinkSync(engine: EarthEngine): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const hash = buildPermalink(engine);
      if (hash !== window.location.hash) {
        window.history.replaceState(null, '', hash);
      }
    }, 800);
  };
  const unsubStore = engine.store.subscribe(schedule);
  const unsubTime = engine.time.onChange(schedule);
  return () => {
    if (timer) clearTimeout(timer);
    unsubStore();
    unsubTime();
  };
}

export function isEmbed(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('embed');
}

/** Minimal iframe control surface: parent pages post commands. */
export function startEmbedApi(engine: EarthEngine): () => void {
  const onMessage = (event: MessageEvent) => {
    const data = event.data as { type?: string; [key: string]: unknown } | null;
    if (!data || typeof data.type !== 'string' || !data.type.startsWith('earthos:')) return;
    if (
      data.type === 'earthos:flyTo' &&
      typeof data.lat === 'number' &&
      typeof data.lon === 'number'
    ) {
      engine.events.emit('core:camera:flyTo', {
        lat: data.lat,
        lon: data.lon,
        altKm: typeof data.altKm === 'number' ? data.altKm : undefined,
      });
    } else if (data.type === 'earthos:setRate' && typeof data.rate === 'number') {
      engine.time.setRate(data.rate);
    } else if (data.type === 'earthos:live') {
      engine.time.resumeLive();
    } else if (
      data.type === 'earthos:setLayer' &&
      typeof data.id === 'string' &&
      typeof data.enabled === 'boolean'
    ) {
      void engine.setLayerEnabled(data.id, data.enabled).catch(() => undefined);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}
