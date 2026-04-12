import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { StateMachine } from '../../../lib/orchestrator/stateMachine';

describe('StateMachine', () => {
  let db: Database;
  let sm: StateMachine;

  beforeEach(() => {
    db = createTestDatabase();
    sm = new StateMachine(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('createWorkflowRun', () => {
    it('creates a workflow run at Phase 0', () => {
      const run = sm.createWorkflowRun({
        id: 'run-1',
        workspace_id: 'ws-1',
        janumicode_version_sha: 'abc123',
      });

      expect(run.id).toBe('run-1');
      expect(run.current_phase_id).toBe('0');
      expect(run.status).toBe('initiated');
      expect(run.current_sub_phase_id).toBeNull();
    });

    it('persists to database', () => {
      sm.createWorkflowRun({
        id: 'run-1',
        workspace_id: 'ws-1',
        janumicode_version_sha: 'abc123',
      });

      const retrieved = sm.getWorkflowRun('run-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.workspace_id).toBe('ws-1');
    });
  });

  describe('getWorkflowRun', () => {
    it('returns null for nonexistent run', () => {
      expect(sm.getWorkflowRun('nonexistent')).toBeNull();
    });
  });

  describe('advancePhase — valid transitions', () => {
    it('advances from Phase 0 to Phase 1', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      const result = sm.advancePhase('run-1', '1');

      expect(result.success).toBe(true);
      expect(result.previousPhase).toBe('0');
      expect(result.newPhase).toBe('1');

      const run = sm.getWorkflowRun('run-1');
      expect(run!.current_phase_id).toBe('1');
      expect(run!.current_sub_phase_id).toBeNull(); // Cleared on phase change
    });

    it('advances through full standard sequence 0→1→2→...→10', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });

      const standardSequence = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
      for (const target of standardSequence) {
        const result = sm.advancePhase('run-1', target);
        expect(result.success).toBe(true);
      }

      const run = sm.getWorkflowRun('run-1');
      expect(run!.current_phase_id).toBe('10');
    });

    it('advances from Phase 1 to Phase 0.5 when cross_run_impact_triggered', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');
      sm.setCrossRunImpactTriggered('run-1', true);

      const result = sm.advancePhase('run-1', '0.5');
      expect(result.success).toBe(true);
      expect(result.newPhase).toBe('0.5');
    });

    it('advances from Phase 0.5 to Phase 2', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');
      sm.setCrossRunImpactTriggered('run-1', true);
      sm.advancePhase('run-1', '0.5');

      const result = sm.advancePhase('run-1', '2');
      expect(result.success).toBe(true);
    });

    it('advances from Phase 0.5 back to Phase 1 (revise override)', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');
      sm.setCrossRunImpactTriggered('run-1', true);
      sm.advancePhase('run-1', '0.5');

      const result = sm.advancePhase('run-1', '1');
      expect(result.success).toBe(true);
    });
  });

  describe('advancePhase — invalid transitions', () => {
    it('rejects skipping phases (0 → 2)', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      const result = sm.advancePhase('run-1', '2');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('rejects backward transitions via advancePhase (must use rollback)', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');
      sm.advancePhase('run-1', '2');

      const result = sm.advancePhase('run-1', '1');
      expect(result.success).toBe(false);
    });

    it('rejects Phase 0.5 without cross_run_impact_triggered', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');

      const result = sm.advancePhase('run-1', '0.5');
      expect(result.success).toBe(false);
      expect(result.error).toContain('cross_run_impact_triggered');
    });

    it('rejects advance from terminal Phase 10', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      // Advance through all phases
      for (const p of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
        sm.advancePhase('run-1', p);
      }

      // 10 has no valid targets
      const result = sm.advancePhase('run-1', '1');
      expect(result.success).toBe(false);
    });

    it('rejects advance for nonexistent run', () => {
      const result = sm.advancePhase('nonexistent', '1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('setSubPhase', () => {
    it('sets the current sub-phase', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.setSubPhase('run-1', '0.1');

      const run = sm.getWorkflowRun('run-1');
      expect(run!.current_sub_phase_id).toBe('0.1');
    });
  });

  describe('rollbackToPhase', () => {
    it('rolls back to a prior phase', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');
      sm.advancePhase('run-1', '2');
      sm.advancePhase('run-1', '3');

      const result = sm.rollbackToPhase('run-1', '1');
      expect(result.success).toBe(true);
      expect(result.previousPhase).toBe('3');

      const run = sm.getWorkflowRun('run-1');
      expect(run!.current_phase_id).toBe('1');
      expect(run!.current_sub_phase_id).toBeNull();
    });

    it('rejects rollback to same or later phase', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');

      const result = sm.rollbackToPhase('run-1', '1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be before');
    });

    it('rejects rollback to later phase', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.advancePhase('run-1', '1');

      const result = sm.rollbackToPhase('run-1', '2');
      expect(result.success).toBe(false);
    });
  });

  describe('completeWorkflowRun / failWorkflowRun', () => {
    it('marks run as completed', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.completeWorkflowRun('run-1');

      const run = sm.getWorkflowRun('run-1');
      expect(run!.status).toBe('completed');
      expect(run!.completed_at).not.toBeNull();
    });

    it('marks run as failed', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });
      sm.failWorkflowRun('run-1');

      const run = sm.getWorkflowRun('run-1');
      expect(run!.status).toBe('failed');
      expect(run!.completed_at).not.toBeNull();
    });
  });

  describe('sub-phase execution log', () => {
    it('logs and retrieves retry count', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });

      sm.logSubPhaseAttempt({
        id: 'attempt-1',
        workflow_run_id: 'run-1',
        phase_id: '1',
        sub_phase_id: '1.2',
        attempt_number: 1,
      });

      expect(sm.getRetryCount('run-1', '1.2')).toBe(1);

      sm.logSubPhaseAttempt({
        id: 'attempt-2',
        workflow_run_id: 'run-1',
        phase_id: '1',
        sub_phase_id: '1.2',
        attempt_number: 2,
      });

      expect(sm.getRetryCount('run-1', '1.2')).toBe(2);
    });

    it('completes a sub-phase attempt', () => {
      sm.createWorkflowRun({ id: 'run-1', workspace_id: 'ws-1', janumicode_version_sha: 'abc' });

      sm.logSubPhaseAttempt({
        id: 'attempt-1',
        workflow_run_id: 'run-1',
        phase_id: '1',
        sub_phase_id: '1.2',
        attempt_number: 1,
      });

      sm.completeSubPhaseAttempt('attempt-1', 'completed');

      const row = db.prepare(
        'SELECT * FROM sub_phase_execution_log WHERE id = ?'
      ).get('attempt-1') as Record<string, unknown>;

      expect(row.status).toBe('completed');
      expect(row.completed_at).not.toBeNull();
    });
  });
});
