import type { ComponentType } from 'react';
import type { TimeEngine } from './time-engine';
import type { WorkerPool } from './worker-pool';
import type { SettingsSchema } from './settings';

export type Disposer = () => void;

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

// ---------------------------------------------------------------------------
// Entities and selection
// ---------------------------------------------------------------------------

/** Stable reference to one entity rendered by one layer. */
export interface EntityRef {
  layerId: string;
  entityId: string;
}

export interface EntityHit {
  ref: EntityRef;
  label: string;
  detail?: string;
  /** 0..1 relevance for search ranking. */
  score?: number;
}

export interface EntityInfo {
  ref: EntityRef;
  label: string;
  position?: { lat: number; lon: number; altKm: number };
  /** Displayable properties (Altitude, Speed, Heading, Operator, ...). */
  properties?: Record<string, string | number | boolean | null>;
}

/** Registered by plugins so search and the inspector can resolve entities. */
export interface EntitySource {
  search(query: string, limit: number): EntityHit[] | Promise<EntityHit[]>;
  get?(entityId: string): EntityInfo | undefined | Promise<EntityInfo | undefined>;
}

// ---------------------------------------------------------------------------
// Layers and renderers
// ---------------------------------------------------------------------------

export type LayerKind = 'scene' | 'overlay' | 'tile';

export interface LayerDeclaration {
  kind: LayerKind;
  zOrder?: number;
}

export type LayerStatus = 'registered' | 'loading' | 'active' | 'error';

/**
 * What a plugin's renderer.ts default-exports. `Component` is mounted by the
 * host INSIDE its single R3F Canvas (never its own Canvas), wrapped in
 * Suspense and an error boundary.
 */
export interface LayerRenderer {
  Component: ComponentType<{ ctx: PluginContext }>;
  /** Optional warm-up (textures, geometry) awaited before first mount. */
  preload?(ctx: PluginContext): Promise<void>;
}

export interface LayerAPI {
  declare(decl: LayerDeclaration): void;
  setRenderer(renderer: LayerRenderer): void;
  clearRenderer(): void;
  setVisible(visible: boolean): void;
  isVisible(): boolean;
}

// ---------------------------------------------------------------------------
// Providers (core defines the minimal lifecycle protocol; @earthos/providers
// implements caching/polling/rate-limit policies on top of it)
// ---------------------------------------------------------------------------

export type ProviderState = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export interface ProviderSnapshot<T = unknown> {
  data: T | null;
  state: ProviderState;
  updatedAt: number | null;
  error?: string;
}

export interface CacheEntry<T = unknown> {
  value: T;
  storedAt: number;
}

/** Namespaced async key-value cache. Core ships memory; providers add IDB. */
export interface KeyValueCache {
  get<T = unknown>(key: string): Promise<CacheEntry<T> | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  /** Remove every key beginning with `prefix`. */
  clearPrefix(prefix: string): Promise<void>;
}

export interface CameraSnapshot {
  lat: number;
  lon: number;
  altKm: number;
  heading: number;
  pitch: number;
}

export interface ProviderStartIO {
  signal: AbortSignal;
  time: TimeEngine;
  workers: WorkerPool;
  cache: KeyValueCache;
  logger: Logger;
  getSettings(): Record<string, unknown>;
  getViewport(): CameraSnapshot;
}

/**
 * Minimal provider lifecycle. Implementations decide WHEN to emit (polling,
 * streaming, static); the engine only manages subscription plumbing.
 */
export interface ProviderInstance<T = unknown> {
  readonly id: string;
  start(io: ProviderStartIO, emit: (snap: ProviderSnapshot<T>) => void): void | Promise<void>;
  stop(): void;
  refresh?(): void;
}

export interface ProviderHandle<T = unknown> {
  get(): ProviderSnapshot<T>;
  subscribe(cb: (snap: ProviderSnapshot<T>) => void): Disposer;
  refresh(): void;
  detach(): void;
}

