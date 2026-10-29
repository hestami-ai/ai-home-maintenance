# DESIGN — Data-flow order enforced by the workbench, and review of finished work beside each command's review

**Programme:** `JAN-EXEC` Phase 7, before P6 again; `REG-D-134`, `REG-D-135`, `REG-F-578`, `REG-F-579`, `REG-F-566`.
**Status:** ~~DESIGN, revision 1, 2026-10-25. D1–D19 are DECIDED under the sponsor's `REG-D-135` and the lead's decisions identified below. Their build is OWED. No fix described here is built or measured. Case set v12's new cases and oracles await the sponsor's confirmation before any paid measurement.~~ ~~DESIGN, revision 2, 2026-10-25 (`REG-F-580`). Package L is built and merged (`2c46dfa6`). D20 is added, the lead's decision, flagged for the sponsor. Packages M and N are being built. Case set v12's new cases and oracles await the sponsor's confirmation before any paid measurement.~~ ~~DESIGN, revision 3, 2026-10-26 (`REG-F-581`, `REG-F-582`). Packages L, L2, M and N are built and checked; L is merged (`2c46dfa6`); L2, M and N are being integrated. D21-D27 are added, the lead's decisions, flagged for the sponsor. Case set v12's new cases and oracles await the sponsor's confirmation before any paid measurement.~~ ~~DESIGN, revision 3, 2026-10-26 (`REG-F-581`, `REG-F-582`; `REG-D-136`). Packages L, L2, M and N are built, checked and integrated (`1a2270f6`); O is being built. D21-D27 are the lead's decisions, flagged for the sponsor. Case set v12's content and oracles are confirmed (`REG-D-136`); its build and paid measurement are owed.~~ ~~DESIGN, revision 4, 2026-10-26 (`REG-F-583`; `REG-D-137`). L, L2, M and N are integrated (`1a2270f6`); O is built and checked; case set v12 is confirmed and being built. D28 and D29 are decided under `REG-D-137`; their build and the measurement are owed.~~ DESIGN, revision 4, 2026-10-29 (`REG-F-584`, `REG-D-138`). O, O-2, V and V-2 are built and checked; they are integrated (`c603fb69`) and the final tree's measurement is running; the paid measurement of case set v12 (94 cases) and P6 again are owed.
**Sources:**

- `sponsor-words-2026-10-18.md`, Q40a–Q44, Q41b and Q42b.
- `fixes-facts.md`, sections 2–6; `p6-run12-facts.md`; `run12-costs.md`. These are the lead's checked facts and cost model.
- `research-0.json`, `research-1.json`, `research-2.json` and `research-3.json`: research leads, checked against the repository at the lines cited below, at `11514fc6`. The sponsor's later choices and `fixes-facts.md` govern where they change a research recommendation or correct its account.
- `docs/canon/JPWB-DOC-002 Canonical Vocabulary.md`; `docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md`; `docs/canon/JPWB-DOC-001 Doctrine and Concept of Operations.md`; `docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md`.
- `docs/_working/DESIGN-undertaking-execution-sandbox.md`, R8, R11 and R14–R18; `docs/_working/DESIGN-process-result-qualification.md:93`; `docs/_working/DESIGN-authoring-review-in-parts.md`, including its account-scoping precedent; `docs/_working/DESIGN-phase-7-completion.md`, sections 5–6.
- `docs/canon/JPWB-REG-005 Decision and Divergence Register.md`: `REG-D-013`, `REG-D-059`, `REG-D-075`, `REG-D-086`, `REG-D-095`, `REG-D-105`, `REG-D-110`, `REG-D-114` (14) and its amendment, `REG-D-121` Q20, `REG-D-131`, `REG-D-132`, `REG-D-133`; `REG-F-428`, `REG-F-480`, `REG-F-483`, `REG-F-485`, `REG-F-486`, `REG-F-489`, `REG-F-510`, `REG-F-516`, `REG-F-518`, `REG-F-520`, `REG-F-522`, `REG-F-535`, `REG-F-551`, `REG-F-564`, `REG-F-566`, `REG-F-574`, `REG-F-577`, `REG-F-578` and `REG-F-579`.
- Companion rulings: `REG-D-134` records fix first, then P6 again, then P7 from that run. `REG-D-135` records the review arrangement, accepted producers before a consumer starts, criterion repair after any parsed reply, and the limit of about 2,400 with each press's whole worst case counted before it.

## 1. Why, and where it ends

- **Run-12.** At `2437553f`, half B answered authoring YES for the first time and execution NO. The agent authored, published and instantiated a PWA with 12 types. Its review in parts passed 12 of 12 parts. Of 12 units, 6 were ABANDONED after their one work re-run was refused again; 3 were EXECUTED with their step SUCCEEDED after a review re-run, without sign-off; the root was EXECUTED with its step SUCCEEDED, without sign-off; the e2e test-suite unit stopped at the limit before its re-run; e2e test execution was not reached. The run spent 262 reviewer calls, taking programme spend from 739 to 1,001 of about 1,000 (`p6-run12-facts.md`; `REG-D-133`).
- **F1, order.** The lane pressed the root and the other composites before the children whose outputs they required, and the root built a product into the shared workspace before the work it was to reconcile (`REG-F-578`).
- **F2, review.** Each command's review judged one command result against the unit's obligation and account, without the finished deliverable or the command's place among its writes (`REG-F-579`).
- **F3, criterion repair.** A parsed reply could leave a declared criterion without a row and receive no repair, so clean rows filed under an undeclared id left the review INCONCLUSIVE (`REG-F-566`).
- **The sponsor's ruling.** Q40b's chosen option read *"Design and build the three fixes, then P6 again, then P7 from that run. The new limit comes with the design, sized from run-12's costs."* (`sponsor-words-2026-10-18.md`; `REG-D-134`).
- **The goal.** After the build and qualification, P6 again runs half B, paid, to answer whether an authored, published PWA's Undertaking executes as intended. P7 then records that run. Section 6 of `DESIGN-phase-7-completion.md` places the paid measurements before the recording; `REG-D-134` selects P6 again as the recording's source.
- **The boundary.** These are decided remedies. Their effect on execution is untested. This design supplies no execution YES.

## 2. What the corpus requires

