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

### V-2a — the older ledger, and TWO RETRACTED RESULTS

The ledger was expanded 31 → 90 by harvesting the JAN-EXECREM WP-2..WP-15 harnesses. **Two verdict tables were
then produced and BOTH are void.** They are recorded here rather than deleted, because how they became worthless
is the most useful thing V-2a produced.

| reported | status |
|---|---|
| "2 SURVIVED — the first real gaps this instrument has found" | **RETRACTED.** From a run an external 10-minute timeout killed mid-mutant. The abandoned mutation stayed in the tree and became the baseline for everything after it. |
| "43 NO_COMPILE, 4 UNANCHORED" | **VOID.** Contaminated by a manual single-mutant check run CONCURRENTLY with the full run — my own doing, one message after warning against exactly that. |

**THE MECHANISM, which is a genuine design defect and now fixed.** A single leaked mutation poisons everything
after it, silently and permanently: the next mutant on that file snapshots the ALREADY-MUTATED content as its
`original`, so its "restore" faithfully writes the mutation back. **One leak becomes the new baseline.** Worse,
every later mutant's typecheck then fails on the leaked edit — *in a file it never touched* — and reports
`NO_COMPILE`, which reads exactly like a well-behaved verdict. That is how a full, plausible, entirely worthless
table gets produced: 43 of the 90 verdicts were the same foreign type error.

**Three guards now, because one was not enough:**

1. **Journalled in-flight mutant.** Written to disk before the edit, cleared after restore; a later run recovers
   from it. A `finally` is not a guarantee when the process can be killed — a file on disk survives.
2. **Cleanliness checked before EVERY mutant**, not just at the ends.
3. **The run STOPS at the first dirty tree** (`ABORTED_DIRTY`). A short table that says why it stopped is worth
   far more than a full one that is quietly meaningless.

**The one clean measurement remains V-1's 31-mutant run: 27 KILLED, 1 TYPE_PREVENTED, 3 RETIRED, 0 SURVIVED.**
Everything about the other 59 is currently unmeasured, and saying "unmeasured" is the whole point of the exercise
— it is the same distinction V-0 drew when it found coverage had never been measured rather than being low.

### V-2b — the authoritative measurement, at last

**90 mutants, clean, corrected scope: 27 KILLED · 35 KILLED_UNNAMED · 21 NO_COMPILE · 3 RETIRED · 2 UNANCHORED ·
1 TYPE_PREVENTED · 1 CONTROL_HELD · 0 SURVIVED · 0 ABORTED_DIRTY.** Sums to 90; tree verified clean.

**0 SURVIVED, and this figure is finally trustworthy.** Every declared guard that *can* be exercised, is
exercised. It took four runs to earn that sentence — two void, one wrongly scoped — which is itself the result:
the number was never the hard part, the instrument was.

**Both earlier "survivors" were defects in the instrument, not the product:**

- `WP12B-M7` survived its own package and is killed by `rph-application`. The runner scoped unnamed victims to
  `pkgOf(file)`, but **domain predicates in this codebase are enforced at the COMMAND layer** — so scoping a
  domain mutant to domain tests is a pure-predicate assertion standing in for a command-layer rule. **F-28's
  shape, inside the instrument built to detect F-28.** Unnamed victims now run the whole workspace.
- The other mutated `activePlanRationale` **prose**. Now declared `expectSurvive` — a CONTROL, where survival is
  the pass and a kill would mean a test asserts on prose.

**What still needs attention (23), and none of it is a product defect:**

| | n | |
|---|---|---|
| `NO_COMPILE` | 21 | harvested formulations that no longer typecheck; each proves nothing until reformulated |
| `UNANCHORED` | 2 | genuine ledger rot: `WP11-M2` (anchor now ambiguous, 3×) and `WP14-M7` (anchor gone) |

**`MUTANTS_BLOCKING=1` and the coverage thresholds remain unwired** until those 23 are cleared. A gate that fails
on day one is disabled on day one — the same argument this roadmap makes against aspirational thresholds.

### The pattern this work actually exposed

Six defects were found across V-0..V-2, and **five were in the instruments**: per-package coverage artifacts, the
dist trap, a killed run leaking a mutant, a concurrent run contaminating a table, wrong-package mutant scoping,
and inert mutants reading as defects. **One was in the product**, and RW-4 had already fixed it.

The sponsor's premise — "coverage is embarrassingly low" — was measurably wrong (94.6% / 83.0%). The instinct
behind it was right for a different reason: verification here was untrustworthy rather than thin.

### V-2c — clearing the 23, and a correction to my own denominator

