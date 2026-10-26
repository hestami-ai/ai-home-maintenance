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
// ⭐ `JAN-SELRES` RS-1 (D5) — AND THE EXECUTOR SELECTOR (`src/lib/server/execution/executor-selection.ts`), whose rules
// are restated the same way, beside ONE rule that is this lane's own and says so: no agy executor.

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

/**
 * ⭐ `JAN-SELRES` RS-1 (D5) — the executing tools this host has an executor adapter for (`executor-selection.ts`,
 * `WIRED_EXECUTORS`). ⚠ `devin` declares EXECUTION in the catalog and has no executor adapter, so the product refuses it.
 */
export const WIRED_EXECUTORS = ['agy', 'pi'] as const;

export type WiredExecutor = (typeof WIRED_EXECUTORS)[number];

/**
 * The executing tool as the product's selector reads `JPWB_EXECUTOR`: trimmed, blank as unset, the id matched exactly
 * (`Agy` is not `agy`). `undefined` for a tool the product would refuse, or none.
 */
export function wiredExecutor(tool: string | undefined): WiredExecutor | undefined {
	const executorId = tool?.trim();
	return WIRED_EXECUTORS.find((w) => w === executorId);
}

/**
 * The variable that replaces each wired executor's program — agy's, the same variable the agy reviewer reads, because
 * it is the same adapter's one capture (`agy-cli.ts`, `AGY_BIN_OVERRIDE`). Pi has none: it runs in-process. ⛔ Outside
 * test mode the product refuses the SELECTED executor's override whenever it is set, even to `''` (`REG-F-459`).
 */
export const EXECUTOR_PROGRAM_VARIABLE: Readonly<Partial<Record<WiredExecutor, string>>> = {
	agy: REVIEWER_PROGRAM_VARIABLE.agy
};

/**
 * ⭐ `JAN-SELRES` RS-1 (D5) — WHY THE LANE REFUSES THE EXECUTOR in `env`, one line per fault, beyond a missing key.
 *
 * ⭑ THE PRODUCT'S RULES, RESTATED — a tool the product's selector would not run (unknown, or unwired), and outside
 * test mode, where this lane runs, a set program override for the selected executor. An unset tool or model is the
 * `missing` line's, not this one's.
 *
 * ⛔ AND ONE RULE OF THE LANE'S OWN, LABELLED AS SUCH: no agy executor. The product runs one; this lane's spec cannot
 * pass with one — it asserts the producer's identity is `PROVIDER_REPORTED` (`execution.live.ts`), and agy reports no
 * model, so its record is `HOST_CONFIGURED` by design. An agy lane would boot and spend up to the whole Begin & Execute
 * wait failing there, so it is refused at boot, and the refusal says whose rule it is.
 */
function executorLaneFaults(env: Readonly<Record<string, string | undefined>>): string[] {
	const executorTool = env.JPWB_EXECUTOR?.trim();
	const executorId = wiredExecutor(executorTool);
	const strayExecutor = executorTool && executorId === undefined ? executorTool : undefined;
	const replacesExecutor =
		executorId === undefined ? undefined : EXECUTOR_PROGRAM_VARIABLE[executorId];
	const executorReplaced =
		replacesExecutor !== undefined && env[replacesExecutor] !== undefined
			? replacesExecutor
			: undefined;
	return [
		...(strayExecutor !== undefined
			? [
					`  · JPWB_EXECUTOR='${strayExecutor}' names no executor this host has an adapter for (${WIRED_EXECUTORS.join(', ')}). ` +
						'The id is matched exactly, after trimming, and the product refuses any other.'
				]
			: []),
		...(executorReplaced !== undefined
			? [
					`  · ${executorReplaced}=${JSON.stringify(env[executorReplaced])} replaces the ${String(executorId)} executor's ` +
						'program. This lane runs outside test mode, where the product refuses a program override for the ' +
						'selected executor, even an empty one (REG-F-459). Unset it.'
				]
			: []),
		...(executorId === 'agy'
			? [
					"  · JPWB_EXECUTOR='agy' is refused by a rule of THIS LANE, not of the product: the lane's spec asserts " +
						'that the producing tool reports its own model (PROVIDER_REPORTED, e2e-live-exec/execution.live.ts), ' +
						'and agy reports none — its record is HOST_CONFIGURED by design. The product runs an agy executor; ' +
						'this lane cannot pass with one. Use JPWB_EXECUTOR=pi.'
				]
			: [])
	];
}

/**
 * ⭐ `JAN-EXEC` Phase 7 `P7-2` (D3) — TWO VARIABLES THE SERVER READS AT CALL TIME, each with why. The config passes the
 * operator's whole shell to the server, and each of these changes a run with nothing recording it (`REG-F-531`), so the
 * lane boots with neither: refused here, before the server starts, by a rule of THIS LANE — the product reads both.
 */
const READ_AT_CALL_TIME = {
	JPWB_REVIEW_SEES_PRIOR:
		'the server reads it at every review it runs (`reviewSeesPriorFindings`, src/lib/server/execution/loop-detection.ts), ' +
		"and '1' or 'true' hands the reviewer its own earlier findings",
	JPWB_AGENT:
		'the server reads it whenever the authoring agent is asked for a turn (`agentMode`, src/lib/server/workbench.ts), ' +
		"and 'pi' or 'mock' chooses that agent over the mode's default"
} as const;

/**
 * ⭐ `P7-2` (D3) — one line for each of `READ_AT_CALL_TIME` that `env` sets. ⚠ SET MEANS A VALUE, after trimming: the
 * server reads `''` and `'   '` as unset too, so refusing them would refuse a shell that changes nothing. Any other value
 * is refused, not only the ones the server acts on — the run is measured with both unset (design §6 P7-2 D3).
 */
function readAtCallTimeFaults(env: Readonly<Record<string, string | undefined>>): string[] {
	return Object.entries(READ_AT_CALL_TIME).flatMap(([name, why]) =>
		env[name]?.trim()
			? [
					`  · ${name}=${JSON.stringify(env[name])} is refused by a rule of THIS LANE, not of the product: ${why}, ` +
						'which changes the run with nothing recording it (REG-F-531). The run is measured with it unset ' +
						'(design §6 P7-2 D3). Unset it.'
				]
			: []
	);
}

/**
 * ⭐ `P7-2` (D1) — A REQUEST FOR THE PHASE 7 RUN WITH NO RUN FOLDER, one line for each Phase 7 variable `env` sets while
 * `JPWB_LIVE_RUN_DIR` is unset. The config then collects the one-unit spec, `execution.live.ts`, which calls its models
 * whatever these say — so a run folder that never reached the process (misspelt, or set where the runner did not inherit
 * it) would turn a request for Phase 7 into a paid run nobody asked for, its calls in no count of the limit (D8). ⚠ UNSET
 * AS THE CONFIG READS IT: an empty run folder collects `phase7.live.ts`, which the run-folder check then refuses
 * (`run-folder.ts`, `liveExecTestMatch`). A rule of THIS LANE, labelled as such.
 */
