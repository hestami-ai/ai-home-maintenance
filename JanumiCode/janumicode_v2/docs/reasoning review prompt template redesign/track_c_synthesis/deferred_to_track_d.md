# Phase C → Track D Handoff — Deferred Items

(Aggregates everything that the 12 per-role assessments + sample 12's closing report flagged as "deferred to Phase C.3 synthesis." Organised by category. Each item points back to the source assessment that surfaced it.)

---

## 1. Roles not yet sampled (need Phase C.x extension)

The following `agent_role` values exist in `phaseManifest.ts` but were not sampled in cal-25 because the run did not reach Phase 3+. A follow-up assessment campaign is needed when those samples become available.

| agent_role | Phases / sub-phases | Why deferred |
|---|---|---|
| `systems_agent` | Phase 1 systems decomposition (1.5–1.10 systems-side) | cal-25 stopped before Phase 3 |
| `architecture_agent` | Phase 2 architecture (2.0+) | not reached |
| `technical_spec_agent` | Phase 2.5 technical specs | not reached |
| `implementation_planner` | Phase 4 implementation planning | not reached |
| `test_design_agent` | Phase 5 test design | not reached |
| `eval_design_agent` | Phase 6 evaluation design | not reached |
| `executor` / `executor_agent` | Phase 7 execution | not reached |
| `consistency_checker` | Phase 0.5 / Phase 8 consistency review | not exercised in cal-25 |
| `client_liaison` | Phase 0 client engagement | not exercised |
| `deep_memory_research` | Phase 0 memory ingestion / synthesis | not exercised |

**Placeholder bundle** (per `harness_design.md` §2.3): for any unsampled role, the harness dispatches `contract_schema_validator` (with a registry entry created at sample capture time) plus `reasoning_quality_validator` (broad-scope, original §6 template) plus `grounding_validator` plus `reasoning_to_response_faithfulness` (when thinking chain present). This is an interim placeholder; replace with a role-specific bundle following the same family-taxonomy logic when samples are captured.

**Anticipated family-mappings** for the unsampled roles (working hypotheses, to be validated):
- `systems_agent` → bloom-class (mostly) + synthesis-class for handoff outputs
- `architecture_agent` → bloom-class for component blooms; synthesis-class for ADR rationales; possibly a new "decision-class" family
- `technical_spec_agent` → requirements-class (skeleton + enrichment + saturation lifecycle) + synthesis-class for spec docs
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
