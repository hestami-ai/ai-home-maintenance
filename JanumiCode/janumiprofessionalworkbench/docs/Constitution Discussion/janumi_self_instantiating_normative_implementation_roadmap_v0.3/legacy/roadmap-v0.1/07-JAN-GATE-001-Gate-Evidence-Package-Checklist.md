# JAN-GATE-001 — Gate Evidence Package Checklist

Use one copy for each roadmap gate.

## Identification

- Gate:
- Evidence package version:
- Model fingerprint:
- Runtime version:
- UI version:
- Source-document baseline:
- Review authority:

## Requirement trace

- [ ] Every first-activated requirement is present.
- [ ] Every continuing cross-cutting requirement is evaluated.
- [ ] Every conformant requirement identifies implementation and evidence.
- [ ] Every deviation has an approved record and expiration.
- [ ] Every not-applicable disposition has an approved rationale.

## Automated evidence

- [ ] Schema and generated-contract tests
- [ ] Command and lifecycle tests
- [ ] Event and replay tests
- [ ] Projection contract tests
- [ ] Authority and tenant-isolation tests
- [ ] Accessibility tests
- [ ] Failure and concurrency tests
- [ ] Restart and recovery tests, where applicable
- [ ] Security and sandbox tests, where applicable

## Scenario evidence

- [ ] Routine scenario
- [ ] Ambiguous or incomplete-intent scenario
- [ ] Conflicting-evidence scenario
- [ ] Authority-boundary scenario
- [ ] Failure and tactic-change scenario
- [ ] Reopened or reconciliation scenario
- [ ] Operational-feedback scenario, where applicable
- [ ] AI escalation scenario, where applicable

## Operational evidence

- [ ] OpenTelemetry traces
- [ ] Required metrics
- [ ] Structured error examples
- [ ] Staleness and degraded-mode evidence
- [ ] Backup / restore evidence, where applicable
- [ ] Resource saturation evidence, where applicable

## Review findings

- [ ] No unresolved severity-one semantic defect
- [ ] No unresolved mandatory validation failure
- [ ] No unapproved authority bypass
- [ ] No unapproved tenant-isolation gap
- [ ] No hidden temporary incoherence
- [ ] Residual uncertainty is explicit

## Acceptance

- Decision:
- Accepted deviations:
- Residual uncertainty:
- Reopen triggers:
- Effective date:
