# EarthOS Architecture

## The one-paragraph version

EarthOS is a plugin runtime (`@earthos/core`) with a 3D globe renderer attached (`@earthos/globe`). Every data source is an independently installable plugin that talks to the runtime through one small contract (`EarthOSPlugin` + `PluginContext`). Data flows through a provider framework with caching and scheduling policies (`@earthos/providers`); geometry and orbital math live in `@earthos/gis`; panels and controls in `@earthos/ui`; everything is re-exported for consumers as the `earthos` SDK.

## Package graph

```
gis ──────── (no internal deps)     geodesy, SGP4 wrappers, astronomy, GeoGrid
core ─────── (no internal deps)     engine, plugin contract, time, workers, stores
providers ── core                   DataProvider + SWR runtime, IDB cache
globe ────── core, gis              R3F globe, camera, points pipeline, layer host
ui ───────── core                   panels, timeline, palette, settings forms
testing ──── core, providers        harness + contract tests
plugin-* ─── core, providers, gis   (+ globe, three, react as PEERS)
earthos ──── all of the above       the npm SDK
```

No cycles. `react`, `three`, `@react-three/fiber`, `@react-three/drei`, `maplibre-gl` are peerDependencies in every publishable package (`pnpm check-peers` enforces this in CI): duplicated Three/React instances silently break R3F context identity, so exactly one copy may exist per app.

## The plugin contract (apiVersion 1)

```ts
interface EarthOSPlugin {
  id: string;
  apiVersion: 1;
  meta: PluginMeta;
  settingsSchema?: SettingsSchema;
  register(ctx); // cheap: declare layer + settings. No three imports.
  activate(ctx); // lazy-import provider + renderer, start work
  deactivate(ctx); // stop work; caches and settings survive
  dispose(ctx); // remove entirely
}
```

`definePlugin` composes these from the mandated file shape (`plugin.ts`, `provider.ts`, `renderer.ts`, `settings.ts`, `types.ts`). `plugin.ts` is the only statically imported module; provider and renderer are `import()` split points, so a disabled plugin costs zero bytes at runtime.

`PluginContext` is the entire API a plugin sees: `time` (sim clock), `layers`, `scene`, `data` (namespaced cache), `providers`, `workers`, `settings`, `events`, `selection`, `camera`, `entities` (search/inspector integration), `logger`, `signal` (aborted on deactivate). New capabilities land behind `ctx.getExtension(key)` until an apiVersion bump; the follow-camera tracker registry (`globe:trackers`) is the first example.

## Data flow

```
Provider (fetch/stream/tile) ──emit──▶ ProviderHandle ──subscribe──▶ Renderer
        │                                                             │
   SWR cache (memory + IndexedDB)                     typed arrays ──▶ GPU
```

Providers implement `start(io, emit)` / `stop()`; the `DataProvider` base class implements stale-while-revalidate, retry with backoff, Retry-After, per-origin token buckets, and visibility pause. Renderers subscribe to snapshots and write typed arrays; **no per-frame data ever goes through React or zustand**.

## State

One vanilla zustand store per engine: layer statuses, camera snapshot (throttled to ~4 Hz), selection, time control mirror, and plugin settings. Persistence (localStorage) covers settings, layer visibility preferences, and camera. The per-frame clock is `engine.time.now()`: pull-based, float64, never `setState`d.

## Rendering integration

`EarthCanvas` owns the single R3F Canvas. `EarthFixedGroup` provides THE rotating earth-fixed frame (rotation.y = GMST) via React context wrapping the whole canvas subtree; earth-fixed content portals in. `PluginLayersHost` mounts each active layer's renderer inside Suspense and an error boundary: a crashing layer marks itself errored instead of killing the scene.

See [RENDERING.md](RENDERING.md) for coordinate frames and the 100k-points pipeline, and [PERFORMANCE.md](PERFORMANCE.md) for budgets and rules.

## Decision records

Non-obvious choices are captured in [docs/adr/](adr/): scene units and frames, GPU extrapolation over instancing, the home-grown settings DSL, peer-dependency singletons, and the provider protocol split between core and providers.
