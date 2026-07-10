/**
 * Regression tests for packetSynthesis collectors.
 *
 * Why these tests exist
 * ─────────────────────
 * The ts-108 audit traced every implementation_packet having empty
 * `nfrs`, `compliance_items`, and (for evaluation_thresholds) reasoning
 * `evaluation_criteria` to collector bugs in `packetSynthesis.ts`:
 *
 *  - `collectNfrs` looked for kind=`nonfunctional_requirements` and
 *    arrayKey=`nonfunctional_requirements`, but the real artifact emits
 *    kind=`non_functional_requirements` (with underscore) and the array
 *    under `requirements`.
 *  - `collectComplianceItems` looked for `compliance_extracted_items`
 *    (snake) but the real artifact emits `complianceExtractedItems`
 *    (camel).
 *  - `collectEvaluationCriteria` mapped evaluation_thresholds to a
 *    `criteria[]` array; the real artifact emits `scenarios[]` with a
 *    different per-item shape ({id, description, pass_criteria}).
 *
 * Phase 9's implementation-task executor receives these packets. When
 * the collectors silently return [], the executor sees NO non-functional
 * requirements, NO compliance constraints, and NO reasoning-eval
 * criteria for any task — even though the upstream sub-phases emitted
 * them correctly.
 *
 * The bug pattern is "snake_case key vs camelCase key" and "wrong nested
 * shape". These tests pin the actual artifact shapes against the
 * collectors so any future schema drift on either side fails loudly
 * here instead of silently emptying the Phase 9 input.
 *
 * Fixture data shapes are taken from real ts-108 governed_stream
 * artifacts (captured 2026-05-26/27). When upstream shapes change,
 * update the fixtures AND the collector in tandem.
 */

import { describe, it, expect } from 'vitest';
import {
  collectUserStories,
  collectNfrs,
  collectComplianceItems,
  collectCrossCuttingConstraints,
  collectEvaluationCriteria,
  collectTestSuites,
} from '../../../lib/orchestrator/phases/packetSynthesis';
import type { GovernedStreamRecord } from '../../../lib/types/records';

// ── Fixture builders ──────────────────────────────────────────────

function artifactRec(
  subPhase: string,
  content: Record<string, unknown>,
  id = `rec-${subPhase}-${Math.random().toString(36).slice(2, 8)}`,
): GovernedStreamRecord {
  return {
    id,
    record_type: 'artifact_produced',
    schema_version: '1.0',
    workflow_run_id: 'run-test',
    phase_id: '1',
    sub_phase_id: subPhase,
    produced_by_agent_role: 'test',
    produced_at: new Date().toISOString(),
    is_current_version: 1,
    janumicode_version_sha: 'test',
    derived_from_record_ids: [],
    content,
  } as unknown as GovernedStreamRecord;
}

// ── FR collector ─────────────────────────────────────────────────

