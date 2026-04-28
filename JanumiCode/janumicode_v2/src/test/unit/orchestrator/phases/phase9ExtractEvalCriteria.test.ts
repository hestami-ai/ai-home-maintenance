/**
 * Regression tests for Phase 9.3's evaluation-criteria extractor.
 *
 * Background — every criterion got dropped as "Unnamed":
 *   Phase 8 emits three distinct artifact kinds (functional /
 *   quality / reasoning), each with domain-specific field names
 *   matching its prompt template:
 *     - functional: { functional_requirement_id, evaluation_method, success_condition }
 *     - quality:    { nfr_id, category, evaluation_tool, threshold, measurement_method }
 *     - reasoning:  { scenario_id, scenario_name, expected_reasoning }
 *
 *   The earlier extractEvalCriteria implementation read `c.name`,
 *   `c.description`, `c.type`, `c.evaluation_tool` — none of which
 *   Phase 8 produces. Result: 22 "Unnamed criterion" entries with
 *   empty descriptions, all marked failed. Phase 9.3's evaluation
 *   step provided no signal because every criterion looked broken to
 *   the runner.
 *
 * The fix dispatches by `plan.kind` and maps each kind's actual
 * field shape into the unified EvaluationCriterion. These tests pin
 * the mapping for each kind and the legacy fallback path.
 */

import { describe, it, expect } from 'vitest';
import { Phase9Handler } from '../../../../lib/orchestrator/phases/phase9';
import type { EvaluationCriterion } from '../../../../lib/orchestrator/evalRunner';

let counter = 0;
const generateId = () => `eval-${++counter}`;

function extract(planJson: object): EvaluationCriterion[] {
  // extractEvalCriteria is private; cast through unknown to access it
  // directly — same pattern other tests in this repo use to verify
  // private mapping logic.
  const handler = new Phase9Handler();
  return (handler as unknown as {
    extractEvalCriteria: (raw: string, gen: () => string) => EvaluationCriterion[];
  }).extractEvalCriteria(JSON.stringify(planJson), generateId);
}

describe('Phase9Handler.extractEvalCriteria', () => {
  it('maps functional_evaluation_plan items into named, described criteria', () => {
    // The exact shape Phase 8.1 emits per its prompt template.
    const out = extract({
      kind: 'functional_evaluation_plan',
      criteria: [
        {
          functional_requirement_id: 'FR-VENDOR-MATCH-1',
          evaluation_method: 'Static Code Analysis',
          success_condition: 'Vendor matching logic complexity (Cyclomatic) ≤ 15.',
        },
        {
          functional_requirement_id: 'FR-VENDOR-MATCH-2',
          evaluation_method: 'Integration Test',
          success_condition: 'AI match score endpoint returns within 500ms p95.',
        },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0].type).toBe('functional');
    expect(out[0].name).not.toBe('Unnamed criterion');
    expect(out[0].name).toContain('FR-VENDOR-MATCH-1');
    expect(out[0].description).toContain('Cyclomatic');
    expect(out[0].evaluationTool).toBe('Static Code Analysis');
    expect(out[0].acceptanceCriterionId).toBe('FR-VENDOR-MATCH-1');
    expect(out[1].name).toContain('FR-VENDOR-MATCH-2');
  });

  it('maps quality_evaluation_plan items into named, described criteria', () => {
    const out = extract({
      kind: 'quality_evaluation_plan',
      criteria: [
        {
          nfr_id: 'NFR-001',
          category: 'security',
          evaluation_tool: 'Cloudflare CLI / WAF Dashboard',
          threshold: '100% of public ingress requests originate from Cloudflare IP ranges',
          measurement_method: 'Network traffic inspection via CDN logs analysis',
          fallback_if_tool_unavailable: 'Manual firewall rule verification.',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('quality');
    expect(out[0].name).toContain('NFR-001');
    expect(out[0].name).toContain('security');
    expect(out[0].description).toContain('100% of public ingress');
    expect(out[0].description).toContain('Network traffic inspection');
    expect(out[0].evaluationTool).toBe('Cloudflare CLI / WAF Dashboard');
    expect(out[0].acceptanceCriterionId).toBe('NFR-001');
  });

  it('maps reasoning_evaluation_plan scenarios into criteria', () => {
    const out = extract({
      kind: 'reasoning_evaluation_plan',
      scenarios: [
        {
          scenario_id: 'RS-001',
          scenario_name: 'Reject non-compliant vendor at assignment',
          expected_reasoning: 'Agent must check VendorCompliance.status before allowing assignment.',
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('reasoning');
    expect(out[0].id).toBe('RS-001');
    expect(out[0].name).toBe('Reject non-compliant vendor at assignment');
    expect(out[0].description).toContain('VendorCompliance.status');
  });

  it('falls back to legacy shape (criteria[].name/.type/.description) when kind is unknown', () => {
    // Backward compat — fixtures that already conform to the old
    // unified shape continue to work even after the dispatcher lands.
    const out = extract({
      criteria: [
        { id: 'C1', name: 'Latency', type: 'quality', description: 'p95 < 200ms', evaluation_tool: 'k6' },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Latency');
    expect(out[0].type).toBe('quality');
    expect(out[0].description).toBe('p95 < 200ms');
    expect(out[0].evaluationTool).toBe('k6');
  });

  it('cal-22b reproduction: 5 functional + 17 quality criteria all surface with non-empty names', () => {
    // Pre-fix this returned 22 "Unnamed criterion" entries; post-fix
    // every criterion must have a meaningful name. If a future
    // regression flips the dispatcher off and falls through to the
    // legacy extractor for the new artifact kinds, this test fires.
    const functional = extract({
      kind: 'functional_evaluation_plan',
      criteria: Array.from({ length: 5 }, (_, i) => ({
        functional_requirement_id: `FR-${i + 1}`,
        evaluation_method: 'Static Code Analysis',
        success_condition: `Condition ${i + 1}`,
      })),
    });
    const quality = extract({
      kind: 'quality_evaluation_plan',
      criteria: Array.from({ length: 17 }, (_, i) => ({
        nfr_id: `NFR-${i + 1}`,
        category: 'security',
        evaluation_tool: 'Tool',
        threshold: `T${i + 1}`,
        measurement_method: 'M',
      })),
    });
    expect(functional).toHaveLength(5);
    expect(quality).toHaveLength(17);
    for (const c of [...functional, ...quality]) {
      expect(c.name).not.toBe('Unnamed criterion');
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('returns [] for unparseable JSON', () => {
    const handler = new Phase9Handler();
    const out = (handler as unknown as {
      extractEvalCriteria: (raw: string, gen: () => string) => EvaluationCriterion[];
    }).extractEvalCriteria('{not json', generateId);
    expect(out).toEqual([]);
  });

  it('returns [] for an empty criteria list', () => {
    expect(extract({ kind: 'functional_evaluation_plan', criteria: [] })).toEqual([]);
    expect(extract({ kind: 'quality_evaluation_plan', criteria: [] })).toEqual([]);
    expect(extract({ kind: 'reasoning_evaluation_plan', scenarios: [] })).toEqual([]);
  });
});
