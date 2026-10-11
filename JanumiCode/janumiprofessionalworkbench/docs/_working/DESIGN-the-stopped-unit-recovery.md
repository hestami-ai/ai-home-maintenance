# DESIGN — JAN-EXEC Phase 7, P7-6R: a stopped work unit waits for a person, who re-runs its review, re-runs its work with the findings, or abandons it

**Programme:** `JAN-EXEC` Phase 7, step P7-6R, the recovery that P7-6's re-run needs. (Roadmap row P7-7 is the authoring half.) It answers `REG-D-104` (1) and `REG-F-511` (K1).
**Status:** DESIGN, revision 1, 2026-10-10. Not yet built. Its two questions were answered as recommended (`REG-D-105` (3), (4)): §9.
**Sources:** the sponsor's ruling, verbatim in `REG-D-104`. A read-only research pass over canon, the engine, the Undertaking route, the register and DBOS, with a completeness critic that re-read every cited line. Each fact below cites the line it was read from.

## 1. The ruling, and what it changes

The sponsor chose *"Wait, then re-run or abandon"*:

> The refused unit waits for a person, who chooses: re-run the review, re-run the work with the findings, or abandon. Each re-run is a new recorded attempt reusing what came before (a plan revision now; DBOS fork + recv later).

**Today a stopped unit can only be abandoned** (`REG-F-511`):
- Begin & Execute admits only a PROPOSED unit.
- Retry only re-queues a FAILED step, and Start runs nothing.
- Both assurance acts are refused while the unit is RUNNING.

In the measured run, every phase stopped this way. So no phase completed (`REPORT-the-live-end-to-end-run.md` §1).

## 2. What canon already says

- **A wait is durable state.**
  - *"Waiting — for review, external evidence, time — is durable professional state, not a held thread."* (DOC-001:225)
  - *"Wait reasons belong in durable Process/Attention/blocking state unless a ratified contract says otherwise."* (Coding Agent Guide:603)
  - `WAIT` is one of the control actions a controller may select (RPH-DOC-002:2223).
- **A re-run is a plan revision.**
  - STA-8 (DOC-003:203): *"Plan revision supersedes the prior plan and preserves its attempt history."*
  - Its non-example (:205): *"revising a plan is legal and expected — supersede, approve, proceed; only beginning new work under the superseded plan is barred."*
- **A repair carries findings.** DOC-001:227: *"A retry or repair context carries the findings that triggered it — never the quarantined output itself — and names the specific violated criterion, not a generic try-again signal."*
- **Re-running a validator does not erase a finding.** ASR-12 (DOC-003:289): *"a finding-type observation never disappears because an artifact was regenerated, a validator reran, a waiver was granted, or a successor version passed"*.
- **A control action is recorded.** It records its *"triggering condition; evidence or observations considered; policy authorizing the action; actor; affected objects; expected outcome."* (RPH-DOC-002:2242-2249)
- **Retry exhaustion leads to replanning.** RPH-EXE-008: after the cap, *"It must select: change tactic; replan; escalate; reject; abandon."* So a re-run is a replan, which canon permits.
- **Abandonment is authority-bearing.** It needs a Decision (DOC-001:168; Coding Agent Guide:1097). The route already records one (`+page.server.ts:2220-2266`).
- **Where canon is silent.** It does not say a re-run is a person's choice; the ruling is stricter than canon there, not in conflict with it. It names no state "waiting for a person's decision"; the step's and the unit's WAITING are the nearest ratified states.

## 3. What the engine already has, and what no test has driven

- **Waiting.**
  - `EnterExecutionStepWait` moves a step RUNNING→WAITING. It is cleanup-exempt and spends no budget (`step-command-spec.ts:354-376`).
  - `CancelExecutionStep` accepts a WAITING step, also on a superseded plan (:308-310).
  - The unit's execution axis has RUNNING→WAITING→RUNNING (`transitions.data.ts:665-666`, marked RECONSTRUCTED).
- **A recorded choice.** A Decision carries `decisionType` (including `REPLAN` and `ABANDON`), `selectedOption`, `subjectObjectIds`, `consideredEvidenceIds`, `consideredObservationIds`, `rationale` and `authority` (`messages.ts:384-394`). So a person's choice is recorded losslessly with no contract change.
- **Plan revision**, from existing commands:
  1. Propose plan B.
  2. Supersede plan A, citing B. This requires B on the same unit, and A PROPOSED, UNDER_REVIEW, APPROVED or ACTIVE (`execution.ts:622-660`).
  3. Approve and activate B. This requires one ACTIVE plan per unit and an open unit (:442-494).
  4. Start B's step. This writes a new `ExecutionStepStarted`, which is the new attempt (`rph-domain/src/execution.ts:756-772`).
  5. Complete B's step, then move the unit to SUCCEEDED citing B. This satisfies `rejectUnbackedExecutionSuccess` (`pwu.ts:1560-1605`).
