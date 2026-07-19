# JAN-IRP-013 — Machine-Readable Control Schemas

**Version:** 0.3.0  
**Status:** Proposed Normative Draft  
**Purpose:** Define the machine-readable control records used to instantiate, execute, validate, and audit the implementation program.

## 1. Authority of machine-readable controls

After P0 acceptance, machine-readable control records are the operational source for automation, assessment, and traceability. Markdown documents remain the normative human-readable explanation.

If the two diverge, the discrepancy shall be reconciled; neither shall be silently overwritten.

## 2. Schema standard

Schemas in `schemas/` use JSON Schema Draft 2020-12.

Every control object shall declare:

```text
schemaVersion
recordId
recordType
programInstanceId
version
status
createdAt
createdBy
updatedAt
```

where applicable.

## 3. Identifier conventions

```text
IRP-...       program instance
PHASE-...     phase execution
EV-...        evidence
REQA-...      requirement assessment
DISC-...      discrepancy
RECON-...     reconciliation decision
TRANS-...     transition
RI-...        repository-specific increment
GATE-...      gate decision
DEV-...       deviation
DEF-...       deferral
SCP-...       specification change proposal
```

Identifiers shall be stable and unique within their scope.

## 4. Included schemas

| Schema | Purpose |
|---|---|
| `source-catalog.schema.json` | Normative source catalog and authority metadata. |
| `requirement-register.schema.json` | Stable normative implementation obligations and capability mapping. |
| `program-model.schema.json` | Program phases, prerequisites, and phase states. |
| `capability-catalog.schema.json` | Canonical capabilities and dependencies. |
| `package-manifest.schema.json` | Package file inventory and integrity metadata. |
| `program-execution-context.schema.json` | Program instance, repository, corpus, roles, and environment. |
| `repository-evidence-manifest.schema.json` | Evidence items, hashes, revision, and reproducibility. |
| `current-state-model.schema.json` | Evidence-bearing current-state model elements and unknowns. |
| `requirement-assessment.schema.json` | Applicability, conformance, confidence, and traces. |
| `discrepancy.schema.json` | Classification, severity, impact, and disposition. |
| `transition-architecture.schema.json` | Current-to-target mappings and transition controls. |
| `roadmap-instance.schema.json` | Capability bindings, waves, increments, and requirement coverage. |
| `capability-increment-authorization.schema.json` | Bounded increment contract and evidence plan. |
| `gate-evidence-package.schema.json` | Evidence package and findings. |
| `gate-acceptance-decision.schema.json` | Acceptance, conditions, residual uncertainty, and next authority. |
| `deviation.schema.json` | Temporary nonconformance. |
| `deferral.schema.json` | Authorized future scope. |
| `specification-change-proposal.schema.json` | Upstream semantic change. |

## 5. Controlled enumerations

The schemas use controlled values from this corpus, including:

### Conformance

```text
CONFORMANT
PARTIALLY_CONFORMANT
NONCONFORMANT
NOT_IMPLEMENTED
NOT_APPLICABLE
UNKNOWN
BLOCKED_BY_SPECIFICATION
```

### Discrepancy

```text
IMPLEMENTATION_DEFECT
SPECIFICATION_DEFECT
DOCUMENTATION_STALENESS
VALID_EXISTING_BEHAVIOR
TEMPORARY_DEVIATION
UNRESOLVED_AMBIGUITY
```

### Transition

```text
PRESERVE
DOCUMENT
ADAPT
WRAP
REFACTOR
MIGRATE
REPLACE
RETIRE
CREATE
ESCALATE
```

### Gate decision

```text
ACCEPTED
CONDITIONALLY_ACCEPTED
REJECTED
SUSPENDED
SUPERSEDED
```

## 6. Requirement register

`control/requirement-register.json` and `.csv` contain the incorporated 157 requirements and a preliminary mapping to canonical capabilities. P0 shall audit the mapping.

No assessment shall alter the canonical requirement record directly. Assessment records reference requirement IDs.

## 7. Program and capability models

```text
control/program-model.json
control/capability-catalog.json
```

These are machine-readable projections of `JAN-IRP-002` and `JAN-IRP-008`.

## 8. Templates

The `templates/` directory contains valid initial objects for each schema. They intentionally contain unassessed or placeholder values where repository execution is required.

A template is not an accepted control record until populated, reviewed, and placed under program-instance control.

## 9. Validation tool

Use:

```bash
python tools/validate_control_artifacts.py \
  --schema-dir schemas \
  --instance-dir templates
```

For a repository-specific instance, supply its directory instead of `templates`.

## 10. Validation behavior

The validation tool shall:

- load JSON only from approved roots;
- select the schema identified by `$schema` or configured mapping;
- report file, JSON path, message, and schema path;
- fail nonzero on invalid records;
- avoid network schema resolution;
- not modify records.

## 11. Markdown projections

Human-readable reports may be generated from control records. Generated prose shall preserve:

- IDs;
- statuses;
- evidence references;
- conditions;
- unresolved uncertainty;
- source and repository versions.

## 12. Integrity manifest

The package includes:

```text
package-manifest.json
SHA256SUMS
```

Repository-specific evidence packages shall generate equivalent manifests.

## 13. Compatibility

Changes to control schemas shall be classified:

```text
PATCH_EDITORIAL
ADDITIVE_COMPATIBLE
REFINEMENT_COMPATIBLE
BREAKING
```

Breaking changes require migration of active program instances or version-specific support.

## 14. Data minimization

Control records shall reference secrets, protected evidence, and large artifacts rather than embed them. Access classifications and retention shall be explicit.

## 15. Prohibitions

- Do not store raw secrets in control records.
- Do not use free-form status values where a controlled enum exists.
- Do not delete superseded records required for reconstruction.
- Do not use a valid JSON schema result as proof that professional semantics are correct.
- Do not allow generated Markdown to become a separate unmanaged truth.
