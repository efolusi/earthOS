import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { OmmRecord, SatCatalog } from './types';

const DEFAULT_ENDPOINT = 'https://celestrak.org/NORAD/elements/gp.php';

export class CelestrakGpProvider extends DataProvider<SatCatalog> {
  readonly id = 'celestrak-gp';

  constructor() {
    super();
    this.policyOverrides = {
      // TLE/GP epochs are useful for days: refresh gently, keep them long.
      refresh: { intervalMs: 2 * 3_600_000, jitterMs: 5 * 60_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 3 * 3_600_000, maxAgeMs: 72 * 3_600_000 },
      retry: { maxAttempts: 4, baseDelayMs: 5_000, honorRetryAfter: true },
      rateLimit: { tokensPerMinute: 6, burst: 3, scope: 'origin' },
    };
  }

  async fetch(io: FetchIO): Promise<SatCatalog> {
    const group = typeof io.settings.group === 'string' ? io.settings.group : 'starlink';
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
    const max =
      typeof io.settings.maxSatellites === 'number' ? io.settings.maxSatellites : 15_000;

    const url = `${endpoint}?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
    const res = await io.fetch(url);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) {
      throw new Error(`unexpected CelesTrak response shape from ${url}`);
    }
    const records = (json as OmmRecord[]).filter(
      (r) => typeof r?.NORAD_CAT_ID === 'number' && typeof r?.EPOCH === 'string',
    );
    return records.slice(0, max);
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new CelestrakGpProvider() as ProviderInstance<unknown>;

export default createProvider;
