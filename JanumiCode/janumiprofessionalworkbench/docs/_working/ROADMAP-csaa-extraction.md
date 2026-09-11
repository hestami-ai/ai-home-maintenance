# ROADMAP — JAN-CSAAEXT: moving CSAA out of JPWB

**Programme:** `JAN-CSAAEXT` · **Status:** ROADMAP (rev 2) · **Opened:** 2026-09-11 ·
**Design:** `docs/_working/DESIGN-csaa-extraction.md` · **Rulings:** `REG-D-061` · **Finding:** `REG-F-389`

---

## 0. The two rules that govern every step

**RULE 1 — SALVAGE BEFORE DECOUPLE.** Every JPWB-subject assertion is reproduced as JPWB-owned code and proven
to redden **before** the thing holding it today is removed. ⭑ This is not a new idea: it is the rule under which
`JAN-CSAADEC` `CD-01`/`CD-02` landed, and they are the only two increments of that programme that survived its
withdrawal.

**RULE 2 — ⛔ WHAT READS THIS, AND WHAT BREAKS IF IT IS WRONG?** Every artifact this roadmap creates must name a
CONSUMER. A check whose only consumer is itself is satisfied by regenerating it, and that is a ritual, not a
gate. ⚠ **This rule deleted half of rev 1** — see `§6`.

⛔ **AND NO STEP'S VERIFIER IS "the gate goes green".** Each names a test that must be OBSERVED RED before the
step is called done. A step whose only evidence is green evidence is a hope.

---

## PHASE 1 — SALVAGE

### S1 · Reproduce JPWB's own assertions as JPWB tests

**PRE:** nothing. CSAA stays where it is and stays wired into the gate.

**WHAT.** `csaa:inventory:check` makes assertions about JPWB. Measured, almost all of them are about CSAA (`§13`).
**These are the ones whose subject is JPWB, and this is the complete list:**

**A · NINE REQUIRED PATHS** — of the 303 the incumbent asserts, these 9 survive CSAA's departure. They are not a
random remainder: they are JPWB's own two assurance families.

```
package.json
verif/arrow-census-coverage.test.ts        verif/guard-enforcement-ledger.data.ts
verif/arrow-command-census.baseline.json   verif/guard-enforcement-ledger.test.ts
verif/arrow-command-census.test.ts         verif/guard-enforcement-ledger.ts
verif/arrow-command-census.ts
verif/command-dispatch-census.test.ts
```

**B · SEVEN ROOT COMMANDS MUST EXIST** — of the 35-entry required-root-command list, **27 are `csaa:*` and leave**:

```
boundary   check-types   gate   gate:fast   lint   test   test:coverage
```

**C · ZERO EXACT-COMMAND PINS SURVIVE.** ⚠ All **27** `assertJpwbAssuranceCommandExact` calls name a `csaa:*`
command. The whole family leaves. ⛔ **Nothing is salvaged here and nothing should be invented to replace it** —
inventing one would be authoring a gate with no failure anybody has seen.

**D · ONE PIN AUTHORED FRESH, NOT SALVAGED — `gate:fast`'s composition.** `boundary-policy.test.ts:31-33` pins
`gate:fast` as opening with two CSAA steps. ⚠ `CD-02` deliberately declined to reproduce it, recording why in
`verif/dependency-boundary-rules.test.ts:177-180`: *"`CD-05` makes that assertion false by design, and copying it
here would be authoring a gate against the increment it belongs to."* ⭑ `CD-05` was withdrawn and `D-1` changes
the composition anyway — so this pin is authored against the POST-`S4` composition, **in `S4`, not here.**

**SHAPE:** extend `verif/`, following `verif/dependency-boundary-rules.test.ts:181-188`, which already does
exactly this for the `boundary` command. ⛔ **No new artifact class. No manifest. No baseline file.**

**CONSUMER (Rule 2):** JPWB's gate. What breaks if it is wrong: JPWB's own assurance surface is dismantled —
a census file deleted, a gate command removed — and nothing says so.

**VERIFIER — must be observed RED, one mutant per limb:** delete `verif/arrow-command-census.ts` on a
**disposable copy** → the path test names it. Remove `test:coverage` from `package.json` → the command test
names it. ⛔ **Both, or only one limb is instrumented.**

**DONE WHEN:** both reds observed and quoted in the commit; `bun run gate:fast` EXIT 0.

---

## PHASE 2 — FIX EVERY CONTROL BEFORE THE CHANGE THAT WOULD BLIND IT

### S2 · The boundary perimeter — `REG-F-389`, a defect that predates this programme

**PRE:** S1.

**WHAT**, in this order:
1. ⛔ **RED FIRST — and here the red is a PASS.** Add a fixture where an `apps/` file imports CSAA. Confirm
   `bun run boundary` **PASSES**, demonstrating the live defect: `boundary` runs `depcruise packages`, one
   positional scan root, so the `apps/` arm of `product-does-not-import-csaa` has never been able to fire.
