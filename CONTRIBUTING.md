# Contributing to EarthOS

Thanks for your interest in EarthOS. This document covers workflow, conventions, and the fastest paths to a merged PR.

## Development setup

Requirements: Node >= 20, pnpm >= 10.

```bash
git clone https://github.com/efolusi/earthOS
cd earthOS
pnpm install
pnpm build
pnpm dev
```

The dev server runs at http://localhost:3000.

## Project structure

- `packages/*` are the framework: core runtime, globe renderer, provider framework, UI kit, GIS utilities.
- `plugins/*` are data layers. Each is an independently publishable npm package.
- `sdk/earthos` is the public SDK surface.
- `apps/web` is the flagship viewer.

Dependency rules (enforced in CI):

1. No cycles. The DAG is `gis -> (nothing)`, `core -> (nothing)`, `providers -> core`, `globe -> core, gis`, `ui -> core`, `plugins -> core, providers, gis, globe (peer)`.
2. `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `maplibre-gl` are peerDependencies everywhere except apps and examples (`pnpm check-peers`).

## The fastest contribution: a plugin

Run `pnpm create earthos-plugin <name>` and follow [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md). Every plugin must:

- Follow the mandated file shape: `plugin.ts`, `index.ts`, `renderer.tsx`, `tests/`, `README.md`, plus `settings.ts` when the layer is configurable and `provider.ts` / `types.ts` when it fetches data. Purely computed layers skip them: `daynight` ships without `provider.ts` and `types.ts`, `eclipse` without those and `settings.ts`.
- Pass `runPluginContractTests` from `@earthos/testing`.
- Keep `plugin.ts` free of heavy imports (no `three`, no provider code). Lazy-import via `definePlugin`.
- Include attribution and terms for its data source in its README.
- Never require an API key in client code. Keyed sources go through a proxy endpoint setting.

## Pull requests

- One logical change per PR. Bug fix PRs do not include refactors.
- `pnpm turbo lint typecheck test build` and `pnpm format` must pass.
- New behavior needs tests. Rendering-only changes need a screenshot or recording in the PR description.
- Add a changeset (`pnpm changeset`) for anything user-facing in a published package.

## Performance rules (non-negotiable)

These keep 100k objects at 60 FPS. PRs violating them will be asked to rework:

1. Nothing allocates per frame in hot paths. Preallocate; reuse scratch objects.
2. Nothing per-frame goes through zustand or React state. Refs and `useFrame` mutation only.
3. Worker messages are batched and seq-numbered; never per-object, never per-frame.
4. New layers with many entities use the shared points pipeline (`ExtrapolatedPoints`), not per-entity meshes or React elements.

## Commit style

Conventional commits (`feat:`, `fix:`, `docs:`, `perf:`, `refactor:`, `test:`, `chore:`), scoped when useful: `feat(satellites): two-tier propagation cadence`.

## Release process

Changesets on merge to `main` open a version PR; merging it publishes to npm from CI. Framework packages version together; plugins version independently.

## Code of conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
