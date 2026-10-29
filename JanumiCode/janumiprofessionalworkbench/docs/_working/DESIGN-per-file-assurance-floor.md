# DESIGN — JAN-PFA: three ratchets that guard an average, and the members they are silent about

**Programme:** `JAN-PFA` · **Status:** DESIGN (rev 2) · **Opened:** 2026-09-12 ·
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
