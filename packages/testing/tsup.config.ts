import { defineConfig } from 'tsup';
import { packagePreset } from '@earthos/config/tsup-package';

export default defineConfig(
  packagePreset({ external: ['@earthos/core', '@earthos/providers', 'vitest'] }),
);
