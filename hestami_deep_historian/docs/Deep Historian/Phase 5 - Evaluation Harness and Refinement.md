# Phase 5 - Evaluation Harness & Refinement

## Objective

Build the automated evaluation framework, create a comprehensive test suite, measure system quality against defined metrics, and refine based on results. By the end of this phase, the system meets evaluation targets and is ready for initial deployment.

---

## 5.1 Test Scenario Suite

- [ ] Create test scenario format:
  - [ ] YAML/JSON structure with:
    - [ ] Proposal text
    - [ ] Expected verdict
    - [ ] Expected findings (optional)
    - [ ] Expected evidence sections (optional)
    - [ ] Expected failure mode (if testing failures)
- [ ] Create scenarios for each category:

### Basic Compliance
- [ ] Clear PASS case (proposal meets all requirements)
- [ ] Clear BLOCK case (proposal violates requirement)
- [ ] Multiple claims, all compliant → PASS
- [ ] Multiple claims, one violation → BLOCK

### Edge Cases
- [ ] Ambiguous requirement → REVISE
- [ ] Missing information in proposal → REVISE
- [ ] Proposal references non-existent requirement
- [ ] Extremely long proposal
- [ ] Minimal proposal (few words)

### Truth Context Scenarios
- [ ] Interpretation changes verdict
- [ ] Exception applies and exempts violation
- [ ] Deprecation makes requirement obsolete
- [ ] Prior ruling influences judgment

### Failure Scenarios
- [ ] Intentionally incomplete coverage → FAIL_COVERAGE_GAP
- [ ] Invalid input format → FAIL_INPUT_INVALID
- [ ] Simulated authority mismatch → FAIL_AUTHORITY_MISMATCH

### Notes / Issues
<!-- Track test scenario creation issues here -->

---

## 5.2 Evaluation Harness Implementation

- [ ] Create harness entry point script
- [ ] Implement test loader:
  - [ ] Load scenarios from directory/file
  - [ ] Parse expected outcomes
- [ ] Implement test runner:
  - [ ] Initialize Dolt with test state
  - [ ] Run Historian pipeline on each scenario
  - [ ] Capture Judgment and AuditBundle
- [ ] Implement result comparator:
  - [ ] Compare actual verdict vs expected
  - [ ] Compare findings if specified
  - [ ] Compare evidence sections if specified
  - [ ] Compare failure mode if expected
- [ ] Generate test report:
  - [ ] Pass/fail for each scenario
  - [ ] Detailed diff on failures
  - [ ] Summary statistics

### Notes / Issues
<!-- Track harness implementation issues here -->

---

## 5.3 Metrics Collection

### Groundedness (Faithfulness)
- [ ] Define groundedness metric:
  - [ ] % of judgment assertions backed by evidence
  - [ ] Target: 100%
- [ ] Implement automated check:
  - [ ] For each finding, verify evidence_refs non-empty
  - [ ] For each bead conclusion, verify citations
- [ ] Report groundedness score per run

### Coverage
- [ ] Collect coverage_ratio from each run
- [ ] Aggregate across test suite
- [ ] Target: above threshold in all tests (except intentional gaps)
- [ ] Report coverage statistics

### Correctness
- [ ] Calculate verdict accuracy:
  - [ ] % of runs where actual verdict = expected verdict
  - [ ] Target: 100% on curated test suite
- [ ] Calculate finding precision/recall:
  - [ ] Precision: correct findings / total findings
  - [ ] Recall: correct findings / expected findings

### Calibration
- [ ] Track REVISE usage:
  - [ ] Should appear in ambiguous cases
  - [ ] Should NOT appear in clear cases
- [ ] Track false positives (BLOCK when should PASS)
- [ ] Track false negatives (PASS when should BLOCK)

### Notes / Issues
<!-- Track metrics collection issues here -->

---

## 5.4 Automated Quality Checks

- [ ] Implement groundedness checker:
  - [ ] Parse Judgment and BeadsTrace
  - [ ] Verify citation chain completeness
  - [ ] Flag any unsupported assertions
- [ ] Implement trace depth checker:
  - [ ] Average beads per claim
  - [ ] Minimum required depth for critical claims
- [ ] Implement evidence relevance checker (optional):
  - [ ] Verify retrieved evidence relates to claim
  - [ ] Could use embedding similarity or LLM judge
- [ ] Generate quality report with all checks

### Notes / Issues
<!-- Track quality checks issues here -->

