# Extract: JPWB Reconciliation Ratify Sheet (M0) + Implementation Roadmap and Tracker

Sources: `JPWB Reconciliation Ratify Sheet (M0).md` (62 lines) and `JPWB Implementation Roadmap and Tracker.md` (459 lines). Focus: the Ratify Sheet's entry discipline as the ratification precedent (PROTOCOL-PRACTICE); Roadmap status snapshot and sponsor decisions.

## CONSTITUTIONAL CANDIDATES

- "its single non-negotiable commitment is that **five professional concerns stay orthogonal**: **Shape** (what the work is), **Execution** (did machinery run), **Assurance** (is completion justified by admissible evidence under policy), **Governance** (who authorized, with what authority), **Baseline** (what is authoritative)." (JPWB Implementation Roadmap and Tracker.md L26-28) — The engine's stated single non-negotiable; the five-concern orthogonality is the constitutional core.
- "**`executionState = SUCCEEDED` MUST NOT imply `assuranceState = SATISFIED`** (INV-5 / property P1)." (JPWB Implementation Roadmap and Tracker.md L34) — "The canonical anti-collapse rule the whole engine exists to guarantee" — named as such at L31-33.
- "Validators only *recommend*; a separate **Assurance Service** sets the authoritative disposition; only a **Governance Decision** exercises authority; only an **authorized, version-bound decision** promotes an **immutable Baseline**." (JPWB Implementation Roadmap and Tracker.md L36-38) — The authority chain in one sentence: recommendation, disposition, authority, and baseline are held by distinct parties.
- "Aggregate assurance is the *strictest-unresolved* disposition — never a numeric average." (JPWB Implementation Roadmap and Tracker.md L38-39) — Constitutional composition rule; forbids score-averaging assurance forever.
- "**The conformance tests (DOC-008), the invariant catalog (DOC-002), and the FSM reference fixture (DOC-006) ARE the definition of done and outrank any implementation shortcut.**" (JPWB Implementation Roadmap and Tracker.md L39-40) — Establishes which artifacts hold definitional authority over implementation.
- "reconciled by the docs' own **authority precedence**: *domain invariants > reference-fixture convenience · assurance/authority (DOC-004) > legacy phase behavior · latest serialized contract (DOC-007) governs envelopes/ids/errors/TraceRelation · canonical semantics > DB/UI convenience.*" (JPWB Reconciliation Ratify Sheet (M0).md L5-7) — The ratified document-authority precedence ladder — the meta-rule for resolving all spec drift.
- "**No CRUD; every write is a command. The engine never renders**" (JPWB Implementation Roadmap and Tracker.md L100-101) — Two absolute boundary rules on the engine's public seam.

## DOCTRINE-CONOP

- "JPWB represents an undertaking as a **graph of persistent Professional Work Objects**, not a workflow." (JPWB Implementation Roadmap and Tracker.md L25-26) — Foundational modeling stance: object graph, not process.
- "Every Professional Work Unit carries **four independent state axes** — `workLifecycleState / executionState / assuranceState / shapeIntegrityState`." (JPWB Implementation Roadmap and Tracker.md L30-31) — The four-axis PWU state model.
- "**Controller-computed rollup** of the three sub-axes (sub-axes are independently-commanded facts); transition guards reference sub-axis preconditions so P1 holds and no contradictory composite state passes per-axis checks." (JPWB Implementation Roadmap and Tracker.md L122) — workLifecycleState is derived, never independently commanded; resolves the state-axis-coupling risk.
- "`WAIVED` = authoritative disposition/assessment-state **only**, never a validator recommendation." (JPWB Implementation Roadmap and Tracker.md L116) — Waiving is an exercise of authority; validators cannot recommend it.
- "Preserve `ACCEPTED ≠ VERIFIED`." (JPWB Implementation Roadmap and Tracker.md L119) — Assumption doctrine: acceptance is a stance, verification is evidence — same anti-collapse family as INV-5.
- "**STATUS: all 14 milestones (M0–M14) have a delivered, gate-green increment. 13 packages, 338 tests.** Remaining depth is documented per-milestone in OPEN-QUESTIONS (chiefly the M13 live-command-drive handlers, the M12 builders/doubles + mutation-testing, and the 6-of-12 M8 core policies)" (JPWB Implementation Roadmap and Tracker.md L360-362) — Status snapshot for REG context: M0-M14 delivered by 2026-07-11; charter remediation + sponsor items C1/C2/C4 applied 2026-07-12; MP port deferred.

