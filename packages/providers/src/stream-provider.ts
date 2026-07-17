import type { Disposer, ProviderInstance, ProviderSnapshot, ProviderStartIO } from '@earthos/core';

export interface StreamIO<T> {
  /** Deliver a data update (already parsed). */
  push(data: T): void;
  /** Report a connection failure: triggers backoff + reconnect. */
  fail(error: unknown): void;
  signal: AbortSignal;
  settings: Record<string, unknown>;
}

/**
 * Streaming provider (WebSocket/SSE feeds). Subclasses implement `connect`
 * and call `io.push` per update; the base handles reconnect with capped
 * exponential backoff, merge, throttled cache snapshots, and teardown.
 */
export abstract class StreamProvider<T> implements ProviderInstance<T> {
  abstract readonly id: string;

  /** Initial reconnect delay; doubles up to maxReconnectDelayMs. */
  protected reconnectDelayMs = 2_000;
  protected maxReconnectDelayMs = 60_000;
  /** How often the latest snapshot is persisted to cache. */
  protected snapshotIntervalMs = 30_000;

  private io: ProviderStartIO | null = null;
  private emitFn: ((snap: ProviderSnapshot<T>) => void) | null = null;
  private disposer: Disposer | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSnapshotAt = 0;
  private currentDelay = 0;
  private stopped = true;
  private latest: T | null = null;
  private latestAt: number | null = null;

  abstract connect(io: StreamIO<T>): Disposer | Promise<Disposer>;
  merge?(prev: T, next: T): T;

  async start(io: ProviderStartIO, emit: (snap: ProviderSnapshot<T>) => void): Promise<void> {
    this.io = io;
    this.emitFn = emit;
    this.stopped = false;
    this.currentDelay = this.reconnectDelayMs;

    const cached = await io.cache.get<T>('latest');
    if (this.stopped) return;
    if (cached) {
      this.latest = cached.value;
      this.latestAt = cached.storedAt;
      emit({ data: cached.value, state: 'stale', updatedAt: cached.storedAt });
    } else {
      emit({ data: null, state: 'loading', updatedAt: null });
    }
    await this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.disposer?.();
    this.disposer = null;
  }

  refresh(): void {
    if (this.stopped) return;
    this.disposer?.();
    this.disposer = null;
    void this.open();
  }

  private async open(): Promise<void> {
    if (this.stopped || !this.io || !this.emitFn) return;
    const io = this.io;
    const emit = this.emitFn;
    const streamIO: StreamIO<T> = {
      push: (data) => {
        if (this.stopped) return;
        this.currentDelay = this.reconnectDelayMs; // healthy again
        this.latest = this.latest !== null && this.merge ? this.merge(this.latest, data) : data;
        this.latestAt = Date.now();
        emit({ data: this.latest, state: 'ready', updatedAt: this.latestAt });
        if (this.latestAt - this.lastSnapshotAt >= this.snapshotIntervalMs) {
          this.lastSnapshotAt = this.latestAt;
          void io.cache.set('latest', this.latest);
        }
      },
      fail: (error) => {
        if (this.stopped) return;
        emit({
          data: this.latest,
          state: 'error',
          updatedAt: this.latestAt,
          error: error instanceof Error ? error.message : String(error),
        });
        this.scheduleReconnect();
      },
      signal: io.signal,
      settings: io.getSettings(),
    };
    try {
      this.disposer = await this.connect(streamIO);
    } catch (err) {
      streamIO.fail(err);
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.disposer?.();
    this.disposer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => void this.open(), this.currentDelay);
    this.currentDelay = Math.min(this.currentDelay * 2, this.maxReconnectDelayMs);
  }
}
