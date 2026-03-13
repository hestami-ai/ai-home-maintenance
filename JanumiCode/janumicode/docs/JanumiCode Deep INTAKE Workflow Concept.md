  
I want to create a prompt template for software and system development that in essences is meant to be "big design up front" (BDUF). Conceptually it's potentially iterative in nature in the sense that it may start with a high level product description and then iteratively "interview" the requestor about all the known and need to be known details. What are some documents that could span this scope from product description and product requirements documents to system design and architecture and system requirements documents, testing, etc. details? The whole soup to nuts?

What you are describing is essentially a BDUF discovery \+ specification generation framework. The goal is to systematically move from *idea → requirements → architecture → implementation → verification → operations* while interrogating the requestor for missing information.

A useful way to think about this is that your prompt template orchestrates a progressive specification stack. Each document answers a different class of engineering questions and feeds the next.

Below is a comprehensive “soup-to-nuts” document stack used across systems engineering, enterprise software development, and safety-critical engineering (e.g., INCOSE-style systems engineering combined with modern software architecture practices).  
---

# **1\. Concept / Business Layer**

*(Why the system exists)*

These documents establish intent, stakeholders, and value before any design decisions are made.

### **Vision Document / Product Concept**

Defines the core idea.

Typical sections:

* Problem statement  
* Target users / personas  
* Value proposition  
* High-level solution concept  
* Differentiation from existing solutions  
* Constraints (business, regulatory, technology)

---

### **Business Case**

Explains why this product should exist financially or strategically.

Sections:

* Market analysis  
* TAM/SAM/SOM  
* Revenue model  
* Cost estimates  
* Strategic benefits  
* ROI projections  
* Risks

---

### **Stakeholder Analysis**

Identifies everyone impacted by the system.

Sections:

* Stakeholder groups  
* Interests and concerns  
* Success criteria  
* Influence and authority mapping

---

# **2\. Product Definition Layer**

*(What the system must do)*

This is where the product becomes defined behaviorally.

### **Product Requirements Document (PRD)**

Used heavily in product companies.

Sections:

* Product overview  
* Goals and non-goals  
* User personas  
* User journeys  
* Functional requirements  
* Non-functional requirements  
* Metrics for success  
* Release roadmap

---

### **Use Case Specification**

Describes interactions between actors and system.

Typical format:

* Actor  
* Goal  
* Preconditions  
* Main flow  
* Alternate flows  
* Postconditions  
* Edge cases

---

### **User Stories (if Agile hybrid)**

* As a \[user\]  
* I want \[capability\]  
* So that \[benefit\]

---

### **UX / Interaction Specification**

* Wireframes  
* Interaction flows  
* Accessibility requirements  
* UI state diagrams

---

# **3\. Systems Engineering Layer**

*(What the system must satisfy technically)*

This is the formal requirements stage.

### **System Requirements Document (SRD)**

Defines system-level requirements independent of implementation.

Sections:

* System overview  
* System context diagram  
* Functional requirements  
* Non-functional requirements  
* Performance  
* Security  
* Reliability  
* Availability  
* Compliance  
* Environmental constraints

---

### **Operational Concept (ConOps)**

Extremely important in large systems.

Explains how the system will actually be used in the real world.

Sections:

* Operational environment  
* Users and roles  
* Typical operations  
* Exceptional operations  
* Lifecycle operations

---

### **Interface Requirements Specification (IRS)**

Defines interfaces between:

* Subsystems  
* External systems  
* APIs  
* Hardware/software boundaries

---

### **Data Requirements / Information Model**

Defines:

* Data entities  
* Relationships  
* Data lifecycle  
* Data retention  
* Data governance

Often implemented as:

* Conceptual data model  
* Logical data model  
* Physical data model

---

# **4\. Architecture Layer**

*(How the system will be structured)*

This is where design decisions emerge.

### **System Architecture Document (SAD)**

Core technical blueprint.

Sections:

* Architecture overview  
* System decomposition  
* Component model  
* Technology stack  
* Integration patterns  
* Deployment model  
* Security architecture  
* Data architecture

---

### **Software Architecture Document**

Often deeper than SAD.

Includes:

* Architectural patterns  
* Microservices boundaries  
* Domain models  
* Event flows  
* API design

---

### **Architecture Decision Records (ADR)**

Captures key design decisions.

Example format:

* Context  
* Decision  
* Alternatives considered  
* Consequences

---

### **Threat Model / Security Architecture**

Sections:

* Assets  
* Attack surfaces  
* Threat actors  
* Mitigations

Frameworks often used:

* STRIDE  
* PASTA  
* LINDDUN

---

# **5\. Detailed Design Layer**

*(How each component works internally)*

### **Detailed Design Specification**

Includes:

* Class diagrams  
* Data structures  
* Algorithms  
* API definitions  
* State machines

---

### **API Specification**

Often OpenAPI.

Defines:

* Endpoints  
* Request/response schemas  
* Authentication  
* Error handling

---

### **Database Design Document**

Includes:

* Schema  
* Indexing strategy  
* Sharding/partitioning  
* Data migration strategy

---

# **6\. Implementation Planning**

*(How the system will be built)*

### **Development Plan**

Includes:

* Milestones  
* Team roles  
* Work breakdown structure  
* Timeline

---

### **Work Breakdown Structure (WBS)**

Hierarchical task decomposition.  
---

### **Risk Register**

Identifies:

* Technical risks  
* Business risks  
* Mitigations

---

# **7\. Verification & Validation**

*(How we prove it works)*

### **Test Strategy**

Overall approach to testing.

Includes:

* Unit testing  
* Integration testing  
* System testing  
* Acceptance testing

---

### **Test Plan**

Includes:

* Test environments  
* Test data  
* Test schedule

---

### **Test Cases**

Detailed procedures.  
---

### **Validation Plan**

Ensures system meets user needs, not just requirements.  
---

# **8\. Deployment & Operations**

*(How the system runs in production)*

### **Deployment Architecture**

Includes:

* Infrastructure  
* Networking  
* Scaling strategy  
* Disaster recovery

---

### **DevOps Runbook**

Defines:

* Monitoring  
* Alerting  
* Incident response  
* Backup strategy

---

### **Service Level Objectives (SLOs)**

Defines:

* uptime targets  
* latency  
* throughput

---

# **9\. Lifecycle Governance**

*(How the system evolves)*

### **Change Management Plan**

Defines how changes are approved and tracked.  
---

### **Configuration Management Plan**

Defines:

* versioning  
* artifact tracking  
* environment consistency

---

### **Compliance / Audit Documentation**

Includes:

* SOC2  
* ISO  
* regulatory artifacts

---

# **10\. Post-Deployment Learning**

*(Feedback loop)*

### **Post-Implementation Review**

Evaluates:

* what worked  
* what failed  
* lessons learned

---

# **The Complete “BDUF Stack”**

A simplified hierarchy:

Business Layer

  Vision

  Business Case

  Stakeholders

Product Layer

  PRD

  User Journeys

  Use Cases

Systems Layer

  ConOps

  System Requirements

  Interface Requirements

Architecture Layer

  System Architecture

  Software Architecture

  ADRs

Design Layer

  Detailed Design

  API Specs

  Data Model

Execution Layer

  Development Plan

  Risk Register

Verification Layer

  Test Strategy

  Test Plans

  Test Cases

Operations Layer

  Deployment Architecture

  Runbooks

  SLOs

Lifecycle Layer

  Change Management

  Configuration Management  
---

# **What Your Prompt Template Should Actually Do**

Your BDUF prompt framework should act like a requirements interrogation engine.

The LLM should repeatedly ask questions across six axes:

WHY   → business goals

WHO   → users and stakeholders

WHAT  → functionality

WHERE → operating environment

WHEN  → lifecycle and timing

HOW   → architecture and technology

It should:

1. Identify missing information  
2. Ask targeted questions  
3. Expand documentation iteratively  
4. Maintain traceability between layers

---

# **If You Want, I Can Also Show You**

A “Universal Software/System Design Prompt Template” that:

* automatically generates this entire document stack  
* iteratively interviews the user  
* enforces traceability between documents  
* produces structured outputs your Historian / Executor agents could consume in JanumiCode or Hestami.

It would essentially be a BDUF specification generator for AI-assisted engineering.

Proceed.

Below is a universal BDUF prompt template framework for software and systems development. It is designed to function as an iterative specification generator: it starts from a rough idea, interviews the requestor to close gaps, and progressively emits a full engineering document stack with traceability.

This is not just a single prompt. It is better understood as a prompted methodology with:

1. A governing prompt  
2. A document map  
3. An interview/question framework  
4. Stage-gated outputs  
5. Traceability rules  
6. A final integrated specification package

---

# **1\. Purpose of the Framework**

The framework is intended to help an AI act as a:

* product strategist  
* business analyst  
* systems engineer  
* solution architect  
* software architect  
* QA/test strategist  
* delivery planner  
* documentation generator

Its job is to take a vague concept such as:

“I want to build an AI-assisted property management platform”

and turn it into a progressively refined, internally consistent body of design documentation spanning:

* concept  
* business context  
* stakeholder needs  
* product requirements  
* system requirements  
* architecture  
* data design  
* interface design  
* security  
* testing  
* operations  
* roadmap  
* risk

---

# **2\. Core Philosophy**

This template assumes the following:

### **A. Big design up front does not mean one-shot design**

It means front-loading discovery and design discipline before coding begins.

### **B. The process is iterative**

The AI should not pretend it already knows the answers. It should:

* identify unknowns  
* ask structured questions  
* record assumptions  
* distinguish confirmed facts from inferred proposals

### **C. Every artifact should be traceable**

Requirements should trace back to:

* stakeholder needs  
* business goals  
* operational needs  
* constraints  
* risks

Architecture decisions should trace to requirements.  
Tests should trace to requirements.  
Roadmap items should trace to scope and dependency realities.

### **D. The AI should separate:**

* facts provided by the requestor  
* inferences made by the AI  
* open issues  
* recommendations  
* assumptions requiring validation

---

# **3\. Master Document Stack**

This is the full soup-to-nuts stack your framework should be able to generate.

## **Phase 0: Intake and Framing**

1. Opportunity / Problem Statement  
2. Vision / Concept Brief  
3. Glossary and Domain Definitions  
4. Assumptions and Unknowns Register  
5. Stakeholder Map

## **Phase 1: Product and Business Definition**

6. Business Case  
7. Product Description Document  
8. Product Requirements Document (PRD)  
9. User Personas / Actor Catalog  
10. User Journeys / Operational Scenarios  
11. Use Case Model  
12. Success Metrics / KPIs

## **Phase 2: Systems Engineering**

13. Concept of Operations (ConOps)  
14. System Context Diagram Description  
15. System Requirements Document (SRD)  
16. Interface Requirements Specification (IRS)  
17. External Systems and Dependency Register  
18. Constraints and Compliance Register

## **Phase 3: Architecture and Design**

19. Solution Architecture Document  
20. Software Architecture Document  
21. Data Architecture / Information Model  
22. API / Interface Design Specification  
23. Security Architecture / Threat Model  
24. Deployment Architecture  
25. Architecture Decision Records (ADR set)

## **Phase 4: Delivery and Implementation Planning**

26. Work Breakdown Structure (WBS)  
27. Release Strategy / Roadmap  
28. Development Plan  
29. Environment Strategy  
30. Risk Register  
31. Dependency and Sequencing Plan

## **Phase 5: Verification and Validation**

32. Verification and Validation Strategy  
33. Test Strategy  
34. Test Plan  
35. Acceptance Criteria Catalog  
36. Requirements Traceability Matrix  
37. Quality Attribute Scenarios

