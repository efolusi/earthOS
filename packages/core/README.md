# @earthos/core

The EarthOS plugin runtime: the `EarthEngine`, the plugin contract, the simulation clock, workers, and the UI store. Renderer-agnostic (no three, no DOM); `@earthos/globe` mounts the visuals on top.

One `EarthEngine` exists per `<Earth/>` instance. It registers plugins, drives their lifecycle (register, activate, deactivate, dispose), owns a `TimeEngine`, an `EventBus`, per-plugin `WorkerPool`s, a namespaced cache, and a zustand store of UI state. Plugins are authored against this contract with `definePlugin` and the `defineSettings` DSL; disabled plugins dynamic-import their provider/renderer, so they cost zero bytes until enabled.

## Install

```sh
pnpm add @earthos/core
```

The root entry has no peer dependencies. The `@earthos/core/react` subpath needs `react` (18 or 19) as a single-instance peer.

## Usage

Host side: create an engine, provide it, bind a plugin declaratively.

```tsx
import { createEarthEngine } from '@earthos/core';
import { EarthEngineProvider, useLayer } from '@earthos/core/react';

const engine = createEarthEngine({ persistKey: 'earthos:v1' });

function Satellites() {
  const { status, enable, disable } = useLayer(() => import('@earthos/plugin-satellites'));
  return <button onClick={status === 'active' ? disable : enable}>{status}</button>;
}

export const App = () => (
  <EarthEngineProvider engine={engine}>
    <Satellites />
  </EarthEngineProvider>
);
```

Plugin side: compose the mandated file shape.

```ts
import { definePlugin, defineSettings, f, PLUGIN_API_VERSION } from '@earthos/core';

export default definePlugin({
  id: 'my.layer',
  apiVersion: PLUGIN_API_VERSION,
  meta: { name: 'My Layer', category: 'custom', color: '#CE9C66' },
  settings: defineSettings({
    version: 1,
    fields: {
      refreshSeconds: f.number({ label: 'Refresh', default: 30, min: 5, unit: 's' }),
      color: f.color({ label: 'Color', default: '#CE9C66' }),
    },
  }),
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
```

Other exports: `TimeEngine`, `EventBus`, `WorkerPool` (with `exposeWorker`/`transferResult`), `MemoryCache`, `createEarthStore`, and the settings helpers (`validateSettingsPatch`, `hydrateSettings`). The React entry also ships `useEarth`, `useEarthState`, `useSimTime`, and `useLayerRenderers`.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the authoring contract and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for how the engine, globe, and UI fit together.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
