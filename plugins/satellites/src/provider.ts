import type { PluginContext, ProviderInstance } from '@earthos/core';
import { DataProvider, type FetchIO } from '@earthos/providers';
import type { CatalogRecord, OmmRecord, SatCatalog } from './types';

const DEFAULT_ENDPOINT = 'https://celestrak.org/NORAD/elements/gp.php';
// Trailing slash matters: the API 301s /api/tle?x → /api/tle/?x on every page.
const TLE_API_ENDPOINT = 'https://tle.ivanstanojevic.me/api/tle/';

interface TleApiMember {
  satelliteId: number;
  name: string;
  line1: string;
  line2: string;
}

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

  protected override cacheKey(settings: Record<string, unknown>): string {
    const source = typeof settings.dataSource === 'string' ? settings.dataSource : 'celestrak';
    const group = typeof settings.group === 'string' ? settings.group : 'starlink';
    return source === 'tleapi' ? 'latest:tleapi' : `latest:${group}`;
  }

  async fetch(io: FetchIO): Promise<SatCatalog> {
    const source =
      typeof io.settings.dataSource === 'string' ? io.settings.dataSource : 'celestrak';
    if (source === 'tleapi') return this.fetchTleApi(io);
    const group = typeof io.settings.group === 'string' ? io.settings.group : 'starlink';
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.length > 0
        ? io.settings.endpoint
        : DEFAULT_ENDPOINT;
    const max = typeof io.settings.maxSatellites === 'number' ? io.settings.maxSatellites : 15_000;

    const url = `${endpoint}?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
    try {
      const res = await io.fetch(url);
      const json: unknown = await res.json();
      if (!Array.isArray(json)) {
        throw new Error(`unexpected CelesTrak response shape from ${url}`);
      }
      const records = (json as OmmRecord[]).filter(
        (r) => typeof r?.NORAD_CAT_ID === 'number' && typeof r?.EPOCH === 'string',
      );
      return records.slice(0, max);
    } catch (err) {
      // CelesTrak blocks some networks (cloud egress, rate-limited IPs);
      // degrade to the popularity-sorted TLE API rather than an empty layer.
      if (io.signal.aborted) throw err;
      return this.fetchTleApi({ ...io, settings: { ...io.settings, endpoint: '' } });
    }
  }

  /**
   * Fallback catalog: the public TLE API (paginated, popularity-sorted so
   * ISS/Starlink/GPS arrive first). Keyless, CORS-open, independent of
   * CelesTrak's rate limiting.
   */
  private async fetchTleApi(io: FetchIO): Promise<SatCatalog> {
    const endpoint =
      typeof io.settings.endpoint === 'string' && io.settings.endpoint.startsWith('http')
        ? io.settings.endpoint
        : TLE_API_ENDPOINT;
    const max = typeof io.settings.maxSatellites === 'number' ? io.settings.maxSatellites : 15_000;
    const pageSize = 100;
    const pages = Math.min(Math.ceil(Math.min(max, 1000) / pageSize), 10);
    const records: CatalogRecord[] = [];
    for (let page = 1; page <= pages; page++) {
      const res = await io.fetch(
        `${endpoint}?page=${page}&page-size=${pageSize}&sort=popularity&sort-dir=desc`,
      );
      const json = (await res.json()) as { member?: TleApiMember[] };
      const members = json.member ?? [];
      for (const m of members) {
        if (typeof m.satelliteId !== 'number' || !m.line1 || !m.line2) continue;
        records.push({
          OBJECT_NAME: m.name ?? String(m.satelliteId),
          NORAD_CAT_ID: m.satelliteId,
          TLE_LINE1: m.line1,
          TLE_LINE2: m.line2,
        });
      }
      if (members.length < pageSize) break;
    }
    if (records.length === 0) throw new Error('TLE API returned no members');
    return records;
  }
}

const createProvider = (_ctx: PluginContext): ProviderInstance<unknown> =>
  new CelestrakGpProvider() as ProviderInstance<unknown>;

export default createProvider;
