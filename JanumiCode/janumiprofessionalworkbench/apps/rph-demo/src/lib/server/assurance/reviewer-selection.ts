// ⭐ `JAN-SELREV` SR-1 (D2, D3) — WHICH REVIEWER THIS HOST RUNS, ANSWERED IN ONE PLACE.
//
// ⭑ ONE SELECTOR, THREE READERS. `createFloorRegistry` builds the floor from it, the authoring preflight refuses a
// turn from it, and `beginExecute` refuses a model step from it. They used to answer separately: the registry keyed
// on `JPWB_ASSURANCE_TOOL` while the authoring preflight still read the retired `JPWB_ASSESSOR`, so in test mode the
// two disagreed in both directions (`REG-F-443`, whose recorded remedy is *"through one function both call"*).
//
// ⛔ OUTSIDE TEST MODE THE TOOL IS CONFIGURATION, AND ITS ABSENCE IS A REFUSAL. An unset tool used to mean agy — a
// default introduced with the devin adapter and never put to the sponsor — and every value but exactly `devin` ran
// agy: `pi`, `Devin`, a typo (`REG-F-457` G1, G2). A silent fallback runs work on a tool nobody chose and records it
// as though they had, which `backing-tool.ts` names as the fiction `REG-D-052` forbids.
//
// ⚠ IT LIVES OUTSIDE `lib/server/tools` ON PURPOSE: that directory holds the backing-tool ADAPTERS, and
// `verif/tool-adapter-exports-reachable.test.ts` holds each of their exports to a production reference.
import { AGY_BIN_OVERRIDE, resolveJudgeModel } from './agy-cli.js';
import { DEVIN_BIN_OVERRIDE, resolveAssuranceModel } from '../tools/devin-reviewer.js';
import { selectBackingTool } from '../tools/backing-tool.js';

/** The environment the selector reads — `process.env` in the product, a plain record in a test. */
export type ReviewerEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * ⭐ `JAN-SELREV` SR-2 (D7) — the program overrides the reviewer adapters CAPTURED when they loaded: `JPWB_AGY_BIN`
 * (`agy-cli.ts`) and `JPWB_DEVIN_BIN` (`devin-reviewer.ts`). `undefined` is unset; `''` is SET, to an empty program
 * name, which the adapter would try to run.
 *
 * ⭑ CAPTURED, NOT READ FROM THE ENVIRONMENT. Each adapter reads its variable once, at load, and runs what it named for
 * the life of the process — so the value to refuse is the one it captured. A variable unset after the server started
 * would pass a check of the environment while the adapter still ran the replacement.
 */
export interface ReviewerProgramOverrides {
	readonly agy: string | undefined;
	readonly devin: string | undefined;
}

/** Why the reviewer is refused. Each names the refusal, so a caller can act on it without parsing prose. */
export type ReviewerRefusalCode =
	| 'REVIEWER_TOOL_UNSET'
	| 'REVIEWER_TOOL_UNKNOWN'
	| 'REVIEWER_TOOL_UNWIRED'
	| 'REVIEWER_MODEL_UNSET'
	| 'REVIEWER_PROGRAM_OVERRIDDEN';

/**
 * The selector's answer — exactly one of four.
 *
 * ⭑ `REFUSED` CARRIES THE TOOL IT REFUSED, when one was named, so no caller has to re-read the environment to say
 * which configuration was wrong: a second read is a second answer, which is how the two preflights came to disagree.
 */
export type ReviewerSelection =
	| { readonly kind: 'STAND_IN' }
	| { readonly kind: 'AGY'; readonly modelId: string }
	| { readonly kind: 'DEVIN'; readonly modelId: string }
	| {
			readonly kind: 'REFUSED';
			readonly code: ReviewerRefusalCode;
			readonly toolId: string | undefined;
			readonly reason: string;
			readonly guidance: string;
	  };

/**
 * What every refusal tells the operator: `REG-D-084`'s selection and the independence guidance of the design's §1.
 *
 * ⛔ GUIDANCE, NEVER A FALLBACK (D1). No code path reads these labels as a value. `REG-D-052` rules that the reviewing
 * model is configured and never pinned, and `REG-F-331`'s argument — a pinned label rots when the installed tool stops
 * recognising it — applies to a selected label as much as to any other.
 */
