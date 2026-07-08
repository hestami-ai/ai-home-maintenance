# Operational Concept and Employment Model Guide for Commercial System Design

## Purpose

This guide defines how to translate an initial product, business, or capability intent into a structured description of:

1. the future operational reality the system is intended to create;
2. the way the capability will be employed within that reality;
3. the perspectives and experiences of individual actors;
4. the coordinated workflows that realize those experiences; and
5. the requirements needed to implement the system.

The purpose is to prevent premature decomposition from high-level intent directly into personas, user journeys, user stories, features, or requirements.

A User Journey is not a complete operational model. It is one actor-centered projection of a larger system.

The required conceptual sequence is:

```text
Intent
  ↓
Operational Concept
  ↓
Employment Model
  ↓
Actor-Centered and System-Centered Views
  ↓
Requirements
  ↓
Architecture and Implementation
```

The terms **Operational Concept** and **Employment Model** are used as commercial equivalents of the conceptual territory addressed by CONOPS and CONEMP in defense and systems engineering.

They should not be treated as rigid copies of military documentation practices. Their purpose is to recover a level of operational reasoning that commercial product development frequently distributes across product vision, customer journeys, service blueprints, business process models, operating models, and requirements.

---

# 1. The Core Distinction

## 1.1 Operational Concept

The Operational Concept answers:

> What will the operational world look like when this capability exists and is being used successfully?

It describes the intended future operational reality.

It identifies:

* the actors involved;
* the environment in which they operate;
* the problems, pressures, and situations they encounter;
* the outcomes they seek;
* the capabilities available to them;
* the information and artifacts that move through the system;
* the important relationships among actors and capabilities;
* the major operational states and situations;
* the boundaries of the system;
* the intended effects of introducing the capability; and
* what successful operation looks like.

The Operational Concept is broader than any single user's experience.

It should describe the system as an operational whole.

---

## 1.2 Employment Model

The Employment Model answers:

> How is the capability actually used to accomplish the intended outcomes within that operational world?

It describes the method of employment.

It identifies:

* who invokes a capability;
* under what conditions it is invoked;
* what information is required;
* what authority the actor possesses;
* what sequence or coordination occurs;
* what decisions must be made;
* what capabilities are selected;
* how work is delegated;
* how results are evaluated;
* how failures and exceptions are handled;
* how escalation occurs;
* how feedback changes subsequent action;
* how the system adapts when the normal path is insufficient; and
* how the capability terminates, completes, or transitions.

The Employment Model is therefore not merely a workflow.

A workflow describes a path.

An Employment Model describes the doctrine governing how paths, capabilities, actors, decisions, and adaptations are selected and coordinated.

---

# 2. The Commercial Artifact Stack

Use the following hierarchy.

```text
WHY DOES THIS EXIST?
        │
        ▼
      INTENT
        │
        ▼
WHAT FUTURE OPERATIONAL REALITY IS INTENDED?
        │
        ▼
 OPERATIONAL CONCEPT
        │
        ├── Actors
        ├── Environment
        ├── Situations
        ├── Outcomes
        ├── Capabilities
        ├── Information
        ├── Relationships
        └── Success conditions
        │
        ▼
HOW IS THE CAPABILITY EMPLOYED?
        │
        ▼
  EMPLOYMENT MODEL
        │
        ├── Triggers
        ├── Authority
        ├── Decisions
        ├── Capability selection
        ├── Coordination
        ├── Delegation
        ├── Validation
        ├── Feedback
        ├── Exceptions
        ├── Escalation
        └── Adaptation
        │
        ▼
WHAT VIEWS ARE NEEDED TO UNDERSTAND THE OPERATION?
        │
        ├────────────────┬─────────────────┐
        ▼                ▼                 ▼
     PERSONAS       USER JOURNEYS    SYSTEM SCENARIOS
        │                │                 │
        ├────────────────┼─────────────────┤
        ▼                ▼                 ▼
 SERVICE BLUEPRINTS   WORKFLOWS      DECISION MODELS
        │                │                 │
        └────────────────┴─────────────────┘
                         │
                         ▼
                   REQUIREMENTS
                         │
                         ▼
             ARCHITECTURE AND DESIGN
                         │
                         ▼
                  IMPLEMENTATION
```

