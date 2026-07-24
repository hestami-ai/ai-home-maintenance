# Extract: Legacy JanumiCode Spec v2.3 (part A — lines 1-2100)

Source: `docs/Legacy JanumiCode Source Materials/janumicode_spec_v2.3.md` (lines 1-2100 only).
Note: spec document, not a transcript — no HUMAN/ASSISTANT tags apply; no sponsor turns occur, so SPONSOR-RULINGS is empty and omitted.
Focus per brief: transfer-value concepts only — Governed Stream (one logical queryable history), layered validation, quarantine, exact review context, dependency invalidation. Phase models, schemas, storage, CoT capture explicitly NOT carried.

## CONSTITUTIONAL CANDIDATES

- "The Governed Stream is the single SQLite database containing every record produced by or exchanged between humans and agents ... There is no separate 'Artifact Store.' ... The Governed Stream is the system of record for everything — lossless." (janumicode_spec_v2.3.md L1353) — The core transfer idea: ONE logical queryable history; artifacts are records in it, not a parallel store.
- "The Governed Stream is lossless. All execution trace content ... is captured in full regardless of what subset is used for any given downstream purpose." (janumicode_spec_v2.3.md L91) — Constitutional capture-vs-use separation: full retention is independent of any consumer's selection.
- "No governing constraint may be truncated silently." (janumicode_spec_v2.3.md L90) — Fail-loud rule; reinforced at L1655: if constraints can't fit, hard-stop escalation to human, never silent truncation.
- "Partial rollbacks — invalidating only a named artifact without its dependency closure — are not permitted. Every rollback operates on the full closure." (janumicode_spec_v2.3.md L1433) — Dependency invalidation is all-or-nothing; no orphaned derived artifacts.
- "only Phase 0 (ingestion) and Phase 1.0* extraction passes read source documents directly. All downstream phases read the governed stream." (janumicode_spec_v2.3.md L647) — Single-ingress invariant: everything downstream consumes governed state, never raw sources.
- "Human override: Permitted for `severity: low` only. Override creates a `quarantine_override` Governed Stream Record with flaw ID and rationale. `severity: high` must be resolved before Phase Gate passes." (janumicode_spec_v2.3.md L2002) — Quarantine release is itself governed: recorded, rationale-bearing, and severity-bounded.
- "Every entry has a canonical `record_type`. Maximum granularity — one record per discrete event." (janumicode_spec_v2.3.md L1462) — Queryability precondition for the one-logical-history idea: discrete typed events, not blobs.

## DOCTRINE-CONOP

- "**Quarantined Record** | A Governed Stream Record associated with a Reasoning Review finding of `severity: high` — excluded from retry Context Payloads; available in the Governed Stream for audit" (janumicode_spec_v2.3.md L319) — Quarantine = exclusion from forward use, never deletion; audit access preserved.
- "the `GovernedStreamWriter` sets `quarantined: true` on the reviewed output record. The retry Context Payload receives the `flaws` array from the Reasoning Review — not the quarantined output." (janumicode_spec_v2.3.md L2000) — Retry sees the findings, not the poisoned artifact — prevents anchoring on bad output.
- "`invariant_violation_record` | A specific invariant that failed — causes agent retry with violation injected into stdin; no LLM call required" (janumicode_spec_v2.3.md L1477) — Layered validation: deterministic checks catch-and-retry cheaply before any LLM review spends.
- "**Running Invariant Checks** via `InvariantChecker` before Reasoning Review — no LLM required" (janumicode_spec_v2.3.md L1591) — Ordering doctrine: deterministic layer always precedes probabilistic layer.
- "strict order with **short-circuit evaluation**: if any criterion fails, the remaining criteria are not evaluated ... If schema validation fails, Invariant checks, Reasoning Reviews, and Consistency checks do not run." (janumicode_spec_v2.3.md L1861-1873) — Gate evaluation layers cheap-deterministic → cached-LLM → fresh-LLM → human, short-circuiting on first failure.
- "The Trace Selection is recorded in the `reasoning_review_record` as `trace_selection_record_ids` — the exact set of records used — enabling audit of what the Reasoning Review saw." (janumicode_spec_v2.3.md L1737) — Exact review context: every review's evidence set is itself a queryable record.
- "The `reasoning_review_record` includes a `trace_sampling_applied: true | false` field ... This documents the known limitation that sampled traces may miss intermediate reasoning flaws." (janumicode_spec_v2.3.md L1735) — Honest-limitation doctrine: when review context is lossy, the loss is declared on the record.
- "When the Orchestrator performs a rollback targeting artifact X, it must traverse the `memory_edge` table for all `derives_from` edges originating from X recursively ... The human is shown the complete invalidation set before confirming." (janumicode_spec_v2.3.md L1427-1428) — Dependency invalidation: recursive derives-from closure, human sees full blast radius first.
- "Dependency closure does not cross Workflow Run boundaries. ... Prior-run artifacts are never invalidated by rollback" (janumicode_spec_v2.3.md L1437) — Invalidation blast radius is bounded by run ownership; history from other runs is untouchable.
- "`human_approved` remains `1` (the approval happened and is recorded), but a new field `invalidated_by_rollback_at` is set ... The gate is not deleted — it is a historical record." (janumicode_spec_v2.3.md L1439) — Invalidation never rewrites history: approval facts persist, current-validity is a separate axis.
- "These are distinct mechanisms that must not be conflated: | Rollback Supersession | Semantic Supersession |" (janumicode_spec_v2.3.md L1385-1389) — Two invalidation species: structural rollback within a run vs. human override of a governing position across runs.
- "Rolling back will also revert the following file system changes: [list]" ... "restores each file to `file_sha256_before` state" (janumicode_spec_v2.3.md L1340-1344) — Dependency invalidation extends beyond records to filesystem effects, via recorded before/after hashes.
- "Tool Result Misinterpretation ... Not detectable by Reasoning Review (tool results excluded from trace selection). Primary detection: test execution failure, Invariant violations. Primary diagnosis: Unsticking Agent with full Governed Stream access including tool results." (janumicode_spec_v2.3.md L314) — Lossless-stream payoff: content excluded from routine review remains queryable for deep diagnosis.
- "Reasoning Review ... Receives (narrow context — not two-channel)" (janumicode_spec_v2.3.md L1919) — Reviewers get purpose-built minimal context, deliberately different from producers' context.
- "If identical, a startup warning is logged: 'Verification Ensemble configured with identical providers — no independent signal provided.'" (janumicode_spec_v2.3.md L1972) — Layered validation honesty: redundancy without independence is flagged as no added assurance.
- "If they disagree on `overall_pass`, a `verification_ensemble_disagreement` Governed Stream Record is produced and the disagreement is escalated to the human" (janumicode_spec_v2.3.md L1968) — Validator disagreement is never auto-resolved; it becomes a governed record plus human escalation.

