export interface RefreshPolicy {
  /** Interval between fetches, sim-independent wall ms. Infinity = once. */
  intervalMs: number;
  /** Random jitter added per cycle so fleets do not stampede an API. */
  jitterMs?: number;
  /** Suspend polling while the tab is hidden; refetch on return if stale. */
  pauseWhenHidden?: boolean;
  /** Refetch (debounced) when the camera settles on a new viewport. */
  viewportScoped?: boolean;
}

export interface CachePolicy {
  /** Serve cached data older than this with state 'stale' (and refetch). */
  staleAfterMs: number;
  /** Ignore cached data older than this entirely. */
  maxAgeMs: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  /** First backoff delay; doubles per attempt. */
  baseDelayMs: number;
  /** Honor HTTP 429/503 Retry-After headers. */
  honorRetryAfter?: boolean;
}

export interface RateLimitPolicy {
  tokensPerMinute: number;
  burst?: number;
  /** Bucket key: 'origin' shares the budget across providers per API host. */
  scope?: 'origin' | 'provider';
}

export interface ProviderPolicy {
  refresh: RefreshPolicy;
  cache: CachePolicy;
  retry: RetryPolicy;
  rateLimit?: RateLimitPolicy;
}

export const DEFAULT_POLICY: ProviderPolicy = {
  refresh: { intervalMs: 60_000, jitterMs: 5_000, pauseWhenHidden: true },
  cache: { staleAfterMs: 5 * 60_000, maxAgeMs: 24 * 3_600_000 },
  retry: { maxAttempts: 3, baseDelayMs: 2_000, honorRetryAfter: true },
};

export function mergePolicy(partial?: Partial<ProviderPolicy>): ProviderPolicy {
  return {
    refresh: { ...DEFAULT_POLICY.refresh, ...partial?.refresh },
    cache: { ...DEFAULT_POLICY.cache, ...partial?.cache },
    retry: { ...DEFAULT_POLICY.retry, ...partial?.retry },
    ...(partial?.rateLimit ? { rateLimit: partial.rateLimit } : {}),
  };
}
