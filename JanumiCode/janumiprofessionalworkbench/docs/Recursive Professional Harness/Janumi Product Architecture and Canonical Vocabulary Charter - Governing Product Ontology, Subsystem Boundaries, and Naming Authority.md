# Janumi Product Architecture and Canonical Vocabulary Charter

## Governing Product Ontology, Subsystem Boundaries, and Naming Authority

**Document ID:** `RPH-DOC-000`
**Status:** Canonical baseline
**Authority:** Foundational product architecture
**Applies to:** Janumi, Janumi Platform, Janumi Professional Workbench, JanumiCode, JanumiLegal, JanumiHealth, JanumiConstruction, and future Janumi domain products
**Primary purpose:** Establish authoritative meanings, product boundaries, and naming conventions for the Janumi product family
**Supersedes:** Informal and inconsistent uses of `Lens`, `workflow`, `Product Lens`, `Product Lens Workbench`, and JanumiCode as a single Professional Work Architecture

---

# 1. Purpose

This Charter defines the canonical product architecture and vocabulary of Janumi.

It establishes the authoritative relationship among:

* Janumi as a company;
* Janumi Platform as the shared deployment and service foundation;
* Janumi Professional Workbench as the general-purpose professional-work environment;
* Professional Work Architectures;
* Professional Work Units;
* Undertakings;
* Professional Work Graphs;
* execution workflows;
* domain products such as JanumiCode;
* specialized professional views;
* products produced by Undertakings;
* shape and implementation packages;
* deployment and handoff outcomes.

The Charter exists to prevent architectural and vocabulary conflation as the Janumi product family expands.

In particular, it prevents the following concepts from being treated as interchangeable:

```text
JanumiCode
Product Realization PWA
Field Service Management Undertaking
Field Service Management SaaS Product
Product Realization View
Execution Workflow
```

These are related, but they are not the same thing.

---

# 2. Authority of this Charter

This Charter is the naming and product-boundary authority for future Janumi specifications.

Where older documents use superseded terminology, readers and implementation agents must interpret those terms according to the migration rules in this Charter.

Where an older artifact conflicts with this Charter:

1. the professional meaning in this Charter takes precedence;
2. the conflict must be surfaced;
3. the older artifact must not be silently reinterpreted in a way that changes its substantive requirements;
4. terminology should be corrected during the next revision of that artifact.

This Charter is not merely a glossary.

It defines:

* product ontology;
* subsystem boundaries;
* architectural levels;
* ownership of responsibilities;
* valid composition relationships;
* naming rules;
* customization levels;
* delivery outcomes;
* versioning expectations.

---

# 3. Foundational product hierarchy

The canonical high-level product hierarchy is:

```text
Janumi
└── Janumi Platform
    ├── Janumi Professional Workbench
    ├── JanumiCode
    ├── JanumiLegal
    ├── JanumiHealth
    ├── JanumiConstruction
    ├── Future domain products
    └── Shared platform and enterprise services
```

This hierarchy is conceptual, not necessarily a statement that each item must be deployed as a separate service or executable.

The physical deployment may share:

* clusters;
* databases;
* identity services;
* artifact storage;
* execution services;
* UI shells;
* APIs;
* observability;
* billing;
* integration infrastructure.

The conceptual boundaries remain important even when implementation components are shared.

---

# 4. Janumi

## 4.1 Definition

**Janumi** is the company, product family, brand, and organizational authority responsible for the Janumi Platform and associated domain products.

Janumi may provide:

* software products;
* hosted services;
* enterprise deployments;
* professional services;
* managed operations;
* domain-specific Professional Work Architecture libraries;
* implementation services;
* assurance services;
* integration services;
* deployment services.

## 4.2 Janumi is not

Janumi is not:

* a Professional Work Architecture;
* an Undertaking;
* an execution workflow;
* a single product deployment;
* a specific domain specialization.

---

# 5. Janumi Platform

## 5.1 Definition

The **Janumi Platform** is the shared technical, operational, commercial, and governance foundation on which Janumi products and tenant workloads operate.

It provides common services required to define, instantiate, execute, assure, govern, deploy, and operate professional work.

## 5.2 Platform responsibilities

The Janumi Platform may include:

### Infrastructure and runtime

* Kubernetes or equivalent orchestration;
* container and sandbox execution;
* compute scheduling;
* workload isolation;
* storage;
* networking;
* secrets management;
* deployment automation;
* backup and recovery.

### Multi-tenancy

* tenant identity;
* tenant isolation;
* tenant-scoped storage;
* authorization;
* resource quotas;
* data segmentation;
* tenant-specific configuration.

### Identity and access

* authentication;
* authorization;
* role management;
* authority delegation;
* enterprise identity integration;
* audit identity.

### Commercial services

* subscription management;
* Square payment integration;
* usage accounting;
* invoicing;
* plans and entitlements;
* tenant lifecycle.

### Model and agent services

* model routing;
* tool execution;
* context assembly;
* runtime bindings;
* memory services;
* agent observability;
* execution recovery;
* policy enforcement.

### Professional-work services

* PWA storage and versioning;
* Undertaking management;
* Professional Work Graph persistence;
* assurance services;
* governance;
* baselines;
* traceability;
* artifact management.

### Integration services

* source-control systems;
* IDEs;
* enterprise repositories;
* document-management systems;
* messaging systems;
* payment providers;
* cloud platforms;
* industry-specific systems.

