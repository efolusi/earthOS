# create-earthos-plugin

Scaffold a new EarthOS data layer plugin with one command.

`create-earthos-plugin` generates a ready-to-build plugin package: a polling `DataProvider`, a GPU points renderer wired to `@earthos/globe`'s `ExtrapolatedPointsLayer`, a schema-driven settings form (`defineSettings`), a `definePlugin` manifest, and an offline contract test. The output matches the layout every first-party EarthOS plugin uses, so it builds with `tsup` and passes the contract suite out of the box.

## Usage

```bash
pnpm create earthos-plugin <kebab-case-name>
# or
npm create earthos-plugin@latest <kebab-case-name>
```

The single argument is the plugin id: lowercase, starting with a letter, `[a-z0-9-]` only (for example `aurora-oval`). There are no flags. The CLI creates `earthos-plugin-<name>/` in the current directory and refuses to overwrite an existing one.

Then:

```bash
cd earthos-plugin-<name>
pnpm install
pnpm test     # contract suite runs offline
pnpm build
```

## What it generates

- `src/plugin.ts`: the `definePlugin` manifest (id, `apiVersion`, meta, settings, lazy provider and renderer).
- `src/provider.ts`: a `DataProvider` subclass with refresh, cache, and retry policy overrides, and a `fetch` stub to replace with your source.
- `src/renderer.tsx`: an R3F layer feeding batches into `ExtrapolatedPointsLayer` (scales to many entities).
- `src/settings.ts`, `src/types.ts`, `src/index.ts`: settings schema, item type, and package entry.
- `tests/contract.test.ts`: `runPluginContractTests` from `@earthos/testing`, runs with no network.
- `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `README.md`.

The generated package keeps `react`, `three`, `@react-three/fiber`, and `@earthos/globe` as peer dependencies (single-instance), so it composes with any EarthOS app.

See the [plugin guide](../../docs/PLUGIN_GUIDE.md) for the authoring workflow and [architecture](../../docs/ARCHITECTURE.md) for how layers, providers, and renderers fit together.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
