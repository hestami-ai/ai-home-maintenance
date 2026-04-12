/**
 * Prompt probe: Intent Domain Bloom (Sub-Phase 1.2)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Intent Domain Bloom', () => {
  it('produces valid intent_bloom with multiple candidates', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'intent_domain_bloom',
      agentRole: 'domain_interpreter',
      subPhase: '01_2_intent_domain_bloom',
      variables: {
        active_constraints: 'No constraints at this stage.',
        scope_classification_summary: 'breadth: single_product, depth: production_grade',
        compliance_context_summary: 'No compliance regimes identified.',
        collision_risk_aliases: 'No collision aliases.',
        raw_intent_text: 'Build a recipe sharing platform where home cooks can upload recipes with photos, organize them into collections, and discover new recipes through recommendations based on dietary preferences and cooking skill level.',
        janumicode_version_sha: 'test-probe',
        detail_file_path: '/dev/null',
      },
      expectedArtifactType: 'intent_bloom',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        const concepts = parsed.candidate_product_concepts as unknown[];

        if (!Array.isArray(concepts)) {
          errors.push('Missing candidate_product_concepts array');
          return errors;
        }

        if (concepts.length < 2) {
          errors.push(`Expected at least 2 candidate concepts (bloom should expand), got ${concepts.length}`);
        }

        // Each concept should have required fields
        for (let i = 0; i < concepts.length; i++) {
          const c = concepts[i] as Record<string, unknown>;
          if (!c.id) errors.push(`Concept ${i}: missing id`);
          if (!c.name) errors.push(`Concept ${i}: missing name`);
          if (!c.description) errors.push(`Concept ${i}: missing description`);
          if (!c.who_it_serves) errors.push(`Concept ${i}: missing who_it_serves`);
          if (!c.problem_it_solves) errors.push(`Concept ${i}: missing problem_it_solves`);
        }

        // Check for assumptions surfaced (bloom should surface assumptions)
        const hasAssumptions = concepts.some(
          (c: unknown) => Array.isArray((c as Record<string, unknown>).assumptions) &&
            ((c as Record<string, unknown>).assumptions as unknown[]).length > 0,
        );
        if (!hasAssumptions) {
          errors.push('Expected at least one concept with surfaced assumptions');
        }

        return errors;
      },
      judgeRubric: {
        name: 'Intent Domain Bloom for recipe sharing platform',
        criteria: [
          'At least 2 distinct candidate product concepts (bloom expands, does not converge)',
          'Concepts are genuinely DISTINCT (e.g. social platform vs personal cookbook vs recommendation engine)',
          'Each candidate has all required fields (id, name, description, who_it_serves, problem_it_solves)',
          'At least one candidate surfaces explicit assumptions (e.g. assumed authentication model, assumed data storage)',
          'Open questions surface genuine ambiguities (e.g. dietary preference data source, recommendation algorithm, photo storage limits)',
          'No premature convergence — alternatives are not collapsed',
        ],
        reasoningCriteria: [
          'The bloom does not assume a single technology stack or architecture',
          'The bloom considers different user populations (home cooks vs professional chefs vs dietary-restricted users)',
          'The reviewer surfaced assumptions explicitly rather than treating them as facts',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
