/**
 * Decomposition Viewer — validator-findings loader.
 *
 * Surfaces the substantive reasoning-review findings for a run and binds each
 * to the item(s) it cites, so the drill-down can show validator feedback next
 * to the artifact it critiques. Selection reuses the SAME tested primitives the
 * Phase-9 executor and Phase-10.1 adjudicator use ({@link AUTO_FIX_VALIDATORS},
 * {@link REASONING_PROCESS_VALIDATORS}, {@link extractCitedIds}) — this is a new
 * VIEW over that logic, not a re-implementation.
 *
 * Binding: findings carry no direct node ref (the harness→output→node bridge is
 * dead — derived_from always points at the harness), so we bind by the logical
 * ids the finding cites (AC/US/NFR/component) against the run's real item id
 * sets. Findings citing no known item are counted but not shipped.
 */

import type { Database } from '../database/init';
import { collectGovernedStream } from '../database/iterateGovernedStream';
import {
  AUTO_FIX_VALIDATORS,
  REASONING_PROCESS_VALIDATORS,
  extractCitedIds,
} from '../review/findingSurfacing';
import type { ReasoningReviewFindingRecordContent } from '../types/records';
import type { ViewerFinding, ViewerFindingsSummary } from './types';

interface ItemIdSets {
  acs: Set<string>;
  displayKeys: Set<string>; // US / NFR / component keys
}

/** Add component display keys + ids from component decomposition nodes. */
function collectComponentKeys(db: Database, workflowRunId: string, displayKeys: Set<string>): void {
  const compRows = collectGovernedStream<{ content: string }>(
    db.prepare(
      `SELECT content FROM governed_stream
        WHERE record_type = 'component_decomposition_node' AND is_current_version = 1 AND workflow_run_id = ?
        ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
    ), [workflowRunId], { pageSize: 500 },
  );
  for (const r of compRows) {
    try {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      if (typeof c.display_key === 'string') displayKeys.add(c.display_key);
      const comp = (c.component ?? {}) as Record<string, unknown>;
      if (typeof comp.id === 'string') displayKeys.add(comp.id);
    } catch { /* skip */ }
  }
}

/** Collect the run's real item id sets so citedIds can be resolved to items. */
function loadItemIdSets(db: Database, workflowRunId: string): ItemIdSets {
  const acs = new Set<string>();
  const displayKeys = new Set<string>();

  const reqRows = collectGovernedStream<{ content: string }>(
    db.prepare(
      `SELECT content FROM governed_stream
        WHERE record_type = 'requirement_decomposition_node' AND is_current_version = 1 AND workflow_run_id = ?
        ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
    ), [workflowRunId], { pageSize: 500 },
  );
  for (const r of reqRows) {
    try {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      if (typeof c.display_key === 'string') displayKeys.add(c.display_key);
      const story = (c.user_story ?? {}) as Record<string, unknown>;
      for (const ac of Array.isArray(story.acceptance_criteria) ? story.acceptance_criteria : []) {
        const id = (ac as Record<string, unknown>)?.id;
        if (typeof id === 'string') acs.add(id);
      }
    } catch { /* skip malformed */ }
  }

  collectComponentKeys(db, workflowRunId, displayKeys);

  return { acs, displayKeys };
}

/**
 * Build `harness_id → reviewed_agent_output_id`, so we can drop findings whose
 * reviewed artifact was superseded by a revision.
 */