### Enterprise services

* private deployments;
* organizational policy overlays;
* custom authority models;
* compliance controls;
* customer-managed keys;
* audit exports;
* advanced integration;
* professional services.

## 5.3 Platform relationship to professional work

The Janumi Platform supplies machinery.

Professional Work Architectures define the structure of work.

```text
Janumi Platform
    provides infrastructure, runtime, services, and controls

Professional Work Architecture
    defines the reusable professional-work structure

Undertaking
    instantiates and operates that structure
```

## 5.4 Janumi Platform is not

The Janumi Platform is not:

* the Product Realization PWA;
* JanumiCode;
* a specific Undertaking;
* a workflow definition;
* a replacement for domain-specific professional semantics.

---

# 6. Janumi Professional Workbench

## 6.1 Canonical name

**Janumi Professional Workbench**

Abbreviation:

```text
JPWB
```

## 6.2 Definition

JPWB is the general-purpose environment for:

* designing Professional Work Architectures;
* versioning and publishing PWAs;
* instantiating Undertakings;
* operating Professional Work Graphs;
* executing PWUs;
* conducting assurance;
* exercising governance;
* managing baselines;
* tracing intent, work, evidence, and decisions;
* exporting professional-work packages.

JPWB is the general professional-work substrate used by Janumi’s domain products.

## 6.3 Core JPWB capabilities

```text
JPWB
├── PWA Library
├── PWA Designer
├── Template and Profile Management
├── Undertaking Portfolio
├── Undertaking Workbench
├── Work Graph Explorer
├── Execution Workbench
├── Assurance Workbench
├── Decision Center
├── Baseline Manager
├── Traceability Explorer
├── Change Impact Analysis
├── Shape Package Export
└── Diagnostics and Administration
```

## 6.4 JPWB scope

JPWB includes both:

### PWA definition

* PWU Type authoring;
* decomposition rules;
* recomposition rules;
* role definitions;
* assurance assignments;
* baseline definitions;
* execution-strategy compatibility;
* conformance fixtures.

### Undertaking operation

* PWU Instance creation;
* concrete decomposition;
* execution;
* evidence;
* assurance;
* findings;
* decisions;
* baselines;
* recovery;
* export.

## 6.5 Bootstrap requirement

JPWB must be sufficiently general to define and operate the Professional Work Architectures used to build JPWB and JanumiCode themselves.

Canonical principle:

> JPWB should be capable of building, assuring, governing, and evolving the professional-work systems that define and produce JPWB.

This is a required dogfooding property.

## 6.6 JPWB is not

JPWB is not:

* exclusively a workflow editor;
* only a PWA authoring tool;
* only an Undertaking dashboard;
* specific to software engineering;
* identical to JanumiCode.

---

# 7. Recursive Professional Harness

## 7.1 Definition

The **Recursive Professional Harness**, or RPH, is the underlying control and runtime architecture that enables professional work to be:

* decomposed;
* executed;
* assessed;
* revised;
* recomposed;
* governed;
* baselined;
* traced.

RPH is primarily an architectural and runtime concept.

JPWB is the principal user-facing environment through which RPH capabilities are exposed.

## 7.2 RPH responsibilities

RPH supports:

* Professional Work Units;
* execution planning;
* loop control;
* context assembly;
* runtime bindings;
* assurance policies;
* claims and evidence;
* decisions;
* baselines;
* event history;
* change impact;
* state recovery.

## 7.3 Relationship

```text
RPH
    underlying control architecture

JPWB
    general user-facing professional-work environment

Domain products
    specialized environments built on JPWB and RPH
```

---

# 8. Professional Work Architecture

## 8.1 Canonical abbreviation

```text
PWA
```

## 8.2 Definition

A **Professional Work Architecture** is a reusable, versioned architecture defining how a class of professional work should be structured, decomposed, executed, assured, governed, and accepted.

A PWA may define:

* root PWU Types;
* allowed child PWU Types;
* decomposition patterns;
* recomposition rules;
* obligations;
* constraints;
* required inputs;
* required outputs;
* artifact types;
* evidence requirements;
* assurance-policy assignments;
* roles;
* authorities;
* baseline types;
* completion semantics;
* execution-strategy compatibility;
* conformance tests;
* reference fixtures.

## 8.3 PWA as architecture, not sequence

A PWA is not primarily a temporal sequence.

It may include:

* semantic progression;
* prerequisites;
* dependencies;
* feedback relationships;
* iteration permissions;
* conditional decomposition.

But it is not reduced to a fixed linear workflow.

## 8.4 Example

```text
Product Realization PWA

Product Realization
├── Intent and Product Definition
├── Product Behavior Definition
├── Architecture Definition
├── Implementation Planning
├── Product Implementation
├── Integrated Product Validation
└── Product Baseline Promotion
```

This structure defines types of professional work and their relationships.

It does not by itself specify every model call, retry, human wait, or tool invocation.

## 8.5 PWA contents

A PWA may include the following first-class elements:

```text
PWA
├── PWU Types
├── Work relationship rules
├── Obligation definitions
├── Constraint definitions
├── Decomposition rules
├── Recomposition rules
├── Assurance assignments
├── Role and authority definitions
├── Evidence requirements
├── Baseline definitions
├── Execution-strategy compatibility
├── Profiles
├── Templates
├── Conformance tests
└── Reference fixtures
```

