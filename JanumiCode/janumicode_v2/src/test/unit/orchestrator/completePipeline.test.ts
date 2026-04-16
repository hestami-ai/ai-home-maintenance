import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Database } from '../../../lib/database/init';
import type { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { createTestEngine, type TestEngine } from '../../helpers/createTestEngine';

describe('Complete Pipeline — Phase 0 through Phase 10', () => {
  let db: Database;
  let engine: OrchestratorEngine;
  let te: TestEngine;
  let tmpWorkspace: string;

  beforeEach(async () => {
    // Isolated workspace so Phase 0 doesn't try to scan the repo root.
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-complete-pipe-'));
    // createTestEngine registers mock providers that route every
    // configured llm_routing.* provider name (google, ollama, anthropic)
    // to a MockLLMProvider, wires all 11 phase handlers, and calls
    // engine.validateLLMRouting() — so a missing provider shows up here
    // instead of silently swallowing a Reasoning Review.
    te = await createTestEngine({
      workspacePath: tmpWorkspace,
      autoApprove: true,
    });
    engine = te.engine;
    db = te.db;
  });

  afterEach(() => {
    te.cleanup();
    try { fs.rmSync(tmpWorkspace, { recursive: true, force: true }); } catch { /* ignore */ }
  });

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
