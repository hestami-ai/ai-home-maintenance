# Janumi Canonical Implementation Context

## Compact constitution, architecture map, and coding-agent guide

**Document ID:** `JANUMI-CIC-001`  
**Status:** Proposed consolidated baseline  
**Date:** 2026-07-13  
**Audience:** Coding agents, architects, product engineers, UX engineers, validator authors, platform engineers, and reviewers  
**Purpose:** Supply the smallest practical standalone context that preserves the intent, vocabulary, boundaries, invariants, contracts, and implementation discipline of the governing Janumi documentation corpus.

---

## 0. How to use this document

This is not a substitute mega-specification. It is the shared mental model and decision boundary that an implementation agent should load before inspecting the repository and the task-specific contracts.

Normative words have their usual meanings:

- **MUST / MUST NOT** — required for conformance.
- **SHOULD / SHOULD NOT** — expected unless a recorded Decision explains why not.
- **MAY** — permitted, not required.

An agent must still inspect the current code, generated contracts, migrations, tests, and architecture Decisions before changing anything. This document does not authorize a repository-wide redesign, migration, new framework, new service, or vocabulary change merely because the corpus describes a target architecture.

### 0.1 Authority and precedence

The corpus evolved through exploration. Route each question to the matching authority below. This is precedence by concern, not a claim that a fixture governs a wire schema or that storage governs meaning:

1. **Product and vocabulary authority:** `RPH-DOC-000`, the Product Architecture and Canonical Vocabulary Charter.
2. **Architecture intent and scope:** `RPH-DOC-001`, Product Realization migration to RPH.
3. **Professional meaning:** `RPH-DOC-002`, the canonical domain model and invariant catalog.
4. **Product Realization specialization:** `RPH-DOC-003` and `RPH-DOC-004`.
5. **Legacy interpretation:** `RPH-DOC-005`, the semantic inventory and conformance mapping.
6. **Concrete golden fixture:** `RPH-DOC-006`, the Field Service Management SaaS Reference Undertaking.
7. **Serialized boundary:** `RPH-DOC-007`, the Command, Event, and schema contract.
8. **Acceptance behavior:** `RPH-DOC-008`, the executable conformance specification.
9. **Storage and operation:** `RPH-DOC-009`, the persistence, recovery, migration, and cutover design.
10. **User-facing separation:** `RPH-DOC-010`, the PWA Designer and Undertaking Workbench specification.
11. **Engineering practice:** the Engineering Constitution.
12. **Orientation and current implementation architecture:** the Executive Overview and ratified repository Architecture Decisions.
13. **Rationale and candidate future architecture:** the unratified normative drafts embedded in the Constitution Discussion.
14. **Other examples:** illustrative schemas and conversational prose that are not part of the numbered contract.

Meaning, wire shape, persistence, and presentation are different kinds of authority. A later storage example does not redefine professional meaning; a UI label does not redefine a state; and a fixture convenience does not relax an invariant. Conflicts are surfaced, never silently “fixed” by changing a canonical term.

### 0.2 Layered sources of truth

```text
First principles and vocabulary       define why and what terms mean
Canonical semantic model             defines professional meaning
Ratified machine definition          encodes that meaning
Generated contracts                  define executable shapes
Commands + aggregate state + Events  form operational truth
Claims + Evidence + Decisions        establish professional authority
Projections                          expose derived, qualified views
Artifacts/repositories/chat          provide content or provenance, not authority
```

The Constitution Discussion proposes CPCO, JSDL, JEM, and a single-node runtime profile. They are valuable target designs, but their self-applied “Normative” labels were not user-ratified. Use their doctrine where it agrees with the numbered corpus. Do not let their example enums, routes, or runtime topology override ratified contracts or current code.

### 0.3 Agent stop rule

If a task depends on an unresolved item in Section 16, the agent must present the conflict and request or locate a Decision. It must not choose a convenient interpretation and encode it as architecture.

---

## 1. The one-page mental model

Janumi exists to externalize professional cognition into explicit, recursively composable, evidence-bearing, continuously reconciled representations so that humans and AI can reason together without losing intent, authority, or history.

Professional work is not fundamentally a list of tasks, a set of documents, or a workflow. It is reasoning under uncertainty directed toward outcomes. Documents, requirements, architecture, source code, tests, deployments, and dashboards exist because something had to be understood, decided, changed, demonstrated, or observed.

The domain-independent cognitive loop is:

```text
Intent
  → Understanding
  → Representation
  → Reasoning
  → Decision
  → Action
  → Observation
  → Reconciliation
  ↺
```

This is not a mandatory sequence. Any Evidence, Decision, Action, Observation, contradiction, or failed Assumption may reopen earlier reasoning.

The product hierarchy is:

```text
Janumi                                      company and product family
└── Janumi Platform                        shared technical/service foundation
    ├── Janumi Professional Workbench      general professional-work environment
    │   └── Recursive Professional Harness underlying coordination/control architecture
    ├── JanumiCode                         software-product domain product
    ├── JanumiLegal                        legal domain product
    ├── JanumiHealth                       health domain product
    ├── JanumiConstruction                 construction domain product
    └── shared platform and enterprise services
```

The reusable-to-concrete work chain is:

```text
PWA + immutable published version
    defines PWU Types, rules, policies, roles, and baseline types
        ↓ explicitly instantiated
Undertaking bound to that exact PWA version/profile
        ↓ owns
Professional Work Graph
    concrete PWU Instances and related professional objects
        ↓ performed through
Execution Plans and temporal Execution Workflows
        ↓ evaluated and governed through
Claims → Evidence → Assurance → Decisions → Baselines
        ↓ may produce
Product Shape Package, Implementation Package, deployed product, or other outcome
```

The Charter permits an Undertaking under one or more compatible PWA versions, while the current slice operationalizes one selected PWA/profile/version binding. Multi-PWA composition is not yet contracted; follow Section 16 item 2 rather than inventing merge or precedence semantics.

The central completion test is deliberately demanding:

```text
An agent produced output
≠ the output followed local instructions
≠ execution succeeded
≠ the PWU obligation is satisfied
≠ children collectively satisfy the parent
≠ the work preserves Intent
≠ Evidence justifies acceptance
≠ an authorized actor accepted it
≠ the desired Outcome occurred in reality
```

---

## 2. Governing principles

1. **Intent is authoritative.** Work exists to serve approved Intent or an explicitly provisional exploratory purpose. Decomposition must change when it no longer serves Intent; Intent must not be distorted to preserve a convenient plan.

2. **Outcomes are changes in reality.** A deliverable, commit, build, deployment, report, or checked box is not an Outcome. Janumi contains representations and observations of reality, never reality itself.

3. **Uncertainty is first-class.** Questions, ambiguity, Assumptions, contradictions, Evidence gaps, limitations, and residual uncertainty are professional state, not UI clutter or failure to be hidden.

4. **Professional work is recursively bounded.** A PWU is the smallest governable region with a coherent objective, scope, obligations, constraints, Evidence needs, completion meaning, and recomposition contribution. It is not a task, ticket, prompt, chat, file, API call, retry, or compute job.

5. **Every decomposition creates a recomposition obligation.** Child activity or satisfaction never proves the parent. The parent must synthesize compatible, assured child results and re-evaluate its own obligations and constraints.

6. **Execution and assurance are independent.** Successful generation, tool use, testing, or workflow completion can leave professional claims unsupported. Assurance evaluates claims against admissible Evidence under versioned policies.

7. **Capability is not authority.** Authentication, role, ownership, visibility, technical capability, and professional authority are distinct. AI output is proposed state by default. Consequential approval remains human-governed unless an explicit ratified policy defines a bounded autonomous mode.

8. **One governed model, many projections.** Requirements, architecture, implementation, verification, decisions, and operations are views over connected professional state, not isolated modules with separate truth.

9. **AI participation is visible.** Material AI contributions identify agent, role, model/version, execution context, tools, Evidence, Assumptions, limitations, and accepted/rejected disposition. Preserve professional rationale; do not require or store private chain-of-thought.

10. **State and history are explicit.** Do not infer lifecycle, validity, approval, assurance, or authority from null fields, storage location, UI placement, or prose. Material revisions, supersession, reopening, corrections, and reconciliation remain reconstructable.

11. **Detected incoherence remains visible.** Contradictions are resolved, tolerated, deferred, dismissed, or escalated explicitly. They are never erased because one side is newer or more fluent.

12. **Assurance and structure are risk-proportional.** Consequence, uncertainty, irreversibility, security, regulation, and organizational policy determine rigor. Avoid both under-governance and ceremonial over-modeling.

13. **Runtime authority is separate from work definition.** A PWA, PWU, plan, prompt, or agent may request a capability; only runtime policy may grant tools, files, network, secrets, models, sandboxes, or privilege.

14. **Professional waiting and failure are durable.** Human waits, external dependencies, retries, Attention, Process/RPH state, and partial work survive restart. Insufficient authority, Evidence, capability, budget, or productive tactics causes safe stop or escalation, never fabricated completion.

15. **Implement narrowly.** Prefer the smallest mechanism that preserves approved semantics. Scope changes, architectural deviations, and new abstractions require explicit rationale and Decision.

---

## 3. Canonical vocabulary and non-equivalences

| Term | Canonical meaning |
|---|---|
| **Janumi** | Company, brand, product family, and organizational authority. |
| **Janumi Platform** | Shared multi-tenant infrastructure, runtime, identity, commercial, integration, governance, and professional-work services. It supplies machinery, not domain semantics. |
| **Janumi Professional Workbench (JPWB)** | General environment for designing/versioning PWAs and operating, executing, assuring, governing, tracing, and baselining Undertakings. |
| **Recursive Professional Harness (RPH)** | Coordination/control architecture that frames, allocates, supervises, reconciles, synthesizes, and escalates recursive professional work. It may use workflow engines and agent orchestration but is not defined by them. |
| **Professional Work Architecture (PWA)** | Reusable, versioned architecture for a class of professional work: PWU Types, relationships, obligations, constraints, artifacts, policies, roles, authorities, baselines, profiles, fixtures, and conformance. Not primarily a sequence. |
| **Professional Work Unit (PWU)** | Bounded, identifiable, executable, assessable, traceable, and governable unit of professional work. |
| **PWU Type** | Reusable definition owned by a PWA version. |
| **PWU Instance** | Concrete PWU owned by one Undertaking. A local extension is explicitly marked and does not mutate its PWA. |
| **Undertaking** | Concrete body of professional work instantiated under one or more compatible PWA versions. It owns actual state, Evidence, Decisions, and Baselines. |
| **Professional Work Graph** | The typed semantic graph of PWU Instances and related objects belonging to an Undertaking. |
| **Execution Plan** | Governed, versioned strategy for performing selected PWUs. |
| **Execution Workflow** | Temporal machinery that carries out a plan: steps, branches, loops, waits, agents, humans, and tools. |
| **Assurance Policy** | Versioned professional rule defining applicability, claims, Evidence, criteria, independence, dispositions, remediation, escalation, and waiver. |
| **Validator** | Replaceable runtime implementation of an Assurance Policy. It recommends; it does not decide or mutate authority. |
| **Decision** | Governed exercise of authority over approval, rejection, waiver, escalation, reshaping, replanning, risk acceptance, or promotion. A Decision is not truth. |
| **Baseline** | Immutable, version-bound, authoritative accepted state produced by an effective promotion Decision. A commit may be included but is not a Baseline. |
| **View** | User-facing representation of underlying professional-work or execution data. A View may use one or more Projections. It is presentation, not architecture or authority. |
| **Projection** | Derived representation optimized for a particular question or user need. It is rebuildable and never an independent source of truth. |
| **Viewpoint** | Organizing concern through which data is selected or arranged, such as security, architecture, compliance, or operations. |
| **Product Shape Package** | Governed export of shaping outputs for implementation, review, audit, or external handoff. |
| **Implementation Package** | Source, tests, build/deployment definitions, migration tooling, documentation, Evidence, and release artifacts that contain or enable the realization. |
| **JanumiCode** | Software-product domain specialization of JPWB containing multiple software PWAs, Views, policies, agent/repository/IDE/build/test/deployment integrations. It is not one PWA. |

Always preserve these inequalities:

```text
Outcome ≠ Artifact                 Intent ≠ Requirement
Observation ≠ Evidence            Evidence ≠ Claim
Claim ≠ Decision                   Decision ≠ Truth
Decision ≠ Action                  Action ≠ Outcome
Representation ≠ Reality          Artifact ≠ Representation
Participant ≠ Stakeholder         Actor identity ≠ Authority
Ownership ≠ Authority             Validation ≠ Approval
Confidence ≠ Certainty             Accepted Assumption ≠ Verified Assumption
PWU ≠ Task                         RPH ≠ Workflow Engine
PWA ≠ Execution Workflow           Work Graph ≠ Execution Graph
Commit ≠ Baseline                  Product ≠ Undertaking
Projection/chat/repository/memory ≠ authoritative semantic state
```

### 3.1 Retired and compatibility terminology

- `Product Lens` → **Product Realization PWA**.
- `Lens Designer` / `Lens Library` → **PWA Designer** / **PWA Library**.
- `workflow` for the whole professional structure → **PWA** or **Professional Work Graph**; reserve workflow for temporal execution.
- `phase` → derived compatibility milestone where legacy support requires it.
- `dialogue` → interaction/provenance record, not the Undertaking or authoritative work root.
- `REPLAN` → controller action, not a universal terminal phase.
- `COMMIT` → repository operation plus separate Baseline governance.
- `Professional Endeavor` in later drafts is a candidate generic semantic supertype/alias. At product and UX boundaries use the Charter’s canonical term **Undertaking**; do not create a second competing root without a Decision.

