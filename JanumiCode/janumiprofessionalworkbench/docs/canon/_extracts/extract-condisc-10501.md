# Extract: Janumi Constitution Discussion, lines 10501-12000

Source: `Janumi Constitution Discussion.md` (chat transcript). Slice covers the tail of the Reference Interaction and Workspace Specification (RIWS §30-§44, [ASSISTANT]), a direction-setting turn proposing JSDL (sponsor-voice, see attribution note), and the JSDL Specification v0.1 + JSDL Core v0.1 opening ([ASSISTANT]). JSDL wire/schema details demoted per brief; rationale only.

## CONSTITUTIONAL CANDIDATES

- [ASSISTANT] "A professional entering Janumi should not feel that they are navigating a database of work records. They should feel that they have entered a living professional context." (Janumi Constitution Discussion.md L11345-L11347) — Core experiential thesis of the whole workbench; the anti-"work-records database" identity claim.
- [ASSISTANT] "The interface therefore functions as a cognitive instrument. Its purpose is not merely to display Janumi's data. Its purpose is to make professional cognition inspectable, navigable, governable, and continuously coherent." (Janumi Constitution Discussion.md L11362-L11366) — Defines the UI's constitutional purpose: cognition instrument, not data display.
- [ASSISTANT] "The semantic model is no longer documentation. It becomes the compiler input." (Janumi Constitution Discussion.md L11432-L11434) — Foundational generative-platform philosophy; semantics are executable, not descriptive.
- [ASSISTANT] "At that point, Janumi transitions from being a documented architecture to a self-describing, generative platform whose semantics are executable." (Janumi Constitution Discussion.md L11779) — States the platform's end-state identity: self-describing and generative.
- [ASSISTANT] "No visual component or local client state SHALL become an independent source of professional truth." (Janumi Constitution Discussion.md L10895-L10897, UI-INV-015) — Single-source-of-truth axiom applied to every surface; projections never gain authority.
- [ASSISTANT] "AI origin SHALL remain visible after review or acceptance. Approval does not erase provenance." (Janumi Constitution Discussion.md L10805-L10807) — Permanent-provenance axiom; human approval never launders AI authorship.
- [ASSISTANT] "Professional Work Architectures SHALL extend—not replace—the canonical ontology... Extensions SHALL preserve CPCO invariants." (Janumi Constitution Discussion.md L11688-L11704) — Extension-not-replacement principle keeps all PWAs anchored to one ontology.

## DOCTRINE-CONOP

