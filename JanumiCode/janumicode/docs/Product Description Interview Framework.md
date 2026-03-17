# Product Description Interview Framework

## Purpose
This framework turns a vague platform prompt such as "build a platform that integrates Community Association Management, Field Service Management, and Home Maintenance Assistant" into a structured product description document shaped like `Hestami AI Real Property OS and Platform Product Description.md`.

It is intentionally aligned to the JanumiCode product-engineering approach:

* interview first, then draft
* use a state-driven intake process instead of free-form chat
* apply Mirror and Menu behavior so the human mostly judges and corrects
* keep facts, assumptions, proposals, and open issues separate
* maintain traceability from mission to pillars to domains to journeys to platform choices

## Source Pattern
This framework is derived from the following local artifacts:

* `janumicode/docs/Hestami AI Real Property OS and Platform Product Description.md`
* `janumicode/docs/JanumiCode Deep INTAKE Workflow Concept.md`
* `janumicode/docs/Documents for building complex systems.md`
* `janumicode/docs/Mirror and Menu Protocol.md`
* `janumicode/docs/current/state-machine-verification-prompt.md`

## Target Output Contract
The generated output file should normally contain these sections:

1. Vision
2. Mission
3. Product Description
4. Platform pillars summary table
5. One subsection per major pillar
6. Common Data Model with numbered domains
7. Personas
8. User Journeys
9. Core Technological Infrastructure and Stack
10. Phasing Strategy
11. Success Factors or Success Metrics
12. Appendix with benchmark or reference-product material

The interview process should not try to generate the final document until it has enough information to populate each section with at least provisional content.

## Section-to-State Mapping

| Output Section | Primary State Source | Minimum Inputs |
| --- | --- | --- |
| Vision | Mission and Value Thesis | future state, buyer, value outcome |
| Mission | Mission and Value Thesis | platform purpose, target users, operating change |
| Product Description | Intake Mirror + Pillar Decomposition | platform thesis, pillar inventory |
| Pillars summary table | Pillar Decomposition | pillar names, dominant domains |
| Pillar subsections | Pillar Decomposition | target customer, business problem, scope |
| Common Data Model | Domain Model and Common Data Model | domains, entities, shared relationships |
| Personas | Stakeholders, Personas, and Role Topology | actor classes, role boundaries |
| User Journeys | Journeys, Workflows, and State Machines | triggers, actors, major flows |
| Core Technological Infrastructure and Stack | Platform Shape and Technical Posture | platform surfaces, operating constraints, rationale |
| Phasing Strategy | Pillar Decomposition + Phasing, Benchmarks, and Competitive Reference Models | release order, dependencies, sequencing logic |
| Success Factors | Mission and Value Thesis + Phasing, Benchmarks, and Competitive Reference Models | outcomes, KPIs, phase goals |
| Appendix | Phasing, Benchmarks, and Competitive Reference Models | reference products, borrowed patterns, differentiators |

## Operating Principles
### 1. Product description first, not full architecture first
The goal is to define the product shape, business domains, actors, workflows, and platform posture. Detailed system requirements and architecture can follow later.

### 2. Use Mirror and Menu, not blank-slate questioning
For each round:

* Mirror: restate the current understanding in precise language
* Menu: present 2-3 bounded options where a tradeoff exists
* Ask only the minimum questions needed to unblock the next draft section

### 3. Keep four classes of statements separate

* Confirmed: explicitly stated by the requestor
* Assumed: plausible but not yet validated
* Proposed: recommended structure or choice by the agent
* Open Issue: unresolved, contradictory, or too important to guess

### 4. Preserve artifact traceability
At minimum, maintain linkage from:

* business problem -> vision and mission
* business pillars -> major business domains
* personas -> user journeys
* user journeys -> common data model objects
* quality, compliance, or operating constraints -> platform stack choices
* scope and dependencies -> phasing strategy

## JanumiCode Role Mapping
This framework fits the current JanumiCode workflow as follows:

* Discovery Orchestrator: owns the current interview state, coverage tracking, and transition logic
* Technical Expert: produces the Mirror, asks the next highest-value questions, and drafts provisional product sections
* Human: reviews product discovery artifacts and resolves Menu decisions
* Historian / Verifier: checks for contradictions, missing domains, weak traceability, and hidden assumptions before final synthesis

In JanumiCode terms, the product-review artifact set should minimally cover:

* vision
* product description
* personas
* user journeys
* phasing strategy
* success metrics

For Hestami-style output, extend that product-review set with:

* Common Data Model
* core technological infrastructure and stack
* appendix benchmark references

## Required Control Registers
Maintain these as running internal artifacts during the interview:

### Known / Unknown / Assumption / Risk table

