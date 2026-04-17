/**
 * Prompt probe: Intent Statement Synthesis (Sub-Phase 1.4)
 */

import { describe, it, expect } from 'vitest';
import { runProbe, checkOllama } from './probeRunner';
import { logResult } from './probeHelpers';

describe('Probe: Intent Statement Synthesis', () => {
  it('synthesizes a complete intent statement from prune decisions', async () => {
    const available = await checkOllama();
    if (!available) return;

    const result = await runProbe({
      name: 'intent_statement_synthesis',
      agentRole: 'domain_interpreter',
      subPhase: '01_4_intent_statement_synthesis',
      variables: {
        active_constraints: 'No prior constraints',
        prune_decisions_summary: 'Human selected concept c2 (TaskFlow). Confirmed assumptions: web-based, multi-tenant. Rejected mobile-first interpretation.',
        selected_product_concept: 'TaskFlow — A web-based task management platform for small software development teams',
        confirmed_assumptions: JSON.stringify([
          {
            assumption_id: 'assumption-001',
            assumption: 'Web-based',
            confirmed_by_record_id: 'adjudicated-001',
          },
          {
            assumption_id: 'assumption-002',
            assumption: 'Multi-tenant',
            confirmed_by_record_id: 'adjudicated-001',
          },
        ], null, 2),
        confirmed_constraints: '- Must support kanban boards (technical)\n- Must integrate with GitHub (technical)',
        out_of_scope_items: '- Mobile applications\n- Enterprise SSO',
        scope_classification_ref: 'sc-001',
        compliance_context_ref: 'cc-001',
        janumicode_version_sha: 'test-probe',
      },
      expectedArtifactType: 'intent_statement',
      structuralAssertions: (parsed) => {
        const errors: string[] = [];
        if (!parsed.product_concept) errors.push('Missing product_concept');
        const pc = parsed.product_concept as Record<string, unknown> | undefined;
        if (pc) {
          if (!pc.name) errors.push('Missing product_concept.name');
          if (!pc.description) errors.push('Missing product_concept.description');
          if (!pc.who_it_serves) errors.push('Missing product_concept.who_it_serves');
          if (!pc.problem_it_solves) errors.push('Missing product_concept.problem_it_solves');
        }
        if (!Array.isArray(parsed.confirmed_assumptions)) errors.push('Missing confirmed_assumptions');
        if (!Array.isArray(parsed.confirmed_constraints)) errors.push('Missing confirmed_constraints');
        if (!Array.isArray(parsed.out_of_scope)) errors.push('Missing out_of_scope');
        return errors;
      },
      judgeRubric: {
        name: 'Intent Statement Synthesis from prune decisions',
        criteria: [
          'product_concept.name reflects the human selection (TaskFlow)',
          'product_concept.who_it_serves matches "small software development teams"',
          'confirmed_assumptions includes "web-based" and "multi-tenant" with stable assumption_id values',
          'confirmed_constraints includes the kanban boards and GitHub integration items',
          'out_of_scope includes mobile applications and Enterprise SSO',
          'No invented assumptions or constraints not present in the input prune decisions',
        ],
        reasoningCriteria: [
          'The synthesis FAITHFULLY represents the human\'s selection — not the agent\'s preference',
          'The agent did not silently drop any human-confirmed item',
          'The agent did not add new constraints the human did not approve',
        ],
      },
    });

    logResult(result);
    expect(result.parsed).not.toBeNull();
    expect(result.structuralValid).toBe(true);
    expect(result.judgePassed).toBe(true);
  }, 600000);
});
