# REPORT — JAN-EXEC Phase 7, half A: the first live end-to-end run

**Programme:** `JAN-EXEC` Phase 7, step P7-5 (`DESIGN-the-live-end-to-end-run.md` §6; `ROADMAP-undertaking-execution-sandbox.md` §9).
**Run:** P7-3, 2026-10-10, 51 minutes, from the main checkout at `5d75c659` (design §6 D13), on Pi with `gpt-5.6-sol` executing and devin with `glm-5-3-flash-max` reviewing (`REG-D-084`). Checks P7-4a to g the same day.
**Records:** the run's folder and its final copy, outside the repository; the report the run's own tool wrote (`scripts/phase7/run-report.ts`), read here; findings `REG-F-546` to `REG-F-551`.

## In one screen

- **Your question** (2026-10-09): *"after a PWA and it's PWUs are built and published is an undertaking able to execute as intended?"*
- **The answer for half A: not yet. The execution works; the review does not.**
- **What worked, measured.**
  - The five-type PWA, typed into the designer and published, became an Undertaking of five work units.
  - Each phase ran once on the executor and produced its deliverable: requirements, a design, an implementation with 23 unit tests, and 18 end-to-end tests, with a verification document.
  - **The product works.** `wordfreq` passes all 7 acceptance cases written from the brief before the run. Its own tests catch all 7 seeded deviations from the brief, and 62 of 74 code mutations end to end. Its end-to-end tests really start the tool.
  - No forbidden act was used, and the negative control was refused as predicted.
- **What broke: the review.**
  - Every phase stopped at its review, and a stopped phase can never be run again (K1), so no phase completed.
  - In all four phases, the reviewer never answered the review of the work product: once empty, three times in prose, and the one repair request each time came back the same.
  - Three command reviews ran into the model's output limit; the one further call P7-2b allows recovered one of them.
  - The reviewer runs as an agent that can read the folder the server runs in, which is this repository's source, and one of its verdicts reports what it found there.
- **Spend:** 41 reviewer calls of the 150 approved (P7-3a 3, P7-3 36, P7-4e 2), and 6 executor calls (P7-3a 2, P7-3 4).
- **Two things need you.**
  1. **`REG-D-091` comes back.** On undertakings a stopped unit can only be abandoned (K1, now driven live four times). Option (a)'s *"a re-run re-runs the same automated reviewer, which can clear it"* holds for authoring only. Decide how a stopped work unit is recovered.
  2. **Approve a fix-and-rerun (P7-6).** The proposal:
     - Isolate the reviewer: run devin in an empty folder, with no repository to read.
     - Keep a reviewer's reply even when it does not parse.
     - Re-measure the reviewer on work products of live size.
     - Then run P7-3 again: about 40 reviewer calls, inside the remaining limit of 109.
     - Each paid re-run comes back to you (`REG-D-102` (4)).

## 1. The stage matrix

From the run report, with stage 6 measured by P7-4. A "Yes" may count only cells that could have failed.

| Stage | requirements | design | implementation | end-to-end |
|---|---|---|---|---|
| 3 Run each phase | as intended | as intended | as intended | as intended |
| 4 Evidence and review | broke | broke | broke | broke |
| 5a The floor | as intended | as intended | as intended | as intended |
| 5b Declared policies | not reached | not reached | not reached | not reached |
| 6 The product | not reached (no product yet) | not reached (no product yet) | as intended | as intended |
| 7 Completion | broke (`REG-F-511`) | broke (`REG-F-511`) | broke (`REG-F-511`) | broke (`REG-F-511`) |
| 8 The record | broke (`REG-F-351`) | broke (`REG-F-351`) | broke (`REG-F-351`) | broke (`REG-F-351`) |

| Whole run | |
|---|---|
| 1 Build and publish | not measured in this half (half B, P7-7) |
| 2 Create the Undertaking | as intended |
| 7 Completion | broke (`REG-F-511`): the root completed and was signed off; no phase did |

- **Stage 4's ids by phase:**
  - requirements: `REG-F-549`, `REG-F-519`, `REG-F-518`, `REG-F-548`;
  - design and implementation: `REG-F-549`;
  - end-to-end: `REG-F-549`, `REG-F-550`, `REG-F-551`, `REG-F-486`.
