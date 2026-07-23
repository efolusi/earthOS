/**
 * Vitest preset shared by packages and plugins.
 *
 *   import { defineConfig } from 'vitest/config';
 *   import { vitestPreset } from '@earthos/config/vitest';
 *   export default defineConfig(vitestPreset({ environment: 'jsdom' }));
 */
export function vitestPreset(testOverrides = {}) {
  return {
    test: {
      environment: 'node',
      include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
      passWithNoTests: false,
      // The plugin contract suite dynamically imports each plugin's renderer,
      // which pulls three and @react-three/fiber through the transform pipeline.
      // That costs seconds on its own and exceeds vitest's 5s default once the
      // workspace runs several plugins at once, so a different plugin failed on
      // each run. Give the transform real headroom instead of racing it.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      ...testOverrides,
    },
  };
}