The lower-level artifacts are not substitutes for the higher-level artifacts.

They are projections, decompositions, and formalizations of them.

---

# 3. Artifact Definitions

## 3.1 Intent

Intent defines why the capability should exist and what outcome or change is sought.

Intent should answer:

* What problem or opportunity motivates the system?
* Whose situation should change?
* What outcome is desired?
* What constraints or principles must be preserved?
* What must not be substituted for the stated intent?

Intent should not prematurely specify implementation.

---

## 3.2 Operational Concept

The Operational Concept defines the future operational reality.

Required elements include:

### Actors

Identify all meaningful participants, including:

* primary users;
* secondary users;
* professionals;
* customers;
* operators;
* administrators;
* external organizations;
* automated agents;
* AI models;
* validators;
* regulators;
* decision authorities; and
* affected non-users.

Do not assume that the person interacting with the interface is the only important actor.

### Environment

Describe:

* physical environment;
* organizational environment;
* technical environment;
* regulatory environment;
* temporal conditions;
* resource constraints;
* uncertainty;
* information availability; and
* relevant external systems.

### Operational Situations

Identify the major situations in which the capability matters.

Examples include:

* normal operation;
* incomplete information;
* conflicting evidence;
* time pressure;
* degraded capability;
* unavailable resources;
* disagreement among actors;
* failed validation;
* escalation;
* recovery; and
* termination.

### Outcomes

Describe desired operational effects rather than merely software outputs.

Weak:

> Generate a report.

Stronger:

> Enable the responsible professional to make a sufficiently informed decision while preserving the evidence, uncertainty, and rationale required for review.

### Capabilities

Describe what the operational system must be able to accomplish without prematurely assigning those capabilities to software components.

### Information and Artifacts

Identify what is created, consumed, transformed, validated, preserved, and transferred.

### Success Conditions

Describe observable conditions under which the operational concept can be considered successful.

---

## 3.3 Employment Model

For each major capability or operational situation, define how the capability is employed.

Use the following structure:

```text
Trigger
  ↓
Situation Assessment
  ↓
Authority and Responsibility Determination
  ↓
Capability Selection
  ↓
Execution / Delegation
  ↓
Observation
  ↓
Validation
  ↓
Decision
  ├── Continue
  ├── Revise
  ├── Retry
  ├── Escalate
  ├── Delegate
  ├── Recover
  └── Terminate
  ↓
Outcome and Memory Update
```

For each employment pattern, answer:

1. What triggers action?
2. Who or what recognizes the trigger?
3. What situational context is required?
4. Who has authority to act?
5. What capabilities are available?
6. How is the appropriate capability selected?
7. What work is performed directly?
8. What work is delegated?
9. What observations are produced?
10. How are outputs validated?
11. What determines whether progress is adequate?
12. What happens when validation fails?
13. What happens when repeated correction does not converge?
14. When is escalation required?
15. What information must persist for future action?
16. What constitutes completion?

---

# 4. User Journeys Are Derived Views

A User Journey answers:

> What does a particular actor do, experience, need, decide, and encounter over time?

A User Journey should be derived from the Operational Concept and Employment Model.

It should not independently define the system.

For every User Journey, identify:

* the actor whose perspective is represented;
* the operational situation;
* the desired outcome;
* the actor's goals;
* the actor's actions;
* the information available to the actor;
* the decisions the actor makes;
* the capabilities the actor invokes;
* the responses the actor receives;
* the uncertainties and failures encountered; and
* the journey's relationship to other actors and workflows.

A journey is a projection.

Multiple journeys may describe different perspectives on the same underlying operational event.

For example:

```text
ONE OPERATIONAL REALITY

        ┌── Patient Journey
        │
        ├── Clinician Journey
        │
        ├── Diagnostic Agent Journey
        │
        ├── Laboratory Journey
        │
        └── Care Coordinator Journey
```

These journeys must remain mutually consistent because they are views of the same operational system.

---

# 5. Service Blueprints Are Coordination Views

A Service Blueprint answers:

> What coordinated frontstage, backstage, and supporting activity is required to realize an actor's experience?

Typical layers include:

```text
Actor / Customer Actions
────────────────────────────────

Frontstage Interactions
────────────────────────────────

Backstage Human and Agent Work
────────────────────────────────

Supporting Processes
────────────────────────────────

Systems, Data, and Infrastructure
────────────────────────────────
```

A Service Blueprint should connect the User Journey to the operational machinery that enables it.

It should not replace the Employment Model.

The distinction is:

* the User Journey describes an actor's temporal experience;
* the Service Blueprint describes coordinated service delivery;
* the Employment Model describes how capabilities are selected and used under varying operational conditions.

---

# 6. Workflows Are Executable Decompositions

A Workflow answers:

> What sequence of states, actions, decisions, validations, and transitions performs a defined unit of work?

A workflow should be derived from an employment pattern.

Do not assume that one workflow represents the entire Employment Model.

The Employment Model may select among multiple workflows based on:

* situation;
* risk;
* uncertainty;
* authority;
* available resources;
* prior outcomes;
* validation results; and
* escalation state.

A workflow should define:

* entry conditions;
* required inputs;
* states;
* actions;
* decision points;
* validation points;
* legal transitions;
* illegal transitions;
* retry behavior;
* convergence criteria;
* escalation behavior;
* failure states;
* completion criteria; and
* resulting artifacts.

---

# 7. Decision Models Are First-Class Artifacts

Do not bury important decisions inside narrative prose or workflow arrows.

A Decision Model should define:

* the decision to be made;
* the responsible decision-maker;
* available evidence;
* uncertainty;
* applicable constraints;
* alternatives;
* decision criteria;
* authority limits;
* validation requirements;
* escalation thresholds; and
* required rationale.

This is especially important for systems involving professionals, AI agents, or high-consequence outcomes.

---

# 8. Recursive Professional Work

Professional work is rarely a single linear journey.

It is usually recursive.

A professional undertaking may contain:

```text
Professional Undertaking
        │
        ├── Professional Work Unit
        │       │
        │       ├── Sub-Work Unit
        │       │       ├── Sub-Work Unit
        │       │       └── Sub-Work Unit
        │       │
        │       └── Sub-Work Unit
        │
        └── Professional Work Unit
```

Examples include:

* a software project containing features, requirements, tasks, implementation changes, tests, and remediation;
* a legal matter containing issues, claims, research questions, discovery tasks, motions, and arguments;
* a patient case containing symptoms, diagnostic hypotheses, tests, interventions, and follow-up assessments.

Each Professional Work Unit may possess:

* intent;
* context;
* inputs;
* responsible actors;
* authority;
* capabilities;
* subtasks;
* dependencies;
* outputs;
* validators;
* feedback;
* convergence criteria;
* escalation rules;
* memory; and
* completion criteria.

The Operational Concept explains the professional system in which these units exist.

The Employment Model explains how actors create, select, execute, validate, revise, escalate, and complete them.

The Recursive Professional Harness coordinates this recursive structure.

---

# 9. Required Agent Reasoning Procedure

When given an initial product or capability concept, do not immediately generate personas, user stories, or requirements.

Proceed in this order.

## Step 1: Formalize Intent

Determine:

* the problem;
* the desired change;
* the intended beneficiaries;
* the constraints;
* the preserved principles; and
* unresolved ambiguities.

## Step 2: Construct the Operational Concept

Identify:

* actors;
* environment;
* operational situations;
* desired outcomes;
* capabilities;
* information;
* artifacts;
* relationships;
* boundaries; and
* success conditions.

