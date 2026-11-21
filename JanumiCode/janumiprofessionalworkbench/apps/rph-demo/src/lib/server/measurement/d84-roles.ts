// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189`; the lead's rulings r1 on `d84/d84-facts.md` §3) — EACH ROLE, ONE AT A TIME:
// prepared from the copy by the stage's own functions and shown, then — approved, the flag set — prepared again and checked, called through the stage's
// own part, and its answer recorded in the copy as the stage records it, so the next role is given it.
//
// ⭑ WHAT IS SHOWN (`REG-D-189` (1), (2) as put again), each with a manifest of its files' sha256:
//   · the writer — the folder devin starts in, as `devinPrint` itself writes it: `prompt.txt`, the reviewer's preamble included, `.devin/config.json`,
//     and the argv, its folder's paths as placeholders (`argv.json`). Made by `devinPrint` with a program that copies its folder and runs nothing;
//   · the Hypothesizer — its task text (`task.txt`), its executor and session (`executor.json`) and every file of its copy (`copy/`), made by the helper's
//     own copy (`helperCopyOf`). Its full request, which Pi assembles at the send, is not shown before: it is recorded as every Pi try records it, its
//     sha256 taken from the turn's result, and written for the sponsor into `after/` once the call record exists (the lead's rulings r1, Q1, Q3);
//   · the Historian — its whole folder (`folder/`: `prompt.txt`, `.devin/config.json`, `records/` with its index, `workspace/`), the user configuration
//     (`host/config.json`), the argv and devin's version, made by `writeHistorianFolder` and `devinHistorianCall` themselves, with a program that copies.
// ⭑ THE CALL (§3.6): refused without `JPWB_D84_PAID=1`, without an approval of the manifest shown, out of the stage's order, or a second time; then the
// role prepared again into `check/` and every byte held to what was approved; then the part run with the transport checked once more at its seam —
// the prompt file, the copy, the turn's text, the folder — a difference there thrown inside the part, which the stage records failing (Q10).
// ⛔ THE STOP: after the Historian's call nothing more is called; this module never reaches the Unsticking Agent, the stage's press or its re-ask.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listByType } from '@janumipwb/rph-engine';
import {
	chapterInputOf,
	chapterPart,
	diagnosisPart,
	historianContextOf,
	hypothesizerInputOf,
	roundContextOf,
	type AssuranceStageDeps,
	type RoundContext,
	type StagePartOutcome
} from '../assurance/assurance-stage.js';
import { HELPER_INVOKER } from '../assurance/assurance-stage-roles.js';
import { historianInputOf, historianPart } from '../assurance/historian-part.js';
import { selectReviewer } from '../assurance/reviewer-selection.js';
import { helperCopyOf } from '../assurance/stage-helper-run.js';
import type { ExecutorSessionPlace, ProducerSession, ProducerSessionContext } from '../execution/producer-session.js';
import { verifiedBytes } from '../execution/verified-bytes.js';
import { isToolInvocationResult } from '../tools/backing-tool.js';
import { devinHistorianCall, writeHistorianFolder, type HistorianVersionOf } from '../tools/devin-historian.js';
import { devinPrint, type DevinExec } from '../tools/devin-reviewer.js';
import {
	approvalRefusal,
	D84_LAYOUT,
	D84_ROLES,
	manifestDifferences,
	manifestOf,
	paidRefusal,
	readJson,
	roleFolderOf,
	sha256Of,
	shownManifestOf,
	treeEntries,
	writeOnce,
	type D84Role,
	type Manifest,
	type ManifestEntry
} from './d84-files.js';

/** ⭐ D84 — the programs a call runs: devin's (the writer's and the Historian's), Pi's opener (the Hypothesizer's) and `devin --version`. */
export interface D84Transports {
	readonly devinExec: DevinExec;
	readonly openPi: (context: ProducerSessionContext, modelId: string, place: ExecutorSessionPlace) => Promise<ProducerSession>;
	readonly devinVersion: HistorianVersionOf;
}

/** ⭐ D84 — the record that the driver has stopped, written after the Historian's call: nothing is called on the copy after it. */
export const D84_STOPPED = 'stopped.json';

/** ⭐ D84 — where a role is measured: the measurement folder, the unit and its round. */
export interface RoleAt {
	readonly folder: string;
	readonly unitId: string;
	readonly roundId: string;
}

