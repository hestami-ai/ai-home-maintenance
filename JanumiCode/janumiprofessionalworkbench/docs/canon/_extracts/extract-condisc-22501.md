# Extract: Janumi Constitution Discussion.md, lines 22501–24000

Slice is entirely an [ASSISTANT]-drafted spec (JCPWA §§12–47: representations, lifecycle, decomposition, requirements, architecture, coding-agent contract, verification, release, operations). No HUMAN turns in this range; zero sponsor rulings. Enum/property lists demoted per brief; meaning-level rules extracted.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "JCPWA SHALL preserve the distinction between software Artifacts and their professional meaning." ... "The same Representation may be embodied in multiple Artifacts." (Janumi Constitution Discussion.md L22598-L22616) — Core ontological split: artifact (file/commit) vs Representation (professional meaning); grounds the whole projection worldview.
- [ASSISTANT] "A software-product Endeavor SHALL not be represented as one rigid linear workflow. JanumiCode instead recognizes a set of recursively traversed professional regions" (Janumi Constitution Discussion.md L22715-L22717) — Anti-waterfall axiom: lifecycle is recursive regions, not a pipeline; PWUs may be active in several regions simultaneously.
- [ASSISTANT] "JanumiCode decomposition SHALL follow professional boundaries rather than arbitrary task size." (Janumi Constitution Discussion.md L22802) — First principle of decomposition: professional coherence, not effort-sizing, defines PWU boundaries.
- [ASSISTANT] "The platform SHALL not assume that the document is correct and the code is wrong, or vice versa. Both are Representations requiring reconciliation with Intent and observed reality." (Janumi Constitution Discussion.md L23129-L23131) — Epistemic neutrality axiom for drift: no representation is privileged; Intent + observed reality arbitrate.
- [ASSISTANT] "Security and privacy SHALL be integrated into product realization rather than treated as terminal reviews." (Janumi Constitution Discussion.md L23211) — Worldview: assurance disciplines are woven into realization, not gate-at-the-end.
- [ASSISTANT] "Passing all tests does not imply product validation." (Janumi Constitution Discussion.md L23679) — Verification/validation split as a first principle; echoes exec≠assurance separation.
- [ASSISTANT] "Test volume SHALL not be treated as equivalent to verification quality." (Janumi Constitution Discussion.md L23702) — Anti-metric-gaming value: prioritize by outcome impact, invariant criticality, failure likelihood, change frequency, recovery difficulty.

## DOCTRINE-CONOP

- [ASSISTANT] "Reconciliation — Update professional understanding and dependent Representations when reality or Intent changes." (Janumi Constitution Discussion.md L22770-L22772) — Defines reconciliation as a standing lifecycle region, the closing arc of the cognition loop.
- [ASSISTANT] "This is a reference structure, not a mandatory fixed template. The RPH may add, remove, or restructure PWUs according to the Endeavor." (Janumi Constitution Discussion.md L22794-L22796) — Canonical root PWU tree is advisory; RPH holds restructuring authority.
- [ASSISTANT] "Implementation SHOULD usually decompose into vertical or behaviorally complete slices ... Intent → Requirement → Architecture → Code → Test → Observable Behavior" (Janumi Constitution Discussion.md L22821-L22830) — Doctrine: valid slices thread the full trace chain end-to-end.
- [ASSISTANT] "Avoid creating PWUs solely such as: Create database files ... Add tests later — unless those boundaries are independently meaningful and recomposition obligations are explicit." (Janumi Constitution Discussion.md L22834-L22841) — Negative doctrine: horizontal layer-slicing invalid unless recomposition debt is made explicit.
- [ASSISTANT] "Parent recomposition SHALL verify more than child completion." (Janumi Constitution Discussion.md L22851) — Recomposition doctrine: cross-child coherence (consistency, interface alignment, intent alignment) is a distinct verification act.
- [ASSISTANT] "A PWU MAY span product, UX, architecture, implementation, and verification when that is the smallest professionally coherent unit." (Janumi Constitution Discussion.md L22845) — Cross-functional PWUs legitimate; coherence, not discipline, is the unit boundary.
- [ASSISTANT] "A coding agent SHALL default to the narrowest implementation satisfying current approved understanding." (Janumi Constitution Discussion.md L23390) — Anti-speculation operating doctrine; speculative abstractions require explicit rationale.
- [ASSISTANT] "Every coding-agent execution SHALL receive an explicit contract." (Janumi Constitution Discussion.md L23396) — Agents operate only under a materialized context/outputs contract with completion and escalation conditions.
- [ASSISTANT] "The selected mode SHALL constrain permissible actions." (Janumi Constitution Discussion.md L23465) — Mode doctrine (analyze/plan/implement/debug/refactor/review/verify/reconcile/explain): mode is an authority envelope, not a label.
- [ASSISTANT] "CI/CD systems are external execution and Observation systems." ... "CI results SHALL be normalized into: Actions; Artifacts; Observations; Evidence; Validations." (Janumi Constitution Discussion.md L23741-L23762) — CONOP: external tooling is projected into the governed vocabulary, never a parallel truth.
- [ASSISTANT] "Not every entity requires a direct relationship to every other entity. The path SHALL remain reconstructable." (Janumi Constitution Discussion.md L23729-L23731) — Traceability doctrine: reconstructable path, not a fully-connected graph; gaps surface as coherence issues.
- [ASSISTANT] "Validation may include: user evaluation; usability study; pilot operation; business metric evaluation; acceptance review; operational feedback." (Janumi Constitution Discussion.md L23671-L23677) — Validation is outcome-facing evidence from real users/operation, distinct in kind from verification.

## VOCABULARY

