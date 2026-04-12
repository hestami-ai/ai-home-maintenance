# Mitigation Evaluation — Residual Gap Analysis

I've evaluated each proposed mitigation against the 101 gaps identified across both passes. The mitigations are substantial and well-considered — they resolve approximately 55 gaps fully and another 20 partially. Below I document the remaining open gaps, organized into: **residual gaps from prior analysis that the mitigations don't address**, **new gaps introduced by the mitigations themselves**, and **partially-addressed gaps with remaining concerns**.

---

## I. Residual Gaps — Not Addressed by Any Mitigation

### R1. Narrative Memory Invalidation on Rollback (from Module 1, item 6)

The rollback mitigation addresses Phase Gate records (`invalidated_by_rollback_at`), file system reversion, and cross-run boundaries. But when Phase 4 is rolled back:

- The Phase 4 Narrative Memory record still exists with `authority_level: 5`
- Phase 5's Context Payload may have already incorporated it
- Phase 5's agents may have made decisions based on it
- No mechanism is specified for invalidating, updating, or flagging Narrative Memory records affected by rollback

The `is_current_version: false` flag applies to artifacts in the closure, but Narrative Memory is generated *at* the Phase Gate — it's not a derives_from artifact. It's a `narrative_memory` record type with its own lifecycle. The rollback protocol doesn't account for it.

### R2. STALLED Detection — Three-or-More Tool Cycles (from Module 3)

The mitigation addresses SCOPE_BLIND, DIVERGING, and zero-tool-call. STALLED remains defined as "alternating between same two tools ≥3 times." No mitigation addresses the case of cycles involving three or more tools (A→B→C→A→B→C...). This is a real failure pattern — an agent cycling through Read, Edit, and a test runner without converging.

### R3. Unsticking Agent — Detective Mode Effort Limit (from Module 7, item 2)

Only Socratic mode has a defined turn limit (3 turns). The mitigation defers CLI Socratic interaction but doesn't add a Detective mode limit. A Detective mode generating hypotheses indefinitely without converging has no termination condition other than human escalation — but no escalation trigger is defined for Detective mode.

### R4. Unsticking Agent — Specialist Invocation Protocol (from Module 7, item 5)

`janumicode.specialists.json` is referenced but no specification exists for how the Unsticking Agent actually invokes a specialist. Is it an LLM API call with the specialist's model? A CLI invocation? What Context Payload does the specialist receive? How is the specialist's output fed back into the Unsticking investigation?

### R5. Unsticking Agent — Tool Framework (from Module 7, item 4)

The mitigation says the Unsticking Agent uses LLM API calls. The action boundary says "Enforced by Orchestrator limiting available tools." But LLM API agents use function calling / tool use, not CLI tools. No specification for:
- What function calling schema the Unsticking Agent receives
- How the Orchestrator restricts the available functions
- Whether the Unsticking Agent uses the same function calling interface across providers (Gemini and Claude have different function calling protocols)

### R6. Refactoring Hash Staleness — Detection and Recomputation Protocol (from Module 8, item 1)

The mitigation adds the `Refactoring Hash Recompute` term and `refactoring_hash_recomputed` record type. But the actual protocol is undefined:
- What triggers hash recomputation? Does the Orchestrator check after every standard task completion whether any pending Refactoring Tasks target the same files?
- When is the recomputed hash produced — at Phase 6 planning time or at Phase 9 execution time?
- The core scenario remains unaddressed: standard task modifies file → refactoring task's `expected_pre_state_hash` is stale → what happens?

### R7. VS Code Extension — Runtime Lifecycle (from gap A3 residuals)

The UI Contract specifies functional requirements but doesn't address:
- What happens when VS Code is closed during an active Workflow Run
- What happens when the extension is reloaded/deactivated during an agent invocation
- Whether an in-progress run can be resumed on a different machine
- How the card sequence handles rapid trace record production (100 records in 5 seconds) — virtual scrolling? Pagination? Rate limiting on card creation?

