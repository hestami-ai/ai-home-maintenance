# Contract Harness

A backwards-derived validation layer over the JanumiCode workflow's phase boundaries. Each producer sub-phase has a **contract suite** declaring what its consumer downstream needs. Suites run against synthetic fixtures (forward tests) and against real governed-stream DBs (backward diagnostics).

See `docs/design/contract-harness-stage1-enumeration.md` for the boundary inventory and `docs/design/contract-harness-stage1b-design-positions.md` for the design positions the contracts will codify.

## Layout

```
src/test/contracts/
  types.ts           — ContractClause, ContractSuite, ContractResult
  runner.ts          — runContractSuite, summarize, groupByBoundary
  registry.ts        — central array of all ContractSuites
  diagnose.ts        — CLI: run all suites against a DB
  fixtures/          — synthetic hand-written artifact fixtures
  <boundary>.contract.ts          — per-boundary contract definitions (Stage 3+)
  <boundary>.forward.test.ts      — per-boundary forward tests (Stage 3+)
```

## Running the diagnostic CLI

```bash
tsx src/test/contracts/diagnose.ts --db <path-to-sqlite.db>
```

Common flags:
- `--boundary 4.2_component_skeleton` — run only one suite
- `--phase 9` — run only suites for one phase
- `--run-id <uuid>` — pin to a specific workflow run (default: latest)
- `--format json` — machine-readable output
- `--fail-on advisory` — exit non-zero on any failure (default: blocking only)

In Stage 2 the registry is empty, so the CLI exits with `(no contract suites are registered yet)`. Each Stage 3+ contract file imports the registry array and pushes (or, more cleanly, the contract module is added to the registry's imports).

## Writing a contract

Each contract suite has the shape:

```ts
import type { ContractSuite } from './types';
import type { ComponentModelContent } from '../../lib/types/records';

export const componentSkeletonContract: ContractSuite<ComponentModelContent> = {
  boundaryId: '4.2_component_skeleton',
  phaseId: '4',
  subPhaseId: 'component_skeleton',
  producerArtifactKind: 'component_model',
  description: 'Phase 4 component skeleton — every component must declare US tracing',
  clauses: [
    {
      id: 'C-4.2.1',
      description: 'Every component has a non-empty traces_to citing at least one US id',
      severity: 'blocking',
      check: (artifact) => {
        const missing = artifact.components
          .filter((c) => !c.traces_to || c.traces_to.length === 0)
          .map((c) => c.id);
        if (missing.length === 0) return true;
        return {
          message: `${missing.length} components missing traces_to`,
          details: { componentIds: missing },
        };
      },
    },
    // ... more clauses ...
  ],
};
```

Then register in `registry.ts`:

```ts
import { componentSkeletonContract } from './phase4-component-skeleton.contract';

export const CONTRACT_SUITES = [
  // ... existing ...
  componentSkeletonContract,
];
```

## Writing a forward test

Forward tests prove the *consumer* code works against the ideal upstream fixture. Each fixture lives in `fixtures/` and is hand-written to satisfy its boundary's contract.

```ts
import { describe, it, expect } from 'vitest';
import { runContractSuite } from './runner';
import { componentSkeletonContract } from './phase4-component-skeleton.contract';
import idealComponentModel from './fixtures/phase4-component-model.ideal.json';

describe('phase 4 component skeleton — ideal fixture', () => {
  it('passes its own contract', () => {
    const results = runContractSuite(
      componentSkeletonContract,
      idealComponentModel,
      { workflowRunId: 'test', relatedArtifacts: new Map() },
    );
    const failures = results.filter((r) => !r.passed);
    expect(failures).toEqual([]);
  });

  it('consumer code (e.g. packetBuilder Pass 2) reads it without error', () => {
    // ... call the consumer code with the fixture as upstream input ...
  });
});
```

## Conventions

1. **Clause ids are stable.** Format: `C-<phaseId>.<subPhaseShort>.<n>` (e.g. `C-4.2.1`). Don't renumber; deprecate by removing.
2. **Severity:** `blocking` if the downstream consumer cannot function without the property; `advisory` if it degrades quality but the consumer still produces output.
3. **Pure checks.** A clause's `check` function never performs I/O and never mutates inputs. It reads from the artifact + ContractContext only.
4. **Cross-artifact assertions** go through `ContractContext.relatedArtifacts`, keyed by `content.kind`. Don't open a new DB connection inside a clause.
5. **Synthetic fixtures are hand-written.** They express *what good looks like*, not what the LLM happens to produce. Don't capture from real runs.
6. **One forward test file per boundary.** Same basename as the contract file: `phase4-component-skeleton.{contract,forward.test}.ts`.

## Exit code semantics (diagnose CLI)

| Code | Meaning |
|---|---|
| 0 | No failures (or all below `--fail-on` threshold) |
| 1 | Failures at/above `--fail-on` threshold |
| 2 | CLI usage error |
| 3 | DB not found / no workflow_runs / no artifacts |