V-2b's clean run left **23 entries needing attention: 21 `NO_COMPILE`, 2 `UNANCHORED`.** None was a product
defect, and none proved anything until repaired: a mutant that does not compile never reached the code, and a
mutant that does not anchor cannot be performed at all.

**A preflight mode was built first** (`bun run mutants:preflight`, `MUTANTS_PREFLIGHT=1`). Both rot verdicts are
decided *before any test runs* — anchor uniqueness, then typecheck — yet finding them had cost a full ~40-minute
run. Preflight does the same triage in about six minutes and prints up to three real `tsc` diagnostics per entry,
because a reformulation written against the first line of a cascade is just a second broken formulation.

It reports `APPLICABLE`, which is deliberately **not a verdict about any guard**, and it prints **no verdict
summary** — a table of `APPLICABLE` rows under the same heading a real run uses would be indistinguishable at a
glance from a measurement, and this harness has already shipped two tables that were quietly worthless.

**Almost all 21 failed for ONE reason, and it is a property of the mutation OPERATOR rather than of any guard:**

> `if (cond)` → `if (false)` **makes the guarded block statically dead, and TypeScript does not narrow inside dead
> code.** So every use of a narrowed variable in the refusal it guards — `stored.objectType`,
> `auth.executionPlanId`, `authorized.reason`, `step.selectedTransitionId` — lost its narrowing and failed to
> typecheck. The mutation objected to itself and never reached the code.

The systemic repair is to stop mutating the **condition** and mutate the **consequence**: keep the check exactly as
written and replace the refusal it returns with an admission (`return null`, `return { ok: true }`). At runtime that
is the same fail-open; to the compiler the branch is still reachable and still narrows. It is also the sharper
operator for refusal-shaped code, because it separates *"the check ran and decided wrongly"* from *"the check was
deleted"*. That single change repaired **14 of the 21**.

**And the distinction that mattered most.** A mutation that fails to compile *because it made code unreachable*
looks identical to one that fails *because the guard IS the narrowing* — `if (!stored) return …`, remove it and
nothing below can prove `stored` exists. The second is a genuine type-level guarantee and belongs in
`expectNoCompile`; the first is an artifact of the operator. **Reclassifying an artifact as `TYPE_PREVENTED` would
have been the worst instance of this programme's recurring defect yet, because `TYPE_PREVENTED` reads as *stronger*
than `KILLED`** — an unrunnable mutant would have been promoted to the strongest evidence in the ledger. Every one
of the 21 was therefore re-formulated and re-measured rather than reclassified, and **every one turned out to be
expressible.**

**The 2 `UNANCHORED`, and the anchoring rule they establish.**

- `WP14-M7`'s anchor carried **five leading tabs; the code now sits at six**. Nothing about the guard changed — only
  its indentation. Re-anchored on content alone (`{ selectedEdgeId: step.selectedTransitionId }`).
- `WP11-M2`'s bare `if (!check.ok)` had come to match **three** guards, because two more were added after the
  harvest. It would have landed on whichever came first — a site nobody chose. Its twin from the second harvest
  carries the following comment line and is unambiguous, so this one is now `duplicateOf` that twin.

Together: **anchor on CONTENT, and include leading whitespace only when content alone is ambiguous.** Indentation
both disambiguates (WP11-M2) and rots (WP14-M7), so it is a tiebreak, never a default.

**A correction to a figure I reported.** The ledger had **three byte-identical duplicate entries** — WP11-M4, M5
and M6, declared by two harvest scripts and merged without deduplication. So *"90 mutants, 0 SURVIVED"* was
**87 distinct mutations**, and three of its 35 `KILLED_UNNAMED` verdicts were the same three kills counted twice.
The guarantee was unaffected — each was killed on its own — but a mutation score is a ratio and its denominator was
overstated. Six more entries (the whole `wp12c_m2.py` harvest) turned out to duplicate the intent of their
`wp12c_mutants.py` twins once both were made to compile.

Three instruments now prevent a recurrence, because "I will remember to deduplicate" is not one:

1. **`duplicateOf`** — a new field with its own `DUPLICATE` verdict, decided before anything is applied.
   Distinct from `supersededBy`, which means the code *moved*; this means two work packages *independently declared
   the same edit*. Recorded rather than deleted, because which guards were felt to be load-bearing is itself a fact.
2. **`verif/mutant-ledger.test.ts`** — the ledger's own integrity: unique ids; every distinct mutation declared once
   *or* positively excused (as `duplicateOf`, as retired, or by asserting different victims — which is what makes
   `B4`/`B5` legitimate, one mutation asked of the unit suite *and* of the reference seed); and **every
   `supersededBy`/`duplicateOf` resolving to an entry that exists.** That last check is the load-bearing one:
   retiring an entry into a *void* leaves the guard unproven with no verdict saying so, which is strictly worse
   than leaving the entry broken, because a broken entry at least reports.
