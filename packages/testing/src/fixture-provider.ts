import type { ProviderInstance, ProviderSnapshot, ProviderStartIO } from '@earthos/core';

/**
 * Provider that emits fixed data immediately: renderer tests get data
 * without network, timers, or cache concerns. `push` streams more.
 */
export class FixtureProvider<T> implements ProviderInstance<T> {
  private emitFn: ((snap: ProviderSnapshot<T>) => void) | null = null;
  refreshCount = 0;
  stopped = false;

  constructor(
    readonly id: string,
    private initial: T,
  ) {}

  start(_io: ProviderStartIO, emit: (snap: ProviderSnapshot<T>) => void): void {
    this.emitFn = emit;
    emit({ data: this.initial, state: 'ready', updatedAt: Date.now() });
  }

  stop(): void {
    this.stopped = true;
    this.emitFn = null;
  }

  refresh(): void {
    this.refreshCount += 1;
    this.emitFn?.({ data: this.initial, state: 'ready', updatedAt: Date.now() });
  }

  push(data: T): void {
    this.initial = data;
    this.emitFn?.({ data, state: 'ready', updatedAt: Date.now() });
  }
}
