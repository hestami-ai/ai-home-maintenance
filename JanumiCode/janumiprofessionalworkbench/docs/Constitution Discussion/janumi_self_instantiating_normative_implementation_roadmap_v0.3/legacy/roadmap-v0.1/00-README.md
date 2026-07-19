# Janumi Normative Implementation Roadmap Package

**Package version:** 0.1  
**Status:** Proposed normative draft  
**Generated:** 2026-07-19

## Contents

1. `01-JAN-SRC-001-Normative-Source-Baseline.md` — source catalog, authority tiers, ownership placeholders, and conflict rules.
2. `02-JAN-REQ-001-Normative-Requirement-Register.md` — 157 implementation-oriented normative obligations.
3. `03-JAN-RMAP-001-Normative-Implementation-Roadmap.md` — dependency-ordered capability gates G0–G9.
4. `04-JAN-CONF-001-Conformance-and-Evidence-Matrix.md` — working trace from requirement to implementation and evidence.
5. `05-JAN-INC-001-Capability-Increment-Execution-Template.md` — standard contract for an authorized increment.
6. `06-JAN-DEV-001-Deviation-and-Reconciliation-Template.md` — governed code/document discrepancy and temporary-deviation record.
7. `07-JAN-GATE-001-Gate-Evidence-Package-Checklist.md` — gate acceptance evidence checklist.
8. `machine/` — machine-readable source, requirement, roadmap, conformance, and coverage records.
9. `MANIFEST.json` — SHA-256 integrity manifest.

## Consumption order

1. Approve and materialize the source baseline.
2. Execute G0 against the current repository.
3. Filter the requirement register by `firstMandatoryGate`.
4. Create an increment specification from `JAN-INC-001`.
5. Give the coding agent the applicable sources, gate contract, requirements, current baseline, and approved deviations.
6. Require the coding agent to update the conformance matrix and produce the gate evidence package.
7. Accept a gate only through an explicit acceptance decision.

## Important limitation

The current implementation was not inspected while generating this package. All requirement statuses are therefore `UNASSESSED`. The first operational act is G0, not code generation.