2. Widen to `depcruise packages apps`. The fixture must now FAIL.
3. Retarget the rule's `to:` from the path `^packages/csaa/` to the npm specifier, and re-home the
   `csaa-product-boundary.ts` logic in JPWB against that specifier — so `§13D.1`'s hard-coded
   `resolve(repositoryRoot,'packages','csaa')` cannot become a check that silently always passes.

⭑ Step 1 is not ceremony. It is the only thing that proves the widening changed anything — and its absence is
precisely how this defect survived. ⚠ `verif/dependency-boundary-rules.test.ts:125` pins the rule NAME, which is
why the defect stayed invisible: **a name-pinning test is not a test that the named thing works.**

**CONSUMER:** `boundary`, a `gate:fast` step. What breaks if wrong: product code can import the analyzer.

**VERIFIER:** the fixture, PASS → FAIL across step 2, both states observed.

---

### S3 · Mutants for everything S1 and S2 created

**PRE:** S1, S2.

**WHAT:** entries in `scripts/mutants/ledger.ts` for each salvaged limb, each naming its `expectRed` victim.

⛔ **BECAUSE THE DISCRIMINATION PROOF DOES NOT TRAVEL WITH THE GUARD.** The incumbent's ~1,813-line red-proving
corpus is written against the engine entry point and leaves with it. ⭑ *A guard whose mutants no longer redden
is not the same guarantee.*

**VERIFIER:** `bun run mutants` kills every new mutant and each kill NAMES its intended victim.
⚠ `KILLED_UNNAMED` is not a kill.

---

## PHASE 3 — DETACH (CSAA has not moved yet)

### S4 · Remove the three `csaa:*` steps and CSAA's half of `boundary`, and pin what remains

**PRE:** S1, S2, S3 — ⛔ **all three. This is the step the ordering exists to protect.**

**WHAT:** `gate:fast` loses `csaa:generated-context:check`, `csaa:inventory:check`,
`csaa:content-store-performance:check`; `boundary` loses `&& bun run scripts/csaa-product-boundary.ts`. Then
**S1D's composition pin is authored against the result**, so the new shape is guarded from its first minute.

⚠ **THE SELF-REFERENCE, AND WHY IT IS HARMLESS HERE.** `collect-inventory.ts:2833-2840` asserts `gate:fast`
literally begins with the two CSAA steps, so this edit falsifies it — harmless **only because the check that
would complain is removed in the same commit.** ⛔ Splitting S4 across two commits reddens the gate in between.

⭑ **`D-3` DISCHARGES HERE FOR FREE.** `csaa:generated-context:check` needs no replacement: `apps/rph-demo`'s
`build`, `check` and `e2e` each run `svelte-kit sync` first, and all three are already `gate:fast` steps.

**VERIFIER:** `bun run gate:fast` EXIT 0 at 11 steps, ⭑ **and S1's observed reds are the evidence that removing
the incumbent lost nothing — gathered before it was removed.**

---

### S5 · The four JPWB tests that break on the move — fixed BEFORE the move

**PRE:** S4.

| test | disposition |
| --- | --- |
| `verif/mutant-ledger.test.ts` — **19 of 269** entries name `packages/csaa/` files | entries move to CSAA's ledger. ⚠ NOT deleted — CSAA keeps its own mutation record |
| `verif/svelte-name-projection.test.ts` — `…ts:43` imports the GENERIC svelte provider | **RULED: vendor the provider into JPWB.** The name projection is a JPWB property; 15 `it` blocks prove it |
| `verif/csaa-technical-completion.test.ts` (3 `it`) | moves to CSAA with its subject |
| `verif/dependency-boundary-rules.test.ts:125` pins `product-does-not-import-csaa` | S2's specifier retarget keeps the name meaningful; `COLLAPSE_FLOOR = 4` unaffected |

**VERIFIER:** `bun run test` green; `bun run mutants` with no `FILE MISSING` / `VICTIM MISSING`.
⭑ **DONE WHILE CSAA IS STILL PRESENT**, so any breakage is attributable to S5, not to the move.

---

## PHASE 4 — MOVE

### S6 · `git mv`

**PRE:** S4, S5. Gate green at 11 steps with CSAA present but ungated.

**WHAT:** from the repository root —
`git mv JanumiCode/janumiprofessionalworkbench/packages/csaa JanumiCode/csaa`, plus the 26 `scripts/csaa-*.ts`
wrappers, which are CSAA's and go with it. ⭑ History preserved natively: same repository, no `filter-repo`.

**VERIFIER:** `git log --follow` on three moved files shows pre-move history; `bun run gate:fast` EXIT 0.

---

### S7 · CSAA's couplings back into JPWB

**PRE:** S6.

**WHAT:** the **5** `bun ../../scripts/csaa-dependency-cruiser-differential.ts` escapes in CSAA's `package.json`
— from `JanumiCode/csaa/` these resolve to the repository root, which has a `scripts/` directory that does not
contain that file. Plus the **4 files importing `@janumipwb/csaa` by package name across 7 lines**, which
resolve today only through the workspace link the move deletes.

