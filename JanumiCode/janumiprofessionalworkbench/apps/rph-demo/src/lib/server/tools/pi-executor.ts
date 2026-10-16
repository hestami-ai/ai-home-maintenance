// JAN-TOOLSUITE TS-03 — the Pi EXECUTOR adapter: the tool that produces a work product.
//
// ⭑ THIS WAS THE AUTHORING AGENT'S SESSION SHAPE WITH THE TOOLS TAKEN AWAY. ~~An executing work unit renders a
// prompt and returns a work product; it has no business touching the workbench, so it gets no custom tools and
// no built-ins.~~ ⭐⭐ **JAN-EXEC PHASE 3 REPLACES THAT SENTENCE, AND THE REASON IT WAS EVER TRUE SURVIVES
// INTACT.** What an executing work unit has no business touching is the WORKBENCH — the governed objects, the
// command surface, the authoring broker — and it still touches none of them. What it now has is its own
// Undertaking's WORKSPACE: a file it may write there and a command it may run there, each minted ONLY when the
// step's RUNTIME_BINDING grants the capability that authorises it. `noTools: 'builtin'` is unchanged, so Pi's
// own coding tools stay off and every hand the model has was minted by this host.
//
// ⭑ THE PATTERN IS THE AUTHORING AGENT'S, ADOPTED RATHER THAN DERIVED (`REG-F-318`): `pi-agent.ts` already does
// `customTools: toPiTools(this.tools)` with `noTools: 'builtin'`, and `toTypeBox` is now shared between the two
// minters rather than copied (`agent/pi-typebox.ts` records why the copy was the hazard).
//
// ⚠ PI IS IMPORTED ONLY HERE, and only through a dynamic import at the call site, so ~~the mock path and the whole
// gate never load~~ ⭐ the mock path never loads its heavy Node deps — the rule `agent/index.ts` already follows. ⭐ (R3-C)
// And the gate loads them in one test alone: `pi-executor.test.ts` imports this module, to open a session over Pi's real
// loader with a faux provider (`REG-F-512`'s predicted red).
// ⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (d)) — STILL TRUE OF THIS MODULE AND OF THE CODING AGENT IT LOADS. The mapping of the
// minted tools onto Pi's tool definitions moved to `pi-execution-tools.ts`, which imports only a TYPE from Pi, because it
// decides the order a turn's calls run in (`REG-F-518`); its test drives that through Pi's CORE loop (`pi-agent-core`,
// `pi-ai`'s faux provider)~~, the one gate test that loads any part of Pi's SDK,~~ and never this module.
// ⭐ And the executor's resource-loader options moved to `pi-executor-resources.ts` (the lead's delegated decision of
// 2026-10-15, to be registered), which imports types alone from Pi: its test reads Pi's declaration of those options,
// and this module's source, and loads neither.
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	ModelRegistry,
	resolveCliModel,
	SessionManager,
	SettingsManager
} from '@earendil-works/pi-coding-agent';
import { answerFromTurnEnd } from './backing-tool.js';
import type { AdapterToolObservation, ToolInvocationResult } from './backing-tool.js';
import {
	producerWorkingDirectory,
	type ProducerSession,
	type ProducerSessionContext
} from '../execution/producer-session.js';
import {
	createMaterializedInputRecorder,
	type PayloadHookHost
} from '../agent/materialized-input.js';
import { mintExecutionTools } from './execution-tool-surface.js';
import { executorResourceLoaderOptions } from './pi-executor-resources.js';
import { toPiExecutionTools } from './pi-execution-tools.js';
import { createToolCallObserver } from './tool-call-observer.js';
import { createProcessRunObserver } from './process-run-observer.js';

/**
 * Resolve the executing model. ⛔ NO FALLBACK CHAIN, and that is the difference from the authoring agent.
 *
 * `pi-agent.ts` falls back to the user's Pi default and then to "first model with credentials" — reasonable for
 * an interactive chat. For an EXECUTOR it would be wrong: `REG-D-052` rules that the model is configured and its
 * absence is a REFUSAL, and a fallback would silently run professional work on a model nobody chose while the
 * record named it as though they had.
 *
 * ⭐ `JAN-SELRES` RS-1 (D4) — THE LABEL IS HANDED IN, NEVER READ HERE. It is the executor selection's model
 * (`execution/executor-selection.ts`), which `beginExecute` asked for before dispatch and which also names the record —
 * so the label configured, the label Pi resolves and the label the route falls back to are one read. ⚠ What Pi RECORDS
 * is its registry's resolution of that label, graded `PROVIDER_REPORTED` below, not a model the provider reported
 * (`REG-F-465`).
 */
