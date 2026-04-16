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
import { validateLineage, buildGapReport } from '../test/harness/lineageValidator';
import {
  FULL_WORKFLOW_EXPECTATIONS,
  validateExpectations,
} from '../test/harness/hestamiExpectations';
import { enhanceGapReport, generateLLMGapSuggestion } from '../test/harness/gapReportEnhancer';

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

    const result = collectResults(db, workflowRunId, startTime, resolvedDbPath);

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

/**
 * Collect results from the workflow run by driving the harness oracle
 * (validateLineage + validateExpectations) against the governed stream.
 *
 * A phase is "completed" only if ALL required artifacts landed AND
 * every required expectation passed — heuristic success-by-record-count
 * let real regressions slip through undetected. If the oracle finds
 * missing artifacts, the first phase that broke drives a proper
 * GapReport that names the specific required artifact, invariant, or
 * semantic assertion that didn't hold. Preferred-severity expectation
 * failures surface as SemanticWarnings but don't block.
 */
function collectResults(
  db: Database,
  workflowRunId: string | null,
  startTime: number,
  dbPath: string,
): import('../test/harness/types').HarnessResult {
  const durationMs = Date.now() - startTime;

  interface StreamRecord {
    record_type: string;
    phase_id: string | null;
    sub_phase_id: string | null;
    content: string | null;
  }
  const records: StreamRecord[] = workflowRunId
    ? db.prepare(
        `SELECT record_type, phase_id, sub_phase_id, content
         FROM governed_stream
         WHERE workflow_run_id = ?
         ORDER BY produced_at`,
      ).all(workflowRunId) as StreamRecord[]
    : [];

  // Inventory what's present, keyed by phase. Used for the artifacts
  // summary and the "furthest-seen phase" heuristic for gap locality.
  const phasesWithRecords = new Set<string>();
  const artifactsProduced: Record<string, string[]> = {};
  for (const record of records) {
    const phaseId = record.phase_id;
    if (!phaseId) continue;
    phasesWithRecords.add(phaseId);
    if (record.record_type === 'artifact_produced') {
      if (!artifactsProduced[phaseId]) artifactsProduced[phaseId] = [];
      try {
        const content = record.content ? JSON.parse(record.content) as Record<string, unknown> : {};
        const kind = (content.kind as string) ?? record.record_type;
        artifactsProduced[phaseId].push(kind);
      } catch {
        artifactsProduced[phaseId].push(record.record_type);
      }
    }
  }

  const PHASE_ORDER: PhaseId[] = ['0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  const observedPhases = PHASE_ORDER.filter((p) => phasesWithRecords.has(p));

  // Drive the oracle over every phase where we saw any activity. Each
  // phase is only counted as completed when its required_artifacts ALL
  // landed and its required expectations ALL passed. We scope
  // expectations to observed phases so phase-limited runs (e.g.
  // --phase-limit 1) don't emit false-positive semantic warnings
  // about Phases 2-10 that never ran.
  const observedPhaseSet = new Set<string>(observedPhases);
  const scopedExpectations = FULL_WORKFLOW_EXPECTATIONS.filter(
    (e) => !e.phase || observedPhaseSet.has(e.phase),
  );
  const requiredExpectationResults = workflowRunId
    ? validateExpectations(records, scopedExpectations)
    : [];
  const requiredByPhase = new Map<string, boolean>();
  for (const exp of FULL_WORKFLOW_EXPECTATIONS) {
    if (exp.severity !== 'required') continue;
    if (!exp.phase) continue;
    const result = requiredExpectationResults.find((r) => r.expectationId === exp.id);
    const passed = result?.passed ?? true;
    requiredByPhase.set(exp.phase, (requiredByPhase.get(exp.phase) ?? true) && passed);
  }

  // Lineage check across every observed phase. We don't pre-filter by
  // "completed" status because a phase partially executed is also useful
  // to validate — the gap report should point at its first missing req.
  const lineage = workflowRunId
    ? validateLineage(db, workflowRunId, observedPhases)
    : { valid: true, missingRecords: [], violations: [], assertionFailures: [] };

  // A phase is completed when:
  //   (a) it has records, AND
  //   (b) no required artifacts from its contract are missing, AND
  //   (c) every required expectation for that phase passed.
  const missingByPhase = new Map<string, number>();
  for (const m of lineage.missingRecords) {
    missingByPhase.set(m.phase, (missingByPhase.get(m.phase) ?? 0) + 1);
  }
  const phasesCompleted = observedPhases.filter((p) => {
    if ((missingByPhase.get(p) ?? 0) > 0) return false;
    if ((requiredByPhase.get(p) ?? true) === false) return false;
    return true;
  });
  const phasesFailed = observedPhases.filter((p) => !phasesCompleted.includes(p));

  // Semantic warnings come from preferred expectations that didn't pass.
  const semanticWarnings = requiredExpectationResults
    .map((r) => r.warning)
    .filter((w): w is NonNullable<typeof w> => !!w);

  // Status: success only when every phase we saw passed. If we never saw
  // Phase 10 complete, the run is partial at best.
  const allPhasesSeenPassed = observedPhases.length > 0
    && phasesFailed.length === 0
    && phasesCompleted.includes('10');
  const status: 'success' | 'partial' | 'failed' = allPhasesSeenPassed
    ? 'success'
    : phasesCompleted.length > 0 ? 'partial' : 'failed';

  // Gap report: pinned to the FIRST phase that broke (after the last
  // successful one), so the coder's next fix target is obvious.
  let gapReport: import('../test/harness/types').GapReport | undefined;
  if (status !== 'success') {
    const firstBroken = PHASE_ORDER.find((p) => phasesFailed.includes(p));
    if (firstBroken) {
      const subPhaseHint = lineage.missingRecords.find((m) => m.phase === firstBroken)?.sub_phase;
      gapReport = buildGapReport(lineage, firstBroken as PhaseId, subPhaseHint);
      if (workflowRunId) {
        // Layer in rule-based diagnostics (missing-record analysis,
        // assertion context, AI-spend summary, failsafes). LLM-driven
        // suggested-fix generation is a Stage F follow-up; the base
        // report's own suggested_fix covers the baseline direction.
        const enhanced = enhanceGapReport(db, workflowRunId, gapReport);
        gapReport = { ...gapReport, ...enhanced };
      }
    } else {
      // observedPhases is empty (no records at all). That's a pipeline
      // bootstrap failure — phase 0 is the natural point of blame.
      gapReport = buildGapReport(lineage, '0');
    }
  }

  return {
    status,
    phasesCompleted,
    phasesFailed,
    artifactsProduced,
    gapReport,
    semanticWarnings,
    durationMs,
    governedStreamPath: dbPath,
  };
}
