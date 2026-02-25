# Test S1_10: Judgment Emission - Expected Output

## Purpose
Emit the final, auditable judgment after all reasoning and validation is complete.

## Expected Behavior

The LLM should:
1. Compile findings from all claim reasoning traces
2. Determine overall verdict based on finding severities
3. Cite all evidence and truth context for each finding
4. Provide corrective guidance
5. Include complete audit trail references
6. Report coverage metrics

## Expected JSON Response

```json
{
  "run_id": "RUN-2026-001-20260201T101545Z",
  "proposal_id": "PROP-2026-001",
  "verdict": "BLOCK",
  "verdict_summary": "Proposal PROP-2026-001 violates 4 critical specification requirements by replacing mandatory ML-based feature detection (SuperPoint/SuperGlue) with traditional computer vision (ORB/BFMatcher) and modifying required configuration parameters below tested minimum thresholds. Prior ruling R2025-087 explicitly rejected a similar approach.",
  "findings": [
    {
      "finding_id": "F1",
      "claim": "C1",
      "outcome": "violated_requirement",
      "severity": "blocking",
      "requirement_id": "node_5_2",
      "requirement_text": "Deep learning-based feature detection (SuperPoint)",
      "proposal_text": "Feature detection will use OpenCV ORB instead of SuperPoint",
      "evidence": ["E001", "E002", "E101"],
      "truth_context": ["T001", "T003"],
      "trace": ["B1", "B2", "B3", "B4", "B5", "B6", "B7"],
      "explanation": "The proposal replaces SuperPoint with ORB, directly violating the specification's requirement for 'deep learning-based feature detection (SuperPoint)' (E001). Truth context T001 confirms that SuperPoint was explicitly chosen as a REQUIRED component after testing showed ORB failed on 23% of low-texture wall surfaces. Prior ruling T003 (R2025-087) rejected a similar proposal attempting to use traditional feature detectors, stating 'ML-based feature detection is mandatory for achieving ±2mm accuracy.' Evidence E101 explains the rationale: SuperPoint is specifically needed for detecting features in low-texture areas where traditional methods fail."
    },
    {
      "finding_id": "F2",
      "claim": "C2",
      "outcome": "violated_requirement",
      "severity": "blocking",
      "requirement_id": "node_5_2",
      "requirement_text": "Neural network feature matching (SuperGlue)",
      "proposal_text": "Feature matching will use cv::BFMatcher with Hamming distance instead of SuperGlue",
      "evidence": ["E003"],
      "truth_context": ["T001", "T003"],
      "trace": ["B8", "B9", "B10", "B11", "B12", "B13", "B14"],
      "explanation": "The proposal replaces SuperGlue neural network matching with brute-force cv::BFMatcher, violating the specification's requirement for 'Neural network feature matching (SuperGlue)' (E003). The same truth context (T001, T003) that mandates SuperPoint also applies to SuperGlue as part of the ML-based feature detection system. The prior ruling explicitly states that traditional approaches do not meet performance targets."
    },
    {
      "finding_id": "F3",
      "claim": "C3",
      "outcome": "violated_requirement",
      "severity": "blocking",
      "requirement_id": "node_5_2_config",
      "requirement_text": "let maxFeaturesPerImage: Int = 2000",
      "proposal_text": "Set maxFeaturesPerImage to 1000",
      "evidence": ["E004"],
      "truth_context": ["T002"],
      "trace": ["B15", "B16", "B17", "B18", "B19", "B20", "B21"],
      "explanation": "The proposal sets maxFeaturesPerImage to 1000, violating the specification's configuration requirement of 2000 (E004). Truth context T002 establishes that this is not merely a suggested value: testing determined that values below 1500 resulted in Structure from Motion failure rates exceeding 15%. The proposed value of 1000 is below this tested minimum threshold and would likely cause unacceptable reconstruction failures."
    },
    {
      "finding_id": "F4",
      "claim": "C4",
      "outcome": "violated_requirement",
      "severity": "blocking",
      "requirement_id": "node_5_2_config",
      "requirement_text": "let enableSubPixelRefinement: Bool = true",
      "proposal_text": "Disable enableSubPixelRefinement (set to false)",
      "evidence": ["E004", "E005"],
      "truth_context": ["T002", "T004"],
      "trace": ["B22", "B23", "B24", "B25", "B26", "B27", "B28"],
      "explanation": "The proposal disables sub-pixel refinement, violating the specification's configuration requirement of 'true' (E004). The proposal assumes that ORB's corner refinement provides equivalent sub-pixel accuracy, but this assumption is unvalidated and contradicted by truth context T002, which states that sub-pixel refinement is required for achieving the ±2mm accuracy target. Evidence E005 lists sub-pixel refinement as one of the key architectural features of the system."
    }
  ],
  "corrections": [
    "Retain SuperPoint ML model for feature detection as specified. Do not replace with ORB or other traditional feature detectors.",
    "Retain SuperGlue neural network for feature matching as specified. Do not replace with brute-force matchers.",
    "Maintain maxFeaturesPerImage = 2000 as specified. Do not reduce below 1500 (tested minimum threshold).",
    "Keep enableSubPixelRefinement = true as specified. Do not disable sub-pixel refinement.",
    "If SDK size reduction is a priority, explore alternative optimizations that do not violate core architectural requirements (e.g., model quantization, progressive loading).",
    "If ML licensing is a concern, address through proper licensing agreements rather than architectural changes.",
    "Before proposing alternative approaches, conduct comparative testing to demonstrate equivalent or better performance against specification requirements, and submit test results for design review."
  ],
  "audit_trail_refs": {
    "spec_commit": "abc123def456",
    "index_version": "pageindex_v1_spec_abc123",
    "dolt_commit": "abc123def456",
    "trace_id": "TRACE-2026-001",
    "beads_count": 28,
    "evidence_packets_count": 9,
    "truth_context_count": 4
  },
  "coverage_report": {
    "expected_sections": 7,
    "covered_sections": 7,
    "coverage_ratio": 1.00,
    "uncovered_sections": []
  }
}
```

