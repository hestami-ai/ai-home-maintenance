/**
 * DecisionRouter — webview-decision-to-engine-state translation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import type { Database } from '../../../lib/database/init';
import { createTestDatabase } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';

describe('DecisionRouter', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  let router: DecisionRouter;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    router = new DecisionRouter(engine);
  });

  afterEach(() => {
    db.close();
  });

  it('writes decision_trace and mirror_approved on mirror_approval', () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');

    // Pre-create a mirror_presented record so the follow-up has a target.
    const mirrorRecord = engine.writer.writeRecord({
      record_type: 'mirror_presented',
      schema_version: '1.0',
      workflow_run_id: run.id,
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'test_mirror' },
    });

    // Register a pending decision so the resolve doesn't warn.
    void engine.pauseForDecision(run.id, mirrorRecord.id, 'mirror');

    router.route(run.id, {
      recordId: mirrorRecord.id,
      type: 'mirror_approval',
    });

    const traces = engine.writer.getRecordsByType(run.id, 'decision_trace');
    expect(traces.length).toBeGreaterThanOrEqual(1);
    expect(traces.some(t => t.content.target_record_id === mirrorRecord.id)).toBe(true);

    const approvals = engine.writer.getRecordsByType(run.id, 'mirror_approved');
    expect(approvals.length).toBeGreaterThanOrEqual(1);
  });

  it('triggers next-phase advancement on phase_gate_approval', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    const gateRecord = engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '0',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'gate' },
    });
    void engine.pauseForDecision(run.id, gateRecord.id, 'phase_gate');

    router.route(run.id, {
      recordId: gateRecord.id,
      type: 'phase_gate_approval',
    });

    // Allow the fire-and-forget executeCurrentPhase to fail (no handler) without crashing.
    await new Promise(resolve => setTimeout(resolve, 50));

    const approvals = engine.writer.getRecordsByType(run.id, 'phase_gate_approved');
    expect(approvals.length).toBeGreaterThanOrEqual(1);
  });

  describe('phase_gates SQL table population (dependency-closure resolver input)', () => {
    // Before this fix, nothing ever INSERTed into phase_gates even though
    // dependencyClosureResolver.findAffectedPhaseGates SELECTs from it. The
    // rollback path therefore silently no-opped: validated artifacts never
    // had their gates marked invalidated_by_rollback_at. These tests pin
    // that the producer side writes the row so the read side can find it.

    it('writes a phase_gates row on phase_gate_approval with id = phase_gate_approved record id', async () => {
      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const gateRecord = engine.writer.writeRecord({
        record_type: 'phase_gate_evaluation',
        schema_version: '1.0',
        workflow_run_id: run.id,
        phase_id: '0',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'gate' },
      });
      void engine.pauseForDecision(run.id, gateRecord.id, 'phase_gate');

      router.route(run.id, {
        recordId: gateRecord.id,
        type: 'phase_gate_approval',
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const approvedRecord = engine.writer.getRecordsByType(run.id, 'phase_gate_approved')[0];
      expect(approvedRecord).toBeDefined();

      const rows = db
        .prepare('SELECT * FROM phase_gates WHERE workflow_run_id = ?')
        .all(run.id) as Array<{
          id: string;
          phase_id: string;
          human_approved: number;
          approval_record_id: string;
          decision_trace_id: string | null;
          invalidated_by_rollback_at: string | null;
        }>;
      expect(rows).toHaveLength(1);
      // id must equal the phase_gate_approved record id so the validates
      // memory_edges (source_record_id = approved-record-id) resolve.
      expect(rows[0].id).toBe(approvedRecord.id);
      expect(rows[0].phase_id).toBe('0');
      expect(rows[0].human_approved).toBe(1);
      expect(rows[0].invalidated_by_rollback_at).toBeNull();
      expect(rows[0].decision_trace_id).not.toBeNull();
    });

    it('links the phase_gates row to the decision_trace via decision_trace_id', async () => {
      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const gateRecord = engine.writer.writeRecord({
        record_type: 'phase_gate_evaluation',
        schema_version: '1.0',
        workflow_run_id: run.id,
        phase_id: '0',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'gate' },
      });
      void engine.pauseForDecision(run.id, gateRecord.id, 'phase_gate');

      router.route(run.id, {
        recordId: gateRecord.id,
        type: 'phase_gate_approval',
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const trace = engine.writer
        .getRecordsByType(run.id, 'decision_trace')
        .find(t => t.content.decision_type === 'phase_gate_approval');
      if (!trace) throw new Error('expected phase_gate_approval decision_trace');

      const row = db
        .prepare('SELECT decision_trace_id FROM phase_gates WHERE workflow_run_id = ?')
        .get(run.id) as { decision_trace_id: string } | undefined;
      expect(row?.decision_trace_id).toBe(trace.id);
    });

    it('does not write a phase_gates row for non-approval decision types', () => {
      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const mirrorRecord = engine.writer.writeRecord({
        record_type: 'mirror_presented',
        schema_version: '1.0',
        workflow_run_id: run.id,
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'test_mirror' },
      });
      void engine.pauseForDecision(run.id, mirrorRecord.id, 'mirror');

      router.route(run.id, {
        recordId: mirrorRecord.id,
        type: 'mirror_approval',
      });

      const count = (db
        .prepare('SELECT COUNT(*) AS n FROM phase_gates WHERE workflow_run_id = ?')
        .get(run.id) as { n: number }).n;
      expect(count).toBe(0);
    });

    it('does not write a phase_gates row on phase_gate_rejection', async () => {
      const { run } = engine.startWorkflowRun('ws-1', 'test');
      const gateRecord = engine.writer.writeRecord({
        record_type: 'phase_gate_evaluation',
        schema_version: '1.0',
        workflow_run_id: run.id,
        phase_id: '0',
        janumicode_version_sha: engine.janumiCodeVersionSha,
        content: { kind: 'gate' },
      });
      void engine.pauseForDecision(run.id, gateRecord.id, 'phase_gate');

      router.route(run.id, {
        recordId: gateRecord.id,
        type: 'phase_gate_rejection',
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      const count = (db
        .prepare('SELECT COUNT(*) AS n FROM phase_gates WHERE workflow_run_id = ?')
        .get(run.id) as { n: number }).n;
      expect(count).toBe(0);
    });
  });
});
