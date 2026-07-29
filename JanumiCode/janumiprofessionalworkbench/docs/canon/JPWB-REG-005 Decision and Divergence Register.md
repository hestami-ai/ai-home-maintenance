---
artifactId: JPWB-REG-005
title: Decision and Divergence Register
layer: Register
settledness: LIVING
status: OPERATIVE — ratified as drafted (wholesale interim, REG-D-010, 2026-07-24); Ratify Sheet R1 remains open for clause-level amendment
version: 1.0.0
date: 2026-07-16
governs: >
  - The authoritative record of what is decided, what is open, and what has diverged.
  - Every ruling, open question, safe default, and divergence finding in the JPWB canon: an adjudication that is not recorded here (or already merged into a governing artifact) has no authority.
  - Ratification records: an artifact becomes effective via an entry here.
doesNotGovern: >
  - The meaning of terms (JPWB-DOC-002), semantic structure and invariants (JPWB-DOC-003), agent conduct (JPWB-DOC-004), vision and first principles (JPWB-CON-000), doctrine and operation (JPWB-DOC-001), or exact shapes (the repository).
  - A register entry never governs a concern directly; it governs only the interim, until it is merged into the artifact that owns the concern.
precedence: >
  On any substantive concern, the owning artifact controls; this register controls only questions of record — what was decided, by whom, when, and what remains open. A safe default recorded here binds agents only while the question it attaches to is OPEN.
changeProcedure: >
  Append-only after ratification (Section E may be rewritten by the synthesis program before ratification; thereafter append-only applies to it as to all sections). Entries are never destructively edited; a correction is a superseding entry citing the entry it supersedes. DECISION entries require sponsor authority (or explicitly recorded delegated best judgment, flagged for sponsor confirmation, per the M0 precedent). Any agent may append an OPEN QUESTION or DIVERGENCE FINDING with evidence.
ratification: REG-D-010 (2026-07-24) — the sponsor's founding ratification act, recorded in this register's Section A; that same act made this register the operative conferral mechanism for all canon artifacts
---

# JPWB-REG-005 — Decision and Divergence Register

## 0. Closure rule

**Entries close by being merged into governing artifacts. A ruling may never float outside the canon.** A decision that lives only in a conversation, a commit message, a guide, or this register is not yet law: it must be merged into the artifact that owns its concern (JPWB-CON-000 / DOC-001 / DOC-002 / DOC-003 / DOC-004, or the repository for shapes), and the entry here records the merge. This rule exists because rulings that floated outside the canon have already been lost once (the chain-of-thought ruling, REG-Q-027). The register is the ledger, never the statute book.

Non-example: this rule does not require re-ratifying a ruling each time it is restated. Once merged, the governing artifact's text is the authority; the entry here is closed history.

Non-example: the closure rule governs adjudications — DECISIONs, OPEN QUESTIONs, and DIVERGENCE FINDINGs whose substance belongs in a governing artifact. Ratification records have no owning artifact to merge into: they ARE the conferral act, are complete upon recording, and live permanently in the register without ever merging.

## 1. Entry discipline

Modeled on the M0 Reconciliation Ratify Sheet: every entry cites its authority, records who acted under what mandate and when, and separates sponsor-pending items explicitly.

Each entry carries: **id · date · type · statement · safe default** (open items only) **· disposition · merge target · status**.

- **Id series:** `REG-D-nnn` decisions, `REG-Q-nnn` open questions, `REG-F-nnn` divergence findings, `REG-E-nnn` elicitation items.
- **Type:** `DECISION` | `OPEN QUESTION` | `DIVERGENCE FINDING` | `PROPOSED REFINEMENT` (per DOC-004 §9.2).
- **Status** (the single normalized enumeration): `OPEN` (live; any recorded safe default binds) · `DECIDED — MERGE PENDING` (ruled; not yet carried by an EFFECTIVE governing artifact — carriage in an unratified draft does not close an entry) · `MERGED` (closed; an EFFECTIVE, ratified governing artifact carries it) · `CLOSED` (resolved without a merge target of its own — e.g., answered by an existing artifact section or mooted by a recorded act, cited in the closure) · `SUPERSEDED` (replaced by a later entry, cited) · `EFFECTIVE` (a conferral, effective on recording; conferrals never merge — §0) · `EFFECTIVE — MERGE PENDING` (effective on recording; incorporation into its named targets pending) · `EFFECTIVE — MERGED` (effective and already incorporated in its targets). *(Vocabulary history, recorded here because §1 predates the entry series and carries no version field: EFFECTIVE variants added by REG-D-014; CLOSED defined and the previously split dual enumeration normalized into this single list by the Cycle-000 micro-hygiene pass — both 2026-07-24.)*
- A **safe default** permits conservative progress without creating new meaning. It is not a resolution. If requested work requires choosing the unresolved shape itself, the agent files or updates the entry, blocks only the dependent work, and delivers everything the safe default permits (JPWB-DOC-004 §3.4).

Context note: the M0 Reconciliation Ratify Sheet stands as the ENTRY-DISCIPLINE precedent — the model this register imitates; its ratification standing (build-agent self-ratification) and its eleven best-judgment items are themselves open per REG-Q-026. The JPWB Implementation Roadmap and Tracker is a status snapshot, not canon.

---

## 2. Section A — Founding decisions (session 2026-07-16, sponsor + drafting agent)

### REG-D-001 — The problem set and the voice constraint
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** The canon synthesis program exists to solve seven diagnosed problems and honor one constraint. **P1** status flattening (every source doc speaks in the same settled register regardless of layer and ratification state; genre unmarked). **P2** authority without conferral (canonical status claimed at authoring time, never conferred by an act; only the M0 sheet was ratified). **P3** missing layers (doctrine and CONOP/CONEMP never separated out). **P4** non-traveling adjudication (the Coding Agent Guide's rulings lived only in the Guide while unmarked primaries outranked it in voice). **P5** undeclared authority direction between docs and code. **P6** rules without edges (proven failure: two agents over-applied Guide §9.7 into disabling model reasoning — vacuous compliance). **P7** scale/consumption mismatch. **C1:** the canonical voice is load-bearing and preserved in body text; it is the voice of commitment, not finality — rigor is justified by experimental validity, because a hypothesis implemented sloppily teaches nothing.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 (preamble rationale); JPWB-DOC-001 (dual stance); JPWB-DOC-004 (P6 edge rule).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-002 — The six-artifact architecture
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** The recognized corpus is exactly six artifacts — JPWB-CON-000 Constitution; JPWB-DOC-001 Doctrine and Concept of Operations; JPWB-DOC-002 Canonical Vocabulary; JPWB-DOC-003 Semantic Model and Invariant Catalog; JPWB-DOC-004 Agent Operating Protocol; JPWB-REG-005 this register — plus the repository's generated contracts, schemas, and conformance tests as shape authority. Nothing else governs. A document not in this registry, whatever its title or voice, is historical material.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 Part B (rule of recognition, clause 1).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-003 — The settledness ladder
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** Settledness descends the abstraction stack; the entire system is pre-Baseline. Level 0 **CONSTITUTIONAL** (vision, worldview, thesis, values, axioms, first principles; genuinely settled; relitigation by sponsor decision only). Level 1 **PRESUMPTIVE** (canonical vocabulary; operating protocol; strong rebuttable default; relitigation by governed refinement act — REG-005 entry, sponsor ratification, never casual drift). Level 2 **HYPOTHESIS** (doctrine details, semantic model, invariants, specifications; committed hypotheses under test — implement faithfully, treat friction as evidence; relitigation via the divergence protocol). Level 3 **EXPERIMENT** (the code: first implementation of the first principles, written without benefit of this canon; normal engineering under the protocol). **LIVING** (this register; append-only; continuous).
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 Part B (clause 4).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-004 — The authority partition: docs carry meaning, the repository carries shapes
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** The canon is authoritative for meaning, intent, doctrine, vocabulary, invariants, and protocol. The repository — generated contracts, schemas, migrations, conformance tests — is authoritative for exact shapes: wire envelopes, JSON schemas, enum spellings, ID prefixes, error codes. The canon never restates a shape the repository can express; it states the semantic requirement and defers. Precedence is by concern, not by document.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 Part B (clause 3); JPWB-DOC-003 (authority partition).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-005 — Convergence-phase authority: docs are the sole semantic authority
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** During the convergence phase (now, until closure), the canon is the sole semantic authority and the code is the first experiment being brought into conformance. Dual run never means dual semantic authority. Divergence is expected and is evidence, not scandal. The docs-win presumption is a property of this phase, not a permanent fact; settledness is thereafter earned bottom-up through real-world operation.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 Part B (convergence clause); JPWB-DOC-004 (divergence protocol).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-006 — Source corpus retirement upon ratification
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** Upon canon ratification, the pre-canon corpus (~200k+ words under `docs/`) is retired: moved out of the agent-visible tree, preserved in history. Retired documents have no authority and must not be consulted as authority; reading them requires treating them as historical evidence only. Consequently any load-bearing content not carried into the six artifacts, or explicitly ceded to the repository, is lost — survivorship was a drafting obligation. Retirement of a source document is a sponsor act, recorded here.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-CON-000 Part B (retirement clause).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-007 — Delegation boundaries
- **Date:** 2026-07-16 · **Type:** DECISION
- **Statement:** Constitutional layer: the agent never adjudicates, always escalates. Vocabulary: the agent may propose a refinement with a finding; it never applies one. Hypothesis layer: the agent classifies divergences; autonomously fixes `DOCS_STRONGER` and `ACCIDENTAL_CODE_BEHAVIOR`; escalates reality-taught candidates and semantic conflicts. Canon edits are always drafted-by-agent, ratified-by-sponsor. Code: full agency within the protocol.
- **Disposition:** Decided (sponsor + drafting agent).
- **Merge target:** JPWB-DOC-004 (divergence protocol, delegation section).
- **Status:** DECIDED — MERGE PENDING (closes on canon ratification).

### REG-D-008 — The reference/experiment split and the shape-survivorship audit
- **Date:** 2026-07-16 · **Type:** DECISION (sponsor-directed: "Proceed" on the drafted amendment)
- **Statement:** Within the repository, shape authority belongs to *reference artifacts* (schemas, generated contracts, conformance fixtures — the "expected"), never to the implementation (the "actual"); the implementation is the experiment and cannot self-certify. Because the source documents' field-level schemas are what made implementation impoverishment detectable (REG-F-005), the cession of shapes to the repository is **conditional and verified**: retirement of any schema-bearing source document (RPH-DOC-000, -002, -004, -007, -008, -009 foremost) additionally requires a **shape-survivorship audit** — for every ratified schema in that document, verify a corresponding *enforced* repository reference artifact exists (real type, real conformance fixture; no placeholder types) and that the implementation either conforms or has a filed divergence finding. Any document failing the audit joins the REG-Q-045 survivorship hold rather than retiring.
- **Disposition:** Decided; merged into CON-000 B1 (reference-artifact non-example), JPWB-DOC-004 §2.3 (reference/experiment discipline), and Ratify Sheet Part 4 (retirement precondition 4).
- **Merge target:** CON-000 B1; DOC-004 §2.3; Ratify Sheet Part 4. **Status:** DECIDED — MERGE PENDING (countersign via Ratify Sheet).
- **Superseding note (2026-07-24, Cycle 000 C000-A-03):** the merge-target's "retirement precondition 4" mis-states the Ratify Sheet as it exists — the shape-survivorship audit is **precondition 2** in Part 4's numbered list. Pointer corrected forward per append-only discipline; original text retained above.

### REG-D-009 — The three-tier documentation architecture
- **Date:** 2026-07-16 · **Type:** DECISION (sponsor-directed: "Proceed" on the drafted amendment)
- **Statement:** The canon is the **overview tier**, not the whole documentation system. Depth is a **standing tier**: the JPWB-SPEC-nnn series of deep reference specifications — one per subsystem, at field/class/state grain (object catalogs with per-field contracts, numbered invariants with why/scope/non-example, complete state machines with illegal transitions enumerated, event and error catalogs, conformance-fixture specifications) — authored under explicit sponsor grants with forks surfaced, individually ratified per this register, each paired with **enforced** repository reference artifacts that cite the spec sections they implement. The third tier is those artifacts themselves. **Rationale (sponsor-observed dynamic):** an implementing agent's rigor tracks the explicitness of the visible obligation surface; enumerated specifications convert "undue economy" into countable omission and demonstrably pulled implementations up under the pre-canon corpus, while schemas alone enforce shape at boundaries but exert no specification pressure mid-implementation. **Sequencing rule (binds the implementation roadmap when generated):** on governed ground, decision brief → sponsor rules forks → SPEC commissioned → reference artifacts → implementation; the absence of a SPEC for governed ground is a finding, never license for economy. The REG-D-008 survivorship transplant lands in this tier: a schema-bearing source document retires only as its successor SPEC + enforced artifacts stand up.
- **SPEC lifecycle (sponsor clarification, same date):** individual SPECs are **phase-bound construction authorities; only the tier is standing.** A SPEC holds authority over its ground during convergence; when its content is fully performed by enforced reference artifacts and conformance tests, its authority **transfers to the codebase** and the SPEC retires to historical status by sponsor act. At transfer, the enumerated obligation surface changes medium — prose → executable (conformance suites, fixtures, schemas) — it never disappears. Semantic modification of converged ground re-enters the pipeline (decision brief → forks → spec-delta), never informal edits to converged ground. This clause prevents SPEC-series accretion (P7 recurring in sharded form) and states the meaning of the pre-canon corpus's own retirement: **authority transfer made manifest** — the sponsor's original retirement rationale was not the corpus's depth but (a) its single orientation and (b) the transition from documentation-as-authority to codebase-as-authority once construction it instructed was realized. The shape-survivorship audit (REG-D-008) is the transfer verification.
- **Disposition:** Decided; merged into CON-000 B1 (SPEC-series recognition), CON-000 B6 (subsystem-wise convergence exit and authority transfer), and JPWB-DOC-004 §2.1 (load order + no-economy rule). Generator: the deep-spec commission template (`canon/_test/deep-spec-commission-prompt.md`, program tooling, non-canonical).
- **Merge target:** CON-000 B1 and B6; DOC-004 §2.1; the implementation roadmap (PLN-006) when generated. **Status:** DECIDED — MERGE PENDING (countersign via Ratify Sheet).

### REG-D-010 — Founding ratification: wholesale interim (the conferral act)
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor act: directive to move the canon from draft to operative state)
- **Statement:** All six canon artifacts are ratified **as drafted**, effective immediately, at version 1.0.0, in wholesale interim mode: every Ratify Sheet R1 item not individually disposed is RATIFY-as-drafted; every elicitation item (REG-E-001..022) is **DEFERRED** — its recorded safe default governs. R1 remains open: clause-level dispositions made after this date are processed as B5 amendments to the operative canon, not as pre-ratification review. Per B1, from this moment every document outside the registry is historical material — the pre-canon corpus is **quarantined by recognition** even though physical retirement awaits its four preconditions (Ratify Sheet Part 4). Physical relocation was originally deferred to retirement execution; by sponsor direction it was executed early on 2026-07-24 — `docs/_canon_draft/` → `docs/canon/` — because the old name misstated operative status. The relocation is separate from retirement, which remains gated by its four preconditions.
- **Disposition:** Effective. This entry is the ratification record contemplated by the closure-rule exception; it does not itself close by merging.
- **Merge target:** The six status blocks (applied same date). **Status:** EFFECTIVE.

