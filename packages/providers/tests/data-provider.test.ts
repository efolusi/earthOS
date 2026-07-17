import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderSnapshot,
  type ProviderStartIO,
} from '@earthos/core';
import { DataProvider, type FetchIO } from '../src/data-provider';
import { resetRateLimiters } from '../src/rate-limiter';

const silent = { debug() {}, info() {}, warn() {}, error() {} };

function makeIO(cache = new MemoryCache()): { io: ProviderStartIO; abort: AbortController } {
  const abort = new AbortController();
  return {
    abort,
    io: {
      signal: abort.signal,
      time: new TimeEngine(),
      workers: new WorkerPool(silent),
      cache,
      logger: silent,
      getSettings: () => ({}),
      getViewport: () => DEFAULT_CAMERA,
    },
  };
}

class TestProvider extends DataProvider<number> {
  readonly id = 'test/feed';
  fetchImpl: (io: FetchIO) => Promise<number>;

  constructor(fetchImpl: (io: FetchIO) => Promise<number>) {
    super();
    this.fetchImpl = fetchImpl;
    this.policyOverrides = {
      refresh: { intervalMs: 60_000, jitterMs: 0, pauseWhenHidden: false },
      cache: { staleAfterMs: 30_000, maxAgeMs: 3_600_000 },
      retry: { maxAttempts: 3, baseDelayMs: 1_000 },
    };
  }

  fetch(io: FetchIO): Promise<number> {
    return this.fetchImpl(io);
  }
}

function record<T>(): { snaps: ProviderSnapshot<T>[]; emit: (s: ProviderSnapshot<T>) => void } {
  const snaps: ProviderSnapshot<T>[] = [];
  return { snaps, emit: (s) => snaps.push(s) };
}

beforeEach(() => {
  vi.useFakeTimers();
  resetRateLimiters();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('DataProvider SWR runtime', () => {
  it('cold start: loading then ready after the first fetch', async () => {
    const provider = new TestProvider(async () => 42);
    const { io } = makeIO();
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.map((s) => s.state)).toEqual(['loading', 'ready']);
    expect(snaps[1]!.data).toBe(42);
    provider.stop();
  });

  it('fresh cache: emits ready immediately without fetching', async () => {
    const cache = new MemoryCache();
    await cache.set('latest', 7);
    const fetchSpy = vi.fn(async () => 42);
    const provider = new TestProvider(fetchSpy);
    const { io } = makeIO(cache);
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps).toEqual([{ data: 7, state: 'ready', updatedAt: expect.any(Number) }]);
    expect(fetchSpy).not.toHaveBeenCalled();

    // The regular cadence still refetches later.
    await vi.advanceTimersByTimeAsync(61_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    provider.stop();
  });

  it('stale cache: emits stale immediately, then revalidates', async () => {
    const cache = new MemoryCache();
    await cache.set('latest', 7);
    await vi.advanceTimersByTimeAsync(31_000); // past staleAfterMs
    const provider = new TestProvider(async () => 42);
    const { io } = makeIO(cache);
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.map((s) => [s.state, s.data])).toEqual([
      ['stale', 7],
      ['ready', 42],
    ]);
    provider.stop();
  });

  it('errors keep last-good data and back off exponentially before recovering', async () => {
    let calls = 0;
    const provider = new TestProvider(async () => {
      calls += 1;
      if (calls <= 2) throw new Error('boom');
      return 99;
    });
    const { io } = makeIO();
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0); // first attempt fails
    expect(snaps.at(-1)).toMatchObject({ state: 'error', data: null, error: 'boom' });

    await vi.advanceTimersByTimeAsync(1_000); // retry #1 (base delay) fails
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(2_000); // retry #2 (doubled) succeeds
    expect(calls).toBe(3);
    expect(snaps.at(-1)).toMatchObject({ state: 'ready', data: 99 });
    provider.stop();
  });

  it('merge combines incremental results and since is the last success time', async () => {
    const sinceValues: Array<number | undefined> = [];
    class Incremental extends TestProvider {
      override merge = (prev: number, next: number) => prev + next;
    }
    const provider = new Incremental(async (io) => {
      sinceValues.push(io.since);
      return 10;
    });
    const { io } = makeIO();
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(snaps.filter((s) => s.state === 'ready').map((s) => s.data)).toEqual([10, 20]);
    expect(sinceValues[0]).toBeUndefined();
    expect(sinceValues[1]).toBeTypeOf('number');
    provider.stop();
  });

  it('stop aborts in-flight work and silences further emits', async () => {
    let resolveFetch: ((n: number) => void) | null = null;
    const provider = new TestProvider(
      () => new Promise<number>((resolve) => (resolveFetch = resolve)),
    );
    const { io } = makeIO();
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    provider.stop();
    resolveFetch!(123);
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.map((s) => s.state)).toEqual(['loading']);
  });

  it('refresh fetches immediately', async () => {
    const fetchSpy = vi.fn(async () => 1);
    const provider = new TestProvider(fetchSpy);
    const { io } = makeIO();
    const { emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    provider.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    provider.stop();
  });

  it('instrumented fetch throws RetryAfterError on 429 and honors the header', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return new Response('slow down', {
            status: 429,
            headers: { 'retry-after': '5' },
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    const provider = new TestProvider(async (fio) => {
      const res = await fio.fetch('https://api.example.com/data');
      await res.json();
      return 5;
    });
    const { io } = makeIO();
    const { snaps, emit } = record<number>();
    await provider.start(io, emit);
    await vi.advanceTimersByTimeAsync(0);
    expect(snaps.at(-1)!.state).toBe('error');

    // Well before Retry-After: nothing.
    await vi.advanceTimersByTimeAsync(3_000);
    expect(calls).toBe(1);
    // After Retry-After: recovered.
    await vi.advanceTimersByTimeAsync(2_100);
    expect(calls).toBe(2);
    expect(snaps.at(-1)).toMatchObject({ state: 'ready', data: 5 });
    provider.stop();
  });
});
