# Reasoning Review Harness — Master Design

(Companion document to `validator_catalog.md`. Where the catalog defines validator identity and prompt templates, this document defines the *harness* that runs them: dispatch, lifecycle, persistence, decision policy, token tracking, implementation order. References to source per-role assessments are by sample number; cross-references to the catalog are by section.)

---

## 1. Architecture overview

The reasoning-review harness is a per-output advisory pipeline that fires after every successful agent_output (parsed JSON, schema-valid at the agent's contract level). Given a tuple `(agent_role, sub_phase, output_shape, agent_thinking_chain)`, the harness:

1. **Dispatches** a conditional set of validators based on the family taxonomy (`validator_catalog.md` §0) and the per-role conditional rules (§2 below).
2. **Runs deterministic validators first** as a gate; if any fires HIGH-severity blocking findings (contract violation, echo failure, invalid JSON), the harness short-circuits to `final_synthesis` rather than spending LLM tokens on a structurally broken response.
3. **Runs LLM validators in family-specific order** (universal cross-role first, then family-class, then role-specific outliers).
4. **Persists per-validator records** linked by a `harness_id` (§5).
5. **Captures token usage** per validator call (§7).
6. **Runs `final_synthesis`** to emit a decision recommendation (ACCEPT / ACCEPT_WITH_NOTES / REVISE / QUARANTINE / ESCALATE) and prompt-patch / rerun recommendations.
7. **Stays advisory** — the harness records its decision as data; gating policy stays at the workflow level (Phase 9 quarantine continues to apply on HIGH severity, per existing semantics).

The harness replaces the current single-pass `prompts/cross_cutting/reasoning_review.system.md` reviewer hook in `LLMCaller` (or whichever hook fires the current Gemma reviewer). The current reviewer prompt is retired in favour of the validator pipeline; its template's broad-scope content is largely absorbed into `reasoning_quality_validator` at narrower scope.

---

## 2. Conditional dispatch logic

For each `(agent_role, sub_phase)` pair drawn from the 12 sampled assessments + the saturation passes from the original ChatGPT-5.5 reference, the dispatcher activates a validator bundle. Pairs not yet sampled receive a placeholder bundle (universal cross-role + `reasoning_quality_validator`) until per-role samples are captured.

### 2.1 Sampled (agent_role, sub_phase) pairs

Listed in display-code order (cross-reference `phaseManifest.ts`).

**Family-sharing note (cal-26 Phase 4):** `domain_interpreter / component_saturation` (entry 4.2a below) shares the §5.4 saturation-class family with `requirements_agent / fr_saturation` (entry 2.1.4) and `requirements_agent / nfr_saturation` (entry 2.2.4) — same family, different role and surface. The decomposition rubric is isomorphic; `traces_to_id_validity` is parameterized to `dependencies[].component_id` for the component surface. See `validator_catalog.md` §5.4.1 parameterization note and §7.7.

#### orchestrator / intent_quality_check (1.1) — sample 01

```
Always-on (deterministic): contract_schema_validator, status_consistency_iqc
Always-on (LLM):           grounding_validator (narrowed),
                           completeness_evidence_adequacy,
                           coherence_evidence_audit,
                           reasoning_to_response_faithfulness
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator, tier_decomposition_validator,
                           assumption_citation_validator (no surfaced_assumptions field),
                           reasoning_quality_validator (covered by faithfulness +
                             coherence_evidence_audit at this scope)
```

#### orchestrator / intent_lens_classification (1.2) — sample 02

```
Always-on (deterministic): contract_schema_validator, calibration_rule_consistency_lens
Always-on (LLM):           grounding_validator (narrowed to rationale),
                           confidence_calibration_lens
Conditional (LLM):         intent_vs_artifact_scope_audit  (when raw intent is
                             meta-recursive AND artefact ≥ 500 chars)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator, tier_decomposition_validator,
                           assumption_citation_validator, coherence_evidence_audit,
                           completeness_evidence_adequacy, reasoning_quality_validator
                             (covered by confidence_calibration_lens + faithfulness)
```

#### domain_interpreter / product_intent_discovery (1.3.1) — sample 03

```
Always-on (deterministic): contract_schema_validator, extraction_id_traceability
Always-on (LLM):           grounding_validator,
                           scope_boundary_adherence_discovery [param: 1.0b],
                           open_question_vs_decided,
                           persona_journey_coherence
Conditional (LLM):         external_reference_handling  (source contains company-name
                             / "like X" / "see Y appendix" patterns)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator, tier_decomposition_validator,
                           assumption_citation_validator (collapses to extraction_id_traceability),
                           reasoning_quality_validator (covered by other validators)
```

#### domain_interpreter / compliance_retention_discovery (1.3.3) — sample 04

```
Always-on (deterministic): contract_schema_validator, extraction_id_traceability_compliance
Always-on (LLM):           grounding_validator,
                           regime_citation_validity,
                           retention_threshold_grounding,
                           scope_boundary_adherence_discovery [param: 1.0d],
                           compliance_signal_completeness,
                           open_question_vs_decided
Conditional (LLM):         external_reference_handling
                           reasoning_to_response_faithfulness
Synthesis:                 final_synthesis
Excluded:                  same as 1.3.1
```

#### domain_interpreter / business_domains_bloom (1.5) — sample 05

```
Always-on (deterministic): contract_schema_validator, persona_id_continuity,
                           entity_workflow_shape (with LLM fallback)
Always-on (LLM):           source_attribution_grounding,
                           domain_persona_coherence,
                           open_question_vs_decided
Conditional (LLM):         pillar_domain_alignment  (source has organising-concept tokens)
                           bloom_completeness_vs_thinking  (thinking_chain.length > 0)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  scope_boundary_adherence_* (bloom is trans-sibling by design),
                           grounding_validator (subsumed by source_attribution_grounding),
                           measurement_adequacy_validator, tier_decomposition_validator,
                           regime/retention/compliance_signal validators
```

#### domain_interpreter / user_journey_bloom (1.6) — sample 06

```
Always-on (deterministic): contract_schema_validator, persona_id_continuity,
                           journey_id_continuity
Always-on (LLM):           source_attribution_grounding (extended to surfaces[]),
                           surface_attribution_completeness,
                           persona_journey_coupling,
                           domain_journey_coupling,
                           workflow_journey_separation,
                           step_completeness_and_automatable,
                           acceptance_criteria_measurability,
                           open_question_vs_decided
Conditional (LLM):         phase_journey_alignment  (phasing strategy present)
                           bloom_completeness_vs_thinking  (thinking_chain.length > 0)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  scope_boundary_adherence_*, entity_workflow_shape (no
                           entityPreview/workflowPreview), regime_citation_validity
```

#### domain_interpreter / product_description_synthesis (1.11) — sample 07

```
Always-on (deterministic): contract_schema_validator, handoff_field_completeness (prefilter)
Always-on (LLM):           synthesis_coverage_audit,
                           compression_fidelity_audit,
                           synthesis_fabrication_check,
                           grounding_validator,
                           open_question_vs_decided,
                           handoff_field_completeness (LLM follow-up)
Conditional (LLM):         phasing_dependency_consistency  (synthesis has phasing field —
                             vacuous at sample 07, load-bearing at later passes)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  bloom-class validators, scope_boundary_adherence_*,
                           measurement_adequacy_validator, tier_decomposition_validator
```

#### orchestrator / release_plan (1.13) — sample 08

```
Always-on (deterministic): contract_schema_validator (full coverage / uniqueness /
                             contiguity rules), handoff_field_completeness (prefilter)
Always-on (LLM):           release_plan_coverage_audit (LLM follow-up portion),
                           wave_dependency_topology,
                           mvp_credibility_check,
                           release_balance_audit,
                           compression_fidelity_audit,
                           synthesis_fabrication_check
Conditional (LLM):         compliance_sequencing_audit  (substrate has any regulated-
                             domain journey: DOM-COMPLIANCE / DOM-LEDGER /
                             DOM-IDENTITY / DOM-FINANCE)
                           open_question_resolution_discipline  (upstream has
                             openLoops items)
                           reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
Excluded:                  bloom-class validators, scope_boundary_adherence_*,
                           tier_decomposition_validator
```

#### requirements_agent / fr_bloom_skeleton (2.1.1) — sample 09

```
Always-on (deterministic): contract_schema_skeleton,
                           story_structural_completeness,
                           handoff_coverage_audit
Always-on (LLM):           source_attribution_grounding,
                           story_shape_conformance,
                           pass_scope_discipline (Pass-1),
                           reasoning_to_response_faithfulness
Conditional (LLM):         grounding_validator  (regex prefilter: numerics,
                             cardinalities, HTTP-shapes in any seed AC)
                           measurement_adequacy_validator (CONSISTENCY-ONLY)
                             (when pass_scope_discipline reports description-vs-
                             condition mismatch OR comparator tokens present)
                           open_question_vs_decided  (Q-* in traces_to)
                           reasoning_quality_validator
                           assumption_citation_validator (trace-only collapse)
Synthesis:                 final_synthesis
Excluded:                  tier_decomposition_validator (re-engages at saturation),
                           bloom-class, synthesis-class, discovery-class
```

#### requirements_agent / fr_bloom_enrichment (2.1.2) — sample 10

```
Always-on (deterministic): contract_schema_enrichment,
                           enrichment_echo_invariance,
                           ac_count_discipline,
                           exemplar_leakage_detector
Always-on (LLM):           measurement_adequacy_validator (FULL ORIGINAL ChatGPT-5.5 SCOPE),
                           threshold_grounding_audit,
                           measurable_condition_executability,
                           skeleton_drift_audit,
                           reasoning_to_response_faithfulness
Conditional (LLM):         grounding_validator  (regex prefilter: HTTP/URL/ENUM tokens)
                           source_attribution_grounding  (when AC names entity/workflow/
                             journey id explicitly)
                           pass_scope_discipline (Pass-2)  (regex prefilter:
                             ms-latency / named-subsystem)
                           open_question_vs_decided  (Q-* in traces_to)
                           reasoning_quality_validator
                           assumption_citation_validator (trace-only)
Synthesis:                 final_synthesis
Excluded:                  story_structural_completeness, handoff_coverage_audit,
                           story_shape_conformance (subsumed by enrichment_echo_invariance),
                           tier_decomposition_validator
```

#### requirements_agent / nfr_bloom_skeleton (2.2.1) — sample 11

```
Always-on (deterministic): contract_schema_nfr_skeleton,
                           nfr_structural_completeness,
                           handoff_coverage_audit (V&V ∪ material-COMP spine),
                           fr_trace_pollution_check
Always-on (LLM):           source_attribution_grounding,
                           nfr_shape_conformance,
                           threshold_presence_check,
                           quality_attribute_taxonomy_alignment,
                           pass_scope_discipline (Pass-1 NFR),
                           reasoning_to_response_faithfulness
Conditional (LLM):         grounding_validator  (regex prefilter: numerics in seed_threshold)
                           measurement_adequacy_validator (CONSISTENCY-ONLY)
                           open_question_vs_decided  (rare at this pass)
                           reasoning_quality_validator
                           assumption_citation_validator (trace-only)
Synthesis:                 final_synthesis
Excluded:                  tier_decomposition_validator (re-engages at NFR saturation),
                           bloom-class, synthesis-class
```

#### requirements_agent / nfr_bloom_enrichment (2.2.2) — sample 12

```
Always-on (deterministic): contract_schema_enrichment_nfr,
                           enrichment_echo_invariance,
                           output_substantiveness_check,
                           exemplar_leakage_detector
Always-on (LLM):           measurement_adequacy_validator (FULL ORIGINAL SCOPE),
                           threshold_grounding_audit,
                           grounding_validator (always run on ≥30-char measurement_method),
                           measurement_method_executability,
                           skeleton_drift_audit,
                           reasoning_to_response_faithfulness
Conditional (LLM):         source_attribution_grounding  (when method invokes substrate
                             id by name)
                           pass_scope_discipline (Pass-2 NFR)
                           open_question_vs_decided
                           reasoning_quality_validator
                           assumption_citation_validator (trace-only)
Synthesis:                 final_synthesis
Excluded:                  ac_count_discipline (no AC array),
                           tier_decomposition_validator
```

#### requirements_agent / fr_saturation (2.1.4) — sample 13

Family-level validators defined in `validator_catalog.md` §5.4.1. Narrowing note for `reasoning_quality_validator` in §5.4.3.

```
Always-on (deterministic): contract_schema_validator (full saturation schema —
                             tier, parent_branch_classification, decomposition_rationale),
                           parent_branch_classification_check,
                           decomposition_fanout_discipline,
                           surfaced_assumption_novelty (deterministic side),
                           traces_to_id_validity
Always-on (LLM):           grounding_validator (parameterized for saturation context —
                             handoff + sibling chain as claim surface),
                           tier_assignment_audit,
                           surfaced_assumption_novelty (LLM side),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator (NARROWED — reasoning-vs-output
                             divergence only; see validator_catalog.md §5.4.3),
                           assumption_citation_validator (FULL form —
                             surfaced_assumptions[] active at saturation)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (saturation children receive
                             their own AC sets; measurement adequacy of those ACs is
                             the responsibility of subsequent per-child saturation
                             harness invocations, not the parent-level review),
                           any nfr-specific outliers (separate dispatch row 2.2.4)
```

#### requirements_agent / nfr_saturation (2.2.4) — sample 14

Same family-level set as fr_saturation (2.1.4) above, plus NFR-specific role outliers defined in `validator_catalog.md` §5.4.2.

```
Always-on (deterministic): contract_schema_validator (full saturation schema),
                           parent_branch_classification_check,
                           decomposition_fanout_discipline,
                           surfaced_assumption_novelty (deterministic side),
                           traces_to_id_validity
Always-on (LLM):           grounding_validator (parameterized for saturation context —
                             handoff + sibling chain),
                           tier_assignment_audit,
                           surfaced_assumption_novelty (LLM side),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator (NARROWED — see §5.4.3),
                           assumption_citation_validator (FULL form)
Role-specific (LLM):       nfr_threshold_grounding,
                           measurement_method_executability (parameterized for
                             per-child measurable_condition surface, not per-method-string)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (same rationale as fr_saturation)
```

#### systems_agent / system_boundary (3.1) — sample 15

Discovery-class family dispatch. See `validator_catalog.md` §2 for `source_item_enumeration_completeness` definition. `ungrounded_operational_specifics` is **not** dispatched at this sub-phase (no structured schema fields with operational commitment semantics; Phase 3.1 output is freeform in_scope / out_of_scope / external_systems arrays).

```
Always-on (deterministic): contract_schema_validator,
                           source_item_enumeration_completeness (semantic mode —
                             input is prose FR responsibilities, not explicit IDs;
                             LLM verifies each FR domain is semantically covered
                             by at least one in_scope entry)
Always-on (LLM):           grounding_validator (parameterized for system-spec context),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (no AC at this surface),
                           tier_decomposition_validator (no decomposition),
                           assumption_citation_validator (no surfaced_assumptions field),
                           saturation-class validators (not a saturation pass)
```

#### systems_agent / system_requirements (3.2) — sample 16

Discovery-class family dispatch. `source_item_enumeration_completeness` in id-match mode: extract all FR/NFR IDs from prompt context, assert each appears in at least one item's `source_requirement_ids[]` — pure TypeScript set-difference, no LLM call. `ungrounded_operational_specifics` is **not** dispatched (no structured operational-commitment schema fields at this sub-phase).

```
Always-on (deterministic): contract_schema_validator,
                           source_item_enumeration_completeness (id-match mode —
                             FR/NFR ids from prompt context → source_requirement_ids[]
                             arrays; compute set difference; pure code check)
Always-on (LLM):           grounding_validator,
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (no AC at this surface),
                           tier_decomposition_validator (no decomposition),
                           assumption_citation_validator (no surfaced_assumptions field),
                           saturation-class validators (not a saturation pass)
```

#### systems_agent / interface_contracts (3.3) — sample 17

Discovery-class family dispatch plus `ungrounded_operational_specifics (parameterization A)`. See `validator_catalog.md` §2 for the consolidated `ungrounded_operational_specifics` entry (formerly the `implementation_commitment_grounding` role-specific outlier — absorbed into §2 at Stage 1D.3). `source_item_enumeration_completeness` in id-match mode: extract the system IDs from the prompt's External Systems section, assert each appears in at least one contract's `systems_involved[]` array.

```
Always-on (deterministic): contract_schema_validator,
                           source_item_enumeration_completeness (id-match mode —
                             system ids from prompt's External Systems section →
                             systems_involved[] arrays across all contracts;
                             pure set-difference; exact 3-ID miss precision vs
                             LLM-estimated 6-item overinclusive list at sample 17)
Always-on (LLM):           grounding_validator,
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator,
                           ungrounded_operational_specifics (parameterization A —
                             targets auth_mechanism, error_handling_strategy, protocol,
                             data_format fields; cross-checks technology-name and
                             strategy-name patterns against source context;
                             formerly implementation_commitment_grounding — absorbed into
                             consolidated family entry; see validator_catalog.md §2)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (no AC at this surface),
                           tier_decomposition_validator (no decomposition),
                           assumption_citation_validator (no surfaced_assumptions field),
                           saturation-class validators (not a saturation pass)
```

#### architecture_agent / software_domains (4.1) — sample 18

Discovery-class family dispatch. Phase 4.1 is a vocabulary-term enumeration and grounding pass: the dominant defect is over-specification in vocabulary definitions (mechanism-level specificity not mandated by source SRs). See per-role assessment 18.

```
Always-on (deterministic): contract_schema_validator,
                           source_item_enumeration_completeness (vocabulary_grounding mode —
                             input is SR behavioral inventory per domain; output is
                             ubiquitous_language terms array; bidirectional: each term
                             definition must trace to at least one SR-mandated behavior,
                             and each mandated behavior cluster should have at least one
                             term; see validator_catalog.md §2 Phase 4 extension)
Always-on (LLM):           grounding_validator (parameterized for vocabulary-definition
                             context — detects over-specification of mechanism-level
                             specificity against SR source; e.g. naming algorithm or state
                             transitions not mandated by the SR),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
Excluded:                  saturation-class validators (not a saturation pass),
                           bloom-class structural validators (different contract surface —
                             ubiquitous_language terms, not responsibility/journey arrays),
                           ungrounded_operational_specifics (no ADR threshold or
                             operational-commitment schema fields at this sub-phase —
                             that validator's parameterization B is Phase 4.3 specific)
```

#### architecture_agent / component_skeleton (4.2) — sample 19

Bloom-class family dispatch. Phase 4.2 is a coverage bloom: generate a component set covering all SRs with each responsibility expressing a single cohesive concern (CM-001 invariant). Confirms the bloom-class prediction from `deferred_to_track_d.md` §1. See per-role assessment 19.

```
Always-on (deterministic): contract_schema_validator,
                           sr_allocation_completeness_validator (HIGH on uncovered SR;
                             MEDIUM on undeclared cross-allocation — checks that every
                             input SR id appears in at least one component allocation
                             and that split-SR allocations are declared in cross_cuts[];
                             see validator_catalog.md §3),
                           responsibility_atomicity_validator (MEDIUM on CM-001
                             conjunction violations — scans responsibility statements
                             for 'X AND Y' / 'X, Y, and Z' patterns implying hidden
                             sub-component scope; see validator_catalog.md §3)
Always-on (LLM):           grounding_validator (parameterized for responsibility-statement
                             context — checks unsupported claims in responsibility
                             statements against upstream SR text and component vocabulary),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
Excluded:                  saturation-class validators (not a saturation pass),
                           source_item_enumeration_completeness (SR coverage handled
                             by sr_allocation_completeness_validator at this surface),
                           domain/bloom-class validators from Phase 1 (different
                             contract shape — component_model vs. journey/domain arrays),
                           ungrounded_operational_specifics (no ADR or operational-commitment
                             schema fields at this sub-phase — component responsibility
                             statements are in scope for grounding_validator)
```

#### architecture_agent / adr_capture (4.3) — sample 20

Hybrid bundle: discovery-class grounding + thin decision-class layer. Phase 4.3 tasks the agent with capturing ADRs for every significant architectural choice; the dominant defect is introduction of unsupported technical thresholds. **Note**: adr_capture is an emergent sub-phase not in the original Phase 4 list; verify prompt and schema registration before Track D dispatch wiring (see `deferred_to_track_d.md` §7.1 and per-role assessment 20).

```
Always-on (deterministic): contract_schema_validator,
                           adr_status_discipline_validator (enforces 'proposed' default
                             unless explicit acceptance rationale present — see
                             validator_catalog.md §6; LOW-MEDIUM severity)
Always-on (LLM):           grounding_validator (parameterized for ADR context — HIGH on
                             unsupported technical thresholds; MEDIUM on partially-supported
                             entity generalizations; e.g. "SHA-256" when source says
                             "cryptographic checksum"),
                           ungrounded_operational_specifics (parameterization B —
                             bidirectional threshold check: each introduced threshold
                             must trace to upstream source → unsupported HIGH; each
                             upstream-mandated threshold must appear in at least one ADR →
                             dropped HIGH; partially supported → MEDIUM;
                             formerly mandated_threshold_inheritance — absorbed into
                             consolidated family entry; see validator_catalog.md §2),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
Excluded:                  source_item_enumeration_completeness (threshold coverage handled
                             by ungrounded_operational_specifics parameterization B
                             at this surface),
                           bloom-class validators, saturation-class validators,
                           sr_allocation_completeness_validator (no SR allocation at this
                             surface — ADR enumeration, not component coverage)
```

#### domain_interpreter / component_saturation (4.2a) — sample 21

Saturation-class family dispatch. `domain_interpreter` is the confirmed recursive saturation executor for Phase 4 component decomposition across all 34 cal-26 invocations on this surface. Same §5.4 saturation-class family as fr_saturation (2.1.4) and nfr_saturation (2.2.4) — same family, different role and surface. Decomposition rubric: (atomic_component / decomposable / invalid_parent); tier model: A/B/C/D. cal-26 reached depth 1 only; clean ACCEPTs at both depths 0 and 1. See per-role assessment 21.

```
Always-on (deterministic): contract_schema_validator (component saturation schema —
                             atomic_component / decomposable / invalid_parent,
                             tier A/B/C/D, agrees_with_hint, decomposition_rationale),
                           parent_branch_classification_check,
                           decomposition_fanout_discipline,
                           surfaced_assumption_novelty (deterministic side),
                           traces_to_id_validity (parameterized: dependencies[].component_id
                             — checks against sibling_context + emitted children;
                             see validator_catalog.md §5.4.1 parameterization note;
                             LOW at shallow depths, MEDIUM at depth ≥2)
Always-on (LLM):           grounding_validator (parameterized for component-context —
                             responsibility statements, tier rationale, active_constraints
                             narrowing),
                           tier_assignment_audit,
                           surfaced_assumption_novelty (LLM side),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator (NARROWED — reasoning-vs-output
                             divergence only; see validator_catalog.md §5.4.3 narrowing
                             note; must NOT fire on tier label quality or classification
                             rubric content)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (no AC surface at this pass),
                           nfr-specific outliers (nfr_threshold_grounding,
                             measurement_method_executability — different role),
                           bloom-class validators, discovery-class validators
```

**Phase 5 dispatch note (cal-26 samples 22–26b):** All five Phase 5 samples fell through to the PLACEHOLDER bundle at cal-26 time (Phase 5 not in DISPATCH_BUNDLES). Dispatch rows below are promoted as of Stage 1D.3. cal-26 evidence shows `technical_spec_agent` runs its own data_model_saturation pass with no role decoupling (unlike Phase 4 component_saturation which uses `domain_interpreter`). Per-(role, sub_phase) dispatch is the right granularity, not per-role. Note: `json_output_discipline_check` appears in EVERY Phase 5 dispatch row — this is intentional given its family-level cross-role status; sample 23 (markdown fence wrapping with 134695ms repair latency) confirms the need.

#### technical_spec_agent / data_model_skeleton (5.1) — sample 22

```
Always-on (deterministic): contract_schema_validator,
                           json_output_discipline_check,
                           source_item_enumeration_completeness (id-match mode —
                             component ids → data-model entries; pure set-difference
                             over the 28-item backlog component list),
                           traces_to_id_validity (parameterized: references[] field
                             path — checks FK targets against known entity-id set;
                             see validator_catalog.md §5.4.1 parameterization note),
                           relationship_directionality_validator
Always-on (LLM):           grounding_validator,
                           ungrounded_operational_specifics (parameterization C),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
```

#### technical_spec_agent / api_definitions (5.2) — sample 23

```
Always-on (deterministic): contract_schema_validator,
                           json_output_discipline_check
Always-on (LLM):           grounding_validator,
                           interface_contract_alignment_validator,
                           ungrounded_operational_specifics (parameterization C),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
```

#### technical_spec_agent / error_handling (5.3) — sample 24

Schema naming note: `sub_phase_id` is `error_handling` but artifact root key is `error_handling_strategies`. Dispatch key must map correctly before production wiring. See `deferred_to_track_d.md` §7.3.

```
Always-on (deterministic): contract_schema_validator,
                           json_output_discipline_check
Always-on (LLM):           grounding_validator,
                           error_type_source_attestation_validator,
                           ungrounded_operational_specifics (parameterization C),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
```

#### technical_spec_agent / configuration_parameters (5.4) — sample 25

```
Always-on (deterministic): contract_schema_validator,
                           json_output_discipline_check
Always-on (LLM):           grounding_validator,
                           ungrounded_operational_specifics (parameterization C —
                             primary surface for this validator; QUARANTINE evidence:
                             15 HIGH findings on fabricated endpoint URLs, bucket names,
                             and algorithmic defaults; see per-role assessment 25),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator
Synthesis:                 final_synthesis
```

#### technical_spec_agent / data_model_saturation (5.x) — sample 26

Saturation-class family dispatch. `technical_spec_agent` is the confirmed saturation executor for Phase 5.x — same role as flat sub-phases 5.1–5.4, no domain_interpreter decoupling (contrast with Phase 4.2a). Decomposition rubric: decomposable / atomic_value / invalid_parent; tier A/B/C/D. cal-26 reached depth 1 only (26a REVISE, 26b ACCEPT). See per-role assessment 26 and `validator_catalog.md` §7.8.

```
Always-on (deterministic): contract_schema_validator (data model saturation schema —
                             decomposable / atomic_value / invalid_parent,
                             tier A/B/C/D, agrees_with_hint, decomposition_rationale),
                           json_output_discipline_check,
                           parent_branch_classification_check,
                           decomposition_fanout_discipline,
                           surfaced_assumption_novelty (deterministic side),
                           traces_to_id_validity (parameterized: references[] /
                             entity-id field path — checks against known entity-id set;
                             see validator_catalog.md §5.4.1; LOW at shallow depths),
                           entity_kind_consistency_validator,
                           tier_override_assumption_validator
Always-on (LLM):           grounding_validator (parameterized for data-model context),
                           tier_assignment_audit,
                           surfaced_assumption_novelty (LLM side),
                           reasoning_to_response_faithfulness,
                           reasoning_quality_validator (NARROWED — reasoning-vs-output
                             divergence only; see validator_catalog.md §5.4.3)
Synthesis:                 final_synthesis
Excluded:                  measurement_adequacy_validator (no AC surface at data model
                             saturation), nfr-specific outliers (different role),
                           ungrounded_operational_specifics (not applicable at saturation
                             passes — operational specifics are a flat-sub-phase concern)
```

### 2.2 Saturation passes (deferred to original ChatGPT-5.5 reference)

**Status update (cal-26, samples 13 and 14):** Sub-phases 2.1.4 (fr_saturation) and 2.2.4 (nfr_saturation) have been sampled. Their dispatch rows have been promoted to §2.1 above (entries 2.1.4 and 2.2.4). The original placeholder below is preserved for historical reference and to document the ChatGPT-5.5 baseline bundle that the promoted rows augment.

Sub-phases 2.1.4 (FR saturation) and 2.2.4 (NFR saturation) — original ChatGPT-5.5 baseline templates (now augmented by the §2.1.4 / §2.2.4 dispatch rows):

```
fr_saturation / nfr_saturation (ChatGPT-5.5 baseline — augmented in §2.1 above)
Always-on (deterministic): contract_schema_validator (full saturation schema)
Always-on (LLM):           grounding_validator (full original §2),
                           measurement_adequacy_validator (full original §3),
                           tier_decomposition_validator (original §4),
                           assumption_citation_validator (full original §5),
                           reasoning_quality_validator (original §6)
Synthesis:                 final_synthesis (original §7)
```

### 2.3 Roles not yet sampled (placeholder bundle)

The following `agent_role` values exist in `phaseManifest.ts` but were not sampled in cal-25 because the run did not reach Phase 3+:

- `systems_agent`
- `architecture_agent`
- `technical_spec_agent`
- `implementation_planner`
- `test_design_agent`
- `eval_design_agent`
- `executor` / `executor_agent`
- `consistency_checker`
- `client_liaison`
- `deep_memory_research`

For these roles, the harness dispatches a **placeholder bundle**:

```
Placeholder bundle:
Always-on (deterministic): contract_schema_validator (registry entry required;
                             empty validator until contract is registered)
Always-on (LLM):           reasoning_quality_validator (broad-scope, original §6),
                           grounding_validator (parameter-free)
Conditional (LLM):         reasoning_to_response_faithfulness  (thinking_chain.length > 0)
Synthesis:                 final_synthesis
```

When per-role samples become available (deferred to Phase C.x extension; see `deferred_to_track_d.md` §1), the placeholder bundle is replaced by a role-specific bundle following the same family-taxonomy logic.

---

## 3. Deterministic-vs-LLM split policy

Codified across the 12 assessments (notably samples 04 §3.x, 09 §5, 12 §5):

**DETERMINISTIC** (no LLM tokens):
- Schema-shape validation (top-level keys, enums, ID prefix, ID uniqueness, branch rules)
- Count-balance (AC count, persona count, journey count vs upper/lower bounds)
- Set membership / set equality (full-coverage rule on accepted_journeys; spine coverage)
- ID-uniqueness within an array; cross-array reference-graph correctness
- Substring / Levenshtein matching (exemplar leakage; quoted-span verbatim-ness)
- JSON-validity (especially unescaped internal double quotes — sample 04 §1.4)
- Echo invariance (assert_deep_equal on echoed fields)
- Boolean-gate consistency (`hasConcerns` ↔ `concerns.length > 0`)
- Length floors / ratio floors (output substantiveness)
- Regex-based token presence (measurable-predicate tokens, instrument tokens, cadence tokens)

**LLM-REQUIRED** (semantic):
- Grounding classification (SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / CONTRADICTED)
- Reasoning-trace reading (faithfulness, candidate enumeration, oscillation detection)
- Source comprehension (does this generated claim trace to source content?)
- Measurement adequacy (could the condition pass while the requirement is materially false?)
- Layer/scope reasoning (does this item belong to this pass or a sibling?)
- Coverage matrix construction (which substrate items survived as named/implicit/dropped?)
- Open-question semantic comparison (does this decision answer that question?)
- Compression fidelity (which load-bearing distinctions were preserved?)
- DAG dependency reasoning (does the placement respect substrate-implied edges?)

Rule of thumb: if the validator can be expressed as a pure function over parsed JSON ± regex, it is deterministic; if it requires understanding source semantics or multi-step reasoning over the substrate, it is LLM. Where a validator has both shapes (e.g. `handoff_field_completeness`: presence is deterministic, purpose-met is LLM), implement as a deterministic prefilter + LLM follow-up.

---

## 4. Validator lifecycle (pass-by-pass activation)

The requirements-class lifecycle is the most structured and serves as the design model for any future "skeleton + enrichment + saturation" decomposition. Activation table:

| Validator | Skeleton (Pass 1) | Enrichment (Pass 2) | Saturation (Pass 4) |
|---|---|---|---|
| `contract_schema_validator` | ✓ skeleton schema | ✓ enrichment schema | ✓ saturation schema |
| `story_structural_completeness` (FR) | ✓ | Δ deactivated | Δ |
| `nfr_structural_completeness` (NFR) | ✓ | Δ deactivated | Δ |
| `handoff_coverage_audit` | ✓ spine check | Δ subsumed by echo | ✓ full coverage |
| `enrichment_echo_invariance` | — | ✓ | — |
| `ac_count_discipline` (FR) | — | ✓ | ✓ |
| `output_substantiveness_check` | — | ✓ (NFR enrichment) | ✓ |
| `exemplar_leakage_detector` | — (recommended at Pass 1 too) | ✓ | ✓ |
| `story_shape_conformance` / `nfr_shape_conformance` | ✓ | Δ subsumed | Δ |
| `pass_scope_discipline` | ✓ Pass-1 boundary | ✓ Pass-2 boundary | ✓ Pass-3 boundary |
| `threshold_presence_check` (NFR) | ✓ | ▲ scope grows | ✓ |
| `quality_attribute_taxonomy_alignment` (NFR) | ✓ | ✓ | ✓ |
| `fr_trace_pollution_check` (NFR) | ✓ | ▲ | ✓ |
| `source_attribution_grounding` | ✓ narrowed | ✓ per-AC | ✓ |
| `grounding_validator` | ✓ narrowed | ✓ FULL | ✓ FULL |
| `threshold_grounding_audit` | — | ✓ FULL | ✓ FULL |
| `measurement_adequacy_validator` | ✓ CONSISTENCY-ONLY | ✓ FULL ORIGINAL | ✓ FULL ORIGINAL |
| `measurable_condition_executability` (FR) | — | ✓ | ✓ |
| `measurement_method_executability` (NFR) | — | ✓ | ✓ |
| `skeleton_drift_audit` | — | ✓ | ✓ |
| `tier_decomposition_validator` | Δ inactive | Δ inactive | ✓ engages first time |
| `assumption_citation_validator` | trace-only | trace-only | ✓ FULL form |
| `reasoning_to_response_faithfulness` | ✓ | ✓ | ✓ |
| `open_question_vs_decided` | ✓ conditional | ✓ conditional | ✓ |
| `reasoning_quality_validator` | ✓ | ✓ | ✓ |
| `final_synthesis` | ✓ | ✓ | ✓ |

The key transitions:

- **Skeleton → Enrichment:** Three skeleton validators (`story_structural_completeness`, `nfr_structural_completeness`, `handoff_coverage_audit`, `story_shape_conformance` / `nfr_shape_conformance`) deactivate; `enrichment_echo_invariance` subsumes them via "echo or be flagged". `measurement_adequacy_validator` widens from consistency-only to full original eleven-pattern battery. `threshold_grounding_audit` engages.
- **Enrichment → Saturation:** `tier_decomposition_validator` engages for the first time. `assumption_citation_validator` widens from trace-only to full original form. All other validators carry forward at full strength.

This model is abstractable to any future skeleton + enrichment + saturation decomposition (architecture decisions, eval design, etc.).

---

## 5. Record schema and linking

Per the user's earlier decision: **separate records per validator, all linked by a `harness_id`**. The harness emits one parent `reasoning_review_harness_record` plus one child record per validator instance, persisted via the existing governed_stream invariants.

### 5.1 `reasoning_review_harness_record` (parent)

```ts
type ReasoningReviewHarnessRecord = {
  record_type: "reasoning_review_harness_record";
  harness_id: string;                    // UUID; primary linkage key
  agent_role: string;                    // from phaseManifest.ts
  sub_phase: string;                     // from phaseManifest.ts
  display_code: string;                  // e.g. "1.5", "2.1.2"
  reviewed_record_id: string;            // the agent_output record under review
  derived_from_record_ids: string[];     // [reviewed_record_id, source_context_record_id, ...]
  dispatched_validators: string[];       // canonical validator names (catalog §1–§9)
  skipped_validators: Array<{
    validator: string;
    reason: "contract_schema_failed_short_circuit" |
            "regex_prefilter_no_match" |
            "no_thinking_chain" |
            "role_not_sampled_placeholder_bundle" |
            "deactivated_at_pass" |
            "explicitly_excluded_by_dispatch_rules";
  }>;
  final_synthesis_decision: "ACCEPT" | "ACCEPT_WITH_NOTES" | "REVISE" |
                             "QUARANTINE" | "ESCALATE";
  decision_rationale: string;
  blocking_finding_count: { high: number; medium: number; low: number };
  total_input_tokens: number;            // aggregate across all LLM validators
  total_output_tokens: number;
  wall_clock_ms: number;
  created_at: string;                    // ISO 8601 UTC
};
```

### 5.2 Per-validator record

```ts
type ValidatorRecord = {
  record_type: "reasoning_review_validator_record";
  harness_id: string;                    // foreign key to harness_record
  validator_id: string;                  // canonical validator name
  validator_pass: "skeleton" | "enrichment" | "saturation" | null;  // for parametrized
  validator_parameter: object | null;    // role-specific parameters used
  derived_from_record_ids: string[];     // [harness_id record, plus inputs]
  passed: boolean;
  findings: Finding[];                   // per the validator's output JSON contract
  overall_assessment: string;
  input_tokens: number | null;           // null for deterministic validators
  output_tokens: number | null;          // null for deterministic
  wall_clock_ms: number;
  created_at: string;
};

type Finding = {
  severity: "HIGH" | "MEDIUM" | "LOW";
  type: string;                          // validator-specific enum
  location: string;                      // exact field/path/span
  detail: string;
  recommendation: string;
  // additional validator-specific fields per the catalog's output contracts
  [key: string]: unknown;
};
```

### 5.3 Linkage semantics

- `harness_id` is the **single linkage key** for the harness run. All validator records for one harness invocation share it.
- `derived_from_record_ids` follows the existing governed_stream pattern: explicit lineage, not inference. Each child record points to the harness_record; the harness_record points to the agent_output it reviews plus source-context records.
- The parent harness_record is the **synthesis surface** — downstream consumers (Phase 9 quarantine, audit logs, observability dashboards) read the harness_record's `final_synthesis_decision` and `blocking_finding_count`. They drill into per-validator records only for forensic diagnosis.
- Compatibility with existing governed_stream invariants: schema_version field, ISO 8601 timestamps, immutable append-only writes, no in-place updates.

---

## 6. Final-synthesis decision policy

**Advisory mode** per the user's earlier decision: capture decision recommendation as data; gating policy stays at the workflow level (Phase 9 quarantine continues to apply on HIGH severity).

### 6.1 Decision values

| Value | Trigger conditions |
|---|---|
| `ACCEPT` | No HIGH or MEDIUM findings. LOW findings are cosmetic / non-blocking. |
| `ACCEPT_WITH_NOTES` | LOW findings only, OR minor MEDIUM findings that do not affect correctness. |
| `REVISE` | One or more MEDIUM findings affect correctness, measurability, grounding, or governance, but the output is salvageable. **Floor when any single HIGH finding fires** (HIGH-wins rule, §6.2). |
| `QUARANTINE` | Multiple HIGH findings, OR any HIGH finding that could produce false assurance, invalid requirements, unsupported compliance commitments, or broken downstream automation. |
| `ESCALATE` | Validator unavailability after retries (see §6.6), OR the issue requires human policy / security / compliance judgment. Disagreement between a HIGH-firing validator and a clean validator does NOT trigger ESCALATE — the HIGH wins. |

### 6.2 Severity calibration — global operational-impact scale

**Canonical definition (locked):** Severity is calibrated against operational impact via one universal scale that applies to every validator:

> **HIGH** — could cause workflow halt, false approval downstream, or invalid commitment.
> **MEDIUM** — affects correctness, measurability, grounding, or governance but the output is salvageable without re-running upstream phases.
> **LOW** — cosmetic / advisory; no operational impact.

Each validator's per-class rubric specifies what HIGH means for its defect class **by reference to** this universal definition rather than via independently-tuned per-validator thresholds. Validator implementations cite the universal definition; they do not re-tune it.

**HIGH-wins-automatically rule:** Any single HIGH finding from any validator raises the decision floor to at least REVISE. Multiple HIGHs, OR a HIGH combined with validator unavailability (§6.6), escalate to QUARANTINE / ESCALATE. Disagreement between a HIGH-firing validator and a clean validator (e.g. `reasoning_quality_validator` reporting clean while `grounding_validator` fires HIGH) is resolved in favour of the HIGH; no ESCALATE on disagreement alone.

### 6.2.1 Severity-ladder by validator class

Validator-class instantiations of the universal scale (from the assessments), all of which trace back to the §6.2 canonical definition:

- **Contract violations** ⇒ HIGH; auto-QUARANTINE.
- **Coverage spine breaks** (orphan UJ at FR skeleton; missing V&V or material-COMP at NFR skeleton; missing journey at release plan) ⇒ HIGH; auto-QUARANTINE.
- **Source-tag fabrication** (sample 05's bloom case) ⇒ HIGH per item; aggregate to QUARANTINE if >50% of items mistagged.
- **Wave-dependency back-edges on regulated edges** ⇒ HIGH; QUARANTINE.
- **Measurement-adequacy pattern hits** (existence-as-coverage, "zero direct traffic" without observation surface) ⇒ HIGH; QUARANTINE.
- **Threshold grounding violations** ⇒ HIGH per ungrounded numeric in binding context; aggregate.
- **Reasoning-faithfulness MEDIUM alone** (silent reshuffle, dropped commitment that did not affect coverage) ⇒ ACCEPT_WITH_NOTES + rerun recommendation flagging the specific dropped commitment.

### 6.3 Cross-validator dedup before decision

`final_synthesis` applies the dedup rules from `validator_catalog.md` §10 before computing the decision: paired findings collapse to the higher severity; corroborating findings merge into one.

### 6.4 Output

```ts
type FinalSynthesisOutput = {
  validator: "final_synthesis";
  decision: "ACCEPT" | "ACCEPT_WITH_NOTES" | "REVISE" | "QUARANTINE" | "ESCALATE";
  blockingFindings: Array<{
    severity: "HIGH" | "MEDIUM" | "LOW";
    sourceValidator: string;
    summary: string;
    whyItMatters: string;
    recommendedAction: string;
  }>;
  nonBlockingFindings: Array<{
    severity: "LOW";
    sourceValidator: string;
    summary: string;
  }>;
  rerunRecommendation: {
    shouldRerunOriginalAgent: boolean;
    reason: string;
    promptPatchNeeded: boolean;
    suggestedPromptPatch: string | null;
  };
  contractDesignFindings: Array<{        // for upstream prompt/contract issues
    contractAspect: string;
    issue: string;
    recommendation: string;
  }>;
  overallAssessment: string;
};
```

### 6.5 `contractDesignFindings` — informational only

`contractDesignFindings` (prompt-author / contract feedback collated by `final_synthesis` from other validators' findings) are **informational only**. They do NOT influence the per-output decision. They are emitted alongside the decision as data for prompt designers to address upstream. (Decision locked in `deferred_to_track_d.md` §6.3 and §6.5; collation stays at synthesis-time, no dedicated `contract_design_audit` validator.)

### 6.6 Validator failure handling

Validator failures (LLM call timeouts, parse failures on validator output, transport errors) are handled with the **same retry + `json_repair` pattern used for primary LLM calls**. The harness reuses the orchestrator-level resilience layer rather than implementing a bespoke validator-failure path.

After retries plus repair are exhausted on a given validator:

- That validator's record is persisted with `passed: false` and a single finding of type `validator_unavailable` (severity HIGH for centerpiece validators, MEDIUM for narrow validators).
- `final_synthesis` treats `validator_unavailable` as a signal to ESCALATE (when paired with any other HIGH finding) or REVISE (when no other HIGH fires) — the harness does not silently drop the validator.

### 6.7 Auto-recovery on deterministic findings — strictly advisory

The harness stays **strictly advisory** for cosmetic / deterministic mutations (e.g. underscore↔hyphen ID drift). Auto-recovery belongs at the **orchestrator/workflow level** — the same locus as JSON repair. The harness reports the mutation as a finding; the orchestrator decides whether to apply a normalisation pass before consuming downstream. No auto-recovery code in the harness itself. (Decision locked in `deferred_to_track_d.md` §6.6.)

### 6.8 Gating policy stays at the workflow level

The harness records its decision as data. The orchestrator's Phase 9 quarantine logic continues to consume `harness_record.final_synthesis_decision` and apply existing rules:

- `QUARANTINE` on a leaf task → quarantine (current behaviour preserved).
- `REVISE` → log + advisory; no automatic gate.
- `ESCALATE` → log + advisory + flag for human review.
- `ACCEPT` / `ACCEPT_WITH_NOTES` → no action.

This preserves the user's existing semantics while making the harness purely advisory.

---

## 7. Token-tracking integration

Per the user's earlier decision: capture `input_tokens` / `output_tokens` per validator call. Provider-portable: the `LLMCallResult.input_tokens / output_tokens` pair is the canonical contract.

### 7.1 Provider adapters

| Provider | Source field for input_tokens | Source field for output_tokens |
|---|---|---|
| Ollama | `prompt_eval_count` | `eval_count` |
| OpenAI / Azure | `usage.prompt_tokens` | `usage.completion_tokens` |
| Anthropic | `usage.input_tokens` | `usage.output_tokens` |
| LiteLLM | `usage.prompt_tokens` (passes through) | `usage.completion_tokens` |
| Cerebras | (provider-specific; verify) | (provider-specific; verify) |
| Local-only deterministic | `null` | `null` |

The provider adapter is responsible for normalising to the canonical `LLMCallResult` shape:

```ts
type LLMCallResult = {
  text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  // ... existing fields
};
```

### 7.2 Persistence and aggregation

- Each per-validator record stores its own `input_tokens` / `output_tokens` (null for deterministic validators).
- The parent `harness_record` aggregates `total_input_tokens` and `total_output_tokens` across all child records.
- Wall-clock time per validator is also captured (`wall_clock_ms`) for cost-vs-latency observability.

### 7.3 Observability use-cases

The token-tracking instrumentation enables three classes of dashboarding:

1. **Per-`(agent_role, sub_phase)` cost profile.** Median tokens per harness run, by family. Surfaces which passes are expensive to validate.
2. **Per-validator marginal cost.** Helps identify validators that are LLM-heavy but rarely fire (candidates for deterministic prefilter improvements).
3. **Reasoning-chain pathology audit.** Sample 12 §6.6 noted the 40× thinking-to-response ratio at qwen3.5:9b enrichment passes. The harness already captures the reviewed agent's wall-clock and (if available) token count via the existing agent_output record; the harness_record is the natural place to surface a `thinking_to_response_ratio` metric for corpus-level alerts.

---

## 8. Implementation order (handoff to Track D)

Recommended commit sequence:

1. **Catalog the validators in TypeScript** as a single source-of-truth module (`src/lib/orchestrator/reasoningReview/validatorCatalog.ts`). Include the canonical name, family, type (deterministic / LLM), parametrization registry, and dispatch rules. Mirror `validator_catalog.md` §1–§9 in code.

2. **Implement deterministic validators first** (no LLM dependency, lowest risk, fastest feedback):
   - `contract_schema_validator` (the role-keyed schema registry — bootstraps everything else)
   - `enrichment_echo_invariance`
   - `ac_count_discipline`
   - `output_substantiveness_check`
   - `exemplar_leakage_detector`
   - `persona_id_continuity`
   - `journey_id_continuity`
   - `extraction_id_traceability`
   - `fr_trace_pollution_check`
   - `status_consistency_iqc`
   - `calibration_rule_consistency_lens`
   - `handoff_coverage_audit` (deterministic core; LLM follow-up later)

   These can ship as a unit and immediately produce findings on cal-25 outputs without any LLM cost.

3. **Implement universal cross-role LLM validators**:
   - `grounding_validator` (the cross-role pattern — most reused)
   - `reasoning_to_response_faithfulness` (cross-role, cleanest abstraction)
   - `open_question_vs_decided`
   - `reasoning_quality_validator` (narrowed, runs after the narrow validators)
   - `assumption_citation_validator` (with per-pass collapse)

4. **Implement family-class validators**:
   - Discovery family: `scope_boundary_adherence_*`, `external_reference_handling`, plus compliance-specific (`regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness`)
   - Bloom family: `source_attribution_grounding` (per-attribution variant), `bloom_completeness_vs_thinking`, `entity_workflow_shape`, `pillar_domain_alignment`, `domain_persona_coherence`, journey-bloom-specific set
   - Synthesis family: `synthesis_coverage_audit`, `synthesis_fabrication_check`, `handoff_field_completeness`, `compression_fidelity_audit`, `wave_dependency_topology`, `compliance_sequencing_audit`, `mvp_credibility_check`, `release_balance_audit`
   - Requirements family: `story_structural_completeness`, `story_shape_conformance`, `nfr_structural_completeness`, `nfr_shape_conformance`, `pass_scope_discipline`, `threshold_presence_check`, `quality_attribute_taxonomy_alignment`, `threshold_grounding_audit`, `measurement_adequacy_validator` (centerpiece — use original ChatGPT-5.5 §3 verbatim), `measurable_condition_executability`, `measurement_method_executability`, `skeleton_drift_audit`

5. **Implement role-specific validators**:
   - `completeness_evidence_adequacy`, `coherence_evidence_audit` (IQC)
   - `confidence_calibration_lens`, `intent_vs_artifact_scope_audit` (lens)

6. **Implement `final_synthesis`** with the decision policy from §6.

7. **Wire harness dispatch** in `LLMCaller` (or wherever the current single-reviewer hook fires). Replace the current `prompts/cross_cutting/reasoning_review.system.md` invocation with the harness pipeline. Preserve the advisory-mode contract: emit harness_record + per-validator records; do not gate.

8. **Add token-tracking instrumentation** via the provider-adapter layer (§7).

9. **Tests: regression corpus** per `deferred_to_track_d.md` §3 (sample_id × validator_id → expected_findings table). Each per-role assessment names the findings each validator should fire on its sample; aggregate these into a regression-test corpus and run on every reviewer-model change.

10. **Saturation passes**: when cal runs reach Phase 2.1.4 / 2.2.4, capture saturation samples and verify the original ChatGPT-5.5 templates fire the expected findings. The saturation-pass templates (`tier_decomposition_validator`, full-form `assumption_citation_validator`) are inherited unchanged and should not require redesign — only verification.

---

## 9. Implications for upstream prompt design

Several samples surfaced perverse-incentive patterns or rule-design defects in the agent prompts themselves. The harness can flag these via `final_synthesis.contractDesignFindings`, but the root fix is upstream prompt redesign. Catalogued here for the prompt-author follow-up; full details in `deferred_to_track_d.md` §4.

| Sample / role | Prompt-design issue | Recommended patch |
|---|---|---|
| 02 / orchestrator lens | The 0.8 disclosure threshold creates an incentive for the agent to inflate confidence above 0.8 to dodge the competitor-disclosure obligation. | Require competitor disclosure at all confidence bands, or rephrase to "if you considered any competing lens, name it regardless of confidence". |
| 02 / orchestrator lens | Meta-recursive intents ("execute the attached spec") have no rule for inheritance from artefact. | Add explicit meta-recursion clause to the lens prompt. |
| 04 / domain_interpreter compliance | Strict referential-integrity rule ("if not in accepted list, don't cite") under-cited compliance regimes when the substrate listed them as plain-text bullets. Same instruction pattern triggered the surface-attribution evacuation in sample 06. | Clarify: plain-text upstream items may be cited verbatim as strings, and an empty `surfaces`/`compliance_regimes` array on a journey/item that obviously enacts the upstream is a coverage failure, not a referential-integrity success. |
| 04 / domain_interpreter compliance | No `OPEN_QUESTION` discipline — the prompt's permissive stance produced zero open questions on a manifestly under-specified compliance source. | Require the agent to scan a hook list (HOA, W-9/1099, PCI, ESIGN/UETA, etc.) and emit an `OPEN_QUESTION` for each hook the source mentions but does not specify. |
| 05 / domain_interpreter business_domains_bloom | Persona-source field uses `document-specified` but the agent emits `user-specified` (different from domain-source field). Contract-shape mismatch the gemma reviewer didn't catch. | Rename or clarify the source field to be consistent across personas and domains. |
| 05 / domain_interpreter business_domains_bloom | No first-class representation of pillars / organising concepts in the bloom contract. | Add an optional `pillars[]` or `parentPillar` field on domains. |
| 06 / domain_interpreter user_journey_bloom | `automatable` rule's two clauses are not equally weighted in the agent's behaviour — clause 2 (persona-trigger-with-system-weight) is consistently violated. | Restructure the rule with explicit positive examples for clause 2 (provider-acknowledgement triggering scheduling cascade, document-upload triggering AV scan, etc.). |
| 07 / domain_interpreter product_description_synthesis | `openLoops` enum lacks a `scope` value; scope-class questions are forced into `deferred_decision`. | Add `scope` to the enum. |
| 07 / domain_interpreter product_description_synthesis | No `compressionNotes` / `omittedFromNarrative` field — the agent has nowhere honest to record dropped substrate items. | Add an optional `compressionNotes` field. |
| 08 / orchestrator release_plan | Phasing-strategy "treat as hint" framing licenses silent overrides. | Require the agent to either honour the hint or explicitly record the override in the release rationale. |
| 09 / requirements_agent fr_bloom_skeleton | The prompt's exemplar block (US-001 with "POST /properties returns 201 ... within 1 second") is a perverse-incentive pattern: the agent copied the exemplar's measurable_condition into its US-001. | Consider obfuscating exemplar values, or explicitly warning: "exemplar values are illustrative; do not reuse them as authored content for your specific journey." |
| 11 / requirements_agent nfr_bloom_skeleton | Small-model bias toward `performance/security` at the expense of `auditability/observability/maintainability`. The prompt itself flags this as a known bug; the validator can detect it but the root fix is prompt design. | Add positive examples for under-represented categories; possibly require minimum count in named categories when source items demand it. |
| 12 / requirements_agent nfr_bloom_enrichment | Exemplar block contains "1-minute cadence" used illustratively for availability; the agent imported it as the cadence for security-NFR observation. | Same exemplar-leakage patch as sample 09 — make exemplar values clearly illustrative or rotate them. |

These are feedback to the prompt authors, not validators. The harness `contractDesignFindings` channel surfaces them as data; closing them is upstream work.
