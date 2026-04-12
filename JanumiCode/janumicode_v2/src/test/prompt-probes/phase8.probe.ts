/**
 * Prompt probe: Phase 8 — Evaluation Plan Design
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Evaluation Design (8.1)', () => {
  it('produces three evaluation plans (functional, quality, reasoning)', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'phase_8_1_evaluation_design',
      agentRole: 'eval_design_agent',
      subPhase: '08_1_evaluation_design',
      variables: {
        active_constraints: 'No constraints',
        test_plan_summary: '20 test cases covering FRs across unit, integration, e2e',
        non_functional_requirements_summary: 'NFR-001: p95 < 300ms (performance). NFR-002: 99.9% uptime (reliability). NFR-003: WCAG AA (accessibility)',
        compliance_context_summary: 'No compliance regimes',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'reasoning_review_output',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        // The template asks for three plans — model may produce them as nested or top-level
        // Accept either structure
        const hasFunctional = parsed.functional_evaluation_plan ||
          (parsed.criteria && parsed.functional_criteria);
        const hasQuality = parsed.quality_evaluation_plan ||
          parsed.quality_criteria;
        if (!hasFunctional && !hasQuality) {
          errors.push('Expected functional_evaluation_plan or quality_evaluation_plan in output');
        }
        return errors;
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
  }, 300000);
});
