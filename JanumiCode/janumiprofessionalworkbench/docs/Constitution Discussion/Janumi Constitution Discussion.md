I'm having a coding agent implement the core RPH, PWUs, and PWAs, etc. UI / UX. It's having heard time due to the fact that I think the documentation we have does not present the theory and the outcome that drives all the vocabulary and other details. I think we need a CONOP and CONEMP to help tie the whole UI/UX together. But before you generate a full document, let's discuss how this will fill in a conceptual gap that the culmination of all the other documentation you have generated is not getting the job done. Maybe like what I might imagine a "conceptual constitution" would be like if there is something like that.

I think you've identified a genuine gap, and it's one I see frequently in ambitious software efforts.

The problem is not that your documentation is incomplete. The problem is that it is almost entirely **descriptive**, while what the implementation team actually needs is something **prescriptive**.

In other words:

* You have documented *what* the pieces are.  
* You have documented *how* many of the pieces interact.  
* But you have not documented **why this system exists as a coherent whole.**

That "why" is what allows every implementation decision to become almost self-evident.

---

## **The Missing Layer**

Right now your documentation looks something like this:

Vision  
   ↓  
Platform Architecture  
   ↓  
Professional Workbench  
   ↓  
Professional Work Architecture  
   ↓  
Recursive Professional Harness  
   ↓  
Professional Work Units  
   ↓  
UI Components

Notice what's missing.

There is no document answering

"How should someone think about this entire universe?"

That missing layer is usually called different things in different disciplines.

Military:

* CONOPS / CONOP  
* CONEMP

Architecture:

* Architecture Vision  
* Guiding Principles

Software:

* Philosophy  
* Product Principles

Toyota:

* Toyota Way

Apple:

* Human Interface Guidelines  
* Design Principles

Unix:

* Unix Philosophy

---

## **A Constitution**

I actually think "Conceptual Constitution" is surprisingly close.

Not in the legal sense.

More like

the immutable principles that every artifact must satisfy.

For Janumi, I think it would answer questions like

Why do PWUs exist?

Why is RPH recursive?

Why isn't this simply another workflow engine?

Why is there a Living Enterprise Model?

Why does every screen exist?

Why is decomposition the primary interaction?

Without this document, an implementation agent sees vocabulary.

With this document, it sees inevitability.

---

## **Think About Apple**

Imagine implementing iOS having only API documentation.

You'd know

UIButton

UIView

UITableView

UICollectionView

NavigationController

etc.

You could reproduce every API.

But you would never produce something that *felt* like iOS.

Why?

Because the Human Interface Guidelines describe

* direct manipulation  
* depth  
* hierarchy  
* focus  
* clarity  
* continuity

Those are not APIs.

They are conceptual invariants.

---

## **Same Problem Here**

Your documentation currently explains PWUs.

It does not explain

**why professional work should be represented as PWUs in the first place.**

Those are different documents.

---

## **The Missing Question**

I think every UI decision should answer this question.

"What professional cognition is occurring here?"

Notice this is not

"What workflow is occurring?"

nor

"What screen is occurring?"

Instead

What is the human trying to think about?

That single question changes everything.

---

## **Example**

Suppose an engineer opens JanumiCode.

Traditional thinking:

Show projects.

Show files.

Show folders.

Show tasks.

Janumi thinking:

The professional is attempting  
to reduce uncertainty.

What representation  
best reduces uncertainty?

Maybe that isn't files.

Maybe it's

Intent

↓

Requirements

↓

Architecture

↓

Implementation

↓

Verification

↓

Deployment

↓

Operational Evidence

That becomes the UI.

---

## **The Constitution Would Define the Shape of Cognition**

I think it would contain principles like

### **Professional work is reasoning.**

Not document editing.

Not workflow execution.

Reasoning.

---

### **Every artifact exists because uncertainty existed.**

Requirements exist because intent was uncertain.

Architecture exists because implementation was uncertain.

Tests exist because correctness was uncertain.

Evidence exists because deployment was uncertain.

---

### **Every screen must reduce uncertainty.**

If a screen merely displays information,  
 it has failed.

It should reduce uncertainty.

---

### **Every artifact must remain connected to its rationale.**

Nothing exists independently.

Everything traces back to intent.

---

### **Professional work is recursive.**

Every artifact may itself become professional work.

Hence

PWUs.

---

### **Professional work is continuously reconciled.**

There is no "finished."

Only coherent.

---

Those are conceptual invariants.

---

## **This Explains RPH**

Right now RPH probably feels like

"some recursive workflow."

Instead the constitution would say

Professional reasoning naturally oscillates between

* synthesis

and

* decomposition.

RPH merely externalizes this cognitive process.

So recursion isn't an implementation.

It is a model of professional thought.

---

## **Likewise PWUs**

Today

PWU sounds like a data structure.

Instead

A PWU is

the smallest professionally meaningful unit whose assumptions, evidence, intent, outputs, responsibilities, dependencies, and validation can be understood as one coherent cognitive object.

That is vastly more meaningful than

{  
 id,  
 inputs,  
 outputs  
}  
---

## **Likewise PWAs**

Today

PWA sounds like configuration.

Instead

A Professional Work Architecture is

the externalized cognitive environment for an entire profession.

Now suddenly

JanumiCode

JanumiLegal

JanumiConstruction

JanumiHealthcare

all become obvious.

They're not apps.

They're specialized cognitive environments.

---

## **Then CONOP**

Once the philosophy exists...

CONOP becomes easy.

It answers

How does a professional actually use this system over time?

Morning

↓

Receive reconciled state

↓

Resolve uncertainty

↓

Create PWUs

↓

Review AI reasoning

↓

Approve

↓

Continuous reconciliation

↓

Organizational memory updates

↓

Repeat

That is operational.

---

## **Then CONEMP**

Then CONEMP becomes

How is this capability deployed organizationally?

Solo developer

↓

Startup

↓

Department

↓

Enterprise

↓

Multi-enterprise federation

Different deployments.

Same constitution.

---

## **I Actually Think There Are Four Missing Documents**

Rather than one, I'd structure the conceptual foundation as four layers:

| Layer | Purpose | Changes Rarely? |
| ----- | ----- | ----- |
| **Janumi Conceptual Constitution** | Fundamental truths about professional work and cognition. | Almost never |
| **Theory of Professional Cognition** | Why RPH, PWUs, PWAs, reconciliation, decomposition, and reasoning exist. | Rarely |
| **CONOP** | How professionals experience and use the system. | Occasionally |
| **CONEMP** | How organizations deploy, govern, integrate, and scale the system. | More frequently |

This mirrors mature engineering disciplines. The Constitution anchors the philosophy. The Theory explains the cognitive model. The CONOP translates that model into day-to-day operation. The CONEMP shows how the capability is fielded within organizations.

## **I Think There Is One More Realization**

Throughout our discussions over the past several weeks, we've built many sophisticated pieces:

* Shape Engineering  
* Narrative Memories  
* Recursive Professional Harness  
* Professional Work Units  
* Professional Work Architectures  
* Continuous Reconciliation  
* Living Enterprise Model  
* AI-Native Professional Organizations

Each piece is internally coherent, but they are often introduced as individual concepts. A new engineer—or an implementation agent—must infer the worldview that connects them.

That inference burden is exactly what the missing conceptual layer should remove.

The implementation agent should finish reading the foundational documents and come away with a conviction like:

"Everything in Janumi is an attempt to externalize professional cognition into explicit, recursively composable, continuously reconciled representations so that humans and AI can reason together at organizational scale."

Once that idea becomes the organizing principle, the vocabulary stops feeling invented. RPH, PWUs, PWAs, and the Living Enterprise Model become the natural consequences of a single underlying theory rather than a collection of related concepts.

I suspect that is the conceptual gap you've been sensing: the project already has a rich ontology, but it lacks the concise first-principles narrative that makes the entire ontology feel inevitable. That is the role I would expect the Conceptual Constitution and the accompanying Theory of Professional Cognition to fulfill.

I think we've arrived at what is probably the most valuable implementation document we'll produce.

And interestingly, it is **not** a UI specification.

It is something that, to my knowledge, doesn't really exist in software engineering today.

Apple has the Human Interface Guidelines.

Microsoft has Fluent.

Google has Material Design.

They all answer:

How should interfaces behave?

Janumi needs to answer a different question:

**How should professional cognition be represented?**

That's a fundamentally different design problem.

I think this deserves its own name.

---

# **Volume III — Reference Experience Model (RXM)**

## **The Canonical Experience of Professional Cognition**

**Status:** Normative

**Audience**

* UX Designers  
* Frontend Engineers  
* AI Agent Developers  
* PWA Authors  
* Coding Agents  
* Enterprise Architects

---

# **Purpose**

The Reference Experience Model (RXM) defines how professional cognition is represented, navigated, manipulated, and continuously reconciled within Janumi.

Unlike traditional Human Interface Guidelines, which primarily govern interaction with software controls, the RXM governs interaction with professional reasoning itself.

The RXM is therefore independent of:

* desktop  
* web  
* mobile  
* XR  
* voice  
* future interfaces

The experience remains constant even if the presentation changes.

---

# **First Principle**

The interface shall expose the current state of professional cognition rather than the current state of software execution.

Users should never need to infer organizational reasoning from disconnected artifacts.

Instead,

the interface directly presents reasoning.

---

Immediately we have a different philosophy.

---

# **Principle 1**

## **The Organization Is The Primary Document**

Traditional software centers around

Projects

Files

Folders

Tickets

Tasks

Janumi centers around

The Organization's Current Understanding.

Every view therefore becomes a projection of the Living Enterprise Model.

The Living Enterprise Model is not another screen.

It is the thing being viewed.

This is an enormous conceptual distinction.

---

# **Principle 2**

## **Navigation Follows Cognition**

Navigation never begins with hierarchy.

Navigation begins with thought.

Professionals naturally ask:

What are we trying to accomplish?

What do we know?

What changed?

What remains uncertain?

What decision is required?

Navigation therefore follows cognitive questions.

Not storage structures.

---

# **Principle 3**

## **Everything Exists In Context**

Nothing is ever shown alone.

Every object exists within relationships.

Intent.

Evidence.

Assumptions.

Dependencies.

Alternatives.

Confidence.

History.

Participants.

Future consequences.

Removing context reduces professional understanding.

Therefore context is preserved by default.

---

This immediately explains why the coding agent struggled.

It was trying to build independent pages.

Janumi doesn't have independent pages.

---

# **Principle 4**

## **Represent Reasoning Before Results**

Traditional dashboards emphasize

Status

Completion

Progress

Metrics

Janumi emphasizes

Reasoning

Confidence

Evidence

Uncertainty

Trade-offs

Assumptions

Because those produce better decisions.

---

# **Principle 5**

## **Uncertainty Is First-Class**

Traditional software hides uncertainty.

Janumi exposes it.

Professionals should immediately recognize

unknowns,

missing evidence,

conflicting assumptions,

low confidence,

incomplete reasoning.

These are not failures.

They are the work.

---

# **Principle 6**

## **AI Is Visible**

Artificial intelligence never becomes invisible automation.

Professionals continuously understand

what AI concluded,

why,

using which evidence,

under which assumptions,

with what confidence.

Trust emerges through transparency.

---

# **Principle 7**

## **Every View Is A Projection**

There is only one underlying organizational cognition.

Different workspaces merely project different aspects.

Intent Workspace

Reasoning Workspace

Evidence Workspace

Reconciliation Workspace

Architecture Workspace

Implementation Workspace

Validation Workspace

Operations Workspace

They are all viewing the same underlying cognitive object.

---

This is huge.

---

It means there is one source of truth.

Different projections.

Not different databases.

Not different tools.

---

# **Canonical Workspace Model**

Now we finally define the workspace.

Not by UI controls.

By cognition.

---

## **Workspace A**

### **Intent**

Questions

What outcome?

Why?

Success criteria?

Constraints?

Stakeholders?

---

## **Workspace B**

### **Understanding**

Questions

What do we know?

What assumptions exist?

What remains uncertain?

---

## **Workspace C**

### **Representation**

Questions

How is current understanding externalized?

---

## **Workspace D**

### **Reasoning**

Questions

What analyses are underway?

Which AI participants are reasoning?

What alternatives exist?

---

## **Workspace E**

### **Decisions**

Questions

Which decisions require attention?

Confidence?

Evidence?

Consequences?

---

## **Workspace F**

### **Execution**

Questions

What actions are changing reality?

---

## **Workspace G**

### **Observation**

Questions

What happened?

Did reality match expectation?

---

## **Workspace H**

### **Reconciliation**

Questions

How should understanding change?

Where has coherence been lost?

---

Notice something fascinating.

These are exactly the PCLC states.

The UI literally becomes a visualization of cognition.

---

# **Persistent Cognitive Regions**

Every workspace shares persistent regions.

Not because they look nice.

Because cognition requires them.

---

## **Current Intent**

Always visible.

Professionals should never lose sight of why.

---

## **Current Confidence**

Always visible.

---

## **Current Uncertainty**

Always visible.

---

## **Current Dependencies**

Always visible.

---

## **Current Participants**

Always visible.

Human.

AI.

External systems.

---

## **Current Evidence**

Always accessible.

---

## **Current Reasoning**

Always inspectable.

---

Notice how radically different this is from IDEs.

---

# **Cognitive Zoom**

Perhaps the most important interaction.

Users never "open another project."

Instead they zoom.

Organization

↓

Initiative

↓

Program

↓

Capability

↓

PWU

↓

Sub-PWU

↓

Reasoning

↓

Evidence

↓

Claim

↓

Observation

Exactly the same interaction.

Infinite recursion.

This is the UI manifestation of recursive professional cognition.

---

# **Cognitive Time**

Traditional software shows versions.

Janumi shows reasoning evolution.

Professionals should move through

past understanding,

current understanding,

predicted future understanding.

Not simply

Version 1

Version 2

Version 3

---

# **AI Behavior**

AI never interrupts.

AI contributes.

Every contribution appears as

reasoning,

evidence,

proposed reconciliation,

identified uncertainty,

suggested decomposition,

validation.

Professionals remain inside the reasoning flow.

---

# **The Most Important Diagram**

I think this may become the defining illustration of Janumi.

                 Living Enterprise Model  
                           │  
     ┌─────────────────────┼─────────────────────┐  
     │                     │                     │  
     ▼                     ▼                     ▼  
 Intent View        Reasoning View       Evidence View  
     │                     │                     │  
     └───────────────┬─────┴─────────────────────┘  
                     ▼  
              Same Professional Cognition  
                     ▲  
     ┌───────────────┴─────────────────────┐  
     │                     │               │  
     ▼                     ▼               ▼  
 Decision View     Execution View   Reconciliation View

Every workspace is simply another lens over the same underlying cognitive model.

---

# **Why This Changes Everything**

I think we've now uncovered the conceptual mistake that almost every implementation team—including your coding agent—is likely to make if they start from conventional application architecture.

They'll instinctively build separate "modules": a requirements module, a task module, a document module, an architecture module, a testing module. Each module becomes its own little world, with its own navigation, data model, and UI. Users are then forced to reconstruct the relationships mentally.

The RXM says that is the wrong decomposition.

There is only one underlying object: **the organization's professional cognition**. Requirements, architecture, code, tests, evidence, discussions, decisions, and operations are simply different projections of that same evolving cognitive state. Once an implementation team internalizes that idea, the UI stops being a collection of pages and starts becoming a coherent environment. I believe **this** is the missing conceptual bridge that would have made your coding agent's job dramatically easier.

---

## **Before We Continue Further**

At this point, I would also change **how** we produce the remaining documentation.

We now have enough theoretical foundation that continuing in prose alone will start to lose precision. The next volumes should become increasingly model-driven:

* **Formal metamodels** (entities, relationships, invariants)  
* **State machines** (for the PCLC and RPH behavior)  
* **Interaction grammars** (valid cognitive transitions)  
* **Reference object models** (PWU schema, Living Enterprise Model schema)  
* **Reference UX patterns** (derived from the RXM)  
* **Implementation profiles** (desktop, web, mobile, VS Code)

In other words, I would shift from writing philosophy to writing what amounts to an executable specification. That would give both human engineers and coding agents a far more deterministic foundation for implementing Janumi consistently across every Professional Work Architecture. I think that's the natural transition from defining a discipline to engineering a platform.

I think we're at an important inflection point, and I'm going to **deliberately not continue in the same style**.

Not because I don't know what comes next.

Because I think continuing would actually make the design **worse**.

Let me explain.

---

# **I think we have enough theory.**

In fact, I think we now have **more theory than most software systems have in their entire existence.**

We've built something like:

* Primitive Concepts  
* Laws  
* Corollaries  
* Constitution  
* Life Cycle  
* Reference Experience Model

That's a remarkable foundation.

But something has started bothering me.

---

# **We are still writing "about" Janumi.**

Instead, we need to start **designing Janumi.**

Those are very different activities.

---

Suppose we were designing the cockpit of a Boeing 787\.

We would not write

The Pilot Experience Model

followed by

The Pilot Interaction Constitution

followed by

The Pilot Operational Philosophy

Eventually someone has to draw the cockpit.

---

I think we've reached that point.

---

# **We now need a Reference Model**

Not prose.

A model.

When I say model I mean something much closer to UML, SysML, or a metamodel.

Something like:

Professional Cognition  
│  
├── Outcome  
├── Intent  
├── Representation  
├── Evidence  
├── Decision  
├── Participant  
├── Reasoning  
├── Confidence  
├── Assumption  
├── Constraint  
├── Dependency  
└── Observation

Not because we like diagrams.

Because this becomes executable.

---

# **Think about your coding agent.**

Right now it still has to infer:

"What exactly is a PWU?"

We have defined it beautifully.

But not formally.

---

Likewise

"What is a Living Enterprise Model?"

"What relationships are allowed?"

"What are invariants?"

"What can reference what?"

Those aren't philosophical questions anymore.

They're metamodel questions.

---

# **I think we've reached the Model Driven Engineering stage.**

Which, ironically, fits Janumi perfectly.

---

## **Volume IV**

# **Canonical Professional Cognition Metamodel**

This is what I think should exist next.

Not because I like metamodels.

Because **everything else can be generated from them.**

---

Imagine something like:

ProfessionalWork

owns

Intent  
Outcome  
Participants  
PWUs  
---

A PWU owns

Reasoning

Evidence

Claims

Confidence

Dependencies

Sub-PWUs  
---

Reasoning creates

Representations  
---

Representations contain

Assumptions

Constraints

Observations  
---

Observations modify

Confidence  
---

Confidence affects

Decisions  
---

Decisions modify

Reality  
---

Reality generates

Observations  
---

Observation triggers

Reconciliation  
---

Reconciliation updates

Living Enterprise Model  
---

That is no longer documentation.

That is an ontology.

---

# **And then something hit me.**

Really hard.

---

We keep talking about

PWUs

RPH

Living Enterprise Model

Professional Work Architectures

---

Those are **implementation concepts**.

---

The metamodel shouldn't know about them.

---

The metamodel should only know about

Reasoning

Intent

Evidence

Confidence

Outcome

Participant

Representation

Decision

Observation

---

Then

PWU

becomes

a bounded aggregate over those primitives.

---

RPH

becomes

a coordinator over aggregates.

---

Living Enterprise Model

becomes

the complete graph of aggregates.

---

Do you see what just happened?

---

We've separated

**ontology**

from

**architecture.**

---

That is a massive improvement.

---

# **I actually think we've found the real layering.**

Instead of

Theory

↓

Architecture

↓

Implementation

I now think it is

Theory

↓

Ontology

↓

Architecture

↓

Interaction

↓

Implementation

That ontology layer is what has been missing all along.

---

# **Even better...**

Once you have the ontology...

you can automatically derive:

* JSON Schemas  
* Graph schemas  
* SQL schemas  
* Neo4j models  
* GraphQL APIs  
* OpenAPI contracts  
* UI state models  
* AI prompts  
* validation rules  
* persistence models  
* observability schemas

Everything.

---

# **Which means...**

I think we've accidentally arrived at what may be the single most important engineering artifact in the entire Janumi ecosystem.

Not the Constitution.

Not the CONOP.

Not even the RPH.

The **Canonical Professional Cognition Ontology (CPCO)**.

---

## **This is where I would deliberately stop.**

Not because we shouldn't continue.

Because I think the work has fundamentally changed.

Up until now we were discovering the conceptual foundations. From this point onward, we should switch into **engineering mode**.

My recommendation is that we treat the Canonical Professional Cognition Ontology as the **source of truth** for the platform. Every architectural construct (PWUs, RPHs, the Living Enterprise Model), every API, every persistence model, every UI workspace, every AI prompt contract, every validation rule, and every observability event should be derived from it rather than defined independently.

In practical terms, I would establish the following engineering pipeline:

1. **Canonical Professional Cognition Ontology (CPCO)** — the formal semantic model.  
2. **Architectural Profiles** — how the ontology is realized as PWUs, RPHs, Narrative Memories, etc.  
3. **Reference Metamodels** — JSON Schema, graph model, relational model, API model, event model.  
4. **Reference UI Model** — views as projections of ontology plus PCLC state.  
5. **Implementation Profiles** — web, desktop, mobile, VS Code, enterprise.

This is the point where I would stop writing long-form theory and begin producing formal specifications. That shift is significant because it means the documentation stops being primarily explanatory and becomes generative: a sufficiently capable coding agent could use it to synthesize much of the platform automatically while remaining consistent with the foundational principles we've established. I believe that is the most productive direction from here.

\====

# **Canonical Professional Cognition Ontology**

## **CPCO Specification v0.1**

**Status:** Normative draft  
**Scope:** Janumi Platform and all Professional Work Architectures  
**Primary audiences:** Platform architects, coding agents, domain-model authors, UX engineers, agent developers, validator developers  
**Normative keywords:** SHALL, SHALL NOT, SHOULD, SHOULD NOT, MAY

---

# **1\. Purpose**

The Canonical Professional Cognition Ontology, or CPCO, defines the domain-independent semantic model for professional cognition within Janumi.

It specifies:

* the primitive entities of professional work;  
* the relationships among those entities;  
* the invariants that preserve professional coherence;  
* the distinction between cognition, coordination, execution, and observation;  
* the semantic basis of Professional Work Units;  
* the semantic basis of Recursive Professional Harnesses;  
* the semantic basis of the Living Enterprise Model;  
* the projections required by Janumi user interfaces;  
* the contracts required by human and artificial participants.

CPCO is not:

* a database schema;  
* a UI component model;  
* a workflow definition;  
* a task-management ontology;  
* a product-specific domain model;  
* a replacement for domain-specific terminology.

CPCO is the canonical semantic layer from which those implementation artifacts are derived.

---

# **2\. Foundational Model**

Professional work is modeled as an evolving graph of cognition directed toward outcomes.

The core transformation is:

Intent  
  ↓  
Understanding  
  ↓  
Representation  
  ↓  
Reasoning  
  ↓  
Decision  
  ↓  
Action  
  ↓  
Observation  
  ↓  
Reconciliation  
  ↺

This loop is non-linear and recursive. Any conclusion, representation, decision, or observation may initiate additional professional work.

The ontology therefore represents professional cognition as:

Cognitive Entity  
\+  
Semantic Relationships  
\+  
Temporal Evolution  
\+  
Evidence and Provenance  
\+  
Coordination State  
\+  
Coherence Constraints

---

# **3\. Ontological Layers**

CPCO separates five layers that SHALL NOT be collapsed into one another.

## **3.1 Reality Layer**

The external world that professional work seeks to understand or change.

Examples:

* a deployed software system;  
* a building site;  
* a patient;  
* a market;  
* a regulation;  
* an organizational operating condition.

Reality is never fully represented within Janumi. Janumi contains observations and representations of reality.

## **3.2 Cognitive Layer**

The organization’s explicit professional understanding.

Examples:

* intents;  
* claims;  
* assumptions;  
* models;  
* alternatives;  
* decisions;  
* confidence assessments.

## **3.3 Work Layer**

Bounded units through which cognition is advanced.

The canonical work-layer construct is the Professional Work Unit.

## **3.4 Coordination Layer**

Mechanisms that allocate, sequence, supervise, reconcile, and escalate professional work.

The canonical coordination-layer construct is the Recursive Professional Harness.

## **3.5 Projection Layer**

Human- and machine-usable views over the cognitive graph.

Examples:

* intent view;  
* evidence view;  
* reasoning graph;  
* decomposition view;  
* decision view;  
* reconciliation view;  
* implementation view.

A projection SHALL NOT become an independent semantic source of truth.

---

# **4\. Universal Entity Contract**

Every CPCO entity SHALL conform to the following universal contract.

## **4.1 Identity**

Each entity SHALL possess a stable, globally unique identifier.

EntityId

Identity SHALL survive:

* renaming;  
* revision;  
* movement between work contexts;  
* changes in ownership;  
* changes in lifecycle state.

## **4.2 Type**

Each entity SHALL declare a canonical entity type.

EntityType

Domain-specific subtypes MAY refine canonical types but SHALL NOT violate their semantics.

## **4.3 Version**

Each mutable entity SHALL possess a version identifier.

VersionId

Historical versions SHALL remain reconstructable when required for traceability, audit, or reasoning recovery.

## **4.4 Provenance**

Each entity SHALL record its provenance.

At minimum:

createdBy  
createdAt  
creationContext  
sourceType  
sourceReferences

Where applicable, provenance SHALL distinguish:

* human-authored;  
* AI-generated;  
* imported;  
* mechanically derived;  
* observed;  
* reconciled;  
* approved.

## **4.5 Lifecycle State**

Each entity SHALL declare a lifecycle state appropriate to its type.

Lifecycle state SHALL NOT be inferred from null fields, missing values, or UI placement.

## **4.6 Validity**

Each entity SHALL expose its current validation condition.

unvalidated  
valid  
conditionally\_valid  
invalid  
superseded  
stale  
disputed

## **4.7 Temporal Context**

Entities whose meaning changes over time SHALL record:

validFrom  
validUntil  
observedAt  
supersededAt

Creation time and semantic validity time SHALL remain distinct.

## **4.8 Access and Responsibility**

Entities MAY define:

owner  
stewards  
contributors  
reviewers  
approvers  
visibility

Ownership SHALL NOT be treated as equivalent to authorship or accountability.

---

# **5\. Canonical Entity Types**

## **5.1 Professional Endeavor**

A **Professional Endeavor** is a coherent undertaking directed toward one or more outcomes.

Examples:

* developing a product;  
* establishing regulatory compliance;  
* diagnosing a patient;  
* designing a building;  
* conducting a scientific investigation.

A Professional Endeavor provides the broadest bounded context for professional cognition.

### **Required properties**

endeavorId  
name  
purpose  
lifecycleState  
primaryIntentIds  
outcomeIds  
participantIds  
workUnitIds

### **Constraints**

A Professional Endeavor SHALL possess at least one Intent.

A Professional Endeavor SHALL define at least one desired Outcome unless it is explicitly classified as exploratory.

---

## **5.2 Outcome**

An **Outcome** is a desired or observed change in reality.

Outcomes are not artifacts, activities, or deliverables.

### **Examples**

Valid outcomes:

* customers can reliably schedule field service appointments;  
* a structure satisfies applicable load requirements;  
* an organization demonstrates CMMC Level 2 compliance;  
* an experiment resolves a specified scientific uncertainty.

Not outcomes:

* produce a report;  
* hold a meeting;  
* create a dashboard;  
* write a test plan.

Those may be outputs or actions supporting an outcome.

### **Required properties**

outcomeId  
description  
outcomeType  
successCriteria  
evaluationMethod  
currentAssessment

### **Outcome types**

desired  
intermediate  
enabling  
protective  
preventive  
observed  
unintended  
adverse

### **Relationships**

An Outcome MAY:

* realize an Intent;  
* depend on another Outcome;  
* conflict with another Outcome;  
* be evaluated by Evidence;  
* be affected by a Decision;  
* be produced or modified by an Action.

---

## **5.3 Intent**

**Intent** expresses the desired outcome and the rationale for pursuing it.

Intent answers:

* What should change?  
* Why should it change?  
* For whom?  
* Under which constraints?  
* What must not be sacrificed?

### **Required properties**

intentId  
statement  
rationale  
priority  
authority  
successInterpretation

### **Optional properties**

nonGoals  
ethicalConstraints  
organizationalConstraints  
timeHorizon  
riskTolerance

### **Relationships**

Intent MAY:

* refine another Intent;  
* supersede another Intent;  
* motivate an Outcome;  
* constrain a Decision;  
* originate a PWU;  
* be interpreted by a Requirement or other Representation.

### **Invariant**

Every significant work product SHALL remain traceable to one or more active Intents.

---

## **5.4 Stakeholder**

A **Stakeholder** is a person, group, organization, system, community, or affected party with an interest in the endeavor or its outcomes.

### **Required properties**

stakeholderId  
stakeholderType  
interest  
influence  
impact

### **Distinction**

A Stakeholder is not necessarily a Participant.

A person affected by a decision may be a Stakeholder without performing work in Janumi.

---

## **5.5 Participant**

A **Participant** is an actor that performs, contributes to, evaluates, supervises, or authorizes professional cognition or action.

### **Participant types**

human  
ai\_agent  
team  
organization  
external\_system  
institution

### **Required properties**

participantId  
participantType  
capabilities  
authority  
responsibilities

### **AI-specific properties**

modelIdentity  
agentRole  
toolPermissions  
operatingPolicy  
contextSources  
validationRequirements

### **Invariant**

AI Participants SHALL be represented explicitly. AI-originated cognition SHALL NOT be attributed to a human participant.

---

## **5.6 Question**

A **Question** is an explicit expression of uncertainty requiring investigation or resolution.

Questions are first-class entities because professional work is organized around unresolved uncertainty.

### **Question types**

descriptive  
causal  
predictive  
evaluative  
normative  
design  
verification  
operational  
strategic

### **Required properties**

questionId  
questionText  
questionType  
importance  
resolutionCriteria  
status

### **Status values**

open  
investigating  
partially\_resolved  
resolved  
blocked  
deferred  
invalidated

### **Relationships**

A Question MAY:

* arise from an Observation;  
* challenge a Claim;  
* motivate Reasoning;  
* be answered by a Claim;  
* decompose into subquestions;  
* block a Decision.

---

## **5.7 Uncertainty**

An **Uncertainty** is a characterized insufficiency in professional knowledge.

Unlike a Question, uncertainty may exist before it is formulated as a precise inquiry.

### **Uncertainty categories**

epistemic  
aleatory  
interpretive  
requirements  
technical  
operational  
organizational  
legal  
ethical  
resource  
temporal

### **Required properties**

uncertaintyId  
description  
category  
severity  
decisionImpact  
reducibility

### **Relationships**

An Uncertainty MAY:

* generate one or more Questions;  
* reduce confidence in a Claim;  
* block a Decision;  
* motivate a PWU;  
* be reduced by Evidence;  
* remain as residual uncertainty after a Decision.

---

## **5.8 Representation**

A **Representation** is an externalized model, description, specification, expression, or encoding of professional understanding.

### **Representation subtypes**

requirement  
model  
diagram  
document  
specification  
architecture  
plan  
source\_code  
contract  
simulation  
dataset  
procedure  
policy  
test\_case  
test\_result  
risk\_model  
financial\_model  
medical\_record  
scientific\_model

Domain-specific PWAs MAY define additional subtypes.

### **Required properties**

representationId  
representationType  
contentReference  
semanticPurpose  
fidelity  
status

### **Invariant**

A Representation SHALL declare what it represents and for which professional purpose.

Storage location alone SHALL NOT define semantic identity.

---

## **5.9 Assumption**

An **Assumption** is a proposition provisionally treated as true for the purpose of reasoning.

### **Required properties**

assumptionId  
statement  
scope  
basis  
criticality  
validationMethod  
status

### **Status values**

unexamined  
accepted  
provisionally\_accepted  
validated  
invalidated  
superseded  
contested

### **Invariant**

Critical assumptions SHALL be explicit and traceable to the reasoning and decisions that depend upon them.

---

## **5.10 Constraint**

A **Constraint** limits the acceptable solution space.

### **Constraint types**

legal  
regulatory  
technical  
architectural  
ethical  
financial  
resource  
schedule  
organizational  
physical  
contractual  
security  
safety

### **Required properties**

constraintId  
statement  
constraintType  
authority  
enforcementLevel  
applicability

### **Enforcement levels**

mandatory  
strong\_preference  
preference  
advisory

### **Invariant**

A Decision that violates a mandatory Constraint SHALL be invalid unless an authorized exception exists.

---

## **5.11 Claim**

A **Claim** is a proposition asserted to describe, explain, predict, evaluate, or prescribe something relevant to the endeavor.

### **Claim types**

factual  
causal  
predictive  
evaluative  
normative  
design  
verification  
operational

### **Required properties**

claimId  
statement  
claimType  
confidenceAssessmentId  
status

### **Status values**

proposed  
supported  
accepted  
contested  
refuted  
superseded  
withdrawn

### **Relationships**

A Claim MAY:

* answer a Question;  
* be supported or contradicted by Evidence;  
* depend on an Assumption;  
* justify a Decision;  
* be derived from other Claims;  
* be produced by Reasoning.

---

## **5.12 Evidence**

**Evidence** is information used to increase or decrease confidence in a Claim, Assumption, Representation, or Decision.

### **Evidence types**

observation  
measurement  
experiment  
test\_result  
inspection  
simulation\_result  
authoritative\_source  
expert\_judgment  
operational\_telemetry  
user\_feedback  
historical\_record  
formal\_proof

### **Required properties**

evidenceId  
evidenceType  
source  
contentReference  
reliabilityAssessment  
relevanceAssessment  
observedAt

### **Evidence relation types**

supports  
contradicts  
qualifies  
is\_inconclusive\_for

### **Invariant**

Evidence SHALL NOT be represented as supporting a Claim without an explicit support relationship.

Mere attachment or proximity SHALL NOT imply evidentiary support.

---

## **5.13 Confidence Assessment**

A **Confidence Assessment** expresses the degree of warranted belief in a Claim, Assumption, Decision, or Representation.

### **Required properties**

confidenceAssessmentId  
subjectId  
confidenceLevel  
basis  
assessedBy  
assessedAt

### **Confidence representation**

Implementations MAY use:

* ordinal categories;  
* numeric probability;  
* interval;  
* belief distribution;  
* domain-specific assurance level.

The representation SHALL declare its interpretation.

### **Invariant**

Confidence SHALL be distinguishable from:

* priority;  
* approval;  
* completion;  
* certainty;  
* severity.

---

## **5.14 Reasoning Activity**

A **Reasoning Activity** is a bounded transformation of professional representations intended to reduce uncertainty, generate claims, compare alternatives, or support decisions.

### **Reasoning types**

analysis  
synthesis  
decomposition  
comparison  
diagnosis  
prediction  
simulation  
design  
planning  
interpretation  
verification  
validation  
reconciliation  
critique  
review

### **Required properties**

reasoningActivityId  
reasoningType  
purpose  
inputIds  
outputIds  
performedBy  
startedAt  
status

### **Optional properties**

method  
tools  
model  
prompt  
parameters  
terminationCondition

### **Invariant**

Every completed Reasoning Activity SHALL identify its outputs or explicitly record that it produced no valid conclusion.

---

## **5.15 Alternative**

An **Alternative** is a candidate interpretation, explanation, design, action, or decision under consideration.

### **Required properties**

alternativeId  
description  
alternativeType  
evaluationCriteria  
status

### **Status values**

identified  
under\_evaluation  
viable  
rejected  
selected  
superseded

### **Invariant**

Rejected Alternatives SHOULD retain rejection rationale when they were materially considered.

---

## **5.16 Decision**

A **Decision** is an authorized commitment to a conclusion, interpretation, design, priority, or course of action.

### **Required properties**

decisionId  
decisionStatement  
decisionType  
authority  
status  
effectiveAt

### **Decision states**

proposed  
pending  
approved  
rejected  
deferred  
conditional  
implemented  
reopened  
superseded  
reversed

### **Required relationships**

A material Decision SHALL identify:

supportingClaims  
supportingEvidence  
consideredAlternatives  
applicableConstraints  
residualUncertainty  
decisionRationale

### **Invariant**

A Decision SHALL NOT be treated as equivalent to truth.

A Decision represents commitment under available knowledge and authority.

---

## **5.17 Action**

An **Action** is an intentional intervention intended to change reality or the state of professional work.

### **Action types**

implementation  
communication  
deployment  
construction  
execution  
experiment  
inspection  
review  
approval  
escalation  
data\_collection  
remediation

### **Required properties**

actionId  
actionType  
intendedEffect  
authorizedBy  
performedBy  
status

### **Relationships**

An Action MAY:

* implement a Decision;  
* produce an Artifact;  
* change a Representation;  
* affect an Outcome;  
* generate an Observation.

---

## **5.18 Observation**

An **Observation** is a recorded perception, measurement, report, or detected condition concerning reality or system behavior.

### **Required properties**

observationId  
observationType  
observedSubject  
observedValue  
observedAt  
observer

### **Distinction**

An Observation is not automatically Evidence.

It becomes Evidence when used in relation to a Claim, Assumption, or Decision.

### **Invariant**

Raw Observation, interpreted Observation, and derived Claim SHOULD remain distinguishable.

---

## **5.19 Artifact**

An **Artifact** is a material or digital output produced during professional work.

Examples:

* a source-code commit;  
* a report;  
* a drawing;  
* a contract;  
* a deployed service;  
* a test record;  
* a presentation.

An Artifact may embody one or more Representations but is not semantically identical to them.

### **Example**

A PDF file is an Artifact.

The system architecture expressed within that PDF is a Representation.

---

## **5.20 Dependency**

A **Dependency** expresses a condition in which one entity’s validity, availability, execution, or meaning depends upon another entity.

### **Dependency types**

informational  
logical  
temporal  
resource  
authority  
evidence  
implementation  
validation  
operational

### **Required properties**

dependencyId  
sourceId  
targetId  
dependencyType  
criticality  
status

### **Status values**

unresolved  
satisfied  
partially\_satisfied  
blocked  
violated  
obsolete

---

## **5.21 Risk**

A **Risk** is the possibility that uncertainty or future conditions will adversely affect outcomes.

### **Required properties**

riskId  
description  
cause  
potentialEffect  
likelihood  
impact  
exposure  
status

### **Relationships**

A Risk MAY:

* arise from an Assumption;  
* relate to an Uncertainty;  
* threaten an Outcome;  
* motivate a Decision;  
* be mitigated by an Action;  
* be monitored through Observations.

---

## **5.22 Issue**

An **Issue** is a realized condition requiring resolution.

Risk concerns possible future impact.

Issue concerns an existing condition.

### **Required properties**

issueId  
description  
severity  
detectedAt  
status

---

## **5.23 Validation**

A **Validation** is an evaluation of whether an entity satisfies defined semantic, professional, procedural, or technical criteria.

### **Validation types**

schema  
logical  
evidentiary  
methodological  
regulatory  
policy  
professional  
security  
safety  
usability  
outcome

### **Required properties**

validationId  
subjectId  
validationType  
criteria  
result  
performedBy  
performedAt

### **Results**

pass  
fail  
conditional\_pass  
inconclusive  
not\_applicable

---

## **5.24 Reconciliation**

A **Reconciliation** is a deliberate process for restoring or improving coherence among representations, intent, evidence, decisions, and observed reality.

### **Reconciliation triggers**

new\_evidence  
contradiction  
intent\_change  
assumption\_failure  
dependency\_change  
observation\_mismatch  
policy\_change  
external\_event  
validation\_failure  
manual\_request

### **Required properties**

reconciliationId  
trigger  
affectedEntityIds  
detectedIncoherence  
proposedResolution  
status

### **Reconciliation states**

detected  
analyzing  
proposed  
under\_review  
accepted  
rejected  
applied  
partially\_applied  
escalated

### **Invariant**

Reconciliation SHALL preserve the history of the prior coherent state and the reason for change.

---

## **5.25 Narrative Memory**

A **Narrative Memory** is a temporally organized account that preserves the evolution and significance of professional cognition.

Narrative Memory does not replace the canonical graph. It provides interpretive continuity across that graph.

### **Required properties**

memoryId  
scope  
timeRange  
narrative  
sourceEntityIds  
generatedBy  
validationStatus

### **Invariant**

Narrative Memory SHALL identify its source entities and SHALL NOT silently invent missing rationale.

---

# **6\. Canonical Relationships**

Relationships are first-class semantic objects. They SHALL possess identity, provenance, validity, and temporal context where appropriate.

## **6.1 Intent Relationships**

INTENT\_MOTIVATES\_OUTCOME  
INTENT\_REFINES\_INTENT  
INTENT\_SUPERSEDES\_INTENT  
INTENT\_CONSTRAINS\_DECISION  
ENTITY\_TRACES\_TO\_INTENT

## **6.2 Reasoning Relationships**

QUESTION\_MOTIVATES\_REASONING  
REASONING\_CONSUMES\_ENTITY  
REASONING\_PRODUCES\_ENTITY  
REASONING\_DECOMPOSES\_ENTITY  
REASONING\_SYNTHESIZES\_ENTITY  
REASONING\_CHALLENGES\_CLAIM

## **6.3 Evidence Relationships**

EVIDENCE\_SUPPORTS\_CLAIM  
EVIDENCE\_CONTRADICTS\_CLAIM  
EVIDENCE\_QUALIFIES\_CLAIM  
EVIDENCE\_VALIDATES\_ASSUMPTION  
EVIDENCE\_INVALIDATES\_ASSUMPTION

## **6.4 Decision Relationships**

CLAIM\_JUSTIFIES\_DECISION  
DECISION\_SELECTS\_ALTERNATIVE  
DECISION\_REJECTS\_ALTERNATIVE  
DECISION\_AUTHORIZES\_ACTION  
DECISION\_SUPERSEDES\_DECISION  
DECISION\_ACCEPTS\_RESIDUAL\_UNCERTAINTY

## **6.5 Execution Relationships**

ACTION\_IMPLEMENTS\_DECISION  
ACTION\_PRODUCES\_ARTIFACT  
ACTION\_AFFECTS\_OUTCOME  
ACTION\_GENERATES\_OBSERVATION

## **6.6 Reconciliation Relationships**

OBSERVATION\_TRIGGERS\_RECONCILIATION  
VALIDATION\_TRIGGERS\_RECONCILIATION  
RECONCILIATION\_UPDATES\_ENTITY  
RECONCILIATION\_SUPERSEDES\_ENTITY\_VERSION  
RECONCILIATION\_RESOLVES\_CONTRADICTION

## **6.7 Structural Relationships**

ENTITY\_DEPENDS\_ON\_ENTITY  
ENTITY\_CONTAINS\_ENTITY  
ENTITY\_DERIVED\_FROM\_ENTITY  
ENTITY\_REFERENCES\_ENTITY  
ENTITY\_SUPERSEDES\_ENTITY  
ENTITY\_CONFLICTS\_WITH\_ENTITY  
ENTITY\_VALIDATED\_BY\_VALIDATION

---

# **7\. Professional Work Unit Architectural Profile**

A Professional Work Unit is not a primitive ontological entity. It is a bounded aggregate over CPCO entities.

## **7.1 Canonical Definition**

A **Professional Work Unit** is a bounded, governable region of professional cognition organized around a professionally meaningful objective, uncertainty, decision, or outcome.

A PWU packages sufficient semantic context to allow its work to be:

* understood;  
* assigned;  
* reasoned about;  
* validated;  
* coordinated;  
* observed;  
* reconciled;  
* reconstructed.

## **7.2 Required PWU Composition**

Every PWU SHALL contain or reference:

PWU  
├── Objective  
├── Originating Intent  
├── Scope  
├── Current Lifecycle State  
├── Participants  
├── Questions and Uncertainties  
├── Inputs  
├── Reasoning Activities  
├── Representations  
├── Claims  
├── Evidence  
├── Assumptions  
├── Constraints  
├── Decisions  
├── Actions  
├── Observations  
├── Dependencies  
├── Validations  
├── Reconciliations  
└── History

Not every collection must be non-empty at creation.

The PWU SHALL, however, distinguish:

* absent;  
* unknown;  
* not yet produced;  
* not applicable;  
* intentionally omitted.

## **7.3 PWU Types**

PWAs MAY define specialized PWU types.

Canonical categories include:

discovery  
analysis  
design  
implementation  
verification  
validation  
decision  
research  
review  
reconciliation  
incident  
governance  
planning  
execution

## **7.4 PWU Lifecycle**

proposed  
framing  
ready  
active  
blocked  
awaiting\_evidence  
awaiting\_decision  
awaiting\_review  
reconciling  
completed  
suspended  
cancelled  
superseded  
reopened

## **7.5 PWU Completion**

Completion SHALL NOT be inferred solely from task execution.

A PWU may be completed only when its declared completion conditions are satisfied.

Completion conditions SHOULD include:

* objective achieved or explicitly abandoned;  
* required outputs produced;  
* mandatory validations passed;  
* significant decisions recorded;  
* residual uncertainty documented;  
* dependencies resolved or transferred;  
* reconciliation completed;  
* traceability intact.

## **7.6 Recursive Composition**

A PWU MAY contain child PWUs.

Parent-child composition SHALL declare the semantic relationship:

decomposition  
delegation  
specialization  
verification  
support  
mitigation  
reconciliation

A parent PWU SHALL NOT be considered coherent merely because child PWUs are individually complete.

Reconstruction or synthesis SHALL occur at the parent boundary.

---

# **8\. Recursive Professional Harness Architectural Profile**

The Recursive Professional Harness is a coordination mechanism over one or more PWUs.

## **8.1 Canonical Definition**

An **RPH** is a recursive coordination system that advances professional cognition through the Professional Cognition Life Cycle while preserving intent, traceability, evidence, responsibility, and coherence.

## **8.2 RPH Responsibilities**

An RPH SHALL:

* establish or receive intent;  
* frame professional work;  
* create or select PWUs;  
* allocate participants;  
* coordinate dependencies;  
* monitor reasoning state;  
* invoke tools and agents;  
* request validation;  
* detect blocking conditions;  
* trigger reconciliation;  
* escalate unresolved conditions;  
* synthesize child work;  
* preserve provenance;  
* emit observability events.

## **8.3 RPH Non-Responsibilities**

An RPH SHALL NOT:

* treat successful tool execution as successful professional reasoning;  
* infer professional completion from workflow termination;  
* conceal unresolved uncertainty;  
* silently rewrite intent;  
* discard rejected alternatives without rationale;  
* attribute AI output to human authors;  
* suppress validation failures;  
* collapse disagreement into false consensus.

## **8.4 Recursive Behavior**

An RPH MAY create subordinate RPH instances when coordination itself requires bounded professional work.

Every subordinate RPH SHALL possess:

* an originating purpose;  
* a parent relationship;  
* delegated authority;  
* completion or escalation conditions;  
* traceability to the parent work context.

## **8.5 Harness Control States**

initializing  
framing  
planning  
allocating  
executing  
observing  
validating  
reconciling  
awaiting\_human  
awaiting\_external  
escalating  
completed  
failed  
cancelled

Harness state SHALL remain distinct from PWU lifecycle state.

---

# **9\. Living Enterprise Model Architectural Profile**

## **9.1 Canonical Definition**

The **Living Enterprise Model** is the continuously reconciled global projection of the organization’s professional cognition, operating context, commitments, capabilities, evidence, decisions, work, and outcomes.

It is not a single document, graph visualization, or database.

It is the authoritative semantic state produced from CPCO-compliant entities and relationships.

## **9.2 Required Capabilities**

The Living Enterprise Model SHALL support queries such as:

* What outcomes is the organization pursuing?  
* Which intents justify current work?  
* What uncertainty most threatens each outcome?  
* Which decisions are pending?  
* Which claims lack sufficient evidence?  
* Which assumptions are critical and unvalidated?  
* Where do representations conflict?  
* Which PWUs are blocked and why?  
* Which AI agents produced material conclusions?  
* Where has confidence changed?  
* Which observations contradict current expectations?  
* What reconciliation is pending?  
* What reasoning led to the current organizational state?

## **9.3 Authority**

The Living Enterprise Model is authoritative only to the extent that its inputs are:

* current;  
* traceable;  
* validated;  
* reconciled;  
* appropriately governed.

It SHALL expose uncertainty about its own completeness and correctness.

---

# **10\. Professional Work Architecture Profile**

## **10.1 Canonical Definition**

A **Professional Work Architecture** is a domain-specific specialization of CPCO and the Janumi operational model.

A PWA defines:

* domain vocabulary;  
* specialized entity subtypes;  
* domain relationships;  
* domain lifecycle states;  
* permissible reasoning methods;  
* professional roles;  
* artifact types;  
* validations;  
* policies;  
* decision authorities;  
* UI projections;  
* agent capabilities;  
* integration mappings.

## **10.2 PWA Conformance**

A PWA SHALL:

* map each domain construct to CPCO primitives or justified extensions;  
* preserve CPCO invariants;  
* define domain-specific validation;  
* identify authoritative external sources;  
* distinguish domain truth from organizational decision;  
* declare its reconciliation rules;  
* declare its observability events;  
* declare its human oversight points.

## **10.3 Example**

JanumiCode may specialize:

Representation → Requirement  
Representation → Architecture Model  
Representation → Source Code  
Validation → Unit Test  
Validation → Integration Test  
Observation → Production Telemetry  
Decision → Architecture Decision  
PWU → Implementation Work Unit  
PWU → Verification Work Unit

These remain projections of the same professional cognition graph.

---

# **11\. Coherence Model**

Coherence SHALL be treated as a multi-dimensional property.

## **11.1 Intent Coherence**

Degree to which work, representations, decisions, and actions remain aligned with active Intent.

## **11.2 Internal Coherence**

Degree to which representations and claims are mutually compatible.

## **11.3 Evidentiary Coherence**

Degree to which confidence and decisions are proportionate to available Evidence.

## **11.4 Temporal Coherence**

Degree to which the model reflects the relevant current state rather than stale conditions.

## **11.5 Operational Coherence**

Degree to which Decisions, Actions, and observed reality remain aligned.

## **11.6 Authority Coherence**

Degree to which Decisions were made by authorized Participants under applicable governance.

## **11.7 Cross-PWU Coherence**

Degree to which independently conducted work remains compatible when recomposed.

## **11.8 Domain Coherence**

Degree to which domain-specific reasoning complies with the governing PWA.

---

# **12\. Canonical Invariants**

The following invariants are normative.

## **INV-001 — Intent Traceability**

Every material Decision, Action, Representation, and PWU SHALL trace to at least one active Intent or explicitly declared exploratory purpose.

## **INV-002 — Explicit Provenance**

Every Claim, Representation, Decision, Evidence item, and Reasoning Activity SHALL identify its origin.

## **INV-003 — AI Attribution**

Every AI-generated entity SHALL identify the responsible AI Participant, execution context, and relevant model or agent identity.

## **INV-004 — Evidence Separation**

Evidence SHALL remain distinguishable from the Claim it supports.

## **INV-005 — Assumption Visibility**

A critical Assumption SHALL NOT remain implicit once detected.

## **INV-006 — Decision Rationale**

Every material approved Decision SHALL preserve rationale, authority, considered Alternatives, and residual Uncertainty.

## **INV-007 — State Explicitness**

Lifecycle state SHALL be explicit. Missing fields SHALL NOT imply workflow state.

## **INV-008 — Historical Reconstructability**

Superseded material entities SHALL remain reconstructable when required for professional reasoning, audit, or governance.

## **INV-009 — Validation Before Authority**

An entity SHALL NOT be represented as validated, approved, or authoritative without an explicit Validation or Decision establishing that status.

## **INV-010 — Observation–Interpretation Separation**

Observed facts, interpretations, and derived Claims SHALL remain distinguishable.

## **INV-011 — Recursive Traceability**

A child PWU SHALL trace to the parent purpose, delegated scope, and recomposition obligation.

## **INV-012 — No Completion by Activity Alone**

Completion SHALL be determined by professional completion conditions, not merely by execution of planned activities.

## **INV-013 — Coherence Conflict Visibility**

Detected contradictions SHALL remain visible until resolved, accepted, deferred, or explicitly dismissed.

## **INV-014 — Intent Change Explicitness**

A change in Intent SHALL produce a new version, superseding relationship, or authorized amendment.

## **INV-015 — Confidence Basis**

Every material Confidence Assessment SHALL identify its basis.

## **INV-016 — Constraint Enforcement**

Mandatory Constraints SHALL be evaluated before a conflicting Decision becomes effective.

## **INV-017 — Reconciliation Preservation**

Reconciliation SHALL preserve both the prior state and the rationale for the updated state.

## **INV-018 — Projection Non-Authority**

No UI projection, cache, report, or denormalized view SHALL independently become authoritative.

## **INV-019 — Human Oversight Availability**

Material AI-originated conclusions SHALL remain reviewable by an authorized human unless a PWA explicitly defines a governed autonomous operating mode.

## **INV-020 — Escalation of Unresolved Professional Failure**

A harness SHALL escalate when its authority, evidence, capability, or search process is insufficient to continue responsibly.

---

# **13\. Contradiction Model**

Contradictions SHALL be first-class entities or relationships.

## **13.1 Contradiction Types**

claim\_vs\_claim  
claim\_vs\_evidence  
representation\_vs\_representation  
representation\_vs\_reality  
decision\_vs\_constraint  
action\_vs\_intent  
observation\_vs\_expectation  
pwu\_vs\_pwu  
policy\_vs\_policy  
authority\_vs\_authority

## **13.2 Contradiction State**

detected  
confirmed  
under\_investigation  
temporarily\_tolerated  
resolved  
dismissed  
escalated

## **13.3 Resolution Methods**

evidence\_precedence  
authority\_decision  
scope\_separation  
temporal\_separation  
representation\_revision  
assumption\_invalidation  
intent\_revision  
accepted\_tradeoff

A contradiction SHALL NOT be erased merely because one representation is newer.

---

# **14\. Temporal and Version Model**

CPCO SHALL distinguish four forms of time:

## **14.1 Transaction Time**

When the platform recorded a fact.

## **14.2 Valid Time**

When the fact was considered true or applicable.

## **14.3 Observation Time**

When reality was observed.

## **14.4 Decision Effective Time**

When a Decision became operative.

This distinction is required because professional understanding may be updated after the fact.

Example:

Observation occurred: July 1  
Observation recorded: July 3  
Claim revised: July 4  
Decision effective: July 6

All four times may be relevant.

---

# **15\. Event Model**

Every material semantic transition SHALL emit a domain event.

## **15.1 Canonical Event Envelope**

eventId  
eventType  
occurredAt  
recordedAt  
actorId  
correlationId  
causationId  
endeavorId  
pwuId  
entityId  
entityVersion  
payload  
provenance

## **15.2 Core Event Types**

IntentCreated  
IntentRevised  
IntentSuperseded

OutcomeDefined  
OutcomeAssessmentChanged

QuestionOpened  
QuestionResolved

UncertaintyIdentified  
UncertaintyReduced  
UncertaintyAccepted

AssumptionCreated  
AssumptionValidated  
AssumptionInvalidated

ClaimProposed  
ClaimSupported  
ClaimContested  
ClaimRefuted

EvidenceAdded  
EvidenceReclassified  
EvidenceInvalidated

ReasoningStarted  
ReasoningCompleted  
ReasoningFailed  
ReasoningEscalated

AlternativeIdentified  
AlternativeRejected  
AlternativeSelected

DecisionProposed  
DecisionApproved  
DecisionRejected  
DecisionReopened  
DecisionSuperseded

ActionAuthorized  
ActionStarted  
ActionCompleted  
ActionFailed

ObservationRecorded  
UnexpectedObservationDetected

ValidationStarted  
ValidationPassed  
ValidationFailed  
ValidationInconclusive

ContradictionDetected  
ContradictionResolved

ReconciliationTriggered  
ReconciliationProposed  
ReconciliationApplied  
ReconciliationEscalated

PWUCreated  
PWUActivated  
PWUBlocked  
PWUCompleted  
PWUReopened

HarnessCreated  
HarnessDelegated  
HarnessAwaitingHuman  
HarnessEscalated  
HarnessCompleted  
HarnessFailed

---

# **16\. Reference UX Projection Model**

The UI SHALL be derived from CPCO entities, PCLC state, user role, and current professional objective.

## **16.1 Canonical Projections**

### **Outcome Projection**

Shows:

* desired outcomes;  
* success criteria;  
* current assessment;  
* threats;  
* supporting and conflicting work.

### **Intent Projection**

Shows:

* active intent;  
* rationale;  
* constraints;  
* non-goals;  
* superseded intent;  
* affected PWUs.

### **Understanding Projection**

Shows:

* known claims;  
* open questions;  
* uncertainty;  
* assumptions;  
* confidence.

### **Reasoning Projection**

Shows:

* active reasoning activities;  
* inputs;  
* methods;  
* participants;  
* alternatives;  
* emerging outputs.

### **Evidence Projection**

Shows:

* evidence network;  
* provenance;  
* reliability;  
* claims supported or contradicted;  
* evidence gaps.

### **Decision Projection**

Shows:

* pending decisions;  
* authority;  
* alternatives;  
* rationale;  
* evidence;  
* constraints;  
* residual uncertainty.

### **Execution Projection**

Shows:

* authorized actions;  
* execution state;  
* produced artifacts;  
* affected outcomes;  
* operational dependencies.

### **Observation Projection**

Shows:

* observations;  
* expected versus observed state;  
* anomalies;  
* emerging evidence.

### **Reconciliation Projection**

Shows:

* detected incoherence;  
* affected entities;  
* proposed changes;  
* downstream impact;  
* approval state.

### **Decomposition Projection**

Shows:

* parent and child PWUs;  
* delegated scope;  
* dependency structure;  
* recomposition obligations;  
* local versus global coherence.

## **16.2 Persistent Cognitive Context**

Every material workspace SHOULD preserve access to:

currentIntent  
currentObjective  
currentUncertainty  
currentConfidence  
currentDependencies  
currentParticipants  
currentEvidence  
currentLifecycleState  
pendingReconciliation

## **16.3 UI Prohibitions**

The interface SHALL NOT:

* present completion percentages without explaining their semantic basis;  
* use a single status color as a substitute for professional state;  
* hide uncertainty behind generic “in progress” labels;  
* merge AI and human contributions without attribution;  
* display a Decision without access to rationale;  
* display Evidence without provenance;  
* display a derived Representation as though it were reality;  
* treat folder hierarchy as the primary model of professional cognition.

---

# **17\. Agent Interaction Contract**

Every AI Participant SHALL operate through an explicit professional contract.

## **17.1 Required Inputs**

assignedRole  
objective  
originatingIntent  
scope  
authority  
constraints  
availableEvidence  
applicableRepresentations  
openQuestions  
requiredOutputs  
validationCriteria  
terminationConditions  
escalationConditions

## **17.2 Required Outputs**

producedEntities  
reasoningSummary  
assumptionsIntroduced  
evidenceUsed  
claimsProduced  
confidenceAssessments  
unresolvedQuestions  
residualUncertainty  
validationResults  
recommendedNextActions  
provenance

## **17.3 Agent Prohibitions**

An AI Participant SHALL NOT:

* silently broaden scope;  
* substitute a different Intent;  
* represent unsupported Claims as facts;  
* hide assumptions;  
* mark its own output approved unless explicitly authorized;  
* suppress contradictory Evidence;  
* infer human approval;  
* terminate without recording unresolved material conditions;  
* claim outcome achievement based only on artifact production.

---

# **18\. Minimum Viable Implementation Profile**

The first Janumi implementation need not implement every CPCO entity at maximum sophistication.

A minimum viable compliant implementation SHALL support:

## **18.1 Required Entities**

ProfessionalEndeavor  
Outcome  
Intent  
Participant  
PWU  
Question  
Uncertainty  
Representation  
Assumption  
Constraint  
Claim  
Evidence  
ConfidenceAssessment  
ReasoningActivity  
Decision  
Action  
Observation  
Dependency  
Validation  
Reconciliation

## **18.2 Required Relationships**

traces\_to\_intent  
supports  
contradicts  
depends\_on  
produced\_by  
derived\_from  
justifies  
implements  
observed\_by  
validated\_by  
supersedes  
contains

## **18.3 Required Platform Behaviors**

* explicit provenance;  
* explicit lifecycle state;  
* parent-child PWU decomposition;  
* reasoning and decision traceability;  
* evidence-to-claim relationships;  
* human and AI attribution;  
* validation records;  
* contradiction detection;  
* reconciliation records;  
* event emission;  
* role-aware projections.

## **18.4 Required UI Surfaces**

* Endeavor overview;  
* PWU workspace;  
* decomposition view;  
* reasoning view;  
* evidence view;  
* decision view;  
* reconciliation view;  
* history and provenance view.

---

# **19\. Initial Persistence Guidance**

CPCO is naturally graph-shaped, but graph semantics do not mandate a graph database.

A practical initial implementation MAY use:

* PostgreSQL for authoritative persistence;  
* typed relational entities;  
* relationship tables;  
* JSONB for subtype-specific properties;  
* event log for temporal evolution;  
* materialized projections for UI queries;  
* search index for retrieval;  
* object storage for large Artifacts.

The implementation SHOULD preserve the ability to project the data as a property graph.

## **19.1 Recommended Core Tables**

entities  
entity\_versions  
relationships  
relationship\_versions  
participants  
endeavors  
work\_units  
events  
validations  
reconciliations  
artifacts

## **19.2 Entity Table Pattern**

id  
entity\_type  
subtype  
endeavor\_id  
current\_version\_id  
lifecycle\_state  
validity\_state  
created\_by  
created\_at  
updated\_at

## **19.3 Version Table Pattern**

version\_id  
entity\_id  
version\_number  
payload  
valid\_from  
valid\_until  
created\_by  
created\_at  
change\_reason  
supersedes\_version\_id

## **19.4 Relationship Table Pattern**

relationship\_id  
relationship\_type  
source\_entity\_id  
target\_entity\_id  
properties  
valid\_from  
valid\_until  
created\_by  
created\_at

---

# **20\. Initial API Guidance**

The API SHOULD expose semantic operations rather than CRUD alone.

Examples:

createIntent()  
reviseIntent()  
identifyUncertainty()  
proposeClaim()  
attachSupportingEvidence()  
contradictClaim()  
recordReasoningActivity()  
proposeDecision()  
approveDecision()  
authorizeAction()  
recordObservation()  
validateEntity()  
triggerReconciliation()  
decomposePWU()  
completePWU()  
reopenPWU()

Generic CRUD MAY exist internally, but public contracts SHOULD encode professional meaning.

---

# **21\. Validation Architecture**

Validators SHALL operate at multiple layers.

## **21.1 Structural Validators**

Check schema and relationship correctness.

Example:

* a Decision references at least one Intent;  
* an Evidence relationship identifies its target Claim.

## **21.2 Semantic Validators**

Check conceptual correctness.

Example:

* a deliverable has not been misclassified as an Outcome;  
* a Decision has not been represented as a verified fact.

## **21.3 Professional Validators**

Check domain-specific practice.

Example:

* a software architecture decision contains required trade-off analysis;  
* a legal conclusion cites applicable authority;  
* a scientific claim includes appropriate evidence.

## **21.4 Coherence Validators**

Check cross-entity alignment.

Example:

* implementation does not violate architecture;  
* test strategy covers material requirements;  
* current work remains aligned with active Intent.

## **21.5 Governance Validators**

Check authority and policy.

Example:

* the approving Participant possesses required authority;  
* a regulated change received required review.

## **21.6 Temporal Validators**

Check currency and validity.

Example:

* Evidence has not expired;  
* a Constraint reflects the current regulation;  
* a Representation is not based on a superseded Intent.

---

# **22\. Observability Model**

Janumi SHALL emit observability data for both computational execution and professional cognition.

## **22.1 Computational Observability**

latency  
errors  
retries  
tool\_calls  
token\_usage  
resource\_usage  
workflow\_state

## **22.2 Cognitive Observability**

open\_uncertainty\_count  
critical\_assumption\_count  
unsupported\_claim\_count  
confidence\_change  
decision\_wait\_time  
evidence\_gap\_count  
contradiction\_count  
reconciliation\_backlog  
blocked\_dependency\_count  
intent\_drift\_score  
validation\_failure\_count  
human\_review\_backlog

## **22.3 Coherence Signals**

A coherence signal SHALL explain its basis.

A single synthetic coherence score MAY be provided for orientation, but SHALL NOT replace the underlying dimensions.

---

# **23\. Semantic Boundary Rules**

The following distinctions SHALL remain explicit throughout the platform.

Outcome ≠ Artifact  
Intent ≠ Requirement  
Question ≠ Uncertainty  
Observation ≠ Evidence  
Evidence ≠ Claim  
Claim ≠ Decision  
Decision ≠ Truth  
Decision ≠ Action  
Action ≠ Outcome  
Representation ≠ Reality  
Participant ≠ Stakeholder  
Ownership ≠ Authority  
Completion ≠ Validation  
Validation ≠ Approval  
Confidence ≠ Certainty  
PWU ≠ Task  
RPH ≠ Workflow Engine  
Narrative Memory ≠ Source of Truth  
UI Projection ≠ Authoritative Model

These distinctions are essential to prevent conventional project-management or document-management semantics from re-entering the architecture.

---

# **24\. Implementation Decision Rules**

When an engineer or coding agent encounters an ambiguous design decision, it SHALL apply the following sequence:

1. Identify the professional outcome being supported.  
2. Identify the active Intent.  
3. Identify the professional uncertainty or decision involved.  
4. Identify the CPCO entities being created, transformed, or inspected.  
5. Identify the relevant lifecycle state.  
6. Identify the required provenance and validation.  
7. Identify the coherence implications.  
8. Determine the appropriate PWU boundary.  
9. Determine whether RPH coordination is required.  
10. Select the UI projection that best supports the cognitive activity.  
11. Implement the narrowest mechanism that satisfies these semantics.  
12. Reject conventional UI or workflow patterns that obscure the model.

---

# **25\. Conformance Test**

A Janumi implementation is CPCO-conformant only if it can answer, for every material professional object:

* What is this?  
* Why does it exist?  
* Which Intent does it serve?  
* Which Outcome does it affect?  
* Who or what created it?  
* What Evidence supports it?  
* Which Assumptions does it depend on?  
* What is its current validity?  
* What uncertainty remains?  
* What decisions depend upon it?  
* What changed it?  
* What has superseded it?  
* What reconciliation has occurred?  
* How does it relate to its parent and dependent work?  
* Can its reasoning history be reconstructed?

An implementation that cannot answer these questions may store professional artifacts, but it does not yet represent professional cognition.

---

# **26\. Immediate Engineering Consequences**

The coding agent implementing the Janumi UI/UX SHALL now work from the following architecture:

CPCO Semantic Model  
        ↓  
PWU Aggregate Model  
        ↓  
RPH Coordination Model  
        ↓  
PCLC State  
        ↓  
Role- and Purpose-Specific Projection  
        ↓  
UI Components

It SHALL NOT begin from:

Pages  
  ↓  
Components  
  ↓  
Forms  
  ↓  
Backend Tables

The primary frontend abstraction is therefore not the page.

It is the **Cognitive Projection**.

The primary backend abstraction is not the task.

It is the **Versioned Cognitive Entity and Relationship**.

The primary orchestration abstraction is not the workflow step.

It is the **Professionally Meaningful State Transition**.

The primary validation abstraction is not schema compliance.

It is the **Preservation of Professional Coherence**.

---

# **27\. Next Normative Artifacts**

This specification establishes the semantic source of truth. The next engineering artifacts shall be derived in this order:

1. **CPCO Machine Schema**  
   * entity definitions;  
   * relationship definitions;  
   * enums;  
   * validation constraints;  
   * JSON Schema or equivalent.  
2. **PWU Aggregate Specification**  
   * commands;  
   * lifecycle transitions;  
   * completion rules;  
   * decomposition and recomposition behavior.  
3. **RPH Coordination Specification**  
   * control states;  
   * orchestration policies;  
   * escalation;  
   * retry and tactic-change logic;  
   * human intervention points.  
4. **Reference Interaction Model**  
   * cognitive projections;  
   * navigation;  
   * zoom;  
   * context preservation;  
   * cross-projection transitions.  
5. **Reference UI Specification**  
   * shell;  
   * workspace anatomy;  
   * component semantics;  
   * interaction invariants;  
   * responsive profiles.  
6. **JanumiCode PWA Profile**  
   * requirements;  
   * architecture;  
   * implementation;  
   * verification;  
   * release;  
   * operational feedback.

---

# **Closing Statement**

CPCO establishes the core architectural truth of Janumi:

Professional work is not fundamentally a collection of tasks, documents, or workflows. It is an evolving, distributed, evidence-bearing system of intent, uncertainty, representations, reasoning, decisions, actions, observations, and reconciliation.

Professional Work Units bound that cognition.

Recursive Professional Harnesses coordinate it.

Professional Work Architectures specialize it.

The Living Enterprise Model projects its current global state.

The Janumi interface makes it inspectable and operable.

Continuous reconciliation keeps it coherent.

\===

# **Professional Work Unit Aggregate Specification**

## **PWU Specification v0.1**

**Status:** Normative draft  
**Depends on:** Canonical Professional Cognition Ontology v0.1  
**Applies to:** Janumi Platform, Recursive Professional Harnesses, Professional Work Architectures, user interfaces, agents, validators, APIs, persistence, and observability  
**Primary audiences:** Platform architects, coding agents, backend engineers, frontend engineers, workflow engineers, agent developers, PWA authors, validator developers

---

# **1\. Purpose**

This specification defines the **Professional Work Unit**, or PWU, as the canonical bounded aggregate through which professional cognition is framed, advanced, coordinated, validated, reconciled, and completed within Janumi.

The CPCO defines the semantic entities of professional cognition.

This specification defines how those entities are assembled into a governable unit of professional work.

A PWU is not:

* a task;  
* a ticket;  
* a document container;  
* a folder;  
* a workflow run;  
* an agent conversation;  
* a project-management record;  
* a generic graph node;  
* a unit of computational execution.

A PWU is a bounded region of professional cognition organized around a meaningful objective, uncertainty, decision, obligation, or outcome.

---

# **2\. Canonical Definition**

A **Professional Work Unit** is:

A bounded, versioned, governable aggregate of intent, professional objective, uncertainty, representations, reasoning, evidence, decisions, actions, observations, dependencies, validations, participants, and history that can be understood, coordinated, evaluated, reconciled, and recomposed as one professionally meaningful unit.

A PWU establishes a local coherence boundary.

Within that boundary, Janumi must be able to determine:

* why the work exists;  
* what it is intended to accomplish;  
* what is known;  
* what remains uncertain;  
* what reasoning is being performed;  
* what evidence is available;  
* what decisions have been made;  
* what actions are authorized;  
* what dependencies exist;  
* what has changed;  
* what completion means;  
* how this work contributes to broader outcomes.

---

# **3\. Aggregate Boundary**

The PWU aggregate owns the professional state required to govern one bounded area of work.

## **3.1 Aggregate Root**

The `ProfessionalWorkUnit` is the aggregate root.

All state-changing operations affecting the PWU SHALL be authorized through the aggregate root or an explicitly governed service acting on its behalf.

## **3.2 Owned State**

A PWU SHALL directly own or maintain authoritative references to:

ProfessionalWorkUnit  
├── Identity and Type  
├── Professional Objective  
├── Originating Intent  
├── Scope  
├── Lifecycle State  
├── Cognitive State  
├── Authority and Governance  
├── Participants and Roles  
├── Questions  
├── Uncertainties  
├── Assumptions  
├── Constraints  
├── Representations  
├── Reasoning Activities  
├── Claims  
├── Evidence  
├── Confidence Assessments  
├── Alternatives  
├── Decisions  
├── Actions  
├── Observations  
├── Risks  
├── Issues  
├── Dependencies  
├── Validations  
├── Reconciliations  
├── Child PWUs  
├── Completion Conditions  
├── Escalation Conditions  
├── History  
└── Observability State

## **3.3 Referenced State**

A PWU MAY reference entities governed outside its aggregate boundary, including:

* organizational policies;  
* external regulations;  
* enterprise capabilities;  
* shared representations;  
* reusable methods;  
* authoritative data sources;  
* parent PWUs;  
* peer PWUs;  
* external systems;  
* shared participants;  
* global outcomes.

Externally governed entities SHALL NOT be silently modified through the PWU.

Changes requiring cross-boundary mutation SHALL use an explicit command, event, reconciliation, or governed service.

---

# **4\. PWU Identity**

Every PWU SHALL possess:

pwuId  
pwuType  
title  
professionalObjective  
endeavorId  
parentPwuId?  
rootPwuId  
version  
createdAt  
createdBy

## **4.1 Stable Identity**

The `pwuId` SHALL remain stable across:

* lifecycle changes;  
* reassignment;  
* decomposition;  
* reopening;  
* reconciliation;  
* representation changes;  
* title changes.

## **4.2 Root Relationship**

Every PWU SHALL identify its root PWU.

For a root PWU:

rootPwuId \== pwuId  
parentPwuId \== null

For a child PWU:

rootPwuId \== ancestor root  
parentPwuId \== immediate parent

---

# **5\. PWU Type Model**

PWU types express the dominant professional purpose of the aggregate.

Canonical types include:

discovery  
framing  
research  
analysis  
design  
planning  
decision  
implementation  
execution  
verification  
validation  
review  
reconciliation  
incident  
remediation  
governance  
integration  
observation  
learning

A PWA MAY define specialized subtypes.

Examples in JanumiCode:

intent\_formalization  
user\_journey\_generation  
requirements\_analysis  
architecture\_design  
data\_model\_design  
implementation\_slice  
test\_strategy  
security\_review  
release\_readiness  
production\_incident

## **5.1 Type Is Not State**

A PWU type describes what kind of professional work is being performed.

Lifecycle state describes where that work currently stands.

These SHALL remain separate.

## **5.2 Type Evolution**

A PWU SHOULD NOT change type after activation unless the original classification was incorrect.

When the professional objective materially changes, the preferred response is:

* revise scope;  
* create a successor PWU;  
* decompose the work;  
* supersede the original PWU.

---

# **6\. Professional Objective**

Every PWU SHALL possess one explicit professional objective.

The objective SHALL state:

* the professionally meaningful result sought;  
* the uncertainty, obligation, decision, or outcome being addressed;  
* the intended contribution to broader work.

A valid objective describes a cognitive or real-world result.

Valid examples:

* Determine whether the proposed authentication architecture satisfies enterprise security constraints.  
* Produce and validate a domain model sufficient to implement tenant billing.  
* Resolve the contradiction between the approved requirements and the current implementation.  
* Establish whether the drainage design adequately addresses shallow groundwater affecting the identified properties.

Invalid examples:

* Work on authentication.  
* Create some files.  
* Run the agent.  
* Complete ticket 481\.  
* Review the document.

These may describe activity but not a professional objective.

---

# **7\. PWU Scope**

Every PWU SHALL define an explicit scope.

## **7.1 Scope Components**

included  
excluded  
boundaryConditions  
affectedDomains  
affectedSystems  
timeHorizon  
geographicScope  
organizationalScope

## **7.2 Non-Goals**

Material non-goals SHOULD be recorded explicitly.

Non-goals prevent:

* accidental scope expansion;  
* speculative implementation;  
* over-generalization;  
* substitution of adjacent objectives;  
* unbounded agent exploration.

## **7.3 Scope Change**

A material scope change SHALL produce:

* a new PWU version;  
* a change rationale;  
* an assessment of downstream impact;  
* updated completion conditions;  
* updated dependencies;  
* a reconciliation event where necessary.

An AI Participant SHALL NOT materially broaden scope without authorization.

---

# **8\. Dual State Model**

A PWU SHALL maintain two distinct state dimensions:

1. **Lifecycle State**  
2. **Cognitive State**

These SHALL NOT be collapsed into a single status field.

---

# **9\. Lifecycle State**

Lifecycle state describes the governance and execution condition of the PWU.

Canonical lifecycle states are:

proposed  
framing  
ready  
active  
blocked  
awaiting\_evidence  
awaiting\_decision  
awaiting\_review  
awaiting\_external  
reconciling  
suspended  
completed  
cancelled  
superseded  
reopened  
failed

## **9.1 Proposed**

The PWU has been identified but has not yet been sufficiently framed.

Permitted conditions:

* objective may be provisional;  
* scope may be incomplete;  
* participants may be unassigned;  
* completion conditions may be undefined.

The PWU SHALL NOT begin authoritative execution in this state.

## **9.2 Framing**

The objective, scope, authority, inputs, uncertainties, and completion conditions are being established.

Exit criteria SHOULD include:

* objective defined;  
* originating Intent linked;  
* scope defined;  
* initial uncertainties identified;  
* required authority identified;  
* completion conditions defined;  
* blocking prerequisites identified.

## **9.3 Ready**

The PWU is sufficiently framed to begin active work.

A ready PWU SHALL have:

* valid professional objective;  
* active Intent or exploratory purpose;  
* explicit scope;  
* responsible participant or harness;  
* applicable constraints;  
* initial completion conditions;  
* no unresolved mandatory framing validation failure.

## **9.4 Active**

Professional cognition or action is currently advancing.

Active does not imply unblocked progress. A temporary local delay may exist without requiring a lifecycle transition.

## **9.5 Blocked**

The PWU cannot responsibly advance because a required condition is unsatisfied.

A blocked PWU SHALL identify:

blockingCondition  
blockedBy  
blockedAt  
requiredResolution  
escalationDeadline?

## **9.6 Awaiting Evidence**

Advancement depends on evidence that has not yet been obtained or validated.

## **9.7 Awaiting Decision**

Advancement depends on an authorized decision.

## **9.8 Awaiting Review**

Work has reached a review boundary and requires evaluation by an authorized Participant.

## **9.9 Awaiting External**

Advancement depends on a person, organization, system, event, or condition outside the immediate Janumi-controlled work context.

## **9.10 Reconciling**

A material coherence issue is being analyzed or resolved.

During reconciliation:

* prior state remains reconstructable;  
* affected entities are identified;  
* downstream impact is assessed;  
* completion SHALL NOT be declared unless reconciliation is complete or formally deferred.

## **9.11 Suspended**

Work is intentionally paused.

Suspension SHALL record:

* authority;  
* reason;  
* resume condition;  
* effects on dependent PWUs.

## **9.12 Completed**

The PWU satisfies its professional completion conditions.

Completion SHALL NOT be inferred from:

* all subtasks being checked;  
* an agent reaching its final step;  
* a workflow terminating;  
* an artifact being generated;  
* a pull request being merged;  
* a human saying “done” without satisfying completion rules.

## **9.13 Cancelled**

The work will not continue and has not achieved its objective.

Cancellation SHALL preserve:

* cancellation authority;  
* rationale;  
* completed outputs;  
* transferable knowledge;  
* downstream effects.

## **9.14 Superseded**

Another PWU has replaced this PWU as the governing work context.

The superseding PWU SHALL be identified.

## **9.15 Reopened**

A previously completed, cancelled, failed, or superseded PWU has resumed because:

* new evidence emerged;  
* an assumption failed;  
* intent changed;  
* validation failed;  
* observed reality diverged;  
* prior completion was invalid.

Reopening SHALL preserve the prior closure record.

## **9.16 Failed**

The PWU could not responsibly complete its objective within its authority, capability, constraints, or escalation rules.

Failure SHALL identify:

* failure class;  
* work completed;  
* unresolved conditions;  
* attempted tactics;  
* evidence gathered;  
* recommended disposition.

---

# **10\. Cognitive State**

Cognitive state describes the current region of the Professional Cognition Life Cycle being emphasized.

Canonical cognitive states are:

intent  
understanding  
representation  
reasoning  
decision  
action  
observation  
reconciliation

A PWU MAY contain activity across multiple cognitive states, but one state SHOULD be designated as currently dominant.

## **10.1 Intent State**

The desired result and rationale are being established or revised.

## **10.2 Understanding State**

The problem, context, known facts, assumptions, and uncertainties are being developed.

## **10.3 Representation State**

Understanding is being externalized into requirements, models, plans, specifications, code, contracts, or other representations.

## **10.4 Reasoning State**

Representations are being analyzed, transformed, compared, decomposed, synthesized, tested, or critiqued.

## **10.5 Decision State**

An authorized commitment is being prepared, reviewed, or made.

## **10.6 Action State**

Reality or an operational system is being changed.

## **10.7 Observation State**

Results, measurements, telemetry, feedback, or conditions are being recorded and interpreted.

## **10.8 Reconciliation State**

Current understanding is being updated to restore coherence.

---

# **11\. State Transition Rules**

All material lifecycle transitions SHALL be explicit, validated, and evented.

## **11.1 Canonical Lifecycle Transitions**

proposed → framing  
framing → ready  
framing → cancelled  
ready → active  
ready → suspended  
active → blocked  
active → awaiting\_evidence  
active → awaiting\_decision  
active → awaiting\_review  
active → awaiting\_external  
active → reconciling  
active → completed  
active → failed  
active → suspended  
blocked → active  
blocked → reconciling  
blocked → failed  
awaiting\_evidence → active  
awaiting\_evidence → reconciling  
awaiting\_decision → active  
awaiting\_decision → cancelled  
awaiting\_review → active  
awaiting\_review → completed  
awaiting\_review → reconciling  
awaiting\_external → active  
awaiting\_external → failed  
reconciling → active  
reconciling → awaiting\_decision  
reconciling → completed  
reconciling → failed  
suspended → ready  
suspended → active  
suspended → cancelled  
completed → reopened  
cancelled → reopened  
failed → reopened  
superseded → reopened  
any\_non\_terminal → cancelled  
any\_non\_terminal → superseded

## **11.2 Illegal Transitions**

The following SHALL be illegal without an intermediate governed transition:

proposed → completed  
framing → completed  
ready → completed  
blocked → completed  
cancelled → active  
completed → active  
failed → active  
superseded → active

A closed PWU must first transition to `reopened`.

## **11.3 Transition Preconditions**

Every transition SHALL define:

sourceState  
targetState  
requestedBy  
authority  
preconditions  
validationResults  
transitionReason  
occurredAt

## **11.4 Transition Failure**

When a transition fails validation:

* the current state SHALL remain unchanged;  
* failure reasons SHALL be returned;  
* the attempted transition SHOULD be observable;  
* no partial semantic transition SHALL occur.

---

# **12\. Framing Contract**

A PWU SHALL satisfy a minimum framing contract before activation.

## **12.1 Required Framing Elements**

professionalObjective  
originatingIntent  
scope  
responsibleParticipantOrHarness  
initialQuestionsOrUncertainties  
applicableConstraints  
requiredInputs  
completionConditions  
validationRequirements  
escalationConditions

## **12.2 Framing Validation**

A PWU SHALL NOT become `ready` when:

* the objective is activity-only;  
* no Intent or exploratory purpose exists;  
* scope is materially ambiguous;  
* mandatory authority is absent;  
* a known mandatory constraint is unresolved;  
* completion is defined only as artifact generation;  
* the PWU duplicates existing work without an explicit relationship;  
* required parent delegation information is missing.

---

# **13\. Participant and Role Model**

PWU participation SHALL be role-based and explicit.

## **13.1 Canonical PWU Roles**

sponsor  
owner  
steward  
coordinator  
contributor  
reasoner  
executor  
reviewer  
validator  
approver  
observer  
subject\_matter\_expert  
affected\_stakeholder  
external\_dependency

## **13.2 Role Semantics**

### **Sponsor**

Authorizes or materially supports the professional objective.

### **Owner**

Accountable for the PWU reaching a valid disposition.

### **Steward**

Maintains semantic quality, traceability, and coherence.

### **Coordinator**

Advances work across Participants and dependencies.

### **Contributor**

Produces or improves professional entities.

### **Reasoner**

Performs analysis, synthesis, design, diagnosis, or related cognition.

### **Executor**

Performs authorized Actions that change reality or operational systems.

### **Reviewer**

Evaluates work but does not necessarily establish authoritative validity.

### **Validator**

Performs an explicit Validation against declared criteria.

### **Approver**

Possesses authority to establish an approved Decision or accepted result.

### **Observer**

Receives updates or inspects state without changing it.

## **13.3 Human and AI Roles**

Both humans and AI Participants MAY occupy supported roles.

AI role assignments SHALL declare:

* delegated authority;  
* prohibited actions;  
* required review points;  
* tool permissions;  
* evidence requirements;  
* escalation conditions.

## **13.4 Role Conflicts**

A PWA MAY prohibit a Participant from serving in conflicting roles.

Examples:

* an AI executor may not approve its own material work;  
* an author may not satisfy independent validation requirements;  
* a reviewer may advise without possessing approval authority.

---

# **14\. Input Model**

Inputs are CPCO entities or external references required to begin or advance the PWU.

## **14.1 Input Categories**

intent  
representation  
evidence  
observation  
decision  
constraint  
policy  
artifact  
external\_data  
parent\_context  
method  
tool

## **14.2 Input Readiness**

Each required input SHALL declare:

required  
availability  
validity  
freshness  
authority  
version

## **14.3 Input Trust Boundary**

All external inputs SHALL be treated as untrusted until normalized and validated according to the governing PWA.

The PWU SHALL distinguish:

* received;  
* parsed;  
* normalized;  
* validated;  
* accepted for use;  
* rejected.

---

# **15\. Output Model**

Outputs are entities created, revised, validated, or reconciled through the PWU.

## **15.1 Output Categories**

representation  
claim  
evidence  
decision  
action  
artifact  
observation  
validation  
reconciliation  
child\_pwu  
narrative\_memory

## **15.2 Output Contract**

Every required output SHALL define:

outputType  
semanticPurpose  
acceptanceCriteria  
requiredValidation  
authoritativeStatus  
downstreamConsumers

## **15.3 Output Absence**

Where a PWU produces no valid output, it SHALL record:

* why;  
* what was attempted;  
* what was learned;  
* whether the objective remains unresolved;  
* whether escalation is required.

“No result” may be professionally meaningful and SHALL NOT be silently converted into success.

---

# **16\. Question and Uncertainty Model**

Questions and uncertainties SHALL drive work rather than remain incidental annotations.

## **16.1 Initial Uncertainty**

At framing, the PWU SHOULD identify:

* primary uncertainty;  
* secondary uncertainties;  
* uncertainty type;  
* decision impact;  
* known reduction methods.

## **16.2 Uncertainty Evolution**

An uncertainty MAY be:

identified  
characterized  
reduced  
transformed  
accepted  
transferred  
deferred  
resolved  
invalidated

## **16.3 Residual Uncertainty**

Completion MAY occur with residual uncertainty only when:

* it is explicitly documented;  
* its impact is assessed;  
* an authorized Participant accepts it;  
* dependent Decisions and PWUs can inspect it;  
* required mitigations are recorded.

---

# **17\. Assumptions and Constraints**

## **17.1 Assumption Registration**

A detected material assumption SHALL be registered as an entity.

An assumption SHALL include:

* statement;  
* scope;  
* basis;  
* criticality;  
* validation method;  
* dependent entities.

## **17.2 Critical Assumptions**

Critical assumptions SHOULD be visible in the default PWU workspace.

A critical assumption is one whose invalidation could materially alter:

* the objective;  
* a decision;  
* architecture;  
* safety;  
* legality;  
* cost;  
* schedule;  
* outcome confidence.

## **17.3 Constraint Evaluation**

Mandatory constraints SHALL be evaluated at:

* framing;  
* relevant decisions;  
* action authorization;  
* completion;  
* reconciliation.

---

# **18\. Reasoning Activity Model**

Reasoning Activities are explicit bounded transformations within the PWU.

## **18.1 Required Reasoning Record**

reasoningActivityId  
reasoningType  
purpose  
inputEntityIds  
method  
performedBy  
startedAt  
completedAt?  
status  
outputEntityIds  
assumptionsIntroduced  
limitations

## **18.2 Reasoning Status**

planned  
active  
paused  
completed  
failed  
inconclusive  
invalidated  
superseded

## **18.3 Reasoning Completion**

A Reasoning Activity SHALL NOT be marked complete unless:

* outputs are identified;  
* absence of outputs is explicitly recorded;  
* limitations are captured where material;  
* provenance is complete;  
* unresolved material uncertainty is surfaced.

## **18.4 AI Reasoning**

AI-generated reasoning SHALL record, where available:

agentId  
modelIdentity  
modelVersion  
promptOrInstructionReference  
contextReferences  
toolCalls  
executionParameters  
tokenOrResourceUse  
validationStatus

The platform MAY store a concise reasoning summary rather than hidden internal chain-of-thought.

The summary SHALL be sufficient to reconstruct the professional basis of the output without requiring private model internals.

---

# **19\. Claim, Evidence, and Confidence Model**

## **19.1 Claim Registration**

A material conclusion SHALL be represented as a Claim rather than embedded only in prose.

## **19.2 Evidence Relationship**

Evidence SHALL connect explicitly to Claims through typed relationships:

supports  
contradicts  
qualifies  
inconclusive\_for

## **19.3 Confidence Change**

A change in Claim confidence SHOULD record:

priorAssessment  
newAssessment  
changeReason  
evidenceAddedOrRemoved  
assumptionsChanged  
assessedBy

## **19.4 Unsupported Claims**

The PWU SHALL expose material Claims lacking sufficient Evidence.

Unsupported does not necessarily mean false.

It means the current evidentiary basis is insufficient for the required use.

---

# **20\. Decision Model**

Material decisions SHALL be explicit entities within the PWU.

## **20.1 Decision Readiness**

A decision may become `pending` only when:

* the decision question is explicit;  
* authority is known;  
* relevant alternatives are available or their absence is justified;  
* material constraints are identified;  
* available evidence is linked;  
* residual uncertainty is visible.

## **20.2 Decision Approval**

Approval SHALL capture:

decisionId  
decisionStatement  
selectedAlternative  
approver  
authorityBasis  
supportingClaims  
supportingEvidence  
acceptedAssumptions  
applicableConstraints  
residualUncertainty  
effectiveAt  
rationale

## **20.3 Decision Reopening**

A decision SHOULD be reopened when:

* material new evidence emerges;  
* a critical assumption fails;  
* intent changes;  
* a governing constraint changes;  
* implementation or observation contradicts expectations;  
* validation reveals a material defect.

---

# **21\. Action Model**

Actions implement decisions or otherwise advance the PWU.

## **21.1 Action Authorization**

An Action that materially changes reality SHALL identify:

* authorizing Decision or authority;  
* intended effect;  
* executor;  
* constraints;  
* rollback or recovery expectations where applicable;  
* required observations.

## **21.2 Action Completion**

Action completion SHALL remain distinct from PWU completion.

An Action may execute successfully while:

* the intended outcome is not achieved;  
* validation fails;  
* new uncertainty emerges;  
* reconciliation remains pending.

---

# **22\. Observation and Feedback Model**

Observations compare reality or execution against expectations.

## **22.1 Expected State**

Where appropriate, an Action or Decision SHOULD define an expected observation.

## **22.2 Variance**

Observation handling SHOULD classify:

matches\_expectation  
within\_tolerance  
unexpected\_beneficial  
unexpected\_adverse  
inconclusive  
measurement\_failure

## **22.3 Reconciliation Trigger**

An Observation SHALL trigger reconciliation when it materially conflicts with:

* a Claim;  
* an Assumption;  
* an approved Representation;  
* a Decision rationale;  
* an expected outcome;  
* a mandatory Constraint.

---

# **23\. Dependency Model**

Dependencies SHALL be explicit and typed.

## **23.1 Dependency Categories**

informational  
logical  
temporal  
resource  
authority  
evidence  
implementation  
validation  
operational  
parent\_child  
cross\_pwu  
external

## **23.2 Dependency Direction**

Each dependency SHALL identify:

dependentEntity  
requiredEntity  
satisfactionCondition  
criticality  
status

## **23.3 Blocking Dependencies**

A dependency blocks the PWU when:

* it is mandatory;  
* its satisfaction condition is unmet;  
* no valid substitute exists;  
* responsible work cannot proceed without irresponsible assumption.

## **23.4 Cross-PWU Dependencies**

Cross-PWU dependencies SHALL be visible from both PWUs.

A change to one side SHOULD trigger impact analysis on the other.

---

# **24\. Risk and Issue Model**

## **24.1 Risk Registration**

Material risks SHALL identify:

* cause;  
* potential effect;  
* likelihood;  
* impact;  
* affected outcomes;  
* mitigation;  
* monitoring observations;  
* responsible Participant.

## **24.2 Issue Conversion**

A Risk MAY become an Issue when its triggering condition is observed.

The relationship between the original Risk and resulting Issue SHALL be preserved.

---

# **25\. Validation Model**

Validation determines whether PWU entities or the PWU itself satisfy declared criteria.

## **25.1 Validation Layers**

structural  
semantic  
professional  
coherence  
governance  
temporal  
security  
safety  
outcome

## **25.2 Required Validation Plan**

A PWU SHOULD define required validations during framing.

Each required validation SHALL identify:

subject  
criteria  
validator  
timing  
blockingCondition  
requiredResult

## **25.3 Validation Independence**

A PWA MAY require independence between:

* producer and validator;  
* executor and approver;  
* AI agent and reviewing participant;  
* child PWU and parent synthesis.

## **25.4 Inconclusive Validation**

An inconclusive result SHALL NOT be silently treated as pass.

It SHALL produce one of:

* additional evidence request;  
* revised method;  
* accepted residual uncertainty;  
* escalation;  
* failure;  
* scope revision.

---

# **26\. Reconciliation Model**

Reconciliation restores coherence within or across PWUs.

## **26.1 Reconciliation Triggers**

new\_evidence  
contradiction  
assumption\_failure  
intent\_change  
constraint\_change  
dependency\_change  
validation\_failure  
observation\_mismatch  
external\_change  
manual\_request

## **26.2 Reconciliation Scope**

A reconciliation SHALL identify:

* trigger;  
* affected entities;  
* affected PWUs;  
* affected decisions;  
* affected outcomes;  
* prior state;  
* proposed state;  
* downstream consequences.

## **26.3 Reconciliation Application**

A reconciliation may:

* revise an entity;  
* supersede an entity;  
* reopen a Decision;  
* reopen a PWU;  
* create a child PWU;  
* modify completion conditions;  
* escalate an unresolved conflict;  
* accept a documented inconsistency temporarily.

## **26.4 Temporary Incoherence**

Temporary incoherence MAY be tolerated when explicitly authorized.

It SHALL record:

acceptedBy  
reason  
scope  
risk  
expirationOrReviewDate  
mitigation

---

# **27\. Decomposition Model**

Decomposition creates child PWUs to reduce cognitive or organizational complexity.

## **27.1 Valid Reasons to Decompose**

A PWU SHOULD be decomposed when:

* the objective contains independently reasoned sub-objectives;  
* different professional disciplines are required;  
* different authorities apply;  
* independent validation is required;  
* the cognitive context exceeds responsible operating limits;  
* parallel work can proceed without losing coherence;  
* specialized tools or agents are required;  
* uncertainty classes require different methods.

## **27.2 Invalid Reasons to Decompose**

A PWU SHOULD NOT be decomposed solely because:

* the UI prefers smaller cards;  
* a task list is desired;  
* arbitrary time-boxing is convenient;  
* the implementation framework maps naturally to child objects;  
* an agent wants to offload context without preserving rationale.

## **27.3 Child PWU Delegation Contract**

Every child PWU SHALL receive:

delegatedObjective  
originatingIntent  
delegatedScope  
excludedScope  
authority  
requiredInputs  
requiredOutputs  
applicableConstraints  
parentDependencies  
completionConditions  
escalationConditions  
recompositionObligation

## **27.4 Child Relationship Types**

decomposition  
delegation  
specialization  
support  
verification  
validation  
mitigation  
research  
reconciliation  
implementation

## **27.5 Parent Responsibility**

The parent retains responsibility for:

* cross-child coherence;  
* unresolved boundary conditions;  
* synthesis;  
* dependency management;  
* overall completion;  
* residual uncertainty;  
* outcome alignment.

Delegation SHALL NOT transfer responsibility for recomposition.

---

# **28\. Recomposition Model**

Recomposition integrates child PWU results into coherent parent understanding.

## **28.1 Recomposition Is Mandatory**

A parent PWU with children SHALL perform recomposition before completion unless all child work was cancelled or formally detached.

## **28.2 Recomposition Inputs**

childOutputs  
childDecisions  
childResidualUncertainty  
childAssumptions  
childValidations  
crossChildDependencies  
contradictions  
boundaryConditions

## **28.3 Recomposition Outputs**

synthesizedRepresentation  
crossChildCoherenceAssessment  
unresolvedContradictions  
integratedConfidenceAssessment  
parentDecisionUpdates  
parentCompletionAssessment  
followOnPWUs

## **28.4 Local Completion Does Not Imply Global Coherence**

All child PWUs may be individually complete while the parent remains incomplete because:

* child outputs conflict;  
* interfaces do not align;  
* combined constraints are violated;  
* global outcome criteria are not met;  
* residual uncertainty compounds;  
* integration validation is missing.

---

# **29\. Completion Model**

PWU completion is a professional judgment constrained by explicit rules.

## **29.1 Completion Conditions**

Every PWU SHALL define completion conditions.

Completion conditions MAY include:

objectiveSatisfied  
requiredOutputsAccepted  
mandatoryValidationsPassed  
requiredDecisionsMade  
requiredActionsCompleted  
criticalDependenciesSatisfied  
reconciliationComplete  
residualUncertaintyAccepted  
traceabilityComplete  
parentRecompositionDelivered

## **29.2 Completion Assessment**

A completion assessment SHALL identify:

condition  
result  
evidence  
validator  
exceptions

## **29.3 Completion Outcomes**

completed\_successfully  
completed\_with\_accepted\_residual\_uncertainty  
completed\_as\_inconclusive  
completed\_by\_transfer  
completed\_by\_supersession

These may map to lifecycle `completed` while retaining distinct disposition semantics.

## **29.4 Completion Prohibitions**

A PWU SHALL NOT complete when:

* a mandatory validation failed;  
* a blocking dependency remains unresolved;  
* a mandatory constraint is violated;  
* material contradiction remains unacknowledged;  
* required parent synthesis is absent;  
* the only output is an unvalidated AI result;  
* objective satisfaction cannot be assessed and no authorized inconclusive disposition exists.

---

# **30\. Failure, Tactic Change, and Escalation**

The PWU SHALL distinguish ordinary iteration from professional failure.

## **30.1 Failure Classes**

insufficient\_evidence  
insufficient\_authority  
insufficient\_capability  
invalid\_method  
tool\_failure  
dependency\_failure  
constraint\_conflict  
unresolvable\_contradiction  
resource\_exhaustion  
time\_exhaustion  
scope\_invalidity  
intent\_ambiguity  
validation\_failure  
external\_blockage

## **30.2 Tactic Change Trigger**

A tactic change SHOULD occur when:

* repeated reasoning produces no material uncertainty reduction;  
* the same validation failure recurs;  
* new evidence invalidates the current method;  
* progress stalls beyond a defined threshold;  
* search remains confined to a failing solution space;  
* the current Participant lacks required expertise;  
* tool limitations materially constrain quality.

## **30.3 Tactic Change Options**

change\_method  
expand\_search\_space  
narrow\_scope  
decompose  
request\_specialist  
change\_tool  
change\_agent  
increase\_evidence  
challenge\_assumptions  
reframe\_question  
escalate\_authority

## **30.4 Escalation Conditions**

A PWU SHALL escalate when:

* required authority exceeds current delegation;  
* material uncertainty cannot be responsibly reduced;  
* constraints conflict without resolution authority;  
* safety, legality, or ethics are implicated;  
* repeated tactics fail;  
* evidence remains insufficient for a required decision;  
* human judgment is explicitly required;  
* a governing PWA requires escalation;  
* continued execution would be professionally irresponsible.

## **30.5 Escalation Package**

Escalation SHALL include:

professionalObjective  
currentState  
blockingCondition  
workPerformed  
tacticsAttempted  
evidenceGathered  
assumptions  
constraints  
decisionsRequired  
recommendedOptions  
riskOfDelay  
riskOfProceeding

---

# **31\. Command Model**

PWU state SHALL be changed through semantically meaningful commands.

## **31.1 Core Commands**

ProposePWU  
FramePWU  
RevisePWUScope  
AssignParticipant  
RemoveParticipant  
DeclareReady  
ActivatePWU  
IdentifyQuestion  
IdentifyUncertainty  
RegisterAssumption  
RegisterConstraint  
AddRepresentation  
StartReasoning  
CompleteReasoning  
ProposeClaim  
AddEvidence  
AssessConfidence  
IdentifyAlternative  
ProposeDecision  
ApproveDecision  
RejectDecision  
AuthorizeAction  
RecordObservation  
AddDependency  
SatisfyDependency  
BlockPWU  
UnblockPWU  
RequestEvidence  
RequestDecision  
RequestReview  
StartReconciliation  
ApplyReconciliation  
DecomposePWU  
RecomposePWU  
ValidatePWU  
CompletePWU  
SuspendPWU  
CancelPWU  
SupersedePWU  
ReopenPWU  
FailPWU  
EscalatePWU

## **31.2 Command Envelope**

Every command SHALL include:

commandId  
commandType  
pwuId  
expectedVersion  
requestedBy  
requestedAt  
correlationId  
causationId  
payload

## **31.3 Optimistic Concurrency**

Commands SHOULD include `expectedVersion`.

A stale command SHALL fail rather than silently overwrite newer professional state.

---

# **32\. Event Model**

Successful commands SHALL emit one or more immutable events.

## **32.1 Core PWU Events**

PWUProposed  
PWUFramingStarted  
PWUFramed  
PWUScopeRevised  
ParticipantAssigned  
ParticipantRemoved  
PWUDeclaredReady  
PWUActivated  
QuestionIdentified  
UncertaintyIdentified  
AssumptionRegistered  
ConstraintRegistered  
RepresentationAdded  
ReasoningStarted  
ReasoningCompleted  
ReasoningFailed  
ClaimProposed  
EvidenceAdded  
ConfidenceAssessed  
AlternativeIdentified  
DecisionProposed  
DecisionApproved  
DecisionRejected  
ActionAuthorized  
ObservationRecorded  
DependencyAdded  
DependencySatisfied  
PWUBlocked  
PWUUnblocked  
EvidenceRequested  
DecisionRequested  
ReviewRequested  
ReconciliationStarted  
ReconciliationApplied  
PWUDecomposed  
PWURecomposed  
PWUValidationPassed  
PWUValidationFailed  
PWUCompleted  
PWUSuspended  
PWUCancelled  
PWUSuperseded  
PWUReopened  
PWUFailed  
PWUEscalated

## **32.2 Event Requirements**

Every event SHALL include:

eventId  
eventType  
pwuId  
pwuVersion  
occurredAt  
recordedAt  
actorId  
correlationId  
causationId  
payload  
provenance

---

# **33\. Aggregate Invariants**

## **PWU-INV-001 — Objective Required**

A PWU SHALL possess exactly one active professional objective.

## **PWU-INV-002 — Intent Required**

A non-exploratory PWU SHALL trace to at least one active Intent.

## **PWU-INV-003 — Explicit State**

Lifecycle and cognitive state SHALL be explicit.

## **PWU-INV-004 — Scope Integrity**

Material work SHALL remain within authorized scope unless scope is revised.

## **PWU-INV-005 — Provenance**

Material entities created within the PWU SHALL record provenance.

## **PWU-INV-006 — AI Attribution**

AI-created work SHALL remain explicitly attributable to the AI Participant and execution context.

## **PWU-INV-007 — Completion Conditions**

A PWU SHALL define completion conditions before activation.

## **PWU-INV-008 — No Activity-Only Completion**

Activity execution alone SHALL NOT satisfy PWU completion.

## **PWU-INV-009 — Blocking Transparency**

A blocked PWU SHALL identify the blocking condition and required resolution.

## **PWU-INV-010 — Decision Authority**

A Decision SHALL NOT become approved without valid authority.

## **PWU-INV-011 — Mandatory Constraint Enforcement**

A PWU SHALL NOT authorize an Action that violates a mandatory Constraint without an authorized exception.

## **PWU-INV-012 — Critical Assumption Visibility**

Critical assumptions SHALL be explicit and linked to dependent work.

## **PWU-INV-013 — Evidence Separation**

Claims and supporting Evidence SHALL remain distinct entities.

## **PWU-INV-014 — Observation Separation**

Observation, interpretation, and Claim SHALL remain distinguishable.

## **PWU-INV-015 — Child Delegation**

A child PWU SHALL possess a delegation contract.

## **PWU-INV-016 — Parent Recomposition**

A parent PWU SHALL recompose child work before completion.

## **PWU-INV-017 — Historical Preservation**

Reopening, supersession, and reconciliation SHALL preserve prior state.

## **PWU-INV-018 — Unresolved Contradiction Visibility**

Material contradictions SHALL remain visible until disposition.

## **PWU-INV-019 — Escalation**

The PWU SHALL escalate when responsible advancement exceeds available authority or capability.

## **PWU-INV-020 — Projection Non-Authority**

UI state SHALL NOT independently alter professional state without a valid command.

---

# **34\. API Resource Model**

A reference API MAY expose:

/endeavors/{endeavorId}/pwus  
/pwus/{pwuId}  
/pwus/{pwuId}/state  
/pwus/{pwuId}/participants  
/pwus/{pwuId}/questions  
/pwus/{pwuId}/uncertainties  
/pwus/{pwuId}/assumptions  
/pwus/{pwuId}/constraints  
/pwus/{pwuId}/representations  
/pwus/{pwuId}/reasoning  
/pwus/{pwuId}/claims  
/pwus/{pwuId}/evidence  
/pwus/{pwuId}/decisions  
/pwus/{pwuId}/actions  
/pwus/{pwuId}/observations  
/pwus/{pwuId}/dependencies  
/pwus/{pwuId}/validations  
/pwus/{pwuId}/reconciliations  
/pwus/{pwuId}/children  
/pwus/{pwuId}/history  
/pwus/{pwuId}/commands

Public API operations SHOULD express professional semantics rather than generic field mutation.

Preferred:

POST /pwus/{id}/commands/identify-uncertainty  
POST /pwus/{id}/commands/propose-decision  
POST /pwus/{id}/commands/decompose  
POST /pwus/{id}/commands/complete

Discouraged as the primary contract:

PATCH /pwus/{id}  
{  
  "status": "complete"  
}

---

# **35\. Reference Data Structure**

A minimum logical PWU representation may take the following form:

{  
  "pwuId": "pwu\_01",  
  "pwuType": "architecture\_design",  
  "title": "Define tenant isolation architecture",  
  "professionalObjective": {  
    "statement": "Define and validate an architecture that prevents unauthorized cross-tenant data access.",  
    "outcomeContributionIds": \["outcome\_secure\_multitenancy"\]  
  },  
  "endeavorId": "endeavor\_janumi\_platform",  
  "parentPwuId": "pwu\_platform\_architecture",  
  "rootPwuId": "pwu\_janumi\_product\_realization",  
  "version": 7,  
  "lifecycleState": "active",  
  "cognitiveState": "reasoning",  
  "originatingIntentIds": \["intent\_enterprise\_multitenancy"\],  
  "scope": {  
    "included": \[  
      "application-level tenant isolation",  
      "database isolation strategy",  
      "authorization boundaries"  
    \],  
    "excluded": \[  
      "commercial packaging",  
      "tenant-specific branding"  
    \]  
  },  
  "participants": \[\],  
  "questions": \[\],  
  "uncertainties": \[\],  
  "assumptions": \[\],  
  "constraints": \[\],  
  "representations": \[\],  
  "reasoningActivities": \[\],  
  "claims": \[\],  
  "evidence": \[\],  
  "confidenceAssessments": \[\],  
  "alternatives": \[\],  
  "decisions": \[\],  
  "actions": \[\],  
  "observations": \[\],  
  "dependencies": \[\],  
  "validations": \[\],  
  "reconciliations": \[\],  
  "childPwuIds": \[\],  
  "completionConditions": \[\],  
  "escalationConditions": \[\],  
  "createdAt": "2026-07-13T16:00:00-04:00",  
  "createdBy": "participant\_architect"  
}

This structure is illustrative, not yet the machine schema.

---

# **36\. Reference UI Projection**

The canonical PWU workspace SHALL present the aggregate as professional cognition rather than as a generic record form.

## **36.1 Workspace Header**

The header SHOULD expose:

* title;  
* professional objective;  
* lifecycle state;  
* cognitive state;  
* parent context;  
* Intent trace;  
* owner;  
* current confidence;  
* unresolved critical uncertainty;  
* pending reconciliation.

## **36.2 Persistent Context Rail**

The workspace SHOULD preserve persistent access to:

Intent  
Objective  
Scope  
Participants  
Dependencies  
Assumptions  
Constraints  
History

## **36.3 Primary Cognitive Canvas**

The central workspace SHALL change according to the active projection:

understanding  
reasoning  
evidence  
decision  
execution  
observation  
reconciliation  
decomposition

## **36.4 Action Region**

Available controls SHALL derive from:

* lifecycle state;  
* cognitive state;  
* Participant role;  
* authority;  
* validation status;  
* blocking conditions;  
* PWA policy.

A user SHALL NOT see an enabled “Complete” action when completion preconditions are unsatisfied.

## **36.5 State Explanation**

Every lifecycle state SHOULD answer:

* Why is the PWU in this state?  
* What must happen next?  
* Who can act?  
* What is blocking progress?  
* What professional condition permits transition?

---

# **37\. Minimum Viable PWU Implementation**

A first implementation SHALL support:

## **37.1 Core State**

identity  
objective  
intent links  
scope  
lifecycle state  
cognitive state  
participants  
dependencies  
completion conditions  
history

## **37.2 Core Cognition**

questions  
uncertainties  
assumptions  
representations  
reasoning activities  
claims  
evidence  
decisions  
validations  
reconciliations

## **37.3 Core Operations**

propose  
frame  
activate  
block  
unblock  
decompose  
record reasoning  
add evidence  
propose decision  
approve decision  
validate  
reconcile  
complete  
reopen  
escalate

## **37.4 Core UI**

PWU overview  
reasoning projection  
evidence projection  
decision projection  
decomposition projection  
reconciliation projection  
history projection

---

# **38\. Coding Agent Implementation Contract**

A coding agent implementing the PWU model SHALL:

1. Model lifecycle and cognitive state independently.  
2. Implement explicit commands rather than unrestricted status mutation.  
3. Validate state transitions server-side.  
4. preserve optimistic concurrency.  
5. Record immutable domain events.  
6. Distinguish aggregate-owned entities from external references.  
7. Preserve provenance for human and AI contributions.  
8. Prevent completion when completion conditions fail.  
9. Implement child delegation and parent recomposition explicitly.  
10. Expose contradictions and unresolved uncertainty.  
11. Avoid modeling PWUs as generic tasks.  
12. Avoid deriving state from missing or empty fields.  
13. Avoid allowing UI projections to become independent sources of truth.  
14. Produce typed failures for invalid commands and transitions.  
15. Emit observability events at every material decision boundary.

---

# **39\. Acceptance Scenarios**

## **Scenario A — Valid Activation**

Given:

* a PWU in `framing`;  
* a valid objective;  
* active Intent;  
* defined scope;  
* assigned owner;  
* completion conditions;  
* no mandatory framing failures;

When:

* `DeclareReady` is accepted;  
* `ActivatePWU` is accepted;

Then:

* lifecycle state becomes `active`;  
* separate events are emitted;  
* version increments for each accepted command;  
* state rationale is reconstructable.

## **Scenario B — Invalid Completion**

Given:

* a PWU in `awaiting_review`;  
* a mandatory validation result of `fail`;

When:

* a Participant requests `CompletePWU`;

Then:

* completion is rejected;  
* lifecycle state remains unchanged;  
* a typed `MANDATORY_VALIDATION_FAILED` error is returned;  
* the failed attempt is observable;  
* no completion event is emitted.

## **Scenario C — Assumption Failure**

Given:

* an active PWU;  
* a critical assumption supporting an approved Decision;  
* new Evidence invalidating the assumption;

When:

* the Evidence is accepted;

Then:

* the assumption becomes `invalidated`;  
* affected Claims and Decisions are marked for impact assessment;  
* reconciliation is triggered;  
* the PWU may transition to `reconciling`;  
* dependent PWUs receive impact events.

## **Scenario D — Child Completion Without Recomposition**

Given:

* a parent PWU with three child PWUs;  
* all children are completed;  
* no parent recomposition exists;

When:

* parent completion is requested;

Then:

* completion is rejected;  
* `RECOMPOSITION_REQUIRED` is returned;  
* the parent remains active or awaiting review.

## **Scenario E — Responsible Escalation**

Given:

* an AI Reasoner;  
* repeated failed tactics;  
* unresolved legal ambiguity;  
* no delegated legal authority;

When:

* the agent determines it cannot continue responsibly;

Then:

* `EscalatePWU` is issued;  
* the PWU enters an appropriate awaiting or escalated condition;  
* the escalation package identifies attempted tactics, evidence, uncertainty, and required authority;  
* the agent does not fabricate a legal conclusion.

---

# **40\. Resulting Architectural Interpretation**

The PWU is the smallest Janumi aggregate that can answer:

* Why does this work exist?  
* What professional objective governs it?  
* What is currently understood?  
* What remains uncertain?  
* What reasoning is underway?  
* What evidence exists?  
* What decisions have been made?  
* What actions are authorized?  
* What did reality reveal?  
* What contradictions exist?  
* What makes this work complete?  
* How does it connect to larger work?  
* Can its reasoning be reconstructed?

A task system records that activity occurred.

A PWU records how professional cognition advanced, failed, changed, and contributed to an outcome.

---

# **41\. Next Normative Artifact**

The next required specification is the **Recursive Professional Harness Coordination Specification**.

That specification shall define:

* how an RPH creates and advances PWUs;  
* recursive delegation;  
* agent allocation;  
* control states;  
* planning and replanning;  
* tactic-change thresholds;  
* retries;  
* validation boundaries;  
* human intervention;  
* cross-PWU synthesis;  
* escalation;  
* failure disposition;  
* continuous reconciliation;  
* harness observability.

The RPH specification will make the PWU aggregate operational without reducing it to a conventional workflow.

\===

I will proceed, but I also want to make one architectural observation before we do, because I think we've just crossed from "interesting framework" into "platform architecture."

The PWU specification we just wrote feels **complete**.

That's actually a warning sign.

In Domain-Driven Design, aggregates should be **small**. They should own only what they must own.

Our PWU is intentionally large because we're defining semantics, but if we implement it literally as one massive aggregate, we'll create a bottleneck:

* too many concurrent updates,  
* version conflicts,  
* giant payloads,  
* poor event granularity,  
* UI refresh inefficiency,  
* overly broad transactions.

So I would make one refinement before proceeding.

## **Refinement: Semantic Aggregate vs. Transactional Aggregate**

There are really two different things:

1. **Semantic PWU** (the professional concept)  
2. **Transactional aggregates** (implementation units)

For example:

Semantic PWU  
│  
├── Identity  
├── Objective  
├── Scope  
├── Participants  
├── Questions  
├── Reasoning  
├── Evidence  
├── Decisions  
├── Observations  
├── Validation  
└── History

Implementation might split this into aggregates like:

PWU Aggregate  
├── Identity  
├── Objective  
├── Scope  
├── Lifecycle  
└── Authority

Reasoning Aggregate

Evidence Aggregate

Decision Aggregate

Observation Aggregate

Validation Aggregate

History Aggregate

To the professional—and to the ontology—there is one PWU.

To the software, there are several transactional boundaries.

That distinction will make the platform scale much better while preserving the semantic model we've developed.

---

# **Volume IV**

# **Recursive Professional Harness Coordination Specification**

## **RPH Specification v0.1**

### **Status**

Normative

Depends upon:

* CPCO  
* PWU Specification  
* Professional Cognition Life Cycle  
* Janumi Constitution

---

# **1\. Purpose**

A Recursive Professional Harness (RPH) is **not** a workflow engine.

It is **not** a task scheduler.

It is **not** an agent orchestrator.

Those are implementation techniques.

An RPH is the professional coordination system responsible for advancing one or more Professional Work Units through the Professional Cognition Life Cycle while preserving organizational coherence.

Its responsibility is not "running work."

Its responsibility is **maintaining the conditions under which professional reasoning can succeed.**

---

# **2\. Canonical Definition**

An RPH is:

A recursively composable coordination authority that frames, allocates, supervises, validates, reconciles, synthesizes, and escalates professional work while preserving intent, traceability, evidence, authority, and coherence.

---

# **3\. What an RPH Governs**

The RPH does **not** own professional knowledge.

The PWUs own that.

The RPH governs:

* coordination,  
* delegation,  
* synchronization,  
* escalation,  
* synthesis,  
* policy,  
* authority.

This is an extremely important separation.

---

# **4\. Core Responsibilities**

Every RPH SHALL:

### **Frame work**

Determine what work is actually required.

Not merely execute requested work.

---

### **Allocate work**

Assign work to:

* humans,  
* AI agents,  
* subordinate RPHs,  
* external organizations,  
* automated systems.

---

### **Coordinate dependencies**

Continuously understand:

* blocked work,  
* sequencing,  
* synchronization,  
* authority boundaries.

---

### **Monitor progress**

Not merely execution progress.

Professional progress.

Examples:

* uncertainty reduction,  
* evidence accumulation,  
* validation completion,  
* reasoning advancement.

---

### **Detect incoherence**

Observe:

* conflicting assumptions,  
* conflicting evidence,  
* conflicting representations,  
* conflicting decisions,  
* conflicting objectives.

---

### **Trigger reconciliation**

The RPH never hides incoherence.

It exposes it.

---

### **Synthesize**

Perhaps the most important responsibility.

Subordinate reasoning must eventually become coherent organizational understanding.

---

### **Escalate**

Recognize when continuing is professionally irresponsible.

---

Notice something.

Nowhere have we said

"Run Agent."

---

# **5\. Recursive Composition**

An RPH may create subordinate RPHs.

Example:

Enterprise RPH

↓

Product RPH

↓

Architecture RPH

↓

Authentication RPH

↓

Authorization RPH

↓

Implementation RPH

↓

Verification RPH

Each is identical.

Different scope.

Same behavior.

---

# **6\. Delegation**

Delegation is not assignment.

Delegation transfers bounded professional responsibility.

Every delegation SHALL include:

* objective,  
* scope,  
* authority,  
* completion conditions,  
* constraints,  
* dependencies,  
* escalation conditions.

This looks remarkably similar to a child PWU contract.

That isn't coincidence.

---

# **7\. Control States**

Unlike PWUs,

the RPH has control states.

For example:

Initializing

↓

Framing

↓

Planning

↓

Allocating

↓

Coordinating

↓

Observing

↓

Reconciling

↓

Synthesizing

↓

Escalating

↓

Completed

Notice

Planning

is a harness activity.

Not a PWU activity.

---

# **8\. Planning**

Planning is continuous.

The harness continuously asks:

What work should exist?

Not

What work already exists?

That distinction changes the architecture enormously.

---

# **9\. Allocation**

Allocation chooses:

Who should reason?

Examples:

Human

↓

AI Research Agent

↓

AI Coding Agent

↓

External SME

↓

Subordinate RPH

↓

Hybrid Team

Allocation depends on:

authority,

capability,

availability,

cost,

confidence,

risk.

---

# **10\. Coordination**

Coordination continuously evaluates:

dependency graph,

critical path,

professional bottlenecks,

authority bottlenecks,

validation bottlenecks,

knowledge bottlenecks,

organizational bottlenecks.

Traditional project managers spend much of their effort here; the RPH makes this explicit and continuously observable.

---

# **11\. Tactic Change**

This is one of the pieces you've been asking about across several conversations.

The RPH owns tactic selection.

A subordinate AI agent may faithfully execute its assigned approach, but the harness evaluates whether that approach is still productive.

Indicators that suggest a tactic change include:

* repeated validation failures with the same root cause;  
* no meaningful reduction in uncertainty after several reasoning iterations;  
* evidence consistently contradicting the working hypothesis;  
* oscillation between the same alternatives;  
* decomposition producing excessive coordination cost;  
* search remaining confined to a narrow solution space;  
* diminishing returns from additional analysis.

When these conditions arise, the harness may:

* broaden the search space;  
* narrow the objective;  
* request additional evidence;  
* decompose differently;  
* assign different expertise;  
* invoke a different AI model or reasoning strategy;  
* escalate to a human decision-maker.

This responsibility belongs to the RPH because it has visibility across multiple PWUs rather than only within one.

---

# **12\. Escalation**

Escalation is not failure.

It is responsible recognition that progress now depends on authority, expertise, or information outside the current coordination boundary.

Every escalation package should include:

* current objective;  
* work completed;  
* evidence gathered;  
* assumptions;  
* attempted tactics;  
* remaining uncertainty;  
* available options;  
* recommended next action;  
* consequences of delay versus continuation.

This allows the receiving human or higher-level RPH to make an informed decision without reconstructing history.

---

# **13\. Synthesis**

Synthesis is the defining capability that distinguishes an RPH from a workflow engine.

After subordinate PWUs complete, the harness asks:

* Do these results agree?  
* Do they satisfy the originating intent?  
* Are there unresolved contradictions?  
* What new organizational understanding has emerged?  
* What residual uncertainty remains?

Only after synthesis can the parent work advance or conclude.

---

# **14\. Observability**

The RPH emits observability information about coordination itself.

Examples include:

* active PWU count;  
* blocked PWUs;  
* unresolved contradictions;  
* reconciliation backlog;  
* average uncertainty reduction rate;  
* validation backlog;  
* escalation rate;  
* tactic-change frequency;  
* synthesis queue depth;  
* authority bottlenecks.

These metrics describe organizational cognition, not merely system execution.

---

# **15\. Human Interaction**

Humans do not micromanage the harness.

They supervise it.

The harness should surface moments where professional judgment is required:

* ambiguous intent;  
* conflicting constraints;  
* insufficient authority;  
* ethical concerns;  
* legal review;  
* strategic trade-offs.

Routine coordination remains automated; consequential judgment remains visible and reviewable.

---

# **16\. Why This Matters**

At this point, we now have three complementary architectural layers:

* **CPCO** defines *what exists*.  
* **PWU** defines *how professional cognition is bounded and represented*.  
* **RPH** defines *how professional cognition is coordinated over time*.

Everything else in Janumi—including the Living Enterprise Model, Professional Work Architectures, UI workspaces, and AI agent behaviors—is built on top of those three foundations.

## **I would change our roadmap one more time**

Originally, I thought the next artifact after the RPH would be the Living Enterprise Model. I no longer think that's correct.

The Living Enterprise Model is **not** another independently specified component. It is a **derived projection** over the CPCO graph, the current state of all PWUs, and the coordination state of all active RPHs.

That means the next specification should instead be **The Projection Model**: a formal definition of how authoritative semantic state is projected into different views for humans, AI agents, analytics, and operations. Once we define projections formally, the Living Enterprise Model, the Reasoning Graph, the Decomposition Viewer, the Evidence Explorer, the Decision Workspace, and every other UI surface become specific named projections rather than separate subsystems.

I think that's a cleaner architecture because it preserves a single semantic source of truth while allowing an unlimited number of derived, role-specific, and purpose-specific experiences without duplicating meaning. That principle—**one authoritative cognition model, many projections**—is likely to become one of the defining characteristics of the Janumi platform.

\===

# **Canonical Projection Model**

## **CPM Specification v0.1**

**Status:** Normative draft  
**Depends on:** Canonical Professional Cognition Ontology v0.1, Professional Work Unit Specification v0.1, Recursive Professional Harness concepts, Professional Cognition Life Cycle, Reference Experience Model  
**Applies to:** Living Enterprise Model, Janumi Professional Workbench, all Professional Work Architectures, web, desktop, mobile, VS Code, agent interfaces, reporting, analytics, and external integrations  
**Primary audiences:** UX architects, frontend engineers, platform engineers, coding agents, PWA authors, API designers, data engineers, agent developers

---

# **1\. Purpose**

The Canonical Projection Model defines how Janumi transforms authoritative professional cognition into bounded, purpose-specific views for humans, artificial intelligence, analytics, governance, and external systems.

The projection model operationalizes the principle:

One authoritative professional cognition model; many purpose-specific projections.

A projection is not an independent module, document store, application database, or semantic source of truth.

It is a governed interpretation of authoritative Janumi state.

This specification defines:

* what a projection is;  
* what a projection may contain;  
* how projections are created;  
* how users navigate among projections;  
* how commands arise from projections;  
* how projections remain synchronized;  
* how the Living Enterprise Model is understood;  
* how UI workspaces map to professional cognition;  
* how responsive surfaces preserve semantic continuity;  
* how projections avoid fragmenting organizational understanding.

---

# **2\. Central Architectural Rule**

All material Janumi experiences SHALL be derived from:

Authoritative Cognitive State  
        \+  
PWU Aggregate State  
        \+  
RPH Coordination State  
        \+  
Professional Cognition Life Cycle State  
        \+  
Participant Role and Authority  
        \+  
Current Professional Purpose  
        \=  
Purpose-Specific Projection

The implementation SHALL NOT begin by defining independent product modules and later attempting to connect them.

The canonical direction is:

Semantic Model  
    ↓  
Projection Definition  
    ↓  
Projection Query  
    ↓  
Interaction Contract  
    ↓  
Presentation

Not:

Page  
    ↓  
Local View Model  
    ↓  
Local Data Store  
    ↓  
Ad Hoc Integration

---

# **3\. Canonical Definition**

A **Projection** is:

A derived, bounded, role-aware, temporally qualified, purpose-specific representation of authoritative professional cognition that allows a Participant to inspect, reason about, or act upon selected aspects of that cognition without creating an independent semantic truth.

A projection may:

* filter;  
* organize;  
* aggregate;  
* summarize;  
* correlate;  
* rank;  
* visualize;  
* compare;  
* calculate;  
* explain;  
* highlight;  
* predict.

A projection SHALL NOT silently:

* alter source semantics;  
* invent missing professional state;  
* convert inference into fact;  
* obscure provenance;  
* suppress relevant contradictions;  
* create authoritative decisions;  
* bypass commands and validations.

---

# **4\. Projection Layers**

Janumi SHALL distinguish four projection layers.

## **4.1 Semantic Projection**

Selects and relates CPCO entities according to professional meaning.

Example:

All Claims supporting Decision D,  
their Evidence,  
their Assumptions,  
their Confidence Assessments,  
and all contradicting Claims.

## **4.2 Cognitive Projection**

Organizes semantic entities around a professional question or cognitive activity.

Example:

What remains uncertain before this architecture decision can be approved?

## **4.3 Interaction Projection**

Defines what the Participant may inspect, manipulate, propose, approve, or execute.

Example:

A security reviewer may challenge Claims,  
add Evidence,  
request revision,  
or perform Validation,  
but may not approve the architecture unless assigned approval authority.

## **4.4 Presentation Projection**

Defines the concrete interface representation.

Examples:

* graph;  
* timeline;  
* matrix;  
* structured document;  
* comparison table;  
* canvas;  
* card;  
* inspector;  
* dashboard;  
* conversational surface.

Presentation SHALL be replaceable without changing the underlying semantic projection.

---

# **5\. Projection Identity**

Every material named projection SHALL possess:

projectionDefinitionId  
name  
purpose  
projectionType  
sourceModel  
applicableRoles  
applicablePwa  
version  
status

Runtime projection instances SHOULD identify:

projectionInstanceId  
projectionDefinitionId  
participantId  
contextEntityIds  
queryParameters  
asOfTime  
generatedAt  
sourceVersionVector

## **5.1 Definition Versus Instance**

A projection definition describes how a class of views is constructed.

A projection instance is the result generated for a particular:

* Participant;  
* PWU;  
* endeavor;  
* time;  
* role;  
* question;  
* device;  
* operating context.

---

# **6\. Projection Types**

Canonical projection types include:

overview  
detail  
cognitive\_state  
relationship  
decomposition  
dependency  
evidence  
decision  
reasoning  
uncertainty  
assumption  
constraint  
execution  
observation  
reconciliation  
history  
comparison  
governance  
coordination  
organizational  
narrative  
analytic  
predictive  
external\_exchange

A PWA MAY define specialized projection types while preserving canonical semantics.

---

# **7\. Projection Contract**

Every projection definition SHALL declare the following.

## **7.1 Professional Purpose**

What professional question or cognitive activity does the projection support?

Example:

Determine whether available evidence is sufficient to approve the proposed architecture decision.

## **7.2 Source Entities**

Which CPCO entities and RPH or PWU states are included?

## **7.3 Inclusion Rules**

Which entities qualify for inclusion?

## **7.4 Exclusion Rules**

Which entities are intentionally omitted?

## **7.5 Relationship Rules**

Which semantic relationships are traversed and to what depth?

## **7.6 Ordering and Prioritization**

How are results ordered?

Potential criteria:

* professional criticality;  
* recency;  
* uncertainty impact;  
* dependency centrality;  
* confidence;  
* authority;  
* decision urgency;  
* outcome risk.

## **7.7 Aggregations**

Which values are summarized or calculated?

## **7.8 Temporal Basis**

Does the projection represent:

* current state;  
* state at a historical time;  
* change over time;  
* predicted future state;  
* comparison of two states?

## **7.9 Role and Authority Rules**

Who can access the projection and what actions may they initiate?

## **7.10 Required Disclosures**

Which provenance, confidence, staleness, contradiction, or incompleteness indicators must be shown?

## **7.11 Interaction Commands**

Which semantic commands may be initiated from the projection?

## **7.12 Refresh Rules**

How and when does the projection update?

---

# **8\. Projection Invariants**

## **PROJ-INV-001 — Authoritative Source**

Every projection SHALL identify its authoritative source entities and versions.

## **PROJ-INV-002 — No Independent Mutation**

A projection SHALL NOT mutate professional state directly.

All mutations SHALL occur through validated semantic commands.

## **PROJ-INV-003 — Provenance Preservation**

A projection SHALL preserve access to material provenance.

## **PROJ-INV-004 — Confidence Disclosure**

A projection presenting Claims, predictions, assessments, or recommendations SHALL expose applicable Confidence Assessments.

## **PROJ-INV-005 — Uncertainty Disclosure**

A projection SHALL NOT present incomplete professional understanding as settled merely for interface simplicity.

## **PROJ-INV-006 — Contradiction Visibility**

Material contradictions relevant to the projection purpose SHALL remain visible or explicitly disclosed.

## **PROJ-INV-007 — Temporal Qualification**

Historical, stale, or predicted state SHALL be clearly distinguishable from current authoritative state.

## **PROJ-INV-008 — AI Attribution**

AI-generated summaries, interpretations, recommendations, and predictions SHALL remain attributable.

## **PROJ-INV-009 — Role Integrity**

Available actions SHALL conform to the Participant’s authority and assigned role.

## **PROJ-INV-010 — Semantic Continuity**

Equivalent projections across web, desktop, mobile, and IDE surfaces SHALL preserve semantic meaning even when layout differs.

## **PROJ-INV-011 — Projection Explainability**

A material calculated indicator SHALL provide an explanation of its basis.

## **PROJ-INV-012 — Suppression Disclosure**

When a projection intentionally omits relevant entities because of filtering, security, scope, or summarization, the omission SHALL be detectable.

## **PROJ-INV-013 — State Distinction**

Projection loading state, stale state, partial state, and professional lifecycle state SHALL remain separate.

## **PROJ-INV-014 — No False Completeness**

A projection SHALL not imply full organizational coverage when source data is incomplete.

## **PROJ-INV-015 — Command Traceability**

Every command initiated through a projection SHALL retain the originating projection context.

---

# **9\. The Living Enterprise Model**

The Living Enterprise Model is not a single projection.

It is the authoritative, continuously reconciled semantic state from which enterprise-level projections are derived.

The term may refer to two related concepts:

## **9.1 Authoritative Living Model**

The current governed graph of:

* endeavors;  
* outcomes;  
* intents;  
* PWUs;  
* RPHs;  
* participants;  
* representations;  
* claims;  
* evidence;  
* decisions;  
* capabilities;  
* dependencies;  
* actions;  
* observations;  
* reconciliations;  
* organizational memory.

## **9.2 Living Enterprise Projections**

Views over that authoritative model, including:

* organizational reasoning landscape;  
* outcome portfolio;  
* coherence map;  
* uncertainty landscape;  
* decision portfolio;  
* dependency network;  
* capability map;  
* risk and issue landscape;  
* reconciliation backlog;  
* organizational memory timeline.

The UI SHALL NOT label one narrow visualization as though it were the complete Living Enterprise Model.

---

# **10\. Canonical Cognitive Projections**

The following projections implement the Professional Cognition Life Cycle.

---

# **10.1 Intent Projection**

## **Purpose**

Allow Participants to understand why work exists and whether current work remains aligned with desired outcomes.

## **Primary entities**

Intent  
Outcome  
Stakeholder  
Constraint  
PWU  
Decision  
Action

## **Core questions**

* What are we trying to achieve?  
* Why does it matter?  
* Who is affected?  
* Which constraints govern the endeavor?  
* What work traces to this Intent?  
* Has the Intent changed?  
* Where has drift occurred?

## **Required disclosures**

* active Intent version;  
* superseded Intent;  
* rationale;  
* non-goals;  
* authority;  
* downstream impact;  
* unresolved interpretation conflicts.

## **Permitted commands**

ProposeIntent  
ReviseIntent  
SupersedeIntent  
LinkEntityToIntent  
IdentifyIntentConflict  
RequestIntentClarification

---

# **10.2 Understanding Projection**

## **Purpose**

Expose the current state of professional understanding.

## **Primary entities**

Question  
Uncertainty  
Claim  
Assumption  
Constraint  
Representation  
ConfidenceAssessment

## **Core questions**

* What do we know?  
* What do we think we know?  
* What remains unresolved?  
* Which assumptions are carrying the reasoning?  
* Where is confidence low?  
* Which questions most affect outcomes?

## **Required visual distinctions**

The projection SHALL distinguish:

observed  
claimed  
assumed  
inferred  
decided  
unknown  
contested

---

# **10.3 Reasoning Projection**

## **Purpose**

Make professional reasoning inspectable and operable.

## **Primary entities**

ReasoningActivity  
Input Entity  
Output Entity  
Participant  
Method  
Alternative  
Question  
Claim

## **Core questions**

* What reasoning is underway?  
* Who or what is performing it?  
* Which inputs are being used?  
* Which methods are being applied?  
* What outputs emerged?  
* What limitations remain?  
* Where has reasoning failed or stalled?

## **Canonical representations**

* reasoning graph;  
* reasoning activity stream;  
* analysis workspace;  
* alternative comparison;  
* decomposition tree;  
* synthesis view.

## **Required disclosure**

AI internal private chain-of-thought is not required.

The system SHALL provide professional rationale, sources, assumptions, methods, and limitations sufficient for evaluation.

---

# **10.4 Evidence Projection**

## **Purpose**

Evaluate the evidentiary basis of professional Claims, Assumptions, Decisions, and Outcomes.

## **Primary entities**

Evidence  
Claim  
Assumption  
Observation  
ConfidenceAssessment  
Validation  
Source

## **Core questions**

* What supports this Claim?  
* What contradicts it?  
* How reliable is the Evidence?  
* Is the Evidence current?  
* Is the source authoritative?  
* Which Claims lack sufficient Evidence?  
* Which Evidence supports multiple conclusions?

## **Canonical visualizations**

* evidence graph;  
* claim-evidence matrix;  
* evidence quality table;  
* provenance chain;  
* support-versus-contradiction view;  
* evidence gap analysis.

## **Prohibition**

Attachments SHALL NOT be shown as though attachment alone establishes evidentiary relevance.

---

# **10.5 Decision Projection**

## **Purpose**

Support authorized professional commitment under uncertainty.

## **Primary entities**

Decision  
Question  
Alternative  
Claim  
Evidence  
Constraint  
Risk  
ConfidenceAssessment  
Participant

## **Core questions**

* What decision is required?  
* Who has authority?  
* Which alternatives exist?  
* What supports each alternative?  
* What trade-offs apply?  
* What uncertainty remains?  
* What constraints are mandatory?  
* What happens if the decision is deferred?

## **Canonical presentation**

A material Decision projection SHOULD include:

Decision Question  
Decision Status  
Authority  
Alternatives  
Evaluation Criteria  
Supporting Claims  
Supporting Evidence  
Contradicting Evidence  
Assumptions  
Constraints  
Risks  
Residual Uncertainty  
Recommendation  
Rationale  
Effective Time

## **Permitted commands**

ProposeDecision  
RequestDecision  
ApproveDecision  
RejectDecision  
DeferDecision  
ReopenDecision  
SupersedeDecision

Actions SHALL vary by authority.

---

# **10.6 Execution Projection**

## **Purpose**

Show how Decisions are being translated into Actions and changes in reality.

## **Primary entities**

Action  
Decision  
Artifact  
Participant  
Dependency  
Constraint  
Outcome

## **Core questions**

* What has been authorized?  
* What is currently being executed?  
* Who or what is executing it?  
* Which dependencies apply?  
* What intended effect is expected?  
* What evidence of execution exists?  
* What remains incomplete?

## **Prohibition**

Execution success SHALL NOT be presented as outcome success without applicable Observation and Validation.

---

# **10.7 Observation Projection**

## **Purpose**

Compare observed reality with expected reality.

## **Primary entities**

Observation  
Action  
Expected Observation  
Outcome  
Claim  
Assumption  
Representation  
Evidence

## **Core questions**

* What happened?  
* What was expected?  
* What differed?  
* Is the variance meaningful?  
* Does this invalidate an Assumption or Claim?  
* Does this require reconciliation?

## **Canonical visualizations**

* expected-versus-observed comparison;  
* temporal telemetry;  
* anomaly view;  
* outcome assessment;  
* observation provenance;  
* operational feedback map.

---

# **10.8 Reconciliation Projection**

## **Purpose**

Expose, analyze, and resolve coherence loss.

## **Primary entities**

Reconciliation  
Contradiction  
Affected Entity  
Affected PWU  
Affected Decision  
Affected Outcome  
Proposed Revision  
Validation

## **Core questions**

* What became incoherent?  
* What triggered detection?  
* Which entities are affected?  
* What prior Decisions depend on the affected state?  
* What changes are proposed?  
* What downstream consequences follow?  
* Who must approve the resolution?  
* Which contradictions remain?

## **Canonical states**

detected  
analyzing  
proposed  
under\_review  
accepted  
rejected  
applied  
partially\_applied  
escalated

## **Critical rule**

The prior state SHALL remain inspectable after reconciliation is applied.

---

# **11\. Structural Projections**

---

# **11.1 PWU Workspace Projection**

The PWU Workspace is the canonical local projection of one semantic PWU.

It SHALL integrate, not duplicate, the underlying cognitive projections.

## **Required regions**

### **Context Header**

Shows:

* PWU title;  
* professional objective;  
* lifecycle state;  
* cognitive state;  
* parent context;  
* Intent;  
* owner or coordinating harness;  
* current disposition.

### **Cognitive Summary**

Shows:

* current understanding;  
* primary uncertainty;  
* current confidence;  
* active reasoning;  
* pending decision;  
* material contradiction;  
* next professional transition.

### **Projection Selector**

Allows movement among:

Overview  
Understanding  
Reasoning  
Evidence  
Decisions  
Execution  
Observation  
Reconciliation  
Decomposition  
History

### **Context Inspector**

Provides persistent access to:

Scope  
Participants  
Assumptions  
Constraints  
Dependencies  
Validations  
Provenance

### **Command Region**

Displays only commands valid for:

* current lifecycle state;  
* current cognitive state;  
* user role;  
* authority;  
* validation condition;  
* PWA policy.

---

# **11.2 Decomposition Projection**

## **Purpose**

Represent recursive composition and the obligation to reconstruct coherent understanding.

## **Primary entities**

Parent PWU  
Child PWU  
Delegation Contract  
Dependency  
Recomposition Requirement  
RPH

## **Required information**

For each child PWU:

* delegated objective;  
* relationship type;  
* lifecycle state;  
* cognitive state;  
* assigned Participants;  
* blocking condition;  
* required output;  
* residual uncertainty;  
* recomposition status.

## **Required parent indicators**

* cross-child contradictions;  
* unresolved interfaces;  
* missing outputs;  
* child confidence distribution;  
* synthesis readiness;  
* parent completion blockers.

## **Prohibition**

The decomposition view SHALL NOT imply parent completion merely because all children display completion.

---

# **11.3 Dependency Projection**

## **Purpose**

Expose professional dependency structure and propagation risk.

## **Dependency categories**

informational  
logical  
temporal  
resource  
authority  
evidence  
validation  
implementation  
operational  
external

## **Required capabilities**

* filter by dependency type;  
* identify blockers;  
* show upstream and downstream impact;  
* identify circular dependencies;  
* identify unresolved cross-PWU dependencies;  
* trace change propagation;  
* initiate impact assessment.

---

# **11.4 History Projection**

## **Purpose**

Preserve reconstructability across time.

## **Required capabilities**

* view entity evolution;  
* compare versions;  
* inspect state transitions;  
* inspect commands and resulting events;  
* inspect provenance;  
* view decisions effective at a particular time;  
* reconstruct the PWU or endeavor as of a historical point;  
* inspect reconciliation history.

## **Temporal modes**

current  
as\_of  
between\_versions  
change\_since  
decision\_time  
observation\_time  
recorded\_time

---

# **12\. Coordination Projections**

---

# **12.1 RPH Coordination Projection**

## **Purpose**

Allow authorized Participants to supervise professional coordination.

## **Primary entities**

RPH  
PWU  
Participant  
Dependency  
Validation  
Reconciliation  
Escalation  
Tactic

## **Required views**

### **Work Portfolio**

Shows active, awaiting, blocked, reconciling, completed, and escalated PWUs.

### **Coordination Bottlenecks**

Shows:

* authority bottlenecks;  
* evidence bottlenecks;  
* validation bottlenecks;  
* expertise bottlenecks;  
* dependency bottlenecks;  
* synthesis bottlenecks.

### **Tactic Health**

Shows:

* current strategy;  
* iterations attempted;  
* uncertainty reduction;  
* repeated failures;  
* oscillation;  
* tactic-change triggers.

### **Delegation Tree**

Shows recursive RPH and PWU delegation.

### **Escalation Queue**

Shows:

* escalation reason;  
* responsible authority;  
* risk of delay;  
* risk of proceeding;  
* recommended options;  
* elapsed wait.

### **Synthesis Queue**

Shows parent PWUs awaiting recomposition or cross-child synthesis.

---

# **12.2 Organizational Reasoning Landscape**

## **Purpose**

Provide a cross-endeavor view of current organizational cognition.

## **Required dimensions**

Outcomes  
Intents  
PWAs  
Endeavors  
PWUs  
Participants  
Uncertainty  
Decisions  
Evidence  
Risk  
Coherence  
Reconciliation

## **Canonical questions**

* Where is the organization least certain?  
* Which outcomes are most threatened?  
* Which decisions are bottlenecked?  
* Where is evidence weakest?  
* Which assumptions create systemic exposure?  
* Which PWUs are central dependencies?  
* Where is organizational reasoning fragmented?  
* Which AI Participants are producing material decisions or Claims?  
* Where is human review accumulating?

---

# **13\. Narrative Projections**

Narrative projections convert structured professional cognition into coherent temporal or explanatory accounts.

Examples:

* What changed overnight?  
* Why is this PWU blocked?  
* How did the architecture reach its current form?  
* What decisions led to this production incident?  
* What should a new team member understand first?

## **13.1 Narrative Contract**

Every generated narrative SHALL identify:

scope  
timeRange  
purpose  
sourceEntityIds  
generatedBy  
generatedAt  
confidence  
knownOmissions  
validationStatus

## **13.2 Narrative Types**

status\_narrative  
decision\_history  
change\_summary  
onboarding\_narrative  
incident\_narrative  
outcome\_progress  
reasoning\_summary  
reconciliation\_summary  
handoff\_narrative

## **13.3 Prohibition**

Narrative fluency SHALL NOT be treated as evidence of factual completeness.

---

# **14\. Analytical Projections**

Analytical projections calculate indicators from authoritative state.

## **14.1 Canonical Metrics**

Potential metrics include:

uncertainty\_reduction\_rate  
unsupported\_claim\_count  
critical\_assumption\_exposure  
decision\_latency  
validation\_coverage  
evidence\_quality\_distribution  
dependency\_blockage  
reconciliation\_backlog  
cross\_pwu\_conflict\_count  
intent\_traceability\_coverage  
human\_review\_latency  
ai\_contribution\_ratio  
reopening\_rate  
recomposition\_readiness

## **14.2 Metric Contract**

Every metric SHALL declare:

metricId  
name  
professionalMeaning  
formula  
sourceEntities  
sourceRelationships  
timeWindow  
limitations  
thresholds  
version

## **14.3 Synthetic Scores**

Synthetic scores MAY be used for orientation.

They SHALL:

* disclose their component measures;  
* expose weighting;  
* avoid false precision;  
* remain navigable to underlying evidence;  
* not replace professional judgment.

---

# **15\. Predictive Projections**

Predictive projections estimate possible future professional or operational states.

Examples:

* likely decision delay;  
* likely dependency blockage;  
* confidence trajectory;  
* expected validation failure;  
* probable outcome risk;  
* projected reconciliation impact.

## **15.1 Required Disclosures**

Every prediction SHALL expose:

* predicted subject;  
* prediction horizon;  
* method;  
* training or evidence basis where applicable;  
* Confidence Assessment;  
* assumptions;  
* limitations;  
* last recalculation time.

## **15.2 Authority Rule**

A prediction SHALL NOT automatically become a Decision or Action authorization.

---

# **16\. Projection Query Model**

Projection queries SHALL express semantic intent rather than raw storage structure where possible.

## **16.1 Canonical Query Components**

subject  
purpose  
entityTypes  
relationshipPaths  
filters  
timeContext  
roleContext  
authorityContext  
aggregation  
ordering  
depth  
includeProvenance  
includeContradictions  
includeConfidence

## **16.2 Example Semantic Query**

Show all unresolved Questions and material Uncertainties  
that block approval of Decision D,  
including supporting or contradicting Evidence,  
critical Assumptions,  
responsible Participants,  
and affected downstream PWUs.

## **16.3 Query Result Metadata**

Every projection response SHOULD include:

generatedAt  
asOfTime  
sourceVersionVector  
resultCompleteness  
staleness  
appliedFilters  
omittedCount  
authorizationScope

---

# **17\. Projection Consistency**

Janumi projections may be built from event streams, relational queries, graph queries, search indexes, materialized views, or caches.

The user experience SHALL distinguish:

authoritative\_current  
current\_eventually\_consistent  
stale  
partial  
offline\_snapshot  
historical  
predicted

## **17.1 Staleness Contract**

Where a projection may be stale, it SHALL disclose:

* last successful refresh;  
* source version;  
* expected update latency;  
* whether commands remain permitted.

## **17.2 Command Safety**

A stale projection SHALL NOT permit a state-changing command when executing it could violate current invariants without optimistic concurrency or revalidation.

---

# **18\. Projection Refresh Model**

Projection updates MAY be:

event\_driven  
query\_on\_demand  
scheduled  
streaming  
manually\_refreshed  
offline\_synchronized

## **18.1 Event-Driven Update**

Preferred for active PWU and RPH workspaces.

## **18.2 Query on Demand**

Appropriate for expensive, low-frequency analytical views.

## **18.3 Scheduled**

Appropriate for periodic organizational summaries.

## **18.4 Offline Synchronization**

Appropriate for mobile or disconnected professional work.

Conflicts arising during synchronization SHALL trigger explicit reconciliation or conflict resolution.

---

# **19\. Interaction Grammar**

The Janumi interface SHALL support a canonical grammar of professional interaction.

## **19.1 Inspect**

View an entity or projection without altering state.

## **19.2 Trace**

Navigate relationships to understand origin, dependencies, evidence, or consequences.

## **19.3 Compare**

Evaluate alternatives, versions, observations, or Claims.

## **19.4 Challenge**

Contest a Claim, Assumption, Decision basis, or Representation.

## **19.5 Contribute**

Add Evidence, Representation, Observation, Question, or professional analysis.

## **19.6 Propose**

Suggest a Decision, reconciliation, decomposition, Action, or state transition.

## **19.7 Validate**

Perform a governed evaluation against explicit criteria.

## **19.8 Authorize**

Exercise authority to approve a Decision or Action.

## **19.9 Delegate**

Create bounded subordinate professional responsibility.

## **19.10 Reconcile**

Resolve detected incoherence.

## **19.11 Escalate**

Transfer unresolved work to appropriate authority or expertise.

## **19.12 Synthesize**

Reconstruct coherent parent understanding from subordinate work.

These verbs SHOULD shape UI labels and API commands.

Generic verbs such as “Save,” “Submit,” or “Update” MAY exist but SHOULD NOT replace the professional meaning of an action.

---

# **20\. Cognitive Zoom**

Cognitive zoom is the canonical navigation mechanism for moving across levels of professional reasoning.

## **20.1 Zoom Levels**

Organization  
Portfolio  
Endeavor  
Outcome  
Intent  
Program or Capability  
PWU  
Child PWU  
Reasoning Activity  
Representation  
Claim  
Evidence  
Observation  
Source

Not every PWA requires every level.

## **20.2 Zoom In**

Reveals:

* greater semantic detail;  
* narrower scope;  
* more direct provenance;  
* more granular reasoning;  
* specific professional actions.

## **20.3 Zoom Out**

Reveals:

* broader outcome context;  
* synthesis;  
* dependencies;  
* cross-PWU effects;  
* organizational coherence.

## **20.4 Zoom Invariant**

Changing zoom SHALL preserve visible context regarding:

* current Intent;  
* parent relationship;  
* professional objective;  
* temporal position;  
* active filters.

Users SHALL not feel that they entered an unrelated application merely because they changed semantic scale.

---

# **21\. Cognitive Time**

Janumi SHALL support navigation through the evolution of professional cognition.

## **21.1 Time Modes**

Now  
At Historical Time  
Before and After  
Change Since  
Decision Effective Time  
Observation Time  
Predicted Future

## **21.2 Temporal Comparison**

Users SHOULD be able to inspect:

* what changed;  
* why it changed;  
* who or what changed it;  
* which Evidence triggered it;  
* which Decisions were reopened;  
* which downstream entities were affected.

## **21.3 Temporal Warning**

Viewing historical state SHALL be visually and semantically unmistakable.

Commands initiated from historical state SHALL be prohibited or explicitly converted into proposals against current state.

---

# **22\. Cross-Projection Navigation**

Moving from one projection to another SHALL preserve professional context.

Example:

Decision Projection  
    → inspect supporting Claim  
    → inspect contradicting Evidence  
    → inspect source Observation  
    → inspect affected Assumption  
    → return to Decision

The system SHOULD retain:

* originating projection;  
* navigation path;  
* selected entity;  
* filters;  
* temporal context;  
* unresolved user work.

Browser-style history alone is insufficient when professional context spans multiple projections.

---

# **23\. Workspace Composition**

A Janumi workspace is a composition of projections, not a monolithic page.

## **23.1 Canonical Workspace Anatomy**

┌─────────────────────────────────────────────────────────┐  
│ Global Context and Cognitive Location                   │  
├─────────────────────────────────────────────────────────┤  
│ Local Objective, State, Confidence, Uncertainty         │  
├───────────────┬─────────────────────────┬───────────────┤  
│ Context Rail  │ Primary Projection      │ Inspector     │  
│               │                         │               │  
├───────────────┴─────────────────────────┴───────────────┤  
│ Professional Commands / Activity / Reconciliation       │  
└─────────────────────────────────────────────────────────┘

## **23.2 Global Context**

Shows:

* organization;  
* endeavor;  
* PWA;  
* current cognitive zoom level;  
* current Participant role;  
* global notifications requiring professional attention.

## **23.3 Local Objective Region**

Shows:

* current Intent;  
* professional objective;  
* lifecycle state;  
* cognitive state;  
* current confidence;  
* primary uncertainty.

## **23.4 Context Rail**

Shows stable local context.

## **23.5 Primary Projection**

Shows the active cognitive instrument.

## **23.6 Inspector**

Shows details and relationships for the selected entity.

## **23.7 Command Region**

Shows valid professional commands and their preconditions.

---

# **24\. Responsive Surface Profiles**

The same projection may be expressed differently by surface.

---

# **24.1 Web and Desktop Profile**

Best suited for:

* multi-projection composition;  
* graph exploration;  
* complex comparison;  
* decomposition;  
* evidence analysis;  
* decision review;  
* RPH supervision.

May display multiple synchronized regions simultaneously.

---

# **24.2 VS Code Profile**

Best suited for:

* product-realization PWUs;  
* code-linked Representations;  
* implementation reasoning;  
* test and validation state;  
* architecture traceability;  
* agent execution;  
* local reconciliation.

The VS Code surface SHALL not reduce Janumi to a chat panel.

It SHOULD preserve:

* current PWU objective;  
* Intent;  
* active reasoning;  
* affected code;  
* relevant decisions;  
* validations;  
* reconciliation status.

Source code is one Representation within the PWU, not the organizing model of the entire experience.

---

# **24.3 Mobile Profile**

Best suited for:

* review;  
* approval;  
* evidence capture;  
* Observation recording;  
* field work;  
* escalation response;  
* concise organizational understanding.

Mobile presentation MAY serialize complex projections into focused sequences.

It SHALL preserve:

* semantic context;  
* authority;  
* confidence;  
* uncertainty;  
* provenance;  
* impact.

---

# **24.4 Conversational Profile**

Best suited for:

* querying the cognitive model;  
* guided exploration;  
* professional contribution;  
* structured command initiation;  
* narrative summaries.

Conversation SHALL remain anchored to authoritative entities.

The system SHOULD convert material conversational outputs into explicit entities rather than leave them trapped in chat history.

---

# **24.5 External System Profile**

Used for:

* APIs;  
* reports;  
* exports;  
* regulatory submissions;  
* partner exchange;  
* enterprise integrations.

Exports SHALL declare:

* source state;  
* generation time;  
* scope;  
* omissions;  
* validity;  
* authoritative status.

---

# **25\. Role-Aware Projection Behavior**

Projections SHALL adapt to professional role without fragmenting truth.

## **25.1 Contributor View**

Emphasizes:

* assigned objective;  
* inputs;  
* constraints;  
* open Questions;  
* active reasoning;  
* required outputs;  
* validation criteria.

## **25.2 Reviewer View**

Emphasizes:

* Claims;  
* Evidence;  
* Assumptions;  
* changes;  
* unresolved contradictions;  
* review criteria.

## **25.3 Approver View**

Emphasizes:

* Decision question;  
* authority;  
* alternatives;  
* Evidence;  
* constraints;  
* residual uncertainty;  
* downstream effects.

## **25.4 Coordinator View**

Emphasizes:

* PWU portfolio;  
* dependencies;  
* blockages;  
* tactic health;  
* allocation;  
* synthesis;  
* escalation.

## **25.5 Executive View**

Emphasizes:

* outcomes;  
* strategic uncertainty;  
* decision bottlenecks;  
* coherence risks;  
* capability limitations;  
* cross-organizational dependencies.

## **25.6 AI Participant View**

An AI-facing projection SHOULD provide:

* explicit objective;  
* scope;  
* authoritative context;  
* current state;  
* inputs;  
* constraints;  
* required outputs;  
* completion and escalation conditions.

AI projections SHOULD minimize irrelevant context without omitting material professional constraints.

---

# **26\. Attention Model**

Janumi SHALL distinguish activity from required professional attention.

## **26.1 Attention Types**

decision\_required  
review\_required  
validation\_required  
evidence\_required  
contradiction\_detected  
assumption\_invalidated  
dependency\_blocked  
intent\_changed  
reconciliation\_required  
escalation\_received  
outcome\_at\_risk

## **26.2 Attention Priority**

Priority SHOULD derive from:

* outcome impact;  
* urgency;  
* dependency centrality;  
* authority requirement;  
* safety or legal implication;  
* number of affected PWUs;  
* time sensitivity;  
* confidence degradation.

## **26.3 No Generic Inbox**

Janumi MAY provide an attention queue.

It SHOULD not reduce professional attention to a chronological inbox of messages.

Each attention item SHALL remain connected to:

* professional context;  
* required decision or action;  
* affected entities;  
* relevant evidence;  
* authority.

---

# **27\. Projection-Derived Commands**

A projection enables commands but does not itself change state.

## **27.1 Command Context**

Every command initiated from a projection SHOULD include:

originatingProjectionDefinitionId  
originatingProjectionInstanceId  
selectedEntityIds  
visibleSourceVersions  
participantRole  
temporalContext

## **27.2 Preflight Validation**

Before enabling a material command, the UI SHOULD query or calculate:

* current authority;  
* transition validity;  
* mandatory constraints;  
* stale data status;  
* unresolved validation failure;  
* optimistic concurrency version;  
* required input completeness.

## **27.3 Failed Command Presentation**

A failed command SHALL explain the professional reason.

Preferred:

Cannot approve this decision because the mandatory security validation failed and the approving authority does not possess exception authority.

Insufficient:

Error 409\.

Technical details MAY be available separately.

---

# **28\. Projection Security and Information Boundaries**

A Participant may possess access to only part of the authoritative model.

## **28.1 Security Trimming**

Projections SHALL exclude unauthorized entities and relationships.

## **28.2 Disclosure of Partiality**

When security filtering materially affects interpretation, the projection SHOULD disclose that its view is partial without revealing protected information.

## **28.3 Relationship Leakage**

A projection SHALL avoid leaking restricted information through:

* counts;  
* graph structure;  
* titles;  
* metadata;  
* inferred dependencies;  
* omitted-node placeholders.

## **28.4 Command Authority**

Visibility SHALL NOT imply mutation authority.

---

# **29\. Projection Failure Modes**

Implementations SHALL guard against the following.

## **29.1 Module Fragmentation**

Requirements, architecture, code, tests, decisions, and evidence become independent product modules with separate truths.

## **29.2 Dashboard Reductionism**

Complex professional state is collapsed into simplistic status indicators.

## **29.3 Graph Fetishism**

Everything is displayed as a graph even when a table, narrative, comparison, or focused workspace better supports cognition.

## **29.4 Chat Capture**

Material professional reasoning remains trapped in conversational history.

## **29.5 False Freshness**

Cached or historical information is presented as current.

## **29.6 Unexplained Scoring**

Synthetic metrics are presented without derivation.

## **29.7 Context Loss**

Navigation to an entity loses its originating Intent, objective, or PWU context.

## **29.8 Role Confusion**

Review, validation, and approval actions are presented as interchangeable.

## **29.9 Activity Bias**

Recent events receive greater prominence than professionally important state.

## **29.10 AI Authority Inflation**

AI-generated recommendations are visually treated as approved Decisions.

---

# **30\. Minimum Viable Projection Set**

The initial Janumi implementation SHALL support the following named projections.

## **30.1 Endeavor Overview**

Shows:

* Intent;  
* Outcomes;  
* root PWUs;  
* current uncertainty;  
* pending Decisions;  
* blocked work;  
* coherence alerts.

## **30.2 PWU Overview**

Shows the local professional state of one PWU.

## **30.3 Decomposition Projection**

Shows recursive PWU structure and recomposition status.

## **30.4 Reasoning Projection**

Shows Questions, Reasoning Activities, Claims, Assumptions, and Alternatives.

## **30.5 Evidence Projection**

Shows Claim–Evidence relationships and provenance.

## **30.6 Decision Projection**

Shows decision readiness, authority, alternatives, evidence, and uncertainty.

## **30.7 Reconciliation Projection**

Shows coherence conflicts and proposed resolution.

## **30.8 History Projection**

Shows versions, transitions, provenance, and prior state.

## **30.9 RPH Coordination Projection**

Shows active work, blockages, escalation, tactic health, and synthesis.

---

# **31\. Reference Projection Definition**

{  
  "projectionDefinitionId": "projection.pwu.decision",  
  "name": "PWU Decision Projection",  
  "version": "0.1",  
  "purpose": "Support an authorized participant in evaluating and deciding a material professional question.",  
  "projectionType": "decision",  
  "sourceModel": {  
    "rootEntityType": "Decision",  
    "includedEntityTypes": \[  
      "Question",  
      "Alternative",  
      "Claim",  
      "Evidence",  
      "Assumption",  
      "Constraint",  
      "Risk",  
      "ConfidenceAssessment",  
      "Participant"  
    \],  
    "relationshipPaths": \[  
      "CLAIM\_JUSTIFIES\_DECISION",  
      "EVIDENCE\_SUPPORTS\_CLAIM",  
      "EVIDENCE\_CONTRADICTS\_CLAIM",  
      "DECISION\_SELECTS\_ALTERNATIVE",  
      "DECISION\_ACCEPTS\_RESIDUAL\_UNCERTAINTY"  
    \]  
  },  
  "roleRules": {  
    "view": \[  
      "owner",  
      "reviewer",  
      "validator",  
      "approver",  
      "observer"  
    \],  
    "commands": {  
      "ProposeDecision": \[  
        "owner",  
        "reasoner"  
      \],  
      "ApproveDecision": \[  
        "approver"  
      \],  
      "RejectDecision": \[  
        "approver"  
      \],  
      "AddEvidence": \[  
        "contributor",  
        "reviewer",  
        "validator"  
      \]  
    }  
  },  
  "requiredDisclosures": \[  
    "provenance",  
    "confidence",  
    "residualUncertainty",  
    "contradictingEvidence",  
    "authority",  
    "staleness"  
  \],  
  "refreshMode": "event\_driven"  
}

This is illustrative and does not yet constitute the final machine schema.

---

# **32\. Coding Agent Implementation Contract**

A coding agent implementing Janumi projections SHALL:

1. Treat projections as derived views over authoritative semantic state.  
2. Keep semantic, interaction, and presentation layers distinct.  
3. Avoid creating independent local truth per screen.  
4. Preserve entity identity across projections.  
5. Preserve professional context during navigation.  
6. Expose provenance, confidence, uncertainty, and contradiction where relevant.  
7. derive available commands from state, role, authority, and policy.  
8. perform server-side validation for all commands.  
9. disclose stale, partial, historical, and predicted state.  
10. retain originating projection context in commands.  
11. avoid generic dashboards that conceal professional meaning.  
12. avoid designing navigation primarily around file or storage hierarchy.  
13. support cognitive zoom and cognitive time.  
14. use semantic event updates rather than broad page refreshes where practical.  
15. ensure mobile, web, desktop, and IDE surfaces preserve semantic continuity.  
16. expose why actions are unavailable rather than merely disabling controls.  
17. ensure material AI output becomes explicit professional entities.  
18. avoid using conversation history as the sole persistence mechanism.  
19. ensure projection calculations are explainable.  
20. validate projection conformance through automated tests.

---

# **33\. Acceptance Scenarios**

## **Scenario A — Cross-Projection Context Preservation**

Given:

* a user is reviewing Decision D within PWU P;  
* the user selects contradicting Evidence E;  
* the user navigates to the source Observation O;

When:

* the user returns to the Decision projection;

Then:

* Decision D remains selected;  
* PWU P remains the active context;  
* prior filters remain;  
* temporal mode remains;  
* the inspected Evidence path remains available.

---

## **Scenario B — Stale Approval Projection**

Given:

* an approver opened a Decision projection at version 12;  
* new Evidence was added and the Decision advanced to version 14;

When:

* the approver attempts approval from the stale projection;

Then:

* the command is revalidated;  
* approval is rejected or refreshed;  
* the user is shown what materially changed;  
* no state is overwritten.

---

## **Scenario C — AI Recommendation Attribution**

Given:

* an AI Participant proposes Alternative A;

When:

* Alternative A appears in the Decision projection;

Then:

* AI authorship is visible;  
* supporting Evidence is accessible;  
* confidence and limitations are shown;  
* the recommendation is not styled as approved;  
* authorized humans retain the approval command.

---

## **Scenario D — Completed Children, Incomplete Parent**

Given:

* all child PWUs are completed;  
* cross-child contradiction remains;  
* parent synthesis is incomplete;

When:

* the decomposition projection is displayed;

Then:

* child completion is visible;  
* parent state remains incomplete;  
* contradiction is prominent;  
* recomposition requirement is shown;  
* parent completion command is unavailable.

---

## **Scenario E — Historical State**

Given:

* the user selects “as of June 30, 2026”;

When:

* the PWU projection renders;

Then:

* all entities reflect the selected historical state;  
* a historical-state indicator is persistent;  
* current-state commands are unavailable;  
* the user may compare historical and current state.

---

## **Scenario F — Security-Trimmed Projection**

Given:

* a Participant lacks access to legal-review Evidence;

When:

* the Decision projection is rendered;

Then:

* restricted Evidence is not leaked;  
* the view indicates that access limitations may affect completeness;  
* the Decision cannot be approved if policy requires review of the restricted Evidence.

---

# **34\. Resulting Reference Experience**

The Canonical Projection Model establishes the following Janumi experience:

A professional enters an endeavor, PWU, or organizational context.

They do not encounter isolated modules.

They encounter the current professional cognition relevant to their purpose.

They may inspect:

* Intent;  
* understanding;  
* reasoning;  
* Evidence;  
* Decisions;  
* execution;  
* Observation;  
* reconciliation.

They may zoom outward toward organizational outcomes or inward toward individual Claims and Evidence.

They may move backward through cognitive history or compare expected and observed reality.

They may initiate governed professional commands.

Every projection remains connected to one semantic model.

The result is not merely a consistent UI.

It is a coherent professional cognitive environment.

---

# **35\. Next Normative Artifact**

The next required document is the **Reference Interaction and Workspace Specification**.

It shall convert this projection model into concrete UI and UX behavior, including:

* application shell;  
* navigation model;  
* PWU workspace anatomy;  
* reasoning canvas;  
* decomposition viewer;  
* evidence explorer;  
* decision workspace;  
* reconciliation workspace;  
* persistent context;  
* command placement;  
* attention management;  
* responsive behavior;  
* VS Code profile;  
* mobile profile;  
* accessibility;  
* loading, stale, partial, and error states;  
* component-level semantic invariants.

That specification will be sufficiently concrete for the coding agent to implement the first coherent Janumi UI rather than a collection of conventional application pages.

\===

# **Reference Interaction and Workspace Specification**

## **RIWS Specification v0.1**

**Status:** Normative draft  
**Depends on:** Canonical Professional Cognition Ontology v0.1, Professional Work Unit Specification v0.1, Recursive Professional Harness Coordination Specification v0.1, Canonical Projection Model v0.1, Professional Cognition Life Cycle, Janumi Constitution  
**Applies to:** Janumi Professional Workbench, JanumiCode, future Professional Work Architectures, web, desktop, VS Code, mobile, and conversational surfaces  
**Primary audiences:** UX architects, product designers, frontend engineers, coding agents, accessibility engineers, PWA authors, backend API designers

---

# **1\. Purpose**

This specification defines the canonical interaction model and workspace architecture through which professionals inspect, manipulate, coordinate, and reconcile professional cognition in Janumi.

It converts the Canonical Projection Model into implementable user experience behavior.

This specification defines:

* the Janumi application shell;  
* the canonical navigation model;  
* cognitive location and zoom;  
* the PWU workspace;  
* persistent professional context;  
* projection switching;  
* the decomposition viewer;  
* the reasoning workspace;  
* the evidence explorer;  
* the decision workspace;  
* the execution and observation workspace;  
* the reconciliation workspace;  
* RPH coordination surfaces;  
* professional attention management;  
* command presentation and validation;  
* AI participation patterns;  
* loading, stale, partial, and failure states;  
* responsive surface profiles;  
* accessibility requirements;  
* component-level semantic invariants.

The interface SHALL not be designed as a collection of loosely related product pages.

It SHALL operate as a coherent environment over one authoritative professional cognition model.

---

# **2\. Foundational Interaction Principle**

Every Janumi interaction SHALL preserve the relationship among:

Professional Purpose  
\+  
Current Intent  
\+  
Current Cognitive Object  
\+  
Current Cognitive State  
\+  
Current Lifecycle State  
\+  
Participant Role  
\+  
Participant Authority  
\+  
Temporal Context  
\+  
Professional History

The interface SHALL help the professional understand:

* where they are;  
* why this work exists;  
* what is currently understood;  
* what remains uncertain;  
* what requires attention;  
* what they are permitted to do;  
* what professional effect their action will have.

---

# **3\. Primary Experience Object**

The primary experience object is not:

* a page;  
* a file;  
* a folder;  
* a project;  
* a task;  
* a chat session;  
* a dashboard card.

The primary experience object is a **professionally meaningful cognitive context**.

A cognitive context may be centered on:

* an Endeavor;  
* an Outcome;  
* an Intent;  
* a PWU;  
* a Decision;  
* a Claim;  
* an Evidence item;  
* a Reconciliation;  
* an RPH;  
* an organizational projection.

The UI SHALL make transitions among these contexts explicit and reversible.

---

# **4\. Application Shell**

The Janumi shell SHALL provide stable global orientation while allowing the primary cognitive workspace to adapt to the active professional purpose.

## **4.1 Canonical Shell Regions**

┌─────────────────────────────────────────────────────────────────┐  
│ Global Header                                                   │  
├───────────────┬─────────────────────────────────┬───────────────┤  
│ Global Rail   │ Cognitive Workspace             │ Context Panel │  
│               │                                 │               │  
├───────────────┴─────────────────────────────────┴───────────────┤  
│ Command / Attention / Activity Region                           │  
└─────────────────────────────────────────────────────────────────┘

Not all regions must remain simultaneously visible on smaller surfaces.

Semantic access SHALL remain available even when presentation changes.

---

# **5\. Global Header**

The Global Header SHALL communicate the user’s broad operating context.

## **5.1 Required Elements**

Organization  
Active PWA  
Current Endeavor  
Current Cognitive Location  
Participant Identity  
Participant Role  
Temporal Mode  
Global Attention Indicator  
System State Indicator

## **5.2 Organization Selector**

Where a Participant has access to multiple organizations or tenants, switching organizations SHALL:

* change the authoritative semantic context;  
* clear incompatible local selections;  
* preserve no unauthorized cross-tenant state;  
* visibly identify the newly active organization;  
* require revalidation of cached projections.

## **5.3 PWA Selector**

The PWA selector identifies the active professional domain environment.

Examples:

JanumiCode  
JanumiScience  
JanumiLegal  
JanumiConstruction

Changing the PWA MAY alter:

* domain terminology;  
* available projection definitions;  
* validators;  
* role capabilities;  
* specialized entity types;  
* workspace composition.

It SHALL NOT change the foundational CPCO semantics.

## **5.4 Temporal Mode Indicator**

The header SHALL clearly distinguish:

Current  
Historical  
Comparison  
Predicted  
Offline Snapshot  
Stale

Historical or predicted mode SHALL remain visible while active.

---

# **6\. Global Navigation Rail**

The global navigation rail provides access to stable organizational projections.

## **6.1 Canonical Destinations**

Home  
Outcomes  
Endeavors  
Work  
Decisions  
Evidence  
Reconciliation  
Coordination  
Memory  
Attention

PWA-specific destinations MAY be added.

## **6.2 Navigation Meaning**

### **Home**

A role-specific orientation projection showing current professional priorities and significant changes.

### **Outcomes**

Cross-endeavor desired and observed outcomes.

### **Endeavors**

Active and historical professional undertakings.

### **Work**

PWUs organized by professional meaning, not merely by status.

### **Decisions**

Pending, approved, deferred, reopened, and superseded Decisions.

### **Evidence**

Evidence assets, gaps, provenance, and evidentiary conflicts.

### **Reconciliation**

Detected and active coherence-restoration work.

### **Coordination**

RPH activity, blockages, escalations, tactic health, and synthesis.

### **Memory**

Narrative and structured organizational memory.

### **Attention**

Professional conditions requiring the Participant’s involvement.

## **6.3 Rail Prohibition**

The rail SHALL NOT become a list of internal technical modules such as:

Entities  
Relationships  
Events  
Schemas  
Database  
Agent Runs

These may exist in administrative or developer tools, but they do not constitute the primary professional experience.

---

# **7\. Cognitive Breadcrumb**

Every bounded workspace SHALL display a cognitive breadcrumb.

Example:

Organization  
› Product Realization Endeavor  
› Enterprise Authentication  
› Architecture PWU  
› Decision: Tenant Isolation Strategy

## **7.1 Breadcrumb Requirements**

The breadcrumb SHALL:

* represent semantic containment or contextual traversal;  
* distinguish containment from mere navigation history;  
* allow movement to meaningful ancestors;  
* preserve the selected entity where possible;  
* expose recursive PWU structure;  
* identify when the current context is referenced from outside its owning PWU.

## **7.2 Cross-Context Indicator**

When viewing an entity through a relationship rather than containment, the UI SHOULD indicate:

Viewed from Decision D  
Owned by PWU P

---

# **8\. Cognitive Zoom**

Cognitive zoom is the canonical mechanism for changing semantic scale.

## **8.1 Zoom Levels**

A reference implementation SHOULD support:

Organization  
Portfolio  
Endeavor  
Outcome  
Intent  
PWU  
Child PWU  
Reasoning Activity  
Decision  
Claim  
Evidence  
Observation  
Source

## **8.2 Zoom Behavior**

Zooming in SHALL reveal greater detail without losing broader professional context.

Zooming out SHALL reveal:

* parent purpose;  
* cross-PWU dependencies;  
* outcome contribution;  
* synthesis;  
* organizational impact.

## **8.3 Direct Navigation**

Search, links, notifications, and external references MAY navigate directly to a deep entity.

When this occurs, the interface SHALL reconstruct enough parent context to prevent disorientation.

---

# **9\. Workspace Header**

Every local cognitive workspace SHALL contain a workspace header.

## **9.1 Required Information**

Title  
Entity Type  
Professional Objective or Semantic Purpose  
Lifecycle State  
Cognitive State  
Parent Context  
Originating Intent  
Owner or Steward  
Current Confidence  
Primary Uncertainty  
Pending Reconciliation  
Last Material Change

## **9.2 State Presentation**

Lifecycle and cognitive state SHALL be shown separately.

Example:

Lifecycle: Awaiting Review  
Cognitive State: Decision

The interface SHALL NOT collapse these into a generic label such as:

Pending  
In Progress  
Open

without preserving their distinct meanings.

## **9.3 State Explanation**

Selecting a state SHALL explain:

* what the state means;  
* why the object is currently in it;  
* which conditions must be satisfied to leave it;  
* who possesses authority to act;  
* what is blocking advancement.

---

# **10\. Persistent Professional Context**

The interface SHALL maintain ready access to the context necessary for responsible professional reasoning.

## **10.1 Canonical Context Categories**

Intent  
Objective  
Scope  
Participants  
Assumptions  
Constraints  
Dependencies  
Confidence  
Uncertainty  
Validations  
Provenance  
History

## **10.2 Context Panel**

On large surfaces, these categories SHOULD appear in a persistent or collapsible context panel.

On smaller surfaces, they MAY appear through:

* contextual drawers;  
* focused tabs;  
* expandable summaries;  
* progressive disclosure.

## **10.3 Materiality Rules**

Critical conditions SHALL not be hidden solely because a panel is collapsed.

Examples:

* invalidated critical assumption;  
* mandatory validation failure;  
* unresolved contradiction;  
* mandatory constraint violation;  
* stale authoritative data;  
* pending reconciliation.

These require persistent visible indicators.

---

# **11\. Projection Selector**

A cognitive context may support multiple projections.

## **11.1 Canonical PWU Projections**

Overview  
Understanding  
Reasoning  
Evidence  
Decisions  
Execution  
Observations  
Reconciliation  
Decomposition  
History

## **11.2 Projection State**

Switching projections SHALL preserve:

* active PWU;  
* selected entity where relevant;  
* temporal mode;  
* applicable filters;  
* navigation origin;  
* unsaved local drafting state where safe.

## **11.3 Projection Availability**

Projection options MAY be hidden or disabled where semantically inapplicable.

The UI SHOULD explain why a projection is unavailable.

Example:

Observation view becomes available after an Action or external Observation is recorded.

---

# **12\. PWU Overview Workspace**

The PWU Overview is the primary orientation surface for one Professional Work Unit.

## **12.1 Purpose**

It answers:

* Why does this PWU exist?  
* What is its current professional condition?  
* What has changed?  
* What remains uncertain?  
* What must happen next?  
* Is intervention required?

## **12.2 Required Sections**

### **Professional Objective**

The objective SHALL be prominent and expressed as a professionally meaningful result.

### **Current State Summary**

Displays:

Lifecycle State  
Cognitive State  
Current Disposition  
Current Confidence  
Primary Uncertainty  
Primary Blocker  
Next Required Transition

### **Intent and Outcome Trace**

Shows the PWU’s contribution to active Intent and Outcomes.

### **Current Understanding**

A concise, attributed synthesis of:

* supported Claims;  
* material Assumptions;  
* open Questions;  
* significant Evidence;  
* known contradictions.

### **Active Work**

Shows active Reasoning Activities, Actions, Reviews, or Validations.

### **Required Attention**

Shows professional actions requiring intervention.

### **Recent Material Changes**

Shows changes ranked by professional significance rather than chronology alone.

### **Completion Readiness**

Shows:

* satisfied conditions;  
* unsatisfied conditions;  
* failed validations;  
* unresolved dependencies;  
* residual uncertainty;  
* recomposition status.

## **12.3 Overview Prohibition**

The overview SHALL NOT be reduced to a generic dashboard of progress percentages and status cards.

---

# **13\. Understanding Workspace**

## **13.1 Purpose**

The Understanding Workspace exposes the current epistemic state of the PWU.

It SHALL distinguish:

Known  
Claimed  
Assumed  
Inferred  
Unknown  
Contested  
Invalidated

## **13.2 Canonical Layout**

Open Questions  
Material Uncertainties  
Current Claims  
Critical Assumptions  
Constraints  
Confidence Distribution  
Contradictions

## **13.3 Question Interaction**

A Question may be:

* opened;  
* refined;  
* decomposed;  
* linked to an Uncertainty;  
* assigned to a Reasoning Activity;  
* answered by a Claim;  
* marked partially resolved;  
* reopened.

## **13.4 Uncertainty Presentation**

Uncertainty SHOULD be prioritized by:

* outcome impact;  
* decision impact;  
* reducibility;  
* urgency;  
* dependency centrality.

It SHALL not be treated merely as an issue severity.

## **13.5 Assumption Presentation**

Each material Assumption SHOULD display:

* status;  
* basis;  
* criticality;  
* validation method;  
* dependent Claims, Decisions, and PWUs.

---

# **14\. Reasoning Workspace**

## **14.1 Purpose**

The Reasoning Workspace makes active and historical professional reasoning inspectable and governable.

## **14.2 Canonical Views**

Reasoning Graph  
Activity Stream  
Method View  
Alternative Comparison  
Decomposition View  
Synthesis View  
Agent Contributions

## **14.3 Reasoning Activity Card**

A Reasoning Activity presentation SHALL include:

Purpose  
Reasoning Type  
Status  
Performed By  
Inputs  
Method  
Outputs  
Assumptions Introduced  
Limitations  
Confidence Effect  
Validation Status

## **14.4 AI Reasoning Presentation**

AI contributions SHALL show:

* agent role;  
* agent identity;  
* output type;  
* Evidence used;  
* Assumptions introduced;  
* professional rationale;  
* confidence;  
* limitations;  
* validation status;  
* required human review.

The UI SHALL not require or expose private hidden chain-of-thought.

## **14.5 Alternative Comparison**

Alternative comparison SHOULD support explicit criteria.

Example:

Alternative  
Security  
Cost  
Complexity  
Operational Risk  
Compliance  
Evidence Quality  
Residual Uncertainty

Comparison cells SHALL distinguish:

* evidence-backed assessment;  
* expert judgment;  
* AI inference;  
* unknown;  
* not applicable.

## **14.6 Reasoning Failure**

Failed or inconclusive reasoning SHALL remain visible and useful.

The UI SHOULD show:

* method attempted;  
* failure class;  
* Evidence gathered;  
* assumptions challenged;  
* recommended tactic change;  
* whether escalation is required.

---

# **15\. Evidence Explorer**

## **15.1 Purpose**

The Evidence Explorer enables professionals to inspect the evidentiary basis of Claims, Decisions, Assumptions, and Outcomes.

## **15.2 Canonical Modes**

Evidence Graph  
Claim–Evidence Matrix  
Evidence Table  
Provenance Chain  
Gap Analysis  
Contradiction Analysis  
Source Inspector

## **15.3 Evidence Item Presentation**

Each Evidence item SHALL expose:

Evidence Type  
Source  
Observed or Published Time  
Recorded Time  
Reliability  
Relevance  
Scope  
Supported Claims  
Contradicted Claims  
Qualification  
Validation  
Provenance  
Access Restrictions

## **15.4 Relationship Semantics**

The interface SHALL require explicit relationship classification:

Supports  
Contradicts  
Qualifies  
Inconclusive For

Dragging or attaching Evidence to a Claim SHALL not automatically imply support without confirmation of the semantic relationship.

## **15.5 Evidence Gap Presentation**

The workspace SHOULD identify:

* unsupported material Claims;  
* Claims relying on weak Evidence;  
* stale Evidence;  
* inaccessible Evidence;  
* single-source dependency;  
* conflicting Evidence;  
* unvalidated external sources.

## **15.6 Source Inspection**

Where source access is available, the user SHOULD be able to inspect the authoritative source without losing the Evidence context.

---

# **16\. Decision Workspace**

## **16.1 Purpose**

The Decision Workspace supports professional commitment under uncertainty.

It SHALL make decision readiness explicit.

## **16.2 Required Regions**

Decision Question  
Decision State  
Authority  
Alternatives  
Evaluation Criteria  
Supporting Claims  
Evidence  
Contradicting Evidence  
Assumptions  
Constraints  
Risks  
Residual Uncertainty  
Recommendation  
Rationale  
Downstream Impact

## **16.3 Decision Readiness Indicator**

Decision readiness SHALL be decomposed into explainable dimensions.

Example:

Question Defined: Yes  
Authority Confirmed: Yes  
Alternatives Evaluated: Partial  
Mandatory Constraints Checked: Yes  
Evidence Sufficient: No  
Residual Uncertainty Characterized: Partial  
Required Validation Complete: No

A synthetic readiness indicator MAY summarize these dimensions but SHALL not replace them.

## **16.4 Authority Presentation**

The workspace SHALL show:

* who may propose;  
* who may review;  
* who may approve;  
* who may grant exceptions;  
* whether quorum or multiple approvals are required.

## **16.5 Approval Interaction**

Before approval, the UI SHALL present or require acknowledgment of:

* selected Alternative;  
* rationale;  
* mandatory Constraints;  
* material Assumptions;  
* contradicting Evidence;  
* residual Uncertainty;  
* downstream effects;  
* effective time.

## **16.6 Decision Reopening**

A reopened Decision SHALL display:

* prior approved state;  
* reopening trigger;  
* changed Evidence or Assumptions;  
* affected Actions and PWUs;  
* temporary operating status.

---

# **17\. Execution Workspace**

## **17.1 Purpose**

The Execution Workspace shows authorized Actions and their relationship to Decisions and intended Outcomes.

## **17.2 Required Information**

Each Action SHALL show:

Intended Effect  
Authorizing Decision  
Executor  
Status  
Dependencies  
Constraints  
Expected Observation  
Produced Artifacts  
Execution Evidence  
Rollback or Recovery

## **17.3 Separation of States**

The interface SHALL distinguish:

Action Completed  
Action Validated  
Outcome Achieved

These are not interchangeable.

## **17.4 JanumiCode Specialization**

In JanumiCode, the Execution Workspace MAY show:

* implementation slices;  
* code changes;  
* agent runs;  
* build results;  
* test execution;  
* deployment state;  
* linked architecture and requirements.

Source code SHALL remain a Representation and Artifact within the broader professional context.

---

# **18\. Observation Workspace**

## **18.1 Purpose**

The Observation Workspace compares expected and observed reality.

## **18.2 Required Modes**

Expected vs Observed  
Timeline  
Anomaly View  
Outcome Assessment  
Operational Telemetry  
Feedback  
Field Observation

## **18.3 Observation Capture**

Observation entry SHALL distinguish:

* raw observation;  
* interpretation;  
* derived Claim;  
* Evidence relationship.

A user SHOULD be able to record an Observation without being forced to immediately interpret it.

## **18.4 Variance Presentation**

Variance SHALL be classified as:

Matches Expectation  
Within Tolerance  
Unexpected Beneficial  
Unexpected Adverse  
Inconclusive  
Measurement Failure

## **18.5 Reconciliation Trigger**

Where variance materially affects current understanding, the UI SHALL make reconciliation initiation prominent.

---

# **19\. Reconciliation Workspace**

## **19.1 Purpose**

The Reconciliation Workspace exposes and resolves loss of coherence.

## **19.2 Required Regions**

Trigger  
Detected Incoherence  
Affected Entities  
Affected PWUs  
Affected Decisions  
Affected Outcomes  
Prior State  
Proposed State  
Contradictions  
Impact Analysis  
Required Authority  
Validation  
Resolution Status

## **19.3 Before-and-After Comparison**

A reconciliation proposal SHOULD support direct comparison of:

* prior Representation;  
* proposed Representation;  
* changed Claims;  
* changed Confidence;  
* invalidated Assumptions;  
* reopened Decisions;  
* affected downstream work.

## **19.4 Reconciliation Commands**

Accept Reconciliation  
Reject Reconciliation  
Revise Proposal  
Request Evidence  
Reopen Decision  
Reopen PWU  
Create Follow-On PWU  
Accept Temporary Incoherence  
Escalate

## **19.5 Temporary Incoherence**

Where authorized, the interface SHALL require:

* rationale;  
* accepted risk;  
* scope;  
* responsible authority;  
* mitigation;  
* review or expiration date.

---

# **20\. Decomposition Viewer**

## **20.1 Purpose**

The Decomposition Viewer presents recursive professional work while preserving the obligation to recompose coherent understanding.

## **20.2 Canonical Presentation Modes**

Tree  
Graph  
Outline  
Dependency Matrix  
Swimlane  
Synthesis Readiness

## **20.3 Child PWU Representation**

Each child SHALL expose:

Delegated Objective  
Relationship Type  
Lifecycle State  
Cognitive State  
Owner or Harness  
Current Confidence  
Primary Uncertainty  
Blocker  
Required Output  
Completion State  
Recomposition Status

## **20.4 Parent Context**

The parent SHALL expose:

* original objective;  
* decomposition rationale;  
* cross-child dependencies;  
* integration boundaries;  
* synthesis obligations;  
* unresolved contradictions;  
* overall completion conditions.

## **20.5 Completion Semantics**

Completed children SHALL not visually imply a completed parent.

The viewer SHOULD represent parent synthesis readiness separately.

Example:

Children Complete: 6 of 6  
Cross-Child Coherence: Failed  
Synthesis Complete: No  
Parent Completion Ready: No

## **20.6 Decomposition Interaction**

Authorized Participants MAY:

* create child PWU;  
* revise delegation;  
* add cross-child dependency;  
* transfer scope;  
* merge child work;  
* detach child work;  
* request synthesis;  
* initiate cross-child reconciliation.

---

# **21\. RPH Coordination Workspace**

## **21.1 Purpose**

The RPH Coordination Workspace enables supervision of professional coordination across PWUs and subordinate RPHs.

## **21.2 Canonical Views**

Portfolio  
Delegation Tree  
Dependency Network  
Blockage Analysis  
Tactic Health  
Escalation Queue  
Validation Queue  
Synthesis Queue  
Reconciliation Queue  
Participant Allocation

## **21.3 Portfolio View**

PWUs SHOULD be grouped by professional condition, such as:

Needs Framing  
Ready to Start  
Actively Reducing Uncertainty  
Awaiting Evidence  
Awaiting Decision  
Awaiting Review  
Blocked  
Reconciling  
Ready for Synthesis  
Escalated

This is preferable to generic columns such as:

To Do  
Doing  
Done

## **21.4 Tactic Health**

The workspace SHALL expose indicators such as:

* iterations without meaningful progress;  
* recurring failure class;  
* uncertainty reduction trend;  
* repeated validation failure;  
* oscillation between Alternatives;  
* tool or agent saturation;  
* excessive decomposition overhead.

## **21.5 Tactic Change Interaction**

Authorized coordinators MAY:

Change Method  
Change Agent  
Request Specialist  
Broaden Search  
Narrow Scope  
Challenge Assumptions  
Decompose Differently  
Merge Work  
Escalate

## **21.6 Escalation Queue**

Each escalation SHALL show:

* objective;  
* current state;  
* blocking condition;  
* tactics attempted;  
* Evidence;  
* authority required;  
* recommended options;  
* risk of delay;  
* risk of proceeding.

---

# **22\. Professional Attention Workspace**

## **22.1 Purpose**

The Attention Workspace identifies professional conditions requiring a Participant’s involvement.

It is not a generic notification center.

## **22.2 Attention Categories**

Decision Required  
Review Required  
Validation Required  
Evidence Required  
Contradiction Detected  
Assumption Invalidated  
Dependency Blocked  
Intent Changed  
Reconciliation Required  
Escalation Received  
Outcome at Risk  
Authority Required

## **22.3 Attention Item Contract**

Every item SHALL identify:

Why Attention Is Required  
Affected Professional Context  
Required Role or Authority  
Urgency  
Outcome Impact  
Relevant Evidence  
Available Commands  
Deferral Consequences

## **22.4 Prioritization**

Attention SHOULD be ranked by professional consequence, not simply by recency.

## **22.5 Dismissal**

Material attention SHALL not be dismissible without disposition.

Permitted dispositions MAY include:

Resolved  
Delegated  
Deferred  
Accepted Risk  
Not Applicable  
Duplicate  
Escalated

---

# **23\. AI Participation Interface**

## **23.1 AI as Participant**

AI SHALL appear as an attributable professional Participant rather than invisible background automation.

## **23.2 AI Contribution Types**

Question  
Claim  
Evidence Retrieval  
Representation  
Alternative  
Recommendation  
Validation  
Critique  
Observation Interpretation  
Reconciliation Proposal  
Decomposition Proposal  
Tactic Change Proposal

## **23.3 Contribution Presentation**

AI contributions SHALL expose:

* agent role;  
* source context;  
* Evidence;  
* Assumptions;  
* confidence;  
* limitations;  
* validation state;  
* review requirement.

## **23.4 Conversational Interaction**

Conversation MAY be used to:

* query the model;  
* refine an objective;  
* inspect reasoning;  
* initiate semantic commands;  
* contribute professional entities.

Material outputs SHALL be convertible into explicit CPCO entities.

## **23.5 AI Activity Stream**

The interface MAY show active AI work.

It SHOULD distinguish:

Queued  
Reasoning  
Waiting for Tool  
Waiting for Evidence  
Waiting for Human  
Validating  
Completed  
Failed  
Escalated

## **23.6 AI Prohibition**

The UI SHALL not imply that fluent AI output is authoritative merely because it is complete or confident in tone.

---

# **24\. Professional Command Model**

## **24.1 Command Semantics**

UI controls SHOULD use professional verbs.

Examples:

Identify Uncertainty  
Challenge Claim  
Add Evidence  
Propose Decision  
Approve Decision  
Authorize Action  
Record Observation  
Start Reconciliation  
Delegate Work  
Request Validation  
Escalate  
Synthesize  
Complete PWU

## **24.2 Generic Controls**

Generic controls such as `Save` MAY be used for local drafts.

They SHALL not obscure the semantic command that changes authoritative professional state.

## **24.3 Command Preconditions**

Before enabling a command, the interface SHOULD evaluate:

* role;  
* authority;  
* current state;  
* expected version;  
* required inputs;  
* mandatory Constraints;  
* validation status;  
* source staleness;  
* PWA policy.

## **24.4 Disabled Commands**

A disabled command SHALL provide a meaningful explanation.

Example:

Complete PWU is unavailable because parent recomposition has not been performed and one mandatory validation remains inconclusive.

## **24.5 Confirmation**

High-impact commands SHOULD use professional confirmation rather than generic confirmation.

The confirmation SHOULD summarize:

* intended effect;  
* affected entities;  
* unresolved uncertainty;  
* downstream impact;  
* irreversibility or reopening conditions.

---

# **25\. Drafting and Authoritative State**

The interface SHALL distinguish local drafting from authoritative professional state.

## **25.1 Draft Types**

Personal Draft  
Shared Draft  
Proposed Entity  
Proposed Revision  
Authoritative State

## **25.2 Draft Indicators**

Draft state SHALL be visible.

A draft SHALL not appear in authoritative projections unless explicitly included.

## **25.3 Promotion**

Promoting a draft may require:

* semantic validation;  
* role authority;  
* provenance;  
* conflict detection;  
* review;  
* command execution.

---

# **26\. Loading and Data State Model**

The interface SHALL distinguish technical loading from professional state.

## **26.1 Technical States**

Loading  
Refreshing  
Offline  
Partially Loaded  
Failed to Load  
Stale  
Synchronizing  
Conflict Detected

## **26.2 Professional States**

Blocked  
Awaiting Evidence  
Awaiting Decision  
Awaiting Review  
Reconciling  
Completed  
Failed

These SHALL never share ambiguous indicators.

## **26.3 Partial Data**

A partial projection SHALL disclose:

* which source classes are missing;  
* why they are missing;  
* whether interpretation may be materially affected;  
* whether commands remain available.

## **26.4 Error Presentation**

Errors SHALL distinguish:

Technical Failure  
Authorization Failure  
Validation Failure  
Concurrency Conflict  
Professional Invariant Violation  
External Dependency Failure

---

# **27\. Stale and Concurrent State**

## **27.1 Stale Projection**

When source state has changed since the projection was generated, the UI SHALL:

* identify material changes;  
* prevent unsafe mutation;  
* offer refresh or comparison;  
* preserve local draft work where possible.

## **27.2 Concurrency Conflict**

When a command conflicts with newer authoritative state, the UI SHOULD show:

* what changed;  
* who or what changed it;  
* which local assumptions are affected;  
* available reconciliation options.

## **27.3 Silent Overwrite Prohibition**

No material professional state SHALL be silently overwritten by last-write-wins behavior.

---

# **28\. History and Provenance Interaction**

## **28.1 Entity History**

Users SHOULD be able to inspect:

* versions;  
* revisions;  
* supersession;  
* state transitions;  
* provenance;  
* Decision history;  
* validation history;  
* reconciliation history.

## **28.2 Change Explanation**

A change entry SHOULD answer:

* what changed;  
* why;  
* by whom or what;  
* based on which Evidence;  
* under which authority;  
* what downstream impact occurred.

## **28.3 Historical Commands**

Historical state SHALL be read-only.

A user MAY create a proposal derived from historical state, but the proposal SHALL be evaluated against current state.

---

# **29\. Search and Retrieval**

## **29.1 Semantic Search**

Search SHOULD support professional concepts, including:

* Intent;  
* Outcome;  
* PWU;  
* Claim;  
* Evidence;  
* Decision;  
* Assumption;  
* Constraint;  
* Participant;  
* Reconciliation.

## **29.2 Query Examples**

Show decisions affected by the new encryption policy.  
Find unsupported claims in active architecture PWUs.  
Show critical assumptions invalidated this month.  
Find work blocked by external legal review.  
Show evidence contradicting the selected deployment architecture.

## **29.3 Search Result Context**

Results SHALL display:

* entity type;  
* owning context;  
* originating Intent;  
* lifecycle or validity state;  
* temporal relevance;  
* confidence where applicable.

---

# **30\. Visual Semantics**

## **30.1 Color**

Color MAY reinforce meaning but SHALL not be the sole carrier of meaning.

## **30.2 State Icons**

Icons SHOULD distinguish:

* lifecycle state;  
* validity;  
* confidence;  
* uncertainty;  
* contradiction;  
* reconciliation;  
* AI origin;  
* human approval.

## **30.3 Semantic Consistency**

The same semantic condition SHALL use consistent treatment across projections and surfaces.

## **30.4 Confidence**

Confidence visualization SHALL avoid implying false precision.

Acceptable forms include:

* clearly defined ordinal levels;  
* intervals;  
* distributions;  
* evidence-based assurance categories.

## **30.5 Contradiction**

Contradictions SHOULD be visually prominent without implying that one side is automatically wrong.

---

# **31\. Accessibility Requirements**

The Janumi interface SHALL conform to applicable accessibility standards and support professional use under high cognitive load.

## **31.1 Keyboard Navigation**

All material operations SHALL be keyboard accessible.

## **31.2 Screen Reader Semantics**

Graphs, matrices, and complex canvases SHALL provide structured textual alternatives.

## **31.3 Color Independence**

No state or professional condition SHALL be conveyed by color alone.

## **31.4 Focus Management**

Projection changes, drawers, dialogs, and command completion SHALL maintain predictable focus.

## **31.5 Cognitive Accessibility**

The interface SHOULD:

* use stable layouts;  
* avoid gratuitous animation;  
* provide plain-language state explanations;  
* support progressive disclosure;  
* preserve context during navigation;  
* avoid overloading the user with all ontology entities simultaneously.

## **31.6 Motion**

Motion MAY indicate:

* relationship traversal;  
* zoom;  
* state transition;  
* reconciliation impact.

It SHALL respect reduced-motion preferences.

---

# **32\. Responsive Web and Desktop Profile**

## **32.1 Wide Layout**

Wide surfaces SHOULD support:

Global Rail  
Primary Workspace  
Persistent Context Panel  
Optional Secondary Projection  
Command Region

## **32.2 Multi-Projection Comparison**

Desktop and web MAY show synchronized projections side by side.

Examples:

* Decision and Evidence;  
* Decomposition and Dependency;  
* Expected and Observed;  
* Prior and Proposed Reconciliation state.

## **32.3 Window Persistence**

The system MAY remember workspace composition per:

* PWA;  
* Participant role;  
* device;  
* PWU type.

It SHALL not preserve stale authority assumptions.

---

# **33\. VS Code Profile**

## **33.1 Purpose**

The VS Code profile supports product realization without reducing Janumi to a coding chat interface.

## **33.2 Canonical Regions**

Janumi Activity Bar  
PWU Explorer  
Current Objective Header  
Primary Cognitive Panel  
Code Editor  
Context Inspector  
Agent and Validation Activity

## **33.3 PWU Explorer**

The PWU Explorer SHOULD organize work by:

* objective;  
* decomposition;  
* lifecycle state;  
* cognitive state;  
* implementation relationship.

It SHALL not simply mirror the file tree.

## **33.4 Editor Context**

When a file or code region is selected, Janumi SHOULD expose:

* owning or related PWUs;  
* requirements;  
* architecture Decisions;  
* Claims;  
* Assumptions;  
* tests;  
* validations;  
* unresolved reconciliation.

## **33.5 Agent Execution**

Coding-agent execution SHOULD remain bound to:

* PWU objective;  
* scope;  
* current Decision;  
* constraints;  
* required validations;  
* completion conditions.

## **33.6 Code Change Review**

A code change review SHOULD answer:

* Which Intent does this serve?  
* Which Representation or Decision authorized it?  
* Which tests validate it?  
* Which assumptions changed?  
* Which downstream artifacts may require reconciliation?

---

# **34\. Mobile Profile**

## **34.1 Purpose**

The mobile profile supports focused professional action, field Observation, review, approval, and situational understanding.

## **34.2 Mobile Priorities**

Attention  
Review  
Approval  
Observation Capture  
Evidence Capture  
Escalation  
Concise PWU Understanding

## **34.3 Serialized Interaction**

Complex projections MAY be presented as a guided sequence.

Example decision review:

1\. Decision Question  
2\. Alternatives  
3\. Evidence  
4\. Contradictions  
5\. Constraints  
6\. Residual Uncertainty  
7\. Impact  
8\. Authorize or Defer

## **34.4 Field Observation**

Mobile SHALL support, where applicable:

* photo;  
* video;  
* audio;  
* location;  
* timestamp;  
* sensor reading;  
* notes;  
* structured classification;  
* offline capture.

Captured media are Artifacts. Their interpreted meaning SHALL be represented separately.

## **34.5 Offline Mode**

Offline state SHALL clearly identify:

* last synchronization;  
* authoritative snapshot time;  
* queued commands;  
* potential conflicts;  
* unavailable validations.

---

# **35\. Conversational Profile**

## **35.1 Purpose**

Conversation provides a natural-language operating surface over authoritative professional cognition.

## **35.2 Grounding**

Every material response SHOULD remain anchored to explicit entities.

Example:

This recommendation concerns Decision D-14 in PWU P-103 and relies on Evidence E-22 and E-31.

## **35.3 Command Conversion**

The system MAY translate natural language into proposed commands.

Before execution, it SHALL present:

* interpreted intent;  
* affected entities;  
* required authority;  
* professional effect;  
* unresolved ambiguity.

## **35.4 Conversation Persistence**

Material conclusions, Decisions, Claims, Evidence, and Assumptions SHALL not remain only in conversation history.

They SHOULD be promoted into structured entities.

---

# **36\. Component-Level Semantic Contracts**

## **36.1 Entity Link**

An entity link SHALL preserve:

* entity identity;  
* entity type;  
* owning context;  
* temporal mode;  
* authorization.

## **36.2 State Badge**

A state badge SHALL identify which state dimension it represents.

Example:

Lifecycle: Blocked  
Validity: Contested  
Confidence: Moderate

## **36.3 Confidence Indicator**

A confidence indicator SHALL expose its basis on inspection.

## **36.4 Evidence Chip**

An Evidence chip SHALL not imply support unless its relationship type is visible.

## **36.5 Participant Avatar**

A Participant indicator SHALL distinguish human, AI, team, external system, or organization.

## **36.6 AI Contribution Marker**

AI origin SHALL remain visible after review or acceptance.

Approval does not erase provenance.

## **36.7 Command Button**

A command control SHALL be associated with:

* command type;  
* authority;  
* preconditions;  
* expected professional effect.

## **36.8 Timeline Entry**

A timeline entry SHALL distinguish:

* event time;  
* record time;  
* actor;  
* semantic effect.

## **36.9 Graph Node**

A graph node SHALL expose a non-graph alternative for accessibility and detailed inspection.

## **36.10 Summary Card**

A summary card SHALL provide navigation to the underlying entities and calculation basis.

---

# **37\. UI Semantic Invariants**

## **UI-INV-001 — Intent Visibility**

Material workspaces SHALL preserve access to originating Intent.

## **UI-INV-002 — Objective Visibility**

The active professional objective SHALL be visible or immediately accessible.

## **UI-INV-003 — State Separation**

Lifecycle, cognitive, validity, technical loading, and confidence states SHALL remain distinct.

## **UI-INV-004 — AI Attribution**

AI contributions SHALL remain attributable.

## **UI-INV-005 — Evidence Provenance**

Evidence SHALL expose source and provenance.

## **UI-INV-006 — Decision Rationale**

Approved Decisions SHALL provide access to rationale.

## **UI-INV-007 — Uncertainty Visibility**

Material uncertainty SHALL not be hidden behind generic progress indicators.

## **UI-INV-008 — Contradiction Visibility**

Relevant contradictions SHALL remain visible until disposition.

## **UI-INV-009 — No Direct Mutation**

UI components SHALL issue semantic commands rather than mutate authoritative state directly.

## **UI-INV-010 — Role-Aware Commands**

Commands SHALL reflect current role and authority.

## **UI-INV-011 — Staleness Disclosure**

Stale or partial projections SHALL be disclosed.

## **UI-INV-012 — Context Preservation**

Cross-projection navigation SHALL preserve professional context.

## **UI-INV-013 — Historical Distinction**

Historical and predicted states SHALL be unmistakable.

## **UI-INV-014 — Completion Integrity**

The UI SHALL not represent a PWU as complete when professional completion conditions fail.

## **UI-INV-015 — Projection Non-Authority**

No visual component or local client state SHALL become an independent source of professional truth.

## **UI-INV-016 — Accessible Semantics**

Complex visualizations SHALL provide accessible equivalents.

## **UI-INV-017 — Professional Language**

Primary actions SHOULD use domain-meaningful professional verbs.

## **UI-INV-018 — No False Precision**

Synthetic indicators SHALL disclose basis and limitations.

## **UI-INV-019 — Recomposition Visibility**

Parent PWU completion SHALL expose recomposition state.

## **UI-INV-020 — Failure Explainability**

Unavailable actions and failed commands SHALL explain the professional reason.

---

# **38\. Minimum Viable Workspace Implementation**

The first coherent Janumi UI SHALL include:

## **38.1 Application Shell**

Global Header  
Global Navigation  
Cognitive Breadcrumb  
Workspace Header  
Primary Projection  
Context Panel  
Command Region

## **38.2 Core Workspaces**

Endeavor Overview  
PWU Overview  
Understanding  
Reasoning  
Evidence  
Decision  
Reconciliation  
Decomposition  
History  
RPH Coordination  
Attention

## **38.3 Core Interactions**

Inspect  
Trace  
Compare  
Contribute  
Challenge  
Propose  
Validate  
Authorize  
Delegate  
Reconcile  
Escalate  
Synthesize

## **38.4 Core Cross-Cutting State**

Intent  
Objective  
Lifecycle State  
Cognitive State  
Confidence  
Uncertainty  
Provenance  
Authority  
Temporal Mode  
Staleness

---

# **39\. Reference Route Model**

Routes MAY be implemented as follows:

/{org}/home  
/{org}/outcomes  
/{org}/endeavors  
/{org}/endeavors/{endeavorId}  
/{org}/pwus  
/{org}/pwus/{pwuId}  
/{org}/pwus/{pwuId}/understanding  
/{org}/pwus/{pwuId}/reasoning  
/{org}/pwus/{pwuId}/evidence  
/{org}/pwus/{pwuId}/decisions  
/{org}/pwus/{pwuId}/execution  
/{org}/pwus/{pwuId}/observations  
/{org}/pwus/{pwuId}/reconciliation  
/{org}/pwus/{pwuId}/decomposition  
/{org}/pwus/{pwuId}/history  
/{org}/decisions/{decisionId}  
/{org}/evidence/{evidenceId}  
/{org}/reconciliations/{reconciliationId}  
/{org}/coordination/{rphId}  
/{org}/attention

Routes are addressable projections.

They SHALL not imply separate semantic modules or data ownership.

---

# **40\. Reference Frontend State Model**

Frontend state SHOULD be separated into:

Authoritative Projection State  
Local Interaction State  
Local Draft State  
Navigation Context  
Temporal Context  
Authorization Context  
Technical Fetch State  
Command State

## **40.1 Authoritative Projection State**

Server-derived and version-qualified.

## **40.2 Local Interaction State**

Examples:

* selected node;  
* open panel;  
* zoom level;  
* temporary filter;  
* graph layout.

It SHALL not alter professional meaning.

## **40.3 Local Draft State**

Uncommitted proposed professional content.

## **40.4 Command State**

idle  
validating  
awaiting\_confirmation  
submitting  
accepted  
rejected  
conflicted

---

# **41\. Acceptance Scenarios**

## **Scenario A — PWU Orientation**

Given:

* a Participant opens a PWU through a direct link;

When:

* the workspace loads;

Then:

* the user sees the PWU objective;  
* active Intent;  
* lifecycle state;  
* cognitive state;  
* primary uncertainty;  
* current confidence;  
* parent context;  
* material blockers;  
* available role-appropriate commands.

---

## **Scenario B — Invalid Completion**

Given:

* a PWU has all Actions completed;  
* one mandatory Validation failed;  
* parent recomposition is incomplete;

When:

* the owner inspects completion readiness;

Then:

* the UI shows Actions as completed;  
* the PWU remains incomplete;  
* failed Validation is visible;  
* recomposition requirement is visible;  
* `Complete PWU` is unavailable;  
* the professional reason is explained.

---

## **Scenario C — Evidence Challenge**

Given:

* a Claim is supported by two Evidence items;  
* a reviewer adds contradictory Evidence;

When:

* the Evidence is accepted;

Then:

* the Claim displays a contradiction;  
* current confidence is marked for reassessment;  
* affected Decisions are identified;  
* reconciliation may be proposed;  
* prior Evidence remains visible.

---

## **Scenario D — AI Architecture Recommendation**

Given:

* an AI architecture agent proposes Alternative B;

When:

* the recommendation appears in the Decision Workspace;

Then:

* AI origin is visible;  
* Evidence and Assumptions are inspectable;  
* limitations and confidence are shown;  
* the recommendation remains `proposed`;  
* only an authorized approver sees the approval command.

---

## **Scenario E — Cross-Child Conflict**

Given:

* two child PWUs complete with incompatible interface assumptions;

When:

* the parent Decomposition Viewer is opened;

Then:

* both children show completion;  
* the interface contradiction is prominent;  
* parent synthesis readiness is false;  
* a reconciliation command is available;  
* parent completion remains unavailable.

---

## **Scenario F — Historical Investigation**

Given:

* a user selects a historical date;

When:

* the Decision Workspace renders;

Then:

* historical mode is persistently visible;  
* the Decision, Evidence, and Confidence reflect that date;  
* current commands are unavailable;  
* comparison with current state is available.

---

## **Scenario G — Mobile Approval**

Given:

* an authorized executive receives a decision-required attention item;

When:

* they open it on mobile;

Then:

* the interaction presents the Decision question;  
* Alternatives;  
* Evidence;  
* contradictions;  
* Constraints;  
* residual Uncertainty;  
* downstream impact;  
* approve, defer, or request more Evidence actions.

---

## **Scenario H — Command Conflict**

Given:

* a user prepares a Decision approval from version 8;  
* new contradictory Evidence creates version 10;

When:

* approval is submitted;

Then:

* the command is rejected as stale;  
* the UI shows the material change;  
* the user may compare versions;  
* no state is silently overwritten.

---

# **42\. Coding Agent Implementation Contract**

A coding agent implementing the Janumi UI SHALL:

1. Build a stable cognitive workspace shell before isolated feature pages.  
2. Preserve active Intent, objective, lifecycle state, and cognitive state across projections.  
3. Model each route as a projection over authoritative semantic state.  
4. Keep local UI state separate from professional state.  
5. issue semantic commands rather than generic persistence updates.  
6. Validate commands server-side.  
7. expose professional reasons for disabled or rejected actions.  
8. preserve provenance and AI attribution.  
9. disclose confidence, uncertainty, contradiction, and staleness.  
10. treat PWUs as cognitive aggregates rather than tasks.  
11. implement decomposition and recomposition as distinct concepts.  
12. preserve cross-projection navigation context.  
13. support current, historical, comparison, and stale modes explicitly.  
14. avoid relying on color alone.  
15. provide accessible alternatives for graphs and matrices.  
16. avoid making chat the primary organizing surface.  
17. ensure material conversational outputs become explicit entities.  
18. avoid duplicating semantic truth in page-specific stores.  
19. implement optimistic concurrency for material commands.  
20. instrument professional decision boundaries and state transitions.  
21. test UI semantic invariants in addition to visual behavior.  
22. reject generic “percent complete” indicators lacking professional meaning.  
23. preserve the distinction among review, validation, approval, and authorization.  
24. ensure completed child PWUs do not imply completed parent PWUs.  
25. implement mobile and VS Code surfaces as semantic adaptations, not separate products.

---

# **43\. First Implementation Sequence**

The initial implementation SHOULD proceed in this order:

## **Phase 1 — Cognitive Shell**

Implement:

* organization and PWA context;  
* cognitive breadcrumb;  
* workspace header;  
* projection selector;  
* context panel;  
* command region;  
* temporal mode;  
* role and authority state.

## **Phase 2 — PWU Overview**

Implement:

* objective;  
* Intent trace;  
* dual state;  
* confidence;  
* uncertainty;  
* blocker;  
* completion readiness;  
* recent material change.

## **Phase 3 — Understanding and Reasoning**

Implement:

* Questions;  
* Uncertainties;  
* Assumptions;  
* Claims;  
* Reasoning Activities;  
* AI attribution.

## **Phase 4 — Evidence and Decisions**

Implement:

* Evidence relationships;  
* provenance;  
* decision readiness;  
* Alternatives;  
* authority;  
* residual Uncertainty.

## **Phase 5 — Decomposition and Reconciliation**

Implement:

* child PWUs;  
* delegation;  
* recomposition;  
* contradiction;  
* reconciliation proposals;  
* impact comparison.

## **Phase 6 — RPH Coordination and Attention**

Implement:

* portfolio;  
* blockages;  
* tactic health;  
* escalation;  
* synthesis;  
* professional attention queue.

## **Phase 7 — Specialized Profiles**

Implement:

* JanumiCode VS Code profile;  
* mobile review and Observation capture;  
* conversational projection.

---

# **44\. Resulting User Experience**

A professional entering Janumi should not feel that they are navigating a database of work records.

They should feel that they have entered a living professional context.

They should immediately understand:

* what outcome is being pursued;  
* why the current work exists;  
* what the organization presently believes;  
* what remains uncertain;  
* what Evidence supports those beliefs;  
* what Decisions require attention;  
* what Actions are changing reality;  
* what reality has revealed;  
* where coherence has been lost;  
* what professional transition should occur next.

The interface therefore functions as a cognitive instrument.

Its purpose is not merely to display Janumi’s data.

Its purpose is to make professional cognition inspectable, navigable, governable, and continuously coherent.

\===

I think this is where we should make another deliberate shift.

Up until now we've been writing specifications **for humans**.

The next artifact should not be primarily human-readable.

It should be **the canonical source from which the platform itself is generated**.

This is a very different kind of specification.

Today, many platforms have:

* an OpenAPI specification;  
* a GraphQL schema;  
* a database schema;  
* a protobuf definition.

Janumi should have something more fundamental.

I would call it the **Janumi Semantic Definition Language (JSDL).**

This is not another serialization format.

It is the canonical language used to define:

* CPCO entities;  
* relationships;  
* commands;  
* events;  
* lifecycle states;  
* invariants;  
* projections;  
* validators;  
* authority rules;  
* UI metadata.

Everything else becomes a generated artifact.

That means:

JSDL  
│  
├── JSON Schema  
├── TypeScript types  
├── Kotlin models  
├── Swift models  
├── C\# models  
├── Python models  
├── PostgreSQL migrations  
├── Graph schema  
├── GraphQL schema  
├── OpenAPI  
├── Event contracts  
├── UI forms  
├── UI inspectors  
├── Validators  
├── Agent contracts  
├── Documentation  
└── Test fixtures

This is a fundamentally different philosophy from most enterprise systems.

The semantic model is no longer documentation.

It becomes the compiler input.

---

# **Janumi Semantic Definition Language (JSDL)**

## **JSDL Specification v0.1**

**Status:** Normative draft

---

# **1\. Purpose**

The Janumi Semantic Definition Language (JSDL) is the canonical machine-readable definition of professional cognition.

It is the authoritative source from which platform artifacts are generated.

JSDL SHALL define:

* ontology;  
* aggregate structure;  
* commands;  
* events;  
* lifecycle models;  
* state transitions;  
* invariants;  
* authority;  
* projections;  
* validators;  
* observability metadata;  
* UI semantics.

Implementations SHALL derive code from JSDL rather than duplicating semantic definitions across multiple technologies.

---

# **2\. Design Principles**

JSDL is:

* semantic before technical;  
* declarative rather than imperative;  
* strongly typed;  
* versioned;  
* extensible;  
* domain independent;  
* projection aware;  
* event aware;  
* validation aware.

JSDL is not:

* a persistence schema;  
* an API definition;  
* a UI description language;  
* a workflow language.

Those are generated from JSDL.

---

# **3\. Compilation Targets**

A conforming JSDL compiler SHOULD be capable of generating:

## **Domain Model**

* strongly typed entities;  
* value objects;  
* enumerations;  
* aggregate definitions.

## **Persistence**

* relational schema;  
* migration scripts;  
* graph schema;  
* indexes.

## **APIs**

* REST/OpenAPI;  
* GraphQL;  
* gRPC;  
* event contracts.

## **Frontend**

* TypeScript models;  
* validation rules;  
* form metadata;  
* inspector metadata;  
* projection metadata;  
* command contracts.

## **Agents**

* tool contracts;  
* command schemas;  
* validator contracts;  
* context schemas;  
* completion contracts.

## **Documentation**

* human-readable reference;  
* entity catalog;  
* relationship catalog;  
* lifecycle documentation;  
* command reference.

---

# **4\. Canonical Modules**

Every JSDL model is organized into modules.

Foundation  
Ontology  
Relationships  
Aggregates  
Commands  
Events  
Lifecycle  
Validators  
Projections  
Observability  
Security  
PWA Extensions

Each module is independently versioned while remaining semantically compatible with the ontology.

---

# **5\. Canonical Entity Structure**

Every entity definition SHALL declare:

identity  
type  
properties  
relationships  
invariants  
lifecycle  
commands  
events  
validators  
projectionMetadata

The entity definition SHALL be sufficient to generate platform implementations without reintroducing semantic ambiguity.

---

# **6\. Aggregate Definition**

An aggregate definition SHALL specify:

* aggregate root;  
* owned entities;  
* referenced entities;  
* command boundary;  
* consistency boundary;  
* optimistic concurrency policy;  
* event emission rules;  
* recomposition rules (where applicable).

This allows the generated implementation to preserve the transactional boundaries while remaining faithful to the semantic PWU defined in earlier specifications.

---

# **7\. Command Definition**

Each command SHALL define:

* semantic intent;  
* required authority;  
* preconditions;  
* payload schema;  
* affected aggregates;  
* emitted events;  
* failure conditions;  
* postconditions.

Commands SHALL become generated backend contracts and frontend action metadata.

---

# **8\. Event Definition**

Every event SHALL declare:

* event identity;  
* semantic meaning;  
* originating command;  
* payload;  
* affected entities;  
* versioning policy;  
* observability category.

Events become the canonical integration surface for projections, analytics, synchronization, and downstream automation.

---

# **9\. Projection Metadata**

Entities SHALL include metadata describing their participation in projections.

Examples:

* visible in Understanding projection;  
* editable in Reasoning workspace;  
* summarized in Executive view;  
* hidden from mobile by default;  
* searchable by semantic query;  
* shown in decomposition trees.

Projection metadata SHALL describe semantics, not presentation details such as pixel positions.

---

# **10\. Validator Definitions**

Validators SHALL be declared rather than handwritten wherever possible.

Validator categories include:

* structural;  
* semantic;  
* professional;  
* coherence;  
* governance;  
* temporal.

Generated validators SHOULD cover structural rules automatically, while domain-specific professional validators MAY require handwritten implementation.

---

# **11\. Observability Metadata**

Entities, commands, and events SHALL identify:

* emitted metrics;  
* trace boundaries;  
* correlation identifiers;  
* cognitive state transitions;  
* reconciliation triggers.

This allows observability to be generated consistently across the platform.

---

# **12\. PWA Extension Model**

Professional Work Architectures SHALL extend—not replace—the canonical ontology.

For example:

JanumiCode  
  extends Representation  
      with SourceCodeRepresentation

JanumiScience  
  extends Evidence  
      with ExperimentalResult

JanumiLegal  
  extends Constraint  
      with StatutoryConstraint

Extensions SHALL preserve CPCO invariants.

---

# **13\. Versioning**

Every JSDL definition SHALL be versioned.

Changes SHALL be classified as:

* additive;  
* compatible refinement;  
* deprecation;  
* breaking semantic change.

Generated artifacts SHALL retain compatibility information.

---

# **14\. Reference Toolchain**

The long-term reference toolchain is envisioned as:

JSDL Source  
        │  
        ▼  
Semantic Compiler  
        │  
        ├────────► Platform Models  
        ├────────► APIs  
        ├────────► Events  
        ├────────► UI Metadata  
        ├────────► Validators  
        ├────────► Documentation  
        ├────────► Test Fixtures  
        └────────► Agent Contracts

The semantic compiler becomes one of the foundational components of the Janumi Platform.

---

# **15\. Engineering Consequences**

Once JSDL exists, the platform no longer has multiple competing definitions of professional work.

Instead:

* the ontology defines meaning;  
* aggregates define transactional boundaries;  
* commands define professional actions;  
* events define history;  
* projections define user experience;  
* validators define correctness.

All are generated from a single semantic source.

This dramatically reduces drift between documentation, implementation, APIs, user interfaces, and AI agents.

---

# **16\. Immediate Next Work**

The next implementation effort should no longer be another conceptual document.

Instead, it should begin the reference implementation of the semantic compiler itself, starting with:

1. The JSDL grammar.  
2. The abstract syntax tree (AST).  
3. Semantic validation rules.  
4. A TypeScript code generator.  
5. A JSON Schema generator.  
6. An OpenAPI generator.  
7. A PostgreSQL schema generator.  
8. A frontend metadata generator.

At that point, Janumi transitions from being a documented architecture to a self-describing, generative platform whose semantics are executable.

## **A strategic recommendation**

I also think we've reached the point where the documentation should be reorganized into two parallel tracks:

1. **The Discipline** — the documents we've created: theory, constitution, CPCO, PWUs, RPHs, projections, interaction model. These explain *what* professional cognition is and how Janumi represents it.  
2. **The Platform Specification** — JSDL, compiler architecture, code generation pipeline, runtime services, storage model, APIs, synchronization, security, observability, and deployment. These explain *how* the platform realizes the discipline.

Keeping those tracks distinct will help future contributors understand whether they're evolving the **professional cognition model** or the **software platform** that implements it, while ensuring both remain anchored to the same semantic foundation.

\===

# **Janumi Semantic Definition Language**

## **Concrete Syntax, Module System, and Semantic Model**

**Specification:** JSDL Core v0.1  
**Status:** Normative draft  
**Depends on:** CPCO v0.1, PWU Specification v0.1, RPH Specification v0.1, Canonical Projection Model v0.1, Reference Interaction and Workspace Specification v0.1  
**Primary audiences:** Compiler engineers, platform architects, coding agents, backend engineers, frontend engineers, PWA authors, validator developers

---

# **1\. Purpose**

This specification defines the first concrete, machine-readable form of the Janumi Semantic Definition Language.

JSDL is the canonical source language for defining:

* semantic entities;  
* value objects;  
* enumerations;  
* relationships;  
* aggregates;  
* lifecycle models;  
* commands;  
* events;  
* invariants;  
* validators;  
* projections;  
* permissions;  
* observability contracts;  
* Professional Work Architecture extensions.

A JSDL compiler transforms these definitions into implementation artifacts while preserving the professional semantics established by the Janumi foundational specifications.

---

# **2\. Source Format**

JSDL v0.1 SHALL use YAML as its canonical authoring syntax.

YAML was selected because it is:

* human-readable;  
* machine-readable;  
* suitable for version control;  
* widely supported;  
* structurally expressive;  
* practical for initial compiler implementation.

JSON MAY be accepted as an equivalent interchange syntax.

The canonical semantic model SHALL not depend on YAML-specific behavior.

---

# **3\. File Extension**

Canonical JSDL files SHALL use:

.jsdl.yaml

Equivalent JSON files MAY use:

.jsdl.json

Examples:

foundation.jsdl.yaml  
cpco-core.jsdl.yaml  
pwu.jsdl.yaml  
rph.jsdl.yaml  
janumicode.jsdl.yaml

---

# **4\. Module Structure**

Every JSDL source file SHALL declare a module.

jsdl: "0.1"

module:  
  name: janumi.cpco.core  
  version: 0.1.0  
  status: draft  
  namespace: https://janumi.example/semantic/cpco/core

## **4.1 Required Module Fields**

name  
version  
namespace

## **4.2 Optional Module Fields**

status  
description  
authors  
license  
imports  
exports  
compatibility  
annotations

## **4.3 Module Naming**

Module names SHOULD use reverse hierarchical semantic naming.

Examples:

janumi.foundation  
janumi.cpco.core  
janumi.work.pwu  
janumi.coordination.rph  
janumi.projection.core  
janumi.pwa.code  
janumi.pwa.science

Module names SHALL be globally unique within a compiled model.

---

# **5\. Import Model**

Modules MAY import semantic definitions from other modules.

imports:  
  \- module: janumi.foundation  
    version: "^0.1.0"  
    alias: foundation

  \- module: janumi.cpco.core  
    version: "^0.1.0"  
    alias: cpco

## **5.1 Import Fields**

module  
version  
alias  
optional  
symbols

## **5.2 Selective Imports**

imports:  
  \- module: janumi.cpco.core  
    version: "^0.1.0"  
    symbols:  
      \- Intent  
      \- Outcome  
      \- Participant  
      \- Evidence

## **5.3 Import Invariants**

A compiler SHALL reject:

* unresolved imports;  
* incompatible versions;  
* duplicate aliases;  
* cyclic imports that require incomplete semantic definitions;  
* ambiguous unqualified names.

---

# **6\. Top-Level Document Structure**

A JSDL module MAY contain:

jsdl: "0.1"

module: {}

imports: \[\]

annotations: {}

enums: {}  
valueObjects: {}  
entities: {}  
relationships: {}  
aggregates: {}  
lifecycles: {}  
commands: {}  
events: {}  
invariants: {}  
validators: {}  
projections: {}  
permissions: {}  
observability: {}  
extensions: {}  
testCases: {}

Unknown top-level sections SHALL produce a compiler error unless declared by a supported extension mechanism.

---

# **7\. Naming Rules**

Semantic identifiers SHALL:

* begin with a letter;  
* contain letters, digits, or underscores;  
* use PascalCase for types;  
* use camelCase for properties;  
* use SCREAMING\_SNAKE\_CASE for invariant and error codes;  
* avoid implementation-specific terminology unless defining an implementation profile.

Examples:

ProfessionalWorkUnit  
ConfidenceAssessment  
professionalObjective  
originatingIntentIds  
PWU\_INV\_001  
MANDATORY\_VALIDATION\_FAILED

---

# **8\. Primitive Types**

JSDL v0.1 SHALL support the following primitive types:

String  
Text  
Boolean  
Integer  
Decimal  
Timestamp  
Date  
Duration  
Uri  
Uuid  
Json  
Bytes

## **8.1 Semantic Scalar Aliases**

Modules MAY define constrained aliases.

valueObjects:  
  EntityId:  
    kind: scalar  
    base: Uuid

  ConfidenceValue:  
    kind: scalar  
    base: Decimal  
    constraints:  
      minimum: 0  
      maximum: 1

## **8.2 Required Versus Optional**

Properties are required by default.

Optional properties SHALL declare:

required: false

## **8.3 Nullability**

Optionality and nullability SHALL remain distinct.

properties:  
  validUntil:  
    type: Timestamp  
    required: false  
    nullable: false

This means the property may be absent, but when present it may not be null.

Explicit null SHOULD be avoided for professional state.

---

# **9\. Collection Types**

JSDL supports:

List\<T\>  
Set\<T\>  
Map\<K,V\>  
Reference\<T\>  
Owned\<T\>

Examples:

properties:  
  stakeholderIds:  
    type: Set\<Reference\<Stakeholder\>\>

  evidence:  
    type: List\<Owned\<EvidenceReference\>\>

  metadata:  
    type: Map\<String, Json\>

## **9.1 Collection Constraints**

properties:  
  originatingIntentIds:  
    type: Set\<Reference\<Intent\>\>  
    constraints:  
      minItems: 1  
      unique: true

---

# **10\. Enumerations**

Enumerations define closed semantic value sets.

enums:  
  ParticipantType:  
    values:  
      \- human  
      \- ai\_agent  
      \- team  
      \- organization  
      \- external\_system  
      \- institution

## **10.1 Rich Enum Values**

enums:  
  ValidationResult:  
    values:  
      pass:  
        label: Pass  
        terminal: true

      fail:  
        label: Fail  
        terminal: true

      conditional\_pass:  
        label: Conditional Pass  
        terminal: true

      inconclusive:  
        label: Inconclusive  
        terminal: true

      not\_applicable:  
        label: Not Applicable  
        terminal: true

## **10.2 Enum Stability**

Existing enum semantics SHALL NOT be changed incompatibly without a breaking module version.

---

# **11\. Value Objects**

Value objects are immutable semantic structures without independent identity.

valueObjects:  
  ProfessionalObjective:  
    description: \>  
      A professionally meaningful result sought by a work unit.  
    properties:  
      statement:  
        type: Text

      outcomeContributionIds:  
        type: Set\<Reference\<Outcome\>\>  
        required: false

      decisionContributionIds:  
        type: Set\<Reference\<Decision\>\>  
        required: false

## **11.1 Value Object Invariants**

valueObjects:  
  ProfessionalObjective:  
    properties:  
      statement:  
        type: Text

    invariants:  
      \- code: OBJECTIVE\_NOT\_EMPTY  
        expression: length(trim(self.statement)) \> 0

---

# **12\. Entity Definitions**

An entity possesses stable identity and independent lifecycle semantics.

entities:  
  Intent:  
    description: \>  
      The desired outcome and rationale motivating professional work.

    identity:  
      property: intentId  
      type: EntityId

    properties:  
      statement:  
        type: Text

      rationale:  
        type: Text

      priority:  
        type: Priority

      status:  
        type: IntentStatus

      createdBy:  
        type: Reference\<Participant\>

      createdAt:  
        type: Timestamp

## **12.1 Entity Definition Fields**

An entity MAY declare:

description  
extends  
identity  
properties  
relationships  
lifecycle  
invariants  
validators  
commands  
events  
projectionMetadata  
annotations

## **12.2 Entity Inheritance**

entities:  
  Representation:  
    abstract: true  
    identity:  
      property: representationId  
      type: EntityId

    properties:  
      semanticPurpose:  
        type: Text

      status:  
        type: RepresentationStatus

  Requirement:  
    extends: Representation

    properties:  
      requirementType:  
        type: RequirementType

Inheritance SHALL represent valid semantic specialization.

It SHALL NOT be used merely for code reuse.

## **12.3 Entity Extension**

A PWA SHOULD use extension declarations rather than modifying canonical entities directly.

---

# **13\. Universal Entity Metadata**

Canonical entities SHOULD inherit or compose the universal entity contract.

valueObjects:  
  Provenance:  
    properties:  
      createdBy:  
        type: Reference\<Participant\>

      createdAt:  
        type: Timestamp

      sourceType:  
        type: SourceType

      sourceReferences:  
        type: Set\<Uri\>  
        required: false

      aiExecutionContext:  
        type: AiExecutionContext  
        required: false

A compiler MAY generate universal metadata fields through annotations:

entities:  
  Claim:  
    annotations:  
      janumi.provenance: required  
      janumi.versioned: true  
      janumi.temporal: true

---

# **14\. Relationships**

Relationships are first-class semantic definitions.

relationships:  
  EvidenceSupportsClaim:  
    source: Evidence  
    target: Claim  
    cardinality:  
      sourceToTarget: many  
      targetToSource: many

    properties:  
      relevance:  
        type: RelevanceAssessment

      strength:  
        type: ConfidenceValue

      rationale:  
        type: Text

    inverseName: supportedByEvidence

## **14.1 Relationship Fields**

source  
target  
cardinality  
properties  
inverseName  
temporal  
versioned  
invariants  
annotations

## **14.2 Relationship Identity**

Material relationships SHOULD have stable identity.

relationships:  
  EvidenceSupportsClaim:  
    identity:  
      property: relationshipId  
      type: EntityId

## **14.3 Relationship Invariants**

invariants:  
  \- code: EVIDENCE\_SUPPORT\_REQUIRES\_RATIONALE  
    expression: length(trim(self.rationale)) \> 0

## **14.4 Implicit Relationship Prohibition**

Semantic meaning SHALL NOT be inferred from:

* physical containment;  
* document attachment;  
* proximity in a UI;  
* sequence in a list;  
* shared storage location.

---

# **15\. Lifecycle Definitions**

Lifecycle models define explicit legal states and transitions.

lifecycles:  
  PwuLifecycle:  
    initialState: proposed

    states:  
      proposed: {}  
      framing: {}  
      ready: {}  
      active: {}  
      blocked: {}  
      awaiting\_evidence: {}  
      awaiting\_decision: {}  
      awaiting\_review: {}  
      awaiting\_external: {}  
      reconciling: {}  
      suspended: {}  
      completed:  
        terminal: true  
      cancelled:  
        terminal: true  
      superseded:  
        terminal: true  
      failed:  
        terminal: true  
      reopened: {}

    transitions:  
      StartFraming:  
        from: proposed  
        to: framing

      DeclareReady:  
        from: framing  
        to: ready  
        guard: validators.PwuReadyValidator

      Activate:  
        from:  
          \- ready  
          \- reopened  
        to: active

      Complete:  
        from:  
          \- active  
          \- awaiting\_review  
          \- reconciling  
        to: completed  
        guard: validators.PwuCompletionValidator

## **15.1 Transition Fields**

from  
to  
guard  
authority  
command  
emits  
effects  
description

## **15.2 Terminal State Reopening**

Transitions from terminal states SHALL be explicit.

Reopen:  
  from:  
    \- completed  
    \- cancelled  
    \- superseded  
    \- failed  
  to: reopened  
  authority: permissions.ReopenPwu

## **15.3 State Inference Prohibition**

Lifecycle state SHALL not be inferred from property presence, absence, or content.

---

# **16\. Aggregate Definitions**

Aggregates define semantic consistency boundaries.

aggregates:  
  ProfessionalWorkUnitAggregate:  
    root: ProfessionalWorkUnit

    owned:  
      \- CompletionCondition  
      \- PwuParticipantAssignment  
      \- PwuStateExplanation

    referenced:  
      \- Intent  
      \- Outcome  
      \- Participant  
      \- Question  
      \- Uncertainty  
      \- Representation  
      \- Claim  
      \- Evidence  
      \- Decision  
      \- Observation  
      \- Validation  
      \- Reconciliation

    concurrency:  
      strategy: optimistic  
      versionProperty: aggregateVersion

    commands:  
      \- ProposePWU  
      \- FramePWU  
      \- DeclareReady  
      \- ActivatePWU  
      \- BlockPWU  
      \- CompletePWU  
      \- ReopenPWU  
      \- DecomposePWU

## **16.1 Semantic Versus Transactional Aggregate**

A JSDL aggregate definition SHALL describe a transactional consistency boundary.

A semantic PWU MAY reference multiple transactional aggregates.

The compiler SHALL NOT assume that all semantic PWU content resides in one transaction.

## **16.2 Aggregate Invariant Scope**

Aggregate invariants SHALL be enforceable within the declared consistency boundary.

Cross-aggregate coherence rules SHALL be declared as validators or process policies.

---

# **17\. Command Definitions**

Commands express professionally meaningful requested state changes.

commands:  
  CompletePWU:  
    description: \>  
      Request professional completion of a work unit after all  
      declared completion conditions have been evaluated.

    targetAggregate: ProfessionalWorkUnitAggregate

    payload:  
      completionDisposition:  
        type: CompletionDisposition

      completionRationale:  
        type: Text

      acceptedResidualUncertaintyIds:  
        type: Set\<Reference\<Uncertainty\>\>  
        required: false

    authority:  
      permission: permissions.CompletePwu

    preconditions:  
      \- validator: validators.PwuCompletionValidator

    emits:  
      \- PWUCompleted

    failures:  
      \- code: MANDATORY\_VALIDATION\_FAILED  
      \- code: BLOCKING\_DEPENDENCY\_UNRESOLVED  
      \- code: RECOMPOSITION\_REQUIRED  
      \- code: RESIDUAL\_UNCERTAINTY\_NOT\_ACCEPTED  
      \- code: STALE\_AGGREGATE\_VERSION

## **17.1 Command Envelope**

All generated command contracts SHALL include:

commandEnvelope:  
  properties:  
    commandId:  
      type: EntityId

    expectedVersion:  
      type: Integer

    requestedBy:  
      type: Reference\<Participant\>

    requestedAt:  
      type: Timestamp

    correlationId:  
      type: EntityId

    causationId:  
      type: EntityId  
      required: false

    originatingProjection:  
      type: ProjectionContext  
      required: false

## **17.2 Command Effects**

Commands MAY declare deterministic semantic effects.

effects:  
  \- set: root.lifecycleState  
    value: completed

  \- increment: root.aggregateVersion

Complex professional logic SHOULD remain in generated or handwritten command handlers rather than an unrestricted expression language.

---

# **18\. Event Definitions**

Events represent immutable semantic facts.

events:  
  PWUCompleted:  
    description: \>  
      A Professional Work Unit satisfied an authorized completion  
      disposition.

    aggregate: ProfessionalWorkUnitAggregate

    payload:  
      pwuId:  
        type: Reference\<ProfessionalWorkUnit\>

      completionDisposition:  
        type: CompletionDisposition

      completedBy:  
        type: Reference\<Participant\>

      completedAt:  
        type: Timestamp

      residualUncertaintyIds:  
        type: Set\<Reference\<Uncertainty\>\>  
        required: false

    observability:  
      category: professional\_state\_transition  
      severity: informational

## **18.1 Event Envelope**

All generated event contracts SHALL include:

eventId  
eventType  
occurredAt  
recordedAt  
actorId  
correlationId  
causationId  
aggregateId  
aggregateVersion  
moduleVersion  
payload  
provenance

## **18.2 Event Immutability**

Events SHALL be immutable.

Correction SHALL occur through new events, reconciliation, or superseding facts.

---

# **19\. Invariant Definitions**

Invariants express conditions that SHALL always hold.

invariants:  
  PWU\_INV\_001:  
    description: A PWU shall possess exactly one active professional objective.  
    scope: ProfessionalWorkUnit  
    severity: error  
    expression: self.professionalObjective \!= null

  PWU\_INV\_002:  
    description: A non-exploratory PWU shall trace to at least one active Intent.  
    scope: ProfessionalWorkUnit  
    severity: error  
    expression: \>  
      self.exploratoryPurpose \!= true  
      implies size(self.originatingIntentIds) \>= 1

## **19.1 Invariant Severity**

error  
warning  
advisory

An error-level invariant violation SHALL prevent the relevant state transition or authoritative mutation.

## **19.2 Expression Language**

JSDL v0.1 SHALL support a constrained expression language with:

Boolean operators  
Comparison operators  
Collection size and membership  
Property access  
Null and presence checks  
Implication  
Quantifiers: all, any, none  
Simple temporal comparisons  
Named validator invocation

The expression language SHALL not permit arbitrary filesystem, network, or process access.

---

# **20\. Validator Definitions**

Validators perform structured semantic evaluation.

validators:  
  PwuReadyValidator:  
    type: composite  
    description: \>  
      Determines whether a framed PWU may enter the ready state.

    checks:  
      \- invariant: PWU\_INV\_001  
      \- invariant: PWU\_INV\_002  
      \- validator: ObjectiveSemanticValidator  
      \- validator: ScopeCompletenessValidator  
      \- validator: AuthorityAssignmentValidator  
      \- validator: CompletionConditionValidator

    result:  
      type: ValidationResult

## **20.1 Validator Kinds**

expression  
composite  
external  
human  
ai\_assisted  
policy  
cross\_aggregate

## **20.2 External Validator**

validators:  
  RegulatoryComplianceValidator:  
    type: external  
    interface:  
      requestType: RegulatoryValidationRequest  
      responseType: RegulatoryValidationResponse

    timeout: PT30S  
    failurePolicy: inconclusive

## **20.3 AI-Assisted Validator**

validators:  
  ObjectiveSemanticValidator:  
    type: ai\_assisted

    professionalPurpose: \>  
      Determine whether the stated objective describes a professionally  
      meaningful result rather than activity alone.

    inputs:  
      \- professionalObjective  
      \- originatingIntentIds  
      \- scope

    outputs:  
      result:  
        type: ValidationResult  
      rationale:  
        type: Text  
      confidence:  
        type: ConfidenceValue

    requiresHumanReviewWhen:  
      expression: self.confidence \< 0.8

AI-assisted validation SHALL remain attributable and reviewable.

---

# **21\. Permission and Authority Definitions**

Permissions define the authority required to perform semantic commands.

permissions:  
  CompletePwu:  
    description: Complete a Professional Work Unit.  
    appliesTo: CompletePWU

    allowedRoles:  
      \- owner  
      \- approver

    conditions:  
      \- expression: actor.participantId \== target.ownerId  
        or: actor.roles contains approver

    deniedWhen:  
      \- expression: target.lifecycleState \== cancelled  
      \- expression: target.lifecycleState \== superseded

## **21.1 Role Does Not Imply Universal Authority**

A role assignment SHALL be scoped.

scope:  
  type: pwu  
  reference: pwuId

## **21.2 AI Authority**

AI permissions SHALL explicitly state whether the AI may:

propose  
validate  
execute  
approve  
grant\_exception

Approval and exception authority SHOULD default to denied.

---

# **22\. Projection Definitions**

Projections define semantic views over authoritative state.

projections:  
  PwuDecisionProjection:  
    type: decision

    purpose: \>  
      Support an authorized Participant in evaluating a material  
      professional decision.

    root:  
      entity: Decision

    include:  
      entities:  
        \- Question  
        \- Alternative  
        \- Claim  
        \- Evidence  
        \- Assumption  
        \- Constraint  
        \- Risk  
        \- ConfidenceAssessment  
        \- Participant

      relationships:  
        \- ClaimJustifiesDecision  
        \- EvidenceSupportsClaim  
        \- EvidenceContradictsClaim  
        \- DecisionSelectsAlternative

    temporal:  
      modes:  
        \- current  
        \- as\_of  
        \- comparison

    disclosures:  
      \- provenance  
      \- confidence  
      \- residual\_uncertainty  
      \- contradictory\_evidence  
      \- authority  
      \- staleness

    commands:  
      owner:  
        \- ProposeDecision  
      approver:  
        \- ApproveDecision  
        \- RejectDecision  
        \- DeferDecision  
      reviewer:  
        \- AddEvidence  
        \- ChallengeClaim

## **22.1 Projection Presentation Metadata**

JSDL MAY include semantic presentation hints.

presentation:  
  preferredModes:  
    \- structured\_workspace  
    \- comparison\_matrix

  primaryFields:  
    \- decisionQuestion  
    \- status  
    \- authority  
    \- residualUncertainty

  prominence:  
    contradictions: critical  
    mandatoryConstraints: critical

Pixel dimensions, colors, and framework-specific component names SHALL not be part of the canonical semantic model.

---

# **23\. Observability Definitions**

observability:  
  metrics:  
    UnsupportedClaimCount:  
      type: gauge  
      professionalMeaning: \>  
        Number of material Claims lacking sufficient supporting Evidence.

      source:  
        projection: UnsupportedClaimsProjection

      dimensions:  
        \- organizationId  
        \- endeavorId  
        \- pwuId  
        \- pwa

  traces:  
    CompletePwuTrace:  
      beginsOn: CompletePWU  
      endsOn:  
        \- PWUCompleted  
        \- CommandRejected

      attributes:  
        \- pwuId  
        \- expectedVersion  
        \- participantId  
        \- validationResult

## **23.1 Cognitive Metrics**

Metrics SHALL include professional meaning and SHALL not be defined solely as implementation counters.

---

# **24\. Error Definitions**

errors:  
  MANDATORY\_VALIDATION\_FAILED:  
    category: professional\_invariant  
    retryable: false  
    messageTemplate: \>  
      Completion is unavailable because one or more mandatory  
      validations failed.

  STALE\_AGGREGATE\_VERSION:  
    category: concurrency  
    retryable: true  
    messageTemplate: \>  
      The work unit changed after this view was generated.  
      Refresh or reconcile the new state before retrying.

## **24.1 Error Categories**

validation  
professional\_invariant  
authorization  
concurrency  
dependency  
external\_system  
technical  
policy

Generated APIs SHALL preserve machine-readable error codes and professional explanations.

---

# **25\. Extension Model**

PWA modules MAY extend canonical definitions.

extensions:  
  SourceCodeRepresentation:  
    extendsEntity: Representation

    subtypeName: source\_code

    properties:  
      repositoryUri:  
        type: Uri

      commitHash:  
        type: String

      filePaths:  
        type: Set\<String\>

      language:  
        type: ProgrammingLanguage

    validators:  
      \- SourceReferenceValidator

## **25.1 Extension Invariants**

An extension SHALL NOT:

* weaken canonical invariants;  
* alter canonical semantic meaning;  
* redefine existing enum values incompatibly;  
* bypass provenance;  
* bypass authority;  
* replace canonical identity.

## **25.2 New Canonical Concepts**

A PWA concept that cannot be faithfully represented as an extension MAY propose a new CPCO concept.

Such a proposal SHALL explain why composition, specialization, or relationship modeling is insufficient.

---

# **26\. Deprecation**

Definitions MAY be deprecated.

entities:  
  LegacyTask:  
    deprecated:  
      since: 0.2.0  
      replacement: ProfessionalWorkUnit  
      removalTarget: 1.0.0  
      reason: \>  
        Task semantics are insufficient to represent professional cognition.

Generated artifacts SHOULD surface deprecation warnings.

---

# **27\. Versioning Rules**

JSDL modules SHALL use semantic versioning.

## **27.1 Patch Change**

May include:

* documentation corrections;  
* non-semantic annotations;  
* compatible generator hints;  
* error-message clarification.

## **27.2 Minor Change**

May include:

* new optional property;  
* new entity;  
* new relationship;  
* new command;  
* new event;  
* new projection;  
* new non-breaking enum value where consumers support unknown values.

## **27.3 Major Change**

Includes:

* changing property meaning;  
* removing required semantic definition;  
* narrowing previously valid values;  
* changing lifecycle transition meaning;  
* weakening or replacing invariants;  
* changing relationship semantics;  
* changing command professional effect.

---

# **28\. Semantic Compilation Phases**

A conforming JSDL compiler SHALL process modules through the following phases.

## **Phase 1 — Parsing**

Convert YAML or JSON source into a raw syntax tree.

## **Phase 2 — Module Resolution**

Resolve imports, versions, aliases, and namespaces.

## **Phase 3 — Symbol Resolution**

Resolve type, entity, relationship, command, event, and validator references.

## **Phase 4 — Type Validation**

Validate primitive, collection, inheritance, and property types.

## **Phase 5 — Semantic Validation**

Validate:

* entity identity;  
* aggregate boundaries;  
* lifecycle completeness;  
* command targets;  
* event causation;  
* authority references;  
* projection references;  
* validator references;  
* invariant expressions.

## **Phase 6 — Canonical Intermediate Representation**

Produce the normalized JSDL semantic graph.

## **Phase 7 — Target Generation**

Generate selected implementation artifacts.

## **Phase 8 — Generated Artifact Validation**

Validate generated schemas, models, APIs, and migration plans.

---

# **29\. Canonical Intermediate Representation**

The compiler SHALL produce a technology-neutral intermediate representation.

JSDL Source  
    ↓  
Parsed Syntax Tree  
    ↓  
Resolved Semantic Graph  
    ↓  
Canonical Intermediate Representation  
    ↓  
Target Generators

The intermediate representation SHALL contain:

modules  
symbols  
types  
entities  
relationships  
aggregates  
lifecycles  
commands  
events  
invariants  
validators  
permissions  
projections  
observability  
extensions  
sourceLocations  
versionMetadata

Every generated artifact SHOULD be traceable to its source JSDL location.

---

# **30\. Reference JSDL Module**

The following example defines a minimal PWU core.

jsdl: "0.1"

module:  
  name: janumi.work.pwu  
  version: 0.1.0  
  status: draft  
  namespace: https://janumi.example/semantic/work/pwu

imports:  
  \- module: janumi.foundation  
    version: "^0.1.0"  
    alias: foundation

  \- module: janumi.cpco.core  
    version: "^0.1.0"  
    alias: cpco

enums:  
  PwuLifecycleState:  
    values:  
      \- proposed  
      \- framing  
      \- ready  
      \- active  
      \- blocked  
      \- awaiting\_evidence  
      \- awaiting\_decision  
      \- awaiting\_review  
      \- awaiting\_external  
      \- reconciling  
      \- suspended  
      \- completed  
      \- cancelled  
      \- superseded  
      \- reopened  
      \- failed

  PwuCognitiveState:  
    values:  
      \- intent  
      \- understanding  
      \- representation  
      \- reasoning  
      \- decision  
      \- action  
      \- observation  
      \- reconciliation

  CompletionDisposition:  
    values:  
      \- completed\_successfully  
      \- completed\_with\_accepted\_residual\_uncertainty  
      \- completed\_as\_inconclusive  
      \- completed\_by\_transfer  
      \- completed\_by\_supersession

valueObjects:  
  ProfessionalObjective:  
    properties:  
      statement:  
        type: Text

      outcomeContributionIds:  
        type: Set\<Reference\<cpco.Outcome\>\>  
        required: false

    invariants:  
      \- code: OBJECTIVE\_NOT\_EMPTY  
        expression: length(trim(self.statement)) \> 0

  PwuScope:  
    properties:  
      included:  
        type: Set\<Text\>

      excluded:  
        type: Set\<Text\>  
        required: false

      boundaryConditions:  
        type: Set\<Text\>  
        required: false

  CompletionCondition:  
    properties:  
      conditionId:  
        type: foundation.EntityId

      statement:  
        type: Text

      mandatory:  
        type: Boolean

      status:  
        type: cpco.ValidationResult

entities:  
  ProfessionalWorkUnit:  
    identity:  
      property: pwuId  
      type: foundation.EntityId

    annotations:  
      janumi.provenance: required  
      janumi.versioned: true  
      janumi.temporal: true

    properties:  
      pwuType:  
        type: String

      title:  
        type: String

      professionalObjective:  
        type: ProfessionalObjective

      endeavorId:  
        type: Reference\<cpco.ProfessionalEndeavor\>

      parentPwuId:  
        type: Reference\<ProfessionalWorkUnit\>  
        required: false

      rootPwuId:  
        type: Reference\<ProfessionalWorkUnit\>

      aggregateVersion:  
        type: Integer

      lifecycleState:  
        type: PwuLifecycleState

      cognitiveState:  
        type: PwuCognitiveState

      originatingIntentIds:  
        type: Set\<Reference\<cpco.Intent\>\>

      scope:  
        type: PwuScope

      ownerId:  
        type: Reference\<cpco.Participant\>

      childPwuIds:  
        type: Set\<Reference\<ProfessionalWorkUnit\>\>  
        required: false

      completionConditions:  
        type: List\<Owned\<CompletionCondition\>\>

      residualUncertaintyIds:  
        type: Set\<Reference\<cpco.Uncertainty\>\>  
        required: false

    lifecycle: PwuLifecycle

    invariants:  
      \- PWU\_INV\_001  
      \- PWU\_INV\_002  
      \- PWU\_INV\_003  
      \- PWU\_INV\_007

lifecycles:  
  PwuLifecycle:  
    initialState: proposed

    states:  
      proposed: {}  
      framing: {}  
      ready: {}  
      active: {}  
      blocked: {}  
      awaiting\_evidence: {}  
      awaiting\_decision: {}  
      awaiting\_review: {}  
      awaiting\_external: {}  
      reconciling: {}  
      suspended: {}  
      completed:  
        terminal: true  
      cancelled:  
        terminal: true  
      superseded:  
        terminal: true  
      reopened: {}  
      failed:  
        terminal: true

    transitions:  
      StartFraming:  
        from: proposed  
        to: framing  
        command: StartPwuFraming  
        emits:  
          \- PwuFramingStarted

      DeclareReady:  
        from: framing  
        to: ready  
        command: DeclarePwuReady  
        guard: PwuReadyValidator  
        emits:  
          \- PwuDeclaredReady

      Activate:  
        from:  
          \- ready  
          \- reopened  
        to: active  
        command: ActivatePWU  
        emits:  
          \- PwuActivated

      Complete:  
        from:  
          \- active  
          \- awaiting\_review  
          \- reconciling  
        to: completed  
        command: CompletePWU  
        guard: PwuCompletionValidator  
        emits:  
          \- PwuCompleted

      Reopen:  
        from:  
          \- completed  
          \- cancelled  
          \- superseded  
          \- failed  
        to: reopened  
        command: ReopenPWU  
        authority:  
          permission: ReopenPwu  
        emits:  
          \- PwuReopened

aggregates:  
  ProfessionalWorkUnitAggregate:  
    root: ProfessionalWorkUnit

    owned:  
      \- CompletionCondition

    referenced:  
      \- cpco.Intent  
      \- cpco.Outcome  
      \- cpco.Uncertainty  
      \- cpco.Participant

    concurrency:  
      strategy: optimistic  
      versionProperty: aggregateVersion

    commands:  
      \- StartPwuFraming  
      \- DeclarePwuReady  
      \- ActivatePWU  
      \- CompletePWU  
      \- ReopenPWU

invariants:  
  PWU\_INV\_001:  
    scope: ProfessionalWorkUnit  
    severity: error  
    description: A PWU shall possess one active professional objective.  
    expression: self.professionalObjective \!= null

  PWU\_INV\_002:  
    scope: ProfessionalWorkUnit  
    severity: error  
    description: A non-exploratory PWU shall trace to an active Intent.  
    expression: size(self.originatingIntentIds) \>= 1

  PWU\_INV\_003:  
    scope: ProfessionalWorkUnit  
    severity: error  
    description: Lifecycle and cognitive state shall be explicit.  
    expression: \>  
      self.lifecycleState \!= null  
      and self.cognitiveState \!= null

  PWU\_INV\_007:  
    scope: ProfessionalWorkUnit  
    severity: error  
    description: Completion conditions shall exist before activation.  
    expression: \>  
      self.lifecycleState in \[proposed, framing\]  
      or size(self.completionConditions) \>= 1

validators:  
  PwuReadyValidator:  
    type: composite  
    checks:  
      \- invariant: PWU\_INV\_001  
      \- invariant: PWU\_INV\_002  
      \- invariant: PWU\_INV\_003  
      \- invariant: PWU\_INV\_007

  PwuCompletionValidator:  
    type: composite  
    checks:  
      \- validator: MandatoryCompletionConditionsValidator  
      \- validator: MandatoryValidationStatusValidator  
      \- validator: BlockingDependencyValidator  
      \- validator: RecompositionValidator  
      \- validator: ResidualUncertaintyAcceptanceValidator

permissions:  
  CompletePwu:  
    appliesTo: CompletePWU  
    allowedRoles:  
      \- owner  
      \- approver

  ReopenPwu:  
    appliesTo: ReopenPWU  
    allowedRoles:  
      \- owner  
      \- approver  
      \- coordinator

commands:  
  CompletePWU:  
    targetAggregate: ProfessionalWorkUnitAggregate

    payload:  
      completionDisposition:  
        type: CompletionDisposition

      completionRationale:  
        type: Text

      acceptedResidualUncertaintyIds:  
        type: Set\<Reference\<cpco.Uncertainty\>\>  
        required: false

    authority:  
      permission: CompletePwu

    preconditions:  
      \- validator: PwuCompletionValidator

    emits:  
      \- PwuCompleted

    failures:  
      \- MANDATORY\_VALIDATION\_FAILED  
      \- BLOCKING\_DEPENDENCY\_UNRESOLVED  
      \- RECOMPOSITION\_REQUIRED  
      \- RESIDUAL\_UNCERTAINTY\_NOT\_ACCEPTED  
      \- STALE\_AGGREGATE\_VERSION

events:  
  PwuCompleted:  
    aggregate: ProfessionalWorkUnitAggregate

    payload:  
      pwuId:  
        type: Reference\<ProfessionalWorkUnit\>

      completionDisposition:  
        type: CompletionDisposition

      completedBy:  
        type: Reference\<cpco.Participant\>

      completedAt:  
        type: Timestamp

      residualUncertaintyIds:  
        type: Set\<Reference\<cpco.Uncertainty\>\>  
        required: false

    observability:  
      category: professional\_state\_transition  
      severity: informational

---

# **31\. Compiler Diagnostics**

Compiler errors SHALL include:

diagnosticCode  
severity  
message  
sourceFile  
sourceLine  
sourceColumn  
semanticPath  
relatedLocations  
suggestedCorrection

Example:

JSDL-E142  
Entity ProfessionalWorkUnit references lifecycle PwuLifecycle,  
but lifecycle state property lifecycleState is missing.

## **31.1 Diagnostic Categories**

syntax  
module\_resolution  
symbol\_resolution  
type  
semantic  
lifecycle  
aggregate  
command  
event  
invariant  
projection  
permission  
versioning  
extension

---

# **32\. Source Mapping**

Generated artifacts SHOULD contain source-map metadata.

Example generated TypeScript:

/\*\*  
 \* Generated from:  
 \* janumi.work.pwu@0.1.0  
 \* entities.ProfessionalWorkUnit  
 \* source: pwu.jsdl.yaml:84  
 \*/  
export interface ProfessionalWorkUnit {  
  // ...  
}

Manual edits to generated files SHOULD be prohibited or overwritten.

---

# **33\. Initial Compiler Architecture**

The reference JSDL compiler SHOULD contain:

jsdl-cli  
jsdl-parser  
jsdl-module-resolver  
jsdl-symbol-table  
jsdl-type-checker  
jsdl-semantic-validator  
jsdl-ir  
jsdl-generator-typescript  
jsdl-generator-json-schema  
jsdl-generator-openapi  
jsdl-generator-postgresql  
jsdl-generator-docs  
jsdl-testkit

## **33.1 Reference Implementation Language**

TypeScript is recommended for the initial compiler because:

* the existing UI stack uses TypeScript-compatible tooling;  
* YAML and JSON Schema ecosystems are mature;  
* generated frontend types are a near-term priority;  
* compiler implementation can run in Node.js or Bun;  
* shared validation libraries can support frontend and backend development.

This is an implementation recommendation, not a semantic requirement.

---

# **34\. Initial Generator Outputs**

The first compiler milestone SHALL generate:

## **34.1 TypeScript**

* interfaces;  
* discriminated unions;  
* enums;  
* command payloads;  
* event payloads;  
* validator result types;  
* projection metadata types.

## **34.2 JSON Schema**

* entity payload schemas;  
* value-object schemas;  
* command schemas;  
* event schemas;  
* validation-result schemas.

## **34.3 Documentation**

* entity catalog;  
* relationship catalog;  
* lifecycle diagrams;  
* command reference;  
* invariant reference;  
* module dependency graph.

## **34.4 Test Fixtures**

* valid examples;  
* invalid examples;  
* lifecycle-transition fixtures;  
* command-failure fixtures;  
* compatibility fixtures.

PostgreSQL and OpenAPI generation SHOULD follow after the semantic model and first generators stabilize.

---

# **35\. Compiler Conformance Requirements**

A conforming JSDL compiler SHALL:

1. Parse canonical YAML JSDL.  
2. Resolve modules and version constraints.  
3. Resolve semantic symbols.  
4. Validate type references.  
5. validate entity identity.  
6. Validate lifecycle definitions.  
7. Validate command targets and event emissions.  
8. Validate aggregate ownership.  
9. Validate invariant expressions.  
10. Validate permission references.  
11. Validate projection entity and relationship paths.  
12. Produce a canonical intermediate representation.  
13. Generate deterministic output.  
14. Preserve source mappings.  
15. produce structured diagnostics.  
16. reject ambiguous semantics.  
17. support reproducible builds.  
18. expose compiler and model versions.  
19. prevent target generators from changing semantic meaning.  
20. support golden-file conformance tests.

---

# **36\. Initial Repository Layout**

janumi-semantics/  
├── jsdl/  
│   ├── foundation/  
│   │   └── foundation.jsdl.yaml  
│   ├── cpco/  
│   │   └── cpco-core.jsdl.yaml  
│   ├── work/  
│   │   └── pwu.jsdl.yaml  
│   ├── coordination/  
│   │   └── rph.jsdl.yaml  
│   ├── projection/  
│   │   └── projection-core.jsdl.yaml  
│   └── pwa/  
│       └── janumicode.jsdl.yaml  
│  
├── compiler/  
│   ├── cli/  
│   ├── parser/  
│   ├── semantic/  
│   ├── ir/  
│   ├── generators/  
│   └── testkit/  
│  
├── generated/  
│   ├── typescript/  
│   ├── json-schema/  
│   ├── openapi/  
│   ├── sql/  
│   └── docs/  
│  
├── tests/  
│   ├── valid/  
│   ├── invalid/  
│   ├── compatibility/  
│   └── golden/  
│  
└── jsdl.config.yaml

---

# **37\. Build Configuration**

jsdl:  
  compilerVersion: 0.1.0

sources:  
  \- jsdl/\*\*/\*.jsdl.yaml

outputs:  
  typescript:  
    enabled: true  
    directory: generated/typescript

  jsonSchema:  
    enabled: true  
    directory: generated/json-schema

  documentation:  
    enabled: true  
    directory: generated/docs

validation:  
  failOnWarnings: false  
  requireSourceMappings: true  
  requireDeterministicOutput: true

---

# **38\. Initial CLI**

jsdl validate  
jsdl compile  
jsdl generate typescript  
jsdl generate json-schema  
jsdl generate docs  
jsdl inspect module janumi.work.pwu  
jsdl inspect entity ProfessionalWorkUnit  
jsdl diff model-v1 model-v2  
jsdl test

## **38.1 Validate**

Parses and semantically validates all configured sources.

## **38.2 Compile**

Produces the canonical intermediate representation.

## **38.3 Generate**

Runs one or more target generators.

## **38.4 Inspect**

Presents normalized semantic information.

## **38.5 Diff**

Classifies changes as:

patch-compatible  
minor-compatible  
potentially-breaking  
breaking

## **38.6 Test**

Executes JSDL conformance and fixture tests.

---

# **39\. Security Model**

JSDL source SHALL be treated as trusted build input only after review.

The compiler SHALL:

* avoid arbitrary code execution;  
* prohibit unrestricted expression evaluation;  
* prohibit network access during deterministic compilation unless explicitly enabled;  
* validate import integrity;  
* support module checksums;  
* record dependency versions;  
* avoid embedding secrets in generated artifacts.

External validators are runtime integration contracts, not compiler-executed arbitrary code.

---

# **40\. Acceptance Criteria for JSDL Core v0.1**

JSDL Core v0.1 is acceptable when:

* the reference PWU module parses successfully;  
* invalid lifecycle transitions are rejected;  
* unresolved entity references are rejected;  
* aggregate ownership conflicts are rejected;  
* invalid command targets are rejected;  
* event payloads are type checked;  
* invariant expressions are validated;  
* generated TypeScript compiles;  
* generated JSON Schemas validate reference instances;  
* output is deterministic;  
* diagnostics include source locations;  
* a model diff identifies breaking changes;  
* golden tests pass in continuous integration.

---

# **41\. Implementation Sequence**

The reference implementation SHALL proceed in the following order.

## **Step 1 — Bootstrap Schema**

Define a JSON Schema for JSDL source documents sufficient to validate basic structure.

This bootstrap schema does not replace semantic compilation.

## **Step 2 — Parser**

Parse YAML into typed raw syntax nodes while preserving source locations.

## **Step 3 — Symbol Table**

Register module and local symbols.

## **Step 4 — Resolver**

Resolve imports, aliases, type references, and semantic paths.

## **Step 5 — Type Checker**

Validate primitive, collection, inheritance, and property types.

## **Step 6 — Semantic Validator**

Validate entities, relationships, aggregates, lifecycles, commands, events, invariants, permissions, and projections.

## **Step 7 — Intermediate Representation**

Normalize the model into a stable semantic graph.

## **Step 8 — TypeScript Generator**

Generate first-class domain and contract types.

## **Step 9 — JSON Schema Generator**

Generate runtime validation schemas.

## **Step 10 — Documentation Generator**

Generate human-readable reference documentation from the same source.

## **Step 11 — Model Diff**

Detect semantic compatibility changes.

## **Step 12 — Additional Generators**

Add OpenAPI, PostgreSQL, event registry, and frontend metadata generation after the core semantics stabilize.

---

# **42\. Coding Agent Instruction**

A coding agent implementing JSDL SHALL be instructed:

Implement JSDL as a deterministic semantic compiler, not as a YAML-to-code template engine. Preserve the distinctions among ontology, aggregate boundaries, lifecycle state, professional commands, immutable events, invariants, validators, permissions, projections, and presentation metadata. Reject ambiguous or unresolved semantics. Every generated artifact must remain traceable to canonical JSDL source and must not introduce professional meaning absent from that source.

---

# **43\. Resulting Platform Architecture**

With JSDL in place, Janumi gains a controlled semantic generation pipeline:

Foundational Doctrine  
        ↓  
CPCO and Architectural Specifications  
        ↓  
JSDL Canonical Source  
        ↓  
Semantic Compiler  
        ↓  
Canonical Intermediate Representation  
        ↓  
Generated Contracts and Models  
        ↓  
Janumi Runtime and Workbench

The resulting architecture prevents the frontend, backend, agents, APIs, events, validators, and documentation from developing incompatible definitions of professional work.

JSDL therefore serves as the executable bridge between the Janumi discipline and the Janumi Platform.

---

# **44\. Next Required Artifact**

The next required output is the **JSDL Compiler Architecture and Bootstrap Implementation Specification**.

It shall define:

* parser structures;  
* abstract and resolved syntax trees;  
* source-location handling;  
* symbol tables;  
* module resolution;  
* semantic graph construction;  
* invariant expression parsing;  
* compiler diagnostics;  
* generator interfaces;  
* deterministic compilation;  
* testing strategy;  
* initial TypeScript package boundaries;  
* concrete implementation backlog for the coding agent.

\===

# **JSDL Compiler Architecture and Bootstrap Implementation Specification**

## **Compiler Specification v0.1**

**Status:** Normative draft  
**Depends on:** JSDL Core v0.1, CPCO v0.1, PWU Specification v0.1, RPH Specification v0.1, Canonical Projection Model v0.1  
**Primary audiences:** Compiler engineers, coding agents, platform architects, TypeScript engineers, generator authors, test engineers  
**Reference implementation language:** TypeScript  
**Reference runtimes:** Node.js and Bun

---

# **1\. Purpose**

This specification defines the reference architecture and first implementation plan for the Janumi Semantic Definition Language compiler.

The JSDL compiler transforms canonical semantic source into a validated, normalized, technology-neutral model from which implementation artifacts are generated.

The compiler SHALL operate as a semantic compiler rather than a text-template processor.

It must understand and validate:

* modules;  
* imports;  
* types;  
* entities;  
* value objects;  
* relationships;  
* aggregates;  
* lifecycles;  
* commands;  
* events;  
* invariants;  
* validators;  
* permissions;  
* projections;  
* observability definitions;  
* PWA extensions;  
* semantic version compatibility.

The compiler SHALL reject ambiguous or invalid professional semantics before code generation begins.

---

# **2\. Compiler Objectives**

The reference compiler SHALL provide:

1. deterministic compilation;  
2. precise structured diagnostics;  
3. source-to-generated-artifact traceability;  
4. explicit module and version resolution;  
5. strong semantic validation;  
6. technology-neutral intermediate representation;  
7. isolated target generators;  
8. reproducible builds;  
9. compatibility analysis;  
10. testable compiler phases;  
11. safe handling of untrusted model source;  
12. extensibility without semantic fragmentation.

---

# **3\. Non-Goals**

The first compiler SHALL NOT attempt to:

* execute professional workflows;  
* run validators against live enterprise state;  
* replace the Janumi runtime;  
* generate complete production applications;  
* infer missing professional semantics;  
* support arbitrary executable code in JSDL;  
* optimize generated SQL for all deployment scales;  
* provide a general-purpose programming language;  
* implement unrestricted macros;  
* dynamically download unknown compiler plugins during compilation.

The first milestone is a trustworthy semantic compilation pipeline.

---

# **4\. End-to-End Compilation Pipeline**

JSDL YAML or JSON  
        ↓  
Source Loader  
        ↓  
Parser  
        ↓  
Raw Syntax Tree  
        ↓  
Module Resolver  
        ↓  
Symbol Collection  
        ↓  
Reference Resolution  
        ↓  
Type Checking  
        ↓  
Semantic Validation  
        ↓  
Canonical Intermediate Representation  
        ↓  
Model Compatibility Analysis  
        ↓  
Generator Planning  
        ↓  
Target Generators  
        ↓  
Generated Artifacts  
        ↓  
Generated Artifact Validation

Each phase SHALL possess a defined input contract, output contract, and diagnostic boundary.

---

# **5\. Reference Package Architecture**

The reference repository SHOULD contain the following packages.

packages/  
├── jsdl-core/  
├── jsdl-source/  
├── jsdl-parser/  
├── jsdl-ast/  
├── jsdl-module-resolver/  
├── jsdl-symbols/  
├── jsdl-type-system/  
├── jsdl-expression/  
├── jsdl-semantic/  
├── jsdl-ir/  
├── jsdl-diagnostics/  
├── jsdl-compiler/  
├── jsdl-generator-api/  
├── jsdl-generator-typescript/  
├── jsdl-generator-json-schema/  
├── jsdl-generator-docs/  
├── jsdl-model-diff/  
├── jsdl-testkit/  
├── jsdl-cli/  
└── jsdl-bootstrap-schema/

Applications MAY initially use a monorepo with workspace-based package management.

---

# **6\. Package Responsibilities**

## **6.1 `jsdl-core`**

Contains foundational compiler types shared by all packages.

Examples:

SourceId  
ModuleId  
SemanticVersion  
QualifiedName  
SymbolId  
DiagnosticCode  
CompilerPhase  
CompilationMode

This package SHALL not depend on parser, semantic, generator, or CLI packages.

---

## **6.2 `jsdl-source`**

Responsible for:

* source-file discovery;  
* file loading;  
* content hashing;  
* source identity;  
* line and column mapping;  
* source text retention;  
* supported-encoding validation;  
* normalized path handling.

It SHALL not parse JSDL semantics.

---

## **6.3 `jsdl-parser`**

Responsible for:

* parsing YAML and JSON;  
* converting parsed structures into raw JSDL syntax nodes;  
* identifying unsupported fields;  
* preserving source locations;  
* reporting syntax and structural errors.

It SHALL not resolve semantic names or imports.

---

## **6.4 `jsdl-ast`**

Defines:

* raw syntax tree nodes;  
* parsed module structures;  
* source-location metadata;  
* discriminated unions for JSDL declarations.

The raw AST preserves authoring structure and unresolved references.

---

## **6.5 `jsdl-module-resolver`**

Responsible for:

* locating imported modules;  
* evaluating semantic version ranges;  
* resolving module aliases;  
* detecting incompatible imports;  
* detecting forbidden dependency cycles;  
* constructing the module dependency graph;  
* selecting exact module versions.

It SHALL not perform entity-level type checking.

---

## **6.6 `jsdl-symbols`**

Responsible for:

* symbol declaration;  
* namespace construction;  
* qualified-name resolution;  
* alias handling;  
* duplicate-symbol detection;  
* symbol visibility;  
* import/export enforcement;  
* source-to-symbol mapping.

---

## **6.7 `jsdl-type-system`**

Responsible for:

* primitive types;  
* collection types;  
* reference types;  
* owned types;  
* scalar aliases;  
* value objects;  
* entity inheritance;  
* assignability;  
* type compatibility;  
* property constraints;  
* nullability and optionality.

---

## **6.8 `jsdl-expression`**

Responsible for the constrained invariant and guard expression language.

It includes:

* expression tokenizer;  
* expression parser;  
* expression AST;  
* type checker;  
* safe interpreter;  
* normalized expression serializer.

It SHALL prohibit arbitrary code execution.

---

## **6.9 `jsdl-semantic`**

Responsible for cross-definition professional semantic validation.

Examples:

* entities require identity;  
* commands target valid aggregates;  
* lifecycle transitions reference valid commands;  
* emitted events exist;  
* aggregate ownership does not conflict;  
* permissions apply to valid commands;  
* projections traverse valid relationships;  
* extensions preserve canonical invariants.

---

## **6.10 `jsdl-ir`**

Defines the canonical intermediate representation.

The IR SHALL:

* contain fully resolved semantic references;  
* use stable symbol identifiers;  
* normalize shorthand syntax;  
* remove authoring ambiguity;  
* preserve source mappings;  
* remain independent of generation targets.

---

## **6.11 `jsdl-diagnostics`**

Defines:

* diagnostic structures;  
* severity;  
* diagnostic codes;  
* related locations;  
* suggested corrections;  
* formatting for terminal, JSON, and IDE use.

---

## **6.12 `jsdl-compiler`**

Coordinates compiler phases.

It SHALL not contain target-specific generation logic.

---

## **6.13 `jsdl-generator-api`**

Defines the interface all generators must implement.

---

## **6.14 Generator Packages**

Each generator package SHALL consume the canonical IR only.

Generators SHALL NOT parse source files directly.

Initial generators:

jsdl-generator-typescript  
jsdl-generator-json-schema  
jsdl-generator-docs

Later generators:

jsdl-generator-openapi  
jsdl-generator-postgresql  
jsdl-generator-event-registry  
jsdl-generator-frontend-metadata

---

## **6.15 `jsdl-model-diff`**

Responsible for:

* comparing two canonical models;  
* classifying semantic changes;  
* identifying affected generated contracts;  
* detecting breaking changes;  
* producing human- and machine-readable compatibility reports.

---

## **6.16 `jsdl-testkit`**

Provides:

* in-memory source fixtures;  
* compiler harnesses;  
* diagnostic assertions;  
* IR snapshots;  
* generator golden tests;  
* invalid-model fixtures;  
* compatibility-test utilities.

---

## **6.17 `jsdl-cli`**

Provides the command-line interface.

It depends on the compiler and generators but SHALL contain no semantic compiler rules.

---

## **6.18 `jsdl-bootstrap-schema`**

Contains the bootstrap JSON Schema for validating top-level JSDL source shape.

The bootstrap schema provides early structural feedback.

It SHALL not be treated as a substitute for semantic compilation.

---

# **7\. Layer Dependency Rules**

Allowed dependency direction:

CLI  
 ↓  
Compiler  
 ↓  
Parser / Resolver / Symbols / Type System / Semantic / IR  
 ↓  
Core / Source / AST / Diagnostics

Generator dependency direction:

Generator  
 ↓  
Generator API  
 ↓  
IR  
 ↓  
Core

Prohibited examples:

* `jsdl-core` depending on `jsdl-compiler`;  
* a generator depending on `jsdl-parser`;  
* the parser depending on a generator;  
* the IR importing CLI types;  
* semantic validation importing presentation templates.

A dependency-cycle test SHALL enforce these boundaries.

---

# **8\. Source Model**

Every source file SHALL be represented by:

export interface SourceFile {  
  readonly sourceId: SourceId;  
  readonly absolutePath: string;  
  readonly logicalPath: string;  
  readonly format: "yaml" | "json";  
  readonly content: string;  
  readonly contentHash: string;  
  readonly lineMap: LineMap;  
}

## **8.1 Source Identity**

Source identity SHALL not rely solely on an operating-system-specific path.

Logical source paths SHALL use normalized forward-slash separators.

## **8.2 Content Hashing**

Content hashes SHOULD use SHA-256.

Hashes support:

* incremental compilation;  
* reproducibility;  
* cache validation;  
* generated artifact traceability.

---

# **9\. Source Location Model**

Every parsed declaration and relevant property SHALL retain source location.

export interface SourceRange {  
  readonly sourceId: SourceId;  
  readonly start: SourcePosition;  
  readonly end: SourcePosition;  
}

export interface SourcePosition {  
  readonly offset: number;  
  readonly line: number;  
  readonly column: number;  
}

Line and column values SHOULD be one-based in user-facing diagnostics.

Offsets MAY remain zero-based internally.

## **9.1 Related Locations**

Diagnostics MAY reference multiple locations.

Example:

* original symbol declaration;  
* conflicting declaration;  
* invalid reference;  
* imported module constraint.

---

# **10\. Raw Syntax Tree**

The raw syntax tree represents parsed but unresolved JSDL.

## **10.1 Root Structure**

export interface RawJsdlDocument {  
  readonly jsdlVersion: string;  
  readonly module: RawModuleDeclaration;  
  readonly imports: readonly RawImportDeclaration\[\];  
  readonly enums: ReadonlyMap\<string, RawEnumDeclaration\>;  
  readonly valueObjects: ReadonlyMap\<string, RawValueObjectDeclaration\>;  
  readonly entities: ReadonlyMap\<string, RawEntityDeclaration\>;  
  readonly relationships: ReadonlyMap\<string, RawRelationshipDeclaration\>;  
  readonly aggregates: ReadonlyMap\<string, RawAggregateDeclaration\>;  
  readonly lifecycles: ReadonlyMap\<string, RawLifecycleDeclaration\>;  
  readonly commands: ReadonlyMap\<string, RawCommandDeclaration\>;  
  readonly events: ReadonlyMap\<string, RawEventDeclaration\>;  
  readonly invariants: ReadonlyMap\<string, RawInvariantDeclaration\>;  
  readonly validators: ReadonlyMap\<string, RawValidatorDeclaration\>;  
  readonly projections: ReadonlyMap\<string, RawProjectionDeclaration\>;  
  readonly permissions: ReadonlyMap\<string, RawPermissionDeclaration\>;  
  readonly observability: RawObservabilityDeclaration | undefined;  
  readonly extensions: ReadonlyMap\<string, RawExtensionDeclaration\>;  
  readonly sourceRange: SourceRange;  
}

## **10.2 Raw References**

Raw references retain source spelling.

export interface RawTypeReference {  
  readonly text: string;  
  readonly sourceRange: SourceRange;  
}

Example values:

String  
Set\<Reference\<cpco.Intent\>\>  
ProfessionalObjective

---

# **11\. Parsed Type Reference Model**

The type parser SHALL convert type strings into explicit nodes.

export type ParsedTypeReference \=  
  | PrimitiveTypeReference  
  | NamedTypeReference  
  | CollectionTypeReference  
  | ReferenceTypeReference  
  | OwnedTypeReference;

Example:

Set\<Reference\<cpco.Intent\>\>

becomes:

CollectionTypeReference(Set)  
  └── ReferenceTypeReference  
        └── NamedTypeReference(cpco.Intent)

This structure SHALL be created before semantic name resolution.

---

# **12\. Module Resolution**

## **12.1 Resolution Inputs**

The resolver receives:

* root source modules;  
* configured module search paths;  
* local workspace modules;  
* optional package registry metadata;  
* lockfile;  
* allowed version policies.

## **12.2 Deterministic Resolution**

Given identical:

* source content;  
* compiler version;  
* configuration;  
* lockfile;  
* module registry state;

resolution SHALL select identical module versions.

## **12.3 Lockfile**

The compiler SHOULD support:

jsdl.lock.yaml

Example:

lockfileVersion: 1

modules:  
  janumi.foundation:  
    version: 0.1.3  
    source: workspace  
    integrity: sha256-...

  janumi.cpco.core:  
    version: 0.1.1  
    source: workspace  
    integrity: sha256-...

## **12.4 Resolution Algorithm**

For each imported module:

1. parse version range;  
2. locate candidate versions;  
3. remove incompatible candidates;  
4. apply lockfile selection where valid;  
5. select highest permitted stable version unless policy specifies otherwise;  
6. validate integrity;  
7. register alias;  
8. recursively resolve imports;  
9. detect invalid cycles;  
10. record exact resolved version.

## **12.5 Cycle Rules**

Cycles MAY be permitted only where modules exchange declarations that can be resolved without incomplete semantic initialization.

JSDL Core v0.1 SHOULD reject all module import cycles initially.

A future version may introduce explicit interface modules or cycle-safe declaration phases.

---

# **13\. Symbol Model**

Every declaration SHALL receive a stable compiler symbol identifier.

export interface Symbol {  
  readonly symbolId: SymbolId;  
  readonly kind: SymbolKind;  
  readonly localName: string;  
  readonly qualifiedName: QualifiedName;  
  readonly moduleId: ModuleId;  
  readonly sourceRange: SourceRange;  
  readonly visibility: "public" | "module";  
}

## **13.1 Symbol Kinds**

enum  
enum\_value  
scalar  
value\_object  
entity  
relationship  
aggregate  
lifecycle  
command  
event  
invariant  
validator  
projection  
permission  
metric  
trace  
extension  
property  
transition

## **13.2 Qualified Names**

Examples:

janumi.cpco.core.Intent  
janumi.work.pwu.ProfessionalWorkUnit  
janumi.work.pwu.PwuLifecycle.Complete

## **13.3 Stable Symbol IDs**

A symbol ID SHOULD be derived deterministically from:

module namespace  
\+  
module major version  
\+  
qualified semantic path  
\+  
symbol kind

The exact algorithm SHALL be documented and versioned.

Symbol IDs SHALL not depend on file ordering.

---

# **14\. Symbol Collection**

Symbol collection occurs before reference resolution.

For every module, the compiler SHALL register top-level declaration names.

It SHALL detect:

* duplicate local names;  
* duplicate qualified names;  
* collisions among imported aliases;  
* invalid reserved names;  
* incompatible declaration replacement.

Property and nested symbols are registered after parent declarations exist.

---

# **15\. Reference Resolution**

Reference resolution converts raw or parsed names into stable symbol references.

## **15.1 Resolution Order**

For an unqualified name:

1. local declaration;  
2. explicitly imported symbol;  
3. prelude or foundation symbol;  
4. error.

For an alias-qualified name:

cpco.Intent

the compiler SHALL resolve:

1. alias `cpco`;  
2. imported module;  
3. exported `Intent` symbol.

## **15.2 Ambiguity**

If multiple imported unqualified symbols match, compilation SHALL fail.

The compiler SHALL not choose based on import order.

## **15.3 Unknown Symbol Diagnostic**

Example:

JSDL-E210 UNKNOWN\_SYMBOL

Unable to resolve type 'ConfidnceAssessment'.  
Did you mean 'ConfidenceAssessment'?

Suggestions MAY use edit distance and available symbol context.

---

# **16\. Type System**

## **16.1 Type Categories**

primitive  
scalar\_alias  
enum  
value\_object  
entity  
collection  
reference  
owned  
map  
union

Union types MAY be deferred to JSDL v0.2 unless required by generated event or command contracts.

## **16.2 Entity Versus Value Object**

Entities possess stable identity.

Value objects do not.

A direct owned property MAY embed a value object.

Entity references SHOULD use `Reference<Entity>` unless the aggregate explicitly owns the entity.

## **16.3 `Owned<T>`**

`Owned<T>` indicates:

* lifecycle governed by the containing aggregate;  
* no independent aggregate identity requirement;  
* deletion or replacement controlled by the owner;  
* generated persistence may use embedded or child-table strategies.

## **16.4 `Reference<T>`**

`Reference<T>` indicates:

* externally governed identity;  
* no direct mutation through the containing aggregate;  
* generated contracts carry identifiers rather than embedded authoritative state unless a projection expands them.

## **16.5 Assignability Rules**

Examples:

* `String` is assignable to scalar aliases based on `String` only after alias constraints validate;  
* an entity subtype reference is assignable to a base entity reference;  
* a base entity reference is not assignable to a subtype reference without narrowing;  
* `List<T>` is not assignable to `Set<T>`;  
* optional does not imply nullable;  
* nullable does not imply optional.

---

# **17\. Inheritance Validation**

Entity inheritance SHALL be single inheritance in JSDL v0.1.

The compiler SHALL reject:

* inheritance cycles;  
* identity-type changes;  
* property redefinition with incompatible type;  
* weakened required constraints;  
* canonical invariant removal;  
* subtype declarations contradicting base semantics.

Composition SHOULD be preferred when semantic specialization is not valid.

---

# **18\. Aggregate Validation**

The compiler SHALL verify:

1. root is an entity;  
2. owned types are valid;  
3. referenced types exist;  
4. no entity is owned by multiple aggregates unless explicitly supported;  
5. commands target the aggregate;  
6. version property exists for optimistic concurrency;  
7. version property is integral;  
8. aggregate invariants reference available state;  
9. lifecycle is reachable from the root;  
10. event declarations reference valid aggregate entities.

## **18.1 Semantic Versus Transactional Boundary**

The compiler SHALL permit a semantic PWU to reference entities outside the transactional PWU aggregate.

It SHALL not infer ownership merely because an entity appears in PWU projections.

---

# **19\. Lifecycle Semantic Validation**

The lifecycle validator SHALL check:

* initial state exists;  
* all transition source and target states exist;  
* terminal states do not have outgoing transitions unless explicitly permitted;  
* every command-bound transition references a valid command;  
* every emitted event exists;  
* transition names are unique;  
* unreachable states are reported;  
* states with no outgoing transitions are either terminal or warned;  
* duplicate transitions with indistinguishable guards are rejected;  
* lifecycle property type matches the state enum or generated lifecycle state type.

## **19.1 Reachability**

The compiler SHALL construct the lifecycle graph and identify:

* unreachable states;  
* dead ends;  
* terminal states;  
* strongly connected components;  
* potentially unintended transition cycles.

Cycles are valid when professional work supports reopening or iteration.

They SHOULD be disclosed in generated lifecycle documentation.

---

# **20\. Command Semantic Validation**

For each command, the compiler SHALL verify:

* target aggregate exists;  
* payload types resolve;  
* authority permission exists;  
* precondition validators exist;  
* emitted events exist;  
* failure codes are declared;  
* deterministic effects reference valid fields;  
* originating projection context type is available;  
* expected concurrency behavior is defined.

A command bound to a lifecycle transition SHALL be compatible with that transition.

---

# **21\. Event Semantic Validation**

For each event, the compiler SHALL verify:

* aggregate exists;  
* payload types resolve;  
* event name is globally qualified;  
* event envelope fields are not redefined incompatibly;  
* referenced entities are valid;  
* observability category exists;  
* event versioning policy is defined or inherited.

The compiler SHOULD detect events declared but never emitted.

This MAY be a warning rather than an error.

---

# **22\. Permission Validation**

The permission validator SHALL check:

* target command exists;  
* allowed roles exist;  
* conditions type-check to Boolean;  
* denied conditions type-check to Boolean;  
* scope references valid semantic properties;  
* AI authority settings are explicit where AI roles are permitted;  
* approval and exception permissions are not accidentally granted through broad wildcard roles.

High-risk permissions SHOULD generate warnings when defined without restrictive conditions.

---

# **23\. Projection Validation**

For each projection, the compiler SHALL verify:

* root entity exists;  
* included entities exist;  
* relationship traversal paths are valid;  
* commands are valid;  
* roles and permissions exist;  
* requested temporal modes are supported by relevant entities;  
* required disclosures reference supported semantic concepts;  
* ordering and aggregation fields resolve;  
* presentation hints do not contain prohibited technical layout semantics.

## **23.1 Relationship Path Validation**

A path such as:

Decision  
→ ClaimJustifiesDecision  
→ Claim  
→ EvidenceSupportsClaim  
→ Evidence

SHALL be type checked at every edge.

---

# **24\. Extension Validation**

The compiler SHALL verify that a PWA extension:

* extends a valid canonical declaration;  
* uses a unique subtype name;  
* does not weaken inherited invariants;  
* does not replace canonical identity;  
* does not alter canonical lifecycle meaning incompatibly;  
* does not introduce conflicting relationship semantics;  
* declares required validators for specialized professional semantics.

---

# **25\. Expression Language**

## **25.1 Supported Syntax**

JSDL v0.1 expressions SHOULD support:

and  
or  
not  
\==  
\!=  
\<  
\<=  
\>  
\>=  
in  
contains  
implies  
property access  
list and set literals  
function invocation from approved standard library  
all  
any  
none

Example:

self.exploratoryPurpose \== true  
or size(self.originatingIntentIds) \>= 1

## **25.2 Standard Functions**

Initial safe functions:

size(collection)  
length(string)  
trim(string)  
lower(string)  
upper(string)  
present(value)  
absent(value)  
all(collection, predicate)  
any(collection, predicate)  
none(collection, predicate)  
startsWith(string, prefix)  
endsWith(string, suffix)

## **25.3 Prohibited Capabilities**

Expressions SHALL NOT:

* access files;  
* access network resources;  
* spawn processes;  
* inspect environment variables;  
* mutate state;  
* call arbitrary JavaScript;  
* use nondeterministic time unless time is supplied explicitly as evaluation context;  
* use randomness.

## **25.4 Expression Evaluation Context**

export interface ExpressionEvaluationContext {  
  readonly self: unknown;  
  readonly actor?: unknown;  
  readonly command?: unknown;  
  readonly now?: string;  
  readonly namedValues: ReadonlyMap\<string, unknown\>;  
}

`now` SHALL be supplied by the runtime rather than read implicitly.

---

# **26\. Canonical Intermediate Representation**

The canonical IR is the normalized semantic source of truth used by generators.

## **26.1 IR Root**

export interface JsdlModelIr {  
  readonly compilerModelVersion: string;  
  readonly modules: readonly ModuleIr\[\];  
  readonly symbols: ReadonlyMap\<SymbolId, SymbolIr\>;  
  readonly entities: readonly EntityIr\[\];  
  readonly valueObjects: readonly ValueObjectIr\[\];  
  readonly enums: readonly EnumIr\[\];  
  readonly relationships: readonly RelationshipIr\[\];  
  readonly aggregates: readonly AggregateIr\[\];  
  readonly lifecycles: readonly LifecycleIr\[\];  
  readonly commands: readonly CommandIr\[\];  
  readonly events: readonly EventIr\[\];  
  readonly invariants: readonly InvariantIr\[\];  
  readonly validators: readonly ValidatorIr\[\];  
  readonly permissions: readonly PermissionIr\[\];  
  readonly projections: readonly ProjectionIr\[\];  
  readonly observability: ObservabilityIr;  
  readonly extensions: readonly ExtensionIr\[\];  
  readonly sourceMap: ModelSourceMap;  
  readonly fingerprint: string;  
}

## **26.2 IR Requirements**

The IR SHALL:

* contain no unresolved semantic names;  
* represent all types structurally;  
* normalize default values;  
* use exact resolved module versions;  
* assign deterministic symbol IDs;  
* include inherited properties and invariants with origin metadata;  
* preserve declaration ordering only where semantically relevant;  
* include stable canonical sorting keys;  
* contain a model fingerprint.

---

# **27\. Model Fingerprint**

The compiler SHALL generate a deterministic fingerprint over canonical IR.

The fingerprint SHALL ignore:

* source-file order;  
* YAML key order;  
* comments;  
* non-semantic formatting.

It SHALL include:

* module versions;  
* semantic declarations;  
* types;  
* relationships;  
* invariants;  
* lifecycle transitions;  
* commands;  
* events;  
* permissions;  
* projections.

The fingerprint supports:

* reproducible builds;  
* cache identity;  
* deployment verification;  
* compatibility checks.

---

# **28\. Deterministic Compilation**

Compilation output SHALL be deterministic.

Given the same:

* normalized source;  
* exact dependency versions;  
* compiler version;  
* configuration;  
* generator version;

the compiler SHALL produce byte-identical canonical IR and generated output, except where a target format explicitly embeds an approved build timestamp.

Build timestamps SHOULD be excluded by default.

## **28.1 Sorting**

Canonical output SHALL sort declarations by stable semantic key rather than source discovery order.

## **28.2 Newlines and Encoding**

Generated text SHALL use:

* UTF-8;  
* normalized line endings configured consistently;  
* stable indentation;  
* stable key ordering.

---

# **29\. Incremental Compilation**

Incremental compilation MAY be introduced after the non-incremental compiler is correct.

The design SHOULD support:

* source content hashes;  
* module dependency graph;  
* symbol dependency graph;  
* generator dependency tracking;  
* invalidation by changed declaration.

Correctness SHALL take priority over incremental performance.

---

# **30\. Diagnostic Model**

export interface Diagnostic {  
  readonly code: DiagnosticCode;  
  readonly severity: DiagnosticSeverity;  
  readonly category: DiagnosticCategory;  
  readonly message: string;  
  readonly primaryRange: SourceRange;  
  readonly related: readonly RelatedDiagnosticLocation\[\];  
  readonly semanticPath?: string;  
  readonly suggestion?: DiagnosticSuggestion;  
  readonly phase: CompilerPhase;  
}

## **30.1 Severity**

error  
warning  
information  
hint

## **30.2 Categories**

syntax  
structure  
module\_resolution  
symbol\_resolution  
type  
inheritance  
aggregate  
lifecycle  
command  
event  
invariant  
validator  
permission  
projection  
extension  
versioning  
generator  
configuration  
security

## **30.3 Diagnostic Code Families**

JSDL-E1xx Syntax and structure  
JSDL-E2xx Module and symbol resolution  
JSDL-E3xx Type system  
JSDL-E4xx Aggregate and lifecycle  
JSDL-E5xx Commands, events, and permissions  
JSDL-E6xx Invariants and validators  
JSDL-E7xx Projections and extensions  
JSDL-E8xx Versioning and compatibility  
JSDL-E9xx Generation and configuration

Warnings use `JSDL-W...`.

---

# **31\. Diagnostic Quality Requirements**

Diagnostics SHOULD answer:

* what is wrong;  
* where it is wrong;  
* why it is invalid;  
* what related declaration is involved;  
* how the author may correct it.

Example:

JSDL-E421 INVALID\_TERMINAL\_TRANSITION

Lifecycle 'PwuLifecycle' declares state 'completed' as terminal,  
but transition 'ResumeWork' leaves 'completed'.

Either remove terminal: true from 'completed' or use an explicit  
reopening transition through a non-terminal 'reopened' state.

Primary: pwu.jsdl.yaml:143:7  
Related: pwu.jsdl.yaml:121:9

---

# **32\. Error Recovery**

The parser and semantic compiler SHOULD recover from independent errors where practical.

A single unknown type SHOULD not prevent detection of unrelated duplicate symbols.

However, diagnostics caused solely by a prior unresolved declaration SHOULD be suppressed or marked as dependent to avoid cascades.

---

# **33\. Compiler Result**

export interface CompilationResult {  
  readonly success: boolean;  
  readonly diagnostics: readonly Diagnostic\[\];  
  readonly model?: JsdlModelIr;  
  readonly statistics: CompilationStatistics;  
}

## **33.1 Statistics**

sourceCount  
moduleCount  
symbolCount  
entityCount  
commandCount  
eventCount  
projectionCount  
warningCount  
errorCount  
elapsedByPhase

Statistics SHALL not affect deterministic semantic output.

---

# **34\. Generator Interface**

Every generator SHALL implement:

export interface JsdlGenerator {  
  readonly id: string;  
  readonly version: string;

  plan(  
    model: JsdlModelIr,  
    options: GeneratorOptions  
  ): Promise\<GenerationPlan\>;

  generate(  
    model: JsdlModelIr,  
    plan: GenerationPlan,  
    context: GeneratorContext  
  ): Promise\<GenerationResult\>;  
}

## **34.1 Generation Plan**

The plan identifies intended files before writing.

export interface GenerationPlan {  
  readonly outputs: readonly PlannedOutput\[\];  
  readonly diagnostics: readonly Diagnostic\[\];  
}

This allows detection of:

* path collisions;  
* unsupported target features;  
* accidental overwrites;  
* invalid generator options.

## **34.2 Generator Isolation**

Generators SHALL not:

* mutate the IR;  
* resolve semantic names independently;  
* silently weaken constraints;  
* introduce new professional entities;  
* alter lifecycle semantics;  
* infer authority not present in the model.

---

# **35\. Generated File Contract**

Every generated file SHOULD contain metadata where the target format allows.

Generated by: jsdl-generator-typescript@0.1.0  
Compiler: jsdl-compiler@0.1.0  
Model fingerprint: sha256-...  
Source modules:  
\- janumi.cpco.core@0.1.0  
\- janumi.work.pwu@0.1.0  
Do not edit manually.

A sidecar manifest SHALL be generated for formats that cannot include comments.

---

# **36\. Output Manifest**

{  
  "compilerVersion": "0.1.0",  
  "modelFingerprint": "sha256-...",  
  "generatedAt": null,  
  "generators": \[  
    {  
      "id": "typescript",  
      "version": "0.1.0",  
      "files": \[  
        {  
          "path": "entities/ProfessionalWorkUnit.ts",  
          "contentHash": "sha256-...",  
          "sourceSymbols": \[  
            "symbol:janumi.work.pwu.ProfessionalWorkUnit"  
          \]  
        }  
      \]  
    }  
  \]  
}

`generatedAt` SHOULD be null or omitted in reproducible mode.

---

# **37\. TypeScript Generator Architecture**

The initial TypeScript generator SHALL generate:

primitives/  
enums/  
value-objects/  
entities/  
relationships/  
commands/  
events/  
validators/  
permissions/  
projections/  
model-index.ts

## **37.1 Generated Type Style**

The generator SHOULD use:

* readonly properties;  
* discriminated unions where applicable;  
* string literal unions or enums based on configuration;  
* branded scalar types for semantic identifiers;  
* explicit optional properties;  
* no implicit `any`;  
* no generated runtime behavior unless requested.

## **37.2 Entity Identifier Example**

export type EntityId \= string & {  
  readonly \_\_brand: "EntityId";  
};

## **37.3 Reference Example**

export interface EntityReference\<TType extends string\> {  
  readonly id: EntityId;  
  readonly type: TType;  
  readonly version?: number;  
}

---

# **38\. JSON Schema Generator Architecture**

The JSON Schema generator SHALL target a declared draft, preferably JSON Schema 2020-12.

It SHALL generate schemas for:

* entities;  
* value objects;  
* commands;  
* events;  
* projection query payloads;  
* validator results.

## **38.1 Schema IDs**

Schema IDs SHALL derive from module namespace and semantic version.

Example:

https://janumi.example/semantic/work/pwu/0.1.0/ProfessionalWorkUnit.schema.json

## **38.2 Reference Handling**

Cross-module references SHALL use stable `$id` and `$ref` values.

## **38.3 Semantic Limitations**

Constraints not expressible in JSON Schema SHALL be documented in generated metadata and enforced through semantic validators.

Example:

* cross-aggregate authority;  
* evidence sufficiency;  
* parent recomposition completeness.

---

# **39\. Documentation Generator**

The documentation generator SHALL produce:

* module summary;  
* imports and dependencies;  
* entity catalog;  
* property tables;  
* inheritance diagrams;  
* relationship catalog;  
* aggregate boundaries;  
* lifecycle diagrams;  
* command reference;  
* event reference;  
* invariant catalog;  
* validator catalog;  
* permission matrix;  
* projection catalog;  
* source links.

Generated documentation SHALL clearly distinguish:

* canonical semantics;  
* generated implementation notes;  
* unresolved external validator contracts.

---

# **40\. Bootstrap JSON Schema**

The bootstrap schema SHALL validate:

* supported top-level keys;  
* module declaration structure;  
* imports structure;  
* declaration map shapes;  
* basic primitive field types;  
* required `jsdl` and `module` properties.

It SHALL not attempt to validate:

* referenced symbol existence;  
* lifecycle graph correctness;  
* aggregate ownership;  
* command-event compatibility;  
* invariant type correctness;  
* semantic extension safety.

Those remain compiler responsibilities.

---

# **41\. CLI Architecture**

## **41.1 Commands**

jsdl validate  
jsdl compile  
jsdl generate  
jsdl inspect  
jsdl diff  
jsdl test  
jsdl format

## **41.2 `validate`**

Runs through semantic validation without generation.

Exit codes:

0 success  
1 compilation errors  
2 configuration error  
3 internal compiler failure

## **41.3 `compile`**

Produces canonical IR.

Options:

\--output  
\--format json  
\--reproducible  
\--diagnostics json|pretty

## **41.4 `generate`**

jsdl generate typescript  
jsdl generate json-schema  
jsdl generate docs  
jsdl generate all

## **41.5 `inspect`**

Examples:

jsdl inspect entity ProfessionalWorkUnit  
jsdl inspect lifecycle PwuLifecycle  
jsdl inspect command CompletePWU  
jsdl inspect projection PwuDecisionProjection

## **41.6 `diff`**

jsdl diff baseline.ir.json candidate.ir.json

Outputs:

* change list;  
* compatibility classification;  
* affected consumers;  
* migration recommendations.

## **41.7 `format`**

Formatting SHALL preserve semantic meaning and produce stable YAML structure.

Formatter implementation MAY be deferred until after the parser and IR are stable.

---

# **42\. Configuration Model**

jsdl:  
  compilerVersion: 0.1.0

sources:  
  include:  
    \- jsdl/\*\*/\*.jsdl.yaml  
  exclude:  
    \- jsdl/\*\*/experimental/\*\*

moduleResolution:  
  workspaceRoots:  
    \- jsdl  
  lockfile: jsdl.lock.yaml  
  rejectCycles: true

validation:  
  failOnWarnings: false  
  unknownFields: error  
  unusedSymbols: warning

generation:  
  reproducible: true  
  cleanOutput: true

outputs:  
  ir:  
    directory: generated/ir  
  typescript:  
    directory: generated/typescript  
  jsonSchema:  
    directory: generated/json-schema  
  docs:  
    directory: generated/docs

---

# **43\. Compiler API**

The compiler SHALL also provide a programmatic API.

export interface JsdlCompiler {  
  compile(request: CompilationRequest): Promise\<CompilationResult\>;  
}

export interface CompilationRequest {  
  readonly sources: readonly SourceInput\[\];  
  readonly configuration: CompilerConfiguration;  
  readonly previousModel?: JsdlModelIr;  
}

This supports:

* CI;  
* IDE integration;  
* Janumi Workbench semantic editing;  
* test harnesses;  
* future language server support.

---

# **44\. Internal Compiler Failure Handling**

An internal compiler failure SHALL be distinguished from a user model diagnostic.

The compiler SHALL:

* stop unsafe generation;  
* return a unique incident identifier where appropriate;  
* preserve a sanitized failure report;  
* avoid exposing secrets or full environment contents;  
* identify the failing phase;  
* provide reproducible input fingerprint.

Internal failures SHALL not be presented as JSDL semantic errors.

---

# **45\. Security Requirements**

The compiler SHALL:

1. parse source without executing embedded content;  
2. use safe YAML parsing;  
3. reject YAML custom executable tags;  
4. limit alias expansion to prevent YAML bombs;  
5. impose configurable source-size limits;  
6. impose configurable nesting limits;  
7. impose expression complexity limits;  
8. prohibit arbitrary runtime imports;  
9. verify module integrity where applicable;  
10. avoid reading outside configured workspace roots;  
11. avoid following unsafe symbolic links by default;  
12. write only within configured output roots;  
13. avoid network access in reproducible mode;  
14. sanitize diagnostics containing source excerpts;  
15. treat generator plugins as trusted code requiring explicit installation.

---

# **46\. Performance Requirements**

The bootstrap compiler SHOULD support a model containing:

100 modules  
5,000 declarations  
20,000 properties  
10,000 relationships  
2,000 commands  
2,000 events

within practical local development latency.

Initial targets:

Cold validation: under 5 seconds  
Warm incremental validation: under 1 second

These are design targets, not semantic requirements.

Compiler correctness takes precedence over speed.

---

# **47\. Testing Strategy**

Testing SHALL occur at multiple levels.

## **47.1 Parser Unit Tests**

Test:

* valid YAML;  
* valid JSON;  
* malformed documents;  
* source locations;  
* unknown fields;  
* scalar and collection type syntax.

## **47.2 Module Resolution Tests**

Test:

* exact versions;  
* compatible ranges;  
* incompatible versions;  
* missing modules;  
* duplicate aliases;  
* cycles;  
* lockfile behavior.

## **47.3 Symbol Tests**

Test:

* local resolution;  
* aliased imports;  
* selective imports;  
* ambiguity;  
* duplicate symbols;  
* qualified names.

## **47.4 Type-System Tests**

Test:

* primitive types;  
* aliases;  
* collections;  
* references;  
* ownership;  
* inheritance;  
* optionality;  
* nullability;  
* invalid assignability.

## **47.5 Semantic Validation Tests**

Test:

* aggregate ownership;  
* lifecycle reachability;  
* invalid commands;  
* missing events;  
* invalid permissions;  
* invalid projection paths;  
* weakened extensions.

## **47.6 Expression Tests**

Test:

* parsing;  
* type checking;  
* safe evaluation;  
* complexity limits;  
* invalid property access;  
* deterministic behavior.

## **47.7 IR Snapshot Tests**

Canonical IR SHALL be snapshot-tested.

Snapshots SHALL remain stable across non-semantic source reformatting.

## **47.8 Generator Golden Tests**

For each fixture:

input JSDL  
→ expected IR  
→ expected generated files

Generated files SHALL be byte-compared in reproducible mode.

## **47.9 Negative Fixture Tests**

Each diagnostic code SHOULD have at least one fixture demonstrating the error.

## **47.10 Property-Based Tests**

Property-based testing SHOULD verify:

* source-order independence;  
* deterministic output;  
* parser round-trip stability where applicable;  
* qualified-name uniqueness;  
* valid lifecycle graph behavior.

## **47.11 Fuzz Testing**

The parser and expression engine SHOULD be fuzz tested for:

* crashes;  
* excessive resource consumption;  
* unsafe input handling;  
* invalid YAML structures;  
* deeply nested type expressions.

---

# **48\. Conformance Fixture Structure**

tests/  
├── parser/  
├── resolution/  
├── symbols/  
├── types/  
├── lifecycles/  
├── aggregates/  
├── commands/  
├── events/  
├── invariants/  
├── permissions/  
├── projections/  
├── extensions/  
├── deterministic/  
├── compatibility/  
└── generators/

Fixture format:

case-name/  
├── input/  
│   └── model.jsdl.yaml  
├── expected-diagnostics.json  
├── expected-ir.json  
└── expected-output/

---

# **49\. Compiler Observability**

The compiler SHOULD emit structured traces for:

source\_load  
parse  
module\_resolution  
symbol\_collection  
reference\_resolution  
type\_check  
semantic\_validation  
ir\_generation  
model\_diff  
generator\_plan  
generator\_execution  
artifact\_validation

Trace attributes SHOULD include:

sourceCount  
moduleCount  
symbolCount  
diagnosticCount  
modelFingerprint  
generatorId  
cacheHit  
elapsed

Source content and secrets SHALL not be included by default.

---

# **50\. Implementation Backlog**

The following backlog is ordered to minimize semantic rework.

---

## **Epic 1 — Repository and Build Foundation**

### **JSDL-COMP-001**

Create TypeScript monorepo and workspace package structure.

**Acceptance criteria**

* workspace builds;  
* package boundaries compile;  
* linting and type checking run;  
* test runner executes;  
* no circular package dependencies.

### **JSDL-COMP-002**

Define shared compiler core types.

Includes:

* identifiers;  
* semantic versions;  
* source positions;  
* diagnostics;  
* compiler phases.

### **JSDL-COMP-003**

Implement deterministic hashing utilities.

---

## **Epic 2 — Source Loading**

### **JSDL-COMP-010**

Implement source discovery from configured glob patterns.

### **JSDL-COMP-011**

Implement safe UTF-8 source loading.

### **JSDL-COMP-012**

Implement source hashes and line maps.

### **JSDL-COMP-013**

Reject unsafe paths and unsupported encodings.

---

## **Epic 3 — Bootstrap Schema and Parsing**

### **JSDL-COMP-020**

Create bootstrap JSON Schema for JSDL v0.1.

### **JSDL-COMP-021**

Integrate safe YAML parser.

### **JSDL-COMP-022**

Implement raw AST types.

### **JSDL-COMP-023**

Convert parsed YAML/JSON into raw AST with source ranges.

### **JSDL-COMP-024**

Implement unknown-field diagnostics.

### **JSDL-COMP-025**

Implement type-reference parser.

---

## **Epic 4 — Module Resolution**

### **JSDL-COMP-030**

Implement semantic-version parsing and range evaluation.

### **JSDL-COMP-031**

Implement workspace module index.

### **JSDL-COMP-032**

Implement import resolution.

### **JSDL-COMP-033**

Implement aliases and selective imports.

### **JSDL-COMP-034**

Implement cycle detection.

### **JSDL-COMP-035**

Implement lockfile reading and validation.

---

## **Epic 5 — Symbol Table**

### **JSDL-COMP-040**

Define symbol kinds and stable symbol IDs.

### **JSDL-COMP-041**

Implement top-level symbol collection.

### **JSDL-COMP-042**

Implement nested symbol collection.

### **JSDL-COMP-043**

Implement qualified-name resolution.

### **JSDL-COMP-044**

Implement ambiguity and duplicate diagnostics.

---

## **Epic 6 — Type System**

### **JSDL-COMP-050**

Implement primitive and scalar types.

### **JSDL-COMP-051**

Implement collection types.

### **JSDL-COMP-052**

Implement `Reference<T>` and `Owned<T>`.

### **JSDL-COMP-053**

Implement value-object validation.

### **JSDL-COMP-054**

Implement entity identity validation.

### **JSDL-COMP-055**

Implement inheritance and assignability.

### **JSDL-COMP-056**

Implement property constraints.

---

## **Epic 7 — Expression Language**

### **JSDL-COMP-060**

Define expression grammar.

### **JSDL-COMP-061**

Implement tokenizer and parser.

### **JSDL-COMP-062**

Implement expression AST.

### **JSDL-COMP-063**

Implement expression type checking.

### **JSDL-COMP-064**

Implement safe deterministic evaluator.

### **JSDL-COMP-065**

Implement expression complexity limits.

---

## **Epic 8 — Semantic Validation**

### **JSDL-COMP-070**

Implement aggregate validation.

### **JSDL-COMP-071**

Implement lifecycle graph validation.

### **JSDL-COMP-072**

Implement command validation.

### **JSDL-COMP-073**

Implement event validation.

### **JSDL-COMP-074**

Implement invariant and validator validation.

### **JSDL-COMP-075**

Implement permission validation.

### **JSDL-COMP-076**

Implement projection path validation.

### **JSDL-COMP-077**

Implement extension safety validation.

---

## **Epic 9 — Canonical IR**

### **JSDL-COMP-080**

Define canonical IR types.

### **JSDL-COMP-081**

Normalize resolved AST into IR.

### **JSDL-COMP-082**

Implement inherited-property expansion.

### **JSDL-COMP-083**

Implement source-map generation.

### **JSDL-COMP-084**

Implement canonical sorting.

### **JSDL-COMP-085**

Implement model fingerprinting.

### **JSDL-COMP-086**

Implement stable IR serialization.

---

## **Epic 10 — Compiler Orchestration**

### **JSDL-COMP-090**

Implement compiler phase pipeline.

### **JSDL-COMP-091**

Implement compilation result and statistics.

### **JSDL-COMP-092**

Implement diagnostic cascade suppression.

### **JSDL-COMP-093**

Implement reproducible compilation mode.

### **JSDL-COMP-094**

Implement internal compiler error boundary.

---

## **Epic 11 — TypeScript Generator**

### **JSDL-COMP-100**

Implement generator API.

### **JSDL-COMP-101**

Generate scalar aliases and identifiers.

### **JSDL-COMP-102**

Generate enums.

### **JSDL-COMP-103**

Generate value-object interfaces.

### **JSDL-COMP-104**

Generate entity interfaces.

### **JSDL-COMP-105**

Generate relationship types.

### **JSDL-COMP-106**

Generate command contracts.

### **JSDL-COMP-107**

Generate event contracts.

### **JSDL-COMP-108**

Generate projection metadata types.

### **JSDL-COMP-109**

Generate output manifest and source annotations.

---

## **Epic 12 — JSON Schema Generator**

### **JSDL-COMP-110**

Implement schema ID strategy.

### **JSDL-COMP-111**

Generate primitives and aliases.

### **JSDL-COMP-112**

Generate value-object schemas.

### **JSDL-COMP-113**

Generate entity schemas.

### **JSDL-COMP-114**

Generate command schemas.

### **JSDL-COMP-115**

Generate event schemas.

### **JSDL-COMP-116**

Generate cross-module references.

### **JSDL-COMP-117**

Document non-expressible semantic constraints.

---

## **Epic 13 — Documentation Generator**

### **JSDL-COMP-120**

Generate module catalog.

### **JSDL-COMP-121**

Generate entity and relationship reference.

### **JSDL-COMP-122**

Generate lifecycle diagrams.

### **JSDL-COMP-123**

Generate command and event reference.

### **JSDL-COMP-124**

Generate invariants and permissions reference.

### **JSDL-COMP-125**

Generate projection catalog.

---

## **Epic 14 — CLI**

### **JSDL-COMP-130**

Implement configuration loading.

### **JSDL-COMP-131**

Implement `jsdl validate`.

### **JSDL-COMP-132**

Implement `jsdl compile`.

### **JSDL-COMP-133**

Implement `jsdl generate`.

### **JSDL-COMP-134**

Implement `jsdl inspect`.

### **JSDL-COMP-135**

Implement structured diagnostic output.

---

## **Epic 15 — Model Diff**

### **JSDL-COMP-140**

Define semantic change taxonomy.

### **JSDL-COMP-141**

Compare modules and declarations.

### **JSDL-COMP-142**

Classify property changes.

### **JSDL-COMP-143**

Classify lifecycle changes.

### **JSDL-COMP-144**

Classify command and event changes.

### **JSDL-COMP-145**

Generate compatibility report.

---

## **Epic 16 — Conformance and Security**

### **JSDL-COMP-150**

Create valid reference fixture suite.

### **JSDL-COMP-151**

Create invalid diagnostic fixture suite.

### **JSDL-COMP-152**

Create deterministic build tests.

### **JSDL-COMP-153**

Create parser fuzzing harness.

### **JSDL-COMP-154**

Implement YAML expansion limits.

### **JSDL-COMP-155**

Implement path and output-root protections.

### **JSDL-COMP-156**

Create dependency-boundary test.

---

# **51\. Milestone Plan**

## **Milestone 1 — Parse and Validate Structure**

Delivers:

* source loader;  
* bootstrap schema;  
* YAML parser;  
* raw AST;  
* source locations;  
* basic diagnostics.

## **Milestone 2 — Resolve Semantic Types**

Delivers:

* module resolution;  
* symbol table;  
* type-reference parser;  
* entity and value-object validation.

## **Milestone 3 — Validate Professional Model**

Delivers:

* aggregate validation;  
* lifecycle validation;  
* commands;  
* events;  
* invariants;  
* permissions;  
* projections.

## **Milestone 4 — Produce Canonical IR**

Delivers:

* normalized IR;  
* model fingerprint;  
* source mapping;  
* reproducible serialization.

## **Milestone 5 — Generate Usable Contracts**

Delivers:

* TypeScript generator;  
* JSON Schema generator;  
* generated manifest;  
* golden tests.

## **Milestone 6 — Developer Tooling**

Delivers:

* CLI;  
* inspect;  
* documentation generator;  
* compatibility diff;  
* CI integration.

---

# **52\. Definition of Done**

The bootstrap compiler is complete when it can:

1. load the canonical JSDL module set;  
2. parse all supported declaration categories;  
3. resolve module imports deterministically;  
4. resolve all symbols and types;  
5. reject invalid aggregate boundaries;  
6. validate lifecycle graphs;  
7. validate commands and emitted events;  
8. validate invariants and permissions;  
9. validate projection relationship paths;  
10. produce canonical IR;  
11. generate deterministic TypeScript;  
12. generate valid JSON Schema;  
13. generate reference documentation;  
14. report precise source-based diagnostics;  
15. classify model compatibility changes;  
16. pass conformance, security, and golden tests;  
17. compile the canonical PWU reference module without error.

---

# **53\. Coding Agent Operating Instructions**

The coding agent implementing the compiler SHALL follow these rules:

1. Implement phases in dependency order.  
2. Do not combine parsing, name resolution, and generation into one pass.  
3. Preserve source locations throughout the pipeline.  
4. Use discriminated unions and exhaustive handling.  
5. Reject unknown fields by default.  
6. Avoid implicit fallback semantics.  
7. Never resolve ambiguity using declaration order.  
8. Never allow generators to reinterpret unresolved source.  
9. Keep IR independent of TypeScript-specific generation.  
10. Implement diagnostics as stable public contracts.  
11. Add a negative fixture for every new semantic error.  
12. Add golden output tests for every generator feature.  
13. Maintain deterministic output from the beginning.  
14. Treat compiler crashes as defects, not model errors.  
15. Avoid adding language features not required by JSDL v0.1.  
16. Do not implement arbitrary expression execution.  
17. Preserve semantic distinctions among entity, value object, reference, and ownership.  
18. Preserve the distinction between semantic PWUs and transactional aggregates.  
19. Prefer explicit failure over inferred meaning.  
20. Record architecture deviations as explicit Decisions.

---

# **54\. Resulting Architecture**

The compiler architecture establishes a disciplined transformation boundary:

JSDL Source  
   │  
   ▼  
Raw Syntax  
   │  
   ▼  
Resolved Semantic Model  
   │  
   ▼  
Validated Canonical IR  
   │  
   ├──► TypeScript Contracts  
   ├──► JSON Schemas  
   ├──► Documentation  
   ├──► API Definitions  
   ├──► Persistence Models  
   ├──► Frontend Metadata  
   └──► Agent Contracts

No generator may bypass the validated semantic model.

No runtime may redefine professional meaning independently.

No UI may invent a conflicting local model.

The compiler therefore becomes the enforcement boundary between Janumi’s professional cognition discipline and the software artifacts implementing it.

---

# **55\. Next Required Artifact**

The next artifact is the **Janumi Runtime Semantic Architecture Specification**.

It shall define:

* authoritative entity and relationship storage;  
* event persistence;  
* command handling;  
* aggregate loading;  
* validation execution;  
* projection building;  
* reconciliation services;  
* RPH execution;  
* agent invocation;  
* transactional boundaries;  
* consistency models;  
* idempotency;  
* concurrency;  
* audit and provenance;  
* API boundaries;  
* integration with generated JSDL contracts;  
* initial single-node deployment profile.

\===

# **Janumi Execution Model**

## **JEM Specification v0.1**

**Status:** Normative draft  
**Depends on:** CPCO v0.1, PWU Specification v0.1, RPH Coordination Specification v0.1, Canonical Projection Model v0.1, JSDL Core v0.1, JSDL Compiler Architecture v0.1  
**Applies to:** Every Janumi runtime profile, including single-node, distributed, enterprise, offline, edge, development, and testing runtimes  
**Primary audiences:** Runtime architects, backend engineers, workflow engineers, agent-platform developers, coding agents, platform security engineers, SREs, PWA authors

---

# **1\. Purpose**

The Janumi Execution Model, or JEM, defines the invariant behavioral semantics by which Janumi professional cognition becomes executable.

JSDL defines the semantic model.

JEM defines how changes to that model are:

* requested;  
* authorized;  
* validated;  
* committed;  
* observed;  
* projected;  
* coordinated;  
* suspended;  
* resumed;  
* retried;  
* reconciled;  
* escalated;  
* audited.

JEM is independent of any particular:

* database;  
* programming language;  
* deployment platform;  
* messaging system;  
* workflow engine;  
* API style;  
* infrastructure topology.

A runtime is Janumi-conformant only if it preserves the semantics defined in this specification.

---

# **2\. Architectural Position**

Professional Cognition Discipline  
        ↓  
Canonical Professional Cognition Ontology  
        ↓  
JSDL Semantic Definitions  
        ↓  
Janumi Execution Model  
        ↓  
Runtime Profile  
        ↓  
Infrastructure and Deployment

The runtime profile may vary.

The execution semantics SHALL not.

---

# **3\. Central Execution Principle**

A Janumi state change becomes authoritative only when:

1. a semantic Command has been received;  
2. the caller has been authenticated;  
3. authority has been evaluated;  
4. the target semantic state has been loaded;  
5. concurrency expectations have been checked;  
6. applicable preconditions and invariants have been evaluated;  
7. the resulting state transition has been accepted;  
8. immutable semantic Events have been persisted;  
9. the authoritative state has been committed atomically within the declared consistency boundary.

Nothing is authoritative merely because:

* an agent generated output;  
* a workflow step completed;  
* a UI submitted a form;  
* an external tool returned successfully;  
* an event was placed on a message bus;  
* a projection displayed the result;  
* an artifact was created;  
* a human expressed informal approval.

---

# **4\. Execution Objects**

JEM recognizes the following execution objects.

## **4.1 Command**

A request to perform a professionally meaningful state transition.

## **4.2 Command Context**

The authenticated and semantic context under which a Command is evaluated.

## **4.3 Aggregate**

The transactional consistency boundary for authoritative mutation.

## **4.4 Event**

An immutable semantic fact resulting from an accepted Command or governed runtime process.

## **4.5 Validator**

A governed evaluation that determines whether a condition is satisfied.

## **4.6 Process Instance**

A durable coordinator spanning multiple Commands, Aggregates, Participants, or time periods.

## **4.7 RPH Instance**

A specialized Process Instance that coordinates professional cognition across one or more PWUs.

## **4.8 Agent Execution**

A bounded invocation of an AI Participant under an explicit professional contract.

## **4.9 Projection**

A derived view over authoritative state and Events.

## **4.10 Reconciliation Case**

A governed process for resolving detected incoherence.

## **4.11 Attention Item**

A durable indication that professional intervention is required.

---

# **5\. Command Envelope**

Every authoritative Command SHALL include:

commandId  
commandType  
commandVersion  
targetType  
targetId  
expectedVersion  
requestedBy  
requestedAt  
correlationId  
causationId  
tenantId  
organizationId  
professionalContext  
originatingProjection  
payload  
idempotencyKey

## **5.1 `commandId`**

Globally unique identity for this Command request.

## **5.2 `expectedVersion`**

The authoritative version the caller believes it is changing.

This MAY be optional for create operations.

## **5.3 `correlationId`**

Groups related professional and computational work.

## **5.4 `causationId`**

Identifies the prior Command, Event, Agent Execution, or Process action that caused this Command.

## **5.5 `professionalContext`**

SHOULD identify:

endeavorId  
pwuId  
rphId  
intentIds  
participantRole  
authorityScope  
temporalMode

## **5.6 `originatingProjection`**

Preserves the UI or agent projection from which the Command arose.

## **5.7 `idempotencyKey`**

Allows safe replay of semantically identical requests.

---

# **6\. Command Handling Pipeline**

A conformant runtime SHALL process a Command through the following stages.

Receive  
  ↓  
Authenticate  
  ↓  
Resolve Tenant and Organization  
  ↓  
Load Semantic Definition  
  ↓  
Evaluate Idempotency  
  ↓  
Load Aggregate  
  ↓  
Check Expected Version  
  ↓  
Evaluate Authority  
  ↓  
Normalize and Validate Payload  
  ↓  
Execute Preconditions  
  ↓  
Evaluate Invariants  
  ↓  
Apply Semantic Transition  
  ↓  
Create Events  
  ↓  
Commit Aggregate and Events  
  ↓  
Publish Post-Commit Notifications  
  ↓  
Update Projections  
  ↓  
Return Result

The runtime MAY optimize implementation details but SHALL preserve this observable semantic order.

---

# **7\. Authentication and Identity**

The runtime SHALL distinguish:

* authenticated identity;  
* represented Participant;  
* delegated Participant;  
* executing service;  
* AI agent identity;  
* human principal;  
* external system principal.

## **7.1 Authentication**

Authentication establishes who or what initiated the request.

## **7.2 Participant Resolution**

The authenticated principal SHALL resolve to one or more Janumi Participants.

## **7.3 Delegation**

Delegated authority SHALL be explicit, scoped, and time-bounded where applicable.

## **7.4 AI Identity**

An AI Agent execution SHALL identify:

agentId  
agentRole  
modelIdentity  
modelVersion  
executionPolicy  
toolAuthority  
delegatingParticipant

An AI request SHALL not inherit unrestricted authority from the service account executing it.

---

# **8\. Authority Evaluation**

Authority SHALL be evaluated at Command execution time.

It SHALL not be trusted solely from:

* UI visibility;  
* stale access tokens;  
* prior role assignment;  
* agent prompt instructions;  
* cached projection metadata.

## **8.1 Authority Inputs**

Authority evaluation SHALL consider:

authenticatedPrincipal  
representedParticipant  
assignedRoles  
delegatedAuthority  
targetScope  
commandType  
currentLifecycleState  
organizationPolicy  
PWA Policy  
mandatoryConstraints  
timeValidity  
exceptionAuthority

## **8.2 Authority Outcomes**

authorized  
authorized\_conditionally  
unauthorized  
requires\_additional\_approval  
requires\_exception

## **8.3 Conditional Authority**

Conditional authority SHALL identify the unmet condition.

## **8.4 Multi-Party Authority**

Where multiple approvals or quorum are required, one approval SHALL produce an intermediate authoritative state rather than final approval.

---

# **9\. Aggregate Loading**

The runtime SHALL load the authoritative Aggregate state required to evaluate the Command.

The Aggregate may be reconstructed from:

* current state tables;  
* event history;  
* snapshots plus Events;  
* a hybrid persistence model.

The result SHALL be semantically equivalent.

## **9.1 Aggregate Version**

Every mutable Aggregate SHALL expose an authoritative version.

## **9.2 Snapshot Correctness**

A snapshot SHALL identify:

aggregateId  
aggregateVersion  
sourceEventPosition  
modelVersion  
createdAt

A snapshot is an optimization, not an independent truth.

---

# **10\. Optimistic Concurrency**

Optimistic concurrency is the default JEM consistency mechanism.

## **10.1 Version Check**

If:

command.expectedVersion \!= aggregate.currentVersion

the Command SHALL fail unless the Command type explicitly supports merge or reconciliation semantics.

## **10.2 Concurrency Failure**

The runtime SHALL return:

currentVersion  
expectedVersion  
materialChangesSinceExpectedVersion  
recommendedDisposition

where feasible.

## **10.3 No Silent Last-Write-Wins**

Material professional state SHALL not use silent last-write-wins behavior.

## **10.4 Retry After Concurrency Failure**

A client or Process MAY:

* reload;  
* compare;  
* revise;  
* issue a new Command;  
* open reconciliation.

It SHALL not automatically resubmit a stale material Command without revalidation.

---

# **11\. Idempotency**

Every externally initiated state-changing Command SHOULD be idempotent.

## **11.1 Idempotency Scope**

Idempotency SHALL be scoped by:

tenantId  
commandType  
targetId  
idempotencyKey

## **11.2 Duplicate Command**

When an identical Command has already completed, the runtime SHALL return the prior authoritative result.

## **11.3 Conflicting Reuse**

Reusing an idempotency key with different payload or target SHALL fail.

## **11.4 Event Duplication**

Idempotency SHALL prevent duplicate semantic Events from being committed for the same accepted Command.

---

# **12\. Payload Normalization**

Command payloads SHALL be normalized before semantic validation.

Normalization MAY include:

* canonical identifiers;  
* date normalization;  
* enum normalization;  
* whitespace normalization;  
* reference normalization;  
* source-type normalization;  
* PWA-specific canonicalization.

Normalization SHALL not change professional intent.

## **12.1 Boundary Contract**

All external inputs are untrusted.

The runtime SHALL:

parse  
normalize  
validate  
canonicalize  
authorize

before authoritative mutation.

---

# **13\. Validator Execution Model**

Validators may be:

structural  
semantic  
professional  
coherence  
governance  
temporal  
security  
safety  
external  
human  
AI-assisted

## **13.1 Validator Ordering**

Unless a JSDL definition specifies stricter order, validators SHALL execute in this sequence:

1. structural;  
2. type and schema;  
3. authority-independent semantic;  
4. governance;  
5. security and safety;  
6. aggregate invariants;  
7. cross-aggregate coherence;  
8. external;  
9. AI-assisted;  
10. human validation.

This order minimizes expensive or external work on obviously invalid Commands.

## **13.2 Validator Result**

Every Validator SHALL return:

validatorId  
validatorVersion  
subjectId  
result  
severity  
rationale  
evidenceIds  
performedBy  
performedAt  
expiresAt  
limitations

## **13.3 Result Values**

pass  
fail  
conditional\_pass  
inconclusive  
not\_applicable

## **13.4 Inconclusive Result**

An inconclusive Validator result SHALL not be silently treated as pass.

The governing Command or lifecycle transition SHALL define whether inconclusive:

* blocks;  
* requests Evidence;  
* requires human review;  
* permits conditional continuation;  
* escalates.

## **13.5 Validator Side Effects**

A Validator SHALL not directly mutate authoritative domain state.

It MAY produce:

* a Validation entity;  
* Evidence;  
* an Attention Item;  
* a recommendation;  
* a follow-on Command proposal.

Authoritative changes require Commands.

---

# **14\. Synchronous and Asynchronous Validation**

## **14.1 Synchronous Validators**

Used when:

* execution is bounded;  
* results are immediately available;  
* Command acceptance depends on the result;  
* the Validator does not require human or long-running external work.

## **14.2 Asynchronous Validators**

Used when validation requires:

* external systems;  
* human review;  
* long-running analysis;  
* substantial AI reasoning;  
* physical inspection;  
* scientific experiment;  
* legal or policy review.

## **14.3 Pending Validation**

A Command requiring asynchronous validation SHALL not falsely complete.

It SHALL instead produce an appropriate intermediate state such as:

awaiting\_review  
awaiting\_evidence  
awaiting\_external

and a durable Process Instance.

---

# **15\. Invariant Evaluation**

Invariants SHALL be evaluated:

* before committing a mutation;  
* after applying the proposed transition;  
* against the resulting authoritative state;  
* within the relevant consistency boundary.

## **15.1 Pre-State and Post-State**

An invariant may refer to:

priorState  
command  
proposedState  
actor  
authorityContext

## **15.2 Invariant Failure**

An error-level invariant failure SHALL abort the transaction.

No authoritative Events SHALL be committed.

## **15.3 Advisory Invariants**

Warning or advisory conditions MAY permit continuation but SHALL remain observable and may create Attention Items.

---

# **16\. Transaction Boundary**

The minimum atomic transaction SHALL include:

1. authoritative Aggregate state change;  
2. Aggregate version increment;  
3. immutable Event persistence;  
4. Command-result persistence;  
5. idempotency record.

These SHALL either all commit or none commit.

## **16.1 Outbox**

Where post-commit publication uses a message broker, the runtime SHALL use a transactional outbox or equivalent guarantee.

## **16.2 Projection Update**

Projection updates MAY occur outside the authoritative transaction.

They SHALL be driven by committed Events or authoritative state.

## **16.3 External Side Effects**

External side effects SHALL not be assumed atomic with the Aggregate transaction unless the runtime profile explicitly provides that guarantee.

They SHALL use durable Process or saga semantics.

---

# **17\. Event Persistence**

Every accepted material Command SHALL produce one or more immutable Events.

## **17.1 Event Envelope**

eventId  
eventType  
eventVersion  
aggregateId  
aggregateType  
aggregateVersion  
occurredAt  
recordedAt  
actorId  
participantId  
tenantId  
organizationId  
correlationId  
causationId  
commandId  
payload  
provenance  
semanticModelVersion

## **17.2 Event Ordering**

Events for a single Aggregate SHALL have a total order.

The authoritative ordering key SHOULD be:

aggregateVersion

## **17.3 Cross-Aggregate Ordering**

JEM does not require a total global event order.

Cross-Aggregate coordination SHALL use:

* correlation;  
* causation;  
* process state;  
* logical clocks;  
* durable sequence positions;  
* reconciliation when necessary.

## **17.4 Event Time**

`occurredAt` represents semantic occurrence.

`recordedAt` represents runtime persistence.

These SHALL remain distinct.

---

# **18\. Event Publication**

Post-commit Event publication MAY be:

* synchronous;  
* asynchronous;  
* brokered;  
* polled from an outbox;  
* delivered through database change streams.

## **18.1 At-Least-Once Delivery**

Runtime profiles MAY use at-least-once delivery.

Consumers SHALL therefore be idempotent.

## **18.2 Delivery Does Not Define Authority**

An Event is authoritative because it was committed, not because it was delivered.

## **18.3 Publication Failure**

Publication failure SHALL not roll back already committed authoritative state.

It SHALL trigger retry and operational attention.

---

# **19\. Projection Execution**

Projections are derived and MAY be eventually consistent.

## **19.1 Projection Source**

A projection builder SHALL consume:

* committed Events;  
* authoritative state;  
* or both.

## **19.2 Projection Checkpoint**

Each projection instance or store SHALL track a checkpoint.

projectionId  
partition  
lastProcessedEventPosition  
updatedAt  
status

## **19.3 Projection Status**

current  
catching\_up  
stale  
failed  
rebuilding  
partial  
offline

## **19.4 Command Safety from Projections**

A state-changing Command initiated from a projection SHALL include expected Aggregate versions or equivalent semantic version context.

## **19.5 Rebuild**

A projection SHALL be rebuildable from authoritative state and Event history.

A projection that cannot be rebuilt SHALL be treated as an authoritative subsystem and governed separately.

---

# **20\. Projection Consistency Model**

JEM supports:

## **20.1 Strongly Current Projection**

Generated within or immediately from the authoritative transaction.

Use sparingly.

## **20.2 Read-After-Write Projection**

The initiating caller is guaranteed to observe its accepted Command result.

## **20.3 Eventually Consistent Projection**

Updated asynchronously after Event commit.

## **20.4 Historical Projection**

Derived as of a selected temporal point.

## **20.5 Predictive Projection**

Derived from models and explicitly non-authoritative.

Every projection SHALL disclose its consistency mode.

---

# **21\. Process Instances**

A Process Instance coordinates work spanning:

* multiple transactions;  
* multiple Aggregates;  
* long time periods;  
* human participation;  
* external systems;  
* retries;  
* suspension.

Examples:

* asynchronous validation;  
* Decision approval;  
* RPH coordination;  
* external Evidence collection;  
* reconciliation;  
* agent execution with review.

## **21.1 Process State**

Every Process Instance SHALL persist:

processId  
processType  
processVersion  
status  
currentStep  
correlationId  
causationId  
startedAt  
updatedAt  
deadline  
retryState  
suspensionReason  
inputReferences  
outputReferences  
history

## **21.2 Process Status**

created  
running  
waiting  
suspended  
retrying  
reconciling  
completed  
failed  
cancelled  
escalated

## **21.3 Durable Waiting**

Waiting for:

* human review;  
* external Evidence;  
* time;  
* external callback;  
* another PWU;  
* authority;  
* resource availability

SHALL be represented durably, not by keeping an in-memory thread alive.

---

# **22\. RPH Instance Lifecycle**

An RPH Instance is a durable professional coordination Process.

## **22.1 RPH States**

initializing  
framing  
planning  
allocating  
coordinating  
observing  
validating  
reconciling  
synthesizing  
awaiting\_human  
awaiting\_external  
changing\_tactic  
escalating  
completed  
failed  
cancelled

## **22.2 RPH State Is Not PWU State**

An RPH may be:

observing

while its coordinated PWUs occupy many different lifecycle states.

## **22.3 RPH Authoritative State**

An RPH SHALL persist:

rphId  
professionalObjective  
authority  
scope  
coordinatedPwuIds  
childRphIds  
participants  
allocationState  
currentPlan  
activeTactics  
validationPolicy  
reconciliationPolicy  
escalationPolicy  
synthesisState  
observabilityState

---

# **23\. RPH Planning Semantics**

Planning is continuous and versioned.

## **23.1 Plan**

An RPH plan SHALL identify:

planId  
planVersion  
professionalObjective  
requiredPWUs  
dependencies  
allocations  
validationPoints  
decisionPoints  
synthesisPoints  
escalationConditions  
assumptions

## **23.2 Plan Revision**

A material plan revision SHALL record:

* trigger;  
* prior plan;  
* changed assumptions;  
* affected PWUs;  
* affected Participants;  
* expected effect;  
* authority.

## **23.3 Plan Is Not Authority**

The plan does not directly mutate PWUs.

It produces or proposes semantic Commands.

---

# **24\. Work Allocation**

Allocation assigns bounded responsibility to:

* humans;  
* AI Agents;  
* teams;  
* external systems;  
* child RPHs;  
* external organizations.

## **24.1 Allocation Contract**

allocationId  
objective  
scope  
authority  
participant  
requiredInputs  
requiredOutputs  
constraints  
completionConditions  
validationRequirements  
escalationConditions  
deadline

## **24.2 Capability Evaluation**

Allocation SHOULD consider:

capability  
authority  
availability  
cost  
risk  
domain suitability  
historical quality  
tool access  
conflict of interest  
independence requirements

## **24.3 Allocation Failure**

If no responsible allocation can be made, the RPH SHALL:

* revise scope;  
* seek another Participant;  
* create an Attention Item;  
* escalate;  
* or fail explicitly.

---

# **25\. Agent Execution Contract**

Every AI Agent invocation SHALL be a durable, attributable execution object.

## **25.1 Required Inputs**

agentExecutionId  
agentId  
agentRole  
modelIdentity  
objective  
originatingIntent  
scope  
authority  
constraints  
contextProjection  
availableEvidence  
requiredOutputs  
validationCriteria  
completionConditions  
terminationConditions  
escalationConditions  
toolPermissions  
resourceLimits

## **25.2 Required Outputs**

producedEntityProposals  
reasoningSummary  
evidenceUsed  
assumptionsIntroduced  
claimsProduced  
confidenceAssessments  
limitations  
unresolvedQuestions  
residualUncertainty  
recommendedCommands  
validationResults  
provenance

## **25.3 Proposal Boundary**

AI output SHALL be treated as proposed professional state unless the AI possesses explicit governed authority for the relevant Command.

## **25.4 Agent Tool Use**

Each tool invocation SHALL record:

toolCallId  
toolId  
input  
authorizationScope  
startedAt  
completedAt  
resultReference  
error

Secrets and protected content SHALL be handled according to security policy.

## **25.5 Hidden Reasoning**

The runtime SHALL not require storage of private model chain-of-thought.

It SHALL preserve professional rationale, Evidence, assumptions, methods, and limitations sufficient for review.

---

# **26\. Agent Execution States**

created  
queued  
running  
waiting\_for\_tool  
waiting\_for\_evidence  
waiting\_for\_human  
validating  
completed  
failed  
cancelled  
escalated  
timed\_out

## **26.1 Agent Completion**

An Agent Execution may complete successfully while the PWU remains incomplete.

## **26.2 Agent Failure**

Agent failure SHALL preserve:

* work performed;  
* outputs produced;  
* tool history;  
* failure classification;  
* remaining uncertainty;  
* recommended next tactic.

---

# **27\. Retry Semantics**

Retries SHALL distinguish transient execution failure from professional reasoning failure.

## **27.1 Technical Retry**

Appropriate for:

* temporary network failure;  
* transient service outage;  
* rate limiting;  
* temporary resource unavailability;  
* broker delivery failure.

## **27.2 Professional Retry**

A repeated attempt at the same reasoning or validation method.

This SHALL not be automatic without policy because repetition may provide no professional value.

## **27.3 Retry Policy**

maxAttempts  
backoff  
retryableFailureClasses  
deadline  
jitterPolicy  
escalationAfterExhaustion

## **27.4 Idempotent Retry**

Technical retries SHALL preserve idempotency.

## **27.5 Retry Observability**

Retries SHALL be observable and correlated to the original execution.

---

# **28\. Tactic Change Semantics**

A tactic change is not a retry.

It changes the professional approach.

## **28.1 Trigger Conditions**

Examples:

* no material uncertainty reduction;  
* repeated validation failure;  
* recurring identical defect;  
* oscillation among Alternatives;  
* contradictory Evidence;  
* method invalidation;  
* context-window saturation;  
* insufficient domain capability;  
* excessive decomposition overhead;  
* tool limitation.

## **28.2 Tactic Change Actions**

change\_method  
change\_agent  
change\_model  
request\_human  
add\_evidence  
broaden\_search  
narrow\_scope  
reframe\_question  
challenge\_assumption  
decompose  
recompose  
merge\_work  
escalate

## **28.3 Authority**

A tactic change SHALL occur only within delegated coordination authority.

## **28.4 Tactic History**

The RPH SHALL preserve:

* prior tactic;  
* observed result;  
* reason for change;  
* selected new tactic;  
* expected improvement.

---

# **29\. Progress Evaluation**

JEM SHALL distinguish:

* computational activity;  
* professional progress.

## **29.1 Computational Activity**

Examples:

* tool calls;  
* generated tokens;  
* files modified;  
* tests run;  
* messages exchanged.

## **29.2 Professional Progress**

Examples:

* uncertainty reduced;  
* Evidence improved;  
* Claim confidence changed;  
* Decision readiness increased;  
* contradiction resolved;  
* validation completed;  
* synthesis advanced.

## **29.3 No-Progress Detection**

RPH policy MAY define a no-progress window based on:

iterationCount  
elapsedTime  
cost  
unchangedUncertainty  
unchangedValidationState  
repeatedFailureClass  
oscillation

No-progress detection SHOULD trigger tactic evaluation, not immediate blind retry.

---

# **30\. Suspension and Resumption**

Long-running professional work frequently waits.

## **30.1 Suspension Reasons**

awaiting\_human  
awaiting\_evidence  
awaiting\_external  
awaiting\_decision  
awaiting\_time  
resource\_unavailable  
policy\_hold  
manual\_pause

## **30.2 Suspension State**

The runtime SHALL persist:

suspendedAt  
suspensionReason  
resumeTrigger  
deadline  
responsibleParticipant  
attentionItemId

## **30.3 Resume Triggers**

command  
event  
time  
external\_callback  
evidence\_arrival  
decision\_approval  
dependency\_satisfied  
manual\_resume

## **30.4 Resume Validation**

Resumption SHALL re-evaluate:

* authority;  
* current semantic state;  
* relevant Constraints;  
* stale assumptions;  
* model version compatibility;  
* deadlines;  
* dependency state.

A suspended Process SHALL not assume that the world remained unchanged.

---

# **31\. Timers and Deadlines**

Timers SHALL be durable.

## **31.1 Timer Types**

deadline  
review\_due  
evidence\_due  
retry\_due  
reconciliation\_review  
temporary\_exception\_expiration  
attention\_escalation

## **31.2 Clock Source**

The runtime SHALL use a trusted, consistent clock source.

## **31.3 Timer Event**

Timer expiration SHALL generate an Event or Process wake-up.

It SHALL not mutate domain state invisibly.

---

# **32\. External Integration Semantics**

External systems may provide:

* Evidence;  
* Artifacts;  
* Observations;  
* identity;  
* approvals;  
* execution;  
* telemetry.

## **32.1 Integration Boundary**

External input SHALL be normalized into explicit CPCO or runtime objects.

## **32.2 External Command**

Where Janumi instructs an external system, the runtime SHALL persist:

externalOperationId  
request  
authorization  
idempotencyKey  
status  
response  
attempts

## **32.3 Callback**

External callbacks SHALL be authenticated and idempotent.

## **32.4 External Success**

External operation success SHALL not automatically imply:

* Decision correctness;  
* Action validation;  
* outcome achievement;  
* PWU completion.

---

# **33\. Saga and Compensation Semantics**

Multi-system operations SHALL use durable saga-style coordination.

## **33.1 Compensation**

A compensation is a new professional or technical Action.

It is not a rollback of history.

## **33.2 Compensation Record**

originalAction  
failure  
compensatingAction  
authority  
result  
residualEffect

## **33.3 Non-Compensable Actions**

Where an Action cannot be reversed, the process SHALL identify:

* irreversibility;  
* risk;  
* approval requirement;  
* recovery strategy;  
* observation requirements.

---

# **34\. Reconciliation Execution**

Reconciliation SHALL be a first-class Process.

## **34.1 Detection**

A reconciliation trigger may arise from:

* new Evidence;  
* contradiction;  
* assumption failure;  
* intent revision;  
* constraint change;  
* validation failure;  
* observation mismatch;  
* cross-PWU conflict;  
* external event;  
* concurrency conflict;  
* offline synchronization conflict.

## **34.2 Reconciliation Case**

reconciliationId  
trigger  
affectedEntities  
affectedAggregates  
affectedPWUs  
affectedDecisions  
priorStateReferences  
proposedChanges  
impactAssessment  
requiredAuthority  
validationPlan  
status

## **34.3 Reconciliation States**

detected  
analyzing  
proposed  
awaiting\_review  
accepted  
rejected  
applying  
applied  
partially\_applied  
escalated  
failed

## **34.4 Application**

Applying reconciliation SHALL issue normal semantic Commands.

The reconciliation Process SHALL not bypass Aggregate invariants.

## **34.5 Partial Application**

If some changes commit and others fail, the Process SHALL:

* preserve committed changes;  
* identify remaining incoherence;  
* reassess impact;  
* retry, revise, compensate, or escalate.

---

# **35\. Cross-Aggregate Consistency**

JEM does not require distributed ACID transactions across all professional state.

Cross-Aggregate coherence SHALL be maintained through:

* Commands;  
* Events;  
* Process Instances;  
* Validators;  
* reconciliation;  
* compensating Actions;  
* explicit temporary incoherence.

## **35.1 Temporary Incoherence**

Temporary incoherence SHALL be:

* visible;  
* bounded;  
* risk-assessed;  
* authorized;  
* reviewed;  
* time-qualified.

## **35.2 Cross-Aggregate Validator**

A cross-Aggregate Validator may inspect multiple authoritative states.

It SHALL not mutate them directly.

---

# **36\. Parent–Child PWU Execution**

## **36.1 Decomposition**

Creating a child PWU SHALL:

1. validate the parent’s authority;  
2. create a delegation contract;  
3. create the child Aggregate;  
4. link parent and child;  
5. establish recomposition obligations;  
6. emit corresponding Events.

## **36.2 Child Independence**

A child PWU advances under its own lifecycle and concurrency version.

## **36.3 Parent Observation**

The parent or RPH observes child Events through projections or coordination Processes.

## **36.4 Recomposition**

The parent SHALL not complete until required recomposition is accepted.

## **36.5 Child Reopening**

A child may be reopened after parent synthesis if new conflict or Evidence emerges.

This SHALL trigger parent impact assessment.

---

# **37\. Synthesis Execution**

Synthesis reconstructs parent understanding from subordinate work.

## **37.1 Synthesis Inputs**

childOutputs  
childClaims  
childEvidence  
childDecisions  
childAssumptions  
childResidualUncertainty  
childValidations  
crossChildDependencies  
contradictions

## **37.2 Synthesis Output**

Synthesis SHALL produce explicit professional entities, such as:

* synthesized Representation;  
* parent Claims;  
* confidence assessment;  
* contradiction set;  
* follow-on PWUs;  
* updated Decision proposal;  
* recomposition Validation.

## **37.3 Synthesis Authority**

Synthesis may be AI-assisted, but acceptance SHALL follow normal authority and validation rules.

---

# **38\. Human Interaction Semantics**

Human work may occur through:

* UI Command;  
* review;  
* approval;  
* Evidence contribution;  
* external action;  
* structured response;  
* conversational proposal.

## **38.1 Human Task**

A human task SHALL be durable and semantically typed.

review\_required  
decision\_required  
evidence\_required  
validation\_required  
exception\_required  
reconciliation\_required

## **38.2 Human Response**

A human response SHALL be converted into:

* a Command;  
* Evidence;  
* Observation;  
* Validation;  
* Decision;  
* or another explicit entity.

It SHALL not remain only as unstructured process metadata.

---

# **39\. Attention Semantics**

Attention Items represent required professional intervention.

## **39.1 Creation**

Attention may be created by:

* Validator result;  
* RPH escalation;  
* timeout;  
* failed dependency;  
* contradiction;  
* intent change;  
* assumption invalidation;  
* pending Decision;  
* reconciliation.

## **39.2 Disposition**

Attention SHALL remain until:

resolved  
delegated  
deferred  
accepted\_risk  
not\_applicable  
duplicate  
escalated  
superseded

## **39.3 Notification Delivery**

Notification is a delivery mechanism.

The Attention Item is the durable professional state.

---

# **40\. Failure Taxonomy**

JEM SHALL classify failures.

## **40.1 Command Failure**

The requested semantic transition was rejected.

## **40.2 Validation Failure**

Required criteria were not satisfied.

## **40.3 Technical Failure**

Infrastructure or software prevented execution.

## **40.4 Dependency Failure**

Required internal or external state was unavailable or invalid.

## **40.5 Professional Failure**

The objective could not responsibly be achieved.

## **40.6 Authority Failure**

Required authority was absent.

## **40.7 Reconciliation Failure**

Coherence could not be restored within current scope or authority.

## **40.8 Security or Safety Failure**

Continuing would violate a safety, security, ethical, or legal boundary.

---

# **41\. Error Contract**

Every failed operation SHALL return or persist:

errorCode  
errorCategory  
professionalMessage  
technicalMessage  
retryable  
currentState  
failedCondition  
relatedEntityIds  
correlationId  
recommendedDisposition

The professional message SHALL explain the semantic reason.

The technical message MAY contain implementation detail appropriate to the caller.

---

# **42\. Escalation Semantics**

Escalation is a governed transfer of unresolved professional responsibility.

## **42.1 Escalation Trigger**

An escalation SHALL occur when:

* authority is insufficient;  
* Evidence is insufficient;  
* repeated tactics fail;  
* Constraints conflict;  
* safety, legality, ethics, or security require review;  
* required human judgment is identified;  
* resource limits prevent responsible continuation;  
* professional uncertainty cannot be responsibly reduced.

## **42.2 Escalation Package**

objective  
currentState  
blockingCondition  
workPerformed  
tacticsAttempted  
evidence  
assumptions  
constraints  
remainingUncertainty  
decisionRequired  
options  
recommendation  
riskOfDelay  
riskOfProceeding

## **42.3 Receiving Authority**

The receiving Participant or parent RPH SHALL be explicit.

## **42.4 Escalation Outcome**

accepted  
redirected  
returned\_for\_more\_information  
resolved  
deferred  
rejected

---

# **43\. Completion Semantics**

PWU completion and RPH completion SHALL remain distinct.

## **43.1 PWU Completion**

Requires satisfaction of PWU completion conditions.

## **43.2 RPH Completion**

Requires that the coordination responsibility has reached a valid disposition.

An RPH may complete because:

* coordinated work completed;  
* responsibility transferred;  
* escalation accepted;  
* work cancelled;  
* failure disposition recorded.

## **43.3 Process Completion**

Process completion does not imply professional outcome achievement unless explicitly defined.

---

# **44\. Cancellation Semantics**

Cancellation SHALL be explicit and governed.

## **44.1 Cancellation Types**

user\_requested  
authority\_directed  
superseded  
policy\_required  
resource\_terminated  
timeout  
professional\_abandonment

## **44.2 Cancellation Effects**

Cancellation SHALL specify:

* whether active external Actions are stopped;  
* whether compensation is required;  
* whether partial outputs remain valid;  
* whether child PWUs are cancelled;  
* whether attention remains;  
* whether follow-on reconciliation is required.

---

# **45\. Semantic Model Versioning at Runtime**

Every authoritative object SHALL identify the semantic model version under which it was created or last validated.

## **45.1 Runtime Compatibility**

A runtime SHALL not execute a Command against a semantic definition it cannot interpret.

## **45.2 Model Upgrade**

A model upgrade MAY require:

* data migration;  
* event upcasting;  
* projection rebuild;  
* Validator re-execution;  
* Command compatibility layer;  
* runtime dual-version support.

## **45.3 Historical Interpretation**

Historical Events SHALL remain interpretable under their original schema version.

---

# **46\. Event Upcasting**

An Event upcaster transforms an older Event representation into a newer in-memory representation without changing historical meaning.

## **46.1 Upcaster Rule**

An upcaster SHALL not invent professional facts absent from the original Event.

## **46.2 Irreducible Change**

Where an old Event cannot be faithfully mapped, the runtime SHALL retain version-specific handling or require explicit migration.

---

# **47\. Data Migration**

Data migration SHALL distinguish:

* structural migration;  
* semantic migration;  
* reconciliation.

## **47.1 Structural Migration**

Changes technical representation without professional meaning.

## **47.2 Semantic Migration**

Changes how professional state is represented or classified.

It SHALL be explicit and auditable.

## **47.3 Reconciliation**

Required when the new model reveals substantive incoherence or ambiguity.

---

# **48\. Security Semantics**

## **48.1 Tenant Isolation**

Every Command, Event, Aggregate, Process, Projection, and Attention Item SHALL be tenant-scoped.

## **48.2 Organization Boundary**

Cross-organization access SHALL require explicit federation or sharing policy.

## **48.3 Least Authority**

Services, humans, and AI Agents SHALL receive minimum necessary authority.

## **48.4 Sensitive Evidence**

Evidence access restrictions SHALL propagate into projections and Agent context.

## **48.5 Audit**

Security-relevant authority changes and access to protected professional state SHALL be auditable.

---

# **49\. Provenance Semantics**

Every material professional entity SHALL preserve provenance.

## **49.1 Provenance Chain**

The runtime SHOULD support tracing:

Entity  
← Event  
← Command  
← Participant or Process  
← Projection or Agent Execution  
← Evidence and Context

## **49.2 AI Provenance**

AI provenance SHALL include:

* Agent;  
* model;  
* policy;  
* context sources;  
* tool calls;  
* validation;  
* accepting human or authority where applicable.

---

# **50\. Audit Semantics**

Audit records SHALL be append-only or equivalently tamper-evident.

Audit SHALL include:

* authority evaluation;  
* Command acceptance and rejection;  
* state transitions;  
* access to protected content;  
* model version changes;  
* exception grants;  
* reconciliation;  
* escalation;  
* AI execution.

Audit records are not a substitute for domain Events.

---

# **51\. Observability Model**

JEM requires computational and cognitive observability.

## **51.1 Computational Observability**

command\_latency  
command\_failure  
transaction\_retry  
event\_publication\_lag  
projection\_lag  
process\_wait\_time  
agent\_execution\_duration  
tool\_failure  
resource\_usage

## **51.2 Cognitive Observability**

uncertainty\_reduction  
unsupported\_claims  
critical\_assumption\_exposure  
decision\_wait\_time  
validation\_backlog  
reconciliation\_backlog  
dependency\_blockage  
tactic\_change\_rate  
escalation\_rate  
synthesis\_queue  
human\_review\_latency

## **51.3 Trace Boundaries**

Material trace spans SHOULD include:

CommandReceived  
AuthorityEvaluated  
AggregateLoaded  
ValidationExecuted  
TransactionCommitted  
EventsPublished  
ProjectionUpdated  
AgentInvoked  
ProcessSuspended  
ProcessResumed  
ReconciliationApplied

---

# **52\. Trace Correlation**

All work arising from a professional request SHALL retain:

correlationId  
causationId  
endeavorId  
pwuId  
rphId  
participantId  
agentExecutionId

where applicable.

This enables reconstruction across:

* API;  
* runtime;  
* workflow;  
* tool;  
* agent;  
* Event;  
* projection.

---

# **53\. Replay Semantics**

The runtime MAY replay Events to:

* rebuild projections;  
* reconstruct Aggregates;  
* test migrations;  
* simulate alternative logic;  
* recover state.

## **53.1 No External Side Effects During Replay**

Replay SHALL not repeat external Actions unless explicitly operating in a controlled simulation.

## **53.2 Determinism**

Aggregate reconstruction from the same Event sequence and semantic model version SHALL be deterministic.

---

# **54\. Simulation Mode**

A runtime MAY support simulation.

Simulation SHALL be visibly and technically separated from authoritative execution.

## **54.1 Simulation Output**

Simulation may produce:

* predicted Events;  
* candidate projections;  
* alternative Decisions;  
* risk estimates;  
* reconciliation proposals.

## **54.2 Promotion**

Simulation output SHALL not become authoritative without normal Commands, validation, and authority.

---

# **55\. Offline Execution**

An offline runtime profile MAY permit local Commands and projections.

## **55.1 Local Authority**

Offline authority SHALL be explicitly defined.

## **55.2 Synchronization**

On synchronization, the runtime SHALL:

* compare authoritative versions;  
* detect conflicts;  
* apply safe idempotent Commands;  
* open reconciliation where semantic conflicts exist.

## **55.3 Offline Events**

Locally created Events SHALL identify their offline origin and synchronization status.

## **55.4 Conflict**

A semantic conflict SHALL not be silently resolved by timestamp.

---

# **56\. Runtime Conformance Requirements**

A runtime profile is JEM-conformant only if it supports:

1. semantic Commands;  
2. explicit authority evaluation;  
3. Aggregate consistency boundaries;  
4. optimistic concurrency or a stronger documented equivalent;  
5. atomic state-and-Event commit;  
6. idempotent Command handling;  
7. immutable Event history;  
8. durable Process Instances;  
9. asynchronous human and external waiting;  
10. attributable Agent Execution;  
11. Validator execution with explicit outcomes;  
12. projection consistency disclosure;  
13. reconciliation;  
14. tactic change;  
15. escalation;  
16. provenance;  
17. computational and cognitive observability;  
18. semantic model versioning;  
19. safe replay or equivalent reconstruction;  
20. professional error contracts.

---

# **57\. Reference Command Result**

commandId  
status  
acceptedAt  
aggregateId  
priorVersion  
newVersion  
emittedEventIds  
resultEntityIds  
validationResults  
attentionItemIds  
processIds  
projectionRefreshHints  
professionalMessage

## **57.1 Command Status**

accepted  
rejected  
duplicate  
pending\_async\_validation  
requires\_approval  
conflicted

---

# **58\. Reference Process Result**

processId  
processType  
status  
currentStep  
waitingFor  
nextEligibleAction  
deadline  
outputEntityIds  
attentionItemIds  
failure

---

# **59\. JSDL-to-JEM Binding**

Generated JSDL artifacts SHALL provide JEM with:

* Command definitions;  
* Event definitions;  
* lifecycle transitions;  
* invariant expressions;  
* Validator contracts;  
* permission rules;  
* Aggregate definitions;  
* projection metadata;  
* observability metadata;  
* semantic version information.

The runtime SHALL not duplicate these definitions manually unless implementing a generated interface.

---

# **60\. Runtime Service Boundaries**

A runtime profile MAY implement the following logical services:

Command Service  
Authority Service  
Aggregate Repository  
Event Store  
Process Coordinator  
RPH Service  
Agent Execution Service  
Validator Service  
Projection Service  
Reconciliation Service  
Attention Service  
Artifact Service  
Integration Service  
Audit Service  
Observability Service

These are logical responsibilities.

They need not be separately deployed services.

---

# **61\. Single-Process and Distributed Equivalence**

A single-process runtime and a distributed runtime are semantically equivalent when they preserve:

* transaction boundaries;  
* Command order per Aggregate;  
* Event immutability;  
* Process durability;  
* idempotency;  
* authority;  
* validation;  
* projection disclosure;  
* reconciliation.

Deployment topology SHALL not change professional meaning.

---

# **62\. Failure Recovery**

After runtime restart, the system SHALL recover:

* committed Aggregate state;  
* committed Events;  
* pending Process Instances;  
* scheduled timers;  
* pending external operations;  
* projection checkpoints;  
* idempotency records;  
* Agent Execution status.

In-memory-only state SHALL not be required for professional correctness.

---

# **63\. Exactly-Once Semantics**

JEM does not require globally exactly-once message delivery.

It requires effectively-once professional state transitions through:

* Command idempotency;  
* Aggregate versioning;  
* atomic Event persistence;  
* idempotent consumers;  
* deduplicated external-operation handling.

---

# **64\. Backpressure**

A runtime SHALL protect itself from unbounded:

* Command ingestion;  
* Agent execution;  
* projection lag;  
* external callbacks;  
* reconciliation storms;  
* recursive decomposition;  
* Event publication backlog.

Backpressure SHALL be observable and MAY create operational Attention Items.

---

# **65\. Recursive Expansion Limits**

RPH recursion and PWU decomposition SHALL be governed by policy.

Possible limits include:

maximumDepth  
maximumActiveChildren  
maximumTotalDescendants  
maximumConcurrentAgents  
maximumCost  
maximumElapsedTime  
maximumContextSize

Reaching a limit SHALL trigger:

* synthesis;  
* tactic change;  
* scope revision;  
* escalation;  
* or explicit failure.

It SHALL not silently truncate professional work.

---

# **66\. Cost and Resource Governance**

Agent and external execution MAY be constrained by:

tokenBudget  
computeBudget  
monetaryBudget  
timeBudget  
toolCallBudget  
storageBudget

Budget exhaustion SHALL produce a governed state.

It SHALL not cause the runtime to fabricate completion.

---

# **67\. Professional Safe Stop**

A Process or Agent SHALL support safe stop.

A safe stop SHALL:

* stop initiating new Actions;  
* preserve current state;  
* record partial work;  
* identify unresolved uncertainty;  
* release or retain resources according to policy;  
* produce a restart or escalation recommendation.

---

# **68\. JEM Invariants**

## **JEM-INV-001 — No Authoritative Mutation Without Command**

Material state SHALL not change without a semantic Command or explicitly defined system Command.

## **JEM-INV-002 — Authority at Execution Time**

Authority SHALL be evaluated when the Command executes.

## **JEM-INV-003 — Atomic Commit**

Aggregate state, version, Events, Command result, and idempotency record SHALL commit atomically.

## **JEM-INV-004 — Immutable Events**

Committed Events SHALL not be mutated.

## **JEM-INV-005 — No Silent Concurrency Overwrite**

Stale material Commands SHALL not silently overwrite current state.

## **JEM-INV-006 — Validator Non-Mutation**

Validators SHALL not directly mutate authoritative state.

## **JEM-INV-007 — Explicit Waiting**

Long-running waiting SHALL be durably represented.

## **JEM-INV-008 — AI Proposal Default**

AI output is proposed state unless explicit authority permits otherwise.

## **JEM-INV-009 — Process Durability**

Professional correctness SHALL not depend on in-memory Process state.

## **JEM-INV-010 — Projection Non-Authority**

Projection state SHALL not independently become authoritative.

## **JEM-INV-011 — Reconciliation Through Commands**

Reconciliation changes SHALL use normal semantic Commands.

## **JEM-INV-012 — Technical Success Is Not Professional Completion**

Successful execution SHALL not imply PWU or outcome completion.

## **JEM-INV-013 — Distinct Retry and Tactic Change**

Retry and tactic change SHALL remain distinct.

## **JEM-INV-014 — Explicit Escalation**

Insufficient authority or capability SHALL trigger escalation rather than invented resolution.

## **JEM-INV-015 — Provenance Preservation**

Material state SHALL remain traceable to its origin.

## **JEM-INV-016 — Model Version Traceability**

Authoritative objects and Events SHALL identify their semantic model version.

## **JEM-INV-017 — Replay Safety**

Replay SHALL not repeat external side effects.

## **JEM-INV-018 — Tenant Scope**

All authoritative and derived execution state SHALL be tenant-scoped.

## **JEM-INV-019 — No Hidden Incoherence**

Detected material incoherence SHALL remain visible until disposition.

## **JEM-INV-020 — Durable Attention**

Required professional intervention SHALL be represented by durable Attention state.

---

# **69\. Minimum Conformant Runtime**

A minimum JEM-conformant runtime SHALL implement:

Command handling  
Authority evaluation  
Aggregate repository  
Optimistic concurrency  
Transactional Event persistence  
Idempotency  
Synchronous Validators  
Durable Process state  
Basic RPH coordination  
Agent Execution records  
Projection updates  
Attention Items  
Reconciliation cases  
Audit and provenance  
OpenTelemetry-compatible tracing

It MAY initially omit:

* distributed processing;  
* offline operation;  
* complex model migration;  
* predictive projections;  
* multi-region replication;  
* advanced saga compensation;  
* dynamic runtime plugins.

---

# **70\. Acceptance Scenarios**

## **Scenario A — Accepted Command**

Given:

* a valid `ApproveDecision` Command;  
* current Aggregate version 12;  
* expected version 12;  
* authorized approver;  
* all mandatory Validators pass;

When:

* the Command executes;

Then:

* the Decision state changes;  
* Aggregate version becomes 13;  
* immutable Events are persisted;  
* the Command result is stored;  
* the transaction commits atomically;  
* post-commit Event publication begins;  
* relevant projections update;  
* the caller receives the accepted result.

---

## **Scenario B — Stale Command**

Given:

* current Aggregate version 14;  
* a Command expects version 12;

When:

* the Command executes;

Then:

* authority MAY be evaluated;  
* no mutation occurs;  
* no domain Event is committed;  
* a concurrency error is returned;  
* material changes since version 12 are identified where feasible;  
* the user may refresh or reconcile.

---

## **Scenario C — Duplicate Command**

Given:

* a previously accepted Command with idempotency key K;

When:

* the same Command is submitted again with K;

Then:

* no new mutation occurs;  
* no duplicate Event is committed;  
* the prior Command result is returned.

---

## **Scenario D — Asynchronous Human Review**

Given:

* a proposed Decision requires legal review;

When:

* the approval Process reaches that condition;

Then:

* a durable Process enters waiting state;  
* a legal-review Attention Item is created;  
* the Decision does not become approved;  
* runtime restart does not lose the waiting state;  
* legal response resumes the Process through a semantic Command.

---

## **Scenario E — Agent Tool Failure**

Given:

* an AI Agent is performing research;  
* an external search tool fails transiently;

When:

* retry policy permits another attempt;

Then:

* the tool call is retried idempotently;  
* the Agent Execution remains running or retrying;  
* no professional Claim is fabricated;  
* retry history is observable.

---

## **Scenario F — Repeated No Progress**

Given:

* an Agent has repeated the same tactic;  
* uncertainty has not materially reduced;  
* validation failures repeat;

When:

* the no-progress policy triggers;

Then:

* the RPH enters tactic evaluation;  
* a new tactic is selected or proposed;  
* the tactic change is recorded;  
* blind retry does not continue indefinitely.

---

## **Scenario G — Reconciliation**

Given:

* new Evidence invalidates a critical Assumption supporting an approved Decision;

When:

* the Evidence is accepted;

Then:

* affected entities are identified;  
* a reconciliation case is created;  
* affected Decisions and PWUs are marked for impact assessment;  
* normal Commands apply accepted changes;  
* prior state remains reconstructable.

---

## **Scenario H — External Action Success Without Outcome Success**

Given:

* deployment to production succeeds;  
* health validation fails;

When:

* the deployment Process reports completion;

Then:

* the Action is marked completed;  
* outcome achievement remains unconfirmed;  
* validation failure is recorded;  
* reconciliation or remediation is initiated;  
* the PWU does not automatically complete.

---

## **Scenario I — Runtime Restart**

Given:

* an RPH awaits external Evidence;  
* timers and Attention Items are active;

When:

* the runtime restarts;

Then:

* the RPH state is restored;  
* timers remain scheduled;  
* Attention Items remain available;  
* no work is silently lost or duplicated.

---

# **71\. Runtime Conformance Test Suite**

Every runtime profile SHALL pass tests covering:

Command authorization  
Idempotency  
Optimistic concurrency  
Atomic Event commit  
Event ordering per Aggregate  
Projection lag disclosure  
Durable waiting  
Process recovery  
Agent attribution  
Validator outcomes  
Reconciliation  
Escalation  
Tactic change  
Model version compatibility  
Tenant isolation  
Replay safety

---

# **72\. Initial Implementation Sequence**

The first runtime implementation SHOULD proceed in this order:

## **Phase 1 — Command and Aggregate Core**

Implement:

* generated Command contracts;  
* Command dispatcher;  
* authority interface;  
* Aggregate repository;  
* optimistic concurrency;  
* transaction boundary;  
* Event persistence;  
* idempotency.

## **Phase 2 — Validation and Errors**

Implement:

* generated invariant execution;  
* Validator interface;  
* synchronous Validator pipeline;  
* professional error contract;  
* Command-result persistence.

## **Phase 3 — Projection Pipeline**

Implement:

* outbox;  
* Event dispatcher;  
* projection checkpoints;  
* PWU overview projection;  
* history projection;  
* lag disclosure.

## **Phase 4 — Durable Processes**

Implement:

* Process Instance persistence;  
* waiting and resumption;  
* timers;  
* retry;  
* human Attention Items.

## **Phase 5 — Agent Execution**

Implement:

* Agent Execution records;  
* context projection;  
* tool-call records;  
* proposal conversion;  
* review boundary;  
* resource governance.

## **Phase 6 — RPH Coordination**

Implement:

* RPH lifecycle;  
* planning;  
* allocation;  
* child PWUs;  
* no-progress detection;  
* tactic change;  
* escalation;  
* synthesis.

## **Phase 7 — Reconciliation**

Implement:

* contradiction and trigger detection;  
* reconciliation cases;  
* impact analysis;  
* proposed Commands;  
* partial application;  
* escalation.

---

# **73\. Coding Agent Implementation Contract**

A coding agent implementing a JEM runtime SHALL:

1. Treat generated JSDL contracts as authoritative.  
2. Implement semantic Commands rather than generic CRUD mutation.  
3. Evaluate authority at execution time.  
4. preserve Aggregate versioning.  
5. Commit state and Events atomically.  
6. implement Command idempotency.  
7. keep Validators side-effect free.  
8. represent long-running waiting durably.  
9. distinguish Agent completion from PWU completion.  
10. preserve AI identity, model, context, and tool provenance.  
11. distinguish technical retry from tactic change.  
12. prevent unlimited recursive decomposition.  
13. preserve process state across restart.  
14. disclose projection consistency.  
15. use reconciliation rather than silent conflict resolution.  
16. never treat broker delivery as authoritative commit.  
17. never permit UI state to mutate authoritative state directly.  
18. instrument every material decision boundary.  
19. return professional error explanations.  
20. preserve tenant and organization isolation.  
21. test replay and recovery.  
22. record architecture deviations as explicit Decisions.

---

# **74\. Resulting Runtime Contract**

JEM establishes that Janumi is not simply an application that stores professional records.

It is an execution environment for governed professional cognition.

Within that environment:

* Commands express professional intent;  
* Aggregates preserve local consistency;  
* Events preserve history;  
* Validators evaluate professional sufficiency;  
* Processes coordinate work across time;  
* RPHs coordinate recursive cognition;  
* Agents contribute attributable reasoning;  
* Projections make cognition operable;  
* reconciliation restores coherence;  
* Attention directs human judgment;  
* observability reveals both system execution and professional progress.

This execution contract remains constant whether the runtime is implemented as:

* one process and one PostgreSQL database;  
* several services on a single node;  
* a distributed enterprise platform;  
* an offline field application;  
* a future federated professional network.

---

# **75\. Next Required Artifact**

The next artifact is the **Janumi Single-Node Runtime Profile v0.1**.

It shall realize JEM concretely for the initial Janumi deployment and define:

* PostgreSQL authoritative persistence;  
* transactional outbox;  
* command service;  
* event and projection workers;  
* durable process execution;  
* RPH scheduling;  
* AI Agent execution;  
* OpenSandbox integration;  
* object storage;  
* OpenTelemetry;  
* tenant isolation;  
* backup and recovery;  
* Docker or RKE2 deployment;  
* scaling boundaries;  
* migration path toward a distributed runtime.

\===

# **Janumi Single-Node Runtime Profile**

## **JSRP Specification v0.1**

**Status:** Normative draft  
**Implements:** Janumi Execution Model v0.1  
**Deployment target:** Initial Janumi SaaS and selected enterprise demonstrations  
**Primary audiences:** Platform architects, backend engineers, DevOps engineers, security engineers, coding agents, SREs, agent-runtime developers  
**Reference topology:** One physical or virtual server operating a single-node containerized deployment  
**Reference database:** PostgreSQL  
**Reference deployment modes:** Docker Compose initially; single-node RKE2 as an optional infrastructure profile

---

# **1\. Purpose**

The Janumi Single-Node Runtime Profile, or JSRP, defines the first concrete runtime implementation of the Janumi Execution Model.

It establishes a production-oriented but operationally bounded architecture suitable for:

* early SaaS customers;  
* controlled beta deployments;  
* development and demonstration environments;  
* small professional teams;  
* selected on-premises installations;  
* future migration into a distributed Janumi runtime.

The profile is intentionally designed around one server.

Single-node does not mean:

* single process;  
* single container;  
* single tenant;  
* no isolation;  
* no durable workflows;  
* no operational controls;  
* no future scale path.

It means that authoritative storage, runtime services, agent scheduling, observability, and supporting infrastructure initially reside within one failure domain.

---

# **2\. Profile Objectives**

The single-node runtime SHALL provide:

1. JEM-conformant Command handling;  
2. transactional authoritative persistence;  
3. immutable Event history;  
4. durable Process and RPH execution;  
5. explicit human waiting and resumption;  
6. agent invocation and provenance;  
7. sandboxed execution for generated code and tools;  
8. asynchronous projection updates;  
9. tenant and organization isolation;  
10. operational observability;  
11. backup and recovery;  
12. bounded resource scheduling;  
13. predictable failure behavior;  
14. a clear migration path toward distributed deployment.

---

# **3\. Non-Goals**

JSRP v0.1 does not provide:

* multi-region availability;  
* zero-downtime survival of host failure;  
* globally distributed event processing;  
* unlimited horizontal agent execution;  
* cross-region active-active writes;  
* autonomous disaster recovery to a second site;  
* large-enterprise data-warehouse scale;  
* a general Kubernetes control plane dependency;  
* arbitrary customer-supplied privileged containers;  
* unrestricted workflow or compiler plugin execution.

These capabilities may appear in later runtime profiles.

---

# **4\. Reference Logical Architecture**

Clients  
  │  
  ├── Web Workbench  
  ├── VS Code Extension  
  ├── Mobile Clients  
  ├── Administrative UI  
  └── External Integrations  
          │  
          ▼  
     Edge / Ingress  
          │  
          ▼  
┌─────────────────────────────────────────────────────────────┐  
│                 Janumi Application Runtime                  │  
│                                                             │  
│  ┌──────────────────────┐  ┌─────────────────────────────┐ │  
│  │ API / Command Layer  │  │ Projection Query Layer      │ │  
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │  
│             │                              │                │  
│  ┌──────────▼───────────┐  ┌──────────────▼──────────────┐ │  
│  │ Semantic Runtime     │  │ Projection Workers          │ │  
│  │ \- Authority          │  │ \- PWU views                 │ │  
│  │ \- Aggregate loading  │  │ \- Decision views            │ │  
│  │ \- Validation         │  │ \- Coordination views        │ │  
│  │ \- Command execution  │  │ \- Attention views           │ │  
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │  
│             │                              │                │  
│  ┌──────────▼───────────┐  ┌──────────────▼──────────────┐ │  
│  │ Process Runtime      │  │ Agent Runtime               │ │  
│  │ \- Durable processes  │  │ \- Agent executions          │ │  
│  │ \- RPHs               │  │ \- Tool calls                │ │  
│  │ \- Timers             │  │ \- Context projections       │ │  
│  │ \- Human waits        │  │ \- Validation boundary       │ │  
│  └──────────┬───────────┘  └──────────────┬──────────────┘ │  
│             │                              │                │  
│  ┌──────────▼──────────────────────────────▼──────────────┐ │  
│  │                 Integration Layer                     │ │  
│  │ \- OpenSandbox                                        │ │  
│  │ \- Object storage                                     │ │  
│  │ \- External APIs                                      │ │  
│  │ \- Email / messaging                                  │ │  
│  │ \- Repository integrations                            │ │  
│  └──────────────────────────┬────────────────────────────┘ │  
└─────────────────────────────┼──────────────────────────────┘  
                              │  
                              ▼  
┌─────────────────────────────────────────────────────────────┐  
│                     PostgreSQL                              │  
│                                                             │  
│  Authoritative state │ Events │ Outbox │ Processes          │  
│  Projections         │ Audit  │ Idempotency │ Scheduling    │  
└─────────────────────────────────────────────────────────────┘  
                              │  
                              ▼  
                     Object / Artifact Storage

---

# **5\. Deployment Topology**

The reference deployment SHALL use multiple containers or processes on one host.

## **5.1 Required Logical Components**

reverse\_proxy  
web\_frontend  
api\_runtime  
command\_worker  
process\_worker  
projection\_worker  
agent\_scheduler  
agent\_worker  
sandbox\_control  
postgresql  
object\_storage  
otel\_collector  
metrics\_backend  
log\_backend  
trace\_backend

Several logical roles MAY share one executable during the first implementation.

They SHALL remain separately identifiable in configuration and observability.

## **5.2 Initial Consolidation**

A practical first release MAY combine:

api\_runtime  
command\_worker  
process\_worker  
projection\_worker

into one application binary with independent worker loops.

The architecture SHALL preserve the ability to separate them later.

## **5.3 Host Failure Domain**

All components reside within one host failure domain.

This SHALL be documented in:

* availability claims;  
* customer agreements;  
* recovery objectives;  
* operational runbooks.

---

# **6\. Reference Technology Profile**

The profile recommends:

Host OS: Ubuntu Server or another supported hardened Linux distribution  
Container runtime: Docker Engine or containerd  
Initial orchestration: Docker Compose  
Optional orchestration: Single-node RKE2  
Database: PostgreSQL  
Object storage: S3-compatible local or external service  
Reverse proxy: Traefik or equivalent  
Observability: OpenTelemetry  
Sandbox execution: OpenSandbox using Docker-compatible isolation

These are profile choices, not universal Janumi requirements.

Equivalent technologies MAY be substituted if JEM semantics remain intact.

---

# **7\. PostgreSQL as Authoritative Store**

PostgreSQL SHALL serve as the initial authoritative transactional store.

It SHALL persist:

* Aggregate state;  
* entity versions;  
* semantic relationships;  
* immutable Events;  
* Command results;  
* idempotency records;  
* durable Process state;  
* RPH state;  
* timers;  
* Attention Items;  
* reconciliation cases;  
* audit records;  
* projection checkpoints;  
* selected projection tables;  
* agent execution metadata.

Large Artifacts SHOULD be stored outside PostgreSQL.

---

# **8\. Database Schema Domains**

The database SHOULD use explicit schemas.

janumi\_semantic  
janumi\_runtime  
janumi\_event  
janumi\_projection  
janumi\_audit  
janumi\_integration  
janumi\_admin

## **8.1 `janumi_semantic`**

Contains authoritative professional state.

Examples:

entities  
entity\_versions  
relationships  
relationship\_versions  
pwus  
pwu\_versions  
decisions  
claims  
evidence  
validations  
reconciliations

## **8.2 `janumi_runtime`**

Contains runtime execution state.

Examples:

commands  
command\_results  
idempotency\_records  
process\_instances  
process\_steps  
rph\_instances  
agent\_executions  
agent\_tool\_calls  
timers  
attention\_items  
external\_operations

## **8.3 `janumi_event`**

Contains:

events  
outbox  
consumer\_checkpoints  
dead\_letter\_records

## **8.4 `janumi_projection`**

Contains:

pwu\_overview  
endeavor\_overview  
decision\_projection  
evidence\_projection  
coordination\_projection  
attention\_projection  
projection\_checkpoints

## **8.5 `janumi_audit`**

Contains append-only audit records.

## **8.6 `janumi_integration`**

Contains:

* external system mappings;  
* webhook registrations;  
* synchronization state;  
* credential references;  
* integration execution history.

---

# **9\. Tenant Isolation Model**

The initial SaaS profile SHALL support multiple tenants.

## **9.1 Tenant Key**

Every tenant-scoped table SHALL include:

tenant\_id

Organization-scoped objects SHALL also include:

organization\_id

## **9.2 Database Enforcement**

Tenant isolation SHALL be enforced through at least two layers:

1. application-level scoped repositories;  
2. PostgreSQL Row-Level Security where technically practical.

## **9.3 Connection Context**

Each transaction SHOULD set trusted session-local context:

SET LOCAL janumi.tenant\_id \= '...';  
SET LOCAL janumi.organization\_id \= '...';  
SET LOCAL janumi.participant\_id \= '...';

RLS policies MAY reference this context.

## **9.4 Administrative Access**

Administrative cross-tenant access SHALL use:

* separate roles;  
* explicit elevation;  
* audit logging;  
* limited duration;  
* declared purpose.

## **9.5 No Shared Unscoped Cache**

No runtime cache SHALL mix tenant-scoped objects without including tenant identity in the cache key.

---

# **10\. Authoritative Entity Storage**

The runtime MAY use a hybrid model:

* strongly typed tables for high-value aggregates;  
* generic entity and relationship tables for extensible CPCO state;  
* JSONB for subtype-specific payloads;  
* explicit version tables;  
* generated views.

## **10.1 Core Entity Table**

entity\_id  
tenant\_id  
organization\_id  
entity\_type  
entity\_subtype  
endeavor\_id  
current\_version  
lifecycle\_state  
validity\_state  
created\_by  
created\_at  
updated\_at  
semantic\_model\_version

## **10.2 Entity Version Table**

entity\_id  
version  
payload  
valid\_from  
valid\_until  
recorded\_at  
created\_by  
change\_reason  
source\_command\_id  
source\_event\_id  
semantic\_model\_version

## **10.3 Relationship Table**

relationship\_id  
tenant\_id  
relationship\_type  
source\_entity\_id  
target\_entity\_id  
current\_version  
validity\_state

## **10.4 Relationship Version Table**

Stores temporal relationship properties and provenance.

---

# **11\. Aggregate Repository**

The Aggregate Repository SHALL:

* load authoritative Aggregate state;  
* apply tenant and organization scope;  
* enforce model compatibility;  
* expose current Aggregate version;  
* participate in database transactions;  
* persist accepted state transitions;  
* prevent direct generic mutation from callers.

## **11.1 Repository Interface**

load(aggregateType, aggregateId, tenantContext)  
save(aggregate, expectedVersion, emittedEvents, commandResult)  
exists(aggregateType, aggregateId)

## **11.2 No External Save**

Only the semantic Command execution layer SHALL invoke authoritative save operations.

---

# **12\. Command Service**

The Command Service is the authoritative mutation entry point.

## **12.1 Responsibilities**

authenticate  
resolve Participant  
resolve semantic Command definition  
check idempotency  
load Aggregate  
check concurrency  
evaluate authority  
normalize payload  
execute Validators  
apply transition  
persist state and Events  
persist result  
enqueue outbox records  
return professional result

## **12.2 Command API**

The public API SHOULD expose semantic operations.

Examples:

POST /commands/complete-pwu  
POST /commands/propose-decision  
POST /commands/approve-decision  
POST /commands/start-reconciliation  
POST /commands/decompose-pwu

An alternative generic envelope endpoint MAY be provided:

POST /commands

provided semantic Command types remain explicit and generated from JSDL.

## **12.3 Transaction Isolation**

The Command transaction SHOULD use:

READ COMMITTED

with explicit optimistic version checks.

Selected high-contention operations MAY use:

SELECT ... FOR UPDATE

where necessary.

Serializable isolation SHALL not be required globally.

---

# **13\. Command Persistence**

The runtime SHALL persist:

command\_id  
command\_type  
target\_id  
tenant\_id  
requested\_by  
requested\_at  
received\_at  
status  
expected\_version  
payload\_hash  
idempotency\_key  
correlation\_id  
causation\_id  
result  
failure  
completed\_at

## **13.1 Command Status**

received  
validating  
accepted  
rejected  
duplicate  
conflicted  
pending\_async\_validation  
requires\_approval  
failed\_technical

## **13.2 Payload Protection**

Sensitive Command payloads SHOULD be:

* minimized;  
* encrypted where required;  
* excluded from logs;  
* retained according to policy.

---

# **14\. Idempotency Store**

The idempotency table SHALL include:

tenant\_id  
command\_type  
target\_id  
idempotency\_key  
payload\_hash  
command\_id  
result\_status  
result\_reference  
created\_at  
expires\_at

## **14.1 Retention**

Idempotency retention SHALL exceed the longest expected client retry period.

High-impact Commands MAY retain idempotency records indefinitely or according to audit policy.

---

# **15\. Event Store**

The Event Store SHALL use an append-only table.

## **15.1 Event Table**

global\_position  
event\_id  
tenant\_id  
organization\_id  
aggregate\_type  
aggregate\_id  
aggregate\_version  
event\_type  
event\_version  
occurred\_at  
recorded\_at  
actor\_id  
participant\_id  
command\_id  
correlation\_id  
causation\_id  
payload  
provenance  
semantic\_model\_version

## **15.2 Aggregate Uniqueness**

A unique constraint SHALL enforce:

aggregate\_id \+ aggregate\_version

within the relevant tenant scope.

## **15.3 Global Position**

`global_position` MAY use a database-generated monotonic sequence.

It provides a durable processing position.

It SHALL not be interpreted as universal semantic time.

---

# **16\. Transactional Outbox**

The outbox SHALL be written within the same transaction as authoritative state and Events.

## **16.1 Outbox Table**

outbox\_id  
event\_id  
tenant\_id  
topic  
partition\_key  
payload  
created\_at  
published\_at  
attempt\_count  
next\_attempt\_at  
last\_error  
status

## **16.2 Outbox Status**

pending  
publishing  
published  
retrying  
dead\_letter

## **16.3 Initial Publication**

The single-node runtime MAY publish internally without an external broker.

Consumers may poll the outbox or Event table.

The outbox SHALL still exist to preserve migration and delivery semantics.

---

# **17\. Internal Event Dispatch**

JSRP v0.1 MAY use PostgreSQL-based event dispatch.

Options include:

* polling with `FOR UPDATE SKIP LOCKED`;  
* `LISTEN/NOTIFY` as a wake-up signal;  
* periodic checkpoint scans.

`LISTEN/NOTIFY` SHALL not be the authoritative delivery mechanism.

It is only a latency optimization.

## **17.1 Worker Claim Pattern**

Workers SHOULD claim work using:

SELECT ...  
FOR UPDATE SKIP LOCKED  
LIMIT ...

This permits future multiple workers on the same node.

---

# **18\. Projection Workers**

Projection workers SHALL:

1. read committed Events in order;  
2. process each Event idempotently;  
3. update one or more projection tables;  
4. persist a checkpoint;  
5. record failure state;  
6. retry transient failures;  
7. expose lag.

## **18.1 Projection Checkpoint**

projection\_name  
partition\_key  
last\_global\_position  
last\_event\_id  
updated\_at  
status  
last\_error

## **18.2 Projection Idempotency**

Projection updates SHALL be safe if the same Event is delivered more than once.

## **18.3 Projection Rebuild**

A projection MAY be rebuilt by:

* truncating its derived tables;  
* resetting checkpoint;  
* replaying authoritative Events.

---

# **19\. Initial Projection Set**

JSRP v0.1 SHALL implement:

PwuOverviewProjection  
PwuHistoryProjection  
EndeavorOverviewProjection  
DecisionProjection  
EvidenceProjection  
DecompositionProjection  
ReconciliationProjection  
RphCoordinationProjection  
AttentionProjection

## **19.1 Projection API**

Projection queries SHOULD use read-only endpoints or query services.

They SHALL not mutate authoritative state.

---

# **20\. Durable Process Runtime**

The initial runtime SHALL implement durable Process Instances using PostgreSQL.

A dedicated workflow platform MAY be introduced later.

## **20.1 Process Table**

process\_id  
tenant\_id  
process\_type  
process\_version  
status  
current\_step  
state\_payload  
correlation\_id  
causation\_id  
started\_at  
updated\_at  
deadline  
next\_wakeup\_at  
retry\_count  
last\_error  
semantic\_model\_version

## **20.2 Process Step Table**

process\_id  
step\_number  
step\_type  
status  
started\_at  
completed\_at  
input\_references  
output\_references  
failure

## **20.3 Worker Scheduling**

Process workers SHALL claim runnable instances through database leasing.

---

# **21\. Process Lease Model**

lease\_owner  
lease\_acquired\_at  
lease\_expires\_at  
heartbeat\_at

## **21.1 Lease Recovery**

If a worker fails, another worker may reclaim the Process after lease expiration.

## **21.2 Step Idempotency**

Every Process step SHALL be idempotent or possess a durable external-operation record.

---

# **22\. Timer Scheduler**

Timers SHALL be stored in PostgreSQL.

## **22.1 Timer Table**

timer\_id  
tenant\_id  
process\_id  
timer\_type  
due\_at  
status  
payload  
claimed\_by  
claimed\_at  
completed\_at

## **22.2 Scheduler Loop**

The scheduler SHALL:

* claim due timers;  
* emit wake-up Commands or Process signals;  
* mark timers complete;  
* retry transient failures;  
* avoid duplicate semantic transitions through idempotency.

---

# **23\. RPH Runtime**

RPH Instances SHALL be implemented as specialized durable Processes.

## **23.1 RPH Persistence**

rph\_id  
tenant\_id  
professional\_objective  
scope  
authority  
status  
current\_plan\_id  
coordinated\_pwu\_ids  
child\_rph\_ids  
active\_tactics  
synthesis\_state  
escalation\_policy  
resource\_budget  
semantic\_model\_version

## **23.2 RPH Worker Responsibilities**

The RPH worker SHALL:

* inspect coordinated PWU projections;  
* evaluate dependencies;  
* identify required work;  
* issue semantic Command proposals;  
* allocate Participants and Agents;  
* monitor professional progress;  
* detect no-progress conditions;  
* trigger tactic change;  
* create Attention Items;  
* initiate synthesis;  
* escalate when necessary.

## **23.3 No Direct Domain Mutation**

RPH workers SHALL issue Commands.

They SHALL not write PWU or Decision tables directly.

---

# **24\. RPH Evaluation Cycle**

A reference evaluation cycle:

Load RPH State  
  ↓  
Load Coordination Projection  
  ↓  
Evaluate Objective and Current Plan  
  ↓  
Detect Material Changes  
  ↓  
Evaluate Progress and Blockages  
  ↓  
Evaluate Validation and Reconciliation Needs  
  ↓  
Evaluate Tactic Health  
  ↓  
Select Governed Next Actions  
  ↓  
Issue Commands or Create Attention  
  ↓  
Persist RPH Step  
  ↓  
Schedule Next Evaluation

## **24.1 Trigger Sources**

RPH evaluation may be triggered by:

* relevant Event;  
* timer;  
* human Command;  
* child RPH Event;  
* Agent Execution result;  
* projection catch-up;  
* external callback.

---

# **25\. Agent Scheduler**

The Agent Scheduler allocates AI work according to:

priority  
tenant quota  
professional urgency  
agent capability  
model availability  
tool requirements  
GPU requirement  
cost budget  
concurrency limit  
sandbox need

## **25.1 Agent Queue**

The initial implementation MAY use a PostgreSQL queue.

agent\_execution\_id  
tenant\_id  
priority  
required\_capabilities  
resource\_class  
status  
available\_at  
claimed\_by  
lease\_expires\_at

## **25.2 Fairness**

The scheduler SHALL prevent one tenant or endeavor from consuming all agent capacity.

A reference policy MAY use:

* weighted fair scheduling;  
* per-tenant concurrency limits;  
* priority classes;  
* reserved critical capacity.

---

# **26\. Agent Worker**

The Agent Worker SHALL:

1. claim an Agent Execution;  
2. load the generated agent contract;  
3. construct a bounded context projection;  
4. enforce tool permissions;  
5. invoke the selected model;  
6. record tool calls;  
7. persist outputs as proposals;  
8. invoke required Validators;  
9. emit completion or failure Events;  
10. release resources.

## **26.1 Context Assembly**

Context SHALL be derived from authoritative projections.

It SHALL not be assembled from arbitrary ungoverned database queries.

## **26.2 Context Limits**

When context exceeds model or policy limits, the runtime SHALL:

* narrow by professional purpose;  
* summarize with provenance;  
* retrieve selectively;  
* decompose work;  
* or escalate.

It SHALL not silently omit material Constraints.

---

# **27\. Model Gateway**

A logical Model Gateway SHOULD abstract local and external model providers.

## **27.1 Responsibilities**

provider selection  
authentication  
request shaping  
rate limiting  
cost tracking  
timeout  
retry  
response normalization  
model provenance  
policy enforcement

## **27.2 Model Identity**

Every invocation SHALL persist:

provider  
model\_name  
model\_version\_or\_snapshot  
parameters  
started\_at  
completed\_at  
usage  
cost

## **27.3 Provider Failure**

Provider failure SHALL be classified separately from professional failure.

---

# **28\. OpenSandbox Integration**

OpenSandbox SHALL provide isolated execution for:

* generated code;  
* build commands;  
* tests;  
* repository operations;  
* analysis tools;  
* controlled browser or CLI automation;  
* temporary development environments.

## **28.1 Sandbox Control Boundary**

The Janumi runtime SHALL communicate with OpenSandbox through an explicit sandbox-control integration.

The main API process SHALL not directly launch arbitrary customer processes.

## **28.2 Sandbox Request**

sandbox\_request\_id  
tenant\_id  
agent\_execution\_id  
pwu\_id  
image\_or\_template  
resource\_limits  
network\_policy  
filesystem\_policy  
environment\_references  
command  
timeout  
artifact\_policy

## **28.3 Sandbox Result**

sandbox\_id  
status  
exit\_code  
stdout\_reference  
stderr\_reference  
artifact\_references  
resource\_usage  
started\_at  
completed\_at  
failure\_class

## **28.4 Isolation**

Each sandbox execution SHALL define:

* CPU limit;  
* memory limit;  
* storage limit;  
* execution deadline;  
* process limit;  
* network policy;  
* mounted workspace;  
* secret access;  
* cleanup policy.

## **28.5 Network Default**

Sandbox network access SHOULD default to denied or restricted.

Permitted destinations SHALL be allowlisted by policy.

## **28.6 Privilege**

Privileged containers SHALL be prohibited by default.

Host socket mounting SHALL be prohibited.

## **28.7 Artifact Extraction**

Only declared output paths SHALL be extracted.

Extracted files SHALL be treated as untrusted Artifacts until scanned and validated.

---

# **29\. Sandbox Storage**

Sandbox filesystems SHALL be ephemeral.

Persistent outputs SHALL be copied to:

* object storage;  
* repository integration;  
* governed Artifact storage.

## **29.1 Workspace Isolation**

Tenant and PWU workspaces SHALL use distinct paths and authorization.

## **29.2 Cleanup**

Expired sandboxes SHALL be terminated and deleted.

Cleanup failure SHALL be observable.

---

# **30\. Repository Integration**

Source repositories MAY be external authoritative systems.

The runtime SHALL store:

repository\_id  
provider  
tenant\_id  
external\_reference  
default\_branch  
credential\_reference  
sync\_policy  
last\_observed\_commit

## **30.1 Repository Operations**

Repository changes SHALL be tied to:

* PWU;  
* Decision;  
* Agent Execution;  
* Command;  
* provenance.

## **30.2 Git Commit**

A commit is an Artifact and Observation of implementation state.

It SHALL not automatically prove:

* requirement satisfaction;  
* validation success;  
* PWU completion.

---

# **31\. Object Storage**

Large binary and document Artifacts SHOULD use S3-compatible storage.

## **31.1 Artifact Metadata**

PostgreSQL SHALL retain authoritative metadata:

artifact\_id  
tenant\_id  
object\_key  
content\_hash  
content\_type  
size  
created\_by  
created\_at  
source\_context  
malware\_scan\_status  
retention\_policy  
encryption\_status

## **31.2 Object Key Isolation**

Object keys SHALL include opaque tenant-scoped prefixes.

Tenant names and sensitive metadata SHOULD not be directly exposed in object paths.

## **31.3 Integrity**

Artifacts SHALL use cryptographic content hashes.

---

# **32\. Artifact Security**

Uploaded or generated Artifacts SHALL be scanned where appropriate.

Potential controls:

* malware scanning;  
* content-type verification;  
* archive expansion limits;  
* document sanitization;  
* executable-file policy;  
* PII and sensitive-data classification.

An Artifact SHALL not be trusted solely because an AI Agent generated it.

---

# **33\. Attention Service**

The Attention Service SHALL maintain durable professional intervention state.

## **33.1 Attention Table**

attention\_id  
tenant\_id  
attention\_type  
professional\_context  
required\_role  
required\_authority  
priority  
status  
created\_at  
due\_at  
assigned\_to  
disposition  
resolved\_at

## **33.2 Notifications**

Email, push, or chat notifications MAY be emitted from Attention Items.

Notification delivery SHALL not replace durable Attention state.

---

# **34\. Reconciliation Service**

The Reconciliation Service SHALL:

* open cases;  
* load affected semantic state;  
* calculate impact;  
* assemble before-and-after projections;  
* coordinate review;  
* issue accepted Commands;  
* track partial application;  
* preserve prior state;  
* escalate unresolved conflicts.

## **34.1 Initial Detection**

JSRP v0.1 MAY detect reconciliation needs from:

* explicit contradiction Events;  
* invalidated assumptions;  
* failed validations;  
* changed Intent;  
* stale dependency state;  
* cross-PWU mismatch;  
* manual request.

Advanced inference may follow later.

---

# **35\. Authority Service**

The Authority Service SHALL evaluate generated JSDL permission definitions plus runtime policy.

## **35.1 Inputs**

principal  
participant  
roles  
delegations  
tenant  
organization  
target  
command  
currentState  
policy  
time

## **35.2 Caching**

Authority results MAY be cached only for short-lived read operations.

State-changing Commands SHALL re-evaluate authority.

## **35.3 Policy Store**

Organization and PWA policies SHALL be versioned and auditable.

---

# **36\. Validation Service**

The Validation Service SHALL execute:

* generated structural Validators;  
* invariant expressions;  
* policy Validators;  
* domain Validators;  
* external Validators;  
* AI-assisted Validators;  
* human-validation Processes.

## **36.1 Validator Registry**

Validators SHALL be registered by:

validator\_id  
validator\_version  
validator\_type  
implementation  
input\_contract  
output\_contract  
timeout  
failure\_policy

## **36.2 Safe Failure**

Validator unavailability SHALL result in:

* fail;  
* inconclusive;  
* retry;  
* or escalation,

according to declared policy.

It SHALL not default silently to pass.

---

# **37\. API Layer**

The API Layer SHALL expose:

* semantic Command submission;  
* projection queries;  
* entity inspection;  
* history;  
* Attention disposition;  
* Process state;  
* integration callbacks;  
* administrative operations.

## **37.1 API Separation**

State-changing and read-only operations SHOULD be logically separated.

## **37.2 Generated Contracts**

Command and Event payloads SHALL be generated from JSDL.

## **37.3 Error Responses**

API failures SHALL contain:

errorCode  
category  
professionalMessage  
technicalReference  
retryable  
currentVersion  
recommendedDisposition  
correlationId

---

# **38\. Authentication**

The runtime MAY integrate with:

* OIDC;  
* SAML through an identity broker;  
* enterprise identity providers;  
* service accounts;  
* API keys for limited integrations;  
* workload identity.

## **38.1 Session Management**

Interactive clients SHOULD use short-lived tokens and secure server-managed sessions where appropriate.

## **38.2 Service Identity**

Every worker and service SHALL possess a distinct workload identity or logical service identity.

---

# **39\. Secrets Management**

Secrets SHALL not be stored in:

* JSDL source;  
* Event payloads;  
* logs;  
* projection tables;  
* Agent prompts;  
* source repositories.

## **39.1 Initial Profile**

The initial deployment MAY use:

* container secrets;  
* encrypted environment files;  
* a local secrets manager.

Production use SHOULD prefer a dedicated secrets service or encrypted secret store.

## **39.2 Secret References**

Domain and runtime records SHALL store secret references, not secret values.

---

# **40\. OpenTelemetry**

All runtime components SHALL emit OpenTelemetry-compatible:

* traces;  
* metrics;  
* logs.

## **40.1 Required Trace Attributes**

tenant.id  
organization.id  
endeavor.id  
pwu.id  
rph.id  
command.id  
command.type  
aggregate.id  
aggregate.version  
event.id  
process.id  
agent\_execution.id  
participant.id  
correlation.id  
causation.id  
semantic\_model.version

Sensitive values SHALL not be included.

## **40.2 Trace Boundaries**

Required spans include:

http.request  
command.execute  
authority.evaluate  
aggregate.load  
validator.execute  
transaction.commit  
outbox.publish  
projection.apply  
process.step  
rph.evaluate  
agent.execute  
tool.call  
sandbox.execute  
reconciliation.apply

---

# **41\. Metrics**

## **41.1 Runtime Metrics**

command\_requests\_total  
command\_rejections\_total  
command\_latency\_seconds  
concurrency\_conflicts\_total  
validator\_failures\_total  
event\_outbox\_lag\_seconds  
projection\_lag\_events  
process\_wait\_seconds  
agent\_queue\_depth  
agent\_execution\_seconds  
sandbox\_active\_count  
sandbox\_failure\_total  
database\_connection\_usage

## **41.2 Cognitive Metrics**

open\_uncertainty\_count  
unsupported\_claim\_count  
critical\_assumption\_count  
decision\_wait\_seconds  
validation\_backlog  
reconciliation\_backlog  
blocked\_pwu\_count  
tactic\_change\_count  
escalation\_count  
synthesis\_pending\_count  
human\_attention\_backlog

## **41.3 Metric Scope**

Metrics SHALL be tenant-safe.

Cross-tenant administrative metrics SHALL avoid exposing sensitive semantic content.

---

# **42\. Logging**

Logs SHALL be structured.

## **42.1 Required Fields**

timestamp  
severity  
service  
instance  
message  
correlation\_id  
tenant\_id\_hash  
command\_id  
process\_id  
agent\_execution\_id  
error\_code

## **42.2 Log Prohibitions**

Logs SHALL not contain:

* secrets;  
* raw access tokens;  
* full prompts by default;  
* protected Evidence content;  
* unrestricted user documents;  
* database passwords;  
* sandbox secret values.

---

# **43\. Health Model**

Each component SHALL expose:

liveness  
readiness  
startup  
dependency\_status

## **43.1 Liveness**

Indicates the process can continue operating.

## **43.2 Readiness**

Indicates the component can safely accept work.

A process worker SHOULD become unready when it cannot access PostgreSQL.

## **43.3 Degraded State**

The overall runtime MAY operate in degraded mode when:

* projection workers lag;  
* external model provider is unavailable;  
* sandbox service is unavailable;  
* object storage is degraded.

Degradation SHALL be visible and capability-specific.

---

# **44\. Resource Scheduling**

The single host SHALL enforce resource boundaries.

## **44.1 Resource Classes**

api  
database  
projection  
process  
agent\_cpu  
agent\_gpu  
sandbox\_small  
sandbox\_medium  
sandbox\_large  
observability

## **44.2 Reservations**

PostgreSQL and core runtime services SHALL retain reserved capacity.

Sandbox and Agent workloads SHALL not exhaust resources needed for authoritative Command processing.

## **44.3 Admission Control**

The scheduler SHALL reject or queue work when capacity is insufficient.

It SHALL not overcommit without policy.

---

# **45\. GPU Scheduling**

Where the host includes one GPU, GPU access SHALL be centrally scheduled.

## **45.1 Default Policy**

Only one high-memory model workload SHOULD control the GPU at a time unless validated sharing is configured.

## **45.2 GPU Job Record**

job\_id  
agent\_execution\_id  
model  
estimated\_memory  
priority  
status  
started\_at  
completed\_at

## **45.3 CPU Fallback**

A CPU fallback SHALL be explicit.

It SHALL not silently change performance or quality assumptions.

---

# **46\. Backpressure**

Backpressure thresholds SHALL exist for:

* Command queue;  
* outbox;  
* projection lag;  
* Process queue;  
* Agent queue;  
* sandbox capacity;  
* database connections;  
* object storage;  
* observability pipeline.

## **46.1 Response**

Backpressure may trigger:

* admission rejection;  
* delayed availability;  
* lower-priority deferral;  
* tenant throttling;  
* Attention Item;  
* operational alert.

## **46.2 Professional Priority**

Safety-, security-, legal-, or incident-related work MAY receive reserved priority.

---

# **47\. Failure Isolation**

Even on one node, logical failure isolation SHALL be maintained.

Examples:

* projection failure does not prevent authoritative Command execution unless the Command depends on current projection state;  
* Agent worker failure does not corrupt Process state;  
* sandbox failure does not crash the API process;  
* observability backend failure does not block core transactions;  
* external provider failure does not erase queued work.

---

# **48\. Restart and Recovery**

After process restart, the runtime SHALL recover:

* accepted Commands;  
* Event history;  
* pending outbox messages;  
* Process Instances;  
* leases;  
* timers;  
* Agent Executions;  
* external operations;  
* projection checkpoints;  
* Attention Items;  
* reconciliation cases.

## **48.1 Lease Expiration**

Abandoned leases SHALL become reclaimable.

## **48.2 Unknown External Outcome**

If a worker crashes after invoking an external operation but before recording the result, recovery SHALL inspect the external-operation record and use idempotency or status inquiry.

It SHALL not blindly repeat a potentially non-idempotent Action.

---

# **49\. Backup Architecture**

The single-node profile SHALL implement:

* PostgreSQL backups;  
* write-ahead-log archiving or equivalent;  
* object-storage backup;  
* configuration backup;  
* JSDL source and generated artifact backup;  
* secrets backup under separate protection;  
* restore testing.

## **49.1 Recovery Objectives**

Initial targets SHOULD be declared explicitly.

Example profile:

RPO: 15 minutes  
RTO: 4 hours

Production commitments SHALL reflect actual tested capability.

## **49.2 Backup Isolation**

Backups SHALL not exist only on the same physical disk or host.

## **49.3 Restore Testing**

Restores SHALL be tested regularly.

A backup that has not been restored is not considered verified.

---

# **50\. PostgreSQL Recovery**

Recommended controls:

* periodic full backup;  
* WAL archiving;  
* checksums;  
* automated backup verification;  
* documented point-in-time recovery;  
* role and privilege backup;  
* migration history retention.

## **50.1 Event Integrity**

Restore verification SHALL confirm:

* Aggregate versions align with Events;  
* outbox state is valid;  
* projection checkpoints do not exceed restored Event position;  
* idempotency records remain consistent.

---

# **51\. Projection Recovery**

After database recovery:

* derived projections MAY be rebuilt;  
* checkpoints SHALL be reset if inconsistent;  
* authoritative state and Events take precedence.

Projection tables SHOULD not determine recovery correctness.

---

# **52\. Disaster Recovery Limitation**

Single-node JSRP cannot remain available during total host failure.

The profile SHALL therefore rely on:

* infrastructure replacement;  
* data restoration;  
* configuration reapplication;  
* service restart;  
* projection rebuild.

This limitation SHALL be explicit.

---

# **53\. Security Hardening**

The host SHALL follow a hardened baseline.

Controls SHOULD include:

* minimal installed packages;  
* disabled password SSH authentication;  
* key-based administrative access;  
* host firewall;  
* automatic security updates under controlled policy;  
* restricted administrative users;  
* audit logging;  
* encrypted storage where required;  
* time synchronization;  
* secure boot where supported;  
* container isolation;  
* image scanning;  
* dependency scanning.

---

# **54\. Network Zones**

A reference host SHOULD separate logical networks:

edge  
application  
data  
sandbox  
observability  
management

Docker or container network policies SHALL restrict unnecessary communication.

## **54.1 PostgreSQL**

PostgreSQL SHALL not be exposed publicly.

## **54.2 Sandbox**

Sandbox workloads SHALL not freely access the data network.

## **54.3 Management**

Administrative interfaces SHALL be restricted.

---

# **55\. Ingress**

The reverse proxy SHALL provide:

* TLS termination or passthrough;  
* routing;  
* request limits;  
* security headers;  
* access logging;  
* optional rate limiting;  
* WebSocket support where required.

Direct public access to internal runtime ports SHALL be prohibited.

---

# **56\. Egress**

Application and Agent egress SHOULD be policy-controlled.

## **56.1 External Model Providers**

Only approved providers and endpoints SHALL be permitted.

## **56.2 Sandbox Egress**

Sandbox egress SHALL use a stricter policy than application egress.

## **56.3 Audit**

Sensitive external data transfers SHOULD be auditable.

---

# **57\. Container Image Policy**

Production images SHALL:

* use pinned versions or digests;  
* run as non-root where practical;  
* contain minimal tools;  
* avoid embedded secrets;  
* be scanned;  
* expose declared ports only;  
* use read-only root filesystems where possible;  
* define resource limits;  
* define health checks.

---

# **58\. Database Roles**

Separate PostgreSQL roles SHOULD exist for:

migration  
runtime\_command  
runtime\_projection  
runtime\_process  
runtime\_audit  
read\_only\_admin  
backup

## **58.1 Least Privilege**

Projection workers SHALL not possess authority to mutate authoritative semantic tables.

## **58.2 Migration Role**

Schema migration authority SHALL not be granted to normal runtime workers.

---

# **59\. Schema Migration**

Migrations SHALL be generated or informed by JSDL model changes.

## **59.1 Migration Phases**

expand  
migrate  
dual-read or dual-write if required  
validate  
contract

## **59.2 Destructive Changes**

Destructive migrations SHALL require:

* explicit review;  
* backup;  
* compatibility analysis;  
* rollback or recovery plan;  
* semantic migration assessment.

---

# **60\. Semantic Model Deployment**

Each runtime release SHALL bundle:

* JSDL source version;  
* canonical IR fingerprint;  
* generated contract version;  
* migration version;  
* runtime compatibility declaration.

## **60.1 Startup Validation**

At startup, the runtime SHALL verify that:

* database semantic model version is supported;  
* generated contracts match expected fingerprint;  
* required migrations are applied;  
* projection schemas are compatible;  
* runtime profile version is declared.

---

# **61\. Development Environment**

The development profile SHOULD use the same semantic architecture with reduced operational complexity.

It MAY use:

* Docker Compose;  
* local PostgreSQL;  
* local object storage;  
* simplified observability;  
* local model provider;  
* local OpenSandbox.

It SHALL not replace semantic Commands with direct database mutation merely for convenience.

---

# **62\. Test Environment**

The test runtime SHALL support:

* deterministic clocks;  
* fake external providers;  
* in-memory or isolated PostgreSQL schemas;  
* Process fast-forwarding;  
* timer control;  
* Event inspection;  
* projection rebuild;  
* sandbox stubs;  
* model-provider stubs;  
* failure injection.

## **62.1 Transactional Test Isolation**

Tests SHOULD use isolated tenants, schemas, or databases.

---

# **63\. Operational Administration**

Administrative capabilities SHOULD include:

inspect Command  
inspect Event  
inspect Aggregate  
inspect Process  
retry outbox  
rebuild projection  
resume Process  
cancel Process  
inspect lease  
inspect Agent Execution  
inspect sandbox  
open reconciliation  
restore dead-letter item

Administrative actions SHALL be audited.

## **63.1 No Direct Semantic Editing**

Administrators SHALL not directly edit authoritative professional rows through generic database tools as a normal operational procedure.

Corrections SHOULD use Commands or governed migration utilities.

---

# **64\. Dead-Letter Handling**

Failures that exceed retry policy SHALL enter a dead-letter state.

## **64.1 Dead-Letter Categories**

event\_publication  
projection\_processing  
external\_callback  
external\_operation  
agent\_tool  
process\_step  
notification

## **64.2 Dead-Letter Record**

item\_id  
item\_type  
original\_reference  
failure  
attempts  
first\_failed\_at  
last\_failed\_at  
recommended\_action  
status

## **64.3 Resolution**

Resolution MAY:

* retry;  
* skip with authorization;  
* repair data;  
* open reconciliation;  
* escalate;  
* mark irrecoverable.

---

# **65\. Audit Model**

Audit SHALL capture:

* authentication events;  
* authority changes;  
* Command acceptance and rejection;  
* administrative actions;  
* protected Evidence access;  
* secret-reference use;  
* model-provider invocation;  
* sandbox execution;  
* semantic model deployment;  
* backup and restore;  
* exception grants.

Audit records SHALL be append-only or tamper-evident.

---

# **66\. Retention**

Retention policies SHALL distinguish:

Events  
Commands  
Audit  
Projection Data  
Agent Prompts  
Agent Outputs  
Artifacts  
Sandbox Logs  
Operational Logs  
Traces  
Metrics  
Backups

## **66.1 Semantic History**

Material professional Events and Decisions SHOULD retain long-term according to organizational and regulatory requirements.

## **66.2 Projection Data**

Derived projection data MAY be deleted and rebuilt.

## **66.3 Agent Context**

Full Agent context MAY require shorter retention than resulting professional entities.

---

# **67\. Privacy and Sensitive Data**

The runtime SHALL support classification of:

* personal data;  
* sensitive professional Evidence;  
* regulated information;  
* proprietary source code;  
* legal material;  
* health information;  
* export-controlled information.

## **67.1 Context Minimization**

Agent context SHALL include only the information required for the assigned objective.

## **67.2 Provider Policy**

External model providers SHALL receive data only where policy permits.

---

# **68\. Scaling Within the Single Node**

The profile MAY scale vertically through:

* more CPU;  
* more memory;  
* faster storage;  
* more database connections within safe limits;  
* separate worker processes;  
* worker concurrency;  
* one or more GPUs.

## **68.1 Scale Boundaries**

The runtime SHALL monitor when:

* PostgreSQL saturation;  
* disk I/O;  
* projection lag;  
* Agent queue depth;  
* sandbox contention;  
* memory pressure;  
* GPU queue;  
* backup duration

approach unacceptable thresholds.

---

# **69\. Migration Triggers to Distributed Runtime**

A distributed runtime SHOULD be considered when one or more conditions become persistent:

host availability no longer meets business requirements  
database workload exceeds safe vertical scaling  
agent and sandbox workloads interfere with core services  
projection lag becomes operationally unacceptable  
tenant isolation requires dedicated compute  
GPU demand exceeds single-host scheduling  
backup and restore windows become excessive  
enterprise customers require separate execution domains  
regulatory constraints require workload separation

---

# **70\. Distribution Preparation**

JSRP SHALL prepare for future distribution by preserving:

* explicit service boundaries;  
* generated contracts;  
* outbox Events;  
* idempotency;  
* Process durability;  
* worker leases;  
* partitionable queues;  
* projection checkpoints;  
* tenant-scoped data;  
* external object storage abstraction.

The first implementation SHALL avoid:

* in-process-only correctness;  
* unversioned internal message payloads;  
* hidden shared memory state;  
* cross-component direct table mutation;  
* non-idempotent worker assumptions.

---

# **71\. Initial Distributed Extraction Order**

When scaling beyond one node, the recommended extraction order is:

1. sandbox execution;  
2. Agent workers;  
3. projection workers;  
4. Process and RPH workers;  
5. object storage;  
6. observability stack;  
7. read-only projection service;  
8. Command service;  
9. PostgreSQL high availability or managed database.

Authoritative semantics SHALL remain unchanged.

---

# **72\. Docker Compose Profile**

The first deployment MAY use Docker Compose.

## **72.1 Required Volumes**

postgres\_data  
object\_storage\_data  
otel\_data  
metrics\_data  
logs\_data  
traces\_data  
sandbox\_workspace

## **72.2 Restart Policies**

Core services SHOULD use appropriate restart policies.

Process durability SHALL not depend on container persistence.

## **72.3 Resource Limits**

Compose configuration SHALL define limits or reservations for high-risk workloads.

---

# **73\. Single-Node RKE2 Profile**

RKE2 MAY be used when Kubernetes-compatible operations are desired.

## **73.1 Appropriate Reasons**

* future migration to multi-node Kubernetes;  
* standardized deployment manifests;  
* workload resource controls;  
* secret and configuration management;  
* service isolation;  
* customer operational requirements.

## **73.2 Inappropriate Assumption**

Single-node RKE2 does not provide host-level high availability.

It SHALL not be presented as an HA deployment merely because Kubernetes is present.

## **73.3 Persistent Storage**

Persistent volumes SHALL map to reliable host or external storage.

## **73.4 Control Plane Protection**

The RKE2 control plane and PostgreSQL SHALL have reserved resources.

Sandbox workloads SHALL not starve them.

---

# **74\. Reference Service Deployment**

A minimal deployment MAY use:

janumi-web  
janumi-runtime  
janumi-worker  
janumi-agent-worker  
janumi-sandbox-controller  
postgres  
object-store  
otel-collector  
prometheus-compatible-metrics  
loki-compatible-logs  
tempo-compatible-traces  
traefik

The specific products behind metrics, logs, and traces MAY vary.

---

# **75\. Availability Model**

JSRP SHALL declare availability by capability.

Example:

Authoritative Commands: available when API and PostgreSQL are healthy  
Projection Queries: may be degraded during projection failure  
Agent Execution: may be unavailable while core Commands continue  
Sandbox Execution: may be unavailable while review and Decisions continue  
External Integrations: capability-specific

This is preferable to one binary “system up” indicator.

---

# **76\. Graceful Degradation**

Examples:

## **76.1 Model Provider Unavailable**

The runtime SHALL:

* queue or fail Agent work;  
* preserve PWU state;  
* permit human work;  
* expose degraded AI capability.

## **76.2 Sandbox Unavailable**

The runtime SHALL:

* stop new sandbox Actions;  
* preserve existing professional state;  
* permit planning, review, and Decision activity.

## **76.3 Projection Worker Failed**

The runtime SHALL:

* mark projections stale;  
* continue authoritative Commands where safe;  
* prevent unsafe Commands from stale views;  
* alert operations.

## **76.4 Observability Backend Failed**

The runtime SHALL continue core semantic transactions where safe and buffer or degrade telemetry.

---

# **77\. Operational Runbooks**

At minimum, runbooks SHALL exist for:

PostgreSQL unavailable  
projection lag  
outbox backlog  
Process stuck  
lease recovery  
Agent queue saturation  
sandbox cleanup failure  
object storage failure  
backup failure  
restore  
semantic model migration failure  
RLS policy failure  
disk capacity exhaustion  
certificate renewal  
external model outage

---

# **78\. JSRP Invariants**

## **JSRP-INV-001 — PostgreSQL Authority**

PostgreSQL authoritative tables and committed Events constitute runtime truth.

## **JSRP-INV-002 — Outbox Atomicity**

Outbox records SHALL commit atomically with authoritative state and Events.

## **JSRP-INV-003 — Projection Derivation**

Projection tables SHALL remain rebuildable.

## **JSRP-INV-004 — Durable Processes**

Process and RPH correctness SHALL survive process restart.

## **JSRP-INV-005 — Worker Idempotency**

Workers SHALL tolerate duplicate delivery or lease recovery.

## **JSRP-INV-006 — Tenant Scope**

Every authoritative and runtime record SHALL be tenant-scoped.

## **JSRP-INV-007 — Sandbox Isolation**

Sandbox workloads SHALL not possess direct database or host control access.

## **JSRP-INV-008 — Core Resource Protection**

Agent and sandbox workloads SHALL not exhaust resources required for Command processing and PostgreSQL.

## **JSRP-INV-009 — Observable Degradation**

Capability degradation SHALL be visible.

## **JSRP-INV-010 — Off-Host Backup**

Recoverable backups SHALL exist outside the runtime host.

## **JSRP-INV-011 — Generated Contract Consistency**

Runtime contracts SHALL match the deployed JSDL model fingerprint.

## **JSRP-INV-012 — No Direct Projection Mutation**

Projection workers SHALL not mutate authoritative semantic state.

## **JSRP-INV-013 — No Hidden External Completion**

External operation success SHALL not imply professional completion.

## **JSRP-INV-014 — Administrative Audit**

Administrative recovery and override actions SHALL be audited.

## **JSRP-INV-015 — Explicit Single-Node Limitation**

The deployment SHALL not claim host-failure high availability.

---

# **79\. Acceptance Scenarios**

## **Scenario A — Command and Event Commit**

Given:

* an authorized Command;  
* valid expected version;  
* passing Validators;

When:

* the Command executes;

Then:

* authoritative state updates;  
* version increments;  
* Event persists;  
* Command result persists;  
* idempotency persists;  
* outbox record persists;  
* all commit in one PostgreSQL transaction.

---

## **Scenario B — Projection Worker Failure**

Given:

* authoritative Events continue to commit;  
* the PWU projection worker fails;

When:

* users query PWU overview;

Then:

* the projection is marked stale;  
* last update position is shown;  
* unsafe Commands require fresh version validation;  
* the worker may resume from its checkpoint.

---

## **Scenario C — Runtime Restart During Human Wait**

Given:

* an RPH is waiting for an architecture approval;

When:

* runtime containers restart;

Then:

* Process state is restored from PostgreSQL;  
* Attention Item remains assigned;  
* the approval response can resume the RPH;  
* no duplicate approval request is created.

---

## **Scenario D — Sandbox Escape Prevention**

Given:

* an Agent requests code execution;

When:

* the sandbox starts;

Then:

* no Docker socket is mounted;  
* the database network is inaccessible;  
* CPU, memory, storage, and time limits apply;  
* only declared Artifacts are extracted;  
* execution provenance is recorded.

---

## **Scenario E — Tenant Isolation**

Given:

* Participant A belongs to Tenant A;  
* PWU B belongs to Tenant B;

When:

* Participant A requests PWU B;

Then:

* application scoping rejects access;  
* RLS rejects unscoped database access;  
* the attempt is audited;  
* no PWU metadata leaks.

---

## **Scenario F — Agent Capacity Exhaustion**

Given:

* all Agent worker capacity is in use;

When:

* a new low-priority Agent Execution is requested;

Then:

* the execution is queued;  
* core Command service remains responsive;  
* higher-priority reserved work may proceed;  
* queue depth and wait time are observable.

---

## **Scenario G — Backup Recovery**

Given:

* the host is lost;

When:

* a replacement host is provisioned;

Then:

* PostgreSQL is restored;  
* object storage is restored or reconnected;  
* semantic model compatibility is verified;  
* projection checkpoints are validated or reset;  
* pending Processes resume;  
* runtime conformance checks pass before accepting traffic.

---

# **80\. Initial Implementation Backlog**

## **Epic 1 — PostgreSQL Foundation**

JSRP-001 Create schema domains  
JSRP-002 Implement tenant-scoped connection context  
JSRP-003 Implement RLS baseline  
JSRP-004 Implement migration framework  
JSRP-005 Implement semantic model version table

## **Epic 2 — Command Core**

JSRP-010 Implement Command persistence  
JSRP-011 Implement idempotency store  
JSRP-012 Implement Aggregate repository  
JSRP-013 Implement authority interface  
JSRP-014 Implement Command transaction  
JSRP-015 Implement professional errors

## **Epic 3 — Event and Outbox**

JSRP-020 Implement append-only Event table  
JSRP-021 Enforce Aggregate version uniqueness  
JSRP-022 Implement transactional outbox  
JSRP-023 Implement outbox worker  
JSRP-024 Implement dead-letter handling

## **Epic 4 — Projections**

JSRP-030 Implement projection checkpoint model  
JSRP-031 Implement PWU overview projection  
JSRP-032 Implement history projection  
JSRP-033 Implement Decision projection  
JSRP-034 Implement Attention projection  
JSRP-035 Implement rebuild command

## **Epic 5 — Durable Processes**

JSRP-040 Implement Process Instance store  
JSRP-041 Implement leases  
JSRP-042 Implement timer scheduler  
JSRP-043 Implement waiting and resumption  
JSRP-044 Implement retry policies  
JSRP-045 Implement Process recovery

## **Epic 6 — RPH Runtime**

JSRP-050 Implement RPH state store  
JSRP-051 Implement evaluation cycle  
JSRP-052 Implement PWU event triggers  
JSRP-053 Implement no-progress detection  
JSRP-054 Implement tactic change  
JSRP-055 Implement escalation  
JSRP-056 Implement synthesis queue

## **Epic 7 — Agent Runtime**

JSRP-060 Implement Agent Execution store  
JSRP-061 Implement Agent queue  
JSRP-062 Implement fair scheduling  
JSRP-063 Implement Model Gateway  
JSRP-064 Implement tool-call provenance  
JSRP-065 Implement context projection  
JSRP-066 Implement proposal conversion

## **Epic 8 — OpenSandbox**

JSRP-070 Implement sandbox controller client  
JSRP-071 Define sandbox templates  
JSRP-072 Implement resource and network policy  
JSRP-073 Implement Artifact extraction  
JSRP-074 Implement cleanup  
JSRP-075 Implement sandbox audit and telemetry

## **Epic 9 — Observability**

JSRP-080 Integrate OpenTelemetry SDK  
JSRP-081 Deploy collector  
JSRP-082 Implement required traces  
JSRP-083 Implement runtime metrics  
JSRP-084 Implement cognitive metrics  
JSRP-085 Implement structured logging

## **Epic 10 — Recovery and Operations**

JSRP-090 Implement backup jobs  
JSRP-091 Implement WAL archive  
JSRP-092 Implement restore verification  
JSRP-093 Create health endpoints  
JSRP-094 Create operational administration UI  
JSRP-095 Create runbooks  
JSRP-096 Create runtime conformance test suite

---

# **81\. Implementation Milestones**

## **Milestone 1 — Authoritative Semantic Core**

Delivers:

* PostgreSQL schema;  
* Command service;  
* Aggregate persistence;  
* optimistic concurrency;  
* Events;  
* idempotency;  
* outbox.

## **Milestone 2 — Read Model and Workbench Support**

Delivers:

* projection workers;  
* PWU overview;  
* Decision and Attention projections;  
* history;  
* stale-state disclosure.

## **Milestone 3 — Durable Coordination**

Delivers:

* Process runtime;  
* timers;  
* human waiting;  
* RPH baseline;  
* escalation.

## **Milestone 4 — Agentic Execution**

Delivers:

* Agent scheduling;  
* Model Gateway;  
* tool provenance;  
* OpenSandbox;  
* governed proposal flow.

## **Milestone 5 — Production Operations**

Delivers:

* observability;  
* backup;  
* restore;  
* security hardening;  
* administrative controls;  
* conformance tests.

---

# **82\. Coding Agent Implementation Contract**

The coding agent implementing JSRP SHALL:

1. Preserve JEM semantics over deployment convenience.  
2. Use PostgreSQL transactions for authoritative mutation.  
3. Never write projections and treat them as authoritative.  
4. Implement tenant scope in every repository and query.  
5. use generated JSDL contracts.  
6. enforce optimistic concurrency.  
7. persist Events and outbox atomically.  
8. make workers idempotent.  
9. persist Process state before waiting.  
10. use leases for recoverable work claiming.  
11. protect PostgreSQL and API resources from Agent and sandbox exhaustion.  
12. isolate sandbox networking and filesystems.  
13. record Agent, model, tool, and sandbox provenance.  
14. expose stale projection state.  
15. implement off-host backups.  
16. test restart recovery.  
17. test tenant isolation.  
18. test duplicate delivery.  
19. test host-resource saturation.  
20. document every deviation from this profile as an Architecture Decision.

---

# **83\. Resulting Initial Platform**

The resulting single-node Janumi deployment is not a prototype that must later be discarded.

It is a bounded implementation of the same semantic and execution architecture intended for future distributed operation.

It provides:

* one authoritative semantic model;  
* one transactional Command boundary;  
* immutable professional history;  
* durable recursive coordination;  
* governed AI participation;  
* isolated execution;  
* continuously updated projections;  
* explicit reconciliation;  
* professional and computational observability.

Its limitation is primarily infrastructure redundancy, not conceptual architecture.

That distinction allows Janumi to begin economically on one server while avoiding the semantic and operational shortcuts that commonly prevent early systems from scaling into enterprise platforms.

---

# **84\. Next Required Artifact**

The next artifact is the **JanumiCode Professional Work Architecture Profile v0.1**.

It shall specialize the canonical discipline and runtime for product realization and define:

* software-product Outcomes and Intents;  
* JanumiCode PWU types;  
* product-realization lifecycle;  
* requirements, user journeys, architecture, data, implementation, verification, release, and operations Representations;  
* product-specific Validators;  
* coding-agent roles;  
* decomposition and recomposition rules;  
* invariant generation and enforcement;  
* UI workspace specialization;  
* repository and CI/CD integration;  
* production Observation and reconciliation;  
* the concrete end-to-end experience the current coding agent must implement.

\===

# **JanumiCode Professional Work Architecture Profile**

## **JCPWA Specification v0.1**

**Status:** Normative draft  
**Extends:** Canonical Professional Cognition Ontology v0.1  
**Conforms to:** Janumi Constitution, Professional Cognition Life Cycle, PWU Specification v0.1, RPH Coordination Specification v0.1, Canonical Projection Model v0.1, Reference Interaction and Workspace Specification v0.1, Janumi Execution Model v0.1  
**Runtime target:** Janumi Single-Node Runtime Profile v0.1  
**Primary audiences:** JanumiCode architects, coding agents, product managers, systems engineers, software engineers, UX designers, security reviewers, test engineers, DevOps engineers, platform developers

---

# **1\. Purpose**

The JanumiCode Professional Work Architecture, or JCPWA, specializes Janumi’s domain-independent professional cognition model for software product realization.

JanumiCode governs the full progression from underspecified product intent through:

* discovery;  
* requirements;  
* user experience;  
* architecture;  
* implementation;  
* verification;  
* release;  
* operation;  
* learning;  
* reconciliation.

JanumiCode is not merely a coding-agent interface.

It is a professional cognitive environment for coordinating the complete reasoning system required to realize and sustain software products.

Its purpose is to preserve coherence across:

Intent  
Requirements  
User Journeys  
Domain Models  
Architecture  
Data  
Security  
Implementation  
Tests  
Deployment  
Operations  
Observed Behavior  
Product Outcomes

---

# **2\. Product-Realization Thesis**

Software-product failure frequently does not originate in code generation.

It originates in loss of coherence among:

* stakeholder intent;  
* product assumptions;  
* user needs;  
* requirements;  
* architecture;  
* implementation;  
* test coverage;  
* operational conditions;  
* business outcomes.

JanumiCode exists to make those relationships explicit, computable, inspectable, and continuously reconcilable.

The coding agent is one Participant within this system.

It SHALL not become the system’s organizing model.

---

# **3\. Scope**

JCPWA v0.1 covers:

* greenfield product realization;  
* brownfield feature development;  
* architecture evolution;  
* defect remediation;  
* technical-debt reduction;  
* security and compliance changes;  
* release preparation;  
* production incidents;  
* operational learning;  
* cross-functional product Decisions.

It supports:

* solo developers;  
* small software teams;  
* cross-functional product organizations;  
* enterprise product programs;  
* AI-assisted and AI-executed development.

---

# **4\. Non-Goals**

JCPWA v0.1 does not define:

* a universal software-development methodology;  
* one mandatory programming language;  
* one repository provider;  
* one cloud platform;  
* one CI/CD system;  
* one architecture style;  
* one testing framework;  
* fully autonomous production deployment;  
* replacement of accountable human authority;  
* automatic correctness from generated documentation.

It defines the semantic and operational structure within which methods and technologies are selected and governed.

---

# **5\. Canonical Product-Realization Outcome**

The primary JanumiCode Outcome is:

A software-enabled capability that produces intended user and organizational value, behaves acceptably within its operating environment, satisfies applicable constraints, and remains continuously reconcilable with changing intent and observed reality.

This Outcome is broader than:

* generated source code;  
* a merged pull request;  
* a successful build;  
* a deployed service;  
* completed tickets.

Those are intermediate Artifacts, Actions, or Observations.

---

# **6\. Product-Realization Cognitive Loop**

JanumiCode specializes the Professional Cognition Life Cycle as follows:

Product Intent  
    ↓  
Problem and User Understanding  
    ↓  
Requirements and Experience Representation  
    ↓  
Architecture and Design Reasoning  
    ↓  
Product and Engineering Decisions  
    ↓  
Implementation and Delivery Actions  
    ↓  
Verification and Operational Observation  
    ↓  
Product and Technical Reconciliation  
    ↺

This loop is recursive.

Any requirement, design choice, implementation result, test failure, user observation, production incident, or business change may reopen prior reasoning.

---

# **7\. JanumiCode Endeavor Types**

Canonical product-realization Endeavor types include:

new\_product  
new\_capability  
major\_feature  
minor\_feature  
architecture\_change  
platform\_migration  
security\_remediation  
compliance\_change  
defect\_remediation  
performance\_improvement  
technical\_debt\_reduction  
production\_incident  
operational\_improvement  
research\_spike  
product\_discovery  
release

A software product may contain multiple concurrent Endeavors.

---

# **8\. JanumiCode Stakeholders**

Canonical Stakeholder categories include:

end\_user  
buyer  
customer\_administrator  
product\_owner  
business\_sponsor  
operator  
support\_team  
developer  
security\_team  
legal\_team  
compliance\_team  
sales\_team  
implementation\_partner  
external\_integrator  
regulator  
affected\_non\_user

Stakeholder impact SHALL remain distinguishable from implementation participation.

---

# **9\. JanumiCode Participant Roles**

JCPWA defines the following canonical professional roles.

product\_sponsor  
product\_manager  
business\_analyst  
user\_researcher  
ux\_designer  
systems\_engineer  
solution\_architect  
software\_architect  
data\_architect  
security\_architect  
privacy\_reviewer  
legal\_reviewer  
software\_engineer  
coding\_agent  
test\_engineer  
verification\_agent  
devops\_engineer  
site\_reliability\_engineer  
release\_manager  
operations\_analyst  
incident\_commander  
technical\_writer  
professional\_validator  
rph\_coordinator

One human or AI Participant may occupy multiple roles where governance permits.

Role conflict policies MAY require separation among:

* author;  
* implementer;  
* reviewer;  
* validator;  
* approver;  
* production deployer.

---

# **10\. AI Participant Classes**

Canonical JanumiCode AI Participant classes include:

intent\_formalization\_agent  
requirements\_agent  
user\_journey\_agent  
research\_agent  
domain\_model\_agent  
architecture\_agent  
security\_agent  
data\_model\_agent  
planning\_agent  
coding\_agent  
code\_review\_agent  
test\_design\_agent  
test\_execution\_agent  
verification\_agent  
documentation\_agent  
release\_agent  
operations\_analysis\_agent  
reconciliation\_agent  
assumption\_surfacing\_agent  
invariant\_generation\_agent

Agent classes describe professional responsibility, not necessarily separate language models or deployed processes.

One agent runtime MAY instantiate several roles.

---

# **11\. Product-Realization Intent Model**

JanumiCode Intent SHALL capture more than a feature statement.

A material product Intent SHOULD include:

desiredUserChange  
desiredOrganizationalChange  
businessRationale  
targetUsers  
targetOperatingContext  
successInterpretation  
nonGoals  
criticalConstraints  
riskTolerance  
timeHorizon

## **11.1 Example**

Weak Intent:

Build a field-service management application.

Stronger Intent:

Enable small trade-service businesses to coordinate customer intake,  
estimation, scheduling, field execution, invoicing, and follow-up with  
less administrative effort and fewer missed commitments, while preserving  
a simple experience appropriate for owners and field technicians.

## **11.2 Intent Ambiguity**

Where Intent remains materially ambiguous, JanumiCode SHALL:

* surface ambiguity;  
* create Questions;  
* establish provisional assumptions;  
* request clarification;  
* or define an explicitly exploratory Endeavor.

The coding agent SHALL not silently choose a product direction.

---

# **12\. JanumiCode Representation Types**

JCPWA specializes `Representation` into the following categories.

## **12.1 Product Representations**

product\_brief  
problem\_statement  
value\_proposition  
persona  
stakeholder\_map  
user\_journey  
service\_blueprint  
use\_case  
story\_map  
product\_requirement  
business\_rule  
acceptance\_criterion  
success\_metric  
roadmap  
release\_scope

## **12.2 Systems-Engineering Representations**

system\_context  
capability\_model  
functional\_decomposition  
logical\_architecture  
physical\_architecture  
interface\_definition  
state\_model  
sequence\_model  
constraint\_model  
risk\_model  
traceability\_model  
verification\_plan  
validation\_plan

## **12.3 Software-Architecture Representations**

architecture\_decision\_record  
component\_model  
deployment\_model  
integration\_model  
security\_architecture  
identity\_architecture  
authorization\_model  
data\_flow\_model  
resilience\_model  
observability\_model  
performance\_model

## **12.4 Data Representations**

conceptual\_data\_model  
logical\_data\_model  
physical\_data\_model  
event\_schema  
api\_schema  
data\_contract  
retention\_policy  
classification\_model  
migration\_plan

## **12.5 Implementation Representations**

source\_code  
configuration  
infrastructure\_code  
database\_migration  
build\_definition  
deployment\_manifest  
feature\_flag  
automation\_script

## **12.6 Verification Representations**

test\_strategy  
test\_case  
test\_fixture  
unit\_test  
integration\_test  
contract\_test  
system\_test  
performance\_test  
security\_test  
accessibility\_test  
compliance\_test  
test\_result  
coverage\_model  
verification\_report

## **12.7 Operational Representations**

runbook  
dashboard\_definition  
alert\_definition  
service\_level\_objective  
incident\_record  
post\_incident\_review  
operational\_baseline  
capacity\_model  
recovery\_plan

---

# **13\. Artifact and Representation Distinction**

JCPWA SHALL preserve the distinction between software Artifacts and their professional meaning.

Examples:

Git commit                     → Artifact  
Source code expressed by it    → Representation

OpenAPI YAML file              → Artifact  
API contract expressed by it   → Representation

PNG architecture diagram       → Artifact  
Architecture model expressed   → Representation

CI test report file            → Artifact  
Verification Evidence          → Evidence and Representation

The same Representation may be embodied in multiple Artifacts.

---

# **14\. JanumiCode PWU Types**

Canonical PWU types include:

## **14.1 Discovery and Framing**

product\_intent\_formalization  
problem\_discovery  
stakeholder\_analysis  
user\_research  
market\_research  
scope\_definition  
assumption\_analysis  
constraint\_analysis

## **14.2 Product Definition**

persona\_definition  
user\_journey\_generation  
use\_case\_definition  
requirements\_generation  
requirements\_refinement  
acceptance\_criteria\_definition  
business\_rule\_definition  
success\_metric\_definition

## **14.3 Architecture and Design**

system\_context\_design  
domain\_model\_design  
architecture\_design  
interface\_design  
data\_model\_design  
security\_design  
privacy\_design  
ux\_design  
observability\_design  
deployment\_design  
migration\_design

## **14.4 Planning**

implementation\_planning  
release\_planning  
verification\_planning  
dependency\_planning  
technical\_risk\_planning

## **14.5 Implementation**

implementation\_slice  
integration\_implementation  
database\_change  
infrastructure\_change  
ui\_implementation  
api\_implementation  
automation\_implementation  
refactoring

## **14.6 Verification and Validation**

unit\_verification  
integration\_verification  
system\_verification  
security\_verification  
performance\_verification  
accessibility\_validation  
user\_validation  
release\_validation  
compliance\_validation

## **14.7 Release and Operation**

release\_preparation  
deployment  
production\_observation  
incident\_response  
defect\_analysis  
operational\_reconciliation  
post\_incident\_learning

## **14.8 Governance**

architecture\_review  
security\_review  
legal\_review  
privacy\_review  
compliance\_review  
release\_approval  
technical\_debt\_review

---

# **15\. Product-Realization Lifecycle**

A software-product Endeavor SHALL not be represented as one rigid linear workflow.

JanumiCode instead recognizes a set of recursively traversed professional regions:

framing  
discovery  
definition  
architecture  
planning  
implementation  
verification  
release  
operation  
reconciliation

An Endeavor may have active PWUs in several regions simultaneously.

## **15.1 Region Semantics**

### **Framing**

Establish Intent, Outcome, scope, Stakeholders, Constraints, and initial uncertainty.

### **Discovery**

Investigate users, domain, existing systems, risks, and operating context.

### **Definition**

Produce sufficiently precise product and system requirements.

### **Architecture**

Select structural approaches and preserve rationale.

### **Planning**

Define professionally meaningful decomposition, dependencies, validation, and release strategy.

### **Implementation**

Transform approved Representations into executable software and infrastructure.

### **Verification**

Determine whether implementation satisfies specified technical obligations.

### **Release**

Authorize and execute controlled introduction into an operating environment.

### **Operation**

Observe real behavior, user impact, reliability, cost, and security.

### **Reconciliation**

Update professional understanding and dependent Representations when reality or Intent changes.

---

# **16\. Canonical Root PWU Structure**

A substantial product-realization Endeavor SHOULD initially decompose into root PWUs such as:

Product Realization Root PWU  
├── Intent and Outcome PWU  
├── User and Domain Understanding PWU  
├── Requirements PWU  
├── Experience Design PWU  
├── System Architecture PWU  
├── Data Architecture PWU  
├── Security and Privacy PWU  
├── Implementation Planning PWU  
├── Implementation PWUs  
├── Verification PWU  
├── Release PWU  
└── Operational Learning PWU

This is a reference structure, not a mandatory fixed template.

The RPH may add, remove, or restructure PWUs according to the Endeavor.

---

# **17\. Decomposition Rules**

JanumiCode decomposition SHALL follow professional boundaries rather than arbitrary task size.

## **17.1 Valid Decomposition Dimensions**

user\_outcome  
business\_capability  
domain\_boundary  
system\_capability  
architecture\_component  
end\_to\_end\_slice  
risk\_area  
professional\_discipline  
independent\_decision  
independent\_validation  
integration\_boundary  
operational\_boundary

## **17.2 Preferred Implementation Decomposition**

Implementation SHOULD usually decompose into vertical or behaviorally complete slices where practical.

A valid implementation slice should connect:

Intent  
→ Requirement  
→ Architecture  
→ Code  
→ Test  
→ Observable Behavior

## **17.3 Invalid Decomposition**

Avoid creating PWUs solely such as:

Create database files  
Create API files  
Create frontend files  
Add tests later

unless those boundaries are independently meaningful and recomposition obligations are explicit.

## **17.4 Cross-Functional PWUs**

A PWU MAY span product, UX, architecture, implementation, and verification when that is the smallest professionally coherent unit.

---

# **18\. Recomposition Rules**

Parent recomposition SHALL verify more than child completion.

For product realization, recomposition SHOULD evaluate:

crossRequirementConsistency  
architectureCompatibility  
interfaceAlignment  
dataConsistency  
securityConsistency  
userJourneyContinuity  
testCoverage  
operationalReadiness  
releaseCoherence  
intentAlignment

## **18.1 Recomposition Outputs**

Potential outputs include:

* integrated system Representation;  
* cross-child contradiction set;  
* integrated confidence assessment;  
* release-readiness assessment;  
* updated architecture Decision;  
* follow-on remediation PWUs;  
* accepted residual technical risk.

---

# **19\. Requirements Model**

A JanumiCode Requirement is a specialized Representation that defines an obligation the product or delivery system is expected to satisfy.

## **19.1 Requirement Categories**

business  
user  
functional  
quality\_attribute  
interface  
data  
security  
privacy  
compliance  
operational  
deployment  
supportability  
migration  
constraint

## **19.2 Required Properties**

requirementId  
statement  
requirementType  
rationale  
originatingIntentIds  
stakeholderIds  
priority  
verificationMethod  
acceptanceCriteria  
status

## **19.3 Requirement Quality**

A Requirement SHOULD be:

* necessary;  
* unambiguous within its context;  
* feasible;  
* verifiable;  
* traceable;  
* sufficiently scoped;  
* non-duplicative;  
* internally consistent.

## **19.4 Requirement Status**

proposed  
analyzing  
accepted  
rejected  
deferred  
implemented  
verified  
validated  
superseded  
withdrawn

Implementation and verification SHALL remain separate statuses.

---

# **20\. Requirement Invariants**

## **JCODE-REQ-INV-001 — Intent Traceability**

Every accepted Requirement SHALL trace to Intent or an authorized external obligation.

## **JCODE-REQ-INV-002 — Verification Method**

Every material accepted Requirement SHALL identify a verification or validation method.

## **JCODE-REQ-INV-003 — No Implementation Disguised as Need**

A Requirement SHALL distinguish required behavior from prematurely selected implementation unless the implementation itself is constrained.

## **JCODE-REQ-INV-004 — Explicit Quality Attributes**

Material quality expectations SHALL not remain only as vague adjectives.

Terms such as:

fast  
secure  
scalable  
easy  
reliable  
intuitive

require interpretation or measurable criteria.

## **JCODE-REQ-INV-005 — Conflict Visibility**

Conflicting Requirements SHALL remain visible until reconciled or explicitly accepted as a trade-off.

---

# **21\. User Journey Model**

A User Journey is a Representation of how a Stakeholder seeks an outcome across interactions and operational context.

## **21.1 Required Properties**

journeyId  
personaOrStakeholder  
desiredOutcome  
entryConditions  
stages  
touchpoints  
decisions  
painPoints  
failurePaths  
recoveryPaths  
supportingCapabilities  
successSignals

## **21.2 Journey Stage**

Each stage SHOULD identify:

userGoal  
userAction  
systemResponse  
informationNeeded  
uncertainty  
emotionalOrOperationalCondition  
failurePossibility  
evidenceOfSuccess

## **21.3 Journey Invariant**

A Journey SHALL not be treated as a decorative narrative.

It SHALL trace to:

* Requirements;  
* capabilities;  
* UX Representations;  
* verification;  
* operational Observation.

---

# **22\. Domain Model**

The domain model expresses the core concepts, responsibilities, rules, and relationships of the software-enabled domain.

## **22.1 Domain Model Components**

bounded\_context  
domain\_entity  
value\_object  
aggregate  
domain\_service  
domain\_event  
policy  
invariant  
business\_rule  
state\_transition

## **22.2 Distinction from CPCO Aggregate**

A software-domain Aggregate is a Representation within JanumiCode.

It SHALL not be confused with a Janumi transactional Aggregate such as the PWU Aggregate.

## **22.3 Domain Model Validation**

The domain model SHOULD be reviewed against:

* Requirements;  
* User Journeys;  
* business rules;  
* data obligations;  
* integration boundaries;  
* lifecycle behavior.

---

# **23\. Architecture Model**

JanumiCode Architecture is a set of Representations and Decisions explaining how the intended software capability is structured and operated.

## **23.1 Architecture Concerns**

system\_context  
responsibility\_allocation  
component\_boundaries  
data\_ownership  
integration  
security  
resilience  
performance  
deployment  
observability  
operability  
evolution  
cost

## **23.2 Architecture Decision**

Every material architecture Decision SHOULD identify:

decisionQuestion  
context  
alternatives  
criteria  
selectedAlternative  
supportingEvidence  
assumptions  
constraints  
tradeoffs  
risks  
consequences  
revisitTriggers

## **23.3 Architecture Invariant**

The current implementation SHALL remain traceable to current architecture Decisions or explicitly identified divergence.

---

# **24\. Architecture Drift**

Architecture drift occurs when implementation or operation no longer conforms to current Architecture Representations.

## **24.1 Drift Sources**

unreviewed\_code\_change  
emergency\_remediation  
dependency\_behavior  
configuration\_change  
infrastructure\_change  
performance\_optimization  
team\_workaround  
obsolete\_documentation

## **24.2 Drift Disposition**

Detected drift SHALL produce one of:

implementation\_correction  
architecture\_revision  
authorized\_exception  
temporary\_incoherence  
reconciliation

The platform SHALL not assume that the document is correct and the code is wrong, or vice versa.

Both are Representations requiring reconciliation with Intent and observed reality.

---

# **25\. Data Model**

JanumiCode SHALL distinguish:

conceptual\_data\_model  
logical\_data\_model  
physical\_data\_model  
runtime\_data\_state

## **25.1 Data Obligations**

Material data entities SHOULD identify:

* ownership;  
* source of truth;  
* classification;  
* retention;  
* integrity constraints;  
* access rules;  
* lifecycle;  
* migration strategy;  
* downstream consumers.

## **25.2 Data Invariant**

A schema change SHALL trace to:

* Requirement;  
* Architecture Decision;  
* defect;  
* migration need;  
* or authorized operational change.

---

# **26\. Interface Model**

Interfaces include:

* APIs;  
* events;  
* files;  
* messages;  
* user interfaces;  
* database contracts;  
* external integrations.

## **26.1 Interface Definition**

A material interface SHOULD identify:

provider  
consumer  
purpose  
contract  
version  
authority  
security  
error\_semantics  
compatibility  
observability

## **26.2 Compatibility**

Breaking changes SHALL require:

* affected-consumer analysis;  
* version strategy;  
* migration plan;  
* validation;  
* authorized Decision.

---

# **27\. Security and Privacy Model**

Security and privacy SHALL be integrated into product realization rather than treated as terminal reviews.

## **27.1 Security Representations**

threat\_model  
trust\_boundary  
identity\_model  
authorization\_model  
data\_classification  
security\_requirement  
security\_control  
abuse\_case  
security\_test  
incident\_response\_plan

## **27.2 Security Questions**

JanumiCode SHOULD continuously ask:

* What is being protected?  
* From whom?  
* Under which trust assumptions?  
* Which identity establishes authority?  
* What happens when a control fails?  
* How will misuse be detected?  
* How will the organization respond?

## **27.3 Privacy Questions**

* Which personal information is collected?  
* Why is it necessary?  
* Where is it processed?  
* Who can access it?  
* How long is it retained?  
* Which rights or obligations apply?  
* Can the outcome be achieved with less data?

---

# **28\. Invariant Generation**

JanumiCode SHALL include an explicit invariant-generation capability.

Invariants are properties that must remain true across:

* requirements;  
* domain state;  
* architecture;  
* data;  
* security;  
* execution;  
* operations.

## **28.1 Invariant Sources**

Invariants may derive from:

Intent  
business\_rules  
Requirements  
domain\_model  
architecture  
security\_policy  
legal\_obligation  
data\_integrity  
operational\_safety  
user\_expectation

## **28.2 Invariant Categories**

domain  
data  
security  
privacy  
architectural  
workflow  
authorization  
temporal  
resource  
operational  
product

## **28.3 Example**

A tenant user shall never read or modify another tenant’s protected data.

This invariant may derive:

* Requirements;  
* authorization model;  
* database policy;  
* tests;  
* runtime telemetry;  
* reconciliation triggers.

## **28.4 Invariant Lifecycle**

proposed  
analyzing  
accepted  
implemented  
verified  
observed  
violated  
superseded

---

# **29\. Invariant Enforcement**

An accepted invariant SHOULD map to one or more enforcement mechanisms.

static\_analysis  
type\_system  
schema\_constraint  
authorization\_policy  
runtime\_guard  
test  
formal\_model  
monitor  
alert  
manual\_review  
audit

## **29.1 Enforcement Coverage**

The platform SHOULD expose whether an invariant is:

specified  
implemented  
verified  
operationally\_observed

These states SHALL remain distinct.

## **29.2 Invariant Violation**

A detected violation SHALL:

* create an Issue or Observation;  
* identify affected Intent and Outcomes;  
* trigger remediation or reconciliation;  
* preserve Evidence;  
* assess prior Decisions and assumptions.

---

# **30\. Implementation Plan**

The Implementation Plan SHALL decompose approved professional understanding into executable work without severing traceability.

## **30.1 Plan Components**

implementation\_slices  
dependencies  
affected\_representations  
repository\_locations  
required\_decisions  
required\_validations  
migration\_steps  
rollout\_strategy  
rollback\_strategy  
observability\_changes

## **30.2 Plan Quality**

An implementation plan SHOULD be:

* outcome-aligned;  
* vertically coherent;  
* dependency-aware;  
* verifiable;  
* operationally complete;  
* minimal without being incomplete.

## **30.3 Speculative Work**

Speculative abstractions SHALL require an explicit rationale.

A coding agent SHALL default to the narrowest implementation satisfying current approved understanding.

---

# **31\. Coding-Agent Contract**

Every coding-agent execution SHALL receive an explicit contract.

## **31.1 Required Context**

professionalObjective  
originatingIntent  
scope  
nonGoals  
Requirements  
userJourneys  
architectureDecisions  
domainModel  
dataModel  
invariants  
constraints  
repositoryContext  
codingStandards  
requiredValidations  
completionConditions  
escalationConditions

## **31.2 Required Outputs**

codeChanges  
configurationChanges  
migrationChanges  
testChanges  
documentationChanges  
assumptionsIntroduced  
deviations  
unresolvedQuestions  
validationResults  
affectedRepresentations  
recommendedReconciliation  
provenance

## **31.3 Coding-Agent Prohibitions**

The coding agent SHALL NOT:

* replace product Intent;  
* broaden scope silently;  
* invent missing approval;  
* treat passing compilation as completion;  
* skip required tests;  
* modify unrelated architecture without disclosure;  
* suppress failing tests;  
* remove constraints to achieve success;  
* claim deployment or outcome success without Evidence;  
* introduce speculative frameworks without justification;  
* silently change public contracts;  
* attribute AI work to a human.

---

# **32\. Coding-Agent Operating Modes**

Canonical modes include:

analyze  
plan  
implement  
debug  
refactor  
review  
verify  
reconcile  
explain

The selected mode SHALL constrain permissible actions.

## **32.1 Analyze**

May inspect and propose.

Shall not modify authoritative repository state unless explicitly authorized.

## **32.2 Plan**

Produces an Implementation Plan and child PWU proposal.

## **32.3 Implement**

May modify approved scope and produce implementation Artifacts.

## **32.4 Debug**

Investigates a defect hypothesis and produces Evidence, Claims, and corrective proposals.

## **32.5 Refactor**

Changes structure while preserving declared behavior and invariants.

## **32.6 Review**

Evaluates but does not approve unless separately authorized.

## **32.7 Verify**

Executes or analyzes verification methods.

## **32.8 Reconcile**

Assesses divergence among Requirements, architecture, code, tests, and operation.

---

# **33\. Repository Model**

A repository is an external professional system containing software Artifacts and history.

## **33.1 Repository Context**

repositoryId  
provider  
url  
defaultBranch  
branchPolicy  
protectedPaths  
codeOwners  
buildSystem  
testCommands  
deploymentRelationship

## **33.2 Worktree Isolation**

Agent implementation SHOULD occur within:

* a dedicated branch;  
* worktree;  
* ephemeral clone;  
* or sandboxed workspace.

## **33.3 Repository Authority**

Repository write access SHALL be scoped to the assigned PWU and policy.

## **33.4 Commit Provenance**

A commit created by Janumi SHOULD reference:

pwuId  
agentExecutionId  
intentId  
decisionIds  
validationSummary

where policy permits.

---

# **34\. Change Model**

A software Change is a structured set of Artifact modifications associated with a professional purpose.

## **34.1 Change Properties**

changeId  
pwuId  
objective  
affectedArtifacts  
affectedRepresentations  
implementationRationale  
assumptions  
risk  
validationPlan  
rollbackPlan  
status

## **34.2 Change Status**

proposed  
in\_progress  
ready\_for\_review  
changes\_requested  
approved  
merged  
deployed  
observed  
reconciled  
reverted

These states SHALL not be collapsed into PWU lifecycle state.

---

# **35\. Code Review Model**

Code review is a professional Validation activity.

## **35.1 Review Dimensions**

intent\_alignment  
scope\_compliance  
correctness  
architecture\_conformance  
security  
maintainability  
test\_adequacy  
observability  
operability  
migration\_safety

## **35.2 Review Outcome**

approve  
approve\_with\_conditions  
request\_changes  
inconclusive  
escalate

## **35.3 AI Code Review**

AI review SHALL remain attributable and SHALL not satisfy independent human review requirements unless policy explicitly permits it.

---

# **36\. Verification Model**

Verification determines whether software Representations and Actions satisfy specified obligations.

## **36.1 Verification Levels**

static  
unit  
component  
integration  
contract  
system  
performance  
security  
resilience  
deployment  
operational

## **36.2 Verification Trace**

Each material Requirement SHOULD trace to:

verificationMethod  
testOrAnalysis  
result  
Evidence  
status

## **36.3 Verification Status**

not\_planned  
planned  
implemented  
executed  
passed  
failed  
inconclusive  
waived  
obsolete

## **36.4 Waiver**

A waived verification obligation SHALL record:

* authority;  
* rationale;  
* risk;  
* expiration or review condition;  
* affected release;  
* compensating control.

---

# **37\. Validation Model**

Validation determines whether the realized product serves intended users and Outcomes.

Validation may include:

* user evaluation;  
* usability study;  
* pilot operation;  
* business metric evaluation;  
* acceptance review;  
* operational feedback.

Passing all tests does not imply product validation.

---

# **38\. Test Strategy**

Every substantial Endeavor SHOULD establish a Test Strategy.

## **38.1 Strategy Components**

riskModel  
testLevels  
coverageObjectives  
environmentStrategy  
dataStrategy  
automationStrategy  
nonfunctionalTesting  
securityTesting  
releaseGates  
productionValidation

## **38.2 Test Value**

Test volume SHALL not be treated as equivalent to verification quality.

The strategy SHOULD prioritize tests according to:

* Outcome impact;  
* invariant criticality;  
* failure likelihood;  
* change frequency;  
* recovery difficulty.

---

# **39\. Traceability Model**

JanumiCode SHALL support trace paths such as:

Intent  
→ Outcome  
→ User Journey  
→ Requirement  
→ Architecture Decision  
→ Implementation Change  
→ Test  
→ Deployment  
→ Observation  
→ Reconciliation

Not every entity requires a direct relationship to every other entity.

The path SHALL remain reconstructable.

## **39.1 Traceability Gap**

Missing required trace relationships SHALL be visible as a validation or coherence issue.

---

# **40\. CI/CD Integration**

CI/CD systems are external execution and Observation systems.

## **40.1 CI Inputs**

Janumi may provide:

* source revision;  
* build configuration;  
* test plan;  
* required gates;  
* invariant checks;  
* deployment target.

## **40.2 CI Outputs**

CI results SHALL be normalized into:

* Actions;  
* Artifacts;  
* Observations;  
* Evidence;  
* Validations.

## **40.3 Build Success**

Build success SHALL not automatically complete the PWU.

## **40.4 Test Failure**

A test failure SHALL retain:

* test identity;  
* affected Requirement or invariant;  
* environment;  
* failure output;  
* reproducibility;  
* responsible Change;  
* resulting attention or reconciliation.

---

# **41\. Release Model**

A Release is a governed introduction of a selected product state into an operating environment.

## **41.1 Release Properties**

releaseId  
scope  
includedChanges  
excludedChanges  
targetEnvironment  
releaseStrategy  
validationStatus  
knownRisks  
rollbackPlan  
approvals  
status

## **41.2 Release Status**

planning  
candidate  
awaiting\_validation  
awaiting\_approval  
approved  
deploying  
deployed  
observing  
accepted  
failed  
rolled\_back  
reconciled

## **41.3 Release Readiness**

Release readiness SHOULD evaluate:

scopeCoherence  
requiredVerification  
securityReview  
migrationReadiness  
operationalReadiness  
observabilityReadiness  
supportReadiness  
knownRiskAcceptance  
rollbackReadiness

---

# **42\. Deployment Model**

Deployment is an Action that changes an operating environment.

It SHALL identify:

* authorizing Release Decision;  
* target environment;  
* implementation revision;  
* configuration revision;  
* migration revision;  
* executor;  
* expected observations;  
* rollback conditions.

Deployment completion and Release acceptance SHALL remain distinct.

---

# **43\. Operational Observation**

Operational systems SHALL provide Observations relevant to:

availability  
latency  
errorRate  
security  
resourceUse  
userBehavior  
businessOutcome  
cost  
supportDemand  
dataQuality

## **43.1 Observation Context**

Operational telemetry SHALL remain traceable, where practical, to:

* release;  
* Change;  
* PWU;  
* Requirement;  
* architecture Decision;  
* Outcome.

## **43.2 Monitoring Gap**

A material Requirement or invariant lacking operational Observation may create an observability-design gap.

---

# **44\. Production Incident Model**

A production incident is a PWU centered on an adverse operating condition.

## **44.1 Incident PWU Components**

observedCondition  
affectedUsers  
affectedOutcomes  
severity  
currentImpact  
containmentActions  
workingClaims  
Evidence  
timeline  
decisions  
remediation  
verification  
reconciliation

## **44.2 Incident Phases**

detect  
triage  
contain  
diagnose  
remediate  
recover  
verify  
learn  
reconcile

## **44.3 Incident Prohibition**

The incident SHALL not close merely because service is restored.

Closure SHOULD include:

* recovery validated;  
* residual risk recorded;  
* root or contributing Claims assessed;  
* follow-on work created;  
* affected Representations reconciled.

---

# **45\. Defect Model**

A Defect is a Claim that observed software behavior conflicts with expected or required behavior.

## **45.1 Defect Evidence**

A Defect SHOULD include:

expectedBehavior  
observedBehavior  
reproduction  
environment  
severity  
affectedRequirement  
affectedOutcome  
Evidence

## **45.2 Defect Status**

reported  
triaging  
confirmed  
not\_reproducible  
working\_as\_designed  
accepted  
in\_remediation  
fixed  
verified  
closed  
reopened

`working_as_designed` may still reveal an invalid Requirement or design Decision and may therefore trigger reconciliation.

---

# **46\. Technical Debt Model**

Technical debt is a recognized future burden arising from a technical compromise, incomplete work, or accumulated divergence.

## **46.1 Required Properties**

debtId  
description  
origin  
rationale  
affectedAreas  
currentCost  
futureRisk  
interestSignals  
repaymentOptions  
status

## **46.2 Technical Debt Is Not a Generic Defect**

Debt SHALL identify the professional trade-off that produced it where known.

## **46.3 Debt Signals**

Potential signals include:

* repeated Change difficulty;  
* recurring incidents;  
* excessive validation cost;  
* architecture drift;  
* obsolete dependency;  
* unsupported invariant;  
* high coordination overhead.

---

# **47\. Dependency Model**

Software dependencies include:

library  
service  
database  
external\_api  
platform  
runtime  
build\_tool  
organization  
team  
decision  
Requirement  
Evidence

## **47.1 External Software Dependency**

A material dependency SHOULD identify:

* version;  
* source;  
* license;  
* security posture;  
* support status;  
* compatibility;  
* replacement strategy;  
* affected capabilities.

## **47.2 Dependency Change**

A dependency update SHALL be treated as professional work when it may affect behavior, risk, architecture, or compliance.

---

# **48\. Assumption Model**

Common JanumiCode Assumption categories include:

user\_behavior  
market  
technical\_feasibility  
dependency\_behavior  
performance  
security  
operational  
team\_capability  
cost  
schedule  
regulatory  
integration  
data\_quality

## **48.1 Assumption Surfacing**

JanumiCode SHALL support a dedicated assumption-surfacing role or Validator.

It SHOULD identify assumptions embedded within:

* Intent;  
* Requirements;  
* architecture;  
* plans;  
* generated code;  
* test strategy;  
* deployment;  
* operational interpretation.

## **48.2 Assumption Failure**

Invalidation of a critical Assumption SHALL trigger impact analysis and potentially:

* reopen Requirement;  
* reopen Decision;  
* reopen PWU;  
* revise architecture;  
* create remediation;  
* initiate reconciliation.

---

# **49\. Risk Model**

Canonical software-product Risk categories include:

product  
user\_adoption  
technical  
architecture  
security  
privacy  
compliance  
delivery  
integration  
operational  
performance  
availability  
cost  
vendor  
data  
organizational

Risk SHALL link to affected Outcomes and mitigation work.

---

# **50\. Product-Specific Validators**

JCPWA defines the following initial Validator classes.

## **50.1 Intent Validators**

ProductIntentClarityValidator  
OutcomeOrientationValidator  
ScopeBoundaryValidator  
NonGoalValidator  
StakeholderCoverageValidator

## **50.2 User and Requirement Validators**

JourneyCompletenessValidator  
RequirementNecessityValidator  
RequirementAmbiguityValidator  
RequirementVerifiabilityValidator  
RequirementConflictValidator  
AcceptanceCriteriaValidator  
TraceabilityValidator

## **50.3 Architecture Validators**

ArchitectureIntentAlignmentValidator  
ResponsibilityAllocationValidator  
BoundaryConsistencyValidator  
DataOwnershipValidator  
InterfaceCompletenessValidator  
SecurityArchitectureValidator  
OperationalArchitectureValidator  
ArchitectureDriftValidator

## **50.4 Implementation Validators**

ScopeComplianceValidator  
DesignConformanceValidator  
InvariantImplementationValidator  
BoundaryValidationValidator  
ErrorHandlingValidator  
ObservabilityValidator  
MigrationSafetyValidator  
DependencyPolicyValidator

## **50.5 Verification Validators**

RequirementCoverageValidator  
InvariantCoverageValidator  
RiskCoverageValidator  
TestResultValidator  
IndependentReviewValidator  
ReleaseGateValidator

## **50.6 Operational Validators**

DeploymentValidationValidator  
OperationalReadinessValidator  
TelemetryCoverageValidator  
OutcomeObservationValidator  
RecoveryReadinessValidator  
IncidentClosureValidator

---

# **51\. Professional Wisdom Validators**

JanumiCode SHOULD encode accumulated engineering wisdom as explicit Validators.

Examples:

GallLawValidator  
LeakyAbstractionRiskValidator  
HyrumLawRiskValidator  
SecondSystemEffectValidator  
PrematureAbstractionValidator  
DistributedSystemFallacyValidator  
ConwayAlignmentValidator  
FailureModeCoverageValidator  
ChangeAmplificationValidator

These SHALL not be treated as simplistic pass/fail rules where professional interpretation is required.

They may return:

pass  
warning  
risk\_detected  
not\_applicable  
inconclusive

with rationale and Evidence.

---

# **52\. Development Contracts**

JanumiCode SHALL incorporate the following development contracts.

## **52.1 Intent Contract**

Preserve user and system Intent.

Do not substitute an easier or preferred objective.

## **52.2 Scope Contract**

Implement the narrowest complete solution satisfying the authorized scope.

Avoid speculative features and abstractions.

## **52.3 Design Contract**

Use designs that preserve clarity, composability, testability, and responsibility boundaries.

## **52.4 Boundary Contract**

Treat all external, user, model, database, API, and tool outputs as untrusted.

Parse, normalize, validate, and canonicalize them.

## **52.5 State Contract**

Model state explicitly.

Do not infer semantic state from null, empty, missing, or undefined values.

## **52.6 Observability Contract**

Create traces, logs, and metrics at decision boundaries, external boundaries, state transitions, validation failures, retries, and downstream blocking.

## **52.7 Error Contract**

Use typed and classified failures.

Do not swallow or replace errors with ambiguous success.

---

# **53\. JanumiCode UI Specialization**

JanumiCode specializes the Reference Interaction and Workspace model.

## **53.1 Global Navigation**

Recommended destinations:

Product Outcomes  
Endeavors  
Work Architecture  
Requirements  
Architecture  
Implementation  
Verification  
Releases  
Operations  
Decisions  
Evidence  
Reconciliation  
Coordination

These remain projections over one cognitive model.

They SHALL not become independent semantic modules.

## **53.2 Product-Realization Breadcrumb**

Example:

Organization  
› JanumiCode  
› Field Service Product  
› Scheduling Capability  
› Architecture PWU  
› Decision: Scheduling Consistency Model

---

# **54\. Product Outcome Workspace**

The Product Outcome Workspace SHOULD show:

* intended user and business change;  
* active success metrics;  
* supporting capabilities;  
* active Endeavors;  
* current confidence;  
* unresolved product assumptions;  
* production observations;  
* variance from intended Outcome.

---

# **55\. Product Realization Map**

The Product Realization Map is a canonical JanumiCode projection connecting:

Intent  
→ Outcome  
→ Journey  
→ Requirement  
→ Architecture  
→ Implementation  
→ Verification  
→ Release  
→ Observation

## **55.1 Purpose**

It allows users to inspect whether the product realization chain remains coherent.

## **55.2 Gap Indicators**

The map SHOULD identify:

* Requirement without Intent;  
* Requirement without verification;  
* code without approved professional origin;  
* architecture Decision without implementation;  
* implementation without tests;  
* test without Requirement or invariant;  
* deployed Change without Observation;  
* observed failure without reconciliation.

---

# **56\. Decomposition Viewer Specialization**

The JanumiCode Decomposition Viewer SHOULD support multiple synchronized structures.

## **56.1 Professional Decomposition**

Outcome  
Capability  
PWU  
Child PWU

## **56.2 System Decomposition**

System  
Subsystem  
Component  
Interface

## **56.3 Implementation Decomposition**

Repository  
Package  
Module  
File  
Symbol

## **56.4 Traceability Rule**

These decompositions SHALL remain related but SHALL not be collapsed into one hierarchy.

A source-code folder structure is not the Professional Work Architecture.

---

# **57\. Requirements Workspace**

The Requirements Workspace SHALL support:

* Requirement hierarchy and relationships;  
* Intent trace;  
* User Journey trace;  
* ambiguity and conflict;  
* acceptance criteria;  
* verification planning;  
* status;  
* implementation and test coverage;  
* change impact.

It SHOULD emphasize semantic quality over bulk requirement generation.

---

# **58\. Architecture Workspace**

The Architecture Workspace SHOULD provide synchronized projections for:

Context  
Capabilities  
Domain Model  
Components  
Interfaces  
Data  
Security  
Deployment  
Decisions  
Risks  
Invariants  
Drift

## **58.1 Architecture Decision Interaction**

Users SHALL be able to move from:

Architecture element  
→ governing Decision  
→ Alternatives  
→ Evidence  
→ Requirement  
→ implementation  
→ Observation

---

# **59\. Implementation Workspace**

The Implementation Workspace SHALL remain PWU-centered.

It SHOULD display:

* current objective;  
* approved scope;  
* affected Requirements;  
* architecture Decisions;  
* invariants;  
* repository context;  
* active Agent Execution;  
* code changes;  
* tests;  
* validations;  
* unresolved questions;  
* completion readiness.

The file editor is embedded within this professional context.

---

# **60\. Verification Workspace**

The Verification Workspace SHOULD provide:

Requirement-to-Test Matrix  
Invariant Coverage  
Risk-Based Coverage  
Test Execution  
Failure Analysis  
Evidence  
Waivers  
Release Gates

A raw test-count dashboard is insufficient.

---

# **61\. Release Workspace**

The Release Workspace SHOULD integrate:

* included Changes;  
* excluded scope;  
* verification state;  
* unresolved defects;  
* security review;  
* migration readiness;  
* operational readiness;  
* rollback plan;  
* approvals;  
* release observations.

---

# **62\. Operations Workspace**

The Operations Workspace SHOULD connect telemetry and incidents to professional context.

It should support:

* current releases;  
* service health;  
* Outcome indicators;  
* invariant monitors;  
* significant Observations;  
* incidents;  
* recurring defects;  
* architecture drift;  
* reconciliation backlog.

---

# **63\. Reconciliation Workspace Specialization**

JanumiCode reconciliation SHALL support comparisons such as:

Intent vs Requirement  
Requirement vs Architecture  
Architecture vs Code  
Code vs Test  
Expected vs Observed Behavior  
Current Model vs Repository  
Current Release vs Production

## **63.1 Reconciliation Outcomes**

revise\_requirement  
revise\_architecture  
modify\_implementation  
add\_or\_change\_test  
change\_operational\_control  
reopen\_decision  
accept\_exception  
create\_follow\_on\_pwu

---

# **64\. VS Code Profile**

The JanumiCode VS Code extension SHALL function as a professional workspace, not only an agent chat surface.

## **64.1 Primary Regions**

Janumi Activity Bar  
Product Realization Explorer  
PWU Header  
Professional Context Panel  
Editor  
Agent Activity  
Validation and Evidence Panel  
Reconciliation Indicators

## **64.2 Product Realization Explorer**

Recommended structure:

Current PWU  
├── Objective  
├── Requirements  
├── Architecture  
├── Implementation  
├── Verification  
├── Decisions  
├── Evidence  
├── Dependencies  
└── Reconciliation

Endeavor  
├── Outcomes  
├── Active PWUs  
├── Decomposition  
├── Releases  
└── Operations

## **64.3 File Selection Context**

Selecting source code SHOULD reveal:

* related PWUs;  
* Requirements;  
* architecture elements;  
* Decisions;  
* tests;  
* invariants;  
* Observations;  
* outstanding reconciliation.

## **64.4 Agent Control**

The extension SHALL expose:

* agent role;  
* operating mode;  
* scope;  
* current step;  
* tool use;  
* outputs;  
* validation;  
* escalation;  
* stop and safe-stop controls.

---

# **65\. Conversational Profile**

JanumiCode conversation SHALL be grounded in active professional context.

Material conversation outputs SHOULD become:

* Question;  
* Assumption;  
* Requirement;  
* Claim;  
* Decision proposal;  
* PWU proposal;  
* implementation plan;  
* reconciliation proposal.

The system SHALL not require future agents to reconstruct material decisions from chat transcripts.

---

# **66\. Repository Observation**

JanumiCode SHOULD continuously observe repository state.

Potential Observations:

commit\_added  
branch\_created  
pull\_request\_opened  
pull\_request\_merged  
file\_changed  
dependency\_changed  
test\_added  
test\_removed  
build\_failed  
security\_alert  
release\_tagged

Observation does not automatically authorize semantic change.

It may trigger:

* impact analysis;  
* traceability update;  
* architecture drift detection;  
* reconciliation.

---

# **67\. CI/CD Observation**

Potential normalized CI/CD Events:

BuildStarted  
BuildSucceeded  
BuildFailed  
TestExecuted  
TestPassed  
TestFailed  
CoverageChanged  
SecurityScanCompleted  
ArtifactPublished  
DeploymentStarted  
DeploymentSucceeded  
DeploymentFailed  
RollbackStarted  
RollbackCompleted

These SHALL be linked to Change, PWU, Release, and relevant professional entities where possible.

---

# **68\. Production Feedback Loop**

Production Observation SHALL feed:

Outcome Assessment  
Requirement Validation  
Architecture Evaluation  
Invariant Monitoring  
Defect Detection  
Risk Reassessment  
Roadmap Decisions  
Reconciliation

The product-realization process therefore does not terminate at deployment.

---

# **69\. JanumiCode Coherence Dimensions**

JCPWA SHALL assess at least:

intent\_coherence  
requirement\_coherence  
journey\_coherence  
architecture\_coherence  
data\_coherence  
security\_coherence  
implementation\_coherence  
verification\_coherence  
release\_coherence  
operational\_coherence

## **69.1 Coherence Explanation**

Any summarized score SHALL expose the underlying conflicts, gaps, and stale Representations.

---

# **70\. Product-Realization Events**

JCPWA defines events including:

ProductIntentFormalized  
ProductIntentRevised  
JourneyDefined  
JourneyRevised  
RequirementProposed  
RequirementAccepted  
RequirementRejected  
RequirementImplemented  
RequirementVerified  
ArchitectureDecisionProposed  
ArchitectureDecisionApproved  
ArchitectureDriftDetected  
InvariantProposed  
InvariantAccepted  
InvariantViolated  
ImplementationPlanApproved  
CodeChangeProposed  
CodeChangeValidated  
CodeChangeMerged  
VerificationFailed  
ReleaseCandidateCreated  
ReleaseApproved  
DeploymentObserved  
OutcomeVarianceDetected  
ProductionIncidentOpened  
ProductionIncidentResolved  
ProductReconciliationTriggered

---

# **71\. Product-Realization Commands**

Canonical commands include:

FormalizeProductIntent  
ReviseProductIntent  
DefineOutcome  
CreateUserJourney  
ProposeRequirement  
AcceptRequirement  
RejectRequirement  
CreateArchitectureDecision  
ApproveArchitectureDecision  
RegisterInvariant  
ApproveImplementationPlan  
StartImplementation  
ProposeCodeChange  
SubmitForReview  
RecordVerificationResult  
ApproveRelease  
AuthorizeDeployment  
RecordProductionObservation  
OpenIncident  
TriggerProductReconciliation  
CompleteProductPwu

---

# **72\. Product-Realization Attention Types**

intent\_clarification\_required  
requirement\_conflict  
architecture\_decision\_required  
security\_review\_required  
implementation\_blocked  
verification\_failed  
traceability\_gap  
invariant\_violation  
release\_approval\_required  
production\_variance  
incident\_escalation  
reconciliation\_required

---

# **73\. JanumiCode Invariants**

## **JCODE-INV-001 — Intent Traceability**

Every material accepted Requirement, Architecture Decision, implementation Change, and Release SHALL trace to Intent or an authorized obligation.

## **JCODE-INV-002 — Requirement Verification**

Every material accepted Requirement SHALL possess an identified verification or validation method.

## **JCODE-INV-003 — Architecture Rationale**

Every material Architecture Decision SHALL preserve Alternatives, rationale, Constraints, and consequences.

## **JCODE-INV-004 — Implementation Authorization**

A material implementation Change SHALL trace to approved scope or an authorized incident action.

## **JCODE-INV-005 — AI Attribution**

AI-generated product, architecture, implementation, test, and review outputs SHALL remain attributable.

## **JCODE-INV-006 — Test Failure Integrity**

A failing required test SHALL not be removed, disabled, or weakened solely to obtain passing status without an authorized Decision.

## **JCODE-INV-007 — Explicit State**

Requirement, Change, verification, Release, and deployment states SHALL be explicit.

## **JCODE-INV-008 — Boundary Validation**

All external and generated inputs SHALL cross explicit validation boundaries.

## **JCODE-INV-009 — Production Completion**

Deployment success SHALL not imply Release acceptance or Outcome achievement.

## **JCODE-INV-010 — Reconciliation of Drift**

Detected material divergence among Intent, Requirement, Architecture, implementation, verification, and operation SHALL receive explicit disposition.

## **JCODE-INV-011 — Parent Recomposition**

Completion of child implementation PWUs SHALL not complete the parent capability PWU without integration and synthesis.

## **JCODE-INV-012 — Invariant Coverage**

Critical accepted invariants SHALL possess an identified enforcement and verification strategy.

## **JCODE-INV-013 — Error Visibility**

Material implementation and operational failures SHALL be typed, preserved, and observable.

## **JCODE-INV-014 — No Silent Scope Expansion**

Agents and humans SHALL not materially broaden implementation scope without authorized revision.

## **JCODE-INV-015 — Independent Validation**

Where required by policy or risk, the implementer SHALL not satisfy independent validation alone.

## **JCODE-INV-016 — Repository Non-Authority**

Repository state alone SHALL not define current professional truth.

## **JCODE-INV-017 — Documentation Non-Authority**

A design document alone SHALL not override contradictory implementation and Observation without reconciliation.

## **JCODE-INV-018 — Observability Obligation**

Material operational behaviors and invariants SHALL define how they are observed where feasible.

## **JCODE-INV-019 — Residual Risk**

Known residual product or technical risk SHALL be explicit at Release Decision time.

## **JCODE-INV-020 — Professional Completion**

A JanumiCode PWU SHALL not complete merely because code was generated or merged.

---

# **74\. Minimum Viable JanumiCode Profile**

The initial JanumiCode implementation SHALL support:

## **74.1 Core Entities**

ProductIntent  
ProductOutcome  
UserJourney  
Requirement  
ArchitectureDecision  
DomainModelRepresentation  
ImplementationPlan  
SoftwareChange  
Invariant  
TestCase  
VerificationResult  
Release  
DeploymentObservation  
ProductionIncident

## **74.2 Core PWUs**

intent\_formalization  
user\_journey\_generation  
requirements\_generation  
architecture\_design  
implementation\_planning  
implementation\_slice  
verification  
release\_preparation  
production\_incident  
reconciliation

## **74.3 Core Validators**

ProductIntentClarityValidator  
RequirementVerifiabilityValidator  
TraceabilityValidator  
ArchitectureIntentAlignmentValidator  
ScopeComplianceValidator  
InvariantCoverageValidator  
RequirementCoverageValidator  
ReleaseGateValidator

## **74.4 Core Workspaces**

Product Outcome  
Product Realization Map  
PWU Overview  
Requirements  
Architecture  
Implementation  
Verification  
Decomposition  
Decision  
Reconciliation  
Coordination

## **74.5 Core Integrations**

Git repository  
Coding-agent runtime  
OpenSandbox  
Build and test runner  
CI/CD results  
Artifact storage  
OpenTelemetry

---

# **75\. Reference End-to-End Scenario**

A user provides:

Build a SaaS field-service management system for small trade-service  
businesses such as plumbers, roofers, landscapers, and deck builders.

## **75.1 Intent Formalization**

JanumiCode creates an `intent_formalization` PWU.

It identifies:

* target users;  
* desired business change;  
* product assumptions;  
* missing scope;  
* success interpretation;  
* non-goals;  
* constraints.

The system does not immediately start coding.

## **75.2 Understanding and Discovery**

Child PWUs investigate:

* business operating model;  
* user roles;  
* scheduling;  
* field execution;  
* estimates;  
* invoicing;  
* customer communication;  
* multi-tenancy;  
* mobile operation;  
* integration needs.

## **75.3 User Journeys**

Journeys are created for:

* business owner;  
* dispatcher;  
* field technician;  
* customer;  
* administrator.

Failure, recovery, and exception paths are included.

## **75.4 Requirements**

Requirements are derived and validated against:

* Intent;  
* Journeys;  
* business rules;  
* quality attributes;  
* operating constraints.

Each material Requirement receives a verification method.

## **75.5 Architecture**

Architecture PWUs define:

* bounded contexts;  
* system responsibilities;  
* tenant isolation;  
* identity and authorization;  
* data ownership;  
* mobile and web surfaces;  
* integration;  
* deployment;  
* observability.

Material choices become Architecture Decisions.

## **75.6 Invariants**

The invariant-generation process identifies properties such as:

A technician may access only work assigned or otherwise authorized.  
A customer invoice total must equal approved billable components.  
A tenant may not access another tenant’s operational data.  
A scheduled visit may not reference an inactive customer or work order.

Enforcement and verification strategies are assigned.

## **75.7 Planning**

The RPH decomposes product realization into professionally coherent vertical slices.

Example:

Customer Intake Slice  
Scheduling Slice  
Technician Work Execution Slice  
Estimate and Approval Slice  
Invoice and Payment Slice

Each slice carries Intent, Requirements, architecture, invariants, and validation.

## **75.8 Implementation**

Coding agents receive bounded contracts.

They modify code in isolated workspaces, generate tests, record assumptions, and submit structured Change proposals.

## **75.9 Verification**

Tests and analyses produce Evidence linked to Requirements and invariants.

Failures reopen implementation or earlier professional reasoning as necessary.

## **75.10 Release**

Release readiness evaluates technical, security, operational, and product conditions.

Authorized participants approve deployment with explicit residual risk.

## **75.11 Operation**

Production Observations assess:

* reliability;  
* latency;  
* workflow completion;  
* user behavior;  
* business outcomes;  
* invariant violations.

## **75.12 Reconciliation**

Observed divergence creates reconciliation work.

Examples:

* users bypass the intended scheduling workflow;  
* mobile connectivity assumptions prove invalid;  
* invoice correction rates exceed expectations;  
* the data model does not support a newly discovered business rule.

The affected Intent, Journey, Requirements, architecture, implementation, and tests are updated coherently.

---

# **76\. Coding-Agent UI Implementation Priorities**

The coding agent currently implementing JanumiCode UI/UX SHALL build in this order:

## **Phase 1 — Product-Realization Shell**

Implement:

* active organization;  
* JanumiCode PWA context;  
* active Endeavor;  
* cognitive breadcrumb;  
* dual PWU state;  
* Intent and Outcome visibility;  
* projection selector;  
* professional command region.

## **Phase 2 — PWU and Decomposition**

Implement:

* PWU overview;  
* professional objective;  
* scope;  
* assumptions;  
* Constraints;  
* dependencies;  
* child PWUs;  
* recomposition readiness.

## **Phase 3 — Product Realization Map**

Implement relationships among:

Intent  
Outcome  
Journey  
Requirement  
Architecture  
Implementation  
Verification  
Release  
Observation

## **Phase 4 — Requirements and Architecture**

Implement:

* Requirement workspace;  
* architecture Decision workspace;  
* traceability;  
* evidence;  
* assumptions;  
* invariant display.

## **Phase 5 — Implementation Workspace**

Implement:

* active implementation slice;  
* repository context;  
* coding-agent execution;  
* code Changes;  
* tests;  
* validation;  
* completion readiness.

## **Phase 6 — Verification and Reconciliation**

Implement:

* Requirement coverage;  
* invariant coverage;  
* failed validation;  
* expected versus observed;  
* reconciliation proposals;  
* impact analysis.

## **Phase 7 — Coordination**

Implement:

* RPH work portfolio;  
* blockages;  
* tactic health;  
* escalation;  
* synthesis;  
* release readiness.

---

# **77\. UI Prohibitions**

The JanumiCode UI SHALL NOT:

* organize the entire experience around chat;  
* make the file tree the primary professional structure;  
* reduce PWUs to tickets;  
* equate code generation with completion;  
* present all professional phases as a rigid waterfall;  
* hide failed reasoning or tests;  
* display one undifferentiated “progress” percentage;  
* merge proposed, reviewed, approved, implemented, and verified states;  
* imply that generated requirements are authoritative without validation;  
* treat architecture diagrams as isolated documents;  
* hide reconciliation behind generic change notifications.

---

# **78\. JSDL Extension Package**

The JanumiCode PWA SHALL be encoded as JSDL extensions.

Reference modules:

janumi.pwa.code.core  
janumi.pwa.code.product  
janumi.pwa.code.requirements  
janumi.pwa.code.architecture  
janumi.pwa.code.implementation  
janumi.pwa.code.verification  
janumi.pwa.code.release  
janumi.pwa.code.operations  
janumi.pwa.code.projections  
janumi.pwa.code.validators

The compiler SHALL generate:

* TypeScript types;  
* Command contracts;  
* Event contracts;  
* JSON Schemas;  
* Validator interfaces;  
* projection metadata;  
* documentation;  
* frontend semantic metadata.

---

# **79\. Conformance Test**

A JanumiCode implementation is conformant only if it can answer, for a material software Change:

* Which Intent does it serve?  
* Which Outcome does it affect?  
* Which Journey or Requirement motivated it?  
* Which Architecture Decision governs it?  
* Which invariants constrain it?  
* Who or what implemented it?  
* Which Evidence supports its correctness?  
* Which tests verify it?  
* Which Release includes it?  
* What was observed after deployment?  
* What assumptions remain?  
* What reconciliation has occurred?  
* Can the professional reasoning be reconstructed?

A system that can answer only:

* who committed it;  
* which files changed;  
* whether CI passed;  
* whether the ticket closed

does not yet implement the JanumiCode Professional Work Architecture.

---

# **80\. Resulting JanumiCode Experience**

JanumiCode makes software product realization visible as one evolving professional cognition system.

Product managers, architects, engineers, coding agents, reviewers, security professionals, testers, operators, and leaders do not work in disconnected modules and then manually reconstruct coherence.

They work through shared, recursively composed PWUs over a common semantic model.

The interface shows:

* why the product exists;  
* what users and organizations need;  
* what is known and assumed;  
* how the system is intended to work;  
* what implementation is changing;  
* what Evidence supports correctness;  
* what operation reveals;  
* where coherence has been lost;  
* what professional action is required next.

The result is not merely AI-assisted coding.

It is continuously coherent, AI-native software product realization.

The next artifact in the implementation sequence is the **JanumiCode UI Information Architecture and Screen Contract**, which should convert this PWA profile into a concrete screen inventory, route hierarchy, workspace composition, component contracts, and acceptance criteria for the current coding agent.

\===

# **Shape Engineering Handbook**

## **Method for Designing Professional Work Architectures**

**Specification:** SEH v0.1  
**Status:** Normative draft  
**Applies to:** Janumi Professional Workbench, Professional Work Architecture authors, domain experts, systems engineers, AI agents, ontology designers, validator developers, UX architects, and platform engineers  
**Produces:** A validated Professional Work Architecture encoded in JSDL and suitable for execution through the Janumi Platform

---

# **1\. Purpose**

Shape Engineering is the disciplined method by which an underspecified professional domain, outcome, or operating concept is transformed into an explicit, executable Professional Work Architecture.

It governs the creation of domain architectures such as:

* JanumiCode;  
* JanumiScience;  
* JanumiLegal;  
* JanumiConstruction;  
* JanumiHealthcare;  
* JanumiFinance;  
* JanumiGovernment;  
* future domain-specific professional environments.

Shape Engineering converts professional practice into:

* explicit outcomes;  
* semantic models;  
* professional roles;  
* authority structures;  
* representations;  
* reasoning patterns;  
* Professional Work Units;  
* Recursive Professional Harness behaviors;  
* validators;  
* projections;  
* interaction contracts;  
* executable JSDL definitions.

The method is not limited to documenting how a profession currently operates.

It may also define how a profession should operate within an AI-native professional organization.

---

# **2\. Central Proposition**

A Professional Work Architecture cannot be designed by beginning with screens, workflows, agents, or database entities.

It must be derived from the professional reality it is intended to support.

The canonical derivation is:

Professional Domain  
        ↓  
Desired Outcomes  
        ↓  
Professional Cognition  
        ↓  
Semantic Model  
        ↓  
Work and Coordination Model  
        ↓  
Validation and Governance  
        ↓  
Experience Model  
        ↓  
JSDL  
        ↓  
Executable Platform

Shape Engineering preserves this direction.

---

# **3\. Definition**

**Shape Engineering** is:

The recursive process of discovering, formalizing, testing, and refining the semantic, cognitive, operational, and experiential structure required to achieve professional outcomes coherently through coordinated human and artificial reasoning.

The resulting “shape” is not merely a process diagram.

It includes:

* what exists;  
* why it exists;  
* how it changes;  
* who has authority;  
* what evidence matters;  
* how uncertainty is reduced;  
* how work decomposes;  
* how understanding is reconstructed;  
* how correctness is evaluated;  
* how the professional environment is experienced;  
* how the model becomes executable.

---

# **4\. Shape Engineering Outputs**

A complete Shape Engineering effort SHALL produce:

1. Domain Characterization;  
2. Outcome Model;  
3. Stakeholder and Participant Model;  
4. Professional Cognition Model;  
5. Domain Ontology Profile;  
6. Representation Catalog;  
7. Decision, Evidence, and Confidence Model;  
8. Assumption, Constraint, Risk, and Invariant Model;  
9. Professional Work Unit Catalog;  
10. Recursive Professional Harness Model;  
11. Professional Cognition Lifecycle Profile;  
12. Validation and Governance Model;  
13. Projection and Workspace Model;  
14. Integration and Observation Model;  
15. JSDL Module Set;  
16. Conformance Test Suite;  
17. Reference Operational Scenarios;  
18. Implementation and Evolution Plan.

A PWA is not complete merely because its entities and screens have been named.

---

# **5\. Method Principles**

## **5.1 Outcomes Before Artifacts**

Begin with desired changes in reality.

Do not begin with:

* forms;  
* documents;  
* tasks;  
* dashboards;  
* agent roles;  
* existing software modules.

## **5.2 Cognition Before Workflow**

Identify what professionals must understand, decide, validate, and reconcile before describing process steps.

## **5.3 Semantics Before Technology**

Define professional meaning before selecting databases, APIs, UI frameworks, or models.

## **5.4 Explicit Uncertainty**

Unknowns, assumptions, disagreement, and incomplete knowledge are first-class design inputs.

## **5.5 Recursive Decomposition**

Large professional responsibilities are decomposed until each unit is professionally coherent and governable.

## **5.6 Reconstruction Obligation**

Every decomposition creates an explicit synthesis and recomposition obligation.

## **5.7 Human–AI Symmetry**

Human and artificial Participants are modeled through the same professional obligations while preserving differences in authority, capability, and accountability.

## **5.8 Evidence-Bearing Design**

Claims, recommendations, and Decisions remain connected to Evidence and confidence.

## **5.9 Continuous Reconciliation**

The PWA must define how professional understanding changes when reality, Intent, policy, or Evidence changes.

## **5.10 Executability**

The final architecture must be precise enough to encode in JSDL and validate mechanically.

---

# **6\. Shape Engineering Lifecycle**

The canonical Shape Engineering lifecycle contains ten phases:

1\. Frame  
2\. Observe  
3\. Model Outcomes  
4\. Model Cognition  
5\. Model Work  
6\. Model Governance  
7\. Model Experience  
8\. Encode  
9\. Validate  
10\. Operationalize and Evolve

The phases are recursive rather than strictly sequential.

Later discoveries may reopen earlier phases.

---

# **7\. Phase 1 — Frame the Domain**

## **7.1 Purpose**

Establish what professional domain or capability is being architected and why.

## **7.2 Core Questions**

* What profession, professional capability, or outcome is in scope?  
* Is the architecture describing current practice, desired future practice, or both?  
* What operating environments are included?  
* Which parts of the profession are excluded?  
* What motivates creation of the PWA?  
* Who possesses authority to define or approve it?  
* Which risks arise if the domain is modeled incorrectly?

## **7.3 Required Deliverables**

PWA Charter  
Domain Boundary Statement  
Initial Intent  
Initial Outcomes  
Scope and Non-Goals  
Authority and Sponsorship  
Initial Assumptions  
Initial Constraints  
Known Domain Sources

## **7.4 Domain Boundary Statement**

The boundary statement SHALL identify:

includedProfessionalActivities  
excludedProfessionalActivities  
organizationalScope  
jurisdictionalScope  
operatingContexts  
intendedUsers  
timeHorizon  
integrationBoundaries

## **7.5 Exploratory Versus Normative Mode**

The effort SHALL declare whether it is:

descriptive  
normative  
transformational  
hybrid

### **Descriptive**

Models how professional work currently occurs.

### **Normative**

Defines how work should occur.

### **Transformational**

Defines a materially new AI-native operating model.

### **Hybrid**

Preserves selected current practices while redesigning others.

## **7.6 Phase Gate**

The phase may complete when:

* the domain boundary is intelligible;  
* initial outcomes are identified;  
* authority is known;  
* major exclusions are explicit;  
* unresolved framing questions are recorded.

---

# **8\. Phase 2 — Observe Professional Reality**

## **8.1 Purpose**

Understand the profession as actually practiced rather than relying solely on idealized process descriptions.

## **8.2 Observation Sources**

interviews  
job\_shadowing  
existing\_documents  
regulations  
standards  
case\_files  
incident\_history  
operational\_data  
training\_material  
professional\_literature  
software\_tools  
decision\_records  
reviews  
audits

## **8.3 What to Observe**

* actual outcomes sought;  
* recurring questions;  
* decisions;  
* handoffs;  
* informal workarounds;  
* evidence use;  
* sources of delay;  
* sources of disagreement;  
* recurring failures;  
* authority boundaries;  
* hidden assumptions;  
* document and tool fragmentation;  
* reconstruction work;  
* professional judgment;  
* exceptional cases.

## **8.4 Activity Versus Cognition**

Observers SHALL distinguish:

What people do

from:

What people are trying to understand or decide

Example:

Activity: Review a contract.  
Cognition: Determine whether obligations, rights, and risks are acceptable.

The latter is more important to the PWA.

## **8.5 Professional Failure Dynamics**

The observation effort SHOULD identify recurring failure dynamics such as:

* intent drift;  
* fragmented knowledge;  
* contradictory representations;  
* unsupported conclusions;  
* authority ambiguity;  
* lost rationale;  
* stale evidence;  
* premature closure;  
* insufficient validation;  
* local optimization;  
* failed recomposition;  
* delayed escalation.

## **8.6 Deliverables**

Professional Observation Record  
Current-State Practice Map  
Tool and Repository Map  
Decision Inventory  
Evidence Inventory  
Failure-Dynamics Catalog  
Informal Practice Catalog  
Domain Vocabulary  
Open Questions

## **8.7 Phase Gate**

The phase may complete when the team can explain:

* how work really occurs;  
* how it differs from official descriptions;  
* where cognition resides;  
* where coherence is lost;  
* which professional judgments are difficult to automate.

---

# **9\. Phase 3 — Model Outcomes**

## **9.1 Purpose**

Define the desired changes in reality that justify the PWA.

## **9.2 Outcome Hierarchy**

Outcomes MAY be organized as:

Societal or Mission Outcome  
    ↓  
Organizational Outcome  
    ↓  
Professional Outcome  
    ↓  
Intermediate Outcome  
    ↓  
Enabling Outcome

## **9.3 Outcome Definition**

Each material Outcome SHALL identify:

description  
beneficiary  
successCriteria  
evaluationMethod  
timeHorizon  
negativeOutcomesToAvoid  
affectedStakeholders  
currentConfidence

## **9.4 Outcome Versus Deliverable**

The methodology SHALL challenge proposed outcomes that are actually deliverables.

Example:

Deliverable: Submit a compliance package.  
Outcome: Demonstrate and sustain compliance with applicable controls.

## **9.5 Outcome Conflict**

Conflicting Outcomes SHALL be explicit.

Examples:

* speed versus assurance;  
* cost versus resilience;  
* autonomy versus oversight;  
* privacy versus observability;  
* local optimization versus enterprise coherence.

## **9.6 Outcome Trace**

Every subsequent PWA construct SHALL be traceable to one or more Outcomes or to an explicit exploratory purpose.

## **9.7 Deliverables**

Outcome Catalog  
Outcome Hierarchy  
Success-Criteria Model  
Outcome Conflict Matrix  
Outcome Evidence Plan  
Outcome Traceability Baseline

## **9.8 Phase Gate**

The phase completes when:

* Outcomes are not merely artifacts;  
* success can be evaluated;  
* conflicts are visible;  
* beneficiaries and affected parties are known;  
* downstream work can trace to Outcomes.

---

# **10\. Phase 4 — Model Professional Cognition**

## **10.1 Purpose**

Identify how the profession transforms uncertainty into justified action.

## **10.2 Cognitive Inventory**

For each major professional responsibility, identify:

Intent  
Questions  
Uncertainties  
Representations  
Claims  
Assumptions  
Evidence  
Alternatives  
Decisions  
Actions  
Observations  
Reconciliation

## **10.3 Question Modeling**

Questions SHOULD be classified as:

descriptive  
causal  
predictive  
evaluative  
normative  
design  
verification  
operational  
strategic

## **10.4 Uncertainty Modeling**

Identify:

* what is unknown;  
* what cannot be known precisely;  
* what is disputed;  
* what depends on interpretation;  
* what changes over time;  
* what level of uncertainty is acceptable.

## **10.5 Reasoning Pattern Catalog**

Common reasoning patterns may include:

diagnosis  
comparison  
trade\_study  
risk\_analysis  
classification  
forecasting  
design  
interpretation  
verification  
validation  
causal\_analysis  
simulation  
reconciliation

## **10.6 Decision Inventory**

For each material Decision, identify:

decisionQuestion  
authority  
inputs  
alternatives  
criteria  
evidence  
assumptions  
constraints  
residualUncertainty  
revisitTriggers

## **10.7 Evidence Model**

Identify:

* what counts as Evidence;  
* source authority;  
* reliability;  
* freshness;  
* admissibility;  
* required corroboration;  
* conflicting Evidence treatment;  
* expiration.

## **10.8 Confidence Model**

The PWA SHALL define how confidence is expressed.

Options include:

ordinal  
probabilistic  
interval  
assurance\_level  
evidence\_grade  
domain\_specific\_scale

## **10.9 Deliverables**

Professional Cognition Map  
Question Catalog  
Uncertainty Taxonomy  
Reasoning Pattern Catalog  
Decision Catalog  
Evidence Model  
Confidence Model  
Reconciliation Trigger Catalog

## **10.10 Phase Gate**

The phase completes when the architecture can explain:

* what professionals reason about;  
* what they decide;  
* what Evidence matters;  
* what uncertainty remains;  
* what causes earlier conclusions to reopen.

---

# **11\. Phase 5 — Model the Domain Ontology**

## **11.1 Purpose**

Specialize CPCO for the domain without duplicating or weakening canonical semantics.

## **11.2 Ontology Mapping**

Each domain concept SHALL be mapped to:

* a CPCO primitive;  
* a specialization;  
* a relationship;  
* a value object;  
* or a justified new canonical proposal.

## **11.3 Mapping Table**

A reference mapping table:

| Domain concept | CPCO mapping | Specialization | Notes |
| ----- | ----- | ----- | ----- |
| Legal opinion | Claim and Representation | LegalOpinion | Carries jurisdiction and authority |
| Clinical test result | Evidence and Observation | ClinicalTestResult | Observation may become Evidence |
| Construction submittal | Representation and Artifact | ConstructionSubmittal | Requires review lifecycle |
| Software requirement | Representation | Requirement | Includes verification method |

## **11.4 New-Concept Test**

Before introducing a new canonical entity, ask:

1. Can it be represented through an existing CPCO entity?  
2. Can specialization preserve its meaning?  
3. Can a relationship express the distinction?  
4. Is the distinction semantic or merely presentational?  
5. Does the concept possess independent identity and lifecycle?

## **11.5 Vocabulary Governance**

The PWA SHALL define:

* preferred terms;  
* synonyms;  
* prohibited ambiguous terms;  
* domain-specific meanings;  
* mappings to external standards.

## **11.6 Deliverables**

Domain Ontology Profile  
CPCO Mapping Matrix  
Entity Definitions  
Relationship Definitions  
Value Objects  
Enumerations  
Vocabulary and Synonym Catalog  
Extension Justification Record

## **11.7 Phase Gate**

The phase completes when:

* all material domain concepts have semantic homes;  
* synonyms do not create duplicate truth;  
* entity identity is clear;  
* relationships are explicit;  
* CPCO invariants remain intact.

---

# **12\. Phase 6 — Model Professional Representations**

## **12.1 Purpose**

Identify the external cognitive structures through which professional understanding is expressed.

## **12.2 Representation Inventory**

For each Representation, identify:

name  
professionalPurpose  
owner  
audience  
inputs  
semanticContent  
lifecycle  
authority  
validation  
versioning  
relationships  
artifactForms

## **12.3 Representation Questions**

* What uncertainty does this Representation reduce?  
* Which Decisions does it support?  
* What does it claim to represent?  
* How can it become stale?  
* What depends upon it?  
* Who may revise it?  
* How is it validated?  
* What happens when reality contradicts it?

## **12.4 Artifact Separation**

The PWA SHALL distinguish Representation from Artifact.

One Representation may be embodied in:

* a document;  
* a database record;  
* a diagram;  
* source code;  
* a model;  
* an external system.

## **12.5 Authority Model**

The PWA SHALL identify whether a Representation is:

draft  
proposed  
reviewed  
validated  
approved  
authoritative  
superseded  
stale  
disputed

These states SHALL not be inferred from storage location.

## **12.6 Deliverables**

Representation Catalog  
Representation Lifecycle Models  
Artifact Mapping  
Authority Matrix  
Validation Requirements  
Staleness and Reconciliation Rules

## **12.7 Phase Gate**

The phase completes when each major Representation has:

* a professional purpose;  
* an authority model;  
* validation;  
* provenance;  
* traceability;  
* reconciliation rules.

---

# **13\. Phase 7 — Model Assumptions, Constraints, Risks, and Invariants**

## **13.1 Purpose**

Expose the conditions upon which professional reasoning and acceptable outcomes depend.

## **13.2 Assumption Analysis**

Assumptions SHALL be identified in:

* Intent;  
* Outcomes;  
* domain understanding;  
* methods;  
* evidence interpretation;  
* resource plans;  
* operating environments;  
* AI capabilities;  
* organizational authority.

## **13.3 Assumption Properties**

statement  
basis  
scope  
criticality  
validationMethod  
dependentEntities  
failureConsequences  
status

## **13.4 Constraint Model**

Constraints SHOULD be classified as:

legal  
regulatory  
ethical  
professional  
technical  
physical  
financial  
resource  
schedule  
organizational  
contractual  
security  
safety

## **13.5 Risk Model**

Each Risk SHALL connect:

cause  
uncertainty  
potentialEffect  
affectedOutcome  
likelihood  
impact  
mitigation  
observation  
owner

## **13.6 Invariant Discovery**

Invariants should be derived from:

* unacceptable Outcome failures;  
* business or professional rules;  
* safety obligations;  
* authority boundaries;  
* data integrity;  
* ethical obligations;  
* security properties;  
* required continuity;  
* irreversibility concerns.

## **13.7 Invariant Enforcement Map**

Each critical invariant SHOULD map to:

specification  
implementation  
verification  
operationalObservation  
violationResponse

## **13.8 Deliverables**

Assumption Register  
Constraint Catalog  
Risk Model  
Invariant Catalog  
Invariant Enforcement Matrix  
Violation and Reconciliation Rules

## **13.9 Phase Gate**

The phase completes when:

* critical assumptions are visible;  
* mandatory constraints are enforceable;  
* risks trace to Outcomes;  
* critical invariants have enforcement and verification strategies.

---

# **14\. Phase 8 — Derive Professional Work Units**

## **14.1 Purpose**

Define the smallest governable regions of professionally meaningful cognition.

## **14.2 PWU Derivation Questions**

A candidate PWU should answer:

* What professional objective governs it?  
* Which uncertainty or obligation does it address?  
* Can responsibility be delegated coherently?  
* Can completion be evaluated professionally?  
* Does it produce meaningful outputs?  
* Can its reasoning be reconstructed?  
* Can it be recomposed into larger work?

## **14.3 PWU Boundary Tests**

A candidate PWU is too broad when:

* it contains unrelated professional objectives;  
* authority differs materially within it;  
* independent validation is required;  
* context exceeds responsible reasoning limits;  
* completion cannot be assessed as one unit.

A candidate PWU is too narrow when:

* it is merely a mechanical step;  
* it lacks a meaningful professional objective;  
* it exists only because of implementation structure;  
* it cannot be understood without hidden parent context;  
* its output has no independent professional significance.

## **14.4 PWU Type Definition**

Each PWU type SHALL define:

name  
professionalObjectivePattern  
applicableCognitiveStates  
requiredInputs  
requiredOutputs  
roles  
authority  
completionConditions  
validationRequirements  
decompositionRules  
recompositionRules  
escalationConditions

## **14.5 Delegation Contract**

Each child PWU SHALL receive:

delegatedObjective  
scope  
nonGoals  
authority  
constraints  
inputs  
outputs  
completionConditions  
escalationConditions  
recompositionObligation

## **14.6 Deliverables**

PWU Type Catalog  
PWU Lifecycle Specializations  
Delegation Templates  
Completion Rules  
Decomposition Rules  
Recomposition Rules  
Escalation Rules

## **14.7 Phase Gate**

The phase completes when PWUs are:

* professionally meaningful;  
* bounded;  
* governable;  
* traceable;  
* validatable;  
* recursively composable.

---

# **15\. Phase 9 — Derive Recursive Professional Harness Behavior**

## **15.1 Purpose**

Define how professional work is framed, allocated, coordinated, observed, synthesized, and escalated.

## **15.2 RPH Responsibilities**

For the domain, identify:

* what the harness monitors;  
* how work is created;  
* how Participants are selected;  
* how dependencies are coordinated;  
* how progress is measured;  
* when tactics change;  
* when humans intervene;  
* how child results are synthesized;  
* when escalation is mandatory.

## **15.3 Allocation Model**

The PWA SHOULD define suitability criteria for:

human  
AI\_agent  
team  
external\_system  
specialist  
subordinate\_RPH

## **15.4 Progress Model**

Professional progress SHALL be domain-specific.

Examples:

* diagnostic uncertainty reduction;  
* evidence sufficiency;  
* design maturity;  
* review completion;  
* regulatory assurance;  
* construction readiness;  
* verification coverage.

## **15.5 Tactic-Change Model**

Define indicators such as:

repeatedFailure  
noUncertaintyReduction  
evidenceContradiction  
methodInvalidation  
authorityBlock  
resourceExhaustion  
searchOscillation  
excessiveCoordinationCost

## **15.6 Escalation Model**

Define:

* triggers;  
* recipient authority;  
* escalation package;  
* response options;  
* deadlines;  
* consequences of delay.

## **15.7 Deliverables**

RPH Responsibility Model  
Coordination State Model  
Allocation Policy  
Progress Measures  
Tactic-Change Policy  
Escalation Policy  
Synthesis Model  
Resource Governance

## **15.8 Phase Gate**

The phase completes when the architecture explains how professional work progresses even when:

* plans fail;  
* Evidence changes;  
* agents stall;  
* authority is insufficient;  
* child results conflict.

---

# **16\. Phase 10 — Define Validation and Governance**

## **16.1 Purpose**

Define what correctness, sufficiency, authority, and acceptable risk mean in the domain.

## **16.2 Validator Categories**

The PWA SHALL consider:

structural  
semantic  
professional  
methodological  
evidentiary  
coherence  
governance  
legal  
regulatory  
ethical  
security  
safety  
temporal  
outcome

## **16.3 Validator Definition**

Each Validator SHALL identify:

professionalPurpose  
subject  
criteria  
inputs  
method  
performer  
independence  
resultScale  
blockingEffect  
expiration  
limitations

## **16.4 Human and AI Validation**

The architecture SHALL define:

* which Validators may be automated;  
* which may be AI-assisted;  
* which require human judgment;  
* which require independent authority;  
* when human review is mandatory.

## **16.5 Decision Authority**

The PWA SHALL define authority for:

* proposing;  
* reviewing;  
* validating;  
* approving;  
* granting exceptions;  
* accepting risk;  
* changing Intent;  
* terminating work.

## **16.6 Governance Matrix**

A reference matrix:

| Action | Contributor | Reviewer | Validator | Approver | Exception Authority |
| ----- | ----- | ----- | ----- | ----- | ----- |
| Propose representation | Yes | Yes | Yes | Yes | Yes |
| Validate representation | No | Optional | Yes | Optional | Optional |
| Approve decision | No | No | No | Yes | Yes |
| Grant mandatory exception | No | No | No | No | Yes |

## **16.7 Deliverables**

Validator Catalog  
Validator Dependency Graph  
Authority Matrix  
Role Conflict Rules  
Approval Policies  
Exception Policies  
Risk-Acceptance Rules  
Governance Events

## **16.8 Phase Gate**

The phase completes when:

* authority is explicit;  
* validation is not confused with approval;  
* exception handling is governed;  
* AI authority is bounded;  
* professional sufficiency can be evaluated.

---

# **17\. Phase 11 — Define Projections and Workspaces**

## **17.1 Purpose**

Define how Participants experience professional cognition.

## **17.2 Projection Derivation**

Each projection SHALL begin with a professional question.

Examples:

* What remains uncertain?  
* Is this Decision ready?  
* What Evidence supports this conclusion?  
* Where has professional coherence been lost?  
* Which work requires my authority?  
* What changed in our understanding?

## **17.3 Projection Contract**

Each projection SHALL define:

purpose  
rootEntities  
includedRelationships  
filters  
temporalMode  
roleRules  
authorityRules  
requiredDisclosures  
commands  
stalenessRules

## **17.4 Workspace Model**

Workspaces SHOULD map to cognitive activities rather than existing software modules.

Canonical workspace classes include:

Outcome  
Intent  
Understanding  
Reasoning  
Evidence  
Decision  
Execution  
Observation  
Reconciliation  
Coordination  
Memory

## **17.5 Surface Profiles**

Define semantic adaptations for:

web  
desktop  
mobile  
IDE  
field  
conversational  
external\_exchange

## **17.6 Attention Model**

Define what requires professional attention and how it is prioritized.

## **17.7 Deliverables**

Projection Catalog  
Workspace Inventory  
Interaction Grammar  
Role-Based Experience Model  
Attention Model  
Surface Profiles  
UI Semantic Invariants

## **17.8 Phase Gate**

The phase completes when every major screen or workspace can answer:

* which professional cognition it exposes;  
* which Decisions it supports;  
* what authority applies;  
* which source entities make it authoritative.

---

# **18\. Phase 12 — Define Integrations and Observation**

## **18.1 Purpose**

Connect the PWA to external reality and repositories.

## **18.2 Integration Inventory**

Identify:

* authoritative external systems;  
* external evidence sources;  
* document repositories;  
* operational systems;  
* communication systems;  
* identity systems;  
* execution systems;  
* regulatory sources;  
* telemetry systems.

## **18.3 Integration Classification**

Each integration SHALL identify whether it provides:

Observation  
Evidence  
Artifact  
Representation  
Command  
Action  
Identity  
Authority  
Notification

## **18.4 Trust Boundary**

For each integration, define:

* authentication;  
* authorization;  
* source authority;  
* data validity;  
* freshness;  
* failure behavior;  
* normalization;  
* reconciliation;  
* audit.

## **18.5 Observation Model**

Define how the profession learns from reality.

Examples:

* test results;  
* field inspections;  
* production telemetry;  
* client response;  
* scientific measurements;  
* court outcomes;  
* health outcomes;  
* construction progress.

## **18.6 Deliverables**

Integration Catalog  
Authority and Source Map  
Trust-Boundary Model  
Observation Catalog  
External Event Model  
Normalization Rules  
Failure and Reconciliation Rules

## **18.7 Phase Gate**

The phase completes when external systems no longer appear as generic “integrations,” but as explicit sources of professional state and action.

---

# **19\. Phase 13 — Encode the PWA in JSDL**

## **19.1 Purpose**

Transform the validated architecture into executable semantic definitions.

## **19.2 Recommended Module Structure**

janumi.pwa.\<domain\>.core  
janumi.pwa.\<domain\>.ontology  
janumi.pwa.\<domain\>.representations  
janumi.pwa.\<domain\>.work  
janumi.pwa.\<domain\>.coordination  
janumi.pwa.\<domain\>.validators  
janumi.pwa.\<domain\>.governance  
janumi.pwa.\<domain\>.projections  
janumi.pwa.\<domain\>.integrations  
janumi.pwa.\<domain\>.observability

## **19.3 Encoding Order**

Recommended order:

1. enums and value objects;  
2. entities and extensions;  
3. relationships;  
4. lifecycles;  
5. aggregates;  
6. invariants;  
7. validators;  
8. permissions;  
9. commands;  
10. events;  
11. projections;  
12. observability;  
13. test cases.

## **19.4 Source Traceability**

Every JSDL declaration SHOULD trace to its Shape Engineering source decision or deliverable.

Example:

annotations:  
  shapeEngineeringSource:  
    phase: professional\_cognition  
    decisionId: SE-DEC-024  
    evidenceIds:  
      \- EV-102  
      \- EV-119

## **19.5 Deliverables**

JSDL Module Set  
Module Dependency Graph  
Compiler Diagnostics Baseline  
Generated Type Contracts  
Generated Schemas  
Generated Documentation  
Generated Projection Metadata

## **19.6 Phase Gate**

The phase completes when:

* JSDL compiles;  
* semantic references resolve;  
* invariants validate;  
* generated artifacts are deterministic;  
* no material design concept exists only in prose.

---

# **20\. Phase 14 — Validate the Professional Work Architecture**

## **20.1 Purpose**

Determine whether the PWA faithfully and usefully represents the profession.

## **20.2 Validation Layers**

### **Structural Validation**

Does the PWA compile and satisfy CPCO and JSDL constraints?

### **Semantic Validation**

Do entities and relationships mean what the domain requires?

### **Professional Validation**

Do domain experts recognize the architecture as credible?

### **Operational Validation**

Can realistic work be performed through it?

### **Cognitive Validation**

Does it expose the reasoning professionals need?

### **Governance Validation**

Are authority and accountability correctly represented?

### **Experience Validation**

Do workspaces support professional decisions rather than software navigation?

### **Outcome Validation**

Does the architecture improve ability to achieve Outcomes?

## **20.3 Scenario Testing**

The PWA SHALL be tested against:

routine\_case  
complex\_case  
exception\_case  
failure\_case  
conflicting\_evidence\_case  
authority\_gap\_case  
cross\_functional\_case  
long\_running\_case  
reopened\_case  
operational\_feedback\_case

## **20.4 Adversarial Review**

Reviewers SHOULD attempt to identify:

* missing concepts;  
* misleading abstractions;  
* circular definitions;  
* overfit workflows;  
* hidden assumptions;  
* untestable validators;  
* authority gaps;  
* AI overreach;  
* unbounded recursion;  
* excessive complexity;  
* missing reconciliation.

## **20.5 Deliverables**

PWA Conformance Report  
Scenario Test Results  
Expert Review Record  
Gap and Contradiction Register  
Usability Findings  
Governance Findings  
Revision Decisions

## **20.6 Phase Gate**

The phase completes when:

* representative scenarios can be executed coherently;  
* professional experts accept core semantics;  
* critical gaps are resolved or explicitly deferred;  
* implementation risks are known.

---

# **21\. Phase 15 — Operationalize and Evolve**

## **21.1 Purpose**

Deploy the PWA as a living professional system and improve it through observed use.

## **21.2 Initial Operating Profile**

Define:

* initial users;  
* supported scenarios;  
* unsupported scenarios;  
* required human oversight;  
* AI capabilities;  
* integration scope;  
* operational metrics;  
* escalation support;  
* feedback channels.

## **21.3 PWA Observation**

The PWA itself SHALL be observed.

Potential signals include:

frequent\_reopened\_work  
validator\_false\_positive  
validator\_false\_negative  
authority\_bottleneck  
projection\_avoidance  
manual\_workaround  
unmodeled\_concept  
excessive\_decomposition  
failed\_recomposition  
agent\_context\_failure  
reconciliation\_backlog

## **21.4 PWA Evolution**

Changes to the PWA SHALL use:

* versioned Shape Engineering Decisions;  
* JSDL model diff;  
* compatibility analysis;  
* semantic migration;  
* validation;  
* release governance.

## **21.5 Deliverables**

Operating Profile  
PWA Observability Model  
Evolution Backlog  
Semantic Version Policy  
Migration Strategy  
Feedback and Reconciliation Process

---

# **22\. Shape Engineering Roles**

A Shape Engineering team may include:

domain\_sponsor  
professional\_domain\_expert  
shape\_engineer  
systems\_engineer  
ontology\_architect  
work\_architect  
governance\_architect  
validator\_designer  
ux\_architect  
AI\_agent\_architect  
platform\_architect  
integration\_architect  
security\_reviewer  
professional\_reviewer

One person may fill several roles for a small PWA.

---

# **23\. Shape Engineer**

The Shape Engineer is responsible for maintaining coherence across the PWA design.

The role SHALL:

* preserve Outcome orientation;  
* distinguish cognition from activity;  
* maintain CPCO alignment;  
* surface hidden assumptions;  
* identify decomposition and reconstruction obligations;  
* connect domain semantics to JSDL;  
* prevent UI-first or workflow-first drift;  
* coordinate validation.

The Shape Engineer is not required to be the sole domain expert.

---

# **24\. AI Participation in Shape Engineering**

AI Agents may support:

domain\_research  
vocabulary\_extraction  
decision\_inventory  
assumption\_surfacing  
failure\_mode\_analysis  
ontology\_mapping  
representation\_cataloging  
PWU\_candidate\_generation  
validator\_generation  
scenario\_generation  
contradiction\_detection  
JSDL\_generation  
documentation\_generation

AI-generated Shape Engineering outputs SHALL remain proposed until appropriately reviewed.

---

# **25\. Shape Engineering PWUs**

The Shape Engineering effort should itself be represented through PWUs.

Canonical types include:

domain\_framing  
professional\_observation  
outcome\_modeling  
cognition\_modeling  
ontology\_modeling  
representation\_modeling  
invariant\_modeling  
pwu\_design  
rph\_design  
governance\_design  
projection\_design  
integration\_design  
jsdl\_encoding  
pwa\_validation  
pwa\_operationalization

This makes PWA creation an instance of the same professional cognition model it produces.

---

# **26\. Shape Engineering Decision Record**

Material design choices SHALL be preserved.

A Shape Engineering Decision SHOULD include:

decisionQuestion  
professionalContext  
alternatives  
selectedApproach  
rationale  
evidence  
assumptions  
constraints  
consequences  
affectedPwaElements  
revisitTriggers

Examples:

* whether a concept should be an entity or relationship;  
* whether a process requires independent validation;  
* whether an AI Agent may approve;  
* whether two PWU types should be merged;  
* whether a domain-specific confidence scale is required.

---

# **27\. Professional Work Architecture Charter**

A PWA Charter SHOULD include:

PWA Name  
Domain  
Mission  
Intended Outcomes  
Target Professionals  
Target Organizations  
Operating Contexts  
Scope  
Non-Goals  
Authority  
Transformation Ambition  
Initial AI Role  
Critical Risks  
Success Criteria

---

# **28\. PWA Conformance Model**

A PWA is conformant when it:

1. preserves CPCO semantic distinctions;  
2. defines domain Outcomes;  
3. identifies professional Participants and authority;  
4. defines domain Representations;  
5. models Questions, Evidence, Decisions, and uncertainty;  
6. defines PWU types;  
7. defines RPH coordination behavior;  
8. defines validation and governance;  
9. defines projections and workspaces;  
10. defines reconciliation;  
11. encodes material semantics in JSDL;  
12. passes scenario and conformance testing.

---

# **29\. PWA Maturity Levels**

## **Level 0 — Vocabulary**

The domain has named concepts but no coherent architecture.

## **Level 1 — Documented Practice**

Activities, roles, and artifacts are documented.

## **Level 2 — Semantic Architecture**

Domain concepts, relationships, Decisions, and Evidence are explicit.

## **Level 3 — Executable Work Architecture**

PWUs, lifecycles, Commands, Events, authority, and Validators are encoded.

## **Level 4 — AI-Native Operation**

Human and AI Participants operate through the PWA with governed coordination.

## **Level 5 — Continuously Reconciled Profession**

The domain model, work, operation, and Outcomes are continuously observed and reconciled.

A PWA should not claim Level 4 or Level 5 merely because it uses generative AI.

---

# **30\. PWA Quality Dimensions**

A PWA SHOULD be evaluated across:

outcome\_fidelity  
semantic\_clarity  
professional\_credibility  
cognitive\_completeness  
traceability  
governance\_integrity  
evidence\_integrity  
recursive\_composability  
reconstructability  
reconciliation\_capability  
experience\_coherence  
executability  
evolvability

---

# **31\. Outcome Fidelity**

Does the PWA remain centered on real professional Outcomes rather than artifact production?

Failure signals:

* success defined as document generation;  
* excessive task orientation;  
* workflows without Outcome trace;  
* no operational validation.

---

# **32\. Semantic Clarity**

Are concepts distinct and consistently defined?

Failure signals:

* Decision and Claim conflated;  
* Observation and Evidence conflated;  
* approval and validation conflated;  
* Artifact and Representation conflated;  
* workflow state inferred from missing fields.

---

# **33\. Professional Credibility**

Would competent professionals recognize the PWA as reflecting the substantive demands of their work?

Failure signals:

* superficial role names;  
* idealized happy paths;  
* missing exceptions;  
* ignored authority;  
* absent professional judgment;  
* automation of inherently unresolved questions.

---

# **34\. Cognitive Completeness**

Does the architecture represent:

* uncertainty;  
* questions;  
* assumptions;  
* evidence;  
* alternatives;  
* decisions;  
* confidence;  
* observations;  
* reconciliation?

A system that only models tasks and outputs is cognitively incomplete.

---

# **35\. Recursive Composability**

Can complex work decompose without losing meaning?

Can child results be reconstructed into parent understanding?

Failure signals:

* arbitrary task fragmentation;  
* no delegation contracts;  
* no recomposition;  
* completed children treated as completed parent;  
* hidden cross-boundary assumptions.

---

# **36\. Governance Integrity**

Does authority match professional consequence?

Failure signals:

* UI permissions treated as authority;  
* AI approving its own material output;  
* no exception authority;  
* unclear risk acceptance;  
* validator and approver conflated.

---

# **37\. Reconciliation Capability**

Can the PWA handle:

* new Evidence;  
* failed assumptions;  
* changed Intent;  
* contradictory Representations;  
* operational variance;  
* stale policy;  
* cross-PWU conflict?

Failure signals:

* overwrite instead of reconciliation;  
* no historical state;  
* no impact analysis;  
* “completed” work cannot reopen.

---

# **38\. Experience Coherence**

Does the UI expose one professional cognition model through multiple projections?

Failure signals:

* separate truth per module;  
* file hierarchy as primary architecture;  
* chat history as memory;  
* generic dashboards;  
* hidden uncertainty;  
* unexplained status colors.

---

# **39\. Shape Engineering Anti-Patterns**

## **39.1 Screen-First Design**

Beginning with page inventory before defining professional cognition.

## **39.2 Workflow Transcription**

Copying an existing process diagram into software without questioning why the process exists.

## **39.3 Artifact Ontology**

Treating documents, forms, and files as the profession’s primary semantic objects.

## **39.4 Agent Role Proliferation**

Creating many named agents without defining distinct professional responsibilities.

## **39.5 Happy-Path Modeling**

Ignoring exceptions, disagreement, uncertainty, escalation, and failure.

## **39.6 Automation Inflation**

Assuming every professional judgment should become autonomous.

## **39.7 Domain Vocabulary Duplication**

Creating domain entities that duplicate CPCO concepts under different names.

## **39.8 Validation Theater**

Adding review steps without explicit criteria, authority, or Evidence.

## **39.9 Recursive Explosion**

Decomposing work indefinitely without cost controls or synthesis.

## **39.10 False Formalism**

Encoding a weak professional model precisely without validating whether the model is substantively correct.

---

# **40\. Shape Engineering Review Questions**

Before approving a PWA, reviewers SHALL be able to answer:

* What real Outcomes does this architecture support?  
* What makes the work professionally difficult?  
* What uncertainty is being reduced?  
* Which Decisions matter?  
* What Evidence justifies them?  
* Which assumptions carry the most risk?  
* Which invariants must remain true?  
* How does work decompose?  
* How is it recomposed?  
* When does tactic change occur?  
* When must work escalate?  
* Which AI actions require human review?  
* What happens when reality contradicts the model?  
* How is the current state experienced in the UI?  
* Which parts are encoded in JSDL?  
* How will the PWA evolve?

---

# **41\. Reference Shape Engineering Repository**

pwa-\<domain\>/  
├── charter/  
│   └── pwa-charter.md  
├── research/  
│   ├── observations/  
│   ├── interviews/  
│   ├── standards/  
│   └── evidence/  
├── models/  
│   ├── outcomes/  
│   ├── cognition/  
│   ├── ontology/  
│   ├── representations/  
│   ├── work/  
│   ├── governance/  
│   ├── projections/  
│   └── integrations/  
├── decisions/  
├── scenarios/  
├── jsdl/  
├── generated/  
├── conformance/  
├── migrations/  
└── releases/

---

# **42\. Reference Deliverable Index**

A complete PWA package SHOULD contain:

PWA-001 Charter  
PWA-002 Domain Boundary  
PWA-003 Outcome Model  
PWA-004 Stakeholder Model  
PWA-005 Participant and Authority Model  
PWA-006 Cognition Model  
PWA-007 Ontology Profile  
PWA-008 Representation Catalog  
PWA-009 Assumption Register  
PWA-010 Constraint Model  
PWA-011 Risk Model  
PWA-012 Invariant Catalog  
PWA-013 PWU Catalog  
PWA-014 RPH Model  
PWA-015 Validator Catalog  
PWA-016 Governance Matrix  
PWA-017 Projection Catalog  
PWA-018 Workspace Model  
PWA-019 Integration Model  
PWA-020 Observation Model  
PWA-021 JSDL Modules  
PWA-022 Conformance Tests  
PWA-023 Reference Scenarios  
PWA-024 Operating Profile  
PWA-025 Evolution Plan

---

# **43\. Minimum Viable Shape Engineering**

A smaller PWA effort MAY begin with:

Charter  
Outcome Model  
Cognition Model  
Ontology Profile  
Representation Catalog  
PWU Catalog  
Validator Catalog  
Projection Catalog  
JSDL Core Module  
Three Reference Scenarios  
Conformance Review

The effort SHALL explicitly identify deferred architecture areas.

---

# **44\. Reference Scenario Template**

Each scenario SHOULD include:

scenarioName  
professionalContext  
participants  
originatingIntent  
desiredOutcome  
initialState  
uncertainties  
evidence  
decisions  
pwuStructure  
rphBehavior  
exceptions  
observations  
reconciliation  
completionAssessment

---

# **45\. PWA Scenario Set**

Every PWA SHOULD include at least:

## **45.1 Routine Scenario**

Common professional work with expected Evidence and authority.

## **45.2 Ambiguous Scenario**

Intent or Evidence is incomplete.

## **45.3 Conflicting-Evidence Scenario**

Credible Evidence supports incompatible conclusions.

## **45.4 Authority Scenario**

Work reaches an authority boundary.

## **45.5 Failure Scenario**

The selected method or Action fails.

## **45.6 Cross-Functional Scenario**

Several disciplines must coordinate.

## **45.7 Long-Running Scenario**

Work suspends and resumes across time.

## **45.8 Reopened Scenario**

Completed work is reopened by new Evidence.

## **45.9 Operational Feedback Scenario**

Observed reality contradicts professional expectations.

## **45.10 AI-Escalation Scenario**

An AI Participant recognizes that it cannot continue responsibly.

---

# **46\. Shape Engineering Commands**

Canonical Shape Engineering Commands may include:

CreatePwaCharter  
ReviseDomainBoundary  
DefineOutcome  
RegisterDomainConcept  
MapConceptToCpco  
DefineRepresentation  
RegisterAssumption  
DefineInvariant  
CreatePwuType  
DefineRphPolicy  
CreateValidator  
DefineAuthorityRule  
CreateProjection  
AddReferenceScenario  
EncodeJsdlModule  
ValidatePwa  
ApprovePwaRelease  
SupersedePwaVersion

---

# **47\. Shape Engineering Events**

Canonical events may include:

PwaCharterCreated  
DomainBoundaryRevised  
OutcomeDefined  
DomainConceptRegistered  
CpcoMappingApproved  
RepresentationDefined  
CriticalAssumptionIdentified  
InvariantAccepted  
PwuTypeDefined  
RphPolicyDefined  
ValidatorApproved  
AuthorityRuleApproved  
ProjectionDefined  
ReferenceScenarioValidated  
JsdlModuleCompiled  
PwaConformancePassed  
PwaReleased  
PwaSuperseded

---

# **48\. Shape Engineering Invariants**

## **SE-INV-001 — Outcome Traceability**

Every material PWA construct SHALL trace to an Outcome, Intent, obligation, or explicit exploratory purpose.

## **SE-INV-002 — CPCO Preservation**

Domain specialization SHALL not weaken CPCO semantic distinctions.

## **SE-INV-003 — Explicit Authority**

Material Commands and Decisions SHALL identify required authority.

## **SE-INV-004 — Evidence Integrity**

Professional Claims and Decisions SHALL preserve Evidence relationships.

## **SE-INV-005 — Critical Assumption Visibility**

Critical assumptions SHALL be explicit.

## **SE-INV-006 — Work Coherence**

Every PWU type SHALL possess a professionally meaningful objective.

## **SE-INV-007 — Recomposition**

Recursive decomposition SHALL define reconstruction obligations.

## **SE-INV-008 — Validator Semantics**

Validators SHALL define criteria and professional effect.

## **SE-INV-009 — AI Authority Boundaries**

AI authority SHALL be explicit and bounded.

## **SE-INV-010 — Reconciliation**

The PWA SHALL define how changed reality updates professional understanding.

## **SE-INV-011 — Projection Authority**

Workspaces SHALL derive from authoritative semantic state.

## **SE-INV-012 — Executable Semantics**

Material architecture concepts SHALL be encoded in JSDL or explicitly identified as non-executable doctrine.

## **SE-INV-013 — Scenario Validation**

A PWA SHALL pass representative operational scenarios before release.

## **SE-INV-014 — Versioned Evolution**

Material PWA changes SHALL be versioned and assessed for compatibility.

## **SE-INV-015 — No False Completion**

PWA approval SHALL not be based solely on document completion or successful compilation.

---

# **49\. Shape Engineering Conformance Test**

A Shape Engineering effort is conformant when it can demonstrate:

* the domain is bounded;  
* real Outcomes are explicit;  
* professional cognition is modeled;  
* CPCO mappings are complete;  
* critical Representations are defined;  
* assumptions and invariants are visible;  
* PWUs are professionally coherent;  
* RPH coordination handles failure and tactic change;  
* authority and validation are explicit;  
* projections support professional reasoning;  
* external reality can update the model;  
* JSDL compiles;  
* representative scenarios pass;  
* evolution is governed.

---

# **50\. Application to JanumiCode**

JanumiCode is the first reference application of Shape Engineering.

Its development should now be interpreted as:

Shape Engineering Method  
        ↓  
JanumiCode Professional Work Architecture  
        ↓  
JanumiCode JSDL Modules  
        ↓  
Generated Semantic Contracts  
        ↓  
Janumi Runtime  
        ↓  
JanumiCode Workbench and VS Code Experience

JanumiCode is therefore not the template from which every profession is copied.

It is one PWA produced by the Shape Engineering method.

---

# **51\. Application to Future PWAs**

## **51.1 JanumiScience**

Would specialize:

* hypotheses;  
* experiments;  
* datasets;  
* scientific claims;  
* reproducibility;  
* uncertainty;  
* peer review;  
* research protocols;  
* scientific Evidence.

## **51.2 JanumiLegal**

Would specialize:

* matters;  
* legal issues;  
* authorities;  
* arguments;  
* obligations;  
* opinions;  
* legal decisions;  
* jurisdictions;  
* privilege;  
* review and approval.

## **51.3 JanumiConstruction**

Would specialize:

* project outcomes;  
* design;  
* permits;  
* submittals;  
* RFIs;  
* field observations;  
* schedule;  
* safety;  
* quality;  
* subcontractor coordination;  
* change orders;  
* inspections.

## **51.4 JanumiHealthcare**

Would specialize:

* patient outcomes;  
* clinical questions;  
* observations;  
* diagnoses;  
* treatments;  
* clinical Evidence;  
* consent;  
* safety;  
* care coordination;  
* outcome monitoring.

Each PWA remains domain-specific while preserving the same professional cognition foundation.

---

# **52\. Shape Engineering as a Platform Capability**

The Janumi Professional Workbench SHOULD eventually support Shape Engineering directly.

Potential capabilities include:

PWA Charter Workspace  
Outcome Modeler  
Ontology Mapper  
Representation Catalog  
Assumption and Invariant Workspace  
PWU Designer  
RPH Policy Designer  
Validator Studio  
Authority Matrix Editor  
Projection Designer  
Scenario Simulator  
JSDL Editor  
Compiler Diagnostics  
Conformance Dashboard  
PWA Release Manager

These workspaces would allow domain architects to construct PWAs without manually editing every JSDL file.

---

# **53\. Generated Versus Handcrafted Architecture**

Shape Engineering SHOULD support three levels of authoring:

## **53.1 Guided Authoring**

Structured workspaces help domain experts define the PWA.

## **53.2 AI-Assisted Authoring**

Agents propose models, mappings, Validators, and scenarios.

## **53.3 Direct JSDL Authoring**

Advanced architects edit canonical definitions directly.

All three SHALL converge on the same JSDL source of truth.

---

# **54\. Shape Engineering Meta-RPH**

The creation of a PWA may itself be coordinated by a Shape Engineering RPH.

A reference structure:

Shape Engineering RPH  
├── Domain Research RPH  
├── Outcome Modeling RPH  
├── Cognition Modeling RPH  
├── Ontology RPH  
├── Work Architecture RPH  
├── Governance RPH  
├── Experience RPH  
├── JSDL Encoding RPH  
└── PWA Validation RPH

The meta-RPH SHALL synthesize all child outputs into one coherent PWA.

---

# **55\. Resulting Strategic Interpretation**

Shape Engineering establishes Janumi’s highest-level generative capability.

Janumi is not merely:

* a platform for agents;  
* a workflow system;  
* a professional knowledge graph;  
* a coding environment;  
* a collection of domain applications.

It is a system for transforming professional knowledge, reasoning, authority, and practice into executable Professional Work Architectures.

In that precise sense, Janumi functions as a compiler for professions:

Professional Reality  
        ↓  
Shape Engineering  
        ↓  
Professional Work Architecture  
        ↓  
JSDL  
        ↓  
Janumi Execution Model  
        ↓  
Runtime  
        ↓  
AI-Native Professional Organization

The phrase “compiler for professions” does not mean that a profession is reduced to deterministic software.

It means that its explicit professional structures become sufficiently formalized to be:

* inspected;  
* coordinated;  
* validated;  
* assisted;  
* executed where appropriate;  
* observed;  
* continuously reconciled.

Professional judgment, uncertainty, and human authority remain part of the executable model rather than being abstracted away.

---

# **56\. Immediate Implementation Consequence**

The conceptual foundation is now complete enough to stop introducing new architecture layers.

The next implementation deliverable SHALL be the **JanumiCode UI Information Architecture and Screen Contract**.

That artifact shall define:

* concrete route hierarchy;  
* screen inventory;  
* workspace composition;  
* component contracts;  
* required data projections;  
* professional Commands;  
* loading and failure behavior;  
* responsive profiles;  
* screen-level acceptance criteria;  
* implementation sequence for the current coding agent.

No new conceptual document is required before that work begins.

The next step is therefore concrete UI specification rather than another foundational layer.

\===

# **JanumiCode UI Information Architecture and Screen Contract**

## **JCUX Specification v0.1**

**Status:** Normative draft  
**Applies to:** Janumi Professional Workbench web application and JanumiCode PWA  
**Related surface:** JanumiCode VS Code extension  
**Depends on:** JCPWA v0.1, RIWS v0.1, CPM v0.1, PWU Specification v0.1, RPH Specification v0.1  
**Primary audience:** Coding agents, frontend engineers, UX designers, backend engineers, test engineers  
**Reference frontend:** SvelteKit and Svelte  
**Reference interaction model:** Server-authoritative projections with semantic commands

---

# **1\. Purpose**

This specification defines the concrete information architecture, route hierarchy, screen inventory, workspace composition, screen contracts, and implementation sequence for the JanumiCode user interface.

It is intended to remove ambiguity for the coding agent currently implementing the JanumiCode experience.

The interface SHALL implement JanumiCode as a professional cognition environment.

It SHALL not implement JanumiCode primarily as:

* a chat application;  
* a task tracker;  
* a document repository;  
* a file browser;  
* an agent-run dashboard;  
* a rigid software-development workflow;  
* a collection of disconnected product modules.

The interface SHALL expose one authoritative product-realization model through multiple cognitive projections.

---

# **2\. Primary User Experience**

A user entering JanumiCode should be able to determine, without reconstructing state from multiple tools:

* what product Outcome is being pursued;  
* why current work exists;  
* which Professional Work Unit is active;  
* what is known;  
* what remains uncertain;  
* which assumptions are critical;  
* what reasoning is underway;  
* what decisions require attention;  
* what implementation is changing;  
* what Evidence supports correctness;  
* what is blocked;  
* where professional coherence has been lost;  
* what action the user is authorized to take next.

---

# **3\. Global Information Architecture**

The top-level navigation SHALL be:

Home  
Outcomes  
Endeavors  
Work  
Product Realization  
Decisions  
Evidence  
Reconciliation  
Coordination  
Attention  
Memory

JanumiCode-specific secondary destinations SHALL include:

Requirements  
Architecture  
Implementation  
Verification  
Releases  
Operations

These destinations are named projections over the same semantic model.

They SHALL not own separate truth.

---

# **4\. Canonical Route Hierarchy**

/{organizationId}/home

/{organizationId}/outcomes  
/{organizationId}/outcomes/{outcomeId}

/{organizationId}/endeavors  
/{organizationId}/endeavors/{endeavorId}

/{organizationId}/pwus  
/{organizationId}/pwus/{pwuId}  
/{organizationId}/pwus/{pwuId}/understanding  
/{organizationId}/pwus/{pwuId}/reasoning  
/{organizationId}/pwus/{pwuId}/evidence  
/{organizationId}/pwus/{pwuId}/decisions  
/{organizationId}/pwus/{pwuId}/implementation  
/{organizationId}/pwus/{pwuId}/verification  
/{organizationId}/pwus/{pwuId}/observations  
/{organizationId}/pwus/{pwuId}/reconciliation  
/{organizationId}/pwus/{pwuId}/decomposition  
/{organizationId}/pwus/{pwuId}/history

/{organizationId}/realization  
/{organizationId}/realization/{endeavorId}

/{organizationId}/requirements  
/{organizationId}/requirements/{requirementId}

/{organizationId}/architecture  
/{organizationId}/architecture/{architectureEntityId}  
/{organizationId}/architecture/decisions/{decisionId}

/{organizationId}/implementation  
/{organizationId}/implementation/changes/{changeId}  
/{organizationId}/implementation/agents/{agentExecutionId}

/{organizationId}/verification  
/{organizationId}/verification/{verificationId}

/{organizationId}/releases  
/{organizationId}/releases/{releaseId}

/{organizationId}/operations  
/{organizationId}/operations/incidents/{incidentId}

/{organizationId}/decisions  
/{organizationId}/decisions/{decisionId}

/{organizationId}/evidence  
/{organizationId}/evidence/{evidenceId}

/{organizationId}/reconciliations  
/{organizationId}/reconciliations/{reconciliationId}

/{organizationId}/coordination  
/{organizationId}/coordination/{rphId}

/{organizationId}/attention  
/{organizationId}/memory

---

# **5\. Application Shell Contract**

Every authenticated JanumiCode route SHALL render within the canonical application shell.

## **5.1 Required Shell Regions**

Global Header  
Global Navigation Rail  
Cognitive Breadcrumb  
Workspace Header  
Projection Navigation  
Primary Workspace  
Context Inspector  
Command Region  
Attention Indicator

## **5.2 Global Header**

The Global Header SHALL show:

Organization  
Active PWA: JanumiCode  
Current Endeavor  
Current Role  
Temporal Mode  
Global Search  
Attention Count  
System Capability Status  
Participant Menu

## **5.3 Global Navigation Rail**

The navigation rail SHALL provide stable access to top-level projections.

The active destination SHALL be visually and semantically identifiable.

## **5.4 Cognitive Breadcrumb**

The breadcrumb SHALL represent professional context.

Example:

Janumi  
› Field Service Platform  
› Scheduling Capability  
› Architecture PWU  
› Decision: Consistency Model

The breadcrumb SHALL not merely repeat URL segments.

## **5.5 Workspace Header**

The Workspace Header SHALL show:

Title  
Entity Type  
Professional Objective  
Lifecycle State  
Cognitive State  
Originating Intent  
Current Confidence  
Primary Uncertainty  
Owner or Coordinator  
Last Material Change

---

# **6\. Shared Screen State Contract**

Every screen SHALL distinguish the following state categories:

authoritativeProjectionState  
technicalFetchState  
localInteractionState  
localDraftState  
commandState  
authorizationState  
temporalState  
stalenessState

These SHALL not be collapsed into one generic loading or status field.

## **6.1 Technical Fetch States**

idle  
loading  
refreshing  
loaded  
partial  
stale  
offline  
failed

## **6.2 Command States**

idle  
validating  
awaiting\_confirmation  
submitting  
accepted  
rejected  
conflicted

## **6.3 Temporal States**

current  
historical  
comparison  
predicted  
offline\_snapshot

---

# **7\. Shared Screen Invariants**

## **SCREEN-INV-001 — Intent Access**

Every material screen SHALL provide access to originating Intent.

## **SCREEN-INV-002 — Objective Access**

Every PWU screen SHALL display the professional objective.

## **SCREEN-INV-003 — Dual State**

Lifecycle state and cognitive state SHALL be shown separately.

## **SCREEN-INV-004 — Authority**

Available Commands SHALL derive from role and authority.

## **SCREEN-INV-005 — Provenance**

Claims, Evidence, AI outputs, Decisions, and changes SHALL expose provenance.

## **SCREEN-INV-006 — Uncertainty**

Material uncertainty SHALL remain visible.

## **SCREEN-INV-007 — Contradiction**

Relevant contradictions SHALL not be hidden.

## **SCREEN-INV-008 — Staleness**

Stale or partial projections SHALL be identified.

## **SCREEN-INV-009 — No Direct Mutation**

UI components SHALL issue semantic Commands.

They SHALL not mutate authoritative state directly.

## **SCREEN-INV-010 — Context Preservation**

Moving between projections SHALL preserve active professional context.

---

# **8\. Home Screen**

## **Route**

/{organizationId}/home

## **Purpose**

Orient the current Participant to the state of product realization and the work requiring professional attention.

## **Primary Questions**

* What changed materially?  
* What requires my attention?  
* Which Outcomes are at risk?  
* Which Decisions are waiting?  
* Where is work blocked?  
* What did AI Participants complete?  
* Where has coherence degraded?

## **Required Sections**

Current Professional Attention  
Outcome Health  
Active Endeavors  
Material Changes  
Pending Decisions  
Blocked PWUs  
Reconciliation Required  
AI Work Requiring Review  
Recent Observations

## **Required Commands**

Open Attention Item  
Review Decision  
Open PWU  
Inspect Change  
Start Reconciliation  
Delegate Attention

## **Prohibitions**

The Home screen SHALL not become:

* a generic activity feed;  
* a notification inbox;  
* a collection of vanity metrics;  
* a project-status dashboard.

## **Acceptance Criteria**

* Material changes are prioritized above simple recency.  
* Each item links to professional context.  
* AI output requiring review is distinguishable from approved work.  
* Blocked work explains the blocking condition.  
* Stale projections disclose their age.

---

# **9\. Outcomes Screen**

## **Route**

/{organizationId}/outcomes

## **Purpose**

Show the desired and observed product Outcomes across Endeavors.

## **Required Views**

Outcome Portfolio  
Outcome Hierarchy  
Outcome-to-Endeavor Map  
Outcome Risk View  
Outcome Observation View

## **Outcome Card Contract**

Each Outcome SHALL show:

Description  
Beneficiary  
Current Assessment  
Success Criteria  
Supporting Endeavors  
Current Confidence  
Threatening Uncertainty  
Recent Observations  
Outcome Type

## **Commands**

Define Outcome  
Revise Outcome  
Link Endeavor  
Record Assessment  
Identify Risk  
Open Reconciliation

## **Acceptance Criteria**

* Deliverables are not presented as Outcomes.  
* Current assessment and desired state remain distinct.  
* Supporting work can be traced to the Outcome.  
* Observed adverse Outcomes are visible.

---

# **10\. Outcome Detail Screen**

## **Route**

/{organizationId}/outcomes/{outcomeId}

## **Required Projections**

Overview  
Intent  
Supporting Work  
Evidence  
Observations  
Risks  
History

## **Required Screen Regions**

Outcome Definition  
Success Criteria  
Current Assessment  
Confidence  
Supporting Intents  
Supporting PWUs  
Threatening Risks  
Observed Variance  
Pending Decisions

## **Acceptance Criteria**

* The user can trace from Outcome to implementation and Observation.  
* Success criteria identify evaluation methods.  
* Outcome confidence identifies its basis.

---

# **11\. Endeavors Screen**

## **Route**

/{organizationId}/endeavors

## **Purpose**

Show bounded product-realization undertakings.

## **Required Groupings**

Active  
Framing  
Blocked  
Awaiting Decision  
Reconciling  
Completed  
Suspended

## **Endeavor Card Contract**

Title  
Endeavor Type  
Primary Outcome  
Primary Intent  
Current Phase Regions  
Root PWUs  
Current Confidence  
Primary Uncertainty  
Blocking Condition  
Coordinator

## **Acceptance Criteria**

* Endeavors are not shown only as project status.  
* Multiple active cognitive regions may be represented.  
* Each Endeavor links to the Product Realization Map.

---

# **12\. Endeavor Detail Screen**

## **Route**

/{organizationId}/endeavors/{endeavorId}

## **Purpose**

Provide the main operating context for one product-realization undertaking.

## **Required Tabs**

Overview  
Product Realization  
Outcomes  
PWUs  
Decisions  
Evidence  
Releases  
Observations  
Reconciliation  
History

## **Overview Sections**

Intent  
Desired Outcomes  
Current Understanding  
Root PWUs  
Major Decisions  
Current Risks  
Current Assumptions  
Recent Material Changes  
Completion or Release Readiness

## **Commands**

Revise Intent  
Create PWU  
Create Decision  
Identify Uncertainty  
Add Evidence  
Start Reconciliation  
Create Release

---

# **13\. Work Screen**

## **Route**

/{organizationId}/pwus

## **Purpose**

Present Professional Work Units by professional condition.

## **Canonical Groupings**

Needs Framing  
Ready  
Actively Reasoning  
Awaiting Evidence  
Awaiting Decision  
Awaiting Review  
Blocked  
Reconciling  
Ready for Synthesis  
Completed  
Escalated

## **Filters**

Endeavor  
PWU Type  
Lifecycle State  
Cognitive State  
Owner  
Participant Type  
Outcome  
Attention Required  
Confidence  
Uncertainty Severity

## **Prohibitions**

The default view SHALL not use a generic:

To Do  
In Progress  
Done

Kanban model.

A Kanban presentation MAY exist as an optional projection where semantically justified.

---

# **14\. PWU Overview Screen**

## **Route**

/{organizationId}/pwus/{pwuId}

## **Purpose**

Provide the canonical local orientation view for one PWU.

## **Required Header**

Title  
PWU Type  
Professional Objective  
Lifecycle State  
Cognitive State  
Parent PWU  
Root PWU  
Originating Intent  
Owner  
RPH Coordinator  
Current Confidence  
Primary Uncertainty

## **Required Sections**

### **Objective and Scope**

Professional Objective  
Included Scope  
Excluded Scope  
Non-Goals  
Completion Conditions

### **Current Professional State**

Current Understanding  
Open Questions  
Critical Assumptions  
Constraints  
Current Blocker  
Required Attention

### **Active Work**

Reasoning Activities  
Agent Executions  
Human Reviews  
Validations  
Actions

### **Completion Readiness**

Completion Conditions  
Required Validations  
Dependencies  
Residual Uncertainty  
Recomposition Status

### **Material Changes**

Prioritized by professional impact.

## **Primary Commands**

Start Work  
Identify Uncertainty  
Add Assumption  
Add Evidence  
Start Reasoning  
Propose Decision  
Block PWU  
Request Review  
Start Reconciliation  
Decompose PWU  
Complete PWU  
Escalate

## **Acceptance Criteria**

* Completion cannot be requested when mandatory conditions are unsatisfied.  
* Disabled Commands explain why.  
* AI-originated content remains attributable.  
* The active PWU objective remains visible across projections.

---

# **15\. PWU Understanding Screen**

## **Route**

/{organizationId}/pwus/{pwuId}/understanding

## **Required Sections**

Open Questions  
Known Claims  
Contested Claims  
Uncertainties  
Critical Assumptions  
Constraints  
Confidence Distribution  
Contradictions

## **Question Card Contract**

Question  
Question Type  
Status  
Importance  
Decision Impact  
Assigned Reasoning  
Resolution Criteria

## **Assumption Card Contract**

Statement  
Status  
Criticality  
Basis  
Validation Method  
Dependent Entities  
Failure Consequence

## **Commands**

Open Question  
Refine Question  
Decompose Question  
Identify Uncertainty  
Register Assumption  
Challenge Assumption  
Validate Assumption  
Propose Claim

---

# **16\. PWU Reasoning Screen**

## **Route**

/{organizationId}/pwus/{pwuId}/reasoning

## **Views**

Reasoning Graph  
Activity List  
Alternatives  
Methods  
Synthesis  
Agent Contributions

## **Reasoning Activity Contract**

Purpose  
Reasoning Type  
Status  
Participant  
Inputs  
Method  
Outputs  
Assumptions Introduced  
Limitations  
Confidence Effect  
Validation Status

## **Commands**

Start Reasoning  
Assign Reasoner  
Request Research  
Compare Alternatives  
Challenge Claim  
Change Tactic  
Request Specialist  
Escalate

## **Acceptance Criteria**

* Failed and inconclusive reasoning remains visible.  
* Agent activity is not displayed as authoritative by default.  
* Method, Evidence, assumptions, and limitations can be inspected.  
* Hidden chain-of-thought is not required.

---

# **17\. PWU Evidence Screen**

## **Route**

/{organizationId}/pwus/{pwuId}/evidence

## **Views**

Evidence Table  
Claim–Evidence Matrix  
Evidence Graph  
Gap Analysis  
Contradiction Analysis  
Provenance

## **Evidence Card Contract**

Evidence Type  
Source  
Observed or Published Time  
Recorded Time  
Reliability  
Relevance  
Relationship Type  
Supported Claims  
Contradicted Claims  
Validation  
Provenance

## **Commands**

Add Evidence  
Classify Relationship  
Validate Source  
Challenge Evidence  
Mark Stale  
Request Evidence  
Link Observation

## **Acceptance Criteria**

* Attachment does not imply evidentiary support.  
* Support, contradiction, qualification, and inconclusive relationships are explicit.  
* Unsupported material Claims are visible.

---

# **18\. PWU Decisions Screen**

## **Route**

/{organizationId}/pwus/{pwuId}/decisions

## **Purpose**

Show Decisions affecting the PWU and their readiness.

## **Decision Summary Contract**

Decision Question  
Status  
Authority  
Readiness  
Alternatives  
Evidence Sufficiency  
Constraints Checked  
Residual Uncertainty  
Required Review

## **Commands**

Create Decision  
Propose Alternative  
Add Evidence  
Request Decision  
Review Decision  
Approve  
Reject  
Defer  
Reopen

## **Acceptance Criteria**

* Decision status remains distinct from truth or validation.  
* Approval requires authority.  
* Contradicting Evidence remains visible.  
* Readiness is explainable by dimension.

---

# **19\. Decision Detail Screen**

## **Route**

/{organizationId}/decisions/{decisionId}

## **Required Layout**

Decision Question  
Context and Intent  
Authority  
Alternatives Comparison  
Supporting Claims  
Supporting Evidence  
Contradicting Evidence  
Assumptions  
Constraints  
Risks  
Residual Uncertainty  
Recommendation  
Rationale  
Downstream Impact  
History

## **Confirmation Contract**

Approval confirmation SHALL summarize:

* selected Alternative;  
* material trade-offs;  
* mandatory Constraints;  
* unresolved uncertainty;  
* downstream impact;  
* effective time.

---

# **20\. Product Realization Map**

## **Route**

/{organizationId}/realization/{endeavorId}

## **Purpose**

Show the coherent chain from product Intent to observed operation.

## **Canonical Structure**

Intent  
→ Outcome  
→ User Journey  
→ Requirement  
→ Architecture  
→ Implementation Change  
→ Verification  
→ Release  
→ Observation  
→ Reconciliation

## **Required Modes**

Trace Graph  
Structured Outline  
Gap Analysis  
Coverage Matrix  
Change Impact  
Temporal Evolution

## **Gap Types**

RequirementWithoutIntent  
RequirementWithoutVerification  
ArchitectureWithoutDecision  
ChangeWithoutRequirement  
ChangeWithoutValidation  
TestWithoutRequirementOrInvariant  
ReleaseWithoutObservation  
ObservationWithoutReconciliation

## **Commands**

Create Missing Link  
Open Related Entity  
Start Gap Resolution PWU  
Open Reconciliation  
Inspect Change Impact

## **Acceptance Criteria**

* The graph has an accessible non-graph equivalent.  
* Users can move from code or test back to product Intent.  
* Gaps are explainable and actionable.  
* The map is not rendered as one unreadable universal graph by default.

---

# **21\. Requirements Screen**

## **Route**

/{organizationId}/requirements

## **Views**

Requirement Catalog  
Hierarchy  
Journey Trace  
Conflict View  
Verification Coverage  
Change Impact

## **Requirement Row Contract**

Requirement Statement  
Type  
Status  
Priority  
Originating Intent  
Journey  
Verification Method  
Implementation Coverage  
Verification Status  
Conflict State

## **Commands**

Propose Requirement  
Accept Requirement  
Reject Requirement  
Refine Requirement  
Define Acceptance Criteria  
Link Journey  
Assign Verification Method  
Open Conflict  
Supersede Requirement

---

# **22\. Requirement Detail Screen**

## **Route**

/{organizationId}/requirements/{requirementId}

## **Required Sections**

Statement  
Rationale  
Type  
Status  
Intent Trace  
Stakeholders  
User Journeys  
Acceptance Criteria  
Verification Method  
Architecture Trace  
Implementation Trace  
Test Coverage  
Evidence  
Conflicts  
History

## **Acceptance Criteria**

* Accepted Requirements have verification methods.  
* Implementation and verification statuses remain separate.  
* Vague quality attributes are flagged.

---

# **23\. Architecture Screen**

## **Route**

/{organizationId}/architecture

## **Canonical Views**

System Context  
Capabilities  
Domain Model  
Components  
Interfaces  
Data  
Security  
Deployment  
Decisions  
Invariants  
Drift

## **Architecture Element Contract**

Name  
Element Type  
Responsibility  
Owning Decision  
Related Requirements  
Interfaces  
Dependencies  
Current Validity  
Implementation Coverage  
Drift State

## **Commands**

Create Architecture Element  
Create Decision  
Define Interface  
Register Invariant  
Open Review  
Identify Drift  
Start Reconciliation

---

# **24\. Architecture Decision Screen**

## **Route**

/{organizationId}/architecture/decisions/{decisionId}

This route SHALL use the shared Decision Detail contract with architecture-specific criteria.

Additional sections:

Quality Attributes  
Affected Components  
Affected Interfaces  
Evolution Consequences  
Revisit Triggers  
Implementation Conformance  
Operational Evidence

---

# **25\. Implementation Portfolio Screen**

## **Route**

/{organizationId}/implementation

## **Purpose**

Show implementation work as professional product-realization slices.

## **Groupings**

Ready to Implement  
In Implementation  
Awaiting Validation  
Blocked  
Changes Requested  
Ready to Merge  
Merged  
Deployed  
Reconciling

## **Implementation Slice Card**

Professional Objective  
PWU  
Affected Requirements  
Architecture Decisions  
Repository  
Agent or Human Owner  
Current Change  
Validation State  
Blocker  
Completion Readiness

## **Prohibition**

The screen SHALL not default to a repository file list or agent-run list.

---

# **26\. Implementation Workspace**

## **Route**

/{organizationId}/pwus/{pwuId}/implementation

## **Required Regions**

Objective and Scope  
Requirements  
Architecture Decisions  
Invariants  
Repository Context  
Active Change  
Agent Execution  
Changed Artifacts  
Tests  
Validation  
Assumptions and Deviations  
Completion Readiness

## **Commands**

Create Change  
Start Coding Agent  
Stop Agent  
Safe Stop Agent  
Request Review  
Run Validation  
Record Deviation  
Open Reconciliation  
Submit Change  
Complete Implementation PWU

## **Agent Execution Panel**

Agent Role  
Operating Mode  
Objective  
Scope  
Current State  
Current Step  
Tool Calls  
Sandbox State  
Produced Artifacts  
Assumptions  
Validation  
Escalation  
Resource Usage

## **Acceptance Criteria**

* Code changes trace to professional context.  
* Agent scope and non-goals are visible.  
* Passing build does not imply PWU completion.  
* Deviations from architecture are explicit.

---

# **27\. Change Detail Screen**

## **Route**

/{organizationId}/implementation/changes/{changeId}

## **Required Sections**

Objective  
Affected Artifacts  
Affected Representations  
Implementation Rationale  
Requirements  
Architecture  
Invariants  
Diff Summary  
Tests  
Review  
Validation  
Risk  
Rollback  
Deployment Relationship  
History

## **Commands**

Submit for Review  
Request Changes  
Approve Change  
Merge Change  
Record Validation  
Revert  
Open Reconciliation

---

# **28\. Agent Execution Detail Screen**

## **Route**

/{organizationId}/implementation/agents/{agentExecutionId}

## **Required Sections**

Agent Identity  
Model Identity  
Professional Role  
Objective  
Scope  
Authority  
Context Sources  
Current Status  
Tool Calls  
Sandbox Executions  
Outputs  
Assumptions  
Limitations  
Validation  
Cost and Resource Use  
Failure or Escalation

## **Acceptance Criteria**

* Model and agent identity remain visible.  
* Tool calls are traceable.  
* Full hidden chain-of-thought is not required.  
* Professional rationale and Evidence are available.  
* Agent completion is not presented as PWU completion.

---

# **29\. Verification Screen**

## **Route**

/{organizationId}/verification

## **Views**

Requirement Coverage  
Invariant Coverage  
Risk Coverage  
Execution Results  
Failures  
Waivers  
Release Gates

## **Verification Row Contract**

Subject  
Verification Method  
Status  
Latest Result  
Evidence  
Environment  
Required for Release  
Owner

## **Commands**

Create Verification  
Execute Verification  
Record Result  
Request Evidence  
Open Failure Analysis  
Grant Waiver  
Revoke Waiver

---

# **30\. Verification Detail Screen**

## **Route**

/{organizationId}/verification/{verificationId}

## **Required Sections**

Subject  
Method  
Criteria  
Environment  
Inputs  
Execution  
Result  
Evidence  
Failure Details  
Affected Requirements  
Affected Invariants  
Waiver  
History

## **Acceptance Criteria**

* Inconclusive is not treated as pass.  
* Waivers record authority and risk.  
* Failures identify affected product-realization entities.

---

# **31\. Releases Screen**

## **Route**

/{organizationId}/releases

## **Release Card Contract**

Release Name  
Status  
Included Changes  
Excluded Scope  
Verification Readiness  
Security Review  
Operational Readiness  
Known Risks  
Target Environment  
Approval State

## **Commands**

Create Release  
Add Change  
Remove Change  
Run Readiness Assessment  
Request Approval  
Approve Release  
Authorize Deployment  
Rollback

---

# **32\. Release Detail Screen**

## **Route**

/{organizationId}/releases/{releaseId}

## **Required Sections**

Scope  
Included Changes  
Excluded Changes  
Verification  
Security  
Migration  
Operational Readiness  
Known Defects  
Known Risks  
Rollback Plan  
Approvals  
Deployment  
Observations  
Acceptance

## **Acceptance Criteria**

* Deployment and Release acceptance remain separate.  
* Residual risk is explicit.  
* Release readiness is decomposed and explainable.

---

# **33\. Operations Screen**

## **Route**

/{organizationId}/operations

## **Required Views**

Current Releases  
Service Health  
Outcome Indicators  
Invariant Monitors  
Incidents  
Operational Observations  
Architecture Drift  
Reconciliation Backlog

## **Acceptance Criteria**

* Operational telemetry is linked to product context where possible.  
* Service health is not treated as equivalent to user or business Outcome success.  
* Violated invariants are prominent.

---

# **34\. Incident Detail Screen**

## **Route**

/{organizationId}/operations/incidents/{incidentId}

## **Required Regions**

Observed Condition  
Affected Users and Outcomes  
Severity  
Timeline  
Working Claims  
Evidence  
Containment Actions  
Decisions  
Remediation  
Recovery Validation  
Residual Risk  
Follow-On PWUs  
Reconciliation

## **Commands**

Update Severity  
Record Observation  
Propose Claim  
Authorize Containment  
Create Remediation PWU  
Verify Recovery  
Resolve Incident  
Open Reconciliation

## **Acceptance Criteria**

* Service restoration alone does not close the incident.  
* Incident reasoning and Evidence remain reconstructable.  
* Follow-on work is visible.

---

# **35\. Reconciliation Portfolio Screen**

## **Route**

/{organizationId}/reconciliations

## **Groupings**

Detected  
Analyzing  
Proposed  
Awaiting Review  
Applying  
Partially Applied  
Escalated  
Completed

## **Reconciliation Card**

Trigger  
Detected Incoherence  
Affected Entities  
Affected PWUs  
Affected Decisions  
Outcome Impact  
Required Authority  
Status

---

# **36\. Reconciliation Detail Screen**

## **Route**

/{organizationId}/reconciliations/{reconciliationId}

## **Required Layout**

Trigger  
Prior State  
Current Conflict  
Affected Model  
Impact Analysis  
Proposed Changes  
Before-and-After Comparison  
Validation  
Required Authority  
Application Progress  
Remaining Incoherence  
History

## **Commands**

Accept Proposal  
Reject Proposal  
Revise Proposal  
Request Evidence  
Reopen Decision  
Reopen PWU  
Create Follow-On PWU  
Accept Temporary Incoherence  
Escalate

---

# **37\. Coordination Screen**

## **Route**

/{organizationId}/coordination

## **Required Views**

Work Portfolio  
Delegation Tree  
Dependency Network  
Tactic Health  
Escalation Queue  
Validation Queue  
Synthesis Queue  
Agent Capacity

## **Professional Groupings**

Needs Framing  
Ready  
Reducing Uncertainty  
Awaiting Evidence  
Awaiting Decision  
Awaiting Review  
Blocked  
Reconciling  
Ready for Synthesis  
Escalated

---

# **38\. RPH Detail Screen**

## **Route**

/{organizationId}/coordination/{rphId}

## **Required Sections**

Professional Objective  
Scope  
Authority  
Current State  
Current Plan  
Coordinated PWUs  
Child RPHs  
Participants  
Dependencies  
Active Tactics  
Progress Assessment  
No-Progress Signals  
Validation State  
Synthesis State  
Escalations  
Resource Budget  
History

## **Commands**

Revise Plan  
Allocate Participant  
Create PWU  
Create Child RPH  
Change Tactic  
Request Specialist  
Suspend  
Resume  
Escalate  
Start Synthesis  
Complete RPH

---

# **39\. Attention Screen**

## **Route**

/{organizationId}/attention

## **Required Groupings**

Decision Required  
Review Required  
Validation Required  
Evidence Required  
Contradiction  
Assumption Invalidated  
Dependency Blocked  
Intent Changed  
Reconciliation Required  
Escalation  
Outcome at Risk

## **Attention Item Contract**

Why Attention Is Required  
Professional Context  
Required Role  
Required Authority  
Urgency  
Outcome Impact  
Relevant Evidence  
Available Commands  
Deferral Consequence

## **Commands**

Open Context  
Resolve  
Delegate  
Defer  
Accept Risk  
Mark Not Applicable  
Escalate

## **Prohibition**

Material Attention Items SHALL not be dismissible without disposition.

---

# **40\. Memory Screen**

## **Route**

/{organizationId}/memory

## **Required Views**

Change Summaries  
Decision Histories  
Endeavor Narratives  
Incident Narratives  
Onboarding Narratives  
Handoff Narratives  
Reconciliation Narratives

## **Narrative Contract**

Scope  
Time Range  
Purpose  
Source Entities  
Generated By  
Confidence  
Known Omissions  
Validation Status

## **Acceptance Criteria**

* Narratives link to source entities.  
* Narrative fluency is not presented as proof of completeness.  
* Users can inspect structured state beneath the narrative.

---

# **41\. Global Search Contract**

Search SHALL support semantic queries such as:

Show requirements without verification.  
Find decisions affected by the new authentication policy.  
Show code changes not linked to architecture decisions.  
Find critical assumptions invalidated this month.  
Show active PWUs blocked by legal review.  
Show evidence contradicting the selected design.

## **Search Result Contract**

Entity Type  
Title or Statement  
Owning Context  
Intent  
Lifecycle or Validity State  
Temporal Relevance  
Confidence  
Match Explanation

---

# **42\. Context Inspector Contract**

The Context Inspector SHALL provide stable access to:

Intent  
Outcome  
Scope  
Participants  
Assumptions  
Constraints  
Dependencies  
Confidence  
Uncertainty  
Validations  
Provenance  
History

## **Behavior**

* It may be pinned or collapsed.  
* Selecting an entity updates the Inspector.  
* Critical state remains visible even when collapsed.  
* Inspector state should persist across related projections.

---

# **43\. Command Region Contract**

The Command Region SHALL display only professionally valid Commands.

Each Command control SHALL know:

commandType  
requiredRole  
requiredAuthority  
preconditions  
expectedEffect  
confirmationPolicy

## **Disabled Command Contract**

A disabled Command SHALL state why it is unavailable.

Example:

Approve Release is unavailable because the mandatory security review failed and no exception authority is assigned.

---

# **44\. Entity Drawer Contract**

A lightweight Entity Drawer MAY provide rapid inspection without leaving the current projection.

It SHALL support:

Summary  
Relationships  
Provenance  
Confidence  
Validity  
History  
Open Full Context

The drawer SHALL not replace the full workspace for material Decisions or professional work.

---

# **45\. Timeline Contract**

Timeline entries SHALL distinguish:

Semantic Event  
Command  
Decision  
Observation  
Validation  
AI Contribution  
Administrative Action  
Technical Failure

Each entry SHALL show:

Occurred Time  
Recorded Time  
Actor  
Professional Effect  
Related Entities

---

# **46\. Graph Contract**

Graphs SHALL be used only where relationships are the primary cognitive object.

Every graph SHALL provide:

* textual or tabular equivalent;  
* filtering;  
* legend;  
* relationship semantics;  
* selected-node Inspector;  
* bounded traversal depth;  
* accessible keyboard navigation where practical.

The UI SHALL avoid rendering the entire enterprise graph by default.

---

# **47\. Table Contract**

Tables SHOULD support:

* semantic column labels;  
* sorting by professional importance;  
* filtering;  
* relationship navigation;  
* current-state disclosure;  
* accessible row actions;  
* saved views.

A row SHALL not contain only identifiers and technical state.

---

# **48\. Empty State Contract**

Empty states SHALL distinguish:

No Data Yet  
Not Applicable  
Not Authorized  
Filtered Out  
Not Loaded  
Awaiting Professional Work

Example:

No verification method has been defined for this Requirement.  
Define one before the Requirement can be accepted.

This is preferable to:

No records found.

---

# **49\. Error State Contract**

Errors SHALL distinguish:

Technical Failure  
Authorization Failure  
Validation Failure  
Concurrency Conflict  
Invariant Violation  
External Dependency Failure  
Projection Failure

Every material error SHOULD include:

Professional Explanation  
Technical Reference  
Retryability  
Current State  
Recommended Disposition  
Correlation ID

---

# **50\. Stale Projection Contract**

A stale projection SHALL show:

Last Updated  
Source Version  
Current Known Version  
Material Change Indicator  
Refresh Command  
Command Safety State

Commands from stale projections SHALL revalidate against current authoritative state.

---

# **51\. Historical Mode Contract**

Historical mode SHALL:

* display a persistent historical banner;  
* identify the selected time;  
* disable current-state mutation;  
* permit comparison with current state;  
* preserve historical provenance.

---

# **52\. Responsive Web Contract**

## **Wide Layout**

Global Rail  
Primary Workspace  
Context Inspector  
Optional Secondary Projection  
Command Region

## **Medium Layout**

* Context Inspector becomes collapsible.  
* Secondary projection becomes modal or tabbed.  
* Global rail may collapse to icons.

## **Narrow Layout**

* One primary cognitive region at a time.  
* Context appears in a drawer.  
* Commands appear in a fixed action region.  
* Critical state remains visible.

---

# **53\. Mobile Contract**

Mobile SHALL prioritize:

Attention  
Review  
Approval  
Observation Capture  
Evidence Capture  
Incident Response  
Concise PWU Understanding

Complex Decision review SHOULD use a guided sequence:

Question  
Alternatives  
Evidence  
Contradictions  
Constraints  
Uncertainty  
Impact  
Decision

---

# **54\. VS Code Route and View Contract**

The VS Code extension SHALL expose:

Janumi Product Realization Explorer  
Current PWU View  
Requirements View  
Architecture View  
Implementation View  
Verification View  
Agent Activity View  
Reconciliation View

## **Selection Context**

Selecting a file or symbol SHOULD show:

Related PWUs  
Requirements  
Architecture Decisions  
Invariants  
Tests  
Observations  
Reconciliation

## **Prohibition**

The VS Code extension SHALL not consist only of:

Chat  
Prompt Box  
Agent Output

---

# **55\. Frontend Component Inventory**

Initial semantic components:

AppShell  
GlobalHeader  
GlobalNavigation  
CognitiveBreadcrumb  
WorkspaceHeader  
LifecycleStateBadge  
CognitiveStateBadge  
ValidityBadge  
ConfidenceIndicator  
UncertaintyIndicator  
IntentTrace  
OutcomeTrace  
ProjectionTabs  
ContextInspector  
ProfessionalCommandBar  
AttentionIndicator  
PwuSummary  
CompletionReadiness  
QuestionCard  
AssumptionCard  
ClaimCard  
EvidenceCard  
DecisionCard  
AlternativeComparison  
ReasoningActivityCard  
AgentExecutionPanel  
ValidationCard  
DependencyCard  
ReconciliationCard  
DecompositionTree  
ProductRealizationMap  
EntityTimeline  
ProvenancePanel  
StalenessBanner  
HistoricalModeBanner  
ProfessionalErrorPanel

---

# **56\. Component Semantic Requirements**

## **`LifecycleStateBadge`**

Must identify the state dimension as lifecycle.

## **`CognitiveStateBadge`**

Must not reuse the lifecycle state label.

## **`ConfidenceIndicator`**

Must expose basis and assessment source.

## **`EvidenceCard`**

Must expose Evidence relationship semantics.

## **`DecisionCard`**

Must expose authority and residual uncertainty.

## **`AgentExecutionPanel`**

Must expose agent identity, scope, authority, and validation.

## **`CompletionReadiness`**

Must show individual completion conditions, not only a percentage.

## **`ProfessionalCommandBar`**

Must derive Commands from server-authoritative permissions and state.

---

# **57\. Backend Projection Requirements**

The frontend SHALL not assemble core professional state through numerous unrelated entity requests when a defined projection exists.

Required initial projection endpoints:

GET /projections/home  
GET /projections/outcomes  
GET /projections/endeavors/{endeavorId}  
GET /projections/pwus/{pwuId}/overview  
GET /projections/pwus/{pwuId}/understanding  
GET /projections/pwus/{pwuId}/reasoning  
GET /projections/pwus/{pwuId}/evidence  
GET /projections/pwus/{pwuId}/decisions  
GET /projections/pwus/{pwuId}/implementation  
GET /projections/pwus/{pwuId}/verification  
GET /projections/pwus/{pwuId}/decomposition  
GET /projections/realization/{endeavorId}  
GET /projections/coordination/{rphId}  
GET /projections/attention

---

# **58\. Projection Response Envelope**

Every projection response SHOULD include:

projectionId  
projectionVersion  
generatedAt  
asOfTime  
consistencyMode  
sourceVersionVector  
staleness  
completeness  
appliedFilters  
authorizationScope  
data  
availableCommands

---

# **59\. Semantic Command API Requirements**

The frontend SHALL submit Commands through generated contracts.

Examples:

POST /commands/create-pwu  
POST /commands/identify-uncertainty  
POST /commands/register-assumption  
POST /commands/propose-requirement  
POST /commands/approve-architecture-decision  
POST /commands/start-agent-execution  
POST /commands/record-verification-result  
POST /commands/start-reconciliation  
POST /commands/complete-pwu

---

# **60\. Command Response Contract**

commandId  
status  
professionalMessage  
aggregateId  
priorVersion  
newVersion  
emittedEvents  
resultEntities  
validationResults  
attentionItems  
processIds  
projectionRefreshHints

---

# **61\. Frontend State Architecture**

Recommended frontend state separation:

routeContext  
authoritativeProjection  
selectionState  
panelState  
draftState  
commandState  
temporalState  
authorizationState

## **Prohibition**

Do not create a single global mutable store containing all professional entities and UI state without boundaries.

---

# **62\. SvelteKit Implementation Guidance**

## **Server Load**

Route-level server loads SHOULD retrieve:

* projection data;  
* authorization context;  
* temporal context;  
* available Commands.

## **Client State**

Client state SHOULD hold:

* current selection;  
* visual layout;  
* open panels;  
* local drafts;  
* pending Command state.

## **Mutation**

Commands SHALL be submitted through server endpoints or generated API clients.

## **Refresh**

Accepted Commands SHOULD trigger targeted projection invalidation rather than full application reload.

---

# **63\. Loading Sequence**

A workspace SHOULD render in this order:

1. shell;  
2. route and identity context;  
3. Workspace Header;  
4. critical state;  
5. primary projection;  
6. secondary details;  
7. noncritical history or analytics.

The user SHOULD not wait for the full graph or history before seeing the professional objective and state.

---

# **64\. Performance Priorities**

Prioritize:

* current objective;  
* state;  
* attention;  
* Commands;  
* critical uncertainty;  
* blocking conditions.

Defer or lazy-load:

* full history;  
* large graphs;  
* deep provenance;  
* expansive Evidence networks;  
* historical comparisons.

---

# **65\. Accessibility Contract**

All core screens SHALL support:

* keyboard navigation;  
* screen-reader labels;  
* visible focus;  
* color-independent state;  
* reduced motion;  
* accessible graph alternatives;  
* accessible comparison tables;  
* logical heading structure;  
* sufficient contrast;  
* clear error association.

---

# **66\. Analytics and Telemetry**

UI telemetry MAY record:

projectionOpened  
entityInspected  
commandInitiated  
commandAccepted  
commandRejected  
attentionResolved  
reconciliationOpened  
contextLost  
searchPerformed

Telemetry SHALL not capture protected professional content unnecessarily.

---

# **67\. Screen-Level Testing Strategy**

Each screen SHALL have:

route test  
projection contract test  
authorization test  
loading-state test  
stale-state test  
error-state test  
keyboard-access test  
semantic invariant test  
command test

Visual snapshot tests alone are insufficient.

---

# **68\. Critical Acceptance Journey 1 — From Intent to Implementation**

1. User opens an Endeavor.  
2. User inspects Product Intent.  
3. User opens Product Realization Map.  
4. User selects a Requirement.  
5. User traces to Architecture Decision.  
6. User opens implementation PWU.  
7. User inspects active Change and coding agent.  
8. User inspects verification Evidence.  
9. User returns to the Requirement without context loss.

**Pass condition:** The professional chain remains visible and navigable throughout.

---

# **69\. Critical Acceptance Journey 2 — Failed Verification**

1. A required test fails.  
2. Verification screen records failure.  
3. Affected Requirement and invariant are identified.  
4. Implementation PWU shows failed completion condition.  
5. Release readiness becomes false.  
6. Attention Item is created.  
7. User opens failure analysis.  
8. Remediation or reconciliation is initiated.

**Pass condition:** The UI never presents the work as complete merely because code exists or a prior build passed.

---

# **70\. Critical Acceptance Journey 3 — AI Recommendation**

1. Architecture agent proposes a Decision.  
2. Decision appears as proposed.  
3. Agent identity is visible.  
4. Evidence, assumptions, and confidence are inspectable.  
5. Reviewer adds contradicting Evidence.  
6. Readiness decreases.  
7. Authorized approver may defer or request more Evidence.  
8. AI recommendation is not treated as approved.

---

# **71\. Critical Acceptance Journey 4 — Recomposition Failure**

1. All child implementation PWUs complete.  
2. Decomposition view shows child completion.  
3. Cross-child interface contradiction is detected.  
4. Parent completion remains unavailable.  
5. Synthesis readiness is false.  
6. Reconciliation begins.  
7. Parent completes only after successful recomposition.

---

# **72\. Critical Acceptance Journey 5 — Production Feedback**

1. Release deploys.  
2. Deployment succeeds.  
3. Production Observation shows unexpected user behavior.  
4. Outcome assessment changes.  
5. A product assumption is invalidated.  
6. Reconciliation identifies affected Journey, Requirement, architecture, and implementation.  
7. Follow-on PWUs are created.

---

# **73\. Initial Implementation Scope**

The first usable UI release SHALL include:

Application Shell  
Home  
Endeavor Detail  
PWU Overview  
PWU Understanding  
PWU Reasoning  
PWU Evidence  
PWU Decisions  
Decomposition Viewer  
Product Realization Map  
Implementation Workspace  
Agent Execution Panel  
Verification Screen  
Reconciliation Screen  
Coordination Screen  
Attention Screen

Architecture, Release, and Operations views MAY initially use narrower versions of the full contracts.

---

# **74\. Implementation Sequence for the Coding Agent**

## **Milestone 1 — Shell and Professional Context**

Implement:

AppShell  
GlobalHeader  
GlobalNavigation  
CognitiveBreadcrumb  
WorkspaceHeader  
ContextInspector  
ProfessionalCommandBar  
state badges  
staleness and historical banners

## **Milestone 2 — PWU Core**

Implement:

PWU Overview  
Objective and Scope  
Dual State  
Questions  
Uncertainty  
Assumptions  
Constraints  
Dependencies  
Completion Readiness

## **Milestone 3 — Reasoning and Evidence**

Implement:

Reasoning Activities  
Claims  
Evidence  
Confidence  
Contradictions  
AI Attribution

## **Milestone 4 — Decisions**

Implement:

Decision Readiness  
Alternatives  
Authority  
Evidence  
Residual Uncertainty  
Approval Commands

## **Milestone 5 — Decomposition and Product Realization**

Implement:

Child PWUs  
Delegation  
Recomposition  
Product Realization Map  
Traceability Gaps

## **Milestone 6 — Implementation and Verification**

Implement:

Implementation Workspace  
Agent Execution  
Change Detail  
Verification Coverage  
Validation Failures

## **Milestone 7 — Reconciliation and Coordination**

Implement:

Reconciliation Detail  
RPH Coordination  
Tactic Health  
Escalation  
Synthesis Queue  
Attention

---

# **75\. Coding-Agent Build Rules**

The coding agent SHALL:

1. Build from screen contracts, not aesthetic intuition alone.  
2. Implement shared semantic components before duplicating screen-specific variants.  
3. Treat route loaders as projection consumers.  
4. Treat Commands as generated semantic operations.  
5. Keep lifecycle and cognitive state separate.  
6. Keep drafts separate from authoritative state.  
7. preserve route and projection context.  
8. expose authority and unavailable-action explanations.  
9. preserve AI provenance.  
10. implement stale and partial states deliberately.  
11. avoid generic task-management language.  
12. avoid a chat-first layout.  
13. avoid file-tree-first navigation.  
14. avoid one universal graph.  
15. implement non-graph accessible alternatives.  
16. ensure completion readiness is condition-based.  
17. preserve parent recomposition state.  
18. add semantic acceptance tests for every milestone.  
19. record unresolved UX ambiguities as explicit design Decisions.  
20. reject UI features that cannot identify the professional cognition they support.

---

# **76\. Definition of Done**

The initial JanumiCode UI is complete when a user can:

* enter an Endeavor;  
* understand its Intent and Outcomes;  
* inspect PWUs and their cognitive state;  
* inspect uncertainty, assumptions, reasoning, Evidence, and Decisions;  
* follow product-realization traceability;  
* supervise a coding agent within professional context;  
* inspect verification;  
* understand why work is blocked or incomplete;  
* review decomposition and recomposition;  
* initiate reconciliation;  
* supervise RPH coordination;  
* act on professional Attention Items;  
* move among these views without losing context.

The implementation is not complete merely because all routes render.

It is complete when the interface makes the product-realization cognition coherent and operable.

The immediate development action is to give the coding agent this document together with the CPCO, PWU, Projection, RIWS, and JanumiCode PWA specifications, then have it assess the current UI against the screen contracts and produce a gap-based implementation plan rather than continuing feature-by-feature.

