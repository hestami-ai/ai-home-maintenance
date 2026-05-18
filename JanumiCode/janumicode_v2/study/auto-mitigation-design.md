# Auto-Mitigation Design — Acting on Validator Findings

**Status:** Design proposal. Implementation in progress for thin-slice-7.
**Why now:** Substrate fix (A+B+C, DMR rework) is in thin-slice-6. Validator
findings against the new substrate should be *interpretable* (real fabrications
vs. symptoms of missing constraints). Auto-mitigation closes the loop: the
"human review prune" step that thin-slice mode skips becomes automatic for
HIGH findings the system can act on deterministically.

## Mental model

In a normal human-review workflow:

1. Agent emits an output (e.g., 17 FRs, when the spec asked for 3).
2. Reviewer pass fires validators; HIGH findings flag the 14 fabricated FRs.
3. **Human reviews the findings and prunes.** They drop fabricated items,
   correct truly-mistaken ones, or convert speculation to open questions.
4. Downstream phases consume the cleaned output.

In thin-slice mode (`auto_approve`), step 3 doesn't happen. The fabricated
FRs cascade forward.

Auto-mitigation replaces step 3 for HIGH findings the system can act on
deterministically. Where deterministic action isn't safe, the finding stays
advisory and surfaces to the human at gate time.

## Scope ladder (incremental, not Big Bang)

### v1 — Drop mitigations only

Target: **`spec_boundary_respect_bloom` HIGH findings**.

Why this validator first:
- It's the one we built specifically for the thin-slice cascade pattern
- Its finding semantics map cleanly to "drop this item from the array"
- It's the highest-value catch for the cascade we observed (17 FRs → 3 FRs)
- Other validators have more ambiguous mitigation semantics

Action: when a HIGH finding has `type === 'excluded_concept_proposed'`
or `'constraint_contradiction'`, drop the offending item from the
artifact's output array.

### v2 — Per-validator mitigation handlers

Register a handler per validator id. Each handler maps `(finding,
artifact) → mutation`. Validators without a handler stay advisory.

Initial registered handlers (by validator id, ordered by safety):
- `spec_boundary_respect_bloom` → drop
- `assumption_citation_validator` → surface as assumption_set entry
- `extraction_id_traceability` → fill missing `traces_to` (when source ids are obvious)
- `contract_schema_validator` → retry-with-feedback (next layer)

### v3 — Retry-with-feedback

For findings where the agent's output is structurally wrong (schema
violations, reasoning-quality issues), re-invoke the agent with the
findings as additional context. Bounded retries (max 2). Reuses the
existing feedback-loop pattern from Phase 1.

### v4+ — MEDIUM findings, cross-validator deduplication, learned policies

Out of scope for now.

## Architecture

### Components

```
PhaseProcessor                              (existing — phase 1, 2, 4, 5, etc.)
  ├── invoke agent → output_v1
  ├── invoke reviewHarness → findings, decision
  ├── if any HIGH findings AND policy=auto:
  │     ├── MitigationEngine.apply(output_v1, findings) → output_v2, actions  ★ NEW
  │     ├── for each action: writer.writeRecord('auto_mitigation_action', ...) ★ NEW
  │     └── (v3) if action includes retry: re-invoke agent with feedback
  └── proceed with output_v2 (or output_v1 if no mitigations)

MitigationEngine                            ★ NEW class
  ├── handlers: Map<ValidatorId, MitigationHandler>
  ├── apply(artifact, findings) →
  │     for each HIGH finding:
  │       lookup handler by validator_id
  │       handler(finding, artifact) → mutation
  │       apply mutation to artifact
  │     return mutated artifact + ordered list of actions

MitigationHandler                           ★ NEW interface
  (finding, artifact) → MitigationAction
  - 'drop':    remove element at finding.location
  - 'replace': swap with open_question / assumption
  - 'retry':   v3+, signal to re-invoke agent
  - 'skip':    handler explicitly chose not to act
```

### New record_type

```
auto_mitigation_action  (audit trail; one per applied mutation)
  content: {
    kind: 'auto_mitigation_action',
    source_artifact_id: <id of artifact mitigated>,
    finding_record_id: <id of reasoning_review_finding_record>,
    validator_id: <which validator caught it>,
    action_type: 'drop' | 'replace' | 'retry',
    location_jsonpath: <path within source artifact>,
    rationale: <one-line explanation>,
    before_value: <snapshot for audit>,
    after_value: <result of mitigation>
  }
  authority_level: 5  (system action, equivalent to human-approved)
```

This makes mitigations:
- **Auditable.** Every mutation has a record citing the finding that prompted it
- **Reversible.** `before_value` lets a human roll back if needed
- **Visible.** Records appear in the governed stream UI alongside the artifact

