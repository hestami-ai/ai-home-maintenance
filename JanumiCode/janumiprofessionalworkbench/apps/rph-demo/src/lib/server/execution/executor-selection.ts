// ⭐ `JAN-SELRES` RS-1 (D1, D3) — WHICH EXECUTOR THIS HOST RUNS, ANSWERED IN ONE PLACE, BEFORE ANYTHING IS DISPATCHED.
//
// ⭑ THE REVIEWER'S SELECTOR, MIRRORED (`assurance/reviewer-selection.ts`, `JAN-SELREV` D2–D7). The executor's
// configuration used to be read in three places and none of them before dispatch: `execution/model.ts` chose the
// fixture on its own load-time `TEST_MODE`, `agyPrint` read the JUDGE model at call time, and the Pi adapter read
// `JPWB_EXECUTOR_MODEL` when it opened — after `StartExecutionStep`, so every misconfiguration was recorded as a
// started-then-failed step (`DESIGN-the-selection-residuals.md` §2 G3, G4). Now `beginExecute` asks this once, before
// its dispatch batch, and the one answer opens the executor AND names the record's fallback identity.
//
// ⛔ OUTSIDE TEST MODE THE TOOL AND ITS MODEL ARE CONFIGURATION, AND THEIR ABSENCE IS A REFUSAL (`REG-D-052`). Only
// test mode, with no tool named, answers the declared stand-in — the fixture executor.
//
// ⭐⭐ `JAN-MHX` MH-3 (`DESIGN-multi-harness-executor.md` D31–D34; the sponsor's answers of 2026-10-18) — AND IT ASKS THE
// EXECUTOR'S MODEL AGAINST THE REVIEWER'S, BEFORE THE PAID WORK. The floor's independence check (DIFFERENT_MODEL)
// compares the two by exact string, after the work is done: the same model refused every review only then, and another
// spelling or effort of it passed. Now the selector is handed the reviewer the same request's preflight admitted, and
// refuses a model of the reviewer's family, or one no measured listing places (`MODEL_FAMILIES`). It also refuses an
// effort nothing would read, names the sponsor's default model for the chosen tool without applying it, and ~~captures
// `JPWB_CODEX_BIN`~~ ⭐ `JAN-MHX` MH-6 — refuses `JPWB_CODEX_BIN`, which the Codex driver captures
// (`tools/codex-executor-driver.ts`, `CODEX_BIN_OVERRIDE`).
//
// ⚠ IT LIVES OUTSIDE `lib/server/tools` ON PURPOSE, for the reviewer selector's reason: that directory holds the
// backing-tool ADAPTERS, and `verif/tool-adapter-exports-reachable.test.ts` holds each of their exports to a production
// reference.
import { AGY_BIN_OVERRIDE } from '../assurance/agy-cli.js';
import type { ReviewerProgramOverrides } from '../assurance/reviewer-selection.js';
import { CODEX_BIN_OVERRIDE } from '../tools/codex-executor-driver.js';
import { DEVIN_BIN_OVERRIDE } from '../tools/devin-reviewer.js';
import {
	besideReplayReason,
	liveSelectionsBesideReplay,
	REPLAY_VARIABLE,
	resolveReplayRecording
} from '../replay/replay-switch.js';
import {
	KNOWN_TOOL_IDS,
	resolveExecutorModel,
	resolveExecutorToolId,
	selectBackingTool
} from '../tools/backing-tool.js';

/** The environment the selector reads — `process.env` in the product, a plain record in a test. */
export type ExecutorEnvironment = Readonly<Record<string, string | undefined>>;

/**
 * ⭐ D3 — the program overrides the adapters CAPTURED when they loaded: `JPWB_AGY_BIN` (`agy-cli.ts`) and
 * `JPWB_DEVIN_BIN` (`devin-reviewer.ts`). ⭑ THE REVIEWER'S RECORD, READ BY A SECOND SELECTOR: one capture per adapter,
 * whichever role runs it. `undefined` is unset; `''` is SET, to an empty program name, which the adapter would run.
 * ⭐ `JAN-MHX` MH-3 (D34) — AND `JPWB_CODEX_BIN`, the executor's own: no reviewer runs Codex, so the reviewer's record has no
 * key for it (~~`CODEX_BIN_OVERRIDE`, below~~ ⭐ MH-6: `CODEX_BIN_OVERRIDE`, the Codex driver's capture).
 */
export type ExecutorProgramOverrides = ReviewerProgramOverrides & {
	readonly codex: string | undefined;
};

// ~~⭐ `JAN-MHX` MH-3 (D34) — `JPWB_CODEX_BIN`, CAPTURED WHEN THIS MODULE LOADS, as `devin-reviewer.ts` captures
// `JPWB_DEVIN_BIN` … ⚠ NO CODEX ADAPTER EXISTS YET, so nothing runs a program this names. Today it refuses beside a replay
// (`liveSelectionsBesideReplay`); `PROGRAM_VARIABLE` keys it by tool, so the day a Codex executor is wired the selected
// tool's refusal reads it too.~~ ⭐ `JAN-MHX` MH-6 — THE CAPTURE MOVED TO THE ADAPTER THAT RUNS IT
// (`tools/codex-executor-driver.ts`, `CODEX_BIN_OVERRIDE`), as `JPWB_DEVIN_BIN`'s is `devin-reviewer.ts`'s: one capture,
// which the driver runs and this selector refuses outside test mode for the selected tool, and beside a replay always.

