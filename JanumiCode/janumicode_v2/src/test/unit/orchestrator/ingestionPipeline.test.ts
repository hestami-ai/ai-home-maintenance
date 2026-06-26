import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { IngestionPipelineRunner } from '../../../lib/orchestrator/ingestionPipelineRunner';

let idCounter = 0;
function testId(): string {
  return `test-${++idCounter}`;
}

describe('IngestionPipelineRunner', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let pipeline: IngestionPipelineRunner;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    pipeline = new IngestionPipelineRunner(db, testId);

    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  describe('Stage I+II', () => {
    it('completes stages 1 and 2', () => {
      const record = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {},
      });

      const result = pipeline.ingest(record);
      expect(result.stagesCompleted).toContain(1);
      expect(result.stagesCompleted).toContain(2);
      expect(result.errors).toHaveLength(0);
    });

    it('creates derives_from edges for artifact_produced', () => {
      const parent = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {},
      });

      const child = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        derived_from_record_ids: [parent.id],
        content: {},
      });

      const result = pipeline.ingest(child);
      expect(result.edgesCreated).toHaveLength(1);
      expect(result.edgesCreated[0].edgeType).toBe('derives_from');
      expect(result.edgesCreated[0].sourceRecordId).toBe(child.id);
      expect(result.edgesCreated[0].targetRecordId).toBe(parent.id);

      // Verify edge persisted in database
      const edges = db.prepare(
        'SELECT * FROM memory_edge WHERE source_record_id = ?'
      ).all(child.id) as Record<string, unknown>[];
      expect(edges.length).toBe(1);
      expect(edges[0].edge_type).toBe('derives_from');
    });

    it('creates validates edges for phase_gate_approved', () => {
      const artifact = writer.writeRecord({
        record_type: 'artifact_produced',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {},
      });

      const gate = writer.writeRecord({
        record_type: 'phase_gate_approved',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { artifact_ids: [artifact.id] },
      });

      const result = pipeline.ingest(gate);
      expect(result.edgesCreated).toHaveLength(1);
      expect(result.edgesCreated[0].edgeType).toBe('validates');
    });

    it('creates supersedes edge for prior_decision_override', () => {
      const priorDecision = writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { decision_type: 'menu_selection' },
      });

      const override = writer.writeRecord({
        record_type: 'decision_trace',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          decision_type: 'prior_decision_override',
          superseded_record_id: priorDecision.id,
        },
      });

      const result = pipeline.ingest(override);
      expect(result.edgesCreated).toHaveLength(1);
      expect(result.edgesCreated[0].edgeType).toBe('supersedes');
      // No superseding_record_id → source falls back to the decision_trace.
      expect(result.edgesCreated[0].sourceRecordId).toBe(override.id);
      expect(result.edgesCreated[0].targetRecordId).toBe(priorDecision.id);
    });

    it('prior_decision_override edge runs superseding → superseded when a superseding record is named', () => {
      const prior = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', content: { kind: 'interface_contract', statement: 'auth required' },
      });
      const replacement = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', content: { kind: 'interface_contract', statement: 'no auth' },
      });
      const override = writer.writeRecord({
        record_type: 'decision_trace', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          decision_type: 'prior_decision_override',
          superseded_record_id: prior.id,
          superseding_record_id: replacement.id,
        },
      });

      const result = pipeline.ingest(override);
      expect(result.edgesCreated).toHaveLength(1);
      const edge = result.edgesCreated[0];
      expect(edge.edgeType).toBe('supersedes');
      // Source is the NEW governing artifact (harvestable), not the trace.
      expect(edge.sourceRecordId).toBe(replacement.id);
      expect(edge.targetRecordId).toBe(prior.id);
    });

    it('Stage IV: cross_run_modification supersedes the modified prior-run artifact (Option B producer-side mint)', () => {
      const priorArtifact = writer.writeRecord({
        record_type: 'artifact_produced', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc', content: { kind: 'interface_contracts', statement: 'delete-by-key endpoint present' },
      });
      const mod = writer.writeRecord({
        record_type: 'cross_run_modification', schema_version: '1.0', workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: {
          kind: 'cross_run_modification',
          modified_artifact_id: priorArtifact.id,
          changed_interface_id: 'IC-DELETE-001',
          modification_type: 'breaking',
          applied_status: 'applied',
        },
      });

      pipeline.ingest(mod);

      const edges = db.prepare(
        `SELECT source_record_id s, target_record_id t, status FROM memory_edge WHERE edge_type='supersedes'`,
      ).all() as Array<{ s: string; t: string; status: string }>;
      const edge = edges.find(e => e.s === mod.id && e.t === priorArtifact.id);
      expect(edge, 'the applied modification should supersede the modified prior-run artifact').toBeDefined();
      expect(edge!.status).toBe('system_asserted');
    });

    it('creates no edges for record types without rules', () => {
      const record = writer.writeRecord({
        record_type: 'agent_reasoning_step',
        schema_version: '1.0',
        workflow_run_id: 'run-1',
        janumicode_version_sha: 'abc',
        content: { text: 'thinking...' },
      });

      const result = pipeline.ingest(record);
      expect(result.edgesCreated).toHaveLength(0);
    });
  });
});
