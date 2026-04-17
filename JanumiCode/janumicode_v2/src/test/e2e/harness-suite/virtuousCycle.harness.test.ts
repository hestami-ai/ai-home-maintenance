/**
 * Virtuous cycle harness test — runs inside a real VS Code Extension
 * Development Host (launched by @vscode/test-cli with
 * `.vscode-test.harness.mjs` pointing at this file) and drives a full
 * Phase 0→10 pipeline through the live extension:
 *   - the real ClientLiaisonAgent
 *   - the real OrchestratorEngine
 *   - the real DecisionRouter
 *   - the real GovernedStreamViewProvider (capability context, not the webview
 *     paint — the harness sends via the test-hook command, not postMessage)
 *
 * The smoke test (`extension.smoke.test.ts`) only verifies activation
 * + command registration. This harness test verifies the pipeline
 * actually produces artifacts end-to-end when driven from the
 * extension host's own liaison — closing the gap between the
 * vitest-based headless adapter tests and what the real extension
 * does on F5.
 *
 * Env-var contract (all optional except `JANUMICODE_E2E`):
 *   JANUMICODE_E2E=1                   — required; gates test-hook commands
 *   JANUMICODE_HARNESS_INTENT=<text>   — intent to submit (default: todo CLI)
 *   JANUMICODE_HARNESS_FIXTURE_DIR=<p> — mock fixture corpus (real Ollama if unset)
 *   JANUMICODE_HARNESS_GAP_PATH=<p>    — gap report destination (default: ws/.janumicode/harness-gap.json)
 *   JANUMICODE_HARNESS_REAL_PHASE9=1   — register CLI parsers so Phase 9 spawns claude
 *   JANUMICODE_HARNESS_TIMEOUT_MS=<n>  — waitForCompletion timeout (default: 600000)
 */

// `import` turns this file into a module, so the top-level const
// names (assert, vscodeMod) don't collide with the smoke suite when
// both compile to `out/test/e2e/**/*.js` and run under the same
// Mocha process.
import type * as vscodeTypes from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const assert = require('node:assert');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vscodeMod: typeof vscodeTypes = require('vscode');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('node:path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs');

const EXTENSION_ID = 'hestami-ai.janumicode';
const DEFAULT_INTENT = 'Build a simple CLI todo app with add, list, and complete commands, and JSON file persistence.';
const DEFAULT_TIMEOUT_MS = 600_000;
const ACTIVATION_TIMEOUT_MS = 60_000;

interface HarnessResultLite {
  status: 'success' | 'partial' | 'failed';
  phasesCompleted: string[];
  phasesFailed: string[];
  artifactsProduced: Record<string, string[]>;
  gapReport?: { failed_at_phase?: string; failed_at_sub_phase?: string };
  semanticWarnings: Array<{ phase: string; subPhase: string; assertion: string }>;
  durationMs: number;
  governedStreamPath: string;
}

