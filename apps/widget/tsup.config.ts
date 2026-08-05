import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife', 'esm'],
  target: 'es2020',
  minify: true,
  sourcemap: true,
  clean: true,
  dts: false,
  globalName: 'PlatformWidget',
});
