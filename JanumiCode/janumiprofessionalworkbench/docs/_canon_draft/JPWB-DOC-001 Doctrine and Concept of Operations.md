---
artifactId: JPWB-DOC-001
title: Doctrine and Concept of Operations
layer: Doctrine
settledness: PRESUMPTIVE
status: DRAFT — pending sponsor ratification
version: 0.1.0
date: 2026-07-16
governs:
  - Why the Janumi system exists as a coherent whole: the theory of professional work that generates the canonical vocabulary
  - The cognitive loop and the reasoning behind the ontology's shape
  - The load-bearing non-equivalences as reasoned doctrine (the why; the term ledger itself is JPWB-DOC-002)
  - The six engineering disciplines and their boundaries
  - The Concept of Operations: how humans and agents operate JPWB across the five workbench contexts, from Undertaking creation through Baseline promotion
  - The Concept of Employment: how deployments scale without changing the constitution (HYPOTHESIS)
  - The dual stance — rigor as commitment, friction as evidence — as operating doctrine
doesNotGovern:
  - Vision, values, axioms, first principles → JPWB-CON-000
  - Term-by-term canonical meanings, naming rules, retired terminology → JPWB-DOC-002
  - Object definitions, invariants, state axes, aggregate boundaries, assurance model mechanics → JPWB-DOC-003
  - Agent conduct, intake, divergence classification, change discipline → JPWB-DOC-004
  - Exact shapes — wire envelopes, schemas, enums, IDs, error codes → the repository (generated contracts, schemas, conformance tests)
  - Rulings and open questions → JPWB-REG-005
precedence: Owns reasoning, judgment, and operation. On a naming or meaning question DOC-002 controls; on a structural or invariant question DOC-003 controls; on a conduct question DOC-004 controls; on any shape question the repository controls. Within this artifact, sections marked HYPOTHESIS are subordinate to the PRESUMPTIVE doctrine core.
changeProcedure: PRESUMPTIVE — proposed via JPWB-REG-005 finding, sponsor-ratified, merged. HYPOTHESIS subsections follow the divergence protocol in JPWB-DOC-004. Never casual drift.
ratification: PENDING — becomes effective via REG-005 entry
---

# JPWB-DOC-001 — Doctrine and Concept of Operations

## 1. How to read this artifact

This artifact carries the theory that generates everything else. The vocabulary (JPWB-DOC-002), the semantic model (JPWB-DOC-003), and the operating protocol (JPWB-DOC-004) are consequences of the doctrine stated here; when their details are contested, the dispute is adjudicated by asking which reading preserves this doctrine. Doctrine tells practitioners — human and agent — how to think and exercise judgment. It does not dictate every step, and it must not be read as a procedure manual: a doctrine clause never overrides an owned invariant in DOC-003 or a conduct rule in DOC-004; it explains them.

The body speaks in the canonical voice of commitment. Per the settledness ladder, that voice means: this is the hypothesis we are committed to testing rigorously — not that the matter is settled by real-world operation. Section 6 states this stance as doctrine in its own right.

## 2. The theory of professional work

### 2.1 Work is reasoning under uncertainty directed toward outcomes

Professional work is not fundamentally a list of tasks, a set of documents, or a workflow. It is reasoning under uncertainty directed toward outcomes. Documents, requirements, architecture, source code, tests, deployments, and dashboards exist because something had to be understood, decided, changed, demonstrated, or observed.

Every artifact exists because uncertainty existed. Requirements exist because intent was uncertain. Architecture exists because implementation was uncertain. Tests exist because correctness was uncertain. This is the origin story of every object type in the ontology, and it yields the system's first design question, asked of every surface, object, and mechanism: **what professional cognition is occurring here?** A mechanism that cannot answer that question is decoration.

Three consequences follow and are load-bearing:

1. **Outcomes are changes in reality.** A deliverable, commit, build, deployment, report, or checked box is not an Outcome. The system contains representations and observations of reality, never reality itself. The doctrinal test: "Submit a compliance package" is a deliverable; "Demonstrate and sustain compliance with applicable controls" is an Outcome.
2. **Uncertainty is first-class professional state.** Questions, ambiguity, Assumptions, contradictions, Evidence gaps, limitations, and residual uncertainty are the work — not UI clutter, not error states, not failures to be hidden. Traditional software hides uncertainty; Janumi exposes it, because reducing it is what professionals are doing.
3. **There is no "finished," only coherent.** Professional understanding is continuously reconciled. Reality, Intent, and Evidence keep changing; the system's obligation is coherence between them, maintained by governed reconciliation, not a terminal "done" state.

