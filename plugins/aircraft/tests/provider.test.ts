import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderStartIO,
} from '@earthos/core';
import { resetRateLimiters } from '@earthos/providers';
import { AircraftProvider, parseAdsbV2, parseState } from '../src/provider';
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

describe('parseAdsbV2', () => {
  it('converts knots/feet/fpm units and derives the position timestamp', () => {
    const s = parseAdsbV2(
      {
        hex: '4cac24',
        flight: 'RYR94EE ',
        desc: 'BOEING 737 MAX 8',
        alt_baro: 38000,
        gs: 462.2,
        track: 352.29,
        baro_rate: -640,
        lat: 47.85,
        lon: -3.38,
        seen_pos: 2.5,
      },
      1_700_000_010,
    )!;
    expect(s.icao24).toBe('4cac24');
    expect(s.callsign).toBe('RYR94EE');
    expect(s.country).toBe('BOEING 737 MAX 8');
    expect(s.altM).toBeCloseTo(38000 * 0.3048, 3);
    expect(s.velocityMs).toBeCloseTo(462.2 * 0.514444, 3);
    expect(s.verticalRateMs).toBeCloseTo(-640 * 0.00508, 3);
    expect(s.timePosition).toBeCloseTo(1_700_000_007.5, 3);
    expect(s.onGround).toBe(false);
  });

  it('handles grounded aircraft and rejects entries without a position', () => {
    const grounded = parseAdsbV2(
      { hex: 'abc123', alt_baro: 'ground', lat: 1, lon: 2 },
      1_700_000_000,
    )!;
    expect(grounded.onGround).toBe(true);
    expect(grounded.altM).toBe(0);
    expect(parseAdsbV2({ hex: 'abc123' }, 1_700_000_000)).toBeNull();
  });
});

describe('AircraftProvider', () => {
  it('defaults to viewport-scoped airplanes.live point queries (now in ms)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        expect(String(url)).toMatch(
          /^https:\/\/api\.airplanes\.live\/v2\/point\/-?[\d.]+\/-?[\d.]+\/\d+$/,
        );
        return new Response(
          JSON.stringify({
            ac: [{ hex: '4cac24', lat: 47.85, lon: -3.38, gs: 400, alt_baro: 38000 }, { hex: 'nope' }],
            now: 1_700_000_010_000,
          }),
          { status: 200 },
        );
      }),
    );
    const provider = new AircraftProvider();
    const snaps: Array<{ state: string; data: AircraftFeed | null }> = [];
    await provider.start(makeIO({}), (s) => snaps.push(s as never));
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data!.states).toHaveLength(1);
      expect(snaps.at(-1)!.data!.time).toBe(1_700_000_010);
    });
    provider.stop();
  });

  it('fetches OpenSky global states when selected', async () => {
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
    const provider = new AircraftProvider();
    const snaps: Array<{ state: string; data: AircraftFeed | null }> = [];
    await provider.start(makeIO({ dataSource: 'opensky', maxAircraft: 1 }), (s) =>
      snaps.push(s as never),
    );
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data!.states).toHaveLength(1);
      expect(snaps.at(-1)!.data!.time).toBe(1700000010);
    });
    provider.stop();
  });
});
