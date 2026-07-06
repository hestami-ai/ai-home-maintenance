/**
 * PA-12 — decomposition/saturation templates must NOT wrap their full-output
 * example in a ```json markdown fence while ALSO ordering "No markdown fences.
 * Response starts with {". The model pattern-matches the ```json wrapper and
 * emits fenced output (audit C4), which trips jsonOutputDisciplineCheck's
 * markdown_fence_wrapper at HIGH and can trigger json_repair latency.
 *
 * The fix strips the ```json opening + its closing ``` around the single
 * full-object example, replacing them with a raw-JSON lead-in; the legitimate
 * plain ``` shape-illustration blocks (enum menus, GOOD/BAD path examples) are
 * left untouched. This pins the invariant so the C4 contradiction can't recur.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');

const TEMPLATES: Array<{ rel: string; survive: string }> = [
  { rel: 'prompts/phases/phase_02_requirements/fr_saturation/functional_requirements_decomposition.product.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_06_implementation_planning/implementation_task_decomposition.system.md', survive: '"tasks"' },
  { rel: 'prompts/phases/phase_02_requirements/nfr_saturation/nonfunctional_requirements_decomposition.product.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_05_technical_specification/data_model_saturation/data_model_decomposition.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_06_implementation_planning/task_saturation/task_decomposition.system.md', survive: 'parent_branch_classification' },
  { rel: 'prompts/phases/phase_07_test_planning/test_case_saturation/test_decomposition.system.md', survive: 'parent_branch_classification' },
  // PA-12b (2026-07-05): embedded auxiliary templates the cal-38 adversarial pass
  // caught STILL ```json-fenced — DMR Stage-7 synthesis had NO anti-fence rule at all
  // (and produced a live fenced gpt-oss output); the AC-shape audit had the rule but a
  // fenced example (the classic self-contradiction). PA-12's scope missed both.
  { rel: 'prompts/cross_cutting/deep_memory_context_packet_synthesis.system.md', survive: 'decision_context_summary' },
  { rel: 'prompts/cross_cutting/tier_c_ac_shape_audit.system.md', survive: '"findings"' },
  // PA-12c (2026-07-05): the bloom/discovery/enrichment/component-saturation family had
  // the SAME contradiction PA-12 fixed in the decomposition templates but was outside
  // PA-12's scope. Swept + fixed via an 18-agent workflow; each stripped its
  // required-output ```json fence + added the raw-JSON lead-in (fr_bloom also converted
  // one GOVERNANCE illustration to a plain ``` fence).
  { rel: 'prompts/phases/phase_04_architecture/component_saturation/component_decomposition.product.system.md', survive: '"parent_branch_classification"' },
  { rel: 'prompts/phases/phase_02_requirements/fr_bloom_skeleton/functional_requirements_bloom.product.system.md', survive: '"user_stories"' },
  { rel: 'prompts/phases/phase_02_requirements/fr_bloom_skeleton/functional_requirements_ac_enrichment.product.system.md', survive: '"measurable_condition"' },
  { rel: 'prompts/phases/phase_02_requirements/nfr_bloom_skeleton/nonfunctional_requirements_bloom.product.system.md', survive: '"seed_threshold"' },
  { rel: 'prompts/phases/phase_02_requirements/nfr_bloom_skeleton/nonfunctional_requirements_threshold_enrichment.product.system.md', survive: '"measurement_method"' },
  { rel: 'prompts/phases/phase_01_intent_capture/business_domains_bloom/business_domains_bloom.product.system.md', survive: '"entity_preview"' },
  { rel: 'prompts/phases/phase_01_intent_capture/system_workflow_bloom/system_workflow_bloom.product.system.md', survive: '"step_backing_map"' },
  { rel: 'prompts/phases/phase_01_intent_capture/system_workflow_decomposition/system_workflow_decomposition.product.system.md', survive: '"trigger_routing_note"' },
  { rel: 'prompts/phases/phase_01_intent_capture/entities_bloom/entities_bloom.product.system.md', survive: '"entities_bloom"' },
  { rel: 'prompts/phases/phase_01_intent_capture/user_journey_bloom/user_journey_bloom.product.system.md', survive: '"user_journeys"' },
  { rel: 'prompts/phases/phase_01_intent_capture/user_journey_decomposition/user_journey_decomposition.product.system.md', survive: '"user_journey_decomposition"' },
  { rel: 'prompts/phases/phase_01_intent_capture/compliance_retention_discovery/compliance_retention_discovery.product.system.md', survive: '"compliance_extracted_items"' },
  { rel: 'prompts/phases/phase_01_intent_capture/technical_constraints_discovery/technical_constraints_discovery.product.system.md', survive: '"technicalConstraints"' },
  { rel: 'prompts/phases/phase_01_intent_capture/canonical_vocabulary_discovery/canonical_vocabulary_discovery.product.system.md', survive: '"canonicalVocabulary"' },
  { rel: 'prompts/phases/phase_01_intent_capture/integrations_qa_bloom/integrations_qa_bloom.product.system.md', survive: '"integrations_qa_bloom"' },
  { rel: 'prompts/phases/phase_01_intent_capture/product_description_synthesis/product_description_synthesis.product.system.md', survive: '"open_loops"' },
  { rel: 'prompts/phases/phase_01_intent_capture/product_intent_discovery/intent_discovery.product.system.md', survive: '"user_journeys"' },
  { rel: 'prompts/phases/phase_01_intent_capture/vv_requirements_discovery/vv_requirements_discovery.product.system.md', survive: '"vvRequirements"' },
  // PA-12c residual-tail (2026-07-05): the skeleton/definition/synthesis templates
  // OUTSIDE the bloom/decomposition family that PA-12/12c swept. adr_capture,
  // system_boundary, scope_bounding had a fenced output example with NO anti-fence
  // rule at all; evaluation_design and release_plan_v2 were the "classic self-
  // contradiction" (an anti-fence rule AND a fenced example — the PA-12b shape).
  // api_definitions is fixed too but NOT gated here: its legitimate negative rule
  // literally cites `(```json, ```)`, so the blanket no-```json assertion can't apply.
  { rel: 'prompts/phases/phase_04_architecture/adr_capture/adr_capture.system.md', survive: '"adrs"' },
  { rel: 'prompts/phases/phase_03_system_specification/system_boundary/system_boundary.system.md', survive: '"external_systems"' },
  { rel: 'prompts/phases/phase_01_intent_capture/scope_bounding/scope_bounding.system.md', survive: '"scope_classification"' },
  { rel: 'prompts/phases/phase_08_evaluation_planning/evaluation_design.system.md', survive: '"functional_evaluation_plan"' },
  { rel: 'prompts/phases/phase_01_intent_capture/release_plan/release_plan_v2.product.system.md', survive: '"contains_journeys"' },
];

describe('PA-12/PA-12b — prompt templates: no self-contradicting ```json fence', () => {
  for (const t of TEMPLATES) {
    const name = t.rel.split('/').at(-1) ?? t.rel;
    it(`${name}: strips the \`\`\`json fence, keeps a raw-JSON instruction + the example body`, () => {
      const body = fs.readFileSync(path.join(repoRoot, t.rel), 'utf-8');
      // (1) the self-contradicting output-example fence is gone.
      expect(body, 'the ```json full-output-example fence must be stripped').not.toContain('```json');
      // (2) the correct raw-JSON instruction survives (the stripped lead-in).
      expect(body).toContain('NO surrounding markdown code fences');
      // (3) the example body was not accidentally deleted with its fence.
      expect(body).toContain(t.survive);
    });
  }
});
