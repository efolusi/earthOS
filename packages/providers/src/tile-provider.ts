import type { ProviderInstance, ProviderSnapshot, ProviderStartIO } from '@earthos/core';

export interface TileDescriptor {
  /** URL template with {z}/{x}/{y} placeholders. */
  template: string;
  attribution?: string;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
}

/**
 * Tile providers do not fetch data themselves: they emit a descriptor the
 * tile engine consumes; HTTP caching handles the tiles. `refresh()`
 * re-describes (settings changes such as a new endpoint or API proxy).
 */
export abstract class TileProvider<
  TDesc extends TileDescriptor = TileDescriptor,
> implements ProviderInstance<TDesc> {
  abstract readonly id: string;

  private emitFn: ((snap: ProviderSnapshot<TDesc>) => void) | null = null;
  private io: ProviderStartIO | null = null;

  abstract describe(settings: Record<string, unknown>): TDesc;

  start(io: ProviderStartIO, emit: (snap: ProviderSnapshot<TDesc>) => void): void {
    this.io = io;
    this.emitFn = emit;
    this.emitDescriptor();
  }

  stop(): void {
    this.emitFn = null;
    this.io = null;
  }

  refresh(): void {
    this.emitDescriptor();
  }

  private emitDescriptor(): void {
    if (!this.emitFn || !this.io) return;
    try {
      this.emitFn({
        data: this.describe(this.io.getSettings()),
        state: 'ready',
        updatedAt: Date.now(),
      });
    } catch (err) {
      this.emitFn({
        data: null,
        state: 'error',
        updatedAt: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
