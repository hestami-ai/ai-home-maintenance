# ROADMAP — JAN-CSAAEXT: moving CSAA out of JPWB

**Programme:** `JAN-CSAAEXT` · **Status:** ROADMAP · **Opened:** 2026-09-11 ·
**Design:** `docs/_working/DESIGN-csaa-extraction.md` (602 lines) · **Supersedes the mechanism of:** `JAN-CSAADEC`

---

## 0. The ordering constraint that shapes everything

⛔ **THE REPLACEMENT GATE MUST EXIST AND BE GREEN BEFORE THE `git mv`, NOT AFTER.** After the move, 275 of the
303 paths today's check asserts become permanently unsatisfiable (`§13B`), and the only command that can
regenerate the baseline is the one those guards gate. ⭑ **A replacement authored after the move cannot be
compared against the thing it replaces.**

⭑ **AND THIS IS THIS REPOSITORY'S OWN PRECEDENT, NOT A NEW IDEA.** `JAN-CSAADEC` `CD-01`/`CD-02` landed under
the stated rule **"SALVAGE BEFORE DECOUPLE — AND THAT ORDER IS LOAD-BEARING"**, and they are the two increments
of that programme that survived its withdrawal. This roadmap follows the same order for the same reason.

⛔ **NO STEP BELOW HAS A VERIFIER THAT IS "the gate goes green".** Every step names a test that must go RED if
the step is done wrong, and that red must be OBSERVED before the step is called done. A step whose only evidence
is green evidence is not a step — it is a hope.

---

## PHASE 1 — BUILD THE REPLACEMENT (CSAA untouched, `gate:fast` green throughout)

### S1 · The JPWB-side manifest gate

**PRE:** nothing. CSAA stays exactly where it is.

**WHAT:** `scripts/jpwb-manifest.ts` + `verif/jpwb/manifest.baseline.json` + npm scripts `jpwb:manifest` /
`jpwb:manifest:check`. Modelled on `scripts/slice-ledger.ts`, which says in its own header that it was
*"MODELLED ON `csaa:inventory:check`"*. Uses `workingSet()` from `verif/slice-ledger.ts:63-70`
(`git ls-files -co --exclude-standard`), a sha256 per file, canonical JSON, and a diff naming every drift.

⚠ **THE BASELINE MUST EXCLUDE `packages/csaa/` FROM DAY ONE.** Otherwise S10 rewrites it wholesale and the
diff that should prove the move changed nothing about JPWB is drowned in 492 deletions.

**VERIFIER — must be observed RED:** on a **disposable copy** of the tree (⛔ never this tree — the writer edits
what it measures, and `finally` does not run on a kill), change one byte in a `packages/rph-*/src/*.ts` file and
run `jpwb:manifest:check`. It must fail naming that path. Then delete a file and re-run: it must fail naming the
deletion. **Two directions, or the check is only half-instrumented.**

**DONE WHEN:** both reds observed and quoted in the commit message, and `gate:fast` still green.

---

### S2 · The `D-2` population floors — derived, and from an INDEPENDENT instrument

**PRE:** S1.

**WHAT:** per-population minimum counts computed from `git ls-files`, asserted against the manifest.
⛔ **JPWB does NOT re-author a hand-listed path census** (`§14 D-2`). Populations: `packages/rph-*/src`,
`apps/rph-demo/src`, `verif/`, `scripts/`, root configs. Plus exact pins for the genuinely singular artifacts —
the 9 that survive the move (`package.json`, the 4 arrow-command-census files, the 3 guard-enforcement-ledger
files) and the `vitest.projects.ts` content hash from S3.

⛔ **THE INDEPENDENCE IS THE WHOLE POINT.** Floors from `git ls-files`; manifest from its own capture. If both
come from one walk, the comparison is an identity and the guard cannot fail — which
`collect-inventory.ts:2735-2737` records in its own words as the vacuity trap.

**VERIFIER — must be observed RED:** on a disposable copy, delete enough files from one package to cross its
floor; the check must fail naming the population and the count. ⭑ **AND A CONTROL WITH ITS OWN MUTANT:** make
the floors derive from the manifest instead of from git, and confirm the floor test then passes on a tree where
it should fail. That control proves the two instruments are genuinely independent.

