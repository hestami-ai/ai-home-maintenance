// ⭐⭐ `JAN-EXEC` Phase 7 — design D84 (as amended 2026-11-21; `REG-D-189` (3); the lead's rulings r1 on `d84/d84-facts.md` §3.7) — THE PROBES: up to
// six small devin calls, each a test prompt in a folder of the Historian's form, prepared, shown, approved and checked as a role's is, and counted
// apart from the roles' calls. They measure what the three role calls cannot show (whether devin expands `~`, whether `--config` replaces the user's
// configuration or adds to it, and what becomes of a timed-out call's children); each probe's prompt is the lead's, shown to the sponsor first.
// ⭐ L17b4 — design D93 (`REG-F-684`; `REG-D-197`): `--config` replaces the user's configuration and, at devin 3000.11.234 on this host, stalls the call
// (measured by D84's first probes), so the Historian is launched without one, and each probe with it, in the Historian's form.
//
// ⭑ A PROBE'S DEFINITION, the lead's (`probes/<NN>-<name>/definition/`): `prompt.txt`; and, optional, `project-config.json` ~~and `user-config.json`, the
// folder's two configurations~~ ⭐ (L17b4, D93), the folder's configuration (absent, the Historian's own); `files/`, planted in the folder; and
// `probe.json` — its bound in milliseconds, and whether the children of its call are to be listed after it. ⭐ A definition that holds `user-config.json`
// is refused, naming the file, before any folder is made (the lead's L4-Q6): no user configuration is passed, so it would mean nothing.
// ⭑ ITS CALL: through `devinHistorianCall`, as the Historian's, so devin's version is read first and the folder removed after; checked at its seam as a
// role's is; its answer and its export kept with it, never in the copy. A probe that lists its call's children lists them by the call's process id,
// and stops none of them.
// ⛔ AT MOST SIX: a seventh is refused before anything of it is made, and again at its call (the lead's rulings r2, `D84R-A02`)~~: of the probes shown,
// in their names' order, only the first six are called~~. ⭐ r3: at its call, by what is spent — where six probes hold an attempt, recorded or not,
// no other is called (a probe forced in by hand, named before six already called, passed the count by place).
// ⛔ CALLED ONCE (r2, `D84R-A01` (a)): an attempt is reserved immediately before the call, and a probe holding one is never called again.
import { execFile } from 'node:child_process';
// ⭐ L17b4 (the lead's §15.5 (e)) — ~~`import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from
// 'node:fs';`~~: and `lstatSync`, which a definition's `user-config.json` is found by.
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// ⭐ L17b4 (D93; `REG-D-197`) — ~~`HISTORIAN_USER_CONFIG`~~ no longer imported: no user configuration is passed.
// ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — ~~`import { devinHistorianCall, HISTORIAN_PROJECT_CONFIG, type HistorianVersionOf } from
// '../tools/devin-historian.js';`~~: and devin's version reply by its parts, read once and shown once (`devinVersionParts`, `devinVersionShown`).
import {
	devinHistorianCall,
	devinVersionParts,
	devinVersionShown,
	HISTORIAN_PROJECT_CONFIG,
	type DevinVersionParts,
	type HistorianVersionOf
} from '../tools/devin-historian.js';
import type { DevinExec } from '../tools/devin-reviewer.js';
import {
	approvalRefusal,
	attemptRefusal,
	D84_LAYOUT,
	D84_MAX_PROBES,
	manifestDifferences,
	manifestOf,
	paidRefusal,
	readJson,
	reserveAttempt,
	sha256Of,
	shownManifestOf,
	treeEntries,
	writeOnce,
	type Manifest,
	type ManifestEntry
} from './d84-files.js';

/** ⭐ D84 — what a probe's definition says beside its files (`probe.json`). */
export interface ProbeDefinition {
	readonly boundMs: number;
	readonly model?: string;
	readonly listChildren?: boolean;
}

/** ⭐ D84 — a probe's name: two digits, a hyphen, then lower-case letters, digits and hyphens (`01-tilde`), so it names one folder and nothing more. */
export const PROBE_NAME = /^\d{2}-[a-z0-9-]+$/;

