# DESIGN — JAN-PFA: three ratchets that guard an average, and the members they are silent about

**Programme:** `JAN-PFA` · **Status:** DESIGN (~~rev 2~~ rev 3 — §10: R2's remote case) · **Opened:** 2026-09-12 ·
**Supersedes:** `DESIGN-per-file-coverage-floor.md` (folded in; that file covered half the problem).

**REV 2 — WHAT THE SPONSOR CHANGED.** Two interventions, each of which killed a proposal rather than refining it:
*"'at least one mutant per file' doesn't set a quality floor that I want measured"* withdrew `R2` and replaced its
basis with change→consequence feedback; *"We need to address the unguarded files as well"* converted the 76-file
debt from something the ratchet FREEZES into `R3`, a programme that works it off. ⭑ Both moves were away from
counting instrumentation and toward asking what a change actually costs — which is the same correction, twice.

---

## 1. The sponsor found the second half, and it is the larger one

The sponsor accepted a per-file coverage ratchet, then read the caveat attached to it — *coverage counts
execution, not assertion; only a mutant proves discrimination* — and said: **"the mutant issue is key to resolve
as well."**

⭑ **THAT TURNS ONE DESIGN INTO ONE DESIGN ABOUT TWO INSTRUMENTS WITH THE SAME DEFECT.**

| instrument | what it guards | ⛔ what it is silent about |
| --- | --- | --- |
| coverage thresholds | one global % over a merged population | **every individual file** |
| mutation ledger | internal coherence, and `MEASURABLE.length > 100` | **which files it reaches at all** |

Both ratchet an AGGREGATE. Neither says anything about a member. ⭑ **And this is the same defect
`JAN-CSAAEXT` was fought over**: CSAA's 266 files held branch coverage at 91.43% while JPWB's own was 84.92%.
Removing them changed no file's coverage — it changed what the average was an average OF.

---

## 2. The measurement, and the mutation half is worse

**COVERAGE — 106 files measured, one global floor of 83 branches (met at 87.61%):**

| | |
| --- | --- |
| files individually below 83% branches | **24** |
| worst | `rph-projections/src/pwu-behavior.ts` at **60.0%** |
| largest single gap | `rph-application/src/handlers/decomposition.ts` — 45 uncovered |

⭑ `JAN-CSAAEXT` S9 demonstrated the failure mode rather than arguing it: 126 branches added, the global rose
84.92 → 87.61, **and not one of the 24 weak files moved.** Nothing said so.

**MUTATION — 254 entries, and the reach is the finding:**

| | |
| --- | --- |
| coverage-measured files | 106 |
| ⛔ of those, with **at least one** mutant | **30** |
| of those, with **zero** mutants | **76** — of which 12 have no branches, so **64 owe one** |
| ⛔⛔ **branches sitting in files with no mutant** | **1,663 of 4,683 — 35.5%** |

`packages/rph-domain/src/governance.ts`: 794 lines, **128 branches, zero mutants.**
`packages/rph-assurance/src/assurance-rules.ts`: **116 branches, zero mutants.**

⭑ **AND THE SPLIT INSIDE THAT 1,663 IS THE FINDING THAT SEPARATES THE TWO RATCHETS.** Of those branches:

| | |
| --- | --- |
| already UNCOVERED — R1's population | **224** |
| ⛔ **COVERED, and no mutant has ever tested whether anything asserts them** | **1,439** |

**R1 CANNOT REACH 1,439 OF THE 1,663.** They are green on every coverage report today and will stay green.
`packages/rph-assurance/src/floor.ts` is the exhibit: **28 branches, 100% covered, five consumed exports, zero
mutants.** Coverage calls it perfect; nothing has ever tried to break it. ⚠ **The two ratchets are aimed at
almost disjoint populations, and neither one's success moves the other's number.**

⚠ **AND THE TWO GAPS OVERLAP AT THE WORST END.** Every one of the eight worst-covered files is also unmutated.
For those files the COVERED branches are as unproven as the uncovered ones — a per-file coverage ratchet would
freeze `pwu-behavior.ts` at 60% and say nothing about whether that 60% is asserted or merely executed.

**⛔ AND THE LEDGER'S OWN FLOORS CANNOT CATCH THIS.** Its thirteen checks are all INTERNAL COHERENCE — unique
ids, victims present on disk, anchors resolving exactly once, one victim per mutant. Good checks, and every one
is about whether the ledger agrees with itself. The only population assertions are `> 100` and `> 50` against a
population of 254: **the ledger could lose three-fifths of its entries and every check would stay green.**

---

## 3. ⚠ The refinement the sponsor should see: this records UNCOVERED COUNTS, not percentages

"Floor" reads as *each file must stay above N%*. The implementation records **counts**, and the difference
changes what the gate says:

| | percentage floor | count ceiling ⭑ chosen |
| --- | --- | --- |
| add covered code | passes | passes |
| **add UNCOVERED code** | ⚠ **passes** if the file grew enough | **FAILS** |
| rounding 87.61 → 87.60 | ⚠ fails spuriously | unaffected |

⭑ The middle row is the argument: a percentage floor lets a file add uncovered branches provided it adds covered
ones alongside — **the averaging defect reproduced inside a single file.**

---

## 4. What is proposed

**R1 — PER-FILE COVERAGE RATCHET.** A derived baseline records each file's uncovered counts for all four
metrics; a `verif/` check fails when any file's uncovered count rises, or when the file set changes without the
baseline being regenerated. `gate:fast`, immediately after `test:coverage`.

⛔ `perFile: true` IS REFUTED AND IS NOT THE MECHANISM. It is a boolean reapplying the SAME four numbers per
file: turned on today it fails **38 of 106 files**, and set to numbers everything passes it drops the effective
floors to **71 / 60 / 50 / 75**. That trades the aggregate guarantee for the per-file one. Confirmed against
vitest's shipped source (`coverage.DM_a_rWm.js:861`); glob thresholds are additive to the global (`:838`) but
aggregate over matched files, so only a one-file glob is per-file — 38 hand-maintained entries, which is the
stale-pin defect multiplied.

**R2 — CHANGE-SCOPED MUTATION.** ⛔ **"≥1 MUTANT PER FILE" IS WITHDRAWN. The sponsor rejected it in terms that
name its defect:** *"'at least one mutant per file' doesn't set a quality floor that I want measured… what could
we base it on that enables feedback to coding agents when something that is changed breaks something else that
needs to be flagged loudly as such?"* ⭑ A per-file count measures INSTRUMENTATION. It cannot answer *what did I
just break?*, only *has anyone ever pointed a mutant at this file?*

**THE BASIS IS THE CHANGE, NOT THE FILE:** for the region a diff actually touches — **is there a declared guard
over it, and does that guard still discriminate after the change?**

⭑ **THE ENABLING FACT IS MEASURED, NOT ASSUMED: all 238 measurable ledger entries resolve to an exact
`(file, line-range, named-victim)` triple. 238 of 238, none unlocatable.** So a `git diff` can be intersected
with the ledger, and selection — not a new engine — is the whole mechanism. `run.ts` already takes ids as argv
filters; at a measured ~4s per mutant a diff touching fifteen guards costs about a minute.

Two signals, and they mean different things:

| signal | what the agent is told |
| --- | --- |
| a guard over the changed region now **SURVIVES** | ⛔ **you broke a guarantee** — the test that discriminated here no longer does, and the suite is still green |
| the changed region has **no declared guard** | ⛔ nothing in this repository has ever tried to break this line |

⚠ **ITS LIMIT, STATED BEFORE IT IS BUILT: diff-intersection catches the LOCAL case only.** Change file `A` and a
guard over `A` goes slack — caught. Weaken something shared in `A` so that a guard over **file `B`** goes slack —
the diff does not select `B`'s guard. Catching that needs a test→code map (which tests execute the changed
lines), which JPWB does not collect today. ⭑ **That is `R2`'s open question, and it is not hand-waved: the remote
case is the one the sponsor's phrase *"changed something else"* actually names.**

---

**R3 — THE UNGUARDED FILES, WHICH ARE NOT FROZEN BUT WORKED OFF.** Sponsor instruction: *"We need to address the
unguarded files as well."* `R2` reaches only the 30 files that carry a guard; **76 do not**, and `§2` shows why
freezing them fails — 1,439 of their branches are covered, so `R1` will never mention them either.

⛔ **AND "GUARD THEM AS WORK TOUCHES THEM" IS REFUTED BY MEASUREMENT.** The tempting cheap route — make a guard
due whenever an agent edits an unguarded file — would leave most of the debt permanently unpaid:

| window | unguarded files touched |
| --- | --- |
| last 14 days | 19 of 64 |
| last 30 days | 25 of 64 |
| ⚠ "last 90 days" | 64 of 64 — **a vacuous reading; the repo is 62 days old, so the window is its whole history** |

**39 of 64 have not been touched in a month.** A touch-triggered rule works off the active third and abandons the
rest — and the abandoned two-thirds includes the settled kernel files, which are exactly the ones whose
guarantees the rest of the system leans on.

⭐ **THE UNIT OF OBLIGATION IS THE CONSUMED EXPORT, NOT THE FILE AND NOT THE BRANCH.** A file's consequence to the
rest of the system flows through what other modules import from it. That is the relational question this
repository keeps having to relearn — *what reads this, and what breaks if it is wrong?* — and unlike a branch
count it is **derivable** (barrel-resolved, never hand-listed) and it **scales with coupling rather than size**.

⚠ **THE FIRST CUT OF THIS MEASUREMENT WAS WRONG, AND THE CORRECTION IS RECORDED RATHER THAN QUIETLY APPLIED.**
It counted a colocated `foo.test.ts` inside `packages/` as a production consumer, because the filter asked
*"is this path under `packages/`?"* — an intrinsic property — instead of *"is this consumer a test?"*. ⭑ The
same defect this corpus keeps recording, committed inside the instrument built to measure it.

| | first cut | ⭑ corrected |
| --- | --- | --- |
| value exports across the 64 unguarded files | 222 | 222 |
| consumed by a **production** consumer | 177 *(contaminated)* | **127** |
| consumed ONLY by tests / `verif/` / `scripts/` | — | ~~50~~ **71** |
| ⛔ consumed by **nothing at all** | — | ~~45~~ **23** — surface nothing reads; a separate question |

**AND THE CORRECTION MOVES THE CONTROL, WHICH IS WHERE IT MATTERS:**

| | first cut | ⭑ corrected |
| --- | --- | --- |
| the 30 guarded files' production-consumed exports | 224 | **180** |
| measurable mutants landing on them | 178 | 178 |
| **ratio** | 0.79 per export | ⭐ **0.99 per export** |
| guarded files already at ≥1 per production-consumed export | 14 of 30 | **20 of 30** |
| guarded files still in debt, owing | 16, owing 91 | **10, owing 67** |
| **TOTAL obligation** | 268 *(ledger → 506)* | ⭐ **194 new mutants — the ledger goes 238 → 432** |

⚠⚠ **A RATIO THAT LANDS ON 0.99 IMMEDIATELY AFTER A DEFINITIONAL CHANGE IS EXACTLY THE RESULT THAT SHOULD BE
DISBELIEVED**, because the redefinition shrank the denominator and a convenient number is what that would
produce. ⭑ So it was disaggregated before being used, and the aggregate survives the test this whole document
exists to apply:

| | |
| --- | --- |
| aggregate ratio | 0.99 |
| ⭐ **MEDIAN per-file ratio** | **1.00** |
| concentration check — mutants held by the top 5 guarded files | 88 of 178 |

**THE MEDIAN AGREEING WITH THE MEAN IS THE EVIDENCE.** Concentration is real — five files hold half the ledger —
and the median still sits at exactly one mutant per production-consumed export. ⭑ **So "one mutant per
production-consumed export" is not an invented target: it is the standard the guarded population already meets at
the median, stated as a rule.** That is the strongest form a floor can take here — DERIVED from what good
practice in this repository already looks like, rather than chosen.

⚠ **AND THE 50 TEST-ONLY EXPORTS ARE NOT SWEPT INTO THAT.** An export whose only importer is its own test makes
no promise to the system; obliging a guard for it would manufacture exactly the token the sponsor rejected. They
are excluded from the obligation and **recorded as a question of their own** — together with the 45 that nothing
imports at all, that is 94 of 215 exports on the unguarded files whose consumer is not production code.

⚠ **THE 45/50 SPLIT ABOVE IS STRUCK BECAUSE THE EXTRACTOR THAT PRODUCED IT WAS WRONG** — it followed barrels only
for bare `@janumipwb/*` specifiers, so a RELATIVE import of a package’s own `./index.js` was attributed to
`index.ts` rather than the defining file. Caught when `governance.test.ts` turned out to import `canPromoteBaseline`
**14 times** while the census said it had no test importer. ⭐ **The obligation headline did not move; the
dead-surface finding halved.** ⚠ And the totals here are DERIVED — Phase 0 moves files between the guarded and
unguarded populations as it lands, so the baseline is regenerated by its writer (`S3.1`), never quoted from here.

⛔ **AND THE 194 IS AN AUTHORING COST, NOT A RUNTIME ONE.** At ~4s per mutant the full new set runs in ~13
minutes; nothing about the gate's speed is the constraint. The cost is declaring each one and naming the victim
test that must redden — cheap where a discriminating test already exists, and **where none does, the "cost" IS
the finding the programme exists to surface.**

---

## 5. What must NOT happen

- ⛔ **The global coverage floors do not move.** 95 / 83 / 96.5 / 97, `autoUpdate: false`. All three ratchets ADD.
- ⛔ **R3's criterion is NOT lowered to make today's population pass it.** The moment "one per consumed export"
  becomes "0.99 per production-consumed export" because that is what we happen to have, it stops being a floor and becomes a
  description. ⭑ If 194 is too much, the answer is a longer horizon or a narrower population — **never a
  criterion reverse-engineered from the current number.** That is the defect `REG-D-013` records as
  *guarantee-strength over economy*.
- ⛔ **A declared mutant may never be chosen because it is easy to kill.** The unit is the consumed export, and
  the mutation must attack what that export PROMISES its consumers. A mutant sited for convenience satisfies R3's
  count while leaving the promise untested — which is the token defect the sponsor rejected, relocated one level
  down and harder to see.
- ⛔ **Neither baseline is tightened as part of introducing it.** The 24 weak files and the 64 unmutated ones are
  recorded where they are and frozen. Introducing a ratchet and demanding new work in one act makes a failure
  attributable to neither.
- ⛔ **No exemption list.** An exemption is where a weak file lives permanently.
- ⛔ **Neither baseline is ever hand-edited** — each is regenerated by its own writer in the same commit as the
  change that moved it, as `csaa:inventory`'s was and `slices:ledger` is.
- ⚠ **Each limb is proven by an OBSERVED RED before it is trusted**, including the reader-blinded case: a
  checker that treats a missing input as success is the control-that-cannot-fail this repository keeps recording.

- ⭑ **2026-10-26 — the export census's check now refuses a stale record, `43342bea` (`REG-F-470`)** (`floor-facts.md`; `REG-D-138` (3)). Section 5's rule is that *"each is regenerated by its own writer in the same commit as the change that moved it, as `csaa:inventory`'s was and `slices:ledger` is."* The third limb, `CENSUS_STALE`, refuses an unrecorded gained guard or a moved unattributed count. Its pin moved with red-first evidence. The coverage floor's permitted unrecorded fall is `REG-F-586`; whether its check should acquire a record limb remains a sponsor question.

---

## 6. Open questions for the sponsor

⚠ **THE FIRST QUESTION IS THE ONE THAT SHOULD BE ANSWERED BY A MEASUREMENT RATHER THAN A PREFERENCE, AND THE
MEASUREMENT HAS NOT BEEN RUN.**

1. ✅ **RUN THE PILOT BEFORE COMMITTING TO 194? — RUN, AND ANSWERED IN §7.** The entire case
   for `R3` rests on a claim this programme has never tested here — *covered is not asserted*. 1,439
   covered-but-unproven branches is a **hypothesis about risk, not a finding.** Declaring the 9 consumed exports
   of `governance.ts` and the 7 of `assurance-rules.ts` as mutants — 16 mutants, ~1 minute of runtime, on a
   disposable copy — converts it to a number:
   - if most are **KILLED**, the 194 is bookkeeping and should be paced slowly over a long horizon;
   - if many **SURVIVE**, each survivor is an untested guarantee in the domain kernel, and the horizon is short.
   ⛔ **Recommending a 194-item programme without this is advising from an untested remedy**, which is the
   failure this repository has recorded often enough to name.
2. **Is R3's criterion right, given it indicts 10 of the 30 GUARDED files?** Options: accept it and carry the 67
   as part of the debt; or scope R3 to the unguarded 64 first and let the guarded shortfall follow. Recommended:
   **accept it, and record the 67 openly** — a criterion applied to one population and not its neighbour is how
   an exemption list starts.
3. **R2's remote case — build the test→code map, or disclose the gap?** Catching *"changed `A`, broke `B`'s
   guard"* needs per-test coverage attribution JPWB does not collect. Recommended: **disclose it in R2's first
   increment and scope it as its own question**, because a guarantee described as catching what it cannot catch
   is worse than an absent one.
   - ⭑ **2026-10-30 — ANSWERED by `REG-D-139` and `§10`.** (`REG-D-139` (2); `§10.3` D1; `§10.4`; `ROADMAP-per-file-assurance-floor.md` `§7`). The sponsor approved a reach limb. It is neither the test→code map nor a disclosure alone. `§10` designs it as a static reach, computed at the tree being judged (D1). Its build is owed. When built, the remote case is SELECTABLE but by default LISTED, NOT RUN. It is not closed.
4. **On what horizon does the 194 get worked off, and does anything else pause for it?** ⚠ The ratchets FREEZE;
   they reduce nothing. **Four debts now exist** — ~580 uncovered branches, the 194 export-guard mutants,
   CSAA's 74 structural test failures, and R2's remote case — **and none substitutes for another.**
5. **One programme or three?** Recommended: **one design, three roadmap phases**, so `R3` cannot quietly drop
   once `R1` lands and the coverage number looks better.

---

## 7. ⭐ THE PILOT RAN. The hypothesis survives, and it found two real holes

**PROTOCOL.** 16 mutants — one per production-consumed value export of the two largest unguarded files
(`governance.ts` 9, `assurance-rules.ts` 7). Each attacks what that export PROMISES its consumers, per `§5`,
not whatever was easiest to break. All 16 passed PREFLIGHT (anchored exactly once, typechecked) before any test
ran. Entries were spliced into the ledger for the run and **removed afterwards — the ledger is back at 254.**

| | |
| --- | --- |
| ⭐ **KILLED** | **14 of 16** |
| ⛔ **SURVIVED** | **2 of 16** |
| total subprocess time | **80.9s** (targeted vitest 40.9s, victim baselines 20.5s, tsc 19.5s) |

**⚠ THE TWO SURVIVORS WERE NOT REPORTED AS FINDINGS UNTIL THEY WERE RE-TESTED, BECAUSE BOTH CAME FROM THE FOUR
ENTRIES WHOSE VICTIM I HAD TO INFER.** A SURVIVED there is ambiguous between *nothing tests this* and *I named
the wrong test*, and reporting the first reading without excluding the second is the recorded failure shape.

**⛔⛔ AND THE FIRST TWO ATTEMPTS TO EXCLUDE IT WERE THEMSELVES INVALID. THIS IS RECORDED IN FULL, BECAUSE THE
CONCLUSION DID NOT CHANGE AND THAT IS EXACTLY WHEN A BAD INSTRUMENT SURVIVES UNNOTICED.**

