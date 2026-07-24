# Extract: Janumi Constitution Discussion, lines 13501-15000

Slice character: this entire slice is [ASSISTANT] output — the tail of the JSDL Core v0.1 spec (§30-§44) and the opening of the JSDL Compiler Architecture and Bootstrap Implementation Specification v0.1 (§1-§25). No HUMAN turns appear in this range, so there are no sponsor rulings here. JSDL wire shapes/schemas are demoted per brief; only the semantic rationale behind them is extracted.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "Foundational Doctrine ↓ CPCO and Architectural Specifications ↓ JSDL Canonical Source ↓ Semantic Compiler ↓ Canonical Intermediate Representation ↓ Generated Contracts and Models ↓ Janumi Runtime and Workbench" (Janumi Constitution Discussion.md L13908-13920) — The full authority chain: doctrine is upstream of everything executable; code is a derived projection of meaning.
- [ASSISTANT] "The resulting architecture prevents the frontend, backend, agents, APIs, events, validators, and documentation from developing incompatible definitions of professional work." (Janumi Constitution Discussion.md L13922) — The core thesis for a single canonical semantic source: one definition of professional work across all surfaces.
- [ASSISTANT] "JSDL therefore serves as the executable bridge between the Janumi discipline and the Janumi Platform." (Janumi Constitution Discussion.md L13924) — Positions the semantic language as the load-bearing link between constitution/doctrine and running software.

## DOCTRINE-CONOP

- [ASSISTANT] "Implement JSDL as a deterministic semantic compiler, not as a YAML-to-code template engine. Preserve the distinctions among ontology, aggregate boundaries, lifecycle state, professional commands, immutable events, invariants, validators, permissions, projections, and presentation metadata." (Janumi Constitution Discussion.md L13900) — Canonical coding-agent instruction: the tooling must understand meaning, not transcribe text; enumerates the ontology's load-bearing distinctions.
- [ASSISTANT] "Every generated artifact must remain traceable to canonical JSDL source and must not introduce professional meaning absent from that source." (Janumi Constitution Discussion.md L13900) — Provenance doctrine: generation may never mint new professional meaning; meaning originates only in canonical source.
- [ASSISTANT] "The first compiler SHALL NOT attempt to: ... infer missing professional semantics; support arbitrary executable code in JSDL" (Janumi Constitution Discussion.md L14015-14026) — Non-goal doctrine: gaps in professional semantics are surfaced, never guessed; the semantic layer is not a programming language.
- [ASSISTANT] "The compiler SHALL reject ambiguous or invalid professional semantics before code generation begins." (Janumi Constitution Discussion.md L13990) — Fail-closed doctrine at the semantic gate: ambiguity is an error, not a default.
- [ASSISTANT] "The first milestone is a trustworthy semantic compilation pipeline." (Janumi Constitution Discussion.md L14028) — Sequencing doctrine: trust in the pipeline precedes feature breadth.
- [ASSISTANT] "TypeScript is recommended for the initial compiler because... This is an implementation recommendation, not a semantic requirement." (Janumi Constitution Discussion.md L13605-13615) — Explicit separation of semantic canon from technology choice; stacks are swappable, meaning is not.

## VOCABULARY

