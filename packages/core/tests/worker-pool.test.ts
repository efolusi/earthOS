import { describe, expect, it, vi } from 'vitest';
import { WorkerPool, exposeWorker, transferResult, type WorkerLike } from '../src/worker-pool';

/**
 * In-process fake worker: wires two message channels together and runs
 * `exposeWorker` handlers on the "worker side".
 */
function fakeWorker(handlers: Record<string, (payload: never) => unknown | Promise<unknown>>): {
  worker: WorkerLike;
  streamToMain: (message: unknown) => void;
} {
  const mainListeners = new Set<(ev: MessageEvent) => void>();
  const workerListeners = new Set<(ev: MessageEvent) => void>();

  const toMain = (message: unknown) => {
    queueMicrotask(() => {
      for (const l of [...mainListeners]) l({ data: message } as MessageEvent);
    });
  };

  const workerScope = {
    addEventListener: (_: 'message', l: (ev: MessageEvent) => void) => {
      workerListeners.add(l);
    },
    postMessage: toMain,
  };
  exposeWorker(handlers, workerScope);

  const worker: WorkerLike = {
    postMessage: (message: unknown) => {
      queueMicrotask(() => {
        for (const l of [...workerListeners]) l({ data: message } as MessageEvent);
      });
    },
    terminate: vi.fn(),
    addEventListener: (type, l) => {
      if (type === 'message') mainListeners.add(l as (ev: MessageEvent) => void);
    },
    removeEventListener: (type, l) => {
      if (type === 'message') mainListeners.delete(l as (ev: MessageEvent) => void);
    },
  };
  return { worker, streamToMain: toMain };
}

describe('WorkerPool RPC', () => {
  it('round-trips a request/response', async () => {
    const pool = new WorkerPool();
    const { worker } = fakeWorker({
      add: (p: { a: number; b: number }) => p.a + p.b,
    });
    const handle = pool.spawn(() => worker);
    await expect(handle.request('add', { a: 2, b: 3 })).resolves.toBe(5);
  });

  it('propagates handler errors as rejections', async () => {
    const pool = new WorkerPool();
    const { worker } = fakeWorker({
      boom: () => {
        throw new Error('kaput');
      },
    });
    const handle = pool.spawn(() => worker);
    await expect(handle.request('boom')).rejects.toThrow('kaput');
    await expect(handle.request('missing')).rejects.toThrow('no handler');
  });

  it('unwraps transferResult payloads', async () => {
    const pool = new WorkerPool();
    const { worker } = fakeWorker({
      buffer: () => {
        const buf = new Float32Array([1, 2, 3]);
        return transferResult({ positions: buf }, [buf.buffer]);
      },
    });
    const handle = pool.spawn(() => worker);
    const res = await handle.request<{ positions: Float32Array }>('buffer');
    expect([...res.positions]).toEqual([1, 2, 3]);
  });

  it('raw messages bypass RPC and reach onMessage listeners', async () => {
    const pool = new WorkerPool();
    const { worker, streamToMain } = fakeWorker({});
    const handle = pool.spawn(() => worker);
    const spy = vi.fn();
    handle.onMessage(spy);

    // simulate the worker streaming a raw (non-RPC) batch to main
    streamToMain({ shardId: 0, seq: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalledWith({ shardId: 0, seq: 1 });
  });

  it('terminateAll rejects pending requests and terminates workers', async () => {
    const pool = new WorkerPool();
    const { worker } = fakeWorker({ never: () => new Promise(() => {}) });
    const handle = pool.spawn(() => worker);
    const pending = handle.request('never');
    pool.terminateAll();
    await expect(pending).rejects.toThrow('terminated');
    expect(worker.terminate).toHaveBeenCalled();
  });
});
