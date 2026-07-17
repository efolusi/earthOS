import { describe, expect, it } from 'vitest';
import { PLUGIN_API_VERSION, type PluginModule } from '@earthos/core';
import { createTestHarness } from './harness';

export interface ContractTestOptions {
  /**
   * Contract tests run activate() with network stubbed to fail, proving the
   * plugin activates gracefully offline (providers emit error snapshots but
   * the layer must still come up). Set false only for plugins whose activate
   * cannot run in node at all, and say why in a comment.
   */
  activation?: boolean;
}

/**
 * The conformance suite every EarthOS plugin runs in its own tests/ and that
 * framework CI runs against all official plugins. Call at module top level:
 *
 *   runPluginContractTests(() => import('../src/plugin'));
 */
export function runPluginContractTests(
  load: () => Promise<PluginModule>,
  options: ContractTestOptions = {},
): void {
  const { activation = true } = options;

  describe('EarthOS plugin contract', () => {
    it('default-exports a plugin with id, apiVersion, and meta', async () => {
      const plugin = (await load()).default;
      expect(plugin.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(plugin.apiVersion).toBe(PLUGIN_API_VERSION);
      expect(plugin.meta.name.length).toBeGreaterThan(0);
      expect(plugin.meta.category.length).toBeGreaterThan(0);
      expect(typeof plugin.register).toBe('function');
      expect(typeof plugin.activate).toBe('function');
      expect(typeof plugin.deactivate).toBe('function');
      expect(typeof plugin.dispose).toBe('function');
    });

    it('register() declares its layer and seeds settings defaults', async () => {
      const plugin = (await load()).default;
      const harness = createTestHarness();
      await harness.register(plugin);
      const layer = harness.engine.store.getState().layers[plugin.id];
      expect(layer).toBeDefined();
      expect(layer!.status).toBe('registered');
      if (plugin.settingsSchema) {
        const values = harness.engine.store.getState().settings[plugin.id];
        expect(values).toBeDefined();
        for (const key of Object.keys(plugin.settingsSchema.fields)) {
          expect(values).toHaveProperty(key);
        }
      }
      await harness.destroy();
    });

    if (activation) {
      it('activates offline, deactivates cleanly, and reactivates', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.reject(new Error('offline (contract test)'));
        try {
          const plugin = (await load()).default;
          const harness = createTestHarness();
          const ctx = await harness.register(plugin);

          await harness.activate(plugin.id);
          expect(harness.engine.store.getState().layers[plugin.id]!.status).toBe('active');
          expect(ctx.signal.aborted).toBe(false);

          await harness.deactivate(plugin.id);
          expect(harness.engine.store.getState().layers[plugin.id]!.status).toBe('registered');
          expect(ctx.signal.aborted).toBe(true);
          expect(harness.engine.getRenderers().has(plugin.id)).toBe(false);

          await harness.activate(plugin.id);
          expect(harness.engine.store.getState().layers[plugin.id]!.status).toBe('active');

          await harness.destroy();
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      it('dispose removes the layer entirely', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.reject(new Error('offline (contract test)'));
        try {
          const plugin = (await load()).default;
          const harness = createTestHarness();
          await harness.register(plugin);
          await harness.activate(plugin.id);
          await harness.dispose(plugin.id);
          expect(harness.engine.store.getState().layers[plugin.id]).toBeUndefined();
          expect(harness.engine.getPlugin(plugin.id)).toBeUndefined();
          await harness.destroy();
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    }

    it('settings defaults validate against their own schema', async () => {
      const plugin = (await load()).default;
      if (!plugin.settingsSchema) return;
      const { settingsDefaults, validateSettingsPatch } = await import('@earthos/core');
      const defaults = settingsDefaults(plugin.settingsSchema);
      const result = validateSettingsPatch(plugin.settingsSchema, defaults);
      expect(result.ok).toBe(true);
    });
  });
}
