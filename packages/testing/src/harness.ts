import {
  createEarthEngine,
  type EarthEngine,
  type EarthOSPlugin,
  type Logger,
  type PluginContext,
} from '@earthos/core';

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

export interface TestHarness {
  engine: EarthEngine;
  /** Register the plugin; resolves its live PluginContext. */
  register(plugin: EarthOSPlugin): Promise<PluginContext>;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  dispose(id: string): Promise<void>;
  destroy(): Promise<void>;
  /** Controllable clock driving the harness TimeEngine. */
  clock: { now(): number; advance(ms: number): void; set(ms: number): void };
}

/**
 * A real EarthEngine wired for tests: no persistence, silent logs, and a
 * deterministic clock. Testing against the real engine keeps the harness
 * honest; there is no mock drift from the production lifecycle.
 */
export function createTestHarness(startEpochMs = Date.UTC(2026, 0, 1)): TestHarness {
  let nowMs = startEpochMs;
  const engine = createEarthEngine({
    persistKey: false,
    logger: silentLogger,
    clock: () => nowMs,
  });

  return {
    engine,
    clock: {
      now: () => nowMs,
      advance: (ms) => {
        nowMs += ms;
      },
      set: (ms) => {
        nowMs = ms;
      },
    },
    async register(plugin) {
      await engine.register(plugin);
      const ctx = engine.getContext(plugin.id);
      if (!ctx) throw new Error(`context missing for "${plugin.id}"`);
      return ctx;
    },
    activate: (id) => engine.activate(id),
    deactivate: (id) => engine.deactivate(id),
    dispose: (id) => engine.disposePlugin(id),
    destroy: () => engine.destroy(),
  };
}
