// JAN-TOOLSUITE TS-07 — the Devin ASSURANCE adapter: the tool that reviews a work product.
//
// ⭑ IT EXISTS SO THE REVIEWER CAN BE A DIFFERENT VENDOR FROM THE PRODUCER. With one tool serving both roles,
// `checkIndependence('DIFFERENT_MODEL', …)` compared a string with itself and could only refuse — the state
// `REG-F-356` recorded. Producer on Pi (`openai-codex`) and reviewer on Devin (`glm-5-2`) differ on RECORDED
// evidence, which is the first time that has been true on this path.
//
// ⚠ EVERY FLAG BELOW WAS MEASURED BY DRIVING `devin 3000.6.14`, not read from documentation.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';
import { answerFromText } from './backing-tool.js';
import type { AdapterToolObservation, ToolInvocationResult } from './backing-tool.js';
import { FINISH_REASON_SHAPE, OutputLimitReached, type OutputLimitFacts } from './output-limit.js';
// ⭐⭐ Package X — D34 (`REG-F-590`) — the class a call killed during its run is thrown as, with what the kill left.
import { SIGNAL_SHAPE, ToolCallKilled, type KilledCallFacts } from './killed-call.js';
// ⭐ Z3 — D46 — the refusals a call was waited out through, carried on its answer or on the failure it throws.
import {
	FREE_TIER_REFUSALS_OPENING,
	freeTierRefusalsFigures,
	freeTierRefusalsOf,
	withFreeTierRefusals,
	type FreeTierRefusals
} from './free-tier-refusals.js';
export { freeTierRefusalsOf, type FreeTierRefusals };

const run = promisify(execFile);

/**
 * ⭐ `JAN-SELREV` SR-2 (D7) — the program override this module CAPTURED when it loaded: `undefined` when
 * `JPWB_DEVIN_BIN` was unset, `''` when it was set empty. Exported so the reviewer selector refuses what this module
 * will actually run: outside test mode a set override refuses a devin review, because a replacement's reviews would be
 * recorded as devin's (`REG-F-441`). ⚠ Still honoured here: in test mode the override is the tests' to use.
 */
export const DEVIN_BIN_OVERRIDE: string | undefined = process.env.JPWB_DEVIN_BIN;

const DEVIN_BIN = DEVIN_BIN_OVERRIDE ?? 'devin';

/**
 * The reviewing model. ⛔ Configured, never pinned (`REG-D-052`); absence is a refusal (`REG-F-331`).
 */
export function resolveAssuranceModel(
	configured = process.env.JPWB_ASSURANCE_MODEL
): string | undefined {
	const trimmed = configured?.trim();
	return trimmed ? trimmed : undefined;
}