/** Why the executor is refused — in the order the selector asks. Each names the refusal, so a caller need not parse. */
export type ExecutorRefusalCode =
	| 'EXECUTOR_TOOL_UNSET'
	| 'EXECUTOR_TOOL_UNKNOWN'
	| 'EXECUTOR_TOOL_UNWIRED'
	| 'EXECUTOR_PROGRAM_OVERRIDDEN'
	| 'EXECUTOR_MODEL_UNSET'
	// ⭐ `JAN-MHX` MH-3 (D32) — the effort: set where nothing would read it, or unset where the tool takes it as a flag.
	| 'EXECUTOR_EFFORT_NOT_TAKEN'
	| 'EXECUTOR_EFFORT_UNSET'
	// ⭐ `JAN-MHX` MH-3 (D33) — the model beside the reviewer's: the reviewer's own, by id or family, or one no listing places.
	| 'EXECUTOR_MODEL_IS_THE_REVIEWERS'
	| 'EXECUTOR_MODEL_UNCLASSIFIED'
	// ⭐ `JAN-EXEC` Phase 8 (D2; `REG-D-111` (5)) — the replay switch's two refusals (`replay/replay-switch.ts`).
	| 'EXECUTOR_REPLAY_OUTSIDE_TEST_MODE'
	// ⭐ `REG-D-112` (c) — ~~`EXECUTOR_REPLAY_BESIDE_A_TOOL`~~: beside ANY live-backend selection, its general form.
	| 'EXECUTOR_REPLAY_BESIDE_A_LIVE_SELECTION';

/**
 * The selector's answer — exactly one of ~~four~~ ⭐ five: `JAN-EXEC` Phase 8 adds `REPLAY` (D2), the recording folder
 * `JPWB_REPLAY` names, honoured in test mode only.
 *
 * ⭑ `REFUSED` CARRIES THE TOOL IT REFUSED, when one was named, so no caller has to re-read the environment to say which
 * configuration was wrong — a second read is a second answer. And ~~`PI`/`AGY`~~ ⭐ `PI` and `CLI` carry the MODEL, which
 * is what opens the executor AND what the record names: one read, so the model configured, run and recorded cannot come
 * apart.
 */
export type ExecutorSelection =
	| { readonly kind: 'STAND_IN' }
	| { readonly kind: 'PI'; readonly modelId: string }
	// ~~| { readonly kind: 'AGY'; readonly modelId: string }~~ ⭐ `JAN-MHX` MH-5 (D30) — RETIRED: the text-only agy executor
	// (`agy --print`, no workspace and no tools) could not do a work unit's work. agy is selected as the `CLI` kind below.
	// ⭐ `JAN-EXEC` Phase 8 (D2) — the executor answers from a recording: each recorded turn's tool calls run through the
	// real minted tools, and its recorded answer is returned once the turn text's hash matches (`replay/replay-executor.ts`).
	| { readonly kind: 'REPLAY'; readonly recordingDir: string }
	// ⭐ `JAN-MHX` MH-1 (D30) — an external CLI executing through the host's own tools (`tools/cli-executor-session.ts`), with
	// the driver its tool names. ~~⚠ Nothing selects it yet~~: a tool joins `WIRED_EXECUTORS` with its driver's package —
	// ⭐ MH-5: agy is the first tool selected as one (`WIRED_EXECUTORS`). ~~⭐ `JAN-MHX` MH-4: devin's has (D30).~~
	// ⭐ `JAN-MHX` MH-4, the check's fix: devin's joined `WIRED_IN_TEST_MODE_ONLY`, so only test mode selects it yet (D30).
	| {
			readonly kind: 'CLI';
			readonly toolId: string;
			readonly modelId: string;
			readonly effort?: string;
	  }
	| {
			readonly kind: 'REFUSED';
			readonly code: ExecutorRefusalCode;
			readonly toolId: string | undefined;
			readonly reason: string;
			readonly guidance: string;
	  };

/** What `getExecutionSession` can open: every answer but a refusal — so a refusal cannot reach an executor by type. */
export type RunnableExecutorSelection = Exclude<ExecutorSelection, { readonly kind: 'REFUSED' }>;

/**
 * ⭑ THE EXECUTOR ADAPTERS THIS HOST HAS, AND WHAT EACH SELECTION OPENS — the table the selector dispatches on, and the
 * one its guidance lists. ~~`devin` declares EXECUTION in the catalog (`backing-tool.ts`) but has no executor adapter, so
 * it is not here~~: the catalog says what a tool CAN do, this says what this host WIRED.
 * ~~⭐ `JAN-MHX` MH-4 (D30) — AND devin, WIRED TO THE `CLI` KIND, with its driver (`tools/devin-executor-driver.ts`), which
 * the CLI executor session opens: a selection of it names its tool.~~ ⭐ `JAN-MHX` MH-4, the check's fix — devin is not
 * here: it is wired in test mode only (`WIRED_IN_TEST_MODE_ONLY`, below).
 * ⭐ `JAN-MHX` MH-5 (D30) — ~~`agy: 'AGY'`~~ agy opens the `CLI` kind, through its driver (`tools/agy-executor-driver.ts`).
 * ⭐ `JAN-MHX` MH-6 (D30) — `codex` opens the `CLI` kind: an external CLI executing through the host's own tools, with the
 * driver `tools/cli-executor-drivers.ts` holds for it.
 */
const WIRED_EXECUTORS = { agy: 'CLI', pi: 'PI', codex: 'CLI' } as const;

/**
 * ⭐⭐ `JAN-MHX` MH-4, the check's fix (D30) — THE EXECUTOR ADAPTERS WIRED IN TEST MODE ONLY: built, and driven by the tests'
 * stand-ins, with no live turn of theirs yet passed. "Wired" means a host adapter exists AND WAS DRIVEN, and MH-0a drove
 * devin: in both of its calls devin 3000.11.92 offered its model tools of its own that the driver's configuration does not
 * remove (`ask_user_question`, `find_file_by_name`, `mcp_read_resource`, `skill`; MH-0a's F2), and the CLI executor
 * session fails such a turn `CLI_OWN_TOOL_RAN` and marks the workspace tainted, which nothing in this host clears yet. So
 * outside test mode a devin selection would spend an operator's devin call and leave its Undertaking refusing Begin &
 * Execute and re-run (`WORKSPACE_TAINTED`). Its tool joins `WIRED_EXECUTORS` once a live devin turn is confirmed (MH-9).
 * ⚠ The guidance and the unknown tool's reason list `WIRED_EXECUTORS` alone: they are the operator's, and an operator's
 * server, outside test mode, refuses these.
 */
const WIRED_IN_TEST_MODE_ONLY = { devin: 'CLI' } as const;

type WiredExecutor = keyof typeof WIRED_EXECUTORS | keyof typeof WIRED_IN_TEST_MODE_ONLY;