**DONE WHEN:** both reds observed. `gate:fast` green.

---

### S3 · The `vitest.projects.ts` content pin

**PRE:** S1.

**WHAT:** a sha256 of `vitest.projects.ts` in the S1 baseline, replacing CSAA's
`JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST` token-stream digest (`§14 D-4`). No AST, no recognizer.

⭑ **STRONGER THAN WHAT IT REPLACES:** the token digest only reddens on edits the 790-line recognizer
understands; a content hash reddens on every edit. ⚠ Its cost is that formatting changes redden too — correct
behaviour for a file under a documented static-analysis contract, and the reason that contract exists.

**VERIFIER — must be observed RED:** add a comment line to `vitest.projects.ts` on a disposable copy; the check
must fail. **DONE WHEN:** observed, and `gate:fast` green.

---

### S4 · Wire the replacement in ALONGSIDE the incumbent — both gates run

**PRE:** S1, S2, S3.

**WHAT:** `jpwb:manifest:check` joins `gate:fast`. ⛔ **NOTHING IS REMOVED.** `gate:fast` becomes 14 steps and
both the CSAA check and the JPWB check run on every gate.

⭑ **THIS IS THE INCREMENT THAT MAKES THE WHOLE PROGRAMME SAFE.** For as long as both run, a weakness in the
replacement is caught by the incumbent. Removing the incumbent first would mean the first evidence of a weak
replacement is a defect reaching `main`.

**VERIFIER:** `bun run gate:fast` — the **real** 14-step gate, end to end, EXIT 0. ⛔ Not a `--project` filter,
not three steps of thirteen. **DONE WHEN:** EXIT 0 observed and the step count quoted.

---

## PHASE 2 — PROVE EQUIVALENCE BEFORE RELYING ON IT

### S5 · The differential — does the replacement catch what the incumbent catches?

**PRE:** S4.

**WHAT:** a perturbation harness on a **disposable copy** of the tree. For a sample spanning every JPWB
population, apply one perturbation at a time and record which of the two checks reddens:

| perturbation | incumbent | replacement | required |
| --- | --- | --- | --- |
| edit a byte in `packages/rph-*/src` | ? | ? | BOTH red |
| delete a `verif/` test | ? | ? | BOTH red |
| add an untracked source file | ? | ? | BOTH red |
| edit `vitest.projects.ts` | ? | ? | BOTH red |
| drop a package below its floor | ? | ? | replacement red |

⛔ **ANY ROW WHERE THE INCUMBENT REDDENS AND THE REPLACEMENT DOES NOT IS A BLOCKER**, and the answer is to
strengthen the replacement — ⛔ never to weaken the row, and never to argue the row does not matter.

⚠ **THE HARNESS RUNS ON A COPY AND NOTHING IN ITS CLEANUP MAY THROW.** A harness that edits what it measures has
already lost this repository a measurement to a `finally` that a kill skipped.

**DONE WHEN:** the table is filled from observed runs and every required cell holds. The filled table goes in
the commit message and the register.

---

## PHASE 3 — FIX EVERY CONTROL BEFORE THE CHANGE THAT WOULD BLIND IT (`§14 D-6`)

### S6 · The boundary perimeter — and a defect that predates this programme

**PRE:** S5.

**WHAT:** three things, in this order:
1. ⛔ **RED FIRST:** add a fixture where an `apps/` file imports CSAA. Confirm `bun run boundary` **PASSES** —
   demonstrating the live defect (`§10B`): `depcruise packages` never scans `apps/`, so that arm of
   `product-does-not-import-csaa` has never been able to fire.
2. Widen to `depcruise packages apps`. Confirm the fixture now FAILS.
3. Retarget the rule's `to:` from the path `^packages/csaa/` to the npm specifier, and move the
   `csaa-product-boundary.ts` logic into JPWB targeting the specifier — so `§13D.1`'s hard-coded
   `resolve(repositoryRoot,'packages','csaa')` cannot become a check that silently always passes.

⭑ Step 1 is not ceremony. It is the only way to prove the widened perimeter changed anything, and this
repository has shipped controls that could not fail precisely because nobody made them fail first.

