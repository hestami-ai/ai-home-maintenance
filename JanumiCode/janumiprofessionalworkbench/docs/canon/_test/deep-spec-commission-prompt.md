# Deep Reference Specification — Commission Template (v2)

Use this to commission Codex-depth normative specification from a Claude Code session. Fill the [BRACKETS]. Pair it with the pilot preamble (`pilot-prompt.md`) when the canon governs the session.

v2 incorporates the mechanisms distilled from the pre-canon corpus generator's own methodology account (`docs/Documentation Generation Methodology Discussion/Initial Chat.md` — "Recursive Normative Specification Closure"), governed by the canon: closure matrix, sentence-level verification binding, adversarial economy pass, controlled redundancy with citation, reference-case instantiation, self-review battery. The quality metric is **normative density and closure**, never line count.

---

## Commission: [SPEC-ID] — [Subject] Reference Specification

**Genre grant.** You are commissioned to write a **normative reference specification**, not a design doc, not a decision brief, not a summary. The document is the terminal deliverable of this session: the implementation will later be *diffed against it*, so any detail you omit is detail the implementation cannot be held to. In this genre, exhaustive is correct and brevity is a defect. Optimize for semantic completeness, conformance, and implementability — never for brevity; and never add length that fails the density test (§ Self-review, deletion pass).

**Authoring grant.** I, the sponsor, authorize you to author normative content at field/class/state grain for [SCOPE]. This grant covers authoring, not ratification: mark every authored choice a reasonable sponsor might rule differently as a numbered **FORK** (decision, options, your recommendation, downstream effect if ruled otherwise). Where you adopt a recommendation to keep writing, say so inline. Label confirmed facts, inferences, assumptions, and authored-beyond-ratified content (UNRATIFIED-AUTHORED) distinctly; never invent repository facts or silently resolve contradictions — surface them. Everything else in the governance regime holds: do not touch withheld objects outside [SCOPE]; check JPWB-REG-005 before treating a question as new.

**Deontic register.** Body text uses explicit modality: **SHALL** (mandatory), **SHALL NOT** (prohibited), **SHOULD** (justified divergence permitted), **MAY** (permitted), **INFORMATIVE** (explanatory). A conforming normative sentence carries: subject + modality + required behavior/state + triggering condition + boundary/exception + **verification method**. Every SHALL/SHALL NOT names how conformance is established — a named test, fixture, check, or evidence obligation — in the same clause or an adjacent sentence. An unverifiable SHALL is a defect.

**Required structure** (numbered artifacts force completeness — a catalog with IDs cannot silently elide):

1. **Status block** per the canon schema: layer Semantic Model (or as fits), settledness HYPOTHESIS, status DRAFT — authored under sponsor grant of [DATE], governs/doesNotGovern, precedence relative to JPWB-DOC-003 and the repository. Plus: purpose, non-goals, and definition-of-done for the spec itself.
2. **Object catalog with horizontal closure.** Every object in scope gets the **closure matrix** — each dimension addressed or explicitly marked N/A *with the reason* (an unexplained absence is a defect; a reasoned N/A is closure):
   - identity & unique identification · definition · **exclusion** (what it is NOT) · purpose
   - **authority** (who may create, alter, approve, waive, revoke, supersede — per object, not globally)
   - inputs/preconditions · outputs/postconditions · relationships (typed)
   - states · lifecycle (created → revised → satisfied/invalidated/retired) · **illegal states and transitions, enumerated**
   - invariants · **versioning** (what changes meaning vs. only presentation/execution) · provenance
   - evidence & assurance hooks · **failure modes** · **recovery** (reconcile, retry, reshape, escalate)
   - **concurrency** (simultaneous revision) · **idempotency** (duplicate-effect prevention)
   - security/permission boundaries · **observability** (what must be recorded to explain behavior)
   - persistence semantics · migration/legacy relation · UX/inspection surface · verifying tests · definition of done
   Then **every field**: name, type, optionality, default, semantics, validation rule, who may write it. A field with fewer than all of these is a defect.
