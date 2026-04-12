import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: '.',
    include: [
      'src/test/unit/**/*.test.ts',
      'src/test/integration/**/*.test.ts',
    ],
    exclude: [
      'src/test/prompt-probes/**',
    ],
    globals: false,
    setupFiles: ['src/test/helpers/setup.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/test/**', 'src/webview/**', 'src/sidecar/**'],
    },
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@sidecar': path.resolve(__dirname, 'src/sidecar'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
  },
});
