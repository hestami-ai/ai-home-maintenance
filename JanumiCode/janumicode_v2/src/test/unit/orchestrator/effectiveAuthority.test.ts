/**
 * Tests for effectiveAuthority — the recompute helper that turns stored
 * authority_level into the effective value per spec §3.1 (constitutional
 * always 7; phase-gate-certified elevated to 6).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import {
  buildAuthorityElevationIndex,
  effectiveAuthorityLevel,
} from '../../../lib/orchestrator/effectiveAuthority';

describe('effectiveAuthorityLevel', () => {
  const emptyIndex = { certifiedIds: new Set<string>() };

  it('returns 7 for constitutional_invariant regardless of stored value', () => {
    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'constitutional_invariant', authority_level: 2 },
      emptyIndex,
    )).toBe(7);

    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'constitutional_invariant', authority_level: 7 },
      emptyIndex,
    )).toBe(7);
  });

  it('elevates certified records from < 6 to 6', () => {
    const index = { certifiedIds: new Set(['r-1']) };
    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'artifact_produced', authority_level: 2 },
      index,
    )).toBe(6);
  });

  it('does not downgrade — certified record with stored=7 stays 7', () => {
    const index = { certifiedIds: new Set(['r-1']) };
    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'narrative_memory', authority_level: 7 },
      index,
    )).toBe(7);
  });

  it('returns stored value for uncertified non-constitutional records', () => {
    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'artifact_produced', authority_level: 2 },
      emptyIndex,
    )).toBe(2);

    expect(effectiveAuthorityLevel(
      { id: 'r-2', record_type: 'decision_trace', authority_level: 5 },
      emptyIndex,
    )).toBe(5);
  });

  it('handles missing authority_level by defaulting to 2', () => {
    expect(effectiveAuthorityLevel(
      { id: 'r-1', record_type: 'artifact_produced', authority_level: undefined as unknown as number },
      emptyIndex,
    )).toBe(2);
  });
});

describe('buildAuthorityElevationIndex', () => {
  let db: Database;

  beforeEach(() => { db = createTestDatabase(); });
  afterEach(() => { db.close(); });

  it('returns empty set when no phase_gate_approved records exist', () => {
    const index = buildAuthorityElevationIndex(db);
    expect(index.certifiedIds.size).toBe(0);
  });

  it('collects target_record_ids of validates edges sourced from phase_gate_approved', () => {
    // Set up a phase_gate_approved record and two artifacts it validates
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    const now = '2026-01-01T01:00:00Z';
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
        produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
        janumicode_version_sha, authority_level, derived_from_system_proposal,
        is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
        sanitized_fields, content
      ) VALUES
        ('gate-1', 'phase_gate_approved', '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 5, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}'),
        ('art-1', 'artifact_produced',    '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}'),
        ('art-2', 'artifact_produced',    '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}'),
        ('art-3', 'artifact_produced',    '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}')
    `).run(now, now, now, now, now, now, now, now);

    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES
        ('e1', 'gate-1', 'art-1', 'validates',    'test', ?, 5, 'system_asserted'),
        ('e2', 'gate-1', 'art-2', 'validates',    'test', ?, 5, 'system_asserted'),
        ('e3', 'gate-1', 'art-3', 'derives_from', 'test', ?, 5, 'system_asserted')
    `).run(now, now, now);

    const index = buildAuthorityElevationIndex(db);
    expect(index.certifiedIds.has('art-1')).toBe(true);
    expect(index.certifiedIds.has('art-2')).toBe(true);
    // art-3 was linked via derives_from, not validates — NOT certified
    expect(index.certifiedIds.has('art-3')).toBe(false);
    expect(index.certifiedIds.size).toBe(2);
  });

  it('ignores validates edges sourced from non-phase_gate_approved records', () => {
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();

    const now = '2026-01-01T01:00:00Z';
    db.prepare(`
      INSERT INTO governed_stream (
        id, record_type, schema_version, workflow_run_id, phase_id, sub_phase_id,
        produced_by_agent_role, produced_by_record_id, produced_at, effective_at,
        janumicode_version_sha, authority_level, derived_from_system_proposal,
        is_current_version, superseded_by_id, superseded_at, superseded_by_record_id,
        source_workflow_run_id, derived_from_record_ids, quarantined, sanitized,
        sanitized_fields, content
      ) VALUES
        ('art-source', 'artifact_produced', '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}'),
        ('art-target', 'artifact_produced', '1.0', 'run-1', '3', null, 'orchestrator', null, ?, ?, 'abc', 2, 0, 1, null, null, null, 'run-1', '[]', 0, 0, '[]', '{}')
    `).run(now, now, now, now);

    db.prepare(`
      INSERT INTO memory_edge (id, source_record_id, target_record_id, edge_type, asserted_by, asserted_at, authority_level, status)
      VALUES ('e1', 'art-source', 'art-target', 'validates', 'test', ?, 5, 'system_asserted')
    `).run(now);

    const index = buildAuthorityElevationIndex(db);
    expect(index.certifiedIds.size).toBe(0);
  });
});
