# Phase 4 - Robustness, Determinism & Caching

## Objective

Strengthen system determinism and efficiency. Implement caching layers, stability checks, checkpointing, and finalize all failure recovery mechanisms. By the end of this phase, the system is stable, reproducible, and handles failures gracefully.

---

## 4.1 Retrieval Stability Measurement

- [ ] Define stability metrics:
  - [ ] Overlap ratio: intersection of results across multiple runs
  - [ ] Node entropy: variance in returned sections
  - [ ] Confidence score distribution (if PageIndex provides)
- [ ] Implement duplicate query execution:
  - [ ] Run each critical query twice
  - [ ] Compare result sets
- [ ] Define stability threshold (configurable, e.g., 80% overlap)
- [ ] Implement `FAIL_RETRIEVAL_INSTABILITY` detection:
  - [ ] Trigger when overlap below threshold
  - [ ] Log which query was unstable with metrics
- [ ] Implement stability report in AuditBundle

### Notes / Issues
<!-- Track stability measurement issues here -->

---

## 4.2 Retrieval Instability Mitigation

- [ ] Implement mitigation strategies:
  - [ ] Enforce stricter PageIndex search (TOC anchors, keywords)
  - [ ] Reduce result count K (focus on top hits)
  - [ ] Set temperature=0 for PageIndex LLM calls
  - [ ] Break query into smaller subqueries
- [ ] Implement automatic retry loop:
  - [ ] On instability, apply mitigation
  - [ ] Re-run retrieval
  - [ ] Max retry attempts (configurable, e.g., 3)
- [ ] Escalate to failure if cannot stabilize after retries
- [ ] Log all mitigation attempts

### Notes / Issues
<!-- Track instability mitigation issues here -->

---

## 4.3 Evidence Caching

- [ ] Implement in-memory evidence cache:
  - [ ] Key: `(spec_commit, query_text)` or `(spec_commit, section_id)`
  - [ ] Value: EvidencePacket
- [ ] Check cache before PageIndex query
- [ ] Populate cache on successful retrieval
- [ ] Handle cache invalidation on spec version change
- [ ] Optional: persist cache to disk for cross-run reuse
- [ ] Log cache hit/miss statistics

### Notes / Issues
<!-- Track evidence caching issues here -->

---

## 4.4 Truth Context Caching

- [ ] Implement Dolt query result caching:
  - [ ] Key: `(spec_commit, section_id, query_type)`
  - [ ] Value: TruthContext entries
- [ ] Cache invalidation on Dolt commit change
- [ ] Dolt queries are deterministic by commit, so safe to cache
- [ ] Optional: preload common truth context at run start

### Notes / Issues
<!-- Track truth caching issues here -->

---

## 4.5 Checkpointing and State Persistence

- [ ] Define checkpoint states:
  - [ ] After proposal ingestion
  - [ ] After claim decomposition
  - [ ] After retrieval (EvidencePacketSet ready)
  - [ ] After truth context assembly
  - [ ] After reasoning (BeadsTrace complete)
  - [ ] After validation
- [ ] Implement checkpoint saving:
  - [ ] Save all artifacts at each checkpoint
  - [ ] Record current state in run metadata
- [ ] Implement checkpoint loading:
  - [ ] `--resume-from <state>` or `--run-id <id>`
  - [ ] Load artifacts and continue from checkpoint
- [ ] Test checkpoint/resume functionality

### Notes / Issues
<!-- Track checkpointing issues here -->

---

## 4.6 Failure Recovery Implementation

### FAIL_RETRIEVAL_INSTABILITY Recovery
- [ ] Implement automatic mitigation loop (from 4.2)
- [ ] Test: introduce randomness, verify detection and recovery
- [ ] Verify system stabilizes or fails cleanly

### FAIL_COVERAGE_GAP Recovery
- [ ] Implement retrieval extension:
  - [ ] Identify missed sections from CoveragePlan
  - [ ] Generate additional queries
  - [ ] Re-run retrieval for missed sections only
  - [ ] Append new evidence to EvidencePacketSet
  - [ ] Re-run reasoning for affected claims
- [ ] Test: verify gap recovery works or degrades to REVISE

### FAIL_TRACE_INVALID Recovery
- [ ] Implement reasoning retry with adjustments:
  - [ ] Stricter prompt (more step-by-step)
  - [ ] Add few-shot examples
  - [ ] Increase reasoning granularity
