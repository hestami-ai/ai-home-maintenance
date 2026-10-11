# DESIGN — JAN-EXEC Phase 7, the completion programme: the reviewer's misses, declared policies that judge, live authoring, and the replay

**Programme:** `JAN-EXEC` Phase 7, after P3. It answers `REG-D-109`, the sponsor's *"All of those options should be pursued and resolved."*
**Status:** DESIGN, revision 3, 2026-10-11. The build's review raised four more decisions (`REG-D-112`), which are delegated and listed in §7. The sponsor answered §8's four questions (`REG-D-110`). Two answers depart from the recommendation, and they are applied below: one review per policy (B1), and half B's traps measured, not refused (C4). §7's decisions are recorded as `REG-D-111`, delegated and flagged.
**Sources:**
- A read-only research pass: one reader per part, and a critic that re-read their citations and corrected eight claims.
- Each part's facts cite the line they were read from.

## 1. Why, and where it ends

- **Where Phase 7 stands.** P3 answered the execution half: on a published PWA, an Undertaking ran its five units, and every one completed under its assurance (`REPORT-the-live-end-to-end-run.md` §10).
- **What the "Yes" still carries.** The declared policies are signed off with no criterion checked (`REG-F-523`), and the reviewer missed 2 of 56 planted defects (`REG-F-555`). The PWA was typed by hand, and nothing replays the run.
- **The goal.** The sponsor's whole question, *"after a PWA and it's PWUs are built and published is an undertaking able to execute as intended?"*, answered end to end, by an agent-authored PWA, with the declared policies judging and the result replayable at no cost.
- **What remains a caveat after all four parts:** `REG-F-510`, that the PWA must name its product.

## 2. Part A — the reviewer's misses (`REG-F-555`)

- **What the research found.**
  - **The baseline is weaker than the entry says.** Its 162 clean planted evaluations were made before I1. In those runs devin ran in the runner's own folder, where it could read the qualification cases and their oracles (`REG-F-548`).
  - No answer shows that it did. None of the 314 answered calls mentions an oracle, a plant or a case id.
  - So four things changed between the last clean run and P1: I6, I4, I1 and model drift. Chance is also live: both misses landing in P1 has a probability of about 0.065.
  - **The miss is a routing.** Each missed reply named its plant as residual uncertainty, restating the very criterion it marked met.
  - **Where the prompt routes a concern.** It names only one destination, for a concern that leaves the criterion met (D8). Nothing tells the reviewer that a concern showing a criterion unmet must not be moved there.
- **A1, the change.** `ONE_ROW_PER_CRITERION` keeps *"A criterion that is met is recorded as met"*. Its last clause becomes *"a concern that shows a criterion is not met is recorded failed=true, and never moved to residualUncertainty"*.
  - It still asks the reviewer to find nothing: the sponsor's condition (`REG-D-105` (2)). D8's lines are untouched.
  - The 24 clean evaluations measure whether it pushes the reviewer toward failure.
- **A2, the pins.**
  - A new pin that the source holds the new clause. The existing pin at `reasoning-review-validator.test.ts:1463` reddens with the source.
  - The test's own constant (:1451) is edited with it. That constant is what the sponsor-condition pin (:1484) guards.
- **Its measurement** is the re-qualification of §6. Every case prompt moves, so all 40 cases are owed.
  - An optional supplement of 8 more repetitions of W-RR-03 and G3-RR-09, with their clean twins, costs 32 calls.
  - **The pass bar** is the sponsor's (§8): 0 misses in 56 would happen about 13% of the time even with no improvement.

## 3. Part B — declared policies that judge (`REG-F-523`)

- **What the research found.**
  - **Each phase's declared policies:**
    - requirements: requirement_coverage and intent_preservation;
    - design: assumption_disclosure, decomposition_coverage, architecture_coverage and intent_preservation;
    - implementation: assumption_disclosure, test_adequacy and intent_preservation;
    - end-to-end: fitness_for_purpose, test_adequacy and intent_preservation;
    - the root: intent_preservation and fitness_for_purpose.
  - **The criteria:** 14 (unit, policy) pairs over 7 policies, 100 criteria per run, 89 of them BLOCKING. Every catalog criterion is `MODEL_JUDGMENT`, so none is machine-checkable as declared.
  - **Today's sign-off** reads only `requiredEvidence`, which these 7 policies leave empty. It records `claimResults: []`, and its verdict type cannot say REJECTED.
  - **The kernel can already compute a verdict from results.** `RecordCriterionResult` exists, and `dispositionFromFindings` rejects on a mandatory NOT_MET. But nothing refuses a criterion that was never recorded: `RPH-CON-005` is unenforced.
