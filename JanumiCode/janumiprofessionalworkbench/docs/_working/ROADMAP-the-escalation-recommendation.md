# ROADMAP — `JAN-ESCREC`: a reviewer's ESCALATED recommendation is recorded, and escalates a review when nothing else blocks

**Design:** `DESIGN-the-escalation-recommendation.md` (revision 2). · **Authority:** `REG-D-089` (sponsor ruling, option
(a)); the design's delegated calls are recorded as `REG-D-090`, flagged for sponsor confirmation. · **Date:**
2026-10-01. · **Status:** IN PROGRESS.

⭑ **Exit.**
- **The recommendation is recorded.** A VALID Reasoning Review whose recommendation is the literal `ESCALATED` carries
  a `RECOMMENDATION` observation, whatever its outcome.
- **The review escalates when nothing else blocks.** A fully answered, clean review that recommends ESCALATED, with
  every other floor policy SATISFIED, is recorded ESCALATED, and publication stays blocked.
- **The operator is told.** The PWA page's hint, the resume banner and the execution plane each say the reviewer
  recommended escalation to a human reviewer, and that a human's review cannot be recorded yet.
- **Qualification carries the rule.**
  - The reviewer fingerprint carries rule (a).
  - `reviewer:qual:check` is GREEN with the selected run re-scored.
  - No recorded verdict changes.
- **The register is updated.** `REG-F-473` is closed for ESCALATED; `REG-F-474` and `REG-F-475` are filed.
- **The gate.** `gate:fast` is green. Nothing is pushed.

