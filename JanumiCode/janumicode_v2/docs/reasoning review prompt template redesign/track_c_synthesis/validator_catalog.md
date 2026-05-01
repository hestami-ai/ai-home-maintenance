# Reasoning Review — Cross-Role Validator Catalog

(Synthesized from 12 per-role assessments + the original ChatGPT-5.5 decomposition reference. See `../per_role_assessments/` for the source assessments and `../redesign recommendations - 1.md` for the original decomposition. Use `src/lib/orchestrator/phaseManifest.ts` as the canonical source for `agent_role` / `sub_phase` / `displayCode` triples.)

This catalog is an abstraction layer over the twelve per-role assessments. Per-role specifics (severity tables, sample-by-sample fire/no-fire predictions, role-specific marker sets) live in the source assessments and are referenced here rather than restated.

---

## 0. Validator family taxonomy

Across the twelve samples, validators cluster into seven families:

| Family | Scope of applicability | Source samples |
|---|---|---|
| **Universal cross-role** | All `agent_role × sub_phase` pairs that produce a JSON artefact + (optional) thinking chain | 01–12 |
| **Discovery-class** | Phase 1.0b–1.0e silent-discovery passes (product / technical / compliance / V&V); generally any *extraction* pass with a strict layer assignment | 03, 04 (and projected to 1.0c/1.0e/1.0f when sampled) |
| **Bloom-class** | Phase 1.5–1.10 bloom-and-prune passes (business domains, user journeys, workflows, entities, integrations, NFR-attribute brainstorm) | 05, 06 |
| **Synthesis-class** | Compression-shaped handoff outputs (product description synthesis, release plan, ADR rationales, narrative curator) | 07, 08 |
| **Requirements-class root-pass** (skeleton) | Pass 1 of 3 in Sub-Phase 2.1 / 2.2 (FR skeleton, NFR skeleton); generally any first-pass requirement spine | 09, 11 |
| **Requirements-class enrichment-pass** | Pass 2 of 3 in Sub-Phase 2.1 / 2.2 (FR-AC enrichment, NFR threshold/method enrichment) | 10, 12 |
| **Requirements-class saturation-pass** | Sub-Phase 2.1.4 / 2.2.4 (recursive tiered decomposition); the home of the original ChatGPT-5.5 assessment | original ChatGPT-5.5 reference |
| **Role-specific outliers** | One-of validators tied to a single role's contract (IQC, lens, release-plan multi-pillar, etc.) | 01, 02, 08 |

The taxonomy maps cleanly onto the architectural decision the harness implements (see `harness_design.md` §2 dispatch logic): every `(agent_role, sub_phase)` combination dispatches *exactly one* family-bundle plus the universal cross-role validators plus zero-or-more role-specific outliers.

---

## 1. Universal cross-role validators

These validators apply to every reviewed `(agent_role, sub_phase)` pair across the corpus. Where parameter variation is needed (e.g. role-specific JSON schema, role-specific claim list), the variation is encoded as runtime parameter rather than as a separate validator implementation.

| Validator | Type | Parametrization | Mission |
|---|---|---|---|
| `contract_schema_validator` | deterministic | role-keyed schema registry | Verify response is valid JSON, conforms to the role-specific schema (top-level keys, enums, ID prefix, ID uniqueness, no markdown fences, no trailing prose, no unescaped internal double quotes). |
| `grounding_validator` | LLM | role-keyed claim list (numerics, regimes, identifiers, span verbatim-ness) | Classify every material generated claim as SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / CONTRADICTED relative to the source context. |
| `reasoning_to_response_faithfulness` | LLM | role-keyed marker set (rule-commitment phrases, drop phrases, oscillation patterns) | Detect candidate findings the agent enumerated then dropped without justification, rule-commitments the agent made then violated, and reversed decisions between thinking and response. |
| `open_question_vs_decided` | LLM | role-keyed threshold-shape regex; cross-array partition rule | Detect cases where an open question is silently resolved by a decision in the same response, and unsupported thresholds embedded as binding commitments. |
| `output_substantiveness_check` | deterministic | per-pass length floors and predicate-token sets | Distinguish a contract-satisfying minimal response from a near-empty placeholder; ensures the agent did the authoring work. |
| `reasoning_quality_validator` | LLM | (no parameters) | Catch shortcuts, unjustified leaps, contradictions between reasoning and output, over-cleverness, fragile coupling, ignored instructions, edge-case blindness. **Narrowed version of the original ChatGPT-5.5 single-pass reviewer** — runs only after the narrower validators, focusing on the *pattern* of defects rather than individual instances. |
| `assumption_citation_validator` | LLM | per-pass collapse rule (full / trace-only) | Verify surfaced assumptions and citation references; collapses to traceability-only at passes that lack a `surfaced_assumptions[]` field. |
| `final_synthesis` | LLM | decision-policy parameter (advisory thresholds) | Combine validator findings into one advisory decision (ACCEPT / ACCEPT_WITH_NOTES / REVISE / QUARANTINE / ESCALATE) and emit prompt-patch / rerun recommendations. |

