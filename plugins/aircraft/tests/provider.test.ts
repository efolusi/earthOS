import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderStartIO,
} from '@earthos/core';
import { resetRateLimiters } from '@earthos/providers';
import { OpenSkyProvider, parseState } from '../src/provider';
import type { AircraftFeed } from '../src/types';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

// One real-shaped OpenSky row: KLM heavy over the North Sea.
const ROW = [
  '4840d6',
  'KLM692  ',
  'Kingdom of the Netherlands',
  1700000000,
  1700000005,
  4.55,
  52.9,
  11277.6,
  false,
  245.2,
  87.3,
  0.33,
  null,
  11582.4,
  '1000',
  false,
  0,
];

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

describe('parseState', () => {
  it('parses a full row with trimmed callsign and baro altitude', () => {
    const s = parseState(ROW as never)!;
    expect(s).toMatchObject({
      icao24: '4840d6',
      callsign: 'KLM692',
      country: 'Kingdom of the Netherlands',
      lon: 4.55,
      lat: 52.9,
      altM: 11277.6,
      onGround: false,
      velocityMs: 245.2,
      trackDeg: 87.3,
    });
  });

  it('falls back to geometric altitude and rejects rows without a position', () => {
    const noBaro = [...ROW];
    noBaro[7] = null;
    expect(parseState(noBaro as never)!.altM).toBe(11582.4);
    const noPos = [...ROW];
    noPos[5] = null;
    expect(parseState(noPos as never)).toBeNull();
  });
});

describe('OpenSkyProvider', () => {
  it('fetches, parses, and caps the feed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toBe('https://opensky-network.org/api/states/all');
        return new Response(
          JSON.stringify({ time: 1700000010, states: [ROW, ROW, [null, null]] }),
          { status: 200 },
        );
      }),
    );
    const provider = new OpenSkyProvider();
    const snaps: Array<{ state: string; data: AircraftFeed | null }> = [];
    await provider.start(makeIO({ maxAircraft: 1 }), (s) => snaps.push(s as never));
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data!.states).toHaveLength(1);
      expect(snaps.at(-1)!.data!.time).toBe(1700000010);
    });
    provider.stop();
  });
});
