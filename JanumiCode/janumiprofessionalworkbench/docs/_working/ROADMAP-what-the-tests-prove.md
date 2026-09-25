# ROADMAP — `JAN-CRITREAD` `J`: what the browser tests prove, and what qualifies the reviewer

**Design:** `DESIGN-what-the-tests-prove.md` (revision 5, `c715be57`) · **Ratified:** `REG-D-071` (sponsor, 2026-09-23,
by adoption of its recommendations, with the open decisions delegated) · **Date:** 2026-09-23 · **Status:** ~~IN PROGRESS — `J1-1a`..`J1-2b`, `J1-4` and `J2-1` landed (`0b9026c4`, `938aebb3`, `e6ab50a9`, `dc6619e5`, `5594d545`, `2cfdb08d`, `92feb9ba`, `e5f9358b`, `6d879055`; `REG-D-073` and `REG-D-074` confirmed by the sponsor, `1fda2b3e`); `J2-3 + J2-4` land with this revision — the fingerprint, the check, `gate:tail` and the first run (`REG-D-075`, `REG-D-076`; its material failures `REG-F-449`, `REG-F-450` (frontier) and `REG-F-451` (local, not qualified))~~ ✅ **COMPLETE 2026-09-25** — every increment landed: `J1-1a` `0b9026c4`, `J1-1b` `938aebb3`, `J1-1c` `e6ab50a9`, `J1-1d` `dc6619e5`, `J1-2a` `5594d545`, `J1-2b` `2cfdb08d`, `J1-4` `92feb9ba`, `J2-1` `e5f9358b`, `J2-2` `6d879055`, `J2-3 + J2-4` `4ece4f09`, and `J1-3` with this revision. The default lane is 95 of 95; `REG-D-067` and `REG-F-409` are closed and `REG-D-071` is delivered; `J1-3`'s delegated decisions are `REG-D-077`.

⭑ **Exit:** in test engines, a declared stand-in answers the review — the checker's real judgements plus a remainder
the test stipulates, recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it and disclosed on every surface;
an admitting engine cannot be built over a durable store; the thirteen `REG-D-067` reds are green and the lane
control holds; a reviewer-qualification record exists with a first run that includes a deployable candidate, every
material failure is escalated as a register finding, and `reviewer:qual:check` runs in `gate:fast`'s tail;
`gate:fast` green.

⚠ **Rules for every increment.**
- **Gate.** Each increment runs `bun run gate:fast` and compares its failing e2e set AND each failure's location with
  the previous run's (`where.py`): same thirteen, same lines — or the increment stops and the difference is explained
  before anything is committed. From J1-3 on, the set must be empty.
- **Anchors.** An edit that moves a mutant's find-string re-anchors that entry in the same commit and re-drives it
  (`verif/mutant-ledger.test.ts:254`). Named below where known.
- **Ratchets.** New exports regenerate `guards:export`; new package code keeps its per-file coverage floor (an
  admitting arm must be reached by a test, not by construction).
- **Delegated decisions** (`REG-D-071`) are recorded in the register as the agent's best judgement, flagged for
  sponsor confirmation, in the increment that makes them.

---

## 0. Where this roadmap departs from the design, and why

A read-only check of the design's premises against the code (six readers, 2026-09-23) refuted or sharpened these.
Each departure is delegated best judgement under `REG-D-071`, recorded in `REG-D-072`.

