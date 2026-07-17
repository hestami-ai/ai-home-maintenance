---
artifactId: JPWB-DOC-003
title: Semantic Model and Invariant Catalog
layer: Semantic Model
settledness: HYPOTHESIS
status: DRAFT — pending sponsor ratification
version: 0.2.0
date: 2026-07-16
governs: |
  - The meaning of the five-layer semantic model and its layer boundaries.
  - What each core professional object IS, its minimum rules, and its aggregate ownership.
  - Which relationships exist between objects, what they mean, and how traceability behaves.
  - What the state axes mean and which transitions are semantically legal.
  - What decomposition and recomposition conserve and what makes them valid.
  - The assurance model: the de minimis floor, Reasoning Review, validation dimensions,
    evidence admissibility, criteria, dispositions, independence, waivers, Decisions, Baselines.
  - Persistence semantics: single semantic authority, command/event asymmetry, event
    immutability, no-hard-delete, projections, and the governed professional stream.
doesNotGovern: |
  - Exact shapes: wire envelopes, JSON Schemas, enum spellings, ID prefixes, Command/Event
    names, error codes, table designs. The repository's generated contracts, schemas, and
    conformance tests are the sole shape authority.
  - Why the ontology has this shape, the operating rhythm of humans and agents → JPWB-DOC-001.
  - The naming and meaning of canonical terms → JPWB-DOC-002.
  - Agent conduct: intake, verification ladders, the divergence protocol → JPWB-DOC-004.
  - Vision, values, the rule of recognition → JPWB-CON-000.
  - Open questions and rulings → JPWB-REG-005.
precedence: |
  Owns the concern "semantic structure and invariants." On a question within that concern it
  controls over other artifacts and over the code during convergence, EXCEPT that a conflict
  with a higher-settledness artifact within this concern resolves in the higher class's favor
  (JPWB-CON-000 rule of recognition). Residual conflicts that none of these rules decide are
  filed as findings (JPWB-DOC-004). On a shape question it always defers to the repository.
changeProcedure: |
  HYPOTHESIS class. Changes flow through the divergence protocol (JPWB-DOC-004): classify,
  fix code toward canon where canon is stronger, escalate reality-taught candidates and
  semantic conflicts via JPWB-REG-005. No silent edits; every change traces to a register entry.
ratification: PENDING — becomes effective via REG-005 entry
---

# JPWB-DOC-003 — Semantic Model and Invariant Catalog

## 1. How to read this artifact

This artifact carries **meaning only**. Every statement here is a committed hypothesis: implement it faithfully, and treat friction against it as evidence to be filed, not annoyance to be coded around. The body speaks in the canonical voice of commitment; the status block above carries the epistemic frame.

Each invariant entry has a stable ID and states: the **invariant** itself; **WHY** — the concrete failure it exists to prevent; **SCOPE** — what it governs and does not govern; and, where over-application is plausible, a **NON-EXAMPLE** showing what the rule does *not* reach. An agent citing an invariant cites its ID.

**Shape cession.** Wherever this artifact names a state, disposition, relation, Command, or field, it names a *meaning*. The exact spelling, envelope, schema, and registry live in the repository's generated contracts and conformance tests, which are the shape authority. When this artifact and a generated contract disagree about a shape, the contract wins; when they disagree about a meaning, this artifact wins and the disagreement is a divergence to classify under JPWB-DOC-004.

Legacy invariant numbering (e.g., the "INV-5" label widely used for execution≠assurance) is retired with the source corpus. The corresponding meanings appear below under new IDs; STA-2 is the successor of INV-5.

## 2. The five-layer semantic model

Professional work in JPWB is modeled in five layers:

1. **Reality** — the external world being understood or changed.
2. **Cognition** — explicit understanding: Intent, Questions, Claims, Assumptions, models, Alternatives, Decisions, and confidence.
3. **Work** — bounded cognition and obligation, represented by PWUs.
4. **Coordination** — allocation, supervision, synchronization, reconciliation, synthesis, and escalation, represented by RPH behavior.
5. **Projection** — human- or machine-usable derived views.

**LYR-1 · Layers do not collapse.** An Observation of reality is not reality; a Representation is not the thing represented; a PWU is not its execution; a projection is not authority. The canonical model preserves the distinctions among professional work, execution strategy, runtime capability, assurance, evidence, governance, and presentation.
**WHY:** every historical failure mode of this system — workflow-engine reduction, green-run-equals-done, UI-state-as-truth — is a layer collapse.
**SCOPE:** governs the object model, state axes, and every API and store that carries semantic state. Does not forbid one service from *implementing* several layers; it forbids one object or field from *meaning* several layers.

**LYR-2 · Professional Work Objects are the authoritative state.** The authoritative state of an Undertaking is represented by Professional Work Objects and their relationships. Canvas nodes, Execution Workflow diagrams, chat messages, and legacy phase labels are projections or interaction surfaces, never the canonical source of truth.
**WHY:** prevents authority from migrating into whatever surface is most convenient to write, which is how dual truth begins.
**SCOPE:** governs where semantic reads and writes resolve. Does not forbid rich interaction surfaces or derived views; it forbids treating them as truth.

**LYR-3 · Presentation is meaning-inert.** No presentation operation may change semantic state or increment a semantic version. Layout has its own revision plane. No presentation contract may reference a Command capable of mutating PWU semantic state.
**WHY:** if moving a node can change meaning, meaning becomes unauditable and untestable.
**SCOPE:** governs canvas/layout/view-state operations and their contracts. **NON-EXAMPLE:** persisting layout and versioning it on its own presentation-revision axis is required, not forbidden — the rule bars *semantic* effect, not persistence.

## 3. Core objects and minimum rules

The core semantic objects and the minimum rule each must honor:

| Object | Meaning / minimum rule |
|---|---|
| **Intent** | Originating expression, formalized objective, outcomes, success conditions, boundaries, constraints, non-goals, ambiguity, approval state. The raw originating expression is preserved exactly; formalization is a later explicit act, never inference. |
| **Outcome** | Desired or observed change in reality, with beneficiary, criteria, time horizon, evaluation method. |
| **Stakeholder / Participant** | Affected party vs. contributing actor. Identity, role, accountability, and authority remain distinct. |
| **Question / Uncertainty** | What must be answered vs. the characterized limit of knowledge; both carry explicit state and impact. |
| **PWU** | A bounded professional obligation — intent, authority, boundaries, inherited constraints, expected outputs, evidence requirements, verification criteria, lifecycle, traceability. Never merely a task. |
| **Obligation** | A required professional condition that cannot disappear; satisfaction requires a supported Claim or a valid waiver/supersession. |
| **Constraint** | An authoritative limit with type, source, applicability, strength, status, propagation. Mandatory constraints cannot be silently weakened or dropped. |
| **Assumption** | An explicit condition believed or accepted for reasoning. Material Assumptions identify basis, risk, affected objects, verification need, lifecycle. |
| **Representation / Artifact** | Meaning-bearing externalization vs. its persistent embodiment. One Representation may have several Artifacts. Every Artifact has identity, provenance, semantic version, producing PWU, linked Claims, status, supersession, and a content hash where applicable. |
| **Claim** | An explicit assertion about completeness, correctness, compliance, consistency, fitness, preservation, feasibility, or performance. |
| **Evidence** | Admitted, provenance-bearing support or contradiction for scoped Claims, with limitations and validity. Generated output is not automatically Evidence. |
| **Confidence Assessment** | Qualified assessment with basis and limitations; never a substitute for Evidence, never an unexplained aggregate score. |
| **Assurance Assessment / Observation** | Version-bound evaluation of Claims under an Assurance Policy; what was detected and its professional implication. Observation, interpretation, and Claim remain separate. |
| **Reasoning Activity / Alternative** | Attributable method or analysis, and the candidate choices it considers. Preserves professional rationale, never private chain-of-thought (PER-12). |
| **Decision** | Authorized selection or disposition binding exact subject versions, alternatives, rationale, evidence, scope, effective time, and authority proof. |
| **Action / Execution Plan / Step / Attempt / Runtime Binding** | Authorized attempts to change reality; governed strategy; temporal operations; individual bounded tries; authorized capability grants. Technical success does not prove outcome success. |
| **Reconciliation** | Governed case that preserves prior state and resolves drift, contradiction, invalidated Assumptions, or changed reality through normal Commands — never ad hoc mutation. |
| **Decomposition / Recomposition Contract** | Explicit conservation and allocation of parent meaning, and the rules for reconstructing parent satisfaction. |
| **Baseline** | Immutable exact-version manifest — content hashes where applicable — plus evidence, assessments, decisions, purpose, scope, supersession. |
| **Narrative Memory** | Interpretive, provenance-linked account of evolution; never a replacement for canonical Events, objects, or Evidence. |
| **Attention Item** | Durable binding of a professional condition requiring judgment or action to the authority that must address it. Persists across restart until explicit disposition; the disposition vocabulary's meanings live here — addressed, delegated, deferred with an explicit review condition, accepted as risk, superseded — exact spellings are repository contracts (meanings NEW at drafting; confirm via REG-E-021). Ranked by professional consequence, not recency; a notification is delivery, not the item. Doctrine: JPWB-DOC-001 §7.4. |

**Common object contract.** Every authoritative semantic object carries: an immutable, opaque, globally unique identity and explicit type; a `revision` for every persisted change and a `semanticVersion` for changed meaning; an explicit lifecycle/validity state; creating/updating actor, time, and provenance; tenant and organization scope; authority or an authority reference where professional effect requires it; extensions only at declared, versioned extension points; and traceable prior/superseding versions. The registered identifier scheme and prefix registry are repository shapes.

**OBJ-1 · Semantic state is always explicit.** No semantic state may be inferred from null values, empty arrays, missing rows, absent output, legacy phase order, event ordering alone, UI position, or agent prose. Illegal or incomplete states are represented explicitly. An omitted optional field means the field is not part of that message — not unknown, false, empty, or inapplicable.
**WHY:** inference from absence turns every reader into an unversioned, disagreeing state machine.
**SCOPE:** governs semantic state wherever it is read or persisted. **NON-EXAMPLE:** this does not require every optional wire field to become a status enum; requiredness is justified only where absence would cause semantic ambiguity, never by implementer convenience.

**OBJ-2 · Versioning is multi-axis and never conflated.** `revision` counts persisted change (concurrency); `semanticVersion` counts changed meaning, obligation, assurance requirement, or authority. Contract-package and payload-shape versions are further distinct axes. Whether a given command is semantic is an explicit, tested judgment in its handler — objective, boundary, obligation, and decomposition changes are semantic; retries, layout moves, and formatting are not.
**WHY:** conflating the axes corrupts both concurrency control and version-bound authority — an approval that floats across meaning changes, or a meaning change hidden inside a mechanical save.
**SCOPE:** governs every authoritative object and every consumer of its versions. Exact version field spellings are repository shapes.

**OBJ-3 · Identity is opaque and immutable.** Identifiers are globally unique, immutable, opaque, independent of titles and hierarchy, and preserved across presentation changes. No meaning is parsed out of, or edited into, an identifier. Kind or label fields (`pwuKind` and its relatives) are descriptive discriminators, never type identity: type identity resolves by binding to a versioned PWA or a declared local extension.
**WHY:** meaning-bearing identity breaks the moment names change; kind-as-identity lets an unversioned string impersonate a governed type.
**SCOPE:** governs canonical identity and type resolution. **NON-EXAMPLE:** human-readable titles, slugs, and display names are encouraged — they simply are not identity.

**OBJ-4 · Material assumptions are reified.** A material assumption detected anywhere — including inside model prose — must become a first-class Assumption Object before dependent work reaches readiness. A critical assumption must be verified or explicitly accepted by authority before dependent irreversible work proceeds; falsification triggers impact analysis; expired assumptions stop authorizing work. Human acceptance yields ACCEPTED status, never VERIFIED.
**WHY:** prose-only assumptions are invisible to assurance, propagation, and impact analysis — they silently authorize work they were never entitled to authorize.
**SCOPE:** governs material assumptions. **NON-EXAMPLE:** not every hedging sentence in model output is a material assumption; materiality is judged by impact on obligations, constraints, or irreversible work.

**OBJ-5 · Claims mediate all completion.** Every completion assertion is represented as a Claim; an agent's statement that work is done is inert until reified as a governed Claim. An Obligation cannot become satisfied solely because a related PWU completed — satisfaction requires a supported Claim. A contested Claim cannot authorize baseline promotion unless resolved or waived.
**WHY:** without claim mediation, "the agent said so" becomes the acceptance criterion.
**SCOPE:** governs completion and satisfaction of governed work. **NON-EXAMPLE:** ordinary progress narration and intermediate tool chatter need no Claim objects; only assertions offered as grounds for satisfaction, admission, or promotion do.

**OBJ-6 · Artifact and Evidence are distinct statuses.** A produced thing is at most an Artifact. It becomes Evidence only through admission, which evaluates provenance, relevance, scope, and limitations. Evidence declares which claim it supports, what it does not establish, its provenance, scope, validity, and limitations.
**WHY:** treating everything produced as evidence is how generated prose certifies itself.
**SCOPE:** governs evidentiary status. Admission mechanics are Command/contract shapes.

**OBJ-7 · Asserted status must be performed status.** No object or field may claim a status its relations do not perform: no policy object the runtime never reads, no provenance field populated by convention, no assurance represented by an unread flag. A governed object that nothing consults is a defect, not documentation.
**WHY:** the current code's seeded-but-never-read policy objects and theatrical `sourceSection` provenance proved that asserted-but-unperformed status actively lies to both agents and humans.
**SCOPE:** governs every object claiming governing, provenance, or assurance status. This is the semantic-model application of the constitutional anti-vacuity clause (JPWB-CON-000). **NON-EXAMPLE:** a ratified-but-not-yet-wired capability is legal when its status says so — the violation is claiming LIVE governance that is not exercised.

## 4. Aggregate boundaries

The runtime uses five principal aggregates:

- **Work**, rooted at a PWU Instance: intent reference, PWU, obligations, constraints, assumptions, decomposition/recomposition, work transitions.
- **Assurance**, rooted at an Assurance Assessment: claims, evidence references, policy, observations, disposition, waiver references.
- **Execution**, rooted at an Execution Plan: steps, attempts, results, retries, tactic state.
- **Governance**, rooted at a Decision: approvals, rejection, waivers, escalation, revocation, promotion authorization.
- **Baseline**, rooted at a Baseline: exact items, evidence/assessment package, status, supersession.

The enclosing PWA definition and Undertaking identity remain explicit even when their management contracts are implemented by adjacent services; they are not replaced by the Work Aggregate or by an Execution Workflow.

Within and across aggregates, ownership and reference are distinct semantics. An **owned** object's lifecycle is governed by its containing aggregate: the owner controls its creation, deletion, and replacement. A **referenced** object has externally governed identity: it is never mutated through the containing aggregate, and appearing expanded inside a projection never confers ownership. The `Owned<T>`/`Reference<T>` encodings are repository shapes; these meanings govern them.

**AGG-1 · Cross-aggregate change flows through Commands and Events.** One aggregate never directly mutates another's internal state. Cross-aggregate flows use Commands, Events, durable processes, compensation, and reconciliation — not direct table mutation, and not one broad transaction constructed to simulate workflow atomicity.
**WHY:** direct cross-aggregate mutation destroys the invariant-enforcement point; simulated atomicity hides partial failure instead of representing it.
**SCOPE:** governs semantic writes across aggregate boundaries. **NON-EXAMPLE:** a semantic PWU being one coherent user concept does not require one giant transactional record; aggregate decomposition of storage is free provided the command/event boundary holds.

## 5. Relationships and traceability

**REL-1 · Relations are typed, directed, attributable, and version-aware.** Generic unlabeled links are insufficient for authoritative reasoning. The stable relation vocabulary covers these semantic families: derivation and refinement (one meaning produced or sharpened from another); decomposition and allocation (parent meaning distributed to children); satisfaction and dependency (obligation discharge; required ordering); constraint, propagation, and assumption (authority and premises made portable); production and implementation (who made what; what realizes what); support, contradiction, verification, validation, and invalidation (the assurance epistemics); governance, approval, supersession, and promotion (authorized acts over exact versions); impact, realization, and definition (consequence and type binding). The MEMBERSHIP of this vocabulary is semantic and canon-governed — adding or removing a relation type is a change to this artifact via the divergence protocol; only its exact spellings and registry encoding are repository shapes. A relationship is never inferred from graph position, and these distinct meanings are never rendered as one generic edge.
**WHY:** authority requires being able to ask *why* an edge exists; an untyped graph can only answer *that* it exists.
**SCOPE:** governs relations used for authoritative reasoning. **NON-EXAMPLE:** scratch notes, UI adjacency, and exploratory sketches may link freely — they simply carry no authority.

**REL-2 · Edge endpoints carry epistemology.** Support relations originate only from Evidence or Assessments and target Claims; verification relations originate only from Assessments. What may support, and what may verify, is fixed by type.
**WHY:** endpoint typing is what stops prose from supporting a claim and stops a producer from verifying itself by assertion.
**SCOPE:** governs the assurance-relevant relation types. Exact type rules per relation are contract shapes.

**REL-3 · Trace links are immutable; corrections supersede.** A trace link is never silently rewritten; a correction creates a superseding link and preserves the old one. Invalidated source objects may invalidate downstream trace claims.
**WHY:** editable history is no history; a tamper-evident trace is the substrate of every audit answer the system promises.
**SCOPE:** governs authoritative trace records.

**REL-4 · The traceability spine is continuous.** Every authoritative baseline exhibits the unbroken typed chain: originating expression → approved Intent → work (PWU) → Artifact → Claim → Evidence → Assurance Assessment → Decision → Baseline. An artifact with no producing PWU fails validation.
**WHY:** the system's entire promise is that acceptance is *explainable*; one missing link converts justified confidence into vibes.
**SCOPE:** governs authoritative baselines and the objects on the spine. It does not demand the full spine for provisional, exploratory, or rejected material — those must merely be honest about their status.

## 6. State axes and transition guards

Every PWU carries four orthogonal state axes: **work lifecycle**, **execution state**, **assurance state**, and **shape-integrity state**. At birth the axes initialize independently (proposed; not planned; unassessed; unknown). These four axes realize the Shape, Execution, and Assurance concerns of the constitutional five (JPWB-CON-000 AX-1) plus work lifecycle; the Governance and Baseline concerns are carried by the Governance and Baseline aggregates and their relations to the PWU (§4), never as additional PWU status fields. Decompositions, recompositions, plans, runtime bindings, assessments, and baselines carry their own explicit state sets. All exact state enumerations and the closed transition/guard tables are repository shapes; the meanings and guards below are semantic requirements those tables must implement.

The later cognitive-focus model (intent/understanding/representation/reasoning/decision/action/observation/reconciliation) is an additive viewpoint, not a replacement lifecycle; no alternative lifecycle may be implemented alongside the canonical axes.

**STA-1 · The four axes never collapse.** Execution, assurance, shape integrity, and work lifecycle are independent axes, never summarized into one status field, one progress bar, or one boolean.
**WHY:** every collapse re-creates the legacy phase machine, where "done" simultaneously meant executed, checked, and accepted — and therefore meant none of them.
**SCOPE:** governs semantic state representation and every projection that renders it: execution success and assurance satisfaction must remain visually distinct. **NON-EXAMPLE:** a *derived* rollup view for humans is legal — provided it is a projection, cannot be written, and does not display an unqualified "complete" while any axis is unresolved.

**STA-2 · Execution success never confers satisfaction.** (Successor of legacy INV-5.) Execution success moves work toward evidence and assurance, never directly to satisfaction. Step success does not imply PWU success; all-steps-succeeded leaves assurance unassessed until required policies complete; a baseline cannot be promoted solely because all execution steps completed.
**WHY:** this is the single inequality the whole harness exists to defend — an agent producing output and an authority accepting the work are different claims.
**SCOPE:** governs every transition from execution outcomes to satisfaction, recomposition, or promotion. **NON-EXAMPLE:** it does not make execution state meaningless or demand a human review of every trivial step — it bars execution outcomes from *self-certifying* professional satisfaction.

**STA-3 · Satisfaction requires the full triad.** A PWU may become satisfied only when execution succeeded, required evidence is admitted, and all mandatory assurance assessments are satisfied. Any rejected mandatory assessment blocks satisfaction.
**WHY:** dropping any leg reduces satisfaction to one of its proxies.
**SCOPE:** governs PWU satisfaction. Waived and superseded dispositions participate only through their governed forms (ASR-14 for waivers; ASR-12 for supersession).

**STA-4 · The illegal-transition set is absolute.** Proposed work cannot execute; shaping work cannot be satisfied; executing work cannot be satisfied without assurance; failed work cannot become satisfied; conditionally satisfied work cannot enter recomposition or baseline promotion (DEC-6, ASR-9); invalidated work cannot be baselined; superseded work cannot execute; baselined work cannot re-enter execution without a successor revision or successor PWU.
**WHY:** each of these is a shortcut some implementation has tried; each guard names a specific laundering path.
**SCOPE:** governs the canonical transition tables. The exact table is a repository shape; these meanings constrain it.

