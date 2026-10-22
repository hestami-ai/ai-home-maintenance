# ROADMAP — the multi-harness executor (JAN-MHX)

- **Design:** `DESIGN-multi-harness-executor.md`, beside this file. Decision numbers (D1–D47, with D14a, D14b, D19a,
  D21a and D44a) are the design's.
- **Basis:** branch `jan-exec/phase7c`, head `19a018f3`, 2026-10-18. Revised the same day on the review. The design's
  §9 lists every finding and what changed. The package layout and the merge order below are the main change (R1).
- **The main line:** P5 on agy with `gemini-4-argon-high` (the sponsor's Q3). Every package below either sits on that
  path or runs beside it without blocking it.
- ⭑ **2026-10-18 — P5 ran on Pi instead** (Q5, `REG-D-117`); agy with `gemini-4-argon-high` remains the sponsor's executor choice for later runs (Q3). JAN-MHX is being built. S2 and S4 are answered: MH-0a runs on `deepseek-v4-1-flash-max` while the reviewer uses GLM; MH-10 is no longer deferred and builds Muse as designed, with the lead's delegated default `muse-wonder-1.0` at high effort. S1, S3, S5 and S6 are recorded in `REG-D-117` and the design's §7 pointer.
- ⭑ **2026-10-19 — the build is stopped, resumable; the reviewer is now `glm-5-3-flash-high`** (`REG-D-117`, `REG-D-119`). The build was stopped on 2026-10-19 at the sponsor's word (*"We are at near token usage max for the week so prepare to pause."*) after 28 of its agents finished. Its integration branch `p7c-mhx` (`ae234e95`) holds MH-1, MH-7, MH-3, MH-4, MH-5 and MH-6 and is resumable; nothing of the build is on the main line. With the reviewer now `glm-5-3-flash-high`, MH-3's identity refusal must refuse the reviewer's model family (`REG-D-118` (5)). As merged on `p7c-mhx` (`f95e2864`), it compares families on both sides, so by reading it refuses `glm-5-3-flash-max` beside a `glm-5-3-flash-high` reviewer. No test there puts `glm-5-3-flash-high` on the reviewer's side (red 2 puts it on the executor's), so that direction is untested. A devin executor runs `deepseek-v4-1-flash-max`.

---

## 1. The packages

| Id | Package | Depends on | On P5's path | Size |
|---|---|---|---|---|
| MH-0a | devin probes (2–3 paid calls, on the model S2 picks) | the sponsor's S2 | no | S |
| MH-0b | agy probes (P0 free, then P1–P3) | the lead's go-ahead for P0 | **yes** | S |
| MH-0c | Codex Probe 0 (local mock, no OpenAI call) | the lead's go-ahead | no | S |
| MH-1 | the host tool server, the bridge, the CLI session shape and the `CLI` branch: one package, one merge | — | **yes** | L |
| ~~MH-2~~ | ~~the CLI executor session shape~~ merged into MH-1 (review R1: alone it could not pass gate:fast) | — | — | — |
| MH-3 | the selector, the identity refusals, the taint refusal | MH-1 merged (the `CLI` kind) | **yes** | M |
| MH-4 | the devin driver | MH-0a, MH-1, MH-3 | no | S |
| MH-5 | the agy driver, and agy re-pointed at it | MH-0b, MH-1, MH-3 | **yes** | M |
| MH-6 | the Codex driver | MH-0c, MH-1, MH-3 | no | M |
| MH-7 | the run report's executor line, the recorder's refusal | — | **yes** (P5's report) | S |
| MH-8 | the Phase 7 lane | MH-3, MH-5 | **yes** | M |
| MH-9 | confirmation and positive-control calls, then P5 | MH-1, MH-3, MH-5, MH-7, MH-8 | **yes** | S, plus paid |
| MH-10 | Muse: probes and driver | the sponsor's S4 | no | — deferred |
| MH-11 | Claude Code: probes and driver | the sponsor's S5 | no | — deferred |
| MH-12 | resume as a repair mode, per driver (devin call 3, agy P4, Codex `exec resume` moved here) | each driver's resume probe, approved then | no | — deferred |

**The critical path:** MH-0b → MH-1 → MH-3 → MH-5 → MH-8 → MH-9. MH-7 is built beside MH-1 and merged before MH-9.

---

## 2. Waves and worktrees

Each package is built in its own worktree off the programme's integration branch, with its own private scratch
folder. Never `git add -A`. Commit with `git commit -F`. Edit in binary mode, so LF line endings stay LF; check
`git diff --stat` before each commit.

**Interfaces first, inside a package.** MH-1's first commits are the `HostToolServer` and `CliDriver` types. MH-3 may
start on a branch stacked on them. ⛔ No interface commit merges alone. The `CLI` kind cannot compile without its
`getExecutionSession` branch (`model.ts`'s exhaustive `never`), and an exported function with no production caller
reddens `verif/tool-adapter-exports-reachable.test.ts`.

| Wave | Worktrees running at once | Starts when |
|---|---|---|
| 0 | MH-0b P0 and MH-0c, if the lead approves; the stand-in of the shipping path for the paid probes (scratch, D47); MH-0a once S2 is answered | now |
| 1 | MH-1, MH-7 | now, in parallel with wave 0 |
| 2 | MH-3, stacked on MH-1's branch | MH-1's interface commits |
| 3 | MH-5 (after MH-0b, MH-1 and MH-3), MH-4 (after MH-0a), MH-6 (after MH-0c) | as each dependency merges |
| 4 | MH-8, then MH-9 | MH-3 and MH-5 merged |

**Merge order:** MH-1, MH-7, MH-3, MH-5, MH-8, then MH-4 and MH-6 when ready.
**Why each merge is green:**
- **MH-1.** Every new top-level export has a production caller in the same merge. `host-tool-server.ts`'s exports and
  `writeBridge` are called by `cli-executor-session.ts`. `openCliExecutionSession` and `cliExecutorDriver` are called by
  `model.ts`'s new `CLI` branch. The `CLI` kind lands with that branch and with its `executorRecordIdentity` arm, so it
  compiles and is never recorded as `pi`. One new stderr site, added to the pinned list in the same commit. Nothing
  selects the `CLI` kind yet, so nothing behaves differently at merge.
- **MH-7.** Scripts only.
- **MH-3.** Selector, routes and isolation lists. No new `tools/` export.
- **MH-5, MH-4, MH-6.** Each driver is a top-level `tools/<tool>-executor-driver.ts`, exported as a function, and
  reached through `cli-executor-drivers.ts`'s table in the same commit.

**Files more than one package touches, and who owns them:**
- `execution/executor-selection.ts`: MH-1 adds the `CLI` member and its `executorRecordIdentity` arm, and nothing else.
  MH-3 owns the rest. MH-4, MH-5 and MH-6 each add one line to `WIRED_EXECUTORS` and one to `MODEL_FAMILIES`.
- `execution/model.ts`: MH-1 adds the `CLI` branch. MH-5 retires the text-only `AGY` branch, struck in place.
- `tools/cli-executor-drivers.ts`: MH-1 creates it with an empty table. MH-4, MH-5 and MH-6 each add their driver.
- `verif/agy-stderr-unbound.test.ts`: MH-1 adds the opener's site. A driver's package adds its own site only if the
  gate counts the driver (D24).
- `e2e-live-exec/lane-config.ts`: MH-8 owns it. MH-4 and MH-6 each add their tool to the mirror and to
  `EXECUTOR_IDENTITY_EVIDENCE`.
- `tools/backing-tool.ts`: MH-1 owns the docblock change (D17). MH-6 adds Codex's catalog entry, with its probe's
  measured values.
- `scripts/mutants/ledger.ts`: every package adds mutants. Regenerate it after each merge, never hand-merge it.

**Each package's gate:** `bun run gate:fast` (the repo's 13 steps), green, before merge. Every new guard gets its own
control mutant in the ledger, killed. **Before MH-9:** the full gate, vitest and Playwright.

**Paid work** (MH-0a, MH-0b P1–P3, MH-9) runs from the main checkout, after a dry run has warmed the tree, never from a
worktree.

---

## 3. The packages in detail

Each test is named with what must make it red first. For changed code, that is today's behaviour, with the line that
produces it. For new code, it is a named control mutant, which the test must kill.

### Before any paid probe — the stand-in of the shipping path (D47)

- In scratch, never in the repository: a stdio relay written to D10's contract, launched by an absolute `node` path,
  relaying to a stand-in HTTP server on 127.0.0.1. The server serves the minted schemas, dumped by a script that calls
  no model (`toTypeBox` of the real parameters: `argv: string[]`). It carries out `write_file` in a scratch workspace,
  returns a fixed result for `run_command`, and logs every call. The endpoint file sits outside the CLI's cwd.
- `mhx/probe-paid/run-probe.sh` and `mhx/probe1/server/server.cjs` are revised onto it. The toy, which ran `node` from
  `PATH` with `command: string`, is retired.
- Its bytes are kept with each probe's record.

### MH-0a — devin probes

- **Waits for:** the sponsor's S2. Call 1 runs on that model (D22, R13).
- **Do:** call 1 (allow present), call 2 (allow removed), and call 3 only if call 1 fails (deny rules, no
  `disabled_tools`). The `--config` bytes are the ones the driver will pin (design §4.1). Resume is MH-12's.
- **Record:** every finding in the register before any count is quoted.
- **Answers:** whether `allow mcp__jpwb__*` approves a call made through `mcp_call_tool` in print mode; whether
  `mcp_list_tools` needs approval; the export's `function_name` spelling; what `tool_definitions` holds (the shape of
  the surface proof, D14a); the `generation_model` set on S2's model; the per-call tool timeout; which global files
  change when nobody edits them (D44a); whether `_meta` is ignored.
- **The predicted red:** call 2, with the allow rule removed, must show no `tools/call` in the stand-in's log and a
  rejection on stderr, and must classify, by D19 applied by hand to its stderr and export, as `CLI_ENDED_ON_REFUSAL`.
  If it shows calls, the allow rule is not what approves them. If an assistant message follows the rejection, this
  version does not end on a refusal; that is recorded, and the row stays for the other CLIs.
- **Also record:** the processes that survive each call.

### MH-0b — agy probes (P5's)

- **P0, no quota, needs the lead's go-ahead because it uses `-p`:** from a fresh folder holding `.agents/hooks.json`
  and `.agents/skills/x/SKILL.md`, run `-p "/hooks"`, `-p "/skills"` and `-p "/permissions"` with
  `--output-format json`. Run `-p "/model" --agent jpwb-executor --model <a model the operator's settings do not name,
  from agy models>`. Then malformed `--input-format stream-json` lines, to learn the line's shape. Check agy's log for
  any model request each one made.
  - **The predicted reds:** the same commands in a sibling folder without `.agents/` must show none of it; if both show
    the same, P0 cannot tell. And the model `/model` resolves must follow `--model`, not the settings default "Gemini 4
    Argon (High)", which is the same model P5 runs and so cannot discriminate (R3).
  - **If `.agents/` does not load from a fresh folder, or the resolution follows the settings:** stop, and take the
    design's §4.2 fallback to the sponsor (a folder the operator trusts once, a one-time global allow-rule, or the same
    model through devin).
  - **If `/hooks` made a model request:** the per-turn hooks preflight moves to the lane's boot (design §4.2).
- **P1 (1 call):** the run-scoped agent, the stand-in with `write_file`, no skip flag. Its `--model` is not the settings
  default, unless P0 already settled the question; the log's resolved label must be that model. The stand-in holds one
  call for 150 s: does agy cut it before the 180 s `timeoutSeconds`? Was the call made, or denied, and how is a denial
  worded? What do the init and step events carry (the surface proof's fields)? Does stream-json show a call agy
  rejected for an undeclared argument?
- **P2 (0–1 call):** only if P1 was denied. A PreToolUse hook `allow`; then, only with the lead's decision (L3), the
  skip flag.
- **P3 (1 call), a check, not the control:** ask the model to use the shell, write a file itself, and call the science
  plugin's server, with its own tools off. All three should be absent or denied. A model that obeys never tries, so
  this cannot fail by itself. MH-9's positive control is the one that must trip.
- **Count:** 2–3 calls here and 2 in MH-9, within the sponsor's 3–5. P4 (repair in one process) moves to MH-12.

### MH-0c — Codex Probe 0

- **Do, if the lead approves:** a local mock of the Responses API (about 80 lines) and the stand-in. `codex exec`
  pointed at the mock, with a provider that needs no key. The runs:
  - the flags with the user catalog;
  - the flags with the host-only catalog;
  - the mock asking for `apply_patch` under `-s workspace-write`, in scratch: it MUST write the file;
  - the same patch under `-s read-only`: it must not;
  - the relay's loopback call from inside the sandbox;
  - a `model_reroute`, if the mock can emit its wire form; otherwise Probe 1 answers it.
- **The predicted red:** the positive arm. The patch under `workspace-write` must write the file. Only then does "no
  file" under read-only show that the backstop held, since a malformed mock patch also leaves no file (R8).
- **Record the version.** The driver refuses any other (D14a).
- **The mock records whether an `Authorization` header arrived, never its value.**
- **Probe 1** (2 live calls) waits until after 2026-10-22 02:13. `exec resume` is MH-12's.

### MH-1 — the host tool server, the bridge, the CLI session shape and the `CLI` branch (D1–D24, D30's kind, D40–D44a)

- **New files** (all top-level in `apps/rph-demo/src/lib/server/tools/`, each with its test):
  - `host-tool-server.ts`;
  - `host-tool-bridge.ts` (exports `writeBridge`; the source is module-private);
  - `cli-executor-session.ts` (`openCliExecutionSession`, `CliDriver`, `CliExec`, `EXECUTOR_HOST_TOOLS_PREAMBLE`,
    `EXECUTOR_TURN_TIMEOUT_MS`, `EXECUTOR_RESEND_HISTORY_CHARS`);
  - `cli-executor-drivers.ts` (`cliExecutorDriver(toolId)`, an empty table);
  - and, outside `tools/`, `execution/workspace-taint.ts` (the marker's writer and reader, D21a).
- **Changed:**
  - `execution/child-process-runner.ts` exports `childEnvironment`, so one allowlist serves both users.
  - `tools/backing-tool.ts:271-279`, the `materializedInput` docblock (D17).
  - `execution/producer-session.ts:60`, the `processRuns` docblock: for a CLI, an observed absence holds only on a turn
    that passed D14a and D14b.
  - `execution/executor-selection.ts`: the `CLI` member, and its `executorRecordIdentity` arm (`:311`).
  - `execution/model.ts`: the `CLI` branch, through `deps.openCli`, whose default lazily imports
    `openCliExecutionSession` and `cliExecutorDriver`.
  - `assurance/exchange-capture.ts`: keep the CLI's record beside a breach (D20). First confirm against
    `model-exchange.ts` that the failure message may carry the pointer. If it may not, stop and take it to the lead.
  - `verif/agy-stderr-unbound.test.ts`: one site, `lib/server/tools/cli-executor-session.ts`, in the list and in the
    pinned literal, with D24's disposition in that file's header.
- **Tests that must go red first — the server** (`host-tool-server.test.ts`, over a temp FILESYSTEM workspace and the
  runner the tool-surface tests already use):
  - S1. `tools/list` names exactly the minted tools: a grant of `['file-system']` lists only `write_file`. *Mutant:
    list `EXECUTION_TOOL_CATALOG`.*
  - S2. A `tools/call` of `run_command` under that grant is refused, the runner is never called, and the observer holds
    `run_command` FAILED, which `governedToolCallReport` grades NOT_MINTED. *Mutant: dispatch by catalog name.*
  - S3. Two concurrent calls run one after the other: the second starts after the first ends, and the observer lists
    them in arrival order. *Mutant: remove the queue.*
  - S4. A call that arrives while another runs is `started` at once. When the gate closes with it still queued, it
    never runs, and its outcome is UNKNOWN. *Mutant: call `started` when the call leaves the queue.*
  - S5. A missing or wrong token gets 401, runs nothing and observes nothing. *Mutant: skip the token check.*
  - S6. A `Host` that is not `127.0.0.1:<port>`, or a request carrying `Origin`, gets 403. *Mutant: skip the check.*
  - S7. A call with no turn open is refused, counted, and not observed. *Mutant: remove the gate.*
  - S8. On a keep-alive connection held across the turn change, a call carrying turn n's token after turn n+1 opens
    gets the gate's own refusal status, and the refusal counter rises by one. *Mutant: one token per session.*
  - S9. On a keep-alive connection opened before `dispose()`, a call sent right after `dispose()` returns gets the
    gate's own refusal status, and the counter rises by one. ⚠ A fresh connection refused with ECONNREFUSED would pass
    for the wrong reason, so the test holds the connection and asserts the status code. *Mutant: close the socket
    without closing the gate.*
  - S10. `run_command` through the server and the same minted tool called directly give equal process-run
    observations, ordinal aside. *A control: it proves the observers are Pi's, not a measure of anything new.*
  - S11. The result text the CLI receives equals `toPiToolResult`'s; `isError` is true exactly when `ok` is false.
    *Mutant: set `isError` from the exit code.*
  - S12. `ok: false` is REFUSED, a throw is FAILED, and `ok: true` with exit 1 is COMPLETED. *Mutant: FAILED for
    `ok: false`.*
  - S13. Each tool's `inputSchema` equals `toTypeBox(parameters)` serialised, the replay's `executorKeyOf` form. *A
    control.*
  - S14. The turn's transcript holds each call's name, arguments and result as sent, in arrival order, and a dropped
    call with `result: null`. *Mutant: omit the result.*
- **Tests that must go red first — the bridge** (`host-tool-bridge.test.ts`, spawning the bridge as a real child):
  - B1. A request line is relayed and its reply written; a notification writes nothing. *Mutant: write a blank line for
    a notification.*
  - B2. The token appears in no argv, no stdout line and no stderr byte of the bridge. *Mutant: print the endpoint at
    start.*
  - B3. The bridge exits within a second of its stdin closing. *Mutant: keep reading.*
  - B4. The bytes `writeBridge` writes are pinned by hash, as `DEVIN_REVIEWER_PREAMBLE`'s are.
- **Tests that must go red first — the session** (`cli-executor-session.test.ts`, with a fake driver and a `CliExec`
  seam that acts as the CLI: it reads the endpoint file and calls the real server):
  - C1. The CLI starts in the run's `cli/` folder: not the workspace, not `process.cwd()`. *Mutant: cwd = the
    workspace.*
  - C2. The endpoint file is in `host/`, not under the CLI's cwd. *Mutant: write it into `cli/`.*
  - C3. With `OPENAI_API_KEY` and `JPWB_PLANTED` set in `process.env`, neither reaches the CLI's environment, and the
    driver's constants do. *Mutant: pass `process.env`.*
  - C4. A driver's declared secret reaches the CLI's environment and no command the model runs, and the result holds
    only its length. *Mutant: add it to the shared allowlist.*
  - C5. No turn's token is in any argv element, environment variable, field of the returned result, or failure message.
    *Mutant: hand the token to the CLI as `JPWB_MCP_TOKEN`.*
  - C6. A CLI that never exits is killed at the bound, the turn is CALL_ABORTED, and a call after it is refused.
    *Mutant: no kill.*
  - C7. A fake CLI that starts a grandchild and stays alive: at the bound, both are gone. *Mutant: `child.kill()`
    alone. The predicted red is the grandchild still alive (D18).*
  - C8. A grandchild that outlives its exited parent, and calls with the old token during the next turn, is refused,
    and nothing it sent is observed in the new turn. *Mutant: one token per session.*
  - C9. **Re-send:** after try 1 (`INSTR`, answered `A1`, findings `F1`) and try 2 (`A2`, `F2`), try 3's prompt holds
    the preamble, the contract, `INSTR`, `A1`, `F1`, `A2`, `F2` and the turn, in that order, and E-1's `prompt` equals
    it. *Mutants: carry only the last pair; send the turn alone (`oneShotSession`'s shape).* The `model.test.ts` red
    against the real agy session is MH-5's.
  - C10. Past `EXECUTOR_RESEND_HISTORY_CHARS`, the oldest pair is left out whole, and the prompt says how many were
    left out. *Mutant: cut mid-pair.*
  - C11. E-1 is the envelope, holding `prompt`, `tools` and `calls`. *Mutant: E-1 = the prompt alone.*
  - C12. A tool of the CLI's own that RAN fails the turn (`CLI_OWN_TOOL_RAN`, reported by TOOL). It sits among the host
    calls in the CLI record's order, is graded NOT_MINTED by `governedToolCallReport`, and the taint marker is written.
    *Mutants: ignore the driver's own calls; append them after the host's.*
  - C13. A CLI record whose host calls differ from the host's, in order or by name, fails the turn
    (`CLI_SURFACE_UNPROVEN`). *Mutant: skip the cross-check.*
  - C14. A refusal with no assistant message after it fails the turn (`CLI_ENDED_ON_REFUSAL`). A refusal followed by an
    answer is recorded REFUSED, and the answer stands. *Mutant: always record the refusal and go on (the first draft's
    D21).*
  - C15. An attempt the CLI's record shows it rejected before sending (an unknown name) is in the observation as
    REFUSED. *Mutant: drop it.*
  - C16. A record that is absent, unparseable, or without the surface proof fails the turn (`CLI_SURFACE_UNPROVEN`).
    *One mutant per arm.*
  - C17. A file changed in the workspace between two host calls fails the turn (`CLI_UNEXPLAINED_CHANGE`), and the
    taint marker is written. A file written by a host `write_file`, or by a command during its call, does not. *Mutants:
    no manifest; a manifest only at the turn's ends, checked against `write_file` paths (it fails the command arm).*
  - C18. A reported model other than the configured one fails the turn (`CLI_MODEL_SUBSTITUTED`), naming both.
    *Mutant: take the reported model.*
  - C19. One reported model equal to the configured one grades PROVIDER_REPORTED; none reported grades HOST_CONFIGURED
    with the configured id. *Mutant: always PROVIDER_REPORTED, the shape of `pi-executor.ts:337`.*
  - C20. Exit 0 with nothing is ENDED_WITHOUT_ANSWER. Exit 2 is `CLI_ERROR`. A known-shape excerpt is kept to 300
    characters. An excerpt carrying the prompt, a served argument, a served result, the run path, the port or the token
    is withheld, and the code stays. An unknown-shape stderr line never reaches the message. *One mutant per arm.*
  - C21. A config source whose size or modified time changed between turns refuses the next turn
    (`EXECUTOR_CONFIG_CHANGED`) before any spawn, and no file is opened to find out. *Mutant: fingerprint only when the
    session opens.*
  - C22. A dedicated root with an ancestor holding `.devin` refuses the session. *Mutant: skip the check.*
  - C23. When `dispose()` returns, the gate is closed and the token revoked. The server's close and the folder's removal
    finish afterwards, and an error from either is logged, not thrown. *Mutant: leave the gate to the server's close.*
  - C24. Server start removes a stale `jpwb-exec-*` folder whose pid is dead, and keeps one whose pid is live. *Mutant:
    remove every one.*
  - C25. A failure to open removes the run folder and closes the server. *Mutant: no `finally`.*
  - C26. After a turn whose CLI throws, `lastTurnObservation()` holds the calls made before it (B-2). *Mutant: set it
    after the `try`.*
  - C27. Every path the fake driver writes lies inside the run folder (D44). *Mutant: a driver writing to the temp root.*
  - C28. On a breach, the CLI's record is stored PURGEABLE_AT_EXPIRY and the failure message points at it. On a turn
    that passes, it is not stored. *Mutants: store it on every turn (the orphan REG-F-336 C-2 forbids); never store it.*
- **Tests that must go red first — the kind and its branch:**
  - M1. `model.test.ts`: `getExecutionSession({ kind: 'CLI', toolId, modelId })` opens through `deps.openCli` with that
    selection, and never calls `agyExec` or `openPi`. *Mutant: route the `CLI` kind to the `AGY` opener.*
  - M2. `executorRecordIdentity` of a `CLI` selection names the tool as provider. *Mutant: leave
    `executor-selection.ts:311` as it is, which names it `pi`.*
- **Gates:**
  - `verif/agy-stderr-unbound.test.ts` reddens on the opener's stderr binding. It goes green in the same commit, by the
    one site and its disposition (D24).
  - `verif/tool-adapter-exports-reachable.test.ts`: every new `export function` above has its production caller, as §2
    says.
- **A measurement, not a gate:** the manifest's cost (D14b) on P3's largest unit workspace, recorded for MH-8.
- **Done when:** all of the above are green, each mutant is in the ledger and killed, and `gate:fast` is green. Nothing
  selects the `CLI` kind yet.

### ~~MH-2 — the CLI executor session shape~~

Merged into MH-1 (review R1). Its tests are MH-1's C1–C28. Its re-send test's `model.test.ts` red, which could not turn
green before agy was re-pointed, is MH-5's.

### MH-3 — the selector, the identity refusals, the taint refusal (D31–D34, D39, D21a)

- **Changed:**
  - `execution/executor-selection.ts`: `EXECUTOR_MODEL_IS_THE_REVIEWERS`, `EXECUTOR_MODEL_UNCLASSIFIED`,
    `MODEL_FAMILIES` (Pi's slugs included, from the models P3 ran, marked so), `EXECUTOR_DEFAULT_MODELS`, the effort
    rule, and `ExecutorProgramOverrides` as its own type with a `codex` key.
  - the two call sites in `routes/undertakings/[id]/+page.server.ts` (`:2321`, `:3322`) pass the preflight's reviewer.
  - Begin & Execute and re-run refuse `WORKSPACE_TAINTED` (reading `execution/workspace-taint.ts`).
  - `verif/live-backend-isolation.ts`: `JPWB_EXECUTOR_EFFORT` and `JPWB_CODEX_BIN`.
  - `replay/replay-switch.ts`: `JPWB_EXECUTOR_EFFORT` in `LIVE_SELECTIONS_BESIDE_A_REPLAY`; `codex` in the `overrides`
    argument.
- **Tests that must go red first:**
  1. `executor-selection.test.ts`: `JPWB_EXECUTOR=agy`, `JPWB_EXECUTOR_MODEL=glm-5-3-flash-max`, reviewer devin with
     `glm-5-3-flash-max`, outside test mode → REFUSED `EXECUTOR_MODEL_IS_THE_REVIEWERS`. *Today's red: it returns
     `{ kind: 'AGY', modelId }` at `executor-selection.ts:291`; the table asks nothing about the reviewer.*
  2. The same with `glm-5-3-flash-high` → refused, by family. *Today's red: the same line.*
  3. An unlisted slug, with a real reviewer → REFUSED `EXECUTOR_MODEL_UNCLASSIFIED`, naming it. *Today's red: the same
     line.*
  4. A control: `gemini-4-argon-high` → the agy selection. And Pi on `gpt-5.6-sol` against the GLM reviewer → PI.
  5. With no reviewer given (the stand-in), nothing is compared.
  6. Pi with `JPWB_EXECUTOR_EFFORT=high` → `EXECUTOR_EFFORT_NOT_TAKEN`. *Today's red: it returns PI.*
  7. The guidance names the chosen tool's default, says it is not applied, and lists only wired tools. *Mutant: build
     the list from the catalog.*
  8. ~~`model.test.ts`: a CLI agy selection opens through `deps.openCli`.~~ Moved to MH-5 (R1): agy is still the text-only
     `AGY` selection here.
  9. ~~`executorRecordIdentity` of a CLI selection.~~ Moved to MH-1 (M2): the kind lands there.
  10. `begin-execute-executor-selection.test.ts`: with the executor's model equal to the reviewer's, the POST returns
      the refusal and dispatches nothing. *Today's red: it dispatches.* The same for `rerunWork`.
  11. With a taint marker beside the workspace, Begin & Execute and `rerunWork` return `WORKSPACE_TAINTED` and dispatch
      nothing. *Today's red: they dispatch.*
  12. `verif/live-backend-isolation.test.ts`: `JPWB_EXECUTOR_EFFORT` and `JPWB_CODEX_BIN` are removed by the setup.
      *Today's red: the setup leaves them.*
  13. `liveSelectionsBesideReplay` names `JPWB_EXECUTOR_EFFORT` when it is set in the environment, and `JPWB_CODEX_BIN`
      when `overrides.codex` is set. *Mutant: put `JPWB_CODEX_BIN` in the environment list, where no adapter reads it
      after load.*
- **agy in this package:** unchanged. The selector still answers `AGY` for agy until MH-5.
- **Done when:** green, mutants killed, `gate:fast` green.

### MH-4 — the devin driver (design §4.1)

- **New file:** `tools/devin-executor-driver.ts` (top-level; exports `devinExecutorDriver`), added to
  `cli-executor-drivers.ts`'s table, and its test. Its open values come from MH-0a.
- **Tests that must go red first:**
  1. The run folder's three files, byte-pinned: the deny list holds no `mcp__` pattern; the allow list holds
     `mcp__jpwb__*`; all `read_config_from` are false; `--config` holds the 25 disabled tools and the `proxy` line MH-0a
     ran with. *Mutant: reuse the reviewer's `DENY_ALL_TOOLS_CONFIG`, whose `mcp__*` deny would block the host's tools.*
  2. The argv, pinned: no `dangerous`; `--respect-workspace-trust false`; `--config`, `--prompt-file` and `--export`
     inside `host/`. *Mutant: drop `--config`.*
  3. The preflight refuses a listing with a second server, a Source outside the run folder, or no server. *One mutant
     per arm.*
  4. The export: `tool_definitions` holding only carriers is the surface proof; one holding `exec` is a breach; an
     export with no `tool_definitions` is `CLI_SURFACE_UNPROVEN`. Two steps with two models report both. The spelling is
     the one MH-0a measured.
  5. devin's rejection line on stderr, with no assistant message after it, is `CLI_ENDED_ON_REFUSAL`. *Mutant: classify
     by the exit code.*
  6. `DEVIN_SESSIONS_DIR` points inside `host/`. The config sources are declared (D44a).
  7. The selector: devin is wired, S2's model selects it, and GLM against the GLM reviewer is still refused. *Today's
     red: `EXECUTOR_TOOL_UNWIRED`.*
- **Then:** devin joins the lane's mirror and `EXECUTOR_IDENTITY_EVIDENCE` (PROVIDER_REPORTED).

### MH-5 — the agy driver (design §4.2) — P5's

- **New file:** `tools/agy-executor-driver.ts` (top-level; exports `agyExecutorDriver`), added to
  `cli-executor-drivers.ts`'s table, and its test. Its open values (the dispatcher's name, the approval route, the stdin
  line, the surface-proof fields, the identity answer) come from MH-0b.
- **Changed:** `execution/executor-selection.ts`: `WIRED_EXECUTORS.agy` answers the `CLI` kind, and `MODEL_FAMILIES`
  gains agy's line. `execution/model.ts`: the text-only `AGY` branch is retired, struck in place. `agyPrintWithModel`
  loses its only executor caller; if nothing else calls it, it goes, struck in place where its docblocks are cited.
- **Tests that must go red first:**
  1. The agent file, pinned: `inheritCustomizations: false`, `excludeDefaultComponents: true`,
     `commandExecutionPolicy: off`, one `mcpServers` item for `jpwb` with the bridge and endpoint in `host/`, the body
     the preamble and contract. *Mutant: `inheritCustomizations: true`.*
  2. `hooks.json`, pinned.
  3. The argv, pinned: `--agent jpwb-executor`, the slug on `--model`, stream-json in and out, `--log-file` inside
     `host/`, `--disable-slash-commands`; never `--dangerously-skip-permissions`, `--mode`, `--effort` or
     `--print-timeout`. *Mutant: add `--mode accept-edits`.*
  4. The prompt goes on stdin, in the line shape MH-0b found, and no argv element holds prompt text. *Mutant: the
     prompt in argv.*
  5. A `model_resolver.go:155` line naming another model fails the turn, naming both. *Mutant: ignore the line.*
  6. agy's print-timeout warning on stderr is CALL_ABORTED, not an answer. *Mutant: classify by the exit code, which
     agy leaves at 0 (1.1.28).*
  7. An `AGY_ERROR` line is `CLI_ERROR` with its `short_error` as the excerpt, withheld if it carries the prompt or a
     served argument.
  8. A non-MCP `tool_info` step that ran is a breach; `denied_actions` are refused attempts; init and step data without
     the surface proof are `CLI_SURFACE_UNPROVEN`.
  9. The hooks preflight refuses a listing with any hook but the run folder's own. *Mutant: skip it.* (Or, if P0 showed
     that `/hooks` makes a model request, the lane's boot does it, and this test moves to MH-8.)
  10. If MH-0b found the resolution following the settings, the driver refuses the session. *Mutant: open anyway.*
      (Only if that is what P0 or P1 found.)
  11. `model.test.ts`: with `JPWB_EXECUTOR=agy`, the selection is `CLI`, and it opens through `deps.openCli`, never
      `agyExec`. *Today's red: the `AGY` selection opens `oneShotSession(agyPrintWithModel(...))` (`model.ts:152-154`).*
      The existing text-only `AGY` case is struck in place, with a pointer here. (From MH-3's test 7.)
  12. `model.test.ts`: a repair turn through the agy session carries the instruction, the prior answer and the
      findings. *Today's red: the `AGY` session sends the findings alone (`model.ts:153-154`, `oneShotSession`'s
      `turn: (text) => call(text)`).* (From MH-2's test 5.)
  13. `model.test.ts`: an agy session declares `retainsHistory: true`. *Today's red: `false`,
      `producer-session.ts:226`.*
- **Done when:** green, `gate:fast` green, and MH-9's two agy calls are ready to run.

### MH-6 — the Codex driver (design §4.3)

- **New file:** `tools/codex-executor-driver.ts` (top-level; exports `codexExecutorDriver`), added to the table, and its
  test. Its open values come from MH-0c.
- **Tests that must go red first:**
  1. The catalog file, pinned.
  2. The argv, pinned: `--ignore-user-config`, `--ephemeral`, `-s read-only`, `-C` the run's `cli/`,
     `approval_policy="never"`, `approvals_reviewer="user"`, the server entry with `required=true`,
     `tool_timeout_sec=180` and `supports_parallel_tool_calls=false`, and `-` last. Never `--approve-for-me` or the
     bypass flag. *Mutant: drop `approvals_reviewer`, which would leave this host's auto-review thread on.*
  3. The prompt goes on stdin.
  4. The JSONL: a completed `command_execution` or `file_change` is a breach; a declined one is a refused attempt; an
     `mcp_tool_call` on `jpwb` is the host's; `turn.failed` is `CLI_ERROR` with its message as the excerpt;
     `model_reroute` fails the turn.
  5. A `codex --version` other than the one Probe 0 measured refuses the session. *Mutant: skip the version check.*
  6. The selector: Codex without `JPWB_EXECUTOR_EFFORT` is `EXECUTOR_EFFORT_UNSET`; `overrides.codex` set outside test
     mode is `EXECUTOR_PROGRAM_OVERRIDDEN`. *Today's red: `EXECUTOR_TOOL_UNKNOWN`, since the catalog has no Codex.*
  7. `BACKING_TOOLS` gains Codex with the values the probe measured, not values from documentation.
- **Live confirmation** waits until after 2026-10-22 02:13.

### MH-7 — the run report and the recorder (D37, D38)

- **Changed:** `scripts/phase7/run-report-core.ts` (the executor line and its caveats);
  `scripts/phase7/record-replay-core.ts` (the refusal). It reads the boot record's executor fields defensively, since
  MH-8 adds them.
- **Tests that must go red first:**
  1. `verif/phase7-run-report.test.ts`: an archive whose boot names `JPWB_EXECUTOR=agy`, and whose EXECUTION exchanges
     record `gemini-4-argon-high` as HOST_CONFIGURED, gets the executor line and the caveat among what a "Yes" always
     states. *Today's red: `headerLines` has no executor line (`run-report-core.ts:3673`).*
  2. A control: a Pi `gpt-5.6-sol` archive gets the line and no caveat.
  3. Two recorded models are listed with a count each.
  4. A version at the end that differs from the boot's is stated.
  5. A Codex archive's line says the surface is the measured version's, and that a substitution cannot be detected.
  6. `verif/phase7-record-replay.test.ts`: an archive whose boot names agy, and whose E-1 is D17's envelope, is refused
     with the executor sentence before any payload is read. *Today's red: it is refused with "its materialized input
     carries no `input` list, so its tool calls cannot be read" (`record-replay-core.ts:213`). The message assertion is
     the red.* (A plain-text E-1 would reach `:209` instead. `:240`, which the first draft named, has no path from
     either.)

### MH-8 — the Phase 7 lane (D36)

- **Changed:** `e2e-live-exec/lane-config.ts`, `e2e-live-exec/phase7-operator.ts` (the boot record's executor
  readiness and fingerprints), `e2e-live-exec/execution.live.ts:220`, and the final archive.
- **Tests that must go red first:**
  1. `verif/live-exec-lane-config.test.ts`: `JPWB_EXECUTOR=agy` with a model is not refused. *Today's red: the lane's
     own rule, `lane-config.ts:129-135`.*
  2. The spec asserts `EXECUTOR_IDENTITY_EVIDENCE` for the selected executor. *Today's red: `execution.live.ts:220`
     asserts PROVIDER_REPORTED for every executor.*
  3. The lane's wired mirror equals the product's table.
  4. Codex without `JPWB_EXECUTOR_EFFORT` is refused at boot.
  5. The executor readiness check, with an injected `ProgramRunner`: `agy --version` and `agy models` are recorded, and
     a configured model the listing does not hold whole refuses the boot (`modelListed`, reused). *Today's red: there is
     no executor readiness.*
  6. Each config source the drivers declare (D44a) is fingerprinted (size and modified time, by name) at boot and at
     the final archive, and the report states a change. No contents are read, and no credential file is opened.
  7. `LANE_BUDGET.executorCallMs` equals the product's `EXECUTOR_TURN_TIMEOUT_MS`, held by a mirror, and the phase
     allowance counts command time once. The manifest cost MH-1 measured is counted in the allowance. *Today's red: the
     literal 240,000.*
- **Done when:** green, and a dry Phase 7 run with `JPWB_EXECUTOR=agy` boots clean.

### MH-9 — confirmation, then P5

1. **Two calls per built driver,** through the real adapter and the real host server: agy first, then devin; Codex
   after 2026-10-22 02:13. They count within the sponsor's 3–5 per CLI (design §5).
   - **The confirmation** must show the host's log holding the calls, an OBSERVED exchange with the minted names, the
     run as evidence, the expected grade, the surface proof passed, and no breach.
   - **The positive control:** the same adapter, with a driver variant whose CLI's own tools are left ON (agy:
     `--mode accept-edits`), asked to write a file into the workspace with its own tool. It MUST end CALL_FAILED with
     `CLI_OWN_TOOL_RAN` or `CLI_UNEXPLAINED_CHANGE`, with the taint marker written; the marker is then cleared by hand,
     in scratch. The variant lives in the confirmation script, outside `apps/`, never in the product.
2. **The one-unit live lane** (`execution.live.ts`) with `JPWB_EXECUTOR=agy`, `JPWB_EXECUTOR_MODEL=gemini-4-argon-high`.
   Its reviewer calls are the programme's, and are counted.
3. **P5 on agy**, as the Phase 7 roadmap runs it.
- **Done when:** P5's run report names agy, its version, `gemini-4-argon-high` and HOST_CONFIGURED, and states that
  this is not P3's executor.

---

## 4. Deferred, and what unblocks each

- **MH-10, Muse:** the sponsor's answer to S4 (may it be used; which model). Then its probes P1 (echo, no model call)
  to P3, then a driver on MH-1's shape.
- **MH-11, Claude Code:** the sponsor's answer to S5 (which account). Then P0 and P1, then a driver.
- **MH-12, resume:** per driver, once its resume probe passes and E-1 can say that the CLI held the rest of the
  conversation. It holds devin's call 3, agy's P4 and Codex's `exec resume`. Those calls are counted against the
  sponsor's Q4 if they fit within it, and asked for otherwise. A held process would also need the token rotated
  without restarting the bridge.
- **Not scheduled** (the design's §6): direct HTTP without the bridge; ACP, the Codex app-server and Muse's `serve`; a
  typed reference for the CLI's own record; the replay of CLI runs; a per-call grant re-check; pinned CLI installs; a
  workspace snapshot in place of the taint; a Job object for the tree kill; widening the adapter-exports gate.

---

## 5. Filed, not built

- **The reviewer's side findings** (the design's §4.1 and L5), filed together: `DENY_ALL_TOOLS_CONFIG` names neither
  `write` nor `web_search`, and its deny rules were measured on devin 3000.11.3 while 3000.11.92 runs;
  `read_config_from` is left on, so it reads `~/.claude/settings.json` hooks; no config fingerprint is taken before each
  review; and `readReportedModel` reads only the last step's model (`devin-reviewer.ts:267`). One register entry, and a
  re-measure of the reviewer's isolation, owed.
- **Widening `verif/tool-adapter-exports-reachable.test.ts`** to subfolders and `export const`: one register entry.
  First count what it reddens today, then add it with its own control mutant.
- **The sponsor's answers of 2026-10-18**, registered as REG-D-117, before MH-9. S6's answer, when it comes, goes
  with them.
