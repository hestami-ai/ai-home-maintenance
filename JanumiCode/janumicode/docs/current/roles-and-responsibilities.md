# JanumiCode: Roles and Responsibilities

The JanumiCode system is built on a multi-agent architecture where each agent, or "role," has a distinct set of responsibilities. This separation of concerns allows the system to handle complex software development tasks in a structured and auditable way. The human user is also modeled as a role, acting as the ultimate authority.

## The Core Agent Trio

The primary workflow is driven by a trio of agents: the Executor, the Technical Expert, and the Verifier.

### 1. The Executor: The "Doer"

The Executor is the primary agent responsible for getting things done. It takes the user's high-level goal and creates a concrete, technical plan to achieve it.

**Key Responsibilities:**

*   **Propose Solutions:** Generate detailed, step-by-step implementation plans, including file paths, function signatures, and architectural decisions.
*   **Generate Artifacts:** Create code, design documents, specifications, or other artifacts required to fulfill the goal.
*   **Surface Assumptions:** Identify and explicitly state all assumptions made during the planning process. These assumptions are then turned into "Claims" for the Verifier to check.
*   **Adhere to Constraints:** Strictly follow all rules and constraints defined in the system's "Constraint Manifest."

**Critical Guardrails:**

*   The Executor **must not** proceed if a critical assumption has been disproved by the Verifier.
*   The Executor **must not** invent new constraints or challenge the Verifier's verdicts.

### 2. The Technical Expert: The "Researcher"

The Technical Expert acts as a fact-finding research assistant for the other agents. Its purpose is to provide authoritative, evidence-backed answers to specific technical questions.

**Key Responsibilities:**

*   **Provide Evidence:** Answer technical questions with precise explanations.
*   **Cite References:** Back up every answer with citations to API documentation, specifications, standards (RFCs), or code examples.
*   **Assess Confidence:** Rate its confidence in the answer (HIGH, MEDIUM, or LOW) based on the quality of the source evidence.
*   **Surface Caveats:** Identify any edge cases, limitations, or conditions where the answer might not apply.

**Critical Guardrails:**

*   The Technical Expert provides **evidence only**. It is strictly forbidden from making feasibility judgments, recommendations, or suggestions.
*   It has **no authority** to approve or authorize actions. Its role is purely informational.

### 3. The Verifier: The "Gatekeeper"

The Verifier is the skeptical gatekeeper of the system. Its job is to fact-check the "Claims" surfaced by the Executor and to ensure that the system doesn't build upon false or unverified assumptions.

**Key Responsibilities:**

*   **Verify Claims:** Analyze a claim and issue one of four verdicts: `VERIFIED`, `CONDITIONAL`, `DISPROVED`, or `UNKNOWN`.
*   **Normalize Claims:** Rephrase claims into testable, unambiguous statements.
*   **Generate Disconfirming Queries:** Actively try to *disprove* the claim by generating questions that would challenge its validity.
*   **Classify Evidence:** Assess the quality of evidence, categorizing it as `AUTHORITATIVE`, `SUPPORTING`, `ANECDOTAL`, or `SPECULATIVE`.

**Critical Guardrails:**

*   The Verifier must default to `UNKNOWN` if evidence is insufficient or not authoritative. It is conservative by design.
*   It must **not** use creative reasoning, extrapolation, or analogies as proof.
*   It is strictly forbidden from suggesting solutions or workarounds. Its job is to verify, not to solve.

## Supporting and Governance Roles

### 4. The Historian-Interpreter: The "Memory"

The Historian-Interpreter is the memory and conscience of the system. It analyzes the entire history of a project to identify patterns, ensure consistency, and learn from past decisions.

**Key Responsibilities:**

*   **Detect Contradictions:** Identify if a new proposal or claim conflicts with a past decision or claim.
*   **Surface Precedents:** Find relevant historical decisions or patterns that could inform the current task.
*   **Detect Invariant Violations:** Flag any violations of the system's fundamental rules or governance principles.
*   **Provide Temporal Context:** Explain how the current state of the project has evolved over time.

**Critical Guardrails:**

*   The Historian-Interpreter has **read-only** access to history. It can report on the past, but it cannot change it or suggest resolutions to conflicts.
*   It has **no authority** to challenge the Verifier's verdicts.

### 5. The Human: The "Authority"

The human user is the ultimate authority in the JanumiCode system. This "role" is not an AI agent but a set of structured interfaces for capturing human decisions and ensuring they are recorded with a full audit trail.

**Key Responsibilities:**

*   **Make Decisions:** Provide the final `APPROVE` or `REJECT` decisions at key gates in the workflow.
*   **Provide Rationale:** Justify all decisions to ensure they are captured in the project's history.
*   **Grant Overrides:** Explicitly override the system's automated processes when necessary. The human can override a Verifier's verdict, reject an Executor's proposal, or waive a constraint.
*   **Issue Waivers:** Formally grant an exception to a system constraint, with a justification and an optional expiration date.

All human decisions are captured as structured data in the project's database, creating an immutable audit trail.

### 6. The Evaluator (Note)

The `package.json` configuration mentions a role named `janumicode.evaluator`. Its description is "LLM provider for the Response Evaluator (classifies executor output quality before proceeding)". An implementation for this role has not been located in the `src/lib/roles` directory during this analysis. It is likely implemented as part of the `workflow` logic. Further investigation is needed to document its precise function.
