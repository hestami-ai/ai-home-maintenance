# JanumiCode Deep Validation Review Subsystem

A multi-stage, agentic code review subsystem that combines Uber's scalable, high-precision filtering pipeline with deep, formal mathematical validation inspired by Dafny and OpenAI's behavior-driven approach.

---

## 1. Core Philosophy

Based on the lessons from Uber's uReview and the theorem-proving methodology of `lemmafit`, this subsystem optimizes for **extreme precision over volume**. It avoids traditional SAST failure modes by formulating hypotheses and actively trying to formally prove or disprove them before interrupting a human developer.

**Key Tenets:**
1. **No SAST Seeding:** Start from the code's behavior, intent, and repository context, not a pre-computed list of dataflow findings.
2. **Mathematical Proof (Verified Shadows):** Treat LLM findings as mere "hypotheses." An issue is only surfaced if the agent can generate a failing test, a PoC, or a mathematical proof using a formal verification language (Dafny) that the invariant fails.
3. **Multi-Stage Filtering:** Use chained prompts to grade, deduplicate, and categorize comments, stripping out stylistic nits and low-value suggestions.

---

## 2. Pipeline Architecture

The subsystem operates as a discrete workflow within JanumiCode, triggered during the `REVIEW` or `VALIDATE` phases of a dialogue.

### Stage 1: Contextual Ingestion
- **Filtering:** Automatically exclude low-signal files (configs, generated code).
- **Context Assembly:** Gather not just the diff, but the surrounding structural context (classes, imports) and domain context (threat models, past PRs, DB schemas) using JanumiCode's existing workspace readers and architecture store.

### Stage 2: Pluggable Hypothesizers (Generation)
Deploy specialized LLM assistants that read the context and output **hypotheses** rather than final comments.
- **Security Assistant:** Focuses on trust boundaries, validation vs. interpretation mismatches, and invariant failures.
- **Logic & Correctness Assistant:** Focuses on state problems, missing error handling, and logical flaws.
- **Semantic Best Practices Assistant:** Enforces complex internal rules that linters cannot catch.

### Stage 3: Deep Validation Engine (The Formal Proof Loop)
This is the core agentic loop where hypotheses are put to the test using formal verification.
For each hypothesis:
1. **Isolation:** The agent extracts the smallest testable slice of the code (e.g., a state machine transition or a data transformation pipeline).
2. **Dafny Shadow Modeling:** The agent translates the target logic into a "shadow model" written in **Dafny**. It codifies the assumed invariants, preconditions, and postconditions based on the repository's intent.
3. **Verification/Execution:** The agent runs the raw `dafny verify` compiler against the shadow model.
   - If Dafny *successfully verifies* the model, the hypothesis that a bug exists is disproven.
   - If Dafny *fails* to verify, the compiler output provides mathematical proof of the edge case or invariant violation.
   - *Fallback:* If the logic is too tightly coupled to external IO for Dafny, the agent falls back to generating an end-to-end micro-fuzzer script.
4. **Outcome:** If the agent cannot falsify the code's intended guarantee, the hypothesis is **discarded**. Only proven or highly-probable hypotheses proceed.

### Stage 4: Grading & Filtering (The "uReview" Filter)
- **Confidence Grading:** A secondary LLM prompt evaluates the surviving hypotheses for clarity, impact, and developer usefulness, assigning a confidence score.
- **Deduplication:** Merge overlapping semantic suggestions.
- **Category Pruning:** Suppress categories historically disliked by developers (e.g., minor logging tweaks, stylistic nits).

### Stage 5: Delivery & Feedback Loop
- **Presentation:** Findings are presented to the user complete with the "Proof" (the failing Dafny assertion or test case) rather than just a subjective comment.
- **Telemetry:** Every finding includes a simple Useful/Not Useful rating. Feedback is persisted to dynamically tune the confidence thresholds.
- **Automated Verification:** The subsystem can be re-run against subsequent commits to verify if a finding was actually addressed.

---

## 3. Implementation Plan within JanumiCode

### Phase 1: Hypothesizer & Context Engine
- Extend `src/lib/workflow/orchestrator.ts` with a new `REVIEW_AGENT` role.
- Implement the ingestion filter and pluggable assistants.
- **Output:** A raw list of structured JSON hypotheses.

### Phase 2: The Dafny Sandbox & Tooling (Deep Validation)
- Integrate a lightweight execution sandbox equipped with the raw **Dafny** compiler.
- Create a specific CLI Provider or tool set for the agent to write `.dfy` shadow models, execute `dafny verify`, and parse the output.
- Implement the loop where the agent iterates on the Dafny model if there are syntax errors, separating true verification failures (proof of bugs) from compilation errors.
- **Output:** Filtered list of hypotheses with attached Dafny verification evidence.

### Phase 3: Post-Processing & Feedback
- Implement the Grading Prompt and Semantic Deduplicator.
- Add UI components in `GovernedStreamPanel` for the Proof-of-Concept/Dafny display.
- Wire up the Useful/Not Useful buttons to the existing event bus and SQLite persistence (`commandStore.ts`).

---

## 4. Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Dafny Complexity** | Writing formal proofs is hard, even for LLMs. Mitigate by instructing the agent to model only the *effect-free logic* slice (Model, Action, Apply) rather than the whole system. |