---

# 9. Professional Work Unit

## 9.1 Canonical abbreviation

```text
PWU
```

## 9.2 Definition

A **Professional Work Unit** is a bounded, identifiable, executable, assessable, and traceable unit of professional work.

A PWU carries or references:

* intent;
* purpose;
* boundaries;
* obligations;
* constraints;
* assumptions;
* dependencies;
* inputs;
* expected outputs;
* evidence requirements;
* assurance requirements;
* execution state;
* assurance state;
* shape-integrity state;
* governance;
* traceability.

## 9.3 PWU Type

A **PWU Type** is a reusable definition inside a PWA.

Example:

```text
Architecture Definition
```

## 9.4 PWU Instance

A **PWU Instance** is a concrete PWU in an Undertaking.

Example:

```text
Architecture Definition for the Field Service Management SaaS
```

## 9.5 Type-instance distinction

```text
PWU Type
    reusable definition in a PWA

PWU Instance
    concrete professional work in an Undertaking
```

---

# 10. Undertaking

## 10.1 Definition

An **Undertaking** is a concrete body of professional work instantiated under one or more compatible PWAs.

It has:

* a specific objective;
* a selected PWA and version;
* concrete PWU Instances;
* actual assumptions;
* actual evidence;
* actual execution;
* actual assessments;
* actual decisions;
* actual baselines;
* actual outputs.

## 10.2 Example

```text
Field Service Management SaaS Undertaking
```

This Undertaking may be instantiated from:

```text
Product Realization PWA v1.3
```

## 10.3 Undertaking is not the resulting product

The Undertaking is the governed body of work.

The resulting product is the output produced and evolved through that work.

```text
Field Service Management SaaS Undertaking
    professional work

Field Service Management SaaS
    product produced by the work
```

## 10.4 Undertaking lifecycle

An Undertaking may include:

* conception;
* shaping;
* execution;
* assurance;
* approval;
* baseline promotion;
* deployment;
* operation;
* evolution;
* retirement.

A long-lived product may have:

* one continuing Undertaking;
* multiple related Undertakings;
* separate realization and operations Undertakings;
* recurring maintenance Undertakings.

The precise organization is determined by the applicable PWA.

---

# 11. Professional Work Graph

## 11.1 Definition

A **Professional Work Graph** is the instantiated semantic graph of professional-work objects and relationships belonging to an Undertaking.

It may contain:

* PWU Instances;
* obligations;
* constraints;
* assumptions;
* claims;
* evidence;
* artifacts;
* assessments;
* observations;
* decisions;
* baselines;
* trace links;
* dependencies.

## 11.2 Example

```text
Field Service Management Professional Work Graph

Product Realization
├── Intent and Product Definition
├── Product Behavior Definition
├── Architecture Definition
│   ├── Multi-Tenancy Architecture
│   ├── Data Architecture
│   └── Mobile Architecture
└── Implementation Planning
```

## 11.3 Distinction from PWA

```text
PWA
    reusable architecture

Professional Work Graph
    concrete instantiated work
```

## 11.4 Distinction from execution workflow

The Professional Work Graph represents what the professional work is and how its semantic elements relate.

An execution workflow represents how work is temporally performed.

---

# 12. Execution Plan and Execution Workflow

## 12.1 Execution Plan

An **Execution Plan** is the governed plan for performing one or more PWUs.

It may define:

* steps;
* dependencies;
* roles;
* models;
* tools;
* context requirements;
* runtime permissions;
* retries;
* branching;
* escalation;
* termination.

## 12.2 Execution Workflow

An **Execution Workflow** is the temporal execution structure through which a plan is carried out.

The term `workflow` is valid at this level.

Examples:

* architecture-generation workflow;
* security-patch workflow;
* approval workflow;
* evidence-gathering workflow;
* deployment workflow;
* recovery workflow.

## 12.3 Distinction

```text
Professional Work Architecture
    defines reusable professional structure

Professional Work Graph
    represents instantiated professional work

Execution Plan
    defines how selected work will be performed

Execution Workflow
    represents temporal execution behavior
```

## 12.4 Workflow terminology rule

Do not use `workflow` as the canonical term for an entire PWA.

Valid:

> The Product Realization PWA uses several execution workflows.

Avoid:

> The Product Realization PWA is a workflow of phases.

---

# 13. View, projection, and viewpoint

## 13.1 View

A **View** is a user-facing representation of underlying professional-work or execution data.

Examples:

* Product Realization View;
* Security View;
* Assurance View;
* Traceability View;
* Runtime View;
* Change Impact View.

## 13.2 Projection

A **Projection** is a derived representation optimized for a particular question or user need.

A View may be implemented using one or more projections.

## 13.3 Viewpoint

A **Viewpoint** is the organizing concern through which data is selected or arranged.

Examples:

* security viewpoint;
* architecture viewpoint;
* compliance viewpoint;
* operations viewpoint.

## 13.4 View is not architecture

A Security View is not automatically a Security Maintenance PWA.

```text
Security View
    filtered or specialized presentation

Security Maintenance PWA
    reusable architecture of security-maintenance work
```

---

# 14. Retirement of canonical “Lens” terminology

## 14.1 Prior usage

Earlier JanumiCode discussions used `Lens` to mean:

* a domain-specific work architecture;
* a filtered UI perspective;
* a product subsystem;
* a professional-work template.

This creates ambiguity.

## 14.2 Canonical rule

The term `Lens` is retired as the canonical name for a Professional Work Architecture.

Use:

```text
Professional Work Architecture
PWA
```

## 14.3 Permitted residual use

`Lens` may remain in:

* legacy code;
* migration adapters;
* historical documents;
* informal UI terminology for viewpoints;
* branded names that are explicitly defined.

When used for a UI perspective, prefer:

* View;
* Viewpoint;
* Projection.

## 14.4 Migration

```text
Product Lens
    becomes
Product Realization PWA

Lens Designer
    becomes
PWA Designer

Lens Library
    becomes
PWA Library

Lens version
    becomes
PWA version

Lens migration
    becomes
PWA version migration
```

---

# 15. JanumiCode

## 15.1 Definition

**JanumiCode** is the Janumi domain product for software-product conception, realization, implementation, validation, deployment, operation, maintenance, and evolution.

It is built on:

* Janumi Platform;
* JPWB;
* RPH;
* software-product PWAs;
* software-engineering views;
* coding-agent integrations;
* repository and IDE integrations;
* build, test, deployment, and observability capabilities.

## 15.2 JanumiCode is a domain product

JanumiCode is not a single PWA.

It is a productized software-engineering environment containing multiple PWAs and domain-specific capabilities.

## 15.3 Canonical composition

```text
JanumiCode
├── Product Realization PWA
├── Product Operations PWA
├── Security Maintenance PWA
├── Brownfield Modernization PWA
├── Product Migration PWA
├── Incident and Recovery PWA
├── Software assurance policies
├── Software artifact types
├── Product-specific views
├── IDE and repository integrations
├── Coding-agent execution
├── Build and test systems
├── Verification and validation
├── Deployment integrations
└── Product Shape Package generation
```

This list is illustrative rather than exhaustive.

## 15.4 JanumiCode purpose

JanumiCode enables tenant users to:

* define and customize software-product PWAs;
* instantiate product Undertakings;
* shape product intent;
* define behavior;
* define architecture;
* plan implementation;
* execute implementation;
* validate and verify products;
* deploy products;
* export shape and implementation packages;
* operate and evolve products.

## 15.5 Product-specific surfaces

JanumiCode may include specialized surfaces such as:

* Product Realization View;
* Product Decomposition View;
* Intent-to-Deployment Trace;
* Requirements and Journey Studio;
* Architecture Studio;
* Implementation Workbench;
* Test and V&V View;
* Repository and Deployment View;
* Product Operations View.

These surfaces are domain-specific projections and interaction models.

They are not themselves PWAs.

---

# 16. Product Realization PWA

## 16.1 Definition

The **Product Realization PWA** is the reusable Professional Work Architecture used to shape, define, architect, implement, validate, and baseline a software product.

## 16.2 Canonical top-level structure

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

## 16.3 Coverage

The Product Realization PWA may cover:

* underspecified originating intent;
* stakeholders;
* actors;
* personas;
* user journeys;
* scenarios;
* capabilities;
* requirements;
* architecture;
* user stories;
* acceptance criteria;
* implementation;
* testing;
* verification and validation;
* deployment preparation;
* commit and release artifacts;
* baseline promotion.

## 16.4 Legacy decomposition viewer

The legacy JanumiCode decomposition viewer is understood as an early form of a:

```text
Product Realization View
```

It visualized the instantiated decomposition from intent through delivery.

It was not the Product Realization PWA itself.

---

# 17. Product Operations and specialized software PWAs

## 17.1 Product Operations PWA

A reusable PWA for operating, maintaining, observing, and evolving a software product.

Possible areas:

* incident management;
* reliability work;
* dependency upgrades;
* release management;
* operational change;
* capacity work;
* maintenance;
* deprecation;
* retirement.

## 17.2 Security Maintenance PWA

A reusable PWA for vulnerability review and remediation.

Possible structure:

```text
Security Maintenance
├── Vulnerability Intake
├── Applicability Assessment
├── Impact Analysis
├── Remediation Planning
├── Patch Implementation
├── Regression Testing
├── Security Verification
├── Deployment
└── Post-Deployment Validation
```

An Undertaking might be:

> Remediate CVE-XXXX across Product Y.

## 17.3 Brownfield Modernization PWA

A reusable PWA for:

* understanding an existing system;
* identifying design rationale;
* preserving required behavior;
* planning modernization;
* migration;
* change impact;
* validation.

## 17.4 PWA, module, profile, or view

A recurring concern such as security patching may be represented as:

### Independent PWA

When it constitutes a complete reusable body of professional work.

### PWA module

When it is composed into a broader PWA.

### PWA profile

When it changes the rigor, constraints, or execution strategy of an existing PWA.

### View

When it merely presents security-relevant information from an Undertaking.

The classification must be explicit.

---

# 18. Other Janumi domain products

## 18.1 JanumiLegal

A domain product for legal professional work.

It may include:

* legal PWAs;
* legal work-unit types;
* legal research;
* contract analysis;
* matter management;
* legal evidence;
* legal assurance;
* authority and privilege controls;
* document and case-management integrations;
* legal-specific views.

## 18.2 JanumiHealth

A domain product for healthcare and health-related professional work.

