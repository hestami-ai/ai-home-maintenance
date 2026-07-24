# Extract: Engineering Constitution (engconst)

Source: `Recursive Professional Harness/Janumi Professional Workbench - Engineering Constitution.md`
Focus: Engineering practice — code, comments, tests, logging, errors, quality, review discipline (PROTOCOL-PRACTICE rules with their WHY).
Note: the file is a four-part authored constitution (Commenting / Debugging-Observability / Testing / Quality), not a transcript; no [HUMAN]/[ASSISTANT] tagging applies. Filename abbreviated below as "Engineering Constitution.md".

## CONSTITUTIONAL CANDIDATES

- "Write comments for **future maintainers and future AI agents**, not to restate what the code already says." (Engineering Constitution.md L5) — The audience axiom for all commenting rules; comments are addressed to agents, not readers of syntax.
- "Use comments to preserve **decision context** that is not reliably recoverable from code alone. The goal is not more comments. The goal is fewer surprises." (Engineering Constitution.md L309-313) — Closing standard of the commenting constitution; defines the single test for whether a comment earns its place.
- "Observability is not just logging. It is the ability to reconstruct system behavior from emitted evidence." (Engineering Constitution.md L329) — Redefines observability as reconstructability; every logging rule downstream derives from this.
- "Testing is the systematic generation of **evidence** that an implementation satisfies its intended behavior." ... "The objective is **confidence**, not coverage percentages." (Engineering Constitution.md L699-704) — The testing philosophy: evidence over metrics; grounds the whole Evidence Pyramid.
- "If the system makes a decision, crosses a boundary, changes state, retries, suppresses data, calls an LLM, or handles an error, it should leave structured evidence." (Engineering Constitution.md L689) — The final observability standard: enumerates exactly which acts obligate evidence emission.
- "A feature is complete only when there is sufficient evidence that future humans and future AI agents can confidently answer" [7 questions: purpose, why, proof, assumptions, failure modes, regression detection, production debugging] (Engineering Constitution.md L1243-1251) — Definition of Done stated as answerable-questions, not artifact checklists.
- "**Testing is therefore not the validation of code—it is the continuous construction of evidence that the system still satisfies its intended behavior.**" (Engineering Constitution.md L1253) — The document's final sentence; testing is continuous evidence construction, aligning with JPWB exec-vs-assurance separation.

## DOCTRINE-CONOP

- "Production Validation / Chaos / Resilience / Replay / End-to-End ... / Contract / Boundary / State Validation / Integration ... / Property / Invariant / Metamorphic Tests / Unit Tests (Deterministic Logic)" (Engineering Constitution.md L773-781) — The AI-Native Evidence Pyramid: ten layers, "Every layer exists to provide a different type of confidence."
- "Production is the final testing environment." ... "If behavior cannot be observed, it cannot be trusted." (Engineering Constitution.md L1016-1031) — Layer 10 doctrine: validation extends past deploy; observability is the trust precondition.
- Debugging workflow: "Reproduce or simulate the failure ... Inspect logs/traces/state before changing code ... Make the smallest corrective change ... Do not patch symptoms without identifying the broken assumption." (Engineering Constitution.md L618-630) — Nine-step mandatory debugging protocol for agents; hypothesis-first, minimal-change discipline.
- "When completing a debugging task, the agent should report: Root cause, Broken assumption, Code changed, Tests added or updated, Observability added or updated, Residual risk, Follow-up work" (Engineering Constitution.md L634-644) — Required debugging output contract; makes the broken assumption a first-class reportable artifact.

## VOCABULARY

- Comment taxonomy: "Intent Comment ... Context Comment ... Boundary Comment ... Invariant Comment ... Tradeoff Comment ... Warning Comment" (Engineering Constitution.md L211-252) — Six named comment types "Use these categories consistently"; a shared vocabulary for machine-legible rationale.

## SEMANTIC-INVARIANTS

- "A stale comment is worse than no comment because future AI agents may treat it as authoritative." (Engineering Constitution.md L183) — Why drift is an integrity hazard, not cosmetic: agents consume comments as ground truth.
- "Never invent business rationale. If rationale is inferred, say so explicitly." (Engineering Constitution.md L281) — Provenance-honesty invariant for agent-authored comments; inferred vs. known rationale must be distinguishable.
- "Normalize before validation; never treat missing values as negative intent." (Engineering Constitution.md L99) — Boundary semantics for LLM output: absence ≠ negation; recurs in the debugging example (missing preference ≠ budget preference, L648-655).
- "Do not silently repair state unless the repair itself is explicitly designed, logged, and tested." (Engineering Constitution.md L612) — Invariant violations must halt loudly; self-healing is only legitimate as a designed, evidenced feature.
- "Never assume external systems behave correctly." (Engineering Constitution.md L767) — Trust-boundary axiom underlying contract, boundary, and chaos test layers; LLM output is external input.
- Anti-pattern: "Treating absence of evidence as evidence of absence" (Engineering Constitution.md L681) — Epistemic rule for debugging: missing telemetry proves nothing about behavior.

## PROTOCOL-PRACTICE