### R8. Evaluation Tool Result Parsing (from gap C14)

The mitigation doesn't address how Eval Execution Agent maps raw tool output (eslint JSON, k6 text output, lighthouse HTML, npm_audit text) into the `evaluation_results` schema. Each tool has a different output format, and no parser architecture is specified for evaluation tools (unlike CLI agent parsers, which are well-specified in Section 16).

### R9. CLI Agent Output Parser — Version Fragility (new concern derived from gap A1)

Section 16.2 defines parsers for `claude_code`, `gemini`, and `openai_codex` based on their current output formats. These are external tools whose output formats may change between versions. No specification for:
- Parser versioning (which CLI tool version does each parser support?)
- Graceful degradation when output format changes (fall back to `passthrough`?)
- Parser testing/validation at startup

### R10. Phase Gate Evaluation Summary Construction

The mitigation says "The ensemble reviews the Phase Gate evaluation LLM call output (one call per gate)" which "summarizes all artifacts' states." But no specification for:
- What this summary contains
- How large it can be
- Whether it includes artifact content or only pass/fail status per criterion
- Which Orchestrator LLM call produces it (is it the `phase_gate_evaluation` call from Section 7.4?)

---

## II. New Gaps Introduced by the Mitigations

### N1. Self-Correction Pattern Matching vs. Lossless Invariant Tension

Section 1.5 adds: "The Governed Stream is lossless. All execution trace content is captured in full."

Section 16.3 defines self-correction detection via English-language regex patterns: `/actually\[,\\s\]/i`, `/wait\[,\\s\]/i`, etc.

These two statements directly contradict. Pattern matching is inherently lossy:
- Non-English self-corrections are missed
- Multi-step corrections without trigger phrases are missed (step 5: "I'll do X" → step 15: "Let me do Y instead" without any trigger phrase)
- The "same tool, materially different parameters" heuristic misses corrections that don't involve tool re-invocation

The `agent_self_correction` records in the Governed Stream will be incomplete, contradicting the lossless invariant. The spec either needs to relax the lossless claim (carving out self-correction detection as a known lossy step) or define a more comprehensive detection mechanism.

### N2. `passthrough` Parser Correctness Differential

Section 16.2 defines `passthrough` mode: "Reasoning Review operates on final output only — trace-based flaw detection is degraded."

But Phase Gate criteria are identical for all agents regardless of `trace_mode`. An agent using `passthrough` goes through the same Phase Gates with the same Invariant checks and the same (output-only) Reasoning Review as a fully-traced agent. The verification rigor is objectively lower, but the gate criteria don't reflect this.

This is particularly concerning if a user configures a custom backing tool with `passthrough` for cost reasons — they get a false sense of equivalent verification.

### N3. Trace Records Written "As They Arrive" vs. Ingestion Pipeline Stages

Section 16.4: "Records are written to the Governed Stream as they arrive — not batched at invocation end."
Section 8.5 (Ingestion Pipeline): "The pipeline is synchronous — it completes before the next Sub-Phase begins."
Section 8.5 (mitigated): Stage III LLM call is skipped for trace records.

Even with Stage III skipped for trace records, Stages I, II, IV, and V still run per record. If the Executor Agent produces 50 trace records in rapid succession, the Ingestion Pipeline runs Stages I+II+IV+V fifty times in sequence during the invocation. This is either:
- A performance bottleneck (50 deterministic pipeline runs interleaved with subprocess stdout reading)
- Or "as they arrive" means something different than "immediately" — perhaps buffered and batched for pipeline processing?

The mitigation doesn't reconcile real-time writing with pipeline processing.

### N4. File System Rollback Assumes Git

Phase 10 mitigation: "the Executor Agent restores each file to `file_sha256_before` state via `git checkout HEAD -- <path>`"

