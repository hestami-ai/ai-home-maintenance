# ROADMAP — W-3b: the invariant prose→code mapping

**Design:** `DESIGN-invariant-enforcement-mapping.md`. **Backlog:** `BACKLOG.md:448-450`.
**Measured cost: 65-80 hours for the canon 62.** So the sequencing rule is: **every wave lands a complete,
gated, honest PARTIAL.** No wave's value depends on a later wave arriving.

---

## The ordering, and why it is not the obvious one

The obvious order is "map the invariants, then build a gate to hold the mapping". That is backwards here, and
the reason is measured: **the hole is 0/192 verdicted, declared in code, and gated by NOTHING**
(`grep -rn 'cap:invariant' verif/` → 0). An 80-hour audit that lands as prose can rot silently the moment it
lands — which is REG-F-043's finding about the 152-row guard ledger, one instrument over.

**So V-0 builds the instrument and the gate FIRST, over a deliberately small verdict set.** After V-0 the hole is
visible, the ratchet exists, and every later wave is a data commit against a running gate.

---

## V-0 — The instrument, the gate, and the limb split (no judgment yet)

**Guarantee claimed:** the invariant population is rostered, the verdict journal exists, the hole is COUNTED, and
the count cannot move without a test reddening. **NOT claimed:** that any invariant is enforced.

**V-0.1 · The limb split, committed BEFORE any verdict.** §2 of the design: the row is a LIMB, and splitting is
itself a judgment (REG-F-113: two reasonable regexes gave 22 and 50). Derive the split by a STATED rule, commit
it as `docs/tracking/census/w3b-limbs.ndjson`, and pin its count. ⚠ **A lane may not re-split.** Expected ~316
limbs over the 62; the number is whatever the stated rule produces, and the rule is the artifact.

**V-0.2 · The verdict journal.** `docs/tracking/census/w3b-invariant-verdicts.ndjson`, keyed on the existing
`cap:invariant:*` ids plus a limb ordinal. No tracker schema change — ids are namespaced strings with no type
constraint, and the 192 items are already present with FAM-N-derived ids and defining-line anchors.

**V-0.3 · `verif/invariant-verdict-census.test.ts` — and it must be able to FAIL.** Pins: population (192 items,
62 canon), limb count, verdicted count, per-arm distribution, and that every `ENFORCED_DRIVEN` row's
`enforcingAnchor` resolves EXACTLY ONCE in its cited file (the C-0b mechanism, added by REG-F-081 after six
enforcing sites rotted into doc comments in two days).
⚠ **The roster and the verdicts must come from SEPARATE files with separate authors** — design §4.3. If one
instrument derives both halves, coverage is true by construction and the gate can never redden
(`DESIGN-declare-the-spine.md:83-96`: *"a control that cannot fail — authored, again, inside a fix"*).

**V-0.4 · Mutants, because a gate with none proves nothing about what was just built** (REG-F-194).
| id | mutation | must redden |
|---|---|---|
| `MU-W3B-the-anchor-check-stops-resolving` | drop the exactly-once assertion | the census test, and nothing else |
| `MU-W3B-a-verdict-flips-arm-unnoticed` | flip one row `ENFORCED_DRIVEN` → `UNENFORCED_OBSERVED_ADMISSION` | the distribution pin |
| `MU-W3B-the-hole-stops-being-counted` | let an unverdicted invariant pass | the population/verdicted pin |

**V-0.5 · Land the trial's 9 as the first real verdicts**, with their evidence — they are already measured and
driven, and they make the gate non-vacuous on arrival. **`ENFORCED_DRIVEN` and `UNENFORCED_OBSERVED_ADMISSION`
require an executed dispatch**; the trial's do.

---

## V-1 — The drive queue (≈22-25 invariants, the ones reading gets wrong)

**Guarantee claimed:** every invariant with a live command-layer site has each limb settled by an EXECUTED
dispatch. **This is the wave that carries the measured value**, because it is exactly the set where reading
fails: of the trial's 9, six needed a drive and **three of those six would have been scored WRONG by reading**
(STA-4, ASR-14, ASR-15) — the enforcing site exists, names the invariant in its own refusal text, and refuses,
*for a different limb of the same sentence*.