/**
 * Whether this host has an executor adapter wired for `toolId` in the mode it runs in — read off the two tables, so the
 * check and the guidance agree.
 */
const isWiredExecutor = (toolId: string, testMode: boolean): toolId is WiredExecutor =>
	Object.hasOwn(WIRED_EXECUTORS, toolId) ||
	(testMode && Object.hasOwn(WIRED_IN_TEST_MODE_ONLY, toolId));

/** What each wired tool's selection opens, in whichever mode it is wired. */
const OPENS: Readonly<Record<WiredExecutor, 'PI' | 'CLI'>> = {
	...WIRED_EXECUTORS,
	...WIRED_IN_TEST_MODE_ONLY
};

/** The wired executor tools as every refusal lists them — read off the table, once, for the guidance and the reason. */
const WIRED_TOOL_LIST = Object.keys(WIRED_EXECUTORS).join(', ');

/** ⭐ `JAN-MHX` MH-4, the check's fix — why each tool wired in test mode only is not wired outside it, for its refusal. */
const NOT_WIRED_OUTSIDE_TEST_MODE_BECAUSE: Readonly<
	Record<keyof typeof WIRED_IN_TEST_MODE_ONLY, string>
> = {
	devin:
		'devin 3000.11.92 offered its model tools of its own that the adapter’s configuration does not remove, in both ' +
		'probe calls that recorded its offer, and this host fails such a turn CLI_OWN_TOOL_RAN and marks the workspace ' +
		'tainted, after which Begin & Execute and a re-run refuse the Undertaking (WORKSPACE_TAINTED) and nothing in this ' +
		'host clears the mark. It is wired outside test mode once a live devin turn is confirmed (MH-9).'
};

/**
 * The refusal's reason for a tool wired in test mode only, outside it, or `undefined` for any other tool: the adapter
 * exists, so the reason says so, and why it does not run here.
 */
function testModeOnlyReason(toolId: string): string | undefined {
	if (!Object.hasOwn(WIRED_IN_TEST_MODE_ONLY, toolId)) return undefined;
	const because =
		NOT_WIRED_OUTSIDE_TEST_MODE_BECAUSE[toolId as keyof typeof WIRED_IN_TEST_MODE_ONLY];
	return (
		`The executing tool '${toolId}' (JPWB_EXECUTOR) declares the EXECUTION role, but its executor adapter is wired in ` +
		`test mode only (JAN-MHX D30): ${because}`
	);
}

/**
 * ⛔ THE CATALOG'S REFUSAL, WITH ITS LIST REPLACED BY THE WIRED ONE (`REG-F-460`'s general form). `selectBackingTool`
 * answers for every role, so its refusal of an unknown tool says "This host can drive: agy, pi, devin" (⭐ `JAN-MHX` MH-6:
 * ", codex" after it) — true of the
 * catalog, and for the executor it offered `devin`, which the next refusal (UNWIRED) forbade ~~until devin was wired~~ ⭐
 * and, outside test mode, still forbids (`JAN-MHX` MH-4, the check's fix: devin is wired in test mode only, D30): the
 * steer D1 removed from the guidance, back in the reason printed beside it (`JAN-SELRES` RS-1's verification). The
 * catalog's verdict and its `REG-D-052` sentence are kept as the catalog words them; only the list becomes the
 * executor's. ~~⭐ `JAN-MHX` MH-4 — devin is wired now (D30), so the two lists hold the same tools; the sentence is still
 * replaced, so the day the catalog declares a tool nobody wired, the reason does not offer it.~~
 * ⚠ KEYED ON THE CATALOG'S OWN SENTENCE, built from the list it is built from: were its wording to change, the list
 * would silently stay the catalog's — which `executor-selection.test.ts` reddens on, because the reason may not say
 * "This host can drive:".
 */
const CATALOG_LIST_SENTENCE = `This host can drive: ${KNOWN_TOOL_IDS.join(', ')}.`;
const WIRED_LIST_SENTENCE = `This host has an executor adapter for: ${WIRED_TOOL_LIST}.`;
const withTheWiredList = (catalogRefusal: string): string =>
	catalogRefusal.replace(CATALOG_LIST_SENTENCE, () => WIRED_LIST_SENTENCE);

/**
 * ⛔ D3 — THE VARIABLE THAT REPLACES EACH TOOL'S PROGRAM, for every EXECUTION tool whose adapter captures one. Keyed by
 * TOOL, not by wiring: `devin` was listed while it was unwired, so the day a devin executor was wired it inherited the
 * refusal rather than waiting for someone to remember it — ~~⭐ `JAN-MHX` MH-4 (D30), the day it was~~ ⭐ `JAN-MHX` MH-4,
 * the check's fix: devin is wired in test mode only, where an override is honoured, so the day it is wired outside test
 * mode (D30). Pi has none — it runs in-process, through its SDK — and what redirects it instead (`PI_CODING_AGENT_DIR`)
 * is disclosed, not refused (design D3).
 */
const PROGRAM_VARIABLE: Readonly<
	Record<string, { readonly variable: string; readonly captured: keyof ExecutorProgramOverrides }>
> = {
	agy: { variable: 'JPWB_AGY_BIN', captured: 'agy' },
	devin: { variable: 'JPWB_DEVIN_BIN', captured: 'devin' },
	// ⭐ `JAN-MHX` MH-3 (D34) — ~~not in the catalog yet, so nothing selects it; listed for devin's reason, above.~~ ⭐ MH-6 —
	// wired, so a selected Codex's captured override is refused outside test mode.
	codex: { variable: 'JPWB_CODEX_BIN', captured: 'codex' }
};

/**
 * What every refusal tells the operator (D1): the two variables, that neither has a default, the wired tools only, and
 * ASR-13's rule with the selected reviewer's model named.
 *
 * ⛔ THE WIRED TOOLS, NEVER THE CATALOG. `executorToolId()`'s refusal listed `agy, pi, devin` — the catalog — and so
 * steered an operator to `devin`, which the next refusal forbids. The list is derived from `WIRED_EXECUTORS`, the table
 * the selector dispatches on, so the two cannot disagree. ⚠ `JAN-MHX` MH-4, the check's fix — a tool wired in test mode
 * only (`WIRED_IN_TEST_MODE_ONLY`, devin) is selected there and not listed here, in either mode: this text is the
 * operator's, and an operator's server refuses it.
 *
 * ⚠ GUIDANCE, NEVER A FALLBACK. No code path reads the reviewer's model named here as a value (`REG-D-052`).
 */