3. **Invariant catalog** ([SPEC-ID]-INV-nn): statement in deontic register, WHY (the failure it prevents), SCOPE (governs / does not govern), NON-EXAMPLE wherever over-application is plausible (the P6 rule), and the verifying check by name.
4. **State machines.** All states, all transitions with guards and triggering commands/events (rows cited to source where derived from the repository), and illegal transitions enumerated explicitly — never by implication.
5. **Event/interface contract.** Every event/interface in scope at the same per-field rigor; ordering, idempotency, and versioning semantics.
6. **Error catalog.** Stable codes, category, condition, retryability, recommended disposition.
7. **Adversarial economy catalog.** For each material obligation: the **cheaper-but-wrong implementation an agent would plausibly choose**, named and prohibited (SHALL NOT + the negative conformance fixture that detects it). This is the mirror of the NON-EXAMPLE rule: non-examples prevent over-application of rules; this section prevents under-implementation of obligations. Include the shortcut classes with precedent: collapsing independent state dimensions into one status; placeholder types that permit divergence silently; boolean-izing graded semantics; treating attachment/existence as satisfaction; generic CRUD standing in for semantic commands.
8. **Controlled normative redundancy.** Critical invariants are **restated in full, with a citation to their master** (canon ID or this spec's INV id), at every boundary in the document where an implementer could violate them — persistence, events, UX, migration, tests. Restatement-with-citation is required where load-bearing; citation-only is for context. The citation marks the single authority; the conformance suite keeps restatements aligned. (Cite-only everywhere deflates specification pressure; restate-without-citation reintroduces drift. Do both halves.)
9. **Reference case.** At least one realistic end-to-end scenario instantiated through the spec's own objects, states, commands, and assurance hooks — a semantic integration test of the specification itself. Where the scenario is awkward or a concept fails to instantiate, revise the spec (and record the revision), don't simplify the scenario. A spec that cannot instantiate a serious example is not closed.
10. **Conformance-fixture specification.** For each invariant, illegal transition, and prohibited shortcut: positive and negative fixtures concrete enough to implement without interpretation, including the **mutation red-proof obligation** — the named test that goes red when the enforcement is weakened; a test that cannot fail is itself a finding (B7). Where an invariant ranges over a generated space (arbitrary graphs, orderings, retry sequences, concurrent revisions), example fixtures under-cover: demand **property-based fixtures** over generated inputs for those invariants, with recorded seeds for deterministic replay.
11. **Forks** and **Deliberately Unspecified** table — every referenced-but-undefined name with its reason and owning open question; every bounded deferral explicit. Remaining gaps are governed, never tacit.

**Anti-elision rules.** No "etc.", no "such as" standing for a closed set, no representative example standing for an enumeration, no "similar to X" as a definition, no scaffolding/TODO presented as coverage. Every name referenced anywhere must be defined here, cited to the canon (artifact + ID), or listed in Deliberately Unspecified. Do not collapse independent state dimensions into one generic status.

**Canon binding.** Vocabulary conforms to JPWB-DOC-002 — never redefine a canonical term. This spec is subordinate to JPWB-DOC-003 by concern; where it restates DOC-003 meaning it does so with citation (rule 8). Exact shapes: author them in prose *and* produce the paired **reference artifacts** — [schemas/types + conformance fixture files at PATHS] — citing the spec sections they implement (CON-000 B1: an unenforced shape reference asserts a status nothing performs).

**Build process.** Write to [OUTPUT PATH] section by section. When complete, run the **self-review battery** as distinct passes, and report each pass's findings count in the handoff:
1. vocabulary-consistency (against DOC-002);
2. closure-matrix completeness (every object × every dimension: addressed or reasoned-N/A);
3. verification binding (no SHALL without a named check);
4. **adversarial economy** (for each obligation: is the cheap wrong path named and prohibited?);
5. cross-section contradiction (including restatements vs. their masters);
6. traceability (intent → principle → invariant → contract → fixture chains intact);
7. reference-case closure (the scenario instantiates end to end without hidden inference);
8. **deletion pass** (remove any line that fails the density test: does it define, constrain, distinguish, operationalize, verify, or materially illustrate? — but never delete controlled redundancy that rule 8 requires).

**Stopping condition.** Stop only when every in-scope concept is closed across the matrix, every mandatory obligation carries its verification, every plausible shortcut is prohibited, the reference case instantiates end to end, and every remaining gap is explicitly forked, deferred, or registered. Expected scale for this scope: roughly [N–M] lines; if you land far under, the likely cause is a skipped closure dimension, not efficiency — the completeness audit must name which dimensions were thin before you conclude.

**Handoff.** Deliver: the spec; the paired reference artifacts; the fork list for my ruling; the Deliberately Unspecified table; the self-review battery counts; and the closure-matrix coverage summary (objects × dimensions, with reasoned-N/A counts).