- **Not yet driven.** No test drives this chain (engine reader: no test holds both `SupersedeExecutionPlan` and `ActivateExecutionPlan`). So R-1's first act is to drive it (§7).
- **Gaps the chain carries** (`REG-F-232`):
  - There is no `ReviseExecutionPlan` act.
  - `planVersion` is the literal 1.
  - Supersession does not touch the old plan's steps, so A's step must be closed explicitly.

## 4. The design

### RD1. Scope: R-1 covers the review-refused stop; R-2 covers the other five

- **R-1** covers the stop that ended every phase of the measured run: a completion refused by the assurance floor (`+page.server.ts:1598-1666`). That covers an INCONCLUSIVE, REJECTED or ESCALATED review, a reviewer's transport failure, and a command result's refusal.
- **R-2** covers the other five stops. Three leave the step FAILED (context policy, sandbox, a try that did not run); two leave it RUNNING (a work product or a command that could not be recorded). R-2 also runs the evidence join on every return path, `REG-F-511`'s remedy 3.

### RD2. The wait is recorded where the refusal happens

- When the floor refuses a completion, the route now records two things:
  - `EnterExecutionStepWait` on the step, with a reason naming each refusing policy and its disposition;
  - the unit's execution axis RUNNING→WAITING.
- **The unit then reads as waiting for a person, durably.** Today the refusal writes no event (`REG-F-513`), so for this stop that entry closes.
- **What the page then offers** is the choices of RD3, and nothing that runs nothing. Retry and Start are not offered on a waiting step (`REG-F-466`).

### RD3. The choices, by what the refusal was

The floor already sorts a refusal into a problem with the review or a problem with the work (`FloorRemediationAction` and `isOperationalRemediation`, `apps/rph-demo/src/lib/server/floor.ts:214-247`). The choices follow that sort:

| The refusal | Re-run the review | Re-run the work | Abandon |
|---|---|---|---|
| **The review did not conclude**: INCONCLUSIVE, a validator failure, a transport failure, an empty findings list (`REG-F-552`) | offered | offered; the page says the review gave no findings to carry | offered |
| **The review concluded against the work**: REJECTED, with findings | **not offered** (`REG-D-105` (3)) | offered, with the findings | offered |
| **The review escalated** | **not offered** (`REG-D-105` (3)) | offered, with the subject findings; the escalation itself is never fed back (`REG-D-090`) | offered |
| ⭑ *As built:* **the reviewer itself must change**: a substituted model, or a reviewer not independent of the producer | **not offered** | **not offered**: a re-run of the work is reviewed by the same reviewer | offered |
| ⭑ *As built:* **a floor policy other than the review refused the work**, the review having passed | **not offered**: a re-review cannot change that policy's finding | offered; the review gave no findings to carry (`REG-F-515`) | offered |

- **Why re-review is not offered after a concluded refusal.** The floor reads the latest assessment for each policy (`floor-gate.ts:280`). So a second review of the same work product, run until one says SATISFIED, would clear a refusal the first review reasoned out.
  - That is reviewer shopping. It contradicts ASR-12 in substance.
  - For an escalation it is `REG-F-474`'s defect, driven.
- **This narrows the sponsor's three choices for those refusals.** So it is asked (§9 Q3), not decided here.

### RD4. The person's choice is a Decision

- **How it is recorded.** `ProposeDecision` plus `ApproveDecision`, in the same batch as the act it authorises.
  - **The type:** `REPLAN` for a re-run, with `selectedOption` `RERUN_REVIEW` or `RERUN_WORK`; `ABANDON` for abandonment.
  - **`subjectObjectIds`:** the unit, the refused plan, and the refused work product and its evidence.
  - **`consideredObservationIds`:** the refusing assessments' observations.
  - **`authority`:** the person, as a HUMAN actor.
  - **`rationale`:** typed by the person. It is required and must not be empty.
- **This meets canon's control-action record** (§2): the trigger is the refusal; the observations considered, the actor, the affected objects and the expected outcome are each a field.
- **The authorising policy** is the ruling itself, cited in the rationale's template. No policy object exists for a person's re-run, and the record says so rather than inventing one.

### RD5. A re-run is a plan revision, in one batch

The batch, in order:

1. The Decision (RD4).
2. Propose plan B, with one step.
   - A re-run of the review gets a **review step**: it runs no producer.
   - A re-run of the work gets a **producer step**, as Begin & Execute builds today.
