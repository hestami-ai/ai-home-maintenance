/**
 * Characterization tests for {@link loadFindings} — pins the surfacing +
 * item-binding behavior with a small in-memory governed_stream (no cal-40
 * clone required, so these run in normal CI, complementing the gated
 * findingsJoin.test.ts).
 *
 * Behavior pinned (from the loader's original logic):
 *   - keep HIGH/MEDIUM only (drop LOW);
 *   - drop AUTO_FIX_VALIDATORS findings;
 *   - drop findings whose reviewed artifact (via harness_id) was superseded;
 *   - malformed finding JSON is skipped but still counts in `total`;
 *   - bind cited AC ids → ac_ids, US/NFR/component keys → display_keys;
 *   - a surfaced finding citing no known item is counted `unbound`, not shipped;
 *   - REASONING_PROCESS_VALIDATORS → category 'process', else 'artifact';
 *   - summary.total = current finding rows; surfaced = bound + unbound.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, type Database } from '../../../lib/database/init';
import { loadFindings } from '../../../lib/decompViewer/findingsLoader';

const RUN = 'run-1';

function insertGoverned(
  db: Database,
  row: { id: string; record_type: string; content: string; is_current_version?: number },
): void {
  db.prepare(`
    INSERT INTO governed_stream (
      id, record_type, schema_version, workflow_run_id, produced_at,
      janumicode_version_sha, authority_level, is_current_version,
      source_workflow_run_id, content
    ) VALUES (?, ?, '1.0', ?, '2026-01-01T00:00:00Z', 'abc', 2, ?, ?, ?)
  `).run(row.id, row.record_type, RUN, row.is_current_version ?? 1, RUN, row.content);
}

function insertFinding(
  db: Database,
  id: string,
  content: Record<string, unknown> | string,
): void {
  insertGoverned(db, {
    id,
    record_type: 'reasoning_review_finding_record',
    content: typeof content === 'string' ? content : JSON.stringify(content),
  });
}

function baseFinding(over: Record<string, unknown>): Record<string, unknown> {
  return {
    kind: 'reasoning_review_finding',
    validator_id: 'spec_boundary_respect_bloom',
    severity: 'HIGH',
    finding_type: 'boundary',
    summary: '',
    location: '',
    detail: 'detail text',
    recommendation: 'do the thing',
    duration_ms: 1,
    ...over,
  };
}

describe('loadFindings (in-memory characterization)', () => {
  let db: Database;

  beforeEach(() => {
    db = createTestDatabase();
    db.prepare(`
      INSERT INTO workflow_runs (id, workspace_id, janumicode_version_sha, initiated_at, status)
      VALUES (?, 'ws-1', 'abc', '2026-01-01T00:00:00Z', 'initiated')
    `).run(RUN);

    // Item id sets: one requirement (US-001 + leaf AC) and one component.
    insertGoverned(db, {
      id: 'req-1',
      record_type: 'requirement_decomposition_node',
      content: JSON.stringify({
        display_key: 'US-001',
        user_story: { acceptance_criteria: [{ id: 'AC-US001-001' }] },
      }),
    });
    insertGoverned(db, {
      id: 'comp-1',
      record_type: 'component_decomposition_node',
      content: JSON.stringify({ display_key: 'comp-billing', component: { id: 'COMP-BILLING' } }),
    });

    // Harness map: H-OK → current output; H-SUP → a superseded output.
    insertGoverned(db, {
      id: 'harness-ok',
      record_type: 'reasoning_review_harness_record',
      content: JSON.stringify({ harness_id: 'H-OK', reviewed_agent_output_id: 'OUT-OK' }),
    });
    insertGoverned(db, {
      id: 'harness-sup',
      record_type: 'reasoning_review_harness_record',
      content: JSON.stringify({ harness_id: 'H-SUP', reviewed_agent_output_id: 'OUT-SUP' }),
    });
    // The superseded reviewed output (is_current_version = 0).
    insertGoverned(db, {
      id: 'OUT-SUP',
      record_type: 'artifact_produced',
      content: '{}',
      is_current_version: 0,
    });

    // F1: HIGH, cites leaf AC, non-superseded harness → bound (ac_ids).
    insertFinding(db, 'F1', baseFinding({ summary: 'Violates AC-US001-001 scope', harness_id: 'H-OK' }));
    // F2: MEDIUM, cites US key → bound (display_keys), category artifact.
    insertFinding(db, 'F2', baseFinding({ validator_id: 'measurability_check', severity: 'MEDIUM', summary: 'US-001 unclear' }));
    // F3: MEDIUM, PROCESS validator, cites component key → bound, category process.
    insertFinding(db, 'F3', baseFinding({ validator_id: 'reasoning_quality_validator', severity: 'MEDIUM', summary: 'comp-billing reasoning gap' }));
    // F4: LOW → dropped (not surfaced).
    insertFinding(db, 'F4', baseFinding({ validator_id: 'measurability_check', severity: 'LOW', summary: 'AC-US001-001 nit' }));
    // F5: HIGH auto-fix validator → dropped (not surfaced).
    insertFinding(db, 'F5', baseFinding({ validator_id: 'json_output_discipline_check', summary: 'US-001 json' }));
    // F6: HIGH but reviewed artifact superseded → dropped (not surfaced).
    insertFinding(db, 'F6', baseFinding({ summary: 'US-001 stale', harness_id: 'H-SUP' }));
    // F7: HIGH, cites an unknown id → surfaced but unbound (not shipped).
    insertFinding(db, 'F7', baseFinding({ summary: 'AC-UNKNOWN-999 orphan' }));
    // F8: malformed content → skipped in parse, but still counts in total.
    insertFinding(db, 'F8', '{not valid json');
  });

  afterEach(() => { db.close(); });

  it('accounts every current finding row in the summary', () => {
    const { summary } = loadFindings(db, RUN);
    expect(summary.total).toBe(8);            // F1..F8 (malformed included)
    expect(summary.surfaced).toBe(4);         // F1,F2,F3,F7 (LOW/auto-fix/superseded/malformed dropped)
    expect(summary.bound).toBe(3);            // F1,F2,F3
    expect(summary.unbound).toBe(1);          // F7
    expect(summary.surfaced).toBe(summary.bound + summary.unbound);
    expect(summary.by_severity).toEqual({ HIGH: 2, MEDIUM: 2 });
  });

  it('ships only the bound findings', () => {
    const { findings } = loadFindings(db, RUN);
    expect(findings.map((f) => f.record_id).sort()).toEqual(['F1', 'F2', 'F3']);
  });

  it('binds an AC citation to ac_ids (artifact category)', () => {
    const f = loadFindings(db, RUN).findings.find((x) => x.record_id === 'F1')!;
    expect(f.severity).toBe('HIGH');
    expect(f.ac_ids).toEqual(['AC-US001-001']);
    expect(f.display_keys).toEqual([]);
    expect(f.cited_ids).toEqual(['AC-US001-001']);
    expect(f.category).toBe('artifact');
  });

  it('binds a US citation to display_keys', () => {
    const f = loadFindings(db, RUN).findings.find((x) => x.record_id === 'F2')!;
    expect(f.severity).toBe('MEDIUM');
    expect(f.display_keys).toEqual(['US-001']);
    expect(f.ac_ids).toEqual([]);
    expect(f.category).toBe('artifact');
  });

  it('tags reasoning-PROCESS validators as category process and binds component keys', () => {
    const f = loadFindings(db, RUN).findings.find((x) => x.record_id === 'F3')!;
    expect(f.display_keys).toEqual(['comp-billing']);
    expect(f.category).toBe('process');
  });

  it('drops auto-fix, LOW, and superseded findings from the surfaced set', () => {
    const { findings } = loadFindings(db, RUN);
    const ids = new Set(findings.map((f) => f.record_id));
    expect(ids.has('F4')).toBe(false); // LOW
    expect(ids.has('F5')).toBe(false); // auto-fix
    expect(ids.has('F6')).toBe(false); // superseded
  });
});
