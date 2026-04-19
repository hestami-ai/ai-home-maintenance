/**
 * PipelineRunner - Core workflow execution engine for CLI and test harness.
 *
 * Provides a shared execution path used by:
 *   - CLI (src/cli/index.ts)
 *   - Test harness (src/test/harness/workflowHarness.ts)
 *
 * This ensures the CLI uses the exact same pipeline as the test harness,
 * satisfying the "Pipeline Fidelity" principle.
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import type { Database } from '../lib/database/init';
import { OrchestratorEngine } from '../lib/orchestrator/orchestratorEngine';
import { HeadlessLiaisonAdapter, type HeadlessLiaisonConfig } from '../core/headlessLiaisonAdapter';
import { createTestEngine } from '../test/helpers/createTestEngine';
import type { PhaseId } from '../lib/types/records';
import { generateLLMGapSuggestion } from '../test/harness/gapReportEnhancer';
import { collectHarnessResult } from '../test/harness/collectResults';

// Re-export types for consumers
export type { HarnessResult, GapReport, SemanticWarning, DecisionOverride, PipelineRunnerConfig } from '../test/harness/types';

/**
 * Run a workflow pipeline in headless mode.
 *
 * @param intent - Intent string or @filepath reference
 * @param config - Pipeline configuration
 * @returns Harness result with status, phases, artifacts, and gap report
 */
