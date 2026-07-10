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
import { rollbackToSubPhase, resetRunCycleCounter } from '../lib/orchestrator/rollback';
import { withTraceContext } from '../lib/trace/traceContext';
import { isLocalProvider, resolveRecordsIdleStallMs } from '../lib/llm/llmTimeouts';
import {
  emit as aoddEmit,
  startRun as aoddStartRun,
} from '../lib/aodd';

// Re-export types for consumers
export type { HarnessResult, GapReport, SemanticWarning, DecisionOverride, PipelineRunnerConfig } from '../test/harness/types';

/**
 * Write a PID file containing this process's identifier + start
 * metadata to `<workspace>/.janumicode/run.pid`. Operators can reliably
 * locate and stop the workflow via:
 *
 *   kill $(jq -r .pid <workspace>/.janumicode/run.pid)
 *
 * Register handlers to remove the file on normal exit and on common
 * termination signals so a clean shutdown doesn't leave a stale file.
 * If the process is hard-killed (SIGKILL / OS reboot) the file stays;
 * the next run overwrites it on launch, which is correct because at
 * most one CLI runs per workspace by design.
 */
function writePidFile(workspacePath: string): void {
  const pidPath = path.join(workspacePath, '.janumicode', 'run.pid');
  const payload = {
    pid: process.pid,
    started_at: new Date().toISOString(),
    workspace: workspacePath,
    argv: process.argv.slice(1),
  };
  try {
    fs.writeFileSync(pidPath, JSON.stringify(payload, null, 2));
  } catch {
    // Non-fatal: best-effort. The workflow proceeds; operators just
    // fall back to the tasklist+grep heuristic if needed.
    return;
  }

  const cleanup = (): void => {
    try { fs.unlinkSync(pidPath); } catch { /* ignore */ }
  };
  // process.exit() — normal exits + explicit exits
  process.once('exit', cleanup);
  // Signal handlers must call exit() themselves; node's default is to
  // exit without firing 'exit'. Re-emit by calling process.exit(0) after
  // cleanup so the 'exit' handler also runs (idempotent unlink).
  const signalHandler = (sig: NodeJS.Signals): void => {
    cleanup();
    // Re-raise the default behavior by calling exit with conventional 128+signo
    let code = 1;
    if (sig === 'SIGINT') code = 130;
    else if (sig === 'SIGTERM') code = 143;
    process.exit(code);
  };
  process.once('SIGINT', signalHandler);
  process.once('SIGTERM', signalHandler);
}

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

  // PID file: write our process id + metadata to `.janumicode/run.pid` so
  // operators can reliably identify and stop the workflow without
  // depending on `tasklist | grep node` heuristics. The file is removed
  // on clean exit (including SIGINT/SIGTERM); a stale file on next run
  // is overwritten — we don't assert orphan-process behavior here.
  writePidFile(workspacePath);

  const resolvedDbPath = resolveRunDbPath(config, dbDir);

  const realOrCapture = config.captureFixtures ? 'capture' : 'real';
  const llmMode = config.llmMode === 'real' ? realOrCapture : 'mock';

  const te = await createTestEngine({
    dbPath: resolvedDbPath,
    extensionPath,
    workspacePath,
    autoApprove: config.autoApprove,
    fixtureDir: config.fixtureDir,
    llmMode,
  });
  const { engine, liaison, db, mockLLM, embedding } = te;

  applyEngineRunModeFlags(engine, config);

  configureTimeoutRails(engine, config);
  applyDecompositionCaps(engine, config);

  const liveLogDir = configureLiveObservability(engine, workspacePath, llmMode);
  const detachMonitor = llmMode !== 'mock'
    ? attachLiveMonitor(engine.eventBus, liveLogDir)
    : null;

  try {
    // Both branches below assign these; quiescenceReason lets the
    // post-loop result-shaping distinguish operator pause from a stall
    // or clean completion.
    let workflowRunId: string | null;
    let quiescenceReason: QuiescenceExitReason;

    if (config.resumeFromDb && (config.resumeAtPhase || config.resumeAtSubPhase)) {
      const out = await runResumeMode(engine, db, config, workspacePath, llmMode);
      workflowRunId = out.workflowRunId;
      quiescenceReason = out.quiescenceReason;
    } else {
      const out = await runNormalMode(
        engine, liaison, embedding, db, config,
        { intent, workspacePath, extensionPath, llmMode },
      );
      workflowRunId = out.workflowRunId;
      quiescenceReason = out.quiescenceReason;
    }

    await maybeSaveCapturedFixtures(mockLLM, engine, config, llmMode, repoRoot);

    const result = collectHarnessResult(db, workflowRunId, {
      dbPath: resolvedDbPath,
      startTimeMs: startTime,
    });

    applyPauseMarker(result, quiescenceReason, workflowRunId);

    await maybeApplyLlmGapEnhancement(result, config, engine, db, workflowRunId);

    return result;
  } finally {
    detachMonitor?.();
    te.cleanup();
  }
}