- [ASSISTANT] "`Owned<T>` indicates: lifecycle governed by the containing aggregate; no independent aggregate identity requirement; deletion or replacement controlled by the owner" (Janumi Constitution Discussion.md L14744-14749) — Ownership as a semantic (governance) concept, not a storage concept; persistence strategy is downstream.
- [ASSISTANT] "`Reference<T>` indicates: externally governed identity; no direct mutation through the containing aggregate; generated contracts carry identifiers rather than embedded authoritative state unless a projection expands them." (Janumi Constitution Discussion.md L14751-14757) — Reference means pointing at authority elsewhere; projections may expand for viewing without transferring authority.
- [ASSISTANT] "Entities possess stable identity. Value objects do not." (Janumi Constitution Discussion.md L14733-14735) — The identity axiom underlying the whole entity/value-object split in the vocabulary.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "The compiler SHALL permit a semantic PWU to reference entities outside the transactional PWU aggregate. It SHALL not infer ownership merely because an entity appears in PWU projections." (Janumi Constitution Discussion.md L14804-14809) — Key invariant: semantic boundary ≠ transactional boundary; appearing in a workspace/projection never confers ownership.
- [ASSISTANT] "does not weaken inherited invariants; does not replace canonical identity; does not alter canonical lifecycle meaning incompatibly" (Janumi Constitution Discussion.md L14928-14931) — PWA extension rule: specialization may add meaning but never subtract or contradict canonical meaning.
- [ASSISTANT] "prevent target generators from changing semantic meaning" (Janumi Constitution Discussion.md L13684) — Meaning-preservation invariant across the generation boundary; generators are semantically inert renderers.
- [ASSISTANT] "Each generator package SHALL consume the canonical IR only. Generators SHALL NOT parse source files directly." (Janumi Constitution Discussion.md L14290-14292) — Single-interpretation invariant: exactly one component (the semantic core) assigns meaning to source.
- [ASSISTANT] "Cycles are valid when professional work supports reopening or iteration. They SHOULD be disclosed in generated lifecycle documentation." (Janumi Constitution Discussion.md L14837-14839) — Professional work is not strictly linear; lifecycle cycles are legitimate but must be transparent.
- [ASSISTANT] "AI authority settings are explicit where AI roles are permitted; approval and exception permissions are not accidentally granted through broad wildcard roles." (Janumi Constitution Discussion.md L14888-14889) — Human/AI authority must be declared, never implied; high-consequence authority resists wildcard grants.
- [ASSISTANT] "presentation hints do not contain prohibited technical layout semantics" (Janumi Constitution Discussion.md L14907) — Projections carry professional presentation intent only; technical layout is the renderer's concern, keeping meaning technology-neutral.
- [ASSISTANT] "optional does not imply nullable; nullable does not imply optional." (Janumi Constitution Discussion.md L14767-14768) — Absence-of-value and absence-of-field are distinct professional statements; conflating them loses meaning.
- [ASSISTANT] "Composition SHOULD be preferred when semantic specialization is not valid." (Janumi Constitution Discussion.md L14785) — Inheritance is reserved for true is-a professional specialization; otherwise compose.
- [ASSISTANT] "If multiple imported unqualified symbols match, compilation SHALL fail. The compiler SHALL not choose based on import order." (Janumi Constitution Discussion.md L14698-14700) — Ambiguity is never silently resolved by incidental ordering; determinism over convenience.

## PROTOCOL-PRACTICE

- [ASSISTANT] "Manual edits to generated files SHOULD be prohibited or overwritten." (Janumi Constitution Discussion.md L13583) — Generated artifacts are projections, not sources; edits belong upstream in canonical source.
- [ASSISTANT] "Given identical: source content; compiler version; configuration; lockfile; module registry state; resolution SHALL select identical module versions." (Janumi Constitution Discussion.md L14537-14545) — Reproducibility discipline: same inputs, same semantic model, always.
- [ASSISTANT] "External validators are runtime integration contracts, not compiler-executed arbitrary code." (Janumi Constitution Discussion.md L13816) — Validation authority split: the compiler checks declarations; live professional judgment executes at runtime under contract.
- [ASSISTANT] "Expressions SHALL NOT: access files; access network resources; ... mutate state; call arbitrary JavaScript; use nondeterministic time unless time is supplied explicitly as evaluation context; use randomness." (Janumi Constitution Discussion.md L14986-14995) — Invariant/guard expressions are pure, deterministic professional predicates — auditable and replayable.
- [ASSISTANT] "JSDL source SHALL be treated as trusted build input only after review." (Janumi Constitution Discussion.md L13804) — Semantic source enters the trust boundary via human review, not by existing.
- [ASSISTANT] "Symbol IDs SHALL not depend on file ordering." (Janumi Constitution Discussion.md L14651) — Identity of meaning derives from semantic path, never from incidental file layout.
- [ASSISTANT] "`jsdl diff model-v1 model-v2` ... Classifies changes as: patch-compatible; minor-compatible; potentially-breaking; breaking" (Janumi Constitution Discussion.md L13768, L13787-13794) — Semantic evolution is governed: every model change is classified for compatibility before it propagates.

## OPEN-QUESTIONS-CONTRADICTIONS

- [ASSISTANT] No HUMAN turns appear in L13501-15000; this entire compiler-spec block is unratified assistant proposal. Whether the sponsor endorses the JSDL compiler program (vs. the vocabulary/doctrine alone) cannot be established from this slice. (Janumi Constitution Discussion.md L13501-15000) — Ratification status of the whole JSDL toolchain is an open question for canon synthesis.
