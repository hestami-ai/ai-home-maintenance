/**
 * Vitest config for Ollama prompt probe tests.
 * Run separately: pnpm test:probes
 *
 * Requires Ollama running at localhost:11434.
 * Long timeouts — LLM calls can take minutes.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: '.',
    include: [
      'src/test/prompt-probes/**/*.probe.ts',
    ],
    globals: false,
    testTimeout: 300000, // 5 minutes per test
    hookTimeout: 60000,
    setupFiles: ['src/test/helpers/setup.ts'],
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
  },
});
