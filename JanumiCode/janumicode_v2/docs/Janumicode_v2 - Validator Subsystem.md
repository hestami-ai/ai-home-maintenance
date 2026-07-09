# The Professional Wisdom Compiler

## A Compiler from Accumulated Professional Wisdom into Executable Control Structures for Agentic Work

### Concept Paper

## Abstract

Artificial intelligence agents are increasingly capable of producing complex professional artifacts: software, requirements, architectures, user journeys, legal analyses, research plans, operational procedures, and other forms of knowledge work. Yet the dominant approach to controlling the quality of this work remains comparatively primitive. Agents are typically given instructions, examples, policies, and access to tools, then evaluated primarily on whether their outputs appear plausible, satisfy explicit acceptance criteria, or pass tests.

This approach fails to exploit one of humanity's most valuable assets: the accumulated knowledge of how professional work predictably goes wrong.

Every mature profession has developed bodies of knowledge concerning recurring failure dynamics. These appear under many names: laws, principles, heuristics, doctrines, anti-patterns, smells, failure modes, cognitive biases, quality models, safety rules, review methods, standards, lessons learned, and professional judgment. Software engineering has Gall's Law, Hyrum's Law, Goodhart's Law, YAGNI, SOLID, the testing pyramid, and the Second-System Effect. Requirements engineering has ambiguity defects, unverifiability, premature solutioning, orphan requirements, and decomposition failures. User experience disciplines recognize happy-path bias, persona theater, product-centric journeys, and touchpoint myopia. Safety engineering uses hazard analysis, defense in depth, independent verification, and assumptions about latent failure. Other professions possess equivalent accumulated wisdom.

Today, this knowledge is largely written for humans. It exists in books, standards, training materials, organizational doctrine, case studies, and expert practice. It is rarely represented in a form that an agentic system can systematically execute.

This paper proposes the **Professional Wisdom Compiler**: a system and methodology for transforming accumulated professional wisdom into executable control structures for agentic work.

The compiler ingests heterogeneous sources of professional knowledge, interprets the underlying recurrent dynamics, and compiles them into machine-actionable structures including constitutions, invariants, obligations, prohibitions, quality models, failure ontologies, evidence requirements, inspection procedures, validators, escalation conditions, and corrective control loops.

The central proposition is:

> Mature professional knowledge should not merely be placed in an agent's context. It should be compiled into the control architecture governing how agentic work is produced, inspected, corrected, and trusted.

The result is a shift from agents that merely know professional guidance to agent systems operationally constrained by it.

---

# 1. The Problem

## 1.1 Agentic systems can produce work faster than they can establish that the work deserves trust

Modern agents can generate substantial professional artifacts in minutes. A coding agent can modify hundreds of files. A planning agent can produce an extensive requirements hierarchy. An architecture agent can design a distributed system. A research agent can synthesize large bodies of evidence.

The bottleneck increasingly moves from production to assurance.

The central problem is not simply whether an agent can produce an answer. It is whether the surrounding system can determine:

* whether the agent solved the right problem;
* whether important assumptions were invented or concealed;
* whether decomposition preserved the original intent;
* whether the artifact exhibits known professional failure patterns;
* whether apparently successful metrics are misleading proxies;
* whether the agent considered plausible alternatives;
* whether dependencies and second-order effects were missed;
* whether the work is adequately supported by evidence;
* whether repeated correction is converging;
* and when continued iteration should stop, change tactics, broaden the search, or escalate.

These are not new problems. Human professions have encountered them for decades or centuries.

What is new is that agentic systems make it possible—and necessary—to operationalize the accumulated answers.

## 1.2 Professional wisdom is abundant but operationally inert

Professional knowledge is distributed across many forms.

A software engineer may know:

* Gall's Law;
* Hyrum's Law;
* the Law of Leaky Abstractions;
* Goodhart's Law;
* the Second-System Effect;
* YAGNI;
* KISS;
* SOLID;
* the Boy Scout Rule;
* technical debt;
* the testing pyramid;
* the pesticide paradox.

A requirements engineer may know to watch for:

* ambiguity;
* compound requirements;
* unverifiable language;
* hidden assumptions;
* premature solutioning;
* missing constraints;
* orphan requirements;
* conflicting stakeholder needs;
* requirements that are individually valid but collectively infeasible.

A user-experience professional may recognize:

* happy-path bias;
* persona theater;
* product-centric journeys;
* touchpoint myopia;
* journey/process confusion;
* unsupported behavioral assumptions;
* missing recovery and re-entry paths.

A safety engineer may look for:

* common-cause failures;
* single points of failure;
* inadequate independence;
* latent conditions;
* unsafe interactions;
* assumption violations;
* weak escalation paths.

The knowledge exists.

The problem is that most of it remains expressed as prose for human interpretation.

An agent may be told to "follow best practices," but this does not specify:

* which practices apply;
* under what conditions;
* what observable evidence indicates violation;
* how severe the violation is;
* what remediation is appropriate;
* whether the agent should retry;
* whether another professional perspective should be invoked;
* or whether the entire approach should be reconsidered.

The knowledge is available, but it has not been compiled.

---

# 2. Core Thesis

The Professional Wisdom Compiler is based on a simple proposition:

> Every mature professional domain contains accumulated knowledge about how its work products and work processes predictably fail. That knowledge can be transformed into executable control structures for agentic work.

The transformation can be expressed as:

**Professional wisdom → recurrent dynamic → hazard → invariant → operational control**

A more complete compilation chain is:

**Source doctrine**
→ **normalized professional claim**
→ **underlying mechanism**
→ **applicability conditions**
→ **failure mode**
→ **observable indicators**
→ **governing invariant**
→ **agent obligation or prohibition**
→ **evidence requirement**
→ **inspection method**
→ **validator specification**
→ **remediation policy**
→ **convergence criterion**
→ **tactic-change condition**
→ **escalation rule**

Consider Hyrum's Law:

> With enough users, every observable behavior will be depended upon by somebody.

Merely placing that sentence in an agent prompt provides weak control.

Compilation produces something more operational:

**Underlying dynamic:** Observable behavior creates implicit dependencies regardless of formal documentation.

**Hazard:** An agent changes behavior that appears unofficial or unused.

**Invariant:** Existing observable behavior must be presumed depended upon until evidence establishes otherwise.

**Agent obligation:** Identify externally observable behavioral changes before implementation.

**Evidence requirement:** Search consumers, tests, schemas, logs, documentation, integration code, and version history.

**Validator:** Compare changed observable behavior against known and plausible consumers.

**Finding:** Report the behavior, evidence, uncertainty, affected dependencies, and compatibility risk.

**Remediation:** Preserve compatibility, migrate consumers, version the interface, or obtain explicit authorization for the break.

**Escalation:** If dependency scope cannot be established with adequate confidence, require human review.

This is the difference between professional knowledge as information and professional knowledge as control.

---

# 3. Why "Compiler"?

The term compiler is deliberate.

A conventional compiler does not merely store source code. It transforms one representation into another representation suitable for execution.

The Professional Wisdom Compiler performs an analogous function.

Its source languages are heterogeneous:

* books;
* standards;
* laws;
* principles;
* heuristics;
* case studies;
* incident reports;
* professional doctrine;
* organizational policies;
* quality frameworks;
* review methods;
* expert interviews;
* lessons learned.

Its intermediate representation captures the semantics beneath those forms.

Its targets are executable structures:

* constitutions;
* invariants;
* constraints;
* validator definitions;
* evidence schemas;
* workflow gates;
* review procedures;
* remediation loops;
* tactic-change policies;
* escalation rules.

