# DESIGN — the multi-harness executor (JAN-MHX)

- **Status:** draft for the lead, 2026-10-18, revised the same day on the review (§9 lists every finding and what
  changed). Nothing in the repository was changed to write it or to revise it.
- **Basis:** branch `jan-exec/phase7c`, head `19a018f3`. Every file reference below was read at that head.
- **Sources:** the code named in §1; five CLI investigations (devin, agy, Codex, Muse, Claude Code), whose captures sit
  in the scratch folder `.../scratchpad/mhx/`; and the sponsor's answers of 2026-10-18
  (`mhx/sponsor-words-2026-10-18.md`, to be registered as REG-D-117).
- **Roadmap:** `ROADMAP-multi-harness-executor.md`, beside this file.

---

## 0. The main line

The sponsor's goal: Phase 7's executor must not depend on Pi alone. The sponsor chose P5's executor: agy, with Gemini
4 Argon at high effort (Q3).

Today agy cannot do Phase 7's work. Its executor is a text-only `agy --print` (`execution/model.ts:152-154`). It has no
workspace and no tools. The sponsor asked why, and whether a permission change would fix it (Q1). A permission change
alone would not. It would let agy use its OWN tools, and then the host would no longer write the files or run the
commands, so nothing would record them as evidence.

The fix is one piece of host code that every CLI can use: an MCP tool server that serves the same two tools Pi gets,
`write_file` and `run_command`, minted by the same `mintExecutionTools` for the same grant. The CLI's model calls them.
The host runs them, records them as it records Pi's, and the reviewer judges them.

The CLI's own tools are the part the host cannot own. Pi has none (`noTools: 'builtin'`). A CLI has its own, and only
the CLI's own config switches them off. So the host does not trust that config: every turn must prove, from the CLI's
own record and from the workspace itself, that only the host's tools touched the workspace, and a turn that cannot
prove it fails (D4, D14a, D14b).

The critical path to P5: the agy probes (MH-0b); one package holding the host tool server, the bridge, the CLI session
shape and the CLI branch (MH-1); the selector and the identity refusal (MH-3); the run report's executor line (MH-7);
the agy driver (MH-5); the lane's agy rule (MH-8); then the confirmation calls and P5 (MH-9) (roadmap §2). devin and
Codex follow in parallel. Muse and Claude Code are designed here and deferred: Muse on a governance question, Claude
Code on its account (§7).

If agy's first free probe shows that headless agy will not load a run-scoped agent from a fresh folder, or that
`--model` does not govern an `--agent` session (§4.2), there is no documented run-scoped route for agy. The nearest
fallback is the same model through another harness: devin offers `gemini-4-argon-high` on this account. That is the
sponsor's choice to make, not this design's.

---

## 1. What is true today

1. **Pi runs in-process and holds only the host's tools.** `openPiExecutionSession` mints the tools for the step's grant
   (`tools/pi-executor.ts:163-171`), passes them as `customTools` with `noTools: 'builtin'` (`:192-211`), and watches
   the session's tool events itself (`:274-319`). So `mintedToolNames` is a complete statement of what the model could
   call.
2. **The minted tools are two.** `write_file` (capability `file-system`) and `run_command` (`process-execution`), each
   minted only when the grant carries its capability, and none for a revoked binding
   (`tools/execution-tool-surface.ts:416-457`). A command is bounded at 120 s by the host (`:127`).
3. **The host records two things.** The tool-call observer (`tools/tool-call-observer.ts`) holds name and outcome per
   call, for the permanent record. The process-run observer (`tools/process-run-observer.ts`) holds what each command
   produced, for evidence. It retains the first 32 runs (`:106`). That number caps what is retained. It does not limit
   how many runs a step may make.
4. **Calls run one at a time** (`REG-F-518`). Each Pi tool declares `executionMode: 'sequential'`
   (`tools/pi-execution-tools.ts:44`).
5. **agy executes text-only.** `oneShotSession(agyPrintWithModel(...))` (`execution/model.ts:152-154`): no workspace, no
   tools, no memory (`retainsHistory: false`). Its prompt rides in argv, capped at 28,000 characters
   (`assurance/agy-cli.ts:72`).
6. **The selector wires agy and pi.** `WIRED_EXECUTORS = { agy: 'AGY', pi: 'PI' }`
   (`execution/executor-selection.ts:85`). devin is catalogued with the EXECUTION role
   (`tools/backing-tool.ts:93-107`) and refused as unwired. Neither tool nor model has a default (REG-D-052).
7. **The reviewer is isolated.** devin with `glm-5-3-flash-max` (REG-D-084), in a fresh temp folder that holds only the
   prompt and a deny-all `.devin/config.json` (`tools/devin-reviewer.ts:94-98`, `:159-186`). It reads the model that
   answered from devin's export (`:259-274`), graded PROVIDER_REPORTED. It reads only the LAST step's model
   (`.at(-1)`, `:267`).
8. **Independence is an exact string compare.** The Reasoning Review requires DIFFERENT_MODEL
   (`packages/rph-assurance/src/floor-policies.ts:146`), checked as `producer.modelId !== evaluator.modelId`
   (`packages/rph-assurance/src/assurance-rules.ts:202-203`). So a GLM executor fails every phase against the GLM
   reviewer, but `glm-5-3-flash-high` against `glm-5-3-flash-max` passes, falsely. The guidance already says so in
   words (`executor-selection.ts:134-142`); no code refuses it.
9. **The lane refuses an agy executor, by its own rule.** Its spec asserts the producer's grade is PROVIDER_REPORTED
   (`e2e-live-exec/execution.live.ts:220`), and agy reports no model (`e2e-live-exec/lane-config.ts:129-135`).
10. **The replay records Pi runs only, in effect.** The recorder reads each executor try from Pi's provider payload,
    the composite Pi sent (`scripts/phase7/record-replay-core.ts:7-16`). A try without one is refused for a payload
    reason, not for being another executor: a plain-text E-1 at `:209` ("not JSON"), a JSON one with no `input` list at
    `:213`. The "no system prompt" refusal at `:240` is reached only by a payload that has an `input` list.
11. **A tool's own session record is kept only beside a blind observation.** `captureTry` stores a session export only
    when the tool-call report is NOT_OBSERVABLE, because its pointer is prose in that report's reason
    (`assurance/exchange-capture.ts:124-135`).
12. **A child process gets an environment allowlist, never the server's.** `childEnvironment`
    (`execution/child-process-runner.ts:327-352`, `:441-447`).
13. **No MCP library is installed.** No `@modelcontextprotocol` package is in the workspace.
14. **Pi's tool calls are observed on the event stream, on purpose.** The tool-call observer's header rejects
    observing at the handlers: a handler sees only calls the host was willing to run, so a call rejected before
    dispatch (an invented name, a malformed argument) would vanish, and that is the fact NOT_MINTED exists to record
    (`tools/tool-call-observer.ts:10-16`). A call that started and never ended is UNKNOWN (`:17-19`). The record keeps
    the fact that an unminted call was attempted, and drops its name (`tools/observed-tool-calls.ts:117-124`).
    Ordinals come from list position and are load-bearing (`tool-call-observer.ts:47-50`).
15. **"No run recorded means none happened" holds because of Pi's shape.** `processRuns()`'s contract says a process
    run goes through the host's own `ProcessRunner`, so an absence is observed (`execution/producer-session.ts:60`).
    That is true because Pi has no shell of its own.
16. **The held session is sponsor authority.** `+page.server.ts:1764-1765`: "The session is held on sponsor authority
    (`JAN-EXECSESS`), so "a session per try" is not available."
17. **An executor's E-1 is stored RETAINED_BY_PARTICIPATION.** `run-model-step` passes `materializedInput` as the
    exchange's prompt (`execution/run-model-step.ts:471`, `:545`), and `captureTry` stores it under that class
    (`assurance/exchange-capture.ts:312-316`).
18. **Two gates bear on new adapter code.** `verif/tool-adapter-exports-reachable.test.ts` requires every
    `export (async) function` in a TOP-LEVEL `tools/*.ts` file to have a production reference outside its declaration
    line (`:42-50`, `:83-93`). It does not recurse into subfolders of `tools/`, and it does not read `export const`.
    `verif/agy-stderr-unbound.test.ts` walks every subfolder, and its list of disposed stderr sites is pinned
    (`DISPOSED_STDERR_SITES`, `:199`, held to a literal).
19. **A new selection kind would be recorded as Pi.** `executorRecordIdentity` names the provider
    `selection.kind === 'AGY' ? 'agy' : 'pi'` (`execution/executor-selection.ts:311`). And `getExecutionSession` ends in
    an exhaustive `never` check (`execution/model.ts`), so a new kind does not compile without its branch.
20. **The program overrides are typed apart from the environment.** `ExecutorProgramOverrides` is
    `ReviewerProgramOverrides` (`executor-selection.ts:40`), with keys `agy` and `devin` only. The replay's list of live
    selections leaves overrides out by design, and takes them as a separate `overrides` argument
    (`replay/replay-switch.ts:33-47`, `:57`).

---

## 2. What the investigations settled

| | devin 3000.11.92 | agy 1.4.2 | Codex 0.162.1 | Muse 1.4.10 | Claude Code 2.1.299 |
|---|---|---|---|---|---|
| Headless mode | `--print`, `--prompt-file` | `--print`, stream-json stdin | `codex exec`, prompt on stdin | `muse exec`, `--prompt-file` | `-p`, stream-json stdin |
| MCP client, stdio | yes | yes | yes | yes | yes |
| One server for this run only | `.devin/mcp_config.json` in the run folder (measured) | workspace agent file (offline validator only; trust unknown) | `-c mcp_servers.jpwb=…` (measured with `mcp get`) | `-c mcpServers.jpwb=…` (help text) | `--mcp-config` with `--strict-mcp-config` (docs) |
| Own tools off (the CLI enforces it, not the host) | deny rules, and `disabled_tools` in a per-run `--config` (docs; `--config` honoured, measured) | `excludeDefaultComponents` (changelog; unproven) | partly: `--disable` flags and a custom model catalog (prompt render measured; tool list unknown) | `run.toolset` and `--disable-*` (validated offline) | `--tools ""` (docs) |
| Per-turn proof of its tool surface (D14a) | the export's `tool_definitions` (probe 1 shows its content) | init and `step_update` data (P1 shows the fields) | none at runtime; only a mock sees the request's tools array | unknown until P1 | `system/init.tools` |
| Host tools approved headless | allow `mcp__jpwb__*` (docs; unmeasured) | route unknown | `approve` on the server, `approval_policy=never` (likely) | `--approval-mode never` (unmeasured) | `--allowedTools` with `dontAsk` (docs) |
| Model the provider served | ATIF `generation_model` (exact echo measured for GLM only) | not reported (CLI log only) | not reported | unknown | `message.model` |
| Identity grade | PROVIDER_REPORTED | HOST_CONFIGURED, once a probe shows `--model` governs `--agent` | HOST_CONFIGURED | HOST_CONFIGURED until probed | PROVIDER_REPORTED |
| Verdict | likely yes, 4 questions open | likely yes, 4 questions open | very likely, with conditions | likely yes, governance open | yes technically; deferred |

Two facts cut across all five:

- **Every one speaks stdio MCP.** That decides the transport (D10).
- **None can be fully proven without a model call.** Each has several questions that only a paid call answers. The
  sponsor approved small probes on each CLI's own account, about 3–5 per CLI, none counting toward the 450 reviewer
  calls (Q4). §5 lists them and counts them.

---

## 3. Decisions

### A. One host tool server per execution session

**D1. One server per session, opened with the session and closed when it is disposed.**
The CLI adapter starts it in `open`, before any turn. `dispose` closes it. Its token is per turn (D2).
Why: a session is the unit the grant was minted for (`ProducerSessionContext`). A server shared between sessions would
need to know which grant a call belongs to, and a mistake there would hand one unit's tools to another.