function buildReviewedOutputByHarness(db: Database, workflowRunId: string): Map<string, string> {
  const reviewedOutputByHarness = new Map<string, string>();
  const harnessRows = collectGovernedStream<{ content: string }>(
    db.prepare(
      `SELECT content FROM governed_stream
        WHERE record_type = 'reasoning_review_harness_record' AND is_current_version = 1 AND workflow_run_id = ?
        ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
    ), [workflowRunId], { pageSize: 500 },
  );
  for (const r of harnessRows) {
    try {
      const c = JSON.parse(r.content) as Record<string, unknown>;
      if (typeof c.harness_id === 'string' && typeof c.reviewed_agent_output_id === 'string') {
        reviewedOutputByHarness.set(c.harness_id, c.reviewed_agent_output_id);
      }
    } catch { /* skip */ }
  }
  return reviewedOutputByHarness;
}

/** One query for the superseded output ids (records with a newer version). */
function loadSupersededOutputIds(db: Database, workflowRunId: string): Set<string> {
  const superseded = new Set<string>();
  for (const row of db
    .prepare(`SELECT id FROM governed_stream WHERE workflow_run_id = ? AND is_current_version = 0`)
    .all(workflowRunId) as Array<{ id: string }>) {
    superseded.add(row.id);
  }
  return superseded;
}

/**
 * A surfaced-severity finding that should NOT be shipped: auto-fix noise, or its
 * reviewed artifact was superseded. Severity/kind filtering happens at the call
 * site (it narrows `c.severity` for the by-severity tally).
 */
function isNonSurfaceable(
  c: ReasoningReviewFindingRecordContent,
  isSuperseded: (harnessId: string) => boolean,
): boolean {
  if (AUTO_FIX_VALIDATORS.has(c.validator_id)) return true;
  if (typeof c.harness_id === 'string' && isSuperseded(c.harness_id)) return true;
  return false;
}

/** Partition a finding's cited ids into leaf-AC ids vs display keys (US/NFR/component). */
function bindCitedIds(
  citedIds: string[],
  acs: ReadonlySet<string>,
  displayKeys: ReadonlySet<string>,
): { acIds: string[]; keys: string[] } {
  const acIds: string[] = [];
  const keys: string[] = [];
  for (const id of citedIds) {
    if (acs.has(id)) acIds.push(id);
    else if (displayKeys.has(id)) keys.push(id);
  }
  return { acIds, keys };
}

/** Assemble one shippable {@link ViewerFinding} from a bound finding record. */
function toViewerFinding(
  recordId: string,
  c: ReasoningReviewFindingRecordContent,
  severity: ViewerFinding['severity'],
  citedIds: string[],
  acIds: string[],
  keys: string[],
): ViewerFinding {
  return {
    record_id: recordId,
    validator_id: c.validator_id,
    severity,
    finding_type: c.finding_type,
    summary: c.summary,
    detail: c.detail,
    recommendation: c.recommendation,
    category: REASONING_PROCESS_VALIDATORS.has(c.validator_id) ? 'process' : 'artifact',
    cited_ids: citedIds,
    ac_ids: [...new Set(acIds)],
    display_keys: [...new Set(keys)],
  };
}

/**
 * Build the surfaceable, item-bound findings + a run-level summary. Mirrors
 * `selectReasoningFindings` (HIGH/MEDIUM, drop auto-fix, drop superseded) but
 * reads rows directly (no writer) and additionally binds to items + keeps the
 * reasoning-PROCESS findings (a human reviewer wants them, tagged).
 */
export function loadFindings(
  db: Database,
  workflowRunId: string,
): { findings: ViewerFinding[]; summary: ViewerFindingsSummary } {
  const { acs, displayKeys } = loadItemIdSets(db, workflowRunId);

  const reviewedOutputByHarness = buildReviewedOutputByHarness(db, workflowRunId);
  const superseded = loadSupersededOutputIds(db, workflowRunId);
  const isSuperseded = (harnessId: string): boolean => {
    const out = reviewedOutputByHarness.get(harnessId);
    return out ? superseded.has(out) : false;
  };

  const findingRows = collectGovernedStream<{ id: string; content: string }>(
    db.prepare(
      `SELECT id, content FROM governed_stream
        WHERE record_type = 'reasoning_review_finding_record' AND is_current_version = 1 AND workflow_run_id = ?
        ORDER BY produced_at ASC LIMIT ? OFFSET ?`,
    ), [workflowRunId], { pageSize: 1000 },
  );

  const findings: ViewerFinding[] = [];
  const summary: ViewerFindingsSummary = { total: findingRows.length, surfaced: 0, bound: 0, unbound: 0, by_severity: { HIGH: 0, MEDIUM: 0 } };

  for (const r of findingRows) {
    let c: ReasoningReviewFindingRecordContent;
    try { c = JSON.parse(r.content) as ReasoningReviewFindingRecordContent; } catch { continue; }
    if (c.severity !== 'HIGH' && c.severity !== 'MEDIUM') continue;
    if (isNonSurfaceable(c, isSuperseded)) continue;

    summary.surfaced++;
    summary.by_severity[c.severity]++;

    const citedIds = extractCitedIds(c);
    const { acIds, keys } = bindCitedIds(citedIds, acs, displayKeys);
    if (acIds.length === 0 && keys.length === 0) { summary.unbound++; continue; }

    summary.bound++;
    findings.push(toViewerFinding(r.id, c, c.severity, citedIds, acIds, keys));
  }

  return { findings, summary };
}
