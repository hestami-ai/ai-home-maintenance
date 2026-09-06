// JAN-TOOLSUITE TS-03 — the Pi EXECUTOR adapter: the tool that produces a work product.
//
// ⭑ THIS IS THE AUTHORING AGENT'S SESSION SHAPE WITH THE TOOLS TAKEN AWAY. An executing work unit renders a
// prompt and returns a work product; it has no business touching the workbench, so it gets no custom tools and
// no built-ins. That is the whole difference, and reusing the shape rather than inventing one is deliberate —
// `REG-F-318` prescribes the same *adopt-don't-derive* move.
//
// ⚠ PI IS IMPORTED ONLY HERE, and only through a dynamic import at the call site, so the mock path and the whole
// gate never load its heavy Node deps — the rule `agent/index.ts` already follows.
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
import { executorModel } from './backing-tool.js';
import { EXECUTION_CONTRACT_PROMPT } from '../execution/execution-contract.js';
import type { ToolInvocationResult } from './backing-tool.js';
import type { ProducerSession } from '../execution/producer-session.js';
import { createMaterializedInputRecorder, type PayloadHookHost } from '../agent/materialized-input.js';

/**
 * Resolve the executing model. ⛔ NO FALLBACK CHAIN, and that is the difference from the authoring agent.
 *
 * `pi-agent.ts` falls back to the user's Pi default and then to "first model with credentials" — reasonable for
 * an interactive chat. For an EXECUTOR it would be wrong: `REG-D-052` rules that the model is configured and its
 * absence is a REFUSAL, and a fallback would silently run professional work on a model nobody chose while the
 * record named it as though they had.
 */
function resolveExecutingModel(modelRegistry: ModelRegistry) {
	// Throws with REG-D-052's reasoning when JPWB_EXECUTOR_MODEL is unset.
	const configured = executorModel();
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
 * ⚠ `noTools: 'builtin'` with NO custom tools. The authoring agent grants workbench tools because authoring IS
 * tool use; an executing work unit produces a WORK PRODUCT. Granting it tools would let a step mutate the
 * workbench outside the command surface that governs every other change.
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
 */
export async function openPiExecutionSession(): Promise<ProducerSession> {
	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	const settingsManager = SettingsManager.create(process.cwd(), getAgentDir());
	const model = resolveExecutingModel(modelRegistry);

	const loader = new DefaultResourceLoader({
		cwd: process.cwd(),
		agentDir: getAgentDir(),
		settingsManager,
		systemPromptOverride: () => EXECUTION_CONTRACT_PROMPT
	});
	await loader.reload();

	const created = await createAgentSession({
		model,
		thinkingLevel: 'off',
		noTools: 'builtin',
		customTools: [],
		resourceLoader: loader,
		// ⚠ IN-MEMORY, AND THAT IS A DISCLOSED BOUND. The session survives the work unit and NOT a restart —
		// so the memory this change adds is per-unit and process-local, which the design states rather than
		// letting a reader infer durability that is not there.
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

	return {
		retainsHistory: true,
		dispose: () => session.dispose(),
		async turn(text: string): Promise<ToolInvocationResult> {
			let answer = '';
			let reasoning = '';
			const before = inputs.captured().length;
			const unsubscribe = session.subscribe((event) => {
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
			}

			// The payloads this turn produced — one per provider request, so a repair/retry inside Pi is included.
			const turnInputs = inputs.captured().slice(before);
			const composite = turnInputs.at(-1)?.payload;

			return {
				answerText: answer,
				...(reasoning ? { volunteeredReasoning: reasoning } : {}),
				rawOutput: reasoning ? reasoning + answer : answer,
				producer: {
					agentId: 'execution.model-invocation',
					modelId: model.id,
					providerId: model.provider
				},
				identityEvidence: 'PROVIDER_REPORTED',
				...(composite === undefined
					? {}
					: { materializedInput: JSON.stringify(composite) })
			};
		}
	};
}