- **PWA and sequence.** *"A PWA is not primarily a temporal sequence"*; *"semantic progression ≠ temporal execution sequence"* (`docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:72-73`).
- **Execution Plan and Workflow.** The plan is *"the governed, versioned strategy for performing selected PWUs"*; the workflow is *"the temporal machinery through which a plan is carried out"* (`docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:94-96`). *"A PWU does not encode its runtime sequence"* (`docs/canon/JPWB-DOC-001 Doctrine and Concept of Operations.md:133`). The architecture view shows *"never concrete state and never temporal execution order"* (`docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:105`).
- **Composition.** *"Composition is not timing: prerequisites, dependencies, semantic progression, produced-input relations, and temporal execution steps are modeled as those relations — never mislabeled as parent/child decomposition."* (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:209`).
- **DEC-2.** A decomposition records *"sibling identities, dependencies, and coordination rules"* (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:215`).
- **DEC-6.** *"a recomposed result requires an explicit assessment."* Assured child results permit a judgement; their completion alone cannot satisfy the parent (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:231`).
- **STA-5.** *"A PWU enters readiness only when its shape readiness profile is satisfied:"*; that profile includes *"dependencies"* and *"required inputs, expected outputs"* (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:191`).
- **Affordance parity.** The offered set must *"equal the set the engine would admit."* The same statement requires conformance in both directions and a recorded declaration where unavailable authority requires a fail-open offer (`docs/canon/JPWB-SPEC-001 Professional Projection and Workbench Surface.md:3244`).
- **ASR-3.** *"it never makes the floor optional."* Its per-output rule says *"one PWU-level review never substitutes for exact per-output assessment."* Grouping requires *"a grouped Assessment answers each mandatory criterion for each covered subject and version"* (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:249-251`).
- **ASR-4.** *"It reviews professional rationale summaries, outputs, and authorized tool-call records."* The review remains a versioned Assurance Policy implemented by a replaceable Validator (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:253`).
- **ASR-7.** *"An execution trace proves execution occurred, not that the outcome satisfies intent."* (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:267`).
- **The review's object.** A conforming Validator evaluates *"the exact output and its observable derivation, provenance, assumptions, constraints, evidence use, uncertainty, and completion claim."* (`docs/canon/JPWB-DOC-002 Canonical Vocabulary.md:175`).
- **Durable findings.** *"Findings are durable obligations: regeneration, repair, or later success never erases what was observed about an exact version."* (`docs/canon/JPWB-DOC-001 Doctrine and Concept of Operations.md:226`).
- **R8.** *"The workspace is the DELIVERABLE and must persist"* (`docs/_working/DESIGN-undertaking-execution-sandbox.md:86`).
- **R14.** *"A THIRD FRAMING, ONE RUBRIC."* The process-result framing keeps the criteria of `floor.reasoning-review` (`docs/_working/DESIGN-undertaking-execution-sandbox.md:92`, `:757-768`).
- **R15.** The reviewer is *"asked whether the account squares with what was OBSERVED."* Its subject is the existing contracted rationale, read against the adapter's observations (`docs/_working/DESIGN-undertaking-execution-sandbox.md:770-777`).
- **R18.** *"EVERY COMPLETED RUN BECOMES ONE `EVIDENCE` OBJECT, TYPED `OBSERVATION`."* The stated cost is *"N COMMANDS MEANS N FLOOR RUNS AND N REVIEWER CALLS."* (`docs/_working/DESIGN-undertaking-execution-sandbox.md:814`, `:835-837`).
- **Strength before cost.** *"Cost optimization — tokens, time, agent effort, and sponsor attention alike — is premature until the guarantees are established"* (`REG-D-013`). Calls saved cannot rank these remedies.
- **PRQUAL's question.** *"the obligation question stays"* (`docs/_working/DESIGN-process-result-qualification.md:93`; `REG-D-095`). D12 supersedes this command framing under Q41b.
- **REG-D-105 (2) and (3).** The prompt *"never asks the reviewer to find a failure."* *"Re-running the review stays for a review that did not conclude."* A repair must preserve both conditions.
- **REG-F-428.** *"model id drift is fixed UPSTREAM, never by a fuzzy id matcher downstream."*
- **REG-D-114 (14), as amended.** *"Reaching the limit is allowed."* Its instruction to *"count ONE TRY's reserve"* is the part D16 replaces with the press's whole worst case.

## 3. F1 — the order (`REG-F-578`; `REG-D-135` (2))

**The evidence.** `fixes-facts.md` section 3 checked run-12's stored types. Its 4 composites required outputs their children produced. The root required verification evidence; technical design required its two design contributions; implementation required its three children's outputs and technical design's architecture baseline; end-to-end verification required its two children's outputs and implementation's candidate. The data flow had no loop.

The lane used a pre-order walk: it pushed a unit before visiting its children (`scripts/phase7/half-b.ts:116-162`). It therefore pressed 4 of 4 composites before children whose outputs they required. Run-12's data-flow order would have been: requirements; CLI contract and word processing; technical design; CLI entry and core; unit tests; implementation; e2e suite; e2e execution; end-to-end verification; root. This establishes the order defect, without attributing the two deterministic schema failures to it.

1. **D1, DECIDED — record dependencies at instantiation.** For each required input of a unit's type, record all instantiated units whose types list that name as a required output. A parent also depends on each of its children. Store the unit dependencies in `dependencyIds`, and sibling dependencies on the decomposition contract in `siblingDependencyIds`, as DEC-2 requires. The unit and contract schemas already carry these fields (`packages/rph-contracts/src/objects.ts:554-555`, `:758`), but the PWU handler forces `dependencyIds` and `inputRequirements` to empty lists (`packages/rph-application/src/handlers/pwu.ts:335-336`). Treat `originating-intent` as supplied by the Undertaking's Intent. Record any other input with no instantiated producer in the unit's `inputRequirements`, identified as unproduced.

⭑ **Corrected (revision 3), 2026-10-26** (`REG-F-582`). D21 supersedes the input treatment in D1's last two sentences and the blocking consequence in §8's Input spelling bullet. `originating-intent` stays supplied by the Intent. Another input without an instantiated producer is recorded and shown as expected from outside the Undertaking; it does not block the unit.

2. **D2, DECIDED — the engine enforces acceptance before start.** A unit can start only when each dependency is ACCEPTED: its unit state is SATISFIED, RECOMPOSED or BASELINED. CONDITIONALLY_SATISFIED leaves conditions open and cannot count. These lifecycle members are present in `packages/rph-contracts/src/enums.ts:845-866`. Refuse before any model or reviewer call, stating which units the consumer waits for. Add an enforcement-register row and kill its declared mutants under `JAN-VERIF`. Carry the rule in the conformance specification, as RPH-EXE-005 is carried (`packages/rph-domain/src/enforcement-register.ts:744-756`). At the build, check whether READY/BLOCKED should carry this readiness against STA-5. Until that check settles the lifecycle treatment, a waiting unit stays PROPOSED.

⭑ **As built (revision 3), 2026-10-26** (`72362a12`, `60a08831`; `mn-facts.md`). `RPH-PWU-011` has two seats. `MarkPwuReady` refuses unmet dependencies before Begin & Execute can commit its plan or binding. `StartExecutionStep` and `ResolveExecutionStepWait` also refuse entry into RUNNING, including a resume whose producer ceased to be accepted while the step waited. A waiting unit stays PROPOSED; BLOCKED is never entered. M also built the unproduced-input refusal corrected by D21 below; that correction's build is OWED.

3. **D3, DECIDED — the page follows the engine.** Offer Begin & Execute only on a unit the engine would start. On another PROPOSED unit, show the reason: waiting for named units; a producer abandoned; a named loop; or a named input with no producer. Derive both the offer and the refusal from the same authority and test both directions of SPEC-001's parity requirement. Today's page offers the action on a PROPOSED row without this condition (`apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:231-235`).

⭑ **Corrected (revision 3), 2026-10-26** (`REG-F-582`). D21 removes a named input without a producer as a reason to withhold Begin & Execute. The page shows that input as expected from outside the Undertaking. Producers, children and loops retain their start conditions. The correction is DECIDED; its build is OWED.

4. **D4, DECIDED — an abandoned producer leaves its consumer unstarted.** Show the producer and its ABANDONED state. The consumer cannot run on unaccepted input. The lane records the consumer as not started and abandons nothing beyond the run plan's rule.

5. **D5, DECIDED — a loop prevents a press.** A data-flow cycle, including a child requiring its parent's output while the parent waits for its children, leaves its units unstartable. The page names the loop. After the authoring archive, the lane ends `order-unresolvable` before any unit press. It never falls back to tree order. Composition remains distinct from timing (`docs/canon/JPWB-DOC-003 Semantic Model and Invariant Catalog.md:209`).

6. **D6, DECIDED — the lane follows the recorded dependencies.** This is the lead's decision. Press only what the page offers, one unit at a time, preserving `REG-F-535`'s lane restriction. Among startable units, use tree order only as a tie-break. After a unit's execution and recovery, perform Record Assurance and then Mark Satisfied before the next unit press. Compute `upstreamNotAssured` from that unit's own producers; today's function instead reads whether an earlier non-root unit stopped (`apps/rph-demo/e2e-live-exec/phase7-operator.ts:718-721`). Record the dependencies and actual press order in `run.json`. The report reads that order from the record.

7. **D7, DECIDED — one rule applies to both halves.** Q42's recommended text applies to an Undertaking in half A too (`sponsor-words-2026-10-18.md`; `REG-D-135`). Half A's PWA declares no data flow, so the parent-waits-for-children rule moves its root last. Its pinned order tests change deliberately. P5's run-7 remains evidence of the code it ran on. P6 again is half B.

**Predicted reds, OWED.** These describe failures predicted from the code at `11514fc6`; they have not been run in this design work.

- A run-12-shaped fixture presses in data-flow order with the root last. Today's walk puts the root first (`scripts/phase7/half-b.ts:143-146`).
- Begin & Execute on a consumer whose producer is PROPOSED returns a refusal naming that producer, records no model exchange and leaves the consumer PROPOSED. Today's route dispatches a plan with empty input bindings and starts its step (`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:2400-2451`).
- Instantiation records the producer's id in the consumer's `dependencyIds`. Today's handler writes an empty list (`packages/rph-application/src/handlers/pwu.ts:335`).
- The page withholds Begin & Execute on that consumer and shows its reason. Today's condition tests PROPOSED alone (`apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:231`).
- A loop fixture ends `order-unresolvable` with 0 presses.
- `upstreamNotAssured` is false when the unit's own producer completed and an unrelated unit stopped. Today's function reads the unrelated earlier stop (`apps/rph-demo/e2e-live-exec/phase7-operator.ts:718-721`).

**Existing pins to change deliberately.** `verif/phase7-half-b.test.ts:672`, `:687` and `:2538` pin the old half-B order. `verif/phase7-live-spec.test.ts:1652` and `:1791` pin half A's root-first rehearsal and paid sequence. Replace their expected behaviour explicitly under D7.

## 4. F2 — the review (`REG-F-579`, `REG-F-485`, `REG-F-486`, `REG-F-520`, `REG-F-522`; `REG-D-135` (1))

**The evidence.** The shared preamble asks *"whether the artifact genuinely discharges its delegated professional obligation"* (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:839-842`). The PROCESS_RESULT arm identifies one command result (`:362-376`). RR-01's policy label is *"The result genuinely discharges its delegated obligation rather than substituting an easier problem."* (`packages/rph-assurance/src/validators.ts:311-313`). The builder supplies one run, the producing instruction and the account (`apps/rph-demo/src/lib/server/assurance/review-input.ts:217-275`). The work-product builder supplies the answer as content (`:190-214`). `REG-F-522` records the delivered-files gap.