- [ ] Resume from CONSTRUCT_BEADS_TRACE state
- [ ] Preserve prior artifacts (don't re-retrieve)
- [ ] Max retry attempts before hard failure

### FAIL_SYSTEM_ERROR Recovery
- [ ] Implement graceful error handling for external failures:
  - [ ] Dolt connection loss
  - [ ] vLLM timeout/crash
  - [ ] PageIndex unavailable
- [ ] Save state on failure for manual recovery
- [ ] Document recovery procedures

### Notes / Issues
<!-- Track failure recovery issues here -->

---

## 4.7 Determinism Enforcement

- [ ] Implement run seed management:
  - [ ] Generate or accept seed at run start
  - [ ] Pass seed to all random components
  - [ ] Record seed in AuditBundle
- [ ] Configure vLLM for deterministic inference:
  - [ ] Temperature = 0
  - [ ] Fixed seed if supported
- [ ] Single-threaded execution for reasoning steps
- [ ] Verify: same input + same seed = same output

### Notes / Issues
<!-- Track determinism issues here -->

---

## 4.8 Determinism Verification

- [ ] Implement determinism test:
  - [ ] Run same proposal twice
  - [ ] Compare outputs (Judgment, BeadsTrace)
  - [ ] Exclude timestamps from comparison
  - [ ] Assert identical results
- [ ] Run determinism test on multiple proposals
- [ ] Document any known sources of non-determinism
- [ ] Compare AuditBundle hashes (excluding timestamps)

### Notes / Issues
<!-- Track determinism verification issues here -->

---

## 4.9 Configuration Consolidation

- [ ] Create comprehensive config file with all tunables:
  - [ ] `coverage_threshold`
  - [ ] `allow_degraded_mode`
  - [ ] `retrieval_stability_threshold`
  - [ ] `max_retry_attempts`
  - [ ] `temperature`
  - [ ] `random_seed` (optional)
  - [ ] Service URLs (vLLM, PageIndex, Dolt)
  - [ ] Timeout values
- [ ] Document each configuration option
- [ ] Provide sensible defaults
- [ ] Support environment variable overrides

### Notes / Issues
<!-- Track configuration issues here -->

---

## 4.10 Performance Baseline

- [ ] Measure typical run time on real spec (~50 pages):
  - [ ] Time per phase
  - [ ] Total end-to-end time
- [ ] Measure memory usage (especially GPU)
- [ ] Verify 13B model fits in 24GB VRAM
- [ ] Identify bottlenecks (if any)
- [ ] Document performance baseline

### Notes / Issues
<!-- Track performance issues here -->

---

## 4.11 Logging and Observability

- [ ] Implement structured logging throughout pipeline
- [ ] Log levels: DEBUG, INFO, WARN, ERROR
- [ ] Include run_id in all log entries
- [ ] Log timing for each phase
- [ ] Log LLM call counts and token usage
- [ ] Optional: integrate with observability stack (e.g., OpenTelemetry)

### Notes / Issues
<!-- Track logging issues here -->

---

## Acceptance Tests

- [ ] **Test 1**: Determinism verification
  - [ ] Run same input twice
  - [ ] Outputs identical (excluding timestamps)
- [ ] **Test 2**: Retrieval instability detection
  - [ ] Introduce randomness in PageIndex (high temperature)
  - [ ] Verify `FAIL_RETRIEVAL_INSTABILITY` triggered
- [ ] **Test 3**: Retrieval instability recovery
  - [ ] Apply mitigations
  - [ ] Verify system stabilizes
- [ ] **Test 4**: Checkpoint/resume
  - [ ] Run to retrieval checkpoint, stop
  - [ ] Resume from checkpoint
  - [ ] Verify completion without re-retrieval
- [ ] **Test 5**: Coverage gap recovery
  - [ ] Miss one section initially
  - [ ] Verify system extends retrieval
  - [ ] Verify complete coverage achieved
- [ ] **Test 6**: Trace invalid recovery
  - [ ] Trigger trace validation failure
  - [ ] Verify retry with stricter prompt
  - [ ] Verify eventual success or clean failure
- [ ] **Test 7**: Performance acceptable
  - [ ] Real spec run completes in reasonable time
  - [ ] Memory usage within limits
- [ ] **Test 8**: All previous phase tests still pass
  - [ ] Regression verification

---

## Milestone 4 Criteria

- [ ] System is deterministic and stable
- [ ] All targeted failure modes have recovery or clear messaging
- [ ] Caching implemented and effective
- [ ] Checkpointing works for failure recovery
- [ ] Ready for extensive testing

---

## Phase 4 Complete

- [ ] All above checklists completed
- [ ] Acceptance tests passing
- [ ] Performance baseline documented
- [ ] Phase 4 review conducted
- [ ] Ready to proceed to Phase 5

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 4 issues, decisions, and TODOs here -->

