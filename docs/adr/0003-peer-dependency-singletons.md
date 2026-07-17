# ADR 0003: three/react/R3F as peerDependencies everywhere

**Status:** accepted

## Decision

`react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `maplibre-gl` are peerDependencies in every publishable package; only apps and examples declare them as dependencies. Enforced by `scripts/check-peers.mjs` in CI.

## Context

Duplicate Three instances break `instanceof` checks and material/program caches; duplicate React breaks hooks and context (R3F's Canvas context is the first casualty). These failures are silent and miserable to debug: prevention beats detection.

## Consequences

Plugin authors follow the scaffolded package.json shape. Apps install the singletons once. `pnpm dedupe --check` in CI catches accidental duplication through transitive ranges.