| # | the design says | the code says | this roadmap does |
|---|---|---|---|
| D1 | `createEngine` refuses the admitting flag over a durable store | `Engine` is public (`rph-application/src/index.ts:5`); 132 sites build `new Engine` directly | the refusal lives in the **`Engine` constructor**, so `createEngine`, forks and direct construction all pass through it |
| D2 | the flag is required through `HandlerContext` | a required `HandlerContext` member breaks six typed test literals; the forcing function the design wants is on the **handle** | required on `EngineHandle` only; optional (absent = not admitting) on `CreateEngineDeps`, `EngineDeps`, `HandlerContext`. The recorder/witness mutant sets the member `false` — dropping a required member is `NO_COMPILE` and proves nothing |
| D3 | only Gate E's branch is scoped to `floor.reasoning-review` | an unscoped ladder composes SATISFIED where Gate E refuses, and `recordAssuranceRecordingPlan` throws (`record-assurance.ts:119-124`) | the ladder's branch is scoped to `floor.reasoning-review` too |
| D4 | — | a finding may be both `failed` and `stipulated`; the mapper keys findings last-wins (`validators.ts:286`) | a failed finding is `NOT_MET` whatever else it says; the dead-end APPEND-mutant argument is re-derived after the mapper lands |
| D5 | durability from `PRAGMA database_list` | the overlay and a test double also implement the port; `ArtifactStore`'s class-declared `DURABLE` is the pattern not to copy | a required `durability: 'DURABLE' \| 'NOT_DURABLE' \| 'UNKNOWN'`; SQLite reads the `main` row once at construction; the overlay reports its source's; only `NOT_DURABLE` admits |
| D6 | the registry belongs to the canonical handle | the handle is module-private; every `as()` view is a new object; a lookup through `getEngine()` lazily opens and seeds a second workbench in unit tests | the registry is the demo host's module state, discarded by `resetEngine`; the floor callers pass a lookup into `createFloorRegistry`; the work-product arm resolves its PWA on the canonical handle in the caller; no lookup ever calls `getEngine()` |
| D7 | `/test-api/reviewer-script` also refuses a durable store | under `isTestMode()` the store is in-memory by construction (`workbench.ts:38`, `:109`), so that limb has no path to red; and D1 already refuses | the limb is dropped. The route's red-first is a copy gated on `harnessExposed()` answering 200 under `server` + `JPWB_HARNESS=1` |
| D8 | the lane control is a per-test fixture teardown | `retries: 1` (`playwright.config.ts:30`) turns a violation that passes on retry into exit 0; a server action can finish after the teardown's read; no mark exists after the boot seed | **the server checks each segment between reset marks** — at every reset and at a final call from `globalTeardown` — and keeps violations; `globalTeardown` fails the run if any exist; the fixture keeps per-test attribution; a mark is also taken after the boot seed |
| D9 | J1-4 depends on nothing and may land after J1-3 | the lane control assumes no action outlives its test; the binding race cannot be exposed by a work-product delay (the binding is written at `undertakings/[id]/+page.server.ts:1039`, the floor at `:1413`) | **J1-4 lands before J1-3**; each race is shown red by holding the browser's POST with `page.route` (no product delay hook); seven sites, not four |
| D10 | the sequencing pin scans `*.e2e.ts`, exempts the harness by path, resolves `gate:fast` through `gate:tail` | `harness.ts` never matches `*.e2e.ts`, so the exemption's mutant cannot redden; a file-runner `gate:tail` hides the check from any resolver | the pin scans every `.ts` under `e2e/` and `e2e-live/` for the helper name or the route path, exempting `e2e/support/harness.ts`; `gate:tail` is a runner whose step list is exported and read by the pin; red first on `mkdtemp` fixtures |
| D11 | `reviewer:qual:check` is a root script | under bare `bun`, `@janumipwb/*` resolves to built `dist` — stale after a source edit | the check runs from source (decided in J2-3: a vitest config with the repo's aliases, or a build step first) |
| D12 | the validator carries the run's recorded identity | the transports choose their model from the environment (`agy-cli.ts:79`, `devin-reviewer.ts:67`) and capture `JPWB_AGY_BIN`/`JPWB_DEVIN_BIN` at module load | the runner refuses either override before importing a transport, sets the model variable to the recorded label, and asserts the argv through `agyPrint`'s exec seam |
| D13 | — | the reasoning-review policy requires a different model (`floor.ts:76`) | each case's producer carries a model id no candidate uses |
| D14 | — | harness code under `apps/rph-demo/src/lib/server/tools` or binding stderr under `apps/rph-demo/src` trips two gates | the runner and the Ollama transport live under `scripts/reviewer-qual/` |
| D15 | twelve unit files opt into test mode | ten do (`vi.hoisted`), three more through `vi.stubEnv`; four of the ten use the workbench's engine and become admitting | J1-2 measures those thirteen by name |
| D16 | the live authoring lane registers nothing | nothing guards that, and its specs import the harness module | D10's scan covers `e2e-live/` |
| D17 | the process-result arm follows later | a production process-result review exists (`process-result-floor.ts:236-265`) with its own wrapper | not factored in version one; stated: a change to `renderProcessResult` moves no fingerprint, and the probe set covers the framing through the print seam |

Also found, and filed rather than designed here: the draft page's resume hint says *"The reviewer call failed
(external/operational)"* for every `BLOCKED_EXTERNAL`, which is also what an INCONCLUSIVE review stages
(`REG-F-447`); J1-2 corrects the copy, because the stand-in's unregistered reviews land there.

---

## `J1-1` — the record, the flag, the lock, the two admitting branches

Four commits, each gated, in this order so each red is observable.

### `J1-1a` — the `stipulated` field, carried end to end, with no behaviour

- `canonical-vocabulary.json`: `StipulatedCriterionResult = ['MET']`, UNRATIFIED-AUTHORED, modelled on `PruneCause`
  (`:86-95`). `m3-commands-events.json`: an optional `stipulated` after `rationale` on `RecordCriterionResult`
  (`:635-661`) and `AssuranceCriterionEvaluated` (`:4440-4469`), each noting the `PruneCause` lesson. `bun run gen`;
  commit the regenerated `enums.ts`, `messages.ts`, `schemas/enums/StipulatedCriterionResult.json`;
  `validate.test.ts:197` 388 → 389 with its arithmetic note.
- The handler's payload literal (`handlers/assurance.ts:1710-1715`) copies it; `ReasoningReviewFinding` gains
  `stipulated?: true`; `FloorCriterion` gains `stipulated?: 'MET'`; the mapper (`validators.ts:321`) turns a
  stipulated, not-failed finding into `{outcome: UNABLE_TO_DETERMINE, stipulated: 'MET'}` (D4);
  `record-assurance.ts:160-171` sends it; `record-assurance.test.ts:253-255`'s allowed keys gain it.
- Re-anchor `MU-PFA-BD2-02-found-failure-class-scores-met` and `P7b-c` (both on `validators.ts:321`).

| Instrument | Must show first |
|---|---|
| a `RecordCriterionResult` carrying `stipulated: 'MET'` is accepted and the event carries it | RED on HEAD: `VALIDATION_FAILED` (strict schema) |
| the handler copies `stipulated` (mutant: drop the spread) | — a guard; neither `kit.ts:473-475` nor `verif/emitted-event-guard.ts` sees a DROPPED optional key |
| the mapper: stipulated clean → `UNABLE_TO_DETERMINE` + `stipulated`; failed + stipulated → `NOT_MET` (D4) | RED on HEAD for the first |
| `stipulated-row-is-not-a-pass.test.ts` (sibling of `reviewer-silence-is-not-a-pass.test.ts`): a stipulated row is INCONCLUSIVE for the ladder | green by construction (D); its mutant honours the stipulation unconditionally |
| `coerceJudgement` drops a model-supplied `stipulated` | — a guard; its mutant copies it |

### `J1-1b` — the flag, and the lock that keeps it off durable stores

- `admitStipulatedAnswers?: boolean` on `CreateEngineDeps` (`engine.ts:85`), `EngineDeps` (`command-bus.ts:34`) and
  `HandlerContext` (`kit.ts:28`); into `createEngine`'s enumeration (`engine.ts:192-198`); stored by `Engine` and put
  on the ctx literal (`command-bus.ts:548-553`). **Required** `readonly admitStipulatedAnswers: boolean` on
  `EngineHandle`, set in the handle literal and forwarded by the authoring turn's recorder and witness
  (`authoring-turn.ts:239`, `:294`) (D2).
- The stale comment at `engine.ts:188-191` is corrected: an omission from the enumeration fails closed for parent and
  fork alike; the divergence point is an override in `fork()`'s spread.
- `StorageAdapter.durability` (required, D5): SQLite from `PRAGMA database_list`'s `main` row at construction; the
  overlay from its source; `FaultInjectingStore` from its inner store. The **`Engine` constructor refuses**
  `admitStipulatedAnswers: true` unless `store.durability === 'NOT_DURABLE'` (D1).
- The demo host sets the flag only in the `TEST_MODE` branch of `newEngine` (`workbench.ts:170`; W2-a's line `:164`
  untouched).

| Instrument | Must show first |
|---|---|
| `Engine`/`createEngine` refuse the flag over a file store, a fork of one, and a driver-injected file store | RED before the refusal (the engine builds) |
| `durability` per adapter: file → `DURABLE`; `:memory:` and injected `:memory:` driver → `NOT_DURABLE`; overlay → its source's | new |
| **CONTROL** — the default in-memory store admits; so does its fork | green |
| the flag reaches the fork as it reaches the parent | — a guard; its mutant sets it `false` inside `fork()`'s spread (anchored so `MU-PFA-BD3-08`'s line stays unique) |
| the demo engine admits in mode `test` and not in `''`, `server`, or harness-only | new |