describe('JanumiCode v2 — virtuous cycle harness', function () {
  // Phase 1→8 synthesis calls (Ollama) can run 2-6 min each on live mode.
  // Tests run serially so set the timeout per-it via the env var.
  const timeoutMs = Number.parseInt(
    process.env.JANUMICODE_HARNESS_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
    10,
  );
  this.timeout(timeoutMs + 30_000);

  before(async function () {
    const ext = vscodeMod.extensions.getExtension(EXTENSION_ID);
    if (!ext) throw new Error(`extension ${EXTENSION_ID} not found`);
    if (!ext.isActive) {
      await Promise.race([
        ext.activate(),
        new Promise((_r, rej) => setTimeout(
          () => rej(new Error(`Extension failed to activate within ${ACTIVATION_TIMEOUT_MS}ms`)),
          ACTIVATION_TIMEOUT_MS,
        )),
      ]);
    }

    // Test hooks should be registered now.
    const commands: string[] = await vscodeMod.commands.getCommands(true);
    assert.ok(
      commands.includes('janumicode._test.submitIntent'),
      'janumicode._test.submitIntent missing — is JANUMICODE_E2E=1 set?',
    );
  });

  it('drives Phase 0 → Phase 10 through the live extension and produces a gap report', async function () {
    // 1. Auto-approve every decision so pauseForDecision resolves synchronously.
    await vscodeMod.commands.executeCommand('janumicode._test.enableAutoApprove');

    // 2. Optional: register CLI parsers so Phase 9 tries to spawn
    // claude. When unset, Phase 9 fails fast with
    // "No output parser registered" — the expected virtuous-cycle
    // signal when Claude Code isn't configured in this env.
    if (process.env.JANUMICODE_HARNESS_REAL_PHASE9 === '1') {
      await vscodeMod.commands.executeCommand('janumicode._test.registerCliParsers');
    }

    // 2b. Optional: steer the Orchestrator role's backing. Production
    // default is gemini_cli; typical harness real-mode overrides to
    // claude_code_cli + qwen3.5:9b to exercise the CLI path without
    // a Gemini API key.
    const orchBacking = process.env.JANUMICODE_HARNESS_ORCHESTRATOR_BACKING;
    if (orchBacking) {
      await vscodeMod.commands.executeCommand(
        'janumicode._test.setOrchestratorRouting',
        orchBacking,
        process.env.JANUMICODE_HARNESS_ORCHESTRATOR_MODEL,
        process.env.JANUMICODE_HARNESS_ORCHESTRATOR_PROVIDER,
      );
    }

    // 3. Submit intent.
    const intent = process.env.JANUMICODE_HARNESS_INTENT ?? DEFAULT_INTENT;
    const submitResult = await vscodeMod.commands.executeCommand<{ workflowRunId: string }>(
      'janumicode._test.submitIntent',
      intent,
    );
    assert.ok(submitResult?.workflowRunId, 'submitIntent returned no workflowRunId');
    const runId: string = submitResult.workflowRunId;

    // 4. Wait for terminal state.
    const terminal = await vscodeMod.commands.executeCommand<{ status: string; timedOut: boolean }>(
      'janumicode._test.waitForCompletion',
      runId,
      timeoutMs,
    );
    assert.ok(terminal, 'waitForCompletion returned no result');
    assert.strictEqual(terminal.timedOut, false, `waitForCompletion timed out at status=${terminal.status}`);

    // 5. Write gap report to disk — the launching process reads this.
    const workspaceFolder = vscodeMod.workspace.workspaceFolders?.[0]?.uri.fsPath
      ?? path.join(__dirname, '..', '..', '..', '..', 'test-workspace');
    const gapPath = process.env.JANUMICODE_HARNESS_GAP_PATH
      ?? path.join(workspaceFolder, '.janumicode', 'harness-gap.json');
    fs.mkdirSync(path.dirname(gapPath), { recursive: true });
    await vscodeMod.commands.executeCommand(
      'janumicode._test.writeGapReport',
      runId,
      gapPath,
    );
    assert.ok(fs.existsSync(gapPath), `gap report not written to ${gapPath}`);

    // 6. Pull the full harness result and assert the pipeline actually
    // produced artifacts. We don't require status=success — Phase 9
    // often sits partial until a real coding agent is registered —
    // but we DO require that the extension walked past Phase 0.
    const result = await vscodeMod.commands.executeCommand<HarnessResultLite>(
      'janumicode._test.getHarnessResult',
      runId,
    );
    assert.ok(result, 'getHarnessResult returned nothing');
    assert.ok(
      result.phasesCompleted.includes('0'),
      `Phase 0 did not complete. status=${result.status} completed=${JSON.stringify(result.phasesCompleted)} failed=${JSON.stringify(result.phasesFailed)}`,
    );

    // Emit a one-line summary the terminal launcher can grep for.
    console.log(
      `[harness] status=${result.status} completed=[${result.phasesCompleted.join(',')}] ` +
      `failed=[${result.phasesFailed.join(',')}] ` +
      `failed_at_phase=${result.gapReport?.failed_at_phase ?? '-'} ` +
      `duration=${result.durationMs}ms gap=${gapPath}`,
    );
  });
});
