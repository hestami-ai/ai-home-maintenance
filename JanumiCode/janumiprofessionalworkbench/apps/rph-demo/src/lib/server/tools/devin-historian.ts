// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D86 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.40; `REG-D-167` (3); the lead's rulings 2, 6, 8,
// 16 and 17 on L17b2's Stage 0, §7 (Q1) and §9) — THE HISTORIAN IS A DEVIN SESSION WITH READ-ONLY TOOLS, IN A FRESH FOLDER OF COPIES.
//
// ⭑ ITS TOOLS, AT DEVIN 3000.11.234 (ruling 2): `read`, `grep`, `find_file_by_name` — this version's read-only finder, in devin's own read-only group —
// and `glob`, as D86 names it, allowed; every other name devin lists at that version, and MH-0a's names it does not offer, disabled in the user
// configuration passed as `--config` (`HISTORIAN_USER_CONFIG`) AND denied by name in the folder's project configuration (`HISTORIAN_PROJECT_CONFIG`),
// beside `Fetch(*)` and `mcp__*`; `subagents_enabled: false`; the seven `read_config_from` false. ⛔ The lists are true of ONE version: before the call,
// `devin --version` is read, and any version but the one whose tools were measured is not run, naming both (ruling 2 (A)).
// ⭑ ITS FOLDER (ruling 8; `writeHistorianFolder`): `prompt.txt`; `.devin/config.json`, its own; `records/`, the round's records as files, each named by
// its record's id, with `records/INDEX.md`; and `workspace/`, a copy of the shared workspace READ THROUGH THE PORT (§7, Q1: `historianWorkspaceFiles` —
// whole, or not at all). Beside it, a host folder holding the `--config` file and the export, outside what it may read. Both removed after the call.
// ⭑ ITS EXPORT (rulings 2 (B), 17; `historianToolCallsOf`): each tool call read for its name and its paths; a read outside the folder, and a tool not
// allowed, are each a MATERIAL finding on the assessment; an export whose calls cannot be read is a finding too, never a clean bill. ⚠ The shape read —
// `steps[].tool_calls[].function_name` and `arguments` — is the multi-harness design's reading of ATIF; no export on disk records a call at this version
// (L17b2 facts §2.4), so D84's measurement confirms it.
// ⭑ ITS TIME BOUND (ruling 16): `JPWB_HISTORIAN_CALL_MS`, required, with no default — unset, the Historian is not run; D84 fixes its value. The reviewer's
// 480 s is not assumed.
// ⛔ NO MODEL IS CALLED HERE IN A TEST: `devinHistorianCall` takes its program as a seam (`HistorianExec`), as `devinPrint` takes `DevinExec`.
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { Workspace } from '@janumipwb/rph-ports';
import { describedThrow } from '../described-throw.js';
import { DEVIN_BIN_OVERRIDE } from './devin-reviewer.js';
import { diagnosticCarriesPrompt } from './diagnostic-safety.js';

const run = promisify(execFile);
const DEVIN_BIN = DEVIN_BIN_OVERRIDE ?? 'devin';

/** ⭐ Ruling 2 (A) — the devin version whose tool listing the two configurations below were measured against (L17b2 facts §2.4). */
export const DEVIN_HISTORIAN_MEASURED_VERSION = '3000.11.234';

/** ⭐ D86, ruling 2 — the tools the Historian may use: D86's three, and this version's read-only finder. */
export const HISTORIAN_ALLOWED_TOOLS: readonly string[] = ['read', 'grep', 'find_file_by_name', 'glob'];

/**
 * ⭐ Ruling 2 — every other tool, by name: devin 3000.11.234's own listing less the allowed (its 25 tools, as every export it wrote lists them), and
 * MH-0a's `disabled_tools` names this version does not offer the selected model (`DESIGN-multi-harness-executor.md` §4.1). 26.
 */