### 3.2 PWA derivation and version authority

```text
Janumi-published PWA
    ↓ optional bounded configuration
PWA Profile
    ↓ optional governed fork/extension
Tenant-derived PWA
    ↓ exact version instantiated as
Undertaking
    ↓ optional permitted extension
Undertaking-local PWU Instances
```

Published PWA versions are immutable. An existing Undertaking remains bound to its selected version until an explicit migration, local extension, governed compatibility policy, or successor Undertaking. PWA changes never silently mutate existing Undertakings. Learning flows upward as a PWA Change Proposal, conformance review, and new published version.

---

## 4. Integrated architecture

### 4.1 Semantic-to-runtime stack

```text
Product Constitution and Vocabulary Charter
        ↓
Canonical professional semantics
    numbered RPH domain model; candidate CPCO refinements
        ↓
Professional Work Architecture
    domain vocabulary, PWU Types, policies, roles, projections
        ↓
Professional Work Units and Undertakings
    bounded concrete professional state
        ↓
Recursive Professional Harness
    recursive coordination, allocation, reconciliation, synthesis
        ↓
Machine definition and generated contracts
    current schemas; candidate JSDL → canonical IR → generators
        ↓
Execution semantics
    Commands, aggregates, Events, validators, durable processes
        ↓
Runtime profile and infrastructure
        ↓
Derived projections and user experiences
```

The later draft architecture calls the technology-neutral execution layer **JEM**. Use that name only where the code or a ratified Decision has adopted it. The stable rule is the behavior, not the label or deployment topology.

### 4.2 Six disciplines that must remain separate

| Discipline | Governs |
|---|---|
| **Prompt Engineering** | Invocation instructions, immediate objective, output contract, examples, and formatting. |
| **Context Engineering** | Relevant artifacts, history, Decisions, Evidence, retrieval, prioritization, freshness, compression, and exclusion. |
| **Harness Engineering** | Models, agents, tools, sandboxes, permissions, memory infrastructure, persistence, observability, and operational controls. |
| **Loop Engineering** | Next action, branching, retries, tactic change, convergence, escalation, and termination. |
| **Shape Engineering** | Intent, boundaries, obligations, constraints, Assumptions, decomposition, recomposition, and semantic integrity. |
| **Assurance Engineering** | Claims, Evidence, criteria, observations, independence, Decisions, waivers, residual uncertainty, and acceptance. |

A prompt is not a role; a role is not a model binding; a plan is not a PWU; a validator is not a policy; runtime privilege is not domain permission.

### 4.3 Logical responsibility boundaries

The canonical logical services are:

- Work / semantic object service;
- Shape, decomposition, and recomposition service;
- Execution planning and durable process/controller service;
- Runtime authorization and harness-binding service;
- Agent/tool/sandbox execution service;
- Evidence and Assurance service;
- Governance and Baseline service;
- Traceability, impact, reconciliation, and Attention service;
- Event, audit, artifact, projection, integration, and observability services.

These are responsibility boundaries, not mandatory microservices. A modular monolith is valid when it preserves them. Runtime topology must not change professional meaning.

---

## 5. Canonical semantic model

### 5.1 Five layers

1. **Reality:** the external world being understood or changed.
2. **Cognition:** explicit understanding—Intent, Questions, Claims, Assumptions, models, Alternatives, Decisions, and confidence.
3. **Work:** bounded cognition and obligation represented by PWUs.
4. **Coordination:** allocation, supervision, synchronization, reconciliation, synthesis, and escalation represented by RPH behavior.
5. **Projection:** human- or machine-usable derived views.

Do not collapse an Observation of reality into reality, a Representation into the thing represented, a PWU into its execution, or a projection into authority.

### 5.2 Core semantic objects

The numbered RPH model remains the implementation baseline. The table below also shows later CPCO refinements so agents can understand the whole semantic intent; it is not permission to add new discriminators, tables, or Commands. Candidate-only concepts remain doctrine, projections, or declared extensions until Section 16 item 15 is resolved; if adopted, they must map into the same versioned object/relationship system rather than create duplicate truth.

| Object | Meaning / minimum rule |
|---|---|
| **Intent** | Originating expression, formalized objective, outcomes, success conditions, boundaries, constraints, non-goals, ambiguity, and approval state. Preserve the raw expression exactly. |
| **Outcome** | Desired or observed change in reality with beneficiary, criteria, time horizon, and evaluation method. |
| **Stakeholder / Participant** | Affected party versus an actor contributing work. Participant identity, role, accountability, and authority remain distinct. |
| **Question / Uncertainty** | What must be answered versus the characterized limit of knowledge. Both have explicit state and impact. |
| **PWU** | Concrete bounded work aggregate/root with objective, Intent, scope, obligations, constraints, Assumptions, dependencies, required outputs/Evidence, and independent state axes. |
| **Obligation** | Required professional condition that cannot disappear; satisfaction requires a supported Claim or valid waiver/supersession. |
| **Constraint** | Authoritative limit with type, source, applicability, strength, status, and propagation. Mandatory constraints cannot be silently weakened or dropped. |
| **Assumption** | Explicit condition believed or accepted for reasoning. Material Assumptions identify basis, risk, affected objects, verification need, and lifecycle. |
| **Representation** | Meaning-bearing externalization: requirement, model, architecture, code, plan, contract, or narrative. |
| **Artifact** | Persistent embodiment/reference such as a file, commit, document, test report, image, or deployment manifest. One Representation may have several Artifacts. |
| **Reasoning Activity / Alternative** | Attributable method or analysis and the candidate choices it considers. Preserve professional rationale, not private chain-of-thought. |
| **Claim** | Explicit assertion about completeness, correctness, compliance, consistency, fitness, preservation, feasibility, or performance. |
| **Evidence** | Admitted, provenance-bearing support or contradiction for scoped Claims; includes limitations and validity. Generated output is not automatically Evidence. |
| **Confidence Assessment** | Qualified assessment with basis and limitations. It cannot replace Evidence or become an unexplained aggregate score. |
| **Assurance Assessment / Validation** | Evaluation of Claims/subjects under a policy and exact semantic versions. |
| **Observation / Finding** | What was detected or measured and its professional implication. Observation, interpretation, and Claim remain separate. |
| **Decision** | Authorized selection/disposition with subject versions, alternatives, rationale, Evidence, observations, scope, effective time, and authority proof. |
| **Action** | Authorized attempt to change reality or an operational system. Technical success does not prove Outcome success. |
| **Dependency / Risk / Issue** | Required relationship, uncertain threat/opportunity, and realized problem; each links to affected work/outcomes and state. |
| **Decomposition / Recomposition Contract** | Explicit conservation/allocation of parent meaning and rules for reconstructing parent satisfaction. |
| **Execution Plan / Step / Attempt / Runtime Binding** | Governed strategy, temporal operations, individual executions, and authorized models/tools/context/sandbox capabilities. |
| **Reconciliation** | Governed case that preserves prior state and resolves drift, contradiction, invalidated Assumptions, or changed reality through normal Commands. |
| **Baseline** | Immutable exact-version manifest, with content hashes where applicable, plus Evidence, assessments, Decisions, purpose, scope, and supersession. |
| **Narrative Memory** | Interpretive, provenance-linked account of evolution. It never replaces canonical Events, objects, or Evidence. |

### 5.3 Common object contract

Every authoritative semantic object needs:

- immutable globally unique ID and explicit type;
- `revision` for every persisted change and `semanticVersion` for changed meaning;
- explicit lifecycle/validity state, never inferred from missing data;
- created/updated actor and time plus provenance origin/source/content hash where applicable;
- tenant and organization scope;
- authority or authority reference where professional effect requires it;
- versioned extensions only at declared extension points;
- traceable prior/superseding versions;
- transaction time, valid time, observation time, and Decision effective time where their distinction matters.

Use opaque prefixed ULID identifiers where the ratified wire contract applies. The registered initial prefixes are `pwa`, `pwut`, `und`, `int`, `pwu`, `con`, `asm`, `clm`, `evd`, `pol`, `assess`, `obs`, `plan`, `step`, `bind`, `dec`, `base`, `trace`, `cmd`, `evt`, and `attempt`. Missing prefixes such as Obligation, Artifact, decomposition/recomposition, and migration records require a Decision before schemas reject or generate them.

### 5.4 Aggregate boundaries

- **Work Aggregate**, rooted at a PWU Instance: Intent reference, PWU, Obligations, Constraints, Assumptions, decomposition/recomposition, and work transitions.
- **Assurance Aggregate**, rooted at an Assurance Assessment: Claims, Evidence references, policy, observations, disposition, and waiver references.
- **Execution Aggregate**, rooted at an Execution Plan: steps, attempts, results, retries, and tactic state.
- **Governance Aggregate**, rooted at a Decision: approvals, rejection, waivers, escalation, revocation, and promotion authorization.
- **Baseline Aggregate**, rooted at a Baseline: exact items, Evidence/assessment package, status, and supersession.

A semantic PWU is one coherent user concept; it need not be one giant transactional record. Cross-aggregate changes use Commands, Events, durable processes, reconciliation, and compensation—not direct table mutation or an unbounded transaction.

### 5.5 Relationships and traceability

Relations are typed, directed, attributable, and version-aware. The stable core includes:

```text
DERIVED_FROM  REFINES       DECOMPOSES    ALLOCATES
SATISFIES     DEPENDS_ON    CONSTRAINED_BY PROPAGATES
ASSUMES       PRODUCES      IMPLEMENTS    SUPPORTS
CONTRADICTS   VERIFIES      VALIDATES     INVALIDATES
GOVERNS       APPROVES      SUPERSEDES    PROMOTES
IMPACTS       REALIZES      DEFINES
```

Generic unlabeled links are insufficient for authoritative reasoning. Trace corrections supersede prior links; they do not rewrite history.

---

## 6. PWU, decomposition, recomposition, and state

### 6.1 Readiness

A PWU is ready only when it has:

- one clear professional objective and active/provisional Intent or explicit exploratory authority;
- explicit in-scope and out-of-scope boundaries, or explicit unknowns;
- mandatory Obligations, Constraints, material Assumptions, dependencies, and responsible authority;
- required inputs, expected outputs, completion Claim/criteria, Evidence and assurance expectations;
- a risk/assurance profile and applicable decomposition/recomposition rules.

Do not create a PWU for prompt rendering, retrieval, an API call, formatting, a database write, a retry, or a UI click. Those are execution/runtime steps unless they independently carry professional meaning, obligation, Evidence, and lifecycle.

### 6.2 Decomposition contract

Decomposition is a Claim that children collectively cover their parent. It must record:

- parent and child identities;
- rationale and inherited Intent mappings;
- allocation or retention of every mandatory parent Obligation;
- propagation, retention, authorized waiver, or reasoned inapplicability of every applicable mandatory Constraint;
- material Assumptions and affected children;
- sibling identities, dependencies, and coordination rules;
- coverage Claims and validation status;
- a recomposition strategy.

Conservation rule:

```text
mandatory parent obligations
  = allocated to children
  + retained by parent
  + already satisfied
  + explicitly waived/superseded by valid authority
```

High-risk decomposition requires independent validation. A revision changes semantic version and triggers impact analysis.

### 6.3 Recomposition contract

Recomposition checks:

- required child state and assurance;
- unresolved findings and contradictions;
- obligation coverage and parent Constraint preservation;
- artifact/interface/data compatibility;
- integration Evidence;
- child Evidence support for the parent Claim;
- parent-level fitness and residual uncertainty.

Valid reasoning is:

```text
assured required child results
+ mutual compatibility
+ preserved parent constraints
+ sufficient combined Evidence
→ parent may be satisfied
```

“All children completed, therefore parent completed” is always invalid.

### 6.4 Canonical state axes

Use the ratified command/schema contract, not draft examples in the Constitution Discussion.

**Work lifecycle**

```text
PROPOSED → SHAPING → READY → PLANNED → EXECUTING
→ EVIDENCE_PENDING → UNDER_ASSURANCE

UNDER_ASSURANCE → CONDITIONALLY_SATISFIED
UNDER_ASSURANCE → SATISFIED → BASELINED
UNDER_ASSURANCE → SATISFIED → RECOMPOSING → RECOMPOSED → BASELINED
```

The recomposition branch applies only when a parent exists and recomposition is required. `CONDITIONALLY_SATISFIED` cannot enter recomposition or Baseline promotion through this matrix.

Additional explicit states: `BLOCKED`, `CHALLENGED`, `RESHAPING`, `ESCALATED`, `INVALIDATED`, `REJECTED`, `ABANDONED`, `SUPERSEDED`.

**Execution state**

```text
NOT_PLANNED | PLANNED | QUEUED | RUNNING | WAITING | RETRYING
| SUCCEEDED | FAILED | CANCELLED | SUPERSEDED
```

**PWU assurance state**

```text
NOT_REQUIRED | UNASSESSED | EVIDENCE_REQUIRED | READY_FOR_ASSESSMENT
| ASSESSING | CONDITIONALLY_SATISFIED | SATISFIED | REJECTED
| WAIVED | INVALIDATED | ESCALATED
```

**Shape-integrity state**

```text
UNKNOWN | PRESERVED | AT_RISK | VIOLATED | RESHAPING_REQUIRED
| RESHAPING_IN_PROGRESS | RESTORED
```

The later cognitive model adds an orthogonal **cognitive focus**:

```text
INTENT | UNDERSTANDING | REPRESENTATION | REASONING
| DECISION | ACTION | OBSERVATION | RECONCILIATION
```

Treat cognitive focus as an additive viewpoint, not a replacement lifecycle. Do not implement the Constitution Discussion’s alternative `proposed/framing/active/awaiting_*` lifecycle alongside the canonical runtime enum. Wait reasons belong in durable Process/Attention/blocking state unless a ratified contract says otherwise.

