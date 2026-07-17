import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(
  packagePreset({
    external: ['react', 'framer-motion', '@earthos/core'],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
