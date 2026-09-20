// JAN-TOOLSUITE TS-01/TS-02 — the supported agent tool suite, and the executor's OWN configuration.
//
// ⭑ THE SUITE IS A CAPABILITY DECLARATION, NOT A LIST OF NAMES. A name would let a tool be trusted for facts it
// never supplies — the fabricated-measurement defect this repository records repeatedly. So the recorder never
// asks "is this Pi?"; it asks "does this tool report its own identity?" and believes it exactly that far.
//
// ⚠ AND IT IS AN IN-PROCESS SEAM, NOT A PERSISTED CONTRACT — the same status `createFloorRegistry` declares for
// itself. Of the 100 closed enums in the ratified contracts NOT ONE names a tool, agent, provider, CLI or
// vendor, and `PER-2` would make a deployment fact permanent. A vendor name may not enter the wire vocabulary.
import type { ExchangeIdentityFact } from '@janumipwb/rph-contracts';

export type BackingToolRole = 'EXECUTION' | 'ASSURANCE';

/**
 * The two evidence grades a TOOL can supply, DERIVED from the ratified enum rather than re-listed.
 *
 * ⭑ `Extract` is doing real work here. Re-typing the strings would let this declaration drift from
 * `ExchangeIdentityFactSchema` silently; deriving makes a rename in contracts a COMPILE error here. The other
 * two members are excluded deliberately: `REQUEST_ASSUMED` and `NONE` describe a record's state, not a
 * capability a tool can have.
 */
export type ToolIdentityEvidence = Extract<
	ExchangeIdentityFact['evidence'],
	'PROVIDER_REPORTED' | 'HOST_CONFIGURED'
>;

/**
 * What a tool can be believed about itself.
 *
 * ⭑ EVERY FIELD DRIVES A RECORDED FACT, which is why this is a declaration rather than documentation:
 *   `identity`    → the E-3 `evidence` arm. `PROVIDER_REPORTED` when the tool echoes back which model answered;
 *                   `HOST_CONFIGURED` when only the host asserts it and the tool confirms nothing.
 *   `version`     → whether a resolved model VERSION is available. A model LABEL is not a version, and writing
 *                   one into the version field is the substitution `PER-9` forbids.
 *   `reasoning`   → how the §9.7 answer/reasoning split is performed. `STRUCTURAL` when the tool returns typed
 *                   blocks, `INLINE` when it must be located by scanning, `NONE` when the tool volunteers none.
 *   `diagnostics` → whether a failure diagnostic can carry the prompt. ⚠ Used to decide what to CHECK, never to
 *                   skip checking — see `diagnosticCarriesPrompt`.
 */
export interface ToolReports {
	readonly identity: ToolIdentityEvidence;
	readonly version: boolean;
	readonly reasoning: 'STRUCTURAL' | 'INLINE' | 'NONE';
	readonly diagnostics: 'PROMPT_FREE' | 'PROMPT_BEARING';
}

export interface BackingTool {
	readonly toolId: string;
	/** The roles this tool can serve. ⚠ Capability, NOT policy: independence is decided by `checkIndependence`
	 *  against recorded identity, never by which roles a tool declares. A tool that can do both is not thereby
	 *  permitted to do both AT ONCE for one subject. */
	readonly roles: readonly BackingToolRole[];
	readonly reports: ToolReports;
}

/**
 * The tools this host knows how to drive, each declaring only what was MEASURED by running it.
 *
 * ⛔ NOTHING HERE IS INFERRED FROM DOCUMENTATION. Every value was obtained by driving the tool, because the
 * `agy` seam records what guessing costs: that it takes the prompt only in argv, that an empty `--print`
 * errors, that `-` is taken literally, and that Windows caps the command line near 32,767 chars — all of it
 * learned the hard way.
 */
