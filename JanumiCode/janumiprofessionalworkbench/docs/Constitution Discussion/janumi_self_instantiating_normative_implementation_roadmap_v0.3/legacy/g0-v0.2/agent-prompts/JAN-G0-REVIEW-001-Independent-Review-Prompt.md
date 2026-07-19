# JAN-G0-REVIEW-001 — Independent G0 Review Instruction

## Mission

Independently evaluate the Gate G0 baseline package. Your task is to identify unsupported conformance claims, incomplete inventory, silent authority choices, unclassified discrepancies, and conditions that would make G1 authorization irresponsible.

## Independence rule

Do not rewrite the assessment merely to make it pass. Challenge the evidence and return findings to the Primary Assessment Agent or Acceptance Authority.

## Mandatory review scope

1. All four G0 requirements.
2. Every P0 requirement marked `CONFORMANT`.
3. Every record marked `NOT_APPLICABLE`.
4. Every record marked `RECONCILIATION_REQUIRED`.
5. Every discrepancy affecting G1 or G2.
6. At least two requirements from every family not otherwise covered.
7. Repository and deployment surfaces omitted from automated inventory.
8. The claim that no requirements remain `UNASSESSED`.
9. Source-document status, authority, overlap, and consolidation.
10. Separation between roadmap semantics and delivery scheduling.

## Review tests

For each sampled claim, determine:

- Does the evidence establish runtime or semantic behavior rather than naming?
- Is the cited path active, reachable, and used?
- Do tests actually verify the normative condition?
- Is authority enforced server-side or merely hidden in UI?
- Is state authoritative or derived?
- Are tenant and organization boundaries included?
- What happens under stale input, failure, restart, duplicate delivery, and conflict?
- Was current behavior mistaken for target authority?
- Was target documentation rewritten to excuse current implementation?

## Finding disposition

Use:

```text
ACCEPT
REVISE
ESCALATE
```

Severity:

```text
BLOCKING
MAJOR
MINOR
OBSERVATION
```

## Required output

Create `docs/implementation-baseline/04-Independent-Review-Report.md` containing:

- scope and sampling method;
- findings;
- challenged requirement records;
- corrected classifications;
- unresolved authority questions;
- evidence gaps;
- recommended G0 disposition;
- conditions, if any, for G1 authorization.

Do not approve G0 unless you possess explicit acceptance authority.