Other exact state sets:

- decomposition: `DRAFT | UNDER_REVIEW | VALID | CONDITIONALLY_VALID | INVALID | SUPERSEDED`;
- recomposition: `DRAFT | READY | EVALUATING | COMPOSABLE | CONFLICTED | INSUFFICIENT | SATISFIED | SUPERSEDED`;
- plan: `PROPOSED | UNDER_REVIEW | APPROVED | ACTIVE | COMPLETED | FAILED | SUPERSEDED | CANCELLED`;
- runtime binding: `REQUESTED | AUTHORIZED | PARTIALLY_AUTHORIZED | DENIED | REVOKED`;
- Baseline: `DRAFT | CANDIDATE | UNDER_REVIEW | APPROVED | AUTHORITATIVE | SUPERSEDED | REVOKED`.

### 6.5 Critical transition guards

- Root readiness requires Intent at least provisional; authoritative root satisfaction requires approved Intent or an explicitly provisional result.
- `PROPOSED → EXECUTING`, `SHAPING → SATISFIED`, `EXECUTING → SATISFIED` without assurance, `FAILED → SATISFIED`, `INVALIDATED → BASELINED`, and execution of `SUPERSEDED` work are illegal.
- One active Execution Plan exists per PWU.
- Execution requires an approved Plan and authorized Runtime Bindings.
- Execution success moves work toward Evidence/assurance, never directly to satisfaction.
- A falsified material Assumption triggers impact analysis and shape-risk/invalidation.
- An invalidated or semantically changed satisfied PWU cannot be baselined without reassessment.
- Baselined work is immutable; change creates a successor/revision rather than resuming it in place.

---

## 7. Product Realization PWA and JanumiCode specialization

### 7.1 Mission

The Product Realization PWA transforms underspecified product Intent into an implemented, assured, traceable, and authoritatively accepted software baseline while preserving authorized Intent through every transformation.

It must establish more than working code:

- the intended problem and users were understood;
- desired Outcomes and critical Constraints were preserved;
- journeys, requirements, and architecture cover the approved shape;
- implementation conforms or an authorized Decision changes the shape;
- material Assumptions are explicit;
- Claims have adequate Evidence;
- validation covers fitness for purpose, not only local correctness;
- residual uncertainty and risk are visible;
- acceptance and Baseline promotion were exercised by valid authority.

### 7.2 Canonical seven-branch hierarchy

```text
Product Realization
├── Intent and Product Definition
├── Product Behavior Definition
├── Architecture Definition
├── Implementation Planning
├── Product Implementation
├── Integrated Product Validation
└── Product Baseline Promotion
```

Typical semantic children are:

- **Intent and Product Definition:** Intent Discovery, Product Boundary, Stakeholder, Business Domain, Desired Outcome, Constraints, Non-Goals, Intent Baseline Assembly.
- **Product Behavior Definition:** Actors, Capabilities, User Journeys, Scenarios, Requirements, Acceptance Criteria, Domain Entities, Integration Requirements.
- **Architecture Definition:** System Context, Architecture Drivers, Component, Data, Integration, Security, Deployment, Observability, Resilience, and Architecture Decisions.
- **Implementation Planning:** Increment, Work Decomposition, Dependency/Repository Impact, Risk and Assumption Analysis, Test/Migration/Rollback Strategy, and Execution Plan.
- **Product Implementation:** coherent feature, API, UI, data, integration, security, test, migration, documentation, and deployment obligations.
- **Integrated Product Validation:** Requirement and Journey Validation, Architecture Conformance, Integration, Regression, Security, Operational/Migration Validation, Fitness for Purpose, and Evidence Package Assembly.
- **Product Baseline Promotion:** exact candidate manifest, required Evidence/assessments, residual-risk disposition, authorized promotion, and immutable Baseline.

Not every possible child is instantiated. Applicability depends on the selected immutable PWA version, profile, risk, and Undertaking scope. Never create empty PWUs to make a diagram look complete.

Older compatibility trees sometimes omit Product Behavior or shorten branch names. Retain those only in legacy projections; use the seven-branch structure for canonical Product Realization work.

### 7.3 Two independent profile axes

Do not collapse assurance rigor into work shape.

**Assurance/conformance rigor**

| Profile | Use and minimum consequence |
|---|---|
| **Lightweight** | Small, reversible, low-risk work. Explicit bounded Intent, Constraints, output, local Evidence, basic validation, no unresolved critical Assumption; separate validator invocation. |
| **Standard** | Ordinary user-facing, multi-component, API/database, or material architecture work. Journeys/acceptance, impact, decomposition, Assumption disclosure, independent verification, integration Evidence, and human/delegated approval. |
| **High Assurance** | Security-sensitive, regulated, production migration, high-impact, or difficult-to-reverse work. Strong Evidence, rollback/recovery, impact analysis, independent specialist/model/provider, human authority, residual-risk Decision, restricted waivers, immutable package. |

**Product Realization work-shape profiles**

- Exploratory Product Shape;
- Feature Delivery Shape;
- Brownfield Change Shape;
- Migration Shape;
- High-Assurance Shape.

Brownfield work adds existing-structure inquiry, historical rationale, compatibility, impact, and regression obligations. Migration adds source/target states, transformation, reconciliation, cutover, rollback, integrity Evidence, and operational monitoring. Exploratory work may use provisional Intent but may not claim a production Baseline.

### 7.4 Role responsibilities

| Role | Responsibility and authority boundary |
|---|---|
| **Technical Expert** | Discovery, clarification, product reasoning. May propose Intent; cannot approve without delegation. |
| **Product Modeler** | Actors, Capabilities, Journeys, Requirements, Domain Entities, Acceptance Criteria. |
| **Architect** | Structure, interfaces, Decisions, technical Constraints, architecture Evidence. |
| **Planner** | Decomposition, dependencies, execution strategy, risk, migration, rollback. |
| **Maker** | Implementation and execution Evidence; must disclose Assumptions, deviations, and limitations. |
| **Verifier** | Evidence gathering, Claim evaluation, contradiction detection, assurance. |
| **Historian-Interpreter** | Relevant precedent, applicability, recurring failure, unexplained divergence. |
| **Hypothesizer** | Plausible failure hypotheses and discriminating checks. |
| **Human Governor** | Intent approval, ambiguity/risk resolution, material shape change, waiver, and Baseline promotion. |

Names such as Undertaking Owner, Implementation Planner, Assurance Reviewer, and Platform Operator are UX/operational roles that require an explicit alias and authority mapping before being hardcoded. A role is a professional responsibility; its model, agent, provider, tool, and runtime binding are separate.

### 7.5 Context defaults

Context is selected by relationship to the work, not merely semantic similarity.

- **Intent work:** originating expression, interaction history, supplied sources, known Constraints, current product state; exclude speculative implementation and unverified external Claims by default.
- **Architecture work:** approved Intent, Outcomes, Journeys, Requirements, existing architecture/repository, technical Constraints, and relevant prior Decisions.
- **Implementation work:** allocated Requirements, relevant architecture/files/dependencies/tests, Constraints, open Assumptions, and applicable assurance observations.
- **Assurance work:** exact subject/Claim/policy versions, admitted Evidence, relevant Intent/Constraints, producer provenance, and prior findings.

Context omission must not silently remove a mandatory Constraint. Context summaries retain provenance. Conversation is context/provenance by default; only admitted extracted content becomes Evidence.

### 7.6 Artifact families

- **Intent:** originating request, Product Intent, boundary, stakeholder, Constraint, non-goal.
- **Behavior:** capability, actor, Journey, Scenario, Requirement, Acceptance Criterion, domain model, integration catalog.
- **Architecture:** context, component/data/interface/security/deployment/operational model and ADR.
- **Planning:** increment, decomposition, dependency graph, Execution Plan, test/migration/rollback plan.
- **Implementation:** source, tests, schemas, configuration, migrations, documentation, manifests, generated assets.
- **Assurance:** Claims, Evidence, reports, findings, traces, test/coverage results, residual-risk record.
- **Governance:** approval, rejection, waiver, promotion Decision, Baseline.

Each Artifact has identity, provenance, semantic version, producing PWU, linked Claims, status and supersession, plus a content hash where applicable.

### 7.7 JanumiCode is a domain product, not a single PWA

JanumiCode combines JPWB/RPH with multiple software PWAs and domain-specific Views, policies, roles, artifacts, agents, IDE/repository/build/test/deployment integrations. Examples include:

- Product Realization PWA;
- Product Operations PWA;
- Security Maintenance PWA;
- Brownfield Modernization PWA;
- Product Migration PWA;
- Incident and Recovery PWA.

The Constitution Discussion’s `JCPWA` material is useful as a JanumiCode domain profile and an extension of Product Realization semantics. It must not collapse JanumiCode back into one PWA or silently put release, operations, incidents, and all maintenance inside Product Realization. Classify each recurring concern explicitly as an independent PWA, PWA module, PWA profile, Undertaking-local work, or View.

For a material software Change, JanumiCode must be able to answer:

- Which Intent, Outcome, Journey, or Requirement justifies it?
- Which Architecture Decision and invariants govern it?
- Who or what proposed and implemented it?
- Which Evidence and tests support it?
- Which Release contains it and what was observed after deployment?
- Which Assumptions, residual risks, contradictions, and reconciliations remain?

Git metadata and CI status alone are not a JanumiCode professional model.

### 7.8 Field Service Management reference fixture

The **Field Service Management SaaS Reference Undertaking** is a deterministic semantic, replay, UX, assurance, and migration fixture. It is not the Product Realization PWA and is not the resulting Field Service product.

The fixture’s objective is a multi-tenant SaaS for small/lower-middle-market trades businesses covering customers/locations, requests, estimates, scheduling, field assignment/status, technician activity, invoicing, communication, and web/mobile use.

Mandatory constraints include enforceable tenant isolation, auditable material operational state, and multi-trade extensibility without imposing one trade’s workflow universally. Material Assumptions include US-first scope, small-business target, eventual limited offline capability, and delegated payment processing while payment state remains recorded.

Its Architecture children are System Context, Multi-Tenancy, Data, Mobile/Offline, and Integration. The first Architecture Coverage assessment is intentionally `CONDITIONALLY_SATISFIED` because offline conflict behavior is insufficiently bounded and tenant-isolation verification must cover authorization, queries, caches, queues/background jobs, object storage, and integrations. The controller clarifies/revises/reassesses before presenting a human package; it never marks the PWU satisfied from execution alone.

Use the fixture in three modes:

- **seed:** load its final state;
- **replay:** rebuild from expected JSONL Events;
- **conformance:** execute Commands and compare state/projections.

Its acceptance tests include execution/assurance separation, Assumption persistence, Constraint propagation, decomposition coverage, approval-version binding, blocking findings, conditional-state visibility, presentation independence, Intent-change impact, and Evidence invalidation.

---

## 8. Assurance, governance, and Baselines

### 8.1 Policy, validator, service, and Decision

The governing rule is:

> A Validator is a replaceable implementation of a versioned Assurance Policy. It evaluates identified Claims using identified Evidence and returns schema-conformant proposed findings and a disposition recommendation. The Assurance Service validates the result, enforces policy, and records the authoritative disposition. Governance Decisions exercise authority.

A policy owns professional purpose, applicability, Claims, Evidence requirements, criteria, independence, severity, dispositions, remediation, escalation, waiver, and permitted control actions.

A Validator owns prompts, deterministic checks, models, tools, retrieval, algorithms, parsing, execution limits, and known limitations. A model, deterministic engine, hybrid, human procedure, or external service may implement the same policy. Validators never directly mutate professional state and never return only free-form prose, pass/fail, or unscoped confidence.

A valid Validator result identifies:

- validator and policy identities/versions;
- Assessment and exact subject semantic versions;
- Claim and criterion results;
- considered and rejected Evidence;
- proposed observations and severity;
- disposition recommendation and suggested control actions;
- residual uncertainty, limitations, and execution provenance.

`WAIVED` is not a Validator recommendation. It is a governance disposition.

### 8.2 Core policy catalog

The initial catalog ships these twelve policies. “Core” means present in the catalog; applicability decides whether an Assessment is required for a given object.

| Policy | Governing purpose |
|---|---|
| **Intent Fidelity** | Formalization/revision preserves objective, boundary, Constraints, non-goals, authorized clarification, and visible ambiguity. Unauthorized Intent alteration is not waivable; approved change is an Intent revision. |
| **Intent Completeness** | Risk-relative sufficiency before downstream shaping; explicitly reversible exploration may remain provisional. |
| **Assumption Disclosure** | Model-produced material artifacts, decomposition, architecture, plans, validation, and migration expose typed Assumptions and impact. Disclosure is not verification. |
| **Requirement Coverage** | Approved Capabilities, Outcomes, Journeys, and mandatory Constraints are covered before architecture and after material changes. |
| **Decomposition Coverage** | Mandatory Obligations/Constraints, intent continuity, cohesion, boundaries, dependencies, and recomposition feasibility are preserved. |
| **Constraint Propagation** | No silent drop or unauthorized weakening across decomposition or semantic change. |
| **Architecture Coverage** | Applicable behavior, security, tenancy, data integrity, interfaces, deployment, operations, and mandatory Constraints are addressed. |
| **Historical Consistency** | Relevant precedent is considered with provenance; justified divergence is valid and stale precedent is not binding. |
| **Intent Preservation** | Major transformations have not introduced unauthorized drift or scope expansion. |
| **Test Adequacy** | Strategy and Evidence adequately cover scoped Claims; passing tests establish only what they actually test. |
| **Fitness for Purpose** | Integrated product behavior serves approved users/Outcomes in the intended context; requires independent and human/organizational judgment by profile. |
| **Baseline Promotion** | Exact versions/hashes, required assessments, authority, residual risk, and purpose/scope support authoritative acceptance. |