export const BACKING_TOOLS: readonly BackingTool[] = Object.freeze([
	{
		toolId: 'agy',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// The host asserts the model via JPWB_JUDGE_MODEL and agy never echoes it back.
			identity: 'HOST_CONFIGURED',
			version: false,
			// The answer must be LOCATED inside a text blob — `splitAnswerSpan`, a heuristic, not a structure.
			reasoning: 'INLINE',
			// ⛔ execFile rejects with `Command failed: <full argv>` and agy's argv carries the WHOLE prompt.
			diagnostics: 'PROMPT_BEARING'
		}
	},
	{
		toolId: 'pi',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// `--mode json` returns provider/model/api/responseId on every message.
			identity: 'PROVIDER_REPORTED',
			// ⚠ Pi reports a model LABEL (`gpt-5.4-mini`), which is NOT a version.
			version: false,
			// `thinking` and `text` arrive as SEPARATE TYPED BLOCKS, so the split is structural.
			reasoning: 'STRUCTURAL',
			// Reads the prompt from stdin, so argv carries none of it.
			diagnostics: 'PROMPT_FREE'
		}
	},
	{
		toolId: 'devin',
		roles: ['EXECUTION', 'ASSURANCE'],
		reports: {
			// ATIF-v1.7 export: `agent.model_name` plus per-step `extra.generation_model`.
			identity: 'PROVIDER_REPORTED',
			version: false,
			// ⭑ MEASURED ABSENCE, NOT AN ASSUMPTION: `thinking`/`reasoning`/`thought` appear NOWHERE in a full
			// export. `PER-12` — there is no obligation to solicit or procure a trace, so this is an observed
			// absence and must be recorded as one rather than as a blocked split.
			reasoning: 'NONE',
			// `--prompt-file` keeps the prompt out of argv entirely — stronger than stdin.
			diagnostics: 'PROMPT_FREE'
		}
	}
]);

/** The tool ids this host can drive, derived from the catalog so the two can never disagree. */
export const KNOWN_TOOL_IDS: readonly string[] = BACKING_TOOLS.map((t) => t.toolId);

/**
 * Select a backing tool for a role, or REFUSE with a message that says what is wrong.
 *
 * ⛔ A SILENT FALLBACK IS THE FICTION `REG-D-052` FORBIDS. If the configured tool is unknown or cannot serve the
 * role, substituting another one would run work on a tool nobody chose and record it as though they had.
 */
export function selectBackingTool(
	toolId: string,
	role: BackingToolRole,
	// ⚠ INJECTABLE ONLY SO THE ROLE REFUSAL IS REACHABLE IN THE GATE. Every tool in the real catalog declares
	// BOTH roles, so with the catalog hard-wired the role branch below could never be entered and its test
	// would assert nothing — "a control that cannot fail", which this repository has shipped before. Same
	// reasoning as `AgyExec`.
	catalog: readonly BackingTool[] = BACKING_TOOLS
): BackingTool {
	const tool = catalog.find((t) => t.toolId === toolId);
	if (!tool)
		throw new Error(
			`Unknown backing tool '${toolId}'. This host can drive: ${catalog.map((t) => t.toolId).join(', ')}. ` +
				'Refusing rather than substituting: running work on a tool nobody chose, and recording it as ' +
				'though they had, is the fiction REG-D-052 forbids.'
		);
	if (!tool.roles.includes(role))
		throw new Error(
			`Backing tool '${toolId}' does not declare the ${role} role (it declares: ${tool.roles.join(', ')}).`
		);
	return tool;
}

/**
 * One backing-tool invocation, carrying the facts the exchange record needs.
 *
 * ⭑ THE OLD SEAM COULD NOT CARRY THESE, WHICH IS WHY `PROVIDER_REPORTED` HAD NO PRODUCER. The execution seam was
 * `print: (prompt) => Promise<string>` — a bare string: no provider, no model, no separated reasoning span. The
 * evidence arm was unreachable *by construction*, not by oversight.
 *
 * ⚠ IT LIVES HERE, NOT IN THE PI ADAPTER, SO IMPORTING IT COSTS NOTHING. `run-model-step` needs this type, and
 * the adapter imports Pi's SDK at module scope — a type import from there would pull Pi's heavy Node deps into
 * the gate and undo the lazy loading `agent/index.ts` established.
 */
/**
 * ⭐⭐ `JAN-NOANS` — WHY NO ANSWER ARRIVED, WHEN NONE DID (`REG-F-410`).
 *
 * ⛔ THE THREE MEMBERS ARE NOT STYLISTIC. The assurance plane's `classifyParse` already states the argument
 * this union exists to carry: *"an empty response is an INFRASTRUCTURE OR BUDGET problem, prose is a PROMPT
 * problem, and well-formed JSON of the wrong shape is a CONTRACT problem. Collapsing them loses the only thing
 * the record was kept for."*
 *
 * ⭑ AND THE FIRST TWO ARE SEPARATE FROM THE THIRD FOR A MEASURED REASON. A provider that REFUSES a model and a
 * model that ENDS ITS TURN SAYING NOTHING are different facts with different remedies — one is a deployment
 * error, the other is a producer's behaviour. `REG-F-410` was recorded three times as the second when it was
 * the first, and a record that collapses them again would repeat the finding inside its own fix.
 */