- **B1, a declared-policy review.**
  - **What is asked.** The qualified reviewer judges each unit's declared policies over its work product and its command evidence (`R18`).
  - ~~**Per unit (recommended, §8):** one review covering all the unit's policies, about 5–6 calls a run. **Per policy:** about 15.~~ ⭑ **The sponsor chose one review per policy** (`REG-D-110` (3)): each of the 14 (unit, policy) pairs is judged on its own, about 15 reviewer calls a run.
  - **The machinery is the validator's own:** its call, retry, repair and capture. It gets a new framing that names each policy's purpose and lists its criteria.
- **B2, the verdict is computed from the answers.**
  - One `RecordCriterionResult` is recorded per criterion.
  - The verdict comes from `dispositionFromFindings`.
  - The demo limitation text is dropped.
- **B3, a negative verdict is recorded, not refused before dispatch.** A paid call was made, and PER-9 wants its record.
  - **Delegated:** a declared REJECTED goes the canon route: a blocking finding, then `UNDER_ASSURANCE → REJECTED`.
  - Its recovery is canon's *"Replacement PWU created → SUPERSEDED"*. A stopped unit's P7-6R re-run does not reach a unit already under assurance (`stopped-unit-recovery.ts:386`).
  - In the paid run, a declared refusal is reported, not recovered.
- **B4, the fingerprint covers it.** The new framing gets its own probes and its criteria limb, so a change to it moves the fingerprint. Without them, the qualification check would stay green over a prompt nobody measured: `REG-F-553`'s class.
- **B5, its qualification cases.** One clean case and one planted case per policy, 7 policies, 2 repetitions each, about 28 calls.
  - **Their oracles go to the sponsor for conferral**, as `oracles-v4.ts` requires. That is one screen, before the paid re-qualification.
- **B6, the root and the human decision. Both delegated, and flagged.**
  - **The root** is judged over its children's work products and the end-to-end evidence (DEC-6).
  - **`fitness_for_purpose` needs a HUMAN evaluator.** The model's criterion answers are its evidence, and the operator records the human decision as a HUMAN actor, citing them.
- **B7, R20 stays out of scope. Delegated.** Declared verdicts judge on the assurance plane. They do not gate `CompleteExecutionStep` (`REG-F-406` item 2).
- **B8, the run report.**
  - **Stage 5b** reads as intended when every criterion is answered and the verdict follows from the answers.
  - **The opening caveat** loses its `REG-F-523` line.
  - **The sign-off's time bound** grows to cover the reviews.

## 4. Part C — live authoring (half B, P7-7)

- **What the research found.**
  - **The existing lane cannot pass** (`REG-F-506`), for four reasons:
    - its done-signal never fires while a candidate is staged;
    - test mode's stand-in reviewer leaves the candidate BLOCKED;
    - a real review outlasts its waits;
    - stipulations would hollow the review.
  - **The run lane hard-codes the five hand-typed units:** `phase7-operator.ts:1115-1123`, `run-archive.ts:76-82` and `run-report-core.ts:137-143`.
  - **The author is Pi, with only the authoring tools.** Its own calls leave no record in the store.
- **C1, a half-B mode of the lane.**
  - It creates the draft, sends the request, and stays on the page: a turn is discarded if the page leaves.
  - It waits on the candidate's status, then presses "Accept exact candidate".
  - Then Submit, Validate and Publish, then the Undertaking.
  - It records the candidate hash, the floor's dispositions and the author's model.
