/**
 * Constitutional Invariants — spec §1.5.
 *
 * Authority Level 7. No agent, Orchestrator decision, or human approval
 * within a Workflow Run can supersede them. Seeded once per workspace
 * (on the first Phase 0 that finds none in the workspace) and thereafter
 * inherited via DMR's all-runs scope.
 */

import type { Database } from '../database/init';
import type { GovernedStreamWriter } from './governedStreamWriter';
import type { ConstitutionalInvariantContent } from '../types/records';
import { getLogger } from '../logging';

export interface InvariantSeed {
  id: string;
  statement: string;
}

export const CONSTITUTIONAL_INVARIANTS: readonly InvariantSeed[] = [
  { id: 'CI-1',  statement: '100% correctness and completeness — always. All three layers of correctness (Section 1.6) are required.' },
  { id: 'CI-2',  statement: 'Every phase is mandatory and executed in order. The Orchestrator cannot skip phases.' },
  { id: 'CI-3',  statement: 'Every Phase Gate requires human approval. No automated gate passage.' },
  { id: 'CI-4',  statement: 'Every human interaction is recorded in the Governed Stream in full detail.' },
  { id: 'CI-5',  statement: 'Agents never exercise judgment. Judgment is always escalated to the human.' },
  { id: 'CI-6',  statement: 'The Governed Stream is single-threaded. No parallel Workflow Runs in a Workspace.' },
  { id: 'CI-7',  statement: 'All Artifacts are owned by JanumiCode and stored in the Governed Stream database.' },
  { id: 'CI-8',  statement: 'Prompt Templates use namespace prefixing ([JC:] and [P:]) and separate context scopes at all times.' },
  { id: 'CI-9',  statement: 'No governing constraint may be truncated silently. Governing constraints (Authority Level 6+) are always delivered in full via the stdin directive channel.' },
  { id: 'CI-10', statement: 'The Governed Stream is lossless. All execution trace content — reasoning steps, self-corrections, tool call invocations, tool results — is captured in full regardless of what subset is used for any given downstream purpose.' },
] as const;

const SOURCE_SECTION = '1.5';

/**
 * Idempotent seed. If any `constitutional_invariant` record already exists
 * anywhere in the workspace (any prior run), this is a no-op. Otherwise
 * writes one record per invariant in this run, at Authority Level 7.
 */
export function seedConstitutionalInvariants(args: {
  db: Database;
  writer: GovernedStreamWriter;
  workflowRunId: string;
  janumiCodeVersionSha: string;
}): string[] {
  const { db, writer, workflowRunId, janumiCodeVersionSha } = args;
  try {
    const existing = db.prepare(
      `SELECT COUNT(*) AS c FROM governed_stream
        WHERE record_type = 'constitutional_invariant'
          AND is_current_version = 1`,
    ).get() as { c: number };
    if (existing.c > 0) return [];
  } catch (err) {
    getLogger().warn('governed_stream', 'Failed to query existing constitutional invariants', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const ids: string[] = [];
  for (const inv of CONSTITUTIONAL_INVARIANTS) {
    const content: ConstitutionalInvariantContent = {
      kind: 'constitutional_invariant',
      invariant_id: inv.id,
      statement: inv.statement,
      source_section: SOURCE_SECTION,
    };
    const rec = writer.writeRecord({
      record_type: 'constitutional_invariant',
      schema_version: '1.0',
      workflow_run_id: workflowRunId,
      phase_id: '0',
      sub_phase_id: 'workspace_classification',
      produced_by_agent_role: 'orchestrator',
      janumicode_version_sha: janumiCodeVersionSha,
      authority_level: 7,
      content: content as unknown as Record<string, unknown>,
    });
    ids.push(rec.id);
  }
  return ids;
}
