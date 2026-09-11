# DESIGN — JAN-CSAAEXT: moving CSAA out of JPWB

**Programme:** `JAN-CSAAEXT` · **Status:** DESIGN · **Opened:** 2026-09-10 · **Supersedes the mechanism of:** `JAN-CSAADEC`

---

## 1. The sponsor's framing, which settles what CSAA is

> *"CSAA was and is intended to be a separate tool that was and is intended to be useful to all sorts of
> codebases but started with Typescript first. It hasn't been very successful in practice however. All of the
> side effects of this change will have to be resolved — e.g., by adding relevant additional code coverage test
> cases, etc."*

⭑ **THIS RESOLVES A QUESTION THE WHOLE OF `JAN-CSAADEC` WAS FOUGHT WITHOUT.** That programme treated CSAA as a
JPWB component whose tests were inconveniently coupled to the repository. It is the reverse: **JPWB is CSAA's
SUBJECT, not its host.** Every obstacle recorded in `REG-F-381` and `REG-F-388` follows from a tool living
inside the thing it analyses, and none of them is a property of the tests.

⚠ **AND THE SECOND SENTENCE IS SCOPE, NOT COLOUR.** *"It hasn't been very successful in practice"* bounds what
this programme may spend. A tool that has not yet earned its keep does not justify an open-ended
generalisation; it justifies a clean separation whose cost is bounded and stated.

⛔ **AND THE THIRD SENTENCE IS THE HARD CONSTRAINT.** Side effects are RESOLVED, not absorbed. Where the
extraction removes coverage, coverage is **restored by new tests**, never by lowering a floor. `§6` makes that
concrete.

---

## 2. What CSAA has actually become — measured, and it decides the scope

`packages/csaa/package.json` describes itself as *"Deterministic code-semantic analysis and assurance tooling
**for** JPWB."* The measurement agrees with the description rather than with the intent:

| evidence | count |
| --- | --- |
| source paths whose FILENAME names JPWB | **5**, incl. three whole provider directories — `jpwb-arrow-command-census`, `jpwb-guard-enforcement-ledger`, `jpwb-state-machines` |
| exported constants prefixed `JPWB_` | **20** |
| production `.ts` files naming JPWB | **51 of 282** case-insensitively (**39** case-sensitively) |
| `inventory/collect-inventory.ts` alone | **234** `JPWB` occurrences (**309** case-insensitively) |

⛔ **TWO OF THOSE FOUR ROWS ARE CORRECTIONS OF THIS DOCUMENT'S OWN EARLIER FIGURES, AND THE CORRECTION MATTERS
LESS THAN WHICH ROWS IT HIT.** The first draft read *"67 of 282"* and *"265 JPWB references"*. Neither
reproduces under any instrument tried: the denominator 282 reproduces exactly, but its numerator is 51 / 39; the
file yields 234 / 309 occurrences and 226 / 301 lines. The original instrument is unrecoverable, so the figures
are restated as measured rather than defended. ⭑ **The two rows that CARRY the argument were re-measured and are
exact** — 5 non-test source paths naming JPWB (3 provider directories + `observe-jpwb-security.ts` +
`jpwb-harmonization-native-projection.ts`; 8 including tests), and 20 exported `JPWB_` constants, counted
by name. The finding stands on the rows that were right; the rows that were wrong were the decorative ones.

⚠ **NO CONTROL IS OFFERED FOR THE PERCENTAGE, DELIBERATELY.** The obvious control — another package in this
repository — is worthless, because every other package IS JPWB and naming JPWB is correct for it. The first two
rows need no control: **a tool for "all sorts of codebases" has three provider directories and twenty exported
constants named after one codebase.** That is the finding.

⭑ **AND IT EXPLAINS EVERY WALL `JAN-CSAADEC` HIT.** `JPWB_VITEST_PROJECT_DISCOVERY_SYNTAX_DIGEST` pins the token
stream of JPWB's `vitest.projects.ts`; `assertJpwbTestPopulations` demands JPWB's exact six-lane profile set;
`detectFinding55` keys on a function named `agyPrint`. `REG-F-388` concluded *"a fixture can make a guard throw;
only JPWB can make one pass"* — which is not a fact about fixtures. **It is CSAA having hard-coded its subject.**

---

## 3. Feasibility — the dependency already runs one way

| | |
| --- | --- |
| JPWB packages declaring a dependency on CSAA | **none** |
| CSAA's declared dependencies on JPWB | **one** — `@janumipwb/typescript-config` (devDependency, shared tsconfig base) |
| JPWB product code importing CSAA | **none** — the single hit is `CANARY.slice.test.ts`, a deliberately-uncollected fixture |
| CSAA's subject root | already a parameter (`repositoryRoot`), so it can analyse JPWB from outside |

⭑ **NOTHING IN THE CODE SHAPE PREVENTS THE MOVE.** The difficulty is entirely in what grew around it.

---

## 4. The couplings to sever

**A · THE GATE, AND THIS IS THE ONE THAT MATTERS.** `gate:fast` BEGINS with three CSAA checks:

```
csaa:generated-context:check && csaa:inventory:check && csaa:content-store-performance:check && …
```

and `boundary` runs `scripts/csaa-product-boundary.ts`. ⛔ **JPWB's definition of "done" starts with a tool that
is not JPWB.** That is the root of the recurrent tax: every increment in this session had to regenerate CSAA
baselines before JPWB's own gate would proceed.

**B · THE SURFACE.** 53 npm scripts, 26 `scripts/csaa-*.ts`, 8 `verif/csaa/` artifacts. Volume, not difficulty.