function resolveExecutingModel(modelRegistry: ModelRegistry, configured: string) {
	// ~~Throws with REG-D-052's reasoning when JPWB_EXECUTOR_MODEL is unset.~~ ⭐ `JAN-SELRES` D1: an unset
	// `JPWB_EXECUTOR_MODEL` never reaches here — the selector refuses it before dispatch (`EXECUTOR_MODEL_UNSET`). What
	// can still refuse here is a label Pi cannot resolve, which needs Pi's SDK to know.
	const resolved = resolveCliModel({ cliModel: configured, modelRegistry });
	if (!resolved.model)
		throw new Error(
			`JPWB_EXECUTOR_MODEL is set to '${configured}', but Pi cannot resolve it to an available model. ` +
				'Run `pi --list-models` to see what this installation offers, and `pi auth check --provider <name>` ' +
				'to confirm credentials. ⛔ Refusing rather than substituting an available model: an evaluator or ' +
				'producer identity may not be a fiction (§8.4, §14.6).'
		);
	return resolved.model;
}

/**
 * ~~Wrap the minted execution tools as Pi custom tools.~~ ⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (d)) — MOVED, with its reasons,
 * to `pi-execution-tools.ts` (`toPiExecutionTools`): it decides the order a turn's tool calls run in (`REG-F-518`), and
 * this module loads Pi's SDK at module scope, so nothing in the gate could drive it here.
 */

/**
 * Run ONE bounded turn on Pi and return the work product plus who produced it.
 *
 * ⛔ `thinkingLevel: 'off'` — WE DO NOT SOLICIT CHAIN-OF-THOUGHT, and this is a settled position rather than a
 * convenience. `pi-agent.ts` already sets it with the reason: *"§9.7: never solicit private chain-of-thought.
 * Reasoning Review judges the agent's declared rationale and observable output, never the producer's interior."*
 * `PER-12` agrees from the other side: *"there is no obligation to solicit or procure a trace."*
 *
 * ⭑ SO THE PER-12 HAZARD DOES NOT ARISE RATHER THAN BEING MANAGED. Pi CAN emit reasoning — driving the CLI
 * without a thinking level returns `thinking` blocks alongside `text`. Had we solicited it, those bytes would
 * be volunteered reasoning that `PER-12` forbids reaching an evaluator's context (*"its presence in an
 * evaluator's context is a hidden-context independence violation (ASR-13)"*), and nothing in this codebase
 * detects that dimension. Not asking is the cheaper and stronger position.
 *
 * ⚠ `noTools: 'builtin'` STILL, and `customTools` now carries EXACTLY what the grant authorised. The authoring
 * agent grants WORKBENCH tools because authoring IS tool use; an executing work unit produces a WORK PRODUCT and
 * gets none of them — granting it those would let a step mutate the workbench outside the command surface that
 * governs every other change. What Phase 3 adds is disjoint from that: two tools bound to the Undertaking's own
 * workspace and runner, which reach no governed object at all.
 */
