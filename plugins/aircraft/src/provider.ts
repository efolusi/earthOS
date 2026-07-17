import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { AircraftFeed, AircraftState, OpenSkyRaw } from './types';

const DEFAULT_ENDPOINT = 'https://opensky-network.org/api/states/all';

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
    country: typeof raw[2] === 'string' ? raw[2] : '',
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

/**
 * OpenSky global state vectors. Anonymous access serves ~10 s resolution
 * with a small daily credit budget: poll gently (60 s + jitter), keep
 * last-good data through 429s, and let deployments proxy authenticated
 * access via the endpoint setting.
 */
export class OpenSkyProvider extends DataProvider<AircraftFeed> {
  readonly id = 'opensky-states';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 10_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 30 * 60_000 },
      retry: { maxAttempts: 2, baseDelayMs: 15_000, honorRetryAfter: true },
      rateLimit: { tokensPerMinute: 2, burst: 2, scope: 'origin' },
    };
  }

  async fetch(io: FetchIO): Promise<AircraftFeed> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
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

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new OpenSkyProvider() as ProviderInstance<unknown>;

export default createProvider;
