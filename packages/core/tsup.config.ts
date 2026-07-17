import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(
  packagePreset({
    entry: ['src/index.ts', 'src/react.tsx'],
    external: ['react'],
  }),
);