**Synonyms across the assessments** (canonical name = the one used in this catalog):
- `contract_schema_iqc` (sample 01), `contract_schema_lens` (02), `contract_schema_discovery` (03), `contract_schema_compliance` (04), `contract_schema_bloom` (05/06), `contract_schema_synthesis` (07), `contract_schema_release_plan` (08), `contract_schema_skeleton` (09), `contract_schema_enrichment` (10), `contract_schema_nfr_skeleton` (11), `contract_schema_enrichment_nfr` (12) → all instances of `contract_schema_validator` in the role-keyed registry.
- `grounding_iqc` / `rationale_grounding_lens` / `grounding_discovery` / `grounding_compliance` / `grounding_synthesis` → `grounding_validator` instances.
- `source_attribution_grounding` (samples 05, 06, 09, 10, 11, 12) is a *near-sibling* of `grounding_validator` distinguished by unit-of-analysis: source_attribution operates at the per-item attribution level (does this item's `source` tag match the source span?), whereas grounding operates at the per-claim level (is this claim entailed?). Both retained; see §2 and §3 for usage.
- `assumption_citation_validator` collapses to `extraction_id_traceability` in discovery passes and to a trace-only check in skeleton/enrichment passes; the same template is used with mission-narrowing.

---

## 2. Discovery-class validators

Phase 1.0b–1.0e (and any future extraction pass with a strict positive-list-plus-sibling-carve-out structure). The dominant defect is *cross-layer drift*: items belonging to a sibling pass are paraphrased into the current pass's output and consume slots that should hold native extractions.

| Validator | Type | Parametrization | Mission |
|---|---|---|---|
| `scope_boundary_adherence_*` | LLM | `current_pass_id` + `positive_list` + `sibling_layer_table` | Verify every extracted item belongs to the current pass's layer; flag drift to siblings. Sample 03 (1.0b → 1.0c/d/e/f), sample 04 (1.0d ← 1.0c). Family parameterised cleanly across passes. |
| `extraction_id_traceability` | deterministic | per-pass ID-prefix registry, cross-array reference graph | Verify every ID follows the documented prefix convention, is unique within its array, and (where applicable) every cross-array reference resolves. |
| `external_reference_handling` | LLM | (parameter-free; fires on company-name-list ∪ "like X" / "see Y appendix" patterns) | Verify that source references to external companies (ServiceTitan, Vantaca, Stripe) are surfaced as `decisions` (tentative scope-shape) and/or `openQuestions` (which features to mirror), not absorbed into native extractions. |

**Compliance-specific specialisations (sample 04):**
- `regime_citation_validity` (LLM): Verify every named regulatory regime appears in the source, and that source-named regimes are extracted.
- `retention_threshold_grounding` (LLM): Verify every numeric retention period is verbatim attested in the cited source span.
- `compliance_signal_completeness` (LLM): Detect high-salience compliance hooks in the source (HOA/POA Acts, W-9/1099, PCI scope, ESIGN/UETA, audit trail) that are not surfaced anywhere in the response.

These three remain compliance-class-specific. The *technique* of `retention_threshold_grounding` (verbatim-numeric grounding against a cited source span) generalises to V&V threshold grounding in 1.0e; defer the cross-pass abstraction until 1.0e is sampled.

---

## 3. Bloom-class validators

Phase 1.5–1.10 bloom-and-prune passes. The cross-bloom commonality lives in **defect categories** (provenance attribution, completeness vs thinking, faithfulness) more than in shared validator implementations. Each bloom contract's structure dictates a distinct mix of journey-specific or domain-specific validators.

**Confirmed NEGATIVE for `scope_boundary_adherence_*`**: blooms are trans-sibling by design; sibling-pass drift is the desired behaviour, not a defect. Samples 05 and 06 firm this exclusion.

| Validator | Type | Family member | Mission |
|---|---|---|---|
| `source_attribution_grounding` | LLM | shared bloom + downstream | Verify every bloom item's `source` tag (`user-specified` / `document-specified` / `domain-standard` / `ai-proposed`) accurately reflects its relationship to the source. |
| `persona_id_continuity` | deterministic | shared bloom + downstream | Compare upstream persona IDs to output persona IDs; flag drift, drops, fabricated `document-specified` tags on new IDs. |
| `bloom_completeness_vs_thinking` | LLM | shared bloom | Detect candidates the agent considered then rejected on grounds the bloom mandate forbids ("low priority", "future scope", "too niche"). |
| `entity_workflow_shape` | deterministic + LLM fallback | sample 05 (domains-bloom) | Entities are nouns the system stores; workflows are verbs it runs. Catch "Workflow Bot" / "Recommendation Engine" in `entityPreview`. |
| `pillar_domain_alignment` | LLM | sample 05 (domains-bloom); generalises to `phase_journey_alignment` in 06 | Verify source-named organising concepts (pillars, modules, suites) are represented somewhere in the bloom output. |
| `domain_persona_coherence` | LLM | sample 05 (domains-bloom) | Bidirectional persona ↔ domain coverage. |
| `journey_id_continuity` | deterministic | sample 06 (journey-bloom) | Compare phasing-strategy-named journey IDs to output IDs; flag renames and drops. |
| `surface_attribution_completeness` | LLM | sample 06 (journey-bloom) | Verify journey `surfaces` arrays cite the upstream compliance/retention/V&V/integration items the journey enacts. |
| `workflow_journey_separation` | LLM | sample 06 (journey-bloom) | Verify entries in `userJourneys[]` are user journeys (persona-led end-to-end flows) and not system workflows. |
| `step_completeness_and_automatable` | LLM with deterministic prefilter | sample 06 (journey-bloom) | Verify step structure and the two-clause `automatable` rule (system-actor OR persona-trigger-with-system-weight). |
| `acceptance_criteria_measurability` | LLM | sample 06 (journey-bloom); generalises to other AC-emitting passes | Verify ACs are falsifiable, behaviour-grounded, not pure latency or vacuous. |
| `persona_journey_coupling` | LLM | sample 06 (journey-bloom) | Every persona has a journey or honest `unreached_personas[]` entry; every step actor resolves to a persona or "System". |
| `domain_journey_coupling` | LLM | sample 06 (journey-bloom) | Mirror of `persona_journey_coupling` for domains. |
| `phase_journey_alignment` | deterministic + LLM fallback | sample 06 (parameter-variation of `pillar_domain_alignment`) | Verify phase-tag assignments respect the phasing strategy's persona/domain → phase mapping. |

The bloom-family generic set (`source_attribution_grounding`, `persona_id_continuity`, `bloom_completeness_vs_thinking`) generalises across bloom passes. The remaining bloom validators are *contract-specific*: each bloom has a different shape and demands its own structural checks. Future bloom samples (workflow bloom, entity bloom, integration bloom, NFR-attribute brainstorm) will likely add another half-dozen contract-specific validators each.

---

## 4. Synthesis-class validators

Samples 07 and 08 confirm the synthesis-family core as a stable five-validator set. **Promoted to cross-role status** by the 2-sample test (07 → 08): five-of-five carry forward from product_description_synthesis to release_plan, with two unchanged, two parameter-varying, and one (`phasing_dependency_consistency`) splitting into two release-plan-specific heirs.

| Validator | Type | Disposition 07 → 08 | Mission |
|---|---|---|---|
| `synthesis_coverage_audit` | LLM | parameter-vary (substrate set rotates from "personas, domains, integrations" to "accepted_journeys") | For each multi-item set in the substrate, build a coverage matrix: which items survived as named, as implicit, as DROPPED_SILENT? |
| `synthesis_fabrication_check` | LLM | exact reuse (unit rotates from productDescription noun phrases to release rationales) | Confirm every noun phrase, named concept, framing metaphor, and claim in the synthesis traces to a substrate item. Flags reframings, fabricated metaphors, amplifying adjectives. |
| `handoff_field_completeness` | deterministic + LLM | exact reuse | Verify each required handoff field is populated meaningfully (not a placeholder, not a copy of the seed). |
| `compression_fidelity_audit` | LLM | parameter-vary (load-bearing concept set rotates) | Identify load-bearing nuance from the substrate that the synthesis preserved, partially preserved (collapsed distinctions), or lost. |
| `phasing_dependency_consistency` | LLM-or-deterministic | **split** into `wave_dependency_topology` + `compliance_sequencing_audit` at sample 08 | Verify phasing/release structure respects dependency ordering implied by substrate. |

**Release-plan-specific additions (sample 08; cross-role candidates for any sequenced commitment surface):**
- `wave_dependency_topology` (LLM-or-deterministic): General DAG correctness on placement; back-edge detection.
- `compliance_sequencing_audit` (LLM): Compliance-anchored specialisation — paid execution before vetting, fund movement before audit trail.
- `mvp_credibility_check` (LLM): REL-1 supply/demand closure; demand journeys with no in-wave or earlier-wave supply are dead-letter.
- `release_balance_audit` (LLM, **renamed from `pillar_balance_audit`**): Release-level balance / persona stranding; risk concentration in single Releases. Operates over the approved Release Plan. The original "pillar" framing was Hestami product-intent vocabulary; the canonical janumicode term is **Release** (`docs/janumicode_spec_v2.3.md` §2 explicitly enumerates "pillar" as a non-canonical synonym for Release). Track D implements under the new name; Hestami's three-pillar concern is naturally subsumed because pillars map onto Releases through the Release Plan. (Decision locked in `deferred_to_track_d.md` §6.1.)

The synthesis-class family is the **strongest cross-role design pattern in the corpus** because every phase has a handoff and every handoff is a synthesis. Future synthesis samples (Phase 2 architecture handoff, Phase 4 NFR handoff, Narrative Curator outputs, ADR rationales) should pull from this family by default.

---

## 5. Requirements-class validators (skeleton + enrichment + saturation)

The requirements family has a three-pass lifecycle: skeleton (root) → enrichment → saturation (recursive tiered decomposition). Validator activation rotates per pass.

### 5.1 Lifecycle

```
Pass 1 (Skeleton, sub_phase 2.1.1 / 2.2.1)
  ├─ contract_schema_skeleton              (deterministic; one AC per FR / one seed_threshold per NFR)
  ├─ story_structural_completeness         (deterministic; FR only — role/action/outcome shape)
  ├─ nfr_structural_completeness           (deterministic; NFR only — category/description/seed_threshold shape)
  ├─ handoff_coverage_audit                (deterministic; spine = UJ-set for FR, V&V ∪ material-COMP for NFR)
  ├─ fr_trace_pollution_check              (deterministic; NFR only — no US-*/AC-* in traces_to)
  ├─ source_attribution_grounding          (LLM)
  ├─ story_shape_conformance               (LLM; FR only)
  ├─ nfr_shape_conformance                 (LLM; NFR only)
  ├─ pass_scope_discipline                 (LLM)
  ├─ threshold_presence_check              (LLM; NFR only)
  ├─ quality_attribute_taxonomy_alignment  (LLM; NFR only)
  ├─ measurement_adequacy_validator        (LLM; CONSISTENCY-ONLY narrowing — description ↔ condition / threshold)
  ├─ grounding_validator                   (LLM; narrowed surface)
  ├─ reasoning_to_response_faithfulness    (LLM)
  └─ assumption_citation_validator         (LLM; trace-only collapse)

Pass 2 (Enrichment, sub_phase 2.1.2 / 2.2.2)
  ├─ contract_schema_enrichment            (deterministic; AC array for FR, threshold+method for NFR)
  ├─ enrichment_echo_invariance            (deterministic; subsumes story_structural / handoff_coverage / shape_conformance — echo-or-be-flagged)
  ├─ ac_count_discipline                   (deterministic; FR only — 3–7 ACs, hard cap 10)
  ├─ output_substantiveness_check          (deterministic; NFR enrichment — single-string contract floor)
  ├─ exemplar_leakage_detector             (deterministic; Levenshtein vs prompt's exemplar block)
  ├─ source_attribution_grounding          (LLM; per-AC / per-(threshold,method) anchor)
  ├─ threshold_grounding_audit             (LLM; FULL ORIGINAL SCOPE — numerics, cadences, status codes, sibling enums)
  ├─ grounding_validator                   (LLM; FULL ORIGINAL SCOPE — endpoints, error names, instruments, observation surfaces)
  ├─ measurement_adequacy_validator        (LLM; FULL ORIGINAL ChatGPT-5.5 SCOPE — eleven-pattern battery)
  ├─ measurable_condition_executability    (LLM; FR — per-AC executability)
  ├─ measurement_method_executability      (LLM; NFR — per-method executability)
  ├─ skeleton_drift_audit                  (LLM)
  ├─ pass_scope_discipline                 (LLM; Pass-2 boundary — no NFR thresholds in FR ACs, no Pass-3 cross-NFR work)
  ├─ assumption_citation_validator         (LLM; trace-only)
  ├─ reasoning_to_response_faithfulness    (LLM)
  └─ open_question_vs_decided              (LLM; conditional)

Pass 4 (Saturation, sub_phase 2.1.4 / 2.2.4 — original ChatGPT-5.5 reference)
  ├─ contract_schema_validator             (deterministic; full saturation schema with tier, parent_branch_classification)
  ├─ grounding_validator                   (LLM; full original §2 scope)
  ├─ measurement_adequacy_validator        (LLM; full original §3 scope — battery + saturation-specific patterns)
  ├─ tier_decomposition_validator          (LLM; ORIGINAL §4 — engages here for the first time; atomic_leaf vs decomposable vs invalid_parent)
  ├─ assumption_citation_validator         (LLM; FULL form — surfaced_assumptions[] active)
  ├─ reasoning_quality_validator           (LLM; original §6)
  └─ final_synthesis                       (LLM; original §7)
```

### 5.2 Pass-pair parametrization rule (sample 12 §6.8b)

The validator implementations should be parameterised by `{role, pass}` rather than written per-`(role, pass)` pair. Concretely:

- The same `contract_schema_validator` implementation handles all three passes via a `(role, pass) → schema` registry.
- The same `measurement_adequacy_validator` template runs at all three passes; the difference is the `claims_to_check` parameter (consistency-only at skeleton, full FR-AC battery at enrichment, full original battery at saturation).
- The same `enrichment_echo_invariance` implementation handles both FR and NFR enrichment with the field-set parameter.

Roughly **80% of the requirements-class validator code is shared** between FR and NFR sides; the remaining 20% is parameter swaps.

### 5.3 `tier_decomposition_validator` — saturation-only

Confirmed across samples 09, 10, 11, 12: this validator does **not** apply at skeleton or enrichment (no `tier` field, no decomposition). It re-engages at saturation only. Use the original ChatGPT-5.5 §4 template verbatim at saturation; no parameter variation needed.

---

## 6. Role-specific validators (no cross-role generalization)

These validators address defect classes unique to a single `(agent_role, sub_phase)` pair.

| Validator | Origin sample | Why role-specific |
|---|---|---|
| `completeness_evidence_adequacy` | 01 (IQC) | Specific to `completeness_findings[]` with `status: "present"` — verifies cited evidence is commensurate with intent scope (e.g., one pillar of three). |
| `coherence_evidence_audit` | 01 (IQC) | Inverts the agent's task: scans the source for concrete coherence defects (empty sections, truncated sentences, TBD markers, competitor-reference specifications) and verifies each is represented in `coherence_findings`. |
| `status_consistency_iqc` | 01 (IQC) | Encodes the `overall_status` rules from the IQC system prompt (pass / requires_input / blocking) as code. |
| `calibration_rule_consistency_lens` | 02 (lens) | Encodes the lens classifier's calibration table (0.9–1.0 = no competing lens; <0.8 ⇒ name competitors) as deterministic code. |
| `confidence_calibration_lens` | 02 (lens) | Semantic counterpart to the above: judges whether the chosen confidence band is justified by the evidentiary state and the agent's competitor-lens analysis. |
| `intent_vs_artifact_scope_audit` | 02 (lens) | Specific to meta-recursive intents ("execute the attached spec"); detects unflagged inheritance of lens from artefact. |
| `release_balance_audit` (renamed from `pillar_balance_audit`) | 08 (release plan) | Specific to release-plan structure; operates over the approved Release Plan. Canonical janumicode term is Release (`docs/janumicode_spec_v2.3.md` §2). Decision locked in `deferred_to_track_d.md` §6.1. |

Outliers cluster in two groups: orchestrator role-specific contracts (IQC, lens, release-plan) where the contract has structural rules that demand bespoke deterministic encoding, and Hestami-specific structural concepts (pillars) that may or may not generalise to other products.

---

## 7. Applicability matrix

Rows = canonical validators (grouped by family). Columns = the 12 sampled `(agent_role, sub_phase)` pairs in display-code order. Cells: `✓` applies / `▲` parameter-varied / `—` does not apply / `Δ` deactivated-after-this-pass / `*` applies but conditionally (regex / context prefilter).

Sample column headers (all reference `phaseManifest.ts`):

- **S01** — orchestrator / intent_quality_check (1.1)
- **S02** — orchestrator / intent_lens_classification (1.2)
- **S03** — domain_interpreter / product_intent_discovery (1.3.1)
- **S04** — domain_interpreter / compliance_retention_discovery (1.3.3)
- **S05** — domain_interpreter / business_domains_bloom (1.5)
- **S06** — domain_interpreter / user_journey_bloom (1.6)
- **S07** — domain_interpreter / product_description_synthesis (1.11)
- **S08** — orchestrator / release_plan (1.13)
- **S09** — requirements_agent / fr_bloom_skeleton (2.1.1)
- **S10** — requirements_agent / fr_bloom_enrichment (2.1.2)
- **S11** — requirements_agent / nfr_bloom_skeleton (2.2.1)
- **S12** — requirements_agent / nfr_bloom_enrichment (2.2.2)

### 7.1 Universal cross-role family

| Validator | S01 | S02 | S03 | S04 | S05 | S06 | S07 | S08 | S09 | S10 | S11 | S12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `contract_schema_validator` | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ | ▲ |
| `grounding_validator` | ▲ | ▲ | ▲ | ▲ | — | — | ▲ | * | ▲ | ▲ | ▲ | ▲ |
| `reasoning_to_response_faithfulness` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `open_question_vs_decided` | — | — | ✓ | ✓ | ✓ | ✓ | ▲ | ▲ | * | * | * | * |
| `output_substantiveness_check` | — | — | — | — | — | — | — | — | — | — | — | ✓ |
| `reasoning_quality_validator` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `assumption_citation_validator` | — | — | ▲ | ▲ | — | — | — | — | ▲ | ▲ | ▲ | ▲ |
| `final_synthesis` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 7.2 Discovery-class family

| Validator | S03 | S04 | (1.0c proj) | (1.0e proj) | (1.0f proj) |
|---|---|---|---|---|---|
| `scope_boundary_adherence_*` | ▲ | ▲ | ▲ | ▲ | ▲ |
| `extraction_id_traceability` | ✓ | ▲ | ✓ | ✓ | ? |
| `external_reference_handling` | ✓ | ✓ | * | * | * |
| `regime_citation_validity` | — | ✓ | — | — | — |
| `retention_threshold_grounding` | — | ✓ | — | — | — |
| `compliance_signal_completeness` | — | ✓ | — | — | — |

Bloom-class and synthesis-class samples deactivate the discovery-class family entirely (samples 05, 06, 07, 08 firm the `scope_boundary_adherence_*` exclusion).

### 7.3 Bloom-class family

| Validator | S05 | S06 |
|---|---|---|
| `source_attribution_grounding` | ✓ | ▲ |
| `persona_id_continuity` | ✓ | ✓ |
| `bloom_completeness_vs_thinking` | ✓ | ✓ |
| `entity_workflow_shape` | ✓ | — |
| `pillar_domain_alignment` | * | — |
| `domain_persona_coherence` | ✓ | — |
| `journey_id_continuity` | — | ✓ |
| `surface_attribution_completeness` | — | ✓ |
| `workflow_journey_separation` | — | ✓ |
| `step_completeness_and_automatable` | — | ✓ |
| `acceptance_criteria_measurability` | — | ✓ |
| `persona_journey_coupling` | — | ✓ |
| `domain_journey_coupling` | — | ✓ |
| `phase_journey_alignment` | — | ▲ |

### 7.4 Synthesis-class family (cross-role-promoted)

| Validator | S07 | S08 | (Phase-2 arch handoff proj) | (Phase-4 NFR handoff proj) |
|---|---|---|---|---|
| `synthesis_coverage_audit` | ✓ | ▲ | ✓ | ✓ |
| `synthesis_fabrication_check` | ✓ | ✓ | ✓ | ✓ |
| `handoff_field_completeness` | ✓ | ✓ | ✓ | ✓ |
| `compression_fidelity_audit` | ✓ | ▲ | ✓ | ✓ |
| `phasing_dependency_consistency` | ⊘ vacuous | (split) | ? | ? |
| `wave_dependency_topology` | — | ✓ | ? | ? |
| `compliance_sequencing_audit` | — | ✓ | ? | ? |
| `mvp_credibility_check` | — | ✓ | ? | ? |
| `release_balance_audit` | — | ✓ | ? | ? |

### 7.5 Requirements-class family

| Validator | S09 (FR-skel) | S10 (FR-enr) | S11 (NFR-skel) | S12 (NFR-enr) | (Saturation proj) |
|---|---|---|---|---|---|
| `contract_schema_skeleton` / `_enrichment` | ▲ | ▲ | ▲ | ▲ | ▲ |
| `story_structural_completeness` | ✓ | Δ | — | — | Δ |
| `nfr_structural_completeness` | — | — | ✓ | Δ | Δ |
| `handoff_coverage_audit` | ✓ | Δ | ✓ | Δ | ✓ |
| `fr_trace_pollution_check` | — | — | ✓ | ▲ | ✓ |
| `enrichment_echo_invariance` | — | ✓ | — | ✓ | — |
| `ac_count_discipline` | — | ✓ | — | Δ | ✓ |
| `output_substantiveness_check` | — | — | — | ✓ | ✓ |
| `exemplar_leakage_detector` | — | ✓ | — | ✓ | ✓ |
| `source_attribution_grounding` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `story_shape_conformance` | ✓ | Δ | — | — | Δ |
| `nfr_shape_conformance` | — | — | ✓ | Δ | Δ |
| `threshold_presence_check` | — | — | ✓ | ▲ | ✓ |
| `quality_attribute_taxonomy_alignment` | — | — | ✓ | ✓ | ✓ |
| `pass_scope_discipline` | ✓ | ▲ | ✓ | ▲ | ▲ |
| `measurement_adequacy_validator` | ▲ (consistency-only) | ✓ (FULL) | ▲ (consistency-only) | ✓ (FULL) | ✓ (FULL) |
| `threshold_grounding_audit` | — | ✓ | — | ✓ | ✓ |
| `measurable_condition_executability` | — | ✓ | — | — | ✓ |
| `measurement_method_executability` | — | — | — | ✓ | ✓ |
| `skeleton_drift_audit` | — | ✓ | — | ✓ | ✓ |
| `tier_decomposition_validator` | — | — | — | — | ✓ |

### 7.6 Role-specific outliers

| Validator | Sole sample where it applies |
|---|---|
| `completeness_evidence_adequacy` | S01 |
| `coherence_evidence_audit` | S01 |
| `status_consistency_iqc` | S01 |
| `calibration_rule_consistency_lens` | S02 |
| `confidence_calibration_lens` | S02 |
| `intent_vs_artifact_scope_audit` | S02 |
| `release_balance_audit` (renamed from `pillar_balance_audit`) | S08 |

---

## 8. Naming + namespacing convention

Adopt one canonical name per validator. Where parametrization differs across roles or passes, encode the variation as a runtime parameter rather than as a sibling validator name.

**Canonical pattern:** `family_name + role_or_pass_qualifier` only when parametrization changes the validator's *applicability rule*, not when it merely varies the schema or claim list.

- Cross-role validators: single name, no qualifier. Examples: `reasoning_to_response_faithfulness`, `grounding_validator`, `final_synthesis`.
- Pass-qualified validators (skeleton vs enrichment differ in *scope*, not just schema): `contract_schema_skeleton` / `contract_schema_enrichment` retained with qualifier in code. Note: these are *runtime parametrizations of a single implementation*; the qualifier is a label in the registry.
- Family-qualified validators (sibling carve-outs): `scope_boundary_adherence_discovery` for the family; `scope_boundary_adherence_compliance` is a parameter variation (not a separate implementation).
- FR/NFR symmetric pairs: `measurable_condition_executability` (FR) vs `measurement_method_executability` (NFR). These are genuinely different unit-of-analysis (per-AC vs per-method-string) and warrant separate names.

**Synonym-resolution table** (catalog name on the left; assessment-local synonyms on the right):

| Canonical name | Synonyms across assessments |
|---|---|
| `contract_schema_validator` | `contract_schema_iqc`, `contract_schema_lens`, `contract_schema_discovery`, `contract_schema_compliance`, `contract_schema_bloom`, `contract_schema_synthesis`, `contract_schema_release_plan`, `contract_schema_skeleton`, `contract_schema_enrichment`, `contract_schema_nfr_skeleton`, `contract_schema_enrichment_nfr` |
| `grounding_validator` | `grounding_iqc`, `rationale_grounding_lens`, `grounding_discovery`, `grounding_compliance`, `grounding_synthesis` |
| `source_attribution_grounding` | (consistent across samples 05/06/09/10/11/12; do not collapse with `grounding_validator` — different unit of analysis) |
| `reasoning_to_response_faithfulness` | (consistent; never abbreviate) |
| `open_question_vs_decided` | `open_question_resolution_discipline` (sample 07/08 variant) |
| `assumption_citation_validator` | `extraction_id_traceability` (discovery-pass collapse), trace-only collapse at skeleton/enrichment |
| `phasing_dependency_consistency` | `wave_dependency_topology` + `compliance_sequencing_audit` (post-split heirs at sample 08) |
| `measurable_condition_executability` / `measurement_method_executability` | distinct names; do not unify |

---

## 9. Per-validator canonical prompt templates

All LLM validator prompts inherit the **revised positive-mission shared envelope** from `redesign recommendations - 1.md` (end of document, "Revised shared review envelope"). Reproduced once below; subsequent templates reference it.

### 9.0 Shared review envelope (positive-mission form)

```text
You are a specialized verifier in a governed software engineering workflow.

Your task is to review the provided agent output for one narrow class of defects,
defined by this validator's assigned scope.

Operate as an evidence-focused reviewer:
- Inspect only the fields and claims relevant to your assigned scope.
- Report findings only when they could affect correctness, grounding, measurability,
  governance, downstream automation, or auditability.
- Anchor every finding to an exact output location, quoted span, field path, child ID,
  or acceptance criterion ID.
- Prefer a small number of high-signal findings over exhaustive commentary.
- Use severity according to operational impact, not wording preference.
- When a claim is unsupported, identify the unsupported span and the missing source
  support.
- When a condition is inadequate, explain how it could pass while the stated
  requirement remains false.
- When an issue belongs to another validator, leave it for that validator unless it
  directly affects your assigned scope.

Scope boundary:
- Style preferences, tone, minor wording choices, and alternative-but-valid designs
  are out of scope.
- Rewriting the agent output is out of scope unless the output schema asks for a
  recommended correction shape.
- Inventing missing requirements, standards, thresholds, or citations is out of scope.
- Expanding the review beyond the assigned validator role is out of scope.

Return a single valid JSON object as the entire response.
The response begins with "{" and ends with "}".
No markdown fences, headings, commentary, or trailing prose.
```

### 9.1 Universal cross-role validators

#### `contract_schema_validator` (deterministic)

Implemented in TypeScript over a role-keyed schema registry. No prompt. Output JSON contract:

```json
{
  "validator": "contract_schema_validator",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "invalid_json" | "missing_required_field" | "wrong_enum"
            | "branch_rule_violation" | "duplicate_id" | "id_prefix_violation"
            | "broken_reference" | "format_violation" | "internal_inconsistency",
      "location": "exact field path",
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

Severity rule: parse failure / branch-rule violation / Boolean-gate inconsistency ⇒ HIGH; missing optional field ⇒ MEDIUM; cosmetic format violation ⇒ LOW.

#### `grounding_validator` (LLM)

Use the original ChatGPT-5.5 §2 template. Per-role parameter is `[CLAIMS TO CHECK]` — see source assessments for role-specific claim lists (sample 02 §4.3 for lens, sample 03 §4.3 for discovery, sample 04 §4.3 for compliance, sample 10 §4.7 for FR enrichment, sample 12 §4.7 for NFR enrichment).

Output JSON:

```json
{
  "validator": "grounding_validator",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "unsupported_claim" | "contradicted_claim"
            | "partially_supported_claim" | "fabricated_entity"
            | "fabricated_workflow" | "fabricated_authority"
            | "unsupported_threshold" | "unsupported_endpoint"
            | "ungrounded_instrument",
      "claim": "exact span",
      "location": "field path",
      "groundingStatus": "SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED|CONTRADICTED",
      "sourceEvidence": [
        {"sourceSpan": "...", "relationship": "supports|contradicts|does_not_support|partial"}
      ],
      "detail": "...",
      "recommendation": "Remove, weaken, mark as open question, or cite the correct source."
    }
  ],
  "overallAssessment": "..."
}
```

#### `reasoning_to_response_faithfulness` (LLM)

```text
[MISSION]
Identify cases where the agent's thinking chain documents a candidate finding,
rule-commitment, or decision that the final response either contradicts or
silently drops without justification.

