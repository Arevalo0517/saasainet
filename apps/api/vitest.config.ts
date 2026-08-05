import { defineConfig, type Plugin } from 'vitest/config';
import { esbuildDecorators } from '@anatine/esbuild-decorators';
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const decoratorMetadataPlugin = (): Plugin => {
  const plugin = esbuildDecorators({ tsconfig: path.resolve(__dirname, 'tsconfig.test.json') });
  return {
    name: 'esbuild-decorator-metadata',
    enforce: 'pre',
    transform: {
      order: 'pre',
      handler: async (code: string, id: string) => {
        if (!/\.(?:ts|tsx|cts|mts)$/u.test(id)) return null;
        if (!/[@]\w/u.test(code)) return null;
        const tmpPath = path.join(__dirname, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);
        await fs.writeFile(tmpPath, code);
        try {
          const result = await esbuild.build({
            entryPoints: [tmpPath],
            bundle: false,
            write: false,
            format: 'esm',
            target: 'es2022',
            plugins: [plugin],
            loader: { '.ts': 'ts' },
          });
          const out = result.outputFiles[0];
          return { code: out.text, map: out.map ?? null };
        } finally {
          await fs.unlink(tmpPath).catch(() => {});
        }
      },
    },
  };
};

export default defineConfig({
  plugins: [decoratorMetadataPlugin()],
  test: {
    passWithNoTests: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      '.turbo/**',
      'coverage/**',
      '**/build/**',
    ],
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});