export async function runPipeline(
  intent: string,
  config: import('../test/harness/types').PipelineRunnerConfig,
): Promise<import('../test/harness/types').HarnessResult> {
  const startTime = Date.now();
  const repoRoot = path.resolve(__dirname, '..', '..');
  const extensionPath = repoRoot;
  const workspacePath = config.workspacePath;

  // Database: either resume from an existing DB or create a fresh one.
  const dbDir = path.join(workspacePath, '.janumicode', 'test-harness');
  fs.mkdirSync(dbDir, { recursive: true });

  let resolvedDbPath: string;
  if (config.resumeFromDb) {
    // Copy the source DB so we don't mutate the original.
    resolvedDbPath = path.join(dbDir, `resume-${Date.now()}.db`);
    fs.copyFileSync(config.resumeFromDb, resolvedDbPath);
    for (const ext of ['-wal', '-shm']) {
      const src = config.resumeFromDb + ext;
      if (fs.existsSync(src)) fs.copyFileSync(src, resolvedDbPath + ext);
    }
  } else {
    resolvedDbPath = path.join(dbDir, `${Date.now()}.db`);
  }

  const llmMode = config.llmMode === 'real'
    ? (config.captureFixtures ? 'capture' : 'real')
    : 'mock';

  const te = await createTestEngine({
    dbPath: resolvedDbPath,
    extensionPath,
    workspacePath,
    autoApprove: config.autoApprove,
    fixtureDir: config.fixtureDir,
    llmMode,
  });
  const { engine, liaison, db, mockLLM, embedding } = te;

  // --phase-limit wiring: the CLI parses the flag, stores it on config,
  // and we tell the engine to stop its auto-advance loop after the
  // named phase. Without this the engine slides past the target, which
  // defeats the spec's "fix Phase N, rerun `--phase-limit N`" inner
  // loop for incremental fixture capture + assertion work.
  if (config.phaseLimit) {
    engine.setPhaseLimit(config.phaseLimit as PhaseId);
  }

  // Live observability for live (non-mock) runs. Writes per-call .log
  // files under <workspace>/.janumicode/live/ (C8) and prints a
  // heartbeat + live tail to stdout (A1 + A3) so you can tell a
  // running call from a stalled one without opening the DB.
  const liveLogDir = path.join(workspacePath, '.janumicode', 'live');
  if (llmMode !== 'mock') {
    fs.mkdirSync(liveLogDir, { recursive: true });
    engine.llmCaller.setLiveLogDir(liveLogDir);
    // Real-mode runs spawn the Claude Code subprocess for Phase 9 task
    // execution. Mock mode deliberately skips this — Phase 9 should
    // fail fast with "No output parser registered for backing tool:
    // claude_code_cli" so fixture-only tests don't hang waiting for a
    // coding agent that isn't configured in the test env.
    engine.registerBuiltinCLIParsers();

    // Real-mode routing overrides from env vars. Lets operators steer
    // the Orchestrator and Domain Interpreter roles to specific CLI
    // backings (e.g. OpenAI Codex for a gold-capture run) without
    // editing config.json. Unset → role uses DEFAULT_CONFIG routing.
    //
    //   JANUMICODE_ORCHESTRATOR_BACKING        — 'claude_code_cli' | 'codex_cli' | 'openai_codex_cli' | 'gemini_cli' | 'goose_cli' | 'direct_llm_api'
    //   JANUMICODE_ORCHESTRATOR_MODEL          — model id for CLI / direct backing
    //   JANUMICODE_ORCHESTRATOR_PROVIDER       — only for direct_llm_api
    //   JANUMICODE_DOMAIN_INTERPRETER_BACKING  — same enum as above
    //   JANUMICODE_DOMAIN_INTERPRETER_MODEL
    //   JANUMICODE_DOMAIN_INTERPRETER_PROVIDER
    const orchBacking = process.env.JANUMICODE_ORCHESTRATOR_BACKING;
    if (orchBacking) {
      engine.configManager.setOrchestratorRouting({
        primary: {
          backing_tool: orchBacking,
          provider: process.env.JANUMICODE_ORCHESTRATOR_PROVIDER,
          model: process.env.JANUMICODE_ORCHESTRATOR_MODEL,
        },
        temperature: 0.3,
      });
    }
    const diBacking = process.env.JANUMICODE_DOMAIN_INTERPRETER_BACKING;
    if (diBacking) {
      engine.configManager.setDomainInterpreterRouting({
        primary: {
          backing_tool: diBacking,
          provider: process.env.JANUMICODE_DOMAIN_INTERPRETER_PROVIDER,
          model: process.env.JANUMICODE_DOMAIN_INTERPRETER_MODEL,
        },
        temperature: 0.5,
      });
    }
  }
  const detachMonitor = llmMode !== 'mock'
    ? attachLiveMonitor(engine.eventBus, liveLogDir)
    : null;

  try {
    let workflowRunId: string | null = null;

    if (config.resumeFromDb && config.resumeAtPhase) {
      // ── Resume mode: skip bootstrapIntent, advance to target phase ──
      workflowRunId = findLatestRunId(db);
      if (!workflowRunId) {
        throw new Error(`No workflow run found in resumed database: ${config.resumeFromDb}`);
      }

      const targetPhase = config.resumeAtPhase as PhaseId;
      console.log(`Resuming run ${workflowRunId} at Phase ${targetPhase}`);

      // Advance through intermediate phases to reach the target.
      // The state machine only allows adjacent forward transitions.
      const { PHASE_ORDER: phaseOrder } = require('../lib/types/records');
      const run = engine.stateMachine.getWorkflowRun(workflowRunId);
      const currentIdx = phaseOrder.indexOf(run?.current_phase_id);
      const targetIdx = phaseOrder.indexOf(targetPhase);
      if (currentIdx >= 0 && targetIdx > currentIdx) {
        for (let i = currentIdx + 1; i <= targetIdx; i++) {
          engine.advanceToNextPhase(workflowRunId, phaseOrder[i]);
        }
      } else if (run?.current_phase_id !== targetPhase) {
        throw new Error(`Could not advance to Phase ${targetPhase}. Current: ${run?.current_phase_id}`);
      }

      // Execute the target phase (auto-advance chains to subsequent phases).
      await engine.executeCurrentPhase(workflowRunId);
    } else {
      // ── Normal mode: full pipeline from intent ──
      const headlessConfig: HeadlessLiaisonConfig = {
        intent,
        autoApprove: config.autoApprove,
        decisionOverrides: config.decisionOverrides,
        workspacePath,
        extensionPath,
      };

      const headlessAdapter = new HeadlessLiaisonAdapter(
        engine, liaison, liaison.getDB(), engine.eventBus, embedding,
      );

      const result = await headlessAdapter.bootstrapIntent(headlessConfig);
      workflowRunId = result.workflowRunId;

      // Wait for quiescence (fire-and-forget phases to complete).
      const timeout = llmMode === 'mock' ? 10000 : 3600000;
      const stableThreshold = llmMode === 'mock' ? 3 : 100;
      if (workflowRunId) {
        await waitForQuiescence(engine, db, workflowRunId, timeout, stableThreshold);
      }
    }

    // Save captured fixtures if in capture mode.
    if (llmMode === 'capture' && mockLLM.getCapturedCalls().length > 0) {
      const captureDir = config.captureOutputDir
        ?? path.join(repoRoot, 'src', 'test', 'fixtures', 'captured');
      fs.mkdirSync(captureDir, { recursive: true });
      const saved = await mockLLM.saveCapturedFixtures(
        captureDir,
        engine.janumiCodeVersionSha,
      );
      console.log(`\nCaptured ${saved.length} fixture(s) to ${captureDir}`);
      for (const f of saved) {
        console.log(`  ${path.relative(repoRoot, f)}`);
      }
    }

    const result = collectHarnessResult(db, workflowRunId, {
      dbPath: resolvedDbPath,
      startTimeMs: startTime,
    });

    // Optional LLM-grounded suggested_fix. Runs after the rule-based
    // enhancement so the prompt can reference the already-populated
    // failed_at_phase. Any failure is swallowed inside
    // generateLLMGapSuggestion — the base report is still returned.
    if (config.llmGapEnhance && result.gapReport && workflowRunId) {
      const suggestion = await generateLLMGapSuggestion(
        db,
        workflowRunId,
        result.gapReport,
        engine.llmCaller,
        {
          provider: config.llmGapEnhance.provider,
          model: config.llmGapEnhance.model,
        },
      );
      if (suggestion) {
        result.gapReport.llm_suggested_fix = suggestion;
      }
    }

    return result;
  } finally {
    detachMonitor?.();
    te.cleanup();
  }
}