export const HISTORIAN_DISABLED_TOOLS: readonly string[] = [
	'ask_user_question',
	'browser_preview',
	'close_browser_preview',
	'edit',
	'exec',
	'get_output',
	'kill_shell',
	'mcp_call_tool',
	'mcp_list_servers',
	'mcp_list_tools',
	'mcp_read_resource',
	'notebook_edit',
	'notebook_read',
	'read_subagent',
	'request_scope',
	'run_subagent',
	'skill',
	'todo_write',
	'web_search',
	'webfetch',
	'write',
	'write_to_process',
	'code_search',
	'apply_patch',
	'shell_command',
	'view_image'
];

/** ⭐ D86 — the seven places devin reads other agents' configuration from, each turned off (MH-0a). */
const READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;

/** ⭐ D86, ruling 2 — the user configuration, passed as `--config`: the 26 disabled, subagents off, no other agent's configuration read. */
export const HISTORIAN_USER_CONFIG = `${JSON.stringify(
	{
		disabled_tools: [...HISTORIAN_DISABLED_TOOLS],
		subagents_enabled: false,
		read_config_from: Object.fromEntries(READ_CONFIG_FROM.map((k) => [k, false]))
	},
	null,
	2
)}\n`;

/** ⭐ D86, ruling 2 — the second guard, the folder's project configuration: the 26 denied by name, with `Fetch(*)` and `mcp__*`. */
export const HISTORIAN_PROJECT_CONFIG = `${JSON.stringify({ permissions: { deny: [...HISTORIAN_DISABLED_TOOLS, 'Fetch(*)', 'mcp__*'] } }, null, 2)}\n`;

/** ⭐ Ruling 16 — the Historian's time bound's setting: required, with no default. */
export const HISTORIAN_CALL_MS_VARIABLE = 'JPWB_HISTORIAN_CALL_MS';

/** ⭐ Ruling 16 — why the Historian is not run while its time bound is unset. */
export const HISTORIAN_BOUND_UNSET = 'its time bound is not set: design D84 measures it';

/** ⭐ L17b2 addendum (the lead's §27, item 6) — the largest timer Node keeps, in milliseconds; it sets a larger one to 1 ms. */
const NODE_LARGEST_TIMER_MS = 2_147_483_647;

/** ⭐ Ruling 16 — the Historian's time bound, read from the environment: a positive whole number of milliseconds, at most Node's largest timer, or why
 *  it is not run. */
export function historianCallBound(
	env: Readonly<Record<string, string | undefined>> = process.env
): { readonly ok: true; readonly ms: number } | { readonly ok: false; readonly why: string } {
	const raw = env[HISTORIAN_CALL_MS_VARIABLE]?.trim() ?? '';
	if (raw === '') return { ok: false, why: HISTORIAN_BOUND_UNSET };
	if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
		return {
			ok: false,
			why: `its time bound, ${HISTORIAN_CALL_MS_VARIABLE}=${JSON.stringify(raw)}, is not a positive whole number of milliseconds: design D84 measures it`
		};
	// ⭐ L17b2 addendum (the lead's §27, item 6) — Node keeps a timer of at most 2147483647 ms and sets a larger one to 1 ms (`REG-F-638`'s number), so
	// the call would end at once: such a bound is refused as the others are, naming the limit.
	if (Number(raw) > NODE_LARGEST_TIMER_MS)
		return {
			ok: false,
			why: `its time bound, ${HISTORIAN_CALL_MS_VARIABLE}=${JSON.stringify(raw)}, is above ${NODE_LARGEST_TIMER_MS} ms, the largest timer Node keeps (it sets a larger one to 1 ms): design D84 measures it`
		};
	return { ok: true, ms: Number(raw) };
}

/** ⭐ §9 (1) — why a file the shared workspace lists is not copied: its read does not reproduce its bytes. */
export const NOT_TEXT_NOT_COPIED = 'not text: not copied';

/** One file of the Historian's `workspace/`: copied, its text; or named and not copied, its size and why (§9 (1)). */
export type HistorianWorkspaceFile =
	| { readonly path: string; readonly text: string }
	| { readonly path: string; readonly byteSize: number; readonly notCopied: string };

