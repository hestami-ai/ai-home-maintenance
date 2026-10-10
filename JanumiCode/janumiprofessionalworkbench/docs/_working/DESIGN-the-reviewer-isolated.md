# DESIGN — JAN-EXEC Phase 7, P7-6 (first iteration): the reviewer isolated, its replies kept, then the run again

**Programme:** `JAN-EXEC` Phase 7, step P7-6 (`DESIGN-the-live-end-to-end-run.md` §6; `REPORT-the-live-end-to-end-run.md` §7, fixes 1 to 3).
**Status:** DESIGN. The sponsor approved P7-6 on 2026-10-10, *"Yes, fix then re-run"* (`REG-D-103`). After the probes (§4a), the sponsor chose the fix, *"Prompt + isolate, test first"* (`REG-D-104`): §4b. Its test passed (§4c), and the sponsor's next four answers (`REG-D-105`) add I5 and I6: §4d.
**Scope:** the three fixes the approval named, then one paid re-run. The report's other fixes (4 to 7) are not in this iteration; fix 6 waits on the sponsor's `REG-D-091` question.

## 1. Why

In the measured run, the reviewer never answered the review of a phase's work product (`REG-F-549`). It runs as a devin agent that may read the folder the server runs in (`REG-F-548`). When it did not answer in JSON, nothing of what it said was kept (`REG-F-351`). The product was good; the review could not conclude.

## 2. The fixes

- **I1, the reviewer is isolated** (`REG-F-548`; it also closes `REG-F-547` for the reviewer).
  - `devinPrint` runs devin with its working folder set to the adapter's own fresh temporary folder, which holds only the prompt.
  - That folder holds a project config, `.devin/config.json`, denying every tool by name: `read`, `edit`, `grep`, `glob`, `exec`, plus `Fetch(*)` and `mcp__*`. devin's permission rules check deny first, and a deny always wins.
  - `--respect-workspace-trust false` is passed, because a fresh folder is untrusted by construction. devin's help gives this flag for print mode.
  - **What is not known:** whether devin applies deny rules in `--print` mode, since its documentation does not say. So I1's first act is a probe (§4).
  - **The fallback:** if deny rules do not hold in print mode, the empty folder still holds. The reviewer would see no repository, but could still read a path it is told. The record says which arrangement held.
- **I2, the reviewer's reply is kept** (`REG-F-351`, for the reviewer's plane).
  - Every reviewer call's raw output is retained as content, whether or not a JSON object can be found in it. So is devin's export of the session, which shows any tool it called.
  - The exchange record points at both. A reply that does not parse is then readable, and stage 8 can be read in full.
  - The executor's plane is not changed here.
- **I3, the reviewer is re-checked before the re-run is paid for** (`REG-F-549`).
  - The four work-product reviews of the measured run are replayed through the isolated reviewer: their prompts are stored in the run's content store. Each review is one call, plus a repair if needed, so at most 8 calls.
  - **The gate:** the re-run goes ahead only if at least 3 of the 4 reviews conclude, SATISFIED or REJECTED with findings. Otherwise the cause is not isolation, the re-run would fail as before, and the result goes to the sponsor instead.

## 3. The re-run

- From the main checkout at the commit that carries I1 and I2 (design §6 D13), after a dry run in that tree (D12).
- Into a fresh run folder. Then P7-4 a to g, with the negative control (2 calls).
- **The budget:** I3's at most 8 calls, plus the re-run's about 40, plus P7-4e's 2. That is about 50 of the 109 left of the sponsor's 150.

## 4. Order, and what must fail first

1. **The probe (1 paid call, part of I3's budget).** A prompt asks the isolated reviewer to list its folder and read a named file, then answer `DONE`.
   - The export must show no tool executed, or a denied one.
   - Predicted, untested: denied.
2. **I1 and I2 in code**, each test named with the mutant that must turn it red:
   - a test asserting the working folder and the config devin is given (red if the adapter runs in the server's folder);
   - one asserting the trust flag;
   - one asserting a non-JSON reply's bytes are retained and pointed at (red on today's code, where they are not).
3. **The gate and measurement as usual**, then commit.
4. **I3's replays**, then the re-run if the gate in §2 passes.

## 4a. What the probes found (2026-10-10, 2 paid calls) — the re-run is held

- **Probe 1: deny rules hold in print mode.**
  - Asked to list its folder and read two files, the isolated reviewer called `exec` and `read`. devin answered *"Permission denied for this tool by a deny rule in the project settings"*, and neither file's token appears anywhere in the session.
  - But the session then ended. Its stdout was the sentence written before the calls: *"I'll perform the three tasks now."*
- **Probe 2: the real failure, replayed.**
  - The design phase's own work-product review prompt (22,092 characters, from the run's content store) was replayed through the isolated reviewer.
  - Its only move was a tool call, `exec ls -la && ls -la docs …`, an attempt to inspect the files the work product describes. Denied, the session ended with an empty stdout.
