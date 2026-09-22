# DESIGN — `JAN-CRITREAD` `TT`: the authoring turn that refuses its own candidate

**Date:** 2026-09-22 · **Findings:** `REG-F-425` (the defect), `REG-F-426` (the instrument that hid it)
**Status:** design only, nothing implemented · **Roadmap:** `ROADMAP-the-turn-that-refuses-itself.md`

---

## 0. How this design was decided

A design workflow ran four read-only readers (what the guard protects; the exchange-record path; **every**
canonical write a turn can make; the instruments), then three independent designers under different lenses
(minimal-precise, semantic-scope, durability-first), then two adversarial judges (correctness/concurrency;
durability/scope/testability). **All three proposals survived; both judges independently chose the same one**
— §5 — and attached conditions, all adopted below (§6.4, §8, §10).

⚠ Nothing in that workflow was run: every red and kill below is PREDICTED from code at `911168d0`. The
roadmap's first act in each increment is to observe the red before trusting any green.

---

## 1. The defect, restated precisely

`REG-F-425`: with a real reviewer, every authoring turn is refused at acceptance as `CONFLICTED
"@event-log changed from revision N to M."` Two designs collide, each correct alone:

- **The guard** — `commitAuthoringTurn` passes `base.eventCount` (the WHOLE log's length at
  `beginAuthoringTurn`, `authoring-turn.ts:146`) to `dispatchBatchGuarded`, which refuses if the log's length
  has moved (`command-bus.ts:612-621`), before any per-aggregate check.
- **The drain** — `runPwaFloor` records each reviewer try as `RecordModelExchange` on the **canonical** handle,
  deliberately (`floor.ts:403-437`; `PER-9`, `REG-D-055`): *"a try that was MADE… is precisely the try PER-9
  wants kept."*

So the turn conflicts with its own reviewer's record, every time. The mock reviewer never captures, which is
why no gated lane saw it.

---

## 2. What the whole-log counter actually protects — and what the records say it protects

> ⭑ **SUPERSEDED 2026-09-22 (`REG-D-070`, built in `JAN-CRITREAD` `DD-3b`).** The whole-log counter is DELETED. Its one unique job — a phantom aggregate no revision vector can name — is now done by the declared groups G1 (the conversation of the PWA) and G2 (its types), which see a birth by keying on `pwaId` instead of by counting the log. What follows is the reasoning that led to that rule, kept as it was written.

⭑ **Its one unique job is PHANTOMS: a new aggregate the per-aggregate revision vector cannot name.** Its author
said so (`authoring-turn.ts:19`: *"detects a concurrent new aggregate that is absent from the vector"*;
`apps/rph-demo/AUTHORING-BACKBONE.md:269-271`: *"a safe false conflict rather than an undetected new-aggregate
race"*). Every other concurrent change is caught elsewhere: the vector pins the PWA, its live PWU types, every
assurance policy and an existing conversation (`:125-147`); `mustNotExist` covers the turn's own targets
(`:418-434`); replay re-runs every handler against live canonical and content-hashes the affected objects
(`command-bus.ts:636-645`); and every `PWU_TYPE` writer bumps the PWA (`withPwaVersionBump`,
`pwa-authoring.ts:559`, `:819`, `:903`).

**Where the counter is the ONLY guard** (each inferred from code, none driven):

1. **The conversation phantom.** `recordConversation` mints a fresh id when the PWA has no conversation yet
   (`workbench.ts:515-516`), and nothing pins an ABSENT conversation (`authoring-turn.ts:140-144`). Two turns
   in two processes on one durable DB would commit two conversations, and `getConversation` returns the wrong
   one (`queries.ts:37-51`).
2. **The floor-record shadow.** A concurrently committed assessment for the same PWA shadows this turn's floor
   by `updatedAt` (`assessment-index.ts:58-82`); the publish gate then fails closed for a graph whose SATISFIED
   floor is recorded.
3. **Latent:** any future `PWU_TYPE` writer that skips the PWA bump.

⚠ **In one process today, none of these can occur** — one turn per PWA (`turnsByPwa`, `:245-250`). They are the
`AX-10` topology case the counter exists for, and the remedy must keep all three.

⛔ **TWO RECORDS ARE PARTLY WRONG, AND THIS DESIGN CORRECTS THEM (append-only):** `REG-F-066`'s *"the vector
is COMPLETE for everything that affects a write"* — the conversation read is a counterexample; and W-3b row
`limb:AUT-1:4`'s *"deleting expectedEventCount would produce a silent stale overwrite"* — its own probe shows the
per-aggregate check refuses that arrangement; the claim holds only for absence-dependent reads.

⛔⛔ **AND NO TEST ISOLATES THE LIMB.** The only conflict test (`authoring-turn.test.ts:201-218`) arranges its
conflict with `EditPwa`, which trips the counter AND the PWA precondition, and asserts only `CONFLICTED`.
Deleting the counter's refusal would leave the entire suite green — a predicted SURVIVAL, which increment 0
turns into a measured one before anything else changes (§8).

---

## 3. The general form: every canonical write a turn makes

Derived by tracing every engine handle reachable from the agent route and the turn lifecycle (not listed from
memory): **the turn causes exactly ONE kind of canonical write — the PER-9 exchange drain.**

- two call sites: floor run 1 (`agent/+server.ts:127`) and the refinement run (`:153`);
- 0–2 events per run (1 if the answer parses; 2 with a repair try), so up to 4 per agent POST;
- ⚠ **and it accumulates across resumes:** `resumeAuthoringTurn` never re-snapshots `base` (`:329-341`).

Everything else is on the fork or is a read: conversation persistence, agent tools, the floor's own
assessments, `VALIDATOR_EXECUTION_FAILED`, artifact-byte writes (content plane, no events), page loads.

**Concurrent sources** that also trip the counter, not caused by this turn: another PWA's turn (drains and
commit); an Undertaking model step and the work-product floor drain; policy/waiver actions still offered while a
candidate is staged; `/test-api/dispatch`. These are the cross-professional false conflict (§5.3).

