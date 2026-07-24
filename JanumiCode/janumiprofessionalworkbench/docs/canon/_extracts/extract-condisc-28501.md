# Extract: Janumi Constitution Discussion, lines 28501-30000

Slice character: this entire slice is [ASSISTANT] output — screens 17 through 67 of a UI/projection specification (evidence, decisions, realization map, requirements, architecture, implementation, agents, verification, releases, operations, incidents, reconciliation, coordination, attention, memory, plus cross-cutting UI contracts and SvelteKit guidance). No HUMAN turns appear in this range, so there are no sponsor rulings. Routes, field lists, endpoints, and component inventories are demoted per brief; the semantic rules embedded in acceptance criteria and prohibitions are the load-bearing content.

## DOCTRINE-CONOP

- [ASSISTANT] "Intent → Outcome → User Journey → Requirement → Architecture → Implementation Change → Verification → Release → Observation → Reconciliation" (Janumi Constitution Discussion.md L28623-28632) — The canonical product-realization chain: the doctrine's spine from purpose to observed operation and back via reconciliation.
- [ASSISTANT] "RequirementWithoutIntent ... ChangeWithoutRequirement ... ReleaseWithoutObservation ... ObservationWithoutReconciliation" (Janumi Constitution Discussion.md L28645-28652) — Coherence gaps are first-class named objects: every broken link in the realization chain is detectable and actionable.
- [ASSISTANT] "Users can move from code or test back to product Intent." (Janumi Constitution Discussion.md L28665) — Bidirectional traceability doctrine: technical artifacts always resolve back to professional purpose.
- [ASSISTANT] "The screen SHALL not default to a repository file list or agent-run list." (Janumi Constitution Discussion.md L28845-28847) — Implementation is presented as professional product-realization slices, never as raw technical inventory.
- [ASSISTANT] "The VS Code extension SHALL not consist only of: Chat, Prompt Box, Agent Output" (Janumi Constitution Discussion.md L29696-29702) — Rejects the chat-first coding-agent paradigm; the IDE surface must carry the professional model.
- [ASSISTANT] "Graphs SHALL be used only where relationships are the primary cognitive object. ... The UI SHALL avoid rendering the entire enterprise graph by default." (Janumi Constitution Discussion.md L29515-29529) — Visualization serves cognition, not spectacle; every graph needs a textual/tabular equivalent.
- [ASSISTANT] "The Command Region SHALL display only professionally valid Commands." (Janumi Constitution Discussion.md L29451-29453) — Available action = governed affordance: the UI shows only what role, authority, and state permit.
- [ASSISTANT] "A disabled Command SHALL state why it is unavailable. Example: Approve Release is unavailable because the mandatory security review failed and no exception authority is assigned." (Janumi Constitution Discussion.md L29464-29470) — Governance is explainable at the point of denial, not silently enforced.
- [ASSISTANT] "Empty states SHALL distinguish: No Data Yet, Not Applicable, Not Authorized, Filtered Out, Not Loaded, Awaiting Professional Work" (Janumi Constitution Discussion.md L29549-29558) — Absence has professional meaning; "No records found" destroys that meaning.
- [ASSISTANT] "Errors SHALL distinguish: Technical Failure, Authorization Failure, Validation Failure, Concurrency Conflict, Invariant Violation, External Dependency Failure, Projection Failure" (Janumi Constitution Discussion.md L29571-29581) — Failure taxonomy is semantic: an invariant violation is professionally different from a technical fault.
- [ASSISTANT] "Mobile SHALL prioritize: Attention, Review, Approval, Observation Capture, Evidence Capture, Incident Response, Concise PWU Understanding" (Janumi Constitution Discussion.md L29646-29656) — Mobile CONOP: humans on mobile exercise judgment and capture observations; deep authoring stays on the workbench.
- [ASSISTANT] "The user SHOULD not wait for the full graph or history before seeing the professional objective and state." (Janumi Constitution Discussion.md L29912-29924) — Loading/performance order mirrors cognitive priority: objective, state, attention, and commands first; provenance and history deferred.

## VOCABULARY

