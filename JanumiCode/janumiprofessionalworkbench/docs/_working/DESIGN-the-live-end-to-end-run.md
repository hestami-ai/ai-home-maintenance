# DESIGN — JAN-EXEC Phase 7: the live end-to-end run

**Programme:** `JAN-EXEC` Phase 7 (`ROADMAP-undertaking-execution-sandbox.md` §9, where Phase 7 is one paragraph).
**Status:** DESIGN rev 2. ~~Awaiting the sponsor's answers to §9.~~ The sponsor answered §9 on 2026-10-09, all six as recommended (`REG-D-102`). ⭑ Half A ran on 2026-10-10. Its report is `REPORT-the-live-end-to-end-run.md`: the execution works, and the review does not (`REG-F-548` to `REG-F-551`).
**Date:** 2026-10-09.
**Records:** the go-ahead is `REG-D-100`; the delegated calls are `REG-D-101`; the findings are `REG-F-502` to `REG-F-537`. All are filed with this design.
**Evidence:**
- five read-only stage maps, one register sweep and the verification of 40 candidate findings;
- revision 1 attacked by three critics: feasibility, assurance and sponsor-fit, with 5 BLOCKER and 29 MAJOR issues between them, each answered here;
- all on the tree of `a2d88db6`, with no model call.

## In one screen

- **Your question** (2026-10-09): *"after a PWA and it's PWUs are built and published is an undertaking able to execute as intended?"*
- **The run.**
  - We publish the PWA of §3.2: a root and four phases (requirements, design, implementation with unit tests, end-to-end tests).
  - An Undertaking of it then builds a small command-line tool with live models. Pi, the executing agent, does the work. GLM, your selected reviewer, reviews each phase's work and its commands, the first 32 per phase.
  - A script types the PWA into the designer as the operator. So the engine records a human author and runs no AI review of the PWA; your approval of §3.2 is what makes that record true.
- **Expected from the code, before any run: not yet.**
  - **A phase that stops once can never be run again, only abandoned.** The register says otherwise (`REG-F-474`), and your `REG-D-091` choice assumed a re-run exists. A free test checks this before anything is paid. If it holds, `REG-D-091` comes back to you.
  - **Each command is reviewed after its phase ends, against the phase's closing summary.** So an ordinary "test fails, fix, test passes" may be judged a contradiction. The likeliest stop is implementation. Design is at risk too, because reading the requirements is itself a reviewed command.
- **Known gaps, worked around and reported.**
  - An Undertaking cannot tell its phases what to build, so this PWA names the product.
  - The declared assurance policies are signed off by a built-in step that checks none of their criteria.
  - A "Yes" will state both.
- **Checks against a false "Yes".** These are written before the run and run on the archived workspace:
  - an acceptance suite we write from the brief;
  - deliberately broken copies of the code that the model's own tests must catch;
  - a negative control the reviewer must refuse.
- **The plan.**
  - First, free rehearsals, then the run's own lane with its archive.
  - Then one paid run within your limit, and our own checks.
  - Then the report, fixes, and re-runs, each of which comes back to you.
  - The paid run itself is expected to take 1 to 3 hours, unattended. The rehearsals and the lane are built first.
  - Every break is registered: 36 new findings are filed with this design, and 90 open register entries bear on the run, 11 of them blocking under some condition.
- **Six decisions (§9),** each with a recommendation and its cost.

## 1. The question, and the answer the run must give

The sponsor, 2026-09-14: *"a broad and deep end to end test where we start with giving the PWA authoring agent the task of creating a PWA something similar to the JanumiCode v2 product realization lens phases and sub-phases and equivalents of assurance policies to then have that PWA execute as an undertaking to build say a simple product with all of the expected engineering aspects like unit and end to end testing"*.
Restated 2026-10-09: *"after a PWA and it's PWUs are built and published is an undertaking able to execute as intended?"*
The roadmap's rule for Phase 7: *"Report what breaks; do not smooth it."*

**The answer is a matrix, not a word.** Each cell is one phase at one stage of §2, and holds exactly one of these values:
- **as intended**;
- **broke** (with its register id);
- **not reached**;
- **vacuous by construction** (with its id): the cell could not have failed;
- **not measured in this half**.

A headline "Yes" may count only cells that could have failed. A "Yes" always states the two gaps no Phase 7 run can close: the PWA had to name its product (`REG-F-510`), and the declared policies were signed off with no criterion checked (`REG-F-523`).

## 2. What "as intended" means, stage by stage

For each stage: what the roadmap intends, what HEAD can do, and the gap.

