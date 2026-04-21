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
    // Wave 5 — Phase 2 Requirements Agent routing override.
    //   JANUMICODE_REQUIREMENTS_AGENT_BACKING / _PROVIDER / _MODEL
    const raBacking = process.env.JANUMICODE_REQUIREMENTS_AGENT_BACKING;
    if (raBacking) {
      engine.configManager.setRequirementsAgentRouting({
        primary: {
          backing_tool: raBacking,
          provider: process.env.JANUMICODE_REQUIREMENTS_AGENT_PROVIDER,
          model: process.env.JANUMICODE_REQUIREMENTS_AGENT_MODEL,
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

      // Session abort plumbing: create a controller, hand it to the
      // engine so every LLM call this session makes receives its
      // signal, and race the phase execution against waitForQuiescence.
      // On stall detection, abortSession() cancels the in-flight
      // ollama call, the saturation loop catches the abort, writes a
      // deferred supersession for the hung node, and executeCurrentPhase
      // unwinds. Without this, a hung ollama call holds the await
      // forever and the watchdog can only log (not intervene).
      const abortController = new AbortController();
      engine.setSessionAbortController(abortController);

      const mockCapMs = llmMode === 'mock' ? 10000 : null;
      const stableThreshold = llmMode === 'mock' ? 3 : 100;
      const recordsIdleStallMs = engine.configManager.get().workflow.records_idle_stall_ms;
      const phasePromise = engine.executeCurrentPhase(workflowRunId)
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[resume] Phase execution ended: ${msg}`);
        });
      const quiescencePromise = waitForQuiescence(engine, db, workflowRunId, {
        mockCapMs, stableThreshold, recordsIdleStallMs,
      }).then(() => {
        // Stall detected or workflow completed — abort any in-flight
        // LLM call so the phase promise unwinds. The abortSession call
        // is a no-op if nothing is in flight, so this is safe in the
        // clean-completion case too.
        engine.abortSession('waitForQuiescence exited (stall or completion)');
      });
      await Promise.race([phasePromise, quiescencePromise]);
      // After race wins, give the other side ~3 seconds to unwind
      // (HTTP abort → saturation loop catch → supersession write).
      await Promise.race([
        Promise.all([phasePromise, quiescencePromise]),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]);
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

      // Wait for quiescence. No wall-clock cap in real mode — we
      // exit when the workflow reports completed/failed OR the stream
      // goes silent for `records_idle_stall_ms` (default 15 min) which
      // is the real "something is stuck" signal. Mock mode retains a
      // short safety cap because mock runs should complete in seconds.
      // Session abort: plumb a controller so stall detection can
      // cancel any in-flight LLM call (same pattern as resume mode).
      const abortController = new AbortController();
      engine.setSessionAbortController(abortController);
      const mockCapMs = 10000;
      const stableThreshold = llmMode === 'mock' ? 3 : 100;
      const recordsIdleStallMs = engine.configManager.get().workflow.records_idle_stall_ms;
      if (workflowRunId) {
        await waitForQuiescence(engine, db, workflowRunId, {
          mockCapMs: llmMode === 'mock' ? mockCapMs : null,
          stableThreshold,
          recordsIdleStallMs,
        });
        engine.abortSession('waitForQuiescence exited (stall or completion)');
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
interface QuiescenceOptions {
  /**
   * Hard wall-clock cap in ms. When null, no wall-clock cap — the loop
   * runs until the workflow completes/fails or the stream goes silent
   * for `recordsIdleStallMs`. Set to a short value (e.g. 10s) for mock
   * mode where runs should finish in seconds.
   */
  mockCapMs: number | null;
  /**
   * Polls of same-subphase + no-in-flight + no-pending-decisions
   * required before declaring graceful quiescence.
   */
  stableThreshold: number;
  /**
   * Records-idle stall threshold. If no new governed_stream record
   * has been written for this long, declare the run stalled and exit
   * even while counters show a phase "executing" or an LLM call
   * "in-flight" — those can hang invisibly. Pending human decisions
   * suspend the check (waiting for a gate submit is not a stall).
   */
  recordsIdleStallMs: number;
}

interface QuiescenceLoopState {
  lastSubPhase: string | null | undefined;
  stableCount: number;
  lastRecordCount: number;
  lastProgressAt: number;
  lastHeartbeatAt: number;
}

/**
 * Decide what the loop should do this tick. Extracted to keep
 * waitForQuiescence's cognitive complexity within bounds.
 * Returns 'done' to exit the loop, 'continue' to poll again, or
 * 'tick' to fall through to the graceful-quiescence check.
 */
function evaluateQuiescenceTick(
  engine: OrchestratorEngine,
  run: { status: string; current_phase_id: string | null; current_sub_phase_id: string | null },
  state: QuiescenceLoopState,
  currentRecordCount: number,
  pendingCount: number,
  opts: QuiescenceOptions,
): 'done' | 'continue' | 'tick' {
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'rolled_back') {
    return 'done';
  }
  const timeSinceProgress = Date.now() - state.lastProgressAt;

  if (Date.now() - state.lastHeartbeatAt >= 60000) {
    console.warn(
      `[waitForQuiescence] heartbeat: records=${currentRecordCount} ` +
      `idle=${(timeSinceProgress / 1000).toFixed(0)}s ` +
      `phase=${run.current_phase_id}/${run.current_sub_phase_id ?? '-'} ` +
      `executing=${engine.executingPhaseCount} in_flight=${engine.llmCaller.inFlightCount} ` +
      `pending_decisions=${pendingCount}`,
    );
    state.lastHeartbeatAt = Date.now();
  }

  if (timeSinceProgress > opts.recordsIdleStallMs && pendingCount === 0) {
    console.warn(
      `[waitForQuiescence] Records-idle stall: no new records for ` +
      `${(timeSinceProgress / 1000).toFixed(0)}s ` +
      `(executing=${engine.executingPhaseCount}, in_flight=${engine.llmCaller.inFlightCount}). ` +
      `Treating as stuck and exiting.`,
    );
    return 'done';
  }

  if (engine.executingPhaseCount > 0 || engine.llmCaller.inFlightCount > 0) {
    state.stableCount = 0;
    return 'continue';
  }
  return 'tick';
}

async function waitForQuiescence(
  engine: OrchestratorEngine,
  db: Database,
  runId: string,
  opts: QuiescenceOptions,
): Promise<void> {
  const mockDeadline = opts.mockCapMs ? Date.now() + opts.mockCapMs : null;
  const state: QuiescenceLoopState = {
    lastSubPhase: undefined,
    stableCount: 0,
    lastRecordCount: getRecordCount(db, runId),
    lastProgressAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  };

  while (true) {
    if (mockDeadline !== null && Date.now() > mockDeadline) {
      console.warn(`[waitForQuiescence] Mock-mode cap ${(opts.mockCapMs! / 1000).toFixed(0)}s reached — exiting`);
      return;
    }

    const run = engine.stateMachine.getWorkflowRun(runId);
    if (!run) return;

    const currentRecordCount = getRecordCount(db, runId);
    if (currentRecordCount > state.lastRecordCount) {
      state.lastRecordCount = currentRecordCount;
      state.lastProgressAt = Date.now();
    }
    const pendingCount = (engine as unknown as { pendingDecisions: Map<string, unknown> }).pendingDecisions?.size ?? 0;

    const decision = evaluateQuiescenceTick(engine, run, state, currentRecordCount, pendingCount, opts);
    if (decision === 'done') return;
    if (decision === 'continue') {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    // 'tick' — graceful quiescence check: same sub-phase N times + no pending decisions.
    if (run.current_sub_phase_id === state.lastSubPhase && pendingCount === 0) {
      state.stableCount++;
      if (state.stableCount >= opts.stableThreshold) return;
    } else {
      state.stableCount = 0;
      state.lastSubPhase = run.current_sub_phase_id;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

function getRecordCount(db: Database, runId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM governed_stream WHERE workflow_run_id = ?`,
  ).get(runId) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