## SEMANTIC-INVARIANTS

- "**PromoteBaseline** to an immutable Architecture Baseline pinned by `id + semanticVersion + contentHash`." (JPWB Implementation Roadmap and Tracker.md L172-173) — Baseline identity is the triple; content hash is load-bearing for authority, not bookkeeping.
- "assessments always cite a policy version (INV-11)." (JPWB Implementation Roadmap and Tracker.md L147) — No assessment exists without a versioned policy authority behind it.
- "**`VALIDATOR_FAILED` is NOT an error code** — it is an AssuranceAssessmentState (validator output ruled inadmissible), per DOC-004." (JPWB Reconciliation Ratify Sheet (M0).md L39-40) — Validator failure is an assurance fact, not a transport error; misclassifying it collapses the boundary-rejection semantics.

## VOCABULARY

- "Model as a validated **string**, not a global enum — the Product Realization PWA ontology (M8) defines PWU kinds as versioned data." (JPWB Reconciliation Ratify Sheet (M0).md L52) — C-1 (and C-2 artifactType, L53): ontology-owned vocabulary is data, not engine enum — the engine/ontology vocabulary boundary.
- "**Machine source of truth:** `packages/rph-contracts/vocab/canonical-vocabulary.json` … Enums are generated from it into `src/enums.ts`; a fidelity test binds the two." (JPWB Reconciliation Ratify Sheet (M0).md L9-11) — Vocabulary authority lives in one machine artifact, with a test binding prose canon to code.

## PROTOCOL-PRACTICE

The M0 Ratify Sheet is the ratification precedent. Its entry discipline:

- "This sheet is the **authoritative resolution** of that drift, grounded in a verbatim extraction of DOC-002/004/006/007" (JPWB Reconciliation Ratify Sheet (M0).md L3-4) — Precedent step 1: ratification rests on verbatim extraction of the conflicting sources, not paraphrase.
- "| # | Topic | Resolution | Authority |" (JPWB Reconciliation Ratify Sheet (M0).md L16) — Precedent entry format: every conflict resolution is a numbered row that must cite which authority-precedence rule decided it.
- "**Status: RATIFIED (by the build agent, best judgment) 2026-07-10.** Items in §C are flagged in `docs/_working/OPEN-QUESTIONS.md` for sponsor confirmation but did not block the build." (JPWB Reconciliation Ratify Sheet (M0).md L11-12) — Precedent: ratification records who ratified, under what mandate, when — and separates sponsor-pending items explicitly.
- "Resolved to keep the build moving; all logged in `docs/_working/OPEN-QUESTIONS.md` for confirmation." (JPWB Reconciliation Ratify Sheet (M0).md L48) — Best-judgment decisions never silently become canon: each is logged for sponsor confirmation.
- "*This is the one decision most worth a sponsor sanity-check.*" (JPWB Reconciliation Ratify Sheet (M0).md L57) — Precedent: the ratifier self-ranks its riskiest judgment call (C-6) rather than presenting all decisions as equally safe.
- "*(open item C-5)*" (JPWB Reconciliation Ratify Sheet (M0).md L25) — Precedent: §A resolutions resting on an unconfirmed judgment carry an inline cross-reference to their open item (also C-7 L26, C-8 L29).
- "the §5 ratify sheet *(first M0 work item — I own these; ratify, don't re-derive)*" (JPWB Implementation Roadmap and Tracker.md L105) — The operating verb: downstream consumers ratify the resolved vocabulary; re-derivation from raw specs is prohibited.
- "**Enum/vocabulary drift across 9 docs** — the §5 ratify sheet is the M0 gate; build no tables before it closes." (JPWB Implementation Roadmap and Tracker.md L216) — Ratification is a hard sequencing gate: no persistence schema before vocabulary closes.