⚠ **SETTLE THE INSTALL QUESTION HERE, BY RUNNING ONE.** Nothing on the module-resolution path upward from
`JanumiCode/csaa/` supplies CSAA's four runtime dependencies, and the nearest ancestor manifest pins conflicting
versions. ⛔ Run `bun install` in a **scratch copy** of the proposed layout before S6 is final — not after.

**VERIFIER:** each of the 5 scripts runs; the `verif/` integration test covering the escapes stays green.

---

### S8 · Config and artifact cleanup

**PRE:** S7. **WHAT:** `.prettierignore` entries naming `packages/csaa`; `.dependency-cruiser.cjs` residue; the
report dispositions of `§12` — the six CSAA-subject artifacts move with the engine; `JAN-CSAA-005 … Mapping.md`
stays as a DATED record with its *"Generated by"* banner struck and its `subject.revision` stamped, ⛔ because
that banner is the only place a stale report would actively lie.

**VERIFIER:** `bun run gate:fast` EXIT 0; `verif/source-is-reviewable.test.ts` green on every edited file.

---

## PHASE 5 — RESOLVE THE COVERAGE SIDE EFFECT

> **Sponsor, standing:** *"All of the side effects of this change will have to be resolved — e.g., by adding
> relevant additional code coverage test cases, etc."*

### S9 · Restore branch-coverage headroom BY ADDING TESTS

**PRE:** S6. With CSAA out of the denominator JPWB's real figures are lines **97.58%**, statements 95.67,
functions 97.91, branches **84.92%** against a floor of 83 — ⚠ headroom **1.9pp**, not the apparent 8.4, which
was CSAA's contribution and never JPWB's.

⛔ **NO FLOOR MOVES.** 705 uncovered branches, and the work is not diffuse:

| package | branch % | uncovered |
| --- | --- | --- |
| `rph-application` | 82.7% | **357** |
| `rph-projections` | 85.9% | 94 |
| `rph-engine` | 80.7% | 64 |
| `rph-authoring` | 81.3% | 64 |
| `rph-assurance` | 83.9% | 36 |

**VERIFIER:** `bun run test:coverage`, thresholds unchanged, `autoUpdate: false`. ⛔ **A branch covered by a test
that asserts nothing is not covered** — each new test names the behaviour it pins, and `bun run mutants` must
kill a mutant in the newly-covered branch, ⭑ or coverage rose and assurance did not.

---

## 6. ⛔ WHAT RULE 2 DELETED FROM REV 1 — recorded, because the deletions are the finding

The sponsor asked *"what is the JPWB-side manifest gate?"* ⭑ **The term was mine. It appears nowhere in the
corpus, the register or the code.** Answering the question killed four steps:

| rev 1 step | why it is gone |
| --- | --- |
| **whole-tree sha256 manifest + committed baseline** | ⛔ **no consumer.** You satisfy it by regenerating it. `slices:ledger:check` works because its baseline is checked against a HUMAN-AUTHORED ledger — machine disagreeing with human is the finding. Mine would be checked against the tree it was generated from. ⭑ I built the thing `scripts/slice-ledger.ts`'s own header warns against |
| **derived population floors** | invented to replace the 303-path census's anti-vacuity role. The 9 salvaged path assertions ARE that role, and they name specific files — you cannot satisfy them vacuously |
| **`vitest.projects.ts` content pin** | the token digest served CSAA's static parser, which leaves. JPWB needs the file's SEMANTICS, and `verif/test-modes.test.ts` already asserts them — project set, `passWithNoTests: false`, both modes agreeing. ⚠ This also corrects design `§14 D-4`: **nothing replaces the digest** |
| **the equivalence differential** | under salvage the replacement IS the incumbent's assertion, reproduced. "Does it catch the same things" collapses into "does each salvaged limb redden", which is S1's verifier and S3's mutants |

⭑ **THE GENERAL FORM, AND IT IS WHY THIS SECTION EXISTS:** *a replacement designed from the SHAPE of what it
replaces inherits that shape's justification without inheriting its consumers.* The incumbent's manifest had a
consumer — CSAA's published analysis of JPWB. Mine copied the manifest and left the consumer behind.

---

## Deferred, and deliberately NOT taken here

- ⏸ **CI/CD.** ⚠ **Rev 1 reported "JPWB's CI has never run" as a FINDING. That framing was wrong** and is
  withdrawn. **Sponsor, 2026-09-11:** *"there is no configured CI or CD pipeline or environment established."*
  The nested `ci.yml` is scaffolding for a stage not yet reached, not a broken control. ⭑ The consequence still
  stands and is stated plainly: **every verifier in this roadmap is a developer-machine obligation.**
- ⛔ **CSAA has no self-directed non-vacuity check** (`REG-D-061` `D-5`). The 275 assertions that follow their
  subject have nowhere to land yet. CSAA's work; filed so the guarantee is not silently lost.
- ⛔ **`packages/csaa/` sits outside `verif/source-is-reviewable.test.ts`'s population**, as does `docs/canon`
  (4 pre-existing `0x08` bytes at register lines 27665 and 27905). Filed, not fixed.