## **Phase 6: Operations and Lifecycle**

38. Operational Readiness Plan  
39. Runbooks / Support Model  
40. Monitoring and Observability Plan  
41. Incident Response / Resilience Plan  
42. Change Management Plan  
43. Configuration Management Plan  
44. Post-Implementation Review Template

That is the practical end-state.  
---

# **4\. Recommended Top-Level Prompt Template**

Use this as the governing system/developer-style prompt for the AI workflow.

You are acting as a senior product strategist, business analyst, systems engineer, software architect, QA strategist, and delivery planner.

Your goal is to help the requestor progressively define a software or system solution using a Big Design Up Front (BDUF) approach that is rigorous, traceable, and iterative.

You must do the following:

1\. Start with the information provided by the requestor.

2\. Identify what is known, unknown, assumed, ambiguous, or conflicting.

3\. Interview the requestor iteratively with targeted questions to close critical gaps.

4\. Maintain a clear separation between:

  \- confirmed facts from the requestor

  \- inferred assumptions

  \- recommended design choices

  \- unresolved questions

  \- risks and constraints

5\. Generate a structured documentation package spanning:

  \- concept and product definition

  \- stakeholder and user needs

  \- requirements

  \- architecture

  \- data and interfaces

  \- security and compliance

  \- testing and validation

  \- delivery planning

  \- operations and lifecycle governance

6\. Maintain traceability:

  \- business goals \-\> stakeholder needs \-\> requirements \-\> architecture \-\> tests

7\. Prefer precision over vagueness. When information is missing, ask concise, high-value questions.

8\. Avoid making silent assumptions about critical matters such as:

  \- target users

  \- operating environment

  \- data sensitivity

  \- regulatory requirements

  \- performance expectations

  \- integration constraints

  \- deployment model

  \- security model

9\. When sufficient information exists, produce the next artifact draft.

10\. When insufficient information exists, ask only the most important next questions.

11\. At every stage, include:

  \- decisions made

  \- assumptions

  \- open issues

  \- recommendations

12\. Structure outputs so they can be consumed by downstream engineering agents.

When beginning, first produce:

A. A summary of the requestor’s stated concept

B. A known/unknown/assumption table

C. A prioritized interview question set

D. A proposed document generation plan  
---

# **5\. The Interview Backbone**

The AI needs a structured way to interrogate the requestor. A good model is a 12-domain interview grid.  
---

## **Domain 1: Mission / Problem**

Questions:

* What problem is the system meant to solve?  
* Who experiences this problem?  
* Why is solving it valuable?  
* What happens if it is not solved?  
* What does success look like?

Outputs informed:

* vision  
* problem statement  
* business case  
* PRD goals

---

## **Domain 2: Stakeholders and Actors**

Questions:

* Who are the primary users?  
* Who are the secondary users?  
* Who administers or governs the system?  
* Who pays for it?  
* Who integrates with it?  
* Who can block or constrain it?

Outputs informed:

* stakeholder map  
* persona catalog  
* access model  
* governance model

---

## **Domain 3: Scope and Boundaries**

Questions:

* What is in scope for the first release?  
* What is explicitly out of scope?  
* What adjacent capabilities might be added later?  
* What existing systems does this replace, augment, or depend on?

Outputs informed:

* scope statement  
* non-goals  
* roadmap  
* boundary definition

---

## **Domain 4: Functional Capability**

Questions:

* What must users be able to do?  
* What workflows matter most?  
* What are the main system services?  
* What events trigger system behavior?  
* What outputs or decisions must the system produce?

Outputs informed:

* PRD  
* use cases  
* SRD functional requirements  
* system decomposition

---

## **Domain 5: Data and Information**

Questions:

* What core business entities exist?  
* What data enters the system?  
* What data is created or transformed?  
* What data must be retained?  
* What data is sensitive?  
* What data sources are authoritative?

Outputs informed:

* data model  
* data governance  
* retention policy  
* integration model

---

## **Domain 6: Environment and Operations**

Questions:

* Where is the system used?  
* Is usage internal, external, mobile, edge, cloud, or hybrid?  
* What operating conditions matter?  
* Is the system real-time, batch, human-in-the-loop, or autonomous?  
* What are the operational hours and availability expectations?

Outputs informed:

* ConOps  
* deployment architecture  
* availability requirements  
* support model

---

## **Domain 7: Quality Attributes / Non-Functional Requirements**

Questions:

* What performance is required?  
* What reliability is required?  
* What scalability is expected?  
* What latency is acceptable?  
* What usability/accessibility requirements apply?  
* What maintainability and auditability are required?

Outputs informed:

* NFR section  
* architecture constraints  
* test strategy  
* SLOs

---

## **Domain 8: Security, Privacy, Compliance**

Questions:

* What sensitive data is involved?  
* What kinds of users and permissions exist?  
* Are there regulatory obligations?  
* What audit trails are required?  
* What abuse/misuse scenarios matter?

Outputs informed:

* threat model  
* security architecture  
* compliance register  
* IAM design

---

## **Domain 9: Integrations and Interfaces**

Questions:

* What external systems must connect?  
* Are APIs needed?  
* Are there batch exchanges, events, files, or streaming data?  
* Who owns the source systems?  
* What interface contracts already exist?

Outputs informed:

* IRS  
* API spec  
* dependency register  
* integration testing plan

---

## **Domain 10: Delivery and Constraints**

Questions:

* What budget or staffing constraints exist?  
* What skills exist on the team?  
* What technologies are mandated or prohibited?  
* What timeline matters?  
* What must be demonstrated first?

Outputs informed:

* development plan  
* technology choices  
* sequencing  
* roadmap

---

## **Domain 11: Verification and Acceptance**

Questions:

* How will stakeholders decide the system is acceptable?  
* What are the acceptance criteria?  
* What must be proven through tests, demos, pilots, or audits?  
* What failures are unacceptable?

Outputs informed:

* validation plan  
* acceptance test plan  
* traceability matrix

---

## **Domain 12: Evolution and Lifecycle**

Questions:

* How will the system change over time?  
* What future phases are expected?  
* How should the architecture accommodate growth?  
* What handoff to operations is needed?

Outputs informed:

* roadmap  
* change management plan  
* ADRs  
* maintainability strategy

---

# **6\. Required Internal Control Tables**

Your template should force the AI to maintain several running control artifacts.

## **A. Known / Unknown / Assumption / Risk Table**

Example structure:

| Item | Type | Statement | Impact | Action Needed |
| ----- | ----- | ----- | ----- | ----- |
| Target customers | Known | HOA managers and homeowners | High | None |
| Compliance regime | Unknown | No regulatory framework provided yet | High | Ask requestor |
| Initial hosting | Assumption | Assume cloud-hosted SaaS | Medium | Validate |
| External payments integration | Risk | Payment vendor not chosen | Medium | Track decision |

This is essential.  
---

## **B. Decision Log**

Tracks decisions already made.

| ID | Decision | Rationale | Source | Affected Artifacts |
| :---: | :---: | :---: | :---: | :---: |

---

## **C. Open Issues Log**

Tracks unresolved questions.

| ID | Issue | Why it matters | Owner | Blocking? |  
---

## **D. Requirements Traceability Matrix**

At minimum:

| Business Goal | Stakeholder Need | Requirement ID | Architecture Element | Test Coverage |
| :---: | :---: | :---: | :---: | :---: |

---

# **7\. Artifact Generation Sequence**

The AI should not generate all documents at once. It should move in a sensible sequence.

## **Stage 1: Intake Package**

Produce:

1. concept summary  
2. problem framing  
3. known/unknown/assumption/risk table  
4. top 10 interview questions  
5. proposed documentation roadmap

---

## **Stage 2: Product Definition Package**

Produce:

1. vision / product concept  
2. stakeholder map  
3. personas  
4. PRD draft  
5. use case inventory  
6. goals / non-goals

Only after enough product clarity exists.  
---

## **Stage 3: Systems Definition Package**

Produce:

1. ConOps  
2. context definition  
3. SRD  
4. interface requirements  
5. constraints register

Only after product scope is sufficiently stable.  
---

## **Stage 4: Architecture Package**

Produce:

1. solution architecture  
2. software architecture  
3. data architecture  
4. security architecture  
5. deployment architecture  
6. ADRs

Only after the requirements basis is mature enough.  
---

## **Stage 5: Delivery \+ Verification Package**

Produce:

1. development plan  
2. roadmap  
3. WBS  
4. risk register  
5. test strategy  
6. validation plan  
7. traceability matrix

---

## **Stage 6: Operational Package**

Produce:

1. runbooks  
2. monitoring plan  
3. incident/continuity plan  
4. change/configuration management

---

# **8\. Output Format Template for Each Document**

Each artifact should follow a predictable schema.

## **Recommended common schema**

Document Title

Document Purpose

Status: Draft / Review / Baseline

Scope

Inputs and Dependencies

Confirmed Facts

Assumptions

Open Issues

Main Content

Risks / Constraints

Recommendations

Next Questions

Traceability Links

That regularity makes the output much more usable by downstream agents or humans.  
---

# **9\. Example Prompt for the First Pass**

Here is a usable prompt template for initiating the process.

I want you to act as a BDUF specification generator for a software/system project.

Your job is to iteratively interview me and progressively generate a complete engineering documentation stack spanning concept, product requirements, system requirements, architecture, data, interfaces, security, testing, delivery, and operations.

Rules:

1\. Do not jump directly to implementation.

2\. First identify what is known, unknown, assumed, and risky.

3\. Ask the most important clarifying questions first.

4\. Keep a running record of:

  \- confirmed facts

  \- assumptions

  \- unresolved issues

  \- recommendations

5\. Maintain traceability from business goals to requirements, architecture, and tests.

6\. Distinguish clearly between:

  \- what I explicitly said

  \- what you inferred

  \- what you recommend

7\. Generate documents progressively in logical order, not all at once.

Start by producing:

A. a concise summary of my concept

B. a known/unknown/assumption/risk table

C. the top 15 questions you need answered

D. a recommended document generation sequence

E. a first draft of the Vision / Concept Brief based only on what I have said so far

My project concept is:

\[INSERT PROJECT DESCRIPTION HERE\]  
---

# **10\. Example Prompt for Ongoing Iterative Interviewing**

Continue as the BDUF specification generator.

Based on all prior answers:

1\. update the known/unknown/assumption/risk table

2\. update the open issues list

3\. identify the next highest-value unresolved questions

4\. draft the next document(s) that now have enough information

5\. mark any sections that remain provisional

6\. identify any contradictions or requirement conflicts

At this stage, prioritize generating:

\[PRD / SRD / ConOps / Architecture / etc.\]

Use precise engineering language and keep outputs structured for downstream reuse.  
---

# **11\. Example Prompt for Converting Interview Results into a Full Package**

Using all information gathered so far, generate an integrated BDUF documentation package with the following sections:

1\. Vision / Concept Brief

2\. Business Goals and Success Metrics

3\. Stakeholder Map

4\. Personas and Actors

5\. Scope / Non-Scope

6\. Product Requirements

7\. Use Cases

8\. Concept of Operations

9\. System Requirements

10\. External Interfaces

11\. Solution Architecture

12\. Data Architecture

13\. Security Architecture

14\. Deployment Architecture

15\. Risks and Constraints

16\. Delivery Roadmap

17\. Verification and Validation Strategy

18\. Requirements Traceability Matrix

19\. Open Issues

20\. Recommendations and Next Decisions

For every section, explicitly distinguish:

\- confirmed information

\- assumptions

\- unresolved points

\- recommended next actions  
---

# **12\. A More Formal Master Template Structure**

If you want the prompt to behave almost like a methodology manual, use this structure.

## **Section A: Project Intake**

* project name  
* sponsor/requestor  
* problem statement  
* vision  
* context  
* desired business outcome

## **Section B: Discovery State**

* known facts  
* unknowns  
* assumptions  
* risks  
* terminology needing definition

## **Section C: Stakeholders**

* users  
* buyers  
* admins  
* operators  
* regulators  
* integrators  
* adversaries / misuse actors

## **Section D: Product Definition**

* goals  
* non-goals  
* major capabilities  
* user journeys  
* use cases  
* KPIs

## **Section E: Systems Definition**

* operating environment  
* context boundaries  
* functional requirements  
* non-functional requirements  
* constraints  
* interface requirements

## **Section F: Architecture**

* component decomposition  
* service boundaries  
* data model  
* integration model  
* security controls  
* deployment model  
* architectural rationale

## **Section G: Delivery**

* milestones  
* dependencies  
* staffing assumptions  
* environments  
* risk mitigation

## **Section H: Verification**

* acceptance criteria  
* test levels  
* traceability  
* validation method

## **Section I: Operations**

* observability  
* runbooks  
* incident response  
* backup/recovery  
* lifecycle changes

---

# **13\. The Most Important Documents to Always Include**

If you want the minimal-but-serious BDUF stack, I would always include these ten:

1. Vision / Concept Brief  
2. Stakeholder Map  
3. PRD  
4. ConOps  
5. SRD  
6. Solution / Software Architecture Document  
7. Data / Interface Specification  
8. Security / Threat Model  
9. Test Strategy \+ Acceptance Criteria  
10. Requirements Traceability Matrix

That set gives you a strong engineering spine.  
---

# **14\. Best Practices for the AI Behavior**

Your prompt should explicitly instruct the model to do these things:

### **Do**

* challenge ambiguity  
* detect contradictions  
* separate requirements from design  
* capture assumptions  
* force prioritization  
* identify scope creep  
* propose options where appropriate  
* use IDs for requirements and decisions

### **Do not**

* silently invent stakeholder needs  
* collapse business goals into technical requirements  
* confuse architecture decisions with requirements  
* over-specify low-value details too early  
* bury open issues in prose

---

# **15\. Requirement ID Pattern**

To make this useful in JanumiCode/Historian-style pipelines, use stable IDs.

Example:

* BG-001 Business Goal  
* SN-001 Stakeholder Need  
* PR-001 Product Requirement  
* SR-001 System Requirement  
* IF-001 Interface Requirement  
* NFR-001 Non-Functional Requirement  
* ADR-001 Architecture Decision  
* TC-001 Test Case  
* RSK-001 Risk

This is extremely helpful for traceability and downstream tooling.  
---

# **16\. A Strong “Interview First, Then Draft” Prompt Variant**

Act as a senior systems engineering interviewer and BDUF document generator.

Your primary mode is not immediate document generation. Your first responsibility is to discover what is missing.

For the project idea I provide:

1\. summarize the concept

2\. identify knowns, unknowns, assumptions, dependencies, and risks

3\. ask the minimum set of highest-leverage questions needed to reduce ambiguity

4\. explain which future documents those answers will affect

5\. then produce only the document sections that have enough confidence to draft

Do not present guessed material as confirmed.

Mark every statement as one of:

\- Confirmed

\- Assumed

\- Proposed

\- Open Issue

At all times maintain traceability between goals, requirements, decisions, and tests.

Project idea:

\[INSERT HERE\]  
---

# **17\. My Recommendation for Your Use Case**

Given how you think about Historian / Executor / Technical Expert workflows, I would structure this as a three-layer prompt system rather than one huge prompt.

## **Layer 1: Discovery Orchestrator**

Responsible for interviewing, gap analysis, and deciding what document comes next.

## **Layer 2: Artifact Generator**

Responsible for drafting a specific artifact:

* PRD  
* SRD  
* ConOps  
* Architecture doc  
* test strategy  
* etc.

## **Layer 3: Historian / Verifier**

Responsible for:

* contradiction detection  
* traceability checks  
* assumption audits  
* missing requirement detection  
* requirement-to-test coverage review

That separation will work much better than one monolithic prompt.  
---

# **18\. Recommended End-to-End Flow**

A practical flow would be:

1. Intake  
   * capture concept  
   * identify gaps  
2. Interview rounds  
   * mission  
   * stakeholders  
   * workflows  
   * constraints  
   * quality attributes  
   * integration/security/ops  
3. Generate product package  
   * vision, PRD, use cases  
4. Generate systems package  
   * ConOps, SRD, IRS  
5. Generate architecture package  
   * solution/software/data/security/deployment  
6. Generate validation package  
   * test strategy, acceptance criteria, traceability  
7. Generate execution package  
   * roadmap, WBS, risk register  
8. Generate operational package  
   * runbooks, observability, lifecycle governance  
9. Historian review  
   * completeness  
   * consistency  
   * traceability  
   * unresolved issue summary

---

# **19\. Concise Answer to Your Core Question**

If the question is:

“What are the documents that span the whole soup-to-nuts BDUF scope?”

Then the answer is:

* Vision / Concept Brief  
* Business Case  
* Stakeholder Map  
* Product Description / PRD  
* Personas / User Journeys / Use Cases  
* ConOps  
* System Requirements Document  
* Interface Requirements Specification  
* Constraints / Compliance Register  
* Solution Architecture Document  
* Software Architecture Document  
* Data Architecture / Information Model  
* API / Interface Specification  
* Security Architecture / Threat Model  
* Deployment Architecture  
* ADRs  
* WBS / Development Plan / Roadmap  
* Risk Register  
* Test Strategy / Test Plan / Acceptance Criteria  
* Requirements Traceability Matrix  
* Operational Readiness / Runbooks / Monitoring  
* Change and Configuration Management  
* Post-Implementation Review

That is the full stack.  
---

# **20\. Best Next Step**

The strongest next move is to turn this into a reusable master prompt pack with:

* a governing orchestration prompt  
* a discovery interview prompt  
* a PRD generator prompt  
* an SRD generator prompt  
* an architecture generator prompt  
* a Historian verification prompt

I can draft that full prompt pack next, in a form you can directly use for JanumiCode or general software/system development.

With this paper as context "https://arxiv.org/html/2403.11322v1" how would we structure this elicitation process?

Using the StateFlow: Enhancing LLM Task‑Solving through State‑Driven Workflows paper as the conceptual foundation actually suggests a much stronger structure for your BDUF elicitation process than the typical “questionnaire \+ document generation” approach.

The key idea from StateFlow is:

* Treat a complex reasoning workflow as a finite state machine (FSM).  
* Separate process grounding (states and transitions) from sub-task solving (actions executed within each state).   
* Each state represents the current status of the task, and transitions move the workflow forward based on decisions or rules. 

For a BDUF requirements elicitation system, that maps extremely well to how human systems engineers conduct discovery.

Instead of a monolithic prompt or linear interview, you design a StateFlow-style elicitation machine.  
---

# **1\. Core Idea: BDUF as a State Machine**

Your elicitation engine becomes a state-driven discovery workflow.

Each state corresponds to a discipline in systems engineering.

Example:

START

 ↓

Problem Framing

 ↓

Stakeholder Discovery

 ↓

Scope Definition

 ↓

Capability Discovery

 ↓

Data Discovery

 ↓

Constraints / Environment

 ↓

Quality Attributes

 ↓

Security / Compliance

 ↓

Integration

 ↓

Architecture Exploration

 ↓

Verification Strategy

 ↓

Delivery Planning

 ↓

Operational Model

 ↓

COMPLETE SPECIFICATION

Each state contains:

State

  Inputs

  Questions

  Artifacts generated

  Exit conditions

  Next-state logic  
---

# **2\. The Three Layers of a StateFlow-Style Elicitation Engine**

From the paper’s architecture, you should structure your system into three conceptual layers.

### **Layer 1 — State Controller**

Controls the workflow.

Responsibilities:

* determine current state  
* decide next state  
* enforce completion conditions

This is the process grounding part.  
---

### **Layer 2 — State Reasoner**

Within a state, the LLM performs reasoning.

Responsibilities:

* generate questions  
* detect ambiguity  
* identify contradictions  
* draft artifact sections

This corresponds to sub-task solving.  
---

### **Layer 3 — Tool Layer**

External capabilities.

Examples:

* document generator  
* architecture diagram generator  
* traceability checker  
* requirement classifier  
* risk analyzer

---

# **3\. The Elicitation State Machine**

Here is the recommended StateFlow for BDUF discovery.  
---

# **STATE 1 — Problem Framing**

Goal  
Establish the *mission* of the system.

Questions:

* What problem exists?  
* Who experiences it?  
* What happens if unsolved?  
* What does success look like?

Artifacts:

* Vision document  
* Problem statement  
* Business goals

Exit condition:

problem \+ goals \+ success metrics defined

Next state:

Stakeholders  
---

# **STATE 2 — Stakeholder Discovery**

Goal  
Identify all actors interacting with the system.

Questions:

* users  
* operators  
* admins  
* buyers  
* regulators  
* integrators  
* adversaries

Artifacts:

* stakeholder map  
* persona list

Exit condition:

all stakeholder classes identified

Next:

Scope Definition  
---

# **STATE 3 — Scope Definition**

Goal  
Define boundaries of the system.

Questions:

* what is in scope  
* what is out of scope  
* first release capabilities  
* adjacent capabilities

Artifacts:

* scope statement  
* non-goals

Exit condition:

bounded product definition

Next:

Capability Discovery  
---

# **STATE 4 — Capability Discovery**

Goal  
Identify required functionality.

Questions:

* key workflows  
* primary system capabilities  
* event triggers  
* outputs

Artifacts:

* PRD  
* use cases

Exit condition:

core feature model defined

Next:

Data Discovery  
---

# **STATE 5 — Data Discovery**

Goal  
Identify information flows.

Questions:

* entities  
* sources  
* transformations  
* retention  
* privacy concerns

Artifacts:

* conceptual data model  
* information architecture

Exit condition:

core data entities identified

Next:

Environment / Constraints  
---

# **STATE 6 — Operational Environment**

Goal  
Understand real-world context.

Questions:

* cloud vs on-prem  
* latency requirements  
* geographic distribution  
* operational hours  
* edge vs centralized

Artifacts:

* ConOps

Exit condition:

operating environment defined

Next:

Quality Attributes  
---

# **STATE 7 — Quality Attributes**

Goal  
Define non-functional requirements.

Questions:

* scalability  
* performance  
* availability  
* reliability  
* usability  
* observability

Artifacts:

* NFR catalog

Exit condition:

quality attribute scenarios defined

Next:

Security / Compliance  
---

# **STATE 8 — Security and Compliance**

Goal  
Define risk and control posture.

Questions:

* sensitive data  
* identity model  
* regulatory obligations  
* threat actors

Artifacts:

* threat model  
* security architecture

Exit condition:

security posture defined

Next:

Integration  
---

# **STATE 9 — Integration and Interfaces**

Goal  
Understand external dependencies.

Questions:

* external systems  
* APIs  
* file exchanges  
* event streams

Artifacts:

* interface requirements spec

Exit condition:

external interface set defined

Next:

Architecture Exploration  
---

# **STATE 10 — Architecture Exploration**

Goal  
Propose candidate architectures.

Tasks:

* system decomposition  
* service boundaries  
* data architecture  
* deployment architecture

