import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

// React entry: builds second (needs dist/index.d.ts from the index build).
export default defineConfig(
  packagePreset({
    entry: ['src/react.tsx'],
    external: ['react', 'zustand', '@earthos/core'],
    clean: false,
    // esbuild drops "use client" from sources; restore the RSC boundary.
    // (rollup treeshake would strip the banner again, so keep it off here)
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