const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/** `args` with each of `paths` replaced by its placeholder, longest first: the folder a call runs in is a fresh one each time. */
function placeheld(args: readonly string[], paths: readonly (readonly [string, string])[]): string[] {
	const ordered = [...paths].sort((a, b) => b[0].length - a[0].length);
	return args.map((a) => ordered.reduce((s, [path, hold]) => s.split(path).join(hold), a));
}

/** The program a devin call runs and its argv, its folders' paths held, and its options: what `argv.json` shows. */
function argvShown(program: string, args: readonly string[], options: Parameters<DevinExec>[2], paths: readonly (readonly [string, string])[]): string {
	return json({ program, args: placeheld(args, paths), timeout: options.timeout, maxBuffer: options.maxBuffer, windowsHide: options.windowsHide });
}

/** ⭐ D84 — the files of the writer's call, as it is shown and as it is checked: the folder devin starts in, read whole, and its program and argv. */
function writerFiles(program: string, args: readonly string[], options: Parameters<DevinExec>[2]): { readonly path: string; readonly bytes: Buffer }[] {
	const folder = options.cwd;
	return [
		...treeEntries(folder).map((e) => ({ path: e.path, bytes: readFileSync(join(folder, e.path)) })),
		{ path: 'argv.json', bytes: Buffer.from(argvShown(program, args, options, [[folder, '<folder>']]), 'utf8') }
	];
}

/** ⭐ D84 — the files of the Historian's call, as shown and as checked: its folder, its user configuration, its argv, and devin's version. */
function historianFiles(
	program: string,
	args: readonly string[],
	options: Parameters<DevinExec>[2],
	version: string
): { readonly path: string; readonly bytes: Buffer }[] {
	const folder = options.cwd;
	const host = `${folder}.host`;
	const config = args[args.indexOf('--config') + 1] ?? '';
	return [
		...treeEntries(folder).map((e) => ({ path: `folder/${e.path}`, bytes: readFileSync(join(folder, e.path)) })),
		{ path: 'host/config.json', bytes: readFileSync(config) },
		{ path: 'argv.json', bytes: Buffer.from(argvShown(program, args, options, [[host, '<host>'], [folder, '<folder>']]), 'utf8') },
		{ path: 'devin-version.txt', bytes: Buffer.from(version, 'utf8') }
	];
}

/** The manifest of files read in memory, as `treeEntries` would list them written. */
const manifestOfFiles = (files: readonly { readonly path: string; readonly bytes: Buffer }[]): Manifest =>
	manifestOf(files.map((f): ManifestEntry => ({ path: f.path, kind: 'file', bytes: f.bytes.length, sha256: sha256Of(f.bytes) })));

/** Files written under `into`, each at its path. */
function writeFiles(into: string, files: readonly { readonly path: string; readonly bytes: Buffer }[]): void {
	for (const f of files) {
		mkdirSync(dirname(join(into, f.path)), { recursive: true });
		writeFileSync(join(into, f.path), f.bytes, { flag: 'wx' });
	}
}

/** A manifest without the entries at `paths`. */
function entriesBut(manifest: Manifest, paths: readonly string[]): Manifest {
	return manifestOf(manifest.entries.filter((e) => !paths.includes(e.path)));
}

/** ⭐ D84 — the executor and session the Hypothesizer is called on, as shown (`executor.json`) and as its opener is handed them. */
function executorShown(modelId: string, place: ExecutorSessionPlace | { readonly kind: string }): Buffer {
	return Buffer.from(json({ modelId, session: place.kind === 'DURABLE' ? 'a new durable session, kept with the run (D85)' : 'held in memory' }), 'utf8');
}

/** The refusal of a role that cannot be shown, with why. */
type Prepared = { readonly manifest: Manifest } | { readonly refusedBecause: string };

/** ⭐⭐ D84 — PREPARE THE WRITER into `into`: its input by `chapterInputOf`, its folder by `devinPrint` itself, through a program that copies and runs nothing. */
async function prepareWriter(round: RoundContext, into: string): Promise<Prepared> {
	const selected = selectReviewer({ testMode: round.deps.testMode });
	if (selected.kind !== 'DEVIN')
		return { refusedBecause: `the narrative writer runs on the selected reviewer, devin, and the selection is ${selected.kind}: there is nothing to show` };
	const input = await chapterInputOf(round);
	let files: { readonly path: string; readonly bytes: Buffer }[] | undefined;
	try {
		await devinPrint(input.prompt, async (file, args, options) => {
			files = writerFiles(file, args, options);
			return { stdout: '' };
		});
	} catch (e) {
		return { refusedBecause: `the writer's folder could not be made as devinPrint makes it: ${e instanceof Error ? e.message : String(e)}` };
	}
	if (files === undefined) return { refusedBecause: 'devinPrint ran no program, so there is no folder to show' };
	writeFiles(into, files);
	return { manifest: manifestOfFiles(files) };
}