Artifacts:

* architecture document  
* ADR set

Exit condition:

baseline architecture selected

Next:

Verification  
---

# **STATE 11 — Verification Strategy**

Goal  
Define how the system will be validated.

Tasks:

* acceptance criteria  
* test levels  
* validation scenarios

Artifacts:

* test strategy  
* traceability matrix

Exit condition:

requirements traceable to tests

Next:

Delivery Planning  
---

# **STATE 12 — Delivery Planning**

Goal  
Plan how system will be built.

Artifacts:

* roadmap  
* WBS  
* dependency graph

Exit condition:

delivery strategy defined

Next:

Operations  
---

# **STATE 13 — Operational Model**

Goal  
Define how system runs in production.

Artifacts:

* monitoring  
* runbooks  
* incident response

Exit condition:

operational lifecycle defined

Next:

COMPLETE SPEC  
---

# **4\. StateFlow Transition Logic**

The paper emphasizes transition logic between states.

For elicitation this means:

IF missing information

   remain in state

   ask targeted questions

ELSE

   transition to next state

Example:

STATE: Capability Discovery

if user workflows unclear:

   ask more questions

else:

   generate PRD

   move to Data Discovery  
---

# **5\. State Output Format**

Each state produces a structured object.

Example:

STATE\_OUTPUT

state: CapabilityDiscovery

confirmed:

\- homeowners request contractor services

\- vendors bid on jobs

assumptions:

\- mobile interface required

open\_issues:

\- bidding model

\- payment escrow

artifacts:

\- PRD

\- Use Case List

next\_state:

DataDiscovery  
---

# **6\. Why This Works Well**

The StateFlow approach solves three common failures in AI elicitation.

### **1\. Prompt Chaos**

Without states, the AI jumps around topics.

StateFlow enforces process discipline.  
---

### **2\. Missing Requirements**

States ensure each domain gets covered.

You won't skip:

* security  
* NFRs  
* operations

---

### **3\. Traceability**

Artifacts are produced in the correct dependency order.  
---

# **7\. How This Fits Your Architecture**

For your ecosystem:

### **Discovery Orchestrator**

State controller.

### **Technical Expert**

State reasoner.

### **Historian**

Consistency checker.

### **Executor**

Artifact generator.  
---

# **8\. Example StateFlow Diagram**

         ┌─────────────┐

         │ Problem     │

         │ Framing     │

         └─────┬───────┘

               │

       ┌───────▼────────┐

       │ Stakeholders    │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Scope           │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Capabilities    │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Data Model      │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Constraints     │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Architecture    │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Verification    │

       └───────┬────────┘

               │

       ┌───────▼────────┐

       │ Delivery        │

       └───────┬────────┘

               │

         ┌─────▼─────┐

         │ Operations │

         └───────────┘  
---

# **9\. The Big Insight**

Your BDUF prompt framework should not be a prompt.

It should be:

A STATE MACHINE

for engineering discovery.

This is exactly the conceptual model introduced by StateFlow — treating complex LLM reasoning processes as state-driven workflows instead of freeform chains of thought.   
---

✅ If you'd like, I can also show you the next step:

How to turn this into a JSON-defined elicitation state machine that an AI agent (or your Historian/Executor architecture) could run automatically — essentially a BDUF Agent Operating System for system design discovery.

Proceed.

Thought for 8s

Below is a JSON-defined elicitation state machine for a BDUF specification generator built in the spirit of StateFlow.

The design choice borrowed from the paper is the separation between:

* process grounding: explicit states, transitions, guards, completion criteria  
* sub-task solving: what the LLM does inside each state, such as asking questions, drafting artifacts, identifying conflicts, or proposing options. StateFlow’s core claim is that this separation improves control, interpretability, and efficiency for complex workflows. 

The paper also frames a state as the status of a running process, with transitions driven either by heuristic rules or LLM decisions, and actions executed upon entering a state can include prompts plus external tool use. That is exactly the pattern we want for requirements elicitation.   
---

## **1\. Architectural interpretation for BDUF elicitation**

For your use case, the state machine should not merely “ask questions.” It should govern a disciplined engineering workflow:

* each state owns a domain of elicitation  
* each state has explicit entry criteria, questions, artifact outputs, and exit criteria  
* transitions occur only when sufficiency conditions are met  
* unresolved ambiguity is recorded in control ledgers rather than silently glossed over  
* downstream artifacts inherit traceability from upstream discoveries

That is the practical StateFlow translation.  
---

## **2\. Recommended runtime roles**

I would model the runtime around four cooperating roles:

### orchestrator

Controls current state, evaluates guards, chooses next state.

### elicitor

Generates the best next questions for the current state.

### drafter

Writes or updates artifacts once enough information exists.

### historian\_verifier

Checks:

* contradictions  
* unresolved assumptions  
* missing requirements  
* weak traceability  
* premature transitions

This preserves the same high-level separation StateFlow emphasizes: workflow control is not the same thing as local reasoning.   
---

## **3\. Core JSON schema**

Here is the top-level schema I would use.

{

 "machine\_id": "bduf-elicitation-v1",

 "title": "BDUF Elicitation State Machine",

 "version": "1.0.0",

 "description": "State-driven workflow for iterative software and systems discovery, specification, architecture, and verification.",

 "global\_context": {

   "project\_name": "",

   "project\_type": "",

   "requestor\_summary": "",

   "engineering\_mode": "bdud\_iterative",

   "artifact\_policy": {

     "separate\_confirmed\_from\_assumed": true,

     "require\_traceability": true,

     "record\_open\_issues": true,

     "record\_decisions": true

   }

 },

 "registers": {

   "known\_facts": \[\],

   "assumptions": \[\],

   "open\_issues": \[\],

   "risks": \[\],

   "decisions": \[\],

   "requirements": \[\],

   "trace\_links": \[\]

 },

 "roles": {

   "orchestrator": {},

   "elicitor": {},

   "drafter": {},

   "historian\_verifier": {}

 },

 "start\_state": "intake",

 "terminal\_states": \["complete", "blocked"\],

 "states": \[\],

 "transition\_policy": {

   "default\_on\_missing\_info": "remain\_in\_state",

   "default\_on\_conflict": "route\_to\_conflict\_resolution",

   "default\_on\_sufficient\_confidence": "advance"

 }

}  
---

## **4\. State object schema**

Each state should follow a fixed contract.

{

 "id": "problem\_framing",

 "name": "Problem Framing",

 "purpose": "Define the business problem, mission, and success criteria.",

 "kind": "elicitation",

 "entry\_conditions": \[\],

 "inputs\_required": \[

   "requestor\_summary"

 \],

 "questions": \[

   {

     "id": "PF-Q1",

     "priority": "high",

     "text": "What concrete problem does the system solve?",

     "answer\_type": "free\_text"

   }

 \],

 "analysis\_tasks": \[

   "extract\_goals",

   "extract\_constraints",

   "identify\_ambiguities",

   "identify\_missing\_success\_metrics"

 \],

 "artifacts\_produced": \[

   "vision\_brief",

   "problem\_statement",

   "business\_goals"

 \],

 "register\_updates": \[

   "known\_facts",

   "assumptions",

   "open\_issues",

   "risks"

 \],

 "exit\_criteria": \[

   "at\_least\_one\_problem\_statement\_confirmed",

   "at\_least\_one\_primary\_stakeholder\_identified",

   "at\_least\_one\_success\_measure\_defined"

 \],

 "quality\_checks": \[

   "no\_hidden\_assumptions\_in\_problem\_statement",

   "goals\_not\_confused\_with\_solution\_design"

 \],

 "transitions": \[

   {

     "guard": "exit\_criteria\_met",

     "target": "stakeholder\_discovery"

   },

   {

     "guard": "critical\_conflict\_detected",

     "target": "conflict\_resolution"

   },

   {

     "guard": "missing\_required\_inputs",

     "target": "problem\_framing"

   }

 \]

}  
---

## **5\. Recommended state set**

This is the state sequence I would use for a true soup-to-nuts engineering flow.

### **Phase A — framing and discovery**

1. intake  
2. problem\_framing  
3. stakeholder\_discovery  
4. scope\_definition  
5. capability\_elicitation  
6. workflow\_and\_use\_cases  
7. data\_and\_information\_model  
8. operational\_context  
9. quality\_attributes  
10. security\_privacy\_compliance  
11. integration\_and\_external\_dependencies

### **Phase B — specification and architecture**

12. product\_requirements\_drafting  
13. system\_requirements\_drafting  
14. architecture\_synthesis  
15. architecture\_decision\_recording  
16. deployment\_and\_operations\_design

### **Phase C — delivery and proof**

17. verification\_validation\_design  
18. roadmap\_and\_wbs  
19. traceability\_audit  
20. spec\_baseline\_review

### **utility states**

21. conflict\_resolution  
22. blocked  
23. complete

---

## **6\. Example full machine definition**

Here is a substantial working draft.