| attempt | what it reported | ⛔ why it was worthless |
| --- | --- | --- |
| 1 · `bun run test` | 358 files pass with the mutation applied | **the mutation was never in the code under test.** Turbo reported `rph-contracts:build: cache hit` with the file modified, and the arm that ran is `vitest.dist.config.ts`, which carries NO alias by design and reads `dist` |
| 2 · `bunx vitest run --reporter=basic` | *GENUINE SURVIVOR* × 3 | **no suite ran at all** — the reporter flag was removed in vitest 4, so every run died at startup. My script printed verdicts anyway |

⭐ **THE SECOND FAILURE IS THE INSTRUCTIVE ONE: a baseline that cannot start returns the SAME answer as a mutation
nothing catches.** The control was failing exactly like its subject, and the only reason it was caught is that the
baseline printed `NO SUMMARY LINE` where a count belonged. The probe now REFUSES to emit a verdict unless the
baseline demonstrably executed a suite.

**✅ THE VALID MEASUREMENT, third attempt** — `bunx vitest run` against the ROOT config, whose `resolve.alias` maps
every `@janumipwb/*` specifier to `src`, which is the resolution `scripts/mutants/run.ts` uses and the reason that
runner's verdicts were never in doubt:

| | baseline | PILOT-01 | PILOT-10 | PILOT2-04 |
| --- | --- | --- | --- | --- |
| suite executed | ✅ 358 files / 3,614 passed | ✅ 358 / 3,614 | ✅ 358 / 3,614 | ✅ 358 / 3,614 |
| exit | 0 | 0 | 0 | 0 |
| **new failures vs baseline** | — | ⛔ **NONE** | ⛔ **NONE** | ⛔ **NONE** |

⭐ **AND THE POSITIVE CONTROL IS AVAILABLE WITHOUT EXTRA WORK:** other mutations in these same three files
— `PILOT-02`…`PILOT-07` in `assurance-rules.ts`, `PILOT-08`/`09`/`11`–`16` in `governance.ts`, two `PILOT2-04`
siblings in `errors.ts` — were all KILLED through the same resolution path. So the path demonstrably reaches these
files, and a clean pass here means the suite saw the mutation and had nothing to say about it.

### ⛔ THE TWO CONFIRMED HOLES

**1. `BLOCKING_SEVERITIES` can silently lose `CRITICAL`** (`rph-assurance/src/assurance-rules.ts`). The set exists
so a criterion's ratified `severityIfNotMet` gets the SAME answer the disposition ladder gives instead of each
caller re-deciding. Remove `'CRITICAL'` and an open critical finding stops blocking for every caller that asks
the set — `handlers/assurance.ts`, `handlers/reject-authorization.ts`, `validators.ts`. **Nothing reddens.**

**2. `canPromoteBaseline` can drop its authority requirement** (`rph-domain/src/governance.ts`). RPH-BAS-006
requires an effective, AUTHORITY-BACKED promotion decision. Delete the `d.authorityHeld` conjunct and a baseline
promotes on an unbacked decision. **Nothing reddens.**

⭐ **BOTH FILES ARE WELL COVERED** — `governance.ts` at 95.31% branches, `assurance-rules.ts` at 85.34%.
**That is the entire thesis of this document, demonstrated rather than argued:** coverage counted the execution
of these lines and had nothing to say about whether anything asserts them.

### What the rate means for the 194 — and why it is an OPTIMISTIC reading

A 14/16 kill rate says the unguarded files are **largely** asserted: most of the 194 would be confirmation,
cheap to declare, with a real-gap rate near **one in eight**. Extrapolated, the 127 unguarded-file obligations
would surface **roughly 16 untested guarantees**.

⚠ **BUT THE SAMPLE IS BIASED TOWARD THE ANSWER IT GAVE, AND THAT IS STATED RATHER THAN BURIED.** These are the
two LARGEST and most central unguarded files — the domain kernel and the assurance rules. They are the files
most likely to be well tested. A peripheral file's kill rate cannot be assumed equal to theirs, so **14/16 is a
CEILING on the expected rate, not an estimate of it.** The programme should not be paced as though 87.5% holds
everywhere until a second sample, drawn from the small and peripheral end, says so.

### Two things the pilot taught about R3's mechanism

- ⚠ **A mutation in a file BREAKS THAT FILE'S OWN LEDGER ANCHORS**, so `verif/mutant-ledger.test.ts` reddens on
  any whole-suite mutation run. Harmless for a targeted run, but R3's design must not read that failure as a
  guard — it is the instrument observing itself.
- ⭐ **The measurement cost nothing like the fear.** 16 mutants, 81 seconds. The 194 is ~13 minutes of machine
  time. The constraint was only ever authoring.

---

## 8. ⭐ SAMPLE 2 — THE PERIPHERAL END. My own caveat was tested, and it did not hold

`§7` closed by warning that 14/16 was a **CEILING**, because the two files sampled were the largest and most
central unguarded files. ⛔ **That warning was a hypothesis, and hypotheses in this programme get measured.**

**PROTOCOL.** 16 mutants — one per production-consumed export of **six SMALL, PERIPHERAL unguarded files**:
`floor-policies.ts`, `catalog.ts` (authoring), `schema.ts` (persistence), `errors.ts` (contracts),
`execution-failure-taxonomy.ts`, `leaf.ts`. Branch counts of 2–9, against sample 1's 128 and 116. Authored by six
parallel agents, one per file, each instructed to attack the export's PROMISE and forbidden to pick a mutation
for being easy to kill.

⭑ **EVERY ENTRY WAS RE-VERIFIED AGAINST THE REAL FILE BEFORE IT WAS TRUSTED** — anchor occurs exactly once,
`find` ≠ `replace`, victim exists on disk. **16 of 16 passed; 0 rejected.** Then PREFLIGHT: 16 applicable, 0
rotted, 0 type-prevented.

| | sample 1 — CENTRAL | ⭐ sample 2 — PERIPHERAL |
| --- | --- | --- |
| files | 2 (128 + 116 branches) | 6 (2–9 branches each) |
| mutants | 16 | 16 |
| **KILLED** | 14 | ⭐ **15** |
| **SURVIVED** | 2 | **1** |
| kill rate | 87.5% | ⭐ **93.75%** |
| subprocess time | 80.9s | 89.5s |

⭐⭐ **THE PERIPHERAL FILES ARE NOT WORSE GUARDED. THEY ARE MARGINALLY BETTER.** The concern I raised — and
raised as a reason to slow the programme down — **is refuted by the measurement taken to test it.** Combined:
**29 of 32 killed, 90.6%**, across files spanning 2 to 128 branches and seven packages.

### ⚠ AND A CHEAP PROXY I MIGHT HAVE RELIED ON IS REFUTED WITH IT

Before running, sample 2 looked WEAKER on the obvious indicator: **6 of its 16 exports had no test file importing
them at all**, against 4 of 16 in sample 1. That indicator predicted nothing.

| | |
| --- | --- |
| sample 2 mutants whose victim had to be INFERRED (no test imports the export) | 6 |
| ⭐ of those, **KILLED** | **6 of 6** |
| the single survivor's victim | **directly evidenced, not inferred** |

⛔ **SO "NO TEST IMPORTS THIS EXPORT" IS NOT A PREDICTOR OF "NOTHING GUARDS IT".** Indirect tests — the handler
suites, the seeding suites, the round-trip suites — catch these mutations comfortably. ⭑ Any attempt to rank R3's
burn-down by that proxy would have prioritised exactly the wrong files, and the only reason it did not is that
the proxy was measured rather than assumed.

### What this settles for Phase 3's pacing

⭐ **The 194 is predominantly CONFIRMATION, and it may be paced broadly** — many files per increment — because
the rate holds at both ends of the size distribution rather than only at the well-tended centre. The real-gap
rate across 32 authored mutations is **3 in 32, under 10%**, projecting **roughly 18 genuine untested guarantees
across the full 194**. ⚠ That projection is now supported at both ends of the population instead of one, which is
the only reason it is offered as an estimate at all.

---

## 9. ⛔ THE UNIT'S CENTRAL JUSTIFICATION IS REFUTED — by the attribution the programme built to enforce it

`§4`'s `R3` rested on one claim: that *"one guard per production-consumed export"* is a **DERIVED standard the
guarded population already meets**, evidenced by 0.97 mutants per consumed export with a **median per-file ratio
of 1.00**. Mean and median agreeing was stated as the warrant.

⛔ **THAT EVIDENCE WAS AN ARTEFACT OF ITS OWN ARITHMETIC.** It divided a per-FILE mutant COUNT by a per-EXPORT
denominator, so a file carrying six mutants on ONE export scored 1.00 across six promises. Re-measured with every
guard ATTRIBUTED to the export whose declaration its anchor sits in:

| | as claimed | ⭐ attributed |
| --- | --- | --- |
| consumed exports guarded | 0.97 per export | **111 of 331 — 0.34** |
| MEDIAN per-file fraction guarded | 1.00 | ⛔ **0.06** |
| files fully guarded | — | **29 of 91** |
| files with NO guarded export | — | **45** |
| ⛔ mutants crediting NO export at all | — | **58** |
| outstanding obligation | 156 | ⭐ **220** |

⚠ **SO THE UNIT IS AN ASPIRATION, NOT A DESCRIPTION OF CURRENT PRACTICE.** ⭑ The unit itself SURVIVES — it is
relational, and what a file owes the system still flows through what other modules import from it. What does not
survive is the sentence claiming the repository was already there. `scripts/export-guard.ts`'s header carries the
correction struck in place, so a reader cannot meet the old warrant without meeting its retraction.

**⛔ AND THE DISAGGREGATION THAT WAS SUPPOSED TO CATCH THIS FAILED FOR A NAMEABLE REASON.** `§8` recorded
suspicion of a ratio landing on 1.00 immediately after a definitional change, and answered it by comparing the
MEDIAN against the MEAN. ⭐ **Both were computed from the same contaminated numerator, so they agreed with each
other while both were wrong.** A median only tests whether an aggregate hides its members; it cannot test whether
the quantity being aggregated is the right quantity. ⚠ The lesson is narrower and sharper than "disaggregate":
**a cross-check must vary the thing under suspicion.** Varying the summary statistic while holding the numerator
fixed tests nothing about the numerator.

**THE 58 THAT CREDIT NOTHING ARE A FINDING OF THEIR OWN.** They are real mutants over real behaviour, anchored in
module-level code and private helpers rather than inside any exported declaration — `handlers/execution.ts` alone
has 17, verified by intersecting their anchors against its 17 export spans. ⭑ They are RECORDED and they credit
nothing, because nothing says which promise they defend and crediting them to a neighbour would restore the
fungibility this correction removed.

**⚠ AND TWO PUBLISHED CLAIMS ARE CORRECTED WITH IT.** "Six of ten packages at zero" was computed on the fungible
basis. On the attributed one: `rph-authoring`, `rph-ports` and `rph-persistence` are **truly at zero**;
`rph-assurance` owes **1**, `rph-contracts` **2**, `rph-product-realization-pwa` **1**. The burn-down's landed
work is real — every declared guard was KILLED — but the *coverage* it achieved was overstated.

---

## 10. REV 3 — R2's remote case: a REACH limb for `mutants:changed`, and the one-time measurement of the whole ledger

**REV 3 (2026-10-29) — WHAT THE SPONSOR APPROVED.** The lead offered: *"**For you, no rush:** a one-time
measurement of all 4,015 ledger entries, plus a scope rule that catches this kind of change automatically. I'm
offering it as a separate programme rather than doing it before P6, because P6's own checks are already covered."*
The sponsor: *"The one-time measurement and the scope rule are approved."* (`REG-D-139`.) The lead's record glosses
"this kind of change" as *"a change to a file a guard's test reaches, which leaves a guard anchored elsewhere slack"*.
Since then the lead holds the paid measurement until class R's 1,724 entries are measured clean (`REG-D-138` (9),
`REG-D-139` (3)).

⭑ This section answers `§6` Q3. It is a design: no part of the scope rule is built. The one-time measurement is
running now (2026-10-29/30), with the existing runner.

⛔ This section lands on `f6b78109` or a descendant, which wrote `REG-D-138`, `REG-D-139`, `REG-F-584` and `REG-F-585`:
`verif/register-citations.test.ts` walks `docs/` and requires each cited `REG-` id to resolve to a heading in
`docs/canon` (`:65`).

---

### 10.1 · What happened, and why the local rule could not see it

**`REG-F-584`.** Package D's B7 (`ddd75ae9`, 2026-10-24) removed the graph framing's probes from
`scripts/reviewer-qual/probes.ts`. Four entries are anchored in
`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts`: `PQ1-M1751`, `PQ1-M1752`, `PQ1-M1759` and
`PQ1-M1760`. Their one victim is `verif/reviewer-qualification-fingerprint.test.ts`, which imports the probes:
`} from '../scripts/reviewer-qual/probes.js';` sits at line 150 before B7, line 152 after it, and line 157 at
`d7a363b0`.

- **Measured:** the runner's logs that were searched record the four KILLED last on 2026-10-09 and SURVIVED next on
  2026-10-28, and each SURVIVED again alone at `bb53326d` (`Tests  235 passed (235)`). They were reached then only
  because both sides of the integration of O, O-2 and V had changed the victim file (the merge scope's reason (d),
  `int2-facts.md`).
- **Attributed, by reasoning and `git log -S`, not measured:** that B7 made them slack, because the victim saw their
  mutations only through the removed probes. The transition that would make it a measurement, KILLED at
  `ddd75ae9^` and SURVIVED at `ddd75ae9`, is owed (`§10.9`). `REG-F-584`'s heading already states this cause.

`c2c71020` retired them, each superseded by its part-framing form, `P6X-INT2-M3` to `M6`.

Today's tool, run read-only at `d7a363b0` over B7's own commit (`--range=ddd75ae9^..ddd75ae9`), printed exactly two
lines and exited 0 (`scope-b7.out`):

```
mutants:changed — 360 changed hunk(s), 0 in production source.
mutants:changed — NO PRODUCTION CHANGES EXAMINED. This is not a pass: there was nothing to decide.
```

⛔ **IT DID NOT PRINT ITS LIMIT.** The banner is at `scope.ts:202-206`. Three exits come before it, at `:92`, `:125`
and `:133`, and `:133` is B7's path. `scope.ts:37` says *"the banner prints every time"*; `ROADMAP §3` S2.5 says
*"The command must SAY this every run."* Neither held for B7.

⚠ **AND B7 WAS NOT EXAMINED AT ALL.** `isProductionPath` (`scope-core.ts:71-72`) keeps only hunks in a `.ts`, `.tsx`
or `.svelte` file under `packages/` or `apps/` that is not a `.test.ts` or `.spec.ts` file. B7 changed 22 files: 3
under `docs/`, 11 under `scripts/`, 8 under `verif/`. The filter also hides more than the remote case. At `d7a363b0`,
1,431 of 3,907 live entries are anchored where it discards hunks (`scripts/` 1,230, `verif/` 194, 5 in test files
under `packages/` and `apps/`, 2 in the root vitest configs); at `c603fb69`, 1,502 of 4,035 (`REG-F-584`). They can
never be selected, even when their own anchor line changes. 157 of them are in `probes.ts`. Before this section,
neither this design nor its roadmap stated the filter: `S2.1` says *"return the mutant ids whose anchor
range intersects a changed hunk, and the changed hunks that intersect NO anchor."*

**THE OTHER DEFECTS A REACH LIMB WOULD INHERIT**, each measured by the scratch readers (files by base name):

