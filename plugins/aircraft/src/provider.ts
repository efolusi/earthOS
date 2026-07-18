import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { AdsbV2Aircraft, AdsbV2Raw, AircraftFeed, AircraftState, OpenSkyRaw } from './types';

const OPENSKY_ENDPOINT = 'https://opensky-network.org/api/states/all';
const AIRPLANESLIVE_ENDPOINT = 'https://api.airplanes.live/v2/point';

const KT_TO_MS = 0.514444;
const FT_TO_M = 0.3048;
const FPM_TO_MS = 0.00508;
/** airplanes.live caps point queries at 250 nm around the center. */
const MAX_RADIUS_NM = 250;
const MIN_RADIUS_NM = 80;

/** Parse one OpenSky positional state array; null when unusable. */
export function parseState(raw: Array<string | number | boolean | null>): AircraftState | null {
  const lon = raw[5];
  const lat = raw[6];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  const icao24 = typeof raw[0] === 'string' ? raw[0] : null;
  if (!icao24) return null;
  const baroAlt = typeof raw[7] === 'number' ? raw[7] : null;
  const geoAlt = typeof raw[13] === 'number' ? raw[13] : null;
  return {
    icao24,
    callsign: typeof raw[1] === 'string' ? raw[1].trim() : '',
    // OpenSky ships origin_country directly; keep it as the source value.
    country: typeof raw[2] === 'string' ? raw[2].trim() : '',
    airframe: '',
    lon,
    lat,
    altM: baroAlt ?? geoAlt ?? 0,
    onGround: raw[8] === true,
    velocityMs: typeof raw[9] === 'number' ? raw[9] : 0,
    trackDeg: typeof raw[10] === 'number' ? raw[10] : 0,
    verticalRateMs: typeof raw[11] === 'number' ? raw[11] : 0,
    timePosition: typeof raw[3] === 'number' ? raw[3] : 0,
  };
}

/** Parse one readsb-style v2 aircraft; null when it has no position. */
export function parseAdsbV2(ac: AdsbV2Aircraft, snapshotSec: number): AircraftState | null {
  if (typeof ac.lat !== 'number' || typeof ac.lon !== 'number' || !ac.hex) return null;
  const onGround = ac.alt_baro === 'ground';
  const altFt =
    typeof ac.alt_baro === 'number' ? ac.alt_baro : typeof ac.alt_geom === 'number' ? ac.alt_geom : 0;
  const rateFpm = typeof ac.baro_rate === 'number' ? ac.baro_rate : (ac.geom_rate ?? 0);
  return {
    icao24: ac.hex,
    callsign: typeof ac.flight === 'string' ? ac.flight.trim() : '',
    // ADS-B v2 carries no country; it is derived from icao24 at display time.
    country: '',
    airframe: ac.desc ?? ac.t ?? '',
    lon: ac.lon,
    lat: ac.lat,
    altM: onGround ? 0 : altFt * FT_TO_M,
    onGround,
    velocityMs: (ac.gs ?? 0) * KT_TO_MS,
    trackDeg: ac.track ?? 0,
    verticalRateMs: rateFpm * FPM_TO_MS,
    timePosition: snapshotSec - (ac.seen_pos ?? 0),
  };
}

/**
 * Live aircraft states. Default source is airplanes.live (keyless, CORS-open,
 * readsb v2 point queries scoped to the viewport). OpenSky remains selectable
 * for deployments that proxy authenticated global access via the endpoint
 * setting; its CORS policy and its blocking of cloud egress IPs make it
 * unusable browser-direct or from serverless hosts.
 */
export class AircraftProvider extends DataProvider<AircraftFeed> {
  readonly id = 'opensky-states'; // stable id: renderer + caches reference it

  constructor() {
    super();
    this.policyOverrides = {
      refresh: {
        intervalMs: 60_000,
        jitterMs: 10_000,
        pauseWhenHidden: true,
        viewportScoped: true,
      },
      cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 30 * 60_000 },
      retry: { maxAttempts: 2, baseDelayMs: 15_000, honorRetryAfter: true },
      rateLimit: { tokensPerMinute: 6, burst: 3, scope: 'origin' },
    };
  }

  protected override cacheKey(settings: Record<string, unknown>): string {
    const source =
      typeof settings.dataSource === 'string' ? settings.dataSource : 'airplaneslive';
    const max = typeof settings.maxAircraft === 'number' ? settings.maxAircraft : 20_000;
    return `latest:${source}:${max}`;
  }

  async fetch(io: FetchIO): Promise<AircraftFeed> {
    const source =
      typeof io.settings.dataSource === 'string' ? io.settings.dataSource : 'airplaneslive';
    return source === 'opensky' ? this.fetchOpenSky(io) : this.fetchAirplanesLive(io);
  }

  private async fetchAirplanesLive(io: FetchIO): Promise<AircraftFeed> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : AIRPLANESLIVE_ENDPOINT;
    const max = typeof io.settings.maxAircraft === 'number' ? io.settings.maxAircraft : 20_000;
    const vp = io.viewport;
    const radiusNm = Math.round(
      Math.min(MAX_RADIUS_NM, Math.max(MIN_RADIUS_NM, (vp.altKm || 12_000) * 0.55)),
    );
    const url = `${endpoint}/${vp.lat.toFixed(2)}/${vp.lon.toFixed(2)}/${radiusNm}`;

    const res = await io.fetch(url);
    const raw = (await res.json()) as AdsbV2Raw;
    if (!Array.isArray(raw?.ac)) throw new Error('unexpected airplanes.live response shape');
    // `now` is unix ms in airplanes.live responses; guard seconds just in case.
    const nowSec =
      typeof raw.now === 'number' ? (raw.now > 1e12 ? raw.now / 1000 : raw.now) : Date.now() / 1000;

    const states: AircraftState[] = [];
    for (const entry of raw.ac) {
      const state = parseAdsbV2(entry, nowSec);
      if (state) states.push(state);
      if (states.length >= max) break;
    }
    return { time: Math.round(nowSec), states };
  }

  private async fetchOpenSky(io: FetchIO): Promise<AircraftFeed> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : OPENSKY_ENDPOINT;
    const max = typeof io.settings.maxAircraft === 'number' ? io.settings.maxAircraft : 20_000;

    const res = await io.fetch(endpoint);
    const raw = (await res.json()) as OpenSkyRaw;
    if (typeof raw?.time !== 'number') throw new Error('unexpected OpenSky response shape');

    const states: AircraftState[] = [];
    for (const entry of raw.states ?? []) {
      const state = parseState(entry);
      if (state) states.push(state);
      if (states.length >= max) break;
    }
    return { time: raw.time, states };
  }
}

/** @deprecated renamed; kept for import compatibility */
export const OpenSkyProvider = AircraftProvider;

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new AircraftProvider() as ProviderInstance<unknown>;

export default createProvider;
