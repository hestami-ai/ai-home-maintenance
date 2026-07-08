/**
 * Unit tests for rollbackToSubPhase.
 *
 * Seeds an in-memory governed_stream with synthetic records across
 * multiple phases / sub-phases and verifies that rollback:
 *   - identifies the correct cutoff timestamp
 *   - flips is_current_version=0 only for records produced at-or-after the cutoff
 *   - preserves immutable history (agent_invocation, agent_output, etc.) as current
 *   - leaves records BEFORE the cutoff untouched
 *   - handles the "target sub-phase never ran" case cleanly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, initializeDatabase, type Database } from '../../../lib/database/init';
import { rollbackToSubPhase, resetRunCycleCounter } from '../../../lib/orchestrator/rollback';

const RUN_ID = '00000000-0000-0000-0000-000000000001';

function seed(
  db: Database,
  rows: Array<{
    id: string;
    record_type: string;
    sub_phase_id: string;
    produced_at: string;
    is_current_version?: number;
    /** Pipeline phase id ('0'..'10', '0.5'). Defaults '0' (keeps single-phase
     *  tests unchanged); set it to exercise the cross-phase scoping. */
    phase_id?: string;
  }>,
): void {
  const stmt = db.prepare(`
    INSERT INTO governed_stream (
      id, record_type, schema_version, workflow_run_id,
      phase_id, sub_phase_id, produced_by_agent_role, produced_by_record_id,
      produced_at, effective_at, janumicode_version_sha, authority_level,
      derived_from_system_proposal, is_current_version,
      superseded_by_id, superseded_at, superseded_by_record_id,
      source_workflow_run_id, derived_from_record_ids,
      quarantined, sanitized, sanitized_fields, content
    ) VALUES (
      ?, ?, '1.0', ?,
      ?, ?, NULL, NULL,
      ?, ?, 'test', 2,
      0, ?,
      NULL, NULL, NULL,
      ?, '[]',
      0, 0, '[]', '{}'
    )
  `);
  for (const r of rows) {
    stmt.run(
      r.id, r.record_type, RUN_ID,
      r.phase_id ?? '0', r.sub_phase_id,
      r.produced_at, r.produced_at,
      r.is_current_version ?? 1,
      RUN_ID,
    );
  }
}

function currentVersionCount(db: Database, sub_phase_id?: string): number {
  const sql = sub_phase_id
    ? `SELECT COUNT(*) AS n FROM governed_stream WHERE is_current_version=1 AND sub_phase_id=?`
    : `SELECT COUNT(*) AS n FROM governed_stream WHERE is_current_version=1`;
  const stmt = db.prepare(sql);
  const row = (sub_phase_id ? stmt.get(sub_phase_id) : stmt.get()) as { n: number };
  return row.n;
}