### REG-D-011 — The requirement ledger (SHALL accounting) and the methodology-source transplant
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor-directed: "Proceed with both")
- **Statement:** **(1) Requirement ledger.** On governed ground, intake extracts every applicable SHALL/SHALL NOT from the governing SPEC, canon, and granted working authority into a requirement ledger mapping each obligation to its planned implementation site and verifying test (DOC-004 §3.3); the handoff closes the ledger — every entry implemented+verified or explicitly dispositioned (deferred / waived-by-cited-authority / divergent-with-finding); completion claims are made against the closed ledger, never against the diff (DOC-004 §6.3). Rationale: an omission must be visible as an unmapped obligation, not merely absent from code — the requirement-grain form of the obligation-surface principle (REG-D-009). **(2) Methodology transplant.** The pre-canon corpus generator's methodology account (`docs/Documentation Generation Methodology Discussion/Initial Chat.md` — "Recursive Normative Specification Closure") is recognized as a load-bearing method source; its mechanisms (horizontal closure matrix, sentence-level verification binding, adversarial economy catalog, controlled redundancy-with-citation, reference-case instantiation, self-review battery, normative-density metric) were transplanted 2026-07-24 into the deep-spec commission template v2 (`canon/_test/deep-spec-commission-prompt.md`). Transplant is declared complete; the chat retires with the corpus as historical material, no additional hold — its survivorship check is this entry.
- **Disposition:** Decided; merged into DOC-004 §3.3/§6.3 (version 1.1.0) and template v2 same date.
- **Merge target:** JPWB-DOC-004 (applied); template v2 (applied, non-canonical). **Status:** EFFECTIVE — MERGED.

### REG-D-012 — The gauntlet adoption set: oracle integrity, tests-of-the-tests, strategic enforcement design
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor-directed: "Proceed", incorporating the sponsor's strategic correction on enforcement design)
- **Statement:** From the constraint-gauntlet method (R. Martin post 2026-07-23 + analysis, archived as `docs/Documentation Generation Methodology Discussion/Gauntlet Constraints Discussion.md`), four adoptions: **(1) Oracle integrity and the two test streams** (DOC-004 §7.6): the oracle stream (spec-derived fixtures, acceptance criteria, gate configurations, reference artifacts) is never edited to make the implementation stream (agent-authored tests) pass; the identity that authors a change never holds, within that change, the authority to alter the artifacts that judge it; a wrong oracle is a divergence finding, never an inline edit. **(2) Tests-of-the-tests** (DOC-004 §7.4): test adequacy is a claim requiring evidence — differential mutation on changed modules, assertion-strength/never-fails detection, isolation, excessive-mocking checks. **(3) Strategic enforcement design (binds PLN-006):** development-control enforcement is designed for the multi-tenant authority model, not the current single-operator repository — the gauntlet is Assurance Engineering, not CI configuration. Gates are authored as versioned, policy-shaped reference artifacts (extending REG-E-020 into a full gate profile: coverage-on-change, complexity/size/duplication ceilings, dependency direction/no-cycles, CRAP-equivalent and mutation at changed-module grain) evaluated at authoritative boundaries the author cannot bypass; client-side execution is never the enforcement boundary; single-operator conveniences (hooks, local CI) are permitted only as **marked interim carriers** executing the same policy artifacts, with a recorded authority-transfer plan to the platform's own assurance machinery (AX-12 self-hosting; exactly-one-authority migration discipline). **(4) Sponsor generalization** (CON-000 B2): "sponsor" reads as the accountable authority under the governing authority model throughout the canon. Production-facing gate families are deferred as REG-Q-049/050, governed rather than silent.
- **Disposition:** Decided; merged same date — DOC-004 v1.2.0 (§7.4, §7.5 changed-module grain, new §7.6), CON-000 v1.1.0 (B2), deep-spec commission template (property-based fixtures).
- **Merge target:** DOC-004; CON-000; template (non-canonical); PLN-006 when generated (gate-profile authoring, interim-carrier registration, authority-transfer milestone). **Status:** EFFECTIVE — MERGED (roadmap items pending PLN-006).

### REG-D-013 — Program success metric: guarantee-strength precedes cost
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor ruling, recorded from the sponsor's own statement)
- **Statement:** The program's success metric is **guarantee-strength**: a repeatable methodology that ensures what is implemented is complete and correct given a **holistic appreciation of the user's initial underspecified intent**. All Janumi work — legacy JanumiCode, JPWB, the canon, the harness — is in service of that methodology. **Cost optimization — tokens, time, agent effort, and sponsor attention alike — is premature until the guarantees are established**; it is optimization of the wrong metric. Undue economy is the named enemy on *both* sides of the interface: implementation economy (REG-D-009's concern) and **judgment-surface economy** — compressing the sponsor's ratification surface toward assent-by-momentum is the B2 failure mode (status conferred by convenience and fluency rather than judgment) applied to governance itself. Accordingly: ratification interfaces are **full-judgment instruments** — every item carries its proposed change, motivating evidence with verification status, strongest opposing consideration, and consequences; recommendations accompany the material and never substitute for it; there is no bulk disposition. Sponsor attention is *positioned* at the oracle (REG-D-012) and is *thorough* there — positioning economizes location, never depth.
- **Primary-source note:** the sponsor's statement is direct voice bearing on REG-E-001 (the thesis sentence): "…100% complete and 100% correct given the holistic appreciation of the initial underspecified intent of the user… everything is in service to developing a repeatable methodology that provides those guarantees."
- **Merge target:** JPWB-DOC-001 (doctrine: the success metric and the dual-economy rule) and JPWB-DOC-004 §9 (ratification-interface discipline) via a future B5 amendment; until merged, this entry governs directly. First conforming instrument: `_test/cycles/cycle-000-ratify-instrument.md`.
- **Status:** EFFECTIVE — MERGE PENDING.

### REG-D-014 — Cycle-000 refinement batch: sponsor delegation and dispositions
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor-delegated: "use your judgement and intelligence to make the appropriate decisions on this set of issues"; decisions recorded as delegated authority per the established gate-authority pattern, reviewable by the sponsor at any time via the instrument at `_test/cycles/cycle-000-ratify-instrument.md`)
- **Sponsor clarification recorded with the delegation:** the REG-D-013 objection targeted *process shortcutting*, not the amount of sponsor labor; the rigor lives in the process and the record — full-judgment instruments document the basis for decisions, and the sponsor delegates disposition where sponsor voice is not itself the required input. Sponsor-voice items (REG-E-001, REG-E-003) remain open: delegation does not authorize fabricating the sponsor's own words.
- **Dispositions (all 16):** RATIFY S-01 (§9.1 SPEC-gap trigger — belt-and-suspenders per observed 3-probe wobble, over the refuters' anti-restatement position, per the controlled-redundancy rule), S-02 (§8.1 tiebreak scoped + non-example), S-04 (PROPOSED REFINEMENT entry type), S-05 (ASR-3 grouping legitimacy), S-06 (ASR-4 retrievable-record clause), S-07 (CONSTITUTIONAL — B1 program-working-references class + §2.1 load rung; formalizes the DWP-04 grant mechanism), S-08 (§7.4 interim hand-mutation default; cost objection overruled per REG-D-013), S-09 (§7.6 judgment grain), S-10 (§7.6 proposed-oracle status), S-12 (register status vocabulary), S-13 (DOC-002 tail), S-14 (§7.6 ID-routed citation), S-15 (DOC-002 §11 canon-governance vocabulary). **S-03 = option (a)** governed display aliases (product audience includes non-SMEs; a governed channel beats an ungoverned leak; disposes REG-E-011's posture — `Professional Endeavor` stays candidate, aliases give UX its outlet). **S-11 = direction (i)** — Q-043/044 closed citing DOC-003 §11; the register empties into artifacts. **S-16** applied under delegated pen (Ratify Sheet correction note). **Explicitly NOT applied:** the three refuted-HIGH amendments (B7 non-example, §9.1-as-defect framing, §7.4 weakening clause) — delegated judgment does not override the cycle's verification verdicts; one drafting near-miss (the weakening clause) was caught and reverted during application.
- **Merge targets (applied same date):** CON-000 v1.2.0; DOC-002 v1.1.0; DOC-003 v1.1.0; DOC-004 v1.3.0; this register (§1 vocabulary, Q-043/044 closures); Ratify Sheet correction. **Assure step:** the Cycle-000 regression baseline re-run is queued as the batch's verification.
- **Status:** EFFECTIVE — MERGED (subject to sponsor review of the recorded dispositions).

### REG-D-015 — The chain-of-thought retention ruling, in sponsor voice (closes REG-E-003, resolves REG-Q-027)
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor restatement, this session — the awaited voice input; no reconstruction remains load-bearing)
- **The sponsor's account, recorded:** the ruling arose from wanting to retain LLM/agent reasoning traces. Two pushbacks were raised: (1) that only local models (Ollama-class) provide reasoning traces, not frontier models — which the sponsor assesses as *generally valid* (noting Claude Code exposes traces only under special configuration); and (2) that reasoning traces are not necessarily tied to the final conclusion the model reached — also *generally true*. The agreement, per the sponsor: **"we agreed to retain the reasoning traces (where available) however they wouldn't be used by the assurance policy / assurance engineering tiers but could be used for offline diagnostic purposes (again, where available)."**
- **Reconciliation with the reconstruction:** the Guide-era/PER-12 reconstruction (retain as typed Artifact; never evidence; never forwarded; evaluator-context = independence violation) matches the ruling's prohibitions. The sponsor's account **adds** the affirmative permitted use (offline diagnostics) and the availability qualifier (provider/configuration-dependent; no obligation to procure), and supplies the ruling's own rationale: trace-conclusion decoupling is *why* traces are excluded from assurance and *why* they remain diagnostically useful. The "origin axis" definition (the term is fixed by origin, not disclosure) stands as compatible Guide-era refinement, unchallenged by the sponsor's account.
- **Disposition:** Merged into DOC-003 PER-12 (v1.2.0) same date: retain-where-available; quarantined from every assurance tier; offline diagnosis as the sole permitted use; availability nuance recorded; the "operative default pending sponsor ruling" clause retired — the ruling has landed.
- **Merge target:** JPWB-DOC-003 PER-12 (applied). Closes **REG-E-003**; resolves **REG-Q-027**. **Status:** EFFECTIVE — MERGED.

### REG-D-016 — The thesis confirmed in sponsor voice; the complexity stance merged (closes REG-E-001)
- **Date:** 2026-07-24 · **Type:** DECISION (sponsor confirmation: "Confirm B", following three recorded sponsor evidence statements this session)
- **Statement:** The constitution's thesis sentence is ratified **verbatim, variant B**: *"The Janumi Professional Workbench externalizes professional cognition into explicit, recursively decomposable and recomposable, continuously reconciled, governed representations, so that humans and AI can reason together while intent, evidence, authority, and coherence are preserved — managing professional work as the complex whole it is, not the merely complicated sum of its parts."* The confirmation carries the sponsor's two grounding arguments: (1) **structural** — "recursively composable" read against the reductionist default; the pairing states both directions with the recomposition obligation as the distinctive commitment (the irreversibility-of-reductionism test: decompose, understand every part, recompose, still missing something — that remainder is the complexity); (2) **temporal** — "complexity was in part captured by the Governed Stream and Narrative Memories concepts in terms of being able to answer questions like *'How did we get to this point?'* and *'Where can we credibly go from here?'*" — path-dependence as the second axis, with "credibly" carrying assurance weight.
- **Disposition:** Merged same date: CON-000 §3 (thesis + two-axis gloss) v1.3.0; DOC-001 §2.4 "Complex, not merely complicated" + §4 root-inequality preamble, v1.1.0; DOC-002 §3 Complicated/Complex entry with the **Complex ≠ Complicated** guard, v1.2.0; DOC-003 Narrative Memory row gains its defining question, v1.3.0. Vision-tier altitude above the distinction (Professional Scenario / Professional Capability hierarchy) remains held per the sponsor's prior scoping ruling and REG-Q-039/REG-E-005/E-012.
- **Merge target:** applied as listed. Closes **REG-E-001** — with which every Section E elicitation item is disposed: twenty deferred to safe defaults (REG-D-010), E-003 by sponsor voice (REG-D-015), E-001 by sponsor voice (this entry). **Status:** EFFECTIVE — MERGED.

### Hygiene passes — 2026-07-24 (ministerial, completing REG-D-014's Assure step)
Two mechanical passes applied after the Cycle-000 regression re-run, recorded here because in-place mechanical corrections require an application record (the defect class the regression itself surfaced twice): **(1) Regression hygiene pass** — DOC-004 §2.1 duplicate rung renumbered (repository → rung 6); DOC-003 §11 preamble corrected to reflect the Q-043/044 closures; this §1's status vocabulary completed (EFFECTIVE — MERGE PENDING); §1 edit provenance recorded inline; the split DOC-002 provenance sidecar consolidated into "JPWB-DOC-002. Canonical Vocabulary.provenance.md". **(2) Micro-hygiene pass** (after the confirmation re-sweep found one carryover and one reduced-severity recurrence): §1's dual status enumeration normalized into a single list with CLOSED defined; DOC-003 version line advanced to 1.1.1 enumerating its §11 correction; this record itself. No meaning created or changed by either pass; every semantic act traces to REG-D-014.

