// ⭐ `JAN-EXEC` Phase 7 `P7-2` — THE OPERATOR'S HANDS IN THE RUN'S LANE, THE RUN'S ORDER, AND WHAT THE LANE WRITES DOWN
// (`docs/_working/DESIGN-the-live-end-to-end-run.md` §6 P7-2, D3, D4, D5, D8, D11).
//
// `phase7.live.ts` runs the run; this holds what it does with its hands, in what order, and what it records, so that
// `verif/phase7-live-spec.test.ts` drives each rule with no browser and no model:
//   · THE BOOT (D3) — the inherited `JPWB_*`, `RPH_*` and `PI_*` variables, the config's overlay, the node version, and
//     the reviewer's READINESS: `devin --version` and `devin models list`, run as the product runs devin, each bounded,
//     the configured model required in the list, no model called — and every reason the run may not go on, at once;
//   · THE ACTS on the Undertaking page — Begin & Execute, Record Assurance, Mark Satisfied — the gate's
//     (`e2e/phase7-five-unit.e2e.ts`) restated for a lane where a press can take hours and a refusal must not end the run:
//     each waits on its own action's response, BOUNDED, and keeps its status and raw body (D5);
//   · THE RUN'S ORDER (`runTheLane`; D4, D5, D8, D11) — the root, then each phase only after the one before has
//     answered, the limit before each phase ⭐ and each sign-off (`E12F` F2), a press with no answer ending the run, then
//     the sign-offs, the root last, and the final archive; dry, no phase at all, and the root's sign-off alone (D11), ⭐
//     rehearsed up to the reviewer call and never pressed (`E12F` F1, `REG-D-112` (b)). ⭑ It lived in the spec until
//     round 2's fix pass, where nothing could drive it: a dry run that never pressed the root, and a phase past its
//     allowance that started the next beside it, both passed every test. It runs here on HANDS the spec builds from
//     the page, so verif drives it on hands of its own;
//   · the store's reads after every act, each through a FRESH request context (`REG-F-540`, `REG-F-501`); the limit
//     (D8); and every POST the page sends (D5), because the stores keep accepted acts only.
// ⛔ NOTHING HERE IMPORTS `e2e/support/phase7-pwa.ts`: its imports carry no extension, which verif's NodeNext program
// refuses (driven, 2026-10-09). So the spec hands the acts the two helpers of it they need — a unit's row (`unitRow`) and
// the envelope's decoder (`actionFields`) — and each sibling here is named WITH its extension, as `run-folder.ts` does.
// ⚠ AND IT TAKES NO `test`: the spec takes Playwright's own, and this lane stipulates nothing.
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	errors,
	expect,
	request as apiRequest,
	type APIRequestContext,
	type Locator,
	type Page,
	type Request
} from '@playwright/test';
import type { EngineSnapshot, ObjectRow } from '../e2e/support/harness.js';
import { PHASE7_PWA, promptMarkers, type Phase7TypeDeclaration } from '../../../scripts/phase7/pwa-content.js';
import {
	archiveName,
	FINAL_ARCHIVE,
	PHASE7_ARCHIVE_UNITS,
	reviewerCalls,
	type ArchiveUnit
} from '../../../scripts/phase7/run-archive.js';
import {
	LANE_BUDGET,
	laneKeysRefusal,
	PHASE7_DECLARED_POLICIES_PER_UNIT,
	PHASE7_NEGATIVE_CONTROL_RESERVE,
	PHASE7_INTROSPECT_MS,
	PHASE7_PAID_LIMIT,
	PHASE7_PRIOR_CALLS_VARIABLE,
	PHASE7_RECORD_ASSURANCE_MS,
	PHASE7_SIGN_OFF_MS,
	PHASE7_UI_MS,
	PHASE7_UNIT_ALLOWANCE_MS,
	REVIEWER_MODEL_VARIABLE,
	wiredReviewer
} from './lane-config.js';

// ── THE BOUNDS THE LANE'S OWN ACTS WAIT ──────────────────────────────────────────────────────────────────────────────
// ⛔ THIS LANE SETS NO ACTION TIMEOUT, so every wait without one runs to the test's: ~~43~~ ~~85~~ ~~103~~ ~~108.7~~ 116.6 hours (`lane-config.ts`). Each
// act below that calls no model is bounded here, as an allowance, and Begin & Execute by `PHASE7_UNIT_ALLOWANCE_MS`.

// ⭐ `P76F-C` C8 — the UI's bound and a sign-off act's are DEFINED in `lane-config.ts` now, so the spec's timeout counts every
// ~~act~~ ⛔ `P76F-D` D4: every PHASE AND RECOVERY act by the bound it waits (`PHASE7_TEST_TIMEOUT_MS`) — the setup's acts only
// within an allowance their bounds pass (`PHASE7_SETUP_MS`); re-exported here, where each act names it.
export { PHASE7_SIGN_OFF_MS, PHASE7_UI_MS };
/** One readiness call (`devin --version`, `devin models list`). */
export const READINESS_CALL_MS = 120_000;
/** One read of the server's dump, which carries the whole event log — ⭐ `P76F-C` C8: `lane-config.ts`'s, by reference. */
export const INTROSPECT_MS = PHASE7_INTROSPECT_MS;

/** The Undertaking of §3.2's PWA, as the gate's rehearsal creates it. Its objective reaches no prompt (`REG-F-510`). */
export const PHASE7_UNDERTAKING = {
	name: 'wordfreq realization',
	objective: 'Build wordfreq, a Node.js command-line tool that prints the N most frequent words.',
	product: 'wordfreq'
} as const;

/** Strings in code-unit order: the same on every host and locale. */
const byCodeUnit = (a: string, b: string): number => Number(a > b) - Number(a < b);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// ── THE BOOT RECORD (D3) ─────────────────────────────────────────────────────────────────────────────────────────────

/** The prefixes of the variables the boot record keeps. ⭑ `PI_` because Pi reads its own (`PI_CODING_AGENT_DIR`). */
export const INHERITED_PREFIXES = ['JPWB_', 'RPH_', 'PI_'] as const;

/** A variable whose NAME says it holds a secret: the boot record keeps its length, never its value. */
const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i;

/**
 * Every variable of `env` the boot record keeps, by name. ⚠ The prefix is matched in ANY case: on Windows a variable is
 * found by any spelling of its name, so `jpwb_agent` reaches the server as `JPWB_AGENT` would. ⛔ A value whose name
 * says it is a secret is kept as its length: the record outlives the run, and no variable the server reads is one.
 */
export function inheritedVariables(
	env: Readonly<Record<string, string | undefined>>
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(env)
			.filter(
				(entry): entry is [string, string] =>
					entry[1] !== undefined &&
					INHERITED_PREFIXES.some((prefix) => entry[0].toUpperCase().startsWith(prefix))
			)
			.sort(([a], [b]) => byCodeUnit(a, b))
			.map(([name, value]) => [
				name,
				SECRET_NAME.test(name) ? `(withheld: ${value.length} characters)` : value
			])
	);
}

/** What the config lays over the operator's shell for the server (`playwright.live-exec.config.ts`, `webServer.env`). */
export const OVERLAY_KEYS = ['RPH_DEMO_MODE', 'JPWB_HARNESS', 'JPWB_SEED', 'JPWB_DEMO_DB'] as const;
export type Overlay = Readonly<Record<(typeof OVERLAY_KEYS)[number], string | null>>;

/** The overlay, read from the config's `webServer.env` as this worker loaded it; null where it sets nothing. */
export function overlayOf(serverEnv: Readonly<Record<string, string>> | undefined): Overlay {
	return Object.fromEntries(OVERLAY_KEYS.map((key) => [key, serverEnv?.[key] ?? null])) as Overlay;
}

/**
 * ⭐ D8 — the reviewer calls spent before this run (P7-3a's), as the operator gives them: a non-negative integer, or
 * why it is not one. Required of a paid run only.
 */
export function priorReviewerCalls(
	env: Readonly<Record<string, string | undefined>>
): number | string {
	const given = env[PHASE7_PRIOR_CALLS_VARIABLE];
	const trimmed = given?.trim() ?? '';
	if (/^(?:0|[1-9]\d*)$/.test(trimmed) && Number.isSafeInteger(Number(trimmed)))
		return Number(trimmed);
	return (
		`${PHASE7_PRIOR_CALLS_VARIABLE}=${JSON.stringify(given ?? null)} is not a non-negative integer. A paid run counts ` +
		`the reviewer calls spent before it (P7-3a's) against the sponsor's limit of ${PHASE7_PAID_LIMIT} (design §6 ` +
		'P7-2 D8; REG-D-102 (4)): set it to that count, 0 if none were spent.'
	);
}

/** One program run: its exit code, or null when it never exited by itself, with why. */
export interface ProgramRun {
	readonly exitCode: number | null;
	readonly stdout: string;
	readonly stderr: string;
	/** Why it has no exit code: it could not start, or it outlasted its bound and was killed. */
	readonly failure: string | null;
}

/** Runs `program` with `args`, bounded by `timeoutMs`. Injected, so verif drives the readiness check with no devin. */
export type ProgramRunner = (
	program: string,
	args: readonly string[],
	timeoutMs: number
) => Promise<ProgramRun>;

/**
 * ⭐ A program run as the product runs devin (`src/lib/server/tools/devin-reviewer.ts`, `devinPrint`): `execFile`, no
 * shell, the same buffer, the window hidden — so a devin the product could not start, this cannot start either.
 */
export const execFileRunner: ProgramRunner = (program, args, timeoutMs) =>
	new Promise((resolve) => {
		execFile(
			program,
			[...args],
			{ timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true },
			(error, stdout, stderr) => {
				const ran = { stdout: String(stdout), stderr: String(stderr) };
				if (error === null) return resolve({ exitCode: 0, ...ran, failure: null });
				// A program that exited carries its exit code; one that never started, or was killed, carries none.
				const code = (error as { code?: unknown }).code;
				if (typeof code === 'number') return resolve({ exitCode: code, ...ran, failure: null });
				const killed = (error as { killed?: boolean }).killed === true;
				resolve({
					exitCode: null,
					...ran,
					failure: killed
						? `killed after ${timeoutMs} ms: it did not finish within its bound`
						: error.message
				});
			}
		);
	});

/** The program the product runs as devin when nothing replaces it — and this lane refuses a replacement (`REG-F-441`). */
export const DEVIN_PROGRAM = 'devin';

/** A terminal colour code: an escape, `[`, its parameters and its letter. */
const COLOUR_CODE = new RegExp(String.raw`${String.fromCodePoint(27)}\[[0-9;]*[A-Za-z]`, 'g');

/**
 * Does `listing` — `devin models list`'s output — name `model`, as a whole id? ⚠ A WHOLE id: `glm-5-3-flash-max` is not
 * listed by `glm-5-3-flash-max-preview`. Colour codes are dropped first, though `execFile` hands a CLI no terminal.
 * ⚠ The listing's layout was never seen here — no devin is run outside the operator's own runs — so this asks only that
 * the id stand whole among the characters an id is made of.
 */
export function modelListed(listing: string, model: string): boolean {
	const id = model.trim();
	if (id === '') return false;
	return listing
		.replace(COLOUR_CODE, '')
		.split(/[^A-Za-z0-9._/:-]+/)
		.includes(id);
}

export interface Readiness {
	readonly devinVersion: ProgramRun;
	readonly modelsList: ProgramRun & { readonly configuredModel: string; readonly listed: boolean };
}