**VERIFIER:** the fixture, green→red across step 2. **DONE WHEN:** both states observed; fixture removed or
retained as a permanent negative test.

---

### S7 · Mutants for the new guard

**PRE:** S1-S3 landed.

**WHAT:** entries in `scripts/mutants/ledger.ts` for `scripts/jpwb-manifest.ts` and the S2 floors, each naming
its `expectRed` victim.

⛔ **BECAUSE THE DISCRIMINATION PROOF DOES NOT TRAVEL WITH THE GUARD.** The incumbent's 1,813-line red-proving
corpus is written against the engine and leaves with it. ⭑ *A guard whose mutants no longer redden is not the
same guarantee* — so the replacement earns its own.

**VERIFIER:** `bun run mutants` kills every new mutant, and each kill names the intended victim.
⚠ `KILLED_UNNAMED` is not a kill.

---

## PHASE 4 — DETACH (the incumbent leaves the gate, CSAA has not moved yet)

### S8 · Remove the three `csaa:*` steps and CSAA's half of `boundary`

**PRE:** S4, S5, S6, S7 — ⛔ **all four. This is the step the whole ordering exists to protect.**

**WHAT:** `gate:fast` loses `csaa:generated-context:check`, `csaa:inventory:check`,
`csaa:content-store-performance:check`; `boundary` loses `&& bun run scripts/csaa-product-boundary.ts`.

⚠ **THE SELF-REFERENCE, AND WHY IT IS HARMLESS HERE.** `collect-inventory.ts:2833-2840` asserts `gate:fast`
literally begins with the two CSAA steps, so this edit falsifies it. It is harmless **only because the check
that would complain is removed in the same commit and never runs again in JPWB.** ⛔ Splitting S8 across two
commits reddens the gate in between.

⭑ **AND `D-3` IS DISCHARGED HERE FOR FREE.** `csaa:generated-context:check` leaves with nothing to replace it:
`apps/rph-demo`'s `build`, `check` and `e2e` each run `svelte-kit sync` first and all three are already
`gate:fast` steps.

**VERIFIER:** `bun run gate:fast` EXIT 0 at 11 steps. ⭑ **AND THE REAL VERIFIER IS S5's TABLE** — the evidence
that removing the incumbent lost nothing was gathered before it was removed.

---

### S9 · The four JPWB tests that break on the move — fixed BEFORE the move

**PRE:** S8.

**WHAT:** each of `§10A`, handled on its merits:

| test | disposition |
| --- | --- |
| `verif/mutant-ledger.test.ts` — 19 of 269 entries name `packages/csaa/` files | entries move to CSAA's ledger. ⚠ NOT deleted — CSAA keeps its own mutation record |
| `verif/svelte-name-projection.test.ts` — imports the GENERIC svelte provider | ⭑ needs a ruling in this step: vendor the provider into JPWB, or retire the 15 `it` blocks with the projection they prove. **Vendor** — the projection is a JPWB property |
| `verif/csaa-technical-completion.test.ts` (3 `it`) | moves to CSAA with its subject |
| `verif/dependency-boundary-rules.test.ts:125` pins `product-does-not-import-csaa` | the S6 specifier retarget keeps the name meaningful; `COLLAPSE_FLOOR = 4` unaffected |

**VERIFIER:** `bun run test` green, and for the ledger, `bun run mutants` with no `FILE MISSING` / `VICTIM
MISSING`. **DONE WHEN:** green with CSAA still in place — so any breakage here is attributable to S9, not S10.

---

## PHASE 5 — MOVE

### S10 · `git mv`

**PRE:** S8, S9. `gate:fast` green at 11 steps with CSAA present but ungated.

**WHAT:** from the repository root:
`git mv JanumiCode/janumiprofessionalworkbench/packages/csaa JanumiCode/csaa`, plus
`git mv` for the 26 `scripts/csaa-*.ts` wrappers, which are CSAA's and go with it.

⭑ History is preserved natively — same repository, no `filter-repo`, no subtree split (`§9B`).