/** ⭐⭐ D84 — PREPARE THE HYPOTHESIZER into `into`: its input by `hypothesizerInputOf`, its copy by `helperCopyOf`, its task text and its executor. */
async function prepareHypothesizer(round: RoundContext, into: string): Promise<Prepared> {
	const input = await hypothesizerInputOf(round);
	if (input.executor.kind !== 'PI') return { refusedBecause: `the Hypothesizer runs on Pi's harness alone, and the executor selected is ${input.executor.kind}` };
	if (!input.shared.ok) return { refusedBecause: input.shared.why };
	const workspace = input.shared.workspace;
	const dir = workspace.directoryPath;
	if (workspace.materialization !== 'FILESYSTEM' || dir === undefined || dir === '')
		return { refusedBecause: 'the shared workspace has no directory on disk to copy, so the Hypothesizer has nowhere to work' };
	mkdirSync(into, { recursive: true });
	const copy = join(into, 'copy');
	await helperCopyOf({ undertakingId: round.undertakingId, recordFiles: input.conversations.files, shared: workspace }, dir, copy);
	// ⚠ The copy's process-output folder is the helper's own, empty here: it is no part of what the Hypothesizer is given.
	rmSync(`${copy}.process-output`, { recursive: true, force: true });
	const place = round.deps.sessionsRoot === undefined ? { kind: 'IN_MEMORY' } : { kind: 'DURABLE' };
	writeFiles(into, [
		{ path: 'task.txt', bytes: Buffer.from(input.prompt, 'utf8') },
		{ path: 'executor.json', bytes: executorShown(input.executor.modelId, place) }
	]);
	return { manifest: manifestOf(treeEntries(into)) };
}

/** ⭐⭐ D84 — PREPARE THE HISTORIAN into `into`: its input by `historianInputOf`, its folder by `writeHistorianFolder` and its call's argv by `devinHistorianCall`. */
async function prepareHistorian(round: RoundContext, into: string, devinVersion: HistorianVersionOf): Promise<Prepared> {
	const ctx = historianContextOf(round, await hypothesizerInputOf(round));
	const input = await historianInputOf(ctx);
	if (!input.ok) return { refusedBecause: input.why };
	const folder = await writeHistorianFolder({ prompt: input.prompt, records: input.records.files, workspaceFiles: input.copied.files });
	let version = '';
	let files: { readonly path: string; readonly bytes: Buffer }[] | undefined;
	const outcome = await devinHistorianCall(
		{ folder, model: input.runner.model, boundMs: input.bound.ms },
		{
			versionOf: async () => (version = await devinVersion()),
			exec: async (file, args, options) => {
				files = historianFiles(file, args, options, version);
				return { stdout: '' };
			}
		}
	);
	if (!outcome.ran) return { refusedBecause: outcome.why };
	if (files === undefined) return { refusedBecause: 'devinHistorianCall ran no program, so there is no folder to show' };
	writeFiles(into, files);
	return { manifest: manifestOfFiles(files) };
}

/** ⭐ D84 — the round's context for a part, its deps given the seams the part's call is checked at. */
const roundOf = (deps: AssuranceStageDeps, at: RoleAt): RoundContext => roundContextOf(at.unitId, at.roundId, deps);

/** ⭐ D84 — whether the role before `role`, in the stage's order, has been called; and why `role` may not be prepared or called now. */
function orderRefusal(folder: string, role: D84Role): string | undefined {
	if (existsSync(join(folder, D84_STOPPED))) return 'the driver stopped after the Historian: nothing more is called on this copy (D84)';
	for (const first of [D84_LAYOUT.case, D84_LAYOUT.policy])
		if (!existsSync(join(folder, first)))
			return `${first} is not written: the case is checked and its stored policy prepared before any role is shown (D84; REG-F-680)`;
	const index = D84_ROLES.indexOf(role);
	const before = D84_ROLES[index - 1];
	if (before !== undefined && !existsSync(join(roleFolderOf(folder, before), D84_LAYOUT.call)))
		return `the ${before} has not been called: each role is given the earlier roles' real answers, so the ${role} waits for it (REG-D-189 (1))`;
	return undefined;
}

