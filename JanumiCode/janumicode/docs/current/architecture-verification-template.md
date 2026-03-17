# Architecture Verification Prompt Template

Use this template when you want to verify not just whether an implementation exists, but whether it faithfully realizes the intended reasoning process, artifact outputs, and human/LLM division of labor.

This template is designed for verifying:

- expressed intent
- implementing-agent reasoning or planning documents
- code implementation
- runtime-visible outputs or artifacts

It should be filled in for a specific verification run.

---

## Verification Inputs

**Verification target name:**
`{{VERIFICATION_TARGET_NAME}}`

**Design / intent document(s):**
`{{DESIGN_DOCS}}`

**Reasoning / planning document(s):**
`{{REASONING_DOCS}}`

**Implementation target(s):**
`{{IMPLEMENTATION_TARGETS}}`

**Ground-truth or reference artifact(s):**
`{{GROUND_TRUTH_DOCS}}`

**Primary concern for this run:**
`{{PRIMARY_CONCERN}}`

**Changes since last verification:**
`{{CHANGES_SINCE_LAST_RUN}}`

---

## Intent To Verify

**Overarching problem:**
`{{OVERARCHING_PROBLEM}}`

**Intended capability shift:**
`{{INTENDED_CAPABILITY_SHIFT}}`

**Human role in the intended system:**
`{{HUMAN_ROLE}}`

**LLM / agent role in the intended system:**
`{{LLM_ROLE}}`

**Non-negotiable design principles:**
`{{DESIGN_PRINCIPLES}}`

**Explicit anti-goals:**
`{{ANTI_GOALS}}`

**What success looks like:**
`{{SUCCESS_CRITERIA}}`

---

## Expected Artifacts

List the artifacts this workflow or phase is expected to produce.

| Artifact | Purpose | Required fields / qualities | Owner / source |
|----------|---------|-----------------------------|----------------|
| `{{ARTIFACT_1}}` | `{{PURPOSE_1}}` | `{{FIELDS_1}}` | `{{OWNER_1}}` |
| `{{ARTIFACT_2}}` | `{{PURPOSE_2}}` | `{{FIELDS_2}}` | `{{OWNER_2}}` |
| `{{ARTIFACT_3}}` | `{{PURPOSE_3}}` | `{{FIELDS_3}}` | `{{OWNER_3}}` |

Add or remove rows as needed.

State clearly whether these are expected as:

- standalone files
- database-backed documents
- UI-rendered artifacts
- streamed events
- context-pack sections

---

## Expected Reasoning Process

Describe the reasoning process the implementation is supposed to reflect.

1. `{{REASONING_STEP_1}}`
2. `{{REASONING_STEP_2}}`
3. `{{REASONING_STEP_3}}`
4. `{{REASONING_STEP_4}}`
5. `{{REASONING_STEP_5}}`

The verifier should assess:

- whether the prompts and workflow actively encourage this reasoning process
- whether the implementation shortcuts or bypasses it
- whether intermediate reasoning is externalized into artifacts
- whether later stages consume upstream artifacts rather than re-guessing

---

## Source Hierarchy

If sources disagree, use this precedence order unless the verification target explicitly says otherwise:

1. Expressed design intent
2. Non-negotiable design principles
3. Reasoning / planning documents
4. Ground-truth reference artifacts
5. Code implementation
6. Runtime output / UI output

The verifier should explicitly identify when disagreement is:

- `Intent drift` — implementation no longer matches the intended design
- `Reasoning drift` — the implementation diverges from the agent’s proposed solution
- `Implementation drift` — runtime behavior diverges from the code or artifact contract

---

## Checks

### 1. Structural Conformance

**File(s):** `{{STRUCTURAL_FILES}}`

- [ ] `1a.` Required types / schemas / enums exist.
- [ ] `1b.` Required workflow states / transitions exist.
- [ ] `1c.` Required artifact fields are non-optional where intended.
- [ ] `1d.` Required storage or event wiring exists.

Add concrete structural checks for the specific target.

### 2. Behavioral Conformance

**File(s):** `{{BEHAVIORAL_FILES}}`

- [ ] `2a.` The implementation behaves according to the intended workflow, not just the intended shape.
- [ ] `2b.` Upstream artifacts are passed to downstream stages with the required fidelity.
- [ ] `2c.` Human-facing outputs appear at the correct stage and in the correct form.
- [ ] `2d.` Failure or fallback paths are explicit.

### 3. Artifact Contract Verification

**File(s):** `{{ARTIFACT_FILES}}`

- [ ] `3a.` Each expected artifact is actually produced.
- [ ] `3b.` Each artifact contains the required fields or sections.
- [ ] `3c.` Artifact richness is sufficient for downstream use.
- [ ] `3d.` The artifact form matches the expected form (file, DB doc, UI card, event, etc.).

### 4. Prompt and Context Quality

**File(s):** `{{PROMPT_FILES}}`

