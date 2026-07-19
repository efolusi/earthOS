# Performance Guide

Target: 60 FPS on desktop, 30+ on mobile, 100k+ moving objects. These are the rules and budgets that keep it true. PRs that violate the non-negotiables get reworked, not merged.

## Non-negotiables

1. **Nothing allocates per frame in hot paths.** Preallocate typed arrays; reuse scratch vectors; no per-frame closures. Worker buffers move by transfer, not copy.
2. **Nothing per-frame goes through React or zustand.** Positions flow worker -> typed array -> BufferAttribute. Sim time is pulled (`engine.time.now()`), never ticked into state.
3. **Worker messages are batched and request/response or seq-numbered.** Never per-object, never per-frame. Time protocol is change-only: workers dead-reckon the sim clock.
4. **Many entities = the shared points pipeline.** Per-entity meshes or React elements at entity scale is the canonical trap.

## Frame budget (main thread, 16.6 ms at 60 FPS)

| Slice                                         | Budget             |
| --------------------------------------------- | ------------------ |
| controls + clock + astronomy + uniform writes | 0.5 ms             |
| worker batch adoption (amortized)             | 0.4 ms             |
| picking / UI sync (throttled, amortized)      | 0.6 ms             |
| three scene-graph update                      | 0.5 ms             |
| draw-call encode (target < 50 calls)          | 1.0 ms             |
| React/zustand steady-state                    | ~0                 |
| **total / headroom**                          | **~3 ms / ~13 ms** |

Draw-call inventory in the flagship app: globe 1, clouds 1, atmosphere 1, stars 1, moon 1, sun sprite 1, points layers 1 each, orbit/terminator lines 1 each, HUD is DOM. Keep it that way.

## Provider costs

- Refresh cadences are wall-clock with jitter; fleets must not stampede an API (per-origin token buckets are on by default).
- Cache windows (`staleAfterMs` / `maxAgeMs`) let stale data render instantly on boot while revalidation happens in the background. TLEs stay useful for days: exploit that.
- Failures keep last-good data on screen. Never blank a layer because a poll failed.

## Texture memory

The base committed textures are 2k (~1.4 MB total): fine everywhere. An optional 8k set (~19 MB, `public/textures/full/`) is also committed and swapped in on desktop after first paint, with a hard mobile cap (~25 MB GPU memory). The upgrade path is KTX2/basis. Never ship 8k JPEGs to phones.

## Measuring

- The status bar FPS meter is rAF-based and cheap; keep it visible while developing.
- `renderer.info` (calls, triangles, textures) via the dev console: `window.__earthos` exposes the engine in the flagship app (dev builds always; append `?dev` to the URL in production).
- Playwright smoke tests run with software GL: treat their FPS as a floor, not a target.
- For regressions, bisect with layers toggled individually; each plugin must stand alone within budget.

## Known future work

Promoted tiers (icons at >8 px, 3D models at >32 px, labels) with hard caps and hysteresis; GeoGrid-driven cluster badges at far zoom; `SharedArrayBuffer` time sync behind COOP/COEP. Each has a slot in the architecture and a line in the ROADMAP.