/**
 * ⭐⭐ D84 — PREPARE ONE ROLE AND SHOW IT: written into the role's `shown/` with its manifest, once. ⛔ Refused out of the stage's order, where it has been
 * shown already, and where the stage's own reading refuses it.
 */
export async function prepareRole(
	role: D84Role,
	deps: AssuranceStageDeps,
	at: RoleAt,
	devinVersion: HistorianVersionOf
): Promise<{ readonly shown: Manifest } | { readonly refusedBecause: string }> {
	const order = orderRefusal(at.folder, role);
	if (order !== undefined) return { refusedBecause: order };
	const folder = roleFolderOf(at.folder, role);
	if (existsSync(join(folder, D84_LAYOUT.manifest))) return { refusedBecause: `the ${role} is shown already (${D84_LAYOUT.manifest}): a role is shown once` };
	const prepared = await prepareInto(role, roundOf(deps, at), join(folder, D84_LAYOUT.shown), devinVersion);
	if ('refusedBecause' in prepared) return prepared;
	writeOnce(join(folder, D84_LAYOUT.manifest), prepared.manifest);
	return { shown: prepared.manifest };
}

/** One role prepared into `into` (see the three preparations above). */
function prepareInto(role: D84Role, round: RoundContext, into: string, devinVersion: HistorianVersionOf): Promise<Prepared> {
	if (role === 'writer') return prepareWriter(round, into);
	if (role === 'hypothesizer') return prepareHypothesizer(round, into);
	return prepareHistorian(round, into, devinVersion);
}

/**
 * ⭐ D84 — ONE ROLE PREPARED INTO `into`, AS ITS SHOWING PREPARES IT, with no folder rule and no order: the files written and their manifest, or why it
 * cannot be. What `prepareRole` shows and what `callRole` checks again are made here; a test asks it at the stage's own seams (design D84's one
 * definition, held by `d84-driver.route.test.ts`).
 */
export function prepareRoleInto(
	role: D84Role,
	deps: AssuranceStageDeps,
	at: Pick<RoleAt, 'unitId' | 'roundId'>,
	into: string,
	devinVersion: HistorianVersionOf
): Promise<{ readonly manifest: Manifest } | { readonly refusedBecause: string }> {
	return prepareInto(role, roundContextOf(at.unitId, at.roundId, deps), into, devinVersion);
}

/** What one call's seam saw: whether it checked and sent, why it refused, how long the program ran, and the Hypothesizer's request's sha256. */
export interface SeamSeen {
	checked: boolean;
	refusedBecause?: string;
	callMs?: number;
	requestSha256?: string;
	version?: string;
}

/** ⭐ D84 — why a seam refuses: what it would send differs from what was approved, each difference named. */
const seamRefusal = (where: string, differences: readonly string[]): string =>
	`D84 refused the call at its transport (${where}): what it would send differs from what was approved — ${differences.join('; ')}`;

/** Run `program`, timing it on the monotonic clock into `seen`. */
async function timed<T>(seen: SeamSeen, program: () => Promise<T>): Promise<T> {
	const started = performance.now();
	try {
		return await program();
	} finally {
		seen.callMs = Math.round(performance.now() - started);
	}
}

/** ⭐ D84 — the writer's program, checked at its seam: the folder devin starts in and its argv held to the approved manifest, then devin run. */
function checkedWriterExec(approved: Manifest, exec: DevinExec, seen: SeamSeen): DevinExec {
	return async (file, args, options) => {
		const differences = manifestDifferences(approved, manifestOfFiles(writerFiles(file, args, options)));
		if (differences.length > 0) throw new Error((seen.refusedBecause = seamRefusal("the writer's prompt file", differences)));
		seen.checked = true;
		return timed(seen, () => exec(file, args, options));
	};
}

/** ⭐ D84 — the Historian's program, checked at its seam: its folder, its user configuration, its argv and devin's version, then devin run. */
function checkedHistorianExec(approved: Manifest, exec: DevinExec, seen: SeamSeen): DevinExec {
	return async (file, args, options) => {
		const differences = manifestDifferences(approved, manifestOfFiles(historianFiles(file, args, options, seen.version ?? '')));
		if (differences.length > 0) throw new Error((seen.refusedBecause = seamRefusal("the Historian's folder", differences)));
		seen.checked = true;
		return timed(seen, () => exec(file, args, options));
	};
}