function phase7RequestFaults(env: Readonly<Record<string, string | undefined>>): string[] {
	if (env[LIVE_RUN_DIR_VARIABLE] !== undefined) return [];
	// ⭐ E3 (C1) — and the half: `JPWB_PHASE7_HALF` asks for the Phase 7 run as surely as the two before it.
	return [PHASE7_PAID_VARIABLE, PHASE7_PRIOR_CALLS_VARIABLE, PHASE7_HALF_VARIABLE].flatMap((variable) =>
		env[variable]?.trim()
			? [
					`  · ${variable}=${JSON.stringify(env[variable])} is refused by a rule of THIS LANE, not of the product: it ` +
						`asks for the Phase 7 run, but ${LIVE_RUN_DIR_VARIABLE} is unset, so the config would collect the ` +
						'one-unit spec (e2e-live-exec/execution.live.ts), which calls its models whatever this says: a paid run ' +
						'nobody asked for, its record under the temporary folder (REG-F-526) and its reviewer calls in no count ' +
						`of the limit (D8). Set ${LIVE_RUN_DIR_VARIABLE} to the run folder (design §6 P7-2 D1, D2), or unset ` +
						`${variable} to run the one-unit lane.`
				]
			: []
	);
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
 * outside test mode, where this lane runs. ⭐ `JAN-SELRES` RS-1 (D5) — the same holds for the EXECUTOR, with ONE
 * exception, which is the lane's own and is labelled as such where it is refused: no agy executor
 * (`executorLaneFaults`). ⭐ `JAN-EXEC` Phase 7 `P7-2` (D3) — and two more of the lane's own, labelled the same way: a set
 * `JPWB_REVIEW_SEES_PRIOR` or `JPWB_AGENT` (`readAtCallTimeFaults`). ⭐ (D1) — and a Phase 7 variable set with no run
 * folder (`phase7RequestFaults`). ⭐ E3 (C1, C3) — and the half: one this lane does not know, or half B with no author's
 * model (`halfFaults`).
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
	// ⭐ `JAN-SELRES` RS-1 (D5) — THE EXECUTOR LIMB: the product's executor rules restated, and the lane's own.
	const executorFaults = executorLaneFaults(env);
	// ⭐ `JAN-EXEC` Phase 7 `P7-2` (D3) — THE VARIABLES THE SERVER READS AT CALL TIME: the lane's own rule.
	const callTimeFaults = readAtCallTimeFaults(env);
	// ⭐ `P7-2` (D1) — A PHASE 7 REQUEST THE CONFIG WOULD RUN AS THE ONE-UNIT SPEC: the lane's own rule.
	const requestFaults = phase7RequestFaults(env);
	// ⭐ E3 (C1, C3) — THE HALF, AND HALF B'S AUTHOR: the lane's own rule.
	const halfLaneFaults = halfFaults(env);
	if (
		missing.length === 0 &&
		unwired === undefined &&
		overridden === undefined &&
		executorFaults.length === 0 &&
		callTimeFaults.length === 0 &&
		requestFaults.length === 0 &&
		halfLaneFaults.length === 0
	)
		return undefined;
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
		...executorFaults,
		...callTimeFaults,
		...requestFaults,
		...halfLaneFaults,
		'The keys:',
		'  JPWB_EXECUTOR / JPWB_EXECUTOR_MODEL — the tool and model that PRODUCE the work product: pi, with a model Pi ' +
			'resolves (this lane refuses agy; devin has no executor adapter), and no program override for it',
		'  JPWB_ASSURANCE_TOOL — the tool that REVIEWS it, with the model that tool reads:',
		'    devin — JPWB_ASSURANCE_MODEL (`devin models list` shows what the account offers)',
		'    agy   — JPWB_JUDGE_MODEL (a label the installed agy recognises: agy rejects an unknown one, and its error ' +
			'output lists the labels it knows — REG-F-331)',
		'  and, for the reviewing tool, no program override (JPWB_DEVIN_BIN, JPWB_AGY_BIN).',
		'The selected reviewer (REG-D-119) is JPWB_ASSURANCE_TOOL=devin with JPWB_ASSURANCE_MODEL=glm-5-3-flash-high: ' +
			'configuration you set, not a default (REG-D-052).',
		'⚠ The producing and reviewing models must DIFFER, or the reasoning review is refused for non-independence ' +
			'(ASR-13) — which is the check working, not a fault.'
	].join('\n');
}

/**
 * ⭐ THE WAIT, FROM THE REVIEWER'S BOUND. The spec's one "Begin & Execute" POST runs the whole repair loop before it
 * answers: each try is one executor call and one work-product review, and each review is at most ~~two~~ ~~⭐ four~~ ⭐ six
 * reviewer calls (package L, D13).
 *   · `tries` — the loop's repair bound (`DEFAULT_REPAIR_BOUND`, `src/lib/server/execution/loop-detection.ts`).
 *   · `reviewerCallMs` — the `timeout` both reviewer adapters hand their program (`agyPrint`, `devinPrint`).
 *   · `reviewerCallsPerTry` — the initial call and one repair (`reasoning-review-validator.ts`, `evaluate`), ~~which the
 *     verif test measures by driving the validator with a reviewer that never answers in JSON~~ ⭐ each of them run once
 *     more when it throws short of its tool's bound (`JAN-EXEC` Phase 7 `P7-2b`, `REG-D-102` (2); the validator's
 *     `timed`): 2 × 2 = 4. The verif test measures it by driving the product's devin branch with a program that throws
 *     before each answer and never answers in JSON. ⚠ A call run again after a throw can take its whole bound once more,
 *     so four bounds, not two, are what a review may cost.
 *     ⭐⭐ `JAN-EXEC` Phase 7, package L — D13 (`REG-D-135` (3); design D13): ~~2 × 2 = 4~~ — THE INITIAL CALL, THE JSON REPAIR
 *     AND THE CRITERION REPAIR, each run once more when it throws short of its tool's bound: 3 × 2 = 6. The sponsor ruled the
 *     criterion repair after ANY parsed reply, the JSON repair's included (Q43), so a review makes at most one JSON repair and
 *     one criterion repair. The verif test measures six by driving the product's devin branch with a program that throws before
 *     each answer, answers once in no JSON, then twice with a criterion's row under an id the policy does not declare.
 *   · `executorCallMs` — ⚠ AN ALLOWANCE, NOT A BOUND. The Pi executor adapter (`src/lib/server/tools/pi-executor.ts`)
 *     sets no time limit on its model turn — only each command it runs is bounded, at 120 s
 *     (`execution-tool-surface.ts`) — so each try's executor call is given the 240 s agy's adapter bounds itself to.
 *   · `setupMs` — authoring, publishing and instantiating before the POST: the 120 s the lane already allowed.
 * ⚠ NOT COVERED: a review of each command the executor ran (`evidence-join.ts`, `runProcessResultFloor`). The prompt
 * the spec sends asks for a JSON answer only, and how many commands a model runs anyway is not bounded here.
 * ⭐ `JAN-EXEC` Phase 7 `P7-2` (D4) — the Phase 7 lane's allowance covers them, derived from this budget (below).
 */
export const LANE_BUDGET = Object.freeze({
	tries: 3,
	reviewerCallMs: 240_000,
	// ⭐ Package L — D13 (`REG-D-135` (3)): ~~4~~ — the initial call, the JSON repair and the criterion repair, each once more
	// after a throw: 3 × 2 = 6.
	reviewerCallsPerTry: 6,
	executorCallMs: 240_000,
	setupMs: 120_000
});

/**
 * How long the spec waits for "Begin & Execute" to answer: ~~3 × (240 s + 2 × 240 s) = 2,160 s (36 minutes)~~ ~~⭐ `P7-2b`:
 * 3 × (240 s + 4 × 240 s) = 3,600 s (60 minutes)~~ ⭐ package L, D13: 3 × (240 s + 6 × 240 s) = 5,040 s (84 minutes).
 */
export const EXECUTE_TIMEOUT_MS =
	LANE_BUDGET.tries *
	(LANE_BUDGET.executorCallMs + LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs);

/** The lane's per-test timeout: the POST's wait plus the setup before it — ~~2,280 s (38 minutes)~~ ~~⭐ 3,720 s (62 minutes)~~
 *  ⭐ package L, D13: 5,160 s (86 minutes). */
export const TEST_TIMEOUT_MS = EXECUTE_TIMEOUT_MS + LANE_BUDGET.setupMs;

// ── ⭐ `JAN-EXEC` Phase 7 `P7-2` (D4, D8) — THE PHASE 7 LANE'S WAIT AND LIMIT ──────────────────────────────────────────
// `phase7.live.ts` runs five units in ONE test: the root, which runs no model, then the four model phases, each started
// only after the one before has answered (`REG-F-535`). A phase's Begin & Execute runs what the one-unit lane's does and
// then the review of each command it ran, which that lane leaves out (`LANE_BUDGET`'s NOT COVERED): so a phase is given
// the one-unit wait, a review of up to `reviewerCallsPerTry` calls for each command reviewed, and each such command's
// own deadline (design §6 P7-2 D4; `docs/_working/DESIGN-the-live-end-to-end-run.md`).
// ⚠ AN ALLOWANCE, NOT A WORST CASE (the design's struck wording): the executor's turn has no bound (`executorCallMs`
// above), and the commands past the 32nd still run, each up to its deadline, counted nowhere (`REG-F-521`, `REG-F-517`).
// ⛔ DERIVED BY REFERENCE, NEVER RESTATED: a copy of the budget's figures here would part from the one-unit lane's the day
// either moved, and would give each of their ledger anchors a second home.

/**
 * How many of a phase's commands become evidence and are reviewed: the product's `OBSERVED_PROCESS_RUN_LIMIT`
 * (`src/lib/server/tools/process-run-observer.ts`), restated because this module imports nothing, and held to it by
 * `verif/live-exec-lane-config.test.ts`.
 */
export const PHASE7_REVIEWED_COMMANDS = 32;

