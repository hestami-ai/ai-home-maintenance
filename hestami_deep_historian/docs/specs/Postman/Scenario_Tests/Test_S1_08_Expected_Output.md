# Test S1_08: Beads Trace Construction - Expected Output

## Purpose
Construct a stepwise reasoning trace (BeadsTrace) for a single claim, showing each logical step from claim to verdict.

## Expected Behavior

The LLM should:
1. Create 7 bead nodes for claim C1 (one for each reasoning step type)
2. Each bead cites its dependencies (previous beads)
3. Evidence and truth context are referenced where used
4. Final VERDICT_STEP includes full justification with citation chain
5. Trace forms a directed acyclic graph (DAG) of reasoning steps

## Expected Bead Structure for C1

**B1: CLAIM_PARSE**
- Result: "Claim proposes replacing SuperPoint (required ML model) with ORB (traditional feature detector)"
- Dependencies: [C1]

**B2: EVIDENCE_SELECT**
- Evidence refs: [E001, E002, E101]
- Truth refs: [T001, T003]
- Result: "Found 3 evidence packets and 2 truth context entries relevant to feature detection requirements"
- Dependencies: [B1]

**B3: INTERPRET_REQUIREMENT**
- Input: [E001, E002, T001]
- Result: "Spec explicitly requires 'deep learning-based feature detection (SuperPoint)'. Truth context T001 clarifies this is MANDATORY, not optional. SuperPoint was chosen after testing showed ORB failed on 23% of low-texture surfaces."
- Dependencies: [B2]

**B4: COMPARE**
- Input: [C1, B3_result]
- Conclusion: "non_compliant"
- Detail: "Proposal uses ORB. Requirement is SuperPoint. Direct contradiction."
- Dependencies: [B3]

**B5: COUNTER_EVIDENCE_CHECK**
- Input: [E101]
- Result: "Counter-evidence E101 explains WHY SuperPoint is needed: low-texture area detection where traditional methods fail. This strengthens the finding that ORB is inadequate."
- Dependencies: [B4]

**B6: TRUTH_CONTEXT_CHECK**
- Input: [T001, T003]
- Result: "Truth context makes requirements explicit: T001 states SuperPoint is REQUIRED based on testing. T003 shows prior ruling (R2025-087) rejected similar proposal to use traditional feature detector."
- Dependencies: [B4]

**B7: VERDICT_STEP**
- Provisional verdict: NON_COMPLIANT
- Severity: BLOCKING
- Justification: "Proposal C1 violates mandatory requirement for SuperPoint (E001, E002). Testing data (T001) shows ORB failed on 23% of surfaces. Prior ruling (T003) rejected similar approach. Counter-evidence (E101) explains technical rationale. Verdict: BLOCKING violation."
- Evidence chain: [E001, E002, E101]
- Truth chain: [T001, T003]
- Dependencies: [B4, B5, B6]

## Key Observations

**Complete Reasoning Chain:**
- Each step builds on previous steps
- Dependencies form a DAG (no cycles)
- Every assertion cites evidence or previous beads

**Evidence/Truth Integration:**
- B2 selects relevant evidence and truth
- B3 interprets using evidence + truth
- B4 compares claim to interpreted requirement
- B5 considers counter-evidence
- B6 applies truth context
- B7 synthesizes into verdict

**Citation Chain in B7:**
- Cites evidence packets (E001, E002, E101)
- Cites truth context (T001, T003)
- Cites previous beads (B4, B5, B6)
- Complete traceability

**Verdict Logic:**
- provisional_verdict = NON_COMPLIANT (correct, it violates spec)
- severity = BLOCKING (correct, SuperPoint is mandatory)
- justification includes specific data (23% failure rate)

## Success Criteria

✅ **Pass if:**
- 7 beads created (B1-B7)
- Each bead has correct type (CLAIM_PARSE, EVIDENCE_SELECT, etc.)
- Dependencies form valid DAG
- B2 references evidence packets [E001, E002, E101]
- B2 references truth context [T001, T003]
- B4 conclusion = "non_compliant"
- B7 provisional_verdict = "NON_COMPLIANT"
- B7 severity = "BLOCKING"
- B7 justification cites specific evidence and truth entries
- Evidence chain and truth chain present in B7

❌ **Fail if:**
- Fewer than 6 beads
- Missing bead types (e.g., no COUNTER_EVIDENCE_CHECK)
- B7 verdict not "NON_COMPLIANT" (incorrect)
- B7 severity not "BLOCKING" (too lenient)
- Dependencies missing or circular
- No citations in justification

## Why This Structure Matters

**For Validation (Test S1_09):**
- Can check: "Does every conclusion cite evidence?" (Rule: no normative conclusion without normative premise)
- Can check: "Was counter-evidence considered?" (Requirement from Blueprint)
- Can check: "Is reasoning depth sufficient?" (7 beads for critical claim)

**For Audit:**
- Human can follow reasoning step-by-step
- Each step is individually verifiable
- Can replay or debug reasoning process
- Can identify where an error occurred (if any)

**For Determinism:**
- Structured beads (not free-form text)
- Dependencies explicit
- Can cache or replay individual beads

## Related Blueprint Sections

- **Beads Trace Description:** lines 54-55
- **Construct Beads Trace:** lines 90-106
- **Bead Types:** lines 92-102
- **BeadsTrace Schema:** lines 227-263
- **Reasoning as Graph:** line 54 (dependency-aware graph)
