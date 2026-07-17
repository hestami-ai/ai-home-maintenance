---
artifactId: JPWB-DOC-002
title: Canonical Vocabulary
layer: Vocabulary
settledness: PRESUMPTIVE
status: DRAFT — pending sponsor ratification
version: 0.1.0
date: 2026-07-16
governs:
  - Naming and meaning of canonical terms across the Janumi product family and the JPWB canon
  - The non-equivalence inequalities, placed beside the terms they guard
  - Retired and compatibility terminology and the migration rules for legacy uses
  - Naming rules (grammar), naming authority, and the engine/ontology vocabulary boundary
doesNotGovern:
  - Entity schemas, field names, serialized shapes, enum spellings, ID prefixes → the repository (generated contracts, schemas, conformance tests)
  - Semantic structure, invariants, state axes, assurance model mechanics → JPWB-DOC-003
  - Doctrine, reasoning, and the six disciplines' definitions and boundaries → JPWB-DOC-001
  - Vision, values, axioms, first principles → JPWB-CON-000
  - Agent conduct and process → JPWB-DOC-004
  - Open questions and rulings → JPWB-REG-005
precedence: Owns the concern "naming and meaning of terms" (JPWB-CON-000 Part B). On a naming or meaning question this artifact controls and no other artifact may redefine a canonical term locally; on shape questions the repository controls; on structural and invariant questions JPWB-DOC-003 controls.
changeProcedure: PRESUMPTIVE — new canonical terms, retirements, and meaning changes are proposed via a JPWB-REG-005 finding, sponsor-ratified, then merged (JPWB-CON-000 Part B). Never casual drift; no vocabulary is introduced as a side effect of code or prose.
ratification: PENDING — becomes effective via REG-005 entry
---

# JPWB-DOC-002 — Canonical Vocabulary

---

## 0. Authority and scope

This document is the naming authority for the Janumi product family and the JPWB canon. Every other canon artifact uses these terms with the meanings fixed here; no artifact may redefine a canonical term locally. It succeeds the naming-authority role of RPH-DOC-000 (the Vocabulary Charter, retired) and supersedes the informal and inconsistent uses of `Lens`, `workflow`, `Product Lens`, `Product Lens Workbench`, `sub-PWU`, `phase`, `dialogue`, and JanumiCode-as-a-single-architecture.

Terminology conflicts resolve against exactly two populations:

1. **Other canon artifacts.** These never redefine a canonical term; on a naming or meaning question this artifact controls (JPWB-CON-000 Part B, precedence by concern). A residual conflict within the concern MUST be surfaced as a JPWB-REG-005 finding, never silently absorbed, and the conflicting artifact MUST NOT be silently reinterpreted in a way that changes its substantive requirements.
2. **Retired and legacy material** — the pre-canon corpus, legacy code identifiers, migration adapters, and historical documents. Retired documents have no authority to conflict (JPWB-CON-000 Part B: historical evidence only) and receive no revision; surviving legacy term occurrences are handled through Section 8's migration rules.

This document defines meanings, non-equivalences, retirements, and naming rules. It does not define entity schemas, field names, or serialized shapes; those belong to the repository's generated contracts, schemas, and conformance tests (shape authority per JPWB-CON-000 Part B). Where a term below has a persisted representation, the meaning here governs and the representation follows.

Throughout, each term carries any **non-equivalence** it guards, placed beside the term rather than collected in an appendix, and — where a term has caused documented confusion — a one-line note of the confusion it prevents.

---

## 1. The product family ladder

**Janumi** is the company, product family, brand, and organizational authority responsible for the Janumi Platform and its domain products. *Janumi is not* a Professional Work Architecture, an Undertaking, an execution workflow, a single deployment, or a domain specialization.

**Janumi Platform** is the shared multi-tenant technical, operational, commercial, integration, and governance foundation on which Janumi products and tenant workloads operate. It supplies machinery — infrastructure, runtime, identity, services, controls — never domain semantics. The conceptual boundary between Platform and the products above it holds even when deployment infrastructure (clusters, databases, identity, storage, UI shells) is physically shared.

