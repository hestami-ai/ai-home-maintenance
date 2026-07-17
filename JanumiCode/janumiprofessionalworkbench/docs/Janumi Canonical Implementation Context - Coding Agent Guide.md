# Janumi Canonical Implementation Context

## Compact constitution, architecture map, and coding-agent guide

**Document ID:** `JANUMI-CIC-001`<br>
**Status:** Proposed consolidated baseline<br>
**Date:** 2026-07-14<br>
**Audience:** Coding agents, architects, product engineers, UX engineers, validator authors, platform engineers, and reviewers<br>
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
14. **Legacy design evidence:** the JanumiCode v2.3 specification, Validator Subsystem concept/roadmap, and Fusion Analogy. Their governed-stream and assurance-control ideas are informative; their phase model, schemas, storage, providers, and authority rules are not current contracts.
15. **Other examples:** illustrative schemas and conversational prose that are not part of the numbered contract.

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

The Constitution Discussion proposes CPCO, JSDL, JEM, and a single-node runtime profile. The legacy materials propose a monolithic Governed Stream, a Professional Wisdom Compiler, validation-convergence records, and a fusion/confinement model. These are valuable design inputs, but their self-applied authority or implementation detail is not ratified. Use compatible doctrine through the numbered model; do not import their enums, routes, lifecycle stages, schemas, storage topology, provider choices, or authority assumptions.

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

Shape Engineering defines the intended professional trajectory—what work is, what transformations are permitted, what must survive, and what failure modes matter. **Assurance Engineering** designs and operates the evidence-bearing control system that determines whether the evolving work remains justified and may safely advance:

```text
professional knowledge + Intent + PWA/profile + risk + exact work version
→ applicable policies and assurance coverage
→ production/execution with diagnostic provenance
→ intrinsic, derivational, and systemic assessment
→ durable observations/findings
→ governed repair, revalidation, tactic change, or escalation
→ convergence and residual-uncertainty assessment
→ authorized Decision and possible Baseline promotion
→ outcome observation and governed policy learning
```

A Validator is one replaceable evaluator inside this system. It is not Assurance Engineering, the controller, or the authority.

The controlling assurance invariant is: **every material professional transformation has an explicit coverage decision, and every control resolved as required is durably bound, executed, recorded, inspectable, and enforced before its protected downstream transition.** The non-removable floor includes Reasoning Review for every material AI/agent-produced transformation; risk-derived controls add to that floor.

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
    defines recursively composed PWU Types, typed child rules,
    decomposition/recomposition, assurance, roles, and baseline types
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

9. **AI participation is visible.** Material AI contributions identify agent, role, model/version, execution context, tools, Evidence, Assumptions, limitations, and accepted/rejected disposition. Preserve professional rationale. Never require private chain-of-thought, rest a finding on it, place it in another agent's context, or build a dedicated store for it.

10. **State and history are explicit.** Do not infer lifecycle, validity, approval, assurance, or authority from null fields, storage location, UI placement, or prose. Material revisions, supersession, reopening, corrections, and reconciliation remain reconstructable.

11. **Detected incoherence remains visible.** Contradictions are resolved, tolerated, deferred, dismissed, or escalated explicitly. They are never erased because one side is newer or more fluent.

12. **Assurance and structure are risk-proportional.** Consequence, uncertainty, irreversibility, security, regulation, and organizational policy determine rigor. Avoid both under-governance and ceremonial over-modeling.

13. **Runtime authority is separate from work definition.** A PWA, PWU, plan, prompt, or agent may request a capability; only runtime policy may grant tools, files, network, secrets, models, sandboxes, or privilege.

14. **Professional waiting and failure are durable.** Human waits, external dependencies, retries, Attention, Process/RPH state, and partial work survive restart. Insufficient authority, Evidence, capability, budget, or productive tactics causes safe stop or escalation, never fabricated completion.

15. **Implement narrowly.** Prefer the smallest mechanism that preserves approved semantics. Scope changes, architectural deviations, and new abstractions require explicit rationale and Decision.

16. **Assurance is continuous trajectory control.** Assurance is co-designed at transformation boundaries and across dependency closures; it is not a final review, a generic score, or a pile of critics.

17. **Findings are durable obligations.** Regeneration, repair, waiver, override, supersession, or later success never erases what was observed about an exact subject version. Every material finding remains accounted for through resolution, accepted risk, deferral, supersession, invalidation, or escalation.

18. **Passing checks is not stability.** Criterion compliance, Assessment satisfaction, gate readiness, stability, convergence, authorized acceptance, and Baseline promotion are distinct. Corrections must be impact-analyzed and revalidated; oscillation and non-progress remain visible.

19. **Assurance itself requires assurance.** Policies, Validators, rubrics, Evidence access, control selection, independence, and remediation pressure are versioned, observable, challengeable, tested, and governable.

20. **De minimis assurance is non-optional.** Every material professional transformation receives the mandatory baseline controls defined in Section 8.4. Every material AI/agent-produced result receives Reasoning Review before it can become admissible professional state or support a protected downstream transition. Risk-derived planning adds controls; it never subtracts this floor.

---

## 3. Canonical vocabulary and non-equivalences

