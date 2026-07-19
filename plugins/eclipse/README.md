# @earthos/plugin-eclipse

Solar eclipse layer for EarthOS: the umbra disc and penumbra outline of a solar eclipse, placed on the simulation clock from astronomy-engine ephemerides.

Every few sim-seconds the plugin finds where the sun-moon shadow axis pierces the Earth, sizes the umbra and penumbra cones at that ground point, and draws them on the globe as a filled dark disc plus a ring outline. All geometry comes from sub-arcminute ephemerides in EarthOS's equator-of-date (TEME/GMST) frame, so the shadow tracks correctly as you scrub time (for example, the 2026-08-12 total eclipse crossing Iceland toward Spain).

## Install

```sh
pnpm add @earthos/plugin-eclipse
```

Single-instance peer dependencies, provided by the host app: `@earthos/globe`, `@react-three/fiber` (v9), `react` (v19), and `three` (>=0.170).

## Usage

```tsx
import { Earth, Layer } from 'earthos';

<Earth>
  <Layer manifest={() => import('@earthos/plugin-eclipse')} settings={{ showPenumbra: true }} />
</Earth>;
```

## Settings

| Key            | Default | Notes                          |
| -------------- | ------- | ------------------------------ |
| `showPenumbra` | `true`  | draw the penumbra outline ring |

## Headless shadow

The core computation is exported for non-visual use:

```ts
import { shadowAt, type ShadowState } from '@earthos/plugin-eclipse';

const s = shadowAt(Date.UTC(2026, 7, 12, 17, 45)); // ms epoch
// { hit, latDeg, lonDeg, umbraKm, penumbraKm }
```

`shadowAt(epochMs)` returns whether the shadow axis hits the Earth, the geodetic ground point, and the umbra/penumbra radii in kilometers (a negative `umbraKm` means the eclipse is annular).

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the layer contract and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the frame conventions.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
