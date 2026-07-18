import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { EonetEvent, EonetResponse, Wildfire, WildfireFeed } from './types';

const DEFAULT_ENDPOINT = 'https://eonet.gsfc.nasa.gov/api/v3/events';

/** Most recent Point in an event's track → a flat wildfire, or null. */
export function latestPoint(event: EonetEvent): Wildfire | null {
  const geo = [...(event.geometry ?? [])].reverse().find((g) => g.type === 'Point');
  if (!geo || !Array.isArray(geo.coordinates) || geo.coordinates.length < 2) return null;
  const [lon, lat] = geo.coordinates as number[];
  if (typeof lon !== 'number' || typeof lat !== 'number') return null;
  const date = Date.parse(geo.date);
  return {
    id: event.id,
    title: event.title,
    lat,
    lon,
    date: Number.isFinite(date) ? date : 0,
  };
}

/**
 * NASA EONET active-fire events (keyless, CORS-open). EONET curates natural
 * events from many sources; fires arrive as tracks, so we take each event's
 * most recent Point. A full snapshot each poll — no merge needed.
 */
export class EonetWildfireProvider extends DataProvider<WildfireFeed> {
  readonly id = 'eonet-wildfires';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 10 * 60_000, jitterMs: 60_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 15 * 60_000, maxAgeMs: 24 * 3_600_000 },
      retry: { maxAttempts: 3, baseDelayMs: 5_000, honorRetryAfter: true },
      rateLimit: { tokensPerMinute: 6, scope: 'origin' },
    };
  }

  async fetch(io: FetchIO): Promise<WildfireFeed> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
    const status = io.settings.status === 'all' ? 'all' : 'open';
    const days = typeof io.settings.days === 'number' ? Math.round(io.settings.days) : 10;

    const url = `${endpoint}?category=wildfires&status=${status}&days=${days}`;
    const res = await io.fetch(url);
    const json = (await res.json()) as EonetResponse;
    if (!Array.isArray(json?.events)) throw new Error('unexpected EONET response shape');

    const fires: Wildfire[] = [];
    for (const event of json.events) {
      const fire = latestPoint(event);
      if (fire) fires.push(fire);
    }
    return { fires };
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new EonetWildfireProvider() as ProviderInstance<unknown>;

export default createProvider;
