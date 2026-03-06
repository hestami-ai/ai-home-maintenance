# The Governed Stream and UI

The JanumiCode extension interacts with the user exclusively through a unified webview known as the "Governed Stream" (`src/lib/ui/governedStream/`).

## The Governed Stream View

Unlike standard code-generation copilots that offer a simple chat window, the Governed Stream is a custom, reactive dashboard designed to keep the user informed about the system's exact internal state. It features real-time updates of the workflow status, claim verification progress, and streamed responses.

Key components of the Governed Stream:

*   **Dialogue View**: Renders the back-and-forth communication between the human and the various agent roles.
*   **Workflow Status View**: Displays the current execution phase (e.g., `INTAKE`, `PROPOSE`, `VERIFY`) and identifies the active role.
*   **Claims Tracking View**: Lists the specific assumptions surfaced by the `Executor` alongside the verdicts returned by the `Verifier`.
*   **Gate UI**: An interactive panel that appears only when the workflow hits a "Human Gate" (e.g., a critical claim is DISPROVED). This panel requires the user to explicitly `APPROVE`, `REJECT`, `OVERRIDE`, or `REFRAME` the strategy.

## State Aggregation

The Governed Stream relies on the `dataAggregator` module. Because JanumiCode's state is strictly database-driven rather than an opaque LLM stream, the UI continuously computes its display based on the database:

1.  **aggregateStreamState**: Gathers the `DialogueTurns` and `HumanDecisions` for a given `dialogue_id` to synthesize the conversation tree.
2.  **computeClaimHealth**: Generates a summary (`ClaimHealthSummary`) of the percentage of claims that are `VERIFIED` versus those that are `DISPROVED` or `UNKNOWN`.

This architecture ensures that the user interface never drifts out of sync with the true persistent state of the workflow engine.
