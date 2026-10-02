# DESIGN — `JAN-SELRES`: what `JAN-SELREV` left — the executor runs the model it records, its program is not replaced, and a refused review is answered with its own remedy

**Authority:** `REG-D-071`'s standing delegation — *"For anything else related that needs my decision or input you will
need to author solutions and use your best judgement."* The findings are `JAN-SELREV`'s residuals: `REG-F-458`,
`REG-F-459` and `REG-F-460`. Each was filed OPEN and unscheduled on 2026-09-26; "unscheduled" was the agent's own
disposition. · **Date:** 2026-09-28 · **Revision:** 2 (revision 1 was attacked by three adversarial critics; §7 lists
what changed) · **Status:** DRAFT.

**The sponsor's words, and the reading taken.**
- **The words.** The report of 2026-09-26 listed these three findings as open and unscheduled, and offered the paid
  live-lane run *"Say the word"*. On 2026-09-28 the sponsor wrote: *"Codex is available for use again. Pickup from where
  you left off."*
- **The reading taken.** The work left off is these open findings, and Codex returns to corpus research and document
  edits.
- **Another reading exists.** The words may only resume the session, or may point at the offered run. They do not name
  the run, and a paid run is not started on an unstated word.
- **What proceeds.** The scheduling is item 1 for confirmation (§6). The build proceeds under the delegation meanwhile,
  as `JAN-SELREV`'s did, because every choice below keeps a sponsor-confirmed rule (`REG-D-052`, `REG-D-085`,
  `REG-D-086`) and makes a record truer.

---

## 1. What is asked, and the general forms

- **`REG-F-458`.** The agy EXECUTOR runs `JPWB_JUDGE_MODEL` but records `JPWB_EXECUTOR_MODEL`. With agy executing and
  agy reviewing, both calls run one model while the record shows two, so `DIFFERENT_MODEL` passes on a fiction.
- **`REG-F-459`.** The agy executor honours `JPWB_AGY_BIN` outside test mode: `REG-F-441`'s executor half.
- **`REG-F-460`.** When devin reports a model other than the configured one, the refusal's own statement gives the
  confirmed remedy: *"Its remedy is re-qualification or re-selection, not reconfiguration"* (`REG-D-085` item 3,
  confirmed by `REG-D-086`). The floor's guidance beside it says *"Configure or retry the reviewer"*.
- **General form of the first two:** *the identity the executor's record names is not the one that ran.*
  - `JAN-SELREV` closed it for the reviewer (D6, D7).
  - The executor has no selector, so the class is open on the other side of `DIFFERENT_MODEL`.
  - Searched for, and found beyond `REG-F-458`/`459` (filed, §5, `REG-F-465`): Pi grades its configured model as a
    provider report, and the agy executor and agy reviewer record one provider two ways.
- **General form of the third:** *an operator surface beside a refused or failed review tells the operator to do what
  the refusal forbids, or omits what it requires.*
  - **Fixed here:** the floor's guidance (`REG-F-460`); the execution plane's action name (G8); and the PWA page's
    blocked hint (G6, `REG-F-462`).
  - **Filed, §5:** the resume banner, the Retry step control, the thrown-turn cleanup and the waiver affordance
    (`REG-F-466`); the reviewer-answer panel (`REG-F-464`); and a false independence line a throw co-records
    (`REG-F-463`).

## 2. What the product does today

Read from code at `2bcf3b50`:
- by three mappers, whose load-bearing claims a critic re-read;
- then by three critics of revision 1, who re-read every citation (four were wrong, all corrected here).

`app/` = `apps/rph-demo/src/`.

- **G1 — the agy executor's model is the reviewer's.** `app/lib/server/execution/model.ts:103`:
  `if (tool.toolId === 'agy') return async () => oneShotSession((prompt: string) => agyPrint(prompt));`. `agyPrint`
  builds `['--print', prompt, '--print-timeout', '3m', '--model', judgeModel()]` (`assurance/agy-cli.ts:91`), and
  `judgeModel()` is `JPWB_JUDGE_MODEL`.