| Term | Canonical meaning |
|---|---|
| **Janumi** | Company, brand, product family, and organizational authority. |
| **Janumi Platform** | Shared multi-tenant infrastructure, runtime, identity, commercial, integration, governance, and professional-work services. It supplies machinery, not domain semantics. |
| **Janumi Professional Workbench (JPWB)** | General environment for designing/versioning PWAs and operating, executing, assuring, governing, tracing, and baselining Undertakings. |
| **Recursive Professional Harness (RPH)** | Coordination/control architecture that frames, allocates, supervises, reconciles, synthesizes, and escalates recursive professional work. It may use workflow engines and agent orchestration but is not defined by them. |
| **Assurance Engineering** | Discipline that designs and operates the versioned evidence-and-control system by which professional knowledge becomes applicable policies and inspection methods; exact work versions are assessed, findings become durable obligations, repairs are revalidated, convergence and residual uncertainty are established, and the assurance machinery is itself tested and governed. |
| **Professional Work Architecture (PWA)** | Reusable, versioned architecture for a class of professional work, rooted in PWU Types and recursively composed through explicit type-level child, decomposition, recomposition, obligation, assurance, governance, fixture, and conformance rules. It is not primarily a sequence. |
| **Professional Work Unit (PWU)** | Bounded, identifiable, executable, assessable, traceable, and governable unit of professional work. |
| **PWU Type** | Reusable definition owned by a PWA version. Each instantiable type is explicitly a coherent leaf or a non-leaf with permitted, mandatory, and conditional child-type rules plus decomposition and recomposition semantics. |
| **PWU Instance** | Concrete PWU owned by one Undertaking. It is a coherent leaf or recursively decomposes into child PWU Instances through explicit Decomposition and Recomposition Contracts. A local extension is explicitly marked and does not mutate its PWA. |
| **Child PWU Type / Child PWU Instance** | Recursive composition at the reusable PWA-definition level versus concrete decomposition inside an Undertaking. “Sub-PWU” is explanatory shorthand, not another canonical object type. |
| **PWA Work Architecture View** | Recursive View of a PWA version's PWU Types and permitted composition. It displays reusable definitions and type-level rules, not concrete state or temporal execution order. |
| **Undertaking** | Concrete body of professional work instantiated under one or more compatible PWA versions. It owns actual state, Evidence, Decisions, and Baselines. |
| **Professional Work Graph** | The typed semantic graph of PWU Instances and related objects belonging to an Undertaking. |
| **Execution Plan** | Governed, versioned strategy for performing selected PWUs. |
| **Execution Workflow** | Temporal machinery that carries out a plan: steps, branches, loops, waits, agents, humans, and tools. |
| **Assurance Policy** | Versioned professional rule defining applicability, claims, Evidence, criteria, independence, dispositions, remediation, escalation, and waiver. |
| **Validator** | Replaceable deterministic, model-based, hybrid, human, or external evaluator implementing bounded Assurance Policy concerns. It may recommend policy-permitted control actions; it cannot authorize or select them for execution, decide, repair, or mutate professional state. |
| **Reasoning Review** | Mandatory de minimis Assurance Policy/control for every material AI/agent-produced professional transformation. A conforming Validator independently evaluates the exact output and its observable derivation, provenance, assumptions, constraints, Evidence use, uncertainty, and completion claim; it does not require or expose private chain-of-thought. |
| **Professional rationale summary** | The agent-authored account of its own professional reasoning returned under Section 9.7's execution contract, bound to the Evidence used, Assumptions, Claims, limitations, and residual uncertainty it declares. It is a contracted deliverable addressed to the governed system, not a byproduct of a provider's runtime. It is not private chain-of-thought. |
| **Private chain-of-thought** | A model's interior deliberation and any rendering of it: raw reasoning tokens, inline reasoning volunteered by a local or open-weight model, or a summarized reasoning block returned by a hosted API. The term is fixed by origin, not by disclosure. It is not a professional rationale summary and is not observable trace data within Section 8.4's meaning. Section 9.7 governs its handling. |
| **Material professional transformation** | Production or semantic revision of a professional object, Artifact, Claim, Evidence proposal, decomposition/recomposition result, Decision package, Baseline candidate, or other output that feeds another actor/agent, affects governed work, or supports a protected transition. Low-level rendering, retrieval, formatting, and retries are not material by themselves unless their result has one of those effects. |
| **Finding Definition** | Policy-defined failure or concern type, identified by `findingCode`; it is not a detected instance. |
| **Assurance Observation** | One concrete, version-bound detection. Current contracts represent a concrete finding as an `AssuranceObservation` with `observationType: FINDING`; there is no separate Finding entity. In prose, **finding** is shorthand for such an observation and its governed unresolved concern. |
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
PWA Work Architecture View ≠ Professional Work Graph
child-type composition ≠ instance decomposition ≠ dependency
semantic progression ≠ temporal execution sequence
Commit ≠ Baseline                  Product ≠ Undertaking
Validator ≠ Assurance Engineering Finding ≠ Decision
Assessment satisfaction ≠ convergence ≠ acceptance ≠ Baseline promotion
Projection/chat/repository/memory ≠ authoritative semantic state
```

### 3.1 Retired and compatibility terminology

- `Product Lens` → **Product Realization PWA**.
- `Lens Designer` / `Lens Library` → **PWA Designer** / **PWA Library**.
- `workflow` for the whole professional structure → **PWA** or **Professional Work Graph**; reserve workflow for temporal execution.
- `sub-PWU` → **child PWU Type** at PWA-definition boundaries or **child PWU Instance** in an Undertaking. Do not introduce a separate `SubPWU` entity or kind.
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

### 4.2 Engineering and authority boundaries

| Discipline | Governs |
|---|---|
| **Prompt Engineering** | Invocation instructions, immediate objective, output contract, examples, and formatting. |
| **Context Engineering** | Relevant artifacts, history, Decisions, Evidence, retrieval, prioritization, freshness, compression, and exclusion. |
| **Harness Engineering** | Models, agents, tools, sandboxes, permissions, memory infrastructure, persistence, observability, and operational controls. |
| **Loop Engineering** | Next action, branching, retries, execution of corrective work, policy-permitted tactic change, escalation, and termination. |
| **Shape Engineering** | Intent, boundaries, obligations, constraints, Assumptions, decomposition, recomposition, and semantic integrity. |
| **Assurance Engineering** | Professional-knowledge treatment, policy/applicability, risk-sensitive control coverage, Evidence and inquiry, Validator topology, durable findings, repair/revalidation requirements, convergence criteria/assessment, meta-assurance, residual uncertainty, and governance integration. |

A prompt is not a role; a role is not a model binding; a plan is not a PWU; a validator is not a policy; runtime privilege is not domain permission.

Shape Engineering defines the work, transformation graph, invariants, and failure envelope. Assurance Engineering defines how those claims are challenged and justified across the trajectory. Validator Engineering is an Assurance specialization that implements individual evaluators; Context supplies bounded material; Harness supplies execution machinery; Loop selects and performs policy-permitted operational responses. Assurance may record a `REJECTED` Assessment disposition under policy; Governance is an authority function outside the six engineering disciplines and alone authorizes waiver, risk acceptance, rejection or abandonment of governed work, and promotion. These boundaries must interoperate without collapsing ownership.

### 4.3 Logical responsibility boundaries

The canonical logical services are:

- Work / semantic object service;
- Shape, decomposition, and recomposition service;
- Execution planning and durable process/controller service;
- Runtime authorization and harness-binding service;
- Agent/tool/sandbox execution service;
- Assurance Policy/profile/applicability, Evidence admission, Validator execution, Assessment, and result-canonicalization service;
- Governance and Baseline service;
- Traceability, impact, reconciliation, and Attention service;
- Event, audit, artifact, projection, integration, and observability services.

These are responsibility boundaries, not mandatory microservices. A modular monolith is valid when it preserves them. Runtime topology must not change professional meaning. Section 8 identifies target knowledge-compilation, coverage-planning, repair-impact, revalidation, convergence, and meta-assurance responsibilities whose exact service and machine contracts remain unresolved under Section 16 items 22–25; do not invent parallel services, tables, or Events for them.

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
| **Assurance Assessment** | Version-bound evaluation of Claims/subjects under an Assurance Policy. Validation is the activity, not a second object type. |
| **Assurance Observation** | What was detected or measured and its professional implication. A finding-type Observation is distinct from its `FindingDefinition`; observation, interpretation, and Claim remain separate. |
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

### 5.6 The governed professional stream

The durable idea behind legacy JanumiCode's **Governed Stream** is one logical, queryable history of professional work—not its single SQLite table or its phase record taxonomy. In the current architecture the governed professional stream is the causally connected union of typed Commands/results, aggregate revisions, immutable Events, execution attempts/traces, Artifacts, Claims, Evidence, Assessments, Observations, Decisions, Baselines, and audit records. Rebuildable projections are views over that history, never constituents of its authoritative record.

Every material proposal, transformation, validation input/output, finding, repair, control action, supersession, waiver, and acceptance must retain:

- stable identity/type and schema/semantic version;
- Undertaking/PWA/PWU/tenant scope;
- producer/actor, runtime provenance, correlation and causation;
- exact input, subject, context projection, policy, Validator, Evidence, and output references;
- occurred/observed, recorded, valid, and effective time where distinct;
- proposal/admission/authority status, current/superseded relation, and any applicable redaction or policy-governed isolation handling;
- derivation, dependency, impact, and successor/predecessor relations.

Rejected, invalid, quarantined, superseded, revoked, and failed material remains inspectable but cannot silently govern current work. Record exactly what an Assessment was permitted to see, including unavailable or rejected Evidence and declared truncation, so its conclusion can be reproduced and challenged. Partial retrieval is represented as partial; a summary never substitutes for the referenced source state.

Rollback, semantic supersession, correction, and compensation remain distinct. A material upstream change computes dependency/impact closure and invalidates or reopens affected Claims, Evidence, Assessments, Decisions, readiness, and Baseline candidacy as policy requires; it never deletes the historical approval or rewrites an authoritative Baseline.

Quarantine means policy-governed isolation and non-admissibility, not a universal object field or lifecycle enum. Do not implement a universal `GovernedStreamRecord`, duplicate Event authority, store every Artifact body in one table, or build a dedicated store for private chain-of-thought. Preserve decision-relevant rationale, observable actions, tool inputs/outputs, self-reported limitations, and professional provenance subject to retention, security, and redaction policy. Section 10's typed persistence remains authoritative.

---

## 6. PWU, decomposition, recomposition, and state

### 6.1 Readiness

A PWU meets the canonical minimum readiness contract only when it has:

- one clear professional objective and active/provisional Intent or explicit exploratory authority;
- explicit in-scope and out-of-scope boundaries, or explicit unknowns;
- mandatory Obligations, Constraints, material Assumptions, dependencies, and responsible authority;
- required inputs, expected outputs, completion Claim/criteria, Evidence and assurance expectations, and applicable risk/assurance profile.

The exact PWA/profile and risk may additionally require known failure dynamics, applicable policies and independence, intrinsic/derivational/systemic coverage, or decomposition/recomposition, repair-impact, revalidation, convergence, tactic-change, escalation, and stop rules. Express those requirements through currently ratified policy/profile contracts where possible; they are not new universal PWU fields or readiness axes. If an exact representation is required, follow Section 16 items 23–24.

Do not create a PWU for prompt rendering, retrieval, an API call, formatting, a database write, a retry, or a UI click. Those are execution/runtime steps unless they independently carry professional meaning, obligation, Evidence, and lifecycle.

### 6.2 Recursive type composition and instance decomposition

Recursion exists at two distinct levels and must not be collapsed:

```text
PWA version → root PWU Type → recursive child-type rules → explicit leaf PWU Types
Undertaking → root PWU Instance → Decomposition Contracts → child PWU Instances → recomposition
```

“Sub-PWU” is not a separate entity. At PWA-design time, a PWU Type may permit, default, or conditionally require **child PWU Types**. In an Undertaking, a PWU Instance may decompose into **child PWU Instances**. Each child remains a full PWU with its own bounded objective, delegation contract, lifecycle, Evidence, assurance, and recomposition contribution.

Every instantiable PWU Type is explicitly one of:

- a coherent leaf that is assessable and governable without further professionally meaningful decomposition; or
- a non-leaf with named permitted, mandatory, and conditional child PWU Types, cardinality/applicability, obligation and Constraint allocation, coverage expectations, and a recomposition rule.

Every instantiable type is reachable from a root or declared extension point, and type-level composition is acyclic. An implicit leaf, opaque child count, generic `permits` edge without typed meaning, or non-leaf without recomposition is incomplete and blocks publication. Instantiation recursively materializes every applicable mandatory/default child; conditional children materialize when their applicability conditions hold, while governed optional/discovery decomposition remains explicit. A type-level `PERMITS_CHILD_TYPE` relation never proves that an instance child exists or is valid.

Do not confuse composition with timing. A child PWU carries an independently meaningful professional obligation. A prerequisite, dependency, semantic progression, produced-input relationship, or temporal Execution Step is modeled as that relationship—not mislabeled as parent/child decomposition. Prompt rendering, model/API calls, tool calls, retries, and handoffs remain Steps/Attempts unless they independently satisfy the PWU boundary test.

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

| Relationship | Level | Meaning |
|---|---|---|
| `PERMITS_CHILD_TYPE` / child rule | PWA definition | Permitted, mandatory, or conditional reusable composition with applicability/cardinality. |
| `PRECEDES_SEMANTICALLY` | PWA definition | Meaningful professional progression; not runtime order. |
| `REQUIRES_INPUT_TYPE` / `PRODUCES_OUTPUT_TYPE` | PWA definition | Typed input/output compatibility; not containment or timing. |
| `DECOMPOSES` | Undertaking instance | Concrete parent-child PWU structure under a Decomposition Contract. |
| `DEPENDS_ON` | Undertaking instance | One professional object requires another; dependency is not containment. |
| Execution Workflow transition | execution | Temporal steps, calls, branches, waits, retries, and tool/agent activity. |

Do not infer one relationship from graph position or render these meanings as one generic edge.

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

At the reusable level these are child PWU Types in the PWA Work Architecture; when instantiated they become child PWU Instances in the Undertaking's Professional Work Graph. Top-level Product Realization branches are normally siblings beneath the root, not a linear chain in which each branch “permits” the next. Semantic progression, dependencies, input/output traces, and execution order remain separately typed relationships.

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

## 8. Assurance Engineering, governance, and Baselines

### 8.1 System boundary and objective

**Assurance Engineering** is the discipline of designing and operating the versioned evidence-and-control system that establishes justified confidence in professional work under uncertainty. It is concerned with the complete trajectory by which Intent is transformed—not only the latest Artifact or whether one check passed.

It coherently designs and integrates the assurance treatment of:

- authority-classified professional knowledge, hazards, quality models, failure ontologies, and inspection methods as assurance inputs;
- versioned Assurance Policies, applicability, profiles, and control coverage;
- Evidence requirements/admission, Claims, criteria, and required independence;
- Validator selection, context/Evidence exposure, execution, and conformance;
- structured Assessments, concrete Assurance Observations (including findings), composition, and disagreement;
- impact analysis, invalidation, governed repair, and targeted revalidation;
- stability, convergence, tactic-change, escalation, and stop conditions;
- waiver, risk-acceptance, Decision, and Baseline eligibility packages supplied to Governance;
- meta-assurance, runtime outcome learning, policy evolution, and control cost.

These are logical responsibilities, not one required service or database. The Validator subsystem is the evaluator-execution arm of Assurance Engineering. RPH/Loop Engineering coordinates corrective work; Commands change canonical state; Governance exercises authority.

The closed loop is summarized in Section 1 and operationalized in Section 9. Assurance operates recursively: a local loop governs one Attempt/output/repair, while a global loop composes assurance across PWUs, decomposition/recomposition, dependencies, Undertaking state, Decisions, and Baseline candidacy. Local satisfaction never substitutes for global coherence.

### 8.2 Operating envelope and trajectory integrity

The fusion analogy is an explanatory lens, not ontology. Generative actors are the energetic medium; the professional harness supplies the work system; Shape Engineering defines the transformation geometry; policies and Validators create diagnostic coverage; observability supplies diagnostics; RPH/Loop Engineering selects control responses; Commands/repair PWUs are actuators; Governance supplies operator authority. Validators detect and characterize conditions—they do not exert authority or edit the subject.

The **authorized operating envelope** is a conceptual reasoning model—not a persisted object, scalar score, wire contract, or lifecycle enum. It is the contextual conjunction of Intent, hard invariants, legal states, applicable policies/criteria, admissible Evidence, required independence, permitted uncertainty, authority, and dynamic-control limits. It has four useful regions:

1. **Never-cross boundary:** tenant isolation, authority, immutable history, strict Commands, legal transitions, version isolation, and non-waivable integrity always hold.
2. **Provisional region:** incomplete or challenged proposals may exist when visibly provisional, bounded, and unable to create unauthorized effects.
3. **Transition-ready region:** current Evidence, Assessments, independence, impact closure, and policy dispositions satisfy the requested transition.
4. **Dynamic-control boundary:** retry/remediation count, recurrence, oscillation, unknown outcome, time/cost, and escalation limits remain inside policy.

**Trajectory integrity** means every authoritative transition respected the never-cross boundary while provisional defects stayed visible and non-authoritative until resolved or dispositioned. A valid-looking final snapshot cannot repair an unauthorized or unobservable trajectory retroactively.

### 8.3 Compiling professional knowledge into assurance controls

The legacy **Professional Wisdom Compiler** is a useful candidate design-time capability, not a ratified runtime or object model. Its durable rule is: do not merely paste professional guidance into a prompt; transform it, with provenance and epistemic status intact, into reviewable control structures.

```text
source doctrine
→ normalized candidate doctrine assertion and believed mechanism
→ applicability, exceptions, hazard, and observable indicators
→ invariant, Obligation, and prohibition
→ Evidence requirement and inspection method
→ policy criteria and Validator conformance contract
→ remediation and revalidation rules
→ convergence, tactic-change, escalation, and waiver rules
→ conformance and meta-assurance tests
```

Sources include laws/regulations, standards, organizational policies, empirical regularities, principles, heuristics, smells, anti-patterns, incident patterns, inspection methods, lessons learned, and expert judgment. Formalization must not increase authority: a smell remains a signal, a heuristic remains defeasible, a correlation does not become causation, and an organizational preference does not become a universal invariant.

A conceptual **assurance-control package** may contain concise doctrine, invariants, quality models, failure modes, Evidence requirements, inspection strategies, Assurance Policy definitions, Validator contracts/bindings, severity/disposition rules, repair/revalidation/impact rules, convergence controls, escalation/waiver rules, and fixtures. Compatible portions must be represented through existing versioned PWA policy/profile contracts rather than a new authoritative `ProfessionalWisdomIR`. There is no ratified compiler, package schema, or activation contract; Section 16 items 22–23 govern any implementation.

Any future compilation pipeline must itself be assured: classify source authority/status; preserve provenance/version; detect conflict and dependency; validate generated controls for fidelity, overlap, gaming, contradictory remediation, proportional cost, and available Evidence; then govern activation, suspension, supersession, and retirement. Untrusted source text cannot become executable instructions through retrieval or compilation.

### 8.4 De minimis assurance floor and control planning

Risk proportionality governs assurance above a mandatory floor; it does not make the floor optional. Every material professional transformation must receive, in order:

1. strict output-contract/schema validation plus applicable deterministic invariants;
2. identity, semantic-version, provenance, authority, input/context/output, and trace completeness checks;
3. a Reasoning Review Assessment when the transformation is produced by or materially shaped by an AI/agent; and
4. canonical admission/disposition and enforcement of the protected downstream transition.

Every AI/agent result that creates or materially changes professional content, supplies a downstream actor or agent, proposes a Claim or Evidence item, changes decomposition/recomposition, contributes to a Decision/Baseline package, or supports a governed transition necessarily triggers Reasoning Review. Such results are material by default. A result is nonmaterial only when a versioned rule establishes lossless semantic equivalence; the producer cannot exempt its own output, and ambiguity resolves to material. Each independently downstream-consumable result is its own transformation boundary unless an explicit grouping records every subject/version and its rationale.

Reasoning Review is a versioned Assurance Policy concern implemented by a replaceable Validator—not an informal second prompt, one fixed provider, or a legacy review record. It must:

- bind the exact subject/output, input and context versions, producing Attempt/invocation, policy/criterion versions, and available Evidence;
- evaluate observable derivational integrity: unsupported Assumptions, invalid or circular inference, scope/authority confusion, contradiction, premature convergence, completeness shortcuts, unacknowledged uncertainty, and misuse or omission of relevant Evidence;
- record considered/rejected/missing Evidence, findings, limitations, uncertainty, provenance, and a recommendation through the normal Validator-result and Assessment contracts;
- prohibit same-invocation self-review and use at least a distinct evaluator invocation, role, and review context whose actual identities and lineage are recorded; the same base model is allowed only when the active profile permits its visible common-mode limitation, while stricter profiles may require a different model/provider or human/organizational independence;
- review professional rationale summaries, outputs, tool-call records/results where authorized, and other observable trace data without requiring private chain-of-thought.

No PWA profile, low-risk classification, planner optimization, or local agent instruction may suppress this Reasoning Review floor. Deterministic failure may short-circuit an obviously invalid candidate, but its repaired successor must still receive Reasoning Review before admission. A missing, stale, malformed, failed, unavailable, or independence-invalid required review cannot satisfy assurance or permit its protected transition. Validator failure does not prove the subject wrong; it leaves assurance incomplete and triggers retry, alternate evaluation, or escalation.

Above that floor, every material transformation boundary has an explicit, risk-derived assurance-coverage decision. Required, inherited, deferred, waived, and inapplicable **additional** coverage are explainable; gaps are never silent. Do not run every possible Validator at every step or rely on one universal critic; always run the mandatory floor and add controls for the exact risk.

Coverage planning considers:

- exact PWA/profile/PWU Type and subject/semantic versions;
- transformation, lifecycle point, semantic diff, dependency/consumer impact, and prior Decisions;
- consequence, uncertainty, irreversibility, security/regulatory exposure, and risk profile;
- applicable mandatory/advisory policies, known failure dynamics, and open/recurring Findings;
- required Evidence, freshness, context completeness, and actual independence/diversity;
- available deterministic/model/human/external methods, cost/latency budgets, and escalation path.

A future logical plan would identify policy/criterion versions, assurance targets and dimensions, Validator bindings/order/parallelism, context/Evidence scope, transition gate, remediation locus, impact/revalidation closure, convergence/stop rules, and diagnostic observations. A planner may optimize optional controls but cannot weaken mandatory applicability or independence. When impact or Evidence sufficiency cannot be bounded confidently, broaden assessment or escalate.

Coverage can occur before generation, after generation, after assessment, after repair, before/after a Decision, or continuously. These are conceptual lifecycle points, not a new legacy phase/state axis. The exact generalized plan/topology contract is unresolved; until Section 16 item 23 is decided, derive coverage through versioned PWA policies/profiles and preserve rationale only through existing contracted objects and Events. This unresolved extension does not defer the de minimis floor above. If even that floor cannot be represented and enforced losslessly, the PWA cannot be published and the protected runtime transition cannot proceed until the contract is corrected.

### 8.5 Validation dimensions, targets, and inquiry strategies

Assurance design analyzes every material concern across at least one orthogonal validation dimension:

| Dimension | Governing question |
|---|---|
| **Intrinsic** | Is this exact subject well formed and professionally adequate on its own terms? |
| **Derivational** | Was it legitimately derived from Intent, sources, Constraints, Evidence, and prior transformations? |
| **Systemic** | Does it remain coherent with related work, dependencies, consumers, policy, history, and the larger evolving system? |

These dimensions are coverage questions, not current wire enums, dispositions, or PWU state. Record them as policy/criterion rationale unless a ratified contract adds an explicit representation. A high-quality Artifact can be the wrong Artifact; individually valid parts can be jointly impossible.

Assurance targets include the professional object/Artifact; source and derivation; context and Evidence assembly; execution/transformation process; repair/revalidation process; dependency neighborhood and trajectory; and Decision/gate process. Validators, planners, rubrics, the control system, and observed outcomes are conceptual meta-assurance targets until current subject discriminators and contracts support them. A concern against the assurance process does not automatically reject the professional subject.

Useful inspection strategies provide structured cognitive diversity: smell detection, Assumption surfacing, counterexample search, traceability audit, completeness challenge, coherence check, dependency/change-impact analysis, second-order-effects analysis, reality grounding, proxy-integrity review, and stagnation/tactic-change detection. They are methods, not authority-bearing roles or necessarily separate Validators.

Validation is professional inquiry:

```text
signal → investigate → acquire/test Evidence → assess applicability/context
→ explain consequence and uncertainty → recommend governed action
```

A signal is not a defect; professional principles may conflict; `Rule violated → reject` is insufficient except for an explicit hard invariant.

### 8.6 Durable Findings, repair, and revalidation

Keep policy type and concrete detection distinct: `FindingDefinition`/`findingCode` defines a concern type; each `AssuranceObservation` with `observationType: FINDING` records one detection against exact subjects/versions and has its own `observationId`. In this section, **Finding** is shorthand for that finding-type Observation and its unresolved governed concern, not another entity. Adapt heterogeneous legacy outputs into current objects rather than creating a parallel `validator_finding_record`.

Across the contracted Assessment, Validator result, Evidence, execution, audit, and Observation records, a material detection must be traceable to the exact subject/version, policy/criterion, target and conceptual dimension/lifecycle point, Validator/invocation/context versions, considered/rejected/missing Evidence, failure mode, severity, rationale, consequence, uncertainty, recommended action, provenance, and disposition. Do not pretend these are all fields on `AssuranceObservation`. Recurrence uses `findingCode` plus a candidate fingerprint/lineage relation; it never reuses an Observation identity. Exact recurrence and repair contracts remain Section 16 item 24 decisions.

The core lifecycle invariant is:

```text
detected and admitted
→ assigned to corrective work or authorized disposition
→ repair attempted
→ impact closure computed
→ revalidation completed
→ resolved | accepted risk | waived | deferred | superseded | escalated
```

This is semantic guidance, not a ratified wire enum. A finding-type Observation never disappears because an Artifact was regenerated, a Validator reran, a waiver was granted, or a successor version passed. Its statement about the assessed version remains immutable.

Repair is governed professional work, never Validator mutation. Any adopted repair contract must preserve triggering Observation IDs, selected strategy/authority, root-cause hypothesis, exact pre/post versions and hashes where applicable, semantic/structural diff, changed identities/relations/traces/Constraints, remediation locus, revalidation set/rationale, outcomes, and residual findings. When the cause lies in Intent, representation, context, Evidence retrieval, decomposition, Plan, identity, policy, or authority, a superficial output patch is invalid.

Any adopted impact/revalidation contract must treat targeted revalidation as a cost optimization, not permission to omit affected assurance. Ratified versioned impact rules map semantic change surfaces to required policies/inspection strategies; identity, parent-child, reference, trace, authority, policy, Evidence, or meaning changes require broad systemic closure where those rules apply. Unknown impact triggers conservative revalidation or escalation.

Quarantine means preserved but non-admissible/non-governing. Validator failure, malformed result, missing Evidence, or independence failure remains diagnostic assurance-process state and never proves the subject wrong or satisfied.

### 8.7 Stability, convergence, and advancement

The distinctions below are conceptual assurance properties, not current state axes or wire fields. They become enforceable only through applicable ratified policies, guards, and Commands.

| Property | Meaning |
|---|---|
| **Criterion compliance** | One criterion is met for one exact subject/Evidence set. |
| **Assessment satisfaction** | One policy's current criteria and independence requirements are satisfied. |
| **Gate readiness** | All required current Assessments for a requested transition are complete and non-blocking. |
| **Stability** | Repair/impact closure is complete with no unresolved disallowed Finding, stale dependency, or detected recurrence/oscillation. |
| **Convergence** | Successive repair cycles are moving toward a declared stable condition within tactic/time/cost limits. |
| **Trajectory integrity** | Authoritative transitions stayed within hard boundaries; provisional defects remained bounded and visible. |
| **Acceptance** | An authorized Decision accepts exact versions and residual risk. |
| **Baseline promotion** | A separate effective Decision establishes immutable authoritative state. |

None implies the next automatically.

Convergence requires a known applicable policy set, complete current Assessments and Evidence, required independence, every material Finding accounted for, linked repairs revalidated, no unaccounted material regression, visible conflicts, current waivers/risk acceptance, and explicit residual uncertainty. It does not prove truth.

Progress signals include declining unresolved severity, increasing Evidence/coverage, stable non-recurrence, bounded change, and narrowing independent disagreement. Stagnation/divergence signals include repeated failure classes, alternating repairs/findings, growing impact closure, increasing change without outcome progress, repeated unsupported Assumptions, validator disagreement that does not narrow, and budget exhaustion. These are Loop telemetry, not a numeric truth score.

As a conceptual review checklist—not an executable guard, schema, or replacement for DOC-007/008 transitions:

```text
MayAdvance(subjectVersion, transition) :=
  hard invariants hold
  AND transition authority is valid
  AND applicable assurance coverage is complete
  AND required Evidence is admissible/current
  AND required independence is satisfied
  AND no disallowed blocking condition remains
  AND impact/revalidation closure is complete
  AND convergence/stop policy permits advancement
