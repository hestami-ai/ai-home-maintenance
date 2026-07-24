# Extract: RPH-DOC-007 Command, Event, and Schema Contract Package, lines 1-1270

Source: `docs/Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event, Schema Contract Package.md`, lines 1-1270 only.
Note: spec document, not a transcript — no HUMAN/ASSISTANT tags apply and no sponsor turns occur in this range, so there are no SPONSOR-RULINGS items.
Citation filename shortened to `RPH-DOC-007.md` for readability.
Extraction focus honored: meaning-level rules only; wire shapes, enum spellings, ID formats, and schema listings are ceded to the repository.

## CONSTITUTIONAL CANDIDATES

- "A command expresses a requested mutation. An event records that the domain accepted a mutation. ... Commands may fail. Persisted domain events represent accepted state changes and must not be rewritten." (RPH-DOC-007.md L63-79) — The request/assert dichotomy plus event immutability: the constitutional core of the whole contract package.
- "A command rejection does not produce a domain state-change event. It produces a command result" (RPH-DOC-007.md L609-613) — Failure lives outside the event stream; only accepted mutations become domain history.
- "Events are immutable. Aggregate revision increases monotonically. ... Payload contains the accepted facts, not the original request. Events do not contain presentation state." (RPH-DOC-007.md L660-666) — Event discipline: history is append-only, fact-bearing, and semantically pure of both request text and UI state.
- "Execution-step success does not alter assurance state to `SATISFIED`." (RPH-DOC-007.md L1244) — INV-5 (execution ≠ assurance) expressed at the contract boundary: doing the work never self-certifies it.
- "Canvas layout and view-state contracts must remain separate from semantic object contracts. Moving a node cannot alter a PWU semantic version." (RPH-DOC-007.md L160-164) — Presentation is non-semantic; UI manipulation can never mutate governed meaning.
- "All inbound data must be: parsed; structurally validated; normalized; semantically validated; authorized; converted into internal domain values." (RPH-DOC-007.md L127-136) — The six-stage trust pipeline every external input must cross before becoming domain state.
- "This applies to: user input; model output; validator output; database migration data; tool output; imported templates; external API responses." (RPH-DOC-007.md L138-146) — Model and validator output are explicitly untrusted — no privileged bypass for the system's own agents.
- "Commands and events must identify: actor; correlation; causation; aggregate; expected or resulting revision; timestamp; schema version." (RPH-DOC-007.md L148-158) — Every mutation is attributable; the seven mandatory attribution dimensions.
- "Their absence from the first vertical slice must not be interpreted as permission to treat an Undertaking-local runtime hierarchy as the reusable PWA definition." (RPH-DOC-007.md L15) — Scoping gaps are not license: runtime hierarchy must never masquerade as the PWA.

## DOCTRINE-CONOP

- "This package is not the complete RPH schema library. It is the minimum coherent contract set required to implement and validate the first production slice." (RPH-DOC-007.md L57) — Vertical-slice doctrine: coherent minimality over completeness; contracts grow with slices.
- "The JSON Schemas define: service boundaries; persisted event payloads; extension-to-runtime messages; validator results; fixtures; read projections. Internal implementation classes may differ, provided they preserve the contract." (RPH-DOC-007.md L83-92) — Schemas govern boundaries, not internals; implementations are free inside the contract envelope.
- "Extensibility must occur through a declared `extensions` array, not arbitrary properties." (RPH-DOC-007.md L300) — Closed canonical contracts with a single sanctioned extension channel; growth is declared, never smuggled.
- "The selected Product Realization PWA and version define the applicable PWU Types; the runtime records are PWU Instances in the Undertaking's Professional Work Graph. Execution Plans and Execution Workflows perform those instances but are not the PWA or the Professional Work Graph." (RPH-DOC-007.md L13) — Type/instance/execution altitude separation restated at the serialization layer.
- "Sensitive raw prompts or secrets must not be embedded unless explicitly required and protected." (RPH-DOC-007.md L667) — Events are durable and shared; sensitive content enters the record only deliberately and protected.

## VOCABULARY

- "`contractVersion`: package release. `schemaVersion`: serialized payload shape. `semanticVersion`: domain meaning revision. `revision`: aggregate concurrency revision." (RPH-DOC-007.md L361-366) — Four version words, four distinct meanings; conflating them collapses shape, meaning, and concurrency.
- "Command: Approve this intent. Event: IntentApproved." (RPH-DOC-007.md L70-75) — Canonical minimal example anchoring imperative-request vs past-tense-fact vocabulary.
- "The event type uses past tense." (RPH-DOC-007.md L664) — Naming convention carrying meaning: an event name asserts a completed accepted fact.

## SEMANTIC-INVARIANTS

- "`idempotencyKey` prevents repeated business effects." (RPH-DOC-007.md L604) — Idempotency defined at business-effect level, not transport dedup: replays must not re-mutate the domain.
- "`expectedRevision` is mandatory for updates to existing aggregates." (RPH-DOC-007.md L605) — Optimistic concurrency is obligatory for updates; blind overwrites of governed state are contractually impossible.
- "`correlationId` groups one professional operation across services. `causationId` identifies the command or event that caused this command." (RPH-DOC-007.md L606-607) — Causal chain semantics: every mutation is traceable to the professional operation and trigger that produced it.
- "the Undertaking exists and is bound to an immutable PWA version; a non-local PWU Instance references a PWU Type in that same PWA version; an Undertaking-local PWU Instance has no published `pwuTypeId`; `pwuKind` does not substitute for either `undertakingId` or `pwuTypeId`." (RPH-DOC-007.md L895-900) — Ownership-integrity invariants the command/event boundary must enforce; kind is not identity.
- "These references carry canonical ownership identity. An ontology identifier may describe a domain extension, but it does not replace the selected PWA version, Undertaking, or PWU Type." (RPH-DOC-007.md L572) — Ontology ids are descriptive, never authoritative ownership.
- "IDs are opaque and immutable." (RPH-DOC-007.md L428) — No meaning may be parsed out of, or edited into, an identifier.
- "impactAnalysisRequired: true" [in AssumptionFalsifiedPayload, as a literal-true field] (RPH-DOC-007.md L993) — Falsifying an assumption unconditionally obligates impact analysis; the contract makes it non-optional.

## PROTOCOL-PRACTICE

- "Schemas must not infer semantic state from: missing properties; null values; empty arrays; current legacy compatibility phase label; event ordering alone; UI state. Status fields are required where semantic state matters." (RPH-DOC-007.md L94-105) — Semantic state is always explicit; six forbidden inference sources.
- "An omitted optional field means the field is not part of that message. It does not automatically mean unknown, false, empty, or inapplicable." (RPH-DOC-007.md L123-125) — Unknown and absent are different; absence carries no default meaning.
- "Avoid nullable fields unless null has a specific domain meaning. ... Where a value is genuinely optional, omit it rather than sending null." (RPH-DOC-007.md L310-328) — Null must earn its place with domain meaning; prefer explicit status values or omission.
- "Require fields when their absence would cause semantic ambiguity. Do not require fields merely because they are convenient for one implementation." (RPH-DOC-007.md L302-306) — Requiredness is justified by ambiguity-prevention, never by implementer convenience.
- "PWA authoring and PWU Type publication contracts are outside this initial package." (RPH-DOC-007.md L15) — Explicit scope boundary; authoring/publication contracts are deferred, not implied by runtime contracts.