/** ⭐ D3 — devin's readiness: its version, and the model list holding the configured model. No model is called. */
export async function reviewerReadiness(
	model: string,
	run: ProgramRunner = execFileRunner
): Promise<Readiness> {
	const devinVersion = await run(DEVIN_PROGRAM, ['--version'], READINESS_CALL_MS);
	const list = await run(DEVIN_PROGRAM, ['models', 'list'], READINESS_CALL_MS);
	return {
		devinVersion,
		modelsList: {
			...list,
			configuredModel: model,
			listed: list.exitCode === 0 && modelListed(list.stdout, model)
		}
	};
}

/** Why the readiness check refuses the run, one line each; none when devin is ready. */
export function readinessRefusals(r: Readiness): string[] {
	const ran = (what: string, p: ProgramRun) =>
		p.exitCode === 0 ? [] : [`\`${what}\` ${p.failure ?? 'exited ' + String(p.exitCode)}`];
	return [
		...ran(`${DEVIN_PROGRAM} --version`, r.devinVersion),
		...ran(`${DEVIN_PROGRAM} models list`, r.modelsList),
		...(r.modelsList.exitCode === 0 && !r.modelsList.listed
			? [
					`\`${DEVIN_PROGRAM} models list\` does not list ${JSON.stringify(r.modelsList.configuredModel)}, the ` +
						`model ${REVIEWER_MODEL_VARIABLE.devin} configures: the account offers no such model, or it is ` +
						'spelt otherwise (its output is in lane/boot.json)'
				]
			: [])
	];
}

/**
 * ⭐ D3 — the reviewer this run is readied for: devin and its configured model, or why not. ⚠ A RULE OF THIS SPEC: the
 * design's readiness check is devin's (§6 P7-2 D3), and the run is measured with the selected reviewer, devin
 * (`REG-D-084`, `REG-D-102`), so another wired tool is refused here rather than run unready.
 */
export function reviewerUnderTest(
	env: Readonly<Record<string, string | undefined>>
): { readonly model: string } | { readonly refusal: string } {
	const tool = wiredReviewer(env.JPWB_ASSURANCE_TOOL);
	if (tool !== 'devin')
		return {
			refusal:
				`JPWB_ASSURANCE_TOOL=${JSON.stringify(env.JPWB_ASSURANCE_TOOL ?? null)} is refused by a rule of THIS SPEC: its ` +
				'readiness check is devin’s (design §6 P7-2 D3), and Phase 7 is measured with the selected reviewer, devin ' +
				'(REG-D-084, REG-D-102).'
		};
	const model = env[REVIEWER_MODEL_VARIABLE[tool]]?.trim();
	return model ? { model } : { refusal: `${REVIEWER_MODEL_VARIABLE[tool]} is not set.` };
}

/** `lane/boot.json`: what the run starts from (D3). */
export interface BootRecord {
	readonly startedAt: string;
	readonly mode: 'dry' | 'paid';
	readonly node: string;
	readonly inherited: Record<string, string>;
	readonly overlay: Overlay;
	readonly readiness: Readiness | null;
	readonly priorReviewerCalls: number | string;
	readonly refusals: readonly string[];
}

export interface Boot {
	readonly record: BootRecord;
	/** Why the run may not go on, one each, all at once; none when it may. */
	readonly refusals: readonly string[];
	/** The reviewer calls spent before the run (D8): a number whenever a paid run is not refused. */
	readonly prior: number | string;
}

/**
 * ⭐ D3 — THE BOOT: what the run starts from, and every reason it may not go on. ⛔ Each refusal is the run's, and
 * none is left to the run to find later: the lane's keys (`laneKeysRefusal`), the reviewer this spec readies, devin's
 * readiness, a paid run's prior calls (D8), a server whose store is not the run folder's, and a store the server did
 * not make there (§6 P7-2: "The spec asserts that `<dir>/demo.sqlite` exists"). ⭑ `run` is injected, so verif boots
 * with no devin.
 */
export async function bootOf(b: {
	readonly paid: boolean;
	readonly env: Readonly<Record<string, string | undefined>>;
	/** The config's `webServer.env`, as this worker loaded it. */
	readonly serverEnv: Readonly<Record<string, string>> | undefined;
	/** `<RUN>/demo.sqlite`: where the server must keep its store. */
	readonly store: string;
	readonly run?: ProgramRunner;
}): Promise<Boot> {
	const overlay = overlayOf(b.serverEnv);
	const reviewer = reviewerUnderTest(b.env);
	const readiness = 'model' in reviewer ? await reviewerReadiness(reviewer.model, b.run) : null;
	const prior = priorReviewerCalls(b.env);
	const keys = laneKeysRefusal(b.env);
	const refusals = [
		...(keys === undefined ? [] : [keys]),
		...('refusal' in reviewer ? [reviewer.refusal] : []),
		...(readiness === null ? [] : readinessRefusals(readiness)),
		...(b.paid && typeof prior === 'string' ? [prior] : []),
		...(overlay.JPWB_DEMO_DB === b.store
			? []
			: [
					`the server keeps its store at ${String(overlay.JPWB_DEMO_DB)}, not in the run folder, at ${b.store}`
				]),
		...(existsSync(b.store)
			? []
			: [`${b.store} does not exist: the server made no store in the run folder`])
	];
	return {
		record: {
			startedAt: new Date().toISOString(),
			mode: b.paid ? 'paid' : 'dry',
			node: process.version,
			inherited: inheritedVariables(b.env),
			overlay,
			readiness,
			priorReviewerCalls: prior,
			refusals
		},
		refusals,
		prior
	};
}

// ── THE LANE'S OWN FILES ─────────────────────────────────────────────────────────────────────────────────────────────

/** `<RUN>/lane/` and what the spec writes there — and nowhere else: the server owns the rest of the run folder. */
export interface LanePaths {
	readonly lane: string;
	readonly boot: string;
	readonly run: string;
	readonly posts: string;
	readonly actions: string;
	readonly archive: string;
	readonly screenshots: string;
}

export function lanePaths(runFolder: string): LanePaths {
	const lane = join(runFolder, 'lane');
	return {
		lane,
		boot: join(lane, 'boot.json'),
		run: join(lane, 'run.json'),
		posts: join(lane, 'posts.jsonl'),
		actions: join(lane, 'actions'),
		archive: join(lane, 'archive'),
		screenshots: join(lane, 'screenshots')
	};
}

/** Make the lane's folders. ⛔ A lane that already holds a boot record is refused: a run folder serves one run (D2). */
export function openLane(runFolder: string): LanePaths {
	const paths = lanePaths(runFolder);
	if (existsSync(paths.boot))
		throw new Error(
			`refused: ${paths.boot} already exists — this run folder has served a run, and a run folder serves one (design §6 P7-2 D2)`
		);
	for (const folder of [paths.lane, paths.actions, paths.archive, paths.screenshots])
		mkdirSync(folder, { recursive: true });
	return paths;
}

const json = (value: unknown): string => `${JSON.stringify(value, null, '\t')}\n`;

/** Write a lane file once: one that exists is refused. */
export function writeOnce(file: string, value: unknown): void {
	writeFileSync(file, json(value), { flag: 'wx' });
}

/** The run record is written again after every unit, so a run cut off mid-way still leaves what it had reached. */
export function writeRunRecord(paths: LanePaths, record: RunRecord): void {
	writeFileSync(paths.run, json(record));
}

/** `lane/actions/<NN>-<slug>-<action>.json`. */
export const actionFile = (paths: LanePaths, unit: ArchiveUnit, action: string): string =>
	join(paths.actions, `${archiveName(unit.order, unit.slug)}-${action}.json`);

// ── THE RUN RECORD ───────────────────────────────────────────────────────────────────────────────────────────────────

/** A unit's three axes and its plan step, as the STORE holds them (`REG-F-540`). */
export interface UnitState {
	readonly lifecycleState: string | null;
	readonly executionState: string | null;
	readonly assuranceState: string | null;
	readonly planStepState: string | null;
}

/** ⭐ D8's check before a phase: the calls spent before, those this run's store records, and those held back. */
export interface LimitCheck {
	readonly prior: number;
	readonly recorded: number;
	readonly reserve: number;
	/**
	 * ⭐ `E12F` F2 — before a SIGN-OFF, the act's own worst case, counted in `total`: its unit's declared policies, each a
	 * review of up to `reviewerCallsPerTry` calls (`signOffWorstCase`). Absent before a phase and before the rule's re-run of
	 * a phase (`recoverByRule`), as before.
	 */
	readonly ahead?: number;
	readonly total: number;
	readonly limit: number;
	readonly allowed: boolean;
}

export type EnvelopeType = 'success' | 'failure' | 'redirect' | 'error';

export interface RunUnit extends ArchiveUnit {
	/** null until the Undertaking is created and the unit read from the store. */
	unitId: string | null;
	readonly archive: string;
	/** null until pressed, and for a unit never pressed. */
	beginExecute: {
		readonly status: number | null;
		readonly envelopeType: EnvelopeType | null;
		readonly timedOutAfterMs: number | null;
		readonly requestFailure: string | null;
	} | null;
	after: UnitState | null;
	/** null for a unit never pressed. */
	stopped: boolean | null;
	/** ⭐ D5 — an earlier phase stopped, so this one ran on an upstream nothing assured; the store has no such field. */
	upstreamNotAssured: boolean | null;
	limitCheck: LimitCheck | null;
	/**
	 * ⭐ `JAN-EXEC` P7-6R R-1f — what the run plan's rule did as the operator after this phase stopped (`REG-D-105` (4)), in
	 * order: empty for a phase that did not stop, and for one whose row offered no re-run.
	 */
	recovery: RecoveryRecord[];
	signOff: SignOffRecord | null;
}

/** ⭐ P7-6R R-1f — one act the run plan's rule made on a stopped phase, and the unit as the STORE read it after. */
export interface RecoveryRecord {
	readonly act: RecoveryAct;
	/** The rationale typed, the run plan's rule's own (`RULE_RATIONALE`). */
	readonly rationale: string;
	/** ⭐ D8 — checked before each re-run, as between phases; null for an abandonment, which calls no model. */
	readonly limitCheck: LimitCheck | null;
	/** null when the act was not pressed — the limit stopped it, or the row did not offer it (`notPressed`). */
	readonly status: number | null;
	readonly envelopeType: EnvelopeType | null;
	readonly timedOutAfterMs: number | null;
	readonly requestFailure: string | null;
	/**
	 * null when the act was not pressed — ⭐ E12's polish — or while the store read after it has not come back: the act is kept
	 * before that read (`recoveryAct`), so a read that throws leaves it here with its bound.
	 */
	readonly after: UnitState | null;
	/**
	 * ⭐ P7-6 B3 — what the STORE says a re-run came to, read after it (`rerunReading`); null for an abandonment, for a re-run
	 * not pressed, for one with no answer (the run ends there), ⭐ and while that read has not come back.
	 */
	readonly reading: RerunReading | null;
	/** ⭐ P7-6 B3 — the server's refusal, in its own words, of an act it answered with anything but success; else null. */
	readonly refusal: string | null;
	/** ⭐ P7-6 B3 — why the act was not pressed: the limit (D8), or a row that did not offer it; null when it was. */
	readonly notPressed: string | null;
}

/**
 * ⭐⭐ P7-6 B3 (the fix round) — WHAT A RE-RUN CAME TO, READ FROM THE STORE, never from its envelope (`REG-F-540`):
 *   · `recovered` — a new plan B, its step and the unit SUCCEEDED;
 *   · `refused-again` — a new plan B whose step WAITS, the unit WAITING: the review refused the re-run as it refused the
 *     first (RD5), and only this is "a re-run that is refused again" (`REG-D-105` (4)) — the one reading the rule abandons;
 *   · `not-made` — NO new plan: the server refused the press before dispatching anything (a missing rationale, RD7 unable
 *     to rebuild, the reviewer's preflight), so no re-run was made, and the unit waits as it did;
 *   · `stopped-otherwise` — a new plan B, the unit not waiting: R-2's stops (an executor try that did not run, a refused
 *     evidence join, a floor that threw), for which the page offers no choice, abandonment's field included.
 */
