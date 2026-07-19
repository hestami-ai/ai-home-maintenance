# JAN-IRP-001 — Normative Implementation Program Charter

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Program name:** Janumi Implementation Realization Program  
**Program type:** Self-instantiating normative implementation program  
**Authority:** Subordinate to the approved Janumi Constitution and normative architecture corpus; governing over repository-specific implementation sequencing and acceptance

## 1. Mission

Transform the current Janumi implementation, whatever its discovered state, into an evidence-bearing implementation that conforms to approved Janumi doctrine and architecture while preserving valid existing behavior, exposing ambiguity, controlling migration risk, and maintaining reconstructability.

## 2. Problem statement

The normative Janumi corpus and the implementation repository may be developed in disconnected contexts. Consequently, a repository-specific roadmap cannot responsibly be authored from architectural documents alone, and the architectural corpus cannot safely assume the repository is absent, incorrect, or aligned.

The program solves this by making repository investigation, semantic reconstruction, conformance assessment, reconciliation, and transition design part of the controlled realization process.

## 3. Program outcome

The program outcome is:

> An accepted Janumi implementation baseline whose semantic meaning, professional behavior, execution behavior, user experience, agent participation, operational controls, known deviations, and residual uncertainty are traceable to approved normative obligations and supported by reproducible evidence.

## 4. Scope

The program governs:

- source-corpus control and requirement derivation;
- repository and artifact intake;
- current-state evidence acquisition;
- current-state semantic and architectural reconstruction;
- requirement applicability and conformance assessment;
- implementation–specification discrepancy reconciliation;
- transition architecture and migration strategy;
- repository-specific roadmap generation;
- capability-increment authorization and execution;
- assurance, review, and gate acceptance;
- beta or production baseline authorization;
- continued semantic and implementation evolution.

## 5. Non-goals

The program does not:

- assume the repository is empty or nonconformant;
- treat the normative documents as immune to correction;
- impose a calendar schedule inside normative gates;
- prescribe a particular issue tracker, branch model, or sprint method;
- authorize unrestricted refactoring during investigation;
- require complete implementation of every long-term Janumi concept before any useful vertical slice;
- permit coding agents to convert unresolved interpretation into invented certainty;
- equate compilation, generated artifacts, or UI completeness with conformance.

## 6. Canonical and instantiated artifacts

### 6.1 Canonical artifacts

Canonical artifacts remain stable across repositories:

- program lifecycle;
- source authority rules;
- evidence requirements;
- conformance statuses;
- discrepancy classifications;
- transition strategies;
- capability outcomes;
- gate acceptance rules;
- coding-agent constraints.

### 6.2 Instantiated artifacts

Repository-specific artifacts are generated during execution:

- repository evidence manifest;
- current-state models;
- requirement assessments;
- discrepancies and decisions;
- transition mappings;
- increment dependency graph;
- exact repository work items;
- evidence packages;
- acceptance decisions.

## 7. Governing principles

### 7.1 Outcome and intent preservation

Implementation activity shall remain traceable to a professional outcome, approved target intent, or explicit investigative purpose.

### 7.2 Evidence before conclusion

Claims about current implementation, conformance, nonconformance, completion, or safety shall cite reproducible evidence.

### 7.3 Current reality and target intent

- Code, tests, migrations, deployed behavior, and operational data are evidence of current reality.
- Approved doctrine and specifications govern target intent to the extent that they remain coherent and applicable.
- A conflict initiates reconciliation; it does not authorize automatic dominance by either side.

### 7.4 No-loss transformation

Migration shall preserve the ability to reconstruct:

- the pre-change implementation;
- the reason for change;
- affected obligations;
- selected transition strategy;
- evidence of resulting behavior.

### 7.5 Vertical semantic realization

Capability increments should prove an end-to-end professionally meaningful outcome across semantic model, runtime, projection, interaction, validation, and evidence rather than complete isolated technical layers without usable conformance.

### 7.6 Explicit uncertainty

Unknown, uninspected, ambiguous, contradictory, stale, and deferred states shall be explicit.

### 7.7 Bounded agent authority

Coding agents shall operate within phase- and increment-specific authority. They may investigate, propose, implement, validate, or review only as authorized.

### 7.8 Independent acceptance

An agent or person producing a material assessment or increment shall not be the sole acceptance authority for that output.

## 8. Program roles

