/**
 * Regression tests for headless decision overrides.
 *
 * Before this change, `--decision-overrides` was parsed by the CLI,
 * normalized by HeadlessLiaisonAdapter, and stored on a private map
 * that nothing ever read. Overrides silently did nothing — a footgun
 * the harness CI couldn't detect because mock fixtures don't fail the
 * pipeline when menus default to "empty selections".
 *
 * These tests pin:
 *   1. An `index_N` override on a decision_bundle sub-phase routes
 *      through `pauseForDecision` and emits a menu_selection with the
 *      Nth option_id from the presented bundle.
 *   2. A literal `option_id` override picks that exact option.
 *   3. A `reject` override on a mirror surface emits `mirror_rejection`.
 *   4. The attribution record flips to `headless_override` (not
 *      `auto_approve`) when an override actually fires.
 *   5. Out-of-range / typo'd selectors fall back to the empty default
 *      instead of crashing — keeps the pipeline runnable when an
 *      override is addressed to a sub-phase that doesn't match.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';

describe('OrchestratorEngine — headless decision overrides', () => {
  let db: Database;
  let engine: OrchestratorEngine;

  beforeEach(() => {
    db = createTestDatabase();
    const configManager = new ConfigManager();
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    engine = new OrchestratorEngine(db, configManager, workspacePath);
    engine.setAutoApproveDecisions(true);
  });

  afterEach(() => { db.close(); });

  function writeBundle(runId: string, subPhaseId: string): string {
    const record = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: runId,
      phase_id: subPhaseId.split('.')[0],
      sub_phase_id: subPhaseId,
      janumicode_version_sha: 'dev',
      content: {
        surface_id: `bundle-${subPhaseId}`,
        menu: {
          options: [
            { id: 'concept_a', label: 'First concept' },
            { id: 'concept_b', label: 'Second concept' },
            { id: 'concept_c', label: 'Third concept' },
          ],
        },
      },
    });
    return record.id;
  }

  function lastDecisionTrace(runId: string): Record<string, unknown> {
    const row = db.prepare(
      `SELECT content FROM governed_stream
       WHERE workflow_run_id = ? AND record_type = 'decision_trace'
       ORDER BY produced_at DESC LIMIT 1`,
    ).get(runId) as { content: string };
    return JSON.parse(row.content) as Record<string, unknown>;
  }

  it('translates index_1 on a decision_bundle into the second menu option', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.stateMachine.setSubPhase(run.id, '1.3');
    engine.setDecisionOverrides(new Map([['1.3', 'index_1']]));

    const bundleId = writeBundle(run.id, '1.3');
    const resolution = await engine.pauseForDecision(run.id, bundleId, 'decision_bundle');

    expect(resolution.type).toBe('decision_bundle_resolution');
    const selections = (resolution.payload as { menu_selections: Array<{ option_id: string }> })
      .menu_selections;
    expect(selections).toEqual([{ option_id: 'concept_b' }]);

    const trace = lastDecisionTrace(run.id);
    expect(trace.attribution).toBe('headless_override');
    expect(trace.override_selection).toBe('index_1');
    expect(trace.auto_approved).toBe(false);
  });

  it('accepts a literal option_id override', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.stateMachine.setSubPhase(run.id, '1.3');
    engine.setDecisionOverrides(new Map([['1.3', 'concept_c']]));

    const bundleId = writeBundle(run.id, '1.3');
    const resolution = await engine.pauseForDecision(run.id, bundleId, 'decision_bundle');
    const selections = (resolution.payload as { menu_selections: Array<{ option_id: string }> })
      .menu_selections;
    expect(selections).toEqual([{ option_id: 'concept_c' }]);
  });

  it('falls back to empty selection when the override index is out of range', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.stateMachine.setSubPhase(run.id, '1.3');
    engine.setDecisionOverrides(new Map([['1.3', 'index_99']]));

    const bundleId = writeBundle(run.id, '1.3');
    const resolution = await engine.pauseForDecision(run.id, bundleId, 'decision_bundle');
    const selections = (resolution.payload as { menu_selections: unknown[] }).menu_selections;
    // Out-of-range selector degrades to empty — pipeline keeps going
    // with the default "keep all candidates" behavior in Phase 1.
    expect(selections).toEqual([]);
  });

  it('reject override on a mirror surface emits mirror_rejection', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.stateMachine.setSubPhase(run.id, '1.5');
    engine.setDecisionOverrides(new Map([['1.5', 'reject']]));

    const resolution = await engine.pauseForDecision(run.id, 'mirror-001', 'mirror');
    expect(resolution.type).toBe('mirror_rejection');
  });

  it('no-override default still yields auto_approve attribution', async () => {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    engine.stateMachine.setSubPhase(run.id, '1.3');
    // No overrides set.
    const bundleId = writeBundle(run.id, '1.3');
    await engine.pauseForDecision(run.id, bundleId, 'decision_bundle');

    const trace = lastDecisionTrace(run.id);
    expect(trace.attribution).toBe('auto_approve');
    expect(trace.auto_approved).toBe(true);
    expect(trace.override_selection).toBeNull();
  });
});