### Closure sweep — 2026-07-24 (ministerial, per REG-D-010; Cycle 000 item C000-A-01)
Every closure condition below fired on the recorded ratification act of 2026-07-24; this sweep records the resulting statuses without creating meaning: **REG-D-001..D-009 → MERGED** (their content is effective in the ratified artifacts); **REG-Q-001 → CLOSED** (ratification-status question resolved by REG-D-010 itself); **REG-F-003, REG-F-004 → MERGED** (their merge targets ratified). Entries with genuinely outstanding work retain their statuses (REG-F-001/F-002 OPEN; Section B/C open questions unaffected).

---

## 3. Section B — Open questions carried from the retired Guide §16 do-not-guess register

The Coding Agent Guide's §16 register (25 items) is the strongest prior inventory of unresolved boundaries. Every item still unresolved is carried forward here, restated against the six-artifact set and the repository. Safe defaults are self-contained: after retirement there is no Guide to consult. These are implementation boundaries, not an invitation to solve the architecture locally.

All Section B entries: **Date:** 2026-07-16 (carried from Guide §16) · **Type:** OPEN QUESTION · **Disposition:** — · **Status:** OPEN, unless stated otherwise.

### REG-Q-001 — Ratification status of the corpus
- **Statement:** Pre-canon sources claimed normativity at authoring time (transcripts called CPCO/JSDL/JEM/JSRP normative; the Guide was itself only proposed). Which text is actually authority was never conferred by an act.
- **Safe default:** Until the canon is ratified, treat the draft canon, the repository's generated contracts, and accepted repository ADRs as working authority. Draft and transcript language is rationale or candidate design; repeating it never ratifies it.
- **Disposition:** Designed closure: REG-D-002/D-005/D-006 and the rule of recognition replace document-level authority claims entirely.
- **Merge target:** JPWB-CON-000 Part B. **Status:** OPEN — closes automatically at the canon ratification act.

### REG-Q-002 — Public root, ownership, and PWA composition
- **Statement:** JanumiCode is a domain product containing multiple PWAs, with PWA-version-owned PWU Types and Undertaking-owned PWU Instances. The ontology permits one Undertaking under multiple compatible PWAs; current contracts serialize exactly one selected binding. Stray names (`JCPWA`, `Professional Endeavor`) exist in drafts. Multi-PWA compatibility, conflict precedence, ownership, migration, and projection rules are uncontracted.
- **Safe default:** Use JPWB-DOC-002 canonical names and one exact selected PWA/profile/version for the current slice. Do not add supplemental PWA bindings until composition rules are contracted. Never introduce a second root; never model JanumiCode as one PWA; isolate retired names in adapters.
- **Merge target:** JPWB-DOC-002 (names, ontology boundary); JPWB-DOC-003 (composition semantics when decided).

### REG-Q-003 — PWU lifecycle versus cognitive focus
- **Statement:** The semantic model defines four orthogonal PWU state axes; transcript-era candidates propose a different lifecycle and cognitive states.
- **Safe default:** Persist only the state axes ratified in JPWB-DOC-003 and the repository contracts. Candidate cognitive states are projection/focus metadata unless a Decision adds an orthogonal axis with migration. Never map states by similar labels.
- **Merge target:** JPWB-DOC-003.

### REG-Q-004 — Command/Event envelope and tenant placement
- **Statement:** The serialized envelopes omit tenant, organization, professional/PWA context, originating projection, and semantic-model version, although the platform requires scoped execution.
- **Safe default:** Serialize the repository's generated envelopes exactly. Enforce tenant/principal scoping through authenticated transport, repository, and RLS context. A public-envelope addition requires a new schema version and coordinated code/storage/test change; never create an unscoped path.
- **Merge target:** JPWB-DOC-003 (scoped-execution requirement); repository (shape).

### REG-Q-005 — Domain object versus wire object
- **Statement:** Domain-model and wire-contract shapes drifted historically (envelope fields, Intent requiredness, PWU boundary fields, decomposition/recomposition/current-Baseline references). Semantics the wire omits must live somewhere.
- **Safe default:** Use the repository's generated contracts at strict wire boundaries plus lifecycle-aware validation; preserve omitted semantics in accepted aggregates and relations. If a mapping is lossy, require a contract revision rather than storing competing shapes.
- **Merge target:** JPWB-DOC-003; repository.

### REG-Q-006 — Event vocabulary and granularity
- **Statement:** The first slice uses coarse events (`PwuStateChanged`, `AssuranceAssessmentCompleted`, `DecisionEffective`) without fully modeling separate approval time versus effective time; granular satisfaction/approval events were proposed but not contracted.
- **Safe default:** Emit only the repository's generated event registry at current boundaries. Never emit generic and granular events as independent facts. Extend the versioned registry and mappings before adding future-dated or separately effective Decisions.
- **Merge target:** JPWB-DOC-003; repository.

### REG-Q-007 — `ChangePwuState`
- **Statement:** A catch-all state-change Command was named without payload, authority, or guard contract.
- **Safe default:** Do not expose a public state setter. Use semantic Commands. Any internal helper enforces the closed transition/guard table and emits the correct semantic Event.
- **Merge target:** JPWB-DOC-003.

### REG-Q-008 — Identifier generation
- **Statement:** The prefix registry does not cover every proposed object; fixtures use intentionally readable ids.
- **Safe default:** Use the repository's registered prefix + ULID in production; fixture ids only in fixtures. Extend the registry, schemas, and tests together before adding an object prefix; never casually accept multiple generators.
- **Merge target:** Repository (registry); JPWB-DOC-003 (identity semantics).

### REG-Q-009 — PWA / PWU Type / Undertaking bootstrap
- **Statement:** The contracted surface begins with `CaptureIntent` against an existing Undertaking; create/publish/instantiate/migrate Commands have no frozen wire shape. The recursive composition requirement is settled; the wire shape is not.
- **Safe default:** Bootstrap only through an accepted seed/fixture or existing API behind an explicit adapter. Preserve roots, recursively reachable PWU Types, named child rules, explicit leaves, decomposition/recomposition contracts, assurance assignments, and instantiation expectations; never reduce a PWA to a flat node list. No generic CRUD into canonical tables. Keep published versions immutable and Undertakings pinned until governed migration exists.
- **Merge target:** JPWB-DOC-003; repository.

### REG-Q-010 — Assurance schema and profile activation
- **Statement:** Applicability expressions, required Evidence/waiver arrays, `riskProfiles`, and the mandatory-policy-by-profile matrix are not fully frozen.
- **Safe default:** Use the repository serialization without dropping assurance meaning from JPWB-DOC-003. Pin the slice to a versioned matrix of PWA conformance profile, independent PWU risk profile, applicable policies, criteria, and independence. A missing mapping blocks promotion.
- **Merge target:** JPWB-DOC-003.

### REG-Q-011 — Composing Assessments into PWU state
- **Statement:** Individual Assessment state, PWU assurance state, aggregate projection, and lifecycle satisfaction are distinct; no exhaustive composition covers multiple policies, waivers, and conflicting Validators.
- **Safe default:** Preserve all records and axes. Compose every applicable current-version policy using the strictest unresolved required result. A passing Assessment never advances assurance or lifecycle automatically; advancement requires a validated Command/Event.
- **Merge target:** JPWB-DOC-003.

### REG-Q-012 — Actor, role, authority, independence, and waiver proof
- **Statement:** Actor/Authority references drift; Decision payloads do not prove authority grants; role names drift across PWA and UX; the waiver instance/wire/storage contract is incomplete.
- **Safe default:** Never equate login, permission-system grant, role label, ownership, or capability with professional authority. Require scoped, time-valid proof; map role aliases explicitly; validate actual identities for independence. Never implement waiver as a Boolean — require a version-bound Decision with scope, expiry, rationale, controls, and the preserved finding.
- **Merge target:** JPWB-DOC-003.

### REG-Q-013 — Baseline meaning, owner, and VCS relation
- **Statement:** Whether a Baseline means approved-for-implementation or current-reference, its exact Undertaking/PWU ownership, and its relation to commits/branches/releases remain incomplete.
- **Safe default:** A Baseline is an immutable semantic manifest with explicit purpose, scope, subjects/versions, Evidence, and promotion Decision. Git never grants authority. If owner, subject, or authority cannot be resolved through accepted contract or trace, do not promote.
- **Merge target:** JPWB-DOC-003.

### REG-Q-014 — Baseline hashing and cross-aggregate promotion
- **Statement:** Hashing is optional in places with no complete canonicalization protocol for promotion effects that cross aggregate boundaries (for example a PWU entering `BASELINED`).
- **Safe default:** Use only the accepted hash contract; content-bearing Artifacts/Evidence do not omit a required hash merely because the field is optional. Coordinate promotion and PWU effects through a durable Process with intermediate state and reconciliation — never ad hoc multi-aggregate writes or projection-derived authority.
- **Merge target:** JPWB-DOC-003; repository.

### REG-Q-015 — CPCO entities and JSDL authority
- **Statement:** Candidate cognitive entities (Outcome, Question, Uncertainty, Representation, Confidence Assessment, …) are absent from the contracted discriminators; draft JSDL enums and lifecycles conflict with current contracts. JSDL-the-language must be distinguished from the compiler program: the compiler program's authoring slices (Janumi Constitution Discussion.md L13501-16500) contain no HUMAN ratification, but a probable-sponsor turn (L11370-11435, attribution probable, not certain) commissions JSDL by name — "the canonical language used to define: CPCO entities; relationships; commands; events; lifecycle states; invariants; projections; validators; authority rules; UI metadata," ruling "Everything else becomes a generated artifact" and "The semantic model is no longer documentation. It becomes the compiler input." Whether that turn is a sponsor commissioning ruling must be confirmed or disclaimed by the sponsor before the corpus is retired; after retirement the question becomes unfalsifiable.
- **Safe default:** Use CPCO as doctrine, projection, or declared extension only. Do not add canonical tables, discriminators, Commands, or JSDL-generated contracts until a Decision maps them losslessly and supplies migrations and conformance.
- **Merge target:** JPWB-DOC-001 (doctrinal standing); adoption, if ever, via a new REG-005 DECISION. Requires sponsor elicitation on the L11370-11435 attribution before corpus retirement.

### REG-Q-016 — Durable runtime and database trust topology
- **Statement:** The platform uses DBOS and separate control/execution trust domains; a transcript-era profile proposed custom PostgreSQL queues/workers; the exact ownership/credential/data split between the two PostgreSQL domains is not frozen.
- **Safe default:** Follow current code and accepted ADRs (DBOS) unless replaced by Decision. Preserve durability, atomicity, replay, and reconciliation semantics; do not build a parallel scheduler; keep semantic authority in the control plane; never split the aggregate/Event/outbox transaction.
- **Merge target:** Repository ADRs (topology); JPWB-DOC-004 (protocol pointer).

### REG-Q-017 — Projection freshness envelope
- **Statement:** Contracts expose limited generation/revision metadata; richer as-of, version-vector, completeness, staleness, filter, and authorization metadata are proposed but undecided.
- **Safe default:** Serve the exact generated schema or an accepted versioned wrapper. Revalidate every state-changing Command against authority and current revision. New metadata requires a contract Decision; a stale view never authorizes mutation.
- **Merge target:** JPWB-DOC-003; repository.

### REG-Q-018 — Legacy parity and cutover
- **Statement:** The legacy semantic inventory is not proof of actual behavior (prompts, retries, roles, writes, failures, side effects); migration is parked.
- **Safe default:** Inspect and instrument the implementation. Shadow with no Decisions and no side effects; classify divergence per the JPWB-DOC-004 divergence protocol; keep one semantic authority. Documentation or fixture parity alone never justifies cutover.
- **Merge target:** JPWB-DOC-004.

### REG-Q-019 — Authorized slice and roadmap
- **Statement:** Historical scope statements disagree (broad intent, large contracted surface, narrow recommended slice, dated status prose).
- **Safe default:** Verify the assigned scope against the tracker, repository, and ADRs. If work is authorized without expansion, use the narrow slice. Do not implement the eventual corpus or claim current completion from prose.
- **Merge target:** JPWB-DOC-004 (intake discipline).

### REG-Q-020 — Confidence, memory, and automated acceptance
- **Statement:** Numeric confidence aggregation, historical-memory admissibility, and automatic low-risk Assumption acceptance are deferred candidate ideas.
- **Safe default:** Use categorical dispositions with explicit basis, limitations, and residual uncertainty. Do not average professional truth. Dialogue and memory remain context until admitted as identified Evidence. No automatic acceptance without a versioned policy and valid authority.
- **Merge target:** JPWB-DOC-003; doctrine rationale in JPWB-DOC-001.

### REG-Q-021 — Governed professional stream representation
- **Statement:** Legacy design made one record table authoritative for all history and required private-reasoning capture; current architecture uses typed aggregates/Events/stores and forbids requiring private chain-of-thought. The stream is a logical concept, not a table.
- **Safe default:** Implement one logical, causally linked history across the current typed objects, Events, audit, Artifacts, and Evidence, queried through rebuildable projections. Preserve observable actions and rationale, and what an Assessment saw, under retention/redaction policy. Do not add a universal stream record, a competing Event authority, or a raw chain-of-thought store.
- **Merge target:** JPWB-DOC-003 (stream semantics). See also REG-Q-027 (retention rule).

### REG-Q-022 — Professional-wisdom compilation and IR
- **Statement:** The proposed Professional Wisdom Compiler/IR has no ratified ownership, schema, epistemic/authority status, PWA relation, conflict model, or activation/suspension/retirement lifecycle.
- **Safe default:** Keep source wisdom as provenance-bearing Artifacts/Evidence and trace current Assurance Policies back to it. Generate only candidate policy packages; do not create canonical wisdom tables/types or activate compiled controls without a versioned professional/governance Decision and conformance evidence.
- **Merge target:** JPWB-DOC-001 (candidate doctrine); adoption via a new REG-005 DECISION.