export type RerunReading = 'recovered' | 'refused-again' | 'not-made' | 'stopped-otherwise';

/**
 * ⭑ `request-failed` — ~~a Begin & Execute whose request failed in transit (round 2's fix pass; `pressFormAction`)~~ ⭐ E12's
 * polish (the confirm's EndReason finding) — ANY ACT THE LANE PRESSES whose request failed in transit, and ⭑
 * `allowance-exceeded`, any that gave no answer within its bound: both are `unansweredEnd`'s, for a Begin & Execute (round 2's
 * fix pass; `pressFormAction`), a recovery act the rule pressed (P7-6R R-1f), and a sign-off act — Record Assurance, the rule's
 * re-run of the declared reviews, Mark Satisfied (E12's re-review F1) — and a throw after one keeps its reason.
 */
export type EndReason =
	| 'complete'
	| 'dry-run-stop'
	| 'paid-limit'
	| 'allowance-exceeded'
	| 'request-failed'
	| 'refused-at-boot'
	| 'lane-error';

export interface RunRecord {
	readonly mode: 'dry' | 'paid';
	readonly units: RunUnit[];
	/** ⭐ What a dry run read before it stopped: the model exchanges the store holds, which must be none (D1). */
	dryRun: { readonly modelExchanges: number } | null;
	/** null while the run is under way. */
	end: { readonly reason: EndReason; readonly at: string; readonly detail?: string } | null;
	/** What the lane could not do and went on without — a screenshot, say — one line each. */
	readonly problems: string[];
}

/** The run record's units before anything is pressed. */
export function unpressed(units: readonly ArchiveUnit[]): RunUnit[] {
	return units.map((u) => ({
		...u,
		unitId: null,
		archive: archiveName(u.order, u.slug),
		beginExecute: null,
		after: null,
		stopped: null,
		upstreamNotAssured: null,
		limitCheck: null,
		recovery: [],
		signOff: null
	}));
}

/**
 * ⭐ D8 — before each phase: prior + recorded + reserve must total UNDER the sponsor's limit (`REG-D-102` (4)). ⭐ `E12F` F2 —
 * and before each sign-off, and before the rule's re-run of its declared reviews, with that act's own worst case (`ahead`)
 * counted too: since E2 Record Assurance asks the reviewer for one review per declared policy (`REG-D-110` (3)), so a
 * sign-off is a paid act the limit must see before it is pressed.
 */
export function limitCheck(prior: number, recorded: number, ahead = 0): LimitCheck {
	const total = prior + recorded + PHASE7_NEGATIVE_CONTROL_RESERVE + ahead;
	return {
		prior,
		recorded,
		reserve: PHASE7_NEGATIVE_CONTROL_RESERVE,
		...(ahead > 0 ? { ahead } : {}),
		total,
		limit: PHASE7_PAID_LIMIT,
		allowed: total < PHASE7_PAID_LIMIT
	};
}

/**
 * ⭐⭐ `E12F` F2 (the E12 package review's second finding) — A SIGN-OFF'S WORST CASE, IN REVIEWER CALLS: its unit's declared
 * policies (§3.2's PWA, read by the unit's title — `PHASE7_DECLARED_POLICIES_PER_UNIT`, the most any unit carries, should a
 * title not be found), each reviewed once (`REG-D-110` (3)) in up to `LANE_BUDGET.reviewerCallsPerTry` calls — its call,
 * retry and repair. ⛔ The declared reviews at sign-off were outside the paid limit: the limit was read before each phase and
 * each re-run, and a sign-off — up to 16 calls for the design phase — was pressed with no check at all. ⚠ AN UPPER BOUND:
 * the server reviews those of the type's policies that govern the unit (`governingDeclaredPolicies`), and the rule's re-run
 * of the declared reviews only those that did not conclude — counted, before that re-run, at this same bound.
 */
export function signOffWorstCase(unit: ArchiveUnit): number {
	const declared =
		PHASE7_PWA.types.find((t) => t.name === unit.title)?.policyIds.length ?? PHASE7_DECLARED_POLICIES_PER_UNIT;
	return declared * LANE_BUDGET.reviewerCallsPerTry;
}

/**
 * A unit STOPPED unless its press was accepted AND the store reads its execution and its plan step SUCCEEDED — the
 * envelope alone is not the record (`REG-F-540`).
 */
export function stoppedAfter(envelopeType: EnvelopeType | null, state: UnitState): boolean {
	return !(
		envelopeType === 'success' &&
		state.executionState === 'SUCCEEDED' &&
		state.planStepState === 'SUCCEEDED'
	);
}

/** ⭐ D5 — did a phase before `order` stop? The root is the phases' parent, not their upstream. */
export function upstreamNotAssured(units: readonly RunUnit[], order: number): boolean {
	return units.some((u) => u.order > 1 && u.order < order && u.stopped === true);
}

// ── THE STORE'S READS (`REG-F-540`) ──────────────────────────────────────────────────────────────────────────────────

/** The server's dump, as it answered and as parsed. */
export interface Dump {
	readonly text: string;
	readonly snapshot: EngineSnapshot;
}

/**
 * ⭐ READ THROUGH A FRESH REQUEST CONTEXT, disposed after: a connection pooled and left idle about 6 s can be reset by
 * the server (`REG-F-501`), and this lane retries nothing — an archive's minutes of copying would idle every pool.
 */
export async function withFreshRequest<T>(
	baseURL: string,
	act: (request: APIRequestContext) => Promise<T>
): Promise<T> {
	const request = await apiRequest.newContext({ baseURL, timeout: INTROSPECT_MS });
	try {
		return await act(request);
	} finally {
		await request.dispose();
	}
}

/** GET `/test-api/introspect`, through a fresh context: the dump's text as it answered, and parsed. */
export async function freshIntrospect(baseURL: string): Promise<Dump> {
	return withFreshRequest(baseURL, async (request) => {
		const res = await request.get('/test-api/introspect');
		const text = await res.text();
		expect(res.ok(), `introspect answered ${res.status()}`).toBe(true);
		return { text, snapshot: JSON.parse(text) as EngineSnapshot };
	});
}

/** The units of one Undertaking, by title. ⚠ Scoped HERE: the dump is unscoped by design. */
export function unitsOf(snap: EngineSnapshot, undertakingName: string): Map<string, ObjectRow> {
	const undertaking = snap.undertakings.find((u) => u.state.name === undertakingName);
	return new Map(
		snap.pwus
			.filter((p) => undertaking !== undefined && p.state.undertakingId === undertaking.id)
			.map((p) => [str(p.state.title), p])
	);
}

/** A unit's LAST plan in the store, or undefined. ⚠ A loop, not `findLast`, which verif's ES2022 program does not have. */
function lastPlanOf(snap: EngineSnapshot, unitId: string): ObjectRow | undefined {
	let plan: ObjectRow | undefined;
	for (const p of snap.executionPlans) if (p.state.workUnitId === unitId) plan = p;
	return plan;
}

/** ⭐ P7-6 B3 — the id of a unit's last plan in the store, or null: what a re-run's new plan B is told apart from. */
export const planIdOf = (snap: EngineSnapshot, unitId: string): string | null =>
	lastPlanOf(snap, unitId)?.id ?? null;

/** A unit's axes and its plan step, from the store; null where it holds none. */
export function unitStateOf(snap: EngineSnapshot, unitId: string): UnitState {
	const unit = snap.pwus.find((p) => p.id === unitId);
	// Its LAST plan, and that plan's last step: each Begin & Execute mints one plan of one step, and each re-run one more
	// (P7-6R RD5), the plan it superseded left with its step cancelled.
	const plan = lastPlanOf(snap, unitId);
	const steps = (plan?.state.steps as { stepState?: unknown }[] | undefined) ?? [];
	const at = (v: unknown) => str(v) || null;
	return {
		lifecycleState: at(unit?.state.workLifecycleState),
		executionState: at(unit?.state.executionState),
		assuranceState: at(unit?.state.assuranceState),
		planStepState: at(steps.at(-1)?.stepState)
	};
}

/**
 * ⭐ P7-6 B3 — what a re-run came to (`RerunReading`), from the store read after it and the unit's last plan before it.
 * ⛔ The plan decides first: with no new plan, nothing was dispatched, whatever state the unit reads.
 */
export function rerunReading(planBefore: string | null, snap: EngineSnapshot, unitId: string): RerunReading {
	const plan = planIdOf(snap, unitId);
	if (plan === null || plan === planBefore) return 'not-made';
	const s = unitStateOf(snap, unitId);
	if (s.executionState === 'SUCCEEDED' && s.planStepState === 'SUCCEEDED') return 'recovered';
	if (s.executionState === 'WAITING' && s.planStepState === 'WAITING') return 'refused-again';
	return 'stopped-otherwise';
}

/** ⭐ D8 — the reviewer calls this run's store records: every ASSURANCE exchange, a lower bound (`run-archive.ts`). */
export const recordedReviewerCalls = (snap: EngineSnapshot): number =>
	reviewerCalls(snap, null).recorded.calls;

/**
 * The arrangement before anything runs: each type of `declared` as the designer stored it, beside the declaration —
 * the gate's `expectTheTypesTyped`, restated. ⭑ Read back from the STORE, so a form that dropped a field shows here,
 * and not hours later as a symptom.
 */
export function typesAsTyped(
	snap: EngineSnapshot,
	pwaId: string,
	declared: readonly Phase7TypeDeclaration[]
): { readonly typed: unknown[]; readonly expected: unknown[] } {
	const types = snap.pwuTypes.filter((t) => t.state.pwaId === pwaId);
	const idOf = new Map(types.map((t) => [str(t.state.name), t.id]));
	const byName = (a: { name: string }, b: { name: string }) => byCodeUnit(a.name, b.name);
	const typed = types
		.map((t) => {
			const prompt = t.state.promptTemplate as
				| {
						templateText?: string;
						status?: string;
						declaredPlaceholders?: string[];
						outputContract?: string;
				  }
				| undefined;
			const children =
				(t.state.permittedChildren as { typeId: string; cardinality: string }[] | undefined) ?? [];
			return {
				name: str(t.state.name),
				pwuKind: str(t.state.pwuKind),
				purpose: str(t.state.purpose),
				workDischarge: str(t.state.workDischarge),
				isRoot: t.state.isRoot === true,
				prompt: prompt ? `${prompt.status}: ${prompt.templateText}` : 'none',
				outputContract: prompt?.outputContract ?? 'none',
				markers: [...(prompt?.declaredPlaceholders ?? [])].sort(byCodeUnit),
				policyIds: ((t.state.requiredAssurancePolicyIds as string[] | undefined) ?? [])
					.map(String)
					.sort(byCodeUnit),
				children: children.map((c) => `${c.typeId}:${c.cardinality}`).sort(byCodeUnit)
			};
		})
		.sort(byName);
	const expected = declared
		.map((t) => ({
			name: t.name,
			pwuKind: t.pwuKind,
			purpose: t.purpose,
			workDischarge: t.workDischarge,
			isRoot: t.isRoot === true,
			prompt: t.prompt === undefined ? 'none' : `ACTIVE: ${t.prompt}`,
			outputContract: t.outputContract ?? 'none',
			markers: promptMarkers(t.prompt ?? '').sort(byCodeUnit),
			policyIds: [...t.policyIds].sort(byCodeUnit),
			children: (t.children ?? []).map((name) => `${idOf.get(name)}:M1`).sort(byCodeUnit)
		}))
		.sort(byName);
	return { typed, expected };
}

// ── THE ACTS ON THE UNDERTAKING PAGE (D5) ────────────────────────────────────────────────────────────────────────────