// ── runPipeline sub-steps (extracted to keep runPipeline's cognitive
//    complexity within bounds; all are behavior-preserving) ─────────────

type RunnerConfig = import('../test/harness/types').PipelineRunnerConfig;
type RunnerResult = import('../test/harness/types').HarnessResult;
type LiveLLMMode = 'mock' | 'real' | 'capture';

/**
 * Resolve the governed_stream DB path for this run: copy-and-use a resume
 * source, reuse an explicit path (absolute or relative to the harness
 * dir), or mint a fresh timestamped DB. `fsImpl` is injectable so unit
 * tests can pin each branch without touching disk (mirrors
 * detectAndConsumePauseFlag).
 */
export function resolveRunDbPath(
  config: RunnerConfig,
  dbDir: string,
  fsImpl: Pick<typeof fs, 'copyFileSync' | 'existsSync'> = fs,
): string {
  if (config.resumeFromDb) {
    // Copy the source DB so we don't mutate the original.
    const resolved = path.join(dbDir, `resume-${Date.now()}.db`);
    fsImpl.copyFileSync(config.resumeFromDb, resolved);
    for (const ext of ['-wal', '-shm']) {
      const src = config.resumeFromDb + ext;
      if (fsImpl.existsSync(src)) fsImpl.copyFileSync(src, resolved + ext);
    }
    return resolved;
  }
  if (config.dbPath) {
    // Explicit DB path — reuse an existing DB (a fresh workflow run is
    // appended) or create it. Enables cross-run scenarios (the two-run
    // semantic-supersession driver) where run 2 must SHARE run 1's DB so
    // the all_runs DMR scope sees run 1's records.
    return path.isAbsolute(config.dbPath) ? config.dbPath : path.join(dbDir, config.dbPath);
  }
  return path.join(dbDir, `${Date.now()}.db`);
}

/**
 * Apply the run-mode engine flags parsed from CLI config: phase limit,
 * simulate-human-decisions gate certification, and scripted override
 * injections. Order preserved from the original inline sequence.
 */
function applyEngineRunModeFlags(engine: OrchestratorEngine, config: RunnerConfig): void {
  // --phase-limit: stop the engine's auto-advance loop after the named phase.
  if (config.phaseLimit) {
    engine.setPhaseLimit(config.phaseLimit as PhaseId);
  }
  // --simulate-human-decisions: certify each phase gate through the real
  // approval path instead of advancing silently (exercises DMR governance).
  if (config.simulateHumanDecisions) {
    engine.setSimulateHumanDecisions(true);
  }
  // --inject-overrides: scripted prior_decision_override injections fired at
  // phase boundaries (DMR semantic-supersession path).
  if (config.overrideInjections && config.overrideInjections.length > 0) {
    engine.setOverrideInjections(config.overrideInjections);
  }
}

/**
 * Configure the headless operational timeout rails. Slice modes (thin OR
 * full) extend the records-idle stall window, force a single Phase-9
 * executor surface, and bump the per-call wall-clock; non-slice runs get a
 * model-aware records-idle floor. The two branches are mutually exclusive
 * by construction, matching the original inline behavior.
 */
