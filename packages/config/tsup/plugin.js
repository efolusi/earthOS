/**
 * tsup preset for @earthos/plugin-* packages.
 *
 * Emits the mandated module split: the manifest (plugin.ts) stays tiny while
 * provider/renderer are separate entries that the host lazy-imports. Worker
 * files must be passed via `overrides.entry` additions and stay separate
 * chunks so `new URL('./x.worker.js', import.meta.url)` survives bundling.
 */
export function pluginPreset(overrides = {}) {
  const { entry = {}, ...rest } = overrides;
  // Merge extra entries over the defaults; a falsy value removes a default
  // (e.g. `{ provider: false }` for computed plugins without a provider).
  const mergedEntry = {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    provider: 'src/provider.ts',
    renderer: 'src/renderer.tsx', // renderers are React; override for .ts
    settings: 'src/settings.ts',
    ...entry,
  };
  for (const key of Object.keys(mergedEntry)) {
    if (!mergedEntry[key]) delete mergedEntry[key];
  }
  return {
    entry: mergedEntry,
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    splitting: true,
    treeshake: true,
    ...rest,
  };
}
