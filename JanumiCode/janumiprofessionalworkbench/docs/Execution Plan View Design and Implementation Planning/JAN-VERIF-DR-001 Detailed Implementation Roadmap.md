# JAN-VERIF-DR-001 — Verification Instrumentation: Detailed Implementation Roadmap

*v0.1.0 · 2026-07-26 · Design authority `JAN-VERIF-DS-001` v0.1.0. Sponsor ruling: all three stages, in the order
measurement → mutation → branch gaps.*

## 1. Land order

| WP | Title | Delivers | Depends on |
|---|---|---|---|
| **V-0** | Source-resolved test mode + merged coverage | the first real number this repo has ever had | — |
| **V-1** | The mutation harness — declared mutants become a suite | a surviving mutant fails the build | V-0 |
| **V-2** | Branch gaps in load-bearing modules + a ratcheted floor | branch thresholds in the central gate | V-1 |

**Measurement first, and it is not merely tidy.** `rph-persistence` 48.6% and `command-bus.ts` 53.8% are
artifacts of per-package measurement (DS §2). Attacking them before fixing the instrument would spend real effort
writing tests for code that is already exercised — optimising against a false signal.

## 2. V-0 — the two resolution modes, and the merged number

**A root `vitest.config.ts` with `projects`**, one per package, so a single run produces ONE merged report. Under
`RPH_TEST_RESOLVE=source`, add `resolve.conditions: ['source', 'import', 'default']` so workspace deps resolve to
`src`. The `"source"` condition **already exists in every package's export map and is consumed by nothing** — the
hook is there, unused.

Scripts:
- `test` — unchanged, per-package via turbo, resolves `dist`. **The artifact gate** (DS §3-R1).
- `test:src` — root vitest, source-resolved.
- `test:coverage` — `test:src` + v8 coverage, `--coverage.include='packages/*/src/**/*.ts'`, excluding
  `*.test.ts`, `__tests__/**`, `src/gen/**`, and the generated contract emitters.

**Verification, and it must be a POSITIVE check rather than "it ran".** The instrument is only trustworthy if
source resolution is demonstrably in effect, so:

1. The experiment from DS §2, inverted: mutate `rph-domain/src` **without rebuilding** and assert
   `rph-application`'s tests now go **RED** under `test:src` (they go GREEN today). That is the one-line proof
   that the mode does what it claims. Without it, a config typo yields a comfortable number and no signal.
2. Merged coverage must attribute to `packages/*/src/**`, with **zero** `dist` paths in the report.
3. `rph-persistence` and `command-bus.ts` must rise sharply — they are exercised, just unmeasured. If they do
   *not*, the artifact hypothesis was wrong and that is itself the finding.
4. Both modes green. **Any test that passes in one and fails in the other is a build/emit divergence — a finding,
   recorded, not smoothed over.**

## 3. V-1 — the mutation harness (the primary deliverable)

`scripts/mutants/` — a declared ledger plus a runner.

```
interface DeclaredMutant {
  id: string            // 'REVREM-R1'
  file: string          // repo-relative
  find: string          // anchor, must occur EXACTLY ONCE (else the mutant is UNANCHORED)
  replace: string
  expectRed: string[]   // the test files that MUST fail
  why: string           // the guard it proves, in one line
}
```

Runner, per mutant: assert the anchor is unique → apply → **rebuild the mutated package if the target suite is
cross-package** (unnecessary under `test:src`, retained for the `dist` mode) → run only `expectRed` → restore →
verify `git diff` is empty.

**Four verdicts, and three of them are failures.** `KILLED` (expected suites failed) · `SURVIVED` (they passed —
**the guard is untested**) · `UNANCHORED` (the `find` text is gone or ambiguous — the ledger has rotted against
the code) · `NO_COMPILE` (the mutant does not typecheck, so it never reached the code and proves nothing).

`UNANCHORED` is the verdict this codebase most needs: two of `enforcement-register.ts`'s three `declaredMutations`
had silently become unapplicable, and nothing noticed until an adversarial review read them.

**Seeding the ledger.** Harvest from `git log` across JAN-EXECREM WP-0…17, JAN-EXEBIND, JAN-REVREM RW-0…5, plus
every `declaredMutations` array. Expect a substantial share to come back `UNANCHORED` on the first run — the code
has moved under them, which is the point of building this at all. **Every one is triaged and recorded, never
deleted to make the run green.**

**Gate wiring:** `bun run mutants` is advisory on the first run (to size the rot honestly) and **blocking**
thereafter. A `SURVIVED` verdict fails the build.

**The disclosed limit** (DS §4): a declared ledger is not the possible mutant space. Generated mutation (Stryker)
is the honest successor and is out of scope; recorded so this is not mistaken for completeness.

### V-1's first run, and what it found

**0 SURVIVED is the headline.** Every guard the declared set claims to protect still bites — that is the first time
any of these mutants has been executed since the day it was written, each originally applied once by hand by the
author defending the guard.

**But 6 of 31 (19%) did not run as declared**, and the harness found mechanically what the second adversarial
review had found by reading:

| verdict | n | what it means |
|---|---|---|
| KILLED | 27 | the guard is genuinely tested |
| TYPE_PREVENTED | 1 | **the defect is UNEXPRESSIBLE** — see below |
| RETIRED | 3 | the target was legitimately removed, and the successor mutant is NAMED |
| SURVIVED / UNANCHORED / NO_COMPILE | 0 | — |

