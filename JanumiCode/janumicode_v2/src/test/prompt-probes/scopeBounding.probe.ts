/**
 * Prompt probe: Scope Bounding (Sub-Phase 1.1b)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Scope Bounding', () => {
  it('produces valid scope_classification for a single-product intent', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'scope_bounding_single_product',
      agentRole: 'orchestrator',
      subPhase: '01_1b_scope_bounding',
      variables: {
        raw_intent_text: 'Build a project management tool for small teams with task boards, time tracking, and team chat integration.',
        intent_quality_report_summary: 'All required fields present. No contradictions. Coherent product concept.',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'scope_classification',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];

        // Check for nested structure — template asks for scope_classification wrapper
        const scope = (parsed.scope_classification ?? parsed) as Record<string, unknown>;

        if (!scope.breadth) errors.push('Missing breadth');
        if (!scope.depth) errors.push('Missing depth');

        const validBreadths = ['single_feature', 'single_product', 'multi_product_ecosystem'];
        if (scope.breadth && !validBreadths.includes(scope.breadth as string)) {
          errors.push(`Invalid breadth: ${scope.breadth}`);
        }

        const validDepths = ['proof_of_concept', 'mvp', 'production_grade'];
        if (scope.depth && !validDepths.includes(scope.depth as string)) {
          errors.push(`Invalid depth: ${scope.depth}`);
        }

        return errors;
      },
      judgeRubric: {
        name: 'Scope Bounding for project management tool',
        criteria: [
          'breadth is "single_product" — the intent describes one cohesive product, not a single feature or multi-product ecosystem',
          'depth is one of "proof_of_concept", "mvp", or "production_grade"',
          'No invented cross_scope_dependencies (this is a single product, no multi-pillar dependencies)',
        ],
        reasoningCriteria: [
          'The classifier recognized that "task boards, time tracking, and team chat" are features of one product, not three separate products',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