**C · THE `verif/` TESTS — AND THIS TRIAGE WAS WRONG.** ⚠ Re-measured: **11** `*.test.ts` files name CSAA
(**15** counting non-test `.ts`), not twelve. And the claim that followed is refuted in `§10`. One is genuinely CSAA's
(`csaa-technical-completion.test.ts`). The rest mention it incidentally — including
`dependency-boundary-rules.test.ts` and `svelte-name-projection.ts`, which are `JAN-CSAADEC` `CD-01`/`CD-02`
salvage: **JPWB asserting its OWN boundary rules**, deliberately built so a decoupling would lose nothing. They
are real salvage and the head start is real — ⛔ **but "they stay, and a decoupling would lose nothing" is
FALSE for both of them, measured.** See `§10A`. The salvage was built against `JAN-CSAADEC`'s scope (stop CSAA's
tests running in JPWB's suite); it was never built against Option 3's scope (the engine's source LEAVES), and a
guard written for the first does not survive the second.

**D · THE FOUR LIVE-TREE PINS.** `REG-F-381` measured the churn at four `it` blocks. They go WITH CSAA, and
there they are correct rather than churn: a tool that analyses a codebase SHOULD have acceptance tests against
a real one. What was wrong was running them inside their own subject's gate.

---

## 5. The scope decision — and it is the sponsor's

**OPTION 1 — RELOCATE AS IS.** CSAA moves out carrying its JPWB-specific parts. Cheapest, and honest so long as
the tool's own documentation stops claiming to be codebase-agnostic until it is. ⚠ Leaves 67 files, 20 constants
and three provider directories naming a codebase CSAA no longer lives in — which reads worse from outside than
it does today.

**OPTION 2 — RELOCATE AND SEPARATE.** The JPWB-specific parts become an explicit ADAPTER (a `jpwb` profile CSAA
loads) and the core carries no subject identity. ⭑ This is what the stated intent requires and what would make
the tool re-usable. ⛔ It is also a substantial refactor of a tool the sponsor describes as not yet successful.

**OPTION 3 — RELOCATE, AND LEAVE THE JPWB-SPECIFIC PARTS BEHIND IN JPWB.** The generic engine leaves; the
JPWB-shaped providers, guards and pins stay in JPWB as JPWB's own assurance code. ⭑ **Recommended.** It is
bounded, it makes both artifacts honest immediately, and it puts each piece where its subject is. The three
`jpwb-*` provider directories and `collect-inventory.ts`'s JPWB guards are, on the evidence, JPWB assurance code
that happens to live in CSAA.

⛔ **THAT MEASUREMENT WAS TAKEN, AND IT INVERTS THIS SECTION'S COSTING.** The design named
`collect-inventory.ts` as Option 3's expensive part. It is the CHEAP part: nothing inside that file branches on a
JPWB value — the references are inert data (bare `...JPWB_*_PROVENANCE` spreads into array literals, string
ids, prose), `capabilities()` is a static 42-row table of which 12 rows are JPWB, and the JPWB material lifts out
behind an optional `profile` on `CollectInventoryOptions`. The honest residue is 5 mixed provenance lists that
must be SPLIT rather than moved, and 2 prose strings that must be re-authored.

⚠ **THE EXPENSIVE PART IS THE THREE `jpwb-*` PROVIDER DIRECTORIES — the ones `§5` waved through as obviously
JPWB's.** True of their SUBJECT, false of their WIRING: they are imported BY PATH from 30 distinct files (16
production, including the core graph layer and CSAA's public `index.ts`), and the coupling is BIDIRECTIONAL —
each imports core modules back, and `jpwb-state-machines` imports back into `src/graph/` itself. They are not
leaf modules that lift out; they are entangled with the layer that would leave. ⚠ A further ~16 production
modules with generic names (`build-state-machine-graph.ts` and siblings, 7 `run-*-report.ts`) are themselves
JPWB-subject-bound, and which side of the split each takes is **the single largest unpriced item** — it is
roadmap work, and it is bigger than the split this section feared.

---

## 6. The side effects, and how each is RESOLVED

**A · COVERAGE — the one the sponsor named, and it is resolvable.** CSAA's 266 files sit inside JPWB's coverage
denominator (`include: ['packages/*/src/**/*.ts']`). Removing them changes JPWB's measured coverage:

| metric | with CSAA | **JPWB alone** | floor | verdict |
| --- | --- | --- | --- | --- |
| lines | 97.01% | **97.58%** | 97 | ✅ improves — headroom 0.01pp → 0.58pp |
| statements | 95.82% | **95.67%** | 95 | ✅ |
| functions | 98.76% | **97.91%** | 96.5 | ✅ |
| branches | 91.43% | **84.92%** | 83 | ⚠ passes, margin 8.4pp → **1.9pp** |

⭑⭑ **THE DISCLOSURE THAT MATTERS: JPWB'S REAL BRANCH COVERAGE IS 84.92%, NOT 91.43%.** CSAA has been inflating
it by 6.5 points. Nothing got worse — the number was always measuring the wrong population — but the standard
JPWB believed it was holding is not the one it holds.

⛔ **AND LINE COVERAGE GOES UP, WHICH RETIRES `REG-F-381`'s SPONSOR DECISION ENTIRELY.** That entry put a choice
to the sponsor — accept the churn, or lower the line floor — because removing four live-tree tests cost 94 lines
against 6 lines of headroom. **Those are CSAA's lines.** Once CSAA leaves JPWB's denominator the question does
not arise, and no floor is lowered. ⭑ The decision was real, and it was an artifact of the same category error
this programme corrects.

**THE CONCRETE RESOLUTION TARGET**, per the sponsor's instruction that side effects are resolved by adding tests:

| package | branch % | uncovered branches |
| --- | --- | --- |
| `rph-engine` | 80.7% | 64 |
| `rph-authoring` | 81.3% | 64 |
| `rph-application` | 82.7% | **357** |
| `rph-assurance` | 83.9% | 36 |
| `rph-projections` | 85.9% | 94 |

⭑ 705 uncovered branches across JPWB, and `rph-application` holds half of them. The work is not diffuse.

**B · THE GATE.** `gate:fast` loses its first three steps and `boundary` loses its CSAA half. ⚠ **What replaces
them is an open question, not a deletion** — see `§8`.

**C · CSAA'S OUTPUTS ABOUT JPWB.** `docs/ASTs and Code Analysis/JAN-CSAA-005 …Mapping.md` and `verif/csaa/*.json`
are reports ABOUT JPWB produced BY CSAA. They may reasonably stay as JPWB's record while their generator leaves —
but then nothing regenerates them, and a stale report is worse than none. Owed a decision.

**D · THE REGISTER.** `JPWB-REG-005` carries a large CSAA history. It is append-only and stays; entries are not
relocated. Future CSAA findings belong to CSAA's own record.

---

## 7. What is NOT taken

- ⛔ **No lowering of any coverage floor.** The thresholds do not move. Only the population is corrected, and the
  branch disclosure in `§6A` is surfaced rather than absorbed.
- ⛔ **No deletion of CSAA, in whole or in part.** The sponsor's `JAN-CSAADEC` instruction stands.
- ⛔ **No generalisation of CSAA beyond what separation requires.** Option 2's full form is out of scope on the
  sponsor's own assessment of the tool's track record.
- ⛔ **No re-litigation of `REG-F-386`.** The detector fix stands; it moves with CSAA.

---

## 8. Sponsor decisions, and what remains open

| # | question | status |
| --- | --- | --- |
| 1 | `§5` — which option? | ✅ **RULED 2026-09-10: OPTION 3.** The generic engine relocates; the JPWB-shaped parts stay in JPWB as JPWB's own assurance code. |
| 2 | Does JPWB's gate keep ANY CSAA check? | ⚠ **RULED, THEN AMENDED UNDER DELEGATION.** Sponsor 2026-09-11: keep today's check. `§13`: not literally satisfiable. `§14` `D-1`: keep the GUARANTEE, drop the coupling. **Ratification owed.** |
| 3 | Where does CSAA live? | ✅ **RULED 2026-09-10: `JanumiCode/csaa/`** — a sibling directory to `janumiprofessionalworkbench/`, inside the same `hestami-ai` git repository. |
| 4 | Do CSAA's reports about JPWB stay in JPWB? | ✅ **ANSWERED IN `§12`** — measurement, not a decision. Zero readers; 6 of 9 are CSAA measuring itself. |

---

## 9. What the destination ruling settles — measured AFTER the ruling, not assumed by it

**A · IT IS THE REPOSITORY'S EXISTING CONVENTION.** This design costed the destination as a novel arrangement.
It is not. `JanumiCode/` already holds four self-contained toolchain islands in one git repository:

| sibling | lockfile | own `.github/workflows/` |
| --- | --- | --- |
| `janumicode` | `pnpm-lock.yaml` | yes |
| `janumicode_v2` | `pnpm-lock.yaml` | yes |
| `janumilegal` | `pnpm-lock.yaml` | yes |
| `janumiprofessionalworkbench` | `bun.lock` | yes |

⭑ CSAA becomes the fifth — beside three TypeScript codebases that are precisely the *"all sorts of codebases"*
the sponsor named as its intended subjects.

**B · IT IS CHEAPER THAN EITHER OPTION `§8.3` PUT UP.** Same repository means `git mv` preserves history
natively: no `filter-repo`, no subtree split, no submodule, no second lockfile discipline to invent. And JPWB's
`workspaces` are `["packages/*", "apps/*"]` with coverage `include: ['packages/*/src/**/*.ts']`, both resolved
relative to JPWB's own root — so leaving `packages/` drops CSAA out of the workspace AND out of the coverage
denominator **with no glob edit.** The `§6A` coverage correction lands by relocation alone.

⛔ **BUT "NO CONFIGURATION EDIT AT ALL" WAS TOO STRONG, AND IS CORRECTED HERE.** It holds for everything driven
by a GLOB. It fails for everything driven by an IMPORT. `check-types` is `gate:fast` step 6 and ends with
`tsc --noEmit -p scripts/tsconfig.json`, whose `include` is `["**/*.ts"]` — and TypeScript follows imports past
`include`. **26 files under `scripts/` import CSAA by relative path across 34 import lines**, so CSAA's source
sits inside a `gate:fast` step's program today and a relocation only changes the path segment. Removing it means
converting those to package-specifier imports, which couples the gate to a BUILT CSAA. ⭑ That is a real cost of
the chosen destination, and it was not in `§8.3`'s costing.

⚠ **AND CSAA REACHES BACK UP.** `packages/csaa/package.json` carries **5** scripts invoking
`bun ../../scripts/csaa-dependency-cruiser-differential.ts`. From `JanumiCode/csaa/`, `../../` resolves to the
repository root — which HAS a `scripts/` directory, and it does NOT contain that file. Those five break on the
move. The coupling was never one-way at the script level; `§3` measured it only at the package-dependency level.

**C · ⏸ CI/CD IS A STAGE NOT YET REACHED — ⭐ AND THIS SECTION'S ORIGINAL FRAMING WAS WRONG.**

⚠ **WITHDRAWN: this was first written as a DISCLOSURE that "JPWB's CI has never run"**, which implies a control
regressed or is being missed. **Sponsor, 2026-09-11:** *"there is no configured CI or CD pipeline or environment
established so that will have to be deferred until that becomes a more pertinent issue and priority."* ⭐ There is
nothing to regress. The measurements below are accurate and are retained because ONE CONSEQUENCE SURVIVES the
correction — **every verifier in this programme is a developer-machine obligation** — but they describe
scaffolding for a stage not yet reached, not a defect.
`JanumiCode/janumiprofessionalworkbench/.github/workflows/ci.yml` is tracked, but GitHub Actions executes only
workflows in the **repository-root** `.github/workflows/`. The root workflow is named `JanumiCode CI` and is
path-filtered on both triggers to `paths: ['JanumiCode/janumicode/**']` with
`working-directory: JanumiCode/janumicode`. Its full occurrence count for "workbench" is **0**.

⛔ So JPWB's gate is enforced on developer machines and nowhere else. `§8.2` was framed as a question about a
BARRIER; it is a question about a RITUAL. All three JanumiCode siblings share the same inert arrangement, so
this is a property of the repository, not of JPWB.

⚠ Two further gaps, taken at face value from JPWB's own `ci.yml`: it runs SIX steps — `build`, `check-types`,
`lint`, `boundary`, `format:check`, `test` — not the thirteen of `gate:fast`. **`test:coverage` is absent.** The
branch floor of 83 on which the whole of `§6` turns is checked by no automation. `e2e` is absent likewise.

⛔ **NOT TAKEN HERE.** The CI gap is adjacent to this programme, not part of it. It is owed its own register
entry and its own scope ruling; this design neither fixes nor depends on it.

**D · THE TRAP THIS DISCLOSURE SET, RECORDED BECAUSE IT IS THE RECURRING ONE.** A full-count grep for `csaa`
in JPWB's `ci.yml` returns **0**, which reads as *"CI carries no CSAA dependency."* ⛔ **That reading is false.**
CI runs `boundary`, and `boundary` is `depcruise packages --config .dependency-cruiser.cjs && bun run
scripts/csaa-product-boundary.ts`. ⭑ **The dependency is real and invisible to a search for its own name** —
the standing rule that an absence must be checked in BOTH directions, paying off on the first artifact examined.

**E · CROSS-BOUNDARY REFERENCES TO CSAA ARE ZERO.** A repository-wide search outside JPWB returns 98 files
naming `packages/csaa` — ⚠ **and every one is untracked build cache** (83 in `.turbo/cache`, the rest in
`.codex-tmp*` scratch); tracked count **0**. Widening to bare `csaa` across all tracked files outside JPWB gives
**8**, and all 8 are base64/binary substring noise (`…hcsAAve…`, `CSaA==`) in a lockfile, a PNG, a PDF and four
`agent_history` blobs. ⭑ **Nothing outside JPWB depends on CSAA**, which is the mirror of `§3`'s finding that
nothing in JPWB depends on it either.
---

## 10. Option 3's measured side effects — the ones this design did not have

⛔ **EVERY ITEM HERE IS A JPWB-SIDE TEST THAT REDDENS WHEN CSAA'S SOURCE LEAVES.** None was in `§6`. `§6` costed
the extraction in COVERAGE; the actual bill is in BROKEN REFERENCES, and it is larger.

**A · FOUR JPWB TESTS BREAK, INCLUDING BOTH THAT `§4C` CERTIFIED AS SAFE.**

| what breaks | how | scale |
| --- | --- | --- |
| `verif/mutant-ledger.test.ts` | **19 of 269** ledger entries carry `file: 'packages/csaa/…'`; `:187` gates `existsSync` → `FILE MISSING`, `:254` → `VICTIM MISSING` | 19 entries |
| `verif/svelte-name-projection.test.ts` | `verif/svelte-name-projection.ts:43` imports `packages/csaa/src/providers/svelte/svelte-virtual-source.js` — a **GENERIC** provider, so it leaves | ~15 `it` blocks |
| `verif/csaa-technical-completion.test.ts` | via `scripts/csaa-technical-completion.ts:5` | 3 `it` blocks |
| `verif/dependency-boundary-rules.test.ts` | `:125` pins the rule NAME `product-does-not-import-csaa` in an 8-name list with `COLLAPSE_FLOOR = 4` | forced choice |

⚠ **THE TRAP IN THE MUTANT ROW, RECORDED BECAUSE THE REPOSITORY ALREADY RECORDED IT.** `run.ts:321` declares
`EXCLUDED_PROJECTS = ['csaa']`, which reads as a blanket bar making those 19 entries inert. `ledger.ts:3071-3077`
documents that exact misreading as WRONG — the exclusion applies only to empty-`expectRed` mutants, and *"a
named-victim csaa mutant has always been declarable."* ⭑ The entries are live. This design nearly retired a real
side effect by misreading a filter, in the one place the repository had already written down not to.

⛔ **AND `verif/dependency-boundary-rules.test.ts` IS THE SHARP ONE**, because it was `JAN-CSAADEC` `CD-01` —
built expressly so a decoupling would lose nothing, and named by `§4C` as this programme's head start. It pins a
rule whose entire subject is the path `^packages/csaa/`. Option 3 forces a choice between a RED TEST and a
PERMANENTLY VACUOUS RULE. It survives the loss of the CSAA *baseline* pin, which is all its own comment ever
claimed; it does not survive the loss of the CSAA *directory*.

**B · ⭑⭑ AND MEASURING THAT RULE FOUND A LIVE DEFECT THAT HAS NOTHING TO DO WITH THIS PROGRAMME.**
`product-does-not-import-csaa` declares `from: { path: '^(packages/rph-|apps/)' }`. `boundary` runs
`depcruise packages` — **a single positional scan root.** No `apps/` file ever enters the cruised graph, so
**the `apps/` arm of that rule has never been able to fire.** It is a control that cannot fail, live on `main`
today, independent of any relocation.

⛔ The only thing enforcing the app-side prohibition is `scripts/csaa-product-boundary.ts` — a CSAA script. So
the recorded remedy *"retarget `to:` to the npm name, a one-line fix"* is **necessary but NOT sufficient**: the
perimeter must also widen to `depcruise packages apps`, or Option 3 deletes the only live app-side guard and
replaces it with one that was already vacuous.

---

## 11. `§8.2` ANSWERED — what the gate keeps

**PER-CHECK, BY SUBJECT.** Exactly one of the four dissolves cleanly.

| check | subject | disposition |
| --- | --- | --- |
| `csaa:content-store-performance:check` | **CSAA** — digest over 3 CSAA source files; `--check` re-measures nothing | ✅ leaves with the engine, nothing owed |
| `boundary`'s CSAA half | **JPWB** | ⚠ half-dissolves — see `§10B`; needs `depcruise packages apps` AND a specifier retarget |
| `csaa:generated-context:check` | **JPWB, 100%** — 194 inputs: 180 `apps/rph-demo` + 14 root configs, zero `packages`/`scripts`/`verif` | ⚠ regeneration survives (`svelte-kit sync` runs in JPWB's own `check`/`build`/`e2e`); **the PIN leaves** |
| `csaa:inventory:check` | **MIXED — and this is the crux** | ⛔ does not dissolve |

⛔ **`csaa:inventory:check` IS A GENUINE WHOLE-JPWB-TREE FRESHNESS CHECK, AND JPWB HAS NO REPLACEMENT.** Its
baseline records **1367 files with per-file sha256, of which 875 are non-CSAA JPWB files**; measured live, 1367
match and 0 are missing, and of 597 tracked `.ts` files under `packages/rph-*/src`, `apps/*/src`, `verif/` and
`scripts/`, **zero are absent from it**. Any edit anywhere in JPWB's tree reddens it. Searched both directions
for a CSAA-free equivalent: none exists. The two JPWB-owned freshness ratchets that do exist —
`slices:ledger:check` and `verif/tracker-census-freshness.test.ts` — are both narrow and neither ranges over the
tree.

⭑ **AND IT IS SELF-REFERENTIAL.** `collect-inventory.ts:2833-2840` asserts that `gate:fast` literally BEGINS
`bun run csaa:generated-context:check && bun run csaa:inventory:check && ` — **so removing the two steps reddens
the check that removing them was meant to retire.** The roadmap must sequence around this.

⚠ **THE PREMISE `§8.2` WAS BUILT ON WAS MIS-CITED, AND THE CORRECTION SHARPENS IT.** The question read *"the
failure `REG-F-376` measured across six programmes."* ⛔ `REG-F-376` is titled *"CSAA's suite needs the workbench
for THREE of its 188 files"* — coupling in the OPPOSITE direction. The real record is at register line 34135:
*"`REG-F-376` recorded that six consecutive programmes moved a pinned CSAA population without noticing, because
every author ran vitest with NAMED `--project` filters and never the unfiltered suite."*

⭑⭑ **THAT IS A DIFFERENT FAILURE, AND IT ARGUES THE OTHER WAY.** The recorded failure is not *"no check existed"*
— it is *"a check existed and nobody ran it."* Which is exactly `§9C`: **no `csaa:*` step runs in any
automation at all.** The risk `§8.2` feared from DELETING a gate step is already fully realised for every step
in it. Whatever replaces these checks, the binding constraint is that something must actually RUN it.

**THE RECOMMENDATION, AND IT IS STILL A SCOPE RULING.** Build a JPWB-side manifest gate — `git ls-files` +
sha256 + committed baseline. ⭑ It has an in-repo worked example that says so in its own header:
`scripts/slice-ledger.ts:4-10`, *"MODELLED ON `csaa:inventory:check`, NOT ON `tracker:build`"* — because
`tracker:build` rebuilds a gitignored DB and *"cannot detect staleness at all."* ⚠ What is NOT derivable is its
FIDELITY: today's check also carries 38 required-path assertions, 25 exact-command assertions, a 34-name
required-root-command list and an exact-arity test-population census. **Which of those JPWB wants is the
sponsor's ruling.**

✅ **RULED 2026-09-11: KEEP TODAY'S CHECK.** Not the freshness half alone — the non-vacuity guards too: the
required-path assertions, the exact-command assertions, the required-root-command list and the exact-arity
test-population census. JPWB keeps the guarantee it has today.

⚠ **AND THAT RULING MAKES THE LARGEST UNPRICED ITEM BINDING, WHICH THIS DESIGN STATES RATHER THAN ASSUMES
AWAY.** The `assertJpwb*` family is JPWB-subject code and therefore STAYS under Option 3 — but every guard in it
is typed against ENGINE structures (`FrozenSubject`, `SelectedFileRecord[]`, `VerificationAssetInventory[]`,
`CommandInventory[]`) produced by the engine that LEAVES. ⛔ **So "the guards stay" is not a relocation; it is
one of three routes**, and which one is a measurement, not a preference:

| route | shape | the thing that disqualifies it if true |
| --- | --- | --- |
| **A** | JPWB declares a real dependency on built CSAA and calls its API | reverses `§3`'s one-way finding; couples JPWB's gate to an external tool's build |
| **B** | guards move to JPWB with a JPWB-owned minimal producer for their inputs | the producer may not be able to reproduce what the guards assert |
| **C** | guards move to JPWB and read the committed baseline JSON | ⚠ likely CIRCULAR — that baseline is what the check COMPARES AGAINST |

⛔ **NO ROUTE IS ADOPTED HERE.** The closure — how much engine the guards actually need, and whether it is
type-only and re-declarable or behavioural — is being measured, and the roadmap is not written until it is.
⭐ Writing a roadmap over this gap is precisely the standing failure that a recommended remedy is a
HYPOTHESIS until probed.

---

## 12. `§8.4` ANSWERED — the reports

⭑ **THIS IS A MEASUREMENT, NOT A DECISION, AND THE ANSWER IS BENIGN.** No JPWB-side test, gate step or doc pin
reads any `verif/csaa/*` artifact — established with positive controls and an untruncated full-repo sweep of
every basename. ⛔ So `§6C`'s worry that orphaning a report *"breaks a test"* is **false for all nine artifacts.**

⚠ **BUT `§6C`'s PREMISE FAILS FOR TWO-THIRDS OF THEM.** It called these *"reports ABOUT JPWB produced BY CSAA."*
Measured by subject, only **three of nine** are about JPWB. Six are **CSAA measuring itself** — its own content
store, its own persistence choice, its own provider's fidelity against dependency-cruiser (that runner declares
`AUTHORITY = 'NONE'` and `GATE_EFFECT = 'NONE'` in source), local tool availability, and a fixtures README.
Under the sponsor's own rule they **MUST-LEAVE, with no decision owed.**

**THE THREE THAT ARE GENUINELY ABOUT JPWB** — `JAN-CSAA-005 …Mapping.md`, `jan-csaa-005.inventory.baseline.json`,
`rph-demo.svelte-kit.generated-context.evidence.json` — are all **STAYS-BUT-GOES-STALE**. Nothing breaks; nothing
regenerates. **STAYS-AND-STAYS-FRESH is empty.**

⚠ **AND THE FIRST TWO ARE NOT TWO ARTIFACTS.** `run-inventory.ts` writes the markdown and the baseline as ONE
ATOMIC PAIR and `--check` compares BOTH, so *"the doc stays, the baseline goes"* is not available without editing
the doc — whose generated region carries a banner asserting it is current.

**TREATMENT** (reasoned from the standing retire-by-striking rule; ⚠ not tested by running the gate): the six
CSAA-subject artifacts move with the engine at zero cost. `JAN-CSAA-005 …Mapping.md` stays as a DATED historical
record — strike its *"Generated by `bun run csaa:inventory`"* banner and stamp the `subject.revision` it was
generated at, because **the banner is the only place a stale report would actively lie.** The paired baseline
(1.4 MB) loses its only consumer and goes with the engine or is struck.
---

## 13. ⛔ THE `§8.2` RULING IS NOT LITERALLY SATISFIABLE — measured, and it needs a sponsor amendment

⛔ **"KEEP TODAY'S CHECK AT FULL FIDELITY" CANNOT BE CARRIED OUT AS STATED, AND THE REASON IS NOT COST.** It is
that today's check is overwhelmingly a census of CSAA itself, and CSAA is what leaves.

**A · THE MEASUREMENT, TAKEN FOUR WAYS.** The 37 `assertRequiredSelectedPaths` call sites assert that a set of
repository-relative paths is present in the selected-file manifest. Resolving all 37 arguments — 33 bare
identifiers and **4 inline spread arrays** — and following every `...SPREAD` transitively to closure (44 of 44
identifiers resolved, 0 unresolved):

| bucket | distinct paths | share |
| --- | --- | --- |
| `packages/csaa/` | **275** | 90.8% |
| `scripts/csaa-*` | 19 | 6.3% |
| `verif/` (JPWB's own) | 8 | 2.6% |
| root (`package.json`) | 1 | 0.3% |
| **total** | **303** | |

⭑ **294 of 303 — 97% — are CSAA's own files. NINE survive the move**, and they are a coherent set:
`package.json` plus JPWB's arrow-command-census family (4) and guard-enforcement-ledger family (3).

⚠ **THE `packages/csaa/` FIGURE OF 275 IS CONFIRMED BY THREE INDEPENDENT INSTRUMENTS** built without sight of
one another. Two earlier counts — 268 of 296, and 268 of 295 — are UNDERCOUNTS from the same defect: a
literal-only extractor that never expanded `...` spreads, so `TYPESCRIPT_SEMANTIC_PROVENANCE`
(`collect-inventory.ts:1032-1036`, which is *nothing but* three spreads and has zero direct literals)
contributed **0** to its own guard's count.

**B · AND IT IS NOT A COST PROBLEM, IT IS A MECHANICAL IMPOSSIBILITY.** The obvious remedy — keep the guards in
JPWB and repoint them at `../csaa/` — is refused by the engine's own path layer, byte-exact:

- `subject/paths.ts:50-51` — `if (!isInsideRoot(realRoot, absolute)) { throw new Error(`Path escapes repository root: ${candidate}`); }`
- `subject/paths.ts:86` — any segment equal to `..` throws `Non-canonical repository-relative path`
- `subject/paths.ts:67` — `Symlink or path escapes repository root`, so a symlink is refused too

⛔ A JPWB-rooted manifest **can never contain a path outside the JPWB root.** Re-rooting at `JanumiCode/` fails
independently: there is no `package.json` there, and `collect-inventory.ts:2654` demands the root manifest be
named `janumi-professional-workbench`. ⭑ **So the 275 engine paths become permanently unsatisfiable the instant
CSAA leaves the JPWB root — under every route, regardless of where the guard CODE lives.**

**C · WHAT THIS DOES AND DOES NOT COST.** The ruling's INTENT is fully achievable; its CONTENT is not. Today's
check has two halves and they part company here:

| half | what it guards | disposition |
| --- | --- | --- |
| **freshness** — 1367-file manifest with per-file sha256, **875 of them non-CSAA JPWB files** | JPWB's own tree | ✅ **fully preservable.** This is the half that actually guards JPWB, and nothing about the move weakens it |
| **non-vacuity** — the 37 path assertions, 27 exact-command assertions, the 34-name root-command list, the test-population census | 97% CSAA | ⛔ **cannot move. Must be RE-AUTHORED** against JPWB's own assurance surface |

⭑ **THE HONEST READING OF THE RULING IS THEREFORE: KEEP THE GUARANTEE, RE-AUTHOR THE CONTENT — each assertion
follows its own subject.** CSAA's 275 belong in a CSAA self-check (⚠ which does not exist today and would have
to be built, in CSAA); JPWB's 9 stay and are the SEED of what JPWB's list should assert. ⛔ **How far to extend
those 9 is the sponsor's amendment, and it is the one thing blocking the roadmap.**

**D · ⚠ AND THE MOVE MANUFACTURES THREE CONTROLS THAT CANNOT FAIL, IF NOT HANDLED EXPLICITLY.** This repository's
most-recorded defect shape, created here by construction:

1. `scripts/csaa-product-boundary.ts:50` hard-codes `resolve(repositoryRoot, 'packages', 'csaa')`. After the
   move its relative-import arm can never fire again — ⛔ **and the script still exits ok.**
2. **188 of 541** collected test files drop out of a filesystem-derived vitest project list that **cannot redden
   on an absent directory** — including the non-vacuity block that is the guards' only proof of discrimination.
3. The guards' red-proving corpus — **~1,813 lines, 93 guard invocations, 88 message assertions** — is written
   against the engine entry point and leaves JPWB's gate with it. ⭑ **A guard whose mutants no longer redden is
   not the same guarantee**, which is this repository's own standing rule, and "full fidelity" cannot mean
   keeping the guard while losing its discrimination proof.

**E · ⭑ ONE THING THE RULING DID FIX.** `§11` flagged a sequencing trap: `collect-inventory.ts:2833-2840`
asserts that `gate:fast` literally BEGINS with the two CSAA steps, so removing them would redden the check that
removing them was meant to retire. ✅ **Ruling `§8.2` dissolves it** — `gate:fast` keeps both steps, so the
prefix assertion stays true, and 19 of 27 command pins plus all 34 root-command names survive untouched.

**F · FOUR FURTHER COSTS THE ROADMAP MUST CARRY**, each measured, none previously priced:
- ⚠ `git ls-files` is **cwd-scoped**, so a JPWB-side producer sees 32 of the required paths after the move, not
  303. The lever `§11` leaned on is a pre-move fact.
- ⚠ **4 files import `@janumipwb/csaa` by package NAME across 7 lines** — a fact an earlier search missed by
  excluding `packages/csaa` and generalising to *"nowhere"*. They resolve today only through the workspace link
  the move deletes.
- ⚠ Nothing on the module-resolution path upward from `JanumiCode/csaa/` supplies CSAA's four runtime
  dependencies, and the nearest ancestor `package.json` pins conflicting versions.
- ⚠ Gate step 2 imports the package BARREL, not `collect-inventory.ts`: the real executed closure is **253 files
  / ~221,000 lines**, not the ~35,000 an earlier estimate gave.
---

## 14. THE AUTHORED RESOLUTION — taken under delegated authority, 2026-09-11

> **SPONSOR DELEGATION.** *"You will have to use your delegated authority … to author solutions because I can no
> longer distinguish the tradeoffs you're describing."*

⛔ **THE DELEGATION IS RECORDED, NOT ASSUMED, AND EVERY RULING BELOW IS MARKED SO IT CAN BE OVERTURNED.** `D-1`
AMENDS the sponsor's own `§8.2` ruling. The rest are new. Ratification is OWED on all six.

---

### ⛔ D-1 — JPWB's gate stops depending on CSAA. **This AMENDS `§8.2`.**

**RULED: Route B.** JPWB owns a JPWB-side manifest gate. The three `csaa:*` steps LEAVE `gate:fast`.

⚠ **WHY I AM OVERTURNING A RULING THE SPONSOR MADE 24 HOURS AGO.** *"Keep today's check"* and *"CSAA is not
part of JPWB"* cannot both hold literally. Keeping the check means `gate:fast` keeps invoking CSAA — now across
a directory boundary, needing CSAA installed, built and version-matched — which is the precise coupling `§4A`
identifies as this programme's reason to exist: ⛔ *"JPWB's definition of 'done' starts with a tool that is not
JPWB."* Executing `§8.2` literally would leave that sentence true and add a directory boundary to it.

⭑ **SO I PRESERVE THE GUARANTEE AND DROP THE COUPLING.** The sponsor's intent — *JPWB keeps the assurance it
has today* — is met in full. What changes is who runs it. Routes A and C are refused on measurement, not taste:
**A** cannot resolve CSAA's four runtime dependencies from `JanumiCode/csaa/` and the nearest ancestor manifest
pins conflicting versions; **C** is circular, since the baseline it would read is what the check compares against.

---

### ⭑ D-2 — the non-vacuity control is DERIVED, never enumerated

**RULED:** ⛔ **JPWB does NOT re-author a hand-listed path census.** ⭐ **AMENDED 2026-09-11 — the original
form of this ruling was a derived per-population floor over `git ls-files`, and it is WITHDRAWN.** The floors were
invented to carry the anti-vacuity role of the 303-path census. The **9 SALVAGED path assertions already carry
it**: they name specific files, so they cannot be satisfied vacuously, and no derived floor is needed to prop
them up. ⚠ The withdrawn form also failed `ROADMAP` Rule 2 — I could not name what read it.

⭑ **BECAUSE HAND-LISTING IS WHAT BROKE THE ONE WE ARE REPLACING.** 303 hand-listed paths went 97% stale the
moment their subject moved, and nothing could have told anyone — the list had no way to notice its own
obsolescence. This repository's standing rule is exactly this: **derive it, never enumerate — hand-listing IS
the defect one level up.** A floor over a derived population cannot go stale, and it catches the failure an
enumeration is actually for: a population silently collapsing.

⛔ **AND THE INDEPENDENCE IS MANDATORY, NOT STYLISTIC.** The floor must be computed from an instrument the
manifest does NOT use. `collect-inventory.ts:2735-2737` records why in its own words: *deriving the set from the
same configuration files discovery already read would make the guard vacuous.* So: manifest from the
policy-selected capture; floors from `git ls-files`. Two instruments, or it is a control that cannot fail.

---

### ✅ D-3 — `assertJpwbGeneratedContext` is RETIRED as redundant, not replaced

**RULED:** dropped. Not a lost guarantee — a removed duplication.

**MEASURED:** every `apps/rph-demo` script that could observe the generated context runs `svelte-kit sync`
first — `dev`, `build`, `check`, `e2e` and `prepare` — and **`build`, `check` and `e2e` are all already
`gate:fast` steps.** The freshness property holds without one line of new code. ⭑ This alone retires the
2,410-line generated-context closure the cost models priced as Tier 3.

---

### ✅ D-4 — `assertJpwbTestPopulations` is NOT re-implemented, because JPWB ALREADY HAS IT

**RULED:** not rebuilt. `verif/test-modes.test.ts` is JPWB-owned, CSAA-free, already in the gate, and already
asserts the substance:

- *"discovers a plausible number of packages, so nothing below can pass vacuously"* — ⭑ **an anti-vacuity
  control JPWB already owns**
- *"covers EVERY package that holds a test file — a new package cannot be silently unmeasured"*
- *"runs the SAME project set in both modes, or the cross-check is silently partial"*
- *"sets `passWithNoTests: false` on every project in both modes"*
- *"lets no package re-introduce a `--passWithNoTests` script, which is how the gate went silent"*

⭑ This retires the 790-line AST recognizer priced as Tier 2. ⚠ **ONE THING IT DOES NOT COVER, AND THE
REPLACEMENT IS STRONGER:** the token-stream digest pin on `vitest.projects.ts`. ⭐ **AMENDED 2026-09-11: NOTHING
REPLACES IT, and the earlier answer here — "a content hash in the new baseline" — is WITHDRAWN.** The digest
existed so CSAA's STATIC PARSER could trust the file's syntax; that need leaves with the parser. What JPWB needs
is the file's SEMANTICS, and `verif/test-modes.test.ts` already asserts them — the project set, `passWithNoTests:
false` on every project, both modes agreeing. ⚠ A content hash would have added only *"someone reformatted it"*,
which is a finding for no one.

---

### ⚠ D-5 — the 275 CSAA paths follow their subject, and the obligation is FILED not dropped

**RULED:** they belong in a CSAA self-directed non-vacuity check. ⛔ **That check does not exist today** — CSAA
has never asserted its own completeness; it only ever asserted JPWB's. Building it is CSAA's work, not JPWB's,
and it is recorded here so the guarantee is not silently lost in the move. ⚠ Until it exists, CSAA's own
population is ungated — which is a finding about CSAA, and it is the mirror image of the finding that opened
this programme.

---

### ⛔ D-6 — the three controls-that-cannot-fail are fixed in the SAME increment that creates them

**RULED:** no increment may land that creates one. Each gets a NAMED RED TEST before the change that would
blind it:

| `§10B`/`§13D` control | fix | its red test |
| --- | --- | --- |
| `csaa-product-boundary.ts:50` hard-codes `packages/csaa` | the check moves to JPWB and targets the npm specifier | a fixture importing the specifier must FAIL the boundary |
| `depcruise packages` never scans `apps/` | widen to `depcruise packages apps` | an `apps/` file importing CSAA must FAIL |
| 188 of 541 test files leave a filesystem-derived project list that cannot redden | the population floor of `D-2` | dropping a package below its floor must FAIL |

⭑ **AND THE DISCRIMINATION PROOF TRAVELS WITH THE GUARD.** The 1,813-line red-proving corpus is written against
the engine and leaves with it. JPWB's replacement guard gets its OWN mutants under `scripts/mutants/ledger.ts`.
⛔ A guard whose mutants no longer redden is not the same guarantee, and *"full fidelity"* cannot mean keeping
the assertion while losing the proof that it discriminates.

---

### ⭑⭑ WHAT THIS COSTS — and it is small, because JPWB already owns the parts

The cost models priced 1,900–3,600 lines of re-homed engine. ⛔ **That estimate was for porting CSAA. We are not
porting CSAA.** Every primitive already exists in JPWB:

| primitive | already in JPWB |
| --- | --- |
| git-derived population | ✅ `verif/slice-ledger.ts:63-70` — `workingSet()`, `git ls-files -co --exclude-standard` |
| committed-baseline `:check` idiom | ✅ `slices:ledger:check` + `verif/slices/slice-ledger.baseline.json` |
| anti-vacuity over the project set | ✅ `verif/test-modes.test.ts` |
| the worked example, by name | ✅ `scripts/slice-ledger.ts:4-10` — *"MODELLED ON `csaa:inventory:check`"* |

⭑ **WHAT IS ACTUALLY NEW is a whole-tree sha256 manifest plus a baseline comparison** — `workingSet()`, a hash
per file, canonical JSON, a diff, and the `D-2` floors. On the shape of `slice-ledger.ts` that is a **low
hundreds of lines**, not thousands, and it is JPWB code with a JPWB subject throughout.