export type NoAnswerCause =
	/**
	 * The call failed and the tool or provider SAID SO. ⛔ `message` is the reporter's own sentence, VERBATIM —
	 * never a gloss written from a status code. It is frequently the only line that identifies the fault
	 * (*"The 'gpt-5.4-mini' model is not supported when using Codex with a ChatGPT account"*), and a record
	 * without it costs a human a CLI reproduction to learn what the host already knew.
	 */
	| { readonly cause: 'CALL_FAILED'; readonly reportedBy: 'PROVIDER' | 'TOOL'; readonly message: string }
	/** The turn was cancelled or timed out. ⚠ Distinct from `CALL_FAILED`: nothing rejected the request. */
	| { readonly cause: 'CALL_ABORTED'; readonly message?: string }
	/** ⭑ The turn completed NORMALLY and the model emitted no answer. This one IS a fact about the producer. */
	| { readonly cause: 'ENDED_WITHOUT_ANSWER' };

/**
 * ⭐⭐ THE ANSWER HALF, OR A STATED REASON THERE IS NONE — a UNION, for the reason `AdapterToolObservation`
 * below is one.
 *
 * ⛔ IT USED TO BE `answerText: string`, AND THAT IS THE WHOLE OF `REG-F-410`. Every way a turn can yield
 * nothing collapsed into `''`, which is indistinguishable from an answer of zero length — so a provider that
 * refused the model reached `splitExecutionEnvelope('')`, which reported a PRODUCER SHORTFALL because a
 * producer shortfall is the only thing that function is able to report. The record then said the producer
 * ignored its contract; no producer had been asked.
 *
 * ⭑ THE ARGUMENT IS ALREADY IN THIS FILE, eight fields down, and it was simply never applied here: *"a shape
 * with an optional list would let a caller read `calls` off an adapter that cannot observe, and the value it
 * would read — the empty list — is the one that reads as a clean bill of health while asserting nothing at
 * all."* `answerText: ''` **is** that empty list. A sibling boolean would not do: a caller could still read the
 * string without consulting the flag, and the defect survives the fix.
 */
export type AdapterAnswer =
	| { readonly arrived: true; readonly text: string }
	| ({ readonly arrived: false } & NoAnswerCause);

/**
 * A bare-string seam's answer, classified. ⭑ Some backing tools are one-shot CLIs whose whole contract is
 * `Promise<string>` — they have nothing richer to report, and an empty stdout is all the host ever sees. This
 * is the ONE place that decides what such a string means, so the three seams that return one cannot drift.
 *
 * ⚠ `ENDED_WITHOUT_ANSWER`, NOT `CALL_FAILED`: a bare string carries no report of a failure, and inventing one
 * would be the mirror of the defect — asserting a cause nobody stated.
 */
export function answerFromText(text: string): AdapterAnswer {
	return text.trim() === '' ? { arrived: false, cause: 'ENDED_WITHOUT_ANSWER' } : { arrived: true, text };
}

/**
 * Classify a session turn that has ended, from the text it produced and how it terminated.
 *
 * ⭑ PURE AND SDK-FREE ON PURPOSE. The adapter that needs it imports Pi's heavy Node deps at module scope, so
 * it has no test in the gate — `model.ts` already records what that costs: *"NO UNIT TEST COULD HAVE CAUGHT
 * IT. Every test of `runModelInvocationStep` INJECTS its own `print` … the one adapter that narrows it was
 * never on any tested path. The LIVE lane found it on its second run."* Keeping the JUDGEMENT here and the
 * plumbing there is what puts this decision on a tested path at all.
 *
 * ⚠ TEXT WINS WHEN TEXT ARRIVED, AND THE BOUND IS DISCLOSED RATHER THAN HIDDEN. A turn that produced an answer
 * and *then* errored is reported as an answer: the professional's work is not discarded because the transport
 * died afterwards, which is the rule `splitExecutionEnvelope` already follows one layer up. ⛔ What that costs
 * is that a TRUNCATED answer is currently indistinguishable from a complete one — `outputTruncation` is the
 * field that should carry it, and nothing populates it. Named here, not silently decided.
 */