### 2.2 The cognitive loop

The domain-independent loop of professional cognition is:

```text
Intent → Understanding → Representation → Reasoning
→ Decision → Action → Observation → Reconciliation ↺
```

This is not a mandatory sequence and MUST NOT be implemented as a pipeline of lifecycle phases. Any Evidence, Decision, Action, Observation, contradiction, or failed Assumption may reopen earlier reasoning. The loop is the reason the legacy phase machine was retired: encoding work definition, sequencing, agent assignment, validation, governance, and state progression into one linear machine conflates categories that the loop keeps distinct. Non-example: this prohibition does not forbid a *compatibility Execution Plan* that happens to visit steps in a familiar order — order as a chosen strategy is legitimate; order as ontology is not.

The loop is recursive: any requirement, design choice, implementation result, test failure, user observation, production incident, or business change may reopen prior reasoning. And it closes through reality: Observations modify confidence; confidence affects Decisions; Decisions change reality; reality generates new Observations; Observations trigger Reconciliation. A system that opens the loop — that ships and stops observing, or observes and never reconciles — has stopped doing professional work regardless of how much activity it exhibits.

### 2.3 Recursion

Professional reasoning naturally oscillates between synthesis and decomposition. Recursion in this system is not an implementation trick; it is a model of professional thought. Any professionally meaningful piece of work may itself become professional work, with its own uncertainty, evidence needs, and completion meaning. This is the axiom from which PWUs, recursive PWU Types, and the Recursive Professional Harness are derived rather than invented — and it is why decomposition is never free: every act of splitting creates an obligation to put the pieces back together at the parent boundary (Section 4, inequality 6).

## 3. Why the ontology has its shape

The canonical vocabulary is not a naming exercise. Each major object family answers a question the theory forces. This section carries the derivations; the term ledger and its guards live in JPWB-DOC-002, and the objects' minimum rules live in JPWB-DOC-003.

The ontology's breadth is evidentiary, not decorative: one primitive, many work topologies. Software teaches recursive decomposition; legal work teaches interdependent reinterpretation; healthcare teaches evidence-driven hypothesis revision; construction teaches distributed coordination and state reconciliation. Each domain exercises a distinct structural property the same harness must carry — which is why the shape below is derived from professional cognition rather than from any one domain's tooling.

### 3.1 The PWU: bounding cognition so it can be governed

If work is reasoning under uncertainty, the unit of work must be a bounded region of that reasoning — the smallest professionally meaningful unit whose objective, scope, obligations, constraints, Evidence needs, completion meaning, and recomposition contribution can be understood as one coherent cognitive object. That unit is the Professional Work Unit. Packaging cognition this way exists so work can be understood, assigned, validated, reconciled, and reconstructed.

The PWU is deliberately not a task, ticket, prompt, chat, file, API call, retry, or compute job, because none of those carry the properties governance needs: a task has no evidence requirements; a prompt has no authority envelope; a file has no completion meaning. Two structural consequences:

- **Activation is gated by framing.** A PWU MUST NOT activate without, at minimum, an objective, scope, authority, and completion conditions; the full readiness profile — the precise gate — is JPWB-DOC-003 STA-5 (readiness), of which this sentence is the doctrinal compression, not a competing rule. An objective names a cognitive or real-world result ("Determine whether the proposed authentication architecture satisfies enterprise security constraints"), never activity ("Work on authentication," "Run the agent," "Complete ticket 481"). Completion defined only as artifact generation is not completion.
- **Sizing follows cognition, not convenience.** A PWU SHOULD be decomposed when uncertainty, authority differences, or responsible-context limits demand it, and MUST NOT be decomposed solely because a UI prefers smaller cards or an agent wants to shed context without preserving rationale.

### 3.2 PWA and Undertaking: separating reusable knowledge from committed work

A profession accumulates knowledge about *what work of a given class is*: which units exist, how they compose, what must be assured, who may decide. That knowledge must be reusable, versionable, and improvable without disturbing work already in flight. Hence the split:

- A **Professional Work Architecture** is the reusable, versioned architecture for a class of professional work — PWU Types recursively composed through explicit child, decomposition, recomposition, obligation, assurance, and governance rules. It is knowledge, not commitment. Published versions are immutable.
- An **Undertaking** is a concrete body of work instantiated under one or more compatible PWA versions and a profile — operated single-binding, one exact selected PWA/profile/version, until composition semantics are contracted (JPWB-REG-005 Q-002). It owns actual state, Evidence, Decisions, and Baselines. It is commitment, not knowledge.