---

## 5.5 LLM-as-Judge Integration (Optional)

- [ ] Define judge prompt:
  - [ ] "Review this AuditBundle. Are there any reasoning errors?"
  - [ ] "Does the verdict correctly follow from the evidence?"
- [ ] Implement judge invocation:
  - [ ] Send AuditBundle summary to capable LLM (GPT-4 or similar)
  - [ ] Parse judge feedback
- [ ] Use judge as supplementary check (not authoritative)
- [ ] Log judge feedback in evaluation report
- [ ] Flag discrepancies for human review

### Notes / Issues
<!-- Track LLM judge issues here -->

---

## 5.6 Refinement Based on Results

- [ ] Analyze test failures:
  - [ ] Categorize by failure type
  - [ ] Identify root causes
- [ ] Common issues and fixes:

### Prompt Issues
- [ ] If reasoning too shallow → adjust prompts for more steps
- [ ] If missing evidence citations → strengthen prompt requirements
- [ ] If uncertain when shouldn't be → calibrate uncertainty detection

### Threshold Issues
- [ ] If coverage gaps too frequent → adjust coverage_threshold
- [ ] If instability too sensitive → adjust stability_threshold

### Logic Issues
- [ ] If verdict logic wrong → fix verdict decision code
- [ ] If coverage plan incomplete → improve plan generation

- [ ] Document all refinements made
- [ ] Re-run test suite after each refinement

### Notes / Issues
<!-- Track refinement issues here -->

---

## 5.7 Regression Test Framework

- [ ] Integrate test suite with CI-like runner
- [ ] Create `make test` or equivalent command
- [ ] Run tests in orchestrator container for consistency
- [ ] Save test results history
- [ ] Alert on regressions (test that used to pass now fails)
- [ ] Block deployments if tests fail

### Notes / Issues
<!-- Track regression framework issues here -->

---

## 5.8 Documentation

- [ ] Document test harness usage:
  - [ ] How to run tests
  - [ ] How to add new scenarios
  - [ ] How to interpret results
- [ ] Document metrics and targets
- [ ] Document common failure modes and debugging
- [ ] Document refinement procedures
- [ ] Create operator runbook:
  - [ ] Startup procedures
  - [ ] Monitoring guidance
  - [ ] Troubleshooting guide

### Notes / Issues
<!-- Track documentation issues here -->

---

## 5.9 Human Review Session

- [ ] Select 3-5 realistic proposals for human review
- [ ] Run Historian on each
- [ ] Have domain expert review:
  - [ ] Is the verdict correct?
  - [ ] Is the reasoning sound?
  - [ ] Are the citations accurate?
  - [ ] Is the output easy to understand?
- [ ] Collect feedback
- [ ] Address any issues found
- [ ] Document human acceptance

### Notes / Issues
<!-- Track human review issues here -->

---

## Acceptance Tests

- [ ] **Test 1**: Full test suite passes
  - [ ] All scenarios return expected results
  - [ ] No regressions from previous phases
- [ ] **Test 2**: Groundedness = 100%
  - [ ] No unsupported assertions in any judgment
- [ ] **Test 3**: Coverage meets threshold
  - [ ] All runs (except intentional gaps) above threshold
- [ ] **Test 4**: Verdict accuracy = 100%
  - [ ] On curated test suite
- [ ] **Test 5**: Calibration appropriate
  - [ ] REVISE only on ambiguous cases
  - [ ] No false negatives on clear violations
- [ ] **Test 6**: Human reviewer acceptance
  - [ ] Expert agrees verdicts are correct
  - [ ] Expert finds output useful and clear
- [ ] **Test 7**: Harness easy to use
  - [ ] `make test` runs successfully
  - [ ] Results clear and actionable

---

## Milestone 5 Criteria

- [ ] System meets evaluation targets on test suite
- [ ] 100% groundedness
- [ ] Coverage above threshold
- [ ] Correct verdicts on all curated tests
- [ ] Ready for initial deployment/use on real tasks (with caution)
- [ ] Documentation and harness available
- [ ] Human acceptance received

---

## Phase 5 Complete

- [ ] All above checklists completed
- [ ] Evaluation targets met
- [ ] Documentation complete
- [ ] Phase 5 review conducted
- [ ] Ready to proceed to Phase 6 (optional) or deployment

---

## Notes / Issues (Phase-Level)

<!-- Track overall Phase 5 issues, decisions, and TODOs here -->