// ── Live observability (A1 heartbeat + A3 live tail) ───────────────

interface LiveInvocationState {
  invocationId: string;
  label: string;
  subPhaseId: string;
  startedAt: number;
  lastChunkAt: number;
  responseChars: number;
  thinkingChars: number;
  recentTail: string; // last ~80 chars of whichever channel streamed last
}

/**
 * Subscribe to the engine's eventBus and pump a heartbeat line + live
 * tail to stdout. Returns a detach function. Safe to call even when
 * stdout isn't a TTY — we use newline-per-heartbeat so the output is
 * still readable in a log file or a captured background task.
 *
 * The heartbeat is deliberately boring (one line, easy to grep for
 * `[live]`) so you can `tail -f` the CLI output alongside the per-call
 * .log files and always see at a glance: "is a call still making
 * tokens, or is it hung?"
 */
function attachLiveMonitor(
  eventBus: import('../lib/events/eventBus').EventBus,
  liveLogDir: string,
): () => void {
  const active = new Map<string, LiveInvocationState>();
  const HEARTBEAT_MS = 10_000;

  const now = (): number => Date.now();

  const offStart = eventBus.on('agent:invocation_started', ({ invocationId, agentRole }) => {
    active.set(invocationId, {
      invocationId,
      label: agentRole,
      subPhaseId: '-',
      startedAt: now(),
      lastChunkAt: now(),
      responseChars: 0,
      thinkingChars: 0,
      recentTail: '',
    });
  });

  // The LLMCaller's llm:started event carries the richer label/subPhase
  // that we want in the heartbeat. Correlate by the last-added
  // invocation id for now (the LLMCaller fires started AFTER it writes
  // the agent_invocation record, so the correlation is reliable for a
  // single in-flight call per agent role).
  const offStarted = eventBus.on('llm:started', ({ label, subPhaseId }) => {
    // Update the most recently added still-running invocation.
    const latest = [...active.values()].at(-1);
    if (latest) {
      if (label) latest.label = label;
      if (subPhaseId) latest.subPhaseId = subPhaseId;
    }
  });

  const offChunk = eventBus.on('llm:stream_chunk', ({ invocationId, channel, text }) => {
    const state = active.get(invocationId);
    if (!state) return;
    state.lastChunkAt = now();
    if (channel === 'thinking') state.thinkingChars += text.length;
    else if (channel === 'response') state.responseChars += text.length;
    // Keep last ~80 chars of this channel for the tail line.
    const buf = state.recentTail + text.replace(/\n/g, '·');
    state.recentTail = buf.slice(-80);
    // Fire a tail line immediately on each chunk so the user sees
    // progress. Throttled implicitly because providers emit in token
    // or NDJSON frames, not keystrokes.
    process.stdout.write(
      `\r[live ${state.subPhaseId} ${truncate(state.label, 28)}] ` +
      `${state.responseChars.toString().padStart(5)}r ` +
      `${state.thinkingChars.toString().padStart(6)}t  ${state.recentTail.padEnd(80)}`,
    );
  });

  const offFinish = eventBus.on('llm:finished', () => {
    // Clear the tail line and let the next heartbeat re-render.
    process.stdout.write('\r' + ' '.repeat(140) + '\r');
    // Flush latest state snapshot for whichever call just completed.
    const latest = [...active.values()].at(-1);
    if (latest) active.delete(latest.invocationId);
  });

  // Heartbeat timer: prints one line per active call every 10s. If
  // nothing is in flight, stays silent — no need to spam stdout.
  const heartbeat = setInterval(() => {
    if (active.size === 0) return;
    const ts = new Date().toISOString().slice(11, 19);
    for (const s of active.values()) {
      const elapsed = Math.round((now() - s.startedAt) / 1000);
      const idle = Math.round((now() - s.lastChunkAt) / 1000);
      const stall = idle > 30 ? ` STALLED ${idle}s` : '';
      process.stdout.write(
        `\n[live ${ts}] ${s.subPhaseId} ${truncate(s.label, 28)} · ` +
        `elapsed ${elapsed}s · response=${s.responseChars}c thinking=${s.thinkingChars}c` +
        stall +
        `  (log: ${path.relative(process.cwd(), path.join(liveLogDir, s.invocationId + '.log'))})\n`,
      );
    }
  }, HEARTBEAT_MS);

  return () => {
    clearInterval(heartbeat);
    offStart();
    offStarted();
    offChunk();
    offFinish();
    // Final newline so any trailing tail line doesn't clobber the
    // pipeline's summary output.
    process.stdout.write('\n');
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s.padEnd(max);
  return s.slice(0, max - 1) + '…';
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Find the most recent workflow run ID in the database.
 */
function findLatestRunId(db: Database): string | null {
  const row = db.prepare(
    `SELECT id FROM workflow_runs ORDER BY initiated_at DESC LIMIT 1`,
  ).get() as { id: string } | undefined;
  return row?.id ?? null;
}

/**
 * Wait until the workflow run reaches a quiescent state.
 *
 * Uses three signals to avoid premature quiescence:
 *   1. engine.executingPhaseCount > 0 — a phase handler is running
 *   2. engine.llmCaller.inFlightCount > 0 — an LLM call is in-flight
 *   3. Record count is still growing — pipeline is making progress
 *
 * Declares quiescence only when all three are idle for `stableThreshold`
 * consecutive polls. Also detects per-phase stalls: if the record count
 * hasn't changed for `phaseStallMs` while a phase is supposedly running,
 * we declare a stall and exit (the phase handler likely errored silently).
 */
async function waitForQuiescence(
  engine: OrchestratorEngine,
  db: Database,
  runId: string,
  timeoutMs: number,
  stableThreshold = 3,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const phaseStallMs = 600000; // 10 min with no new records = stalled
  let lastSubPhase: string | null | undefined = undefined;
  let stableCount = 0;
  let lastRecordCount = getRecordCount(db, runId);
  let lastProgressAt = Date.now();

  while (Date.now() < deadline) {
    const run = engine.stateMachine.getWorkflowRun(runId);
    if (!run) return;
    if (run.status === 'completed' || run.status === 'failed' || run.status === 'rolled_back') {
      return;
    }

    // Check progress: are new records being written?
    const currentRecordCount = getRecordCount(db, runId);
    if (currentRecordCount > lastRecordCount) {
      lastRecordCount = currentRecordCount;
      lastProgressAt = Date.now();
    }

    // Stall detection: if nothing has been written for phaseStallMs and
    // there's no active work, the pipeline is stuck.
    const timeSinceProgress = Date.now() - lastProgressAt;
    if (timeSinceProgress > phaseStallMs
        && engine.executingPhaseCount === 0
        && engine.llmCaller.inFlightCount === 0) {
      console.warn(`[waitForQuiescence] Stall detected: no new records for ${(timeSinceProgress / 1000).toFixed(0)}s`);
      return;
    }

    // Never declare quiescence while phases are executing or LLM calls
    // are in-flight.
    if (engine.executingPhaseCount > 0 || engine.llmCaller.inFlightCount > 0) {
      stableCount = 0;
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    const pendingCount = (engine as unknown as { pendingDecisions: Map<string, unknown> }).pendingDecisions?.size ?? 0;
    if (run.current_sub_phase_id === lastSubPhase && pendingCount === 0) {
      stableCount++;
      if (stableCount >= stableThreshold) return;
    } else {
      stableCount = 0;
      lastSubPhase = run.current_sub_phase_id;
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  console.warn(`[waitForQuiescence] Timeout after ${(timeoutMs / 1000).toFixed(0)}s`);
}

function getRecordCount(db: Database, runId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM governed_stream WHERE workflow_run_id = ?`,
  ).get(runId) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

