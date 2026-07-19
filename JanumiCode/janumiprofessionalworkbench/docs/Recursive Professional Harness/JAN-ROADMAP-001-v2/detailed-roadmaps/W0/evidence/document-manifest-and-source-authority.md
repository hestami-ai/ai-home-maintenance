# W0 Evidence — Authoritative Document Manifest and Source-Authority Matrix

**Discharges:** `JAN-WP-0-001` (via `JAN-W0-DWP-001`). **Deliverables:** approved document manifest; subject-authority matrix; document discrepancy log.
**Grounding:** direct read of the corpus headers under `docs/Recursive Professional Harness/`. Authority is **subject-specific** (`JAN-ROADMAP-001` §6); generation order **SHALL NOT** be treated as total precedence.

## 1. Document manifest (authoritative set)

| RPH ID | Title (repo file, `docs/Recursive Professional Harness/`) | Declared status | Subject authority | Authoritative? |
| --- | --- | --- | --- | --- |
| `RPH-DOC-000` | Janumi Product Architecture and Canonical Vocabulary Charter | Canonical baseline | Product ontology, subsystem boundaries, **naming authority** | Yes (naming) |
| `RPH-DOC-001` | Product Realization PWA — Migration to the RPH | Initial architecture draft | Migration architecture, program scope | Yes (scope) |
| `RPH-DOC-002` | RPH — Canonical Domain Model, Invariant Catalog, State Machines, Event Contract | Architecture baseline draft | Domain semantics, lifecycle, invariants, state meanings | Yes (semantics) |
| `RPH-DOC-003` | PWA — Professional Ontology and Assurance Policy Specification | Initial canonical draft | Product Realization PWA professional structure | Yes (PWA structure) |
| `RPH-DOC-004` | PWA — Assurance Policy Catalog and Validator Contract | Initial canonical draft | Assurance policies, evidence, criteria, validator contracts, waivers | Yes (assurance) |
| `RPH-DOC-005` | Legacy JanumiCode — Semantic Inventory and RPH Conformance Mapping | Initial migration baseline | Legacy-to-target hypotheses (**doc-based, not code-audited** — §2 self-declared) | Advisory (superseded by code grounding + sponsor `REMOVE`) |
| `RPH-DOC-006` | Field Service Management SaaS Reference Undertaking | Reference implementation fixture | Reference undertaking + expected behavior | Yes (fixture) |
| `RPH-DOC-007` | RPH — Command, Event, Schema Contract Package (contract v0.1.0) | Initial implementation baseline | Commands, events, schemas, service-boundary contracts | Yes (wire) |
| `RPH-DOC-008` | RPH — Executable Invariant and Conformance Test Specification | Initial test baseline | Executable invariants and conformance tests | Yes (conformance) |
| `RPH-DOC-009` | RPH — Persistence, Migration, Dual-Run, and Cutover Design | Initial implementation baseline | Persistence, migration, dual-run, rollback, cutover | Yes (persistence) |
| `RPH-DOC-010` | PWA Designer and Undertaking Workbench — Reference Demonstration | Corrected UX architecture baseline | PWA Designer / Undertaking Workbench UX | Yes (UX) |

## 2. Governing non-RPH-DOC authority

| ID | Title | Status | Subject authority |
| --- | --- | --- | --- |
| ENG-CONSTITUTION | JPWB Engineering Constitution | Normative (v1.0.1) | Engineering conduct constraints (normative) |
| ENG-DOCTRINE | JPWB Engineering Doctrine | Draft (v0.1.0) | Engineering doctrine (advisory pending ratification) |
| PLATFORM-OVERVIEW | Janumi Platform — Executive Overview | (unversioned) | Product/business framing (informative) |
| `JAN-ENG-POL-GIT-001` | Multi-Agent Git Repository Isolation and Coordination Policy | FINAL (v0.1.0) | Multi-agent commit/worktree discipline (**binding** on W0 commit hygiene) |
| `JAN-ROADMAP-001` (+ `-A`…`-F`) | Master Normative Implementation Roadmap v2 package | Proposed normative baseline (v2.0.0-draft) | Capability sequence, gates, detailed-roadmap standard |

## 3. Subject-authority matrix (question → primary authority)

| Question | Primary authority |
| --- | --- |
| What may a JPWB object/PWA/PWU be named? | `RPH-DOC-000` |
| What does a canonical object/state/event mean? | `RPH-DOC-002` |
| What is the PWA professional structure? | `RPH-DOC-003` |
| What must assurance enforce? | `RPH-DOC-004` |
| What is the wire/command/event/schema? | `RPH-DOC-007` |
| Which invariants must a conformance test prove? | `RPH-DOC-008` |
| How is state persisted / recovered / migrated? | `RPH-DOC-009` |
| What is the UX contract? | `RPH-DOC-010` |
| What is the capability sequence and gate? | `JAN-ROADMAP-001` |
| What did legacy JanumiCode do? | **Source code** (advisory: `RPH-DOC-005`); under sponsor direction, legacy is `REMOVE` |
| How must multiple agents share the repo? | `JAN-ENG-POL-GIT-001` |

## 4. Document discrepancy log (WP-0-001 deliverable)

| # | Discrepancy | Materiality | Disposition |
| --- | --- | --- | --- |
| D-001 | **Two documents surface the identifier `RPH-DOC-000`**: the *Canonical Vocabulary Charter* (the true RPH-DOC-000, per master §6) and the *Engineering Doctrine* (which references RPH-DOC-000). | Low | The Charter is authoritative for RPH-DOC-000; the Doctrine is a distinct governance draft. No collision in authority; logged. |
| D-002 | `RPH-DOC-005` (legacy inventory) is **self-declared not a code audit** (§2) yet is cited as source by four W0 master WPs. | Material | Resolved by W0: legacy is `REMOVE` (sponsor); RPH-DOC-005 is retained as advisory legacy mapping, not authoritative current-state. See `legacy-classification.md`. |
| D-003 | Most RPH-DOC-002…010 are **"draft/baseline"**, not ratified; the master roadmap is **"proposed"**. | Material | W0 treats them as the provisional corpus (master W0 entry criterion permits this); G0 records that ratification is pending. |
| D-004 | The Engineering Constitution is **Normative v1.0.1** while the Engineering Doctrine is **Draft** — a governance-maturity split. | Low | Constitution binds; Doctrine advisory. Logged. |

## 5. Exit-criterion attestation

Every source document is identified and assigned subject-specific authority or marked non-authoritative/advisory (§1–§3), and discrepancies are logged (§4). `JAN-WP-0-001` exit criterion **met**.
