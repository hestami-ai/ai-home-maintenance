# Database and Narrative Memory

A core feature of the JanumiCode system is its persistent "Narrative Memory." Every action, decision, claim, and piece of evidence is recorded in a local SQLite database. This creates a complete, auditable history of every task, allowing the system to learn from past interactions, ensure consistency, and provide full transparency to the user.

## The Database Schema

The database is composed of a set of highly structured tables designed for auditability and traceability. Here are the key components:

### Dialogue and Workflow System
*   **`dialogues`**: A high-level record for each task or goal initiated by the user.
*   **`dialogue_turns`**: The append-only log of the entire conversation. Every action taken by any agent (including the human) is recorded as a "turn."
*   **`workflow_states`**: Stores the current phase (e.g., `PROPOSE`, `VERIFY`) of each dialogue.
*   **`state_transitions`**: An immutable audit log of every time the workflow moves from one phase to another, including *why* it transitioned.

### Claims and Verification System
*   **`claims`**: Stores every assumption made by the `Executor`. Each claim has a `status` (`OPEN`, `VERIFIED`, `DISPROVED`, etc.) and a `criticality` (`CRITICAL` or `NON_CRITICAL`).
*   **`verdicts`**: Records the verdicts issued by the `Verifier` for each claim, along with the rationale and evidence used.
*   **`claim_events`**: An append-only log of the entire lifecycle of a claim, from its creation to its final verification or override.

### Governance System
*   **`gates`**: Records the points where the workflow paused to wait for a human decision. It includes the reason for the gate and which blocking claims triggered it.
*   **`human_decisions`**: An audit log of every decision made by the human user at a gate (`APPROVE`, `REJECT`, `OVERRIDE`), including their written rationale.
*   **`constraint_manifests`**: A versioned repository for the constraint documents that govern the `Executor`'s behavior.

### Artifact and Observability System
*   **`artifacts`**: A content-addressed storage for blobs of data (e.g., generated files, evidence documents).
*   **`workflow_commands`** and **`cli_activity_events`**: These tables store the detailed logs and streaming outputs of all LLM API calls and external CLI tool invocations. This data is used to render the rich, expandable command blocks in the "Governed Stream" UI.

## The Complete Audit Trail

This database structure is designed to answer not just "what happened," but also "why it happened." By tracing a task through the tables, a user or developer can see:
*   The initial goal.
*   The `Executor`'s proposed plan.
*   Every assumption that was made.
*   The `Verifier`'s verdict on each assumption.
*   Any historical precedents considered by the `Historian-Interpreter`.
*   The exact point where a human was asked for a decision.
*   The human's final decision and their rationale.
*   The command that was sent to the final execution engine.

This provides an unparalleled level of transparency and accountability for an AI-driven development process.

## The Narrative Curator and Long-Term Memory

Beyond the raw audit trail, JanumiCode includes a background process called the **Narrative Curator**. This process analyzes completed dialogues and synthesizes them into a higher-level, structured memory.

The output of the curator is stored in three key tables:

*   **`narrative_memories`**: A summary of a dialogue's outcome, including the `causal_sequence` of events, any conflicts that arose, and the "lessons learned."
*   **`decision_traces`**: A log of the key decision points in a dialogue.
*   **`open_loops`**: A list of any unresolved issues, deferred decisions, or follow-up actions that were identified during a dialogue.

These curated memories, combined with the raw data from the dialogue, form the basis of the system's long-term memory. This is the data that is used by the `Historian-Interpreter` and the semantic search system to provide context and guidance for future tasks.