### `J1-1c` — the two admitting branches

- **The ladder** — `composeAssuranceOutcome` (`floor.ts:290`) and its wrappers `assuranceRecordingPlan`
  (`recording.ts:93`), `runDeMinimisFloor` and `runFloorAndPlanRecording` (`validators.ts:423`, `:437`) take an
  optional `{ admitStipulatedAnswers }`, default not admitting. When admitting, **and only for
  `floor.reasoning-review`** (D3), a row `UNABLE_TO_DETERMINE` + `stipulated: 'MET'` counts as met. `runPwaFloor`
  (`apps floor.ts:425`) and `runFloorOverSubject` (`floor-over-subject.ts:147`) pass `engine.admitStipulatedAnswers`.
  Re-anchor `validators.ts:443`'s mutant.
- **Gate E** — `undeterminedMandatoryCriteria` (`handlers/assurance.ts:2109-2141`) keeps the latest PAYLOAD per
  criterion; when `ctx.admitStipulatedAnswers` and the policy is `floor.reasoning-review`, a mandatory
  `UNABLE_TO_DETERMINE` whose latest event carries `stipulated: 'MET'` is not counted. Re-anchor `CR-03` ×2.

| Instrument | Must show first |
|---|---|
| an admitting engine: a floor resting on stipulations is SATISFIED and Gate E admits it (`record-assurance.test.ts`, custom RR validator) | RED after `J1-1a`, before the branches |
| a non-admitting engine: the same floor INCONCLUSIVE, Gate E refuses | green; its mutant ignores the flag |
| Gate E refuses a stipulated SATISFIED under a non-RR policy | — a guard; its mutant drops the scope |
| stipulated then unstipulated `UNABLE_TO_DETERMINE` for one criterion → refused | — a guard; its mutant takes the union |
| the ladder's scope: a stipulated row under a non-RR policy composes INCONCLUSIVE | — a guard (D3) |