/** SvelteKit's answer to an enhanced form action, as `e2e/support/phase7-pwa.ts`'s `ActionEnvelope` has it. */
export interface Envelope {
	readonly type: string;
	readonly status?: number;
	readonly data?: string;
	readonly error?: unknown;
	readonly location?: unknown;
}

/** The envelope's decoder — `actionFields`, handed in by the spec (the header says why). */
export type Decode = (envelope: Envelope) => Record<string, unknown>;

/** What one press of a form action came to: as the server answered it, or that no answer came, and how. */
export interface ActionOutcome {
	readonly status: number | null;
	readonly envelopeType: EnvelopeType | null;
	readonly rawBody: string | null;
	readonly decoded: Record<string, unknown> | null;
	/** Set when no answer came within the bound: the server may still be running the act (`REG-F-535`). */
	readonly timedOutAfterMs: number | null;
	/** ⭐ Set when the request FAILED IN TRANSIT — a reset connection, a server gone — with the browser's own reason. */
	readonly requestFailure: string | null;
}

/** A press that came to no answer: nothing was received. */
const NO_ANSWER: ActionOutcome = {
	status: null,
	envelopeType: null,
	rawBody: null,
	decoded: null,
	timedOutAfterMs: null,
	requestFailure: null
};

const ENVELOPE_TYPES: readonly EnvelopeType[] = ['success', 'failure', 'redirect', 'error'];

/** The envelope a body holds, or undefined when it holds none. */
function envelopeIn(rawBody: string): Envelope | undefined {
	try {
		const parsed = JSON.parse(rawBody) as unknown;
		return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Envelope)
			: undefined;
	} catch {
		return undefined;
	}
}

/** An envelope's fields: the action's own, decoded, for an answer it returned; what SvelteKit put there otherwise. */
function fieldsOf(type: EnvelopeType, envelope: Envelope, decode: Decode): Record<string, unknown> {
	if (type === 'error') return { error: envelope.error ?? null };
	if (type === 'redirect') return { location: envelope.location ?? null };
	return decode(envelope);
}

/**
 * ⭐ A press's outcome from its HTTP status and raw body. ⛔ `res.ok()` IS NOT ACCEPTANCE: an enhanced form is answered
 * at HTTP 200 for a refusal too (`REG-F-426`), so the envelope's `type` is the action's own verdict — and a body that
 * is no envelope at all is kept, with no type.
 */
export function outcomeOf(status: number, rawBody: string, decode: Decode): ActionOutcome {
	const envelope = envelopeIn(rawBody);
	const envelopeType = ENVELOPE_TYPES.find((t) => t === envelope?.type) ?? null;
	const decoded =
		envelope === undefined || envelopeType === null
			? null
			: fieldsOf(envelopeType, envelope, decode);
	return { status, envelopeType, rawBody, decoded, timedOutAfterMs: null, requestFailure: null };
}

/** The refusal an outcome carries, in the action's own words where it gave some. */
export function refusalOf(o: ActionOutcome): string {
	if (o.timedOutAfterMs !== null) return `no answer within ${o.timedOutAfterMs} ms`;
	if (o.requestFailure !== null)
		return `no answer: the request failed in transit (${o.requestFailure})`;
	const error = o.decoded?.error;
	if (typeof error === 'string' && error !== '') return error;
	return o.rawBody ?? `HTTP ${String(o.status)}`;
}

/**
 * ⭐ Press `button` and wait for ITS action's response, within `timeoutMs` — and keep what came back: the status and
 * the raw body, whatever the envelope says. ⚠ The wait is on the response, not the click: `.click()` resolves when the
 * click is dispatched (`JAN-CRITREAD` J1-4). ⛔ A press with NO ANSWER is RETURNED, not thrown, in either of its kinds:
 * one that outlasts its bound, and one whose request FAILS IN TRANSIT. The second is RACED beside the wait, because
 * Playwright's response wait ends only on its timeout, a crash or the page closing — driven against headless Edge
 * (round 2's verification, 2026-10-09): a POST whose socket the server destroyed failed at 215 ms and was waited out
 * for its whole bound, which for Begin & Execute is 10.6 hours; raced, driven the same way (2026-10-10), it came back
 * failed in 363 ms. Either way the run's record must say which, and the server may still be running the act, so
 * nothing may be started beside it (`REG-F-535`). ⚠ The browser may send such a POST twice — Edge re-sent it once on a
 * reused connection in both drives — so the server can see a second Begin & Execute the page never asked for.
 */
export async function pressFormAction(
	page: Page,
	action: string,
	button: Locator,
	timeoutMs: number,
	decode: Decode
): Promise<ActionOutcome> {
	const url = new URL(`?/${action}`, page.url()).href;
	const ours = (r: Request) => r.url() === url && r.method() === 'POST';
	const answered = page.waitForResponse((r) => ours(r.request()), { timeout: timeoutMs });
	// ⚠ Handled at once, so a click that fails cannot leave this wait's rejection unhandled hours later.
	answered.catch(() => undefined);
	let lose: (failure: string) => void = () => undefined;
	const lost = new Promise<string>((resolve) => (lose = resolve));
	// ⚠ ITS OWN request only: any other that fails — a stray GET, another action — says nothing of this press.
	const onFailed = (r: Request) => {
		if (ours(r)) lose(r.failure()?.errorText ?? 'the request failed');
	};
	page.on('requestfailed', onFailed);
	try {
		// ⛔ THE CLICK IS NOT THE WAIT: a click that times out — its button never came — is thrown, never read as a
		// press that outlasted its allowance. ⭐ P7-6 B3 — and its bound is its own, `PHASE7_UI_MS`, never the page's default
		// alone, which the spec sets where nothing here can see it.
		await button.click({ timeout: PHASE7_UI_MS });
		const first = await Promise.race([
			answered.then((response) => ({ response })),
			lost.then((failure) => ({ failure }))
		]).catch((e: unknown) => {
			if (e instanceof errors.TimeoutError) return { timedOut: true } as const;
			throw e;
		});
		if ('timedOut' in first) return { ...NO_ANSWER, timedOutAfterMs: timeoutMs };
		if ('failure' in first) return { ...NO_ANSWER, requestFailure: first.failure };
		return outcomeOf(
			first.response.status(),
			(await first.response.body()).toString('utf8'),
			decode
		);
	} finally {
		page.off('requestfailed', onFailed);
	}
}

/**
 * ⭐ Begin & Execute on the unit in `row` — waited for up to ONE PHASE'S ALLOWANCE (D4): the root's too, though it
 * runs no model, so that every Begin & Execute is bounded the same way.
 */
export function beginExecute(page: Page, row: Locator, decode: Decode): Promise<ActionOutcome> {
	return pressFormAction(
		page,
		'beginExecute',
		row.getByRole('button', { name: 'Begin & Execute', exact: true }),
		PHASE7_UNIT_ALLOWANCE_MS,
		decode
	);
}

/**
 * ⭐ Record Assurance on the unit in `row` — or null when the row offers none: a unit that did not complete offers
 * none. ⚠ THE ROW IS WAITED FOR FIRST (round 2's fix pass): counted at once, a row the page has not drawn yet, or one an
 * `error` envelope's error page has replaced, read as "not offered" — a sign-off never pressed, which the report reads
 * as one attempted and refused (driven against headless Edge, 2026-10-09).
 */
export async function recordAssurance(
	page: Page,
	row: Locator,
	decode: Decode
): Promise<ActionOutcome | null> {
	// ⭐ `E12F` F1 — the row's wait and the reading of its offer are `recordAssuranceOffered`'s, the dry run's rehearsal: so
	// what a dry run rehearses is this press's own code, up to the press.
	if (!(await recordAssuranceOffered(row))) return null;
	// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B8) — ~~`PHASE7_SIGN_OFF_MS`~~: the press runs a declared review of each of the
	// unit's policies now (`REG-D-110` (3)), so it is waited for up to its act AND those reviews (`PHASE7_RECORD_ASSURANCE_MS`).
	const assure = row.getByRole('button', { name: 'Record Assurance', exact: true });
	return pressFormAction(page, 'recordAssurance', assure, PHASE7_RECORD_ASSURANCE_MS, decode);
}

/**
 * ⭐⭐ `E12F` F1 (`REG-D-112` (b)) — WHETHER THE UNIT'S ROW OFFERS RECORD ASSURANCE, READ AND NEVER PRESSED: the row waited
 * for first, then its button counted — `recordAssurance`'s own first steps. A dry run's sign-off stops here: the press
 * would ask a reviewer.
 */
export async function recordAssuranceOffered(row: Locator): Promise<boolean> {
	await row.waitFor({ state: 'visible', timeout: PHASE7_UI_MS });
	return (await row.getByRole('button', { name: 'Record Assurance', exact: true }).count()) > 0;
}

/**
 * ⭐⭐ `E12F` F3 (`REG-D-112` (a)) — WHETHER THE UNIT'S ROW OFFERS RE-RUNNING ITS DECLARED REVIEWS THAT DID NOT CONCLUDE, by
 * the page's own test id, the row waited for first. ⭑ The page offers exactly what the server accepts (`declaredRerunOffer`):
 * a unit left under assessment by an INCONCLUSIVE declared verdict, and none of them REJECTED.
 */
export async function declaredRerunOffered(row: Locator): Promise<boolean> {
	await row.waitFor({ state: 'visible', timeout: PHASE7_UI_MS });
	return (await row.getByTestId('rerun-declared-reviews').count()) > 0;
}

/**
 * ⭐⭐ `E12F` F3 — THE RULE'S RE-RUN OF THE UNIT'S DECLARED REVIEWS that did not conclude: its rationale typed into its own
 * field, its own button pressed, waited for as Record Assurance is — its act and a review of each of the unit's declared
 * policies (`PHASE7_RECORD_ASSURANCE_MS`). Each fill and click bounded by `PHASE7_UI_MS`.
 */
export async function rerunDeclared(page: Page, row: Locator, decode: Decode): Promise<ActionOutcome> {
	await row.getByTestId('rerun-declared-rationale').fill(DECLARED_RERUN_RATIONALE, { timeout: PHASE7_UI_MS });
	return pressFormAction(
		page,
		'rerunDeclaredReviews',
		row.getByTestId('rerun-declared-reviews'),
		PHASE7_RECORD_ASSURANCE_MS,
		decode
	);
}

/**
 * ⭐ Mark Satisfied on the unit in `row`, pressed only once Record Assurance has LEFT the row — the gate's one wait
 * (`attemptSignOff`, `e2e/phase7-five-unit.e2e.ts`): the EXECUTING row offers a Mark Satisfied of its own, so a press
 * before the re-render an accepted Record Assurance brings would be Mark Satisfied without Record Assurance, which P7-3
 * forbids. ⛔ `runTheLane` presses this only after an ACCEPTED Record Assurance ⭐ — or, `E12F` F3, after the rule's ACCEPTED
 * re-run of the declared reviews a refused one left inconclusive (`REG-D-112` (a)), whose row offers no Record Assurance.
 */
export async function markSatisfied(
	page: Page,
	row: Locator,
	decode: Decode
): Promise<ActionOutcome> {
	await row
		.getByRole('button', { name: 'Record Assurance', exact: true })
		.waitFor({ state: 'detached', timeout: PHASE7_UI_MS });
	return pressFormAction(
		page,
		'markSatisfied',
		row.getByRole('button', { name: 'Mark Satisfied', exact: true }),
		PHASE7_SIGN_OFF_MS,
		decode
	);
}

