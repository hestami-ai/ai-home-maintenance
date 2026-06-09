/**
 * Headless simulate-human-decisions mode — verifies the auto-advance loop
 * CERTIFIES each phase gate (writes phase_gate_approved + ingests it →
 * `validates` edges → Authority-6 elevation) instead of advancing silently.
 *
 * This is the headless exerciser for the DMR's active_constraints
 * accumulation, which is otherwise dormant because auto-approve never
 * produces a phase_gate_approved record (Finding 1 of the DMR audit).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseContext, PhaseHandler, PhaseResult } from '../../../lib/orchestrator/orchestratorEngine';
import type { PhaseId } from '../../../lib/types/records';

/**
 * A phase handler that emits a governing artifact plus a phase_gate_evaluation
 * deriving from it — exactly what a real phase produces and what the
 * certification reads to know which artifacts the gate certifies.
 */
class GateEmittingHandler implements PhaseHandler {
  public artifactId = '';
  public gateId = '';
  constructor(
    public readonly phaseId: PhaseId,
    private readonly engine: OrchestratorEngine,
  ) {}
  async execute(ctx: PhaseContext): Promise<PhaseResult> {
    const runId = ctx.workflowRun.id;
    const artifact = this.engine.writer.writeRecord({
      record_type: 'artifact_produced', schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: this.phaseId, janumicode_version_sha: this.engine.janumiCodeVersionSha,
      content: { kind: 'system_boundary', statement: 'single-tenant' },
    });
    this.artifactId = artifact.id;
    const gate = this.engine.writer.writeRecord({
      record_type: 'phase_gate_evaluation', schema_version: '1.0',
      workflow_run_id: runId, phase_id: this.phaseId,
      janumicode_version_sha: this.engine.janumiCodeVersionSha,
      derived_from_record_ids: [artifact.id],
      content: { kind: 'gate' },
    });
    this.gateId = gate.id;
    return { success: true, artifactIds: [artifact.id, gate.id] };
  }
}

describe('OrchestratorEngine — simulate-human-decisions gate certification', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const extensionPath = path.resolve(__dirname, '..', '..', '..', '..');
    const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'jc-test-ws-'));
    engine = new OrchestratorEngine(db, configManager, workspacePath, extensionPath);
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  it('certifies the phase gate (phase_gate_approved + validates edges) when enabled', async () => {
    engine.setSimulateHumanDecisions(true);
    engine.setPhaseLimit('1'); // certify phase 1's gate, then stop.
    const handler = new GateEmittingHandler('1', engine);
    engine.registerPhase(new GateEmittingHandler('0', engine));
    engine.registerPhase(handler);

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    await engine.executeCurrentPhase(run.id);

    // The gate was certified: a phase_gate_approved record carries the
    // certified artifact top-level, and a system_asserted `validates` edge
    // points to it.
    const approved = engine.writer.getRecordsByType(run.id, 'phase_gate_approved');
    expect(approved.length).toBe(1);
    expect(approved[0].content.approved_artifact_ids).toEqual([handler.artifactId]);

    const edges = db.prepare(
      `SELECT target_record_id FROM memory_edge
       WHERE edge_type='validates' AND status='system_asserted' AND source_record_id=?`,
    ).all(approved[0].id) as Array<{ target_record_id: string }>;
    expect(edges.map(e => e.target_record_id)).toEqual([handler.artifactId]);
  });

  it('does NOT certify gates when simulate mode is off (default headless behavior)', async () => {
    engine.setPhaseLimit('1');
    engine.registerPhase(new GateEmittingHandler('0', engine));
    engine.registerPhase(new GateEmittingHandler('1', engine));

    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.advanceToNextPhase(run.id, '1');
    await engine.executeCurrentPhase(run.id);

    // No phase_gate_approved — auto-approve advanced silently (the dormancy
    // the simulate flag exists to lift).
    expect(engine.writer.getRecordsByType(run.id, 'phase_gate_approved').length).toBe(0);
  });
});