- "Before adding a comment, improve the code itself" ... "Make illegal states hard or impossible to represent." (Engineering Constitution.md L21-28) — Self-documenting code precedes commentary; type-level prevention over prose.
- "The source code usually explains **what** happens. Comments should explain **why it must happen that way**." (Engineering Constitution.md L46) — The why-not-what rule that filters every comment.
- "Do not paste entire user stories or acceptance criteria into source files. Reference the smallest useful fragment." (Engineering Constitution.md L62) — Traceability with minimal duplication; comments cite requirements (US/AC ids) only when they explain design.
- "Always comment when code depends on behavior outside the local source file" [APIs, databases, queues, LLM outputs, workflow engine semantics...] (Engineering Constitution.md L83-93) — Boundary contracts must be written down where the dependency lives.
- "Every TODO should include: Owner or ticket/reference, Reason, Risk or limitation, Expected resolution" (Engineering Constitution.md L155-160) — TODOs are actionable records, never bare deferrals.
- "Avoid excessive warning comments; they lose force if everything is marked dangerous." (Engineering Constitution.md L175) — WHY behind warning discipline: alarm inflation destroys signal.
- "When modifying code, update nearby comments in the same change." plus pre-completion drift checks (Engineering Constitution.md L181-191) — Comment maintenance is atomic with the edit, verified at task close.
- Agent editing rules: "Preserve existing meaningful comments unless they are wrong ... Treat comments as part of the implementation contract." (Engineering Constitution.md L275-280) — Comments have contract status; deletion/retention is a governed act, not style.
- "Add observability at every boundary where information changes trust level or ownership" capturing correlation ID, "Input shape, not sensitive raw payloads", validation result, latency, outcome, error classification (Engineering Constitution.md L335-355) — Instrument-boundaries-first ordering plus the minimum capture set.
- "For code that branches on business rules, agent reasoning, workflow state ... emit structured decision traces." ... "Future AI agents need to know not only that a result was excluded, but why." (Engineering Constitution.md L361-374) — Decisions, not just failures, are traceable events with reasons.
- "Prefer structured logs over prose strings." ... "Structured logs allow search, aggregation, replay analysis, and agent-assisted debugging." (Engineering Constitution.md L380-395) — Machine-consumable logs are the substrate for replay and agent debugging.
- "Never create isolated logs that cannot be tied back to a user action or workflow." (Engineering Constitution.md L412) — Correlation-ID propagation across every request, job, queue message, and LLM call.
- "Do not throw or log generic errors without classification." Each error carries "Stable error code, Human-readable message, Machine-readable metadata, Safe remediation hint" (Engineering Constitution.md L418-437) — Typed error discipline; classification is what makes failure evidence aggregatable.
- LLM-call telemetry (role, prompt/template version, model, schema versions, validation, guardrail, accepted/rejected) but "Do not log full prompts or outputs by default if they may contain sensitive information." (Engineering Constitution.md L464-481) — Model calls are first-class observed boundaries with redaction-by-default.
- "State machines and workflows must log every transition." ... "Rejected transitions should also be observable." (Engineering Constitution.md L487-504) — Denied transitions are evidence, not noise; guards and required fields go in the record.
- "Every significant production bug should become a regression test or replay fixture when feasible." / "The same bug should never occur twice for the same reason." (Engineering Constitution.md L568, L748) — Bug-to-permanent-evidence conversion; replay tests "preserve institutional knowledge" (L991).
- "Tests should verify: business outcomes, contracts, invariants, state transitions, externally visible behavior ... Refactoring should rarely require rewriting tests." (Engineering Constitution.md L725-735) — Behavior-over-implementation assertion discipline; "Business semantics are more stable than implementation details" (L1149).
- "Prompt changes must be evaluated against stable datasets." ... "Prompt modifications should not silently degrade behavior." (Engineering Constitution.md L1039-1049) — Prompts are versioned code requiring regression evidence.
- "Do not verify only the final answer. Verify the process." ... "Trajectory quality is part of correctness." (Engineering Constitution.md L1055-1069) — Agent trajectory testing: the path an agent takes is a tested contract.
- "Verify that important runtime events emit telemetry." ... "Observability is a testable requirement." (Engineering Constitution.md L1075-1097) — Telemetry emission itself is asserted in tests, closing the evidence loop.
- "Coverage percentages are diagnostics, not goals." ... "100% line coverage does not imply correctness." (Engineering Constitution.md L1155-1166) — Anti-coverage-worship; the enumerated evidence list (every rule, boundary, invariant, transition, contract, bug) replaces the metric.
- Every PR answers: "What behavior changed? What evidence proves correctness? ... What observability changed? What replay artifacts should be created?" (Engineering Constitution.md L1172-1180) — Review discipline framed as an evidence interrogation, mirrored by the pre-completion checklist (L1194-1220).

## SPONSOR-RULINGS

- "NOTA BENE: Complexity findings almost always (if not always) should be addressed fully." (Engineering Constitution.md L1188) — Direct sponsor directive inserted into the quality section: SonarQube complexity findings are not negotiable won't-fixes.

## OPEN-QUESTIONS-CONTRADICTIONS

- "Review \"JanumiCode\janumicode_v2\docs\sonarqube-headless-remediation-guide.md\" for details" (Engineering Constitution.md L1186) — The JPWB quality section's only operational content points into the sibling janumicode_v2 repo; the quality "guide" is otherwise empty, leaving SonarQube procedure undefined within JPWB canon. Also tension: L1188 mandates addressing complexity findings "fully" while the checklist (L1220) permits "documented exceptions where required or strongly recommended" — the exception scope is unadjudicated.
