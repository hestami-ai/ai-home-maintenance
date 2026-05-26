/**
 * Acceptance registry — maps each LLM-bearing phase boundary to
 *   (synthetic-input fixture, contract suite, related-artifact context)
 *
 * The fixtures live in `src/test/regression/fixtures/*.fixture.json`
 * and already carry `template_variables` populated with realistic
 * inputs that survived a real workflow run. The acceptance harness
 * reuses them as synthetic input for live LLM calls.
 *
 * Boundaries WITHOUT a contract in the registry are intentionally
 * omitted (e.g. `phase02_fr_bloom_enrichment` enriches an existing FR
 * skeleton; its output is validated indirectly via Phase 2.1's
 * structural contract on the post-enrichment artifact).
 */

import type { AcceptanceTestSpec } from './runner';

const F = 'src/test/regression/fixtures/'; // prefix used for every fixture path

export const ACCEPTANCE_SPECS: ReadonlyArray<AcceptanceTestSpec> = [
  // ── Phase 1 — intent capture ────────────────────────────────────
  {
    fixturePath: `${F}phase01_intent_quality_check__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0a_intent_quality_check',
  },
  {
    fixturePath: `${F}phase01_product_intent_discovery__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0b_product_intent_discovery',
  },
  {
    fixturePath: `${F}phase01_technical_constraints_discovery__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0c_technical_constraints_discovery',
  },
  {
    fixturePath: `${F}phase01_compliance_retention_discovery__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0d_compliance_retention_discovery',
  },
  {
    fixturePath: `${F}phase01_vv_requirements_discovery__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0e_vv_requirements_discovery',
  },
  {
    fixturePath: `${F}phase01_canonical_vocabulary_discovery__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.0f_canonical_vocabulary_discovery',
  },
  {
    fixturePath: `${F}phase01_intent_lens_classification__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.1a_intent_lens_classification',
  },
  {
    fixturePath: `${F}phase01_business_domains_bloom__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.2_business_domains_bloom',
  },
  {
    fixturePath: `${F}phase01_user_journey_bloom__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.3a_user_journey_bloom',
    // 1.3a is the SOURCE of UJ ids. Cross-artifact resolution
    // (downstream artifacts referencing UJ ids the bloom must contain)
    // only makes sense in diagnose mode against a real workflow run
    // where IDs cascade. In acceptance mode we mix fixtures from
    // different LLM calls; the live bloom won't satisfy captured
    // downstream refs. Leave related fixtures empty so the cross-ref
    // clauses auto-pass.
  },
  {
    // 1.3b is the SOURCE of WF ids. Same reasoning as 1.3a.
    fixturePath: `${F}phase01_system_workflow_bloom__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.3b_system_workflow_bloom',
  },
  {
    // 1.4 is the SOURCE of ENT ids. Same reasoning as 1.3a.
    fixturePath: `${F}phase01_entities_bloom__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.4_entities_bloom',
  },
  {
    fixturePath: `${F}phase01_product_description_synthesis__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.6_product_description_synthesis',
  },
  {
    fixturePath: `${F}phase01_release_plan__tinyurl-001.fixture.json`,
    contractBoundaryId: '1.9_release_plan',
  },

  // ── Phase 2 — requirements ──────────────────────────────────────
  {
    fixturePath: `${F}phase02_fr_bloom_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '2.1_fr_bloom_skeleton',
  },
  {
    fixturePath: `${F}phase02_nfr_bloom_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '2.2_nfr_bloom_skeleton',
  },

  // ── Phase 3 — system spec ───────────────────────────────────────
  {
    fixturePath: `${F}phase03_system_boundary__tinyurl-001.fixture.json`,
    contractBoundaryId: '3.1_system_boundary',
  },

  // ── Phase 4 — architecture ──────────────────────────────────────
  {
    fixturePath: `${F}phase04_software_domains__tinyurl-001.fixture.json`,
    contractBoundaryId: '4.1_software_domains',
    // C-4.1.4 cross-checks maps_to_business_domains against the Phase 1 bloom.
    relatedArtifactFixtures: [
      `${F}phase01_business_domains_bloom__tinyurl-001.fixture.json`,
    ],
  },
  {
    fixturePath: `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '4.2_component_skeleton',
    // C-4.2.5 cross-checks US refs against functional_requirements.
    relatedArtifactFixtures: [
      `${F}phase02_fr_bloom_skeleton__tinyurl-001.fixture.json`,
    ],
  },
  {
    fixturePath: `${F}phase04_adr_capture__tinyurl-001.fixture.json`,
    contractBoundaryId: '4.3_adr_capture',
  },

  // ── Phase 5 — technical spec ────────────────────────────────────
  {
    fixturePath: `${F}phase05_data_model_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '5.1_data_model_skeleton',
    relatedArtifactFixtures: [
      `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
    ],
  },
  {
    fixturePath: `${F}phase05_api_definitions__tinyurl-001.fixture.json`,
    contractBoundaryId: '5.2_api_definitions',
    relatedArtifactFixtures: [
      `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
    ],
  },
  {
    fixturePath: `${F}phase05_error_handling__tinyurl-001.fixture.json`,
    contractBoundaryId: '5.3_error_handling',
    relatedArtifactFixtures: [
      `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
    ],
  },

  // ── Phase 6 — implementation planning ───────────────────────────
  {
    fixturePath: `${F}phase06_task_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '6.1_task_skeleton',
    // C-6.1.5 cross-checks task.component_id against component_model.
    relatedArtifactFixtures: [
      `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
    ],
  },

  // ── Phase 7 — test planning ─────────────────────────────────────
  {
    fixturePath: `${F}phase07_test_case_skeleton__tinyurl-001.fixture.json`,
    contractBoundaryId: '7.1_test_case_skeleton',
    relatedArtifactFixtures: [
      `${F}phase04_component_skeleton__tinyurl-001.fixture.json`,
      `${F}phase02_fr_bloom_skeleton__tinyurl-001.fixture.json`,
    ],
  },

  // ── Phase 8 — evaluation design ─────────────────────────────────
  // Phase 8.1 emits a single wrapper object with three sibling plans
  // (functional / quality / reasoning). The 8.1 contract validates
  // only the functional plan, so extract that inner key from the
  // wrapper before passing to the contract.
  {
    fixturePath: `${F}phase08_evaluation_design__tinyurl-001.fixture.json`,
    contractBoundaryId: '8.1_functional_evaluation_design',
    extractInnerKey: 'functional_evaluation_plan',
    relatedArtifactFixtures: [
      `${F}phase02_fr_bloom_skeleton__tinyurl-001.fixture.json`,
    ],
  },
];
