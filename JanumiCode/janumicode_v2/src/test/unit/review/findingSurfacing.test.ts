import { describe, it, expect } from 'vitest';

import {
  AUTO_FIX_VALIDATORS,
  baseScopeKey,
  categorizeCoherence,
  extractCitedIds,
  findingInScope,
  renderFindingLine,
  selectReasoningFindings,
  type SurfacedFinding,
  type TaskScope,
} from '../../../lib/review/findingSurfacing';
import type { GovernedStreamRecord } from '../../../lib/types/records';

// ── Minimal in-memory GovernedStreamWriter stand-in ────────────────────
// findingSurfacing only uses getRecordsByType + getRecord + record.is_current_version.
function makeWriter(records: Partial<GovernedStreamRecord>[]): {
  getRecordsByType: (runId: string, type: string) => GovernedStreamRecord[];
  getRecord: (id: string) => GovernedStreamRecord | null;
} {
  const full = records.map((r, i) => ({
    id: r.id ?? `rec-${i}`,
    record_type: r.record_type ?? 'unknown',
    is_current_version: r.is_current_version ?? true,
    derived_from_record_ids: r.derived_from_record_ids ?? [],
    content: r.content ?? {},
    ...r,
  })) as GovernedStreamRecord[];
  return {
    getRecordsByType: (_runId, type) => full.filter((r) => r.record_type === type && r.is_current_version),
    getRecord: (id) => full.find((r) => r.id === id) ?? null,
  };
}

function finding(id: string, c: Record<string, unknown>): Partial<GovernedStreamRecord> {
  return {
    id, record_type: 'reasoning_review_finding_record', is_current_version: true,
    content: { kind: 'reasoning_review_finding', severity: 'HIGH', summary: 's', location: '', recommendation: 'r', finding_type: 'ft', ...c },
  };
}

describe('extractCitedIds', () => {
  it('pulls AC/US/NFR ids from target_identifier + location + summary', () => {
    const ids = extractCitedIds({ target_identifier: 'NFR-001', location: 'requirements / NFR-001', summary: 'AC-US002-003 mandates X' } as never);
    expect(ids).toContain('NFR-001');
    expect(ids).toContain('AC-US002-003');
  });
  it('ignores non-id target identifiers', () => {
    expect(extractCitedIds({ target_identifier: 'N/A', location: 'proposed_edges list', summary: 'thinking chain' } as never)).toEqual([]);
  });
});

describe('baseScopeKey — root↔leaf bridging', () => {
  it('reduces composite ACs to the parent story and strips leaf markers', () => {
    expect(baseScopeKey('AC-US001-002')).toBe('US-001');
    expect(baseScopeKey('AC-US-001-D-001')).toBe('US-001'); // leaf AC → root story
    expect(baseScopeKey('US-001-D')).toBe('US-001');        // leaf US → root
    expect(baseScopeKey('NFR-001')).toBe('NFR-001');        // NFR stable
  });
});

describe('findingInScope', () => {
  const scope: TaskScope = { userStoryIds: ['US-001-D'], acceptanceCriterionIds: ['AC-US-001-D-001'], nfrIds: ['NFR-006', 'NFR-002'], componentId: 'comp-link' };
  const f = (citedIds: string[]): SurfacedFinding => ({ recordId: 'x', validatorId: 'grounding_validator', severity: 'HIGH', findingType: 't', summary: 's', location: '', recommendation: '', citedIds });

  it('matches an NFR finding exactly', () => {
    expect(findingInScope(f(['NFR-006']), scope)).toBe(true);
  });
  it('bridges a root-phase AC/US finding to a leaf packet via story key', () => {
    expect(findingInScope(f(['AC-US001-009']), scope)).toBe(true); // AC-US001-* → US-001 ≡ US-001-D
    expect(findingInScope(f(['US-001']), scope)).toBe(true);
  });
  it('rejects an unrelated requirement', () => {
    expect(findingInScope(f(['NFR-099']), scope)).toBe(false);
    expect(findingInScope(f(['AC-US007-001']), scope)).toBe(false);
  });
  it('rejects when the task scope is empty', () => {
    expect(findingInScope(f(['NFR-006']), { userStoryIds: [], acceptanceCriterionIds: [], nfrIds: [] })).toBe(false);
  });
});