/**
 * ⭐ §9 (1) — WHETHER A READ REPRODUCES THE FILE'S BYTES: its text's UTF-8 encoding is exactly as long as the listing says, and it holds no U+FFFD — the mark
 * a UTF-8 read leaves where the bytes are not UTF-8. Bytes that are UTF-8 decode and re-encode to themselves, a byte-order mark among them (the port's read
 * keeps it); bytes that are not leave the mark. ⚠ A UTF-8 file that holds U+FFFD itself is told apart from none through the port, so it is named and not
 * copied too: the check fails toward leaving bytes out, never toward writing bytes the workspace does not hold.
 */
function reproduces(text: string, byteSize: number): boolean {
	return Buffer.byteLength(text, 'utf8') === byteSize && !text.includes('�');
}

/**
 * ⭐⭐ §7 (Q1), §9 — THE SHARED WORKSPACE READ THROUGH THE PORT, for the Historian's `workspace/`: its `list`, then each live entry's `readFile`, whatever the
 * workspace's materialization. ⛔ NO PARTIAL COPY: a listing that fails, or a file it lists that cannot be read, gives no copy at all, naming why or the
 * file — the Historian never judges from part of the workspace. ⭑ A file read whose text does not reproduce its bytes is named, not written (§9 (1)); a
 * folder with no files is not listed, so not copied (§9 (2)); a link is not listed, so left out (§9 (3)).
 */
export async function historianWorkspaceFiles(
	workspace: Pick<Workspace, 'list' | 'readFile'>
): Promise<{ readonly ok: true; readonly files: readonly HistorianWorkspaceFile[] } | { readonly ok: false; readonly why: string }> {
	let entries: Awaited<ReturnType<Workspace['list']>>;
	try {
		entries = await workspace.list();
	} catch (e) {
		return {
			ok: false,
			why: `the shared workspace could not be listed (${describedThrow(e)}), so no copy of it is made: the Historian never judges from part of it (L17b2 §7)`
		};
	}
	const files: HistorianWorkspaceFile[] = [];
	for (const entry of entries) {
		if (entry.purged) {
			files.push({ path: entry.path, byteSize: entry.byteSize, notCopied: 'purged: its bytes are gone' });
			continue;
		}
		let text: string | undefined;
		let failed = '';
		try {
			text = await workspace.readFile(entry.path);
		} catch (e) {
			failed = ` (${describedThrow(e)})`;
		}
		if (text === undefined)
			return {
				ok: false,
				why:
					`${entry.path} is listed in the shared workspace and could not be read through it${failed}, so no copy of the workspace is made: the ` +
					'Historian never judges from part of it (L17b2 §7)'
			};
		files.push(reproduces(text, entry.byteSize) ? { path: entry.path, text } : { path: entry.path, byteSize: entry.byteSize, notCopied: NOT_TEXT_NOT_COPIED });
	}
	return { ok: true, files };
}

/** One file of the Historian's `records/`: its name (its record's id, and an extension), what it is, and its text. */
export interface HistorianRecordFile {
	readonly file: string;
	readonly what: string;
	readonly text: string;
}

/** ⭐ Ruling 8 — the folder a call runs in, and its host folder beside it, outside what it may read. */
export interface HistorianFolder {
	readonly folder: string;
	readonly host: string;
	readonly promptPath: string;
	readonly exportPath: string;
	readonly userConfigPath: string;
}

/** A record's file name: one name, no path in it, and not the index's. */
function recordName(file: string): string {
	if (file === '' || file === '.' || file === '..' || /[\\/:]/.test(file) || file === 'INDEX.md')
		throw new Error(`the record file name ${JSON.stringify(file)} is not one plain file name under records/`);
	return file;
}

/**
 * ⭐ L17b2 addendum (the lead's §27, item 7) — WHY THE HISTORIAN'S RECORDS CANNOT ALL BE WRITTEN UNDER `records/`: two of them of one name, so one
 * would be written over the other. Names are compared as Windows' file system compares them, case not told apart (record ids are minted in one
 * case, so this refuses nothing real). `undefined` where each name is its own.
 */
export function recordNameClash(records: readonly HistorianRecordFile[]): string | undefined {
	const seen = new Map<string, string>();
	for (const r of records) {
		const key = r.file.toLowerCase();
		const before = seen.get(key);
		if (before !== undefined) {
			const names = before === r.file ? `records/${r.file}` : `records/${before} and records/${r.file}, case not told apart`;
			return `two of its record files have one name, ${names}: its folder is not written, so that neither is written over the other (design D86)`;
		}
		seen.set(key, r.file);
	}
	return undefined;
}