- **C2, the units are read from the published PWA**, not from the hand-typed list, with an order rule. "Types as typed" becomes "types as accepted".
- **C3, an authoring allowance and a pinned author model.**
  - The turn and its reviews get a bound of their own in `lane-config.ts`.
  - `JPWB_AGENT_MODEL` is required and recorded (`REG-F-531`'s class).
- **C4, checks on the accepted candidate before Submit.** ~~They refuse a candidate that would strand or fake a "Yes":~~ ⭑ **They record and report; they refuse nothing** (`REG-D-110` (4): *"Name wordfreq; measure traps"*). The request names `wordfreq`, and a trap plays out live. What the checks find goes into the run report beside what the run then did:
  - every model leaf is MODEL, with an ACTIVE prompt (`REG-F-505`, `REG-F-507`);
  - it uses only the four supplied markers (`REG-F-508`);
  - each rendered prompt fits the 4,000 characters the reviewer is shown;
  - each policy governs its kind (`REG-F-524`).
  - ~~A refusal here costs no execution calls.~~ A candidate that would strand still runs, and its units' stops are reported against these findings.
- **C5, the run report.** Stage 1 is measured: the floor, the reviewer, the accepted hash and PUBLISHED. A per-unit check that a model actually ran closes `REG-F-505`'s false "Yes".
- **C6, the dry rehearsal.** It stops before Send, since authoring is a model call. The turn itself is rehearsed in the gate with the mock agent, with stipulations only under `e2e/` (`REG-F-477`).
- **Measured as they are, and disclosed.**
  - `REG-F-503`: the reviewer is not shown the policies or the prompts. Fixing it needs a new graph case set and its conferral.
  - `REG-F-504`: the acceptance leaves no record.
  - `REG-F-516`: conditional children are never instantiated.

## 5. Part D — the replay (Phase 8)

- **What the research found.**
  - **All three must replay** (`REG-F-530`): the executor's turns, the reviewer's answers and the commands' results.
  - **Commands are replayed, never re-run.** A command review's prompt carries the run's duration.
  - **Replay was withdrawn once.** `REG-D-071` Q2(a) withdrew it, against `REG-D-068`'s *"bound to the subject it was made about"*. So whether a replayed judgement may count is the sponsor's to rule.
- **D1, the recording.** A committed folder holds, scrubbed of the run's paths and scanned before it is written (`REG-F-536`):
  - the commit, the fingerprint and the expected stage matrix;
  - the executor's tries with their tool calls;
  - the commands' results and captures;
  - the reviewer's calls, each with its prompt hash, its reply and its elapsed time.
- **D2, the switch.** `JPWB_REPLAY`, in test mode only. Outside it, the switch is refused.
  - The executor, the reviewer and the runner each gain a REPLAY arm.
  - The replay reviewer fails closed on a prompt-hash mismatch (`REPLAY_STALE`). It never falls back to a live reviewer, the stand-in, or answering by order.
- **D3, the regression.** The lane runs in a `replay` mode, with PATH emptied. It asserts the recorded matrix, that no exchange was graded `PROVIDER_REPORTED`, and that no program was spawned.
- **D4, when it is built and what it records.**
  - Built early, against P3's archive as an uncommitted development fixture. Once Parts A and B land, P3 goes STALE, which gives the stale path its red at no cost.
  - Recorded from the last paid run, so it replays the final code.
  - It must precede the recorded run's fixes for `REG-F-518` (concurrent tool calls) and record each call's elapsed time.

## 6. The order, and why

1. **Build Parts A and B, the half-B lane (C1–C6), and the replay's machinery (D1–D3).** This costs 0 calls.
   - Every change to what the reviewer reads lands before the one re-qualification. Otherwise a second one is owed.
   - The lane's generalization lands before the run that uses it.
   - The report is final before anything is recorded.
2. **The declared cases' oracles go to the sponsor for conferral.** One screen.
3. **The re-qualification, P4.** The 40 cases, the 14 declared cases and the optional supplement: about 84–144 calls.
4. **Half A again, P5.** It checks that the "Yes" now carries neither `REG-F-523` nor `REG-F-555`: about 30–41 calls.
5. **Half B, P6.** About 25–60 reviewer calls, plus Pi's authoring and executor turns.
6. **The recording, from P6, or from P5 if half B does not complete.** 0 calls.

**The budget:** about 140–245 reviewer calls beyond the 198 spent, more with one declared review per policy. The limit is 450 (`REG-D-110` (1)). Each paid step still reports before the next.

## 7. Decisions made here, delegated, and flagged for confirmation

- **B3:** a declared REJECTED goes the canon route, and is reported in the paid run, not recovered.
- **B6:** the root is judged over its children and the end-to-end evidence. The operator records `fitness_for_purpose`'s human decision.
- **B7:** declared verdicts stay on the assurance plane (R20 out of scope).
- ~~**C4:** the candidate checks refuse before Submit.~~ ⭑ Superseded by `REG-D-110` (4): the checks record and report, and refuse nothing. `REG-F-503`, `REG-F-504` and `REG-F-516` are measured as they are, and disclosed.
- **D4:** the replay is recorded from the last paid run, not from P3.
- **`REG-D-112`, after the build's review:**
  - (a) a declared review that did not conclude may be re-run, and a declared REJECTED is not re-reviewed;
  - (b) a dry run calls no model, and its sign-off stops before the first declared review;
  - (c) the replay covers the execution half from the published PWA, not the authoring turn;
  - (d) Pi runs a turn's tool calls one at a time (`REG-F-518`), before the recorded run.

## 8. For the sponsor

1. **The limit.** Raise it to about 450 reviewer calls for the whole programme (recommended)? Or approve each paid step's budget as it comes?
2. **`REG-F-555`'s wording.** The symmetric clause of A1 (recommended), dropping the last clause, or keeping it as it is and only re-measuring?
3. **Declared reviews:** one per unit covering all its policies (recommended, about 5–6 calls a run), or one per policy (about 15)?
4. **Half B's request and its traps.** Name the product, `wordfreq`, so P7-4's checks apply, and refuse a candidate that would strand or fake a "Yes" before Submit (recommended)? Or a request with no product named (`REG-F-510` first)? Or measure the traps as they are?
- **Still to come:**
  - the declared cases' oracles, for conferral;
  - the replay's two questions: may a replayed judgement count in the test lane, and must a stale recording keep the gate red until it is paid for again. They come when Part D's recording is designed in full.
