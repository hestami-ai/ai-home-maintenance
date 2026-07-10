/**
 * Characterization tests for {@link collectHarnessResult} — pin the
 * observable HarnessResult shape BEFORE the S3776 cognitive-complexity
 * decomposition, so the extract-helper refactor stays behavior-preserving.
 *
 * Two deterministic, oracle-independent anchors:
 *   - workflowRunId === null short-circuits every DB / oracle read →
 *     status 'failed', empty phase + artifact sets, and a gap report
 *     anchored at phase '0' (no failed phase to point at, no lineage
 *     signal to derive a sub-phase from).
 *   - artifactsProduced is a pure fold over the governed_stream records:
 *     a record_type other than 'artifact_produced' only marks its phase
 *     as "seen"; an artifact_produced record pushes content.kind, falling
 *     back to the record_type when the content is absent, carries no
 *     `kind`, or is unparseable; a null-phase record is ignored entirely.
 *
 * Plus the partition invariant (phasesCompleted and phasesFailed together
 * cover exactly the observed phases, disjointly) that the refactor must
 * preserve regardless of the lineage / expectation oracle verdicts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { collectHarnessResult } from '../../harness/collectResults';

const RUN = 'run-1';

function insertRun(db: Database): void {
  db.prepare(`
    INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
    VALUES (?, 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
  `).run(RUN);
}

function insertRecord(
  db: Database,
  row: {
    id: string;
    record_type: string;
    phase_id: string | null;
    produced_at: string;
    content: string;
  },
): void {
  db.prepare(`
    INSERT INTO governed_stream (
      id, record_type, schema_version, workflow_run_id, phase_id, produced_at,
      janumicode_version_sha, authority_level, source_workflow_run_id, content
    ) VALUES (?, ?, '1.0', ?, ?, ?, 'abc', 2, ?, ?)
  `).run(row.id, row.record_type, RUN, row.phase_id, row.produced_at, RUN, row.content);
}

describe('collectHarnessResult (in-memory characterization)', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
  });

  it('short-circuits to a failed, empty result when workflowRunId is null', () => {
    const result = collectHarnessResult(db, null, {
      dbPath: '/tmp/harness.db',
      startTimeMs: Date.now(),
    });

    expect(result.status).toBe('failed');
    expect(result.phasesCompleted).toEqual([]);
    expect(result.phasesFailed).toEqual([]);
    expect(result.artifactsProduced).toEqual({});
    expect(result.semanticWarnings).toEqual([]);
    expect(result.governedStreamPath).toBe('/tmp/harness.db');
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Non-success → gap report; with no failed phase and an empty lineage
    // it anchors at phase '0' with no derived sub-phase.
    expect(result.gapReport).toBeDefined();
    expect(result.gapReport?.phase).toBe('0');
    expect(result.gapReport?.failed_at_phase).toBe('0');
    expect(result.gapReport?.subPhase).toBeUndefined();
    expect(result.gapReport?.missing_records).toEqual([]);
    expect(result.gapReport?.schema_violations).toEqual([]);
    expect(result.gapReport?.assertion_failures).toEqual([]);
  });

  it('folds governed_stream records into artifactsProduced by phase', () => {
    insertRun(db);

    // Phase 1: two artifacts, kinds taken from content.kind, ordered by
    // produced_at (the collector's ORDER BY produced_at, id).
    insertRecord(db, {
      id: 'r1', record_type: 'artifact_produced', phase_id: '1',
      produced_at: '2026-01-01T00:00:01Z',
      content: JSON.stringify({ kind: 'intent_statement' }),
    });
    insertRecord(db, {
      id: 'r2', record_type: 'artifact_produced', phase_id: '1',
      produced_at: '2026-01-01T00:00:02Z',
      content: JSON.stringify({ kind: 'functional_requirements' }),
    });

    // Phase 2: a non-artifact record marks the phase but adds no artifact;
    // an artifact_produced with no `kind` falls back to the record_type.
    insertRecord(db, {
      id: 'r3', record_type: 'mirror_presented', phase_id: '2',
      produced_at: '2026-01-01T00:00:03Z',
      content: JSON.stringify({ anything: true }),
    });
    insertRecord(db, {
      id: 'r4', record_type: 'artifact_produced', phase_id: '2',
      produced_at: '2026-01-01T00:00:04Z',
      content: JSON.stringify({ no_kind_here: 'x' }),
    });

    // Phase 3: unparseable JSON content → catch → record_type fallback.
    insertRecord(db, {
      id: 'r5', record_type: 'artifact_produced', phase_id: '3',
      produced_at: '2026-01-01T00:00:05Z',
      content: 'THIS IS NOT JSON',
    });

    // Null phase_id → skipped entirely (neither phase-seen nor artifact).
    insertRecord(db, {
      id: 'r6', record_type: 'artifact_produced', phase_id: null,
      produced_at: '2026-01-01T00:00:06Z',
      content: JSON.stringify({ kind: 'should_be_ignored' }),
    });

    const result = collectHarnessResult(db, RUN, {
      dbPath: '/tmp/harness.db',
      startTimeMs: Date.now(),
    });

    // Pure, oracle-independent fold — the block extracted into
    // inventoryArtifacts() / extractArtifactKind().
    expect(result.artifactsProduced).toEqual({
      '1': ['intent_statement', 'functional_requirements'],
      '2': ['artifact_produced'],
      '3': ['artifact_produced'],
    });

    // Structural invariants the refactor must preserve regardless of the
    // lineage / expectation oracle verdicts.
    expect(result.governedStreamPath).toBe('/tmp/harness.db');
    expect(typeof result.durationMs).toBe('number');
    expect(Array.isArray(result.phasesCompleted)).toBe(true);
    expect(Array.isArray(result.phasesFailed)).toBe(true);
    expect(Array.isArray(result.semanticWarnings)).toBe(true);

    // Phase 10 never produced records → the run can never be 'success'.
    expect(result.status).not.toBe('success');

    // completed and failed partition the observed phases {1, 2, 3},
    // disjointly.
    const covered = [...result.phasesCompleted, ...result.phasesFailed].sort();
    expect(covered).toEqual(['1', '2', '3']);
    for (const p of result.phasesCompleted) {
      expect(result.phasesFailed).not.toContain(p);
    }

    // Any non-success run carries a gap report.
    expect(result.gapReport).toBeDefined();
  });
});