### Mitigation policy

A new orchestrator config field:

```
orchestrator.auto_mitigation_policy: 'disabled' | 'auto' | 'present_to_human'
```

- `disabled` — current behavior; findings stay advisory
- `auto` — apply deterministic mitigations without confirmation (thin-slice default)
- `present_to_human` — apply mitigations but surface as a Mirror for review before proceeding (real-run default)

In v1 we implement `disabled` and `auto`. `present_to_human` is post-v1.

## v1 implementation surface

### Files to add
- `src/lib/review/mitigation/mitigationEngine.ts` — engine class + handler interface
- `src/lib/review/mitigation/handlers/specBoundaryDrop.ts` — drop handler for spec_boundary_respect_bloom
- `src/test/unit/review/mitigation/mitigationEngine.test.ts` — engine + handler tests

### Files to modify
- `src/lib/types/records.ts` — add `auto_mitigation_action` to `RecordType`
- `src/lib/orchestrator/phases/phase1.ts` — wire MitigationEngine after each bloom's harness call
  (Phase 1 is where spec_boundary_respect_bloom dispatches; mitigation lives there first)
- `src/lib/config/defaults.ts` — add `auto_mitigation_policy` defaults

### Behavior change

Before v1:
1. Bloom proposer emits 17 FRs (3 spec'd + 14 fabricated)
2. Harness fires spec_boundary_respect_bloom, finds 14 HIGH findings
3. **decision_recommendation = QUARANTINE recorded** but nothing reads it
4. Phase 1 hands all 17 FRs to Phase 2
5. Cascade plays out

After v1:
1. Bloom proposer emits 17 FRs (3 spec'd + 14 fabricated)
2. Harness fires spec_boundary_respect_bloom, finds 14 HIGH findings
3. **MitigationEngine drops the 14 fabricated FRs**
4. 14 `auto_mitigation_action` records written with full audit trail
5. Phase 1 hands 3 FRs to Phase 2
6. Cascade does not play out for fabricated items

## Risks

1. **Wrong drops.** If `spec_boundary_respect_bloom` itself produces a false
   positive HIGH finding, v1 will drop a legitimate item. Mitigation: the
   substrate fix made findings more interpretable, so false-positive rate
   should be lower than thin-slice-5; we'll measure on thin-slice-6 before
   deciding to act on findings.

2. **Cascading mutations.** v1 doesn't re-validate mitigated output. If the
   drops leave the artifact in an inconsistent state (e.g., references to
   dropped items), downstream agents see broken references. Mitigation:
   v3 retry-with-feedback closes this; v1 logs warnings on detected
   inconsistencies.

3. **Audit trail size.** Each mitigation writes a record. For runs with
   hundreds of findings, this could be noisy. Mitigation: same channel as
   memory_edge_proposed; the existing UI handles high-volume audit records.

## Decision points before implementing

1. **Where does MitigationEngine live in the phase processor?**
   - (a) Inside the harness as a post-decision step → harness returns mitigated artifact
   - (b) In the phase processor, after harness returns → cleaner separation
   - **My recommendation: (b).** Keeps the harness focused on detection;
     mitigation is a separate concern with its own audit trail.

2. **`auto_mitigation_action` authority_level**
   - Level 5 ("Human-Approved" equivalent — the policy says "apply automatically")
   - Or Level 3 ("Human-Acknowledged" — implies the human implicitly accepted by setting policy=auto)
   - **My recommendation: Level 5.** The policy commit is the human-equivalent action.

3. **v1 scope: only `spec_boundary_respect_bloom`, or more?**
   - Adding `assumption_citation_validator` (71 HIGH in thin-slice-5) doubles
     coverage but doubles risk of false-positive mitigations
   - **My recommendation: spec_boundary_respect_bloom only for v1.**
     One validator is enough to demonstrate the loop end-to-end and to
     measure false-positive rates against the now-correct substrate.

4. **Should mitigation re-fire the harness on the mitigated output?**
   - Pro: confirms mitigations didn't break anything
   - Con: doubles LLM cost; risk of infinite loops if mitigation creates new findings
   - **My recommendation: not in v1.** Add a one-line warning record if the
     mitigated artifact still has the same number of items in the relevant
     array (the drop didn't take). v3 adds retry-with-revalidate.

## Estimated effort

- Design + agreement: 0.5 day (this doc)
- v1 implementation + tests: 1.5-2 days
- thin-slice-7 integration verification: 0.5 day
- **Total to v1: ~3 days**

v2 (multi-validator handlers): +2-3 days incremental
v3 (retry-with-feedback): +3-5 days incremental