The direction of learning is fixed: an Undertaking that discovers the PWA is wrong does not mutate the PWA; it raises a PWA Change Proposal, which is reviewed and published as a new version. Running Undertakings remain bound to their selected version until explicit migration. This is how the system learns without destabilizing work that relied on the prior understanding.

The type/instance distinction is enforced all the way to the surface: a view of PWU Types shows permitted composition and never execution order or concrete state; a view of an Undertaking's Professional Work Graph shows actual instances and their state. Same shape, opposite content — and every displayed property declares whether it is inherited from the PWA, profiled, locally extended, or instance-owned.

### 3.3 The RPH: coordination as a professional act

Coordinating recursive work under uncertainty is itself professional work: framing, allocating, supervising, validating, reconciling, synthesizing, and escalating, while preserving intent, traceability, evidence, authority, and coherence. The Recursive Professional Harness is that coordination authority, made explicit and recursive — the same machine at every scope, from an enterprise portfolio down to a verification sub-harness.

The RPH is defined by what it refuses as much as by what it does. It MUST NOT treat successful tool execution as successful professional reasoning, infer professional completion from workflow termination, conceal unresolved uncertainty, silently rewrite intent, or collapse disagreement into false consensus. It may use workflow engines and agent orchestration, but it is not defined by them: durable workflows are temporal machinery that *carries out* plans; they are never the work, the PWA, or the Professional Work Graph they operate on.

Two doctrinal assignments follow:

- **Planning is continuous.** The harness continuously asks *what work should exist*, not merely *what work already exists*. Work-framing, not work-tracking.
- **The harness owns tactic selection.** A subordinate agent may faithfully execute its assigned approach; the harness — with cross-PWU visibility the agent lacks — evaluates whether that approach is still productive and changes method, agent, or framing when it is not. A tactic change is not a retry: a retry repeats the approach; a tactic change replaces it.

A sequencing rule follows from inequality 3: capabilities that generate professional structure — dynamic decomposition, AI-authored shapes — are introduced only after the runtime can validate and govern their outputs. Governance capacity precedes generative autonomy.

### 3.4 One governed model, many projections

There is one underlying body of organizational cognition. Requirements, architecture, implementation, verification, decisions, and operations are projections of it — purpose-specific, rebuildable interpretations — never independent modules with separate truth. A projection enables commands but does not itself change state; navigation follows professional questions, not storage structures; routes are projection addresses, not module boundaries.

This doctrine exists because the alternative failure is empirically common and was observed in this program's own history: independently built pages that each own a slice of truth fragment cognition, and the connections between intent, evidence, and decision — which are the actual content of professional work — become unrepresentable. The named anti-patterns this doctrine forbids, each with its test: **module fragmentation** — independently built pages or services that each own a slice of truth, so the connections between intent, evidence, and decision become unrepresentable; **dashboard reductionism** — reducing professional state to aggregate metrics and status widgets that cannot answer *why*; **chat capture** — letting conversation become the store of record, so material conclusions live only in transcripts (Section 7.4 states the crystallization remedy); **graph fetishism** — exposing the raw object graph as the navigation model instead of the professional questions it answers; **false freshness** — presenting derived, cached, or stale conclusions as if currently reconciled with reality; **unexplained scoring** — displaying scores, confidences, or rankings whose basis a professional cannot inspect; and **AI authority inflation** — presenting AI output with the visual or interactive weight of decided state (inequality 3 states the authority rule).

## 4. The load-bearing inequalities

The full non-equivalence ledger lives beside its terms in JPWB-DOC-002. The inequalities below are the ones the theory itself forces; each is stated with its reason, because an agent that knows *why* an inequality holds can decide cases the ledger does not enumerate.

1. **Outcome ≠ Artifact.** An artifact is a representation; an outcome is a change in reality. Systems that equate them optimize for deliverable production and drift from purpose — the central failure of artifact-centered tooling. Every completion claim in the system is ultimately tested against this inequality.

2. **Execution ≠ Assurance.** Successful generation, tool use, testing, or workflow completion can leave professional claims entirely unsupported. Execution produces candidate results; assurance independently evaluates claims against admissible Evidence under versioned policies. These are different questions asked by different machinery, and no execution result — however green — answers the assurance question by itself. Non-example: this does not make execution results worthless to assurance; a test run is admissible Evidence. The inequality forbids *treating the run as the evaluation*, not using its output as input.