function configureTimeoutRails(engine: OrchestratorEngine, config: RunnerConfig): void {
  if (config.thinSlice || config.fullSlice) {
    // Extend the records-idle stall window (slow legitimate streams) and pin
    // a single Phase-9 executor so calibration cycles are debuggable.
    engine.configManager.setWorkflowOverrides({
      records_idle_stall_ms: 3600000,
      auto_mitigation_policy: 'auto',
      force_executor_backing_tool:
        (process.env.JANUMICODE_EXECUTOR_BACKING_TOOL as
          | 'mimo_cli' | 'goose_cli' | 'claude_code_cli' | 'gemini_cli' | 'codex_cli' | 'direct_llm_api'
          | undefined) ?? 'mimo_cli',
    });
    // Bump the outer per-call wall-clock cap generously (30 min) unless the
    // operator set it explicitly; the no-progress timer is the primary net.
    if (!process.env.JANUMICODE_LLM_MAX_CALL_SECONDS) {
      process.env.JANUMICODE_LLM_MAX_CALL_SECONDS = '1800';
    }
  }

  // Records-idle session-stall generalization (NOT slice-gated). Extend the
  // model-aware floor to ANY run that routes a role to a local model so the
  // session watchdog never undercuts a slow local call's wall-clock. See
  // llmTimeouts.resolveRecordsIdleStallMs.
  if (!config.thinSlice && !config.fullSlice) {
    const routes = Object.values(engine.llmRouting ?? {}) as Array<{ primary?: { provider?: string } }>;
    const usesLocalModels = routes.some(r => isLocalProvider(r?.primary?.provider));
    engine.configManager.setWorkflowOverrides({
      records_idle_stall_ms: resolveRecordsIdleStallMs(usesLocalModels),
    });
  }
}

/**
 * Apply the thin-slice decomposition caps. Full-slice decomposes the
 * entire intent (no caps) while keeping the operational rails above.
 */
function applyDecompositionCaps(engine: OrchestratorEngine, config: RunnerConfig): void {
  if (!config.thinSlice) return;
  engine.configManager.setDecompositionOverrides({
    depth_cap: 2,
    budget_cap: 30,
    fanout_cap: 1,
    max_root_count_fr: 2,
    max_root_count_nfr: 2,
    reasoning_review_on_tier_c: true,
    component_depth_cap: 2,
    component_budget_cap: 15,
    component_fanout_cap: 2,
    component_reasoning_review_on_tier_c: true,
    task_depth_cap: 2,
    task_budget_cap: 20,
    task_fanout_cap: 2,
    task_reasoning_review_on_tier_c: true,
    data_model_depth_cap: 2,
    data_model_budget_cap: 15,
    data_model_fanout_cap: 2,
    data_model_reasoning_review_on_tier_c: true,
    test_depth_cap: 2,
    test_budget_cap: 20,
    test_fanout_cap: 2,
    test_reasoning_review_on_tier_c: true,
  });
}

/**
 * Real-mode routing overrides from env vars: steer the Orchestrator,
 * Domain Interpreter, and Requirements Agent roles to specific CLI
 * backings without editing config.json. Unset → role keeps DEFAULT_CONFIG.
 */