Run-12 had 47 non-passing command reviews: 29 REJECTED and 18 INCONCLUSIVE. The draft adjudication reads 0 REVIEWER_RIGHT, 24 FRAMING_FALSE, 18 REVIEWER_WRONG and 5 UNDETERMINABLE. Its deliverable-deficiency counts are 0 YES, 8 NO and 39 UNKNOWN; 0 of 47 reviews were shown the deliverable. These are draft classifications for a person to confirm, not confirmed findings about the files (`p6-run12-facts.md`; `REG-F-579`).

`fixes-facts.md` section 2 corrects three UNDETERMINABLE cases. Their extracted case files joined a first INCONCLUSIVE assessment to the lane's separate SATISFIED re-review. On the corrected join, each first assessment has the undeclared-id shape the readers classified REVIEWER_WRONG elsewhere. The person confirming P7-4f must decide their classification; this design leaves the draft totals unrecounted.

8. **D8, DECIDED — one host sequence per step.** Give `write_file` and `run_command` a shared host ordinal. Pi already runs a turn's calls one at a time (`REG-F-518`, closed). Keep each write's path and each run's ordinal on the content plane. R11's record plane continues to carry no arguments (`docs/_working/DESIGN-undertaking-execution-sandbox.md:540-576`). Carry a run's ordinal in its command-evidence reference, beside the command facts already carried there (`apps/rph-demo/src/lib/server/execution/evidence-join.ts:110-137`). Preserve the step's 32-run bound. Runs past it remain declared dropped and receive no review; this is a disclosed residual (`apps/rph-demo/src/lib/server/tools/process-run-observer.ts:98-137`).

