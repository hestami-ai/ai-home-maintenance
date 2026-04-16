/**
 * Regression tests for the governed-stream writer contract around the
 * composite decision-bundle records.
 *
 * Pins:
 *   1. `decision_bundle_presented` writes with authority_level=2 (agent
 *      presented, not yet acted on) so authority-based queries filter
 *      it alongside mirror_presented for the remaining Mirror-only
 *      surfaces (Phase 1.5 approval, Phases 2–10 review mirrors).
 *   2. `decision_bundle_resolved` writes with authority_level=5 (human
 *      approved) so ingestion / rollback treats it as a durable human
 *      decision, same tier as mirror_approved and phase_gate_approved.
 *   3. Both record types round-trip their content JSON intact, including
 *      the bundle's nested Mirror/Menu sections and the resolution's
 *      counters object.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { GovernedStreamWriter } from '../../../lib/orchestrator/governedStreamWriter';
import type {
  DecisionBundleContent,
  DecisionBundleResolution,
} from '../../../lib/types/decisionBundle';

let idCounter = 0;
function testId(): string { return `db-${++idCounter}`; }

describe('GovernedStreamWriter — decision bundle records', () => {
  let db: Database;
  let writer: GovernedStreamWriter;

  beforeEach(() => {
    idCounter = 0;
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES ('run-1', 'ws-1', 'dev', '2026-01-01T00:00:00Z', 'in_progress')
    `).run();
    writer = new GovernedStreamWriter(db, testId);
  });

  afterEach(() => { db.close(); });

  const sampleBundle: DecisionBundleContent = {
    surface_id: 'surface-phase-1',
    title: 'Intent bloom — confirm assumptions and pick a storage backend',
    mirror: {
      kind: 'assumption_mirror',
      items: [
        { id: 'a1', text: 'Local SQLite storage', rationale: 'single user CLI' },
        { id: 'a2', text: 'No network calls' },
      ],
    },
    menu: {
      question: 'Pick storage backend',
      multi_select: false,
      allow_free_text: false,
      options: [
        { id: 'sqlite', label: 'SQLite', recommended: true },
        { id: 'pg', label: 'Postgres' },
      ],
    },
  };

  it('writes decision_bundle_presented at authority_level 2 with content preserved', () => {
    const record = writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'dev',
      content: sampleBundle as unknown as Record<string, unknown>,
    });

    expect(record.authority_level).toBe(2);
    expect(record.record_type).toBe('decision_bundle_presented');

    // Round-trip: read it back and confirm the nested sections survive.
    const row = db
      .prepare('SELECT content, authority_level FROM governed_stream WHERE id = ?')
      .get(record.id) as { content: string; authority_level: number };
    const parsed = JSON.parse(row.content) as DecisionBundleContent;

    expect(row.authority_level).toBe(2);
    expect(parsed.surface_id).toBe('surface-phase-1');
    expect(parsed.mirror?.items).toHaveLength(2);
    expect(parsed.mirror?.items[0].rationale).toBe('single user CLI');
    expect(parsed.menu?.options).toHaveLength(2);
    expect(parsed.menu?.options[0].recommended).toBe(true);
  });

  it('writes decision_bundle_resolved at authority_level 5 so rollback treats it as durable', () => {
    // Parent bundle first so the resolution has something to derive from.
    const bundleRecord = writer.writeRecord({
      record_type: 'decision_bundle_presented',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'dev',
      content: sampleBundle as unknown as Record<string, unknown>,
    });

    const resolution: DecisionBundleResolution = {
      surface_id: sampleBundle.surface_id,
      target_record_id: bundleRecord.id,
      mirror_decisions: [
        { item_id: 'a1', action: 'accepted' },
        { item_id: 'a2', action: 'edited', edited_text: 'No outbound network calls during Phase 9' },
      ],
      menu_selections: [{ option_id: 'sqlite' }],
      counters: {
        mirror_accepted: 1,
        mirror_rejected: 0,
        mirror_edited: 1,
        mirror_deferred: 0,
        menu_selected: 1,
      },
    };

    const resolved = writer.writeRecord({
      record_type: 'decision_bundle_resolved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      phase_id: '1',
      janumicode_version_sha: 'dev',
      derived_from_record_ids: [bundleRecord.id],
      content: resolution as unknown as Record<string, unknown>,
    });

    expect(resolved.authority_level).toBe(5);
    expect(resolved.derived_from_record_ids).toContain(bundleRecord.id);

    // Round-trip the resolution content + counters.
    const row = db
      .prepare('SELECT content, authority_level FROM governed_stream WHERE id = ?')
      .get(resolved.id) as { content: string; authority_level: number };
    expect(row.authority_level).toBe(5);
    const parsed = JSON.parse(row.content) as DecisionBundleResolution;
    expect(parsed.target_record_id).toBe(bundleRecord.id);
    expect(parsed.mirror_decisions).toHaveLength(2);
    expect(parsed.menu_selections).toHaveLength(1);
    expect(parsed.counters.mirror_accepted).toBe(1);
    expect(parsed.counters.mirror_edited).toBe(1);
  });

  it('keeps authority_level parity with the other human-decided records', () => {
    // Meta-test: decision_bundle_resolved sits in the same authority
    // tier as mirror_approved / phase_gate_approved. If this ever
    // drifts, downstream queries that union across these record types
    // will start treating the bundle as less durable than its peers.
    const approved = writer.writeRecord({
      record_type: 'mirror_approved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'dev',
      content: {},
    });
    const gate = writer.writeRecord({
      record_type: 'phase_gate_approved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'dev',
      content: {},
    });
    const bundle = writer.writeRecord({
      record_type: 'decision_bundle_resolved',
      schema_version: '1.0',
      workflow_run_id: 'run-1',
      janumicode_version_sha: 'dev',
      content: {},
    });
    expect(approved.authority_level).toBe(bundle.authority_level);
    expect(gate.authority_level).toBe(bundle.authority_level);
  });
});
