# ROADMAP — JAN-CSAADEC: decoupling CSAA from the gate

> ⛔⛔ **WITHDRAWN 2026-09-10 — `CD-03`, `CD-04` and `CD-05` ARE REVERTED. See `REG-F-381`.**
>
> The census-split mechanism collided with `vitest.projects.ts`'s undocumented STATIC-ANALYSIS CONTRACT at four
> depths, made a ledgered mutation victim uncollectable (`CSAA-M7`), broke a hand-pinned discovery digest, and
> would have needed a fourth literal copy of the file list to silence an independent census. All three
> increments reported "the gate is fully green" against `check-types` + `lint` + `vitest run` — **three of
> `gate:fast`'s thirteen steps.** The real gate failed at step 1.
>
> ⭑ **WHAT SURVIVES AND IS TRUE:** the churn is **4 `it` blocks**, not 46 files, not 9, not 3 files. Those four
> uniquely cover **94 lines** whose subject IS the live repository, against a line ratchet with ~6 lines of
> headroom — so decoupling them costs a ratified coverage floor, and **that is a sponsor decision, filed in
> `REG-F-381`, not an implementer's.**
>
> ⭑ `CD-03b` (the watchdog asymmetry) is KEPT — it is independent and explains a week of unreadable measurements.
> Sections below are left standing as authored; read them as the record of a mechanism that was tried and
> withdrawn, not as current design.

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

**Status:** ✅ COMPLETE — 2026-09-09. Recorded in `§3` of the design and in `REG-F-376`.

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

**Status:** ✅ LANDED — 2026-09-09, as five limbs added to `verif/test-modes.test.ts`

⭑⭑ **A HAND-MAINTAINED LIST GETS AN INSTRUMENT, OR IT ROTS — THAT IS THIS REPOSITORY'S OWN STANDING FINDING.**
`CD-03` introduced the first enumerated list in `vitest.projects.ts`. These limbs are what stop it becoming the
defect that file was written to prevent.

⚠ **NOT A NEW `verif/` FILE, AND THE REASON IS THE PROGRAMME ITSELF.** Adding a file to `verif/` moves the very
population the census pins — a gate ABOUT the census that churns the census would be its own first defect.
`test-modes.test.ts` already owns this class: it is where *"both modes run the same project set"* and
*"`passWithNoTests: false` everywhere"* live.

| limb | mutant | result |
| --- | --- | --- |
| a plausible, non-empty census | `N6` list emptied | ✅ RED |
| names only files that EXIST | `N1` an entry mistyped | ✅ RED |
| the csaa lane excludes EXACTLY what the census includes | `N2` `exclude` clause removed | ✅ RED |
| the census lane is absent from both gate configs | `N3` census added back into `projectsFor()` | ✅ RED |
| both gate configs carry the SAME watchdogs | `N4` source config loses one | ✅ RED |
| …and the non-vacuity half of that limb | `N5` **both** configs lose all three | ✅ RED |

⭑ **`N5` IS THE ONE THAT MATTERS.** Two configs that both declare NOTHING compare EQUAL — the equality assertion
alone is a control that cannot fail, and would have read as agreement forever. The limb asserts the values as
well as their equality, so stripping both reddens it.

⭑ **AND `N1`'S LIMB EXISTS BECAUSE `passWithNoTests: false` DOES NOT COVER IT.** That flag fires only when ALL
census files vanish. Delete or mistype ONE of three and the lane finds the other two, exits 0, and the third is
silently unmeasured — `N-16`'s shape scoped to a list of three.

⛔ **WHAT WAS SPECIFIED AND IS UNBUILDABLE, RECORDED RATHER THAN QUIETLY DROPPED.** This increment was written up
as *"a `verif/` test asserting that no file in the `csaa` lane reads the live workbench tree."* Measured, **six
csaa-lane files transitively reach a live-tree module and pass perfectly well** — importing
`collect-inventory.ts` is not executing its assertions. That check would have failed on its first run.

⛔ **AND THE OBVIOUS REPAIR IS SELF-DEFEATING.** Pinning the reachable SET instead would fire on any CSAA change,
inside the `verif` gate that runs on everything — which is precisely the coupling `CD-03` removed, reintroduced
one file over. ⭑ So exhaustiveness is NOT gated, the test says so in terms, and `CD-05` answers it behaviourally
and on demand. **This block gates the LIST; it does not pretend to gate the JUDGEMENT that produced it.**

⚠ **A MUTANT OF MINE WAS WRONG BEFORE IT WAS RIGHT, AND THE WRONG ONE TAUGHT MORE.** `N6` first replaced one
entry with a `...[]` spread — which leaves TWO entries, not zero — and survived. The gate was correct; the
mutant was not. ⭑ But its survival located something true: removing ONE entry from `CSAA_CENSUS` is caught by no
limb here. It is caught by the file returning to the gated lane and reddening it — `CD-03`'s `M1`. The coverage
exists; it just does not live where I first looked for it.

