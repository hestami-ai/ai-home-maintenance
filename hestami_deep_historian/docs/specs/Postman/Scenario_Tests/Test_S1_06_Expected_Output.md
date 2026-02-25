# Test S1_06: PageIndex Counter-Evidence - Expected Output

## Purpose
Simulate PageIndex searching for contradictory/disconfirming evidence per the Blueprint's accuracy-first policy.

## Expected Behavior

The LLM should:
1. Search for evidence that could support OR contradict the proposal
2. Identify whether each piece supports, contradicts, or is neutral
3. Focus on finding constraints that prevent alternative approaches
4. Look for prescriptive language ("must", "shall", "required")
5. Return 3-4 counter-evidence packets

## Expected Counter-Evidence Packets

**E101: Technical Rationale for ML**
- Section: Technical Challenges - Feature Detection
- Content: "Problem: Detecting reliable features in low-texture areas. Solutions: Use ML-based feature detection (SuperPoint) that's trained on diverse scenarios."
- evidence_type: contradicts_proposal
- Reasoning: Explains WHY ML is needed (low-texture scenarios where traditional methods fail)

**E102: Architectural Features**
- Section: Technical Architecture - Key Features
- Content: "Deep learning-based feature detection (SuperPoint). Neural network feature matching (SuperGlue)."
- evidence_type: contradicts_proposal
- Reasoning: Lists ML as a key architectural feature, suggesting it's fundamental to the design

**E103: Configuration as Spec**
- Section: Feature Detection System - Configuration
- Content: "let enableSubPixelRefinement: Bool = true"
- evidence_type: contradicts_proposal
- Reasoning: Specification shows "true", not "optional" or "recommended"

## Key Observations

**Contradictory Evidence Found:**
- All evidence packets contradict the proposal
- No supporting evidence found (no mention of "optional", "recommended", or alternatives)
- Prescriptive tone suggests requirements, not suggestions

**Why This Matters:**
- Counter-evidence requirement (Blueprint lines 82-83): "Critically, include at least one query designed to find contradictory or disconfirming evidence for each major claim"
- Prevents oversight bias
- Ensures Historian doesn't just confirm the proposal but actively tries to refute it
- Strengthens confidence in BLOCK verdict

## Success Criteria

✅ **Pass if:**
- 3-4 counter-evidence packets returned
- query_type = "counter_evidence"
- Each packet has evidence_type field (supports/contradicts/neutral)
- retrieval_metadata.contradictory_evidence_found = true
- At least 2 packets marked "contradicts_proposal"
- Reasoning explains what the evidence suggests

❌ **Fail if:**
- No counter-evidence packets
- All packets marked "neutral" or "supports_proposal"
- No evidence_type field
- No reasoning provided

## Related Blueprint Sections

- **Counter-Evidence Requirement:** lines 82-83
- **RetrievalPlan:** lines 176-192
- **Accuracy-First Policy:** line 84
