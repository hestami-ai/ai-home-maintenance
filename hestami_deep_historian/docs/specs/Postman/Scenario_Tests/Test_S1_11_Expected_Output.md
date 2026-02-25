# Test S1_11: Human Correction - Expected Output

## Purpose
Simulate a human reviewer assessing the Historian's judgment for accuracy, clarity, and auditability.

## Expected Behavior

The LLM (playing the role of a human reviewer) should:
1. Evaluate whether the verdict is appropriate
2. Assess each finding for accuracy and support
3. Verify traceability of the audit trail
4. Evaluate corrective guidance quality
5. Identify strengths and any concerns
6. Decide whether to accept, request clarification, or reject
7. Determine if a correction is needed (to be stored in Dolt)

## Expected JSON Response

```json
{
  "run_id": "RUN-2026-001-20260201T101545Z",
  "reviewer": "Human Reviewer (Simulated)",
  "review_date": "2026-02-01",
  "overall_assessment": "accept_with_notes",
  "verdict_agreement": {
    "agree_with_verdict": true,
    "comment": "BLOCK verdict is absolutely appropriate. The proposal violates 4 mandatory specification requirements, all well-documented with evidence and truth context. The truth context (T001, T003) makes it explicit that SuperPoint/SuperGlue are required components, not optional, and a similar prior proposal was rejected. There is no ambiguity here - this is a clear case for BLOCK, not REVISE."
  },
  "findings_review": [
    {
      "finding_id": "F1",
      "accurate": true,
      "well_supported": true,
      "comment": "Finding F1 (SuperPoint → ORB) is accurate and well-supported. The evidence chain E001→E002→E101 clearly shows SuperPoint is specified, and truth context T001 explicitly states it's REQUIRED based on testing. The explanation cites the specific failure rate (23% for ORB on low-texture surfaces) which adds credibility. The trace reference (B1-B7) allows me to audit the reasoning if needed."
    },
    {
      "finding_id": "F2",
      "accurate": true,
      "well_supported": true,
      "comment": "Finding F2 (SuperGlue → BFMatcher) is similarly well-supported. E003 cites the specification requirement, and the same truth context applies. The finding correctly notes that the prior ruling (R2025-087) rejected traditional feature detection approaches as a system."
    },
    {
      "finding_id": "F3",
      "accurate": true,
      "well_supported": true,
      "comment": "Finding F3 (maxFeaturesPerImage 2000 → 1000) is particularly strong because truth context T002 provides empirical data: values below 1500 cause >15% SfM failure. The proposal's 1000 is well below this threshold. This is not a subjective judgment but a data-driven finding."
    },
    {
      "finding_id": "F4",
      "accurate": true,
      "well_supported": true,
      "comment": "Finding F4 (disabling sub-pixel refinement) is valid. The proposal assumes ORB's corner refinement is sufficient, but this assumption is contradicted by E005 and truth context T002/T004 which state sub-pixel refinement is required for accuracy targets. The finding correctly identifies this as an unvalidated assumption."
    }
  ],
  "traceability_assessment": {
    "can_trace_to_evidence": true,
    "can_trace_to_spec": true,
    "audit_trail_complete": true,
    "comment": "Excellent traceability. Every finding cites specific evidence packets (E001-E005), truth context entries (T001-T004), and reasoning traces (B1-B28). The audit trail references (spec_commit abc123def456, trace_id TRACE-2026-001) allow me to retrieve the full audit bundle and verify any aspect of the judgment. I can follow the chain: Claim → Evidence → Truth Context → Reasoning Beads → Finding → Verdict. This meets enterprise audit standards."
  },
  "corrective_guidance_assessment": {
    "helpful": true,
    "actionable": true,
    "comment": "The corrective guidance is specific and actionable. Items 1-4 directly address the violations. Items 5-7 provide constructive alternatives (model quantization, licensing agreements, testing requirements) rather than just saying 'no'. Item 7 is particularly good: it establishes a process for future similar proposals (conduct testing, submit for design review). This guidance helps the developer understand both what NOT to do and what TO do instead."
  },
  "strengths": [
    "Clear, unambiguous verdict with strong justification",
    "Every finding backed by multiple evidence sources (spec + truth context + prior ruling)",
    "Complete citation chains allow full auditability",
    "100% coverage of expected specification sections",
    "Specific, actionable corrective guidance",
    "Appropriate use of prior ruling (R2025-087) as precedent",
    "Evidence of counter-evidence consideration (E101)",
    "Empirical data in findings (23% failure rate, >15% SfM failure) strengthens credibility",
    "Structured format makes it easy to review and challenge",
    "Clear separation between violations (F1-F4) and dependent claims (C5-C7)"
  ],
  "concerns": [
    "Minor: The verdict summary could explicitly mention prior ruling R2025-087 to strengthen the precedent argument. Currently it's mentioned in findings but not in the top-level summary.",
    "Minor: Finding F4 could benefit from explicitly stating what the ±2mm accuracy target is and why sub-pixel refinement is critical for it, rather than just referencing T002/T004.",
    "Question: Were assumptions A1-A3 (ORB quality sufficient, accuracy achievable) explicitly addressed in the reasoning traces? The findings focus on spec violations but don't directly validate or invalidate the assumptions. This is OK since the violations are blocking anyway, but might be worth noting.",
    "Coverage report shows 100% but doesn't list which specific sections were covered. For full transparency, the audit bundle should include the section list (node_5_2, node_8, node_3, etc.)."
  ],
  "recommended_actions": [
    "Accept this judgment and communicate BLOCK verdict to the Executor (developer).",
    "Provide the full judgment with corrective guidance to the developer.",
    "Store this judgment and audit bundle in Dolt as a precedent (similar to R2025-087).",
    "Update the verdict summary to mention prior ruling R2025-087 (minor enhancement).",
    "Consider scheduling a design review meeting to discuss alternative approaches for SDK size reduction that comply with architectural requirements.",
    "If the developer still wants to pursue non-ML approaches, establish a formal exception process requiring comparative testing, accuracy validation, and architecture review board approval."
  ],
  "correction_needed": false,
  "correction_details": null
}
```

