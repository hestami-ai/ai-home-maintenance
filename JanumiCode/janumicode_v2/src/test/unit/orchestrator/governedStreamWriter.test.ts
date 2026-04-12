import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { AuthorityLevel } from '../../../lib/types/records';

let idCounter = 0;
function testIdGenerator(): string {
  return `test-id-${++idCounter}`;
}

describe('GovernedStreamWriter', () => {
  let db: Database;
  let writer: GovernedStreamWriter;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testIdGenerator);

    // Create a workflow run for FK constraint
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc123', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('writeRecord', () => {
    it('writes a record with all universal fields populated', () => {
      const record = writer.writeRecord({
        record_type: 'raw_intent_received',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        phase_id: '1',
        sub_phase_id: '1.1',
        janumicode_version_sha: 'abc123',
        content: { text: 'Build me an app' },
      });

      expect(record.id).toBe('test-id-1');
      expect(record.record_type).toBe('raw_intent_received');
      expect(record.workflow_run_id).toBe('run-1');
      expect(record.phase_id).toBe('1');
      expect(record.produced_at).toBeTruthy();
      expect(record.effective_at).toBeTruthy();
      expect(record.is_current_version).toBe(true);
      expect(record.quarantined).toBe(false);
      expect(record.derived_from_system_proposal).toBe(false);
      expect(record.content).toEqual({ text: 'Build me an app' });
    });

    it('persists record to database and retrieves it', () => {
      writer.writeRecord({
        record_type: 'raw_intent_received',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { text: 'test' },
      });

      const retrieved = writer.getRecord('test-id-1');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.record_type).toBe('raw_intent_received');
      expect(retrieved!.content).toEqual({ text: 'test' });
    });

    it('defaults source_workflow_run_id to workflow_run_id', () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.source_workflow_run_id).toBe('run-1');
    });

    it('allows explicit source_workflow_run_id (cross-run refactoring)', () => {
      const record = writer.writeRecord({
        record_type: 'cross_run_modification',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        source_workflow_run_id: 'prior-run',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.source_workflow_run_id).toBe('prior-run');
    });
  });

  describe('authority level assignment', () => {
    it('assigns Human-Approved (5) for raw_intent_received', () => {
      const record = writer.writeRecord({
        record_type: 'raw_intent_received',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.authority_level).toBe(AuthorityLevel.HumanApproved);
    });

    it('assigns Human-Approved (5) for decision_trace', () => {
      const record = writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.authority_level).toBe(AuthorityLevel.HumanApproved);
    });

    it('assigns Human-Edited (4) for mirror_edited', () => {
      const record = writer.writeRecord({
        record_type: 'mirror_edited',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.authority_level).toBe(AuthorityLevel.HumanEdited);
    });

    it('assigns Agent-Asserted (2) for agent_output', () => {
      const record = writer.writeRecord({
        record_type: 'agent_output',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      expect(record.authority_level).toBe(AuthorityLevel.AgentAsserted);
    });

    it('allows explicit authority level override', () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        authority_level: AuthorityLevel.PhaseGateCertified,
        content: {},
      });

      expect(record.authority_level).toBe(AuthorityLevel.PhaseGateCertified);
    });
  });

  describe('derived_from_system_proposal propagation', () => {
    it('propagates flag from parent with authority < 5', () => {
      // Create a parent record with system proposal flag
      const parent = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        authority_level: AuthorityLevel.Exploratory, // Level 1
        content: {},
      });

      // Manually set the system proposal flag on parent
      db.prepare(`
        UPDATE governed_stream SET derived_from_system_proposal = 1 WHERE id = ?
      `).run(parent.id);

      // Create child derived from parent
      const child = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        derived_from_record_ids: [parent.id],
        content: {},
      });

      expect(child.derived_from_system_proposal).toBe(true);
    });

    it('does not propagate flag from parent with authority >= 5', () => {
      const parent = writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      // Parent has authority 5 (Human-Approved), so even with flag it won't propagate
      db.prepare(`
        UPDATE governed_stream SET derived_from_system_proposal = 1 WHERE id = ?
      `).run(parent.id);

      const child = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        derived_from_record_ids: [parent.id],
        content: {},
      });

      expect(child.derived_from_system_proposal).toBe(false);
    });
  });

  describe('quarantineRecord', () => {
    it('sets quarantined flag', () => {
      writer.writeRecord({
        record_type: 'agent_output',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      writer.quarantineRecord('test-id-1');

      const record = writer.getRecord('test-id-1');
      expect(record!.quarantined).toBe(true);
    });
  });

  describe('supersession', () => {
    it('marks record as superseded by rollback', () => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      writer.supersedByRollback('test-id-1', 'new-record-id');

      const record = writer.getRecord('test-id-1');
      expect(record!.is_current_version).toBe(false);
      expect(record!.superseded_by_id).toBe('new-record-id');
      expect(record!.superseded_at).not.toBeNull();
    });

    it('marks record as semantically superseded', () => {
      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: {},
      });

      writer.semanticSupersession('test-id-1', 'superseding-record-id');

      const record = writer.getRecord('test-id-1');
      // is_current_version stays true for semantic supersession
      expect(record!.is_current_version).toBe(true);
      expect(record!.superseded_by_record_id).toBe('superseding-record-id');
      expect(record!.superseded_at).not.toBeNull();
    });
  });

  describe('getRecordsByType', () => {
    it('returns records of specified type in chronological order', () => {
      writer.writeRecord({
        record_type: 'agent_reasoning_step',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { step: 1 },
      });

      writer.writeRecord({
        record_type: 'agent_reasoning_step',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { step: 2 },
      });

      writer.writeRecord({
        record_type: 'tool_call',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { tool: 'Read' },
      });

      const steps = writer.getRecordsByType('run-1', 'agent_reasoning_step');
      expect(steps.length).toBe(2);
      expect(steps[0].content).toEqual({ step: 1 });
      expect(steps[1].content).toEqual({ step: 2 });
    });

    it('excludes non-current versions by default', () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { v: 1 },
      });

      writer.supersedByRollback(record.id, 'new-id');

      writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc123',
        content: { v: 2 },
      });

      const current = writer.getRecordsByType('run-1', 'artifact_produced', true);
      expect(current.length).toBe(1);
      expect(current[0].content).toEqual({ v: 2 });

      const all = writer.getRecordsByType('run-1', 'artifact_produced', false);
      expect(all.length).toBe(2);
    });
  });
});
