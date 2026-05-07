# Assessment: requirements_agent / fr_saturation (Phase 2.1.4)

**Samples**: `track_c_samples/13a_requirements_agent__fr_saturation_depth0.md`, `13b_*.md`, `13c_*.md` (depths 0, 4, 8)
**Reviewed agent**: requirements_agent running qwen3.5:9b
**Harness state at sample time**: dispatch fell through to PLACEHOLDER bundle (contract_schema_validator, grounding_validator, reasoning_to_response_faithfulness, reasoning_quality_validator, final_synthesis); fr_saturation NOT in DISPATCH_BUNDLES at cal-26 time
**Aggregate harness outcome**: 13a/13b ACCEPT (1 LOW each — final_synthesis annotation only), 13c REVISE (1 HIGH + 1 MEDIUM)

---

## 1. What this sample reveals

All three samples land in `requirements-class saturation-pass` per `validator_catalog.md` §0 and `deferred_to_track_d.md` §6.8. The ChatGPT-5.5 template hypothesis holds: the three catalog validators the placeholder bundle omits (`tier_decomposition_validator`, `measurement_adequacy_validator` full scope, `assumption_citation_validator` full form) are exactly what would have caught the substantive defects. The placeholder `grounding_validator` ran without the saturation claim list and missed the fabrication in 13c; `reasoning_quality_validator` ran broad-scope and misfired HIGH at depth 8.

Depth stratification is visible and directionally clean: 13a is structurally flat but passable; 13b introduces a mirror-contract violation (silent role rename); 13c introduces a fabricated trace reference. Defect density increases with depth as the agent accumulates sibling context and starts inventing cross-references.

---

## 1a. Defects in the agent's response

### 13a (depth 0) — defects

US-001 correctly classified `decomposable`, parent tier B, 6 Tier-D children, harness clean.

- **(LOW) Non-persona `role` fields.** Children carry system-component labels ("Schema Validator", "Deduplication Engine", etc.) rather than P-* personas. `tier_decomposition_validator` checking the role field would flag this.

- **(LOW) Flat AC-to-child mapping.** Each child is a 1:1 copy of one parent AC. `tier_decomposition_validator` would assess whether `decomposable` is justified when every child mirrors a single parent AC — borderline `atomic_leaf` ×6.

### 13b (depth 4) — defects

FR-UPLOAD-003-A-3.2 correctly classified `atomic_leaf` (hint C → D). Siblings 3.1 (Logic) and 3.3 (Visibility) partition the space; 3.2 is the pure durability leaf.

- **(MEDIUM) Mirror contract violated: `role` renamed.** Parent: "As a Workflow Enforcer"; child emits `"role": "System"`. The `atomic_leaf` contract requires verbatim mirroring. The thinking chain deliberated this explicitly — a `reasoning_to_response_faithfulness` marker that the saturation-class marker set would catch; the placeholder bundle missed it.

- **(LOW) Measurable condition reformulated.** Parent AC: "shows single commit point within DBOS store"; child: "Count of commit points... equals 1." Grounded (TECH-DBOS-1) but adds specificity the parent did not commit to.

### 13c (depth 8) — defects

FR-VIOL-DEL-001.2.1.1.C-02-B-01.2 classified `atomic_leaf` (hint C → D) — PostgreSQL RLS policy on ENT-TENANT-SETTING.

**Harness misfired:**
- **reasoning_quality_validator HIGH** on `"SELECT * FROM ENT-TENANT-SETTING WHERE tenant_id != CURRENT_TENANT_ID returns zero rows"` — called "a descriptive sentence, not a formal query." This is a **false positive**: the condition is executable SQL with a boolean observable result. The `measurement_adequacy_validator` (§3 battery) would clear it. The broad-scope `reasoning_quality_validator` misfired because it ran without the calibrating narrow validators.

**Harness missed:**
- **(HIGH) Fabricated trace reference.** Child `traces_to` includes `"FR-VIOL-DEL-001.2.1.1.C-02-D-01"` — absent from the handoff context and from the `sibling_context` list. The agent constructed it from the current node's ID namespace. The `grounding_validator` at full saturation scope (`broken_reference` type) would catch this. Fabricated traces break downstream lineage automation.

- **(LOW) Assumption citation empty.** Surfaced assumption about PostgreSQL RLS carries `"citations": []` despite directly invoking TECH-POSTGRES-1 and COMP-MULTI-TENANT-ISOLATION. `assumption_citation_validator` (full form) would require these populated.

---

## 1b. Harness coverage analysis

| Validator | Dispatched? | Result |
|---|---|---|
| `contract_schema_validator` | Yes | Clean across all three samples |
| `grounding_validator` | Yes (no saturation claim list) | 13c fabricated trace — **MISSED** |
| `reasoning_to_response_faithfulness` | Yes (no saturation marker set) | 13b role rename — **MISSED** |
| `reasoning_quality_validator` | Yes (broad scope) | 13c false positive HIGH on valid SQL |
| `final_synthesis` | Yes | Correctly aggregated |
| `tier_decomposition_validator` | **NOT dispatched** | Would catch: 13a flat mapping, 13b mirror violation, classification calibration |
| `measurement_adequacy_validator` (full §3) | **NOT dispatched** | Would catch: 13b condition rewrite; would CLEAR 13c false positive |
| `assumption_citation_validator` (full form) | **NOT dispatched** | Would catch: 13c empty citations, 13b empty surfaced_assumptions check |

ChatGPT-5.5 §4 (`tier_decomposition`) is the center of mass; §3 (`measurement_adequacy`) would have calibrated the measurable_condition debate and cleared the 13c false positive; §5 (`assumption_citation`) would have enforced citation completeness. §6 (`reasoning_quality_validator`) ran but misfired under broad scope.

---

## 2. Validator implications (deltas vs current catalog)

Catalog §7.5 `(Saturation proj)` already covers the full ChatGPT-5.5 set. No new families needed. Four parameterization notes for Stage 1A.3:

**`parent_branch_classification_check`** (deterministic). Verify `atomic_leaf` mirror contract: child `role`, `action`, `outcome`, AC must match parent verbatim. Verify `decomposable` does not produce a sole child identical to parent. Catches 13b role rename. Severity: mirror field mismatch ⇒ MEDIUM; branch/tier inconsistency ⇒ HIGH.

**`tier_assignment_audit`** (LLM). Confirm child tier labels match AC shape (B → policy; C/D → verification). Parameterize with saturation prompt's tier model. Calibrates 13a's all-Tier-D flat mapping. Severity: mismatch ⇒ MEDIUM.

**`decomposition_fanout_discipline`** (deterministic). Enforce 1–8 children. Flag `decomposable` where every child AC is verbatim from one parent AC with no new partitioning (13a pattern). Severity: >8 ⇒ HIGH; 1 decomposable child mirroring parent ⇒ MEDIUM; flat AC-to-child mapping ⇒ LOW.

**`surfaced_assumption_novelty`** (deterministic + LLM). (a) Each `citations[]` must be a valid handoff ID — catches 13c's empty citation for TECH-POSTGRES-1. (b) Each assumption must not semantically duplicate `existing_assumptions`. Severity: fabricated citation ⇒ HIGH; missing citation ⇒ LOW; semantic duplicate ⇒ MEDIUM.

The 13c fabricated trace `FR-VIOL-DEL-001.2.1.1.C-02-D-01` is covered by `grounding_validator` at full scope (`broken_reference`) — a dispatch gap, not a catalog gap.
