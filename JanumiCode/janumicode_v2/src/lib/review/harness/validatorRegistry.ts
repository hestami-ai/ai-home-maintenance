/**
 * Reasoning-Review Harness — Validator Registry (foundation, Track D Commit 1)
 *
 * Single source of truth for the harness's validator catalog. Each entry
 * describes one validator's identity, family, applicability rule, and
 * (for LLM validators) the prompt-template path.
 *
 * Track-D Commit 1 ships only the registry SHAPE — validator bodies are
 * stubs. Commits 3–7 fill in:
 *   - deterministic `validate` functions (replacing the `undefined` stubs)
 *   - LLM prompt-template files at `prompts/review/<family>/<id>.system.md`
 *
 * References (read in full before extending this file):
 *   - docs/reasoning review prompt template redesign/track_c_synthesis/
 *     validator_catalog.md  — every validator's id / family / applicability
 *   - .../harness_design.md  — dispatch logic + record schema
 *   - .../deferred_to_track_d.md §6 (locked decisions) and §8 (commit
 *     sequence)
 */

// Wire-in: deterministic validator bodies (Commit 3).
import { validateContractSchema } from './validators/deterministic/contractSchemaValidator';
import { validateOutputSubstantiveness } from './validators/deterministic/outputSubstantivenessCheck';
import { validatePersonaIdContinuity } from './validators/deterministic/personaIdContinuity';
import { validateJourneyIdContinuity } from './validators/deterministic/journeyIdContinuity';
import { validateStoryStructuralCompleteness } from './validators/deterministic/storyStructuralCompleteness';
import { validateFrTracePollutionCheck } from './validators/deterministic/frTracePollutionCheck';
import { validateEnrichmentEchoInvariance } from './validators/deterministic/enrichmentEchoInvariance';
import { validateHandoffFieldCompleteness } from './validators/deterministic/handoffFieldCompleteness';
import { validateStatusConsistencyIqc } from './validators/deterministic/statusConsistencyIqc';
import { validateCalibrationRuleConsistencyLens } from './validators/deterministic/calibrationRuleConsistencyLens';
import { validateExtractionIdTraceability } from './validators/deterministic/extractionIdTraceability';
import { validateNfrStructuralCompleteness } from './validators/deterministic/nfrStructuralCompleteness';
import { validateAcCountDiscipline } from './validators/deterministic/acCountDiscipline';
import { validateExemplarLeakageDetector } from './validators/deterministic/exemplarLeakageDetector';
import { validateEntityWorkflowShape } from './validators/deterministic/entityWorkflowShape';
// Stage B — new deterministic validators (Stages 1A–1D)
import { validateJsonOutputDiscipline } from './validators/deterministic/jsonOutputDisciplineCheck';
import { invokeSourceItemEnumerationCompleteness } from './validators/deterministic/sourceItemEnumerationCompleteness';
import { validateRelationshipDirectionality } from './validators/deterministic/relationshipDirectionalityValidator';
import { validateResponsibilityAtomicity } from './validators/deterministic/responsibilityAtomicityValidator';
import { validateSrAllocationCompleteness } from './validators/deterministic/srAllocationCompletenessValidator';
import { validateParentBranchClassification } from './validators/deterministic/parentBranchClassificationCheck';
import { validateDecompositionFanoutDiscipline } from './validators/deterministic/decompositionFanoutDiscipline';
import { validateTracesToIdValidity } from './validators/deterministic/tracesToIdValidity';
import { validateEntityKindConsistency } from './validators/deterministic/entityKindConsistencyValidator';
import { validateTierOverrideAssumption } from './validators/deterministic/tierOverrideAssumptionValidator';
import { validateAdrStatusDiscipline } from './validators/deterministic/adrStatusDisciplineValidator';
// Wire-in: LLM validator invoke functions (Commits 4–7, factory pattern).
import { invokeGroundingValidator } from './validators/llm/groundingValidator';
import { invokeReasoningToResponseFaithfulness } from './validators/llm/reasoningToResponseFaithfulness';
import { invokeOpenQuestionVsDecided } from './validators/llm/openQuestionVsDecided';
import { invokeReasoningQualityValidator } from './validators/llm/reasoningQualityValidator';
import { invokeAssumptionCitationValidator } from './validators/llm/assumptionCitationValidator';
import { invokeFinalSynthesis } from './validators/llm/finalSynthesis';
// Commit 5a — discovery
import { invokeScopeBoundaryAdherenceDiscovery } from './validators/llm/scopeBoundaryAdherenceDiscovery';
import { invokeExternalReferenceHandling } from './validators/llm/externalReferenceHandling';
import { invokeRegimeCitationValidity } from './validators/llm/regimeCitationValidity';
import { invokeRetentionThresholdGrounding } from './validators/llm/retentionThresholdGrounding';
import { invokeComplianceSignalCompleteness } from './validators/llm/complianceSignalCompleteness';
// Commit 5b — bloom
import { invokeSourceAttributionGrounding } from './validators/llm/sourceAttributionGrounding';
import { invokeBloomCompletenessVsThinking } from './validators/llm/bloomCompletenessVsThinking';
import { invokeSpecBoundaryRespectBloom } from './validators/llm/specBoundaryRespectBloom';
import { invokeSourceGroupingCoverage } from './validators/llm/sourceGroupingCoverage';
import { invokeDomainPersonaCoherence } from './validators/llm/domainPersonaCoherence';
import { invokeSurfaceAttributionCompleteness } from './validators/llm/surfaceAttributionCompleteness';
import { invokeWorkflowJourneySeparation } from './validators/llm/workflowJourneySeparation';
import { invokeStepCompletenessAndAutomatable } from './validators/llm/stepCompletenessAndAutomatable';
import { invokeAcceptanceCriteriaMeasurability } from './validators/llm/acceptanceCriteriaMeasurability';
import { invokePersonaJourneyCoupling } from './validators/llm/personaJourneyCoupling';
import { invokeDomainJourneyCoupling } from './validators/llm/domainJourneyCoupling';
import { invokePhaseJourneyAlignment } from './validators/llm/phaseJourneyAlignment';
// Commit 5c — synthesis
import { invokeSynthesisCoverageAudit } from './validators/llm/synthesisCoverageAudit';
import { invokeSynthesisFabricationCheck } from './validators/llm/synthesisFabricationCheck';
import { invokeCompressionFidelityAudit } from './validators/llm/compressionFidelityAudit';
import { invokePhasingDependencyConsistency } from './validators/llm/phasingDependencyConsistency';
import { invokeWaveDependencyTopology } from './validators/llm/waveDependencyTopology';
import { invokeComplianceSequencingAudit } from './validators/llm/complianceSequencingAudit';
import { invokeMvpCredibilityCheck } from './validators/llm/mvpCredibilityCheck';
import { invokeReleaseBalanceAudit } from './validators/llm/releaseBalanceAudit';
// Commit 6a — requirements_skeleton
import { invokeStoryShapeConformance } from './validators/llm/storyShapeConformance';
import { invokeNfrShapeConformance } from './validators/llm/nfrShapeConformance';
import { invokePassScopeDiscipline } from './validators/llm/passScopeDiscipline';
import { invokeThresholdPresenceCheck } from './validators/llm/thresholdPresenceCheck';
import { invokeQualityAttributeTaxonomyAlignment } from './validators/llm/qualityAttributeTaxonomyAlignment';
import { invokeHandoffCoverageAudit } from './validators/llm/handoffCoverageAudit';
// Commit 6b — requirements_enrichment
import { invokeMeasurementAdequacyValidator } from './validators/llm/measurementAdequacyValidator';
import { invokeThresholdGroundingAudit } from './validators/llm/thresholdGroundingAudit';
import { invokeMeasurableConditionExecutability } from './validators/llm/measurableConditionExecutability';
import { invokeMeasurementMethodExecutability } from './validators/llm/measurementMethodExecutability';
import { invokeSkeletonDriftAudit } from './validators/llm/skeletonDriftAudit';
// Commit 7 — role_specific
import { invokeCompletenessEvidenceAdequacy } from './validators/llm/completenessEvidenceAdequacy';
import { invokeCoherenceEvidenceAudit } from './validators/llm/coherenceEvidenceAudit';
import { invokeConfidenceCalibrationLens } from './validators/llm/confidenceCalibrationLens';
import { invokeIntentVsArtifactScopeAudit } from './validators/llm/intentVsArtifactScopeAudit';
// Stage B — new LLM validators (Stages 1A–1D)
import { invokeUngroundedOperationalSpecifics } from './validators/llm/ungroundedOperationalSpecifics';
import { invokeInterfaceContractAlignmentValidator } from './validators/llm/interfaceContractAlignmentValidator';
import { invokeTierAssignmentAudit } from './validators/llm/tierAssignmentAudit';
import { invokeSurfacedAssumptionNovelty } from './validators/llm/surfacedAssumptionNovelty';
import { invokeNfrThresholdGrounding } from './validators/llm/nfrThresholdGrounding';
import { invokeErrorTypeSourceAttestationValidator } from './validators/llm/errorTypeSourceAttestationValidator';
import type { LLMInvokeContext } from './validators/llm/llmValidatorRunner';
import type { LLMCaller } from '../../llm/llmCaller';
import type { TemplateLoader } from '../../orchestrator/templateLoader';

