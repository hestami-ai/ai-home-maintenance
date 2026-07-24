# Extract: Janumi Constitution Discussion, lines 15001-16500

Slice character: this entire slice is [ASSISTANT] output — the tail of the JSDL Compiler Architecture and Bootstrap Implementation Specification v0.1 (§26 Canonical IR through §55 Next Required Artifact), including the implementation backlog and Coding Agent Operating Instructions. No HUMAN turns appear in this range, so there are no sponsor rulings. JSDL wire shapes, IR type definitions, backlog IDs, and CLI surfaces are demoted per brief; only the semantic rationale is extracted.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "No generator may bypass the validated semantic model. No runtime may redefine professional meaning independently. No UI may invent a conflicting local model." (Janumi Constitution Discussion.md L16477-16481) — Constitution-grade closure: every executable surface is downstream of one validated semantic model; no surface holds independent meaning-authority.
- [ASSISTANT] "The compiler therefore becomes the enforcement boundary between Janumi’s professional cognition discipline and the software artifacts implementing it." (Janumi Constitution Discussion.md L16483) — Names the load-bearing role of the semantic compiler: the mechanical seam where doctrine becomes enforceable on software.
- [ASSISTANT] "Prefer explicit failure over inferred meaning." (Janumi Constitution Discussion.md L16449) — First-principle candidate: professional meaning is never guessed; absence or ambiguity halts the system rather than being silently filled.
- [ASSISTANT] "Preserve the distinction between semantic PWUs and transactional aggregates." (Janumi Constitution Discussion.md L16448) — Axiomatic boundary: professional-work meaning and transactional consistency are different layers; conflating them corrupts the ontology.

## DOCTRINE-CONOP

- [ASSISTANT] "The canonical IR is the normalized semantic source of truth used by generators." (Janumi Constitution Discussion.md L15013) — Single-interpretation doctrine: one normalized representation of meaning sits between authored source and every generated surface.
- [ASSISTANT] "the compiler SHALL produce byte-identical canonical IR and generated output... Build timestamps SHOULD be excluded by default." (Janumi Constitution Discussion.md L15092-15102) — Determinism doctrine: identical meaning yields identical artifacts; verification of provenance depends on it.
- [ASSISTANT] "Correctness SHALL take priority over incremental performance." (Janumi Constitution Discussion.md L15131) — Sequencing/values doctrine: trustworthiness of the semantic pipeline outranks speed, repeated again at L15670 ("Compiler correctness takes precedence over speed").
- [ASSISTANT] "Diagnostics SHOULD answer: what is wrong; where it is wrong; why it is invalid; what related declaration is involved; how the author may correct it." (Janumi Constitution Discussion.md L15196-15202) — Professional-grade error doctrine: the system explains and coaches, mirroring how a professional would review work.
- [ASSISTANT] "diagnostics caused solely by a prior unresolved declaration SHOULD be suppressed or marked as dependent to avoid cascades." (Janumi Constitution Discussion.md L15225) — Signal-quality doctrine: one root cause, one finding; derivative noise is subordinated.
- [ASSISTANT] "Constraints not expressible in JSON Schema SHALL be documented in generated metadata and enforced through semantic validators. Example: cross-aggregate authority; evidence sufficiency; parent recomposition completeness." (Janumi Constitution Discussion.md L15418-15424) — Meaning outranks wire format: when a target format cannot carry a professional constraint, the constraint survives via validators, never silently dropped.
- [ASSISTANT] "Generated documentation SHALL clearly distinguish: canonical semantics; generated implementation notes; unresolved external validator contracts." (Janumi Constitution Discussion.md L15448-15452) — Authority-tiering doctrine for docs: readers must always know what is canon versus derived versus open.
- [ASSISTANT] "An internal compiler failure SHALL be distinguished from a user model diagnostic... Internal failures SHALL not be presented as JSDL semantic errors." (Janumi Constitution Discussion.md L15613-15624) — Blame-assignment doctrine: tool defects never masquerade as professional-model errors; trust in diagnostics depends on this separation.
- [ASSISTANT] "The compiler SHALL: 1. parse source without executing embedded content... 15. treat generator plugins as trusted code requiring explicit installation." (Janumi Constitution Discussion.md L15630-15646) — Security posture rationale: the semantic layer is declarative data, never executable; extension trust is explicit, not ambient.
- [ASSISTANT] "These are design targets, not semantic requirements." (Janumi Constitution Discussion.md L15668) — Recurring canon/implementation split: performance numbers are engineering guidance, outside the semantic constitution.
- [ASSISTANT] "The next artifact is the Janumi Runtime Semantic Architecture Specification." (Janumi Constitution Discussion.md L16489) — Sequencing/CONOP: after the compiler, the runtime (storage, events, commands, projections, reconciliation, RPH execution) is the next governed layer.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "Generators SHALL not: mutate the IR; resolve semantic names independently; silently weaken constraints; introduce new professional entities; alter lifecycle semantics; infer authority not present in the model." (Janumi Constitution Discussion.md L15293-15300) — The generator-isolation invariant: generation is semantically inert; meaning and authority originate only upstream.
- [ASSISTANT] "The fingerprint SHALL ignore: source-file order; YAML key order; comments; non-semantic formatting." (Janumi Constitution Discussion.md L15059-15064) — Model identity is semantic, not textual: two sources with identical meaning are the same model.
- [ASSISTANT] "Canonical output SHALL sort declarations by stable semantic key rather than source discovery order." (Janumi Constitution Discussion.md L15106) — Order-independence invariant: incidental file ordering never carries or alters meaning.
- [ASSISTANT] "`now` SHALL be supplied by the runtime rather than read implicitly." (Janumi Constitution Discussion.md L15007) — Determinism invariant for expressions: time is an explicit input, never ambient state; evaluations stay reproducible and auditable.
- [ASSISTANT] "Generated by: jsdl-generator-typescript@0.1.0... Model fingerprint: sha256-... Do not edit manually." (Janumi Constitution Discussion.md L15308-15314) — Provenance invariant: every generated artifact declares its semantic origin and disclaims hand-authorship; edits belong upstream in canonical source.
- [ASSISTANT] "Statistics SHALL not affect deterministic semantic output." (Janumi Constitution Discussion.md L15251) — Observability is a side channel: measurement never perturbs meaning.
- [ASSISTANT] "Never resolve ambiguity using declaration order." (Janumi Constitution Discussion.md L16437) — Restates the anti-incidental-resolution invariant as a coding-agent rule; ambiguity is a hard error.
- [ASSISTANT] "Preserve semantic distinctions among entity, value object, reference, and ownership." (Janumi Constitution Discussion.md L16447) — The ontology's four type-distinctions must survive every transformation stage, not just authoring.

