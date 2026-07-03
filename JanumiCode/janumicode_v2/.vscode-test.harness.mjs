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
    // Orchestrator routing override (OPTIONAL — the test-workspace
    // .janumicode/config.json already pins orchestrator/domain_interpreter/
    // requirements_agent to gemma4:31b-it-qat @ 131072). When set, the in-host
    // harness ALSO calls `janumicode._test.setOrchestratorRouting`:
    //   JANUMICODE_HARNESS_ORCHESTRATOR_BACKING=direct_llm_api
    //   JANUMICODE_HARNESS_ORCHESTRATOR_MODEL=gemma4:31b-it-qat
    //   JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER=ollama
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_BACKING && {
      JANUMICODE_HARNESS_ORCHESTRATOR_BACKING: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_BACKING,
    }),
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_MODEL && {
      JANUMICODE_HARNESS_ORCHESTRATOR_MODEL: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_MODEL,
    }),
    ...(process.env.JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER && {
      JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER: process.env.JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER,
    }),
    // Executor / mimo pass-through (Phase 9 real-mode, JANUMICODE_HARNESS_REAL_PHASE9=1).
    // Without these the Extension Development Host defaults mimo to its cloud model +
    // no context declaration. The Ollama server must run at OLLAMA_CONTEXT_LENGTH=131072
    // (mimo does not forward num_ctx).
    ...(process.env.JANUMICODE_EXECUTOR_BACKING_TOOL && {
      JANUMICODE_EXECUTOR_BACKING_TOOL: process.env.JANUMICODE_EXECUTOR_BACKING_TOOL,
    }),
    ...(process.env.JANUMICODE_MIMO_MODEL && {
      JANUMICODE_MIMO_MODEL: process.env.JANUMICODE_MIMO_MODEL,
    }),
    ...(process.env.JANUMICODE_MIMO_OPENAI_CONTEXT && {
      JANUMICODE_MIMO_OPENAI_CONTEXT: process.env.JANUMICODE_MIMO_OPENAI_CONTEXT,
    }),
    ...(process.env.JANUMICODE_MIMO_OPENAI_MAX_OUTPUT && {
      JANUMICODE_MIMO_OPENAI_MAX_OUTPUT: process.env.JANUMICODE_MIMO_OPENAI_MAX_OUTPUT,
    }),
    ...(process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S && {
      JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S: process.env.JANUMICODE_EXECUTOR_IDLE_TIMEOUT_S,
    }),
    // Harness profile knobs (mirror scripts/run-harness.sh:117-118). On slow
    // local models these two layers dominate wall-clock: the reasoning_review
    // harness hook fires on EVERY agent_output, and Stage III ingestion issues
    // a per-record LLM call — both on a different model than the core role, so
    // each forces a gemma4:31b <-> validator model swap (no keep-alive; Ollama
    // serves one model at a time). Neither affects CORE prompt materialization,
    // so a prompt-audit validation run sets both off:
    //   JANUMICODE_REVIEW_ENABLED=false JANUMICODE_INGESTION_STAGE3_OFF=1
    ...(process.env.JANUMICODE_REVIEW_ENABLED && {
      JANUMICODE_REVIEW_ENABLED: process.env.JANUMICODE_REVIEW_ENABLED,
    }),
    ...(process.env.JANUMICODE_INGESTION_STAGE3_OFF && {
      JANUMICODE_INGESTION_STAGE3_OFF: process.env.JANUMICODE_INGESTION_STAGE3_OFF,
    }),
    // Downgrade Phase-1.8 release-manifest blocking gaps to advisory. The P1.8
    // release_exact_coverage_* gates require the LLM release plan to place every
    // journey/workflow/entity in exactly one release; a dense model at temp=1.0
    // omits some stochastically → hard-fail with no retry, blocking a run whose
    // purpose is validating Phases 3-8. Opt-in; gaps stay logged + persisted.
    ...(process.env.JANUMICODE_RELEASE_MANIFEST_ADVISORY && {
      JANUMICODE_RELEASE_MANIFEST_ADVISORY: process.env.JANUMICODE_RELEASE_MANIFEST_ADVISORY,
    }),
  },
});
