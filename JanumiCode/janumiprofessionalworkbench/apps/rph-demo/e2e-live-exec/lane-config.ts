// ⭐ `JAN-SELREV` SR-3 (D9) — WHAT THE LIVE EXECUTION LANE REQUIRES AND HOW LONG IT WAITS, IN ONE PURE MODULE.
//
// `playwright.live-exec.config.ts` refuses to boot without the keys its tools read, and `execution.live.ts` compares
// the RECORDED reviewer with the model its tool was configured for. Both used to hold their own copy of which
// variable that is, and both copies said `JPWB_ASSURANCE_MODEL` for every tool — true of devin, false of agy, which
// reads `JPWB_JUDGE_MODEL` (`docs/_working/DESIGN-the-selected-reviewer.md` §2 G9; `REG-F-461`). Now they import this,
// and `verif/live-exec-lane-config.test.ts` holds it to the product's own answers.
//
// ⚠ PURE ON PURPOSE, WITH NO IMPORT AT ALL. Playwright loads the config in the runner's own process; importing the
// server's modules there would load the reviewer adapters, which capture their program overrides when they load. So
// the product's rules are RESTATED here and the verif test asks the product whether they still agree — the reviewer
// selector (`src/lib/server/assurance/reviewer-selection.ts`), the repair bound, and the two reviewer adapters.

/**
 * The reviewing tools this host has an adapter for, and the variable each reads its model from
 * (`reviewer-selection.ts`, `selectReviewer`).
 */
export const REVIEWER_MODEL_VARIABLE = {
	agy: 'JPWB_JUDGE_MODEL',
	devin: 'JPWB_ASSURANCE_MODEL'
} as const;

export type WiredReviewer = keyof typeof REVIEWER_MODEL_VARIABLE;
export type ReviewerModelVariable = (typeof REVIEWER_MODEL_VARIABLE)[WiredReviewer];

/**
 * The variable that replaces each wired tool's program: `JPWB_AGY_BIN` (`agy-cli.ts`, `AGY_BIN_OVERRIDE`) and
 * `JPWB_DEVIN_BIN` (`devin-reviewer.ts`, `DEVIN_BIN_OVERRIDE`). ⛔ Outside test mode the product refuses the SELECTED
 * tool's override whenever it is set, even to `''` (`reviewer-selection.ts`, `selectedProgramOverridden`; `REG-F-441`),
 * and this lane boots outside test mode (`RPH_DEMO_MODE=server`) with the shell's environment.
 */
export const REVIEWER_PROGRAM_VARIABLE = {
	agy: 'JPWB_AGY_BIN',
	devin: 'JPWB_DEVIN_BIN'
} as const satisfies Record<WiredReviewer, string>;

/**
 * The grade the reviewer's recorded model carries.
 *   · devin — `PROVIDER_REPORTED`: `devinPrint` reads the model that answered back out of devin's export
 *     (`readReportedModel`), and the review fails closed when it is not the configured one (`JAN-SELREV` D6).
 *   · agy — `HOST_CONFIGURED`: agy reports no model, so the record holds the one the host configured.
 * ⚠ devin's grade falls to `HOST_CONFIGURED` when its export names no model — and then D6 has nothing to compare.
 * The lane asserts the grade so that it would SAY so, rather than pass on a check that did not run.
 */
export const REVIEWER_IDENTITY_EVIDENCE = {
	agy: 'HOST_CONFIGURED',
	devin: 'PROVIDER_REPORTED'
} as const satisfies Record<WiredReviewer, string>;

/**
 * The reviewing tool as the product's selector reads `JPWB_ASSURANCE_TOOL`: trimmed, blank as unset, the id matched
 * exactly (`Devin` is not `devin`). `undefined` for a tool the product would refuse, or none.
 */
export function wiredReviewer(tool: string | undefined): WiredReviewer | undefined {
	const id = tool?.trim();
	return id === 'agy' || id === 'devin' ? id : undefined;
}

/** The variable the named tool reads its model from, or `undefined` when no wired tool is named. */
export function reviewerModelVariable(tool: string | undefined): ReviewerModelVariable | undefined {
	const reviewer = wiredReviewer(tool);
	return reviewer === undefined ? undefined : REVIEWER_MODEL_VARIABLE[reviewer];
}

/** What every run needs, whichever tool reviews: the producing tool and model, and the reviewing tool. */
const ALWAYS_REQUIRED = ['JPWB_EXECUTOR', 'JPWB_EXECUTOR_MODEL', 'JPWB_ASSURANCE_TOOL'] as const;

/**
 * Every key the lane requires for `tool`: the three it always needs, and the one variable that tool reads its model
 * from. ⚠ Never the other tool's: demanding `JPWB_ASSURANCE_MODEL` of an agy lane refused a key agy never reads.
 */
export function requiredLaneKeys(tool: string | undefined): readonly string[] {
	const model = reviewerModelVariable(tool);
	return model === undefined ? [...ALWAYS_REQUIRED] : [...ALWAYS_REQUIRED, model];
}