**Janumi Professional Workbench (JPWB)** is the general-purpose environment for designing and versioning Professional Work Architectures and for operating, executing, assuring, governing, tracing, and baselining Undertakings. JPWB is the sole canonical abbreviation. *JPWB is not:* exclusively a workflow editor; only a PWA authoring tool; only an Undertaking dashboard; specific to software engineering; identical to JanumiCode.
> Guards: **JPWB ≠ JanumiCode**. Prevents: reading the generic professional-work substrate as a software-engineering product, which erases every non-software domain product.

**Recursive Professional Harness (RPH)** is the coordination and control architecture that frames, allocates, supervises, reconciles, synthesizes, and escalates recursive professional work. RPH is an architectural and runtime concept exposed to users principally through JPWB; it may use workflow engines and agent orchestration but is not defined by them.
> Guards: **RPH ≠ Workflow Engine**.

**Domain Product** is a specialized Janumi product combining domain PWAs, Views, policies, integrations, and execution capabilities. A domain product is a bundle; it is never a single PWA and never a single View. A specialized View does not by itself constitute a domain product.

**JanumiCode** is the software-product domain product: the specialization of JPWB for software-product conception, realization, implementation, validation, deployment, operation, maintenance, and evolution. It contains multiple software-product PWAs plus Views, policies, and agent/repository/IDE/build/test/deployment integrations. JanumiCode is built on the Janumi Platform and specialized from JPWB; the product-catalog rendering that lists JanumiCode beside JPWB is a commercial catalog view, not a dependency statement.
> Guards: **JanumiCode ≠ Product Realization PWA**; **JanumiCode ≠ JPWB**; **JanumiCode ≠ a single PWA**. Prevents: the most common legacy conflation — treating the whole product, one of its architectures, a concrete undertaking, and its output as one thing.

**Product Realization PWA** is the reusable Professional Work Architecture used to shape, define, architect, implement, validate, and baseline a software product. It is one architecture inside JanumiCode, not JanumiCode itself.

The one-paragraph identity statement of the family: *Janumi is the company. Janumi Platform is the shared multi-tenant deployment and service foundation. Janumi Professional Workbench is the general environment for defining and operating Professional Work Architectures. JanumiCode is the software-product specialization of that Workbench and contains multiple product-focused PWAs.*

The canonical reference chain every artifact must remain consistent with: a tenant uses JanumiCode, operating on the Janumi Platform through JPWB, to instantiate the Product Realization PWA as the Field Service Management SaaS Undertaking, whose Professional Work Graph is executed, assured, governed, and baselined to produce the Field Service Management SaaS product.

---

## 2. Work structure

**Professional Work Architecture (PWA)** is a reusable, versioned architecture defining how a class of professional work is structured, decomposed, executed, assured, governed, and accepted. "Reusable," "versioned," and "class of work" are the load-bearing qualifiers. A PWA is rooted in PWU Types and recursively composed through explicit type-level child, decomposition, recomposition, obligation, assurance, governance, fixture, and conformance rules. A PWA is not primarily a temporal sequence: it may include semantic progression, prerequisites, dependencies, feedback relationships, iteration permissions, and conditional decomposition, but it is never reduced to a fixed linear pipeline.
> Guards: **PWA ≠ Execution Workflow**; **semantic progression ≠ temporal execution sequence**. Prevents: flattening an architecture of work into a phase pipeline, the failure mode that motivated retiring `workflow` at this level.

**Professional Work Unit (PWU)** is a bounded, identifiable, executable, assessable, traceable, and governable unit of professional work. Every PWU carries why the work exists, what it must accomplish, what constraints it inherits, what assumptions govern it, what evidence it must produce, how success will be verified, and how its result contributes to its parent objective.
> Guards: **PWU ≠ Task**. A task is a scheduling notion; a PWU is a professional-meaning notion carrying obligations and assurance requirements.

**Professional Work Object (PWO)** is any persistent professional entity with identity, provenance, lifecycle, and relationships — PWU Instances together with the non-executable governed objects such as Intent, Evidence, Assessments, Decisions, and Baselines. A PWU is an executable Professional Work Object. The graph of Professional Work Objects and their relationships is the authoritative state an Undertaking owns; its structural rules are owned by JPWB-DOC-003.

**PWU Type** is a reusable definition owned by a PWA version. Each instantiable type is explicitly a coherent leaf or a non-leaf with permitted, mandatory, and conditional child-type rules plus decomposition and recomposition semantics. A PWU Type belongs to a PWA — never to an Undertaking.

