# Scenario Test Suite - Files Created

## Overview

Complete scenario-based test suite for the Historian Agent Platform workflow, demonstrating end-to-end agent interaction from proposal submission to human review.

## Files Created (24 total)

### Documentation
1. **README.md** - Master documentation for the scenario test suite

### Test Files (JSON - for Postman)
2. **Test_S1_01_Executor_Proposal.json** - Executor submits proposal
3. **Test_S1_02_Claim_Decomposition.json** - Extract verifiable claims
4. **Test_S1_03_Coverage_Plan.json** - Determine spec sections to check
5. **Test_S1_05_PageIndex_Evidence_Retrieval.json** - Retrieve specification evidence
6. **Test_S1_06_PageIndex_Counter_Evidence.json** - Search for contradictory evidence
7. **Test_S1_07_Dolt_Truth_Context.json** - Retrieve prior interpretations/rulings
8. **Test_S1_08_Beads_Trace_Construction.json** - Build stepwise reasoning trace
9. **Test_S1_10_Judgment_Emission.json** - Emit final verdict and findings
10. **Test_S1_11_Human_Correction.json** - Human reviews judgment

### Answer Keys (Markdown - explanations)
11. **Test_S1_01_Expected_Output.md** - Proposal validation expected behavior
12. **Test_S1_02_Expected_Output.md** - Claim decomposition expected behavior
13. **Test_S1_03_Expected_Output.md** - Coverage plan expected behavior
14. **Test_S1_05_Expected_Output.md** - Evidence retrieval expected behavior
15. **Test_S1_06_Expected_Output.md** - Counter-evidence expected behavior
16. **Test_S1_07_Expected_Output.md** - Truth context expected behavior
17. **Test_S1_08_Expected_Output.md** - Beads trace expected behavior
18. **Test_S1_09_Expected_Output.md** - Trace validation expected behavior
19. **Test_S1_10_Expected_Output.md** - Judgment emission expected behavior
20. **Test_S1_11_Expected_Output.md** - Human review expected behavior

### Summary Files
21. **FILES_CREATED.md** - This file

## Test Sequence

### Phase 1: Proposal & Decomposition (Tests S1_01-S1_03)
- S1_01: Validate proposal structure → Ready for decomposition
- S1_02: Extract 9 claims, 5 assumptions, 3 design decisions → ClaimSet artifact
- S1_03: Define 7 expected spec sections, 95% coverage threshold → CoveragePlan artifact

### Phase 2: Evidence Retrieval (Tests S1_05-S1_07)
- S1_05: Retrieve 4-5 evidence packets from PageIndex → EvidencePacketSet artifact
- S1_06: Search for counter-evidence (contradictory or supporting) → Additional evidence packets
- S1_07: Retrieve truth context from Dolt (interpretations, rulings, policies) → TruthContext artifact

### Phase 3: Reasoning & Validation (Tests S1_08-S1_09)
- S1_08: Construct BeadsTrace with 7 reasoning steps for claim C1 → BeadsTrace artifact
- S1_09: Validate trace (5 logical rules) and coverage (100%) → Validation report

### Phase 4: Judgment & Review (Tests S1_10-S1_11)
- S1_10: Emit final BLOCK verdict with 4 findings, corrective guidance → Judgment artifact
- S1_11: Human reviews judgment, assesses auditability → Review report

## Expected Scenario Outcome

**Proposal:** Developer proposes replacing SuperPoint/SuperGlue with ORB/BFMatcher to reduce SDK size

**Historian Analysis:**
- 9 claims extracted, 4 are critical (C1-C4)
- 7 spec sections consulted (100% coverage)
- 9 evidence packets retrieved
- 4 truth context entries found (including prior ruling R2025-087)
- 28 reasoning beads constructed across all claims
- 5 trace validation rules passed
- 4 blocking violations identified (F1-F4)

**Final Verdict:** BLOCK
- F1: Replacing SuperPoint with ORB violates spec requirement
- F2: Replacing SuperGlue with BFMatcher violates spec requirement
- F3: Reducing maxFeaturesPerImage to 1000 violates spec and tested minimum (1500)
- F4: Disabling sub-pixel refinement violates spec requirement