### REG-Q-023 — Mandatory assurance-floor representation and coverage topology
- **Statement:** The invariant is settled: every material professional transformation receives explicit coverage; every material AI/agent transformation requires Reasoning Review; every required control is durably bound, executed, recorded, inspectable, and enforced before its protected downstream transition. What is NOT frozen: material-boundary identity/classification, locked inherited policy assignment, producing-Attempt/context and protected-transition binding, conjunctive independence, deployment-capability and actual-invocation projections, and a generalized `AssurancePlan` for dimensional coverage, selection, cost, and gaps.
- **Safe default:** Never interpret the missing wire shape as permission to omit or hide the floor. Preserve the assignment / capability / Assessment / execution separation through accepted policies, Validators, objects, and Events only where lossless; otherwise keep the output provisional and block the protected transition. Evolve policy registry, schemas, persistence, projections, fixtures, and conformance tests together before claiming support. Do not invent a parallel planner, a legacy review record, a prose-only critic, a Boolean/badge, or a hidden runtime default. Optional optimization may add controls; it can never weaken mandatory policy, Evidence, independence, or impact closure.
- **Merge target:** JPWB-DOC-003 (floor semantics); repository (representation).

### REG-Q-024 — Finding, repair, revalidation, and convergence contracts
- **Statement:** Exact subject-version binding, stable recurrence identity, repair representation, impact rules, resolution authority, and convergence composition remain incomplete; legacy finding/repair schemas do not match current objects and boundaries. Three sponsor-adopted semantics from the legacy validator design (Validator Subsystem L1868, L1914-1922, L1932-1934, L1974-1978) are carried as adopted direction, not fresh design: every nontrivial repair is traceable (triggering finding, repair strategy, before/after artifact identity, diff scope, revalidation set — called "essential"); any repair touching identifiers, parent-child relationships, references, trace links, or entity semantics reruns the full entity-integrity family (motivated by sponsor-observed small-model identifier drift); revalidation sets are selected by the repair's diff surface intersecting each control's inspection surface.
- **Safe default:** Adapt outputs into existing Observations and Assessments; preserve finding-type Observations against exact versions; represent repair through governed PWUs, Actions, Attempts, and existing trace relations only where lossless — otherwise stop for a contract Decision. Repairs carry the traceability set above; identity-touching repairs always trigger full identity-family revalidation; targeted revalidation follows diff-surface/inspection-surface intersection. Treat convergence as a non-authoritative conceptual property until contracted. Do not import legacy records or enums, and do not create a parallel controller.
- **Merge target:** JPWB-DOC-003.

### REG-Q-025 — Meta-assurance and learning authority
- **Statement:** Validator-system subjects, canary isolation, health/suspension Commands, precision/recall adjudication, shared-premise independence, and promotion of outcome-derived wisdom are undefined. One constraint is sponsor-adopted and carried (Validator Subsystem L2019): meta-assurance validators observe, emit telemetry and review flags, and escalate; they never hard-block human governance decisions — "a system that blocks its human overseer for reviewing too fast inverts the authority hierarchy." Human authority is never subordinated to meta-validator telemetry.
- **Safe default:** Run held-out canaries and control-health analysis in an isolated, observe-first harness; record results as candidate engineering Evidence — not canonical Assurance Observations — until the subject/lifecycle contract is ratified; escalate material failure. Meta-assurance findings never hard-block a human governance act. Never auto-reject unrelated subjects or self-modify authoritative policies; activation, suspension, and evolution require explicit versioned governance.
- **Merge target:** JPWB-DOC-001 (doctrine); JPWB-DOC-003 (contracts when decided — on ratification, §8 needs a scope line exempting human governance acts from meta-assurance blocking under ASR-10/ASR-15).

---

## 4. Section C — Open questions from corpus extraction (unresolved by any artifact)

Contradictions and gaps surfaced during the 2026-07-16 extraction sweep that no draft artifact resolves. Sources cited by file and line for the historical record; after retirement the statement here is the carrier.

All Section C entries: **Date:** 2026-07-16 · **Type:** OPEN QUESTION · **Disposition:** — · **Status:** OPEN, unless stated otherwise.

### REG-Q-026 — M0 Ratify Sheet §C items and the standing of build-agent ratification
- **Statement:** The M0 sheet is "RATIFIED (by the build agent, best judgment) 2026-07-10" — ratified by the party whose work it gates — with eleven best-judgment items still pending sponsor confirmation. Because the sheet retires with the corpus, each is carried self-contained: **C-1** `pwuKind` is a validated string, not a global enum — the Product Realization PWA ontology defines PWU kinds as versioned data. **C-2** `artifactType` likewise: validated string, ontology-defined. **C-3** RecompositionContract `conflictType`/`action` are free-form strings (domain-instance data, not a system enum) unless the sponsor defines a registry. **C-4** legacy ControlAction `WAIVE` normalizes to `REQUEST_WAIVER` on ingest; WAIVE is never persisted as a distinct action. **C-5** `AssurancePolicyDefinition.riskProfiles` is retained as optional (needed for risk-proportional gating; its omission from the serialized contract looked unintended — confirm). **C-6** the error-code→category map was authored, not sourced; it lives in the repository (`src/errors.ts#ERROR_CODE_CATEGORY`) — confirm against it; this is the item most needing a sponsor sanity check. **C-7** two aggregate-disposition enums are kept distinct (read-model view vs composition rule) — confirm whether they should converge. **C-8** id prefixes `obl/art/dcp/rcp` were ratified from the fixture for four uncovered union types — confirm tokens. **C-9** the PolicyExpression grammar is unified with the ApplicabilityExpression op set (one DSL). **C-10** `intentStatus` is the canonical typed field; `lifecycleStatus` is the generic envelope mirror. **C-11** the fixture's recommended vocabulary is noise — a display artifact, no schema enum. Whether build-agent self-ratification constitutes ratification in the constitutional sense is itself open; under the rule of recognition, status is conferred, not authored. Also on the face of the sheet: the header counts 16 error codes while §B ratifies 15 and rules `VALIDATOR_FAILED` is an assessment state, not an error code.
- **Safe default:** The eleven §C resolutions stand as presumptive implementation decisions; C-6 (the authored error-code→category mapping) is the one most needing a sponsor sanity check. The repository's vocabulary registry and fidelity tests govern the counts; `VALIDATOR_FAILED` is not an error code.
- **Merge target:** Sponsor confirmation recorded here; substance merges to JPWB-DOC-002 (vocabulary items) and the repository (shapes); ratification doctrine to JPWB-CON-000 Part B.

### REG-Q-027 — One canonical chain-of-thought retention rule · **MERGED (REG-D-015, 2026-07-24): the sponsor's restatement arrived and is carried by DOC-003 PER-12 v1.2.0**
- **Statement:** Sources conflict: transcript-era JEM says the runtime SHALL not require storage of private model chain-of-thought (Janumi Constitution Discussion.md L17594); the record-everything provenance posture and a sponsor conversational ruling (retain-but-never-forward, with an origin axis) imply retention. That ruling was never registered and was lost — the motivating case for this register's closure rule. Guide §9.7 (L1338) drafted a positive retention rule that is the strongest existing synthesis and anchors the elicitation: volunteered reasoning material is redacted at the boundary, retained as a typed Artifact of its producing Attempt under retention/security/access policy, never admitted as Evidence, never supplies another agent's context, never reaches a log or shared projection, never supports a finding; its presence in an evaluator's context is a hidden-context independence violation; it participates in no execution, assurance, governance, Baseline, or traceability, and is purgeable at retention expiry.
- **Safe default:** Never require private chain-of-thought capture; never forward retained model reasoning to dependent consumption or downstream prompts; preserve observable actions and stated rationale under retention/redaction policy. Pending the sponsor's restatement, the Guide §9.7 mechanics above bind as the interim rule: retain-as-typed-Artifact-of-Attempt, boundary redaction, evaluator-context independence violation, retention-expiry purgeability. Prohibitions on consuming model reasoning do not prohibit enabling it (the §9.7 lesson, JPWB-DOC-004).
- **Merge target:** JPWB-DOC-003 (stream/evidence semantics) + JPWB-DOC-004 (conduct). **Requires sponsor elicitation:** the exact retain-but-never-forward ruling must be restated by the sponsor before merge.

### REG-Q-028 — Recomposition lifecycle states: child-side or parent-side
- **Statement:** RPH-DOC-002 puts "begin recomposition" on the SATISFIED child PWU (L623-624) while recomposition contracts belong to the parent with `requiredChildWorkUnitIds` (L921-952). Which PWU carries RECOMPOSING/RECOMPOSED is unstated; state-machine implementations must not invent it.
- **Safe default:** Follow the repository's contracted transition table; where it is silent, treat recomposition as parent-owned (the contract holder) and file a finding before persisting any child-side recomposition state.
- **Merge target:** JPWB-DOC-003.

### REG-Q-029 — Waiver versus epistemically invalidated evidence
- **Statement:** RPH-DOC-002 permits assurance to become WAIVED in an invalidated-evidence scenario (L2316) while its required property forces claims resting on invalidated evidence into contested/under-review/invalidated (L2132). Whether a waiver may bridge an invalidated-evidence gap, or only open observations, is unresolved.
- **Safe default:** A waiver never repairs epistemic invalidation of the evidence a claim rests on; it may only waive an open observation, with the finding preserved (REG-Q-012 waiver discipline).
- **Merge target:** JPWB-DOC-003.

### REG-Q-030 — The recording path for an authoritative WAIVED disposition
- **Statement:** WAIVED is a defined disposition meaning (RPH-DOC-004 L536-538) but absent from the validator's recommendation enum (L240-245) and from disposition rules (L548-553); the M0 sheet confirms WAIVED is excluded from recommendations. The mechanism that records an authoritative WAIVED disposition — implied to be the waiver contract — is unspecified.
- **Safe default:** Validators never recommend WAIVED. WAIVED enters only through the waiver flow: a version-bound waiver Decision producing the disposition, with the finding preserved.
- **Merge target:** JPWB-DOC-003.

### REG-Q-031 — Default disposition for a MATERIAL open finding is nondeterministic
- **Statement:** The default precedence rule permits three dispositions for a material open finding — CONDITIONALLY_SATISFIED, INCONCLUSIVE, or REJECTED (RPH-DOC-004 L574-575) — with no tiebreaker, exactly where judgment varies most.
- **Safe default:** Absent a policy-specific rule, resolve to the strictest of the permitted set (REJECTED) rather than the most permissive; a policy that intends otherwise must say so explicitly.
- **Merge target:** JPWB-DOC-003.

### REG-Q-032 — Intent-approval granularity
- **Statement:** Should the professional approve one complete intent baseline, individual outcomes and constraints, or both? (RPH-DOC-005 L1687-1693, Decision 1, never closed.)
- **Safe default:** Approve the baseline as a whole while allowing explicit objection to individual elements.
- **Merge target:** JPWB-DOC-001 (CONOP) + JPWB-DOC-003 (Decision semantics).

### REG-Q-033 — Which configurations satisfy independence
- **Statement:** Independence is invariant, but the satisfying configurations are undefined: which role combinations satisfy validator-implementation independence (RPH-DOC-003 L2399); whether the assumption-disclosure implementation must use a different model from generation (RPH-DOC-005 L1709-1711).
- **Safe default:** Require a different invocation at minimum; require a different agent or model for high-risk work; validate actual identities, not role labels (REG-Q-012).
- **Merge target:** JPWB-DOC-003 (independence model).

### REG-Q-034 — PWU lifecycle re-entry after reshaping or challenge
- **Statement:** The mainline lifecycle is drawn as a single happy path while control actions define reshaping/replanning loops; where RESHAPING or CHALLENGED re-enters the lifecycle is unspecified (RPH-DOC-001 L1112-1148 vs L1294-1471). Implementations must not invent re-entry semantics.
- **Safe default:** Persist only transitions in the repository's contracted transition table; a needed-but-missing return edge blocks the transition and files a finding rather than improvising.
- **Merge target:** JPWB-DOC-003.

### REG-Q-035 — Vertical-slice versus discipline-shaped decomposition
- **Statement:** Decomposition doctrine forbids layer-sliced PWUs ("Create API files") yet canonizes `api_implementation`/`ui_implementation`/`database_change` PWU types, and the reference root tree is discipline/phase-shaped while the preferred decomposition is vertical intent→observable-behavior slices (Janumi Constitution Discussion.md L22670-L22676 vs L22834-L22841; L22780-L22792 vs L22821-L22830). When each shape applies is implicit.
- **Safe default:** Decompose along independently meaningful professional boundaries; use horizontal/discipline-shaped PWUs only where the PWA's ontology explicitly defines them as meaningful units, never as a convenience slicing of one behavior.
- **Merge target:** JPWB-DOC-001 (decomposition doctrine).

### REG-Q-036 — "Aggregate": semantic unit versus transactional boundary
- **Statement:** "The PWU is the smallest Janumi aggregate" (Janumi Constitution Discussion.md L6137) coexists with the refinement that implementation splits it into several transactional boundaries (L6249). One word is doing two jobs.
- **Safe default:** Use "aggregate" only for the transactional consistency boundary; refer to the PWU as the semantic unit of professional work; do not infer transaction scope from semantic unity.
- **Merge target:** JPWB-DOC-002.

### REG-Q-037 — Product-hierarchy rendering: siblings or layers
- **Statement:** RPH-DOC-000's tree renders JPWB and JanumiCode as sibling children of the Janumi Platform (L84-94) while its prose says JanumiCode is built on Platform + JPWB + RPH (L886-890). One rendering must win.
- **Safe default:** The layered/prose reading governs: JanumiCode is a domain product built on JPWB; sibling placement in diagrams is display only.
- **Merge target:** JPWB-DOC-002 (product ontology).

### REG-Q-038 — Survivorship of Executive-Overview-only platform claims
- **Statement:** The Executive Overview was demoted to an orientation aid, yet it was the sole in-corpus source for several platform claims (README.md L50 vs Executive Overview L13-25). Part of that content is now carried: JPWB-DOC-001 §8 carries the two-plane control/execution separation, surfaces-as-clients-never-editions, and edition-tiering doctrine as canon HYPOTHESIS, and JPWB-CON-000 V5 carries "the de minimis assurance floor is never a paid tier." The open question is the uncarried remainder only: the three-edition ladder specifics, the REL-1..4 roadmap, the SOC2/RMF/GDPR compliance posture and hash-chained audit claim, and the READ/PROPOSE/GOVERN tier naming.
- **Safe default:** DOC-001 §8 and CON-000 V5 govern what they carry. For the remainder: treat plane/trust topology detail as repository/ADR territory (REG-Q-016) and edition specifics, roadmap, and compliance posture as non-canonical product planning; carry nothing further into the canon absent a sponsor decision.
- **Merge target:** JPWB-DOC-001 (if further adopted as doctrine) or repository ADRs; decision recorded here.

