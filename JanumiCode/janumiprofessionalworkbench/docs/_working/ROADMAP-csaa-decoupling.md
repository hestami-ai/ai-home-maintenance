# ROADMAP — JAN-CSAADEC: decoupling CSAA from the gate

Design: [`DESIGN-csaa-decoupling.md`](./DESIGN-csaa-decoupling.md) · **Opened:** 2026-09-09

⚠ **`CD-01` AND `CD-02` ARE RECORDED HERE AFTER THE FACT.** They landed in `4e0df056` before this roadmap or its
design existed. They are listed as `LANDED (documented retroactively)` rather than as ordinary completions,
because the record should show that the sequence was broken, not hide it.

⭑ **SALVAGE BEFORE DECOUPLE — AND THAT ORDER IS LOAD-BEARING.** `CD-01` and `CD-02` reproduce, inside `verif/`,
the guarantees CSAA uniquely held. They had to land first so that `CD-03` removes an *obligation* and not a
*guarantee*. `CD-03` therefore GATES on `CD-01`/`CD-02` being green in the default gate.

---

## CD-01 — the boundary-rule pin, salvaged into `verif/`

**Status:** ✅ LANDED (documented retroactively) — `4e0df056`, `verif/dependency-boundary-rules.test.ts`

The CSAA baseline records `ruleIds` only — a flat list of eight names with **zero `severity` fields anywhere** —
so downgrading `domain-purity` from `error` to `warn` was invisible to it *by construction*. Driven both ways:
the severity mutant is RED in the new test and GREEN in the CSAA pin; deleting the rule outright is RED in both.
⭑ The salvage is an **extension** of the pin, not a re-implementation of it.

## CD-02 — the Svelte name-projection bridge

**Status:** ✅ LANDED (documented retroactively) — `4e0df056`, `verif/svelte-name-projection.ts` + its test

Mutant written first: a consumer using `ts.isStringLiteral` finds ZERO keys and reports a clean all-clear,
because a static `name="x"` projects to a `NoSubstitutionTemplateLiteral`. That mutant reddens 5 assertions. The
consumer recovers static names and the static prefix of dynamic ones as AST data rather than regex hits.
⛔ NOT wired into the incumbent gate — `form-key-emitter-census` is untouched.

## CD-00b — measure which CSAA tests are actually repo-coupled

**Status:** ✅ COMPLETE — 2026-09-09. Recorded in `§3` of the design; register entry owed (`CD-06`).

**Answer: 3 of 188.** Two earlier instruments gave 46 and 9; both were refuted, in opposite directions, by a
behavioural perturbation replicated across two rounds and three tree dimensions. See the design for the full
account — including that the perturbation **reproduced the original `f35cb69d` break on demand**.

⚠ **THIS INCREMENT EXISTS BECAUSE THE FIRST TWO ANSWERS WERE WRONG.** It is listed as its own increment rather
than folded into `CD-03` so that the roadmap shows the measurement was done, and redone, before anything moved.

---

## CD-03 — the census lane leaves the default gate

**Status:** ✅ LANDED — 2026-09-09

**The edit.** `vitest.projects.ts` gains a `CSAA_CENSUS` constant naming exactly the three files, and emits two
projects where it emitted one:

- `csaa` — `include: ['src/**/*.test.ts']`, `exclude: CSAA_CENSUS`. Stays in the default gate. 185 files.
- `csaa-census` — `include: CSAA_CENSUS`. **Excluded from the default gate**, runnable by name. 3 files.

⛔ **THE EXCLUSION LIST IS ADMISSIBLE ONLY BECAUSE OF THE ASYMMETRY IN `§5` OF THE DESIGN** — an inclusion list
fails dangerously (a new package silently unmeasured, which is `N-16`), an exclusion list fails safely (a new
file runs when it need not). The comment at the constant must carry that reasoning, or the next reader will
correctly object that this file forbids exactly this.

**THE PREDICTED REDS, NAMED BEFORE THE CHANGE — AND THE RESULTS.**

| # | prediction | result |
| --- | --- | --- |
| 1 | `--project csaa` → 185 files, GREEN on the current drifted tree | ✅ 185 files, 2718 passed — *after* the watchdog repair below |
| 2 | census lane → 3 files, RED with `expected 72 to be 69` | ✅ 3 files red, that assertion present |
| 3 | the default gate contains that string nowhere | ✅ 0 occurrences; gate **537 files / 6255 passed / 0 failed** |

⭑ **THE PARTITION IS EXACT IN BOTH DIMENSIONS, which is the property worth pinning:** 185 + 3 = 188 files, and
the gate lost exactly 94 tests (65 + 20 + 9) — the three files' own totals. Nothing was dropped and nothing was
double-counted, because `projectsFor()` and `censusProjectsFor()` read the SAME constant.

**MUTANTS — four run, three killed as predicted, and the fourth refuted a claim I had already written down.**

| mutant | victim | predicted | got |
| --- | --- | --- | --- |
| `M1` census list loses `subject.test.ts` | `csaa` lane | RED | ✅ RED — 186 files, 1 failed |
| `M2` `exclude` clause removed | `csaa` lane | RED | ✅ RED — 188 files, 3 failed |
| `M3` census list emptied | census lane | RED | ✅ RED |
| `M4` project `passWithNoTests` → `true` | census lane | GREEN | ⚠ **RED — refuted** |