**PWU Instance** is concrete professional work owned by exactly one Undertaking. It is a coherent leaf or recursively decomposes into child PWU Instances through explicit decomposition and recomposition contracts. A local extension is explicitly marked and does not mutate its PWA. A compatibility kind label on an instance is a descriptive discriminator only; it never confers type identity and never makes an instance a reusable type.
> Prevents: kind labels being treated as type authority — a documented instance≠type failure in legacy fixtures.

**Child PWU Type / Child PWU Instance** name recursive composition at the reusable PWA-definition level versus concrete decomposition inside an Undertaking. "Sub-PWU" is explanatory shorthand in prose only; there is no canonical `SubPWU` object, and none may be introduced. Non-example: writing "each sub-PWU inherits its parent's constraints" in an explanatory paragraph is permitted; adding a `SubPWU` entity, kind, or table is not.
> Guards: **child-type composition ≠ instance decomposition ≠ dependency**. Three distinct relations; conflating them corrupts both the architecture view and the work graph.

**Undertaking** is a concrete body of professional work instantiated under one or more compatible PWA versions. The Undertaking owns all actuals: PWU Instances, actual boundaries, assumptions, evidence, assessments, decisions, baselines, and execution state. Definitions inherit downward from the PWA; actuals never inherit upward. An Undertaking may produce software, a service, a policy, a legal instrument, a construction outcome, an analysis, an operational capability, a recommendation, or a shape package — and may legitimately conclude with an approved design and no implementation.
> Guards: **Product ≠ Undertaking**. The Undertaking is the governed body of work; the product is the output produced through that work. Prevents: the Field Service confusion — the FSM SaaS Undertaking is not the Product Realization PWA, and the FSM SaaS product is not the Undertaking.

**Professional Work Graph (PWG)** is the typed, instantiated semantic graph of PWU Instances and related professional-work objects belonging to an Undertaking. It represents what the professional work is and how its semantic elements relate.
> Guards: **Work Graph ≠ Execution Graph**; **PWA Work Architecture View ≠ Professional Work Graph**. The graph is semantic state; execution structure and type-level renderings are different objects.

**Execution Plan** is the governed, versioned strategy for performing selected PWUs — steps, models, tools, permissions, escalation, termination. It sits between the graph and the workflow.

**Execution Workflow** is the temporal machinery through which a plan is carried out: steps, branches, loops, waits, agents, humans, and tools. This is the only level at which the word `workflow` is canonical. `workflow` MUST NOT be used as the canonical term for an entire PWA or for a Professional Work Graph (scope: all canon artifacts, contracts, and UI labels). Non-example: "The Product Realization PWA uses several execution workflows" is valid; "The Product Realization PWA is a workflow of phases" is not.

**PWA Profile** is a bounded configuration of a PWA. It may alter required PWUs, assurance rigor, evidence requirements, human authority, execution strategies, and baseline requirements — within the bounds the PWA permits. A **template** is not necessarily a complete PWA; template material becomes canonical only when classified as a PWA, a profile, or fixture content.

**Tenant-derived PWA** is a governed fork or extension of a published PWA. The full derivation ladder — published PWA → optional profile → optional tenant-derived PWA → Undertaking → optional Undertaking-local PWU Instances — is the complete authority descent from vendor definition to local work. Published PWA versions are immutable; an existing Undertaking remains bound to its selected version until explicit migration, local extension, governed compatibility policy, or a successor Undertaking. PWA changes NEVER silently mutate existing Undertakings. Learning flows upward only as a PWA Change Proposal through governance into a new published version; an Undertaking may propose, never directly mutate.

**Reference Fixture** is a representative Undertaking used to test or demonstrate a PWA. It MUST always be labeled as an instance or fixture and MUST NOT be presented as the PWA definition itself. The Field Service Management SaaS Reference Undertaking is the canonical fixture of the Product Realization PWA; its product output is named separately.
> Prevents: the recurring reading of the worked Field Service example as if it were the architecture it exercises.

**PWA Work Architecture View** is the recursive View of a PWA version's PWU Types and permitted composition. It displays reusable definitions and type-level rules — never concrete state and never temporal execution order.

---

## 3. Epistemic and professional-state terms

These terms carry the epistemic discipline of the canon. Their inequalities are the ones most often violated by casual writing.

