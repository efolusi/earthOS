import { TimeEngine } from './time-engine';
import { EventBus } from './event-bus';
import { WorkerPool } from './worker-pool';
import { MemoryCache, namespacedCache } from './memory-cache';
import { createEarthStore, type EarthStore } from './store';
import { hydrateSettings, validateSettingsPatch, type SettingsSchema } from './settings';
import {
  PLUGIN_API_VERSION,
  type CameraSnapshot,
  type Disposer,
  type EarthOSPlugin,
  type EntityHit,
  type EntityInfo,
  type EntityRef,
  type EntitySource,
  type FlyToTarget,
  type KeyValueCache,
  type LayerRenderer,
  type Logger,
  type PluginContext,
  type PluginLoader,
  type ProviderHandle,
  type ProviderInstance,
  type ProviderSnapshot,
} from './types';

export interface EarthEngineOptions {
  persistKey?: string | false;
  logger?: Logger;
  clock?: () => number;
  cache?: KeyValueCache;
  startEpochMs?: number;
}

interface RegisteredPlugin {
  plugin: EarthOSPlugin;
  ctx: PluginContext;
  abort: AbortController | null;
  providerHandles: Map<string, ProviderHandle<unknown>>;
  entityDisposers: Set<Disposer>;
  ownWorkers: WorkerPool;
  activation: Promise<void> | null;
}

const consoleLogger = (prefix: string): Logger => ({
  debug: (...a) => console.debug(`[${prefix}]`, ...a),
  info: (...a) => console.info(`[${prefix}]`, ...a),
  warn: (...a) => console.warn(`[${prefix}]`, ...a),
  error: (...a) => console.error(`[${prefix}]`, ...a),
});

const ABORTED = (() => {
  const c = new AbortController();
  c.abort();
  return c.signal;
})();

/**
 * The EarthOS runtime: plugin registry + lifecycle, simulation clock, event
 * bus, cache, and the UI store. One engine per <Earth/> instance. Everything
 * here is renderer-agnostic; @earthos/globe mounts the visuals.
 */
export class EarthEngine {
  readonly store: EarthStore;
  readonly time: TimeEngine;
  readonly events: EventBus;
  readonly logger: Logger;

  private cache: KeyValueCache;
  private plugins = new Map<string, RegisteredPlugin>();
  private loaded = new Map<PluginLoader, Promise<string>>();
  private renderers = new Map<string, LayerRenderer>();
  private rendererListeners = new Set<() => void>();
  private entitySources = new Map<string, Set<EntitySource>>();
  private invalidateFn: (() => void) | null = null;
  private extensions = new Map<string, unknown>();

  constructor(options: EarthEngineOptions = {}) {
    this.logger = options.logger ?? consoleLogger('earthos');
    this.store = createEarthStore({ persistKey: options.persistKey });
    this.time = new TimeEngine({ clock: options.clock, startEpochMs: options.startEpochMs });
    this.events = new EventBus(this.logger);
    this.cache = options.cache ?? new MemoryCache();

    // Mirror time changes into the store at change frequency (not per tick).
    this.time.onChange(() => {
      const snap = this.time.snapshot();
      this.store.getState().setTimeCtl(snap);
      this.events.emit('core:time:change', snap);
    });

    // Selection changes become canonical events (renderers subscribe there).
    let prevPicked = this.store.getState().selection.picked;
    this.store.subscribe((state) => {
      if (state.selection.picked !== prevPicked) {
        prevPicked = state.selection.picked;
        this.events.emit('core:selection', prevPicked);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Plugin lifecycle
  // -------------------------------------------------------------------------

  /** Register an already-imported plugin. Idempotent per id. */
  async register(plugin: EarthOSPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) return;
    if (plugin.apiVersion !== PLUGIN_API_VERSION) {
      throw new Error(
        `plugin "${plugin.id}" targets api v${plugin.apiVersion}, host speaks v${PLUGIN_API_VERSION}`,
      );
    }
    const entry: RegisteredPlugin = {
      plugin,
      ctx: null as unknown as PluginContext,
      abort: null,
      providerHandles: new Map(),
      entityDisposers: new Set(),
      ownWorkers: new WorkerPool(this.logger),
      activation: null,
    };
    entry.ctx = this.createContext(plugin, entry);
    this.plugins.set(plugin.id, entry);

    // Seed settings: defaults overlaid with persisted values.
    if (plugin.settingsSchema) {
      const persisted = this.store.getState().settings[plugin.id];
      const values = hydrateSettings(plugin.settingsSchema, persisted);
      this.store.getState().replaceSettings(plugin.id, values);
    }

    this.store.getState().upsertLayer(plugin.id, { status: 'registered' });
    await plugin.register(entry.ctx);
    this.events.emit('core:plugin:registered', { id: plugin.id });
  }

  /** Import (once) and register a plugin from a lazy loader. Returns its id. */
  ensure(loader: PluginLoader): Promise<string> {
    let promise = this.loaded.get(loader);
    if (!promise) {
      promise = loader().then(async (mod) => {
        await this.register(mod.default);
        return mod.default.id;
      });
      this.loaded.set(loader, promise);
    }
    return promise;
  }

  async activate(id: string): Promise<void> {
    const entry = this.mustGet(id);
    if (entry.activation) return entry.activation;
    entry.abort = new AbortController();
    this.store.getState().upsertLayer(id, { status: 'loading', error: undefined });
    entry.activation = (async () => {
      try {
        await entry.plugin.activate(entry.ctx);
        if (entry.abort?.signal.aborted) return;
        this.store.getState().upsertLayer(id, { status: 'active' });
        this.store.getState().setLayerVisible(id, true);
        this.events.emit('core:plugin:activated', { id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`plugin "${id}" failed to activate`, err);
        this.store.getState().upsertLayer(id, { status: 'error', error: message });
        entry.activation = null;
        throw err;
      }
    })();
    return entry.activation;
  }

  async deactivate(id: string): Promise<void> {
    const entry = this.mustGet(id);
    if (!entry.activation) return;
    entry.abort?.abort();
    entry.abort = null;
    entry.activation = null;
    for (const handle of entry.providerHandles.values()) handle.detach();
    entry.providerHandles.clear();
    entry.ownWorkers.terminateAll();
    try {
      await entry.plugin.deactivate(entry.ctx);
    } finally {
      this.clearRenderer(id);
      this.store.getState().upsertLayer(id, { status: 'registered' });
      this.store.getState().setLayerVisible(id, false);
      this.events.emit('core:plugin:deactivated', { id });
    }
  }

  async disposePlugin(id: string): Promise<void> {
    const entry = this.plugins.get(id);
    if (!entry) return;
    if (entry.activation) await this.deactivate(id).catch(() => undefined);
    for (const dispose of entry.entityDisposers) dispose();
    entry.entityDisposers.clear();
    try {
      await entry.plugin.dispose(entry.ctx);
    } finally {
      await this.cache.clearPrefix(`${id}/`);
      this.plugins.delete(id);
      this.store.getState().removeLayer(id);
      this.events.emit('core:plugin:disposed', { id });
    }
  }

  /** Toggle helper the UI binds to. */
  async setLayerEnabled(id: string, enabled: boolean): Promise<void> {
    if (enabled) await this.activate(id);
    else await this.deactivate(id);
  }

  isActive(id: string): boolean {
    return this.plugins.get(id)?.activation != null;
  }

  getPlugin(id: string): EarthOSPlugin | undefined {
    return this.plugins.get(id)?.plugin;
  }

  /** The plugin's context, e.g. for the R3F host to pass into renderers. */
  getContext(id: string): PluginContext | undefined {
    return this.plugins.get(id)?.ctx;
  }

  listPlugins(): EarthOSPlugin[] {
    return [...this.plugins.values()].map((e) => e.plugin);
  }

  // -------------------------------------------------------------------------
  // Renderer registry (consumed by the R3F host component)
  // -------------------------------------------------------------------------

  getRenderers(): ReadonlyMap<string, LayerRenderer> {
    return this.renderers;
  }

  onRenderersChange(cb: () => void): Disposer {
    this.rendererListeners.add(cb);
    return () => this.rendererListeners.delete(cb);
  }

  /** Wire the host's invalidate() so plugins can request frames. */
  setInvalidate(fn: (() => void) | null): void {
    this.invalidateFn = fn;
  }

  private setRenderer(id: string, renderer: LayerRenderer): void {
    this.renderers.set(id, renderer);
    this.notifyRenderers();
  }

  private clearRenderer(id: string): void {
    if (this.renderers.delete(id)) this.notifyRenderers();
  }

  private notifyRenderers(): void {
    for (const cb of [...this.rendererListeners]) cb();
  }

  // -------------------------------------------------------------------------
  // Search across plugin entity sources
  // -------------------------------------------------------------------------

  async search(query: string, limit = 20): Promise<EntityHit[]> {
    const q = query.trim();
    if (!q) return [];
    const perSource = Math.max(5, Math.ceil(limit / Math.max(1, this.entitySources.size)));
    const batches = await Promise.all(
      [...this.entitySources.values()].flatMap((sources) =>
        [...sources].map(async (source) => {
          try {
            return await source.search(q, perSource);
          } catch {
            return [];
          }
        }),
      ),
    );
    return batches
      .flat()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, limit);
  }

  async getEntityInfo(ref: EntityRef): Promise<EntityInfo | undefined> {
    const sources = this.entitySources.get(ref.layerId);
    if (!sources) return undefined;
    for (const source of sources) {
      const info = await source.get?.(ref.entityId);
      if (info) return info;
    }
    return undefined;
  }

  // -------------------------------------------------------------------------
  // Extensions (forward-compat within apiVersion 1)
  // -------------------------------------------------------------------------

  provideExtension(key: string, value: unknown): void {
    this.extensions.set(key, value);
  }

  getExtension<T = unknown>(key: string): T | undefined {
    return this.extensions.get(key) as T | undefined;
  }

  // -------------------------------------------------------------------------
  // Teardown
  // -------------------------------------------------------------------------

  async destroy(): Promise<void> {
    for (const id of [...this.plugins.keys()]) {
      await this.disposePlugin(id).catch(() => undefined);
    }
    this.rendererListeners.clear();
  }

  // -------------------------------------------------------------------------
  // Context construction
  // -------------------------------------------------------------------------

  private mustGet(id: string): RegisteredPlugin {
    const entry = this.plugins.get(id);
    if (!entry) throw new Error(`plugin "${id}" is not registered`);
    return entry;
  }

  private createContext(plugin: EarthOSPlugin, entry: RegisteredPlugin): PluginContext {
    const engine = this;
    const id = plugin.id;
    const logger: Logger = {
      debug: (...a) => engine.logger.debug(`[${id}]`, ...a),
      info: (...a) => engine.logger.info(`[${id}]`, ...a),
      warn: (...a) => engine.logger.warn(`[${id}]`, ...a),
      error: (...a) => engine.logger.error(`[${id}]`, ...a),
    };
    const pluginCache = namespacedCache(this.cache, id);
    const scopedEvents = this.events.scoped(id);

    const settingsApi = {
      get: () => engine.store.getState().settings[id] ?? {},
      patch: (patch: Record<string, unknown>) => {
        const schema: SettingsSchema | undefined = plugin.settingsSchema;
        if (schema) {
          const result = validateSettingsPatch(schema, patch);
          if (!result.ok) {
            logger.warn('rejected invalid settings patch', result.errors);
            return;
          }
          engine.store.getState().patchSettings(id, result.value);
        } else {
          engine.store.getState().patchSettings(id, patch);
        }
        scopedEvents.emit('settings', engine.store.getState().settings[id]);
      },
      subscribe: (cb: (values: Record<string, unknown>) => void) => {
        let prev = engine.store.getState().settings[id];
        return engine.store.subscribe((state) => {
          const next = state.settings[id];
          if (next !== prev) {
            prev = next;
            cb(next ?? {});
          }
        });
      },
    };

    return {
      pluginId: id,
      time: this.time,
      logger,
      get signal() {
        return entry.abort?.signal ?? ABORTED;
      },
      layers: {
        declare: (decl) => {
          engine.store.getState().upsertLayer(id, { kind: decl.kind, zOrder: decl.zOrder ?? 0 });
        },
        setRenderer: (renderer) => engine.setRenderer(id, renderer),
        clearRenderer: () => engine.clearRenderer(id),
        setVisible: (visible) => engine.store.getState().setLayerVisible(id, visible),
        isVisible: () => engine.store.getState().layers[id]?.visible ?? false,
      },
      scene: {
        invalidate: () => engine.invalidateFn?.(),
      },
      data: pluginCache,
      providers: {
        attach: <T>(instance: ProviderInstance<T>) => {
          let latest: ProviderSnapshot<T> = {
            data: null,
            state: 'idle',
            updatedAt: null,
          };
          const subscribers = new Set<(snap: ProviderSnapshot<T>) => void>();
          const emit = (snap: ProviderSnapshot<T>) => {
            latest = snap;
            for (const cb of [...subscribers]) cb(snap);
            scopedEvents.emit(`provider:${instance.id}`, snap);
          };
          const io = {
            signal: entry.abort?.signal ?? ABORTED,
            time: engine.time,
            workers: entry.ownWorkers,
            cache: namespacedCache(pluginCache, instance.id),
            logger,
            getSettings: () => settingsApi.get(),
            getViewport: () => engine.store.getState().camera,
            onViewportChange: (cb: (snap: CameraSnapshot) => void) =>
              engine.events.on<CameraSnapshot>('core:camera:move', cb),
          };
          void instance.start(io, emit);
          const handle: ProviderHandle<T> = {
            get: () => latest,
            subscribe: (cb) => {
              subscribers.add(cb);
              return () => subscribers.delete(cb);
            },
            refresh: () => instance.refresh?.(),
            detach: () => {
              instance.stop();
              subscribers.clear();
              entry.providerHandles.delete(instance.id);
            },
          };
          entry.providerHandles.set(instance.id, handle as ProviderHandle<unknown>);
          return handle;
        },
        handle: <T>(providerId: string) =>
          entry.providerHandles.get(providerId) as ProviderHandle<T> | undefined,
      },
      workers: entry.ownWorkers,
      settings: settingsApi,
      events: scopedEvents,
      selection: {
        select: (ref: EntityRef) => engine.store.getState().setSelected(ref),
        clearSelection: () => engine.store.getState().setSelected(null),
        hover: (ref: EntityRef | null) => engine.store.getState().setHovered(ref),
        getSelected: () => engine.store.getState().selection.picked,
      },
      camera: {
        getSnapshot: (): CameraSnapshot => engine.store.getState().camera,
        onMove: (cb) => engine.events.on<CameraSnapshot>('core:camera:move', cb),
        flyTo: (target: FlyToTarget) => engine.events.emit('core:camera:flyTo', target),
        follow: (ref: EntityRef) => engine.events.emit('core:camera:follow', ref),
      },
      entities: {
        registerSource: (source: EntitySource) => {
          let sources = engine.entitySources.get(id);
          if (!sources) {
            sources = new Set();
            engine.entitySources.set(id, sources);
          }
          sources.add(source);
          const dispose = () => {
            sources.delete(source);
            if (sources.size === 0) engine.entitySources.delete(id);
            entry.entityDisposers.delete(dispose);
          };
          entry.entityDisposers.add(dispose);
          return dispose;
        },
      },
      getExtension: <T>(key: string) => engine.extensions.get(key) as T | undefined,
    };
  }
}

export function createEarthEngine(options: EarthEngineOptions = {}): EarthEngine {
  return new EarthEngine(options);
}