{

 "machine\_id": "bduf-elicitation-v1",

 "title": "BDUF Elicitation State Machine",

 "version": "1.0.0",

 "start\_state": "intake",

 "terminal\_states": \["complete", "blocked"\],

 "registers": {

   "known\_facts": \[\],

   "assumptions": \[\],

   "open\_issues": \[\],

   "risks": \[\],

   "decisions": \[\],

   "requirements": \[\],

   "trace\_links": \[\]

 },

 "states": \[

   {

     "id": "intake",

     "name": "Intake",

     "purpose": "Normalize the initial request and establish the initial discovery frame.",

     "artifacts\_produced": \["concept\_summary", "initial\_gap\_map"\],

     "analysis\_tasks": \[

       "summarize\_project",

       "classify\_domain",

       "extract\_explicit\_constraints",

       "identify\_missing\_core\_dimensions"

     \],

     "exit\_criteria": \[

       "concept\_summary\_created",

       "initial\_gap\_map\_created"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "problem\_framing" }

     \]

   },

   {

     "id": "problem\_framing",

     "name": "Problem Framing",

     "purpose": "Define mission, problem, desired outcomes, and success criteria.",

     "questions": \[

       { "id": "PF-Q1", "priority": "high", "text": "What problem exists today?", "answer\_type": "free\_text" },

       { "id": "PF-Q2", "priority": "high", "text": "Who is harmed or constrained by this problem?", "answer\_type": "free\_text" },

       { "id": "PF-Q3", "priority": "high", "text": "What measurable outcomes define success?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["vision\_brief", "problem\_statement", "business\_goals"\],

     "exit\_criteria": \[

       "problem\_statement\_confirmed",

       "business\_goals\_identified",

       "success\_metrics\_present"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "stakeholder\_discovery" },

       { "guard": "critical\_conflict\_detected", "target": "conflict\_resolution" }

     \]

   },

   {

     "id": "stakeholder\_discovery",

     "name": "Stakeholder Discovery",

     "purpose": "Identify users, buyers, operators, admins, regulators, integrators, and adversaries.",

     "questions": \[

       { "id": "SD-Q1", "priority": "high", "text": "Who will directly use the system?", "answer\_type": "list" },

       { "id": "SD-Q2", "priority": "high", "text": "Who operates or administers it?", "answer\_type": "list" },

       { "id": "SD-Q3", "priority": "medium", "text": "Who pays for it or approves it?", "answer\_type": "list" },

       { "id": "SD-Q4", "priority": "medium", "text": "Who could regulate, constrain, or attack it?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["stakeholder\_map", "actor\_catalog", "persona\_seeds"\],

     "exit\_criteria": \[

       "primary\_users\_identified",

       "system\_operators\_identified",

       "external\_governance\_parties\_identified\_or\_explicitly\_none"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "scope\_definition" },

       { "guard": "critical\_conflict\_detected", "target": "conflict\_resolution" }

     \]

   },

   {

     "id": "scope\_definition",

     "name": "Scope Definition",

     "purpose": "Define the boundaries of release scope and non-goals.",

     "questions": \[

       { "id": "SC-Q1", "priority": "high", "text": "What must be in the first release?", "answer\_type": "list" },

       { "id": "SC-Q2", "priority": "high", "text": "What is explicitly out of scope?", "answer\_type": "list" },

       { "id": "SC-Q3", "priority": "medium", "text": "What future phases are expected?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["scope\_statement", "non\_goals", "phase\_map"\],

     "exit\_criteria": \[

       "release\_scope\_defined",

       "non\_goals\_defined"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "capability\_elicitation" }

     \]

   },

   {

     "id": "capability\_elicitation",

     "name": "Capability Elicitation",

     "purpose": "Identify required product capabilities and service outcomes.",

     "questions": \[

       { "id": "CE-Q1", "priority": "high", "text": "What must the system enable users to do?", "answer\_type": "list" },

       { "id": "CE-Q2", "priority": "high", "text": "What system outputs, decisions, or transactions matter?", "answer\_type": "list" },

       { "id": "CE-Q3", "priority": "medium", "text": "What events should trigger system behavior?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["capability\_model", "feature\_inventory"\],

     "exit\_criteria": \[

       "core\_capabilities\_defined"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "workflow\_and\_use\_cases" }

     \]

   },

   {

     "id": "workflow\_and\_use\_cases",

     "name": "Workflow and Use Cases",

     "purpose": "Define key end-to-end workflows, normal paths, and exception paths.",

     "questions": \[

       { "id": "WU-Q1", "priority": "high", "text": "What are the primary end-to-end workflows?", "answer\_type": "list" },

       { "id": "WU-Q2", "priority": "high", "text": "What failure or exception scenarios matter?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["use\_case\_catalog", "user\_journeys", "workflow\_descriptions"\],

     "exit\_criteria": \[

       "top\_workflows\_defined",

       "main\_exception\_paths\_defined"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "data\_and\_information\_model" }

     \]

   },

   {

     "id": "data\_and\_information\_model",

     "name": "Data and Information Model",

     "purpose": "Discover entities, records, events, sources of truth, retention, and sensitivity.",

     "questions": \[

       { "id": "DM-Q1", "priority": "high", "text": "What core business entities or records exist?", "answer\_type": "list" },

       { "id": "DM-Q2", "priority": "high", "text": "What data is authoritative and where does it come from?", "answer\_type": "list" },

       { "id": "DM-Q3", "priority": "medium", "text": "What must be retained, audited, or protected?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["conceptual\_data\_model", "information\_flow\_summary", "data\_governance\_notes"\],

     "exit\_criteria": \[

       "core\_entities\_defined",

       "source\_of\_truth\_defined\_or\_marked\_open\_issue"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "operational\_context" }

     \]

   },

   {

     "id": "operational\_context",

     "name": "Operational Context",

     "purpose": "Define usage environment, operating model, support context, and deployment constraints.",

     "questions": \[

       { "id": "OC-Q1", "priority": "high", "text": "Where and how will the system be used?", "answer\_type": "free\_text" },

       { "id": "OC-Q2", "priority": "high", "text": "Is the system cloud, on-prem, hybrid, edge, or mobile-centric?", "answer\_type": "list" },

       { "id": "OC-Q3", "priority": "medium", "text": "What uptime, support hours, or operational constraints apply?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["conops", "operational\_environment\_summary"\],

     "exit\_criteria": \[

       "operational\_model\_defined"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "quality\_attributes" }

     \]

   },

   {

     "id": "quality\_attributes",

     "name": "Quality Attributes",

     "purpose": "Define non-functional expectations and quality scenarios.",

     "questions": \[

       { "id": "QA-Q1", "priority": "high", "text": "What latency, throughput, or scale expectations apply?", "answer\_type": "list" },

       { "id": "QA-Q2", "priority": "high", "text": "What reliability, availability, or recoverability is required?", "answer\_type": "list" },

       { "id": "QA-Q3", "priority": "medium", "text": "What usability, accessibility, auditability, or observability requirements apply?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["nfr\_catalog", "quality\_attribute\_scenarios"\],

     "exit\_criteria": \[

       "performance\_constraints\_defined\_or\_marked\_open\_issue",

       "availability\_expectations\_defined\_or\_marked\_open\_issue"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "security\_privacy\_compliance" }

     \]

   },

   {

     "id": "security\_privacy\_compliance",

     "name": "Security, Privacy, and Compliance",

     "purpose": "Define trust boundaries, identity model, threats, and compliance obligations.",

     "questions": \[

       { "id": "SPC-Q1", "priority": "high", "text": "What sensitive data or privileged actions exist?", "answer\_type": "list" },

       { "id": "SPC-Q2", "priority": "high", "text": "What user roles and permissions are needed?", "answer\_type": "list" },

       { "id": "SPC-Q3", "priority": "medium", "text": "What regulatory, contractual, or audit requirements apply?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["security\_requirements", "threat\_model\_seed", "compliance\_register"\],

     "exit\_criteria": \[

       "identity\_and\_access\_model\_defined\_or\_marked\_open\_issue",

       "sensitive\_data\_handling\_defined\_or\_marked\_open\_issue"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "integration\_and\_external\_dependencies" }

     \]

   },

   {

     "id": "integration\_and\_external\_dependencies",

     "name": "Integration and External Dependencies",

     "purpose": "Define interfaces to external systems, APIs, files, events, and dependencies.",

     "questions": \[

       { "id": "IED-Q1", "priority": "high", "text": "What external systems must this integrate with?", "answer\_type": "list" },

       { "id": "IED-Q2", "priority": "high", "text": "What interface modes are required: REST, events, files, streaming, CLI, etc.?", "answer\_type": "list" },

       { "id": "IED-Q3", "priority": "medium", "text": "Who owns each external dependency and how stable is it?", "answer\_type": "list" }

     \],

     "artifacts\_produced": \["dependency\_register", "interface\_inventory"\],

     "exit\_criteria": \[

       "external\_dependency\_set\_defined\_or\_explicitly\_none"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "product\_requirements\_drafting" }

     \]

   },

   {

     "id": "product\_requirements\_drafting",

     "name": "Product Requirements Drafting",

     "purpose": "Generate the PRD from validated discovery findings.",

     "analysis\_tasks": \[

       "synthesize\_goals\_non\_goals",

       "synthesize\_capabilities",

       "map\_use\_cases\_to\_features",

       "derive\_product\_requirements"

     \],

     "artifacts\_produced": \["prd"\],

     "exit\_criteria": \[

       "prd\_generated",

       "prd\_reviewed\_for\_hidden\_assumptions"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "system\_requirements\_drafting" }

     \]

   },

   {

     "id": "system\_requirements\_drafting",

     "name": "System Requirements Drafting",

     "purpose": "Generate the SRD, interface requirements, and NFR structure.",

     "analysis\_tasks": \[

       "derive\_system\_requirements",

       "derive\_interface\_requirements",

       "assign\_requirement\_ids"

     \],

     "artifacts\_produced": \["srd", "irs"\],

     "exit\_criteria": \[

       "system\_requirements\_ided",

       "interfaces\_documented"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "architecture\_synthesis" }

     \]

   },

   {

     "id": "architecture\_synthesis",

     "name": "Architecture Synthesis",

     "purpose": "Generate candidate solution architecture from requirements and constraints.",

     "analysis\_tasks": \[

       "propose\_component\_boundaries",

       "propose\_data\_architecture",

       "propose\_security\_architecture",

       "propose\_deployment\_architecture",

       "compare\_candidate\_architectures"

     \],

     "artifacts\_produced": \["solution\_architecture\_doc", "software\_architecture\_doc", "deployment\_architecture"\],

     "exit\_criteria": \[

       "baseline\_architecture\_selected"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "architecture\_decision\_recording" },

       { "guard": "critical\_conflict\_detected", "target": "conflict\_resolution" }

     \]

   },

   {

     "id": "architecture\_decision\_recording",

     "name": "Architecture Decision Recording",

     "purpose": "Capture architectural decisions, alternatives, and consequences.",

     "analysis\_tasks": \[

       "extract\_major\_decisions",

       "record\_alternatives",

       "record\_tradeoffs"

     \],

     "artifacts\_produced": \["adrs"\],

     "exit\_criteria": \[

       "major\_architecture\_decisions\_recorded"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "deployment\_and\_operations\_design" }

     \]

   },

   {

     "id": "deployment\_and\_operations\_design",

     "name": "Deployment and Operations Design",

     "purpose": "Define runtime, environments, observability, resiliency, and support model.",

     "analysis\_tasks": \[

       "define\_environment\_strategy",

       "define\_observability",

       "define\_backup\_recovery",

       "define\_support\_model"

     \],

     "artifacts\_produced": \["runbook\_seed", "monitoring\_plan", "operational\_readiness\_notes"\],

     "exit\_criteria": \[

       "runtime\_model\_defined",

       "support\_model\_defined\_or\_marked\_open\_issue"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "verification\_validation\_design" }

     \]

   },

   {

     "id": "verification\_validation\_design",

     "name": "Verification and Validation Design",

     "purpose": "Define how requirements and stakeholder needs will be proven.",

     "analysis\_tasks": \[

       "define\_test\_levels",

       "define\_acceptance\_criteria",

       "map\_requirements\_to\_verification\_methods"

     \],

     "artifacts\_produced": \["test\_strategy", "acceptance\_criteria\_catalog", "validation\_plan"\],

     "exit\_criteria": \[

       "requirements\_have\_verification\_method"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "roadmap\_and\_wbs" }

     \]

   },

   {

     "id": "roadmap\_and\_wbs",

     "name": "Roadmap and WBS",

     "purpose": "Define phases, milestones, work packages, and delivery sequencing.",

     "analysis\_tasks": \[

       "derive\_workstreams",

       "derive\_dependencies",

       "draft\_release\_plan"

     \],

     "artifacts\_produced": \["roadmap", "wbs", "dependency\_plan", "risk\_register"\],

     "exit\_criteria": \[

       "delivery\_plan\_defined"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "traceability\_audit" }

     \]

   },

   {

     "id": "traceability\_audit",

     "name": "Traceability Audit",

     "purpose": "Verify linkage from goals to needs to requirements to architecture to tests.",

     "analysis\_tasks": \[

       "build\_traceability\_matrix",

       "detect\_untraced\_requirements",

       "detect\_unmet\_goals",

       "detect\_untested\_requirements"

     \],

     "artifacts\_produced": \["requirements\_traceability\_matrix", "gap\_report"\],

     "exit\_criteria": \[

       "all\_critical\_requirements\_traced\_or\_marked\_gap"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "spec\_baseline\_review" },

       { "guard": "critical\_gap\_detected", "target": "conflict\_resolution" }

     \]

   },

   {

     "id": "spec\_baseline\_review",

     "name": "Specification Baseline Review",

     "purpose": "Review integrated spec package for readiness, contradictions, and open issues.",

     "analysis\_tasks": \[

       "check\_internal\_consistency",

       "check\_baseline\_readiness",

       "summarize\_open\_issues"

     \],

     "artifacts\_produced": \["baseline\_review", "integrated\_spec\_package"\],

     "exit\_criteria": \[

       "package\_ready\_for\_baseline"

     \],

     "transitions": \[

       { "guard": "exit\_criteria\_met", "target": "complete" },

       { "guard": "blocking\_issue\_detected", "target": "blocked" }

     \]

   },

   {

     "id": "conflict\_resolution",

     "name": "Conflict Resolution",

     "purpose": "Resolve contradictions, requirement clashes, and unresolved blocking ambiguities.",

     "analysis\_tasks": \[

       "surface\_conflict",

       "propose\_resolution\_options",

       "record\_decision\_or\_escalation"

     \],

     "artifacts\_produced": \["conflict\_report", "decision\_request"\],

     "transitions": \[

       { "guard": "conflict\_resolved", "target": "traceability\_audit" },

       { "guard": "conflict\_unresolved\_and\_blocking", "target": "blocked" }

     \]

   },

   {

     "id": "blocked",

     "name": "Blocked",

     "purpose": "Paused due to unresolved critical issues."

   },

   {

     "id": "complete",

     "name": "Complete",

     "purpose": "Integrated BDUF specification package completed."

   }

 \]

}  
---

