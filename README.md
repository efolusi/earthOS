# EarthOS

**A real-time interactive 3D digital twin of Earth, in your browser.**

<p>
  <a href="https://earthos.efolusi.com"><b>Live app: earthos.efolusi.com</b></a> ·
  <a href="https://github.com/efolusi/earthOS/actions/workflows/ci.yml"><img src="https://github.com/efolusi/earthOS/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT" /></a>
  <a href="https://www.npmjs.com/package/earthos"><img src="https://img.shields.io/badge/npm-earthos-CB3837.svg" alt="npm" /></a>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome" />
</p>

EarthOS is not another globe viewer. It is a platform for visualizing real-world datasets on top of a realistic Earth in real time: satellites propagated with SGP4, aircraft, ships, weather, earthquakes, day/night, and anything else you can express as a plugin.

Think Google Earth + NASA Eyes + FlightRadar24 + MarineTraffic + Windy, as one modular, extensible, open-source codebase.

## Highlights

- **Realistic globe**: day/night shader with soft terminator, Black Marble night lights, clouds, atmospheric scattering rim, stars, true sun and moon positions.
- **100,000+ moving objects at 60 FPS**: SGP4 propagation in a worker pool, transferable position/velocity buffers, GPU extrapolation in the vertex shader, one draw call per layer.
- **Everything is a plugin**: each data source is an independently installable npm package with a small, stable contract (`plugin.ts`, `provider.ts`, `renderer.ts`, `settings.ts`, `types.ts`).
- **Time travel**: a central simulation clock drives propagation, sun position, and every layer. Scrub past and future; orbits sweep smoothly.
- **SDK**: `npm install earthos` and compose your own Earth:

```tsx
import { Earth, LayerSatellites, LayerEarthquakes } from 'earthos';

export default function App() {
  return (
    <Earth initialCamera={{ lat: 9.05, lon: 7.49, altKm: 12000 }}>
      <LayerSatellites group="starlink" />
      <LayerEarthquakes minMagnitude={4.5} />
    </Earth>
  );
}
```

## Repository layout

```
apps/web          Flagship Next.js viewer app
packages/core     Plugin runtime, engine, time, workers, stores
packages/globe    Three.js / R3F globe renderer and points pipeline
packages/ui       Panels, timeline, command palette, settings forms
packages/providers Data provider framework (caching, polling, rate limits)
packages/gis      Geodesy, orbital transforms, spatial index
packages/testing  Plugin contract test harness
packages/config   Shared eslint / tsconfig / tsup / vitest presets
plugins/*         One directory per data source
sdk/earthos       The `earthos` npm package
sdk/create-earthos-plugin  Plugin scaffolder
docs/             Architecture, plugin guide, rendering, performance
examples/         Minimal Next.js, Vite SPA, custom plugin
```

## Getting started

Requirements: Node >= 20, pnpm >= 10.

```bash
pnpm install
pnpm build        # build all packages
pnpm dev          # start the web app (apps/web) and package watchers
pnpm test         # unit tests across the workspace
pnpm e2e          # Playwright smoke tests
```

Open http://localhost:3000, toggle the Satellites layer, and watch the constellation move.

## Writing a plugin

```bash
pnpm create earthos-plugin my-layer
```

A plugin is four small modules composed by `definePlugin`:

```ts
import { definePlugin } from '@earthos/core';
import { settings } from './settings';

export default definePlugin({
  id: 'my-layer',
  apiVersion: 1,
  meta: { name: 'My Layer', category: 'custom', attribution: 'Me' },
  settings,
  provider: () => import('./provider'), // data fetching + caching policy
  renderer: () => import('./renderer'), // R3F component inside the host canvas
});
```

Disabled plugins cost zero bytes: `provider` and `renderer` are dynamic-import split points loaded only when the layer is enabled. See [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md).

## Layers shipped today

| Layer             | Source                | Notes                                                             |
| ----------------- | --------------------- | ----------------------------------------------------------------- |
| Satellite imagery | Esri / EOX Sentinel-2 | streamed web-mercator quadtree, zoom for detail                   |
| Satellites        | CelesTrak / TLE API   | 10k+ objects, SGP4 in workers, orbit lines, follow camera         |
| Aircraft          | OpenSky Network       | live ADS-B, heading arrows, dead-reckoned between polls           |
| Hurricanes        | NOAA NHC              | active cyclones, intensity-scaled                                 |
| Solar eclipse     | astronomy-engine      | umbra/penumbra on the simulation clock (try 2026-08-12 17:45 UTC) |
| Earthquakes       | USGS                  | magnitude-scaled, depth-colored                                   |
| Day / night       | computed              | terminator, subsolar and sublunar markers                         |
| Custom GeoJSON    | your data             | points, lines, polygon outlines                                   |

Shareable permalinks encode camera, time, layers, and selection; `?embed` serves a chrome-free iframe with a postMessage API. See [ROADMAP.md](ROADMAP.md) for what's next (ships, wind, aurora, terrain, analytics).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Plugin contributions are the primary extension surface; the roadmap lists data sources waiting for an owner.

## License

[MIT](LICENSE). Earth textures are NASA imagery (public domain); data feeds carry their providers' terms (CelesTrak, USGS, and others are attributed per plugin).
