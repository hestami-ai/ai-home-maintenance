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
- **Disposition (CONFERRED 2026-07-29):** **Fail closed now; implement on ratification.** The B7 component is **DISCHARGED** at commit `50785b5b`: the command now REFUSES a revision carrying any field it cannot honour, naming the DOC-003 rule each carries, and the emitted event conforms to `DecompositionRevisedPayloadSchema`. Neither required a ratification decision — refusing to do what a handler does not do asserts nothing, and an event matching the shape it already declares claims nothing new. The **DOCS_STRONGER component remains OPEN**: DEC-2's impact analysis, DEC-3's obligation conservation and DEC-4's constraint disposition are unimplemented **for revision**. Remediation is mechanically available and has direct precedent — `checkTransition` constrains `status` only, and `advanceStatus`'s `mutate` hook is used at eleven sites including `supersedeAssurancePolicy`, which writes a payload-derived field while advancing to SUPERSEDED.
- **What the remaining work actually is — corrected 2026-07-29, because the first wording of this entry obscured it.** It said remediation awaited a "decomposition-model increment", which named nothing: no such item exists in any plan, and the phrase was coined in this entry. **The domain kernel is already built and adversarially reviewed.** `rph-domain/src/decomposition.ts` exports `validateObligationConservation` (:62) and `validateConstraintPropagation` (:165), and `validateDecomposition` already calls both (`rph-application/src/handlers/decomposition.ts:210-211`). The revise path is a **second call site that was never wired** — not new domain logic, and **not obviously anything that requires ratification**: DOC-003 is OPERATIVE and already binds revision, so the semantics are settled. Describing it as awaiting ratification put a governance blocker in front of work that appears to need only scheduling, which is the same asserted-vs-performed shape as the finding itself.
- **How it went missing, which is the more useful record.** `JPWB Implementation Roadmap and Tracker.md` shows the wiring deferred forward four times, every station marked ✅: **M9** — *"kernel + adversarial-reviewed; commands/BINDINGS wiring → M10/M11"*; **M10** — *"executable kernel + adversarial-reviewed; command handlers → M11/M13"*; **M11** — *"execution kernel + adversarial-reviewed; … command handlers … → M13"*; **M13** — *"✅ core … live-command-drive handlers deferred"*. It was passed along the chain and fell off the end, with no milestone left holding it. This is the same pathology already measured once in this repository as *"74% of the kernel dead in production"* (the harmonization programme), arriving through the deferral notes rather than through the code. **Status here is therefore OPEN AND UNSCHEDULED**, stated plainly so it is not mistaken for queued.
- **A defence considered and rejected**, recorded because the reading is natural and was in fact reached once during the programme: the vocabulary note *"DOC-002-only; new contract = DRAFT"* appears to license the handler as "supersede, then propose a successor". It does not — it is disclaimed by its own paired entry, `kit.ts` states that vocabulary's `drivesFrom` *"has no ratified authority"*, DOC-002 carries no DecompositionContract transition matrix, and the only ratified sentence on the subject describes an **in-place** revision. Adopting it would have downgraded a B7 finding by citing an unratified source as ratified.
- **Residual, offered as a candidate SPEC-001 gap:** an accepted-but-unapplied command is disclosed by nothing. SPEC-001 INV-08 obliges disclosure only on a **refused** command and INV-14 only on an **interrupted** sequence. The refusal above removes the instance; the class remains unaddressed.
- **Event payload RATIFIED by the same conferral (2026-07-29).** The `DecompositionRevised` shape — `supersedesDecompositionContractId`, `rationale`, `semanticVersion`, `status` — is the minimum record of what DOC-002 §13.2 already ratifies, and its vocabulary provenance now says so. The consequence is enforcement, not documentation: the event enters `RATIFIED_EVENT_PAYLOADS`, the engine's (d2) gate runs, and a non-conforming emission is refused at dispatch with `VALIDATION_FAILED` instead of being committed and noticed only by a test. Verified by mutation. *Trap recorded for later editors: `sourceSection` is both prose and a machine predicate — `gen-messages` substring-matches it — so naming the not-yet-ratified marker inside the replacement text silently re-applies it, leaving an entry that reads as ratified and is not enforced. This occurred once during the conferral and was caught by simulating the generator's filter before trusting its output.*
- **DOCS_STRONGER COMPONENT LANDED 2026-08-02, for DEC-3 and DEC-4.** `reviseDecomposition` now APPLIES `obligationAllocations` and `constraintPropagations` and gates them with the same M9 kernel `validateDecomposition` calls — the second call site the entry above predicted, and it was wiring rather than new domain logic exactly as stated. The conservation check runs against the contract **as revised**, not as stored; checking the stored state would pass every revision by construction, and a mutant doing so reddens the refusal test. A second mutant dropping the `mutate` hook reproduces the F-I defect itself — accepted while the content is silently discarded — and reddens the application test. Evidence: `decomposition-revise-conservation.test.ts`.
- **DEC-2 IS NOT LANDED, AND IS NOT MERELY UNSCHEDULED — IT IS BLOCKED.** Its operative clause is *"triggers impact analysis"*, and this engine has no impact-analysis plane: `impactedObjects` is a hollow-kernel-triage deferral awaiting a TraceLink-minting command surface that does not exist. `childWorkUnitIds` therefore stays REFUSED, and the refusal message now names that blocker specifically instead of standing in for all three carriers. Applying a revised child set while silently performing no impact analysis would BE the F-I defect, so the fail-closed discharge is retained for the one field that still needs it.
- **Merge target:** Repository (handler + `decomposition-revise-conformance.test.ts` + `decomposition-revise-conservation.test.ts` + the vocabulary provenance, all landed); JPWB-DOC-003 DEC-2/3/4 carry the semantic requirement unchanged. **Status:** OPEN, NARROWED — B7 discharged, event payload engine-enforced, DEC-3 and DEC-4 implemented and mutation-proved. What remains is DEC-2 alone, and it is blocked on the impact-analysis plane rather than on scheduling.

