/**
 * Vitest config for live-ollama tests (*.live.test.ts).
 *
 * Run separately: `pnpm test:live`. Requires Ollama running at OLLAMA_URL
 * (default 127.0.0.1:11434). Long timeouts — LLM calls can take minutes.
 *
 * IMPORTANT: `fileParallelism: false`. Vitest 4.x runs test FILES in
 * parallel by default. Live tests share a single Ollama backend with one
 * local GPU; firing multiple LLM calls concurrently floods the queue and
 * causes time-outs (see: 7/16 failures observed under the default config
 * vs. 16/16 with sequential file execution). Tests *within* a single file
 * already run sequentially, which is what we want.
 *
 * `--no-file-parallelism` on the CLI achieves the same — this config
 * bakes it in so future contributors don't need to remember the flag.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

// Default-on T5 LLM-as-judge for the live tier (one extra Ollama call per
// fixture that declares a t5_llm_judges entry). Set the env var to '0'
// or 'false' to disable — see assertions/t5LlmJudge.ts isJudgeEnabled().
if (process.env.JANUMICODE_REGRESSION_LLM_JUDGE === undefined) {
  process.env.JANUMICODE_REGRESSION_LLM_JUDGE = '1';
}

export default defineConfig({
  test: {
    root: '.',
    include: [
      'src/test/unit/**/*.live.test.ts',
      'src/test/integration/**/*.live.test.ts',
      // Acceptance harness — per-boundary live LLM call validated
      // against the contract registry. Runs under the live config so
      // it inherits the Ollama-serialized fileParallelism settings.
      // Skipped gracefully when Ollama is unreachable so contributors
      // without a local daemon don't see false test failures.
      'src/test/acceptance/**/*.live.test.ts',
    ],
    globals: false,
    testTimeout: 300000, // 5 minutes per test — first model load can be slow
    hookTimeout: 60000,
    setupFiles: ['src/test/helpers/setup.ts'],
    fileParallelism: false, // Critical: serialize files to avoid GPU queue overload
    // Verbose reporter: long-running LLM tier where the default reporter
    // emits almost nothing until failure. Captured-output truncation on
    // long runs hides which test was running when something tripped.
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
  },
});
