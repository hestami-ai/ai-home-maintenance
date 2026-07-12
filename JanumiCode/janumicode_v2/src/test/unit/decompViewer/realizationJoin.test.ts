/**
 * Decomposition Viewer — unified drill-down realization join (gated on JANUMICODE_CAL40_DB).
 *
 * Verifies the host builds the US → AC → {task, component, data-model} join from
 * a real run, with the right edge counts and drift surfaced (not fabricated).
 * Skips cleanly when no clone is present (commit-nothing policy).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BetterSqlite3 = require('better-sqlite3');
import { DecompViewerDataProvider } from '../../../lib/decompViewer/decompViewerDataProvider';
import type { Database } from '../../../lib/database/init';

const CAL40 = process.env.JANUMICODE_CAL40_DB;
const run = CAL40 && fs.existsSync(CAL40) ? describe : describe.skip;

run('cal-40 realization join (gated on JANUMICODE_CAL40_DB)', () => {
  // Setup runs in beforeAll, NOT at describe-collection time, so the default
  // skipped path (JANUMICODE_CAL40_DB unset → describe.skip) never opens a DB.
  // A collection-time `new BetterSqlite3(undefined, { readonly: true })` throws
  // "In-memory/temporary databases cannot be readonly" on better-sqlite3 12.8.0
  // and fails the whole file even though every test is meant to be skipped.
  let db: Database & { close(): void };
  let runId: string;
  let provider: DecompViewerDataProvider;
  let snap: ReturnType<DecompViewerDataProvider['getSnapshot']>;
  const byLayer = (l: string) => snap.realization_nodes.filter((n) => n.layer === l);
  beforeAll(() => {
    db = new BetterSqlite3(CAL40, { readonly: true }) as unknown as Database & { close(): void };
    runId = (db.prepare('SELECT id FROM workflow_runs ORDER BY rowid LIMIT 1').get() as { id: string }).id;
    provider = new DecompViewerDataProvider(db);
    snap = provider.getSnapshot(runId);
  });

  // Invariants, not exact counts — the clone mutates (interactive Tier-2
  // driving, re-clones from a moving source), so we assert the join's shape.

  it('loads the requirement spine + journeys', () => {
    expect(snap.roots.length).toBeGreaterThanOrEqual(8); // ≥ 7 US + 1 NFR
    expect(snap.phase1_anchors.filter((a) => a.kind === 'user_journey').length).toBeGreaterThanOrEqual(7);
  });

  it('loads all downstream families as realization nodes', () => {
    expect(byLayer('component').length).toBeGreaterThan(40);
    expect(byLayer('task').length).toBeGreaterThan(100);
    expect(byLayer('data_model').length).toBeGreaterThan(100);
    expect(byLayer('test').length).toBeGreaterThanOrEqual(0); // Phase 7 usually absent
  });

  it('joins tasks to their user stories + components', () => {
    const tasks = byLayer('task');
    // Nearly every task resolves to ≥1 requirement root and a component.
    expect(tasks.filter((t) => t.serves_us_ids.length > 0).length / tasks.length).toBeGreaterThan(0.9);
    expect(tasks.filter((t) => t.component_key).length / tasks.length).toBeGreaterThan(0.9);
    // Served roots are always US-/NFR- ids (never leaves or SR).
    for (const t of tasks) {
      for (const id of t.serves_us_ids) expect(/^(US|NFR)-/.test(id)).toBe(true);
    }
    // A meaningful fraction of tasks bind valid leaf ACs.
    expect(tasks.filter((t) => t.realizes_ac_ids.length > 0).length).toBeGreaterThan(20);
  });

  it('attaches data models to components', () => {
    const dms = byLayer('data_model');
    expect(dms.filter((d) => d.component_key).length / dms.length).toBeGreaterThan(0.85);
  });

  it('surfaces drift instead of fabricating edges', () => {
    // …every kept realizes_ac_id IS a real leaf AC (no fabricated edges).
    const validAcs = new Set(
      snap.nodes.flatMap((n) => n.acceptance_criteria.map((ac) => ac.id)),
    );
    for (const t of byLayer('task')) {
      for (const ac of t.realizes_ac_ids) expect(validAcs.has(ac)).toBe(true);
    }
    // Any unresolved AC ref that IS surfaced must be a genuine miss.
    for (const ac of snap.realization_drift.unresolved_ac_ids) {
      expect(validAcs.has(ac)).toBe(false);
    }
  });

  // ── M5: Phase-7 test layer wiring ────────────────────────────────

  it('loads Phase-7 test nodes and binds them to leaf ACs', () => {
    const tests = byLayer('test');
    expect(tests.length).toBeGreaterThan(0); // phase-9 clone has test_decomposition_node
    // Most tests cite a real leaf AC (so they render under the AC spine)…
    expect(tests.filter((t) => t.realizes_ac_ids.length > 0).length / tests.length).toBeGreaterThan(0.8);
    // …and resolve to a component.
    expect(tests.filter((t) => t.component_key).length / tests.length).toBeGreaterThan(0.8);
    const validAcs = new Set(snap.nodes.flatMap((n) => n.acceptance_criteria.map((ac) => ac.id)));
    for (const t of tests) for (const ac of t.realizes_ac_ids) expect(validAcs.has(ac)).toBe(true);
  });

  // ── M4: base / realization split + delta mechanics ───────────────

  it('splits realization out of the base snapshot', () => {
    const base = provider.getBaseSnapshot(runId);
    expect(base.realization_nodes).toHaveLength(0);
    expect(base.realization_drift.unresolved_ac_ids).toHaveLength(0);
    expect(base.realization_drift.unresolved_component_ids).toHaveLength(0);
    // Base carries the requirement spine + roots (rendered immediately).
    expect(base.nodes.length).toBeGreaterThan(0);
    expect(base.roots.length).toBeGreaterThanOrEqual(8);
    // Base revision is stable across calls and independent of realization.
    expect(provider.getBaseSnapshot(runId).revision).toBe(base.revision);
  });

  it('realization payload carries the full set + a fingerprint per record', () => {
    const payload = provider.getRealizationPayload(runId);
    expect(payload.nodes.length).toBe(snap.realization_nodes.length);
    expect(payload.hashes.size).toBe(payload.nodes.length); // one fingerprint per record_id
    for (const n of payload.nodes) expect(payload.hashes.has(n.record_id)).toBe(true);
    // Deterministic: two payloads produce identical fingerprints + revision.
    const again = provider.getRealizationPayload(runId);
    expect(again.revision).toBe(payload.revision);
    for (const n of payload.nodes) expect(again.hashes.get(n.record_id)).toBe(payload.hashes.get(n.record_id));
  });

  it('delta diff is empty when nothing changed (idempotent poll)', () => {
    // Mirror the editor's diff against a prior identical fingerprint map.
    const first = provider.getRealizationPayload(runId);
    const second = provider.getRealizationPayload(runId);
    const upserts = second.nodes.filter((n) => first.hashes.get(n.record_id) !== second.hashes.get(n.record_id));
    const removed = [...first.hashes.keys()].filter((id) => !second.hashes.has(id));
    expect(upserts).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  // ── M6: on-demand node-detail fetch (inspector drawer) ───────────

  it('fetches full content for a clicked realization node', () => {
    const task = byLayer('task')[0];
    const detail = provider.getNodeDetail(runId, task.record_id);
    expect(detail).not.toBeNull();
    expect(detail!.record_type).toBe('task_decomposition_node');
    expect(typeof (detail!.content.task as { name?: string })?.name).toBe('string');

    const test = byLayer('test')[0];
    const td = provider.getNodeDetail(runId, test.record_id);
    expect(td!.record_type).toBe('test_decomposition_node');

    // Unknown id → null (drawer shows "no longer available", never fabricates).
    expect(provider.getNodeDetail(runId, 'no-such-record-id')).toBeNull();
    // Cross-run isolation: a real id under the wrong run id resolves to null.
    expect(provider.getNodeDetail('not-a-run', task.record_id)).toBeNull();
  });
});