export const EXECUTOR_GUIDANCE =
	`Set JPWB_EXECUTOR to the tool that executes work units — one this host has an executor adapter for: ` +
	`${WIRED_TOOL_LIST} — and JPWB_EXECUTOR_MODEL to the model that tool runs. Neither has ` +
	'a default: both are configuration, never pinned (REG-D-052), and the executor’s model never falls back to the ' +
	'reviewer’s. ⚠ Independence (ASR-13): the executor’s model may not be the reviewing model under any provider, ' +
	'spelling or effort variant — agy labels name an effort (“(High)”), and the independence check compares the model ' +
	'ids the tools report by exact string, so another spelling of the reviewer’s model would pass it falsely. The ' +
	'selected reviewer (REG-D-084) is devin with glm-5-3-flash-max, so the executor may not run a GLM-5.3 Flash model ' +
	'under any provider or spelling. This host refuses such a model before any work is dispatched, by its id or by its ' +
	'family, and refuses one its model-family table does not list.';

/**
 * ⭐⭐ `JAN-MHX` MH-3 (D31; the sponsor's answers of 2026-10-18, S1–S4) — THE SPONSOR'S MODEL FOR EACH EXECUTING TOOL, NAMED
 * IN THE GUIDANCE AND NEVER APPLIED.
 *
 * ⛔ NO CODE PATH READS ONE AS A VALUE. The sponsor's S1: the host fills in no default model, and the model stays
 * required (`REG-D-052`); a default the selector filled in would rot as a pinned label did (`REG-F-331`). A refusal of a
 * tool names its row, and `JPWB_EXECUTOR_MODEL` must still be set.
 * ⭑ devin's is S2's: a devin executor runs whichever of the sponsor's two devin models the reviewer does not, and the
 * selected reviewer runs glm-5-3-flash-max (`REG-D-084`). Muse's is the lead's choice, which S4 delegated: the catalog's
 * default, flagged for the sponsor. Pi has none: the sponsor named none.
 * ⭑ KEYED BY TOOL, as `PROGRAM_VARIABLE` is: ~~Codex,~~ Claude Code and Muse are not in the catalog yet (⭐ `JAN-MHX` MH-6:
 * Codex is).
 */
const EXECUTOR_DEFAULT_MODELS: Readonly<
	Record<string, { readonly modelId: string; readonly effort?: string; readonly because?: string }>
> = {
	agy: { modelId: 'gemini-4-argon-high' },
	devin: {
		modelId: 'deepseek-v4-1-flash-max',
		because:
			'the one of glm-5-3-flash-max and deepseek-v4-1-flash-max that the reviewer does not run, beside the selected ' +
			'reviewer’s glm-5-3-flash-max'
	},
	codex: { modelId: 'gpt-5.6-sol', effort: 'high' },
	claude: { modelId: 'claude-opus-5-5', effort: 'max' },
	muse: {
		modelId: 'muse-wonder-1.0',
		effort: 'high',
		because:
			'the lead’s choice, which the sponsor delegated: the catalog’s default, for the sponsor to confirm'
	}
};

/**
 * What a refusal of `toolId` tells the operator: the shared guidance, then the sponsor's model for the chosen tool, when
 * there is one, said to be unapplied (D31). ⚠ `Object.hasOwn`, because the tool id is the operator's string.
 */
function guidanceFor(toolId: string | undefined): string {
	if (toolId === undefined || !Object.hasOwn(EXECUTOR_DEFAULT_MODELS, toolId))
		return EXECUTOR_GUIDANCE;
	const { modelId, effort, because } = EXECUTOR_DEFAULT_MODELS[toolId]!;
	return (
		`${EXECUTOR_GUIDANCE} The sponsor’s choice of model for ${toolId} is ${modelId}` +
		`${effort === undefined ? '' : `, at ${effort} effort`}${because === undefined ? '' : ` (${because})`}: ` +
		'named here and never applied — this host fills in no model, so JPWB_EXECUTOR_MODEL must still be set' +
		`${effort === undefined ? '' : ', and JPWB_EXECUTOR_EFFORT with it'} (REG-D-052).`
	);
}

const refused = (
	code: ExecutorRefusalCode,
	toolId: string | undefined,
	reason: string
): ExecutorSelection => ({ kind: 'REFUSED', code, toolId, reason, guidance: guidanceFor(toolId) });

/**
 * ⭐ `JAN-MHX` MH-3 (D32) — HOW EACH EXECUTING TOOL TAKES ITS EFFORT, and so what `JPWB_EXECUTOR_EFFORT` must be.
 *   · `REQUIRED` — the tool takes it as a flag of its own (Codex, Claude Code, Muse). Unset, the tool's own user
 *     configuration would decide it, and nobody would have chosen it.
 *   · `NOT_TAKEN` — the host hands the tool none: devin's and agy's model ids name their effort (`-max`, `-high`), and Pi
 *     runs with thinking off. Set, the variable would be read by nothing while it looked as though it took effect.
 * ⭑ KEYED BY TOOL, NOT BY WIRING, as `PROGRAM_VARIABLE` is, and THE TYPE HOLDS EVERY WIRED TOOL TO A ROW: a tool cannot be
 * wired without saying how it takes its effort.
 */
const EFFORT_RULE: Readonly<
	Record<
		WiredExecutor | 'devin' | 'codex' | 'claude' | 'muse',
		{ readonly taken: 'REQUIRED' } | { readonly taken: 'NOT_TAKEN'; readonly because: string }
	>
> = {
	agy: { taken: 'NOT_TAKEN', because: 'its model ids name their effort (-high, -max)' },
	devin: { taken: 'NOT_TAKEN', because: 'its model ids name their effort (-high, -max)' },
	pi: { taken: 'NOT_TAKEN', because: 'Pi runs with thinking off' },
	codex: { taken: 'REQUIRED' },
	claude: { taken: 'REQUIRED' },
	muse: { taken: 'REQUIRED' }
};

