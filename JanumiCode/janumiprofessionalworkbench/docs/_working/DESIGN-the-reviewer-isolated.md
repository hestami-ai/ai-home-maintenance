# DESIGN — JAN-EXEC Phase 7, P7-6 (first iteration): the reviewer isolated, its replies kept, then the run again

**Programme:** `JAN-EXEC` Phase 7, step P7-6 (`DESIGN-the-live-end-to-end-run.md` §6; `REPORT-the-live-end-to-end-run.md` §7, fixes 1 to 3).
**Status:** DESIGN. The sponsor approved P7-6 on 2026-10-10, *"Yes, fix then re-run"* (`REG-D-103`).
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

## 5. What this does not do

- It does not change the reviewer's model, its prompt or its criteria.
- It does not change how commands are joined to accounts (`REG-F-486`, `REG-F-551`), the order of a message's commands (`REG-F-518`), or the executor's envelope (`REG-F-519`). So the re-run may still stop a phase on those, and if it does, it says so.
