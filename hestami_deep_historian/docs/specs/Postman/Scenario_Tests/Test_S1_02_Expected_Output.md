# Test S1_02: Claim Decomposition - Expected Output

## Purpose
Break down the Executor's proposal into atomic, verifiable claims that can be individually checked against the specification.

## Expected Behavior

The LLM should:
1. Extract every factual statement that can be verified against the spec
2. Separate claims from assumptions and design decisions
3. Categorize each claim by type and criticality
4. Identify potential omissions (things not addressed)
5. Flag which claims require spec verification

## Expected JSON Response Structure

```json
{
  "proposal_id": "PROP-2026-001",
  "claims": [
    {
      "id": "C1",
      "text": "Feature detection will use OpenCV ORB instead of SuperPoint",
      "type": "design_decision",
      "category": "feature_detection",
      "criticality": "critical",
      "requires_spec_verification": true
    },
    {
      "id": "C2",
      "text": "Feature matching will use cv::BFMatcher with Hamming distance instead of SuperGlue",
      "type": "design_decision",
      "category": "feature_detection",
      "criticality": "critical",
      "requires_spec_verification": true
    },
    {
      "id": "C3",
      "text": "maxFeaturesPerImage will be set to 1000",
      "type": "requirement_claim",
      "category": "configuration",
      "criticality": "critical",
      "requires_spec_verification": true
    },
    {
      "id": "C4",
      "text": "enableSubPixelRefinement will be disabled (set to false)",
      "type": "requirement_claim",
      "category": "configuration",
      "criticality": "critical",
      "requires_spec_verification": true
    },
    {
      "id": "C5",
      "text": "Feature detection processing time target is < 100ms per image",
      "type": "performance_claim",
      "category": "performance",
      "criticality": "important",
      "requires_spec_verification": true
    },
    {
      "id": "C6",
      "text": "Feature matching processing time target is < 150ms per pair",
      "type": "performance_claim",
      "category": "performance",
      "criticality": "important",
      "requires_spec_verification": true
    },
    {
      "id": "C7",
      "text": "Memory usage target is < 100MB for feature detection",
      "type": "performance_claim",
      "category": "performance",
      "criticality": "important",
      "requires_spec_verification": true
    },
    {
      "id": "C8",
      "text": "SDK size will be reduced by 6.7MB by eliminating ML models",
      "type": "factual_claim",
      "category": "architecture",
      "criticality": "minor",
      "requires_spec_verification": false
    },
    {
      "id": "C9",
      "text": "No Core ML integration will be needed",
      "type": "factual_claim",
      "category": "architecture",
      "criticality": "minor",
      "requires_spec_verification": false
    }
  ],
  "assumptions": [
    {
      "id": "A1",
      "text": "ORB feature quality is sufficient for Structure from Motion and Multi-View Stereo reconstruction",
      "risk_level": "high"
    },
    {
      "id": "A2",
      "text": "Brute-force matching speed is acceptable for typical image pairs",
      "risk_level": "high"
    },
    {
      "id": "A3",
      "text": "Accuracy targets of ±2mm can still be achieved with ORB-based features",
      "risk_level": "high"
    },
    {
      "id": "A4",
      "text": "Device compatibility remains universal (iOS 15.0+)",
      "risk_level": "low"
    },
    {
      "id": "A5",
      "text": "ORB provides sub-pixel accuracy via corner refinement, making additional refinement redundant",
      "risk_level": "medium"
    }
  ],
  "decisions": [
    {
      "id": "D1",
      "text": "Use traditional CV approach (ORB) instead of ML-based approach (SuperPoint)",
      "rationale": "To reduce SDK size, eliminate ML licensing complexity, and simplify codebase"
    },
    {
      "id": "D2",
      "text": "Reduce maxFeaturesPerImage from 2000 to 1000",
      "rationale": "ORB is faster, can process more images in same time budget"
    },
    {
      "id": "D3",
      "text": "Disable sub-pixel refinement",
      "rationale": "ORB already provides sub-pixel accuracy, making additional refinement redundant"
    }
  ],
  "potential_omissions": [
    "No mention of impact on accuracy (±2mm target)",
    "No mention of testing methodology to validate ORB vs SuperPoint equivalence",
    "No discussion of feature matching quality metrics (precision/recall)",
    "No mention of RANSAC outlier rejection compatibility",
    "No discussion of failure modes (e.g., low-texture scenarios)",
    "No mention of whether ML models are mandatory in the specification",
    "No discussion of alternative ML-free approaches that were considered"
  ]
}
```

## Key Observations

**Critical Claims (C1-C4):**
These directly contradict or modify specification requirements and MUST be verified against the spec. The specification explicitly mentions:
- SuperPoint for feature detection
- SuperGlue for feature matching
- maxFeaturesPerImage = 2000
- enableSubPixelRefinement = true

**High-Risk Assumptions (A1-A3):**
These assumptions are critical to the proposal's success but are not verified:
- Will ORB features work as well as SuperPoint for 3D reconstruction?
- Will accuracy targets still be met?
- Is brute-force matching fast enough?

**Potential Omissions:**
The proposal doesn't address several important aspects:
- How will accuracy be validated?
- Are ML models mandatory or recommended?
- What testing will prove equivalence?

## Success Criteria

✅ **Pass if:**
- All 9 claims correctly extracted (C1-C9)
- Claims that modify spec requirements marked as "critical" (C1-C4)
- All 5 assumptions identified (A1-A5)
- High-risk assumptions correctly flagged (A1-A3)
- At least 5 potential omissions identified
- All critical claims have requires_spec_verification = true

❌ **Fail if:**
- Fewer than 7 claims extracted
- Critical claims not flagged as "critical"
- High-risk assumptions not identified
- No omissions listed
- Claims and assumptions are mixed together

## Why This Matters

**For the Historian workflow:**
- Each claim (C1-C9) will drive a separate evidence retrieval query
- Critical claims will require both supporting AND counter-evidence
- Assumptions will inform the uncertainty/risk assessment
- Omissions may trigger coverage gap failures

**For the final judgment:**
- If C1-C4 violate spec requirements → BLOCK verdict
- If assumptions cannot be validated → REVISE verdict
- If omissions are significant → FAIL_COVERAGE_GAP

## Related Blueprint Sections

- **Runtime Workflow:** Step 4 "Decompose Claims" (lines 70-73)
- **ClaimSet Schema:** lines 149-164
- **Critical Claim Handling:** lines 82-83 (counter-evidence for critical claims)
