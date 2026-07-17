import type { Disposer } from './types';

export interface TimeSnapshot {
  epochMs: number;
  rate: number;
  live: boolean;
}

export type TimeChangeEvent =
  | { type: 'jump'; epochMs: number }
  | { type: 'rate'; rate: number }
  | { type: 'live'; live: boolean };

/**
 * Central simulation clock. Per-frame consumers PULL `now()` (cheap, float64
 * math only); `onChange` listeners fire on jumps and rate changes, never per
 * tick. Workers dead-reckon from broadcast snapshots.
 */
export class TimeEngine {
  private anchorSimMs: number;
  private anchorRealMs: number;
  private rateValue = 1;
  private liveFlag: boolean;
  private listeners = new Set<(e: TimeChangeEvent) => void>();
  private readonly clock: () => number;

  constructor(opts: { clock?: () => number; startEpochMs?: number } = {}) {
    this.clock = opts.clock ?? (() => Date.now());
    this.anchorRealMs = this.clock();
    this.anchorSimMs = opts.startEpochMs ?? this.anchorRealMs;
    this.liveFlag = opts.startEpochMs === undefined;
  }

  /** Current simulation epoch in ms. */
  now(): number {
    if (this.liveFlag) return this.clock();
    return this.anchorSimMs + (this.clock() - this.anchorRealMs) * this.rateValue;
  }

  get rate(): number {
    return this.liveFlag ? 1 : this.rateValue;
  }

  get live(): boolean {
    return this.liveFlag;
  }

  setRate(rate: number): void {
    if (!Number.isFinite(rate)) return;
    if (this.liveFlag && rate === 1) return;
    if (!this.liveFlag && rate === this.rateValue) return;
    this.anchorSimMs = this.now();
    this.anchorRealMs = this.clock();
    this.rateValue = rate;
    if (this.liveFlag) {
      this.liveFlag = false;
      this.emit({ type: 'live', live: false });
    }
    this.emit({ type: 'rate', rate });
  }

  pause(): void {
    this.setRate(0);
  }

  jumpTo(epochMs: number): void {
    this.anchorSimMs = epochMs;
    this.anchorRealMs = this.clock();
    if (this.liveFlag) {
      this.liveFlag = false;
      this.emit({ type: 'live', live: false });
    }
    this.emit({ type: 'jump', epochMs });
  }

  /** Shift simulation time by a delta without changing the rate. */
  offsetBy(deltaMs: number): void {
    this.jumpTo(this.now() + deltaMs);
  }

  /** Return to wall-clock time at 1x. */
  resumeLive(): void {
    if (this.liveFlag) return;
    this.liveFlag = true;
    this.rateValue = 1;
    this.emit({ type: 'live', live: true });
    this.emit({ type: 'jump', epochMs: this.clock() });
  }

  snapshot(): TimeSnapshot {
    return { epochMs: this.now(), rate: this.rate, live: this.liveFlag };
  }

  onChange(cb: (e: TimeChangeEvent) => void): Disposer {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(e: TimeChangeEvent): void {
    for (const listener of [...this.listeners]) listener(e);
  }
}
