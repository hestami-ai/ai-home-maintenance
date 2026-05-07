# Assessment: architecture_agent / software_domains (Phase 4.1)

**Sample**: `track_c_samples/18_architecture_agent__software_domains.md`
**Reviewed agent**: architecture_agent running qwen3.5:9b (NEW role — first Phase 4 sample in Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle; architecture_agent / Phase 4 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 4 MEDIUM (grounding_validator) + 1 MEDIUM (final_synthesis)

---

## 1. What this sample reveals

Phase 4.1 is an enumeration-and-grounding pass: produce software domains with ubiquitous language terms traceable to the system requirements. The dominant defect class is **over-specification in vocabulary definitions** — the agent introduced mechanism-level specificity (ordering semantics, state transition arcs, algorithm names) that the source SRs do not mandate. This maps squarely to **discovery-class** per catalog §2, the same family as Phase 3's completeness-gap failures, but on a vocabulary-term surface rather than an FR/NFR id set. The `deferred_to_track_d.md` §1 hypothesis of "bloom-class for component blooms" does not apply at Phase 4.1 — software_domains is a bounded extraction/grounding pass, not a novelty bloom. The hypothesis is **revised for this sub-phase to discovery-class**.

Cross-link to assessments 15, 16, 17 (systems_agent): same completeness-gap defect class; different surface (vocabulary terms vs id enumeration). The reversed direction of the defect (over-specification vs omission) is the distinguishing marker of a definition surface vs an id-set surface.

---

## 1a. Defects in the agent's response

- **(MEDIUM — harness caught) DispatchQueue over-specified.** Defined as "the ordered list of field service assignments." SR-002 mandates Dispatch and Estimates; no ordering semantics are mandated. Agent added implementation specificity.

- **(MEDIUM — harness caught) PaymentClearanceState over-specified.** "Transitioning from Pending to Cleared upon gateway integration." SR-004 mentions Payments; no state names are mandated.

- **(MEDIUM — harness caught) CorrelationTraceId over-specified.** SR-007 mandates "tagging admin bypasses" and "data integrity" but does not name a linking mechanism or commit to a specific identifier term with linking behavior.

- **(MEDIUM — harness caught) ConflictResolutionStrategy over-specified.** "The algorithm applied to merge local state deltas." SR-008 implies conflict resolution but does not name the mechanism or commit to algorithm semantics.

- **(LOW — harness-missed) Missing vocabulary coverage.** SR-007 mandates timestamp monotonicity enforcement and WORM configuration — no vocabulary term maps to monotonicity. A `source_item_enumeration_completeness` validator in `vocabulary_grounding` mode would enumerate these gaps.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — schema valid, all required fields present |
| `grounding_validator` | Yes | 4 MEDIUM (real findings — over-specified definitions) |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain grouping matches response |
| `reasoning_quality_validator` | Yes (broad scope) | Clean — no misfire |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `source_item_enumeration_completeness` | NOT dispatched | Would enumerate SR behaviors lacking vocabulary terms (LOW) |

---

## 2. Validator implications (deltas vs current catalog)

**Extend `source_item_enumeration_completeness` to `vocabulary_grounding` mode (discovery-class, new parameterization).** Currently operates in `id_match` mode (Phase 3.2–3.3) and `semantic` mode (Phase 3.1). At Phase 4.1, the bounded input set is the behavioral inventory of each domain's SR(s); the coverage surface is the `ubiquitous_language` terms array. New mode checks bidirectionally: each term definition must trace to at least one mandated behavior, and each mandated behavior cluster should have at least one term. Would have caught: the LOW omission finding. The existing grounding_validator covers over-specification; this extension covers the omission direction. Proposed id: `source_item_enumeration_completeness` (existing, `vocabulary_grounding` mode).

**`architecture_agent` role-mapping update.** `deferred_to_track_d.md` §1 hypothesis ("bloom-class for component blooms") is **revised for Phase 4.1 to discovery-class**. Revised working hypothesis across Phase 4: architecture_agent is discovery-class at sub-phases that enumerate/ground from bounded inputs (4.1, 4.3) and bloom-class at sub-phases that generate coverage from a component set (4.2).
