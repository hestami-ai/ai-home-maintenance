# Phase 2 - Beads Trace & Reasoning Core

## Objective

Implement the reasoning mechanism and produce preliminary verdicts. By the end of this phase, the system can compare claims against evidence and generate a basic judgment with a traceable reasoning chain.

---

## 2.1 BeadsTrace Data Structure

- [ ] Define `Bead` node data model:
  - [ ] `id` (e.g., B1, B2)
  - [ ] `type` (CLAIM_PARSE, EVIDENCE_SELECT, INTERPRET_REQUIREMENT, COMPARE, VERDICT_STEP, UNCERTAINTY_FLAG)
  - [ ] `claim` reference (if applicable)
  - [ ] `evidence_refs` list (EvidencePacket IDs)
  - [ ] `truth_refs` list (TruthContext references)
  - [ ] `result` (text description of this step's output)
  - [ ] `conclusion` (if applicable)
  - [ ] `detail` (additional context)
  - [ ] `justification_refs` (references to prior beads)
  - [ ] `timestamp`
- [ ] Define `BeadsTrace` container:
  - [ ] `beads` list
  - [ ] `edges` list (from/to bead connections)
  - [ ] DAG structure support
- [ ] Implement bead creation functions
- [ ] Implement trace append operations (append-only)
- [ ] Implement trace serialization (JSON)

### Notes / Issues
<!-- Track BeadsTrace structure issues here -->

---

## 2.2 Reasoning Prompt Templates

- [ ] Create prompt template for claim parsing:
  - [ ] Input: claim text
  - [ ] Output: structured understanding of the claim
- [ ] Create prompt template for evidence selection reasoning:
  - [ ] Input: claim + available evidence packets
  - [ ] Output: which evidence is relevant
- [ ] Create prompt template for requirement interpretation:
  - [ ] Input: evidence text + claim context
  - [ ] Output: interpretation of what requirement means
- [ ] Create prompt template for comparison:
  - [ ] Input: claim + requirement interpretation
  - [ ] Output: compliant/non-compliant/uncertain + reasoning
- [ ] Create prompt template for verdict step:
  - [ ] Input: comparison results
  - [ ] Output: provisional verdict with justification
- [ ] Ensure prompts request structured output (JSON preferred)

### Notes / Issues
<!-- Track prompt template issues here -->

---

## 2.3 LLM Reasoning Integration

- [ ] Implement LLM client for reasoning calls (via vLLM)
- [ ] Configure deterministic settings:
  - [ ] Temperature = 0 (or very low)
  - [ ] Fixed random seed if supported
- [ ] Implement structured output parsing from LLM responses
- [ ] Handle LLM response validation:
  - [ ] Expected fields present
  - [ ] Valid JSON structure
  - [ ] Retry on malformed response (limited attempts)
- [ ] Log all LLM prompts and responses to AuditBundle

### Notes / Issues
<!-- Track LLM integration issues here -->

---

## 2.4 Single-Step Reasoning (Initial)

- [ ] Implement initial coarse reasoning per claim:
  - [ ] One-shot prompt: "Given evidence [X] and claim [Y], is claim compliant?"
  - [ ] Parse response into compliance status
- [ ] Create corresponding beads for each reasoning step
- [ ] Link beads to evidence packets used
- [ ] Handle cases where no evidence exists for a claim
- [ ] Aggregate results across all claims

### Notes / Issues
<!-- Track single-step reasoning issues here -->

---

## 2.5 Draft Judgment Generation

- [ ] Define `Judgment` data model:
  - [ ] `run_id`
  - [ ] `verdict` (PASS, BLOCK, REVISE)
  - [ ] `findings` list:
    - [ ] `claim` reference
    - [ ] `outcome` (compliant, violated, uncertain)
    - [ ] `requirement_id`
    - [ ] `evidence` references
    - [ ] `trace` references (bead IDs)
  - [ ] `issues` list (general issues)
  - [ ] `corrections` list (guidance)
  - [ ] `audit_trail_refs`:
    - [ ] `spec_commit`
    - [ ] `index_version`
    - [ ] `trace_hash` or reference
- [ ] Implement verdict logic (initial):
  - [ ] Any violation → BLOCK
  - [ ] All compliant → PASS
  - [ ] (REVISE logic deferred to Phase 3)
- [ ] Generate findings with evidence and trace references
- [ ] Serialize Judgment to JSON

### Notes / Issues
<!-- Track judgment generation issues here -->

---

## 2.6 Basic Trace Validation

- [ ] Implement validation rule: "Every violation must cite evidence"
  - [ ] Check VERDICT_STEP beads with violation outcome
  - [ ] Ensure `evidence_refs` is non-empty
- [ ] Implement validation rule: "No conclusion without preceding reasoning"
  - [ ] Check bead dependencies via edges
- [ ] Trigger `FAIL_TRACE_INVALID` if validation fails
- [ ] Log which rule was violated and which bead(s) are problematic

### Notes / Issues
<!-- Track trace validation issues here -->

---

## 2.7 Trace Visualization/Inspection

- [ ] Implement trace pretty-print for debugging
- [ ] Output trace as readable text log
- [ ] Consider simple graph visualization (optional, e.g., Mermaid format)
- [ ] Ensure trace is human-inspectable in AuditBundle

### Notes / Issues
<!-- Track trace visualization issues here -->

---

## 2.8 AuditBundle Assembly (Initial)

- [ ] Define `AuditBundle` structure:
  - [ ] Proposal
  - [ ] ClaimSet
  - [ ] CoveragePlan
  - [ ] RetrievalPlan
  - [ ] EvidencePacketSet
  - [ ] TruthContext (placeholder for now)
  - [ ] BeadsTrace
  - [ ] Judgment
  - [ ] Metadata (timestamps, versions, hashes)
- [ ] Implement bundle assembly
- [ ] Implement bundle serialization (directory with JSON files or single archive)
- [ ] Compute checksums for integrity verification
- [ ] Save bundle to output volume

### Notes / Issues
<!-- Track AuditBundle issues here -->

---

## Acceptance Tests

- [ ] **Test 1**: Compliant scenario
  - [ ] Spec: "must use AES-256"
  - [ ] Proposal: "uses AES-256"
  - [ ] Expected: PASS verdict
  - [ ] Verify: Bead shows "compliant" conclusion
  - [ ] Verify: Finding recorded as compliant
- [ ] **Test 2**: Non-compliant scenario
  - [ ] Spec: "must use AES-256"
  - [ ] Proposal: "uses DES"
  - [ ] Expected: BLOCK verdict
  - [ ] Verify: Bead shows violation
  - [ ] Verify: Finding cites correct spec section
- [ ] **Test 3**: Multiple claims (mixed)
  - [ ] Some compliant, some not
  - [ ] Expected: BLOCK (any violation blocks)
  - [ ] Verify: All claims have findings
- [ ] **Test 4**: No evidence for claim
  - [ ] Verify: System handles gracefully (may flag as issue)
- [ ] **Test 5**: Trace validation failure (simulated)
  - [ ] Force a verdict bead without evidence
  - [ ] Expected: `FAIL_TRACE_INVALID`
- [ ] **Test 6**: Verify AuditBundle completeness
  - [ ] All artifacts present
  - [ ] Checksums valid

---

## Milestone 2 Criteria

- [ ] Able to produce basic verdict (Pass/Block) with reasoning
- [ ] Reasoning trace is recorded and followable
- [ ] Verified on straightforward compliance/non-compliance cases

---

## Phase 2 Complete

- [ ] All above checklists completed
- [ ] Acceptance tests passing
- [ ] Phase 2 review conducted
- [ ] Ready to proceed to Phase 3

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 2 issues, decisions, and TODOs here -->