- **G2 — the record names another model, graded as the host's.**
  - agy returns a bare string, so the step records the route's fallback identity: `modelId: resolveExecutorModel() ??
    'unresolved'` and `providerId: resolveExecutorToolId() ?? 'unresolved'`
    (`routes/undertakings/[id]/+page.server.ts:1347,1351`). These are evaluated per try, as arguments to
    `runModelInvocationStep`, and graded `HOST_CONFIGURED` (`execution/run-model-step.ts:546-553`).
  - The comment above them (`:1339-1341`) says they are used *"only when the tool reports no identity of its own"*.
    On the agy executor that is every call.
  - With `JPWB_EXECUTOR_MODEL` unset the record says `'unresolved'`, and `DIFFERENT_MODEL` still passes: it compares
    strings (`assurance-rules.ts:190-203`).
- **G3 — the executor's configuration is read in three places, none before dispatch.**
  - The places:
    - the route's fallback (`:1347`);
    - `agyPrint` at call time;
    - Pi's opener (`tools/pi-executor.ts:57`, `executorModel()`).
  - The only pre-dispatch check is the REVIEWER preflight (`:1027-1030`).
  - An unset or unknown executor tool, devin (declared for EXECUTION, no adapter: `model.ts:104-106`) and Pi's unset
    model are all found when the executor opens (`:1253`). That is after `StartExecutionStep` (`:1126`), so each is
    recorded as a started-then-failed step (`:1264-1270`).
- **G4 — two test-mode reads.** The routes ask `isTestMode()` (`workbench.ts:40,262`), while `model.ts:16` keeps its
  own `TEST_MODE`. `begin-execute-reviewer-preflight.test.ts:25-27` records that its server-mode limb can switch only
  the first.
- **G5 — the executor's program can be replaced in every mode.** `AGY_BIN = AGY_BIN_OVERRIDE ?? 'agy'`
  (`agy-cli.ts:15-17`) is captured at load. `JAN-SELREV` D7 refuses it for an agy REVIEW outside test mode
  (`assurance/reviewer-selection.ts:118-130`), and nothing refuses it for the agy executor.
- **G6 — `REG-F-462`: the PWA page says "revise the graph" beside every failed or refused review.**
  - The hint: `routes/pwa/[id]/+page.svelte:2120-2123` renders *"Publishing is blocked until the floor is SATISFIED —
    revise the graph and re-run."* for every unsatisfied floor.
  - The contradiction: beside a review that did not execute, the guidance says *"Do not revise the PWA or record a
    waiver in response to this execution failure"* (`lib/server/floor.ts:235`).
- **G7 — `REG-F-460`: a substitution cannot be told apart by code.**
  - The validator throws a plain `Error` (`reasoning-review-validator.ts:588`).
  - `runFloorResults` reads only `.message` (`packages/rph-assurance/src/validators.ts:436-439`), and `failedResult`
    records one observation, `VALIDATOR_EXECUTION_FAILED` (`:408`).
  - The classifier works from codes, never prose (`floor.ts:206`), so a substitution takes the execution-failure
    branch (`:228-237`): *"Configure or retry the reviewer"*.
- **G8 — the execution plane shows the wrong action name.**
  - The execution plane never shows the classifier's guidance.
  - Beside a substitution it says `The review did not produce findings that may be sent back to the producer
    (RETRY_OR_CONFIGURE_REVIEWER).` (`+page.server.ts:1483`).
  - Its failure message lists every observation as `code: statement` (`:1607`), so the refusal's own remedy does appear
    there.
  - The guidance strings could not simply be shown there: they are written for a PWA (*"PublishPwa remains
    blocked…"*).
- **What a throw also records (traced; no test covers it).**
  - The chain:
    - `failedResult`'s evaluator is `{ actorType: 'SYSTEM' }` with no model, so `DIFFERENT_MODEL` fails
      (`assurance-rules.ts:190-203`);
    - `recording.ts:116-123` then adds `INDEPENDENCE_VIOLATION`, with the statement `'validator execution failed'`
      (`assurance-rules.ts:263`).
  - The classifier's execution-failure branch runs before its independence branch, so today's guidance is unaffected.
  - Filed, not fixed (§5, `REG-F-463`).

## 3. The design

- **D1 — One executor selector: `app/lib/server/execution/executor-selection.ts`.**
  - **The signature.** `selectExecutor({ testMode, env?, overrides? }): ExecutorSelection`. It has four outcomes:
    `{ kind: 'STAND_IN' }`, `{ kind: 'PI'; modelId }`, `{ kind: 'AGY'; modelId }`, and
    `{ kind: 'REFUSED'; code; toolId; reason; guidance }`.
  - **It never throws.** Every misconfiguration is an answer the caller can show before dispatch
    (`reviewer-selection.ts:148-149`).
  - **Refusal codes, in order:**
    1. `EXECUTOR_TOOL_UNSET`: `JPWB_EXECUTOR` unset or blank outside test mode. In test mode it is `STAND_IN`.
    2. `EXECUTOR_TOOL_UNKNOWN`: `selectBackingTool(tool, 'EXECUTION')` refuses it.
    3. `EXECUTOR_TOOL_UNWIRED`: a catalogued tool with no executor adapter (devin today).
    4. `EXECUTOR_PROGRAM_OVERRIDDEN`: D3.
    5. `EXECUTOR_MODEL_UNSET`: `JPWB_EXECUTOR_MODEL` unset or blank, for Pi and agy alike (`REG-D-052`). It never
       falls back to `JPWB_JUDGE_MODEL`, and says so.
  - **The environment handed in is the whole input.** The selector reads
    `resolveExecutorToolId(env.JPWB_EXECUTOR ?? '')` and `resolveExecutorModel(env.JPWB_EXECUTOR_MODEL ?? '')`, as the
    reviewer selector does (`:183-187`). That also keeps both resolvers' production references:
    `verif/tool-adapter-exports-reachable.test.ts` does not count tests.
  - **The overrides** are a per-tool record (`{ agy, devin }`), the reviewer's `ReviewerProgramOverrides` shape
    (`:31-34`). It defaults to the adapters' captured exports and is injectable for tests. A table test covers every
    tool that declares EXECUTION, so a later devin executor inherits the rule.
  - **The UNSET guidance lists the WIRED executor tools** (agy, pi), from the same table the selector dispatches on.
    `executorToolId()`'s message lists the catalog (`agy, pi, devin`), which would steer an operator to a tool the next
    refusal forbids.
  - **The guidance also names:**
    - the two variables;
    - that there is no default;
    - that the executor's model may not be the reviewer's under any provider, spelling or effort variant (ASR-13;
      agy labels encode effort, `agy-cli.ts:26`);
    - the GLM-5.3 Flash rule `SELECTED_REVIEWER_GUIDANCE` already states (`reviewer-selection.ts:69-77`).
  - **Pi's model resolvability is not checked here.** It needs Pi's SDK, which the gate never loads (`model.ts:85`).
    It is still refused when the executor opens (D4, disclosed).
  - **Placement:** `execution/`, not `tools/`, for the reason the reviewer selector gives (`reviewer-selection.ts:13-14`).
  - ⭑ *As built (`RS-1`):* the UNKNOWN reason keeps the catalog's verdict and replaces its tool list with the wired
    executors (*"This host has an executor adapter for: agy, pi."*); the reviewer selector's UNKNOWN reason still offers
    `pi` (`REG-F-466`). *"Never throws"* holds for the declared input: a non-string value throws in the resolvers, as it
    does for `selectReviewer`.
- **D2 — The agy executor runs the model it records (`REG-F-458`, remedy (a)).**
  - **One implementation.** `agy-cli.ts` gains a model-explicit call, for example
    `agyPrintWithModel(prompt, model, exec?)`. `agyPrint(prompt, exec?)` delegates to it after its own budget check and
    `judgeModel()`, in today's order. Both share ONE sanitising catch (`:99-124`).
  - **Sanitising matters on the executor side.** The execution plane has no sanitiser of its own: `run-model-step.ts:349`
    writes the failure message into the exchange record. An unsanitised execFile rejection would carry the whole
    prompt there (`PER-12`, finding #60).
  - **Byte for byte.** `agyPrint`'s refusal order, argv, errors and bare-string return stay the same:
    - the order is pinned by `agy-cli.test.ts:43-47`;
    - the argv by `scripts/reviewer-qual/transports.ts:141-175`, including `J22-M10`'s victim;
    - the return by `verif/live-exec-lane-config.test.ts:325-329`;
    - the anchors are `SR2-M27` and `SR2-M29`.
    So nothing the reviewer, the harness or the fingerprint sees moves.
  - **The failure text.** Its wording names a *"judge prompt"* and a `VALIDATOR_EXECUTION_FAILED` observation
    (`:100-123`). It takes a role parameter so the executor's text is true, and `agyPrint`'s stays byte-identical.
  - **The grade stays `HOST_CONFIGURED`** (a bare string), which is now true: the host configured the model it passed.
    That follows the devin reviewer's rule, *"NO REPORT MEANS THE WEAKER GRADE"* (`tools/devin-reviewer.ts:107-110`).
  - **Behaviour change, stated.** On an agy executor host, `JPWB_EXECUTOR_MODEL` must now be an agy label. A host
    relying on `JPWB_JUDGE_MODEL` will see agy refuse a non-agy label. No document tells an operator to set
    `JPWB_EXECUTOR=agy`: the README describes it only to disclose `REG-F-458`.
  - ***Remedy (b), refusing `JPWB_EXECUTOR=agy`, rejected.*** (a) makes the record true at small cost, and no ruling
    retires agy.
    - The sponsor's direction names Pi as the executor (`REG-F-357`: *"We will use Pi CLI for the executor or PWU
      executing agent backing tool"*).
    - The tool suite's design keeps agy *"unchanged"* (`DESIGN-backing-agent-tool-suite.md:190-192`), and its roadmap
      has a CONTROL for it (`ROADMAP-backing-agent-tool-suite.md:59`).
    - *(Revision 1's second ground, the both-roles catalog invariant, was wrong: the selector can refuse a declared
      tool, as the reviewer selector refuses `pi`.)*
- **D3 — The executor's program is not replaced outside test mode (`REG-F-459`, remedy (a)).**
  - Outside test mode `selectExecutor` refuses the SELECTED executor tool while its captured override is defined, even
    as `''`, before its model is asked about. This is `JAN-SELREV` D7 applied to the executor.
  - **The adapter is unchanged.** It still reads the override once, at load, and honours it.
    `verif/reviewer-qualification-transports.test.ts:218-243` still kills `J22-M10`: it needs the override honoured
    in a process that is not in product test mode.
  - **Taken with D7:** a set `JPWB_AGY_BIN` outside test mode refuses agy as reviewer or executor, and refuses nothing
    else. A Pi executor on a host with a stray `JPWB_AGY_BIN` is admitted.
    - A selector test pins that case, and it becomes `SR2-M20`'s *who relies*. Its text today names *"a host that runs
      the agy EXECUTOR through JPWB_AGY_BIN"*, a host now refused.
    - `floor-registry.test.ts:365` is its reviewer half only.
  - **Disclosed, not refused:** Pi reads `PI_CODING_AGENT_DIR` in every mode (`pi-executor.ts:171-182`, through
    `getAgentDir()`). That redirects its models, provider endpoints and auth, much as `JAN-SELREV` G11 disclosed devin's
    own configuration.
- **D4 — One selection per model step, asked before dispatch; it opens the executor and names the record.**
  - **In `beginExecute`.** For a MODEL step, `beginExecute` asks `selectExecutor({ testMode: isTestMode() })` after the
    reviewer preflight (`:1027-1030`, unchanged) and before `runSteps` (`:1049`).
    - A refusal returns `fail(400, { error: reason + ' ' + guidance })`: nothing is dispatched and the work unit stays
      as it was.
    - A TRANSFORMATION step asks neither.
  - **`getExecutionSession(selection, deps?)`** opens what the selection names: STAND_IN the fixture, PI Pi's opener,
    AGY D2's call. It reads no environment and no test-mode constant.
    - `model.ts:16` goes, and G4 closes: the only test-mode read is the caller's, and only test mode yields STAND_IN.
    - `deps = { agyExec?, openPi? }` is injectable ONLY so the gate can reach both runnable branches. That is the
      `AgyExec` precedent.
    - `openPi` defaults to today's lazy import, so the gate still never loads Pi's SDK (`model.ts:85`).
  - **Pi takes the selection's model.** The signature becomes `openPiExecutionSession(context, modelId)`, and
    `pi-executor.ts` stops calling `executorModel()`.
  - **The record's fallback identity comes from the same selection:**
    - `modelId` is `selection.modelId`;
    - `providerId` is the selection's tool, `'agy'` or `'pi'`, as today;
    - STAND_IN records `'unresolved'` for both, which is today's value in the gate.

    The model the configuration names, the model agy is asked to run and the model recorded are then one read. That is
    the rule at `assurance/index.ts:99-102`.
    - ⚠ **For Pi, "one read" covers the configured label only.** What Pi RECORDS is its registry's resolution of that
      label, graded `PROVIDER_REPORTED` (`pi-executor.ts:321-326`), not a model the provider reported (`REG-F-465`).
  - **What still refuses after dispatch, disclosed.** An unresolvable Pi model, a sandbox refusal and a context refusal
    are found when the executor opens, and recorded as a started-then-failed step (`:1264-1270`), as today.
    `playwright.live-exec.config.ts:21` is to say so.
  - **Functions the selector replaces.** `executorToolId()` and `executorModel()` lose their production callers and
    go. The rule in `verif/tool-adapter-exports-reachable.test.ts` requires it. Their assertions move with equal or
    stronger content (§4.5).
  - ⭑ *As built (`RS-1`):* `getExecutionSession` has an exhaustive `never` default whose opener refuses, so a refusal
    that leaked past the type opens nothing. `model-loads-pi-lazily.test.ts` holds the lazy Pi load structurally,
    reading `model.ts` as source so that it never loads Pi's SDK itself.
- **D5 — The live execution lane refuses what the product refuses about the executor.**
  - **Today.** `e2e-live-exec/lane-config.ts:66` requires `JPWB_EXECUTOR`, `JPWB_EXECUTOR_MODEL` and
    `JPWB_ASSURANCE_TOOL` to be present and non-blank, and checks no executor value.
  - **The executor limb.** `lane-config.ts` must stay import-free (`:9-12`), and the config's imports are pinned
    (`verif/live-exec-lane-config.test.ts:500-509`). So the limb RESTATES the product rules inside `laneKeysRefusal`, as
    the reviewer limb does:
    - the tool must be a wired executor tool;
    - for agy, the override must be unset;
    - the model must be set.
  - **The pin.** `verif/live-exec-lane-config.test.ts` holds the limb to `selectExecutor` over a table of executor
    configurations, which is how the reviewer limb is held (`:205-208`). Distinct identifiers keep every reviewer-limb
    ledger anchor unique (`SR3-M5`, `M6`, `M23`, `M24`, `M26`).
  - **One lane rule, labelled as the lane's own.** The lane's spec asserts a provider-reported producer
    (`e2e-live-exec/execution.live.ts:212`), which an agy executor can never give. An agy lane would boot and spend up
    to 36 minutes failing there, so the config refuses it at boot, saying the rule is the spec's, not the product's.
- **D6 — A substituted model has its own observation code (`REG-F-460`).**
  - **In `packages/rph-assurance`: the carrier.** A Validator's thrown error may carry
    `validatorFailure: { code, statement }`.
    - The name is chosen to avoid ES2022's `Error.cause`, which means *the underlying error*.
    - `runFloorResults`' catch reads it by property, as `StoreBusyError`'s `code` is read
      (`rph-ports/src/ports/storage.ts:70-71`; `app/lib/server/floor.ts:375`). Duck-typing survives the `src`/`dist`
      duplication that defeats `instanceof`.
  - **The closed set.** The package exports `VALIDATOR_FAILURE_CODES`, with one member,
    `VALIDATOR_MODEL_SUBSTITUTED`, and its type.
  - **What `failedResult` records:**
    - `VALIDATOR_EXECUTION_FAILED` first, exactly as today;
    - then, for a code in the set, one more observation, `MATERIAL` and open;
    - `observations[0]` is therefore unchanged: the waiver target (`pwa/[id]/+page.server.ts:725`) and the order on
      screen lead as today;
    - a code outside the set, or a non-Error throw, adds nothing.
  - **Why additive, and not a replacement code.**
    - The floor's own statement of `VALIDATOR_EXECUTION_FAILED` is that it *"covers missing host configuration and
      external process/provider failures alike"*: every case in which the validator produced no result (`floor.ts:208`).
      A substitution is such a case, and the new code refines it.
    - Replacing the code would split that vocabulary. The production predicates on it are two, `floor.ts:199` and
      `:228`, and D7 edits both either way. The additive record also keeps `floor-registry.test.ts:287-288`'s *"exactly
      one"*.
    - *(Revision 1 wrongly listed `loadPwaFloor` among them; it keys on `INDEPENDENCE_VIOLATION`, `floor.ts:672`.)*
  - **Only throws outside the print seam can carry it.** The seam's sanitiser rebuilds every error
    (`tools/diagnostic-safety.ts:48-56`). The substitution throw (`:588`) sits outside it. That is the `PER-12` property:
    a statement written by the validator, never by an execFile rejection.
  - **The statement** names the tool and both model ids, and nothing from the prompt.
  - **In the app.** The throw at `reasoning-review-validator.ts:588` carries the failure, and its message is unchanged.
    The message is pinned at `floor-registry.test.ts:290-298` and `reasoning-review-validator.test.ts:740-746`, and by
    `SR2-M11`.
    - ⛔ That line is the `find` anchor of `SR2-M6` and `SR2-M35` (`ledger.ts:11213-11216`, `:11474-11477`). Both are
      re-anchored in the same commit, and `SR2-M35`'s replacement is re-derived so that it still means *dressed as a
      failed invocation*.
    - The app imports the code from the package and never restates the literal.
  - **Proofs.** Four package tests, one per limb:
    - a causeless throw's `observations` `toEqual` exactly one `VALIDATOR_EXECUTION_FAILED` with the message;
    - an in-set failure adds exactly one observation, second;
    - an out-of-set code adds nothing;
    - a non-Error throw adds nothing.

    Each has its own mutant. The per-file coverage floor (`verif/floors/per-file-floor.baseline.json`) must not
    regress, and the export census is regenerated (`scripts/export-guard.ts --write`).
    - `reviewer:qual:check` proves only that the fingerprint does not move. It cannot see observations:
      `scoreThrow` hashes `disposition`, `resultClass`, `independenceOk` and `criteria` (`runner.ts:251-257`).
  - ⭑ *As built (`RS-2`):*
    - **The exports.** The package also exports `VALIDATOR_MODEL_SUBSTITUTED` by name and a helper,
      `validatorFailureError(message, failure)`, so the carrier's property name lives in one module.
    - **What adds nothing.** A carrier whose READ throws (a getter, a Proxy trap) adds nothing, and nor does a
      near-miss spelling of the code. Both are tested, with a table of malformed carriers.
    - **The statement** holds the tool and the two model ids only, pinned exactly. The reported id is tool-written and
      unbounded where it is read (`REG-F-468`).
    - **The census** is regenerated: 362 of 362 guarded.
  - **Contract standing.** `findingCode` is `z.string()` (`packages/rph-contracts/src/objects.ts:701`). No schema,
    envelope or enum changes, so `JPWB-DOC-004`'s contract procedure is not engaged. The code is package vocabulary, as
    `VALIDATOR_EXECUTION_FAILED` is.
- **D7 — The floor answers a substitution with its own action and guidance.**
  - **A new action, `REQUALIFY_OR_RESELECT_REVIEWER`.**
    - It is chosen on meaning. `CHANGE_REVIEWER` means independence today (`floor.ts:243-249`).
    - On the execution plane the action NAME is all the operator is shown beside the statements (G8). So the name must
      say the remedy.
  - **The branch.** It sits BEFORE the execution-failure branch: any review observation coded
    `VALIDATOR_MODEL_SUBSTITUTED` → the new action, `autoRefine: false`, no findings.
  - **One exhaustive operational test.** `floor.ts` exports `isOperationalRemediation(action)`, an exhaustive switch
    over the union with a `never` default.
    - `routes/pwa/[id]/agent/+server.ts:242-246` uses it in place of its enumeration.
    - A new action can then never be missed at compile time: a miss there would mark a refused review
      REVISION_REQUIRED.
  - **The guidance — the agent's wording, for confirmation (§6).** The confirmed core is only *"re-qualification or
    re-selection, not reconfiguration"*. The text:

    *"PublishPwa remains blocked because the reviewing tool reported that a model other than the configured and
    selected one answered, so the review was refused. Retrying or reconfiguring the same selection does not fix this:
    another call is billed and may be served the same way. The remedy is a sponsor decision: re-qualify the model the
    tool actually serves and select it, or re-select the reviewer (REG-D-084, REG-D-086); then configure the host to the
    new selection. Do not revise the PWA or record a waiver in response to this refusal."*
  - **The execution plane.** It keeps printing the action name and the statements (`:1483`, `:1607`). After D6 and D7
    it reads the refusal's remedy, a `VALIDATOR_MODEL_SUBSTITUTED` line and `(REQUALIFY_OR_RESELECT_REVIEWER)`. The
    PWA-worded guidance is not shown there.
  - **`OPERATIONAL_REVIEW_CODES` gains the code.** ~~D8 reads that set, so the membership becomes load-bearing and a
    mutant can kill it.~~ ⭑ *As built (`RS-3`):* D8 does not read the set. It is private to `floor.ts`, read only by
    the classifier's subject-finding filter behind branches that answer each member first, so its membership is
    equivalent.
  - **Tests use the real shape.** A real throwing validator goes through `runFloorResults`, recording and the
    classifier, so the co-recorded `VALIDATOR_EXECUTION_FAILED` and `INDEPENDENCE_VIOLATION` are present.
    `floor.test.ts`'s `reviewPolicy` (`independenceOk: true`) is not the shape a throw produces.
    - A mutant moving the new branch after the execution-failure branch is killed by the guidance assertion.
  - ⭑ *As built (`RS-2`):*
    - **The route.** Every reachable action is driven through the authoring route (`authoring-route-disposition.test.ts`,
      keyed by the action union).
    - **Hand-built limbs** (the code first, third, and with independence holding) sit beside the real-shape test.
    - **Membership** of `OPERATIONAL_REVIEW_CODES` is equivalent until `RS-3` reads the set.
- **D8 — The page's blocked hint follows the record (`REG-F-462`).**
  - **What changes.** When the reasoning-review policy's observations include a code in `OPERATIONAL_REVIEW_CODES`,
    the hint no longer says "revise the graph". Its new text:

    *"Publishing is blocked until the floor is SATISFIED — the Reasoning Review did not reach a verdict on this graph
    (its findings, below, say why). Fix the reviewer and re-run assurance; revising the graph does not address this."*

    Otherwise the hint is unchanged.
  - **Keyed on the recorded CODES, not on the action.** The catch-all `RETRY_OR_CONFIGURE_REVIEWER` branch
    (`floor.ts:291-298`) also covers an assessment left ASSESSING with a blocking finding. That is the waiver e2e's
    staged floor (`e2e/assurance-floor-waiver.e2e.ts:111-122`), where "do not revise" is not established.
  - **What stays.** The waiver e2e (`/revise/i`, not `/waiv/i`) and `MU-F202`'s two anchors
    (`'Publishing is blocked until the floor is SATISFIED — revise the graph and re-run.'` and
    `'{#if !data.floor.satisfied}'`) each still occur exactly once, and are still killed.
  - **The new text names no waiver and no route past the floor.** ASR-3's comment above the hint
    (`+page.svelte:2114-2119`) holds: re-running assurance with a working reviewer is the floor running, not a route
    past it.
  - **The guidance is not repeated in the hint.** The resume banner already shows it (`+page.svelte:1067-1069`,
    `REG-F-447`), and every operational guidance string names a waiver.
  - **Proof.** A NEW e2e stages a floor whose review recorded `VALIDATOR_EXECUTION_FAILED`, and asserts the new sentence
    positively. It has its own mutant. e2e becomes 95 existing plus the new.
  - ⭑ *As built (`RS-3`), a DEVIATION from D8 above, made on its two adversarial verifications:*
    - **The hint asks the floor's own classifier, not the recorded codes.** `floorBlockedHint` (`floor.ts`) reads
      `isOperationalRemediation(classifyFloorRemediation(floor).action)`, once, on the server, over the floor the page
      shows, a staged candidate's fork included. Code keying left "revise the graph" beside blocks whose guidance says
      "Do not revise the PWA": an incomplete review with no subject finding (the default lane's resume-hint case), an
      ESCALATED review, an INCONCLUSIVE one with nothing recorded, no review at all. The hint and the guidance now
      cannot disagree about the review.
    - **Three sentences, not two.** An operational review beside a REJECTED non-review policy (a real graph defect)
      needs both instructions:
      - REVISE: *"Publishing is blocked until the floor is SATISFIED — revise the graph and re-run."* (unchanged).
      - NOT_BY_REVISION: *"Publishing is blocked until the floor is SATISFIED — the Reasoning Review did not reach a
        verdict that revising the graph can answer, so revising it does not address this. Run assurance again once the
        review's own cause is addressed."*
      - REVISE_AND_REVIEW: *"Publishing is blocked until the floor is SATISFIED — revise the graph for the findings the
        floor records against it; the Reasoning Review itself did not reach a verdict that revising can answer, so run
        assurance again once the review's own cause is addressed."*
    - **Why D8's sentence changed.** It said *"(its findings, below, say why)"*, but the findings sit above and the
      waiver form below. *"Fix the reviewer"* could also read as reconfiguring after a substitution.
    - **The waiver e2e's fixture was the tell.** Its revision test staged a review left ASSESSING, which the
      classifier calls incomplete. It is re-staged as the concluded REJECTED assessment its title describes, with
      every assertion byte-identical. Its other test concludes INCONCLUSIVE, the shape the product records after a
      throw: `MU-F202-the-floor-blocks-only-on-REJECTED` needs a non-REJECTED review.
    - **The real path is pinned.** A load test covers the staged fork's floor in each of the three shapes. A
      default-lane e2e covers the resume-hint candidate, a waiver recorded through the form, and the combined case.
    - **Left to the classifier** (`REG-F-472`): it answers a composite block by the review alone, and a non-review
      validator that did not execute as findings to resolve. The findings list's first-five slice can hide the
      operational observation (`REG-F-471`).
- **D9 — Documents and comments.** Each is to say what the code then does.
  - `apps/rph-demo/README.md` and `AUTHORING-BACKBONE.md`:
    - the agy executor runs `JPWB_EXECUTOR_MODEL`;
    - an executor program override is refused outside test mode;
    - executor refusals come before dispatch;
    - the substitution's action and guidance;
    - the page hint.
  - `SELECTED_REVIEWER_GUIDANCE`'s REG-F-458 clause (`reviewer-selection.ts:73-74`, pinned by
    `reviewer-selection.test.ts:132-134`).
  - Comments that become false:
    - `agy-cli.ts:11-13`, `:71-72`, `:100-123`;
    - `model.ts:10-11`, `:49-50`;
    - `backing-tool.ts:69`, `:335-346`;
    - `+page.server.ts:1339-1341`;
    - `playwright.live-exec.config.ts:21`;
    - `workbench.ts:257-260`;
    - `reviewer-selection.ts:141`;
    - `assurance/index.ts:62-63`;
    - `pi-executor.ts:56`;
    - `live-backend-isolation.probe.test.ts:9,56`;
    - `begin-execute-reviewer-preflight.test.ts:25-27`.
  - `SR2-M20`'s `why`.

## 4. What must hold

1. **The reviewer fingerprint does not move** (`2b6ca158…`), and the SELECTION in force stays covered. Nothing here
   changes the validator's prompts, criteria, budget or scoring. `gate:tail`'s `reviewer:qual:check` shows it.
2. **The gate's fixture executor survives, and is proven to.**
   - The selector returns STAND_IN in test mode with nothing configured.
   - `getExecutionSession(STAND_IN)`, opened and turned with the call AWAITED, returns the fixture's envelope with the
     echoed basis. This replaces `model.test.ts:124-131`, whose `retainsHistory` check an agy default also passes, and
     whose helper never awaited its assertion (`:106-121`).
   - `live-backend-isolation.probe.test.ts` asks `selectExecutor({ testMode: isTestMode() }).kind === 'STAND_IN'`, as
     its reviewer limb asks the registry (`:48-54`).
   - The 95 existing e2e stay green.
3. **Nothing is dispatched on an executor refusal.**
   - Route tests show, for each refusal code reachable through `beginExecute`: the guidance returned, no command
     dispatched, and the executor never opened.
   - Arrangements:
     - UNSET, UNKNOWN, UNWIRED and MODEL_UNSET run in server mode, with the reviewer admitted: devin with a model and
       no captured `JPWB_DEVIN_BIN`.
     - PROGRAM_OVERRIDDEN needs agy-cli to have captured `JPWB_AGY_BIN` at load, so it runs in its own test file with
       `vi.hoisted` setting the variable.
     - Admitted server-mode cases are pinned at SELECTOR level, with `overrides` injected, so no route test ever opens
       a real Pi.
   - **The control.** A server-mode TRANSFORMATION step with nothing configured SUCCEEDS, and has its own mutant.
     `:230-244` runs in test mode, where the selector answers STAND_IN, so it cannot fail for this guard.
   - The server-mode limb at `begin-execute-reviewer-preflight.test.ts:203-228` configures a valid executor, and its
     `model.js` mock returns the fixture for any opened session. Then its only refusal is the reviewer's, and `SR1-M37`
     stays killed by more than the message.
4. **The model run is the model recorded, with a red first.**
   - **G1.** Land the `deps` seam first, behaviour unchanged. A test opening `getExecutionSession(AGY)` with an injected
     exec then asserts `--model` is the selection's model, and is RED on the judge model. D2 turns it green.
   - **G2.** A route test (test mode) sets `JPWB_EXECUTOR=agy`, `JPWB_EXECUTOR_MODEL=x` and `JPWB_JUDGE_MODEL=y`, and
     injects the exec through the `model.js` mock. It asserts the EXECUTION exchange's recorded model is `x`, graded
     `HOST_CONFIGURED`, and that `y` appears nowhere in the argv.
   - **PI.** A gate test asserts `deps.openPi` receives `selection.modelId` and is not called until the returned opener
     is. A source assertion shows `pi-executor.ts` no longer reads `executorModel` or `JPWB_EXECUTOR_MODEL`.
   - **PER-12.** A rejecting exec through `getExecutionSession(AGY)` leaves no prompt fragment in the failure detail.
     This follows `agy-failure-sanitisation.test.ts:60-91`.
5. **No assertion is lost.** Every assertion on a removed function or constant has a named successor with equal or
   stronger content, and the landing report lists each one:

   | today | successor |
   |---|---|
   | `model.test.ts:40-49`, unset tool throws `/JPWB_EXECUTOR is not set/` | selector, server mode, `{}` → `EXECUTOR_TOOL_UNSET`, same text |
   | `model.test.ts:51-54`, unknown tool | selector → `EXECUTOR_TOOL_UNKNOWN`, `/Unknown backing tool 'nosuchtool'/` |
   | `model.test.ts:56-63`, agy returns a function | §4.4's argv test (stronger) |
   | `model.test.ts:65-74`, Pi not imported on selection | `openPi` not called until the opener is (§4.4) |
   | `model.test.ts:124-131`, the fixture | §4.2's awaited STAND_IN turn |
   | `model.test.ts:134-142`, agy in test mode is not the fixture | selector, test mode, agy + model → `AGY` |
   | `model.test.ts:144-152`, `JPWB_ASSESSOR` alone | selector, test mode, `{ JPWB_ASSESSOR: 'agy' }` → `STAND_IN` |
   | `backing-tool.test.ts:116-128`, `executorModel` text | `EXECUTOR_MODEL_UNSET`: `JPWB_EXECUTOR_MODEL is not set`, `does NOT fall back to JPWB_JUDGE_MODEL` |
   | `backing-tool.test.ts:130-139`, `/agy, pi, devin/` | `EXECUTOR_TOOL_UNSET` lists the WIRED tools, `/agy, pi/`, and NOT devin |

   The last row is a deliberate change of what is pinned, made stronger, not weaker (D1), and it is flagged.
6. **Red first, with a path.** Each gap names the test that turns red before the fix and why the fix reaches it (above,
   and per increment in the roadmap). Each increment's adversarial verifier writes its own mutants, and every survivor
   becomes a ledger mutant.
7. **Every ledger anchor in a touched file still occurs exactly once** (`verif/mutant-ledger.test.ts:254`). Anchors
   known to be at risk:
   - `SR2-M6` and `SR2-M35` (re-anchored, D6);
   - `SR1-M17`, `M18` and `M37` beside D4's insertion;
   - `SR3-M5`, `M6`, `M23`, `M24` and `M26` in `lane-config.ts`;
   - `SR2-M27` and `SR2-M29` in `agy-cli.ts`;
   - `MU-F202`'s two in `+page.svelte`.
8. **The ratchets.**
   - The export census is regenerated in every increment that adds, removes or re-signs an export: D1, D2, D4 and D6
     all do.
   - The per-file coverage floor does not regress.
   - `REG-D-087` and `REG-F-462`…`466` are in the register before any code cites them
     (`verif/register-citations.test.ts`).
   - ⭑ *As built (`RS-1`):* the export census walks `packages/` only, so `apps/` changes do not move it
     (*"surface unchanged"*). It counts `*.testing.ts` helpers as production (`REG-F-467`).
9. **The live-backend list is unchanged.** No new environment variable is introduced.

## 5. Filed with `REG-D-087`, not fixed here

- **`REG-F-463` — every Validator throw also records an `INDEPENDENCE_VIOLATION` whose statement is
  `'validator execution failed'`.**
  - No evaluator ran, so `DIFFERENT_MODEL` cannot be verified against the `SYSTEM` evaluator, and it is recorded as
    violated.
  - The execution plane prints `INDEPENDENCE_VIOLATION: validator execution failed` (`+page.server.ts:1607`).
  - ASR-13 can be read either way:
    - *"If required independence is missing … an independence violation is recorded"* reads unverifiable independence
      as missing;
    - or no assessment took place to be independent of anything.
  - Changing it moves the fingerprint's scoring (`runner.ts:251-257` hashes `independenceOk`). A RESCORED record
    suffices, at no charge (`REG-D-086`).
- **`REG-F-464` — the "What the reviewer returned" panel does not say the try was rejected, or which model answered.**
  - It shows the newest try's answer with *"Retained and verified"* (`assurance/reviewer-answer.ts:43-85`,
    `+page.svelte:2103-2113`).
  - After a substitution, it shows the substitute's answer as the reviewer's.
  - It is an omission, not a contradiction.
- **`REG-F-465` — the executors' recorded identities are not what the provider reported, and one provider is recorded
  two ways.**
  - **Pi's grade.** Pi records its registry's resolution of the CONFIGURED label, graded `PROVIDER_REPORTED`
    (`pi-executor.ts:321-326`, from `:57-66`).
    - Its `message_end` handler reads only `stopReason` and `errorMessage` (`:279-282`), although Pi's message type
      carries `responseModel` (`@earendil-works/pi-ai` `types.d.ts:282`).
    - `ROADMAP-backing-agent-tool-suite.md:58` names this class, and `devin-reviewer.ts:107` forbids it.
    - The authoring producer does the same (`agent/pi-agent.ts:123-126`).
    - The live lane's `PROVIDER_REPORTED` assertion (`execution.live.ts:212`) passes on the self-grade.
  - **One provider, two records.** The agy executor records provider `'agy'` and the agy reviewer `'google'`
    (`reasoning-review-validator.ts:434`). A `DIFFERENT_PROVIDER` policy (`assurance-rules.ts:204`) would read one
    provider as two.
  - **Why not fixed here.** The remedy needs one observation of what Pi's `message_end` actually carries for the
    configured provider, which is a live call.
- **`REG-F-466` — other operator affordances beside a refused or failed review, all REG-F-460's general form.**
  - The BLOCKED_EXTERNAL banner offers *"Refine it in the chat below"* (`+page.svelte:1068-1070`). Resuming re-runs the
    agent and the floor (`agent/+server.ts:387-388`), which is a billed call after a substitution.
  - The execution page's Retry step control (`undertakings/[id]/+page.svelte:66-68`).
  - `cleanupFailedTurn` marks every thrown turn REVISION_REQUIRED (`agent/+server.ts:282-287`), operational throws
    included.
  - The waiver affordance is offered beside every unsatisfied floor (`+page.svelte:2131-2147`), where the guidance says
    not to record one.
- **Noted, not filed.** `completeStep`'s `aiProduced` arm records `executedBy: 'agent-x'`
  (`undertakings/[id]/+page.server.ts:1749-1753`). This is a declared demo affordance whose comment states the intent
  (*"the demo's way of saying 'a model produced this output'"*). It is not an executor path.

## 6. For sponsor confirmation (`REG-D-087`)

1. **The scheduling.** *"Pickup from where you left off"* is read as taking up `REG-F-458`, `REG-F-459` and
   `REG-F-460` (see the Authority line).
2. **`REG-F-458` remedy (a).** The agy executor stays, and runs the model it records.
3. **The executor is selected the way the reviewer is.** Misconfiguration is refused before dispatch, and the selected
   executor tool's program override is refused outside test mode (`REG-F-459` (a)).
4. **A substitution is recorded additively,** as `VALIDATOR_MODEL_SUBSTITUTED` beside `VALIDATOR_EXECUTION_FAILED`. It
   is answered by a new action, `REQUALIFY_OR_RESELECT_REVIEWER`. **Its guidance text is the agent's wording** (D7):
   it says re-qualification and re-selection are sponsor decisions, and that the host is then configured to the new
   selection.
5. **`REG-F-462` is fixed within this work.** ~~The hint is keyed on the recorded codes.~~ ⭑ *As built (`RS-3`):* the
   hint asks the floor's own classifier, with three sentences (D8's as-built note).
6. **Post-confirmation deviations, recorded as superseding notes in `REG-D-087`** (`REG-005`:19: *"a correction is a
   superseding entry citing the entry it supersedes"*), with a pointer from each entry:
   - **`REG-D-085` said *"The gate starts with eight live-backend variables as `''`"*.**
     - `SR-1`, built after the confirmation (`86f5b1c1` 09:53, `032deaad` 12:37), REMOVES them.
     - The reason: `''` is still an override to the qualification harness (`scripts/reviewer-qual/preflight.ts:39`,
       `env[v] !== undefined`), and an empty program name to the adapters (`agy-cli.ts:17`, `?? 'agy'`).
   - **`REG-D-085` said *"Program overrides are honoured only in test mode"*.** That is true for the reviewer. It is
     false for the executor until `RS-1` (`REG-F-459`).
   - **`REG-F-457` G8 said *"as do its three vitest entry points"* inherit the shell.**
     - As measured in `SR-1` (under `SR1-M29`), `test:dist`, `test:coverage`, a direct `vitest run` in the app and the
       e2e server inherit it.
     - `turbo run test` does not: turbo 2.x's strict environment mode withholds `JPWB_*`
       (`DESIGN-the-selected-reviewer.md` G8 and `:148-149`).
     - The design corrected this as built; the register did not.

## 7. Changes from revision 1

Three critics found 3 BLOCKER, 16 MAJOR and 30 MINOR findings between them, with overlaps. Each is addressed.

- **BLOCKERs.**
  - D8 was keyed on the action, and would have broken the waiver e2e: its staged floor is ASSESSING, which classifies
    as operational. It is now keyed on the recorded codes, and shows no guidance.
  - D6 would have unanchored `SR2-M6` and `SR2-M35`. They are now re-anchored in the same commit.
- **The design itself.**
  - D6 gains four package limb tests. `reviewer:qual:check`'s proof is scoped to the fingerprint.
  - D7 uses a new action, chosen on meaning, with an exhaustive `isOperationalRemediation`. The execution plane's
    action name is fixed (G8), and the guidance is marked as the agent's wording.
  - D4 gains the `openPi` seam and names the successor of every removed assertion.
  - D2 keeps one sanitising implementation, with a `PER-12` test.
  - D5 restates the rules import-free, and adds a lane-labelled agy refusal.
  - D1 keys the overrides per tool, and its UNSET guidance lists only wired tools.
  - D3 discloses `PI_CODING_AGENT_DIR`.
- **§4.** §4.3's arrangements are now feasible and have a control that can fail.
- **Siblings found and filed.** Pi's self-graded identity and the agy provider (`REG-F-465`), and four operator
  affordances (`REG-F-466`).
- **§6.** The record correction is now three post-confirmation deviations.
- **Wording.** The Authority line names the other reading of the sponsor's words.
- **Citations corrected:**
  - `+page.server.ts:1483` interpolates the action and does not enumerate it;
  - `lane-config.ts:66` requires three keys;
  - `floor-registry.test.ts:365` is reviewer-only;
  - the `+page.svelte` ranges;
  - G3's "after the turn".
- **Increments.** There are now three, not two: D8 is its own increment, `RS-3`.

---

⭑ **SUPERSEDED IN PART SINCE LANDING — 2026-10-02, `JAN-ESCREC` `ER-1` (`REG-D-092`).** This design is kept as written. These of its statements no longer describe the product:
- **The hint's three sentences** (D8's as-built note; §6 item 5): there are FOUR. `ROUTE_TO_HUMAN` answers an escalated review, and the hint renders first in the floor panel's body.
- **The waiver target** (`observations[0]`): it is the first observation that is not `REVIEWER_RECOMMENDED_ESCALATION`, and the form is offered only where such a target exists.
- **The waiver affordance "beside every unsatisfied floor":** it is withheld where there is no target. It is still offered beside an operational block that records a finding, and while a draft is open (`REG-F-466`).
- **The resume banner** (`+page.svelte:1067-1069`): its sentence is composed by `resumeHintText` (`apps/rph-demo/src/lib/server/authoring-turn.ts`), names an escalation, and wraps.
