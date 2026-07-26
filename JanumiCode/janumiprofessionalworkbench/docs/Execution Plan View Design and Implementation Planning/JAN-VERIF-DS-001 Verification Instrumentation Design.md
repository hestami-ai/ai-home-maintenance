# JAN-VERIF-DS-001 — Verification Instrumentation: Design

*v0.1.0 · 2026-07-26 · Sponsor question: "we need more robust and rigorous unit testing coverage which I suspect
is embarrassingly low." Roadmap: `JAN-VERIF-DR-001`.*

---

## 1. The premise was wrong, and the truth is worse

Measured (the provider had to be installed — **this repo has never had a coverage config at all**):

| package | Stmts | **Branch** | Lines |
|---|---|---|---|
| rph-contracts | 98.8% | 82.7% | 99.2% |
| rph-domain | 95.8% | 89.7% | 97.3% |
| rph-projections | 94.2% | 80.7% | 96.7% |
| rph-engine | 93.9% | **73.2%** | 95.7% |
| rph-application | 93.2% | 78.9% | 95.5% |
| rph-assurance | 89.4% | 79.5% | 91.2% |
| rph-persistence | **48.6%** | 53.4% | 49.6% |

Coverage is not the problem. **NOT ONE of the 36 findings confirmed across two adversarial reviews was a
coverage gap.** The BLOCKER lived in `resolveExecutionStepWait` — a function every relevant test executes, in a
file at 98.4% statements. The defect was a *missing guard*, and **coverage cannot see a line that is not there.**
Vacuous negatives are worse than invisible: the line runs, an assertion fires, and the assertion is satisfied by
a *different* check. Coverage reports that as covered because it is.

So the honest statement of the problem is not "coverage is low". It is: **the instrument that has actually caught
every defect in this lineage — mutation — is run by hand, once, and never again.**

## 2. THE ROOT FACT, established by experiment

Mutating `packages/rph-domain/src/execution.ts` without rebuilding:

```
rph-domain   (own src)        -> RED    (sees src)
rph-application (cross-pkg)  -> GREEN  (reads DIST)
```

**Cross-package tests exercise the BUILT `dist`, never `src`.** Each package's `exports` declares
`"source": "./src/index.ts"` alongside `"import": "./dist/index.js"`, and **nothing consumes the `source`
condition.** Three consequences, and every one of this programme's measurement failures is one of them:

1. **Merged coverage is currently impossible.** `rph-application`'s 552 tests exercise `rph-domain` heavily, and
   that exercise attributes to `dist/index.js`. Per-package figures are therefore **lower bounds**, and
   `rph-persistence` 48.6% / `command-bus.ts` 53.8% are **artifacts** — every `rph-application` test constructs
   `SqliteStorageAdapter`, and every `rph-engine` test drives the bus.
2. **The dist trap is structural, not an accident.** Any cross-package mutant is silently meaningless without a
   rebuild. It produced a false GREEN twice in one session — once on the reference-seed claim, once on a
   `rph-domain` guard — and the second adversarial review flagged it as unaccounted-for in its own method.
3. **Nobody has ever seen the real number.** Not "it is low"; it is *unmeasured*.

## 3. The fork this creates, and the ruling

Resolving workspace deps to `source` during tests fixes all three at once. It is also a **real behaviour change**:
today's `bun run test` validates the **shipped artifact** — the emit, the `.d.ts` boundary, the export map. Source
resolution silently stops testing any of that, and a build-only defect (a bad `tsconfig.build.json` exclude, an
export map typo) would go undetected. That is not a trade to make silently.

**RULING R1 — BOTH MODES, EXPLICITLY, neither implicit.**

- `bun run test` — **unchanged.** Resolves `dist`. It is the artifact gate, and it stays the default precisely
  because it is the only thing that tests what ships.
- `bun run test:src` (new) — resolves `source`. The basis for **coverage** and for **mutation**, where
  attribution and reachability must be to real source lines.

A test that passes under one and fails under the other is itself a finding (a build/emit divergence), so the two
modes cross-check each other. That is a capability the single mode never had.

**RULING R2 — the mutation harness is the primary deliverable, not coverage.** ~80 mutants are declared across
JAN-EXECREM, JAN-EXEBIND and JAN-REVREM — in commit messages, in roadmap tables, and in
`enforcement-register.ts`'s `declaredMutations` field. Every one was applied once, by hand, by the author
defending the guard, and never re-run. Two were later found unapplicable; one reported a false GREEN. **A
declared mutation that is not re-runnable is a claim, not a test.** They become data, and a SURVIVING mutant
fails the build.

**RULING R3 — coverage gets a floor, and the floor is BRANCH, not line.** Line coverage at 95%+ is already
uninformative here. Branch coverage at 73–83% is where guards live; `execution.ts` alone has ~19% of its branches
unexercised. Thresholds are set at the **measured current value**, so the gate ratchets and cannot silently
regress — never at an aspirational number, which only teaches people to disable it.

**RULING R4 — no coverage-driven test writing.** Tests written to colour a line are the vacuous-negative factory
this lineage has already documented four times. Every branch closed under V-2 must be closed by a test that
asserts a *behaviour*, and each must come with a mutant that proves it can fail.

## 4. What this does NOT claim

Mutation coverage over a *declared* mutant list is not mutation coverage over the *possible* mutant space. The
harness proves the declared set still bites; it says nothing about operators nobody thought of. A generated-mutant
tool (Stryker) is the honest next step and is **out of scope here** — recorded so the ledger is not mistaken for
completeness. This is the same limit `JAN-EXECREM-RESIDUALS.md` §9 already discloses for the conformance ledger.

## 5. Exit criteria

Merged coverage measurable and reported as one number · the ~80 declared mutants re-runnable as a suite, with a
surviving mutant failing the build · branch thresholds at measured current values in the central gate · the two
resolution modes both green, and their divergence (if any) recorded as a finding · **`rph-engine` 69 unchanged**.

---

*`READY_TO_BUILD` — premise measured and falsified, root cause established by experiment, one fork ruled with
both modes retained. Roadmap: `JAN-VERIF-DR-001`.*
