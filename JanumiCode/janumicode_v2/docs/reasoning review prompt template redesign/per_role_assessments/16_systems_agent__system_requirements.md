# Assessment: systems_agent / system_requirements (Phase 3.2)

**Sample**: `track_c_samples/16_systems_agent__system_requirements.md`
**Reviewed agent**: systems_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); systems_agent / Phase 3 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: REVISE — 1 HIGH + 1 MEDIUM

---

## 1. What this sample reveals

Phase 3.2 tasks the agent with deriving formal System Requirements from the upstream FR/NFR set and allocating them to the system boundary. The required output is `items[]` with `source_requirement_ids` — an explicit traceability array whose prompt invariant is "Every Functional Requirement must map to at least one System Requirement." This is a strict source-to-output enumeration task: a finite set of IDs in, a structured allocation artifact out. That maps cleanly to **discovery-class** per catalog §0, confirming the family-mapping revision from assessment 15: systems_agent → discovery-class across all Phase 3 sub-phases, not bloom-class + synthesis-class as `deferred_to_track_d.md` §1 anticipated. The defect is identical in kind to assessment 15's: the agent chose domain-level grouping over individual-ID enumeration, silently omitting large portions of the ~300-FR source set from `source_requirement_ids[]`. Cross-link to assessments 15 and 17: same completeness-gap defect class across all three Phase 3 sub-phases.

---

## 1a. Defects in the agent's response

- **(HIGH — harness caught) source_requirement_ids enumeration shortcut.** The agent produced 12 SRs (SR-001 through SR-012) grouping FRs by domain. Each SR's `source_requirement_ids` lists only a representative subset. SR-008 (Offline Synchronization) cites only `FR-ACCT-007` and `NFR-012-D` despite numerous offline-sync-related FRs across US-007, US-018, and NFR-012 variants. SR-001 (Property Registry) omits several `FR-UPLOAD-*` sub-IDs related to file validation and workflow state transitions. The invariant "Every Functional Requirement must map to at least one System Requirement" is violated for an unquantified fraction of the ~300 FR/NFR IDs. Caught by `reasoning_quality_validator` as `shortcut_taken`. Real finding.

- **(MEDIUM — final_synthesis)** Correctly escalated to REVISE. Consistent with 1-HIGH → REVISE policy.

- **(LOW — harness-missed) No itemization of uncovered FRs.** The HIGH finding correctly diagnosed the shortcut but offered only a general recommendation. A deterministic `source_item_enumeration_completeness` validator parameterized by the FR ID set would have produced an exact list of IDs not appearing in any `source_requirement_ids[]` array, giving a concrete revision target.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — JSON valid, all required fields (id, statement, source_requirement_ids, priority) present |
| `grounding_validator` | Yes | Clean — SR statements are domain-level paraphrases well-grounded in the system boundary; no fabricated claims |
| `reasoning_to_response_faithfulness` | Yes | Clean — thinking chain acknowledged the "over 300 distinct requirements" problem but made no explicit full-coverage commitment, so no dropped-commitment flag fired |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH (real finding) — `shortcut_taken` correctly identified |
| `final_synthesis` | Yes | MEDIUM — REVISE correct |
| `source_item_enumeration_completeness` | NOT dispatched | Would have produced deterministic per-ID gap report |

**Contrast with sample 13c (fr_saturation depth 8):** `reasoning_quality_validator` misfired there (false positive on valid SQL). At Phase 3.2 it fired correctly — no false positive. `reasoning_to_response_faithfulness` correctly stayed quiet: the agent hedged early in the thinking chain rather than committing to full enumeration (compare to sample 17, where an explicit commitment was made and faithfulness fired).

---

## 2. Validator implications (deltas vs current catalog)

**`source_item_enumeration_completeness`** (deterministic; family-level for Phase 3). For Phase 3.2, `id_match` mode: extract all FR/NFR IDs from the prompt context, assert each appears in at least one item's `source_requirement_ids[]`. Pure set-membership check — no LLM call. Would have caught: 16/HIGH with exact itemization of uncovered FR IDs. This is the Phase 3.2 instance of the same family-level validator proposed in assessment 15 (semantic mode for in_scope freeform text) and assessment 17 (id_match mode against system IDs).

The `autoFlagDroppedSeeds.ts` pattern from Phase 2.2 applies directly: compute set difference between input FR IDs and the union of all `source_requirement_ids[]` arrays — a pure TypeScript function. The LLM's job is writing good SR statements; whether every upstream ID is traced is a code-level assertion. No other new validator families needed for this sample; grounding and faithfulness gaps are addressed by the existing universal bundle (and no ungrounded architectural specifics appear in this sample — contrast sample 17).