/**
 * Open ONE Pi session for a work unit and hand back a turn-taking handle.
 *
 * ⭑ THE SESSION OUTLIVES THE TURN, WHICH IS THE WHOLE POINT (`JAN-EXECSESS`). `piExecute` used to create and
 * dispose a session per call, so a repair try met a model with no idea what it had produced — and the findings
 * had to be spliced into a re-rendered instruction to compensate. Held open, the producer's own history carries
 * its previous work, which is the *"chat history, context window, context engineering"* the sponsor named as
 * the component responsible for tracking how it responded to feedback.
 *
 * ⛔ `thinkingLevel: 'off'` STILL. History is not chain-of-thought: it is the producer's record of its own
 * TURNS, which is what §9.7 says an account should rest on. `PER-12` is untouched by this change.
 *
 * ⭐⭐ JAN-EXEC PHASE 2 — IT RUNS IN THE UNDERTAKING'S WORKSPACE, AND IT USED TO RUN IN THIS REPOSITORY. Both
 * `cwd` arguments below read `process.cwd()`, which for the SvelteKit server is its own source tree — so the
 * executing model's notion of "here" was the workbench's own checkout. The opener now takes the Undertaking's
 * sandbox and `producerWorkingDirectory` is the only thing that may answer the question; there is no fallback
 * arm, so an unresolvable workspace REFUSES the session rather than quietly restoring the defect.
 *
 * ⭐⭐ JAN-EXEC PHASE 3 — THE STEP'S GRANT DECIDES THE MODEL'S HANDS, **BY ABSENCE**. `mintExecutionTools` is
 * handed the capabilities the RUNTIME_BINDING currently grants and returns only the tools they authorise; an
 * ungranted tool is never constructed, never named to Pi, and therefore never offered to the model. There is no
 * call to intercept and no refusal path to get wrong. ⛔ A capability check INSIDE a tool handed over anyway
 * would be strictly weaker — it depends on the check firing, and it advertises the privilege.
 *
 * ⭐ AND THE ADAPTER NOW WATCHES ITS OWN SESSION, which is what `R11`'s `observedToolCalls` has been waiting
 * for. `OBSERVED` and `NONE_OBSERVED` had NO PRODUCER at HEAD, by construction: this adapter minted nothing and
 * subscribed to nothing. Both are now reachable, and the reported facts are the ADAPTER's — §22.1 makes the
 * model's account untrusted external input, so *"the model said it ran the tests"* is not evidence that tests ran.
 *
 * ⚠ IT THROWS, MATCHING `resolveExecutingModel` DIRECTLY ABOVE, and for the same reason `REG-D-052` gives for
 * the model: a producer identity — or here, a producer LOCATION or TOOL SURFACE — may not be a fiction. The
 * caller records it as a failed step rather than letting it escape as a 500.
 */