## CD-05 — the behavioural exhaustiveness check, on demand

**Status:** ✅ LANDED — 2026-09-09 · `scripts/csaa-census-exhaustiveness.ts` · `bun run csaa:census:exhaustive`

Baseline the gated lane, add six files of the shape an ordinary product commit adds, re-run, restore, diff. Any
csaa-lane file that reddened is repo-coupled and belongs in `CSAA_CENSUS`.

**FIRST REAL RUN:** ✅ control fired (`expected 30 to be 29`); **no gated-lane test changed verdict.**
`CSAA_CENSUS` is complete for the perturbed dimensions — confirmed by a different route than the ad-hoc
measurement that produced it.

⛔ **DELIBERATELY NOT A GATE.** It mutates the working tree and costs four vitest runs (~20 minutes). Wiring it
into the gate would put tree mutation on every commit — a worse defect than the one it detects.

**THREE DECISION LIMBS, EACH FALSIFIED BEFORE THE FIRST REAL RUN.**

| limb | predicted | got |
| --- | --- | --- |
| `L1` a file green at baseline reddens under perturbation → named, exit 1 | 1 | ✅ 1, named the probe |
| `L2` the gated lane is ALREADY red → the comparison is unsound, exit 2 | 2 | ✅ 2 |
| `L3` the perturbation reaches nothing → verdict refused, exit 2 | 2 | ✅ 2 |

⭑⭑ **`L3` IS THE ONE THAT MAKES THE OTHER TWO MEAN ANYTHING.** If the perturbation silently failed to register,
every gated-lane file would be unchanged and the run would report *"nothing new is coupled"* — proving nothing
while reading as proof. So the census lane must be SEEN to move. ⛔ And the control is **"its output changed"**,
not **"it is red"**: the census lane is red whenever the tree has drifted past its pins, which is most of the
time, so asserting redness would itself be a control that cannot fail.

⭑ **`L2` EXISTS BECAUSE THE FIRST DESIGN WOULD HAVE MISSED THE CASE IT WAS BUILT FOR.** A baseline diff only
sees files that were GREEN and turned RED. A file already red at baseline is invisible to it — so the script had
been about to hand out a clean bill of health over precisely the situation worth finding. It now REFUSES to
issue any verdict on a red baseline rather than annotating one.

⚠ **AND THE `--only` FLAG IS A SELF-TEST AFFORDANCE, LABELLED AS ONE.** A full run is too slow to drive a
predicted red against, so `--only <substring>` narrows the gated lane — and in that mode the script refuses to
issue a clean verdict, because filtering a gate to the tests you expect to be affected assumes the answer you
are testing for. That mistake was made once in this repository this week; the flag is built so it cannot be made
silently.

**⛔ AND THE HARNESS THAT TESTED THIS WAS ITSELF THE HAZARD — RECORDED BECAUSE IT ALMOST LANDED.** The first
`L3` driver mutated the REAL script and restored it in a `finally`. A ten-minute timeout killed it mid-run, and
`finally` does not survive a kill: the instrument was left on disk with `PERTURBATIONS` EMPTIED, plus a stray
test file and a `.bak`. ⭑ Had that gone unnoticed, the next run of `CD-05` would have perturbed nothing and
reported a clean bill of health — the exact defect `L3` exists to catch, manufactured while testing for it. The
driver now runs a disposable COPY. **A harness that edits the thing it measures needs cleanup that survives
being killed, not merely being unhappy** — the same lesson as the eleven stray `tsconfig.csaa-trial.json` files.

## CD-06 — the register entries

**Status:** ✅ DISCHARGED — `REG-F-376` (the measurement and the two wrong instruments), `REG-F-377` (`CD-03`
plus the watchdog asymmetry), `REG-F-378` (`CD-04`), `REG-F-379` (`CD-05`).

⭑ Four entries rather than the one planned, because the programme found three things it did not set out to
find: that two of my three measuring instruments were wrong; that one of two sibling configs had been missing a
correction the other documented; and that an equality assertion over two absences reads as agreement.

---

## Carry-forwards not owned here

- ~~The 10 s hook / 15 s test in-file timeouts that make the same tree report six failures or three.~~
  ✅ **FIXED in `CD-03b`** — and the diagnosis was not "in-file timeouts" at all: it was the SOURCE config
  missing the three watchdogs its sibling has had since it was written. Recorded because the earlier reading
  blamed the tests and the real cause was one of two configs.
- `packages/csaa` declares no `test` script; the `turbo` path never reaches it. Confirmed NOT the reason the
  suite escaped notice — `rph-domain` has none either and its tests run. The reason was our named-`--project`
  habit.