/** Where a workspace file lands under `workspace/`, refused where its path would leave it. */
function workspaceTarget(root: string, path: string): string {
	const at = resolve(root, path);
	const rel = relative(root, at);
	if (rel === '' || isAbsolute(rel) || rel.split(/[\\/]/)[0] === '..')
		throw new Error(`the workspace path ${JSON.stringify(path)} would leave the Historian's workspace/`);
	return at;
}

/**
 * ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A02; the lead's r26 (2)) — WHY THE WORKSPACE CANNOT ALL BE COPIED UNDER
 * `workspace/`: two of the files it copies land on one name there, so one would be written over the other while the index says every file is copied. The
 * check `recordNameClash` makes of the records, made of the copy targets: each copied file's path resolved as `workspaceTarget` resolves it, the names
 * compared as Windows' file system compares them, case not told apart (an in-memory workspace may hold `A.txt` and `a.txt`). A file not copied writes
 * nothing, so it clashes with none. `undefined` where each target is its own.
 */
export function workspaceCopyClash(files: readonly HistorianWorkspaceFile[]): string | undefined {
	const root = resolve('/', 'workspace');
	const seen = new Map<string, string>();
	for (const f of files) {
		if (!('text' in f)) continue;
		const target = relative(root, resolve(root, f.path)).toLowerCase();
		const before = seen.get(target);
		if (before !== undefined) {
			const paths = before === f.path ? `workspace/${f.path}, twice` : `workspace/${before} and workspace/${f.path}, case not told apart`;
			return `two of the workspace's files land on one name in its copy, ${paths}: its folder is not written, so that neither is written over the other (design D86)`;
		}
		seen.set(target, f.path);
	}
	return undefined;
}

/**
 * ⭐ L17b2 (the lead's r27, r27a (A)) — A WORKSPACE FILE THAT LANDS ON A NAME ITS COPY ALREADY HOLDS, refused at its write. The case check
 * (`workspaceCopyClash`) comes first and needs no write; but a volume may read names by rules no check of the names can know — an 8.3 short name,
 * `ABCDEF~1.TXT`, is a second name of `abcdefghij.txt` — so the copy creates each workspace file and writes over none (`flag: 'wx'`). A name the volume
 * already holds answers EEXIST, and the write is refused in D86's words, the path as the workspace gave it, relative to the folder: never the absolute
 * path EEXIST's own message names. One named kind, so that the Historian's part records it not run, as it does the case pair; every other write error
 * is thrown as it was, and recorded failing.
 */
export class HistorianCopyRefusal extends Error {}

/** ⭐ r27 — one workspace file of the copy, created and never written over: a name its copy already holds is a `HistorianCopyRefusal`. */
async function writeWorkspaceFile(at: string, path: string, text: string): Promise<void> {
	try {
		await writeFile(at, text, { encoding: 'utf8', flag: 'wx' });
	} catch (e) {
		if ((e as { code?: unknown }).code !== 'EEXIST') throw e;
		throw new HistorianCopyRefusal(
			`a workspace file of its copy, workspace/${path}, lands on a name its copy already holds, as this volume reads names: its folder is not written, ` +
				'so that neither is written over the other (design D86)'
		);
	}
}

/** ⭐ Ruling 9 — `records/INDEX.md`: each record file and what it is, then each workspace file not copied, with its size and why. */
function indexOf(records: readonly HistorianRecordFile[], workspaceFiles: readonly HistorianWorkspaceFile[]): string {
	const notCopied = workspaceFiles.filter((f): f is Extract<HistorianWorkspaceFile, { notCopied: string }> => 'notCopied' in f);
	return [
		'# The Historian’s records',
		'',
		'Each file under records/, by the id of the record it holds, and what it is:',
		...(records.length > 0 ? records.map((r) => `- ${r.file} — ${r.what}`) : ['- (none)']),
		'',
		'The shared workspace’s files are under workspace/, each at its path, as the workspace lists them.',
		...(notCopied.length > 0
			? ['These files it lists are not copied:', ...notCopied.map((f) => `- workspace/${f.path} — ${f.notCopied} (${f.byteSize} bytes)`)]
			: ['Every file it lists is copied.']),
		''
	].join('\n');
}