- [ASSISTANT] "The VS Code profile supports product realization without reducing Janumi to a coding chat interface." (Janumi Constitution Discussion.md L10616) — CONOP for JanumiCode: coding is one surface of cognition, chat is not the organizing frame.
- [ASSISTANT] "The PWU Explorer SHOULD organize work by: objective; decomposition; lifecycle state; cognitive state; implementation relationship. It SHALL not simply mirror the file tree." (Janumi Constitution Discussion.md L10630-L10638) — Work is organized by cognition, not by filesystem structure.
- [ASSISTANT] "A code change review SHOULD answer: Which Intent does this serve? Which Representation or Decision authorized it? Which tests validate it? Which assumptions changed? Which downstream artifacts may require reconciliation?" (Janumi Constitution Discussion.md L10666-L10672) — Canonical review doctrine: every change traces to intent, authorization, validation, reconciliation.
- [ASSISTANT] "Conversation provides a natural-language operating surface over authoritative professional cognition." (Janumi Constitution Discussion.md L10739) — Positions chat as a projection over the cognition model, never the model itself.
- [ASSISTANT] "Material conclusions, Decisions, Claims, Evidence, and Assumptions SHALL not remain only in conversation history. They SHOULD be promoted into structured entities." (Janumi Constitution Discussion.md L10763-L10765) — Promotion doctrine: conversational cognition must crystallize into governed entities.
- [ASSISTANT] "treat PWUs as cognitive aggregates rather than tasks... implement decomposition and recomposition as distinct concepts." (Janumi Constitution Discussion.md L11240-L11241) — Coding-agent contract core: PWU is cognition, not a ticket; recomposition is first-class.
- [ASSISTANT] "avoid making chat the primary organizing surface... ensure material conversational outputs become explicit entities... implement mobile and VS Code surfaces as semantic adaptations, not separate products." (Janumi Constitution Discussion.md L11246-L11255) — One semantic product, many adapted surfaces; chat subordinate.
- [ASSISTANT] "preserve the distinction among review, validation, approval, and authorization." (Janumi Constitution Discussion.md L11253) — Four distinct assurance acts; conflating them destroys governance semantics.
- [ASSISTANT] "the ontology defines meaning; aggregates define transactional boundaries; commands define professional actions; events define history; projections define user experience; validators define correctness. All are generated from a single semantic source." (Janumi Constitution Discussion.md L11749-L11758) — The six-role division of the generative architecture; anti-drift rationale for JSDL.
- [ASSISTANT] "1. **The Discipline** — ... explain *what* professional cognition is and how Janumi represents it. 2. **The Platform Specification** — ... explain *how* the platform realizes the discipline." (Janumi Constitution Discussion.md L11783-L11786) — Two-track documentation doctrine: cognition model vs implementing platform, same semantic foundation.
- [ASSISTANT] "Complex projections MAY be presented as a guided sequence. Example decision review: 1. Decision Question 2. Alternatives 3. Evidence 4. Contradictions 5. Constraints 6. Residual Uncertainty 7. Impact 8. Authorize or Defer" (Janumi Constitution Discussion.md L10693-L10705) — Canonical decision-review cognition sequence, reused on mobile (Scenario G).
- [ASSISTANT] "Routes are addressable projections. They SHALL not imply separate semantic modules or data ownership." (Janumi Constitution Discussion.md L11004-L11006) — URLs are projection addresses, not module boundaries; guards against page-siloed truth.

## SEMANTIC-INVARIANTS

- [ASSISTANT] "Captured media are Artifacts. Their interpreted meaning SHALL be represented separately." (Janumi Constitution Discussion.md L10721) — Raw evidence vs interpretation split; meaning is a distinct governed object.
- [ASSISTANT] "Lifecycle, cognitive, validity, technical loading, and confidence states SHALL remain distinct." (Janumi Constitution Discussion.md L10847-L10849, UI-INV-003) — State-dimension separation; no collapsing orthogonal state axes into one indicator.
- [ASSISTANT] "Confidence visualization SHALL avoid implying false precision." (Janumi Constitution Discussion.md L10517) — Honesty invariant: ordinal levels/intervals/distributions only, no fake numeric certainty.
- [ASSISTANT] "Contradictions SHOULD be visually prominent without implying that one side is automatically wrong." (Janumi Constitution Discussion.md L10528) — Contradiction is surfaced neutrally; adjudication is a human professional act.
- [ASSISTANT] "UI components SHALL issue semantic commands rather than mutate authoritative state directly." (Janumi Constitution Discussion.md L10871-L10873, UI-INV-009) — All mutation flows through governed commands; no direct state writes.
- [ASSISTANT] "The UI SHALL not represent a PWU as complete when professional completion conditions fail." (Janumi Constitution Discussion.md L10891-L10893, UI-INV-014) — Completion is professional, not mechanical; Scenario B shows actions-done ≠ PWU-complete.
- [ASSISTANT] "ensure completed child PWUs do not imply completed parent PWUs." (Janumi Constitution Discussion.md L11254) — Recomposition gate: parent completion requires synthesis, not child roll-up (Scenario E).
- [ASSISTANT] "A timeline entry SHALL distinguish: event time; record time; actor; semantic effect." (Janumi Constitution Discussion.md L10818-L10825) — Bitemporal invariant: when it happened vs when it was recorded.
- [ASSISTANT] "the command is rejected as stale; the UI shows the material change; the user may compare versions; no state is silently overwritten." (Janumi Constitution Discussion.md L11218-L11223, Scenario H) — Optimistic-concurrency semantics: decisions made on stale versions must fail loudly.
- [ASSISTANT] "It SHALL not alter professional meaning." (Janumi Constitution Discussion.md L11037, on Local Interaction State) — Zoom/selection/layout are meaning-free; frontend state taxonomy hinges on this.
- [ASSISTANT] "Unavailable actions and failed commands SHALL explain the professional reason." (Janumi Constitution Discussion.md L10915-L10917, UI-INV-020) — Failure explainability in professional terms, not technical errors.