- [ ] `4a.` Prompts are strong enough for workspace-aware CLI agents, not merely schema requests.
- [ ] `4b.` Prompts include anti-hallucination / anti-template guidance where needed.
- [ ] `4c.` Context builders provide enough evidence and upstream artifact detail.
- [ ] `4d.` Prompt instructions are implementation-useful, not just formally valid.

### 5. Reasoning Fidelity

**File(s):** `{{REASONING_FILES}}`

- [ ] `5a.` The code reflects the intended reasoning process rather than replacing it with simplistic heuristics.
- [ ] `5b.` Where heuristics exist, they are acceptable guardrails rather than design-degrading shortcuts.
- [ ] `5c.` Important decisions remain evidence-grounded and traceable.
- [ ] `5d.` The implementation preserves opportunities for genuine judgment rather than forcing mechanical decomposition or generic output.

### 6. Human Judgment Support

**File(s):** `{{HUMAN_REVIEW_FILES}}`

- [ ] `6a.` The human-facing artifact exposes enough information for judgment.
- [ ] `6b.` Important rationale, tradeoffs, traceability, and consequences are surfaced.
- [ ] `6c.` Critical context is not stranded only in logs or hidden command output.
- [ ] `6d.` The implementation keeps the human in the intended role: chooser / approver / rejector / reframer.

### 7. Shortcut Audit

**File(s):** `{{SHORTCUT_FILES}}`

- [ ] `7a.` No reasoning-heavy stage relies primarily on brittle heuristics where agent reasoning was intended.
- [ ] `7b.` No silent quality-degrading fallback undermines the intended design.
- [ ] `7c.` No generic template or placeholder mechanism substitutes for evidence-based structure.
- [ ] `7d.` If shortcuts remain, the verifier identifies them explicitly and judges whether they are acceptable tradeoffs.

### 8. Build / Runtime Verification

**Command(s):**
`{{BUILD_COMMANDS}}`

- [ ] `8a.` Build passes.
- [ ] `8b.` Type-check or static validation passes.
- [ ] `8c.` Runtime-visible outputs match intended artifacts if runtime verification is in scope.

### 9. Regression Checks

**Regression source:** `{{PRIOR_REPORT_OR_FIX_DOC}}`

- [ ] `9a.` Previously identified critical issues are actually fixed.
- [ ] `9b.` Fixes did not reintroduce earlier anti-patterns.
- [ ] `9c.` New changes do not merely replace one shortcut with another.

### 10. Triangulation Checks

For major findings, compare:

1. what the design intended
2. what the implementing agent proposed or reasoned
3. what the code actually does

- [ ] `10a.` Intent, reasoning, and implementation are aligned for the most critical behaviors.
- [ ] `10b.` Any drift is explicitly identified as intent drift, reasoning drift, or implementation drift.
- [ ] `10c.` The verifier uses evidence from both planning docs and code, not just one or the other.

### 11. Final Merit Assessment

- [ ] `11a.` The verifier provides an explicit judgment of whether the implementation genuinely improves the intended human/LLM division of labor.
- [ ] `11b.` The verifier identifies the top 3 remaining risks:
  1. highest philosophical/design risk
  2. highest implementation-quality risk
  3. highest operational/tooling risk
- [ ] `11c.` The verifier assigns an overall merit rating: `Strong`, `Mixed`, or `Weak`.

---

## How To Run This Verification

```bash
{{VERIFICATION_COMMANDS}}
```

Then:

1. Read the design / intent documents.
2. Read the reasoning / planning documents.
3. Read the relevant implementation files.
4. Run the required build, type-check, or runtime commands.
5. Compare intent -> reasoning -> implementation -> output.

---

## Reporting Format

For each check, report:

- **PASS** — criterion met
- **FAIL** — criterion not met, with explanation
- **PARTIAL** — criterion partially met, with explanation

Summarize total PASS / FAIL / PARTIAL counts at the end.

For major findings:

- cite the design-intent source
- cite the reasoning or planning source if available
- cite the implementation source
- explain whether the problem is intent drift, reasoning drift, or implementation drift

For the final assessment:

- do not answer mechanically
- prefer the strongest evidence-bearing examples
- explicitly call out shortcuts if they matter
- distinguish between “implemented” and “implemented at the intended sophistication level”

---

## Recommended Output Sections

Use this structure for the final report:

1. Executive Summary
2. Totals
3. Verification Results
4. Shortcut / Fidelity Findings
5. Triangulation Findings
6. Top 3 Remaining Risks
7. Final Merit Judgment

---

## Notes For Template Authors

This template is strongest when:

- the intent section is concrete rather than abstract
- expected artifacts are named explicitly
- reasoning docs are included when available
- checks are split between structural and behavioral verification
- the verifier is required to assess philosophy alignment, not just implementation presence

This template is weaker when:

- intent is underspecified
- artifact ownership is ambiguous
- no reasoning docs are supplied
- checks focus only on fields, enums, and file presence