export function answerFromTurnEnd(
	text: string,
	ended: { readonly stopReason: string; readonly errorMessage?: string } | undefined
): AdapterAnswer {
	if (text.trim() !== '') return { arrived: true, text };
	if (ended?.stopReason === 'error')
		return {
			arrived: false,
			cause: 'CALL_FAILED',
			reportedBy: 'PROVIDER',
			// ⛔ A STATEMENT ABOUT THE REPORT, NOT ABOUT THE MODEL. When the tool reports an error with no
			// sentence, saying so is the honest record; inventing a cause would be the defect this union exists
			// to prevent, committed at the moment of preventing it.
			message:
				ended.errorMessage ??
				'The backing tool reported that the turn ended in error but supplied no message with it.'
		};
	if (ended?.stopReason === 'aborted')
		return {
			arrived: false,
			cause: 'CALL_ABORTED',
			...(ended.errorMessage ? { message: ended.errorMessage } : {})
		};
	// ⭑ Reached when the turn ended normally (`stop`, `length`, `toolUse`) with nothing said, AND when no
	// terminal event was seen at all. The second is not a claim that the model chose silence — it is the
	// weakest honest member, and the adapter that can do better reports better.
	return { arrived: false, cause: 'ENDED_WITHOUT_ANSWER' };
}

export interface ToolInvocationResult {
	/**
	 * E-2, answer half — the work product, OR a stated reason none arrived.
	 * ⛔ Narrow on `arrived`; there is deliberately no way to read a string off the absent arm.
	 */
	readonly answer: AdapterAnswer;
	/** E-2, reasoning half. ⭑ `undefined` means NONE AROSE — an observed absence (PER-12), not a capture failure. */
	readonly volunteeredReasoning?: string;
	/** E-2, whole — retained for the blocked path only. */
	readonly rawOutput: string;
	/** E-3 — the ACTUAL producer, never a role label. */
	readonly producer: { readonly agentId: string; readonly modelId: string; readonly providerId: string };
	/** E-3 evidence grade, supplied by the tool that answered. */
	readonly identityEvidence: ToolIdentityEvidence;
	/**
	 * ⭑ E-1 — THE PROVIDER PAYLOAD AS SENT, when the tool can report it.
	 *
	 * ⚠ THIS IS NOT THE TURN TEXT, AND THE DIFFERENCE IS THE POINT. With a HELD session (`JAN-EXECSESS`)
	 * the model's real input is the system prompt plus every prior turn plus this one; recording the turn
	 * alone would name a turn while the model saw a conversation. `PER-9`: a template *"never substitutes
	 * for"* the record. Absent for one-shot tools, whose turn text IS very nearly the composite.
	 */
	readonly materializedInput?: string;
	/**
	 * ⭐⭐ R11 — WHAT THIS ADAPTER OBSERVED THE MODEL DO WITH THE TOOLS IT WAS GIVEN.
	 *
	 * ⛔ §22.1 MAKES MODEL OUTPUT UNTRUSTED EXTERNAL INPUT, so *"the model said it ran the tests"* is not
	 * evidence that tests ran. The only party that can answer is the one that drove the session, which is this
	 * adapter — so the fact is reported HERE, beside `identityEvidence`, which exists for exactly the same
	 * reason one field up: what a tool CAN report is a catalog claim; what it DID report is this.
	 *
	 * ⛔ REQUIRED, NOT OPTIONAL. An absent field cannot distinguish *"this adapter minted tools and the model
	 * called none"* from *"this adapter cannot see tool calls at all"*, and those are different facts with
	 * opposite consequences for a reader: the first is a measurement they may rely on, the second is silence
	 * that means nothing. That is the distinction `ResolvedModelIdentity`'s docblock calls *"this repository's
	 * single most-recorded defect"*, and the union below costs one discriminator to avoid it.
	 */
	readonly observedToolCalls: AdapterToolObservation;
}

/**
 * One tool call, as the ADAPTER saw it — the raw observation, BEFORE the R11 retention ruling is applied.
 *
 * ⚠ THIS IS AN IN-PROCESS SHAPE AND IT DELIBERATELY CARRIES MORE THAN THE RECORD WILL. `name` here is whatever
 * the model asked for, un-checked; `governedToolCallReport` is the ONE place that decides what may be written
 * to a PERMANENT record and what may not. Keeping the decision in one function rather than in each adapter is
 * what makes the ruling testable, mutable and guardable instead of a convention three adapters each re-derive.
 */