Recommended subsequent policies include Requirement Quality, Journey Coverage, Architecture Consistency/Conformance, Implementation Scope Conformance, Evidence Sufficiency, Recomposition Integrity, Security Assurance, Migration Assurance, and Observability Sufficiency.

### 8.3 Evidence admissibility

Evidence is admissible only when identity is stable, provenance and content/reference are available, scope and limitations are explicit, relevance and freshness are adequate, and it is not invalidated.

Existence is not proof:

- an execution trace proves execution, not Intent satisfaction;
- a test result proves only its scoped behavior, not Requirement coverage by itself;
- an architecture document does not prove completeness;
- a citation proves a source made a statement, not that the statement is correct;
- a Validator opinion is Evidence only when professional judgment is permitted;
- generated prose remains an Artifact until admitted as Evidence.

Evidence corrections create a new version. Invalidated or expired Evidence cannot support active satisfaction and triggers review of dependent Claims, Assessments, Decisions, and Baseline readiness. Contradicting Evidence remains visible.

### 8.4 Criteria, independence, and observations

Criterion results are:

```text
MET | PARTIALLY_MET | NOT_MET | NOT_APPLICABLE | UNABLE_TO_DETERMINE
```

`UNABLE_TO_DETERMINE` is never `MET`.

Independence levels range from no separation through different invocation/context, agent, model, provider, human, or organizational independence. The runtime checks actual invocation, agent, model/provider, hidden context, prompt lineage, and organizational authority—not a role label such as “Verifier.” If required independence is missing, the Assessment cannot be satisfied; record an independence violation and use another evaluator or a valid scoped waiver.

Every material observation identifies subject, policy, criterion, Evidence or explicit professional judgment, severity, precise deficiency, implications, and recommended action. Avoid vague findings such as “looks reasonable” or “could improve.”

### 8.5 Dispositions and composition

```text
SATISFIED               admissible Evidence supports all required criteria
CONDITIONALLY_SATISFIED explicit conditions/follow-up remain
REJECTED                material Claim unsupported/contradicted or blocking rule violated
INCONCLUSIVE            Evidence cannot support or reject
WAIVED                  authorized acceptance of scoped unsatisfied criteria
ESCALATED               resolution exceeds current evaluator/policy authority or competence
```

Default precedence:

- open critical finding → `REJECTED` or `ESCALATED`;
- open blocking finding → `REJECTED`;
- material finding → conditional, inconclusive, or rejected;
- Evidence deficit → `INCONCLUSIVE`;
- all mandatory criteria met with required independence → `SATISFIED`.

Multiple policies remain independently inspectable. Aggregate assurance preserves the strictest unresolved required result; never numerically average results or silently arbitrate disagreement. A satisfied advisory policy cannot override a rejected blocking policy.

Assessment lifecycle includes `REQUESTED`, `EVIDENCE_PENDING`, `READY`, `ASSESSING`, the dispositions above, plus `INVALIDATED`, `VALIDATOR_FAILED`, `INDEPENDENCE_VIOLATION`, and `CANCELLED`. Validator failure is not rejection. Invalid output is retained for diagnostics but cannot create authoritative findings. Evidence access failure produces pending/inconclusive, never inferred content.

### 8.6 Permitted control actions

Assurance recommends; the controller selects under policy:

```text
CONTINUE  WAIT  CLARIFY  GATHER_CONTEXT  GATHER_EVIDENCE
REVISE_PROMPT  REVISE_CONTEXT  RETRY
CHANGE_MODEL  CHANGE_TOOL  CHANGE_VALIDATOR  CHANGE_TACTIC
RESHAPE_PWU  REVISE_DECOMPOSITION  REPLAN_EXECUTION
INVALIDATE_DEPENDENTS  REQUEST_HUMAN_DECISION  REQUEST_WAIVER
ESCALATE  REJECT  ABANDON  ACCEPT  PROMOTE_BASELINE
```

Record trigger, policy, Evidence/observations, actor, affected objects, rationale, and expected effect for every material control action.

### 8.7 Waivers

A waiver records the exact policy, criterion, finding, object and semantic version, authority, rationale, duration/expiration, compensating controls, downstream impact, and review/revalidation triggers.

A waiver does not erase a finding, make invalid Evidence valid, declare a rejected Claim true, or automatically apply to a future semantic version. Critical integrity failures may be non-waivable. Expiration triggers review and may block promotion.

### 8.8 Decisions and Baselines

Every material Decision binds:

- the exact subjects and semantic versions;
- Decision type and selected option;
- alternatives, rationale, Evidence, observations, and residual uncertainty;
- actor plus verifiable authority grant/scope/validity;
- effective time, conditions, expiration/revocation, and impact.

Human override never erases contrary Evidence or findings.

Baseline promotion requires:

- exact item IDs, semantic versions, and content hashes where applicable;
- matching reviewed and promoted artifacts;
- required Claims, admitted Evidence, Assessments, and dispositions;
- no unresolved blocking/critical finding except a policy-permitted scoped waiver;
- effective promotion authority and accepted residual risk;
- declared purpose/scope and rollback/recovery where required.

An authoritative Baseline is immutable. Change creates a successor and preserves supersession. Repository commits, branches, merges, releases, and deployment Actions may be linked to a Baseline but never imply one.

---

## 9. Execution, RPH coordination, and machine contracts

### 9.1 Plan, workflow, step, and binding

A PWU defines professional work. It does not embed its runtime sequence.

- An **Execution Plan** is versioned and governed. It contains steps/transitions, retry, tactic-change, escalation, and termination policy. One approved Plan may replace another without changing the PWU’s identity or obligation.
- An **Execution Step** is temporal machinery: model/tool invocation, retrieval, transformation, human interaction, wait, branch, parallel group, or assurance invocation.
- A **Runtime Binding** selects role/model/tool/context/sandbox/observability/memory policy and records requested versus granted capability.
- An **Execution Attempt** records one bounded try, inputs/outputs or explicit no-output, provenance, external operation IDs, errors, and result.

A Plan cannot change Intent or Obligations, grant its own privilege, bypass assurance, or make a superseded PWU executable.

### 9.2 RPH coordination loop

RPH owns professional coordination rather than professional knowledge. PWUs own the bounded work state; workflow/process machinery performs temporal activity. A conforming RPH:

- frames required work;
- plans continuously and proposes semantic Commands;
- allocates bounded responsibility by capability, authority, availability, independence, cost, and risk;
- coordinates dependencies, PWUs, subordinate RPHs, humans, agents, tools, and external parties;
- observes professional progress—uncertainty reduction, Evidence, validation, synthesis—not merely activity;
- detects incoherence and no-progress patterns;
- changes tactic, reshapes, or replans under policy;
- reconciles changed understanding;
- synthesizes children into parent understanding;
- escalates responsibly when evidence, authority, expertise, capability, or budget is insufficient.

Delegation always includes objective, scope, authority, inputs/outputs, Constraints, completion, validation, dependencies, and escalation conditions. Assignment without this bounded responsibility is not delegation.

A simplified controller cycle is:

```text
load current PWU + plan + assurance + shape + open findings
    ↓
adequately shaped? decomposition valid? plan approved? bindings authorized?
    ↓
execute next eligible step
    ↓
capture Artifacts, Evidence, observations, provenance, and telemetry
    ↓
evaluate applicable policies
    ↓
continue | retry | gather | change tactic | reshape | replan | escalate | reject
    ↓
recompose satisfied children
    ↓
assemble Evidence package and request Baseline promotion
```

Technical retry repeats substantially the same tactic after a transient failure. Tactic change changes model, tool, context, decomposition, method, or search space after evidence of non-progress. Do not blur them or retry indefinitely.

### 9.3 Authoritative Command pipeline

Commands request professionally meaningful state changes; persisted Events assert accepted facts.

```text
receive and parse
→ authenticate principal and resolve Participant/tenant/organization
→ load semantic definition
→ check idempotency
→ load aggregate
→ check expected revision/version
→ evaluate authority at execution time
→ normalize and structurally validate payload
→ semantically validate preconditions and invariants
→ apply transition and create Events
→ atomically persist state + version + Events + command result + idempotency + outbox
→ publish post-commit notifications
→ update derived projections
→ return typed result
```

No generic CRUD/PATCH path, UI local state, RPH worker, Validator, projection worker, broker message, agent output, or informal approval bypasses this pipeline.

Optimistic concurrency rejects stale Commands; never use silent last-write-wins for material state. Reusing an idempotency key with an identical request returns the prior result and emits no new Event. Reuse with a different payload/target fails.

### 9.4 Envelope and schema rules

The canonical source must generate TypeScript and JSON Schema; do not hand-maintain diverging definitions. Current wire rules are:

- JSON Schema Draft 2020-12;
- schema ID `urn:janumi:rph:schema:<category>:<name>:<version>`;
- `additionalProperties: false` on canonical writes;
- extensibility only through declared, schema-versioned `extensions`;
- uppercase snake-case enums;
- RFC 3339 UTC timestamps;
- omit genuinely optional values rather than using ambiguous nulls;
- reject unknown required fields/types on writes; forward-compatible readers use explicit upcasting/unknown handling, never silent discard;
- persisted Events are immutable and permanent; schema change uses new versions/upcasters, never event rewrite.

Keep four version axes distinct:

| Axis | Meaning |
|---|---|
| `contractVersion` | SemVer of the overall contract package. |
| `schemaVersion` | Serialized payload shape. |
| `semanticVersion` | Meaning, obligation, Evidence, assurance, or authority version. |
| `revision` / `expectedRevision` | Optimistic-concurrency position for persisted changes. |

A current DOC-007 Command envelope contains exactly `commandId`, `commandType`, `commandSchemaVersion`, `targetAggregateType`, `targetAggregateId`, optional `expectedRevision`, `issuedAt`, `issuedBy`, `correlationId`, optional `causationId`, `idempotencyKey`, and `payload`. Result status is `ACCEPTED`, `REJECTED`, `CONFLICT`, `DUPLICATE`, `UNAUTHORIZED`, or `VALIDATION_FAILED`.

A current Event envelope contains exactly immutable `eventId`, `eventType`, `eventSchemaVersion`, `aggregateType`, `aggregateId`, `aggregateRevision`, `occurredAt`, `recordedAt`, `actor`, `correlationId`, optional `causationId`, optional originating `commandId`, and `payload`. Events are past-tense accepted facts and contain no presentation layout or secrets.

Tenant/organization, PWA/professional context, originating projection, and semantic-model version are not current envelope fields. Derive and enforce tenant scope from authenticated request/repository context and persist it according to the accepted storage design. Adding any of these to the wire envelope requires a versioned contract/ADR resolution; `additionalProperties: false` forbids adding them ad hoc.

External input always crosses:

```text
parse → structural schema validation → normalize → semantic validation
→ authorize → convert to canonical object
```

This applies to users, agents/models, Validators, tools, imports, templates, migrations, APIs, and external callbacks.

### 9.5 Initial exact Command and Event vocabulary

The first architecture-baseline slice uses these Commands:

```text
CaptureIntent  FormalizeIntent  ApproveIntent
ProposePwu  BeginPwuShaping  MarkPwuReady  ChangePwuState
ProposeExecutionPlan  ApproveExecutionPlan  ActivateExecutionPlan
StartExecutionStep  CompleteExecutionStep  FailExecutionStep
DetectAssumption  ProposeEvidence  AdmitEvidence  AssertClaim
RequestAssuranceAssessment  RecordAssuranceObservation
CompleteAssuranceAssessment
ProposeDecision  ApproveDecision
CreateBaseline  PromoteBaseline
```

and these Events:

```text
IntentCaptured  IntentFormalized  IntentApproved
PwuProposed  PwuShapingStarted  PwuMarkedReady  PwuStateChanged
ExecutionPlanProposed  ExecutionPlanApproved  ExecutionPlanActivated
ExecutionStepStarted  ExecutionStepSucceeded  ExecutionStepFailed
AssumptionDetected  EvidenceProposed  EvidenceAdmitted  ClaimAsserted
AssuranceAssessmentRequested  AssuranceObservationRecorded
AssuranceAssessmentCompleted
DecisionProposed  DecisionEffective
BaselineCreated  BaselinePromoted
```

The broader semantic API adds explicit challenge, reshape, invalidate, supersede, decomposition/recomposition, Evidence invalidation, waiver, retry/tactic change, Decision revocation, and Baseline supersession Commands. DOC-007 lists `ChangePwuState` in the first slice but leaves its payload, authority, and guard contract unresolved. Do not expose it as a public catch-all until Section 16 item 7 is decided; any internal helper must route through the complete closed transition/guard table and emit the correct semantic Event.

Event families include Intent; PWU; decomposition/recomposition; Assumption/Constraint/Obligation; execution/runtime binding/tactic; Claim/Evidence/assurance/waiver; Decision; and Baseline. Use the exact generated registry for code—do not invent spelling from prose.

### 9.6 Typed errors

Error categories are:

```text
VALIDATION  AUTHORIZATION  CONCURRENCY  NOT_FOUND  INVARIANT
EXECUTION  ASSURANCE  PERSISTENCE  EXTERNAL_DEPENDENCY
SCHEMA_COMPATIBILITY
```

Required initial codes include:

```text
RPH_VALIDATION_SCHEMA_FAILED
RPH_VALIDATION_SEMANTIC_FAILED
RPH_AUTHORITY_INSUFFICIENT
RPH_REVISION_CONFLICT
RPH_ILLEGAL_STATE_TRANSITION
RPH_INVARIANT_VIOLATION
RPH_EVIDENCE_MISSING
RPH_EVIDENCE_INVALIDATED
RPH_VALIDATOR_OUTPUT_INVALID
RPH_VALIDATOR_INDEPENDENCE_VIOLATION
RPH_POLICY_VERSION_MISMATCH
RPH_SUBJECT_VERSION_MISMATCH
RPH_BASELINE_VERSION_MISMATCH
RPH_IDEMPOTENCY_DUPLICATE
RPH_EXTERNAL_OPERATION_UNCERTAIN
```

Errors return a stable code/category, professional explanation, technical reference/correlation ID, current and expected versions where relevant, retryability, and recommended disposition. Failed validation emits no state-change Event.

### 9.7 AI and external execution contract

Every AI execution records objective, originating Intent, scope, authority, Constraints, context projection, Evidence, required outputs, validation/completion/termination/escalation conditions, tool permissions, and resource limits.

It returns proposed entities/Commands, professional rationale summary, Evidence used, Assumptions, Claims, limitations, unresolved Questions, residual uncertainty, validation results, and provenance. Agent completion never completes a PWU.

Every tool/sandbox call records identity, authorization scope, input reference, start/end, result/error, resource use, and declared outputs. Model output is untrusted input. Malformed output creates no authoritative object.

For uncertain external side effects, persist operation ID, provider, idempotency key, attempt status, and reconciliation method. Classify the operation as definitely not started, observably running, succeeded but unrecorded, failed, or uncertain. Never blindly retry an uncertain non-idempotent action; reconcile first. Compensation is a new recorded Action, not deletion of history.

---

## 10. Persistence, recovery, legacy migration, and cutover

### 10.1 Canonical persistence model

Use a PostgreSQL-compatible normalized relational current state plus:

- append-only immutable domain Events;
- a transactional outbox;
- rebuildable projections/read models;
- version history and typed trace relationships;
- immutable, content-hashed Artifact/Evidence/Baseline content;
- JSONB only for declared versioned extensions, policy expressions, structured results, Events, and snapshots.

This is a hybrid transactional model with Event history, not event-store-only sourcing. Do not hide core cross-object relationships in one generic JSON document or EAV. Do not hard-delete objects that have participated in execution, assurance, governance, a Baseline, or traceability.

Logical persistence domains separate core work, execution, assurance, governance, Events/outbox, projections, audit, integration, and legacy compatibility. They may initially share one database to preserve transaction boundaries. Commands never validate from projections.

Critical data rules:

- one active Plan per PWU;
- unique aggregate revision, attempt number, and idempotency key;
- Claims, Assessments, Decisions, and waivers bind exact subject semantic versions;
- Baseline items bind exact semantic version and, where applicable, a content hash; hash applicability and algorithm require an explicit contract rather than inference;
- non-local PWU Types must belong to the Undertaking’s immutable selected PWA version;
- local extensions have no published `pwuTypeId` and never mutate the PWA;
- Artifact/Evidence corrections create successors, not in-place content mutation.

### 10.2 Transaction, outbox, projection, and replay

Within one aggregate transaction:

```text
lock/check revision
→ validate authority, transition, invariants
→ update authoritative current state
→ append version row
→ append immutable Event(s)
→ append outbox record(s)
→ persist command result/idempotency receipt
→ commit all or none
```

Cross-aggregate work uses Events plus a durable process/saga/controller, explicit intermediate state, compensation, and reconciliation. Projection workers process Events idempotently, preserve aggregate ordering, checkpoint global sequence plus handler version, expose lag/staleness, and support full rebuild. Outbox workers claim with `FOR UPDATE SKIP LOCKED`, retry safely, and dead-letter visibly.

Replay must reconstruct materialized state and must not repeat external side effects. Upcasters transform old Event payloads at read time without rewriting history.

### 10.3 Recovery

Recovery order is:

1. restore canonical database state;
2. restore/reconnect Artifact storage;
3. verify Event sequence and aggregate revision continuity;
4. replay outbox;
5. rebuild/catch up projections;
6. reconcile nonterminal external attempts;
7. resume durable Process/RPH/Validator/human-wait state.

Professional correctness must never depend on in-memory state. Projections need no independent authoritative backup once rebuild is proven. Backups and restore verification exist off the runtime host.

### 10.4 Exactly one semantic authority during migration

At every stage, exactly one representation may be authoritative for professional semantic state.

```text
LEGACY             legacy writes authority
SHADOW_RPH         legacy authority; RPH shadow has no Decisions or side effects
RPH                all semantic writes through RPH; legacy phase derived
LEGACY_COMPLETING  approved late legacy work finishes; RPH retains provenance
ARCHIVED_LEGACY    read-only history
```

“Dual run” never means dual semantic authority.

### 10.5 Migration stages

1. **Discover and instrument:** inventory real legacy phase/substate inputs, outputs, roles, prompts, Validators, human gates, DB writes, failures, retries, and side effects. Legacy remains authoritative.
2. **Introduce schemas and fixtures:** implement contracts, migrations, invariants, replay, and the FSM fixture. Legacy remains authoritative.
3. **Shadow and compare:** project legacy behavior into RPH without RPH side effects. Classify each difference as `EQUIVALENT`, `RPH_STRONGER`, `LEGACY_BEHAVIOR_MISSING`, `ACCIDENTAL_LEGACY_BEHAVIOR`, `SEMANTIC_CONFLICT`, `IMPLEMENTATION_DEFECT`, or `UNRESOLVED`.
4. **Pilot:** RPH becomes sole authority for the cohort; the legacy orchestrator is only an execution adapter/fallback and compatibility view.
5. **Scale cohorts:** compare, recover, and resolve divergence.
6. **Default RPH:** all new Product Realization Undertakings use RPH; direct legacy writes are revoked.
7. **Migrate/complete existing work:** migrate reconciled early work; usually let late irreversible legacy work finish under `LEGACY_COMPLETING`; manually review inconsistency.
8. **Retire legacy authority:** retain read-only provenance and derived compatibility labels.

After `RPH` mode, only the compatibility projection may write legacy milestone fields. Direct legacy semantic writes are rejected, audited, and alerted.

### 10.6 Legacy phase semantic mapping

| Legacy label | Canonical treatment |
|---|---|
| `INTAKE` | Intent/Product Definition PWUs, interaction, clarification, and Intent approval. |
| `ARCHITECTURE` | Architecture Definition PWU hierarchy, Artifacts, ADRs, decomposition/recomposition. |
| `PROPOSE` | Implementation Planning PWUs, candidate PWUs, and candidate Execution Plan. |
| `ASSUMPTION_SURFACING` | cross-cutting Assumption Disclosure Policy plus extraction step and typed Assumptions/impacts. |
| `VERIFY` | Claim-specific Assessments; separate Evidence-gathering PWUs where substantive work is required. |
| `HISTORICAL_CHECK` | Historical Consistency Policy using provenance-bearing precedent. |
| `REVIEW` | policy-triggered governance Decisions. |
| `EXECUTE` | Product Implementation PWUs through approved Plans and authorized Runtime Bindings. |
| `VALIDATE` | continuous policies and validation PWUs, not a terminal phase. |
| `COMMIT` | repository Artifact operation plus separate Baseline governance. |
| `REPLAN` | general control action to revise context, tactic, Plan, shape, or decomposition. |

Dialogue is provenance/context; phase is a derived milestone; a generic pass/fail cannot become satisfied assurance without reconstructable policy/criteria; a legacy approved flag is a Decision only if actor, subject, version/hash, type, and time are reconstructable.

### 10.7 First implementation slice

Use the narrower, later contract slice unless a Decision expands scope:

```text
raw request
→ Intent Discovery PWU
→ formalized and approved Intent Baseline
→ Architecture Definition PWU
→ static approved compatibility Execution Plan
→ Architecture Artifact + Claims + Evidence + disclosed Assumptions
→ Assurance Assessment
→ Human Governance Decision
→ candidate and promoted Architecture Baseline
→ Work, Assurance, Trace, and compatibility projections
```

Instrument before replacing. Reuse existing agents, prompts, CLI providers, human interactions, and infrastructure through Runtime Bindings without making them canonical ontology. Require feature flags, restart safety, replay, fallback until the cutover gate, and classified parity—not byte-identical output.

Cutover requires stable generated schemas, conformance tests, fixture replay, projection rebuild, acceptable comparison, reliable restart/compatibility derivation, version-bound Decisions, canonicalized Validator output, prevention of dual writes, and tested rollback. Suggested operational gates include no unexplained critical divergence, at least 99% successful projection updates, and zero duplicate Decisions/promotions or silent Constraint loss.

---

## 11. Projections, workspaces, and interaction

### 11.1 One model, many projections

The Living Enterprise model is the continuously evolving professional semantic state formed by canonical objects, relations, Events, Decisions, and Baselines. It is not a second database, a knowledge-graph sidecar, or a UI-owned model.

A **Projection** is a purpose-specific, rebuildable interpretation of that state for a user, role, task, or machine consumer. It may filter, aggregate, rank, summarize, or visualize. It must not silently invent authority, erase uncertainty, or become the only place where a professional fact exists.

Every projection contract states the following semantically. For the initial wire projections, use DOC-007's exact fields; adding envelope fields requires a schema version and Decision rather than an ad hoc response change:

- its name, audience, purpose, query/input, and source Event or aggregate types;
- inclusion, derivation, ordering, aggregation, and redaction rules;
- output schema and semantic/schema version;
- freshness target, checkpoint/watermark, and rebuild behavior;
- authorization policy and sensitivity treatment;
- links back to canonical IDs, versions, Claims, Evidence, and Decisions;
- how stale, incomplete, disputed, or unavailable data is shown.

New or revised projection contracts should expose `projectionType`, `projectionVersion`, `generatedAt`, `sourceCheckpoint` or watermark, and freshness/staleness metadata where these are not already represented. A projection lag is operational state, never permission to guess. Rebuild and incremental processing must converge to the same result.

### 11.2 Canonical workbench contexts

The JPWB presents five interoperating contexts over the same model:

| Context | Primary concern | Must not become |
|---|---|---|
| **PWA Design** | author, validate, version, publish, and define migration contracts for a Professional Work Architecture | an untyped form builder |
| **Undertaking** | establish purpose, boundaries, Participants, Context, PWA/profile/version, and initial Baseline | a generic project record |
| **Execution** | navigate PWUs, Plans, Steps, dependencies, attempts, outputs, and control actions | an opaque agent chat or task list |
| **Assurance** | inspect Claims, criteria, Evidence, Validator results, exceptions, and coverage | a single pass/fail badge |
| **Governance** | make version-bound Decisions, manage waivers, promotion, change, and reconciliation | an informal approval screen |

These contexts share canonical identifiers and deep links. A user can move from a displayed conclusion to its Claim, Evidence, generating Action/Step, governing policy, Decision, Artifact version, and Baseline membership.

Every surface makes the user's level explicit: PWA definition/version versus Undertaking instance versus PWU Type versus PWU Instance. Show the exact PWA/profile/version binding and whether each value is inherited, profiled, locally extended, or instance-owned. Concrete execution and assurance state belongs to instances, not reusable definitions; PWA publication/review remains separately governable.

### 11.3 Cognitive and operational projections

The numbered corpus normatively requires Work, Execution, Assurance, Traceability, Runtime, Change-Impact, and legacy Compatibility views; DOC-007 freezes only the exact initial Work, Assurance, and Compatibility wire contracts. The following cognitive projections are a compatible target taxonomy from the discussion, not additional ratified wire shapes. Provide them only through versioned contracts and according to the professional question, not the storage table:

- **Intent:** purpose, outcomes, success conditions, scope, exclusions, stakeholders, unresolved questions.
- **Understanding:** observations, concepts, relationships, assumptions, constraints, confidence, and disputes.
- **Representation:** models, specifications, Artifacts, versions, and their semantic coverage.
- **Reasoning:** Claims, alternatives, arguments, dependencies, contradictions, and rationale.
- **Evidence:** Evidence items, provenance, criterion fit, freshness, independence, and gaps.
- **Decision:** candidate choices, approvals/rejections, authority, scope, version, conditions, waivers, and expiry.
- **Execution:** PWUs, Plans, Steps, Runtime Bindings, attempts, blockers, progress, and outputs.
- **Observation:** runtime facts, metrics, incidents, feedback, drift, and newly discovered conditions.
- **Reconciliation:** expected-versus-observed deltas, impact, required control actions, and closure.
- **Decomposition/coordination/history:** work hierarchy and graph, dependency/ownership handoffs, and immutable chronology.

The labels above are views of the cognition loop, not a replacement lifecycle enum. A screen named “Decision” does not make everything displayed in it an authoritative Decision.

A security-trimmed projection discloses that material information may be partial without leaking protected facts through counts, graph topology, titles, placeholders, timing, or inferred dependencies. Visibility of an object never implies authority to mutate it.

### 11.4 Workspace state anatomy

A useful workspace makes six kinds of state simultaneously legible:

1. **Identity:** Undertaking, PWA/profile/version, current Baseline, user/role, tenant, and relevant boundary.
2. **Orientation:** purpose, current focus, hierarchy/graph location, next admissible actions, and why they are admissible.
3. **Professional content:** the canonical objects and relations being inspected or changed.
4. **Assurance and authority:** policy coverage, Evidence status, Decisions, waivers, constraints, and promotion readiness.
5. **Execution and provenance:** responsible actor, agent/runtime, attempt, timing, inputs, outputs, and trace links.
6. **Uncertainty and change:** assumptions, unknowns, conflicts, staleness, divergence, pending proposals, and reconciliation.

Frontend state is divided deliberately:

- the server remains authority for canonical professional state;
- URL state carries shareable selection, projection, filters, and navigation where safe;
- query/cache state contains versioned server responses and freshness;
- local UI state contains ephemeral layout, drafts, and affordances;
- edits are typed Commands or change proposals with expected revisions, never direct model mutation;
- optimistic UI is permitted only when conflict, rejection, and rollback are explicit.

Never encode professional authority solely in component state, browser storage, URL parameters, visual position, color, or client-only validation.

### 11.5 Interaction grammar

The normal interaction loop is non-linear:

```text
orient → inspect → propose → assess → decide → execute → observe → reconcile
```

The interface distinguishes these verbs:

- **inspect** reads a canonical object or projection;
- **propose** creates a candidate change without silently granting authority;
- **assess** evaluates a Claim or candidate against explicit criteria;
- **decide** records authorized disposition over an identified version;
- **execute** invokes an approved Plan/Step/Binding under policy;
- **promote** creates an authoritative Baseline through governance;
- **reconcile** records and resolves a material difference between expectation and observation.

Every consequential control shows the object, version/revision, effect, required authority, policy reason, and expected Evidence. Destructive or irreversible actions require explicit scope and confirmation; prohibited actions are unavailable with an explanation, not merely hidden.

AI assistance uses the same grammar. It may suggest, draft, summarize, classify, decompose, or propose. The UI identifies AI-originated content, model/provider invocation metadata where permitted, Evidence basis, uncertainty, validation state, and the human or policy authority required before effect.

Supporting operations include trace, compare, challenge, annotate/contribute, delegate, request Evidence, escalate, and return to earlier reasoning. They remain typed operations over identified objects; they are not free-form authority hidden in chat.

### 11.6 PWA authoring, versioning, and extension

A PWA version is a governed semantic package, not a mutable collection of screens. Conceptually its versioned contents identify the PWA, compatible platform/contract versions, profiles, ontology modules, PWU Types, policies, Validators, projections, role/permission mappings, migration definitions, and extension points. The exact manifest/schema and bootstrap Commands remain an unresolved contract in Section 16; do not invent them from this conceptual inventory.

Lifecycle:

```text
DRAFT → UNDER REVIEW → VALIDATED → PUBLISHED → DEPRECATED → RETIRED
```

- Draft content can change; a published version cannot. Instantiation/use references a `PUBLISHED` version but is not a PWA lifecycle state.
- An Undertaking is pinned to a PWA/profile/version. Upgrading it is an explicit, validated migration with preview, compatibility report, Decision, rollback/recovery plan, and provenance.
- Local additions live in declared extension namespaces. They cannot redefine canonical meanings or bypass mandatory policies.
- Broadly useful local changes are submitted as typed change proposals and do not silently mutate the originating PWA.
- If the candidate JSDL SemVer policy is adopted, breaking semantic changes require a major version and migration, additive compatible changes require at least a minor version, and corrections that do not alter meaning may be patch versions. Until then, follow the ratified PWA versioning contract and record compatibility explicitly.
- Historical Undertakings remain interpretable against the package version under which their Events and Decisions occurred.

### 11.7 UX conformance

Required behaviors include keyboard access, visible focus, semantic markup, non-color-only status, readable provenance, timezone/locale clarity, and usable dense information at multiple viewport sizes. Loading, empty, partial, stale, denied, conflict, validation, and recovery states are first-class designs.

Test the UI against stable semantic fixtures and contracts. Include role/redaction tests, stale-revision conflict, projection lag, AI proposal versus approved fact, Evidence drill-down, waiver expiry, Baseline promotion, failed/retried external execution, migration preview, keyboard navigation, and accessibility checks.

Avoid chat-only operation, universal dashboards, giant undifferentiated graphs, phase wizards, unexplained scores, hidden provenance, unversioned approvals, and screens that merge execution completion with assurance satisfaction.

---

## 12. Shape Engineering, JSDL, and JEM

This section preserves a valuable target direction from the Constitution Discussion while keeping its status explicit: **Shape Engineering, JSDL v0.1, JEM v0.1, and the JSRP are candidate designs, not yet ratified authorities over the numbered RPH corpus or current repository architecture.** Implement them only through an accepted Decision/ADR and a compatibility plan.

### 12.1 Shape Engineering

**Shape Engineering** is the discipline of discovering, modeling, validating, encoding, and evolving a profession's executable work architecture. It is not screen design, workflow automation, prompt writing, or ontology creation in isolation.

Its ordering principles are durable:

```text
outcomes before artifacts
cognition before workflow
semantics before technology
uncertainty made explicit
recursive decomposition with reconstruction obligations
human and AI participation through the same professional contracts
evidence-bearing design
continuous observation and reconciliation
executable, testable semantics
```

The draft handbook describes a ten-meta-phase lifecycle but expands it into the following fifteen-stage checklist. Preserve the stages as design questions, compressing or iterating them when justified but never omitting them silently:

1. frame the domain, boundary, purpose, and descriptive/normative/transformational stance;
2. observe real professional practice, cognition, exceptions, failure, and informal coordination;
3. model outcome hierarchy, conflicts, measures, and traces;
4. model questions, reasoning, uncertainty, Evidence, confidence, and Decisions;
5. map the domain ontology to canonical concepts and justify genuinely new concepts;
6. model professional representations, Artifacts, authority, and versioning;
7. model Assumptions, Constraints, Risks, invariants, and enforcement points;
8. derive PWU Types with explicit boundaries and delegation contracts;
9. derive RPH allocation, decomposition, progress, tactic change, recovery, and escalation;
10. define Validators, assurance policies, and governance authority;
11. define projections, workspaces, surfaces, and attention signals;
12. define integrations, trust boundaries, observations, and reconciliation;
13. encode the architecture in JSDL if and when JSDL is adopted;
14. validate structurally, semantically, professionally, operationally, cognitively, governably, experientially, and against outcomes;
15. operationalize, observe, reconcile, version, and evolve.

Required outputs are compact but traceable: domain boundary and charter; vocabulary/ontology; outcome, cognition, Evidence, and Decision models; representation catalog; uncertainty/risk/invariant register; PWU and RPH model; assurance/governance matrix; projection/workspace contracts; integration/observation model; executable definition; conformance scenarios; evolution plan. Every normative element should trace to observation, principle, requirement, or Decision.

Maturity is cumulative: `0 Vocabulary`, `1 Documented Practice`, `2 Semantic Architecture`, `3 Executable Work Architecture`, `4 AI-Native Operation`, `5 Continuously Reconciled Profession`. Do not claim a level from the presence of a feature; demonstrate all prior capabilities.

### 12.2 JSDL candidate language contract

The proposed **Janumi Semantic Definition Language (JSDL)** is a declarative, machine-readable source for professional semantics. If adopted, it should reduce drift by generating code-facing artifacts from one reviewed definition. It must not become a second vocabulary or a shortcut around Decisions.

Candidate source rules:

- human-reviewable YAML (`*.jsdl.yaml`) is primary; equivalent JSON may be accepted;
- named, SemVer-versioned modules import explicit compatible versions;
- declarations cover enums, value objects, entities, relations, aggregates, lifecycles, Commands, Events, invariants, Validators, projections, permissions, observability, extensions, and test cases;
- references are qualified and resolved through a symbol table; cycles and incompatible imports fail compilation;
- expressions use a small typed, deterministic, side-effect-free AST—no arbitrary host code, filesystem/network access, clock, randomness, or hidden evaluation;
- all diagnostics point to source spans and use stable codes;
- extensions occupy declared namespaces and cannot weaken canonical invariants or mandatory policies;
- generated files are reproducible build products and are never edited by hand.

Compiler pipeline:

```text
parse
→ validate module/import graph
→ build symbols and resolve references
→ type-check
→ apply semantic and invariant checks
→ emit normalized intermediate representation (IR)
→ calculate deterministic semantic fingerprint
→ generate artifacts
→ validate generated artifacts and fixtures
```

The fingerprint excludes formatting, comments, and irrelevant declaration order but changes when meaning changes. The IR retains source maps. Initial generators should produce TypeScript types, JSON Schema, contract documentation, and positive/negative fixtures; database/OpenAPI/UI artifacts follow only after their semantics are stable. The build fails on nondeterminism, unresolved references, unsafe expressions, duplicate authority, invalid state transitions, or generated artifacts that do not validate.

Compiler conformance includes parser/module/type/semantic negative fixtures, deterministic IR snapshots and golden outputs, generator round-trip validation, property tests over declaration graphs and fingerprints, and bounded YAML/JSON fuzz and safety tests. Malformed or adversarial source must fail with stable diagnostics, never execute code or consume unbounded resources.

Until JSDL is ratified, the current DOC-007-compatible contract package remains wire authority and must retain one canonical source from which TypeScript, JSON Schema, and other bindings are generated. The example enums, envelopes, IDs, lifecycles, and state models embedded in the discussion are illustrative; do not generate or implement them where they conflict with Sections 3, 5, 6, 8, or 9.

### 12.3 JEM candidate execution semantics

The proposed **Janumi Execution Model (JEM)** describes how definitions become behavior. Most of its core invariants are already captured in this guide and should be preserved regardless of runtime:

- authoritative mutation occurs only through a validated Command;
- authorization is checked at execution time and scoped to tenant, subject, version, boundary, and action;
- aggregate mutation plus Event/outbox persistence is atomic;
- Events are immutable; revision conflicts never overwrite silently;
- Validators assess and emit results but do not mutate authority;
- waiting, attention, escalation, retry, tactic change, and compensation are explicit states/actions;
- AI output is a proposal unless policy grants bounded authority;
- durable Processes survive restart and preserve provenance/model version;
- Projections are rebuildable and non-authoritative;
- reconciliation occurs through Commands and recorded Decisions;
- technical success is not professional completion;
- replay is safe and no incoherence is hidden.

Bind any future JSDL declaration to the current Command/Event/schema package by explicit mapping and conformance tests. A declaration must state aggregate boundary, preconditions, authority, emitted Events, invariant effects, idempotency, and failure contract. “The compiler generated it” is not evidence that professional meaning is correct.

### 12.4 Runtime profile boundary

The discussion's Janumi Single-Node Runtime Profile (JSRP) is a candidate reference deployment for JEM, not the current platform decision. Preserve its useful semantic requirements—PostgreSQL-backed authority, atomic Command/Event/outbox handling, durable work, leases, retries, reconciliation, and rebuildable projections—but implement them through the current stack and accepted ADRs unless a later Decision explicitly replaces that architecture.

---

## 13. Platform, deployment, security, and edition boundaries

### 13.1 Current architectural baseline

Unless a current repository ADR says otherwise, implement against the Executive Overview baseline:

```text
trusted control plane
  SvelteKit · Bun · oRPC · Prisma/PostgreSQL with RLS · DBOS · Cerbos
  RPH and professional-work services · assurance · governance
  identity · tenancy · audit · API · durable coordination

isolated execution plane
  Compute Broker
  ephemeral per-tenant sandboxes
  untrusted compilers, coding agents, tools, and builds
  metering, quotas, scheduling, and fairness
```

This is a modular monolith with explicit internal boundaries, not a mandate for premature microservices. DBOS supplies durable temporal execution machinery; it does not define PWAs, PWUs, the Professional Work Graph, or assurance meaning. oRPC/JSON contracts remain schema-first. PostgreSQL is authoritative; object storage holds Artifact bodies; Cerbos evaluates policy; RLS independently enforces tenant data boundaries; Vault issues short-lived credentials.

Shared platform responsibility also includes model/agent provider integration, tenant lifecycle, entitlements, subscription/usage/invoicing and payment integration, external integrations, telemetry, backup, restore, and disaster recovery. These services support domain products; they do not inject domain-specific professional semantics.

The same versioned images support Docker Compose for development and smaller self-hosting and RKE2/Kubernetes for multi-tenant, highly available, or regulated deployment. Deployment topology must not alter professional semantics.

### 13.2 Trust topology

Keep three trust tiers distinct:

| Tier | Trust and responsibility |
|---|---|
| `control-plane` | trusted platform code, authoritative professional state, identity, policy, governance, audit, orchestration |
| `sandbox` | ephemeral least-privilege execution of untrusted or tenant-directed tools; never direct semantic authority |
| `tenant-app` | delivered applications and workloads with their own runtime identity and bounded data access |

Use two separate PostgreSQL trust domains where defined by the platform architecture; do not give execution workloads control-plane database credentials. The core aggregate state, Event, idempotency record, and outbox must still share the authoritative transaction domain required by Section 10—the trust split must not break atomicity. Every request, job, Command, Event, Artifact operation, and audit record carries tenant and principal scope derived from authenticated context—not trusted from an arbitrary payload.

Four principal kinds—human, machine, workload, and agent—resolve through one authorization model. Delegation records who delegated what scope to whom, under which policy, until when. An agent identity never borrows an unrecorded human identity.

### 13.3 Security invariants

- Enforce tenant isolation in application logic **and** PostgreSQL RLS, and test both positive and cross-tenant-negative paths.
- Authenticate internal endpoints. There are no trusted-network or unauthenticated service shortcuts.
- Authorize at action time against principal, tenant, resource, action, boundary, version/revision, and relevant Decision/waiver.
- Encrypt transport and stored sensitive data; keep secrets out of code, logs, Events, traces, fixtures, prompts, and Artifact metadata.
- Use Vault-minted, narrowly scoped, short-lived credentials and rotate/revoke them without redeploying application code.
- Treat provider keys as tenant-scoped BYOK secrets where the edition/profile requires it; never pool them implicitly.
- Redact before logging or sending context to external models. Store the minimum necessary prompt/input/output content under explicit retention and access policy.
- Record security-relevant actions in a tamper-evident, hash-chained audit trail with tenant, principal, action, subject/version, outcome, correlation, time, and integrity linkage. Audit records complement but never replace semantic Events.
- Preserve separation of duties for high-risk Decisions, Baseline promotion, waiver, security-policy change, and credential administration.
- Fail closed on missing identity, tenant, policy, schema, or authority context. Availability fallbacks may not silently weaken professional or security invariants.