- **So the cause of `REG-F-549` is the reviewer's agent harness, not its access.**
  - Given a work product, GLM under devin sets out to verify it with tools. In print mode, a tool call that is not approved ends the session.
  - In the measured run the read-only calls were approved, so it read the repository's app folder. An `exec` then ended the session, leaving the narration before it (*"I'll verif…"*) as the answer.
- **Also seen:** the reviewer's system context carries this host's own devin setup. That includes the account's global rules file, the installed skills and the subagent profiles. So a review's context depends on the machine it runs on.
- **I3's gate is answered without its 8 calls:** isolation alone cannot make the reviewer answer, and the re-run would fail as before. Per §2, the result goes to the sponsor before anything more is paid.
- **The fix needs one of these, each the sponsor's to choose:**
  - the reviewer told, in its prompt, that it has no tools and answers from the text alone. That changes a qualified, fenced prompt, so the reviewer is re-qualified;
  - or a harness that offers it no tools. devin documents no such option;
  - or a different transport to the model, a plain completion call. That re-opens `REG-D-084`'s selection.
- **I1 stays right on its own ground** (`REG-F-548`): a reviewer must not read what it was not shown.

## 4b. The fix chosen, and its test (`REG-D-104`)

The sponsor chose *"Prompt + isolate, test first"*: keep devin and GLM, run the reviewer isolated, and tell it in its prompt that it has no tools. Test it on the four failed reviews, at most 8 calls, and report. If it answers, re-qualify it on the full case set before the re-run.

- **I4, the reviewer is told it has no tools.**
  - `devinPrint` puts this text before every prompt it sends. The agy transport is not changed.
    > You are answering as a reviewer that has NO TOOLS. You cannot read files, list folders, run commands or fetch anything, and you must not try: any tool call ends this session without an answer. Everything you may judge is in the text below. Judge only that text, and reply with the single JSON object the instructions below ask for, and nothing else.
  - **It must move the reviewer fingerprint.** Qualification calls the product's own `devinPrint` (`scripts/reviewer-qual/transports.ts`), so a re-qualification measures the preamble. But the fingerprint hashes the validator's prompts, not what a transport adds to them. Left there, `reviewer:qual:check` would stay green on the qualification made without the preamble.
    - So the preamble is part of what the fingerprint hashes for a devin candidate.
    - The test that must turn red first: `reviewer:qual:check` against the recorded v4 RUN lines, once the preamble is in the code. It stays red until the re-qualification is recorded.
- **I1 and I2 are unchanged.** I1 isolates the reviewer; I2 keeps every reply.
- **I3, restated as the test the sponsor asked for.**
  - **What is replayed.** The four work-product reviews' stored prompts, from the measured run's content store, each behind the preamble, each in its own folder that holds only the prompt and the deny-all config. Try 1 is the stored INITIAL prompt. A reply that does not parse gets try 2, the stored REPAIR prompt, as the product would. That is at most 8 calls.
  - **How a reply is judged.** As the product judges it: its own `extractJson`, then `JSON.parse`, then `coerceJudgement`'s rules. A review **concludes** when it is SATISFIED, CONDITIONALLY_SATISFIED, or REJECTED with a failed finding, and it answers every criterion its prompt names. That last rule is the floor's: a review that answers no criterion is recorded INCONCLUSIVE (ASR-2).
  - **The judge is checked first, at no cost.**
    - On the 21 answers the measured run kept, it gives the recommendation the run recorded, all 21.
    - It marks the run's one SATISFIED that answered no criterion as incomplete. The floor recorded that review INCONCLUSIVE.
    - On four made-up replies it gives: an empty reply EMPTY_RESPONSE, prose UNPARSED, a REJECTED with no findings DOES NOT CONCLUDE, and findings under an unknown criterion are dropped.
  - **The gate** is §2's: at least 3 of the 4 reviews conclude. Each try's tool calls are read from devin's export and reported beside it.
  - **What the test cannot show.** That the reviewer's answers are right. It shows only that the reviewer answers. Whether it still judges well with the preamble is the re-qualification's question.
- **After the test, the sponsor decides; nothing more is spent before that.**
  - If the gate passes, the next step is re-qualification on case set v4 in full. That is 40 cases: v3's 26 took 52 calls, and v4's 14 took 28, so about 80 calls.
  - Then the re-run, about 40 calls, and P7-4e, 2.
  - **The arithmetic:** 43 spent, plus 8, 80 and 42, is about 173 of the 150. That is about 23 over the limit, and more if repairs are needed. So re-qualification and the re-run need the sponsor's limit raised, or a smaller re-qualification the sponsor accepts.

## 4c. The test's result (2026-10-10, 4 paid calls)

