# @earthos/providers

The EarthOS data layer: base classes that turn a plain fetch into a resilient, cache-backed feed for a globe layer.

A provider owns one dataset. You implement how to fetch and parse it; the base class owns the runtime around that call: stale-while-revalidate emits (cached data first, fresh data on arrival), jittered polling, exponential backoff with `Retry-After` honored, per-origin token-bucket rate limiting, viewport-scoped refetch, pause-when-hidden, and teardown on stop/abort. Providers are plain classes with no React or Three dependency, driven by the engine through the `@earthos/core` `ProviderInstance` contract.

## Install

```sh
pnpm add @earthos/providers
```

Pulls in `@earthos/core` (the runtime types and `MemoryCache`) as a dependency. No single-instance peers.

## Usage

Subclass the variant that matches the source, set a policy, implement `fetch`:

```ts
import { DataProvider, type FetchIO } from '@earthos/providers';

interface Quakes {
  /* your parsed shape */
}

export class UsgsQuakesProvider extends DataProvider<Quakes> {
  readonly id = 'usgs/quakes';

  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 5_000, pauseWhenHidden: true },
      cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 60 * 60_000 },
      rateLimit: { tokensPerMinute: 30, scope: 'origin' },
    };
  }

  // `fetch` here is instrumented: it throws HttpError / RetryAfterError on bad status.
  async fetch({ fetch, signal }: FetchIO): Promise<Quakes> {
    const res = await fetch('https://earthquake.usgs.gov/.../all_hour.geojson', { signal });
    return res.json();
  }
}
```

Override `cacheKey(settings)` when the payload depends on a setting, and `merge(prev, next)` for incremental feeds.

## Variants

| Export           | For                                                              |
| ---------------- | ---------------------------------------------------------------- |
| `DataProvider`   | polling HTTP sources with the full SWR runtime                   |
| `StaticProvider` | fetch-once datasets (bundled files, user uploads)                |
| `StreamProvider` | WebSocket/SSE feeds; capped-backoff reconnect, snapshot to cache |
| `TileProvider`   | raster/vector tile layers; emits a `TileDescriptor`, no fetch    |

## Also exported

- `createDefaultCache`, `LayeredCache`, `IdbCache`: memory LRU in front of IndexedDB (memory-only under SSR/tests), all failures degrade to cache misses.
- `DEFAULT_POLICY`, `mergePolicy`, and the `ProviderPolicy` / `RefreshPolicy` / `CachePolicy` / `RetryPolicy` / `RateLimitPolicy` types.
- `HttpError`, `RetryAfterError`, `parseRetryAfterMs`, `rateLimitWaitMs`, `resetRateLimiters`.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for wiring a provider into a layer and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for how the engine drives it.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