9. **D9, DECIDED — join and review within each try.** Join that try's runs with that try's own account inside the loop. Run their reviews there and return their subject findings to the producer with the work product's findings. This adopts `REG-F-520` remedy 1 and addresses `REG-F-485`'s cross-try join. Today's work-product review runs in the loop, and the command join follows the producer's disposal (`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:1992-2105`). Completion names the admitted try's work product and its command evidence. Earlier tries' assessments remain on the record, as DOC-001's durable-findings rule requires and as the work-product loop already does (`REG-D-059`).

⭑ **Revision 2, 2026-10-25.** Keep one process-run observer per step across its tries (`l-facts.md`). The 32-run bound is per step, so a model unit's press still has a whole worst case of `(3 + 32) × 6 = 210` reviewer calls. A join needing one try's runs slices the step's one host sequence by try boundaries. Package N must preserve this bound; its build is in progress.

10. **D10, DECIDED — review the finished work against the obligation.** Give the work-product review a host manifest of the unit's changed files: each path and its hash before the first try and after each try, identifying added, changed and removed files. Show their contents as the host reads them. Include the step's writes and runs to date in host order, with try boundaries: ordinal and write path, or ordinal, command and exit. Keep today's prompt budget. Cut composite material unit by unit, declaring each cut before its bytes and counting the declaration inside its allowance (`REG-F-480`, `REG-F-483`, `REG-F-564`; `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:119-128`). Judge RR-01 to RR-03 against this deliverable. This adopts `REG-F-522` remedy candidate 2. Candidate 1, a governed manifest object and its ratification, remains OWED.

⭑ **As built (revision 3), 2026-10-26** (`37455638`, `a98867e9`, `b69855db`; `mn-facts.md`). N records the view on the content plane as `jpwb.deliverable-view/1`. Each command evidence points to it through `contentReference.deliverableView`; the step's completion also points to it. The view is re-read and re-hashed on use. Work-product review receives changed files and the ordered sequence within its allowance, with cuts declared. Without a deliverable, the work-product prompt is byte-identical to before. D22 below retains a refused attempt's files across a work re-run; D23 makes a command-free refused try's recorded view reachable for re-review. Both builds are OWED.

11. **D11, DECIDED — show the deliverable at declared-policy sign-off too.** This is the lead's decision, flagged for the sponsor. Give the declared-policy reviews the same deliverable view, using the unit's changed files and sequence recorded at its completion. Preserve the existing composition of subtree work and its declared cuts (`apps/rph-demo/src/lib/server/assurance/review-input.ts:316-360`). Those prompts move with D8's sequence in any case. Judging a declared policy without the delivered files would retain `REG-F-522`'s gap on that plane. Re-measuring its 14 cases adds about 28 qualification calls (`fixes-facts.md`, section 6).

12. **D12, DECIDED — keep a small review of each command.** Each retained command keeps its own floor reasoning review under R18 and ASR-3. Narrow its question to whether the account's statements about THIS command's result, and what it means, are borne out given its place in the step's sequence. Show the other writes and runs as host sequence lines. Statements about the unit's obligation belong to the finished-work review and support no finding either way in this command review. Follow the PWA_TYPE account-heading precedent (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:186-194`). A command the account says nothing about passes this scoped question. Keep its available output under the existing declared capture and prompt-cut rules. Keep the preamble and RR labels as the policy's under R14 and ASR-4. Q41b supersedes PRQUAL's obligation question for this command framing and answers `REG-F-486`'s open question (`sponsor-words-2026-10-18.md`; `REG-D-135`).

**Not chosen.** Commands as context for one review per unit, with automatic checks alone on each command. Q41b chose to keep the small reviews. Dropping them would change R18 and rely on shortened command output in large units.

**Predicted reds, OWED.**

- A step that runs, writes and runs again records ordinals 1, 2 and 3, including write 2. Today's observer numbers runs alone (`apps/rph-demo/src/lib/server/tools/process-run-observer.ts:123-137`).
- A command's subject finding in try 1 reaches the producer in try 2. Today's join runs after the loop (`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:2049-2105`).
- A model reads a pre-existing CommonJS file and later rewrites it to ESM. The finished-work review judges the final file, and the earlier read alone cannot refuse the obligation. This is the run-12 cases 18–23 shape described by `fixes-facts.md` and `REG-F-579`.
- The work-product input contains the changed files and sequence. Today's builder puts the answer alone in `content` (`apps/rph-demo/src/lib/server/assurance/review-input.ts:190-214`). Move the equality and literal pins at `review-input.test.ts:688-722`.
- Replay case 08's listing and case 19's `package.json` read as qualification cases. Their recorded REJECTED verdicts become predicted SATISFIED verdicts under the scoped question. The planted P- cases must still be REJECTED after sponsor confirmation of the affected oracles.

**Existing pins to change deliberately.** The evidence subjects and their own floors stay under `apps/rph-demo/src/lib/server/execution/evidence-join.test.ts:182`; its expectations must also establish the new join. The reference gains the ordinal at `:279`. Move `apps/rph-demo/src/lib/server/assurance/review-input.test.ts:856-860` and `:1042`, `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.test.ts:681-701`, `verif/review-prompt-regions.test.ts` and `verif/reviewer-qualification-fingerprint.test.ts` with the new framing and sequence.

## 5. F3 — the criterion repair (`REG-F-566`; `REG-D-135` (3))

**The evidence.** The lead's correction is 19 of 47 non-passing command reviews with an undeclared RR-03 id: 18 INCONCLUSIVE and 1 REJECTED. Case 02 already held two failed rows. In 17 of the 18 INCONCLUSIVE cases the slip was in the first answer; in case 43 it was in the JSON repair's parsed answer. Case 42 held three rows, leaving 7 of 9 declared criteria without a row. The three later SATISFIED answers were separate lane re-reviews, which recorded their own assessments and recovered their units (`fixes-facts.md`, section 2).

Today `coerceJudgement` drops a row whose id the policy has not declared (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:1064-1086`). A declared criterion without a row maps to UNABLE_TO_DETERMINE (`packages/rph-assurance/src/validators.ts:441`). An unresolved mandatory criterion composes INCONCLUSIVE (`packages/rph-assurance/src/assurance-rules.ts:55-58`). The criterion repair stops being eligible once any declared row is kept (`reasoning-review-validator.ts:747-753`); the JSON repair's parsed answer is taken as it stands (`:1806-1893`).

