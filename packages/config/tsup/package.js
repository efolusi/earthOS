/**
 * tsup preset for @earthos/* framework packages.
 * Plain object (no tsup import) so this package has zero build-tool deps.
 *
 *   import { defineConfig } from 'tsup';
 *   import { packagePreset } from '@earthos/config/tsup-package';
 *   export default defineConfig(packagePreset());
 */
export function packagePreset(overrides = {}) {
  return {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    splitting: true,
    treeshake: true,
    ...overrides,
  };
}
