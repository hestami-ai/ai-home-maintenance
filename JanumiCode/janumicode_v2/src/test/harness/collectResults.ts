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
import type { PhaseId } from '../../lib/types/records';
import { validateLineage, buildGapReport } from './lineageValidator';
import { FULL_WORKFLOW_EXPECTATIONS, validateExpectations } from './hestamiExpectations';
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

  const records: StreamRecord[] = workflowRunId
    ? db.prepare(
        `SELECT record_type, phase_id, sub_phase_id, content
         FROM governed_stream
         WHERE workflow_run_id = ?
         ORDER BY produced_at`,
      ).all(workflowRunId) as StreamRecord[]
    : [];

  // Inventory what's present, keyed by phase.
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

  const observedPhases = PHASE_ORDER.filter((p) => phasesWithRecords.has(p));
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

  const lineage = workflowRunId
    ? validateLineage(db, workflowRunId, observedPhases)
    : { valid: true, missingRecords: [], violations: [], assertionFailures: [], gaps: [] };

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

  const semanticWarnings = requiredExpectationResults
    .map((r) => r.warning)
    .filter((w): w is NonNullable<typeof w> => !!w);

  const allPhasesSeenPassed = observedPhases.length > 0
    && phasesFailed.length === 0
    && phasesCompleted.includes('10');
  const status: 'success' | 'partial' | 'failed' = allPhasesSeenPassed
    ? 'success'
    : phasesCompleted.length > 0 ? 'partial' : 'failed';

  let gapReport: GapReport | undefined;
  if (status !== 'success') {
    const firstBroken = PHASE_ORDER.find((p) => phasesFailed.includes(p));
    if (firstBroken) {
      const subPhaseHint = lineage.missingRecords.find((m) => m.phase === firstBroken)?.sub_phase;
      gapReport = buildGapReport(lineage, firstBroken, subPhaseHint);
      if (workflowRunId) {
        const enhanced = enhanceGapReport(db, workflowRunId, gapReport);
        gapReport = { ...gapReport, ...enhanced };
      }
    } else {
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
    governedStreamPath: opts.dbPath,
  };
}