**VERIFIER:** `git log --follow` on three moved files shows pre-move history. `bun run gate:fast` EXIT 0.
⚠ **AND THE S1 MANIFEST DIFF MUST BE EMPTY** — the baseline excluded `packages/csaa/` from S1, so a clean move
changes nothing in it. ⭑ **A non-empty diff here means the move touched JPWB, and that is exactly what this
instrument was built to notice.**

---

### S11 · CSAA's own couplings back into JPWB

**PRE:** S10.

**WHAT:** the 5 `bun ../../scripts/csaa-dependency-cruiser-differential.ts` escapes in CSAA's `package.json`
(`§9B`) — from `JanumiCode/csaa/` these resolve to the repository root, which has a `scripts/` directory that
does not contain the file. Repoint to the moved wrapper. Also: the 4 files importing `@janumipwb/csaa` by
package name across 7 lines, which resolve today only through the workspace link the move deletes.

⚠ **AND THE INSTALL QUESTION IS OPEN AND MUST BE SETTLED HERE:** nothing on the module-resolution path upward
from `JanumiCode/csaa/` supplies CSAA's four runtime dependencies, and the nearest ancestor manifest pins
conflicting versions. ⛔ Settle it by running an install in a scratch copy of the proposed layout **before**
S10 is pushed, not after.

**VERIFIER:** each of the 5 scripts runs. `verif/` integration test covering the escapes stays green.

---

### S12 · Config and artifact cleanup

**PRE:** S11. **WHAT:** `.prettierignore` entries naming `packages/csaa`; `.dependency-cruiser.cjs` residue;
the report dispositions of `§12` — the six CSAA-subject artifacts move with the engine; `JAN-CSAA-005 …
Mapping.md` stays as a DATED record with its *"Generated by"* banner struck and its `subject.revision` stamped,
⛔ because that banner is the only place a stale report would actively lie.

**VERIFIER:** `bun run gate:fast` EXIT 0. `verif/source-is-reviewable.test.ts` green on every edited file.

---

## PHASE 6 — RESOLVE THE COVERAGE SIDE EFFECT (the sponsor's standing instruction)

> *"All of the side effects of this change will have to be resolved — e.g., by adding relevant additional code
> coverage test cases, etc."*

### S13 · Restore branch-coverage headroom BY ADDING TESTS

**PRE:** S10. **WHAT:** with CSAA out of the denominator, JPWB's real figures are lines **97.58%**, statements
95.67, functions 97.91, branches **84.92%** against a floor of 83 — ⚠ headroom **1.9pp**, down from an apparent
8.4 that was CSAA's contribution, not JPWB's (`§6A`).

⛔ **NO FLOOR MOVES.** The target is 705 uncovered branches, and the work is not diffuse:

| package | branch % | uncovered |
| --- | --- | --- |
| `rph-application` | 82.7% | **357** |
| `rph-projections` | 85.9% | 94 |
| `rph-engine` | 80.7% | 64 |
| `rph-authoring` | 81.3% | 64 |
| `rph-assurance` | 83.9% | 36 |

**VERIFIER:** `bun run test:coverage` with every threshold unchanged and `autoUpdate: false`.
⛔ **A branch covered by a test that asserts nothing is not covered.** Each new test names the behaviour it
pins, and `bun run mutants` must kill a mutant in the newly-covered branch — ⭑ otherwise coverage rose and
assurance did not.

---

## Deferred, and deliberately NOT taken here

- ⛔ **JPWB's CI does not run** (`§9C`) — the root workflow is path-filtered to `JanumiCode/janumicode/**` and
  JPWB's own `ci.yml` is nested where Actions never reads it. Adjacent to this programme, owed its own register
  entry and its own scope ruling. ⚠ **Every "verifier" above is therefore a developer-machine obligation**, and
  that is a real limit on this roadmap, stated rather than hidden.
- ⛔ **CSAA has no self-directed non-vacuity check** (`§14 D-5`). The 275 assertions that follow their subject
  have nowhere to land yet. CSAA's work; filed so the guarantee is not silently lost.
- ⛔ **`packages/csaa/` sits outside `verif/source-is-reviewable.test.ts`'s population**, as does `docs/canon`
  (4 pre-existing `0x08` bytes at register lines 27665 and 27905). Filed, not fixed.