/**
 * The deadline the product hands the runner for each command a model chooses: `EXECUTION_COMMAND_TIMEOUT_MS`
 * (`src/lib/server/tools/execution-tool-surface.ts`), private there, so held through the mirror
 * `scripts/phase7/runner-environment.ts` keeps of it.
 */
export const PHASE7_COMMAND_MS = 120_000;

/**
 * ⭐ ONE PHASE'S ALLOWANCE: the Begin & Execute wait, 32 command reviews of up to ~~four~~ ⭐ six (package L, D13) calls of
 * 240 s, and 32 commands of 120 s — ~~3,600 s + 30,720 s + 3,840 s = 38,160 s (10.6 hours)~~ ⭐ 5,040 s + 46,080 s + 3,840 s =
 * 54,960 s (15.3 hours). D4 rules that a phase which outlasts it ends the run there, so the next is never started beside it
 * (`REG-F-535`, `REG-F-527`).
 */
export const PHASE7_UNIT_ALLOWANCE_MS =
	EXECUTE_TIMEOUT_MS +
	PHASE7_REVIEWED_COMMANDS * (LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs) +
	PHASE7_REVIEWED_COMMANDS * PHASE7_COMMAND_MS;

/** The phases a model runs: §3.2's four (`scripts/phase7/pwa-content.ts`, `PHASE7_PHASES`). The root runs none. */
export const PHASE7_MODEL_UNITS = 4;

/**
 * The boot's readiness calls, typing and publishing the PWA, creating the Undertaking, and every archive's copying: an
 * allowance — acts this module cannot count one by one. ⭐ `P76F-C` C8: ~~the root's run, five sign-offs~~ — those are each
 * bounded by a figure of their own, and are counted below by it (`PHASE7_TEST_TIMEOUT_MS`).
 * ⚠⚠ `P76F-D` D4 — AN ALLOWANCE, NOT A WORST CASE, AND SMALLER THAN ITS OWN ACTS' BOUNDS: two readiness calls at 120 s
 * (`phase7-operator.ts`, `READINESS_CALL_MS`), two reads of the store at 300 s (`freshIntrospect`), a screenshot at 120 s,
 * and every fill, click and navigation of the designer and the Undertaking form at the page's 120 s default — dozens,
 * as many as §3.2's PWA makes `e2e/support/phase7-pwa.ts` type — pass 1,800 s at their bounds, and the archive's copying
 * has no bound at all. ⛔ NOT COUNTED BY THEIR BOUNDS, AND IT CANNOT BE FROM HERE: the number of form acts is that support
 * module's control flow over the PWA's content (a fill per field set, a check per child and per policy), which this
 * module, importing nothing, could only restate as a guess; and a copy with no bound has no bound to count.
 */
export const PHASE7_SETUP_MS = 1_800_000;

/**
 * ⭐ `JAN-EXEC` P7-6 B4 — THE RE-RUNS THE RUN PLAN'S RULE MAKES OF ONE STOPPED PHASE: at most ONE (`REG-D-105` (4): *"A
 * review that did not conclude is re-run once; refused work is re-run once"*), each waited for up to one phase's allowance
 * (`phase7-operator.ts` `recover`). ⚠ The abandonment that may follow calls no model, and is bounded as a sign-off act is,
 * ~~within the setup's allowance as the sign-offs are~~ ⛔ `P76F-D` D4: struck — since `P76F-C` C8 each is counted by its
 * own acts' bounds, the abandonment in `PHASE7_RECOVERY_MS` and the sign-offs in `PHASE7_SIGN_OFF_UNIT_MS`.
 */
export const PHASE7_RERUNS_PER_PHASE = 1;

// ── ⭐⭐ `P76F-C` C8 — THE BOUNDS OF THE LANE'S OWN ACTS, HERE SO THE SPEC'S TIMEOUT READS EACH BY REFERENCE ────────────────
// ⛔ They lived in `phase7-operator.ts`, which imports this module, so the timeout below could not count them: the five
// sign-offs' own bounds alone (5 × 2 × 300 s = 3,000 s) exceeded the 1,800 s setup allowance they were said to fit in,
// and the four abandonments (4 × 300 s) and the rule's fills, clicks and page loads were counted nowhere. The operator
// re-exports each, so every act still names the bound it waits.

/** A click, a fill, a navigation — no model behind any. The spec makes it the page's default, so no act waits unbounded. */
export const PHASE7_UI_MS = 120_000;
/**
 * A sign-off act's POST — ⭐ and an abandonment's: it calls no model, and the page then loads the whole event log again.
 * ⭐ `E12F` F1 — Mark Satisfied's: since E2 Record Assurance asks the reviewer, and waits `PHASE7_RECORD_ASSURANCE_MS`.
 */
export const PHASE7_SIGN_OFF_MS = 300_000;
/** One read of the server's dump, which carries the whole event log (`freshIntrospect`). */
export const PHASE7_INTROSPECT_MS = 300_000;

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (`DESIGN-phase-7-completion.md` B1, B8; `REG-D-110` (3): one review per declared
 * policy) — THE MOST DECLARED POLICIES ONE UNIT OF §3.2 CARRIES: the design phase's four (`scripts/phase7/pwa-content.ts`,
 * `PHASE7_DESIGN`). Restated, because this module imports nothing, and held to §3.2's PWA by
 * `verif/live-exec-lane-config.test.ts`. ⚠ A unit carrying fewer is bounded as one carrying four: an upper bound.
 */
export const PHASE7_DECLARED_POLICIES_PER_UNIT = 4;

/**
 * ⭐⭐ E2 — A UNIT'S DECLARED REVIEWS, AT THEIR BOUND: Record Assurance runs one review per declared policy, one after
 * another, each the reasoning-review validator's own call, retry and repair — up to `reviewerCallsPerTry` calls of
 * `reviewerCallMs` (`LANE_BUDGET`, by reference) — ~~4 × 4 × 240 s = 3,840 s~~ ⭐ package L, D13: 4 × 6 × 240 s = 5,760 s.
 */
export const PHASE7_DECLARED_REVIEWS_MS =
	PHASE7_DECLARED_POLICIES_PER_UNIT * LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs;

/**
 * ⭐⭐ E2 (design B8: *"The sign-off's time bound grows to cover the reviews"*) — RECORD ASSURANCE'S OWN BOUND: the act's
 * (`PHASE7_SIGN_OFF_MS`) and its declared reviews — ~~300 s + 3,840 s = 4,140 s~~ ⭐ package L, D13: 300 s + 5,760 s =
 * 6,060 s. ⛔ Before E2 it called no model and was
 * bounded as a sign-off act, so a sign-off whose reviews each stayed inside their bound would have been abandoned at 300 s.
 * Mark Satisfied and an abandonment call no model, and keep `PHASE7_SIGN_OFF_MS`.
 */
export const PHASE7_RECORD_ASSURANCE_MS = PHASE7_SIGN_OFF_MS + PHASE7_DECLARED_REVIEWS_MS;

/**
 * ⭐ `P76F-C` C8 — THE OVERVIEW SHOWN AFRESH (the spec's `showOverview`): the page's navigation and its hydration wait, each
 * bounded by the page's default, and the tab's click by its own — 3 × 120 s = 360 s.
 */
export const PHASE7_SHOW_OVERVIEW_MS = 3 * PHASE7_UI_MS;

/**
 * ⭐ `P76F-C` C8 — ONE BEGIN & EXECUTE AND WHAT THE LANE DOES AFTER IT (`runTheLane`, `run`): the press, waited for up to one
 * phase's allowance; the overview shown afresh after an envelope that leaves the page; the store read; the screenshot —
 * ~~38,160 s + 360 s + 300 s + 120 s = 38,940 s~~ ⭐ package L, D13: 54,960 s + 360 s + 300 s + 120 s = 55,740 s. ⚠ The
 * archive's copying is the setup allowance's.
 */
export const PHASE7_UNIT_RUN_MS =
	PHASE7_UNIT_ALLOWANCE_MS + PHASE7_SHOW_OVERVIEW_MS + PHASE7_INTROSPECT_MS + PHASE7_UI_MS;

/**
 * ⭐ `P76F-C` C8 — THE RUN PLAN'S RULE ON ONE STOPPED PHASE, EVERY ACT AT ITS BOUND (`recoverByRule`, `recoveryAct`):
 *   · the re-run: the overview shown, the row's offers waited for, the store read for the limit, the rationale filled,
 *     the press waited for up to one phase's allowance (⭐ the RE-RUN's allowance, `REG-D-105` (4)), the overview shown
 *     again after an envelope that leaves the page, the store read — 360 + 120 + 300 + 120 + ~~38,160~~ ⭐ 54,960 (package
 *     L, D13) + 360 + 300 = ~~39,720 s~~ ⭐ 56,520 s;
 *   · the abandonment of a re-run refused again: the overview shown, the row's offers, the rationale filled, the press
 *     (a sign-off act's bound), the overview again, the store read — 360 + 120 + 120 + 300 + 360 + 300 = 1,560 s;
 * together ~~41,280 s~~ ⭐ 58,080 s.
 */
