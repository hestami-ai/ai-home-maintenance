# Extract: Command, Event, Schema Contract Package (part B, L1271-2546)

Source: `Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event, Schema Contract Package.md`
Note: this is a specification document, not a chat transcript — no [HUMAN]/[ASSISTANT] tags apply; no sponsor rulings appear in this range.

## CONSTITUTIONAL CANDIDATES

- "The RPH contract package must make it difficult to implement the wrong architecture accidentally." (Contract Package.md L2531) — Stated purpose of the whole package: contracts as architectural enforcement, not description.
- "A service should not be able to: mark work satisfied because a model returned output; approve a changed object using stale assurance; promote an unreviewed artifact version; hide material assumptions in prose; treat invalidated evidence as active support; grant runtime authority through an Execution Workflow template; mutate semantic state through a canvas operation; collapse validator recommendations into authoritative decisions." (Contract Package.md L2533-2542) — Eight canonical prohibitions; the negative-space constitution of the RPH.
- "The machine contracts defined here are therefore not only serialization formats. They are the first executable boundary around the architectural commitments of the Recursive Professional Harness." (Contract Package.md L2544-2546) — Contracts carry constitutional authority, not just wire shape.
- "`ExecutionStepSucceeded` cannot directly produce: AssuranceState = SATISFIED" (Contract Package.md L2288-2292) — INV-5 in contract form: execution success never confers assurance.
- "No canvas-layout schema may reference a command capable of mutating PWU semantic state." (Contract Package.md L2322) — Presentation isolation: the designer surface is constitutionally read-only over semantics.
- "Do not allow arbitrary JavaScript or SQL expressions. Use a declarative expression language." (Contract Package.md L1294-1296) — Policy applicability must be non-executable; closes a code-injection and governance-bypass channel.
- "Validator output cannot grant permissions." (Contract Package.md L2437) — Assurance machinery can never be an authority-escalation path.
- "Human decisions require authenticated identity." (Contract Package.md L2444) — Decision authority is bound to a real, authenticated human actor.

## DOCTRINE-CONOP

- "JSON Schema determines whether a payload has the correct shape. Semantic validators determine whether the requested state is professionally and architecturally legal." (Contract Package.md L2391-2393) — Two-layer validation doctrine: structural vs professional legality, never merged.
- "Structural validation and semantic validation must remain separate." (Contract Package.md L2350) — Restates the separation as a hard rule for the type-generation choice.
- "Generate TypeScript from JSON Schema or generate both from a single canonical source. Do not maintain hand-written schemas and hand-written TypeScript independently." (Contract Package.md L2328-2330) — Single canonical contract source; forbids dual-maintenance drift.
- "Persisted event schemas are permanent. A new event payload version must not rewrite old events. Use upcasters when loading older events" (Contract Package.md L2011-2015) — Event immutability doctrine: evolution happens at read time, history is never rewritten.
- "This projection preserves `dialogue` and phase vocabulary only at the legacy compatibility boundary. It is derived and non-authoritative." (Contract Package.md L1962) — Legacy dialogue/milestone vocabulary is quarantined to a derived projection; RPH objects are the authority.
- "Trace links are immutable. Corrections supersede the prior link." (Contract Package.md L1800-1802) — Traceability is append-only; correction-by-supersession, never edit-in-place.
- "The Field Service Management SaaS Reference Undertaking fixture must validate against the package before it may be used for: seed; replay; conformance; UI testing." (Contract Package.md L2173-2179) — The reference undertaking is itself contract-governed; no unvalidated fixtures anywhere in the toolchain.
- "Consumers must: reject unknown mandatory event categories; tolerate unknown optional integration events; log unsupported schema versions; never silently discard authoritative domain events." (Contract Package.md L2025-2030) — Asymmetric unknown-handling: strict on authoritative events, tolerant on optional integration.
- "Consumers must not assume they know every future enum value." (Contract Package.md L2034) with "For canonical writes, only registered values are allowed." (Contract Package.md L2044) — Read-tolerant, write-strict enum doctrine.
- "Errors must be typed and observable. They must not be represented only as arbitrary strings." (Contract Package.md L1856-1858) — Failures are first-class governed objects, not prose.
- "Do not log: secrets; unrestricted full context; raw protected user data; authorization tokens." (Contract Package.md L2424-2429) — Observability floor has an explicit privacy/secret ceiling.
- "Imported policy definitions are untrusted until registered." (Contract Package.md L2438) — Registration is the trust boundary for policy content.
- "16. The VS Code extension and runtime can share the same package." (Contract Package.md L2467) — One contract package serves both planes; forbids a divergent client-side copy.