/** The probes' folder, and one probe's. */
const probesOf = (folder: string): string => join(folder, D84_LAYOUT.probes);
const probeFolderOf = (folder: string, name: string): string => join(probesOf(folder), name);

/** The probes shown so far: each probe folder holding a manifest. */
function shownProbes(folder: string): string[] {
	const root = probesOf(folder);
	return existsSync(root) ? readdirSync(root).filter((n) => existsSync(join(root, n, D84_LAYOUT.manifest))) : [];
}

/**
 * ⭐⭐ r3 (the lead's rulings r3, on r2's `D84R-A02`) — THE PROBE CALLS SPENT: each probe holding an attempt, recorded or not, by name, in code-unit order.
 * Every call reserves its attempt before devin runs, so these are the calls made or begun, whatever became of them. (r2's count by place among the
 * probes shown is gone: a probe forced in by hand, named before six already called, passed it.)
 */
function attemptedProbes(folder: string): string[] {
	const root = probesOf(folder);
	return existsSync(root) ? readdirSync(root).filter((n) => existsSync(join(root, n, D84_LAYOUT.attempt))).sort((a, b) => Number(a > b) - Number(a < b)) : [];
}

const json = (v: unknown): string => `${JSON.stringify(v, null, 2)}\n`;

/**
 * The files a probe's call is shown and checked as: its folder, ~~its user configuration,~~ and its program and argv, each path of its folders held.
 * ⭐ L17b4 — design D93 (`REG-D-197`): a probe, as the Historian, is given no user configuration, so none is shown — ~~`const config =
 * args[args.indexOf('--config') + 1] ?? '';`~~ and ~~`{ path: 'host/config.json', bytes: readFileSync(config) },`~~, which, with no `--config` in the
 * argv, would read the argv's first word as a file.
 */
function probeFiles(program: string, args: readonly string[], options: Parameters<DevinExec>[2]): ProbeFile[] {
	const folder = options.cwd;
	const host = `${folder}.host`;
	const held = args.map((a) => a.split(host).join('<host>').split(folder).join('<folder>'));
	return [
		// ⭐ L17b4 (the lead's §15.5 (d); `L4C-A03`) — ~~`...treeEntries(folder).map((e) => ({ path: `folder/${e.path}`, bytes: readFileSync(join(folder,
		// e.path)) })),`~~, which read a link's file through it and showed it as that file: the folder's entries as `folderEntries` reads them.
		...folderEntries(folder),
		{
			path: 'argv.json',
			bytes: Buffer.from(json({ program, args: held, timeout: options.timeout, maxBuffer: options.maxBuffer, windowsHide: options.windowsHide }), 'utf8')
		}
	];
}

/**
 * ⭐ L17b4 (the lead's §15.5 (d); `L4C-A03`) — one shown file: its bytes; and, for a LINK, its target, its bytes the target's text, as a manifest holds a
 * link (`d84-files.ts`, `treeEntries`) — its shown copy a file holding that text, its manifest entry a link by its kind and its target.
 */
type ProbeFile = { readonly path: string; readonly bytes: Buffer; readonly target?: string };

/**
 * ⭐⭐ L17b4 — the lead's §15.5 (d) (`L4C-A03`, older than this package: D84's driver) — A PROBE FOLDER'S ENTRIES, EACH AS IT IS: a file by its bytes, and a
 * planted link as a LINK, by its kind and its target, never by the bytes it points to (`treeEntries` follows no link). So a link swapped for a file, or
 * for another link, after the approval is a change the check sees.
 */
function folderEntries(folder: string): ProbeFile[] {
	return treeEntries(folder).map((e): ProbeFile =>
		e.kind === 'link'
			? { path: `folder/${e.path}`, bytes: Buffer.from(e.target ?? '', 'utf8'), target: e.target ?? '' }
			: { path: `folder/${e.path}`, bytes: readFileSync(join(folder, e.path)) }
	);
}