export const PHASE7_RECOVERY_MS =
	PHASE7_SHOW_OVERVIEW_MS +
	PHASE7_UI_MS +
	PHASE7_INTROSPECT_MS +
	PHASE7_UI_MS +
	PHASE7_UNIT_ALLOWANCE_MS +
	PHASE7_SHOW_OVERVIEW_MS +
	PHASE7_INTROSPECT_MS +
	(PHASE7_SHOW_OVERVIEW_MS +
		PHASE7_UI_MS +
		PHASE7_UI_MS +
		PHASE7_SIGN_OFF_MS +
		PHASE7_SHOW_OVERVIEW_MS +
		PHASE7_INTROSPECT_MS);

/** ⭐ `P76F-C` C8 — the units the lane presses Begin & Execute on, and signs off: the root, and the four phases. */
export const PHASE7_PRESSED_UNITS = PHASE7_MODEL_UNITS + 1;

/** A sign-off's two acts: Record Assurance, then Mark Satisfied (`signOff`). */
export const PHASE7_SIGN_OFF_ACTS = 2;

/**
 * ⭐⭐ `E12F` F3 (`REG-D-105` (4), applied by `REG-D-112` (a)) — THE RULE'S ONE RE-RUN OF A UNIT'S DECLARED REVIEWS THAT DID
 * NOT CONCLUDE, EVERY ACT AT ITS BOUND (`signOff`): the overview shown afresh after the refused Record Assurance, the row's
 * offer read, the store read for the limit, the rationale filled, the press — its act and a review of each declared policy,
 * as Record Assurance's (`PHASE7_RECORD_ASSURANCE_MS`) — and the store read after: 360 + 120 + 300 + 120 + ~~4,140~~ ⭐ 6,060
 * (package L, D13) + 300 = ~~5,340 s~~ ⭐ 7,260 s. ⛔ A paid act: counted, or the timeout could kill the server inside its
 * bound (`REG-F-527`; E12-M27's class).
 */
export const PHASE7_DECLARED_RERUN_MS =
	PHASE7_SHOW_OVERVIEW_MS +
	PHASE7_UI_MS +
	PHASE7_INTROSPECT_MS +
	PHASE7_UI_MS +
	PHASE7_RECORD_ASSURANCE_MS +
	PHASE7_INTROSPECT_MS;

/**
 * ⭐ `P76F-C` C8 — ONE UNIT'S SIGN-OFF, EVERY ACT AT ITS BOUND (`signOff`): the overview shown; then each of its two acts —
 * the row's wait (its row visible, or Record Assurance detached), the press, the store read after — 360 s + 2 × (120 s +
 * 300 s + 300 s) = 1,800 s; ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B8) — and Record Assurance's declared reviews
 * (`PHASE7_DECLARED_REVIEWS_MS`, 3,840 s), which its press now waits for: 5,640 s. ~~= 1,800 s~~ ⭐⭐ `E12F` F2, F3 — and the
 * store read for the limit before Record Assurance (300 s), and the rule's one re-run of the declared reviews that did not
 * conclude (`PHASE7_DECLARED_RERUN_MS`, 5,340 s): 11,280 s. ~~= 5,640 s~~ ⭐ package L, D13 — each review six calls, so the
 * declared reviews 5,760 s and their re-run 7,260 s: 360 + 1,440 + 5,760 + 300 + 7,260 = 15,120 s. ~~= 11,280 s~~
 */
export const PHASE7_SIGN_OFF_UNIT_MS =
	PHASE7_SHOW_OVERVIEW_MS +
	PHASE7_SIGN_OFF_ACTS * (PHASE7_UI_MS + PHASE7_SIGN_OFF_MS + PHASE7_INTROSPECT_MS) +
	PHASE7_DECLARED_REVIEWS_MS +
	PHASE7_INTROSPECT_MS +
	PHASE7_DECLARED_RERUN_MS;

// ── ⭐⭐ HALF B'S SIGN-OFF BOUNDS, FROM THE POLICIES A UNIT DECLARES AS THE STORE HOLDS THEM (the lead's delegated decision of
// 2026-10-16, registered as REG-D-114 (15)) ─────────────────────────────────────────────────────────────────────────────
// The four figures above are §3.2's: every unit bounded as one declaring four policies, the most any of its units declares
// (`PHASE7_DECLARED_POLICIES_PER_UNIT`) — half A's, unchanged. Half B's units are the agent's, and one may declare more:
// bounded as four, its Record Assurance could be abandoned with a review still inside its own bound. So for half B each of
// them is taken for the unit's own count, read from the store as the limit reads it (`declaredPolicyIdsOf`,
// `phase7-operator.ts`): the arithmetic above, `policies` in place of four, which `verif/live-exec-lane-config.test.ts`
// holds equal to the figure above at four.

/** A unit's declared reviews at their bound, for `policies` declared policies: `PHASE7_DECLARED_REVIEWS_MS`'s arithmetic. */
export function phase7DeclaredReviewsMs(policies: number): number {
	return policies * LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs;
}

/** Record Assurance's bound for a unit declaring `policies`: its act's and its reviews', as `PHASE7_RECORD_ASSURANCE_MS`. */
export function phase7RecordAssuranceMs(policies: number): number {
	return PHASE7_SIGN_OFF_MS + phase7DeclaredReviewsMs(policies);
}

/** The rule's one re-run of the declared reviews, every act at its bound, for `policies`: as `PHASE7_DECLARED_RERUN_MS`. */
export function phase7DeclaredRerunMs(policies: number): number {
	return (
		PHASE7_SHOW_OVERVIEW_MS +
		PHASE7_UI_MS +
		PHASE7_INTROSPECT_MS +
		PHASE7_UI_MS +
		phase7RecordAssuranceMs(policies) +
		PHASE7_INTROSPECT_MS
	);
}

/** One unit's sign-off, every act at its bound, for `policies`: as `PHASE7_SIGN_OFF_UNIT_MS`. */
export function phase7SignOffUnitMs(policies: number): number {
	return (
		PHASE7_SHOW_OVERVIEW_MS +
		PHASE7_SIGN_OFF_ACTS * (PHASE7_UI_MS + PHASE7_SIGN_OFF_MS + PHASE7_INTROSPECT_MS) +
		phase7DeclaredReviewsMs(policies) +
		PHASE7_INTROSPECT_MS +
		phase7DeclaredRerunMs(policies)
	);
}

