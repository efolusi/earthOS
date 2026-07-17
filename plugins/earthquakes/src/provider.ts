import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { QuakeFeed } from './types';

const DEFAULT_ENDPOINT = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary';

export class UsgsQuakeProvider extends DataProvider<QuakeFeed> {
  readonly id = 'usgs-quakes';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 10_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 24 * 3_600_000 },
      retry: { maxAttempts: 3, baseDelayMs: 5_000, honorRetryAfter: true },
      rateLimit: { tokensPerMinute: 10, scope: 'origin' },
    };
  }

  async fetch(io: FetchIO): Promise<QuakeFeed> {
    const feed = typeof io.settings.feed === 'string' ? io.settings.feed : 'all_day';
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
    const res = await io.fetch(`${endpoint}/${feed}.geojson`);
    const json = (await res.json()) as QuakeFeed;
    if (!Array.isArray(json?.features)) {
      throw new Error('unexpected USGS feed shape');
    }
    // The feed is a full snapshot: no merge needed, newest first already.
    json.features = json.features.filter(
      (feature) =>
        feature.geometry?.type === 'Point' &&
        Array.isArray(feature.geometry.coordinates) &&
        typeof feature.properties?.time === 'number',
    );
    return json;
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new UsgsQuakeProvider() as ProviderInstance<unknown>;

export default createProvider;