The platform is intended to support SOC 2 Type 2, DoD RMF/NIST SP 800-53, and GDPR obligations. This is a design objective, not a certification claim; only Evidence and an authorized statement can establish achieved compliance.

### 13.4 Sandbox and tool execution

Assume compiler, agent, repository, dependency, prompt-supplied, and generated content is untrusted.

- Run each attempt with an explicit tenant/workload identity, immutable input snapshot, tool/image digest, resource limits, timeout, and declared outputs.
- Default-deny network access; allow only declared destinations/protocols through brokered policy and record the grant.
- Mount only necessary inputs, normally read-only. Provide a bounded writable workspace; extract only declared output paths after validation and scanning.
- Never expose the host/container runtime socket, privileged mode, host namespaces, control-plane credentials, or unrestricted persistent volumes.
- Meter CPU, memory, storage, network, model tokens, concurrency, and wall time; make quota exhaustion a typed, recoverable result.
- Validate and classify outputs before they become Artifacts, Evidence, or executable inputs. Generation does not imply trust.
- Terminate and clean up idempotently; retain only policy-approved provenance, logs, outputs, and failure Evidence.

An external call uses the attempt/reconciliation protocol in Section 9. A timeout is uncertainty, not proof of failure. A successful process exit is an execution fact and potential evidence, not automatically admitted canonical Evidence or professional completion.

### 13.5 One codebase, three editions

| Edition | Intended boundary |
|---|---|
| **Community** | AGPL, single-tenant, self-hosted, BYOK; core RPH/JPWB/delivery, self-hosted VCS, sandboxed execution, base audit and encryption |
| **Enterprise** | commercial self-hosted; adds SSO/full SCIM, private or air-gapped models, compliance-Evidence automation, and multi-tenant credential isolation |
| **Cloud** | managed multi-tenant service; adds hosted operations, metered billing, and cross-tenant fairness to Enterprise capabilities |

Maintain one codebase and shared contracts. Enterprise-only implementation belongs behind the governed open-core boundary (currently `ee/`) plus build-time inclusion and runtime entitlement checks. Do not fork the semantic model, schema package, migrations, or client code by edition. A missing license disables an entitled capability explicitly; it must not corrupt or reinterpret existing professional state.

Customer-specific behavior is a PWA, profile, policy/configuration, or declared extension—not an edition fork. Mobile or other clients consume the same APIs and semantics; they are not alternate authorities.

### 13.6 Status is not doctrine

The Executive Overview's release sequence and “where it stands” paragraph are a dated planning snapshot. Verify current repository state, ADRs, tests, and deployment manifests before asserting that a component or release is implemented. Do not turn roadmap language into a schema or compatibility commitment.

---

## 14. Conformance, testing, and engineering discipline

### 14.1 What tests must prove

Tests generate executable engineering evidence for governance. They prove semantic and operational properties across representations; they do not merely exercise code paths. Test output becomes a canonical Evidence item only when admitted, typed, scoped, and provenance-checked under Section 8.

| Layer | Primary proof |
|---|---|
| domain unit | value objects, guards, state transitions, dispositions, pure derivations |
| property-based | invariants over generated graphs, versions, retries, evidence sets, and decomposition shapes |
| schema/contract | strict valid/invalid Command, Event, error, projection, and Artifact metadata fixtures |
| persistence | atomic aggregate/Event/outbox writes, constraints, RLS, optimistic concurrency, idempotency |
| replay/migration | state equivalence, upcasters, projection rebuild, legacy mapping, restart recovery |
| integration/boundary | API, DBOS, Cerbos, Vault, object store, Compute Broker, provider/VCS adapters, failure modes |
| end-to-end conformance | professionally meaningful scenarios from intent through governed Baseline and reconciliation |

Add state-machine, authorization, tenant-isolation, accessibility, performance, chaos/recovery, and production-observability tests where their risks live. Prompt and agent tests assess trajectory, tool use, provenance, schema compliance, adversarial input, uncertainty handling, and bounded authority—not exact prose.

### 14.2 Mandatory generative properties

Generate valid and invalid cases around these properties:

| Property | Must always hold |
|---|---|
| **P1** | Execution never implies assurance. |
| **P2** | Mandatory obligations survive every valid decomposition and recomposition. |
| **P3** | Mandatory Constraints survive every valid decomposition and recomposition. |
| **P4** | Missing, expired, invalid, out-of-scope, or superseded Evidence cannot support active satisfaction. |
| **P5** | Approval of semantic version `n` never authorizes `n+1` or a different fingerprint. |
| **P6** | Repeating an idempotent Command produces no duplicate semantic effect. |
| **P7** | An authoritative Baseline is immutable; change creates and governs a new candidate/version. |
| **P8** | Presentation or projection choice cannot change canonical professional meaning. |

Also generate arbitrary acyclic PWU hierarchies/graphs, obligation/constraint distributions, partial Evidence sets, concurrent expected revisions, duplicate delivery, Event replays, projection interruption, expired waivers, failed external attempts, incompatible schema versions, and cross-tenant identifiers.

### 14.3 Minimum conformance scenarios

DOC-008's first-slice suite covers Intent through Architecture Baseline and explicitly defers distributed execution, SaaS isolation, arbitrary ontology and marketplace policy systems, numerical confidence, full release/deployment Baselines, and production deployment. Its stable core includes at least:

- accepted and rejected strict envelopes, unknown properties/codes, incompatible schema versions, and invalid IDs;
- legal and illegal PWU transitions on every orthogonal state axis;
- completed execution with unsatisfied assurance remaining non-satisfied;
- mandatory Claim/Constraint propagation, coverage failure, and recomposition conflict;
- valid/invalid/stale/expired Evidence, Validator abstention/error, and `UNABLE_TO_DETERMINE` not treated as success;
- Decision authority, subject-version isolation, separation of duties, conditions, revocation, and waiver expiry;
- Baseline candidacy, blocked promotion, immutable promotion, supersession, and exact item versions;
- Command idempotency and optimistic-concurrency conflict under simultaneous requests;
- atomic state/Event/outbox commit, crash at each boundary, restart, replay equivalence, and projection rebuild convergence;
- external timeout with unknown outcome, reconciliation, safe retry, tactic change, compensation, and duplicate callback;
- legacy shadow comparison, single-authority enforcement, compatibility projection, cohort rollback, and cutover write revocation;
- the FSM reference Undertaking and first Product Realization architecture slice end to end.

The broader platform adds proportional tests when those deferred capabilities enter scope: application-plus-RLS cross-tenant denial, redaction and inference leakage, audit-chain verification, secret non-disclosure, PWA version pinning and migration, edition entitlement, sandbox isolation, distributed recovery, deployment behavior, and resource fairness.

Each behavioral test asserts result/error, aggregate revision and semantic version, emitted Event type/payload/order, trace links, outbox/projection effects, and absence of prohibited side effects where applicable—not final state alone. Each defect in a semantic or boundary contract receives a deterministic regression test when feasible. Fixtures contain stable IDs/times/seeds and explicit expected Events, state, errors, projection outputs, and audit records. Keep positive and negative fixtures beside the versioned schema they prove.

### 14.4 Mutation and coverage gates

Mutation testing for critical domain logic must catch removal or weakening of assurance gates, blocking findings, semantic-version isolation, expected-revision checks, Evidence validation, waiver expiry, idempotency, and mandatory decomposition propagation.

Recommended minimum branch coverage is 100% for state-transition guards, domain-invariant handlers, assurance disposition, Baseline promotion, Command idempotency, and Event upcasters; 90% for projection builders; risk-based for UI components. These are floors, not substitutes for meaningful assertions, mutation score, boundary tests, or review.

### 14.5 Code and review discipline

- Keep domain behavior explicit and typed. Prefer small pure functions for rules and thin adapters at I/O boundaries.
- Name code after the canonical vocabulary. Legacy names appear only in isolated adapters, migration records, and compatibility projections.
- Do not encode policy in prompts, UI conditionals, database triggers, or workflow glue alone; give it one canonical implementation and test it at every enforcement boundary.
- Comments explain **why**: professional reason, invariant, boundary, non-obvious tradeoff, or failure behavior. Code should explain what. A TODO includes a reference, reason, risk, and resolution condition.
- Generated code identifies its source and fingerprint and is not hand-edited. Schema, code, migration, fixture, and documentation changes land together.
- Address static-analysis, dependency, type, lint, formatting, complexity, and security findings or record a scoped, justified exception. Never suppress a finding just to make a gate green.
- Review database migrations for forward/backward compatibility, RLS, locks, backfill, uniqueness, Event/replay impact, rollback/recovery, and edition/deployment behavior.
- Review every new enum/status for orthogonality and authority. Do not add a generic state when an Event, relation, Assessment, Decision, or projection is the correct representation.

### 14.6 Observability and failure Evidence

Emit structured logs and traces with timestamp, severity, service/component, environment, tenant-safe principal identity, correlation and causation IDs, Command/Event/process/attempt IDs, aggregate ID/revision, action, outcome, duration, and stable error code. Propagate correlation across API, DBOS, broker, sandbox, provider, callback, and outbox boundaries.

Errors are typed and separated into validation, authorization, conflict, invariant, dependency, timeout/unknown-outcome, quota, and internal categories. Preserve redacted failure Evidence and causal chains; never reduce them to a generic “failed.” Health and readiness distinguish process liveness from ability to uphold dependencies and invariants.

For model/agent calls, record allowed provider/model/version, prompt/template/tool versions or fingerprints, relevant policy, token/time/cost metrics, response schema status, safety/redaction outcome, and resulting proposal/Artifact IDs. Do not log secrets or unrestricted professional content.

Alert on invariant violations, direct legacy writes after cutover, authorization/RLS mismatch, audit-chain break, Event/outbox lag, projection staleness, stuck durable attention, repeated unknown external outcomes, excessive reconciliation, quota abuse, and cross-tenant access attempts. Fail loudly on semantic corruption; degrade only through an explicit, safe operating mode.

---

## 15. Coding-agent operating protocol

This is the minimum operating contract for an implementation agent. Repository-local instructions and accepted ADRs still apply.

### 15.1 Intake

Before changing code, identify:

```text
requested outcome and explicit non-goals
affected PWA / Undertaking / PWU Type / aggregate / service
authoritative source section and contract/schema versions
tenant, identity, authorization, and trust boundary
professional invariants and assurance policies at risk
Event, persistence, projection, migration, audit, and compatibility effects
acceptance Evidence and commands/tests that will prove completion
unresolved decisions that block a safe choice
```

Inspect the real repository before proposing architecture. Find governing instructions, package boundaries, existing types/schemas, migrations, tests, generated-code markers, ADRs, and current build commands. Read surrounding code and source context; do not perform blind vocabulary replacement.

Restate a compact change contract: **what will change, what will not, which authority governs it, and how it will be verified.** If the request conflicts with a higher authority or lacks a choice listed in Section 16, stop and surface the conflict. Do not settle it by convenience.

### 15.2 Design the smallest coherent change

Trace the change vertically:

```text
professional rule
→ canonical type/invariant
→ Command and authorization
→ domain transition
→ Event and audit
→ persistence/outbox
→ projection/API/UI
→ migration/compatibility
→ tests and documentation
```

Change every affected layer, but do not widen the feature. Reuse canonical objects and existing adapters. Prefer a narrow end-to-end slice over unconnected scaffolding. Separate domain semantics from DBOS, providers, VCS, model prompts, transport, database, UI, and deployment adapters.

Before adding a field or type, ask: Is it authoritative or derived? Which aggregate owns it? What versions it? Which Command changes it? Which Event records it? Who may see/change it? How is it migrated, replayed, projected, and tested? If those answers are absent, the field is not ready.

### 15.3 Implement safely

- Preserve the user's unrelated changes and the repository's formatting, line endings, structure, and generated artifacts.
- Use canonical names in new code. Confine legacy terms and mappings to named compatibility boundaries.
- Validate strict external input; derive tenant/principal context from authentication; enforce expected revision and idempotency.
- Make domain transitions atomic with Event/outbox persistence. Do not let UI, jobs, agents, Validators, or adapters write around Commands.
- Keep external side effects behind authorized Runtime Bindings and the attempt/reconciliation protocol.
- Treat AI and tool output as untrusted proposals. Validate structure, provenance, policy, and Evidence before authority.
- Add typed errors, structured telemetry, redaction, and recovery behavior with the feature—not afterward.
- Create forward-safe migrations and upcasters before readers/writers depend on the new representation.
- Update schemas, fixtures, tests, docs, and compatibility projections in the same coherent change.

### 15.4 Verify in increasing scope

Run the cheapest relevant proof first, then broaden:

1. format, lint, type, schema, and deterministic-generation checks;
2. focused domain, transition, invariant, authorization, and regression tests;
3. property, contract, persistence, replay, RLS, and projection tests;
4. integration and end-to-end conformance for changed boundaries;
5. migration/rollback or recovery rehearsal when state changes;
6. repository-wide gates affected by the change.

Inspect generated Events, stored rows, audit entries, projection output, negative authorization, restart/replay behavior, and the user-visible state—not only exit codes. If a required check cannot run, report exactly what was not verified and why; never imply it passed.

### 15.5 Report the handoff

The final implementation report states:

- the outcome and user-visible behavior;
- files and contract/schema/migration versions changed;
- material semantic or architectural choices and their authority;
- tests/checks run and their results;
- migration, deployment, compatibility, feature-flag, and rollback notes;
- remaining risks, unresolved Decisions, and deliberately deferred work;
- whether any files were renamed, added, generated, or left unchanged despite terminology changes.

