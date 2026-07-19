# @earthos/plugin-hurricanes

Active tropical cyclones for EarthOS, sourced live from the NOAA National Hurricane Center.

Plots every currently active storm from the NHC `CurrentStorms.json` feed as an intensity-scaled point on the globe, colored by strength in a distinct violet ramp (hurricane, storm, depression) so a cyclone never reads as an earthquake. Each storm is a searchable, selectable entity: name search in the command palette, and an inspector card with classification, max sustained winds, movement, and position.

## Install

```sh
pnpm add @earthos/plugin-hurricanes
```

Peer dependencies (single-instance, provided by the host app): `@earthos/globe`, `react` 19, `three`, and `@react-three/fiber` 9.

## Usage

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer manifest={() => import('@earthos/plugin-hurricanes')} />
</Earth>;
```

## How it works

- `provider.ts` (`NhcStormsProvider`, id `nhc-storms`) polls the NHC `CurrentStorms.json` feed every 15 minutes (with jitter, paused when hidden; 45 min stale window, 6 h max age) and parses the `activeStorms` array into `Storm` records, dropping any entry without finite coordinates.
- `renderer.tsx` writes storm positions into an `ExtrapolatedPointsLayer` (from `@earthos/globe`, `mu: 0` since storms are static ground positions), sizes each point by intensity, and registers an entity source plus a tracker so storms are searchable and follow-camera targets.
- Palette bucket is chosen from `classification` and `intensityKt`: hurricane (`HU` or >= 64 kt), tropical storm (>= 34 kt), or depression.

## Settings

| Key        | Default | Notes                                                               |
| ---------- | ------- | ------------------------------------------------------------------- |
| `endpoint` | (blank) | Proxy override for `CurrentStorms.json`; blank fetches NHC directly |

## Data source

[NOAA National Hurricane Center](https://www.nhc.noaa.gov) `CurrentStorms.json`, public domain. Only storms the NHC currently lists as active appear; the map is empty out of season.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the plugin contract and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for how providers, renderers, and layers fit together.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
