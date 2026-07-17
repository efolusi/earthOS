import type { RateLimitPolicy } from './policy';

/**
 * Token bucket. Buckets are shared per key (usually the API origin) so two
 * providers hitting the same host cannot stampede it together.
 */
class Bucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(
    private ratePerMs: number,
    private capacity: number,
  ) {
    this.tokens = capacity;
  }

  /** ms to wait before a token is available; 0 when one was consumed now. */
  take(): number {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.ratePerMs);
    this.lastRefill = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - this.tokens) / this.ratePerMs);
  }
}

const buckets = new Map<string, Bucket>();

export function rateLimitWaitMs(key: string, policy: RateLimitPolicy): number {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = new Bucket(policy.tokensPerMinute / 60_000, policy.burst ?? policy.tokensPerMinute);
    buckets.set(key, bucket);
  }
  return bucket.take();
}

/** Test hook. */
export function resetRateLimiters(): void {
  buckets.clear();
}
