/**
 * Extension-host test hooks for the virtuous cycle test harness.
 *
 * When the extension activates with `JANUMICODE_E2E=1` set, the
 * bootstrap registers the commands declared here. They give the
 * in-host Mocha harness suite (src/test/e2e/harness-suite/*) a
 * scripted way to drive a Phase 0→10 run through the real extension
 * code path — same liaison, same decision router, same db — without a
 * human at the webview.
 *
 * Security note: these commands are NEVER exposed in production
 * installs. The env-var gate fires before `vscode.commands.registerCommand`
 * is ever called; a user's VS Code can't invoke
 * `janumicode._test.submitIntent(...)` because the command ID simply
 * isn't registered.
 *
 * Design constraint: each command returns a JSON-serialisable value
 * (or void). VS Code's command infrastructure proxies args and return
 * values across the IPC boundary when a command is invoked from the
 * extension host test runner — anything non-serializable (functions,
 * class instances, cyclic refs) would be silently dropped.
 */

import * as vscode from 'vscode';
import * as fs from 'node:fs';
import { collectHarnessResult } from './test/harness/collectResults';
import type { HarnessResult } from './test/harness/types';
import { makeUserInput, type ClientLiaisonAgent } from './lib/agents/clientLiaisonAgent';
import type { OrchestratorEngine } from './lib/orchestrator/orchestratorEngine';
import type { Database } from './lib/database/init';
import type { GovernedStreamViewProvider } from './lib/webview/governedStreamViewProvider';
import { getLogger } from './lib/logging';

export interface TestHookContext {
  engine: OrchestratorEngine;
  liaison: ClientLiaisonAgent;
  db: Database;
  provider: GovernedStreamViewProvider;
  dbPath: string;
  workspacePath: string;
}

export const E2E_ENV_VAR = 'JANUMICODE_E2E';
export const HARNESS_INTENT_ENV = 'JANUMICODE_HARNESS_INTENT';
export const HARNESS_GAP_PATH_ENV = 'JANUMICODE_HARNESS_GAP_PATH';

/**
 * Register the JANUMICODE_E2E-gated test-hook commands. Returns an
 * array of `Disposable` suitable for pushing onto
 * `context.subscriptions`. When the env var isn't set to `1`, returns
 * an empty array — no commands are registered.
 */
export function registerTestHookCommands(
  ctx: TestHookContext,
): vscode.Disposable[] {
  if (process.env[E2E_ENV_VAR] !== '1') return [];

  const log = getLogger();
  log.info('activation', 'E2E test hooks enabled — registering janumicode._test.* commands');

  const startTimes = new Map<string, number>();

  const disposables: vscode.Disposable[] = [];

  // Submit an intent through the real ClientLiaisonAgent so the same
  // routing / Phase 0 bootstrap / ingestion flow the webview triggers
  // runs in-process. Returns the workflow_run_id so the caller can
  // scope subsequent queries.
  disposables.push(
    vscode.commands.registerCommand(
      'janumicode._test.submitIntent',
      async (intent: string): Promise<{ workflowRunId: string }> => {
        const input = makeUserInput({
          text: intent,
          inputMode: 'raw_intent',
          workflowRunId: null,
          currentPhaseId: null,
        });
        await ctx.liaison.handleUserInput(input, ctx.provider.getCapabilityContext());
        const run = ctx.db.prepare(
          `SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`,
        ).get() as { id: string } | undefined;
        if (!run) throw new Error('submitIntent produced no workflow_run row');
        startTimes.set(run.id, Date.now());
        return { workflowRunId: run.id };
      },
    ),
  );

  // Flip auto-approve on the engine so pauseForDecision synthesizes
  // resolutions instead of blocking on the webview. Mirrors what
  // HeadlessLiaisonAdapter does for the CLI.
  disposables.push(
    vscode.commands.registerCommand('janumicode._test.enableAutoApprove', () => {
      ctx.engine.setAutoApproveDecisions(true);
    }),
  );

  // Opt into CLI parser registration for real Phase 9 execution. Mock
  // mode skips this — Phase 9 task executions then fail fast with
  // "No output parser registered" which is the expected virtuous-cycle
  // gap signal when Claude Code isn't configured.
  disposables.push(
    vscode.commands.registerCommand('janumicode._test.registerCliParsers', () => {
      ctx.engine.registerBuiltinCLIParsers();
    }),
  );

  // Steer the Orchestrator role (Phase 1.0 Intent Quality Check, etc.)
  // to a specific backing tool + model. Harness test harness real-mode
  // wires this to `claude_code_cli` + `qwen3.5:9b` so the CLI path is
  // exercised end-to-end; mock runs leave the createTestEngine default
  // in place.
  disposables.push(
    vscode.commands.registerCommand(
      'janumicode._test.setOrchestratorRouting',
      (backingTool: string, model?: string, provider?: string) => {
        ctx.engine.configManager.setOrchestratorRouting({
          primary: { backing_tool: backingTool, model, provider },
          temperature: 0.3,
        });
        if (backingTool !== 'direct_llm_api') {
          ctx.engine.registerBuiltinCLIParsers();
        }
      },
    ),
  );

  // Block until the workflow run enters a terminal state (completed /
  // failed / rolled_back) OR the timeout hits. Polls the state
  // machine every 100ms — the eventBus `workflow:completed` event
  // arrives too early for mock runs because Phase 10 can still be
  // writing its trailing records.
  disposables.push(
    vscode.commands.registerCommand(
      'janumicode._test.waitForCompletion',
      async (
        workflowRunId: string,
        timeoutMs: number = 600_000,
      ): Promise<{ status: string; timedOut: boolean }> => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const run = ctx.engine.stateMachine.getWorkflowRun(workflowRunId);
          if (run && ['completed', 'failed', 'rolled_back'].includes(run.status)) {
            return { status: run.status, timedOut: false };
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        const run = ctx.engine.stateMachine.getWorkflowRun(workflowRunId);
        return { status: run?.status ?? 'unknown', timedOut: true };
      },
    ),
  );

  // Produce the canonical HarnessResult for a run by driving the
  // oracle over its governed_stream. Identical JSON shape to what
  // `node dist/cli/janumicode.js run --json` emits.
  disposables.push(
    vscode.commands.registerCommand(
      'janumicode._test.getHarnessResult',
      (workflowRunId: string): HarnessResult => {
        const startTimeMs = startTimes.get(workflowRunId) ?? Date.now();
        return collectHarnessResult(ctx.db, workflowRunId, {
          dbPath: ctx.dbPath,
          startTimeMs,
        });
      },
    ),
  );

  // Persist the HarnessResult's gap report to disk so the launching
  // process (vscode-test runner → terminal) can read it back without
  // a return-value round-trip. When no gap report exists (status ===
  // success), writes a stub `{ status: "success" }` file so the
  // caller can still assert on file presence.
  disposables.push(
    vscode.commands.registerCommand(
      'janumicode._test.writeGapReport',
      (workflowRunId: string, outputPath: string): { written: boolean } => {
        const result = collectHarnessResult(ctx.db, workflowRunId, {
          dbPath: ctx.dbPath,
          startTimeMs: startTimes.get(workflowRunId) ?? Date.now(),
        });
        const payload = result.gapReport
          ? result.gapReport
          : { status: result.status, phasesCompleted: result.phasesCompleted };
        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
        return { written: true };
      },
    ),
  );

  return disposables;
}