3. Supersede A, citing B.
4. Cancel A's waiting step, with a reason that cites the Decision.
5. Request and authorise B's binding. A binding authorises only its own step (`execution.ts:225-251`).
6. Approve B, then activate it.
7. Move the unit's execution axis WAITING→RUNNING.
8. Start B's step. This is the new attempt on the record.

Then the step runs:

- **A re-run of the review** runs the floors over A's recorded work product and evidence (RD7), and completes B's step naming them. The gate judges the new assessments.
- **A re-run of the work** runs the producer loop in a fresh session. Its first turn carries the instruction and the carried findings together (RD8). The loop then runs as today.

**On success**, the unit goes RUNNING→SUCCEEDED citing B, and on to assurance as today. **On another refusal**, B's step waits as A's did. Each link in the chain is a person's Decision, and the page shows how many re-runs the unit has had.

### RD6. Lineage: the artifact names the attempt that made it

- `ARTIFACT.producingExecutionAttemptId` exists (`messages.ts:181`), and the route never sets it. R-1 sets it to the attempt's key, `<stepId>#<n>` (`execution-attempts.ts:185`).
- This tells a re-review which attempt made what it re-reviews. It is also the reference a DBOS step output would carry (§6).

### RD7. What a re-review rebuilds, and its refusal when it cannot

The route reader found that a re-review needs four things the floor took from memory:

- **The producing prompt.** It is re-rendered from the type's template and the subject. It is checked against the exchange's `promptTemplateFingerprint` (`run-model-step.ts:526`), and a mismatch refuses.
- **The rationale.** It comes from the EXECUTION exchange's retained raw reply, split as today (:458, :500).
- **The producer's identity.** It comes from that exchange.
- **Each command's run.** It comes from the EVIDENCE object's `contentReference` (command, exit code, timed out, duration) and its stored bytes (`evidence-join.ts:193-216`).

**If any of them cannot be rebuilt, the re-review refuses and the unit keeps waiting.** It never reviews a partial reconstruction.

### RD8. A re-run of the work carries the findings in a fresh session

- **The hazard, found by the route reader.** Today the findings turn omits the instruction, because the session held it (`run-model-step.ts:271-279`). A fresh session given that turn would get findings with no task.
- **The fix.** In a re-run, try 1's turn is the instruction followed by the findings. It declares `PRIOR_REVIEW_FINDING` only. It does not declare `PRIOR_WORK_PRODUCT` or `PRIOR_RATIONALE`, because the fresh session does not hold them (:149-150).
- **The workspace still holds the earlier files** (`workspace-host.ts:232-239`). The producer sees them as files, and the record says so.
- **Only subject findings are carried** (DOC-001:227). An escalation recommendation and an INCONCLUSIVE review carry nothing (`REG-D-090`; `REG-D-059`).

### RD9. Budgets

- **The budgets restart, by design.** A new plan's step has its own retry budget, which is counted per plan and step (`execution.ts:756-770`). The producer loop's repair bound also restarts.
  - That is by design: each re-run is a person's decision, and canon lists replanning among the permitted responses to exhaustion (RPH-EXE-008).
  - The count of re-runs is recorded (the Decisions) and shown.
- **Paid runs spend reviewer calls.** A re-run of the review spends at least one reviewer call for the work product, plus one for each command reviewed. A re-run of the work spends executor and reviewer calls as a first run does. In the paid lane each re-run counts against the sponsor's limit.

### RD10. What R-1 carries and does not fix

