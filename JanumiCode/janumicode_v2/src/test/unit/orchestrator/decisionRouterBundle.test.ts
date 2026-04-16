/**
 * Regression tests for DecisionRouter.routeBundle — the extension-host
 * path that turns a webview `decisionBundleSubmit` message into:
 *   - per-item `decision_trace` records (audit parity with the old
 *     mirror+menu-pair flow)
 *   - one authoritative `decision_bundle_resolved` record with counters
 *   - a resolved pending decision on the engine so the phase handler
 *     awaiting the bundle unblocks
 *
 * These pin the contract the DecisionBundleCard submit button relies
 * on. A silent regression here would let the user click Submit and see
 * nothing happen — the exact kind of UX bug the bundle was introduced
 * to eliminate.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import type { Database } from '../../../lib/database/init';
import { createTestDatabase } from '../../../lib/database/init';
import { ConfigManager } from '../../../lib/config/configManager';
import { OrchestratorEngine } from '../../../lib/orchestrator/orchestratorEngine';
import { DecisionRouter } from '../../../lib/orchestrator/decisionRouter';
import type { DecisionBundleContent, DecisionBundleResolution } from '../../../lib/types/decisionBundle';

describe('DecisionRouter.routeBundle', () => {
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

  afterEach(() => { db.close(); });

  function presentBundle(): { runId: string; bundleId: string; surfaceId: string } {
    const { run } = engine.startWorkflowRun('ws-1', 'test');
    const surfaceId = 'surface-phase-1';
    const bundle: DecisionBundleContent = {
      surface_id: surfaceId,
      title: 'Phase 1 — resolve assumptions and backend',
      mirror: {
        kind: 'assumption_mirror',
        items: [
          { id: 'a1', text: 'Local SQLite storage' },
          { id: 'a2', text: 'No network calls' },
        ],
      },
      menu: {
        question: 'Pick storage backend',
        multi_select: false,
        allow_free_text: false,
        options: [
          { id: 'sqlite', label: 'SQLite' },
          { id: 'pg', label: 'Postgres' },
        ],
      },
    };
    const bundleRecord = engine.writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: run.id,
      phase_id: '1',
      janumicode_version_sha: engine.janumiCodeVersionSha,
      content: bundle as unknown as Record<string, unknown>,
    });
    void engine.pauseForDecision(run.id, bundleRecord.id, 'decision_bundle');
    return { runId: run.id, bundleId: bundleRecord.id, surfaceId };
  }

  it('writes one decision_bundle_resolved record with the expected counters', () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [
        { item_id: 'a1', action: 'accepted' },
        { item_id: 'a2', action: 'edited', edited_text: 'No outbound network calls' },
      ],
      menuSelections: [{ option_id: 'sqlite' }],
    });

    const resolved = engine.writer.getRecordsByType(runId, 'decision_bundle_resolved');
    expect(resolved).toHaveLength(1);
    const content = resolved[0].content as unknown as DecisionBundleResolution;
    expect(content.target_record_id).toBe(bundleId);
    expect(content.surface_id).toBe(surfaceId);
    expect(content.mirror_decisions).toHaveLength(2);
    expect(content.menu_selections).toHaveLength(1);
    expect(content.counters).toEqual({
      mirror_accepted: 1,
      mirror_rejected: 0,
      mirror_edited: 1,
      mirror_deferred: 0,
      menu_selected: 1,
    });
    expect(resolved[0].authority_level).toBe(5);
  });

  it('writes one decision_trace per item for audit parity with the old pair flow', () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [
        { item_id: 'a1', action: 'accepted' },
        { item_id: 'a2', action: 'rejected' },
      ],
      menuSelections: [{ option_id: 'sqlite' }],
    });

    const traces = engine.writer.getRecordsByType(runId, 'decision_trace');
    // One per mirror item + one for the menu selection.
    const bundleTraces = traces.filter(
      t => (t.content as Record<string, unknown>).target_record_id === bundleId,
    );
    expect(bundleTraces).toHaveLength(3);
    const decisionTypes = bundleTraces
      .map(t => (t.content as { decision_type: string }).decision_type)
      .sort();
    expect(decisionTypes).toEqual(['menu_selection', 'mirror_approval', 'mirror_rejection']);
  });

  it('stamps edited_text payload on mirror_edit decision_traces', () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [
        { item_id: 'a1', action: 'edited', edited_text: 'revised assumption' },
      ],
      menuSelections: [],
    });

    const traces = engine.writer.getRecordsByType(runId, 'decision_trace')
      .filter(t => (t.content as { decision_type?: string }).decision_type === 'mirror_edit');
    expect(traces).toHaveLength(1);
    const payload = (traces[0].content as { payload?: { edited_text?: string } }).payload;
    expect(payload?.edited_text).toBe('revised assumption');
  });

  it('carries free_text on _OTHER menu selections through to the trace', () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [{ item_id: 'a1', action: 'accepted' }],
      menuSelections: [{ option_id: '_OTHER', free_text: 'Use DuckDB' }],
    });

    const trace = engine.writer.getRecordsByType(runId, 'decision_trace')
      .find(t => (t.content as { option_id?: string }).option_id === '_OTHER');
    expect(trace).toBeDefined();
    const payload = (trace!.content as { payload?: { free_text?: string } }).payload;
    expect(payload?.free_text).toBe('Use DuckDB');
  });

  it('resolves the pending decision so the awaiting phase handler unblocks', async () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    // pauseForDecision returns a promise that resolves when the router
    // calls engine.resolveDecision. Presenting the bundle above already
    // created a pending decision; routeBundle should resolve it now.
    const pending = engine.pauseForDecision(runId, bundleId, 'decision_bundle');

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [{ item_id: 'a1', action: 'accepted' }],
      menuSelections: [{ option_id: 'sqlite' }],
    });

    const resolution = await Promise.race([
      pending,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100)),
    ]);
    expect((resolution as { type: string }).type).toBe('decision_bundle_resolution');
  });

  it('persists records in order: decision_traces then decision_bundle_resolved', () => {
    const { runId, bundleId, surfaceId } = presentBundle();

    router.routeBundle(runId, {
      recordId: bundleId,
      surfaceId,
      mirrorDecisions: [{ item_id: 'a1', action: 'accepted' }],
      menuSelections: [{ option_id: 'sqlite' }],
    });

    // Consumers that observe decision_bundle_resolved must be able to
    // trust every decision_trace child is already persisted. Fetch all
    // records in produced_at order and confirm the resolved record is
    // last among the bundle-linked rows.
    const rows = db
      .prepare(`
        SELECT record_type FROM governed_stream
        WHERE workflow_run_id = ? AND (
          record_type = 'decision_trace' OR
          record_type = 'decision_bundle_resolved'
        )
        ORDER BY produced_at ASC
      `)
      .all(runId) as Array<{ record_type: string }>;
    expect(rows.at(-1)?.record_type).toBe('decision_bundle_resolved');
  });
});