/**
 * ⭐ `JAN-MHX` MH-3 (D32) — the refusal of the effort `toolId` was configured with, or `undefined` when there is none.
 * ⚠ EXPORTED FOR ITS TEST, AND THE REASON IS A REACH: ~~no wired tool REQUIRES an effort yet, so through `selectExecutor`
 * only the not-taken arm can be driven, and the required arm would be a guard no test could fail~~ ⭐ `JAN-MHX` MH-6 —
 * Codex, wired, requires one, so both arms are driven through `selectExecutor` too; Claude Code's and Muse's rows, unwired,
 * only through this — `selectBackingTool`'s injectable catalog, for the same reason.
 */
export function executorEffortRefusal(
	toolId: keyof typeof EFFORT_RULE,
	effort: string | undefined
): ExecutorSelection | undefined {
	const rule = EFFORT_RULE[toolId];
	if (rule.taken === 'REQUIRED')
		return effort !== undefined
			? undefined
			: refused(
					'EXECUTOR_EFFORT_UNSET',
					toolId,
					`The executing tool '${toolId}' takes its effort as a flag of its own, and JPWB_EXECUTOR_EFFORT is not set: ` +
						'unset, the tool’s own user configuration would decide it, and nobody would have chosen it. The effort ' +
						'is configuration, as the model is.'
				);
	return effort === undefined
		? undefined
		: refused(
				'EXECUTOR_EFFORT_NOT_TAKEN',
				toolId,
				`The executing tool '${toolId}' is handed no effort by this host, and JPWB_EXECUTOR_EFFORT=` +
					`${JSON.stringify(effort)} is set: ${rule.because}, so nothing would read the variable while it looked ` +
					'as though it took effect. Unset it.'
			);
}

/**
 * ⭐⭐ `JAN-MHX` MH-3 (D33) — THE MODEL FAMILIES THE INDEPENDENCE REFUSAL COMPARES, each id as a tool's own listing spells it.
 *
 * ⛔ A DECLARATION FROM MEASURED LISTINGS, NOT A NORMALISER OVER MODEL NAMES. An id is placed only where a listing placed
 * it, and matched whole: a new effort level or a dated suffix of the reviewer's model is unlisted, and refused, rather
 * than passed by an exact compare that cannot see it is the same model. Each family says where its ids came from:
 *   · `devin models list` — devin 3000.11.92, 2026-10-18: its own families, slugs and labels;
 *   · `agy models` — agy 1.4.2, 2026-10-18: slugs and labels;
 *   · `codex debug models` — Codex 0.162.1, 2026-10-18: slug and display name;
 *   · Claude Code's id, FROM ITS DOCUMENTATION, no listing having been run;
 *   · Pi's, AS P3 CONFIGURED IT (`JPWB_EXECUTOR_MODEL`), a model the Phase 7 lane ran, not a listing.
 * ⭑ FIVE FAMILIES: the design's four, and DeepSeek V4.1 Flash, the model the sponsor chose for a devin executor (S2).
 * ⚠ devin lists GLM-5.3, without "Flash", as a family of its own. It is not here, so it is refused as unlisted, never
 * compared as another model.
 */
const MODEL_FAMILIES: Readonly<Record<string, readonly string[]>> = {
	'GLM-5.3 Flash': [
		// `devin models list`
		'glm-5-3-flash-low',
		'glm-5-3-flash-high',
		'glm-5-3-flash-max',
		'GLM-5.3 Flash Low',
		'GLM-5.3 Flash High',
		'GLM-5.3 Flash Max'
	],
	'Gemini 4 Argon': [
		// `devin models list` and `agy models`: the same three slugs
		'gemini-4-argon-low',
		'gemini-4-argon-medium',
		'gemini-4-argon-high',
		// `devin models list`
		'Gemini 4 Argon Low',
		'Gemini 4 Argon Medium',
		'Gemini 4 Argon High',
		// `agy models`
		'Gemini 4 Argon (Low)',
		'Gemini 4 Argon (Medium)',
		'Gemini 4 Argon (High)'
	],
	'GPT-5.6 Sol': [
		// `codex debug models`
		'gpt-5.6-sol',
		'GPT-5.6-Sol',
		// Pi, as P3 configured it
		'openai-codex/gpt-5.6-sol',
		// `devin models list`
		'gpt-5-6-sol-none',
		'gpt-5-6-sol-low',
		'gpt-5-6-sol-medium',
		'gpt-5-6-sol-high',
		'gpt-5-6-sol-xhigh',
		'gpt-5-6-sol-max',
		'gpt-5-6-sol-none-priority',
		'gpt-5-6-sol-low-priority',
		'gpt-5-6-sol-medium-priority',
		'gpt-5-6-sol-high-priority',
		'gpt-5-6-sol-xhigh-priority',
		'gpt-5-6-sol-max-priority',
		'GPT-5.6 Sol No Thinking',
		'GPT-5.6 Sol Low Thinking',
		'GPT-5.6 Sol Medium Thinking',
		'GPT-5.6 Sol High Thinking',
		'GPT-5.6 Sol XHigh Thinking',
		'GPT-5.6 Sol Max Thinking',
		'GPT-5.6 Sol No Thinking Fast',
		'GPT-5.6 Sol Low Thinking Fast',
		'GPT-5.6 Sol Medium Thinking Fast',
		'GPT-5.6 Sol High Thinking Fast',
		'GPT-5.6 Sol XHigh Thinking Fast',
		'GPT-5.6 Sol Max Thinking Fast'
	],
	'Claude Opus 5.5': [
		// Claude Code, from its documentation
		'claude-opus-5-5',
		// `devin models list` (the first three are `agy models`' slugs too)
		'claude-opus-5-5-low',
		'claude-opus-5-5-medium',
		'claude-opus-5-5-high',
		'claude-opus-5-5-xhigh',
		'claude-opus-5-5-max',
		'claude-opus-5-5-low-fast',
		'claude-opus-5-5-medium-fast',
		'claude-opus-5-5-high-fast',
		'claude-opus-5-5-xhigh-fast',
		'claude-opus-5-5-max-fast',
		'Claude Opus 5.5 Low',
		'Claude Opus 5.5 Medium',
		'Claude Opus 5.5 High',
		'Claude Opus 5.5 XHigh',
		'Claude Opus 5.5 Max',
		'Claude Opus 5.5 Low Fast',
		'Claude Opus 5.5 Medium Fast',
		'Claude Opus 5.5 High Fast',
		'Claude Opus 5.5 XHigh Fast',
		'Claude Opus 5.5 Max Fast',
		// `agy models`
		'Claude Opus 5.5 (Low)',
		'Claude Opus 5.5 (Medium)',
		'Claude Opus 5.5 (High)'
	],
	'DeepSeek V4.1 Flash': [
		// `devin models list`
		'deepseek-v4-1-flash-high',
		'deepseek-v4-1-flash-max',
		'DeepSeek V4.1 Flash High',
		'DeepSeek V4.1 Flash Max'
	]
};