3. **Capability ≠ Authority.** Being able to do something — authentication, role, ownership, tool access, model skill — is distinct from being authorized to make it professionally effective. AI output is proposed state by default; consequential approval remains human-governed unless an explicit ratified policy defines a bounded autonomous mode. Runtime privilege is likewise not domain permission: a PWA, plan, prompt, or agent may *request* a capability; only runtime policy grants it. Non-example: this inequality does not require a human in the loop of every mechanical act — an agent executing an approved plan inside its granted envelope needs no per-action approval; it governs the boundary where output becomes authoritative professional state.

4. **Decision ≠ Truth, and Validation ≠ Approval.** A Decision is a governed exercise of authority — it can be wrong, and later Evidence may contradict it without erasing it. Validation produces findings about claims; approval disposes of them with authority. Review, validation, approval, and authorization are four distinct assurance acts; conflating them destroys governance semantics, because it lets an evaluator's opinion silently become an organization's commitment.

5. **PWU ≠ Task, RPH ≠ Workflow Engine, PWA ≠ Execution Workflow.** Semantic progression is not temporal execution sequence. The work's meaning-structure (what must be understood, in what dependency of understanding) and its execution order (what runs when) are different objects; collapsing them re-creates the legacy phase machine. A PWU does not encode its runtime sequence — Execution Plans are replaceable strategies, and replacing a plan does not change the identity or meaning of the work.

6. **Child completion ≠ parent completion.** Every decomposition creates a recomposition obligation. All children may be individually complete while the parent remains incomplete: child outputs conflict, interfaces misalign, residual uncertainty compounds. Synthesis at the parent boundary is mandatory professional work — the defining capability that distinguishes a harness from a workflow engine — and delegation never transfers the recomposition responsibility.

7. **Observation ≠ Evidence ≠ Claim ≠ Decision.** These are stations on the chain by which reality becomes accepted understanding, and each transition is a distinct professional act: an Observation is recorded, an interpretation relates it to a Claim as Evidence, and a Decision disposes of the Claim with authority. Collapsing stations lets unexamined data become organizational commitment in one step.

8. **Commit ≠ Baseline.** A repository commit is a technical configuration-management operation. Baseline promotion is a separate governance operation over an immutable, version-bound accepted state, and MUST NOT be inferred from commit success. This is inequality 5 applied at the moment it is most tempting to ignore.

9. **Asserted status ≠ performed status.** No object or field may claim a status its relations do not perform: no policy objects the runtime never reads, no assurance represented by an unread flag, no provenance fields that decorate rather than trace. This inequality is constitutional (JPWB-CON-000 anti-vacuity clause); it appears here because the system's own first implementation violated it, which is precisely the kind of evidence the dual stance (Section 6) exists to metabolize.

## 5. The six engineering disciplines

### 5.1 Two stacks, joined by the harness

Building this system involves two complementary stacks. The **execution stack** — Prompt, Context, Harness, and Loop Engineering — makes generative actors do useful work. The **professional-work stack** — Shape and Assurance Engineering — defines what the work *is* and whether it remains justified. The RPH joins them: it holds the persistent Professional Work Objects while the execution stack acts on them and the assurance system measures whether the work remains within acceptable semantic and operational bounds.

### 5.2 The disciplines and their boundaries

| Discipline | Governs |
|---|---|
| **Prompt Engineering** | Invocation instructions, immediate objective, output contract, examples, formatting. |
| **Context Engineering** | Relevant artifacts, history, Decisions, Evidence, retrieval, prioritization, freshness, compression, exclusion. |
| **Harness Engineering** | Models, agents, tools, sandboxes, permissions, memory infrastructure, persistence, observability, operational controls. |
| **Loop Engineering** | Next action, branching, retries, corrective work, policy-permitted tactic change, escalation, termination. |
| **Shape Engineering** | Intent, boundaries, obligations, constraints, Assumptions, decomposition, recomposition, semantic integrity. |
| **Assurance Engineering** | Professional-knowledge treatment, policy and applicability, risk-sensitive control coverage, Evidence and inquiry, Validator topology, durable findings, repair and revalidation, convergence, meta-assurance, residual uncertainty, governance integration. |

The division of labor at the top of the stack is one sentence each way: Shape Engineering asks *what must remain true as professional work is transformed*; Assurance Engineering asks *how we know that it remains true*. Loop Engineering's defining question is temporal: *what happens after the system discovers the work may be wrong* — findings, remediation, retry, tactic change, convergence, escalation.