```

Only the applicable ratified subset of this checklist is enforced against authoritative state when a Command executes; the checklist does not itself implement or add a guard. A convergence projection cannot authorize change. Assurance determines eligibility/recommendation, not authority. A human may propose or make a Decision, but applicable policy, validated authority, and ratified Command/domain guards determine whether and how it takes effect: non-waivable integrity cannot be acknowledged away, and permitted residual risk requires an explicit scoped Decision/waiver that preserves findings.

### 8.8 Meta-assurance and governed learning

Policies, Validators, planners, rubrics, and the assurance system are conceptual meta-assurance targets. Evaluate whether a Validator tests the intended concern; its precision/recall and escaped consequential defects; Evidence availability; independence/context isolation; shared model/provider/prompt/premise common mode; prompt/rubric leakage; Goodhart susceptibility; stale knowledge/tooling; contradictory remediation pressure; calibration; and cost proportionality. Until Section 16 item 25 supplies subject and lifecycle contracts, capture this as isolated engineering diagnostics/Evidence rather than unsupported canonical Observations.

Use known-good fixtures and deliberately corrupted, held-out canaries to test Validator conformance. An undetected canary creates candidate engineering Evidence against the Validator/control system and should trigger escalation or a governed proposal for alternate selection, rubric refresh, broader revalidation, or suspension. It does not create a canonical Observation or suspend a control until ratified contracts authorize that path, and it does not automatically reject unrelated professional work. Keep canaries isolated from production Evidence and begin in a harness.

Runtime outcome and incident observations may propose new failure modes or policy revisions:

```text
outcome/incident → candidate recurrent dynamic → professional review
→ draft wisdom/policy change → conflict + meta-validation
→ authorized activation, suspension, supersession, or retirement
```

No telemetry correlation, model suggestion, or repeated local pattern self-promotes into authoritative professional knowledge. Missing required diagnostic history means trajectory integrity cannot be claimed; it does not justify assuming nothing went wrong.

### 8.9 Policy, validator, service, and Decision

The governing rule is:

> A Validator is a replaceable implementation of a versioned Assurance Policy. It evaluates identified Claims using identified Evidence and returns schema-conformant proposed findings and recommendations. The Assurance Service validates the result, enforces policy, and records the canonical Assessment disposition. That disposition does not authorize acceptance, waiver, risk acceptance, or promotion; Governance Decisions do.

A policy owns professional purpose, applicability, Claims, Evidence requirements, criteria, independence, severity, dispositions, remediation, escalation, waiver eligibility/rules, and permitted control actions.

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

Assurance binds at three distinct layers:

1. **Definition-time policy assignment:** a PWA/PWU Type declares required, conditional, and inherited Assurance Policies, their applicability, Evidence/independence requirements, and protected outputs or transitions. The de minimis floor appears as locked inherited coverage and cannot be removed by a PWA.
2. **Deployment-time capability binding:** an installed runtime identifies eligible/default conforming Validator implementations for each policy and independence profile. Availability is not execution.
3. **Instance-time assurance:** applicability resolves for an exact PWU Instance, transformation, subject, and version; an Assessment is created; the actual Validator implementation/version/context is bound and invoked; results and Observations are recorded; and the Assurance Service records the disposition.

A policy attachment proves required treatment; a configured Validator proves available capability; neither proves that assurance ran. A runtime guarantee exists only when durable coordination creates or resumes the required Assessment and the protected server-side transition revalidates its current disposition. An instance Assessment never mutates the reusable PWA definition.

### 8.10 Core policy catalog

In addition to Section 8.4's mandatory cross-cutting Reasoning Review concern, the initial catalog ships these twelve domain policies. “Core” means present in the catalog; applicability decides whether an Assessment is required for a given object. A production implementation must register and version Reasoning Review through the normal Assurance Policy, Validator, and Assessment contracts; it cannot substitute a prose-only prompt or silently count an uncontracted thirteenth catalog row. Section 16 item 23 governs the missing exact wire shape without weakening the mandate.

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

### 8.11 Evidence admissibility

Evidence is admissible only when identity is stable, provenance and content/reference are available, scope and limitations are explicit, relevance and freshness are adequate, and it is not invalidated.

Existence is not proof:

- an execution trace proves execution, not Intent satisfaction;
- a test result proves only its scoped behavior, not Requirement coverage by itself;
- an architecture document does not prove completeness;
- a citation proves a source made a statement, not that the statement is correct;
- a Validator opinion is Evidence only when professional judgment is permitted;
- generated prose remains an Artifact until admitted as Evidence;
- a professional rationale summary proves an account was emitted, not that it drove the output.

Evidence corrections create a new version. Invalidated or expired Evidence cannot support active satisfaction and triggers review of dependent Claims, Assessments, Decisions, and Baseline readiness. Contradicting Evidence remains visible.

### 8.12 Criteria, independence, and observations

Criterion results are:

```text
MET | PARTIALLY_MET | NOT_MET | NOT_APPLICABLE | UNABLE_TO_DETERMINE
```

`UNABLE_TO_DETERMINE` is never `MET`.

Independence levels range from no separation through different invocation/context, agent, model, provider, human, or organizational independence. The runtime checks actual invocation, agent, model/provider, hidden context, prompt lineage, and organizational authority—not a role label such as “Verifier.” If required independence is missing, the Assessment cannot be satisfied; record an independence violation and use another evaluator or, only when the applicable policy permits it, a valid scoped waiver.

Every material observation identifies subject, policy, criterion, Evidence or explicit professional judgment, severity, precise deficiency, implications, and recommended action. Avoid vague findings such as “looks reasonable” or “could improve.”

### 8.13 Dispositions and composition

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

### 8.14 Conceptual control responses

The labels below are an explanatory response taxonomy, not wire enums or Command names. Assurance and Validators may recommend; the controller may select policy-permitted operational responses:

```text
CONTINUE  WAIT  CLARIFY  GATHER_CONTEXT  GATHER_EVIDENCE
REVISE_PROMPT  REVISE_CONTEXT  RETRY
CHANGE_MODEL  CHANGE_TOOL  CHANGE_VALIDATOR  CHANGE_TACTIC
RESHAPE_PWU  REVISE_DECOMPOSITION  REPLAN_EXECUTION
INVALIDATE_DEPENDENTS  ESCALATE
```

Authority-bearing outcomes are requested, not selected by the controller:

```text
REQUEST_DECISION  REQUEST_WAIVER  REQUEST_REJECTION_OR_ABANDONMENT
REQUEST_BASELINE_PROMOTION
```

`REJECTED` as an Assessment disposition is recorded by Assurance under policy. Acceptance, rejection or abandonment of governed work, risk acceptance, waiver, and Baseline promotion require a valid Governance Decision and exact contracted Commands. Use Section 9.5's current registry; when the required semantic Command is absent, stop for a contract Decision rather than inventing one. Record trigger, policy, Evidence/observations, actor, affected objects, rationale, and expected effect for every material control response.

### 8.15 Waivers

A waiver records the exact policy, criterion, finding, object and semantic version, authority, rationale, duration/expiration, compensating controls, downstream impact, and review/revalidation triggers.

A waiver does not erase a finding, make invalid Evidence valid, declare a rejected Claim true, or automatically apply to a future semantic version. Critical integrity failures may be non-waivable. Expiration triggers review and may block promotion.

### 8.16 Decisions and Baselines

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
- changes tactic, reshapes, or replans under policy;
- reconciles changed understanding;
- synthesizes children into parent understanding;
- escalates responsibly when evidence, authority, expertise, capability, or budget is insufficient.

RPH always coordinates the de minimis floor: it resolves material transformation boundaries, supplies exact subject/context/Evidence versions to Assessments, and prevents protected downstream consumption until required assurance permits it. When an accepted implementation slice adopts Section 16 item 24's advanced repair/revalidation capabilities, RPH also routes material finding-type Observations into corrective work and detects recurrence, oscillation, and non-progress. These responsibilities do not authorize new objects or let Validators mutate subjects.

Delegation always includes objective, scope, authority, inputs/outputs, Constraints, completion, validation, dependencies, and escalation conditions. Assignment without this bounded responsibility is not delegation.

A simplified target controller reasoning cycle is below. It is not a wire workflow; each step must map to already accepted objects, Commands, Events, and policies:

```text
load current PWU + plan + shape + assurance coverage + open finding-type Observations
    ↓