**Outcome** is a desired or observed change in reality. Outcomes are not artifacts, activities, or deliverables: a report, a meeting, or a dashboard is an output, not an outcome.
> Guards: **Outcome ≠ Artifact**; **Action ≠ Outcome**. Prevents: deliverable-driven drift, where producing documents substitutes for changing reality.

**Intent** is the authorized description of the problem, desired outcomes, users, constraints, non-goals, and success conditions. "Authorized" makes it a governed object, not a paraphrase; intent captures more than a feature statement.
> Guards: **Intent ≠ Requirement**.

**Artifact** is a produced container — a file, document, model, or code unit. A **Representation** is the understanding an artifact embodies: the PDF is an Artifact; the architecture expressed within it is a Representation.
> Guards: **Artifact ≠ Representation**; **Representation ≠ Reality**.

**Observation** is a concrete, recorded noticing of something about a subject. An observation is raw material; it carries no admitted evidentiary standing by itself.

**Evidence** is an admitted observation or artifact: material that has passed evidence admission, which evaluates provenance, relevance, scope, and limitations. An artifact produced by execution *may become* Evidence only through admission. The admission gates and scope-enforcement rules are invariants owned by JPWB-DOC-003 (ASR-6).
> Guards: **Observation ≠ Evidence**; **Evidence ≠ Claim**; **Artifact ≠ Evidence**. Prevents: "the tests passed, so it's proven" — an execution artifact standing in for admitted, scoped evidence.

**Claim** is an assertion about a subject that evidence may support or undermine. A Defect, for instance, is a Claim that observed behavior conflicts with expected behavior — not a fact.
> Guards: **Claim ≠ Decision**.

**Assumption** is a governed statement accepted as a working basis. Accepted is not equivalent to verified: an accepted assumption has been authorized as a basis for proceeding; a verified assumption has evidence.
> Guards: **Accepted Assumption ≠ Verified Assumption**; **Confidence ≠ Certainty**.

**Decision** is a governed exercise of authority over approval, rejection, waiver, escalation, reshaping, replanning, risk acceptance, or promotion. A Decision is not truth — it is accountable authority, revisable through governance.
> Guards: **Decision ≠ Truth**; **Decision ≠ Action**; **Validation ≠ Approval**; **Finding ≠ Decision**. Prevents: treating a passing check as an approval, or an approval as a fact about the world.

**Baseline** is an immutable, version-bound, authoritative accepted state produced by an effective promotion Decision. Baseline authority is always scoped and qualified — subject to recorded constraints, assumptions, and residual uncertainty — never unconditional. A repository commit is a technical artifact operation; it may be included in a baseline; it is never automatically one.
> Guards: **Commit ≠ Baseline**; **Assessment satisfaction ≠ convergence ≠ acceptance ≠ Baseline promotion**. Prevents: reading repository history as professional acceptance, the central technical-operation/professional-authority conflation of the legacy engine.

**Stakeholder** holds interest or is affected; **Participant** performs work. A person affected by a decision may be a Stakeholder without ever acting in the system, and stakeholder impact remains distinguishable from implementation participation.
> Guards: **Participant ≠ Stakeholder**; **Actor identity ≠ Authority**; **Ownership ≠ Authority**. Who someone is, what they own, and what they may decide are three separate questions.

**Risk** concerns possible future impact; **Issue** concerns an existing condition. The two never merge.

**Attention Item** is durable professional state binding a condition that requires judgment or action to the authority that must address it. It persists until explicit disposition and is ranked by professional consequence, not recency. A notification is a delivery mechanism, not the item; dismissing a notification disposes of nothing.
> Guards: **Attention Item ≠ notification**. Prevents: professional waiting states silently evaporating on restart or dismissal — ignoring is not a disposition. Object definition and disposition vocabulary: JPWB-DOC-003 §3; doctrine: JPWB-DOC-001 §7.4.

**Authoritative semantic state** is the governed graph of professional-work objects. Projections, chat transcripts, repositories, and agent memory are inputs, records, or renderings — never the authority.
> Guards: **Projection / chat / repository / memory ≠ authoritative semantic state**. Prevents: "the conversation said so" or "it's in the repo" standing in for governed state.

---

## 4. Assurance and governance vocabulary

The six engineering discipline names — **Prompt Engineering**, **Context Engineering**, **Harness Engineering**, **Loop Engineering**, **Shape Engineering**, and **Assurance Engineering** — are canonical terms. Their definitions, boundaries, and division of labor are owned by JPWB-DOC-001 §5; this document fixes only that the names are canonical and never interchangeable.

