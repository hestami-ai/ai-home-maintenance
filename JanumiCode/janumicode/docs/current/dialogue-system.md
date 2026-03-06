# Dialogue Session Management

The JanumiCode workflow relies heavily on the Dialogue System to manage interactions between the user, the AI agents, and the persistent state database. This system is located in the `src/lib/dialogue/` directory.

## Dialogue Sessions

A `DialogueSession` represents a single conversational thread or user task. A session goes through various phases (e.g., `INTAKE`, `PROPOSE`, `ASSUMPTION_SURFACING`, `VERIFY`, `EXECUTE`).

The session state manages:
*   **Id**: `dialogue_id` (a unique UUID).
*   **Time Tracking**: `created_at` and `last_updated`.
*   **Phase**: `current_phase` (the workflow engine's current execution step).
*   **Turn Sequence**: `turn_count` and `last_turn_id`.

## Turn Management (`getDialogueSession`, `addTurn`)

Every interaction is captured as a "turn" (`DialogueTurn`). To append a new turn to the conversation history:

1.  **Validation**: An `envelope` is created which asserts the role doing the speaking (e.g., `EXECUTOR`), the speech act (e.g., `CLAIM`), and references the actual content via `content_ref`. The system validates that this role is allowed to perform this speech act.
2.  **Sequence Enforcement**: The ID of the incoming turn must precisely follow the sequence defined by `last_turn_id`. This prevents race conditions and out-of-order execution among concurrent sub-agents.
3.  **Persistence**: The turn is written to the persistent database.
4.  **Cache Sync**: The active session cache is updated to reflect the new state.

If a dialogue session isn't in memory (e.g., after the extension reloads), `getDialogueSession` seamlessly queries the database to reconstruct the state.

## Speech Acts

Instead of amorphous text chat, JanumiCode structures all messages using predefined "Speech Acts." These speech acts give semantic meaning to turns. For example:

*   **`CLAIM`**: Emitted by the Executor when surfacing an assumption.
*   **`EVIDENCE`**: Emitted by the Technical Expert to provide documentation backing an assumption.
*   **`VERDICT`**: Emitted by the Verifier indicating validation success or failure.
*   **`DECISION`**: Emitted by the user when interacting with a Gate.

This strict type enforcement guarantees that the `Workflow Orchestrator` can cleanly map the dialogue onto the database without resorting to brittle regex or text parsing of the LLM output.
