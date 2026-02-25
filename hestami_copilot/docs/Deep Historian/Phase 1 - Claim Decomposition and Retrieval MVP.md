# Phase 1 - Claim Decomposition & Retrieval MVP

## Objective

Implement the orchestrator logic from proposal ingestion through evidence assembly, without full reasoning. By the end of this phase, the system can parse a proposal into claims and retrieve relevant specification excerpts.

---

## 1.1 Proposal Ingestion

- [ ] Define `Proposal` data model/schema:
  - [ ] `proposal_id` (hash or UUID)
  - [ ] `content` (text or structured)
  - [ ] `metadata` (timestamps, source, etc.)
- [ ] Implement proposal ingestion endpoint/function
- [ ] Implement input validation:
  - [ ] Required fields check
  - [ ] Format validation
  - [ ] Compute and assign `proposal_id`
- [ ] Implement `FAIL_INPUT_INVALID` error handling
- [ ] Store ingested proposal for reference

### Notes / Issues
<!-- Track proposal ingestion issues here -->

---

## 1.2 Truth Baseline Resolution

- [ ] Implement `spec_commit` resolution logic:
  - [ ] Query Dolt for latest commit (HEAD)
  - [ ] Support optional explicit commit/branch specification
- [ ] Record `spec_commit` for the run
- [ ] Implement `FAIL_SYSTEM_ERROR` for invalid commit/branch
- [ ] Create run metadata structure to track baseline

### Notes / Issues
<!-- Track truth baseline issues here -->

---

## 1.3 Index Alignment Validation

- [ ] Define `index_version` tracking mechanism
- [ ] Implement alignment check: `index_version.spec_commit == spec_commit`
- [ ] Implement `FAIL_AUTHORITY_MISMATCH` error handling
- [ ] Document index rebuild process for misalignment recovery
- [ ] Create alignment status logging

### Notes / Issues
<!-- Track index alignment issues here -->

---

## 1.4 Claim Decomposition Module

- [ ] Define `ClaimSet` data model:
  - [ ] `proposal_id` reference
  - [ ] `claims` list with:
    - [ ] `id` (e.g., C1, C2)
    - [ ] `text` (the claim statement)
    - [ ] `type` (requirement_claim, factual_claim, assumption, decision)
    - [ ] `source_location` (offset/section in proposal)
  - [ ] `assumptions` list
  - [ ] `decisions` list
  - [ ] `omissions` list (expected items not found)
- [ ] Implement claim extraction:
  - [ ] Option A: Regex/rule-based parser (placeholder)
  - [ ] Option B: LLM-based extraction with structured output
- [ ] Handle edge cases:
  - [ ] Empty proposal → `FAIL_INPUT_INVALID`
  - [ ] No extractable claims → `FAIL_INPUT_INVALID`
- [ ] Test with sample proposals

### Notes / Issues
<!-- Track claim decomposition issues here -->

---

## 1.5 Coverage Plan Generation

- [ ] Define `CoveragePlan` data model:
  - [ ] `expected_sections` list
  - [ ] `must_check_invariants` list
  - [ ] `critical_claims` references
  - [ ] `coverage_threshold` (configurable, default 0.9)
- [ ] Implement coverage plan generation:
  - [ ] Map claim topics to spec sections
  - [ ] Initially: keyword-based mapping (if proposal mentions "security" → security sections)
  - [ ] Future: LLM-based topic extraction
- [ ] Handle plan generation failure → `FAIL_SYSTEM_ERROR`
- [ ] Make coverage plan configurable via config file

### Notes / Issues
<!-- Track coverage plan issues here -->

---

## 1.6 Retrieval Plan Generation

- [ ] Define `RetrievalPlan` data model:
  - [ ] `queries` list with:
    - [ ] `target` (PageIndex or Dolt)
    - [ ] `type` (lookup_requirement, counter_evidence, prior_rulings)
    - [ ] `claim_ref` (which claim this serves)
    - [ ] `query_text`
- [ ] Implement retrieval plan generation:
  - [ ] Generate at least one query per claim
  - [ ] Generate counter-evidence queries for critical claims
  - [ ] Generate Dolt queries for prior rulings/exceptions
