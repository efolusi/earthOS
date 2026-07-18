import type {
  CameraSnapshot,
  ProviderInstance,
  ProviderSnapshot,
  ProviderStartIO,
  WorkerPool,
} from '@earthos/core';
import { mergePolicy, type ProviderPolicy } from './policy';
import { HttpError, RetryAfterError, parseRetryAfterMs } from './errors';
import { rateLimitWaitMs } from './rate-limiter';

export interface FetchIO {
  /** Instrumented fetch: throws HttpError / RetryAfterError on bad status. */
  fetch: typeof fetch;
  signal: AbortSignal;
  /** Timestamp of the last successful fetch (incremental feeds). */
  since?: number;
  settings: Record<string, unknown>;
  workers: WorkerPool;
  viewport: CameraSnapshot;
}

/** Min spacing between viewport-triggered refetches (leading-edge throttle). */
const VIEWPORT_REFETCH_THROTTLE_MS = 4_000;

/**
 * Polling provider with the stale-while-revalidate runtime built in:
 *
 * 1. attach -> cached data (if fresh enough) is emitted immediately;
 * 2. stale-or-missing -> background fetch, second emit on arrival;
 * 3. steady interval loop with jitter, exponential backoff on errors
 *    (last-good data keeps rendering), Retry-After honored, token-bucket
 *    rate limiting per origin, everything torn down by stop()/abort.
 *
 * Subclasses implement `fetch` (pure fetch+parse; heavy transforms belong in
 * workers) and optionally `merge` for incremental feeds.
 */
export abstract class DataProvider<T> implements ProviderInstance<T> {
  abstract readonly id: string;

  protected policyOverrides: Partial<ProviderPolicy> = {};
  private policyCache: ProviderPolicy | null = null;

  private io: ProviderStartIO | null = null;
  private emitFn: ((snap: ProviderSnapshot<T>) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: AbortController | null = null;
  private lastGood: T | null = null;
  private lastGoodAt: number | null = null;
  private lastKey: string | null = null;
  private attempt = 0;
  private stopped = true;
  private removeVisibility: (() => void) | null = null;
  private removeViewport: (() => void) | null = null;
  private viewportDebounce: ReturnType<typeof setTimeout> | null = null;
  private lastViewportFetchAt = 0;

  get policy(): ProviderPolicy {
    if (!this.policyCache) this.policyCache = mergePolicy(this.policyOverrides);
    return this.policyCache;
  }

  abstract fetch(io: FetchIO): Promise<T>;
  merge?(prev: T, next: T): T;

  /**
   * Cache key for the current settings. Override whenever the fetched
   * payload depends on a setting (catalog group, region, resolution), or a
   * settings change would serve the OLD payload from cache on next boot.
   */
  protected cacheKey(_settings: Record<string, unknown>): string {
    return 'latest';
  }

  async start(io: ProviderStartIO, emit: (snap: ProviderSnapshot<T>) => void): Promise<void> {
    this.io = io;
    this.emitFn = emit;
    this.stopped = false;
    this.attempt = 0;

    const { cache } = this.policy;
    const key = this.cacheKey(io.getSettings());
    this.lastKey = key;
    const cached = await io.cache.get<T>(key);
    if (this.stopped) return;
    const age = cached ? Date.now() - cached.storedAt : Infinity;

    if (cached && age <= cache.maxAgeMs) {
      this.lastGood = cached.value;
      this.lastGoodAt = cached.storedAt;
      const stale = age > cache.staleAfterMs;
      emit({ data: cached.value, state: stale ? 'stale' : 'ready', updatedAt: cached.storedAt });
      this.setupVisibilityPause();
      this.setupViewportRefetch();
      if (stale) void this.cycle();
      else this.schedule(Math.max(0, this.intervalWithJitter() - age));
      return;
    }

    emit({ data: null, state: 'loading', updatedAt: null });
    this.setupVisibilityPause();
    this.setupViewportRefetch();
    void this.cycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.viewportDebounce) clearTimeout(this.viewportDebounce);
    this.viewportDebounce = null;
    this.inflight?.abort();
    this.inflight = null;
    this.removeVisibility?.();
    this.removeVisibility = null;
    this.removeViewport?.();
    this.removeViewport = null;
  }

  refresh(): void {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    void this.cycle();
  }

  /** Latest good value, for subclasses. */
  protected get current(): T | null {
    return this.lastGood;
  }

  // -------------------------------------------------------------------------

  private intervalWithJitter(): number {
    const { intervalMs, jitterMs = 0 } = this.policy.refresh;
    if (!Number.isFinite(intervalMs)) return Infinity;
    return intervalMs + Math.random() * jitterMs;
  }