- **4 calls, not 8.** Every try parsed, so no repair was sent. Spend: 47 of the 150.
- **No tool calls, in all four.** Each devin export shows one model step and no tool call. On these four prompts, the preamble removes `REG-F-549`'s mechanism.
- **Three of the four conclude.** Requirements, design and end-to-end were each SATISFIED, with all 9 criteria answered, and gave 5, 5 and 7 residual uncertainties.
- **The fourth does not.** The implementation review answered SATISFIED with an empty findings list. The floor records that INCONCLUSIVE, so the phase would still stop.
  - The measured run had one such reply too. Qualification had none in 234 (`REG-F-552`).
- **The gate passes, at its threshold:** 3 of 4.
- **What it does not show:** whether SATISFIED is right. P7-4 found the product sound: all 7 acceptance cases passed, and its tests caught all 7 seeded deviations. That is consistent with these verdicts, but it does not measure the reviewer.
- **What follows, in order, and nothing is spent before the sponsor answers:**
  1. I1, I2 and I4 in code, with the fingerprint move (§4b). This costs no calls.
  2. `REG-F-552`'s remedy, if chosen. It must land before re-qualification, so that one re-qualification measures both.
  3. The re-qualification on case set v4, about 80 calls.
  4. The re-run, about 40 calls, plus P7-4e, 2.
  - **The arithmetic:** 47 + 80 + 42 = 169, about 19 over the 150.

## 4d. The sponsor's choices after the test (`REG-D-105`), and what they add

- **The limit is 200 reviewer calls.**
  - **Spent and planned:** 47 spent; the re-qualification, about 80, plus repairs; the re-run, about 42; and the recovery re-runs that P7-6R's rule allows, at most one per stopped unit, about 20. That is about 190.
  - The lane still checks the limit between phases.
- **I5, a reply that answers no criterion is repaired once** (`REG-F-552`, remedy 1).
  - **Where.** In the validator, after the first reply parses: no finding names one of the policy's criteria, whether the list is empty or every id is unknown.
  - **How the try is recorded.** As `repair-requested`, with the outcome `SCHEMA_COERCION_FAILED` and a detail naming the cause: none of the policy's criteria answered.
  - **The repair** is the prompt, plus a line naming that cause: *"IMPORTANT: your reply gave no row for any criterion. Reply with ONLY the minified JSON object, with one row in findings for each criterion, failed=false where it is met."* A repair names what was wrong, not a generic try-again (DOC-001:227).
  - **If the repair answers at least one criterion,** its judgement is used.
  - **If it answers none again, or does not parse,** the first reply's judgement stands, recorded as today. The floor then records INCONCLUSIVE, with the recommendation kept (`REG-D-090`). So the repair can only add a conclusion. It never makes an outcome worse than today's.
  - **Not repaired:** a reply that answers some criteria but not all (`REG-F-489`). The floor's reading of an unanswered criterion holds.
  - **Cost:** at most one more call per such reply.
  - **Predicted red:** a validator test fed the measured run's exact reply, `{"findings":[],"recommendation":"SATISFIED",…}`, asserting a second call carrying the repair line. At HEAD there is one call.
- **I6, the prompt asks for one row per criterion, met or not** (`REG-F-552`, remedy 2, with the sponsor's condition).
  - **The cause, found while designing this.** D8's lines say *"For each failure give a one-sentence statement … and a severity"*. A reviewer can read that as "list only the failures", and that is the shape of both `REG-F-552` (no rows) and `REG-F-489` (rows only for faulted criteria).
  - **The added sentence.** D8's lines are the sponsor's answers of 2026-10-05, byte for byte, so they are not edited. The sentence is added after them:
    > Give exactly one row in findings for each criterion listed above: failed=false where the criterion is met, failed=true where it is not. A criterion that is met is recorded as met; do not look for a failure that is not there. An empty findings list leaves every criterion unassessed.
  - **The sponsor's condition** is that the prompt must not push the reviewer to find a failure. The sentence says a met criterion is recorded as met, and it asks for no failure.
  - **It names no disposition value,** so the statement `REG-D-090` records about the prompt stays true.
  - **The re-qualification measures the condition:** its clean cases must stay SATISFIED.
  - **Predicted red:** a test asserting the sentence in every framing the prompt is built in. The existing pins on D8's lines must stay green.
- **Order.** I1, I2, I4, I5 and I6 land together. Then one re-qualification measures them all, and its result goes to the sponsor before the re-run.

## 5. What this does not do

- ~~It does not change the reviewer's model, its prompt or its criteria.~~ It does not change the reviewer's model or its criteria. Its prompt gains I4's preamble (§4b, `REG-D-104`).
- It does not change how commands are joined to accounts (`REG-F-486`, `REG-F-551`), the order of a message's commands (`REG-F-518`), or the executor's envelope (`REG-F-519`). So the re-run may still stop a phase on those, and if it does, it says so.
