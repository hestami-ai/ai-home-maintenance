/**
 * Unit tests for ClientLiaisonDB.getActiveWorkflowRun() — the DB-as-truth
 * tiered resolver introduced when we collapsed `session.currentRunId`
 * (in-memory) into a single deterministic read path. The resolver is
 * load-bearing for both the DecompViewer (run-agnostic `/active` URI)
 * and the GovernedStreamView (sidebar lights up on copied DBs).
 *
 * Tier order:
 *   1. ui_state.focused_run_id (validated against workflow_runs)
 *   2. Active run (status IN ('initiated','in_progress'))
 *   3. Most recent run with ≥ 1 requirement_decomposition_node record
 *   4. Most recent run of any kind
 *   5. null
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ClientLiaisonDBImpl } from '../../../lib/agents/clientLiaison/db';
import { EmbeddingService } from '../../../lib/embedding/embeddingService';
import { randomUUID } from 'node:crypto';

interface SeededRun {
  id: string;
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';
  initiated_at: string;
  withDecomp?: boolean;
}

function seedRun(db: Database, run: SeededRun): void {
  db.prepare(
    `INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status, current_phase_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(run.id, 'ws', 'sha', run.initiated_at, run.status, '0');
  if (run.withDecomp) {
    db.prepare(
      `INSERT INTO governed_stream
       (id, workflow_run_id, source_workflow_run_id, record_type, content, schema_version, produced_at,
        is_current_version, produced_by_agent_role, janumicode_version_sha)
       VALUES (?, ?, ?, 'requirement_decomposition_node', '{}', '1.0', ?, 1, 'requirements_agent', 'sha')`,
    ).run(randomUUID(), run.id, run.id, run.initiated_at);
  }
}

describe('ClientLiaisonDB.getActiveWorkflowRun — DB-as-truth resolver', () => {
  let db: Database;
  let liaisonDb: ClientLiaisonDBImpl;

  beforeEach(() => {
    db = createTestDatabase();
    liaisonDb = new ClientLiaisonDBImpl(
      db,
      new EmbeddingService(db, { provider: 'ollama', model: 'qwen3-embedding:8b', maxParallel: 1 }),
    );
  });

  afterEach(() => {
    db.close();
  });

  it('returns null on an empty DB', () => {
    expect(liaisonDb.getActiveWorkflowRun()).toBeNull();
  });

  it('Tier 4 — returns the most recent run when no other tier matches', () => {
    seedRun(db, { id: 'old-completed', status: 'completed', initiated_at: '2026-01-01T00:00:00Z' });
    seedRun(db, { id: 'recent-completed', status: 'completed', initiated_at: '2026-04-01T00:00:00Z' });
    expect(liaisonDb.getActiveWorkflowRun()?.id).toBe('recent-completed');
  });

  it('Tier 3 — prefers most-recent run with decomp records over a more-recent run without', () => {
    seedRun(db, { id: 'with-decomp-older', status: 'completed', initiated_at: '2026-01-01T00:00:00Z', withDecomp: true });
    seedRun(db, { id: 'no-decomp-newer', status: 'completed', initiated_at: '2026-04-01T00:00:00Z' });
    expect(liaisonDb.getActiveWorkflowRun()?.id).toBe('with-decomp-older');
  });

  it('Tier 2 — active run wins over older run with decomp', () => {
    seedRun(db, { id: 'old-with-decomp', status: 'completed', initiated_at: '2026-01-01T00:00:00Z', withDecomp: true });
    seedRun(db, { id: 'in-progress', status: 'in_progress', initiated_at: '2026-04-01T00:00:00Z' });
    expect(liaisonDb.getActiveWorkflowRun()?.id).toBe('in-progress');
  });

  it('Tier 1 — focused run wins over active run when set', () => {
    seedRun(db, { id: 'completed-focus', status: 'completed', initiated_at: '2026-01-01T00:00:00Z', withDecomp: true });
    seedRun(db, { id: 'in-progress', status: 'in_progress', initiated_at: '2026-04-01T00:00:00Z' });
    liaisonDb.setFocusedWorkflowRun('completed-focus');
    expect(liaisonDb.getActiveWorkflowRun()?.id).toBe('completed-focus');
  });

  it('Tier 1 self-heals when the focused id no longer exists (DB-swap scenario)', () => {
    seedRun(db, { id: 'real-run', status: 'completed', initiated_at: '2026-04-01T00:00:00Z' });
    liaisonDb.setFocusedWorkflowRun('ghost-id-from-prior-db');
    // Resolver should fall through to Tier 4 and clear the stale focus.
    expect(liaisonDb.getActiveWorkflowRun()?.id).toBe('real-run');
    expect(liaisonDb.getFocusedWorkflowRunId()).toBeNull();
  });

  it('setFocusedWorkflowRun(null) clears the focus', () => {
    seedRun(db, { id: 'r1', status: 'completed', initiated_at: '2026-04-01T00:00:00Z' });
    liaisonDb.setFocusedWorkflowRun('r1');
    expect(liaisonDb.getFocusedWorkflowRunId()).toBe('r1');
    liaisonDb.setFocusedWorkflowRun(null);
    expect(liaisonDb.getFocusedWorkflowRunId()).toBeNull();
  });
});
