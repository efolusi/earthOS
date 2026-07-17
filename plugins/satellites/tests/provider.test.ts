import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderStartIO,
} from '@earthos/core';
import { CelestrakGpProvider } from '../src/provider';
import { resetRateLimiters } from '@earthos/providers';
import type { OmmRecord } from '../src/types';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

const ISS_OMM: OmmRecord = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2024-01-01T00:00:00',
  MEAN_MOTION: 15.49564479,
  ECCENTRICITY: 0.0004257,
  INCLINATION: 51.6416,
  RA_OF_ASC_NODE: 339.5,
  ARG_OF_PERICENTER: 98,
  MEAN_ANOMALY: 262,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 43000,
  BSTAR: 0.00030777,
  MEAN_MOTION_DOT: 0.00016717,
  MEAN_MOTION_DDOT: 0,
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

describe('CelestrakGpProvider', () => {
  it('fetches the configured group and filters malformed records', async () => {
    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('GROUP=stations');
      expect(String(url)).toContain('FORMAT=json');
      return new Response(JSON.stringify([ISS_OMM, { garbage: true }]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new CelestrakGpProvider();
    const io = makeIO({ group: 'stations' });
    const snaps: unknown[] = [];
    await provider.start(io, (s) => snaps.push(s));
    await vi.waitFor(() => {
      const last = snaps.at(-1) as { state: string; data: OmmRecord[] | null };
      expect(last.state).toBe('ready');
      expect(last.data).toHaveLength(1);
      expect(last.data![0]!.NORAD_CAT_ID).toBe(25544);
    });
    provider.stop();
  });

  it('honors the endpoint override and the maxSatellites cap', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      ...ISS_OMM,
      NORAD_CAT_ID: 10000 + i,
    }));
    const fetchSpy = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain('https://proxy.example.dev/gp');
      return new Response(JSON.stringify(many), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const provider = new CelestrakGpProvider();
    const io = makeIO({ endpoint: 'https://proxy.example.dev/gp', maxSatellites: 10 });
    const snaps: Array<{ state: string; data: OmmRecord[] | null }> = [];
    await provider.start(io, (s) => snaps.push(s as never));
    await vi.waitFor(() => {
      expect(snaps.at(-1)!.state).toBe('ready');
      expect(snaps.at(-1)!.data).toHaveLength(10);
    });
    provider.stop();
  });
});