---

## 4. What any remedy must keep

1. **PER-9 / `REG-D-055`:** every made try is recorded canonically, immediately, and survives a discard.
   ⛔ **The tempting wrong fix — drain onto the fork (`floor.ts:415` `canonical.dispatch` → `engine.dispatch`) —
   passes the commit and loses the record on discard; the current suite cannot tell the difference**
   (`floor-recording.test.ts` runs with `engine === canonical`).
2. **The counter's phantom job** (§2).
3. **`base.eventCount`'s three OTHER consumers** — it slices the fork's log (`:358`) and is hashed into the
   candidate (`:383`). Redefining the snapshot count mis-slices the fork once canonical holds any earlier
   exchange: the old id enters `affectedIds`, gets `mustNotExist`, and the commit conflicts again.
4. **Fail closed.** Every new failure mode must refuse, never admit.

---

## 5. Options, and the decision

| | admits | premise | ruling needed | verdict |
|---|---|---|---|---|
| **(a) type exemption** — the guard stops counting `MODEL_EXCHANGE` | every party's exchange births | *no candidate computation reads `MODEL_EXCHANGE`* — enforced by a TEST, not by construction | ⚠ yes (§5.3) | sound; deferred |
| **(b) witnessed own acts** — the guard admits exactly the event ids the turn's own drains produced | this turn's own act records only | none beyond event-id uniqueness | no | ⭐ **chosen** |
| **(c) defer the drain** to commit/discard | — | hands the record back to the turn | — | ⛔ violates `REG-D-055` |
| **(d) drain on the fork** | — | — | — | ⛔ loses PER-9 on discard (§4.1) |

### 5.1 Why (b)

- It admits **nothing but the turn's own acts**, the strongest guarantee (`REG-D-013`).
- It does not narrow multi-PWA concurrency, so it needs no ratified dependency-vector rule
  (`AUTHORING-BACKBONE.md:269-271`) and can land without a sponsor ruling.
- ⭑ It does not depend on a future-fragile premise. (a) holds only while nothing on the fork reads
  `MODEL_EXCHANGE`. The fork's `readAllEvents` passes exchange payloads straight through (`authoring-turn.ts:230`;
  `model-exchange.ts:358-362`), and `REG-D-068`'s owed recorded-judgement mechanism is exactly the likeliest
  future reader. (b) would stay correct if that happened.
- It covers the general form by DERIVATION: the witness comes from the handle the floor runs on, so both floor
  sites, every repair try and every resume are covered without listing call sites.

### 5.2 The premise, restated — a judge caught it

The admitted events are NOT admissible because the candidate "observed" them — the fork is a point-in-time copy
and **never** sees its own drains. They are admissible because they are **this turn's own writes**: born
terminal (`REG-D-055`), under ids minted after the plan was recorded (`exchange-recorder.ts:274-281`), read by no
replayed handler, referenced by no recorded command (`evidenceConsideredIds` is always `[]`), and outside
`affectedIds`. A write you made yourself cannot be a change you failed to observe.

### 5.3 ⛔ What (b) deliberately does NOT fix — disclosed, not solved

> ⭑ **FIXED 2026-09-22, not merely disclosed (`REG-D-070`; `REG-F-430` CLOSED in `DD-3b`).** The cross-professional false conflict described below is gone: a draft is refused only by a change to something it DECLARED, and another PWA's reviewer record is not one of those. `PR-2a` now asserts that the commit LANDS. What follows is the record of what was known when (b) was chosen.