/** Remove the folder and its host folder; why either was kept, or undefined. Never throws. */
async function removeFolders(folder: string, host: string): Promise<string | undefined> {
	const kept: string[] = [];
	for (const d of [folder, host])
		await rm(d, { recursive: true, force: true }).catch((e: unknown) => {
			kept.push(`${d} could not be removed: ${describedThrow(e)}`);
		});
	return kept.length > 0 ? kept.join('; ') : undefined;
}

/**
 * ⭐⭐ Ruling 8 — WRITE THE HISTORIAN'S FOLDER (see the header): a fresh `jpwb-historian-` folder holding `prompt.txt`, `.devin/config.json`, `records/`
 * with its index, and `workspace/` with each file copied at its path; beside it, `<folder>.host/` holding the user configuration and, after the call, the
 * export. ⛔ A write that fails removes both and throws: the caller records the Historian ~~not run~~ failing, with why ⭐ [CORRECTED 2026-11-21, the
 * lead's r27a: the part records a throw from here failing; its not-run cases are its checks before the folder is made] — and, since r27a (A), not run
 * for a `HistorianCopyRefusal`, each workspace file being created and never written over (r27). ⭐ L17b2 addendum (the lead's §27,
 * item 7) — two record files of one name (`recordNameClash`) are refused before any folder is made: none is written. ⭐ L17b2 (Codex's L17B2C-A02; the
 * lead's r26 (2)) — and two workspace files that land on one name in the copy (`workspaceCopyClash`), the same way.
 */
export async function writeHistorianFolder(input: {
	readonly prompt: string;
	readonly records: readonly HistorianRecordFile[];
	readonly workspaceFiles: readonly HistorianWorkspaceFile[];
}): Promise<HistorianFolder> {
	const clash = recordNameClash(input.records);
	if (clash !== undefined) throw new Error(clash);
	const copyClash = workspaceCopyClash(input.workspaceFiles);
	if (copyClash !== undefined) throw new Error(copyClash);
	const folder = await mkdtemp(join(tmpdir(), 'jpwb-historian-'));
	const host = `${folder}.host`;
	try {
		await mkdir(host);
		const promptPath = join(folder, 'prompt.txt');
		await writeFile(promptPath, input.prompt, 'utf8');
		await mkdir(join(folder, '.devin'));
		await writeFile(join(folder, '.devin', 'config.json'), HISTORIAN_PROJECT_CONFIG, 'utf8');
		await mkdir(join(folder, 'records'));
		for (const r of input.records) await writeFile(join(folder, 'records', recordName(r.file)), r.text, 'utf8');
		await writeFile(join(folder, 'records', 'INDEX.md'), indexOf(input.records, input.workspaceFiles), 'utf8');
		const workspace = join(folder, 'workspace');
		await mkdir(workspace);
		for (const f of input.workspaceFiles) {
			if (!('text' in f)) continue;
			const at = workspaceTarget(workspace, f.path);
			await mkdir(dirname(at), { recursive: true });
			// ⭐ r27 — ~~`await writeFile(at, f.text, 'utf8');`~~, which wrote over a name the volume already held: created, never written over.
			await writeWorkspaceFile(at, f.path, f.text);
		}
		const userConfigPath = join(host, 'config.json');
		await writeFile(userConfigPath, HISTORIAN_USER_CONFIG, 'utf8');
		return { folder, host, promptPath, exportPath: join(host, 'export.json'), userConfigPath };
	} catch (e) {
		await removeFolders(folder, host);
		throw e;
	}
}

/** ⭐ Ruling 6 — the Historian's program as a seam: `DevinExec`'s shape (`devin-reviewer.ts`). */
export type HistorianExec = (
	file: string,
	args: readonly string[],
	options: { readonly cwd: string; readonly timeout: number; readonly maxBuffer: number; readonly windowsHide: boolean }
) => Promise<{ readonly stdout: string }>;

/** ⭐ Ruling 2 (A) — what `devin --version` answers, as a seam. */
export type HistorianVersionOf = () => Promise<string>;