// ⭐ L17b4 (§15.5 (d)) — ~~`manifestOf(files.map((f): ManifestEntry => ({ path: f.path, kind: 'file', bytes: f.bytes.length, sha256: sha256Of(f.bytes) })));`~~
// — every entry called a file: a link is entered as a link, by its kind and its target.
const manifestOfFiles = (files: readonly ProbeFile[]): Manifest =>
	manifestOf(
		files.map((f): ManifestEntry =>
			f.target === undefined
				? { path: f.path, kind: 'file', bytes: f.bytes.length, sha256: sha256Of(f.bytes) }
				: { path: f.path, kind: 'link', bytes: f.bytes.length, sha256: sha256Of(f.bytes), target: f.target }
		)
	);

/**
 * ⭐⭐ L17b4 — the lead's §15.5 (d) (`L4C-A03`) — EACH PLANTED LINK OF A PROBE FOLDER MADE AGAIN FOR ITS CALL, AGAINST WHAT WAS APPROVED: a link approved and
 * not the same link now — gone, a file or a folder now, or a link to another target — and a link now where none was approved. Read before the attempt
 * is reserved, so a probe whose link changed is refused before devin runs and spends no call. ⭑ Files are held at the call's seam, as before.
 */
function plantedLinkDifferences(approved: Manifest, folder: string): string[] {
	const now = new Map(folderEntries(folder).map((f) => [f.path, f] as const));
	const out: string[] = [];
	for (const a of approved.entries.filter((e) => e.kind === 'link' && e.path.startsWith('folder/'))) {
		const b = now.get(a.path);
		if (b === undefined) out.push(`${a.path}: approved as a link to ${a.target ?? ''}, and not there now`);
		else if (b.target === undefined) out.push(`${a.path}: approved as a link to ${a.target ?? ''}, and a file now`);
		else if (b.target !== a.target) out.push(`${a.path}: approved as a link to ${a.target ?? ''}, and a link to ${b.target} now`);
	}
	for (const b of now.values()) {
		if (b.target === undefined) continue;
		const a = approved.entries.find((e) => e.path === b.path);
		if (a === undefined || a.kind !== 'link') out.push(`${b.path}: a link to ${b.target} now, and ${a === undefined ? 'not in what was approved' : 'approved as a file'}`);
	}
	return out;
}

/**
 * A probe's folder, as the Historian's is laid out (`writeHistorianFolder`): a fresh folder, and its host beside it. ⭐ L17b4 (D93) — ~~`readonly
 * userConfigPath: string`~~: its host holds the export alone.
 */
type ProbeFolder = { readonly folder: string; readonly host: string; readonly promptPath: string; readonly exportPath: string };

/** ⭐ L17b4 — design D93 (the lead's L4-Q6) — the definition's file that would name a user configuration, which no probe is given. */
const PROBE_USER_CONFIG = 'user-config.json';

/** ⭐ L17b4 (§15.5 (e)) — how an error's code may look to be named in a refusal: a name, bounded, never free text. */
const ERROR_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

/**
 * ⭐⭐ L17b4 — the lead's §15.5 (e) (`L4C-A04`) — WHETHER A PROBE'S DEFINITION HOLDS AN ENTRY NAMED `user-config.json` — a file, a folder or a link, dangling
 * or not — found by `lstat`, which follows no link: true where it is there; false where it is not (`ENOENT`); and, where the lookup failed otherwise, its
 * code, in `ERROR_CODE`'s shape, or that it gave none. ⛔ It cannot throw: an error whose code cannot be read is a failed lookup.
 */
function userConfigLookup(definition: string): boolean | { readonly failed: string } {
	try {
		lstatSync(join(definition, PROBE_USER_CONFIG));
		return true;
	} catch (e) {
		let code: unknown;
		try {
			code = (e as { readonly code?: unknown } | null)?.code;
		} catch {
			code = undefined;
		}
		if (code === 'ENOENT') return false;
		return { failed: typeof code === 'string' && ERROR_CODE.test(code) ? code : 'an error with no code' };
	}
}