The compiler metaphor also imposes useful discipline.

A real compiler requires:

* parsing;
* normalization;
* semantic analysis;
* type checking;
* dependency resolution;
* conflict detection;
* optimization;
* target-specific generation;
* provenance;
* diagnostics.

A Professional Wisdom Compiler requires analogous capabilities.

It must determine what a source actually means, where it applies, how strongly it should govern behavior, whether it conflicts with other guidance, what evidence can support its enforcement, and how it should be instantiated within a particular professional workflow.

---

# 4. Professional Wisdom as Source Material

## 4.1 Not all professional knowledge has the same epistemic status

The compiler must not flatten all guidance into equivalent "rules."

A mathematical theorem is not the same as a management aphorism.

A statutory requirement is not the same as a heuristic.

An organizational policy is not the same as an empirical pattern.

A widely observed anti-pattern is not the same as a formally validated causal relationship.

The source model should therefore classify professional knowledge by type.

Possible classes include:

* **Formal laws and theorems** — propositions with explicit assumptions and rigorous derivation.
* **Regulatory obligations** — externally imposed requirements.
* **Standards and normative requirements** — agreed professional constraints.
* **Organizational policies** — locally authoritative rules.
* **Empirical regularities** — repeatedly observed patterns.
* **Heuristics** — useful but defeasible decision aids.
* **Design principles** — preferred approaches to construction.
* **Anti-patterns** — recurring structures associated with poor outcomes.
* **Smells** — suspicious indicators requiring investigation.
* **Cognitive biases** — predictable distortions in judgment.
* **Failure modes** — recognizable ways a process or artifact fails.
* **Inspection methods** — structured ways of interrogating work.
* **Lessons learned** — experience-derived findings from prior outcomes.
* **Expert tacit knowledge** — judgment not yet fully formalized.

Every compiled control should retain the epistemic status of its source.

A statutory prohibition may create a hard gate.

A safety invariant may require explicit waiver.

A heuristic may create a review question.

A smell may trigger investigation without presuming a defect.

This prevents the system from turning all professional wisdom into rigid bureaucracy.

## 4.2 Wisdom is often encoded indirectly

Professional knowledge rarely arrives already expressed as an executable rule.

Gall's Law describes a pattern.

Goodhart's Law warns about proxy corruption.

Chesterton's Fence recommends epistemic caution.

The testing pyramid proposes a portfolio structure.

A postmortem may reveal a previously unknown failure mechanism.

The compiler must therefore identify the deeper professional content:

* What repeatedly happens?
* Why does it happen?
* Under what conditions?
* What is the resulting hazard?
* What evidence would reveal that the hazard is present?
* What behavior should change because of it?
* What exceptions are legitimate?
* What uncertainty remains?

The compiler's primary task is semantic extraction, not summarization.

---

# 5. The Professional Wisdom Intermediate Representation

The core technical artifact should be a domain-neutral intermediate representation, or **Professional Wisdom IR**.

A compiled wisdom unit might contain:

### Identity

* unique identifier;
* name;
* domain;
* source;
* provenance;
* version.

### Epistemic status

* theorem;
* regulation;
* standard;
* empirical regularity;
* heuristic;
* principle;
* smell;
* anti-pattern;
* lesson learned.

### Claim

What does the professional knowledge assert?

### Mechanism

Why is the effect believed to occur?

### Applicability

Under what conditions is the knowledge relevant?

### Hazard

What undesirable outcome can result?

### Indicators

What observable evidence suggests the hazard may be present?

### Invariant

What condition should remain true?

### Obligations

What must an agent do?

### Prohibitions

What must an agent not do?

### Evidence requirements

What evidence must be obtained before confidence is justified?

### Inspection methods

How should the artifact or decision be interrogated?

### Severity

What is the consequence of violation?

### Confidence

How strong is the underlying knowledge and how confidently does it apply here?

### Exceptions

Under what conditions may the normal rule be overridden?

### Remediation

What corrective actions are appropriate?

### Escalation

When is autonomous resolution insufficient?

### Relationships

What other professional wisdom units reinforce, qualify, conflict with, or depend upon this one?

This intermediate representation allows the same professional wisdom to compile differently for different execution environments.

Hyrum's Law may become:

* a coding-agent instruction;
* an API compatibility validator;
* a database migration gate;
* an architecture review question;
* a change-risk score;
* or an escalation trigger.

The source wisdom remains stable. The executable target changes.

---

# 6. Compilation Targets

The compiler should produce several distinct classes of control structure.

## 6.1 Constitutions

A constitution expresses the compact governing doctrine for an agent or phase.

It answers:

> Under what principles is this work permitted to proceed?

A coding constitution might state:

* evolve complex systems from simpler working states;
* preserve intent over proxies;
* presume observable behavior may be depended upon;
* introduce complexity only in response to demonstrated need;
* make assumptions visible;
* prefer evidence over confidence;
* preserve reversibility where uncertainty is high.

The constitution should remain concise enough to influence behavior.

It is not the full validation specification.

## 6.2 Invariants

Invariants express conditions that must remain true across work and transformations.

Examples:

* every requirement must remain traceable to a legitimate source;
* decomposition must preserve parent intent;
* no architectural decision may silently invalidate an approved constraint;
* every externally observable breaking change must be explicitly identified;
* critical claims must retain their supporting evidence.

Invariants are especially important in long-horizon workflows because they define what must survive change.

## 6.3 Quality models

Quality models define the properties expected of an artifact.

A requirement may need to be:

* necessary;
* singular;
* unambiguous;
* feasible;
* verifiable;
* traceable.

A user journey may need:

* a legitimate actor;
* a grounded goal;
* a trigger;
* temporal progression;
* decision points;
* failure paths;
* recovery;
* re-entry;
* external touchpoints.

Quality models answer:

> What properties must a good artifact possess?

## 6.4 Failure ontologies

Failure ontologies define the known ways an artifact or process can go wrong.

For user journeys:

* product-centricity;
* happy-path collapse;
* persona theater;
* touchpoint myopia;
* unsupported behavior;
* journey/process confusion;
* static-world assumptions.

For requirements:

* ambiguity;
* false precision;
* premature solutioning;
* hidden assumptions;
* decomposition drift;
* orphaning;
* conflict;
* local validity with global infeasibility.

Failure ontologies answer:

> What known classes of failure should we actively search for?

## 6.5 Inspection procedures

Inspection procedures specify how work should be interrogated.

Examples include:

* cognitive walkthrough;
* adversarial walkthrough;
* counterexample search;
* trace-back review;
* assumption surfacing;
* dependency analysis;
* change-impact analysis;
* second-order-effects analysis;
* red-team review;
* cross-persona review.

These are executable epistemic procedures.

## 6.6 Validators

Validators operationalize specific professional concerns.

A validator should not merely ask whether an artifact is "good."

It should have:

* a defined concern;
* an applicability condition;
* required evidence;
* an inspection procedure;
* a finding schema;
* confidence calibration;
* severity classification;
* remediation guidance;
* escalation criteria.

## 6.7 Control-loop policies

Some wisdom applies not to the artifact but to the behavior of the workflow itself.

Examples:

* repeated revisions are no longer producing meaningful improvement;
* the same class of defect keeps recurring;
* validators disagree persistently;
* evidence remains insufficient;
* the current hypothesis has survived only because alternatives were not explored;
* remediation cost is increasing without convergence.

These conditions should compile into:

* retry rules;
* convergence tests;
* search-space expansion;
* tactic changes;
* model changes;
* role changes;
* escalation.