### `J1-1d` — the channels closed

- `/test-api/dispatch` refuses the **whole** request, 4xx naming the step, before dispatching anything, if any
  `RecordCriterionResult` step carries `stipulated` (inserted after `:27`, so `P7a-f` stays anchored). Its red is only
  visible after `J1-1a`.
- `verif/stipulation-writers.test.ts` (AST, modelled on `agy-stderr-unbound.test.ts`): a property assignment named
  `stipulated`, or `admitStipulatedAnswers` assigned `true`, outside a pinned named list of files is red; readers are
  free. It walks `packages/*/src`, `apps/rph-demo/src` and `verif/` **including tests**, excluding `dist/`; it counts
  `new Engine(` and `createEngine(` arguments alike. Limbs: a positive control; every named file exists and writes;
  its own mutants (add a writer; drop a name; exclude tests).

| Instrument | Must show first |
|---|---|
| `[stipulated step, CompleteAssuranceAssessment]` refused, event log unchanged; CONTROL: without `stipulated` it dispatches | RED after `J1-1a` (the second step lands); mutant: the refusal moved inside the loop |
| the writer census | RED on a fixture writer; mutants as above |

---

## `J1-4` — the races, each shown red on its own route (before `J1-3`, D9)

Seven sites introspect straight after a click whose server action they depend on:
- **after "Accept exact candidate":** `agent-retention:51→52`, `execution-agent-authored-binding:68→73`,
  `graph-validation:62→64`, `pwa-coherence:98→100`;
