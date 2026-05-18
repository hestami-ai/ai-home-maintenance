/**
 * Vitest config for regression LIVE re-invocation tests.
 *
 * Runs `*.regression.live.test.ts` files. These re-invoke Ollama against
 * the historical template-variable inputs and run T1/T2/T3 assertions on
 * the fresh response.
 *
 * Same fileParallelism: false rationale as vitest.live.config.ts — a
 * single local GPU can't handle concurrent files.
 *
 * Long timeout because each test = one Ollama call, often 30-60s, and
 * the GPU warmup on first call can be slower.
 *
 * The deterministic regression layer (`*.regression.deterministic.test.ts`)
 * runs in the DEFAULT vitest config — it's fast and parallel-safe.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    root: '.',
    include: ['src/test/regression/**/*.regression.live.test.ts'],
    globals: false,
    testTimeout: 900000, // 15 minutes per test. Bloom-style prompts on qwen3.5:9b
                         // legitimately stream 200+ KB of JSON over 4-7 minutes;
                         // the no-progress timer in LLMCaller catches genuine
                         // hangs precisely. Mirror the thin-slice 1800s wall-clock
                         // budget at half scale (one fixture, not a full chain).
    hookTimeout: 60000,
    setupFiles: ['src/test/helpers/setup.ts'],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
  },
});