## **7\. Runtime control logic**

The orchestrator loop should be simple and explicit:

{

 "runtime\_algorithm": \[

   "load current\_state",

   "gather relevant project context and registers",

   "execute state analysis tasks",

   "generate only the highest-value unanswered questions",

   "ingest requestor answers",

   "update registers",

   "draft artifacts if state sufficiency threshold met",

   "run historian\_verifier checks",

   "evaluate transition guards",

   "either remain\_in\_state or transition"

 \]

}

In prose:

1. enter state  
2. inspect what is still missing  
3. ask the smallest number of highest-value questions  
4. update structured registers  
5. draft the artifact only when sufficiency criteria are met  
6. run consistency and traceability checks  
7. move only if the exit criteria pass

That is much closer to engineering discipline than “keep chatting until it feels done.”  
---

## **8\. Register design**

Your state machine becomes much stronger if it updates durable registers every turn.

### **Known facts**

Confirmed statements from the requestor.

{

 "id": "KF-001",

 "statement": "Primary users are HOA managers and homeowners.",

 "source": "requestor",

 "confidence": "confirmed"

}

### **Assumptions**

Inferred but unconfirmed statements.

{

 "id": "ASM-001",

 "statement": "Initial deployment is cloud-hosted SaaS.",

 "source": "llm\_inference",

 "confidence": "assumed",

 "validation\_needed": true

}

### **Open issues**

Unanswered engineering questions.

{

 "id": "ISS-001",

 "statement": "Payment escrow model has not been selected.",

 "impact": "high",

 "blocking": false

}

### **Decisions**

Resolved tradeoffs.

{

 "id": "DEC-001",

 "statement": "Use JWT-based auth proxied through server tier.",

 "rationale": "Supports backend API isolation and existing stack alignment."

}

### **Requirements**

Stable, typed requirement objects.

{

 "id": "SR-014",

 "type": "system\_requirement",

 "statement": "The system shall support multi-tenant access isolation.",

 "source\_links": \["SN-003", "BG-002"\]

}

### **Trace links**

Cross-artifact lineage.

{

 "from": "BG-002",

 "to": "SR-014",

 "relation": "drives"

}  
---

## **9\. Sufficiency thresholds**

This is one of the most important practical additions.

Each state should have a sufficiency threshold, not just vague completion.

Example:

{

 "state": "quality\_attributes",

 "sufficiency\_threshold": {

   "required\_confirmed\_items": \[

     "performance\_expectation\_or\_explicit\_unknown",

     "availability\_expectation\_or\_explicit\_unknown",

     "auditability\_need\_or\_explicit\_unknown"

   \],

   "max\_unresolved\_blockers": 1

 }

}

This avoids the classic LLM failure mode of inventing completeness.  
---

## **10\. Historian/verifier rules**

The verifier should enforce a few invariants.

{

 "verifier\_rules": \[

   {

     "id": "VR-001",

     "rule": "No requirement may be marked confirmed if sourced only from inference."

   },

   {

     "id": "VR-002",

     "rule": "No architecture decision may appear without at least one motivating requirement, constraint, or risk."

   },

   {

     "id": "VR-003",

     "rule": "Every critical requirement must map to at least one verification method."

   },

   {

     "id": "VR-004",

     "rule": "Every unresolved blocking issue must be visible in the baseline review."

   },

   {

     "id": "VR-005",

     "rule": "Goals, requirements, design decisions, and tests must remain distinct object types."

   }

 \]

}

For your Historian-style governance, these rules are where the real value appears.  
---

## **11\. Prompt contract per state**

Each state should provide the LLM with a narrow contract.

Example for quality\_attributes:

{

 "state\_prompt\_contract": {

   "state\_id": "quality\_attributes",

   "instructions": \[

     "Assess only non-functional qualities relevant to the current project.",

     "Do not introduce solution design unless it is required to explain a tradeoff.",

     "Ask no more than 5 questions in one pass.",

     "Prefer measurable criteria over adjectives.",

     "Update assumptions and open issues explicitly."

   \],

   "output\_schema": {

     "confirmed": \[\],

     "assumptions": \[\],

     "open\_issues": \[\],

     "questions": \[\],

     "artifact\_delta": {

       "nfr\_catalog": \[\],

       "quality\_attribute\_scenarios": \[\]

     },

     "recommended\_transition": ""

   }

 }

}

This keeps the elicitor from drifting.  
---

## **12\. Traceability model**

I would strongly recommend this ID taxonomy:

{

 "id\_taxonomy": {

   "business\_goal": "BG-\*",

   "stakeholder\_need": "SN-\*",

   "product\_requirement": "PR-\*",

   "system\_requirement": "SR-\*",

   "interface\_requirement": "IF-\*",

   "nonfunctional\_requirement": "NFR-\*",

   "decision": "DEC-\*",

   "risk": "RSK-\*",

   "issue": "ISS-\*",

   "test\_case": "TC-\*",

   "adr": "ADR-\*"

 }

}

And this minimum trace graph:

* BG \-\> SN  
* SN \-\> PR / SR / NFR  
* PR / SR / NFR \-\> ADR / architecture elements  
* PR / SR / NFR \-\> TC  
* risk \-\> decision / mitigation / test

That gives you a clean “whole soup to nuts” lineage.  
---

## **13\. Example single-turn execution payload**

At runtime, the orchestrator could emit something like this:

{

 "current\_state": "integration\_and\_external\_dependencies",

 "state\_inputs": {

   "known\_facts": \[

     "The platform uses Django backend and a server-side web frontend.",

     "Payments are handled through Square."

   \],

   "open\_issues": \[

     "No decision yet on external identity provider.",

     "No event bus selected."

   \]

 },

 "elicitor\_output": {

   "questions": \[

     "Which external systems are mandatory for release 1 versus later phases?",

     "Will integrations be synchronous APIs, asynchronous events, batch imports, or a mix?",

     "Who owns the uptime and contract stability of each external dependency?"

   \]

 },

 "requestor\_answers": \[\],

 "historian\_checks": {

   "contradictions": \[\],

   "hidden\_assumptions": \[

     "Assumed Square covers all payment use cases including escrow, which is not yet confirmed."

   \]

 },

 "recommended\_transition": "remain\_in\_state"

}

That object is machine-usable and audit-friendly.  
---

## **14\. How this maps to JanumiCode-style governed workflows**

For your broader governed-stream architecture, I would split responsibility like this:

### **Discovery Orchestrator**

Runs the FSM and selects the current state.

### **Technical Expert**

Performs state-local reasoning:

* asks questions  
* proposes options  
* drafts artifact deltas

### **Historian**

Maintains:

* state history  
* decisions  
* issue ledger  
* traceability  
* contradiction detection

### **Executor**

Renders artifacts:

* PRD  
* SRD  
* architecture docs  
* ADRs  
* test strategy  
* roadmap

That gives you a real agent operating model instead of a single oversized prompt.  
---

## **15\. Practical extension: meta-states**

I would also add optional meta-states for advanced workflows.

### domain\_glossary\_alignment

Use when vocabulary is unstable or overloaded.

### regulatory\_deep\_dive

Use when compliance is a first-class constraint.

### architecture\_option\_evaluation

Use when multiple candidate architectures need side-by-side scoring.

### pilot\_scope\_definition

Use when full product scope should be reduced to a proving phase.

These meta-states can be inserted dynamically by the orchestrator when triggered by project conditions.  
---

## **16\. Why this structure is faithful to StateFlow**

This design is faithful to the paper in the ways that matter most:

* it makes the workflow explicitly stateful  
* it separates state/transition control from within-state task solving  
* it allows LLM decisions plus rule-based guards  
* it supports tool use inside states  
* it improves interpretability because the project is always in a named, bounded engineering state rather than free-form chat. 

The paper reports StateFlow outperforming ReAct on benchmark tasks while also reducing cost, which is consistent with the intuition that explicit workflow structure reduces wandering and unnecessary reasoning.   
---

## **17\. My recommendation**

The best next step is to turn this into three concrete artifacts:

1. a canonical JSON schema  
2. a prompt pack per state  
3. a Historian verification ruleset

That trio would be the foundation of a reusable BDUF elicitation engine.

I can draft the next layer as a production-grade schema plus state prompts for all states in a form you can directly use in JanumiCode.

Proceed.

Thought for 14s

Below is a production-grade next layer: a canonical schema, a state prompt pack, and a Historian verification ruleset for a StateFlow-inspired BDUF elicitation engine.

The paper’s core move is to model complex LLM task-solving as a state machine, separating process grounding from sub-task solving. A state represents the current status of the process; transitions can be rule-driven or LLM-decided; and each state can execute prompts plus tools. The paper also reports higher success rates than ReAct on InterCode SQL and ALFWorld, with materially lower cost, which is exactly why this pattern is attractive for disciplined requirements elicitation. 

For your use case, that means this should not be “one giant prompt.” It should be a governed workflow spec with:

* a stable machine schema  
* state-specific prompt contracts  
* explicit ledgers  
* invariant checks  
* traceability objects  
* readiness gates

---

# **1\. Canonical architecture**

I would structure it as five layers:

1. Machine Definition Layer  
   Declares states, guards, outputs, and transitions.  
2. Runtime Context Layer  
   Holds project facts, answers, assumptions, issues, decisions, requirements, and trace links.  
3. State Prompt Layer  
   Gives each state a narrow mission, output schema, and questioning policy.  
4. Artifact Layer  
   PRD, SRD, ConOps, architecture docs, ADRs, test strategy, roadmap, runbooks.  
5. Governance Layer  
   Historian rules, quality gates, completeness checks, contradiction checks, traceability checks.

This preserves the StateFlow distinction between workflow control and local reasoning.   
---

# **2\. Canonical schema**

This is the top-level schema I recommend.

{

 "machine": {

   "id": "bduf-stateflow-v1",

   "name": "BDUF StateFlow Elicitation Engine",

   "version": "1.0.0",

   "start\_state": "intake",

   "terminal\_states": \["complete", "blocked"\],

   "default\_transition\_policy": {

     "on\_missing\_information": "stay",

     "on\_conflict": "conflict\_resolution",

     "on\_sufficient\_confidence": "advance"

   }

 },

 "project\_context": {

   "project\_id": "",

   "project\_name": "",

   "domain": "",

   "requestor\_summary": "",

   "project\_mode": "iterative\_bduf",

   "document\_targets": \[

     "vision\_brief",

     "prd",

     "conops",

     "srd",

     "irs",

     "solution\_architecture",

     "security\_architecture",

     "test\_strategy",

     "traceability\_matrix"

   \]

 },

 "registers": {

   "known\_facts": \[\],

   "assumptions": \[\],

   "open\_issues": \[\],

   "risks": \[\],

   "decisions": \[\],

   "stakeholder\_needs": \[\],

   "requirements": \[\],

   "architecture\_elements": \[\],

   "test\_artifacts": \[\],

   "trace\_links": \[\]

 },

 "runtime": {

   "current\_state": "intake",

   "state\_history": \[\],

   "pending\_questions": \[\],

   "answer\_log": \[\],

   "artifact\_index": \[\],

   "quality\_gate\_results": \[\]

 },

 "states": \[\]

}  
---

