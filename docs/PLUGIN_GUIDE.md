# Writing an EarthOS Plugin

A plugin is a data layer: provider (where data comes from), renderer (how it draws), settings (what users tune), wired by a tiny manifest. Scaffold one:

```bash
pnpm create earthos-plugin my-layer
cd earthos-plugin-my-layer && pnpm install && pnpm test
```

The contract test suite passes offline before you write a line: keep it green.

## The five files

### plugin.ts (the manifest, statically imported, must stay cheap)

```ts
import { definePlugin } from '@earthos/core';
import settings from './settings';

export default definePlugin({
  id: 'my-layer',
  apiVersion: 1,
  meta: { name: 'My Layer', category: 'custom', attribution: 'My Source' },
  settings,
  provider: () => import('./provider'),
  renderer: () => import('./renderer'),
});
```

Never import `three`, your provider, or heavy libraries here. This file loads eagerly so apps can show your layer in their catalog; everything else loads when the user enables the layer.

### settings.ts

```ts
import { defineSettings, f } from '@earthos/core';

export default defineSettings({
  version: 1,
  fields: {
    refreshSeconds: f.number({ label: 'Refresh', min: 10, max: 600, default: 60, unit: 's' }),
    color: f.color({ label: 'Color', default: '#34d399' }),
    endpoint: f.text({ label: 'Endpoint override', default: '' }),
  },
});
```

Seven field kinds (`text`, `secret`, `number`, `boolean`, `range`, `select`, `color`). The UI renders automatically; values are validated and persisted by core. Bump `version` and supply `migrate` when you rename fields.

### provider.ts

Default-export a factory `(ctx) => ProviderInstance`. Extend one of the bases from `@earthos/providers`:

| Base             | For                 | You implement                    |
| ---------------- | ------------------- | -------------------------------- |
| `DataProvider`   | polling APIs        | `fetch(io)` (+ optional `merge`) |
| `StreamProvider` | WebSocket/SSE       | `connect(io)`                    |
| `TileProvider`   | raster tile sources | `describe(settings)`             |
| `StaticProvider` | fetch-once datasets | `fetch(io)`                      |

Set `policyOverrides` honestly: refresh cadence with jitter, `staleAfterMs`/`maxAgeMs` cache windows, retries, and a rate limit that respects the upstream's terms. `io.fetch` throws typed errors on bad status and honors your policy. Never require an API key client-side: accept an `endpoint` override so deployments proxy keyed sources.

### renderer.ts / renderer.tsx

Default-export `{ Component }`. Your component mounts INSIDE the host's Canvas with your `PluginContext` as a prop. Rules that keep 60 FPS:

1. Many entities (hundreds+): use `ExtrapolatedPointsLayer` from `@earthos/globe`. One draw call, GPU extrapolation, batch updates.
2. Ground-pinned content: portal into the rotating frame with `useEarthFixed()` + `createPortal`, author positions with `geodeticToScene(lat, lon, altKm)`.
3. Per-frame values pull from `ctx.time.now()` inside `useFrame`; never `setState` per frame.
4. Subscribe to your provider handle for data; rebuild typed arrays on change, not per frame.
5. Register an entity source (`ctx.entities.registerSource`) so search and the inspector see your entities.
6. Everything you create, dispose in the effect cleanup.

### types.ts

Your public entity types, re-exported from `index.ts`.

## Workers

Heavy per-entity math (orbit propagation, decoding) belongs in workers:

```ts
const handle = ctx.workers.spawn(
  () => new Worker(new URL('./compute.worker.js', import.meta.url), { type: 'module' }),
);
const result = await handle.request('init', { records });
```

Note the `.js` extension (the built name) and the literal `new URL(..., import.meta.url)`: webpack, Turbopack, and Vite all rewrite that exact pattern. On the worker side use `exposeWorker({ init, compute })` from `@earthos/core`; return large buffers with `transferResult(value, [buffer])` so they transfer instead of copy. Workers are terminated automatically on deactivate.

## Publishing

- `package.json`: `"sideEffects": false`, subpath exports for `./provider` and `./renderer`, `three`/`react`/`@react-three/fiber`/`@earthos/globe` as peerDependencies, keyword `earthos-plugin`.
- README with attribution and the data source's terms.
- Contract tests green: `runPluginContractTests(() => import('../src/plugin'))`.

Consumers then need no wrapper:

```tsx
<Earth>
  <Layer manifest={() => import('earthos-plugin-my-layer')} settings={{ color: '#fff' }} />
</Earth>
```
