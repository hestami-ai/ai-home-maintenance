# JAN-IRP-015 — Reference Execution Scenario

**Version:** 0.3.0  
**Status:** Reference Normative Example  
**Purpose:** Demonstrate how the self-instantiating roadmap operates when the normative corpus and implementation repository begin in disconnected contexts.

## 1. Starting condition

The Janumi doctrine and architecture corpus define CPCO, PWUs, RPHs, projections, UI/UX, JSDL, JEM, runtime, Shape Engineering, and JanumiCode.

The current conversation does not contain the repository archive. The implementation may already include partial or divergent forms of these concepts.

The program therefore begins without claiming a repository-specific implementation sequence.

## 2. P0 — Program foundation

The corpus steward materializes the normative documents, assigns stable IDs, and audits the provisional requirement register.

Findings might include:

- CONEMP is incomplete or absent;
- RPH specification exists in a less formal version than PWU and JEM;
- terms such as canonical and doctrinal need normalization;
- 157 provisional implementation requirements are retained and expanded to 164 after clause audit.

P0 accepts the source baseline and authorizes repository intake.

## 3. P1 — Repository intake

The repository becomes available at commit `abc123`.

The investigator:

- records branch, worktree, submodules, toolchain, and lockfiles;
- runs baseline build and tests;
- inventories Svelte routes, Svelte Flow components, Django APIs, database models, agent prompts, Temporal workflows, RKE2 manifests, and tests;
- hashes evidence;
- preserves two failing baseline tests and an uncommitted local change instead of repairing them.

P1 produces the evidence manifest and receives acceptance.

## 4. P2 — Current-state reconstruction

The investigator discovers:

- a `ProfessionalWorkUnit` model exists with `status`, `phase`, and JSON metadata;
- `status` mixes lifecycle, approval, and execution state;
- Svelte Flow renders a decomposition graph but child completion automatically rolls up to parent percentage;
- a PWA authoring screen stores JSON definitions but does not version semantic meaning;
- Temporal workflows coordinate agents durably, but retries and tactic changes are not distinguished;
- AI outputs are stored in chat threads and sometimes copied into documents manually;
- frontend routes use direct CRUD APIs;
- tenant IDs exist but several background queries are not tenant-scoped;
- OpenTelemetry traces agent calls but not professional command decisions.

These are current-state findings, not yet normative judgments.

## 5. P3 — Conformance assessment

Examples:

| Requirement | Status | Evidence-backed reason |
|---|---|---|
| Stable PWU identity | `CONFORMANT` | UUID identity survives rename and is referenced consistently. |
| Dual lifecycle/cognitive state | `NONCONFORMANT` | One status/phase combination carries mixed semantics. |
| Parent recomposition | `NONCONFORMANT` | Parent percentage and completion derive from children without synthesis. |
| Durable RPH waiting | `PARTIALLY_CONFORMANT` | Temporal persists waits; professional RPH state is implicit. |
| AI attribution | `PARTIALLY_CONFORMANT` | chat records model ID, copied documents lose attribution. |
| Tenant scope | `NONCONFORMANT` | background worker query lacks tenant filter. |
| JSDL compiler | `NOT_IMPLEMENTED` | no canonical semantic compiler found. |

## 6. P4 — Reconciliation

The team classifies:

- existing UUID identity as `VALID_EXISTING_BEHAVIOR` → `PRESERVE`;
- mixed status model as `IMPLEMENTATION_DEFECT` → `MIGRATE`;
- Svelte Flow graph as `VALID_EXISTING_BEHAVIOR` → `ADAPT` rather than replace;
- automatic parent roll-up as `IMPLEMENTATION_DEFECT` → `REPLACE` with recomposition state;
- durable Temporal workflows as `VALID_EXISTING_BEHAVIOR` → `WRAP/ADAPT` into JEM Process and RPH semantics;
- a normative statement requiring a new local process runtime as `SPECIFICATION_DEFECT` if it unnecessarily forbids existing Temporal use;
- unscoped background query as `IMPLEMENTATION_DEFECT`, severity `S1`;
- hand-authored PWA JSON schema as `TEMPORARY_DEVIATION` until JSDL generation is accepted.

## 7. P5 — Transition architecture

The selected transition includes:

1. fix tenant-scoping defect immediately under a security-authorized increment;
2. preserve PWU UUIDs and add explicit `lifecycle_state` and `cognitive_state` columns;
3. create migration mapping old values, marking ambiguous histories as `UNKNOWN_LEGACY_STATE` for review rather than inventing precision;
4. add semantic command adapters around current APIs before retiring direct CRUD;
5. retain Svelte Flow but change graph data to the canonical decomposition projection;
6. retain Temporal as the first JEM durable-process implementation and add explicit RPH state, tactic history, and escalation;
7. convert material agent outputs from chat into Claims, Evidence, Decisions, or Representations while preserving chat as provenance;
8. use hand-authored semantic contracts as an expiring bootstrap concession until the JSDL TypeScript generator passes equivalence tests.

## 8. P6 — Roadmap instantiation

The repository-specific increments become:

```text
RI-001  Repair tenant scoping in background execution
RI-002  Establish controlled semantic identity/version/provenance contracts
RI-003  Add PWU dual-state schema and migration
RI-004  Introduce semantic PWU commands and events
RI-005  Rebuild PWU overview projection and workspace
RI-006  Adapt decomposition graph and add recomposition
RI-007  Formalize Temporal-backed RPH state and tactic change
RI-008  Promote agent outputs into evidence-bearing entities
RI-009  Establish JSDL-generated contracts and retire bootstrap types
RI-010  Build JanumiCode realization trace and verification chain
RI-011  Execute integrated operational conformance
```

Each increment names exact paths, migrations, tests, dependencies, prohibited shortcuts, and evidence.

This sequence could not have been responsibly known before repository investigation.

## 9. P7 — Capability realization

The first authorized increment is `RI-001`, not the aesthetically preferred UI work, because tenant-scope failure is `S1` and affects all later evidence.

After acceptance, `RI-002–RI-005` establish the PWU vertical slice while preserving current IDs and routes through compatibility redirects.

## 10. P8 — Integration assurance

The team proves:

- stale commands reject safely;
- parent completion remains blocked until recomposition;
- agent and RPH work survive restart;
- cross-tenant background execution fails safely;
- projections rebuild;
- backup restores authoritative state;
- the JanumiCode chain traces one change from Intent to production Observation.

## 11. P9 — Release baseline

The release authority accepts:

- implementation commit and semantic model fingerprint;
- runtime and deployment profile;
- evidence package;
- two bounded deviations with expiration increments;
- deferred mobile specialization;
- explicit single-node availability limitation.

## 12. Lesson

The canonical roadmap did not need repository access to define the professional process, target capabilities, evidence, and controls.

The repository-specific roadmap did require repository access and was generated by executing that process.

That is the intended inversion.