- [ASSISTANT] "Needs Framing, Ready, Reducing Uncertainty, Awaiting Evidence, Awaiting Decision, Awaiting Review, Blocked, Reconciling, Ready for Synthesis, Escalated" (Janumi Constitution Discussion.md L29261-29272) — The professional grouping vocabulary for coordinated work: states named for cognitive condition, not ticket status.
- [ASSISTANT] "Timeline entries SHALL distinguish: Semantic Event, Command, Decision, Observation, Validation, AI Contribution, Administrative Action, Technical Failure" (Janumi Constitution Discussion.md L29492-29503) — History is typed by professional meaning; AI contributions are a distinct, visible category.
- [ASSISTANT] "Why Attention Is Required ... Required Authority ... Outcome Impact ... Deferral Consequence" (Janumi Constitution Discussion.md L29338-29348) — Attention items carry their own justification, needed authority, and cost of ignoring them.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "Attachment does not imply evidentiary support." (Janumi Constitution Discussion.md L28525) — Evidence relationships (support, contradiction, qualification, inconclusive) must be explicit; presence is not endorsement.
- [ASSISTANT] "Decision status remains distinct from truth or validation. Approval requires authority. Contradicting Evidence remains visible." (Janumi Constitution Discussion.md L28567-28570) — A decision being approved never asserts it is correct; dissenting evidence cannot be hidden by approval.
- [ASSISTANT] "Implementation and verification statuses remain separate." (Janumi Constitution Discussion.md L28740) — Built and proven are orthogonal axes (execution ≠ assurance) surfaced at the requirement level.
- [ASSISTANT] "Passing build does not imply PWU completion." (Janumi Constitution Discussion.md L28905) — Technical green is not professional done; completion is a professional judgment.
- [ASSISTANT] "Agent completion is not presented as PWU completion." (Janumi Constitution Discussion.md L28977) — An agent finishing its run never closes the professional work unit; humans/authority close work.
- [ASSISTANT] "Full hidden chain-of-thought is not required. Professional rationale and Evidence are available." (Janumi Constitution Discussion.md L28975-28976) — Accountability demands professional rationale, not raw model internals — consistent with the sponsor's CoT origin-axis ruling elsewhere.
- [ASSISTANT] "Inconclusive is not treated as pass. Waivers record authority and risk." (Janumi Constitution Discussion.md L29044-29045) — Verification is fail-closed; bypassing it is an accountable, risk-bearing act.
- [ASSISTANT] "Deployment and Release acceptance remain separate. Residual risk is explicit." (Janumi Constitution Discussion.md L29107-29108) — Shipping bits and accepting a release are different professional events.
- [ASSISTANT] "Service health is not treated as equivalent to user or business Outcome success." (Janumi Constitution Discussion.md L29133) — Telemetry green ≠ outcome achieved; operations link back to product context.
- [ASSISTANT] "Service restoration alone does not close the incident. Incident reasoning and Evidence remain reconstructable." (Janumi Constitution Discussion.md L29173-29174) — Incident closure requires reconciliation and validated recovery, not just uptime.
- [ASSISTANT] "Material Attention Items SHALL not be dismissible without disposition." (Janumi Constitution Discussion.md L29360-29362) — No silent swipe-away of material obligations; every dismissal is a recorded professional disposition.
- [ASSISTANT] "Narrative fluency is not presented as proof of completeness. Users can inspect structured state beneath the narrative." (Janumi Constitution Discussion.md L29396-29397) — Generated narrative is a lossy projection with declared omissions; structured truth stays inspectable.
- [ASSISTANT] "Commands from stale projections SHALL revalidate against current authoritative state." (Janumi Constitution Discussion.md L29605) — Projections are views, never authority; action always re-checks the authoritative state.
- [ASSISTANT] "Historical mode SHALL ... disable current-state mutation ... preserve historical provenance." (Janumi Constitution Discussion.md L29611-29617) — Viewing the past is read-only and provenance-preserving; bitemporal Occurred/Recorded time runs throughout (L29507-29508).
- [ASSISTANT] "`CognitiveStateBadge` Must not reuse the lifecycle state label." (Janumi Constitution Discussion.md L29755-29757) — Lifecycle state and cognitive state are orthogonal axes that must never be visually conflated.
- [ASSISTANT] "`CompletionReadiness` Must show individual completion conditions, not only a percentage." (Janumi Constitution Discussion.md L29775-29777) — Readiness is decomposed and explainable by dimension, never a single opaque score (echoed at L28570, L29109).
- [ASSISTANT] "Model and agent identity remain visible. Tool calls are traceable." (Janumi Constitution Discussion.md L28973-28974) — AI provenance invariant: which model, which agent, which actions — always inspectable.

## PROTOCOL-PRACTICE

- [ASSISTANT] "`ProfessionalCommandBar` Must derive Commands from server-authoritative permissions and state." (Janumi Constitution Discussion.md L29779-29781) — The client never invents authority; permitted action is computed server-side and rendered, not enforced in UI.
- [ASSISTANT] "Each screen SHALL have: ... semantic invariant test ... Visual snapshot tests alone are insufficient." (Janumi Constitution Discussion.md L29984-29998) — Screens are tested against professional semantics, not pixels; the invariants above are executable obligations.
- [ASSISTANT] "Stop Agent, Safe Stop Agent" (Janumi Constitution Discussion.md L28877-28878) — Agent control distinguishes abrupt halt from orderly stop: interrupting agents is itself a governed, graded operation.

## OPEN-QUESTIONS-CONTRADICTIONS

- None found in this slice. The slice is internally consistent and consistent with earlier doctrine (exec≠assurance, projection-not-authority, CoT-not-required); it contains no HUMAN turns to rule on it.
