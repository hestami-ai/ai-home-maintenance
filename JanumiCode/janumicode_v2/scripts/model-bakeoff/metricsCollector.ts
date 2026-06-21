/**
 * Post-run metrics extraction from a config's workspace DB.
 *
 * Everything is read from records the pipeline already writes:
 *   - executor `agent_output` rows (sub_phase_id='implementation_task_execution')
 *     carry task_id, duration_ms, exit_code, timed_out, idled_out, bytes_stdout
 *   - `task_test_result` rows from LeafTestRunner carry per-leaf pass/fail
 *   - the Phase-10 `consistency_report` artifact carries tsc_error_count etc.
 *
 * The outcome taxonomy separates infra failures (timeout/stall/context_overflow/
 * oom_suspected) from quality failures (goose_error/test_fail) so a model is
 * never blamed for an environment that fell over. tsc errors are reported at
 * config level only — Phase 10 runs `tsc --noEmit` over the whole generated
 * workspace, so individual errors aren't attributable to one task.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

import type { CandidateSpec } from './bakeoffConfig';
import type { ContextFitResult, VramSample } from './ollamaLifecycle';

export type TaskOutcome =
  | 'pass'
  | 'test_fail'
  | 'goose_error'
  | 'timeout'
  | 'stall'
  | 'context_overflow'
  | 'oom_suspected'
  | 'no_test_result';

/** Peak VRAM usage at/above this fraction of total flags oom_suspected. */
export const OOM_VRAM_FRACTION = 0.98;

export interface TaskMetric {
  taskId: string;
  outcome: TaskOutcome;
  durationMs: number;
  bytesStdout: number;
  exitCode: number | null;
  timedOut: boolean;
  idledOut: boolean;
  retryAttempts: number;
  testPassedCount: number | null;
  testFailedCount: number | null;
  errorMessage: string | null;
}

export interface ConfigMetrics {
  configSlug: string;
  modelTag: string;
  ollamaVersion: string;
  effectiveNumCtx: number | null;
  contextFit: ContextFitResult['verdict'];
  vramAfterLoadMb: number | null;
  vramPeakMb: number | null;
  vramTotalMb: number | null;
  tasks: TaskMetric[];
  taskPassRate: number | null;
  meanTaskWallMs: number | null;
  p95TaskWallMs: number | null;
  meanCharsPerSec: number | null;
  totalRetries: number;
  timeoutCount: number;
  stallCount: number;
  tscErrorCount: number | null;
  divergentDuplicateCount: number | null;
  layoutViolationCount: number | null;
  phase10OverallPass: boolean | null;
  /**
   * Language-AGNOSTIC closing-act outcome (per-stack GateCommand stabilization
   * loop): the cross-language analogue of `phase10OverallPass`/`tscErrorCount`,
   * which are TypeScript-specific. `stabilizationGatesPassed` is the headline
   * "does the generated project build + test" signal for a language sweep.
   */
  forcedStack: string | null;
  stabilizationGatesPassed: boolean | null;
  stabilizationFailingGates: string[];
  stabilizationRepairAttempts: number | null;
  /**
   * Authoritative per-run leaf rollup from the Phase-9.1 execution_summary
   * (present once the wave loop completes — with the leaf cap this is the
   * common case). These COUNTS are the headline language-comparison signal:
   * "how many leaves did model X implement successfully in language Y?".
   * null when the run did not finish Phase 9.1.
   */
  leafTasksAttempted: number | null;
  leafTasksCompleted: number | null;
  leafTasksFailed: number | null;
  leafTasksQuarantined: number | null;
  cliExitCode: number | null;
  /**
   * The model + Ollama host the EXECUTOR actually ran, read from the per-config
   * goose config.yaml (`<gooseRootDir>/config/config.yaml`). The DB can't supply
   * this — `agent_output.model` is the backing tool ('goose_cli') and the
   * `goose run` command line carries no `--model`. Lets the report verify the
   * model under test matches the candidate (`servedModelMatches`) rather than
   * trusting a label. null when the goose root wasn't provided/found.
   */
  servedModel: string | null;
  servedHost: string | null;
  servedModelMatches: boolean | null;
  notes: string[];
}