- **after "Begin & Execute":** `execution-model-invocation:71→75`, `execution-agent-authored-binding:101-103→106` and
  its CONTROL `:166-170→172` (whose `toHaveLength(0)` passes vacuously when it loses the race).

Each waits for the action's response (`page.waitForResponse`, the `execution.live.ts:141-149` pattern) or the banner's
change before introspecting.

| Instrument | Must show first |
|---|---|
| each site, with the browser's POST held by `page.route` for a few seconds | RED before its wait (introspect runs first), GREEN after — driven in a scratch copy of the spec, not committed |
| the CONTROL site | cannot be shown red (its assertion is negative); its wait is added and it is stated so |

Each of the seven is in the thirteen, and the fix lands after the line where the test fails today, so the gate's
failure locations must not move.

⭑ **Landed 2026-09-24, as measured.** The four "Accept exact candidate" sites wait for the banner to leave
(`authoring-candidate-banner` hidden). The banner renders only while a pending turn exists, and the accept action
deletes the turn only after its batch commits, so its leaving proves the commit. A `waitForResponse` there left a
pending wait, and a second located failure, in a spec whose Accept button never renders today. The three "Begin &
Execute" sites use `waitForResponse` on the exact `?/beginExecute` POST. Each of the six red-able sites was shown red
under a held POST and green with its wait, and re-driven independently at four sites. The CONTROL is shown to pass
vacuously while its POST is held, and its residual is `REG-F-448`. Two failure locations moved, each by a pure line
shift on the same assertion: `execution-model-invocation.e2e.ts` `:235` → `:242` (+7) and
`execution-agent-authored-binding.e2e.ts`'s CONTROL `:148` → `:158` (+10). The line numbers above are those before
`J1-4`.

---

## `J1-2` — the stand-in, its registry and route, and the disclosure

- **The checker, extracted without behaviour change:** the mock's framing switch becomes an exported
  `judgeStructurally(input)`; `createMockReasoningReviewValidator` delegates to it. Re-anchor `P5-a`.
- **The registry** (D6): module state in `workbench.ts`, keyed `(pwaId, framing)`, cleared in `resetEngine`; a
  registration refuses a PWA the current engine does not hold (`getObjectOfType`, not a scan query). A lookup returns
  "none" without touching `getEngine()` when nothing is registered.
- **The stand-in** (`assurance/standin-reasoning-review-validator.ts`): `validatorId 'standin.reasoning-review'`,
  evaluator `{agentId 'standin-reviewer', modelId 'standin', providerId 'jpwb-test'}`; §4.1 rules 1–6. The lookup
  arrives through `createFloorRegistry`'s options from the floor callers. The work-product arm's PWA:
  `ARTIFACT.producingPwuId → PWU.undertakingId → UNDERTAKING.pwaId`, read on the canonical handle by the caller; any
  missing link means no registration, never a throw.
- **Selection:** `createFloorRegistry` (`assurance/index.ts:47`) returns the stand-in where it returned the mock.
- **The route** `/test-api/reviewer-script` (POST `{pwaId, framing, remaining: 'CLEAN'}`), gated on `isTestMode()`
  (D7); `verif/route-action-census.test.ts` PINNED gains it. **The helper** `registerStipulation` in
  `e2e/support/harness.ts`.