**D2. Loopback only, a random port, a bearer token minted for each turn.**
It binds `127.0.0.1` on port 0. Before each turn the adapter mints a token of 32 random bytes, writes it to the
endpoint file (D41), and only then spawns the CLI. When the turn ends, however it ends, the token is revoked, and any
request carrying it is refused from then on. Tokens are compared in constant time. The server also refuses a request
whose `Host` is not `127.0.0.1:<port>`, or that carries an `Origin`.
Why: another local process, or a web page through DNS rebinding, must not be able to call the host's `run_command`.
And a descendant of an earlier turn's CLI that outlived its parent (D18) must not act in a later turn, where its calls
would run in the workspace and be recorded as that turn's.
⚠ What it does not defend against: the executing model itself. Minting `run_command` means arbitrary code as the server
user (R12, R13). Such a model can read the token file. It then holds only what it already had: the same two tools,
under the same grant, for the same turn, recorded the same way.

**D3. It serves exactly the minted tools, and nothing else.**
`tools/list` returns the descriptors `mintExecutionTools` returned for this session, in that order. A `tools/call` of
any other name that reaches the host is refused by the host, and observed as an attempted call under the name asked
for.
Why: grant by absence (`execution-tool-surface.ts`, its header). An ungranted tool is never listed, so the model is never
told it exists. A refused unknown name that reaches the host is recorded NOT_MINTED, as it is for Pi.
⚠ Not every attempt reaches the host. A CLI may check a call's name against `tools/list`, and its arguments against the
schema, before it sends the call (agy rejects undeclared arguments, 1.1.27). The host's server sees calls at the
handler side, which is exactly what the observer's header warns against (§1.14). So such attempts are recovered from
the CLI's own record (D21). Whether each CLI's record carries them is unknown until its probe. Where one does not,
the loss is a residual, stated in that driver's section (§4).

**D4. The host enforces the grant for its own tools. The CLI's own tools are withheld by the CLI's config, and the host
checks the result.**
- **The host's tools.** CLI allow-lists (`enabled_tools`, `allow` rules, `run.toolset`, `--allowedTools`) name them
  only so the CLI will call them without a prompt. They are convenience. If one were wrong, the host would still refuse
  what it did not mint.
- **The CLI's own tools** (file writes, shell, web). Only the CLI's config withholds them: deny rules,
  `disabled_tools`, `excludeDefaultComponents`, `--disable`, `--tools ""`. That control is the vendor's, not this
  host's. So the host does not rely on it. Each turn must carry a positive proof of the CLI's tool surface (D14a), and
  the workspace must show no change that the host's own calls do not explain (D14b). A turn that cannot show both
  fails.
Why: a control that depends on a vendor's config parser is not this host's control. Pi gets the property
structurally, from `noTools: 'builtin'`. A CLI can only be checked for it.

**D5. One call at a time, in arrival order (REG-F-518).**
`tools/call` requests go through one queue. The next starts when the last has ended. Each call is observed as started
when it arrives, before it waits (D6).
Why: Pi's executor runs calls sequentially since REG-D-112 (d). A `run_command` must never race the `write_file`
before it. ⚠ Arrival order is the order the CLI sent the calls. A CLI that sends a message's calls together may send
them in an order the model did not mean. Where a CLI has a switch for that, the driver sets it (Codex:
`supports_parallel_tool_calls=false`).

**D6. Its observers are wired as Pi's are.**
The process-run observer goes into `mintExecutionTools`'s ports, exactly as `pi-executor.ts:163-169` does, so a
`run_command` reaches it through the same code. The tool-call observer is called by the server. `started` is called
when a call ARRIVES, before it waits in the queue. `ended` is called with the result in Pi's shape (`toPiToolResult`),
so `observedToolOutcome` grades it the same way. A tool that throws is `ended` with the error flag: FAILED. A tool that
returns `ok: false` is REFUSED. Any other result is COMPLETED. When a turn's gate closes, every call still queued is
dropped unrun. It stays started with no end: UNKNOWN, as the observer's header defines it (`tool-call-observer.ts:17-19`).
Why: the same functions then produce the same evidence. `evidence-join.ts`, `governedToolCallReport` and the run
report need no change to read a CLI executor's work. And starting a call when it arrives is the nearest the host can
come to Pi's stream-side observation (§1.14): a call the CLI sent is recorded even if it never runs.

**D7. The model reads what Pi's model read.**
A call's result goes back as the text `toPiToolResult` builds, with `isError` set when `ok` is false. An unknown name
gets Pi's own words (`unknownToolResult`). A tool that throws gets a fixed sentence: the host failed to carry out the
call. The thrown message is not echoed, because it may carry a host path.
Why: the same result text keeps the executors comparable, and keeps a later replay of a CLI run possible (§6).

**D8. A turn gate. Calls are accepted only while a turn is open, and only with that turn's token.**
The adapter opens the gate when it starts the CLI, and closes it when the CLI exits or is killed. A call outside a turn,
or with another turn's token, is refused at the transport and counted. `dispose` closes the gate synchronously, before
it starts anything asynchronous (D13).
Why: a kill does not reach a descendant whose parent has already exited (D18). With the gate shut and that turn's token
revoked, such an orphan cannot act on the host, in this turn or in any later one. This is the rule the repository
files as "cleanup must survive a kill".

**D9. Hand-written JSON-RPC over `node:http`. No new dependency.**
Methods: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`. A POST carries one message and
gets a JSON response. A GET gets 405: there is no event stream. Each tool's `inputSchema` is `toTypeBox(parameters)`
serialised, the same schema Pi's provider was sent. Each tool carries `_meta: {"antigravity/alwaysLoad": true}`, which
agy reads (changelog 1.3.3). That the other CLIs ignore an unknown `_meta` key is assumed, not measured; each CLI's
first probe shows it (§5). A request body is bounded at 16 MB (authored).
Why: the surface is five methods. A library would be a supply-chain decision for code this small, and would be one
more party in the call path the gate cannot see.

### B. One bridge, for every CLI

**D10. Each CLI starts a stdio bridge. The bridge relays to the host's server.**
The CLI's MCP entry is `command: <node>`, `args: [<bridge>, <endpoint file>]`. The bridge reads the server's URL and
the turn's token from the endpoint file, then relays each newline-delimited JSON-RPC message from its stdin to the
server as one POST, and writes each reply to its stdout.
Why, four reasons:
- the token stays in one file outside the CLI's working folder: never in argv, never in an environment variable (D41);
- all five CLIs speak stdio MCP;
- it avoids each CLI's HTTP quirks: agy has no SSE, devin falls back to SSE on a 4xx, Claude Code times out an HTTP
  request at 60 s, and Codex and Muse would need the token in an environment variable;
- the host's server stays one simple thing.
Cost: one more process per CLI run. The bridge holds no state, so killing it loses nothing. It exits when its stdin
closes.

**D11. The bridge is a pinned constant, written into the run's host folder, run by the server's own runtime.**
`host-tool-bridge.ts` holds the bridge's source as a module-private constant and exports `writeBridge`, which writes it
as `<run>/host/jpwb-bridge.mjs`. The adapter names `process.execPath` as the command, by absolute path. The test pins
the bytes `writeBridge` writes.
Why: no `PATH` search, no batch shim (node refuses one with `shell: false`), and its bytes are what the test pins. The
export is a function, so the adapter-exports gate reaches it (§1.18). The bridge logs nothing, so no stream of it can
carry the token.

### C. One adapter shape for an external CLI

**D12. One opener, one driver per CLI.**
`openCliExecutionSession(context, selection, driver)` does everything the CLIs share: the run folder, the server, the
prompt, the spawn, the bounds, the answer's classification, the identity grade, the surface checks and the observation.
A `CliDriver` supplies only what differs: the files it writes into the run folder, its no-model preflight, its argv and
stdin, its config sources (D44a), and how to read what the CLI wrote back.
Each driver is a top-level file, `tools/<tool>-executor-driver.ts`, exported as a function (`agyExecutorDriver()`).
Drivers are found through one table, `tools/cli-executor-drivers.ts` (`cliExecutorDriver(toolId)`).
Why: every guarantee lives in one place, tested once, and a driver cannot weaken one by forgetting it. The file layout
is the gate's: the adapter-exports gate reads only top-level files and only exported functions (§1.18), so a driver in
a subfolder, or exported as a constant object, would escape it. Widening the gate instead is filed, not done here
(§6), because nobody has yet counted what it would redden today.

**D13. The CLI runs in its own fresh run folder, under a dedicated root. Never the workspace. Never the server's
folder.**
- **The root** is `<tmpdir>/jpwb-exec/`. At server start, and before each session opens, the adapter checks that no
  ancestor of the root holds a CLI's project configuration (`.devin`, `.agents`, `.claude`, `.codex`, `.pi`,
  `.mcp.json`, `AGENTS.md`, `CLAUDE.md`). If one does, the session is refused. How far devin and agy walk up without a
  repository root is unknown until their probes; this check does not depend on the answer.
- **Each session's folder** is `mkdtemp(<root>, 'jpwb-exec-<tool>-<server pid>-')`, with two subfolders. `cli/` is the
  CLI's working folder, and holds only the CLI's own configuration files. `host/` holds the endpoint file, the bridge,
  the prompt files and the CLI's own record (export, log, JSONL). The CLI is given `host/` paths by absolute path where
  it needs a file from there.
- **The workspace** is reached only through the host's tools.
- **`dispose`** closes the gate and revokes the token synchronously (D8). It then closes the server and removes the
  folder without waiting, and logs any error from either; it never throws. `ProducerSession.dispose()` is `void`, so
  this is the only shape it can take. A failure to open does the same. Tests drive both.
- **At server start** the adapter removes every `jpwb-exec-*` folder under the root whose server pid is not a live
  process. A killed server leaves its run folders behind, holding prompts, records and a token, and `finally` does not
  run on a kill.
Why: two measured escapes and one documented. The reviewer, run in the server's folder, read this repository
(REG-F-548). Pi trusted the workspace's `.pi/settings.json`, which the executor itself can write
(`pi-executor.ts:175-179`). And Claude Code's docs say that under `-p` it loads a folder's `.mcp.json` and hooks without
asking; that one is documented, not measured. A workspace the executor writes into must never be a folder its CLI reads
configuration from. And the token file sits outside `cli/` because some CLIs read their working folder by themselves
(agy's workspace is its cwd), and may send what they read to their vendor.

**D14. The CLI's own tools are switched off by run-folder config, and its MCP servers are checked before the first
turn.**
Each driver writes the strongest controls its CLI has (§4). Where a CLI lists its MCP servers without a model call, the
driver checks that list before the first turn, and refuses the session unless the only server is `jpwb` from the run
folder (devin `mcp list`; Codex `mcp list`).
⚠ That listing names MCP servers, not the CLI's built-in tools, so it proves nothing about them. D14a does.

**D14a. Every turn carries a positive proof of the CLI's tool surface, read from the CLI's own record, or it fails.**

| CLI | The proof | It holds when |
|---|---|---|
| devin | the export's `tool_definitions` | every entry is a carrier, or a host tool if devin lists MCP tools separately (probe 1 shows which) |
| agy | the init and `step_update` data | the tools shown are the carriers and the host's (P1 shows the fields) |
| Codex | none at runtime: the request's tools array is visible only to a mock | Probe 0 measured, for this exact version, that the flags and catalog leave only the host's tools; the driver refuses any other `codex --version` |
| Muse | unknown until its P1 | — |
| Claude Code | `system/init.tools` | it equals the two minted names |

When the record is absent, cannot be parsed, or lacks the proof, the turn is CALL_FAILED, reported by TOOL, with code
`CLI_SURFACE_UNPROVEN` (D19). A proof that names any other tool is a breach (D21).
Consequence for the record: `processRuns()` says an absence of runs is an observed absence (§1.15). For a CLI that is
true only of a turn that passed D14a and D14b. A turn that failed either is CALL_FAILED. The docblock says so.
Why: the vendor's config is the only thing that withholds the CLI's tools (D4), and the vendor's record is the only
thing that shows what the CLI offered its model. Requiring that record turns its absence from a silent pass into a
failure. ⚠ For Codex the proof is a measurement of one version, not of the turn. The run report says so (D37).

**D14b. The workspace may change only inside the host's calls.**
The host takes a manifest of the workspace: each file's path, size and modified time, with no contents read. It takes
one when the turn opens, one when each host call starts, one when each ends, and one when the turn ends. A difference
between the end of one call and the start of the next, or in the gap at either end of the turn, is a change nothing the
host ran explains. The turn is CALL_FAILED (`CLI_UNEXPLAINED_CHANGE`), and the workspace is marked tainted (D21a). The
changed paths go to the content plane, never the record plane, because they are model-chosen strings (R11).
Why: it is the one check of the CLI's own writes that rests on nothing the vendor says.
⚠ What it does not catch, stated: a CLI's own write made while a host call is running; the CLI's own reads and its
network use, which change no file; and writes outside the workspace. Those rest on the CLI's record alone (D14a, D21).
⚠ It can fail a turn falsely: a command the host ran may leave a process behind that writes after its call has ended.
That is the closed direction.
⚠ Its cost is two walks of the workspace per call. MH-1 measures it on P3's largest unit workspace before the lane uses
it.

**D15. The prompt: a host-tools preamble, the execution contract, then the turn.**
`EXECUTOR_HOST_TOOLS_PREAMBLE` is new, pinned text. It says the model's only tools are `write_file` and `run_command`
on the server `jpwb`, that the workspace is reached only through them, that no other tool will work, and that it must
not create files such as `AGENTS.md`. It names no path, port or folder. Then `EXECUTION_CONTRACT_PROMPT`, unchanged.
Where a CLI lets the host replace its system prompt, the preamble and contract go there, as they do for Pi: agy (the
agent file's body), Claude Code (`--system-prompt-file`) and Muse (`run.system_prompt`). For devin and Codex they open
the prompt. The prompt goes in a file or on stdin, never in argv, wherever the CLI allows it.
Why: some CLIs' own system prompts push the other way. devin's tells the model to explore and to create `AGENTS.md`.
Saying it once, in bytes a test pins, is cheaper than finding out in a paid run.
⚠ It changes the executor's instruction from Pi's. The E-1 record holds it (D17).

**D16. Repairs re-send. A fresh CLI process per try, carrying the instruction and every prior answer with its
findings.**
The adapter keeps turn 1's text and every answer that arrived, each with the findings the next turn carried. A repair
turn's prompt is: the instruction as sent on turn 1; then, for each earlier try in order, its answer verbatim and the
findings on it; then the turn `run-model-step` sent (the newest findings and its request). The session declares
`retainsHistory: true`: the model's context holds its prior work products and rationales, and what the reviewer found
in each.
**The bound.** The history a re-send carries is capped at `EXECUTOR_RESEND_HISTORY_CHARS` (authored). Past it, the
oldest pairs are left out whole, never cut, and the prompt says how many were left out and that the record holds them.
E-1 (D17) holds the prompt as sent, so the record shows the cut.
Why:
- the model can see that it is repeating an earlier failure, which the last pair alone would not show;
- E-1 then records exactly what the host sent (D17); on a resumed session it could record only the turn;
- no dependence on a CLI's session store (devin's shared `sessions.db`, `~/.codex/sessions`), so retention stays in
  the run folder or nowhere;
- resume is unproven headless on four of the five CLIs;
- today's agy executor sends a repair's findings ALONE to a fresh process, a turn with no task
  (`run-model-step.ts:320-328` with `retainsHistory: false`). This fixes that.
⚠ Cost, stated: the earlier tries' tool calls and their results are not carried in the prompt. Each try's E-1 holds
them (D17). The files written are still in the workspace, and the model can run commands again.
⚠ This departs from the sponsor's held-session ruling, JAN-EXECSESS, which the code records as sponsor authority
(§1.16). The producer sees what it answered and what was found, but not, in its context, the calls it made. That is a
difference in effect as well as in mechanism, so it is put to the sponsor (§7 S6), not to the lead.

**D17. E-1 is what the host sent the CLI, and what the host's server served it, in order.**
The adapter returns one JSON object as `materializedInput`:

```
{ "e1": "HOST_TO_CLI",
  "prompt": "<the composed prompt, as sent>",
  "tools": [ <the tools/list descriptors, as served> ],
  "calls": [ { "name": "…", "arguments": { … }, "result": "<the text sent back>", "isError": false } ] }
