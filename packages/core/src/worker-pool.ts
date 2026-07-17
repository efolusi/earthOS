import type { Disposer, Logger } from './types';

/** Structural worker type so tests can substitute a fake. */
export interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  addEventListener(type: 'message' | 'error', listener: (ev: MessageEvent | ErrorEvent) => void): void;
  removeEventListener(
    type: 'message' | 'error',
    listener: (ev: MessageEvent | ErrorEvent) => void,
  ): void;
}

export type WorkerFactory = () => WorkerLike;

export interface WorkerHandle {
  /** Fire-and-forget message (used for high-volume buffer streaming). */
  post(message: unknown, transfer?: Transferable[]): void;
  onMessage<T = unknown>(cb: (message: T) => void): Disposer;
  /** RPC round trip. The worker side must use `exposeWorker`. */
  request<TRes = unknown>(type: string, payload?: unknown, transfer?: Transferable[]): Promise<TRes>;
  terminate(): void;
}

interface RpcRequest {
  __rpc: number;
  type: string;
  payload: unknown;
}

interface RpcResponse {
  __rpcReply: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Owns every worker a plugin spawns so deactivation can tear them all down.
 * Message discipline (batching, seq numbers, transferable ping-pong) is the
 * caller's job; the pool provides plumbing plus a small RPC layer.
 */
export class WorkerPool {
  private handles = new Set<WorkerHandle>();
  private nextRpcId = 1;

  constructor(private logger?: Logger) {}

  spawn(factory: WorkerFactory): WorkerHandle {
    const worker = factory();
    const listeners = new Set<(message: unknown) => void>();
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

    const onMessage = (ev: MessageEvent | ErrorEvent) => {
      const data = (ev as MessageEvent).data;
      if (data && typeof data === 'object' && '__rpcReply' in data) {
        const reply = data as RpcResponse;
        const entry = pending.get(reply.__rpcReply);
        if (entry) {
          pending.delete(reply.__rpcReply);
          if (reply.ok) entry.resolve(reply.result);
          else entry.reject(new Error(reply.error ?? 'worker request failed'));
        }
        return;
      }
      for (const listener of [...listeners]) listener(data);
    };
    const onError = (ev: MessageEvent | ErrorEvent) => {
      const message = (ev as ErrorEvent).message ?? 'worker error';
      this.logger?.error('worker error', message);
      for (const entry of pending.values()) entry.reject(new Error(message));
      pending.clear();
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    const handle: WorkerHandle = {
      post: (message, transfer) => worker.postMessage(message, transfer),
      onMessage: <T>(cb: (message: T) => void) => {
        listeners.add(cb as (message: unknown) => void);
        return () => listeners.delete(cb as (message: unknown) => void);
      },
      request: <TRes>(type: string, payload?: unknown, transfer?: Transferable[]) => {
        const id = this.nextRpcId++;
        return new Promise<TRes>((resolve, reject) => {
          pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
          const msg: RpcRequest = { __rpc: id, type, payload };
          worker.postMessage(msg, transfer);
        });
      },
      terminate: () => {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        for (const entry of pending.values()) entry.reject(new Error('worker terminated'));
        pending.clear();
        listeners.clear();
        worker.terminate();
        this.handles.delete(handle);
      },
    };
    this.handles.add(handle);
    return handle;
  }

  /** Sensible worker count for propagation-style pools. */
  static defaultPoolSize(): number {
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;
    return Math.max(1, Math.min(4, cores - 2));
  }

  terminateAll(): void {
    for (const handle of [...this.handles]) handle.terminate();
  }
}

interface TransferableResult {
  __transferResult: unknown;
  transfer: Transferable[];
}

/** Wrap a worker handler result to transfer buffers back to the main thread. */
export function transferResult(result: unknown, transfer: Transferable[]): TransferableResult {
  return { __transferResult: result, transfer };
}

type WorkerScope = {
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

/**
 * Worker-side RPC dispatcher:
 *   exposeWorker({ init: (payload) => ..., propagate: (payload) => ... });
 * Non-RPC messages are ignored, so a worker can also stream raw messages.
 */
export function exposeWorker(
  handlers: Record<string, (payload: never) => unknown | Promise<unknown>>,
  scope: WorkerScope = globalThis as unknown as WorkerScope,
): void {
  scope.addEventListener('message', (ev: MessageEvent) => {
    const data = ev.data as RpcRequest | undefined;
    if (!data || typeof data !== 'object' || !('__rpc' in data)) return;
    const handler = handlers[data.type];
    void (async () => {
      try {
        if (!handler) throw new Error(`no handler for "${data.type}"`);
        const raw = await handler(data.payload as never);
        if (raw && typeof raw === 'object' && '__transferResult' in raw) {
          const tr = raw as TransferableResult;
          scope.postMessage(
            { __rpcReply: data.__rpc, ok: true, result: tr.__transferResult },
            tr.transfer,
          );
        } else {
          scope.postMessage({ __rpcReply: data.__rpc, ok: true, result: raw });
        }
      } catch (err) {
        scope.postMessage({
          __rpcReply: data.__rpc,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  });
}