**The cross-professional false conflict stays**, including its exchange-borne share, which now becomes routine:
two turns on different PWAs, each reviewed by a real reviewer, **destroy each other** — T1's commit sees T2's
drain as foreign, T2's sees T1's. Neither commits, and nobody changed anything either depends on. That is
`DESIGN-trust-boundary.md:194-207`'s false conflict (*"to be designed out, not documented"*), never sequenced
(`ROADMAP-coordination.md:230-238`), and it is **filed** with this increment rather than claimed closed.

⭑ **(a) is the recorded candidate for that ruling**, in the form the judges specified: count BIRTHS only
(`aggregateRevision === 0`, so a second command would fail closed); refuse act-record commands on the fork
keyed on `commandType`, not `targetAggregateType`; gate the premise with a metamorphic test (the candidate is
unchanged when exempt events are added to its base) plus its own control. It layers on (b)'s admitted-set bus.
It needs the sponsor's ruling on `AUTHORING-BACKBONE.md:269-271` first.

---

## 6. The mechanism

### 6.1 The bus — `packages/rph-application/src/command-bus.ts`

- `dispatchBatchGuarded`'s third parameter becomes `number | { position: number; admittedEventIds: readonly
  string[] }` (inline type: no new export). A bare number means `{position: n, admittedEventIds: []}`, **exactly
  today's behaviour**.
- Inside the same transaction, still FIRST: the tail after `position` must be **exactly** the admitted set —
  `log.length === position + admitted.size` AND every tail event's id is admitted. Exact because `event_id` is
  UNIQUE (`packages/rph-persistence/src/schema.ts`). Both terms are needed: count alone is fooled by a foreign
  event plus a missing admitted one; membership alone admits a missing witnessed id.
- `RevisionGuardConflict` gains optional `unadmitted: {eventId, eventType, aggregateType, aggregateId}` — the
  first foreign event, so a refusal names its cause.

### 6.2 The witness — `apps/rph-demo/src/lib/server/authoring-turn.ts`

- The turn gains `witnessedEventIds: string[]`; `beginAuthoringTurn` sets `[]`; **`resumeAuthoringTurn` does
  NOT reset it**, exactly as it does not reset `base`.
- `witnessingEngine(turn, delegate)`: `dispatch` **refuses any command other than `RecordModelExchange`**
  (candidate state belongs on `turn.engine`); for that one it dispatches **unconditionally** (PER-9 — never
  refused because of the turn's state) and notes `producedEventIds` only if the result is `ACCEPTED` ~~AND the
  turn is still the active turn for its PWA~~. Nothing on the noting path throws. `dispatchBatch*`, `fork`,
  `close` throw; reads pass through.
  ⭑ **Struck in `TT-2`, as an equivalent mutant.** The note goes on the turn OBJECT. A discarded turn's late
  try is therefore noted on the discarded turn, which can never commit, and never on its successor. A turn
  object never re-enters `turnsByPwa`, so a liveness check on the noting path changes nothing observable.
  What the struck clause was meant to protect is carried by the per-turn keying; mutant `TT-M8` (noted on
  whichever turn the PWA has now) is KILLED by W3.
- `canonicalActsOf(handle)`: the witness of the active turn whose `engine` IS `handle`, else `undefined`.
  (Implemented through a `WeakMap` of every recorder the turn hands out, so an `as()` re-binding of the fork is
  found too.)
- `commitAuthoringTurn` passes `{position: base.eventCount, admittedEventIds: witnessedEventIds}`.
  **`base.eventCount` is unchanged**, and so are its slice and hash jobs (§4.3).
- Witnessed ids are NOT bound into `candidateHash`: the hash names base, commands and resulting state, none of
  which an own act record is.
- `recordCommitFailure` keeps the detail's prefix byte-identical and appends *"First unadmitted event:
  `<eventType>` on `<aggregateType>` `<aggregateId>`."* when the conflict names one.

### 6.3 The floor — `apps/rph-demo/src/lib/server/floor.ts`

The canonical handle for the drain is derived: `opts.canonical ?? canonicalActsOf(engine)?.as(SESSION) ??
getEngine().as(SESSION)`. Same store, same principal, same position, one dispatch per try. The route needs no
change.

### 6.4 ⭐ The silent opt-out, turned into a refusal (judges' condition)

The witness is found by identity. A caller that passed an explicit `opts.canonical` while running on a turn's
fork would drain unwitnessed and silently reproduce `REG-F-425`. **So `runPwaFloor` refuses an explicit
`opts.canonical` when `engine` is an active turn's fork**, with its own test and mutant, and the `:322-329`
comment says why.

---

## 7. The two readings of "canonical unchanged"

After this change: the canonical **state** is unchanged until acceptance; canonical **act records** may be
appended during the turn, which is PER-9 working. The SSE text (*"Canonical DRAFT is unchanged"*) was already
exact. `summarizeAuthoringTurn`'s `canonicalUnchanged: true` is a type-level constant and now means the state
reading; `authoring-turn.test.ts:134` and `:227` assert whole-log equality in tests that run no floor, so they
remain true and are left as written. Any future test that folds a real review into them must assert the state
reading explicitly — never by loosening them.

---

## 8. Instruments — each with the red it must show first

| test | shows | red today? |
|---|---|---|
| **PR-2** conversation phantom: fork records conv_A while canonical creates conv_B; commit | the counter's unique job, isolated — trips ONLY the log limb | green; its mutant M1 **survives the suite today** |
| **B1–B5** bus limbs (`engine.test.ts`) | exact tail = admitted: accept / extra foreign / equal count wrong id / missing witnessed / bare number | new API |
| **PR-1** production composition: default module engine, NO explicit canonical, real-reviewer seam; commit | the defect fixed | ⭐ **RED on HEAD with `REG-F-425`'s detail** — observe and record `N` first |
| PR-1r repair try (2 events) · PR-1p a pre-existing exchange before the turn · PR-1s floor, resume, floor | +1 tolerance / slice hazard / accumulation | red on HEAD |
| **PR-2a** T2's drain on another PWA; T1 commits | the disclosed false conflict (§5.3) is PINNED, and the type exemption is told apart | green after |
| **PR-3** discard after the floor | PER-9 survives discard — kills the drain-on-fork fix | green before and after |
| W1 witness refuses a non-exchange command · W2 a DUPLICATE is not noted · W3 a discarded turn's witness does not admit into the next turn · W4 explicit canonical on a fork refused | each witness limb | new API |

**Mutants** (`scripts/mutants/ledger.ts`, consequence not condition): M1 log refusal becomes admission; M2
count-not-identity; M3 membership-not-exactness; M4 the type-exemption shape; M5 drain on the fork; M6 floor
ignores the witness; M7 witness admits any command; M8 notes by PWA not turn; M9 notes DUPLICATE; M10 resume
forgets; M11 explicit canonical accepted on a fork. ⚠ Each `why` is written from the OBSERVED output, not from
this table — M6's detail will carry the new suffix.

---

## 9. `REG-F-426` — the instrument that hid the defect

`acceptAgentCandidate` (`e2e/support/harness.ts:82-94`) asserts only `res.ok()`, and SvelteKit answers a failed
action to Playwright's `request.post` with HTTP 200 and `{"type":"failure",…}`. **The helper asserts the
envelope's `type === 'success'` and quotes the refusal on failure**, so a refused acceptance fails AT
acceptance, with its own reason. A strengthening; its predicted red is observable on the default lane today,
where the accepted reds that go through this helper must now fail at acceptance, with the refusal text, and no
spec outside REG-D-067's thirteen may change status.

---

## 10. What this does NOT do

- **The gate's thirteen accepted reds stay red.** The default lane uses the mock reviewer, which returns
  INCONCLUSIVE; that is `REG-D-067`'s territory. What changes is that a REAL reviewer's acceptance can succeed.
  The payoff is measured on the stand-in lane (`REG-F-427`'s method), and reported as measured, not predicted.
- **The cross-professional false conflict** (§5.3): filed, not fixed.
- **Discard during a review loses that run's exchange records** (inferred, not driven): discard is allowed while
  ASSURING, the fork's plan recording then throws (`authoring-turn.ts:170-175`) before the drain
  (`floor.ts:394` precedes `:410`), so the tries are lost and their bytes orphaned. The natural fix — drain
  first, in a `finally` — interacts with this design (a late drain after discard is a FOREIGN event to a
  successor turn on the same PWA) and is therefore **filed with its own predicted red, not built here**.
- Filed if the register does not already hold them: `floor.ts:434`'s hardcoded `subjectSemanticVersion: 1`;
  no join key between an assessment and the exchanges it rests on (PER-9 *correlation and causation*).

---

## 11. Exit

`PR-1` and its three twins pass on the production composition; `PR-2` and `PR-2a` refuse with their named
details; `PR-3` holds; M1–M11 are each KILLED by the test named; `REG-F-426`'s helper fails at acceptance on a
refused acceptance; `gate:fast` green except `REG-D-067`'s accepted set, **which must not grow**; `REG-F-425`
and `REG-F-426` closed in the register with the measured evidence; the §5.3 and §10 findings filed.