export const SELECTED_REVIEWER_GUIDANCE =
	'The selected reviewer (REG-D-084) is devin with glm-5-3-flash-max: set JPWB_ASSURANCE_TOOL=devin and ' +
	'JPWB_ASSURANCE_MODEL=glm-5-3-flash-max. That selection is configuration, not a default this host falls back to ' +
	'(REG-D-052); agy (JPWB_ASSURANCE_TOOL=agy with JPWB_JUDGE_MODEL), and devin with another model, stay ' +
	'configurable. ⚠ Independence (ASR-13): neither the executor (JPWB_EXECUTOR_MODEL; the agy executor runs ' +
	'JPWB_JUDGE_MODEL, REG-F-458) nor the authoring agent (JPWB_AGENT_MODEL, else Pi’s own settings, else the first ' +
	'model Pi has credentials for) may run a GLM-5.3 Flash model under any provider or spelling — the ' +
	'independence check compares the model ids the tools report by exact string, so another spelling of the same ' +
	'model would pass it falsely.';

/** The configured tool, trimmed; blank or whitespace is UNSET, exactly as `resolveExecutorToolId` reads its own. */
export function resolveReviewerToolId(configured: string | undefined): string | undefined {
	return configured?.trim() || undefined;
}

const refused = (
	code: ReviewerRefusalCode,
	toolId: string | undefined,
	reason: string
): ReviewerSelection => ({
	kind: 'REFUSED',
	code,
	toolId,
	reason,
	guidance: SELECTED_REVIEWER_GUIDANCE
});

/**
 * ⛔ D7 (`REG-F-441`, remedy (a)) — the refusal of a replaced reviewer program. The adapters record every review as
 * the real tool's whatever program they ran, so outside test mode no override of the selected tool's program is
 * allowed — not even an empty one, which the adapter would run as an empty program name.
 */
const programOverridden = (
	toolId: 'agy' | 'devin',
	variable: 'JPWB_AGY_BIN' | 'JPWB_DEVIN_BIN',
	program: string
): ReviewerSelection =>
	refused(
		'REVIEWER_PROGRAM_OVERRIDDEN',
		toolId,
		`The reviewing tool '${toolId}' would run a replaced program: ${variable}=${JSON.stringify(program)} was set when ` +
			`the server started, and it replaces the product’s own '${toolId}' program. Outside test mode a program ` +
			`override is refused, even when it is empty — the review would be recorded as ${toolId}'s, whatever the ` +
			`replacement is (REG-F-441). Unset ${variable} and restart the server: the adapter reads it once, when it loads.`
	);

/**
 * The refusal of the SELECTED tool's own captured override, or `undefined` when there is none to refuse.
 *
 * ⭑ ONLY THE SELECTED TOOL'S: the other adapter's program never runs a review, so its override refuses nothing — a
 * set `JPWB_AGY_BIN` does not refuse a devin review. ⭑ HONOURED IN TEST MODE, where an override is the tests' own.
 */
function selectedProgramOverridden(
	toolId: string,
	testMode: boolean,
	overrides: ReviewerProgramOverrides
): ReviewerSelection | undefined {
	if (testMode) return undefined;
	if (toolId === 'agy' && overrides.agy !== undefined)
		return programOverridden('agy', 'JPWB_AGY_BIN', overrides.agy);
	if (toolId === 'devin' && overrides.devin !== undefined)
		return programOverridden('devin', 'JPWB_DEVIN_BIN', overrides.devin);
	return undefined;
}

