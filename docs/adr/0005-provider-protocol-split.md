# ADR 0005: Provider protocol in core, policies in providers

**Status:** accepted

## Decision

`@earthos/core` defines only the minimal provider lifecycle (`start(io, emit)` / `stop` / `refresh` and the snapshot shape). `@earthos/providers` implements the policy engines (stale-while-revalidate, retries, rate limits, IndexedDB persistence) as base classes on top.

## Context

The engine must manage subscription plumbing and teardown without depending on caching strategy, and the dependency graph must stay acyclic (`providers -> core`). Splitting protocol from policy keeps the core contract stable while policies evolve freely, and lets tests inject trivial providers (`FixtureProvider`) without timers or fetch.

## Consequences

Plugins depend on `@earthos/providers` for the ergonomic base classes but the engine never does. Exotic sources (P2P, file drops) can implement the core protocol directly. The engine-level cache is injectable (`createDefaultCache()` layers memory over IndexedDB in browsers; tests and SSR get memory only).
