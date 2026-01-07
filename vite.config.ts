import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/web',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  test: {
    globals: true,
    root: resolve(__dirname),
    include: ['tests/**/*.test.ts'],
  },
});