export interface AdapterToolCall {
	/** As the model asked for it. ⛔ May be an arbitrary model-chosen string — see `governedToolCallReport`. */
	readonly name: string;
	/** What the ADAPTER observed happen to the call, never what the model said happened. */
	readonly outcome: 'COMPLETED' | 'REFUSED' | 'FAILED' | 'UNKNOWN';
}

/**
 * Whether this adapter can see tool calls at all, and what it saw.
 *
 * ⭑ A UNION FOR THE REASON `ProducerWorkingDirectory` IS ONE: a shape with an optional list would let a caller
 * read `calls` off an adapter that cannot observe, and the value it would read — the empty list — is the one
 * that reads as a clean bill of health while asserting nothing at all.
 *
 * ⭑ `mintedToolNames` RIDES ON THE OBSERVING ARM BECAUSE THE ADAPTER IS THE ONLY THING THAT KNOWS IT. The tool
 * surface is minted by whoever opens the session; a caller asked to supply the minted set separately would be
 * asked to re-derive a fact it does not hold, and the plausible wrong answer (an empty list) silently downgrades
 * every observed name to NOT_MINTED.
 */
export type AdapterToolObservation =
	| { readonly canObserve: false; readonly reason: string }
	| {
			readonly canObserve: true;
			readonly mintedToolNames: readonly string[];
			readonly calls: readonly AdapterToolCall[];
	  };

/** Narrow a seam return that may be either shape. ⭑ A bare string is a tool that told us only its answer, so its
 *  identity can only ever be HOST_CONFIGURED — the caller supplies what it configured. */
export function isToolInvocationResult(v: string | ToolInvocationResult): v is ToolInvocationResult {
	return typeof v !== 'string';
}

// ── The executor's OWN configuration ────────────────────────────────────────────────────────────────────────
//
// ⭑⭑ THIS IS THE ACTUAL DEFECT, AND IT IS ONE LINE OF CONFIGURATION. Until now the execution producer had no
// configuration of its own: `execution/model.ts` read the ASSURANCE backend switch `JPWB_ASSESSOR` and the
// ASSURANCE model `JPWB_JUDGE_MODEL`, so the producing model and the reviewing model were THE SAME BY
// CONSTRUCTION and `checkIndependence('DIFFERENT_MODEL', …)` could only ever refuse. Giving the executor its
// own keys is what makes producer and reviewer CAPABLE of differing; everything else merely records that they do.
//
// ⛔ NO APPLICATION DEFAULT, IN EITHER KEY. `REG-D-052` is a sponsor ruling that the model is configured, never
// pinned, and that its absence is a REFUSAL. `REG-F-331` is the measured reason: a pinned label rotted, the
// installed tool rejected it, and EVERY Reasoning Review failed. A default here would reintroduce that exact
// failure one layer over.

export function resolveExecutorToolId(configured = process.env.JPWB_EXECUTOR): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

export function resolveExecutorModel(configured = process.env.JPWB_EXECUTOR_MODEL): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

/** The tool that runs execution steps. Refuses when unconfigured. */
export function executorToolId(): string {
	const id = resolveExecutorToolId();
	if (!id)
		throw new Error(
			'JPWB_EXECUTOR is not set, and there is no application default: the tool that executes work units is ' +
				`a deployment choice and must be configured explicitly. Set it to one of: ${KNOWN_TOOL_IDS.join(', ')}. ` +
				'⚠ It must not name the same tool AND model as the assurance reviewer, or the reasoning review will ' +
				'be refused for non-independence (ASR-13), which is the check working rather than a fault.'
		);
	return id;
}

/** The model the executing tool runs. Refuses when unconfigured — never falls back to the JUDGE model. */
export function executorModel(): string {
	const model = resolveExecutorModel();
	if (!model)
		throw new Error(
			'JPWB_EXECUTOR_MODEL is not set, and there is no application default (REG-D-052: the model is ' +
				'configured, not pinned; REG-F-331: a pinned label rotted and every review failed). ' +
				'⛔ It deliberately does NOT fall back to JPWB_JUDGE_MODEL: that fallback is exactly the ' +
				'producer/reviewer collision this module exists to remove.'
		);
	return model;
}
