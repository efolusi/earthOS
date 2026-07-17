import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderStartIO,
} from '@earthos/core';
import { resetRateLimiters } from '@earthos/providers';
import { UsgsQuakeProvider } from '../src/provider';
import type { QuakeFeed } from '../src/types';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

const FEED: QuakeFeed = {
  metadata: { generated: 1700000000000, title: 'USGS All Day' },
  features: [
    {
      id: 'us7000test',
      properties: {
        mag: 5.2,
        place: '100 km SSE of Tokyo, Japan',
        time: 1700000000000,
        updated: 1700000001000,
        url: 'https://earthquake.usgs.gov/earthquakes/eventpage/us7000test',
        type: 'earthquake',
      },
      geometry: { type: 'Point', coordinates: [139.7, 35.1, 42] },
    },
    // malformed entries must be dropped
    { id: 'bad', properties: { time: 'nope' }, geometry: { type: 'LineString' } } as never,
  ],
};

function makeIO(settings: Record<string, unknown>): ProviderStartIO {
  return {
    signal: new AbortController().signal,
    time: new TimeEngine(),
    workers: new WorkerPool(silent),
    cache: new MemoryCache(),
    logger: silent,
    getSettings: () => settings,
    getViewport: () => DEFAULT_CAMERA,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetRateLimiters();
});

describe('UsgsQuakeProvider', () => {
  it('fetches the configured window and filters malformed features', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toBe(
          'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson',
        );
        return new Response(JSON.stringify(FEED), { status: 200 });
      }),
    );
    const provider = new UsgsQuakeProvider();
    const snaps: Array<{ state: string; data: QuakeFeed | null }> = [];
    await provider.start(makeIO({ feed: 'all_week' }), (s) => snaps.push(s as never));
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data!.features).toHaveLength(1);
      expect(snaps.at(-1)!.data!.features[0]!.id).toBe('us7000test');
    });
    provider.stop();
  });
});
