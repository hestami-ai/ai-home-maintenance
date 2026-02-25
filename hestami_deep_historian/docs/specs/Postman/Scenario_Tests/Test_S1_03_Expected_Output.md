# Test S1_03: Coverage Plan - Expected Output

## Purpose
Define which specification sections MUST be consulted to ensure complete, thorough verification of the proposal.

## Expected Behavior

The LLM should:
1. Identify all spec sections directly affected by the claims
2. Identify related sections that could reveal violations
3. Mark mandatory sections (omitting them = incomplete verification)
4. Link each section to the claims it helps verify
5. Define invariants that must always hold
6. Set an appropriate coverage threshold

## Expected JSON Response

```json
{
  "proposal_id": "PROP-2026-001",
  "expected_sections": [
    {
      "id": "S1",
      "section_title": "Feature Detection System",
      "node_id": "node_5_2",
      "reason": "Specifies required feature detection approach (SuperPoint), matching (SuperGlue), and configuration parameters",
      "related_claims": ["C1", "C2", "C3", "C4"],
      "mandatory": true
    },
    {
      "id": "S2",
      "section_title": "Feature Detection System - Configuration",
      "node_id": "node_5_2_config",
      "reason": "Defines maxFeaturesPerImage (2000) and enableSubPixelRefinement (true) requirements",
      "related_claims": ["C3", "C4"],
      "mandatory": true
    },
    {
      "id": "S3",
      "section_title": "Feature Detection System - ML Models",
      "node_id": "node_5_2_models",
      "reason": "Specifies SuperPoint (2.5MB) and SuperGlue (4.2MB) models with Core ML requirement",
      "related_claims": ["C1", "C2", "C8", "C9"],
      "mandatory": true
    },
    {
      "id": "S4",
      "section_title": "Feature Detection System - Performance Requirements",
      "node_id": "node_5_2_perf",
      "reason": "Specifies feature detection < 200ms, matching < 300ms, memory < 150MB targets",
      "related_claims": ["C5", "C6", "C7"],
      "mandatory": true
    },
    {
      "id": "S5",
      "section_title": "Performance Requirements",
      "node_id": "node_8",
      "reason": "Defines overall performance targets including processing time and memory usage budgets",
      "related_claims": ["C5", "C6", "C7"],
      "mandatory": true
    },
    {
      "id": "S6",
      "section_title": "Performance Requirements - Accuracy Targets",
      "node_id": "node_8_3",
      "reason": "Specifies ±2mm accuracy requirement that assumptions (A3) claim can still be met",
      "related_claims": ["C1", "C2"],
      "mandatory": true
    },
    {
      "id": "S7",
      "section_title": "Technical Architecture - Key Features",
      "node_id": "node_3",
      "reason": "Lists deep learning feature detection and neural network matching as key architectural features",
      "related_claims": ["C1", "C2"],
      "mandatory": true
    },
    {
      "id": "S8",
      "section_title": "Technical Challenges - Feature Detection",
      "node_id": "node_9_1",
      "reason": "May describe why ML-based detection was chosen and challenges with traditional methods",
      "related_claims": ["C1", "C2"],
      "mandatory": false
    }
  ],
  "must_check_invariants": [
    "Feature detection and matching must support Structure from Motion (SfM) reconstruction",
    "Feature quality must enable ±2mm measurement accuracy",
    "System must work on all iOS 15.0+ devices (universal compatibility)",
    "RANSAC outlier rejection must be compatible with chosen feature detector",
    "Sub-pixel accuracy must be achieved for precise measurements"
  ],
  "critical_claims": ["C1", "C2", "C3", "C4"],
  "coverage_threshold": 0.95,
  "notes": "This proposal modifies core architectural decisions (ML vs traditional CV) and multiple critical configuration parameters. Coverage must be near-complete (95%) to avoid missing requirements. All 7 mandatory sections must be consulted. Counter-evidence queries are essential for critical claims C1-C4 to find any language about requirements vs recommendations, mandatory vs optional ML usage, or constraints on alternative approaches."
}
```

## Key Observations

**Mandatory Sections (7 total):**
- S1-S7 are all mandatory because they directly specify requirements that the proposal modifies
- Omitting any of these would mean we might miss a critical violation
- S8 is optional but helpful for context

**Coverage Threshold = 0.95:**
- Very high threshold because:
  - Proposal changes critical architecture (ML → traditional CV)
  - Multiple critical configuration changes (C3, C4)
  - High-risk assumptions about accuracy (A1, A3)
- If actual coverage falls below 95%, trigger FAIL_COVERAGE_GAP

**Invariants:**
These are fundamental requirements that transcend specific sections:
- Must support SfM/MVS (architectural constraint)
- Must achieve ±2mm accuracy (core success metric)
- Must work universally (compatibility requirement)
- These should be verified even if not explicitly stated in retrieved sections

## Success Criteria

✅ **Pass if:**
- At least 6 expected sections identified
- All critical claims (C1-C4) linked to sections
- Mandatory sections include Feature Detection System and Performance Requirements
- Coverage threshold ≥ 0.90
- At least 3 invariants identified
- Notes explain why high coverage is needed

❌ **Fail if:**
- Fewer than 4 sections identified
- Critical claims not linked to any sections
- No mandatory sections marked
- Coverage threshold < 0.80
- No invariants listed

## How This Feeds Forward

**Into Retrieval Plan (Test S1_04):**
- Each expected section becomes a query target
- Each critical claim gets both supporting and counter-evidence queries
- Each invariant may generate a validation query

**Into Validation (Test S1_09):**
- After reasoning, coverage is measured: (sections_covered / expected_sections)
- If coverage_ratio < 0.95 → FAIL_COVERAGE_GAP
- Any mandatory section missed → automatic failure

## Related Blueprint Sections

- **Runtime Workflow:** Step 5 "Generate Coverage Plan" (lines 72-73)
- **Coverage Plan Schema:** lines 165-174
- **Coverage Validation:** lines 108-112 (validation step)
- **FAIL_COVERAGE_GAP:** lines 334-336