## SPONSOR-RULINGS

- "D1 | **Home & role** | JPWB **IS** the platform's engine; **incubate then port**" (JPWB Implementation Roadmap and Tracker.md L16) — Locked 2026-07-10: standalone workspace now, lift into `janumi/products/janumipwb/` later; conform to platform contracts from day one.
- "D2 | **Migration scope** | **Greenfield only** | No live legacy datastore. DOC-005 / DOC-009 §21–29 migration/dual-run/cutover apparatus **not built** (❌)." (JPWB Implementation Roadmap and Tracker.md L17) — Sponsor ruling voiding a whole tract of spec apparatus; legacy phases survive only as a derived, non-authoritative compatibility projection.
- "D3 | **First increment DoD** | **Broader — include execution** | 0.1.x extends past intent→Architecture-Baseline through Maker/implementation execution, dynamic decomposition, runtime bindings, and restart recovery." (JPWB Implementation Roadmap and Tracker.md L18) — Sponsor set the 0.1.x scope boundary; spine-first sequencing is internal only.
- "D4 | **Schema tech** | **Zod-as-source → JSON Schema** | `rph-contracts` authors Zod v4, generates JSON Schema Draft 2020-12 + TS types from one source." (JPWB Implementation Roadmap and Tracker.md L19) — Sponsor pinned single-source schema authoring, matching the platform chain.
- "**2026-07-12 (after sponsor review) — C1 + C2 APPLIED ✅.** Sponsor resolved the §R design questions." (JPWB Implementation Roadmap and Tracker.md L381-382) — Post-charter sponsor rulings: instance data out of reusable packages (C1); engine requires an injected PWA, imports no concrete ontology (C2).
- "Renamed package `@janumipwb/rph-product-lens` → **`@janumipwb/rph-product-realization-pwa`** (`Product Lens` retired → **Product Realization PWA**) … **JPW → JPWB** everywhere" (JPWB Implementation Roadmap and Tracker.md L364-370) — Remediation executed against the sponsor-ratified Charter (RPH-DOC-000); naming authority flows from the charter, not the build.

## OPEN-QUESTIONS-CONTRADICTIONS

- Error-code count drift within the Ratify Sheet: the header claims "16 error codes" (JPWB Reconciliation Ratify Sheet (M0).md L9-10) while §B ratifies "**Error codes (15)** … The 15 `RPH_*` codes" (L38-39). The 16th is presumably VALIDATOR_FAILED (excluded per L39-40), but the header counts it as an error code while §B rules it is not one — unreconciled on the face of the document.
- Milestone status vs the DoD rule: L39-40 declares the conformance tests/fixtures "ARE the definition of done and outrank any implementation shortcut," yet several milestones are marked "✅" with exit criteria deferred — "✅ (RPH-FIX-002 → M13)" (JPWB Implementation Roadmap and Tracker.md L140), "✅ (6 of 12 core policies seeded; rest authored later)" (L147). The tracker mitigates via honest annotation and OPEN-QUESTIONS logging, but "✅ with deferred conformance ids" sits in tension with the stated DoD authority.
- Ratification authority: the sheet is "RATIFIED (by the build agent, best judgment)" (JPWB Reconciliation Ratify Sheet (M0).md L11) — ratified by the party whose work it gates, with sponsor confirmation of the 11 §C items still pending as of the sheet. Whether build-agent self-ratification constitutes ratification in the constitutional sense is an open question for the canon.