function applyRealModeRoutingOverrides(engine: OrchestratorEngine): void {
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

/**
 * Configure live observability for non-mock runs: per-call .log files
 * under <workspace>/.janumicode/live, CLI parser registration, and env-var
 * routing overrides. Returns the live-log directory (computed in every mode
 * so the caller can wire attachLiveMonitor when non-mock).
 */
function configureLiveObservability(
  engine: OrchestratorEngine,
  workspacePath: string,
  llmMode: LiveLLMMode,
): string {
  const liveLogDir = path.join(workspacePath, '.janumicode', 'live');
  if (llmMode === 'mock') return liveLogDir;
  fs.mkdirSync(liveLogDir, { recursive: true });
  engine.llmCaller.setLiveLogDir(liveLogDir);
  // CLI parity: AgentInvoker also writes per-invocation live logs.
  engine.agentInvoker.setLiveLogDir(liveLogDir);
  // Real-mode runs spawn the coding-agent subprocess for Phase 9. Mock mode
  // deliberately skips this so fixture-only tests fail fast instead of hanging.
  engine.registerBuiltinCLIParsers();
  applyRealModeRoutingOverrides(engine);
  return liveLogDir;
}

/**
 * Resolve the resume target phase (and optional sub-phase). The sub-phase
 * flag takes precedence; when given, look up its owning phase in the prior
 * run's records and throw if none exist.
 */
function resolveResumeTarget(
  db: Database,
  config: RunnerConfig,
  workflowRunId: string,
): { targetPhase: PhaseId; targetSubPhase: string | null } {
  const targetSubPhase: string | null = config.resumeAtSubPhase ?? null;
  if (!targetSubPhase) {
    return { targetPhase: config.resumeAtPhase as PhaseId, targetSubPhase: null };
  }
  const row = db.prepare(`
    SELECT phase_id FROM governed_stream
     WHERE workflow_run_id = ? AND sub_phase_id = ?
     ORDER BY produced_at ASC LIMIT 1
  `).get(workflowRunId, targetSubPhase) as { phase_id: string | null } | undefined;
  if (!row?.phase_id) {
    throw new Error(
      `Could not resolve phase for sub_phase_id="${targetSubPhase}" — no records found in the prior run`,
    );
  }
  return { targetPhase: row.phase_id as PhaseId, targetSubPhase };
}

/**
 * Roll back stale records at-or-after the FIRST occurrence of the resume
 * sub-phase before advancing the state machine. No-op (and no rollback) for
 * a phase-only resume. Throws if the sub-phase has no current-version
 * records in the prior run.
 */
function performResumeRollback(
  db: Database,
  workflowRunId: string,
  targetSubPhase: string | null,
): void {
  if (!targetSubPhase) return;
  const rollbackResult = rollbackToSubPhase(db, workflowRunId, targetSubPhase);
  if (!rollbackResult.cutoff_produced_at) {
    throw new Error(
      `Sub-phase "${targetSubPhase}" has no current-version records in the prior run; cannot resume from there.`,
    );
  }
  console.log(
    `[resume] Rolled back ${rollbackResult.rolled_back_count} stale records ` +
    `(preserved ${rollbackResult.preserved_count} immutable history). ` +
    `Cutoff: ${rollbackResult.cutoff_produced_at}`,
  );
}

/**
 * Prime the LLM-call cache from the prior run's persisted invocation /
 * output pairs so re-executed phases replay cached calls instead of hitting
 * the provider. Non-fatal on failure (calls just re-execute).
 */
function primeResumeCache(engine: OrchestratorEngine, db: Database, workflowRunId: string): void {
  try {
    const cacheStats = engine.llmCaller.loadCacheFromDb(db, workflowRunId);
    console.log(
      `[resume] LLM-call cache primed: ${cacheStats.entries} entries ` +
      `(scanned ${cacheStats.scanned} invocations, skipped ${cacheStats.skipped})`,
    );
  } catch (err) {
    console.warn(
      `[resume] LLM-call cache prime failed (non-fatal — calls will re-execute): ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Move the state-machine cursor to the resume target. Forward moves step
 * through each adjacent phase (the only transitions the state machine
 * allows); if we're already at/past the target, reset the cursor via a
 * direct DB update so the phase re-executes against clean upstream state.
 */
function advanceToResumeTarget(
  engine: OrchestratorEngine,
  db: Database,
  workflowRunId: string,
  targetPhase: PhaseId,
): void {
  const { PHASE_ORDER: phaseOrder } = require('../lib/types/records');
  const run = engine.stateMachine.getWorkflowRun(workflowRunId);
  const currentIdx = phaseOrder.indexOf(run?.current_phase_id);
  const targetIdx = phaseOrder.indexOf(targetPhase);
  if (currentIdx >= 0 && targetIdx > currentIdx) {
    for (let i = currentIdx + 1; i <= targetIdx; i++) {
      engine.advanceToNextPhase(workflowRunId, phaseOrder[i]);
    }
    return;
  }
  if (run?.current_phase_id === targetPhase) return;
  // We're already at or past the target phase — reset the state-machine
  // cursor so we re-execute against clean (is_current_version=0) upstream.
  try {
    db.prepare(`UPDATE workflow_runs SET current_phase_id = ? WHERE id = ?`)
      .run(targetPhase, workflowRunId);
    console.log(`[resume] Reset current_phase_id to ${targetPhase} (state machine cursor moved backward)`);
  } catch (err) {
    throw new Error(
      `Could not reset to Phase ${targetPhase}. Current: ${run?.current_phase_id}. ` +
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Race the resumed phase execution against waitForQuiescence with a session
 * AbortController, then give the losing side ~3s to unwind (HTTP abort →
 * saturation-loop catch → supersession write). Returns the quiescence exit
 * reason captured from the watchdog.
 */
async function raceResumeExecution(
  engine: OrchestratorEngine,
  db: Database,
  workflowRunId: string,
  workspacePath: string,
  llmMode: LiveLLMMode,
): Promise<QuiescenceExitReason> {
  const abortController = new AbortController();
  engine.setSessionAbortController(abortController);

  const mockCapMs = llmMode === 'mock' ? 10000 : null;
  const stableThreshold = llmMode === 'mock' ? 3 : 100;
  const recordsIdleStallMs = engine.configManager.get().workflow.records_idle_stall_ms;
  let quiescenceReason: QuiescenceExitReason = 'completed';
  const phasePromise = engine.executeCurrentPhase(workflowRunId)
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[resume] Phase execution ended: ${msg}`);
    });
  const quiescencePromise = waitForQuiescence(engine, db, workflowRunId, {
    mockCapMs, stableThreshold, recordsIdleStallMs, workspacePath,
  }).then((reason) => {
    quiescenceReason = reason;
    // Abort any in-flight LLM call so the phase promise unwinds. No-op when
    // nothing is in flight, and idempotent on a second call.
    engine.abortSession('waitForQuiescence exited (stall or completion)');
  });
  await Promise.race([phasePromise, quiescencePromise]);
  // After race wins, give the other side ~3 seconds to unwind.
  await Promise.race([
    Promise.all([phasePromise, quiescencePromise]),
    new Promise<void>((r) => setTimeout(r, 3000)),
  ]);
  return quiescenceReason;
}