| # | Stage | Intended | At HEAD | Gap |
|---|---|---|---|---|
| 1 | Build and publish | the PWA is PUBLISHED, and its authoring is assured | a person-authored PWA publishes with no authoring floor (`packages/rph-application/src/handlers/pwa-authoring.ts:1072`; `floor-gate.ts:280`) | authoring floor not measured in half A; it is P7-7 |
| 2 | Create the Undertaking | one work unit per mandatory type | built in one batch from the PWA's mandatory tree | conditional children are never offered (`REG-F-516`) |
| 3 | Run each phase | the phase is told the product, does the work, and a review's findings reach its next try | the prompt carries the type's own text only, and the try loop sends the reasoning review's findings back | no phase is told the product (`REG-F-510`); a deterministic floor finding is not sent back (`REG-F-515`) |
| 4 | Evidence and review | every command becomes evidence, reviewed | only the first 32 commands per phase; each reviewed once, after the tries, against the last account (`REG-F-485`, `REG-F-486`); the selected reviewer was not qualified on these case shapes | runs past 32 unreviewed (`REG-F-517`); reviews never repaired (`REG-F-520`) |
| 5a | The floor | a phase completes only when its three automatic checks (well-formed, attributed, GLM's reasoning review) pass for the work product and for each command | holds as written | the failure of any one check ends the phase (K1, K2) |
| 5b | Declared policies | *"the declared assurance policies gate it"* | a built-in step signs off 14 policy verdicts, checking no criterion; nothing declared gates completion (`R20`) | **vacuous by construction** (`REG-F-523`, `REG-F-406`) |
| 6 | The product | it does what the brief asks, and its own tests would catch it failing | nothing in the product checks this | our checks in P7-4 |
| 7 | Completion | the Undertaking completes | the Undertaking has no completion state (`ACTIVE`, `MIGRATING`, `ARCHIVED`: `packages/rph-contracts/src/objects.ts:874-885`) | measured instead as: every work unit, the root included, SATISFIED in lifecycle and assurance, and every unit's plan step SUCCEEDED (`REG-F-533`) |
| 8 | The record | a person can read what each model was asked and answered, and what each reviewer said | the bytes are readable only from the ~~content database~~ ⭑ stores: the content store holds them, and the record store says whose they are (`REG-F-528`); every declared verdict names the operator as producer, under a credential typed HUMAN that a script operates (`REG-F-514`) | the report states both |

**Stage 8's pairing rule.** An exchange whose `subjectObjectId` is the assessment's subject, with the highest `attemptOrdinal`, is the answer that concluded it. This holds only while each subject has exactly one floor run (`REG-F-433`). The report checks that condition, and lists any assessment with no exchange as "no answer recorded" (`REG-F-525`). ⭑ Scoped by D9 (2026-10-09): the rule covers reasoning-review assessments only, the only ones with exchanges. Since P7-2b the concluding record may also be a `NO_RESPONSE` (both calls threw) or a refusal, and the report names each.

## 3. The scenario

### 3.1 The product

`wordfreq`, a Node.js command-line tool with no dependencies.
- It reads text from a file or standard input and prints the N most frequent words.
- Its options are N, case folding and a stop-word list. Bad input exits with defined codes.
- Unit tests run with `node --test`. End-to-end tests start the real tool as a child process (`process.execPath`).

**The acceptance cases** are written now, from this brief alone, and committed before the run (P7-4a):
1. a file;
2. standard input;
3. N;
4. case folding;
5. a stop-word list;
6. an unknown option's exit code;
7. a missing file's exit code.

**Why no dependencies.**
- On this host the runner refuses `npm`, `npx` and `pnpm` as spelled, because they are `.cmd` shims (`apps/rph-demo/src/lib/server/execution/child-process-runner.ts:497-531`).
- An install is reachable only through an interpreter (R13), and it must finish within 120 s a command.
- So this run has no build step. `R5` asks for "a real build", and decision §9.3 puts that to the sponsor.

### 3.2 The PWA: *CLI Product Realization*

Every non-root type declares exactly its kind's ontology default policies. The root departs from its defaults only as §3.3 records.

| Type | Kind | Discharge | Its prompt asks for | Policies |
|---|---|---|---|---|
| CLI Product Realization (root) | `PRODUCT_REALIZATION` | HUMAN | (none) | `pol_intent_preservation`, `pol_fitness_for_purpose` |
| Requirements (M1) | `REQUIREMENT_DEFINITION` | MODEL | `docs/requirements.md`: numbered requirements, acceptance criteria, usage, exit codes, end-to-end scenarios | `pol_requirement_coverage`, `pol_intent_preservation` |
| Design (M1) | `ARCHITECTURE_DEFINITION` | MODEL | reads the requirements; `docs/design.md`: modules, signatures, errors, a requirement-to-test map | `pol_assumption_disclosure`, `pol_decomposition_coverage`, `pol_architecture_coverage`, `pol_intent_preservation` |
| Implementation and unit tests (M1) | `PRODUCT_IMPLEMENTATION` | MODEL | `src/*.js`, `test/unit/*.test.js`; runs `node --test` | `pol_assumption_disclosure`, `pol_test_adequacy`, `pol_intent_preservation` |
| End-to-end verification (M1) | `INTEGRATED_PRODUCT_VALIDATION` | MODEL | `test/e2e/*.test.js` running the real tool; runs the whole suite; `docs/verification.md` mapping each requirement to its test and result | `pol_fitness_for_purpose`, `pol_test_adequacy`, `pol_intent_preservation` |

**The prompts.**
- Each prompt carries the same short product brief and the file conventions. The rendered instruction stays under 4,000 characters, because the reviewer sees only that much.
- **Markers.** A prompt uses only the markers a work unit fills: `{subject}` (the unit's title), `{title}`, `{description}` and `{purpose}`.
  - `{statement}` is never filled, and any other marker refuses the step at render (`packages/rph-application/src/execution-invocation.ts:103`, `:203-209`; `REG-F-507`).
  - So every type has a non-empty purpose, and no prompt holds a code snippet with braces.
- **The work product carries the deliverable.** It includes:
  - the documents in full;
  - `src/` and the tests, where they fit the reviewer's 24,000-character content budget;
  - each file's SHA-256;
  - every command run, with its exit code.
- **Why the deliverable goes in the work product.** Otherwise the only model review of a phase would judge a list of file names (`REG-F-522`). P7-4 checks the hashes against the archived files.
- **The root's own run.** The operator runs Begin & Execute on the root (no model, no output), then signs the root off last.

### 3.3 Where this PWA departs from a generic one, and why

| Departure | Avoids | Left unmeasured |
|---|---|---|
| The prompts name the product | `REG-F-510` (no phase is told its Undertaking's objective) | whether a generic PWA can build a named product |
| The root drops `pol_intent_fidelity` | its seven required-evidence items, three of them mandatory: with none produced, the root could never turn green (`REG-F-403`, `REG-F-308`) | intent fidelity at the root |
| The root drops `pol_baseline_promotion` | nothing: it applies only to `PRODUCT_BASELINE_PROMOTION` | — |
| No dependencies, no build | the `.cmd` refusal on this host (`REG-F-534`) | `R5`'s "a real build"; package installs (`REG-F-486`'s install case) |
| The deliverable is carried in the work product | a review of file names only (`REG-F-522`) | — (a reviewer now sees the code) |

**The prompts' line between a good PWA and smoothing.** They say what a competent author of this PWA would say: the product, where files go, the toolchain this host offers, and the shape of the answer. They say nothing whose only purpose is to dodge a known defect: nothing like "never run a failing test" or "do not read files".

## 4. The route

**Half A, the execution question (this design).**
- A new live spec types §3.2's PWA into the designer, as the operator, and publishes it.
- It then creates the Undertaking and runs it. All of this happens in one server-mode process with a fresh database (`RPH_DEMO_MODE=server`, `JPWB_HARNESS=1`, seeded empty), as `apps/rph-demo/e2e-live-exec/execution.live.ts` does for one type.
- No model is called before execution.

**What half A leaves unmeasured, stated so a "Yes" is not read wider.** A "Yes" from half A is about a person-authored, product-specific PWA. It leaves out:
- the authoring floor and the publish gate;
- accepting a candidate under a real reviewer;
- the authoring traps a person avoids by construction (`REG-F-502`, `REG-F-505`, `REG-F-507`, `REG-F-508`);
- what the authoring reviewer cannot see (`REG-F-503`).

**Half B, the authoring question (P7-7).**
- **When:** after half A's first report.
- **History:** a live authoring run of the sponsor's own prompt reached PUBLISHED once, on 2026-09-14 (design §1). The authoring floor and its records have changed since (`REG-F-425`, `REG-D-070`), and no live run has reached PUBLISHED since. Today's live authoring specs cannot pass (`REG-F-506`).
- **Its request is written now,** in P7-7. It names the product and the engineering phases, but not the types, kinds, policies or markers. A request that dictated those would measure transcription, not authoring.

## 5. Breaks predicted before the run

These are read from code at `a2d88db6`. Most are not yet driven. Every one has a register id.

| | Predicted break | How it stops a phase | Register |
|---|---|---|---|
| K1 | A phase that stops can never be run again, only abandoned. It stops on any of: a refused or escalated review, a provider error, a timed-out command. Begin & Execute is offered only on a PROPOSED unit; Retry only re-queues the step (`apps/rph-demo/src/routes/undertakings/[id]/+page.svelte:228-232`; `+page.server.ts:1723-1729`). | always | `REG-F-511`; corrects `REG-F-474` and `REG-D-090`, the premise of `REG-D-091` |
| K2r | **Blocks by rule:** a timed-out command, a reviewer call that throws ⭑ twice, or at its tool's bound (P7-2b), an INCONCLUSIVE or MISSING_CRITERION reply, an ESCALATED recommendation. | by rule | `REG-F-499`, `REG-F-489`, `REG-F-474`, `REG-F-520`, `REG-F-525` |
| K2j | **Blocks only if GLM faults it (inferred):** a fail-then-fix test loop judged against the final account; a command that only reads a file. | by GLM's judgement | `REG-F-485`, `REG-F-486` |
| K3 | Phases are neither ordered nor connected. Files in the shared workspace carry the hand-off, and reading them is a reviewed command (K2j). | indirectly | `REG-F-358` (corrected) |
| K4 | Files one phase writes (`AGENTS.md`, `CLAUDE.md`, `.pi/`) become part of later phases' system prompt or code. | unseen | `REG-F-512` |
| K5 | A phase's commands after its 32nd become no evidence and get no review. | unseen | `REG-F-517` |
| K6 | The lane drives one unit, and its spec never asserts that the step completed, so a copy would pass with the step refused. Its wait leaves out the command reviews, and a timeout kills the server mid-unit. The record under `%TEMP%` is lost. | the run's machinery | `REG-F-526`, `REG-F-527` |
| K7 | Live authoring: the specs cannot pass, and the agent is never taught discharge or prompts. A hand edit after acceptance wedges publishing. The existing live authoring lane runs in test mode: its store is in memory and cannot feed execution, its stand-in reviewer leaves every candidate INCONCLUSIVE, its waits are shorter than one turn under GLM, and its spec resets the engine, which a durable store refuses. So half B needs a lane of its own. | half B | `REG-F-502`, `REG-F-505`, `REG-F-506` |
| K8 | Declared policies are signed off without a criterion checked. A unit-tests-only fitness claim is caught only by GLM. | vacuous, not a stop | `REG-F-523`, `REG-F-406` |
| K9 | Narration outside the final JSON drops the account, for the work-product review and for every command's review. | likely K2r | `REG-F-519` |
| K10 | Pi runs one message's tool calls in parallel, so a test can run before its files are written. | feeds K2j | `REG-F-518` |
| K11 | Nothing stops two units of one Undertaking executing at once in the shared workspace. The run starts each phase only after the one before has returned. | avoided by the run | `REG-F-535` |

## 6. The procedure

This design's own steps for the roadmap's Phase 7.

- **P7-0, with this design: register what the mapping found** (§7).
- **P7-1a, a free route test.**
  - **Where:** a vitest test on the arrangement `begin-execute-escalated-review.test.ts` uses: test mode, the fixture executor, devin's real print on a scripted exec seam, and scripted process runs the route joins as evidence.
  - **What it drives, at no cost:**
    - K1: a scripted reviewer that fails once leaves a unit no page action can complete, and Retry runs nothing;
    - K2r: a timed-out run, and a malformed reply;
    - K5: 33 runs;
    - P7-2b's red, if it is chosen.
  - It is a characterization test: it names the register ids it pins, and is never cited as evidence for stages 3 to 5.
- **P7-1b, a free gate spec.**
  - **Where:** the deterministic Playwright lane (test mode, the stand-in reviewer).
  - **What it drives:** the five-unit Undertaking through creation, Begin & Execute on all five, sign-off and the end state, plus a second PWA left unstipulated for K1's refused-review arm.
  - **What it predicts and checks:**
    - whether the root can be signed off while a child is stuck;
    - whether a root that produced nothing turns green;
    - whether `completeStep` with no output closes a step.
- **P7-2, the run's lane.**
  - **Invocation:** a new spec, `apps/rph-demo/e2e-live-exec/phase7.live.ts`, run alone with `bun run e2e:live-exec -- e2e-live-exec/phase7.live.ts`.
  - **Its run folder** comes from `JPWB_LIVE_RUN_DIR`, set before Playwright starts, because the config is loaded again in its worker. The spec asserts that `<dir>/demo.sqlite` exists.
  - **Its wait per unit** is stated in `lane-config.ts` as a `PHASE7` budget: ~~3 × (240 + 2 × 240) s, plus 32 × 2 × 240 s of command reviews, plus 32 × 120 s of commands. That is about 6 h, the worst case.~~ With P7-2b's retries a review is up to 4 calls (2026-10-09): 3 × (240 + 4 × 240) s, plus 32 × 4 × 240 s of command reviews, plus 32 × 120 s of commands, about 10.6 h, ~~the worst case~~ ⭑ an allowance, not a worst case: the executor's turn has no bound, and the commands past the 32nd still run, uncounted (`REG-F-521`; round 2's code map, 2026-10-09). The verif test that pins `lane-config.ts` is extended to it.
  - **At boot** it records the `JPWB_*` and `RPH_*` environment, asserts that `JPWB_REVIEW_SEES_PRIOR` and `JPWB_AGENT` are unset, and runs a reviewer readiness check that calls no model.
  - **Each Begin & Execute's** JSON response is saved.
  - **After each unit, it archives:**
    - both SQLite stores, through SQLite's backup;
    - the workspace and its `.process-output` sibling;
    - the introspect dump.
  - **After each unit, it checks:**
    - capture folders against evidence objects (K5); ⭑ a folder with no evidence has other causes too, which D7 names;
    - a ~~workspace~~ scan for `AGENTS.md`, `CLAUDE.md` and `.pi/` (K4) ⭑ where Pi loads them: its agent folder, and the workspace's ancestors and root (D7; `REG-F-512`);
    - each EXECUTION exchange's parse outcome (K9);
    - the SHA-256 of `src/`, `test/` and `docs/`;
    - the reviewer calls used so far;
    - before any summary is committed, a scan of the archive for the account name and absolute paths (`REG-F-536`).
  - **After teardown**, a final copy of the whole run folder is taken.
  - **A run-report builder** reads both stores, read-only. It is a deliverable with its own red.
  - **The spec's deterministic part** is proven first, stopping before the first ~~Begin & Execute~~ ⭑ model-run Begin & Execute, with no model call. The root's Begin & Execute runs no model, so the dry run also proves one press, its saved response and one archive-and-check cycle, at no cost (D5 below).
- **P7-2's build decisions** (2026-10-09, under `REG-D-101`'s delegation). They come from a read-only map of the code on round 1's tree, by five mappers and a critic.
  - **D1, paid only on request.** The spec is dry unless `JPWB_PHASE7_PAID=1`. The config collects `phase7.live.ts` only when `JPWB_LIVE_RUN_DIR` is set, and `execution.live.ts` only when it is not. So the two specs never share a server or a store: an unfiltered run collected both, and each counts the PWA picker.
  - **D2, the run folder.** `JPWB_LIVE_RUN_DIR` must be absolute and must exist. It must lie outside the repository and the temporary folder (`REG-F-526`), hold no store yet, and have no `AGENTS.md`, `CLAUDE.md`, `.pi/` or `.agents/` in it or in any ancestor.
    - The config refuses otherwise, in the runner's load only: the worker loads the config again, after the server has made the store.
    - A dry run and the paid run never share a folder: a store is seeded only when empty, and command ids restart at each boot.
  - **D3, at boot.**
    - `laneKeysRefusal` also refuses a set `JPWB_REVIEW_SEES_PRIOR` or `JPWB_AGENT`, before the server starts.
    - The spec records the inherited `JPWB_*`, `RPH_*` and `PI_*` variables and the config's overlay.
    - The readiness check runs `devin --version` and `devin models list`, and requires the configured model in the list. No model is called. Nothing checks Pi before its first turn.
  - **D4, the wait.**
    - `lane-config.ts` derives the per-unit allowance (38,160 s) from `LANE_BUDGET` by reference.
    - It also gives the spec's own test timeout: four units' allowance plus 30 minutes for typing, publishing, sign-offs and archives.
    - A unit that outlasts its allowance ends the run there. The next unit is never started beside it (`REG-F-535`, `REG-F-527`).
  - **D5, the order.**
    - One test: Begin & Execute on the root, then on each phase in order; then sign-off of each phase that completed, and of the root last.
    - A stopped phase is left as found, and the later phases still run. The run's own record notes that each later phase's upstream was not assured; the store has no such field.
    - The spec reads engine state after every act (`REG-F-540`), and saves each action's status and raw body.
    - It logs every POST it makes, because the stores keep accepted acts only.
  - **D6, the archive.**
    - After each unit, it keeps:
      - both stores, through SQLite's backup, each copy converted to a rollback journal so that a read-only open writes nothing beside it;
      - the workspace and `.process-output`, copied byte for byte. Neither exists until the first model unit, and `.process-output` is one per Undertaking;
      - the introspect dump.
    - After Playwright exits, the operator copies the whole run folder, `-wal` and `-shm` files included.
  - **D7, the checks.**
    - K4 is checked as Pi loads: its agent folder, every ancestor of the workspace and the workspace root. Each executor input is also searched for the context markers Pi writes.
    - K5 lists the capture folders a unit added against its evidence, and names the other causes of a folder with no evidence.
    - K9 reads each execution exchange's parse outcome, with its detail.
    - Hashes are kept per file and per folder for `src/`, `test/` and `docs/`, and for the whole workspace, as the manifest uses.
  - **D8, the limit.**
    - Before each phase, three counts must total under 150: the reviewer calls already spent (P7-3a's, given by the operator), those recorded in this run, and 4 held for P7-4e.
    - A phase started under the limit can overshoot it by its own worst case, 140 calls. The sponsor's check is between phases (`REG-D-102` (4)).
    - The recorded count is a lower bound.
  - **D9, the report.** `scripts/phase7/run-report.ts` reads the archived stores read-only. It writes:
    - the stage matrix, the pairing check, the adjudication table's rows and the forbidden-act audit;
    - the manifest for the per-command re-runs.
    - **The pairing (stage 8)** covers reasoning-review assessments only. An assessment's answer is its subject's highest-ordinal exchange, reported as one of:
      - answered;
      - no response (both calls threw);
      - refused (a substitute, or a failed repair);
      - no answer recorded.
      A subject with more than one floor run is reported as not pairable (`REG-F-433`).
    - **The audit:** a hand completion is any step success that is not one of Begin & Execute's two shapes.
    - **The manifest** holds the commands that were recorded. Runs past the 32nd are counted, not listed (`REG-F-517`).
    - The report's own output is scanned for the account name and absolute paths before it is written (`REG-F-536`).
  - **D10, the one-unit lane.** `execution.live.ts` reads its reviewer's identity from the first call that answered, not from the first record. Since P7-2b, a recovered throw leaves a `NO_RESPONSE` record first.
  - **D13, the paid runs run from the main checkout** (2026-10-10, under the same delegation, after P7-3a's second attempt).
    - devin refuses to review in a folder it has not been told to trust, and on this host it trusts the main checkout only. So in the paid runs' worktree every reviewer call was refused locally (`REG-F-547`).
    - The main checkout is used at the named commit, with no code edited while a run is going; its only other files are another agent's design drafts.
    - P7-3a, run there, passed: one executor try, one reviewer call, the floor SATISFIED.
  - **D12, the run tree is warmed first** (2026-10-10, under the same delegation, after P7-3a's first attempt). A free dry run runs once in the paid runs' tree before each paid run. On a fresh tree, Vite optimises the dependencies a route first imports and then reloads the page. P7-3a's first attempt lost its click to the new PWA that way, then waited out its 62-minute timeout; no model was called (`REG-F-546`).
  - **D11, the dry run signs off the root** (2026-10-10, under the same delegation). After the root's Begin & Execute and its archive, the dry run signs off the root and takes the final archive, then stops. Signing off calls no model, and otherwise the sign-off path and the final archive would first run in the paid run.
- **P7-2 as built (round 2, 2026-10-10).** Three builders, two adversarial verifiers each and a fixer each. Where the build departs from D1 to D10, or adds to them:
  - **The run folder (D2)** is refused inside any git working tree, the main checkout and every worktree included. The repository's own tree alone is not enough, because P7-3 runs from a worktree.
  - **D1 is closed both ways.** `JPWB_PHASE7_PAID` or `JPWB_PHASE7_PRIOR_REVIEWER_CALLS` without a run folder is refused, rather than running the paid one-unit spec.
  - **The one-unit lane prints its reviewer calls,** so P7-3a's count can be given to D8.
  - **The worker reuses the runner's store** rather than minting a second folder (`REG-F-526`'s pairs).
  - **The run's order lives in the operator** (`runTheLane`), so verif drives it on stand-in hands. Two ends are added: `request-failed`, for a POST that fails in transit, and `lane-error`, for a throw.
  - **K4 also reads** the agent folder's `APPEND_SYSTEM.md` and `extensions/`, which Pi loads under the executor's override.
  - **Readiness refuses any reviewer but devin,** as a rule of this lane.
  - **A per-unit archive that throws still ends the run.** This is kept, and is a known risk.
  - **D11 is built.** The dry run signs off the root through the paid run's own steps and takes `06-final`. Its verdict requires both acts accepted, and the root SATISFIED in lifecycle and assurance.
  - **The account name the report's scan looks for (D9) is taken from every source:**
    - the user record's name, and the last segment of its home folder;
    - `USERPROFILE` and `USERNAME`.
    - The scan never looks for `unknown`. Bun 1.3.14 on Windows gives that as the user record's name when `USERNAME` is unset, and turbo's default env mode unsets it for the gate's tests.
    - When no name can be found, the report refuses to write, rather than scanning for nothing (`REG-F-545`).
  - **The first dry run passed (2026-10-10, 26 s, no model called).**
    - The readiness check found devin 3000.11.3, with `glm-5-3-flash-max` in its model list.
    - The root's press and sign-off were accepted, and both archives were taken. K4 checked 4 ancestors and found nothing.
    - The final copy and the report ran on the folder.
  - **The report** leaves two kinds of cell open, owed to a person: stage 6 (to P7-4a to c), and stage 4 where a reviewer concluded against the work (to P7-4f). A break with no register id is marked unregistered, owed to P7-5. An argument naming the account or an absolute path is replaced, and its command is listed apart from the manifest.
- **P7-2b, only if chosen in §9.2.**
  - **The rule:** a devin call that throws before its 240 s bound, with no reply, is run once more (the qualification's own rule, `JAN-PRQUAL` design §7.3); a second throw counts.
  - **Where it sits:** in the validator's `timed`, once, before its rethrow (`apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.ts:955-962`).
  - **What it records:** the failed call as `NO_RESPONSE`, and its successor with role `RETRY`; the contract already has both (`packages/rph-contracts/src/objects.ts:1003`, `:1025`). The cause devin printed is carried, sanitised (`REG-F-499`'s first remedy).
  - **Its tests,** each with a mutant it must catch:
    - throw, then answer: SATISFIED, with two exchanges;
    - throw twice: INCONCLUSIVE, with two `NO_RESPONSE` exchanges;
    - a substituted model is not retried;
    - a malformed reply still takes the repair path.
  - **Its budget:** `LANE_BUDGET` is re-sized to 4 calls per review.
  - **The report** then reads "HEAD plus P7-2b".
- **P7-3a, a small live check (paid, within the limit).** The existing one-unit lane at HEAD: one executor try and one or two reviewer calls. A break in the review path then shows apart from the multi-phase scenario.
- **P7-3, the measured run (paid, within the limit).**
  - **Its tree:** a clean worktree at a named commit, with no edits during the run.
  - **After a phase stops,** the later phases still run, in order, each recorded as "its upstream phase was not assured". The limit is checked before each phase.
  - **Forbidden during the run,** and confirmed from the event log afterwards: `completeStep`, `skipStep`, `retryStep`, waivers, Mark Satisfied without Record Assurance, and Abandon followed by re-proposing.
- **P7-4, our checks.** Each is written and committed before P7-3, with its predicted result.
  - **a. The acceptance suite** of §3.1, kept outside the workspace and run on each phase's archived copy.
  - **b. Seeded faults:** a fixed list of hand-made faults in `src/` (a wrong N, case folding off, a wrong exit code, a broken entry point). Each must make the model's own suite fail. The report says how many each suite catches.
  - **c. Spawn check:** do the end-to-end tests really start the tool?
  - **d. Per-command re-runs:** each command's evidence verdict compared with our re-run of the same argv, run with `node --test --test-timeout` and the runner's environment allowlist.
  - **e. An `RPH-EVD-004` negative control:**
    - **The case:** one crafted process-result case (a unit-tests-only `node --test` run beside an account that claims full fitness).
    - **How it runs:** through the qualification runner, to the selected reviewer, twice, at no more than 4 reviewer calls.
    - **Expected:** REJECTED under RR-03, RR-04, RR-06 or RR-09.
  - **f. An adjudication table** covering every review, SATISFIED ones included. It gives:
    - the ground truth (exit code and output);
    - what the account said;
    - GLM's verdict and rows;
    - a classification: reviewer right; reviewer wrong; join defect (`REG-F-485`, `REG-F-486`); transport failure (`REG-F-499`); malformed reply (`REG-F-489`, `REG-F-428`, `REG-F-479`).
  - **g.** The 14 declared verdicts, each marked "vacuous by construction".
- **P7-5, the report.** ⭑ Written 2026-10-10: `REPORT-the-live-end-to-end-run.md`.
  - The stage matrix of §1.
  - Every break registered, with its evidence.
  - The fixes proposed, in the order the run hit them.
- **P7-6, fix and run again.**
  - **The order:** each fix goes design, roadmap, code, and names the test that must fail first.
  - **Its effect on assurance:** each design states which check it adds, removes or narrows.
  - **The controls:** the P7-4 controls are frozen and re-run after every fix. A fix that lets a control pass is a regression to register, not progress.
  - **Re-reviewing:** a fix that reviews something again first builds `REG-F-433`'s join key (the `REG-D-070` Q2 order), or mints a new subject.
  - **Paid re-runs:** each one comes back to the sponsor.
- **P7-7, half B.**
  - **The request:** *"Create a PWA for realizing a small command-line product through requirements, design, implementation with unit tests, and end-to-end verification, with the assurance policies each phase needs."*
  - **Then:** the candidate is accepted under the real reviewer, published, and executed as in P7-3.
- **Then Phase 8, the replay.**
  - **The recording** is the archived run that a replay answers from.
  - **What must replay** besides the executor: the reviewer's answers and the commands' results. Otherwise a replay still pays the reviewer and runs real commands (`REG-F-530`).

## 7. Findings

### 7.1 Filed with this design
- `REG-F-502` — a PWA that Validate or Publish refuses can never be fixed or published: the lifecycle has no way back to DRAFT, the graph is first refused after the PWA has left DRAFT, and a floor that a later type edit has made stale reads SATISFIED on the page until Publish refuses it
- `REG-F-503` — the authoring floor's reviewer is not shown a PWA's declared assurance policies, its prompts' text or output contracts, its child cardinalities, or its types' purposes, so it cannot judge them, yet its SATISFIED is bound to a hash that covers them; the person accepting the candidate is not shown the prompts' text either
- `REG-F-504` — a person's acceptance of an agent-authored PWA candidate leaves no record: the commit replays the agent's commands, the floor's assessments among them, under the agent's identity, and nothing names who accepted, when, or which candidate
- `REG-F-505` — the authoring agent's system prompt says each tool commits to the DRAFT at once and that there is no staged preview, untrue since the staged-turn layer and pinned so by its own test; and it never says that a type a model is to run must declare MODEL with an armed prompt
- `REG-F-506` — the two live authoring specs cannot pass: they wait for a canonical conversation, which a staged turn writes only into its fork, and neither accepts, submits, validates or publishes
- `REG-F-507` — no authoring surface says which markers a work unit's prompt may use, and the designer's own example uses `{criteria}`, which nothing supplies, so a prompt modelled on it is refused only when its unit runs
- `REG-F-508` — a PWA publishes with a model-run type whose prompt cannot render (unarmed, absent, or using a marker nothing supplies), and the refusal comes only when a unit is executed, after its step has started, when the PWA can no longer be changed
- `REG-F-509` — a `JPWB_AGENT_MODEL` that Pi cannot resolve is not refused: the authoring agent discards Pi's error and runs the first model with credentials, passing over Pi's configured default, where the executor refuses the same mistake
- `REG-F-510` — A work unit's instruction carries nothing of its Undertaking's objective or intended product: a model step's subject is the unit's id, title and description, which instantiation copies from its type, so two Undertakings of one PWA render the same instruction for the same type
- `REG-F-511` — A model-run work unit that stops can never be run again, only abandoned: Begin & Execute starts only from PROPOSED, Retry only re-queues the step, and both assurance acts are refused while the unit is RUNNING
- `REG-F-512` — The executor's Pi loads `AGENTS.md`, `CLAUDE.md` and `.pi/` files from the Undertaking's shared workspace, so a file one unit writes becomes part of a later unit's system prompt, or code the server process runs, and no reviewer sees it
- `REG-F-513` — The Undertaking page shows no review of a unit whose completion the floor refused, nor of any unit's superseded tries, and shows the refusal itself only once, as a form error: its scope admits a work product or command evidence only through a successful completion
- `REG-F-514` — The declared-policy sign-off records the operator as the producer of a model-executed unit's work, so each declared policy's independence is checked between the reviewer and the operator, never the model that did the work
- `REG-F-515` — A deterministic floor finding that the producer could fix is never sent back to it: when the reasoning review passes and only `WORK_PRODUCT_NOT_PARSEABLE` fails, the classifier answers `RESOLVE_OTHER_FLOOR_FINDINGS` with `autoRefine` false, and the try loop stops after one try
- `REG-F-516` — Instantiation offers its conditional children to no one and cannot add a second instance of an M+ child, and a refused instantiation leaves an empty Undertaking and an approved Intent behind
- `REG-F-517` — a work unit's command runs after its 32nd become no evidence and get no review, the step can still complete, and nothing in the record says a run was left out
- `REG-F-518` — Pi asks the executing model for parallel tool calls and runs one message's calls concurrently, and JPWB's two tools do not ask to run in sequence, so a command can start before a file written in the same message exists
- `REG-F-519` — the executor's answer is all the text the model emits in a tool-using turn, parsed whole as one JSON object, so any text outside the final JSON leaves its account NOT DECLARED for the work product's review and for every command's review
- `REG-F-520` — a command's review runs once, after the repair loop and after the producer is released, so its findings never reach the producer and nothing in the product can repair or re-run it: one refused command review refuses the step
- `REG-F-521` — the execution sandbox's two FILED, NOT FIXED items are filed only in its roadmap: nothing bounds a unit's tool calls, bytes written or wall-clock time (W-2), and a command's output reaches the model and the retained record unredacted (W-3)
- `REG-F-522` — no governed object names or hashes the code an Undertaking delivers, and no reviewer is given it: the execution plane's assurance judges the model's account and its commands' output, not the files
- `REG-F-523` — The sign-off of a work unit's declared assurance policies judges nothing: each verdict is computed from the policy's required-evidence list alone and issued, on the operator's own click, under a host-held credential typed HUMAN, so `pol_test_adequacy` and `pol_fitness_for_purpose` read SATISFIED for any unit, whatever it built — the reading `R25` keeps forbidden
- `REG-F-524` — A work unit whose declared assurance policies all fail to govern it can never be assured: the kernel folds the empty set to UNASSESSED and refuses Record Assurance with a reason that names no policy, the page lists each excluded policy as "REQUIRED — UNASSESSED", and no step before the sign-off warns
- `REG-F-525` — a reviewer call that throws (a devin or agy transport failure, or the tool's 240 s kill) leaves no `MODEL_EXCHANGE` on either plane, while an executor call that throws is recorded `no-response`
- `REG-F-526` — the live-exec lane keeps each run's databases and workspaces in a fresh folder under the OS temp directory, where every file of its ten runs on this host is already deleted, and a copy of a `.sqlite` file alone can miss committed records
- `REG-F-527` — when a live-exec run outlasts its wait, Playwright force-kills the server in the middle of the work unit: the try in flight leaves no record, the unit stays EXECUTING with its step RUNNING, and nothing can run it again
- `REG-F-528` — nothing in the product shows what an executed work unit was asked, what it answered, what its reviewer answered or what its commands printed: those bytes can be read only from the stores themselves, and a unit gives no progress signal while it runs
- `REG-F-529` — a paid run's spend can be neither priced nor fully counted from its record: `MODEL_EXCHANGE` has no usage or cost field though Pi's SDK carries both on every assistant message, and a Pi turn's provider requests are not counted
- `REG-F-530` — `JAN-EXEC` Phase 8 as worded, *"a fourth `ProducerSession` answering from a committed recording"*, cannot replay a Phase 7 run by itself: the run's reviews and command results are outside it, and the test-mode rule it adopts gives a replay no filesystem workspace
- `REG-F-531` — the live lanes pass the operator's whole shell environment to the server, and the live-exec lane's boot check reads only the backend selections: a stray `JPWB_REVIEW_SEES_PRIOR` changes what the reviewer is given, and a stray `JPWB_AGENT` or `JPWB_AGENT_MODEL` changes the authoring agent, with nothing saying so
- `REG-F-532` — the live-exec lane deletes the deterministic gate's review gallery at every start, takes no gallery shot of its own, and keeps no screenshot or trace of a run that passes
- `REG-F-533` — an Undertaking has no state that says its work is done, and nothing moves its status: it is ACTIVE, MIGRATING or ARCHIVED, the domain's one arrow (`archive`) is dispatched by no command, and creation is the only write
- `REG-F-534` — on Windows the executor has no package manager: the runner refuses `npm`, `npx` and `pnpm` as spelled (a deliberate rule against `cmd.exe` re-parsing arguments), so a product with dependencies, a TypeScript build or a browser test cannot be built here, and `R5`'s "a real build" is unreachable on this host
- `REG-F-535` — nothing stops two work units of one Undertaking executing at once in its shared workspace, though the sandbox's containment accepts its one remaining race only because "One Undertaking drives its steps in sequence"
- `REG-F-536` — every executor prompt carries the host's absolute workspace path, which names the operator's account: Pi appends "Current working directory" even when JPWB overrides the system prompt
- `REG-F-537` — the independence check compares the model ids the tools report by exact string, so another spelling of the same model passes as independent; the limit is disclosed only in an operator message

### 7.2 Corrections and pointers made with this design
- `REG-F-474`: corrected in place. On the execution plane a step retry neither executes nor reviews again (`REG-F-511`); `REG-D-090` gains a pointer, and `REG-D-091`'s premise goes back to the sponsor once P7-1 drives it.
- `REG-F-358`: corrected. The cross-unit path it says does not exist yet runs through the shared workspace (`REG-F-512`).
- `REG-F-486`: the executor has no read tool, so every look at a file is a reviewed command.
- `REG-F-403`: *"not green"* is permanent on this surface for a root that declares `pol_intent_fidelity`.
- `REG-F-406`: Phase 7 is designed; its three items are answered by §9.5, stage 5b with §9.6, and P7-4e.
- `REG-F-328`, `REG-F-333`: a reviewer call that throws is captured nowhere (`REG-F-525`). ⭑ Since P7-2b it is recorded `NO_RESPONSE`, and `REG-F-525` is closed (round 1).
- `REG-F-439`, `REG-D-088`, `REG-F-445`: the live-run records they cite are gone from this host (`REG-F-526`).
- `REG-F-457`: the live lanes still pass the whole shell to the server (`REG-F-531`).
- `REG-F-209`: its *"until the review is redone"* holds only while the PWA is DRAFT; after that, the publication wedge (`REG-F-502`).
- `REG-D-099`: restated DELIVERED; its (4) is answered by `REG-D-100`.

### 7.3 Already open, by stage

The register sweep found 90 open entries that bear on the run. 11 can block it under some condition:
- `REG-F-406` (outright);
- `REG-F-486` (likely);
- `REG-F-220`, `REG-F-437`, `REG-F-440`, `REG-F-308`, `REG-F-490` (conditional);
- `REG-F-428`, `REG-F-479`, `REG-F-489`, `REG-F-499` (at random).

The run avoids the conditional ones as follows:
- the Undertaking and its units are created in one server lifetime (`REG-F-220`);
- one host writes the store (`REG-F-437`);
- half A uses no scripted authoring (`REG-F-440`);
- no unit declares `pol_intent_fidelity` or `pol_intent_completeness` (`REG-F-308`).

### 7.4 Every predicted break, accounted for
The stage maps predicted 78 breaks, B01 to B78 (labels local to this design). Each is accounted for exactly once: 44 by a new finding, 15 by an existing entry, 11 by a deliberate rule, and 8 by this design's own run machinery (its K rows). None is left unfiled. Three side issues inside mapped breaks are filed too: `REG-F-535`, `REG-F-536` and `REG-F-537`.

| Break | Severity | What | Accounted for | Note |
|---|---|---|---|---|
| B01 | BLOCKS | Live authoring specs poll canonical conversations; never accept or publish | new `REG-F-506` | Exact subject of `REG-F-506`. |
| B02 | BLOCKS | Test-mode authoring lane's stand-in reviewer leaves every candidate INCONCLUSIVE | this design: K7 | Stand-in INCONCLUSIVE by design (REG-D-071, REG-F-477); not named in draft K7. |
| B03 | BLOCKS | PWA authored in the test-mode lane cannot feed the execution half | this design: K7 | Test mode is in-memory by design (R24, REG-F-405); not named in draft K7. |
| B04 | BLOCKS | Live authoring lane's waits are shorter than one real-reviewer authoring turn | this design: K7 | Config comment discloses it; half B sizes own waits; not named in draft K7. |
| B05 | DEGRADES | First-ever acceptance of an agent candidate under a real reviewer, durable store | registered: `REG-F-425` | Reach paragraph: production reach inferred, not run; no lane has accepted one. |
| B06 | DEGRADES | Live-authored PWA may publish with no type a model can execute | new `REG-F-505`, `REG-F-508` | `REG-F-505`: prompt never asks MODEL plus armed prompt; `REG-F-508`: publish unchecked. |
| B07 | DEGRADES | Authored prompts use markers nothing supplies; refused only at execution | new `REG-F-507` | Designer's own example uses {criteria}; no surface names supplied markers. |
| B08 | BLOCKS | Publication wedge: a refused or stale-floor PWA can never return to DRAFT | new `REG-F-502` | Exact subject of `REG-F-502`; with a pointer on `REG-F-209`. |
| B09 | DEGRADES | Escalated or inconclusive real review blocks acceptance; only remedy is a re-run | registered: `REG-F-474` | THE RE-RUN bullet: a re-run of the same reviewer can clear it. |
| B10 | DEGRADES | Authoring floor reviewer is not shown policy assignments, prompt text or contracts | new `REG-F-503` | Exact subject of `REG-F-503`; `REG-F-503` adds the approver never sees prompt text. |
| B11 | DEGRADES | Authoring record: producer issues its own review; no human acceptance recorded | new `REG-F-504` | `REG-F-504` is the unrecorded acceptance; createdBy half is BY_DESIGN (REG-F-062, REG-D-070). |
| B12 | COSMETIC | Agent's system prompt says no staged preview; each tool commits immediately | new `REG-F-505` | `REG-F-505`'s first limb; its own test pins the untrue text. |
| B13 | DEGRADES | Authoring half leaves partial, misattributable evidence for the report and Phase 8 | registered: `REG-F-321`, `REG-F-432`, `REG-F-433` | Producer exchanges unpersisted: REG-F-321 deliverable 2b owed; version 1; older-run answer. |
| B14 | DEGRADES | Agent-proposed policy needs acceptance, human activation, then another agent turn | by design: REG-D-070 Q3 | Agent sees only ACTIVE policies; activation is human-only (tools.ts:463). |
| B15 | DEGRADES | No authoring surface writes contextSpecification, the upstream context a type needs | by design: REG-F-350 | "Carrier and no editor", scoped out deliberately; hand-off: D-3 not taken (REG-F-358). |
| B16 | COSMETIC | A mistyped JPWB_AGENT_MODEL silently runs the first credentialed model | new `REG-F-509` | Exact subject of `REG-F-509`; the independence-by-name clause is filed as `REG-F-537`. |
| B17 | BLOCKS | The Undertaking cannot name the product; only type text reaches a prompt | new `REG-F-510` | Exact subject of `REG-F-510`; Phase 7 bakes the brief into each prompt. |
| B18 | BLOCKS | A refused model-step completion strands its unit; no re-run, no assurance act | new `REG-F-511` | Exact subject of `REG-F-511`. |
| B19 | BLOCKS | One rejected, inconclusive or transport-failed command review refuses the step | new `REG-F-520` | No repair or re-run of a command review; rates REG-F-499, REG-F-489. |
| B20 | BLOCKS | MODEL type with a DRAFT prompt publishes, then fails mid-step, stranding the unit | new `REG-F-508`, `REG-F-505` | `REG-F-508`'s headline; the agent-teaching half is `REG-F-505`. |
| B21 | DEGRADES | Reading an earlier phase's files becomes reviewed evidence and may be faulted | registered: `REG-F-486` | Its pointer adds: no read tool, every read is reviewed. |
| B22 | DEGRADES | Repaired unit: an earlier try's runs judged against the last try's account | registered: `REG-F-485` | Exact subject (its heading). |
| B23 | DEGRADES | npm/npx refused as batch shims; installs, builds and Playwright effectively unavailable | by design: batch-target refusal (sandbox roadmap :564) | Over-refusal stated at :583-588; the `cmd.exe /c` route remains; its consequence is filed as `REG-F-534`. |
| B24 | DEGRADES | Declared policies signed SATISFIED by a host HUMAN credential judging no criterion | new `REG-F-523` | Exact subject of `REG-F-523`; non-gating of execution is REG-F-406 item 2. |
| B25 | DEGRADES | No TEST_RESULT; the fitness verdict reads no execution evidence; RPH-EVD-004 unreached | new `REG-F-523` | `REG-F-523` states it, correcting REG-F-406 item 3; TEST_RESULT is REG-F-406 item 1. |
| B26 | DEGRADES | Invented pwuKinds make catalog policies not govern the unit | new `REG-F-524` | `REG-F-524` refutes "operator alone": the unit can never be assured. |
| B27 | DEGRADES | Comprehensive-by-default authoring yields tens of types, each a paid work unit | by design: JAN-PRPWA-DS-001 T-2, P-1 | Deliberate authoring rule; every mandatory child is instantiated (REG-F-371). |
| B28 | DEGRADES | Hand edit after an accepted candidate bumps the version; Publish demands a new floor | registered: `REG-F-209` | Type edits block publication "until the review is redone"; the wedge is `REG-F-502`. |
| B29 | DEGRADES | A build step's Begin & Execute POST outlasts the lane's wait | this design: K6 | Lane's NOT COVERED note; Pi turn unbounded (`REG-F-521` W-2); timeout kill is `REG-F-527`. |
| B30 | DEGRADES | No reviewer reads the source; the deliverable files are hashed into no object | new `REG-F-522` | Exact subject of `REG-F-522`. |
| B31 | DEGRADES | Nothing enforces phase order or gates the root on its children | by design: JAN-EXECPLAN fork C | Hand-off advisory by ruling; recomposition undriven: REG-F-041, REG-F-042. |
| B32 | DEGRADES | The report cannot pair each command assessment with its concluding reviewer answer | registered: `REG-F-433` | Its bullet "THE SAME GAP ON THE EXECUTION PLANE". |
| B33 | COSMETIC | A root declaring pol_intent_fidelity folds CONDITIONALLY_SATISFIED and never turns green | registered: `REG-F-403` | `REG-F-403` calls it correct; its pointer adds permanence. |
| B34 | COSMETIC | Every MODEL type gets run_command; no per-type "may write, may not run" | by design: demo full-grant posture | +page.server.ts:1093-1097 says so; not in register; `REG-F-512` shows narrowing fails anyway. |
| B35 | BLOCKS | No unit is told the Undertaking's product; an {objective} marker is refused | new `REG-F-510` | Same defect as B17; exact subject of `REG-F-510`. |
| B36 | BLOCKS | A stopped unit cannot run again; Retry only re-queues; only Abandon remains | new `REG-F-511` | `REG-F-511` corrects REG-F-474 and REG-D-090 ("executed again"). |
| B37 | BLOCKS | Each command reviewed once, without feedback; one refusal blocks completion for good | new `REG-F-520` | Exact subject of `REG-F-520`; account and incidental-run limbs are REG-F-485, REG-F-486. |
| B38 | BLOCKS | npm, npx and pnpm are refused as .cmd shims on this host | by design: batch-target refusal (sandbox roadmap :564) | The `node` and `cmd.exe /c` routes remain; its consequence is filed as `REG-F-534`. |
| B39 | DEGRADES | No governed hand-off between units; only shared files, read via commands | by design: REG-F-358 D-3 not taken | With R8 and fork C; `REG-F-358`'s "no cross-unit path" is corrected in place. |
| B40 | DEGRADES | Files one unit writes become later units' system prompt or server code | new `REG-F-512` | Exact subject of `REG-F-512` (Pi context files, .pi/extensions). |
| B41 | DEGRADES | A deterministic floor failure is not fed back; the loop stops after one try | new `REG-F-515` | Exact subject of `REG-F-515` (WORK_PRODUCT_NOT_PARSEABLE). |
| B42 | DEGRADES | Sign-off is scripted, ignores the test runs, names the operator as producer | new `REG-F-523`, `REG-F-514` | Gating half is REG-F-406 item 2; kind exclusion is R19, `REG-F-524`. |
| B43 | DEGRADES | The professional cannot see why a unit stopped or what it built | new `REG-F-513` | Exact subject of `REG-F-513`; the content reader is `REG-F-528`. |
| B44 | DEGRADES | One click per unit, in any order; root may run before its children | by design: JAN-EXECPLAN fork C | The concurrent-click limb is filed as `REG-F-535`. |
| B45 | DEGRADES | One click can run far past the lane's wait; turns and calls unbounded | new `REG-F-521` | W-2 limb of `REG-F-521`; the lane's sizing is K6. |
| B46 | DEGRADES | Instantiation drops conditional children and extra M+ instances; refusal leaves empty Undertaking | new `REG-F-516` | `REG-F-516` refutes the recursive-child limb; C1/C+ semantics by design (REG-F-371). |
| B47 | DEGRADES | A unit folding CONDITIONALLY_SATISFIED never turns green; Mark Satisfied is refused | registered: `REG-F-403` | Its pointer adds permanence, since submitted evidence is never read. |
| B48 | DEGRADES | A non-MODEL type runs as a no-output TRANSFORMATION yet signs off green | new `REG-F-523` | Merged into `REG-F-523`: "a unit that did nothing". |
| B49 | COSMETIC | The existing live-exec spec and lane budget assume one unit | this design: K6 | Phase 7 writes its own spec and budget. |
| B50 | COSMETIC | Any {identifier} in template text must be supplied; {statement} never is | new `REG-F-507` | `REG-F-507` covers the supplied-marker vocabulary and {statement}. |
| B51 | BLOCKS | Fail-then-fix test loop: the failing run is judged against the all-pass account | registered: `REG-F-485` | Within one try R15 applies (account must narrate it); permanence via `REG-F-520`. |
| B52 | BLOCKS | Incidental runs (reads, listings, installs) are reviewed as if verification | registered: `REG-F-486` | Already registered; its pointer adds the missing read tool. |
| B53 | BLOCKS | Any one review failing for reasons unrelated to the work blocks the step | new `REG-F-520` | Causes: REG-F-499, REG-F-489, REG-F-474; no re-run is `REG-F-520`. |
| B54 | BLOCKS | A timed-out or killed command blocks the step, even after a later success | by design: R17, R18 | Sandbox design §4.13; "permanently" is `REG-F-520`'s missing re-run. |
| B55 | BLOCKS | A refused unit cannot be retried in the product; no fix-and-rerun lever | new `REG-F-511`, `REG-F-520` | Producer released before the join (`REG-F-520`); discarding completeStep noted in `REG-F-520`. |
| B56 | DEGRADES | Narration between tool calls breaks the JSON envelope; the account reads NOT DECLARED | new `REG-F-519` | Exact subject of `REG-F-519`. |
| B57 | DEGRADES | A bare npm or npx is refused; a bare pytest is not found | by design: batch-target refusal (sandbox roadmap :564) | Its consequence is `REG-F-534`; pytest's absence is this host's PATH, not the product. |
| B58 | DEGRADES | Runs after the 32nd become no evidence, unreviewed, with nothing recorded | new `REG-F-517` | Exact subject of `REG-F-517`. |
| B59 | DEGRADES | A test run can start before the files it tests are written | new `REG-F-518` | Exact subject of `REG-F-518` (Pi runs tool calls in parallel). |
| B60 | DEGRADES | Workspace AGENTS.md and .pi files steer later units; prompt discloses host path | new `REG-F-512` | Exact subject of `REG-F-512`; the host-path clause is filed as `REG-F-536`. |
| B61 | DEGRADES | The live lane can time out mid-review; a copied spec passes with step refused | this design: K6 | Spec reports outcome by design; Phase 7 spec must assert completion; kill is `REG-F-527`. |
| B62 | DEGRADES | A unit-tests-only full-fitness claim is not refused by the engine | registered: `REG-F-406` | Item 3, RPH-EVD-004 unenforced; a catch wedges the step (`REG-F-520`, `REG-F-511`). |
| B63 | DEGRADES | No governed object attests the delivered code | new `REG-F-522` | Same defect as B30. |
| B64 | DEGRADES | Output echoing environment or paths is retained permanently; USERNAME reaches children | new `REG-F-521` | W-3 limb of `REG-F-521`. |
| B65 | COSMETIC | The roadmap's "results become TEST_RESULT evidence" cannot be satisfied | registered: `REG-F-406` | Item 1; draft §9.5 asks the sponsor for the reading. |
| B66 | BLOCKS | The existing live-exec lane cannot drive a multi-unit Undertaking | this design: K6 | Phase 7 needs its own spec; assurance[0] may be another unit's. |
| B67 | BLOCKS | A unit outlasts the POST wait; Playwright kills the server mid-unit, unresumable | new `REG-F-527` | Exact subject of `REG-F-527`. |
| B68 | BLOCKS | One failed reviewer call leaves its unit permanently unable to complete | new `REG-F-520`, `REG-F-511` | Transport-failure rate is REG-F-499. |
| B69 | DEGRADES | Incidental and repaired-unit runs are reviewed refusably; each file look costs a review | registered: `REG-F-486`, `REG-F-485` | `REG-F-486`'s pointer covers the read-tool cost. |
| B70 | DEGRADES | The run's record in %TEMP% is lost; a naive copy misses the WAL | new `REG-F-526` | Exact subject of `REG-F-526`. |
| B71 | DEGRADES | The run cannot be watched, and its content cannot be read through the product | new `REG-F-528` | Exact subject of `REG-F-528`; the idle-reset risk is REG-F-501. |
| B72 | DEGRADES | The paid budget can be counted, not priced; failed reviewer calls undercounted | new `REG-F-529`, `REG-F-525` | `REG-F-529`: no usage field; `REG-F-525`: a thrown reviewer call leaves no exchange ⭑ (closed by P7-2b: it is recorded `NO_RESPONSE`). |
| B73 | BLOCKS | The authoring spec and harness fixture are unusable inside the durable process | this design: K7 | Reset refused by R24; lane-control test-only; not named in draft K7. |
| B74 | DEGRADES | Commands past the 32nd are never evidence or reviewed; the step still completes | new `REG-F-517` | Same defect as B58. |
| B75 | DEGRADES | Stray shell variables silently change the run | new `REG-F-531` | Exact subject of `REG-F-531`. |
| B76 | DEGRADES | The first Phase 7 run is the first live run of HEAD's reviewer prompt | registered: `REG-F-474` | Clean-but-ESCALATED blocks (REG-F-474); untested-at-HEAD is a run risk. |
| B77 | BLOCKS | Phase 8's "fourth ProducerSession" cannot replay a Phase 7 run by itself | new `REG-F-530` | Exact subject of `REG-F-530`. |
| B78 | COSMETIC | The live-exec lane wipes the gate's gallery and keeps no pass-time trace | new `REG-F-532` | Exact subject of `REG-F-532`. |

## 8. Cost and time

**Per phase:**
- **Executor:** at most 3 tries. The model requests inside a try are not counted (`REG-F-529`), so nothing bounds the executor's spend.
- **Reviewer:** one call per try reviewed, plus one per command reviewed (32 at most), and up to twice that when a reply needs repair. Each call is bounded at 240 s. With P7-2b, a thrown call may run once more.
- **The worst case:** 70 reviewer calls (140 with P7-2b) and about 6 hours (10.6 with P7-2b).

**Half A, four model phases:**
- **Typical estimate:** 6 to 9 executor tries and 15 to 50 reviewer calls; 1 to 3 hours.
- **Measured reviewer:** median 26.4 s. No repair was sent in 28 calls, and 2 of those 28 replies held rows only for faulted criteria (`REG-F-489`).

**Transport failures.**
- **The measured rate:** the reviewer program failed without answering in 3 of its last 133 calls, cause unrecorded (`REG-F-499`); over all the selected candidate's runs, 3 in 237.
- **What that means for this run:** at those rates, 20 reviewer calls carry roughly a 22–37% chance of at least one such failure, and 40 calls 40–60%. These figures are extrapolated from the qualification's call path.
- **The consequence today:** each such failure stops its phase for good (K1, K2r). ⭑ Since P7-2b, only a second failure in a row does.

**What "paid" means:** Pi on `openai-codex/gpt-5.6-sol`, and devin with `glm-5-3-flash-max`. The record counts calls, not tokens or money (`REG-F-529`).

## 9. Decisions for the sponsor — answered 2026-10-09, all six as recommended (`REG-D-102`)

One answer each. "Phase" means one of the four model-run work units.

1. **Which half first?**
   - **Recommended: execution,** since your question starts after publishing. Cost: the PWA names its product, and no AI reviews the PWA. The authoring agent's own run follows the first execution report.
   - *Alternative:* authoring first, as the roadmap orders. No live authoring run has reached PUBLISHED since 2026-09-14, and today's live authoring specs cannot pass, so the execution answer would wait.
2. **Fix anything before the paid run?**
   - (a) Nothing. Cost: about one run in three to two in three meets a reviewer failure that ends its phase for good, so the run may measure that rather than the product.
   - (b) **Recommended:** when the reviewer program fails without answering (3 of its last 133 calls, cause unrecorded), run it once more and record both calls. This is the rule its qualification already uses (P7-2b, `REG-F-499`). Cost: a small fix with its own tests, before the paid run. Replies that skip or repeat criteria can still stop a phase.
   - (c) First build a re-run for a stopped phase, and change how commands are reviewed. This is the longest option. It fixes a prediction no run has confirmed, and it changes what the run measures.
3. **Where does it run?** Pi's commands run as your Windows user, with your files, your network and your credential files (including Pi's and devin's). Nothing confines them (your rulings R9, R12 and R13).
   - (a) **Recommended for this first run:** this workstation, in a folder outside the repository, as R9 allows. The task is a small tool with no dependencies, and every retained command's output is archived and scanned afterwards. npm is refused here, so the product has no build step, which falls short of your R5 "a real build".
   - (b) A Linux VM or container. It confines the commands and allows a real build. But it needs setup and credentials, and the Windows-only breaks go unseen.
4. **Paid limit.** **Recommended:** 150 reviewer calls; the typical estimate is 15 to 50.
   - **How it is checked:** nothing in the product counts calls, so the limit is checked between phases, and a phase starts only while the count is under it. The phase in flight can overshoot by its worst case: 70 calls, or 140 with 2(b).
   - **The executor:** tries are capped by the code at 3 per phase, but the model requests inside a try are not counted.
   - **Before and after:** nothing is paid before the free rehearsals pass, and each re-run comes back to you.
   - Prefer a money limit? Name it.
5. **"The results become TEST_RESULT evidence."**
   - **Recommended:** read it as your ruling R18 (2026-09-17). Each completed command becomes one OBSERVATION record ("this command ran and exited with this code"), and GLM checks it against the phase's closing summary.
   - Keeping the roadmap's wording makes stage 4 fail by definition.
6. **The declared policies** (test adequacy, fitness for purpose and the rest).
   - (a) **Recommended:** run as is. Their sign-off checks no criterion (`REG-F-523`; R20's phase), so R25's first obligation, that a competent reviewer was asked, is unmet. The report marks all 14 verdicts "vacuous", and a "Yes" cannot count them.
   - (b) First have GLM judge their criteria (R20's phase). This is a programme of its own, and the paid run waits for it.

**Calls made for you** (`REG-D-101`; object to any):
- the product: `wordfreq`, Node, no dependencies;
- the five-type PWA, with each kind's ontology defaults, and the root's departures recorded in §3.3;
- prompts written as a competent author would write them (§3.3);
- each phase's work product carries its deliverable;
- after a stop, the later phases still run, within the limit;
- no hand retries during the run;
- our checks and one reviewer-only negative control, all written before the run;
- the archive kept outside the repository, with only summaries committed.

## 10. What this design does not do

- It does not fix the predicted breaks before measuring them, apart from P7-2b if chosen.
- It does not run half B before half A's first report.
- It does not commit raw model output, because redaction has no producer (`REG-F-521`). The archive stays outside the repository, and only summaries are committed.
- It changes nothing a reviewer is asked: the prompt GLM was qualified on is unchanged. That qualification does not cover multi-try or multi-command phases, or incidental commands. So Phase 7's command reviews observe GLM; they are not a qualified use of it.