describe('rollbackToSubPhase', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
    initializeDatabase(db);
    // Seed a workflow_run so FKs etc. don't trip.
    db.prepare(`
      INSERT INTO workflow_runs (
        id, status, intent_lens, current_phase_id, workspace_id,
        janumicode_version_sha, initiated_at
      ) VALUES (?, 'running', 'product', '0', 'test-ws', 'test-sha', '2026-05-21T16:00:00Z')
    `).run(RUN_ID);
  });

  it('rolls back stateful records at-or-after the target sub-phase', () => {
    seed(db, [
      { id: 'r1', record_type: 'artifact_produced',          sub_phase_id: 'workspace_classification', produced_at: '2026-05-21T16:00:01Z' },
      { id: 'r2', record_type: 'artifact_produced',          sub_phase_id: 'intent_discovery',          produced_at: '2026-05-21T16:00:02Z' },
      { id: 'r3', record_type: 'artifact_produced',          sub_phase_id: 'business_domains_bloom',    produced_at: '2026-05-21T16:00:03Z' },
      { id: 'r4', record_type: 'artifact_produced',          sub_phase_id: 'fr_bloom_skeleton',         produced_at: '2026-05-21T16:00:04Z' },
    ]);
    expect(currentVersionCount(db)).toBe(4);
    const result = rollbackToSubPhase(db, RUN_ID, 'business_domains_bloom');
    expect(result.cutoff_produced_at).toBe('2026-05-21T16:00:03Z');
    expect(result.rolled_back_count).toBe(2);
    expect(currentVersionCount(db)).toBe(2);
    expect(currentVersionCount(db, 'workspace_classification')).toBe(1);
    expect(currentVersionCount(db, 'intent_discovery')).toBe(1);
    expect(currentVersionCount(db, 'business_domains_bloom')).toBe(0);
    expect(currentVersionCount(db, 'fr_bloom_skeleton')).toBe(0);
  });

  it('preserves immutable history (agent_invocation et al.) across rollback', () => {
    // transformation_step used to be in the preserve set too, but the
    // record_type was retired with the legacy transforms.jsonl writer.
    // The remaining preserved-history types still include the
    // agent_invocation / agent_output pair the test cares about.
    seed(db, [
      { id: 'r1', record_type: 'agent_invocation',  sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:03Z' },
      { id: 'r2', record_type: 'agent_output',      sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:03Z' },
      { id: 'r3', record_type: 'artifact_produced', sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:04Z' },
    ]);
    const result = rollbackToSubPhase(db, RUN_ID, 'business_domains_bloom');
    expect(result.rolled_back_count).toBe(1); // only the artifact_produced
    expect(result.preserved_count).toBe(2);   // agent_invocation, agent_output
    expect(result.rolled_back_by_type).toEqual({ artifact_produced: 1 });
    expect(currentVersionCount(db)).toBe(2);  // r1, r2 stay current
  });

  it('returns null cutoff when the target sub-phase never ran', () => {
    seed(db, [
      { id: 'r1', record_type: 'artifact_produced', sub_phase_id: 'intent_discovery', produced_at: '2026-05-21T16:00:01Z' },
    ]);
    const result = rollbackToSubPhase(db, RUN_ID, 'never_was_here');
    expect(result.cutoff_produced_at).toBeNull();
    expect(result.rolled_back_count).toBe(0);
    expect(currentVersionCount(db)).toBe(1);
  });

  it('ignores records already superseded (is_current_version=0)', () => {
    seed(db, [
      { id: 'r1', record_type: 'artifact_produced', sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:01Z', is_current_version: 0 },
      { id: 'r2', record_type: 'artifact_produced', sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:02Z', is_current_version: 1 },
    ]);
    const result = rollbackToSubPhase(db, RUN_ID, 'business_domains_bloom');
    // Cutoff is the first CURRENT-version record of the target sub-phase,
    // not the earliest of any version.
    expect(result.cutoff_produced_at).toBe('2026-05-21T16:00:02Z');
    expect(result.rolled_back_count).toBe(1);
  });

  it('preserves UPSTREAM-phase heads even when their timestamp is LATER than the target cutoff (multiply-resumed DB)', () => {
    // The cal-41 over-sweep bug: after several resumes, a Phase-9 sub-phase
    // (reconnaissance @10:12) has an EARLIER wall-clock time than the current
    // Phase-7 test plan (@11:49) and Phase-8 eval plan (@10:54) — those were
    // produced during a LATER resume. A naive `produced_at >= cutoff` sweep
    // tombstones the upstream Phase-7/8 heads, and the partial Phase-9 re-run
    // never regenerates them → every downstream packet loses its tests/eval.
    // Phase-scoped invalidation must keep upstream phases current regardless of
    // timestamp, while still invalidating the target phase + everything after it.
    seed(db, [
      { id: 'p7',  record_type: 'artifact_produced', phase_id: '7',  sub_phase_id: 'test_case_skeleton', produced_at: '2026-07-08T11:49:00Z' },
      { id: 'p8',  record_type: 'artifact_produced', phase_id: '8',  sub_phase_id: 'evaluation_design',  produced_at: '2026-07-08T10:54:00Z' },
      { id: 'p9r', record_type: 'artifact_produced', phase_id: '9',  sub_phase_id: 'reconnaissance',     produced_at: '2026-07-08T10:12:00Z' },
      { id: 'p9p', record_type: 'artifact_produced', phase_id: '9',  sub_phase_id: 'packet_synthesis',   produced_at: '2026-07-08T10:54:30Z' },
      // Downstream Phase-10 head with an EARLIER timestamp than the cutoff (from an
      // even earlier resume): must STILL be invalidated (pipeline position, not time).
      { id: 'p10', record_type: 'artifact_produced', phase_id: '10', sub_phase_id: 'commit',             produced_at: '2026-07-08T09:00:00Z' },
    ]);
    const result = rollbackToSubPhase(db, RUN_ID, 'reconnaissance');
    expect(result.cutoff_produced_at).toBe('2026-07-08T10:12:00Z');
    // Upstream Phase-7/8 heads PRESERVED despite later timestamps.
    expect(currentVersionCount(db, 'test_case_skeleton')).toBe(1);
    expect(currentVersionCount(db, 'evaluation_design')).toBe(1);
    // Target phase + later sub-phase + downstream phase invalidated.
    expect(currentVersionCount(db, 'reconnaissance')).toBe(0);
    expect(currentVersionCount(db, 'packet_synthesis')).toBe(0);
    expect(currentVersionCount(db, 'commit')).toBe(0);
    expect(result.rolled_back_count).toBe(3); // p9r, p9p, p10
  });

  it('cuts off correctly when the target sub-phase ran multiple times', () => {
    // Earlier attempt was previously rolled back, then re-ran.
    seed(db, [
      { id: 'r1', record_type: 'artifact_produced', sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T16:00:01Z', is_current_version: 0 },
      { id: 'r2', record_type: 'artifact_produced', sub_phase_id: 'fr_bloom_skeleton',      produced_at: '2026-05-21T16:00:02Z', is_current_version: 0 },
      { id: 'r3', record_type: 'artifact_produced', sub_phase_id: 'business_domains_bloom', produced_at: '2026-05-21T17:00:01Z', is_current_version: 1 },
      { id: 'r4', record_type: 'artifact_produced', sub_phase_id: 'fr_bloom_skeleton',      produced_at: '2026-05-21T17:00:02Z', is_current_version: 1 },
    ]);
    const result = rollbackToSubPhase(db, RUN_ID, 'business_domains_bloom');
    // Cutoff = first CURRENT occurrence, which is the second attempt.
    expect(result.cutoff_produced_at).toBe('2026-05-21T17:00:01Z');
    expect(result.rolled_back_count).toBe(2);
    expect(currentVersionCount(db)).toBe(0);
  });
});

describe('resetRunCycleCounter', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
    initializeDatabase(db);
    db.prepare(`
      INSERT INTO workflow_runs (
        id, status, intent_lens, current_phase_id, workspace_id,
        janumicode_version_sha, initiated_at
      ) VALUES (?, 'running', 'product', '7', 'test-ws', 'test-sha', '2026-05-21T16:00:00Z')
    `).run(RUN_ID);
  });

  const cycleOf = (): number =>
    (db.prepare(`SELECT current_cycle_number AS n FROM workflow_runs WHERE id = ?`).get(RUN_ID) as { n: number }).n;

  it('zeroes a run that is in cycle mode and returns the prior count', () => {
    db.prepare(`UPDATE workflow_runs SET current_cycle_number = 3 WHERE id = ?`).run(RUN_ID);
    expect(cycleOf()).toBe(3);
    const prior = resetRunCycleCounter(db, RUN_ID);
    expect(prior).toBe(3);
    expect(cycleOf()).toBe(0);
  });

  it('is a no-op (returns 0) when the run is already at 0', () => {
    expect(cycleOf()).toBe(0);
    const prior = resetRunCycleCounter(db, RUN_ID);
    expect(prior).toBe(0);
    expect(cycleOf()).toBe(0);
  });
});
