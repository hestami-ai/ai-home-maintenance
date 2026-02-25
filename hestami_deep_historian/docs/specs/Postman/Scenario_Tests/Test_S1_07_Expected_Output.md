# Test S1_07: Dolt Truth Context - Expected Output

## Purpose
Simulate Dolt returning truth context (prior interpretations, rulings, policies) that enrich the specification evidence.

## Expected Behavior

The LLM should:
1. Return truth context entries organized by spec section (node_id)
2. Include different context types (interpretation, ruling, policy, exception)
3. Provide authority_level (mandatory/recommended/informational)
4. Link context to related claims
5. Include prior rulings on similar proposals
6. Reference the dolt_commit hash for version control

## Expected Truth Context Entries

**T001: Design Decision (Interpretation)**
- node_id: node_5_2
- type: interpretation
- Text: "SuperPoint explicitly chosen over traditional feature detectors. Testing showed ORB failed on 23% of low-texture wall surfaces. Decision: SuperPoint is REQUIRED."
- authority_level: mandatory
- Related claims: C1, C2

**T002: Configuration Policy**
- node_id: node_5_2_config
- type: policy
- Text: "maxFeaturesPerImage = 2000 determined through testing. Values below 1500 resulted in SfM failure rates >15%. This is a MINIMUM requirement."
- authority_level: mandatory
- Related claims: C3

**T003: Prior Ruling (R2025-087)**
- Type: ruling
- Proposal: PROP-2025-087 (similar proposal to use SIFT)
- Verdict: BLOCK
- Summary: "Traditional feature detectors don't meet performance targets. ML-based feature detection is mandatory for ±2mm accuracy."
- Relevance: Directly analogous to current proposal

**T004: Sub-Pixel Policy**
- node_id: node_5_2_config
- type: policy
- Text: "Sub-pixel refinement is required for achieving ±2mm accuracy target"
- authority_level: mandatory
- Related claims: C4

## Key Observations

**Authority Levels:**
- All entries marked "mandatory" (not "recommended" or "informational")
- This strengthens the BLOCK verdict (these aren't suggestions)

**Prior Ruling:**
- R2025-087 is critical precedent
- Shows organizational precedent for rejecting similar proposals
- Verdict was BLOCK for essentially the same reason
- Provides consistency in decision-making

**Empirical Data:**
- T001: 23% failure rate for ORB
- T002: >15% SfM failure for values <1500
- Makes the truth context evidence-based, not just opinion

**Version Control:**
- dolt_commit: abc123def456 ensures reproducibility
- Can query this exact version again
- Tracks when these decisions were made

## Success Criteria

✅ **Pass if:**
- 3-4 truth context entries returned
- context_map organized by node_id
- At least 1 prior ruling included
- All entries have authority_level field
- authority_level = "mandatory" for design decisions
- dolt_commit hash provided
- Related claims correctly linked

❌ **Fail if:**
- No truth context entries
- No prior rulings included
- All authority_level = "informational" (should be mandatory)
- No dolt_commit hash
- Missing context types

## Why This Matters

**For Reasoning:**
- Truth context makes implicit requirements explicit
- Provides rationale behind specification choices
- Offers empirical validation (failure rates)

**For Verdict:**
- Mandatory authority_level strengthens BLOCK decision
- Prior ruling provides precedent
- Removes ambiguity ("is SuperPoint required?")

**For Audit:**
- dolt_commit enables exact reproduction
- Source field shows where context came from
- Date field shows when decision was made

## Related Blueprint Sections

- **Truth Context Schema:** lines 210-225
- **Dolt Description:** lines 50
- **Assemble Truth Context:** lines 89
- **Versioned Truth State:** lines 66
