import { describe, expect, it } from 'vitest';
import { definePlugin, defineSettings, f } from '@earthos/core';
import { createTestHarness } from '../src/harness';
import { FixtureProvider } from '../src/fixture-provider';
import { runPluginContractTests } from '../src/contract-tests';

describe('createTestHarness', () => {
  it('drives the sim clock deterministically', () => {
    const harness = createTestHarness(1_000);
    expect(harness.engine.time.now()).toBe(1_000);
    harness.clock.advance(5_000);
    expect(harness.engine.time.now()).toBe(6_000);
  });

  it('register returns the live plugin context', async () => {
    const harness = createTestHarness();
    const plugin = definePlugin({
      id: 'demo',
      apiVersion: 1,
      meta: { name: 'Demo', category: 'custom' },
    });
    const ctx = await harness.register(plugin);
    expect(ctx.pluginId).toBe('demo');
    await harness.destroy();
  });
});

describe('FixtureProvider', () => {
  it('emits immediately and streams pushes', async () => {
    const harness = createTestHarness();
    const fixture = new FixtureProvider('fix', [1, 2, 3]);
    const plugin = definePlugin({
      id: 'fixtures',
      apiVersion: 1,
      meta: { name: 'Fixtures', category: 'custom' },
      provider: async () => ({ default: () => fixture }),
    });
    const ctx = await harness.register(plugin);
    await harness.activate('fixtures');
    const handle = ctx.providers.handle<number[]>('fix')!;
    expect(handle.get().data).toEqual([1, 2, 3]);
    fixture.push([4]);
    expect(handle.get().data).toEqual([4]);
    await harness.destroy();
  });
});

// The contract suite must pass for a well-formed reference plugin: this also
// exercises the suite itself.
runPluginContractTests(async () => ({
  default: definePlugin({
    id: 'reference',
    apiVersion: 1,
    meta: { name: 'Reference', category: 'custom', attribution: 'none' },
    settings: defineSettings({
      version: 1,
      fields: { enabled: f.boolean({ label: 'Enabled', default: true }) },
    }),
    provider: async () => ({ default: () => new FixtureProvider('ref', { ok: true }) }),
  }),
}));
