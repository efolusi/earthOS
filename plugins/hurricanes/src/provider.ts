import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { Storm, StormFeed } from './types';

const DEFAULT_ENDPOINT = 'https://www.nhc.noaa.gov/CurrentStorms.json';

interface NhcRaw {
  activeStorms?: Array<Record<string, unknown>>;
}

export class NhcStormsProvider extends DataProvider<StormFeed> {
  readonly id = 'nhc-storms';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 15 * 60_000, jitterMs: 60_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 45 * 60_000, maxAgeMs: 6 * 3_600_000 },
      retry: { maxAttempts: 3, baseDelayMs: 10_000 },
    };
  }

  async fetch(io: FetchIO): Promise<StormFeed> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
    const res = await io.fetch(endpoint);
    const raw = (await res.json()) as NhcRaw;
    const storms: Storm[] = [];
    for (const s of raw.activeStorms ?? []) {
      const lat = Number(s.latitudeNumeric);
      const lon = Number(s.longitudeNumeric);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      storms.push({
        id: String(s.id ?? s.binNumber ?? storms.length),
        name: String(s.name ?? 'Unnamed'),
        classification: String(s.classification ?? '?'),
        lat,
        lon,
        intensityKt: Number(s.intensity) || 0,
        movementDir: Number.isFinite(Number(s.movementDir)) ? Number(s.movementDir) : null,
        movementKt: Number.isFinite(Number(s.movementSpeed)) ? Number(s.movementSpeed) : null,
        lastUpdate: String(s.lastUpdate ?? ''),
      });
    }
    return { storms };
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new NhcStormsProvider() as ProviderInstance<unknown>;

export default createProvider;
