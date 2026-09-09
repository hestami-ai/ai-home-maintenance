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

**Status:** ⬜ NEXT · **Gated by:** `CD-01` + `CD-02` green in the default gate

**The edit.** `vitest.projects.ts` gains a `CSAA_CENSUS` constant naming exactly the three files, and emits two
projects where it emitted one:

- `csaa` — `include: ['src/**/*.test.ts']`, `exclude: CSAA_CENSUS`. Stays in the default gate. 185 files.
- `csaa-census` — `include: CSAA_CENSUS`. **Excluded from the default gate**, runnable by name. 3 files.

⛔ **THE EXCLUSION LIST IS ADMISSIBLE ONLY BECAUSE OF THE ASYMMETRY IN `§5` OF THE DESIGN** — an inclusion list
fails dangerously (a new package silently unmeasured, which is `N-16`), an exclusion list fails safely (a new
file runs when it need not). The comment at the constant must carry that reasoning, or the next reader will
correctly object that this file forbids exactly this.

**The predicted red, named before the change (per standing discipline).** After the split:

1. `node …/vitest.mjs run --project csaa` → **185 files, GREEN, on the current drifted tree.** Today it is red.
2. `node …/vitest.mjs run --project csaa-census` → **3 files, RED** with `expected 72 to be 69`. It must still
   fail; a census lane that goes green by leaving the gate is a control that cannot fail.
3. The default gate no longer contains the string `expected 72 to be 69` anywhere.

**Mutants owed:**

- remove one file from `CSAA_CENSUS` → the default gate goes red again (proves the list is load-bearing);
- `exclude` dropped from the `csaa` project → 188 files run, gate red (proves the exclusion is what moved them);
- `csaa-census` given `passWithNoTests: true` → must be REFUSED by review, not by a test: it is the `N-16` shape.

## CD-04 — a gate over the exclusion list

**Status:** ⬜ PLANNED · **Gated by:** `CD-03`

⭑⭑ **A HAND-MAINTAINED LIST GETS AN INSTRUMENT, OR IT ROTS — THAT IS THIS REPOSITORY'S OWN STANDING FINDING.**
`CD-03` introduces the first enumerated list in `vitest.projects.ts`. `CD-04` is what stops it becoming the
defect the file was written to prevent.

**The check.** A `verif/` test asserting that no file in the `csaa` lane reads the live workbench tree — the
static half, cheap enough for the gate: no `process.cwd()`, no `readdirSync` rooted above the package, no import
reaching the eight live-tree modules named in the design's `§3`.

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

- The 10 s hook / 15 s test in-file timeouts that make the same tree report six failures or three. Filed.
- `packages/csaa` declares no `test` script; the `turbo` path never reaches it. Confirmed NOT the reason the
  suite escaped notice — `rph-domain` has none either and its tests run. The reason was our named-`--project`
  habit.