// ── ⭐⭐ `JAN-EXEC` P7-6R R-1f — THE RUN PLAN'S RULE, ACTED AS THE OPERATOR (`REG-D-105` (4)) ────────────────────────────
//
// The paid run is unattended, so the person's choice at a stop (`REG-D-104` (1)) is made by a rule the sponsor approved
// in the run plan (`DESIGN-the-stopped-unit-recovery.md` §5): a review that did not conclude is re-run once; a review that
// concluded against the work has its work re-run once, with the findings; a re-run refused again is abandoned.
// ⛔ THE LANE IS THE OPERATOR, NEVER THE ENGINE: each act posts the page's own form, with the rule's rationale typed, so
// each choice is recorded as the operator's Decision. ⭑ Which re-run is the rule's is read off the ROW — Re-run the review
// is offered only after a review that did not conclude (RD3) — so the lane asks the page the question the server answers.

/** ⭐ P7-6R R-1f — what a waiting unit's row offers (R-1d): read off the row, once it is drawn. */
export interface RecoveryOffers {
	readonly rerunReview: boolean;
	readonly rerunWork: boolean;
	readonly abandon: boolean;
}

/** The page's three acts on a waiting unit, by their form actions. */
export type RecoveryAct = 'rerunReview' | 'rerunWork' | 'abandonPwu';

/**
 * ⭐ THE RATIONALE EACH ACT TYPES: the run plan's rule, naming itself, so a reader of the Decision learns that the operator
 * followed a rule the sponsor approved and which limb of it this was (`REG-D-105` (4)).
 */
export const RULE_RATIONALE: Readonly<Record<RecoveryAct, string>> = {
	rerunReview: 'The run plan’s rule, REG-D-105 (4): a review that did not conclude is re-run once.',
	rerunWork:
		'The run plan’s rule, REG-D-105 (4): a review that concluded against the work has its work re-run once, with the findings.',
	abandonPwu: 'The run plan’s rule, REG-D-105 (4): a re-run that is refused again is abandoned.'
};

/** ⭐ P7-6R R-1f — the choices the row offers, once it is drawn. ⚠ Waited for first, as `recordAssurance` waits. */
export async function recoveryOffers(row: Locator): Promise<RecoveryOffers> {
	await row.waitFor({ timeout: PHASE7_UI_MS, state: 'visible' });
	const offered = async (testId: string): Promise<boolean> =>
		(await row.getByTestId(testId).count()) > 0;
	return {
		rerunReview: await offered('rerun-review'),
		rerunWork: await offered('rerun-work'),
		abandon: await offered('abandon-rationale')
	};
}

/**
 * ⭐ P7-6R R-1f — one recovery act on the unit in `row`, the run plan's rationale typed into the act's own field. ⚠ A re-run
 * is waited for up to ONE PHASE'S ALLOWANCE (D4): a re-run of the work runs the phase again, and a re-review runs its
 * floors. An abandonment calls no model, and is bounded as a sign-off act is.
 * ⭐ P7-6 B3 — EACH FILL AND CLICK IS BOUNDED BY `PHASE7_UI_MS`, its own: a field the row does not carry (the abandonment's
 * is rendered for a WAITING unit only) fails there, thrown, never waited on for as long as the page's default says.
 * ⛔ The rule asks the row before it presses (`recoverByRule`); this bound is what holds if the row changed between.
 */
export async function recover(
	page: Page,
	row: Locator,
	act: RecoveryAct,
	decode: Decode
): Promise<ActionOutcome> {
	if (act === 'abandonPwu') {
		await row.getByTestId('abandon-rationale').fill(RULE_RATIONALE[act], { timeout: PHASE7_UI_MS });
		return pressFormAction(
			page,
			act,
			row.getByRole('button', { name: 'Abandon', exact: true }),
			PHASE7_SIGN_OFF_MS,
			decode
		);
	}
	const testId = act === 'rerunReview' ? 'rerun-review' : 'rerun-work';
	await row.getByTestId(`${testId}-rationale`).fill(RULE_RATIONALE[act], { timeout: PHASE7_UI_MS });
	return pressFormAction(page, act, row.getByTestId(testId), PHASE7_UNIT_ALLOWANCE_MS, decode);
}

/** What the run record keeps of one sign-off act: its status and envelope, and the unit as the STORE read it after. */
export interface SignOffAct {
	readonly status: number | null;
	readonly envelopeType: EnvelopeType | null;
	/**
	 * ⭐ E12's re-review F1 (D4) — set when no answer came within the act's bound, or its request failed in transit: the
	 * server may still be running it, and the run ended there (`unansweredEnd`).
	 */
	readonly timedOutAfterMs: number | null;
	readonly requestFailure: string | null;
	/**
	 * ⭐ E12's re-review F4 — the server's refusal, in its own words, of an act it answered with anything but success; else
	 * null. Kept on the act, so a Record Assurance refused before the rule's re-run keeps its reason whatever follows it.
	 */
	readonly refusal: string | null;
	/**
	 * ⭐ D5 — read after the act (`REG-F-540`): an envelope is not the record. ⭐ E12's polish (the confirm's F1 residue) — null
	 * while that read has not come back: the act is kept on the unit's record before it (`actOf`), so a read that throws — the
	 * server gone — leaves the act here with its bound, and no state.
	 */
	readonly after: UnitState | null;
}

/**
 * What the run record keeps of a sign-off: each act, with its own refusal, and ~~the first refused, if one was~~ ⭐ E12's
 * re-review F4 — the refusal that STANDS (`refused`), if one does: the rule's re-run follows a refused Record Assurance, so
 * "the first" was never what the record kept.
 */
export interface SignOffRecord {
	/** Whether the row offered Record Assurance at all: a unit that did not complete offers none. */
	readonly offered: boolean;
	/**
	 * ⭐ `E12F` F2 — THE LIMIT, read before Record Assurance with the sign-off's own worst case counted (`signOffWorstCase`,
	 * D8). null dry — a dry run presses nothing that calls a model (`REG-D-112` (b)).
	 */
	readonly limitCheck: LimitCheck | null;
	readonly recordAssurance: SignOffAct | null;
	/**
	 * ⭐ `E12F` F3 (`REG-D-105` (4), applied by `REG-D-112` (a)) — THE RULE'S ONE RE-RUN of the declared reviews that did not
	 * conclude: pressed only when Record Assurance ANSWERED with a refusal and the row, read afresh, offers it, the limit read
	 * first (`rerunLimitCheck`). null when not pressed. A re-run refused is left as found: never a second.
	 */
	readonly rerunDeclared: SignOffAct | null;
	readonly rerunLimitCheck: LimitCheck | null;
	readonly markSatisfied: SignOffAct | null;
	/**
	 * ⭐ E12's re-review F4 — THE REFUSAL THAT STANDS: the last act pressed, when it was refused or got no answer — what left
	 * the sign-off unfinished. null when none does: nothing was pressed, or the sign-off was accepted, a Record Assurance the
	 * rule's accepted re-run stood in for included (its own reason stays on its act, `SignOffAct.refusal`).
	 */
	readonly refused: {
		readonly act: 'Record Assurance' | 'Re-run the declared reviews' | 'Mark Satisfied';
		readonly reason: string;
	} | null;
	/**
	 * ⭐ `E12F` F1, F2 — WHY AN ACT THAT ASKS A REVIEWER WAS NOT PRESSED: a dry run (`DRY_SIGN_OFF_NOT_REACHED`, `REG-D-112`
	 * (b)), or the limit (D8), which then stops the lane. null when nothing the row offered was held back.
	 */
	readonly notPressed: string | null;
}

/**
 * ⭐⭐ `E12F` F1 (the E12 package review's first finding; `REG-D-112` (b): *a dry run calls no model*) — WHAT A DRY RUN'S
 * SIGN-OFF RECORDS IN PLACE OF RECORD ASSURANCE: not reached. ⛔ Since E2 Record Assurance asks the reviewer for one review per
 * declared policy (`REG-D-110` (3)), so the dry run's sign-off of the root by the paid run's own acts (D11) would have asked
 * it to review each of the root's two — paid calls, which `laneVerdict`'s *"the dry run recorded N model exchange(s)"*
 * would then have counted. Everything before the press is rehearsed: the page loaded afresh, the root's row waited for,
 * and Record Assurance found on it — never pressed.
 */
export const DRY_SIGN_OFF_NOT_REACHED =
	'not reached in a dry run: Record Assurance asks the reviewer to judge each of the unit’s declared policies, and a dry run calls no model (REG-D-112 (b)); the page was loaded afresh, the row waited for and Record Assurance found on it, and nothing was pressed';

/**
 * ⭐ `E12F` F3 — THE RATIONALE THE RULE TYPES when it re-runs a unit's declared reviews that did not conclude: the run plan's
 * rule, naming itself and the decision that extends it, so a reader of the Decision learns which limb this was.
 */
export const DECLARED_RERUN_RATIONALE =
	'The run plan’s rule, REG-D-105 (4), as REG-D-112 (a) extends it to the declared reviews: a declared review that did not conclude is re-run once.';

/** `lane/actions/…`'s body: the unit, the action, and what came back, raw and decoded. */
export const actionRecordOf = (unit: RunUnit, action: string, o: ActionOutcome) => ({
	unit: { order: unit.order, slug: unit.slug, title: unit.title, unitId: unit.unitId },
	action,
	status: o.status,
	envelopeType: o.envelopeType,
	timedOutAfterMs: o.timedOutAfterMs,
	requestFailure: o.requestFailure,
	rawBody: o.rawBody,
	decoded: o.decoded
});

// ── THE RUN'S ORDER (D4, D5, D8) ─────────────────────────────────────────────────────────────────────────────────────

/** Where the run ended, and why. */
export interface RunEnd {
	readonly reason: EndReason;
	readonly detail: string;
}

/**
 * ⛔ D4 — a Begin & Execute with NO ANSWER ends the run there, in either kind: it outlasted its allowance, or its
 * request failed in transit. Either way the server may still be running the unit, so the next is never started beside
 * it (`REG-F-535`, `REG-F-527`). Null for a press that was answered, whatever it said. ⭐ So does any other act the lane
 * presses with no answer, named by `act`: a recovery act the rule presses, and ⭐ E12's re-review F1 — a sign-off act.
 */
export function unansweredEnd(
	title: string,
	o: ActionOutcome,
	act = 'Begin & Execute'
): RunEnd | null {
	if (o.timedOutAfterMs !== null)
		return {
			reason: 'allowance-exceeded',
			detail: `${title}'s ${act} outlasted its allowance of ${o.timedOutAfterMs} ms`
		};
	if (o.requestFailure !== null)
		return {
			reason: 'request-failed',
			detail:
				`${title}'s ${act} failed in transit (${o.requestFailure}): the server may have stopped, or ` +
				'may still be running it'
		};
	return null;
}

/** One archive the run asks its hands for (`archiveUnit`). */
export interface ArchiveCall {
	/** `<NN>-<slug>`, or `06-final`. */
	readonly name: string;
	readonly undertakingId: string;
	/** null for the final archive. */
	readonly unitId: string | null;
	/** The unit's Begin & Execute refusal, when it was refused. */
	readonly refusal: string | null;
	readonly dump: Dump;
	/** ⭐ The capture folders the PREVIOUS archive held: the folders name no unit, so K5 diffs each archive with the last. */
	readonly capturesBefore: readonly string[];
}

/**
 * ⭐ What the run does with the page and the server — its HANDS, which the spec builds from the page and verif builds
 * of its own, so the run's order is driven with no browser, no server and no model.
 */