**The three RETIRED are the rot the review caught by hand.** `B2` and `B7` named the §15.3 allowlist limb and the
precheck call site that JAN-REVREM RW-0 withdrew and moved; `B3` cannot be *formulated* any more because RW-0 also
removed `plan` from the resolver's signature. Each now carries a `supersededBy` naming the mutant that proves the
same guard at its new site. **RETIRED and UNANCHORED are deliberately different verdicts**: retired means somebody
noticed and said where the guard went; unanchored means a claim once cited as evidence quietly stopped being
performable. Deleting the entries would have erased the fact that the guard ever needed proving.

**Two mutants were ill-formed rather than obsolete, and saying so mattered.** `M7` added a duplicate object key and
`M8` re-imported a symbol that JAN-EXEBIND had since legitimately wired — both reported `NO_COMPILE`, which *looks*
like a passing guard and proves nothing. M7 was reformulated; M8 was **re-pointed** at `capabilityAuthorized`,
which is still genuinely dead. A mutant that does not compile never reaches the code.

**And one produced a better result than a test.** `B6` probes the fail-open on an unresolvable binding. Two
formulations were attempted and **both refused to typecheck**: `binding` is `StoredObject | undefined`, and the
early-return narrowing is what types every use below it, so *any* mutation letting an unresolvable binding through
leaves the value possibly-undefined and TypeScript rejects it. The fail-closed behaviour is enforced by the **type**,
not by a test — a stronger guarantee, since a test can be deleted and a type cannot be worked around without a
deliberate signature change. It is now declared `expectNoCompile`, so **a mutant that suddenly compiles reports
SURVIVED and fails the build.** Nothing had recorded that guarantee until something tried to mutate it.

**The runner refuses to start on a dirty tree and aborts if the tree is dirty afterwards** — one of the review
agents in this repo left a mutant behind mid-run, and a harness that can do that is worse than none.

## 4. V-2 — branch gaps, then the ratchet

Targets, in order of how much authority they carry: `execution.ts` (81.3% branch — the whole step authority
surface), `command-bus.ts` (35.6%, re-measured under V-0 first), `assurance.ts` (81.5%), `pwu.ts` (72.3%),
`rph-engine` (73.2%).

**Rules, from DS §3-R4.** Each closed branch needs a test asserting a **behaviour**, not a line; each needs a
**mutant in the V-1 ledger** proving it can fail; and any branch that is genuinely unreachable is **deleted or
declared**, never covered — an unreachable branch coloured green is the F-01 shape (a guard whose inputs cannot
disagree) with a coverage badge on it.

**Thresholds at MEASURED values, not aspirations** (`coverage.thresholds`, `autoUpdate` off). A ratchet that only
tightens. An aspirational threshold gets disabled the first time it blocks someone, and then measures nothing.

## 5. Gate

`G-VERIF-001`: check-types · **test (dist)** · **test:src** · coverage thresholds met · `mutants` (advisory in
V-0/V-1, blocking after) · lint 0 · boundary 0 · svelte-check 0 · Playwright · **`rph-engine` 69**.

## 6. Delivery record

*(Written by each WP as it lands. Empty means nothing has landed — and this sentence exists because
`JAN-REVREM-DR-001 §6` carried a note saying exactly that while four work packages had already shipped under it.
The note is not the guarantee; the table is.)*

| WP | Commit | Outcome |
|---|---|---|
| V-0 | *(this commit)* | **DELIVERED.** Merged coverage measurable for the first time: **94.57% stmts / 82.99% branch / 96.69% lines** over 4,501 statements, 1,571 tests, 139 files. Both resolution modes green — **no build/emit divergence found.** |
| V-1 | *(this commit)* | **DELIVERED.** 31 declared mutants harvested into a re-runnable ledger. First-ever re-run: **27 KILLED · 1 TYPE_PREVENTED · 3 RETIRED · 0 SURVIVED · 0 UNANCHORED · 0 NO_COMPILE.** |
| V-2 | — | not started |

**V-0's measured result, and the artifact hypothesis CONFIRMED.** The per-package figures were lower bounds, exactly as DS §2 predicted:

| | per-package | merged | |
|---|---|---|---|
| `rph-persistence` stmts | 48.6% | **80.6%** | the adapter is cross-exercised by every rph-application test |
| `command-bus.ts` stmts | 53.8% | **86.3%** | driven through `Engine` by rph-engine's suite |
| `command-bus.ts` branch | 35.6% | **71.1%** | |
| `execution.ts` branch | 81.3% | **96.7%** | the "1 in 5 branches unexercised" figure was an artifact |

So **two of V-2's three headline targets were never real.** Attacking them first — as the sponsor's original framing implied — would have spent real effort writing tests for code already exercised. That is the whole argument for measuring first.

**Three things went wrong on the way, each caught by a check rather than by luck:**

1. `resolve.conditions: ['source', …]` **did not work** — vitest resolves through Vite's SSR pipeline, where that is not the operative option. The proof test caught it on its first run. Replaced with explicit aliases.
2. The object-form alias does **prefix** replacement, so `@janumipwb/rph-contracts/hash` became `…/src/index.ts/hash` and **78 test files failed to import**. Replaced with two anchored regex patterns, subpath first.
3. `import.meta.resolve` was evaluated as the instrument and **rejected**: it uses Node's resolver, is blind to Vite's alias, and returns `dist/index.js` even when the alias IS in effect. An instrument that gives the same answer in both modes cannot distinguish them.

The last one is the reason the proof asserts **module identity**: two copies of a correct function behave identically, so behaviour cannot separate the modes. Identity can.

---

*`READY_TO_BUILD` / v0.1.0 — 3 work packages. Nothing built yet.*