export function assuranceModel(): string {
	const model = resolveAssuranceModel();
	if (!model)
		throw new Error(
			'JPWB_ASSURANCE_MODEL is not set, and there is no application default: the reviewing model is ' +
				'selected on assurance-quality grounds and must be configured explicitly (REG-D-052). ' +
				'Run `devin models list` to see what this account offers. ' +
				'⚠ It must differ from JPWB_EXECUTOR_MODEL, or the reasoning review is refused for ' +
				'non-independence (ASR-13) — which is the check working, not a fault.'
		);
	return model;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 P7-6 I4 (`DESIGN-the-reviewer-isolated.md` §4b; `REG-D-104` (2)) — THE REVIEWER IS TOLD IT HAS
 * NO TOOLS, before every prompt `devinPrint` writes.
 *
 * ⛔ WHY (`REG-F-549`, probe 2 of design §4a): given a work product, GLM under devin set out to verify it with tools, and in
 * print mode a tool call that is not approved ENDS the session — the reply is whatever was written before it (*"I'll
 * verif…"*), or nothing. Isolation alone (I1) cannot make it answer. The sponsor chose "Prompt + isolate, test first";
 * the test replayed the measured run's four work-product reviews behind THESE BYTES (design §4c, 4 paid calls): no try
 * called a tool, and three of the four concluded.
 * ⚠ SO THE BYTES ARE THE MEASURED ONES, LINE BREAKS INCLUDED, AND `devin-reviewer.test.ts` PINS THEM to the replay's own
 * prompt files, read back: 355 bytes — the three lines joined by `\n`, then `\n\n---\n`, and the prompt begins on the very
 * next line. A change to them is a change to what was tested, and to what the reviewer reads: it MOVES THE REVIEWER
 * FINGERPRINT (`scripts/reviewer-qual/fingerprint.ts` hashes it, its `devinPreamble` seam), so `reviewer:qual:check` then
 * refuses until the selected reviewer is re-qualified behind the new text.
 * ⛔ CORRECTED (`P76F-A`, 2026-10-10): the first build ended this `\n\n---\n\n` — one line break more than the replay sent —
 * from a build note, and its test pinned the note's bytes, so "the measured ones" was false here until this fix. Read
 * against the replay's eight prompt files, the 355 bytes are identical in all eight.
 * ⭑ devin's ONLY: the agy transport is not changed (design §4b), and nothing here reaches agy's prompt.
 */
export const DEVIN_REVIEWER_PREAMBLE =
	'You are answering as a reviewer that has NO TOOLS. You cannot read files, list folders, run commands or fetch anything,\n' +
	'and you must not try: any tool call ends this session without an answer. Everything you may judge is in the text below.\n' +
	'Judge only that text, and reply with the single JSON object the instructions below ask for, and nothing else.\n' +
	'\n' +
	'---\n';

/**
 * ⭐⭐ P7-6 I1 (design §2; `REG-F-548`) — THE PROJECT CONFIG THE REVIEWER'S OWN FOLDER HOLDS, `.devin/config.json`: every
 * tool denied by name — `read`, `edit`, `grep`, `glob`, `exec`, then `Fetch(*)` and `mcp__*`. devin's permission rules
 * check deny first, and a deny always wins.
 * ⭐ DRIVEN, NOT READ: devin's documentation does not say whether deny rules hold in `--print` mode, so design §4a's probe 1
 * (one paid call, 2026-10-10, devin 3000.11.3) asked the isolated reviewer to list its folder and read two planted files.
 * It called `exec` and `read`; devin answered *"Permission denied for this tool by a deny rule in the project settings"*,
 * and neither file's token reached the session (`REG-F-548`'s pointer). ⚠ The rules hold; they do not make the reviewer
 * ANSWER — a denied call still ends the session (`REG-F-549`), which is what the preamble above is for.
 * ⭐ WRITTEN AS THE PAID REPLAY WROTE IT (design §4c; `P76F-A`): `JSON.stringify` of the object, two-space indented, and a
 * closing line break — 150 bytes, identical in all four of the replay's folders, and pinned so by `devin-reviewer.test.ts`.
 * ⛔ IT WAS WRITTEN MINIFIED, and that file is not the one devin read when the replay passed the sponsor's gate. The same
 * JSON to a parser, and very likely to devin's — but "very likely" is a reading nobody drove, so what ships is what was
 * measured.
 */
const DENY_ALL_TOOLS_CONFIG = `${JSON.stringify(
	{ permissions: { deny: ['read', 'edit', 'grep', 'glob', 'exec', 'Fetch(*)', 'mcp__*'] } },
	null,
	2
)}\n`;

/**
 * ⭐ R11 — WHAT THIS ADAPTER CAN SEE OF TOOL CALLS: nothing, said in its own words on a call devin exited 0 from whose
 * export named a model, and (P5 package A) on one whose reply devin ended at the output-token limit
 * (`OutputLimitReached`). ⚠ ONLY THERE: an exit 0 whose export names no model is returned as the bare stdout, and every
 * other failure is thrown without it.
 */
const DEVIN_TOOL_OBSERVATION: Extract<AdapterToolObservation, { readonly canObserve: false }> = {
	canObserve: false,
	reason:
		'The devin adapter runs `devin --print` to completion and reads its stdout and ATIF export. It ' +
		'mints no tool surface and watches no session, so it is not in a position to observe tool ' +
		'calls at all — neither its own (it has none) nor any the tool made internally. A reader must ' +
		'not read this record as evidence that no command ran.'
};

/**
 * ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — DEVIN'S OWN SENTENCE FOR A REPLY IT ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT, on
 * stderr after a non-zero exit. In P5's seven such records, verbatim: *"warning: response truncated (model hit max output
 * token limit)"*, then *"Error: Response truncated: model hit max output token limit. The output above is incomplete."*
 */
export const DEVIN_OUTPUT_LIMIT = 'Response truncated: model hit max output token limit';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package Z3 — D46 (`REG-D-145`; design §11.7: *"`devinPrint` recognises "free model rate limit", waits 45 s
 * and makes the same call again, at most three times. Such a refusal did not reach the model. It is no reviewer call and no
 * exchange. State the refusal count in the eventual exchange's tool observation. A fourth refusal fails the call as today."*) —
 * DEVIN'S FREE-TIER REFUSAL: the phrase it fails with (met 6 times by three concurrent lanes, 2026-11-01), the wait, and how many
 * times the same call is made again.
 */
export const DEVIN_FREE_TIER_REFUSAL = 'free model rate limit';
export const DEVIN_FREE_TIER_WAIT_MS = 45_000;
export const DEVIN_FREE_TIER_RETRIES = 3;

/**
 * ⭐ D46 — whether a failed devin call is the free tier's refusal: the phrase, in the failure's MESSAGE — where `execFile` puts what
 * devin wrote to stderr (`Command failed: devin --print …\n<stderr>`). All six refusals the 2026-11-01 screens met read so:
 * `Error: Agent error: Reached free model rate limit. …` after the command line.
 * ~~in its message or in what it printed~~ ⛔ MOVED 2026-11-07 (Z3): never `stderr` itself, since binding it opens the retention
 * surface `REG-Q-066` gates (`verif/agy-stderr-unbound.test.ts`, which found it). And never stdout: a reply cut short can quote the
 * phrase (a review of this very adapter would), and that call reached the model, so waiting it out would pay for it again.
 */
function isFreeTierRefusal(e: unknown): boolean {
	const message = (e as { message?: unknown } | null)?.message;
	return typeof message === 'string' && message.includes(DEVIN_FREE_TIER_REFUSAL);
}

/**
 * ⭐ D46 — the observation's added sentence: the refusals stated where the exchange states what the adapter saw.
 * ~~`devin refused this call ${count} time(s) for its free tier (“…”) before it answered, …`~~ ⛔ MOVED 2026-11-07 (Z3 — the lead's
 * rulings on question 5 and the correction to ruling 3): the sentence names the refusals' figures in the one phrase a recording
 * reads them back by (`freeTierRefusalsFigures`), so a replay of the call can carry them as this adapter did.
 * ⭐ Z3 (the lead's ruling on the second follow-up) — ~~`devin answered after ${…}`~~, its opening words now the shared ones
 * (`FREE_TIER_REFUSALS_OPENING.answer`, the same text): the recorder reads the figures only right after them. ⭑ The "45 s" stays
 * the rule's wait, as the rule asks it; the figures are the waits as long as they took (`waitedMs`).
 */
const refusalsStated = (refusals: FreeTierRefusals): string =>
	`${FREE_TIER_REFUSALS_OPENING.answer}${freeTierRefusalsFigures(refusals)} (“${DEVIN_FREE_TIER_REFUSAL}”), each refusal waited out for ` +
	`${DEVIN_FREE_TIER_WAIT_MS / 1000} s and the same call made again: no refusal reached the model, and none is a reviewer call ` +
	'(D46).';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ⭐ P5 package A (F1) — what devin's export says of its LAST agent step: the output tokens it counted
 * (`metrics.completion_tokens`), and a finish reason where it gives one. ⚠ ATIF has no field for a finish reason, and devin
 * puts its own additions in a step's `extra` (`generation_model`, `telemetry`), so that is where one is read. ⚠ NOT
 * MEASURED: P5's 37 retained exports are all of calls that answered, and none carries one — so devin's sentence on stderr
 * is what told P5's cut replies apart, and this the second way.
 */
function exportFacts(text: string | undefined): OutputLimitFacts {
	let parsed: unknown;
	try {
		parsed = text === undefined ? undefined : JSON.parse(text);
	} catch {
		return {};
	}
	const steps = (parsed as { steps?: unknown } | undefined)?.steps;
	if (!Array.isArray(steps)) return {};
	const last = [...(steps as { source?: unknown }[])].reverse().find((s) => s?.source === 'agent') as
		| { metrics?: { completion_tokens?: unknown }; extra?: { finish_reason?: unknown } }
		| undefined;
	const tokens = last?.metrics?.completion_tokens;
	const reason = last?.extra?.finish_reason;
	return {
		...(typeof reason === 'string' && FINISH_REASON_SHAPE.test(reason) ? { finishReason: reason } : {}),
		...(typeof tokens === 'number' && Number.isSafeInteger(tokens) && tokens >= 0 ? { outputTokens: tokens } : {})
	};
}

/**
 * ⭐⭐ P5 package A (F1) — A NON-ZERO EXIT WHOSE REPLY DEVIN ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT, or `undefined` for any
 * other failure: told by devin's sentence, or by its export's finish reason. ⚠ The sentence is read in the rejection's
 * MESSAGE (`raw`), where `execFile` writes devin's stderr after the command: the stream itself is bound nowhere here, so no
 * retention surface for it is created (`REG-Q-066`). ⛔ ONLY AN EXIT: a kill at the bound carries a signal and no exit code,
 * and a spawn that failed a string code — those stay what they were.
 * ⭐ READ HERE, BEFORE THE `finally` REMOVES THE FOLDER: the export devin wrote, and what `execFile` keeps beside the
 * message — the exit code and stdout, the reply devin printed before it cut it.
 */
async function devinOutputLimit(
	e: unknown,
	raw: string,
	exportPath: string
): Promise<ConstructorParameters<typeof OutputLimitReached>[1] | undefined> {
	const failed = (e ?? {}) as { code?: unknown; stdout?: unknown };
	if (typeof failed.code !== 'number' || failed.code === 0) return undefined;
	const exported = await readFile(exportPath, 'utf8').catch(() => undefined);
	const facts = exportFacts(exported);
	const said = raw.includes(DEVIN_OUTPUT_LIMIT);
	if (!said && facts.finishReason !== 'max_tokens') return undefined;
	const reported = await readReportedModel(exportPath);
	return {
		facts,
		partialReply: typeof failed.stdout === 'string' ? failed.stdout : '',
		...(reported ? { producer: { agentId: 'devin', modelId: reported, providerId: 'devin' } } : {}),
		observedToolCalls: DEVIN_TOOL_OBSERVATION,
		...(exported === undefined ? {} : { sessionExport: exported })
	};
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package X — D34 (`REG-F-590`; `REG-F-554`'s remedy, applied to the kill;
 * `DESIGN-data-flow-order-and-deliverable-review.md` §10.5, revision 5) — WHAT A CALL DEVIN'S PROGRAM WAS KILLED DURING LEFT
 * BEHIND, or `undefined` for any other failure. ⛔ A KILL ONLY: a signal (in `SIGNAL_SHAPE`) and no exit code — what `execFile`
 * rejects with when its `timeout` kills the program — never an exit, which `devinOutputLimit` reads, nor a spawn that failed
 * (a string code and no signal).
 * ⭐ READ HERE, BEFORE THE `finally` REMOVES THE FOLDER: whether devin had written its export, what that export's last agent step
 * counted (`exportFacts`), how many characters devin had printed on stdout (`execFile` keeps them beside the message), and the
 * signal. Counts and facts only: no byte of the export or of what devin printed is kept. ⚠ Whether devin leaves either before a
 * kill is untested (design D34): a kill that left nothing says so — no export written, no character printed.
 */
async function devinKilled(e: unknown, exportPath: string): Promise<KilledCallFacts | undefined> {
	const failed = (e ?? {}) as { code?: unknown; signal?: unknown; stdout?: unknown };
	if (typeof failed.code === 'number' || typeof failed.signal !== 'string' || !SIGNAL_SHAPE.test(failed.signal))
		return undefined;
	const written = await readFile(exportPath, 'utf8').catch(() => undefined);
	return {
		signal: failed.signal,
		printedChars: typeof failed.stdout === 'string' ? failed.stdout.length : 0,
		exportWritten: written !== undefined,
		lastStep: exportFacts(written)
	};
}

/**
 * The exec seam — `AgyExec`'s shape (`assurance/agy-cli.ts`), for the same reason: without it the devin branch could be
 * exercised only by driving a real devin, so no test had ever reached it (`JAN-SELREV` SR-1). A stand-in script cannot
 * take its place either: node refuses a batch target with `shell: false` (EINVAL, measured in
 * `execution/child-process-runner.test.ts`). ⚠ A seam standing in for devin also writes the export file devin writes,
 * at the path its argv names after `--export`.
 * ⭐ P7-6 I1 — `cwd` IS devin's working folder: the adapter's own fresh temporary folder, never the server's. A seam that
 * ignores it is a stand-in that runs anywhere; `devin-reviewer.test.ts` reads it, and the folder's contents, as devin
 * would start in it.
 */
export type DevinExec = (
	file: string,
	args: readonly string[],
	options: { cwd: string; timeout: number; maxBuffer: number; windowsHide: boolean }
) => Promise<{ stdout: string }>;

/**
 * One non-interactive Devin call, returning stdout.
 *
 * ⭑ THE PROMPT GOES IN A FILE, NOT IN ARGV, and that is the whole reason this adapter is simpler than `agy`'s.
 * `agyPrint` must DESTROY its failure diagnostic because `execFile` rejects with `Command failed: <full argv>`
 * and agy's argv carries the entire prompt — a string that would otherwise be written verbatim into a projected
 * `VALIDATOR_EXECUTION_FAILED` observation (finding #60). With `--prompt-file` the argv holds a path, so the
 * diagnostic is safe to retain and there is no command-line length ceiling to budget against either.
 *
 * ⛔ AND SAFETY IS STILL MEASURED, NOT ASSUMED. The catch below CHECKS the outgoing diagnostic for the prompt
 * rather than trusting the `PROMPT_FREE` declaration. A declaration that is wrong then fails safe, which is the
 * difference between a claim and a control.
 *
 * ~~⚠ NO `--respect-workspace-trust false`. Print mode fails in an untrusted directory and that flag is a trust
 * BYPASS. It proved unnecessary — the probe succeeded without it — so an untrusted-directory failure surfaces
 * as a refusal to be fixed by trusting the directory, never by disabling the check.~~
 * ⭐ STRUCK BY `JAN-EXEC` Phase 7 P7-6 I1 (`DESIGN-the-reviewer-isolated.md` §2; `REG-F-548`, `REG-F-547`): the flag IS
 * passed now, and the ground under that paragraph moved twice.
 *   · ⛔ "It proved unnecessary" held only while devin ran in the SERVER's folder, which this host's devin trusted —
 *     and that folder was the defect: print mode auto-approves read-only tools, so the reviewer could read this
 *     repository's app, and in the measured run one verdict reported what it found there as the product's workspace
 *     (`REG-F-548`). In any other tree the same call was refused outright (`REG-F-547`: P7-3a's second attempt, every
 *     review refused in a quarter of a second).
 *   · ⭐ devin now runs in the adapter's OWN fresh temporary folder, holding only the prompt and a project config that
 *     denies every tool by name (`DENY_ALL_TOOLS_CONFIG`). A fresh folder is untrusted BY CONSTRUCTION — no person can
 *     have started devin in it to trust it — so the trust check could only ever refuse here, and the flag devin's help
 *     gives for print mode turns it off. ⚠ So the control is no longer trust: it is ISOLATION — an empty folder, every
 *     tool denied — and the 2026-10-10 probes drove the deny rules to hold in print mode under devin 3000.11.3
 *     (`REG-F-548`'s pointer; design §4a). Trusting the folder instead is not available: it would have to be done by
 *     hand, per folder, for a folder that exists for one call.
 *   · ⚠ WHAT ISOLATION DOES NOT REACH (`REG-F-548`'s pointer, probe 2): the reviewer's system context still carries this
 *     host's own devin setup — the account's global rules file, its installed skills and subagent profiles — so a
 *     review's context still depends on the machine it runs on. Not closed here.
 */
export async function devinPrint(
	prompt: string,
	exec: DevinExec = run as unknown as DevinExec,
	/** ⭐ Z3 — D46 — the wait before the same call is made again, for tests; absent, a real 45 s. */
	wait: (ms: number) => Promise<void> = sleep,
	/**
	 * ⭐ Z3 — the lead's correction to ruling 3 — THE CLOCK THIS CALL'S CALLERS TIME IT BY, in milliseconds: what came before the
	 * last attempt is measured on it (`FreeTierRefusals.beforeLastAttemptMs`), so each caller takes off a figure of its own clock.
	 * Absent, the monotonic wall clock, which every caller's own clock follows in production; a test hands its one virtual clock.
	 */
	now: () => number = () => performance.now()
): Promise<string | ToolInvocationResult> {
	// ⚠ RESOLVED BEFORE THE DIRECTORY EXISTS. `assuranceModel()` REFUSES when unconfigured (`REG-F-331`), and
	// my first version of this line put it after `mkdtemp` and outside the `try` — so an unconfigured host
	// would leak a temp directory on every refusal. Resolving first means the refusal happens before anything
	// is created, and it reaches the caller unwrapped rather than dressed as "devin invocation failed".
	const configured = assuranceModel();
	const dir = await mkdtemp(join(tmpdir(), 'jpwb-devin-'));
	const promptPath = join(dir, 'prompt.txt');
	const exportPath = join(dir, 'export.json');
	// ⭐ Z3 — D46 — the free-tier refusals waited out so far: none reached the model.
	let refused = 0;
	// ⭐ Z3 — the lead's correction to ruling 3 — when the first attempt began, and the last: all between is no part of the call.
	let firstAttemptAt: number | undefined;
	let lastAttemptAt = 0;
	// ⭐ Z3 — the lead's ruling on the second follow-up — the waits as long as they took, each measured around it on the same clock.
	let waitedMs = 0;
	// ~~`refused === 0 ? undefined : { count: refused, waitedMs: refused * DEVIN_FREE_TIER_WAIT_MS }`~~ ⛔ MOVED 2026-11-07 (Z3 — the
	// correction): and all that came before the last attempt, the refused attempts' run time and their waits, on the callers' clock.
	// ~~`waitedMs: refused * DEVIN_FREE_TIER_WAIT_MS,`~~ ⛔ MOVED 2026-11-07 (Z3 — the second follow-up, "measure the waits"): the rule's
	// figure made the refused attempts' time (the measured total less it) absorb any lateness of the real waits.
	// ⭐ Z3 — IN WHOLE MILLISECONDS, each figure rounded once, here: this clock reads fractions of one (`performance.now()`), and every
	// reader takes whole ones — the figures' pattern, a CALL line's integer `elapsedMs`, the run report's "failed after N ms".
	// Rounding keeps order, so the waits never exceed what came before the last attempt.
	const waited = (): FreeTierRefusals | undefined =>
		refused === 0
			? undefined
			: {
					count: refused,
					waitedMs: Math.round(waitedMs),
					beforeLastAttemptMs: Math.round(lastAttemptAt - (firstAttemptAt ?? lastAttemptAt))
				};
	try {
		// ⭐ P7-6 I4 — the no-tools preamble FIRST, then the prompt, in the one file devin reads (`DEVIN_REVIEWER_PREAMBLE`).
		// ⚠ The diagnostic check below still measures against `prompt`, the caller's: the preamble is this file's own
		// fixed text, and a diagnostic that echoed only it would leak nothing of the review.
		await writeFile(promptPath, `${DEVIN_REVIEWER_PREAMBLE}${prompt}`, 'utf8');
		// ⭐ P7-6 I1 — the deny-all project config, in the folder devin runs in; nothing else is put there.
		await mkdir(join(dir, '.devin'));
		await writeFile(join(dir, '.devin', 'config.json'), DENY_ALL_TOOLS_CONFIG, 'utf8');
		// ⭐⭐ Z3 — D46 — THE SAME CALL, MADE AGAIN after each free-tier refusal, at most three times; a fourth refusal fails it as
		// any failure does, below. ⛔ Every other failure is never waited out.
		const once = (): ReturnType<DevinExec> => exec(
			DEVIN_BIN,
			[
				'--print',
				'--model',
				configured,
				'--prompt-file',
				promptPath,
				'--export',
				exportPath,
				// ⭐ I1 — a fresh folder is untrusted by construction; isolation is the control (the struck paragraph above).
				'--respect-workspace-trust',
				'false'
			],
			// ⭐ I1 — `cwd`: devin's working folder is this one, never the server's (`REG-F-548`).
			// ⭐⭐ `JAN-EXEC` Phase 7, package X — D35 (`REG-F-590`; design §10.5, revision 5) — the kill, ~~240_000~~ 480 s: a planning
			// figure, about twice the longest answered call (231,362 ms); v12's three calls failed at the 240 s kill. ⛔ EVERY COPY IS
			// HELD TO THIS ONE, measured at the exec seam: `REVIEWER_CALL_BOUND_MS.devin` (`thrown-reviewer-call.test.ts`), the lane's
			// `LANE_BUDGET.reviewerCallMsByTool.devin` (`verif/live-exec-lane-config.test.ts`) and the qualification's `DEVIN_KILL_MS`
			// (`verif/reviewer-qualification-transports.test.ts`); the recorder's `RECORDED_CALL_BOUND_MS` to the validator's.
			{ cwd: dir, timeout: 480_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
		);
		let answered: { stdout: string } | undefined;
		while (answered === undefined)
			try {
				// ⭐⭐ Z3 — the lead's follow-up — THE SESSION EXPORT IS THE LAST ATTEMPT'S: every attempt is given this one path, read
				// after the loop (the reported model, the session export) and in the catch (the cut, the kill), so a refused
				// attempt's export is removed before the same call is made again. ⛔ No record shows whether devin writes one on a
				// refusal; removing it costs nothing either way.
				await rm(exportPath, { force: true });
				// ⭐ Z3 — the correction — each attempt's start, on the callers' clock: the last one's is where the call begins.
				lastAttemptAt = now();
				firstAttemptAt ??= lastAttemptAt;
				answered = await once();
			} catch (e) {
				if (refused >= DEVIN_FREE_TIER_RETRIES || !isFreeTierRefusal(e)) throw e;
				refused += 1;
				// ⭐ Z3 — the second follow-up — the rule's wait asked for, and measured as long as it took, on the callers' clock.
				const waitFrom = now();
				await wait(DEVIN_FREE_TIER_WAIT_MS);
				waitedMs += now() - waitFrom;
			}
		const { stdout } = answered;
		// ⭑⭑ THE READ HAPPENS HERE, AND THE PLACEMENT IS THE WHOLE FIX. `readReportedModel` was written with
		// `devinPrint` and could never be called by anyone: the `finally` below deletes `dir` before this
		// function returns, so the export it reads is gone by the time any caller holds the answer. It was not
		// an unused export — it was a function whose only possible caller was its own enclosing function.
		const reported = await readReportedModel(exportPath);
		// ⭐ P7-6 I2 (design §2; `REG-F-351`) — AND THE EXPORT ITSELF, read here for the reason `reported` is: the `finally`
		// below removes it. It is the only record of what devin did inside its session — any tool it called — and the
		// measured run's reviewer ended its sessions reaching for tools (`REG-F-549`) with nothing kept to show it.
		const sessionExport = await readFile(exportPath, 'utf8').catch(() => undefined);
		// ⛔ NO REPORT MEANS THE WEAKER GRADE, NOT THE CONFIGURED VALUE DRESSED UP. An unreadable export is an
		// absence of evidence about the model; returning the bare string lets the caller record what the HOST
		// configured, graded `HOST_CONFIGURED`, which is the honest fact.
		// ⚠ DISCLOSED (P7-6 I2): an export that names no model is not carried either — the bare string has no field for
		// it — and nor is the export of a call that FAILED (the throw below), whose cause is all the caller is handed:
		// ⭐ save (P5 package A) one whose reply devin ended at the output-token limit, which carries it (`OutputLimitReached`).
		// ⭐ Z3 — D46 — the observation, with the refusals waited out stated in it.
		const refusals = waited();
		const observedToolCalls: AdapterToolObservation =
			refusals === undefined
				? DEVIN_TOOL_OBSERVATION
				: { canObserve: false, reason: `${DEVIN_TOOL_OBSERVATION.reason} ${refusalsStated(refusals)}` };
		// ⭐ Z3 — D46 — ~~`if (!reported) return stdout;`~~ an export that names no model still returns the bare stdout, but for a
		// call refused first: the refusals are stated in its observation, which a bare string has no place for — so it is a report
		// with no model in it, and the record keeps the host's configuration (the validator reads a model only where one is named).
		if (!reported && refusals === undefined) return stdout;
		if (!reported)
			return {
				answer: answerFromText(stdout),
				rawOutput: stdout,
				producer: { agentId: 'devin', modelId: '', providerId: '' },
				identityEvidence: 'HOST_CONFIGURED',
				observedToolCalls,
				...(sessionExport === undefined ? {} : { sessionExport }),
				freeTierRefusals: refusals
			};
		return {
			// ⭐ `JAN-NOANS` — `execFile` RESOLVES ON EXIT 0, AND EXIT 0 WITH EMPTY STDOUT IS NOT AN ANSWER.
			// This adapter has no richer signal than the bytes: the CLI either printed something or it did not,
			// and `ENDED_WITHOUT_ANSWER` is the weakest honest member. ⛔ It deliberately does NOT claim
			// `CALL_FAILED` — a zero exit code is the tool reporting success, and contradicting it here would
			// assert a cause nobody stated (`REG-F-410`, inverted).
			answer: answerFromText(stdout),
			rawOutput: stdout,
			producer: {
				agentId: 'devin',
				modelId: reported,
				// Devin brokers many vendors, so the PROVIDER is the broker. Claiming `zhipu` for `glm-5-2`
				// would assert a relationship this host cannot see — the same reasoning `assurance/index.ts`
				// already records for the configured path.
				providerId: 'devin'
			},
			// ⭑ THE GRADE IS EARNED BY THE READ ABOVE, not by the tool's entry in `BACKING_TOOLS`. A catalog
			// declaration says what a tool CAN report; this says what it DID.
			identityEvidence: 'PROVIDER_REPORTED',
			// ⭐ R11 — `--print` IS A ONE-SHOT ANSWER, AND THAT IS THE WHOLE REASON. This adapter runs devin to
			// completion and reads its stdout plus an ATIF export; it mints no tool surface of its own and
			// watches no session, so anything devin did internally is devin's business and invisible here.
			// ⛔ Saying NONE_OBSERVED would claim this adapter looked. It did not look.
			observedToolCalls,
			// ⭐ P7-6 I2 — devin's own record of the session, for the caller to retain (`ToolInvocationResult.sessionExport`).
			...(sessionExport === undefined ? {} : { sessionExport }),
			...(refusals === undefined ? {} : { freeTierRefusals: refusals })
		};
	} catch (e) {
		const raw = e instanceof Error ? e.message : String(e);
		// ⭑ THE MEASUREMENT. If the prompt somehow reached the diagnostic anyway, withhold it — PER-12 forbids
		// projecting it and this codebase has no redaction. Otherwise the diagnostic is genuinely useful and
		// destroying it would repeat agy's disclosed loss for no reason.
		const diagnostic = diagnosticCarriesPrompt(raw, prompt)
			? 'devin invocation failed. Its diagnostic is WITHHELD: it was measured to contain the prompt, ' +
				'which may not reach the record plane (PER-12), and no redaction exists here.'
			: `devin invocation failed: ${raw}`;
		// ⭐⭐ P5 package A (F1) — A REPLY DEVIN ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT IS THROWN AS ITS OWN CLASS, the same
		// diagnostic its message, its partial reply, what the export counted and the export itself beside it
		// (`devinOutputLimit`). Every other failure is thrown as before.
		const cut = await devinOutputLimit(e, raw, exportPath);
		// ⭐⭐ Package X — D34 (`REG-F-590`) — A CALL KILLED DURING ITS RUN IS THROWN AS ITS OWN CLASS, the same diagnostic its
		// message and what the kill left beside it (`devinKilled`), read before the `finally` removes the folder. ⛔ Before X a
		// kill was thrown with its diagnostic alone: the record could not tell a call that was answering from one that printed
		// nothing.
		const killed = cut === undefined ? await devinKilled(e, exportPath) : undefined;
		// ⭐ Z3 — D46 — whatever is thrown carries the refusals waited out before it, off its message (`freeTierRefusalsOf`).
		const carry = <E extends Error>(thrown: E): E => withFreeTierRefusals(thrown, waited());
		if (killed !== undefined) throw carry(new ToolCallKilled(diagnostic, killed));
		throw carry(cut === undefined ? new Error(diagnostic) : new OutputLimitReached(diagnostic, cut));
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	}
}

/**
 * The model Devin ACTUALLY ran, read back from its ATIF export.
 *
 * ⭑ THIS IS WHY DEVIN GRADES `PROVIDER_REPORTED`. The export carries `agent.model_name` and, per step,
 * `extra.generation_model` — the exact id (`"glm-5-2"`). Reading it back means the record states the model that
 * answered rather than the model we asked for, and those can differ.
 */
export async function readReportedModel(exportPath: string): Promise<string | undefined> {
	try {
		const parsed = JSON.parse(await readFile(exportPath, 'utf8')) as {
			steps?: Array<{ extra?: { generation_model?: unknown } }>;
		};
		const reported = parsed.steps
			?.map((s) => s.extra?.generation_model)
			.filter((m): m is string => typeof m === 'string' && m.length > 0)
			.at(-1);
		return reported;
	} catch {
		// ⚠ An unreadable export is an ABSENCE OF EVIDENCE about the model, not evidence of a different one.
		// Returning undefined lets the caller fall back to HOST_CONFIGURED, which is the honest weaker grade.
		return undefined;
	}
}