Boundary rules, each guarding a real collapse:

- A prompt is not a role; a role is not a model binding; a plan is not a PWU; a validator is not a policy; runtime privilege is not domain permission. Each pair separates a replaceable mechanism from a durable meaning, so mechanisms can be swapped without semantic loss — a Validator implementation may be replaced without changing the policy it serves.
- Role responsibility and independence are ontology (Shape/Assurance) concerns; role *assignment* to a model or agent is a Harness concern. Independence requirements survive any particular binding.
- Context is selected by governed relationship to the work — trace links, constraints, Decisions, dependencies — with semantic similarity permitted only as a supplement, never as the selector. Relevance is judged by consequence of omission (would omitting this record risk an incomplete, incorrect, or non-compliant result?); retrieval biases toward recall with later filtering; authority and supersession status outrank recency.
- Validators detect and characterize; they recommend policy-permitted control actions. The controller (Loop) selects and executes those actions under policy. The operative prohibition on validator conduct is owned by JPWB-DOC-003 ASR-1; this boundary carries the recommend/decide split as meaning, not a second rule.
- **Governance is an authority function outside the six disciplines.** It alone authorizes waiver, risk acceptance, rejection or abandonment of governed work, and promotion. No discipline may absorb it.

These boundaries interoperate without collapsing ownership. The recurring failure they prevent is a single mechanism — usually the most convenient one, historically the prompt or the workflow engine — silently absorbing responsibilities it cannot carry.

### 5.3 The confinement lens (explanatory, not ontology)

An explanatory analogy, useful and explicitly non-normative: generative actors are an energetic medium; the harness supplies the work system; Shape Engineering defines the transformation geometry; policies and Validators create diagnostic coverage; observability supplies diagnostics; Loop Engineering selects control responses; Commands and repair PWUs are actuators; Governance is operator authority. The insight the lens carries: professional work is a *trajectory* through a structured problem space, each transformation is a distinct risk-injection point where drift, distortion, information loss, and local optimization enter, and there is no single universal validator for trajectory soundness — different instabilities require different detection and different corrective force. A collection of AI critics is not a validation architecture; the placement-and-response topology is. Observability, on this view, is part of the control architecture, not operational hygiene: without diagnostics, evaluators see isolated artifacts; with diagnostics, they can reason about trajectories.

Two doctrine-grade consequences survive the lens's non-normativity. First, assurance distinguishes four properties: **compliance** (an artifact satisfies a validator), **stability** (it remains valid after interacting corrections), **convergence** (successive states approach acceptability), and **confinement** (the whole trajectory stays in bounds). Passing a discrete check proves only compliance, the weakest of them: a workflow can momentarily pass every check and still be unstable, and every validator may function correctly while the system oscillates between incompatible remediations. Convergence is therefore measured — declining correction magnitude, findings migrating rather than the same failure class recurring — never assumed; a remediation loop can continue indefinitely without converging, and non-convergence triggers tactic change and, ultimately, a mandatory halt and escalation rather than further correction (the convergence contracts themselves remain deferred: JPWB-REG-005 Q-024). Second, **trajectory integrity** means every authoritative transition respected the never-cross boundary while provisional defects stayed visible and non-authoritative. A valid-looking final snapshot cannot retroactively repair an unauthorized or unobservable trajectory, and missing required diagnostic history means trajectory integrity cannot be claimed — it never justifies assuming nothing went wrong.

The strategic wager underneath: generative intelligence is becoming abundant; the scarce capability is confining it into reliable professional trajectories. That is what this system is for.

## 6. The dual stance: rigor as commitment, friction as evidence

Almost nothing in this system is settled by real-world operation. The doctrine in this artifact is a strong default — more settled than unsettled — and the semantic details downstream of it are committed hypotheses under test. The operating stance has two halves, and both are obligatory:

**Rigor as commitment.** Implement the canon faithfully and completely, in its own voice, without hedging it down or quietly "improving" it. The justification is experimental validity: a hypothesis implemented sloppily teaches nothing. Only a faithful implementation makes the resulting friction mean something. Rigor here is not bureaucratic ceremony; it is what makes the experiment readable.

**Friction as evidence.** When faithful implementation meets reality and creaks — a vocabulary term that will not stretch, an invariant that fights every call site, a workflow the profession does not recognize — that friction is data, not scandal, and not license. It MUST be captured through the divergence protocol (JPWB-DOC-004) and the register (JPWB-REG-005), never resolved by convenient local reinterpretation and never suppressed to protect the canon's appearance of correctness.