adequately shaped? coverage/decomposition valid? plan approved? bindings authorized?
    ↓
execute next eligible step
    ↓
capture candidate Artifacts, observations, provenance, and telemetry
    ↓
admit applicable Evidence; assess intrinsic, derivational, and systemic Claims
    ↓
canonicalize Assurance Observations; preserve disagreement, limitations, and residual uncertainty
    ↓
continue | gather | create repair PWU/Action | retry | change tactic
| reshape | replan | escalate | request governed rejection/disposition
    ↓
after change: compute impact closure → invalidate affected assurance → revalidate
    ↓
assess stability/convergence; recompose satisfied children
    ↓
assemble current assurance package and request Decision/Baseline promotion
```

Every material output begins provisional. Before it may supply dependent professional work, be admitted as Evidence, support a Decision, satisfy/recompose a PWU, publish a PWA, trigger an irreversible external action, or enter a Baseline, durable coordination performs this barrier:

```text
persist exact candidate output + provenance
→ resolve de minimis, PWA/profile, PWU Type, and contextual policy applicability
→ create or resume idempotent Assessments
→ bind conforming Validators and verify actual independence
→ execute/reconcile; validate and persist results, Observations, and failures
→ apply Assurance Service dispositions
→ revalidate the protected transition against the exact current subject version
```

For a material AI/agent result, the resolved set always includes Reasoning Review. A required Assessment that is missing, pending, stale, invalidated, malformed, failed, unavailable, independence-invalid, or otherwise non-permitting blocks only the dependent/protected transition; it does not prove the subject wrong. Independent work may proceed only when it cannot consume or be governed by the provisional result. Restart, replay, and retry resume this barrier and never infer success. A visible attachment, configured Validator, in-memory call, or client-side badge is not the guarantee. If accepted contracts cannot represent the required binding losslessly, keep the output provisional and correct the contract rather than bypassing the floor.

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
→ resolve applicable de minimis, PWA/profile, PWU Type, and contextual policy coverage for the exact subject/version
→ require current Assessments, conforming actual Validator executions, admissible Evidence, required independence, and transition-permitting dispositions
→ revalidate impact/revalidation closure and reject missing, failed, stale, invalidated, or bypassed assurance
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

It returns proposed entities/Commands, professional rationale summary, Evidence used, Assumptions, Claims, limitations, unresolved Questions, residual uncertainty, validation results, and provenance. Agent completion never completes a PWU. A model may volunteer private chain-of-thought no control requested—raw inline reasoning from a local or open-weight model, or a summarized reasoning block returned by a hosted API. Never solicit it, never make a control depend on it, and never treat its presence or absence as a signal. Material that arrives is redacted at the boundary and then retained as a typed Artifact of its producing Attempt under retention, security, and access policy, so the prompt/reasoning/response exchange stays reconstructable. It is never admitted as Evidence, never supplies another agent's context, never reaches a log, never enters a default or shared projection, never supports a finding, and is never the professional rationale summary above. Retained reasoning material in an evaluator's context is a hidden-context independence violation under Section 8.12. It adds no dedicated reasoning store; Section 10's typed persistence remains authoritative. It participates in no execution, assurance, governance, Baseline, or traceability, so Section 10.1's no-hard-delete rule does not reach it; it is purgeable at retention expiry. Where accepted contracts cannot represent this losslessly, block the capability and resolve Section 16 item 23.

Every tool/sandbox call records identity, authorization scope, input reference, start/end, result/error, resource use, and declared outputs. Model output is untrusted input. Malformed output creates no authoritative object. Each bounded try of a model/agent invocation—including every retry, reformat, and repair request—is its own record. On the execution plane that record is an Execution Attempt bound to its Execution Plan; the Execution Aggregate owns attempts (DOC-002 §3.3). Where no Execution Plan exists—PWA authoring is the current example—the identical recording obligation binds to the plane's own governed-stream record, not to an Execution Attempt. Record the materialized input presented to the model, the returned answer output before schema coercion or repair, the resolved provider/model/version actually invoked, any declared truncation or omission, and the parse/validation/repair outcome, subject to applicable redaction handling recorded as such. A prompt/template fingerprint identifies that record; it never substitutes for it. Volunteered reasoning material in that exchange is governed by the rule above, not by this record; where it arrives inline with the answer, separate it at retention so that only the answer span binds under Section 8.4. Where the spans cannot be separated losslessly, or accepted contracts cannot represent these records losslessly, block the capability and resolve Section 16 item 23.

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

The de minimis assurance floor must preserve enough information to reconstruct:

- versioned policy/profile/applicability and coverage decisions;
- Assessment execution provenance and the exact subject/context/Evidence considered, Validator results, finding-type Observations, and disagreement;

When Section 16 items 24–25 capabilities are adopted, accepted contracts also preserve enough information to reconstruct:

- causal links from Observations to corrective PWUs/Actions/Attempts, semantic diffs, impact closure, invalidation, and revalidation;
- isolated meta-assurance fixtures/results and derived convergence/Validator-health views.

These are information requirements, not permission to add tables, fields, objects, or Events. Use existing DOC-007/009 records and relations only where lossless. If the mandatory floor cannot be reconstructed, block the capability and resolve Section 16 item 23; items 24–25 govern the advanced extensions.

This is a hybrid transactional model with Event history, not event-store-only sourcing. The governed professional stream in Section 5.6 is a logical union over these typed stores, not a monolithic record table. Do not hide core cross-object relationships in one generic JSON document or EAV. Do not hard-delete objects that have participated in execution, assurance, governance, a Baseline, or traceability.

Logical persistence domains separate core work, execution, assurance, governance, Events/outbox, projections, audit, integration, and legacy compatibility. They may initially share one database to preserve transaction boundaries. Commands never validate from projections.

Critical current data rules:

- one active Plan per PWU;
- unique aggregate revision, attempt number, and idempotency key;
- Claims, Assessments, Decisions, and waivers bind exact subject semantic versions;
- Baseline items bind exact semantic version and, where applicable, a content hash; hash applicability and algorithm require an explicit contract rather than inference;
- non-local PWU Types must belong to the Undertaking’s immutable selected PWA version;
- local extensions have no published `pwuTypeId` and never mutate the PWA;
- Artifact/Evidence corrections create successors, not in-place content mutation.

When the accepted slice implements Section 16 items 24–25, also enforce that material Observations trace to the exact assessed subject/policy/criterion and execution provenance; repair never rewrites the original Observation; resolution/revalidation is explicit over the affected closure; and convergence or assurance-health views never authorize Commands.

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
7. resume durable Process/RPH/Assessment/Validator/human-wait state and, where accepted contracts exist, repair/revalidation state and affected convergence projections.

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
| **PWA Design** | recursively author, inspect, validate, version, publish, and define migration contracts for a Professional Work Architecture and its assurance assignments | an untyped form builder or flat sequence editor |
| **Undertaking** | establish purpose, boundaries, Participants, Context, PWA/profile/version, and initial Baseline | a generic project record |
| **Execution** | navigate PWUs, Plans, Steps, dependencies, attempts, outputs, and control actions | an opaque agent chat or task list |
| **Assurance** | inspect required/resolved coverage, Claims/criteria/Evidence, Assessments, actual Validator executions/results, durable finding-type Observations, gate effect, and uncertainty; add repair/revalidation, convergence, and control health when adopted | a pass/fail badge or Validator console |
| **Governance** | make version-bound Decisions, manage waivers, promotion, change, and reconciliation | an informal approval screen |

These contexts share canonical identifiers and deep links. A user can move from a displayed conclusion to its Claim, Evidence, generating Action/Step, governing policy, Validator execution/context, Assurance Observation, Decision, Artifact version, and Baseline membership; adopted repair/revalidation capabilities add their closure links.

The Assurance context always explains applicable versus missing coverage, exact subject/policy/Validator versions and invocations, considered/rejected/unavailable Evidence, actual independence, protected-transition effect, open/resolved/dispositioned finding-type Observations, and residual uncertainty. When Section 16 items 24–25 capabilities are adopted, it also explains intrinsic/derivational/systemic analysis, repair lineage/affected closure, recurrence/oscillation, convergence, and control-system health. It never hides known Observations merely because a later snapshot passed.

Every surface makes the user's level explicit: PWA definition/version versus Undertaking instance versus PWU Type versus PWU Instance. Show the exact PWA/profile/version binding and whether each value is inherited, profiled, locally extended, or instance-owned. Concrete execution and assurance state belongs to instances, not reusable definitions; PWA publication/review remains separately governable.

The PWA Designer's primary structural projection is labeled **PWA Work Architecture View**. It recursively renders PWU Types from the PWA root through named child composition; it is not labeled a Professional Work Graph and layout never implies execution order. For each selected PWU Type it makes inspectable:

- explicit leaf/non-leaf treatment and named permitted, mandatory, conditional, and default child PWU Types—not merely a count;
- child cardinality/applicability, decomposition/default/extension rules, obligation and Constraint allocation, coverage expectations, and recomposition contribution;
- composition, semantic progression, dependency, input/output, iteration, and temporal relationships as distinct typed relations;
- required, conditional, inherited, and locked de minimis Assurance Policies, their triggers/protected boundaries, Evidence/independence requirements, coverage gaps, and eligible/default conforming Validator capabilities.

Recursive navigation provides expand/collapse, parent/child traversal, depth/context orientation, and direct opening of referenced definitions. Progressive disclosure must not make a hidden descendant look like an absent child or a parent look like a leaf. Validators and policies are assurance attachments/overlays, not child PWUs. A configured/eligible Validator is labeled as capability, never as a completed execution.

The Undertaking **Professional Work Graph** separately shows actual child PWU Instances, Decomposition/Recomposition Contracts, instance state, dependencies, outputs, and assurance. Its assurance drill-down shows exact subject/version, resolved policy, Assessment, selected Validator implementation/version and invocation attempts, considered/missing Evidence, actual independence, Observations, disposition/staleness, and the transition blocked or permitted. Every summary supports navigation through:

```text
PWA/PWU Type policy assignment
→ resolved instance/transformation applicability
→ Assessment → actual Validator invocation/result
→ Assurance Service disposition → protected transition
```

An opaque `assurance satisfied` rule, decorative edge, child count, or green badge is nonconformant. One PWU-level badge cannot stand in for assurance of multiple material outputs inside that PWU.

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
4. **Assurance and authority:** Evidence/independence, finding-type Observations, Decisions, waivers, constraints, residual uncertainty, and promotion readiness, plus adopted coverage/repair/convergence state.
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

A PWA version is a governed semantic package, not a mutable collection of screens. Conceptually its versioned contents identify the PWA, compatible platform/contract versions, profiles, ontology modules, root and recursively reachable PWU Types, typed child/dependency/progression/input-output rules, decomposition/recomposition contracts, policies and Validator capability requirements, projections, role/permission mappings, migration definitions, fixtures, and extension points. The exact manifest/schema and bootstrap Commands remain an unresolved contract in Section 16; do not invent them from this conceptual inventory.

An AI-assisted PWA authoring result is incomplete if it stops at a root or linear list of major work areas. Before presenting a candidate as structurally valid, the authoring agent must propose and validate:

1. root PWU Type(s) and recursive child-type composition down to explicitly justified coherent leaves;
2. mandatory, conditional, optional, default, and extension child rules with obligation/Constraint allocation and coverage Claims;
3. separately typed composition, semantic progression, dependency, input/output, and execution relationships;
4. a recomposition rule and parent completion contribution for every non-leaf;
5. required and conditional Assurance Policies, locked inherited de minimis coverage, protected material boundaries, Evidence/independence, and Validator capability requirements at every applicable level; and
6. positive and negative conformance fixtures for publication, instantiation, assurance activation, and recomposition.

The agent marks unresolved professional choices, Assumptions, unavailable capabilities, and coverage gaps instead of manufacturing detail. Its own material outputs remain provisional until required assurance completes. It may propose typed Draft operations but cannot publish, silently mutate a published version, declare its own graph valid, or grant authority. The Designer rejects or visibly marks incomplete a top-level sequence, undeclared implicit leaf, missing applicable child, absent recomposition, generic relationship, uncovered material boundary, or opaque assurance string.

Lifecycle:

```text
DRAFT → UNDER_REVIEW → VALIDATED → PUBLISHED → DEPRECATED → RETIRED
```

- Draft content can change; a published version cannot. Instantiation/use references a `PUBLISHED` version but is not a PWA lifecycle state.
- An Undertaking is pinned to a PWA/profile/version. Upgrading it is an explicit, validated migration with preview, compatibility report, Decision, rollback/recovery plan, and provenance.
- Local additions live in declared extension namespaces. They cannot redefine canonical meanings or bypass mandatory policies.
- Broadly useful local changes are submitted as typed change proposals and do not silently mutate the originating PWA.
- If the candidate JSDL SemVer policy is adopted, breaking semantic changes require a major version and migration, additive compatible changes require at least a minor version, and corrections that do not alter meaning may be patch versions. Until then, follow the ratified PWA versioning contract and record compatibility explicitly.
- Historical Undertakings remain interpretable against the package version under which their Events and Decisions occurred.

A Draft cannot become `VALIDATED` or `PUBLISHED` unless recursive-composition and assurance-assignment validation proves: explicit leaf/non-leaf treatment; coherent decomposition/recomposition; no missing/disallowed/cyclic child rules; the non-removable floor and all applicable policy references/triggers/Evidence/independence/protected transitions; and fixtures demonstrating activation and enforcement. A portable PWA may declare required Validator capabilities without hardwiring a provider, but target installation or Undertaking activation must prove conforming implementations are available. A missing policy assignment blocks PWA validation/publication; a missing target capability blocks target activation/execution. Neither may silently downgrade required assurance.

### 11.7 Comprehensive authoring exemplar: outcome-centered V-model/UCD/JTBD software PWA

This worked exemplar answers the prompt:

> Draft a software engineering SDLC PWA that leverages aspects from V-model systems engineering approach, User-Centered Design and Jobs To Be Done methodologies.

Its formalized Intent is: **define a reusable software Product Realization architecture that combines evidence-backed JTBD discovery, iterative UCD shaping/validation, and V-model definition-to-Evidence discipline without introducing phases or losing canonical RPH boundaries.**

It demonstrates the minimum semantic and visual completeness expected from the PWA-authoring agent and Designer. The seven branches derive from Section 7/DOC-003; the nested method-specific refinements are candidate choices for this illustrative profile and do not replace that authority. Candidate IDs, version, cardinality notation, policy groupings, and statuses below are explanatory notation—not frozen wire contracts. The result remains a conceptual Draft until accepted registries, schemas, bindings, fixtures, and runtime conformance establish it.

#### 11.7.1 Draft identity and method selection

| Property | Exemplar value |
|---|---|
| Name | **Outcome-Centered V-Model Software Product Realization** |
| Candidate identity | `sdlc-vmodel-ucd-jtbd@0.1.2-draft` |
| Derivation | specialization of the canonical Product Realization PWA |
| Domain | Software Engineering |
| Status | `DRAFT`; narrative thought experiment only, not product-assessed, published, or instantiated |
| Provisional assurance profile | Standard, subject to risk/context analysis and human confirmation |
| Root completion Claim | The exact promoted software baseline preserves approved Product Intent, addresses evidence-supported jobs and outcomes, satisfies applicable behavior and requirements, conforms to its architecture, and is fit for its declared purpose within explicitly accepted residual uncertainty. |

Method selection is explicit:

| Method | Selected contribution | Explicit exclusion |
|---|---|---|
| **Jobs To Be Done** | job performers, circumstances, struggling moments, desired progress, forces, alternatives, and outcome measures | jobs are not features, Requirements, user stories, or workflow Tasks |
| **User-Centered Design** | context-of-use research, user Evidence, journey/scenario design, prototyping, formative evaluation, usability/accessibility, and representative-user validation | personas or research findings are not fabricated facts or automatic product obligations |
| **V-model systems engineering** | bidirectional definition-to-Evidence pairing across Intent, behavior, Requirements, architecture, implementation, verification, and validation | not waterfall scheduling, a phase axis, or certification to a specific V-model standard |

The seven canonical branches are siblings beneath Product Realization. The tree below is a **PWA Work Architecture View** of reusable PWU Types—not an Undertaking Professional Work Graph, a collection of PWU Instances, or execution order. Graph position alone does not imply dependency, semantic progression, input/output flow, or timing beyond the explicitly shown type-composition relationship.

#### 11.7.2 Recursive PWA Work Architecture View

Legend:

- `M1`: mandatory exactly one;
- `M+`: mandatory one or more;
- `C1` / `C+`: conditional one / one-or-more when applicable;
- `N`: non-leaf PWU Type;
- `L`: coherent leaf PWU Type at this PWA abstraction.

These are presentation shorthands. Executable rules separately encode minimum/maximum cardinality, applicability predicate, and materialization behavior. Every conditional rule has an explicit applicability resolution. Before its predicate can be evaluated, applicability remains unresolved/pending and omission is not permitted; after resolution, required activation or reasoned inapplicability is durably recorded using the accepted contract vocabulary. Inability to obtain required Evidence does not make a child inapplicable. Every node below is a reusable PWU Type. Concrete studies, features, increments, and implementation slices become PWU Instances only in an Undertaking.

```text
Product Realization [N]
├─ Intent and Product Definition [M1,N]
│  ├─ Intent Discovery [M1,N]
│  │  ├─ Originating Expression and Context Inquiry [M1,L]
│  │  ├─ Stakeholder and Context-of-Use Research [M1,N]
│  │  │  ├─ Research, Consent and Privacy Plan [M1,L]
│  │  │  ├─ Existing Evidence Review [M1,L]
│  │  │  ├─ Primary Research [C+,L]
│  │  │  └─ Context/User Synthesis and Limitation Disclosure [M1,L]
│  │  ├─ JTBD Inquiry [M1,N]
│  │  │  ├─ Job Performer and Circumstance Definition [M1,L]
│  │  │  ├─ Functional Job, Desired Progress and Outcome Discovery [M1,L]
│  │  │  ├─ Struggling Moments, Forces and Current Alternatives [M1,L]
│  │  │  └─ Emotional and Social Job Inquiry [C1,L]
│  │  └─ Ambiguity and Assumption Elicitation [M1,L]
│  ├─ Product Boundary and Domain Definition [M1,N]
│  │  ├─ Boundary and Non-Goals [M1,L]
│  │  ├─ Business/Operational Context and Constraints [M1,L]
│  │  └─ Desired Product Outcomes and Success Conditions [M1,L]
│  ├─ Intent/Outcome Validation Intent Definition [M1,L]
│  └─ Intent Baseline Candidate Assembly [M1,L]
│
├─ Product Behavior Definition [M1,N]
│  ├─ UCD Actor and Capability Synthesis [M1,N]
│  │  ├─ Actor Definition [M1,L]
│  │  └─ Job-to-Outcome-to-Capability Mapping [M1,L]
│  ├─ Journey, Scenario and Interaction Definition [M1,N]
│  │  ├─ Current Job Journey/Job Map [M1,L]
│  │  ├─ Intended Product Experience Journey [M1,L]
│  │  └─ Normal, Alternate, Failure, Permission and Interruption Scenarios [M+,L]
│  ├─ Requirement and Acceptance Model [M1,N]
│  │  ├─ Functional and Interaction Requirements [M+,L]
│  │  ├─ Quality and Cross-Cutting Requirements [M1,N]
│  │  │  ├─ Quality, Performance and Reliability Requirements [M+,L]
│  │  │  ├─ Security and Privacy Requirements [M+,L]
│  │  │  ├─ Accessibility and Usability Requirements [C+,L]
│  │  │  └─ Operational, Deployment and Observability Requirements [C+,L]
│  │  ├─ Interface and Integration Requirements [C+,L]
│  │  ├─ Verification Method and Required-Evidence Definition [M1,L]
│  │  └─ Acceptance Criteria and Bidirectional Trace Closure [M1,L]
│  ├─ Domain Entity and Integration Model [C1,L]
│  └─ Prototype and Formative Evaluation [C+,N]
│     ├─ Prototype Definition [M1,L]
│     ├─ Representative-User Evaluation [M+,L]
│     └─ Findings and Behavior-Revision Proposal [M1,L]
│
├─ Architecture Definition [M1,N]
│  ├─ System Context and Architecture Drivers [M1,N]
│  │  ├─ System Boundary and External Context [M1,L]
│  │  ├─ Quality, Human-System and Risk Drivers [M1,L]
│  │  └─ Existing-System and Historical Constraints [C1,L]
│  ├─ Technical Structure Definition [M1,N]
│  │  ├─ Component and Responsibility Architecture [M1,L]
│  │  ├─ Data Ownership and Lifecycle Architecture [M1,L]
│  │  ├─ Security and Privacy Architecture [M1,L]
│  │  └─ Integration and Interface Architecture [C+,L]
│  ├─ Deployment and Operational Architecture [C1,N]
│  │  ├─ Deployment Topology [M1,L]
│  │  ├─ Observability Architecture [M1,L]
│  │  └─ Resilience, Recovery and Continuity Architecture [M1,L]
│  ├─ Architecture Verification and Validation Design [M1,N]
│  │  ├─ Component Verification Design [M1,L]
│  │  ├─ Architecture/Interface Conformance Design [M1,L]
│  │  ├─ Testability, Environment and Evidence Design [M1,L]
│  │  └─ Architecture-to-Verification Trace Closure [M1,L]
│  └─ Architecture Decision and Baseline Candidate Assembly [M1,N]
│     ├─ Material Architecture Decision Analysis [M+,L]
│     └─ Architecture Baseline Candidate Assembly [M1,L]
│
├─ Implementation Planning [M1,N]
│  ├─ Product Increment Definition [M+,N]
│  │  ├─ Vertical-Slice Objective and Scope [M1,L]
│  │  └─ Intent/Behavior/Architecture/V-Pair Allocation [M1,L]
│  ├─ Work Decomposition [M1,N]
│  │  ├─ Implementation PWU Shaping and Obligation Allocation [M+,L]
│  │  └─ Dependency and Recomposition Contract [M1,L]
│  ├─ Feasibility, Repository, Risk and Assumption Analysis [M1,N]
│  │  ├─ Repository/Existing-System Impact [C1,L]
│  │  ├─ Dependency and Capability Analysis [M1,L]
│  │  └─ Risk and Assumption Analysis [M1,L]
│  ├─ Verification, Validation and Evidence Plan [M1,N]
│  │  ├─ Component/Unit Verification Plan [M1,L]
│  │  ├─ Integration/System Verification Plan [M1,L]
│  │  ├─ UCD/Journey/JTBD Validation Plan [M1,L]
│  │  └─ Specialist Validation Planning [C+,N]
│  │     ├─ Security Validation Plan [C1,L]
│  │     ├─ Operational/Resilience Validation Plan [C1,L]
│  │     └─ Migration Validation Plan [C1,L]
│  └─ Execution, Migration and Rollback Strategy [M1,N]
│     ├─ Execution Plan Definition [M1,L]
│     ├─ Migration Strategy [C1,L]
│     └─ Rollback and Recovery Strategy [C1,L]
│
├─ Product Implementation [M1,N]
│  └─ Product Increment Implementation [M+,N]
│     ├─ Implementation Contract Refinement [M1,L]
│     ├─ Product Slice Implementation [M+,N]
│     │  ├─ UI and Interaction Implementation [C+,L]
│     │  ├─ Service/API Implementation [C+,L]
│     │  ├─ Data/Schema Implementation [C+,L]
│     │  ├─ Integration Adapter Implementation [C+,L]
│     │  ├─ Security/Privacy Control Implementation [C+,L]
│     │  ├─ Verification Artifact Implementation [M1,N]
│     │  │  ├─ Automated Test Implementation [C+,L]
│     │  │  ├─ Fixture, Simulation or Test-Data Implementation [C+,L]
│     │  │  └─ Manual/Inspection Procedure Implementation [C+,L]
│     │  ├─ Migration Implementation [C+,L]
│     │  ├─ Documentation Implementation [C+,L]
│     │  └─ Configuration/Deployment Implementation [C+,L]
│     ├─ Local Component and Contract Verification [M1,L]
│     ├─ Formative User Evaluation [C+,L]
│     └─ Increment Integration and Evidence Capture [M1,L]
│
├─ Integrated Product Validation [M1,N]
│  ├─ Component Verification [M+,L]
│  ├─ Architecture and Interface Verification [M1,N]
│  │  ├─ Architecture Conformance [M1,L]
│  │  └─ Interface and Integration Verification [C+,L]
│  ├─ Product/System Verification [M1,N]
│  │  ├─ Requirement Verification [M1,L]
│  │  ├─ Regression Validation [M1,L]
│  │  ├─ Security Validation [C1,L]
│  │  ├─ Operational/Resilience Validation [C1,L]
│  │  └─ Migration/Rollback Validation [C1,L]
│  ├─ User, Job and Purpose Validation [M1,N]
│  │  ├─ Journey and Scenario Validation [M1,L]
│  │  ├─ Usability and Accessibility Validation [C1,L]
│  │  └─ JTBD Outcome and Fitness-for-Purpose Validation [M1,L]
│  └─ Evidence and Residual-Uncertainty Package [M1,N]
│     ├─ Evidence/Assessment Completeness Synthesis [M1,L]
│     └─ Findings, Limitations and Residual-Uncertainty Synthesis [M1,L]
│
└─ Product Baseline Promotion [M1,N]
   ├─ Exact Candidate Manifest Assembly [M1,L]
   ├─ Promotion Evidence Package Assembly [M1,N]
   │  ├─ Evidence and Assessment Manifest Preparation [M1,L]
   │  ├─ Version and Trace Manifest Preparation [M1,L]
   │  └─ Finding, Waiver and Residual-Risk Package Preparation [M1,L]
   ├─ Promotion Recommendation and Decision-Package Assembly [M1,L]
   └─ Post-Promotion Observation/Handoff Plan [M1,L]
