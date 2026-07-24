# Extract: Legacy JanumiCode Master Product Specification v2.3 — Part B (lines 2101-4221)

Source: `Legacy JanumiCode Source Materials/janumicode_spec_v2.3.md`
Scope: sections 8.4-17 (Deep Memory, failure taxonomy, Unsticking, invariants, ingestion, memory edges, prompts, config, DB, versioning, CLI protocol, UI contract). Transfer-value meaning only; wire shapes ceded to the repository. Note: the task's "design brief" path resolved to `undefined` — brief not read; extraction ran on the standing section-header contract used by sibling extracts.

## CONSTITUTIONAL CANDIDATES

- "must characterize with equal rigor any gaps in that reconstruction, their cause, and their materiality, so that the hiring entity can act or decide in a way that is genuinely complete and trustworthy, or knows exactly why it cannot yet do so." (janumicode_spec_v2.3.md L2123) — Memory reconstruction owes equal rigor to gaps as to findings; ignorance must be characterized, not hidden.
- "There is no \"fast mode.\" When completeness cannot be achieved, that fact is surfaced in the Context Packet — it is never acceptable to return partial context as if it were complete." (janumicode_spec_v2.3.md L2125) — Partiality is permitted; misrepresented partiality is not.
- "If the Intent Statement was wrong ... the system will pass all automated checks yet be functionally incorrect. This is \"Consistency Without Truth\" — the primary defense is the human as external ground truth at the Phase 2 domain attestation step." (janumicode_spec_v2.3.md L2326) — Named honest boundary: internal consistency can never substitute for human domain truth.
- "Do not imply a position was stable if it changed during the Phase ... Every substantive claim must cite a `source_record_id` ... Express uncertainty where evidence was partial or contested" (janumicode_spec_v2.3.md L2110-2114) — Anti-narrative-smoothing rules: provenance-cited claims, preserved instability, explicit uncertainty.
- "`contradictions` and `open_questions` fields — agent must surface ambiguity, not resolve it" (janumicode_spec_v2.3.md L2304) — Narrative over-synthesis is a named failure mode; ambiguity belongs to the human, not the summarizer.
- "Every response includes Provenance Statements citing specific Governed Stream Record IDs. If retrieval finds nothing: says so clearly and offers structured paths forward. Never fabricates history." (janumicode_spec_v2.3.md L2611) — History answers are provenance-bound; absence is reported, never filled.
- "**Spec Drift Through Approval** | System-Proposed Content (Authority Level 1) approved by human and treated as correct" (janumicode_spec_v2.3.md L2323) — Human approval of a system proposal does not launder it into ground truth; lineage flags persist downstream.
- "Quarantined records are excluded from retry Context Payloads ... Available in full to the Unsticking Agent and for audit. Never deleted." (janumicode_spec_v2.3.md L3348) — Quarantine hides from consumers, never from audit; the stream is lossless.
- "The Unsticking Agent never tells the stuck agent what to do. It asks questions and provides context that help the stuck agent deduce the path forward itself." (janumicode_spec_v2.3.md L2365) — Rescue preserves the worker's agency and accountability; Socratic, not dictatorial.

## DOCTRINE-CONOP

- "The materiality test: \"If this record were omitted, is there a meaningful risk that the current recommendation would become incomplete, incorrect, or non-compliant?\"" (janumicode_spec_v2.3.md L2176) — Relevance is defined by consequence of omission, not similarity score.
- "Optimize for recall — missing a relevant record is worse than including an irrelevant one." (janumicode_spec_v2.3.md L2160) — Retrieval harvest stage biases toward recall; precision is a later filtering concern.
- "**Tool Result Misinterpretation** | Agent correctly invokes a tool but draws an incorrect conclusion from its output. **Not detectable by Reasoning Review** — tool results excluded from Trace Selection by design." (janumicode_spec_v2.3.md L2322) — Every deliberate blind spot in one reviewer is assigned to another role (Unsticking Agent with full stream access).
- "invariant failures cause immediate retry with the violation injected into stdin, bypassing the Reasoning Review entirely." (janumicode_spec_v2.3.md L2520) — Deterministic checks run before and instead of LLM judgment; the retry carries the specific violated invariant, "not a vague \"try again\" signal" (L2585).
- "| `incomplete_high` | No | Yes — explicit proceed / delay / accept-with-rationale Menu ... This routing is deterministic — no LLM call required" (janumicode_spec_v2.3.md L2292-2294) — Graduated response to incomplete context: severity-tiered, deterministic routing; high incompleteness always escalates to human.
- "Exceptions are tracked and reviewed during spec upgrades — they represent technical debt in the decomposition." (janumicode_spec_v2.3.md L2725) — Co-invocation exceptions to one-artifact-per-invocation are declared, rationaled, and treated as debt.
- "Different provider from primary reasoning_review to reduce correlated errors" (janumicode_spec_v2.3.md L2927) — Independent assurance uses decorrelated judges (different model families); ensemble disagreement escalates to human (L2921).
- "If three Socratic turns produce no new reasoning from the stuck agent, the dialogue itself is stuck. Escalate to human with full transcript" (janumicode_spec_v2.3.md L2378) — Recovery mechanisms monitor themselves for the same stall they treat.
- "`unsticking_resolution` records are indexed for vector and FTS retrieval — they constitute a growing problem class library retrievable by future Deep Memory Research Agent invocations." (janumicode_spec_v2.3.md L2376) — Resolved failures become durable organizational knowledge, not discarded exhaust.
- "a new blocking invariant introduced in a new version may cause previously accepted artifacts to fail on re-check. This is intentional and documented: new invariants represent tightened correctness guarantees." (janumicode_spec_v2.3.md L3511) — Tightening standards retroactively invalidates prior acceptance by design; no grandfathering of quality.
- "JanumiCode's version management is designed with a bias toward stability over freshness. A Workflow Run should not encounter unexpected behavior due to a version change." (janumicode_spec_v2.3.md L3515) — Runs pin their governing version; upgrades apply only at gates with human acceptance.
- "Recency bias | Temporal recency is one dimension of seven; high-authority non-superseded records always included" (janumicode_spec_v2.3.md L2303) — Authority and supersession status outrank recency in memory retrieval; newest is not governing.