/**
 * ⭐ D84 — the Hypothesizer's opener, checked at its seam: its copy and its executor held to the approved manifest as it is opened, and each turn's
 * text to the approved task text; the turn's result returned as Pi gave it, the sha256 of its materialized input taken (Q1, Q3).
 */
function checkedOpener(approved: Manifest, open: D84Transports['openPi'], seen: SeamSeen): D84Transports['openPi'] {
	return async (context, modelId, place) => {
		const dir = context.workspace.directoryPath ?? '';
		const now = manifestOf([
			...treeEntries(dir).map((e) => ({ ...e, path: `copy/${e.path}` })),
			...manifestOfFiles([{ path: 'executor.json', bytes: executorShown(modelId, place) }]).entries
		]);
		const differences = manifestDifferences(entriesBut(approved, ['task.txt']), now);
		if (differences.length > 0) throw new Error((seen.refusedBecause = seamRefusal("the Hypothesizer's copy", differences)));
		const task = approved.entries.find((e) => e.path === 'task.txt');
		const session = await open(context, modelId, place);
		return {
			...session,
			turn: async (text: string) => {
				if (task === undefined || sha256Of(text) !== task.sha256)
					throw new Error((seen.refusedBecause = seamRefusal("the Hypothesizer's task text", [`task.txt: its sha256 is ${sha256Of(text)}, approved ${task?.sha256 ?? 'none'}`])));
				seen.checked = true;
				const returned = await timed(seen, () => session.turn(text));
				if (isToolInvocationResult(returned) && typeof returned.materializedInput === 'string') seen.requestSha256 = sha256Of(returned.materializedInput);
				return returned;
			},
			lastTurnObservation: () => session.lastTurnObservation(),
			processRuns: () => session.processRuns(),
			dispose: () => session.dispose()
		};
	};
}

/** ⭐ D84 — a role's call record (`call.json`). */
export interface CallRecord {
	readonly role: D84Role;
	readonly approvedManifestSha256: string;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly checkedAtSeam: boolean;
	readonly seamRefusal?: string;
	readonly callMs?: number;
	readonly outcome: StagePartOutcome | undefined;
	readonly requestSha256?: string;
	readonly devinVersion?: string;
	readonly childEnvironmentNames: readonly string[];
}

/**
 * ⭐⭐ D84 — CALL ONE ROLE (see the header), its answer recorded in the copy as the stage records it. ⛔ Refused before anything is called: without the
 * flag, without its approval, out of order, a second time, or where the role prepared again differs in any byte from what was approved.
 */
export async function callRole(
	role: D84Role,
	deps: AssuranceStageDeps,
	at: RoleAt,
	transports: D84Transports,
	env: Readonly<Record<string, string | undefined>>
): Promise<{ readonly called: CallRecord } | { readonly refusedBecause: string }> {
	const paid = paidRefusal(env);
	if (paid !== undefined) return { refusedBecause: paid };
	const order = orderRefusal(at.folder, role);
	if (order !== undefined) return { refusedBecause: order };
	const folder = roleFolderOf(at.folder, role);
	const approval = approvalRefusal(folder);
	if (approval !== undefined) return { refusedBecause: approval };
	if (existsSync(join(folder, D84_LAYOUT.call))) return { refusedBecause: `the ${role} has been called (${D84_LAYOUT.call}): a role is called once on a copy (the lead's rulings r1, Q10)` };
	const approved = shownManifestOf(folder)!;
	// ── Prepared again from the copy, by the same functions, and held to what was approved: nothing is called or recorded where any byte differs.
	const check = join(folder, D84_LAYOUT.check);
	rmSync(check, { recursive: true, force: true });
	const again = await prepareInto(role, roundOf(deps, at), check, transports.devinVersion);
	rmSync(check, { recursive: true, force: true });
	if ('refusedBecause' in again) return { refusedBecause: `the ${role} could not be prepared again before its call: ${again.refusedBecause}` };
	const differences = manifestDifferences(approved, again.manifest);
	if (differences.length > 0)
		return { refusedBecause: `the ${role} prepared again differs from what was approved, so it is not called: ${differences.join('; ')}` };
	// ── The call, through the stage's own part, its transport checked at its seam.
	const seen: SeamSeen = { checked: false };
	const startedAt = new Date().toISOString();
	const round = roundOf(seamedDeps(role, deps, approved, transports, seen), at);
	if (role === 'writer') await chapterPart(round, await chapterInputOf(round));
	else if (role === 'hypothesizer') await diagnosisPart(round, await hypothesizerInputOf(round));
	else round.parts.push(await historianPart(historianContextOf(round, await hypothesizerInputOf(round))));
	const record: CallRecord = {
		role,
		approvedManifestSha256: approved.sha256,
		startedAt,
		endedAt: new Date().toISOString(),
		checkedAtSeam: seen.checked,
		...(seen.refusedBecause === undefined ? {} : { seamRefusal: seen.refusedBecause }),
		...(seen.callMs === undefined ? {} : { callMs: seen.callMs }),
		outcome: round.parts.at(-1),
		...(seen.requestSha256 === undefined ? {} : { requestSha256: seen.requestSha256 }),
		...(seen.version === undefined ? {} : { devinVersion: seen.version }),
		childEnvironmentNames: Object.keys(process.env).sort((a, b) => Number(a > b) - Number(a < b))
	};
	writeOnce(join(folder, D84_LAYOUT.call), record);
	// ⛔ THE STOP — after the Historian, nothing more is called on this copy.
	if (role === 'historian') writeOnce(join(at.folder, D84_STOPPED), { at: record.endedAt, why: 'D84 measures three roles: the driver stops after the Historian' });
	return { called: record };
}

