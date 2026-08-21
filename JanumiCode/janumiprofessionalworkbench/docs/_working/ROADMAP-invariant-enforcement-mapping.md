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