## Step 3: Construct the Employment Model

For each major operational situation, identify:

* triggers;
* situation assessment;
* authority;
* capability selection;
* coordination;
* delegation;
* observation;
* validation;
* feedback;
* exceptions;
* escalation;
* adaptation; and
* completion.

## Step 4: Generate Derived Views

Produce only the views required to understand the system:

* personas;
* user journeys;
* system scenarios;
* service blueprints;
* workflow models;
* decision models; and
* recursive work structures.

## Step 5: Cross-Validate the Views

Verify that:

* every journey is supported by the Operational Concept;
* every workflow implements an employment pattern;
* every major operational actor is represented where necessary;
* parallel actor views do not contradict one another;
* important decisions have explicit decision models;
* exception and degraded modes are represented;
* authority is not silently assigned;
* AI agents are not granted capabilities or authority merely because they can technically perform an action; and
* every requirement can be traced to an operational need.

## Step 6: Derive Requirements

Only after the operational and employment models are sufficiently coherent should requirements decomposition begin.

---

# 10. Anti-Patterns

Do not perform the following substitutions:

```text
Product Vision ≠ Operational Concept

Persona ≠ Actor Model

User Journey ≠ Operational Concept

Happy Path ≠ Employment Model

Service Blueprint ≠ Employment Model

Workflow ≠ Employment Model

User Story ≠ Requirement

Feature List ≠ Capability Model

Agent Capability ≠ Agent Authority

Successful Execution ≠ Validated Outcome
```

Avoid the following common failures:

### Premature User Journey Generation

Do not begin by imagining screens and user steps before understanding the larger operational reality.

### Single-Actor Bias

Do not model only the paying customer or interface user.

### Happy-Path Bias

Do not treat normal execution as a complete description of employment.

### Workflow Collapse

Do not reduce capability employment to a fixed sequence when the real system requires selection, adaptation, feedback, or escalation.

### Interface Bias

Do not confuse what appears in the interface with what the operational system must accomplish.

### Automation Bias

Do not assume that an action should be assigned to an AI agent merely because an AI agent can perform it.

### Requirement Prematurity

Do not generate detailed requirements before understanding the operational need from which they derive.

---

# 11. Minimum Output Structure

For an initial analysis, produce:

## A. Intent Summary

A concise statement of the problem, desired outcome, and preserved constraints.

## B. Operational Concept

Describe:

* actors;
* environment;
* major situations;
* desired outcomes;
* capabilities;
* information and artifacts;
* system boundaries; and
* success conditions.

## C. Employment Model

Describe:

* major triggers;
* capability selection;
* authority;
* coordination;
* validation;
* feedback;
* exceptions;
* escalation; and
* completion.

## D. Derived Views Required

Recommend which of the following are necessary and explain why:

* personas;
* user journeys;
* system scenarios;
* service blueprints;
* workflows;
* decision models;
* recursive work-unit models.

## E. Traceability Model

Show how:

```text
Intent
  ↓
Operational Need
  ↓
Capability
  ↓
Employment Pattern
  ↓
Actor / System View
  ↓
Requirement
  ↓
Design Element
  ↓
Implementation
  ↓
Validation Evidence
```

## F. Unresolved Questions

Identify ambiguities that materially affect the operational model.

Do not invent answers merely to complete the artifact.

---

# 12. Governing Principle

The system must be understood first as an operating reality, then as a method of employing capabilities within that reality, then through the perspectives of its actors, then as coordinated and executable work, and only then as a set of requirements and implementation tasks.

The governing relationship is:

> The Operational Concept defines the world.
> The Employment Model defines how capabilities are used within that world.
> User Journeys describe actor-specific paths through that world.
> Service Blueprints expose the coordination required to support those paths.
> Workflows make bounded units of that coordination executable.
> Requirements specify what must be true to realize and validate the intended operation.

Do not collapse these layers.
