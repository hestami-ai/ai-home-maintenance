# Test S1_01: Executor Proposal - Expected Output

## Purpose
Validate that the Executor's proposal is properly structured and contains all required information for the Historian verification workflow.

## Expected Behavior

The LLM should:
1. Extract the proposal metadata (ID, component, submitter)
2. Validate that the proposal has required sections (background, proposed changes, assumptions, questions)
3. Confirm the proposal is ready for claim decomposition
4. Provide a brief summary of what is being proposed

## Expected JSON Response

```json
{
  "proposal_id": "PROP-2026-001",
  "component": "Feature Detection System",
  "validation_status": "valid",
  "validation_errors": [],
  "summary": "Proposal to replace ML-based feature detection (SuperPoint/SuperGlue) with traditional OpenCV ORB detector and brute-force matching to reduce SDK size by 6.7MB, improve performance, and eliminate ML licensing complexity.",
  "ready_for_decomposition": true
}
```

## Key Observations

**What makes this valid:**
- Has unique proposal ID (PROP-2026-001)
- Clearly identifies affected component (Feature Detection System)
- Provides structured list of proposed changes (6 items)
- Includes assumptions and questions
- Contains enough detail for claim extraction

**What would make it invalid:**
- Missing proposal ID
- No clear indication of which component/system is affected
- Vague or unstructured changes (e.g., "make it better")
- No assumptions or technical details
- Contradictory statements

## Success Criteria

✅ **Pass if:**
- validation_status = "valid"
- validation_errors array is empty
- proposal_id correctly extracted
- component correctly identified
- summary accurately reflects the main proposal
- ready_for_decomposition = true

❌ **Fail if:**
- validation_status = "invalid"
- validation_errors contains items
- Any required field is null or missing
- summary is generic or inaccurate

## Notes

This is the entry point to the Historian workflow. The proposal must pass validation before the Historian can:
1. Decompose it into claims (Test S1_02)
2. Generate a coverage plan (Test S1_03)
3. Retrieve evidence (Tests S1_04-07)
4. Perform reasoning (Tests S1_08-09)
5. Emit judgment (Test S1_10)

If validation fails here with `FAIL_INPUT_INVALID`, the workflow terminates immediately with an error message to the Executor.

## Related Blueprint Sections

- **Runtime Workflow:** Step 1 "Ingest Proposal" (lines 64-65)
- **Failure Mode:** FAIL_INPUT_INVALID (line 332)
- **Proposal Schema:** lines 147-148
