import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import { DecisionTraceGenerator } from '../../../lib/memory/decisionTraceGenerator';

let idCounter = 0;
function testId(): string {
  return `dt-test-${++idCounter}`;
}

describe('DecisionTraceGenerator', () => {
  let db: Database;
  let writer: GovernedStreamWriter;
  let generator: DecisionTraceGenerator;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    writer = new GovernedStreamWriter(db, testId);
    generator = new DecisionTraceGenerator(db);

    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('generates an empty summary when no decisions exist', () => {
    const summary = generator.generate('run-1', '1', 'Intent Capture');

    expect(summary.decisionCount).toBe(0);
    expect(summary.decisions).toHaveLength(0);
    expect(summary.rollbackCount).toBe(0);
    expect(summary.domainAttestationConfirmed).toBe(false);
  });

  it('collects decision_trace records for the specified phase', () => {
    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      sub_phase_id: '1.3',
      janumicode_version_sha: 'abc',
      content: {
        decision_type: 'menu_selection',
        human_selection: 'Option A',
        context_presented: 'Choose product concept',
      },
    });

    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      sub_phase_id: '1.5',
      janumicode_version_sha: 'abc',
      content: {
        decision_type: 'mirror_approval',
        human_selection: 'Approved',
      },
    });

    // Different phase — should NOT be included
    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '2',
      sub_phase_id: '2.3',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'menu_selection', human_selection: 'B' },
    });

    const summary = generator.generate('run-1', '1', 'Intent Capture');

    expect(summary.decisionCount).toBe(2);
    expect(summary.decisions[0].decisionType).toBe('menu_selection');
    expect(summary.decisions[1].decisionType).toBe('mirror_approval');
  });

  it('counts special decision types correctly', () => {
    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'prior_decision_override', human_selection: 'Override' },
    });

    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'system_proposal_approval', human_selection: 'Approve' },
    });

    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'domain_attestation', human_selection: 'Confirmed' },
    });

    const summary = generator.generate('run-1', '1', 'Intent Capture');

    expect(summary.priorDecisionOverrideCount).toBe(1);
    expect(summary.systemProposalApprovalCount).toBe(1);
    expect(summary.domainAttestationConfirmed).toBe(true);
    expect(summary.rollbackCount).toBe(0);
  });

  it('excludes superseded (non-current) records', () => {
    const record = writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'menu_selection', human_selection: 'Old' },
    });

    // Supersede it via rollback
    writer.supersedByRollback(record.id, 'new-id');

    writer.writeRecord({
      record_type: 'decision_trace',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'abc',
      content: { decision_type: 'menu_selection', human_selection: 'New' },
    });

    const summary = generator.generate('run-1', '1', 'Intent Capture');

    // Only the current version should be included
    expect(summary.decisionCount).toBe(1);
    expect(summary.decisions[0].humanSelection).toBe('New');
  });
});