## VOCABULARY

- "**Governed Stream** | The single SQLite database containing every record produced by or exchanged between humans and agents ... The system of record for everything — lossless." (janumicode_spec_v2.3.md L117) — The name and definition of the one-logical-history concept itself.
- "**Dependency Closure Rollback** | A rollback that invalidates not just the target artifact but all artifacts reachable from it via `derives_from` Memory Edges" (janumicode_spec_v2.3.md L318) — Canonical term for closure-based invalidation.
- "**Semantic Supersession** | A later record overrides an earlier record's governing position without triggering an artifact rollback" (janumicode_spec_v2.3.md L288) — Names the non-destructive override mechanism, distinct from rollback.
- "**Invariant Check** | A deterministic, non-LLM validation of an artifact against its Invariant Library rules — runs before Reasoning Review" (janumicode_spec_v2.3.md L252) — Names the deterministic layer of layered validation.
- "**Trace Selection** | The structured subset of the Execution Trace provided to the Reasoning Review — always includes all self-corrections and tool call invocations; selects reasoning steps by rule; excludes tool results" (janumicode_spec_v2.3.md L127) — Names the rule-governed, auditable review-context subset.

## SEMANTIC-INVARIANTS

- "If authority levels differ: Higher authority level governs. ... If authority levels are equal: Temporal recency governs ... If authority levels are equal AND temporal ordering is ambiguous: ... Human adjudication required before proceeding." (janumicode_spec_v2.3.md L366-378) — Deterministic three-step conflict resolution over the single history; ambiguity always resolves to a human.
- "Reasoning Review: zero high-severity flaws or all resolved; no quarantined records in governing position" (janumicode_spec_v2.3.md L773) — The quarantine invariant in gate form: quarantined content can never silently govern.
- "If a cycle is detected in `derives_from` edges ... the cycle is broken at the edge with the lowest `authority_level`. A `cycle_detected_record` ... is produced ... and the Orchestrator presents it to the human" (janumicode_spec_v2.3.md L1435) — Closure traversal must terminate; cycle-breaking is authority-ranked, recorded, and human-visible.
- "Governing Constraints (item 1) are never truncated — if they alone approach the limit, the Orchestrator escalates to human before invoking the agent." (janumicode_spec_v2.3.md L1622) — Operational form of the no-silent-truncation rule at context-assembly time.

## OPEN-QUESTIONS-CONTRADICTIONS

- "JanumiCode Master Product Specification **Version 2.5 — Implementation-Ready, Consolidated**" (janumicode_spec_v2.3.md L1-3) — Provenance mismatch: the file is named v2.3 but self-identifies as v2.5 with "Changes from v2.4" notes; canon citations should state which version they carry.
- "See Section 18 for Eval Execution Agent cross-cutting specification." (janumicode_spec_v2.3.md L1267) — Dangling internal reference: the document's Table of Contents ends at Section 17 (L35-51); the cited section does not exist.
