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

export default defineConfig({
  test: {
    root: '.',
    include: [
      'src/test/unit/**/*.live.test.ts',
      'src/test/integration/**/*.live.test.ts',
    ],
    globals: false,
    testTimeout: 300000, // 5 minutes per test — first model load can be slow
    hookTimeout: 60000,
    setupFiles: ['src/test/helpers/setup.ts'],
    fileParallelism: false, // Critical: serialize files to avoid GPU queue overload
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@test': path.resolve(__dirname, 'src/test'),
      'vscode': path.resolve(__dirname, 'src/test/helpers/mocks/vscode.ts'),
    },
  },
});