| Item | Type | Statement | Impact | Action |
| --- | --- | --- | --- | --- |
| Platform buyer | Unknown | Paying customer not yet explicit | High | Ask in mission round |
| Pillar boundaries | Assumption | CAM, FSM, and Home Assistant are separate pillars | High | Validate in pillar round |

### Decision log

| ID | Decision | Rationale | Source | Affected Sections |
| --- | --- | --- | --- | --- |

### Open issues log

| ID | Issue | Why It Matters | Blocking |
| --- | --- | --- | --- |

### Traceability skeleton

| Goal | Pillar | Domain | Persona | Journey | Platform Implication |
| --- | --- | --- | --- | --- | --- |

## State-Driven Interview Process
This process should be run as a finite-state workflow. Stay in a state until its exit criteria are met or the remaining gaps are explicitly marked as open issues.

### State 0: Intake Mirror
Purpose:
Normalize the one-line concept into an initial platform thesis.

Questions:

* In one sentence, what platform are we building?
* What problem is the platform meant to solve across all included business areas?
* Which nouns in the prompt are definite versus exploratory?
* Are we describing one product, a product suite, a marketplace, or an operating system?
* What would make the first draft obviously wrong?

Artifacts produced:

* concept summary
* anti-goals
* initial unknowns
* candidate pillar list

Exit criteria:

* high-level concept mirrored back and corrected by the requestor

### State 1: Mission and Value Thesis
Purpose:
Define why the platform exists and for whom.

Questions:

* Who pays for this product?
* Who uses it daily?
* Who receives downstream benefit even if they are not the buyer?
* What business pain exists today for each side of the platform?
* Why should these capabilities be unified instead of left as separate tools?
* What outcomes would make the platform successful in year 1 and year 3?
* What words should appear in the vision and mission?

Artifacts produced:

* vision draft
* mission draft
* business problem statement
* success metric seeds

Exit criteria:

* buyer, operator, beneficiary, and core outcome are all explicit

### State 2: Pillar Decomposition
Purpose:
Break the platform into coherent business pillars that can anchor the document.

Questions:

* What are the top-level pillars or product lines?
* Is each pillar customer-facing, operator-facing, or both?
* What is the target customer for each pillar?
* What is the core business problem for each pillar?
* What makes a pillar separate enough to deserve its own section?
* Which workflows or data objects are shared across pillars?
* Which pillar should come first if the platform is phased?

Artifacts produced:

* pillar table
* pillar summaries
* shared-platform thesis
* first phasing hypothesis

Exit criteria:

* every major pillar has a name, purpose, target customer, and reason for inclusion

### State 3: Stakeholders, Personas, and Role Topology
Purpose:
Identify all human and organizational actors that must appear in the product description.

Questions:

* Who are the primary users in each pillar?
* Who are the secondary users or beneficiaries?
* Who administers the platform?
* Who governs approvals, finances, compliance, or policy?
* Which external parties interact without being full platform tenants?
* Which roles should exist in the portal or mobile experiences?
* Which roles create data, approve data, or consume reports?
* Which actor classes can block or constrain operations?

Artifacts produced:

* stakeholder map
* persona catalog
* role inventory
* cross-pillar role overlaps

Exit criteria:

* personas are concrete enough to drive journeys and access patterns

### State 4: Domain Model and Common Data Model
Purpose:
Define the numbered business domains and the shared conceptual data model.

Questions:

* What are the natural business domains inside each pillar?
* Which domains are canonical and shared across pillars?
* What core entities must exist regardless of implementation?
* Which entities are documents, assets, parties, locations, financial records, workflows, or evidence?
* What relationships must remain consistent across the whole platform?
* What records need auditability, retention, or legal defensibility?
* What records are external references versus first-class internal data?
* Which domains require explicit requirements in addition to entity lists?

Artifacts produced:

* domain inventory
* Common Data Model outline
* domain purposes
* domain-level requirements notes

Exit criteria:

* the document can list numbered domains with named entities and at least a one-line purpose each

### State 5: Journeys, Workflows, and State Machines
Purpose:
Generate the user journey sections and expose lifecycle expectations.

Questions:

* What are the top 3-5 journeys per pillar?
* What event triggers each journey?
* Which persona initiates it?
* What evidence, documents, or media are attached?
* What approvals or exception paths can occur?
* Which steps are human-driven, AI-assisted, or automated?
* What material states does the underlying object pass through?
* What would failure, delay, or rework look like?

Artifacts produced:

* user journey catalog
* workflow summary
* state-machine seeds
* SLA or approval notes

Exit criteria:

* each primary persona appears in at least one journey

### State 6: Governance, Trust, Compliance, and Records
Purpose:
Identify the parts of the product description that deal with governance, compliance, records, and decision traceability.

Questions:

* What approvals, notices, votes, signatures, or hearings must be supported?
* What compliance regimes or statutory rules matter?
* What financial controls or audit trails are needed?
* What documents are system-of-record versus assistive context?
* What decisions need rationale and evidence retention?
* What events require immutable logging?
* What kinds of abuse, misrouting, or tenant-boundary failures are unacceptable?

Artifacts produced:

* governance and compliance notes
* records-management notes
* trust-ledger requirements
* high-risk open issues

Exit criteria:

* compliance-sensitive domains and records are explicit enough to appear in the product description

### State 7: Platform Shape and Technical Posture
Purpose:
Populate the product-description-level platform stack and operating model without pretending the architecture is final.

Questions:

* Which experiences must exist: web admin, resident portal, technician mobile app, board portal, staff console, AI assistant?
* Is offline field operation required?
* Is the product media-heavy, workflow-heavy, or both?
* Is the platform multi-tenant SaaS, single-tenant, hybrid, or deployment-flexible?
* What integration classes are mandatory: payments, accounting, licensing, GIS, permits, messaging, storage, identity?
* What data-isolation or policy requirements are already known?
* Which platform technologies are already chosen versus merely preferred?
* What qualities justify those choices: durability, auditability, offline support, type safety, observability, AI orchestration?

Artifacts produced:

* platform surfaces list
* high-level stack draft
* integration inventory
* platform rationale notes

Exit criteria:

* the output can credibly draft a "Core Technological Infrastructure and Stack" section with rationale and explicit TBD markers where needed

### State 8: Phasing, Benchmarks, and Competitive Reference Models
Purpose:
Define build order and appendix-style benchmark material.

Questions:

* What is Phase 1, Phase 2, and Phase 3?
* Why is that sequencing correct?
* Which reference products or market leaders should inform each pillar?
* What do we want to emulate from each reference product?
* What do we explicitly not want to copy?
* Which capabilities are foundational and must appear before others can exist?
* What market, delivery, or staffing constraints influence sequencing?

Artifacts produced:

* phasing strategy
* benchmark-to-pillar map
* appendix source list
* differentiation notes

Exit criteria:

* each phase has a goal and rationale, and each appendix reference has a clear reason for inclusion

### State 9: Synthesis and Historian Review
Purpose:
Turn the interview output into the document while checking completeness and consistency.

Checks:

* Does each pillar have target customer, business problem, and major domains?
* Does each numbered domain list entities and purpose?
* Does each persona appear in at least one journey?
* Do the journeys imply the domain objects listed in the Common Data Model?
* Are stack choices traced to product needs rather than inserted arbitrarily?
* Are all unconfirmed items marked as assumed, proposed, or open?
* Are phases consistent with dependencies and pillar boundaries?
* Does the appendix clearly explain why each benchmark product matters?

Artifacts produced:

* final product description draft
* unresolved issues appendix
* recommended next document list

Exit criteria:

* draft is internally consistent enough for human review

## Product-Description-Specific Question Bank
Use these as the concrete interview set when the target output is Hestami-style.

### A. Vision and Mission

* What is the one-sentence future state this platform creates?
* What durable change does it make for owners, operators, and service providers?
* Should the platform be described as an operating system, assistant, marketplace, or management platform?
* What is the mission statement in plain language?
* What strategic advantage comes from integrating these domains together?

### B. Pillars

* What are the named pillars?
* Who is the primary customer for each pillar?
* What is the dominant workflow or operating loop for each pillar?
* Where do the pillars share data, users, or workflows?
* Are any pillars initially modeled after existing products?

### C. Common Data Model

* What are the canonical parties, properties, assets, vendors, financial objects, and workflow objects?
* What documents are first-class objects?
* What evidence objects matter: photos, videos, signatures, notices, approvals, invoices?
* Which relationships need long-lived historical tracking?
* Which domains need entity lists only, and which need explicit requirement bullets?

### D. Personas

* Who are the daily operators?
* Who are the approvers or governors?
* Who are external collaborators?
* Which personas need web experiences?
* Which personas need mobile experiences?
* Which personas need AI assistance rather than direct system operation?

### E. User Journeys

* What are the top onboarding journeys?
* What are the top request or case-creation journeys?
* What are the top coordination or dispatch journeys?
* What are the top approval or governance journeys?
* What are the top financial or billing journeys?
* What are the top exception or compliance journeys?

### F. Stack and Platform Posture

* What frontends exist?
* Is mobile offline required?
* What workflow engine or orchestration posture is needed?
* What database and tenant-isolation requirements exist?
* What authorization and authentication posture is needed?
* What object storage, upload, malware scanning, media processing, and metadata extraction needs exist?
* Which external integrations are known, tentative, or intentionally out of scope?

### G. Phasing and Success

* Which pillar ships first and why?
* What must be true before the next pillar begins?
* What constitutes product success beyond "feature completeness"?
* Which metrics matter per phase?
* Which open questions are acceptable to defer versus blocking?