/** The family a listing placed `modelId` in, or `undefined` when none did. */
const familyOf = (modelId: string): string | undefined =>
	Object.keys(MODEL_FAMILIES).find((family) => MODEL_FAMILIES[family]!.includes(modelId));

/**
 * ⭐⭐ `JAN-MHX` MH-3 (D33) — the refusal of the executor's model beside the reviewer's, or `undefined` when none is owed.
 *
 * ⭑ IN THIS ORDER. The reviewer's own id is the reviewer's model whether or not the table lists it. Then an id the table
 * does not list, on either side, is refused, since it cannot be compared. Then one family is the reviewer's model.
 * ⚠ ASKED ONLY BESIDE A REAL REVIEWER, the one the same request's preflight admitted: the stand-in and a replay name no
 * model, so there is nothing to compare.
 */
function independenceRefusal(
	toolId: string,
	modelId: string,
	reviewer: { readonly toolId: string; readonly modelId: string }
): ExecutorSelection | undefined {
	if (modelId === reviewer.modelId)
		return refused(
			'EXECUTOR_MODEL_IS_THE_REVIEWERS',
			toolId,
			`The executing tool '${toolId}' would run ${modelId}, the model the reviewer (${reviewer.toolId}) runs: the work ` +
				'would be reviewed by the model that produced it, and the floor’s DIFFERENT_MODEL check would refuse that ' +
				'review only after the paid work (ASR-13). Choose an executor model of another family.'
		);
	const executorFamily = familyOf(modelId);
	const reviewerFamily = familyOf(reviewer.modelId);
	if (executorFamily === undefined || reviewerFamily === undefined) {
		const unlisted = [
			...(executorFamily === undefined ? [modelId] : []),
			...(reviewerFamily === undefined ? [reviewer.modelId] : [])
		];
		return refused(
			'EXECUTOR_MODEL_UNCLASSIFIED',
			toolId,
			`The executing tool '${toolId}' would run ${modelId}, and the reviewer (${reviewer.toolId}) runs ` +
				`${reviewer.modelId}, but this host’s model-family table does not list ` +
				`${unlisted.map((m) => `'${m}'`).join(' or ')}: it cannot tell whether the two are one model under another ` +
				'spelling or effort, which the floor’s exact compare would pass falsely (ASR-13). A model runs beside a real ' +
				'reviewer only once the table lists it, from a measured listing (devin models list, agy models, codex debug ' +
				'models).'
		);
	}
	if (executorFamily === reviewerFamily)
		return refused(
			'EXECUTOR_MODEL_IS_THE_REVIEWERS',
			toolId,
			`The executing tool '${toolId}' would run ${modelId}, and the reviewer (${reviewer.toolId}) runs ` +
				`${reviewer.modelId}: both are ${executorFamily} models, another spelling or effort of one model. The floor’s ` +
				'independence check compares model ids by exact string, so it would pass the two as different, falsely ' +
				'(ASR-13). Choose an executor model of another family.'
		);
	return undefined;
}

/**
 * ⛔ D3 (`REG-F-459`, remedy (a)) — the refusal of a replaced executor program. The adapter records every call as the
 * real tool's whatever program it ran, so outside test mode no override of the selected tool's program is allowed — not
 * even an empty one, which the adapter would run as an empty program name. `JAN-SELREV` D7, applied to the executor.
 */
const programOverridden = (toolId: string, variable: string, program: string): ExecutorSelection =>
	refused(
		'EXECUTOR_PROGRAM_OVERRIDDEN',
		toolId,
		`The executing tool '${toolId}' would run a replaced program: ${variable}=${JSON.stringify(program)} was set when ` +
			`the server started, and it replaces the product’s own '${toolId}' program. Outside test mode a program ` +
			`override is refused, even when it is empty — the work would be recorded as ${toolId}'s, whatever the ` +
			`replacement is (REG-F-459). Unset ${variable} and restart the server: the adapter reads it once, when it loads.`
	);

/**
 * The refusal of the SELECTED tool's own captured override, or `undefined` when there is none to refuse.
 *
 * ⭑ ONLY THE SELECTED TOOL'S: another adapter's program never runs this work, so its override refuses nothing — a set
 * `JPWB_AGY_BIN` does not refuse a Pi executor. ⭑ HONOURED IN TEST MODE, where an override is the tests' own.
 */