/** What a call came to: not run, and why; run and failed, and how; or run, its answer and its export. Each with any folder that could not be removed. */
export type HistorianCallOutcome = (
	| { readonly ran: false; readonly why: string }
	| { readonly ran: true; readonly failure: string; readonly sessionExport?: string }
	| { readonly ran: true; readonly failure?: undefined; readonly stdout: string; readonly sessionExport?: string }
) & { readonly folderNotRemoved?: string };

/**
 * ⭐ Ruling 2 (A) — WHY DEVIN'S REPORTED VERSION LEAVES THE HISTORIAN NOT RUN, or undefined at the version its tools were measured at: the one reading of
 * `devin --version`'s words — the first `<n>.<n>.<n>` they hold — which the call makes before it runs (`callIn`) and the live lane's paid boot makes before
 * any paid call (`e2e-live-exec/phase7-operator.ts`, `bootOf`; L17b2 ruling 6 (C)), so the two can never word the rule, or read it, apart.
 */
export function historianVersionRefusal(reported: string): string | undefined {
	const version = /\b(\d+\.\d+\.\d+)\b/.exec(reported)?.[1];
	if (version === DEVIN_HISTORIAN_MEASURED_VERSION) return undefined;
	return (
		`devin is at version ${version ?? JSON.stringify(reported.trim())}, and the Historian's two tool lists were measured at ` +
		`${DEVIN_HISTORIAN_MEASURED_VERSION}: they are true of that version alone, so it is not run (L17b2 ruling 2 (A))`
	);
}

/** `devin --version`, run with no session and no model. */
async function devinVersion(): Promise<string> {
	const { stdout } = await run(DEVIN_BIN, ['--version'], { timeout: 30_000, windowsHide: true });
	return String(stdout);
}

/** The call itself, never throwing: the version first, then devin in the folder. */
async function callIn(
	call: { readonly folder: HistorianFolder; readonly model: string; readonly boundMs: number },
	exec: HistorianExec,
	versionOf: HistorianVersionOf
): Promise<HistorianCallOutcome> {
	const { folder } = call;
	let reported: string;
	try {
		reported = await versionOf();
	} catch (e) {
		return {
			ran: false,
			why:
				`devin's version could not be read (devin --version: ${describedThrow(e)}), and the Historian's two tool lists are true of the version they ` +
				`were measured at, ${DEVIN_HISTORIAN_MEASURED_VERSION}: so it is not run (L17b2 ruling 2 (A))`
		};
	}
	// ⭐ L17b2 (2c) — the one reading of the version, which the live lane's paid boot shares (`historianVersionRefusal`): its words as they were here.
	const versionRefused = historianVersionRefusal(reported);
	if (versionRefused !== undefined) return { ran: false, why: versionRefused };
	const prompt = await readFile(folder.promptPath, 'utf8').catch(() => '');
	try {
		const { stdout } = await exec(
			DEVIN_BIN,
			[
				'--print',
				'--model',
				call.model,
				'--prompt-file',
				folder.promptPath,
				'--export',
				folder.exportPath,
				// A fresh folder is untrusted by construction; the control is isolation, as the reviewer's (`devinPrint`).
				'--respect-workspace-trust',
				'false',
				// ⭐ D86 — its own user configuration, never the user's or the project's.
				'--config',
				folder.userConfigPath
			],
			{ cwd: folder.folder, timeout: call.boundMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true }
		);
		const sessionExport = await readFile(folder.exportPath, 'utf8').catch(() => undefined);
		return { ran: true, stdout: String(stdout), ...(sessionExport === undefined ? {} : { sessionExport }) };
	} catch (e) {
		const raw = describedThrow(e);
		// ⭑ As `devinPrint`: a diagnostic measured to carry the prompt is withheld, never projected (PER-12).
		const failure = diagnosticCarriesPrompt(raw, prompt)
			? 'devin invocation failed. Its diagnostic is WITHHELD: it was measured to contain the prompt, which may not reach the record plane (PER-12).'
			: `devin invocation failed: ${raw}`;
		const sessionExport = await readFile(folder.exportPath, 'utf8').catch(() => undefined);
		return { ran: true, failure, ...(sessionExport === undefined ? {} : { sessionExport }) };
	}
}