```

The exact Governance Decision and the accepted `CreateBaseline`/`PromoteBaseline` Command flow it may authorize are outside PWU composition; aggregate/domain guards, not the Decision record itself, effect the state change. Promotion package preparation is professional work; Assurance Policies, Assessments, Validators, and authority are not child PWUs. The authoring agent, Validator, or graph cannot grant authority. A rejected Decision records rejection and may lead to governed reshaping, successor work, or abandonment; it never satisfies the root Claim.

Default-instantiation and generation behavior is explicit rather than inferred from `M1`/`M+`:

- the seven root children and their declared default shaping children materialize when a full-delivery Undertaking is instantiated;
- repeatable research, increment, slice, verification, and validation Instances are generated from exact approved allocation/applicability sets, carry stable instance keys, and close cardinality against those sets rather than an unbounded “plus”;
- implementation children activate from the approved Plan's obligation allocation; they are not concrete feature Instances embedded in the PWA;
- `Verification Artifact Implementation` must activate at least one coherent method child required by the approved verification strategy; it does not fabricate an automated-test PWU for a non-code output;
- every conditional rule identifies predicate, evaluation subject/version, resolver/authority, activation point, materialization behavior, and durable rationale. Later activation creates the child and reassesses affected parents.

Primary-research unavailability leaves the affected empirical Claim provisional and blocks dependent fitness/promotion transitions; it does not automatically block unrelated exploratory work. Research Evidence preserves consent, privacy/redaction, provenance, representativeness, limitations, and admissibility. Composition is acyclic; iterative UCD/V-model feedback uses typed impact, invalidation, revision, and successor relations rather than child cycles or in-place mutation of satisfied/baselined work.

#### 11.7.3 Contract behind each node and recomposition

Every non-leaf inspector exposes exact child-type identities, stable instance-key and default-generation rules, min/max cardinalities, applicability and materialization, typed sibling dependencies and coordination, typed inputs/outputs, allocated/retained Obligations, inherited Constraints/Assumptions/policies, decomposition Claim, coverage state, recomposition rule, and protected transition. Every leaf exposes a bounded objective, explicit justification for stopping decomposition at this abstraction, inputs/outputs, completion Claim/criteria, required Evidence, assurance/independence, and escalation. An activity without that professional boundary remains an Execution Step/Attempt.

| Parent | Recomposition requirement |
|---|---|
| Intent and Product Definition | Evidence-supported jobs, outcomes, context, boundary, Constraints, non-goals, success conditions, Assumptions, and ambiguity form one Intent candidate; human authority is required for approval. |
| Product Behavior Definition | `job/outcome → capability → Journey/Scenario → Requirement → acceptance` coverage is complete without treating the concepts as equivalent. |
| Architecture Definition | Requirements/Constraints are allocated, structure/interfaces are coherent, material Decisions/risks are explicit, and every applicable concern has a verification counterpart. |
| Implementation Planning | Every increment obligation is allocated to bounded work; dependencies, Constraints, assurance, recomposition, and responsible Evidence sources are complete. |
| Product Implementation | Activated slice obligations integrate into one exact candidate with tests/provenance and disclosed deviations/Assumptions. |
| Integrated Product Validation | The exact candidate closes every applicable verification/validation pairing with admissible Evidence and supports product-level fitness Claims—not merely passing tests. |
| Product Baseline Promotion | The exact reviewed manifest has complete current Assessments, valid finding/waiver/risk disposition, and a Decision package for valid Governance authority. |
| Product Realization root | Applicable child obligations and assurance are complete, integrated validation supports the root Claim, and an exact Governance Decision authorizes the guarded Command flow that materializes the assured candidate as a Baseline. |

For every parent, recomposition permits satisfaction only when every required activated child has a current assured result that may contribute, any omitted/waived/superseded obligation has a valid policy-permitted exact-scope disposition, the exact recomposed output and parent Claim have sufficient Evidence, sibling outputs are mutually compatible, and no blocking Assessment remains. `CONDITIONALLY_SATISFIED` does not contribute to recomposition or promotion, and no non-waivable control can be bypassed. “All children completed” never proves recomposition.

V-model correspondence is a separately typed, exact-version assurance/trace overlay—not composition or order:

| Definition-side subject | Corresponding inquiry |
|---|---|
| Product Intent, JTBD outcomes, circumstances, success conditions | representative-user/job validation and Fitness for Purpose |
| Actors, capabilities, Journeys, Scenarios, acceptance criteria | Journey, Scenario, usability, and accessibility validation |
| Functional and quality Requirements | system and Requirement verification using the method declared when authored |
| Components, data, interfaces, security, operational architecture | component, integration, and architecture-conformance verification |
| Implementation-detail obligations | static, unit, component, and contract verification |

Each pairing binds subject/version, Claim, method, required Evidence, resulting Assessment, and affected consumers. A failed right-side inquiry computes impact and reopens or supersedes affected upstream work. Until accepted relationship codes exist, the Designer labels these edges conceptual and never persists invented wire codes.

The professional verification/validation PWUs above perform inquiry and produce version-bound results and Evidence for product-level Claims. `Local Component and Contract Verification` supplies formative, implementation-scope Evidence; Integrated Product Validation's `Component Verification` separately checks its freshness, coverage, exact integrated subject, and any required rerun or augmentation with the independence demanded by policy. A local pass never auto-satisfies the integrated PWU. Assurance Assessments then separately determine whether Evidence supports a governed Claim under an applicable policy at a protected boundary. A passing test, successful usability session, or professional validation conclusion is therefore neither its own Assurance Assessment nor authority to promote.

Semantic guardrails:

```text
job executor ≠ persona ≠ Actor
job / desired progress ≠ Journey
job step ≠ product-interaction step
desired outcome ≠ Requirement
research observation ≠ admitted Evidence ≠ approved fact
prototype ≠ Requirement ≠ Architecture ≠ Baseline
verification ≠ validation ≠ acceptance
```

A required derivation trace is:

```text
evidence-supported job hypothesis
→ desired outcome → capability → Journey/Scenario
→ Requirement → acceptance criterion + verification/validation method
→ implementation allocation → verification Evidence
→ job-progress / fitness Evidence
```

Leading usability signals remain distinct from actual job-progress/outcome Evidence.

#### 11.7.4 Assurance Engineering is the visible control fabric

No single node represents Assurance Engineering. Integrated Product Validation performs product-level professional validation, but the Assurance Engineering subsystem is orthogonal to every node, transformation, relationship, and protected transition:

| Scale | Concern |
|---|---|
| **Local Transformation Assurance (“micro”)** | each material human, AI/agent, tool, import, or recomposition transformation and every independently downstream-consumable result |
| **PWU/compositional assurance** | Claims/Evidence, child obligation and Constraint coverage, dependency coherence, and recomposition |
| **Undertaking/product assurance (“macro”)** | cross-PWU coherence, integrated verification/validation, Intent preservation, fitness, residual uncertainty, and Baseline eligibility |
| **Meta-assurance** | policy/Validator fidelity, Evidence access, independence/common mode, calibration, canaries, escaped defects, and control health |

A PWU may contain many material calls. One PWU-level review cannot substitute for exact per-output Assessments:

```text
PWU Instance
  ├─ Agent Attempt A → Candidate A → Reasoning Review A → admit/block
  ├─ Agent Attempt B → Candidate B → Reasoning Review B → admit/block
  └─ Agent Attempt C → Candidate C → Reasoning Review C → admit/block