---

# 7. Three Fundamental Validation Dimensions

A central architectural principle is that artifact quality alone is insufficient.

Every phase should be validated along at least three dimensions.

## 7.1 Intrinsic validation

The question is:

> Is this artifact well formed on its own terms?

Examples:

* Is the requirement unambiguous?
* Is the architecture coherent?
* Does the code pass its tests?
* Does the user journey include recovery paths?

## 7.2 Derivation validation

The question is:

> Was this artifact legitimately derived from its sources?

Examples:

* Does the requirement actually follow from stakeholder intent?
* Did decomposition preserve meaning?
* Was an architectural constraint invented?
* Does the test validate the requirement or merely a convenient proxy?

This is critical because a high-quality artifact can still be the wrong artifact.

A requirement can be atomic, measurable, feasible, and testable while having no legitimate relationship to the original need.

## 7.3 Systemic validation

The question is:

> Does this artifact remain coherent with the larger evolving system?

Examples:

* Does a new requirement conflict with another requirement?
* Does a locally reasonable architecture decision violate an enterprise policy?
* Does a code change break an undocumented downstream dependency?
* Do individually feasible requirements become collectively impossible?

These three dimensions can be summarized as:

**Intrinsic:** Is it good?

**Derivational:** Is it justified?

**Systemic:** Does it fit?

A mature agentic control architecture requires all three.

---

# 8. Validation as Professional Inquiry, Not Mechanical Compliance

The Professional Wisdom Compiler should not create a giant rule engine that mechanically rejects work.

Professional judgment often operates under uncertainty.

A smell is not a defect.

A heuristic has exceptions.

Two valid principles may conflict.

A locally suboptimal design may be justified by a global constraint.

The correct architecture is therefore not:

**Rule violated → reject**

It is:

**Signal detected → investigate → gather evidence → assess context → determine consequence**

Validators should express findings in calibrated terms.

A finding should identify:

* the suspected failure mode;
* the evidence;
* the reasoning;
* the affected artifact;
* the potential consequence;
* the confidence level;
* the unresolved uncertainty;
* the recommended remediation;
* the conditions under which no remediation is necessary.

This is closer to professional review than static linting.

---

# 9. Validator Roles as Distinct Epistemic Attacks

Not all validators should inspect work in the same way.

A robust system should instantiate different modes of professional skepticism.

## The Smell Detector

Asks:

> What looks suspicious?

It identifies indicators without presuming a defect.

## The Assumptions Surfacer

Asks:

> What must be true for this artifact or decision to be valid?

It makes hidden dependencies explicit.

## The Counterexample Seeker

Asks:

> Under what plausible condition does this fail?

It searches for disconfirming cases.

## The Traceability Auditor

Asks:

> Where did this claim, requirement, decision, or constraint come from?

It checks derivational legitimacy.

## The Completeness Challenger

Asks:

> What relevant part of the problem space was not considered?

It attacks premature closure.

## The Coherence Checker

Asks:

> What conflicts with this elsewhere?

It evaluates systemic fit.

## The Dependency and Impact Analyst

Asks:

> If this changes, what else changes?

It searches the formal and informal neighborhood of the artifact.

## The Second-Order-Effects Validator

Asks:

> If this works exactly as intended, what new problems or behaviors might it create?

It addresses unintended consequences.

## The Reality-Grounding Validator

Asks:

> Are we reasoning about the real world or merely about our current representation of it?

It attacks map-territory confusion.

## The Proxy Integrity Validator

Asks:

> Has the measure, test, benchmark, or acceptance criterion displaced the actual objective?

It operationalizes Goodhart-like failure dynamics.

## The Tactic-Change Controller

Asks:

> Is continued iteration using the current strategy still rational?

It observes the control loop itself.

Together, these validators create structured cognitive diversity.

---

# 10. The Compilation Pipeline

The Professional Wisdom Compiler can be organized as a multi-stage pipeline.

## Stage 1: Source acquisition

Collect candidate professional knowledge from:

* books;
* standards;
* regulations;
* research;
* case studies;
* incident reports;
* organizational policies;
* retrospectives;
* expert interviews;
* historical project data.

## Stage 2: Source classification

Determine:

* domain;
* authority;
* epistemic status;
* scope;
* version;
* provenance.

## Stage 3: Semantic extraction

Extract:

* the professional claim;
* the mechanism;
* the hazard;
* applicability conditions;
* known exceptions.

## Stage 4: Failure normalization

Map the source into a shared failure ontology.

Different sources may describe the same underlying dynamic using different language.

For example:

* metric gaming;
* test gaming;
* benchmark overfitting;
* KPI distortion;
* specification gaming;

may all partially instantiate a broader class:

**Proxy displacement of objective**

## Stage 5: Control derivation

Derive:

* invariants;
* obligations;
* prohibitions;
* evidence requirements;
* inspection procedures.

## Stage 6: Target compilation

Generate phase-specific controls:

* constitution clauses;
* validator specifications;
* workflow gates;
* artifact schemas;
* review procedures;
* remediation policies.

## Stage 7: Conflict analysis

Identify conflicts such as:

* simplicity versus extensibility;
* robustness versus strictness;
* local optimization versus global optimization;
* speed versus assurance;
* abstraction versus explicitness.

The compiler should preserve these tensions rather than silently choosing one side.

## Stage 8: Validation of the compiled controls

The controls themselves must be reviewed.

Questions include:

* Does the validator actually test the intended concern?
* Can it be gamed?
* Does it create false confidence?
* Is its evidence accessible?
* Is its cost proportionate to risk?
* Does it duplicate another validator?
* Does it create contradictory remediation pressure?

## Stage 9: Runtime observation

Monitor:

* validator findings;
* false positives;
* false negatives;
* repeated violations;
* remediation outcomes;
* escalations;
* production incidents.

## Stage 10: Wisdom evolution

Feed outcomes back into the knowledge base.

The compiler therefore supports a closed loop:

**Professional wisdom → controls → agentic work → outcomes → new professional wisdom**

---

# 11. Application to JanumiCode

JanumiCode provides a natural execution environment for this concept because its work is already structured into phases, sub-phases, artifacts, agents, validators, and feedback loops.

Each phase can be modeled as a Professional Work Unit.

A Professional Work Unit contains:

* an input shape;
* an intended transformation;
* an output shape;
* applicable professional doctrine;
* invariants;
* known failure modes;
* evidence requirements;
* validators;
* completion criteria;
* escalation conditions.

The Professional Wisdom Compiler supplies the control package appropriate to that work unit.

## Example: User Journey Generation

### Input

* formalized intent;
* personas;
* stakeholder evidence;
* domain context.

### Output

* user journeys.

### Compiled constitution

* model the user's goal rather than the product's preferred workflow;
* distinguish evidence from hypothesis;
* represent the world beyond the software;
* include interruption, failure, recovery, and re-entry where relevant.

### Failure ontology

* product-centricity;
* happy-path collapse;
* persona theater;
* touchpoint myopia;
* unsupported behavior;
* journey/process confusion;
* static-world assumption.

### Validators

* goal fidelity validator;
* evidence-grounding validator;
* adverse-path validator;
* external-touchpoint validator;
* temporal realism validator;
* traceability validator.

## Example: Requirements Generation

### Compiled constitution

* preserve stakeholder intent;
* do not invent commitments;
* distinguish needs from solutions;
* make assumptions explicit;
* preserve traceability through decomposition.

### Failure ontology