/**
 * ⭐⭐ D86, rulings 2 (A), 6, 8 — ONE CALL OF THE HISTORIAN: devin's version read and held to the one measured; then `devin --print` in the folder, its
 * prompt, export and configuration named, at the time bound handed in; its export read; and the folder and its host removed after, whatever came of it.
 * `given` is the stage's seam (`historianExec`, `historianVersionOf`): absent, the real program.
 */
export async function devinHistorianCall(
	call: { readonly folder: HistorianFolder; readonly model: string; readonly boundMs: number },
	given: { readonly exec?: HistorianExec; readonly versionOf?: HistorianVersionOf } = {}
): Promise<HistorianCallOutcome> {
	const outcome = await callIn(call, given.exec ?? (run as unknown as HistorianExec), given.versionOf ?? devinVersion);
	const notRemoved = await removeFolders(call.folder.folder, call.folder.host);
	return notRemoved === undefined ? outcome : { ...outcome, folderNotRemoved: notRemoved };
}

/** ⭐ Rulings 2 (B), 17 — the findings an export's tool calls give, each MATERIAL. */
export const HISTORIAN_READ_OUTSIDE_FOLDER = 'HISTORIAN_READ_OUTSIDE_FOLDER';
export const HISTORIAN_TOOL_NOT_ALLOWED = 'HISTORIAN_TOOL_NOT_ALLOWED';
export const HISTORIAN_TOOL_CALLS_UNREADABLE = 'HISTORIAN_TOOL_CALLS_UNREADABLE';

/** One tool call, as the stage record holds it: its name, its paths as the call gave them, whether each is inside the folder, and whether it is allowed. */
export interface HistorianToolCall {
	readonly name: string;
	readonly paths: readonly string[];
	readonly inside: boolean;
	readonly allowed: boolean;
}

/** A finding on the Historian's assessment from its export. */
export interface HistorianToolFinding {
	readonly code: string;
	readonly severity: 'MATERIAL';
	readonly statement: string;
}

/** The arguments a call names a path by. */
const PATH_ARGUMENTS = ['file_path', 'path', 'notebook_path', 'cwd'] as const;

/**
 * ⭐ L17b2 addendum (the lead's §27, item 5) — whether a string among a call's OTHER arguments is read as a path it names, failing closed: it begins with
 * `~`, is absolute, or holds a `..` segment (split on `/` and `\`). A word, a pattern or a relative glob names no place. Each allowed tool's argument
 * names at this version are D84's to measure; the reader is restated to them there.
 */
function pathLike(value: string): boolean {
	return value.startsWith('~') || isAbsolute(value) || value.split(/[\\/]/).includes('..');
}

/** Every string among `value`, at any depth of its objects and arrays, in order. */
function stringsIn(value: unknown): string[] {
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.flatMap(stringsIn);
	if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(stringsIn);
	return [];
}

/**
 * Whether `path` resolves inside `folder`, a relative one against it. ⭐ L17b2 addendum (the lead's §27, item 5) — `\` read as a separator; and one
 * that begins with `~` never does: devin may expand it to the home folder (whether it does is D84's to measure).
 */
function insideFolder(path: string, folder: string): boolean {
	if (path.startsWith('~')) return false;
	const p = path.replaceAll('\\', '/');
	const rel = relative(folder, isAbsolute(p) ? p : resolve(folder, p));
	return !isAbsolute(rel) && rel.split(/[\\/]/)[0] !== '..';
}

