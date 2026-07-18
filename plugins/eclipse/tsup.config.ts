import { defineConfig } from 'tsup';
import { pluginPreset } from '@earthos/config/tsup-plugin';

export default defineConfig(
  pluginPreset({
    entry: { provider: false, settings: false },
    external: [
      'react',
      'three',
      '@react-three/fiber',
      '@earthos/core',
      '@earthos/gis',
      '@earthos/globe',
      'astronomy-engine',
    ],
    banner: { js: '"use client";' },
    treeshake: false,
  }),
);