It may include:

* clinical and administrative PWAs;
* diagnostic-support PWAs;
* longitudinal evidence handling;
* healthcare-specific assurance;
* privacy and authority controls;
* medical-record integrations;
* domain-specific views.

JanumiHealth must distinguish decision support from regulated medical authority according to applicable policy and deployment context.

## 18.3 JanumiConstruction

A domain product for construction planning, coordination, execution, reconciliation, and assurance.

It may include:

* construction PWAs;
* schedule and dependency models;
* field-work coordination;
* document control;
* change orders;
* safety and compliance;
* evidence collection;
* repository integrations;
* continuous reconciliation views.

## 18.4 Common pattern

```text
Janumi domain product
├── Domain PWA library
├── PWA templates and profiles
├── Domain PWU Types
├── Domain assurance policies
├── Domain artifact and evidence types
├── Domain integrations
├── Domain execution strategies
├── Domain-specific views
└── Export and deployment pathways
```

---

# 19. PWA library and template model

## 19.1 Janumi-published PWA

A PWA maintained and published by Janumi.

Example:

```text
Janumi Product Realization PWA v1.3
```

## 19.2 PWA template

A reusable starting configuration for a PWA or part of a PWA.

A template may define:

* default PWU Types;
* common decomposition;
* default policies;
* sample artifacts;
* reference execution strategies.

A template is not necessarily a complete PWA.

## 19.3 PWA profile

A bounded configuration of a PWA.

Examples:

* startup MVP profile;
* regulated enterprise profile;
* mobile-first profile;
* brownfield-change profile;
* safety-critical profile;
* emergency-remediation profile.

A profile may alter:

* required PWUs;
* assurance rigor;
* evidence requirements;
* human authority;
* execution strategies;
* baseline requirements.

## 19.4 Tenant-derived PWA

A tenant may derive, fork, or extend a Janumi-published PWA.

Example:

```text
Acme Regulated SaaS Product Realization PWA
```

It may add:

* internal standards;
* required security review;
* compliance obligations;
* organizational roles;
* deployment constraints;
* customer-specific baseline rules.

## 19.5 Undertaking-local extension

An Undertaking may add local professional work that does not alter the underlying tenant or Janumi PWA.

Example:

```text
Specialized Hardware Certification PWU
```

## 19.6 Canonical customization hierarchy

```text
Janumi-published PWA
    ↓ optionally configured by
PWA Profile
    ↓ optionally extended or forked as
Tenant PWA
    ↓ instantiated as
Undertaking
    ↓ optionally extended through
Undertaking-local PWUs
```

---

# 20. PWA inheritance and authority

## 20.1 Inherited definitions

An Undertaking may inherit:

* PWU Type definitions;
* decomposition rules;
* assurance assignments;
* baseline requirements;
* role expectations;
* completion semantics.

## 20.2 Local content

An Undertaking owns:

* PWU Instances;
* actual boundaries;
* actual assumptions;
* actual evidence;
* actual assessments;
* actual decisions;
* actual baselines;
* actual execution state.

## 20.3 No silent mutation

Changes to a published PWA version do not silently alter existing Undertakings.

An Undertaking remains bound to its selected PWA version until:

* explicitly migrated;
* locally extended;
* superseded by a successor Undertaking;
* governed by an approved compatibility policy.

## 20.4 Bottom-up learning

An Undertaking may propose a PWA improvement.

It may not directly mutate the published PWA.

```text
Undertaking observation
    ↓
PWA change proposal
    ↓
PWA governance and conformance
    ↓
new published PWA version
```

---

# 21. Field Service Management canonical reference chain

The canonical reference example is:

```text
Janumi
    company

Janumi Platform
    runtime and shared services

Janumi Professional Workbench
    generic professional-work environment

JanumiCode
    software-product domain product

Product Realization PWA vX
    reusable software-product work architecture

Field Service Management SaaS Undertaking
    concrete professional work

Field Service Management Professional Work Graph
    instantiated PWUs and relationships

Execution workflows
    temporal agent, human, and tool activity

Field Service Management SaaS
    product produced by the Undertaking
```

## 21.1 Canonical sentence

> A tenant uses JanumiCode, operating on the Janumi Platform through the Janumi Professional Workbench, to instantiate the Product Realization PWA as the Field Service Management SaaS Undertaking, whose Professional Work Graph is executed, assured, governed, and baselined to produce the Field Service Management SaaS product.

## 21.2 Product deployment

The resulting Field Service Management SaaS may be:

* deployed on Janumi Platform;
* deployed into a customer environment;
* exported for external implementation;
* delivered as a managed application;
* handed off as a Product Shape Package.

---

# 22. Product Shape Package

## 22.1 Canonical name

```text
Product Shape Package
```

## 22.2 Definition

A Product Shape Package is a governed export of the shape-engineering outputs of a Product Realization Undertaking.

It may stop short of implementation or include implementation-ready planning.

## 22.3 Possible contents

* approved Product Intent;
* stakeholders;
* actors;
* personas;
* capabilities;
* journeys;
* scenarios;
* requirements;
* acceptance criteria;
* constraints;
* assumptions;
* architecture;
* architecture decisions;
* data models;
* interface definitions;
* implementation decomposition;
* test strategy;
* verification obligations;
* validation strategy;
* traceability;
* assurance results;
* residual risks;
* decisions;
* baselines.