```

The PWA Work Architecture View keeps an **assurance rail** visible on every PWU Type even when collapsed:

```text
┌────────────────────────────────────────────┐
│ Product Behavior Definition [non-leaf]      │
│ 5 named child rules · 0 unresolved gaps     │
├────────────────────────────────────────────┤
│ ASSURANCE RAIL                              │
│ 🔒 de minimis floor · non-removable         │
│    contract/invariant checks                │
│    identity/provenance/trace                │
│    Reasoning Review for material AI output  │
│ +  Requirement Coverage                     │
│ +  Intent Preservation                      │
│ +  UCD/JTBD coverage                        │
└────────────────────────────────────────────┘
```

The collapsed node always shows the locked floor, policy/capability counts, and coverage-gap/blocking status. Selection reveals policies, triggers, Claims/Evidence, independence, protected boundaries, and eligible Validator capabilities. Invocation drill-down reveals actual execution. An assurance-wide overlay shows coverage across the PWA/Undertaking. Assurance cannot live only in a modal, log, inspector, or generic green badge.

The implementation preserves three distinct assurance rails:

1. **Definition time:** the PWA declares the applicable Assurance Policy/version, trigger/materiality rule, subject and Claim, required Evidence, independence, protected boundary/transition, and required Validator capability contract. This is required treatment, not execution.
2. **Deployment time:** an installation binds eligible/default conforming Validator implementations to declared capability requirements and proves compatibility, availability, authorization, and required independence can be supplied. This proves deployability, not that any Assessment ran or passed, and it does not imply a new canonical capability object.
3. **Runtime:** the system creates the exact version-bound Assessment, selects and records the Validator/capability/version/invocation actually used, admits Evidence and Observations, verifies actual independence, records the Assurance Service disposition, and re-evaluates the protected transition through a server-side gate. Only this rail can establish current assurance satisfaction.

PWA Design distinguishes:

1. **Prospective treatment:** future instances of this PWU Type require identified policies and Validator capabilities.
2. **Authoring assurance:** this exact AI-authored type definition/draft was itself assessed by identified Validator invocations.

The following is an illustrative target projection, not a claim that this thought experiment produced a persisted Assessment:

```text
Required in future Undertakings
  Reasoning Review — LOCKED
  Requirement Coverage — REQUIRED

Current PWA-authoring Draft after actual runtime assessment
  subject: behavior-definition-type@draft-revision-7
  Reasoning Review — satisfied only by persisted Assessment
  Validator/version/invocation: exact runtime identities
  findings: exact Observations and dispositions