/**
 * Why the lane must not boot in `env`, or `undefined` when it may.
 *
 * ⭑ OPERATOR UX, NOT A SECOND POLICY. The server refuses an unconfigured reviewer by itself, before paid work
 * (`beginExecute`'s preflight) — but only after the lane has booted and driven a browser for a minute. So this names
 * everything wrong at once, up front. ⛔ It adds no rule the product lacks: an unknown tool is refused because the
 * product's selector refuses it, and a set program override for the selected tool because the product refuses that
 * outside test mode, where this lane runs.
 */
export function laneKeysRefusal(
	env: Readonly<Record<string, string | undefined>>
): string | undefined {
	const tool = env.JPWB_ASSURANCE_TOOL?.trim();
	const required = requiredLaneKeys(tool);
	const missing = required.filter((k) => !env[k]?.trim());
	const unwired = tool && wiredReviewer(tool) === undefined ? tool : undefined;
	const reviewer = wiredReviewer(tool);
	// ⭑ ONLY THE SELECTED TOOL'S, and SET means present, `''` included — the product's own rule: the other tool's
	// program never runs a review, and an empty override is an empty program name the adapter would try to run.
	const program = reviewer === undefined ? undefined : REVIEWER_PROGRAM_VARIABLE[reviewer];
	const overridden = program !== undefined && env[program] !== undefined ? program : undefined;
	if (missing.length === 0 && unwired === undefined && overridden === undefined) return undefined;
	return [
		'The live execution lane cannot start:',
		...(missing.length > 0
			? [
					`  · it is missing ${missing.length} of the ${required.length} keys it needs: ${missing.join(', ')}.`
				]
			: []),
		...(unwired !== undefined
			? [
					`  · JPWB_ASSURANCE_TOOL='${unwired}' names no reviewer this host has an adapter for. The id is ` +
						'matched exactly, after trimming, and the product refuses any other.'
				]
			: []),
		...(overridden !== undefined
			? [
					`  · ${overridden}=${JSON.stringify(env[overridden])} replaces the ${String(reviewer)} program. This lane ` +
						'runs outside test mode, where the product refuses a program override for the selected reviewer, ' +
						'even an empty one (REG-F-441). Unset it.'
				]
			: []),
		'The keys:',
		'  JPWB_EXECUTOR / JPWB_EXECUTOR_MODEL — the tool and model that PRODUCE the work product',
		'  JPWB_ASSURANCE_TOOL — the tool that REVIEWS it, with the model that tool reads:',
		'    devin — JPWB_ASSURANCE_MODEL (`devin models list` shows what the account offers)',
		'    agy   — JPWB_JUDGE_MODEL (a label the installed agy recognises: agy rejects an unknown one, and its error ' +
			'output lists the labels it knows — REG-F-331)',
		'  and, for the reviewing tool, no program override (JPWB_DEVIN_BIN, JPWB_AGY_BIN).',
		'The selected reviewer (REG-D-084) is JPWB_ASSURANCE_TOOL=devin with JPWB_ASSURANCE_MODEL=glm-5-3-flash-max: ' +
			'configuration you set, not a default (REG-D-052).',
		'⚠ The producing and reviewing models must DIFFER, or the reasoning review is refused for non-independence ' +
			'(ASR-13) — which is the check working, not a fault.'
	].join('\n');
}

/**
 * ⭐ THE WAIT, FROM THE REVIEWER'S BOUND. The spec's one "Begin & Execute" POST runs the whole repair loop before it
 * answers: each try is one executor call and one work-product review, and each review is at most two reviewer calls.
 *   · `tries` — the loop's repair bound (`DEFAULT_REPAIR_BOUND`, `src/lib/server/execution/loop-detection.ts`).
 *   · `reviewerCallMs` — the `timeout` both reviewer adapters hand their program (`agyPrint`, `devinPrint`).
 *   · `reviewerCallsPerTry` — the initial call and one repair (`reasoning-review-validator.ts`, `evaluate`), which the
 *     verif test measures by driving the validator with a reviewer that never answers in JSON.
 *   · `executorCallMs` — ⚠ AN ALLOWANCE, NOT A BOUND. The Pi executor adapter (`src/lib/server/tools/pi-executor.ts`)
 *     sets no time limit on its model turn — only each command it runs is bounded, at 120 s
 *     (`execution-tool-surface.ts`) — so each try's executor call is given the 240 s agy's adapter bounds itself to.
 *   · `setupMs` — authoring, publishing and instantiating before the POST: the 120 s the lane already allowed.
 * ⚠ NOT COVERED: a review of each command the executor ran (`evidence-join.ts`, `runProcessResultFloor`). The prompt
 * the spec sends asks for a JSON answer only, and how many commands a model runs anyway is not bounded here.
 */
export const LANE_BUDGET = Object.freeze({
	tries: 3,
	reviewerCallMs: 240_000,
	reviewerCallsPerTry: 2,
	executorCallMs: 240_000,
	setupMs: 120_000
});

/** How long the spec waits for "Begin & Execute" to answer: 3 × (240 s + 2 × 240 s) = 2,160 s (36 minutes). */
export const EXECUTE_TIMEOUT_MS =
	LANE_BUDGET.tries *
	(LANE_BUDGET.executorCallMs + LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs);

/** The lane's per-test timeout: the POST's wait plus the setup before it — 2,280 s (38 minutes). */
export const TEST_TIMEOUT_MS = EXECUTE_TIMEOUT_MS + LANE_BUDGET.setupMs;
