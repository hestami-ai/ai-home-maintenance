/**
 * Pins that the six v1-ported product-lens templates for Phase 1 sub-phases
 * 1.0b, 1.2, 1.3, 1.4, 1.5, 1.6 are discoverable via lens-aware lookup.
 *
 * Before Wave 2, Phase 1 had only the collapsed-flow templates at 01_0,
 * 01_2_intent_domain_bloom, 01_4_intent_statement_synthesis. The product
 * lens adds six new templates under dedicated sub-phase directories. If
 * any of them regresses (bad frontmatter, wrong path, missing `lens:
 * product` field), findTemplate returns null and Phase1Handler's product
 * branch silently falls back to an inferior prompt.
 *
 * This test runs against the real workspace prompts directory so it
 * catches frontmatter + path problems at the same time.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import { TemplateLoader } from '../../../lib/orchestrator/templateLoader';

describe('TemplateLoader — product-lens Phase 1 templates', () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    const workspacePath = path.resolve(__dirname, '..', '..', '..', '..');
    loader = new TemplateLoader(workspacePath);
  });

  const productLensTemplates: Array<{ subPhase: string; requires: string[] }> = [
    { subPhase: '01_0b_intent_discovery',                requires: ['raw_intent_text'] },
    { subPhase: '01_2_business_domains_bloom',           requires: ['product_vision', 'discovered_personas'] },
    { subPhase: '01_3_journeys_workflows_bloom',         requires: ['accepted_domains', 'accepted_personas'] },
    { subPhase: '01_4_entities_bloom',                   requires: ['accepted_domains', 'accepted_workflows'] },
    { subPhase: '01_5_integrations_qa_bloom',            requires: ['accepted_entities', 'accepted_workflows'] },
    // iter-4 decomposed extraction passes (1.0c/1.0d/1.0e/1.0f) — each
    // takes the same raw_intent_text input, narrow-scoped prompts.
    { subPhase: '01_0c_technical_constraints_discovery', requires: ['raw_intent_text'] },
    { subPhase: '01_0d_compliance_retention_discovery',  requires: ['raw_intent_text'] },
    { subPhase: '01_0e_vv_requirements_discovery',       requires: ['raw_intent_text'] },
    { subPhase: '01_0f_canonical_vocabulary_discovery',  requires: ['raw_intent_text'] },
    // 1.6 refactored in iter-3 to narrative-only — arrays are assembled
    // deterministically in the handler, LLM only refines
    // vision/description/summary/openLoops from a compact bloom summary.
    { subPhase: '01_6_product_description_synthesis',    requires: ['seed_vision', 'bloom_summary'] },
  ];

  for (const { subPhase, requires } of productLensTemplates) {
    it(`resolves domain_interpreter / ${subPhase} with lens=product`, () => {
      const t = loader.findTemplate('domain_interpreter', subPhase, 'product');
      expect(t, `expected a template for sub-phase ${subPhase} under the product lens`).not.toBeNull();
      expect(t!.metadata.agent_role).toBe('domain_interpreter');
      expect(t!.metadata.sub_phase).toBe(subPhase);
      expect(t!.metadata.lens).toBe('product');
      for (const req of requires) {
        expect(t!.metadata.required_variables, `template ${subPhase} missing required var ${req}`).toContain(req);
      }
    });
  }

  it('falls back to the lens-neutral bloom template when an unsupported lens is requested', () => {
    // bug / infra / legal lenses don't have product-lens-specific templates,
    // and they also shouldn't accidentally resolve to the product templates
    // at the renamed sub-phases. They should fall back to the collapsed-flow
    // neutral template at sub_phase = 01_2_intent_domain_bloom.
    const t = loader.findTemplate('domain_interpreter', '01_2_intent_domain_bloom', 'bug');
    expect(t).not.toBeNull();
    expect(t!.metadata.sub_phase).toBe('01_2_intent_domain_bloom');
  });
});