- **Stage 5a reads "as intended" because the floor did what it is written to do:** it refused every completion it could not assure.
- **Stage 8.** 11 exchanges kept no bytes of what was answered: the executor's malformed requirements answer, and 10 reviewer replies that did not parse (3 empty, 7 prose). So a person cannot read what the reviewer said (`REG-F-351`). The run report's own tool marked these cells "unregistered", a gap in its mapping, recorded at `REG-F-351`.
- **A "Yes" also always states** `REG-F-510` (the PWA had to name its product) and `REG-F-523` (the declared policies are signed off with no criterion checked).

## 2. What each phase did

| Phase | Minutes | Tries | Commands | What it produced | How it stopped |
|---|---|---|---|---|---|
| root | under 1 | 0 | 0 | nothing, by design | completed; signed off last, SATISFIED |
| requirements | 10 | 1 | 4 | `docs/requirements.md` | its answer failed the output contract; the work-product review got no reply; all 4 command reviews refused |
| design | 7 | 1 | 3 | `docs/design.md` (14 KB) | the work-product review answered in prose, twice; the 3 command reviews SATISFIED |
| implementation | 10 | 1 | 4 | `bin/wordfreq.js`, 5 modules in `src/`, 5 unit-test files; `node --test` passed 23 tests | the work-product review answered in prose, twice; the 4 command reviews SATISFIED |
| end-to-end | 22 | 1 | 12 | `test/e2e/wordfreq.test.js` (18 tests), `docs/verification.md`; the full suite, 41 tests, passing | the work-product review answered in prose, twice; 1 command review refused, 2 hit the output limit, 1 inconclusive, 8 SATISFIED |

Each phase had one try. A review that fails to execute gives no findings to send back, so the repair loop never asked the executor again.

## 3. The breaks, in the order the run hit them

1. **Before the run: the paid runs' worktree could not be used.**
   - A cold Vite cache lost P7-3a's first click to the designer, and its spec then waited out 62 minutes (`REG-F-546`); no model was called.
   - In that worktree devin refused every review as an untrusted workspace (`REG-F-547`). The cost was one executor call.
   - Both were worked around by design §6 D12 and D13. P7-3a then passed: one try, one reviewer call, the floor SATISFIED.
2. **Requirements: the executor's answer failed the output contract** (`REG-F-519`, K9). The account was recorded as not declared, and each command review then faulted the missing account (RR-02, RR-09).
3. **Requirements: a check raced the write** (`REG-F-518`, K10). The phase's existence check of `docs/requirements.md` printed `<missing>`, because it ran beside the `write_file` in the same message. The review refused the command as "the delegated deliverable is absent". The file exists.
4. **Requirements: the reviewer read the wrong folder** (`REG-F-548`). That same verdict says *"a check of the product workspace finds no docs directory and no requirements.md anywhere in the tree"*. That is true of the server's folder, where devin runs with read-only tools, and false of the product's workspace.
5. **Every phase: the work-product review never answered** (`REG-F-549`).
   - Requirements: two empty replies.
   - Design, implementation and end-to-end: two prose replies each (*"The curren…"*, *"I'll verif…"*), where a JSON object was asked for.
   - Each review ended INCONCLUSIVE, and each phase stopped.
6. **End-to-end: three command reviews hit the model's output limit** (`REG-F-550`). devin printed *"Response truncated: model hit max output token limit"* after 76 to 95 seconds. P7-2b ran each once more: one answered, and two failed the same way, after 97 seconds each.
7. **End-to-end: the same account, opposite verdicts** (`REG-F-551`, `REG-F-486`). Each command was judged against the phase's closing account, *"41 tests passed"*:
   - a passing 40-test run, from before the last test was added, was refused for the mismatch (RR-07);
   - a failing run of the same suite was SATISFIED.
8. **Every phase: stopped for good** (`REG-F-511`, K1). Each is left RUNNING. No page act runs it again; it can only be abandoned.

## 4. The checks against a false "Yes" (P7-4)