During the convergence phase, the canon is the sole semantic authority and the code is the first experiment being brought into conformance. Dual run never means dual semantic authority. The docs-win presumption is a property of this phase, not a permanent fact; settledness is thereafter earned bottom-up through real-world operation. The system's own history supplies the cautionary evidence in both directions: a governed-objects layer that asserted status its runtime never performed (rigor failure), and two independent agents who over-applied a prohibition into disabling a capability it never governed (a compliance-by-elimination failure — treating the cheapest way to satisfy a rule's letter as satisfying its purpose). Doctrine written without edges produces the second failure; implementation without commitment produces the first.

## 7. Concept of Operations

This section states how humans and agents actually operate JPWB. The authority mechanics (who may decide what) are semantic-model content owned by JPWB-DOC-003; the conduct rules for agents are owned by JPWB-DOC-004. What belongs here is the operating picture: who does what, in what rhythm, with what authority relationships.

### 7.1 The five workbench contexts

JPWB presents five interoperating contexts over the same governed model. Each exposes a different primary object and a different authority boundary; none owns separate truth, and all share canonical identifiers and deep links, so a user can move from any displayed conclusion to its Claim, Evidence, generating Action, governing policy, Validator execution, Decision, and Baseline membership.

| Context | Primary concern | Authority exercised there | Must not become |
|---|---|---|---|
| **PWA Design** | Author, inspect, validate, version, publish, and define migration contracts for a PWA and its assurance assignments | Definition authority over reusable types; publication is governed | An untyped form builder or flat sequence editor |
| **Undertaking** | Establish purpose, boundaries, Participants, Context, PWA/profile/version binding, initial Baseline | Framing authority over a concrete commitment | A generic project record |
| **Execution** | Navigate PWUs, Plans, Steps, dependencies, attempts, outputs, control actions | Operational authority within granted envelopes | An opaque agent chat or task list |
| **Assurance** | Inspect required and resolved coverage, Claims, criteria, Evidence, Assessments, Validator executions, durable findings, gate effect, uncertainty | Evaluative authority only — assesses without approving | A pass/fail badge or Validator console |
| **Governance** | Make version-bound Decisions; manage waivers, promotion, change, reconciliation | Decision authority — the only context that approves, waives, promotes | An informal approval screen |

The separation of the last two is deliberate and load-bearing: the Assurance context evaluates and must not exercise governance authority; the Governance context decides and must not manufacture its own evidence. The PWA Design context has a purity rule: it MUST NOT display concrete Undertaking state except as labeled fixtures — definitions and instances never blur.

### 7.2 Participants and authority

**Humans** hold the decisions that constitute governance: approve intent, resolve material ambiguity, accept risk, grant waivers, approve material shape changes, promote Baselines. Humans exercising authority are served, not queued: a governance decision arrives as a synthesized review package — objective, evidence, assumptions, attempted tactics, remaining uncertainty, options, recommendation, consequences of delay — never as an obligation to reconstruct history from raw object graphs or transcripts.

**Agents** are Participants with explicit professional contracts. Every agent execution receives a delegation envelope — objective, scope, non-goals, authority, constraints, inputs, expected outputs, completion conditions, escalation conditions — and its permissible actions are constrained by its assigned mode. Agent output is proposed state by default; material AI contributions carry visible provenance (agent, role, model, execution context, tools, Evidence, Assumptions, limitations, disposition). An agent MUST NOT silently broaden scope, substitute a different Intent, approve its own material work, infer human approval, or claim outcome achievement from artifact production. When an agent cannot continue responsibly — insufficient authority, insufficient evidence, unresolvable ambiguity — it escalates; it does not fabricate a conclusion. AI participation is contribution inside the reasoning flow, never invisible automation: professionals continuously see what was concluded, why, from which evidence, under which assumptions, with what confidence.

**The harness** supervises. It monitors professional progress — uncertainty reduction, evidence accumulation, validation completion — not merely execution progress; it owns tactic selection; it initiates synthesis; it escalates with synthesized packages. Even the harness has no back door: RPH workers issue semantic Commands and MUST NOT write authoritative state directly. There is exactly one governed mutation path, for humans, agents, and the system's own coordinators alike — and this holds for operators too: correcting authoritative professional state through generic database tools is not a normal operational procedure.

The role-conflict rule binds all participants: an executor may not approve its own material work, and an author may not satisfy an independence requirement on the validation of that work.