This assumes:
- Git is initialized in the workspace
- `HEAD` references the pre-run state
- No uncommitted changes exist outside JanumiCode's control
- The workspace isn't a detached HEAD state

No fallback is specified for non-git workspaces or git error conditions (merge conflicts, dirty working tree, etc.).

### N5. System-Proposed Content Forward Traversal — Mixed Derivation

Phase 1 mitigation: "traverses `record_references` forward from the item to clear `derived_from_system_proposal: true`"

But `derived_from_system_proposal` is a **boolean** on each record. A downstream artifact might derive from two system-proposed items — one approved, one still pending. Clearing the boolean when one item is approved would incorrectly remove the flag for the other pending item. There is no per-field or per-source tracking at the record level.

### N6. Ingestion Pipeline Completeness Contradicts Deep Memory Research Job Statement

Section 8.5 mitigation: "edges are optional — their absence degrades Deep Memory Research quality but does not block the workflow"

Section 8.4 (unchanged): "There is no 'fast mode.' When completeness cannot be achieved, that fact is surfaced in the Context Packet — it is never acceptable to return partial context as if it were complete."

If Stage III edges are absent for a batch of records (due to LLM failure), the Deep Memory Research Agent's relationship expansion (Stage 4) will produce an incomplete Context Packet. But the pipeline said this is acceptable. The Deep Memory Research Agent's job statement says it isn't.

### N7. Missing JSON Schema Content for New Record Types

Section 12 lists these new schema files as "(new)":
- `file_system_revert_record.schema.json`
- `refactoring_hash_recomputed.schema.json`
- `refactoring_skipped_idempotent.schema.json`
- `cycle_detected_record.schema.json`
- `warning_acknowledged.schema.json`
- `warning_batch_acknowledged.schema.json`
- `ingestion_pipeline_failure.schema.json`
- `llm_api_failure.schema.json`
- `llm_api_recovery.schema.json`

None of these have their JSON Schema content provided anywhere in the mitigations. They are referenced by other mitigations (e.g., `ingestion_pipeline_failure` is produced by the failure handling, `llm_api_failure` by the LLM failure protocol), but an implementer cannot build them without schema definitions.

### N8. DIVERGING Classification May Be Overly Aggressive

Mitigation: "A single high-severity flaw added between retries is sufficient to classify DIVERGING."

If attempt 1 has 0 high-severity flaws and attempt 2 has 1 high-severity flaw, this is DIVERGING. But:
- A single new flaw on attempt 2 might be a completely different error type, not a "divergence" pattern
- This means any high-severity Reasoning Review failure on the second attempt triggers the Unsticking Agent
- The practical effect is that almost no second attempt can produce a new high-severity flaw without triggering Unsticking, which may be excessively aggressive

The "strictly greater than" condition combined with "single flaw sufficient" creates a very low bar for DIVERGING classification on attempt 2.

### N9. `write_directory_paths` as Invariant Check Basis for Unexpected Writes

Phase 10 mitigation: "Files modified outside `write_directory_paths` (unexpected writes) are flagged by the InvariantChecker post-task"

But `write_directory_paths` carries `path_estimates_are_estimated: true`. If the Implementation Planner's estimate was wrong (e.g., it estimated `src/auth/` but the Executor Agent correctly wrote to `src/authentication/`), the InvariantChecker would flag a valid write as unexpected. The mitigation doesn't distinguish between "estimate was wrong" and "agent wrote to an genuinely unexpected location."

### N10. SCOPE_BLIND Detection Requires Specific Flaw Types

Mitigation: "If `tools_not_called` is non-empty AND the Reasoning Review found `unsupported_assumption` or `completeness_shortcut` flaws: Loop Status = SCOPE_BLIND"