| defect | measured |
| --- | --- |
| the runner is called once with `shell: true` (`scope.ts:162-166`) | a shell call fails near 8,191 characters: 164 real ids (8,175 characters, counted before the shell's own wrapper) returned `The command line is too long.`, and 160 (7,941) ran. The count moves with the paths in the command (`shell-limit.out`) |
| ⛔ a shell splits an id that holds spaces | 60 of 3,987 declared ids (49 live) hold whitespace. Under `shell: true`, `WP11-M1 restore the tautology: explicitNoOutput: !hasOutput` arrives as six arguments, and `run.ts`'s substring filter would read them as filters selecting 2,536 of 3,987 entries (`shellmeta.out`, Bun 1.3.14 on this host) |
| ⛔ a shell OBEYS an id that holds `>` | 3 live ids hold `>`. Under `shell: true`, `WP11-M7 zero-subject floor never fires (aiProduced -> false)` sent the child's stdout into a new file named `false)` in the working folder, which for `scope.ts` is the package root. The file held the arguments that did arrive, `-` among them, and `-` selects 3,987 of 3,987 ids. `WP12A-M3 the >=1-SUCCEEDED limb ...` wrote a file named `1-SUCCEEDED`; its fragments select 3,194. All 3 are anchored in production source (`rph-application`'s `floor-gate.ts`, `rph-domain`'s `execution.ts`), so today's LOCAL can select them. 1 live id holds backticks, which a POSIX shell would run. With no shell, 60 of 60 ids arrive as one argument each, as they do through `bun run <package script> -- <id>`, the lanes' form (`shellmeta.out`) |
| the runner selects by substring (`run.ts:1080`) | `MU-PFA-AF3-DEFAULT_CONTEXT_ASSEMBLY_POLICY` also selects the live `..._POLICY_ID` |
| the classifier reads the exit status (`scope-core.ts:99`) | a run whose only failures are `INCONCLUSIVE`, `NO_COMPILE` or `KILLED_UNNAMED` is called BROKEN GUARANTEE, and `scope.ts:195` then prints *"The suite is green and the protection is gone"*; a `SURVIVED` run under `MUTANTS_ADVISORY=1` is called OK (`core-fixtures.ts`) |
| `--range` locates anchors in the working tree | the selection differed from the commit's own text in 11 of 13 recent commits with production hunks (`range-anchor.out`) |
| `parseUnifiedDiff` (`scope-core.ts:30-47`) | an added line beginning `++ ` is read as a file header; a deleted file and a rename's old path contribute nothing (`tmp-diff.txt`) |
| the change set is read through `spawnSync`'s default buffer (`scope.ts:89`) | a diff over 1,048,576 bytes ends the run: `--range=91ec502d..8a703e2a` (1,753,193 bytes) exits 2 at `:92` with `mutants:changed — git diff failed: ` and no reason (`ENOBUFS`); B7's 992,554 bytes passed under it (`spawn-replica.out`, `buffer-pin.out`; the byte counts, `diffbytes.out`) |
| the runner given no id (`run.ts:1079-1081`) | `only.length > 0 ? … : DECLARED_MUTANTS`: a call with no id measures the whole ledger. The one-time run's check found a lane that lost a chunk claim would do exactly that (`c1-facts.md`) |
| exit codes (`scope.ts:145-208`) | the last assignment wins: under `--strict --run`, an unguarded change beside a broken guarantee exits 1, never 3, by the order of the code rather than a stated rule; both messages print, and no test pins the order |
| flags (`scope.ts:58-62`) | there is no unknown-flag check; `--range A..B` with a space silently diffs `HEAD` |

---

### 10.2 · What a test reaches in this repository, measured

At `d7a363b0` the ledger holds 3,987 entries, 3,907 live, over 391 victim files. 0 entries name more than one victim.
A victim's verdict can depend on a file in more ways than a static import:

| how | victims (of 391) | source |
| --- | --- | --- |
| spawn a process themselves | 18; and 44 reach one of 5 imported modules that spawn | `census.mjs` |
| call an fs read API | 80, at 424 sites; 57 hold a read the read classifier sends to a repository path, and 76 a read it does not send to a temp path | `classify-reads.mjs`, `reads-classified-victims.json` |
| read the register or `docs/canon` by path | 8, holding 472 live entries; the list's ninth, `e2e-005-contested-assurance.slice.test.ts` (1), names the register only in comments | `register-readers.txt` |
| run git | 2 themselves; 5 more reach a module that does, `scripts/reviewer-qual/check.ts:97` or `scripts/reviewer-qual/run.ts:304`, by the scanner's reach | `summary.txt`, `head.reach-strict.json` |
| Playwright specs, which reach the app over HTTP | 25, holding 137 live entries; 125 of the 137 anchors lie outside the spec's own import closure, type-only imports kept or not, and 124 lie outside the esbuild prototype's reach for a spec, which adds the closures of `playwright.config.ts` and its global setup and teardown files: the 125th, the control `S3-CONTROL-e2e-victim-is-actually-run`, anchored in `packages/rph-domain/src/enforcement-register.ts`, is reached only through those files. 125 of the 125 lie inside the app its server serves, taken as the prototype's app reach, the 234-file closure of the app's route modules (it has no hooks file); 120 of them are under `apps/rph-demo/src/` | `dist-head.json` (`distribution.mjs`) for the 124; the 125 and the app counts derived from its `outsideIds`, `head.graph.json`, `head.scan.json` and `head.meta.json`'s `appReach` (`pw-anchor.out`, `pw-r1.out`, `pw_src.out`), which no prototype output records |
| a setup file reads source as text | `verif/draft-dependency-premises.ts:33` reads `authoring-turn.ts` for 301 package and app victims; 49 of them import it | `closure.json` |
| a spawned script outside the victim's own closure | 9 of the 15 spawned-script pairs checked | `spawned.mjs` |

**THE STATIC REACH, AS THE SCRATCH SCANNER MEASURED IT** (`scan.mjs`, `reach.mjs`; TypeScript 5.9.3; 997 of 1,896
tracked files parsed):

| | |
| --- | --- |
| distinct opaque sites (a path the scanner could not fold) | 390, in 107 files; plus 22 unresolved specifiers in 22 files |
| victims WIDE (an opaque site in their reach) | **144 of 391, holding 2,736 of 3,907 live entries**; 25 of 25 Playwright victims among them |
| counting test-side sites only | 62 of 391 victims, 2,030 entries; 1 of 25 Playwright victims. The other 24 are WIDE only through 18 sites in 4 production modules |
| non-WIDE reach size | 247 victims; min 3, median 117, max 148 files |
| the fingerprint test's reach | 163 files and 4 folders, `scripts/reviewer-qual/probes.ts` among the files |

⛔ **AND THE SCANNER THAT PRODUCED THOSE FIGURES IS WRONG IN A NAMEABLE PLACE.** 27 of 3,896 named-victim live entries
are anchored outside their victim's scratch reach (`blind.mjs`). 21 of them belong to WIDE victims, so WIDE covers
them. 6 belong to 2 victims that are not WIDE: `MU-PFA-R1-A` to `-E` (victim `verif/coverage-floor.test.ts`) and
`MU-PFA-R3-L` (victim `verif/export-guard.test.ts`). Both victims spawn the script their entries mutate. The scanner
folded `` `${ROOT}scripts/coverage-floor.ts` ``, with `ROOT = fileURLToPath(new URL('..', import.meta.url))`, to
`verif/..scripts/coverage-floor.ts`, a path that names nothing, and classified it as a seen absent file. 23 folded
paths in 9 `verif/` files are mis-joined this way, 23 of 23 classified absent (`misjoin.out`); 3 of the 9 files are
victims, none of them WIDE. ⭑ So the scratch figures under-select for those 3 victims, and a wrong fold rule did
under-select with no red. That is the risk `D21` and `D22` exist to measure. The scanner also leaves type-only
imports out of the reach (it keeps them apart as type edges, `scan.mjs:10`), where `D3` keeps them: its file list
for the fingerprint test omits `process-run-observer.ts`, which the test imports only with `import type` (line 124);
a folder in that reach covers it there. So the WIDE figures may move when the built tool keeps those edges. The
static-reach table and the BLIND counts above are scratch figures, to be re-measured by the built tool at `d7a363b0`,
the tree they name, again at `W`, and at roadmap `S4.8`'s own tree, the one of the three that holds `scope-run.ts`
(`D19`); the first table's census stands as scratch, each row naming its source.

---

### 10.3 · The decisions

1. **D1 — reach is static and computed on the fly, at the tree being judged; no reach is stored.** Three scratch
   implementations built it at `d7a363b0`: the TypeScript walk in 1.4 s (`tsreach-head.json`), esbuild in 4.1 s
   (`head.meta.json`), and the scanner in 3.5-3.7 s over two runs, as the agent that ran it reported; no retained
   output holds that time, since the scanner records none. A stored reach would change with each commit that changes
   an import or a read path; its per-victim form took 2.15 MB. It would need regeneration after each merge, because
   derived artifacts are *"regenerated, never trusted as auto-merged"* (`9919983c`). A stale record under-selects with
   no message. A past tree's reach costs an extraction from git objects, then the walk. Timed on trees already on
   disk, the TypeScript walk took 1.5-3.2 s at 3 past commits (`tsreach-<sha>.json`) and esbuild 11.5-13.2 s at 6
   (`<sha>.meta.json`). One extraction was timed, `git archive` of `packages`, `apps`, `scripts`, `verif`,
   `vitest.config.ts` and `vitest.projects.ts` at `7e8725ba`: 2.1 s for 36 MB, as the agent that ran it reported; no
   retained output holds that time.
2. **D2 — the parser is TypeScript 5.9.3, the pinned direct devDependency; resolution is read from the runner's own
   config.** `WORKSPACE_ALIAS` (`vitest.config.ts:74-77`), the app projects' `$lib` alias and the setup files
   (`vitest.config.ts:97`; `vitest.projects.ts:111, 148`) are read at run time from what those files already export,
   `vitest.config.ts`'s default export and `projectsFor(true)`, never restated. At a range end other than the working
   tree they are the end's own (`D14`): `projectsFor(true)` lists the folders beside its own file, so the end's tree
   is written to a temporary folder from which `vitest/config` resolves, and both files are imported there. Neither
   file gains an export: both are GLOBAL (`D8`). The runner grades a vitest victim with
   `bunx vitest run --retry=1 <victim>` under the root config, so that config is the definition of what a test loads.
   esbuild arrives only transitively (0.28.1).
3. **D3 — an entry's reach is the union of seven parts.** For entry `e` with victim `V`:
   - **RP0** `e`'s own anchor file, at file level.
   - **RP1** `V`'s import closure, in any form: import and export declarations, `import('<literal>')`,
     `vi.mock`/`vi.doMock`/`vi.importActual` with a literal, `require('<literal>')`, and `.svelte` script blocks.
     Type-only imports are KEPT: the TypeScript walk that keeps them contains esbuild's runtime reach for 391 of 391
     victims, so soundness does not rest on the test transform eliding what esbuild elides. Keeping them cost at most
     5.9 h over the 60-commit model below (0.6%), the walk's whole excess over esbuild's reach. SvelteKit's generated
     `./$types` is the one exception (`D4`).
   - **RP2** the setup files of `V`'s project and their closures: `verif/live-backend-isolation-setup.ts` for each
     vitest victim; package and app victims add `verif/unread-refusal-guard.ts`, `verif/emitted-event-guard.ts` and
     `verif/draft-dependency-premises.ts`.
   - **RP3** the files and folders that code reads, lists, stats, copies or watches, where the scanner folds the path
     argument to a tracked file or folder (`D5`). A folder also covers files later added under it. A path that folds
     to a temp root (`tmpdir()`, `mkdtemp*`) is not a repository path.
   - **RP4** the scripts that code runs. Each argv element that folds to a tracked code file becomes another root of
     RP1-RP3. A `bun --eval` string is scanned for literal specifiers. A spawn of vitest or Playwright adds the
     whole-suite union (RP6).
   - **RP5** for a Playwright victim: the folders `apps/rph-demo/src/` and `apps/rph-demo/static/` and the closures of
     the code under them; the closures of `apps/rph-demo/playwright.config.ts` and its global setup and teardown; the
     app's `vite.config.ts` and `svelte.config.js`. Folders, so `app.html`, `static/theme-init.js` and
     `$lib/styles/theme.css` are inside it.
   - **RP6** for a whole-suite control (an empty `expectRed`): the union of RP1-RP4 over each vitest test file the root
     config's projects include (`csaa` excluded, as `run.ts:342-357` runs it). A `.svelte` entry also reaches the
     app's `svelte.config.js`, which its compile leg reads.
4. **D4 — WIDE is the conservative default for what the scanner cannot bound.** A file holds an OPAQUE site when it
   holds any of: (a) a read, list, stat, copy, watch, spawn or `import()` whose path does not fold to a file, a folder
   or a temp root; (b) a spawn whose argv element or `cwd` folds to a pure hole — a hole is opaque, never skipped
   (`scripts/gate-tail.ts:47` runs `step.script`, which is a hole); (c) a git call whose `cwd` does not fold to a temp
   root; (d) an access to `node:fs`, `node:fs/promises` or `node:child_process` (or their bare names), `Bun.spawn`,
   `Bun.spawnSync` or `Bun.file` in a form the scanner does not model — `scripts/reviewer-qual/check.ts:90-93` gets
   `spawnSync`, `existsSync`, `readdirSync` and `readFileSync` by destructuring `await Promise.all([import(...)])`,
   and the scratch scan recorded no site in that file at all; (e) an unresolved local specifier, except `./$types`
   (below); (f) a fold `D5` cannot bound; (g) a folded path that names no tracked file and whose parent folder is
   untracked. ⚠ **`./$types` IS CLASSIFIED BY NAME, NOT LEFT TO (e).** 18 route files import SvelteKit's generated
   route types, each with `import type` (for example `apps/rph-demo/src/routes/+page.server.ts:5`), and the types are
   generated into the gitignored `.svelte-kit/`. The TypeScript walk left 9 relative specifiers unresolved, and 9 of
   the 9 are `./$types` (`tswalk-head.json`). Under (e) each would make every victim that reaches a route WIDE. So an
   `import type` of `./$types` from a file under `apps/rph-demo/src/routes/` is generated output: not followed, not
   opaque, and disclosed under the banner's *"Not seen at all"* (`§10.4`). Any other import of it, or a value import,
   stays under (e). A victim is WIDE when any file of its reach holds an opaque site. Any non-empty change selects a
   WIDE victim's entries, each carrying the first site that made it WIDE, or, for a victim widened by BLIND (`D21`), its
   BLIND entry and that entry's anchor file in place of a site. Apart from the `./$types` rule, a WIDE is
   removed only by making that site foldable, never by a list (`§5`: *"No exemption list."*).
5. **D5 — the fold.** A path expression folds to alternatives of literal parts and holes. It follows string and
   template literals and `+`; block-scoped `const` bindings found by walking up the enclosing blocks; a `let` as the
   union of its assignments; imported string constants through `export const` and `export ... from`; `new URL(x,
   import.meta.url)` with WHATWG resolution (so `new URL('..', import.meta.url)` names the parent folder WITH its
   trailing slash), `import.meta.dirname`, `fileURLToPath`, `pathToFileURL(...).href`, `dirname`, `join`,
   `resolve`, `realpathSync`; a `.replace` that only normalises separators; a local function's returns; a parameter
   of a non-exported function, as the union of that argument at each call in the file; a callback parameter of
   `.map`/`.forEach`/`.filter`/`.flatMap`/`.some`/`.every`/`.find` over a literal array, and a `for-of` variable. Each
   folded path is normalised (`.` and `..` resolved) before it is classified. Two forms fail closed (opaque): a local
   function that is also passed by reference, because its parameter union counts only explicit calls; and a recursive
   call whose argument is not provably inside its own parameter's folder, such as `walk(join(dir, '..'))`. Any other
   form is a hole. Each rule has its own fixture test and its own mutant. `§10.9` holds both for `new URL`'s trailing
   slash (`5H`, red 7's first fixture), an exported function's parameter left a hole (`5E`) and the two fail-closed
   forms (`5N`, `5O`); for the separator `.replace` it holds the mutant alone (`5W`, whose test is red 13's `probes.ts`
   read-edge pin, not a fixture). Owed before roadmap `S4.5`'s exit, their ids not yet assigned: a red-7 fixture for the
   `.replace`; and a red-7 fixture and a mutant each for literals and `+`, the `const` walk, the `let` union, imported
   constants, each of the seven path calls beside `new URL`, a local function's returns, a non-exported function's
   parameter as the union of its calls' arguments, callback and `for-of` variables, normalisation, and a form left a
   hole.
6. **D6 — LOCAL runs on any path.** A changed hunk overlapping an anchor span selects the entry, whatever the
   path. `isProductionPath` leaves selection and stays only for UNGUARDED CHANGE. This restores `S2.1`'s text and
   makes those entries selectable (1,502 at `c603fb69`).
7. **D7 — ENTRY.** An entry is selected when it is live at the end and is new, or any of `file`, `find`,
   `replace`, `expectRed`, `expectSurvive`, `expectNoCompile`, `supersededBy`, `duplicateOf` or `abolishedBy`
   differs between the base ledger and the end ledger, matched by id. Measured: over the 29 ledger-changing commits
   of the 60-commit window, 11 of 680 added or edited live entries were selected by no other limb of an imports-only
   rule at introduction (`entry-gap.out`; for example `63ef7bc1` added `P6P-M48` to `M52`, anchored in
   `workbench.ts`, changing neither that file nor the victim). `c2c71020` changed only `ledger.ts`.
8. **D8 — GLOBAL selects each live entry.** By name: each tracked `package.json`, `tsconfig*.json`, `bun.lock` and
   `bunfig.toml`, and the folder `packages/typescript-config/` (whose `base.json` the name pattern would miss). By
   import closure: `vitest.config.ts` (with `vitest.projects.ts`) and `scripts/mutants/run.ts` (with `verdict.ts`,
   `apply.ts`, `measured.ts`, `tree-baseline.ts`). `scripts/mutants/ledger.ts` is left out because `ENTRY` reads it
   entry by entry; its one function, `isHistory` (`:167-169`), which decides the live set, is seen only by LOCAL on its
   one anchor and by REACH through the tests that reach it, not only the victims that import it (the export guard's 12
   reach it through `scripts/export-guard.ts:57`), never by `ENTRY` or the rule digest (`D16`). The
   JSON manifests carry no imports, so their kind is the derivation; the configs that are code are taken by closure,
   not by a hand list. Reason: `B6-unresolvable-fails-open` is guaranteed by TS18048 (`ledger.ts:463`), a
   `strictNullChecks` error. It comes from `"strict": true` in `packages/typescript-config/base.json:20`, and
   `packages/rph-application/tsconfig.json`, the program B6 compiles in, could override it. And the runner's own code
   grades each verdict.
9. **D9 — ALWAYS selects the 5 type-prevented entries on any non-empty change.** `B6`, `V2C-T1`, `F119`, `P6A-M11`
   and `P6A-M20`. Their verdict is the compiler's over a whole program; each costs one compile leg of its program
   (`packages/rph-application` for 3, `packages/rph-domain` and `verif` for 1 each); the integration's batch logs hold
   no leg of the first two, so that cost is not measured.
10. **D10 — OWED.** In a range, each live id whose last recorded verdict in the base's receipt chain (`D16`) is not
    held — anything but KILLED, TYPE_PREVENTED or CONTROL_HELD — is selected. The one-time run will end with
    survivors and void lines. A base that owes them must pass the debt on. When the base has no measured first-parent
    ancestor there is no chain to read: the run prints OWED UNKNOWN (`§10.8`), never an empty OWED.
11. **D11 — UNGUARDED CHANGE is unchanged.** It is a production hunk (`isProductionPath`) that no anchor overlaps. A
    REACH, GLOBAL, WIDE, ALWAYS or OWED selection never counts as guarding a changed region. `S2.3` defines the
    signal over the changed region's own anchors, and counting a reach-selected guard would be a false all-clear.
12. **D12 — the change set.** Paths come from `git diff --name-status -z --no-renames <base>`, so a deleted file and
    a rename's old path appear by name. In the edit loop only, `git ls-files -z --others --exclude-standard` adds
    untracked files as added. Hunks come from `--unified=0 --no-renames`. A file's `--- ` and `+++ ` headers are read
    only after its `diff --git` line, and a hunk's body is consumed by the line counts its `@@` header gives (a
    `\ No newline at end of file` line counts as neither side). So no content line is read as a header: with
    `--unified=0`, a line `-- x` replaced by `++ y` prints as `--- x` directly followed by `+++ y`, which a rule keyed
    on the `--- ` line alone would take for a file header. `D6` examines markdown too, where such lines are more
    likely. Each git call's output is read whole, through a file or a buffer sized to it, never through `spawnSync`'s
    1,048,576-byte default (`§10.1`); the change set's calls, a range's reads of its ledger and anchor files at its end,
    and `reach.ts`'s git reads (`git ls-files`; at a range end `git ls-tree` and `git cat-file --batch`, `D14`) run
    through `scope-run.ts`'s `runGit(argv, { cwd, input })`, which `scope.ts` and `reach.ts` call in `ROOT` and a test
    calls in a temporary repository (`D18`; `3J`).
13. **D13 — what runs by default.** `--run` measures LOCAL, ENTRY and ALWAYS, plus OWED in a range. `--run=reach`
    adds REACH and GLOBAL. `--run=all` adds WIDE. Whatever is selected and not run is printed as LISTED, NOT RUN, with
    counts by victim, the via edges and the estimated serial hours. The defaults follow the cost `§10.5` models:
    LOCAL in a single-parent commit is a median of 0 entries; REACH with WIDE is a median of 2,744.
14. **D14 — `--range` reads the ledger, the anchors and the reach at the range end.** `--range=K..T --run` is refused
    unless `HEAD` is `T` and the tracked tree is clean, because the runner measures the working tree. With `HEAD`
    elsewhere it is a REPLAY: it lists only, from `T`'s git objects, read through `runGit` (`D12`), with `T`'s own
    ledger and configs.
15. **D15 — a merge has no mode of its own.** An integration measures `--range=K..M` at the merge `M`, where `K` is a
    measured commit (`D16`) on `M`'s first-parent line. An entry whose reach meets no path changed between `K` and
    `M` keeps `K`'s verdict, because its reach holds the same bytes at `K` and at `M`: removing an edge edits the
    importer, which stays reached. Entries new or edited on the second side are new against `K`'s ledger, so ENTRY
    selects them. A two-sided reduction (clearing entries reached only from the second side, when that side carries
    its own receipt) is filed for later: measured at `8a703e2a` with imports only, the two-sided form selected the
    same 1,060 entries as the first-parent range (`merge2.mjs`), and WIDE victims meet both sides by construction.
16. **D16 — receipts make "measured" a check, not a convention.** A run that certifies a tree writes a receipt to
    `docs/tracking/mutants/` (`§10.7`). A commit is measured when the end tree holds a receipt for it, or for an
    ancestor whose later commits change only receipt files, and that receipt's base chain reaches a whole-ledger
    receipt. `--record` requires `--run=all`, or it exits 2 with `mutants:changed — --record requires --run=all.`, and a
    measured base, or it exits 2 with BASE NOT MEASURED; the base check decides both (roadmap rule 10). Each receipt
    records the rule digest: the SHA-256 over `scripts/mutants/scope.ts`, `scope-core.ts`, `scope-run.ts`,
    `reach-core.ts` and `reach.ts`, each path followed by its bytes, in that order. These five decide what is selected
    (`scope-run.ts` reads the change set and runs the runner) and lie outside GLOBAL's closure (`D8`). LOCAL and REACH
    see a change to them as they see a change to any file, through the entries anchored there and the tests that reach
    them (at `c603fb69`, `scope-core.ts`'s 5 entries `MU-PFA-R2-A` to `-E`, the export guard's 12 through
    `scripts/export-guard.ts:58`, and the 7 whole-suite controls); neither re-computes a receipt's selection, so only
    the digest makes a receipt written under the earlier rule owe what the current rule selects. When the digest has
    changed since a receipt in the chain, the tool re-computes that receipt's selection under the current rule from its
    own tree, and owes each id the current rule selects that the receipt did not measure.
17. **D17 — four exit codes, each a class.** 1, a measured finding: a guard that does not discriminate (BROKEN
    GUARANTEE, in its wordings LOCAL, ENTRY, REMOTE, OWED and TYPE), or a declared control a test reddened (CONTROL
    BROKEN). 2, nothing claimed: the instrument did not run, an entry reached no verdict, or a refusal. 3, UNGUARDED
    CHANGE under `--strict`. 0, none of these. When several classes apply, the code follows the order 1, 2, 3; each
    raised signal prints its own message, and a last line names each signal with its class and then the one exit
    code the process takes. `S2.3`'s rule, *"THEY MUST NOT SHARE AN EXIT CODE OR A MESSAGE"*, governs BROKEN
    GUARANTEE against UNGUARDED CHANGE, and they stay apart (1 and 3). The classifier reads the runner's rows, never
    its exit status (`§10.8`).
18. **D18 — the LIMIT banner prints on each exit path, refusals included.** A pure `renderReport(result)` returns the
    lines and the exit code; `scope.ts` only prints them and exits, so a test can pin each message on each path.
    Today nothing pins `scope.ts`'s exits or messages: it exports nothing and nothing imports it. So `scope.ts` keeps
    no decision a test must reach: the flag set (`parseFlags`), each mode's git argv lists, the range check and the base
    check are pure functions in `scope-core.ts` beside `renderReport`, and its runner and git calls, and the read that
    locates a range's anchors at its end, are `scope-run.ts`'s (`D19`, `D12`); a reach build's failure is converted to
    REACH COULD NOT BE BUILT in `reach-core.ts`, handed the build to call (`§10.9`, red 21). No test drives the CLI.
    Inside the runner the tree holds the mutation, so in the edit loop the CLI meets LEDGER ROT under most mutations
    (3,927 of 4,035 live at `c603fb69`), and RANGE END IS NOT THE TREE under `--range --run`, before it reaches what a
    test asks; an admitted `--run` starts a second runner (roadmap rule 10).
19. **D19 — runner calls without a shell, exact, and never empty.** `scope.ts` spawns the runner through
    `scope-run.ts`'s `runChunks`, with no shell and one argv element per id, in chunks of at most 200 ids and 20,000
    characters, grouped by victim where a victim fits, so each chunk pays a victim's baseline once. Output is written
    to a log file as it arrives and classified from the file, so no buffer limit applies. `REG-F-176`: *"Under Bun, a
    child that **exited 0** having written more than 1,048,576 bytes was delivered to this runner as
    `{ status: 1, signal: null, error: undefined, stdout: '' }`"*, and `shell: true` was the cause. ⛔ **NEVER WITH
    ZERO IDS.** The runner reads an empty id list as the whole ledger (`run.ts:1079-1081`). So the chunker emits no
    empty chunk, and under `MUTANTS_EXACT=1` the runner matches ids exactly and refuses a call with no id (exit 2).
    `MUTANTS_EXACT` is an environment variable, as `MUTANTS_PREFLIGHT`, `MUTANTS_HARVEST` and `MUTANTS_ADVISORY` are,
    so no argv entry is ever a flag. `runChunks` puts it in the spawn's explicit `env`,
    `{ ...process.env, MUTANTS_EXACT: '1' }`, never on its own `process.env` left to inheritance (*"Under Bun it did
    not reach the child"*, `run.ts:120-121`). ⭑ **THE SPAWN LANDS FIRST.** It lives in `scope-run.ts`, which
    `scope.ts` imports, a test imports to hand it an argv-echo child and a temp folder, and the runner never loads
    (`run.ts` imports no scope file). Left in `scope.ts`, which exports nothing (`D18`) and runs at load
    (`scope.ts:56-208`), it could be reached only through the CLI, run in place or copied into a temporary repository,
    and no test drives the CLI (roadmap rule 10). The lanes run detached at `W`. So it lands with the classifier
    (roadmap `S4.2`), while the one-time run is in flight, passing a `MUTANTS_EXACT=1` that no runner reads yet. The
    runner's reading of `MUTANTS_EXACT`, the empty-call refusal and the verdict line's formatter are in `verdict.ts` and
    `run.ts`, which stay fixed until that run's measurements end (`S4.4`). With real ids the 200-id cap binds first: the
    200 longest live ids at `c603fb69` total 15,927 characters with separators (`idlen.out`). So the character cap
    guards only against longer ids, and its test uses synthetic ones. One call without a shell carried 714 real ids
    (31,946 characters); 730 (32,943) failed with `ENAMETOOLONG` (`shell-limit.out`). `runChunks`'s command and folder
    are parameters, a hole under `D4`(b), as are `runGit`'s argv and folder under `D4`(b) and (c), so a victim is WIDE
    once `scope-run.ts` is in its reach: `verif/mutants-scope.test.ts`, which imports it, and
    `verif/mutants-reach.test.ts`, whose live pins build the reach through `reach.ts` and its `runGit` (`D12`). Their
    entries are then selected by WIDE on any change, and roadmap `S4.8`'s re-measured WIDE figures, taken at its own
    tree too, carry them.
20. **D20 — build order: each instrument fix lands with its own red before any step enlarges a selection.** The
    classifier, the void rule, NO VERDICT, the exit order, the banner, flag refusal and both halves of the runner
    calls (`D19`) come first. LOCAL on any path (`D6`) enlarges a selection by 1,502 entries at `c603fb69`, so it
    waits too. A reach limb fed through today's classifier would turn a remote victim's red into *"The suite is green
    and the protection is gone"*.
21. **D21 — the BLIND check.** An entry is BLIND when its anchor file lies outside its victim's reach (RP1-RP6) and
    outside GLOBAL. Each run prints the count. A BLIND entry whose victim is not WIDE means the reach misses an edge:
    its victim is treated as WIDE for that run, each of its entries carrying that BLIND entry and its anchor file in
    place of a site (`D4`), the run prints REACH INCOMPLETE, and a live pin holds that count at 0, shown able to fail by
    `5D`. ⛔ The pin also asserts its population, each live entry that names a victim (4,024 at `c603fb69`), counted from
    the ledger in the same test, so a check that reads no entry cannot pass with 0 (`5V`). The scratch scanner fails
    this pin today (6 entries, `§10.2`).
22. **D22 — one capture audit, after the reach is built.** In a disposable lane at the final tree, each non-WIDE
    vitest victim is run once, unmutated, under a capture of the modules its worker loads and the files it reads
    (the mechanism measured in scratch by the runtime design: an `--import` preload carried by `NODE_OPTIONS`). Each
    observed tracked path outside its static reach becomes a fixture red against the fold. It is an audit, not the
    selection: a capture sees one unmutated run and misses untaken branches.
23. **D23 — no `gate:fast` step.** By default the command compares the working tree with `HEAD`, which is empty on the
    committed trees the gate runs on; there, what could block is the sponsor's choice under `§10.11` Q1: the whole
    ledger at an integration point (recommended) or a range from a measured base, at the cost `§10.5` models and
    roadmap `S4.8` re-measures. `gate:fast` keeps 13 steps; the composition pin and `REQUIRED_ROOT_COMMANDS` (12
    names) do not move. ⚠ **`VERIF_TEST_FLOOR` DOES.** Its note reads *"RAISE THIS DELIBERATELY when tests are added —
    an addition never reddens the check, so a stale-low floor silently buys back the exposure this file closes"*
    (`verif/assurance-surface.test.ts:80-81`). It stands at 79 (`:127`) against 105 top-level `verif/*.test.ts` files
    at `d7a363b0` and 106 at `c603fb69`. This programme adds `verif/mutants-reach.test.ts` and
    `verif/mutants-record.test.ts`, which carry the B7 red, the BLIND pin and the receipts' append-only check. Each
    commit that first lands one raises the floor to the population measured in that commit, with a dated line in its
    note, as J2-3 did: *"The floor is set to the population."* (`:125`)

---

### 10.4 · What it will select, and what it still cannot

**WHAT IT WILL SELECT** (the first three selections measured in scratch; the rest follow from `D3` to `D10`). ⚠ By
default `--run` measures LOCAL, ENTRY and ALWAYS, plus OWED in a range (`D13`), so the B7 and `7e8725ba` cases below
are LISTED, NOT RUN unless `--run=reach` or `--run=all` asks. ⚠ The first two are SELECTED AT THE ATTRIBUTED
CAUSE: that the commit made the guard slack rests on reasoning until its transition is measured (`§10.9`).

- **B7 (`ddd75ae9`), selected at the attributed cause.** On B7's own tree and ledger, `probes.ts` alone selects the
  four by REACH: 573 entries by seen limbs, 566 through their victims' reach and the 7 whole-suite controls through
  RP6 (`b7-control.out`, `b7-r6.out`). So do B7's 21 other files, and the full 22. LOCAL and a victim-changed rule
  select none of them when the victim's own edit is left out. At `ddd75ae9` the victim is also WIDE, through the
  spawn at line 682.
- **`7e8725ba` (JAN-EXECGOV EG-03, 2026-09-08), a production path, selected at the attributed cause.** It changed 9
  files, `packages/rph-domain/src/enforcement-register.ts` among them, and neither the victim of
  `M7-unenforced-certified-covered` and `M8-wire-dead-predicate` nor either anchor file. The victim,
  `packages/rph-domain/src/enforcement-register.test.ts`, imports `./enforcement-register.js` (line 36), so REACH
  selects both. ⚠ M8's anchor, `handlers/execution.ts`, is itself inside that victim's reach: the setup file
  `verif/unread-refusal-guard.ts:31` reads `import { Engine } from '@janumipwb/rph-application';`. So M8 cannot carry
  a red about an anchor outside reach.
- **Data read through a constant.** At `ddd75ae9`, `docs/tracking/reviewer-qualification/cases/case-set-v8.json` is
  in the fingerprint test's reach, so one of B7's three JSON files alone selects the four.
- Entries anchored in `scripts/` and `verif/` (`D6`); new and edited entries (`D7`); runner, config and manifest
  changes (`D8`); the type-prevented entries (`D9`); debts a base owes (`D10`).
- The app a Playwright spec drives (RP5); a script a test spawns by a literal path (RP4); a file added under a folder a
  census walks (RP3).
- Through WIDE, any change selects the WIDE victims' entries, at the cost stated in `§10.5`.

**WHAT IT STILL CANNOT** — the banner, word for word, as `renderReport` will print it on each exit path once its last
limb, OWED, lands (roadmap `S4.7`). Each earlier step prints only the limbs it has built (roadmap `S4.2`). Values in
angle brackets are computed by the run; the scratch values at `d7a363b0` are `<t>` 5, `<v>` 144, `<n>` 2,736,
`<b>` 27 and `<x>` 6.

```
⚠ LIMIT: a guard is selected when a changed line touches its anchor (LOCAL); when its ledger entry is new or
  edited (ENTRY); when it is type-prevented (ALWAYS: <t> entries); when a runner, test config, compiler config,
  lockfile or package manifest changed (GLOBAL); when the base this range starts from owed it a verdict (OWED);
  or when its test REACHES a changed path (REACH). A test reaches the files it imports in any form, its
  project's setup files, the files and folders that code reads, lists, stats, copies, watches or runs where the
  scanner folds the path to a literal, and, for a browser test, the app it serves. A path the scanner cannot
  fold, a git call outside a temp folder, or a use of fs or child_process in a form it does not model makes the
  test WIDE, so any change selects it: <v> test(s), <n> entries, <RUN | LISTED, NOT RUN>. A fold rule that
  bounds a path WRONGLY under-selects with no message; only the BLIND count below and the one capture audit can
  show it. <b> entries are anchored outside their test's reach (BLIND); <x> of them belong to tests that are not
  WIDE, which this run treats as WIDE (REACH INCOMPLETE). Not seen at all: gitignored build output (dist/,
  .svelte-kit/, SvelteKit's generated ./$types among it), the environment and the host, and guards the ledger
  does not declare. UNGUARDED CHANGE examines only .ts, .tsx and .svelte files under packages/ and apps/ other
  than *.test.ts and *.spec.ts (Playwright's *.e2e.ts specs are examined): a change to any other file is never called
  unguarded.
  A clean run says the measured entries still discriminate. It does not say nothing downstream broke.
```

Beside it, each run prints its change set's provenance: `CHANGE SET: <base12>..<end12 | working tree> (<clean | n
tracked changes>), untracked files <included | excluded>, renames split; <h> changed hunk(s), <p> in production
source.` The last count keeps today's (`scope.ts:116`): it is the population UNGUARDED CHANGE examines.

**THE LIMITS BEHIND THOSE SENTENCES:**

- A fold rule that wrongly bounds a known form under-selects, and only `D21` and `D22` can show it. `§10.2` records
  one such rule in the scratch scanner.
- 4 victims (410 live entries) spawn Bun children that resolve `@janumipwb/*` to `dist`, which is gitignored. A
  change to package source cannot change what those children run until a build. 0 of the 410 are anchored in the
  three packages involved today.
- The environment: `JPWB_REVIEW_SEES_PRIOR`, read at `loop-detection.ts:102`, is not among the 10 variables the setup
  file clears. No file change shows a variable's value.
- Flakes and timeouts under load change verdicts with no tracked-file change.
- A declared ledger is not the space of possible mutations (the ledger header's disclosed limit).

**WHAT THIS DOES TO `REG-F-391`'S OPEN ITEM: IT IS NOT CLOSED.** When this lands, the remote case becomes SELECTABLE:
REACH and GLOBAL select it by a seen edge, and WIDE selects it where a path cannot be folded. Where only those limbs
select it, it is MEASURED by the rule only when `--run=reach` or `--run=all` asks (above): by default it is
LISTED, NOT RUN, and a package is offered on exit 0 (`§10.6`). A whole-ledger run (`bun run mutants`, `§10.6`)
MEASURES it with each other entry; whether one is required after the one-time run (`§10.10`) is `§10.11` Q1. What
stays unselectable is what the banner names: a fold rule that bounds a path wrongly, gitignored build output, the
environment and the host, and guards the ledger does not declare.

---

### 10.5 · What it will cost, measured

**THE MODEL.** The prototype's last 60 first-parent commits of `p7c-p6r`, ending at `d7a363b0` (2026-10-23 to
2026-10-26; 51 single-parent, 9 merges). Each commit is judged with today's ledger (3,907 live) and today's reach, not
its own. The prototype compared the two for its own esbuild import reach only, at 4 single-parent commits: 3 of this
window's 51 (`e3dab441`, `2c56076f`, `981f1014`) and B7 (`ddd75ae9`), which is not on `d7a363b0`'s first-parent line.
Today's selected 0% to 13% more entries (54 against 54, 3,612 against 3,200, 3,366 against 3,313, 1,019 against 917)
and 0% to 9% more serial hours; those commits' own ledgers held 3,438 to 3,862 live entries. `approx.mjs` printed the
four lines (`control-out.txt` holds B7's pair); re-run on its retained inputs on 2026-10-29, it reproduces them line for
line, and that re-run's output is `approx.out`. No retained output compares the two at any of the 9 merges, or for the
scanner or the TypeScript walk, whose outputs give the rows below.

Serial rates: the brief's measurement of 2026-10-27 gives about 3.7 min per fingerprint-test entry, about 20 s per
cases-test entry and 50-80 s for most others, taken as 222 s, 20 s and 60 s otherwise. The scanner's hours are priced at
these three alone, and the whole ledger is 79.8 h at them. The LOCAL and imports-only figures come from
`cost-rule3.json`, whose `cost.mjs` prices two kinds of entry apart, each in place of 60 s: a type-prevented entry at
5 s (an estimate: `D9` finds no measured leg for 4 of the 5) and a whole-suite control at 445 s (the one whole-suite run
the integration's batch logs measured, batch-02's 444.9 s baseline). It also adds one 445 s baseline to each selection
holding a control, and prices the whole ledger at 80.55 h. Two figures below move with it: the imports-only medians,
1.71 h and 4.50 h, are 0.92 h and 3.70 h at the three rates alone (`compare-brief.out`). LOCAL's hours do not: 0 of its
51 selections hold a type-prevented entry or a control. Figures from `compare.out` and a re-run of `window.mjs` (scratch
scanner) and `cost-rule3.json` (TypeScript walk). These are scratch figures. The built tool re-measures them, except the
imports-only rule's, on the same 60 commits as REPLAYs, each commit, window and merge judged with its end's own ledger
and reach (`D14`), and records each beside its scratch figure (roadmap `S4.8`).

| selection | median / P90 / max entries | median serial h |
| --- | --- | --- |
| LOCAL on each path, hunk level, the 51 single-parent commits | 0 / 19 / 58 (34 of 51 select 0) | 0.00 (max 1.19) |
| imports only: import closure, setup files, served app, anchor file, whole-suite union, GLOBAL, ALWAYS (TypeScript walk), 60 commits | 55 / 3,615 / 3,712 | 1.71 |
| seen limbs: RP0-RP6, GLOBAL, the type-prevented entries' compile reach; ENTRY not modelled (scratch scanner), 60 commits | 566 / 3,651 / 3,690 | 9.43 |
| seen limbs and WIDE, 60 commits | 2,744 / 3,868 / 3,881 (0 of 60 select fewer than 2,743) | 60.37 |

| slice | seen limbs | with WIDE | imports only |
| --- | --- | --- | --- |
| 25 docs-only commits | 431-575 (7.18-9.58 h; median 566, 9.43 h) | 2,743-2,744 | 5 |
| 27 single-parent code commits | median 782 (28.07 h) | median 2,750 | median 308 (4.50 h) |
| package-sized ranges: 12 windows of 5 commits | median 2,777 (60.9 h) | median 3,076 (65.9 h) | — |
| 6 windows of 10 commits | median 3,668 (75.8 h) | median 3,882 (79.3 h) | — |
| 9 merges, each from its first parent | median 3,652 (75.51 h) | median 3,868 (79.11 h) | median 3,632 |

⛔ **THE FINDING THE SPONSOR NEEDS: ABOVE A SINGLE COMMIT, A SOUND SELECTION HERE IS MOST OF THE LEDGER.** At 7 of
the 9 merges, seen limbs and WIDE select 3,845-3,881 of 3,907 live entries: 78.7-79.3 h of the whole ledger's
79.8 h. 6 of the 9 select 3,635-3,690 by seen limbs alone. The width is real dependency, not the scanner: the setup
files put the engine in each package and app victim's reach; the barrel, `packages/rph-contracts/src/index.ts`, is
in 356 to 361 of 391 victims' reach by build (esbuild 356, the TypeScript walk 361, the scanner 359); and the
register is read by 8 victims holding 472 entries. The fingerprint test's 390 entries cost 24 h serial by
themselves: under imports alone, 16 of the 60 commits select them; with WIDE, 60 of 60 do, because the fingerprint
test is WIDE at `d7a363b0`.

**WHERE THE RULE IS CHEAP** is the single commit in the edit loop: LOCAL, ENTRY and ALWAYS (`D13`). ENTRY adds the
commit's new and edited entries, up to 59 in a single-parent commit of the window (`cb29dced`). Computing the
selection itself takes seconds (`D1`).

**COST OF A RECEIPT'S RE-CHECK** (`D16`), NOT MEASURED: per receipt, one extraction of its tree from git objects and
one reach build over it, the work a REPLAY does (`D14`). No retained output times an extraction or the scanner. Over
past trees already on disk, the TypeScript walk took 1.5-3.2 s (3 trees, `tsreach-<sha>.json`) and esbuild 11.5-13.2 s
(6 trees, `<sha>.meta.json`), against 1.4 s and 4.1 s on the working tree. Roadmap `S4.8` times, with the built tool,
the three REPLAYs it records once on real history (`§10.9`), and those times replace this paragraph.

---

### 10.6 · Where it will be used

- **THE EDIT LOOP:** `bun run mutants:changed [--run[=reach|all]] [--strict]`. The base is `HEAD`, untracked files
  included. It measures LOCAL, ENTRY and ALWAYS, and lists REACH, GLOBAL, WIDE and the debts of the last receipt on
  `HEAD`'s first-parent line (OWED UNKNOWN when there is none), by victim, with via edges and hours. OWED UNKNOWN is
  class 2 (`D17`), as REACH COULD NOT BE BUILT is: when part of the selection cannot be computed, the run refuses. So
  from roadmap `S4.7`, which lands OWED, until `W`'s receipt is on `HEAD`'s first-parent line (roadmap `S4.8`), each
  edit loop exits 2 with OWED UNKNOWN. It stays out of `gate:fast` (`D23`).
- **A PACKAGE:** `bun run mutants:changed --range=<branch point>..HEAD --run`, at the package's tip with a clean tree.
  The same default, with OWED computed from the last measured first-parent ancestor of the base, or printed as
  `OWED UNKNOWN`, which exits 2, when there is none. A package is offered when this exits 0 (without `--strict`,
  UNGUARDED CHANGE is advisory and leaves it 0), so from roadmap `S4.7` until `W`'s receipt is on `HEAD`'s first-parent
  line (roadmap `S4.8`), every range exits 2 (OWED UNKNOWN; BASE NOT MEASURED under `--record`, and for
  `--range=measured..HEAD` with or without it, `§10.9` red 12) and no package is offered on exit 0.
  `--run=all --record` makes the tip measured, if its base is measured.
- **A MERGE:** `--range=<measured>..HEAD` at the merge commit (`D15`). The keyword `measured` names the latest measured
  commit on `HEAD`'s first-parent line; with none, the range exits 2 with BASE NOT MEASURED, `<M12>` printed `none`, and
  is never read as an empty base (`§10.9`, red 12).
- **A REPLAY:** `--range=C^1..C` with `HEAD` elsewhere lists what the rule selects at `C`, from `C`'s own objects
  (`D14`). The one-time run's survivor procedure uses it (`§10.10`).
- **WHOLE LEDGER:** `bun run mutants`, in lanes, recorded as `scope: whole` (`§10.10`). It is `gate`'s second leg
  (`package.json:26`), and `REG-F-100` records *"**`bun run mutants` is in `gate` only.**"*
- `--explain=<id>` prints why an entry is or is not selected: its victim's reach, each via edge, its WIDE site.

**WHAT AN INTEGRATION USED UNTIL NOW.** The first (packages L2, M and N) recorded an anchor census and the touched
test files. The second (O, O-2 and V) re-measured 944 entries by six reasons, (a) to (f): two by id prefix, four by
file. No reason selected an entry because its victim imports or reads a changed file; the four were reached only
because both sides changed the victim (`make_batches.py`).

---

### 10.7 · The record it keeps, and the reach it does not keep

**NO DERIVED RECORD.** Reach is computed on each run (`D1`). So it owes no writer, no freshness check and no
`gate:fast` step.

**RECEIPTS ARE A JOURNAL, NOT A DERIVED RECORD.** A receipt is evidence of one run, never regenerated, so the rule for
derived records (regenerated in the commit that moves them) does not apply to it. It lives at
`docs/tracking/mutants/<date>-<tree12>-<scope>.ndjson`, with `scope` either `whole` or `range`, under that folder's
law: *"**A record is never edited.** Corrections are new records that supersede by id"* (`docs/tracking/README.md`).

- **Header:** `{type:"measurement", id, tree (40 hex), base, baseReceipt, ledgerSha256, ruleSha256 (D16's five
  files), selection (counts per limb), selected ids or, when shorter, the live ids not selected, counts per verdict,
  lanes, canary, logs: [{name, sha256}], runner: "scripts/mutants/run.ts", receipt}`. The `receipt` field is one
  line, printed as the run's last line: `MEASURED <T12> FROM <K12> (rule <sha12>): <n> selected; KILLED a,
  TYPE_PREVENTED b, CONTROL_HELD c, SURVIVED d, NO VERDICT e; OWED f.`
- **Rows:** one per verdict line, KILLED included, each the runner's line verbatim: the verdict, the id and its
  test-result detail. So a KILLED with no test result (`REG-F-585`'s shape) can be audited from the receipt alone,
  after the logs are gone, as the tracking folder's fourth law requires: *"Nothing about implementation status may
  live only in session state."* (`docs/tracking/README.md:34-35`). A whole-ledger receipt at `W` holds one row per id,
  4,119, and for each re-measurement a supersede record and its row. The chunk logs, which hold each call's full
  transcript, are kept out of git and named in the header by base name and SHA-256.
- **Voids and re-measures:** `{type:"supersede", supersedes, reason}`, then the later row. Example reasons:
  `KILLED with no test result (REG-F-585)`; `INCONCLUSIVE, re-measured alone (§10.10, step 9)`.
- **Writer:** `scripts/mutants/record.ts`, run by `mutants:changed ... --run=all --record`, or directly over lane
  logs (`--logs=<dir> --scope=whole --tree=<sha>`). It refuses a log whose SHA-256 differs from the one named, an id
  with two rows and no supersede, and an id unknown to the ledger. It applies `§10.8`'s chunk test to each log, its
  abort rule included, so a chunk with no summary banner and no abort line leaves no row standing. An id without a valid
  verdict is written as NO VERDICT, and so becomes owed. Over lane logs it reads only the `<chunk>.log` beside each
  chunk file, never a renamed `.stopped-<n>` log, as `collect.py` does (`collect.py:117-122`), and also applies
  `collect.py`'s other rules for a verdict (`§10.10`, step 8; `collect.py:12-21`, `:145-159`, `:184`, `:196`,
  `:204-206`), so the receipt's verdicts are the tally's. A chunk does not count when a line begins `RECOVERING`
  (`run.ts:1052` restores the file and runs on to a summary) or `FAIL:`, when the summary's counts differ from its
  verdict lines, when the lane's `progress.txt` records no END for it, or when a `STOPPED-` marker names it; in a chunk
  holding an `ABORTED_DIRTY` row, the rows before the line just ahead of it still stand. A Playwright victim's KILLED
  stands only from an e2e-queue chunk that counts. A chunk a lane STOPPED on, an aborted one among them, is read only
  through its re-run's log (step 8). An id measured in more than one log, whatever the cause (a void re-measured
  alone, step 8; an INCONCLUSIVE row re-measured alone,
  step 9; a survivor confirmed alone on a lane, the survivor procedure's step 1), keeps its latest row by its chunk's
  START time, and each earlier row is followed by a supersede record naming why.
- **Check:** `verif/mutants-record.test.ts`, inside `bun run test`. It parses each receipt; record ids are unique;
  each supersede resolves; each entry id is a ledger id at `HEAD`, live or history; each tree is 40 hex; and each
  receipt that git history shows added (`git log --diff-filter=A`) is byte-identical at `HEAD` to that first version.
  So no pin need advance: `verif/register-append-only.test.ts` holds only what existed at its pin (`95d0b3ae`, `:38`),
  and a pin named before any receipt exists would hold none. ⛔ From the commit that lands `W`'s receipt, the test
  names it, so a check that reads no receipt fails (`7K`). ⚠ The folder's index reads only `census/`
  (`scripts/tracker/build.ts:22`) and enforces the append-only law only there (`scripts/tracker/core.ts`
  `loadRecords`), so receipts sit beside it unread, as `w3b/` did (`verif/slice-ledger.test.ts:4-6`). This test
  carries the law, and the README's Layout gains the family, marked as unread by the index, in the same commit.

---

### 10.8 · The signals, word for word

The classifier will read the runner's rows (the line `run.ts:1117` prints:
`${r.verdict.padEnd(14)} ${m.id.padEnd(34)} ${r.detail}`), matched against the ids it sent, never split on spaces. The
parser lands in `scope-core.ts` with the classifier (`S4.2`) and moves into `verdict.ts` beside the formatter when the
runner may change (`S4.4`), so that one test round-trips them. Until then a format the parser cannot read gives NO
VERDICT, never a held row.

- **A chunk** counts only when its transcript holds `=== MUTATION LEDGER SUMMARY ===`, holds neither `ABORT: tracked
  worktree does not match a stable staged index baseline — refusing to mutate.` nor a line beginning `ABORTED: the
  tracked worktree or index changed mid-run.`, shows `ABORTED_DIRTY` 0, and its `Running <n> declared mutant(s)` count
  and its `<n> entries -> ` line both equal the ids sent, with known substring twins added while the runner matches by
  substring and none from `S4.4`, when it honours the `MUTANTS_EXACT=1` that `runChunks` sends (4 pairs at `W`; 3 of
  the 4 longer twins are history, which `mutants:changed` never sends). Otherwise INSTRUMENT DID
  NOT RUN, for its ids. In an aborted chunk, rows before the line just ahead of `ABORTED_DIRTY` stand, because the
  runner checks the tree at each entry's start; that one line is void.
- **A row:** KILLED, TYPE_PREVENTED and CONTROL_HELD are held. RETIRED, DUPLICATE and ABOLISHED are history. SURVIVED
  is BROKEN GUARANTEE. INCONCLUSIVE, NO_COMPILE, UNANCHORED, KILLED_UNNAMED and ABORTED_DIRTY are NO VERDICT. A vitest
  victim's KILLED with an empty detail is void (`REG-F-585`'s shape: 1 of the 864 KILLED lines in batches 01-07).
  An id with no row is NO VERDICT.

| class | message |
| --- | --- |
| 1 | `⛔ BROKEN GUARANTEE — LOCAL: a guard over a region you changed does not discriminate. Its test passes with the mutation applied.` |
| 1 | `⛔ BROKEN GUARANTEE — ENTRY: a ledger entry you added or edited does not discriminate. Its test passes with the mutation applied.` |
| 1 | `⛔ BROKEN GUARANTEE — REMOTE: a guard anchored outside what you changed does not discriminate. Its test reaches a path you changed, named below with the edge. Its test passes with the mutation applied.` Each row: `REMOTE SURVIVED <id>  anchor <file>:<a>-<b>  victim <victim>  via <path> (<importer>:<line> imports <path> \| reads \| runs \| serves \| GLOBAL \| WIDE <file>:<line> <call> \| WIDE BLIND <id> <file>) [+<k> more]`, then the runner's detail verbatim. The record and `--explain=<id>` list each changed path in the entry's reach as a via, each with its edge; the row prints the first and counts the rest |
| 1 | `⛔ BROKEN GUARANTEE — OWED: a guard the base already owed a verdict does not discriminate. The debt is carried from <K12>; the line below says whether this change had a part in it.` |
| 1 | `⛔ BROKEN GUARANTEE — TYPE: a mutation declared type-prevented now compiles. The type-level guarantee is gone.` |
| 1 | `⛔ CONTROL BROKEN — <id> was declared a control and a test newly failed on it: a test asserts on something behaviour cannot depend on.` |
| 1, after each BROKEN GUARANTEE row | `  SURVIVED says the guard does not discriminate at <T12>. Whether this change made it slack: <held at K12 per receipt <id>: it went slack between K12 and T12 \| SURVIVED at K12 per receipt <id>: this change did not make it slack \| unknown — measure it at K12 (REG-F-100: present then absent)>.` |
| 3 | `⛔ UNGUARDED CHANGE — nothing in this repository has ever tried to break these regions:` (kept from `scope.ts:151`) |
| 2 | `⛔ INSTRUMENT DID NOT RUN — no verdict is available, and none is being claimed.` (kept from `scope.ts:183`), with the chunk's ids |
| 2 | `⛔ NO VERDICT — <n> selected entries were run and reached no verdict about their guard (<k> INCONCLUSIVE: the test was red before the mutation, timed out or did not complete, or a control's failure was unattributed, as each detail says; <a> NO_COMPILE; <b> UNANCHORED; <c> KILLED_UNNAMED; <d> void: a KILLED line with no test result; <e> no verdict line). Nothing about these guards is claimed. If your change turned a test red, that red is the finding: fix it and re-run.` |
| 2 | `⛔ LEDGER ROT — …` (kept), located at the end tree |
| 2 | `⛔ RANGE END IS NOT THE TREE — --range=<A>..<B> is measured on the working tree, which is at <HEAD12> with <n> tracked change(s). Check out <B> with a clean tree.` |
| 2 | `⛔ BASE NOT MEASURED — <K12> carries no receipt whose chain reaches a whole-ledger measurement, so nothing selected from it covers the change. Start at a measured commit (latest: <M12>), or measure the whole ledger.` |
| 2 | `⛔ REACH COULD NOT BE BUILT — <reason>. Nothing is selected by reach, so nothing is claimed about it.` |
| 2 | `⛔ OWED UNKNOWN — <K12> has no measured first-parent ancestor, so what it owes is not known, and nothing is claimed about it.` |
| 2 | `mutants:changed — unknown flag <f>.` (this includes `--range` written without `=`) |
| 2 | `mutants:changed — --record requires --run=all.` |
| 0 | `mutants:changed — LISTED, NOT RUN: <n> entries (REACH <r>, GLOBAL <g>, WIDE <w>), about <h> h serial. Run them with --run=reach or --run=all.` |
| 0 | `mutants:changed — NOTHING CHANGED: the change set is empty. This is not a pass: there was nothing to decide.` |
| 0, until roadmap `S4.3` | `mutants:changed — NO PRODUCTION CHANGES EXAMINED. This is not a pass: there was nothing to decide.` (kept from `scope.ts:131`), for a change set whose hunks all lie outside production source while LOCAL keeps the production filter |
| last | `SIGNALS RAISED: <signal> (class <c>) · … — EXIT <code>.`, naming the one code the process takes. For example, under `--strict`: `SIGNALS RAISED: BROKEN GUARANTEE — REMOTE (class 1) · NO VERDICT (class 2) · UNGUARDED CHANGE (class 3) — EXIT 1.` Without `--strict`, UNGUARDED CHANGE prints as `(class 3, advisory)` and does not set the exit |

⭑ **THE REMOTE CASE GETS ITS OWN WORDING AND SHARES CLASS 1.** It says what LOCAL says about the code — a guard
does not discriminate — and asks for the same next step. It differs in where the guard sits, so the reader needs the
edge that selected it. That is this design's choice. `S2.3`'s rule, *"THEY MUST NOT SHARE AN EXIT CODE OR A
MESSAGE"*, governs BROKEN GUARANTEE against UNGUARDED CHANGE (`D17`), not LOCAL against REMOTE. An entry selected by
several limbs is reported under one wording, its other limbs listed: OWED when the base's receipt chain records it
SURVIVED, since the base already had it slack; otherwise TYPE for a type-prevented entry, whose verdict is the
compiler's and for which no test runs with the mutation applied (`run.ts:466-473`, `:776-777`); otherwise the first of
ENTRY, LOCAL and REMOTE; OWED when nothing else selected it. NO VERDICT and LISTED, NOT RUN share no key word, so a
listing cannot read as a failure to measure. Today's sentence *"The suite is green and the protection is gone"* is
dropped: it is false for a victim the change turned red.

---

### 10.9 · Predicted reds, and the rule's own mutants

⛔ **THE TEST THAT MUST REDDEN FIRST:** `verif/mutants-reach.test.ts` › *"REG-F-584 — B7 (ddd75ae9): a change to
the probes alone selects PQ1-M1751, PQ1-M1752, PQ1-M1759 and PQ1-M1760 by REACH via
scripts/reviewer-qual/probes.ts"*. A fixture, with no git and no file system. It holds the four entries as data
(anchor file the validator, victim the fingerprint test), a reach graph with the victim's import of
`../scripts/reviewer-qual/probes.js` and of the validator, and a change set of `scripts/reviewer-qual/probes.ts`
alone, with hunks only in it. It asserts each entry's limb set is exactly `{REACH}` and its via list is exactly that
import: the message, not a count. It is written against a `selectChange` that holds only today's rule (roadmap
`S4.1`), so it fails with the four absent — a red for the right reason, not an import error — and turns green when
REACH lands. From then `selectChange` walks the graph it is handed (a fixture's, or the one `reach.ts` builds) through
`reach-core.ts`'s closure, the code `6L` and `6M` mutate, so this test runs through that closure, and so does red 2, a
fixture in this form. Handed a reach already closed, it would bypass the closure: `6L` could not redden this test, nor
`6M` red 2.
⭑ **IT DISCRIMINATES.** The fixture holds no opaque site, so WIDE cannot satisfy it. The victim is unchanged, so a
victim-changed rule cannot. No hunk touches the validator, so LOCAL and an anchor-file rule cannot. The prototype
measured the same split on B7's own trees: probes.ts alone selects the four by reach, 4 of 4; the anchor-file rule
selects 152 entries and none of the four (157 with today's ledger); today's rule selects 0 (`control-out.txt`).

The full diff of B7 cannot carry this red alone: it also edits the victim, so a victim-changed rule selects the four
there too (780 entries with B7's ledger). The live ledger cannot carry it either: at `c2c71020` the four are history.

**THE OTHER REDS AND GUARDS, each written before the code that turns it green:**

1. `7e8725ba`: a change to `enforcement-register.ts` selects M7 and M8 by REACH via the victim's import; LOCAL and a
   victim-changed rule select neither. A fixture, free of B7's confound.
2. Transitive: `V` imports `M`, `M` imports `F`; a change to `F` selects `V`'s entries. B7 cannot kill a closure that
   stops at direct imports: its reach hits are direct imports of the victim. It sits in `verif/mutants-reach.test.ts`
   with the B7 test and red 13's pins, where `6M` also reddens the `pwuType.ts` pin (roadmap `S4.6`).
3. The admitting half, a guard and not a red: it is green before REACH exists, and `6B` shows it can fail. A change
   to a file no victim reaches selects nothing by REACH, and the report says `REACH 0`.
4. ENTRY: an entry added with no other change it reaches is selected (`63ef7bc1`'s shape).
5. GLOBAL: a `strictNullChecks` override in `packages/rph-application/tsconfig.json` selects each live entry by
   GLOBAL, `B6-unresolvable-fails-open` among them, with the file as via. ALWAYS: a docs-only change selects the 5
   type-prevented entries, and nothing else, by ALWAYS. Two tests, because one arrangement that trips both limbs
   proves neither.
6. RP0: an entry whose anchor file lies outside its victim's other reach and outside GLOBAL is selected by REACH via its
   anchor file when that file changes outside the anchor span. Such an entry is BLIND (`D21`), so the widening (red 16)
   selects it by WIDE with or without RP0. The transition is in its limbs: with RP0, REACH is among them, via its anchor
   file; without RP0 it is not, and under `--run=reach` the entry is LISTED, NOT RUN. The test asserts REACH and its
   via, not the whole limb set, so `6K` leaves it green. The fixture is built for it, because M8 cannot carry it
   (`§10.4`).
7. Each fold and WIDE rule of `D4` and `D5`, and the reach parts that `5A` and `5B` name (`D3`), one fixture each:
   `` `${ROOT}scripts/coverage-floor.ts` ``, with `ROOT = fileURLToPath(new URL('..', import.meta.url))`, folding to
   `scripts/coverage-floor.ts`, which holds only with the trailing slash `D5` gives `new URL('..', import.meta.url)`
   (`5H`, whose live pin is red 13's `coverage-floor.ts` pin); and the case the mutant table below names for each of
   `5A` to `5G`, `5I` to `5O`, `5T` and `5U`. Owed before roadmap `S4.5`'s exit: a case for the separator `.replace`,
   whose mutant `5W` names only red 13's `probes.ts` read-edge pin; a case, with its mutant, for each other fold `D5`
   lists as owed; and a case, with its mutant, for a spawn whose `cwd` folds to a pure hole (`D4`(b)), which no row
   names (`5K`'s case is a hole in the argv, `5L`'s a relative script).
8. The classifier. Two are measured transitions: an INCONCLUSIVE-only run with status 1 is BROKEN GUARANTEE today and
   must be NO VERDICT; a SURVIVED row with status 0 is OK today and must be BROKEN GUARANTEE. The rest are new guards,
   each shown able to fail by its mutant: a selected id with no row must be NO VERDICT; a SURVIVED control must print
   CONTROL BROKEN; a type-prevented SURVIVED must print the TYPE wording. The two void rules get one arrangement each,
   because `PQ1-V1802`'s real line (`batch-07.log:135`) trips both: an empty-detail vitest KILLED inside a chunk that
   completed must be void; a KILLED line WITH a detail, just ahead of `ABORTED_DIRTY`, must be void. A third case
   feeds `batch-07.log`'s lines 135-142 whole and asserts the message names both reasons for `PQ1-V1802`.
9. Rendering: the LIMIT prints on the NOTHING CHANGED exit (an empty change set), on LEDGER ROT, on a git failure, on
   each refusal and, until roadmap `S4.3`, on the NO PRODUCTION CHANGES EXAMINED exit (hunks, none in production
   source: B7's shape); today the first and the last share `scope.ts:128-133` and print none; B7's shape is never
   worded NOTHING CHANGED (`2T`); each case pins the banner its step prints, re-pinned at `S4.3`, `S4.6` and `S4.7`;
   BROKEN GUARANTEE with an unguarded region under `--strict` exits 1, prints both, and names both on the last line,
   which ends `EXIT 1`; a REMOTE row names the changed path and the edge.
10. The parser: an added line `++ x` stays content, and so does a line `-- x` replaced by `++ y` (printed `--- x`
    then `+++ y`); a deleted file and a rename's old path are in the change set.
11. Flags and ranges, on the functions of roadmap rule 10: `parseFlags` refuses an unknown flag, and `--range A..B`,
    with `mutants:changed — unknown flag <f>.`; the range check, handed `--range=A..B --run` with `HEAD` not at `B` and
    no tracked change, refuses with `⛔ RANGE END IS NOT THE TREE — …`, naming `<HEAD12>` and 0 tracked changes (`3F`);
    handed the same range with `HEAD` at `B` and one tracked change, it refuses with the same message, naming
    `<HEAD12>`, here `B`'s, and 1 tracked change (`3K`), because the runner admits a fully staged tree (`run.ts:192`)
    and only this half refuses it; and its admitting half is red 17's (`3G`). Anchors in a range are located in the
    end's text: `scope-run.ts`'s `locate`, handed a temporary repository whose end `T` holds anchor text the working
    tree does not, locates each anchor in `T`'s text (`3E`). Each refusal asserts its message, never the exit code:
    inside the runner the CLI exits 2 through LEDGER ROT under most mutants, whether or not the flag check holds.
12. Receipts: the base check (roadmap rule 10), handed `--range=K..T --run=all --record` with `HEAD` at `T` and no
    tracked change, refuses a base with no receipt with `⛔ BASE NOT MEASURED — …`, asserted by its message; handed the
    same range with `--run --record` from a base whose chain reaches a whole-ledger receipt, it refuses with
    `mutants:changed — --record requires --run=all.`, asserted by its message (`7N`); handed the same range without
    `--record` from the base with no receipt, it does not refuse that base, a guard green before and after, shown able
    to fail by `7M`, and where no first-parent ancestor of that base is measured the range prints red 21's OWED UNKNOWN
    (`7L`);
    `--range=measured..HEAD`, where no commit on `HEAD`'s first-parent line is measured, exits 2 with BASE NOT MEASURED,
    `<K12>` printed `measured` and `<M12>` `none`, with or without `--record`, never read as an empty base (`7O`);
    a survivor recorded at the base is selected by OWED; a receipt written under an older rule owes what the current
    rule adds; an entry SURVIVED at the base, and again at the end, prints the OWED wording and *"SURVIVED at K12 per
    receipt <id>: this change did not make it slack"*, even when the change also touched its anchor; and a receipt
    written from a log holds each KILLED row with the runner's detail, so `PQ1-V1802`'s empty one is visible in the
    receipt itself.
13. Live pins over the real tree, about 4 s. Before `S4.5` their module does not exist, so they are guards, each shown
    able to fail by its mutant; the one first red is the `coverage-floor.ts` pin, which the scratch scanner fails. The
    fingerprint test's edges include its import of `../scripts/reviewer-qual/probes.js` (line 157) and its read of
    `scripts/reviewer-qual/probes.ts` through `REPO` (line 866 at `f6b78109`, 871 at `W`), each pinned as an edge
    (`6L`, `5W`): the file is in that reach by imports, also through `fingerprint.ts` (`:119`), and by paths built on
    `REPO`, also the folder `scripts/reviewer-qual/` it copies (line 656 at `f6b78109`, 661 at `W`), so a pin on reach
    alone survives each single mutant below; `packages/rph-application/src/command-bus-groups.test.ts` reaches
    `packages/rph-contracts/src/hash.ts` through `'@janumipwb/rph-contracts/hash'` (line 11);
    `apps/rph-demo/src/lib/server/agent/system-prompt.test.ts` reaches `apps/rph-demo/src/lib/authoring/pwuType.ts`
    through `'$lib/authoring/pwuType'` at `system-prompt.ts:12`; each package victim reaches
    `verif/draft-dependency-premises.ts` and, through its literal read at line 33, `authoring-turn.ts`; each
    Playwright victim reaches `apps/rph-demo/src/app.html`; the fingerprint test's edges include its `import type` of
    `process-run-observer.ts` (line 124), an edge because a folder in its reach covers the file;
    `verif/coverage-floor.test.ts` reaches `scripts/coverage-floor.ts`; the alias rules equal the config's; and BLIND
    entries of tests that are not WIDE number 0, over the ledger's named-victim live entries, the count shown able to
    fail by `5D` and the population by `5V`.
14. The runner call (`S4.2`), on `scope-run.ts`'s `runChunks`, each observed against today's spawn, moved there
    unchanged with its command and folder made parameters: `WP11-M1 restore the tautology: explicitNoOutput:
    !hasOutput` reaches an argv-echo child as six arguments, and must arrive as one; `WP11-M7 zero-subject floor never
    fires (aiProduced -> false)` writes a file named `false)` into the working folder, and must arrive whole with no
    file written. With the test's own `MUTANTS_EXACT` set to `0` for the call, the child reads no `MUTANTS_EXACT=1`
    today, and must read it. The `0` is needed: a `mutants:changed --run` hands `MUTANTS_EXACT=1` to the runner, which
    passes its environment to each victim (`run.ts:152`), so a test that leaves its own value alone passes under `2U`.
    The argv-echo child runs in a fresh temp folder: in the package root, `2P`'s stray file would pass the runner's
    tree check (`run.ts:195`) and stop the next lane chunk (`run_lane4.sh`'s `git status --porcelain`). The chunker:
    200 synthetic ids of 120 characters (24,200 characters with separators) must split into chunks of at most 20,000
    characters, because real ids cannot reach the cap (`D19`); a victim whose entries fit stays in one chunk; no chunk
    is empty; and a whitespace id's verdict line parses back to that id.
15. The runner's exact mode (`S4.4`), on `verdict.ts`'s exports and `classifyChunk`, never by running `run.ts`: under
    `MUTANTS_EXACT=1`, `MU-PFA-AF3-DEFAULT_CONTEXT_ASSEMBLY_POLICY` selects itself alone; an empty id list is refused,
    where today it selects the whole ledger; each verdict kind's line, formatted by `verdict.ts`, parses back to its
    verdict and id, `TYPE_PREVENTED` and `KILLED_UNNAMED` included, which fill their 14-character column; and
    `classifyChunk` counts an exact chunk that sent `WP11-M4 admit TIMEOUT as success-compatible` alone and reads
    `Running 1 declared mutant(s)`, which `S4.2`'s twin allowance calls INSTRUMENT DID NOT RUN.
16. The BLIND widening (`D21`), a red before its limb (`S4.6`). A fixture in the B7 test's form, with no git and no file
    system: a victim with two entries, neither type-prevented, no file of its reach holding an opaque site, one entry
    anchored in a file of that reach and one BLIND, its anchor file outside that reach and outside GLOBAL; a change set
    of one file that is not the BLIND entry's anchor file and lies outside the victim's reach and outside GLOBAL, the
    ledger unchanged. Each of the victim's entries is selected with WIDE among its limbs, naming the BLIND entry and its
    anchor file in place of a site (`D4`), and the report's banner counts
    the BLIND entry, `<b>` 1 and `<x>` 1: the words REACH INCOMPLETE alone cannot fail, since the banner prints them on
    each exit path (`§10.4`). The transition: without the widening, no limb selects either entry. The changed file is
    not the BLIND entry's anchor file, because RP0 selects that entry by REACH through that file with or without the
    widening. The entry anchored inside the reach is there because `D21` treats the victim as WIDE, not the BLIND entry
    alone: a widening of that entry alone passes a fixture that holds only it. The test asserts WIDE among the limbs,
    not the whole set, so `6B` leaves it green; `6H`'s fixture, whose victim is WIDE by an opaque site, stays green
    under `6K`. The BLIND pin (red 13) cannot carry this red: it holds the count at 0, so on the real tree no victim is
    widened.
17. The `S4.2` and `S4.3` cases of the mutant table that no other red holds. Three guards, each shown able to fail
    by its mutant: a result holding listed entries renders `LISTED, NOT RUN …` and exits 0 (`2J`); each flag known at
    its step is accepted by `parseFlags`, and the case gains each flag a later step adds (`2L`); the range check
    admits `--range=K..T --run` with `HEAD` at `T` and no tracked change (`3G`). One transition (`3H`): in the edit
    loop an untracked file is in the change set as added; it is observed first against a replica of today's call
    (`git diff --unified=0 --no-color --relative HEAD`, `scope.ts:86-89`), returned by `scope-core.ts` as the edit
    loop's argv list and run in a temporary repository, which leaves it out. A second transition (`3J`): a diff over
    1,048,576 bytes is read whole (`D12`). In a temporary repository holding a commit whose diff is larger,
    `scope-run.ts`'s `runGit` must return the whole diff; it is observed first with today's call moved there unchanged
    (`spawnSync`'s default buffer, `scope.ts:89`), which fails with `ENOBUFS`, as `--range=91ec502d..8a703e2a`'s
    1,753,193-byte diff does today (`§10.1`).
18. RP6 (`5Q`): a whole-suite control's reach holds the closures of two fixture test files.
19. ENTRY and GLOBAL, two transitions, each red before `S4.6`: an entry present in the base ledger with a
    `supersededBy` that the end removes is selected by ENTRY (`6D`); a change to `verdict.ts` alone selects each live
    entry by GLOBAL, through the runner's closure (`6I`). And a guard (`6J`): a production hunk in a file a victim
    reaches, overlapping no anchor, stays UNGUARDED CHANGE beside the REACH selection.
20. The receipt writer and its check. Four guards: a chunk log with no summary banner and no abort line gives
    NO VERDICT for each of its ids (`7D`); a log holding two rows for one id and no supersede is refused (`7E`); in a
    temporary git repository, a receipt added in one commit and edited in the next is refused (`7H`); a fixture folder
    of n receipts is read as n (`7K`). One transition (`7G`), red before the base check: handed `--record`, the base
    check refuses a base whose receipt chain ends at a range receipt with BASE NOT MEASURED, asserted by its message.
    Owed before roadmap `S4.7`'s exit, their ids not yet assigned: a guard and a mutant for each rule `§10.7` gives the
    writer over lane logs from `collect.py`, among them that an id measured in two lanes keeps its latest row by its
    chunk's START time, not the lexically last lane's (roadmap `S4.0`'s case (3)), and that a renamed `.stopped-<n>`
    log is never read.
21. Two missing inputs are never read as empty, one test each (`§5`'s reader-blinded case). (a) A reach build that
    throws exits 2 with `⛔ REACH COULD NOT BE BUILT — <reason>.`, asserted by its message, not by the exit code alone.
    It prints no REACH or WIDE count, so it cannot read as red 3's `REACH 0`; the LIMIT still prints (`D18`), its WIDE
    and BLIND values as `unknown`, never 0 (roadmap `S4.6`). The test hands `reach-core.ts`'s conversion a build that
    throws and renders what it returns with `renderReport`: the conversion catches the throw and returns it with its
    reason, never an empty reach and never a throw into `scope.ts`, which no test reaches (`D18`; roadmap rule 10). (b)
    Without `--record`, a range whose base has no measured first-parent ancestor, and an edit loop whose `HEAD` has
    none, print `OWED UNKNOWN`, never an empty OWED; under `--record` the same base exits 2 with BASE NOT MEASURED
    (red 12), a second arrangement (roadmap `S4.7`).
22. LOCAL on any path (`D6`): a changed line inside a `scripts/` anchor selects the entry by LOCAL, where today it
    selects nothing. The test asserts the limb, not the selection: from `S4.6`, RP0 also selects that entry, by REACH
    via its anchor file (red 6).
23. WIDE (`D4`): a change to a file outside the reach of a victim WIDE by an opaque site, touching no anchor, selects
    the victim's entries by WIDE, each naming the first site that made it WIDE; before `S4.6` it selects none of them.
    The test asserts WIDE among the limbs, not the whole set, so `6B` leaves it green.
24. The reach at a range end (roadmap `S4.6`), never through the CLI (roadmap rule 10). In a temporary repository whose
    commit `T` differs from the working tree, with `HEAD` elsewhere and the working tree clean at `HEAD`, the test hands
    `reach.ts`'s range-end build that repository and `T` and calls `selectChange` on the reach it returns: the entry is
    selected by REACH via a file its victim imports only at `T`, and the entry's record, as `renderReport` prints it for
    `--explain=<id>`, shows in RP2 the setup file that only `T`'s `vitest.projects.ts` declares, not the working tree's.
    On real history `7e8725ba` is such an end: its root config declares no setup file and its package and app projects
    two, where `f6b78109`'s declare one and three.
25. Today's rule, pinned as it moves (roadmap `S4.1`): five guards over `selectChange`, green from the move on, one limb
    each, each shown able to fail by its own mutant (`1A` to `1E`): a production hunk inside an anchor
    selects that entry by LOCAL; one in the anchor's file outside its lines does not; one in a file no anchor names is
    UNGUARDED; one inside an anchor is not; a `scripts/` hunk in a file no anchor names is not UNGUARDED. The 17 cases
    of `verif/mutants-scope.test.ts` cannot carry them: they call only `scope-core.ts`'s five helpers, and today's
    composition sits inline in `scope.ts`, which nothing imports (`D18`).

**RECORDED ONCE ON REAL HISTORY,** as REPLAYs by the built tool (`D14`), quoted in the roadmap beside today's before,
not gate tests: `--range=ddd75ae9^..ddd75ae9` must list the four under REACH with `scripts/reviewer-qual/probes.ts`
among their vias, where today it prints the two lines above and exits 0; `--range=7e8725ba^..7e8725ba` must list M7
and M8 under REACH with `packages/rph-domain/src/enforcement-register.ts` among their vias, where today it exits 0 with
4 GUARD lines, none of them M7 or M8 (`scope-7e8725ba.out`); its `--explain=M8-wire-dead-predicate` must show no
setup file absent at `7e8725ba`; `--range=91ec502d..8a703e2a` must hold the four, where today it exits 2 with
`mutants:changed — git diff failed: ` and no reason (`ENOBUFS`: its 1,753,193-byte diff is past `spawnSync`'s
1,048,576-byte default buffer, `§10.1`). That before claims nothing, so the third is a recorded selection, not a red.
⚠ The check reads the via LIST, not the first via: 12 of B7's 22 changed paths lie in the victim's scratch reach,
6 as files and 6 through the folder `scripts/reviewer-qual/` (`b7-vias.out`), so a correct rule may print any of
them first.

**THE PREMISES ARE OWED A MEASUREMENT.** `REG-F-100`: *"present-then-absent is the only thing that means REMOVED
HERE."* The four are owed KILLED at `ddd75ae9^` and SURVIVED at `ddd75ae9`; M7 and M8 the same at `7e8725ba^` and
`7e8725ba`. B7's attribution rests on `git log -S` and reasoning, though `REG-F-584`'s heading states it. M7 and M8's
rests on the dispositions measured at the branch point `180c094d`, which show their subject already gone
(`ROADMAP-undertaking-execution-sandbox.md:1051-1063`). Neither is a measured transition.

**THE RULE'S OWN MUTANTS** (ledger ids `MU-PFA-R2R-<step><letter>-<slug>`; victims in `verif/`). Each but the control
`6Z` is aimed at one limb and names the test, or the tests of that limb, that must redden; one test may redden under
more than one mutant of one limb (the cases of `2B` and `2C` under `2A`; red 8's third case under `2D` and under `2F`;
the BLIND pin under `5D` and `5V`; the alias-rules pin under `5R` and `5S`; the B7 test under `6A` and `6L`; red 16
under `6H` and `6K`; red 24's case under `6O`, `6P` and `6Q`); a mutant that reddens tests of two limbs is split, and
where no split can part them (`6L`, `6M`: the closure red 13's reach pins and its BLIND pin also walk; in a scratch
model `5F` and `5P`: other rules of the static reach those pins walk on the real tree, roadmap `S4.5`) its kill is read
through its named tests, by name, from one run of the victim under the mutation. A
KILLED line cannot show which tests reddened: it grades the victim file, and its detail is the run's last line holding
`Tests ` (`run.ts:1027-1035`). So each step's exit quotes the tests that redden under each of its mutants, read from a
run of the victim under it.

| id | the mutation | the test or tests that must redden |
| --- | --- | --- |
| `1A` | LOCAL selects from no hunk | a production hunk inside an anchor selects that entry by LOCAL |
| `1B` | the overlap `selectChange` applies read as same-file, its line range ignored | a production hunk in the anchor's file, outside its lines, does not select it by LOCAL |
| `1C` | UNGUARDED taken from no hunk | a production hunk in a file no anchor names is UNGUARDED |
| `1D` | UNGUARDED taken from each production hunk, anchored or not | a production hunk inside an anchor is not UNGUARDED |
| `1E` | the production filter dropped | a `scripts/` hunk in a file no anchor names is not UNGUARDED |
| `2A` | the classifier decides by the exit status again | the INCONCLUSIVE-only case and the `MUTANTS_ADVISORY=1` case, a SURVIVED row at status 0 (those `2C` and `2B` name) |
| `2B` | SURVIVED rows ignored when the status is 0 | the `MUTANTS_ADVISORY=1` case |
| `2C` | INCONCLUSIVE rows read as SURVIVED | the INCONCLUSIVE-only case |
| `2D` | a vitest KILLED with an empty detail accepted | the empty-detail case, in a completed chunk |
| `2E` | a selected id with no row counted as held | the missing-row case |
| `2F` | the line just ahead of ABORTED_DIRTY kept | the abort case, its KILLED line carrying a detail |
| `2G` | a SURVIVED control worded as LOCAL or REMOTE | CONTROL BROKEN wording |
| `2H` | exit 3 placed ahead of exit 1 | the order case |
| `2I` | the banner left off the NOTHING CHANGED path | the banner on each exit |
| `2J` | LISTED, NOT RUN rendered as NO VERDICT with exit 2 | the listing case |
| `2K` | an unknown flag accepted | the flag case |
| `2L` | each known flag refused (the admitting half) | known flags accepted |
| `2M` | a REMOTE row printed without its edge | the REMOTE row case |
| `2N` | the chunker ignores the character cap | 200 synthetic ids of 120 characters split under 20,000 (red 14) |
| `2O` | the chunker splits a victim that fits | the grouping case |
| `2P` | the ids joined into one shell command (`shell: true` restored) | `WP11-M7`'s id arrives whole, and no file is written |
| `2Q` | the row parser splits a verdict line on spaces | a whitespace id's line parses to that id |
| `2R` | the chunker emits a trailing empty chunk | no chunk is empty |
| `2S` | a type-prevented entry's SURVIVED worded as LOCAL | the TYPE wording case (red 8), its limbs LOCAL and ALWAYS |
| `2T` | a change set whose hunks all lie outside production source worded NOTHING CHANGED | the B7-shape case |
| `2U` | the spawn's `env` loses its `MUTANTS_EXACT: '1'` entry | the argv-echo child reads `MUTANTS_EXACT=1` while the test's own `MUTANTS_EXACT` is `0` |
| `3A` | any `+++ ` line taken as a header | the `++ ` case |
| `3B` | deleted paths dropped | the deletion case |
| `3C` | `--no-renames` dropped | the rename case |
| `3D` | LOCAL keeps the production filter | a changed line inside a `scripts/` anchor selects it by LOCAL (red 22) |
| `3E` | a range locates anchors in the working tree | the end-tree case (red 11) |
| `3F` | `--range --run` accepted with `HEAD` not at the end | the refusal case, `HEAD` not at the end (red 11) |
| `3G` | `--range --run` refused with `HEAD` at the end and a clean tree | the admitting case |
| `3H` | the `ls-files --others` call dropped from the edit loop | the untracked case |
| `3I` | a `+++ ` line read as a header whenever a `--- ` line directly precedes it (a rule keyed on the `--- ` line alone, which `D12` rejects) | the replaced-pair case, `-- x` to `++ y` |
| `3J` | `runGit` reads through `spawnSync`'s default buffer | a diff over 1,048,576 bytes is read whole (red 17) |
| `3K` | `--range --run` accepted with `HEAD` at the end and a tracked change | the refusal case, `HEAD` at the end with one tracked change (red 11) |
| `4A` | `MUTANTS_EXACT` matching by substring | `_POLICY` selects itself alone |
| `4B` | an empty id list accepted under `MUTANTS_EXACT=1` | an empty list is refused (red 15) |
| `4C` | the formatter drops the separator between the verdict and the id | the round trip over each verdict kind |
| `4D` | the substring-twin allowance kept for an exact call | an exact chunk that sent `WP11-M4 …` alone counts (red 15) |
| `5A` | type-only imports dropped | a fixture whose one edge to its target is `import type`; the live pin on that edge |
| `5B` | setup files left out for package and app victims | the setup test and its pin |
| `5C` | a literal prefix yields no folder | a file added under a walked folder |
| `5D` | an opaque site leaves its victim not WIDE | an opaque read makes the victim WIDE and names the site; the BLIND pin's count |
| `5E` | an exported function's parameter folded from the file's own calls | the exported-helper case |
| `5F` | the temp-root rule matches the package root | a package path is never a temp path |
| `5G` | `$lib` resolved for a `verif/` importer | the `$lib` case |
| `5H` | `new URL('..', import.meta.url)` resolved without its trailing slash | the `coverage-floor.ts` pin |
| `5I` | an absent path under an untracked folder accepted as seen | the mis-joined-path case |
| `5J` | a destructured `await import('node:fs')` left unmodelled | the unmodelled-fs case |
| `5K` | a hole in a spawn's argv skipped | the spawn-hole case |
| `5L` | a spawn's `cwd` ignored | the relative-script case |
| `5M` | a git call left out of WIDE | the git case |
| `5N` | a function passed by reference folded from its explicit calls | the by-reference case |
| `5O` | a climbing recursion treated as descending | the climbing case |
| `5P` | the app folders left out of a Playwright victim's reach | the `app.html` pin |
| `5Q` | the whole-suite union left out of a control's reach | the control case |
| `5R` | the subpath alias dropped from the rules read from the config | the `hash.ts` pin; the alias-rules pin |
| `5S` | the `$lib` alias dropped from the rules read from the config | the `pwuType.ts` pin; the alias-rules pin |
| `5T` | a route's `import type` of `./$types` left to `D4`(e), so its victims go WIDE | the `./$types` case |
| `5U` | any import of `./$types` accepted, a value import among them | the `./$types` value-import case |
| `5V` | the BLIND check run over no entry | the BLIND pin's population |
| `5W` | a `.replace` that only normalises separators folded as a hole, so each path built on the fingerprint test's `REPO` (`:174-176`) is opaque | the `probes.ts` read-edge pin |
| `6A` | `selectChange` drops REACH | the B7 test (first red); the `7e8725ba` test |
| `6B` | REACH selects each live entry | the admitting half |
| `6C` | ENTRY removed | the `63ef7bc1` case |
| `6D` | ENTRY ignores history fields | an entry made live again is selected |
| `6E` | GLOBAL's name pattern dropped | the tsconfig override selects by GLOBAL |
| `6F` | ALWAYS removed | the docs-only ALWAYS case |
| `6G` | RP0 dropped | the anchor-file case |
| `6H` | WIDE selection dropped | a change outside a WIDE victim's reach selects its entries by WIDE (red 23); red 16 |
| `6I` | GLOBAL's runner closure dropped | a change to `verdict.ts` selects each live entry |
| `6J` | a REACH selection counted as guarding a region | UNGUARDED counts LOCAL anchors only |
| `6K` | a BLIND entry of a test that is not WIDE left unwidened | the BLIND widening case (red 16) |
| `6L` | import edges dropped (setup edges kept) | the B7 test; the `probes.ts` import-edge pin |
| `6M` | the closure stops at direct imports | the transitive test (red 2) |
| `6N` | a reach build that throws read as an empty reach | the reach-failure case (red 21): REACH COULD NOT BE BUILT by its message, exit 2, no `REACH 0` |
| `6O` | a build at a commit reads the working tree's files | the range-end case (red 24): REACH via a file its victim imports only at `T` |
| `6P` | a build at a commit reads the working tree's configs | the range-end case (red 24): RP2 holds the setup file only `T`'s `vitest.projects.ts` declares |
| `6Q` | the range-end build, handed `T`, lists and reads `HEAD`'s objects | the range-end case (red 24): REACH via a file its victim imports only at `T`, with `HEAD` elsewhere |
| `6Z` | ⭑ CONTROL (`expectSurvive`): a comment edited in `reach-core.ts` | none — each test stays green |
| `7A` | a base with no receipt treated as measured | BASE NOT MEASURED |
| `7B` | each base refused (the admitting half) | a base whose chain reaches a whole receipt is accepted |
| `7C` | OWED dropped | a base's survivor is selected |
| `7D` | the writer accepts a chunk without the summary banner as held | the banner-less chunk case (red 20) |
| `7E` | two rows for one id without a supersede accepted | the journal case |
| `7F` | a change of rule digest ignored | the older-rule case |
| `7G` | a receipt chain not followed to a whole receipt | the chain case |
| `7H` | an edited committed receipt accepted | the append-only case |
| `7I` | an entry SURVIVED at the base worded as LOCAL when its anchor also changed | the OWED precedence case |
| `7J` | a receipt's KILLED rows written without their detail | the writer keeps each KILLED row's test result |
| `7K` | the receipt check reads no receipt | a fixture folder's receipts all read; from `S4.8`, `W`'s receipt named |
| `7L` | a base with no measured first-parent ancestor read as owing nothing | the no-ancestor case (red 21), without `--record`: `OWED UNKNOWN` printed |
| `7M` | BASE NOT MEASURED raised without `--record` | the base check admits a range without `--record` from a base with no receipt: no BASE NOT MEASURED (red 12) |
| `7N` | `--record` admitted without `--run=all` | the base check refuses `--run --record` from a measured base with `--record requires --run=all` (red 12) |
| `7O` | the keyword `measured` with no measured commit read as an empty base | `--range=measured..HEAD` with no measured commit exits 2 with BASE NOT MEASURED (red 12) |

The capture audit (`D22`; roadmap `S4.9`) adds one mutant per fix it causes, `9A` onward, each naming the fixture red
that must redden under it; they cannot be listed before the audit runs.

`3C`, `3E` and `3H` mutate a git call or the text a range reads, which diff text cannot show, so their cases test the
argv lists `scope-core.ts` builds for each mode, or run them with `git` in a temporary repository holding a rename, an
untracked file and a commit whose anchor text differs from the working tree, `3E`'s through `scope-run.ts`'s `locate`.
`3J` mutates `scope-run.ts`'s `runGit`, whose case runs it in a temporary repository holding a commit whose diff is over
1,048,576 bytes. `3F`, `3G` and `3K` test the range check `scope-core.ts` decides, `2K` and `2L` its `parseFlags`, `7A`,
`7B`, `7G`, `7M`, `7N` and `7O` its base check, `2P` and `2U` `scope-run.ts`'s `runChunks`, and `6N` `reach-core.ts`'s
conversion of a reach build's failure, handed a build that throws. No case drives the CLI or reaches `scope.ts`, which
exports nothing and runs its git and runner calls in `ROOT` (`scope.ts:56`, `:89`, `:162-166`; roadmap rule 10).
`MU-PFA-R2-A` to `-E` stay KILLED. `D` and `E` are anchored on the classifier's lines (`scope-core.ts:96-97`) and are
re-anchored in the same commit as the new classifier, or `verif/mutant-ledger.test.ts`'s anchor census reddens. `1A` to
`1E` are anchored in `selectChange` (`reach-core.ts`) and are re-anchored in the same commit wherever roadmap `S4.3` or
`S4.6` changes their lines. `2Q` is re-anchored on `verdict.ts` in the commit that moves the row parser there (roadmap
`S4.4`), and is KILLED again on its new anchor. So is each live entry of this table, and each of `MU-PFA-R2-A` to `-E`,
wherever a later step changes its lines or edits its named test; that step's exit quotes it still KILLED (`6Z` still
CONTROL_HELD), with the tests that redden under it, read from a run of its victim under it. The planned edits that may
do so: `S4.3`'s exits, banner and provenance line in `renderReport`; `S4.4`'s count in `classifyChunk`, where
`MU-PFA-R2-D` and `-E` and `S4.2`'s classifier entries sit; the flags `S4.6` and `S4.7` add to `parseFlags` and to
`2L`'s case, and their banner, listing and refusals in `renderReport`; `S4.6`'s range-end resolution in `reach.ts` and
its BLIND widening; `S4.7`'s OWED in the selection and its wording; `S4.9`'s fixes to the fold and to opaque sites; and
red 9's banner case, re-pinned at `S4.3`, `S4.6` and `S4.7`. The anchor census only counts each anchor's occurrences in
its file (`verif/mutant-ledger.test.ts:249-250` at `f6b78109`), so it catches a lost anchor, not a lost kill; and the
phase's one whole-ledger run measures `W`, whose ledger holds no entry of this table.

---

### 10.10 · The one-time measurement of the whole ledger

**WHAT IT IS.** `bun run mutants` over each entry of the final integrated tree, with the existing runner, unchanged.
`W` is `c603fb69` on `p7c-p6-int2`: package V-2 merged (`3edfeac1`), its check's comment fixes (`5323ed4f`), and the
per-file coverage floor tightened. `W` holds 4,119 entries, 4,035 live, over 393 victims. Afterwards each live entry
has a known verdict at `W`, and `W` becomes the first base later scopes build on (`D16`). Steps 1-7 below are the
procedure running, as `c1-facts.md`, the lane runner `run_lane4.sh` and the queue builder `make_queue2.py` record it;
steps 8-10 add what this design requires of the tally; the collector `collect.py` has held the tally's part since
2026-10-30 (step 8), and the re-queues and re-measures are by hand. The queue's amendments, the claim, the stop rules
and the void rule are the lead's delegated decisions (`REG-D-138` (2), (8)), the sponsor's review owed. The lanes
started at 2026-10-29T22:06:54Z.

**PROCEDURE, AS RUN.**

1. **The tree.** `W`, by its 40-hex id. `gate:fast` ran on `5323ed4f`, which differs from `W` by
   `verif/floors/per-file-floor.baseline.json` alone: each step green but `reviewer:qual:check`, red on 3 problems,
   all COVERAGE. On `W`, `coverage:floor:check` is green. So an INCONCLUSIVE row whose detail says the victim was
   already red can be read against a named red.
2. **Lanes.** 4 worktrees, each detached at `W`, each with its own `bun install --frozen-lockfile`, and
   `packages/*/dist` and `apps/rph-demo/.svelte-kit` copied in from the integration's tree (tsc reads package types
   from dist). Never a junction of `node_modules`: workspace links would resolve to another tree and hide a
   mutation. Each lane's 12 `@janumipwb/*` links resolve inside that lane, and its ten dists are byte-identical to
   the source's, 565 files. While a runner is in flight in a lane, nothing else touches it.
3. **The lane runner** (`run_lane4.sh`) does not start without its queue folder and lane tree (exit 2). It refuses
   to start a chunk on a dirty tree, a failing `git status` or `git rev-parse HEAD`, a `HEAD` other than `W`, a busy
   port, a failing `netstat` or a chunk with no id. It passes each
   chunk line as one argument, `bun run mutants -- "$@"`, never through a shell or `$(cat …)`: 60 of 4,119 ids hold
   whitespace (`§10.1`). It STOPS its lane when, after a chunk, `git status` fails or the tree is dirty; when the
   runner exits 2; when the log holds a line beginning `ABORTED:`, `ABORT:`, `RECOVERING` or `FAIL:`, or an
   `ABORTED_DIRTY` row other than `ABORTED_DIRTY 0`; or when the log lacks the runner's summary or its line
   `<n> entries -> ` for the n ids it read. It goes on after a survivor.
4. **⛔ A CLAIM IS A MARKER, THEN A RENAME.** A lane takes `mkdir <queue>/.claim/<chunk>` first, then moves the chunk
   into its own folder, and keeps it only if it landed there. A rename alone is not exclusive on this host: in 150
   races of two concurrent `mv` of one file, both reported success 5 times (GNU coreutils 8.32, MSYS 3.6.6), and 156
   of 200 times with a barrier releasing them together; `mkdir` gave 0 of 500, 300 and 100 with 2, 4 and 8
   processes. The lane that lost would have read no ids, and the runner given none selects the whole ledger
   (`run.ts:1079-1081`): about 47 h measured a second time. The run's check found both before any lane started, and
   the general form once, a lane check whose own failure reads as a pass; C1's fix round found three more
   (`c1-facts.md`).
5. **⛔ PORTS, AND THE PLAYWRIGHT ENTRIES LAST.** `apps/rph-demo/playwright.config.ts:22` reads
   `process.env.RPH_E2E_PORT ?? 4319`, and the server runs with `--strictPort` and `reuseExistingServer: false`. Two
   Playwright runs on one port collide, and a mutated run that fails because the port is taken reads KILLED: the
   unsafe direction. So each lane has its own port, 4360 plus its number. And the 140 entries whose victim is a
   Playwright spec (138 live, 1 of them a control) are in a queue of their own. One lane runs it, only once the main
   queue is empty and each main lane is DONE, with none STOPPED. That is how the gate runs them: after vitest, on a
   quiet machine.
6. **Canaries, before the queue opened.** First, 6 entries (two fingerprint-test, one cases-test, one validator-test,
   one other app unit test, one Playwright) at the same time in the integration's tree and lane 1: identical
   verdicts and counts, `KILLED      6`, `6 entries -> 6 distinct mutations measured (0 duplicate, 0 retired, 0
   abolished).` A canary of kills alone cannot show that a lane reports a survivor. So second,
   `M8-wire-dead-predicate` and `P6X-O2-M13-the-read-back-baseline-names-an-attempt`, at the same time in the
   integration's tree and lanes 2, 3 and 4: in all four, `SURVIVED       M8-wire-dead-predicate             Tests  61
   passed (61)`, and `P6X-O2-M13` KILLED with `Failed Tests 2`, the verdict blocks identical. ⚠ **WHAT THE CANARIES
   DO NOT SHOW.** Neither held a control. None of the six KILLED entries is anchored under `packages/`, the only tree
   the workspace alias maps. `M8`'s victim reaches its anchor through `import { Engine } from
   '@janumipwb/rph-application'` in a setup file, and it SURVIVED, which a resolution to `dist` would also give. So
   the canaries do not show that a lane grades a control as the integration's tree does, or that it resolves a
   workspace package to source. Source resolution rests on structure: the root config maps each `@janumipwb/*`
   specifier to `packages/<name>/src` beside itself (`vitest.config.ts:74-77`). The record states this limit.
7. **The queue** (`make_queue2.py`) holds each id of `W`'s ledger, 4,119, history included, because the runner decides
   history at no cost and reports it. It is 76 chunk files, one runner call each, of at most 200 ids, 24,000
   characters and an estimated 2,550 s. A chunk holds one group, its ids ordered by victim, so a victim's baseline is
   paid once per call (`run.ts:580-598` caches it per process); 22 of the 76 hold more than one victim, up to 57.
   With real ids the character cap never binds (the largest chunk is 11,304 characters): the 2,550 s estimate
   closes 57 of the 76 chunks, the 200-id cap 12, and a group's end 7. Ids one of which is a substring
   of another, 4 pairs, share a chunk. Lexical file order is run order: the runner's own guards first (33 entries
   whose victim is `verif/mutant*.test.ts`), because each other verdict rests on them; then the fingerprint test (44
   chunks of 3 to 12 ids); then the other reviewer victims (12 chunks: the reviewer-qualification, fence and
   assurance tests, and each victim whose base name names a reviewer); then the rest (12); then the controls (2).
   The second queue holds the Playwright entries (4 chunks) and their control (1).
8. **THE VOID RULES.** As recorded (`REG-F-585`; `REG-D-138` (2); `c1-facts.md`) and as `collect.py` applies them: for
   a vitest victim, a KILLED line with no test result is void and re-measured: in batches 01-07, 1 of 864 KILLED lines
   had an empty detail (`PQ1-V1802`); 824 carried a `Failed Tests N` banner, 29 an excerpt of the failure, 8
   `Tests  no tests` and 2 `Tests  N skipped (N)`. ⚠ A Playwright KILLED has an empty detail by construction:
   `run.ts:1027-1035` keeps the last line containing `Tests `, and Playwright prints none (the canary:
   `KILLED         ER1-M254-the-line-is-rendered-before-the-hint `, nothing after). So a Playwright kill is accepted
   only from the quiet queue of step 5, and only from a chunk that ended normally: the runner's summary printed, END
   recorded, no stop. The record states this limit too. A chunk a lane STOPPED on (step 3) stays in that lane's folder,
   and so does one a killed lane had claimed, with START and no END if its runner had started. Each is re-queued by
   hand: its log, if it has one, renamed `<chunk>.log.stopped-<n>`, because `run_lane4.sh:153` writes `<chunk>.log` with
   `>`, so the same lane claiming it again would overwrite it (`c1-facts.md`); its marker `STOPPED-<chunk>`, if it has
   one, renamed `handled-STOPPED-<chunk>-<n>`, because `collect.py` reads a chunk's marker by name
   (`collect.py:115-116`, `:158-159`) and `run_lane4.sh:103` refuses the e2e queue while any `STOPPED-*` exists in a
   main lane; its claim marker, if one is left, removed; the chunk moved back into its queue; and its lane relaunched. A
   lane killed while claiming (`run_lane4.sh:113-117`) leaves a claim marker in `<queue>/.claim/`, and no lane can claim
   that chunk until the marker is removed by hand (`c1-facts.md`). A chunk that reached START has none:
   `run_lane4.sh:117` removed the marker before START (`:149`). The tally reads only the `<chunk>.log` beside each chunk
   file (`collect.py:117-122`), and the receipt writer reads the same files under the same chunk test (`§10.7`; roadmap
   `S4.7`), so a `.stopped-<n>` log is kept as evidence and never read into `W`'s receipt. ⚠ **ADDED BY THIS DESIGN; ITS
   TALLY RULES IN `collect.py` SINCE 2026-10-30** (sha256 `da626278…`; `c1-facts.md`, *The tally's three rules*):
   `§10.8`'s chunk test for vitest rows, with its abort rule (the line just ahead of `ABORTED_DIRTY` void whatever its
   detail, the `ABORTED_DIRTY` row itself no verdict, each row after it NO_VERDICT and each planned id with no row
   MISSING, all four owed); an id measured twice keeps its latest verdict, by its chunk's START time, where the
   collector before the fix (`collect_v1.py`, sha256 `2d9bda71…`) kept the lexically last lane's (`:88`, `:95`, `:145`);
   an id voided twice is listed (a vitest KILLED with no test result, or the line just ahead of `ABORTED_DIRTY`; a
   Playwright kill voided by the e2e rule is not counted, `collect.py:205-210`). **By hand:** each owed id after the
   abort is re-queued and a void id is re-measured alone, both rules in neither file; an id listed as voided twice is
   investigated before a third run (`collect.py:22`). Three red arrangements and their control (roadmap `S4.0`) gave *"1
   of 4 cases pass"* on the collector before the fix (`reds-v1.out`) and *"4 of 4 cases pass"* after (`reds-v2.out`),
   before any count of the lanes was quoted; none holds an id voided twice, so that list has no red.
9. **Blocking rows on `W`.** SURVIVED goes to the survivor procedure. INCONCLUSIVE has five causes in the runner, and
   each row's detail names which: for a named victim, the victim was red before the mutation (`verdict.ts:82-89`);
   for any entry, the run timed out (`run.ts:668-682`) or did not complete (`run.ts:720-722`); for a control, its
   failed run wrote no report, or its report names no failing test file (`verdict.ts:120-139`). A red on `W` is itself
   a finding, and the entry is re-measured once it is fixed; each other cause is re-measured alone on a quiet lane.
   NO_COMPILE and UNANCHORED are ledger rot and must be 0.
10. **Complete** when each live id at `W` has exactly one non-void verdict, its latest, or is named as owed: those
    two number 4,035, and the history rows 84 (45 RETIRED, 10 DUPLICATE, 29 ABOLISHED).

**COST: TWO ESTIMATES, NEITHER MEASURED.** At the brief's rates, about 81 h serial for `W`'s 4,035 live entries (390
at 222 s, 318 at 20 s, the rest at 60 s), plus victim baselines. The queue's own model gives 46.8 h (main 43.96 h,
e2e 2.85 h; `plan2.json`): it charges each victim its test file's duration in a vitest report, plus
6 s. The integration's batches 04 and 05 took 52 s per entry serially (2 h 43 min 36 s for 200, 32 min 1 s
for 24; their `progress.txt`). 223 of those 224 entries are in the queue's reviewer group, which the model allows
about 22 s per entry (7.88 h over 1,283 live). So the model is likely low. The controls: 7 of the 14 live ones run
the whole suite, and 7 run only their named victim (`run.ts:345-358`, `:608-611`), one of them a Playwright spec.
Each call that holds a control first takes one whole-suite baseline (`run.ts:1111`; 444.9 s in batch-02). The queue
puts 12 controls in its two control chunks, `PQ2-M60` in a reviewer chunk and `S3-CONTROL-e2e-victim-is-actually-run`
in the second queue: 4 baselines, and about 1.3 h for the control chunks by the queue's model. On 4 lanes the two
estimates come to about 27 h and 16 h, if 4 lanes give the 3x that 8 lanes gave once; 4 lanes are not measured.
⛔ **THE RUN'S MEASURED WALL TIME REPLACES BOTH** in roadmap `S4.0`'s record before `§10.11` Q1 is put to the sponsor.
`§10.11` Q1's `§10.5` figures stay a scratch model until roadmap `S4.8` re-measures them; put before then, the
question marks each as scratch and is put again in `S4.8` with the re-measured figures beside them.

**WHAT IS RECORDED, AND WHERE.** Findings are written before counts are quoted.

- **The register:** `REG-F-584`, `REG-F-585` and `REG-D-139` are written (`f6b78109`). Owed before any count taken
  from the chunk logs is quoted in the corpus, and before roadmap `S4.2` lands: each of the 11 defects in `§10.1`'s
  table, as a finding or a dated pointer under `REG-F-584` (the shell's length limit; ids split, and a `>` obeyed, by
  a shell; the substring filter; the classifier reading the exit status; anchors read from the working tree; the `++ `
  header, and a deleted file and a rename's old path dropped; the change set read through `spawnSync`'s default
  buffer; the call with no id, whose cost `REG-D-138` (8) records; the exit order; the flags), each given a dated
  pointer by the roadmap step that fixes it. Then owed, each a dated pointer under its entry: under `REG-F-584`, the
  count of others below with its limits and the four's measured transition; under `REG-F-585`, each void id and its
  re-measured verdict. Also owed: one finding for each survivor class `NONE` (below), against this design.
- **The roadmap's landed record for `S4.0`:** what its exit lists, the summed rows computed by `collect.py`.
- **The ledger:** each disposition in the entry's own fields, each changed field struck in place and dated: (a) the
  victim strengthened, so the entry is KILLED again, with its observation dated; (b) RETIRED, `supersededBy` naming a
  successor measured KILLED (*"retire a guard the part framing can hold"*); (c) ABOLISHED, `abolishedBy` citing a
  `REG-D` ruling, only where the property cannot be held (*"abolish only what it cannot"*; both `int2-facts.md`). A
  retirement or abolition can move the export census, regenerated in the same commit (`REG-F-470`'s third limb checks
  it for an unrecorded gain or a moved unattributed count); a retirement or abolition that leaves an export bare
  trips GUARD_LOST, which regeneration alone must not clear (roadmap `S4.0`).
- **The survivor table**, one row per survivor: id, anchor, victim, last KILLED (where and when), the cause commit
  `C`, its class, the replay of `--range=C^1..C`, the disposition. Roadmap `S4.0` classifies each survivor before the
  rule's REPLAY (`S4.3`) can build a reach at `C` (`S4.6`), so the replay column first holds what the scratch reach
  selects at `C`, labelled scratch as the class is. The rule's REPLAY is written beside it: by `S4.6` for each survivor
  it replays, and by `S4.8`, `S4.9`'s fixes included, for each survivor whose class it re-checks. An earlier value a
  later one moves is struck in place and dated.
- **`W`'s receipt** (`scope: whole`), written and committed in roadmap `S4.8` by `S4.7`'s receipt writer, from
  the chunk logs. The logs are kept out of git, each named in the roadmap record by base name and SHA-256. Until that
  receipt exists, `--record` from `W` exits 2 BASE NOT MEASURED, and a range from `W` prints OWED UNKNOWN. It is
  committed only where `W` is on `HEAD`'s first-parent line. `W` is not an ancestor of `f6b78109` (merge base
  `d7a363b0`), and 132 of its 4,119 ids are absent from `f6b78109`'s ledger, which `§10.7`'s check refuses, since each
  entry id must be *"a ledger id at `HEAD`"*. So the main line is first merged into `p7c-p6-int2`, with
  `p7c-p6-int2`'s line as the first parent (the roadmap's order table, `S4.8`), and `measured` can then name `W`
  (`D15`, `§10.6`).

**THE SURVIVOR PROCEDURE — HOW THE RUN ANSWERS "HOW MANY OTHERS".**

1. **Confirm** each survivor alone on a clean lane at `W`, as the four were (`Tests  235 passed (235)`).
2. **Attribute by measurement, not by reasoning** (`REG-F-100`). Take the last commit where the entry is recorded
   KILLED, or its introduction. Bisect the first-parent commits from there to `W`, measuring the one entry in a
   disposable worktree at each midpoint, with that commit's own runner; recurse into a merge's second parent when the
   merge is the step. `C` is the first commit where it SURVIVES. An entry that survives at its own introduction was
   born slack: a records defect, filed as such.
3. **Classify `C`** with the rule's REPLAY at `C`: LOCAL (`C` touched the anchor's lines); ENTRY (`C` added or edited
   the entry); VICTIM (`C` changed the victim file); REACH-IMPORT (a file an imports-only reach also holds: the victim's
   import closure, its setup files and their closures, or the entry's anchor file; for a Playwright victim, also the
   import closure of the app's routes and hooks and of its Playwright config, global setup and teardown; and, for any
   entry, the app's `playwright.config.ts`, `vite.config.ts` and `svelte.config.js`, which `§10.5`'s model counts as
   GLOBAL (`cost.mjs:38`) and `D8` does not); REACH-PATH (a file only the rest of `D3` reaches: by a folded path, by a
   spawned script, or by RP5's folders alone, such as `app.html` or `static/theme-init.js`); GLOBAL; WIDE-ONLY (selected
   only because the victim is WIDE); NONE (not selected: a miss); BORN-SLACK; INSTRUMENT (the runner or the host). An
   imports-only rule would have missed the classes REACH-PATH, WIDE-ONLY and NONE; their count tests `D3`'s choice to
   follow paths and to cover the app's folders. Until the rule is built, the scratch reach gives a provisional class,
   labelled as scratch, and the built rule re-checks it (`S4.8`). Both times, the split between REACH-IMPORT and
   REACH-PATH is read from `§10.5`'s imports-only model at `C` (`tsreach.mjs`, `cost.mjs`'s `reachSelect`): RP5's via
   edge, `serves` (`§10.8`), does not say whether a route imports the path.
4. **Report:** `<n> survivors of <live> live entries at <W12>: <a> LOCAL (<a'> of them anchored where isProductionPath
   discards hunks), <b> ENTRY, <c> VICTIM, <d> REACH-IMPORT, <e> REACH-PATH, <f> GLOBAL, <g> WIDE-ONLY, <h> NONE; born
   slack <i>; instrument <j>.` `REG-F-584`'s remote case — a change to something a guard's test reaches, leaving a
   guard anchored elsewhere slack — counts `c + d + e + f + g + h`. Its general form is wider (*"THE GENERAL FORM IS
   WIDER THAN THE REMOTE CASE"*): `mutants:changed` selects only from the hunks `isProductionPath`
   (`scope-core.ts:71-72`) admits, so a LOCAL survivor anchored, at `C`, where it discards hunks was never selectable
   either, and the general form counts `a' + c + d + e + f + g + h`. The four (history at `W`) and M7 and M8 (on
   record since 2026-09-15 as *"FILED, NOT FIXED"*) are named apart, so "others" means others.
5. **The count is a lower bound.** It counts guards slack at `W` only. It misses guards that went slack and were since
   strengthened, retired or abolished; entries still INCONCLUSIVE or void, which are listed by id; and guards the
   ledger does not declare.

**HOW EACH SURVIVOR TESTS THE SCOPE RULE.** `C` is a predicted red the rule did not write for itself: the replay at
`C` must select the survivor. LOCAL, ENTRY, VICTIM, REACH-IMPORT, REACH-PATH and GLOBAL survivors must be selected by
a seen limb; one that is not is a defect in the rule, becomes a fixture red, and is fixed before the reach limb lands.
WIDE-ONLY survivors are caught only by over-selection, and their opaque site is the first candidate for `§10.11` Q2's
fix. NONE is a miss, filed as a finding with a fixture red before the rule is called done. The record states `k of n
survivors selected at the change that made them slack`.

---

### 10.11 · Open questions for the sponsor

1. **After this run, what measurement admits a tree to the main line, and how often?** Modelled (`§10.5`: today's ledger
   and reach for every commit; against each commit's own, the prototype's esbuild reach selected 0% to 13% more entries
   at 4 single-parent commits, and no merge was compared): at 7 of the 9 recent main-line merges, a sound selection is
   98-99% of a whole-ledger run (78.7-79.3 h of 79.8 h serial); those merges came 9 in four days. One whole-ledger run
   on the final tree is estimated at 81 h or 46.8 h serial, the second likely low (27 h or 16 h on 4 lanes, `§10.10`);
   the run's measured wall time replaces all four before this question is put; the `§10.5` figures here are a scratch
   model until roadmap `S4.8` re-measures them, and if this question is put before then, it is put again with those
   measurements beside them. So no instrument measures each merge soundly at that pace. Options: (a) the whole ledger
   at each integration point, with merges batched as `p7c-p6-int2` batched O, O-2 and V, and the rule's selection
   computed beside it so that each survivor tests the rule; (b) the rule's range from a measured base, all limbs —
   about the same cost today, and it rests on the rule's soundness; (c) (a) or (b) plus each package's own end, all
   limbs (a 5-commit range: median 65.9 h serial); (d) none after this run. **Recommended: (a).** ⚠ Said plainly:
   under (a), REACH, GLOBAL and WIDE block nowhere by themselves. The whole ledger blocks, at the integration point;
   the rule lists them at the package end and in the edit loop, and measures LOCAL, ENTRY and ALWAYS there. The
   integration point is argued as the permanent strict point: it is the step that admits a tree to the main line, and
   at merge grain each sound selection modelled here is nearly the whole ledger. If a later measurement puts the
   median merge selection under half the ledger, (b) is asked again with those figures. **Strongest opposing
   consideration:** 16 to 27 h of a CPU-bound machine per integration point by the estimates, until the run's wall
   time replaces them, on the cores P6 and P7 need; batching means a slack guard can live for the days between points;
   and the corpus gives a moved guard's disposition to *"the programme that moved it"*, which (a) reaches only by
   filing back.
2. **Should this programme route repository reads through checked helpers, to shrink WIDE?** For example
   `repoPath('<literal prefix>', ...rest)`, which throws when its result leaves the prefix, and `outsideRepo(path)`,
   which throws when a path is inside the package. Measured: 390 opaque sites in 107 files; 18 sites in 4 production
   modules are all that make 24 of the 25 Playwright victims WIDE; WIDE holds 2,736 of 3,907 live entries, so each
   listing names them and says little. **Recommended: yes, as a later phase**, starting with the 4 production modules.
   The phase's first step is its own audit of which opaque sites read the repository: a capture of the WIDE victims'
   runs, including the Vite server each Playwright spec starts (`apps/rph-demo/playwright.config.ts:60`), each read
   recorded with the call that made it. `D22`'s audit cannot show this: it captures only vitest victims that are not
   WIDE, and by `D4` no file of such a victim's reach holds an opaque site, so none it captures reaches any of the 18
   sites (in the scratch reach at `d7a363b0`, 0 of its 247 victims reach the 4 modules, and 104 of the 104 that do are
   WIDE, 79 vitest and 25 Playwright: `head.reach-strict.json`); and its capture records the files a run reads, not
   the call that read them. **Strongest opposing consideration:** it edits code in up to 107 files for the
   instrument's sake; each bound is written by hand and checked only on the paths a run takes; and under `§10.11` Q1 (a)
   it changes no blocking measurement. ⚠ And the payoff of bounding the 4 modules rests on `D4`'s
   `./$types` rule: the scratch scanner left type-only imports out, but under `D3`, which keeps them, and `D4`(e)
   alone, the 18 route files' `import type … from './$types'` would keep each victim that reaches a route WIDE,
   whatever the 4 modules do. The counts here come from that scanner, so the built tool may find more opaque sites
   behind type-only edges.
3. **`R3`'s named trigger for `--strict` was met on 2026-09-13 and not acted on. Is it an event or a state?**
   `45d295ae`: *"obligation reaches ZERO"*. `scope.ts:29-31`: *"⛔ AND THE TRIGGER FOR FLIPPING IT IS NAMED, because
   "advisory" is how a records defect becomes permanent: when `R3`'s burn-down reaches zero unguarded
   production-consumed exports, `--strict` becomes the default and this paragraph is deleted."* `43342bea`:
   *"Outstanding obligation: 5 bare export(s)"*. **Recommended: a state** — file the divergence beside `REG-F-584` and
   flip when the census next reads zero. Roadmap `S4.2` strikes that paragraph's stale counts (`scope.ts:26-27`)
   either way. Its trigger (`scope.ts:29-31`, and `ROADMAP:224-225` at `f6b78109`) is struck and replaced in the
   commit that records the answer here, and no step waits for that answer. **Strongest opposing consideration:** a
   trigger that can un-fire is how advisory becomes permanent, which is the paragraph's own warning.
4. **Who disposes of a survivor whose code another programme moved?** The case on record is M7 and M8: *"FILED, NOT
   FIXED"* since 2026-09-15, not `REG-F` entries. M8 was recorded SURVIVED on 2026-10-26, and again at `W` in four
   trees by the survivor canary on 2026-10-29 (`§10.10`, step 6). **Recommended:** this
   programme files each in `REG-F-584` as a prior instance and disposes of it under the ledger's rules, applying the
   moving programme's own rule where it wrote one, as `c2c71020` did for the four under B7's rule, and naming that
   programme in the disposition. **Strongest opposing consideration:** the sandbox roadmap places where a guard went
   as *"a judgement belonging to the programme that moved it, not to one that happens to be running the audit"*
   (`ROADMAP-undertaking-execution-sandbox.md:1066-1067`).