* ambiguity;
* false precision;
* premature solutioning;
* orphan requirements;
* decomposition drift;
* hidden assumptions;
* local validity/global infeasibility.

### Validators

* requirements smell detector;
* derivation validator;
* assumption surfacer;
* conflict detector;
* decomposition fidelity validator;
* feasibility interaction validator.

## Example: Coding

### Compiled constitution

* evolve complexity from working states;
* introduce complexity only in response to demonstrated pressure;
* presume observable behavior may be depended upon;
* preserve intent over proxies;
* optimize only against evidence;
* make failure explicit.

### Failure ontology

* speculative abstraction;
* second-system architecture;
* compatibility breakage;
* proxy gaming;
* hidden complexity displacement;
* premature optimization;
* accidental scope expansion.

### Validators

* complexity justification validator;
* compatibility validator;
* intent fidelity validator;
* dependency impact validator;
* test adequacy validator;
* scope validator.

The result is not one generic validation framework.

It is a phase-sensitive professional control system.

---

# 12. Relationship to Shape Engineering

The Professional Wisdom Compiler can be understood as a major mechanism within Shape Engineering.

Shape Engineering asks:

> What is the work? What does it mean? What must survive decomposition? What evidence must return? What constitutes success?

The compiler adds:

> How does this kind of work predictably fail, and what professional controls should therefore govern it?

A fully shaped Professional Work Unit should therefore define:

1. the target artifact;
2. the intended transformation;
3. the invariants that must survive;
4. the known failure dynamics;
5. the required evidence;
6. the appropriate inspection methods;
7. the validators;
8. the remediation pathways;
9. the convergence criteria;
10. the tactic-change and escalation conditions.

This makes professional failure knowledge part of the shape of the work itself.

The work is not fully specified merely because the desired output is known.

A complete work specification also includes the known ways the work can become deceptively wrong.

---

# 13. Relationship to Prompt, Context, Harness, and Loop Engineering

The Professional Wisdom Compiler spans the entire agent engineering stack.

## Prompt Engineering

Compiled constitutions and obligations influence immediate agent behavior.

The question is:

> What instructions should guide this act of reasoning or production?

## Context Engineering

The compiler determines which professional knowledge, prior artifacts, evidence, and constraints must be available.

The question is:

> What must the agent know to perform and judge this work?

## Harness Engineering

Validators, evidence retrieval, permissions, provenance, artifact graphs, state persistence, and enforcement mechanisms operationalize the controls.

The question is:

> What machinery ensures the professional controls can actually execute?

## Loop Engineering

Findings, remediation, retry, tactic changes, convergence, and escalation govern temporal behavior.

The question is:

> What happens after the system discovers that the work may be wrong?

## Shape Engineering

The compiler defines the professional structure of the work and its failure envelope.

The question is:

> What is being produced, what must remain true, and how can this class of work fail?

The compiler therefore acts as a bridge between accumulated professional knowledge and the full agent engineering stack.

---

# 14. From Static Validators to Adaptive Control

A mature implementation should not treat validators as a fixed checklist executed after every phase.

The applicable control set should depend on risk and context.

A small internal refactoring may require:

* compatibility analysis;
* tests;
* scope validation.

A public API change may additionally require:

* Hyrum-derived dependency analysis;
* migration analysis;
* versioning review;
* consumer evidence;
* escalation.

A security-sensitive feature may activate:

* threat modeling;
* abuse-case analysis;
* boundary validation;
* privilege review;
* adversarial testing.

This requires a **control planner**.

The control planner determines:

* which professional wisdom applies;
* which validators should run;
* in what sequence;
* at what depth;
* with what evidence;
* and at what cost.

This makes the Professional Wisdom Compiler analogous not merely to a source-code compiler but to a compiler plus runtime.

The compiler produces the available controls.

The runtime determines when and how to execute them.

---

# 15. Convergence, Tactic Change, and Escalation

A major failure mode of agentic validation systems is endless static critique.

The producer acts.

The validator criticizes.

The producer revises.

The validator criticizes again.

Nothing determines whether the loop is making meaningful progress.

The Professional Wisdom Compiler should therefore generate loop controls alongside artifact controls.

Possible convergence signals include:

* declining weighted defect severity;
* increasing evidence coverage;
* stable resolution of prior findings;
* absence of newly introduced critical defects;
* increasing agreement among independent validators.

Possible stagnation signals include:

* recurrence of the same failure class;
* oscillation between incompatible remediations;
* increasing change volume without quality improvement;
* repeated unsupported assumptions;
* validator disagreement that does not narrow;
* declining marginal improvement.

Possible tactic changes include:

* broaden the search space;
* retrieve new evidence;
* invoke a different professional role;
* generate competing hypotheses;
* replace the implementation strategy;
* revisit upstream artifacts;
* reduce scope;
* run a counterexample search;
* request human judgment.

Escalation should occur when:

* authority is required;
* evidence is unavailable;
* professional principles remain irreconcilable;
* risk exceeds autonomous authority;
* uncertainty remains above the permitted threshold;
* repeated tactic changes fail to restore convergence.

This transforms validators from critics into components of a controlled professional reasoning system.

---

# 16. Learning from Outcomes

The system should not assume that published professional wisdom is complete.

Every execution can generate new evidence.

The runtime should capture:

* which controls fired;
* what evidence triggered them;
* whether findings were accepted;
* what remediation occurred;
* whether the problem recurred;
* whether downstream failures occurred despite validation;
* whether validators repeatedly produced false alarms.

This supports the discovery of local professional wisdom.

For example:

> Changes to identity fields in deeply decomposed requirement trees repeatedly produce downstream reference corruption when smaller models are used.

This may begin as an incident pattern.

It can then become:

* a candidate failure mode;
* an empirical regularity;
* an invariant;
* an identity-preservation validator;
* a runtime control.

The system therefore develops institutional memory.

Human organizations often lose lessons when people leave.

An executable professional wisdom system can preserve them as active controls.

---

# 17. Governance and Risks

The Professional Wisdom Compiler introduces significant risks of its own.

## 17.1 Bureaucratic overcompilation

Too many controls can make work impossible.

Every control has cost.

The system must optimize assurance proportionately to consequence.

## 17.2 False authority

A compiled heuristic may appear more authoritative because it has been formalized.

The system must preserve epistemic status and provenance.

## 17.3 Validator monoculture

If all validators share the same model, assumptions, and evidence, apparent independence may be illusory.

Diversity must be structural, not merely nominal.

## 17.4 Goodharting the validators

Agents may learn to produce artifacts that satisfy validator-visible proxies without satisfying underlying intent.

Validators themselves therefore require proxy-integrity review.

## 17.5 Frozen professional wisdom

Established doctrine can become obsolete.

Controls require versioning, challenge, and retirement.

## 17.6 Conflicting wisdom

Professional principles frequently conflict.

The system must expose tradeoffs rather than hiding them.

## 17.7 Overconfidence from compliance

Passing all validators does not prove correctness.

The system should communicate residual uncertainty.

These are not reasons to reject the concept.

They are reasons why the compiler itself must be governed by professional wisdom.

---

# 18. Initial Implementation Strategy

A practical implementation should begin narrowly.

## Phase 1: Manually compile one domain

Start with coding.

Select approximately 50 to 75 sources of professional wisdom.

Normalize them into a smaller set of recurrent failure dynamics.

Compile those into:

* a concise coding constitution;
* a failure ontology;
* 10 to 15 validators;
* standardized finding schemas;
* remediation policies.

The goal is not full automation.

The goal is to validate the compilation model.

## Phase 2: Compile a second artifact domain