/** Read the executor's actual model + Ollama host from its goose config.yaml. */
export function readGooseServedModel(gooseRootDir: string): { model: string | null; host: string | null } {
  const cfgPath = join(gooseRootDir, 'config', 'config.yaml');
  if (!existsSync(cfgPath)) return { model: null, host: null };
  const text = readFileSync(cfgPath, 'utf-8');
  const model = /^\s*model:\s*(\S+)/m.exec(text)?.[1] ?? null;
  const host = /OLLAMA_HOST:\s*(\S+)/.exec(text)?.[1] ?? null;
  return { model, host };
}

export interface RunEnvironment {
  contextFit: ContextFitResult;
  ollamaVersion: string;
  vramAfterLoad: VramSample | null;
  vramPeak: VramSample | null;
  cliExitCode: number | null;
}

interface ExecutorOutputRow {
  task_id?: string | null;
  status?: string;
  duration_ms?: number;
  exit_code?: number | null;
  timed_out?: boolean;
  idled_out?: boolean;
  bytes_stdout?: number;
  retry_attempts?: number;
  error_message?: string | null;
}

interface TestResultRow {
  leaf_task_id?: string;
  attempt_number?: number;
  passed_count?: number;
  failed_count?: number;
  exit_code?: number | null;
  skipped_reason?: string | null;
}