## 22.4 Export formats

A Product Shape Package may be exported as:

* human-readable document set;
* machine-readable Janumi package;
* source repository;
* architecture package;
* requirements package;
* implementation backlog;
* contract-builder handoff bundle;
* audit package.

## 22.5 Handoff scenarios

Appropriate for:

* specialized hardware;
* embedded systems;
* classified environments;
* regulated customer environments;
* customer-controlled infrastructure;
* external contract builders;
* internal implementation organizations;
* non-Janumi deployment.

---

# 23. Implementation Package

A Product Realization Undertaking may additionally produce an **Implementation Package**.

It may include:

* source code;
* build definitions;
* tests;
* infrastructure definitions;
* deployment manifests;
* operational documentation;
* migration tooling;
* evidence;
* release artifacts.

The Shape Package and Implementation Package are related but distinct.

```text
Product Shape Package
    describes and governs what should be built

Implementation Package
    contains or enables the built realization
```

---

# 24. Delivery dispositions

A Product Realization Undertaking may conclude with one or more delivery dispositions.

```text
Delivery disposition
├── Deploy on Janumi Platform
├── Deploy in customer-managed environment
├── Export Product Shape Package
├── Export Implementation Package
├── Export infrastructure package
├── Transfer to external contractor
├── Transfer to internal implementation organization
└── Retain as approved design without implementation
```

Deployment on Janumi Platform is a supported outcome.

It is not an implicit requirement of every Product Realization PWA.

---

# 25. Product produced by an Undertaking

The output product should be named separately from the Undertaking.

Example:

```text
Undertaking:
Field Service Management SaaS Undertaking

Product:
Field Service Management SaaS
```

An Undertaking may produce:

* software;
* service;
* policy;
* legal instrument;
* construction outcome;
* analysis;
* operational capability;
* professional recommendation;
* shape package.

The output type depends on the PWA.

---

# 26. Assurance, governance, and baselines

## 26.1 Assurance

Assurance evaluates claims using evidence under policies.

It does not merely mark tasks as passed or failed.

## 26.2 Governance

Governance is the exercise of authority over:

* approval;
* rejection;
* waiver;
* escalation;
* residual risk;
* baseline promotion;
* revocation;
* supersession.

## 26.3 Baseline

A **Baseline** is a governed, immutable, version-bound authoritative state.

Examples:

* Product Intent Baseline;
* Product Behavior Baseline;
* Architecture Baseline;
* Product Baseline;
* Release Baseline;
* Evidence Package Baseline.

## 26.4 Commit versus baseline

A repository commit is a technical artifact operation.

A baseline is an authoritative professional decision.

```text
Commit
    records source state

Baseline
    records accepted authoritative state
```

A commit may be included in a baseline.

It is not automatically a baseline.

---

# 27. Vocabulary migration table

| Earlier or ambiguous term                | Canonical term or treatment                                      |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Janumi                                   | Company and product family                                       |
| Janumi Platform                          | Shared multi-tenant technical and service foundation             |
| Professional Workbench                   | Janumi Professional Workbench                                    |
| JPWB                                     | Accepted abbreviation                                            |
| Lens as work architecture                | Professional Work Architecture                                   |
| PWA                                      | Canonical abbreviation                                           |
| Product Lens                             | Product Realization PWA                                          |
| Lens Designer                            | PWA Designer                                                     |
| Lens Library                             | PWA Library                                                      |
| Product Lens Workbench                   | Undertaking Workbench or JanumiCode product surface              |
| Workflow for full professional structure | PWA or Professional Work Graph                                   |
| Workflow for temporal execution          | Execution Workflow                                               |
| Workflow Canvas as ontology              | Execution View or projection only                                |
| Product Lens example                     | Product Realization PWA reference fixture                        |
| Field Service example                    | Field Service Management SaaS Undertaking                        |
| Field Service work structure             | Field Service Professional Work Graph                            |
| Field Service software                   | Field Service Management SaaS product                            |
| Decomposition viewer                     | Product Realization View or Product Work Graph View              |
| Shape document                           | Product Shape Package                                            |
| JanumiCode as a PWA                      | JanumiCode contains multiple software-product PWAs               |
| Security lens as work architecture       | Security Maintenance PWA                                         |
| Security lens as UI filter               | Security View or Security Viewpoint                              |
| Phase                                    | Derived compatibility milestone where legacy support is required |
| Validator                                | Implementation of an Assurance Policy                            |
| Commit phase                             | Repository operation plus separate baseline governance           |
| Replan phase                             | Controller action, not a universal professional-work phase       |

---

# 28. Canonical naming rules

## 28.1 Domain products

Use branded product names:

* JanumiCode;
* JanumiLegal;
* JanumiHealth;
* JanumiConstruction.

## 28.2 Professional Work Architectures

Use functional names ending in `PWA`.

Examples:

* Product Realization PWA;
* Product Operations PWA;
* Security Maintenance PWA;
* Contract Review PWA;
* Construction Coordination PWA.

## 28.3 Undertakings

Use the concrete objective plus `Undertaking` when disambiguation is needed.

Examples:

* Field Service Management SaaS Undertaking;
* Hospital Expansion Undertaking;
* Vendor Contract Review Undertaking.

## 28.4 Views

Use names ending in `View`, `Explorer`, `Studio`, or `Workbench`.