/**
 * Resume mode: skip bootstrapIntent and re-execute from a target phase /
 * sub-phase in a copied prior-run DB. Returns the workflow run id and the
 * quiescence exit reason.
 */
async function runResumeMode(
  engine: OrchestratorEngine,
  db: Database,
  config: RunnerConfig,
  workspacePath: string,
  llmMode: LiveLLMMode,
): Promise<{ workflowRunId: string; quiescenceReason: QuiescenceExitReason }> {
  const workflowRunId = findLatestRunId(db);
  if (!workflowRunId) {
    throw new Error(`No workflow run found in resumed database: ${config.resumeFromDb}`);
  }

  const { targetPhase, targetSubPhase } = resolveResumeTarget(db, config, workflowRunId);

  performResumeRollback(db, workflowRunId, targetSubPhase);

  // Optionally clear the cycle counter so resumed phases run their FULL
  // execute() path (full regeneration + gatekeepers) instead of the
  // packet-synthesis-failure cycle-delta path.
  if (config.resumeResetCycles) {
    const priorCycle = resetRunCycleCounter(db, workflowRunId);
    console.log(`[resume] Reset current_cycle_number ${priorCycle}→0 (phases run full re-execution, not cycle-delta)`);
  }
  const subPhaseSuffix = targetSubPhase ? ` (sub-phase: ${targetSubPhase})` : '';
  console.log(`Resuming run ${workflowRunId} at Phase ${targetPhase}${subPhaseSuffix}`);

  primeResumeCache(engine, db, workflowRunId);

  // Re-open the per-run AODD trace before emitting run.resumed. The
  // orchestrator was constructed for an existing workflow_run_id, so
  // startWorkflowRun() did not call aoddStartRun for this run id.
  aoddStartRun(workflowRunId);
  withTraceContext(
    { workflow_run_id: workflowRunId, phase_id: targetPhase, sub_phase_id: null },
    () => {
      aoddEmit('run.resumed', { resumed_at: new Date().toISOString() });
    },
  );

  advanceToResumeTarget(engine, db, workflowRunId, targetPhase);

  const quiescenceReason = await raceResumeExecution(engine, db, workflowRunId, workspacePath, llmMode);
  return { workflowRunId, quiescenceReason };
}