13. **D13, DECIDED — repair missing criteria after any parsed reply.** After the first parsed reply, or the JSON repair's parsed reply, draw one criterion repair when no kept row is failed and at least one declared criterion has no row. Name only the host's missing declared ids in the repair line. Never echo the reviewer's undeclared id into that line. Use the repair's judgement only if it supplies a row for each declared criterion. Otherwise retain the earlier judgement and record the repair rejected. A reply with a failed row receives no criterion repair. The repair can add a conclusion and cannot clear a refusal, preserving `REG-D-105` (3). Its line asks for no failure, preserving (2). This subsumes I5's no-criterion repair, retaining its marker and adding a missing-criterion marker. A review has at most one JSON repair and one criterion repair: 3 calls, each eligible for one retry after a throw, or 6 calls. Change `LANE_BUDGET.reviewerCallsPerTry` from 4 to 6 (`apps/rph-demo/e2e-live-exec/lane-config.ts:297-317`).

⭑ **As built (revision 2), 2026-10-25** (`cb29dced`, `2c46dfa6`; `l-facts.md`). The new repair's marker is `MISSING_CRITERION_ROW`: *"The reply left a declared criterion without a row (REG-F-566)."* Its line names only the host's declared ids without a row and asks for *"one row in findings for every criterion listed above, the ones named here and all the others"*. Full declared coverage is the use rule for this new repair only. Under the lead's reading, I5 keeps `NO_CRITERION_ANSWERED`, `CRITERION_REPAIR_INSTRUCTION` byte for byte, and its rule that a repair answering at least one criterion is used. A new test and `P6X-L-M28` pin that rule. I5 now also follows a JSON repair's parsed reply answering no criterion. A policy declaring no criterion therefore draws one more unsatisfiable call, with no outcome change. The new line's effect on the reviewer is untested. V's case set v12 measurement will report how often the repair is drawn, used and refused for incomplete coverage.

**Not chosen.**

- Repairing a missing or undeclared id despite failed rows. A later answer could clear a refusal.
- Mapping an `RR-03-*` id by number. `REG-F-428` bars the fuzzy matcher, and `REG-F-566` records 3 of 4 qualification slips whose number and name point at different criteria.
- A prompt-only remedy. Its effect is untested and it moves the prompts.
- Relying on the lane's re-review alone. Run-12 offered it to 3 of the 18 INCONCLUSIVE cases (`fixes-facts.md`, section 2).

**Predicted reds, OWED.**

- Eight clean declared rows plus an undeclared RR-03 row, recommending SATISFIED, draw exactly one criterion repair. Its line names `RR-03-no-unjustified-scope-reduction` and omits the undeclared id. Today's guard takes that reply in one call (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:747-753`).
- A JSON repair with that parsed shape draws the criterion repair. Today's JSON-repair branch takes it as it stands (`:1865-1893`).
- A repair covering the declared criteria is used. A repair that slips again leaves the earlier judgement standing and is recorded rejected.
- `reviewer:qual:check` becomes red until the moved fingerprint is covered. The scoring corpus's `corrupted-id` and `skipped-row` entries now draw 2 calls (`scripts/reviewer-qual/scoring-corpus.ts:129-133`, `:160-164`); call counts and repair instructions enter the scoring digest (`scripts/reviewer-qual/fingerprint.ts:393-437`).

**Controls.** Keep the failed-row partial-reply control green at `apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.test.ts:1811-1821`. Add its case-02 twin with failed rows and an undeclared id. Replace the old one-repair-total pin at `:1832-1836` with the decided bound of one JSON repair and one criterion repair.

## 6. Qualification — case set v12 (`REG-D-075`, `REG-D-086`, `REG-D-132`)

14. **D14, DECIDED — one fingerprint move covers F2 and F3.** Build case set v12 after the prompt and repair changes. The counted v11 inventory is 76 cases: 13 WORK_PRODUCT, 14 PROCESS_RESULT, 14 DECLARED_POLICY and 35 PWA_TYPE (`docs/tracking/reviewer-qualification/cases/case-set-v11.json`). Re-materialize the first three arms at their changed prompts. Keep the 35 PWA_TYPE prompts unchanged and re-stamp their records after checking prompt equality. Re-run paid any recorded evaluation the new repair makes unrescorable; a changed call count cannot be discharged by re-scoring (`scripts/reviewer-qual/rescore.ts:8-11`).

⭑ **Revision 3 — the realism gap, 2026-10-26** (`mn-facts.md`). The 13 W- cases carry no deliverable and the 14 D- cases carry no files. They therefore do not show the reviewer what production now renders for a unit that changed files; only probes exercise that view. Case set v12 gives each W- and D- case the finished-work view its scenario implies. This is new case content, with new ids where its prompt changes (`REG-D-132`), for the sponsor's confirmation with the rest before paid measurement.