3. **The runner prints the honest denominator** — entries *and* distinct mutations measured. Printing the entry
   count alone is exactly how the overstatement happened.

**One accident was promoted rather than discarded.** `WP12B-M3`'s harvested form set `planLiveness:
'CLEANUP_EXEMPT_X'` — not a member of the union, so it was a **typo, not a mutation**, and said nothing about
whether hardening Cancel is caught (`WP12B-M3b` does that, and is retained). But it stumbled onto a real
guarantee nobody had recorded: an authority column cannot hold an unrecognised value. That matters concretely —
`stepAuthorityRefusal` tests each column by equality, so a fourth value would match **no limb and gate nothing**, a
fail-open produced by a typo. It is now `V2C-T1`, declared `expectNoCompile` on purpose.

**An incidental find, and it is the most quietly serious thing in this work package.** While staging V-2c, git
reported the new ledger test as `Bin 0 -> 4957 bytes` — I had written a raw NUL byte where I meant a key separator.
**A single NUL makes git classify the entire file as binary**, so `git diff` prints `Binary files … differ` and
nothing else: no hunks, no line numbers, no review. The file still compiles, still passes, still appears in the
commit. Nothing announces that it has left the review process.

Sweeping every tracked source file found **a second, pre-existing instance**:
`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts` used a literal NUL as its prompt-measuring
sentinel. It has been there since the file was authored — which means **no diff of the Reasoning-Review validator has
ever been renderable, including for the two adversarial reviews that read that package.** Nothing was wrong with the
code; the point is that nobody could have seen if there had been. Both are now the escape `'\u0000'` — byte-identical
at runtime, text on disk — and `verif/source-is-reviewable.test.ts` fails the gate on the next one. That test is
itself guarded against being vacuous: it asserts it found >200 files to check, because an empty file list satisfies
"no file contains a NUL" perfectly, and it was verified by planting a NUL and watching it name the file.

I found the second instance only because I had just made the first. That is not a method, which is why it is now a test.

**Also relaxed:** the cleanliness guard now uses `--untracked-files=no`. A leaked mutation is *necessarily* a
modification to a tracked file — the runner reads `m.file` before it writes, so it cannot create one — so counting
untracked files as dirt blocked nothing dangerous and blocked something ordinary: adding a test in the same change
as the mutant that proves it. A harness that demands a pristine tree is a harness that gets run less often.

## 4. V-2b — branch gaps, then the ratchet

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

**As of V-2c this is `bun run gate`, not a list to work through by hand:**

```
check-types → lint → boundary → build → test (dist) → test:coverage (src + ratchet) → svelte-check → e2e → mutants
```

`gate:fast` is the same minus `mutants`, for the inner loop, and is documented as **not** the gate. `test:src` is
subsumed by `test:coverage`, which runs the identical suites under source resolution and adds the ratchet — running
both was measuring the same thing twice.

## 6. Delivery record

*(Written by each WP as it lands. Empty means nothing has landed — and this sentence exists because
`JAN-REVREM-DR-001 §6` carried a note saying exactly that while four work packages had already shipped under it.
The note is not the guarantee; the table is.)*

| WP | Commit | Outcome |
|---|---|---|
| V-0 | *(this commit)* | **DELIVERED.** Merged coverage measurable for the first time: **94.57% stmts / 82.99% branch / 96.69% lines** over 4,501 statements, 1,571 tests, 139 files. Both resolution modes green — **no build/emit divergence found.** |
| V-1 | *(this commit)* | **DELIVERED.** 31 declared mutants harvested into a re-runnable ledger. First-ever re-run: **27 KILLED · 1 TYPE_PREVENTED · 3 RETIRED · 0 SURVIVED · 0 UNANCHORED · 0 NO_COMPILE.** |
| V-2a | `b2ff18ca` + *(this commit)* | Ledger expanded 31 → 90; three anti-contamination guards added. **Both of its verdict tables were VOID — retracted below.** The only clean measurement is still V-1's 31. |
| V-2b | `c2ee9cf5` | **DELIVERED.** Both "survivors" were instrument defects, not code. Clean corrected-scope run: **0 SURVIVED.** |
| V-2b′ | `91794cb8` | The authoritative 90-entry run: **0 SURVIVED**, 23 needing attention. Its denominator is corrected by V-2c below — 90 entries were 87 distinct mutations. |
| V-2c | *(this commit)* | **DELIVERED.** All 23 cleared and re-measured; **every one killed.** `91 entries → 77 distinct mutations: 28 KILLED · 46 KILLED_UNNAMED · 2 TYPE_PREVENTED · 1 CONTROL_HELD · 10 DUPLICATE · 4 RETIRED · 0 SURVIVED · 0 UNANCHORED · 0 NO_COMPILE · 0 ABORTED_DIRTY.` **Both ratchets wired AND proven live.** |

**V-2c's measurement, and the fact it establishes.** The 21 `NO_COMPILE` entries were unmeasurable, so what they
guarded was *unknown* — not weak, unknown. All 21 now run and **all 21 are killed.** Nothing was hiding behind the
compiler: the §21.1 skip-authorization chain (all six ordered checks), the prune-provenance walk, the PWU-openness
resolution and the pinned emptiness line are each genuinely defended by a test that fails when the guard is weakened.

**The ratchet, armed and demonstrated.** Both halves were verified by forcing each to fail, because *a threshold that
is silently ignored reads exactly like a threshold that passes*:

| | wired at | proven live by | result |
|---|---|---|---|
| coverage | 94.5 / 82.5 / 95.5 / 96.5 (measured, rounded down half a point) | `--coverage.thresholds.statements=99` | `ERROR: … does not meet global threshold` — exit 1 |
| mutation | **blocking by DEFAULT**; `MUTANTS_ADVISORY=1` to opt out | `MUTANTS_TARGET=packages/rph-contracts` on a known-killed mutant | `SURVIVED … 1 mutant(s) need attention. BLOCKING.` — exit 1 |

The polarity flip matters more than the numbers. It used to take `MUTANTS_BLOCKING=1` to fail a build, so the gate
was armed only by remembering to arm it — **an opt-in gate is a suggestion with an exit code.** Any `SURVIVED`,
`UNANCHORED`, `NO_COMPILE` or `ABORTED_DIRTY` now fails by default, and the escape hatch is a triage tool that names
itself in the output.

**And the gate is now a script rather than a remembered sequence** — `bun run gate` (`gate:fast` omits the ~40-minute
mutation run for the inner loop, and is labelled as *not* the gate). A gate that lives only in a document is a gate
whose steps get dropped one at a time, which is how `JAN-REVREM-DR-001 §6` came to carry a "nothing has landed" note
while four work packages had shipped under it.

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

## 7. What the armed instrument found in its first day of real use

The ratchets went live mid-session and were immediately exercised by JAN-REVREM RW-6/RW-7. **Both fired, and both
were right** — which is the only evidence that matters about a gate:

| fired | on | verdict |
|---|---|---|
| coverage | 94.47% vs the 94.5% floor | **Correct.** Three uncovered paths in code written minutes earlier, including `facts.authorizationStatus === undefined` in RW-6's extracted verdict — a cell **neither caller can reach**, because both always pass a string. The floor was not lowered; the paths were covered, and merged coverage ended *higher* than before (94.60 / 83.13). |
| mutation | 6 `UNANCHORED` | **Correct, and the rot was mine.** RW-6's own roadmap step 3 says these anchors must move "in the same commit … doing it in a later commit is how the ledger rots." I wrote that and skipped it. |
| mutation | `B6` `SURVIVED` | **The most valuable single verdict this instrument has produced.** RW-6 replaced a narrowing early-return with `(binding?.state ?? {})`, so nothing below required `binding` to be *proven* — and the fail-OPEN on an unresolvable authority became **expressible** for the first time since JAN-EXEBIND. No test failed. Nothing else on any axis was red. A guarantee had silently gone from *cannot be written* to *is currently tested*. |

`B6` is the entry V-1 created after noticing that a mutant which refuses to compile is **evidence** rather than a
broken mutant. `expectNoCompile` has now paid for itself twice: once by recording a type-level guarantee nobody had
written down, and once by catching its removal in a commit that was green everywhere else.

**Authoritative measurement after all of it:** `96 entries → 82 distinct mutations · KILLED 32 · KILLED_UNNAMED 46 ·
TYPE_PREVENTED 2 · CONTROL_HELD 2 · DUPLICATE 10 · RETIRED 4 · SURVIVED 0 · UNANCHORED 0 · NO_COMPILE 0 ·
ABORTED_DIRTY 0.` Tree verified clean.

---

*`DELIVERED` / v1.1.0 — V-0, V-1, V-2a, V-2b, V-2b′, V-2c all landed. Both ratchets armed, proven live by forcing
each to fail, and since validated by firing correctly three times on real work. The one work package still open is
**V-2d (branch gaps)**, deliberately last: not one of the 36 findings confirmed across two adversarial reviews was a
coverage gap — and the three defects the armed instrument found in its first day were a missing test, ledger rot, and
a lost type guarantee, none of them a coverage gap either.*
