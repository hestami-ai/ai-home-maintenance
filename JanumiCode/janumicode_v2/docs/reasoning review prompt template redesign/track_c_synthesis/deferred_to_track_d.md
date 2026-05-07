# Phase C → Track D Handoff — Deferred Items

(Aggregates everything that the 12 per-role assessments + sample 12's closing report flagged as "deferred to Phase C.3 synthesis." Organised by category. Each item points back to the source assessment that surfaced it.)

---

## 1. Roles not yet sampled (need Phase C.x extension)

The following `agent_role` values exist in `phaseManifest.ts` but were not sampled in cal-25 because the run did not reach Phase 3+. A follow-up assessment campaign is needed when those samples become available.

| agent_role | Phases / sub-phases | Why deferred |
|---|---|---|
| `systems_agent` | Phase 3 system specification (3.1 system_boundary, 3.2 system_requirements, 3.3 interface_contracts) | **Resolved — cal-26 samples 15/16/17.** Actual family mapping: **discovery-class** (extraction/enumeration shape with completeness-gap defects). Prior hypothesis "bloom-class + synthesis-class" is **not supported** — no novelty/coverage defects observed across any of the three sub-phases; all three exhibit silent omission of bounded source items (FR responsibilities in 3.1, FR/NFR IDs in 3.2, system IDs in 3.3). The anticipated bloom-class shape (novel proposals, trans-sibling coverage) does not match. Dispatch bundles added to `harness_design.md` §2.1 (entries 3.1, 3.2, 3.3); `source_item_enumeration_completeness` (family-level) and `implementation_commitment_grounding` (Phase 3.3 role-specific outlier) added to `validator_catalog.md` §2 and §6. See per-role assessments 15, 16, 17. |
| `architecture_agent` | Phase 4 (4.1 software_domains, 4.2 component_skeleton, 4.3 adr_capture) | **Resolved as of cal-26 samples 18/19/20.** Actual mapping is per-sub-phase heterogeneous: **4.1 discovery-class** (vocabulary-term enumeration against SR behavioral inventory — over-specification direction of the defect, not omission); **4.2 bloom-class confirmed** (coverage bloom over bounded SR + domain set; CM-001 atomicity invariant; clean sample); **4.3 hybrid** (discovery-class grounding for ADR threshold claims + synthesis-class ADR rationale structure + thin decision-class layer via `adr_status_discipline_validator`). Prior hypothesis "bloom-class for component blooms; synthesis-class for ADR rationales; possibly a new decision-class family" is **partially confirmed**: bloom-class holds at 4.2; synthesis-class is present but subsumed under discovery-class grounding at 4.3; decision-class is a partial confirmation (one thin validator, not a full family yet). `adr_status_discipline_validator` is the seed of the anticipated decision-class family — promotion deferred until more decision-shape evidence accumulates. Note: `adr_capture` (Phase 4.3) was **NOT** in the original Phase 4 sub-phase list at deferred_to_track_d authoring time — it is an emergent addition; see §7.1. See per-role assessments `per_role_assessments/18_architecture_agent__software_domains.md`, `19_architecture_agent__component_skeleton.md`, `20_architecture_agent__adr_capture.md`. Dispatch bundles added to `harness_design.md` §2.1 (entries 4.1, 4.2, 4.3); `mandated_threshold_inheritance`, `responsibility_atomicity_validator`, `sr_allocation_completeness_validator`, `adr_status_discipline_validator` added to `validator_catalog.md` §2, §3, §6. |
| `technical_spec_agent` | Phase 5 (5.1 data_model_skeleton, 5.2 api_definitions, 5.3 error_handling, 5.4 configuration_parameters, 5.x data_model_saturation) | **Resolved as of cal-26 samples 22–26b.** Actual mapping is per-sub-phase: **discovery-class** for all flat sub-phases (5.1–5.4) — each is an extraction pass with a bounded 28-component input set; the dominant failure mode across all four is grounding fabrication (ungrounded operational specifics), not novelty or synthesis. **Saturation-class** for Phase 5.x data_model_saturation — isomorphic to Phase 4.2a component_saturation; same §5.4 family applies with data-entity-surface parameterization. Prior hypothesis "requirements-class + synthesis-class" is **not supported** — no requirements-class or synthesis-class defects observed; Phase 5 outputs are technical-spec extractions from bounded inputs, not requirements proper. NOTE: `technical_spec_agent` is its own saturation-pass executor at Phase 5.x (no role decoupling, unlike Phase 4.2a which uses `domain_interpreter`). Dispatch bundles added to `harness_design.md` §2.1 (entries 5.1, 5.2, 5.3, 5.4, 5.x); `ungrounded_operational_specifics (parameterization C)`, `relationship_directionality_validator`, `interface_contract_alignment_validator`, `error_type_source_attestation_validator`, `entity_kind_consistency_validator`, `tier_override_assumption_validator` added to `validator_catalog.md`; `json_output_discipline_check` promoted to family-level. See per-role assessments 22, 23, 24, 25, 26. |
| `implementation_planner` | Phase 4 implementation planning | not reached |
| `test_design_agent` | Phase 5 test design | not reached |
| `eval_design_agent` | Phase 6 evaluation design | not reached |
| `executor` / `executor_agent` | Phase 7 execution | not reached |
| `consistency_checker` | Phase 0.5 / Phase 8 consistency review | not exercised in cal-25 |
| `client_liaison` | Phase 0 client engagement | not exercised |
| `deep_memory_research` | Phase 0 memory ingestion / synthesis | not exercised |

**Placeholder bundle** (per `harness_design.md` §2.3): for any unsampled role, the harness dispatches `contract_schema_validator` (with a registry entry created at sample capture time) plus `reasoning_quality_validator` (broad-scope, original §6 template) plus `grounding_validator` plus `reasoning_to_response_faithfulness` (when thinking chain present). This is an interim placeholder; replace with a role-specific bundle following the same family-taxonomy logic when samples are captured.

**Anticipated family-mappings** for the unsampled roles (working hypotheses, to be validated):
- `systems_agent` → **resolved as discovery-class** (cal-26 samples 15/16/17; see §1 table above and per-role assessments 15, 16, 17). Prior hypothesis of "bloom-class (mostly) + synthesis-class for handoff outputs" is **revised**: all three Phase 3 sub-phases are extraction/enumeration passes against a bounded input set, not bloom or synthesis passes. The dominant defect class is completeness-gap (silent omission), not novelty-gap (insufficient brainstorming) or compression-gap (handoff coverage loss). No bloom-class or synthesis-class validators are warranted at Phase 3 sub-phases.
- `architecture_agent` → **resolved as of cal-26 samples 18/19/20** (see §1 table); per-sub-phase heterogeneous mapping: 4.1 discovery-class, 4.2 bloom-class confirmed, 4.3 hybrid discovery+thin-decision. Prior hypothesis partially confirmed.
- `technical_spec_agent` → **resolved as of cal-26 samples 22–26b** (see §1 table): **discovery-class** for flat sub-phases 5.1–5.4 (extraction from bounded 28-component input); **saturation-class** for Phase 5.x data_model_saturation (§5.4 family, entity surface). Prior hypothesis "requirements-class + synthesis-class" is **not supported**. `technical_spec_agent` is a dual-surface role with no Phase-5 requirements-class or synthesis-class sub-phases observed.
- `implementation_planner` → synthesis-class (release plan analogue — `wave_dependency_topology`, `mvp_credibility_check`, `compliance_sequencing_audit` likely apply)
- `test_design_agent` → bloom-class (test bloom) + requirements-class (test acceptance criteria) — may need a new test-design-specific validator family
- `eval_design_agent` → similar to test_design but for evaluation criteria
- `executor` → output validation against task contract + reasoning_quality; may need a new "execution-class" family for verifying outputs match planned actions
- `consistency_checker` → meta — reviews other agent outputs; harness is recursively applicable but the validators themselves may need to differ
- `client_liaison` → synthesis-class (likely)
- `deep_memory_research` → discovery-class (extraction) + synthesis-class (memory packets)

---

## 2. Cross-role validator family promotion

The following validators were originally introduced as role-specific in single-sample assessments and have since been re-confirmed across multiple samples. Promote them to a shared `prompts/cross_cutting/validators/` directory in code (Wave-8 implementation) with single-source-of-truth definitions and runtime parametrization.

### 2.1 Confirmed cross-role (≥ 2 sample appearances)

| Validator | Confirmed across samples | Notes |
|---|---|---|
| `contract_schema_validator` | 01–12 (all) | Universal; role-keyed schema registry. |
| `grounding_validator` | 01, 02, 03, 04, 07, 09, 10, 11, 12 | Universal; role-keyed claim list. |
| `reasoning_to_response_faithfulness` | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12 | Universal; role-keyed marker list. |
| `open_question_vs_decided` | 03, 04, 05, 07, 08 (+ conditional in 09–12) | Universal; threshold-shape regex parameter. |
| `reasoning_quality_validator` | 01–12 (all) | Universal; original §6, narrowed jurisdiction. |
| `assumption_citation_validator` | 01–12 (with per-pass collapse) | Universal; collapse rule per pass. |
| `final_synthesis` | 01–12 (all) | Universal; original §7. |
| `source_attribution_grounding` | 05, 06, 09, 10, 11, 12 | Bloom + requirements; near-sibling of grounding (different unit). |
| `persona_id_continuity` | 05, 06 (+ implicit in 09's persona-name drift) | Bloom + downstream. |
| `bloom_completeness_vs_thinking` | 05, 06 | Bloom-family core. |
| `synthesis_coverage_audit` | 07, 08 | Synthesis-family core. |
| `synthesis_fabrication_check` | 07, 08 | Synthesis-family core. |
| `handoff_field_completeness` | 07, 08 | Synthesis-family core. |
| `compression_fidelity_audit` | 07, 08 | Synthesis-family core. |
| `phasing_dependency_consistency` | 07 (vacuous), 08 (load-bearing) | Split into `wave_dependency_topology` + `compliance_sequencing_audit` at sample 08. |
| `pass_scope_discipline` | 09, 10, 11, 12 | Requirements-family core; pass-parametrized. |
| `measurement_adequacy_validator` | 09 (consistency-only), 10, 11 (consistency-only), 12 | Requirements + saturation; ORIGINAL ChatGPT-5.5 §3 verbatim at full scope. |
| `threshold_grounding_audit` | 10, 12 | Requirements enrichment + saturation. |
| `enrichment_echo_invariance` | 10, 12 | Requirements enrichment. |
| `exemplar_leakage_detector` | 10, 12 | Requirements enrichment + recommended at any pass with exemplar block. |
| `skeleton_drift_audit` | 10, 12 | Requirements enrichment + saturation. |
| `output_substantiveness_check` | 12 (introduced) | **NEW cross-role candidate** — applies to any pass authoring a small fixed-arity string set. |
| `scope_boundary_adherence_*` family | 03, 04 | Discovery-class core; parameterised across 1.0b/c/d/e. |
| `external_reference_handling` | 03, 04 | Discovery-class. |

**Cal-26 discovery-class extension (samples 15, 16, 17):** The discovery-class family extends beyond Phase 1.0b–1.0e (previously thought to be its bound) into Phase 3 sub-phases. Cal-26 confirms the family is the right home for any sub-phase whose dominant shape is "extract/enumerate from a bounded input set" — regardless of phase number. `source_item_enumeration_completeness` (added to `validator_catalog.md` §2) is a family-level discovery-class validator applicable at Phase 3.1 (semantic mode — input is prose FR responsibilities), Phase 3.2 (id-match mode — FR IDs → system requirement IDs), and Phase 3.3 (id-match mode — system IDs → contract `systems_involved[]` arrays). It will also apply to any future sub-phase with the same enumeration structure. The family bound is now characterized as "any extraction/enumeration pass with a finite bounded input set," not "Phase 1.0b–1.0e only."

### 2.2 Cross-role candidates needing further sampling

| Validator | Single-sample origin | Generalization hypothesis | Defer to |
|---|---|---|---|
| `acceptance_criteria_measurability` | 06 (journey bloom) | Generalises to any AC-emitting pass (Phase 2 requirements, Phase 4 component-AC). | Until Phase 2/4 samples available. |
| `release_balance_audit` (renamed from `pillar_balance_audit`) | 08 (release plan) | Operates over the approved Release Plan; Release is the canonical janumicode organising-unit (`docs/janumicode_spec_v2.3.md` §2). | Decision locked — see §6.1. |
| `wave_dependency_topology` | 08 | Generalises to any sequenced commitment with implicit DAG. | Phase 4 implementation planning samples. |
| `mvp_credibility_check` | 08 | Generalises to any "minimum viable" wave-N sub-plan. | Same. |

### 2.3 Validators that stay role-specific

| Validator | Origin | Reason for non-generalization |
|---|---|---|
| `completeness_evidence_adequacy`, `coherence_evidence_audit`, `status_consistency_iqc` | 01 (IQC) | IQC's contract structure is unique; no analogue elsewhere. |
| `calibration_rule_consistency_lens`, `confidence_calibration_lens`, `intent_vs_artifact_scope_audit` | 02 (lens) | Lens classifier is the only pass with a confidence calibration table. |
| `regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness` | 04 (compliance) | Compliance domain knowledge required; the *technique* of `retention_threshold_grounding` may generalise to V&V threshold grounding (1.0e) but the validator stays compliance-specific. |
| `entity_workflow_shape` | 05 (domains bloom) | Specific to entityPreview/workflowPreview contract. |
| `domain_persona_coherence` | 05 | Specific to domain ↔ persona graph. |
| `journey_id_continuity`, `surface_attribution_completeness`, `workflow_journey_separation`, `step_completeness_and_automatable`, `persona_journey_coupling`, `domain_journey_coupling`, `phase_journey_alignment` | 06 (journey bloom) | Journey-bloom-specific contract structure. |
| `quality_attribute_taxonomy_alignment`, `threshold_presence_check`, `nfr_shape_conformance`, `nfr_structural_completeness`, `fr_trace_pollution_check` | 11 (NFR skeleton) | NFR-specific. |
| `story_shape_conformance`, `story_structural_completeness` | 09 (FR skeleton) | FR-specific. |
| `tier_decomposition_validator` | original ChatGPT-5.5 reference | Saturation-pass-only by design. |
| `responsibility_atomicity_validator`, `sr_allocation_completeness_validator` | 19 (architecture_agent / component_skeleton, Phase 4.2) | Component-model contract structure — specific to the `component_responsibility` array with `traces_to[]` SR allocation fields; no direct analogue at Phase 1 bloom passes. Cross-role candidate if other phases emit component-responsibility-shaped outputs. |
| `adr_status_discipline_validator` | 20 (architecture_agent / adr_capture, Phase 4.3) | ADR status lifecycle is specific to decision-record outputs. Potential cross-role candidate if other phases emit ADR-shaped decision records. Decision-class seed — see §2.4 note. |
| `mandated_threshold_inheritance` | 20 (architecture_agent / adr_capture, Phase 4.3) | Bidirectional threshold coverage check tuned to ADR decision/rationale fields. The technique may generalise to any output surface that emits technical commitments (e.g. interface_contracts at Phase 3.3 — partially analogous to `implementation_commitment_grounding`). Cross-role promotion deferred until a second surface is sampled. |

### 2.5 Stage 1D.3 family-level promotions and consolidation

**`json_output_discipline_check` promoted to cross-role universal (§1):** Cal-26 evidence — markdown-fence JSON wrapping at sample 23 (technical_spec_agent / api_definitions, 134695ms repair latency) and Phase 6 task_skeleton (Tracks A+B) — confirms cross-phase recurrence across two distinct roles. This is a pre-validator deterministic check (near-zero cost) that should run BEFORE the LLM validator chain: when the response is structurally broken (fenced JSON), all downstream LLM validators are defeated. Placing it before the chain pre-empts the entire chain cost on structural failures. HIGH severity on markdown-fenced JSON; MEDIUM on trailing prose. Track D should ensure `json_output_discipline_check` is dispatched as the first deterministic check at every (agent_role, sub_phase) — before `contract_schema_validator` and before any LLM validator.

**`ungrounded_operational_specifics` consolidation (Stage 1D.3):** Three validators that shared the same root mechanism are now consolidated into one family-level `ungrounded_operational_specifics` entry in `validator_catalog.md` §2:
- Absorbed: `implementation_commitment_grounding` (Stage 1B.3 §6 role-specific at Phase 3.3) → now parameterization A
- Absorbed: `mandated_threshold_inheritance` (Stage 1C.3 §2 discovery-class at Phase 4.3) → now parameterization B
- New: Phase 5.x operational specifics (endpoint URLs, bucket names, defaults) → parameterization C

**Rationale for consolidation:** All three instantiate the same root mechanism — the agent emits a concrete operational/technical value in a schema field whose structural position implies implementation commitment, when the source context is silent or provides only category-level guidance. One catalog entry prevents three separate Track D implementations of the same reasoning logic. Track D may implement the three parameterizations as one combined LLM prompt or as three sub-variants; split/combine based on prompt performance in practice. Cross-references in `harness_design.md` §2.1 dispatch rows 3.3 and 4.3 have been updated to reference `ungrounded_operational_specifics` with the appropriate parameterization noted.

### 2.4 Role-decoupling observation (cal-26 Phase 4)

Cal-26 Phase 4 confirms that **role↔family mapping is a per-(role, sub_phase) determination, not a per-role determination.** The same role may dispatch to different validator families at different sub-phases:

- **`architecture_agent`** maps to discovery-class at sub-phase 4.1 (software_domains), bloom-class at sub-phase 4.2 (component_skeleton), and a hybrid discovery+decision bundle at sub-phase 4.3 (adr_capture). There is no single family for `architecture_agent`; the per-sub-phase mapping is the correct abstraction unit.

- **`domain_interpreter`** is a multi-surface role: discovery-class + bloom-class at Phases 1.0b–1.0e and 1.5–1.10 (confirmed, cal-25); saturation-pass executor at Phase 4.2a (component_saturation, confirmed cal-26 samples 21a/21b). The same §5.4 saturation-class family applies at Phase 4.2a with component-surface parameterization (decomposition rubric: atomic_component / decomposable / invalid_parent; tier model: A/B/C/D). Cross-link: `validator_catalog.md` §5.4.1 parameterization note for `traces_to_id_validity` and §7.7 component_saturation matrix.

This pattern likely generalises: any role that appears across multiple distinct pipeline stages should be modeled as `(agent_role, sub_phase)` dispatch bundles, not as monolithic per-role bundles. The dispatch registry key is `(agent_role, sub_phase)`, not `agent_role` alone — already reflected in `harness_design.md` §2.1 structure.

**Track D implementation implication:** Ensure the dispatch registry key is the pair `(agent_role, sub_phase)` and that the family-taxonomy lookup is per-pair. A per-role lookup will break for `architecture_agent` (4.1 ≠ 4.2 ≠ 4.3) and `domain_interpreter` (Phase 1 ≠ Phase 4.2a).

---

## 3. Regression corpus design

A `sample_id × validator_id → expected_findings` table — for each of the 12 captured samples, list which validators should fire and what findings they should produce. This becomes the regression test for the harness during Track D implementation.

### 3.1 Schema

```ts
type RegressionEntry = {
  sample_id: string;          // "01", "02", ..., "12"
  agent_role: string;         // matches phaseManifest
  sub_phase: string;          // matches phaseManifest
  validator_id: string;       // canonical validator name
  expected_outcome: "passes" | "fires";
  expected_findings?: Array<{
    severity: "HIGH" | "MEDIUM" | "LOW";
    type: string;             // validator-specific finding type
    location_hint: string;    // narrowing hint, not exact match
    rationale: string;        // why this finding is expected
  }>;
  source_assessment_section: string;  // e.g. "samples/01 §1a.1"
};
```

### 3.2 Per-sample expected-finding summaries

(Full enumeration is the per-role assessments' §1a sections. This summary lists count and severity; populate the regression corpus from the assessments directly during Track D implementation.)

| Sample | Validators expected to fire | HIGH count | MEDIUM count | LOW count | Source |
|---|---|---|---|---|---|
| 01 | reasoning_to_response_faithfulness, coherence_evidence_audit, completeness_evidence_adequacy, grounding_validator | 2 | 4 | 3 | sample 01 §1a, §1c |
| 02 | confidence_calibration_lens, intent_vs_artifact_scope_audit, calibration_rule_consistency_lens, rationale_grounding_lens | 2 | 4 | 2 | sample 02 §1a, §1c |
| 03 | grounding_validator (multiple), scope_boundary_adherence_discovery (multiple), external_reference_handling, open_question_vs_decided, persona_journey_coherence, reasoning_to_response_faithfulness | 5+ | 6+ | 3+ | sample 03 §1a, §1c |
| 04 | compliance_signal_completeness (HIGH on W-9/1099, payment), scope_boundary_adherence_compliance (HIGH on durability inflation), contract_schema_compliance (HIGH on JSON parse), reasoning_to_response_faithfulness | 4 | 5+ | 2 | sample 04 §1c |
| 05 | source_attribution_grounding (≥10 fabricated user-specified findings), persona_id_continuity, pillar_domain_alignment, domain_persona_coherence, entity_workflow_shape, bloom_completeness_vs_thinking, reasoning_to_response_faithfulness | 1 | 6+ | 4+ | sample 05 §1c |
| 06 | surface_attribution_completeness (≥4 HIGH on compliance regimes), journey_id_continuity, workflow_journey_separation (3 cases), step_completeness_and_automatable, acceptance_criteria_measurability (~20 cases), source_attribution_grounding, reasoning_to_response_faithfulness | 4+ | 8+ | 4+ | sample 06 §1c |
| 07 | synthesis_coverage_audit (5 missing personas), compression_fidelity_audit (DOM-LEDGER collapsed), synthesis_fabrication_check ("digital nervous system", brokerage→integration reframing), open_question_resolution_discipline (priority assigned without basis) | 0 | 5 | 4 | sample 07 §1c |
| 08 | wave_dependency_topology (3 HIGH back-edges), compliance_sequencing_audit, mvp_credibility_check, release_balance_audit, compression_fidelity_audit (5 [Phase 1] demotions), synthesis_fabrication_check, reasoning_to_response_faithfulness | 4 | 6 | 1 | sample 08 §1c |
| 09 | grounding_validator (HIGH on US-022 50ms, US-027 Top 3), measurement_adequacy_validator (HIGH on US-001 description-condition contradiction), exemplar_leakage_detector (HIGH on US-001), reasoning_to_response_faithfulness (US-028/029/030 dropped), story_shape_conformance (persona drift) | 3+ | 3+ | 2+ | sample 09 §1c |
| 10 | measurement_adequacy_validator (HIGH on AC-014 existence-as-coverage), threshold_grounding_audit (HIGH on AC-016 409, COMPLIANCE_FAILURE, Pending), grounding_validator (HIGH on AC-016 fabrications), measurable_condition_executability (MEDIUM on AC-017), skeleton_drift_audit (MEDIUM on AC-018) | 3 | 4 | 2 | sample 10 §1a |
| 11 | fr_trace_pollution_check (HIGH × 5), grounding_validator (HIGH on US-028 phantom), threshold_presence_check (MEDIUM × 5 aspirational), quality_attribute_taxonomy_alignment (MEDIUM × 4 miscategorisations) | 6 | 9+ | 2 | sample 11 §1c |
| 12 | measurement_adequacy_validator (HIGH on "zero direct traffic" pattern #10), threshold_grounding_audit (HIGH on "1-minute cadence"), grounding_validator (MEDIUM on "WAF"), measurement_method_executability (MEDIUM on missing scan scope), exemplar_leakage_detector (MEDIUM on cadence reuse), skeleton_drift_audit (LOW), reasoning_quality_validator (LOW on 40× ratio) | 2 | 3 | 2 | sample 12 §1a |

The detailed finding-by-finding expectations are in each sample's §1a (defects in agent's response) and §1c (what the reviewer missed) sections. Track D should mechanically import these into the regression corpus and run them on every reviewer-model change.

### 3.3 Negative findings (positive baselines)

Several samples have **clean negative findings** — validators that should report `passed: true`. These matter as regression-prevention baselines:

| Sample | Clean negative findings | Purpose |
|---|---|---|
| 04 | retention_threshold_grounding clean (no invented retention periods); regime_citation_validity clean (no invented regimes) | Sample 04 is a regression fixture for "agent restraint on regime hallucination". |
| 05 | (none cleanly clean — too many defects) | — |
| 09 | exemplar_leakage_detector clean (no exemplar fragment reuse) | Baseline for "exemplar leakage closed" |
| 10 | exemplar_leakage_detector clean (sample 09's defect did not propagate); reasoning_to_response_faithfulness clean (chain's last revision matches output) | Baseline for "fix held across pass boundary" |
| 12 | output_substantiveness_check clean (single-NFR contract correctly satisfied at 497 bytes); contract_schema_enrichment_nfr clean; enrichment_echo_invariance clean; threshold-side exemplar leakage clean | Baseline for "minimal-contract response is structurally valid" |

Treat clean negatives as **passing observations**: the harness should record them, not just emit silence. Sample 12 §6.7 recommends a `passing_observations[]` field on the validator record schema for this purpose.

---

## 4. Prompt-design follow-ups (root-cause fixes upstream)

Reverse-engineered from the harness's findings: agent prompts whose design induces defects the harness will catch. The harness `contractDesignFindings` channel surfaces these as data; closing them is upstream work.

(Cross-reference `harness_design.md` §9 for the same list with summary patches; below adds the source-assessment anchor for each item.)

| Sample | Agent role / sub_phase | Issue | Source | Recommended patch |
|---|---|---|---|---|
| 01 | orchestrator / intent_quality_check | `severity` field on `completeness_findings[]` has no defined semantics when `status: "present"`. | sample 01 §1.3, §6.1 | Either remove severity from `present` entries or define it as evidence weight (HIGH = thickly supported, LOW = minimally supported). |
| 02 | orchestrator / intent_lens_classification | The 0.8 disclosure threshold creates a perverse incentive to inflate confidence. | sample 02 §6.1 | Require competitor disclosure at all confidence bands. |
| 02 | orchestrator / intent_lens_classification | Meta-recursive intents have no rule for inheritance from artefact. | sample 02 §6.3 | Add explicit meta-recursion clause. |
| 03 | domain_interpreter / product_intent_discovery | Layer carve-out is brittle without enforcement; "do not" clauses don't work for negation-prone models. | sample 03 §6.1 | Restate carve-outs in positive form; rely on validator enforcement. |
| 04 | domain_interpreter / compliance_retention_discovery | Strict "if not in accepted list, don't cite" rule under-cites plain-text upstream items. | sample 04 §1.4, sample 06 §6.2 | Clarify: plain-text upstream items may be cited verbatim as strings; empty surfaces array on a journey enacting a listed regime is a coverage failure. |
| 04 | domain_interpreter / compliance_retention_discovery | No `OPEN_QUESTION` discipline — the agent produced zero open questions on a manifestly under-specified compliance source. | sample 04 §1.8, §6.2 | Require scanning a hook list and emitting OPEN_QUESTION per hook. |
| 05 | domain_interpreter / business_domains_bloom | Persona-source field uses different enum from domain-source field; agent emitted wrong tag. | sample 05 §6.6 | Unify the enum or document the difference. |
| 05 | domain_interpreter / business_domains_bloom | No first-class representation of pillars / organising concepts. | sample 05 §6.5 | Add optional `pillars[]` or `parentPillar` field. |
| 05 | domain_interpreter / business_domains_bloom | Bloom mandate's "err on the side of over-proposing" is silently violated by self-pruning in thinking chain. | sample 05 §1a.8, §6.2 | Add positive examples of proposals the agent should NOT pre-prune; explicit list of forbidden rejection rationales. |
| 06 | domain_interpreter / user_journey_bloom | `automatable` rule's two clauses have unequal weight in agent behaviour. | sample 06 §1a.6, §2.4 | Restructure with explicit positive examples for clause 2 (persona-trigger-with-system-weight). |
| 07 | domain_interpreter / product_description_synthesis | `openLoops` enum lacks `scope` value. | sample 07 §1a.6, §6.4 | Add `scope` to the enum. |
| 07 | domain_interpreter / product_description_synthesis | No `compressionNotes` / `omittedFromNarrative` field. | sample 07 §1a.8, §6.4 | Add optional `compressionNotes` field. |
| 08 | orchestrator / release_plan | "Treat as hint" framing on phasing strategy licenses silent overrides. | sample 08 §6.6 | Require explicit override recording in release rationale. |
| 09 | requirements_agent / fr_bloom_skeleton | Exemplar block contained literal values the agent copied (US-001's "1 second"). | sample 09 §1a.1, §6.7 | Obfuscate exemplar values OR explicitly mark them as illustrative. |
| 09 | requirements_agent / fr_bloom_skeleton | `role` field is free-form; persona-id alignment needs strengthening. | sample 09 §1a.4, §6.5 | Add a `personaId` field alongside `role`. |
| 11 | requirements_agent / nfr_bloom_skeleton | Small-model bias toward `performance/security`. The prompt itself flags this; agent under-produces auditability/observability/maintainability. | sample 11 §1a.5, §6.5 | Add positive examples for under-represented categories; possibly require minimum count when source items demand. |
| 12 | requirements_agent / nfr_bloom_enrichment | Same exemplar-leakage mechanism as sample 09 — "1-minute cadence" copied from availability exemplar to security NFR. | sample 12 §1a.2, §6.4 | Same patch as sample 09. |

These items belong in upstream prompt redesign, not in the validator pipeline. The validator pipeline catches the symptoms; the prompt patches close the underlying defect classes.

---

## 5. Original ChatGPT-5.5 retirement plan

The original assessment's 7-component pipeline (`redesign recommendations - 1.md`) maps onto the cross-role catalog as follows:

| Original component | Disposition |
|---|---|
| §0 Shared review envelope | **Superseded** by the revised positive-mission envelope (catalog §9.0). The original is preserved at the end of `redesign recommendations - 1.md` for historical reference. |
| §1 Contract / schema validator | **Absorbed** into `contract_schema_validator` (cross-role) with role-keyed schema registry. |
| §2 Grounding / hallucination validator | **Absorbed** into `grounding_validator` (cross-role) with role-keyed claim list. |
| §3 Measurement adequacy validator | **Preserved verbatim** as `measurement_adequacy_validator`. Engages at full strength at FR/NFR enrichment and at saturation; narrowed to consistency-only at skeleton. |
| §4 Tier and decomposition validator | **Preserved verbatim** as `tier_decomposition_validator`. Engages **only** at FR/NFR saturation. |
| §5 Assumption and citation validator | **Absorbed** into `assumption_citation_validator` (cross-role) with per-pass collapse rule. Full form at saturation; trace-only collapse at skeleton/enrichment. |
| §6 Reasoning quality reviewer | **Absorbed** into `reasoning_quality_validator` (cross-role) with narrowed jurisdiction. Runs after the narrow validators; reports patterns rather than per-defect repeats. |
| §7 Final advisory synthesizer | **Preserved verbatim** as `final_synthesis` (cross-role). Decision policy adapted to advisory mode (`harness_design.md` §6). |

**Mark the original document as:**

> "Superseded by `track_c_synthesis/validator_catalog.md` for cross-role use. Retained as the **canonical saturation-pass reference** for sub-phases 2.1.4 / 2.2.4 (FR / NFR saturation) — the templates in §1, §3, §4, §5, §6, §7 are used verbatim at saturation. The shared envelope in §0 is superseded by the revised positive-mission envelope at the end of the same document. Track D implementations should reference this document directly when implementing saturation-pass validators."

The original also contains the foundational case study (the QSA scan / 100% coverage / "> 0" defect) that motivated the entire decomposition. That case study should be preserved as the **canonical worked example** in the `measurement_adequacy_validator` developer documentation.

---

## 6. Open architectural questions

Where the 12 assessments disagreed or did not reach a conclusion. Flagged for user resolution before Track D implementation.

### 6.1 Is `pillar_balance_audit` Hestami-specific or generalisable?

Sample 08 §6.9 explicitly raised this: "Whether `pillar_balance_audit` generalises to non-pillar product structures (e.g. capability-tiered or persona-tiered products without a pillar metaphor)." Two possibilities:

- **Promote to multi-pillar-product class.** Treat any product whose substrate names ≥2 organising concepts (pillars, modules, suites, tiers) as eligible. Generalise the validator to detect any organising concept and check balance. **Risk:** false positives on products that intentionally back-load one organising concept.
- **Treat as truly Hestami-specific.** The Hestami three-pillar structure is unusually load-bearing in the substrate. A capability-tiered SaaS product might not have an analogous balance constraint.

**Decision (locked):** Rename to `release_balance_audit`. "Pillar" is Hestami product-intent vocabulary; janumicode's canonical equivalent is **Release** (verified against `docs/janumicode_spec_v2.3.md` §2 Canonical Vocabulary, where "pillar" is explicitly enumerated as a non-canonical synonym for Release). The validator now checks balance across approved Releases in the Release Plan rather than across product pillars. Track D implements under the new name; the original Hestami three-pillar concern is naturally subsumed because Hestami's pillars map onto Releases through the Release Plan. Catalog, harness_design, and applicability matrix entries renamed accordingly.

### 6.2 Severity calibration mismatch between samples

Samples 04, 05, 06, 07, 08, 09, 10, 11, 12 all assign HIGH-severity to "fabricated grounding" defects. But the *threshold* for HIGH varies:

- Sample 09 treats US-001's exemplar leakage as HIGH because the leak is at the spine.
- Sample 12 treats "WAF" as MEDIUM because the broader corpus has a Cloudflare regime.
- Sample 04 treats compliance regime hallucination as HIGH, but the agent did not actually hallucinate (positive baseline).

The harness's `final_synthesis` decision policy (`harness_design.md` §6) needs a **calibration curve** that respects per-validator severity ladders without producing inconsistent gating across samples. **Open question:** should severity be calibrated against operational impact (a Track D implementation choice) or against substrate-driven thresholds (a per-validator parameter)?

**Decision (locked):** Use a **global operational-impact scale** (option a). One universal definition applies to every validator: "HIGH = could cause workflow halt, false approval downstream, or invalid commitment." Each validator's rubric specifies what HIGH means for its defect class **by reference to** that universal definition rather than via independently-tuned per-validator thresholds. Track D codifies this universal definition once at the harness level (see `harness_design.md` §6.2) and validator implementations cite it.

### 6.3 Final-synthesis decision policy details

The advisory-mode decision values (ACCEPT / ACCEPT_WITH_NOTES / REVISE / QUARANTINE / ESCALATE) are well-specified in `harness_design.md` §6, but several edge cases need a real run to test:

- What happens when one validator says HIGH and another (say, `reasoning_quality_validator`) says clean? Currently → ESCALATE. Is that right, or should the HIGH win automatically?
- How does the harness handle validator failures (LLM call timeouts, parse failures on validator output)? Currently undefined. Recommend defaulting to ESCALATE with a `validator_unavailable` finding.
- Should `contractDesignFindings` (prompt-author feedback) influence the decision, or is it purely informational? Currently informational only; could promote to MEDIUM-equivalent if a contract design issue affects multiple agent outputs.

**Decision (locked) — HIGH wins automatically:** Any single HIGH finding from any validator raises the decision floor to at least REVISE. Multiple HIGHs, OR HIGH combined with validator unavailability, escalate to QUARANTINE / ESCALATE per the existing severity ladder. Disagreement between a HIGH-firing validator and a clean `reasoning_quality_validator` no longer triggers ESCALATE on disagreement alone — the HIGH wins. Track D implements this as a hard floor in `final_synthesis` (see `harness_design.md` §6).

**Decision (locked) — Validator failure handling:** Apply the same retry + `json_repair` pattern used for primary LLM calls. After retries plus repair are exhausted, mark the validator as ESCALATE with a `validator_unavailable` finding attached to the harness record. No bespoke validator-failure path; reuse the orchestrator-level resilience already in place for primary calls.

**Decision (locked) — `contractDesignFindings` influence:** **Informational only.** `contractDesignFindings` (prompt-author feedback) do NOT influence the per-output decision. They surface as data for prompt designers to address upstream and are emitted alongside the decision but not as inputs to it.

### 6.4 Reasoning-chain pathology audit

Sample 12 §6.6 noted the 40× thinking-to-response ratio at qwen3.5:9b enrichment passes. **Open question:** should the harness include a `thinking_budget_audit` validator (or instrument the harness_record with the ratio for downstream alerting)? Cost defect, not correctness defect — placement is unclear.

**Decision (locked):** Defer the validator. Capture the thinking-to-response ratio in `harness_record` metadata for observability (cheap), but do not gate on it. No `thinking_budget_audit` validator at this time. Treat persistent high-ratio phases as a dashboard-level signal for prompt-design or model-choice review, not a per-output finding.

### 6.5 Contract-design findings as validator output

Several samples (04, 05, 07, 08, 09, 11, 12) recommended that the harness emit findings whose subject is the agent's prompt or contract, not the agent itself. The `final_synthesis.contractDesignFindings` channel (`harness_design.md` §6.4) is the proposed surface. **Open question:** should this be a separate validator (`contract_design_audit`) that runs in parallel, or remain a synthesis-time observation that `final_synthesis` collates from other validators' findings?

**Decision (locked):** Synthesis-time collation. `final_synthesis` collates `contractDesignFindings` from other validators' findings; no dedicated `contract_design_audit` validator at this stage. Promote to a dedicated validator only if collation proves noisy or misses pattern-level issues in practice.

### 6.6 Auto-recovery on deterministic findings

Sample 06 §6.4 noted that journey-ID mutations (`UJ-SETUP-PROPERTY` → `UJ-ONBOARD-PROPERTY`) are **deterministic-recovery defects**: a normalize step in the workflow could auto-recover. Sample 05 §6.4 made the same point for persona-ID drift (`P-CAM_MANAGER` → `P-CAM-MANAGER`).

**Open question:** should the harness include an auto-recovery layer for cosmetic mutations (underscore↔hyphen) that emit MEDIUM findings, or strictly stay advisory and let downstream consumers normalise?

**Decision (locked):** Stay strictly advisory in the harness. Auto-recovery belongs at the orchestrator/workflow level — the same locus as JSON repair. The harness reports the mutation as a finding; the orchestrator decides whether to apply a normalisation pass or propagate. No auto-recovery code in the harness.

### 6.7 Reviewer model sizing

Across all 12 samples, the gemma4:e4b reviewer under broad scope misses semantic-verification defects in ≥11 of 12 cases (sample 11 fires three findings but mis-anchors the HIGH). Sample 12 §6.8c proposes the conclusion: **broad-scope reasoning-review at Gemma-tier capacity is not a viable governance gate.**

The harness design (narrow validators) addresses this structurally. But: should LLM validators in the harness route to a stronger model (qwen3.5:9b or larger) by default, or stay at gemma4 to preserve cost?

**Decision (locked):** Stay at the current default (gemma4:e4b) to preserve cost. Per-validator model routing is already configurable in the harness design, so capability swaps can happen later without re-architecture. Revisit per-validator routing (e.g. promoting centerpiece validators to a stronger model) once a real capability evaluation begins; until then, gemma4:e4b is the default for all LLM validators.

### 6.8 Saturation-pass calibration

The original ChatGPT-5.5 templates have not been tested against a real cal-25 saturation-pass output (cal-25 did not reach saturation passes during Phase C.2). The templates are preserved verbatim and assumed to work — but they are **untested at this exact point in the workflow**.

**Open question:** When does cal-25 (or its successor) reach Phase 2.1.4 / 2.2.4? Saturation-pass samples are needed to validate that:
- `tier_decomposition_validator` correctly classifies atomic_leaf vs decomposable vs invalid_parent.
- `measurement_adequacy_validator` at full original scope catches the eleven-pattern battery on real saturation outputs.
- The interaction between recursive saturation (multi-tier decomposition) and the harness (per-output review) doesn't produce O(N²) cost growth.

**Decision (locked):** Block Track D's saturation-pass validator implementation until a calibration run produces saturation samples (Phase 2.1.4 / 2.2.4). Track A already supports recursive saturation; sample capture is a matter of running calibration further. The original ChatGPT-5.5 saturation-pass templates remain preserved verbatim and are assumed to work pending sample-driven verification.

**Resolution (cal-26, samples 13 and 14):** Saturation samples have been captured across both FR and NFR saturation passes at three decomposition depths each (depths 0, 4, 8). Per-role assessments confirm the ChatGPT-5.5 seven-validator set as the correct bundle verbatim, with five additional saturation-specific family validators identified. See `per_role_assessments/13_requirements_agent__fr_saturation.md` and `per_role_assessments/14_requirements_agent__nfr_saturation.md` for the full defect evidence base. Dispatch bundles are promoted to `harness_design.md` §2.1 (entries 2.1.4 and 2.2.4); saturation-class family validators are catalogued in `validator_catalog.md` §5.4. The saturation-pass calibration question is **resolved**; Track D can proceed with saturation-pass validator implementation. The O(N²) cost-growth concern has not been characterized but sample-scale testing (3 samples × 3 depths) did not surface any structural barrier.

---

## 7. Cal-26 placeholder-bundle observations

Sub-phases not yet wired into DISPATCH_BUNDLES at cal-26 time fall through to a placeholder bundle of 5 generic validators (`contract_schema_validator`, `grounding_validator`, `reasoning_to_response_faithfulness`, `reasoning_quality_validator`, `final_synthesis`). At cal-26 sample time, both `fr_saturation` and `nfr_saturation` fell through to this placeholder because their dispatch rows were not yet in §2.1 of `harness_design.md`.

**Sample 13c placeholder regression.** `reasoning_quality_validator` running at broad scope (no saturation-aware contextual validators in the bundle) falsely flagged a well-formed SQL `measurable_condition` — `"SELECT * FROM ENT-TENANT-SETTING WHERE tenant_id != CURRENT_TENANT_ID returns zero rows"` — as HIGH, characterising it as "a descriptive sentence, not a formal query." This false positive elevated the harness decision to REVISE. Meanwhile, the real HIGH finding — a fabricated `traces_to` reference (`FR-VIOL-DEL-001.2.1.1.C-02-D-01` absent from both handoff_context and sibling_context) — went uncaught because the placeholder bundle carried no `traces_to_id_validity` check. The harness REVISE'd the wrong thing and missed the true contract violation.

**Implication.** Even after wiring the saturation dispatch rows (`harness_design.md` §2.1 entries 2.1.4 and 2.2.4), the placeholder bundle's `reasoning_quality_validator` should be reviewed for over-eagerness on output structure at any pass whose output contains complex structured content (SQL conditions, tier labels, trace ID namespaces). Broad-scope `reasoning_quality_validator` without the calibrating narrow validators tends to fire on form rather than content — the same failure mode seen across the 12-sample corpus with the Gemma reviewer at broad scope. The false-positive rate of the placeholder bundle is unknown; the 13c case is the first corpus-level characterization.

**Status.** Deferred to a future sweep (post Stage 1A.3) once additional cal-26 sub-phases are sampled and we can characterize the placeholder bundle's false-positive rate across the corpus. The immediate remediation — wiring saturation bundles so the placeholder does not fire on fr_saturation / nfr_saturation — is captured in `harness_design.md` §2.1.

**Phase 3 samples (15/16/17) — placeholder bundle behavior update.** Systems_agent sub-phases 3.1 (system_boundary), 3.2 (system_requirements), and 3.3 (interface_contracts) also fell through to the placeholder bundle at cal-26 time (Phase 3 was not in DISPATCH_BUNDLES). Unlike the 13c saturation-surface case, the placeholder bundle did **not** false-positive at Phase 3: `reasoning_quality_validator` at broad scope correctly identified genuine defects on all three samples — `ignored_instructions` on sample 15 (copied pre-computed boundary summary instead of enumerating individual FRs), `shortcut_taken` on sample 16 (domain-level grouping instead of per-ID allocation), and structural omissions plus grounding failures on sample 17 (three dropped system IDs and fabricated implementation specifics). No false positives on any Phase 3 sub-phase.

The 13c false positive was a saturation-surface-specific pattern: the validator mistook well-formed SQL in a `measurable_condition` field as a descriptive sentence (a form-vs-content misinterpretation). At Phase 3, the output structures contain no analogous ambiguous content type — in_scope arrays, source_requirement_ids arrays, and contract fields do not contain SQL-like structured strings that a broad-scope LLM validator might misinterpret. The placeholder bundle's directional reliability is **surface-dependent**: it performs correctly at extraction/enumeration surfaces (Phase 3) and incorrectly at complex-structured-content surfaces (SQL conditions, tier labels, trace namespaces at saturation). This updates the Stage 1A.3 observation: the 13c false-positive pattern is not a general placeholder-bundle problem; it is a saturation-surface-specific failure mode. The immediate remediation — wiring Phase 3 dispatch rows so the placeholder does not fire on systems_agent sub-phases — is captured in `harness_design.md` §2.1 (entries 3.1, 3.2, 3.3).

**Phase 4 samples (18/19/20/21a/21b) — placeholder bundle behavior update.** Architecture_agent sub-phases 4.1 (software_domains), 4.2 (component_skeleton), 4.3 (adr_capture) and domain_interpreter Phase 4.2a (component_saturation depths 0 and 1) also fell through to the placeholder bundle at cal-26 time (Phase 4 was not in DISPATCH_BUNDLES). Like Phase 3, `grounding_validator` was directionally reliable across all five Phase 4 samples — no false positives observed. `reasoning_quality_validator` at broad scope correctly identified the LOW finding at sample 20 (premature ADR acceptance status — all ADRs set to 'accepted' without governance rationale) without misfiring on tier labels or classification rubric content at samples 21a/21b. This contrasts with the saturation-depth-8 false positive at sample 13c; the Phase 4.2a component_saturation surface (atomic_component / decomposable / invalid_parent classifications, tier labels, `agrees_with_hint` boolean) did not trigger form-vs-content misinterpretation from `reasoning_quality_validator`. The placeholder bundle's directional reliability at shallow saturation depths thus extends to component_saturation, matching the Phase 3 extraction/enumeration surface behavior.

**Sample 20 rendering bug (harness follow-up).** At sample 20 (adr_capture, QUARANTINE — 4 HIGH + 1 MEDIUM + 1 LOW), a harness rendering bug was observed: `decision_rationale` reads "3 HIGH findings" but `findings_count_by_severity` correctly shows H=4. The fourth HIGH was added by `final_synthesis` after the `decision_rationale` string was pre-frozen. Track D harness implementation should populate the `decision_rationale` string from `findings_count_by_severity` at synthesis **completion** time — not from an intermediate count frozen before `final_synthesis` runs. The `ReasoningReviewHarnessRecord.decision_rationale` field should be written last, after all per-validator records and the `final_synthesis` record are committed. See per-role assessment 20 §1 rendering-bug note.

**Phase 5 samples (22/23/24/25/26a/26b) — placeholder bundle behavior update.** All five Phase 5 samples fell through to the PLACEHOLDER bundle at cal-26 time (Phase 5 not in DISPATCH_BUNDLES). Key observations:

- The placeholder bundle's `grounding_validator` was directionally reliable across all Phase 5 flat sub-phases (22–25) — no false positives observed, consistent with Phase 3 and Phase 4 extraction/enumeration surfaces. The same pattern does NOT hold for saturation-depth-8 (sample 13c false positive) — but shallow-depth Phase 5.x saturation (26a/26b) showed no false positives either.
- Phase 5 has the **highest defect density of any cal-26 phase**: sample 24 (error_handling) had 19 findings (H=0/M=19/L=0); sample 25 (configuration_parameters) QUARANTINE with 15 HIGH findings. This density indicates `technical_spec_agent` prompts have less grounding rigor than Phase 2 saturation prompts (which were tightened in Stream A). Stream A for Phase 5 should land before any future cal run reaches Phase 5 — otherwise the harness will catch many findings but the real fix is upstream prompt design.
- The markdown-fence JSON wrapping at sample 23 (triggering json_repair with 134695ms additional latency) was treated as a structural infrastructure event by the placeholder bundle — not as a scored finding. The promoted `json_output_discipline_check` (now family-level) would catch this at near-zero cost before any LLM validator runs.

### 7.3 Phase 5 schema naming inconsistency: `error_handling` vs `error_handling_strategies`

Sample 24 reveals a schema naming inconsistency: the governed_stream `sub_phase_id` is `error_handling`, but the artifact schema root key is `error_handling_strategies`. This is a prompt/schema authoring defect, not an agent defect — the agent correctly used `error_handling_strategies` as the root key. The inconsistency affects dispatch key matching in Track D.

**Recommended resolution before Track D dispatch wiring of Phase 5.3:** Align both `sub_phase_id` and the schema root key to `error_handling_strategies` (the artifact is the ground truth; the sub_phase_id should match). Until resolved, the Phase 5.3 dispatch row in `harness_design.md` §2.1 should include a note that the dispatch key maps `error_handling` → schema field `error_handling_strategies`. Do not break existing governed_stream records at cal-26; apply the rename in the next schema version. See per-role assessment 24 §1b schema note.

### 7.4 Phase 5 saturation depth limitation

Cal-26 reached `data_model_saturation` depth 1 only (sample 26a at depth 0, sample 26b at depth 1). Both are within expectations (26a REVISE on a structural FK gap, 26b ACCEPT). The QUARANTINE density at Phase 5 flat sub-phases (sample 25: 15 HIGH) suggests that `technical_spec_agent` prompts may exhibit worse drift at deeper saturation depths than Phase 4.2a component_saturation — but this is a hypothesis pending cal-27 evidence at depth ≥3. The depth-stratification pattern (shallow cleanliness, deep drift) observed at fr_saturation may apply here, but cannot be confirmed from the current corpus.

**Recommendation:** Deploy the `technical_spec_agent / data_model_saturation` dispatch bundle (harness_design.md §2.1 entry 5.x) in OBSERVE-ONLY mode until depth ≥3 evidence is available, matching the approach recommended for component_saturation before cal-26 samples 21a/21b were captured.

### 7.1 Phase 4 emergent sub-phase: adr_capture

`adr_capture` (Phase 4.3) was **not** in the original Phase 4 sub-phase list at deferred_to_track_d authoring time. Cal-26 sample 20 confirms its existence and hybrid shape (discovery-class grounding + thin decision-class layer). Before Track D dispatch wiring is promoted to production:

1. Verify `adr_capture` is registered in `phaseManifest.ts` with the correct `agent_role` / `sub_phase` / `displayCode` triple (currently appears as an emergent addition — not confirmed in manifest at cal-26 authoring time).
2. Verify the adr_capture JSON schema (`architectural_decisions` array with `status`, `decision`, `rationale`, `alternatives`, `consequences` fields) is registered in the `contract_schema_validator` role-keyed schema registry.
3. Confirm the dispatch bundle entry in `harness_design.md` §2.1 (entry 4.3) matches the actual schema fields emitted by the agent — specifically that `accepted_rationale[]` or an equivalent field exists for `adr_status_discipline_validator` to check.

Until these three verifications complete, the adr_capture dispatch row (harness_design.md §2.1 entry 4.3) should be treated as a **provisional wiring**, not a production-ready bundle. Cross-reference: per-role assessment 20 §1 note on emergent sub-phase status.

### 7.2 Component saturation depth limitation

Cal-26 reached `component_saturation` depth 1 only (sample 21a at depth 0, sample 21b at depth 1). Both are clean ACCEPTs. The clean ACCEPT decisions at depths 0–1 may not generalize to deep depths: fr_saturation at depth 8 (sample 13c) showed dramatic quality drift (fabricated trace IDs, scope-creep tier misclassification) absent from depths 0 and 4. Two competing hypotheses per per-role assessment 21 §1:

- **(a) Universal shallow-depth cleanliness**: any saturation role produces clean outputs at depth 0–1 where the sibling context is sparse and accumulated context drift has not occurred. Deep-depth evidence is the distinguishing test.
- **(b) Domain_interpreter structural resistance**: the tier rubric (atomic_component / decomposable / invalid_parent; agrees_with_hint) is more mechanically testable than the atomic_leaf mirror contract used in fr_saturation, making domain_interpreter structurally more resistant to deep-depth drift than requirements_agent.

**Stage 1D sample at component_saturation depth ≥3 is required** to distinguish these hypotheses and to:
- Characterize the `reasoning_quality_validator` false-positive profile at deep component_saturation depths (analogous to the SQL-condition false positive at fr_saturation depth 8 — does the validator misfire on complex decomposition rationale or tier-override arguments at depth ≥3?).
- Validate `traces_to_id_validity` (parameterized: `dependencies[].component_id`) at depth ≥2 where fabricated namespace references become more likely as sibling context grows.
- Determine whether `tier_assignment_audit` drifts at deep depths in the same way `measurement_adequacy_validator` drifted at fr_saturation depth 8.

Until Stage 1D component_saturation samples are available, Track D should deploy the component_saturation dispatch bundle (harness_design.md §2.1 entry 4.2a) in **OBSERVE-ONLY mode**: capture harness_records but do not gate on them. This matches the approach recommended for fr_saturation before cal-26 samples 13/14 were captured.