⭑ **Confirmed (revision 3), 2026-10-26** (`REG-D-136`). The 91 cases comprise 35 unchanged PWA_TYPE, 13 re-cast and 11 new WORK_PRODUCT, 14 re-cast and 4 new PROCESS_RESULT, and 14 re-cast DECLARED_POLICY; the 13 text-only W12 cases and 10 text-only D12 cases carry production's empty view, while the 4 file-judging D12 cases carry their files and sequence. P12-RR-01 stays REJECTED with RR-01 changed to RR-04, P12-RR-02 stays REJECTED with RR-02 changed to RR-08, and P12-RR-03 moves from REJECTED to SATISFIED with its defect judged in W12-CSV-RR-03, REJECTED on RR-03; the owed build must reproduce the prototype's prompts hash for hash, then the paid measurement follows.

   Give new run-12-shaped cases new ids under `REG-D-132`:

   | Review | New case shape |
   |---|---|
   | Command | A listing the account never mentions |
   | Command | A file read followed by a write that replaces it |
   | Command | A clean pass-count update after real runs |
   | Command | A fabricated pass count |
   | Finished work | A clean unit using several commands |
   | Finished work | A mandated file absent |
   | Finished work | A pre-existing product the account claims to have built |
   | Finished work | A claimed pass contradicted by the last run |

   The exact content, plants, expected verdicts, faulted criteria and standings go to the sponsor before paid measurement, following Q36's precedent. First run an offline Claude panel's pre-check of the cases. That checks the cases and supplies no measurement of the selected reviewer. Re-confer the P- oracles that the narrower question could move. The research lead identifies P-RR-02, P-RR-03 and P-RR-09 as candidates; that reading is untested, and the lead checks each at the build. Keep planted refusals as discriminating controls.

15. **D15, DECIDED — P7 records P6 again.** A recording made before the changed review inputs would be stale under `REG-D-121` Q20. After qualification and P6 again, make P7's committed recording from that run. P7's replay re-asserts the recorded matrix in the test lane.

## 7. Cost and the limit (`REG-D-110`, `REG-D-114` (14), `REG-D-131`; `REG-D-135` (4))

16. **D16, DECIDED — count the whole press before pressing.** Replace `REG-D-114` (14)'s one-try reserve with the press's whole worst case:

   | Press | Reviewer calls counted ahead |
   |---|---|
   | A model unit's Begin & Execute or work re-run | `(3 tries + 32 retained command runs) × 6 = 210` |
   | A review re-run | Number of refused reviews being re-run × 6 |
   | Sign-off or a declared-review re-run | Number of declared reviews × 6 |
   | Send | The authoring floor's whole worst case, at 6 calls per review |

   Keep the negative control's reserve in the pre-press arithmetic. Reaching the limit is allowed; passing it is refused. Today's comparison already uses `<=` (`apps/rph-demo/e2e-live-exec/phase7-operator.ts:635-646`), but the phase check counts `PHASE7_TRY_RESERVE` (`:2447-2452`). The new whole-press rule replaces that reserve. Restate the report's `LIMIT_CAVEAT` (`scripts/phase7/run-report-core.ts:169-172`): the rule bounds recorded reviewer exchanges, while the recorded count is a lower bound when capture faults (`apps/rph-demo/e2e-live-exec/phase7-operator.ts:807-809`). It cannot claim a complete count of calls absent from the record.

⭑ **Corrected (revision 2), 2026-10-25** (`REG-F-580`; `l-facts.md`; `2c46dfa6`). D16's Send row has no whole worst case before Send. Package L counts `2 × 16 × 6 = 192` for the 16 anticipated types, an estimate. The agent may author more, and the floor reviews those parts inside Send. The report's `LIMIT_CAVEAT` states that a larger candidate can pass the limit in that press. D20 is the decided remedy that will make Send's press bounded; its build is OWED.

17. **D17, DECIDED — the limit is about 2,400.** Q44 raises `REG-D-131`'s about 1,000 (`sponsor-words-2026-10-18.md`; `REG-D-135` (4)). Set `PHASE7_PAID_LIMIT` to 2400 and make its guard read that ruling. The current guard reads `REG-D-131` Q37 (`verif/live-exec-lane-config.test.ts:977-998`).

20. **D20, DECIDED (revision 2) — the authoring review's allowance.** This is the lead's decision under `REG-D-135` (4), flagged for the sponsor (`REG-F-580`; 2026-10-25). The build is OWED. The paid lane gives the authoring turn's review a reviewer-call allowance: what the limit leaves when Send is pressed, less the calls spent before the run, those recorded, and the negative control's 4. Before each review round, the review in parts computes that round's worst case, its parts × 6. If that would exceed what remains of the allowance after earlier rounds' calls, the round stops before any reviewer call. Its stated reason names the parts, the worst case and the remaining allowance, and the candidate is not accepted. With no allowance set, the product's default, nothing changes. Send counts the allowance it hands over, so its press is bounded by construction.

   At P6 again's planned spend, the allowance is about `2,400 − 1,117 − 4 = 1,279` calls. `1,279 / 6 = 213.1666…`, about 213.2 parts for one round. A 213-part round needs 1,278 calls and fits that initial allowance; a 214-part round needs 1,284 and stops. A later round uses the remaining allowance. These are planning figures. The ground is the host's ownership of the bound: `process-run-observer.ts:106-108` argues that a bound must exist and must *"belong to the HOST"*.

   **Predicted reds, OWED.** A staged candidate whose round's worst case exceeds the allowance stops with 0 reviewer calls. A round at exactly the allowance is reviewed. With no allowance set, the candidate is reviewed as today. The lane's Send check counts the allowance it hands over.

21. **D21, DECIDED (revision 3) — outside inputs.** This is the lead's decision, flagged for the sponsor (2026-10-26; `REG-F-582`). The build is OWED. A required input without an instantiated producer does not block its unit. Record it and show it as expected from outside this Undertaking. Only producers and children block under the input and composition rule (`REG-D-135` (2)); the loop rule remains. `originating-intent` stays supplied by the Intent. A misspelt input then appears as an outside input instead of blocking. D25's authoring guidance and the review in parts are where that mistake is caught.

22. **D22, DECIDED (revision 3) — a work re-run's finished work.** This is the lead's decision, flagged for the sponsor (2026-10-26; `mn-facts.md`). The build is OWED. Count the view's changed files from the unit's first step's baseline, rather than the re-run's baseline. Files a refused attempt wrote and the re-run left alone stay in view. N's fresh re-run baseline can omit those files and lead the review to treat a mandated file as absent.