- [ASSISTANT] "A software-domain Aggregate is a Representation within JanumiCode. It SHALL not be confused with a Janumi transactional Aggregate such as the PWU Aggregate." (Janumi Constitution Discussion.md L23044-L23046) — Explicit disambiguation: DDD Aggregate (subject-matter) vs Janumi/CPCO Aggregate (platform transactional unit).
- [ASSISTANT] "A Defect is a Claim that observed software behavior conflicts with expected or required behavior." (Janumi Constitution Discussion.md L23930) — Defect defined epistemically as a Claim, not a fact — keeps it inside the Evidence/Claim vocabulary.
- [ASSISTANT] "Technical debt is a recognized future burden arising from a technical compromise, incomplete work, or accumulated divergence." (Janumi Constitution Discussion.md L23965) — Debt defined by professional trade-off, "not a generic defect" (L23980-23982).

## SEMANTIC-INVARIANTS

- [ASSISTANT] "Implementation and verification SHALL remain separate statuses." (Janumi Constitution Discussion.md L22940) — Requirement lifecycle invariant: implemented ≠ verified ≠ validated; collapse forbidden.
- [ASSISTANT] "JCODE-REQ-INV-003 — A Requirement SHALL distinguish required behavior from prematurely selected implementation unless the implementation itself is constrained." (Janumi Constitution Discussion.md L22954-L22956) — Blocks implementation disguised as need; with INV-001 (intent traceability) and INV-005 (conflicts stay visible until reconciled or accepted trade-off).
- [ASSISTANT] "Terms such as: fast, secure, scalable, easy, reliable, intuitive require interpretation or measurable criteria." (Janumi Constitution Discussion.md L22962-L22971) — JCODE-REQ-INV-004: vague quality adjectives are non-requirements until made measurable.
- [ASSISTANT] "A Journey SHALL not be treated as a decorative narrative." (Janumi Constitution Discussion.md L23013) — Journeys must trace to requirements, capabilities, UX, verification, operational Observation — or they are not governed objects.
- [ASSISTANT] "The current implementation SHALL remain traceable to current architecture Decisions or explicitly identified divergence." (Janumi Constitution Discussion.md L23100) — Architecture invariant: divergence permitted only when named; feeds drift disposition (correction/revision/exception/temporary-incoherence/reconciliation).
- [ASSISTANT] "The platform SHOULD expose whether an invariant is: specified, implemented, verified, operationally_observed. These states SHALL remain distinct." (Janumi Constitution Discussion.md L23337-L23344) — Enforcement-coverage ladder; the four assurance states never conflate.
- [ASSISTANT] "The coding agent SHALL NOT: ... suppress failing tests; remove constraints to achieve success; claim deployment or outcome success without Evidence; ... attribute AI work to a human." (Janumi Constitution Discussion.md L23434-L23447) — The twelve prohibitions: agent honesty/provenance floor, including no silent scope broadening or invented approval.
- [ASSISTANT] "These states SHALL not be collapsed into PWU lifecycle state." (Janumi Constitution Discussion.md L23578) — Change status (proposed→reverted) is an independent state machine from the PWU's own lifecycle.
- [ASSISTANT] "AI review SHALL remain attributable and SHALL not satisfy independent human review requirements unless policy explicitly permits it." (Janumi Constitution Discussion.md L23609) — AI-assurance boundary: human-independence is the default, policy-overridable only explicitly.
- [ASSISTANT] "Build success SHALL not automatically complete the PWU." (Janumi Constitution Discussion.md L23766) — CI green is Evidence input, never a completion trigger.
- [ASSISTANT] "Deployment completion and Release acceptance SHALL remain distinct." (Janumi Constitution Discussion.md L23846) — Deploy is an Action; acceptance requires observation — parallels implemented≠verified.
- [ASSISTANT] "The incident SHALL not close merely because service is restored." (Janumi Constitution Discussion.md L23916) — Incident closure requires validated recovery, residual risk recorded, Claims assessed, follow-on work, Representations reconciled.
- [ASSISTANT] "`working_as_designed` may still reveal an invalid Requirement or design Decision and may therefore trigger reconciliation." (Janumi Constitution Discussion.md L23959) — Defect adjudication cannot terminate learning; WAD is a reconciliation signal, not a dead end.

## PROTOCOL-PRACTICE

- [ASSISTANT] "A waived verification obligation SHALL record: authority; rationale; risk; expiration or review condition; affected release; compensating control." (Janumi Constitution Discussion.md L23655-L23662) — Waivers are governed, time-bounded exceptions with compensating controls, never silent skips.
- [ASSISTANT] "A commit created by Janumi SHOULD reference: pwuId, agentExecutionId, intentId, decisionIds, validationSummary — where policy permits." (Janumi Constitution Discussion.md L23535-L23543) — Commit-provenance practice binding repository artifacts back to governed work.

## OPEN-QUESTIONS-CONTRADICTIONS

- [ASSISTANT] §17.3 forbids layer-sliced PWUs ("Create API files") while §14.5 canonizes `api_implementation` / `ui_implementation` / `database_change` PWU types (Janumi Constitution Discussion.md L22670-L22676 vs L22834-L22841) — Tension: canonical PWU types are the horizontal shapes the decomposition rules disfavor; resolution ("independently meaningful boundaries") is left implicit.
- [ASSISTANT] §16's Canonical Root PWU tree is discipline/phase-shaped (Requirements PWU, Verification PWU) while §17.2 prefers vertical Intent→Observable-Behavior slices (Janumi Constitution Discussion.md L22780-L22792 vs L22821-L22830) — Reference structure and preferred decomposition pull in different directions; when each applies is not stated in this slice.