Do not report “done” because code compiles. Completion requires the requested outcome, all applicable invariants, reviewable changes, passing proportional Evidence, and no concealed gap.

### 15.6 Definition of done

A change is done only when:

- its professional meaning and owning aggregate are unambiguous;
- Commands, Events, schemas, authorization, state transitions, and errors agree;
- execution, assurance, governance, and Baseline effects remain separate;
- tenant isolation, secrets, audit, idempotency, concurrency, failure, and recovery are handled;
- persistence, replay, projections, migration, and compatibility are coherent;
- required Evidence is captured and all proportional tests pass;
- documentation and examples use canonical vocabulary and executable shapes;
- no unresolved authority decision was silently made;
- the handoff identifies every known limitation and actual verification result.

---

## 16. Do-not-guess decision register

These are implementation boundaries, not an invitation to solve the architecture locally. The safe default permits conservative progress without creating new meaning. If the requested feature requires choosing an unresolved shape, stop for an accepted Decision/ADR and update contracts, migrations, fixtures, and tests together.

| # | Unresolved boundary | Safe default until decided |
|---:|---|---|
| 1 | **Ratification status.** The Constitution Discussion calls CPCO/JSDL/JEM/JSRP normative; the README classifies conflicting exploratory material as background. This guide is itself proposed. | Treat `RPH-DOC-000`–`010`, generated contracts, and accepted repository ADRs as authority. Draft language is rationale/candidate design; repeating it here does not ratify it. |
| 2 | **Public root, ownership, and PWA composition.** The Charter defines JanumiCode as a domain product containing multiple PWAs, PWA-version-owned PWU Types, and Undertaking-owned PWU Instances; it permits one Undertaking under compatible PWAs, while current contracts serialize one selected binding. Drafts also use JCPWA and `Professional Endeavor`. | Use Charter names and one exact selected PWA/profile/version for the current slice. Do not add supplemental PWA bindings until compatibility, conflict precedence, ownership, migration, and projection rules are contracted. Do not introduce a second root or model JanumiCode as one PWA; isolate old names in adapters. |
| 3 | **PWU lifecycle versus cognitive focus.** DOC-002 defines four orthogonal state axes; the discussion proposes a different lifecycle and cognitive states. | Persist only DOC-002/007 states. Candidate cognitive states are projection/focus metadata unless a Decision adds an orthogonal axis and migration. Never map by similar labels. |
| 4 | **Command/Event envelope and tenant placement.** DOC-002 and DOC-007 differ; DOC-007's strict envelopes omit tenant, organization, professional/PWA context, originating projection, and semantic-model version even though the platform requires scoped execution. | Serialize DOC-007 exactly. Enforce tenant/principal through authenticated transport, repository, and RLS context. A public-envelope addition requires a new schema version and coordinated code/storage/test change; never create an unscoped path. |
| 5 | **Domain object versus wire object.** DOC-002's `ObjectEnvelope` has `authorityId`; DOC-007 instead has `schemaVersion`. Intent requiredness, PWU `boundary`/`boundaries`, and decomposition/recomposition/current-Baseline references also drift. | Use DOC-007 at strict wire boundaries plus lifecycle-aware validation; preserve omitted semantics in accepted aggregates/relations. If mapping is lossy, require a contract revision rather than storing competing shapes. |
| 6 | **Event vocabulary and granularity.** DOC-002 has granular satisfaction/approval Events; DOC-007's first slice uses `PwuStateChanged`, `AssuranceAssessmentCompleted`, and `DecisionEffective`, without fully modeling separate approval/effective time. | Emit the generated DOC-007 registry at current boundaries. Never emit generic and granular Events as independent facts. Extend the versioned registry and mappings before adding future-dated or separately effective Decisions. |
| 7 | **`ChangePwuState`.** DOC-007 names a catch-all Command but does not define its payload, authority, or guard contract. | Do not expose a public state setter. Use semantic Commands. Any internal helper enforces the closed transition/guard table and emits the correct semantic Event. |
| 8 | **Identifier generation.** DOC-002 permits prefixed ULID or UUIDv7; DOC-007 requires a registered prefix plus ULID but does not register every proposed object. Fixture IDs are intentionally readable. | Use registered DOC-007 prefix + ULID in production and fixture IDs only in fixtures. Extend the registry/schema/tests before adding an object prefix; do not casually accept multiple generators. |
| 9 | **PWA/PWU Type/Undertaking bootstrap.** The initial contract begins with `CaptureIntent` against an existing Undertaking but defines no create/publish/instantiate/migrate Commands. DOC-010 demonstrates UX without freezing those wire shapes. | Bootstrap only through accepted seed/fixture or an existing API behind an explicit adapter. No generic CRUD into canonical tables. Keep published PWA versions immutable and Undertakings pinned until a governed migration contract exists. |
| 10 | **Assurance schema and profile activation.** DOC-004 and DOC-007 differ on applicability expression, required Evidence/waiver arrays, and `riskProfiles`; DOC-003 leaves mandatory policies by conformance/risk profile open. | Use DOC-007 serialization without dropping DOC-004 meaning. Pin the slice to a versioned matrix of PWA conformance profile, independent PWU risk profile, applicable policies, criteria, and independence. Missing mapping blocks promotion. |
| 11 | **Composing Assessments into PWU state.** Individual Assessment state, PWU assurance state, aggregate projection, and lifecycle satisfaction are distinct; no exhaustive mapping covers multiple policies, waivers, and conflicting Validators. | Preserve all records/axes. Compose every applicable current-version policy using the strictest unresolved required result. A passing Assessment never advances assurance/lifecycle automatically; require a validated Command/Event. |
| 12 | **Actor, role, authority, independence, and waiver proof.** Actor and Authority references differ; initial Decision payloads do not prove authority grants; PWA/UX role names drift; waiver lacks a complete instance/wire/storage contract. | Never equate login, Cerbos permission, role label, ownership, or capability with professional authority. Require scoped, time-valid proof; map role aliases explicitly; validate actual identities for independence. Never implement waiver as a Boolean—require a version-bound Decision with scope, expiry, rationale, controls, and preserved finding. |
| 13 | **Baseline meaning, owner, and VCS relation.** Purpose may be approved-for-implementation or current-reference; exact Undertaking/PWU ownership and commit/branch/release relations remain incomplete. | A Baseline is an immutable semantic manifest with explicit purpose, scope, subjects/versions, Evidence, and promotion Decision. Git never grants authority. If owner/subject/authority cannot be resolved through accepted contract/trace, do not promote. |
| 14 | **Baseline hashing and cross-aggregate promotion.** Hash is optional/“where applicable”; no canonicalization algorithm exists. Promotion and a PWU entering `BASELINED` cross aggregate boundaries without a complete ordering/recovery protocol. | Use only an accepted hash contract; content-bearing Artifact/Evidence should not omit a required hash merely because the field is optional. Coordinate promotion/PWU effects through a durable Process with intermediate state and reconciliation, never ad hoc multi-aggregate writes or projection-derived authority. |
| 15 | **CPCO entities and JSDL authority.** Candidate Outcome, Question, Uncertainty, Representation, Confidence Assessment, and other types are absent from DOC-002's discriminator; draft JSDL enums/lifecycles conflict with current contracts. | Use CPCO as doctrine, projection, or declared extension only. Do not add canonical tables/discriminators/Commands or JSDL-generated contracts until a Decision maps them losslessly and supplies migrations/conformance. |
| 16 | **Durable runtime and database trust topology.** The current platform uses DBOS and separate control/execution trust domains; JSRP proposes custom PostgreSQL queues/workers. The exact ownership/credential/data split between the two PostgreSQL domains is not frozen. | Follow current code/ADRs and use DBOS unless replaced. Preserve durability/atomicity/replay/reconciliation semantics, do not build a parallel scheduler, keep semantic authority in the control plane, and never split the aggregate/Event/outbox transaction. |
| 17 | **Projection freshness envelope.** DOC-007 exposes limited generation/revision data; the discussion proposes richer as-of, version-vector, completeness, staleness, filter, and authorization metadata. | Serve the exact generated schema or an accepted versioned wrapper. Revalidate every state-changing Command against authority/current revision. New metadata requires a contract Decision; stale views never authorize mutation. |
| 18 | **Legacy parity and cutover.** DOC-005 is a semantic inventory, not proof of actual prompts, retries, roles, DB writes, failures, or side effects; the Executive Overview says migration is parked. | Inspect and instrument the implementation. Shadow with no Decisions/side effects, classify divergence, and keep one semantic authority. Documentation or fixture parity alone cannot justify cutover. |
| 19 | **Authorized slice and roadmap.** DOC-001 is broad, DOC-007 exposes a large surface, DOC-005 recommends intent-to-Architecture-Baseline, and the Executive Overview status is dated. | Verify the assigned scope, tracker, repository, and ADRs. If RPH work is authorized without expansion, use the narrow architecture slice. Do not implement the eventual corpus or claim current completion from prose. |
| 20 | **Confidence, memory, and automated acceptance.** Numeric confidence aggregation, historical-memory admissibility, and automatic low-risk Assumption acceptance are deferred or candidate ideas. | Use categorical dispositions, explicit basis/limitations, and residual uncertainty. Do not average professional truth. Dialogue/memory remains context until admitted as identified Evidence. No automatic acceptance without versioned policy and valid authority. |

---

## 17. Corpus coverage and source map

This guide is self-contained for orientation and bounded implementation, but exact schema, transition, policy, fixture, and migration work still consults its governing source. Coverage is deliberate:

| Source | Distilled contribution | Primary sections | Status in this guide |
|---|---|---|---|
| [Constitution Discussion](<Constitution Discussion/Janumi Constitution Discussion.md>) | first principles, cognition loop, CPCO, projections/workspaces, Shape Engineering, JSDL, JEM, JSRP | 1–2, 5, 11–13, 16 | compatible doctrine plus explicitly labeled candidate designs |
| [RPH document-set README](<Recursive Professional Harness/README.md>) | manifest, reading order, precedence, retired terms | 0, 3, 17 | corpus navigation authority |
| [Executive Overview](<Recursive Professional Harness/Janumi Platform - Executive Overview.md>) | product family, current stack, planes/trust, editions, status | 1, 4, 13 | orientation/current baseline; status is dated |
| [RPH-DOC-000 Vocabulary Charter](<Recursive Professional Harness/Janumi Product Architecture and Canonical Vocabulary Charter - Governing Product Ontology, Subsystem Boundaries, and Naming Authority.md>) | product ontology, canonical names, ownership and non-equivalence | 1, 3–4, 7, 13 | highest naming and product-boundary authority |
| [Engineering Constitution](<Recursive Professional Harness/Janumi Professional Workbench - Engineering Constitution.md>) | code, comments, tests, logging, errors, quality, review | 14–15 | engineering-practice authority |
| [RPH-DOC-001 Migration to RPH](<Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Migration to the Recursive Professional Harness.md>) | architectural intent, discipline separation, target views, migration scope | 2, 4, 7, 10–11 | architecture intent/scope |
| [RPH-DOC-002 Canonical Domain Model](<Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Canonical Domain Model, Invariant Catalog, State Machines, and Event Contract.md>) | objects, invariants, state axes, transitions, RPH semantics | 5–6, 8–9, 11 | professional meaning authority |
| [RPH-DOC-003 Product Realization PWA](<Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Professional Ontology and Assurance Policy Specification.md>) | branches, PWU Types, roles, Artifacts, profiles, recomposition | 7–8 | domain specialization authority |
| [RPH-DOC-004 Assurance Catalog](<Recursive Professional Harness/Janumi Professional Workbench Product Realization PWA - Assurance Policy Catalog and Validator Contract.md>) | twelve policies, applicability, Evidence, Validators, dispositions, waiver | 8, 16 | assurance meaning/validator authority |
| [RPH-DOC-005 Legacy Mapping](<Recursive Professional Harness/Janumi Professional Workbench Legacy JanumiCode - Semantic Inventory and RPH Conformance Mapping.md>) | legacy phase/dialogue mapping, gaps, narrow slice | 7, 10, 16 | migration interpretation, not current ontology |
| [RPH-DOC-006 FSM Reference Undertaking](<Recursive Professional Harness/Janumi Professional Workbench Field Service Management SaaS Reference Undertaking.md>) | concrete golden Undertaking, events, Evidence, Decisions, Baselines | 7, 14 | fixture, never PWA/product definition |
| [RPH-DOC-007 Contract Package](<Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Command, Event, Schema Contract Package.md>) | strict wire shapes, registries, schemas, errors, initial projections | 5, 8–9, 11, 16 | current serialized-boundary authority |
| [RPH-DOC-008 Conformance Tests](<Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Executable Invariant and Conformance Test Specification.md>) | executable properties, fixtures, persistence/replay and coverage gates | 6, 8, 14, 16 | acceptance oracle for its declared slice |
| [RPH-DOC-009 Persistence and Cutover](<Recursive Professional Harness/Janumi Professional Workbench Recursive Professional Harness - Persistence, Migration, Dual-Run, and Cutover Design.md>) | storage, outbox, replay, recovery, authority modes, cutover | 10, 13, 16 | persistence/operation authority |
| [RPH-DOC-010 Workbench UX](<Recursive Professional Harness/Janumi Professional Workbench PWA Designer and Undertaking Workbench - Reference Demonstration.md>) | definition/instance UX, five contexts, version migration, learning loop | 11, 16 | user-facing separation authority |

When a coding task needs exact fields or behavior, follow the link for the governing layer, then inspect the generated implementation and tests. If the source and executable artifact disagree, report the drift; do not silently choose one or update only prose.
