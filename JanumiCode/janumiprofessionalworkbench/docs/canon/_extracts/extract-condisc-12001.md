# Extract: Janumi Constitution Discussion, lines 12001-13500

Slice character: a continuous [ASSISTANT]-authored JSDL v0.1 specification (chapters 8-30). No [HUMAN] turns appear in this range, hence no sponsor rulings. JSDL wire shapes/schemas are demoted per brief; only the semantic rules and rationale carried by them are extracted.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "AI permissions SHALL explicitly state whether the AI may: propose validate execute approve grant_exception ... Approval and exception authority SHOULD default to denied." (Janumi Constitution Discussion.md L12790-12800) — Constitutional AI-authority stance: agent power is enumerated per verb; approval/exception default-deny.
- [ASSISTANT] "AI-assisted validation SHALL remain attributable and reviewable." (Janumi Constitution Discussion.md L12757) — First-principle: no anonymous or unreviewable machine judgment in professional state.
- [ASSISTANT] "Task semantics are insufficient to represent professional cognition." (Janumi Constitution Discussion.md L13009-13010) — Core thesis restated as the stated reason LegacyTask is deprecated in favor of ProfessionalWorkUnit.
- [ASSISTANT] "Determine whether the stated objective describes a professionally meaningful result rather than activity alone." (Janumi Constitution Discussion.md L12737-12739) — Value axiom: outcomes over activity; objectives judged for professional meaning, not busyness.
- [ASSISTANT] "Events SHALL be immutable. Correction SHALL occur through new events, reconciliation, or superseding facts." (Janumi Constitution Discussion.md L12635-12639) — Worldview: professional history is append-only; truth is corrected forward, never rewritten.
- [ASSISTANT] "Metrics SHALL include professional meaning and SHALL not be defined solely as implementation counters." (Janumi Constitution Discussion.md L12916-12918) — Observability itself must be cognitively meaningful — a values statement, not a telemetry detail.

## DOCTRINE-CONOP

