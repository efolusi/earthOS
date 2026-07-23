# @earthos/plugin-daynight

The day/night terminator and subsolar/sublunar markers, computed entirely client-side from compact solar and lunar ephemerides in `@earthos/gis`. No network, no provider: this plugin is the minimal reference for the EarthOS plugin shape (manifest + renderer + settings).

The terminator follows the simulation clock: scrub the timeline and watch the night side sweep.

## Install

```sh
pnpm add @earthos/plugin-daynight
```

Single-instance peer dependencies, provided by the host app: `@earthos/globe`, `@react-three/fiber` (v9), `react` (v19), and `three` (>=0.170).

## Usage

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer
    manifest={() => import('@earthos/plugin-daynight')}
    settings={{ showTerminator: true, showSubsolar: true }}
  />
</Earth>;
```

## Settings

| Key              | Default   |
| ---------------- | --------- |
| `showTerminator` | `true`    |
| `showSubsolar`   | `true`    |
| `showSublunar`   | `false`   |
| `lineColor`      | `#C08A5A` |

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the layer contract.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