| Check | Result |
|---|---|
| a. Acceptance suite (7 cases, written before the run) | 7 of 7 pass on the implementation, end-to-end and final workspaces; 0 of 7 before the code exists, as expected |
| b. Seeded faults | end to end: all 7 deviations from the brief caught; on the model's own code, 62 of 74 mutations caught, 11 survived, 1 timed out. Unit tests: 56 caught, 8 survived, 10 timed out |
| c. Spawn check | SPAWNS: all 18 end-to-end tests start the real tool, and each fails against a stub |
| d. Per-command re-runs | 5 `node --test` commands re-run on their unit's archive: 4 agree with the record and 1 disagrees, an earlier run of a suite later changed; 17 commands are not test runs and are not re-run |
| e. Negative control (`RPH-EVD-004`) | REJECTED both times, under RR-03, RR-04, RR-06 and RR-09, as predicted; 2 reviewer calls |
| f. Adjudication | §5 |
| g. Declared verdicts | 2 of 14 issued, both the root's, each vacuous by construction; no phase completed, so the other 12 were never asked for |

## 5. Every review, classified (P7-4f)

27 reviews: 4 of work products and 23 of commands. Each is judged against its ground truth: the command's exit and output, the files in the archive, and the account it was given.

| Classification | Reviews | Which |
|---|---|---|
| Reviewer right | 14 | design 3 commands, implementation 4, end-to-end 7 (SATISFIED, each consistent with its run and the product) |
| Malformed reply | 5 | the 4 work-product reviews (`REG-F-549`); 1 end-to-end command review that concluded nothing with no criterion failed |
| Output limit | 2 | end-to-end command reviews (`REG-F-550`) |
| Join defect | 5 | requirements: 4, each faulting the account the executor's malformed answer never declared (`REG-F-519`), and 2 of them also a check that raced the write (`REG-F-518`); end-to-end: the 40-test run judged against the final account (`REG-F-486`) |
| Reviewer wrong | 1 | the end-to-end failing run judged SATISFIED against an account saying the suite passed (`REG-F-551`) |

One requirements verdict also reported what the reviewer found in its own folder (`REG-F-548`). It is counted once, as a join defect.

## 6. Spend

| Step | Executor calls | Reviewer calls recorded |
|---|---|---|
| P7-3a, attempt 1 | 0 | 0 |
| P7-3a, attempt 2 | 1 | 2, both refused by devin before any model was called |
| P7-3a, attempt 3 | 1 | 1 |
| P7-3 | 4 | 36 (5 no response, 3 retries, 6 repairs) |
| P7-4e | 0 | 2 |
| **Total** | **6** | **41 of the 150 approved** |

## 7. The fixes proposed (P7-6), in the order the run hit them

Each goes design, roadmap, code, and names the test that must fail first. P7-4's checks are frozen and run again after each.

1. **Isolate the reviewer** (`REG-F-548`, `REG-F-547`).
   - Run devin in the adapter's own empty temporary folder, so its read-only tools see nothing but the prompt.
   - Pass `--respect-workspace-trust false` there, as devin's help gives for print mode.
   - The readiness check reads devin's trust list.
2. **Keep the reviewer's reply when it does not parse** (`REG-F-351`), so stage 8 can be read and the next failure diagnosed.
3. **Re-measure the reviewer on live-size work products** (`REG-F-549`). The qualification measured process results; the reviews that failed were work products of up to 14 KB.
4. **Treat each reviewer failure by its cause** (`REG-F-550`, `REG-F-547`). An untrusted workspace never recovers, so it is not retried. An output limit recovered once in three; the remedy is a reviewer that answers within its limit, not more retries.
5. **Join each command's review to its own state**, not the closing account (`REG-F-486`, `REG-F-551`), and run one message's commands in order (`REG-F-518`).
6. **The recovery of a stopped unit** (`REG-F-511`), after your decision on `REG-D-091`.
7. **The one-unit spec** reaches the designer by URL and bounds its waits (`REG-F-546`).

## 8. What this run does not show

- **Authoring (half B, P7-7).** The PWA was typed by the operator, so the authoring floor and the publish gate were not measured.
- **The declared policies.** No phase completed, so 12 of the 14 declared verdicts were never issued. Those that are issued check no criterion (`REG-F-523`).
- **The reviewer, once isolated.** Every reviewer result here comes from an agent that could read this repository. Whether that also touched JAN-PRQUAL's qualification, which ran the same way, is open (`REG-F-548`).