**Assurance Engineering** is the discipline that designs and operates the versioned evidence-and-control system by which professional knowledge becomes applicable policies and inspection methods: exact work versions are assessed, findings become durable obligations, repairs are revalidated, convergence and residual uncertainty are established, and the assurance machinery is itself tested and governed. Assurance evaluates claims using evidence under policies; it does not merely mark tasks passed or failed.

**Governance** is the exercise of authority: approval, rejection, waiver, escalation, residual-risk acceptance, baseline promotion, revocation, supersession. Assurance evaluates; governance decides. The two vocabularies never substitute for each other.

**Assurance Policy** is a versioned professional rule defining applicability, claims, evidence, criteria, independence, dispositions, remediation, escalation, and waiver. An **Assessment** is one specific application of an Assurance Policy to an exact subject version — policy is the reusable rule, assessment is the single application.

**Verification** is assessment against declared criteria and specification: was the work built right. **Validation** is assessment against intent and observed outcome in reality: was the right thing built. Passing all tests is verification evidence, never product validation. Both are assessment acts, distinct from approval; the registry of relation types that carry them is owned by the repository.
> Guards: **Verification ≠ Validation**; **Validation ≠ Approval**. Prevents: "all tests pass, so the product is validated" — specification conformance standing in for outcome-facing evidence.

**Validator** is a replaceable evaluator — deterministic, model-based, hybrid, human, or external — implementing bounded Assurance Policy concerns. A Validator may recommend policy-permitted control actions; it MUST NOT authorize or select them for execution, decide dispositions, repair work, or mutate professional state (scope: all validator implementations, regardless of technology). Its recommendation is distinct from the authoritative disposition, which only the assurance authority renders.
> Guards: **Validator ≠ Assurance Engineering**. Prevents: the legacy reading of "the Validator subsystem" as the whole assurance discipline; a validator is one policy implementation inside it.

**Finding Definition** is a policy-defined failure or concern type. It is a definition, not a detection. A concrete detection is an **Assurance Observation** — one version-bound observation of a concern against an exact subject. In prose, **finding** is shorthand for such an observation and its governed unresolved concern; there is no separate Finding entity. Findings are durable obligations: regeneration, repair, waiver, override, supersession, or later success never erases what was observed about an exact subject version.

**Material professional transformation** is production or semantic revision of a professional object, artifact, claim, evidence proposal, decomposition/recomposition result, decision package, baseline candidate, or other output that feeds another actor or agent, affects governed work, or supports a protected transition. Low-level rendering, retrieval, formatting, and retries are not material by themselves — a non-example that matters, because over-applying materiality would drown assurance in mechanical noise.

**Reasoning Review** is the mandatory de minimis assurance control for every material AI/agent-produced professional transformation: a conforming Validator independently evaluates the exact output and its observable derivation, provenance, assumptions, constraints, evidence use, uncertainty, and completion claim. Reasoning Review does not require and does not expose private chain-of-thought.

**Professional rationale summary** is the agent-authored account of its own professional reasoning, returned under the execution contract and bound to the evidence, assumptions, claims, limitations, and residual uncertainty it declares. It is a contracted deliverable addressed to the governed system — not a byproduct of a provider's runtime, and not private chain-of-thought.

**Private chain-of-thought** is a model's interior deliberation and any rendering of it: raw reasoning tokens, inline reasoning volunteered by a local or open-weight model, or a summarized reasoning block returned by a hosted API. The term is fixed by origin, not by disclosure or format. It is not a professional rationale summary and is not observable trace data. Non-example: an agent's deliberately authored rationale summary does not become chain-of-thought merely because it discusses reasoning; origin, not topic, classifies it.
> Prevents: the documented drift of treating summarized provider reasoning blocks as reviewable trace because they "look like" authored rationale.

---

## 5. Presentation vocabulary

**View** is a user-facing representation of underlying professional-work or execution data. A View may be implemented using one or more Projections. It is presentation — never architecture, never authority. A Security View is not automatically a Security Maintenance PWA, and the named JanumiCode surfaces (Architecture Studio, V&V View, and peers) are projections, never PWAs.

**Projection** is a derived representation optimized for a particular question or user need. It is rebuildable and never an independent source of truth.

**Viewpoint** is the organizing concern through which data is selected or arranged — security, architecture, compliance, operations.