**The queue is derivable today, not chosen:** the intersection of register-anchored (37 of 62 named by ≥1
`ENFORCEMENT_REGISTER` row) and production-cited (40 of 62). ⚠ **The register reverse-index is a TRIAGE
instrument and MUST NOT be used as the mapping** — its arrow points RPH-rule → canon, not canon → enforcement,
and on the trial's nine it inverted three verdicts (ASR-3 is named by ZERO register rows and is ENFORCED).

**Lane discipline, per design §6:** each lane returns its own enumeration rule; each verdict carries site,
anchor, refusal marker, and the control that ACCEPTS once the arrangement is removed.
⚠ **THE MASKED-CONTROL TRAP, hit live in the trial:** running a probe and its control against the SAME PWU made
the control hit the no-op guard (*"ChangePwuState changes nothing: all four axes already equal the requested
values"*) — a REJECTED that proved nothing. **Every control runs on a fresh arrangement.**

---

## V-2 — The architectural tail (≈37-40 invariants, no arrangement to drive)

LYR-1/2/3, REL-1..4, AUT-1/2, ASR-18/19, PER-11 and the rest: statements with a zero citation census and no
command that could violate them. These need `ENFORCED_BY_CONSTRUCTION` (with its census, its command, its
positive control, **and whether that census is GATED** — PER-3's is not, and *"true but unguarded"* is a
different claim from *"enforced"*) or an honest unenforced arm.

⚠ **22 of the 62 are cited NOWHERE** in production, tests, or `verif/`. That is a stub-currency measure and its
blindness is stated: it counts NAMES. A zero here means nobody wrote the id in a comment — **not** that the rule
is unenforced. AGG-1 is cited nowhere and holds BY CONSTRUCTION.

---

## V-3 — Refutation, and the check REG-F-202 says to add

**Refuters attack ENFORCED-family rows too**, not only actionable ones — REG-F-197 left its 163 ENFORCED rows
unattacked with its own errata disclosing reasons to doubt them, so its 36% is the error rate of *actionable*
verdicts and the ENFORCED rate is **NOT ESTABLISHED**. Every refuter is asked the limb question specifically:
***does the cited site refuse THIS limb, or a sibling?*** — because that is the shape all three trial reading-
errors took.

⚠⚠ **THE LAUNCH CHECK, AND IT IS THE REASON THIS WAVE HAS ITS OWN NUMBER.** REG-F-202 is the recorded case,
three weeks old, of **this exact lanes-plus-refuters workflow's refuter half silently failing to launch**, with
the synthesis then producing a confident, well-cited sweep under ZERO adversarial pressure. Over 62 invariants
that is 62 unrefuted hypotheses shipped as findings. **The refuter stage MUST report a COUNT of refuters that
returned, and the artifact MUST carry that count. A refutation stage that cannot prove it ran did not run.**

Every unrefuted row is labelled a HYPOTHESIS in the artifact, in the register entry, and in the backlog — the
REG-F-197 discipline, which its own commit records as having *"earned its cost again"*.

---

## V-4 — Close, and file what was found

Register entry; `DIVERGENT_UNFILED` rows each become a filed finding (**this arm's population must be zero at
close**); the backlog item retires by striking, not deletion.

**Already surfaced by the trial and owed a filing regardless of when V-4 lands:**
- **STA-4 limb 1** — *"Proposed work cannot execute"* is UNENFORCED by observed admission, and the existing test
  corpus DEPENDS on the gap (`execution-start-gate.test.ts:175-209` arranges every case through it).
- **ASR-15 subject limb** — refused only at a route action; `ProposeDecision` with `subjectObjectIds: []` was
  driven and ACCEPTED.
- **AGG-1** — a shipped three-call-site violation recorded ONLY in a working design document.
- **ASR-14 tier limb** — no field exists in the contract; the remedy is a schema change, not a wire.

### ⚠ V-4 GAINED A SECOND DELIVERABLE AT V-1 (126/307 limbs in): THE LADDER MIGRATION

`DESIGN §10` records the finding in full. In short: the ladder encodes FILING STATUS inside two of its nine
arms and nowhere else, but any enforcement verdict can carry an unfiled divergence — so the axis leaks, and
five of 33 `PARTIAL_DIVERGENT_FILED` rows name no filing at all despite `DESIGN §3` requiring the entry id.
All five were placed there by REFUTERS, who are prompted separately from lanes and never see their
instructions; when both ends of a deliberately independent pipeline make the same misreading, the defect is
the arm's NAME, not the operators.

**V-4 splits the axes** — `verdict` (what the code does) crossed with `filing` (`FILED` / `UNFILED` /
`NEAR_MISS` / `NOT_APPLICABLE`). The close condition strengthens rather than moves: *"`DIVERGENT_UNFILED`
must be zero"* becomes *"`filing = UNFILED` must be zero across ALL verdicts"*, which catches the unfiled
partiality now hiding inside four other arms.

**⚠ WHY IT IS V-4 AND NOT NOW.** Re-cutting the vocabulary mid-audit re-opens every already-scored row:
each would need its filing axis established, and for most of them nobody has looked — which is exactly the
claim-about-a-search this programme refuses to make (`DESIGN §4.1`). It would also make the slice's own
numbers unauditable against the ones before it. Do it ONCE, with the population complete, as a stated
migration carrying its own before/after counts.

**Holding the line until then:** the gate pins the five unnamed-filing rows as an explicit LIST (a sixth
reddens it, a fix shrinks it), refuses `filed_as` on any `DIVERGENT_UNFILED` row, and pins the
`near_miss_filing` count. Lane and refuter prompts state the two-claim structure explicitly instead of
relying on the arm name.

---

## ⚠ A record defect found on the way, and it is OURS

`BACKLOG.md`'s REG-F-202 body reads *"⚠ DESIGNED, DRIVEN AND MEASURED 2026-08-20 — then REVERTED deliberately,
unfinished rather than rushed"*, while its own section heading four lines above reads *"✅ LANDED — the de minimis
floor is unconditional in code (REG-F-202, 2026-08-20)"*. **The code confirms LANDED** — the trial drove
`CompleteExecutionStep` against an unassessed artifact and got the floor refusal. The revert paragraph is stale
and outlived its condition. Fix it in V-0, since a lane reading that paragraph would score ASR-3 wrong.

---

## What remains open after all five waves

The 130 non-canon invariants (RPH CDM 102, Assurance Policy §39 20, Contract Package §35 8); JPWB-SPEC-001's 14
surface invariants and CON-000's 12 axioms, which are **not in the 192 at all**; and `cap:projection` (0/8), the
census's other hole. **This programme measures enforcement. It does not create any.**

---

## ✅ V-0 · V-1 · V-2 · V-3 · V-4 · V-5 · V-6 ALL LANDED — and where this plan was wrong

Nothing above is deleted. The plan stays as written so the difference between it and the outcome is
readable. **The census is total: 307 limbs over 62 canon invariants, every one verdicted, every one
refuted, every verdict on a two-axis ladder.**

| | planned | delivered |
|---|---|---|
| limbs | *"expected ~316 over the 62"* | **307**, by the committed rule `w3b-limb-split/1.0.0` |
| V-1, the drive queue | ≈22-25 invariants | **39** |
| V-2, the architectural tail | ≈37-40 invariants | **21** |
| refutation | every row attacked | **307/307 — 128 OVERTURNED, 179 HELD** |
| filings | *"`DIVERGENT_UNFILED` must be zero"* | **53 entries** — 52 closing **67 limbs**, one closing none |

### ⚠ THE WAVE SPLIT WAS DERIVED, AND THE DERIVATION FAILED IN THE DIRECTION IT WARNED ABOUT

V-1's size was not guessed. §V-1 derives it: *"the intersection of register-anchored (37 of 62 named by
≥1 `ENFORCEMENT_REGISTER` row) and production-cited (40 of 62)"*. V-2 was defined as the remainder —
*"statements with a zero citation census and **no command that could violate them**"*.

