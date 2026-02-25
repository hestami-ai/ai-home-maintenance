# Scenario-Based Test Suite - Historian Agent Workflow

## Overview

This test suite simulates a complete end-to-end scenario demonstrating the interaction between:
- **Executor Agent** (developer proposing implementation)
- **Historian Agent** (orchestrating verification)
- **PageIndex** (retrieving specification evidence)
- **Dolt** (providing truth context)
- **BeadsTrace** (capturing reasoning)
- **Human** (reviewing judgment)

## Scenario Description

**Context:** A developer (Executor) proposes cost-saving changes to the Feature Detection System in the Photorealistic 3D Scanning SDK specification.

**Proposal Summary:** Replace SuperPoint + SuperGlue with OpenCV's ORB feature detector and brute-force matching to:
- Reduce SDK size (remove 6.7MB of ML models)
- Eliminate ML licensing concerns
- Simplify implementation
- Reduce processing time target from 200ms to 100ms

**Expected Outcome:** The Historian should identify multiple non-compliance issues and issue a BLOCK verdict.

## Test Sequence

The scenario is broken into 11 sequential tests that mirror the Historian Agent Platform workflow described in the Design Blueprint:

### Phase 1: Proposal Submission & Decomposition

- **Test_S1_01_Executor_Proposal.json**
  - Executor submits the implementation proposal
  - Tests: Proposal format validation, basic structure

- **Test_S1_02_Claim_Decomposition.json**
  - Historian extracts verifiable claims from the proposal
  - Tests: Claim extraction, categorization (requirements, assumptions, decisions)

- **Test_S1_03_Coverage_Plan.json**
  - Historian determines which spec sections must be checked
  - Tests: Expected section identification, coverage requirements

### Phase 2: Evidence Retrieval

- **Test_S1_04_Retrieval_Plan.json**
  - Historian creates queries for PageIndex and Dolt
  - Tests: Query formulation, counter-evidence inclusion

- **Test_S1_05_PageIndex_Evidence_Retrieval.json**
  - Simulates PageIndex returning Evidence Packets for requirements
  - Tests: Evidence packet structure, section identification

- **Test_S1_06_PageIndex_Counter_Evidence.json**
  - Simulates PageIndex searching for contradictory evidence
  - Tests: Counter-evidence identification, constraint discovery

- **Test_S1_07_Dolt_Truth_Context.json**
  - Simulates Dolt providing prior rulings and interpretations
  - Tests: Truth context retrieval, version consistency

### Phase 3: Reasoning & Judgment

- **Test_S1_08_Beads_Trace_Construction.json**
  - Historian constructs stepwise reasoning for each claim
  - Tests: CLAIM_PARSE, EVIDENCE_SELECT, INTERPRET_REQUIREMENT, COMPARE, VERDICT_STEP beads

- **Test_S1_09_Trace_Validation.json**
  - Historian validates reasoning trace for logical consistency
  - Tests: Evidence citation rules, coverage completeness

- **Test_S1_10_Judgment_Emission.json**
  - Historian emits final verdict with findings
  - Tests: Verdict correctness (BLOCK), citation completeness, corrective guidance

### Phase 4: Human Review

- **Test_S1_11_Human_Correction.json**
  - Human reviews judgment and provides feedback
  - Tests: Judgment comprehensibility, audit trail accessibility

## How to Use These Tests

### Prerequisites
1. vLLM server running: `docker compose up vllm -d`
2. Model loaded: `qwen3-4b-thinking`
3. Endpoint: `http://localhost:8000/v1/chat/completions`
4. Authorization: `Bearer local-historian-key`

### Running Individual Tests

For each test file:
1. Open Postman
2. Create new POST request to `http://localhost:8000/v1/chat/completions`
3. Add header: `Authorization: Bearer local-historian-key`
4. Copy JSON content from test file to request body
5. Send request
6. Compare response to corresponding answer key

### Answer Keys

Each test has two answer key files:
- **Test_SX_XX_Expected_Output.md** - Human-readable explanation of expected output
- **Test_SX_XX_Expected_Output.json** - Machine-readable expected response structure

### Validation Criteria

**For all tests:**
- ✅ Valid JSON response
- ✅ No `</think>` tags in final output
- ✅ Structured output matches schema
- ✅ Processing time < 5 seconds

**For evidence retrieval tests (S1_05, S1_06, S1_07):**
- ✅ Evidence packets include all required fields (doc_id, section_id, content, source)
- ✅ Citations are precise and verifiable
- ✅ Related claims are correctly linked

**For reasoning tests (S1_08, S1_09):**
- ✅ Each bead type present where required
- ✅ Every conclusion cites evidence
- ✅ No logical contradictions
- ✅ Counter-evidence considered for critical claims

**For judgment test (S1_10):**
- ✅ Verdict = BLOCK (proposal violates spec)
- ✅ All violations cite specific evidence packets
- ✅ Corrective guidance provided
- ✅ Audit trail references complete

## Test Data Sources

All test content is derived from:
- **Specification:** `(Experimental-Hackathon) Photorealistic 3D Scanning SDK - Technical Specification.md`
- **Relevant Sections:**
  - Feature Detection System (node_5_2)
  - Performance Requirements (node_8)
  - Technical Architecture (node_3)
  - ML Models section
  - Configuration specifications

## Success Criteria for Full Scenario

**End-to-End Success Indicators:**
1. Claim decomposition identifies all 6 key claims in proposal
2. Coverage plan expects 4+ relevant spec sections
3. Evidence retrieval finds Feature Detection System specifications
4. Counter-evidence identifies ML model requirements
5. Truth context (if available) provides prior SuperPoint decisions
6. BeadsTrace contains 25+ reasoning steps with proper dependencies
7. Trace validation passes all logical consistency rules
8. Final verdict = BLOCK with 3+ specific violations cited
9. Human can trace any finding back to evidence via audit bundle
10. Re-running produces identical judgment (determinism test)

## Known Limitations

- These tests simulate PageIndex and Dolt responses rather than calling actual services
- The LLM is being asked to play multiple agent roles sequentially
- In a real system, the orchestrator would coordinate these steps programmatically
- Answer keys represent idealized outputs; actual LLM responses may vary in phrasing

## Next Steps After Testing

If tests pass with good quality:
1. Integrate these prompts into the Historian orchestrator implementation
2. Create similar scenario suites for PASS and REVISE outcomes
3. Test with real PageIndex integration (not simulated)
4. Implement automated test harness to run suite continuously
5. Add more complex scenarios (multi-document, ambiguous requirements)

## Related Documents

- **Design Blueprint:** `hestami_deep_historian/docs/Deep Historian/Historian Agent Platform Design Blueprint.md`
- **Basic Tests:** `../Test_1_Basic_Summarization.json` through `../Test_7_MultiDocument_Comparison.json`
- **Specification:** `hestami_deep_historian/docs/specs/hestami-ai-os-specs/(Experimental-Hackathon) Photorealistic 3D Scanning SDK - Technical Specification.md`
