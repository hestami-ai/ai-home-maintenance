# Assessment: systems_agent / interface_contracts (Phase 3.3)

**Sample**: `track_c_samples/17_systems_agent__interface_contracts.md`
**Reviewed agent**: systems_agent running qwen3.5:9b (NEW role to Track C)
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (5 generic validators); systems_agent / Phase 3 NOT in DISPATCH_BUNDLES at cal-26 time
**Harness outcome**: QUARANTINE — 4 HIGH

---

## 1. What this sample reveals

Phase 3.3 tasks the agent with specifying Interface Contracts for every External System and between internal components. The prompt provides a 38-item system list (TECH-*, INT-*, EXT-SYS-*) with an invariant: "Every External System must have at least one Interface Contract." This is a strict enumeration task — a finite ID set in, a structured contract array out — mapping cleanly to **discovery-class** per catalog §0. This confirms the family-mapping revision from assessment 15: systems_agent → discovery-class for all Phase 3 sub-phases. The deferred_to_track_d §1 "anticipated bloom-class + synthesis-class" hypothesis is not supported by any of the three Phase 3 samples.

This sample surfaces two distinct defect classes: (1) the shared Phase 3 completeness-gap (three system IDs silently dropped despite an explicit thinking-chain commitment to cover all 39), and (2) ungrounded architectural commitments — the agent embedded specific implementation choices (auth mechanisms, error strategies, wire protocols) not attested in the source context. QUARANTINE is warranted because the second defect class means the output cannot be consumed downstream without fabricated specifics being stripped. Cross-link to assessments 15 and 16: completeness-gap is shared across all Phase 3 sub-phases; the ungrounded-commitment class is unique to Phase 3.3's structured implementation-commitment schema fields.

---

## 1a. Defects in the agent's response

**Finding 1 — grounding_validator (HIGH): Ungrounded architectural commitments.**  
Contracts embed specific implementation details the source context does not provide: `CONTRACT-STORAGE-005` specifies `auth_mechanism: "AWS SigV4"` (SeaweedFS is in context; AWS SigV4 is not attested); `CONTRACT-FINANCE-008` specifies `error_handling_strategy: "Double-entry Ledger on Retry"` (no such strategy is mentioned anywhere in the handoff); `CONTRACT-AI-007` specifies `"TensorFlow/Protobuf"` as data format and `"mTLS"` as auth mechanism (neither grounded); `CONTRACT-INFRA-001` specifies `"Fail-open with Circuit Breaker"` (no source). These are fabricated architectural commitments. Downstream technical spec and implementation planning phases that consume this artifact would inherit and amplify the fabrications. Real finding.

**Finding 2 — reasoning_to_response_faithfulness (HIGH): Dropped commitments from thinking chain.**  
The thinking chain at steps 2–3 explicitly enumerated all 39 system IDs, stated "I need to ensure every ID from that list appears in `systems_involved` of at least one contract," and mapped each ID to a contract group. Despite that explicit commitment, three IDs are absent from all `systems_involved[]` arrays in the final output:
- `INT-SIGNATURE-LEGAL` — no contract
- `TECH-ZOD-1` — no contract (CONTRACT-BACKEND-003 includes TECH-OPRC-1 but not TECH-ZOD-1)
- `INT-BI-PLATFORM` — no contract

Real finding; faithfulness is more precise than Finding 3 because it cross-references the thinking chain.

**Finding 3 — reasoning_quality_validator (HIGH): Failure to cover all listed systems.**  
Same completeness defect from the output side. The validator's detail overestimates the miss set slightly — TECH-EXIFTOOL-1, TECH-LIBCVIDS-1, TECH-CLAMAV-1 are listed as potentially missing but do appear in CONTRACT-STORAGE-005 and CONTRACT-METADATA-006. Precise miss count is three IDs per Finding 2. HIGH severity still warranted — the invariant is violated. Real finding (not a false positive; contrast with sample 13c).

**Finding 4 — final_synthesis (HIGH): QUARANTINE.**  
Three preceding HIGH findings → QUARANTINE per decision policy. Correct aggregation. QUARANTINE appropriate: even the contracts that do achieve coverage contain fabricated specifics.

**Additional defect — harness-missed, LOW: Incoherent grouping.** Several contracts bundle semantically unrelated systems to satisfy coverage (e.g., `CONTRACT-SECURITY-012` pairs `EXT-SYS-005` (KMS) with `TECH-CLAMAV-1` (malware scanner) and `INT-BANK-CONNECT`; no coherent shared protocol exists). Low severity given the primary failures, but a `contract_coherence_check` would flag `systems_involved` groupings with no logical interaction surface.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean — JSON valid, `systems_involved` ≥ 2 and `error_responses` ≥ 1 satisfied per contract |
| `grounding_validator` | Yes (no role-keyed claim list) | HIGH (real) — caught ungrounded auth/error specifics; precision limited by absent claim list |
| `reasoning_to_response_faithfulness` | Yes | HIGH (real) — caught 3 dropped IDs by cross-referencing thinking-chain commitment |
| `reasoning_quality_validator` | Yes (broad scope) | HIGH (real, slight overstatement) — completeness failure confirmed |
| `final_synthesis` | Yes | HIGH — QUARANTINE correct |
| `source_item_enumeration_completeness` | NOT dispatched | Would have produced exact 3-ID miss list vs the LLM-estimated list that over-included 3 items already covered |

**Key contrast:** At Phase 3.3, all placeholder-bundle validators that fired did so on genuine defects. Contrast with 13c (fr_saturation depth 8) where `reasoning_quality_validator` produced a HIGH false positive. The distinction: Phase 3.3's defects are structural omissions and grounding failures that broad-scope LLM validators reliably detect; the 13c false positive was a syntax-legibility judgment the broad-scope validator got wrong without the narrow `measurement_adequacy_validator` to calibrate it.

---

## 2. Validator implications (deltas vs current catalog)

**`source_item_enumeration_completeness`** (deterministic; family-level for Phase 3). For Phase 3.3, `id_match` mode: extract the 38 system IDs from the prompt's "External systems:" section, assert each appears in at least one contract's `systems_involved[]`. Pure set-membership — no LLM. Would have caught: 17/Findings 2 and 3 with exact precision (3 confirmed-missing IDs instead of the 6-item over-inclusive LLM estimate). The `autoFlagDroppedSeeds.ts` (Phase 2.2) is the architectural precedent: compute set difference between input ID set and union of `systems_involved[]` arrays — a pure TypeScript function.

**`implementation_commitment_grounding`** (LLM; role-specific outlier for systems_agent / Phase 3.3). Detects when the agent embeds specific implementation choices — auth mechanisms, wire protocols, error strategies, data formats — not attested in the source context. Distinguished from the general `grounding_validator` by targeting schema fields whose structural position implies implementation commitment (`auth_mechanism`, `error_handling_strategy`, `protocol`, `data_format` in the interface_contracts schema). Parameterized with a claim list of specific technology-name and strategy-name patterns to cross-check against the source context. Would have caught: 17/Finding 1 with greater precision. This defect class is unique to Phase 3.3 in the current corpus (Phases 3.1 and 3.2 contain no analogous implementation-commitment schema fields).

| Validator id | Type | Family | Catches |
|---|---|---|---|
| `source_item_enumeration_completeness` | deterministic (id_match) + LLM (semantic) | Phase 3 family-level | 15/HIGH, 16/HIGH, 17/Findings 2+3 |
| `implementation_commitment_grounding` | LLM | systems_agent / Phase 3.3 role-specific outlier | 17/Finding 1 |

Total unique new validator proposals across assessments 15–17: **2**.
