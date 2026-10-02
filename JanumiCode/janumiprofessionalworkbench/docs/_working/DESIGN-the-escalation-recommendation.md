# DESIGN — `JAN-ESCREC`: a reviewer's ESCALATED recommendation is recorded, and escalates a review when nothing else blocks

**Authority:** `REG-D-089`, recorded with this design. On 2026-10-01 the sponsor answered the report that put three
options to them for `REG-F-473`: *"REG-F-473 - select option (a) as recommended."* · **Date:** 2026-10-01 ·
**Revision:** 2 (revision 1 was attacked by three adversarial critics; §7 lists what changed) · **Status:** ~~DRAFT.~~ `ER-1` BUILT 2026-10-02 (§8; `REG-D-092`); `ER-2` owed.

**The report's text for option (a), verbatim** (it is recorded in `REG-D-089`, because it exists nowhere else):
- *"What the canon says. The reviewer recommends, and the system records the official outcome; the canon says both are
  to be recorded. So the fix will store the reviewer's ESCALATED as its recommendation in every case."*
- *"(a) Recommended: escalate only when nothing else already blocks. If no criterion failed, the outcome becomes
  ESCALATED: publishing stays blocked, and the page says to route the review to a human reviewer. If a criterion
  failed, the outcome stays REJECTED, which is more actionable, with the escalation recorded beside it."*

**Delegation.** Decisions the ruling does not settle are delegated best judgement under `REG-D-071`. They are recorded
as `REG-D-090`, flagged for sponsor confirmation (§6). Two of them depart from what the 2026-10-01 messages said, and
§6 says so.

---

## 1. What is asked, and how this design reads it

1. **Record.** Whenever the reasoning reviewer's recommendation is the literal `ESCALATED`, the record says so,
   whatever the outcome (D2). Two narrowings follow from canon and from the product; they are listed in §6.
2. **Escalate only when nothing else already blocks.** This design reads the headline across the whole floor. The
   review's outcome becomes ESCALATED only when:
   - the review itself is clean: every mandatory criterion was answered, and none failed (a computed SATISFIED);
   - and every other floor policy is SATISFIED.

   Publication stays blocked, and the operator is told to route the review to a human (D1, D3).
3. **Otherwise keep the outcome.** In every other case the outcome stays as computed, and the recommendation is
   recorded beside it. That covers:
   - a failed criterion (REJECTED);
   - an unanswered one (INCONCLUSIVE);
   - another policy's block (for example a graph that is not well formed).

   *"More actionable"* is the ruling's own reason, and a graph defect is the same kind of actionable block.