Requirements engineering is the strongest candidate.

This tests whether the intermediate representation generalizes beyond code.

Special attention should be paid to:

* intrinsic validation;
* derivation validation;
* systemic validation.

## Phase 3: Add user journeys

User journey generation introduces less formally codified professional knowledge and therefore tests the system's ability to compile softer forms of wisdom.

## Phase 4: Build the Professional Wisdom IR

Represent compiled knowledge as versioned, queryable artifacts.

## Phase 5: Build the control planner

Dynamically select validators based on:

* phase;
* artifact type;
* risk;
* change scope;
* prior findings;
* uncertainty.

## Phase 6: Add runtime learning

Capture outcomes and propose new local wisdom units.

Human approval should initially be required before new wisdom becomes authoritative.

---

# 19. Evaluation

The Professional Wisdom Compiler should be evaluated against more than output quality.

Relevant measures include:

## Defect interception

Does the system catch consequential failures before downstream execution?

## Derivation fidelity

Does it prevent high-quality but unjustified artifacts?

## Recurrence reduction

Do previously observed failure classes become less frequent?

## Validator precision

How often do findings correspond to meaningful defects?

## Validator recall

Which consequential failures escaped all controls?

## Remediation effectiveness

Do proposed corrections actually reduce risk?

## Convergence efficiency

How many cycles are required before acceptable completion?

## Escalation quality

Does the system escalate the right problems at the right time?

## Control cost

How much latency and compute does assurance add?

## Professional trust

Do domain experts find the findings legitimate, useful, and appropriately calibrated?

The ultimate measure is not:

> Did the agent comply with the rules?

It is:

> Did accumulated professional knowledge measurably improve the reliability of professional work?

---

# 20. Strategic Significance

The Professional Wisdom Compiler suggests a different trajectory for enterprise agent systems.

The prevailing model is:

**Better model → better prompt → more tools → better output**

The proposed model is:

**Professional knowledge → executable controls → governed work → evidence-backed trust**

This matters because frontier models will continue to improve.

As raw generation capability becomes more widely available, differentiation moves toward:

* domain-specific professional knowledge;
* organizational memory;
* assurance;
* provenance;
* control;
* reliable execution.

An enterprise may possess decades of:

* engineering lessons;
* incident reports;
* legal interpretations;
* review practices;
* operational doctrine;
* quality standards;
* exception handling;
* tacit expertise.

Today, much of that knowledge is difficult to operationalize consistently even among humans.

A Professional Wisdom Compiler creates the possibility that organizational knowledge can become executable.

A lesson learned from one failure can become a control applied to future work.

A senior expert's review method can become an inspection procedure.

A regulatory obligation can become an invariant.

An anti-pattern can become a validator.

An incident can become a new failure mode.

The result is not simply an agent that knows more.

It is an organization whose accumulated professional judgment becomes part of the runtime architecture of its work.

---

# 21. Conclusion

Agentic systems have largely been built around the question:

> How can we make the agent more capable of performing the work?

The next question is:

> How can we make accumulated professional wisdom operationally govern the work?

Human professions have already discovered many of the ways complex work fails. That knowledge is encoded in laws, principles, heuristics, standards, anti-patterns, smells, biases, incident reports, review practices, and expert judgment.

The opportunity is to stop treating that knowledge merely as material for reading or prompting.

It can be compiled.

A Professional Wisdom Compiler transforms:

**what professionals have learned**

into:

**what agentic systems can execute**

through:

* constitutions that govern behavior;
* invariants that preserve meaning;
* quality models that define good artifacts;
* failure ontologies that identify predictable hazards;
* evidence requirements that constrain confidence;
* inspection methods that structure inquiry;
* validators that search for known failure;
* control loops that drive remediation;
* tactic-change policies that prevent stagnation;
* escalation rules that recognize the limits of autonomy.

The resulting architecture is not a better prompt.

It is a professional control system.

Its central premise is:

> The accumulated wisdom of a profession should not merely inform an agent. It should shape the work, constrain the transformation, challenge the output, govern the correction loop, and determine what evidence is required before the result is trusted.

That is the foundation for a compiler from accumulated professional wisdom into executable control structures for agentic work.


## Implementation Roadmap: JanumiCode Validation Convergence System

The roadmap should **not** begin with “add a new validator architecture.” It should begin with:

> **Reconcile the proposed validator-convergence model with the actual JanumiCode codebase as implemented today.**

That matters because JanumiCode already has many adjacent mechanisms: Reasoning Review, Verification Ensemble, deterministic Invariant Checks, Loop Detection, Phase Gates, quarantine behavior, warning acknowledgment, JSON repair, scope gatekeeping, and audit pauses. The convergence system should **formalize and compose what already exists first**, then add missing abstractions only where the current implementation cannot support the needed behavior.

The v2.3 spec already says each artifact-producing Sub-Phase has its own Agent Invocation, Context Payload, Execution Trace capture, Invariant Check before Reasoning Review, Reasoning Review, and Governed Stream recording. It also defines the Governed Stream as the lossless system of record for artifacts, tool calls, tool results, decisions, memory, and execution traces.  

---

# Roadmap principle

The implementation should follow this rule:

> **Do not introduce a new convergence subsystem until the existing validation, repair, gate, and stream mechanisms have been mapped, reused, or deliberately superseded.**

So the work proceeds in three layers:

```text
Layer 1 — Reconcile with current implementation
Layer 2 — Normalize existing validators into a common Finding model
Layer 3 — Add convergence, repair tracking, and targeted revalidation
```

---

# Phase 0 — Current Implementation Reconciliation

## Objective

Create a precise map of how JanumiCode currently performs validation, repair, retry, gatekeeping, and human escalation.

This is the most important phase.

## Why this comes first

The current implementation already appears to have meaningful validation infrastructure. The README describes a state machine/orchestrator, Verifier role, MAKER Task Engine, human gates, and gate resolutions such as `APPROVE`, `REJECT`, `OVERRIDE`, and `REFRAME`.  The run harness also shows existing operational controls for `reasoning_review`, Stage III ingestion, audit pause, scope gatekeeper, JSON repair records, LLM failure/recovery records, deterministic verifiers, and coverage verification. 

So the first task is not implementation. It is **implementation archaeology**.

## Required audit targets

Inspect the actual codebase for:

```text
OrchestratorEngine
StateMachine
ContextBuilder
TemplateLoader
AgentInvoker
LLMCaller
InvariantChecker
ReasoningReview runner
VerificationEnsemble runner
LoopDetectionMonitor
ScopeGatekeeper
JSON repair mechanism
MAKER bounds repair mechanism
PhaseGate evaluator
GovernedStreamWriter
Governed Stream schema/migrations
Prompt template execution flow
Thin-slice harness
Audit pause implementation
Human gate UI flow
```

## Deliverables

1. **Current Validation Flow Map**

```text
Sub-Phase starts
→ Context built
→ Agent invoked
→ Artifact recorded
→ JSON repair?
→ Invariant checks?
→ Reasoning Review?
→ Verification Ensemble?
→ Scope gatekeeper?
→ Audit pause?
→ Human gate?
→ Retry / repair / abort?
```

2. **Existing Record Inventory**

Classify existing records into:

```text
Already usable for convergence
Needs extension
Should remain separate
Should be deprecated
```

The v2.3 schema list already includes records such as `reasoning_review_record`, `domain_compliance_review_record`, `loop_detection_record`, `verification_ensemble_disagreement`, `warning_acknowledged`, `quarantine_override`, `json_repair_record`, `llm_api_failure`, and `llm_api_recovery`. 