- **Disclosure** (§4.4): `FloorPolicyView` gains optional `evaluatedMandatory` / `stipulatedMandatory`, filled in
  `runPwaFloor` from the plan, and in `loadPwaFloor` by folding the latest reasoning-review assessment's criterion
  events with the policy's severities; the SSE floor line (`agent/+server.ts:56-63`) says *"… reasoning review: N
  criteria evaluated, M stipulated by the test, not reviewed"* when M > 0, keeping its prefix; the ✓ line (`:241`), the
  panel's per-policy ✓ and the header chip (`+page.svelte:939`, `:2073-2080`); the §38 view gains the fold and the
  Undertaking Assurance tab shows the counts; the double casts in `floor-over-subject.ts:221-231` replaced. The resume
  hint names an incomplete review as incomplete (`REG-F-447`).
- **Blast radius, measured** (D15): the thirteen test-mode unit files, run and recorded; comments that name "the mock
  reviewer" updated where the stand-in now serves.
- **The sequencing pin** (`verif/reviewer-qualification-sequencing.test.ts`, D10): red if any `.ts` under
  `apps/rph-demo/e2e/` or `e2e-live/` other than `e2e/support/harness.ts` names the helper or the route path while
  `reviewer:qual:check` is not reachable from `gate:fast` or `docs/tracking/reviewer-qualification/` holds no RUN line
  marked deployable.
- **An uncommitted observation:** the thirteen specs, registering in a scratch copy, run against this increment — so a
  non-reviewer red surfaces now, not at `J1-3`.