⚠⚠ **`M4` IS THE ONE TO READ.** The comment I wrote at that line said `false` HERE IS LOAD-BEARING. The
mutant says otherwise: emptying the list reddens the lane whether the flag is `false` or `true`, because
vitest's ROOT-level *"no test files found"* catches it first. Only removing BOTH guards produces the vacuous
pass — driven, exit 0 over zero tests. ⭑ The line stays, and the comment now says what is true: the root
behaviour is vitest's DEFAULT rather than something this repository declares, so the day anyone sets
`passWithNoTests: true` on the census config for an unrelated reason, this line is the only guard left. ⛔ The
correction matters more than the flag: **a comment asserting that something is load-bearing is a claim, and a
claim in a comment is exactly as unverified as a claim in prose until a mutant is pointed at it.**

---

### ⭑⭑ CD-03b — the unplanned half: the source config had none of the watchdogs its sibling has

Prediction 1 did not hold on the first run. `--project csaa` came back with two file-level failures and **zero**
failed tests — both files 33/33 GREEN run alone. Chasing that produced a finding larger than the increment:

`vitest.dist.config.ts` sets `hookTimeout: 60_000`, `testTimeout: 60_000` and `maxWorkers: 4`, and its header
says why — *"The Vitest 5-second defaults predate the compiler-backed CSAA fixtures and now expire during
otherwise-valid scheduling contention"*, and *"the default host-sized pool caused Windows Git/process fixtures
to contend on temporary handles and exceed their local watchdogs."* `vitest.config.ts` — the SOURCE mode, the
default `test:src`, and the basis for coverage and mutation — set **none of the three**.

⛔ **`REG-F-024`'S EXACT SHAPE: a gate that covers one of two writers is not a gate.** Both configs derive from
one project list precisely so they cannot diverge; the watchdog correction was nonetheless applied to one of
them and not the other, and the divergence was invisible because it only shows up as flakiness.

**IT WAS PRODUCING UNINTERPRETABLE VERDICTS ALL WEEK**, and every one of these was previously filed as a
separate puzzle: 38 failures at the vitest default versus 4 at 120 s on one unchanged tree; a full CSAA run
reporting SIX failures where the same tree under lighter load reported THREE; `resolve-working-subject.test.ts`
red in the suite and 32/32 green alone; the two overlay-report files flapping between runs on nothing.

⚠ The numbers are COPIED from the sibling, not chosen — matching it exactly is a consistency repair needing no
fresh judgement, and picking different values would recreate the divergence from the other side.

## CD-04 — a gate over the exclusion list

**Status:** ⬜ PLANNED · **Gated by:** `CD-03`

⭑⭑ **A HAND-MAINTAINED LIST GETS AN INSTRUMENT, OR IT ROTS — THAT IS THIS REPOSITORY'S OWN STANDING FINDING.**
`CD-03` introduces the first enumerated list in `vitest.projects.ts`. `CD-04` is what stops it becoming the
defect the file was written to prevent.

**The check.** A `verif/` test asserting that no file in the `csaa` lane reads the live workbench tree — the
static half, cheap enough for the gate: no `process.cwd()`, no `readdirSync` rooted above the package, no import
reaching the eight live-tree modules named in the design's `§3`.

⭑ **AND A SECOND LIMB THAT IS NEARLY FREE, SURFACED BY `CD-03`:** assert that the two configs which derive
from `projectsFor()` carry the SAME watchdog settings. `CD-03b` existed because they did not, and nothing would
have said so. That check is three comparisons and it closes the class, not the instance.

⚠ **AND ITS OWN LIMIT IS DECLARED IN THE TEST.** The static check is an over-approximation; the design records
that both static instruments were wrong. The behavioural check — perturb and diff — is `CD-05`, deliberately not
in the gate.

## CD-05 — the behavioural exhaustiveness check, on demand

**Status:** ⬜ PLANNED

A script that performs the `§3` perturbation (add a playwright config, an app source file, a `verif` asset,
package sources), runs all 188, restores, and asserts that exactly `CSAA_CENSUS` changed verdict.

⛔ **DELIBERATELY NOT A GATE.** It mutates the working tree and costs two full CSAA runs (~12 minutes). It is the
instrument to run when the split is doubted, and the one that produced this programme's central number.

## CD-06 — the register entry

**Status:** ⬜ OWED

`CD-01`/`CD-02` landed with no register entry. One entry covers the salvage, the measurement, and the
three-instrument correction. **It must record that two of my three instruments were wrong**, since that is the
transferable part.

---

## Carry-forwards not owned here

- ~~The 10 s hook / 15 s test in-file timeouts that make the same tree report six failures or three.~~
  ✅ **FIXED in `CD-03b`** — and the diagnosis was not "in-file timeouts" at all: it was the SOURCE config
  missing the three watchdogs its sibling has had since it was written. Recorded because the earlier reading
  blamed the tests and the real cause was one of two configs.
- `packages/csaa` declares no `test` script; the `turbo` path never reaches it. Confirmed NOT the reason the
  suite escaped notice — `rph-domain` has none either and its tests run. The reason was our named-`--project`
  habit.
