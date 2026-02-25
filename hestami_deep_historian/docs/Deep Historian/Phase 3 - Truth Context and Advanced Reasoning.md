# Phase 3 - Truth Context & Advanced Reasoning

## Objective

Integrate Dolt truth context into reasoning, implement multi-step reasoning with explicit bead chains, handle uncertainty (REVISE verdict), and implement coverage validation. By the end of this phase, all verdict types are possible and key failure modes are implemented.

---

## 3.1 Dolt Truth Context Integration

- [ ] Define `TruthContext` data model:
  - [ ] `spec_version` (spec_commit_hash)
  - [ ] `context_map` keyed by section/requirement ID:
    - [ ] Entry types: interpretation, exception, deprecation, prior_ruling
    - [ ] Each entry: `type`, `text`, `reference` (Dolt commit/row ID)
- [ ] Implement Dolt query service for truth context:
  - [ ] Query interpretations by section ID
  - [ ] Query rulings by topic/requirement
  - [ ] Query exceptions by requirement
  - [ ] Query deprecations
- [ ] Execute truth queries in parallel with evidence retrieval
- [ ] Handle Dolt query failures → `FAIL_SYSTEM_ERROR`
- [ ] Merge truth context with evidence for reasoning input

### Notes / Issues
<!-- Track Dolt integration issues here -->

---

## 3.2 Truth-Aware Reasoning Prompts

- [ ] Update interpretation prompt to include truth context:
  - [ ] "According to prior interpretation [X], this requirement means..."
- [ ] Create prompt for exception handling:
  - [ ] "Check if any exceptions apply to this claim"
- [ ] Update comparison prompt to factor in truth context:
  - [ ] "Given the requirement, its interpretation, and any exceptions..."
- [ ] Ensure truth context citations appear in bead results

### Notes / Issues
<!-- Track truth-aware prompts issues here -->

---

## 3.3 Multi-Step Reasoning Chain

- [ ] Implement explicit bead sequence per claim:
  - [ ] **CLAIM_PARSE**: Understand and restate the claim
  - [ ] **EVIDENCE_SELECT**: Link claim to evidence packets
  - [ ] **INTERPRET_REQUIREMENT**: Interpret spec text + truth context
  - [ ] **COMPARE**: Compare proposal claim vs interpreted requirement
  - [ ] **VERDICT_STEP**: Provisional compliance decision
- [ ] Implement sequential LLM calls (or single structured prompt)
- [ ] Create bead edges to show dependency chain
- [ ] Each bead references inputs from prior beads
- [ ] Log intermediate results at each step

### Notes / Issues
<!-- Track multi-step reasoning issues here -->

---

## 3.4 Uncertainty Handling

- [ ] Define uncertainty detection criteria:
  - [ ] LLM expresses uncertainty ("not sure", "unclear", "ambiguous")
  - [ ] Evidence is inconclusive or contradictory
  - [ ] Required information missing from proposal
- [ ] Implement **UNCERTAINTY_FLAG** bead type:
  - [ ] Triggered when uncertainty detected
  - [ ] Records reason for uncertainty
  - [ ] Links to relevant claim/evidence
- [ ] Update verdict logic:
  - [ ] Any UNCERTAINTY_FLAG + no blockers → REVISE
  - [ ] Blockers still override to BLOCK
- [ ] Generate REVISE-specific findings with guidance

### Notes / Issues
<!-- Track uncertainty handling issues here -->

---

## 3.5 Counter-Evidence Reasoning

- [ ] Ensure counter-evidence queries are executed (from Phase 1)
- [ ] Implement counter-evidence consideration bead:
  - [ ] For each critical claim, explicitly consider negative scenario
  - [ ] "Is there any evidence that contradicts this claim?"
- [ ] If counter-evidence found, factor into comparison
- [ ] If counter-evidence considered and none found, record as bead
- [ ] Enforce: critical claims must have counter-evidence bead

### Notes / Issues
<!-- Track counter-evidence issues here -->

---

## 3.6 Coverage Validation

- [ ] Implement coverage ratio calculation:
  - [ ] Compare evidence sections retrieved vs CoveragePlan expected sections
  - [ ] `coverage_ratio = covered / expected`
- [ ] Implement coverage threshold check (configurable, default 0.9)
- [ ] Handle coverage gap scenarios:
  - [ ] **Option A (strict)**: `FAIL_COVERAGE_GAP` if below threshold
  - [ ] **Option B (degraded)**: Issue REVISE with missing areas listed
- [ ] Implement `allow_degraded_mode` configuration option
- [ ] Log which sections were missing
- [ ] Implement recovery path: extend RetrievalPlan for missed sections