## Synthesis Rules for the Output File
When enough information exists, synthesize the final file using these rules:

### Vision
Write from the mission and value thesis, not from technical features.

### Mission
Describe what the company or platform is building and how it changes the operational burden for its users.

### Product Description
Start with a short statement that the platform is composed of multiple pillars. Then add a pillar summary table.

### Pillar sections
For each pillar include:

* pillar name
* plain-language label
* target customer
* core business problem
* optionally, the dominant domains or workflows

### Common Data Model
Number the domains. For each domain include:

* domain title
* entities or concepts
* purpose or requirement notes where needed

### Personas
List actor classes at a useful level of abstraction. Do not mix software roles and organizational roles without explanation.

### User Journeys
Prefer journey headings that read like real operating scenarios, not generic feature names.

### Core Technological Infrastructure and Stack
Only include technologies that are either:

* confirmed
* strongly implied by the operating model
* deliberately proposed and clearly marked as such

If a choice is not mature, mark it `TBD` and explain the driver.

### Phasing Strategy
Phase by dependency reality and go-to-market logic, not by arbitrary feature grouping.

### Success Factors
Do not use empty slogans. Prefer measurable outcomes, adoption targets, operational reductions, audit improvements, or platform coverage milestones.

### Appendix
Use reference products to explain benchmark inspiration, not to outsource the design. For each appendix item, state:

* why it is relevant
* what is being borrowed
* what is intentionally different

## Completeness Gate Before Drafting
Do not generate the final document until these minimum conditions are true:

* at least one confirmed or explicitly proposed vision and mission exist
* each pillar has a named customer and problem statement
* at least 8-12 numbered domains have been identified for a platform of this complexity, or the gap is acknowledged
* personas cover operators, approvers, service-side users, and admins where relevant
* at least one critical user journey exists per pillar
* compliance or audit-sensitive areas are not silent
* the stack section has rationale instead of vendor-name dumping
* phasing is justified by sequencing logic

## Output Template
Use this markdown skeleton for the generated file:

```md
# [Platform Name] Product Description

## Vision
[Vision text]

## Mission
[Mission text]

## Product Description
[Integrated overview]

| Pillar | Dominant Domains |
| --- | --- |
| [Pillar 1] | [Domains] |
| [Pillar 2] | [Domains] |

### Pillar 1: [Name]
[Target customer, business problem, scope]

### Pillar 2: [Name]
[Target customer, business problem, scope]

## Common Data Model
[Numbered domains with entities, purpose, and requirements]

## Personas
[Persona groups]

## User Journeys
[Journey headings and short descriptions]

## Core Technological Infrastructure and Stack
[Platform surfaces, high-level architecture, stack table]

## Phasing Strategy
[Phase 1, Phase 2, ...]

## Success Factors
[Metrics or success conditions]

## Appendix
[Reference products, inspirations, borrowed patterns]
```

## Recommended Prompt Contract
Use this as the starting instruction set for an interviewing agent:

```text
You are generating a product description document for a complex multi-sided platform.

Your target output shape is the section structure used in "Hestami AI Real Property OS and Platform Product Description.md".

Do not jump directly to the final draft.

First:
1. Mirror the concept back as a platform thesis.
2. Identify confirmed facts, assumptions, proposals, and open issues.
3. Run the state-driven interview process in this order:
   Intake Mirror
   Mission and Value Thesis
   Pillar Decomposition
   Stakeholders and Personas
   Domain Model and Common Data Model
   Journeys, Workflows, and State Machines
   Governance, Trust, Compliance, and Records
   Platform Shape and Technical Posture
   Phasing, Benchmarks, and Reference Models
4. Ask only the highest-leverage next questions.
5. Use Mirror and Menu behavior whenever a tradeoff or ambiguity exists.
6. Maintain running control registers: known/unknown/assumption/risk, decisions, open issues, traceability.
7. Only draft sections that have enough confidence.
8. When drafting the final document, preserve explicit TBD markers instead of pretending certainty.
```

## Recommended Final-Draft Prompt

```text
Using the validated interview results, generate a product description document with the following sections:

Vision
Mission
Product Description
Platform pillars summary table
Pillar subsections
Common Data Model
Personas
User Journeys
Core Technological Infrastructure and Stack
Phasing Strategy
Success Factors
Appendix

For every section, distinguish confirmed content from assumptions or proposals where necessary.
Do not invent missing benchmark products, compliance regimes, or architecture commitments.
If a required section is under-specified, include an Open Issue note inline.
```

## Recommended Next Artifact After This Document
After the product description is approved, the next JanumiCode-style artifacts should be:

1. Product Requirements Document
2. Concept of Operations
3. System Requirements Document
4. Interface Requirements Specification
5. Solution and Software Architecture
6. Verification and Validation Strategy
