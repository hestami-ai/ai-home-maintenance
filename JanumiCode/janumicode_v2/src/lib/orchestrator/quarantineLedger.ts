/**
 * Wave R — quarantine ledger.
 *
 * Tracks leaves whose retry budget is exhausted within a wave. The
 * deferred-batch wave consumes this ledger to retry with augmented
 * context. Terminally-deferred entries are surfaced in the workflow
 * run summary as known gaps for human attention.
 *
 * The ledger is just a thin wrapper over `task_quarantine` records in
 * the governed_stream — no separate table needed. Records are
 * append-only; rescue / terminal-deferral status is captured by writing
 * a new revision with the same `leaf_task_id` and superseding the prior.
 */

import type { GovernedStreamWriter } from './governedStreamWriter';
import type {
  GovernedStreamRecord,
  QuarantineAttemptEntry,
  QuarantineRescueStatus,
  TaskQuarantineContent,
} from '../types/records';

export interface QuarantineEnqueueInput {
  workflowRunId: string;
  janumiCodeVersionSha: string;
  leafTaskId: string;
  leafNodeId?: string | null;
  waveNumber: number;
  releaseId: string | null;
  releaseOrdinal: number | null;
  attempts: QuarantineAttemptEntry[];
  reason: string;
}

export class QuarantineLedger {
  constructor(private readonly writer: GovernedStreamWriter) {}

  /** Append a quarantine record for a leaf that exhausted its retry budget. */
  enqueue(input: QuarantineEnqueueInput): GovernedStreamRecord {
    const content: TaskQuarantineContent = {
      kind: 'task_quarantine',
      leaf_task_id: input.leafTaskId,
      leaf_node_id: input.leafNodeId ?? null,
      wave_number: input.waveNumber,
      release_id: input.releaseId,
      release_ordinal: input.releaseOrdinal,
      attempts: input.attempts,
      quarantine_reason: input.reason,
      rescue_status: 'pending',
      quarantined_at: new Date().toISOString(),
    };
    return this.writer.writeRecord({
      record_type: 'task_quarantine',
      schema_version: '1.0',
      workflow_run_id: input.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: input.janumiCodeVersionSha,
      derived_from_record_ids: [],
      content: content as unknown as Record<string, unknown>,
    });
  }

  /**
   * Walk all `task_quarantine` records for the workflow run and return
   * the latest revision per leaf_task_id whose `rescue_status === 'pending'`.
   * These are the leaves the deferred-batch wave should retry.
   */
  pendingForRun(workflowRunId: string): TaskQuarantineContent[] {
    const records = this.writer.getRecordsByType(workflowRunId, 'task_quarantine');
    const latestByLeaf = new Map<string, TaskQuarantineContent>();
    for (const r of records) {
      const c = r.content as unknown as TaskQuarantineContent;
      const prior = latestByLeaf.get(c.leaf_task_id);
      // current-version filter already applied; keep the row as-is.
      if (!prior) latestByLeaf.set(c.leaf_task_id, c);
    }
    return [...latestByLeaf.values()].filter(c => c.rescue_status === 'pending');
  }

  /**
   * Update rescue status by writing a new revision and superseding the
   * prior pending row. The supersession key is `leaf_task_id` —
   * idempotent across re-runs.
   */
  updateRescueStatus(input: {
    workflowRunId: string;
    janumiCodeVersionSha: string;
    leafTaskId: string;
    rescueStatus: QuarantineRescueStatus;
    additionalAttempts: QuarantineAttemptEntry[];
    reason?: string;
  }): GovernedStreamRecord | null {
    const records = this.writer.getRecordsByType(input.workflowRunId, 'task_quarantine');
    const matches = records.filter(r =>
      (r.content as unknown as TaskQuarantineContent).leaf_task_id === input.leafTaskId,
    );
    if (matches.length === 0) return null;
    const latest = matches.reduce((acc, r) =>
      r.produced_at > acc.produced_at ? r : acc, matches[0]);
    const prior = latest.content as unknown as TaskQuarantineContent;
    const content: TaskQuarantineContent = {
      ...prior,
      attempts: [...prior.attempts, ...input.additionalAttempts],
      rescue_status: input.rescueStatus,
      quarantine_reason: input.reason ?? prior.quarantine_reason,
      quarantined_at: new Date().toISOString(),
    };
    const updated = this.writer.writeRecord({
      record_type: 'task_quarantine',
      schema_version: '1.0',
      workflow_run_id: input.workflowRunId,
      phase_id: '9',
      sub_phase_id: '9.1',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: input.janumiCodeVersionSha,
      derived_from_record_ids: [latest.id],
      content: content as unknown as Record<string, unknown>,
    });
    this.writer.supersedByRollback(latest.id, updated.id);
    return updated;
  }

  /** Build the augmented prompt context the deferred-batch wave passes back to the executor. */
  static buildAugmentedContext(prior: TaskQuarantineContent): string {
    const lines: string[] = [];
    lines.push(
      `This task was quarantined after ${prior.attempts.length} ` +
      `attempt${prior.attempts.length === 1 ? '' : 's'} in wave ${prior.wave_number}.`,
    );
    lines.push(`Quarantine reason: ${prior.quarantine_reason}`);
    lines.push('');
    lines.push('Prior attempts:');
    for (const a of prior.attempts) {
      lines.push(`  Attempt ${a.attempt_number} — ${a.outcome}`);
      if (a.reasoning_review_flaws && a.reasoning_review_flaws.length > 0) {
        for (const f of a.reasoning_review_flaws) {
          lines.push(`    [flaw ${f.severity}] ${f.flaw_type}${f.description ? `: ${f.description}` : ''}`);
        }
      }
      if (a.test_failures && a.test_failures.length > 0) {
        lines.push(`    Failing tests: ${a.test_failures.join(', ')}`);
      }
      if (a.error_message) {
        lines.push(`    Error: ${a.error_message}`);
      }
    }
    lines.push('');
    lines.push(
      'Use this prior trace to avoid the same flaws on this retry. ' +
      'Specifically address each flaw above by adjusting your approach, ' +
      'not by retrying the same path.',
    );
    return lines.join('\n');
  }
}
