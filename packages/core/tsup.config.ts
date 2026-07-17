import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

// Index entry only. The react entry builds AFTER this one (see the build
// script): its self-referencing `@earthos/core` type imports need
// dist/index.d.ts to exist, so the two dts builds must not race.
export default defineConfig(
  packagePreset({
    entry: ['src/index.ts'],
    external: ['react'],
  }),
);
