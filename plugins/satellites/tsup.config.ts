import { defineConfig } from 'tsup';
import { pluginPreset } from '@earthos/config/tsup-plugin';

export default defineConfig(
  pluginPreset({
    entry: { 'propagate.worker': 'src/propagate.worker.ts' },
    external: [
      'react',
      'three',
      '@react-three/fiber',
      '@earthos/core',
      '@earthos/gis',
      '@earthos/globe',
      '@earthos/providers',
    ],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