**46 of V-2's 114 limbs were settled by an arm that REQUIRES an executed dispatch** — 28
`UNENFORCED_OBSERVED_ADMISSION`, 15 `DIVERGENT`, 3 `ENFORCED_DRIVEN`. Every one is a limb this plan said
no command could violate, settled by driving a command that violated it. **The rate is 40%, against 51%
in V-1** — the wave built to *be* the drive queue. A partition meant to be categorical came out eleven
points apart.

Of the twelve invariants named here by name as the tail, **four were reassigned to V-1 lanes during
execution** (LYR-3, REL-1, REL-3, REL-4 — REL-1 alone yielded 7 driven limbs of 12), and of the eight
that stayed, **five still produced limbs on driven arms** (LYR-2, REL-2, AUT-1, ASR-19, PER-11).

**§V-2 states the instrument's blindness in its own words** — *"it counts NAMES. A zero here means
nobody wrote the id in a comment — **not** that the rule is unenforced. AGG-1 is cited nowhere and holds
BY CONSTRUCTION"* — and both waves were sized with it anyway.

> **A known-blind instrument used for TRIAGE is a triage instrument. Used for SIZING it silently becomes
> a claim about the population.** §V-1 forbids the first misuse in bold (*"MUST NOT be used as the
> mapping"*) and commits the second in its own heading. The lanes corrected it by hand, four invariants
> at a time, and the plan was never amended.

### The four filings this plan named as owed regardless of when V-4 landed — checked, not assumed

| named here | outcome |
|---|---|
| STA-4 limb 1 | ✅ `limb:STA-4:1` → **REG-F-231** |
| ASR-15 subject limb | ✅ `limb:ASR-15:2` → **REG-F-217** |
| AGG-1 | ✅ `limb:AGG-1:1` and `:2` both FILED |
| ASR-14 tier limb | ✅ `limb:ASR-14:1` → **REG-F-216** |

### V-4 gained a fifth filing value this plan did not anticipate, and it paid for itself in one commit

The filing axis was specified here as four values. It shipped with **five**: `NOT_ESTABLISHED` was added
because 48 rows sat on UNENFORCED arms where the old ladder could say nothing about filing, and
`UNFILED` **asserts that no filing exists** — a claim about a search nobody had run. Searching all 48
returned FILED 7 / NEAR_MISS 21 / UNFILED 18 / NOT_APPLICABLE 2. **Defaulting them would have been wrong
30 times.**

### ⚠ THE CLOSE CONDITION IS NOT MET, AND THIS PLAN'S WORDING IS WHY IT LOOKS MET

> *"`filing = UNFILED` must be zero across ALL verdicts"*

**That sentence is TRUE as of V-6** — the 18 are filed as REG-F-234..245 / REG-Q-058..062 — **and 21
limbs still owe a register entry.** `NEAR_MISS` means *a filing exists and does NOT cover this limb*,
which is a statement that the limb is unfiled with a decoy attached. 16 of the 21 say a filing is owed
in their own words; the 5 that deny it are exactly the rows whose `owed` was authored for a verdict a
refuter overturned, confirmed by a blind adjudication with a working negative control.

**The debt is 39 limbs, of which 18 are discharged.** `DESIGN §17` carries the measurement, the blind
confirmation, and the eight gate assertions that narrowed the same way.

**The condition is restated here rather than edited above**, because the wording that hid this is part
of the record: the general form is **`UNFILED ∪ NEAR_MISS` must be zero**, and it is now what
`verif/invariant-verdict-census.test.ts` asserts against `OWES_A_FILING`.

### V-7 — what is left, in order

1. **The 21 `NEAR_MISS` limbs** — file each, or record why it is genuinely covered. Every one carries an
   `owed`; six were re-authored from the blind adjudication and carry an independent decoy enumeration.
2. **`docs/_working/HARMONIZATION-FINDINGS.md`'s "Refuted (32)"** — one of its struck items is true at
   HEAD, found by accident. **Derive the answer over all 32.**
3. **Split `UNENFORCED_NO_SHAPE`** (`DESIGN §16.2`) — deferred twice, deliberately, and still owed.
4. **The 37 remaining stale `owed` fields** — all on FILED or NOT_APPLICABLE rows, where a stale `owed`
   misleads a reader but cannot misdirect a filing.
5. **The 11 recorded arm doubts**, unadjudicated — including `limb:REL-2:3`, whose dead-predicate proof
   was falsified by this programme's own RPH-TRC-005 correction.
