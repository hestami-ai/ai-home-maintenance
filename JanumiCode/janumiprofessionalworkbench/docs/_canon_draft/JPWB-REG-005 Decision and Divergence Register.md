---
artifactId: JPWB-REG-005
title: Decision and Divergence Register
layer: Register
settledness: LIVING
status: DRAFT — pending sponsor ratification
version: 0.1.0
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
ratification: PENDING — becomes effective via the sponsor's founding ratification act, recorded as this register's first post-draft entry; that same act makes the register the conferral mechanism for all other artifacts
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
- **Type:** `DECISION` | `OPEN QUESTION` | `DIVERGENCE FINDING`.
- **Status:** `OPEN` (live; any recorded safe default binds) · `DECIDED — MERGE PENDING` (ruled; not yet carried by an EFFECTIVE governing artifact — carriage in an unratified draft does not close an entry) · `MERGED` (closed; an EFFECTIVE, ratified governing artifact carries it) · `SUPERSEDED` (replaced by a later entry, cited).
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

### REG-Q-027 — One canonical chain-of-thought retention rule
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

### REG-Q-043 — Unknown enum value from a projection re-entering a canonical write
- **Statement:** Whether an unknown enum value read from a projection may re-enter a canonical write is unresolved (carried from JPWB-DOC-003 §11 item 6, which files it here).
- **Safe default:** Never — write-side strictness wins.
- **Merge target:** JPWB-DOC-003.

### REG-Q-044 — Reserved vocabulary for "authoritative": current state versus event history
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

*(This section is the only part of the register the synthesis program may rewrite before ratification; thereafter, append-only discipline applies to it as to all sections.)*
