import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type CameraSnapshot,
  type Disposer,
  type ProviderSnapshot,
  type ProviderStartIO,
} from '@earthos/core';
import { DataProvider, type FetchIO } from '../src/data-provider';
import { IdbCache } from '../src/idb-cache';
import { resetRateLimiters } from '../src/rate-limiter';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

class GroupProvider extends DataProvider<string> {
  readonly id = 'grouped/feed';
  constructor(private settingsRef: { group: string }) {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 0, pauseWhenHidden: false },
      cache: { staleAfterMs: 30_000, maxAgeMs: 3_600_000 },
      retry: { maxAttempts: 1, baseDelayMs: 1_000 },
    };
  }
  protected override cacheKey(settings: Record<string, unknown>): string {
    return `latest:${String(settings.group)}`;
  }
  async fetch(io: FetchIO): Promise<string> {
    return `payload-for-${String(io.settings.group)}`;
  }
}

function makeIO(settingsRef: { group: string }, cache = new MemoryCache()) {
  const viewportSubs = new Set<(snap: CameraSnapshot) => void>();
  const io: ProviderStartIO = {
    signal: new AbortController().signal,
    time: new TimeEngine(),
    workers: new WorkerPool(silent),
    cache,
    logger: silent,
    getSettings: () => ({ ...settingsRef }),
    getViewport: () => DEFAULT_CAMERA,
    onViewportChange: (cb): Disposer => {
      viewportSubs.add(cb);
      return () => viewportSubs.delete(cb);
    },
  };
  return { io, cache, moveCamera: () => viewportSubs.forEach((cb) => cb(DEFAULT_CAMERA)) };
}

beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimiters();
});
afterEach(() => vi.useRealTimers());

describe('settings-aware cache keys', () => {
  it('caches per key and never serves one group as another', async () => {
    const settingsRef = { group: 'starlink' };
    const { io, cache } = makeIO(settingsRef);
    const provider = new GroupProvider(settingsRef);
    const snaps: ProviderSnapshot<string>[] = [];
    await provider.start(io, (s) => snaps.push(s));
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.at(-1)).toMatchObject({ state: 'ready', data: 'payload-for-starlink' });
    expect((await cache.get('latest:starlink'))?.value).toBe('payload-for-starlink');

    // Switch groups and refresh: new key, new payload, old key untouched.
    settingsRef.group = 'gps-ops';
    provider.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.at(-1)).toMatchObject({ state: 'ready', data: 'payload-for-gps-ops' });
    expect((await cache.get('latest:gps-ops'))?.value).toBe('payload-for-gps-ops');
    expect((await cache.get('latest:starlink'))?.value).toBe('payload-for-starlink');
    provider.stop();

    // A fresh start with the new group must hit the NEW key, not 'starlink'.
    const provider2 = new GroupProvider(settingsRef);
    const snaps2: ProviderSnapshot<string>[] = [];
    const second = makeIO(settingsRef, cache as MemoryCache);
    await provider2.start(second.io, (s) => snaps2.push(s));
    expect(snaps2[0]).toMatchObject({ state: 'ready', data: 'payload-for-gps-ops' });
    provider2.stop();
  });
});

describe('viewportScoped refresh', () => {
  class ViewportProvider extends DataProvider<number> {
    readonly id = 'viewport/feed';
    fetches = 0;
    constructor() {
      super();
      this.policyOverrides = {
        refresh: { intervalMs: 600_000, jitterMs: 0, pauseWhenHidden: false, viewportScoped: true },
        cache: { staleAfterMs: 60_000, maxAgeMs: 3_600_000 },
        retry: { maxAttempts: 1, baseDelayMs: 1_000 },
      };
    }
    async fetch(): Promise<number> {
      this.fetches += 1;
      return this.fetches;
    }
  }

  it('refetches once after the camera settles (debounced)', async () => {
    const { io, moveCamera } = makeIO({ group: 'x' });
    const provider = new ViewportProvider();
    await provider.start(io, () => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(provider.fetches).toBe(1);

    // A burst of camera movement collapses into one debounced refetch.
    moveCamera();
    await vi.advanceTimersByTimeAsync(500);
    moveCamera();
    moveCamera();
    await vi.advanceTimersByTimeAsync(1_400);
    expect(provider.fetches).toBe(1); // still inside the debounce window
    await vi.advanceTimersByTimeAsync(200);
    expect(provider.fetches).toBe(2);
    provider.stop();
  });
});

describe('IdbCache eviction', () => {
  it('drops the oldest entries once past maxEntries', async () => {
    vi.useRealTimers(); // fake-indexeddb needs real task scheduling
    const cache = new IdbCache(`test-${Math.random().toString(36).slice(2)}`, 20);
    for (let i = 0; i < 40; i++) {
      await cache.set(`key-${i}`, { blob: i });
    }
    // Sweeps run every 10 sets; the cap must hold afterwards.
    expect(await cache.get('key-39')).toBeDefined();
    expect(await cache.get('key-0')).toBeUndefined();
    expect(await cache.get('key-5')).toBeUndefined();
  });
});