export async function openPiExecutionSession(
	context: ProducerSessionContext,
	/** ⭐ `JAN-SELRES` RS-1 (D4) — the executor selection's model: the label this session runs and the record names. */
	modelId: string
): Promise<ProducerSession> {
	const working = producerWorkingDirectory(context);
	if (!working.resolved) throw new Error(working.refusedBecause);
	const cwd = working.directoryPath;

	// ⛔ MINTED BEFORE THE SESSION EXISTS, AND THAT ORDER IS THE POINT. `mintExecutionTools` refuses a catalog
	// name the permanent record plane could not hold; doing that here means the refusal lands before a model has
	// been told anything, before a turn is taken, and before any exchange record is owed. The same argument
	// `run-model-step.ts` makes for checking the binding *"before the prompt is rendered and before any model is
	// called"* — a check that fires afterwards disclosed the harm afterwards.
	// ⭐⭐ PHASE 5 — THE HOST'S SECOND INSTRUMENT, BESIDE `createToolCallObserver` AND DELIBERATELY NOT INSIDE IT.
	// One watches the SESSION's event stream and holds what `R11` lets a PERMANENT record carry — an ordinal, a
	// provenance, a name, an outcome. This one holds what a command actually produced, which is CONTENT-plane
	// material that may never reach that record. Merging them would put an exit code one field away from a
	// structure whose emptiness is a ratified guarantee.
	const processRuns = createProcessRunObserver();
	const tools = mintExecutionTools({
		ports: { workspace: context.workspace, runner: context.runner, processRuns },
		grantedCapabilities: context.grantedCapabilities,
		// ⛔ `B-1` — THE STATUS TRAVELS WITH THE LIST, because a REVOKED binding still lists what it granted.
		bindingAuthorizationStatus: context.bindingAuthorizationStatus
	});
	const mintedToolNames = tools.map((t) => t.name);
	const observer = createToolCallObserver();

	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	// ⛔ TRUSTING NO PROJECT (the check of E4's polish round, F1): Pi trusts a project's `.pi/settings.json` by default, and
	// the workspace is a project the executor writes into — so a unit's `write_file` of that file made every later unit's
	// load install what it listed and was missing, by the command it named, on this host with this server's environment.
	// Untrusted, the workspace's settings are not read at all; the agent folder's, the operator's own, still are.
	const settingsManager = SettingsManager.create(cwd, getAgentDir(), { projectTrusted: false });
	const model = resolveExecutingModel(modelRegistry, modelId);

	// ⭐⭐ THE EXECUTOR'S INSTRUCTION IS THE CONTRACT AND ITS TOOLS ARE THE MINTED ONES — NOTHING PI FINDS AROUND THE
	// WORKSPACE (the lead's delegated decision of 2026-10-15, to be registered). ~~The contract overriding the system prompt
	// alone~~ — Pi's loader is told to leave out the context files, an appended prompt, extensions, skills and prompt
	// templates too (`executorResourceLoaderOptions`). ⚠ THIS CHANGES THE EXECUTOR'S BEHAVIOUR: by Pi's defaults each of
	// those reached it until now; `pi-executor-resources.ts` says what each was.
	const loader = new DefaultResourceLoader(
		executorResourceLoaderOptions({ cwd, agentDir: getAgentDir(), settingsManager })
	);
	await loader.reload();

	const created = await createAgentSession({
		model,
		thinkingLevel: 'off',
		// ⛔ PI'S OWN CODING TOOLS STAY OFF. `noTools: 'builtin'` is what makes `mintedToolNames` a COMPLETE
		// statement about the model's surface rather than a partial one: with the built-ins live, the model
		// would hold a shell this host never minted, never observed and could not report.
		noTools: 'builtin',
		customTools: toPiExecutionTools(tools),
		resourceLoader: loader,
		// ⚠ IN-MEMORY, AND THAT IS A DISCLOSED BOUND. The session survives the work unit and NOT a restart —
		// so the memory this change adds is per-unit and process-local, which the design states rather than
		// letting a reader infer durability that is not there.
		// ⚠ AND GIVEN NO FOLDER, so the session takes `process.cwd()`, and the working-directory line Pi ends the
		// system prompt with names the server's folder, not the workspace — found in the E4 polish round and not
		// changed: an open question (`pi-executor-resources.ts`).
		sessionManager: SessionManager.inMemory(),
		settingsManager,
		authStorage,
		modelRegistry
	});
	const session = created.session;

	// ⭑⭑ E-1 MUST RECORD THE COMPOSITE ONCE THE SESSION IS HELD. `pi-agent.ts:157` states why: *"THIS IS THE
	// ONLY POINT WHERE THE COMPOSITE EXISTS … Pi assembles resources, tool schemas and HISTORY on top."* With a
	// session, turn 2's real input is the system prompt plus turn 1's exchange plus the findings — so recording
	// the turn TEXT as E-1 would name a turn while the model saw a conversation, and `PER-9` is explicit that a
	// template *"never substitutes for"* the record. Installed AFTER creation because the hook lives on
	// `session.agent`.
	const inputs = createMaterializedInputRecorder();
	inputs.install(session.agent as unknown as PayloadHookHost);

	// ⭐⭐ `B-2` — WHAT THIS ADAPTER SAW ON THE TURN THAT IS RUNNING, HELD SO A **THROW** CANNOT LOSE IT.
	//
	// ⛔ THE MEASUREMENT IS ALREADY TAKEN WHEN THE FAILURE ARRIVES. `observer` is SESSION-scoped, the
	// subscription is opened inside `turn()` and closed in its `finally`, so every `tool_execution_start` /
	// `_end` that reached this host before `session.prompt` rejected is already in it. Reporting the calls only
	// through the RETURN VALUE made them unreachable on exactly the path where they matter most — the caller's
	// catch arm then recorded `NOT_OBSERVABLE` *"nothing was in a position to observe tool calls"*, which was
	// FALSE of this adapter and collapsed `R11`'s *"nothing could look"* into *"the call failed"*.
	//
	// ⚠ ITS INITIAL VALUE IS A REFUSAL TO GUESS, not an empty observation. Before any turn there is no turn to
	// report on, and `canObserve: true` with an empty `calls` would read as a MEASUREMENT — the exact
	// fabrication `governedToolCallReport` refuses when it declines to call an absence of looking
	// `NONE_OBSERVED`.
	let lastTurn: AdapterToolObservation = {
		canObserve: false,
		reason:
			'This session has taken no turn yet, so there is no turn for this adapter to report an observation ' +
			'about. It is not evidence that no tool ran.'
	};

	return {
		retainsHistory: true,
		lastTurnObservation: () => lastTurn,
		// ⭐ PHASE 5 — SESSION-SCOPED, LIKE THE TOOL-CALL OBSERVER AND FOR THE SAME REASON: a turn's runs are
		// a SLICE of this, and slicing needs the whole. The caller reads it after the turn it cares about.
		processRuns: () => processRuns.observed(),
		dispose: () => session.dispose(),
		async turn(text: string): Promise<ToolInvocationResult> {
			let answer = '';
			let reasoning = '';
			// ⭐⭐ `JAN-NOANS` — WHAT THE TURN ENDED AS, WHICH THIS ADAPTER IS THE ONLY PARTY IN A POSITION TO KNOW.
			//
			// ⛔ `REG-F-410`: a provider refused the configured model, `session.prompt` RESOLVED, no `text_delta`
			// ever arrived, and this adapter returned `answerText: ''`. Downstream that became a PRODUCER
			// shortfall — *"The answer is not a JSON object"* — an ACCEPTED try, a zero-byte artifact and nine
			// CRITICAL findings against work that was never attempted. Every layer below was reasoning correctly
			// from a fact this layer had and threw away.
			//
			// ⚠ `message_end` IS THE RIGHT ANCHOR AND `message_update` IS NOT, which is not obvious and cost a
			// reading of the SDK to establish. `AssistantMessageEvent` HAS an `error` member, so
			// `else if (e.type === 'error')` in the handler below looks correct — but `pi-agent-core`'s loop
			// forwards only the nine streaming DELTAS as `message_update`, and routes BOTH `done` and `error`
			// through `message_end`. That arm would never fire.
			let ended: { readonly stopReason: string; readonly errorMessage?: string } | undefined;
			const before = inputs.captured().length;
			// ⭐ THE MARKER THAT MAKES THE OBSERVATION PER-TURN. The observer spans the whole SESSION (it must:
			// Pi dispatches tool calls inside `prompt`, across an unknown number of provider round trips), and a
			// repair turn's record must name the calls THAT turn made — not the ones its predecessor made, which
			// are already recorded on their own exchange. Same idiom, same reason, as `inputs.captured().length`
			// one line up.
			const callsBefore = observer.count();
			const unsubscribe = session.subscribe((event) => {
				// ⭐⭐ R11 / PHASE 3 — THE ADAPTER'S OBSERVATION, TAKEN FROM THE SESSION AND NOT FROM THE ANSWER.
				// §22.1 makes the model's account untrusted external input; these two arms are what the host
				// itself watched happen. ⚠ `tool_execution_update` is deliberately NOT handled: a partial result
				// is not an outcome, and treating one as an end would grade a call that is still running.
				if (event.type === 'tool_execution_start') {
					observer.started(event.toolCallId, event.toolName);
					return;
				}
				if (event.type === 'tool_execution_end') {
					observer.ended(event.toolCallId, event.result, event.isError);
					return;
				}
				// ⭐ THE TERMINAL FACT. `stopReason` is `'stop' | 'length' | 'toolUse' | 'error' | 'aborted'` and
				// `errorMessage` carries the provider's own sentence. Read here and classified below, because a
				// turn that ends in `error` must never be reported as a producer that chose to say nothing.
				if (event.type === 'message_end') {
					const m = event.message as { role?: string; stopReason?: string; errorMessage?: string };
					if (m.role === 'assistant' && typeof m.stopReason === 'string')
						ended = { stopReason: m.stopReason, ...(m.errorMessage ? { errorMessage: m.errorMessage } : {}) };
					return;
				}
				if (event.type !== 'message_update') return;
				const e = event.assistantMessageEvent;
				if (e.type === 'text_delta') answer += e.delta;
				// ⭑ CAPTURED, NOT SOLICITED. With `thinkingLevel: 'off'` this stays empty; a model that
				// volunteers reasoning anyway is recorded as an OBSERVED presence, because silently discarding
				// it is the undeclared omission `REG-D-057` forbids.
				else if (e.type === 'thinking_delta') reasoning += e.delta;
			});
			try {
				await session.prompt(text);
			} finally {
				unsubscribe();
				// ⛔ IN THE `finally`, SO THE FAILING PATH AND THE SUCCEEDING PATH RECORD THE SAME MEASUREMENT.
				// Writing it after the `try` would leave it unset for exactly the case it exists for, and
				// writing it in a `catch` would make the two paths disagree about which calls belong to this
				// turn. ⚠ NOTHING HERE MAY THROW: `since` is a slice over an in-memory array — the rule this
				// repository files as "cleanup must survive" — because a throw from a `finally` would replace the
				// model's real failure with this line's.
				lastTurn = {
					canObserve: true,
					mintedToolNames,
					calls: observer.since(callsBefore)
				};
			}

			// The payloads this turn produced — one per provider request, so a repair/retry inside Pi is included.
			const turnInputs = inputs.captured().slice(before);
			const composite = turnInputs.at(-1)?.payload;

			// ⭐⭐ `JAN-NOANS` — THE ANSWER, OR A STATED REASON THERE IS NONE.
			const classified = answerFromTurnEnd(answer, ended);

			return {
				answer: classified,
				...(reasoning ? { volunteeredReasoning: reasoning } : {}),
				rawOutput: reasoning ? reasoning + answer : answer,
				producer: {
					agentId: 'execution.model-invocation',
					modelId: model.id,
					providerId: model.provider
				},
				identityEvidence: 'PROVIDER_REPORTED',
				// ⭐⭐ R11 / JAN-EXEC PHASE 3 — AND THE ANSWER IS NOW AN **OBSERVATION**, WHICH IS WHAT `R11`
				// RECORDED AS OWED HERE.
				//
				// ~~(1) NO TOOL SURFACE EXISTS TO OBSERVE … (2) THIS ADAPTER DOES NOT SUBSCRIBE TO PI'S TOOL
				// EVENTS.~~ Both statements were TRUE and both are now FALSE, in this file, ninety lines apart:
				// `createAgentSession` above is called with `customTools: toPiExecutionTools(tools)`, and the
				// subscription above handles `tool_execution_start` and `tool_execution_end`. `R11`'s `W6` said
				// *"`OBSERVED` and `NONE_OBSERVED` have no producer until Phase 3"* — this is that producer.
				//
				// ⛔ AND IT IS STILL NOT THE MODEL'S ACCOUNT. Every field below comes from the SESSION'S event
				// stream, watched by this host; nothing is parsed out of `answer`. §22.1 classifies model output
				// as untrusted external input, so *"the model said it ran the tests"* is not evidence that tests
				// ran — and the whole value of this arm is that it is a different witness.
				//
				// ⭑ `mintedToolNames` IS THE SURFACE THIS SESSION ACTUALLY HAD, which is what makes
				// `NONE_OBSERVED` a MEASUREMENT rather than an absence: a reader learns both that nothing was
				// called AND what there was to call. With a capability ungranted the list is shorter, and the
				// record says so without anything having to describe the withholding in prose.
				// ⛔⛔ AND IT STOPS CLAIMING A MEASUREMENT WHEN THE TURN NEVER REACHED A MODEL. `NONE_OBSERVED`
				// renders as *"This adapter observes tool calls and observed none on this try … and the model
				// called nothing on it."* On the `REG-F-410` path NO MODEL RAN, so that sentence is an absence
				// wearing a measurement's words — the same defect as the answer half, in the field this
				// repository cites as the one that got it right. A record cannot be consistent while one field
				// says *"the model called nothing"* and the next says *"no model was invoked."*
				//
				// ⚠ THE TEST IS `CALL_FAILED`/`CALL_ABORTED`, NOT EMPTINESS. A model that ended its turn having
				// said nothing DID run, and `NONE_OBSERVED` is a true and useful measurement about it.
				observedToolCalls:
					classified.arrived || classified.cause === 'ENDED_WITHOUT_ANSWER'
						? { canObserve: true, mintedToolNames, calls: observer.since(callsBefore) }
						: {
								canObserve: false,
								reason:
									'The turn did not reach a model, so there was no model to observe using tools. ' +
									'Reporting NONE_OBSERVED here would assert that a model was watched and called ' +
									`nothing. The turn ended instead as: ${classified.cause}.`
							},
				...(composite === undefined ? {} : { materializedInput: JSON.stringify(composite) })
			};
		}
	};
}
