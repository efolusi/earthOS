import { defineConfig } from 'tsup';
import { pluginPreset } from '@earthos/config/tsup-plugin';

export default defineConfig(
  pluginPreset({
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