### 7.3 The operating rhythm: Undertaking creation through Baseline promotion

The canonical rhythm — the loop of Section 2.2 operationalized — is:

1. **Shape the work.** A PWA version and profile are selected; an Undertaking is created with purpose, boundaries, Participants, and initial Baseline. Required PWU Instances are instantiated per profile — the PWA catalog is a policy-governed menu, not a mandatory checklist. No PWU activates without satisfying its framing contract.
2. **Plan.** An Execution Plan is generated or selected for eligible PWUs. The plan is a governed, replaceable strategy — it is not the work.
3. **Bind.** Agents, models, tools, permissions, sandboxes, and context are bound under runtime policy. Requesting is not receiving; authority is evaluated at command-execution time, never inherited from UI visibility, stale tokens, prior assignment, or prompt instructions.
4. **Execute.** Steps run; humans and agents act within their envelopes; outputs, evidence, and observations are captured with provenance. Waiting — for review, external evidence, time — is durable professional state, not a held thread.
5. **Assure.** The de minimis floor applies to every material professional transformation, including Reasoning Review for every material AI-produced result; risk-derived controls add to the floor, never subtract. Findings are durable obligations: regeneration, repair, or later success never erases what was observed about an exact version.
6. **Control.** Findings and progress evaluation drive a policy-permitted control action — illustratively: continue, request evidence, retry, change model or tool, revise context or prompt, reshape, re-decompose, replace the plan, escalate, waive, reject, abandon; the governed action vocabulary and its exact spellings are contract shapes, not this list. A retry or repair context carries the findings that triggered it — never the quarantined output itself — and names the specific violated criterion, not a generic try-again signal. Repeated failure or no uncertainty reduction triggers tactic evaluation, not blind retry.
7. **Recompose.** At every parent boundary, child results are synthesized and verified for cross-child coherence — interface alignment, intent alignment, compounded residual uncertainty. Parent completion remains unavailable until required recomposition is accepted; AI-assisted synthesis gets no authority shortcut.
8. **Decide.** Governance disposes: approval, rejection, waiver, risk acceptance, deferral — version-bound, evidence-backed, human-held for consequential matters. Completion is honest: a disposition vocabulary that admits residual uncertainty, inconclusiveness, transfer, and supersession, with unaccepted residual uncertainty blocking closure.
9. **Promote and observe.** Accepted results are promoted into an authoritative Baseline by a distinct governance act. The loop does not terminate at deployment: production observation feeds outcome assessment; invalidated assumptions trigger reconciliation; reconciliation identifies affected intent, requirements, architecture, and implementation, and generates follow-on work through the same governed front door.

The rhythm is recursive (every non-leaf PWU runs it at its own scope) and non-linear (validation may create implementation work; architecture analysis may reopen requirements). What makes it a professional rhythm rather than a pipeline is the set of gates: framing before activation, assurance before advancement, recomposition before parent completion, authority before effect, observation after action.

### 7.4 Attention, waiting, and honest failure

**Attention is durable professional state, not notification.** An Attention Item binds a professional condition to the authority required to address it, persists until explicit disposition under the governed disposition vocabulary (meanings: JPWB-DOC-003; exact spellings: the repository contracts), and is ranked by professional consequence, not recency. Notification is merely a delivery mechanism. Ignoring is not a state.

**Human input crystallizes.** Material conclusions, decisions, claims, evidence, and assumptions produced in conversation MUST be promoted into explicit governed entities. Chat is an input surface and a projection over the model, never the store of record: no future participant should have to reconstruct material decisions from transcripts. Non-example: this does not prohibit conversational surfaces or require every utterance to be reified — it governs *material* outputs, the ones that would otherwise become load-bearing while trapped in history.

**Failure is a professional category.** The system distinguishes technical failure, authority failure, validation failure, and professional failure — the objective could not responsibly be achieved. Budget or limit exhaustion produces a governed state, never fabricated completion; a safe stop preserves state, records partial work, names unresolved uncertainty, and recommends restart or escalation. Degradation is declared per capability — agent execution may be down while human review and Decisions continue — never hidden behind one green light. Resumption after suspension is re-grounding, not continuation: authority, current state, constraints, and assumptions are re-evaluated, because time invalidates context.

### 7.5 Interaction grammar