// ── Type machinery ─────────────────────────────────────────────────

export type ValidatorFamily =
  | 'cross_role'
  | 'discovery'
  | 'bloom'
  | 'synthesis'
  | 'requirements_skeleton'
  | 'requirements_enrichment'
  | 'requirements_saturation'
  | 'saturation'
  | 'role_specific';

export type ValidatorKind = 'deterministic' | 'llm';

/** Predicate over (role, sub_phase, output) — true means dispatch this validator. */
export type ValidatorApplicabilityPredicate = (params: {
  agentRole: string;
  subPhaseId: string;
  outputContent: Record<string, unknown> | null;
  outputThinking: string | null;
}) => boolean;

interface BaseValidatorEntry {
  /** Canonical name from validator_catalog.md. */
  id: string;
  family: ValidatorFamily;
  /** One-line summary. */
  description: string;
  appliesTo: ValidatorApplicabilityPredicate;
}

export interface DeterministicValidatorEntry extends BaseValidatorEntry {
  kind: 'deterministic';
  /**
   * Stub for now — Commit 3 fills in. Returns findings or [] for clean.
   * When undefined at runtime, the harness records a `validator_unavailable`
   * failure for this entry so coverage gaps are auditable.
   */
  validate?: (params: ValidatorRuntimeParams) => ValidatorFinding[];
}

export interface LLMValidatorEntry extends BaseValidatorEntry {
  kind: 'llm';
  /** Path under `prompts/review/<family>/...` (locked decision §3 — nested by family). */
  promptTemplatePath: string;
  /**
   * Per-validator runner. When undefined at runtime, the harness records
   * a `validator_unavailable` failure. Commit 4 ships invoke for the
   * universal cross-role family + final_synthesis; later commits fill
   * in family-class and role-specific validators.
   */
  invoke?: (
    params: ValidatorRuntimeParams,
    llmCaller: LLMCaller,
    templateLoader: TemplateLoader,
    context: LLMInvokeContext,
  ) => Promise<ValidatorFinding[]>;
}

export type ValidatorEntry = DeterministicValidatorEntry | LLMValidatorEntry;

export interface ValidatorRuntimeParams {
  agentRole: string;
  subPhaseId: string;
  agentOutputId: string;
  outputText: string;
  outputContent: Record<string, unknown> | null;
  outputThinking: string | null;
  originalPrompt: string;
  originalSystem: string | null;
  /**
   * Other validators' findings made available later (synthesis-time
   * collation). Empty for now; final_synthesis (Commit 8) reads it.
   */
  upstreamFindings?: ValidatorFinding[];
  /**
   * Prior governed-stream artifacts for this workflow run, grouped by
   * `content.kind`. Lets cross-record validators (e.g.
   * `spec_boundary_respect_bloom`) consult discovery / extraction outputs
   * without re-extracting from raw spec text. The harness pre-loads this
   * once per agent_output review; validators that don't need it ignore.
   * Undefined when the harness was invoked without writer access (tests).
   */
  priorArtifactsByKind?: ReadonlyMap<string, ReadonlyArray<Record<string, unknown>>>;
}

export interface ValidatorFinding {
  validatorId: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  /** Validator-specific finding type (see catalog §9 output contracts). */
  type: string;
  summary: string;
  /** Field path / quoted span / child id / acceptance-criterion id. */
  location: string;
  detail: string;
  recommendation: string;
  /**
   * Machine-resolvable target — required for auto-mitigation. Validators
   * whose findings can be acted on deterministically (drop, replace,
   * surface as open question) emit these fields so the MitigationEngine
   * can locate the offending element without re-parsing `location`.
   *
   *   targetField      — top-level array field name in the artifact
   *                      (e.g. "domains", "entities", "userJourneys")
   *   targetIdentifier — id or unambiguous name of the item to act on
   *
   * Optional: validators producing advisory-only findings can omit them.
   * Auto-mitigation handlers MUST check presence before acting.
   */
  targetField?: string;
  targetIdentifier?: string;
}

// ── Dispatch bundles per sampled (agent_role, sub_phase) ───────────
//
// Source: harness_design.md §2.1 per-pair dispatch tables. Each bundle
// names the canonical validator ids that fire for that sub_phase. The
// per-validator `appliesTo` predicate is defined as "id ∈ bundle for
// (role, sub_phase)"; the role qualifier disambiguates sub_phase ids
// shared across roles (none in cal-25, but defensive).
//
// Saturation sub_phases (`fr_saturation`, `nfr_saturation`) ship a
// minimal universal bundle until saturation samples land
// (deferred_to_track_d.md §6.8). The saturation-only validator
// `tier_decomposition_validator` is registered but its predicate is
// hard-coded false so it never dispatches yet.

const BUNDLE_KEY_DELIMITER = '';
const bundleKey = (role: string, sub: string): string =>
  `${role}${BUNDLE_KEY_DELIMITER}${sub}`;

/** Universal minimum dispatched at any sub_phase (used as fallback). */
const PLACEHOLDER_BUNDLE: readonly string[] = [
  'json_output_discipline_check',
  'contract_schema_validator',
  'grounding_validator',
  'reasoning_quality_validator',
  'reasoning_to_response_faithfulness',
  'final_synthesis',
];

/** Saturation universal bundle (saturation-specific validators deferred). */
const SATURATION_UNIVERSAL_BUNDLE: readonly string[] = [
  'json_output_discipline_check',
  'contract_schema_validator',
  'grounding_validator',
  'reasoning_to_response_faithfulness',
  'reasoning_quality_validator',
  'final_synthesis',
];

/** Dispatch table: (agent_role, sub_phase) → ordered validator ids. */
const DISPATCH_BUNDLES: ReadonlyMap<string, readonly string[]> = new Map([
  // S01 — orchestrator / intent_quality_check (1.1)
  [
    bundleKey('orchestrator', 'intent_quality_check'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'status_consistency_iqc',
      'grounding_validator',
      'completeness_evidence_adequacy',
      'coherence_evidence_audit',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S02 — orchestrator / intent_lens_classification (1.2)
  [
    bundleKey('orchestrator', 'intent_lens_classification'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'calibration_rule_consistency_lens',
      'grounding_validator',
      'confidence_calibration_lens',
      'intent_vs_artifact_scope_audit',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S03 — domain_interpreter / product_intent_discovery (1.3.1)
  [
    bundleKey('domain_interpreter', 'product_intent_discovery'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'extraction_id_traceability',
      'grounding_validator',
      'scope_boundary_adherence_discovery',
      'open_question_vs_decided',
      'external_reference_handling',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S04 — domain_interpreter / compliance_retention_discovery (1.3.3)
  [
    bundleKey('domain_interpreter', 'compliance_retention_discovery'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'extraction_id_traceability',
      'grounding_validator',
      'regime_citation_validity',
      'retention_threshold_grounding',
      'scope_boundary_adherence_discovery',
      'compliance_signal_completeness',
      'open_question_vs_decided',
      'external_reference_handling',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S05 — domain_interpreter / business_domains_bloom (1.5)
  [
    bundleKey('domain_interpreter', 'business_domains_bloom'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'persona_id_continuity',
      'entity_workflow_shape',
      'source_attribution_grounding',
      'domain_persona_coherence',
      'open_question_vs_decided',
      'source_grouping_coverage',
      'bloom_completeness_vs_thinking',
      'spec_boundary_respect_bloom',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S06 — domain_interpreter / user_journey_bloom (1.6)
  [
    bundleKey('domain_interpreter', 'user_journey_bloom'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'persona_id_continuity',
      'journey_id_continuity',
      'source_attribution_grounding',
      'surface_attribution_completeness',
      'persona_journey_coupling',
      'domain_journey_coupling',
      'workflow_journey_separation',
      'step_completeness_and_automatable',
      'acceptance_criteria_measurability',
      'open_question_vs_decided',
      'phase_journey_alignment',
      'bloom_completeness_vs_thinking',
      'spec_boundary_respect_bloom',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S06b — domain_interpreter / system_workflow_bloom (1.3b) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'system_workflow_bloom'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_attribution_grounding',
      'workflow_journey_separation',
      'open_question_vs_decided',
      'bloom_completeness_vs_thinking',
      'spec_boundary_respect_bloom',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S06c — domain_interpreter / entities_bloom (1.4) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'entities_bloom'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_attribution_grounding',
      'open_question_vs_decided',
      'bloom_completeness_vs_thinking',
      'spec_boundary_respect_bloom',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S06d — domain_interpreter / integrations_qa_bloom (1.5) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'integrations_qa_bloom'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_attribution_grounding',
      'open_question_vs_decided',
      'bloom_completeness_vs_thinking',
      'spec_boundary_respect_bloom',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S03b — domain_interpreter / technical_constraints_discovery (1.0c) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'technical_constraints_discovery'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'extraction_id_traceability',
      'grounding_validator',
      'scope_boundary_adherence_discovery',
      'open_question_vs_decided',
      'external_reference_handling',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S03c — domain_interpreter / vv_requirements_discovery (1.0e) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'vv_requirements_discovery'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'extraction_id_traceability',
      'grounding_validator',
      'scope_boundary_adherence_discovery',
      'open_question_vs_decided',
      'external_reference_handling',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S03d — domain_interpreter / canonical_vocabulary_discovery (1.0f) — added Wave 8 thin-slice fixes
  [
    bundleKey('domain_interpreter', 'canonical_vocabulary_discovery'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'extraction_id_traceability',
      'grounding_validator',
      'scope_boundary_adherence_discovery',
      'open_question_vs_decided',
      'external_reference_handling',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'final_synthesis',
    ],
  ],
  // S07 — domain_interpreter / product_description_synthesis (1.11)
  [
    bundleKey('domain_interpreter', 'product_description_synthesis'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'handoff_field_completeness',
      'synthesis_coverage_audit',
      'compression_fidelity_audit',
      'synthesis_fabrication_check',
      'grounding_validator',
      'open_question_vs_decided',
      'phasing_dependency_consistency',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S08 — orchestrator / release_plan (1.13)
  [
    bundleKey('orchestrator', 'release_plan'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'handoff_field_completeness',
      'synthesis_coverage_audit',
      'wave_dependency_topology',
      'mvp_credibility_check',
      'release_balance_audit',
      'compression_fidelity_audit',
      'synthesis_fabrication_check',
      'compliance_sequencing_audit',
      'open_question_vs_decided',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S09 — requirements_agent / fr_bloom_skeleton (2.1.1)
  [
    bundleKey('requirements_agent', 'fr_bloom_skeleton'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'story_structural_completeness',
      'handoff_coverage_audit',
      'source_attribution_grounding',
      'story_shape_conformance',
      'pass_scope_discipline',
      'grounding_validator',
      'measurement_adequacy_validator',
      'open_question_vs_decided',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S10 — requirements_agent / fr_bloom_enrichment (2.1.2)
  [
    bundleKey('requirements_agent', 'fr_bloom_enrichment'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'enrichment_echo_invariance',
      'ac_count_discipline',
      'exemplar_leakage_detector',
      'measurement_adequacy_validator',
      'threshold_grounding_audit',
      'measurable_condition_executability',
      'skeleton_drift_audit',
      'grounding_validator',
      'source_attribution_grounding',
      'pass_scope_discipline',
      'open_question_vs_decided',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S11 — requirements_agent / nfr_bloom_skeleton (2.2.1)
  [
    bundleKey('requirements_agent', 'nfr_bloom_skeleton'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'nfr_structural_completeness',
      'handoff_coverage_audit',
      'fr_trace_pollution_check',
      'source_attribution_grounding',
      'nfr_shape_conformance',
      'threshold_presence_check',
      'quality_attribute_taxonomy_alignment',
      'pass_scope_discipline',
      'grounding_validator',
      'measurement_adequacy_validator',
      'open_question_vs_decided',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S12 — requirements_agent / nfr_bloom_enrichment (2.2.2)
  [
    bundleKey('requirements_agent', 'nfr_bloom_enrichment'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'enrichment_echo_invariance',
      'output_substantiveness_check',
      'exemplar_leakage_detector',
      'measurement_adequacy_validator',
      'threshold_grounding_audit',
      'grounding_validator',
      'measurement_method_executability',
      'skeleton_drift_audit',
      'source_attribution_grounding',
      'pass_scope_discipline',
      'open_question_vs_decided',
      'assumption_citation_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // ── Stage 1A additions: fr_saturation (2.1.4) and nfr_saturation (2.2.4) ──
  // Promoted from SATURATION_UNIVERSAL_BUNDLE per cal-26 samples 13 and 14.
  // Stage B: replaces the placeholder stubs with the full §5.4 family bundle.
  [
    bundleKey('requirements_agent', 'fr_saturation'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'parent_branch_classification_check',
      'decomposition_fanout_discipline',
      'traces_to_id_validity',
      'grounding_validator',
      'tier_assignment_audit',
      'surfaced_assumption_novelty',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'assumption_citation_validator',
      'final_synthesis',
    ],
  ],
  [
    bundleKey('requirements_agent', 'nfr_saturation'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'parent_branch_classification_check',
      'decomposition_fanout_discipline',
      'traces_to_id_validity',
      'grounding_validator',
      'tier_assignment_audit',
      'surfaced_assumption_novelty',
      'nfr_threshold_grounding',
      'measurement_method_executability',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'assumption_citation_validator',
      'final_synthesis',
    ],
  ],

  // ── Stage 1B additions: systems_agent Phase 3 sub-phases ──────────
  // S15 — systems_agent / system_boundary (3.1)
  [
    bundleKey('systems_agent', 'system_boundary'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S16 — systems_agent / system_requirements (3.2)
  [
    bundleKey('systems_agent', 'system_requirements'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S17 — systems_agent / interface_contracts (3.3)
  [
    bundleKey('systems_agent', 'interface_contracts'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'ungrounded_operational_specifics',
      'final_synthesis',
    ],
  ],

  // ── Stage 1C additions: architecture_agent Phase 4 sub-phases ─────
  // S18 — architecture_agent / software_domains (4.1)
  [
    bundleKey('architecture_agent', 'software_domains'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S19 — architecture_agent / component_skeleton (4.2)
  [
    bundleKey('architecture_agent', 'component_skeleton'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'sr_allocation_completeness_validator',
      'responsibility_atomicity_validator',
      'grounding_validator',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S20 — architecture_agent / adr_capture (4.3)
  [
    bundleKey('architecture_agent', 'adr_capture'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'adr_status_discipline_validator',
      'grounding_validator',
      'ungrounded_operational_specifics',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S21 — domain_interpreter / component_saturation (4.2a)
  [
    bundleKey('domain_interpreter', 'component_saturation'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'parent_branch_classification_check',
      'decomposition_fanout_discipline',
      'traces_to_id_validity',
      'grounding_validator',
      'tier_assignment_audit',
      'surfaced_assumption_novelty',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'assumption_citation_validator',
      'final_synthesis',
    ],
  ],

  // ── Stage 1D additions: technical_spec_agent Phase 5 sub-phases ───
  // S22 — technical_spec_agent / data_model_skeleton (5.1)
  [
    bundleKey('technical_spec_agent', 'data_model_skeleton'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'traces_to_id_validity',
      'relationship_directionality_validator',
      'grounding_validator',
      'ungrounded_operational_specifics',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S23 — technical_spec_agent / api_definitions (5.2)
  [
    bundleKey('technical_spec_agent', 'api_definitions'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'interface_contract_alignment_validator',
      'ungrounded_operational_specifics',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S24 — technical_spec_agent / error_handling (5.3)
  [
    bundleKey('technical_spec_agent', 'error_handling'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'error_type_source_attestation_validator',
      'ungrounded_operational_specifics',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S25 — technical_spec_agent / configuration_parameters (5.4)
  [
    bundleKey('technical_spec_agent', 'configuration_parameters'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'source_item_enumeration_completeness',
      'grounding_validator',
      'ungrounded_operational_specifics',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'final_synthesis',
    ],
  ],
  // S26 — technical_spec_agent / data_model_saturation (5.x)
  [
    bundleKey('technical_spec_agent', 'data_model_saturation'),
    [
      'json_output_discipline_check',
      'contract_schema_validator',
      'parent_branch_classification_check',
      'decomposition_fanout_discipline',
      'traces_to_id_validity',
      'entity_kind_consistency_validator',
      'tier_override_assumption_validator',
      'grounding_validator',
      'tier_assignment_audit',
      'surfaced_assumption_novelty',
      'reasoning_to_response_faithfulness',
      'reasoning_quality_validator',
      'assumption_citation_validator',
      'final_synthesis',
    ],
  ],
]);

/**
 * Lookup the validator-id bundle for a (role, sub_phase) pair. Falls
 * back to PLACEHOLDER_BUNDLE for unsampled pairs (per harness_design.md
 * §2.3).
 */
function bundleFor(agentRole: string, subPhaseId: string): readonly string[] {
  return DISPATCH_BUNDLES.get(bundleKey(agentRole, subPhaseId)) ?? PLACEHOLDER_BUNDLE;
}

/** Build the standard predicate: id is in the dispatch bundle. */
function dispatchedIn(id: string): ValidatorApplicabilityPredicate {
  return ({ agentRole, subPhaseId }) => bundleFor(agentRole, subPhaseId).includes(id);
}

/** Predicate that always returns false (deferred / not-yet-active). */
const NEVER: ValidatorApplicabilityPredicate = () => false;

// ── Registry entries (one comment block per family) ────────────────

const ENTRIES: ValidatorEntry[] = [
  // ── Family: cross_role (universal) ────────────────────────────────
  // Apply across every reviewed (agent_role, sub_phase) pair, with
  // role-keyed parametrization handled at runtime.
  {
    id: 'contract_schema_validator',
    family: 'cross_role',
    kind: 'deterministic',
    description:
      'Verify response is valid JSON and conforms to the role-specific schema (top-level keys, enums, ID prefix, ID uniqueness).',
    appliesTo: dispatchedIn('contract_schema_validator'),
    validate: validateContractSchema,
  },
  {
    id: 'grounding_validator',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Classify every material generated claim as SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / CONTRADICTED relative to source context.',
    appliesTo: dispatchedIn('grounding_validator'),
    promptTemplatePath: 'prompts/review/cross_role/grounding_validator.system.md',
    invoke: invokeGroundingValidator,
  },
  {
    id: 'reasoning_to_response_faithfulness',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Detect candidate findings the agent enumerated then dropped without justification, rule-commitments violated, and reversed decisions between thinking and response.',
    appliesTo: dispatchedIn('reasoning_to_response_faithfulness'),
    promptTemplatePath:
      'prompts/review/cross_role/reasoning_to_response_faithfulness.system.md',
    invoke: invokeReasoningToResponseFaithfulness,
  },
  {
    id: 'open_question_vs_decided',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Detect cases where an open question is silently resolved by a decision in the same response; flag unsupported thresholds embedded as binding commitments.',
    appliesTo: dispatchedIn('open_question_vs_decided'),
    promptTemplatePath: 'prompts/review/cross_role/open_question_vs_decided.system.md',
    invoke: invokeOpenQuestionVsDecided,
  },
  {
    id: 'output_substantiveness_check',
    family: 'cross_role',
    kind: 'deterministic',
    description:
      'Distinguish a contract-satisfying minimal response from a near-empty placeholder; per-pass length floors and predicate-token sets.',
    appliesTo: dispatchedIn('output_substantiveness_check'),
    validate: validateOutputSubstantiveness,
  },
  {
    id: 'reasoning_quality_validator',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Catch shortcuts, unjustified leaps, contradictions, over-cleverness, fragile coupling, ignored instructions, edge-case blindness. Narrowed to pattern-level, runs after narrower validators.',
    appliesTo: dispatchedIn('reasoning_quality_validator'),
    promptTemplatePath: 'prompts/review/cross_role/reasoning_quality_validator.system.md',
    invoke: invokeReasoningQualityValidator,
  },
  {
    id: 'assumption_citation_validator',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Verify surfaced assumptions and citation references; collapses to traceability-only at passes lacking surfaced_assumptions[].',
    appliesTo: dispatchedIn('assumption_citation_validator'),
    promptTemplatePath:
      'prompts/review/cross_role/assumption_citation_validator.system.md',
    invoke: invokeAssumptionCitationValidator,
  },
  {
    id: 'final_synthesis',
    family: 'cross_role',
    kind: 'llm',
    description:
      'Combine validator findings into one advisory decision (ACCEPT / ACCEPT_WITH_NOTES / REVISE / QUARANTINE / ESCALATE) and emit prompt-patch / rerun recommendations.',
    appliesTo: dispatchedIn('final_synthesis'),
    promptTemplatePath: 'prompts/review/cross_role/final_synthesis.system.md',
    invoke: invokeFinalSynthesis,
  },

  // ── Family: discovery ─────────────────────────────────────────────
  // Phase 1.0b–1.0e silent-discovery passes; positive-list-plus-sibling
  // -carve-out structures.
  {
    id: 'scope_boundary_adherence_discovery',
    family: 'discovery',
    kind: 'llm',
    description:
      'Verify every extracted item belongs to the current pass layer; flag drift to sibling passes.',
    appliesTo: dispatchedIn('scope_boundary_adherence_discovery'),
    promptTemplatePath:
      'prompts/review/discovery/scope_boundary_adherence_discovery.system.md',
    invoke: invokeScopeBoundaryAdherenceDiscovery,
  },
  {
    id: 'extraction_id_traceability',
    family: 'discovery',
    kind: 'deterministic',
    description:
      'Verify every ID follows the documented prefix convention, is unique within its array, and cross-array references resolve.',
    appliesTo: dispatchedIn('extraction_id_traceability'),
    validate: validateExtractionIdTraceability,
  },
  {
    id: 'external_reference_handling',
    family: 'discovery',
    kind: 'llm',
    description:
      'Verify references to external companies/products are surfaced as decisions/openQuestions, not absorbed into native extractions.',
    appliesTo: dispatchedIn('external_reference_handling'),
    promptTemplatePath:
      'prompts/review/discovery/external_reference_handling.system.md',
    invoke: invokeExternalReferenceHandling,
  },
  {
    id: 'regime_citation_validity',
    family: 'discovery',
    kind: 'llm',
    description:
      'Compliance-specific: verify named regulatory regimes appear in source; source-named regimes are extracted.',
    appliesTo: dispatchedIn('regime_citation_validity'),
    promptTemplatePath: 'prompts/review/discovery/regime_citation_validity.system.md',
    invoke: invokeRegimeCitationValidity,
  },
  {
    id: 'retention_threshold_grounding',
    family: 'discovery',
    kind: 'llm',
    description:
      'Compliance-specific: verify every numeric retention period is verbatim attested in cited source span.',
    appliesTo: dispatchedIn('retention_threshold_grounding'),
    promptTemplatePath:
      'prompts/review/discovery/retention_threshold_grounding.system.md',
    invoke: invokeRetentionThresholdGrounding,
  },
  {
    id: 'compliance_signal_completeness',
    family: 'discovery',
    kind: 'llm',
    description:
      'Compliance-specific: detect high-salience compliance hooks in source (HOA/POA, W-9/1099, PCI, ESIGN/UETA, audit trail) not surfaced in response.',
    appliesTo: dispatchedIn('compliance_signal_completeness'),
    promptTemplatePath:
      'prompts/review/discovery/compliance_signal_completeness.system.md',
    invoke: invokeComplianceSignalCompleteness,
  },

  // ── Family: bloom ─────────────────────────────────────────────────
  // Phase 1.5–1.10 bloom-and-prune passes (trans-sibling by design;
  // scope_boundary_adherence is intentionally NOT applicable).
  {
    id: 'source_attribution_grounding',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify every bloom item source tag (user-specified / document-specified / domain-standard / ai-proposed) reflects its relationship to source. Reused per-AC / per-(threshold, method) anchor in requirements passes.',
    appliesTo: dispatchedIn('source_attribution_grounding'),
    promptTemplatePath: 'prompts/review/bloom/source_attribution_grounding.system.md',
    invoke: invokeSourceAttributionGrounding,
  },
  {
    id: 'persona_id_continuity',
    family: 'bloom',
    kind: 'deterministic',
    description:
      'Compare upstream persona IDs to output persona IDs; flag drift, drops, fabricated document-specified tags on new IDs.',
    appliesTo: dispatchedIn('persona_id_continuity'),
    validate: validatePersonaIdContinuity,
  },
  {
    id: 'bloom_completeness_vs_thinking',
    family: 'bloom',
    kind: 'llm',
    description:
      'Detect candidates the agent considered then rejected on grounds the bloom mandate forbids ("low priority", "future scope", "too niche").',
    appliesTo: dispatchedIn('bloom_completeness_vs_thinking'),
    promptTemplatePath: 'prompts/review/bloom/bloom_completeness_vs_thinking.system.md',
    invoke: invokeBloomCompletenessVsThinking,
  },
  {
    id: 'spec_boundary_respect_bloom',
    family: 'bloom',
    kind: 'llm',
    description:
      'Detect bloom items that contradict a stated technical constraint or cover a concept the intent-discovery decisions list as excluded. Reads product_intent_discovery.decisions and technical_constraints_discovery.technicalConstraints from prior artifacts. Advisory.',
    appliesTo: dispatchedIn('spec_boundary_respect_bloom'),
    promptTemplatePath: 'prompts/review/bloom/spec_boundary_respect_bloom.system.md',
    invoke: invokeSpecBoundaryRespectBloom,
  },
  {
    id: 'entity_workflow_shape',
    family: 'bloom',
    kind: 'deterministic',
    description:
      'Heuristic detector for nouns-vs-verbs misclassification in entityPreview/workflowPreview (with LLM fallback in Commits 3+).',
    appliesTo: dispatchedIn('entity_workflow_shape'),
    validate: validateEntityWorkflowShape,
  },
  {
    id: 'source_grouping_coverage',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify source-stated top-level groupings (modules, suites, product lines) are represented in bloom output domains.',
    appliesTo: dispatchedIn('source_grouping_coverage'),
    promptTemplatePath: 'prompts/review/bloom/source_grouping_coverage.system.md',
    invoke: invokeSourceGroupingCoverage,
  },
  {
    id: 'domain_persona_coherence',
    family: 'bloom',
    kind: 'llm',
    description: 'Bidirectional persona ↔ domain coverage check.',
    appliesTo: dispatchedIn('domain_persona_coherence'),
    promptTemplatePath: 'prompts/review/bloom/domain_persona_coherence.system.md',
    invoke: invokeDomainPersonaCoherence,
  },
  {
    id: 'journey_id_continuity',
    family: 'bloom',
    kind: 'deterministic',
    description:
      'Compare phasing-strategy-named journey IDs to output IDs; flag renames and drops.',
    appliesTo: dispatchedIn('journey_id_continuity'),
    validate: validateJourneyIdContinuity,
  },
  {
    id: 'surface_attribution_completeness',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify journey surfaces[] arrays cite the upstream compliance/retention/V&V/integration items the journey enacts.',
    appliesTo: dispatchedIn('surface_attribution_completeness'),
    promptTemplatePath: 'prompts/review/bloom/surface_attribution_completeness.system.md',
    invoke: invokeSurfaceAttributionCompleteness,
  },
  {
    id: 'workflow_journey_separation',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify userJourneys[] entries are persona-led end-to-end flows, not system workflows.',
    appliesTo: dispatchedIn('workflow_journey_separation'),
    promptTemplatePath: 'prompts/review/bloom/workflow_journey_separation.system.md',
    invoke: invokeWorkflowJourneySeparation,
  },
  {
    id: 'step_completeness_and_automatable',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify step structure and the two-clause automatable rule (system-actor OR persona-trigger-with-system-weight).',
    appliesTo: dispatchedIn('step_completeness_and_automatable'),
    promptTemplatePath:
      'prompts/review/bloom/step_completeness_and_automatable.system.md',
    invoke: invokeStepCompletenessAndAutomatable,
  },
  {
    id: 'acceptance_criteria_measurability',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify ACs are falsifiable, behaviour-grounded, not pure latency or vacuous.',
    appliesTo: dispatchedIn('acceptance_criteria_measurability'),
    promptTemplatePath:
      'prompts/review/bloom/acceptance_criteria_measurability.system.md',
    invoke: invokeAcceptanceCriteriaMeasurability,
  },
  {
    id: 'persona_journey_coupling',
    family: 'bloom',
    kind: 'llm',
    description:
      'Every persona has a journey or honest unreached_personas[] entry; every step actor resolves to a persona or System.',
    appliesTo: dispatchedIn('persona_journey_coupling'),
    promptTemplatePath: 'prompts/review/bloom/persona_journey_coupling.system.md',
    invoke: invokePersonaJourneyCoupling,
  },
  {
    id: 'domain_journey_coupling',
    family: 'bloom',
    kind: 'llm',
    description: 'Mirror of persona_journey_coupling for domains.',
    appliesTo: dispatchedIn('domain_journey_coupling'),
    promptTemplatePath: 'prompts/review/bloom/domain_journey_coupling.system.md',
    invoke: invokeDomainJourneyCoupling,
  },
  {
    id: 'phase_journey_alignment',
    family: 'bloom',
    kind: 'llm',
    description:
      'Verify phase-tag assignments respect the phasing strategy persona/domain → phase mapping.',
    appliesTo: dispatchedIn('phase_journey_alignment'),
    promptTemplatePath: 'prompts/review/bloom/phase_journey_alignment.system.md',
    invoke: invokePhaseJourneyAlignment,
  },

  // ── Family: synthesis ─────────────────────────────────────────────
  // Compression-shaped handoff outputs (product description synthesis,
  // release plan, ADR rationales, narrative curator).
  {
    id: 'synthesis_coverage_audit',
    family: 'synthesis',
    kind: 'llm',
    description:
      'For each multi-item set in substrate, build coverage matrix: SURVIVED_NAMED / SURVIVED_IMPLICIT / DROPPED_SILENT.',
    appliesTo: dispatchedIn('synthesis_coverage_audit'),
    promptTemplatePath: 'prompts/review/synthesis/synthesis_coverage_audit.system.md',
    invoke: invokeSynthesisCoverageAudit,
  },
  {
    id: 'synthesis_fabrication_check',
    family: 'synthesis',
    kind: 'llm',
    description:
      'Confirm every noun phrase, named concept, framing metaphor, and claim in the synthesis traces to a substrate item.',
    appliesTo: dispatchedIn('synthesis_fabrication_check'),
    promptTemplatePath: 'prompts/review/synthesis/synthesis_fabrication_check.system.md',
    invoke: invokeSynthesisFabricationCheck,
  },
  {
    id: 'handoff_field_completeness',
    family: 'synthesis',
    kind: 'deterministic',
    description:
      'Verify each required handoff field is populated meaningfully (not a placeholder, not a copy of the seed). Deterministic prefilter; LLM follow-up in Commits 3+.',
    appliesTo: dispatchedIn('handoff_field_completeness'),
    validate: validateHandoffFieldCompleteness,
  },
  {
    id: 'compression_fidelity_audit',
    family: 'synthesis',
    kind: 'llm',
    description:
      'Identify load-bearing nuance from substrate that the synthesis preserved, partially preserved (collapsed distinctions), or lost.',
    appliesTo: dispatchedIn('compression_fidelity_audit'),
    promptTemplatePath: 'prompts/review/synthesis/compression_fidelity_audit.system.md',
    invoke: invokeCompressionFidelityAudit,
  },
  {
    id: 'phasing_dependency_consistency',
    family: 'synthesis',
    kind: 'llm',
    description:
      'Verify phasing/release structure respects dependency ordering implied by substrate. Splits into wave_dependency_topology + compliance_sequencing_audit at release-plan scope.',
    appliesTo: dispatchedIn('phasing_dependency_consistency'),
    promptTemplatePath:
      'prompts/review/synthesis/phasing_dependency_consistency.system.md',
    invoke: invokePhasingDependencyConsistency,
  },
  {
    id: 'wave_dependency_topology',
    family: 'synthesis',
    kind: 'llm',
    description:
      'General DAG correctness on placement; back-edge detection over the approved Release Plan.',
    appliesTo: dispatchedIn('wave_dependency_topology'),
    promptTemplatePath: 'prompts/review/synthesis/wave_dependency_topology.system.md',
    invoke: invokeWaveDependencyTopology,
  },
  {
    id: 'compliance_sequencing_audit',
    family: 'synthesis',
    kind: 'llm',
    description:
      'Compliance-anchored specialisation: paid execution before vetting, fund movement before audit trail.',
    appliesTo: dispatchedIn('compliance_sequencing_audit'),
    promptTemplatePath: 'prompts/review/synthesis/compliance_sequencing_audit.system.md',
    invoke: invokeComplianceSequencingAudit,
  },
  {
    id: 'mvp_credibility_check',
    family: 'synthesis',
    kind: 'llm',
    description:
      'REL-1 supply/demand closure; demand journeys with no in-wave or earlier-wave supply are dead-letter.',
    appliesTo: dispatchedIn('mvp_credibility_check'),
    promptTemplatePath: 'prompts/review/synthesis/mvp_credibility_check.system.md',
    invoke: invokeMvpCredibilityCheck,
  },
  {
    id: 'release_balance_audit',
    family: 'synthesis',
    kind: 'llm',
    description:
      'Release-level balance / persona stranding / risk concentration across approved Releases. Renamed from pillar_balance_audit (decision §6.1).',
    appliesTo: dispatchedIn('release_balance_audit'),
    promptTemplatePath: 'prompts/review/synthesis/release_balance_audit.system.md',
    invoke: invokeReleaseBalanceAudit,
  },

  // ── Family: requirements_skeleton ─────────────────────────────────
  // FR/NFR Pass 1 (sub_phase 2.1.1 / 2.2.1) — root-pass spine.
  {
    id: 'story_structural_completeness',
    family: 'requirements_skeleton',
    kind: 'deterministic',
    description: 'FR-only: role / action / outcome shape on every user story.',
    appliesTo: dispatchedIn('story_structural_completeness'),
    validate: validateStoryStructuralCompleteness,
  },
  {
    id: 'nfr_structural_completeness',
    family: 'requirements_skeleton',
    kind: 'deterministic',
    description:
      'NFR-only: category / description / seed_threshold shape on every NFR.',
    appliesTo: dispatchedIn('nfr_structural_completeness'),
    validate: validateNfrStructuralCompleteness,
  },
  {
    id: 'handoff_coverage_audit',
    family: 'requirements_skeleton',
    kind: 'llm',
    description:
      'Spine coverage: FR ⇒ UJ-set; NFR ⇒ V&V ∪ material-COMP. Deactivates at enrichment (subsumed by enrichment_echo_invariance).',
    appliesTo: dispatchedIn('handoff_coverage_audit'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/handoff_coverage_audit.system.md',
    invoke: invokeHandoffCoverageAudit,
  },
  {
    id: 'fr_trace_pollution_check',
    family: 'requirements_skeleton',
    kind: 'deterministic',
    description: 'NFR-only: no US-* / AC-* in traces_to (FR vs NFR boundary).',
    appliesTo: dispatchedIn('fr_trace_pollution_check'),
    validate: validateFrTracePollutionCheck,
  },
  {
    id: 'story_shape_conformance',
    family: 'requirements_skeleton',
    kind: 'llm',
    description: 'FR-only: story narrative shape conformance.',
    appliesTo: dispatchedIn('story_shape_conformance'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/story_shape_conformance.system.md',
    invoke: invokeStoryShapeConformance,
  },
  {
    id: 'nfr_shape_conformance',
    family: 'requirements_skeleton',
    kind: 'llm',
    description: 'NFR-only: NFR description+threshold shape conformance.',
    appliesTo: dispatchedIn('nfr_shape_conformance'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/nfr_shape_conformance.system.md',
    invoke: invokeNfrShapeConformance,
  },
  {
    id: 'pass_scope_discipline',
    family: 'requirements_skeleton',
    kind: 'llm',
    description:
      'Verify pass-1 / pass-2 / pass-3 boundaries (no NFR thresholds in FR ACs, no Pass-3 cross-NFR work at Pass 2).',
    appliesTo: dispatchedIn('pass_scope_discipline'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/pass_scope_discipline.system.md',
    invoke: invokePassScopeDiscipline,
  },
  {
    id: 'threshold_presence_check',
    family: 'requirements_skeleton',
    kind: 'llm',
    description: 'NFR-only: detect missing or aspirational seed thresholds.',
    appliesTo: dispatchedIn('threshold_presence_check'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/threshold_presence_check.system.md',
    invoke: invokeThresholdPresenceCheck,
  },
  {
    id: 'quality_attribute_taxonomy_alignment',
    family: 'requirements_skeleton',
    kind: 'llm',
    description:
      'NFR-only: detect taxonomy miscategorisations (auditability vs observability vs maintainability).',
    appliesTo: dispatchedIn('quality_attribute_taxonomy_alignment'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/quality_attribute_taxonomy_alignment.system.md',
    invoke: invokeQualityAttributeTaxonomyAlignment,
  },
  {
    id: 'measurement_adequacy_validator',
    family: 'requirements_skeleton',
    kind: 'llm',
    description:
      'CONSISTENCY-ONLY at skeleton (description ↔ condition / threshold); FULL eleven-pattern battery at enrichment + saturation. Centerpiece validator.',
    appliesTo: dispatchedIn('measurement_adequacy_validator'),
    promptTemplatePath:
      'prompts/review/requirements_skeleton/measurement_adequacy_validator.system.md',
    invoke: invokeMeasurementAdequacyValidator,
  },

  // ── Family: requirements_enrichment ───────────────────────────────
  // FR/NFR Pass 2 (sub_phase 2.1.2 / 2.2.2) — AC + threshold/method.
  {
    id: 'enrichment_echo_invariance',
    family: 'requirements_enrichment',
    kind: 'deterministic',
    description:
      'Echoed-or-flagged: subsumes story_structural / handoff_coverage / shape_conformance via deep-equal on echoed fields.',
    appliesTo: dispatchedIn('enrichment_echo_invariance'),
    validate: validateEnrichmentEchoInvariance,
  },
  {
    id: 'ac_count_discipline',
    family: 'requirements_enrichment',
    kind: 'deterministic',
    description: 'FR-only: 3–7 ACs per story, hard cap 10.',
    appliesTo: dispatchedIn('ac_count_discipline'),
    validate: validateAcCountDiscipline,
  },
  {
    id: 'exemplar_leakage_detector',
    family: 'requirements_enrichment',
    kind: 'deterministic',
    description:
      'Levenshtein vs prompt exemplar block; detect copied exemplar values surfaced as authored content.',
    appliesTo: dispatchedIn('exemplar_leakage_detector'),
    validate: validateExemplarLeakageDetector,
  },
  {
    id: 'threshold_grounding_audit',
    family: 'requirements_enrichment',
    kind: 'llm',
    description:
      'FULL ORIGINAL SCOPE: numerics, cadences, status codes, sibling enums grounded against substrate.',
    appliesTo: dispatchedIn('threshold_grounding_audit'),
    promptTemplatePath:
      'prompts/review/requirements_enrichment/threshold_grounding_audit.system.md',
    invoke: invokeThresholdGroundingAudit,
  },
  {
    id: 'measurable_condition_executability',
    family: 'requirements_enrichment',
    kind: 'llm',
    description: 'FR-only: per-AC measurable_condition is operationally executable.',
    appliesTo: dispatchedIn('measurable_condition_executability'),
    promptTemplatePath:
      'prompts/review/requirements_enrichment/measurable_condition_executability.system.md',
    invoke: invokeMeasurableConditionExecutability,
  },
  {
    id: 'measurement_method_executability',
    family: 'requirements_enrichment',
    kind: 'llm',
    description: 'NFR-only: per-method measurement_method is operationally executable.',
    appliesTo: dispatchedIn('measurement_method_executability'),
    promptTemplatePath:
      'prompts/review/requirements_enrichment/measurement_method_executability.system.md',
    invoke: invokeMeasurementMethodExecutability,
  },
  {
    id: 'skeleton_drift_audit',
    family: 'requirements_enrichment',
    kind: 'llm',
    description:
      'Detect drift between skeleton-pass output and enrichment-pass output that should have echoed.',
    appliesTo: dispatchedIn('skeleton_drift_audit'),
    promptTemplatePath:
      'prompts/review/requirements_enrichment/skeleton_drift_audit.system.md',
    invoke: invokeSkeletonDriftAudit,
  },

  // ── Family: requirements_saturation ───────────────────────────────
  // DEFERRED per §6.8 — saturation samples not yet captured.
  // Entries exist so the registry is complete and downstream commits
  // can wire calibration without registry churn; predicates are
  // hard-coded false until a saturation calibration sample lands.
  {
    id: 'tier_decomposition_validator',
    family: 'requirements_saturation',
    kind: 'llm',
    description:
      'DEFERRED per §6.8 — saturation samples not yet captured. Saturation-only: atomic_leaf vs decomposable vs invalid_parent classification (original ChatGPT-5.5 §4 verbatim).',
    appliesTo: NEVER,
    promptTemplatePath:
      'prompts/review/requirements_saturation/tier_decomposition_validator.system.md',
  },

  // ── Family: saturation (cross-surface, §5.4) ──────────────────────
  // Applies to fr_saturation, nfr_saturation, component_saturation,
  // and data_model_saturation (different roles, same family rubric).
  {
    id: 'json_output_discipline_check',
    family: 'cross_role',
    kind: 'deterministic',
    description:
      'PRE-VALIDATOR: verify agent raw response is bare JSON (starts { or [, ends } or ], no markdown fences). Runs BEFORE LLM validator chain; HIGH on fence-wrapped JSON triggers short-circuit.',
    appliesTo: dispatchedIn('json_output_discipline_check'),
    validate: validateJsonOutputDiscipline,
  },
  {
    id: 'source_item_enumeration_completeness',
    family: 'discovery',
    kind: 'llm',
    description:
      'Verify every source item id (FR/NFR/system/component) the agent received appears in its output. Three modes: id_match (set-difference, deterministic), vocabulary_grounding (bidirectional, deterministic), semantic (LLM — Phase 3.1 system_boundary). HIGH on silent drop.',
    appliesTo: dispatchedIn('source_item_enumeration_completeness'),
    promptTemplatePath:
      'prompts/review/discovery/source_item_enumeration_completeness_semantic.system.md',
    invoke: invokeSourceItemEnumerationCompleteness,
  },
  {
    id: 'relationship_directionality_validator',
    family: 'discovery',
    kind: 'deterministic',
    description:
      'Phase 5.1: verify FK directions in data_models relationships are consistent with source cardinality descriptions. MEDIUM per reversed FK.',
    appliesTo: dispatchedIn('relationship_directionality_validator'),
    validate: validateRelationshipDirectionality,
  },
  {
    id: 'responsibility_atomicity_validator',
    family: 'bloom',
    kind: 'deterministic',
    description:
      'Phase 4.2: detect compound responsibility statements (CM-001 conjunction violations) in component descriptions. MEDIUM per offending statement.',
    appliesTo: dispatchedIn('responsibility_atomicity_validator'),
    validate: validateResponsibilityAtomicity,
  },
  {
    id: 'sr_allocation_completeness_validator',
    family: 'bloom',
    kind: 'deterministic',
    description:
      'Phase 4.2: verify all input SR ids are covered by at least one component; undeclared cross-allocations. HIGH on uncovered SR; MEDIUM on undeclared cross-cut.',
    appliesTo: dispatchedIn('sr_allocation_completeness_validator'),
    validate: validateSrAllocationCompleteness,
  },
  {
    id: 'parent_branch_classification_check',
    family: 'saturation',
    kind: 'deterministic',
    description:
      'Saturation-class: verify parent_branch_classification (atomic_leaf/decomposable/invalid_parent) is consistent with child count and tier rules. HIGH on contract violation.',
    appliesTo: dispatchedIn('parent_branch_classification_check'),
    validate: validateParentBranchClassification,
  },
  {
    id: 'decomposition_fanout_discipline',
    family: 'saturation',
    kind: 'deterministic',
    description:
      'Saturation-class: enforce 1 child for atomic, 1–8 for decomposable, and no flat-mapping anti-pattern. HIGH on rule violation.',
    appliesTo: dispatchedIn('decomposition_fanout_discipline'),
    validate: validateDecompositionFanoutDiscipline,
  },
  {
    id: 'traces_to_id_validity',
    family: 'saturation',
    kind: 'deterministic',
    description:
      'Cross-role saturation: verify every reference id in the parameterized field (traces_to[], dependencies[].component_id, references[]) resolves to a known id. Field path varies by (agentRole, subPhaseId). HIGH at depth≥2; LOW at depth 0–1.',
    appliesTo: dispatchedIn('traces_to_id_validity'),
    validate: validateTracesToIdValidity,
  },
  {
    id: 'entity_kind_consistency_validator',
    family: 'saturation',
    kind: 'deterministic',
    description:
      'Phase 5.1a data_model_saturation: verify the PK-holding entity is not classified as kind="value_type". LOW-MEDIUM on misclassification.',
    appliesTo: dispatchedIn('entity_kind_consistency_validator'),
    validate: validateEntityKindConsistency,
  },
  {
    id: 'tier_override_assumption_validator',
    family: 'saturation',
    kind: 'deterministic',
    description:
      'Phase 5.1a data_model_saturation: verify that agrees_with_hint=false is accompanied by a surfaced assumption documenting the override rationale. LOW on missing override rationale.',
    appliesTo: dispatchedIn('tier_override_assumption_validator'),
    validate: validateTierOverrideAssumption,
  },
  {
    id: 'ungrounded_operational_specifics',
    family: 'discovery',
    kind: 'llm',
    description:
      'Discovery-class: verify concrete operational/technical details in schema fields are grounded in source. Three parameterizations: A (interface commitments), B (ADR thresholds — bidirectional), C (runtime specifics: URLs, buckets, defaults). HIGH on binding ungrounded values.',
    appliesTo: dispatchedIn('ungrounded_operational_specifics'),
    promptTemplatePath: 'prompts/review/discovery/ungrounded_operational_specifics.system.md',
    invoke: invokeUngroundedOperationalSpecifics,
  },
  {
    id: 'interface_contract_alignment_validator',
    family: 'discovery',
    kind: 'llm',
    description:
      'Phase 5.2: verify each api_definitions component uses the protocol declared in its matching Phase 3.3 interface contract. HIGH on protocol mismatch.',
    appliesTo: dispatchedIn('interface_contract_alignment_validator'),
    promptTemplatePath: 'prompts/review/discovery/interface_contract_alignment_validator.system.md',
    invoke: invokeInterfaceContractAlignmentValidator,
  },
  {
    id: 'tier_assignment_audit',
    family: 'saturation',
    kind: 'llm',
    description:
      'Saturation-class: verify each child tier (A/B/C/D) is consistent with description, AC count, and decomposition_rationale. MEDIUM for off-by-one; HIGH for cross-tier.',
    appliesTo: dispatchedIn('tier_assignment_audit'),
    promptTemplatePath: 'prompts/review/saturation/tier_assignment_audit.system.md',
    invoke: invokeTierAssignmentAudit,
  },
  {
    id: 'surfaced_assumption_novelty',
    family: 'saturation',
    kind: 'llm',
    description:
      'Saturation-class hybrid (deterministic id-dedup + LLM semantic novelty): verify each surfaced_assumption is not a duplicate/paraphrase of existing assumptions; verify category matches content. MEDIUM on duplicate; LOW on category drift.',
    appliesTo: dispatchedIn('surfaced_assumption_novelty'),
    promptTemplatePath: 'prompts/review/saturation/surfaced_assumption_novelty.system.md',
    invoke: invokeSurfacedAssumptionNovelty,
  },
  {
    id: 'nfr_threshold_grounding',
    family: 'saturation',
    kind: 'llm',
    description:
      'NFR saturation outlier: every numeric threshold in child NFR measurable_condition / seed_threshold must be grounded in parent NFR / handoff. HIGH on fabricated threshold.',
    appliesTo: dispatchedIn('nfr_threshold_grounding'),
    promptTemplatePath: 'prompts/review/saturation/nfr_threshold_grounding.system.md',
    invoke: invokeNfrThresholdGrounding,
  },
  {
    id: 'adr_status_discipline_validator',
    family: 'role_specific',
    kind: 'deterministic',
    description:
      'Phase 4.3 adr_capture: enforce ADR status default of proposed unless explicit acceptance rationale is present. LOW when all ADRs accepted without rationale; MEDIUM per individual.',
    appliesTo: dispatchedIn('adr_status_discipline_validator'),
    validate: validateAdrStatusDiscipline,
  },
  {
    id: 'error_type_source_attestation_validator',
    family: 'role_specific',
    kind: 'llm',
    description:
      'Phase 5.3 error_handling: for each error_types value, classify attestation as directly named / source-derivable / plausible-unattested / fabricated-generic. HIGH on group D; MEDIUM on group C; LOW on group B.',
    appliesTo: dispatchedIn('error_type_source_attestation_validator'),
    promptTemplatePath: 'prompts/review/role_specific/error_type_source_attestation_validator.system.md',
    invoke: invokeErrorTypeSourceAttestationValidator,
  },

  // ── Family: role_specific (one-of validators) ─────────────────────
  // Tied to a single role's contract; no cross-role generalisation.
  {
    id: 'completeness_evidence_adequacy',
    family: 'role_specific',
    kind: 'llm',
    description:
      'IQC-only (S01): verify cited evidence on completeness_findings.status="present" is commensurate with intent scope.',
    appliesTo: dispatchedIn('completeness_evidence_adequacy'),
    promptTemplatePath:
      'prompts/review/role_specific/completeness_evidence_adequacy.system.md',
    invoke: invokeCompletenessEvidenceAdequacy,
  },
  {
    id: 'coherence_evidence_audit',
    family: 'role_specific',
    kind: 'llm',
    description:
      'IQC-only (S01): scan source for concrete coherence defects (empty sections, TBDs, competitor-reference specs) and verify each is represented in coherence_findings.',
    appliesTo: dispatchedIn('coherence_evidence_audit'),
    promptTemplatePath:
      'prompts/review/role_specific/coherence_evidence_audit.system.md',
    invoke: invokeCoherenceEvidenceAudit,
  },
  {
    id: 'status_consistency_iqc',
    family: 'role_specific',
    kind: 'deterministic',
    description:
      'IQC-only (S01): encode IQC overall_status rules (pass / requires_input / blocking) as deterministic code.',
    appliesTo: dispatchedIn('status_consistency_iqc'),
    validate: validateStatusConsistencyIqc,
  },
  {
    id: 'calibration_rule_consistency_lens',
    family: 'role_specific',
    kind: 'deterministic',
    description:
      'Lens-only (S02): encode calibration table (0.9–1.0 = no competing lens; <0.8 ⇒ name competitors) as deterministic code.',
    appliesTo: dispatchedIn('calibration_rule_consistency_lens'),
    validate: validateCalibrationRuleConsistencyLens,
  },
  {
    id: 'confidence_calibration_lens',
    family: 'role_specific',
    kind: 'llm',
    description:
      'Lens-only (S02): semantic counterpart — judge whether chosen confidence band is justified by evidentiary state and competitor analysis.',
    appliesTo: dispatchedIn('confidence_calibration_lens'),
    promptTemplatePath:
      'prompts/review/role_specific/confidence_calibration_lens.system.md',
    invoke: invokeConfidenceCalibrationLens,
  },
  {
    id: 'intent_vs_artifact_scope_audit',
    family: 'role_specific',
    kind: 'llm',
    description:
      'Lens-only (S02): for meta-recursive intents ("execute the attached spec"), detect unflagged inheritance of lens from artefact.',
    appliesTo: dispatchedIn('intent_vs_artifact_scope_audit'),
    promptTemplatePath:
      'prompts/review/role_specific/intent_vs_artifact_scope_audit.system.md',
    invoke: invokeIntentVsArtifactScopeAudit,
  },
];

// ── Lookup helpers ─────────────────────────────────────────────────

const ENTRIES_BY_ID: ReadonlyMap<string, ValidatorEntry> = new Map(
  ENTRIES.map((entry) => [entry.id, entry] as const),
);

/** Frozen registry — readonly view for callers. */
export const VALIDATOR_REGISTRY: readonly ValidatorEntry[] = Object.freeze([...ENTRIES]);

export function getValidatorById(id: string): ValidatorEntry | undefined {
  return ENTRIES_BY_ID.get(id);
}

/**
 * Select validators for a (role, sub_phase, output) triple. Returns
 * entries in registry-declaration order so dispatch is deterministic.
 * Sequential single-GPU dispatch is the locked policy (harness_design
 * §3) so this order is also the execution order.
 */
export function selectValidators(params: {
  agentRole: string;
  subPhaseId: string;
  outputContent: Record<string, unknown> | null;
  outputThinking: string | null;
}): ValidatorEntry[] {
  return VALIDATOR_REGISTRY.filter((entry) => entry.appliesTo(params));
}

/**
 * Sanity-check the registry shape. Returns a list of human-readable
 * error strings, empty when valid. Intended for unit tests + a
 * one-time call at engine startup.
 */
export function validateRegistryStructure(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const entry of VALIDATOR_REGISTRY) {
    if (!entry.id || typeof entry.id !== 'string') {
      errors.push(`Validator entry missing id: ${JSON.stringify(entry)}`);
      continue;
    }
    if (seen.has(entry.id)) {
      errors.push(`Duplicate validator id: ${entry.id}`);
    }
    seen.add(entry.id);
    if (!entry.family) errors.push(`Validator ${entry.id} missing family.`);
    if (!entry.description) errors.push(`Validator ${entry.id} missing description.`);
    if (typeof entry.appliesTo !== 'function') {
      errors.push(`Validator ${entry.id} missing appliesTo predicate.`);
    }
    if (entry.kind === 'llm') {
      if (!entry.promptTemplatePath) {
        errors.push(`LLM validator ${entry.id} missing promptTemplatePath.`);
      } else if (!entry.promptTemplatePath.startsWith('prompts/review/')) {
        errors.push(
          `LLM validator ${entry.id} promptTemplatePath must start with 'prompts/review/' (got '${entry.promptTemplatePath}').`,
        );
      }
    } else if (entry.kind !== 'deterministic') {
      // Defensive future-proof branch: if a new ValidatorEntry kind is added
      // to the union, this catches it before silent dispatch failure. TS
      // narrows `entry` to `never` here because the union is exhausted, so
      // access via cast.
      const stranded = entry as { id: string; kind: unknown };
      errors.push(`Validator ${stranded.id} has unknown kind: ${stranded.kind}`);
    }
  }

  // Cross-check: every id referenced by a dispatch bundle must exist
  // in the registry. Catches typos in the bundle table.
  for (const [key, ids] of DISPATCH_BUNDLES) {
    for (const id of ids) {
      if (!ENTRIES_BY_ID.has(id)) {
        errors.push(`Dispatch bundle '${key}' references unknown validator id: ${id}`);
      }
    }
  }
  for (const id of PLACEHOLDER_BUNDLE) {
    if (!ENTRIES_BY_ID.has(id)) {
      errors.push(`Placeholder bundle references unknown validator id: ${id}`);
    }
  }

  return errors;
}

// Internal exports — exposed for the harness module + tests, not the
// public API. Re-export sparingly.
export const __INTERNALS = {
  bundleFor,
  PLACEHOLDER_BUNDLE,
  SATURATION_UNIVERSAL_BUNDLE,
};