function selectedProgramOverridden(
	toolId: WiredExecutor,
	testMode: boolean,
	overrides: ExecutorProgramOverrides
): ExecutorSelection | undefined {
	if (testMode) return undefined;
	const program = PROGRAM_VARIABLE[toolId];
	if (program === undefined) return undefined;
	const captured = overrides[program.captured];
	return captured === undefined ? undefined : programOverridden(toolId, program.variable, captured);
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE REPLAY SWITCH'S ANSWER,
 * or `undefined` when `JPWB_REPLAY` is unset. Asked FIRST, before the tool, because each refusal below is about the
 * switch: outside test mode it is refused whatever tool is named (a replay asked for in a deployed host must not run the
 * real executor instead), and in test mode it is refused beside ~~a named tool~~ ⭐ any live-backend selection — the
 * authoring agent, a model, a program override included (`REG-D-112` (c); `liveSelectionsBesideReplay`) — since none may
 * silently win, and one that did would be a paid call.
 */
function replaySelection(
	env: ExecutorEnvironment,
	testMode: boolean,
	toolId: string | undefined,
	overrides: ExecutorProgramOverrides
): ExecutorSelection | undefined {
	const recordingDir = resolveReplayRecording(env[REPLAY_VARIABLE]);
	if (recordingDir === undefined) return undefined;
	if (!testMode)
		return refused(
			'EXECUTOR_REPLAY_OUTSIDE_TEST_MODE',
			toolId,
			`${REPLAY_VARIABLE} is set, and a replay is honoured in test mode only: outside it the executor would answer from ` +
				'a recording while the record named a model that ran. Unset it, or run in test mode (REG-D-111 (5)).'
		);
	const beside = liveSelectionsBesideReplay(env, overrides);
	if (beside.length > 0)
		return refused('EXECUTOR_REPLAY_BESIDE_A_LIVE_SELECTION', toolId, besideReplayReason(beside));
	return { kind: 'REPLAY', recordingDir };
}

/**
 * Which executor runs.
 *
 * ⭐ `JAN-EXEC` Phase 8 — ASKED FIRST: `JPWB_REPLAY` (`replaySelection`, above): REPLAY in test mode with no live backend
 * selected beside it, else `EXECUTOR_REPLAY_OUTSIDE_TEST_MODE` or ⭐ `EXECUTOR_REPLAY_BESIDE_A_LIVE_SELECTION`
 * (`REG-D-112` (c)). Unset, the table below is unchanged.
 *
 * ⭑ THE TABLE (D1, D3), in the order it is asked:
 *   1. `EXECUTOR_TOOL_UNSET` — `JPWB_EXECUTOR` absent, `''` or whitespace OUTSIDE test mode. In test mode: the STAND-IN.
 *   2. `EXECUTOR_TOOL_UNKNOWN` — `selectBackingTool(tool, 'EXECUTION')` refuses it: a tool the catalog does not know
 *      (matched exactly, after the trim), or one that does not declare EXECUTION.
 *   3. `EXECUTOR_TOOL_UNWIRED` — a catalogued EXECUTION tool with no executor adapter (~~`devin` today~~ ~~⭐ none today:
 *      `JAN-MHX` MH-4 wired devin, the last, D30~~) ⭐ wired for the mode the host runs in: outside test mode, `devin`,
 *      whose adapter is wired in test mode only, with a reason that says so (`JAN-MHX` MH-4, the check's fix; D30).
 *   4. `EXECUTOR_PROGRAM_OVERRIDDEN` — outside test mode, the SELECTED tool's captured program override, even `''`,
 *      before its model is asked about: the program is refused whatever model it would run.
 *   5. `EXECUTOR_MODEL_UNSET` — `JPWB_EXECUTOR_MODEL` absent, `''` or whitespace, for every wired tool alike. It never falls
 *      back to `JPWB_JUDGE_MODEL`, and says so. ⭐ `JAN-MHX` MH-3 (D31): nor to the sponsor's default for the tool, which
 *      the guidance names (`EXECUTOR_DEFAULT_MODELS`).
 *   6. ⭐ `JAN-MHX` MH-3 (D32) — `EXECUTOR_EFFORT_NOT_TAKEN` / `EXECUTOR_EFFORT_UNSET` — `JPWB_EXECUTOR_EFFORT` (trimmed,
 *      blank unset) set for a tool the host hands no effort, or unset for one that takes it (`EFFORT_RULE`).
 *   7. ⭐ `JAN-MHX` MH-3 (D33) — `EXECUTOR_MODEL_IS_THE_REVIEWERS` / `EXECUTOR_MODEL_UNCLASSIFIED` — only when `reviewer`
 *      names the real reviewer the request's preflight admitted: the executor's model is the reviewer's, by id or by
 *      family, or an id the family table does not place (`independenceRefusal`). In either mode: the rule keys on the
 *      reviewer, and with the stand-in or a replay there is none.
 *
 * ⛔ IT NEVER THROWS FOR ITS DECLARED INPUT. Every misconfiguration is an answer the caller can SHOW before dispatch —
 * the reviewer selector's rule (`REG-F-457` G3), for the same reason. ⚠ "Declared" is load-bearing: the environment's
 * values are strings, as `process.env`'s can only be. A value of another type in a hand-built record reaches the
 * resolvers' `trim` and throws there — as it does in `selectReviewer` — and is not coerced, because no caller can
 * produce one and the two selectors answer the same input the same way (`JAN-SELRES` RS-1's verification).
 *
 * ⚠ WHAT IT CANNOT SEE, DISCLOSED: whether Pi can RESOLVE the model it names. That needs Pi's SDK, which ~~the gate never
 * loads~~ ⭐ this module does not load, so an unresolvable Pi model is still refused when the executor opens — after
 * dispatch (design D4).
 */
export function selectExecutor(input: {
	readonly testMode: boolean;
	readonly env?: ExecutorEnvironment;
	/** What the adapters captured when they loaded, unless a test hands in its own — as it may the environment. */
	readonly overrides?: ExecutorProgramOverrides;
	/**
	 * ⭐ `JAN-MHX` MH-3 (D33) — the real reviewer the same request's preflight admitted (`assurancePreflight`'s `reviewer`),
	 * whose model the executor's is compared with. Absent for the stand-in and for a replay: nothing is compared.
	 */
	readonly reviewer?: { readonly toolId: string; readonly modelId: string };
}): ExecutorSelection {
	const env = input.env ?? process.env;
	// ⛔ `?? ''` MAKES THE ENVIRONMENT HANDED IN THE WHOLE INPUT. Both resolvers default their parameter to the
	// PROCESS's variable when given `undefined`, so an explicit environment naming no tool, or a tool and no model,
	// would take them from the process — a second read, which is how two answers come to disagree. `''` is unset to both.
	const toolId = resolveExecutorToolId(env.JPWB_EXECUTOR ?? '');
	const overrides = input.overrides ?? {
		agy: AGY_BIN_OVERRIDE,
		devin: DEVIN_BIN_OVERRIDE,
		codex: CODEX_BIN_OVERRIDE
	};
	const replay = replaySelection(env, input.testMode, toolId, overrides);
	if (replay) return replay;
	if (toolId === undefined)
		return input.testMode
			? { kind: 'STAND_IN' }
			: refused(
					'EXECUTOR_TOOL_UNSET',
					undefined,
					'JPWB_EXECUTOR is not set, and there is no application default: the tool that executes work units ' +
						'is a deployment choice and must be configured explicitly.'
				);
	try {
		selectBackingTool(toolId, 'EXECUTION');
	} catch (e) {
		const catalogRefusal = e instanceof Error ? e.message : String(e);
		return refused(
			'EXECUTOR_TOOL_UNKNOWN',
			toolId,
			`The executing tool '${toolId}' (JPWB_EXECUTOR) is refused: ${withTheWiredList(catalogRefusal)}`
		);
	}
	if (!isWiredExecutor(toolId, input.testMode))
		return refused(
			'EXECUTOR_TOOL_UNWIRED',
			toolId,
			testModeOnlyReason(toolId) ??
				`The executing tool '${toolId}' (JPWB_EXECUTOR) declares the EXECUTION role, but no executor adapter is ` +
					'wired for it on this host.'
		);
	const overridden = selectedProgramOverridden(toolId, input.testMode, overrides);
	if (overridden) return overridden;
	const modelId = resolveExecutorModel(env.JPWB_EXECUTOR_MODEL ?? '');
	if (modelId === undefined)
		return refused(
			'EXECUTOR_MODEL_UNSET',
			toolId,
			`The executing tool '${toolId}' has no model: JPWB_EXECUTOR_MODEL is not set, and there is no application ` +
				'default — the model is configured, never pinned (REG-D-052; REG-F-331: a pinned label rotted and every ' +
				'review failed). ⛔ It deliberately does NOT fall back to JPWB_JUDGE_MODEL: that fallback is exactly the ' +
				'producer/reviewer collision the executor’s own configuration exists to remove.'
		);
	// ⭐ `JAN-MHX` MH-3 (D32) — the effort, read as every variable here is: trimmed, and blank is unset. ⭐ MH-6 — READ ONCE:
	// the refusal asks it, and a CLI selection carries the same value to its driver.
	const effort = env.JPWB_EXECUTOR_EFFORT?.trim() || undefined;
	const effortRefused = executorEffortRefusal(toolId, effort);
	if (effortRefused) return effortRefused;
	// ⭐ `JAN-MHX` MH-3 (D33) — then the model beside the reviewer's, when a real one was admitted.
	const dependent =
		input.reviewer === undefined ? undefined : independenceRefusal(toolId, modelId, input.reviewer);
	if (dependent) return dependent;
	return wiredSelection(toolId, modelId, effort);
}

/**
 * What a wired tool's selection opens, with its model. ⭐ `JAN-MHX` MH-6 (D30, D32) — A CLI EXECUTOR CARRIES ITS TOOL, which
 * names its driver, and the effort the driver hands the CLI: without it, the CLI's own user configuration would choose one.
 * ⭐ `JAN-MHX` MH-4 — read off `OPENS`, so a tool wired in test mode only (devin) opens what it is wired to there.
 */
function wiredSelection(
	toolId: WiredExecutor,
	modelId: string,
	effort: string | undefined
): RunnableExecutorSelection {
	const kind = OPENS[toolId];
	// ⭐ `JAN-MHX` MH-4 (D30) — a CLI selection names its tool, which finds its driver (`tools/cli-executor-drivers.ts`).
	if (kind === 'CLI') return { kind, toolId, modelId, ...(effort === undefined ? {} : { effort }) };
	return { kind, modelId };
}

/**
 * ⭐ D4 — THE RECORD'S FALLBACK IDENTITY, FROM THE SAME SELECTION THAT OPENED THE EXECUTOR.
 *
 * ⚠ USED ONLY WHEN THE TOOL REPORTS NO IDENTITY OF ITS OWN — which for ~~agy (a bare string)~~ the stand-in is every call,
 * graded `HOST_CONFIGURED`; ⭐ `JAN-MHX` MH-5: agy's CLI session reports its producer on every turn it takes, so for agy
 * this is a turn that threw. It used to be `resolveExecutorModel()`/`resolveExecutorToolId()`, read again per try: a second
 * read of what the selection already answered, and with the agy executor running the JUDGE model it named a model that
 * never ran (`REG-F-458`). ⭑ The provider is the TOOL — the provider proper is embedded in the model label and only the
 * tool can resolve it — and the stand-in names neither, because no configured model produced its answer.
 */
export function executorRecordIdentity(selection: RunnableExecutorSelection): {
	readonly modelId: string;
	readonly providerId: string;
} {
	// ⭐ `JAN-EXEC` Phase 8 — AND THE REPLAY NAMES NEITHER: no configured model produces a replayed answer. The replay reports
	// the RECORDED producer itself, graded HOST_CONFIGURED (`replay/replay-executor.ts`); this is only a thrown turn's.
	if (selection.kind === 'STAND_IN' || selection.kind === 'REPLAY')
		return { modelId: 'unresolved', providerId: 'unresolved' };
	// ⭐ `JAN-MHX` MH-1 (D30, D35) — A CLI EXECUTOR NAMES ITS OWN TOOL, as the devin reviewer names `devin`: without this arm
	// it would be recorded as `pi`.
	if (selection.kind === 'CLI') return { modelId: selection.modelId, providerId: selection.toolId };
	// ~~`selection.kind === 'AGY' ? 'agy' : 'pi'`~~ ⭐ `JAN-MHX` MH-5 — the `AGY` kind is retired, so the one left is Pi.
	return { modelId: selection.modelId, providerId: 'pi' };
}

/** The whole refusal as one sentence pair — what `beginExecute` returns before dispatch. */
export function executorRefusalMessage(
	selection: Extract<ExecutorSelection, { kind: 'REFUSED' }>
): string {
	return `${selection.reason} ${selection.guidance}`;
}