/** One call read, or why it is not in the read shape. */
function callOf(c: unknown, folder: string): HistorianToolCall | string {
	if (typeof c !== 'object' || c === null || Array.isArray(c)) return 'is not an object';
	const o = c as { function_name?: unknown; arguments?: unknown };
	if (typeof o.function_name !== 'string' || o.function_name === '') return 'names no function';
	// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — ~~`o.arguments ?? {}`~~: arguments that are
	// missing are none, as a tool with no arguments is called; arguments that are null are not an object — the check below refuses them, never a clean bill.
	let args: unknown = o.arguments === undefined ? {} : o.arguments;
	if (typeof args === 'string')
		try {
			args = JSON.parse(args);
		} catch {
			return 'has arguments that are not JSON';
		}
	if (typeof args !== 'object' || args === null || Array.isArray(args)) return 'has arguments that are not an object';
	const a = args as Record<string, unknown>;
	const named = [
		...PATH_ARGUMENTS.flatMap((k) => (typeof a[k] === 'string' ? [a[k]] : [])),
		...(Array.isArray(a.paths) ? a.paths.filter((p): p is string => typeof p === 'string') : [])
	];
	// ⭐ L17b2 addendum (the lead's §27, item 5) — and, failing closed, every other string among its arguments, under any name and at any depth, that
	// is read as a path (`pathLike`).
	const paths = [...named, ...stringsIn(a).filter((s) => pathLike(s) && !named.includes(s))];
	return {
		name: o.function_name,
		paths,
		inside: paths.every((p) => insideFolder(p, folder)),
		allowed: HISTORIAN_ALLOWED_TOOLS.includes(o.function_name)
	};
}

/**
 * ⭐⭐ Rulings 2 (B), 17 — THE EXPORT READ FOR ITS TOOL CALLS: each call's name and paths, each path resolved against the folder; a call reaching outside
 * it `HISTORIAN_READ_OUTSIDE_FOLDER`, naming the path, and a tool not allowed `HISTORIAN_TOOL_NOT_ALLOWED`, naming it, in the calls' order. ⛔ An export that
 * is missing, does not parse, or holds a step whose calls are not in the read shape gives no calls and ONE finding, `HISTORIAN_TOOL_CALLS_UNREADABLE` —
 * never a clean bill.
 */
export function historianToolCallsOf(
	exportText: string | undefined,
	folder: string
): { readonly calls: readonly HistorianToolCall[]; readonly findings: readonly HistorianToolFinding[] } {
	const unreadable = (why: string) => ({
		calls: [],
		findings: [
			{
				code: HISTORIAN_TOOL_CALLS_UNREADABLE,
				severity: 'MATERIAL' as const,
				statement: `its tool calls could not be read from its export: ${why}, so what it read is not known — never a clean bill (L17b2 ruling 17)`
			}
		]
	});
	if (exportText === undefined) return unreadable('there is no export');
	let parsed: unknown;
	try {
		parsed = JSON.parse(exportText);
	} catch {
		return unreadable('the export is not JSON');
	}
	const steps = typeof parsed === 'object' && parsed !== null ? (parsed as { steps?: unknown }).steps : undefined;
	if (!Array.isArray(steps)) return unreadable('its steps are not a list');
	const calls: HistorianToolCall[] = [];
	for (const [i, step] of steps.entries()) {
		if (typeof step !== 'object' || step === null || Array.isArray(step)) return unreadable(`its step ${i + 1} is not an object`);
		const listed = (step as { tool_calls?: unknown }).tool_calls;
		if (listed === undefined) continue;
		if (!Array.isArray(listed)) return unreadable(`its step ${i + 1}'s tool_calls is not a list`);
		for (const c of listed) {
			const read = callOf(c, folder);
			if (typeof read === 'string') return unreadable(`a call of its step ${i + 1} ${read}`);
			calls.push(read);
		}
	}
	const findings = calls.flatMap((c): HistorianToolFinding[] => [
		...(c.inside
			? []
			: [
					{
						code: HISTORIAN_READ_OUTSIDE_FOLDER,
						severity: 'MATERIAL' as const,
						statement:
							`the Historian's ${c.name} call reached outside its folder: ${c.paths.filter((p) => !insideFolder(p, folder)).join(', ')} ` +
							'(design D86; L17b2 ruling 17)'
					}
				]),
		...(c.allowed
			? []
			: [
					{
						code: HISTORIAN_TOOL_NOT_ALLOWED,
						severity: 'MATERIAL' as const,
						statement: `the Historian called ${c.name}, a tool not among the allowed (${HISTORIAN_ALLOWED_TOOLS.join(', ')}) (design D86; L17b2 ruling 2 (B))`
					}
				])
	]);
	return { calls, findings };
}
