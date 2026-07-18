import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderStartIO,
} from '@earthos/core';
import { resetRateLimiters } from '@earthos/providers';
import { EonetWildfireProvider, latestPoint } from '../src/provider';
import type { EonetEvent, WildfireFeed } from '../src/types';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

function makeIO(settings: Record<string, unknown> = {}): ProviderStartIO {
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

const EVENT: EonetEvent = {
  id: 'EONET_1',
  title: 'Wildfire HOPKIN, Oregon',
  geometry: [
    { date: '2026-07-14T08:00:00Z', type: 'Point', coordinates: [-120.1, 45.3] },
    { date: '2026-07-16T08:04:00Z', type: 'Point', coordinates: [-120.24, 45.34] },
  ],
};

describe('latestPoint', () => {
  it('takes the most recent Point in the track', () => {
    const f = latestPoint(EVENT)!;
    expect(f).toMatchObject({ id: 'EONET_1', lon: -120.24, lat: 45.34 });
    expect(f.date).toBe(Date.parse('2026-07-16T08:04:00Z'));
  });

  it('returns null for an event with no usable point', () => {
    expect(latestPoint({ id: 'x', title: 't', geometry: [] })).toBeNull();
    expect(
      latestPoint({ id: 'x', title: 't', geometry: [{ date: 'd', type: 'Polygon', coordinates: [] }] }),
    ).toBeNull();
  });
});

describe('EonetWildfireProvider', () => {
  it('fetches the wildfire category and flattens events to points', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const u = String(url);
        expect(u).toContain('category=wildfires');
        expect(u).toContain('status=open');
        return new Response(JSON.stringify({ events: [EVENT, { id: 'e2', title: 'no geo', geometry: [] }] }), {
          status: 200,
        });
      }),
    );
    const provider = new EonetWildfireProvider();
    const snaps: Array<{ state: string; data: WildfireFeed | null }> = [];
    await provider.start(makeIO({ status: 'open', days: 10 }), (s) => snaps.push(s as never));
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data!.fires).toHaveLength(1); // the no-geo event is dropped
      expect(snaps.at(-1)!.data!.fires[0]!.title).toBe('Wildfire HOPKIN, Oregon');
    });
    provider.stop();
  });
});