## Key Observations

**Overall Assessment: accept_with_notes**
- The judgment is fundamentally sound and accurate
- "notes" refers to minor suggestions for improvement (mention prior ruling in summary)
- Not "accept" without notes because there are small enhancements possible
- Not "request_clarification" because nothing is unclear
- Not "reject" because the judgment is correct

**All Findings Validated:**
- F1-F4 are all accurate and well-supported
- Human can trace each finding to evidence
- Human can see the empirical data supporting conclusions
- Human agrees these are blocking violations

**Excellent Auditability:**
- can_trace_to_evidence = true
- can_trace_to_spec = true
- audit_trail_complete = true
- Human reviewer explicitly states this "meets enterprise audit standards"

**Concerns are Minor:**
- Not errors, just suggestions for enhancement
- Verdict summary could mention R2025-087
- Finding F4 could be more explicit about accuracy target
- Audit bundle could list covered sections explicitly
- None of these affect the correctness of the verdict

**No Correction Needed:**
- correction_needed = false
- The judgment is accurate as-is
- The recommendations are process improvements, not corrections to the judgment itself

## Success Criteria

✅ **Pass if:**
- overall_assessment = "accept" or "accept_with_notes"
- agree_with_verdict = true
- All findings (F1-F4) marked as accurate = true and well_supported = true
- Traceability assessment: all three fields = true
- Corrective guidance: helpful = true, actionable = true
- At least 5 strengths identified
- correction_needed = false (judgment is correct)

❌ **Fail if:**
- overall_assessment = "reject"
- agree_with_verdict = false
- Any finding marked inaccurate or poorly supported
- Traceability issues (cannot trace to evidence or spec)
- Corrective guidance not actionable
- correction_needed = true (would indicate an error in the judgment)

## What Happens Next

**If accepted (as expected):**
1. Judgment is communicated to Executor with corrective guidance
2. Audit bundle stored for future reference
3. This run becomes a precedent (like R2025-087)
4. Developer revises proposal to comply with spec

**If correction were needed (not the case here):**
1. Human would set correction_needed = true
2. correction_details would describe the error
3. Correction gets stored in Dolt
4. System could be re-run with updated truth/rules
5. Correction feeds into training data for model improvement

## Blueprint Integration

**Correction Workflow (Blueprint lines 292-293):**
> A Correction could be as simple as a record: `{ run_id, issue_description, resolution }` with resolution being either "adjust truth (Dolt) with X" or "mark model error for training".

**Training from Corrections (Blueprint lines 425-426):**
> Every time a human corrects the system, that's valuable data. We will log corrections in a structured way, and periodically incorporate them into the training set.

**This test demonstrates:**
- Human can review and validate AI judgment
- Audit trail enables verification of every claim
- System produces defensible, traceable decisions
- Human maintains oversight (approval gate)
- Corrections feed back into system improvement

## Related Blueprint Sections

- **Judgment Schema:** lines 265-289
- **AuditBundle:** lines 293-295
- **Correction:** lines 292-293
- **Training from Corrections:** lines 425-426
- **Conclusion:** lines 898-902 (verifiable epistemic machine)
