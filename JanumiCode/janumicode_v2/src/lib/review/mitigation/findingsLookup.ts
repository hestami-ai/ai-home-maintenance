/**
 * Findings lookup — read the most recent reasoning_review_finding_records
 * for a sub-phase, so the MitigationEngine can act on them.
 *
 * The harness fires synchronously after each agent_output via the
 * LLMCaller hook. By the time the phase processor regains control after
 * its agent invocation, the findings have already been persisted. This
 * lookup queries them by sub-phase + workflow run, scoped to the most
 * recent harness invocation.
 *
 * Returns:
 *   - findings: ValidatorFinding[] reconstructed from records
 *   - findingRecordIds: Map<finding, record_id> for citation in audit trail
 */

import type { Database } from '../../database/init';
import type { ValidatorFinding } from '../harness/validatorRegistry';

export interface RecentFindings {
  findings: ValidatorFinding[];
  findingRecordIds: ReadonlyMap<ValidatorFinding, string>;
  /** The harness record id whose findings these are. */
  harnessRecordId: string | null;
}

interface FindingRow {
  id: string;
  content: string;
}

interface FindingContent {
  validator_id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  finding_type: string;
  summary: string;
  location: string;
  detail: string;
  recommendation: string;
  target_field?: string;
  target_identifier?: string;
}

/**
 * Find the most recent harness record for (workflow_run, sub_phase) and
 * return its associated findings. When no harness has fired, returns an
 * empty result — caller should treat as no-mitigation-needed.
 */
export function loadMostRecentFindings(
  db: Database,
  workflowRunId: string,
  subPhaseId: string,
): RecentFindings {
  // Order by produced_at DESC + rowid DESC as the tie-breaker. produced_at
  // is ISO-8601 with millisecond precision; two records written in the
  // same millisecond (rare in production, common in unit tests) tie on
  // timestamp. rowid is a monotonic SQLite-assigned insert order, so
  // it deterministically resolves to the later-written row.
  const harness = db.prepare(`
    SELECT id FROM governed_stream
     WHERE workflow_run_id = ?
       AND record_type = 'reasoning_review_harness_record'
       AND sub_phase_id = ?
       AND is_current_version = 1
     ORDER BY produced_at DESC, rowid DESC
     LIMIT 1
  `).get(workflowRunId, subPhaseId) as { id: string } | undefined;

  if (!harness) {
    return { findings: [], findingRecordIds: new Map(), harnessRecordId: null };
  }

  const rows = db.prepare(`
    SELECT id, content
      FROM governed_stream
     WHERE workflow_run_id = ?
       AND record_type = 'reasoning_review_finding_record'
       AND is_current_version = 1
       AND json_extract(content, '$.harness_id') = ?
     ORDER BY produced_at ASC
  `).all(workflowRunId, harness.id) as FindingRow[];

  const findings: ValidatorFinding[] = [];
  const findingRecordIds = new Map<ValidatorFinding, string>();
  for (const row of rows) {
    let parsed: FindingContent;
    try {
      parsed = JSON.parse(row.content) as FindingContent;
    } catch {
      continue;
    }
    const finding: ValidatorFinding = {
      validatorId: parsed.validator_id,
      severity: parsed.severity,
      type: parsed.finding_type,
      summary: parsed.summary,
      location: parsed.location,
      detail: parsed.detail,
      recommendation: parsed.recommendation,
      targetField: parsed.target_field,
      targetIdentifier: parsed.target_identifier,
    };
    findings.push(finding);
    findingRecordIds.set(finding, row.id);
  }

  return { findings, findingRecordIds, harnessRecordId: harness.id };
}
