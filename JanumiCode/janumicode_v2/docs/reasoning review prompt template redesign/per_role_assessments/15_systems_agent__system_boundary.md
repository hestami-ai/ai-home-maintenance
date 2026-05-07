# Assessment: systems_agent / system_boundary (Phase 3.1)

**Sample**: `track_c_samples/15_systems_agent__system_boundary.md`
**Reviewed agent**: systems_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); systems_agent / Phase 3 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 1 HIGH + 1 MEDIUM

---

## 1. What this sample reveals

Phase 3.1 tasks the agent with receiving the upstream FR list, confirmed intent, and constraints, then emitting `in_scope` / `out_of_scope` / `external_systems`. This is a strict enumeration/extraction shape: verify every source FR is reflected in `in_scope` and every out-of-scope declaration matches the intent. That maps squarely to **discovery-class** per catalog §0 — not bloom-class or synthesis-class as `deferred_to_track_d.md` §1 anticipated. Discovery-class is characterized by a strict source positive-list against which the output is checked; the dominant defect is silent omission of source items. That is precisely what occurred: the agent copied the pre-computed 12-item boundary summary verbatim from context into `in_scope` rather than verifying individual FR coverage. The deferred_to_track_d "anticipated bloom-class + synthesis-class" hypothesis is **revised to discovery-class** for all three Phase 3 sub-phases. Cross-link to assessments 16 and 17: same completeness-gap defect class across all Phase 3 sub-phases.

---

## 1a. Defects in the agent's response

- **(HIGH — harness caught) in_scope completeness gap.** The agent's `in_scope` array is a verbatim echo of the "In scope" section already present in the context — 12 domain-level strings, no FR-level enumeration. The prompt invariant is "in_scope must cover all Functional Requirements." Multiple NFR-level capabilities are absent: WORM-mode enforcement (NFR-023.3-1.1), mandatory pre-response audit log write (NFR-021-2.1.1), statutory compliance rule enforcement (US-009.*, US-023.*). Caught by `reasoning_quality_validator` as `ignored_instructions`. Real finding, not a false positive.

- **(MEDIUM — final_synthesis)** Correctly escalated to REVISE. No independent defect; consistent with 1-HIGH → REVISE policy.

- **(LOW — harness-missed) No precision on missing FRs.** The HIGH finding diagnosed incompleteness but listed only two example NFR IDs. A deterministic `source_item_enumeration_completeness` validator would enumerate every FR/NFR ID not semantically covered, giving an actionable revision target.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean |
| `grounding_validator` | Yes | Clean — agent copied source text faithfully, no fabricated claims |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain made no explicit coverage commitment |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH (real finding) — incomplete in_scope coverage |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `source_item_enumeration_completeness` | NOT dispatched | Would have deterministically listed which FR/NFR IDs lack in_scope coverage |

**Contrast with sample 13c (fr_saturation depth 8):** there, `reasoning_quality_validator` misfired HIGH on valid SQL (false positive). At Phase 3.1 the same validator fired on a genuine incompleteness defect. The placeholder bundle is directionally reliable here; it lacks precision, not signal.

---

## 2. Validator implications (deltas vs current catalog)

**`source_item_enumeration_completeness`** (deterministic + LLM hybrid; family-level for all Phase 3 sub-phases). Parameterized by `source_item_set` (FR ID list from prompt context) and `coverage_mode`: `semantic` for Phase 3.1 (in_scope items are freeform text — LLM verifies each FR domain is semantically covered by at least one in_scope entry) vs `id_match` for Phases 3.2 and 3.3 (explicit ID arrays, pure set-membership check). Would have caught: 15/HIGH with exact itemization of missing coverage. The `autoFlagDroppedSeeds.ts` (Phase 2.2) establishes the architectural precedent: enumeration discipline is a deterministic concern, not an LLM concern. A single family-level validator parameterized per sub-phase replaces three role-specific copies. No other new validator families are needed for this sample.