[IN-SCOPE — markers in the thinking chain]
- Enumerate-then-drop: "Maybe this is a … warning", "I'll stick to [] unless …",
  "I will not treat it as", "Should I include this? … I'll skip it." — observation
  raised then suppressed.
- Rule-commitment-then-violation: "I will use single quotes", "I will leave X empty",
  "Let me re-check" — agent commits to a rule then violates it in the response.
- Reversed decision: chain commits to value V₁; response uses V₂.
- High-oscillation regions: chain pivots ≥3 times on the same item before settling
  on a value not anchored to substrate (sample 08 §4.11 marker pattern).
- Faithful_to_wrong_rule: agent commits to a rule and respects it, but the rule
  contradicts an upstream contract (sample 05's persona-ID mutation case).
- Dropped commitment: chain plans N items; response emits M ≠ N (sample 09's
  US-028/029/030 case).

[OUT OF SCOPE]
- Findings the agent considered and rejected with explicit reference to a system-
  prompt rule that excludes them (those drops ARE justified).
- Stylistic deliberation that does not affect the final answer.
- Cost-of-thought / reasoning-chain pathology (handled by reasoning_quality_validator).

[DECISION STANDARD]
A finding is valid when:
1. the thinking chain enumerates a concrete observation, rule-commitment, or
   decision drawn from substrate or system-prompt rules, AND
2. the final response either contradicts, omits, or drops it, AND
3. the agent did not anchor the omission/contradiction to a system-prompt rule
   that excludes it.

[SEVERITY RULE]
- HIGH: dropped commitment changes coverage or breaks the spine; agent commits
  to correct rule and response violates it on a load-bearing field.
- MEDIUM: rule-commitment-then-violation on a non-load-bearing field;
  reversed decision on a numeric value.
- LOW: stylistic deliberation that did not change correctness.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source / handoff context: {{SOURCE_CONTEXT}}
Agent thinking chain: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "reasoning_to_response_faithfulness",
  "passed": true | false,
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "type": "enumerate_then_drop_unjustified" | "rule_commitment_violation"
            | "reversed_decision" | "faithful_to_wrong_rule"
            | "dropped_commitment" | "high_oscillation_unanchored",
      "thinkingSpan": "exact quoted thinking-chain span",
      "responseLocation": "field/path that should have reflected it",
      "promptRuleNotInvoked": "which system-prompt rule would have admitted it (if any)",
      "detail": "...",
      "recommendation": "..."
    }
  ],
  "overallAssessment": "..."
}
```

#### `open_question_vs_decided` (LLM)

```text
[MISSION]
Confirm the agent does not commit a resolution to a question it simultaneously
surfaces as open, and that no requirement, decision, constraint, or success metric
introduces a numeric or quasi-numeric threshold the substrate does not support.

