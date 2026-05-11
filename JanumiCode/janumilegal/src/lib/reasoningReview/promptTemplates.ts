/**
 * Reasoning-review prompt templates (Wave 11).
 *
 * Each LLM validator that ships an `invoke` function declares its
 * templateId here. The PromptTemplateRegistry validates CLV bindings just
 * as for state agent templates. Bodies are intentionally minimal — the
 * substantive prompt text lives in the validator's invoke function so it
 * can include dynamic state-output context. The registry entry exists so
 * the harness can discover the template and the audit chain remains
 * consistent.
 */

export interface ReviewTemplate {
  readonly templateId: string;
  readonly templateVersion: string;
  readonly lensId: string;
  readonly stateId: string;
  readonly body: string;
  readonly clvBindings: readonly string[];
}

const LENS = 'reasoning_review';

const review = (id: string, stateId: string, clvBindings: readonly string[]): ReviewTemplate => ({
  templateId: `review.${id}`,
  templateVersion: 'v1',
  lensId: LENS,
  stateId,
  body: `Reasoning-review validator: ${id}. Validator-specific prompt body lives in code.`,
  clvBindings,
});

import type { PromptTemplateRegistry } from '../promptTemplates/registry.js';

export function registerReasoningReviewTemplates(reg: PromptTemplateRegistry): void {
  for (const t of REASONING_REVIEW_TEMPLATES) {
    const r = reg.register({
      templateId: t.templateId,
      templateVersion: t.templateVersion,
      lensId: t.lensId,
      stateId: t.stateId,
      body: t.body,
      clvBindings: t.clvBindings,
    });
    if (!r.ok) {
      throw new Error(`failed to register reasoning-review template ${t.templateId}: ${r.errors.join('; ')}`);
    }
  }
}

export const REASONING_REVIEW_TEMPLATES: readonly ReviewTemplate[] = [
  review('grounding_validator', 'crossState', ['clv.core.source.v1', 'clv.core.fact.v1']),
  review('reasoning_to_response_faithfulness', 'crossState', ['clv.core.conclusion.v1']),
  review('fact_classification_discipline', 'FactExtraction', ['clv.core.fact.v1', 'clv.core.allegation.v1']),
  review('authority_citation_grounding', 'AuthorityVerification', ['clv.core.authority.v1']),
  review('seed_coverage_pass1', 'IssueBloom', ['clv.core.issue.v1']),
  review('final_synthesis', 'crossState', []),
  review('divergence_pass2', 'IssueBloom', ['clv.core.issue.v1']),
  review('dampening_pass3', 'IssueBloom', ['clv.core.issue.v1']),
  review('pruning_rationale_substance', 'IssuePrune', ['clv.core.issue.v1', 'clv.core.work_product.v1']),
  review('conclusion_adverse_consideration', 'DirectLegalConclusionDraft', ['clv.core.conclusion.v1']),
  review('argument_authority_alignment', 'CourtFilingDraftGenerate', ['clv.core.authority.v1', 'clv.core.filing.v1']),
  review('tone_caveat_completeness', 'ClientAdviceDraft', ['clv.core.client.v1', 'clv.core.privilege_attorney_client.v1']),
];
