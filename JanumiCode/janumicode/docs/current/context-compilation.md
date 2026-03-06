# Context Compilation

In JanumiCode's architecture, Large Language Models (LLMs) are completely stateless. Instead of feeding the entire conversation history back into the LLM on every turn, JanumiCode compiles a deterministic "Context Pack" for each role invocation.

The context compilation module (`src/lib/context/`) is responsible for assembling this package of relevant information from the system's persistent database.

## The `compileContextPack` Pipeline

When an agent needs to perform a task, the `compileContextPack` function gathers exactly what that role needs to see.

1.  **Retrieve Claims**: Fetches all active claims (`claims` table) relevant to the current dialogue.
2.  **Retrieve Verdicts**: Fetches the Verifier's verdicts (`verdicts` table) for all those claims, including evidence references and rationale.
3.  **Retrieve Human Decisions**: Fetches override or approval decisions (`human_decisions` table) made by the human authority at critical gates.
4.  **Retrieve Constraints**: Loads the latest global constraint manifest (`constraint_manifests` table) that all agents must follow.
5.  **Retrieve Historical Findings**: Queries the `Narrative Curator` and `Historian-Interpreter` for relevant findings, past lessons learned, or conflicting precedents across other dialogues.
6.  **Retrieve Artifact References**: Gets pointers to relevant files or generated documents stored in the system.

## Determinism and Caching

Because the context pack is generated purely from the append-only event log (the database), the compilation is highly deterministic. The exact same state will produce the exact same prompt context.

To optimize performance, `compileContextPack` uses a memory cache (`contextPackCache`) with a default Time-To-Live (TTL) of 5 minutes. If no new events have occurred, subsequent compilation requests use the cached pack.

## Token Budget Management

Tokens are a shared and limited resource. The context compiler receives a strict `tokenBudget` configuration setting.

The `calculateTokenUsage` helper estimates the token footprint of the proposed context pack by examining the length of claims, verdicts, and constraints. If the assembled pack exceeds the budget, the system relies on a dedicated `truncation.ts` module to intelligently prioritize and truncate less relevant historical context to stay within budget constraints while preserving critical execution state.