### REG-F-007 — M7's PolicyRegistry and AssuranceService were never built, and four milestones closed over it
- **Date:** 2026-07-29 (found by the tracker-deferral gate, `verif/tracker-deferrals.test.ts`) · **Type:** DIVERGENCE FINDING · **Class:** none — not a code/canon divergence; a **reporting** defect, recorded because its consequence is indistinguishable from abandoned scope.
- **Statement:** `JPWB Implementation Roadmap and Tracker.md` M7 reads 🟡 with the residue *"PolicyRegistry + AssuranceService orchestration → M10/M13"*. **Neither symbol exists anywhere in the repository** (searched 2026-07-29, both names, all packages and apps, source and tests). Its two named successors M10 and M13 both closed ✅ without absorbing it, and no later milestone holds it. Six of sixteen milestone rows deferred work forward, five of them marked ✅, and every chain converged on M13 — which is itself ✅ and whose note ends *"live-command-drive handlers deferred"*. The work was handed forward and fell off the end while every row read as done.
- **Why this is a finding and not housekeeping:** the same deferral notes were concealing the OPPOSITE error in four other rows — M1's `RPH-FIX-002`, M10's governance/baseline handlers, M11's handler registry and M12's mutation testing had all LANDED, in later programmes, with the tracker never updated. A record that hides both "done but uncredited" and "abandoned but unsurfaced" behind the same mark is worse than one that reports neither, because it is read as authoritative. Compare REG-F-002 (provenance theater): the failure mode is an artefact whose form asserts a status nothing performs.
- **Disposition:** The mechanism is closed — a milestone marked complete may no longer defer to milestones that are all complete without naming, via a `DISCHARGED:` marker, where the work landed. Gated at `verif/tracker-deferrals.test.ts` with a selftest over synthetic input (the first version coupled the gate's validity to the tracker still containing the defect, so a CLEAN tracker was indistinguishable from a BROKEN parser). All six rows are now dispositioned with evidence. **The M7 SCOPE ITSELF REMAINS UNBUILT AND UNSCHEDULED** — whether PolicyRegistry / AssuranceService orchestration is still wanted is a sponsor question, not an engineering one, since M7's rule library shipped and the demo's assurance path works without them.
- **Merge target:** Repository (tracker rows + the gate, landed). **Status:** OPEN — mechanism closed; the M7 scope decision is owed.

### REG-F-008 — Evidence admissibility carries two guard limbs that cannot fail
- **Date:** 2026-08-01 (found while dispositioning the RPH-EVD family into the enforcement register; filed 2026-08-02) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER, with a CON-000 B7 anti-vacuity component — the same shape as REG-F-005 and REG-F-006, and filed adjacently so the three are not disposed inconsistently.
- **Statement:** JPWB-DOC-003 §7 requires of admissible evidence that *"provenance is present; content or reference is available"*. `evidenceAdmissibility` (`packages/rph-assurance/src/assurance-rules.ts`) implements both as **null checks**, and both are satisfiable — in one case unavoidably — by objects this engine itself constructs:
  - **PROVENANCE_PRESENT is structurally unfailable.** `newEnvelope` (`packages/rph-application/src/handlers/kit.ts`) sets `provenance` unconditionally on **every** object, with a **defaulted** `originType: 'USER_INPUT'` and empty source arrays. The limb therefore null-checks a field the engine always populates, and the populated value names no producing actor. The actual producing actor travels in `producedBy`, and the predicate's input type `EvidenceForAdmissibility` **has no `producedBy` field at all**, so the rule is inexpressible to the predicate even in principle.
  - **CONTENT_AVAILABLE is satisfied by `{}`.** `ArtifactReferenceSchema` is `z.record(z.string(), z.unknown())`, so `contentReference: {}` — a source reference naming nothing — is schema-valid and passes `contentReference === undefined || null`.
  - **Runtime-verified, not read:** Evidence proposed with `contentReference: {}` is ACCEPTED to ADMISSIBLE through `Engine.dispatch`, while the byte-identical arrangement with `scope: ''` is REJECTED by the *same guard at the same site* — so the admission is a missing limb of a live guard, not a dead guard. Both observations are now permanent gates in `packages/rph-application/src/handlers/evd-disclosure-observed.test.ts`.
- **Why this is a finding and not a nitpick:** this is the shape the verification programme has repeatedly found in **tests** — a control that cannot fail — occurring here in **production**, inside the guard that the conformance manifest cited as evidence that RPH-EVD-003 was covered. An assertion that cannot fail is indistinguishable from an absent one except that it reports success. Compare REG-F-002 (provenance theater): an artefact whose form asserts a status nothing performs.
- **What is NOT wrong, recorded because the opposite was nearly asserted twice.** The *producing-actor* half of RPH-EVD-003 is **schema-foreclosed**, not unenforced: `ProposeEvidence.producedBy` is a required `ActorReferenceSchema` whose `actorId` and `displayName` are `.min(1)`, so evidence with no producing actor cannot be proposed at all (observed `VALIDATION_FAILED`, never reaching a handler). Two independent source-reading passes concluded the opposite; only dispatch settled it. The enforcement register's ENFORCED arm cannot express schema-layer enforcement — `classifyRefusal` reads only `REJECTED`, so a schema foreclosure classifies as ADMITTED — which is a disclosed limit of that instrument, not of the engine.
- **Disposition (REMEDIATED 2026-08-02):** Disclosed and gated 2026-08-01; **fixed 2026-08-02**. `EvidenceForAdmissibility` gained a `producedBy` field (REG-F-005's impoverishment pattern one type over, as predicted), `PROVENANCE_PRESENT` now reads the **producing actor** through `namesAnActor` instead of null-checking the auto-populated envelope, and `CONTENT_AVAILABLE` uses `referencesContent`, which rejects the empty record `{}` that `z.record` admits. The `admitEvidence` guard passes `producedBy` through. Remediation needed no ratification decision — canon already stated the rule and DOC-003 is OPERATIVE.
- **THE DISCLOSURE'S GUARD PERFORMED EXACTLY AS SPECIFIED, which is the more valuable record.** The fix turned the `OBSERVED_ADMISSION` probe **RED** — its failure message instructing the reader to re-disposition the row — and `RPH-EVD-003` moved from `UNENFORCED_DISCLOSED` to `ENFORCED` with a refusal probe, a distinct `refusalMarker` (`is inadmissible (§8.11) — failed CONTENT_AVAILABLE`, deliberately not sharing EVD-007's condition name), and a COMMAND-layer manifest cite. A disclosure that cannot outlive the condition it discloses is what this register was built for, and this is the first time one has been observed closing.
- **Five fixtures depended on the hole** and were made honest, not weakened: `baseline-invalidated-evidence`, `dwp03-precondition-coverage`, `evidence-invalidation-impact`, `lifecycle` and `evidence-admissibility-gate` all proposed evidence with `contentReference: {}` and admitted it; the kernel fixture in `assurance-rules.test.ts` passed `PROVENANCE_PRESENT` on `provenance: {}` — an empty object satisfying a check about who produced the evidence, which is the vacuity in miniature.
- **Mutation-proved:** restoring the null-check reddens the enforcement probe (ADMITTED); unwiring `producedBy` reddens the **controls** of both EVD-003 and EVD-007 by over-refusing every admission.
- **Merge target:** Repository (`assurance-rules.ts` predicate + input type; `assurance.ts` call site; register row; manifest cite; probes moved between the two observation maps). JPWB-DOC-003 §7 carries the requirement unchanged. **Status:** **CLOSED** — remediated, enforced, and observed.

### REG-F-009 — `FormalizeIntent` does not increment the semantic version its ratified rule says it does
- **Date:** 2026-08-02 (found while building RPH-INT-003's enforcement probe, not by reading the handler) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER — a ratified acceptance clause the engine does not perform.
- **Statement:** RPH-INT-002 (conformance §7) reads *"Accepting FormalizeIntent on an UNDER_DISCOVERY intent sets status FORMALIZED, **increments semantic version**, persists desired outcomes and success conditions, and emits IntentFormalized."* The increment does not happen. `formalizeIntent` (`packages/rph-application/src/handlers/intent.ts`) does not pass `bumpSemanticVersion` to the shared `advanceIntent` primitive; `reviseIntent` is the only Intent command that does. **Runtime-verified:** an intent driven RAW → UNDER_DISCOVERY → PROVISIONAL → FORMALIZED is at `semanticVersion` **1**, and `ApproveIntent` naming v2 is refused with *"the approval names v2 but intent … is at v1"*.
- **How it was found, which is the part worth keeping.** Not by reading `intent.ts` — by writing a probe for a *different* rule. The RPH-INT-003/004/005 fixtures approved v2 on the strength of RPH-INT-002's ratified text, and the engine refused them. The rule's own statement was the "expected" that made the gap detectable, which is REG-D-008's argument for retaining independent source schemas, arriving a second time.
- **Consequence, and why it is not merely cosmetic.** RPH-INT-005 binds an approval to an exact semantic version, and `markPwuReady` enforces the same staleness rule for PWUs. A version that does not move when the intent's content materially changes is a version those guards cannot discriminate on: formalization persists `formalizedObjective`, `desiredOutcomes`, `successConditions`, `nonGoals`, and stakeholder/constraint references — a material change by any reading — and an approval taken before it remains valid afterwards. The staleness guard is real (RPH-INT-005 is `ENFORCED`); this narrows what it can catch.
- **Disposition:** Recorded, not fixed. The remedy is one flag, but adding it is a behaviour change that would move every formalized intent to v2 and owes its own red-first test and mutant — and it interacts with RPH-INT-005's guard, so it is a change to make deliberately rather than as a rider on a register tranche. The enforcement register's `RPH-INT-002` row carries the finding inline so a reader of the disposition sees it; the row's arm (`NOT_A_COMMAND_REFUSAL`) is unchanged and correct, since no command is refused either way.
- **Merge target:** Repository (`intent.ts` + a test asserting the increment). JPWB-DOC-003 carries no intent-version rule, so canon is unaffected — which is itself consistent with `RPH-INT-003`'s `NO_CANON_CARRIER` disposition. **Status:** OPEN — recorded and disclosed, remediation unscheduled.

### REG-F-010 — Seven of the fifteen ratified error codes are carried by no refusal, and they are not all the same thing
- **Date:** 2026-08-02 (found while sizing the RPH-CON tranche for the enforcement register) · **Type:** DIVERGENCE FINDING · **Class:** mixed — see the three-way split, which is the substance of the entry.
- **Statement:** `RphErrorCodeSchema` (`packages/rph-contracts/src/errors.ts`) ratifies fifteen codes. Censused across every non-test file under `rph-application`, `rph-engine` and `rph-persistence`, **seven are carried by no refusal site**: `RPH_EVIDENCE_INVALIDATED`, `RPH_VALIDATOR_INDEPENDENCE_VIOLATION`, `RPH_POLICY_VERSION_MISMATCH`, `RPH_SUBJECT_VERSION_MISMATCH`, `RPH_BASELINE_VERSION_MISMATCH`, `RPH_IDEMPOTENCY_DUPLICATE`, `RPH_EXTERNAL_OPERATION_UNCERTAIN`.
- **THE COUNT ALONE WOULD BE A MISLEADING FINDING, which is why it is not filed as one.** The seven fall into three groups with different dispositions, and collapsing them into "seven dead codes" would manufacture five defects out of two:
  1. **UNUSED BY DESIGN — not defects (3).** `RPH_IDEMPOTENCY_DUPLICATE`: a replay returns `status: 'DUPLICATE'` with the prior result and **no error at all** (`command-bus.ts`), which is RPH-PER-002's ratified behaviour — an error code would be wrong. `RPH_EXTERNAL_OPERATION_UNCERTAIN`: JPWB is never in the path of an operation and hosts no tool invocation (the boundary the `RPH-EXE-004` register row argues at length). `RPH_VALIDATOR_INDEPENDENCE_VIOLATION`: `completeAssuranceAssessment` **advances the assessment to the ratified INDEPENDENCE_VIOLATION state** rather than refusing, and JPWB-DOC-003 ASR-13 calls that "recorded as a first-class outcome" — the register's `RPH-ASR-003` row disposes it as NOT_A_COMMAND_REFUSAL for exactly this reason. In all three the code's absence CORROBORATES a disposition already reached on other evidence.
  2. **UNUSED BECAUSE THE RULE IS UNENFORCED (2).** `RPH_POLICY_VERSION_MISMATCH` and `RPH_SUBJECT_VERSION_MISMATCH` occur only inside `packages/rph-assurance/src/assurance-rules.ts`, as a `reason` **string** on a boundary classification the floor path folds to INCONCLUSIVE — never as a refusal's `error.code`. These are the codes RPH-CON-006 and RPH-CON-007 name **in their own ratified statements**, and `RPH_SUBJECT_VERSION_MISMATCH` is the code `RPH-ASR-010` already discloses as belonging to a rule nothing enforces. Here the unused code IS the gap, seen from the contract side.
  3. **THE ACTUAL NEW FINDING — the refusal exists and reports a GENERIC code (2).** `promoteBaseline` (`handlers/governance.ts`) genuinely refuses both an invalidated-evidence promotion and a stale-decision-version promotion. Both carry `RPH_INVARIANT_VIOLATION`, and both encode the specific condition **in the message prose** — `INVALIDATED_EVIDENCE`, `STALE_DECISION_VERSION` — while `RPH_EVIDENCE_INVALIDATED` sits ratified and unused for precisely the first. A typed, classified error contract whose discriminating value travels in free text is asserting a status nothing performs (CON-000 B7), and it is not cosmetic: `classifyRefusal`'s `WRONG_CODE` verdict, the register's own instrument, cannot discriminate refusals that all report the same code, and no consumer can route on the contract.
- **What is NOT claimed:** which code the stale-decision refusal *should* carry, and whether `RPH_BASELINE_VERSION_MISMATCH` has an intended site at all, are judgments this entry does not make — `RPH_SUBJECT_VERSION_MISMATCH` is the obvious candidate for the first, but the ratified statements do not say so and inventing the mapping here would be the "convenient interpretation encoded as architecture" that §0.3 forbids.
- **Disposition:** Recorded, not fixed. Group 1 needs nothing. Group 2 is already carried by register rows (`RPH-ASR-010`, and `RPH-CON-006`/`-007` when that tranche lands) and will close when those rules do. Group 3 is a real, small remediation — change two `refusalCode`s — but it is a **behaviour change to a typed contract consumers may switch on**, it would invalidate the `RPH-BAS` family's existing probes and the `RPH-PWU-008` control (whose refusal is one of the two), and it owes a red-first test and a mutant like any other. Sequenced deliberately rather than as a rider.
- **GROUP 3, FIRST HALF — FIXED 2026-08-03.** The invalidated-evidence promotion refusal (`handlers/governance.ts`, `promoteBaseline`) now carries **`RPH_EVIDENCE_INVALIDATED`** instead of `RPH_INVARIANT_VIOLATION`. The code is one of the ratified fifteen, is categorised `ASSURANCE`, names exactly this failure, and until now was carried by **no refusal anywhere in the system**. The message is unchanged — the code says what kind, the prose says which evidence.
  - **Red-first, and asserted on the CONTRACT rather than on a string.** `baseline-invalidated-evidence.test.ts` was changed first and observed to fail (`expected 'RPH_INVARIANT_VIOLATION' to be 'RPH_EVIDENCE_INVALIDATED'`), then production was changed. It asserts the code **and** that `error.category` is `ASSURANCE` — `category` is derived from `ERROR_CODE_CATEGORY`, so a future fix choosing a different assurance code would still satisfy it, and a revert to the generic invariant code could not.
  - **The feared blast radius did not materialise, and the reason is checkable rather than lucky.** `STATUS_FOR_CODE` (`kit.ts`) has no entry for either code, so both yield `REJECTED`; `RPH-PWU-008`'s control — which *is* this refusal — is unaffected, and no enforcement-register row claimed the site (its marker `INVALIDATED_EVIDENCE` lives in the message, which is untouched). Full gate green with no probe edits.
- **GROUP 3, SECOND HALF — DELIBERATELY NOT FIXED, and this is a decision rather than an omission.** The stale-decision-version refusal keeps `RPH_INVARIANT_VIOLATION`. This entry already declined to invent its mapping ("What is NOT claimed", above), and acting on the obvious candidate would now cost something concrete that was not visible when this was written: **adopting `RPH_SUBJECT_VERSION_MISMATCH` here would falsify a standing register row's stated evidence.** `RPH-ASR-010` is disclosed UNENFORCED on the recorded census that the code "appears in exactly one non-test production site … NO HANDLER EVER REFUSES WITH IT" — and because that row is guarded by OBSERVED_ADMISSION rather than by a census, **nothing would have gone red**; the prose would simply have become untrue, which is the precise failure mode this programme keeps finding. One ratified code would also come to mean two different things (an assessment's subject version, and a decision's bound subject versions). Filed as **REG-E-022**.
- **Merge target:** Repository — `handlers/governance.ts` (invalidated-evidence code **LANDED**); the stale-decision code is held pending REG-E-022. `packages/rph-contracts/src/errors.ts` is unchanged — the codes are correctly ratified; what was missing is their use, and one of the seven is now used. **Status:** OPEN, NARROWED — groups 1 and 2 disposed, group 3 half-closed, remainder a sponsor question.

### REG-F-011 — The command envelope is never validated, and a malformed one can crash `Engine.dispatch`
- **Date:** 2026-08-02 (found while dispositioning RPH-CON-001; every claim below re-verified by the author's own dispatch, not accepted from the investigation) · **Type:** DIVERGENCE FINDING · **Class:** DOCS_STRONGER, with a **robustness defect** that is not a documentation matter at all.
- **Statement:** `command-bus.ts` validates **only `command.payload`**, against `COMMANDS[type].payload`. The ENVELOPE is validated against `DomainCommandSchema` **nowhere in production**: that schema has four references repo-wide, all inside `rph-contracts` (its own definition, the generated schema manifest, and its registration into `SchemaRegistry`) — and `SchemaRegistry` itself has no production consumer either. Measured by dispatching an otherwise-complete `CaptureIntent` with one envelope field removed at a time:
  - `commandSchemaVersion`, `targetAggregateType`, `targetAggregateId`, `idempotencyKey` — each omitted **entirely**, and the command is **ACCEPTED**.
  - An **undeclared envelope-level property** is **ACCEPTED**, although `DomainCommandSchema` is a `z.strictObject` and, asked directly, reports `unrecognized_keys`.
  - `issuedAt` / `issuedBy` are refused only **incidentally and downstream** — by the produced-state validation in `commitState`, on the OBJECT envelope paths `createdAt`/`updatedAt`/`createdBy`/`updatedBy` that `newEnvelope` copied them into. The command envelope is never the subject.
  - **`commandId` and `correlationId` each cause an unhandled `SqliteError` to ESCAPE `Engine.dispatch`** — `NOT NULL constraint failed: command_receipts.command_id` and `… domain_events.correlation_id`. **A throw, not a `CommandResult`.**
- **THE THIRD BULLET IS THE ONE THAT MATTERS, and it is not a contract-hygiene point.** `Engine.dispatch` is the engine's public entry point and its entire contract is that it RETURNS a typed, classified `CommandResult` — that is what `RphError` exists for, and what every caller including the demo's form actions is written against. A malformed envelope makes it throw a persistence-layer exception instead. Any caller that does not wrap the call in `try/catch` fails in a way the error contract says is impossible, and the classification (`VALIDATION` vs `INVARIANT` vs `CONCURRENCY`) that the contract exists to provide is absent exactly when it is most needed.
- **This does NOT falsify RPH-CON-001**, whose antecedent is a COMPLETE envelope and which the register disposes as `NOT_A_COMMAND_REFUSAL` — the statement is an acceptance and stays one. What the measurement shows is that the rule holds **vacuously at the bus** rather than because a command-schema check passed. Reading the contrapositive ("an incomplete envelope fails validation") as RPH-CON-001's statement would be the subject substitution this register already records three times — RPH-EXE-005 over STA-5, RPH-ASR-010 over the floor gate, and RPH-PWU-003 over a message that literally names its rule id.
- **A SEPARATE, LIVE MISCITATION, flagged because it is checkable and of the class this programme opens with.** `conformance-manifest.ts` cites RPH-CON-001's coverage as `packages/rph-contracts/src/envelopes.test.ts`, whose test asserts `ObjectEnvelopeSchema.safeParse(validEnvelope()).success` — the **Object** envelope, not the **command** envelope. That is a SUBJECT substitution, sibling to the LAYER substitution DS-001 §4 item 2 records. RPH-CON-002 was re-cited to a dispatch probe on 2026-08-02; RPH-CON-001 and RPH-CON-004 were not.
- **Disposition:** Recorded, not fixed, and the two halves should not be sequenced together. The **crash** is a small, contained fix (validate the envelope, or fail closed before the store) and deserves to move on its own merits with a red-first test — a test that asserts a `CommandResult` is returned, not one that pins the current throw. The **envelope validation** is a behaviour change that will refuse commands the engine currently accepts, so it needs a survey of existing callers and fixtures first; several test fixtures in this repository omit envelope fields today and would begin failing, which is the honest cost and also the argument for doing it.
- **THE CRASH HALF IS FIXED (2026-08-02), the other two are not.** `dispatch` now refuses a command whose `commandId` or `correlationId` is absent or empty, returning `VALIDATION_FAILED` / `RPH_VALIDATION_SCHEMA_FAILED` instead of letting a `SqliteError` escape. Deliberately narrow: it changes no accept/reject outcome for any well-formed command and is **not** envelope validation. The guard tests IDENTITY, not presence — `''` satisfies a NOT NULL column, so a presence-only check would leave a receipt keyed on nothing and let a second such command collide with it. Evidence: `packages/rph-application/src/command-envelope-identity.test.ts`, written against the CONTRACT (dispatch RETURNS; the result carries a classified code; a well-formed command is still ACCEPTED) rather than against a chosen error string, so a fix returning a different code would still satisfy it and a fix that kept throwing would not. Mutation-proved twice: removing the guard reddens all three cases, and weakening it to a presence-only check reddens exactly the empty-string case and nothing else.
- **Merge target:** Repository — `command-bus.ts` (crash half **LANDED**); still owed: the envelope validation itself, and `conformance-manifest.ts` for the RPH-CON-001 miscitation. `packages/rph-contracts/src/envelopes.ts` is unchanged — `DomainCommandSchema` is correct; what is missing is anything asking it. **Status:** OPEN, NARROWED — the contract violation (a throw where a `CommandResult` is promised) is closed; the unvalidated envelope and the miscitation remain.

### REG-F-012 — An idempotency key reused for a DIFFERENT command silently swallows it, and every column needed to refuse it is already stored
- **Date:** 2026-08-02 (found while dispositioning RPH-PER-002; observed by dispatch, not read) · **Type:** DIVERGENCE FINDING · **Class:** CODE_DIVERGES — canon states the refusal; the engine performs the opposite and reports success.
- **Statement:** **JPWB-DOC-003 §9 PER-5** has three clauses. The engine performs the first two and violates the third:
  1. *"Replaying a mutation with the same idempotency key returns the prior result and produces no additional domain event"* — **PERFORMED.** `command-bus.ts` step 1 returns status `DUPLICATE` carrying the prior receipt's `producedEventIds`; the event count is unchanged and the aggregate does not advance.
  2. *"Retries must never duplicate commits, … baseline promotions, approval decisions, or evidence records"* — performed by the same mechanism.
  3. **_"Reuse of a key with a different payload fails."_ — NOT PERFORMED, and its absence is not inert.** Measured: a `CaptureIntent` for aggregate `int_…FAV` was ACCEPTED under key `SHARED-KEY`; a **second, entirely different** `CaptureIntent` — different payload, different `intentId`, different `targetAggregateId` (`int_…FB0`) — reusing that key returned **`DUPLICATE`**, and `loadObject('int_…FB0')` is **`undefined`**. A real command creating a real object was **discarded**, and the caller was handed the *other* intent's event id as its result.
- **THE DETECTION MATERIAL IS ALREADY PERSISTED AND ALREADY RETURNED.** `command_receipts` stores `command_type`, `target_aggregate_id` and `result_hash`; `getReceipt` reads all three and `CommandReceiptRecord` carries all three; `command-bus.ts` step 1 discards all three and compares nothing but the key's existence. In the measurement above the stored `target_aggregate_id` (`int_…FAV`) and the second command's (`int_…FB0`) differ outright — the refusal PER-5 requires was one comparison away from free. This is the REG-F-010 shape (ratified material present, unread) with a live correctness consequence rather than a diagnostic one.
- **THE FAILURE IS SILENT AT EVERY LAYER ABOVE IT, which is what makes it worth its own entry rather than a note.** `DUPLICATE` is classified as SUCCESS by `Engine.dispatchBatch` (`r.status !== 'ACCEPTED' && r.status !== 'DUPLICATE'` is its only failure test), so a batch containing a key-colliding command **commits and reports `ok: true`**. Nothing logs a warning; `command.duplicate` is an `info`. A caller that generates idempotency keys from anything less than perfectly unique material — a retry wrapper keyed on a request id, a form action keyed on a form id, a seeding script keyed on an ordinal — loses commands and is told it succeeded. This is precisely CON-000 AX-8's "fail closed; escalate rather than invent" inverted: the engine invents an outcome for a command it never ran.
- **This does NOT change RPH-PER-002's disposition, and the distinction is deliberate.** That rule's own ratified statement is the OUTCOME half — *"emits no new domain events and returns the original result"* — which the engine satisfies; the register therefore disposes it `NOT_A_COMMAND_REFUSAL` and records the enforcement site. The refusal clause is **canon's addition**, so folding it into that row would let a rule whose own statement holds carry a disclosure about a different sentence — the subject substitution this register records four times over.
- **A LAYER CORRECTION FALLS OUT OF THE SAME MEASUREMENT.** The register's RPH-EXE-007 row said the adjacent idempotency guarantee "is covered at the store layer". The DECISION is at the **COMMAND** layer — `command-bus.ts` step 1, in `packages/rph-application/` — and only the receipt LOOKUP is the store's. Corrected in the same commit; a register whose entire purpose is layer precision may not be loose about its own.
- **Disposition:** Recorded, not fixed. The fix is small (compare `commandType`, `targetAggregateId` and a payload hash against the receipt before returning `DUPLICATE`; refuse on mismatch) but it is a **behaviour change that will refuse commands the engine accepts today**, so it takes the REG-F-011 treatment: a caller/fixture survey first, then a red-first test written against the CONTRACT — that a mismatched reuse is REFUSED with a classified code — rather than against a chosen error string. The refusal needs an error code; `RPH_IDEMPOTENCY_CONFLICT` is **not** among the ratified fifteen, so this also inherits REG-F-010's question of whether to carry the label in the message (the WP-11 discipline) or ratify a code.
- **Merge target:** Repository — `command-bus.ts` (the comparison), and a probe. JPWB-DOC-003 §9 PER-5 is unchanged and correct: canon already states the rule. **Status:** OPEN.

### REG-F-013 — An entire rule family is exempt from the conformance gate under a rationale that names a different concern, and that is stale regardless
- **Date:** 2026-08-02 (found while dispositioning RPH-PRJ / RPH-TRC / RPH-CMP) · **Type:** DIVERGENCE FINDING · **Class:** SEMANTIC_CONFLICT (a scope decision applied to the wrong subject) — with a **gate-exemption** consequence that outlives the misreading.
- **Statement:** `conformance-manifest.ts` records `RPH-CMP` as `status: 'DEFERRED'` with the note *"dual-run/shadow comparison classification — migration apparatus, explicitly OUT of 0.1.x (D2) / MP scope"*, and lists `RPH-CMP` in `DEFERRABLE_PREFIXES` — the set whose whole purpose is that the gate *"asserts nothing else sneaks into DEFERRED"*. So four ratified rules are permitted to be uncovered, by name, in the gate's own data. Both halves of the rationale fail:
  - **THE FAMILY IS NOT WHAT THE NOTE SAYS IT IS.** `RPH-CMP-001..004` are compatibility **MILESTONE** rules — *"derives compatibility milestone INTAKE = COMPLETE"*, *"phase is non-authoritative"*, *"ARCHITECTURE = COMPLETE while the root PWU is not complete"*, *"REPLAN derived from control action"*. None concerns dual-run, shadow comparison, or migration. The conformance catalog's OWN layer table puts `RPH-CMP` in layer 6 and describes it as *"the non-authoritative compatibility projection"*. **D2 is real and correctly recorded elsewhere** — the roadmap drops `RPH-DOC-009 §21–29 "Persistence, Migration, Dual-Run, Cutover"` under it — but DOC-009's dropped sections and the §22 compatibility-milestone rules are different subjects. The phrase "dual-run" appears nowhere in the JPWB corpus outside that roadmap row.
  - **AND THE EXEMPTION IS STALE EVEN ON ITS OWN TERMS.** The roadmap separately tags the M5 Compatibility projection *"conceptual only (D2)"*, which is presumably where the deferral came from. It is no longer conceptual: `packages/rph-projections/src/compatibility-view.ts` was **built in W2-INC-3 (WP-2-006)** as a real `Projector<V>` — `compatibilityProjector`, `milestoneByPwu`, `milestoneForKind` — folded from events, with `CompatibilityMilestone` a ratified contract enum, and covered by `traceability-compatibility.test.ts` and `projection-trace-compat.test.ts`. Its own header cites *"master invariant 11 — legacy phases SHALL become derived compatibility projections"*.
- **WHY THIS IS WORSE THAN THE MISCITATIONS THIS PROGRAMME HAS BEEN FINDING.** A wrong `testFile` cite still leaves the rule inside the gate, where the enforcement register can catch it — which is how RPH-PWU-010, RPH-PWU-007, RPH-CON-004 and RPH-PER-012 were all found. A `DEFERRABLE_PREFIXES` entry removes the family from the question entirely: nothing certifies it, so nothing can be caught over-certifying it. It is the one manifest defect the register's overclaim gate is structurally blind to, because there is no claim to over-.
- **This does NOT assert the four rules are unenforced.** The enforcement register disposes them in the same commit as this filing, on their merits and with their canon carriage (DOC-002 §8: *"Derived compatibility milestone where legacy support requires it; never ontology"*). What is asserted here is narrower and checkable: the REASON given for exempting them is about a different concern and is out of date.
- **Disposition:** Recorded, with the note corrected and `RPH-CMP` removed from `DEFERRABLE_PREFIXES` in the same commit — the correction is small, mechanical, and gated (the manifest's own shape test asserts nothing DEFERRED sits outside that set, so removing the prefix forces the status to move too). What is NOT done here, and is the real remaining work: the family's status becomes `PARTIAL` against what `compatibility-view.ts` actually asserts, and the W5 work package WP-5-003 (*"Compatibility Milestone Derivation"* — the versioned rules that advance a milestone as a PWU progresses through its axes) remains genuinely outstanding. That is a deferral with a named work package, which is what a legitimate one looks like.
- **Merge target:** Repository — `conformance-manifest.ts`. The roadmap's *"conceptual only (D2)"* row for RPH-DOC-005 should also be restated, since W2-INC-3 superseded it. **Status:** OPEN, NARROWED — the exemption is removed; WP-5-003 remains.

### REG-F-014 — An agent can manufacture human authority: the governance authority check reads a caller-supplied field that nothing binds to the actor supplying it
- **Date:** 2026-08-02 (found while dispositioning RPH-GOV-001; every step below OBSERVED by dispatch, not read) · **Type:** DIVERGENCE FINDING · **Class:** CODE_DIVERGES — and unlike this programme's other findings, the divergence is an **authority bypass in the governance plane**, not a coverage or classification defect.
- **THE OBSERVED SEQUENCE, in full, with no human actor at any point:**
  1. `ProposeDecision` — issued by an **AGENT** (`command.issuedBy.actorType = 'AGENT'`), payload `authority` naming a **HUMAN** (`h1`). → **ACCEPTED**.
  2. `ApproveDecision` on that decision — issued by the **same AGENT**. → **ACCEPTED**.
  3. Final stored state: `status: 'EFFECTIVE'`, `authority: { actorId: 'h1', actorType: 'HUMAN', displayName: 'Human' }`.

  The governed record now asserts that a human decided. No human did. The agent chose the authority by writing it into a payload field.
- **THE MECHANISM, and the fix is already written twenty lines away in the same file.** `packages/rph-application/src/handlers/governance.ts`:
  - `proposeDecision` sets `authority: p.authority` — **straight from the caller's payload**, with no reference to `command.issuedBy` and no check of any kind. `ProposeDecisionPayloadSchema` requires the field, so it is ratified; what is missing is any binding.
  - `requestWaiver`, in the same file, sets `authority: command.issuedBy` — **bound to the actual issuer**, and therefore not forgeable this way.
  
  Two governance handlers, the same `authority` field, two different provenance models. One is safe by construction and the other is not, and nothing marks the difference.
- **WHAT THE AUTHORITY CHECK ACTUALLY DOES, stated precisely because it is not vacuous — it is INVERTED.** `authorizeDecisionEffective` (`packages/rph-domain/src/governance.ts`) refuses with `RPH_AUTHORITY_INSUFFICIENT` when `authorityHeld` is false, and `authorityHeld` is computed in the handler as `authority?.actorType === 'HUMAN' || authority?.actorType === 'SYSTEM'`. Observed: a decision whose recorded authority is an AGENT **is refused**, status `UNAUTHORIZED`. So the guard fires exactly when the caller **declares** an insufficient authority — the honest case — and cannot fire when the caller declares a sufficient one. It stops the agent that says what it is, and not the agent that does not.
- **CANON STATES THE RULE THIS BREAKS, twice.** JPWB-DOC-003 §8 **ASR-15**: *"An agent may recommend a decision but cannot exercise authority unless delegated; no effective governance decision exists until an authorized actor decides… Authority is checked before effect… An approval whose actor, subject, subject version, type, and time cannot be identified is not authority."* And **OBJ-7** / CON-000 B7: *"Asserted status must be performed status… no provenance field populated by convention."* A caller-supplied `authority` field is precisely a provenance field populated by convention.
- **IT ALSO DEFEATS RPH-GOV-002 BY THE SAME ROUTE** — *"A Product Owner agent recommending approval creates no effective governance decision until an authorized actor approves it."* In the sequence above an agent produced an effective governance decision with no authorized actor. The two rules are one gap.
- **THE SHAPE IS FAMILIAR AND THAT IS THE ARGUMENT FOR TREATING IT AS SYSTEMIC.** RPH-EVD-001 records an agent's completion judgement travelling as a caller-typed boolean (`parentCompletionClaimSupported`) and being trusted. This is the same defect on a more dangerous field: an agent's claim about WHO HOLDS AUTHORITY, travelling as caller-typed data and being trusted. A survey of the remaining caller-supplied provenance/authority fields is the honest follow-up, not a point fix.
- **AND THE SURVEY HAS ITS SECOND HIT ALREADY, IN THE SAME HANDLER, ON THE SAME AGGREGATE.** Found while dispositioning RPH-GOV-003 (2026-08-02): `proposeDecision` PINS the subjects' semantic versions from the store — `subjectSemanticVersions: subjectVersions(ctx, p.subjectObjectIds)`, which reads each object's actual `semanticVersion` — and then `approveDecision`'s `extraMutate` **OVERWRITES that pin with the caller's payload**: `subjectSemanticVersions: p.subjectSemanticVersions`. So the version binding that RPH-GOV-003 (*"an approval of Architecture version 2 does not approve version 3"*) and canon ASR-15 (*"a decision approving version n never authorizes version n+1"*) both rest on is, at the moment of approval, whatever the approver says it is. The engine computed the true value one command earlier and discarded it. **Two caller-supplied facts — who holds authority, and which versions were approved — are trusted on the same aggregate, in the same file, in adjacent handlers**, and in both cases the engine had the honest value available. That is the argument for the survey being the unit of work rather than a patch to `proposeDecision`.
- **SCOPE, STATED FAIRLY.** This engine has no authentication layer, so `command.issuedBy` is caller-supplied too, and binding `authority` to it does not by itself make authority *verifiable* — it makes it *consistent*, and removes the ability to name one actor while acting as another. Full verifiability needs the platform tier the Charter allocates elsewhere (the same boundary RPH-EXE-004 records). That is a reason to state the fix's limit, not a reason to leave the two fields unrelated when one handler already relates them.
- **Disposition:** ~~Recorded, not fixed.~~ **THE FIRST INSTANCE IS FIXED (2026-08-03); the other four stand.** The prescription below was followed exactly, and is kept unstruck because it was right: *"a caller and fixture survey first, then a red-first test written against the CONTRACT (an agent cannot cause a decision to become EFFECTIVE on an authority it does not hold) rather than against a chosen message."*
  - **THE SURVEY, run before any behaviour changed**, by instrumenting `proposeDecision` across the whole suite rather than by reading call sites. Of **139** `ProposeDecision` dispatches, **137 already declared an authority equal to their issuer**. The two that did not were the *same* scenario written benignly — an AGENT authority declared on a HUMAN-issued command, in order to exercise the approval guard — one of them **this finding's own register probe**. No production caller declares a foreign authority, and the dangerous direction (a weaker actor naming a stronger one) occurred nowhere outside the demonstration of the bug.
  - **THE FIX REFUSES RATHER THAN BINDS.** `proposeDecision` now rejects when the declared `authority` is not the issuing actor, with `RPH_AUTHORITY_INSUFFICIENT`. Adopting `requestWaiver`'s silent bind was the other option this entry offered and is the weaker one: it would make a ratified, schema-required field decorative. Refusing keeps its meaning — the caller must state the authority, and what it states must be true. The test is **identity, not a ranking of actor types**: both directions are refused, because this repository has no ordering over actors and inventing one here would be the convenient interpretation §0.3 forbids.
  - **Red-first and contract-shaped.** `packages/rph-application/src/handlers/decision-authority-provenance.test.ts` was written first and observed failing on the two forgery cases **while both its controls already passed** — the shape that proves the controls discriminate. It asserts the OUTCOME ("an agent cannot reach an EFFECTIVE decision by either route"), not a message. Mutation-proved: neutralising the guard reddens exactly those three and leaves the controls green.
  - **The two adapted call sites are strictly more honest than what they replace** — the agent now proposes *as itself*, so a decision's recorded authority is an AGENT because an agent made it, not because a human said so. That is the sequence ASR-15 actually describes.
  - **THE LIMIT, restated because the fix invites overreading.** This engine has no authentication layer, so `command.issuedBy` is caller-supplied too. Binding the two makes authority **consistent**, not **verifiable**: it removes the ability to name one actor while acting as another; it cannot establish who is acting.
- **THE FIVE INSTANCES, and where each now stands.** The instrumented-survey technique that measured the first was reused on each; it is the reusable part of this entry.
  1. **`proposeDecision`'s `authority` — CLOSED 2026-08-03.** Above.
  2. **`approveDecision` overwriting the store-pinned `subjectSemanticVersions` — CLOSED 2026-08-03** as **REG-F-017**, which is a separate entry because the fix turned out to need the OPPOSITE remedy (an immutable pin, not a derivation) and because it uncovered that RPH-GOV-003's own probe was built on this defect.
  3. **`authorityDecisionId` — CLOSED 2026-08-03.** Three kernel arms drop or weaken a constraint on the strength of this id (`CONSTRAINT_WEAKENED_WITHOUT_AUTHORITY`, `INAPPLICABLE_WITHOUT_RATIONALE`, `WAIVED_WITHOUT_AUTHORITY`) and **every one tests only truthiness**, so a MANDATORY constraint could be declared INAPPLICABLE by citing a decision that named nothing. `buildConstraintInput` now RESOLVES it, and an id that does not load as an **EFFECTIVE** Decision is passed on as absent — so the kernel's existing ratified findings fire exactly as for a citation nobody made. *An authority that does not exist is no authority.*
     - **Resolved at the boundary, decided in the kernel** — the kernel is untouched. It cannot load objects and should not; its arms were correct and were being fed an unverified fact.
     - **EFFECTIVE, not merely present:** a PROPOSED decision has decided nothing, and ASR-15 checks authority *before* effect. Two mutants: reverting the resolution reddens both refusal tests and leaves the control green; weakening `EFFECTIVE` to mere existence reddens **only** the PROPOSED test, which is what that test exists to pin.
     - **Survey: exactly TWO dispositions in the whole suite carried an `authorityDecisionId`** — both the same literal, both naming an object the store had never held, and both **the enforcement register's own RPH-CNS-003 probe**. That probe now mints a real decision and approves it. A third register probe re-based onto a true premise in two days.
     - **Known imprecision, pre-existing and deliberately not widened:** `INAPPLICABLE_WITHOUT_RATIONALE` is the code the kernel emits for `!rationale || !authorityDecisionId`, so a caller who supplies a rationale and an unresolvable authority is told the rationale is missing. The code name was already wrong for that half before this change.
  4. **`ReshapePwu.triggeringObjectId` — SURVEYED 2026-08-03, and the answer was not the expected one: NOT A LIVE BYPASS, because nothing dispatches the commands that carry it.** Instrumented across the whole suite, `ReshapePwu` and `InvalidatePwu` produced **zero** dispatches. Censused against the ratified registry: of **84** command types, exactly **three** — `ChallengePwu`, `InvalidatePwu`, `ReshapePwu` — were named nowhere outside `rph-contracts`. Each had a live handler and a routable type, and none had ever been driven, so their preconditions, emitted payloads and event-gate conformance were all unobserved.
     - **So the field is unreachable rather than dangerous**, the same disposition shape as RPH-GOV-006's antecedent. The honest sequence is to drive the commands first and argue about the field once something asks for it. **All three are now driven** (`pwu.test.ts`), and `verif/command-dispatch-census.test.ts` keeps the count at zero with an **empty** exception list — the three were fixed by writing their tests, not by being listed.
     - **AND DRIVING THEM SURFACED SOMETHING BETTER.** `InvalidatePwu`'s handler resolves a command/event contract disagreement — the event types `triggeringObjectId` REQUIRED while the command types it optional — with `?? ''`. **Its own comment says defaulting to `''` "would fabricate a reference to nothing", and then the code does exactly that.** The branch had never executed, so the fabricated value had never reached the event gate; the empty string satisfies `z.string()`, so a governed `PwuInvalidated` event records a triggering object that is the empty reference. Pinned as an admission in `pwu.test.ts`: the day the contracts are reconciled it goes red and becomes the refusal.
     - **CLOSED 2026-08-04 for `InvalidatePwu`.** The handler now REFUSES an invalidation that names no trigger, and refuses one whose `triggeringObjectId` resolves to nothing — the same judgement `authorityDecisionId` got: a provenance field pointing at nothing is provenance to nothing. Two mutants, each firing on its own test and distinguished by message, so the presence check and the resolution check are independently load-bearing. `ReshapePwu` needs no change: its event types the field OPTIONAL and the handler correctly omits rather than fabricates.
     - **THE GENERAL RULE THIS SITE WAS BREAKING, worth stating because it has a blind spot attached: a handler that cannot emit a conformant event REFUSES the command; it does not invent a value.** And **the event gate is structurally blind to the violation** — it validates the emitted event, and `''` satisfies `z.string()`. A fabricated value is *well-formed by construction*, so a malformation check cannot see it. Combined with the command never being dispatched, the fabrication was written, shipped, and never once executed. The comment struck in place records that this repository *diagnosed the defect in prose and committed it on the next line*.
     - **Still OPEN, narrowed to the contract question alone:** the command types `triggeringObjectId` optional while the ratified event types it required. The handler now closes the gap by refusing, which is the safe reading; whether the *command* contract should be tightened (or the event loosened) is a ratification question, not a repository one.
  5. **`detectedConflicts` — OPEN, and NOT fixable by resolution.** The caller declares *which conflicts exist* and `evaluateRecomposition` reasons over that list. There is nothing to resolve: closing it means the engine DETECTING conflicts, which is a capability rather than a check — the same structural shape as RPH-GOV-006's missing waiver-to-promotion link. It should not be sequenced with the other four.
- **Merge target:** Repository — `handlers/governance.ts` (`proposeDecision`) **LANDED**; the four remaining provenance fields outstanding. JPWB-DOC-003 ASR-15 is unchanged and correct: canon already stated the rule. **Status:** OPEN, NARROWED — one of five closed. A **delegation record** remains a sponsor question and a new ratified shape: canon says authority may be *delegated*, and this repository has no object for that, which is why declaring an authority you are not is now refused rather than admitted on trust.

### REG-F-015 — A test file named for a rule proved nothing for months: it arranged no floor at all, and passed because the absence of a floor produces the same refusal as a scoped waiver
- **Date:** 2026-08-03 (found while dispositioning RPH-GOV-005; every claim below OBSERVED by instrumenting production and re-running, not read) · **Type:** DIVERGENCE FINDING · **Class:** ASSURANCE_DIVERGES — the code is correct; the evidence for it was not.
- **THE FILE.** `packages/rph-application/src/handlers/floor-waiver-scope.test.ts` existed to prove RPH-GOV-005 at the CALL SITE — *"a waiver for policy criterion AC-04 on Architecture version 2 does not waive another criterion, another object, or Architecture version 3"*. Its header said so, and one commit earlier (`f48b4412`) that header was itself corrected for a stale claim. **The prose was being repaired while the tests underneath it were proving nothing.**
- **THE OBSERVATION, in the order it was made.** A `throw` on the first line of `waiverCovers` — the predicate the whole file is about — **did not fire**. Both tests passed. Instrumenting one branch at a time found **three independent shields, each sufficient alone**:
  1. **The operative one.** The floor policies were never seeded. `RequestAssuranceAssessment` fails closed on a policy the store has never seen, so **every floor assessment was REFUSED and no assessment aggregate was ever created**. The file's local `recordFloor` helper asserted nothing on its dispatches, so a helper that recorded **no floor at all** was indistinguishable from one that recorded three.
  2. It recorded against the literal version `1`, while `DefinePwuType` raises the PWA to `2` — so even a created assessment would have been discarded by the version binding as stale.
  3. It recorded no observations, so `waiverDischargesFloorPolicy` returns at its *"nothing to waive"* branch before comparing any criterion.
- **WHY IT PASSED, and this is the part that generalises.** A PWA with **no** floor is refused publication for `MISSING` — which is also `REJECTED`, also `RPH_INVARIANT_VIOLATION`, also leaves `publicationStatus` at `VALIDATED`. Every assertion in the file was **TRUE**. They were true **about a different refusal**. This is not a weak assertion or a missing case; it is a correct assertion about an arrangement that was never built, and no assertion-strengthening would have caught it.
- **THE STRUCTURAL LESSON: a negative test needs a POSITIVE control on the same path.** Every test in the file asserted a REJECTED publish, and REJECTED is the *default* for an AI-produced PWA. Without one run that actually **PUBLISHES**, nothing in the file could distinguish *"the waiver was correctly refused"* from *"the arrangement never happened"*. The repaired file now leads with that control.
- **WHAT THE CENSUS OF LIMBS FOUND, once the tests could reach the code.** RPH-GOV-005 has three limbs and they are enforced by three different mechanisms — and the predicate that looks like it enforces all three does not:
  - **CRITERION** — `waiverCovers`' criterion conjunct. Genuinely decides, and `pwa-authoring.test.ts` proves it non-vacuously (control publishes, discriminator does not).
  - **VERSION** — `waiverCovers`' version conjunct. Genuinely decides, but **had no command-layer reader at all**: neutralising it reddened only the `rph-domain` kernel unit test. Now driven by this rule's dispatch probe.
  - **OBJECT** — **not** `waiverCovers`. Its `subjectObjectId` conjunct is a **tautology at the only production call site**: `effectiveFloorWaivers` builds the view with `subjectObjectId: subjectId`, the very value it is compared against, so the conjunct **compares a thing with itself**. The kernel test proves it computes correctly; nothing can ask it a question it could get wrong. This is DS-001's shape at **conjunct** granularity.
- **A FIRST READING OF THE OBJECT LIMB WAS WRONG, AND IS RECORDED AS WRONG.** Deleting `subjectObjectIds.includes(subjectId)` from `effectiveFloorWaivers` leaves **the entire suite green**, which reads as an unguarded bypass — a waiver naming another PWA discharging this one's floor. **It is not.** The limb is enforced twice and either site suffices: the filter, and redundantly the `?? -1` version fallback one argument along, because a waiver that does not name this subject carries no version entry for it. Proved by a **combined** mutant (filter → `false` **and** `?? -1` → a matching version), which does redden. **Redundant enforcement, not a hole** — and the single-line green was evidence of redundancy, never of a gap.
- **DISPOSITION — FIXED, not merely recorded**, since the defect is in assurance rather than behaviour and the repair carries its own evidence:
  - `floor-waiver-scope.test.ts` rebuilt: floor policies seeded, every arranging dispatch asserted, the subject version **read from engine state**, an OPEN finding recorded so there is something to waive — plus a positive control and three limb tests (**object**, **version**, **policy**), each carrying a **named predicted red** that was run and observed to fire.
  - The hand-rolled helper is replaced by `recordFloorAssessment` in `__tests__/floor-fixtures.ts`, which **throws on any non-ACCEPTED dispatch** and requires the caller to state the subject version. A fixture may not silently arrange nothing.
  - RPH-GOV-005's conformance cite is the **dispatch probe**, not this file. Had the file been cited on its face, the COVERED count would have risen on evidence that proved nothing — **the failure mode the layer gate cannot see**: it checks that a cite is COMMAND-layer, never that the arrangement was built.
- **THE SWEEP, RUN 2026-08-03 — and the corpus is CLEAN.** The general question was: how many other test files arrange less than they claim, and pass because the null arrangement produces the same refusal as the guarded one? Answered by measurement rather than by reading:
  - **The detector.** `Engine.dispatch` was wrapped so that a REFUSED result is returned as a Proxy recording whether anything about it is ever read. An unread refusal is a dispatch whose failure the test could not possibly have noticed. Name-agnostic by construction — it does not care what the local helper is called, which a grep-based version did.
  - **VALIDATED AGAINST A KNOWN POSITIVE FIRST**, because a detector with no proven catch is exactly the instrument this finding is about. Run against the pre-repair `floor-waiver-scope.test.ts`: **12 unread refusals**, every one a `RequestAssuranceAssessment`. A first, grep-based version of the detector **missed it** — it stripped comments in a way that shifted every line number, and the four "hits" it reported were coincidences. That miss is recorded because the corrected result is only trustworthy given it.
  - **THE RESULT: of 409 refusals across `rph-application` and `rph-engine`, six were never read — and all six were DELIBERATE.** Each was a command expected to be refused, with the assertion placed on its *effect* ("no partial write", "exactly one ACTIVE plan", "leaves the step not ready"), and each sat beside an explicit CONTROL. So the defect was singular, not systemic.
  - **The six were strengthened anyway**, because an effect assertion alone cannot distinguish *refused* from *accepted and did nothing* — and one of them (`command-reissue-guard`) would have passed **vacuously** had its arrangement failed, since `revision` would have been `undefined` on both sides. Each now asserts its refusal directly.
- **AND THE GUARD IS NOW STANDING, which is what turns this from a snapshot into a ratchet.** `verif/unread-refusal-guard.ts` is a vitest setup file wired into **every** package and app project (declared in `vitest.projects.ts`, so a new package cannot opt out by omission). It fails any test that leaves a refusal unread, naming the command, the target aggregate and the call site. **It carries NO allowlist** — the six sites were fixed rather than exempted, which is the property that makes it a gate. Its predicted red was run: restoring the pre-repair file reddens it with all six `RequestAssuranceAssessment` refusals named.
- **WHAT THE GUARD CANNOT SEE, stated because an unstated limit gets read as coverage.** It catches an arrangement that was **REFUSED and ignored**. It does **not** catch one that was **ACCEPTED and WRONG** — and this very file had two further shields of exactly that kind (the floor recorded against version 1 while the PWA had moved to 2; no observations recorded, so there was nothing to waive). The guard closes the shield that fired *first*, not the class. A detector for "accepted but wrong" is a harder instrument and is not claimed here.
- **Merge target:** Repository — done: `floor-waiver-scope.test.ts`, `__tests__/floor-fixtures.ts`, the six strengthened sites, and `verif/unread-refusal-guard.ts` + `vitest.projects.ts`. Canon is unchanged and correct: DOC-003 ASR-14 states the rule, and production honours it. **Status:** CLOSED for the refused-and-ignored class, which is gated repo-wide. The **accepted-but-wrong** class remains unmeasured and is named above rather than left implied.

### REG-F-016 — A dead-predicate guard could not see the wiring it existed to detect, and the gate that rejects unfalsifiable guards passed it
- **Date:** 2026-08-03 (found while checking whether the hollow-kernel triage's deferral list could be retired into the enforcement register) · **Type:** DIVERGENCE FINDING · **Class:** ASSURANCE_DIVERGES — the disclosure was true; the mechanism that keeps it true was not sensitive to its own falsifier.
- **Statement.** `RPH-DEC-004` was disclosed UNENFORCED with a `DEAD_PREDICATE` guard censusing **`intentDivergentChildIds`** — an **input field** of the dead domain composition `validateDecomposition`, not the composition itself. The row's own `why` explains the choice: the application handler exports a symbol of the same name, so a census over the composition returns four files and **looks wired** while the rule goes unenforced. The dodge was reasonable and it cost the guard its sensitivity — **wiring the composition does not make the field appear anywhere new**, so the census still returns one file and the row would stay green through the exact change that closes the rule.
- **DEMONSTRATED, NOT REASONED.** `validateDecomposition` was wired into `handlers/decomposition.ts` — a real call, compiling, executing on every `ValidateDecomposition` dispatch — and **all 2078 tests stayed green**. No gate anywhere noticed that the composition three register rows describe as unreachable had acquired a production caller.
- **THE REGISTER'S OWN "GUARD THAT CANNOT FAIL" GATE PASSED IT, and that is the part worth keeping.** `enforcement-register.test.ts` already rejects, by construction, a `DEAD_PREDICATE` whose baseline set contains the file the wiring would land in — the defect that made every RPH-EVD row un-censusable. It passed here, **correctly**: the baseline is a kernel file and no handler was in it. The gate models the wiring event as *"a handler comes to mention this symbol"*. The wiring event this row actually faces is *"a handler calls the function that READS this symbol"* — **one symbol away, and a census cannot see one symbol away.**
- **THE SIBLING GOT IT RIGHT, one row down.** `RPH-DEC-005` faces the identical name collision over the identical composition and answered it by guarding with **behaviour**, its row recording exactly why a census would be untrustworthy there. Two rows, one underlying dead function, two different answers — and only the behavioural one is sensitive. This is the same lesson REG-F-015 records from the other direction: the register's doctrine that "a disclosure guarded by behaviour is strictly stronger than a census, because it reddens on the behaviour changing rather than on a symbol moving" is right, and the exceptions are where the defects live.
- **FIXED.** `RPH-DEC-004` is re-guarded as `OBSERVED_ADMISSION`. The arrangement dispatches a decomposition whose child is proposed under a **second, foreign intent** and whose `intentMappings` declares it serves that foreign intent — divergence stated twice on the wire, read neither time — and the decomposition is marked **VALID** with no finding of any kind. The control declares the same divergence but leaves a mandatory parent obligation unallocated and **IS refused at the same site**, proving the validate path is live and simply has no limb for intent divergence.
  - **Predicted red, run and observed:** an additive mutant that refuses a child whose declared intent mapping names an intent the parent does not hold reddens **exactly `RPH-DEC-004`** and nothing else. The old census was insensitive to that same mutant.
- **WHAT THIS DOES NOT CLAIM.** The other four `DEAD_PREDICATE` rows were checked for the related weakness — a symbol reached only through an intra-module caller, which a file-granularity census also cannot see — and **all four are clean**: none of `capabilityAuthorized`, `classifyInterruptedAttempt`, `validateAssumptionReification` or `blocksIrreversibleWork` is called anywhere in its own defining file. The census arm is not condemned; one row's use of it was wrong.
- **Merge target:** Repository — `packages/rph-domain/src/enforcement-register.ts` (RPH-DEC-004's guard) and `packages/rph-application/src/handlers/disclosure-observed.test.ts` (its observation). **Status:** CLOSED for RPH-DEC-004. **OPEN as a general question:** no gate asserts that a `DEAD_PREDICATE`'s censused symbol is the symbol that would MOVE when the rule is wired, and that property is not mechanically checkable in the general case — which is the argument for preferring behavioural guards by default and treating each remaining census as a claim needing its own predicted red.

### REG-F-017 — RPH-GOV-003's stale-version scenario is unconstructible by honest means, and both its tests build it with the forgery REG-F-014 names
- **Date:** 2026-08-03 (found while surveying REG-F-014's SECOND instance for a fix; every number below measured by instrumenting the live handler across the whole suite) · **Type:** DIVERGENCE FINDING · **Class:** mixed — an assurance defect (two tests rest on a bug) and a reachability fact about the engine (a ratified rule's antecedent cannot be produced for its usual subject).
- **THE SURVEY, and it is the useful artefact.** `approveDecision`'s `extraMutate` writes `subjectSemanticVersions: p.subjectSemanticVersions` — the caller's number — over the pin `proposeDecision` read from the store one command earlier. Instrumented across the suite: of **132** `ApproveDecision` dispatches, **119** carried a payload agreeing with both the pin and the live store. The **13** that diverged split cleanly, and the split is what decides the fix:
  - **11 — the subject does not exist.** `pinned={}`, `live={}`, payload claims a version for an object the store has never seen. Whether a Decision may name a subject that was never created is a **separate** question; folding it in would bundle a second rule into this fix.
  - **2 — the deliberate stale-version arrangements.** `payload=2`, `pinned=1`, `live=1`: `baseline-stale-decision-version.test.ts` and the `promotionProbe('stale-version')` inside the enforcement register's own WP-16 probe map — **RPH-GOV-003's evidence**.
- **SO RPH-GOV-003'S TWO TESTS CONSTRUCT THEIR SCENARIO USING THE DEFECT REG-F-014 RECORDS.** The rule is *"an approval of Architecture version 2 does not approve Architecture version 3"*; the only way these arrangements make a decision bind a version the subject is not at is to have the approver **state a version that is not true** — the caller-supplied-fact bug, used as a fixture device. The refusal they prove is real. The premise they prove it from is a forgery.
- **AND THE HONEST ARRANGEMENT DOES NOT EXIST FOR A PWU.** Censused every `bumpSemanticVersion: true` and every explicit `newSemanticVersion` write: exactly three aggregates can ever move their semantic version — **INTENT** (`ReviseIntent`), **DECOMPOSITION_CONTRACT** (`ReviseDecomposition`) and **PROFESSIONAL_WORK_ARCHITECTURE** (the authoring commands, §10.1 L1379). **A PWU's semanticVersion is set to 1 at creation and no command ever changes it.** Both tests use a PWU subject. So for their subject the rule's antecedent — the subject moving on after approval — is **unreachable by construction**, which is why the forgery was needed to produce it at all.
- **THE OBVIOUS FIX IS WRONG, and this is recorded because it was implemented before it was rejected.** The natural remedy is symmetric with REG-F-014's first instance: stop trusting the caller, DERIVE the versions from the store at approval. Implemented, it passed 2086 tests and broke exactly the two sites above — and it is still wrong. **Deriving at approval time makes the engine perform the very laundering the rule forbids:** an approver who reviewed v1 and approves after the subject silently moved to v2 would be RECORDED as approving v2. The caller-supplied number would be replaced by an engine-supplied one that is equally untrue to what was reviewed. The distinction that saved this — a fact the engine OWNS should be derived, a fact it cannot compute should be refused — is right for `authority` and wrong here, because the version that matters is **the one that was reviewed**, not the one that is current.
- **WHAT THE FIX SHOULD BE.** The Decision's `subjectSemanticVersions` is set at PROPOSAL and is **immutable**: `approveDecision` must not write it at all. A payload disagreeing with the pin is refused (for subjects the pin covers — leaving the 11 above untouched). Staleness is then caught where the rule places it, at PROMOTION, by `decisionAuthorizesVersions` comparing the immutable pin against the subject's current version. No new check at approval is needed.
- **AND THE TESTS MUST MOVE TO A SUBJECT THAT VERSIONS.** With the forgery closed, the two arrangements can only be built over an INTENT, a DECOMPOSITION_CONTRACT or a PWA — approve at v1, move the subject, then promote. That is a materially better test than the one it replaces: it exercises the sequence the rule actually describes instead of asserting it from a false premise. It is not free: the WP-16 `promotionProbe` is shared by **four** rules (RPH-BAS-003/004/006 and RPH-GOV-003), so changing its subject touches all four probes.
- **Disposition:** ~~**Recorded, not fixed**~~ — **FIXED 2026-08-03**, in the increment after the one that filed it. The pause was deliberate and is left on the record: a first fix was written, measured, and withdrawn on its own merits, and the correct one changes a governance authority path and re-bases four register probes.
  - **The pin is immutable.** `approveDecision` no longer writes `subjectSemanticVersions`. It records what existed when the decision was **proposed** — what the approver reviewed.
  - **The payload keeps its meaning through a check, not a write.** An approval stating a version that is not the pin is REFUSED. Scoped to subjects the pin covers, so the 11 "subject does not exist" divergences are untouched and the separate question they raise stays separate.
  - **THE TWO PRODUCTION CHANGES ARE NOT INDEPENDENTLY OBSERVABLE, and the tests say so** rather than letting a reader assume otherwise. Once a disagreeing payload is refused, no accepted command distinguishes "keeps the pin" from "writes the payload" — they agree by construction. The single discriminating case is a subject the pin does NOT cover: the old code recorded the caller's claim for an object the engine had never seen; the new code records nothing. That is the third test in `decision-version-pin.test.ts`, and restoring the overwrite reddens **only** it.
  - **Both stale-version arrangements are re-based onto a subject that can actually move.** The decision now names the **INTENT** as a co-subject beside the baselined PWU, and the intent is genuinely revised after approval (`ReviseIntent`, semanticVersion 1 → 2). Each asserts the subject really moved, so neither can pass over an unchanged world. **This is the first time RPH-GOV-003's refusal has been proved from a true premise.**
  - **Three mutants, each fired and each on exactly its predicted test:** neutralise the payload-vs-pin refusal → the disagreement test only; restore the overwrite → the ghost-subject test only; neutralise `decisionAuthorizesVersions`' arm → **both** RPH-GOV-003 tests, which is the proof that re-basing the arrangement did not cost it its sensitivity to the rule it exists to prove.
- **Merge target:** Repository — `handlers/governance.ts` (`approveDecision`, and the shared approval precondition), `baseline-stale-decision-version.test.ts`, `execrem-wp16-enforcement-observed.test.ts`'s `promotionProbe`, and the new `decision-version-pin.test.ts`. Canon is unchanged and correct. **Status:** CLOSED. This was REG-F-014's second instance; **three stand** — `ReshapePwu.triggeringObjectId`, `detectedConflicts`, and `authorityDecisionId`, which is never resolved to a real Decision.

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

**Repository (raised 2026-08-03 from REG-F-010 group 3):**
- **REG-E-022** — Which ratified error code the **stale-decision-version** promotion refusal should carry. `promoteBaseline` refuses a promotion whose decision bound subject versions that are no longer current, and reports the generic `RPH_INVARIANT_VIOLATION` with `STALE_DECISION_VERSION` in the message prose. The sibling refusal beside it was moved to `RPH_EVIDENCE_INVALIDATED` on 2026-08-03 because a ratified code named that condition exactly; **no ratified code names this one**. `RPH_SUBJECT_VERSION_MISMATCH` is the obvious candidate and is deliberately not taken: it is the code `RPH-ASR-010`'s ratified statement claims for a **different** subject (an assessment's version binding), that rule is enforced nowhere, and its register row is disclosed on the recorded census that no handler refuses with the code — a census that adopting it here would silently make untrue, since the row is guarded by observation rather than by a grep. `RPH_BASELINE_VERSION_MISMATCH` (the other unused candidate, categorised INVARIANT) is about baseline versions, not a decision's bound subject versions. *Default: the generic code STANDS, and the condition keeps travelling in the message, until either a code is assigned to this meaning or `RPH-ASR-010` is enforced and its code thereby claimed. Recorded as a decision rather than left as silence, because "the codes are ratified and one is obviously close" is exactly the reasoning §0.3 calls a convenient interpretation encoded as architecture.*

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

### REG-D-023 — Ratification of JPWB-SPEC-001 v0.1.0
- **Date:** 2026-07-29 · **Type:** DECISION (sponsor conferral) · **Governs:** `JPWB-SPEC-001 Professional Projection and Workbench Surface — Deep Reference Specification`, **version `0.1.0` exactly**.
- **Decision:** **RATIFIED.** `JPWB-SPEC-001` v0.1.0 is recognized as a member of the `JPWB-SPEC-nnn` deep-reference tier established by REG-D-009 and recognized at CON-000 B1. Its obligations bind the surfaces named in its `Applies to` block. This entry is the individual ratification B1 requires, and it discharges the specification's own **D-12** ("Register entry filed"): it names the specification, its authoring grant of 2026-07-28 (the Constitution-Discussion ruling), its twenty-seven §11.4 forks — all ruled under delegated authority and recorded there — and an exact version.
- **The precondition, and how it was established.** §12.3 set the bar at **zero unbound authored obligations in §§0–10**. That criterion is met: every authored obligation in scope names a check in its own paragraph, re-derivable by `bun run spec:obligations`. The path to it is recorded in §12.5 and is itself part of what is being ratified: the residual was reported as 509, then 397, and was in the end **zero** — the figures were successive defects in the measuring script (a matcher blind to four of the document's own fixture namespaces; then a ±1-sentence window that could not reach a trailing `*Verification:*` clause and simultaneously credited each obligation with the *previous* one's fixture). The script now carries selftests for the matcher, the window, and each exclusion strip, and prints both windows so they bracket rather than assert.
- **Ratified WITH its recorded residue, not despite it.** §12.5.3 declares ten remaining detections, hand-classified as non-obligations (multi-line quotations of JCUX/RIWS/CPM master text, a fork-option continuation line, scope disclaimers, a recorded demotion, a Decision record, a table cell, and a record statement). They are deliberately NOT excluded: three further strips would drive the count to zero, and a count driven to zero by adding exclusions measures the exclusions. §12.5's other recorded residues — eleven §11.4 citation slips, two fixture ids with no §10 body (`SPEC-001-NF-76`, `-NF-77`), five unbound disclosure codes, and two §§1–10 corrections owed (§3.7's "thirty e2e specs" against 28 measured; §2.8.4's claim that DOC-003 carries no Question object, contradicted by `JPWB-DOC-003:84`) — are carried forward as editorial debt against v0.1.1. **None is a defect of an obligation**; ratifying with them declared is preferred to ratifying a version that claims to have none.
- **Consequences.** (a) The Reader's note is replaced and the status block reads `RATIFIED`; every `SHALL` in the document is now an obligation rather than a proposal. (b) `SPEC-001-CHK-DRAFT-CITATION` is **RETIRED by this conferral** — it exists solely to require citing sentences to carry the not-ratified status, and that requirement is now false. Its retirement is recorded rather than silent, because a check deleted without a record is indistinguishable from a check that was never run. (c) REG-D-009's pairing requirement stands: this specification is paired with the enforced repository artifacts its `*Verification:*` clauses name, and `JPWB-SPEC-001-DR-001` / `-DR-002` are the roadmaps that produced them.
- **What this does NOT confer.** It does not ratify `JPWB-SPEC-001-DR-001` or `-DR-002` (working references, not canon), does not settle REG-F-006's open DOCS_STRONGER component, and does not confer status on the Constitution-Discussion source documents (`JCUX`, `RIWS`, `CPM`), which remain outside the authority ladder pending the conferral sheet.
- **Merge target:** `JPWB-SPEC-001` §1 status block + Reader's note (landed with this entry). **Status:** EFFECTIVE.