Humans and agents act on the system through a shared professional verb set: **orient, inspect, propose, assess, decide, execute, recompose, promote, reconcile**. The supporting verbs — trace, compare, challenge, contribute, delegate, request-evidence, escalate — are HYPOTHESIS: a drafting-time fusion of two source grammars, candidate extensions pending sponsor confirmation via JPWB-REG-005; the nine primary verbs are the load-bearing set. The grammar is doctrine, not styling: each verb marks a different authority relationship to the model. *Inspect* reads; *propose* creates candidate state without granting authority; *assess* evaluates against explicit criteria; *decide* records authorized disposition over an identified version; *execute* invokes an approved plan under policy; *recompose* asserts cross-child coherence at a parent boundary as a judged act, creating candidate parent state subject to assessment and decision; *promote* creates a Baseline through governance; *reconcile* resolves expectation-versus-observation differences. AI assistance uses the same grammar — it may draft, summarize, classify, decompose, propose — and its output enters the model through the same verbs with the same authority tests.

Every surface answers the professional's orientation questions — where am I, why does this work exist, what is understood, what remains uncertain, what needs attention, what am I permitted to do, and what professional effect will my action have. Available actions derive from governed state; a prohibited action is shown with its professional reason ("Approve Release is unavailable because the mandatory security review failed and no exception authority is assigned"), not silently hidden; failures explain themselves in professional terms, with technical detail secondary.

## 8. Concept of Employment — HYPOTHESIS

*This section is marked HYPOTHESIS: it describes deployment intent that has not yet met operating reality.*

The constitution does not vary with deployment scale. The intended employment ladder — solo professional, team, department, enterprise, multi-enterprise federation — changes topology, tenancy, and operational hardening, never professional semantics: the same framing gates, assurance floor, authority boundaries, and recomposition obligations hold for one person with one Undertaking as for a federated portfolio.

Learned and generalized content is class-isolated — matter-private, organization-private, federation, shareable professional, civilizational — and crossing a class boundary is a governed protected transformation subject to privilege, confidentiality, consent, and leakage review, never implicit training. There is no silent cross-client or cross-tenant learning (promotion lifecycle contracts remain deferred: JPWB-REG-005 Q-025).

Structural commitments carried at this layer: a trusted control plane (durable RPH execution, professional-work services, assurance, governance, identity, tenancy, audit) is separated from an isolated execution plane running untrusted compilers and agents in ephemeral per-tenant sandboxes. Product surfaces (web, mobile, IDE) are clients over the same model — semantic adaptations, never separate products, and never edition boundaries. Mobile prioritizes judgment and capture — attention, review, approval, observation and evidence capture — over deep authoring. The IDE surface embeds the professional model in the editor and MUST NOT reduce the system to a chat panel. Edition tiering monetizes scale, integration, and organizational governance — never permission to be trustworthy: core correctness and the de minimis assurance floor are not enterprise features.

Semantics survive topology: logical service roles may share one executable but remain separately identifiable across the nine responsibility boundaries — work and semantic objects; shape, decomposition, and recomposition; execution planning and durable process; runtime authorization and harness binding; agent, tool, and sandbox execution; assurance policy, evidence, validation, and assessment; governance and baseline; traceability, impact, and attention; and events, audit, artifacts, projections, integration, and observability. These are responsibility boundaries, not mandatory microservices; their point is that no service silently absorbs another's responsibility. Event-delivery and ordering guarantees of the governed professional stream are preserved in single-node deployments even where one process makes the transport trivially reliable; and governed authoritative processing outranks AI experimentation for host resources.

## 9. What this artifact deliberately does not carry

- **Term definitions and the full non-equivalence ledger** → JPWB-DOC-002. Section 4 carries reasons, not the registry.
- **Object structure, state axes, invariants, the assurance model's mechanics, persistence semantics** → JPWB-DOC-003. Where this artifact says "framing gate" or "framing contract," it means the readiness gate JPWB-DOC-003 STA-5; where it says "de minimis floor," DOC-003 likewise owns the precise rule. The Attention Item's object definition and disposition vocabulary are DOC-003 content; this artifact carries only its doctrine.
- **Agent conduct: intake, verification ladders, the divergence protocol, escalation procedure, drafting standards** → JPWB-DOC-004. Section 6 states the stance; DOC-004 states the moves.
- **Exact shapes of anything** → the repository. This artifact never restates a schema, enum, or wire contract, and no phrasing here may be read as one.
- **Open questions this doctrine surfaces but does not settle** → JPWB-REG-005, each with its safe default. In particular: multi-PWA composition semantics for a single Undertaking are not yet contracted — operate single-binding and do not invent merge or precedence semantics.