Examples:

* Product Realization View;
* Traceability Explorer;
* Architecture Studio;
* Assurance Workbench.

## 28.5 Packages

Use names ending in `Package`.

Examples:

* Product Shape Package;
* Implementation Package;
* Evidence Package;
* Deployment Package.

---

# 29. Product decomposition

The canonical conceptual decomposition is:

```text
Janumi Platform
├── Shared platform services
├── RPH services
├── JPWB
│   ├── PWA Designer
│   ├── Undertaking Workbench
│   ├── Execution Workbench
│   ├── Assurance Workbench
│   ├── Decision Center
│   ├── Baseline Manager
│   └── Traceability Explorer
│
└── Domain products
    ├── JanumiCode
    ├── JanumiLegal
    ├── JanumiHealth
    └── JanumiConstruction
```

A domain product may:

* reuse JPWB surfaces;
* specialize JPWB surfaces;
* add domain-specific surfaces;
* add PWA libraries;
* add integrations;
* add execution strategies;
* add policies.

---

# 30. JanumiCode and JPWB relationship

## 30.1 JPWB provides

* generic PWA authoring;
* generic Undertaking operation;
* generic assurance;
* generic governance;
* generic baselines;
* generic traceability.

## 30.2 JanumiCode adds

* software-product PWAs;
* coding-agent roles;
* repository integrations;
* IDE surfaces;
* source artifacts;
* build systems;
* test systems;
* architecture models;
* V&V;
* deployment workflows;
* software-specific assurance;
* product-specific views.

## 30.3 Canonical relationship

```text
JPWB
    general professional-work environment

JanumiCode
    software-product specialization of JPWB
```

## 30.4 JanumiCode may be built using JanumiCode

The Product Realization PWA should be capable of supporting Undertakings that build:

* JPWB;
* JanumiCode;
* Janumi Platform components;
* domain products;
* tenant products.

This is an explicit architectural objective.

---

# 31. Domain views versus domain products

A specialized view does not by itself constitute a domain product.

Example:

```text
Construction Schedule View
    specialized projection

JanumiConstruction
    domain product containing PWAs, views, policies,
    integrations, and execution capabilities
```

Similarly:

```text
Security View
    projection of security concerns

Security Maintenance PWA
    reusable work architecture

JanumiCode
    domain product that may include both
```

---

# 32. Reference fixtures

A **Reference Fixture** is a representative Undertaking used to test or demonstrate a PWA.

The Field Service Management SaaS Undertaking may serve as:

* Product Realization PWA conformance fixture;
* UX demonstration fixture;
* event-replay fixture;
* assurance fixture;
* migration fixture.

It must always be labeled as an instance or fixture.

It must not be presented as the PWA definition itself.

---

# 33. Canonical UX contexts

Users must be able to distinguish among:

## 33.1 PWA Design context

Used to define:

* PWU Types;
* relationship rules;
* assurance assignments;
* baseline types;
* profiles;
* templates.

## 33.2 Undertaking context

Used to operate:

* PWU Instances;
* actual assumptions;
* actual evidence;
* actual findings;
* actual decisions;
* actual baselines.

## 33.3 Execution context

Used to operate:

* plans;
* workflows;
* agents;
* tools;
* retries;
* runtime bindings.

## 33.4 Assurance context

Used to evaluate:

* claims;
* evidence;
* criteria;
* findings;
* dispositions.

## 33.5 Governance context

Used to exercise:

* approval;
* waiver;
* rejection;
* escalation;
* baseline authority.

---

# 34. Architectural invariants

The following vocabulary and product-boundary invariants are mandatory.

1. Janumi is the company and product family.

2. Janumi Platform is the shared technical and service foundation.

3. JPWB is the general-purpose professional-work environment.

4. JanumiCode is a software-product domain product built on JPWB.

5. JanumiCode may contain multiple PWAs.

6. Product Realization PWA is not synonymous with JanumiCode.

7. A PWA defines reusable professional-work architecture.

8. An Undertaking instantiates a PWA.

9. A Professional Work Graph belongs to an Undertaking.

10. A PWU Type belongs to a PWA.

11. A PWU Instance belongs to an Undertaking.

12. An Execution Workflow is temporal machinery, not the PWA itself.

13. A View is a projection, not the underlying PWA or Work Graph.

14. The Field Service Management SaaS Undertaking is not the Product Realization PWA.

15. The Field Service Management SaaS product is not the Undertaking.

16. A repository commit is not an authoritative baseline.

17. A PWA update does not silently alter existing Undertakings.

18. An Undertaking-local extension does not automatically modify its PWA.

19. A domain product may add PWAs, views, integrations, policies, and execution strategies.

20. Deployment on Janumi Platform is optional unless an Undertaking explicitly requires it.

---

# 35. Document-set migration guidance

Existing architecture artifacts should be updated in this order.

## 35.1 Document 0

This Charter becomes the first document.

```text
RPH-DOC-000
Janumi Product Architecture and Canonical Vocabulary Charter
```

## 35.2 Replace Product Lens terminology

Where `Product Lens` means reusable work architecture, replace it with:

```text
Product Realization PWA
```

## 35.3 Replace Lens Designer

Replace with:

```text
PWA Designer
```

## 35.4 Replace Product Lens Workbench

Determine intended context:

* PWA definition → PWA Designer;
* concrete Field Service work → Undertaking Workbench;
* software-specific domain surface → JanumiCode.

## 35.5 Correct Field Service references

Label consistently as:

```text
Field Service Management SaaS Undertaking
```

and distinguish it from:

```text
Field Service Management SaaS product
```

## 35.6 Correct workflow usage

Use `workflow` only where temporal execution or approval behavior is intended.

---

# 36. Revised artifact reading order

The canonical document order becomes:

```text
RPH-DOC-000
Janumi Product Architecture and Canonical Vocabulary Charter

RPH-DOC-001
RPH / Product Realization Architecture and Feature Specification

RPH-DOC-002
Canonical Domain Model, Invariants, State Machines, and Event Contract

RPH-DOC-003
Product Realization PWA Ontology and Assurance Assignment Specification

RPH-DOC-004
Assurance Policy Catalog and Validator Contract

RPH-DOC-005
Legacy JanumiCode Semantic Inventory and RPH Conformance Mapping

RPH-DOC-006
Field Service Management SaaS Reference Undertaking

RPH-DOC-007
Command, Event, and Schema Contract Package

RPH-DOC-008
Executable Invariant and Conformance Test Specification

RPH-DOC-009
Persistence, Migration, Dual-Run, and Cutover Design

RPH-DOC-010
PWA Designer and Undertaking Workbench UX Specification
```

Titles may be adjusted during formal document revision.

---

# 37. Product narrative

The canonical product narrative is:

> Janumi provides the Janumi Platform, a multi-tenant foundation for professional-work systems, product deployment, integrations, runtime execution, assurance, and enterprise services. The Janumi Professional Workbench enables organizations to define, publish, instantiate, execute, assure, govern, and baseline Professional Work Architectures. JanumiCode is the software-product specialization of that Workbench and includes Professional Work Architectures for product realization, product operations, security maintenance, modernization, and related software-engineering work. A tenant may instantiate the Product Realization PWA as an Undertaking—such as the Field Service Management SaaS Undertaking—to produce a deployed product, an implementation package, or a governed Product Shape Package for external handoff.

---

# 38. Concise canonical definitions

## Janumi

The company and product family.

## Janumi Platform

The shared multi-tenant infrastructure, runtime, commercial, integration, and operational foundation.

## Janumi Professional Workbench

The general-purpose environment for designing and operating Professional Work Architectures and Undertakings.

## Recursive Professional Harness

The control architecture underlying recursive execution, assurance, governance, and recovery.

## Professional Work Architecture

A reusable, versioned architecture defining how a class of professional work is structured and governed.

## Professional Work Unit

A bounded, executable, assessable, and traceable unit of professional work.

## Undertaking

A concrete body of professional work instantiated under a PWA.

## Professional Work Graph

The instantiated semantic graph of professional-work objects within an Undertaking.

## Execution Workflow

The temporal process through which PWUs are performed.

## Domain Product

A specialized Janumi product combining domain PWAs, views, policies, integrations, and execution capabilities.

## Product Shape Package

A governed export of product-shaping outputs for implementation, review, or handoff.

## Baseline

An immutable, version-bound, authoritative accepted state.

---

# 39. Canonical example

```text
Company
Janumi

Platform
Janumi Platform

General professional-work environment
Janumi Professional Workbench

Software-product domain environment
JanumiCode

Reusable work architecture
Product Realization PWA v1.3

Concrete work
Field Service Management SaaS Undertaking

Instantiated work structure
Field Service Management Professional Work Graph

Temporal execution
Architecture-generation and implementation workflows

Governed output
Product Shape Package and Product Baseline

Produced product
Field Service Management SaaS

Deployment
Janumi Platform or another approved environment
```

---

# 40. Definition of conformance

A document, design, UI, or implementation conforms to this Charter when:

1. It distinguishes Janumi from Janumi Platform.
2. It distinguishes JPWB from JanumiCode.
3. It treats JanumiCode as a domain product containing multiple PWAs.
4. It uses PWA for reusable professional-work architecture.
5. It uses Undertaking for concrete instantiated professional work.
6. It distinguishes PWU Types from PWU Instances.
7. It distinguishes Professional Work Graphs from Execution Workflows.
8. It treats Views as projections.
9. It identifies Field Service Management as an Undertaking and resulting product separately.
10. It uses Product Shape Package for governed preimplementation or handoff exports.
11. It does not treat commits as baselines.
12. It does not silently propagate PWA changes into existing Undertakings.
13. It uses `workflow` only for temporal process or execution where appropriate.
14. It treats legacy `Lens` terminology as superseded or explicitly scoped.
15. It preserves the bootstrap requirement that Janumi can use its own professional-work environment to build itself.

---

# 41. Final canonical formulation

> **Janumi is the company. Janumi Platform is the shared multi-tenant deployment and service foundation. Janumi Professional Workbench is the general environment for defining and operating Professional Work Architectures. JanumiCode is the software-product specialization of that Workbench and contains multiple product-focused PWAs. The Product Realization PWA defines reusable professional work for creating software products. The Field Service Management SaaS Undertaking is one concrete instantiation of that PWA. Its Professional Work Graph is executed through temporal workflows, evaluated through assurance, governed through decisions, and accepted through baselines to produce either a deployed product, an implementation package, or a Product Shape Package for external handoff.**
