---
'@earthos/providers': minor
'@earthos/plugin-satellites': patch
---

Add `DataProvider#emitPartial` so a slow paginated fetch can publish what it already has.

The satellite catalog falls back to a page-at-a-time API when CelesTrak blocks the
client, and that fallback needs 80 requests (the API caps pages at 100 items and
answers wide parallelism with 508s). Until now nothing reached the globe until the
last page landed, so the layer showed an empty sky for the better part of a minute
and looked broken.

Partial results are not cached and do not become last-good: only the value `fetch`
finally resolves with is durable, so an aborted fetch never leaves a truncated
catalog behind as the cached truth.

The satellites provider publishes once, after the first page. Emitting on every
batch was measured to be worse than the problem: each emit hands the renderer a new
record set, which re-shards the SGP4 worker pool, and fifteen respawns during a cold
load left the UI unable to settle.
