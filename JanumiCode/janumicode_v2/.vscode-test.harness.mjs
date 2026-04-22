// @ts-check
/**
 * @vscode/test-cli configuration for the virtuous cycle harness suite.
 *
 * Points `files` at `*.harness.test.js` under the harness-suite/ glob
 * so this config only picks up the harness driver — the Layer C smoke
 * suite (`*.smoke.test.js`) stays owned by `.vscode-test.mjs`. Running
 * both glob-disjoint keeps the smoke-vs-harness split stable.
 *
 * Env contract (see virtuousCycle.harness.test.ts header for the full
 * list): callers MUST set JANUMICODE_E2E=1 so the extension registers
 * the `janumicode._test.*` commands. Without it the harness test's
 * before-hook fails fast.
 *
 * Run via `pnpm harness:e2e`. Env vars in process.env flow through to
 * the Extension Development Host, so a launching process can override
 * JANUMICODE_HARNESS_INTENT etc. without editing this file.
 */

import { defineConfig } from '@vscode/test-cli';
import path from 'node:path';

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  files: 'out/test/e2e/harness-suite/**/*.harness.test.js',
  workspaceFolder: path.join(rootDir, 'test-and-evaluation', 'test-workspace'),
  mocha: {
    ui: 'bdd',
    color: true,
    // Harness runs live through Phase 1-8 Ollama calls; per-test
    // timeout overridden in the suite via this.timeout(envTimeoutMs).
    timeout: 3_600_000,
  },
  launchArgs: [
    '--disable-workspace-trust',
    '--disable-extensions',
  ],
  env: {
    JANUMICODE_E2E: '1',
    JANUMICODE_AUTOSHOW_LOGS: '0',
    // Default: mock mode for fast CI. Real-mode runs flip these three
    // via their own env overrides at the terminal or launch config.
    JANUMICODE_LLM_PROVIDER: process.env.JANUMICODE_LLM_PROVIDER ?? 'mock',
    JANUMICODE_HARNESS_INTENT: process.env.JANUMICODE_HARNESS_INTENT
      ?? 'Build a simple CLI todo app with add, list, and complete commands, and JSON file persistence.',
    JANUMICODE_HARNESS_GAP_PATH: process.env.JANUMICODE_HARNESS_GAP_PATH
      ?? path.join(rootDir, 'test-and-evaluation', 'test-workspace', '.janumicode', 'harness-gap.json'),
    // Pass through the optional knobs so terminal callers can steer:
    ...(process.env.JANUMICODE_HARNESS_FIXTURE_DIR && {
      JANUMICODE_HARNESS_FIXTURE_DIR: process.env.JANUMICODE_HARNESS_FIXTURE_DIR,
    }),
    ...(process.env.JANUMICODE_HARNESS_REAL_PHASE9 && {
      JANUMICODE_HARNESS_REAL_PHASE9: process.env.JANUMICODE_HARNESS_REAL_PHASE9,
    }),
    ...(process.env.JANUMICODE_HARNESS_TIMEOUT_MS && {
      JANUMICODE_HARNESS_TIMEOUT_MS: process.env.JANUMICODE_HARNESS_TIMEOUT_MS,
    }),
    ...(process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS && {
      JANUMICODE_CLAUDE_SKIP_PERMISSIONS: process.env.JANUMICODE_CLAUDE_SKIP_PERMISSIONS,
    }),
    ...(process.env.JANUMICODE_CLAUDE_MODEL && {
      JANUMICODE_CLAUDE_MODEL: process.env.JANUMICODE_CLAUDE_MODEL,
    }),
    // Orchestrator routing overrides. When set, the in-host harness
    // calls `janumicode._test.setOrchestratorRouting` with these
    // values. Typical production-mirroring run:
    //   JANUMICODE_HARNESS_ORCHESTRATOR_BACKING=gemini_cli
    // Typical CLI-path harness run (via claude-code-router proxy):
    //   JANUMICODE_HARNESS_ORCHESTRATOR_BACKING=claude_code_cli
    //   JANUMICODE_HARNESS_ORCHESTRATOR_MODEL=qwen3.5:9b
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_BACKING && {
      JANUMICODE_HARNESS_ORCHESTRATOR_BACKING: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_BACKING,
    }),
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_MODEL && {
      JANUMICODE_HARNESS_ORCHESTRATOR_MODEL: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_MODEL,
    }),
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER && {
      JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER,
    }),
  },
});
