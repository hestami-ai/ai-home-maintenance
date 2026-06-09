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
import { rollbackToSubPhase } from '../lib/orchestrator/rollback';
import { withTraceContext } from '../lib/trace/traceContext';
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
    const code = sig === 'SIGINT' ? 130 : sig === 'SIGTERM' ? 143 : 1;
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

  let resolvedDbPath: string;
  if (config.resumeFromDb) {
    // Copy the source DB so we don't mutate the original.
    resolvedDbPath = path.join(dbDir, `resume-${Date.now()}.db`);
    fs.copyFileSync(config.resumeFromDb, resolvedDbPath);
    for (const ext of ['-wal', '-shm']) {
      const src = config.resumeFromDb + ext;
      if (fs.existsSync(src)) fs.copyFileSync(src, resolvedDbPath + ext);
    }
  } else if (config.dbPath) {
    // Explicit DB path — reuse an existing DB (a fresh workflow run is appended
    // to it) or create it. Enables cross-run scenarios (the two-run
    // semantic-supersession driver) where run 2 must SHARE run 1's DB so the
    // all_runs DMR scope sees run 1's records.
    resolvedDbPath = path.isAbsolute(config.dbPath) ? config.dbPath : path.join(dbDir, config.dbPath);
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

  // --simulate-human-decisions: in headless auto-approve runs, certify each
  // phase gate through the real approval path (phase_gate_approved + ingested
  // → `validates` edges → Authority-6 elevation) instead of advancing silently.
  // This exercises the governance machinery the DMR depends on — active
  // constraints accumulation in particular — which is otherwise dormant in
  // headless mode. Off by default.
  if (config.simulateHumanDecisions) {
    engine.setSimulateHumanDecisions(true);
  }

  // --inject-overrides: scripted prior_decision_override injections fired at
  // phase boundaries, exercising the DMR's semantic-supersession path. For a
  // cross-run chain, run twice against the same workspace DB (run 1 establishes
  // the governing record; run 2 overrides it).
  if (config.overrideInjections && config.overrideInjections.length > 0) {
    engine.setOverrideInjections(config.overrideInjections);
  }

  // --thin-slice mode: tighten every decomposition cap and limit root
  // counts so the workflow exercises every sub-phase prompt template
  // end-to-end without saturating fully. Goal: validate prompt
  // templates between full calibration runs in hours, not days.
  // Reasoning-review-on-tier-c flips to true across all four trees so
  // the audit prompt templates are also exercised. Override is applied
  // after createTestEngine so it takes precedence over any inherited
  // workspace config.
  // Operational rails — applied for BOTH thin-slice (template iteration) and
  // full-slice (real end-to-end build). These are headless-real-LLM safety
  // settings, independent of the decomposition caps (which are thin-slice only).
  if (config.thinSlice || config.fullSlice) {
    // Workflow overrides: extend the records-idle stall window. Phase 1
    // bloom prompts on qwen3.5:9b legitimately stream 200+ KB of valid
    // JSON over 4-7 minutes. The no-progress timer now catches genuine
    // hangs precisely (90s without a chunk), so the orchestrator stall
    // window only needs to exceed the worst-case retry burst on a
    // legitimately slow call. 60 min covers 3 retries at ~15 min each
    // with healthy headroom.
    engine.configManager.setWorkflowOverrides({
      records_idle_stall_ms: 3600000,
      auto_mitigation_policy: 'auto',
      // Thin-slice runs always route Phase 9 executor invocations
      // through goose_cli, overriding whatever the implementation_planner
      // chose per task. Calibration cycles need cost-bounded local
      // execution and a single executor surface to debug.
      force_executor_backing_tool: 'goose_cli',
    });

    // The no-progress timer (default 90s, env JANUMICODE_LLM_NO_PROGRESS_SECONDS)
    // is now the primary silent-hang safety net — re-armed on every
    // streaming chunk, so legitimate slow generations never trip it.
    // The wall-clock is just an outer adversarial cap. Bump it generously
    // for thin-slice (1800s = 30 min) so it never fires for valid output.
    // Operator can override by setting JANUMICODE_LLM_MAX_CALL_SECONDS
    // explicitly.
    if (!process.env.JANUMICODE_LLM_MAX_CALL_SECONDS) {
      process.env.JANUMICODE_LLM_MAX_CALL_SECONDS = '1800';
    }
  }

  // Decomposition caps — thin-slice ONLY. Full-slice decomposes the entire
  // intent (no caps) while keeping the operational rails set above.
  if (config.thinSlice) {
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

  // Live observability for live (non-mock) runs. Writes per-call .log
  // files under <workspace>/.janumicode/live/ (C8) and prints a
  // heartbeat + live tail to stdout (A1 + A3) so you can tell a
  // running call from a stalled one without opening the DB.
  const liveLogDir = path.join(workspacePath, '.janumicode', 'live');
  if (llmMode !== 'mock') {
    fs.mkdirSync(liveLogDir, { recursive: true });
    engine.llmCaller.setLiveLogDir(liveLogDir);
    // CLI parity: AgentInvoker also writes per-invocation live logs for
    // Goose / Claude Code / Gemini / Codex calls so operators can tail
    // them the same way as LLM calls.
    engine.agentInvoker.setLiveLogDir(liveLogDir);
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
    // Captured by the waitForQuiescence().then handlers below so the
    // post-loop result-shaping code can distinguish operator pause
    // from a stall or clean completion.
    let quiescenceReason: QuiescenceExitReason = 'completed';

    if (config.resumeFromDb && (config.resumeAtPhase || config.resumeAtSubPhase)) {
      // ── Resume mode: skip bootstrapIntent, advance to target phase ──
      workflowRunId = findLatestRunId(db);
      if (!workflowRunId) {
        throw new Error(`No workflow run found in resumed database: ${config.resumeFromDb}`);
      }

      // Resolve the target phase. When --resume-at-sub-phase is given,
      // look up that sub-phase's owning phase in the prior run's records.
      // The sub-phase flag takes precedence over the phase flag.
      let targetPhase: PhaseId;
      let targetSubPhase: string | null = config.resumeAtSubPhase ?? null;
      if (targetSubPhase) {
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
        targetPhase = row.phase_id as PhaseId;
      } else {
        targetPhase = config.resumeAtPhase as PhaseId;
      }

      // Roll back stale records before advancing the state machine.
      // When resuming at a sub-phase, the cutoff is the FIRST occurrence
      // of that sub-phase. When resuming only at a phase (legacy flag),
      // we'd need a phase-cutoff variant — for now we use the first
      // record of the phase as the cutoff target.
      let rollbackResult = null;
      if (targetSubPhase) {
        rollbackResult = rollbackToSubPhase(db, workflowRunId, targetSubPhase);
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
      console.log(`Resuming run ${workflowRunId} at Phase ${targetPhase}${targetSubPhase ? ` (sub-phase: ${targetSubPhase})` : ''}`);

      // Prime the LLM call cache from the prior run's persisted
      // agent_invocation + agent_output pairs. Phase handlers below the
      // resume cutoff still re-execute their pipeline (parse, normalize,
      // persist) — but any LLM call whose prompt matches the prior run
      // returns instantly from cache instead of hitting the provider.
      // The rolled-back records remain is_current_version=0 (so reads
      // see the clean upstream state) while the cache holds the
      // original outputs keyed by prompt hash. This is the single-seam
      // replacement for per-handler "skip if already done" logic.
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

      // Re-open the per-run AODD trace before emitting run.resumed.
      // The orchestrator was constructed for an existing workflow_run_id,
      // so startWorkflowRun() did not call aoddStartRun for this run id.
      aoddStartRun(workflowRunId!);
      withTraceContext(
        { workflow_run_id: workflowRunId, phase_id: targetPhase, sub_phase_id: null },
        () => {
          aoddEmit('run.resumed', { resumed_at: new Date().toISOString() });
        },
      );

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
        // We're already at or past the target phase. Reset the
        // state-machine cursor so we re-execute. is_current_version=0
        // on the rolled-back records means the phase will see clean
        // upstream + empty target-phase outputs.
        // Note: this uses the same advanceToNextPhase API but in
        // "reset" mode. If the API doesn't support backward moves,
        // we fall back to a direct DB update.
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
        mockCapMs, stableThreshold, recordsIdleStallMs, workspacePath,
      }).then((reason) => {
        quiescenceReason = reason;
        // Stall detected, paused, or workflow completed — abort any
        // in-flight LLM call so the phase promise unwinds. The
        // abortSession call is a no-op if nothing is in flight (and
        // also a no-op on a second call when the pause path already
        // aborted), so this is safe in every case.
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
        quiescenceReason = await waitForQuiescence(engine, db, workflowRunId, {
          mockCapMs: llmMode === 'mock' ? mockCapMs : null,
          stableThreshold,
          recordsIdleStallMs,
          workspacePath,
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

    // Attach the pause marker when the loop exited via the operator
    // pause-flag path so the CLI / virtuous-cycle consumer can tell
    // the difference between "run finished" and "run was paused mid-flow,
    // resume with --resume-from-db". Stall and clean-completion exits
    // leave `paused` undefined.
    if (quiescenceReason === 'paused') {
      result.paused = {
        paused_at: new Date().toISOString(),
        workflow_run_id: workflowRunId,
      };
      // Suppress the gap report on pause — the workflow isn't broken,
      // it's intentionally suspended. Surfacing a "Phase X failed"
      // gap report would mislead the operator and the virtuous-cycle
      // consumer into thinking they need to fix something before
      // resuming. The DB still has every record produced up to the
      // pause; resuming via --resume-from-db continues from there.
      result.gapReport = undefined;
    }

    // Optional LLM-grounded suggested_fix. Runs after the rule-based
    // enhancement so the prompt can reference the already-populated
    // failed_at_phase. Any failure is swallowed inside
    // generateLLMGapSuggestion — the base report is still returned.
    if (config.llmGapEnhance && result.gapReport && workflowRunId) {
      // Resolve "" sentinels from the CLI to workspace orchestrator
      // routing — keeps the literal model name in one place (config).
      const gapDefaults = engine.configManager.getRoutingModel('orchestrator');
      const suggestion = await generateLLMGapSuggestion(
        db,
        workflowRunId,
        result.gapReport,
        engine.llmCaller,
        {
          provider: config.llmGapEnhance.provider || gapDefaults.provider,
          model: config.llmGapEnhance.model || gapDefaults.model,
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

async function waitForQuiescence(
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
      // The records-idle stall path inside evaluateQuiescenceTick logs
      // its own warning and returns 'done'; surface that here as
      // 'stalled' vs the clean-completion 'completed' so callers can
      // colour the result accordingly.
      const timeSinceProgress = Date.now() - state.lastProgressAt;
      const stalled = timeSinceProgress > opts.recordsIdleStallMs && pendingCount === 0
        && run.status !== 'completed' && run.status !== 'failed' && run.status !== 'rolled_back';
      return stalled ? 'stalled' : 'completed';
    }
    if (decision === 'continue') {
      await new Promise((r) => setTimeout(r, 50));
      continue;
    }

    // 'tick' — graceful quiescence check: same sub-phase N times + no pending decisions.
    if (run.current_sub_phase_id === state.lastSubPhase && pendingCount === 0) {
      state.stableCount++;
      if (state.stableCount >= opts.stableThreshold) return 'completed';
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