## SPONSOR-RULINGS

Attribution note: the following turn (L11370-L11435) is first-person direction-setting in the sponsor's voice pattern, but the transcript is unlabeled and the turn flows into the assistant-authored JSDL spec; attribution is probable, not certain (see OPEN-QUESTIONS).

- [HUMAN] "I think this is where we should make another deliberate shift. Up until now we've been writing specifications **for humans**. The next artifact should not be primarily human-readable. It should be **the canonical source from which the platform itself is generated**." (Janumi Constitution Discussion.md L11370-L11377) — Sponsor pivots the program from human-facing specs to a machine-canonical generative source.
- [HUMAN] "I would call it the **Janumi Semantic Definition Language (JSDL).** This is not another serialization format. It is the canonical language used to define: CPCO entities; relationships; commands; events; lifecycle states; invariants; projections; validators; authority rules; UI metadata." (Janumi Constitution Discussion.md L11389-L11404) — Names JSDL and rules its scope: one canonical semantic language, not a wire format.
- [HUMAN] "Everything else becomes a generated artifact." (Janumi Constitution Discussion.md L11406) — Ruling that schemas, APIs, UI metadata, agent contracts, docs, and tests are all derived, never hand-maintained.

## PROTOCOL-PRACTICE

- [ASSISTANT] "Before execution, it SHALL present: interpreted intent; affected entities; required authority; professional effect; unresolved ambiguity." (Janumi Constitution Discussion.md L10753-L10759) — Natural-language-to-command conversion protocol: confirm interpretation before any governed mutation.
- [ASSISTANT] "Build a stable cognitive workspace shell before isolated feature pages... Validate commands server-side... test UI semantic invariants in addition to visual behavior." (Janumi Constitution Discussion.md L11231-L11251) — Coding-agent implementation contract ordering and verification practice.
- [ASSISTANT] "reject generic 'percent complete' indicators lacking professional meaning." (Janumi Constitution Discussion.md L11252) — Practice rule enforcing the no-false-precision and professional-completion invariants in built UI.
- [ASSISTANT] "JSDL is: semantic before technical; declarative rather than imperative... JSDL is not: a persistence schema; an API definition; a UI description language; a workflow language. Those are generated from JSDL." (Janumi Constitution Discussion.md L11473-L11492) — Design-principle rationale delimiting JSDL; encoding details themselves demoted.
- [ASSISTANT] "Projection metadata SHALL describe semantics, not presentation details such as pixel positions." (Janumi Constitution Discussion.md L11651) — Boundary rule: the semantic layer never carries presentation specifics.

## OPEN-QUESTIONS-CONTRADICTIONS

- Turn attribution in this slice is unmarked: the JSDL-pivot passage (L11370-L11435) reads as sponsor direction but sits contiguous with the assistant-authored JSDL spec (L11438+) with no separator; the three SPONSOR-RULINGS above carry that uncertainty. (Janumi Constitution Discussion.md L11368-L11438)
- Potential authority tension: "The semantic model is no longer documentation. It becomes the compiler input" (L11432-L11434) makes JSDL canonical, while the same turn's two-track recommendation keeps "The Discipline" documents as the explanation of *what* cognition is (L11783-L11788) — which track governs when they diverge is not resolved in this slice. (Janumi Constitution Discussion.md L11432-L11788)
- "Implementations SHALL derive code from JSDL rather than duplicating semantic definitions" (L11467) vs "domain-specific professional validators MAY require handwritten implementation" (L11668) — the generated/handwritten boundary for validators is acknowledged but left open. (Janumi Constitution Discussion.md L11467, L11655-L11668)