- **`REG-F-232`.** There is no `ReviseExecutionPlan`, and `planVersion` stays 1. The chain is read from `supersedingExecutionPlanId`.
- ~~**`REG-F-433`.** A reader that returns the older of two assessments on a tie. A re-review is later in time, so it does not tie. A test pins that.~~
  - ⭑ **Corrected 2026-10-10, before any build: that line was wrong.** `loadReviewerAnswer` sorts by `attemptOrdinal` alone, and the sort is stable (`reviewer-answer.ts:50-53`). A re-review's first try is ordinal 1, like the original's, so the two tie, and the older answer is returned. Time does not enter.
  - **It bites twice in Phase 7.**
    - The run report pairs a review with its answers by subject, and refuses any subject with more than one floor run (`REG-F-433`'s pointer of 2026-10-10). Every re-reviewed work product would be reported as not pairable, and P7-4f could not adjudicate it.
    - The run plan's own rule for P7-6 says: *"a fix that reviews something again first builds `REG-F-433`'s join key (the `REG-D-070` Q2 order), or mints a new subject"* (`DESIGN-the-live-end-to-end-run.md` §6, P7-6).
  - **So R-1 builds the join key, as package B7.** It is also first in the sponsor's ruled order (`REG-D-070` Q2: this key, then dropping G4, then `REG-F-431`).
    - **What it does:** one floor-run token per floor run, used for the assessments' correlation and for the exchanges' `runToken`, on both planes (`REG-F-433`'s first remedy).
    - **What reads it:** the reader and the run report pair by that token, not by subject.
    - **The red that must come first:** two floor runs on one subject with distinct answers; the reader must return the second run's (the entry's own predicted red).
- **`REG-F-512` and the shared workspace.** There is no snapshot per attempt. A workspace hash per attempt is owed for the port.
- **`REG-F-544`.** Recovery never routes through a hand completion.

## 5. The live lane (Phase 7)

- **The run is unattended.** So in the paid lane someone, or something, must make the person's choice. §9 Q4 asks how.
- **The recommendation is a rule declared in the run plan.** The lane acts as the operator by that rule, and records each choice as the operator's Decision:
  - a review that did not conclude is re-run once;
  - a concluded refusal has its work re-run once, with the findings;
  - then the unit is abandoned.
- **This is not the "automatic re-run" the sponsor declined.** The product never chooses by itself; the lane is an operator following a plan the sponsor approved. The record names the operator, not the engine.

## 6. Under DBOS (the port; a hypothesis, and DBOS is not adopted)

- **Status.** DBOS is the platform's default (`REG-Q-016`) but is not in this repository's code: no ADR exists, and the port is post-0.1.x (`docs/JPWB Implementation Roadmap and Tracker.md:154`).
- **The DBOS facts below were not fetched.** They are the research pass's own knowledge, and they are to be checked before the port.

| Today (R-1) | Under DBOS |
|---|---|
| One attempt, `<stepId>#<n>` | One workflow, with its ID equal to the attempt's |
| The refusal: step and unit WAITING, with a reason | The workflow publishes its state (`setEvent`) and **ends** |
| The person's Decision | The person's act starts the next workflow, with the Decision's ID as the idempotency key |
| Re-run the review: plan B reuses A's work product and evidence | `forkWorkflow(A, <review step>, {newWorkflowID: B})`: earlier step outputs are reused, and nothing executes again |
| Re-run the work with the findings: plan B's producer step, seeded with the findings | A new workflow with the inputs `{unit, priorAttempt: A, findingIds}`. Fork keeps the original inputs, so it cannot carry new findings |
| Abandon: a Decision plus `AbandonPwu` | The same commands, run as a workflow step |
| A transport failure: P7-2b's one retry inside the validator | A step retry (`retriesAllowed`, `maxAttempts`, `backoffRate`); never a wait for a person |

- **The wait is engine state, not a held `recv`.** The ruling's words are *"DBOS fork + recv later"*. A workflow blocked in `recv` for days is pinned to the application version that started it. Canon also prefers durable state to *"a held thread"* (DOC-001:225).
  - So the recommendation is that the attempt's workflow ends at the refusal, and the wait lives in the engine's record. `recv` remains possible.
  - This is a choice for the port, not for now. R-1 records the same facts either way.
- **What R-1 records, so the port is a mapping and not a redesign:**
  - an attempt ID per attempt (RD6);
  - the chain of plans, through `supersedingExecutionPlanId`;
  - the wait as recorded state (RD2);
  - the choice as a Decision (RD4);
  - what a re-review reused, in the Decision's `subjectObjectIds`.
  - **Still owed for the port:** evidence recorded as each command runs (R-2), and a workspace hash per attempt.

## 7. Order, and the tests that must turn red first

1. **R-1a: drive the plan-revision chain in the engine, with no route.** A store test runs RD5's batch on a unit left as K1 leaves it, and completes B naming A's work product.
   - What must hold: A is SUPERSEDED and its step CANCELLED; B is ACTIVE and its step SUCCEEDED; the unit is SUCCEEDED; and a Start on A's step is refused (STA-8).
   - Predicted, untested: the chain is admitted. If a guard refuses, that is the first finding.
2. **R-1b: the wait.** The K1 route test (`phase7-route.characterization.test.ts:294-418`) must turn red: today it expects the step RUNNING after the refusal, and RD2 makes it WAITING with the unit's execution WAITING.
3. **R-1c: the three acts.** Three new route tests:
   - **Re-run the review.** It writes a Decision `REPLAN`/`RERUN_REVIEW`; makes no executor turn; calls the reviewer; and completes B naming A's work product. Red at HEAD: no such action exists.
   - **Re-run the work.** Its first turn holds both the instruction and the findings. That is red against today's findings-only turn.
   - **Abandon from waiting.** It cancels the step and abandons the unit.
4. **R-1d: what the page offers.** By RD3's table, re-run the review is shown only for a review that did not conclude. A test asserts its absence after a REJECTED review (pending §9 Q3).
5. **R-1e: the five-unit e2e spec.** Its `onlyStepOf` helper asserts one plan per unit (`phase7-five-unit.e2e.ts:176-182`), so it turns red on a second plan and is rewritten to read the active plan's step.
6. **R-1f: the live lane's rule** (pending §9 Q4).
6a. **B7: `REG-F-433`'s join key** (RD10, corrected). It lands before any re-review is paid for. Its red is the entry's own: two floor runs on one subject, and the reader must return the second run's answer.
7. **The gate and the mutation measurement as usual, then commit.**

## 8a. As built (2026-10-10; B4 to B8, then three fix rounds)

Built by one builder and four fixers, each diff reviewed adversarially; merged into `jan-exec/phase7c`. Where the build departs from RD1 to RD10, or adds to them:

- **The chain is admitted** (R-1a). The engine admits RD5's batch from K1's state, as predicted. A Start on the superseded plan's step is refused (STA-8).
- **RD3 has two more rows** (the table above).
  - When the reviewer itself must change, neither re-run is offered: each would be reviewed by the same reviewer. A changed reviewer does not re-open the unit's re-runs; that is not built, and the page says so.
  - A floor policy other than the review can refuse the work, the review having passed. Then a re-review is not offered. A re-run of the work carries no findings, because the floor's classifier lists none for that stop (`REG-F-515`).
- **The wait.**
  - It is recorded with a reason that names only the choices its stop offers.
  - The server refuses a hand Resume or Cancel on a step awaiting a person's choice, and names the three acts. A hand Wait's step is resumed and cancelled as before.
- **RD4's citation** is a fixed text per act, in `recovery-authority.ts`, after the person's words verbatim. It names the ruling that applies to that act and that stop, and says no policy object authorises the choice.
- **RD5 departures.**
  - The review step requests no runtime binding.
  - A command's evidence carries the attempt key in its content reference, because EVIDENCE has no field for it.
  - Only the refused reviews are re-run.
- **RD10, B7: `REG-F-433`'s join key is built.**
  - One floor-run token per floor run, on both planes.
  - The run report pairs by it.
  - The PWA reader joins to the assessment it displays, reads the calls from canonical, and names the try the run report names, or none.
- **The paid lane's rule** (`REG-D-105` (4)).
  - **How it chooses.** It reads which re-run to make off the row's own offers, then decides from the store what happened:
    - **a new plan whose step waits again** → refused again → abandon;
    - **no new plan** → the press was refused before anything ran → left as found, with the server's words recorded;
    - **the unit not waiting** → left as found.
  - **What it never does.** It never presses a control the row does not offer. A stop that offers no re-run is left as found.
  - The limit is checked before each re-run.
- **The spec's timeout** counts every phase and recovery act at its bound, plus the setup's allowance. The allowance is not a worst case, and the code says so.
- **Not built in R-1:** R-2's five other stops, and the evidence join on every return path (`REG-F-511`).

## 8. How it fits with P7-6

- **Both must land before the measured run is repeated.** A re-review run with today's reviewer would reproduce `REG-F-549`.
- **The order.**
  1. P7-6's I1, I2 and I4 in code, and R-1; both cost no calls.
  2. `REG-F-552`'s remedy.
  3. The re-qualification (paid).
  4. The re-run (paid).

## 9. For the sponsor

⭑ **Answered 2026-10-10, both as recommended (`REG-D-105`).** Q3: *"No: re-run work or abandon (Recommended)"*, so RD3's table stands. Q4: *"Rule in run plan (Recommended)"*, so §5's rule stands.

**Q3. After a review that concluded against the work, may the person re-run the review?**
- **Recommended: no. Re-run the work or abandon.** A second review of the same work product could clear the first review's reasoned refusal, because the latest assessment wins.
- The other option: yes, all three choices always.

**Q4. In the unattended paid run, who makes the person's choice at a stop?**
- **Recommended: a rule declared in the run plan, acted on as the operator, and recorded as the operator's Decisions.** A review that did not conclude is re-run once; a concluded refusal has its work re-run once, with the findings; then the unit is abandoned.
- Or: the run pauses at each stop for the sponsor.
- Or: no recovery in the paid run; it stops as now.

(Q1 and Q2, the spend and `REG-F-552`'s remedy, are P7-6's: `DESIGN-the-reviewer-isolated.md` §4c.)
