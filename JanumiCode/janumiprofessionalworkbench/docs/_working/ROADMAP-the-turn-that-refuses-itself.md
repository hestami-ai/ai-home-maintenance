# ROADMAP — `JAN-CRITREAD` `TT`: the authoring turn that refuses its own candidate

**Design:** `DESIGN-the-turn-that-refuses-itself.md` · **Date:** 2026-09-22
**Findings:** `REG-F-425` (the defect), `REG-F-426` (the helper that hid it)

⭑ **Exit:** with a real reviewer, an authoring turn's exact assured candidate can be accepted; the commit guard
admits **exactly** the turn's own exchange records and nothing else; every made try is still recorded canonically
and survives a discard; the counter's phantom job is gated by a test that trips it alone; a refused acceptance
fails AT acceptance in e2e.

⛔ **THIS ROADMAP DOES NOT TURN `REG-D-067`'S THIRTEEN GATE REDS GREEN.** The gate's default lane reviews with the
mock, which returns INCONCLUSIVE. What changes is what a REAL reviewer's acceptance can do, and that is measured
on the stand-in lane — reported as measured, never as predicted.

⚠ **The accepted-red SET must not grow.** Every increment's gate run compares its failing e2e set with the
thirteen recorded in the R32 commit (`35a15e11`): same thirteen, or the increment stops.

---

## `TT-0` — gate the limb that exists, before changing it

⛔ **Today nothing tests the whole-log counter's own job.** `authoring-turn.test.ts:201-218` arranges its
conflict with `EditPwa`, which trips the counter AND the PWA precondition. So deleting the counter's refusal is
predicted to SURVIVE the whole suite. This increment measures that, then closes it.

1. **Measure first:** add ledger mutant `TT-M1-event-log-refusal-becomes-admission` (delete the consequence
   `conflict = {aggregateId: '@event-log', …}; return;` in `dispatchBatchGuardedAs`, V-2c: mutate the
   consequence, not the condition), victim `authoring-turn.test.ts`, and run it **before** writing PR-2.
   Predicted: SURVIVED. Record the observed verdict.
2. **PR-2, the conversation phantom** (`authoring-turn.test.ts`, private host): begin the turn on a PWA with no
   conversation; define a type on the fork; the fork records conv_A; canonical concurrently records conv_B;
   mark valid + assured; commit. Assert `CONFLICTED`, detail matches `^@event-log changed from revision \d+ to
   \d+\.`, exactly ONE `AUTHORING_CONVERSATION` on canonical, no PWU types.
   ⭑ It trips ONLY the log limb: conv_B is outside the vector, conv_A passes `mustNotExist`, the PWA is untouched.
3. Re-run TT-M1: must now be KILLED by PR-2's message assertion.

| Mutant | Must redden |
|---|---|
| TT-M1 log refusal becomes admission | PR-2 (two conversations commit) |
| **CONTROL** | PR-2 green on today's code |

---

## `TT-1` — the bus admits an exact set, and names what it refuses

