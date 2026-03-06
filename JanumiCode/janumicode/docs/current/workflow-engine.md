# The JanumiCode Workflow Engine

The JanumiCode workflow engine is a sophisticated, state-driven system that orchestrates the collaboration between AI agents and the human user. It's designed to be robust, auditable, and predictable, ensuring that complex software development tasks are executed in a structured and governed manner.

## The State Machine

At its core, the workflow is a state machine built on a persistent database. This design provides a formal structure for the entire process.

*   **`WorkflowState`**: The current state of any given task (dialogue) is captured in a `WorkflowState` record. This includes the `current_phase` (e.g., `PROPOSE`, `VERIFY`) and a flexible `metadata` field for storing contextual information.
*   **`StateTransition`**: Every movement from one phase to another is recorded as a `StateTransition` in an append-only log. This creates a complete, immutable audit trail of the workflow's history, showing why each transition occurred (e.g., `PHASE_COMPLETE`, `GATE_TRIGGERED`, `MANUAL_OVERRIDE`).
*   **`TransitionGuards`**: Before any transition can occur, the system checks a set of "transition guards." These are critical safety checks that pause the workflow if blocking conditions are met, such as:
    *   An open "gate" that requires a human decision.
    *   A `CRITICAL` assumption that has been `DISPROVED` by the Verifier.
    This prevents the system from proceeding on a faulty or incomplete foundation.

## The Workflow Phases

The workflow is divided into a series of distinct phases, each with a specific goal. The `Orchestrator` manages the progression through these phases.

1.  **`INTAKE`**: The workflow begins here. This is a conversational planning phase where the user can discuss the requirements of their goal with the `Technical Expert` agent. This allows for clarification and refinement of the goal before the main work begins.

2.  **`PROPOSE`**: The `Executor` agent takes the refined goal and generates a detailed, technical proposal. This proposal includes a step-by-step implementation plan and a list of all the assumptions it made.

3.  **`ASSUMPTION_SURFACING`**: The assumptions from the `Executor`'s proposal are formally converted into `Claims`. These claims are the specific, testable statements that will be checked by the Verifier.

4.  **`VERIFY`**: The `Verifier` agent examines each open `Claim`. It uses its skeptical, evidence-based approach to issue a verdict (`VERIFIED`, `CONDITIONAL`, `DISPROVED`, or `UNKNOWN`) for each claim. If a critical claim is disproved, a human gate is triggered.

5.  **`HISTORICAL_CHECK`**: The `Historian-Interpreter` agent analyzes the proposal and claims against the project's entire history. It looks for contradictions with past decisions and surfaces relevant precedents that might inform the current task.

6.  **`REVIEW`**: The workflow pauses at a mandatory human gate. The user is presented with the fully verified proposal, including the verdicts for all assumptions and any relevant historical context. The workflow cannot proceed until the user gives their approval.

7.  **`EXECUTE`**: Once the human approves the plan, the `Orchestrator` delegates the final execution to an external, powerful CLI tool (e.g., the Claude Code CLI, Gemini CLI). This tool is responsible for applying the changes (e.g., writing or modifying files) to the user's workspace.

8.  **`VALIDATE`**: The system checks if the execution step completed successfully. If it failed, another human gate is triggered to decide on the next steps.

9.  **`COMMIT`**: The work is considered complete, and the workflow formally commits the results. It then gracefully loops back to the `INTAKE` phase, ready for the next user goal.

## The Response Evaluator: A "Judge" LLM

A key innovation in the JanumiCode workflow is the `Response Evaluator`. Immediately after the `PROPOSE` phase, a separate, lightweight "judge" LLM is used to classify the quality and nature of the `Executor`'s proposal. This classification determines the immediate next step.

*   **`PROCEED`**: If the proposal is clear and actionable, the workflow continues as normal.
*   **`ESCALATE_CONFUSED` or `ESCALATE_QUESTIONS`**: If the proposal is confusing or contains questions for the user, the workflow pauses at a human gate for clarification.
*   **`ESCALATE_OPTIONS`**: If the proposal contains multiple distinct implementation options, the system's most advanced feature is triggered: **branch analysis**.

### Branch Analysis

When the `Evaluator` detects multiple options, the `Orchestrator` creates a separate "branch" for each one. It then runs the entire `ASSUMPTION_SURFACING` -> `VERIFY` -> `HISTORICAL_CHECK` loop for each branch in sequence. This means it thoroughly analyzes the assumptions and historical context of *every single option*. Once all branches are analyzed, the user is presented with a complete picture of all possible paths in the `REVIEW` phase, allowing them to make a fully informed decision.

## Gates and Human Intervention

The workflow is designed to be autonomous but human-governed. At any point where a critical decision is needed or an error occurs, the workflow will pause at a "gate" and wait for a human decision. This ensures that the human user is always in control and can provide guidance, clarification, or override the system's automated processes when necessary.
