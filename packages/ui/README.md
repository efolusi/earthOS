# @earthos/ui

The EarthOS control surfaces: layer panel with schema-driven settings forms, timeline, inspector, command palette, and status bar. Styled with the Meridian design system (Efolusi) through CSS custom properties, laid out with Tailwind utility classes.

## Install

```bash
pnpm add @earthos/ui framer-motion
```

`@earthos/core` comes in as a dependency. Peer dependencies, each of which must be deduped to a single instance: `react` (^19) and `framer-motion` (^11 || ^12). `framer-motion` is not optional: `GlassPanel`, `LayerPanel`, and `CommandPalette` import it directly, so a missing peer breaks rendering rather than degrading it.

## Usage

Mount the panels as siblings of the globe, inside the same engine provider. `<Earth/>`
from the `earthos` SDK supplies that provider, so the panels only need to sit under it:

```tsx
import { Earth, LayerSatellites } from 'earthos';
import { LayerPanel, Timeline, Inspector, StatusBar } from '@earthos/ui';

const plugins = [satellitesPlugin]; // the manifests you registered

export default function App() {
  return (
    <Earth>
      <LayerSatellites group="starlink" />
      <LayerPanel plugins={plugins} />
      <Inspector />
      <StatusBar />
      <Timeline />
    </Earth>
  );
}
```

Every panel is a plain DOM overlay, not a 3D object, so position them with your own
layout: the components bring their own surface styling but no placement.

## Styling requirements

Components reference two things the consuming app provides:

1. **Tailwind content scanning.** The classes live in this package's `src` (shipped in the tarball). In your Tailwind v4 CSS entry:

```css
@import 'tailwindcss';
@source '../node_modules/@earthos/ui/src';
```

2. **Meridian tokens.** Components read semantic custom properties (`--surface-card`, `--text-primary`, `--border-default`, `--accent-subtle`, `--radius-lg`, `--font-mono`, and friends). Install [`@efolusi/meridian`](https://www.npmjs.com/package/@efolusi/meridian) (MIT) and import its token sheets, or map the variables to your own system. Unset variables fall back to browser defaults, which will look broken; the tokens are not optional.

```css
@import '@efolusi/meridian/styles.css';
```

Requires `@efolusi/meridian` >= 1.5.1. Earlier versions ship a `styles.css` whose inner imports use bare specifiers, which bundlers fail to resolve; on those, import the six sheets under `@efolusi/meridian/tokens/` individually.

The flagship app (`apps/web`) is the reference wiring. The 3D packages (`@earthos/globe`, plugins) have no styling requirements at all.

## Components

| Export                               | Purpose                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| `LayerPanel`                         | plugin catalog: toggles, status dots, expandable settings |
| `SettingsForm`                       | auto-rendered from any plugin's `defineSettings` schema   |
| `Timeline`                           | play/pause, rate stepping, hour jumps, live re-sync       |
| `Inspector`                          | selected-entity details with fly-to and follow            |
| `HoverCard`                          | cursor-following label for the hovered entity             |
| `CommandPalette`                     | Cmd/Ctrl+K search across all layer entity sources         |
| `StatusBar`                          | camera readout, FPS meter, attribution                    |
| `GlassPanel`, `IconButton`, `Toggle` | the underlying Meridian surfaces                          |

`LayerPanel`, `Timeline`, `Inspector`, `HoverCard`, `CommandPalette`, and `StatusBar` read the engine through `useEarth` / `useEarthState` / `useSimTime`, so they require an `EarthEngineProvider` (or `<Earth/>`) above them. `SettingsForm` and the `GlassPanel` / `IconButton` / `Toggle` surfaces have no engine dependency: they are prop-driven and render anywhere, `SettingsForm` taking a `schema` and a plugin `api` directly.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the `defineSettings` schemas `SettingsForm` renders and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for how the engine, globe, and UI fit together.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
