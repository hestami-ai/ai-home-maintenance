/**
 * Tests for the constitutional invariants seeder (spec §1.5 + §3.1).
 *
 * Covers B.1: idempotency, record shape, authority level, full set seeded.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import {
  seedConstitutionalInvariants,
  CONSTITUTIONAL_INVARIANTS,
} from '../../../lib/orchestrator/constitutionalInvariants';

let idCounter = 0;
function testId(): string { return `ci-${++idCounter}`; }

describe('seedConstitutionalInvariants', () => {
  let db: Database;
  let writer: GovernedStreamWriter;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => { db.close(); });

  it('seeds all 10 invariants on first call', () => {
    const ids = seedConstitutionalInvariants({
      db, writer,
      workflowRunId: 'run-1',
      janumiCodeVersionSha: 'test-sha',
    });
    expect(ids).toHaveLength(10);
    expect(ids).toHaveLength(CONSTITUTIONAL_INVARIANTS.length);
  });

  it('is idempotent — second call writes no new records', () => {
    seedConstitutionalInvariants({ db, writer, workflowRunId: 'run-1', janumiCodeVersionSha: 'test-sha' });

    // Second invocation (e.g. a second workflow run in the same workspace)
    const ids2 = seedConstitutionalInvariants({
      db, writer, workflowRunId: 'run-1', janumiCodeVersionSha: 'test-sha',
    });
    expect(ids2).toEqual([]);

    // DB still has exactly 10 invariant records
    const count = db.prepare(
      `SELECT COUNT(*) AS c FROM governed_stream WHERE record_type = 'constitutional_invariant'`,
    ).get() as { c: number };
    expect(count.c).toBe(10);
  });

  it('seeded records have authority_level=7', () => {
    seedConstitutionalInvariants({ db, writer, workflowRunId: 'run-1', janumiCodeVersionSha: 'test-sha' });
    const rows = db.prepare(
      `SELECT authority_level FROM governed_stream WHERE record_type = 'constitutional_invariant'`,
    ).all() as Array<{ authority_level: number }>;
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      expect(r.authority_level).toBe(7);
    }
  });

  it('each invariant has a stable id (CI-1 through CI-10) and a non-empty statement', () => {
    seedConstitutionalInvariants({ db, writer, workflowRunId: 'run-1', janumiCodeVersionSha: 'test-sha' });
    const rows = db.prepare(
      `SELECT content FROM governed_stream WHERE record_type = 'constitutional_invariant' ORDER BY produced_at`,
    ).all() as Array<{ content: string }>;
    const ids = rows.map(r => (JSON.parse(r.content) as { invariant_id: string }).invariant_id).sort();
    expect(ids).toEqual(['CI-1', 'CI-10', 'CI-2', 'CI-3', 'CI-4', 'CI-5', 'CI-6', 'CI-7', 'CI-8', 'CI-9']);

    for (const r of rows) {
      const c = JSON.parse(r.content) as { statement: string; source_section: string; kind: string };
      expect(c.kind).toBe('constitutional_invariant');
      expect(c.statement.length).toBeGreaterThan(0);
      expect(c.source_section).toBe('1.5');
    }
  });

  it('does not re-seed even when invoked from a different workflow run', () => {
    seedConstitutionalInvariants({ db, writer, workflowRunId: 'run-1', janumiCodeVersionSha: 'test-sha' });

    // Add a second workflow run and try seeding from it
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-2', 'ws-1', 'abc', '2026-01-02T00:00:00Z', 'initiated')
    `).run();

    const ids2 = seedConstitutionalInvariants({
      db, writer, workflowRunId: 'run-2', janumiCodeVersionSha: 'test-sha',
    });
    expect(ids2).toEqual([]);

    const count = db.prepare(
      `SELECT COUNT(*) AS c FROM governed_stream WHERE record_type = 'constitutional_invariant'`,
    ).get() as { c: number };
    expect(count.c).toBe(10);
  });
});