  private schedule(delayMs: number): void {
    if (this.stopped || !Number.isFinite(delayMs)) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.cycle(), delayMs);
  }

  private async cycle(): Promise<void> {
    if (this.stopped || !this.io || !this.emitFn) return;

    // Rate limiting: postpone the cycle, do not drop it.
    const rl = this.policy.rateLimit;
    if (rl) {
      const key = rl.scope === 'provider' ? this.id : `origin:${this.id.split('/')[0]}`;
      const wait = rateLimitWaitMs(key, rl);
      if (wait > 0) {
        this.schedule(wait);
        return;
      }
    }

    this.inflight?.abort();
    const controller = new AbortController();
    this.inflight = controller;
    const signal = AbortSignal.any([this.io.signal, controller.signal]);

    // Settings may have changed the cache identity since the last success:
    // last-good data from another key must not merge into or label this one.
    const key = this.cacheKey(this.io.getSettings());
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.lastGood = null;
      this.lastGoodAt = null;
      this.attempt = 0;
    }

    try {
      const data = await this.fetch({
        fetch: instrumentedFetch(signal),
        signal,
        ...(this.lastGoodAt !== null ? { since: this.lastGoodAt } : {}),
        settings: this.io.getSettings(),
        workers: this.io.workers,
        viewport: this.io.getViewport(),
      });
      if (signal.aborted || this.stopped) return;

      const merged = this.lastGood !== null && this.merge ? this.merge(this.lastGood, data) : data;
      this.lastGood = merged;
      this.lastGoodAt = Date.now();
      this.attempt = 0;
      void this.io.cache.set(key, merged);
      this.emitFn({ data: merged, state: 'ready', updatedAt: this.lastGoodAt });
      this.schedule(this.intervalWithJitter());
    } catch (err) {
      if (signal.aborted || this.stopped) return;
      this.attempt += 1;
      const { retry } = this.policy;
      this.emitFn({
        data: this.lastGood,
        state: 'error',
        updatedAt: this.lastGoodAt,
        error: err instanceof Error ? err.message : String(err),
      });
      let delay: number;
      if (retry.honorRetryAfter !== false && err instanceof RetryAfterError) {
        delay = err.retryAfterMs;
      } else if (this.attempt < retry.maxAttempts) {
        delay = retry.baseDelayMs * 2 ** (this.attempt - 1);
      } else {
        // Give up on the burst; fall back to the regular cadence.
        delay = Math.max(this.intervalWithJitter(), retry.baseDelayMs * 2 ** retry.maxAttempts);
        if (!Number.isFinite(delay)) delay = retry.baseDelayMs * 2 ** retry.maxAttempts;
      }
      this.schedule(delay);
    } finally {
      if (this.inflight === controller) this.inflight = null;
    }
  }

  private setupViewportRefetch(): void {
    if (!this.policy.refresh.viewportScoped) return;
    const subscribe = this.io?.onViewportChange;
    if (!subscribe) return;
    // Leading-edge throttle, not a pure trailing debounce: a pure debounce
    // never fires while the camera moves continuously (idle auto-rotate,
    // long fly-to), so the region-scoped data would never refresh. Refetch
    // promptly on the first move, then at most once per window, plus a
    // trailing fetch so the final resting viewport always wins.
    const throttleMs = VIEWPORT_REFETCH_THROTTLE_MS;
    this.lastViewportFetchAt = Date.now();
    const fire = () => {
      if (this.stopped) return;
      this.lastViewportFetchAt = Date.now();
      void this.cycle();
    };
    this.removeViewport = subscribe(() => {
      if (this.stopped) return;
      const since = Date.now() - this.lastViewportFetchAt;
      if (this.viewportDebounce) clearTimeout(this.viewportDebounce);
      if (since >= throttleMs) {
        fire();
      } else {
        this.viewportDebounce = setTimeout(fire, throttleMs - since);
      }
    });
  }

  private setupVisibilityPause(): void {
    if (!this.policy.refresh.pauseWhenHidden) return;
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    const onVisibility = () => {
      if (this.stopped) return;
      if (document.visibilityState === 'hidden') {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
      } else {
        const age = this.lastGoodAt ? Date.now() - this.lastGoodAt : Infinity;
        if (age > this.policy.cache.staleAfterMs) void this.cycle();
        else this.schedule(Math.max(0, this.intervalWithJitter() - age));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.removeVisibility = () => document.removeEventListener('visibilitychange', onVisibility);
  }
}

function instrumentedFetch(signal: AbortSignal): typeof fetch {
  return async (input, init) => {
    const res = await fetch(input, { ...init, signal: init?.signal ?? signal });
    if (!res.ok) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (res.status === 429 || res.status === 503) {
        const retryMs = parseRetryAfterMs(res.headers.get('retry-after')) ?? 30_000;
        throw new RetryAfterError(res.status, url, retryMs);
      }
      throw new HttpError(res.status, url);
    }
    return res;
  };
}

/** Fetch-once provider (static datasets, user files). */
export abstract class StaticProvider<T> extends DataProvider<T> {
  constructor() {
    super();
    this.policyOverrides = {
      refresh: { intervalMs: Infinity, pauseWhenHidden: false },
      cache: { staleAfterMs: Infinity, maxAgeMs: Infinity },
    };
  }
}