## VOCABULARY

- "dispositionRecommendation" (validator) vs "authoritative disposition" (Contract Package.md L1496-1501, L2419-2420) — Validators recommend; only the Assurance Service's disposition is authoritative. The vocabulary encodes the recommend/decide split.
- "residualUncertainty: string[]" and "limitations: string[]" (Contract Package.md L1505-1506) — Assessments must name what remains unknown and what the validator could not do; honesty fields are contractual.

## SEMANTIC-INVARIANTS

- "The Assurance Service must reject a validator result when: policy identity or version mismatches; assessment identity mismatches; subject semantic version mismatches; required criteria are missing; referenced evidence does not exist; evidence is invalidated; disposition contradicts mandatory policy rules; output fails schema validation; independence requirements are not satisfied." (Contract Package.md L1532-1542) — Nine fail-closed acceptance gates on every validator result.
- "An Assurance Assessment result referencing Architecture semantic version 2 must not be applied to version 3." (Contract Package.md L2284) — Subject-version binding: assurance is pinned to the exact reviewed version, never carried forward.
- "`PromoteBaseline` must include exact semantic versions and hashes for reviewed items." (Contract Package.md L2296) — Baseline identity: promotion binds exactly what was reviewed, byte-anchored.
- "Evidence with: status = INVALIDATED cannot appear as accepted support in a completed assessment." (Contract Package.md L2300-2306) — Invalidated evidence is dead for support purposes.
- "An approval command without sufficient authority must be rejected before producing `DecisionEffective`." (Contract Package.md L2310) — Authority check precedes effect; no effective-then-audit.
- "An event with an aggregate revision not equal to prior revision plus one must be rejected by the event store." (Contract Package.md L2314) — Gapless, strictly ordered event history per aggregate.
- "A duplicate idempotency key produces no additional domain event." (Contract Package.md L2318) with "return the prior result; do not execute the domain operation again." (Contract Package.md L2140-2141) — Exactly-once domain effect under retries.
- "Domain events and their outbox messages must be committed in the same database transaction." (Contract Package.md L2111) — Atomic outbox: no event without its publication record, and vice versa.
- "11. Unknown properties are rejected at canonical write boundaries." (Contract Package.md L2462) — Write-side strictness invariant complementing read-side tolerance.

## PROTOCOL-PRACTICE

- "Receive → Parse JSON → Validate envelope schema → Validate payload schema → Normalize identifiers and timestamps → Validate authorization → Load aggregate → Check expected revision → Evaluate domain invariants → Produce events → Persist events and outbox atomically → Update projections asynchronously" (Contract Package.md L2053-2064) — Canonical command pipeline; the ordering (authz before load, invariants before events) is load-bearing.
- "Verify validator registry identity → Verify policy/version → Verify assessment identity → Verify subject versions → Verify evidence references → Verify independence → Apply policy disposition rules" (Contract Package.md L2073-2079) — Validator-result intake order: identity and independence are verified before any disposition logic runs.
- "Major: Breaking contract change requiring consumer modification. ... changing property meaning; changing enum semantics; changing event interpretation" (Contract Package.md L1976-1986) — SemVer keyed to meaning changes, not just shape changes: semantics drift is a MAJOR break.
- "Implement first: CaptureIntent ... PromoteBaseline" (Contract Package.md L2184-2218) — First-slice scope is the full intent→assurance→decision→baseline spine, not a UI-first sliver.

## OPEN-QUESTIONS-CONTRADICTIONS

- "Generated TypeScript may include an unknown fallback: `UNKNOWN:${string}`" (Contract Package.md L2036-2041) vs "Unknown properties are rejected at canonical write boundaries." (Contract Package.md L2462) — Not strictly contradictory (values vs properties, read vs write), but the boundary where an `UNKNOWN:` value read from a projection may re-enter a canonical write is unspecified.
