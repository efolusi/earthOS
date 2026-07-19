# earthos

A real-time interactive 3D digital twin of Earth: composable globe, satellites, earthquakes, and your own data as plugins.

This is the meta SDK you install to build with EarthOS. It re-exports the React components (`Earth`, `Layer`, and typed per-plugin wrappers), the UI control surfaces, the engine hooks, the headless `createEarthEngine`, and the plugin-authoring primitives from one entry point. Layers are lazy plugins, so you only ship the data sources you mount. Live demo: [earthos.efolusi.com](https://earthos.efolusi.com).

## Install

```bash
pnpm add earthos
```

Peer dependencies (single-instance, provide them yourself): `react` and `react-dom` (^19), `three` (>=0.170), `@react-three/fiber` (^9), `@react-three/drei` (^9 || ^10), `framer-motion` (^11 || ^12).

## Usage

```tsx
import { Earth, LayerSatellites, LayerEarthquakes, Layer } from 'earthos';

export function App() {
  return (
    <Earth stars moon persistKey="earthos" style={{ width: '100vw', height: '100vh' }}>
      <LayerSatellites group="starlink" />
      <LayerEarthquakes feed="all_day" minMagnitude={2.5} />
      {/* any third-party plugin, no wrapper needed */}
      <Layer
        manifest={() => import('@earthos/plugin-geojson')}
        settings={{ url: '/data.geojson' }}
      />
    </Earth>
  );
}
```

`<Earth/>` mounts the WebGL canvas client-side only, so it renders safely from any SSR framework. It creates its own engine by default, or you can pass one from `createEarthEngine` for headless and imperative setups.

## What's exported

- Components: `Earth`, generic `Layer`, and typed wrappers `LayerImagery`, `LayerSatellites`, `LayerAircraft`, `LayerEarthquakes`, `LayerDayNight`, `LayerEclipse`, `LayerHurricanes`, `LayerGeoJson`.
- UI kit (tree-shakeable): `LayerPanel`, `Timeline`, `Inspector`, `CommandPalette`, `StatusBar`, `SettingsForm`, `GlassPanel`, `HoverCard`.
- Hooks: `useEarth`, `useEarthState`, `useSimTime`, `useLayer`, `useLayerRenderers`, plus `EarthEngineProvider`.
- Engine and plugin authoring: `createEarthEngine`, `definePlugin`, `defineSettings`, `f`, `PLUGIN_API_VERSION`, and provider bases `DataProvider`, `StaticProvider`, `StreamProvider`, `TileProvider`.
- Lower-level building blocks: `EarthCanvas`, `ExtrapolatedPointsLayer`, `useEarthFixed`, and GIS helpers `geodeticToScene`, `eciToScene`, `subsolarPoint`, `EARTH_RADIUS_KM`.

### Wildfires has no typed wrapper yet

`@earthos/plugin-wildfires` ships in the EarthOS repo and runs in the demo app, but it has no `LayerWildfires` wrapper and is not a dependency of `earthos`. Add it to your own dependencies and mount it through the generic `Layer` escape hatch:

```bash
pnpm add @earthos/plugin-wildfires
```

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer manifest={() => import('@earthos/plugin-wildfires')} />
</Earth>;
```

Every other third-party or unwrapped plugin composes the same way: `manifest` takes the lazy import, `enabled` toggles it, `settings` patches its schema-validated settings.

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for how the engine, providers, and renderers fit together, and [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) to build your own layer.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
