# Deep Reference Specification — Commission Template

Use this to commission Codex-depth normative specification from a Claude Code session. Fill the [BRACKETS]. Pair it with the pilot preamble (`pilot-prompt.md`) when the canon governs the session.

---

## Commission: [SPEC-ID] — [Subject] Reference Specification

**Genre grant.** You are commissioned to write a **normative reference specification**, not a design doc, not a decision brief, not a summary. The document is the terminal deliverable of this session: the implementation will later be *diffed against it*, so any detail you omit is detail the implementation cannot be held to. In this genre, exhaustive is correct and brevity is a defect.

**Authoring grant.** I, the sponsor, authorize you to author normative content at field/class/state grain for [SCOPE — e.g., "the ExecutionTransition/Condition grammar and step interpreter semantics (DS-002 Tier 3C)"]. This grant covers authoring, not ratification: mark every authored choice that a reasonable sponsor might rule differently as a numbered **FORK** (decision, options, your recommendation, what changes downstream if ruled otherwise) — surfaced in a dedicated section, not buried. Where you adopt a recommendation to keep writing, say so inline. Everything else in the governance regime still holds: do not touch withheld objects outside [SCOPE]; check JPWB-REG-005 before treating a question as new.

**Required structure** (numbered artifacts force completeness — a catalog with IDs cannot silently elide):

1. **Status block** per the canon schema: layer Semantic Model (or as fits), settledness HYPOTHESIS, status DRAFT — authored under sponsor grant of [DATE], governs/doesNotGovern, precedence relative to JPWB-DOC-003 and the repository.
2. **Object catalog.** Every object in scope: purpose, ownership/aggregate, lifecycle. Then **every field**: name, type, optionality, default, semantics (what it means, not what it's called), validation rule, and who may write it. A field with fewer than all of these is a defect. No field may exist without semantics; no semantics may exist without a field or an explicit deferral to behavior.
3. **Invariant catalog.** Numbered ([SPEC-ID]-INV-nn): statement in canonical voice, WHY (the failure it prevents), SCOPE (governs / does not govern), and a NON-EXAMPLE wherever over-application is plausible.
4. **State machines.** All states, all transitions with guards and triggering commands/events, and the **illegal transitions enumerated explicitly** — never left to implication.
5. **Event/interface contract.** Every event or interface in scope: payload fields at the same per-field rigor as §2, ordering and idempotency semantics, versioning rule.
6. **Error catalog.** Stable codes, category, condition, retryability, recommended disposition.
7. **Forks.** The numbered decisions per the authoring grant.
8. **Conformance fixtures (specification).** For each invariant and each illegal transition: at least one positive and one negative fixture described concretely enough to implement without interpretation.

**Anti-elision rules.** No "etc.", no "such as" standing for a closed set, no representative example standing for an enumeration, no "similar to X" as a definition. Every name referenced anywhere in the document must be either defined in it, defined in the canon (cite the artifact and ID), or listed in a final **Deliberately Unspecified** table with the reason and the owning open question. An unlisted undefined name is a defect.

**Canon binding.** Vocabulary conforms to JPWB-DOC-002 — never redefine a canonical term. Invariants that restate DOC-003 cite it rather than duplicating. Exact shapes: this document authors them in prose *and* you produce the paired **reference artifacts** — [e.g., Zod/JSON schema + conformance fixture files at PATHS] — because per CON-000 B1 an unenforced shape reference asserts a status nothing performs. The prose and the artifacts must not be able to drift silently: the artifacts cite the spec section they implement.

**Build process.** Write to [OUTPUT PATH] section by section; do not hold the document in one response. When complete, run your own completeness audit as a distinct pass: sweep the document for referenced-but-undefined names, fields missing any of their required attributes, transitions without guards, and invariants without non-examples where plausible — fix what you find and report the audit's counts in the handoff. Expected scale for this scope: roughly [N–M] lines; if you land far under, the likely cause is elision, not efficiency — audit before concluding.

**Handoff.** Deliver: the spec, the paired reference artifacts, the fork list for my ruling, the Deliberately Unspecified table, and your completeness-audit counts.