| Role | Primary responsibility | Independence requirement |
|---|---|---|
| Program sponsor | Authorizes mission, resources, risk acceptance, and final baseline. | Shall not substitute sponsorship for technical acceptance. |
| Normative corpus steward | Controls document IDs, versions, status, and requirement derivation. | Should be independent of unilateral repository modification. |
| Repository evidence custodian | Preserves revision, build context, evidence hashes, and chain of custody. | Shall not alter evidence without a recorded derivative. |
| Current-state investigator | Reconstructs actual implementation semantics and behavior. | Shall distinguish observation from interpretation. |
| Reconciliation authority | Disposes code–specification discrepancies and upstream defects. | Material semantic decisions require recorded approval. |
| Transition architect | Defines preserve/adapt/migrate/replace path and compatibility strategy. | Shall account for operational continuity and rollback. |
| Roadmap instantiator | Generates repository-specific increments and dependency DAG. | Shall not invent unapproved target semantics. |
| Capability implementer | Implements an authorized increment and its tests. | Shall not self-approve the exit gate. |
| Independent reviewer | Challenges evidence, completeness, and conformance claims. | Shall not be the primary producer of the reviewed output. |
| Gate acceptance authority | Accepts, conditionally accepts, or rejects a phase or increment. | Shall possess the required professional and organizational authority. |
| Operations authority | Accepts operational risk, recovery posture, and release profile. | Required for `P8–P9` acceptance. |

One participant may fill multiple roles in a small organization, but the producing and independent-review functions shall remain distinguishable for material gates.

## 9. Program work architecture

The program shall be represented as a program-level RPH coordinating phase PWUs:

```text
Janumi Implementation Realization RPH
├── P0 Program Foundation PWU
├── P1 Repository Intake PWU
├── P2 Current-State Reconstruction PWU
├── P3 Conformance Assessment PWU
├── P4 Reconciliation PWU
├── P5 Transition Architecture PWU
├── P6 Roadmap Instantiation PWU
├── P7 Capability Realization PWUs
├── P8 Integration and Operational Assurance PWU
└── P9 Release and Evolution PWU
```

Every phase may decompose into child PWUs, but the program RPH retains responsibility for cross-phase coherence and final synthesis.

## 10. Program authority hierarchy

In the absence of an approved project-specific hierarchy, the following applies:

| Tier | Source | Effect |
|---:|---|---|
| 0 | Janumi Constitution | Highest normative Janumi authority. |
| 1 | Foundations, laws, PCLC, CPCO, CONOP, approved CONEMP | Universal semantics and doctrine. |
| 2 | PWU, RPH, Projection, JSDL, JEM, Shape Engineering, PWA profiles | Normative architecture and specialization. |
| 3 | Compiler, runtime, interaction, and UI profiles | Concrete realization profiles. |
| 4 | This implementation program, requirement register, roadmap instance, gate decisions | Controlled implementation and evidence governance. |
| 5 | Operating plan, backlog, estimates, assignments | Mutable execution logistics. |
| Evidence | Source code, tests, schemas, deployed behavior, telemetry | Evidence of current implementation, not automatically target authority. |

A lower tier may specialize but shall not silently redefine a higher tier. An observed implementation may demonstrate that a higher-tier draft is defective; that finding shall enter upstream reconciliation.

## 11. Program states

```text
PROPOSED
BASELINING
AUTHORIZED
ACTIVE
WAITING
UNDER_REVIEW
CONDITIONALLY_ACCEPTED
ACCEPTED
REJECTED
SUSPENDED
SUPERSEDED
CANCELLED
```

State changes shall be explicit and supported by an authority record.

## 12. Program completion conditions

The program may reach an accepted implementation baseline only when:

1. the normative source corpus and requirement register are controlled;
2. the repository and relevant operational state have been preserved and reconstructed;
3. all material requirements have an applicability and conformance disposition;
4. all material discrepancies have an accepted disposition or bounded deviation;
5. the transition architecture has been executed or accepted for the authorized baseline;
6. all baseline capability increments have accepted evidence packages;
7. cross-capability integration and operational conformance have passed;
8. tenant, authority, data-integrity, recovery, and agent-boundary risks are accepted by appropriate authorities;
9. residual deviations, deferrals, and uncertainty are explicit;
10. the semantic model, runtime profile, implementation revision, and deployment profile are identified.

## 13. Program change control

- Changes to timing, staffing, or task packaging belong in the operating plan.
- Changes to repository-specific sequencing require roadmap-instance change control.
- Changes to capability outcomes or acceptance criteria require canonical roadmap change control.
- Changes to Janumi professional meaning require upstream normative-specification change and reconciliation.

## 14. Initial adoption condition

This charter becomes effective when:

- an owner and approval authority are assigned;
- the source corpus is materialized;
- the provisional requirement register is accepted for audit;
- the program is authorized to enter `P1`.