- [ ] Enforce counter-evidence requirement:
  - [ ] If critical claim lacks counter-evidence query → `FAIL_SYSTEM_ERROR`
- [ ] Log retrieval plan for debugging

### Notes / Issues
<!-- Track retrieval plan issues here -->

---

## 1.7 PageIndex Retrieval Integration

- [ ] Implement PageIndex client service
- [ ] Define query interface (HTTP or gRPC)
- [ ] Execute retrieval plan queries against PageIndex
- [ ] Handle PageIndex response parsing:
  - [ ] Extract document ID
  - [ ] Extract section ID
  - [ ] Extract page numbers
  - [ ] Extract content/snippet
  - [ ] Extract retrieval trace (TOC path)
- [ ] Handle empty results gracefully
- [ ] Handle PageIndex errors → `FAIL_SYSTEM_ERROR`
- [ ] Initial retrieval stability observation (no formal checks yet)

### Notes / Issues
<!-- Track PageIndex integration issues here -->

---

## 1.8 Evidence Packet Assembly

- [ ] Define `EvidencePacket` data model:
  - [ ] `packet_id` (e.g., E123)
  - [ ] `doc_id`
  - [ ] `section_id`
  - [ ] `pages` (list or range)
  - [ ] `content` (exact excerpt or summary)
  - [ ] `source` ("PageIndex")
  - [ ] `related_claims` (list of claim IDs)
  - [ ] `retrieval_trace`
- [ ] Define `EvidencePacketSet` as collection of packets
- [ ] Implement evidence assembly from PageIndex results
- [ ] Link evidence packets to originating claims
- [ ] Handle duplicate/overlapping sections (merge or dedupe)
- [ ] Log/output EvidencePacketSet for inspection

### Notes / Issues
<!-- Track evidence assembly issues here -->

---

## 1.9 Basic Dolt Truth Queries (Placeholder)

- [ ] Implement basic Dolt query client
- [ ] Execute simple queries for truth context (placeholder):
  - [ ] Query `interpretations` table
  - [ ] Query `rulings` table
  - [ ] Query `exceptions` table
- [ ] Structure results for later use in Phase 3
- [ ] Handle Dolt connection errors → `FAIL_SYSTEM_ERROR`

### Notes / Issues
<!-- Track Dolt query issues here -->

---

## 1.10 Artifact Persistence

- [ ] Implement artifact serialization (JSON/YAML)
- [ ] Save artifacts to disk/volume:
  - [ ] Proposal
  - [ ] ClaimSet
  - [ ] CoveragePlan
  - [ ] RetrievalPlan
  - [ ] EvidencePacketSet
- [ ] Create run directory structure (by `run_id` or `proposal_id`)
- [ ] Implement artifact loading for debugging/replay

### Notes / Issues
<!-- Track artifact persistence issues here -->

---

## Acceptance Tests

- [ ] **Test 1**: Simple proposal "Our system will use AES-256 for encryption"
  - [ ] ClaimSet identifies encryption claim
  - [ ] CoveragePlan expects cryptography section
  - [ ] Retrieval returns relevant spec section
  - [ ] EvidencePacketSet contains correct snippet
- [ ] **Test 2**: Proposal with unrelated claim (no matching spec)
  - [ ] System handles "no evidence found" gracefully
  - [ ] Evidence packet empty or flagged
- [ ] **Test 3**: Multi-claim proposal
  - [ ] All claims extracted
  - [ ] Evidence retrieved for each
- [ ] **Test 4**: Empty proposal
  - [ ] Returns `FAIL_INPUT_INVALID`
- [ ] **Test 5**: Malformed proposal
  - [ ] Returns `FAIL_INPUT_INVALID`

---

## Milestone 1 Criteria

- [ ] Able to ingest a proposal and output relevant spec excerpts (evidence) for each claim
- [ ] Verified on simple test cases
- [ ] All artifacts persisted and inspectable

---

## Phase 1 Complete

- [ ] All above checklists completed
- [ ] Acceptance tests passing
- [ ] Phase 1 review conducted
- [ ] Ready to proceed to Phase 2

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 1 issues, decisions, and TODOs here -->