- [ASSISTANT] "PwuCognitiveState: values: intent understanding representation reasoning decision action observation reconciliation" (Janumi Constitution Discussion.md L13182-13191) — The CPCO cognition loop encoded as a state axis on every PWU; doctrine of how work thinks.
- [ASSISTANT] "Lifecycle and cognitive state shall be explicit." (PWU_INV_003) (Janumi Constitution Discussion.md L13422-13428) — Two orthogonal state axes: process lifecycle and cognitive phase are both first-class and never conflated.
- [ASSISTANT] "CompletionDisposition: completed_successfully / completed_with_accepted_residual_uncertainty / completed_as_inconclusive / completed_by_transfer / completed_by_supersession" (Janumi Constitution Discussion.md L13193-13199) — Doctrine of honest completion: closure admits residual uncertainty, inconclusiveness, transfer, supersession — not just success.
- [ASSISTANT] "failures: ... RESIDUAL_UNCERTAINTY_NOT_ACCEPTED" with payload "acceptedResidualUncertaintyIds" (Janumi Constitution Discussion.md L12522-12540) — Completion requires a human/authorized party to explicitly accept remaining uncertainty; unowned uncertainty blocks closure.
- [ASSISTANT] "Projections define semantic views over authoritative state. ... disclosures: provenance confidence residual_uncertainty contradictory_evidence authority staleness" (Janumi Constitution Discussion.md L12804-12849) — CONOP for workspaces: every projection must disclose epistemic health, not just data.
- [ASSISTANT] "prominence: contradictions: critical mandatoryConstraints: critical" (Janumi Constitution Discussion.md L12877-12879) — Presentation doctrine: contradictions and mandatory constraints are foregrounded to the operator by design.
- [ASSISTANT] "Pixel dimensions, colors, and framework-specific component names SHALL not be part of the canonical semantic model." (Janumi Constitution Discussion.md L12881) — Semantic/presentation separation: canon carries meaning-level presentation hints only.
- [ASSISTANT] "commands: owner: ProposeDecision approver: ApproveDecision RejectDecision DeferDecision reviewer: AddEvidence ChallengeClaim" (Janumi Constitution Discussion.md L12851-12860) — Projections bind available commands to role — the workspace is an authority-scoped action surface, not a viewer.
- [ASSISTANT] "The work unit changed after this view was generated. Refresh or reconcile the new state before retrying." (Janumi Constitution Discussion.md L12932-12937) — Errors speak in professional explanation, framing concurrency as reconciliation of professional state.
- [ASSISTANT] "Generated APIs SHALL preserve machine-readable error codes and professional explanations." (Janumi Constitution Discussion.md L12950) — Dual-audience doctrine: every failure legible to both machines and professionals.
- [ASSISTANT] "requiresHumanReviewWhen: expression: self.confidence < 0.8" (Janumi Constitution Discussion.md L12754-12755) — Human-in-the-loop escalation doctrine: low-confidence AI judgment routes to human review by declared threshold.
- [ASSISTANT] "Complex professional logic SHOULD remain in generated or handwritten command handlers rather than an unrestricted expression language." (Janumi Constitution Discussion.md L12581) — Rationale for constraining declarative effects: keep professional logic auditable, not buried in expressions.
- [ASSISTANT] "Every generated artifact SHOULD be traceable to its source JSDL location." (Janumi Constitution Discussion.md L13137) — Provenance doctrine extends to generated code: implementation traces back to semantic source.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "Semantic meaning SHALL NOT be inferred from: physical containment; document attachment; proximity in a UI; sequence in a list; shared storage location." (Janumi Constitution Discussion.md L12350-12358) — Implicit-relationship prohibition: all meaning is declared, never positional or incidental.
- [ASSISTANT] "Lifecycle state SHALL not be inferred from property presence, absence, or content." (Janumi Constitution Discussion.md L12440-12442) — State-inference prohibition: state is explicit fact, never derived heuristic.
- [ASSISTANT] "Inheritance SHALL represent valid semantic specialization. It SHALL NOT be used merely for code reuse." (Janumi Constitution Discussion.md L12253-12255) — Modeling invariant: type hierarchy carries meaning, not implementation convenience.
- [ASSISTANT] "An extension SHALL NOT: weaken canonical invariants; alter canonical semantic meaning; ... bypass provenance; bypass authority; replace canonical identity." (Janumi Constitution Discussion.md L12980-12989) — Extensions may specialize but never erode the canonical guarantees.
- [ASSISTANT] "A PWA concept that cannot be faithfully represented as an extension MAY propose a new CPCO concept. Such a proposal SHALL explain why composition, specialization, or relationship modeling is insufficient." (Janumi Constitution Discussion.md L12991-12995) — Canon growth is justified-by-exception; burden of proof on the new concept.
- [ASSISTANT] "Transitions from terminal states SHALL be explicit. Reopen: ... authority: permissions.ReopenPwu" (Janumi Constitution Discussion.md L12427-12438) — Terminality is real: reopening is a distinct, authority-gated act, never silent mutation.
- [ASSISTANT] "An error-level invariant violation SHALL prevent the relevant state transition or authoritative mutation." (Janumi Constitution Discussion.md L12662-12668) — Invariants are enforcement, not documentation; error severity blocks authoritative change.
- [ASSISTANT] "A role assignment SHALL be scoped." (Janumi Constitution Discussion.md L12782-12784) — Authority invariant: no role confers universal power; authority attaches to a scope.
- [ASSISTANT] "A semantic PWU MAY reference multiple transactional aggregates. The compiler SHALL NOT assume that all semantic PWU content resides in one transaction." (Janumi Constitution Discussion.md L12487-12493) — Semantic boundary ≠ transactional boundary; professional coherence spans storage transactions.
- [ASSISTANT] "Cross-aggregate coherence rules SHALL be declared as validators or process policies." (Janumi Constitution Discussion.md L12495-12499) — Coherence beyond a consistency boundary is governed explicitly, not assumed.
- [ASSISTANT] "Explicit null SHOULD be avoided for professional state." (Janumi Constitution Discussion.md L12053-12065) — Absence and nullity are distinct epistemic statements; professional state avoids ambiguous null.
- [ASSISTANT] "changing property meaning; ... weakening or replacing invariants; changing relationship semantics; changing command professional effect" constitute a major change (Janumi Constitution Discussion.md L13041-13051) — Versioning is keyed to semantic meaning, not syntax: meaning changes are breaking by definition.
- [ASSISTANT] "The expression language SHALL not permit arbitrary filesystem, network, or process access." (Janumi Constitution Discussion.md L12678-12684) — Governance logic is sandboxed; invariant evaluation can never become an execution vector.

## PROTOCOL-PRACTICE

- [ASSISTANT] "Validator Kinds: expression composite external human ai_assisted policy cross_aggregate" (Janumi Constitution Discussion.md L12709-12717) — Validation is a spectrum from mechanical to human to AI-assisted judgment, all under one declared protocol.
- [ASSISTANT] "timeout: PT30S failurePolicy: inconclusive" (external validator) (Janumi Constitution Discussion.md L12719-12729) — External validation failure degrades to "inconclusive," not pass/fail — honest epistemic fallback.
- [ASSISTANT] "PwuCompletionValidator: checks: MandatoryCompletionConditionsValidator ... BlockingDependencyValidator RecompositionValidator ResidualUncertaintyAcceptanceValidator" (Janumi Constitution Discussion.md L13447-13454) — Completion is a composite gate: conditions, dependencies, recomposition, and uncertainty acceptance all evaluated before closure.

## OPEN-QUESTIONS-CONTRADICTIONS

- [ASSISTANT] §19 PWU_INV_002: "self.exploratoryPurpose != true implies size(self.originatingIntentIds) >= 1" (L12654-12660) vs the §30 reference module's PWU_INV_002: "expression: size(self.originatingIntentIds) >= 1" with no exploratory exemption (L13416-13420) (Janumi Constitution Discussion.md L12654-13420) — Internal contradiction: the reference module drops the exploratory-PWU exemption its own description ("non-exploratory") still claims.