### REG-Q-039 — Altitude of the vision's top-level object
- **Statement:** Vision material revises its own top-level concept repeatedly — PWA, then Professional Scenario, then Professional Capability, then Civilizational Knowledge (Additional Concepts, Complex Systems discussion L682-L1240) — none marked final, though the sponsor endorsed the discussion wholesale. Narrative Memories likewise carry two distinct definitions.
- **Safe default:** The PWA remains the top governed object in the semantic model; scenario/capability framings are vision-layer candidates that create no objects, tables, or vocabulary.
- **Merge target:** JPWB-CON-000 (vision altitude). Requires sponsor elicitation.

### REG-Q-040 — Long-horizon vision versus non-foreclosure
- **Statement:** Vision material simultaneously forbids candidate concepts from influencing implementation before deliberate design, and tasks near-term architecture with not foreclosing long-term stewardship (Capability Vision L18 vs L1154). Architecture cannot both ignore the concepts and be shaped by them; no resolution mechanism is given.
- **Safe default:** Candidate concepts influence implementation only negatively — as reversibility pressure (avoid decisions that provably foreclose them) — never positively as requirements.
- **Merge target:** JPWB-DOC-001.

### REG-Q-041 — Engineering-quality exception scope and out-of-repo procedure
- **Statement:** The Engineering Constitution's quality section points to a sibling-repo guide for SonarQube procedure (Engineering Constitution.md L1186) and simultaneously mandates addressing complexity findings "fully" (L1188) while its checklist permits "documented exceptions" (L1220); the exception scope is unadjudicated and the procedure is not self-contained.
- **Safe default:** Address findings fully; an exception requires a recorded justification in the change itself; procedure follows the repository's own tooling configuration, not an out-of-repo document.
- **Merge target:** JPWB-DOC-004 (engineering practice).

### REG-Q-042 — INTAKE PWU Type naming drift
- **Statement:** The migration doc names "Product Scope PWU / User Journey Discovery PWU / Domain Entity Discovery PWU" in one section and "Product Boundary PWU Type / User Journey Definition PWU Type / Domain Entity Definition PWU Type" in another (RPH-DOC-001 L860-864 vs L1064-1067) — same concepts, drifted names.
- **Safe default:** The repository's seeded PWA ontology (the published PWU Type registry) governs; prose names are display candidates until JPWB-DOC-002 fixes them.
- **Merge target:** JPWB-DOC-002.

### REG-Q-043 — Unknown enum value from a projection re-entering a canonical write · **CLOSED (REG-D-014, 2026-07-24): resolved in-artifact by DOC-003 §11 item 6's safe default (never); the register empties into artifacts — Cycle-000 S-11 direction (i)**
- **Statement:** Whether an unknown enum value read from a projection may re-enter a canonical write is unresolved (carried from JPWB-DOC-003 §11 item 6, which files it here).
- **Safe default:** Never — write-side strictness wins.
- **Merge target:** JPWB-DOC-003.

### REG-Q-044 — Reserved vocabulary for "authoritative": current state versus event history · **CLOSED (REG-D-014, 2026-07-24): resolved in-artifact by DOC-003 §11 item 7's adopted wording; the register empties into artifacts — Cycle-000 S-11 direction (i)**
- **Statement:** One word is doing two jobs: current-state tables and the event history are both called "authoritative" (carried from JPWB-DOC-003 §11 item 7, which files it here). Whether the two-word convention becomes canonical vocabulary is unresolved.
- **Safe default:** Current tables are *authoritative now*; events are the *authoritative account of becoming* (the DOC-003 convention).
- **Merge target:** JPWB-DOC-002.

### REG-Q-045 — Survivorship of the Product Realization PWA's professional content
- **Statement:** RPH-DOC-003 and RPH-DOC-004 carry professional ontology content that appears in none of the six artifacts: the seven-branch PWU Type hierarchy (RPH-DOC-003 L371-380), three conformance profiles with five selection criteria (L129-195), the Intent Discovery six-class epistemic taxonomy (L535-542) and six named validator-hunted failure modes (L548-555), the eight minimum scenario classes (L633-644), and RPH-DOC-004's twelve mandatory core policies with per-policy semantics (e.g. POL-ASSUMPTION-DISCLOSURE "SATISFIED means disclosed, not verified" L952; POL-FITNESS-FOR-PURPOSE always includes a human product decision L1455-1459; POL-HISTORICAL-CONSISTENCY "precedent binds through explanation" L1286-1288). DOC-002 §9.2 cedes only ontology *vocabulary*; REG-Q-010 preserves only the abstract profile/policy-matrix requirement. This content is intended to be ceded to the repository's seeded, versioned Product Realization PWA — but REG-F-001 records that the seeded governed layer was hollow, so carriage by the seed cannot be assumed.
- **Safe default:** Retirement of RPH-DOC-003 and RPH-DOC-004 is blocked until a verification passes that the repository's seeded Product Realization PWA carries their type hierarchy, policy catalog with per-policy semantics, profiles, and taxonomies losslessly; until then those two documents remain the reference for that content (as historical evidence with an explicit survivorship hold).
- **Merge target:** Repository (seeded PWA, with verification evidence); cession recorded here as a DECISION when verified.

### REG-Q-046 — Standing of the Shape Engineering methodology content
- **Statement:** The Shape Engineering methodology (Janumi Constitution Discussion.md L25300-27500: the 15-phase method, PWU boundary/sizing tests, the adversarial-review protocol and its 16 gating questions, the 10-scenario validation set, conformance criteria, anti-pattern catalog, maturity ladder) is candidate doctrine, unratified — the very method JPWB-CON-000 §1 commits to proving, yet carried nowhere beyond the discipline name and one question in JPWB-DOC-001 §5.2.
- **Safe default:** Treat the Shape Engineering Handbook content as historical evidence only; adopt any portion into JPWB-DOC-001 via a Decision; PWA-authoring work beyond the existing seeded ontology stops for that Decision.
- **Merge target:** JPWB-DOC-001 (if adopted as doctrine); adoption via a new REG-005 DECISION.

### REG-Q-047 — Standing of the transcript-era UI screen contracts and acceptance journeys
- **Statement:** The RIWS/JCUX screen-contract corpus (screens 1-67, cross-cutting UI contracts, five Critical Acceptance Journeys with per-screen semantic acceptance criteria; Janumi Constitution Discussion.md L27700-30230) is neither carried, ceded, nor demoted with a record. JPWB-DOC-001 §7 carries the doctrine (contexts, grammar, orientation questions, prohibitions); the screen-contract layer's standing is undecided.
- **Safe default:** The screen contracts and acceptance journeys are non-canonical design material — historical evidence for repository design docs; any adoption as conformance criteria requires a Decision.
- **Merge target:** Repository design docs; adoption, if ever, via a new REG-005 DECISION.