**Human Review:** Accept judgment (accurate, well-supported, fully auditable)

## How to Use

1. **Run vLLM:** `docker compose up vllm -d` in hestami_deep_historian directory
2. **Open Postman:** Create new POST request to `http://localhost:8000/v1/chat/completions`
3. **Add Auth Header:** `Authorization: Bearer local-historian-key`
4. **Run Tests Sequentially:** Copy JSON content from S1_01 → S1_02 → ... → S1_11
5. **Compare Results:** Check output against corresponding Expected_Output.md file

## Key Features Demonstrated

### Accuracy & Correctness
- Every finding backed by multiple evidence sources
- Counter-evidence actively sought (prevents oversight bias)
- Truth context provides empirical data (23% failure rate, >15% SfM failure)
- Prior ruling (R2025-087) provides precedent

### Completeness
- 100% coverage of expected spec sections
- All critical claims have evidence, counter-evidence, truth context
- No expected sections missed

### Determinism
- Fixed spec version (commit abc123def456)
- Structured reasoning (28 beads, not free-form)
- Dependency graph explicit
- Reproducible via audit bundle

### Auditability
- Every finding traceable: Claim → Evidence → Truth → Reasoning → Verdict
- Audit trail includes version hashes, timestamps, metrics
- Human can verify any aspect of judgment
- Complete citation chains

## Test Complexity

**Simple Tests:**
- S1_01: Basic validation (2-3 fields to check)
- S1_09: Yes/no validation checks

**Medium Tests:**
- S1_02: Extract 9 claims + 5 assumptions + 3 decisions
- S1_03: Identify 7 spec sections + set coverage threshold
- S1_05: Create 4-5 evidence packets with citations

**Complex Tests:**
- S1_08: Construct 7-bead reasoning trace with dependencies
- S1_10: Compile 4 findings with full citation chains
- S1_11: Multi-dimensional human review assessment

## Success Metrics

**Overall Scenario Success:**
- [ ] All 11 tests produce valid JSON
- [ ] No `</think>` tags in any output
- [ ] S1_02: 9 claims extracted
- [ ] S1_03: 7 expected sections, 95% threshold
- [ ] S1_05: 4+ evidence packets
- [ ] S1_06: 3+ counter-evidence packets
- [ ] S1_07: 3+ truth context entries + 1 prior ruling
- [ ] S1_08: 7 beads with proper dependencies
- [ ] S1_09: All 5 trace rules pass, 100% coverage
- [ ] S1_10: BLOCK verdict with 4 findings
- [ ] S1_11: Human accepts judgment

**Quality Indicators:**
- Processing time < 5 seconds per test
- Evidence citations precise and verifiable
- Reasoning traces logically sound
- Verdict justified and defensible
- Judgment fully auditable

## Comparison to Basic Tests

**Basic Tests (Test_1 through Test_7):**
- Single-step operations (summarization, relevance scoring, etc.)
- Demonstrate individual capabilities
- Good for testing LLM prompt quality
- Don't show agent interaction workflow

**Scenario Tests (Test_S1_01 through S1_11):**
- Multi-step workflow simulation
- Demonstrate agent orchestration
- Show how artifacts flow between steps
- Simulate real Historian Agent Platform operation
- Include human-in-the-loop review

## Next Steps

1. **Manual Testing:** Run all tests in Postman, record results
2. **Quality Assessment:** Compare actual outputs to expected outputs
3. **Iteration:** Refine prompts based on results
4. **Integration:** Incorporate winning prompts into Historian orchestrator
5. **Automation:** Create test harness to run suite automatically
6. **Expansion:** Add PASS scenario (compliant proposal) and REVISE scenario (ambiguous proposal)

## Related Files

- **Blueprint:** `hestami_deep_historian/docs/Deep Historian/Historian Agent Platform Design Blueprint.md`
- **Basic Tests:** `hestami_deep_historian/docs/specs/Postman/Test_1_*.json` through `Test_7_*.json`
- **Specification:** `hestami_deep_historian/docs/specs/hestami-ai-os-specs/(Experimental-Hackathon) Photorealistic 3D Scanning SDK - Technical Specification.md`