/**
 * Which reviewer runs.
 *
 * ⭑ THE TABLE (D2, D7):
 *   · tool UNSET (absent, `''` or whitespace) — test mode: the declared STAND-IN; outside it: REFUSED.
 *   · tool SET, in either mode — through `selectBackingTool(tool, 'ASSURANCE')`, whose refusal covers an unknown tool
 *     (`Devin` is unknown: the catalog matches ids exactly, after the trim); `pi`, which the catalog declares but no
 *     reviewer adapter is wired for, REFUSED as the executor refuses an unwired tool (`execution/model.ts`); agy with
 *     `JPWB_JUDGE_MODEL`, devin with `JPWB_ASSURANCE_MODEL`, each REFUSED while its model is unset.
 *   · ⭐ SR-2 (D7) — agy or devin OUTSIDE test mode, REFUSED when that tool's own program override was captured, even
 *     as `''`, before its model is asked about: the program is refused whatever model it would run. The OTHER tool's
 *     override refuses nothing (a set `JPWB_AGY_BIN` does not refuse a devin review), and in test mode both are
 *     honoured.
 *
 * ⛔ IT NEVER THROWS. Every misconfiguration is an answer, so a floor can RECORD it and a preflight can SHOW it — the
 * registry used to throw out of its own build when devin's model was unset (`REG-F-457` G3).
 */
export function selectReviewer(input: {
	readonly testMode: boolean;
	readonly env?: ReviewerEnvironment;
	/** What the adapters captured when they loaded, unless a test hands in its own — as it may the environment. */
	readonly overrides?: ReviewerProgramOverrides;
}): ReviewerSelection {
	const env = input.env ?? process.env;
	const toolId = resolveReviewerToolId(env.JPWB_ASSURANCE_TOOL);
	if (toolId === undefined)
		return input.testMode
			? { kind: 'STAND_IN' }
			: refused(
					'REVIEWER_TOOL_UNSET',
					undefined,
					'JPWB_ASSURANCE_TOOL is not set, and outside test mode no reviewer is chosen for this host: the tool ' +
						'that performs the mandatory Reasoning Review is configuration, and its absence is a refusal.'
				);
	try {
		selectBackingTool(toolId, 'ASSURANCE');
	} catch (e) {
		return refused(
			'REVIEWER_TOOL_UNKNOWN',
			toolId,
			`The reviewing tool '${toolId}' (JPWB_ASSURANCE_TOOL) is refused: ${e instanceof Error ? e.message : String(e)}`
		);
	}
	const overridden = selectedProgramOverridden(
		toolId,
		input.testMode,
		input.overrides ?? { agy: AGY_BIN_OVERRIDE, devin: DEVIN_BIN_OVERRIDE }
	);
	if (overridden) return overridden;
	// ⛔ `?? ''` MAKES THE ENVIRONMENT HANDED IN THE WHOLE INPUT. Both resolvers default their parameter to the PROCESS's
	// variable when given `undefined`, so an explicit environment naming a tool and no model used to take its model from
	// the process — a second read, which is how two answers come to disagree. `''` is unset to both, so it refuses.
	if (toolId === 'agy') {
		const modelId = resolveJudgeModel(env.JPWB_JUDGE_MODEL ?? '');
		return modelId
			? { kind: 'AGY', modelId }
			: refused(
					'REVIEWER_MODEL_UNSET',
					toolId,
					"The reviewing tool 'agy' has no model: JPWB_JUDGE_MODEL is not set, and there is no application " +
						'default — the model is configured, never pinned (REG-D-052).'
				);
	}
	if (toolId === 'devin') {
		const modelId = resolveAssuranceModel(env.JPWB_ASSURANCE_MODEL ?? '');
		return modelId
			? { kind: 'DEVIN', modelId }
			: refused(
					'REVIEWER_MODEL_UNSET',
					toolId,
					"The reviewing tool 'devin' has no model: JPWB_ASSURANCE_MODEL is not set, and there is no application " +
						'default — the model is configured, never pinned (REG-D-052).'
				);
	}
	return refused(
		'REVIEWER_TOOL_UNWIRED',
		toolId,
		`The reviewing tool '${toolId}' (JPWB_ASSURANCE_TOOL) declares the ASSURANCE role, but no reviewer adapter is ` +
			'wired for it on this host.'
	);
}

/** The whole refusal as one sentence pair — what a floor records and a preflight shows. */
export function refusalMessage(selection: Extract<ReviewerSelection, { kind: 'REFUSED' }>): string {
	return `${selection.reason} ${selection.guidance}`;
}