describe('collectUserStories', () => {
  it('returns user_stories from fr_bloom_skeleton artifact (real ts-108 shape)', () => {
    const rec = artifactRec('fr_bloom_skeleton', {
      kind: 'functional_requirements',
      user_stories: [
        {
          id: 'US-001',
          role: 'Link Sharer',
          action: 'submit a long URL via web form to create a short URL',
          outcome: 'a short URL slug is generated and stored',
          priority: 'critical',
          traces_to: ['UJ-CREATE-SHORT-URL', 'ENT-MAPPING'],
          acceptance_criteria: [{ id: 'AC-001', description: 'short URL returned' }],
        },
      ],
    });
    const got = collectUserStories([rec]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('US-001');
    expect(got[0].traces_to).toContain('UJ-CREATE-SHORT-URL');
  });

  it('returns [] when no fr_bloom_skeleton artifact present', () => {
    expect(collectUserStories([])).toEqual([]);
  });

  it('skips records with wrong kind (defensive against shape drift)', () => {
    const rec = artifactRec('fr_bloom_skeleton', { kind: 'something_else', user_stories: [{ id: 'US-001' }] });
    expect(collectUserStories([rec])).toEqual([]);
  });

  // ── FR-rooted atomic saturation-leaf path (requirement_decomposition_node) ──
  // Characterization: leaves carry a `user_story` under the leaf's own id and
  // are the anchors for composite AC ids; selection is latest-per-node
  // (supersession-aware) and gated on kind/root_kind/status.
  const leafNode = (
    id: string,
    nodeId: string,
    producedAt: string,
    story: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ): GovernedStreamRecord => ({
    id,
    record_type: 'requirement_decomposition_node',
    is_current_version: 1,
    produced_at: producedAt,
    content: {
      kind: 'requirement_decomposition_node',
      root_kind: 'fr',
      status: 'atomic',
      node_id: nodeId,
      user_story: story,
      ...extra,
    },
  } as unknown as GovernedStreamRecord);

  it('collects an FR-rooted atomic leaf user_story, latest-per-node (supersession-aware)', () => {
    const older = leafNode('r-old', 'N-1', '2026-01-01T00:00:00.000Z', { id: 'US-004-AUTH-D1', action: 'old' });
    const newer = leafNode('r-new', 'N-1', '2026-02-01T00:00:00.000Z', { id: 'US-004-AUTH-D1', action: 'new' });
    const got = collectUserStories([older, newer]);
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe('US-004-AUTH-D1');
    expect(got[0].action).toBe('new'); // later produced_at wins
  });

  it('includes a leaf with no root_kind (treated as FR)', () => {
    const leaf = leafNode('r1', 'N-4', '2026-01-01T00:00:00.000Z', { id: 'US-NR-1' });
    // remove root_kind to exercise the `!c.root_kind` branch
    delete (leaf.content as Record<string, unknown>).root_kind;
    expect(collectUserStories([leaf]).map((s) => s.id)).toEqual(['US-NR-1']);
  });

  it('excludes non-FR-rooted or non-atomic leaves', () => {
    const nonFr = leafNode('r2', 'N-2', '2026-01-01T00:00:00.000Z', { id: 'X-1' }, { root_kind: 'nfr' });
    const nonAtomic = leafNode('r3', 'N-3', '2026-01-01T00:00:00.000Z', { id: 'X-2' }, { status: 'decomposed' });
    expect(collectUserStories([nonFr, nonAtomic])).toEqual([]);
  });

  it('roots take precedence over a same-id leaf (roots inserted first)', () => {
    const root = artifactRec('fr_bloom_skeleton', {
      kind: 'functional_requirements',
      user_stories: [{ id: 'US-001', action: 'root' }],
    });
    const leaf = leafNode('r-leaf', 'N-9', '2026-03-01T00:00:00.000Z', { id: 'US-001', action: 'leaf' });
    const got = collectUserStories([root, leaf]);
    expect(got).toHaveLength(1);
    expect(got[0].action).toBe('root'); // first-wins: root kept, leaf skipped
  });
});

// ── NFR collector (REGRESSION for the ts-108 bug) ────────────────

describe('collectNfrs', () => {
  it('REGRESSION: returns NFRs from real ts-108 artifact shape (kind=non_functional_requirements, array under `requirements`)', () => {
    const rec = artifactRec('nfr_bloom_skeleton', {
      kind: 'non_functional_requirements',
      requirements: [
        {
          id: 'NFR-001',
          category: 'performance',
          description: 'Redirect endpoint p95 latency ≤ 100ms',
          priority: 'critical',
          threshold: 'p95 ≤ 100ms',
          traces_to: ['VV-REDIRECT-LATENCY'],
          applies_to_requirements: ['US-001', 'US-003'],
        },
        {
          id: 'NFR-003',
          category: 'reliability',
          description: 'RTO on regional failure ≤ 15 min',
          priority: 'high',
          traces_to: ['VV-REGIONAL-RTO'],
        },
      ],
    });
    const got = collectNfrs([rec]);
    // Before the fix this returned []; ts-108 lost ALL NFR context in
    // every implementation_packet because of it.
    expect(got).toHaveLength(2);
    expect(got.map((n) => n.id)).toEqual(['NFR-001', 'NFR-003']);
  });

  it('REGRESSION: rejects the old (wrong) kind string `nonfunctional_requirements` to detect schema-drift if anyone reverts', () => {
    const rec = artifactRec('nfr_bloom_skeleton', {
      kind: 'nonfunctional_requirements', // OLD wrong kind
      requirements: [{ id: 'NFR-001' }],
    });
    // With the fix the collector requires `non_functional_requirements`
    // exactly; this records the contract.
    expect(collectNfrs([rec])).toEqual([]);
  });

  it('REGRESSION: rejects the old (wrong) array key `nonfunctional_requirements` to detect schema-drift', () => {
    const rec = artifactRec('nfr_bloom_skeleton', {
      kind: 'non_functional_requirements',
      nonfunctional_requirements: [{ id: 'NFR-001' }], // OLD wrong key
    });
    expect(collectNfrs([rec])).toEqual([]);
  });

  it('returns [] when no nfr_bloom_skeleton artifact present', () => {
    expect(collectNfrs([])).toEqual([]);
  });
});

// ── Compliance collector (REGRESSION for the snake/camel bug) ────

describe('collectComplianceItems', () => {
  it('REGRESSION: returns compliance items under camelCase `complianceExtractedItems` (real ts-108 shape)', () => {
    const compRec = artifactRec('compliance_retention_discovery', {
      kind: 'compliance_retention_discovery',
      complianceExtractedItems: [
        { id: 'COMP-GDPR-EU', type: 'CONSTRAINT', text: 'GDPR applies to EU sharers' },
        { id: 'COMP-AES-256', type: 'CONSTRAINT', text: 'URLs encrypted at rest using AES-256' },
      ],
    });
    const got = collectComplianceItems([compRec]);
    // Before the fix the collector looked for snake-case `compliance_extracted_items`,
    // which doesn't exist on the real artifact — returned empty map.
    expect(got.size).toBe(2);
    expect(got.get('COMP-GDPR-EU')?.kind).toBe('compliance');
  });

  it('REGRESSION: rejects the old (wrong) snake_case key `compliance_extracted_items`', () => {
    const compRec = artifactRec('compliance_retention_discovery', {
      kind: 'compliance_retention_discovery',
      compliance_extracted_items: [{ id: 'COMP-X' }], // OLD wrong key
    });
    expect(collectComplianceItems([compRec]).size).toBe(0);
  });

  it('also collects vv_requirements_discovery items under `vvRequirements`', () => {
    const vvRec = artifactRec('vv_requirements_discovery', {
      kind: 'vv_requirements_discovery',
      vvRequirements: [
        { id: 'VV-REDIRECT-LATENCY', category: 'performance', threshold: '≤ 100 ms' },
      ],
    });
    const got = collectComplianceItems([vvRec]);
    expect(got.size).toBe(1);
    expect(got.get('VV-REDIRECT-LATENCY')?.kind).toBe('vv_requirement');
  });

  it('collects integrations_qa_bloom qualityAttributes as synthetic QA-N ids', () => {
    const rec = artifactRec('integrations_qa_bloom', {
      kind: 'quality_attributes',
      qualityAttributes: ['Low latency redirects', 'High availability'],
    });
    const got = collectComplianceItems([rec]);
    expect(got.size).toBe(2);
    expect(got.get('QA-1')).toMatchObject({ kind: 'quality_attribute', description: 'Low latency redirects' });
    expect(got.get('QA-2')?.description).toBe('High availability');
  });

  it('prefers item.text over item.target for the description', () => {
    const rec = artifactRec('compliance_retention_discovery', {
      kind: 'compliance_retention_discovery',
      complianceExtractedItems: [
        { id: 'COMP-1', text: 'from text', target: 'from target' },
        { id: 'COMP-2', target: 'target only' },
      ],
    });
    const got = collectComplianceItems([rec]);
    expect(got.get('COMP-1')?.description).toBe('from text');
    expect(got.get('COMP-2')?.description).toBe('target only');
  });
});

// ── Cross-cutting constraints collector (Lever 1a) ───────────────────

describe('collectCrossCuttingConstraints', () => {
  it('collects concerns from a current cross_cutting_constraints artifact (id fallback + non-string filtering)', () => {
    const rec = artifactRec('cross_cutting_bloom', {
      kind: 'cross_cutting_constraints',
      concerns: [
        { id: 'CC-LOG', name: 'Logging', responsibilities: ['structured logs', 42], applies_to_components: ['comp-a', 'comp-b'] },
        { id: 'CC-SEC' }, // minimal — name falls back to id, arrays default to []
      ],
    });
    const got = collectCrossCuttingConstraints([rec]);
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({
      id: 'CC-LOG',
      name: 'Logging',
      responsibilities: ['structured logs'], // non-string 42 filtered out
      applies_to_components: ['comp-a', 'comp-b'],
    });
    expect(got[1]).toEqual({ id: 'CC-SEC', name: 'CC-SEC', responsibilities: [], applies_to_components: [] });
  });

  it('skips records that are not the current version', () => {
    const rec = artifactRec('cross_cutting_bloom', {
      kind: 'cross_cutting_constraints',
      concerns: [{ id: 'CC-X' }],
    });
    (rec as unknown as { is_current_version: number }).is_current_version = 0;
    expect(collectCrossCuttingConstraints([rec])).toEqual([]);
  });

  it('skips concerns without a string id', () => {
    const rec = artifactRec('cross_cutting_bloom', {
      kind: 'cross_cutting_constraints',
      concerns: [{ name: 'no id here' }, { id: 42 }],
    });
    expect(collectCrossCuttingConstraints([rec])).toEqual([]);
  });

  it('returns [] when no cross_cutting_constraints artifact present', () => {
    expect(collectCrossCuttingConstraints([])).toEqual([]);
  });
});

// ── Evaluation criteria collector ────────────────────────────────

describe('collectEvaluationCriteria', () => {
  it('returns functional criteria from evaluation_design (`criteria` array)', () => {
    const rec = artifactRec('evaluation_design', {
      kind: 'functional_evaluation_plan',
      criteria: [
        {
          functional_requirement_id: 'US-002',
          evaluation_method: 'Automated integration test on GET /{slug}',
          success_condition: 'HTTP 302 returned within 100 ms',
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ kind: 'functional', target_id: 'US-002' });
  });

  it('returns quality criteria from evaluation_metrics', () => {
    const rec = artifactRec('evaluation_metrics', {
      kind: 'quality_evaluation_plan',
      criteria: [
        {
          nonfunctional_requirement_id: 'NFR-001',
          evaluation_method: 'Latency probe every 5 minutes',
          success_condition: 'p95 ≤ 100 ms',
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0].kind).toBe('quality');
  });

  it('REGRESSION: accepts evaluation_metrics field aliases nfr_id / measurement_method / threshold (real ts-108 shape)', () => {
    // ts-108 evaluation_metrics actually emits {nfr_id, measurement_method,
    // threshold} rather than {nonfunctional_requirement_id, evaluation_method,
    // success_condition}. The collector must accept both schema families.
    const rec = artifactRec('evaluation_metrics', {
      kind: 'quality_evaluation_plan',
      criteria: [
        {
          nfr_id: 'NFR-001',
          category: 'performance',
          evaluation_tool: 'JMeter',
          measurement_method: 'Run JMeter load test, compute 95th percentile latency',
          threshold: '≤ 100 ms 95th percentile latency over any 5-min window',
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      kind: 'quality',
      target_id: 'NFR-001',
      evaluation_method: 'Run JMeter load test, compute 95th percentile latency',
      success_condition: '≤ 100 ms 95th percentile latency over any 5-min window',
    });
  });

  it('REGRESSION: maps evaluation_thresholds.scenarios[] to reasoning-kind criteria (real ts-108 shape)', () => {
    const rec = artifactRec('evaluation_thresholds', {
      kind: 'reasoning_evaluation_plan',
      scenarios: [
        {
          id: 'RS-001',
          description: 'User submits a URL containing a malicious payload',
          pass_criteria: 'System rejects with HTTP 400 and logs a warning',
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    // Before the fix the collector looked for `content.criteria` (which
    // evaluation_thresholds doesn't emit) — silently produced no
    // reasoning criteria. Now scenarios become reasoning criteria.
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      kind: 'reasoning',
      target_id: 'RS-001',
      success_condition: 'System rejects with HTTP 400 and logs a warning',
    });
  });

  it('CHARACTERIZATION: drops evaluation_thresholds scenarios lacking a string id, and defaults missing description/pass_criteria to ""', () => {
    // Pins the per-scenario mapping branches: a scenario with no (or
    // non-string) `id` is skipped entirely; a kept scenario with missing
    // `description` / `pass_criteria` yields empty-string method/condition.
    const rec = artifactRec('evaluation_thresholds', {
      kind: 'reasoning_evaluation_plan',
      scenarios: [
        { description: 'no id here', pass_criteria: 'ignored' }, // dropped: no id
        { id: 123, description: 'numeric id', pass_criteria: 'ignored' }, // dropped: non-string id
        { id: 'RS-002' }, // kept: missing description/pass_criteria default to ''
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0]).toEqual({
      kind: 'reasoning',
      target_id: 'RS-002',
      evaluation_method: '',
      success_condition: '',
    });
  });

  it('CHARACTERIZATION: ignores an evaluation_thresholds record whose scenarios is not an array', () => {
    const rec = artifactRec('evaluation_thresholds', {
      kind: 'reasoning_evaluation_plan',
      scenarios: { id: 'RS-003' }, // not an array
    });
    expect(collectEvaluationCriteria([rec])).toEqual([]);
  });

  it('attaches a VALID property_spec on a quality criterion (Phase 8 generative property)', () => {
    const rec = artifactRec('evaluation_metrics', {
      kind: 'quality_evaluation_plan',
      criteria: [
        {
          nfr_id: 'NFR-010',
          measurement_method: 'property-based test',
          threshold: 'holds for all inputs',
          property_spec: { invariant: 'output is idempotent', input_domain: 'all valid urls' },
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0].property_spec).toMatchObject({ invariant: 'output is idempotent', input_domain: 'all valid urls' });
  });

  it('DROPS a malformed property_spec (missing input_domain) — no rule-less property reaches the executor', () => {
    const rec = artifactRec('evaluation_metrics', {
      kind: 'quality_evaluation_plan',
      criteria: [
        {
          nfr_id: 'NFR-011',
          measurement_method: 'x',
          threshold: 'y',
          property_spec: { invariant: 'only invariant, no domain' },
        },
      ],
    });
    const got = collectEvaluationCriteria([rec]);
    expect(got).toHaveLength(1);
    expect(got[0].property_spec).toBeUndefined();
  });

  it('returns [] when no evaluation artifacts present', () => {
    expect(collectEvaluationCriteria([])).toEqual([]);
  });
});

// ── Test suites collector ────────────────────────────────────────

describe('collectTestSuites', () => {
  it('returns test suites under `test_suites` (real ts-108 shape)', () => {
    const rec = artifactRec('test_case_skeleton', {
      kind: 'test_plan',
      test_suites: [
        {
          suite_id: 'TS-URL-001',
          component_id: 'comp-url-shortening',
          test_type: 'integration',
          test_cases: [
            {
              test_case_id: 'TC-URL-001-001',
              type: 'functional',
              acceptance_criterion_ids: ['AC-001'],
            },
          ],
        },
      ],
    });
    const got = collectTestSuites([rec]);
    expect(got).toHaveLength(1);
    expect(got[0].test_cases).toHaveLength(1);
  });
});
