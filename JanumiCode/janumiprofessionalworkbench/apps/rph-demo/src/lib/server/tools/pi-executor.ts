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
import type { ProducerIdentity } from '../agent/types.js';
import { executorModel } from './backing-tool.js';
import type { ToolIdentityEvidence } from './backing-tool.js';

/**
 * One backing-tool invocation, carrying the facts the exchange record needs.
 *
 * ⭑ THE OLD SEAM COULD NOT CARRY THESE, WHICH IS WHY `PROVIDER_REPORTED` HAD NO PRODUCER. `print: (prompt) =>
 * Promise<string>` returns a bare string: no provider, no model, no separated reasoning span. The evidence arm
 * was unreachable *by construction*, not by oversight.
 */
export interface ToolInvocationResult {
	/** E-2, answer half — the work product. */
	readonly answerText: string;
	/** E-2, reasoning half. ⭑ `undefined` here means NONE AROSE, which is an observed absence (PER-12), not a
	 *  failure to capture. See `thinkingLevel` below for why none arises. */
	readonly volunteeredReasoning?: string;
	/** E-2, whole — retained for the blocked path only. */
	readonly rawOutput: string;
	/** E-3 — the ACTUAL producer, never a role label. */
	readonly producer: ProducerIdentity;
	/** E-3 evidence grade. `PROVIDER_REPORTED` because the values below come back FROM the resolved model. */
	readonly identityEvidence: ToolIdentityEvidence;
}

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
export async function piExecute(prompt: string): Promise<ToolInvocationResult> {
	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	const settingsManager = SettingsManager.create(process.cwd(), getAgentDir());
	const model = resolveExecutingModel(modelRegistry);

	const loader = new DefaultResourceLoader({
		cwd: process.cwd(),
		agentDir: getAgentDir(),
		settingsManager,
		// ⚠ AMBIENT CONTEXT IS SUPPRESSED DELIBERATELY. A resource loader left to discover AGENTS.md/CLAUDE.md
		// and project rules would put material into the producer's context that no record names — and if the
		// reviewer ever loaded the same material, that is ASR-13's *"shared hidden context"* dimension, which
		// nothing in this codebase detects. The step's prompt is the step's context.
		systemPromptOverride: () => EXECUTOR_SYSTEM_PROMPT
	});
	await loader.reload();

	let session: Awaited<ReturnType<typeof createAgentSession>>['session'] | undefined;
	let unsubscribe: (() => void) | undefined;
	let answer = '';
	let reasoning = '';
	try {
		const created = await createAgentSession({
			model,
			thinkingLevel: 'off',
			noTools: 'builtin',
			customTools: [],
			resourceLoader: loader,
			// Ephemeral: an execution step is one bounded turn, and a persisted session would carry context
			// between steps that no record accounts for.
			sessionManager: SessionManager.inMemory(),
			settingsManager,
			authStorage,
			modelRegistry
		});
		session = created.session;

		unsubscribe = session.subscribe((event) => {
			if (event.type !== 'message_update') return;
			const e = event.assistantMessageEvent;
			if (e.type === 'text_delta') answer += e.delta;
			// ⭑ CAPTURED, NOT SOLICITED. With `thinkingLevel: 'off'` this should stay empty; if a model volunteers
			// reasoning anyway, recording it as an OBSERVED presence is honest, and silently discarding it would
			// be the undeclared omission `REG-D-057` forbids.
			else if (e.type === 'thinking_delta') reasoning += e.delta;
		});

		await session.prompt(prompt);
	} finally {
		unsubscribe?.();
		session?.dispose();
	}

	return {
		answerText: answer,
		...(reasoning ? { volunteeredReasoning: reasoning } : {}),
		rawOutput: reasoning ? reasoning + answer : answer,
		producer: {
			// ⭑ THE ROLE, THE MODEL AND THE PROVIDER ARE THREE DIFFERENT FACTS. `REG-F-356` caught me putting the
			// model id in `agentId` and leaving `modelId` undefined, which made every review non-independent —
			// `differs()` requires BOTH sides defined, because an absence can never evidence independence.
			agentId: 'execution.model-invocation',
			modelId: model.id,
			providerId: model.provider
		},
		// The values above came back from the resolved model, not from host configuration alone.
		identityEvidence: 'PROVIDER_REPORTED'
	};
}

/**
 * The executor's system prompt.
 *
 * ⚠ DELIBERATELY MINIMAL. The work-unit's own prompt template is the instruction; anything added here is context
 * the PWU_TYPE did not author and the record does not name. `REG-D-058` ruled prompt templates are OWNED by the
 * work-unit type, and a system prompt that reasoned about the work would compete with that ownership.
 */
const EXECUTOR_SYSTEM_PROMPT =
	'You are executing one professional work unit. Follow the instruction exactly and return only the work ' +
	'product it asks for, in the format it specifies. Do not narrate, do not explain your reasoning, and do ' +
	'not ask questions.';