[IN-SCOPE]
- Pairwise semantic comparison between every open-question entry (openQuestions[],
  openLoops[], OPEN_QUESTION-typed extracted items, traces_to[]Q-* references) and
  every decision/requirement/constraint/AC/threshold entry. Identify pairs where
  the open question is, in effect, answered by the decided item.
- Detection of threshold-bearing language in any non-openQuestions array:
  percentages, time windows, frequencies, monetary amounts, completion rates,
  ratios, retention periods.

[DECISION STANDARD]
- An openQuestion's text and a decision/requirement/constraint's text, read as
  natural language, address the same product-decision space and the
  decision/requirement asserts a specific resolution.
- A threshold appears in a non-openQuestions array, is not directly attested in
  source, and is not paired with an openQuestion that flags the threshold as
  tentative.

[SEVERITY GUIDE]
- HIGH: openQuestion answered by a decision in the same response; threshold
  committed in requirements/constraints without source grounding.
- MEDIUM: threshold in successMetrics without grounding; release-shape
  vocabulary ("MVP", "v1.0") not committed by source.
- LOW: openQuestion partially addressed but not fully resolved.

[INPUTS]
Original prompt: {{ORIGINAL_PROMPT}}
Source intent: {{SOURCE_CONTEXT}}
Agent thinking: {{AGENT_REASONING}}
Agent final response: {{AGENT_FINAL_RESPONSE}}

