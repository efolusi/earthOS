import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Keep the plugin packages out of prebundling so their `new Worker(new
    // URL(...))` split points stay statically analyzable.
    exclude: ['@earthos/plugin-satellites', '@earthos/plugin-earthquakes'],
  },
});
