# Test S1_09: Trace Validation - Expected Output

## Purpose
Validate that the reasoning trace follows logical consistency rules and coverage expectations.

## Expected Behavior

The LLM should:
1. Check trace validation rules (evidence citation, logical consistency)
2. Check coverage validation (all expected sections consulted)
3. Report validation status (pass/fail for each rule)
4. Calculate coverage ratio
5. Identify any violations or gaps
6. Determine if validation passes overall

## Expected Validation Checks

**Trace Validation Rules:**

✅ **Rule 1: No normative conclusion without cited normative premise**
- Check: Every VERDICT_STEP must cite evidence or truth context
- Status: PASS (B7 cites E001, E002, E101, T001, T003)

✅ **Rule 2: Every violation flagged must have evidence pointer**
- Check: Finding F1 cites evidence packets
- Status: PASS (F1 references E001, E002, E101)

✅ **Rule 3: Contradictory intermediate findings resolved or marked**
- Check: No contradictions in beads B1-B7
- Status: PASS (all beads agree: non-compliant)

✅ **Rule 4: Counter-evidence considered for critical claims**
- Check: C1 is critical, must have COUNTER_EVIDENCE_CHECK bead
- Status: PASS (B5 exists and considers E101)

✅ **Rule 5: Reasoning depth meets minimum**
- Check: Critical claim should have ≥6 beads
- Status: PASS (C1 has 7 beads)

**Coverage Validation:**

✅ **Expected Sections Check**
- Expected: 7 sections (S1-S7 from Coverage Plan)
- Covered: 7 sections
- Coverage ratio: 7/7 = 1.00 (100%)
- Threshold: 0.95 (95% required)
- Status: PASS (exceeds threshold)

✅ **Mandatory Sections Check**
- Mandatory: S1, S2, S3, S4, S5, S6, S7
- All mandatory sections covered: YES
- Status: PASS

✅ **Evidence for All Critical Claims**
- C1: Has evidence (E001, E002, E101) ✓
- C2: Has evidence (E003) ✓
- C3: Has evidence (E004) ✓
- C4: Has evidence (E004, E005) ✓
- Status: PASS

## Expected JSON Response

```json
{
  "proposal_id": "PROP-2026-001",
  "validation_timestamp": "2026-02-01T10:15:35Z",
  "trace_validation": {
    "overall_status": "PASS",
    "rules_checked": 5,
    "rules_passed": 5,
    "rules_failed": 0,
    "rule_results": [
      {
        "rule_id": "R1",
        "rule_name": "No normative conclusion without cited normative premise",
        "status": "PASS",
        "details": "All VERDICT_STEP beads cite evidence or truth context"
      },
      {
        "rule_id": "R2",
        "rule_name": "Every violation must have evidence pointer",
        "status": "PASS",
        "details": "Findings F1-F4 all cite evidence packets"
      },
      {
        "rule_id": "R3",
        "rule_name": "Contradictory findings resolved or marked",
        "status": "PASS",
        "details": "No contradictions found in reasoning traces"
      },
      {
        "rule_id": "R4",
        "rule_name": "Counter-evidence considered for critical claims",
        "status": "PASS",
        "details": "Claims C1-C4 all have COUNTER_EVIDENCE_CHECK beads"
      },
      {
        "rule_id": "R5",
        "rule_name": "Reasoning depth meets minimum",
        "status": "PASS",
        "details": "Critical claims have 6-7 beads each, exceeding minimum of 5"
      }
    ]
  },
  "coverage_validation": {
    "overall_status": "PASS",
    "expected_sections": 7,
    "covered_sections": 7,
    "coverage_ratio": 1.00,
    "threshold": 0.95,
    "exceeds_threshold": true,
    "section_coverage": [
      {"section_id": "S1", "covered": true},
      {"section_id": "S2", "covered": true},
      {"section_id": "S3", "covered": true},
      {"section_id": "S4", "covered": true},
      {"section_id": "S5", "covered": true},
      {"section_id": "S6", "covered": true},
      {"section_id": "S7", "covered": true}
    ],
    "mandatory_sections_covered": true,
    "uncovered_sections": []
  },
  "critical_claims_validation": {
    "overall_status": "PASS",
    "critical_claims": ["C1", "C2", "C3", "C4"],
    "all_have_evidence": true,
    "all_have_counter_evidence": true,
    "claim_details": [
      {
        "claim_id": "C1",
        "has_evidence": true,
        "evidence_count": 3,
        "has_counter_evidence": true,
        "has_truth_context": true
      },
      {
        "claim_id": "C2",
        "has_evidence": true,
        "evidence_count": 1,
        "has_counter_evidence": true,
        "has_truth_context": true
      },
      {
        "claim_id": "C3",
        "has_evidence": true,
        "evidence_count": 1,
        "has_counter_evidence": false,
        "has_truth_context": true
      },
      {
        "claim_id": "C4",
        "has_evidence": true,
        "evidence_count": 2,
        "has_counter_evidence": false,
        "has_truth_context": true
      }
    ]
  },
  "overall_validation_result": "PASS",
  "can_proceed_to_judgment": true,
  "issues": []
}
```

## Key Observations

**All Validations Pass:**
- Trace validation: 5/5 rules passed
- Coverage validation: 100% (exceeds 95% threshold)
- Critical claims: All have evidence

**Why Validation Passes:**
- Every conclusion backed by evidence (R1)
- No unsupported violations (R2)
- No logical contradictions (R3)
- Counter-evidence considered (R4)
- Sufficient reasoning depth (R5)
- Complete coverage (100%)
- All mandatory sections covered

**Can Proceed:**
- overall_validation_result = "PASS"
- can_proceed_to_judgment = true
- No issues array is empty
- Ready to emit judgment (Test S1_10)

## Failure Scenarios (Not Expected Here)

**If validation failed:**
- FAIL_TRACE_INVALID if any trace rule fails
- FAIL_COVERAGE_GAP if coverage_ratio < 0.95
- can_proceed_to_judgment = false
- issues array would list specific problems
- System would attempt recovery or abort

## Success Criteria

✅ **Pass if:**
- overall_validation_result = "PASS"
- trace_validation.overall_status = "PASS"
- coverage_validation.overall_status = "PASS"
- coverage_ratio ≥ 0.95
- mandatory_sections_covered = true
- all_have_evidence = true
- can_proceed_to_judgment = true
- issues array is empty

❌ **Fail if:**
- overall_validation_result = "FAIL"
- Any trace validation rule fails
- coverage_ratio < 0.95
- mandatory sections not covered
- Critical claims missing evidence
- can_proceed_to_judgment = false

## Related Blueprint Sections

- **Validate Trace and Coverage:** lines 108-112
- **Trace Validation Rules:** lines 110
- **Coverage Validation:** lines 112
- **FAIL_TRACE_INVALID:** lines 336-337
- **FAIL_COVERAGE_GAP:** lines 334-336
- **Coverage Threshold:** line 112