# **3\. Core object schemas**

## **3.1 Known fact**

{

 "id": "KF-001",

 "statement": "The backend is Django-based.",

 "source\_type": "requestor",

 "source\_ref": "turn/user/001",

 "confidence": "confirmed",

 "tags": \["architecture", "backend"\]

}

## **3.2 Assumption**

{

 "id": "ASM-001",

 "statement": "Initial deployment will be cloud-hosted SaaS.",

 "source\_type": "llm\_inference",

 "confidence": "assumed",

 "validation\_required": true,

 "impact": "medium",

 "tags": \["hosting", "deployment"\]

}

## **3.3 Open issue**

{

 "id": "ISS-001",

 "statement": "Identity provider has not been selected.",

 "impact": "high",

 "blocking": false,

 "owner": "requestor",

 "state\_origin": "security\_privacy\_compliance"

}

## **3.4 Decision**

{

 "id": "DEC-001",

 "statement": "Use server-side proxying between web tier and backend API.",

 "rationale": "Improves credential isolation and aligns with existing architecture.",

 "source\_type": "requestor\_confirmed",

 "status": "approved",

 "affects": \["solution\_architecture", "security\_architecture"\]

}

## **3.5 Stakeholder need**

{

 "id": "SN-001",

 "actor": "Operations Manager",

 "statement": "Needs visibility into all in-flight work orders.",

 "priority": "high",

 "source\_type": "elicited"

}

## **3.6 Requirement**

{

 "id": "SR-001",

 "type": "system\_requirement",

 "statement": "The system shall provide tenant-isolated access to operational data.",

 "priority": "high",

 "status": "draft",

 "derived\_from": \["SN-001", "BG-001"\],

 "verification\_method": null

}

## **3.7 Architecture element**

{

 "id": "AE-001",

 "name": "Tenant Access Gateway",

 "kind": "logical\_component",

 "description": "Enforces authenticated and authorized access to tenant-scoped resources."

}

## **3.8 Trace link**

{

 "id": "TL-001",

 "from\_id": "SN-001",

 "to\_id": "SR-001",

 "relation": "drives"

}

## **3.9 Test artifact**

{

 "id": "TC-001",

 "type": "acceptance\_test",

 "statement": "Verify that a tenant user cannot access another tenant's work orders.",

 "verifies": \["SR-001"\]

}  
---

# **4\. State schema**

Each state should be a bounded contract.

{

 "id": "problem\_framing",

 "name": "Problem Framing",

 "purpose": "Define the problem, mission, desired outcomes, and success measures.",

 "kind": "elicitation",

 "entry\_conditions": \[\],

 "required\_inputs": \["project\_context.requestor\_summary"\],

 "prompt\_contract": {

   "role": "elicitor",

   "max\_questions\_per\_turn": 5,

   "question\_policy": "highest\_leverage\_first",

   "must\_distinguish": \["confirmed", "assumed", "open\_issue", "recommendation"\]

 },

 "analysis\_tasks": \[

   "extract\_problem\_statement",

   "extract\_business\_goals",

   "detect\_solution\_bias",

   "identify\_missing\_success\_measures"

 \],

 "artifacts\_produced": \["vision\_brief", "problem\_statement", "business\_goals"\],

 "register\_updates": \[

   "known\_facts",

   "assumptions",

   "open\_issues",

   "stakeholder\_needs"

 \],

 "exit\_criteria": \[

   "problem\_statement\_confirmed",

   "at\_least\_one\_goal\_identified",

   "at\_least\_one\_success\_measure\_identified\_or\_marked\_unknown"

 \],

 "quality\_checks": \[

   "goals\_not\_confused\_with\_solution",

   "no\_hidden\_critical\_assumptions"

 \],

 "transitions": \[

   {

     "guard": "exit\_criteria\_met",

     "target": "stakeholder\_discovery"

   },

   {

     "guard": "critical\_conflict\_detected",

     "target": "conflict\_resolution"

   },

   {

     "guard": "missing\_required\_inputs",

     "target": "problem\_framing"

   }

 \]

}  
---

# **5\. Recommended state inventory**

This is the production sequence I would use.

## **Phase A — discovery**

* intake  
* problem\_framing  
* stakeholder\_discovery  
* scope\_definition  
* capability\_elicitation  
* workflow\_and\_use\_cases  
* data\_and\_information\_model  
* operational\_context  
* quality\_attributes  
* security\_privacy\_compliance  
* integration\_and\_external\_dependencies

## **Phase B — specification**

* product\_requirements\_drafting  
* system\_requirements\_drafting  
* interface\_requirements\_drafting  
* architecture\_synthesis  
* architecture\_decision\_recording  
* deployment\_and\_operations\_design

## **Phase C — verification and planning**

* verification\_validation\_design  
* roadmap\_and\_wbs  
* traceability\_audit  
* baseline\_review

## **Utility**

* conflict\_resolution  
* blocked  
* complete

---

# **6\. Prompt pack template**

Every state prompt should have the same outer shell.

{

 "state\_prompt\_template": {

   "system\_instruction": "You are operating inside a governed BDUF elicitation workflow. Stay within the assigned state. Do not silently invent critical facts. Ask only the highest-value next questions. Update ledgers explicitly.",

   "required\_sections": \[

     "state\_summary",

     "confirmed",

     "assumptions",

     "open\_issues",

     "contradictions",

     "questions",

     "artifact\_delta",

     "recommended\_transition"

   \],

   "response\_format": "json"

 }

}  
---

# **7\. State prompt pack**

Below are the actual prompt contracts I would use.

## **7.1 Intake**