/** ⭐ D84 — the stage's deps, given the one seam the role's call is checked at: what `callRole` runs the part over (and a test asks of it alone). */
export function seamedDeps(role: D84Role, deps: AssuranceStageDeps, approved: Manifest, transports: D84Transports, seen: SeamSeen): AssuranceStageDeps {
	if (role === 'writer') return { ...deps, writerPrint: (prompt: string) => devinPrint(prompt, checkedWriterExec(approved, transports.devinExec, seen)) };
	if (role === 'hypothesizer') return { ...deps, openPi: checkedOpener(approved, transports.openPi, seen) };
	return {
		...deps,
		historianExec: checkedHistorianExec(approved, transports.devinExec, seen),
		historianVersionOf: async () => (seen.version = await transports.devinVersion())
	};
}

/**
 * ⭐⭐ D84 (`REG-D-189` (2), as put again; the lead's rulings r1, Q1) — THE HYPOTHESIZER'S FULL REQUEST, FOR THE SPONSOR TO READ AFTER ITS CALL: read
 * from the copy's content store as the stage stored it, its bytes checked against their hash, written into `after/`, and held to the sha256 the call
 * recorded. ⛔ Refused before the call record exists.
 */
export async function writeHypothesizerRequest(
	deps: Pick<AssuranceStageDeps, 'engine' | 'store'>,
	at: RoleAt
): Promise<{ readonly written: { readonly sha256: string; readonly bytes: number } } | { readonly refusedBecause: string }> {
	const folder = roleFolderOf(at.folder, 'hypothesizer');
	const call = readJson<CallRecord>(join(folder, D84_LAYOUT.call));
	if (call === undefined) return { refusedBecause: `the Hypothesizer has not been called (${D84_LAYOUT.call}): its full request is read after its call, never before` };
	const exchange = listByType(deps.engine, 'MODEL_EXCHANGE')
		.filter((x) => x.state.invokerId === HELPER_INVOKER.hypothesizer && x.state.subjectObjectId === at.roundId)
		.at(-1);
	const ref = (exchange?.state.materializedInputRef ?? {}) as { status?: unknown; storageKey?: unknown; contentHash?: unknown };
	if (exchange === undefined || ref.status !== 'STORED' || typeof ref.storageKey !== 'string' || typeof ref.contentHash !== 'string')
		return { refusedBecause: 'the copy records no stored request of the Hypothesizer’s exchange in this round' };
	const read = await verifiedBytes(deps.store, ref.storageKey, ref.contentHash, 'the Hypothesizer’s request');
	if (!read.ok) return { refusedBecause: read.refusedBecause };
	const sha256 = sha256Of(read.value);
	if (sha256 !== call.requestSha256)
		return { refusedBecause: `the request the copy holds has sha256 ${sha256}, and the call recorded ${String(call.requestSha256)}: it is not the request sent` };
	const after = join(folder, D84_LAYOUT.after);
	mkdirSync(after, { recursive: true });
	writeFileSync(join(after, 'request.json'), read.value, { encoding: 'utf8', flag: 'wx' });
	return { written: { sha256, bytes: Buffer.byteLength(read.value, 'utf8') } };
}