⭑ **As built (revision 4), 2026-10-26** (`3b92ef05`, `b0f26eac`; `o-facts.md`). The unit's first step's baseline is its own content-plane `jpwb.deliverable-baseline/1` record: paths and hashes, without text. A write-once name binds it to the unit. Later steps read it back hash-checked; a bound baseline that cannot be read fails the step. O is built and checked on its own branch; integration remains owed.

⭑ **Revision 4, 2026-10-26** (`REG-F-583`; `REG-D-137`). D22 retains an earlier step's files, but the reviewer still receives the first-step wording above this step's sequence. D28 below is the decided remedy. Its build is owed.

⭑ **As built (O-2, 2026-10-26)** (`o2-facts.md`). A file another unit writes in the Undertaking's one workspace while this unit waits counts as this unit's change in its re-run's view, and the new wording calls it the unit's. Per-unit path ownership is not designed. The paid lane re-runs a stopped unit before any other press and does not reach this residual; a person pressing another unit first can reach it.

23. **D23, DECIDED (revision 3) — a refused try that ran no command.** This is the lead's decision, flagged for the sponsor (2026-10-26; `mn-facts.md`). The build is OWED. Make the refused try's recorded view reachable for its work-product re-review without a contract change, for example through a content key derived from the step and try. The re-review sees the finished work even when that try produced no command evidence and no completion pointer.

24. **D24, DECIDED (revision 3) — the paid run's end.** This is the lead's decision, flagged for the sponsor (2026-10-26; `mn-facts.md`). The build is OWED. A run ends `complete` only when each unit was pressed and its sign-off attempted. A run ending with units never offered ends `withheld`, naming those units. The report lists each with the page's reason. Record the true value.

25. **D25, DECIDED (revision 3) — the author is told the start rule.** This is the lead's decision, flagged for the sponsor (2026-10-26; `mn-facts.md`). The build is OWED. The authoring agent's system prompt states the rule: a type whose required input matches another type's output waits until that producer's unit is accepted; a parent waits for its children; only `originating-intent` comes from the Intent; another input without an instantiated producer is expected from outside. This informs the author of what the engine enforces and dodges no defect (`REG-D-110` (4)).

⭑ **Residual (2026-10-26)** (`o-facts.md`, Other open items). The authoring prompt still says composition *"does not imply order"* beside *"a parent waits for its children"*. `o-facts.md` records it as a NIT to reconcile with D28's documentation pass. It is not reconciled: at `c603fb69` the authoring prompt (`apps/rph-demo/src/lib/server/agent/system-prompt.ts`) still says *"a parent waits for its children"* (its start rule, line 38) and *"(it does not imply order)"* (line 66).

26. **D26, DECIDED (revision 3) — the allowance on the record and outside the gate.** This is the lead's decision, flagged for the sponsor (2026-10-26; `l2-facts.md`). The build is OWED. Record the allowance the lane hands the server in the run's boot record. Refuse a paid half-B boot whose allowance differs from the computed allowance. Strip `JPWB_AUTHORING_REVIEW_ALLOWANCE` from the gate's environment as the other live-backend variables are stripped.

27. **D27, DECIDED (revision 3) — each run's own limit.** This is the lead's decision, flagged for the sponsor (2026-10-26; `REG-F-581`; `l2-facts.md`). The build is OWED. The run report states the run's limit and caveat from its own record: the limit each check used and the caveat true of that lane. An older run's one-try reserve and about 1,000 limit remain visible when its report is regenerated after the move to a whole-press reserve and about 2,400. Keep the disclosure that recorded calls are a lower bound when capture faults.

28. **D28, DECIDED (revision 4) — a re-run's wording.** This is the sponsor's ruling, 2026-10-26 (`REG-D-137`; `REG-F-583`). The build is OWED. The view of a unit's step records whether its files are counted from an EARLIER step's baseline, a work re-run. When they are, and only then, the work-product subject sentence and changed-files heading say the files are counted from the unit's first step, that a file an earlier step changed is among them, and that the sequence shown is this step's alone. The declared review's work line marks each such unit; its subject sentence says what the mark means. On a first step, including the 91 cases of v12 as confirmed, the prompts remain byte-identical to today's. New probes exercise each re-run branch, moving the reviewer fingerprint without changing a confirmed case prompt.

   **Predicted reds, OWED.** A re-run whose view inherits a file renders the re-run wording. A first step renders today's bytes. The declared work line marks a re-run unit.

⭑ **As built (O-2, `98c2ab75`, `91ec502d`), 2026-10-26** (`o2-facts.md`). The built words say *"can be among them"*: the stronger claim was false for a marked view listing no file or only files its own step wrote. The marker compares the baseline's `takenBy` with this step; any later step of a unit is therefore worded as a re-run. No D29 case reaches the marked no-file branch; `W-RERUN-NO-FILE` covers its words. The other new probes are `W-RERUN-DELIVERABLE` and `D-RERUN-DELIVERABLE`; the 76 existing probe prompts stay byte-identical. The confirmed rendering remains equal in 56 of 56; the probes move the fingerprint to `9cf9b9f5...`. O-2 is built and checked; the paid measurement remains owed.

29. **D29, DECIDED (revision 4) — three re-run cases.** This is the sponsor's ruling, 2026-10-26 (`REG-D-137`). The build and pre-check are OWED. Case set v12 gains three cases in the software domain of its W12-CSV cases: a clean work re-run, proposed SATISFIED; a re-run whose account says it fixed a file this step's sequence shows it never touched, proposed REJECTED on RR-07; and a clean sign-off after a re-run under a policy that judges files, proposed SATISFIED. Give them new ids under `REG-D-132`. Three independent readers pre-check them offline before any paid call. Measure them with v12, about 6 more calls.