This means SCOPE_BLIND only fires when the Reasoning Review happens to find one of two specific flaw types. If the agent doesn't use available tools but the Reasoning Review finds a different flaw type (e.g., `invalid_inference`), SCOPE_BLIND won't fire — even though the root cause might be the agent not consulting available tools. The detection is coupled to the Reasoning Review's flaw classification accuracy.

---

## III. Partially-Addressed Gaps — Remaining Concerns

### P1. Unsticking Agent Socratic Interaction with CLI Agents (Deferred)

The mitigation defers this to post-MVP with a degraded fallback: "provides context enrichment to the next scheduled retry rather than interactive dialogue."

This is an honest deferral, but the fallback has no specification:
- What "context enrichment" looks like
- How it's injected into the retry's Context Payload
- How effective it is expected to be compared to interactive Socratic dialogue
- Whether the human is informed that degraded mode is active

### P2. Co-Invocation Exception Governance (Deferred)

The mitigation defers to post-MVP. The concern remains: co-invocations bypass the per-artifact Reasoning Review granularity. If a co-invocation produces a flaw in one of its two artifacts, the retry re-runs both — wasting cost and potentially introducing new flaws in the artifact that was correct.

### P3. Cascade Threshold Re-Check at Phase 6 (Deferred to v2.5)

The 20% threshold is specified but the mechanism is deferred. In the interim, systematically underestimated impact reports silently bypass the safety mechanism.

### P4. System-Proposed Content — Partial Field Proposal

The mitigation defines a `system_proposed_content` array separate from candidate content. This handles the case where entire fields are system-proposed. But it doesn't address the case where a field is partially human-provided and partially system-expanded (e.g., human writes "logistics tool," system expands to "comprehensive logistics management tool for mid-size freight companies" — the human's words are embedded within the system's expansion). The separation model assumes clean boundaries between human and system content within a field.

### P5. Technical Debt Record Surfacing

The mitigation defines the `technical_debt` table and says records "appear in Context Packets" under a `known_technical_debt` field. But:
- The Context Packet schema in Section 8.4 doesn't include a `known_technical_debt` field
- No specification for how Deep Memory Research Stage 2 retrieves technical debt records
- No specification for whether technical debt affects Phase Gate criteria (e.g., should a Phase Gate warn if the current run depends on an open technical debt item?)

### P6. Verification Ensemble Secondary Timeout

Deferred to v2.5. In the interim, if the secondary provider is slow, every Phase Gate blocks indefinitely. The primary's timeout/retry logic (Section 7.11) doesn't apply to the ensemble secondary because the ensemble is handled by `PhaseGateEvaluator`, not `LLMCaller`.

---

## Summary

| Category | Count | Key Examples |
|---|---|---|
| **Residual gaps** (from prior analysis) | 10 | Narrative Memory invalidation on rollback; three-tool STALLED; Detective mode limit; hash staleness protocol; eval tool parsing |
| **New gaps introduced** (by mitigations) | 10 | Lossless invariant vs. pattern matching; passthrough correctness differential; trace write vs. pipeline timing; git assumption; mixed derivation flag; missing schemas; DIVERGING aggressiveness |
| **Partially addressed** (deferred or incomplete) | 6 | Unsticking Socratic fallback; co-invocation governance; cascade re-check; partial field proposals; tech debt surfacing; ensemble timeout |
| **Fully addressed** | ~85 | CLI protocol, VS Code UI contract, Mirror generation, token counting, LLM failure handling, ensemble severity disagreement, SCOPE_BLIND, warning acknowledgment, test ordering, file system mapping, memory edge lifecycle, collision resolution, state machine for 0.5, modification_type, and many others |

**The 10 new gaps are the most concerning outcome** — they represent spec-internal contradictions or underspecified interactions between the new mitigations and existing spec text. The lossless-vs-pattern-matching tension (N1) and the mixed-derivation flag problem (N5) are architectural issues that would cause real implementation confusion. The 9 missing schemas (N7) are a straightforward but voluminous gap that blocks implementation of the failure handling systems.