### REG-Q-048 — Cross-organization coordination scope
- **Statement:** The Construction discussion surfaces multi-organization undertakings (owner, general contractor, subcontractors, inspectors) as intrinsic to some professions, and the sponsor acknowledged the gap (Construction discussion L253); the canon currently scopes coordination, authority, and tenancy within one organization, and no artifact carries a cross-organization coordination model.
- **Safe default:** The canon stays silent — single-organization scope holds; agents do not invent cross-organization semantics (federation, shared undertakings, split authority). Cross-organization coordination is vision-tier material (see REG-Q-040's non-foreclosure discipline).
- **Merge target:** JPWB-DOC-001 (doctrine), if and when adopted via a DECISION.

### REG-Q-049 — Security and supply-chain gate family (production-facing, deferred)
- **Date:** 2026-07-24 (filed by REG-D-012)
- **Statement:** SAST, dependency/vulnerability scanning, secret scanning, license policy, SBOM generation, build provenance/attestations, reproducible builds, and adversarial/abuse-case testing beyond the current security invariants are recognized gate families (Gauntlet Constraints Discussion §7) with no current assurance-policy representation.
- **Safe default:** Not yet applicable — JPWB is pre-production. Becomes mandatory at the first production-facing slice; adoption is by assurance-policy authoring under the REG-D-012 pattern (policy-shaped reference artifacts at authoritative boundaries), never by ad-hoc CI accretion.
- **Merge target:** The assurance catalog + PLN-006 (a production-readiness milestone gate).

### REG-Q-050 — Operational and nonfunctional gate family (production-facing, deferred)
- **Date:** 2026-07-24 (filed by REG-D-012)
- **Statement:** Latency/throughput budgets, load/stress/soak, fault injection and resilience verification, retry/timeout/circuit-breaker/idempotency verification under load, backup-restore and DR/rollback rehearsal, accessibility conformance, telemetry-as-acceptance, and SLO/error-budget checks are recognized gate families (Gauntlet Constraints Discussion §8) with no current assurance-policy representation.
- **Safe default:** Same pattern as REG-Q-049: not yet applicable; mandatory at the first production-facing slice; adopted as assurance policies. Observability-as-testable-requirement is already DOC-004 §7.4 practice and is not deferred.
- **Merge target:** The assurance catalog + PLN-006.

---

## 5. Section D — Divergence findings (founding record)

Recorded at founding as session-known ground truth; the canon must not contradict these. Classes per the JPWB-DOC-004 divergence protocol where the finding is a code/canon divergence.

### REG-F-001 — The governed-objects layer was partly a projection of code
- **Date:** 2026-07-16 (facts established over prior audit/wiring sessions) · **Type:** DIVERGENCE FINDING · **Class:** SEMANTIC_CONFLICT (asserted status without performed status)
- **Statement:** Seeded policy objects existed that the runtime never read; the authoring floor was hardcoded rather than policy-driven; ~74% of the governance kernel was dead in production before the wiring program. Docs described a governing layer the code did not perform — the motivating evidence for the anti-vacuity clause.
- **Disposition:** Escalated and partially remediated (wiring program: call sites routed through the kernel; floor increments landed). Residual conformance is tracked in the repository.
- **Merge target:** JPWB-CON-000 Part B (anti-vacuity clause); remaining gaps close as repository conformance work. **Status:** OPEN (remediation in progress).

### REG-F-002 — Vocabulary `sourceSection` provenance theater
- **Date:** 2026-07-16 (audit finding) · **Type:** DIVERGENCE FINDING · **Class:** SEMANTIC_CONFLICT (anti-vacuity)
- **Statement:** The vocabulary registry's `sourceSection` fields were unperformed provenance for the large majority of field-bearing entries — a claimed status no relation performed.
- **Disposition:** Evidence for the anti-vacuity clause; field-level repair is repository work.
- **Merge target:** JPWB-CON-000 Part B (anti-vacuity); repository (registry repair). **Status:** OPEN.

### REG-F-003 — Optimistic concurrency is real
- **Date:** 2026-07-16 (verified) · **Type:** DIVERGENCE FINDING · **Class:** EQUIVALENT (docs and code agree)
- **Statement:** The engine honors client `expectedRevision`; stale commands are rejected, never last-write-wins. Recorded as a positive verification: the semantic requirement is performed.
- **Disposition:** Verified; no action.
- **Merge target:** JPWB-DOC-003 carries the semantic requirement; the repository carries the shape. **Status:** DECIDED — MERGE PENDING (closes on DOC-003 ratification).

### REG-F-004 — The §9.7 over-application incident
- **Date:** 2026-07-16 (incident predates; two independent agents) · **Type:** DIVERGENCE FINDING · **Class:** none — not a code/canon divergence; recorded as a normative-drafting defect (P6, rule without edges), outside the JPWB-DOC-004 taxonomy by design
- **Statement:** Two independent agents over-applied the Guide's prohibition on soliciting chain-of-thought into disabling model reasoning entirely — compliance by elimination. The defect was in the rule's missing edge, not only in the readers.
- **Disposition:** Adjudicated: consumption ≠ generation. Carried as the worked over-application example in JPWB-DOC-004 and as drafting standard (every prohibition that could be over-applied gets a non-example).
- **Merge target:** JPWB-DOC-004. **Status:** DECIDED — MERGE PENDING (closes when DOC-004 is ratified).

### REG-F-005 — The AssessmentCriterion impoverishment
- **Date:** 2026-07-16 (found by a coding agent working against the pre-canon corpus) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER (with a B7 anti-vacuity component)
- **Statement:** The ratified criterion shape is `{id, name, description, criterionType, evaluationMethod, requiredEvidenceIds, severityIfNotMet, mayBeNotApplicable}` (RPH-DOC-004); the implementation writes `{id, statement, mandatory}` — no overlap beyond `id`, with the five-level `severityIfNotMet` collapsed into a boolean. A placeholder type permitted the divergence silently. Detection depended on the source document's field-level schema existing as an independent reference — the motivating evidence for REG-D-008: had the source schemas been retired without a verified transplant into enforced repository reference artifacts, this class of gap would have become undetectable and the implementation self-certifying.
- **Disposition:** Fix code toward canon (DOCS_STRONGER): the criterion shape needs a real type and conformance fixture derived from the ratified schema; the boolean cannot express the graded severity that disposition precedence requires (JPWB-DOC-003 §8). The placeholder type is a B7 violation in its own right. Remediation is repository work, sequenced within the convergence phase; the parked AssessmentCriterion WIP and its migration rule are the starting point.
- **Merge target:** Repository (type + conformance fixture); REG-D-008 carries the systemic rule. **Status:** OPEN (remediation pending).

### REG-F-006 — `ReviseDecomposition` performs none of DOC-003's revision obligations
- **Date:** 2026-07-28 (found while planning JPWB-SPEC-001-DR-002 W-3; restated 2026-07-29 after adversarial verification) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER, with a CON-000 B7 anti-vacuity component — the same shape as REG-F-005, and filed adjacently so the two are not disposed inconsistently.
- **Statement:** JPWB-DOC-003 (OPERATIVE, REG-D-010) binds decomposition **revision** three times: DEC-2 — *"Revising a decomposition is legal, changes the parent's semantic version, and triggers impact analysis"*; DEC-3 SCOPE — *"governs every decomposition, revision, and delegation"*, rule *"No mandatory obligation silently disappears"*; DEC-4 SCOPE — *"governs decomposition, delegation, semantic revision, and context assembly."* `reviseDecomposition` (`packages/rph-application/src/handlers/decomposition.ts`) advanced `status` to SUPERSEDED and bumped `semanticVersion` — one of DEC-2's three requirements — while its command schema declared `childWorkUnitIds`, `obligationAllocations` and `constraintPropagations`, which are precisely the DEC-3 and DEC-4 carriers. Runtime-verified: a revise carrying all four returned ACCEPTED with the aggregate untouched. Two aggravating facts: the emitted `DecompositionRevised` failed its own `strictObject` four ways, omitting `supersedesDecompositionContractId`, `semanticVersion` and `status` — the only facts it exists to record; and it escaped that schema solely because its vocabulary entry was annotated `UNRATIFIED-AUTHORED`, which `gen-messages` skips, so the engine's own event gate never ran for it. Compare REG-F-002 (vocabulary `sourceSection` provenance theater).
- **Disposition (CONFERRED 2026-07-29):** **Fail closed now; implement on ratification.** The B7 component is **DISCHARGED** at commit `50785b5b`: the command now REFUSES a revision carrying any field it cannot honour, naming the DOC-003 rule each carries, and the emitted event conforms to `DecompositionRevisedPayloadSchema`. Neither required a ratification decision — refusing to do what a handler does not do asserts nothing, and an event matching the shape it already declares claims nothing new. The **DOCS_STRONGER component remains OPEN**: DEC-2's impact analysis, DEC-3's obligation conservation and DEC-4's constraint disposition are unimplemented for revision, and that is a decomposition-model increment. Remediation is mechanically available and has direct precedent — `checkTransition` constrains `status` only, and `advanceStatus`'s `mutate` hook is used at eleven sites including `supersedeAssurancePolicy`, which writes a payload-derived field while advancing to SUPERSEDED.
- **A defence considered and rejected**, recorded because the reading is natural and was in fact reached once during the programme: the vocabulary note *"DOC-002-only; new contract = DRAFT"* appears to license the handler as "supersede, then propose a successor". It does not — it is disclaimed by its own paired entry, `kit.ts` states that vocabulary's `drivesFrom` *"has no ratified authority"*, DOC-002 carries no DecompositionContract transition matrix, and the only ratified sentence on the subject describes an **in-place** revision. Adopting it would have downgraded a B7 finding by citing an unratified source as ratified.
- **Residual, offered as a candidate SPEC-001 gap:** an accepted-but-unapplied command is disclosed by nothing. SPEC-001 INV-08 obliges disclosure only on a **refused** command and INV-14 only on an **interrupted** sequence. The refusal above removes the instance; the class remains unaddressed.
- **Event payload RATIFIED by the same conferral (2026-07-29).** The `DecompositionRevised` shape — `supersedesDecompositionContractId`, `rationale`, `semanticVersion`, `status` — is the minimum record of what DOC-002 §13.2 already ratifies, and its vocabulary provenance now says so. The consequence is enforcement, not documentation: the event enters `RATIFIED_EVENT_PAYLOADS`, the engine's (d2) gate runs, and a non-conforming emission is refused at dispatch with `VALIDATION_FAILED` instead of being committed and noticed only by a test. Verified by mutation. *Trap recorded for later editors: `sourceSection` is both prose and a machine predicate — `gen-messages` substring-matches it — so naming the not-yet-ratified marker inside the replacement text silently re-applies it, leaving an entry that reads as ratified and is not enforced. This occurred once during the conferral and was caught by simulating the generator's filter before trusting its output.*
- **Merge target:** Repository (handler + `decomposition-revise-conformance.test.ts` + the vocabulary provenance, all landed); JPWB-DOC-003 DEC-2/3/4 carry the semantic requirement unchanged. **Status:** OPEN — B7 component discharged and the event payload now engine-enforced; DOCS_STRONGER remediation pending the decomposition-model increment.

---

## 6. Section E — Elicitation items

Filed by the finalizer from every `[ELICITATION: …]` marker in the drafts and every ELICITATION-REQUIRED item in the six provenance sidecars. Each entry is an OPEN QUESTION directed to the sponsor, with the drafting agent's strongest candidate answer as its safe default. The register — not the sidecars — is the carrier: an elicitation item not filed here does not survive ratification. Sponsor dispositions are collected on the Ratify Sheet; each disposition closes here by merge.

**JPWB-CON-000:**
- **REG-E-001** — Exact wording of the Part A §3 thesis sentence: a candidate articulation assembled from assistant turns the sponsor engaged with but never ratified verbatim. *Default: the drafted sentence stands.*
- **REG-E-002** — Whether the civilizational/intergenerational capability-stewardship framing is carried at Part A §1 strength or referenced as direction only. *Default: carried as direction, at the drafted strength.*
- **REG-E-022** — Whether "Governance is the product, not a feature" (Part A §3) is endorsed at constitutional strength; it is carried from the Executive Overview, which the README demotes to an orientation aid. *Default: endorsed as drafted.*

**Cross-cutting rulings:**
- **REG-E-003** — Exact sponsor restatement of the chain-of-thought retain-but-never-forward ruling (origin axis). Feeds REG-Q-027. *Default: JPWB-DOC-003 PER-12's mechanics govern.*
- **REG-E-004** — Confirmation of the M0 Ratify Sheet §C best-judgment items C-1..C-11 (C-6 foremost), and whether build-agent self-ratification counts as conferral or requires countersigning. Feeds REG-Q-026. *Default: they stand as proposals pending countersign.*
- **REG-E-005** — Altitude of the top-level vision object (PWA vs Professional Scenario vs Professional Capability vs Civilizational Knowledge). Feeds REG-Q-039. *Default: the PWA remains the top governed object; vision-tier terms held.*
- **REG-E-006** — Disposition of Executive-Overview-only platform claims (two-plane architecture, editions, trust tiers, stack). Feeds REG-Q-038. *Default: cede to repository ADRs.*

**JPWB-DOC-001:**
- **REG-E-007** — The JSDL-pivot transcript turn (Constitution Discussion L11370–11435) is probable-HUMAN but unattributed; confirm authorship and standing. *Default: recorded as probable-sponsor, unratified; JSDL remains demoted.*
- **REG-E-008** — Is §8 sufficient as the CONEMP at this layer, or is a fuller employment concept (staffing, adoption sequencing, federation) wanted? *Default: §8 suffices; fuller CONEMP is future work.*
- **REG-E-009** — Confirm the projection taxonomy stays HYPOTHESIS outside DOC-001 (only the cognitive loop and five contexts carried as doctrine). *Default: confirmed.*
- **REG-E-010** — The §7.5 interaction grammar fuses the Guide's eight verbs with the discussion's twelve (nine primary + seven supporting marked HYPOTHESIS); the fusion is NEW. *Default: fusion stands with supporting verbs at HYPOTHESIS.*

**JPWB-DOC-002:**
- **REG-E-011** — Ratify or retire `Professional Endeavor` as a generic semantic supertype/alias. *Default: candidate-only; Undertaking canonical at product/UX boundaries.*
- **REG-E-012** — Admit or hold vision-tier candidate terms (Professional Scenario, Professional System, Professional Capability, Civilizational Capability). *Default: hold.*
- **REG-E-013** — Admit or hold the remaining Fusion-essay engineering terms (safe/acceptable operating envelope, trajectory) — the six discipline names are already admitted. *Default: hold.*
- **REG-E-014** — Confirm PRESUMPTIVE settledness of Guide-era terms absent from the Charter (Assurance Engineering, Reasoning Review, Professional rationale summary, Private chain-of-thought, Material professional transformation, Finding Definition / Assurance Observation, PWA Work Architecture View, child PWU Type/Instance). *Default: PRESUMPTIVE stands.*
- **REG-E-015** — Confirm the layered (built-on-JPWB) reading of JanumiCode; the Charter's sibling-rendered product tree is read as a commercial catalog view. *Default: layered reading stands.*

**JPWB-DOC-003:**
- **REG-E-016** — The de minimis assurance floor and material-by-default rule (ASR-3/ASR-4) derive most strongly from Guide §8.4, which post-dates the RPH primaries and was partly agent-authored, while ground truth shows the code-side floor was partially unperformed. Confirm the unconditional floor is ratified canon, not Guide-era over-reach. *Default: the floor stands as drafted; convergence enforces it.*
- **REG-E-017** — CPCO-era object rows (Narrative Memory, Confidence Assessment, cognitive focus as additive viewpoint) stay in the §3 semantic model or demote to DOC-001 doctrine. *Default: stay, with candidate lineage recorded in provenance.*
- **REG-E-021** — The Attention Item disposition vocabulary (addressed, delegated, deferred with review condition, accepted as risk, superseded) was authored by the finalizer to close DOC-001's cession; the meanings are NEW. *Default: stands as drafted at HYPOTHESIS.*

**JPWB-DOC-004:**
- **REG-E-018** — Quality-gate exception scope: Engineering Constitution L1188 mandates complexity findings addressed "fully" while L1220 permits documented exceptions; the draft reconciles as "explicit recorded exception, never silence." Confirm intended scope. *Default: the reconciliation stands.*
- **REG-E-019** — Post-retirement home of the SonarQube/scanner operating procedure (Engineering Constitution L1186 points into the sibling repo). *Default: repository operations doc; the retirement of that pointer is held until placed.*
- **REG-E-020** — The numeric coverage/mutation floors (100% guard-logic / 90% projection / risk-based UI) are ceded to repository gate configuration; confirm they are encoded there before retirement, or the numbers are lost. *Default: encode before retirement; verification is a retirement precondition.*

**Section E dispositions (append-only notations):**
- **REG-E-003 — CLOSED (REG-D-015, 2026-07-24):** the sponsor restated the chain-of-thought ruling in their own voice; merged into DOC-003 PER-12 v1.2.0. The reconstruction is no longer load-bearing.
- **REG-E-001 — sponsor evidence recorded (2026-07-24), amendment pending confirmation:** the sponsor's substantive input on the thesis sentence — "recursively composable" reads against the more familiar reductionist "recursively decomposable" and needs explanation — is recorded as primary-source voice. A proposed amendment (pairing decomposable/recomposable, with the anti-reductionist asymmetry glossed per Part A §2 and AX-4) is before the sponsor; the item remains OPEN until the sponsor confirms exact wording (CONSTITUTIONAL layer; B5).
- **REG-E-001 — second sponsor statement (2026-07-24, same session):** the pairing "is coming into view because of the larger discussion and vision of Janumi managing work and complexity — where complexity is differentiated from complicated." This grounds the amendment in the Complex Systems Management thread (source discussion, historical: the irreversibility-of-reductionism as the falsifiable test of complexity — "decompose, understand every part, recompose, still missing something; that remainder is the complexity"; the producing-system-vs-artifact distinction; sponsor's prior wholesale endorsement at that discussion's L1262, scoped near-term to Shape Engineering). Revised proposal package before the sponsor: thesis wording variants + complexity-grounded gloss (CON-000), a "complex, not merely complicated" doctrine passage (DOC-001 §2), and a **Complex ≠ Complicated** guard (DOC-002 §3/DOC-001 §4 inequality family).
- **REG-E-001 — third sponsor statement (2026-07-24, same session):** "complexity was in part captured by the Governed Stream and Narrative Memories concepts in terms of being able to answer questions like 'How did we get to this point?' and 'Where can we credibly go from here?'" — the **temporal axis** of the complexity stance, in sponsor voice: complex systems are path-dependent; the present state does not explain itself (retrospective question → the governed professional stream, AX-7) and futures are *credible* rather than arbitrary — constrained by accumulated commitments, assumptions, and evidence (prospective question → Narrative Memory, reconciliation, assurance). This supplies the design rationale, at doctrine altitude, for why the stream and Narrative Memory exist — and gives Narrative Memory its defining question, unifying the source corpus's two competing readings (scenario-evolution vs capability-evolution: both serve the prospective question). Package updated accordingly; item remains OPEN pending sponsor confirmation.
- **REG-E-001 — CLOSED (REG-D-016, 2026-07-24):** the sponsor confirmed variant B verbatim. The thesis now rests on sponsor voice, traced through three recorded evidence statements to the confirmation act. No sponsor-voice elicitation items remain open.

*(This section is the only part of the register the synthesis program may rewrite before ratification; thereafter, append-only discipline applies to it as to all sections.)*

---

## 7. Post-ratification program grants and commission questions

### REG-Q-051 — CSAA program-working-reference grant and Wave 1 commission

- **Date:** 2026-07-25 · **Type:** OPEN QUESTION
- **Statement:** The `docs/ASTs and Code Analysis/README.md` proposal requests establishment of Codebase Semantic Analysis and Assurance (`JAN-CSAA`) as a bounded program working-reference series for conventional TypeScript/Svelte codebase analysis and software assurance. Direction has been given to proceed with Wave 0 preparation, but no itemized sponsor act yet decides the working name/product standing, program-versus-`JPWB-SPEC-nnn` authority form, exact program scope, first supported repository subject, dirty-worktree inventory mode, permanent prefix and `000`–`011` allocations, lifecycle convention, Wave 1 commission, or adoption/oracle authority. The full judgment surface, verified evidence, strongest opposing considerations, consequences, recommendations, and candidate grant text are recorded in `docs/ASTs and Code Analysis/Wave 0 Sponsor Decision Instrument.md`. Does the accountable sponsor confer the proposed program grant, with what item-by-item dispositions and amendments?
- **Safe default:** No CSAA authority is conferred. `JAN-CSAA-000` remains a Draft proposal with a provisional ID; `JAN-CSAA-001` through `JAN-CSAA-011` remain unauthored and blocked. Wave 0 may prepare the decision instrument, requirement-ledger/review templates, and read-only evidence. It may not claim a permanent prefix, author governed Wave 1 members, select tools, change implementation or oracle artifacts, or treat a general direction to proceed as a sponsor conferral.
- **Disposition:** Await the accountable sponsor's separate disposition of W0-01 through W0-09. Before recording the result, recheck the next available `REG-D-nnn`; at filing time it appears to be `REG-D-017`.
- **Merge target:** A future sponsor-conferral entry in this register; administrative carriage into the CSAA `README.md` status/manifest and every authorized member status block. **Status:** OPEN.

### REG-Q-052 — CSAA two-stage program grant, charter adoption, and Wave 1 activation

- **Date:** 2026-07-25 · **Type:** OPEN QUESTION
- **Statement:** Independent review of the `REG-Q-051` decision surface found that its nine-item carrier bundled independently contestable semantic baselines and could allow an unconditional grant to contradict a `REJECT` or `DEFER` disposition. The revised `CSAA-W0-INSTRUMENT-2026-07-25@0.2.0` therefore separates W0-01 through W0-16 and requires two sponsor acts: Stage A may establish the bounded program and authorize preparation/review of an exact `JAN-CSAA-000` candidate; Stage B (W0-17) may adopt only an identified version and SHA-256 digest and then activate the three-document Wave 1 commission. Per-member Normative status requires its own `JPWB-REG-005` sponsor conferral and synchronized member/manifest carriage. This entry supersedes `REG-Q-051` only as the requested disposition procedure; its no-authority safe default remains consistent and in force.
- **Safe default:** No CSAA grant, charter adoption, permanent identifier authority, Normative member status, or Wave 1 commission is effective. Preparation of the itemized instrument, templates, exact evidence, and OPEN register records may continue. No sponsor response to an unseen W0-17 candidate may be inferred.
- **Disposition:** First await individual sponsor dispositions for W0-01 through W0-16. File no Stage A grant unless every prerequisite is `RATIFY` or a mutually compatible `AMEND`; any `REJECT`, `DEFER`, or unresolved incompatibility preserves the safe default. If Stage A is conferred, prepare and independently review the exact W0-17 candidate, then seek a separate version/digest-bound sponsor disposition. Recheck all identifiers and live evidence before either filing.
- **Merge target:** A compatible Stage A sponsor-conferral entry, followed by a distinct `JAN-CSAA-000` adoption/Wave 1 activation conferral if W0-17 is later ratified; synchronized administrative carriage into the CSAA member and manifest status blocks. **Status:** OPEN.

### REG-D-017 — JAN-CSAA program-working-reference grant and charter-preparation commission

- **Date:** 2026-07-25 · **Type:** DECISION (sponsor conferral; itemized disposition of `CSAA-W0-INSTRUMENT-2026-07-25@0.2.0`)
- **Statement:** The accountable sponsor establishes **Codebase Semantic Analysis and Assurance** (`JAN-CSAA`) as a JPWB program working-reference series for the design, specification, fixture, implementation, qualification, operation, and validation of a revision-bound semantic-analysis and conventional software-assurance capability for the root-manifest-resolved TypeScript, JavaScript, and TypeScript-bearing Svelte implementation in `JanumiCode/janumiprofessionalworkbench`. The program is an engineering capability, not a separate Janumi product, PWA, PWU, Undertaking, canonical role, or professional-semantic object. It holds no more than HYPOTHESIS-grade authority within the granted program scope, is subordinate to every canon artifact by concern, and defers exact governed shapes to enforced repository reference artifacts. The permanent, non-reusable `JAN-CSAA-000` through `JAN-CSAA-011` identifiers and the Draft / Proposed / Normative / Deprecated / Superseded lifecycle are confirmed; identifier allocation does not confer member authority. The first supported subject is the root-workspace-resolved JPWB package and `apps/rph-demo` source/configuration perimeter ruled by W0-04, with Playwright and other undeclared-project surfaces inventory-only and with documentation prototypes, workflow harness code, derived/build output, third-party source, live network/agent execution, production traces, and sibling repositories excluded as ruled there. Dirty-worktree inventory is revision/change-set bound and read-only by default; installation, generation, builds, cache-writing commands, live/network tests, external scanners, and production traces require separate execution authorization. Compiler-confirmed TypeScript facts are source/configuration/toolchain bound and provider outputs remain derived evidence; coverage proves identified execution rather than correctness; runtime traces support only their captured execution; findings and dispositions preserve append-only logical history; remediation and source mutation remain outside the analysis core; and unsupported, failed, stale, excluded, partial, or incomplete analysis may never report an unqualified green result. Concrete analyzer providers, graph composition and persistence, coverage provider/thresholds, production trace ingestion, gate/severity profiles, licensing/deployment profiles, and executable topology remain deferred. The W0-08 documentation-only commission for `JAN-CSAA-001`, `JAN-CSAA-002`, and `JAN-CSAA-005` is approved in principle but **is not active** until the exact W0-17 `JAN-CSAA-000` adoption conferral is recorded. Each CSAA member requires its own exact-version/digest `JPWB-REG-005` sponsor conferral and synchronized member/manifest carriage. This Stage A grant authorizes only administrative incorporation of these dispositions into a Draft or Proposed `JAN-CSAA-000`, completion of its requirement ledger and independent review, and preparation of the exact W0-17 adoption package. No CSAA member is Normative; `JAN-CSAA-000` is not adopted; Wave 1 is not active; no provider, implementation, procurement, oracle change, professional-work semantic, infrastructure-assurance rule, or unauthored content receives authority.
- **Disposition:** `W0-01 RATIFY; W0-02 RATIFY; W0-03 RATIFY; W0-04 RATIFY; W0-05 RATIFY; W0-06 RATIFY; W0-07 RATIFY; W0-08 RATIFY; W0-09 RATIFY; W0-10 RATIFY; W0-11 RATIFY; W0-12 RATIFY; W0-13 RATIFY; W0-14 RATIFY; W0-15 RATIFY; W0-16 RATIFY.` The sponsor expressly made no disposition on W0-17 and directed Stage A only. The live pre-recording evidence was rechecked at `2026-07-25T12:52:23.7902772-04:00`: branch `main`, HEAD `92f30710dd559120af608f84018c33ac5d846f0b`, 35 tracked/untracked porcelain entries, root workspaces `packages/*` and `apps/*`, ten package build configurations, eleven authored `.svelte` files, and no repository-wide coverage-configuration hit in the recorded inspection. Effective on recording as the `JPWB-CON-000 B1` program sponsor grant and charter-preparation commission; confers neither canon nor `JPWB-SPEC-nnn` status.
- **Merge target:** The conferral itself has no substantive merge target. Administrative carriage remains pending in the Stage A decision instrument, the Draft/Proposed CSAA `README.md` manifest, and the exact W0-17 adoption package. `REG-Q-052` remains OPEN only for Stage B adoption and Wave 1 activation; its former no-grant safe default is superseded by this act, while its no-member-adoption and no-Wave-1 defaults remain in force.
- **Status:** EFFECTIVE — MERGE PENDING.

**Append-only Stage A progress notation — 2026-07-25 (ministerial carriage of REG-D-017):**

- **REG-Q-051 — SUPERSEDED / CLOSED FOR STAGE A:** `REG-Q-052` superseded its nine-item disposition procedure, and `REG-D-017` now resolves the program-grant question. Its former no-grant safe default no longer controls.
- **REG-Q-052 — STAGE A SATISFIED; OPEN FOR STAGE B ONLY:** W0-17 remains undisposed. Until a later exact-version/digest sponsor conferral, `JAN-CSAA-000` is not adopted, no CSAA member is Normative, and the W0-08 Wave 1 commission is inactive.
- **REG-D-017 Draft/Proposed sequencing clarification:** the phrase “Draft or Proposed `JAN-CSAA-000`” names the permitted preparation lifecycle range; it does not permit skipping ratified W0-16. The charter remains Draft through disposition incorporation, requirement-ledger closure, and self-review. Only then may the author advance the exact candidate to Proposed for independent review. This notation creates no new decision.

### REG-D-018 — JAN-CSAA-000@0.3.0 exact adoption and Wave 1 documentation-commission activation

- **Date:** 2026-07-26T10:34:49.3000000-04:00 · **Type:** DECISION (accountable-sponsor conferral:
  individual RATIFY responses to `W017-002-MD-00`, every `W017-002-MD-01A`
  through `W017-002-MD-25`, and confirmation that `W017-002-CA-01` through
  `W017-002-CA-16` are non-dispositive `CARRIED_ACCURATELY` evidence)
- **Statement:** The accountable sponsor adopts exact `JAN-CSAA-000@0.3.0`,
  pre-carriage SHA-256 `a9e9174b3fb11f6c25c4d6c89db023a0163d781b288fe4045befd537aeb0a8eb`,
  as a Normative HYPOTHESIS-grade CSAA program working reference within its
  stated `Governs` boundary. The sponsor activates only the documentation-only
  W0-08 Wave 1 Draft-authoring and adversarial-review commission for
  `JAN-CSAA-001`, `JAN-CSAA-002`, and `JAN-CSAA-005`. Those documents remain
  unauthored and have no member authority until their own exact conferrals.
  No later wave, provider, dependency, procurement, experiment, implementation,
  topology, gate, source mutation, or oracle change is authorized.
- **Disposition:** Effective only with exact atomic carriage defined by
  `JAN-CSAA-000-W017-CARRIAGE-002@0.1.0` and its exact-operation attachment.
  This atomic adoption and synchronized README/package carriage also confirms
  completion of the outstanding administrative carriage of `REG-D-017`; the
  original `REG-D-017` entry remains unchanged.
  Expected post-carriage README: 101,717 bytes, SHA-256
  `ed2cde24be9ce0a99210644fdf655c192db5ee2c97ce0f587f446a1820ee5710`.
- **Merge target:** The exact 24 state-only README locations identified by
  `JAN-CSAA-000-W017-CARRIAGE-002-SUBSTITUTIONS-001@0.1.0`.
- **Status:** EFFECTIVE — MERGED.

### REG-D-019 — JAN-CSAA-000@0.3.0 Wave 1 authored-Draft manifest synchronization

- **Date:** 2026-07-26T17:35:53.0060000-04:00 · **Type:** DECISION
- **Sponsor:** Marshall Hendricks, Architect and accountable sponsor
  (accountable-sponsor disposition of `JAN-CSAA-W1-MANIFEST-001@0.3.0`
  following `W1M-CO-01 = COMPATIBLE_SAME_VERSION_STATE_ONLY` in
  `JAN-CSAA-W1-MANIFEST-001-CONCERN-OWNER-001@0.1.0`, with individual
  compatible responses preserved in
  `JAN-CSAA-W1-MANIFEST-001-SPONSOR-RESPONSE-001@0.1.0` for `W1M-MD-00`,
  `W1M-MD-01`, `W1M-MD-02`, `W1M-MD-03A` through `W1M-MD-03E`,
  `W1M-MD-04A` through `W1M-MD-04C`, and `W1M-MD-05` through
  `W1M-MD-07`)
- **Authority evidence:** Validation freeze 16,253 bytes, SHA-256
  `ef3f512afbb55730a00c8e8e5181a09a2e87f3454ed89d575412fc4107038040`;
  concern-owner determination 18,301 bytes, SHA-256
  `f53074db9b44e0674c25dc37ef23883321d1673af80dbdb175b393b1ac718265`;
  presentation record 21,234 bytes, SHA-256
  `d85ade1458bdea3f872133b9366c313be8b3a2a3a89168d7fe650ee71606151a`;
  sponsor-response record 10,150 bytes, SHA-256
  `bb0410b39a992f99fc76312f06859cc933a09c5f71daca68f6c27635194d5a05`.
  Each record also retains its exact ID/version, path, encoding/line-ending
  form, and terminal-newline condition under the proposal's §5 identity rule.
- **Register preimage:** 101,465 bytes, SHA-256
  `8e10767517bd98a8808a9d97dfcb6f6d0b6cba134e082b14e41588fbfa544798`;
  UTF-8 without BOM, LF-only, one terminal LF; final decision identifier
  `REG-D-018`.
- **Statement:** The accountable sponsor authorizes exact state-only
  administrative synchronization of the `JAN-CSAA-000@0.3.0` controlled
  manifest with three authored, non-authoritative Wave 1 Drafts:
  `JAN-CSAA-001@0.1.0`, bytes 92,052, SHA-256
  `84879bbf25a71b1100de9589d975e7baade71a3e05968195db68fb3eba18e1b8`;
  `JAN-CSAA-002@0.1.0`, bytes 151,503, SHA-256
  `0b0b1dcc460d6a1432880ee7d4102311edb0e82af4ccf418014f86df3b7aed34`;
  and `JAN-CSAA-005@0.1.0`, bytes 106,386, SHA-256
  `8d9873898d119d864903b02b93402b57521922dbc420db8a838c843b969bc593`.
  Each ledger remains OPEN; formal independent review is not completed;
  005 remains STALE_FOR_CURRENT_REPOSITORY. No member is adopted or promoted.
  No later wave, provider, dependency, procurement, experiment,
  implementation, topology, gate, source mutation, or oracle change is
  authorized.
- **Decision boundary:** Authorizes only the exact archive, README result,
  conditional completion record, recovery rule, and later ministerial
  confirmation defined by `JAN-CSAA-W1-MANIFEST-001@0.3.0`. The recorder is
  delegated to append that confirmation at the then-next available register
  identifier only if every exact predicate passes. The delegation permits no
  amendment, substitution, waiver, new judgment, or scope expansion.
- **Disposition:** Exact carriage is defined by
  `JAN-CSAA-W1-MANIFEST-001@0.3.0` and
  `JAN-CSAA-W1-MANIFEST-001-SUBSTITUTIONS-001@0.1.0`, including preservation
  of the pre-carriage README at the proposal's exact archive path.
  Pre-carriage README: 101,717 bytes, SHA-256
  `ed2cde24be9ce0a99210644fdf655c192db5ee2c97ce0f587f446a1820ee5710`.
  Post-carriage README: 102,164 bytes, SHA-256
  `833b97d9fe12ae5e245b6c2920216ec3271e59f68dc24c54d0efd9a1efdf32a1`.
- **Pending-state result:** `JAN-CSAA-W1-GAP-001` remains OPEN and
  `CSAA-000-REQ-150` remains unperformed for this event until exact carriage
  and the delegated append-only confirmation. Every ledger remains overall
  OPEN; every verification row remains NOT_RUN; every other gap retains its
  exact recorded state.
- **Merge target:** Exact README operations `W1M-C-01` through `W1M-C-05`,
  the exact pre-carriage preservation snapshot, the itemized sponsor-response
  record, `JAN-CSAA-W1-MANIFEST-001-COMPLETION-001@0.1.0`, and the delegated
  then-next append-only confirmation.
- **Status:** EFFECTIVE — MERGE PENDING.

### REG-D-020 — Confirmation of JAN-CSAA-000@0.3.0 Wave 1 manifest synchronization

- **Date:** 2026-07-26T20:05:30.7559771-04:00 · **Type:** DECISION
  (ministerial exact-carriage confirmation under `REG-D-019`; no new sponsor
  judgment, delegation, or scope)
- **Recorder:** Codex documentation recorder, acting under the bounded
  ministerial-confirmation delegation in `REG-D-019`
- **Register preimage:** 105,388 bytes, SHA-256
  `fad01c48361f422bf1f2b5021c466ec4add24de95bd0d285bda46d8a0e2173ab`;
  exact byte prefix ending in the effective `REG-D-019` pending decision.
- **Confirmed evidence:** `REG-D-019`; `JAN-CSAA-W1-MANIFEST-001@0.3.0`;
  `JAN-CSAA-W1-MANIFEST-001-PHASE1-VARIANCE-001@0.1.0` and its successful
  corrective §3.2 proof; pre-carriage snapshot
  `records/archive/JAN-CSAA-000@0.3.0.Normative.REG-D-018.README.snapshot`,
  101,717 bytes, SHA-256
  `ed2cde24be9ce0a99210644fdf655c192db5ee2c97ce0f587f446a1820ee5710`;
  active `README.md`, 102,164 bytes, SHA-256
  `833b97d9fe12ae5e245b6c2920216ec3271e59f68dc24c54d0efd9a1efdf32a1`;
  and `JAN-CSAA-W1-MANIFEST-001-COMPLETION-001@0.1.0`, 23,951 bytes,
  SHA-256
  `a9c487305205b8da3f1f5e391040df85ace00f118a72e243f571b0c5ba79d995`.
- **Statement:** Every exact predicate delegated by `REG-D-019` verified.
  The five README operations, preservation snapshot, conditional completion
  record, eight bound Wave 1 artifacts, no-authority boundary, bounded
  documentation-only file impact, permanent phase-1 variance evidence, and
  exact corrective §3.2 rerun match the proposal.
- **Live-state result:** `CSAA-000-REQ-150` is satisfied only for this exact
  administrative event. `JAN-CSAA-W1-GAP-001` is CLOSED only for live
  manifest synchronization. `JAN-CSAA-W1-GAP-002` and the 005 refresh gap
  remain OPEN; all three ledgers remain overall OPEN; every other gap retains
  its exact recorded state; every verification row remains NOT_RUN;
  self-review and formal independent review remain incomplete.
- **Disposition:** This entry confirms and supersedes only the
  live `EFFECTIVE — MERGE PENDING` state of `REG-D-019`; it does not rewrite
  that historical entry, erase the recorded phase-1 variance, or confer member
  authority.
- **Merge target:** The exact active README result and the exact conditional
  completion record identified above; no other artifact and no state beyond
  the exact live-state and disposition results above.
- **Status:** EFFECTIVE — MERGED.

### REG-D-021 — JAN-CSAA standing documentation-corpus construction commission and deferred final sponsor review

- **Date:** 2026-07-28T08:58:53.646-04:00 · **Type:** DECISION
  (accountable-sponsor standing direction, program commission, and bounded
  process delegation)
- **Sponsor:** Marshall Hendricks, Architect and accountable sponsor
- **Sponsor-originated direction:** “We need to remove me from the manual
  authorization of these documents because it's taking way longer to generate
  than I had expected. Granted, we do want very high quality documentation so
  the process itself is fine. But my authorization as sponsor will have to be
  understood as me reviewing the full corpus of documents once all the waves,
  etc. have been finished.”
- **Direction evidence:** `JAN-CSAA-SPONSOR-DIRECTION-001@0.1.0`;
  `docs/ASTs and Code Analysis/records/JAN-CSAA - Sponsor Standing Direction
  for Autonomous Corpus Preparation and Final Review.md`; 15,802 bytes;
  SHA-256
  `6aae01e189386352a5fc693faa9379ec44c0faffc52bbf0badef9efccb1c6484`;
  UTF-8 without BOM, CRLF-only, one terminal CRLF.
- **Register preimage:** 107,854 bytes; SHA-256
  `d516e7068eae1a2a19fa1259420518f63833af070cf5642a9d95fb4bf2f09872`;
  UTF-8 without BOM, LF-only, one terminal LF; endpoint
  `REG-D-020 / EFFECTIVE — MERGED`.
- **Statement:** The accountable sponsor activates a standing,
  documentation-only construction commission for the complete reserved
  `JAN-CSAA-001` through `JAN-CSAA-011` corpus, its requirement ledgers,
  evidence and review records, cross-corpus closure records, repository-specific
  design, and detailed implementation roadmap. Documentation agents may author,
  revise, reconcile, validate, complete objective wave-exit checks, and advance
  a member from Draft to Proposed after its ledger and author self-review close.
  Proposed members require independently recorded adversarial review. No
  intermediate sponsor response, concern-owner appointment or disposition,
  per-member adoption package, register decision, or README-carriage decision
  is required merely to continue in-scope documentation work or enter the next
  documentation wave.
- **Scope:** The commission completes Wave 1 documentation and activates the
  documentation-authoring portions of Waves 2, 3, and 4. It permits read-only
  repository inspection and non-authoritative working-state records. It permits
  proposed specifications of schemas, fixtures, tests, provider criteria, and
  implementation work, but it does not perform or confer those artifacts.
  `JAN-CSAA-000@0.3.0` remains the active Normative charter and adopted-manifest
  baseline; its final corpus successor may be prepared only as Draft or
  Proposed before the final sponsor act.
- **Duration:** Effective on recording until the earliest of the final
  completed-corpus sponsor disposition, explicit sponsor revocation or
  supersession, a material authority incompatibility that cannot safely remain
  an explicit Draft/Proposed assumption or alternative, or recorded program
  cancellation. There is no per-document or per-wave expiry.
- **Reviewability:** Permanent IDs, versions, exact candidate digests,
  provenance, requirement ledgers, self-reviews, independent adversarial
  reviews, unresolved findings and alternatives, strongest opposing cases,
  horizontal-closure evidence, and a current working-status record must remain
  inspectable. The sponsor may inspect or redirect at any time, but intermediate
  sponsor review is not a continuation predicate and its absence is never
  approval.
- **Recording mechanism:** This entry is the single standing commission.
  Member metadata, ledgers, review records, and a separate non-authoritative
  working-corpus status record carry preparation state. The adopted README
  manifest is an authority/adoption baseline and need not churn for every Draft
  revision or wave transition. Interim sponsor presentations, sponsor-response
  records, concern-owner authority/determination records, and state-only
  manifest-ratification packages are not required. At completion, one exact
  corpus manifest binds every proposed member and its assurance evidence for
  one sponsor-review event; the accepted set and any exceptions are then
  recorded and synchronized in one controlled final-carriage procedure.
- **Separation of duties:** The authoring identity may not independently review
  the same exact candidate. A separately identified reviewer invocation records
  method, evidence, findings, and candidate identity; if that reviewer edits
  candidate bytes, another reviewer must review the affected result. Authors,
  reviewers, validators, recorders, and program-local records may not confer
  Normative status, fabricate sponsor voice, waive a requirement, accept risk,
  weaken a pre-existing oracle, or expand this delegation. Material
  cross-document semantics require horizontal-closure and single-owner review.
- **Final sponsor boundary:** Every newly authored member remains Draft or
  Proposed and non-authoritative until the completed corpus is presented. The
  sponsor's next required authorization for this documentation program is one
  final exact-corpus review event. That package preserves the full-judgment
  evidence required by `REG-D-013`, including individually visible material
  forks and exceptions, but does not require separate intermediate
  authorization events. One exact manifest-bound sponsor act may confer all
  accepted members together while expressly excluding or deferring others.
- **Transition:** The unexecuted
  `JAN-CSAA-W1-MANIFEST-002@0.2.0`/`JAN-CSAA-W1-VALIDATION-004@0.1.0`/
  `INSTRUMENT-002`/`FREEZE-002`/`INTAKE-002` chain is withdrawn from active
  solicitation and retained unchanged as historical preparation evidence. No
  Part A assignment, Part B `W1M2-CO-01` response, sponsor presentation,
  sponsor response, README carriage, archive, completion, or confirmation is
  authorized for that package. This entry consumes `REG-D-021`, which that
  proposal expected but did not reserve, and therefore independently defeats
  its exact pre-recording predicate.
- **No-expansion boundary:** This decision authorizes no canon amendment,
  Normative member conferral, application/source/test/configuration/dependency
  mutation, installation, procurement, provider selection or qualification
  execution, external scan, network or live-agent execution, production trace,
  prototype, executable schema/type/fixture/conformance-suite/oracle creation
  or change, analyzer implementation, deployment topology, retirement, or
  authority transfer. Each remains subject to its existing separate authority.
- **Disposition:** The per-member sponsor-conferral procedure in
  `REG-D-017`, the Wave-1-only commission in `REG-D-018`, and the
  separately-authorized Wave 2–4 preparation gates in
  `JAN-CSAA-000@0.3.0` are superseded prospectively only to the extent necessary
  to implement this standing documentation-preparation model. Their historical
  acts, substantive semantic baselines, lifecycle distinctions, evidence rules,
  implementation prohibitions, and final sponsor-conferral requirement remain
  in force.
- **Merge target:** Administrative consolidation into the completed
  `JAN-CSAA-000` successor, final controlled manifest, accepted member metadata,
  and final corpus-review records. Interim carriage is deliberately deferred to
  avoid turning working-state changes into repeated sponsor gates.
- **Status:** EFFECTIVE — MERGE PENDING.

### REG-D-022 — Correction and assurance clarification of the JAN-CSAA standing documentation commission

- **Date:** 2026-07-28T09:18:50.1250030-04:00 · **Type:** DECISION
  (append-only ministerial correction and assurance clarification under
  `REG-D-021`; no new sponsor judgment)
- **Recorder:** Codex documentation recorder and assurance auditor, acting
  under the sponsor-originated standing direction recorded by `REG-D-021`
- **Correction evidence:**
  `JAN-CSAA-STANDING-DIRECTION-CORRECTION-001@0.1.0`;
  `docs/ASTs and Code Analysis/records/JAN-CSAA - Standing Direction
  Interpretation Correction and Assurance Clarification.md`; 10,000 bytes;
  SHA-256
  `1ac465b6b072808b178827ad1012310070941de794635c7fd0c82a4b8d7eccd4`;
  UTF-8 without BOM, CRLF-only, one terminal CRLF.
- **Register preimage:** 115,401 bytes; SHA-256
  `eb8c26b66981f95e708c3baa4327700591731b440f373e1c1f7b7886cc83464b`;
  UTF-8 without BOM, LF-only, one terminal LF; endpoint
  `REG-D-021 / EFFECTIVE — MERGE PENDING`.
- **Correction 1 — final judgment grain:** One final corpus-review interaction
  does not authorize a bulk or undifferentiated disposition. The final package
  must provide one full-judgment surface and individual sponsor response field
  for every candidate member and every independently contestable material fork,
  exception, residual-risk acceptance, or amendment. All fields may be answered
  in one itemized payload. Each accepted member receives a distinct exact-member
  `JPWB-REG-005` conferral decision within one controlled final transaction.
  This preserves `REG-D-013` while moving sponsor attention to one final event.
- **Correction 2 — phase terminology:** Authorization to complete objective
  “wave” checks under `REG-D-021` means documentation-subphase entry, readiness,
  transition, and completion only. It does not satisfy or authorize the full
  executable exit criteria in `JAN-CSAA-000@0.3.0` §15. Wave 2 fixture-oracle
  evidence, Wave 3 executable schemas/types/fixtures/tests, and Wave 4 provider
  qualification execution remain unperformed and separately unauthorized. The
  final documentation corpus must report those predicates as explicit non-pass,
  later-execution allocations.
- **Correction 3 — MANIFEST-002 incompatibility:** The statement that consuming
  `REG-D-021` independently defeated the package's register-identifier
  predicate is withdrawn. `JAN-CSAA-W1-MANIFEST-002@0.2.0` required the actual
  next unreserved identifiers. It cannot execute because `REG-D-021` changed
  its exact frozen register preimage and authority state and expressly withdrew
  it from solicitation. The complete package remains immutable, historical,
  non-conferring, and unexecuted.
- **Assurance clarification 1 — reviewed bytes:** Every candidate-byte change
  after an exact review freeze triggers affected re-review. The sole exception
  is an exact pre-frozen administrative substitution set with enumerated
  operations, source and result digests, no semantic or judgment change,
  independent replay, independent result validation, and ministerial recording
  against exact predicates. Undefined “ministerial corrections without
  re-review” are prohibited.
- **Assurance clarification 2 — role separation:** For the same exact judgment
  surface, author/integrator, adversarial reviewer, integrity/provenance
  validator, final decision authority, and ministerial recorder are distinct
  identities. Editing candidate bytes makes that identity an author for the
  result. The recorder may not supply or reinterpret judgment, and the decision
  authority may not record its own disposition as ministerial recorder.
- **Template clarification:** `REG-D-017` and W0-16 are modified prospectively
  only within the exact intermediate-authorization and documentation-wave scope
  of `REG-D-021`; they are not superseded wholesale. Active review and ledger
  templates must preserve that wording, the five-role separation, individually
  dispositionable final surfaces, and exact reviewed-byte continuity.
- **Disposition:** This entry supersedes `REG-D-021` only where the earlier
  entry or its interpretation record conflicts with the corrections above.
  `REG-D-021` otherwise remains effective: no intermediate sponsor gate is
  restored, all documentation subphases remain commissioned, every member
  remains Draft or Proposed until final conferral, and every no-expansion
  boundary remains in force.
- **Merge target:** Active CSAA review and ledger templates, successor
  non-authoritative working-status records, the completed `JAN-CSAA-000`
  successor, final controlled manifest, exact member-review records, and final
  corpus-review/carriage records.
- **Status:** EFFECTIVE — MERGE PENDING.
