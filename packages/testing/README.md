# @earthos/testing

Test harness for EarthOS plugin authors: a real engine wired for tests, a fixture provider, and the plugin contract suite.

Plugins are tested against a real `EarthEngine` rather than a mock, so there is no mock drift from the production lifecycle. `createTestHarness` spins up an engine with no persistence, silent logs, and a deterministic clock you control; `FixtureProvider` feeds renderers fixed data with no network or timers; `runPluginContractTests` is the conformance suite every plugin runs in its own `tests/` (and that framework CI runs against all official plugins).

## Install

```bash
pnpm add -D @earthos/testing
```

Requires `vitest` (>= 2.0.0) as a peer dependency; the contract suite emits `describe`/`it` blocks into your Vitest run.

## Usage

Run the contract suite at the top level of a test file. It loads your plugin lazily, then checks the plugin shape, `register()`, offline activation/deactivation, disposal, and settings defaults:

```ts
import { runPluginContractTests } from '@earthos/testing';

runPluginContractTests(() => import('../src/plugin'));
```

Drive the engine directly with the harness when you need finer control:

```ts
import { createTestHarness, FixtureProvider } from '@earthos/testing';

const harness = createTestHarness(); // clock starts at 2026-01-01 UTC
const ctx = await harness.register(myPlugin);
await harness.activate(myPlugin.id);

harness.clock.advance(60_000); // step the deterministic clock forward 60s
await harness.destroy();
```

Also exported: `silentLogger` (a no-op `Logger`) and the `TestHarness` type.

See [docs/PLUGIN_GUIDE.md](../../docs/PLUGIN_GUIDE.md) for the plugin lifecycle the contract suite exercises, and [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) for the engine internals.

Part of [EarthOS](https://github.com/efolusi/earthOS). MIT licensed.