`packages/rph-application/src/command-bus.ts` (DESIGN §6.1): third parameter `number | {position,
admittedEventIds}` (inline type; a bare number is today's behaviour); inside the same transaction, still first:
tail after `position` must be EXACTLY the admitted set (length AND identity); `RevisionGuardConflict` gains an
optional `unadmitted` naming the first foreign event.

Tests in `packages/rph-engine/src/engine.test.ts` beside `:139`/`:162`:

| Test | Asserts |
|---|---|
| B1 | admitted [x], tail [x] → ok |
| B2 | admitted [x], tail [x, foreign] → refused, `unadmitted` = foreign |
| B3 | admitted ['absent'], tail [foreign] → equal counts, refused by IDENTITY, `unadmitted` = foreign |
| B4 | admitted [x, y], tail [x] → refused by LENGTH |
| B5 | bare number with one foreign event → refused exactly as today |

| Mutant | Must redden |
|---|---|
| TT-M1 re-anchored to the new text | PR-2, B2, B5 |
| TT-M2 count-not-identity (drop the membership term) | B3 |
| TT-M3 membership-not-exactness (drop the length term) | B4 |
| **CONTROL** | `engine.test.ts:139` unchanged and green |

⚠ Guards: `check-types` across every implementer of the handle (`as()` forwarder, the turn's recording engine,
test doubles); `guards:export` must show no new export.

---

## `TT-2` — the witness, the derivation, and the red that started this

**First, before any code:** write **PR-1** in a new `apps/rph-demo/src/lib/server/authoring-turn-reviewed.test.ts`
on the PRODUCTION composition — module engine (`resetEngine('empty')`), `beginAuthoringTurn(PWA)` with its
default canonical, `withLiveReviewerSeam`, `runPwaFloor(… , turn.engine)` with **no** `canonical`, a clearing
print — and run it on HEAD. ⭐ **Predicted RED with `REG-F-425`'s detail. Observe it, record `N`, then build.**

Build (DESIGN §6.2–6.4): `witnessedEventIds`; `witnessingEngine`; `canonicalActsOf`; the commit passes the
admitted set; `recordCommitFailure`'s suffix; `floor.ts` derives the drain's handle; **`runPwaFloor` refuses an
explicit `opts.canonical` on an active turn's fork**.

| Test | Asserts | red on HEAD |
|---|---|---|
| **PR-1** | commit ok; MODEL_EXCHANGE ≥1 on canonical BEFORE accept; type lands; exchange count unchanged by the commit | ⭐ yes |
| PR-1r | repair print → 2 exchange events; commit ok | yes |
| PR-1p | an exchange exists on canonical BEFORE the turn begins (seeded immediately before `beginAuthoringTurn`, ordering asserted as the instrument's control); commit ok | yes |
| PR-1s | floor → revision-required → resume → floor → commit ok | yes |
| **PR-2a** | T2 (another PWA) drains; T1's commit CONFLICTED, detail names T2's `ModelExchangeRecorded` | the pinned, disclosed false conflict |
| **PR-3** | discard after the floor; canonical still holds the exchange records | green before and after |
| W1 | the witness refuses a non-exchange command; canonical unchanged | new |
| W2 | a DUPLICATE through the witness is not noted; commit ok | new |
| W3 | a discarded turn's witness does not admit into the next turn on the same PWA | new |
| W4 | `runPwaFloor` with an explicit `canonical` on an active turn's fork is refused | new |

| Mutant | Must redden |
|---|---|
| TT-M4 the type-exemption shape (admit every `MODEL_EXCHANGE` in the tail) | PR-2a — PR-1 stays green BY DESIGN. ⚠ Observed: W3 too — the exemption also admits a DISCARDED PREDECESSOR's late try |
| TT-M5 drain on the fork (`canonical.dispatch` → `engine.dispatch`) | PR-3, and PR-1's pre-accept assertion |
| TT-M6 floor ignores the witness | PR-1 (detail with the new suffix — `why` written from the OBSERVED output) |
| TT-M7 witness admits any command | W1 |
| TT-M8 notes by PWA, not by turn | W3 |
| TT-M9 notes DUPLICATE | W2 |
| TT-M10 resume forgets witnessed acts | PR-1s |
| TT-M11 explicit canonical accepted on a fork | W4 |
| **CONTROL** | `floor-recording.test.ts` (all MXR cases), `authoring-turn.test.ts` incl. `:134`/`:227`, PR-2 — unchanged and green |

---

## `TT-3` — `REG-F-426`: a refused acceptance fails at acceptance

`apps/rph-demo/e2e/support/harness.ts:82-94`: after `res.ok()`, parse the body and assert the SvelteKit envelope
`type === 'success'`, quoting `data` on failure.

**Predicted red, observable on today's default lane:** the accepted reds that call this helper now fail AT
acceptance, quoting the refusal (`…is BLOCKED_EXTERNAL, not READY_TO_COMMIT.`), instead of at a later assertion.
⛔ **No spec outside the thirteen may change status**; the failing set must equal R32's.

**The payoff, measured not predicted:** rerun `REG-F-427`'s stand-in lane (real-reviewer path, a canned
all-clean reply) on the four spec files `REG-F-425` probed. Before `TT-2`: 2/10 (measured). After: predicted 9/10
— recorded as observed, whatever it is.

---

## `TT-4` — the register

- `REG-F-425` and `REG-F-426`: **CLOSED**, struck at the head with the measured evidence (PR-1's observed red
  and green; the mutant verdicts; the stand-in lane result).
- **File** (after grepping the register by topic and reading every hit's whole entry): the mutual destruction of
  two concurrently reviewed turns — the exchange-borne share of the cross-professional false conflict, disclosed
  and owed to `DESIGN-trust-boundary.md` §3, with the type exemption recorded as its candidate remedy pending the
  ruling on `AUTHORING-BACKBONE.md:269-271`; the discard-during-review PER-9 loss (inferred, with its predicted
  red); `floor.ts`'s hardcoded `subjectSemanticVersion: 1`; the missing assessment↔exchange join.
- **Correct, append-only:** `REG-F-066`'s *"the vector is COMPLETE"* and W-3b `limb:AUT-1:4`'s *"would produce"*.

---

## Not in scope

- The type exemption (DESIGN §5.3) — owed a sponsor ruling first.
- The discard-during-review fix — it changes where a late drain lands relative to a successor turn, so it needs
  its own design.
- `REG-D-067`'s thirteen gate reds, and `REG-D-068`'s re-decision.