export interface LaneHands {
	/** Type the PWA, publish it, create the Undertaking, and read its units from the store, by title. */
	readonly setUp: (
		note: (problem: string | null) => void
	) => Promise<ReadonlyMap<string, ObjectRow>>;
	/** Begin & Execute on the unit's row (`beginExecute`). */
	readonly beginExecute: (unit: RunUnit) => Promise<ActionOutcome>;
	/** Load the Undertaking page afresh and show its overview, whose rows carry the acts. */
	readonly showOverview: () => Promise<void>;
	/** Record Assurance on the unit's row, or null when the row offers none (`recordAssurance`). */
	readonly recordAssurance: (unit: RunUnit) => Promise<ActionOutcome | null>;
	/** ⭐ `E12F` F1 — whether the unit's row offers Record Assurance, read and never pressed (`recordAssuranceOffered`). */
	readonly recordAssuranceOffered: (unit: RunUnit) => Promise<boolean>;
	/** ⭐ `E12F` F3 — whether the unit's row offers re-running its declared reviews that did not conclude (`declaredRerunOffered`). */
	readonly declaredRerunOffered: (unit: RunUnit) => Promise<boolean>;
	/** ⭐ `E12F` F3 — the rule's re-run of the unit's declared reviews that did not conclude (`rerunDeclared`). */
	readonly rerunDeclared: (unit: RunUnit) => Promise<ActionOutcome>;
	/** Mark Satisfied on the unit's row, once Record Assurance has left it (`markSatisfied`). */
	readonly markSatisfied: (unit: RunUnit) => Promise<ActionOutcome>;
	/** ⭐ P7-6R R-1f — what the unit's row offers after a stop (`recoveryOffers`). */
	readonly recoveryOffers: (unit: RunUnit) => Promise<RecoveryOffers>;
	/** ⭐ P7-6R R-1f — one recovery act on the unit's row, the run plan's rationale typed (`recover`). */
	readonly recover: (unit: RunUnit, act: RecoveryAct) => Promise<ActionOutcome>;
	/** The server's dump, through a fresh request context (`freshIntrospect`). */
	readonly read: () => Promise<Dump>;
	/** Archive the run as it stands and check it (`archiveUnit`): the capture folders the archive holds. */
	readonly archive: (call: ArchiveCall) => Promise<readonly string[]>;
	/** A screenshot into the lane's own folder; why not, if not. */
	readonly screenshot: (name: string) => Promise<string | null>;
}

/**
 * ⭐⭐ THE RUN, IN ITS ORDER (D4, D5, D8, D11) — and its record, written as it goes, so a run cut off part-way leaves what
 * it reached:
 *   1. the boot record; a refused boot ends the run there, `refused-at-boot`, with nothing pressed;
 *   2. the PWA and the Undertaking (`setUp`), and its units — one per type, or the run ends here;
 *   3. Begin & Execute on the ROOT, then on each PHASE in order, each only after the one before has answered
 *      (`REG-F-535`), each answer kept raw, the unit's state READ FROM THE STORE (`REG-F-540`), and the run archived and
 *      checked. ⛔ A press with NO ANSWER — the root's included — ends the run there (`unansweredEnd`, D4). Before each
 *      phase, the LIMIT (D8), or the run ends `paid-limit`. A phase that stops is left as found, and the later ones
 *      still run, each recorded as having an upstream nothing assured (D5). ⛔ DRY, NO PHASE IS PRESSED (D1): each is a
 *      unit a model runs, so the run goes from the root's archive straight to 4;
 *   3b. ⭐ P7-6R R-1f — A PHASE THAT STOPPED AT ITS REVIEW IS RECOVERED BY THE RUN PLAN'S RULE, AS THE OPERATOR, before the
 *      next starts (`REG-D-105` (4); `recoverByRule`): re-run the review if the row offers it, else re-run the work, the
 *      LIMIT checked first as between phases (D8); and a re-run refused again is abandoned. ⛔ A re-run with no answer
 *      ends the run as a Begin & Execute with none does (D4); ⭐ P7-6 B3 — "refused again" is the STORE's reading (a new
 *      plan whose step waits), and a re-run never made, or one that left the unit RUNNING or FAILED, is left as found;
 *   4. SIGN-OFF: each phase that completed, then the root LAST, the page loaded afresh for each, the store read after
 *      every act, every refusal recorded and none asserted; then the final archive, `06-final`. ⭐ `E12F` F2 — THE LIMIT
 *      BEFORE EACH SIGN-OFF, its own worst case counted (`signOffWorstCase`): one that would cross it is not pressed, nor is
 *      any later sign-off, and the run ends `paid-limit`. ⭐ `E12F` F3 — A RECORD ASSURANCE ANSWERED WITH A REFUSAL, whose
 *      row, read afresh, then offers re-running the declared reviews that did not conclude, has them re-run ONCE by the rule
 *      (`REG-D-105` (4), `REG-D-112` (a)), the limit read first; accepted, Mark Satisfied follows; refused, the unit is left
 *      as found. ⛔ E12's re-review F1 — A SIGN-OFF ACT WITH NO ANSWER ENDS THE RUN THERE, as a Begin & Execute with none
 *      does (`unansweredEnd`, D4): its unit's declared reviews may still be running, so nothing is pressed beside them, and
 *      the final archive is taken. ~~DRY TOO, BY THE SAME ACTS (design §6 P7-2 D11): no phase completed, so the root is signed off alone.
 *      Signing off calls no model~~ ⛔ `E12F` F1: FALSE SINCE E2 — Record Assurance asks the reviewer for one review per
 *      declared policy. ⭐ DRY, THE ROOT'S SIGN-OFF STOPS BEFORE THE REVIEWER CALL, SO SIGNING OFF CALLS NO MODEL
 *      (`REG-D-112` (b)): everything before the press rehearsed — the page loaded afresh, the root's row waited for, Record
 *      Assurance found on it — and nothing pressed, the sign-off recorded `DRY_SIGN_OFF_NOT_REACHED`; then the final
 *      archive, so it still first runs here and not in the paid run;
 *   5. DRY, the model exchanges the store holds — read only now, AFTER the sign-off and the final archive, so that a model
 *      call anything here made is counted — and the run ends `dry-run-stop` (D1, D11).
 * ⛔ A throw ends the run `lane-error`, its record written before it is rethrown — save after a press with no answer,
 * whose end it keeps: the archive of a unit still running can fail, and must not relabel why the run ended.
 */
