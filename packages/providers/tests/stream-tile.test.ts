import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  TimeEngine,
  WorkerPool,
  DEFAULT_CAMERA,
  type ProviderSnapshot,
  type ProviderStartIO,
} from '@earthos/core';
import { StreamProvider, type StreamIO } from '../src/stream-provider';
import { TileProvider } from '../src/tile-provider';

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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('StreamProvider', () => {
  class TestStream extends StreamProvider<string[]> {
    readonly id = 'ais/stream';
    connections = 0;
    lastIO: StreamIO<string[]> | null = null;
    disposed = 0;

    override merge = (prev: string[], next: string[]) => [...prev, ...next];

    connect(io: StreamIO<string[]>) {
      this.connections += 1;
      this.lastIO = io;
      return () => {
        this.disposed += 1;
      };
    }
  }

  it('pushes merge into ready snapshots', async () => {
    const stream = new TestStream();
    const snaps: ProviderSnapshot<string[]>[] = [];
    await stream.start(makeIO(), (s) => snaps.push(s));
    stream.lastIO!.push(['a']);
    stream.lastIO!.push(['b']);
    expect(snaps.map((s) => s.state)).toEqual(['loading', 'ready', 'ready']);
    expect(snaps.at(-1)!.data).toEqual(['a', 'b']);
    stream.stop();
    expect(stream.disposed).toBe(1);
  });

  it('reconnects with backoff after failures', async () => {
    const stream = new TestStream();
    const snaps: ProviderSnapshot<string[]>[] = [];
    await stream.start(makeIO(), (s) => snaps.push(s));
    expect(stream.connections).toBe(1);

    stream.lastIO!.fail(new Error('socket closed'));
    expect(snaps.at(-1)!.state).toBe('error');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(stream.connections).toBe(2);

    stream.lastIO!.fail(new Error('socket closed again'));
    await vi.advanceTimersByTimeAsync(2_000); // doubled: not yet
    expect(stream.connections).toBe(2);
    await vi.advanceTimersByTimeAsync(2_100);
    expect(stream.connections).toBe(3);
    stream.stop();
  });
});

describe('TileProvider', () => {
  class TestTiles extends TileProvider {
    readonly id = 'weather/tiles';
    describe(settings: Record<string, unknown>) {
      const endpoint = (settings.endpoint as string) ?? 'https://tiles.example.com';
      return { template: `${endpoint}/{z}/{x}/{y}.png`, attribution: 'Example' };
    }
  }

  it('emits its descriptor immediately and re-describes on refresh', () => {
    const settings: Record<string, unknown> = {};
    const tiles = new TestTiles();
    const snaps: ProviderSnapshot<{ template: string }>[] = [];
    tiles.start(makeIO(settings), (s) => snaps.push(s as ProviderSnapshot<{ template: string }>));
    expect(snaps[0]!.state).toBe('ready');
    expect(snaps[0]!.data!.template).toContain('tiles.example.com');

    settings.endpoint = 'https://proxy.mysite.dev/weather';
    tiles.refresh();
    expect(snaps[1]!.data!.template).toContain('proxy.mysite.dev');
    tiles.stop();
  });
});
