/**
 * Harness result collector — reads the governed_stream DB for a
 * completed (or partial) workflow run and produces the canonical
 * `HarnessResult` the CLI + extension host test hooks both emit.
 *
 * Extracted from cli/runner.ts so the in-extension harness test
 * (src/test/e2e/harness-suite/*) can build the same report shape as
 * the headless CLI runner — without that, the virtuous cycle would
 * have two parallel result formats, one per entry point, and a
 * coding agent reading the output would need to branch on the source.
 */

import type { Database } from '../../lib/database/init';
import { iterateGovernedStream } from '../../lib/database/iterateGovernedStream';
import type { PhaseId } from '../../lib/types/records';
import { validateLineage, buildGapReport, type LineageValidationResult } from './lineageValidator';
import { FULL_WORKFLOW_EXPECTATIONS, validateExpectations, type ExpectationResult } from './hestamiExpectations';
import { enhanceGapReport } from './gapReportEnhancer';
import type { HarnessResult, GapReport } from './types';

const PHASE_ORDER: PhaseId[] = ['0', '0.5', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export interface CollectResultsOptions {
  /** Absolute path to the governed_stream DB (included verbatim in result). */
  dbPath: string;
  /**
   * Wall-clock milliseconds at workflow start. The result's `durationMs`
   * is `Date.now() - startTimeMs`. Pass `Date.now()` on a fresh run or
   * the stored `workflow_runs.initiated_at` epoch on a post-hoc collect.
   */
  startTimeMs: number;
}

interface StreamRecord {
  record_type: string;
  phase_id: string | null;
  sub_phase_id: string | null;
  content: string | null;
}

/**
 * Drive the harness oracle (validateLineage + validateExpectations)
 * against the governed_stream and produce a `HarnessResult` that
 * matches the CLI's `--json` output byte-for-byte when given the
 * same inputs. A phase is "completed" only when ALL its required
 * artifacts landed AND every required expectation passed —
 * heuristic success-by-record-count let real regressions slip
 * through undetected before this change.
 */
export function collectHarnessResult(
  db: Database,
  workflowRunId: string | null,
  opts: CollectResultsOptions,
): HarnessResult {
  const durationMs = Date.now() - opts.startTimeMs;

  const records: StreamRecord[] = workflowRunId ? fetchStreamRecords(db, workflowRunId) : [];

  // Inventory what's present, keyed by phase.
  const { phasesWithRecords, artifactsProduced } = inventoryArtifacts(records);

  const observedPhases = PHASE_ORDER.filter((p) => phasesWithRecords.has(p));
  const observedPhaseSet = new Set<string>(observedPhases);
  const scopedExpectations = FULL_WORKFLOW_EXPECTATIONS.filter(
    (e) => !e.phase || observedPhaseSet.has(e.phase),
  );
  const requiredExpectationResults = workflowRunId
    ? validateExpectations(records, scopedExpectations)
    : [];

  const requiredByPhase = computeRequiredByPhase(requiredExpectationResults);

  const lineage: LineageValidationResult = workflowRunId
    ? validateLineage(db, workflowRunId, observedPhases)
    : { valid: true, missingRecords: [], violations: [], assertionFailures: [], gaps: [] };

  const missingByPhase = computeMissingByPhase(lineage.missingRecords);
  const phasesCompleted = computePhasesCompleted(observedPhases, missingByPhase, requiredByPhase);
  const phasesFailed = observedPhases.filter((p) => !phasesCompleted.includes(p));

  const semanticWarnings = requiredExpectationResults
    .map((r) => r.warning)
    .filter((w): w is NonNullable<typeof w> => !!w);

  const status = computeStatus(observedPhases, phasesCompleted, phasesFailed);

  const gapReport = status !== 'success'
    ? buildResultGapReport(db, workflowRunId, lineage, phasesFailed)
    : undefined;

  return {
    status,
    phasesCompleted,
    phasesFailed,
    artifactsProduced,
    gapReport,
    semanticWarnings,
    durationMs,
    governedStreamPath: opts.dbPath,
  };
}

/**
 * Paginate via the shared `iterateGovernedStream` helper to stay under
 * the 32MB SharedArrayBuffer ceiling enforced by the sidecar RPC bridge
 * (cal-25 had ~6800 records).
 */
function fetchStreamRecords(db: Database, workflowRunId: string): StreamRecord[] {
  const records: StreamRecord[] = [];
  const stmt = db.prepare(
    `SELECT record_type, phase_id, sub_phase_id, content
       FROM governed_stream
       WHERE workflow_run_id = ?
       ORDER BY produced_at, id
       LIMIT ? OFFSET ?`,
  );
  for (const batch of iterateGovernedStream<StreamRecord>(stmt, [workflowRunId], { pageSize: 500 })) {
    for (const r of batch) records.push(r);
  }
  return records;
}

interface ArtifactInventory {
  phasesWithRecords: Set<string>;
  artifactsProduced: Record<string, string[]>;
}

/**
 * Resolve the `content.kind` for an `artifact_produced` record, falling
 * back to the record_type when the content is absent, unparseable, or
 * carries no `kind` field.
 */
function extractArtifactKind(content: string | null, fallback: string): string {
  try {
    const parsed = content ? JSON.parse(content) as Record<string, unknown> : {};
    return (parsed.kind as string) ?? fallback;
  } catch {
    return fallback;
  }
}

function inventoryArtifacts(records: StreamRecord[]): ArtifactInventory {
  const phasesWithRecords = new Set<string>();
  const artifactsProduced: Record<string, string[]> = {};
  for (const record of records) {
    const phaseId = record.phase_id;
    if (!phaseId) continue;
    phasesWithRecords.add(phaseId);
    if (record.record_type !== 'artifact_produced') continue;
    if (!artifactsProduced[phaseId]) artifactsProduced[phaseId] = [];
    artifactsProduced[phaseId].push(extractArtifactKind(record.content, record.record_type));
  }
  return { phasesWithRecords, artifactsProduced };
}

/**
 * A phase's required expectations are ANDed: the phase stays passing only
 * while every required expectation for it passes. Missing results default
 * to passing (the expectation didn't run against these records).
 */
function computeRequiredByPhase(
  requiredExpectationResults: ExpectationResult[],
): Map<string, boolean> {
  const requiredByPhase = new Map<string, boolean>();
  for (const exp of FULL_WORKFLOW_EXPECTATIONS) {
    if (exp.severity !== 'required') continue;
    if (!exp.phase) continue;
    const result = requiredExpectationResults.find((r) => r.expectationId === exp.id);
    const passed = result?.passed ?? true;
    requiredByPhase.set(exp.phase, (requiredByPhase.get(exp.phase) ?? true) && passed);
  }
  return requiredByPhase;
}

function computeMissingByPhase(missingRecords: { phase: string }[]): Map<string, number> {
  const missingByPhase = new Map<string, number>();
  for (const m of missingRecords) {
    missingByPhase.set(m.phase, (missingByPhase.get(m.phase) ?? 0) + 1);
  }
  return missingByPhase;
}

/**
 * A phase is "completed" only when it has no missing records AND every
 * required expectation for it passed.
 */
function computePhasesCompleted(
  observedPhases: PhaseId[],
  missingByPhase: Map<string, number>,
  requiredByPhase: Map<string, boolean>,
): PhaseId[] {
  return observedPhases.filter((p) => {
    if ((missingByPhase.get(p) ?? 0) > 0) return false;
    if ((requiredByPhase.get(p) ?? true) === false) return false;
    return true;
  });
}

function computeStatus(
  observedPhases: PhaseId[],
  phasesCompleted: PhaseId[],
  phasesFailed: PhaseId[],
): 'success' | 'partial' | 'failed' {
  const allPhasesSeenPassed = observedPhases.length > 0
    && phasesFailed.length === 0
    && phasesCompleted.includes('10');
  if (allPhasesSeenPassed) return 'success';
  return phasesCompleted.length > 0 ? 'partial' : 'failed';
}

/**
 * Build the gap report for a non-success run: anchor it at the first
 * broken phase (with a sub-phase hint from the first missing record) and,
 * when a run id is available, merge the LLM/diagnostic enhancer output.
 * Falls back to phase '0' when no failed phase can be identified.
 */
function buildResultGapReport(
  db: Database,
  workflowRunId: string | null,
  lineage: LineageValidationResult,
  phasesFailed: PhaseId[],
): GapReport {
  const firstBroken = PHASE_ORDER.find((p) => phasesFailed.includes(p));
  if (!firstBroken) {
    return buildGapReport(lineage, '0');
  }
  const subPhaseHint = lineage.missingRecords.find((m) => m.phase === firstBroken)?.sub_phase;
  const gapReport = buildGapReport(lineage, firstBroken, subPhaseHint);
  if (!workflowRunId) {
    return gapReport;
  }
  const enhanced = enhanceGapReport(db, workflowRunId, gapReport);
  return { ...gapReport, ...enhanced };
}