/**
 * Normal mode: bootstrap the intent through the headless liaison adapter,
 * then wait for quiescence. Returns the workflow run id and quiescence exit
 * reason.
 */
async function runNormalMode(
  engine: OrchestratorEngine,
  liaison: import('../lib/agents/clientLiaisonAgent').ClientLiaisonAgent,
  embedding: import('../lib/embedding/embeddingService').EmbeddingService,
  db: Database,
  config: RunnerConfig,
  ctx: {
    intent: string;
    workspacePath: string;
    extensionPath: string;
    llmMode: LiveLLMMode;
  },
): Promise<{ workflowRunId: string | null; quiescenceReason: QuiescenceExitReason }> {
  const { intent, workspacePath, extensionPath, llmMode } = ctx;
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
  const workflowRunId = result.workflowRunId;

  // Session abort: plumb a controller so stall detection can cancel any
  // in-flight LLM call (same pattern as resume mode). No wall-clock cap in
  // real mode — mock mode retains a short safety cap.
  const abortController = new AbortController();
  engine.setSessionAbortController(abortController);
  const mockCapMs = 10000;
  const stableThreshold = llmMode === 'mock' ? 3 : 100;
  const recordsIdleStallMs = engine.configManager.get().workflow.records_idle_stall_ms;
  let quiescenceReason: QuiescenceExitReason = 'completed';
  if (workflowRunId) {
    quiescenceReason = await waitForQuiescence(engine, db, workflowRunId, {
      mockCapMs: llmMode === 'mock' ? mockCapMs : null,
      stableThreshold,
      recordsIdleStallMs,
      workspacePath,
    });
    engine.abortSession('waitForQuiescence exited (stall or completion)');
  }
  return { workflowRunId, quiescenceReason };
}

/**
 * Save captured LLM fixtures when running in capture mode with recorded
 * calls. No-op otherwise (guard preserves the original short-circuit: the
 * captured-calls count is only read when the mode is 'capture').
 */