/** Most recent .db under <workspace>/.janumicode/test-harness/. */
export function findWorkspaceDb(workspaceDir: string): string | null {
  const harnessDir = join(workspaceDir, '.janumicode', 'test-harness');
  if (!existsSync(harnessDir)) return null;
  const dbs = readdirSync(harnessDir)
    .filter((f) => f.endsWith('.db'))
    .map((f) => join(harnessDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return dbs[0] ?? null;
}

/**
 * Classify one task. Infra verdicts take precedence over quality verdicts:
 * a timed-out task tells us nothing about the model's code quality.
 */
export function classifyOutcome(input: {
  executor: ExecutorOutputRow | null;
  test: TestResultRow | null;
  contextFit: ContextFitResult['verdict'];
  vramPeakFraction: number | null;
}): TaskOutcome {
  if (input.contextFit === 'cpu_offload') return 'context_overflow';
  if (input.vramPeakFraction !== null && input.vramPeakFraction >= OOM_VRAM_FRACTION) return 'oom_suspected';
  if (input.executor?.timed_out) return 'timeout';
  if (input.executor?.idled_out) return 'stall';
  if (input.executor && (input.executor.status === 'error' || (input.executor.exit_code ?? 0) !== 0)) {
    return 'goose_error';
  }
  if (input.test === null) return 'no_test_result';
  if ((input.test.failed_count ?? 0) > 0) return 'test_fail';
  return 'pass';
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/**
 * Aggregate per-task and config-level metrics from the workspace DB.
 * The DB is opened read-only; pass an in-memory Database in tests.
 */
export function collectMetrics(opts: {
  db: Database.Database;
  candidate: CandidateSpec;
  env: RunEnvironment;
  /** `<outputDir>/goose-roots/<slug>` — lets the report verify the served model. */
  gooseRootDir?: string;
}): ConfigMetrics {
  const { db, candidate, env } = opts;
  const notes: string[] = [];

  // Verify the executor's actual model against the candidate (caveat: the DB
  // records the backing tool, not the model — the goose config.yaml has it).
  let servedModel: string | null = null;
  let servedHost: string | null = null;
  let servedModelMatches: boolean | null = null;
  if (opts.gooseRootDir !== undefined) {
    const served = readGooseServedModel(opts.gooseRootDir);
    servedModel = served.model;
    servedHost = served.host;
    if (servedModel !== null) {
      servedModelMatches = servedModel === candidate.modelTag;
      if (!servedModelMatches) {
        notes.push(`SERVED MODEL MISMATCH: goose config ran '${servedModel}' but candidate is '${candidate.modelTag}'`);
      }
    }
  }

  // Latest executor output per task (re-attempts supersede earlier rows).
  //
  // The executor (a CLI backing tool — goose_cli etc.) records its per-task work
  // as an `agent_invocation` (which carries `task_id` + the backing tool, under
  // a phase-9 sub_phase like `9.1`) plus a derived `agent_output` (which carries
  // the timing: duration_ms / bytes_stdout / timed_out / exit_code). The output
  // links to its invocation via the `derived_from_record_ids` column, NOT a
  // `task_id` inside the output content, and the sub_phase is `9.1` rather than
  // `implementation_task_execution`. So the per-task spine is invocation.task_id,
  // joined to the output through derived_from_record_ids.
  //
  // A legacy fallback (content.task_id on the output) is kept so direct-API
  // executor rows and the unit-test fixtures still bind.
  const executorByTask = new Map<string, ExecutorOutputRow>();

  // invocation id -> task_id, for invocations that name a task (the executor's).
  const taskByInvocationId = new Map<string, string>();
  const invRows = db
    .prepare(`SELECT id, content FROM governed_stream WHERE record_type='agent_invocation'`)
    .all() as { id: string; content: string }[];
  for (const r of invRows) {
    const c = JSON.parse(r.content) as { task_id?: string | null };
    if (typeof c.task_id === 'string' && c.task_id.length > 0) {
      taskByInvocationId.set(r.id, c.task_id);
    }
  }

  // All outputs in time order; later attempts overwrite earlier per task.
  const outputRows = db
    .prepare(
      `SELECT content, derived_from_record_ids FROM governed_stream
       WHERE record_type='agent_output' ORDER BY produced_at ASC`,
    )
    .all() as { content: string; derived_from_record_ids: string | null }[];
  for (const r of outputRows) {
    const c = JSON.parse(r.content) as ExecutorOutputRow;
    // Path A — output→invocation join (the CLI executor).
    let taskId: string | undefined;
    if (r.derived_from_record_ids) {
      try {
        const refs = JSON.parse(r.derived_from_record_ids) as string[];
        for (const ref of refs) {
          const t = taskByInvocationId.get(ref);
          if (t) { taskId = t; break; }
        }
      } catch { /* malformed ref array — ignore */ }
    }
    // Path B — legacy: task_id stamped directly on the output content.
    if (!taskId && typeof c.task_id === 'string' && c.task_id.length > 0) {
      taskId = c.task_id;
    }
    if (taskId) executorByTask.set(taskId, c);
  }
  if (executorByTask.size === 0) {
    notes.push('no per-task executor outputs resolved (no agent_invocation carried a task_id) — per-task timing unavailable');
  }

  // Latest test result per leaf task.
  const testRows = db
    .prepare(`SELECT content FROM governed_stream WHERE record_type='task_test_result' ORDER BY produced_at ASC`)
    .all() as { content: string }[];
  const testByTask = new Map<string, TestResultRow>();
  for (const r of testRows) {
    const c = JSON.parse(r.content) as TestResultRow;
    if (typeof c.leaf_task_id === 'string') testByTask.set(c.leaf_task_id, c);
  }

  const vramPeakFraction =
    env.vramPeak !== null && env.vramPeak.totalMb > 0 ? env.vramPeak.usedMb / env.vramPeak.totalMb : null;

  const taskIds = new Set<string>([...executorByTask.keys(), ...testByTask.keys()]);
  const tasks: TaskMetric[] = [...taskIds].sort().map((taskId) => {
    const executor = executorByTask.get(taskId) ?? null;
    const test = testByTask.get(taskId) ?? null;
    return {
      taskId,
      outcome: classifyOutcome({ executor, test, contextFit: env.contextFit.verdict, vramPeakFraction }),
      durationMs: executor?.duration_ms ?? 0,
      bytesStdout: executor?.bytes_stdout ?? 0,
      exitCode: executor?.exit_code ?? null,
      timedOut: executor?.timed_out ?? false,
      idledOut: executor?.idled_out ?? false,
      retryAttempts: executor?.retry_attempts ?? 0,
      testPassedCount: test?.passed_count ?? null,
      testFailedCount: test?.failed_count ?? null,
      errorMessage: executor?.error_message ?? null,
    };
  });

  // Phase-10 consistency report (may be absent when the run died early).
  const consistencyRow = db
    .prepare(
      `SELECT content FROM governed_stream
       WHERE record_type='artifact_produced' AND sub_phase_id='pre_commit_consistency_check'
       ORDER BY produced_at DESC LIMIT 1`,
    )
    .get() as { content: string } | undefined;
  let tscErrorCount: number | null = null;
  let divergentDuplicateCount: number | null = null;
  let layoutViolationCount: number | null = null;
  let phase10OverallPass: boolean | null = null;
  if (consistencyRow) {
    const c = JSON.parse(consistencyRow.content) as {
      kind?: string;
      overall_pass?: boolean;
      tsc_error_count?: number;
      divergent_duplicate_count?: number;
      layout_violation_count?: number;
    };
    if (c.kind === 'consistency_report') {
      tscErrorCount = c.tsc_error_count ?? null;
      divergentDuplicateCount = c.divergent_duplicate_count ?? null;
      layoutViolationCount = c.layout_violation_count ?? null;
      phase10OverallPass = c.overall_pass ?? null;
    }
  } else {
    notes.push('no Phase-10 consistency_report found — run likely ended before Phase 10');
  }

  // Closing-act stabilization outcome (language-agnostic build/test signal).
  const execSummaryRow = db
    .prepare(
      `SELECT content FROM governed_stream
       WHERE record_type='artifact_produced' AND sub_phase_id='implementation_task_execution'
         AND content LIKE '%execution_summary%'
       ORDER BY produced_at DESC LIMIT 1`,
    )
    .get() as { content: string } | undefined;
  let stabilizationGatesPassed: boolean | null = null;
  let stabilizationFailingGates: string[] = [];
  let stabilizationRepairAttempts: number | null = null;
  let leafTasksAttempted: number | null = null;
  let leafTasksCompleted: number | null = null;
  let leafTasksFailed: number | null = null;
  let leafTasksQuarantined: number | null = null;
  if (execSummaryRow) {
    try {
      const c = JSON.parse(execSummaryRow.content) as {
        kind?: string;
        tasks_attempted?: number;
        tasks_completed?: number;
        tasks_failed?: number;
        tasks_quarantined?: number;
        stabilization_gates_passed?: boolean;
        stabilization_residual?: { failingGateNames?: string[]; repairAttempts?: number } | null;
      };
      if (c.kind === 'execution_summary') {
        leafTasksAttempted = c.tasks_attempted ?? null;
        leafTasksCompleted = c.tasks_completed ?? null;
        leafTasksFailed = c.tasks_failed ?? null;
        leafTasksQuarantined = c.tasks_quarantined ?? null;
        stabilizationGatesPassed = c.stabilization_gates_passed ?? null;
        stabilizationFailingGates = c.stabilization_residual?.failingGateNames ?? [];
        stabilizationRepairAttempts = c.stabilization_residual?.repairAttempts ?? null;
      }
    } catch { /* malformed summary → leave null */ }
  } else {
    notes.push('no execution_summary found — run likely ended before Phase 9.1 completed');
  }

  const durations = tasks.map((t) => t.durationMs).filter((d) => d > 0).sort((a, b) => a - b);
  const meanTaskWallMs =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const throughputs = tasks
    .filter((t) => t.durationMs > 0 && t.bytesStdout > 0)
    .map((t) => t.bytesStdout / (t.durationMs / 1000));
  const judged = tasks.filter((t) => t.outcome !== 'no_test_result');

  return {
    configSlug: candidate.slug,
    modelTag: candidate.modelTag,
    ollamaVersion: env.ollamaVersion,
    effectiveNumCtx: env.contextFit.numCtx,
    contextFit: env.contextFit.verdict,
    vramAfterLoadMb: env.vramAfterLoad?.usedMb ?? null,
    vramPeakMb: env.vramPeak?.usedMb ?? null,
    vramTotalMb: env.vramPeak?.totalMb ?? env.vramAfterLoad?.totalMb ?? null,
    tasks,
    taskPassRate: judged.length > 0 ? judged.filter((t) => t.outcome === 'pass').length / judged.length : null,
    meanTaskWallMs,
    p95TaskWallMs: percentile(durations, 95),
    // Output chars/sec is a PROXY for tokens/sec (goose stream-json bytes
    // over wall time) — comparable across configs, not absolute throughput.
    meanCharsPerSec:
      throughputs.length > 0 ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length : null,
    totalRetries: tasks.reduce((a, t) => a + t.retryAttempts, 0),
    timeoutCount: tasks.filter((t) => t.timedOut).length,
    stallCount: tasks.filter((t) => t.idledOut).length,
    tscErrorCount,
    divergentDuplicateCount,
    layoutViolationCount,
    phase10OverallPass,
    forcedStack: candidate.forceStack ?? null,
    stabilizationGatesPassed,
    stabilizationFailingGates,
    stabilizationRepairAttempts,
    leafTasksAttempted,
    leafTasksCompleted,
    leafTasksFailed,
    leafTasksQuarantined,
    cliExitCode: env.cliExitCode,
    servedModel,
    servedHost,
    servedModelMatches,
    notes,
  };
}