/**
 * The spec's own timeout, set with `test.setTimeout` (the config's stays the one-unit lane's) — ⭐⭐ `P76F-C` C8: ~~THE WORST
 * CASE OF THE LANE'S OWN BOUNDS, every act waited for up to its bound and counted by it~~ ⛔ `P76F-D` D4: overstated — the
 * setup's acts are not counted by their bounds, and those bounds alone pass its allowance (`PHASE7_SETUP_MS`). What is
 * true: EVERY PHASE AND RECOVERY ACT COUNTED BY ITS BOUND — each Begin & Execute and what follows it, the limit's reads,
 * the run plan's rule, the sign-offs, the final screenshot and read — PLUS THE SETUP'S ALLOWANCE, which is not a worst
 * case:
 *   · the setup allowance (boot, the PWA, the Undertaking, every archive's copying) — 1,800 s, ⚠ an allowance: its own
 *     acts at their bounds pass it, and the archive's copying has none;
 *   · the root's Begin & Execute and each phase's, each with what follows it (`PHASE7_UNIT_RUN_MS`) — 5 × 38,940 s =
 *     194,700 s, ⭐ the root's included: its press is bounded by a phase's allowance too (`beginExecute`);
 *   · the store read for the limit before each phase — 4 × 300 s = 1,200 s;
 *   · one re-run for each phase, and the abandonment that may follow it, with the rule's every UI act
 *     (`PHASE7_RECOVERY_MS`) — 4 × 1 × 41,280 s = 165,120 s;
 *   · five sign-offs, each two acts (`PHASE7_SIGN_OFF_UNIT_MS`) — ~~5 × 1,800 s = 9,000 s~~ ⭐ E2: and each Record
 *     Assurance's declared reviews, ~~5 × 5,640 s = 28,200 s~~ ⭐ `E12F` F2, F3: and the limit's read before each, and the
 *     rule's one re-run of the declared reviews, 5 × 11,280 s = 56,400 s, ⚠ counted for every unit though a phase that is
 *     abandoned is never signed off, and as four policies' though the root declares two: an upper bound;
 *   · the final screenshot and the final archive's read — 120 s + 300 s = 420 s;
 * = 419,640 s (116.6 hours). ⭐ Package L, D13 — each review six calls, so 1,800 + 5 × 55,740 + 1,200 + 4 × 58,080 +
 * 5 × 15,120 + 420 = 590,040 s (163.9 hours), under Node's timer ceiling. ~~= 419,640 s~~ ~~= 391,440 s (108.7 hours)~~
 * before `E12F`'s limit read and re-run. ~~= 372,240 s (103.4
 * hours)~~ before E2's declared reviews. ~~1,800 s + 4 × 38,160 s +
 * 4 × 1 × 38,160 s = 307,080 s (85.3 hours)~~ ⛔ counted the five
 * sign-offs (3,000 s at their bounds), the four abandonments (1,200 s) and the rule's UI acts inside the 1,800 s setup
 * allowance, and the root's Begin & Execute (up to 38,160 s) nowhere: a run whose every act stayed within its bound could
 * reach the test's timeout with a unit still inside its allowance, and Playwright would kill the server mid-unit there
 * (`REG-F-527`). ⚠ `P76F-D` D4 — AND IT STILL CAN, BY THE SETUP ALONE: a setup whose acts each stay inside their bounds can
 * outlast its 1,800 s allowance, and every later term is then short by that much. Disclosed, not closed: counting the
 * setup's acts needs their number, which this module cannot read (`PHASE7_SETUP_MS`). ⚠ It must stay under Node's timer
 * ceiling, 2,147,483,647 ms, past which a timer fires at once.
 */
export const PHASE7_TEST_TIMEOUT_MS =
	PHASE7_SETUP_MS +
	PHASE7_PRESSED_UNITS * PHASE7_UNIT_RUN_MS +
	PHASE7_MODEL_UNITS * PHASE7_INTROSPECT_MS +
	PHASE7_MODEL_UNITS * PHASE7_RERUNS_PER_PHASE * PHASE7_RECOVERY_MS +
	PHASE7_PRESSED_UNITS * PHASE7_SIGN_OFF_UNIT_MS +
	PHASE7_UI_MS +
	PHASE7_INTROSPECT_MS;

/**
 * ⭐ D8 — the sponsor's limit, in reviewer calls, checked before each phase ⭐ and before each re-run the run plan's rule
 * makes (`REG-D-105` (4)) ⭐ — and, on the completion programme's main line (E12 and E3 merged), before every other act
 * the lane presses that spends it, that act's own worst case counted: before each sign-off and before the rule's re-run
 * of a unit's declared reviews (`E12F` F2; `signOffWorstCase`), and in half B before Send, the authoring floor's
 * (`REG-D-112`, E3's review finding 2; ~~`PHASE7_AUTHORING_REVIEWER_CALLS`~~ ⭐ `phase7AuthoringReviewerCalls` for the
 * anticipated inventory, the review in parts, B6), and, paid, before the root's press, ~~a MODEL
 * root's (`rootLimitCheck`; `PHASE7_UNIT_REVIEWER_CALLS`)~~ ⭐ not its worst case: a MODEL root's one try's reserve, and
 * none for a root that runs no model (`rootLimitCheck`; `PHASE7_TRY_RESERVE`; `REG-D-114` (14), as amended 2026-10-16).
 * ~~⚠ Two rules, as each package built its own: before a phase, a
 * re-run of one and a sign-off the total must be UNDER the limit (`limitCheck`); before Send and the root's press it may
 * reach it (`limitCheckAhead`).~~ ⭐ ONE RULE for every check (the lead's delegated decision of 2026-10-16, registered
 * as REG-D-114 (14)): the lane may REACH the limit and never pass it by what it counts — the calls spent, those held back and
 * what the act itself counts must total at most the limit (`limitCheck`). ~~⚠ Before a phase and the rule's re-run of one it
 * counts their first call only (`PHASE7_PHASE_FIRST_CALL`), as D8 counted no phase's worst case.~~ ~~⭐ R3-B's fix round, F1 —
 * and what each act counts is its worst case, before a phase and the rule's re-run of one too: a model unit's before a
 * phase and before a re-run of its work (`PHASE7_UNIT_REVIEWER_CALLS`), a re-review's before a re-run of its review
 * (`PHASE7_REREVIEW_REVIEWER_CALLS`). So a phase is started only while the calls spent before the run and those recorded
 * in it total at most 306: 450, less the 4 held back and the phase's 140.~~ ⛔ `REG-D-114` (14), as amended 2026-10-16: a
 * phase's whole worst case would refuse every phase once about 306 calls are spent ⭐ (at the limit of 450; ~~at today's
 * 600, once 456 are: 600, less the 4 held back and the phase's 140~~ ~~⭐ at today's 650, once 506 are: 650, less the 4
 * held back and the phase's 140, P6 package L, F1; `REG-D-120` Q15~~ ~~⭐ at today's 800, once 656 are: 800, less the 4 held
 * back and the phase's 140, package Q, F5; `REG-D-123` Q26~~ ~~⭐ at today's 900, once 756 are: 900, less the 4 held back
 * and the phase's 140, the review in parts, package C, B6; `REG-D-126` Q32~~ ⭐ at today's 1000, once 856 are: 1000, less the 4
 * held back and the phase's 140, the review in parts, package I, B8b; `REG-D-131` Q37). ⭐ What each act counts, by the one rule
 * as amended: before a phase's Begin & Execute, the rule's re-run of its work or of its review, and a MODEL root's press,
 * ONE TRY'S RESERVE (`PHASE7_TRY_RESERVE`), D8's own rule, for the lane checks again before every later press; before a
 * sign-off and the rule's re-run of its declared reviews, that act's worst case; before Send, the authoring floor's. So a
 * phase is started while the calls spent before the run and those recorded in it total at most ~~442: 450, less the 4 held
 * back and the phase's 4~~ ~~⭐ 592: 600, less the 4 held back and the phase's 4 (P5 package C, F2; `REG-D-114` (14))~~ ~~⭐
 * 642: 650, less the 4 held back and the phase's 4 (P6 package L, F1; `REG-D-114` (14))~~ ~~⭐ 792: 800, less the 4 held back
 * and the phase's 4 (package Q, F5; `REG-D-114` (14))~~ ~~⭐ 892: 900, less the 4 held back and the phase's 4 (the review
 * in parts, package C, B6; `REG-D-114` (14))~~ ⭐ 992: 1000, less the 4 held back and the phase's 4 (the review in parts,
 * package I, B8b; `REG-D-114` (14)) — ⚠ and
 * a phase's own spend can carry the total past the limit, since nothing is checked during a
 * press (`PHASE7_UNIT_REVIEWER_CALLS`), which the run report says. ~~150 (`REG-D-102` (4))~~ ~~200: *"Raise limit to 200"* (`REG-D-105` (1), which amends
 * `REG-D-102` (4)); it covers the re-qualification, the re-run and a few recovery re-runs.~~ ~~230: *"the limit rises
 * to about 230"* (`REG-D-108`, after P2), held as the number its pointer states, for P3.~~ ~~⭐ `JAN-EXEC` Phase 7
 * completion programme, E3 — 450: *"Raise to about 450 (Recommended)"* (`REG-D-110` (1), after P3; `REG-D-109`), for the
 * whole programme — the re-qualification (P4), half A again (P5) and half B (P6) — held as the number its pointer states,
 * *"**The limit is 450 reviewer calls**"*, which amends `REG-D-102` (4) again.~~ ~~⭐ `JAN-EXEC` Phase 7 P5, package C (F2;
 * 2026-10-18) — 600: the sponsor chose *"Qualify High, then P5 (Recommended)"*, whose text read *"Through P6 the total is
 * about 580, so the limit rises to about 600."* (`REG-D-117` Q10), raising `REG-D-110` (1)'s limit for the rest of the
 * programme — the qualification of `glm-5-3-flash-high`, P5's re-run and half B (P6) — held as the number the sponsor's
 * chosen text states.~~ ~~⭐ `JAN-EXEC` Phase 7 P6, package L (F1; 2026-10-22) — 650: the sponsor chose *"Raise to about 650
 * (Recommended)"*, whose text read *"Room for P6 to finish even with a retry or two. Its spend still reports before P7."*
 * (`REG-D-120` Q15, asked before half B, P6), and its meaning reads *"`REG-D-110` (1)'s limit becomes about 650"* — held
 * as the number the sponsor's chosen label states.~~ ~~⭐ `JAN-EXEC` Phase 7 after P6's third run, package Q (F5; 2026-10-23)
 * — 800: the sponsor chose *"Raise the limit to about 800 (Recommended)"*, whose text read *"Enough for the full
 * agent-authored PWA plus a retry or two. P6 still reports back before P7."* (`REG-D-123` Q26, asked after P6's third run,
 * half B, run-11), and its meaning reads *"`REG-D-110` (1)'s limit becomes about 800"* — held as the number the sponsor's
 * chosen label states.~~ ~~⭐ `JAN-EXEC` Phase 7, the review in parts, package C (B6; 2026-10-24) — 900: the sponsor chose
 * *"Raise to about 900 (Recommended)"*, whose text read *"Room for retries in qualification and in P6. P6 still reports
 * back before P7."* (`REG-D-126` Q32, asked after revision 1 of the review-in-parts design), and its meaning reads
 * *"`REG-D-110` (1)'s limit becomes about 900."* — held as the number the sponsor's chosen label states.~~ ⭐ `JAN-EXEC`
 * Phase 7, the review in parts, package I (B8b; 2026-10-24) — 1000: the sponsor chose *"Raise to about 1,000
 * (Recommended)"*, whose text read *"Covers one more bridge round if needed (about 40) and P6's retries and repairs, with
 * about 65 to spare."* (`REG-D-131` Q37, asked after revision 4 of the review-in-parts design), and its meaning reads
 * *"`REG-D-110` (1)'s limit becomes about 1,000."* — held as the number the sponsor's chosen label states, without its
 * thousands comma. ⚠ Each paid step
 * still reports before the next (`REG-D-110` (1)): the limit is the programme's ceiling, not a step's approval.
 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D16, D17 (2026-10-25) — ~~1000~~ 2400: the sponsor chose *"About 2,400 (Recommended)"*,
 * whose text read *"Covers the bad case under the recommended review: every unit re-run with 3 tries (P6 about 1,030) plus one
 * press's worst case."* (`REG-D-135` (4), Q44), and its meaning reads *"The limit becomes about 2,400, raising `REG-D-131`'s
 * about 1,000. Before each press, the lane counts that press's whole worst case."* — held as the number the ruling's meaning
 * states, without its thousands comma. ⭐ AND WHAT EACH CHECK COUNTS IS NOW THE PRESS'S WHOLE WORST CASE (D16), replacing
 * `REG-D-114` (14)'s one try's reserve: a model unit's Begin & Execute, the rule's re-run of its work and a MODEL root's press,
 * (3 tries + 32 command runs) × 6 = 210 (`PHASE7_UNIT_REVIEWER_CALLS`); the rule's re-run of a stopped phase's review, its
 * refused reviews × 6 (`phase7RereviewReviewerCalls`); a sign-off and the rule's re-run of its declared reviews, the declared
 * reviews × 6; Send, the authoring floor's worst case at 6 calls a review. ~~So the recorded exchanges cannot pass the limit.~~
 * ⛔ Package L's check, finding 1: not of Send's press — before Send no candidate exists, so its check counts the floor for the
 * types ANTICIPATED (`PHASE7_AUTHORING_ANTICIPATED_PARTS`), an estimate and not a bound, and a turn that stages more spends its
 * floor's reviews inside that press, where nothing is checked. The other presses' counts are their whole worst case; the run
 * report's caveat says which press is the exception (`scripts/phase7/run-report-core.ts`, `LIMIT_CAVEAT`).
 */