```

`calls` holds every `tools/call` that reached the host in the turn, in arrival order, with the result as sent. A call
dropped unrun has `result: null`. It is stored where every executor's E-1 is stored, RETAINED_BY_PARTICIPATION on the
content plane (§1.17). The docblock of `materializedInput` (`backing-tool.ts:271-279`) changes from "the provider
payload as sent" to "the input as sent by the host to the tool that calls the provider; for a CLI, with the host's own
transcript of the turn's tool calls".
Why: Pi's E-1 is its last provider payload, which holds every call's arguments and the result the model read.
`write_file`'s contents exist only there (`record-replay-core.ts:7-16`). The host's server holds the same facts for a
CLI, so it keeps them. What the host never sees, the CLI's own system prompt and tool schemas, is still missing (PER-9
E-1), and the record says so rather than hiding it.
⚠ The transcript is the host's, not the provider's payload. A call the CLI rejected before sending it is not in it
(D3, D21).

**D18. Bounds belong to the host.**
- **The turn.** `EXECUTOR_TURN_TIMEOUT_MS` = 4,440 s, AUTHORED. It is not derived from anything. The first draft
  derived it from "the run limit (32)", but 32 is how many process runs the observer retains (§1.3), not a limit on
  calls, and nothing bounds a step's call count (W-2). Past the bound the adapter kills the CLI's process tree, closes
  the turn gate, revokes the token, and classifies the turn CALL_ABORTED. A call cap enforced by the server would make
  the bound derivable, but it would also make the CLI executors differ from Pi, which has no cap. So it is asked, not
  chosen (§7 L8).
- **The kill.** The adapter ends the CLI's whole process tree: `taskkill /T /F /PID <cli pid>` on Windows, at the bound
  and at every turn end while the CLI is still alive. On Windows a descendant survives its parent: devin `-p` runs its
  agent in a `devin acp` child, and agy's language server spawns its stdio servers. A descendant whose parent has
  already exited is beyond `taskkill /T`'s reach. Such a survivor holds a revoked token and meets a closed gate (D2,
  D8), so it cannot act in a later turn. The tree kill's predicted red needs no model: a fake CLI that starts a
  grandchild and stays alive must leave the grandchild running when the kill is `child.kill()` alone (MH-1). The probes
  count survivors of the real CLIs after each call. If survivors appear despite the tree kill, a Job object with
  kill-on-close becomes required. It needs a native helper, so it is not the first choice.
- **A tool call in the CLI.** Each driver sets its CLI's MCP tool timeout above the 120 s command bound where it can:
  180 s (Codex `tool_timeout_sec`, Muse `tool_timeout_sec`, agy `timeoutSeconds`). ⚠ For agy only the field's TYPE was
  validated. Whether it is a per-call timeout, and what agy's default is, are unknown until P1. devin's is unknown until
  a probe. A CLI-side timeout under 120 s would show the model a failure while the host finished the command, and a
  retry would run the command twice. So each driver's probe measures it.
- **agy's own print timeout is not used.** When it expires agy returns partial output and exits 0 (1.1.28). The host
  bound replaces it.
Why: a bound under the CLI's control, or the model's, is not a bound (`execution-tool-surface.ts:119-127`).

**D19. Every turn ends as an answer or a stated cause (JAN-NOANS).**

| The CLI | The answer | Code |
|---|---|---|
| exits 0 with an answer, its surface proved (D14a), no unexplained change (D14b) | arrived | — |
| exits 0 with nothing | ENDED_WITHOUT_ANSWER | — |
| had a call refused or denied, and its record shows no assistant message after it, or its stderr says it rejected a call (devin: "rejected a tool call that requires confirmation") | CALL_FAILED, reported by TOOL | `CLI_ENDED_ON_REFUSAL` |
| outlasts the host's bound | CALL_ABORTED, naming the bound | — |
| shows its own timeout warning (agy) | CALL_ABORTED, not an answer | — |
| exits non-zero, or reports an error event | CALL_FAILED, reported by TOOL | `CLI_ERROR` |
| its record is absent, unparseable, or lacks the surface proof | CALL_FAILED, reported by TOOL | `CLI_SURFACE_UNPROVEN` |
| ran a tool of its own (D21) | CALL_FAILED, reported by TOOL | `CLI_OWN_TOOL_RAN` |
| the workspace changed outside the host's calls (D14b) | CALL_FAILED, reported by TOOL | `CLI_UNEXPLAINED_CHANGE` |
| was served by another model (D22) | CALL_FAILED, reported by TOOL | `CLI_MODEL_SUBSTITUTED` |

The first row applies only when no other row does. A breach or a substitution outranks an answer that arrived. Exit 0
with partial text after a refusal is not an answer.
Why: REG-F-410. A refusal must never become a producer shortfall. devin in print mode ends the session on a rejected
call (REG-F-549, measured on the reviewer). Without the third row, its exit 0 with partial text would be graded as an
answer that arrived, the try would be accepted, and the reviewer would find fault with unfinished work.

**D19a. A CALL_FAILED message is a code and, at most, a bounded excerpt of a known error shape.**
The message is the code and a fixed sentence for it. Only where the driver recognises its CLI's error shape (agy's
`AGY_ERROR` `short_error`; Codex's `turn.failed` message; devin's rejection line) does an excerpt follow, at most 300
characters (authored). The excerpt is withheld, and the code stands alone, when it carries any of these under
`diagnosticCarriesPrompt`'s window rule: the prompt; any argument or result the host served in the turn; the run
folder's path; the port; the token. An arbitrary stderr line never reaches the message.
Why: the message lands in the exchange's parse outcome, on the permanent record plane, which has no removal path. A CLI
error line can echo a call's arguments or results (file contents, a command's output) or a host path. R11 and D42 keep
those off that plane. A known shape is short and says what failed, and the code says the rest.

**D20. The CLI's own record is a second witness. It is required. It is never the record.**
Each driver reads what its CLI writes back (devin's ATIF export, agy's stream-json, Codex's JSONL, Claude Code's
stream-json, Muse's JSONL) for five things: the tool surface it offered (D14a), the model that served (D22), any tool it
ran itself or refused (D21), any call it rejected before sending (D3), and its error (D19a). What ran on the host is
what the host's server saw.
**Retention.** On a turn that passes, the CLI's record is not retained: `captureTry` keeps an export only beside a
NOT_OBSERVABLE report (§1.11). On a breach or an unexplained change it is the only account of what the CLI did, so it is
kept: stored PURGEABLE_AT_EXPIRY, with its pointer in the CALL_FAILED message. That rests on the same argument
`captureTry` already makes: the pointer is what keeps the stored content from being an orphan (REG-F-336 C-2).
⚠ Whether the exchange's failure message may carry that pointer is to be confirmed against `model-exchange.ts` in MH-1.
Until then it is this design's hypothesis. A typed reference remains a ratified contract change, deferred (§6).
Why: devin can hide steps from its export, and only warns when it fails to write one. A vendor's account of its own
session cannot be the evidence of what it did. But its absence must fail the turn, not pass it (D14a).

**D21. A CLI tool that ran fails the try closed. A refused attempt is recorded, and ends the turn if the CLI stopped
there.**
Each driver names its **carrier tools**: the CLI's own plumbing for reaching the host's server (devin's
`mcp_list_servers`, `mcp_list_tools` and `mcp_call_tool`; agy's MCP dispatcher and tool search, named by its probe;
Codex's code-mode `exec` cell). Then:
- **Ran.** Any other tool of the CLI's own that RAN is a breach. The turn is CALL_FAILED (`CLI_OWN_TOOL_RAN`). The tool
  is added to the observed calls with outcome UNKNOWN; the record keeps the fact that an unminted call happened and drops
  its name (§1.14). The workspace is marked tainted (D21a).
- **Refused.** A tool of its own that was DENIED or REJECTED, and a call to a host tool that the CLI rejected before
  sending it (an unknown name, a malformed argument), are added with outcome REFUSED. If the CLI's record shows no
  assistant message after the refusal, the turn is CALL_FAILED (`CLI_ENDED_ON_REFUSAL`, D19). Otherwise the try goes
  on.
- **Order.** All calls are merged in the order the CLI's record gives, since that record lists both kinds. The host
  calls in the CLI's record must match the host's own, in order and by name. If they do not, the turn is CALL_FAILED
  (`CLI_SURFACE_UNPROVEN`), because the record that placed the other calls is then not one the host can rely on.
Why: a breach means bytes reached the workspace, or commands ran, that the host did not record. A refused attempt
changed nothing, and recording it is what NOT_MINTED is for. Ordinals on the permanent record are load-bearing
(§1.14), so a call appended out of place would be recorded as though it happened later than it did.
⚠ Residual, per driver: where a CLI's record does not carry its rejected attempts, they are lost, which they are not
for Pi. §4 says which.

**D21a. A breach taints the workspace.**
On `CLI_OWN_TOOL_RAN` or `CLI_UNEXPLAINED_CHANGE`, the host writes a marker BESIDE the Undertaking's workspace, never
inside it, naming the try and the code. Begin & Execute and re-run refuse while the marker exists (`WORKSPACE_TAINTED`),
until a person clears it by a recorded act (§7 L7). The changed paths D14b found, and the CLI's record kept by D20, are
where that person looks.
Why: a re-run reuses the workspace ("files it wrote may still be in the workspace", `run-model-step.ts:211`). A later
try's review and evidence could then rest on bytes no one recorded. Restoring a snapshot taken before each turn would
also close the hole, at the cost of a workspace copy per turn. It is the alternative if the lead prefers it (L7).

**D22. The model is read back where the CLI reports it, and a substitute fails the try.**
- **devin:** every distinct `steps[].extra.generation_model`, not only the last, as the reviewer reads it (§1.7).
  ⚠ The exact echo was measured only for GLM, on the reviewer. Whether devin echoes the model a devin executor will run
  (S2) as that same string, and whether its internal steps use other models, is measured by MH-0a's call 1, run on that
  model, before MH-4 pins the compare. PROVIDER_REPORTED.
- **Claude Code:** every main-thread `assistant` `message.model`. PROVIDER_REPORTED.
- **agy:** HOST_CONFIGURED, and only once its probe shows that `--model` governs an `--agent` session (§4.2). Its log
  line `model_resolver.go:155 … resolved to …` is read as a substitution signal. That line appears only if agy resolves
  the `--model` value at all, which is the same open question, so it is no evidence until the probe answers it.
- **Codex:** HOST_CONFIGURED. With `--ephemeral` there is no rollout, so `turn_context.model` cannot be cross-checked.
  The only substitution signal is a `model_reroute` event, and whether `--json` carries one is unknown until Probe 0 or
  Probe 1. Until it is shown, a Codex substitution cannot be detected, and the run report says so (D37).
- **Muse:** HOST_CONFIGURED until its probe.
- If the reported set is not exactly the configured model, the try fails (D19). This is the reviewer's own rule,
  JAN-SELREV D6, applied to the executor.
Why: REG-D-052. A model nobody chose must not do the work while the record names the one chosen. agy 1.4.2 quietly
runs another model for a stale label (REG-F-331's shape).

**D23. Reasoning a CLI returns is volunteered reasoning, never the answer.**
Where a CLI's record carries reasoning apart from its answer (Codex `reasoning` items, a thinking block), the driver
returns it as `volunteeredReasoning`. Retention then follows PER-12, as for Pi.
⚠ Behaviour change: Pi runs with `thinkingLevel: 'off'` (`pi-executor.ts:194`). The sponsor's defaults choose effort
levels (Max, High), and Opus 5.5 cannot turn thinking off at all. So the PER-12 hazard is managed here, not avoided:
the reviewer still receives only the work product (`run-model-step.ts:345-348`).

**D24. A CLI's stderr is bound in one place, read, and never retained.**
The opener binds the child's stderr. A driver never touches the child: the opener hands it the lines it read, for
classification only (agy's `AGY_ERROR` line and its timeout warning; devin's rejection line; the CLIs' error text).
Only a code and a checked excerpt can reach a record (D19a).
Why: binding a child's stderr reddens `verif/agy-stderr-unbound.test.ts`. Its rule is that a binding arrives with a
retention disposition in the same commit (REG-Q-066), and its list of disposed sites is pinned (§1.18). One binding
means one new entry, `lib/server/tools/cli-executor-session.ts`, added in MH-1 with this disposition in that file's
header. ⚠ That gate walks syntax. If it counts a driver's parameter as a binding, that driver's file joins the list in
its own package, with its disposition, in the same commit.

### D. One driver per CLI

**D25. devin: build it.** Feasible if four probe questions answer yes (§4.1). Its default model equals the reviewer's,
so it cannot run on its default today (D33). Its probes run on the model the sponsor picks for it (S2), because the
identity compare must be measured on the model it will run (D22).

**D26. agy: build it first. It is P5's.** Feasible if its free probe shows that `.agents/` loads from a fresh folder
and that `--model` governs an `--agent` session, and one paid call answers yes (§4.2).

**D27. Codex: build it, behind its probes.** Very likely feasible. The investigation found it very likely, not certain,
that Codex shares Pi's ChatGPT quota; if it does, it gives harness independence, not quota independence. Its runtime
tool surface cannot be read, so the driver is pinned to the version Probe 0 measured (D14a). It cannot be called live
before 2026-10-22 02:13 (§4.3).

**D28. Muse: designed, not built, until the sponsor answers the governance question.** Technically likely (§4.4). Its
terms are unread, its launcher says it is "available to Meta employees" while its manifest says public, and its
contributor mode can use content for product improvement. The sponsor said "if Muse … can support it". Whether its use
is permitted is theirs to say.

**D29. Claude Code: designed, not built.** The sponsor deferred it. Technically it fits best of the five (§4.5). The
host IS logged in to a claude.ai Max account (`claude auth status`), but Anthropic's docs ask a product to use a
Console API key. Which account is suitable is the sponsor's call. A Console key would reach the CLI through the secret
channel (D43).

### E. The selector and identity

**D30. `WIRED_EXECUTORS` grows one tool at a time, each with its driver and its probe evidence.**
The selection gains `CLI { toolId, modelId, effort? }`. It lands in MH-1 together with its `getExecutionSession` branch
(which opens it through `openCliExecutionSession` with the tool's driver) and its `executorRecordIdentity` arm. The kind
cannot land without the branch, because of the exhaustive check, and without the arm it would be recorded as `pi`
(§1.19). Nothing selects it until a driver's package adds its tool to `WIRED_EXECUTORS`. agy does so in MH-5, re-pointed
from the text-only opener, which is retired and struck in place. devin and Codex enter the table only in the package
that lands their driver, after their probes.
Why: "wired" must keep meaning "a host adapter exists and was driven" (`executor-selection.ts:81-85`). A text-only
executor cannot do Phase 7's work, and two agy executors would need two tool ids.

**D31. The sponsor's defaults are named, and never applied.**
`EXECUTOR_DEFAULT_MODELS`: devin `glm-5-3-flash-max`; agy `gemini-4-argon-high`; Codex `gpt-5.6-sol` (effort not
named); Claude Code `claude-opus-5-5`, effort `max`. The refusal's guidance names the default for the tool the operator
chose, and the Phase 7 lane uses them as its documented settings. `JPWB_EXECUTOR_MODEL` is still required.
Why: REG-D-052 stands until the sponsor amends it, and REG-F-331 is why: a pinned label rotted and every review failed.
agy updated itself today, 1.4.2 replacing 1.3.x. A default the selector filled in would rot the same way, silently. The
sponsor may want the selector to fill them; that would amend REG-D-052, and is asked (§7 S1).

**D32. `JPWB_EXECUTOR_EFFORT`, required where the model id names no effort.**
Required for Codex, Claude Code and Muse, whose CLIs take effort as a separate flag. Refused for Pi, devin and agy:
their slugs carry the effort (`-max`, `-high`), and Pi runs with thinking off. ⚠ agy also has an `--effort` flag. The
driver never passes it. Whether it would override the slug's effort is unknown; P0's `/model` shows the effort that
resolved. Refusal codes: `EXECUTOR_EFFORT_UNSET` and `EXECUTOR_EFFORT_NOT_TAKEN`.
Why: an unset effort lets the CLI's user config decide. This host's Codex config says `ultra`. A variable that is read
by nothing must not look as though it took effect (the lane's rule for `JPWB_REVIEW_SEES_PRIOR`, applied here).

**D33. The selector refuses an executor model that is the reviewer's, or one it cannot classify.**
New refusals `EXECUTOR_MODEL_IS_THE_REVIEWERS` and `EXECUTOR_MODEL_UNCLASSIFIED`, asked after the model is known. The
selector is handed the reviewer that the same request's preflight selected (`assurancePreflight` returns it;
`+page.server.ts:2302-2324` and `:3320-3323` ask both, in that order).
- It refuses with `EXECUTOR_MODEL_IS_THE_REVIEWERS` when the executor's model equals the reviewer's exactly, or both sit
  in one family of `MODEL_FAMILIES`.
- It refuses with `EXECUTOR_MODEL_UNCLASSIFIED` when, with a real reviewer selected, the executor's slug or the
  reviewer's is not in the table. The guidance names the slug, and says the table must be extended from a measured
  listing before that model can run.
`MODEL_FAMILIES` lists the slugs and labels the CLIs' own listings gave (`devin models list`, `agy models`,
`codex debug models`; Claude Code's from its docs, marked so) and Pi's, from the models P3 ran (marked so), under four
families: GLM-5.3 Flash, Gemini 4 Argon, GPT-5.6 Sol, Claude Opus 5.5. In test mode, with the stand-in reviewer, there
is nothing to compare.
Why: the floor's DIFFERENT_MODEL would refuse every phase, but only after the paid work. The family closes the hole
the guidance already names: another spelling or effort of the reviewer's model passes the exact compare falsely. An
exact compare for slugs the table does not list would reopen it: a new effort level or a dated suffix of the
reviewer's model would pass both the selector and the floor. The table is a declaration from measured listings, not a
normaliser over model names.
Consequence, stated: a devin executor on its default, `glm-5-3-flash-max`, is refused while the reviewer is
`glm-5-3-flash-max`. The account offers other models (`gemini-4-argon-high`, `gpt-5-6-sol-*`, `claude-opus-5-5-max`),
and a devin executor on one of them passes. Its providerId would be `devin`, the reviewer's too, so DIFFERENT_PROVIDER
would fail if it were ever required. It is not today. And Pi is refused on a model the table does not list (§8).

**D34. A program override is refused outside test mode, for every CLI.**
`JPWB_DEVIN_BIN` and `JPWB_AGY_BIN` already are. Add `JPWB_CODEX_BIN`, and later `JPWB_MUSE_BIN` and
`JPWB_CLAUDE_BIN`, each captured at module load as `DEVIN_BIN_OVERRIDE` is. Each becomes a key of
`ExecutorProgramOverrides`, which becomes its own type, `ReviewerProgramOverrides & { readonly codex: string | undefined }`,
because the reviewer has no Codex (§1.20).
Why: REG-F-459. The record names the tool, whatever program ran.

**D35. The record names the tool as the provider.**
`producer` is `{ agentId: 'execution.model-invocation', modelId, providerId: <tool id> }`, as the devin reviewer names
`devin` (`devin-reviewer.ts:211-216`). `executorRecordIdentity` returns the same for a CLI selection (D30).
A new tool's `BACKING_TOOLS` entry lands only with its probe's measured values, as that table's header requires
(`backing-tool.ts:56-63`).
Why: a broker serves many vendors' models. Naming the vendor would claim a relationship the host cannot see.

### F. The Phase 7 lane, the run report, the replay

**D36. The lane learns each executor.**
- Its `WIRED_EXECUTORS` mirror (`lane-config.ts:71`) follows the product's.
- The rule "no agy executor" (`:129-135`) is struck. In its place, `EXECUTOR_IDENTITY_EVIDENCE`: the grade each wired
  executor earns (pi and devin PROVIDER_REPORTED; agy and Codex HOST_CONFIGURED). The spec asserts the selected
  executor's grade, as it already does for reviewers (`REVIEWER_IDENTITY_EVIDENCE`).
- `JPWB_EXECUTOR_EFFORT` is a required key where D32 requires it.
- The boot record gains an executor readiness check that calls no model: the CLI's `--version`, its model listing
  holding the configured model as a whole id (`modelListed`), its own login status where it has one, and the driver's
  no-model preflight in a sample run folder. The final archive reads the version again.
- The boot and the final archive record the size and modified time of each config source the drivers declare (D44a),
  by name, never its contents and never a credential file. The product itself refuses a turn on a change (D44a); the
  lane's record shows a change made between runs.
- The executor's per-call allowance (`LANE_BUDGET.executorCallMs`) becomes the product's turn bound by reference, and
  the phase allowance is re-derived so command time is counted once.
Why: P5 runs on agy, and the lane must neither refuse it nor pass it on a grade it cannot earn. A CLI that updates
itself mid-run, or a run that changed a global config, must show in the record.

**D37. The run report names the executor.**
One header line: the tool, its version at boot and at the end, the configured model and effort, the model or models
the EXECUTION-plane exchanges recorded with their grade and count. When that is not P3's executor, Pi with
`gpt-5.6-sol`, the "always states" list gains a caveat: the cells measure another producer, and do not compare one for
one with P3's. When the grade is HOST_CONFIGURED, the line says the model is the host's configuration, not the tool's
report. When the executor is Codex, the line says that its tool surface is the measured version's, not the turn's
(D14a), and that a model substitution cannot be detected (D22).
Why: P5's cells will be read beside P3's. A reader must know the producer changed, not infer it.

**D38. The replay declines non-Pi executors, at recording, by name.**
`record-replay-core.ts` refuses an archive whose boot names an executor other than `pi`, before it reads any payload:
"the replay records Pi executor runs only; this run's executor was agy". The replay's executor arm is unchanged, and
still replays any Pi recording on any host.
Why: a CLI executor's E-1 is the host's envelope (D17). It now holds the calls' arguments and results, which a
recording needs, but not the instructions and tool schemas the CLI added, so the try's key cannot be built as Pi's is.
Today such a run would be refused anyway, for a payload reason that names the wrong cause: the envelope carries no
`input` list (`record-replay-core.ts:213`). A plain-text E-1 would be refused at `:209`. Replaying CLI runs from the
envelope is deferred (§6).

**D39. The new variables join the gate's isolation lists, each where its kind belongs.**
- `JPWB_EXECUTOR_EFFORT` is a selection read from the environment. It joins `LIVE_BACKEND_VARIABLES`
  (`verif/live-backend-isolation.ts`) and the replay's list of live selections refused beside it
  (`LIVE_SELECTIONS_BESIDE_A_REPLAY`, `replay/replay-switch.ts:40`).
- `JPWB_CODEX_BIN`, and later `JPWB_MUSE_BIN` and `JPWB_CLAUDE_BIN`, are program overrides. They join
  `LIVE_BACKEND_VARIABLES`, but NOT the replay's environment list, which by design leaves overrides out (§1.20). Each
  becomes a key of `ExecutorProgramOverrides` (D34), of the selector's capture, and of `liveSelectionsBesideReplay`'s
  `overrides` argument (`replay-switch.ts:57`).
`turbo.json` declares no task environment, so turbo's strict mode already passes none of them; nothing is added there.
Why: each one turns the gate's stand-ins toward a real, paid backend. An operator's exported shell must not do that.

### G. Security

**D40. No secret in argv.** Prompts go in files or on stdin. Each turn's token goes in the endpoint file. A test asserts
that no turn's token is in any argv element of any driver.

**D41. Each turn's token lives in one file outside the CLI's working folder, and nowhere else.**
`<run>/host/endpoint.json`, rewritten before each turn's spawn (D2), read by the bridge when it starts. It is in no
environment variable, no argv, no stream the adapter keeps, and no field it returns. The folder lives under the
dedicated root (D13), is removed on dispose, and is swept at server start if a kill left it behind. Where a CLI would
take a direct HTTP entry instead (§6), its header would sit in that CLI's run-folder config file, never in an
environment variable.

**D42. No secret in a record.** The token, the port and the run folder's path reach no record. A test asserts that none
of them appears in the returned `ToolInvocationResult`, its failure message, or the exchange the step records. The
failure message's own check is D19a's. The boot record keeps a variable whose name says it is a secret only as its
length (`phase7-operator.ts:110-136`), and the token is not a variable.

**D43. The CLI's environment is an allowlist, never the server's.**
The CLI gets `childEnvironment`'s allowlist (exported from `child-process-runner.ts`, one list for both users) plus
constants its driver declares: for example `DEVIN_SESSIONS_DIR=<run>/host/sessions`, `MUSE_NO_AUTO_UPDATE=1`,
`DISABLE_AUTOUPDATER=1`, `ENABLE_CLAUDEAI_MCP_SERVERS=false`.
**A secret, if one is ever needed** (S3's `CODEX_API_KEY`, S5's Console key, Muse's `META_API_KEY`), goes through a
channel each driver declares by variable name. The opener reads it and gives it to the CLI process's environment only.
It is never added to the shared allowlist, which also serves the commands the model runs, so widening the allowlist
for a CLI would hand the secret to every model-run command. The boot record holds its length only. The bridge, which
the CLI starts, may inherit it, and logs nothing. No driver declares a secret today.
Why: a provider key in the server's environment would silently change account and billing (Claude Code uses
`ANTHROPIC_API_KEY` whenever it is present under `-p`; Muse prefers `META_API_KEY` to its login).

**D44. The CLIs' global configs are never written.** No adapter runs `mcp add` for any CLI, writes agy's
`settings.json` or `config.json`, or touches `~/.codex/config.toml`, `%APPDATA%\devin\config.json` or
`~/.claude.json`. Every control is a run-folder file or a per-run flag (devin `--config`; Codex `--ignore-user-config`
and `-c`; Claude Code `--restricted` and `--settings`; Muse `-c`). A test writes each driver's run folder into a temp
folder and asserts every path written is inside it.
⚠ The CLIs' own data stores are another matter. Where a CLI can be told to keep a run's content out of its store, the
driver tells it (devin `DEVIN_SESSIONS_DIR` into the run folder; agy `--log-file`; Codex `--ephemeral`; Claude Code
`--no-session-persistence`; Muse `--no-session-log`). agy's conversations cannot be moved: each run leaves one in the
operator's `~/.gemini/antigravity-cli/conversations`. That is a PER-9/PER-12 retention residual, stated.

**D44a. Every config source a CLI reads is fingerprinted before each turn, and a change refuses the turn.**
Each driver declares the files its CLI reads configuration from, taken from its investigation: for devin,
`%APPDATA%\devin\config.json`, its global rules, and `~/.claude/settings.json` (devin reads it while
`read_config_from.claude` is on); for agy, its `settings.json`, its `config.json` and its global hooks; for Codex,
`~/.codex/config.toml` and its global `AGENTS.md`; for Claude Code, `~/.claude/settings.json` and `~/.claude.json`; and,
for every CLI, the dedicated root's ancestors (D13). Before each turn the opener records each one's name, size and
modified time, by `stat` alone. No file is opened, contents are never read, and no credential file is listed. A change
since the session opened refuses the turn with `EXECUTOR_CONFIG_CHANGED`, naming the source.
Why: `run_command` is arbitrary code as the server user (R12, R13), so the model can write any file a CLI reads, and a
fresh CLI per try (D16) re-reads all of them. Fingerprints taken only at boot and at the end (D36) would show a mid-run
change only afterwards, after it had steered the next try.
⚠ A CLI may write some of these files itself during a normal run (a last-used model, a trust list). Each probe
measures which files change when nobody edits them, as its predicted red. Those are left out of the refusal, and the
driver lists them as a residual.
⚠ The devin reviewer reads the same global files on every review. Its own check, and `read_config_from` set to false
in its project config, are the reviewer's changes to make (§7 L5).

**D45. Each CLI sends the prompt and every tool result to its vendor.** That is true of Pi too. Muse adds contributor
mode, switched off per run by `--contributor-mode off`, and telemetry, switched off by `-c telemetry.enabled=false`.
Both were validated offline only; whether they take effect is unknown until Muse's P1 (§5). Claude Code's claude.ai
connectors (this host's Gmail, Drive and Calendar) are shut out three ways (§4.5).

**D46. Probes run outside the product, on each CLI's own account, and are recorded.** They use scratch folders and a
stand-in of the shipping path (D47), never this repository's checkout. Their findings go into the register before any
count is quoted.

### H. Probes before drivers

**D47. Each driver's unknowns are answered by its smallest probe, through a stand-in of the shipping path, and every
control has an arm that must come out the other way.**
- **The shipping path, not a toy.** Each probe's MCP entry is a stdio relay written to D10's contract (newline JSON-RPC
  relayed as one POST each; the endpoint file outside the CLI's cwd), launched by an absolute `node` path, as
  `process.execPath` would be. It relays to a stand-in HTTP server on 127.0.0.1 that serves the minted schemas:
  `toTypeBox` of the real `write_file` and `run_command` parameters, dumped by a script that calls no model
  (`argv: string[]`, not the toy's `command: string`). The stand-in carries out `write_file` in a scratch workspace,
  returns a fixed result for `run_command`, and logs every call. Its bytes are kept with the probe's record, so any
  difference from MH-1's bridge is visible.
- **Positive controls.** A probe that sees nothing must not pass. Each check that something is absent has a run in which
  it must be present (§5).
- **What only the shipping path can answer.** Whether loopback HTTP from the relay works under the CLI's sandbox network
  policy (Codex's restricted network, Muse's proxy-only mode). Whether the environment the CLI gives its MCP servers
  still runs `node` (Muse's allowlist, possibly without `SYSTEMROOT`).
Why: a probe that tests a toy measures the toy. The first draft's probes ran `node` found on `PATH`, against a toy
server whose `run_command` took a string, so what shipped would not have been what was measured.

---

## 4. The drivers

Each section gives the run folder's files, the argv, the carriers, the identity, the surface checks, the repair mode,
and what is still unknown. `cli/` and `host/` are the run folder's two subfolders (D13).

### 4.1 devin (3000.11.92)

- **Run folder**
  - `cli/.devin/config.json`: `permissions.deny` = `read, edit, write, grep, glob, exec, web_search, Fetch(*)`;
    `permissions.allow` = `mcp__jpwb__*`; all seven `read_config_from` false. ⛔ Not the reviewer's `mcp__*` deny:
    a deny always wins, so it would block the host's tools too.
  - `cli/.devin/mcp_config.json`: one server, `jpwb`, stdio, the bridge.
  - `host/user-config.json`, passed as `--config`. Its bytes are the probe's `userconf/config.json`: `version: 1`;
    `subagents_enabled: false`; `skip_workspace_trust: true`; `disabled_tools` = `read, notebook_read, code_search,
    grep, glob, edit, write, apply_patch, notebook_edit, exec, shell_command, get_output, write_to_process, kill_shell,
    webfetch, web_search, view_image, browser_preview, close_browser_preview, skill, run_subagent, read_subagent,
    request_scope, todo_write, mcp_read_resource` (25); all seven `read_config_from` false;
    `proxy: { mode: "system", no_proxy: "127.0.0.1,localhost" }`. The driver pins the bytes MH-0a ran with, and any
    change to them is a new probe.
- **Preflight, no model call:** `devin mcp list` in `cli/`, with `--config`. Refuse unless the only entry is `jpwb`
  with its Source inside the run folder. This also catches a user-level server created later. It lists servers only
  (D14).
- **Argv:** `--print --model <m> --prompt-file <run>/host/prompt-<n>.txt --export <run>/host/export-<n>.json
  --respect-workspace-trust false --config <run>/host/user-config.json`. Never `--permission-mode dangerous`.
- **Environment:** the allowlist, plus `DEVIN_SESSIONS_DIR=<run>/host/sessions`.
- **Carriers:** `mcp_list_servers`, `mcp_list_tools`, `mcp_call_tool`. devin's own prompt says the model must list a
  server's tools before calling one, so every turn spends a step on it.
- **Identity:** PROVIDER_REPORTED from the export, every step's `generation_model`, compared with the set MH-0a
  measured on the model S2 picks (D22).
- **Surface proof (D14a):** the export's `tool_definitions`, each entry a carrier (or a host tool, if devin lists MCP
  tools separately). The calls that ran come from `tool_calls[].function_name`, checked against the carriers and
  `mcp__jpwb__*`. Unknown until a probe: which spelling the export uses, and what `tool_definitions` holds.
- **Refusal:** print mode ends the session on a rejected call (REG-F-549, measured on the reviewer). The driver
  classifies it `CLI_ENDED_ON_REFUSAL`, from the stderr line or the export (D19). MH-0a's call 2 asserts that
  classification.
- **Config sources (D44a):** `%APPDATA%\devin\config.json`, its global rules, `~/.claude/settings.json`.
- **Repair:** re-send (D16). Resume (`-p -r <session_id>`) is MH-12's, with its probe.
- **Default model:** `glm-5-3-flash-max`, refused against the GLM reviewer (D33).
- **Unknown until a probe:** whether `allow mcp__jpwb__*` approves a call made through `mcp_call_tool` in print mode;
  whether `mcp_list_tools` itself needs approval; whether `disabled_tools` hides every built-in (`tool_definitions`
  shows it); whether an assistant message ever follows a rejected call; whether the export records calls devin rejected
  before sending them (if not, that loss is this driver's residual, D21); how far devin walks up for `.devin`; which
  global files devin writes by itself; whether devin echoes S2's model as the same string.
- **Side finding for the reviewer, not this design's to fix:** `DENY_ALL_TOOLS_CONFIG` (`devin-reviewer.ts:94-98`)
  names neither `write` nor `web_search`, which 3000.11.92 recognises, and its deny rules were measured on 3000.11.3.
  It leaves `read_config_from.claude` on, so the reviewer reads `~/.claude/settings.json` hooks. And it reads only the
  last step's model (§1.7). All are filed together (§7 L5).

### 4.2 agy (1.4.2) — P5's executor

- **Run folder (`cli/` is agy's workspace: agy's workspace is its cwd)**
  - `cli/.agents/agents/jpwb-executor.md`. Frontmatter: `inheritCustomizations: false`, `inheritMcp: false`,
    `excludeDefaultComponents: true`, `commandExecutionPolicy: off`, `tools: [<the MCP dispatcher>]`, and one
    `mcpServers` item: `name: jpwb`, `command`, `args` (the bridge and the endpoint file, both in `host/`),
    `enabledTools: [write_file, run_command]`, `timeoutSeconds: 180`. Body: the preamble and the contract. The field
    types were confirmed with agy's offline validator; the dispatcher's name is not known yet.
  - `cli/.agents/hooks.json`: a PreToolUse hook that allows the MCP step for `jpwb` and denies every other tool. A
    second guard, run-scoped.
- **Preflight, every turn:** `-p "/hooks"` in `cli/`. Refuse unless the only hook listed is the run folder's own.
  `excludeDefaultComponents` keeps hooks, and a user-level hook would run a command on each tool call that neither the
  host nor stream-json records. This holds only if P0 shows that `/hooks` makes no model request; if it does, the check
  moves to the lane's boot, and the gap between boots is a stated residual.
- **Argv:** `--agent jpwb-executor --model gemini-4-argon-high --input-format stream-json --output-format stream-json
  --log-file <run>/host/agy.log --disable-slash-commands`, with the turn as one NDJSON line on stdin. No `--effort`
  (D32). No `--print-timeout` (D18). Never `--mode accept-edits`, which approves agy's own file writes. Never
  `--dangerously-skip-permissions` unless the probes show no other route, and then only by decision (§7 L3).
- **Fallback for the prompt:** if the stdin line's shape cannot be found free (P0), the turn rides in argv under the
  existing 28,000-character cap, and the failure diagnostic is sanitised as `agyCall` does.
- **Environment:** the allowlist, plus `AGY_CLI_DISABLE_AUTO_UPDATE=1`, whose effect is unverified. agy updates itself
  at launch, so the lane records its version at boot and at the end (D36).
- **Carriers:** the MCP dispatcher and tool search, by the names P1 shows.
- **Identity:** HOST_CONFIGURED, and only once a probe shows that `--model` governs an `--agent` session. The
  investigation left that open, and the agent file's frontmatter `model` field takes only a tier. The operator's
  settings default is "Gemini 4 Argon (High)", the same model P5 runs, so a run on `gemini-4-argon-high` cannot tell
  which one governed: the log's `label="Gemini 4 Argon (High)"` appears either way. **The predicted red:** P0
  (`-p "/model" --agent jpwb-executor`), or P1, passes a `--model` the settings do not name, a cheaper model from
  `agy models`. The log's resolved label must follow `--model`. If it follows the settings, the agy executor is refused
  until the agent's tier can be pinned to the configured model, and if the tier field cannot express
  `gemini-4-argon-high`, P5's route goes back to the sponsor (§0). Once that is settled, the log's resolution lines say
  what agy asked the backend for. They do not attest what served. A `model_resolver.go:155` alias line fails the try.
- **Surface proof (D14a):** the init and `step_update` data, with the fields P1 shows. Any non-MCP `tool_info` step
  that ran is a breach; `denied_actions` are refused attempts. Unknown until P1: whether stream-json records a call agy
  rejected for an undeclared argument (if not, that loss is this driver's residual, D21).
- **Config sources (D44a):** agy's `settings.json`, `config.json` and global hooks.
- **Repair:** re-send (D16). One NDJSON line per turn in one process, or `--conversation <id>`, would keep one bridge
  and so one token across turns. It belongs with resume (MH-12), and the probe for it (P4) moves there.
- **Windows:** headless agy refuses shell commands and has no auto mode on this host. That no longer matters: the
  commands are the host's `run_command`.
- **Unknown until a probe:** whether headless agy loads `.agents/` from a fresh, untrusted folder (P0 answers it free);
  whether `--model` governs an `--agent` session (P0 or P1); whether `/hooks` is free of model calls (P0); which route
  lets the host's tools run without a prompt (a hook allow, a settings allow-rule, or the skip flag); whether
  `excludeDefaultComponents` removes the shell and file tools while keeping MCP; whether `timeoutSeconds` is a per-call
  timeout, and agy's default (P1); whether `alwaysLoad` in `_meta` still holds in 1.4.2; which global files agy writes
  by itself.
- **If P0 fails:** there is no documented run-scoped route. The routes left are: run folders under one folder the
  operator trusts once, by hand (whether trust passes to subfolders is unknown); or a one-time global allow-rule
  `mcp(jpwb/*)`, set by a person and recorded at boot. Both touch agy's global settings, so both are the sponsor's or
  operator's acts, never the adapter's. The other choice is the same model through devin (§0).

### 4.3 Codex (0.162.1)

- **Run folder:** `host/catalog.json`, a one-model catalog for `gpt-5.6-sol` with `shell_type: "disabled"`,
  `apply_patch_tool_type: null`, `multi_agent_version: null` and `tool_mode: "direct"`; the bridge; the endpoint file.
- **Argv:** `exec --ignore-user-config --skip-git-repo-check --ephemeral --json -o <run>/host/last-<n>.txt -C <run>/cli
  -s read-only -m gpt-5.6-sol -c model_reasoning_effort="<effort>" -c approval_policy="never"
  -c approvals_reviewer="user" -c web_search="disabled" -c project_doc_max_bytes=0
  -c model_catalog_json="<run>/host/catalog.json"`, the `--disable` set (`shell_tool, plugins, apps, multi_agent,
  browser_use, computer_use, in_app_browser, image_generation, view_image, memories, goals, hooks, sleep_tool,
  tool_suggest, skill_search`), and `-c mcp_servers.jpwb={command=…, args=[…], required=true, startup_timeout_sec=30,
  tool_timeout_sec=180, default_tools_approval_mode="approve", enabled_tools=["write_file","run_command"],
  supports_parallel_tool_calls=false}`, then `-` with the prompt on stdin.
  ⚠ `-C <run>/cli` sets the working folder only. The read-only sandbox forbids writes everywhere and allows reads
  everywhere; it does not confine anything to the run folder.
  ⛔ Never `--approve-for-me` (an auto-review subagent spends hidden calls) and never
  `--dangerously-bypass-approvals-and-sandbox`. `approvals_reviewer="user"` matters: this host's config routes
  approvals to an auto-review thread on the same quota.
- **Carriers:** the code-mode `exec` cell, only if the catalog keeps code mode. Its nested calls appear as
  `mcp_tool_call` items.
- **Identity:** HOST_CONFIGURED. The JSONL carries no model, and `--ephemeral` writes no rollout, so
  `turn_context.model` cannot be cross-checked. A `model_reroute` event, if `--json` carries one, fails the try. Whether
  it does is unknown until Probe 0 or Probe 1 (D22).
- **Surface proof (D14a):** none at runtime. Probe 0's mock sees the request's tools array, for one version. The driver
  refuses any `codex --version` other than the one Probe 0 measured, and the run report says the surface is that
  version's (D37). In the JSONL, a `command_execution`, `file_change`, `web_search` or `collab_tool_call` item that
  completed is a breach; one that was declined is a refused attempt; `mcp_tool_call` on `jpwb` is the host's.
- **Repair:** re-send (D16). `exec resume` is unusable with `--ephemeral`.
- **Effort:** required (D32). The sponsor named none (§7 S3).
- **Quota:** very likely the same ChatGPT account as Pi's `openai-codex` provider (the investigation's word; not
  settled). If so, when Pi is out, Codex is out.
- **Config sources (D44a):** `~/.codex/config.toml` (ignored by `--ignore-user-config`, fingerprinted anyway) and its
  global `AGENTS.md`.
- **Unknown until a probe:** whether `--disable shell_tool` alone removes unified `exec_command`; whether the custom
  catalog leaves only the host's tools; whether `approve` avoids every approval event; whether a refused `apply_patch`
  leaves no file, given the positive arm (§5); whether the Windows sandbox setup is still attempted; whether the MCP
  server's process runs inside the sandbox, and whether its loopback HTTP is allowed there; whether `--json` carries
  `model_reroute`.

### 4.4 Muse (1.4.10) — designed; build gated on governance

- **Program:** the versioned binary, never `muse.cmd`: node refuses a batch target with `shell: false`, and the product
  refuses a program override outside test mode. The driver resolves the binary from the install's release manifest.
  Its field names are unknown until read.
- **Argv:** `exec --provider meta --model <m> --reasoning-effort <e> --prompt-file <run>/host/prompt-<n>.txt --json
  --disable-shell --disable-write --disable-web-tools --disable-reminders --disable-request-user-input
  --no-foreign-personal-context --approval-mode never --approval-judge off --contributor-mode off --no-session-log
  -c telemetry.enabled=false -c run.toolset=["mcp__jpwb__write_file","mcp__jpwb__run_command"]
  -c mcpServers.jpwb={"type":"stdio","command":…,"args":[…],"framing":"lineDelimitedJson"}`. Never `--yolo`. The
  approval judge is an extra model call, so it is off.
- **Environment:** the allowlist, plus `MUSE_NO_AUTO_UPDATE=1`, and `MUSE_ENABLE_SESSION_MCP` if the probe needs it. If
  `META_API_KEY` is ever chosen, it goes through the secret channel (D43).
- **Identity:** HOST_CONFIGURED until P2 shows a reported-model field.
- **Surface proof (D14a):** unknown until P1.
- **Note:** per-server `enabled_tools` is "stored, not enforced yet" in Muse. That is harmless here: the host serves
  only the minted tools (D3).
- **Unknown until a probe:** whether telemetry and contributor mode are off in effect (validated offline only, D45);
  whether the relay reaches loopback under Muse's proxy-only network mode; whether Muse's filtered MCP environment
  still runs `node` (it may lack `SYSTEMROOT`).
- **Default model:** none named; the catalog's default today is `muse-wonder-1.0` (§7 S4).

### 4.5 Claude Code (2.1.299) — designed; deferred

- **Argv:** `-p --input-format stream-json --output-format stream-json --verbose --restricted --strict-mcp-config
  --mcp-config <run>/host/mcp.json --tools "" --disable-slash-commands --allowedTools mcp__jpwb__write_file
  mcp__jpwb__run_command --permission-mode dontAsk --permission-prompts none --settings <run>/host/settings.json
  --system-prompt-file <run>/host/contract.txt --model claude-opus-5-5 --effort max --no-session-persistence
  --max-turns <n>`. User turns go on stdin with `client_composed: true`, so an `@path` in an instruction is never read.
- **Settings:** `disableAllHooks`, `switchModelsOnFlag: false`, `disableClaudeAiConnectors`, `autoMemoryEnabled: false`.
- **Environment:** the allowlist, plus `ENABLE_CLAUDEAI_MCP_SERVERS=false`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`,
  `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, `ENABLE_TOOL_SEARCH=false`,
  `DISABLE_AUTOUPDATER=1`. The allowlist keeps out `ANTHROPIC_API_KEY`; a Console key, if S5 chooses one, goes through
  the secret channel (D43).
- **Surface proof inside the turn (D14a):** refuse unless `system/init` shows tools equal to the two minted names,
  `mcp_servers` equal to `jpwb` connected with no errors, no plugins and no skills, `permissionMode` `dontAsk`, and the
  configured model and effort. The claude.ai connectors are shut out three ways (flag, setting, environment), and this
  check shows it.
- **Identity:** PROVIDER_REPORTED from `message.model`.
- **Config sources (D44a):** `~/.claude/settings.json`, `~/.claude.json`.
- **Its server must not be named `workspace`,** which Claude Code reserves. `jpwb` is fine.
- **Open:** the account (§7 S5); Opus 5.5 cannot turn thinking off (D23); the composite request payload is out of
  reach (PER-9 E-1), as for every CLI; and the `-p` escape D13 cites (`.mcp.json` and hooks loaded without asking) is
  documented, not measured.

---

## 5. The probe plan

Each runs on its own account, from scratch folders, through the stand-in of the shipping path (D47). None counts toward
the 450 reviewer calls. The sponsor approved about 3–5 per CLI (Q4). The confirmation and control calls of MH-9 are
counted within that budget, and the resume probes move to MH-12, which will ask for its own.

| CLI | Probe | Model calls | Answers | The arm that must come out the other way |
|---|---|---|---|---|
| devin | 1. allow present, on the model S2 picks | 1 | `mcp_call_tool` approved in print mode; the export's `function_name` spelling; what `tool_definitions` holds (the surface proof's shape); the `generation_model` set on that model; the per-call tool timeout; which global files changed by themselves; `_meta` ignored | call 2 |
| devin | 2. allow removed | 1 | how a rejected call shows: stderr line, export, exit code; whether an assistant message follows | MUST show no `tools/call` in the stand-in's log and a rejection on stderr, and classify `CLI_ENDED_ON_REFUSAL` by D19. If an assistant message follows, this version does not end on a refusal, and the row stays for other CLIs |
| devin | 3. only if 1 fails: deny rules, no `disabled_tools` | 0–1 | hidden versus denied | — |
| agy | P0. `-p "/hooks"`, `"/skills"`, `"/permissions"`; `-p "/model" --agent jpwb-executor --model <a model the settings do not name>`; malformed stream-json lines | 0 (needs the lead's go-ahead: it uses `-p`) | whether `.agents/` loads from a fresh folder; the merged rules; the stdin line shape; whether `/hooks` makes a model request (the log shows it); whether `--model` governs `--agent`, if `/model` shows the resolution | a sibling folder without `.agents/` MUST show none of it; the resolved model MUST follow `--model`, not the settings |
| agy | P1. run-scoped agent, stand-in, no skip flag; `--model` not the settings default unless P0 settled it; the stand-in holds one call for 150 s | 1 | host tool called or denied, and how; init and step fields (the surface proof); the log's model lines; whether agy cuts the held call before 180 s; whether an undeclared-argument rejection shows in stream-json | the log's resolved label MUST be the non-default `--model` |
| agy | P2. only if P1 is denied: hook allow, then the skip flag | 0–1 | the working approval route | — |
| agy | P3. ask it to use the shell, write a file itself, and call the science plugin's server, own tools off | 1 | — | a check, not a control: a model that obeys never tries, so "absent" cannot fail. MH-9's positive control is the one that must trip |
| Codex | 0. local mock of the Responses API, stand-in server | 0 OpenAI calls (needs the lead's go-ahead: it runs `codex exec`) | the tools array with the flags and with the catalog; approval events; exit codes; sandbox setup; the relay's loopback under the sandbox; whether a `model_reroute` can appear in `--json` | the mock's `apply_patch` under `-s workspace-write`, in scratch, MUST write the file; only then does "no file" under `-s read-only` show the sandbox held, since a malformed mock patch also leaves no file |
| Codex | 1. after 2026-10-22 02:13 | 2 | the live tool-call shape; account acceptance of `gpt-5.6-sol`; `model_reroute` if Probe 0 could not show it | — |
| Muse | after the governance answer: P1 echo provider | 0 | `-c` MCP accepted; `run.toolset` with MCP names; any built-in left; the relay under Muse's MCP environment and network mode; telemetry and contributor mode as Muse reports them | the same run with `run.toolset` unset MUST list the built-ins, so the listing can show them |
| Muse | P2, P3 | 2 | headless MCP call; reported model | — |
| Claude Code | deferred: P0 init only, P1 one session of two turns, plus a third turn as the control | 0, then 3–5 requests | the real tool list under `--tools ""`; `message.model`'s spelling; one result per streamed turn | without `--strict-mcp-config`, the four claude.ai connectors MUST appear in `mcp_servers` |

Then, once each driver is built, **two calls through the real adapter and the real host server** per CLI, before any
lane run (MH-9):
- **The confirmation.** The host's log shows the calls; the exchange is OBSERVED with the minted names; the run is
  evidence; the grade is the expected one; there is no breach.
- **The positive control.** The same adapter with a driver variant whose CLI's own tools are left ON (for agy, with
  `--mode accept-edits`, which the shipped driver never passes), asked to write a file into the workspace with its own
  tool. It MUST end CALL_FAILED with `CLI_OWN_TOOL_RAN` or `CLI_UNEXPLAINED_CHANGE`, and the workspace MUST be marked
  tainted. That exercises the breach detector, which an obedient model never would. The variant lives in the
  confirmation script, outside `apps/`, never in the product.

**Per-CLI count:** devin 2–3 probe calls plus 2; agy 2–3 plus 2; Codex 2 plus 2, after 2026-10-22. Each is 4–5, within
the sponsor's 3–5. Muse and Claude Code are counted when they are unblocked.

Every probe also records the processes that survive each call. The tree kill's own predicted red is MH-1's, with a
fake CLI and no model (D18).

---

## 6. What is deferred

- **Muse's build**, until the sponsor answers the governance question (§7 S4).
- **Claude Code's build**, until the account question is answered (§7 S5).
- **Resume as a repair mode**, per driver, after its probe (devin's call 3, agy's P4, Codex's `exec resume`, all moved
  to MH-12). It would also need E-1 to say that the CLI held the rest, and, since one process would then serve several
  turns, a way to rotate the token without restarting the bridge.
- **Direct HTTP** from a CLI to the host's server, without the bridge. Only if a probe shows the bridge failing.
- **Other transports:** devin's ACP (the host could answer fs, terminal and permission requests itself), Codex's
  app-server dynamic tools (no MCP at all), Muse's `serve` protocol. Each needs a JSON-RPC client in the host and its
  own probe.
- **A typed reference to the CLI's own record on the exchange.** It needs a ratified contract change. Until then the
  record is kept only on a breach, by pointer in prose (D20).
- **The replay of CLI runs.** The E-1 envelope (D17) now holds what a recording needs of the calls. The executor key
  would add the host's prompt and the `tools` bytes. Not built (D38).
- **Re-checking the grant on every call.** Today's bound is Pi's: tools are minted once, and a revocation refuses the
  next try (`+page.server.ts:1760-1767`). The server could ask the store per call. Not needed for parity.
- **Installing pinned CLI versions.** The lane records versions instead (D36). Codex alone is refused on a version other
  than the probed one (D14a).
- **A snapshot of the workspace before each turn**, restored on a breach, in place of the taint (D21a; §7 L7).
- **A Job object for the tree kill**, only if the probes show survivors despite `taskkill /T` (D18).
- **Widening the adapter-exports gate** to subfolders of `tools/` and to exported constants. Filed. It must first be
  run against today's tree, to count what it would redden, and it needs its own control mutant. This design keeps its
  drivers where the gate already reads (D12).

---

## 7. Questions

### For the sponsor (six)

- **S1. Defaults.** You named a default model for each CLI. Should the host fill one in when none is configured? That
  would amend REG-D-052, which says the model is always configured. My recommendation: no. Name them in the guidance
  and in the lane, and keep the model required, because a pinned label rotted once and every review failed (REG-F-331).
- **S2. devin's model.** Its default, GLM-5.3 Flash Max, is the reviewer's model, so a devin executor on it fails the
  independence rule every time. Which model should a devin executor run? The account offers Gemini 4 Argon High,
  GPT-5.6 Sol and Claude Opus 5.5 Max. devin's probes wait for this answer, because the model check has to be measured
  on the model it will run. devin is not on P5's path.
- **S3. Codex.** What effort for GPT-5.6 Sol? And Codex very likely shares Pi's ChatGPT quota, so it would not help when
  that quota is out. Is that acceptable, or should Codex use API billing (`CODEX_API_KEY`)?
- **S4. Muse.** May Muse be used for this work? Its terms (https://dev.meta.ai/legal/terms-of-service) are unread; its
  launcher says it is "available to Meta employees" while its release says public; and its contributor mode can use
  content for product improvement. If yes, which model?
- **S5. Claude Code.** This machine is signed in to a claude.ai Max account. Anthropic's docs ask a product to use a
  Console API key. Should Claude Code wait for one, or may your own Max login run your own development lanes?
- **S6. Repairs.** For a CLI executor, each try is a fresh process. A repair re-sends the task with every earlier
  answer and the reviewer's findings on each. Your held-session ruling (JAN-EXECSESS) keeps one Pi session instead. The
  model sees what it answered and what was found, but not, in its context, the tool calls it made; the record keeps
  them. Accept re-send for CLI executors? The alternative, each CLI resuming its own session, needs more probes after
  P5.

### For the lead (seven)

- **L1.** E-1 for a CLI executor is the host's envelope: the prompt it sent and its own transcript of the tool calls,
  not the provider payload (D17). Does that need a ruling?
- **L2.** Codex's custom catalog removes the shell and patch tools, but changes the harness the model was tuned on.
  Accept it, if Probe 0 shows the flags alone do not remove them?
- **L3.** agy's `--dangerously-skip-permissions`, only if P1 and P2 show no other route, and only with
  `excludeDefaultComponents` proven to remove the built-ins (P3, and MH-9's positive control)?
- ~~**L4.** Re-send as the repair mode (D16) differs in mechanism from the held-session ruling (JAN-EXECSESS). Register
  it, or ask the sponsor?~~ Moved to the sponsor as S6: the code records JAN-EXECSESS as sponsor authority (§1.16).
- **L5.** File the reviewer's side findings together (§4.1): two tool names missing from its deny list, and its rules
  measured on an older devin; `read_config_from` left on, so it reads `~/.claude/settings.json` hooks; no config
  fingerprint before each review (D44a); and it reads only the last step's model (`devin-reviewer.ts:267`), so a review
  that devin routed partly to another model would pass DIFFERENT_MODEL on the last step alone. It should read the
  distinct set and fail unless that set is exactly the configured model.
- **L6.** Approve agy P0 (free, but `-p`, and now including `/model` with `--agent`) and Codex Probe 0 (a local mock,
  no OpenAI call, but `codex exec`)?
- **L7.** A breach taints the workspace (D21a). Who clears the mark, and by what recorded act? Or should the host
  restore a snapshot taken before each turn instead?
- **L8.** The turn bound, 4,440 s, is authored (D18). Keep it, or have the server enforce a call cap, which would make
  the bound derivable but would set CLI executors apart from Pi?

---

## 8. What changes in behaviour

- **agy's executor gets the workspace,** through the host's two tools. It was text-only.
- **A CLI executor's repair carries every earlier answer and the findings on each.** agy's used to receive the findings
  alone.
- **The selector refuses an executor model that is the reviewer's, a spelling of it, or one the family table does not
  list,** before any paid work, while a real reviewer is selected. **This applies to Pi too.**
- **A CLI turn fails if it cannot prove its tool surface, if the workspace changed outside the host's calls, or if the
  CLI stopped on a refusal.** A breach taints the workspace until a person clears it.
- **A CLI turn is refused if a config file its CLI reads changed since the session opened.**
- **The lane accepts an agy executor,** and holds it to HOST_CONFIGURED instead of refusing it.
- **The run report says which executor ran,** and says so plainly when it is not P3's.
- **A CLI executor's model thinks at the configured effort.** Pi's ran with thinking off.
- **A CLI executor's instruction gains a preamble about its tools,** which Pi's did not have.
- ~~**Nothing changes for Pi.**~~ **For Pi, only the selector's model refusals change** (the third bullet). Its
  session, its tools and its record do not.

---

## 9. Review and revisions

The review (2026-10-18, at head `19a018f3`) found the design not ready to build as written. Its verdict counts 1
BLOCKING, 13 MATERIAL and 13 MINOR findings. Its list holds 1, 12 and 13, which is 26 in all. Every one of the 26 is
answered below, each in its own row. The line references it rested on were re-read at that head before the revision.
Two were refined, and the row says how: R7's kill, and R17's line.

| # | Severity | Finding | What changed |
|---|---|---|---|
| R1 | BLOCKING | The merge order could not pass gate:fast. MH-1's and MH-2's exports had no production caller until later packages. MH-3's model.ts branch needed MH-2's code, which merged after it. MH-3 test 7 contradicted "agy stays text-only". MH-2 test 5's red could not turn green before MH-5. And the gate does not read subfolders or `export const`. | Roadmap: MH-1 and MH-2 are one package (MH-1), and that package also carries the `CLI` kind, its model.ts branch and its record identity, so every new export has a production caller at merge (D30, §1.19). Nothing selects the kind until MH-5. MH-3 test 7 and MH-2 test 5's model.test.ts red move to MH-5. The re-send test gets its own control mutants. Drivers are top-level files, exported as functions, found through one table (D12). The bridge's source is module-private behind `writeBridge` (D11). Widening the gate is filed (§6). New §1.18, §1.19. |
| R2 | MATERIAL | Grant-by-absence holds only for the host's tools. The CLI's own tools are withheld by vendor config. `mcp list` shows servers, not built-ins. Nothing fails closed when the CLI's record is missing. Yet the record claims a complete surface. | D4 restated. D14 now says the listing proves only the servers. New D14a: a positive surface proof on every turn from the CLI's record (devin `tool_definitions`, agy init/step, Claude `system/init.tools`; Codex by version pin and Probe 0, said to be unverifiable at runtime), and `CLI_SURFACE_UNPROVEN` when the record is absent, unparseable or without the proof. New D14b: a workspace manifest around every host call, with its residuals stated. The `processRuns` claim is limited to turns that pass both. §0, §2 and §8 updated. |
| R3 | MATERIAL | The agy identity probe could not discriminate. The configured model equals the settings default, so the log shows the same label either way. | §4.2 states the open question and the predicted red: a `--model` the settings do not name, in P0 (`/model` with `--agent`) or P1, and the resolved label must follow it. If it does not, the agy executor is refused until the tier is pinned, or the route goes back to the sponsor. D22, D26, §0, §5 and the roadmap's MH-0b updated. |
| R4 | MATERIAL | devin ends a print session on a rejected call (REG-F-549). D21 let the try go on, and D19 would grade partial text as an answer. | New D19 row `CLI_ENDED_ON_REFUSAL`: a refusal with no assistant message after it, or devin's rejection line, fails the turn as reported by TOOL. D21's refused arm says so. MH-0a call 2 asserts the classification. Tests in MH-1 (C14) and MH-4. |
| R5 | MATERIAL | Attempted calls could vanish. The server is handler-side. CLIs reject unknown names and bad arguments before sending. A queued call killed with the CLI was never `started`. | D3 corrected, with the residual stated. D6: `started` on arrival, queued calls dropped unrun and left UNKNOWN. D21: drivers recover rejected and unknown-tool attempts from the CLI's record as REFUSED. Per-driver residuals in §4.1 and §4.2. New §1.14. Tests S4, C15. |
| R6 | MATERIAL | Three losses against Pi: E-1 held the prompt only; a repair carried only the last answer; L4 asked the lead about a sponsor ruling. | D17: E-1 is a JSON envelope of the prompt, the `tools/list` bytes and the host's ordered call transcript (arguments and results as sent), stored RETAINED_BY_PARTICIPATION (§1.17). D16: every prior answer and findings pair is carried, with an authored cap that leaves out whole pairs and says so. "Not in effect" is dropped. L4 struck; it is now S6 (§1.16). |
| R7 | MATERIAL | The token was per session and the gate per turn. A surviving descendant of try n could act as try n+1. Deferring tree-kill rested on a false premise. | D2, D8, D41: a fresh token each turn, written before the spawn and revoked when the turn ends. D18: the whole tree is killed with `taskkill /T /F`. Refined: a descendant whose parent already exited is beyond `taskkill`'s reach. The per-turn token is what makes that survivor harmless, and a Job object is the fallback if probes show survivors. The kill's predicted red is model-free, in MH-1 (C7, C8). The deferral is removed from §6. |
| R8 | MATERIAL | Controls could not fail. Codex's no-file result had no positive arm. agy P3 and MH-9 accepted "absent". Muse's control was a variant. The probes ran a toy, not the shipping path. §4.1 omitted two disabled tools. | D47 rewritten: probes run through a stand-in of the shipping path (D10's relay, an absolute node path, HTTP on 127.0.0.1, the minted `toTypeBox` schemas). §5: Codex's `workspace-write` arm MUST write the file. MH-9's control is now positive: own tools left on, and the turn MUST fail as a breach. P3 is relabelled a check, not a control. Muse's control MUST list the built-ins. Sandbox loopback and the filtered MCP environment are added as unknowns. §4.1's `--config` is now byte-for-byte the probe file (25 tools, plus `proxy`). |
| R9 | MATERIAL | A breach left the CLI's own writes in a workspace that a re-run reuses, and its record was deleted at dispose. | New D21a: a taint marker beside the workspace, and Begin & Execute and re-run refuse while it exists, until a person clears it (L7; a snapshot is the alternative, §6). D20: on a breach the CLI's record is kept PURGEABLE_AT_EXPIRY, with its pointer in the CALL_FAILED message. Whether the message may carry the pointer is marked as a hypothesis to confirm in MH-1. |
| R10 | MATERIAL | The CALL_FAILED message reached the permanent record with only prompt and token checks. A CLI line can echo arguments, results, paths or the port. | New D19a: a classified code, plus a bounded excerpt only from known error shapes. The excerpt is checked against the prompt, every argument and result served in the turn, the run path, the port and the token, and withheld on any hit. D42 points to it. Test C20. |
| R11 | MATERIAL | D33 compared unlisted slugs exactly, so a new spelling of the reviewer's model passed. | D33: `EXECUTOR_MODEL_UNCLASSIFIED` when a real reviewer is selected and either slug is unlisted. Pi's slugs join the table. §8 now says this changes Pi. |
| R12 | MATERIAL | `run_command` can rewrite any config a CLI or the reviewer reads, and fingerprints were taken only at boot and at the end. | D13: a dedicated root, whose ancestors are checked for CLI project configs. New D44a: every declared config source is checked by `stat` before each turn, and a change refuses the turn. Files a CLI writes by itself are measured by the probes and listed as residuals. The reviewer's equivalent and its `read_config_from` are filed under L5. |
| R13 | MATERIAL | The devin probe measured only GLM, the one model a devin executor may not run. | MH-0a's call 1 runs on S2's model, and its `generation_model` set is recorded before MH-4 pins D22's compare. D22, D25, §4.1 and S2 say so. MH-0a now depends on S2, which is not on P5's path. |
| R14 | MINOR | The CLI's own calls were appended after the host's on a record whose ordinals are load-bearing. | D21: calls merged in the CLI record's order, with the host calls cross-checked against the host's own, in order and by name, and `CLI_SURFACE_UNPROVEN` on a mismatch. Test C12. |
| R15 | MINOR | The turn bound was "derived" from a retention cap. | D18: 4,440 s is labelled authored, and the derivation is dropped. §1.3 says what 32 is. A server-enforced call cap is asked, not chosen (L8). |
| R16 | MINOR | Seven CLI behaviours were stated beyond the evidence. | (a) agy's `timeoutSeconds` meaning and default: unknown, and measured in P1 (D18, §4.2, §5). (b) Codex's read-only sandbox corrected: it forbids writes everywhere and allows reads everywhere (§4.3). (c) Codex's quota: "very likely" (D27, §4.3, S3). (d) Muse's telemetry: validated offline only (D45, §4.4). (e) `_meta` ignored: assumed, and probed (D9). (f) agy's `--effort`: named, never passed (D32, §4.2). (g) The Claude Code escape: documented, not measured (D13, §4.5). |
| R17 | MINOR | MH-7 test 5 named `:240`, a line its fixture has no path to. | Refined: with D17's envelope, a CLI E-1 is JSON with no `input` list, so today's refusal is `record-replay-core.ts:213`. A plain-text E-1 would be refused at `:209`, as the review said. The roadmap asserts `:213`'s message. §1.10 and D38 corrected. |
| R18 | MINOR | MH-1 test 7 could pass on ECONNREFUSED, or survive its mutant through keep-alive. | Test S9 sends on a keep-alive connection held from before `dispose`, and asserts the gate's own status code and the refusal counter. S8 does the same for a revoked token. |
| R19 | MINOR | Every driver that reads stderr would redden the pinned disposed-site list, but a disposition was planned only in MH-2. | D24: stderr is bound only in the opener, which is one site added in MH-1 with its disposition. Drivers get lines, never the child. If the gate counts a driver anyway, that driver's site is added in its own package. |
| R20 | MINOR | D39 put `JPWB_CODEX_BIN` in a list that by design excludes program overrides. | D34 and D39: `ExecutorProgramOverrides` becomes its own type with a `codex` key. The override joins the selector's capture and `liveSelectionsBesideReplay`'s `overrides` argument. Only `JPWB_EXECUTOR_EFFORT` joins the environment list. New §1.20. |
| R21 | MINOR | The token file sat in the CLI's cwd. A killed server left run folders behind. `dispose` is synchronous, but its work is async. | D13 and D41: `cli/` and `host/` subfolders, with the endpoint file in `host/`. Stale `jpwb-exec-*` folders are swept at server start by dead pid. `dispose` closes the gate and revokes the token synchronously, and the rest runs fire-and-forget with logged errors. Tests C2, C23, C24. |
| R22 | MINOR | API billing would need a secret, and the shared allowlist had no channel for one. | D43: a per-driver secret channel, given to the CLI process only, never on the shared allowlist, and recorded by length. D29, §4.4 and §4.5 point to it. Test C4. |
| R23 | MINOR | A user-level agy hook could run unrecorded on each tool call. | §4.2: a `/hooks` preflight on every turn refuses any hook but the run folder's own. It is conditional on P0 showing `/hooks` makes no model request; otherwise it moves to boot, with a stated residual. |
| R24 | MINOR | With `--ephemeral`, Codex substitution rests on a `model_reroute` event that may not appear. | D22 and §4.3 say so. Probe 0 or Probe 1 confirms it. Until then the run report says a Codex substitution cannot be detected (D37). |
| R25 | MINOR | §0's critical path left out MH-3, and agy's probes plus MH-9's calls exceeded Q4's 3–5. | §0 lists MH-3 and MH-7. §5 counts the calls per CLI (4–5 each) within Q4, by moving resume probes (devin 3, agy P4, Codex `exec resume`) to MH-12. |
| R26 | MINOR | The reviewer reads only the last `generation_model`. | Added to L5, and to §1.7 and §4.1: read the distinct set, and fail unless it is exactly the configured model. |
