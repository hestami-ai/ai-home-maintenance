/**
 * Regression tests for auto-approve attribution in the governed stream.
 *
 * Before this change, `pauseForDecision` synthesized resolutions
 * silently in auto-approve mode — no record landed in the governed
 * stream. The gap report could not distinguish "phase gate was
 * auto-approved by the harness" from "phase gate was never reached at
 * all", which is exactly the audit-trail honesty the virtuous cycle
 * depends on when a coding agent reads its own history.
 *
 * These tests pin:
 *   1. Auto-approved decisions write a `decision_trace` record with
 *      `content.attribution: 'auto_approve'`.
 *   2. The record carries the correct surface_type + decision_type so
 *      downstream consumers can filter by shape.
 *   3. When auto-approve is off, no attribution record is written on
 *      the pause path (normal webview flow is unaffected).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('OrchestratorEngine — auto-approve attribution', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
  });

  afterEach(() => { db.close(); });

  function attributionRecords(runId: string): Array<{ content: string }> {
    return db.prepare(
      `SELECT content FROM governed_stream
       WHERE workflow_run_id = ? AND record_type = 'decision_trace'
       ORDER BY produced_at`,
    ).all(runId) as Array<{ content: string }>;
  }

  it('writes a decision_trace with attribution=auto_approve on phase_gate', async () => {
    engine.setAutoApproveDecisions(true);
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    const resolution = await engine.pauseForDecision(run.id, 'gate-001', 'phase_gate');
    expect(resolution.type).toBe('phase_gate_approval');

    const traces = attributionRecords(run.id);
    expect(traces.length).toBeGreaterThan(0);
    const last = JSON.parse(traces.at(-1).content) as {
      attribution: string;
      auto_approved: boolean;
      surface_type: string;
      decision_type: string;
      target_record_id: string;
    };
    expect(last.attribution).toBe('auto_approve');
    expect(last.auto_approved).toBe(true);
    expect(last.surface_type).toBe('phase_gate');
    expect(last.decision_type).toBe('phase_gate_approval');
    expect(last.target_record_id).toBe('gate-001');
  });

  it('writes a decision_trace with attribution=auto_approve on decision_bundle', async () => {
    engine.setAutoApproveDecisions(true);
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    await engine.pauseForDecision(run.id, 'bundle-001', 'decision_bundle');

    const traces = attributionRecords(run.id);
    const last = JSON.parse(traces.at(-1).content) as {
      attribution: string;
      decision_type: string;
      surface_type: string;
    };
    expect(last.attribution).toBe('auto_approve');
    expect(last.decision_type).toBe('decision_bundle_resolution');
    expect(last.surface_type).toBe('decision_bundle');
  });

  it('does NOT write an attribution record when auto-approve is off', async () => {
    engine.setAutoApproveDecisions(false);
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    // Normal flow blocks until the webview calls resolveDecision. We
    // attach a no-op catch so the eventual rejection (from our cleanup
    // below) doesn't surface as an unhandled rejection at test-teardown.
    const pending = engine.pauseForDecision(run.id, 'gate-002', 'phase_gate')
      .catch(() => undefined);
    // Give the event loop a tick so any synchronous writes would land.
    await new Promise((r) => setTimeout(r, 20));

    const traces = attributionRecords(run.id);
    // Normal webview flow writes attribution only when DecisionRouter
    // routes an InboundDecision; pauseForDecision alone must stay silent.
    const autoApprovals = traces.filter((t) => {
      try {
        const parsed = JSON.parse(t.content) as { attribution?: string };
        return parsed.attribution === 'auto_approve';
      } catch { return false; }
    });
    expect(autoApprovals.length).toBe(0);

    engine.rejectDecision('gate-002', 'test cleanup');
    await pending;
  });
});