## VOCABULARY

- "`supersedes` | new → old | The source record replaces the target as governing position ... `contradicts` | A ↔ B | The two records make incompatible claims" (janumicode_spec_v2.3.md L2695-2696) — Relationship semantics between records: supersession is directional replacement of governing position; contradiction is symmetric and unresolved.
- "`effective_at` determines when the underlying event happened; `produced_at` determines when JanumiCode recorded it." (janumicode_spec_v2.3.md L3498) — Event time vs. recording time distinction; temporal reasoning uses event time.
- "The governed_stream row `id` is per-revision; `node_id` is the **logical** identity. Supersession by logical id enforces exactly-one-current-version" (janumicode_spec_v2.3.md L3905) — Logical identity persists across revisions; display labels are for humans, logical ids for joins (L3907).
- "The Mirror is a read-only presentation. Human interaction happens through Menu selections, Mirror approval/rejection/edit, and Decision Traces — not through modifying the Mirror directly." (janumicode_spec_v2.3.md L2671) — Mirror = deterministic reflection of system state; all human authority flows through recorded decision channels.

## SEMANTIC-INVARIANTS

- "Must carry verbatim text from the `component_model` artifact. This is the traceability link from task to architecture — paraphrasing is not permitted." (janumicode_spec_v2.3.md L2457) — Traceability across artifacts is byte-exact quotation, never paraphrase.
- "Each criterion defines a specific, verifiable condition that constitutes task completion — independent of the agent's self-assessment." (janumicode_spec_v2.3.md L2455) — Done-ness is externally verifiable criteria, never the worker's own claim.
- "Saturation termination reads `semantic_delta`; `delta_from_previous_pass` is audit." (janumicode_spec_v2.3.md L3962) — Convergence is judged on deduplicated semantic novelty, not raw output volume; raw counts retained for audit.
- "Sanitization is pre-storage — the sanitized version is what all downstream roles see. `sanitized: true` flags the record so audit trails remain complete." (janumicode_spec_v2.3.md L3350) — Redaction is visible: content may be sanitized but the fact of sanitization is never hidden.
- "**No match AND `verification_step` fails:** File in indeterminate state. Immediate escalation to human — do not attempt modification." (janumicode_spec_v2.3.md L2489) — Cross-run modification is hash-guarded and idempotent; indeterminate state fails closed to human.
- "Every Sub-Phase must be idempotent — if JanumiCode crashes and restarts, the Orchestrator reads current state from the Governed Stream and resumes from the last completed Sub-Phase." (janumicode_spec_v2.3.md L3482) — Persisted stream is the sole source of resume truth; crash recovery requires no memory beyond it.

## PROTOCOL-PRACTICE

- "The `[JC:SYSTEM SCOPE]` section contains JanumiCode framework instructions ... The `[PRODUCT SCOPE]` section contains the specific task context for the product being built. These two scopes are always separated and prefixed." (janumicode_spec_v2.3.md L2782) — Framework vocabulary is namespaced and segregated from product-domain content in every prompt, preventing vocabulary collision.
- "Every new Governed Stream Record passes through the Ingestion Pipeline before becoming available to retrieval. The pipeline is synchronous — it completes before the next Sub-Phase begins." (janumicode_spec_v2.3.md L2617) — Memory is enriched (authority, edges, supersession, question-resolution) at write time, never lazily.
- "The approve button is disabled until: All `consistency_report.warnings` are individually acknowledged ... All System-Proposed Content items have explicit approval or rejection; No `severity: high` Reasoning Review flaws are unresolved" (janumicode_spec_v2.3.md L4148-4151) — Gate approval is mechanically blocked until every warning, proposal, and high flaw is explicitly adjudicated.

## OPEN-QUESTIONS-CONTRADICTIONS

- "*JanumiCode Master Product Specification — Version 2.5 (Consolidated)* ... *Consolidated from v2.0–v2.5 with all \"Identical to\" references resolved.*" (janumicode_spec_v2.3.md L4218-4221) — Footer declares Version 2.5 while the filename says v2.3; which version label governs this document is unresolved.
