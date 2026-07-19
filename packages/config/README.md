# @earthos/config

Shared build, lint, and test presets for EarthOS packages and plugins.

The single source of truth for tooling across the monorepo: a flat ESLint config, a set of layered `tsconfig`s, Prettier options, `tsup` build presets (one for framework packages, one for plugins), and a Vitest preset. Every other `@earthos/*` package and plugin extends these, so a rule or compiler flag changes in one place. The presets are plain JS/JSON with no build-tool dependency of their own; only ESLint is a peer.

## Install

```sh
pnpm add -D @earthos/config eslint
```

`eslint` (^9) is a peer dependency. Everything else the presets need is bundled.

## Usage

ESLint (`eslint.config.js`):

```js
import earthos from '@earthos/config/eslint';

export default earthos;
```

TypeScript (`tsconfig.json`), extend the layer that fits the package (`base`, `react-library`, `nextjs`, or `plugin`):

```json
{
  "extends": "@earthos/config/tsconfig/react-library.json",
  "include": ["src", "tests"]
}
```

Build (`tsup.config.ts`), `packagePreset` for framework packages, `pluginPreset` for `@earthos/plugin-*`, both accept overrides:

```ts
import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(packagePreset({ external: ['react', 'three'] }));
```

Tests (`vitest.config.ts`):

```ts
import { defineConfig } from 'vitest/config';
import { vitestPreset } from '@earthos/config/vitest';

export default defineConfig(vitestPreset({ environment: 'jsdom' }));
```

Prettier is exposed at `@earthos/config/prettier` (JSON) for the `prettier` key or a `.prettierrc` reference.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for how the plugin build split (`pluginPreset`) maps to the manifest/provider/renderer module layout, and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the monorepo layout.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