async function maybeSaveCapturedFixtures(
  mockLLM: import('../test/helpers/mockLLMProvider').MockLLMProvider,
  engine: OrchestratorEngine,
  config: RunnerConfig,
  llmMode: LiveLLMMode,
  repoRoot: string,
): Promise<void> {
  if (llmMode !== 'capture' || mockLLM.getCapturedCalls().length === 0) return;
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

/**
 * Attach the operator-pause marker to the result when the loop exited via
 * the pause-flag path, and suppress the gap report (the workflow isn't
 * broken, just suspended — resume via --resume-from-db).
 */
function applyPauseMarker(
  result: RunnerResult,
  quiescenceReason: QuiescenceExitReason,
  workflowRunId: string | null,
): void {
  if (quiescenceReason !== 'paused') return;
  result.paused = {
    paused_at: new Date().toISOString(),
    workflow_run_id: workflowRunId,
  };
  result.gapReport = undefined;
}

/**
 * Optional LLM-grounded suggested_fix for the gap report. Runs after the
 * rule-based enhancement; any failure is swallowed inside
 * generateLLMGapSuggestion so the base report is still returned. `gapReport`
 * is captured before the await so the reference (and its mutation) survives.
 */
async function maybeApplyLlmGapEnhancement(
  result: RunnerResult,
  config: RunnerConfig,
  engine: OrchestratorEngine,
  db: Database,
  workflowRunId: string | null,
): Promise<void> {
  const gapEnhance = config.llmGapEnhance;
  const gapReport = result.gapReport;
  if (!gapEnhance || !gapReport || !workflowRunId) return;
  // Resolve "" sentinels from the CLI to workspace orchestrator routing —
  // keeps the literal model name in one place (config).
  const gapDefaults = engine.configManager.getRoutingModel('orchestrator');
  const suggestion = await generateLLMGapSuggestion(
    db,
    workflowRunId,
    gapReport,
    engine.llmCaller,
    {
      provider: gapEnhance.provider || gapDefaults.provider,
      model: gapEnhance.model || gapDefaults.model,
    },
  );
  if (suggestion) {
    gapReport.llm_suggested_fix = suggestion;
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
    const buf = state.recentTail + text.replaceAll('\n', '·');
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
  /**
   * Workspace root. When set, the loop watches for the operator
   * pause-flag file at `<workspace>/.janumicode/PAUSE_REQUESTED` and
   * triggers a clean abort if it appears mid-run. Optional — when
   * unset (e.g. some unit tests), pause detection is skipped.
   */
  workspacePath?: string;
}

/** Outcome of a single waitForQuiescence call. Surfaces back through
 *  runPipeline so the caller can distinguish the records-idle stall
 *  exit (operational issue) from the operator-initiated pause exit
 *  (intentional, resumable). 'completed' covers both true completion
 *  and graceful quiescence. */
export type QuiescenceExitReason = 'completed' | 'stalled' | 'paused';

/**
 * Pause-flag detector — extracted so the unit test can mock the fs
 * calls without spinning up the whole runner. Returns true iff the
 * `<workspace>/.janumicode/PAUSE_REQUESTED` flag exists; on detection,
 * deletes the flag and writes a `PAUSED_AT` marker so a subsequent
 * `--resume-from-db` doesn't re-trigger the pause and the operator has
 * a record of when the pause landed.
 */
export function detectAndConsumePauseFlag(
  workspacePath: string,
  workflowRunId: string | null,
  fsImpl: { existsSync: typeof fs.existsSync; unlinkSync: typeof fs.unlinkSync; writeFileSync: typeof fs.writeFileSync; mkdirSync: typeof fs.mkdirSync } = fs,
): boolean {
  const flagDir = path.join(workspacePath, '.janumicode');
  const flagPath = path.join(flagDir, 'PAUSE_REQUESTED');
  if (!fsImpl.existsSync(flagPath)) return false;
  try {
    fsImpl.unlinkSync(flagPath);
  } catch {
    // Best-effort — if the unlink fails, the next tick will re-detect
    // the flag and try again. Either way the abort path still runs.
  }
  try {
    fsImpl.mkdirSync(flagDir, { recursive: true });
    fsImpl.writeFileSync(
      path.join(flagDir, 'PAUSED_AT'),
      JSON.stringify(
        { workflow_run_id: workflowRunId, paused_at: new Date().toISOString() },
        null,
        2,
      ),
    );
  } catch {
    // Marker write is informational; failure shouldn't block the pause.
  }
  return true;
}

/** Reason string passed to abortSession when the operator pause-flag
 *  fires. Exported so tests can assert on the exact reason and the
 *  result-printer can recognise the pause case versus a stall abort. */
export const PAUSE_ABORT_REASON = 'operator paused via PAUSE_REQUESTED flag';

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

/**
 * Top-of-loop exit signals for {@link waitForQuiescence}: the mock-mode
 * wall-clock cap and the operator pause-flag. Returns the exit reason to
 * surface, or null to keep polling. Extracted to keep waitForQuiescence's
 * cognitive complexity within bounds; the side effects (warn log,
 * pause-flag consumption, session abort) fire in the same order as when
 * these checks lived inline at the top of the loop body.
 */
function checkLoopExitSignals(
  engine: OrchestratorEngine,
  opts: QuiescenceOptions,
  mockDeadline: number | null,
  runId: string,
): QuiescenceExitReason | null {
  if (mockDeadline !== null && Date.now() > mockDeadline) {
    console.warn(`[waitForQuiescence] Mock-mode cap ${(opts.mockCapMs! / 1000).toFixed(0)}s reached — exiting`);
    return 'completed';
  }

  // Operator pause-flag check. Cheap fs.existsSync per tick; a no-op
  // when the flag is absent. When present we abort the session so any
  // in-flight ollama call unwinds, then exit with 'paused' so the
  // CLI prints a marker and exit cleanly. The existing
  // --resume-from-db path picks the run up where it left off.
  if (opts.workspacePath && detectAndConsumePauseFlag(opts.workspacePath, runId)) {
    console.warn('[waitForQuiescence] PAUSE_REQUESTED flag detected — aborting session');
    engine.abortSession(PAUSE_ABORT_REASON);
    return 'paused';
  }

  return null;
}

/**
 * Map an evaluateQuiescenceTick 'done' decision to the concrete exit
 * reason. The records-idle stall path inside evaluateQuiescenceTick logs
 * its own warning and returns 'done'; surface that here as 'stalled' vs
 * the clean-completion 'completed' so callers can colour the result
 * accordingly.
 */
function classifyDoneReason(
  run: { status: string; current_phase_id: string | null; current_sub_phase_id: string | null },
  state: QuiescenceLoopState,
  opts: QuiescenceOptions,
  pendingCount: number,
): QuiescenceExitReason {
  const timeSinceProgress = Date.now() - state.lastProgressAt;
  const stalled = timeSinceProgress > opts.recordsIdleStallMs && pendingCount === 0
    && run.status !== 'completed' && run.status !== 'failed' && run.status !== 'rolled_back';
  return stalled ? 'stalled' : 'completed';
}

/**
 * Graceful-quiescence check for the 'tick' decision: the run is idle (no
 * phase executing, no LLM in flight), so count consecutive polls at the
 * same sub-phase with no pending decisions. Mutates `state` in place and
 * returns true once the stable-count threshold is reached (the caller
 * then returns 'completed').
 */
function applyGracefulTick(
  run: { status: string; current_phase_id: string | null; current_sub_phase_id: string | null },
  state: QuiescenceLoopState,
  opts: QuiescenceOptions,
  pendingCount: number,
): boolean {
  if (run.current_sub_phase_id === state.lastSubPhase && pendingCount === 0) {
    state.stableCount++;
    if (state.stableCount >= opts.stableThreshold) return true;
  } else {
    state.stableCount = 0;
    state.lastSubPhase = run.current_sub_phase_id;
  }
  return false;
}

export async function waitForQuiescence(
  engine: OrchestratorEngine,
  db: Database,
  runId: string,
  opts: QuiescenceOptions,
): Promise<QuiescenceExitReason> {
  const mockDeadline = opts.mockCapMs ? Date.now() + opts.mockCapMs : null;
  const state: QuiescenceLoopState = {
    lastSubPhase: undefined,
    stableCount: 0,
    lastRecordCount: getRecordCount(db, runId),
    lastProgressAt: Date.now(),
    lastHeartbeatAt: Date.now(),
  };

  while (true) {
    const exitSignal = checkLoopExitSignals(engine, opts, mockDeadline, runId);
    if (exitSignal) return exitSignal;

    const run = engine.stateMachine.getWorkflowRun(runId);
    if (!run) return 'completed';

    const currentRecordCount = getRecordCount(db, runId);
    if (currentRecordCount > state.lastRecordCount) {
      state.lastRecordCount = currentRecordCount;
      state.lastProgressAt = Date.now();
    }
    const pendingCount = (engine as unknown as { pendingDecisions: Map<string, unknown> }).pendingDecisions?.size ?? 0;

    const decision = evaluateQuiescenceTick(engine, run, state, currentRecordCount, pendingCount, opts);
    if (decision === 'done') {
      return classifyDoneReason(run, state, opts, pendingCount);
    }
    if (decision === 'continue') {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    // 'tick' — graceful quiescence check: same sub-phase N times + no pending decisions.
    if (applyGracefulTick(run, state, opts, pendingCount)) return 'completed';
    await new Promise((r) => setTimeout(r, 50));
  }
}

function getRecordCount(db: Database, runId: string): number {
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM governed_stream WHERE workflow_run_id = ?`,
  ).get(runId) as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