/**
 * A probe's folder, made from its definition: its prompt, its project configuration (the Historian's, absent its own), each planted file or folder
 * copied in by name, links kept as links ~~; its user configuration in its host (the Historian's, absent its own)~~. ⛔ A planted name the folder holds
 * already (`prompt.txt`, `.devin`) is refused, never written over: both folders are removed, and why is returned.
 * ⭐⭐ L17b4 — design D93 (`REG-D-197`; the lead's L4-Q6) — A DEFINITION THAT HOLDS `user-config.json` IS REFUSED AS MEANINGLESS, naming the file, before
 * any folder is made: a probe runs as the Historian's call runs, which passes no user configuration. Both `prepareProbe` and `callProbe` make their
 * folder here, the call before its attempt is reserved, so a refused definition is never shown and spends no call.
 */
function probeFolderFrom(definition: string): ProbeFolder | { readonly refusedBecause: string } {
	// ⭐ L17b4 (the lead's §15.5 (e); `L4C-A04`) — ~~`if (existsSync(join(definition, PROBE_USER_CONFIG)))`~~, which follows a link, so a dangling link of that
	// name was taken for no file: found by `lstat` (`userConfigLookup`), and a lookup that fails for any reason but absence refuses too.
	const lookup = userConfigLookup(definition);
	if (lookup === true)
		return {
			refusedBecause:
				`the probe's definition holds ${PROBE_USER_CONFIG}, and a probe runs as the Historian's call runs, which passes no user configuration ` +
				'(design D93; REG-D-197): the file would mean nothing, so the probe is refused'
		};
	if (lookup !== false)
		return {
			refusedBecause:
				`the probe's definition could not be looked up for ${PROBE_USER_CONFIG} (${lookup.failed}), and a probe runs as the Historian's call runs, ` +
				'which passes no user configuration (design D93; REG-D-197): a definition that may hold the file is refused, as one that holds it is'
		};
	const folder = mkdtempSync(join(tmpdir(), 'jpwb-d84-probe-'));
	const host = `${folder}.host`;
	try {
		mkdirSync(host);
		const promptPath = join(folder, 'prompt.txt');
		writeFileSync(promptPath, readFileSync(join(definition, 'prompt.txt')));
		mkdirSync(join(folder, '.devin'));
		const project = join(definition, 'project-config.json');
		writeFileSync(join(folder, '.devin', 'config.json'), existsSync(project) ? readFileSync(project) : HISTORIAN_PROJECT_CONFIG);
		const planted = join(definition, 'files');
		for (const name of existsSync(planted) ? readdirSync(planted) : [])
			cpSync(join(planted, name), join(folder, name), { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
		// ⭐ L17b4 — design D93 (`REG-D-197`) — ~~`const userConfigPath = join(host, 'config.json');`~~ ~~`const user = join(definition, 'user-config.json');`~~
		// ~~`writeFileSync(userConfigPath, existsSync(user) ? readFileSync(user) : HISTORIAN_USER_CONFIG);`~~
		// ~~`return { folder, host, promptPath, exportPath: join(host, 'export.json'), userConfigPath };`~~ — no user configuration is passed.
		return { folder, host, promptPath, exportPath: join(host, 'export.json') };
	} catch (e) {
		rmSync(folder, { recursive: true, force: true });
		rmSync(host, { recursive: true, force: true });
		return { refusedBecause: `the probe's folder could not be made from its definition: ${e instanceof Error ? e.message : String(e)}` };
	}
}

/** What the probes need of the host: devin's version, its model, and — for a probe that lists its call's children — a lister by parent process id. */
export interface ProbeHost {
	readonly devinVersion: HistorianVersionOf;
	readonly model: string;
	readonly childrenOf: (pid: number) => Promise<readonly { readonly pid: number; readonly name: string }[]>;
}

/**
 * ⭐⭐ D84 — PREPARE ONE PROBE AND SHOW IT: its folder made from its definition and its call's argv, as `devinHistorianCall` makes them, through a program
 * that copies and runs nothing. ⛔ Refused where six are shown already, where it is shown already, or where its definition is not whole.
 */
export async function prepareProbe(folder: string, name: string, host: Pick<ProbeHost, 'devinVersion' | 'model'>): Promise<{ readonly shown: Manifest } | { readonly refusedBecause: string }> {
	if (!PROBE_NAME.test(name)) return { refusedBecause: `a probe is named <NN>-<name>, and ${JSON.stringify(name)} is not` };
	const at = probeFolderOf(folder, name);
	if (existsSync(join(at, D84_LAYOUT.manifest))) return { refusedBecause: `the probe ${name} is shown already: a probe is shown once` };
	const shown = shownProbes(folder);
	if (shown.length >= D84_MAX_PROBES) return { refusedBecause: `${shown.length} probes are shown already, and D84 makes at most ${D84_MAX_PROBES} (REG-D-189 (3))` };
	const definition = join(at, D84_LAYOUT.definition);
	const said = readJson<ProbeDefinition>(join(definition, 'probe.json'));
	if (!existsSync(join(definition, 'prompt.txt')) || said === undefined || !Number.isSafeInteger(said.boundMs) || said.boundMs <= 0)
		return { refusedBecause: `the probe ${name}'s definition needs prompt.txt and a probe.json with a positive whole boundMs` };
	const made = probeFolderFrom(definition);
	if ('refusedBecause' in made) return made;
	// ⭐ L17b4 (§15.5 (d)) — ~~`let files: { readonly path: string; readonly bytes: Buffer }[] | undefined;`~~: a planted link with its target.
	let files: ProbeFile[] | undefined;
	// ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — ~~`let version = '';`~~ ~~`versionOf: async () => (version = await host.devinVersion()),`~~: the reply
	// read by its parts alone, and handed whole to the Historian's own version check, which reads it and keeps none of it.
	let version = devinVersionParts('');
	const outcome = await devinHistorianCall(
		{ folder: made, model: said.model ?? host.model, boundMs: said.boundMs },
		{
			versionOf: async () => {
				const reply = await host.devinVersion();
				version = devinVersionParts(reply);
				return reply;
			},
			exec: async (file, args, options) => {
				files = probeFiles(file, args, options);
				return { stdout: '' };
			}
		}
	);
	if (!outcome.ran) return { refusedBecause: outcome.why };
	if (files === undefined) return { refusedBecause: 'devinHistorianCall ran no program, so there is no folder to show' };
	// ⭐ L17b4 round 4 (§18; `REG-F-685`) — ~~`{ path: 'devin-version.txt', bytes: Buffer.from(version, 'utf8') }`~~, devin's reply whole: its parts alone.
	const all = [...files, { path: 'devin-version.txt', bytes: devinVersionShown(version) }];
	for (const f of all) {
		mkdirSync(dirname(join(at, D84_LAYOUT.shown, f.path)), { recursive: true });
		writeFileSync(join(at, D84_LAYOUT.shown, f.path), f.bytes, { flag: 'wx' });
	}
	const manifest = manifestOfFiles(all);
	writeOnce(join(at, D84_LAYOUT.manifest), manifest);
	return { shown: manifest };
}

/** ⭐ D84 — a probe's call record. */
export interface ProbeCallRecord {
	readonly probe: string;
	readonly approvedManifestSha256: string;
	readonly startedAt: string;
	readonly endedAt: string;
	readonly callMs?: number;
	readonly outcome: { readonly ran: boolean; readonly why?: string; readonly failure?: string };
	readonly answerSha256?: string;
	readonly pid?: number;
	readonly childrenAfter?: readonly { readonly pid: number; readonly name: string }[];
}

/** ⭐ D84 — a probe's program: devin's, as a call runs it, telling the probe the process id of what it started. */
export type ProbeExec = (
	file: string,
	args: readonly string[],
	options: Parameters<DevinExec>[2],
	started: (pid: number | undefined) => void
) => Promise<{ readonly stdout: string }>;

/** ⭐ D84 — the real program, for a probe's call: `execFile`, the process id of the child it started told. */
export const realProbeExec: ProbeExec = (file, args, options, started) =>
	new Promise((resolve, reject) => {
		const child = execFile(file, [...args], { ...options }, (error, stdout) => (error ? reject(error) : resolve({ stdout: String(stdout) })));
		started(child.pid);
	});

/** What a probe's call saw at its seam: devin's version, the process id of what it started, how long the program ran, and why the seam refused. */
interface ProbeSeen {
	// ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — ~~`version: string;`~~, devin's reply whole: its parts alone (`devinVersionParts`).
	version: DevinVersionParts;
	pid?: number;
	callMs?: number;
	refused?: string;
}

/** ⭐ D84 — a probe's program, checked at its seam: its folder, ~~its user configuration,~~ its argv and devin's version held to what was approved, then run. */
function checkedProbeExec(approved: Manifest, exec: ProbeExec, seen: ProbeSeen): DevinExec {
	return async (file, args, options) => {
		// ⭐ L17b4 round 4 (§18) — ~~`{ path: 'devin-version.txt', bytes: Buffer.from(seen.version, 'utf8') }`~~: the call's version by its parts, compared as
		// they were shown, so another build than the one shown is refused here.
		const now = manifestOfFiles([...probeFiles(file, args, options), { path: 'devin-version.txt', bytes: devinVersionShown(seen.version) }]);
		const differences = manifestDifferences(approved, now);
		if (differences.length > 0) throw new Error((seen.refused = `D84 refused the probe at its transport: ${differences.join('; ')}`));
		const began = performance.now();
		try {
			return await exec(file, args, options, (started) => {
				seen.pid = started;
			});
		} finally {
			seen.callMs = Math.round(performance.now() - began);
		}
	};
}

/** A probe call's record: what came of it, as the Historian's call reports it, its seam's refusal in place of the program's failure where there is one. */
function probeRecordOf(
	r: { readonly probe: string; readonly approvedManifestSha256: string; readonly startedAt: string; readonly answer: string | undefined },
	outcome: Awaited<ReturnType<typeof devinHistorianCall>>,
	seen: ProbeSeen,
	childrenAfter: ProbeCallRecord['childrenAfter']
): ProbeCallRecord {
	let said: ProbeCallRecord['outcome'] = { ran: false, why: outcome.ran ? '' : outcome.why };
	if (outcome.ran) said = outcome.failure === undefined ? { ran: true } : { ran: true, failure: seen.refused ?? outcome.failure };
	return {
		probe: r.probe,
		approvedManifestSha256: r.approvedManifestSha256,
		startedAt: r.startedAt,
		endedAt: new Date().toISOString(),
		...(seen.callMs === undefined ? {} : { callMs: seen.callMs }),
		outcome: said,
		...(r.answer === undefined ? {} : { answerSha256: sha256Of(r.answer) }),
		...(seen.pid === undefined ? {} : { pid: seen.pid }),
		...(childrenAfter === undefined ? {} : { childrenAfter })
	};
}

/**
 * ⭐⭐ D84 — CALL ONE PROBE: refused without the flag, without its approval, a second time, after an attempt with no record (r2, `D84R-A01`), or
 * ~~beyond the sixth shown (r2, `D84R-A02`)~~ where six probes hold an attempt already (r3); its folder made again and checked at its seam, every byte
 * held to what was approved; its answer and export kept beside its record, never in the copy. ⛔ It stops no process: a probe that lists its call's
 * children lists them after the call, by its process id.
 */
export async function callProbe(
	folder: string,
	name: string,
	host: ProbeHost,
	exec: ProbeExec,
	env: Readonly<Record<string, string | undefined>>
): Promise<{ readonly called: ProbeCallRecord } | { readonly refusedBecause: string }> {
	const paid = paidRefusal(env);
	if (paid !== undefined) return { refusedBecause: paid };
	if (!PROBE_NAME.test(name)) return { refusedBecause: `a probe is named <NN>-<name>, and ${JSON.stringify(name)} is not` };
	const at = probeFolderOf(folder, name);
	const approval = approvalRefusal(at);
	if (approval !== undefined) return { refusedBecause: approval };
	if (existsSync(join(at, D84_LAYOUT.call))) return { refusedBecause: `the probe ${name} has been called: a probe is called once` };
	// ⭐ r2 (`D84R-A01` (a)) — and a probe holding an attempt and no call record: a call killed, or thrown out of, between its program and its record.
	const attempted = attemptRefusal(at, `the probe ${name}`);
	if (attempted !== undefined) return { refusedBecause: attempted };
	// ⭐⭐ r3 — THE PROBES COUNTED BY WHAT IS SPENT, read at the call, under the step's lock: where six hold an attempt already, no other is called.
	const spent = attemptedProbes(folder);
	if (spent.length >= D84_MAX_PROBES)
		return {
			refusedBecause: `the probe ${name} is not called: ${spent.length} probes hold an attempt already (${spent.join(', ')}), each a call made or begun, and D84 makes at most ${D84_MAX_PROBES} (REG-D-189 (3); the lead's rulings r3)`
		};
	const approved = shownManifestOf(at)!;
	const said = readJson<ProbeDefinition>(join(at, D84_LAYOUT.definition, 'probe.json'))!;
	const made = probeFolderFrom(join(at, D84_LAYOUT.definition));
	if ('refusedBecause' in made) return made;
	// ⭐⭐ L17b4 — the lead's §15.5 (d) (`L4C-A03`) — A PLANTED LINK WHOSE KIND OR TARGET CHANGED SINCE THE APPROVAL IS REFUSED HERE, before the attempt is
	// reserved and before devin runs: the folder made again is removed, and the call spends nothing.
	const linksChanged = plantedLinkDifferences(approved, made.folder);
	if (linksChanged.length > 0) {
		rmSync(made.folder, { recursive: true, force: true });
		rmSync(made.host, { recursive: true, force: true });
		return {
			refusedBecause: `the probe ${name} is not called: its planted links are not what was approved — ${linksChanged.join('; ')} (the lead's §15.5 (d), L4C-A03): refused before devin runs, and no attempt is reserved`
		};
	}
	// ⭐⭐ r2 (`D84R-A01` (a)) — THE ATTEMPT, RESERVED NOW, every check passed and immediately before the call that runs devin: written exclusively, so a
	// second launcher fails here — its folder removed, as the call would remove it — and never deleted.
	const startedAt = new Date().toISOString();
	const reserved = reserveAttempt(at, `the probe ${name}`, { manifestSha256: approved.sha256, at: startedAt });
	if (reserved !== undefined) {
		rmSync(made.folder, { recursive: true, force: true });
		rmSync(made.host, { recursive: true, force: true });
		return { refusedBecause: reserved };
	}
	// ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — ~~`const seen: ProbeSeen = { version: '' };`~~ ~~`{ versionOf: async () => (seen.version = await
	// host.devinVersion()), exec: checkedProbeExec(approved, exec, seen) }`~~: the call's version read kept by its parts alone, for its seam.
	const seen: ProbeSeen = { version: devinVersionParts('') };
	const outcome = await devinHistorianCall(
		{ folder: made, model: said.model ?? host.model, boundMs: said.boundMs },
		{
			versionOf: async () => {
				const reply = await host.devinVersion();
				seen.version = devinVersionParts(reply);
				return reply;
			},
			exec: checkedProbeExec(approved, exec, seen)
		}
	);
	const childrenAfter = said.listChildren === true && seen.pid !== undefined ? await host.childrenOf(seen.pid) : undefined;
	const answer = outcome.ran && outcome.failure === undefined ? outcome.stdout : undefined;
	if (answer !== undefined) writeFileSync(join(at, 'answer.txt'), answer, { flag: 'wx' });
	if (outcome.ran && outcome.sessionExport !== undefined) writeFileSync(join(at, 'export.json'), outcome.sessionExport, { flag: 'wx' });
	const record = probeRecordOf({ probe: name, approvedManifestSha256: approved.sha256, startedAt, answer }, outcome, seen, childrenAfter);
	writeOnce(join(at, D84_LAYOUT.call), record);
	return { called: record };
}