### Notes / Issues
<!-- Track coverage validation issues here -->

---

## 3.7 Enhanced Trace Validation

- [ ] Implement validation rule: "No normative conclusion without normative premise"
  - [ ] Every decision bead must cite evidence or truth context
- [ ] Implement validation rule: "Contradictory findings must be resolved"
  - [ ] Detect if two beads contradict
  - [ ] Either resolve or flag explicitly
- [ ] Implement validation rule: "Critical claims have multi-step reasoning"
  - [ ] Minimum bead count per critical claim
- [ ] Implement validation rule: "Counter-evidence considered for critical claims"
- [ ] `FAIL_TRACE_INVALID` on any violation
- [ ] Generate detailed validation report

### Notes / Issues
<!-- Track trace validation issues here -->

---

## 3.8 Failure Mode Implementation

### FAIL_AUTHORITY_MISMATCH
- [ ] Implement version alignment check with actual Dolt commits
- [ ] Simulate mismatch scenario (update Dolt, don't rebuild index)
- [ ] Verify orchestrator detects and stops
- [ ] Verify error message includes remedy instructions

### FAIL_COVERAGE_GAP
- [ ] Implement coverage gap detection fully
- [ ] Test scenario: CoveragePlan expects 2 sections, evidence only covers 1
- [ ] Verify failure triggered (in strict mode)
- [ ] Test degraded mode: verify REVISE issued instead
- [ ] Verify missing sections listed in output

### FAIL_TRACE_INVALID (enhanced)
- [ ] Test scenario: verdict bead without evidence citation
- [ ] Test scenario: missing counter-evidence bead for critical claim
- [ ] Verify failures caught and reported clearly

### Notes / Issues
<!-- Track failure mode implementation issues here -->

---

## 3.9 Judgment Enhancements

- [ ] Update Judgment to include:
  - [ ] Truth context references in findings
  - [ ] Coverage metrics
  - [ ] Validation report summary
- [ ] Implement corrections/guidance generation:
  - [ ] For BLOCK: suggest how to fix violations
  - [ ] For REVISE: list what information is needed
- [ ] Ensure all findings have complete citation chain:
  - [ ] Evidence → Beads → Conclusion
  - [ ] Truth context → Beads → Conclusion

### Notes / Issues
<!-- Track judgment enhancement issues here -->

---

## Acceptance Tests

- [ ] **Test 1**: Truth context matters
  - [ ] Spec: "encryption should be strong"
  - [ ] Dolt interpretation: "strong = at least 128-bit"
  - [ ] Proposal: "uses 64-bit encryption"
  - [ ] Expected: BLOCK
  - [ ] Verify: Reasoning cites Dolt interpretation
- [ ] **Test 2**: Ambiguity leads to REVISE
  - [ ] Spec: "do X if feasible"
  - [ ] Proposal: doesn't clarify feasibility
  - [ ] Expected: REVISE
  - [ ] Verify: UNCERTAINTY_FLAG bead present
  - [ ] Verify: Verdict explains what's unclear
- [ ] **Test 3**: Exception applies
  - [ ] Spec: "must do X"
  - [ ] Dolt exception: "Project Y exempted from X"
  - [ ] Proposal: "Project Y does not do X"
  - [ ] Expected: PASS (or at least not BLOCK for X)
  - [ ] Verify: Exception cited in reasoning
- [ ] **Test 4**: Coverage gap (strict mode)
  - [ ] CoveragePlan expects security + logging
  - [ ] Only security evidence retrieved
  - [ ] Expected: `FAIL_COVERAGE_GAP`
- [ ] **Test 5**: Coverage gap (degraded mode)
  - [ ] Same as Test 4 with `allow_degraded_mode=true`
  - [ ] Expected: REVISE with missing "logging" noted
- [ ] **Test 6**: Authority mismatch
  - [ ] Dolt at commit X, PageIndex at commit Y
  - [ ] Expected: `FAIL_AUTHORITY_MISMATCH`
- [ ] **Test 7**: Multi-step trace verification
  - [ ] Verify each claim has full bead chain
  - [ ] Verify edges show proper dependencies

---

## Milestone 3 Criteria

- [ ] Full reasoning pipeline with truth context integration
- [ ] All verdict types possible (PASS, BLOCK, REVISE)
- [ ] Key failure checks implemented and tested
- [ ] Verified on complex cases and edge conditions

---

## Phase 3 Complete

- [ ] All above checklists completed
- [ ] Acceptance tests passing
- [ ] Phase 3 review conducted
- [ ] Ready to proceed to Phase 4

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 3 issues, decisions, and TODOs here -->