```

A policy assignment proves required treatment; a configured capability proves availability; neither proves execution. Runtime state never contaminates the reusable PWA definition.

#### 11.7.5 Micro-assurance and Reasoning Review

Every material professional transformation has a persisted, inspectable coverage resolution. Every generative or interpretive LLM/agent result is material by default, including summaries/context supplied to another agent. The producer cannot self-exempt; ambiguity resolves to material; only a versioned rule proving lossless semantic equivalence permits nonmaterial classification. A timeout/no-output Attempt remains recorded but has no candidate output to review.

Every material AI/agent output additionally receives the locked, non-waivable Reasoning Review floor. Reasoning Review asks whether the result genuinely discharges its delegated professional obligation or merely produces a plausible substitute that conceals the underlying problem. Candidate failure classes—not yet wire codes—include:

- problem substitution or obligation elision;
- unjustified scope reduction;
- proxy satisfaction and surface repair;
- premature closure/convergence;
- unsupported Assumptions, circular support, invalid inference, or false equivalence;
- contradiction with Intent, Constraints, inputs, or Evidence;
- omitted inconvenient Evidence or hidden uncertainty;
- declaring completeness from output existence or activity.

The review binds exact input/context/output versions, producing Attempt, policy/criteria, producer/evaluator lineage, Claims, admitted/rejected/missing Evidence, tool results where authorized, limitations, uncertainty, and protected consumer. It reviews observable professional rationale and provenance—not private chain-of-thought. A distinct invocation/role is the minimum; stronger profiles add model/provider/human/organizational independence.

Type-level assurance overlay:

| Scope | Required treatment | Eligible capability examples | Protected transition |
|---|---|---|---|
| Every node/material output | contract/invariant, identity/version/provenance/context/trace; Reasoning Review for AI output | schema/invariant, provenance, Reasoning Review | canonical admission or dependent consumption |
| Intent/JTBD | Intent Fidelity, Intent Completeness, Assumption Disclosure; registered JTBD/research coverage | trace plus independent JTBD/UCD/human review | Behavior shaping or Intent approval |
| Behavior/UCD | Requirement Coverage, Intent Preservation, Assumption Disclosure; registered research/Journey/requirement/accessibility coverage | trace/coverage, requirement quality, UCD/human evaluation | Architecture or Planning |
| Architecture | Architecture Coverage, Constraint Propagation, Historical Consistency, Intent Preservation, Assumption Disclosure | architecture/trace/security/operability plus independent architect | architecture candidacy or Planning |
| Planning | Decomposition Coverage, Constraint Propagation, Test Adequacy, Assumption Disclosure, Intent Preservation | graph/dependency/recomposition/test/migration/rollback | implementation execution |
| Implementation | Intent Preservation, Requirement Coverage, Test Adequacy, Assumption Disclosure, Constraint Propagation; registered scope/conformance policies | static/test/trace/scope/architecture/security/migration | integration or Integrated Validation |
| Integrated Validation | Requirement Coverage, Test Adequacy, Fitness for Purpose, Intent Preservation | independent verifier, test/Evidence, representative-user, specialist/human | promotion review |
| Promotion | Baseline Promotion plus exact-version/Evidence/open-finding/authority controls | manifest/trace/Assessment/authority | Governance Decision/Baseline |

Specialized policies must be registered/versioned; they cannot exist only as hidden prompts. Design time shows assignments and capability requirements. Runtime shows actual Validator identity/version/invocation, Evidence, independence, result, Observations, Assessment freshness/disposition, and gate effect.

#### 11.7.6 Durable barrier, freshness, and finite meta-assurance

```text
persist exact candidate output + provenance
→ persist materiality/applicability resolutions
→ run deterministic contract/invariant checks
→ create or resume required Assessments
→ bind, schedule, and invoke conforming Validators
→ verify actual independence
→ validate/persist results, failures, and Observations
→ Assurance Service records dispositions
→ revalidate exact protected transition
```

Missing, pending, stale, invalidated, malformed, failed, unavailable, independence-invalid, or otherwise non-permitting assurance blocks the dependent transition without proving the subject wrong. Restart resumes the barrier; idempotency prevents duplicate semantic effects. An Assessment becomes stale or superseded when its subject, producing Attempt, material input/context, Evidence, policy/criteria, Validator binding, or independence requirement changes; impact propagates to consumers.

Governance cannot waive a non-waivable control, retroactively treat an absent review as passed, or fabricate satisfaction. It may reject/abandon work or waive only policy-declared waivable obligations through an exact version-bound Decision.

Assurance must terminate without infinite “review of the review” recursion:

- material AI/agent **subject-plane** output requires Reasoning Review;
- Validator/Assessment results are **assurance-plane** outputs and always receive strict result-schema, identity, policy/version, provenance, subject/context/Evidence-binding, independence, and disposition validation plus risk-derived meta-assurance;
- the control topology is finite and acyclic; no Validator reviews its own Attempt/result;
- every assurance path terminates in a declared deterministic control, independently adjudicated human/organizational control, or explicit failure/escalation;
- AI meta-review may occur only within that finite topology; decisive high-impact assurance uses an independent portfolio or human adjudication when policy requires.

If accepted contracts cannot represent required meta-assurance losslessly, publication/activation remains blocked under Section 16 item 25.

Illustrative failure/recovery:

```text
authoring agent produces Acceptance Model v7
→ schema and trace checks pass
→ Reasoning Review Validator times out
→ Assessment records Validator failure; v7 remains provisional
→ Architecture agent cannot consume v7
→ restart resumes the Assessment
→ alternate conforming Validator reviews exact v7
→ Assurance Service records the new disposition
→ protected consumer transition is re-evaluated
```

No retry, displayed badge, client state, or successful unrelated check infers satisfaction.

#### 11.7.7 Authoring assurance and publication proof

The authoring agent displays its own correction history rather than silently replacing drafts. A representative review loop is:

1. `0.1.0-draft` exposes shallow/universal-coverage, durable-enforcement, or method-integration gaps.
2. `0.1.1-draft` corrects them but exposes a potential infinite assurance-recursion flaw.
3. `0.1.2-draft` adds finite assurance stratification and may be judged satisfactory **for narrative Draft purpose only** by a separate thought-experiment reviewer.

That narrative finding is not a canonical Assurance Assessment or publication authority: no actual product Validator invocation, persisted Assessment, or server-side gate is claimed here. Provider/model independence and actual product persistence/enforcement must be proven independently.

Minimum publication/conformance proof includes:

- accepted identities and versions for PWU Types, Assurance Policies, Validator implementations/bindings, and relationships;
- executable recursive child/decomposition/recomposition contracts;
- an isolated, non-authoritative preview/conformance-instantiation fixture with at least three recursive type/instance levels, two planned increment/slice Instances, and exact definition-to-verification/validation pairings;
- fixtures that activate human-facing, integration, and migration concerns, plus a genuinely low-scope case whose conditional omissions have durable, version-bound inapplicability rationales;
- visible authoring-agent Attempts and exact Reasoning Review Assessments;
- negative fixtures for flat graphs, implicit leaves, false inapplicability, unresolved applicability treated as omission, missing assignments, capability-visible-without-invocation, absent/failed review, review made stale by revision, self-review, cyclic meta-assurance, relationship conflation, restart recovery, and a rejected or bypassed promotion that must not satisfy the root;
- deployed Validator availability/independence, Assessment persistence, recovery, invalidation, and server-side transition guards.

Only a `PUBLISHED` PWA version may bind a production Undertaking. Section 11.7 is therefore the human-readable fixture specification, not the fixture itself; a separate versioned machine-readable golden fixture must provide explicit fixture-only identities, PWA/version bindings, expected Commands/Events/projections, and test oracles before publication. The UI may progressively disclose this information; the underlying work and assurance topology may not be omitted.

### 11.8 UX conformance

Required behaviors include keyboard access, visible focus, semantic markup, non-color-only status, readable provenance, timezone/locale clarity, and usable dense information at multiple viewport sizes. Loading, empty, partial, stale, denied, conflict, validation, and recovery states are first-class designs.

Treat Section 11.7 as the minimum fixture specification for recursive and assurance rendering; execute UI tests against its separate machine-readable fixture and accepted contracts. Include recursive PWA type navigation, type-versus-instance separation, relationship-type discrimination, assurance assignment-to-execution drill-down, role/redaction, stale-revision conflict, projection lag, provisional AI proposal versus approved fact, Evidence drill-down, unavailable/failed Validator blocking, waiver expiry, Baseline promotion, failed/retried external execution, restart recovery, migration preview, keyboard navigation, and accessibility.

Avoid chat-only operation, universal dashboards, giant undifferentiated graphs, phase wizards, unexplained scores, hidden provenance, unversioned approvals, and screens that merge execution completion with assurance satisfaction.

---

## 12. Shape Engineering, JSDL, and JEM

This section preserves a valuable target direction from the Constitution Discussion while keeping its status explicit: **Shape Engineering the discipline is operative (Sections 4.2–4.3, and the Shape-integrity state axis in Section 6.4); what is candidate — not yet ratified authority over the numbered RPH corpus or current repository architecture — is the specific staged formalization in this section together with the JSDL v0.1, JEM v0.1, and JSRP encodings.** Implement the candidate formalization and encodings only through an accepted Decision/ADR and a compatibility plan.

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

Assurance is not deferred to stages 10 and 14. Observation discovers failure dynamics; Outcome/cognition/representation modeling defines Claims and Evidence; risk/invariant work defines hard boundaries; PWU/RPH design places control and feedback points; integration design establishes trust and diagnostic scope; validation tests the complete topology; operation supplies outcomes and control-health Evidence. Shape Engineering makes known failure modes and assurance needs part of the work's shape; Assurance Engineering translates them into and operates the versioned control treatment permitted by current contracts.

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
- Redact before logging, persisting, or sending context to external models. Keep prompt/input/output content under explicit retention and access policy.
- Minimize retained sensitive data. Minimization never excuses the absence of a record required by Sections 5.6, 8.4, 9.7, or 10.1.
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
- Terminate and clean up idempotently; retain only policy-approved provenance, logs, outputs, and failure Evidence. Retention limits never excuse the absence of the Execution Attempt record required by Section 9.7.

An external call uses the attempt/reconciliation protocol in Section 9. A timeout is uncertainty, not proof of failure. A successful process exit is an execution fact and potential evidence, not automatically admitted canonical Evidence or professional completion.

### 13.5 One codebase, three editions

| Edition | Intended boundary |
|---|---|
| **Community** | AGPL, single-tenant, self-hosted, BYOK; core RPH/JPWB/delivery, self-hosted VCS, sandboxed execution, base audit and encryption |
| **Enterprise** | commercial self-hosted; adds SSO/full SCIM, private or air-gapped models, compliance-Evidence automation, and multi-tenant credential isolation |
| **Cloud** | managed multi-tenant service; adds hosted operations, metered billing, and cross-tenant fairness to Enterprise capabilities |

Maintain one codebase and shared contracts. Enterprise-only implementation belongs behind the governed open-core boundary (currently `ee/`) plus build-time inclusion and runtime entitlement checks. Do not fork the semantic model, schema package, migrations, or client code by edition. A missing license disables an entitled capability explicitly; it must not corrupt or reinterpret existing professional state.

Customer-specific behavior is a PWA, profile, policy/configuration, or declared extension—not an edition fork. Mobile or other clients consume the same APIs and semantics; they are not alternate authorities. Editions differ in entitled capability, never in professional semantics or in what a profile means. Where an install cannot supply a required independence or separation capability, the protected transitions requiring it block rather than downgrade. No edition, entitlement, or deployment topology relaxes an invariant.

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
| mandatory assurance floor | material-boundary classification, policy activation, Validator conformance/execution, independence, Assessment persistence, protected-transition enforcement, and restart/bypass failure modes |
| adopted repair/meta-assurance extensions | Observation repair/revalidation closure, convergence, canaries, and escaped defects where the slice has accepted contracts |
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
| **P9** | Every published instantiable PWU Type is reachable from a root/extension point and explicitly a coherent leaf or a non-leaf with acyclic child, decomposition, recomposition, and assurance rules. |
| **P10** | Instantiation recursively creates every applicable mandatory/default child PWU Instance and no disallowed, orphaned, cross-Undertaking, or wrongly versioned child. |
| **P11** | Composition permission, semantic progression, dependency, instance decomposition, input/output compatibility, and temporal execution remain distinct in every projection and layout. |
| **P12** | Every material AI/agent transformation receives Reasoning Review and all other applicable coverage before dependent consumption or a protected transition; exact policy assignment, Validator eligibility, actual invocation, Assessment disposition, and Governance Decision remain distinct and traceable. |

Also generate arbitrary acyclic PWU hierarchies/graphs, obligation/constraint distributions, partial Evidence sets, concurrent expected revisions, duplicate delivery, Event replays, projection interruption, expired waivers, failed external attempts, incompatible schema versions, and cross-tenant identifiers.

P9–P12 are mandatory for every slice that authors/instantiates PWAs or executes material agent transformations; a missing lossless wire contract keeps that capability disabled or nonconformant rather than weakening the property. Additional repair, convergence, and meta-assurance properties become mandatory when Section 16 items 24–25 are ratified or a slice adopts equivalent accepted contracts: no material finding-type Observation disappears across regeneration or repair; repair of version `n` cannot reuse its satisfied Assessment for `n+1`; revalidation covers the complete declared impact closure; a required-independent Validator portfolio with common execution provenance fails independence; convergence/gate readiness never grants authority; and absent required diagnostics prevents a trajectory-integrity Claim.

### 14.3 Minimum conformance scenarios

The current numbered corpus's accepted conformance core—principally DOC-008, supplemented by DOC-009's persistence, recovery, and cutover behavior—covers Intent through Architecture Baseline and explicitly defers distributed execution, SaaS isolation, arbitrary ontology and marketplace policy systems, numerical confidence, full release/deployment Baselines, and production deployment. It includes at least:

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

Any slice claiming PWA Designer, PWA-authoring-agent, PWA instantiation, or governed model-transformation support additionally proves:

- a recursively navigable architecture of at least three PWU Type levels, including a valid justified leaf, whose applicable mandatory/default children instantiate and recompose correctly;
- rejection of a top-level linear chain presented as complete composition, an implicit leaf, an opaque child count, a non-leaf without recomposition, a cycle, a missing/disallowed/applicability-invalid child, and a generic edge that conflates composition with progression/dependency/execution;
- an authoring-agent result remains Draft when recursive structure, assurance assignments, protected boundaries, or conformance fixtures are unresolved, and PWA validation/publication rejects the specific gaps;
- every material AI/agent output activates Reasoning Review even when a local PWA/profile omits it; the producer cannot self-exempt or self-review, ambiguity defaults to material, and review for version/Attempt `n/a` cannot satisfy `n+1/b`;
- a material result cannot feed dependent context or another protected transition before its de minimis and additional applicable Assessments permit it;
- missing context/Evidence, Validator unavailability/timeout/malformed output/failure, staleness, and independence violation fail closed without fabricating subject rejection or satisfaction; restart/replay resumes the barrier, and regeneration preserves prior Observations while requiring a new Assessment;
- the PWA Work Architecture View shows policy and Validator capability assignments without runtime pass state, while the Professional Work Graph/Assurance context exposes actual Validator identity/version/invocation, Evidence, Assessment, Observations, disposition, and gate effect; and
- conformance requires no private chain-of-thought—Reasoning Review reaches a valid Assessment with all volunteered reasoning material withheld, no retained reasoning Artifact appears in a Validator's context or a log, and the scenario exercises the real Validator, since a stub that ignores the input passes this trivially—and proves that UI, agent, worker, retry, direct-persistence, and projection paths cannot bypass server-side assurance enforcement.

Additional repair, convergence, and meta-assurance scenarios apply after Section 16 items 24–25 are ratified or a slice explicitly adopts equivalent accepted contracts:

- intrinsic success with invalid derivation, and locally valid work that fails systemic coherence;
- a repair that resolves its triggering finding-type Observation but invalidates another Assessment or introduces a new blocking Observation;
- `A → B → A` finding/remediation oscillation, repeated non-progress, budget exhaustion, and required tactic change/escalation;
- semantic changes with incomplete impact/revalidation closure remaining ineligible to advance;
- correlated “independent” Validators, preserved disagreement, Validator failure, and no fallback satisfaction when required independence is unavailable;
- deterministic corruption canaries for identity, traceability, criteria, stale dependency, injection, and proxy-gaming defects, with missed canaries retained as engineering Evidence pending a meta-assurance subject contract;
- a valid final Artifact reached through a prohibited authoritative transition remaining ineligible for trajectory-integrity or Baseline claims.

The broader platform adds proportional tests when those deferred capabilities enter scope: application-plus-RLS cross-tenant denial, redaction and inference leakage, audit-chain verification, secret non-disclosure, PWA version pinning and migration, edition entitlement, sandbox isolation, distributed recovery, deployment behavior, and resource fairness.

Each behavioral test asserts result/error, aggregate revision and semantic version, emitted Event type/payload/order, trace links, outbox/projection effects, and absence of prohibited side effects where applicable—not final state alone. Each defect in a semantic or boundary contract receives a deterministic regression test when feasible. Fixtures contain stable IDs/times/seeds and explicit expected Events, state, errors, projection outputs, and audit records. Keep positive and negative fixtures beside the versioned schema they prove.

For an adopted Assurance Engineering slice, evaluate behavior with adjudicated consequential-defect interception/escape, derivation fidelity, recurrence, Validator precision/recall, remediation effectiveness and regression, convergence cycles, escalation appropriateness, actual independence/diversity, false-assurance incidents, and control latency/compute/reviewer burden. These measures diagnose the system; never average them into professional truth.

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

For model/agent calls, record allowed and resolved provider/model/version, prompt/template/tool versions or fingerprints, relevant policy, token/time/cost metrics, response schema status, safety/redaction outcome, and resulting proposal/Artifact IDs. In logs and traces a fingerprint identifies the Attempt record Section 9.7 requires. For assurance cycles supported by accepted contracts, correlate subject/input/output versions, policies/criteria, considered/rejected/missing Evidence, actual independence, finding codes/Observation IDs, control response, repair diff, invalidated dependencies, revalidation closure, and resulting unresolved Observations; add recurrence fingerprints only after Section 16 item 24 is decided. Do not log secrets, unrestricted professional content, or private chain-of-thought.

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
recursive type/instance composition, leaf treatment, and decomposition/recomposition when PWA/PWU structure is affected
material transformation boundaries, mandatory de minimis floor, additional applicable coverage, protected transitions, and failure modes
required Evidence/independence and existing finding-type Observations, repairs, or invalidated Assessments
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
→ accepted assurance policy/coverage, failure modes, Evidence, and independence
→ Command and authorization
→ domain transition
→ Event and audit
→ finding-type Observations and, where contracted, corrective work/impact/revalidation
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
- Treat each material AI/agent output as provisional until its durable Reasoning Review and other applicable Assessments permit dependent consumption. Neither the producer nor a local profile may suppress the floor.
- Do not represent assurance with a Boolean, completion-rule string, child count, decorative edge, or client-only badge. Implement type-level policy assignment, deployment capability binding, instance Assessment and actual Validator execution, durable scheduling/recovery, server-side transition guard, inspectable projection, and negative tests together.
- For PWA Designer or authoring-agent work, implement recursive named child-type composition, explicit leaf treatment, typed relationship separation, decomposition/recomposition, assurance assignments, and publication rejection as one coherent vertical slice; a flat top-level graph is not a partial success described as complete.
- Preserve every material finding-type Observation against its exact subject version; never delete it or edit around the policy. Where an accepted repair/revalidation contract applies, repair creates governed successor work and closes its required impact set.
- When changing a Validator, policy, rubric, Evidence pipeline, or an adopted assurance planner, test the control itself with negative fixtures/canaries and inspect common-mode independence and downstream revalidation impact; keep meta-assurance output as engineering Evidence until a subject contract exists.
- Add typed errors, structured telemetry, redaction, and recovery behavior with the feature—not afterward.
- Create forward-safe migrations and upcasters before readers/writers depend on the new representation.
- Update schemas, fixtures, tests, docs, and compatibility projections in the same coherent change.

### 15.4 Verify in increasing scope

Run the cheapest relevant proof first, then broaden:

1. format, lint, type, schema, and deterministic-generation checks;
2. focused domain, transition, invariant, authorization, and regression tests;
3. property, contract, persistence, replay, RLS, and projection tests;
4. the mandatory assurance floor and all applicable contracted coverage, including protected-transition failure/recovery; add Observation repair/revalidation and convergence/meta-assurance checks where adopted and affected;
5. integration and end-to-end conformance for changed boundaries;
6. migration/rollback or recovery rehearsal when state changes;
7. repository-wide gates affected by the change.

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
- the mandatory floor and all additional applicable contracted assurance coverage are explicit; material finding-type Observations are accounted for; adopted repair/revalidation obligations close without hidden recurrence or regression;
- every material AI/agent transformation has durable de minimis Reasoning Review plus additional applicable controls before dependent consumption, including restart, retry, failure, staleness, and bypass cases;
- PWA Designer/authoring-agent changes prove recursive type composition, explicit leaves, typed relationship separation, recursive instance creation, recomposition, assurance assignment/capability visibility, actual-execution drill-down, and positive/negative publication fixtures;
- PWA definition-time policy requirements, deployment-time Validator capability, instance-time Assessment/execution, and Governance authority remain distinct and inspectably linked;
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
| 9 | **PWA/PWU Type/Undertaking bootstrap.** The initial contract begins with `CaptureIntent` against an existing Undertaking but defines no create/publish/instantiate/migrate Commands. DOC-010 demonstrates UX without freezing those wire shapes. | Bootstrap only through an accepted seed/fixture or existing API behind an explicit adapter. Preserve roots, recursively reachable PWU Types, named child rules, explicit leaves, decomposition/recomposition, assurance assignments, and instantiation expectations; never reduce a PWA to a flat node list. No generic CRUD into canonical tables. The exact wire shape is unresolved—not the recursive composition requirement. Keep published versions immutable and Undertakings pinned until governed migration exists. |
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
| 21 | **Governed professional stream representation.** Legacy v2.3 makes one SQLite record table authoritative for all Artifacts, traces, memory, validation, and Decisions and requires private reasoning capture; current RPH uses typed aggregates/Events/stores and forbids requiring private chain-of-thought. | Implement one logical causally linked history across current typed objects, Events, audit, Artifacts, and Evidence, and query it through rebuildable projections. Preserve observable actions/rationale and what an Assessment saw under retention/redaction policy. Do not add a universal stream record, competing Event authority, or raw-CoT store. |
| 22 | **Professional-wisdom compilation and IR.** The legacy Validator paper proposes a Professional Wisdom Compiler/IR but leaves current ownership, schema, epistemic/authority status, PWA/JSDL relation, conflict model, activation, suspension, and retirement unratified. | Keep source wisdom as provenance-bearing Artifacts/Evidence and trace current Assurance Policies back to it. Generate only candidate policy packages; do not create canonical wisdom tables/types or activate compiled controls without a versioned professional/governance Decision and conformance evidence. |
| 23 | **Mandatory assurance-floor representation and broader coverage/topology.** The invariant is settled: every material professional transformation receives explicit coverage; every material AI/agent transformation requires Reasoning Review; and every required control is durably bound, executed, recorded, inspectable, and enforced before its protected downstream transition. Current contracts do not fully freeze material-boundary identity/classification, locked inherited policy assignment, producing-Attempt/context and protected-transition binding, conjunctive independence, deployment capability/actual invocation projections, or a generalized `AssurancePlan` for dimensional coverage, selection, cost, and gaps. | Never interpret the missing wire shape as permission to omit or hide the floor. Preserve assignment/capability/Assessment/execution separation through accepted PWA policies, Validators, objects, and Events only where lossless; otherwise keep the PWA Draft or output provisional and block the transition. Evolve policy registry, schemas, persistence, projections, fixtures, and conformance tests together before claiming support. Do not invent a parallel planner, legacy review record, prose-only critic, Boolean/badge, or hidden runtime default; optional optimization may add controls but cannot weaken mandatory policy, Evidence, independence, or impact closure. |
| 24 | **Finding, repair, revalidation, and convergence contracts.** Legacy finding/repair/convergence schemas and enums do not match `FindingDefinition`, `AssuranceObservation`, current Commands/Events, or service boundaries; exact subject-version binding, stable recurrence identity, repair representation, impact rules, resolution authority, and convergence composition remain incomplete. | Adapt outputs into existing Observations/Assessments; preserve finding-type Observations against exact versions; represent repair through governed PWUs/Actions/Attempts and existing trace relations only where lossless. Otherwise stop for a contract Decision. Treat convergence as a non-authoritative conceptual property until contracted; do not import legacy records/enums or create a parallel controller. |
| 25 | **Meta-assurance and learning authority.** Current contracts do not define Validator-system subjects, canary isolation, health/suspension Commands, precision/recall adjudication, shared-premise independence, or promotion of outcome-derived wisdom. | Run held-out canaries and control-health analysis in an isolated/observe-first harness, record results as candidate engineering Evidence—not canonical Assurance Observations until the subject/lifecycle contract is ratified—and escalate material failure. Never auto-reject unrelated subjects or self-modify authoritative policies; activation/suspension/evolution requires explicit versioned governance. |

---

## 17. Corpus coverage and source map

This guide is self-contained for orientation and bounded implementation, but exact schema, transition, policy, fixture, and migration work still consults its governing source. Coverage is deliberate:

| Source | Distilled contribution | Primary sections | Status in this guide |
|---|---|---|---|
| [Constitution Discussion (retired)](<Constitution Discussion/retired/Janumi Constitution Discussion.md>) | first principles, cognition loop, CPCO, projections/workspaces, Shape Engineering, JSDL, JEM, JSRP | 1–2, 5, 11–13, 16 | compatible doctrine plus explicitly labeled candidate designs |
| [Legacy JanumiCode v2.3 specification](<Legacy JanumiCode Source Materials/janumicode_spec_v2.3.md>) | logical governed history, layered validation, quarantine, exact review context, dependency invalidation, repair/gate composition | 0, 5, 8–10, 16 | legacy design evidence; phase/storage/authority mechanics are not adopted, and private-reasoning capture is rejected |
| [Legacy Validator Subsystem](<Legacy JanumiCode Source Materials/Janumicode_v2 - Validator Subsystem.md>) | professional-wisdom compilation, three validation dimensions, control topology, durable Findings, repair/revalidation, convergence, meta-assurance | 0, 4, 8, 12, 14, 16 | candidate Assurance Engineering architecture; schemas/enums/roadmap are not current contracts |
| [Fusion Analogy](<Legacy JanumiCode Source Materials/Fusion Analogy.md>) | trajectory control, operating envelope, interacting corrections, observability, stability versus passing | 1, 8, 14 | explanatory rationale only; no fusion vocabulary enters ontology or wire contracts |
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