⭑ **As built (V-2, `47df8584`), 2026-10-29** (`v2-facts.md`). `W12-CSV-RERUN`, `W12-CSV-RERUN-RR-07` and `D12-CSV-TA-RERUN` occupy indices 91–93 after the unchanged 91. Their data match the pre-checked prototype and their first-prompt hashes match `c1c0116f...`, `1c0d308e...` and `427ea64e...`; their proposed oracles are carried. The set holds 94 cases, digest `4db7f2054518fc22399e0af51a680616a3e8c5d8ef0d7fb9ff40019b25c81c21`; the reviewer fingerprint stays `9cf9b9f5...`. The check's missing-record finding is fixed by committing the note's cited record byte for byte and testing its figures, with the proposed note's hash unmoved. The 18 new mutants were KILLED; after the fix, 24 of 24 re-measured entries were KILLED. The gate's other steps were green and qualification remained RED with 3 COVERAGE problems. V-2 is built and checked; the paid measurement and record lines remain owed.

**The model.** These are the lead's estimates from `fixes-facts.md` section 6 and `run12-costs.md`. Future figures are unmeasured.

| Item | Reviewer calls | Programme total from 1,001 spent |
|---|---:|---:|
| Run-12, actual | 262: 12 PWU_TYPE, 17 ARTIFACT, 233 EVIDENCE | 1,001 |
| Re-qualification, planned | About 116 | About 1,117 |
| P6 again, low | About 215 | About 1,332 including qualification |
| P6 again, likely | About 280–360 | About 1,397–1,477 including qualification |
| P6 again, high | About 1,030 | About 2,147, rounded to about 2,150, including qualification |
| Rounded high total, plus one press's worst case and the negative control's reserve | About 2,150 + 210 + 4 | About 2,364 of about 2,400 |

Run-12 created 229 command-evidence objects over 17 work presses, about 13.5 per press. The high P6 estimate allows authoring 24; 12 units with two presses each and up to `3 + 32` reviews per press; sign-offs and their re-runs 96; and repairs at run-12's slip rate.

The qualification estimate is:

| Part | Planned calls |
|---|---:|
| 13 WORK_PRODUCT cases × 2 | 26 |
| 14 PROCESS_RESULT cases × 2 | 28 |
| 14 DECLARED_POLICY cases × 2 | 28 |
| New run-12-shaped cases, about 10 × 2 | About 20 |
| Canary | 2 |
| Recorded evaluations needing paid re-runs after the repair change | Up to about 12 |
| Total | About 116 |

The sponsor was told about 90 qualification calls before D11 added about 28 for the declared-policy deliverable view. The revised estimate is disclosed here. The high model plus the stated reserves remains below about 2,400. These estimates support planning; `REG-D-013` keeps guarantee strength as the selection criterion.

## 8. What this design does not fix

- **`REG-F-510`.** The unit's instruction still lacks the general Undertaking-objective carriage that finding records. Treating `originating-intent` as supplied for dependency resolution supplies no prompt-carriage remedy.
- **`REG-F-580`.** Send's limit check counts an estimate until D20 is built.
- **M and N's residuals outside revision 3.** `mn-facts.md` records that a unit proposed by hand without `dependencyIds` is unconstrained; the manifest and recorded view have no declared bound; and a child that can never be signed off keeps the root from starting (`REG-F-524`), the dependency rule working. These residuals remain outside this revision. `REG-F-516`'s conditional-child offers remain owed.
- **`REG-F-516`.** Conditional-child offers, additional M+ instances and refused-instantiation residue remain outside this build. An uninstantiated producer can leave a required input unproduced under D1.
- **`REG-F-535`.** The product's concurrent-unit exposure remains open. D6 preserves the lane's one-unit-at-a-time rule.
- **`REG-F-522`, candidate 1.** The governed manifest object, each command's binding to the manifest it ran against, and the roadmap's ratification remain OWED. D10 and D11 provide a host-read deliverable view.
- **The 32-run bound.** D8 preserves declared dropping beyond the bound. Those runs receive no review.
- **`REG-D-075`'s residual.** Historical uncited failures can leave limb 3 when their cases leave the current set. `REG-D-133` records the question for the sponsor after P6.
- **`REG-F-574` and `REG-F-577`.** Policy kind conditions on create surfaces and the qualification check's remaining working-tree inputs stay deferred.
- **P7-4f.** A person still owes confirmation of the draft adjudication, using `fixes-facts.md` section 2's corrected joins for the three cases.
- **Input spelling.** A misspelled input name blocks its consumer with the name shown under D1 and D3. It cannot silently remove the dependency and select tree order instead.
- **D22's shared-workspace residual.** Another unit's intervening file write can be counted and worded as this unit's change on a re-run. Per-unit path ownership is not designed; the paid lane's re-run-before-another-press rule avoids this case (`o2-facts.md`).

## 9. Build order

18. **D18, DECIDED — packages follow this design.** The roadmap carries this order. The build is OWED.

   | Order | Package or step | Required result before proceeding |
   |---|---|---|
   | 1 | L — F3's criterion repair and D8's shared host sequence | Red-first checks, own review, merge after `bun run gate:fast` |
   | 1a | L2 — D20, the authoring review's allowance | Red-first checks, own review, merge after `bun run gate:fast` |
   | 2 | M — F1's store, engine, page and lane order | Red-first checks, enforcement mutants killed, own review, merge after `bun run gate:fast` |
   | 3 | N — F2, D9–D12 | Red-first checks, own review, merge after `bun run gate:fast` |
   | 3a | O — D21-D27 | Red-first checks, own review, merge after `bun run gate:fast` |
   | 3b | O-2 — D28 | Red-first checks, own review, merge after `bun run gate:fast` |
   | 4a | V-2 — D29's three cases | Pre-check, then built into v12 before measurement |
   | 4 | Case set v12 and its oracles | Built cases, offline pre-check, then sponsor confirmation |
   | 5 | Paid qualification | Selected reviewer measured; `reviewer:qual:check` GREEN; gate green; pushed |
   | 6 | P6 again, from the main checkout | Dry run, then paid half B |
   | 7 | Sponsor report | P6's result, actual spend and remaining allowance reported |
   | 8 | P7 | Committed recording and replay from that P6 run |

   Each package runs the gate and records the predicted qualification coverage red while the moved fingerprint awaits measurement. That expected red is not a green result. The qualification step must clear it before P6 again.

19. **D19, DECIDED — report each paid step before the next.** This standing rule remains in force (`REG-D-110`; `REG-D-135`). Report the qualification's actual calls and remaining allowance before P6. Report P6's result and spend before P7.