export async function runTheLane(r: {
	readonly boot: Boot;
	readonly lane: LanePaths;
	readonly hands: LaneHands;
	/** Writes out every POST still unanswered (`logPosts`). */
	readonly flushPosts: () => void;
}): Promise<RunRecord> {
	const { boot, lane, hands } = r;
	const record: RunRecord = {
		mode: boot.record.mode,
		units: unpressed(PHASE7_ARCHIVE_UNITS),
		dryRun: null,
		end: null,
		problems: []
	};
	const end = (reason: EndReason, detail?: string): RunRecord => {
		record.end = {
			reason,
			at: new Date().toISOString(),
			...(detail === undefined ? {} : { detail })
		};
		r.flushPosts();
		writeRunRecord(lane, record);
		return record;
	};
	const note = (problem: string | null): void => {
		if (problem !== null) record.problems.push(problem);
	};
	/** The end a press with no answer reached, kept for a throw after it. */
	const reached: { end: RunEnd | null } = { end: null };
	writeOnce(lane.boot, boot.record);
	if (boot.refusals.length > 0) return end('refused-at-boot', boot.refusals.join('\n'));

	try {
		// ── 2. THE PWA AND THE UNDERTAKING ──────────────────────────────────────────────────────────────────────────
		const created = await hands.setUp(note);
		const titles = [...created.keys()].sort(byCodeUnit);
		const declared = record.units.map((u) => u.title).sort(byCodeUnit);
		if (titles.join('\n') !== declared.join('\n'))
			throw new Error(
				`instantiation did not build one unit per type: the store holds ${JSON.stringify(titles)}, not ` +
					JSON.stringify(declared)
			);
		for (const u of record.units) u.unitId = created.get(u.title)!.id;
		const root = record.units[0]!;
		const phases = record.units.slice(1);
		const undertakingId = str(created.get(root.title)!.state.undertakingId);
		writeRunRecord(lane, record);

		// ── 3. EACH UNIT: BEGIN & EXECUTE, THE STORE READ, THE RUN ARCHIVED AND CHECKED ─────────────────────────────
		let capturesBefore: readonly string[] = [];
		const archive = async (
			name: string,
			unitId: string | null,
			refusal: string | null,
			dump: Dump
		): Promise<void> => {
			capturesBefore = await hands.archive({
				name,
				undertakingId,
				unitId,
				refusal,
				dump,
				capturesBefore
			});
		};
		/**
		 * ⭐ P7-6R R-1f — ONE RECOVERY ACT on a stopped phase: pressed with the run plan's rationale, its answer kept, the unit
		 * read from the STORE after it (`REG-F-540`), and the run record written. The end a press with no answer reached, or
		 * null. ⚠ No archive of its own: the unit's archive was taken after its Begin & Execute, and the final archive holds
		 * what the recovery added.
		 */
		const recoveryAct = async (
			unit: RunUnit,
			act: RecoveryAct,
			check: LimitCheck | null,
			/** ⭐ P7-6 B3 — the unit's last plan before a re-run, which its new plan B is told apart from; null for an abandonment. */
			planBefore: string | null
		): Promise<RunEnd | null> => {
			const outcome = await hands.recover(unit, act);
			writeOnce(actionFile(lane, unit, act), actionRecordOf(unit, act, outcome));
			reached.end = unansweredEnd(unit.title, outcome, act);
			const answered = reached.end === null;
			// ⛔ E12's polish (the confirm's F1 residue, its general form) — THE ACT IS KEPT BEFORE THE STORE IS READ, as `run` keeps
			// a Begin & Execute's: a read that throws — or the page's reload before it — leaves the act and its bound in
			// lane/run.json, its `after` and `reading` null. ⛔ It was pushed only after the read, so such a throw lost it, and the
			// report's check of the lane's end found no act that outlasted its bound.
			const kept: RecoveryRecord = {
				act,
				rationale: RULE_RATIONALE[act],
				limitCheck: check,
				status: outcome.status,
				envelopeType: outcome.envelopeType,
				timedOutAfterMs: outcome.timedOutAfterMs,
				requestFailure: outcome.requestFailure,
				after: null,
				reading: null,
				refusal: answered && outcome.envelopeType !== 'success' ? refusalOf(outcome) : null,
				notPressed: null
			};
			unit.recovery.push(kept);
			writeRunRecord(lane, record);
			// ⚠ As a press: an `error` envelope or a redirect leaves the row gone, so the page is loaded afresh first.
			const rowGone = !['success', 'failure'].includes(outcome.envelopeType ?? '');
			if (reached.end === null && rowGone) await hands.showOverview();
			const { snapshot } = await hands.read();
			const after = unitStateOf(snapshot, unit.unitId!);
			// The kept act, completed by the read.
			unit.recovery.splice(-1, 1, {
				...kept,
				after,
				// ⭐ P7-6 B3 — READ FROM THE STORE: what the re-run came to, which is what the rule decides by.
				reading: act !== 'abandonPwu' && answered ? rerunReading(planBefore, snapshot, unit.unitId!) : null
			});
			unit.after = after;
			unit.stopped = stoppedAfter(outcome.envelopeType, after);
			writeRunRecord(lane, record);
			return reached.end;
		};
		/** An act the rule did not press, and why — the limit (D8), or a row that did not offer it (P7-6 B3). */
		const notPressed = (unit: RunUnit, act: RecoveryAct, check: LimitCheck | null, why: string): void => {
			unit.recovery.push({
				act,
				rationale: RULE_RATIONALE[act],
				limitCheck: check,
				status: null,
				envelopeType: null,
				timedOutAfterMs: null,
				requestFailure: null,
				after: null,
				reading: null,
				refusal: null,
				notPressed: why
			});
			writeRunRecord(lane, record);
		};
		/**
		 * ⭐⭐ P7-6R R-1f — THE RUN PLAN'S RULE ON ONE STOPPED PHASE (`REG-D-105` (4)): the row read afresh; re-run the review
		 * if the row offers it — a review that did not conclude — else re-run the work, with the findings; the LIMIT checked
		 * before the re-run, as between phases (D8); and a re-run refused again is abandoned. Returns the end a press with no
		 * answer reached, `'paid-limit'` when the limit stopped the re-run, or null.
		 * ⚠ A STOP THE ROW OFFERS NO RE-RUN FOR — a step that failed, which is R-2's; a substituted reviewer — is left as found,
		 * as before R-1, and never abandoned by the rule.
		 * ⭐⭐ P7-6 B3 (the fix round) — "REFUSED AGAIN" IS READ FROM THE STORE (`rerunReading`), never from "it stopped". ⛔ The
		 * rule abandoned on any stop after the re-run, and two are no such refusal: a press the server refused before
		 * dispatching anything (`not-made`: no plan B, the unit waiting as before — abandoned under a false rationale, the row's
		 * other re-run skipped), and a re-run that left the unit RUNNING or FAILED (`stopped-otherwise`, R-2's — whose row
		 * renders no abandonment's field, so the fill threw and ended the run `lane-error`, the final archive never taken).
		 * Each of those is left as found, recorded with the server's words. ⛔ And the abandonment is pressed only when the
		 * row, read again, OFFERS it: never a control the row does not offer.
		 */
		const recoverByRule = async (unit: RunUnit): Promise<RunEnd | 'paid-limit' | null> => {
			await hands.showOverview();
			const offers = await hands.recoveryOffers(unit);
			if (!offers.rerunReview && !offers.rerunWork) return null;
			const rerun: RecoveryAct = offers.rerunReview ? 'rerunReview' : 'rerunWork';
			const { snapshot } = await hands.read();
			const check = limitCheck(boot.prior as number, recordedReviewerCalls(snapshot));
			if (!check.allowed) {
				notPressed(unit, rerun, check, `the limit: ${check.total} of ${check.limit} reviewer calls (D8)`);
				return 'paid-limit';
			}
			const rerunEnd = await recoveryAct(unit, rerun, check, planIdOf(snapshot, unit.unitId!));
			// ⭐ B3 — only a re-run the store reads as REFUSED AGAIN goes on to the abandonment; any other is left as found.
			if (rerunEnd !== null || unit.recovery.at(-1)?.reading !== 'refused-again') return rerunEnd;
			// ⚠ LOADED AFRESH: a refusal leaves the page stale, and the row it shows may predate the re-run's own wait.
			await hands.showOverview();
			if (!(await hands.recoveryOffers(unit)).abandon) {
				notPressed(unit, 'abandonPwu', null, 'the row, read again after the re-run, offers no abandonment');
				return null;
			}
			return recoveryAct(unit, 'abandonPwu', null, null);
		};

		/** Begin & Execute on `unit`, then its state and its archive; the end it reached, if it reached one. */
		const run = async (unit: RunUnit): Promise<RunEnd | null> => {
			const outcome = await hands.beginExecute(unit);
			writeOnce(
				actionFile(lane, unit, 'beginExecute'),
				actionRecordOf(unit, 'beginExecute', outcome)
			);
			unit.beginExecute = {
				status: outcome.status,
				envelopeType: outcome.envelopeType,
				timedOutAfterMs: outcome.timedOutAfterMs,
				requestFailure: outcome.requestFailure
			};
			reached.end = unansweredEnd(unit.title, outcome);
			// ⚠ An `error` envelope renders the error page, and a redirect leaves the page: either way the next unit's row
			// is gone, so the page is loaded again. A refusal (`failure`) leaves the page stale but its rows in place.
			if (
				reached.end === null &&
				outcome.envelopeType !== 'success' &&
				outcome.envelopeType !== 'failure'
			)
				await hands.showOverview();
			const dump = await hands.read();
			unit.after = unitStateOf(dump.snapshot, unit.unitId!);
			unit.stopped = stoppedAfter(outcome.envelopeType, unit.after);
			note(await hands.screenshot(unit.archive));
			await archive(
				unit.archive,
				unit.unitId,
				outcome.envelopeType === 'failure' ? refusalOf(outcome) : null,
				dump
			);
			writeRunRecord(lane, record);
			return reached.end;
		};

		// ⛔ THE ROOT'S PRESS IS BOUNDED AS EVERY PRESS IS (D4): with no answer, the run ends here, dry or paid.
		const rootEnd = await run(root);
		if (rootEnd !== null) return end(rootEnd.reason, rootEnd.detail);
		// ⛔ DRY, NO PHASE IS PRESSED — each is a unit a model runs (D1, D5) — and the run goes from the root's archive to
		// the sign-off below, the root's alone, and the final archive: ~~the paid run's own acts (design §6 P7-2 D11)~~ ⭐
		// `E12F` F1: the sign-off rehearsed up to the reviewer call and never pressed (`REG-D-112` (b)).
		const dry = boot.record.mode === 'dry';
		let reason: EndReason = dry ? 'dry-run-stop' : 'complete';
		for (const unit of dry ? [] : phases) {
			unit.limitCheck = limitCheck(
				boot.prior as number,
				recordedReviewerCalls((await hands.read()).snapshot)
			);
			if (!unit.limitCheck.allowed) {
				reason = 'paid-limit';
				writeRunRecord(lane, record);
				break;
			}
			unit.upstreamNotAssured = upstreamNotAssured(record.units, unit.order);
			const ended = await run(unit);
			// ⛔ THE SERVER MAY STILL BE RUNNING IT, so nothing is started beside it (D4; `REG-F-535`). When the test ends,
			// Playwright kills the server mid-unit (`REG-F-527`): its record is the archive just taken.
			if (ended !== null) return end(ended.reason, ended.detail);
			// ⭐ P7-6R R-1f — a phase that stopped is recovered by the run plan's rule before the next starts.
			if (unit.stopped === true) {
				const recovered = await recoverByRule(unit);
				if (recovered === 'paid-limit') {
					reason = 'paid-limit';
					break;
				}
				if (recovered !== null) return end(recovered.reason, recovered.detail);
			}
		}

		// ── 4. SIGN-OFF: each phase that completed, then the root, LAST — every refusal recorded ─────────────────────
		// ~~⭐ DRY TOO, BY THESE SAME ACTS (D11): no phase was pressed, so none completed, and the root is signed off alone.~~
		// ⛔ `E12F` F1 (`REG-D-112` (b)) — DRY, THE ROOT'S SIGN-OFF IS REHEARSED UP TO THE REVIEWER CALL AND NO FURTHER: since E2
		// Record Assurance asks the reviewer for one review per declared policy, and a dry run calls no model.
		/**
		 * The act's status and envelope, or that no answer came, and ⭐ its refusal in the server's words (E12's re-review F4) —
		 * ⭐ E12's polish — the store not read yet (`after` null).
		 */
		const pressedAct = (o: ActionOutcome): SignOffAct => ({
			status: o.status,
			envelopeType: o.envelopeType,
			timedOutAfterMs: o.timedOutAfterMs,
			requestFailure: o.requestFailure,
			refusal:
				o.timedOutAfterMs === null && o.requestFailure === null && o.envelopeType !== 'success' ? refusalOf(o) : null,
			after: null
		});
		/**
		 * The act, and the unit as the store reads it now (`REG-F-540`). ⛔ E12's polish (the confirm's F1 residue) — THE ACT IS
		 * KEPT ON THE UNIT'S RECORD FIRST (`kept`: the sign-off as it stands with this act), as `run` keeps a Begin & Execute's:
		 * the record was assigned only when `signOff` returned, so a read that threw — the server gone beside reviews still
		 * running — left lane/run.json no sign-off for the unit, and the report read the lane's own end as a problem with its
		 * inputs and the unit's sign-off as never attempted.
		 */
		const actOf = async (
			unit: RunUnit,
			o: ActionOutcome,
			kept: (act: SignOffAct) => SignOffRecord
		): Promise<SignOffAct> => {
			const act = pressedAct(o);
			unit.signOff = kept(act);
			writeRunRecord(lane, record);
			return { ...act, after: unitStateOf((await hands.read()).snapshot, unit.unitId!) };
		};
		const none = {
			limitCheck: null,
			recordAssurance: null,
			rerunDeclared: null,
			rerunLimitCheck: null,
			markSatisfied: null,
			refused: null,
			notPressed: null
		} as const;
		/** ⭐ `E12F` F2 — the limit, read from the store now, with `unit`'s sign-off worst case counted (D8). */
		const signOffLimit = async (unit: RunUnit): Promise<LimitCheck> =>
			limitCheck(boot.prior as number, recordedReviewerCalls((await hands.read()).snapshot), signOffWorstCase(unit));
		const overLimit = (check: LimitCheck): string =>
			`the limit: ${check.total} of ${check.limit} reviewer calls, the sign-off's own ${check.ahead ?? 0} counted (D8; E12F F2)`;
		/**
		 * Mark Satisfied, after an ACCEPTED Record Assurance or an accepted re-run of the declared reviews — ⭐ E12's polish —
		 * `before`, the sign-off as it then stands, keeping the act before the store is read (`actOf`). ⛔ E12's re-review F1 —
		 * with no answer it ends the run, as every act the lane presses does (D4); the end is set before the store is read, so a
		 * read that fails keeps it.
		 */
		const satisfy = async (
			unit: RunUnit,
			before: SignOffRecord
		): Promise<{ act: SignOffAct; refused: SignOffRecord['refused'] }> => {
			const green = await hands.markSatisfied(unit);
			writeOnce(actionFile(lane, unit, 'markSatisfied'), actionRecordOf(unit, 'markSatisfied', green));
			reached.end = unansweredEnd(unit.title, green, 'Mark Satisfied');
			const refused: SignOffRecord['refused'] =
				green.envelopeType === 'success' ? null : { act: 'Mark Satisfied', reason: refusalOf(green) };
			return { act: await actOf(unit, green, (act) => ({ ...before, markSatisfied: act, refused })), refused };
		};
		/**
		 * ⭐ Record Assurance, then — only if it was ACCEPTED — Mark Satisfied, asserting neither (D5). ⭐ `E12F` F1 — DRY, the
		 * row read and nothing pressed. ⭐ `E12F` F2 — the limit read first, its worst case counted; refused, nothing is pressed
		 * (the loop below then stops the lane). ⭐ `E12F` F3 — a Record Assurance ANSWERED with a refusal whose row, read
		 * afresh, offers re-running the declared reviews that did not conclude: re-run once by the rule, the limit read first;
		 * accepted, Mark Satisfied; refused, left as found. ⛔ E12's re-review F1 — an act with NO ANSWER sets the run's end
		 * (`reached`) before the store is read, and nothing more is pressed (the loop below then ends the run).
		 */
		const signOff = async (unit: RunUnit): Promise<SignOffRecord> => {
			if (dry) {
				const offered = await hands.recordAssuranceOffered(unit);
				return { ...none, offered, notPressed: offered ? DRY_SIGN_OFF_NOT_REACHED : null };
			}
			const check = await signOffLimit(unit);
			if (!check.allowed) {
				const offered = await hands.recordAssuranceOffered(unit);
				return { ...none, offered, limitCheck: check, notPressed: offered ? overLimit(check) : null };
			}
			const assured = await hands.recordAssurance(unit);
			if (assured === null) return { ...none, offered: false, limitCheck: check };
			writeOnce(
				actionFile(lane, unit, 'recordAssurance'),
				actionRecordOf(unit, 'recordAssurance', assured)
			);
			const refusedAssurance = { act: 'Record Assurance' as const, reason: refusalOf(assured) };
			/** ⭐ E12's polish — the sign-off as it stands with Record Assurance: kept on the unit before each store read after it. */
			const assuredRecord = (act: SignOffAct): SignOffRecord => ({
				...none,
				offered: true,
				limitCheck: check,
				recordAssurance: act,
				refused: assured.envelopeType === 'success' ? null : refusedAssurance
			});
			// ⛔ E12's re-review F1 (D4; `REG-F-535`) — A RECORD ASSURANCE WITH NO ANSWER ENDS THE RUN: its declared reviews may
			// still be running on the server, and each records its calls only when it finishes, so a press beside them would run
			// two units' reviews at once against a limit read short of their calls.
			reached.end = unansweredEnd(unit.title, assured, 'Record Assurance');
			const assuredAct = await actOf(unit, assured, assuredRecord);
			if (assured.envelopeType === 'success') {
				const green = await satisfy(unit, assuredRecord(assuredAct));
				return { ...none, offered: true, limitCheck: check, recordAssurance: assuredAct, markSatisfied: green.act, refused: green.refused };
			}
			const asRefused = assuredRecord(assuredAct);
			// ⛔ ONLY AN ANSWERED REFUSAL: a press with no answer may still be running its reviews on the server (D4), so the rule
			// presses nothing beside it, and ⭐ E12's re-review F1 — the run ends there.
			if (reached.end !== null) return asRefused;
			// ⭐ `E12F` F3 — THE RULE (`REG-D-105` (4), `REG-D-112` (a)): ⚠ the page loaded afresh, as the rule's own reads are —
			// a refusal leaves it stale. A row offering no declared re-run is left as found.
			await hands.showOverview();
			if (!(await hands.declaredRerunOffered(unit))) return asRefused;
			const rerunCheck = await signOffLimit(unit);
			if (!rerunCheck.allowed) return { ...asRefused, rerunLimitCheck: rerunCheck, notPressed: overLimit(rerunCheck) };
			const again = await hands.rerunDeclared(unit);
			writeOnce(
				actionFile(lane, unit, 'rerunDeclaredReviews'),
				actionRecordOf(unit, 'rerunDeclaredReviews', again)
			);
			/** ⭐ E12's polish — and as it stands with the rule's re-run: kept on the unit before each store read after it. */
			const rerunRecord = (act: SignOffAct): SignOffRecord => ({
				...asRefused,
				rerunLimitCheck: rerunCheck,
				rerunDeclared: act,
				refused: again.envelopeType === 'success' ? null : { act: 'Re-run the declared reviews', reason: refusalOf(again) }
			});
			// ⛔ E12's re-review F1 (D4) — the rule's re-run with no answer ends the run too: its reviews may still be running.
			reached.end = unansweredEnd(unit.title, again, 'Re-run the declared reviews');
			const againAct = await actOf(unit, again, rerunRecord);
			if (again.envelopeType !== 'success') return rerunRecord(againAct);
			const green = await satisfy(unit, rerunRecord(againAct));
			return {
				...rerunRecord(againAct),
				markSatisfied: green.act,
				refused: green.refused
			};
		};
		for (const unit of [...phases.filter((u) => u.stopped === false), root]) {
			// ⚠ LOADED AFRESH FOR EACH UNIT: after an `error` envelope the page is the error page, and after a redirect it is
			// another page, so this unit's row would be gone, and read as offering nothing (round 2's fix pass).
			await hands.showOverview();
			unit.signOff = await signOff(unit);
			writeRunRecord(lane, record);
			// ⛔ E12's re-review F1 (D4; `REG-F-535`) — A SIGN-OFF ACT WITH NO ANSWER: no later sign-off is pressed beside it, and
			// the run ends for it once the final archive is taken.
			if (reached.end !== null) break;
			// ⛔ `E12F` F2 — THE LIMIT REFUSED THIS SIGN-OFF, OR THE RULE'S RE-RUN IN IT: the run ends `paid-limit`, and no later
			// sign-off is pressed, as no later phase is once the limit stops one (D8).
			if (unit.signOff.limitCheck?.allowed === false || unit.signOff.rerunLimitCheck?.allowed === false) {
				reason = 'paid-limit';
				break;
			}
		}
		note(await hands.screenshot(FINAL_ARCHIVE));
		await archive(FINAL_ARCHIVE, null, null, await hands.read());
		// ⛔ DRY, WHAT `laneVerdict` HOLDS IT TO (D1): the model exchanges the store holds, read only now — after the
		// sign-off and the final archive — so that a model call anything before made, the sign-off's rehearsal included, is
		// counted (D11).
		if (dry)
			record.dryRun = { modelExchanges: (await hands.read()).snapshot.modelExchanges.length };
		return reached.end === null ? end(reason) : end(reached.end.reason, reached.end.detail);
	} catch (e) {
		const why = e instanceof Error ? e.message : String(e);
		if (record.end === null)
			end(
				reached.end?.reason ?? 'lane-error',
				reached.end === null ? why : `${reached.end.detail}; then: ${why}`
			);
		throw e;
	}
}

