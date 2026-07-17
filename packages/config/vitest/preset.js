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
      ...testOverrides,
    },
  };
}