| Instrument | Must show first |
|---|---|
| the stand-in per arm and branch: graph clean 2 evaluated / 7 stipulated → SATISFIED; dead end RR-04 `NOT_MET` → REJECTED; WP with content 2/7; WP empty; process never stipulated; unreadable + registered → INCONCLUSIVE; unregistered → INCONCLUSIVE under `standin.*`; a missing chain link → no throw | new |
| the recommendation is derived | — a guard; its mutant copies the checker's constant |
| a registration survives no reset (register, reset, recreate the id, run → INCONCLUSIVE) | — a guard; its mutant keeps the registry |
| a registration reaches only the arm it names | — a guard; its mutant keys by PWA alone |
| the lookup never reads through the fork (`direct-load-containment`'s turn arrangement) | — a guard |
| a stipulated clean turn through `beginAuthoringTurn` reaches SATISFIED | — a guard; its mutants set `admitStipulatedAnswers: false` in the recorder, then the witness (D2) |
| selection | mutants: restore the mock; select the real adapter with an injected all-clean `print` |
| the route answers 404 under `server` + `JPWB_HARNESS=1` | RED first: a copy gated on `harnessExposed()` answers 200 |
| the SSE line, panels, chip and Assurance tab name the counts | today's fixed strings |
| the sequencing pin | RED on a `mkdtemp` fixture with a probe spec; mutant: drop the exemption (the harness module then reddens it) |

---

## `J2-1` — the case builders and case set version one

- **One pure module**, `apps/rph-demo/src/lib/server/assurance/review-input.ts`: `graphReviewInput(...)` and
  `workProductReviewInput(...)`, reproducing `apps floor.ts:394-413` and `work-product-floor.ts:159-181` exactly;
  both call sites rewired, with a byte-identity control test before the inline code is deleted. An import guard
  refuses `$lib`, `authoring-turn`, `workbench`, `floor` and `floor-over-subject`.
- **Graph cases** are literal `PwaMeta` + `PwaGraphNode[]` through the already-pure `buildPwaGraphExport`, keys in
  production order; fixed ids; a producer whose model id no candidate carries (D13).
- **Case set v1**, as data under `docs/tracking/reviewer-qualification/cases/`: on each of the graph and work-product
  arms, one clean case with a true reasoning account and three renamed copies, and one planted-defect case per RR
  criterion — about 26 — each with its oracle (criteria expected faulted, disposition expected, and whether the
  expectation is *uncontested* or *the author's claim*). Oracles versioned separately.
- **Conferral — delegated** (`REG-D-071`): the agent confers the set and records it as delegated best judgement. The
  oracle-integrity rule binds from here: no increment that edits the reviewer's prompt, criteria or scoring edits the
  cases, and version one tunes nothing.

| Instrument | Must show first |
|---|---|
| the builders reproduce production's content and prompt byte for byte (graph and work product) | the module does not exist |
| the import guard | its mutant adds a `$lib` import |
| every case materializes a prompt under the 28,000-character limit | new |

---

## `J2-2` — the runner, the transports, the record

- `scripts/reviewer-qual/` (D14): the runner drives the real validator with a transport at its `print` seam and
  scores through `composeAssuranceOutcome` over the RR reference alone (`floor.ts:56`, `:290`). A transport throw is
  recorded as a transport-failure class, not re-scorable.
- **Transports:** the product's `agyPrint` and `devinPrint`, deployable, with their bounds; a harness Ollama
  transport, not deployable, rebuilt from the `REG-F-427` scratch shim (unload before each call; record the served
  template hash and the server's clock; re-impose 240 s and the 28,000 check). D12's refusals and argv assertion.
- **Retention:** only `splitAnswerSpan(raw).answer` enters a tracked record; `REG-F-428` classes are detected
  harness-side over the raw span.
- **The record:** append-only NDJSON, line kinds RUN, CALL, ESCALATION, RESCORED, ACKNOWLEDGED, SUPERSEDED, HELD_OUT
  (§5.4), validated by a new verif test (closed line-kind vocabulary; append-only against git).

| Instrument | Must show first |
|---|---|
| a run over a stub transport produces RUN + CALL lines that validate | the runner does not exist |
| the runner refuses when `JPWB_AGY_BIN` or `JPWB_DEVIN_BIN` is set | — a guard |
| the recorded model label equals the argv's `--model` | — a guard; its mutant leaves the environment unset |
| a transport timeout and a refusal are classified apart | new |

---

## `J2-3` + `J2-4` — the fingerprints, the check, the tail, and the first run (one commit)

- **Fingerprints** (§5.5): one exported function, shared by the check and the runner — the probe set's materialized
  prompts, the budget constants (exported as one frozen object), the seed criteria whole, and a scoring digest over a
  fixed raw-reply corpus including every `REG-F-428` class and one repair.
- **`reviewer:qual:check`** (§5.6, three limbs), split into a pure core tested on in-memory fixtures and a CLI tested
  on `mkdtemp` fixtures; it reads source (D11). One mutant per limb.
- **`gate:tail`**: a runner that runs `reviewer:qual:check` and `bun run e2e` (in `apps/rph-demo`) and exits with the
  worse; its step list is exported for the pin (D10). `gate:fast`'s tail becomes `… && bun run gate:tail`;
  `verif/assurance-surface.test.ts` records the new step list; `REQUIRED_ROOT_COMMANDS` 10 → 12 (appended before
  `] as const;`); `VERIF_TEST_FLOOR` raised.
- **The first run:** the case set × two repetitions against (1) **one deployable frontier candidate** — the delegated
  choice is `agy` with `gemini-3.1-pro-high`, the model of all seven stored live reviews (`REG-F-439` (2)), set through
  `JPWB_JUDGE_MODEL` (`REG-D-052`: configured, never defaulted); (2) **one local candidate**, `gpt-oss:20b`, not
  deployable. Ollama models unloaded after. Every material failure is filed as a register finding and cited by an
  ESCALATION line in the same commit.
- **Register, with it:** `REG-Q-025` amended with what now exists (canary isolation, the record shape, the trigger,
  the held-out tier's deferral); the interim-carrier entry for `reviewer:qual:check` (`DOC-004:258`); the frontier and
  local candidate choices as delegated best judgement.

| Instrument | Must show first |
|---|---|
| the fingerprint MOVES on each component (a prompt branch, an oversize probe, a budget constant, a criterion field, a scoring rule, the repair prompt) | the function does not exist; one red row per component |
| the fingerprint does not move on a comment-only edit | — a guard; its mutant hashes whole files |
| each limb red on its fixture; an un-cited failure stays red across a fingerprint move; a SUPERSEDED line naming a reproducing record is refused; a scoring-only move discharged by RESCORED | the check does not exist |
| `gate:tail` exits non-zero if either step fails | — a guard; its mutants let either hide the other |
| the check on the committed record | RED before the first run's lines and escalations exist, GREEN with them |

---

## `J1-3` — the specs go green, and the lane control

- **Registrations** in the eleven, `assurance-floor`'s clean and dead-end tests, and `execution-model-invocation`
  (work-product arm) — in the test body, after the reset, reading the PWA id from the store.
- **Restatements** (Q6b): `assurance-floor`'s clean test (title and assertions on the criterion events: two `MET`,
  seven `UNABLE_TO_DETERMINE` + `stipulated`; the SSE counts) and `execution-model-invocation` (banner ~~`:221`~~ `:228`,
  message ~~`:235`~~ `:242` — moved by `J1-4`, the work-product arm's rows). The dead-end test asserts RR-04 `NOT_MET` with no stipulation.
- **43 files** import `test` from the harness module; a verif census reds any other `test` import from
  `@playwright/test` under `e2e/` (named and namespace forms).
- **The lane control** (D8): the server computes both limbs of §4.8 over each segment between reset marks (a mark
  after the boot seed too), at every reset and on a final `globalTeardown` call; violations are kept server-side and
  `globalTeardown` fails the run if any exist; the auto fixture attributes them per test. `/test-api/introspect`
  exposes the marks, the registry and a staged candidate's criterion and completion events.
- **The checker control** retitled in place (`default-lane-cannot-assure.test.ts`): *"delete when the checker itself
  is replaced, or judges all nine"*.
- **Register:** `REG-D-067` closed and its owed failing-set check struck at this first committed green (Q3c);
  `REG-F-409` closed; `REG-D-071`'s status moved to delivered; the ledger mutants whose e2e victims turn green
  re-driven (`MU-F202` ×4, `MU-PFA-BD3-02`, `DD4-M12`).

| Instrument | Must show first |
|---|---|
| the thirteen | red today (`REG-D-067`'s set) → green |
| the dead end with a clean stipulation: still REJECTED, RR-04 `NOT_MET` unstipulated | must stay green; the REPLACE mutant fails the verdict, the APPEND mutant the row (re-derived after `J1-1a`, D4) |
| the lane control's mutants at the lane's seams (§4.8), plus: a violation that passes on retry; a floor completing after the test; a run whose first spec never resets | — guards |
| the import census | its mutant reverts one spec's import |

---

## Order

~~`J1-1a` → `J1-1b` → `J1-1c` → `J1-1d` → `J1-4` → `J1-2` → `J2-1` → `J2-2` → `J2-3 + J2-4` (with the first run) →
`J1-3`.~~ ⭑ **Reordered 2026-09-23, on measurement:** `J1-1a` → `J1-1b` → `J1-1c` → `J1-1d` → `J1-2a` → `J1-2b` →
`J1-4` → `J2-1` → `J2-2` → `J2-3 + J2-4` (with the first run) → `J1-3`. Six of `J1-4`'s seven race sites sit AFTER
the line where their spec fails today (`agent-retention` fails at `:38`, before `:51`; the binding test at `:68`, the
accept click itself; its CONTROL at `:148`, before `:166`; `graph-validation` at `:61`; `pwa-coherence` at `:97`), so
no held request can reach them until the stand-in exists and a registration carries the draft past its review. Each
race is therefore shown red on the working tree with its spec temporarily registering, and only the wait is
committed. `J1-4` still lands before `J1-3` (D9). `J1-2` is split in two commits: the stand-in, its registry, route and
sequencing pin (`J1-2a`), then the disclosure (`J1-2b`). Nothing is pushed.