**The canon this serves.** ASR-1 separates the validator's *recommendation* from the authoritative disposition the
Assurance Service records (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:239`). The Contract Package
says that a service *"should not be able to"* … *"collapse validator recommendations into authoritative decisions"*
(`:2533`, `:2542`). Its §38 *Logging and Trace Requirements* lists both, *"For every validator call"* (`:2411-2422`).

## 2. What the product does today

This was read from code at `ed7bd0ff` by three mappers, a critic and three design critics. Shapes were driven in
memory, and every driven claim below is labelled. `pkg/` = `packages/`, `app/` = `apps/rph-demo/src/`.

- **G1 — the recommendation is read once, for one boundary rule.**
  - It reaches composition only at `pkg/rph-assurance/src/floor.ts:357`, for the boundary rule *"a SATISFIED
    recommendation with a mandatory criterion unmet"* (`assurance-rules.ts:277`).
  - The VALID arm composes from findings and criteria alone (`floor.ts:369-374`).
  - Driven: every criterion clean plus ESCALATED gives aggregate SATISFIED, the gate open, and a review recorded
    SATISFIED.
- **G2 — the recorder writes the outcome where the recommendation belongs.**
  - `pkg/rph-engine/src/record-assurance.ts:238`: `dispositionRecommendation: a.disposition`.
  - The handler uses that one field as the target state (`pkg/rph-application/src/handlers/assurance.ts:1937`,
    `:2624-2632`).
  - Driven: one criterion failed plus ESCALATED is recorded REJECTED, and the ESCALATED is recorded nowhere.
- **G3 — no type carries the recommendation past composition** (`floor.ts:266-273`; `recording.ts:45-68`). The
  recording plan does hold the validator result, `r`, with its `dispositionRecommendation` (`recording.ts:104-105`).
- **G4 — an ESCALATED outcome already flows.**
  - Every union admits it, and ASSESSING → ESCALATED is legal (`pkg/rph-domain/src/transitions.data.ts:1744-1747`).
  - Driven: a plan whose review is forced to ESCALATED is recorded ESCALATED through `AssuranceAssessmentCompleted`,
    with no recorder or handler change.
  - The aggregate maps a required ESCALATED to INCONCLUSIVE (`assurance-rules.ts:87-88`), so the gate stays closed
    (`floor.ts:394`).
  - ⚠ The product will then have two ESCALATED shapes. Gate D's emits `AssuranceAssessmentEscalated` with a reason
    naming a target (`assurance.ts:2083-2089`); this one carries neither.
- **G5 — the app's answer to an escalation exists in part, and is wrong in part.**
  - **The PWA page.** A real escalation reaches it only as a staged candidate, because only a satisfied candidate is
    assured (`app/routes/pwa/[id]/agent/+server.ts:236-237`).
    - The resume banner then prints the classifier's guidance (`agent/+server.ts:249-253` → `+page.svelte:1068-1070`),
      and the guidance says to route the review to *"the governed human or alternate independent-review path"*
      (`app/lib/server/floor.ts:331`).
    - So the page does say "human". But it frames the escalation as *"The review did not produce a usable verdict"*
      and offers *"Refine it in the chat below"*, while the blocked hint gives the generic NOT_BY_REVISION sentence.
  - **The read-back** gives an ESCALATED review back as `UNASSESSED` (`floor.ts:751-755`, a hand-written ladder).
  - **The execution plane** never shows the guidance. The message prints the action name (`undertakings/[id]/+page.
    server.ts:1519`) and the observations, falling back to `${policyId}=${disposition}` (`:1647`;
    `execution.ts:1438`). The process-result arm prints observations only (`execution/evidence-join.ts:245-246`,
    `:264`).
- **G6 — the re-run.**
  - A chat turn on a BLOCKED_EXTERNAL candidate runs the same automated reviewer again: `authoring-turn.ts:416`
    `RETRY_ASSURANCE`, then `agent/+server.ts:373`, `:393`.
  - The latest assessment wins (`handlers/assessment-index.ts:12`; `REG-F-215`'s open arbitration). So one re-run can
    clear an escalation that was meant for a human.
  - A HUMAN evaluator cannot be recorded: no model id fails `DIFFERENT_MODEL` (`assurance-rules.ts:202-203`), against
    ASR-13's graduation to *"human or organizational independence"*.
  - The policy permits only `RETRY` as a control action (`floor-policies.ts:147`). This is `REG-F-474`.
- **G7 — the qualification record and the fingerprint.**
  - GLM recommended ESCALATED in three calls (`runs.ndjson:211`, `:214`, `:321`). Each is beside a NOT_MET criterion
    and scored REJECTED, and stays REJECTED under this design.
  - No call on the record recommends ESCALATED with nothing failed, so none of the 312 scored evaluations can change.
    This is derived, not yet driven: no recorded reply both recommends ESCALATED and computes SATISFIED. The build
    re-scores the whole record under the implemented rule to show it (D4).
  - The scoring corpus has no ESCALATED reply (`grep -c ESCALATED scripts/reviewer-qual/scoring-corpus.ts` = 0), so
    the fingerprint is blind to rule (a) until entries are added (D4).
- **G8 — a false register claim, to correct.**
  - `REG-F-473`'s added bullet, and the 2026-10-01 report, said a fix *"must correct the stand-in too"*. That is
    moot.
  - D2 records only ESCALATED, which neither the mock nor the declared stand-in ever returns.
  - The mock's SATISFIED (`REG-F-418`) never reaches the registry. The stand-in does copy the mock's unearned
    CONDITIONALLY_SATISFIED on a faulted arm (`standin-reasoning-review-validator.ts:76-77`;
    `mock-reasoning-review-validator.ts:82`), but nothing records that recommendation.

## 3. The design

- **D1 — Rule (a) in composition, as a second pass over the floor.**
  - **The rule.** In `pkg/rph-assurance/src/floor.ts`'s `composeAssuranceOutcome`, after every policy's disposition
    is computed and before the aggregate, the review becomes ESCALATED, in both the per-policy disposition and the
    aggregate's input, when all of these hold:
    - the result for `floor.reasoning-review` is in the VALID arm;
    - its `dispositionRecommendation` is the literal `ESCALATED`;
    - its computed disposition is SATISFIED: every mandatory criterion MET or NOT_APPLICABLE, no NOT_MET, no open
      failure observation;
    - every other policy in the plan is SATISFIED.
  - **In every other case nothing changes.** That includes the boundary arms and a failed validator, whose placeholder
    recommendation (`validators.ts:504`) is never read: ASR-11, *"Malformed or invalid validator output can never
    mutate authoritative state"*.
  - **Keyed on SATISFIED, not on "no criterion failed".** An undetermined criterion is an unanswered one, and ASR-2
    calls that *"invalid output"*.
    - Driven: a reply with no findings array, or a failed row under a corrupted id, is INCONCLUSIVE today. Under
      revision 1's INCONCLUSIVE arm it would have escalated, the latter erasing a real failure (`REG-F-428`).
    - So such a reply stays INCONCLUSIVE, with its recommendation recorded (D2).
  - **Why composition** (unchanged from revision 1). The app acts on the plan's verdict (`app/lib/server/floor.ts:683`,
    `floor-over-subject.ts:223`, `undertakings/[id]/+page.server.ts:1505`).
  - **Why no option flag.** The qualification runner composes with no options (`scripts/reviewer-qual/runner.ts:218`,
    `:249`).
    - Its plan holds the Reasoning Review alone, so "every other policy SATISFIED" holds there vacuously.
    - That is right: qualification asks what the reviewer's reply yields, not what a graph defect would.
  - ⚠ **Disclosed: the rule is coded, and that departs from ASR-1** (*"declarative data evaluated by the engine, never
    executable code"*). `REG-Q-057` and `assurance.ts:89-99` say a §10.3 override belongs in a ratified
    `EscalationRule.trigger`. The declarative route needs all four of these:
    - a contract change, because the trigger is untyped and evaluated by nothing (`REG-Q-057`);
    - a seed migration, because the floor policies are seeded once (`workbench.ts:197-200`);
    - an exception to the floor policies' edit lock (`assurance.ts:78-87`);
    - a store reader inside a package that is kept store-free (`validators.ts:93-94`).

    The coded rule implements a sponsor ruling scoped to one locked policy, and this design is its declaration. The
    departure is put to the sponsor (§6), with `REG-Q-057` engaged.
  - ⚠ **Disclosed: what policy version '1' yields changes, with no version change** (`validators.ts:375`). ASR-1 says
    *"Policy meaning is stable across validator replacement"*; the meaning moves here by ruling, not by a validator.
- **D2 — The recommendation is recorded as a RECOMMENDATION observation.**
  - **What is recorded.** For a VALID Reasoning Review result whose recommendation is the literal `ESCALATED`, whatever
    the outcome (ESCALATED, REJECTED, INCONCLUSIVE, or SATISFIED kept because another policy blocked),
    `assuranceRecordingPlan` (`recording.ts`) appends one observation:
    - code `REVIEWER_RECOMMENDED_ESCALATION`, exported as a constant from `rph-assurance`;
    - `observationType: 'RECOMMENDATION'`;
    - severity `INFORMATIONAL`, open;
    - the fixed statement: *"The reviewing model's recommendation was ESCALATED. The review prompt does not define
      ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated
      authority cannot resolve the issue within its authority or competence."*
  - **It is appended after composition**, as `INDEPENDENCE_VIOLATION` is (`recording.ts:116-124`). It is never placed
    in the ladder's input, and `composeAssuranceOutcome(...).observations` is pinned without it.
  - **Package types only, no contract change.**
    - `RecordableObservation` gains an optional `observationType`, a local union, since `recording.ts` imports no
      contracts.
    - `record-assurance.ts` honours it, defaulting to `observationTypeFor(a.policyId)` (`:89-91`).
    - `RECOMMENDATION` is a ratified `ObservationType` (`pkg/rph-contracts/src/enums.ts:577`; Contract Package §21
      `:1567`).
  - **Why this form.**
    - **Not `dispositionRecommendation`.** It is the handler's target state, and the Contract Package's change rules
      class a changed property meaning as Major (`docs/canon/_extracts/extract-doc007-b.md:54`, *"(Contract Package.md
      L1976-1986)"*).
    - **Not a control action.** An `ESCALATE` control action is refused: *"the validator recommended control
      action(s) [ESCALATE] that this policy does not permit (§11). Permitted: [RETRY]"* (driven).
    - **Not `residualUncertainty`** (the `declared-policy-signoff.ts:39-41` precedent). The event carries it, but the
      object's field is always `[]` (`assurance.ts:1437`), and a statement is a stronger record than a string in a
      list.
  - ⚠ **Disclosed:**
    - **A new use of a ratified value.** ASR-11 asks an observation to name a criterion and a deficiency, and this one
      names neither. `REG-Q-068` (open) says no ratified text partitions the seven types into signals and defects.
      This is the first production writer of RECOMMENDATION, and the corpus's one worked example recommends something
      about the subject.
    - **The type is lost on the event.** The event carries no type (`messages.ts:1079-1090`), so the code is the
      discriminator there.
- **D3 — The app answers an escalation honestly.**
  - **One exclusion from subject findings.** The classifier's subject-finding filter (`app/lib/server/floor.ts:335`)
    excludes the imported code. That one filter feeds `refineDirective`, `priorGaps`, `openPerTry`, `priorFindings` and
    the status line. The RS-2 import guard is extended to the constant.
  - **Direct readers, each decided:**
    - **The waiver target** (`pwa/[id]/+page.server.ts:737`, `blocking.observations[0]`) skips the recommendation, so
      a waiver never names `REVIEWER_RECOMMENDED_ESCALATION` as its criterion.
    - **`reasoningGaps`** (`floor.ts:696`, `:817`), listed under "Reasoning-review findings", excludes it. The hint and
      the banner carry the escalation.
    - **The undertakings observation list and the §38 view** show it, as the informational record it is.
  - **The read-back aggregate** reuses `aggregateDisposition` (`assurance-rules.ts:80-93`) instead of the hand-written
    ladder.
    - An ESCALATED or INCONCLUSIVE review then reads back INCONCLUSIVE, not UNASSESSED.
    - This changes the display of every INCONCLUSIVE review on the page, which is a correction.
    - An in-progress review keeps its current reading; a control pins it.
  - **The PWA page's blocked hint gains a fourth answer, `ROUTE_TO_HUMAN`**, for when the classifier answers
    `ESCALATE_REVIEW` and no other floor policy is REJECTED. The sentence:

    *"Publishing is blocked until the floor is SATISFIED — the Reasoning Review recommended escalation to a human
    reviewer, and this workbench cannot record a human's review yet (REG-F-474). Revising the graph does not address
    this."*

    The insertion shape keeps RS-3's anchors:
    - **In `floorBlockedHint`,** one new line after the `return 'REVISE'` line. It does not reuse the RS3-M29..31
      predicate text, does not cache the classifier call, and leaves the final return untouched.
    - **In the template,** the new branch goes after the REVISE_AND_REVIEW `<p>` and before `{:else}`.
    - **The page-server line** stays byte-identical.
    - `MU-F202`'s anchors are unaffected.
  - **The resume banner names an escalation.** For an `ESCALATE_REVIEW` block the banner frame reads *"The reviewer
    recommended escalation to a human reviewer —"* in place of *"The review did not produce a usable verdict —"*. Its
    *"Refine it in the chat below"* gains the fact: *"refining re-runs the same automated reviewer"*. That fact is
    true, and it is `REG-F-474`'s.
  - **The execution plane says it.** On both arms (the model step's message and the process-result refusal), an
    escalated review prints a fixed sentence beside the observations: *"The reviewer recommended escalation to a human
    reviewer; this workbench cannot record a human's review yet (REG-F-474)."*
  - **The guidance is unchanged** (`floor.ts:331`). Its *"then rerun assurance"* is `REG-F-474`'s, and the sponsor
    question in §6 is about it.
- **D4 — Qualification and the fingerprint carry the rule.**
  - **Four scoring-corpus entries, each pinned by id** (a set pin cannot kill a mutant of one entry):
    - `escalated-clean` → ESCALATED;
    - `escalated-beside-a-fault` → REJECTED;
    - `escalated-skipped-row` → INCONCLUSIVE, which pins revision 2's narrowing;
    - `escalated-reported-as-producer` → BOUNDARY_REJECTED, which pins the VALID-only scope.

    The set pin at `verif/reviewer-qualification-fingerprint.test.ts:550-552` gains ESCALATED. The corpus header's
    claim (`scoring-corpus.ts:5`) then holds for rule (a).
  - **The scoring-only move, discharged.** RESCORED lines are written for the SELECTED candidate's run only,
    `qr-2026-09-25-devin-glm-5-3-flash-max-v3`: 52 lines, the only run that must be re-scored. It clears both
    COVERAGE limbs (`REG-D-086`), and re-scoring other runs would owe further ESCALATION lines. With them goes one
    ESCALATION line: `{runId: <rescoreId>, caseIds: ["G3-CLEAN-R3"], finding: "REG-F-456"}`. That is the RESCORED
    record's one material failure, *"CLEAN_NOT_SATISFIED, VERDICT_CHANGES_WITH_NAME"* (driven), and `REG-F-456`'s
    heading is live. How it is produced:
    - by a one-off script outside the repository, run from the repo root with `bun --conditions=source`;
    - through `committedCaseSet`, `reviewerFingerprint` and `rescoredLines`, with `commit` = `git rev-parse HEAD`;
    - asserting exactly 52 lines (`rescoredLines` skips silently) and `lineProblems` empty for each;
    - appended with `serializeLine` and staged.
  - **Proof the lines are right:**
    - REPRODUCTION re-scores them (`check-core.ts:774-782`);
    - an in-memory control over a copy with one disposition flipped must report REPRODUCTION;
    - every rescored outcome equals its source CALL's;
    - a whole-record re-score shows 0 of 312 verdicts change.
  - **Also edited:** `verif/reviewer-qualification-check.test.ts:867-872`. Its hand-written `driven` set gains
    ESCALATED, and an `arms` row is driven by a real ESCALATED reply, so limb 3 keeps covering it. This is a manual
    edit, not a pin that moves.
  - **The reviewer prompt is unchanged.** Changing it moves the probes component and owes a paid run
    (`check-core.ts:780`).
- **D5 — Register text, recorded by this design:**
  - **In force from `JAN-ESCREC`, pending confirmation (§6):**
    - `REG-D-074`'s *"never by the reply's own recommendation"*, which now has rule (a) as its exception;
    - `REG-D-082`'s list of non-REJECTED verdicts, which gains ESCALATED;
    - `REG-D-075`'s *"18-entry raw-reply corpus"*, which becomes 22 entries.
  - **Struck and restated:** `REG-F-473`'s status and `REG-F-418` bullet (G8), and `REG-D-088`'s *"(2)'s outcome rule
    awaits the sponsor"*.
  - `REG-F-473` closes for ESCALATED only.

## 4. What must hold

1. **No verdict on the record changes.**
   - The fingerprint moves only by D4's corpus entries, in one commit.
   - `reviewer:qual:check` is GREEN with the 52 RESCORED lines and the one ESCALATION line staged.
   - The SELECTION stays covered.
2. **The deterministic policies never escalate.** A control drives a hand-built schema-invariant result recommending
   ESCALATED, which stays SATISFIED.
3. **Red first, with a path:**
   - **D1, red:**
     - ESCALATED with every criterion MET → per-policy ESCALATED, aggregate INCONCLUSIVE, `gatePermitsTransition`
       false;
     - ~~the same beside a REJECTED schema policy → the review stays SATISFIED.~~ A control, not a red: the code before `ER-1` already passes it (§8).
   - **D1, controls:**
     - NOT_MET → REJECTED;
     - an undetermined criterion → INCONCLUSIVE;
     - a SATISFIED recommendation → SATISFIED;
     - CONDITIONALLY_SATISFIED recommended with every criterion MET → SATISFIED;
     - the same-model evaluator → BOUNDARY_REJECTED;
     - `executionFailed` → VALIDATOR_FAILED.
   - **D2:**
     - the plan holds the observation in every VALID ESCALATED arm and in no other;
     - the recorder records `observationType: 'RECOMMENDATION'` at INFORMATIONAL, read from the object, with the
       ESCALATED and the REJECTED completions both driven through an engine, under node and `test:src`;
     - a REJECTED review's finding stays FINDING.
   - **D3:**
     - **App `floor.test.ts`.** The rows at `:474-476` and `:714-722` change to `ROUTE_TO_HUMAN`; these are named
       predicted reds. A REJECTED plus ESCALATED review gives REFINE_SUBJECT, and its findings exclude the code. The
       read-back gives INCONCLUSIVE, with its control.
     - **A route test** (devin's seam, `ROOT_ONLY_PLAN`, a local all-clean ESCALATED reply) gives:
       - BLOCKED_EXTERNAL, with `turn.detail` the ESCALATE_REVIEW guidance;
       - `floorBlockedHint === 'ROUTE_TO_HUMAN'` on the fork;
       - the observation recorded.

       A `TWO_ROOTS_PLAN` case keeps the review SATISFIED and records the observation.
     - **A begin-execute test** (devin's seam) shows the human sentence and the observation, and so does the
       process-result refusal.
     - **An e2e** stages a canonical escalated review. It asserts the hint whole, with no `/waiv/i`, no "revise the
       graph and re-run", no "run assurance again", and the disposition chip `INCONCLUSIVE`. No browser test renders a
       staged escalated candidate's banner; disclosed.
4. **Hermetic, as before.** Ledger anchors stay unique. Use `C:/Users/mchen/.claude/projects/e--Projects-hestami-ai/
   jan-critread-resume/tools/ledger_ids.py`, which reads both quote styles and sits outside the repository. The known
   anchors at risk:
   - RS3-M15..18, M24, M28..32, M35 and M36 (`floorBlockedHint` and the template);
   - MU-PFA-AF3 and MU-PFA-BD2-10 in `recording.ts`;
   - J1C-M4 and J1C-M5 (`countedCriteria`) in `floor.ts`;
   - J23-M27 and J23-M28 in `scoring-corpus.ts`;
   - `recording.ts`'s `return 'INCONCLUSIVE';`;
   - the gate line.
5. **The ratchets.** The export census is regenerated in the same commit (the new rph-assurance export). The coverage
   floor allows 0 uncovered statements or branches in `floor.ts`, and 0 uncovered statements in `recording.ts` and
   `record-assurance.ts`. The register ids are in the register before anything cites them.

## 5. Filed with `REG-D-090`, not fixed here

- **`REG-F-474` — an escalated Reasoning Review has no human path, and an automated re-run clears it.**
  - G6: the re-run on both planes, latest-wins (`REG-F-215`), no recordable HUMAN evaluator against ASR-13's
    graduation, a RETRY-only policy, and no escalation package (Catalog `:716`).
  - The *"recorded review"* the page names is unjoined to its assessment, and its reader picks the older run
    (`REG-F-433`).
  - The human path is the sponsor's recorded intent: escalation to *"the relevant human(s)"* as the terminal arm of a
    bounded review loop, which the sponsor called *"possibly getting a bit far afield of where we are today"*
    (`REG-D-059`).
- **`REG-F-475` — §38's "both recorded, for every validator call" holds for ESCALATED only.** Every other
  recommendation is still in no assessment record, and the field that carries the outcome is still called the
  recommendation (G2).

## 6. For sponsor confirmation (`REG-D-090`)

1. **Two departures from the 2026-10-01 messages:**
   - **(i) The INCONCLUSIVE reading is withdrawn.** Only a fully answered, clean review escalates (D1); an unanswered
     criterion is invalid output under ASR-2.
   - **(ii) "Nothing else already blocks" is read across the floor.** A graph defect is revised first, with the
     escalation recorded.
2. **The record:**
   - a RECOMMENDATION observation, for VALID results only (ASR-11), with the type lost on the event;
   - on the authoring plane, in the candidate's fork only. An escalated candidate never commits, and the exchange's
     raw answer survives a restart only with a content database configured.
3. **The coded rule.** It departs from ASR-1's declarative rule, with `REG-Q-057` engaged and policy version '1'
   unchanged.
4. **Superseded in part:**
   - `REG-D-074` and `REG-D-082`;
   - a clean case a reviewer escalates becomes a material qualification failure (`CLEAN_NOT_SATISFIED`).
5. **The sponsor's question:** should an escalation be a HARD STOP until a human path exists? That means an
   `ESCALATE_REVIEW` block cannot resume into an automated re-review: discard only on the authoring plane, and no
   re-execute on the execution plane. This design builds the honest version instead: the page says a re-run re-runs
   the same automated reviewer. `REG-D-059` records the human path as the sponsor's intent, not yet an obligation.

## 7. Changes from revision 1

The critics returned 4 BLOCKER findings, 31 MAJOR and many MINOR between them, with overlaps. All are addressed.
- **BLOCKER, rule (a)'s reach:** it escalates a clean, fully answered review only, and only when nothing else in the
  floor blocks (D1).
- **BLOCKER, the gate:** RESCORED for the selected run only, plus the one ESCALATION line (D4).
- **BLOCKER, the composite:** a graph defect is no longer escalated past (D1).
- **BLOCKER, the re-run:** put to the sponsor (§6.5), with the banner and the execution plane made truthful (D3).
- **MAJOR fixes:**
  - the statement states only the fact;
  - the readers are enumerated, including the waiver target and `reasoningGaps`;
  - the hint's insertion shape is fixed;
  - the corpus pins every arm;
  - the supersessions and narrowings are in §6;
  - `REG-Q-057`, `REG-Q-068`, `REG-F-472` and ASR-10 are engaged;
  - G5 and G8 are corrected.

## 8. As built (`ER-1`, 2026-10-02)

`ER-1` was built in two halves, the package and engine, then the app. Each half was attacked by an adversarial verifier, then by four fix rounds, each re-verified. The MAJOR findings per round were 2, then 1, 0, 2 and 0; every one was fixed. 144 mutants landed in the ledger. The line citations in §1 to §7 are at `ed7bd0ff` and `6a5cd1fc`; several have moved. What goes beyond `REG-D-090` is recorded as `REG-D-092`, flagged for sponsor confirmation.

- **D1 — the readings, pinned.**
  - Condition (iii) is the ladder's computed SATISFIED. A non-mandatory criterion NOT_MET, its ADVISORY finding open, beside every mandatory criterion MET, still escalates; so does a mandatory NOT_APPLICABLE.
  - Condition (iv) reads "already blocks" as the engine's floor gate does: all three floor policies, whatever the plan marks. A non-required other policy that is not SATISFIED stops the escalation. When a plan marks the review itself non-required, the row is ESCALATED and the plan's own gate opens, while the engine's `floorGateBlock` still refuses. No product plan marks a floor policy non-required.
  - Condition (i) is kept although (iii) implies it in composition; dropping it alone is an equivalent mutant.
  - A partial reply is classed VALID and composes INCONCLUSIVE; only an empty criteria list is boundary-rejected. So D2 records its recommendation.
  - The engine's own floor gate refuses an ESCALATED review (`packages/rph-engine/src/floor-gate.test.ts`).
- **D2.**
  - `REVIEWER_RECOMMENDED_ESCALATION` is exported from `recording.ts`; the statement is not. The observation is appended last.
  - The statement's claim about the review prompt is pinned in the app: the recommendation sentence whole in each framing, and the value named once.
  - A validator could itself propose an observation under the code: `REG-F-478`.
  - A criterion listed twice, faulted then clean, is recorded MET beside an open BLOCKING observation. That predates `ER-1`: `REG-F-479`.
- **D3 — what the operator is told, as built.**
  - **The floor panel shows the blocked hint FIRST**, before the policy list, the findings and the reviewer's answer. At 1280x720 it was measured cut off on ordinary paths whenever anything preceded it.
  - **The escalation line comes directly after the hint**, when the latest review carries the recommendation and the hint is not `ROUTE_TO_HUMAN`. It reads one of two sentences:
    - beside findings (hint REVISE or REVISE_AND_REVIEW): *"The reviewer also recommended escalation to a human reviewer. The recommendation is recorded beside the findings, which are addressed first (REG-D-089)."*
    - beside an incomplete review (NOT_BY_REVISION): *"The reviewer also recommended escalation to a human reviewer. The review reached no usable verdict; the recommendation is recorded with it (REG-D-089)."*
    - ⚠ At 1280x720 the line may need a scroll in the panel; the hint stays on screen.
  - **The resume banner** is composed by `resumeHintText` (`apps/rph-demo/src/lib/server/authoring-turn.ts`) from the classifier's action carried on the turn, and wraps on a row of its own. It had been one ellipsised line that hid the guidance of every blocked candidate.
  - **The composition advisory, while a candidate is staged,** hangs below the banner, no wider than unstaged, right-aligned with the lifecycle row, with opaque chips at 4.5:1 or better. ⚠ While staged, it covers the inspector panel's header.
  - **The read-back** through `aggregateDisposition` also reads a CONDITIONALLY_SATISFIED review back as CONDITIONALLY_SATISFIED (it read UNASSESSED). The header chip prints the aggregate with spaces.
  - **The waiver form** is offered only where the recorded floor has a waiver target, chosen by one function shared with the action. A REJECTED or CONDITIONALLY_SATISFIED review whose only observation is the recommendation is answered `RETRY_OR_CONFIGURE_REVIEWER`.
  - **The execution plane.**
    - A REJECTED review its reviewer also escalated prints no human sentence: its outcome is REJECTED, and its finding goes back to the producer.
    - The step's message beside a SATISFIED work product now prints refused command evidence, which it omitted.
    - A refused result with no observation says *"no observation recorded (<policy>=<disposition>)."* A non-escalated one whose only observation is the recommendation adds *"— no finding recorded (<policy>=<disposition>)."*
- **Unpinned, disclosed:**
  - the escalation line beside a STAGED candidate, because no test-mode reviewer recommends ESCALATED (ER1-V152);
  - a CSS mutant that changes no banner the lane can stage (ER1-V157);
  - the hint above the reviewer's answer on the lane, which records no model exchange (ER1-V405).

  Pins for ER1-V400, V401, V403 and V404 are owed in `ER-2`.