## PROTOCOL-PRACTICE

- [ASSISTANT] "Snapshots SHALL remain stable across non-semantic source reformatting." (Janumi Constitution Discussion.md L15753) — Test-protocol corollary of semantic identity: the test suite itself distinguishes meaning changes from formatting changes.
- [ASSISTANT] "Each diagnostic code SHOULD have at least one fixture demonstrating the error." (Janumi Constitution Discussion.md L15767) — Every governable failure mode is executable-proven; diagnostics are stable public contracts (cf. L16440), not incidental strings.
- [ASSISTANT] "Implement phases in dependency order. Do not combine parsing, name resolution, and generation into one pass." (Janumi Constitution Discussion.md L16431-16432) — Build practice preserving the layered meaning-assignment architecture; collapsing phases is how semantic drift enters.
- [ASSISTANT] "Treat compiler crashes as defects, not model errors." (Janumi Constitution Discussion.md L16444) — Working practice sustaining the blame-assignment doctrine at the day-to-day engineering level.
- [ASSISTANT] "Record architecture deviations as explicit Decisions." (Janumi Constitution Discussion.md L16450) — Governance practice: divergence from specified architecture is legitimate only when captured as a first-class Decision record.
- [ASSISTANT] "The bootstrap compiler is complete when it can... 17. compile the canonical PWU reference module without error." (Janumi Constitution Discussion.md L16405-16423) — Definition-of-done practice: completeness is proven against the canonical professional reference model, not synthetic samples.

## OPEN-QUESTIONS-CONTRADICTIONS

- [ASSISTANT] "It shall define: authoritative entity and relationship storage; event persistence; command handling... RPH execution;" (Janumi Constitution Discussion.md L16491-16500) — Open item, not a contradiction: the Runtime Semantic Architecture Specification is promised but begins after this slice; runtime meaning-enforcement is unresolved here.