> The three are distinct: View = surface, Projection = derivation, Viewpoint = concern. Prevents: the legacy `Lens` ambiguity, where one word covered all three plus the work architecture itself.

---

## 6. Packages and outputs

**Product Shape Package** is a governed export of the shape-engineering outputs of a Product Realization Undertaking. It may stop short of implementation or include implementation-ready planning. It describes and governs *what should be built*.

**Implementation Package** contains or enables the built realization: source, tests, build and deployment definitions, migration tooling, documentation, evidence, and release artifacts.

> Guards: **Product Shape Package ≠ Implementation Package** — related but distinct; shipping a shape package is a legitimate terminal outcome.

The output product is always named separately from the Undertaking that produces it. Deployment on Janumi Platform is a supported outcome of a Product Realization Undertaking, not an implicit requirement of one.

---

## 7. Version vocabulary

Four version words carry four distinct meanings, and they are never interchangeable:

- **contractVersion** — a package release of the contracts themselves;
- **schemaVersion** — the serialized payload shape;
- **semanticVersion** — the domain meaning of an object: it increments only when meaning, obligations, assurance requirements, or authority change;
- **revision** — the persistence/concurrency counter: it increments for any persisted change.

Conflating them collapses shape, meaning, and concurrency into one number. Field placement and wire representation are owned by the repository (generated contracts and schemas); this document fixes only the meanings.

**PWA version** authority follows Section 2's derivation ladder: published versions are immutable, Undertakings bind to exact versions, and no change propagates silently.

---

## 8. Retired and compatibility terminology

Retired terms remain readable in legacy material under the migration rules below. Each legacy use MUST be re-classified by intended meaning — a blind suffix swap is not migration.

| Retired / legacy term | Canonical treatment |
|---|---|
| `Lens` (as work architecture) | **Professional Work Architecture (PWA)** |
| `Product Lens` | **Product Realization PWA** |
| `Lens Designer` / `Lens Library` | **PWA Designer** / **PWA Library** |
| `Lens version` / `Lens migration` | **PWA version** / **PWA version migration** |
| `Product Lens Workbench` | Classify by context: PWA definition → **PWA Designer**; concrete work → **Undertaking Workbench**; software-specific surface → **JanumiCode** |
| Security lens (as work architecture) | **Security Maintenance PWA** |
| Security lens (as UI filter) | **Security View** or **Security Viewpoint** |
| `workflow` (for the whole professional structure) | **PWA** or **Professional Work Graph**; reserve `workflow` for temporal execution |
| Workflow Canvas (as ontology) | **Execution View** or projection only |
| `sub-PWU` | **child PWU Type** (PWA definition level) or **child PWU Instance** (Undertaking level); no `SubPWU` entity |
| `phase` | Derived compatibility milestone where legacy support requires it; never ontology |
| `REPLAN` (as terminal phase) | Controller action, not a universal professional-work phase |
| `COMMIT` (as acceptance) | Repository operation plus separate Baseline governance |
| `dialogue` | Interaction/provenance record, never the Undertaking or authoritative work root; extracted portions may become Evidence only through admission |
| `Validator` (as the assurance subsystem) | Implementation of an Assurance Policy |
| Decomposition viewer (legacy JanumiCode) | An early **Product Realization View** — a View, never the Product Realization PWA itself |
| Shape document | **Product Shape Package** |
| `Living Enterprise Model` / `LEM` | Authoritative semantic state (Section 3) plus Projections derived from it; never an independent subsystem |
| `PCLC` | The cognitive loop (JPWB-DOC-001 §2.2) as an additive viewpoint; never a persisted lifecycle or phase machine |
| `Endeavor` (bare) | **Undertaking** |
| `Professional Endeavor` | Candidate generic semantic supertype/alias only. At product and UX boundaries the canonical term is **Undertaking**; a second competing root MUST NOT be created without a Decision |

Permitted residual use: `Lens` and other retired terms may remain in legacy code, migration adapters, historical documents, informal UI wording for viewpoints, and explicitly defined branded names. Non-example: a migration adapter named `LensAdapter` and a historical design memo that says "Product Lens" require no rewrite; new canon artifacts, contracts, and UI labels do.

> The `Lens` retirement exists because earlier material used one word for a work architecture, a filtered UI perspective, a product subsystem, and a professional-work template. Migration therefore classifies each occurrence; it never mechanically renames.

