# @earthos/globe

The React Three Fiber globe renderer for EarthOS: shader Earth, atmosphere, orbit camera, and the GPU point pipeline that draws 100k moving objects in one draw call.

This is the rendering layer beneath the EarthOS SDK. `EarthCanvas` assembles the R3F `<Canvas>`, the shader globe, the orbit camera, and the plugin layer host around one `EarthEngine`; plugins mount their own layers into it. Everything time-driven pulls from the engine inside `useFrame`, so React never rerenders per frame. Scene units are kilometers (1 unit = 1 km) with the origin at Earth's center.

## Install

```bash
pnpm add @earthos/globe
```

Peer dependencies, each of which must be deduped to a single instance: `react` (^19), `three` (>=0.170), `@react-three/fiber` (^9), and `@react-three/drei`.

## Usage

```tsx
import { EarthCanvas } from '@earthos/globe';

<EarthCanvas
  textures={{ day: '/earth-day.jpg', night: '/earth-night.jpg', clouds: '/clouds.png' }}
  stars
  moon
  idleCinematicAfterS={20}
/>;
```

`EarthCanvas` must render client-side only (the SDK wraps it in `next/dynamic` with SSR disabled). Pass your own `engine` prop to share an `EarthEngine`, or let it create one.

## What's inside

- `EarthCanvas`, `GlobeScene`, `GlobeCamera`: the assembled canvas, the shader globe scene (day/night/specular, clouds, atmosphere rim, stars, real sun and moon positions), and the floating-origin orbit camera with a min-altitude clamp, fly-to, entity follow, and a dynamic near plane.
- `ExtrapolatedPointsLayer`: the 100k-point pipeline. Feed it worker `BatchView` batches of interleaved position and velocity; the vertex shader Taylor-extrapolates `p0 + v0 * dt - 0.5 * mu * p0 / |p0|^3 * dt^2` per frame, so the per-frame cost is one uniform write and one draw call. Earth-horizon occlusion runs in the shader.
- `pickExtrapolated`, `pickToleranceRad`, `rayToLocal`: CPU picking that runs the exact same extrapolation the GPU draws, so hits match pixels.
- `EarthFixedGroup`, `useEarthFixed`: the GMST-rotating Earth-fixed frame. Portal ground-locked content in, authored in swizzled-ECEF local coordinates (see `geodeticToScene` in `@earthos/gis`).
- `trackersOf`, `registerTracker`, `localPointToWorld`: the follow-camera tracker registry that lets a moving layer answer "where is entity X right now" in world space.
- `createGlobeMaterial`, `createAtmosphereMaterial`, `loadTexture`, `useOptionalTexture`: the raw shader materials and non-suspending texture loading.

Most apps reach these through the SDK's `<Earth/>` rather than directly. See [docs/RENDERING.md](../../docs/RENDERING.md) and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the render pipeline, and [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for building layers on `ExtrapolatedPointsLayer`.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
