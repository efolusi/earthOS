import type { FeatureCollection } from 'geojson';
import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import { SAMPLE } from './sample';

/**
 * User-data provider. Not StaticProvider: a URL change should refetch, so it
 * keeps a long polling interval and relies on refresh() from the renderer
 * when settings change.
 */
export class GeoJsonProvider extends DataProvider<FeatureCollection> {
  readonly id = 'geojson-source';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 30 * 60_000, jitterMs: 60_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 10 * 60_000, maxAgeMs: 7 * 24 * 3_600_000 },
      retry: { maxAttempts: 2, baseDelayMs: 3_000 },
    };
  }

  async fetch(io: FetchIO): Promise<FeatureCollection> {
    const url = typeof io.settings.url === 'string' ? io.settings.url.trim() : '';
    if (!url) return SAMPLE;
    const res = await io.fetch(url);
    const json = (await res.json()) as FeatureCollection;
    if (json?.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
      throw new Error('not a GeoJSON FeatureCollection');
    }
    return json;
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new GeoJsonProvider() as ProviderInstance<unknown>;

export default createProvider;