/** What one sign-off act came to, for a verdict's line: what it answered, or that it was never pressed. */
const answerOf = (act: SignOffAct | null): string =>
	act === null ? 'was never pressed' : `answered ${act.envelopeType ?? 'nothing'}`;

/**
 * ~~⭐ D11 — why the dry run's sign-off of the root is not PROVED … Record Assurance and Mark Satisfied each answered
 * `success`; and the store, read after Mark Satisfied, reads the root SATISFIED in lifecycle and in assurance.~~
 * ⛔⛔ `E12F` F1 (`REG-D-112` (b): a dry run calls no model) — SINCE E2 RECORD ASSURANCE ASKS THE REVIEWER, so a dry run that
 * proved the root's sign-off by pressing it would make paid calls. Why the dry run's REHEARSAL of the root's sign-off is not
 * what a dry run's must be, one line per requirement, each with what was read; none when it is: its row offered Record
 * Assurance; NOTHING was pressed — no Record Assurance, no re-run, no Mark Satisfied; and the sign-off is recorded not
 * reached in a dry run (`DRY_SIGN_OFF_NOT_REACHED`). ⚠ The root's SATISFIED is no longer a dry run's to prove: it is the
 * gate's prediction (b) (`e2e/phase7-five-unit.e2e.ts`), on the declared stand-in, and the paid run's.
 */
function rootSignOffShortfalls(root: RunUnit): string[] {
	const signed = root.signOff;
	const pressed =
		signed !== null &&
		(signed.recordAssurance !== null || signed.rerunDeclared !== null || signed.markSatisfied !== null);
	return [
		...(signed?.offered === true
			? []
			: [
					'the dry run did not rehearse the root’s sign-off: ' +
						(signed === null ? 'no sign-off was attempted' : 'its row offered no Record Assurance')
				]),
		...(pressed
			? [
					`the dry run pressed the root’s sign-off, which asks the reviewer for each declared policy (REG-D-112 (b)): ` +
						`Record Assurance ${answerOf(signed.recordAssurance)}, and Mark Satisfied ${answerOf(signed.markSatisfied)}`
				]
			: []),
		...(signed?.offered === true && !pressed && signed.notPressed !== DRY_SIGN_OFF_NOT_REACHED
			? [`the dry run’s sign-off of the root is not recorded as not reached in a dry run: ${signed.notPressed ?? 'nothing recorded'}`]
			: [])
	];
}

/**
 * ⭐ WHAT THE SPEC ASSERTS OF ITS OWN MACHINERY, once the record is written: why this run is not the run it was meant to
 * be, one line each; none when it is. PAID, it must COMPLETE. DRY, it must stop where a dry run stops, having PROVED THE
 * ROOT'S PRESS (§6 P7-2: "the dry run also proves one press, its saved response and one archive-and-check cycle"):
 * answered `success`, the store reading its execution and its step SUCCEEDED — AND THE ROOT'S SIGN-OFF REHEARSED UP TO THE
 * REVIEWER CALL (~~design §6 P7-2 D11: … Record Assurance and Mark Satisfied each answered `success`, and the store … reading
 * the root SATISFIED~~ ⛔ `E12F` F1, `REG-D-112` (b)): its row offering Record Assurance, nothing pressed, the sign-off
 * recorded not reached in a dry run — and no model exchange recorded, counted after the sign-off.
 * ⚠ Everything the run is FOR — which phase completed, what each review said — is the report's, never asserted here.
 */
export function laneVerdict(record: RunRecord): string[] {
	const wanted: EndReason = record.mode === 'paid' ? 'complete' : 'dry-run-stop';
	const ended = record.end;
	if (ended?.reason !== wanted)
		return [
			`the run ended ${ended === null ? 'with no end recorded' : `'${ended.reason}'`}, not '${wanted}'` +
				(ended?.detail === undefined ? '' : `: ${ended.detail}`)
		];
	if (record.mode === 'paid') return [];
	const root = record.units[0]!;
	return [
		...(root.beginExecute?.envelopeType === 'success' && root.stopped === false
			? []
			: [
					`the dry run did not prove the root's press: it answered ${root.beginExecute?.envelopeType ?? 'nothing'}, ` +
						`and the store reads its execution ${root.after?.executionState ?? 'unread'} and its step ` +
						(root.after?.planStepState ?? 'unread')
				]),
		...rootSignOffShortfalls(root),
		...(record.dryRun?.modelExchanges === 0
			? []
			: [
					`the dry run recorded ${record.dryRun?.modelExchanges ?? 'an unread number of'} model exchange(s)`
				])
	];
}

// ── EVERY POST THE PAGE SENDS (D5) ───────────────────────────────────────────────────────────────────────────────────

/** One line of `lane/posts.jsonl`. */
export interface PostLine {
	readonly seq: number;
	readonly at: string;
	readonly url: string;
	readonly action: string | null;
	/** null when no response came: the request failed, or the run ended first. */
	readonly status: number | null;
	readonly failure?: string;
}

/** The named action a form POST's URL carries (`?/beginExecute`), or null. */
export function actionOfUrl(url: string): string | null {
	const search = new URL(url).search;
	return search.startsWith('?/') ? (search.slice(2).split('&')[0] ?? '') || null : null;
}

/**
 * ⭐ Log every POST `page` sends to `file`, one line each as it completes, numbered in the order sent — refused ones
 * included, which leave no event and no receipt in the stores. `flush` writes the ones still unanswered.
 */
export function logPosts(page: Page, file: string): { readonly flush: () => void } {
	let seq = 0;
	const open = new Map<Request, { seq: number; url: string; action: string | null }>();
	const write = (line: PostLine) => appendFileSync(file, `${JSON.stringify(line)}\n`);
	const done = (r: Request, status: number | null, failure?: string) => {
		const sent = open.get(r);
		if (sent === undefined) return;
		open.delete(r);
		write({
			seq: sent.seq,
			at: new Date().toISOString(),
			url: sent.url,
			action: sent.action,
			status,
			...(failure === undefined ? {} : { failure })
		});
	};
	page.on('request', (r) => {
		if (r.method() === 'POST')
			open.set(r, { seq: ++seq, url: r.url(), action: actionOfUrl(r.url()) });
	});
	page.on('response', (res) => done(res.request(), res.status()));
	page.on('requestfailed', (r) => done(r, null, r.failure()?.errorText ?? 'failed'));
	return {
		// ⚠ Deleting a Map's current entry while iterating it is safe, so the unanswered are written as they are met.
		flush: () => {
			for (const r of open.keys()) done(r, null, 'no response before the run ended');
		}
	};
}

/** A full-page screenshot into the lane's own folder, never the gallery the gate's setup deletes; why not, if not. */
export async function screenshot(page: Page, file: string): Promise<string | null> {
	try {
		await page.screenshot({ path: file, fullPage: true, timeout: PHASE7_UI_MS });
		return null;
	} catch (e) {
		return `screenshot ${file}: ${e instanceof Error ? e.message : String(e)}`;
	}
}
