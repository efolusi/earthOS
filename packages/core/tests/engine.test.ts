import { describe, expect, it, vi } from 'vitest';
import { createEarthEngine } from '../src/engine';
import { definePlugin } from '../src/define-plugin';
import { defineSettings, f } from '../src/settings';
import type {
  EarthOSPlugin,
  PluginContext,
  ProviderInstance,
  ProviderSnapshot,
} from '../src/types';

const silentLogger = { debug() {}, info() {}, warn() {}, error() {} };

function makeEngine() {
  return createEarthEngine({ persistKey: false, logger: silentLogger });
}

function makePlugin(overrides: Partial<EarthOSPlugin> = {}): EarthOSPlugin {
  return {
    id: 'test',
    apiVersion: 1,
    meta: { name: 'Test', category: 'custom' },
    register(ctx) {
      ctx.layers.declare({ kind: 'scene' });
    },
    activate() {},
    deactivate() {},
    dispose() {},
    ...overrides,
  };
}

describe('EarthEngine plugin lifecycle', () => {
  it('register -> activate -> deactivate -> dispose transitions layer status', async () => {
    const engine = makeEngine();
    const plugin = makePlugin();
    await engine.register(plugin);
    expect(engine.store.getState().layers.test?.status).toBe('registered');

    await engine.activate('test');
    expect(engine.store.getState().layers.test?.status).toBe('active');
    expect(engine.store.getState().layers.test?.visible).toBe(true);
    expect(engine.isActive('test')).toBe(true);

    await engine.deactivate('test');
    expect(engine.store.getState().layers.test?.status).toBe('registered');
    expect(engine.store.getState().layers.test?.visible).toBe(false);

    await engine.disposePlugin('test');
    expect(engine.store.getState().layers.test).toBeUndefined();
    expect(engine.getPlugin('test')).toBeUndefined();
  });

  it('rejects plugins with a mismatched apiVersion', async () => {
    const engine = makeEngine();
    const plugin = makePlugin({ apiVersion: 2 as unknown as 1 });
    await expect(engine.register(plugin)).rejects.toThrow(/api v2/);
  });

  it('activation failure marks the layer as error', async () => {
    const engine = makeEngine();
    const plugin = makePlugin({
      activate() {
        throw new Error('network down');
      },
    });
    await engine.register(plugin);
    await expect(engine.activate('test')).rejects.toThrow('network down');
    const layer = engine.store.getState().layers.test;
    expect(layer?.status).toBe('error');
    expect(layer?.error).toBe('network down');
  });

  it('ensure() imports and registers a lazy plugin exactly once', async () => {
    const engine = makeEngine();
    const loader = vi.fn(async () => ({ default: makePlugin() }));
    const [a, b] = await Promise.all([engine.ensure(loader), engine.ensure(loader)]);
    expect(a).toBe('test');
    expect(b).toBe('test');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('the abort signal fires on deactivate', async () => {
    const engine = makeEngine();
    let captured: AbortSignal | null = null;
    const plugin = makePlugin({
      activate(ctx: PluginContext) {
        captured = ctx.signal;
      },
    });
    await engine.register(plugin);
    await engine.activate('test');
    expect(captured!.aborted).toBe(false);
    await engine.deactivate('test');
    expect(captured!.aborted).toBe(true);
  });

  it('signal is pre-aborted while inactive', async () => {
    const engine = makeEngine();
    let ctx: PluginContext | null = null;
    const plugin = makePlugin({
      register(c) {
        ctx = c;
        c.layers.declare({ kind: 'scene' });
      },
    });
    await engine.register(plugin);
    expect(ctx!.signal.aborted).toBe(true);
  });
});

describe('EarthEngine settings', () => {
  const schema = defineSettings({
    version: 1,
    fields: {
      refreshSeconds: f.number({ label: 'Refresh', min: 5, max: 120, default: 10 }),
    },
  });

  it('seeds defaults at registration and validates patches', async () => {
    const engine = makeEngine();
    let ctx: PluginContext | null = null;
    const plugin = makePlugin({
      settingsSchema: schema,
      register(c) {
        ctx = c;
        c.layers.declare({ kind: 'scene' });
      },
    });
    await engine.register(plugin);
    expect(ctx!.settings.get()).toEqual({ refreshSeconds: 10 });

    ctx!.settings.patch({ refreshSeconds: 60 });
    expect(ctx!.settings.get()).toEqual({ refreshSeconds: 60 });

    ctx!.settings.patch({ refreshSeconds: 2 }); // below min: rejected
    expect(ctx!.settings.get()).toEqual({ refreshSeconds: 60 });
  });

  it('notifies settings subscribers', async () => {
    const engine = makeEngine();
    let ctx: PluginContext | null = null;
    const plugin = makePlugin({
      settingsSchema: schema,
      register(c) {
        ctx = c;
        c.layers.declare({ kind: 'scene' });
      },
    });
    await engine.register(plugin);
    const spy = vi.fn();
    ctx!.settings.subscribe(spy);
    ctx!.settings.patch({ refreshSeconds: 20 });
    expect(spy).toHaveBeenCalledWith({ refreshSeconds: 20 });
  });
});

describe('EarthEngine providers', () => {
  it('attach starts the provider and streams snapshots to subscribers', async () => {
    const engine = makeEngine();
    let emitFn: ((s: ProviderSnapshot<number>) => void) | null = null;
    const provider: ProviderInstance<number> = {
      id: 'feed',
      start: (_io, emit) => {
        emitFn = emit;
        emit({ data: 1, state: 'ready', updatedAt: 111 });
      },
      stop: vi.fn(),
    };
    let ctx: PluginContext | null = null;
    const plugin = makePlugin({
      activate(c) {
        ctx = c;
        c.providers.attach(provider);
      },
    });
    await engine.register(plugin);
    await engine.activate('test');

    const handle = ctx!.providers.handle<number>('feed')!;
    expect(handle.get()).toEqual({ data: 1, state: 'ready', updatedAt: 111 });

    const spy = vi.fn();
    handle.subscribe(spy);
    emitFn!({ data: 2, state: 'ready', updatedAt: 222 });
    expect(spy).toHaveBeenCalledWith({ data: 2, state: 'ready', updatedAt: 222 });

    await engine.deactivate('test');
    expect(provider.stop).toHaveBeenCalled();
    expect(ctx!.providers.handle('feed')).toBeUndefined();
  });
});

describe('definePlugin', () => {
  it('lazy-imports provider and renderer only on activation', async () => {
    const engine = makeEngine();
    const providerStart = vi.fn((_io: unknown, emit: (s: ProviderSnapshot<string>) => void) =>
      emit({ data: 'ok', state: 'ready', updatedAt: 1 }),
    );
    const providerLoader = vi.fn(async () => ({
      default: () =>
        ({ id: 'p', start: providerStart, stop: () => {} }) as ProviderInstance<unknown>,
    }));
    const rendererLoader = vi.fn(async () => ({
      default: { Component: () => null },
    }));

    const plugin = definePlugin({
      id: 'lazy',
      apiVersion: 1,
      meta: { name: 'Lazy', category: 'custom' },
      provider: providerLoader,
      renderer: rendererLoader,
    });

    await engine.register(plugin);
    expect(providerLoader).not.toHaveBeenCalled();
    expect(rendererLoader).not.toHaveBeenCalled();
    expect(engine.getRenderers().size).toBe(0);

    await engine.activate('lazy');
    expect(providerLoader).toHaveBeenCalledTimes(1);
    expect(rendererLoader).toHaveBeenCalledTimes(1);
    expect(providerStart).toHaveBeenCalled();
    expect(engine.getRenderers().has('lazy')).toBe(true);

    await engine.deactivate('lazy');
    expect(engine.getRenderers().has('lazy')).toBe(false);
  });
});

describe('EarthEngine search', () => {
  it('aggregates entity sources across plugins and ranks by score', async () => {
    const engine = makeEngine();
    const plugin = makePlugin({
      register(ctx) {
        ctx.layers.declare({ kind: 'scene' });
        ctx.entities.registerSource({
          search: (q) =>
            q === 'star'
              ? [
                  { ref: { layerId: 'test', entityId: '1' }, label: 'Starlink-1', score: 0.9 },
                  { ref: { layerId: 'test', entityId: '2' }, label: 'Starlette', score: 0.4 },
                ]
              : [],
        });
      },
    });
    await engine.register(plugin);
    const hits = await engine.search('star');
    expect(hits.map((h) => h.label)).toEqual(['Starlink-1', 'Starlette']);
    expect(await engine.search('nothing')).toEqual([]);
  });
});