3. **Gap Register**

Example rows:

| Capability            |     Current support | Gap                                                        | Recommendation                             |
| --------------------- | ------------------: | ---------------------------------------------------------- | ------------------------------------------ |
| Validator findings    |             Partial | Findings are not normalized across validator types         | Add canonical `validator_finding_record`   |
| Repair tracking       |             Partial | Repair attempts may not be explicitly linked to findings   | Add `repair_event`                         |
| Convergence           | Missing or informal | No durable proof that all findings were resolved           | Add `validation_convergence_record`        |
| Targeted revalidation |             Partial | Existing retries may not select validators by diff surface | Add impact matrix                          |
| Validator canaries    |             Missing | No validator-system self-test                              | Add meta-validation later                  |
| Gate health           |             Missing | Human gate telemetry not interpreted                       | Add non-blocking gate health records later |

## Exit criteria

Do not proceed until this exists:

```text
A. Actual code paths documented
B. Existing validation records mapped
C. Existing retry/repair mechanisms understood
D. Minimal schema additions identified
E. No duplicated subsystem proposed where existing code can be extended
```

---

# Phase 1 — Define the Canonical Finding Model

## Objective

Normalize every validator, verifier, invariant check, scope gatekeeper, repair check, and LLM review output into a common **Finding** abstraction.

## Recommendation

Add a canonical record:

```text
validator_finding_record
```

But do **not** immediately force every existing record to disappear. Instead, introduce it as a normalized projection layer.

Existing records can remain source records:

```text
reasoning_review_record
domain_compliance_review_record
invariant_violation
verification_ensemble_disagreement
json_repair_record
scope_gatekeeper_result
coverage_verifier_result
```

The new `validator_finding_record` becomes the common operational object.

## Minimal schema

```json
{
  "record_type": "validator_finding_record",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "...",
  "stage": "POST_GENERATION",
  "validator_id": "...",
  "validator_family": "...",
  "source_record_id": "...",
  "target_type": "Artifact | GenerationContext | RepairEvent | Gate | ValidatorSystem",
  "target_record_id": "...",
  "severity": "INFO | WARN | BLOCK | CRITICAL",
  "failure_mode": "...",
  "summary": "...",
  "evidence": [],
  "recommended_action": "...",
  "status": "OPEN"
}
```

This implements the feedback’s widened target model: findings should be able to indict not only artifacts, but also the generation process, validator system, repair process, or gate. 

## Remediation likely needed

If current validators emit incompatible shapes, add adapters:

```text
ReasoningReviewFindingAdapter
InvariantViolationFindingAdapter
VerificationEnsembleFindingAdapter
ScopeGatekeeperFindingAdapter
JsonRepairFindingAdapter
HumanGateFindingAdapter
```

Do not rewrite validators yet. Wrap them.

---

# Phase 2 — Introduce Stage Binding Without Rewriting Phase Logic

## Objective

Add the concept of **generation lifecycle stage** alongside JanumiCode’s existing phase/sub-phase model.

## Why

Phase binding answers:

> Where are we in JanumiCode’s workflow?

Stage binding answers:

> Where are we in the generation lifecycle?

The feedback correctly identifies stages such as `PRE_GENERATION`, `POST_GENERATION`, `POST_VALIDATION`, `POST_REPAIR`, `PRE_GATE`, `POST_GATE`, and `CONTINUOUS`. 

## Implementation approach

Do not alter the phase engine first. Add stage as metadata to validation events.

```ts
type ValidationStage =
  | "PRE_GENERATION"
  | "POST_GENERATION"
  | "POST_VALIDATION"
  | "POST_REPAIR"
  | "PRE_GATE"
  | "POST_GATE"
  | "CONTINUOUS";
```

## Initial stage bindings

| Stage             | Existing JanumiCode hook to reconcile with                       |
| ----------------- | ---------------------------------------------------------------- |
| `PRE_GENERATION`  | `ContextBuilder`, `TemplateLoader`, required variable validation |
| `POST_GENERATION` | artifact parse, JSON repair, schema validation, Invariant Check  |
| `POST_VALIDATION` | Reasoning Review, Verification Ensemble, scope gatekeeper        |
| `POST_REPAIR`     | retry/repair loop, JSON repair, MAKER bounds repair              |
| `PRE_GATE`        | Phase Gate evaluation                                            |
| `POST_GATE`       | human decision records                                           |
| `CONTINUOUS`      | loop detection, telemetry, harness analytics                     |

## Exit criteria

Every validation event can answer:

```text
phase_id
sub_phase_id
stage
target_record_id
validator_id
source_record_id
```

---

# Phase 3 — Add the Validation Convergence Controller Skeleton

## Objective

Introduce a controller that can track whether validator findings are resolved, but initially only in **observe mode**.

## Why observe mode first

JanumiCode already has active validation and retry behavior. Dropping a blocking convergence controller into the middle could destabilize the workflow.

Start by recording convergence state without enforcing it.

## New component

```text
ValidationConvergenceController
```

Initial responsibilities:

```text
1. Collect normalized findings for a target artifact.
2. Group findings by severity and failure mode.
3. Track whether subsequent records appear to address them.
4. Produce a convergence summary.
5. Do not block phase progression yet.
```

## Initial output record

```text
validation_convergence_record
```

Example:

```json
{
  "record_type": "validation_convergence_record",
  "schema_version": "0.1",
  "workflow_run_id": "...",
  "phase_id": "phase_04_architecture",
  "sub_phase_id": "04_2_architecture_definition",
  "target_artifact_record_id": "...",
  "mode": "observe_only",
  "convergence_status": "UNKNOWN | CLEAN | UNRESOLVED | PARTIAL | DIVERGING",
  "open_findings": [],
  "resolved_findings": [],
  "unaccounted_findings": [],
  "new_findings_after_repair": [],
  "repair_iterations": 0,
  "would_block_gate": false
}
```

## Remediation likely needed

If current validators do not expose stable finding IDs, add deterministic IDs:

```text
finding_id = hash(workflow_run_id, phase_id, sub_phase_id, validator_id, target_id, failure_mode, normalized_evidence_pointer)
```

This prevents findings from “disappearing” across retries because the text changed slightly.

---

# Phase 4 — Formalize Repair Events

## Objective

Make repairs durable, inspectable, and linked to findings.

The feedback’s `RepairEvent` concept is essential because it makes repair regression tractable by linking the triggering finding, pre-repair hash, post-repair hash, diff scope, and revalidation set. 

## New record

```text
repair_event
```

Minimal schema:

```json
{
  "record_type": "repair_event",
  "schema_version": "1.0",
  "workflow_run_id": "...",
  "phase_id": "...",
  "sub_phase_id": "...",
  "stage": "POST_REPAIR",
  "triggering_finding_ids": [],
  "repair_strategy": "LOCAL_EDIT | STRUCTURAL_EDIT | REPRESENTATION_REVISION | CONTEXT_REASSEMBLY | RE_RETRIEVE | IDENTITY_RECONCILIATION | HUMAN_DECISION_REQUIRED | ROLLBACK_REPAIR",
  "pre_repair_artifact_record_id": "...",
  "post_repair_artifact_record_id": "...",
  "pre_repair_artifact_hash": "...",
  "post_repair_artifact_hash": "...",
  "diff_scope": {},
  "revalidation_set": [],
  "repair_notes": "..."
}
```

## Integration points

Map existing behavior into `repair_event`:

| Current behavior                   | Repair event mapping                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| JSON repair                        | `LOCAL_EDIT` or `STRUCTURAL_EDIT`                             |
| Retry after Reasoning Review flaw  | `LOCAL_EDIT`, `STRUCTURAL_EDIT`, or `REPRESENTATION_REVISION` |
| Context missing required variables | `CONTEXT_REASSEMBLY`                                          |
| Stale retrieval                    | `RE_RETRIEVE`                                                 |
| MAKER bounds repair                | likely `STRUCTURAL_EDIT` or `HUMAN_DECISION_REQUIRED`         |
| Human reframe                      | `HUMAN_DECISION_REQUIRED` followed by new artifact lineage    |
| Rollback                           | `ROLLBACK_REPAIR`                                             |

## Exit criteria

Every nontrivial retry or repair has:

```text
triggering finding
repair strategy
before/after artifact identity
diff scope
revalidation set
```

---

# Phase 5 — Targeted Revalidation Matrix

## Objective

After a repair, JanumiCode should rerun the validators whose inspection surface intersects the repair.

## Why

Running every validator every time is expensive. Running too few validators misses regressions.

## Add a validator impact matrix

```json
{
  "identity_fields_changed": [
    "entity_existence_validator",
    "identifier_fidelity_validator",
    "reference_integrity_validator",
    "parent_child_integrity_validator",
    "semantic_identity_continuity_validator"
  ],
  "requirement_text_changed": [
    "intent_to_requirement_traceability_validator",
    "requirement_testability_validator",
    "conflict_validator",
    "acceptance_criteria_validator"
  ],
  "architecture_component_changed": [
    "component_responsibility_validator",
    "dependency_direction_validator",
    "architecture_consistency_validator",
    "representation_adequacy_validator"
  ],
  "technical_spec_api_changed": [
    "api_surface_validator",
    "interface_contract_validator",
    "version_currency_validator",
    "package_existence_validator"
  ],
  "test_plan_changed": [
    "acceptance_coverage_validator",
    "negative_case_coverage_validator",
    "test_oracle_validator",
    "regression_coverage_validator"
  ]
}
```

## Non-negotiable rule

Any repair that changes identifiers, parent-child relationships, references, trace links, or entity semantics must rerun the **full Entity Integrity family**.

This directly addresses the smaller-model identifier drift issue you noticed.

## Remediation likely needed

If artifacts are not currently diffed structurally, add a JSON-path diff layer:

```text
ArtifactDiffService
├── changed_json_paths
├── changed_entity_ids
├── changed_reference_edges
├── changed_semantic_fields
└── changed_governing_fields
```

---

# Phase 6 — Enforce Convergence Before Phase Gates

## Objective

Move from observe mode to enforce mode.

## Gate invariant

A phase or sub-phase cannot proceed to the human Phase Gate unless:

```text
1. No unresolved CRITICAL finding exists.
2. No unresolved BLOCK finding exists.
3. WARN findings are resolved, accepted, or explicitly deferred.
4. No repair introduced a new BLOCK or CRITICAL finding.
5. Required deterministic checks pass.
6. Entity registry remains consistent.
7. Traceability links remain valid.
8. The artifact satisfies schema and invariant checks.
9. Validator disagreements requiring human judgment are surfaced.
```

## Important human-authority preservation

Gate Health validators should not block human decisions. The feedback is right: a system that blocks its human overseer for reviewing “too fast” inverts the authority hierarchy. Gate Health should emit telemetry and review flags, not hard blocks. 

## Phase Gate evidence package

Add convergence evidence to the human gate UI:

```text
Phase Gate Evidence
├── Current artifact
├── Validator finding summary
├── Resolved findings
├── Accepted/deferred warnings
├── Repair events
├── Revalidation results
├── Remaining human-judgment items
└── Convergence status
```

---

# Phase 7 — Add Root-Cause and Representation Repair Policies

## Objective

Prevent superficial fixes such as regex-only patches for semantic identity failures.

## Add a policy table

```text
FailureMode → AllowedRepairStrategies
```

Example:

| Failure mode                  | Disallowed shallow repair | Required repair                                  |
| ----------------------------- | ------------------------- | ------------------------------------------------ |
| Referential Integrity Failure | Regex-only normalization  | Identity registry, alias mapping, reconciliation |
| Representation Failure        | Local wording patch       | Representation revision                          |
| Context Failure               | Regenerate artifact       | Reassemble context                               |
| Stale Retrieval               | Patch artifact            | Re-retrieve and re-evaluate                      |
| Numeric Infidelity            | Regenerate number         | Deterministic recomputation                      |
| Goodhart Pressure             | Satisfy validator text    | Rotate judge, holdout refresh, widen rubric      |
| Human Judgment Boundary       | Agent decides             | Human menu or reframe                            |

## New validators to prioritize

```text
Root-Cause Adequacy Validator
Representation Adequacy Validator
Repair Scope Validator
Finding Resolution Validator
Goodhart Pressure Validator
```

## Implementation note

These should not all be model calls at first.

Start with hybrid checks:

```text
deterministic failure-mode routing
+ rule-based repair strategy constraints
+ LLM validator only when semantic judgment is needed
```

---

# Phase 8 — Entity Registry and Identity Convergence

## Objective

Fix identifier drift systematically.

## Recommendation

Implement a governed entity registry for phase artifacts:

```text
Entity Registry
├── canonical_entity_id
├── entity_type
├── canonical_label
├── aliases
├── parent_entity_id
├── source_artifact_id
├── created_in_phase
├── current_definition_hash
├── semantic_summary
├── superseded_by
└── status
```

## Identity resolution hierarchy

```text
1. Exact canonical ID match
2. Deterministic alias table match
3. Normalized lexical match
4. Embedding candidate retrieval
5. LLM semantic equivalence judge
6. Human escalation
```

## Where to integrate

Start with requirements trees in Phase 2, then extend to:

```text
System Requirements
Interface Contracts
Components
Component Responsibilities
ADRs
Technical Specifications
Implementation Tasks
Test Cases
Evaluation Criteria
```

## Convergence-specific rule

A repaired artifact cannot converge if it references:

```text
missing entities
duplicate identities
ambiguous identities
orphaned child nodes
collided identifiers
silently mutated entity meanings
```

---

# Phase 9 — Process Validators

## Objective

Add validators that inspect the generation process itself, not only artifacts.

## Priority order

Do not implement the full Process Validator branch at once. Start with the highest-leverage validators:

```text
1. Context Sufficiency Validator
2. Registry Inclusion Validator
3. Provenance Tagging Validator
4. Injection Screening Validator
5. Completion / Parse Validator
6. Repair Regression Validator
7. Finding Resolution Validator
8. Validator Context Isolation Validator
```

## Why these first

These are most likely to catch failures before expensive downstream reasoning:

```text
bad context
missing registry
untrusted instruction leakage
malformed output
bad repair
validator-rubric leakage
```

The v2.3 spec already contains a strong context assembly design: a stdin directive channel plus detail file, with a hard guarantee that governing constraints cannot be silently truncated.  Process validators should build on that rather than replace it.

---

# Phase 10 — Meta-Validation and Canary Injection

## Objective

Validate the validators.

## Add canary tests

Create known-good artifacts, deterministically corrupt them, and verify that the validator ensemble catches the corruption.

Examples:

```text
Break a requirement ID
Orphan a child requirement
Invert an acceptance criterion
Delete a traceability link
Invent a nonexistent API
Use a stale package version
Inject instruction-bearing content into retrieved context
```

## Canary rule

If a canary passes undetected, the finding is against the validator system:

```text
target_type: ValidatorSystem
severity: CRITICAL
recommended_action: SuspendValidator | RotateJudge | RefreshRubric
```

## Start in the harness

The current harness is already designed for thin-slice testing and prompt iteration, with reasoning review and audit-pause toggles.  Extend that harness before integrating canaries into normal workflow execution.

---

# Phase 11 — UI and Human Review Integration

## Objective

Expose convergence without overwhelming the user.

## Add UI cards

```text
Validator Finding Card
Repair Event Card
Convergence Summary Card
Unresolved Finding Card
Human Judgment Required Card
Gate Health Telemetry Card
Validator System Health Card
```

## Human gate actions

Use the existing gate resolution vocabulary where possible:

```text
APPROVE
REJECT
OVERRIDE
REFRAME
```

But add convergence-specific meanings:

| Human action | Meaning                                  |
| ------------ | ---------------------------------------- |
| `APPROVE`    | Accept artifact and resolved finding set |
| `REJECT`     | Reject artifact or repair                |
| `OVERRIDE`   | Accept known residual risk               |
| `REFRAME`    | Change governing intent/scope/constraint |

## Important rule

Human override should not erase findings. It should create:

```text
human_risk_acceptance_record
```

or extend the existing warning/quarantine override records if those already fit.

---

# Phase 12 — Turn on Enforcement Gradually

## Objective

Avoid destabilizing JanumiCode by enforcing every validator at once.

## Recommended rollout

| Release | Enforcement level                          |
| ------- | ------------------------------------------ |
| R1      | Observe-only convergence records           |
| R2      | Enforce CRITICAL only                      |
| R3      | Enforce CRITICAL + deterministic BLOCK     |
| R4      | Enforce all BLOCK findings                 |
| R5      | Require explicit WARN defer/acceptance     |
| R6      | Add canary-based validator health blocking |
| R7      | Add severity profiles by workflow/domain   |

## Severity profiles

Adopt the feedback’s idea that severity should be configurable by profile. JanumiCode and JanumiLegal may share the ontology but differ in severity mappings. 

Example:

```json
{
  "severity_profile": "janumicode_default",
  "overrides": {
    "package_existence_validator": "CRITICAL",
    "gate_latency_validator": "INFO",
    "closed_world_boundary_validator": "BLOCK"
  }
}
```

---

# Recommended implementation sequence

The actual implementation order should be:

```text
1. Codebase reconciliation audit
2. Current validation flow map
3. Existing record inventory
4. Canonical finding adapter layer
5. Stage metadata
6. Observe-only convergence records
7. Repair event records
8. Targeted revalidation matrix
9. Enforced convergence before Phase Gates
10. Entity registry / identity convergence
11. Process validators
12. Canary injection
13. UI integration
14. Severity profiles
```

---

# Initial implementation backlog

## Epic 1 — Reconciliation and gap analysis

```text
Task 1.1: Inventory current validation-related classes and files.
Task 1.2: Map current Sub-Phase execution flow from context assembly to Phase Gate.
Task 1.3: Inventory all validation, repair, retry, gate, and quarantine records.
Task 1.4: Identify duplicate or overlapping mechanisms.
Task 1.5: Produce Current-State Validation Architecture document.
Task 1.6: Produce Gap Register and Remediation Plan.
```

## Epic 2 — Finding normalization

```text
Task 2.1: Define validator_finding_record schema.
Task 2.2: Add migration for finding records.
Task 2.3: Build ReasoningReviewFindingAdapter.
Task 2.4: Build InvariantFindingAdapter.
Task 2.5: Build VerificationEnsembleFindingAdapter.
Task 2.6: Build ScopeGatekeeperFindingAdapter.
Task 2.7: Store normalized findings in Governed Stream.
```

## Epic 3 — Convergence observe mode

```text
Task 3.1: Add ValidationConvergenceController shell.
Task 3.2: Add validation_convergence_record schema.
Task 3.3: Collect findings per artifact.
Task 3.4: Compute unresolved/resolved/unknown status.
Task 3.5: Emit observe-only convergence records.
Task 3.6: Add harness reporting for convergence summaries.
```

## Epic 4 — Repair events

```text
Task 4.1: Define repair_event schema.
Task 4.2: Add repair event writer.
Task 4.3: Wrap JSON repair with repair_event generation.
Task 4.4: Wrap retry/regeneration with repair_event generation.
Task 4.5: Link repair events to triggering findings.
Task 4.6: Compute artifact before/after hashes.
```

## Epic 5 — Targeted revalidation

```text
Task 5.1: Add ArtifactDiffService.
Task 5.2: Add validator impact matrix config.
Task 5.3: Select revalidation set from diff scope.
Task 5.4: Always rerun Entity Integrity family on identity/reference diffs.
Task 5.5: Record revalidation results.
```

## Epic 6 — Enforcement

```text
Task 6.1: Add convergence precondition to PhaseGateEvaluator.
Task 6.2: Enforce unresolved CRITICAL findings.
Task 6.3: Enforce deterministic BLOCK findings.
Task 6.4: Add human override path for residual risk.
Task 6.5: Add convergence evidence to Phase Gate UI.
```

## Epic 7 — Identity integrity

```text
Task 7.1: Define entity_registry schema.
Task 7.2: Register Phase 2 requirements as canonical entities.
Task 7.3: Add alias table.
Task 7.4: Add reference integrity checks.
Task 7.5: Add semantic identity reconciliation validator.
Task 7.6: Add human escalation for ambiguous identity resolution.
```

## Epic 8 — Process validation

```text
Task 8.1: Add GenerationContext record or projection.
Task 8.2: Add Context Sufficiency Validator.
Task 8.3: Add Registry Inclusion Validator.
Task 8.4: Add Provenance Tagging Validator.
Task 8.5: Add Injection Screening Validator.
Task 8.6: Add Validator Context Isolation Validator.
```

## Epic 9 — Meta-validation

```text
Task 9.1: Add canary artifact generator.
Task 9.2: Add deterministic corruption library.
Task 9.3: Run canaries in thin-slice harness.
Task 9.4: Emit validator_system finding when canary passes undetected.
Task 9.5: Add validator health dashboard.
```

---

# Near-term MVP cut

The smallest useful implementation is:

```text
1. Canonical validator_finding_record
2. Finding adapters for existing validators
3. validation_convergence_record in observe mode
4. repair_event for JSON repair and retry/regeneration
5. pre-gate convergence summary
6. harness report showing unresolved findings
```

That gives you value before enforcing anything.

The first enforcement cut should be:

```text
Unresolved CRITICAL findings block Phase Gate eligibility.
```

The second enforcement cut should be:

```text
Deterministic BLOCK findings block Phase Gate eligibility.
```

Only after that should LLM-judge BLOCK findings become hard blockers.

---

# The most important remediation recommendation

The current system appears to already have validators, reviews, repairs, and gates. The risk is not that JanumiCode lacks validation. The risk is that validation outcomes are not yet treated as durable obligations.

So the key remediation is:

> **Convert validator output from transient advice into governed obligations with lifecycle state.**

That lifecycle should be:

```text
OPEN
→ ASSIGNED_TO_REPAIR_PLAN
→ REPAIR_ATTEMPTED
→ REVALIDATION_PENDING
→ RESOLVED
```

or one of:

```text
HUMAN_ACCEPTED_RISK
DEFERRED_WITH_RATIONALE
SUPERSEDED_BY_STRONGER_FINDING
ESCALATED_TO_HUMAN
ROLLBACK_REQUIRED
```

No validator finding should disappear merely because the artifact was regenerated.

That is the core implementation move.