[OUTPUT CONTRACT]
{
  "validator": "open_question_vs_decided",
  "passed": true | false,
  "findings": [...],
  "overallAssessment": "..."
}
```

#### `output_substantiveness_check` (deterministic)

Pseudocode contract — see sample 12 §4.3 for full specification. Floors per pass: minimum string length, presence of measurable-predicate token, presence of instrument-token (NFR enrichment), presence of cadence-token, non-echo-of-seed.

#### `reasoning_quality_validator` (LLM)

Use the original ChatGPT-5.5 §6 template verbatim. Narrowed jurisdiction: runs **after** the narrower validators and reports patterns rather than per-defect repeats.

#### `assumption_citation_validator` (LLM)

Use the original ChatGPT-5.5 §5 template. Per-pass collapse rule: at passes without a `surfaced_assumptions[]` field, the validator collapses to its citation half (`extraction_id_traceability` shape). Mission becomes: verify every `traces_to[]` / citation entry resolves to a real handoff id and is non-duplicative.

#### `final_synthesis` (LLM)

Use the original ChatGPT-5.5 §7 template. Decision policy adapted to advisory mode (sample 12 §4.16 worked example). Decision values: ACCEPT, ACCEPT_WITH_NOTES, REVISE, QUARANTINE, ESCALATE.

### 9.2 Discovery-class validator templates

#### `scope_boundary_adherence_*` (LLM, parameter family)

Sample 03 §4.4 + sample 04 §4.4 give the canonical form. Parameters per pass:
- `current_pass_id` (e.g. "1.0d Compliance & Retention")
- `positive_list` (the kinds of items in-scope for THIS pass)
- `sibling_layer_table` (the kinds of items in-scope for sibling passes — the negative list)

The positive-list addition (introduced at sample 04) is load-bearing: a domain-header / capability-label is evidence for a DECISION + paired OPEN_QUESTION, not a CONSTRAINT.

#### `extraction_id_traceability` (deterministic)

Sample 03 §4.2. Pass-specific: ID prefix registry (`P-`, `UJ-`, `DOM-`, `REQ-`, `DEC-`, `CON-`, `Q-`, `COMP-`, `VV-`, `TECH-`, `QA-`); cross-array reference graph; uniqueness within array.

#### `external_reference_handling` (LLM)

Sample 03 §4.5. Detects when source defines product scope by reference to an external company / product and verifies the agent surfaces the reference as `decisions` and/or `openQuestions` rather than absorbing the appendix's content directly. Parameter-free; fires on company-name-list ∪ pattern-list ("like X", "see Y appendix", "similar to Z").

#### `regime_citation_validity`, `retention_threshold_grounding`, `compliance_signal_completeness`

Compliance-class only. See sample 04 §4.5–4.7 for full templates. Hook list for `compliance_signal_completeness` (HOA/POA Acts, W-9/1099, PCI/payments, ESIGN/UETA, audit-trail/immutable, multi-tenant/RLS, data residency, governance audit-trail, named regimes).

### 9.3 Bloom-class validator templates

#### `source_attribution_grounding` (LLM)

Sample 05 §4.3. Mission: verify every bloom item's `source` tag (`user-specified` / `document-specified` / `domain-standard` / `ai-proposed`) accurately reflects its relationship to source. The bloom is a synthesis pass — the agent is licensed to propose; not licensed to mislabel propositions as extractions.

Parameter variations:
- Sample 06: extends to scan `surfaces` arrays per journey (compliance / retention / V&V / integration). The journey case demonstrates that the validator must scan **secondary** attribution surfaces, not just the primary `source` field.
- Sample 09–12: rotates unit-of-analysis to per-AC anchor or per-(threshold, method) anchor.

#### `persona_id_continuity`, `journey_id_continuity` (deterministic)

Samples 05 §4.2, 06 §4.3. Compare upstream IDs to output IDs; flag drift, drops, fabricated tags. Auto-recovery for cosmetic mutations (underscore↔hyphen) is recommended at the harness level (sample 06 §6.4).

#### `bloom_completeness_vs_thinking` (LLM)

Sample 05 §4.6. Permitted-rejection patterns: "duplicates an existing item" / "not implied by source" / "would conflict with [contract rule]". Forbidden-rejection patterns: "low priority" / "future scope" / "too niche" / "covered by [X]" without showing coverage / "let's keep it tighter" / "let's stick to the core".

#### `entity_workflow_shape` (deterministic + LLM fallback)

Sample 05 §4.7. Heuristic-based deterministic check; LLM fallback for items the heuristic flags but might be legitimate.

#### `pillar_domain_alignment` / `phase_journey_alignment` (LLM-or-deterministic)

Samples 05 §4.4, 06 §4.11. Verify source-named organising concepts (pillars / phases) are represented somewhere in the bloom output: super-domain entries, parent/membership field, separate top-level array, or consistent rationale-annotation across ≥80% of items.

#### `domain_persona_coherence` / `persona_journey_coupling` / `domain_journey_coupling` (LLM)

Samples 05 §4.5, 06 §4.6, 06 §4.7. Bidirectional coverage checks; detect orphan/actorless/unanchored items; honest `unreached_*` accounting.

#### `surface_attribution_completeness`, `workflow_journey_separation`, `step_completeness_and_automatable`, `acceptance_criteria_measurability`

Journey-bloom-specific. Sample 06 §4.5–4.10. Note that `acceptance_criteria_measurability` is a candidate for cross-role generalisation to any AC-emitting pass.

### 9.4 Synthesis-class validator templates

#### `synthesis_coverage_audit` (LLM)

Sample 07 §4.3. For each multi-item set in the substrate, build a coverage matrix: SURVIVED_NAMED / SURVIVED_IMPLICIT / DROPPED_SILENT. Coverage defect when DROPPED_SILENT > 30% of items, OR when a load-bearing item dropped, OR when an entire substrate set is absent.

#### `synthesis_fabrication_check` (LLM)

Sample 07 §4.4. Confirm every noun phrase, named concept, framing metaphor, and claim traces to substrate. Classify as SUPPORTED / PARTIALLY_SUPPORTED / REFRAMED / FABRICATED. Reframings (brokerage → integration; autonomy → governance-autonomy) are MEDIUM; fabricated metaphors LOW; amplifying adjectives LOW.

#### `handoff_field_completeness` (deterministic + LLM)

Sample 07 §4.2. Field-purpose-met check per required handoff field. Deterministic prefilter for presence and length; LLM follow-up for purpose-met.

#### `compression_fidelity_audit` (LLM)

Sample 07 §4.5 + sample 08 §4.5. Identify load-bearing nuance preserved / partially preserved / lost. Load-bearing concepts extracted from substrate's seed vision + bloom summary (concepts surviving four prunes are load-bearing by construction).

#### `wave_dependency_topology` (LLM-or-deterministic)

Sample 08 §4.6. DAG correctness on placement. Edge-extraction guidance: read each item's brief for verbs implying preconditions; cross-reference DOM-* descriptions for domain-level precedence. Substrate's phasing strategy hint is a partial order; treat its [Phase N] tags as soft edges.

#### `compliance_sequencing_audit` (LLM)

Sample 08 §4.9. Specialisation of `wave_dependency_topology` anchored to compliance domains (DOM-COMPLIANCE, DOM-LEDGER, DOM-IDENTITY, DOM-AUDIT, DOM-FINANCE). Severity HIGH on regulatory back-edges; preferred over `wave_dependency_topology` on regulated edges via dedup rule.

#### `mvp_credibility_check` (LLM)

Sample 08 §4.8. Verify REL-1 (the substrate's "minimum viable" wave) is self-contained: every demand-side journey has corresponding supply-side, OR an explicit out-of-band fulfilment mechanism recorded in rationale.

#### `release_balance_audit` (LLM, renamed from `pillar_balance_audit`)

Sample 08 §4.7. Operates over the approved Release Plan. The original sample-08 prompt body referred to "pillars"; for the canonical implementation, replace "pillar" with "release" throughout — Release is the canonical janumicode organising-unit (`docs/janumicode_spec_v2.3.md` §2 explicitly lists "pillar" as a non-canonical synonym for Release). Mission: detect Release-level balance defects (one Release stranding all of a persona's journeys; one Release concentrating disproportionate risk; Releases with no demand-side journeys). Decision locked in `deferred_to_track_d.md` §6.1.

### 9.5 Requirements-class validator templates

#### Skeleton-pass templates

Sample 09 §4 (FR), sample 11 §4 (NFR). Key validators:
- `contract_schema_skeleton` (det) — sample 09 §4.1, 11 §4.1
- `story_structural_completeness` (det) — sample 09 §4.2 (FR only)
- `nfr_structural_completeness` (det) — sample 11 §4.2 (NFR only)
- `handoff_coverage_audit` (det) — sample 09 §4.3 (spine = UJ-set for FR, V&V ∪ material-COMP for NFR)
- `fr_trace_pollution_check` (det) — sample 11 §4.3 (NFR only — no US-*/AC-* in traces_to)
- `story_shape_conformance` (LLM) — sample 09 §4.5
- `nfr_shape_conformance` (LLM) — sample 11 §4.4
- `pass_scope_discipline` (LLM) — sample 09 §4.6, 11 §pass_scope_discipline
- `threshold_presence_check` (LLM) — sample 11 §4.5 (NFR only)
- `quality_attribute_taxonomy_alignment` (LLM) — sample 11 §4.6 (NFR only)
- `measurement_adequacy_validator` (LLM, **CONSISTENCY-ONLY at this pass**) — sample 09 §4.8, 11 §4.x

#### Enrichment-pass templates

Sample 10 §4 (FR), sample 12 §4 (NFR). Key validators (shared across FR/NFR with parameter variation):
- `contract_schema_enrichment` (det) — sample 10 §4.1, 12 §4.1
- `enrichment_echo_invariance` (det) — sample 10 §4.2, 12 §4.2 (subsumes three skeleton validators)
- `ac_count_discipline` (det, FR only) — sample 10 §4.3
- `output_substantiveness_check` (det, NFR enrichment introduces; cross-role candidate) — sample 12 §4.3
- `exemplar_leakage_detector` (det) — sample 10 §4.4, 12 §4.4
- `threshold_grounding_audit` (LLM, FULL ORIGINAL SCOPE) — sample 10 §4.6
- `measurement_adequacy_validator` (LLM, **FULL ORIGINAL ChatGPT-5.5 SCOPE — centerpiece**) — sample 10 §4.8, 12 §4.8
- `measurable_condition_executability` (LLM, FR) — sample 10 §4.9
- `measurement_method_executability` (LLM, NFR) — sample 12 §4.9
- `skeleton_drift_audit` (LLM) — sample 10 §4.10, 12 §4.10
- `pass_scope_discipline` (LLM, Pass-2 boundary) — sample 10 §4.11, 12 §4.11

#### Saturation-pass templates

Use the **original ChatGPT-5.5 templates verbatim** from `redesign recommendations - 1.md`:
- §1 contract_schema (with full saturation schema: tier, parent_branch_classification, decomposition_rationale)
- §2 grounding (full original scope)
- §3 measurement_adequacy (full eleven-pattern battery + saturation-specific patterns)
- §4 tier_decomposition (engages here for the first time)
- §5 assumption_citation (full form — surfaced_assumptions[] active)
- §6 reasoning_quality
- §7 final_synthesis

The original document is preserved as the canonical saturation-pass reference; its retirement plan is in `deferred_to_track_d.md` §5.

### 9.6 Role-specific outlier templates

#### IQC outliers (sample 01)

- `completeness_evidence_adequacy` (LLM) — sample 01 §4.4
- `coherence_evidence_audit` (LLM) — sample 01 §4.5
- `status_consistency_iqc` (det) — sample 01 §4.2

#### Lens outliers (sample 02)

- `calibration_rule_consistency_lens` (det) — sample 02 §4.2
- `confidence_calibration_lens` (LLM) — sample 02 §4.4
- `intent_vs_artifact_scope_audit` (LLM) — sample 02 §4.5

#### Release-plan outlier (sample 08)

- `release_balance_audit` (LLM, renamed from `pillar_balance_audit`) — sample 08 §4.7

---

## 10. Cross-validator deduplication summary

When multiple validators fire on the same span, apply the precedence rules from each per-role assessment's §5.4:

| Overlap pair | Primary | Secondary | Rationale |
|---|---|---|---|
| `grounding_validator` (UNSUPPORTED) ∧ `scope_boundary_adherence_*` (drift) | scope_boundary | grounding (corroborating) | Boundary finding is more actionable (names the receiving sibling pass). |
| `grounding_validator` (UNSUPPORTED) ∧ `regime_citation_validity` | regime_citation | grounding | Regime channel is more specific. |
| `grounding_validator` (UNSUPPORTED) ∧ `retention_threshold_grounding` | threshold | grounding | More specific channel. |
| `grounding_validator` (UNSUPPORTED) ∧ `threshold_grounding_audit` | threshold | grounding | More specific channel. |
| `compliance_signal_completeness` (regime_hook) ∧ `regime_citation_validity` (named_regime_not_extracted) | regime_citation | signal_completeness | Named regimes are more specific than hooks. |
| `wave_dependency_topology` ∧ `compliance_sequencing_audit` (same back-edge) | compliance_sequencing on regulated edges; topology on non-regulated | (other) | Severity ladder differs. |
| `mvp_credibility_check` ∧ `wave_dependency_topology` (REL-1 back-edge) | mvp_credibility | topology | User-experience framing primary. |
| `synthesis_fabrication_check` ∧ `grounding_synthesis` (same span) | fabrication on claim level; grounding on item-attribution level | (other) | Different units of analysis. |
| `synthesis_coverage_audit` ∧ `compression_fidelity_audit` | coverage on per-item drop; fidelity on aggregate distinction-collapse | (other) | Complementary, not overlapping. |
| `measurable_condition_executability` ∧ `measurement_adequacy_validator` | (run both; let final_synthesis dedupe) | (other) | Different abstraction levels — sample 10 §6.4 design choice. |
| `enrichment_echo_invariance` ∧ skeleton-shape validators | echo_invariance | (skeleton-shape deactivated) | echo_invariance subsumes at enrichment. |
| `open_question_vs_decided` ∧ `reasoning_to_response_faithfulness` (open-question-as-decision) | independent | (independent) | Response-level vs reasoning-trace-level — track separately. |

`final_synthesis` consumes all validator findings and applies these rules to produce the consolidated decision.