export const PHASE7_PAID_LIMIT = 2400;

/** ⭐ D8 — the reviewer calls held back for the negative control (P7-4e): its own cap (`negative-control.ts`). */
export const PHASE7_NEGATIVE_CONTROL_RESERVE = 4;

/**
 * ⭐ D1, D2 — the run folder. Set, the server keeps the run in it and the config collects `phase7.live.ts` alone; unset,
 * the one-unit lane as before (`e2e-live-exec/run-folder.ts`). Set before Playwright starts: the config is loaded again
 * in its worker.
 */
export const LIVE_RUN_DIR_VARIABLE = 'JPWB_LIVE_RUN_DIR';

/**
 * ⭐ D1 — the spec calls a model only when this is `1`; otherwise it is dry. ⚠ Set with no run folder, it and the next are
 * refused at boot (`phase7RequestFaults`): the config would run the one-unit spec, which is paid whatever they say.
 */
export const PHASE7_PAID_VARIABLE = 'JPWB_PHASE7_PAID';

/** ⭐ D8 — the reviewer calls spent before this run (P7-3a's), given by the operator. */
export const PHASE7_PRIOR_CALLS_VARIABLE = 'JPWB_PHASE7_PRIOR_REVIEWER_CALLS';

// ── ⭐⭐ `JAN-EXEC` Phase 7 completion programme, E3 — HALF B, THE AUTHORING HALF (`docs/_working/DESIGN-phase-7-completion.md`
// §4 C1, C3, C6; `REG-D-109`, `REG-D-110` (4)) ─────────────────────────────────────────────────────────────────────────
// Half A types §3.2's PWA into the designer as the operator; half B has the LIVE AUTHORING AGENT build it from the run
// plan's request, naming `wordfreq` (`REG-D-110` (4)), and a person's acceptance of the exact candidate pressed before it
// is published and run as in P3. ⛔ HALF A STAYS THE DEFAULT: unset or blank, the lane is exactly what it was.

/** ⭐ C1 — which half the Phase 7 lane runs: unset or blank, half A; `B`, the live agent authors the PWA. */
export const PHASE7_HALF_VARIABLE = 'JPWB_PHASE7_HALF';

export type Phase7Half = 'A' | 'B';

/** The halves this lane knows, by the value `JPWB_PHASE7_HALF` names each. */
export const PHASE7_HALVES: readonly Phase7Half[] = ['A', 'B'];

/**
 * The half `env` asks for: `A` when it names none (unset, or blank after trimming); `undefined` when it names one this
 * lane does not know — matched exactly, after trimming, as every lane variable is (`b` is not `B`).
 */
export function phase7Half(env: Readonly<Record<string, string | undefined>>): Phase7Half | undefined {
	const named = (env[PHASE7_HALF_VARIABLE] ?? '').trim();
	if (named === '') return 'A';
	return PHASE7_HALVES.find((h) => h === named);
}

/**
 * ⭐ C3 — THE AUTHORING AGENT'S MODEL, which the server reads at every turn (`src/lib/server/agent/pi-agent.ts`,
 * `resolveModel`). Unset, Pi's configured default authors the PWA, or the first model with credentials (`REG-F-509`), and
 * nothing in the run said which was asked for (`REG-F-531`): so half B REQUIRES it, and the boot records it (`bootOf`).
 */
export const AUTHOR_MODEL_VARIABLE = 'JPWB_AGENT_MODEL';

/**
 * ⭐ C1, C3 — WHY THE LANE REFUSES THE HALF in `env`, one line per fault: a half this lane does not know, and half B with
 * no author's model — refused as the lane refuses every unset live variable, before the server starts. A rule of THIS
 * LANE, labelled as such: the product runs an authoring turn with neither.
 */
function halfFaults(env: Readonly<Record<string, string | undefined>>): string[] {
	const half = phase7Half(env);
	if (half === undefined)
		return [
			`  · ${PHASE7_HALF_VARIABLE}=${JSON.stringify(env[PHASE7_HALF_VARIABLE])} is refused by a rule of THIS LANE: it names ` +
				`no half of the Phase 7 run — 'A' (the default: §3.2's PWA, typed by the operator) or 'B' (the live authoring ` +
				'agent builds it; DESIGN-phase-7-completion.md §4 C1). The value is matched exactly, after trimming.'
		];
	const authorModel = (env[AUTHOR_MODEL_VARIABLE] ?? '').trim();
	if (half === 'B' && authorModel === '')
		return [
			`  · ${PHASE7_HALF_VARIABLE}='B' runs the live authoring agent, and it is missing ${AUTHOR_MODEL_VARIABLE}, the model ` +
				"that authors the PWA. Unset, Pi's configured default — or the first model with credentials — authors it, " +
				'with nothing recording which was asked for (REG-F-531, REG-F-509): a rule of THIS LANE (design §4 C3). Set ' +
				'it to a provider/id Pi resolves.'
		];
	return [];
}