describe('selectReasoningFindings', () => {
  it('keeps substantive HIGH/MEDIUM, drops the auto-fix bucket', () => {
    const writer = makeWriter([
      finding('f1', { validator_id: 'measurement_method_executability', severity: 'HIGH', harness_id: 'h1' }),
      finding('f2', { validator_id: 'json_output_discipline_check', severity: 'MEDIUM', harness_id: 'h1' }),
      finding('f3', { validator_id: 'final_synthesis', severity: 'HIGH', harness_id: 'h1' }),
      finding('f4', { validator_id: 'grounding_validator', severity: 'LOW', harness_id: 'h1' }), // LOW dropped
    ]);
    const out = selectReasoningFindings(writer as never, 'wf', { forExecutor: true });
    expect(out.map((f) => f.recordId)).toEqual(['f1']);
    expect([...AUTO_FIX_VALIDATORS]).toContain('json_output_discipline_check');
  });

  it('drops reasoning-PROCESS validators for the executor but keeps them otherwise', () => {
    const writer = makeWriter([
      finding('f1', { validator_id: 'reasoning_to_response_faithfulness', severity: 'HIGH', harness_id: 'h1' }),
    ]);
    expect(selectReasoningFindings(writer as never, 'wf', { forExecutor: true })).toHaveLength(0);
    expect(selectReasoningFindings(writer as never, 'wf', { forExecutor: false })).toHaveLength(1);
  });

  it('drops auto-mitigated findings', () => {
    const writer = makeWriter([
      finding('f1', { validator_id: 'grounding_validator', severity: 'HIGH', harness_id: 'h1' }),
      { id: 'm1', record_type: 'auto_mitigation_action', is_current_version: true, content: { kind: 'auto_mitigation_action', finding_record_id: 'f1' } },
    ]);
    expect(selectReasoningFindings(writer as never, 'wf', { forExecutor: true })).toHaveLength(0);
  });

  it('drops findings whose reviewed output was superseded', () => {
    const writer = makeWriter([
      finding('f1', { validator_id: 'grounding_validator', severity: 'HIGH', harness_id: 'h-stale' }),
      finding('f2', { validator_id: 'grounding_validator', severity: 'HIGH', harness_id: 'h-live' }),
      { id: 'h1', record_type: 'reasoning_review_harness_record', is_current_version: true, content: { kind: 'reasoning_review_harness', harness_id: 'h-stale', reviewed_agent_output_id: 'out-stale' } },
      { id: 'h2', record_type: 'reasoning_review_harness_record', is_current_version: true, content: { kind: 'reasoning_review_harness', harness_id: 'h-live', reviewed_agent_output_id: 'out-live' } },
      { id: 'out-stale', record_type: 'agent_output', is_current_version: false, content: {} }, // superseded
      { id: 'out-live', record_type: 'agent_output', is_current_version: true, content: {} },
    ]);
    const out = selectReasoningFindings(writer as never, 'wf', { forExecutor: true });
    expect(out.map((f) => f.recordId)).toEqual(['f2']);
  });
});

describe('renderFindingLine', () => {
  it('renders severity, validator, type, summary + recommendation', () => {
    const line = renderFindingLine({ recordId: 'x', validatorId: 'measurement_method_executability', severity: 'HIGH', findingType: 'missing_tool', summary: 'no instrument named', location: '', recommendation: 'name a Prometheus histogram', citedIds: [] });
    expect(line).toBe('- [HIGH] measurement_method_executability :: missing_tool — no instrument named → Fix: name a Prometheus histogram');
  });
});

describe('categorizeCoherence', () => {
  it('splits actionable (with remedy) from FYI', () => {
    const { actionable, fyi } = categorizeCoherence([
      'P8_CC_NO_TEST: completion criterion CC-001 has no covering test',
      'A3_UNMEASURABLE_EVAL_CRITERION: target NFR-008 lacks measurable predicate',
      'P4_USER_STORY_NO_EVAL: US-005 has no evaluation criterion',
      'C3_DEPENDENCY_DAG_CYCLE: cycle a→b→a',
    ]);
    expect(actionable.map((a) => a.code)).toEqual(['P8_CC_NO_TEST', 'A3_UNMEASURABLE_EVAL_CRITERION']);
    expect(actionable[0].remedy).toMatch(/Author a covering test/);
    expect(fyi).toHaveLength(2);
    expect(fyi[1]).toContain('C3_DEPENDENCY_DAG_CYCLE');
  });
});