**Before `ER-1`.** The register filings go in with the design and this roadmap, edited by Codex and audited by git:
- `REG-D-089` (the ruling, with option (a)'s text verbatim);
- `REG-D-090`;
- `REG-F-474` and `REG-F-475`;
- `REG-F-473` and `REG-D-088`, struck and restated;
- `REG-F-473`'s `REG-F-418` bullet, corrected;
- notes, pending confirmation, on `REG-D-074`, `REG-D-075` and `REG-D-082`.

The landing pattern is `JAN-SELRES`'s:
1. implement;
2. adversarial verification, whose own mutants find the gaps;
3. a fix round, in which survivors become ledger mutants;
4. landing.

At landing the documents are edited by Codex and audited by an independent rebuild. The prior ledger entries are
picked with `jan-critread-resume/tools/ledger_ids.py`, which reads both quote styles. The steps that follow are the
ledger, `bun run mutants`, observe, `gate:fast` and `commit -F`.

## `ER-1` — the product: rule (a), the record, and what the operator is told (D1, D2, D3)

**Order, red first:**
1. **`packages/rph-assurance/src/floor.test.ts`, the D1 limbs.**
   - **Red:** a clean, fully answered review recommending ESCALATED is ESCALATED per policy, the aggregate is
     INCONCLUSIVE, and `gatePermitsTransition` is false.
   - **Red:** the same review beside a REJECTED schema-invariant result stays SATISFIED.
   - **Controls:**
     - NOT_MET → REJECTED;
     - an undetermined criterion → INCONCLUSIVE;
     - a SATISFIED recommendation → SATISFIED;
     - CONDITIONALLY_SATISFIED recommended with every criterion MET → SATISFIED;
     - the same-model evaluator → BOUNDARY_REJECTED;
     - `executionFailed` → VALIDATOR_FAILED;
     - a hand-built schema-invariant result recommending ESCALATED → SATISFIED.
2. **`recording.test.ts`.** The RECOMMENDATION observation appears in every VALID ESCALATED arm (ESCALATED, REJECTED,
   INCONCLUSIVE, SATISFIED-beside-a-block) and in no other. `composeAssuranceOutcome(...).observations` is pinned
   without it.
3. **`packages/rph-engine/src/record-assurance.test.ts`, under node and `test:src`.**
   - The ESCALATED and REJECTED completions are each driven through an engine.
   - Each records the observation, read from the object, with `observationType: 'RECOMMENDATION'` at INFORMATIONAL.
   - The REJECTED review's finding stays FINDING.
4. **Implement D1 and D2.** Export `REVIEWER_RECOMMENDED_ESCALATION` from `rph-assurance`, and regenerate the export
   census in the same commit.
5. **App `apps/rph-demo/src/lib/server/floor.test.ts`.**
   - The rows at `:474-476` and `:714-722` become `ROUTE_TO_HUMAN`; these are named predicted reds.
   - A REJECTED plus ESCALATED review → REFINE_SUBJECT, with the code excluded from its findings.
   - The read-back gives INCONCLUSIVE, with an in-progress control.
6. **The route test.** Use devin's exec seam (`authoring-route-substituted-reviewer.test.ts` patterns) and a local
   all-clean ESCALATED reply.
   - `ROOT_ONLY_PLAN`:
     - BLOCKED_EXTERNAL, with `turn.detail` the ESCALATE_REVIEW guidance;
     - the banner frame names the escalation;
     - `floorBlockedHint === 'ROUTE_TO_HUMAN'` on the fork;
     - the observation is recorded.
   - `TWO_ROOTS_PLAN`: the review stays SATISFIED, and the observation is recorded.
7. **The execution plane.** A begin-execute test (devin's seam) shows the human sentence and the observation, and so
   does the process-result refusal.
8. **An e2e** that stages a canonical escalated review asserts:
   - the hint sentence, whole;
   - no `/waiv/i`, no "revise the graph and re-run", no "run assurance again";
   - the disposition chip reads INCONCLUSIVE.
9. **Implement D3:**
   - the classifier's one exclusion, with the import guard extended;
   - the waiver target and `reasoningGaps`;
   - the read-back through `aggregateDisposition`;
   - the hint's fourth answer, in the prescribed insertion shape;
   - the banner frame;
   - the execution plane's sentence on both arms.

**Mutants, at least these:**
- **D1:**
  - the rule removed;
  - a failed criterion escalates;
  - an undetermined criterion escalates;
  - another policy's block is ignored;
  - every policy escalates;
  - the aggregate is not told;
  - a boundary-rejected result escalates.
- **D2:**
  - the REJECTED arm records nothing;
  - every recommendation is recorded;
  - a boundary or failed result is recorded;
  - a non-review policy is recorded;
  - the severity is raised;
  - the recorder drops the type;
  - every observation of the review is typed RECOMMENDATION.
- **D3:**
  - the code is treated as a subject finding;
  - `ROUTE_TO_HUMAN` collapses to NOT_BY_REVISION;
  - every operational action routes to a human;
  - the template branch is dropped;
  - the sentence names a waiver or a re-run;
  - the read-back goes back to UNASSESSED;
  - the waiver target names the recommendation;
  - the execution plane drops the sentence.

**Anchors at risk, which must each still occur exactly once:**
- RS3-M15..18, M24, M28..32, M35 and M36;
- MU-PFA-AF3 and MU-PFA-BD2-10;
- J1C-M4 and J1C-M5;
- `recording.ts`'s `return 'INCONCLUSIVE';`;
- the gate line.

**The fingerprint does not move in `ER-1`.** No corpus entry exercises the rule yet.

## `ER-2` — qualification carries the rule (D4)

1. **The pins.** Add per-entry pins for the four corpus entries, and ESCALATED in the corpus's disposition set. They
   are red: the entries do not exist yet.
2. **The entries.** Add them. `reviewer:qual:check` is then red with exactly two COVERAGE problems, as predicted.
3. **The record.**
   - Write the 52 RESCORED lines for `qr-2026-09-25-devin-glm-5-3-flash-max-v3`, and the one ESCALATION line citing
     `REG-F-456` for `G3-CLEAN-R3`.
   - Use the one-off script, which asserts 52 lines and that `lineProblems` is empty for each.
   - Stage them. The check goes GREEN.
4. **The proofs:**
   - the in-memory REPRODUCTION control;
   - every rescored outcome equals its source CALL's;
   - a whole-record re-score under the implemented rule shows 0 of 312 change.
5. **Edits.** Make the manual edit to `verif/reviewer-qualification-check.test.ts:867-872`, with its `arms` row driven
   by a real ESCALATED reply.
6. **Mutants.** Write one per corpus entry. Keep J23-M27 and J23-M28's anchors unique.

**The window between `ER-1` and `ER-2`.** The fingerprint stays blind to rule (a), as it is today. No paid
qualification run may be made in that window.