{

 "state\_id": "intake",

 "prompt": {

   "mission": "Normalize the requestor's concept into an initial project frame.",

   "instructions": \[

     "Summarize the project in neutral engineering language.",

     "Identify obvious missing dimensions: actors, scope, data, environment, constraints, quality, compliance.",

     "Do not draft full requirements yet.",

     "Produce only the top unresolved gaps."

   \],

   "output\_schema": {

     "state\_summary": "string",

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "concept\_summary": "string",

       "initial\_gap\_map": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.2 Problem framing**

{

 "state\_id": "problem\_framing",

 "prompt": {

   "mission": "Define the mission, problem, outcomes, and success measures.",

   "instructions": \[

     "Focus on why the system should exist.",

     "Separate pain points from proposed features.",

     "Prefer measurable outcomes over slogans.",

     "If success measures are missing, ask for them."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "contradictions": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "problem\_statement": "string",

       "business\_goals": \["string"\],

       "success\_metrics": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.3 Stakeholder discovery**

{

 "state\_id": "stakeholder\_discovery",

 "prompt": {

   "mission": "Identify all relevant stakeholder classes and actor roles.",

   "instructions": \[

     "Cover direct users, admins, operators, approvers, regulators, integrators, and adversaries.",

     "Distinguish organizational roles from software roles.",

     "If a stakeholder class is unknown, record it explicitly."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "stakeholder\_map": \["string"\],

       "actor\_catalog": \["string"\],

       "persona\_seeds": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.4 Scope definition**

{

 "state\_id": "scope\_definition",

 "prompt": {

   "mission": "Define release boundaries, exclusions, and likely future phases.",

   "instructions": \[

     "Separate release-1 from later phases.",

     "Force explicit non-goals.",

     "Detect scope creep or hidden platform ambitions."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "scope\_statement": "string",

       "non\_goals": \["string"\],

       "phase\_map": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.5 Capability elicitation**

{

 "state\_id": "capability\_elicitation",

 "prompt": {

   "mission": "Identify the core capabilities the system must provide.",

   "instructions": \[

     "Describe capabilities in user-meaningful language.",

     "Do not collapse capability statements into architecture decisions.",

     "Group similar capabilities into domains where possible."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "capability\_model": \["string"\],

       "feature\_inventory": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.6 Workflow and use cases**

{

 "state\_id": "workflow\_and\_use\_cases",

 "prompt": {

   "mission": "Define end-to-end workflows, use cases, normal paths, and exception paths.",

   "instructions": \[

     "Capture triggers, actors, preconditions, main flow, alternate flows, and postconditions.",

     "Prioritize the most business-critical workflows first.",

     "Surface failure modes, not just happy paths."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "use\_case\_catalog": \["string"\],

       "workflow\_descriptions": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.7 Data and information model**

{

 "state\_id": "data\_and\_information\_model",

 "prompt": {

   "mission": "Define core entities, records, events, data lineage, and governance concerns.",

   "instructions": \[

     "Identify source-of-truth systems where possible.",

     "Separate conceptual entities from physical schema design.",

     "Record sensitivity, retention, and audit implications."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "conceptual\_data\_model": \["string"\],

       "information\_flows": \["string"\],

       "governance\_notes": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.8 Operational context**

{

 "state\_id": "operational\_context",

 "prompt": {

   "mission": "Define where and how the system will operate in the real world.",

   "instructions": \[

     "Clarify environment, users, support hours, criticality, and deployment setting.",

     "Capture human-in-the-loop versus autonomous behavior.",

     "Generate ConOps material, not implementation details."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "conops": "string",

       "operational\_environment\_summary": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.9 Quality attributes**

{

 "state\_id": "quality\_attributes",

 "prompt": {

   "mission": "Define non-functional requirements and quality scenarios.",

   "instructions": \[

     "Prefer measurable criteria over adjectives.",

     "Cover performance, scale, availability, reliability, usability, maintainability, auditability, and observability.",

     "Mark unknowns explicitly rather than guessing."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "nfr\_catalog": \["string"\],

       "quality\_attribute\_scenarios": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.10 Security, privacy, compliance**

{

 "state\_id": "security\_privacy\_compliance",

 "prompt": {

   "mission": "Define trust boundaries, roles, permissions, threats, and obligations.",

   "instructions": \[

     "Identify sensitive data, privileged actions, audit needs, and abuse scenarios.",

     "Keep requirements separate from controls where possible.",

     "Escalate unknown compliance obligations as high-importance issues."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "security\_requirements": \["string"\],

       "threat\_model\_seed": \["string"\],

       "compliance\_register": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.11 Integration and external dependencies**

{

 "state\_id": "integration\_and\_external\_dependencies",

 "prompt": {

   "mission": "Define all external systems, interfaces, dependencies, and ownership boundaries.",

   "instructions": \[

     "Cover APIs, events, files, streaming, CLI, and human workflow dependencies.",

     "Identify source system ownership and interface stability risks.",

     "Distinguish mandatory integrations from future ones."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "dependency\_register": \["string"\],

       "interface\_inventory": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.12 Product requirements drafting**

{

 "state\_id": "product\_requirements\_drafting",

 "prompt": {

   "mission": "Generate the PRD from validated discovery outputs.",

   "instructions": \[

     "Convert capability and workflow findings into coherent product requirements.",

     "Separate goals, non-goals, and requirements.",

     "Assign stable IDs to product requirements."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "prd": "string",

       "product\_requirements": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.13 System requirements drafting**

{

 "state\_id": "system\_requirements\_drafting",

 "prompt": {

   "mission": "Generate implementation-independent system requirements.",

   "instructions": \[

     "Write requirements as verifiable shall-statements where appropriate.",

     "Separate system requirements from architecture and implementation choices.",

     "Assign IDs and note derivation lineage."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "srd": "string",

       "system\_requirements": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.14 Interface requirements drafting**

{

 "state\_id": "interface\_requirements\_drafting",

 "prompt": {

   "mission": "Generate interface requirements and boundary definitions.",

   "instructions": \[

     "Document interface actors, protocols, payload classes, timing assumptions, and error cases.",

     "Avoid overcommitting to wire-level detail if not yet known.",

     "Trace interface requirements back to workflows and dependencies."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "irs": "string",

       "interface\_requirements": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.15 Architecture synthesis**

{

 "state\_id": "architecture\_synthesis",

 "prompt": {

   "mission": "Propose candidate architectures that satisfy requirements and constraints.",

   "instructions": \[

     "Generate at least one baseline architecture and optionally alternatives.",

     "Explain tradeoffs and rationale.",

     "Do not claim an architecture is final if major upstream unknowns remain."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "solution\_architecture": "string",

       "software\_architecture": "string",

       "architecture\_options": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.16 Architecture decision recording**

{

 "state\_id": "architecture\_decision\_recording",

 "prompt": {

   "mission": "Capture architectural decisions, alternatives, and consequences.",

   "instructions": \[

     "Each ADR must have context, decision, alternatives, and consequences.",

     "Every ADR must cite at least one motivating requirement, risk, or constraint.",

     "Flag speculative decisions."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "adrs": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.17 Deployment and operations design**

{

 "state\_id": "deployment\_and\_operations\_design",

 "prompt": {

   "mission": "Define runtime topology, environments, observability, resilience, and support model.",

   "instructions": \[

     "Cover environments, release flow, monitoring, alerting, backup/recovery, and support boundaries.",

     "Keep operational reality grounded in stated availability and staffing constraints."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "questions": \["string"\],

     "artifact\_delta": {

       "deployment\_architecture": "string",

       "monitoring\_plan": "string",

       "runbook\_seed": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.18 Verification and validation design**

{

 "state\_id": "verification\_validation\_design",

 "prompt": {

   "mission": "Define how stakeholder needs and requirements will be proven.",

   "instructions": \[

     "Map requirements to verification methods.",

     "Include unit, integration, system, acceptance, and operational validation as appropriate.",

     "Highlight untestable or weakly specified requirements."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "test\_strategy": "string",

       "acceptance\_criteria\_catalog": \["string"\],

       "validation\_plan": "string"

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.19 Roadmap and WBS**

{

 "state\_id": "roadmap\_and\_wbs",

 "prompt": {

   "mission": "Define phases, milestones, workstreams, and dependencies.",

   "instructions": \[

     "Sequence work according to dependency reality.",

     "Separate must-have release work from later enhancement work.",

     "Record critical staffing or vendor assumptions."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "assumptions": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "roadmap": "string",

       "wbs": \["string"\],

       "risk\_register": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.20 Traceability audit**

{

 "state\_id": "traceability\_audit",

 "prompt": {

   "mission": "Verify linkage from goals to needs to requirements to architecture to tests.",

   "instructions": \[

     "Detect orphan goals, orphan requirements, unsupported architecture choices, and unverified requirements.",

     "Produce explicit gap findings.",

     "Do not hide weak traceability in prose."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "traceability\_matrix": \["string"\],

       "gap\_report": \["string"\]

     },

     "recommended\_transition": "string"

   }

 }

}

## **7.21 Baseline review**

{

 "state\_id": "baseline\_review",

 "prompt": {

   "mission": "Determine whether the integrated spec package is ready to baseline.",

   "instructions": \[

     "Summarize unresolved issues, contradictions, and material risks.",

     "State whether the package is ready, conditionally ready, or blocked.",

     "List the minimum actions required for readiness."

   \],

   "output\_schema": {

     "confirmed": \["string"\],

     "open\_issues": \["string"\],

     "artifact\_delta": {

       "baseline\_review": "string",

       "readiness\_decision": "string"

     },

     "recommended\_transition": "string"

   }

 }

}  
---

# **8\. Historian verification ruleset**

This is where your governed-stream idea becomes real.

{

 "historian\_ruleset": {

   "version": "1.0.0",

   "rules": \[

     {

       "id": "VR-001",

       "severity": "critical",

       "rule": "No item may be marked confirmed if its only source is model inference."

     },

     {

       "id": "VR-002",

       "severity": "high",

       "rule": "Every business goal must map to at least one stakeholder need or explicit rationale."

     },

     {

       "id": "VR-003",

       "severity": "critical",

       "rule": "Every high-priority requirement must map to at least one verification method or be flagged as a gap."

     },

     {

       "id": "VR-004",

       "severity": "high",

       "rule": "No architecture decision may exist without a motivating requirement, constraint, or risk."

     },

     {

       "id": "VR-005",

       "severity": "medium",

       "rule": "Goals, requirements, architecture decisions, and tests must remain distinct object types."

     },

     {

       "id": "VR-006",

       "severity": "high",

       "rule": "Every blocking issue must appear in the baseline review."

     },

     {

       "id": "VR-007",

       "severity": "medium",

       "rule": "If a state exits with unresolved critical unknowns, the exit record must justify why the transition is still allowed."

     },

     {

       "id": "VR-008",

       "severity": "high",

       "rule": "Any requirement using ambiguous adjectives without measurable interpretation must be flagged."

     },

     {

       "id": "VR-009",

       "severity": "medium",

       "rule": "Every interface requirement must map to a workflow, dependency, or external actor."

     },

     {

       "id": "VR-010",

       "severity": "high",

       "rule": "Security-sensitive data handling must appear in both requirements and operational design if relevant."

     }

   \]

 }

}  
---

# **9\. Readiness gates**

I would also define state exit gates separately from prompts.

## **Example: quality attributes gate**

{

 "state\_id": "quality\_attributes",

 "readiness\_gate": {

   "required": \[

     "performance\_expectation\_confirmed\_or\_unknown\_logged",

     "availability\_expectation\_confirmed\_or\_unknown\_logged",

     "auditability\_need\_confirmed\_or\_unknown\_logged"

   \],

   "max\_allowed\_blocking\_issues": 0,

   "historian\_checks\_required": \[

     "VR-001",

     "VR-008"

   \]

 }

}

## **Example: architecture synthesis gate**

{

 "state\_id": "architecture\_synthesis",

 "readiness\_gate": {

   "required": \[

     "baseline\_architecture\_defined",

     "major\_constraints\_reflected",

     "key\_requirements\_mapped\_to\_architecture\_elements"

   \],

   "max\_allowed\_blocking\_issues": 1,

   "historian\_checks\_required": \[

     "VR-004",

     "VR-005"

   \]

 }

}  
---

# **10\. ID taxonomy**

Use a fixed taxonomy from day one.

{

 "id\_taxonomy": {

   "business\_goal": "BG-\*",

   "known\_fact": "KF-\*",

   "assumption": "ASM-\*",

   "open\_issue": "ISS-\*",

   "risk": "RSK-\*",

   "stakeholder\_need": "SN-\*",

   "product\_requirement": "PR-\*",

   "system\_requirement": "SR-\*",

   "interface\_requirement": "IF-\*",

   "nonfunctional\_requirement": "NFR-\*",

   "architecture\_element": "AE-\*",

   "decision": "DEC-\*",

   "adr": "ADR-\*",

   "test\_case": "TC-\*",

   "trace\_link": "TL-\*"

 }

}  
---

# **11\. Required trace graph**

Minimum lineage:

{

 "trace\_model": \[

   "BG \-\> SN",

   "SN \-\> PR",

   "SN \-\> SR",

   "SN \-\> NFR",

   "PR/SR/NFR \-\> AE",

   "PR/SR/NFR \-\> ADR",

   "PR/SR/NFR \-\> TC",

   "RSK \-\> DEC",

   "IF \-\> TC"

 \]

}

That is the spine of the whole methodology.  
---

# **12\. Runtime turn contract**

Every turn should produce the same control object.

{

 "turn\_result": {

   "current\_state": "",

   "state\_summary": "",

   "confirmed": \[\],

   "assumptions": \[\],

   "open\_issues": \[\],

   "contradictions": \[\],

   "questions": \[\],

   "artifact\_delta": {},

   "historian\_findings": \[\],

   "recommended\_transition": "",

   "transition\_rationale": ""

 }

}

This makes the workflow replayable and auditable.  
---

# **13\. Example instantiated state object**

Here is a complete example for security\_privacy\_compliance.

{

 "id": "security\_privacy\_compliance",

 "name": "Security, Privacy, and Compliance",

 "purpose": "Define trust boundaries, identity, privilege, data sensitivity, obligations, and abuse scenarios.",

 "required\_inputs": \[

   "stakeholder\_map",

   "conceptual\_data\_model",

   "operational\_environment\_summary"

 \],

 "analysis\_tasks": \[

   "identify\_sensitive\_data",

   "identify\_privileged\_actions",

   "identify\_roles\_and\_permissions",

   "identify\_audit\_needs",

   "identify\_regulatory\_or\_contractual\_obligations",

   "seed\_threat\_model"

 \],

 "prompt\_contract": {

   "max\_questions\_per\_turn": 5,

   "question\_policy": "highest\_risk\_first",

   "must\_distinguish": \["confirmed", "assumed", "open\_issue", "recommendation"\]

 },

 "artifacts\_produced": \[

   "security\_requirements",

   "threat\_model\_seed",

   "compliance\_register"

 \],

 "exit\_criteria": \[

   "sensitive\_data\_classes\_defined\_or\_none\_confirmed",

   "role\_model\_defined\_or\_unknown\_logged",

   "audit\_requirements\_defined\_or\_unknown\_logged"

 \],

 "quality\_checks": \[

   "no\_security\_control\_presented\_as\_confirmed\_without\_source",

   "compliance\_unknowns\_flagged\_high\_impact"

 \],

 "transitions": \[

   {

     "guard": "exit\_criteria\_met",

     "target": "integration\_and\_external\_dependencies"

   },

   {

     "guard": "critical\_conflict\_detected",

     "target": "conflict\_resolution"

   }

 \]

}  
---

# **14\. Practical operating pattern**

For JanumiCode or a similar governed development environment, I would run this like this:

### **Discovery Orchestrator**

Chooses state, enforces readiness gates, owns transitions.

### **Elicitor**

Runs the state prompt and produces the next best questions plus artifact deltas.

### **Historian**

Updates ledgers, runs the verifier rules, issues warnings and blocks.

### **Executor**

Renders human-readable docs from the normalized artifacts.

That maps cleanly onto your Historian / Executor / Technical Expert pattern.  
---

# **15\. What this gives you that a normal prompt does not**

It gives you:

* bounded reasoning scope  
* consistent output structure  
* state-level auditability  
* better contradiction handling  
* requirement lineage  
* controlled transitions  
* reusable artifact generation  
* explicit readiness criteria

That is exactly the kind of workflow discipline StateFlow was designed to improve for complex multi-step tasks.   
---

# **16\. Strong next step**

The next practical move is to convert this into a single machine file plus one state file per state, for example:

* machine.json  
* states/intake.json  
* states/problem\_framing.json  
* ...  
* rules/historian\_rules.json

Then define artifact renderers:

* render\_prd  
* render\_srd  
* render\_conops  
* render\_architecture  
* render\_traceability\_matrix

I can draft that filesystem layout and the first concrete machine files next.  
