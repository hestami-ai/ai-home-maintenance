import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { Phase0Handler } from '../../../lib/orchestrator/phases/phase0';
import { Phase1Handler } from '../../../lib/orchestrator/phases/phase1';
import { Phase2Handler } from '../../../lib/orchestrator/phases/phase2';
import { Phase3Handler } from '../../../lib/orchestrator/phases/phase3';
import { Phase4Handler } from '../../../lib/orchestrator/phases/phase4';
import { Phase5Handler } from '../../../lib/orchestrator/phases/phase5';
import { Phase6Handler } from '../../../lib/orchestrator/phases/phase6';
import { Phase7Handler } from '../../../lib/orchestrator/phases/phase7';
import { Phase8Handler } from '../../../lib/orchestrator/phases/phase8';
import { Phase9Handler } from '../../../lib/orchestrator/phases/phase9';
import { Phase10Handler } from '../../../lib/orchestrator/phases/phase10';
import { ConfigManager } from '../../../lib/config/configManager';
import path from 'path';

describe('Complete Pipeline — Phase 0 through Phase 10', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.setAutoApproveDecisions(true);

    // Register ALL phases
    engine.registerPhase(new Phase0Handler());
    engine.registerPhase(new Phase1Handler());
    engine.registerPhase(new Phase2Handler());
    engine.registerPhase(new Phase3Handler());
    engine.registerPhase(new Phase4Handler());
    engine.registerPhase(new Phase5Handler());
    engine.registerPhase(new Phase6Handler());
    engine.registerPhase(new Phase7Handler());
    engine.registerPhase(new Phase8Handler());
    engine.registerPhase(new Phase9Handler());
    engine.registerPhase(new Phase10Handler());
  });

  afterEach(() => { db.close(); });

  it('executes the complete pipeline from intent to committed code', async () => {
    // Start workflow
    const { run } = engine.startWorkflowRun('ws-1');
    expect(run.current_phase_id).toBe('0');

    // Phase 0 — Workspace Initialization
    let result = await engine.executeCurrentPhase(run.id);
    expect(result.success).toBe(true);

    // Provide raw intent
    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a real-time collaborative document editor with conflict resolution, version history, and role-based access control' },
    });

    // Execute all phases in sequence
    const phases = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
    for (const phase of phases) {
      engine.advanceToNextPhase(run.id, phase);
      result = await engine.executeCurrentPhase(run.id);
      expect(result.success).toBe(true);
    }

    // Verify final state
    const finalRun = engine.stateMachine.getWorkflowRun(run.id);
    expect(finalRun!.status).toBe('completed');
    expect(finalRun!.completed_at).not.toBeNull();

    // Count total artifacts produced
    const allArtifacts = engine.writer.getRecordsByType(run.id, 'artifact_produced');
    expect(allArtifacts.length).toBeGreaterThanOrEqual(25);

    // Verify Phase 10 produced commit record and summary
    const phase10Artifacts = allArtifacts.filter(a => a.phase_id === '10');
    expect(phase10Artifacts.length).toBeGreaterThanOrEqual(3); // consistency + commit + summary
  });

  it('emits workflow:completed event on successful pipeline completion', async () => {
    let completedRunId: string | null = null;
    engine.eventBus.on('workflow:completed', (p) => { completedRunId = p.workflowRunId; });

    const { run } = engine.startWorkflowRun('ws-1');

    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a simple calculator' },
    });

    await engine.executeCurrentPhase(run.id);
    for (const phase of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
      engine.advanceToNextPhase(run.id, phase);
      await engine.executeCurrentPhase(run.id);
    }

    expect(completedRunId).toBe(run.id);
  });

  it('produces memory edges throughout the pipeline', async () => {
    const { run } = engine.startWorkflowRun('ws-1');

    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build a notes app' },
    });

    await engine.executeCurrentPhase(run.id);
    for (const phase of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
      engine.advanceToNextPhase(run.id, phase);
      await engine.executeCurrentPhase(run.id);
    }

    // Check memory edges were created by the ingestion pipeline
    const edges = db.prepare('SELECT COUNT(*) as count FROM memory_edge').get() as { count: number };
    expect(edges.count).toBeGreaterThan(0);
  });

  it('all governed stream records have required universal fields', async () => {
    const { run } = engine.startWorkflowRun('ws-1');

    engine.writer.writeRecord({
      record_type: 'raw_intent_received',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { text: 'Build an API' },
    });

    await engine.executeCurrentPhase(run.id);
    for (const phase of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const) {
      engine.advanceToNextPhase(run.id, phase);
      await engine.executeCurrentPhase(run.id);
    }

    // Verify all records have universal fields
    const allRecords = db.prepare(
      'SELECT * FROM governed_stream WHERE workflow_run_id = ?'
    ).all(run.id) as Record<string, unknown>[];

    expect(allRecords.length).toBeGreaterThan(0);

    for (const record of allRecords) {
      expect(record.id).toBeTruthy();
      expect(record.record_type).toBeTruthy();
      expect(record.schema_version).toBeTruthy();
      expect(record.produced_at).toBeTruthy();
      expect(record.janumicode_version_sha).toBeTruthy();
      expect(record.source_workflow_run_id).toBeTruthy();
      expect(typeof record.authority_level).toBe('number');
    }
  });
});