**STA-5 · Readiness is a substantive shape gate.** A PWU enters readiness only when its shape readiness profile is satisfied: one clear professional objective under at least provisional Intent (or explicit exploratory authority); explicit in-scope/out-of-scope boundaries or explicit unknowns; mandatory obligations, constraints, material assumptions, dependencies, and responsible authority; required inputs, expected outputs, at least one completion claim or verification criterion, and the applicable risk/assurance profile.
**WHY:** readiness-as-status-flip is how unbounded work acquires the authority of bounded work.
**SCOPE:** governs the ready transition. **NON-EXAMPLE:** completeness is risk-relative — the gate demands sufficiency for the next authorized activity, not exhaustive specification before any useful work.

**STA-6 · Intent maturity gates work maturity.** A root PWU cannot enter readiness without at least provisional Intent, and cannot become authoritatively satisfied without approved Intent (or a result explicitly marked provisional). An intent cannot be deleted after downstream PWUs exist; a superseded intent cannot authorize new PWUs.
**WHY:** work satisfied under unapproved intent is an answer to a question nobody authorized.
**SCOPE:** governs root PWUs and intent lifecycle. Exploratory work under provisional intent is legal; claiming a production baseline from it is not.

**STA-7 · Invalidation is first-class and satisfaction is revocable.** Falsified material assumptions, violated conditions, upstream semantic change, and post-recomposition sibling conflict route satisfied work into reshaping or invalidation. An invalidated or semantically changed satisfied PWU cannot be baselined without reassessment. Automatic invalidation is conservative where consequences are high — flag for review rather than cascade destructively.
**WHY:** a system whose satisfaction cannot be revoked by changed reality is asserting knowledge it does not have.
**SCOPE:** governs reaction to falsified premises. History is never rewritten by invalidation — the record of prior satisfaction stands (PER-2).

**STA-8 · Execution Plans are governed strategy — exclusively current and bounded in power.** A PWU has at most one active Execution Plan; a superseded plan spawns no new steps and no new execution attempts. Execution requires an approved plan and authorized Runtime Bindings, and high-risk irreversible execution requires plan approval before it begins. A plan cannot change Intent or Obligations, grant its own privilege, bypass assurance, or make superseded work executable. Skipping a mandatory plan step is a governed act requiring an authorized plan revision or waiver, never a silent omission. Plan revision supersedes the prior plan and preserves its attempt history.
**WHY:** a stale or parallel plan is work proceeding under strategy nobody currently authorizes; a silently skipped mandatory step is laundered de-scoping.
**SCOPE:** governs Execution Plan currency, powers, and the plan→step→attempt boundary. Uniqueness and approval enforcement mechanics are repository shapes. **NON-EXAMPLE:** revising a plan is legal and expected — supersede, approve, proceed; only beginning new work under the superseded plan is barred.

## 7. Decomposition and recomposition

Recursion exists at two levels and never collapses: at PWA-design time, PWU *Types* compose recursively into explicit leaf types; in an Undertaking, PWU *Instances* decompose under Decomposition Contracts and recompose. "Sub-PWU" is not a separate entity: each child is a full PWU with its own bounded objective, lifecycle, evidence, assurance, and recomposition contribution. Composition is not timing: prerequisites, dependencies, semantic progression, produced-input relations, and temporal execution steps are modeled as those relations — never mislabeled as parent/child decomposition.

**DEC-1 · The PWU boundary test.** Do not create a PWU for prompt rendering, retrieval, an API call, formatting, a database write, a retry, or a UI click. Those are execution steps unless they independently carry professional meaning, obligation, evidence, and lifecycle. Prefer children representing coherent professional obligations over generic activity labels (analyze/design/write/review are steps, not children).
**WHY:** step-shaped PWUs dissolve the model into a task tracker and drown assurance in noise.
**SCOPE:** governs what may be a PWU. **NON-EXAMPLE:** a retrieval task that independently carries a professional obligation — e.g., a governed evidence-gathering effort with its own claim and criteria — is a legitimate PWU.

**DEC-2 · Decomposition is a Claim with a mandatory contract.** A decomposition asserts that children collectively cover their parent. It records: parent and child identities; rationale and inherited intent mappings; allocation or retention of every mandatory parent obligation; the disposition of every applicable mandatory constraint; material assumptions and affected children; sibling identities, dependencies, and coordination rules; coverage claims and validation status; and a recomposition strategy. A decomposition is incomplete until it explains how child results will establish the parent claim. Decomposition classified high-risk by the applicable risk/assurance profile requires independent validation (ASR-13 governs what counts as independent). Revising a decomposition is legal, changes the parent's semantic version, and triggers impact analysis.
**WHY:** without the contract, decomposition is where meaning silently leaks — the single largest loss surface in the model.
**SCOPE:** governs instance decomposition. Anti-premature-decomposition applies: do not decompose when parent intent is too ambiguous, boundaries are unstable, or decomposition would create false precision.

**DEC-3 · Obligation conservation.** Mandatory parent obligations = allocated to children + retained by parent + already satisfied + explicitly waived/superseded by valid authority. No mandatory obligation silently disappears; an unallocated mandatory obligation invalidates the decomposition and blocks child execution. A child satisfies a parent obligation only through explicit allocation.
**WHY:** obligations that vanish in decomposition reappear as production incidents.
**SCOPE:** governs every decomposition, revision, and delegation. **NON-EXAMPLE:** moving an obligation is unrestricted — allocation, retention, and authorized waiver are all legal fates; only silent loss is illegal.

**DEC-4 · Constraint exhaustive disposition.** For every mandatory parent constraint, exactly one holds per relevant child: propagated (retaining authority and strength); retained at parent level; marked inapplicable with rationale; waived through authority; or superseded by a stronger constraint. No silent omission; no unauthorized weakening — a model proposing to soften a mandatory constraint to advisory is rejected without authority. Material assumptions propagate when applicable; sibling dependencies are explicit.
**WHY:** constraints are the user's authority made portable; silent drop during decomposition is unauthorized de-scoping.
**SCOPE:** governs decomposition, delegation, semantic revision, and context assembly (a context omission must not silently remove a mandatory constraint).

**DEC-5 · Children cannot enlarge scope.** A child PWU introducing work beyond parent intent without authorization is a divergence: the decomposition is rejected or routed to human decision. Scope expansion disguised as helpfulness is a named failure mode, not a virtue.
**WHY:** scope drift compounds recursively; a 5% enlargement per level is a different product three levels down.
**SCOPE:** governs child intent relative to parent intent. Proposing an enlargement through the governed feedback channel is legal; embedding it is not.

