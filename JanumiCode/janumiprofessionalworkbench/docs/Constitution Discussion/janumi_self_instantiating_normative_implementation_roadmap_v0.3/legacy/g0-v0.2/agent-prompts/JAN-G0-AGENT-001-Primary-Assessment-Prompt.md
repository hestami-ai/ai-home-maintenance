# JAN-G0-AGENT-001 — Primary Coding-Agent Assessment Instruction

Use this instruction as the controlling prompt for the agent executing Gate G0.

---

## Mission

Execute `G0 — Normative Baseline and Reconciliation Control` for the Janumi repository. Establish an evidence-backed current-state baseline against `JAN-REQ-001`. Do not implement roadmap capabilities during this gate.

## Governing inputs

1. Janumi source specification corpus.
2. `JAN-SRC-001`.
3. `JAN-REQ-001` and `machine/requirements.json`.
4. `JAN-RMAP-001`.
5. `JAN-CONF-001`.
6. `JAN-G0-EXEC-001` and the remaining G0 package.
7. The repository root and all declared subrepositories.

## Normative operating rules

1. Treat code, tests, migrations, deployment, and observed behavior as evidence of current state.
2. Treat approved higher-authority documents as target-state authority.
3. Never assume either code or documentation is correct when they conflict.
4. Classify and preserve every material discrepancy.
5. Do not mark a requirement conformant from filenames, comments, type names, routes, or UI labels alone.
6. Cite reproducible evidence using repository path and line/symbol, test identifier, schema object, command output, or runtime artifact.
7. Mark evidence gaps `UNKNOWN`; do not infer missing behavior.
8. Keep lifecycle, cognitive, validity, technical, and authorization state distinct during analysis.
9. Do not rewrite product code, migrations, dependencies, or deployment behavior to improve the score.
10. Do not add dates, estimates, or sprint assignments to the normative roadmap.

## Write boundary

You may create or modify only:

```text
docs/architecture/normative/
docs/implementation-baseline/
tools/g0/
```

unless an authorized human explicitly expands the boundary.

## Safety rules

- Do not run destructive commands.
- Do not apply database migrations.
- Do not alter dependencies or lockfiles.
- Do not push, merge, deploy, publish, or contact external services.
- Do not execute untrusted repository code merely to inspect it.
- Run existing tests only when they are locally safe and non-mutating; record skipped tests and why.
- Capture the initial and final repository dirty state.

## Required execution sequence

1. Read `JAN-G0-EXEC-001` fully.
2. Record repository identity, commit, branch, subrepositories, and dirty state.
3. Materialize/reference the normative corpus and identify missing or overlapping documents.
4. Run `tools/g0_repository_inventory.py` and preserve raw outputs.
5. Manually validate the inventory and produce `implementation-inventory.csv`.
6. Produce `01-Current-State-Architecture.md` from observed implementation evidence.
7. Assess every one of the 157 requirements in `requirement-assessment.csv`.
8. Create discrepancy records for every material conflict.
9. Create deviation and deferral records where applicable; do not approve them yourself unless explicitly authorized.
10. Produce `00-G0-Baseline-Assessment-Report.md`.
11. Perform a completeness check: no requirement may remain `UNASSESSED`.
12. Hand the package to an independent reviewer.
13. After reviewer findings are resolved, prepare but do not self-approve `03-G0-Gate-Acceptance-Decision.md`.

## Required outputs

Use the exact output structure in `JAN-G0-EXEC-001`.

## Assessment status vocabulary

```text
CONFORMANT
PARTIAL
NONCONFORMANT
UNKNOWN
NOT_APPLICABLE
RECONCILIATION_REQUIRED
```

## Discrepancy vocabulary

```text
IMPLEMENTATION_DEFECT
SPECIFICATION_DEFECT
DOCUMENTATION_STALENESS
VALID_EXISTING_BEHAVIOR
TEMPORARY_DEVIATION
UNRESOLVED_AMBIGUITY
```

## Completion rule

Do not claim G0 completion. State only that the evidence package is ready for independent review. Gate acceptance belongs to the recorded acceptance authority.

## Final response format

Report:

1. baseline commit and dirty state;
2. inventory coverage;
3. requirement counts by status, family, and gate;
4. P0 unknowns and reconciliations;
5. highest-impact discrepancies;
6. evidence-package locations;
7. reviewer readiness;
8. blockers to G0 acceptance;
9. candidate G1 semantic subset, clearly labeled as unapproved.