export interface ProviderAPI {
  attach<T>(instance: ProviderInstance<T>): ProviderHandle<T>;
  handle<T = unknown>(providerId: string): ProviderHandle<T> | undefined;
}

// ---------------------------------------------------------------------------
// Remaining context surfaces
// ---------------------------------------------------------------------------

export interface SceneAPI {
  /** Request a re-render when the host runs in on-demand frameloop mode. */
  invalidate(): void;
}

export interface SettingsAPI<T = Record<string, unknown>> {
  get(): T;
  patch(patch: Partial<T>): void;
  subscribe(cb: (values: T) => void): Disposer;
}

export interface EventBusLike {
  on<T = unknown>(event: string, handler: (payload: T) => void): Disposer;
  once<T = unknown>(event: string, handler: (payload: T) => void): Disposer;
  emit<T = unknown>(event: string, payload?: T): void;
}

export interface SelectionAPI {
  select(ref: EntityRef): void;
  clearSelection(): void;
  hover(ref: EntityRef | null): void;
  getSelected(): EntityRef | null;
}

export interface FlyToTarget {
  lat: number;
  lon: number;
  altKm?: number;
  /** Follow a moving entity instead of a fixed point. */
  follow?: EntityRef;
  durationMs?: number;
}

export interface CameraReader {
  getSnapshot(): CameraSnapshot;
  /** Throttled camera movement notifications (not per-frame). */
  onMove(cb: (snap: CameraSnapshot) => void): Disposer;
  /** Ask the host camera controller to fly somewhere. */
  flyTo(target: FlyToTarget): void;
}

export interface EntityAPI {
  registerSource(source: EntitySource): Disposer;
}

// ---------------------------------------------------------------------------
// The plugin contract (apiVersion 1)
// ---------------------------------------------------------------------------

export type PluginCategory =
  | 'satellites'
  | 'aviation'
  | 'maritime'
  | 'weather'
  | 'geophysical'
  | 'astronomy'
  | 'infrastructure'
  | 'custom';

export interface PluginMeta {
  name: string;
  category: PluginCategory;
  description?: string;
  /** Data source attribution shown in the UI, e.g. "CelesTrak". */
  attribution?: string;
  icon?: string;
}

export const PLUGIN_API_VERSION = 1 as const;

export interface PluginContext {
  readonly pluginId: string;
  readonly time: TimeEngine;
  readonly layers: LayerAPI;
  readonly scene: SceneAPI;
  readonly data: KeyValueCache;
  readonly providers: ProviderAPI;
  readonly workers: WorkerPool;
  readonly settings: SettingsAPI;
  readonly events: EventBusLike;
  readonly selection: SelectionAPI;
  readonly camera: CameraReader;
  readonly entities: EntityAPI;
  readonly logger: Logger;
  /** Aborted on deactivate/dispose. Thread through every fetch. */
  readonly signal: AbortSignal;
  /**
   * Forward-compatibility hatch: capabilities added within apiVersion 1 are
   * exposed here before graduating to named members in apiVersion 2.
   */
  getExtension<T = unknown>(key: string): T | undefined;
}

export interface EarthOSPlugin {
  readonly id: string;
  readonly apiVersion: typeof PLUGIN_API_VERSION;
  readonly meta: PluginMeta;
  readonly settingsSchema?: SettingsSchema;
  /** Cheap: declare layer + settings. No three/provider imports here. */
  register(ctx: PluginContext): void | Promise<void>;
  /** Layer enabled: lazy-import provider + renderer, start work. */
  activate(ctx: PluginContext): void | Promise<void>;
  /** Layer disabled: stop work. Caches and settings survive. */
  deactivate(ctx: PluginContext): void | Promise<void>;
  /** Removed entirely: free everything. */
  dispose(ctx: PluginContext): void | Promise<void>;
}

export type PluginModule = { default: EarthOSPlugin };
export type PluginLoader = () => Promise<PluginModule>;