## Key Observations

**Verdict = BLOCK:**
- 4 blocking violations (F1-F4)
- Each violation directly contradicts specification requirements
- Truth context confirms these are mandatory, not optional
- Prior ruling supports blocking decision

**Complete Citation Chain:**
- Finding F1: E001, E002, E101 → T001, T003 → B1-B7
- Finding F2: E003 → T001, T003 → B8-B14
- Finding F3: E004 → T002 → B15-B21
- Finding F4: E004, E005 → T002, T004 → B22-B28
- Every finding can be traced back through beads to evidence and truth

**Corrective Guidance:**
- Specific, actionable recommendations (7 items)
- Address each violation directly
- Suggest alternative paths (model quantization, licensing)
- Require validation testing before future similar proposals

**Audit Trail:**
- Complete version references (spec, index, dolt all at abc123def456)
- Trace metrics (28 beads total, 9 evidence packets, 4 truth entries)
- 100% coverage (7/7 sections)

## Success Criteria

✅ **Pass if:**
- verdict = "BLOCK"
- 4 findings (F1-F4) present
- All findings have severity = "blocking"
- Every finding cites evidence + truth_context + trace
- Corrections list has 5+ actionable items
- Coverage ratio = 1.00 (100%)
- Audit trail is complete

❌ **Fail if:**
- verdict = "PASS" (incorrect, there are violations)
- verdict = "REVISE" (too lenient, these are clear violations)
- Fewer than 4 findings
- Any finding lacks evidence citations
- No corrective guidance provided
- Coverage ratio < 0.95

## Why BLOCK (not REVISE)

**BLOCK is correct because:**
- Clear, unambiguous violations (not uncertain or ambiguous)
- Multiple critical requirements violated (4 blocking findings)
- Truth context makes requirements explicit (mandatory, not recommended)
- Prior ruling shows organizational precedent for rejecting similar approaches
- No missing information - we have complete evidence and context

**REVISE would be wrong because:**
- REVISE is for ambiguous cases or missing information
- These violations are clear and well-documented
- The proposal cannot be "clarified" into compliance - it fundamentally contradicts the spec

## Human Review Next

After this judgment is emitted:
1. Human reviews the judgment (Test S1_11)
2. Human can drill down through audit trail
3. Human can verify each citation
4. Human can accept judgment or provide correction
5. If correction needed, it gets stored in Dolt for future runs

## Related Blueprint Sections

- **Runtime Workflow:** Step 14 "Emit Judgment" (lines 116-133)
- **Judgment Schema:** lines 265-289
- **Verdict Logic:** lines 118-122
- **AuditBundle:** lines 135-136