**DEC-6 · Recomposition is a judged act, never a sum.** "All children completed, therefore parent satisfied" is always invalid. The only valid inference is: assured required child results + mutual compatibility + preserved parent constraints + sufficient combined evidence → parent *may* be satisfied. "Assured required child results" excludes conditionally satisfied dispositions: a conditionally satisfied child contributes to recomposition or promotion only through an explicit, policy-permitted act that closes its condition (STA-4, ASR-9). Recomposition checks required child state and assurance, unresolved findings, contradictions among child outputs, obligation coverage, constraint preservation, artifact/interface compatibility, integration evidence, child-evidence support for the *parent* claim, and parent-level fitness with residual uncertainty. Recomposition may fail even when every child is individually satisfied; a recomposed result requires an explicit assessment.
**WHY:** the whole is an emergent claim; completion-counting is the most seductive collapse in the model because it is almost always locally plausible.
**SCOPE:** governs parent satisfaction from children. **NON-EXAMPLE:** it does not require re-executing children or re-litigating their local assurance — it requires judging the *composition*.

## 8. The assurance model

### 8.1 The division of powers

**ASR-1 · Evaluate, dispose, decide — three separated powers.** A Validator is a replaceable implementation of a versioned Assurance Policy: it evaluates identified Claims against identified Evidence and returns schema-conformant findings and a *recommendation*. The Assurance Service validates the result, enforces policy, and records the authoritative disposition. That disposition does not authorize acceptance, waiver, risk acceptance, or promotion — Governance Decisions do. Validators never mutate professional state, never return only prose/pass-fail/unscoped confidence, and validator output never grants permissions. Policy applicability and disposition rules are declarative data evaluated by the engine, never executable code; the exact expression language is a repository shape.
**WHY:** collapsing evaluator, judge, and authority into one actor is how a fluent model opinion becomes an unappealable verdict.
**SCOPE:** governs the assurance control path end to end. Policy meaning is stable across validator replacement: prompts, models, and deterministic checks are runtime assets of the policy, never the policy itself.

**ASR-2 · The service re-derives; it never rubber-stamps.** The Assurance Service rejects a validator result when identity, policy version, assessment identity, or subject semantic version mismatch; when required criteria are missing; when referenced evidence is absent or invalidated; when the disposition contradicts mandatory policy rules; when output fails validation; or when independence is unsatisfied. A recommendation of satisfied with a mandatory criterion unmet is rejected. Partial output — an unanswered mandatory criterion — is invalid output.
**WHY:** an unchecked recommendation path reduces the three powers of ASR-1 back to one.
**SCOPE:** governs acceptance of every validator result. The exact gate list and error codes are repository shapes.

### 8.2 The de minimis floor and Reasoning Review