/**
 * ⭐ C3 — THE AUTHORING FLOOR'S RUNS IN ONE TURN: the floor after the agent's run, and the ONE auto-refinement pass — a
 * second run of the agent and of the floor — that may follow it (`src/routes/pwa/[id]/agent/+server.ts`,
 * `runFloorAfterTurn`: *"auto-refine at most once"*).
 */
export const PHASE7_AUTHORING_FLOOR_RUNS = 2;

/**
 * ⭐⭐ C3 — THE AUTHORING ALLOWANCE: ~~the turn and its reviews, each floor run the agent's run and one review of up to
 * `reviewerCallsPerTry` calls — ONE TRY's figure of the one-unit lane, derived by reference — 2 × (3,600 s / 3) = 2 ×
 * (240 s + 4 × 240 s) = 2,400 s (40 minutes)~~ ⭐⭐ the review in parts, B6 (`REG-D-125`; design D9; roadmap 9a.7, "Wait") —
 * FOR `parts` TYPES: each floor run the agent's run, at the executor's allowance, and ONE REVIEW OF EACH PART of up to
 * `reviewerCallsPerTry` calls at the reviewer's bound, derived from the one-unit lane's budget by reference — 2 × (240 s +
 * parts × 4 × 240 s): 2,400 s (40 minutes) for one part, 31,200 s (520 minutes) for run-11's sixteen ⭐ — package L, D13 (each
 * review six calls): 2 × (240 s + parts × 6 × 240 s), 3,360 s (56 minutes) for one part, 46,560 s (776 minutes) for sixteen. ⛔ The figure was
 * one part's for every turn: it counted two reviews in all, and the floor now reviews each type of the candidate in each of
 * its two possible rounds (design D9). ⚠ AT LEAST ONE PART: the turn stages its types as the agent authors them, so a count
 * read before the first is staged says nothing of the candidate to come, and is given one part's, the 2,400 s every turn was
 * given before. ⚠ AN ALLOWANCE, NOT A BOUND: the agent's turn has none, as the executor's has none (`executorCallMs`). A
 * turn that outlasts it ends the run there, `allowance-exceeded`: the page that holds the turn must not leave it (a turn is
 * discarded when its page leaves), and nothing is pressed beside it.
 */
export function phase7AuthoringAllowanceMs(parts: number): number {
	return (
		PHASE7_AUTHORING_FLOOR_RUNS *
		(LANE_BUDGET.executorCallMs + Math.max(1, parts) * LANE_BUDGET.reviewerCallsPerTry * LANE_BUDGET.reviewerCallMs)
	);
}

/**
 * ⭐⭐ The review in parts, B6 (`REG-D-125`; design D11; roadmap 9a.7, "Spend reserve") — THE INVENTORY ANTICIPATED BEFORE SEND:
 * no candidate exists before the request is sent, so the reserve the limit counts there is stated for the types it is
 * expected to make — sixteen, run-11's candidate (`REG-F-571`; design §3's measurement and D11's arithmetic). ⚠ An estimate,
 * never a bound: the agent may author more, and the lane reads the inventory its turn actually stages
 * (`phase7-operator.ts`, `waitForTheCandidate`).
 */
export const PHASE7_AUTHORING_ANTICIPATED_PARTS = 16;

/**
 * ⭐⭐ `REG-D-112` (E3's review, finding 2) — THE AUTHORING TURN'S WORST CASE IN REVIEWER CALLS: ~~each of its floor runs one
 * review of up to `reviewerCallsPerTry` calls — 2 × 4 = 8, the calls the allowance above counts in time~~ ⭐⭐ the review in
 * parts, B6 (design D11) — FOR `parts` TYPES: each of its floor runs a review of each part, each of up to
 * `reviewerCallsPerTry` calls — 2 × parts × 4: 128 for sixteen ⭐ — package L, D16 (`REG-D-135` (4): Send counts the authoring
 * floor's worst case at 6 calls a review): 2 × parts × 6, 192 for sixteen — the calls the allowance above counts in time. ⛔ It was a
 * constant, 8, and a candidate of sixteen types inherited it. ⛔ Half B checks it against the limit BEFORE SEND (D8), for the
 * anticipated inventory (`PHASE7_AUTHORING_ANTICIPATED_PARTS`): the lane's first check had been before the first PHASE, so
 * the authoring floor's reviews, and a model root's, were spent before the limit was ever asked.
 */
export function phase7AuthoringReviewerCalls(parts: number): number {
	return PHASE7_AUTHORING_FLOOR_RUNS * parts * LANE_BUDGET.reviewerCallsPerTry;
}

/**
 * ⭐⭐ `REG-D-112` (finding 2) — ONE MODEL UNIT'S WORST CASE IN REVIEWER CALLS, as its allowance counts its reviews
 * (`PHASE7_UNIT_ALLOWANCE_MS`): each try's work-product review, and the review of each command reviewed, each of up to
 * `reviewerCallsPerTry` calls — (3 + 32) × 4 = 140. ~~⛔ Half B checks it before the ROOT's press when the agent's root
 * declares MODEL: §3.2's root runs no model, and the agent's may. ⭐ R3-B's fix round, F1 — and the lane checks it before
 * each PHASE's press, and before the rule's re-run of a phase's work, which runs the whole unit again (`runModelUnit`).~~
 * ~~⛔ `REG-D-114` (14), as amended 2026-10-16: no check counts it — before each of those presses the lane counts one try's
 * reserve (`PHASE7_TRY_RESERVE`). ⭐ It is what one such press may spend AFTER its check, which nothing checks during the
 * press: the run report's caveat states it (`scripts/phase7/run-report-core.ts`, `LIMIT_CAVEAT`).~~
 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D16 (`REG-D-135` (4); design D16): IT IS WHAT THE LANE COUNTS BEFORE EACH SUCH PRESS — a
 * phase's Begin & Execute, the rule's re-run of its work, and a MODEL root's press — ~~(3 + 32) × 4 = 140~~ (3 + 32) × 6 =
 * 210, so the press cannot carry the total past the limit.
 */
export const PHASE7_UNIT_REVIEWER_CALLS =
	(LANE_BUDGET.tries + PHASE7_REVIEWED_COMMANDS) * LANE_BUDGET.reviewerCallsPerTry;

// ~~⭐ R3-B's fix round, F1 — A RE-REVIEW'S WORST CASE IN REVIEWER CALLS, counted before the rule's re-run of a stopped phase's
// REVIEW: the floors run again over the refused attempt's work product and each of its reviewed commands' evidence, and no
// producer runs, each a review of up to `reviewerCallsPerTry` calls — (1 + 32) × 4 = 132 (`PHASE7_REREVIEW_REVIEWER_CALLS`).~~
// ⛔ Removed by `REG-D-114` (14), as amended 2026-10-16: the rule's re-run of a review counts one try's reserve, and nothing
// read the figure after.

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L — D16 (`REG-D-135` (4); design D16) — A RE-RUN OF A STOPPED PHASE'S REVIEW, ITS WHOLE WORST
 * CASE IN REVIEWER CALLS: the refused reviews it re-runs — the server re-runs only those (`+page.server.ts` `rerunReview`) — each
 * of up to `reviewerCallsPerTry` calls, `refused` × 6. ⛔ Where the store names none (`refused` undefined: no stopped attempt the
 * lane can read), every review that attempt could hold — its work product and its 32 retained command runs, (1 + 32) × 6 =
 * 198 — so the count is never short of what the press may spend.
 */
export function phase7RereviewReviewerCalls(refused: number | undefined): number {
	return (refused ?? 1 + PHASE7_REVIEWED_COMMANDS) * LANE_BUDGET.reviewerCallsPerTry;
}

