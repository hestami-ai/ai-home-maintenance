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