**ASR-3 · The de minimis assurance floor is unconditional.** Risk proportionality governs assurance *above* a mandatory floor; it never makes the floor optional. Every material professional transformation receives, in order: (1) strict output-contract validation plus applicable deterministic invariants; (2) identity, semantic-version, provenance, authority, and trace completeness checks; (3) a Reasoning Review Assessment when the transformation is produced or materially shaped by an AI/agent; (4) canonical admission/disposition and enforcement of the protected downstream transition. No PWA profile, low-risk classification, planner optimization, or local agent instruction may suppress the floor. Deterministic failure may short-circuit an obviously invalid candidate, but its repaired successor must still receive Reasoning Review before admission. A missing, stale, malformed, failed, unavailable, or independence-invalid required review cannot satisfy assurance or permit its protected transition.
**WHY:** proportionality without a floor decays into exemption-by-classification — every result becomes "low risk" under deadline pressure.
**SCOPE:** governs material transformations. A result is material by default when it creates or changes professional content, supplies a downstream actor, proposes a Claim or Evidence, changes decomposition, contributes to a Decision/Baseline package, or supports a governed transition. Each independently downstream-consumable result is its own transformation boundary unless an explicit grouping records every covered subject and version and its rationale; one PWU-level review never substitutes for exact per-output assessment. **NON-EXAMPLE:** a transformation established as losslessly semantically equivalent by a *versioned rule* (not the producer's own say-so) is nonmaterial and needs no Reasoning Review; ambiguity resolves to material.

**ASR-4 · Reasoning Review is a contracted policy concern, not a second prompt.** Reasoning Review is a versioned Assurance Policy implemented by a replaceable Validator. It binds the exact subject, input/context versions, producing attempt, policy versions, and available evidence; evaluates observable derivational integrity (unsupported assumptions, invalid or circular inference, scope/authority confusion, contradiction, premature convergence, completeness shortcuts, unacknowledged uncertainty, evidence misuse or omission); records considered/rejected/missing evidence, findings, limitations, and uncertainty through the normal contracts; and prohibits same-invocation self-review — at minimum a distinct evaluator invocation, role, and review context whose actual identities and lineage are recorded. It reviews professional rationale summaries, outputs, and authorized tool-call records.
**WHY:** informal second-prompt review has no version, no independence, no record, and no authority — it is assurance theater.
**SCOPE:** governs review of AI-shaped material transformations. **NON-EXAMPLE:** Reasoning Review never requires soliciting or consuming private chain-of-thought; it operates on observable trace data. Retention and flow of volunteered model reasoning is PER-12; the conduct-side §9.7-class over-application lesson is JPWB-DOC-004's.

**ASR-5 · Three validation dimensions; coverage is planned, gaps are never silent.** Every material concern is analyzable across intrinsic (is the subject adequate on its own terms?), derivational (was it legitimately derived from intent, sources, constraints, evidence?), and systemic (does it cohere with related work, dependencies, consumers, policy, history?) dimensions. These are coverage questions and policy rationale, not wire enums or state axes. Above the floor, each material boundary has an explicit risk-derived coverage decision; required, inherited, deferred, waived, and inapplicable additional coverage are explainable. A high-quality artifact can be the wrong artifact; individually valid parts can be jointly impossible. Validation is inquiry, not rule-matching: a signal is not a defect; professional principles may legitimately conflict, and conflicting valid principles are preserved as explicit tensions, never silently resolved; "rule violated → reject" is sufficient only for an explicit hard invariant. A policy criterion retains the epistemic status of the professional knowledge it encodes — a prohibition may block, a heuristic raises a question, a smell triggers investigation without presuming a defect. Formalization never upgrades epistemic authority: a compiled smell remains a signal, a heuristic remains defeasible, a correlation does not become causation, and an organizational preference does not become a universal invariant.
**WHY:** unnamed dimensions produce accidental coverage — everything intrinsically checked, nothing derivationally or systemically checked.
**SCOPE:** governs assurance design and coverage planning. **NON-EXAMPLE:** it does not command running every validator at every step or one universal critic; it commands the floor plus controls matched to the exact risk.

### 8.3 Evidence

**ASR-6 · Evidence admissibility is gated.** Evidence is admissible only when its identity is stable; provenance is present; content or reference is available; scope is stated; limitations are recorded; it is not invalidated; it is current per the assessing Assurance Policy's declared currency requirement (absent one, currency is a judgment recorded in the admission); and it is relevant to the assessed claim. Evidence cannot support a claim outside its declared scope without an explicit assessment.
**WHY:** un-scoped evidence supports everything, which is to say nothing.
**SCOPE:** governs admission and use of evidence.

**ASR-7 · Existence is not proof.** An execution trace proves execution occurred, not that the outcome satisfies intent. A test result proves only its scoped behavior; test count is not test adequacy; passing tests support only claims within their scope. A citation proves a source said something, not that it is correct. A validator opinion is evidence only when the policy permits professional judgment as evidence — and must then self-declare as judgment. Confidence values never replace evidence.
**WHY:** each of these is a category error that lets an artifact of activity impersonate support for a conclusion.
**SCOPE:** governs the evidentiary weight of every artifact class. **NON-EXAMPLE:** none of these artifacts is worthless — each is admissible for exactly what it shows.

**ASR-8 · Evidence invalidation propagates; contradiction is undeletable.** When evidence is invalidated or expires, every dependent supported claim becomes contested, under review, or invalidated; dependent assessments become invalidated or review-required; baseline readiness is recalculated. Contradicting evidence remains attached and visible; the record never self-curates toward support. Evidence is immutable — corrections create a new version with a supersession link.
**WHY:** satisfaction resting on dead evidence is the quietest possible failure; discarded counter-evidence is a curated lie.
**SCOPE:** governs the live epistemic graph. Retention is dependency-driven: evidence is retained while any active or historical claim, assessment, decision, or baseline depends on it.

### 8.4 Criteria, dispositions, composition

**ASR-9 · Criteria fail closed.** Criterion results are five-valued (met / partially met / not met / not applicable / unable to determine); the exact spellings are contract shapes. Unable-to-determine is never treated as met. An evidence deficit yields an inconclusive disposition, never satisfaction; when required evidence cannot be retrieved, its content is never inferred. A conditionally satisfied disposition means three things jointly: the disposition, enumerated residual uncertainty, and a recommended control action. The condition remains visible in the assessment, the PWU assurance view, review packages, and baseline packages, and persists after parent baselining; conditional satisfaction is never displayed as unconditional success. Residual conditions convert to forward-carried mandatory obligations; deferred scope stays represented — as assumption, constraint, residual condition, baseline scope statement, or future obligation — never silently deleted.
**WHY:** fail-open uncertainty converts every outage and every blind spot into approval.
**SCOPE:** governs criterion evaluation and disposition derivation.

**ASR-10 · Composition is strictest-wins.** Aggregate assurance preserves the strictest unresolved required disposition. Results are never numerically averaged; disagreement between valid assessments is never silently arbitrated — both remain visible and the aggregate becomes contested, inconclusive, or escalated. A satisfied advisory policy never overrides a rejected blocking policy. Open critical findings block satisfaction; open blocking findings block promotion.
**WHY:** averaging is how one enthusiastic validator outvotes one correct one.
**SCOPE:** governs aggregation across policies and assessments.

**ASR-11 · Validator failure is not a verdict; invalid output is inert.** Infrastructure failure of a validator leaves assurance incomplete — it neither rejects nor satisfies the subject. Malformed or invalid validator output can never mutate authoritative state or create authoritative findings; raw output is retained for diagnostics. Assurance observations must name subject, policy, criterion, evidence or explicit professional judgment, severity, precise deficiency, and implication — vague findings ("looks reasonable", "could be improved") are non-conformant.
**WHY:** conflating evaluator breakage with subject failure punishes the work for the harness; letting unparsed prose become findings hands authority to noise.
**SCOPE:** governs assurance-process failures and observation quality.

**ASR-12 · Assurance binds to exact versions and never floats.** Every assessment references an active policy version and its subject's exact semantic version. An assessment of version n never satisfies version n+1; a semantic change to the subject invalidates or forces review of prior assessments. Findings are indelible: a finding-type observation never disappears because an artifact was regenerated, a validator reran, a waiver was granted, or a successor version passed; remediated findings stay on the record.
**WHY:** floating assurance is the review-then-swap attack; erasable findings make the record negotiable.
**SCOPE:** governs assessment validity and finding lifecycle. Recurrence uses the finding code plus lineage, never a reused observation identity.

### 8.5 Independence

**ASR-13 · Independence is a verified runtime property.** Required independence is policy-declared and graduated (separate invocation → different agent → different model/provider → human or organizational independence, scaling with claim materiality). The runtime verifies *actual* independence across eight dimensions — producer invocation, evaluator invocation, agent identity, model identity, provider, shared hidden context, shared prompt lineage, and organizational authority — before evaluation begins. If required independence is missing: the assessment cannot be satisfied, an independence violation is recorded as a first-class outcome, and another evaluator or a policy-permitted scoped waiver is required.
**WHY:** a producer grading its own work — however renamed — is the common-mode failure of agentic systems.
**SCOPE:** governs evaluator selection and assessment validity. **NON-EXAMPLE:** naming an agent "Verifier" establishes nothing; conversely, the same base model in a separate invocation *is* legal where the active profile permits that visible common-mode limitation.

### 8.6 Waivers

**ASR-14 · A waiver accepts risk; it never rewrites truth.** A waiver records the exact policy, criterion, finding, object and semantic version, authority, rationale, duration or expiration, compensating controls, downstream impact, and review triggers. It does not erase a finding, make invalid evidence valid, declare a rejected claim true, or apply to another criterion, another object, or a future semantic version unless explicitly renewed. Expired waivers stop waiving — an expired required waiver blocks promotion. Critical integrity failures (security, tenant isolation, data integrity, mandatory constraints) may exceed ordinary product authority and be non-waivable; unauthorized intent alteration is never waivable — the only exit is a governed intent revision approved by the user. A policy cannot waive its own blocking finding unless waiver authority is separately defined.
**WHY:** the waiver is the designed pressure-release valve; without these bounds it becomes the universal solvent of every other invariant.
**SCOPE:** governs waiver meaning and scope. **NON-EXAMPLE:** waiving is not failure — a properly scoped, reasoned, expiring waiver is the *correct* governed act when authority knowingly accepts risk.

### 8.7 Decisions

**ASR-15 · Authority is positional, attributable, and version-bound.** An agent may recommend a decision but cannot exercise authority unless delegated; no effective governance decision exists until an authorized actor decides. Every material Decision binds exact subjects and semantic versions, decision type and selected option, alternatives, rationale, evidence, residual uncertainty, actor with verifiable authority, effective time, and conditions. Authority is checked *before* effect. A decision approving version n never authorizes version n+1. A decision cannot retroactively change evidence; human override never erases contrary findings or evidence; revoking a decision triggers impact analysis — dependent baselines and planning cannot keep standing on it silently. An approval whose actor, subject, subject version, type, and time cannot be identified is not authority — it is provenance at best, and re-decision is required.
**WHY:** authority that floats across versions, or that rewrites the record it overrides, is indistinguishable from no governance at all.
**SCOPE:** governs governance acts. Recommendation, escalation, and proposal by agents are not merely legal but expected — they are the governed feedback channel.

### 8.8 Baselines

**ASR-16 · Baseline promotion is a governance event with exact identity.** Promotion requires: exact item identities, semantic versions, and content hashes where applicable; the promoted version exactly matching the reviewed version; required claims, admitted evidence, assessments, and dispositions; no unresolved blocking or critical finding except through a policy-permitted scoped waiver; effective promotion authority; accepted residual risk; and declared purpose/scope with rollback/recovery where required. An authoritative baseline is immutable — change creates a successor with a supersession trace, and the predecessor stays queryable.
**WHY:** promotion is where every upstream shortcut cashes out; the reviewed=promoted identity check alone kills the review-then-swap class.
**SCOPE:** governs baseline creation and promotion.

**ASR-17 · A repository commit is never a baseline.** Repository commits, branches, merges, releases, and deployments may be *linked* to a baseline but never imply one. A commit may exist without promotion; promotion is a separate governance event over exact versions. Repository-operation state and baseline-governance state are independently modeled; neither implies the other.
**WHY:** "it's merged" is the oldest counterfeit of "it's accepted."
**SCOPE:** governs the relation between version control and authority. **NON-EXAMPLE:** linking commits into baseline items — with version and hash identity — is required practice, not a violation.

### 8.9 Assignment, capability, execution, and publication

**ASR-18 · Assignment, capability, and execution are three distinct proofs; none implies the next.** Definition-time policy assignment, deployment-time Validator capability binding, and instance-time Assessment are separate rails. A policy attachment proves required treatment; a configured Validator proves available capability; neither proves that assurance ran. A projection labels a configured or eligible Validator as capability, never as a completed execution.
**WHY:** collapsing the rails lets "a policy exists" or "a validator is configured" impersonate "assurance happened" — the exact hollow-governed-layer failure the current code exhibited.
**SCOPE:** governs assurance representation across PWA definition, deployment, and Undertaking instances. The wire representation of the three rails remains an open register question (JPWB-REG-005); the separation itself does not.

**ASR-19 · Publication gates are substantive.** A PWA version with an implicit leaf, an opaque child count, a non-leaf type without a recomposition contract, or a missing required policy assignment cannot become validated or published; missing target Validator capability blocks activation; and no publication or activation step may silently downgrade required assurance. Assurance-policy catalog definitions and the PWA branch/role/profile ontology are PWA-version-owned versioned data: their professional meanings travel with the seeded published PWA version, whose source-of-record provenance is tracked in JPWB-REG-005.
**WHY:** publication is where a design's unstated obligations become every future Undertaking's silent gaps.
**SCOPE:** governs PWA version validation, publication, and activation. Exact gate encodings are repository shapes.

## 9. Persistence semantics

The persistence model is a hybrid: normalized authoritative current state, plus append-only immutable domain Events, a transactional outbox, rebuildable projections, version history, and typed trace relations. Current-state tables answer *what is authoritative now*; events and version history answer *how it became authoritative*. Exact storage design, schemas, and the atomic write sequence are repository shapes; the semantics below govern them.

**PER-1 · Commands request; Events assert.** A command expresses a requested mutation and may fail; a persisted domain event records an accepted state change and is never rewritten. Command rejection produces a command result, never a domain event — rejection lives outside domain history. Event payloads carry the accepted facts, not the original request, and never presentation state.
**WHY:** blurring request and fact lets hopeful writes impersonate accepted history.
**SCOPE:** governs the mutation model for all semantic state. **NON-EXAMPLE:** an accepted command whose execution then fails — a failed Attempt, a rejected mandatory assessment, an invalidation — IS domain history and is event-backed (PER-2, STA-7); only the refusal of a command that was never accepted lives outside it.

**PER-2 · History is append-only and material change is event-backed.** Every material semantic change produces an immutable domain event preserving prior values, actor, rationale, timestamp, and causal relationships; authoritative history remains reconstructable. No handler updates read models without generating the corresponding event; no side-door write path exists. Persisted event schemas are permanent — evolution uses upcasters at read time, never event rewriting. Materialized current state is a cache of this history, not a second authority.
**WHY:** an editable past cannot ground the accountability questions the system exists to answer.
**SCOPE:** governs all semantic writes. **NON-EXAMPLE:** upcasting old payloads at read time, and rebuilding projections under new derivation rules, are legal precisely because they change *presentation of* history, not history.

**PER-3 · One authoritative write path.** Canonical state is mutated only through authenticated, authorized, semantically named commands that check expected revision, validate preconditions and invariants, enforce required assurance, and atomically persist state, version history, events, outbox, and command receipt. No generic CRUD/PATCH path, UI local state, RPH worker, validator, projection worker, broker message, agent output, or informal approval bypasses this pipeline.
**WHY:** invariants only exist if every write passes the point that enforces them.
**SCOPE:** governs semantic writes. The exact pipeline ordering and envelope are repository shapes; the *existence and completeness* of the gate is the semantic requirement.

**PER-4 · Optimistic concurrency; never last-write-wins.** Updates to existing aggregates declare the revision they believe current. On conflict, the command is rejected; the caller reloads current state and re-forms intent; the system never silently overwrites and never silently retries with stale business assumptions. Aggregate event history is gapless and strictly ordered.
**WHY:** last-write-wins on governed state is unrecorded authority transfer between concurrent actors.
**SCOPE:** governs updates to material state. **NON-EXAMPLE:** retrying is legal — after reloading and re-deciding against current reality; only the *silent stale* retry is barred. Command types explicitly exempted by contract (pure creations) need no expected revision.

**PER-5 · Idempotency at the business-effect level.** Replaying a mutation with the same idempotency key returns the prior result and produces no additional domain event or repeated external effect. Retries must never duplicate commits, external API mutations, baseline promotions, approval decisions, or evidence records. Reuse of a key with a different payload fails.
**WHY:** agent-driven systems retry constantly; without business-level idempotency, retries mint duplicate authority.
**SCOPE:** governs command execution and external side effects.

**PER-6 · Uncertain external effects are reconciled, never blindly retried.** When an external operation's completion is uncertain — including across restarts — the attempt enters reconciliation: classify (not started / observably running / succeeded-unrecorded / failed / uncertain), then reconcile before any retry. Compensation is a new recorded action, never deletion of history. Professional correctness never depends on in-memory state.
**WHY:** blind retry of a non-idempotent external action is how one payment becomes two.
**SCOPE:** governs external side effects and recovery.

**PER-7 · Projections are derived, disposable, and powerless.** Read projections may be rebuilt, delayed, optimized, and independently versioned; they are never authoritative write targets, and canonical commands never validate against projections alone. Projection lag can never alter an authoritative decision. Rebuildability, not backup, is their durability guarantee.
**WHY:** the moment a projection can authorize or receive writes, dual truth exists.
**SCOPE:** governs all derived views, including compatibility projections. Exactly one component derives any given compatibility projection. A projection filtered by authorization discloses that its view is partial when the filtering materially affects interpretation, and never leaks protected existence through counts, graph structure, titles, metadata, inferred dependencies, or omitted-node placeholders.

**PER-8 · No hard delete after participation.** A canonical professional object that has participated in execution, assurance, governance, a baseline, or traceability is never hard-deleted. Lifecycle statuses (superseded, withdrawn, abandoned, revoked, invalidated) replace deletion; corrections create successors with supersession links. Rejected, invalid, quarantined, superseded, revoked, and failed material remains inspectable but cannot silently govern current work — quarantine means policy-governed isolation and non-admissibility, not a universal object field.
**WHY:** deletion severs the trace spine retroactively; a record with holes cannot answer who decided what on what basis.
**SCOPE:** governs participated canonical objects. **NON-EXAMPLE:** never-participated drafts, expired retention-bounded material that by rule participates in nothing (e.g., retained volunteered model reasoning — PER-12), and rebuildable projections are all purgeable; this rule does not embalm scratch space.

**PER-9 · The governed professional stream is a logical union.** The one queryable history of professional work is the causally connected union of typed commands/results, aggregate revisions, immutable events, execution attempts and traces, artifacts, claims, evidence, assessments, observations, decisions, baselines, and audit records — over the typed stores. It is not a monolithic record table: do not implement a universal stream-record type, duplicate event authority, or hide core relationships in one generic JSON document. Every material act in the stream retains identity, scope, actor and provenance, correlation and causation, exact input/subject/context/policy/evidence/output references, the time dimensions PER-11 requires, and status/supersession relations. An assessment's record captures exactly what it was permitted to see — including unavailable or rejected evidence and declared truncation — so its conclusion can be reproduced and challenged; partial retrieval is represented as partial, and a summary never substitutes for the referenced source state. Every bounded model or agent try — each retry, reformat, and repair request included — is its own durable exchange record capturing the exact materialized input presented to the model, the returned output before schema coercion or repair, the resolved provider, model, and version actually invoked, declared truncation or omission, and the parse/validation/repair outcome, subject to recorded redaction. A prompt or template fingerprint identifies that record; it never substitutes for it. Where no Execution Plan exists — PWA authoring among them — the identical obligation binds to the plane's governed-stream record. Log-plane redaction of sensitive prompt content is legal; record-plane omission is not.
**WHY:** the union is what makes the accountability questions answerable; the monolith is what makes them unanswerable at scale — the legacy Governed Stream's durable idea was the union, not its single table.
**SCOPE:** governs the logical completeness of the record. Storage layout is a repository shape.

**PER-10 · Untrusted until admitted.** All inbound data — user input, model output, validator output, tool output, imports, templates, migration data, external API responses — crosses the full trust pipeline (parse, structural validation, normalization, semantic validation, authorization, conversion to domain values) before touching canonical state. Model output is untrusted external input; the system's own agents have no privileged bypass. Malformed output creates no authoritative object.
**WHY:** an agent inside the trust boundary is an unaudited author of record.
**SCOPE:** governs every write-side ingress. Read-side tolerance for unknown optional material is a separate, contract-governed concern.

**PER-11 · Time is bitemporal; occurrence and record never conflate.** Every durable semantic record preserves semantic-occurrence time and record time as distinct meanings, and carries observed, valid, and Decision-effective time where their distinction matters. Exact field spellings and placement are repository shapes.
**WHY:** professional understanding is legitimately updated after the fact; one timestamp cannot say both when something became true and when the system learned it.
**SCOPE:** governs events, observations, assessments, decisions, and version history. **NON-EXAMPLE:** records whose dimensions provably coincide need not carry redundant fields — the preserved meaning distinction, not field count, is the requirement.

**PER-12 · Volunteered model reasoning is redacted at the boundary and quarantined in retention.** Chain-of-thought and other volunteered model reasoning is redacted at the trust boundary and, where retained, retained as a typed Artifact bound to its producing Attempt under the applicable retention, security, and access policy. It is never admitted as Evidence, never forwarded to another actor, never logged, and never projected; its presence in an evaluator's context is a hidden-context independence violation (ASR-13). It is purgeable at retention expiry (PER-8). The scope of required retention is an open sponsor question (JPWB-REG-005); this rule is the operative default until that ruling.
**WHY:** reasoning traces are the highest-leverage contamination channel — they leak hidden context into evaluation and launder unaccountable rationale into the record.
**SCOPE:** governs volunteered reasoning as data at rest and in flow. **NON-EXAMPLE:** this rule governs retention and flow of reasoning, never its generation — enabling model thinking is legal (the §9.7 lesson, JPWB-DOC-004); professional rationale summaries offered through governed contracts are ordinary content, not reasoning traces.

## 10. Single semantic authority

**AUT-1 · Exactly one representation is authoritative for professional semantic state.** At every moment, for every unit of professional semantic state, exactly one representation holds authority. Dual run never means dual semantic authority: a shadow computation may measure, compare, and learn, but produces no decisions and no side effects; a compatibility representation may display and label, but is derived, single-writer, and never independently writable. Contradiction between representations is never resolved by picking the convenient value — authority must be designed and declared.
**WHY:** two writable representations of the same meaning guarantee eventual contradiction with no principled resolution; this failure is why the legacy migration design existed.
**SCOPE:** governs any coexistence of representations — legacy migration, projections, caches, mirrors, and future dual-plane deployments. **NON-EXAMPLE:** running a shadow implementation to measure divergence is encouraged, not forbidden — provided the shadow cannot decide or act.

**AUT-2 · Authority transfer is an explicit, recorded, effectively one-way act.** Authority over a body of semantic state changes only through an explicit governed transition, per cohort, with exit criteria; unresolved divergence is carried past a transfer only by explicit acceptance, never silence. Once the system depends on semantics the old representation cannot express, reverting authority is semantically impossible — rollback is incident recovery, never authority reversion.
**WHY:** ambient, gradual, or implicit authority drift is dual authority with extra steps.
**SCOPE:** governs authority-mode transitions. During the present convergence phase this rule has a canon-level application — the canon is the sole semantic authority and the code is the first experiment being brought into conformance; the operative protocol for classifying and acting on divergence is owned by JPWB-DOC-004, and the phase ruling itself is recorded in JPWB-REG-005.

## 11. Ambiguities carried to the register

The following meaning-level ambiguities in the source corpus are deliberately **not** resolved here. Items 1–5 are filed in JPWB-REG-005 with a safe default; items 6 and 7 state their actual resolution paths (neither is a register entry). Do not invent resolutions locally.

1. Whether recomposition lifecycle states ride on the parent or the child PWU. Safe default: treat recomposition state as parent-side; do not build child-side recomposition state without a ruling.
2. Whether a waiver may bridge an invalidated-evidence gap or only open findings. Safe default: invalidated evidence forces claim review regardless of waivers (ASR-8 governs; waivers do not revive dead evidence).
3. The default disposition for a material open finding (conditional vs. inconclusive vs. rejected) absent a policy override. Safe default: the strictest plausible disposition, escalating on doubt.
4. The recording path for an authoritative WAIVED disposition (it is a governance act, not a validator recommendation). Safe default: waivers enter only through Governance contracts.
5. Which evaluator configurations satisfy each independence level in practice. Safe default: verify the eight independence dimensions (ASR-13) and escalate unresolvable cases.
6. Whether an unknown enum value read from a projection may re-enter a canonical write. Resolution path: repository shape authority (per REG-D-004); the semantic requirement stated here is that write-side strictness wins — never re-enter.
7. One reserved word per role for "authoritative" (current-state tables vs. event history). Resolved in this artifact's own text (§9): current tables are *authoritative now*; events are the *authoritative account of becoming*.

---
*Body ends. This artifact is a committed hypothesis: implement it faithfully; file friction as evidence through JPWB-DOC-004 and JPWB-REG-005.*