---

## 9. Naming rules and naming authority

### 9.1 Naming grammar

These rules govern names in canon artifacts, contracts, seeded vocabularies, and UI labels. They do not govern marketing copy or historical quotations.

- **Domain products** MUST use branded names: JanumiCode, JanumiLegal, JanumiHealth, JanumiConstruction.
- **Professional Work Architectures** MUST use functional names ending in `PWA`: Product Realization PWA, Security Maintenance PWA, Contract Review PWA.
- **Undertakings** MUST be named by their concrete objective plus `Undertaking` where disambiguation is needed: Field Service Management SaaS Undertaking, Hospital Expansion Undertaking.
- **Views and surfaces** MUST use names ending in `View`, `Explorer`, `Studio`, or `Workbench`: Traceability Explorer, Architecture Studio, Assurance Workbench.
- **Packages** MUST use names ending in `Package`: Product Shape Package, Implementation Package, Evidence Package.
- **Events** are named in past tense as completed accepted facts (IntentApproved); **Commands** are imperative requests for professionally meaningful state transitions (Approve this intent). The tense carries the meaning.
- Output products are named separately from the Undertakings that produce them.

A recurring concern (for example, security patching) may be represented as an independent PWA, a PWA module, a PWA profile, or a View — and the classification MUST be explicit in the name and definition. An ambiguous "security thing" is not a nameable object.

### 9.2 Naming authority and change protocol

This document holds naming authority for the JPWB canon, inheriting that role from RPH-DOC-000. Within the canon:

- New canonical terms, retirements, and meaning changes are proposed via a JPWB-REG-005 finding, sponsor-ratified, then merged (JPWB-CON-000 Part B); no artifact, agent, or implementation introduces canonical vocabulary as a side effect of writing code or prose. The in-model term **Decision** (Section 3) names governed authority inside the product; it is not the change mechanism for this canon.
- Compatibility aliases MUST be explicitly marked as such in canon artifacts, contracts, seeded vocabularies, and UI labels. Non-example: Section 8's permitted residual uses — legacy code, migration adapters, historical documents, informal UI wording for viewpoints — need no alias marking.
- The machine vocabulary artifact (the contracts package's canonical vocabulary file, from which enums are generated and bound by fidelity test) is a **bound derivative** of this document, not a second authority. Divergence between the prose canon and the machine artifact is a defect in the machine artifact until a Decision says otherwise.
- Ontology-owned vocabulary (for example PWU kinds of a specific PWA) is versioned data owned by that PWA, validated as strings against the PWA version — never global engine enums. The engine/ontology vocabulary boundary is itself canonical.

### 9.3 The meta-vocabulary of the canon

**Canonical** means recognized as the standard, normalized, or accepted representation among alternatives. Canonical does not by itself mean governing, mandatory, philosophically foundational, or correct. When the claim is "this wins when sources conflict," the word is **controlling**; when the claim is "this defines supreme commitments and limits," the word is **constitutional**. The **canon** is the recognized corpus of artifacts; **doctrine** is the system of principles they articulate, and doctrine remains evolvable through evidence — it is not dogma.
> Prevents: the documented misuse of "canonical" as if corpus membership conferred governing force.

---

## 10. Content routed elsewhere

The following are vocabulary-adjacent but owned by other canon artifacts; they are cited here only to fix the boundary:

- PWU state axes, lifecycle enumerations, and their transition semantics → JPWB-DOC-003 (owner of the four-orthogonal-axes rule; this document only records that no single status field represents work).
- Disposition semantics and criterion-result values → JPWB-DOC-003 (meanings) and the repository (spellings); this document carries only the recommend/decide split and the finding vocabulary.
- Field names, serialized shapes, and the placement of the four version words on aggregates → the repository (generated contracts, schemas, conformance tests).
- Ownership/reference semantics (`Owned<T>` / `Reference<T>`) and aggregate identity rules → JPWB-DOC-003.
- Candidate vision-tier terms (Professional Scenario, Professional System, Professional Capability, Civilizational Capability) and candidate engineering terms (safe operating envelope, trajectory) → not yet canonical vocabulary; carried as open questions in JPWB-REG-005. The six discipline names themselves, including Shape Engineering, are canonical (Section 4).

*End of JPWB-DOC-002 (DRAFT).*
