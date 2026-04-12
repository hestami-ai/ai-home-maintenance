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

  it('writes decision_trace only (no follow-up) for menu_selection', () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    const menuRecord = engine.writer.writeRecord({
      record_type: 'menu_presented',
      schema_version: '1.0',
      workflow_run_id: run.id,
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: { kind: 'test_menu' },
    });
    void engine.pauseForDecision(run.id, menuRecord.id, 'menu');

    router.route(run.id, {
      recordId: menuRecord.id,
      type: 'menu_selection',
      payload: { selected: ['c1'] },
    });

    const traces = engine.writer.getRecordsByType(run.id, 'decision_trace');
    expect(traces.some(t => t.content.decision_type === 'menu_selection')).toBe(true);
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
});