/**
 * ~~⭐⭐ `REG-D-114` (14), AS AMENDED 2026-10-16 — ONE TRY'S RESERVE, IN REVIEWER CALLS: what the one rule counts ahead of a
 * phase's Begin & Execute, the rule's re-run of its work or of its review, and a MODEL root's press — one review of up to
 * `reviewerCallsPerTry` calls, 4: D8's own rule, for the lane checks the limit again before every later press. ⛔ Counted
 * instead of the act's whole worst case (`PHASE7_UNIT_REVIEWER_CALLS`, 140), which would refuse every phase once about ~~306~~
 * ~~⭐ 456~~ ~~⭐ 506~~ ~~⭐ 656~~ ~~⭐ 756~~ ⭐ 856 calls are spent (306 at the limit of 450, 456 at 600, 506 at 650, 656 at 800,
 * 756 at 900). ⚠ So
 * a press is let through while one try's review fits, and what it spends after that is not checked until the next press: a
 * phase's own spend can carry the total past the limit (the sponsor's limit is ~~"about 450", `REG-D-110` (1)~~ ~~⭐ "about
 * 600", `REG-D-117` Q10, raising `REG-D-110` (1)'s~~ ~~⭐ "about 650", `REG-D-120` Q15, raising `REG-D-110` (1)'s~~ ~~⭐
 * "about 800", `REG-D-123` Q26, raising `REG-D-110` (1)'s~~ ~~⭐ "about 900", `REG-D-126` Q32, raising `REG-D-110` (1)'s~~ ⭐ "about 1,000", `REG-D-131`
 * Q37, raising `REG-D-110` (1)'s).~~
 * ⛔ REMOVED by the sponsor's ruling (`REG-D-135` (4), Q44; design D16; package L): `PHASE7_TRY_RESERVE`, one try's reserve,
 * `LANE_BUDGET.reviewerCallsPerTry`, is counted by no check — each press counts its whole worst case
 * (`PHASE7_UNIT_REVIEWER_CALLS`, `phase7RereviewReviewerCalls`), and nothing reads the figure after.
 */

/** ⭐ C1 — how long the lane waits between two reads of the candidate's status: each read is the whole dump. */
export const PHASE7_CANDIDATE_POLL_MS = 5_000;

/** ⭐ C1 — the designer's four acts after the turn: Accept exact candidate, then Submit for Review, Validate and Publish. */
export const PHASE7_DESIGNER_ACTS = 4;

/**
 * ⭐ C3 — THE AUTHORING'S SHARE OF THE SPEC'S TIMEOUT: the allowance; the poll that may overrun it by one pause and one
 * read; and each designer act at its bound — its click, its POST (a sign-off act's bound: none of the four calls a model),
 * and the store read after it — 2,400 s + 5 s + 300 s + 4 × (120 s + 300 s + 300 s) = 5,585 s. ⚠ Creating the draft and
 * the Undertaking are the setup allowance's, as half A's typing is (`PHASE7_SETUP_MS`).
 * ⭐ The review in parts, B6 (design D9) — FOR `parts` TYPES, the allowance theirs (`phase7AuthoringAllowanceMs`): 5,585 s at
 * one part, as before, and 34,385 s at sixteen. ⭐ Package L, D13 — each review six calls: 6,545 s at one part, 49,745 s at
 * sixteen.
 */
export function phase7AuthoringMs(parts: number): number {
	return (
		phase7AuthoringAllowanceMs(parts) +
		PHASE7_CANDIDATE_POLL_MS +
		PHASE7_INTROSPECT_MS +
		PHASE7_DESIGNER_ACTS * (PHASE7_UI_MS + PHASE7_SIGN_OFF_MS + PHASE7_INTROSPECT_MS)
	);
}

/**
 * ⭐ C3 — ONE PHASE'S SHARE OF THE SPEC'S TIMEOUT, each act at its bound: its Begin & Execute and what follows it, the
 * limit's read before it, the run plan's rule on it, and its sign-off — ~~38,940 s + 300 s + 41,280 s + 1,800 s = 82,320 s~~
 * ⭐ with E12's sign-off (`PHASE7_SIGN_OFF_UNIT_MS`: its declared reviews, the limit's read before it and the rule's one
 * re-run of them), 38,940 s + 300 s + 41,280 s + 11,280 s = 91,800 s ⭐ — package L, D13 (each review six calls): 55,740 s +
 * 300 s + 58,080 s + 15,120 s = 129,240 s — the terms `PHASE7_TEST_TIMEOUT_MS` counts once for
 * each of §3.2's four phases. ⚠ Its sign-off is bounded as one of four declared policies, §3.2's most
 * (`PHASE7_DECLARED_POLICIES_PER_UNIT`): ~~an agent's unit that declares more is bounded short~~ ⭐ half B's timeout
 * re-counts each unit's sign-off for the policies it declares (`phase7HalfBTestTimeoutMs`; the lead's delegated decision
 * of 2026-10-16, registered as REG-D-114 (15)).
 */
export const PHASE7_PER_PHASE_MS =
	PHASE7_UNIT_RUN_MS +
	PHASE7_INTROSPECT_MS +
	PHASE7_RERUNS_PER_PHASE * PHASE7_RECOVERY_MS +
	PHASE7_SIGN_OFF_UNIT_MS;

/** The longest delay a Node timer takes, 2,147,483,647 ms: past it a timer fires at once. */
export const NODE_TIMER_CEILING_MS = 2_147_483_647;

/**
 * ⭐⭐ C3 — HALF B'S TIMEOUT, ONCE ITS UNITS ARE READ (C2: the PWA is the agent's, so its phases are as many as it made):
 * half A's, re-counted for `phases` phases in place of §3.2's four, plus the authoring's share — for four phases,
 * ~~372,240 s + 5,585 s = 377,825 s~~ ~~⭐ 419,640 s + 5,585 s = 425,225 s~~ ⭐ package L, D13: 590,040 s + 6,545 s = 596,585 s,
 * half A's counting E12's sign-offs. ⛔ CAPPED AT NODE'S TIMER CEILING, past which Playwright would time the test out at once: a
 * PWA of ~~26~~ ~~⭐ 23~~ ⭐ 17 phases or more (16 at sixteen parts; package L, D13) is given the ceiling, about 596 hours, not
 * its arithmetic. ⚠ Half B STARTS under half
 * A's timeout, which covers ~~the authoring~~ ⭐ one part's authoring many times over, and the lane extends it ⭐ while its
 * turn runs, for the parts it stages (`phase7HalfBAuthoringTimeoutMs`), and here when the units are read.
 * ⭐⭐ ~~`phases`~~ `declared` (the lead's delegated decision of 2026-10-16, registered as REG-D-114 (15)) — the policies each
 * unit declares as the store holds them, one count per unit, the root first: its phases are the units after the root, and
 * EACH UNIT'S SIGN-OFF IS RE-COUNTED FOR ITS OWN POLICIES (`phase7SignOffUnitMs`) in place of §3.2's four
 * (`PHASE7_SIGN_OFF_UNIT_MS`), which half A's arithmetic counts once per unit. ⛔ A unit declaring five was counted as
 * four: the timeout could kill the server inside a sign-off whose every review stayed within its bound (`REG-F-527`). For
 * five units each declaring four, the figure above. ⚠ And the ceiling's ~~23~~ ⭐ 17 phases (package L, D13) are for units each
 * declaring four, at one part: units declaring more reach it with as many phases or fewer (eight each, ~~21~~ ⭐ 15), units
 * declaring fewer need as many or more (one each, ~~25~~ ⭐ 18).
 * ⭐ The review in parts, B6 (design D9) — AND THE AUTHORING'S SHARE FOR THE `parts` ITS TURN STAGED (`phase7AuthoringMs`), the
 * largest count the lane read: the figures above are one part's, 5,585 s, and at sixteen parts the share is 34,385 s, so for
 * four phases 454,025 s. ~~⚠ The ceiling's three phase counts above hold at one part and at sixteen alike.~~ ⭐ Package L, D13 —
 * each review six calls: one part's share 6,545 s, sixteen's 49,745 s, so for four phases 639,785 s; and the ceiling comes a
 * phase sooner at sixteen parts than at one (16 phases, not 17; eight policies each, 15 at either).
 */
export function phase7HalfBTestTimeoutMs(declared: readonly number[], parts: number): number {
	const phases = declared.length - 1;
	const signOffs = declared.reduce((ms, policies) => ms + phase7SignOffUnitMs(policies) - PHASE7_SIGN_OFF_UNIT_MS, 0);
	return Math.min(
		NODE_TIMER_CEILING_MS,
		PHASE7_TEST_TIMEOUT_MS + (phases - PHASE7_MODEL_UNITS) * PHASE7_PER_PHASE_MS + signOffs + phase7AuthoringMs(parts)
	);
}

/**
 * ⭐ The review in parts, B6 (design D9: *"carry the allowance into the spec timeout"*) — HALF B'S TIMEOUT WHILE ITS TURN RUNS:
 * half A's, which half B starts under, and the authoring's share for the `parts` its turn has staged — capped at Node's
 * timer ceiling. The lane sets it each time it derives a larger allowance (`waitForTheCandidate`), so a turn the allowance
 * still holds is not cut off by the test's own timeout: from 217 parts on, the authoring's share alone is longer than half
 * A's timeout.
 */
export function phase7HalfBAuthoringTimeoutMs(parts: number): number {
	return Math.min(NODE_TIMER_CEILING_MS, PHASE7_TEST_TIMEOUT_MS + phase7AuthoringMs(parts));
}
