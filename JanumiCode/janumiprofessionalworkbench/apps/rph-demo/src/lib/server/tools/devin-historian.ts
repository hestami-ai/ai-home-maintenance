// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D86 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.40; `REG-D-167` (3); the lead's rulings 2, 6, 8,
// 16 and 17 on L17b2's Stage 0, §7 (Q1) and §9) — THE HISTORIAN IS A DEVIN SESSION WITH READ-ONLY TOOLS, IN A FRESH FOLDER OF COPIES.
//
// ⭑ ITS TOOLS, AT DEVIN 3000.11.234 (ruling 2): `read`, `grep`, `find_file_by_name` — this version's read-only finder, in devin's own read-only group —
// and `glob`, as D86 names it, allowed; every other name devin lists at that version, and MH-0a's names it does not offer, ~~disabled in the user
// configuration passed as `--config` (`HISTORIAN_USER_CONFIG`) AND~~ denied by name in the folder's project configuration (`HISTORIAN_PROJECT_CONFIG`),
// beside `Fetch(*)` and `mcp__*`~~; `subagents_enabled: false`; the seven `read_config_from` false~~. ⭐ L17b4 — design D93 (`REG-F-684`; `REG-D-197`):
// any `--config` file stalls devin 3000.11.234 on this host, so none is passed. The tools are held by the deny list and the export's audit (ruling 2 (B)),
// the subagents by `run_subagent` and `read_subagent` denied by name; ~~what devin reads of other agents' configuration is measured (D93's probes P4a
// and P4b), not assumed~~. ⭐ L17b5 (`REG-D-199`; `REG-F-688`; D93's probe P4b) — measured, and acted on: P4a found devin given other agents' rules
// files at its folder's top and the machine user's always-on rule, and P4b that the seven `read_config_from` keys, each false, stop both. So the seven
// are back, in the folder's project configuration beside its deny list (`READ_CONFIG_FROM`, `HISTORIAN_PROJECT_CONFIG`). ⛔ The lists are true of ONE
// version: before the call, `devin --version` is read, and any version but the one whose tools were measured is not run, naming both (ruling 2 (A)).
// ⭑ ITS FOLDER (ruling 8; `writeHistorianFolder`): `prompt.txt`; `.devin/config.json`, its own; `records/`, the round's records as files, each named by
// its record's id, with `records/INDEX.md`; and `workspace/`, a copy of the shared workspace READ THROUGH THE PORT (§7, Q1: `historianWorkspaceFiles` —
// whole, or not at all). Beside it, a host folder holding ~~the `--config` file and~~ the export alone, outside what it may read. Both removed after the
// call. ⭐ L17b6 (D94; the lead's §39, Q13) — the host folder holds nothing since D94: the call writes no export. It is kept in this package; removing it
// is a later tidy package's work.
// ⭑ ⭐ L17b4 — design D93 (`REG-F-685`) — A CALL THAT FAILS IS RECORDED BY ITS KIND ALONE ~~(`devinFailureRecord`, the reviewer's one definition)~~ ⭐
// (L17b6, D94; §39, Q10: `historianAcpFailureRecord`, beside the reviewer's): never devin's own words~~, whose command line names the call's folder under
// the home folder and whose stderr holds its login banner. Its export is still read on failure, as on success~~.
// ⭑ ~~ITS EXPORT~~ ⭐ ITS TOOL CALLS, READ FROM ITS NOTICES (L17b6, D94; rulings 2 (B), 17; `historianToolCallsOf`): each tool call read ~~for its name and
// its paths~~ ⭐ from its `tool_call` notice and the updates that give its kind, input or places — its name (devin's `_meta`), its kind, its paths, its last
// status; a read outside the folder, and a call ~~a tool~~ not allowed — its kind not `read` or `search`, or its name not among the allowed — are each a
// MATERIAL finding on the assessment; notices whose calls cannot be read are a finding too, never a clean bill. ~~⚠ The shape read —
// `steps[].tool_calls[].function_name` and `arguments` — is the multi-harness design's reading of ATIF; no export on disk records a call at this version
// (L17b2 facts §2.4), so D84's measurement confirms it.~~ The export is not read.
// ⭑ ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.48; `REG-F-689`, `REG-F-690`; `REG-D-202`
// to `REG-D-204`; the lead's rulings, `l17b4/l17b4-facts.md` §39, §41) — THE CALL SPEAKS devin's ACP SERVER (`devin acp`), IN "ASK" MODE: `initialize`
// with no file-system and no terminal capability, `session/new` in the folder with no MCP server, `session/set_mode` to `ask`, one `session/prompt`, and
// `session/delete` however the turn ends. The workbench answers each permission request devin makes (`historianPermissionAnswer`), and a refusal returns
// to the model, whose run goes on; a read devin allows itself is read from its notice and audited. The answer is read from the last message, the text
// after the last tool call (`REG-D-204`); the working remarks before it are kept in the call's record. At the bound, `session/cancel`; then the child is
// stopped by its own PID alone — its stdin closed, then terminated, then killed. Only the fields the call reads are kept: no raw devin message (§39,
// item 10). Its standard error is never read (REG-Q-066).
// ⭑ ITS TIME BOUND (ruling 16): `JPWB_HISTORIAN_CALL_MS`, required, with no default — unset, the Historian is not run; D84 fixes its value. The reviewer's
// 480 s is not assumed. ⭐ L17b6 (§39, Q4) — counted from the spawn; the waits after it are named (`HISTORIAN_CANCEL_GRACE_MS`,
// `HISTORIAN_DELETE_WAIT_MS`, `HISTORIAN_STOP_WAIT_MS`), and come in through the call's seam (§41).
// ⛔ NO MODEL IS CALLED HERE IN A TEST: `devinHistorianCall` takes its program as a seam ~~(`HistorianExec`), as `devinPrint` takes `DevinExec`~~ ⭐
// (`HistorianSpawn`, L17b6), and its tests drive a fake of devin's ACP server (`assurance/devin-acp-fake.testing.ts`).
import { execFile, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
// ⭐ L17b6 round 3 (the lead's §43.4) — ~~`import { promisify } from 'node:util';`~~: and `isDeepStrictEqual`, which a call's later notice is compared by.
import { isDeepStrictEqual, promisify } from 'node:util';
import type { Workspace } from '@janumipwb/rph-ports';
import { describedThrow } from '../described-throw.js';
// ⭐ L17b4 — design D93 (the lead's L4-Q2, L4-Q3) — the one definition of a failed call's record, beside the program override; ~~`import {
// diagnosticCarriesPrompt } from './diagnostic-safety.js';`~~, which leaves this path with the read of the prompt only it used.
// ⭐ L17b4 (the lead's §13.3 (a)) — and the part of that record between its parentheses, which the version read records alone.
// ⭐ L17b6 (D94; §39, Q10) — ~~`import { DEVIN_BIN_OVERRIDE, devinFailureKindAndNames, devinFailureRecord } from './devin-reviewer.js';`~~: the ACP call's
// failure has a record of its own (`historianAcpFailureRecord`), its two fixed phrases read by their presence (`DEVIN_FREE_TIER_REFUSAL`,
// `DEVIN_OUTPUT_LIMIT`) and named, never quoted.
import { DEVIN_BIN_OVERRIDE, DEVIN_FREE_TIER_REFUSAL, DEVIN_OUTPUT_LIMIT, devinFailureKindAndNames } from './devin-reviewer.js';
import { OUTPUT_LIMIT_NAME } from './output-limit.js';

const run = promisify(execFile);
const DEVIN_BIN = DEVIN_BIN_OVERRIDE ?? 'devin';

/**
 * ⭐ Ruling 2 (A) — the devin version whose tool listing ~~the two configurations below were~~ ⭐ (L17b4, D93; `L4C-B03`) the tool lists below — the
 * allowed, and the denied that the folder's project configuration names — were measured against (L17b2 facts §2.4). No user configuration is passed
 * (`REG-D-197`), so the project configuration is the Historian's one.
 */
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

// ⭐⭐ L17b4 — design D93 (`REG-F-684`; `REG-D-197`; the lead's L4-Q1 on Stage 0) — THE USER CONFIGURATION IS GONE~~, and the seven places with it~~: any
// `--config` file stalls devin 3000.11.234 on this host (D84's measurement: the Historian's own file, the same file, and `{}`, 3 of 3 calls), so the
// Historian is passed none, and its tools rest on the project configuration below and the export's audit. Struck, its words kept:
// ~~`/** ⭐ D86 — the seven places devin reads other agents' configuration from, each turned off (MH-0a). */`~~
// ~~`const READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;`~~
// ~~`/** ⭐ D86, ruling 2 — the user configuration, passed as `--config`: the 26 disabled, subagents off, no other agent's configuration read. */`~~
// ~~`export const HISTORIAN_USER_CONFIG = `${JSON.stringify({ disabled_tools: [...HISTORIAN_DISABLED_TOOLS], subagents_enabled: false,
// read_config_from: Object.fromEntries(READ_CONFIG_FROM.map((k) => [k, false])) }, null, 2)}\n`;`~~
// ⭐ L17b5 (`REG-D-199`; `REG-F-688`; D93's probe P4b) — the seven places come back, in the folder's project configuration: the line below.

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b5 — design D93 as amended (`REG-D-199`, the sponsor's "Restore the guard first"; `REG-F-688`) — THE SEVEN PLACES
 * DEVIN READS OTHER AGENTS' CONFIGURATION FROM, in D86's order (MH-0a), each turned off: back from L17b4, which removed them with the `--config` file.
 * They go in the folder's project configuration, where D93's probe P4b measured them holding: with all seven false, devin gives the call none of other
 * agents' rules files at the folder's top, and not the machine user's always-on rule (`l17b4/l17b4-facts.md` §24, §25).
 */
const READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;

/**
 * ⭐ D86, ruling 2 — ~~the second guard,~~ ⭐ (L17b4, D93: the guard, as no user configuration is passed) the folder's project configuration: the 26
 * denied by name, with `Fetch(*)` and `mcp__*`~~.~~ ⭐ (L17b5: `REG-D-199`; `REG-F-688`; D93's probe P4b), and `read_config_from` after them, the seven
 * places of `READ_CONFIG_FROM`, each false. Its bytes are P4b's measured file byte for byte: 830 bytes, LF, sha256 `40746e5c…`
 * (`l17b4/probes/p4b-project-config.json`), as its test holds them.
 */
// ⭐ L17b5 — ~~`export const HISTORIAN_PROJECT_CONFIG = `${JSON.stringify({ permissions: { deny: [...HISTORIAN_DISABLED_TOOLS, 'Fetch(*)', 'mcp__*'] } },
// null, 2)}\n`;`~~, the deny list alone (644 bytes): and the seven `read_config_from` keys now, each false.
export const HISTORIAN_PROJECT_CONFIG = `${JSON.stringify({ permissions: { deny: [...HISTORIAN_DISABLED_TOOLS, 'Fetch(*)', 'mcp__*'] }, read_config_from: Object.fromEntries(READ_CONFIG_FROM.map((k) => [k, false])) }, null, 2)}\n`;

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

/**
 * ⭐ Ruling 8 — the folder a call runs in, and its host folder beside it, outside what it may read: ⭐ (L17b4, D93) its export's, and nothing else. ⭐
 * L17b6 (D94; the lead's §39, Q13) — the host folder holds nothing since D94, and `exportPath` names a file no call writes: kept in this package,
 * removed by a later tidy package.
 */
export interface HistorianFolder {
	readonly folder: string;
	readonly host: string;
	readonly promptPath: string;
	readonly exportPath: string;
	// ⭐ L17b4 — design D93 (`REG-D-197`) — ~~`readonly userConfigPath: string;`~~: no user configuration is written or passed.
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
 * nothing, so it clashes with none. `undefined` where each target is its own. ⭐⭐ L17b2, after the independent re-review of the committed fix
 * (Codex's L17B2F-A02; the lead's r28 (2)(a)) — and no file of the copy at a folder of another's path: each copied target's folders are compared,
 * case not told apart, with the copied files' targets, in either order and at any depth (`A` beside `a/x.txt`, which an in-memory workspace holds
 * apart), the file named first; the case words said only where the cases differ.
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
	// ⭐ r28 (2)(a) — each folder of each copied target, by its key, with the path it is a folder of and its own case; then each copied target looked up.
	const keyOf = (name: string): string => name.toLowerCase();
	// A file not copied writes nothing, so it is at no folder of another's path, nor is it one.
	const copied = files.filter((f) => 'text' in f);
	const folders = new Map<string, { readonly path: string; readonly folder: string }>();
	for (const f of copied)
		for (const folder of foldersOf(copyTargetOf(root, f.path))) if (!folders.has(keyOf(folder))) folders.set(keyOf(folder), { path: f.path, folder });
	for (const f of copied) {
		const target = copyTargetOf(root, f.path);
		const under = folders.get(keyOf(target));
		if (under !== undefined) {
			const apart = under.folder === target ? '' : ', case not told apart';
			return (
				`two of the workspace's files land on one name in its copy, workspace/${f.path} as a file and as a folder of workspace/${under.path}${apart}: its ` +
				'folder is not written, so that neither is written over the other (design D86)'
			);
		}
	}
	return undefined;
}

/** ⭐ r28 (2)(a) — a copied file's target under `workspace/`, as `workspaceTarget` resolves it, its parts joined by `/`. */
function copyTargetOf(root: string, path: string): string {
	return relative(root, resolve(root, path)).split(/[\\/]/).join('/');
}

/** ⭐ r28 (2)(a) — the folders of a copy target, outermost first: each of its prefixes that ends at one of its separators. */
function foldersOf(target: string): string[] {
	const parts = target.split('/');
	return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join('/'));
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

/**
 * ⭐⭐ L17b2 (Codex's L17B2F-A02; the lead's r28 (2)(b)) — THE FOLDER OF ONE WORKSPACE FILE OF THE COPY, made within the named kind's reach: in a fresh
 * `mkdtemp` folder that only the copy writes, an EEXIST or an ENOTDIR from its `mkdir` means one of the copy's own names is in the way — a name the
 * volume reads as another's, which no check of the names can know (`ABCDEF~1.TXT/x.txt` after `abcdefghij.txt`). Refused in D86's words, the path as
 * the workspace gave it, never the absolute path the volume's own message names. Every other error of that `mkdir` is thrown as it was.
 */
async function makeWorkspaceFolder(folder: string, path: string): Promise<void> {
	try {
		await mkdir(folder, { recursive: true });
	} catch (e) {
		const code = (e as { code?: unknown }).code;
		if (code !== 'EEXIST' && code !== 'ENOTDIR') throw e;
		throw new HistorianCopyRefusal(
			`a folder of a workspace file of its copy, workspace/${path}, lands on a name its copy already holds, as this volume reads names: its folder ` +
				'is not written, so that neither is written over the other (design D86)'
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
 * with its index, and `workspace/` with each file copied at its path; beside it, `<folder>.host/` holding ~~the user configuration and,~~ ⭐ (L17b4, D93:
 * no user configuration) nothing until, after the call, the export. ⛔ A write that fails removes both and throws: the caller records the Historian
 * ~~not run~~ failing, with why ⭐ [CORRECTED 2026-11-21, the
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
			// ⭐ r28 (2)(b) — ~~`await mkdir(dirname(at), { recursive: true });`~~, whose EEXIST or ENOTDIR at a name the copy holds reached the part raw.
			await makeWorkspaceFolder(dirname(at), f.path);
			// ⭐ r27 — ~~`await writeFile(at, f.text, 'utf8');`~~, which wrote over a name the volume already held: created, never written over.
			await writeWorkspaceFile(at, f.path, f.text);
		}
		// ⭐ L17b4 — design D93 (`REG-F-684`; `REG-D-197`) — ~~`const userConfigPath = join(host, 'config.json');`~~
		// ~~`await writeFile(userConfigPath, HISTORIAN_USER_CONFIG, 'utf8');`~~
		// ~~`return { folder, host, promptPath, exportPath: join(host, 'export.json'), userConfigPath };`~~ — no user configuration: the host folder holds
		// the export alone, which devin writes.
		return { folder, host, promptPath, exportPath: join(host, 'export.json') };
	} catch (e) {
		await removeFolders(folder, host);
		throw e;
	}
}

// ⭐ L17b6 (D94) — ~~`/** ⭐ Ruling 6 — the Historian's program as a seam: `DevinExec`'s shape (`devin-reviewer.ts`). */`~~
// ~~`export type HistorianExec = (file: string, args: readonly string[], options: { … }) => Promise<{ readonly stdout: string }>;`~~ — the Historian no
// longer runs `devin --print`: its program's seam is the ACP child's (`HistorianSpawn`), and D84's print-mode probes have a call of their own
// (`measurement/d84-probes.ts`, the lead's §39, Q8 (b)).

/** ⭐ Ruling 2 (A) — what `devin --version` answers, as a seam. */
export type HistorianVersionOf = () => Promise<string>;

/** ⭐ L17b6 (D94) — the session's id as the launch holds it: devin names the session at `session/new`, and the call puts its id in. */
export const HISTORIAN_SESSION_HELD = '<session>';

/** ⭐ L17b6 (D94; the lead's §39, Q9) — the kinds of call the workbench may allow once. */
export const HISTORIAN_ALLOWED_KINDS: readonly string[] = ['read', 'search'];

/**
 * ⭐ L17b6 (D94; the lead's §39, Q9) — THE WORKBENCH'S PERMISSION RULE, IN WORDS: what D84 shows the sponsor, carried by each launch. The rule itself is
 * `historianPermissionAnswer`.
 */
export const HISTORIAN_PERMISSION_RULE =
	'Each session/request_permission is matched by its toolCallId to the call’s tool_call notice. It is answered allow_once only for a call of kind ' +
	'read or search, by a tool the Historian may use (read, grep, find_file_by_name, glob), that names at least one path, every one inside the folder ' +
	'(its rawInput’s file_path, path, notebook_path, cwd and paths, any other path-like string in it, and its locations); every other request is ' +
	'answered reject_once, and one that offers no reject_once is answered cancelled. No option that allows always, and never switch_bypass, is chosen. ' +
	'After session/cancel every request is answered cancelled, and any request but a permission request is answered -32601 (design D94).';

/** ⭐ L17b6 (D94; the lead's §39, Q4) — after the bound's `session/cancel`, how long the prompt's answer is waited for. */
export const HISTORIAN_CANCEL_GRACE_MS = 10_000;
/** ⭐ L17b6 (D94; §39, Q4) — how long `session/delete`'s answer is waited for. */
export const HISTORIAN_DELETE_WAIT_MS = 5_000;
/** ⭐ L17b6 (D94; §39, Q4) — how long each stop of the child is waited out before the next: its stdin closed, then terminated, then killed. */
export const HISTORIAN_STOP_WAIT_MS = 2_000;

/** ⭐ L17b6 (D94; the lead's §41) — the three waits, which come in through the call's seam, defaulting to the named constants. */
export interface HistorianWaits {
	readonly cancelGraceMs: number;
	readonly deleteWaitMs: number;
	readonly stopWaitMs: number;
}
/** ⭐ L17b6 (§41) — the waits a call takes where its seam gives none: the three named constants. */
export const HISTORIAN_DEFAULT_WAITS: HistorianWaits = {
	cancelGraceMs: HISTORIAN_CANCEL_GRACE_MS,
	deleteWaitMs: HISTORIAN_DELETE_WAIT_MS,
	stopWaitMs: HISTORIAN_STOP_WAIT_MS
};

/** ⭐ L17b6 (D94) — the Historian's launch, as the call makes it, and as D84 shows and checks it at its seam. */
export interface HistorianLaunch {
	readonly file: string;
	readonly args: readonly string[];
	readonly cwd: string;
	readonly windowsHide: true;
	readonly boundMs: number;
	/** The messages the call sends, in order — initialize, session/new, session/set_mode, session/prompt, session/delete — the session's id held. */
	readonly messages: readonly { readonly method: string; readonly params: unknown }[];
	/** The workbench's permission rule, in words. */
	readonly permissionRule: string;
}

/** ⭐ L17b6 (D94) — the running child, by lines: what the call writes to its stdin and reads from its stdout, its end, and its three stops. */
export interface HistorianAcpChild {
	readonly pid: number | undefined;
	/** One JSON-RPC message, as one line, to its stdin; a write after the child has gone is dropped. */
	readonly write: (line: string) => void;
	/** Each line of its stdout, in order. */
	readonly onLine: (listener: (line: string) => void) => void;
	/** Its end: its exit's code or signal, or its start's error by its code alone. */
	readonly exited: Promise<{ readonly code: number | null; readonly signal: string | null } | { readonly startError: string }>;
	/** The three stops, each by its own PID, never a process tree. */
	readonly closeStdin: () => void;
	readonly terminate: () => void;
	readonly kill: () => void;
}

/** ⭐ L17b6 (D94) — ~~`HistorianExec`~~: the Historian's program as a seam — the launch started, its child returned. */
export type HistorianSpawn = (launch: HistorianLaunch) => HistorianAcpChild;

/** ⭐ L17b6 (D94; the lead's §39, Q3) — a permission request devin made, and the workbench's answer by its option's kind, or `cancelled`. */
export interface HistorianPermissionRecord {
	readonly toolCallId: string;
	readonly name: string;
	readonly kind: string;
	readonly answer: string;
}

/** ⭐ L17b6 (D94; §39, Q3, Q4, Q5, Q12) — WHAT THE CALL SAW OF ITS SESSION: only the fields it reads (§39, item 10). */
export interface HistorianSession {
	/** Each tool call, read from its notices (`historianToolCallsOf`'s reading), in the order announced. */
	readonly calls: readonly HistorianToolCall[];
	/** The tool-call notices, cut to the fields the audit reads: what `historianToolCallsOf` is handed. */
	readonly notices: readonly unknown[];
	readonly requests: readonly HistorianPermissionRecord[];
	/** The message text before the last tool call, segment by segment, the empty ones left out. */
	readonly workingRemarks: readonly string[];
	/** Every message chunk, joined: the reply, as print mode printed it. */
	readonly reply: string;
	readonly model?: { readonly value: string; readonly name: string };
	readonly thoughtLevel?: { readonly value: string; readonly name: string };
	/** The label devin ran the turn under (`_cognition.ai/agent_stopped`'s `modelLabel`). */
	readonly modelLabel?: string;
	readonly stopReason?: string;
	/** Whether `session/cancel` was sent, and, where it was, whether the turn ended after it (unmeasured: §39, Q4). */
	readonly cancelled: boolean;
	readonly turnEndedAfterCancel?: boolean;
	readonly deleted: boolean;
	/**
	 * How the child ended: by its stdin's close, its terminate or its kill, each waited out a named while; by its own exit; `unstopped`, all three stops
	 * waited out; ⭐ L17b6 round 3 (the lead's §43.6) — or `not-started`, where no child was started: its prompt not read, or its spawn thrown.
	 * ~~`'stdin' | 'terminate' | 'kill' | 'exit' | 'unstopped'`~~ alone: `unstopped` was false there.
	 */
	readonly stoppedBy: 'stdin' | 'terminate' | 'kill' | 'exit' | 'unstopped' | 'not-started';
	/** Each request devin made that the client does not know, by its method's name in a fixed shape; and each line that was not JSON, counted. */
	readonly unknownRequests: readonly string[];
	/**
	 * ⭐ L17b6 round 4 (the lead's §45.3) — ~~each line that was not JSON~~: each line that was not a JSON object, counted; a line that is empty, or holds
	 * whitespace alone, is no message and not counted. More than none is the audit's one finding (`historianToolCallsOf`).
	 */
	readonly unreadLines: number;
}

/**
 * What a call came to: not run, and why; run and failed, and how; or run, ~~its answer and its export~~ ⭐ (L17b6, D94) its last message — and, run,
 * what it saw of its session. Each with any folder that could not be removed. ⭐ L17b6 — ~~`{ ran: true; failure: string; sessionExport?: string }`~~,
 * ~~`{ ran: true; failure?: undefined; stdout: string; sessionExport?: string }`~~.
 */
export type HistorianCallOutcome = (
	| { readonly ran: false; readonly why: string }
	| { readonly ran: true; readonly failure: string; readonly session: HistorianSession }
	| { readonly ran: true; readonly failure?: undefined; readonly lastMessage: string; readonly session: HistorianSession }
) & { readonly folderNotRemoved?: string };

/**
 * ⭐ Ruling 2 (A) — WHY DEVIN'S REPORTED VERSION LEAVES THE HISTORIAN NOT RUN, or undefined at the version its tools were measured at: the one reading of
 * `devin --version`'s words — the first `<n>.<n>.<n>` they hold — which the call makes before it runs (`callIn`) and the live lane's paid boot makes before
 * any paid call (`e2e-live-exec/phase7-operator.ts`, `bootOf`; L17b2 ruling 6 (C)), so the two can never word the rule, or read it, apart.
 */
export function historianVersionRefusal(reported: string): string | undefined {
	// ⭐ L17b4 (the lead's §15.5 (b)) — ~~`const version = /\b(\d+\.\d+\.\d+)\b/.exec(reported)?.[1];`~~ and the rule worded here: the version read by the one
	// reading (`devinVersionIn`), and the rule worded by the one definition (`historianVersionRefusalOf`), which the paid boot words it by from its record.
	return historianVersionRefusalOf({ version: devinVersionIn(reported), length: reported.length });
}

/** ⭐ L17b4 round 4 (the lead's §18) — the one shape of devin's version in its reply: the first `<n>.<n>.<n>`, read by `devinVersionIn` and `devinVersionParts`. */
const DEVIN_VERSION_SHAPE = /\b(\d+\.\d+\.\d+)\b/;

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b4 — design D93 (the lead's §15.5 (b), `l17b4-facts.md`) — THE ONE READING OF `devin --version`'s WORDS: the first
 * `<n>.<n>.<n>` they hold, or undefined where they hold none. The Historian's call and the paid boot's readiness both read the version by it; the boot
 * keeps only what it reads (`e2e-live-exec/phase7-operator.ts`, `reviewerReadiness`).
 */
export function devinVersionIn(reported: string): string | undefined {
	// ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — ~~`return /\b(\d+\.\d+\.\d+)\b/.exec(reported)?.[1];`~~: by the one shape, which the reply's parts are
	// read by too (`devinVersionParts`).
	return DEVIN_VERSION_SHAPE.exec(reported)?.[1];
}

/**
 * ⭐ L17b4 round 4 (the lead's §18) — the build devin prints in the parentheses right after its version, held to a shape: hex digits ~~, at most 64~~.
 * ⭐ L17b4 round 5 (the lead's §20; `L4E-01`) — ~~`{1,64}`~~: a build of more than 64 hex digits read as not found, so two such builds of the same length
 * showed one line and passed the seam. Read whole now, with no upper bound, and so compared exactly; parentheses that hold anything else, or nothing,
 * still give not found.
 */
const DEVIN_BUILD_AFTER_VERSION = /^[ \t]*\(([0-9a-f]+)\)/i;

/** ⭐ L17b4 round 4 (the lead's §18) — a part of devin's version reply that is not in it, named so. */
export const DEVIN_VERSION_PART_NOT_FOUND = 'not found';

/** ⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — devin's version reply by its parts, and never its words. */
export interface DevinVersionParts {
	/** Its version: the first `<n>.<n>.<n>` it holds, by the one reading, or `not found`. */
	readonly version: string;
	/** The build in the parentheses right after the version, hex digits alone, or `not found`. */
	readonly build: string;
	/** The reply's length, in characters. */
	readonly replyLength: number;
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b4 — round 4 (the lead's §18 on `l17b4-facts.md`; `L4D-01`; `REG-F-685`) — devin's VERSION REPLY BY ITS PARTS, the one
 * reading D84's driver shows, checks and keeps it by: its version (`DEVIN_VERSION_SHAPE`, as `devinVersionIn` reads it), the build in the parentheses
 * right after it held to hex digits, and the reply's length; a part not found is named so. ⛔ NEVER ITS WORDS: the reply is devin's, unmeasured, and may
 * hold its login banner and paths under the home folder. The reply itself is handed to the Historian's own version check alone, and kept nowhere.
 */
export function devinVersionParts(reported: string): DevinVersionParts {
	const found = DEVIN_VERSION_SHAPE.exec(reported);
	const build = found === null ? undefined : DEVIN_BUILD_AFTER_VERSION.exec(reported.slice(found.index + found[0].length))?.[1];
	return { version: found?.[1] ?? DEVIN_VERSION_PART_NOT_FOUND, build: build ?? DEVIN_VERSION_PART_NOT_FOUND, replyLength: reported.length };
}

/**
 * ⭐⭐ L17b4 round 4 (the lead's §18; `L4D-01`) — devin's VERSION REPLY AS D84 SHOWS IT, AND AS THE CHECK AT THE CALL COMPARES IT: its parts alone, in one
 * line — the `devin-version.txt` of a role's showing and of a probe's (`measurement/d84-roles.ts`, `measurement/d84-probes.ts`). Two replies of the same
 * parts show the same line, and another build than the one shown, or another length, shows another.
 */
export function devinVersionShown(parts: DevinVersionParts): Buffer {
	return Buffer.from(
		`devin --version, by its parts alone (REG-F-685): version ${parts.version}; build ${parts.build}; ${parts.replyLength} characters\n`,
		'utf8'
	);
}

/**
 * ⭐⭐ L17b4 — design D93 (`REG-F-685`; the lead's §15.5 (b); the review's question, confirmed) — THE VERSION RULE, WORDED ONCE, from what was read of the
 * reply: its version (the one reading, `devinVersionIn`) and its length. ⛔ A reply that holds no version is named by its length, never its words:
 * ~~`devin is at version ${version ?? JSON.stringify(reported.trim())}, …`~~ quoted devin's reply whole, which is unmeasured and may open with its login
 * banner. undefined at the version the tools were measured at.
 */
export function historianVersionRefusalOf(read: { readonly version: string | undefined; readonly length: number }): string | undefined {
	if (read.version === DEVIN_HISTORIAN_MEASURED_VERSION) return undefined;
	const found =
		read.version === undefined
			? `devin's reply to \`devin --version\` holds no version (${read.length} characters; devin's own words are not recorded, REG-F-685)`
			: `devin is at version ${read.version}`;
	return (
		`${found}, and the Historian's two tool lists were measured at ` +
		`${DEVIN_HISTORIAN_MEASURED_VERSION}: they are true of that version alone, so it is not run (L17b2 ruling 2 (A))`
	);
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b4 — design D93 (`REG-F-685`; the lead's §13.3 (a), `l17b4-facts.md`) — THE TIME BOUND OF devin's VERSION READ,
 * ONCE: the Historian's read (`devinVersion`), D84's driver's read of the same (`measurement/d84.drive.ts`), and the read's failure, which is recorded
 * at it (`callIn`), so the record states the bound the kill was made at. ⭐ It was the literal at each read, `30_000`.
 */
export const DEVIN_VERSION_BOUND_MS = 30_000;

/**
 * ⭐⭐ L17b6 round 3 — the lead's §43.5 (finding 3; paired writers share one definition) — WHY THE HISTORIAN IS NOT RUN WHEN devin's VERSION CANNOT BE
 * READ, WORDED ONCE: the read's failure by its kind alone, at its own bound (`devinFailureKindAndNames`, `DEVIN_VERSION_BOUND_MS`; `REG-F-685`; the lead's
 * §13.3 (a)), and the version the tool lists were measured at. The Historian's call (`callIn`) and D84's print-mode probes (`measurement/d84-probes.ts`,
 * `probeCallIn`) both record it so, its words byte for byte those each held before: the probes held a copy of the call's sentence.
 */
export function historianVersionReadFailure(e: unknown): string {
	return (
		`devin's version could not be read (devin --version: ${devinFailureKindAndNames(e, DEVIN_VERSION_BOUND_MS)}; devin's own words are not recorded, REG-F-685), and the Historian's two tool lists are true of the version they ` +
		`were measured at, ${DEVIN_HISTORIAN_MEASURED_VERSION}: so it is not run (L17b2 ruling 2 (A))`
	);
}

/** `devin --version`, run with no session and no model. */
async function devinVersion(): Promise<string> {
	// ⭐ L17b4 (§13.3 (a)) — ~~`const { stdout } = await run(DEVIN_BIN, ['--version'], { timeout: 30_000, windowsHide: true });`~~: the same 30 s, named once.
	const { stdout } = await run(DEVIN_BIN, ['--version'], { timeout: DEVIN_VERSION_BOUND_MS, windowsHide: true });
	return String(stdout);
}

/** ⭐ L17b6 (D94) — the launch, from the folder, the model, the bound and the prompt: the one definition of what the call sends, and of what D84 shows. */
function historianLaunchOf(folder: HistorianFolder, model: string, boundMs: number, prompt: string): HistorianLaunch {
	return {
		file: DEVIN_BIN,
		args: ['acp', '--model', model],
		cwd: folder.folder,
		windowsHide: true,
		boundMs,
		messages: [
			{ method: 'initialize', params: { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } } },
			{ method: 'session/new', params: { cwd: folder.folder, mcpServers: [] } },
			{ method: 'session/set_mode', params: { sessionId: HISTORIAN_SESSION_HELD, modeId: 'ask' } },
			{ method: 'session/prompt', params: { sessionId: HISTORIAN_SESSION_HELD, prompt: [{ type: 'text', text: prompt }] } },
			{ method: 'session/delete', params: { sessionId: HISTORIAN_SESSION_HELD } }
		],
		permissionRule: HISTORIAN_PERMISSION_RULE
	};
}

/** A launch message's params, devin's session id put in where the launch holds it. */
const withSession = (params: unknown, sessionId: string): unknown =>
	JSON.parse(JSON.stringify(params).split(JSON.stringify(HISTORIAN_SESSION_HELD)).join(JSON.stringify(sessionId))) as unknown;

/** How a message's code may look to be carried onto a record: a name, bounded, never free text. */
const ACP_CODE_SHAPE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** How a method's or a stop reason's name may look to be carried onto a record. */
const ACP_NAME_SHAPE = /^[A-Za-z_][A-Za-z0-9_./-]{0,63}$/;
/** How a model's label may look to be carried onto a record. */
const ACP_LABEL_SHAPE = /^[\w .-]{1,64}$/;
/** A name as the record carries it: itself, where it has the shape, else that it has another. */
const nameOf = (v: unknown, shape: RegExp): string => (typeof v === 'string' && shape.test(v) ? v : 'a name of another shape');

/** ⭐ L17b6 (D94; the lead's §39, Q10) — the record's fixed close: why devin's own words are not in it. */
const ACP_FAILURE_CLOSE =
	'Its words are not recorded (PER-12): devin’s messages name its configuration’s path under the home folder, and its errors may hold its login ' +
	'banner (REG-F-685); its standard error is never read (REG-Q-066).';

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (the lead's §39, Q10) — WHAT A FAILED ACP CALL RECORDS: its kind alone, beside the reviewer's
 * `devinFailureRecord` (whose words name execFile): could not start, by its code; ended before an answer, by its exit; an error answered to a method, by
 * its code, and each of the two fixed phrases its message holds by its name, never quoted; a stop reason other than `end_turn`, by its name; the bound.
 */
function historianAcpFailureRecord(kind: string): string {
	return `devin acp failed (${kind}). ${ACP_FAILURE_CLOSE}`;
}

/** The two fixed phrases an error's message holds, each by its name, never quoted. */
function phrasesIn(message: unknown): string {
	const said = typeof message === 'string' ? message : '';
	return [
		...(said.includes(DEVIN_FREE_TIER_REFUSAL) ? ['; devin refused it for its free tier (D46)'] : []),
		...(said.includes(DEVIN_OUTPUT_LIMIT) ? [`; ${OUTPUT_LIMIT_NAME}`] : [])
	].join('');
}

/** A child's end, as the record words it: its exit's code, its signal, or its start's error. */
function endOf(exit: Awaited<HistorianAcpChild['exited']> | undefined): string {
	if (exit === undefined) return 'its output ended';
	if ('startError' in exit) return `could not start: ${exit.startError}`;
	if (typeof exit.code === 'number' && Number.isSafeInteger(exit.code)) return `exited with code ${exit.code}`;
	return `killed by ${nameOf(exit.signal, /^SIG[A-Z0-9]{1,16}$/)}`;
}

/** What an answer to the call's own request came to: its result, its error, the child's end, or nothing yet. */
type AcpAnswer =
	| { readonly result: unknown }
	| { readonly error: { readonly code?: unknown; readonly message?: unknown } }
	| { readonly ended: true };
const TIMED_OUT = Symbol('timed out');

/** `p`, or `TIMED_OUT` after `ms`. */
function within<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(TIMED_OUT), Math.max(0, ms));
		void p.then((v) => {
			clearTimeout(timer);
			resolve(v);
		});
	});
}

/** What the session keeps as it goes: only the fields the call reads (§39, item 10). */
interface SessionState {
	sessionId?: string;
	cancelled: boolean;
	turnEndedAfterCancel?: boolean;
	deleted: boolean;
	stopReason?: string;
	segments: string[];
	reply: string;
	notices: Record<string, unknown>[];
	// ⭐ L17b6 round 3 (the lead's §43.4) — ~~`merged: Map<string, Record<string, unknown>>;`~~: a call is read from the notices when it is asked about, as
	// the audit reads them (`noticedCall`), never from a merge of its own.
	requests: HistorianPermissionRecord[];
	model?: { readonly value: string; readonly name: string };
	thoughtLevel?: { readonly value: string; readonly name: string };
	modelLabel?: string;
	unknownRequests: string[];
	unreadLines: number;
	exit?: Awaited<HistorianAcpChild['exited']>;
}

/** A line read as a JSON-RPC message, or undefined where it is not one. */
function messageOf(line: string): Record<string, unknown> | undefined {
	try {
		const v = JSON.parse(line) as unknown;
		return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
	} catch {
		return undefined;
	}
}

/** A config option's current value and its name, as `session/new` and `config_option_update` give them. */
function optionNamed(options: unknown, id: string): { readonly value: string; readonly name: string } | undefined {
	if (!Array.isArray(options)) return undefined;
	const o = options.find((x) => typeof x === 'object' && x !== null && (x as { id?: unknown }).id === id) as { currentValue?: unknown; options?: unknown } | undefined;
	const value = o?.currentValue;
	if (typeof value !== 'string' || !ACP_NAME_SHAPE.test(value)) return undefined;
	const named = (Array.isArray(o?.options) ? o.options : []).find((x) => typeof x === 'object' && x !== null && (x as { value?: unknown }).value === value) as
		| { name?: unknown }
		| undefined;
	return { value, name: typeof named?.name === 'string' && ACP_LABEL_SHAPE.test(named.name) ? named.name : value };
}

/** The session's model and thought level, read from its config options. */
function readConfig(state: SessionState, holder: unknown): void {
	const options = (holder as { configOptions?: unknown } | null)?.configOptions;
	state.model = optionNamed(options, 'model') ?? state.model;
	state.thoughtLevel = optionNamed(options, 'thought_level') ?? state.thoughtLevel;
}

/** ⭐ L17b6 (D94; §39, item 10) — a tool-call notice cut to the fields the audit reads. */
function noticeFields(u: Record<string, unknown>): Record<string, unknown> {
	const name = (u._meta as Record<string, unknown> | undefined)?.['cognition.ai/inferenceToolName'];
	const out: Record<string, unknown> = { sessionUpdate: u.sessionUpdate, toolCallId: u.toolCallId };
	// A call's first notice keeps a null it gives, which the audit refuses; an update's null changes nothing.
	for (const k of ['kind', 'rawInput', 'locations', 'status'] as const) if (u[k] !== undefined && (u.sessionUpdate === 'tool_call' || u[k] !== null)) out[k] = u[k];
	if (name !== undefined) out.name = name;
	return out;
}

/** One session update read: a call's notice, a message's chunk, or the session's config; every other passed over. */
function readUpdate(state: SessionState, update: unknown): void {
	if (typeof update !== 'object' || update === null) return;
	const u = update as Record<string, unknown>;
	if (u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update') {
		const cut = noticeFields(u);
		state.notices.push(cut);
		// ⭐ L17b6 round 3 (the lead's §43.4) — ~~`mergeNotice(state.merged, cut);`~~: the notices are kept, and each call read from them as the audit reads them.
		// ⭐ REG-D-204 — only a call's notice begins a new segment: an update of a call does not.
		if (u.sessionUpdate === 'tool_call') state.segments.push('');
		return;
	}
	if (u.sessionUpdate === 'agent_message_chunk') {
		const content = u.content as { type?: unknown; text?: unknown } | undefined;
		if (content?.type !== 'text' || typeof content.text !== 'string') return;
		state.segments[state.segments.length - 1] += content.text;
		state.reply += content.text;
		return;
	}
	if (u.sessionUpdate === 'config_option_update') readConfig(state, u);
}

/**
 * ⭐⭐ L17b6 — design D94 (the lead's §39, Q9) — THE WORKBENCH'S ANSWER TO ONE PERMISSION REQUEST (`HISTORIAN_PERMISSION_RULE`, in words): the call matched
 * by its `toolCallId` to its notices, read as the audit reads it (`callOf`); `allow_once` only for a call the audit allows — its kind `read` or
 * `search`, its tool among the allowed — that names at least one path, every one inside the folder; else `reject_once`; `cancelled` where no
 * `reject_once` is offered. ⛔ Never an option that allows always, never `switch_bypass`. ⭐ L17b6 round 3 (the lead's §43.4) — its call read from the
 * notices so far by the audit's own reading (`noticedCall`): a call a later notice gave another name, kind, input or places is not read, and so refused.
 */
function historianPermissionAnswer(
	request: unknown,
	// ⭐ L17b6 round 3 (§43.4) — ~~`merged: ReadonlyMap<string, Record<string, unknown>>,`~~: the notices so far.
	notices: readonly unknown[],
	folder: string
): { readonly outcome: { readonly outcome: 'selected'; readonly optionId: string } | { readonly outcome: 'cancelled' }; readonly record: HistorianPermissionRecord } {
	const r = (typeof request === 'object' && request !== null ? request : {}) as { toolCall?: { toolCallId?: unknown }; options?: unknown };
	const toolCallId = typeof r.toolCall?.toolCallId === 'string' ? r.toolCall.toolCallId : '';
	// ⭐ L17b6 round 3 (§43.4) — ~~`const notice = merged.get(toolCallId);`~~ ~~`const call = notice === undefined ? undefined : callOf(notice, folder);`~~
	// ~~`const read = typeof call === 'string' ? undefined : call;`~~: the call as the audit reads it, or none.
	const read = noticedCall(notices, toolCallId, folder);
	const allowed = read !== undefined && read.allowed && read.paths.length > 0 && read.inside;
	const options = (Array.isArray(r.options) ? r.options : [])
		.filter((o): o is { optionId: string; kind: string } => typeof o === 'object' && o !== null && typeof (o as { optionId?: unknown }).optionId === 'string' && typeof (o as { kind?: unknown }).kind === 'string')
		.filter((o) => o.optionId !== 'switch_bypass');
	const chosen = options.find((o) => o.kind === (allowed ? 'allow_once' : 'reject_once')) ?? options.find((o) => o.kind === 'reject_once');
	const record = { toolCallId, name: read?.name ?? '', kind: read?.kind ?? '' };
	return chosen === undefined
		? { outcome: { outcome: 'cancelled' }, record: { ...record, answer: 'cancelled' } }
		: { outcome: { outcome: 'selected', optionId: chosen.optionId }, record: { ...record, answer: chosen.kind } };
}

/** ⭐ L17b6 (D94) — the JSON-RPC connection over the child: the call's requests and notices, and devin's, each answered. */
function acpConnection(child: HistorianAcpChild, state: SessionState, folder: string) {
	let nextId = 0;
	const pending = new Map<number, (a: AcpAnswer) => void>();
	const send = (msg: Record<string, unknown>): void => child.write(JSON.stringify({ jsonrpc: '2.0', ...msg }));
	const answerRequest = (id: unknown, method: string, params: unknown): void => {
		if (method !== 'session/request_permission') {
			state.unknownRequests.push(nameOf(method, ACP_NAME_SHAPE));
			return send({ id, error: { code: -32601, message: 'method not found' } });
		}
		// ⭐ L17b6 round 3 (§43.4) — ~~`historianPermissionAnswer(params, state.merged, folder)`~~: over the notices so far.
		const answered = historianPermissionAnswer(params, state.notices, folder);
		// ⭐ §39, Q4 — after the cancel, every request is answered cancelled.
		const outcome = state.cancelled ? { outcome: 'cancelled' as const } : answered.outcome;
		state.requests.push({ ...answered.record, answer: state.cancelled ? 'cancelled' : answered.record.answer });
		send({ id, result: { outcome } });
	};
	child.onLine((line) => {
		// ⭐ L17b6 round 4 (the lead's §45.3) — a line that is empty, or holds whitespace alone, is no message: passed over, and not counted.
		if (line.trim() === '') return;
		const msg = messageOf(line);
		// Every other line that is not a JSON object is counted, and the audit makes it a finding (`historianToolCallsOf`).
		if (msg === undefined) {
			state.unreadLines += 1;
			return;
		}
		if (typeof msg.method !== 'string') {
			const settle = typeof msg.id === 'number' ? pending.get(msg.id) : undefined;
			if (settle === undefined) return;
			pending.delete(msg.id as number);
			return settle('error' in msg ? { error: (msg.error ?? {}) as { code?: unknown; message?: unknown } } : { result: msg.result });
		}
		if (msg.id !== undefined) return answerRequest(msg.id, msg.method, msg.params);
		if (msg.method === 'session/update') return readUpdate(state, (msg.params as { update?: unknown } | undefined)?.update);
		if (msg.method === '_cognition.ai/agent_stopped') {
			const label = ((msg.params as { stats?: { modelLabel?: unknown } } | undefined)?.stats)?.modelLabel;
			if (typeof label === 'string' && ACP_LABEL_SHAPE.test(label)) state.modelLabel = label;
		}
	});
	void child.exited.then((exit) => {
		state.exit = exit;
		for (const settle of pending.values()) settle({ ended: true });
		pending.clear();
	});
	return {
		request: (method: string, params: unknown): Promise<AcpAnswer> => {
			if (state.exit !== undefined) return Promise.resolve({ ended: true });
			nextId += 1;
			const id = nextId;
			const answer = new Promise<AcpAnswer>((resolve) => pending.set(id, resolve));
			send({ id, method, params });
			return answer;
		},
		notify: (method: string, params: unknown): void => send({ method, params })
	};
}

/** Why a request's answer is no result, as the record words it; undefined for a result. */
function notAResult(method: string, a: AcpAnswer | typeof TIMED_OUT, state: SessionState, boundMs: number): string | undefined {
	if (a === TIMED_OUT) return historianAcpFailureRecord(`at its time bound of ${boundMs} ms`);
	if ('result' in a) return undefined;
	if ('ended' in a) return historianAcpFailureRecord(`ended before it answered ${method}: ${endOf(state.exit)}`);
	const code = a.error.code;
	const coded = typeof code === 'number' && Number.isSafeInteger(code) ? String(code) : 'of another shape';
	return historianAcpFailureRecord(`answered ${method} with error code ${coded}${phrasesIn(a.error.message)}`);
}

/** The session's turn, from the handshake to the prompt's end, the cancel at the bound; the failure's record, or undefined where the turn ended well. */
async function historianTurn(
	conn: ReturnType<typeof acpConnection>,
	launch: HistorianLaunch,
	state: SessionState,
	deadline: number,
	waits: HistorianWaits
): Promise<string | undefined> {
	const left = (): number => deadline - performance.now();
	const asked = (i: number): Promise<AcpAnswer> => conn.request(launch.messages[i]!.method, withSession(launch.messages[i]!.params, state.sessionId ?? HISTORIAN_SESSION_HELD));
	for (const i of [0, 1, 2]) {
		const answer = await within(asked(i), left());
		const failed = notAResult(launch.messages[i]!.method, answer, state, launch.boundMs);
		if (failed !== undefined) return failed;
		if (i === 1) {
			const result = (answer as { result?: unknown }).result as { sessionId?: unknown } | undefined;
			if (typeof result?.sessionId !== 'string' || result.sessionId === '') return historianAcpFailureRecord('session/new named no session');
			state.sessionId = result.sessionId;
			readConfig(state, result);
		}
	}
	const turn = asked(3);
	let ended = await within(turn, left());
	if (ended === TIMED_OUT) {
		// ⭐ §39, Q4 — at the bound: `session/cancel`, a notification (its form unmeasured), then the prompt's answer waited for, a named while.
		state.cancelled = true;
		conn.notify('session/cancel', { sessionId: state.sessionId });
		ended = await within(turn, waits.cancelGraceMs);
		state.turnEndedAfterCancel = ended !== TIMED_OUT && 'result' in ended;
		if (ended !== TIMED_OUT && 'result' in ended) state.stopReason = nameOf((ended.result as { stopReason?: unknown } | null)?.stopReason, ACP_NAME_SHAPE);
		return historianAcpFailureRecord(`at its time bound of ${launch.boundMs} ms`);
	}
	const failed = notAResult('session/prompt', ended, state, launch.boundMs);
	if (failed !== undefined) return failed;
	state.stopReason = nameOf(((ended as { result?: unknown }).result as { stopReason?: unknown } | null)?.stopReason, ACP_NAME_SHAPE);
	return state.stopReason === 'end_turn' ? undefined : historianAcpFailureRecord(`its turn ended with stop reason ${state.stopReason}`);
}

/** ⭐ L17b6 (D94; §39, Q4) — the child stopped by its own PID alone: its stdin closed, then terminated, then killed, each waited out a named while. */
async function stopChild(child: HistorianAcpChild, state: SessionState, waitMs: number): Promise<HistorianSession['stoppedBy']> {
	if (state.exit !== undefined) return 'exit';
	for (const [stop, said] of [
		[child.closeStdin, 'stdin'],
		[child.terminate, 'terminate'],
		[child.kill, 'kill']
	] as const) {
		stop();
		if ((await within(child.exited, waitMs)) !== TIMED_OUT) return said;
	}
	return 'unstopped';
}

/** The session as the call reports it: the fields it read, its calls read from its notices. */
function sessionOf(state: SessionState, folder: string, stoppedBy: HistorianSession['stoppedBy']): HistorianSession {
	// ⭐ L17b6 round 3 (the lead's §43.4) — ~~`const calls = [...state.merged.values()].map((n) => callOf(n, folder)).filter((c): c is HistorianToolCall =>
	// typeof c !== 'string');`~~, each call read alone: the audit's own reading of the notices (`historianToolCallsOf`), as `HistorianSession.calls` says.
	// ⭐ L17b6 round 4 (the lead's §45.3) — ~~`historianToolCallsOf(state.notices, folder)`~~: and the count of its lines that were not JSON objects.
	const calls = historianToolCallsOf(state.notices, folder, state.unreadLines).calls;
	return {
		calls,
		notices: state.notices,
		requests: state.requests,
		workingRemarks: state.segments.slice(0, -1).filter((s) => s !== ''),
		reply: state.reply,
		...(state.model === undefined ? {} : { model: state.model }),
		...(state.thoughtLevel === undefined ? {} : { thoughtLevel: state.thoughtLevel }),
		...(state.modelLabel === undefined ? {} : { modelLabel: state.modelLabel }),
		...(state.stopReason === undefined ? {} : { stopReason: state.stopReason }),
		cancelled: state.cancelled,
		...(state.turnEndedAfterCancel === undefined ? {} : { turnEndedAfterCancel: state.turnEndedAfterCancel }),
		deleted: state.deleted,
		stoppedBy,
		unknownRequests: state.unknownRequests,
		unreadLines: state.unreadLines
	};
}

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 — THE HISTORIAN'S SESSION OVER devin's ACP SERVER: its launch started by the seam, the bound counted
 * from the spawn; the turn (`historianTurn`); then `session/delete`, however the turn ended, waited for a named while; then the child stopped
 * (`stopChild`). Never throws.
 */
async function historianSession(
	call: { readonly folder: HistorianFolder; readonly model: string; readonly boundMs: number },
	spawnOf: HistorianSpawn,
	waits: HistorianWaits
): Promise<HistorianCallOutcome> {
	// ⭐ L17b6 round 3 (§43.4) — ~~`merged: new Map(),`~~: no merge of the session's own.
	const state: SessionState = { cancelled: false, deleted: false, segments: [''], reply: '', notices: [], requests: [], unknownRequests: [], unreadLines: 0 };
	const folder = call.folder.folder;
	const prompt = await readFile(call.folder.promptPath, 'utf8').catch(() => undefined);
	// ⭐ L17b6 round 3 (the lead's §43.6) — ~~`session: sessionOf(state, folder, 'unstopped')`~~, here and at the spawn's throw below: no child was started.
	if (prompt === undefined) return { ran: true, failure: historianAcpFailureRecord('its prompt could not be read'), session: sessionOf(state, folder, 'not-started') };
	const launch = historianLaunchOf(call.folder, call.model, call.boundMs, prompt);
	const started = performance.now();
	let child: HistorianAcpChild;
	try {
		child = spawnOf(launch);
	} catch (e) {
		return {
			ran: true,
			failure: historianAcpFailureRecord(`its program could not be started: ${devinFailureKindAndNames(e, call.boundMs)}`),
			session: sessionOf(state, folder, 'not-started')
		};
	}
	const conn = acpConnection(child, state, folder);
	const failure = await historianTurn(conn, launch, state, started + call.boundMs, waits);
	if (state.sessionId !== undefined) {
		const deleted = await within(conn.request('session/delete', withSession(launch.messages[4]!.params, state.sessionId)), waits.deleteWaitMs);
		state.deleted = deleted !== TIMED_OUT && 'result' in deleted;
	}
	const stoppedBy = await stopChild(child, state, waits.stopWaitMs);
	const session = sessionOf(state, folder, stoppedBy);
	return failure === undefined ? { ran: true, lastMessage: state.segments.at(-1) ?? '', session } : { ran: true, failure, session };
}

/**
 * ⭐⭐ L17b6 — design D94 — THE REAL CHILD: `devin acp` spawned in the folder, its stdout read by lines, ⛔ its standard error never read (`'ignore'`,
 * REG-Q-066's gate), and each stop made by its own PID alone — never a process tree. ⚠ On Windows a SIGTERM and a SIGKILL each stop the one process hard,
 * as Node does there (not measured here).
 */
export function historianAcpSpawn(launch: HistorianLaunch): HistorianAcpChild {
	const child = spawn(launch.file, [...launch.args], { cwd: launch.cwd, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: launch.windowsHide });
	const listeners: ((line: string) => void)[] = [];
	createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
		for (const listener of listeners) listener(line);
	});
	const exited = new Promise<{ readonly code: number | null; readonly signal: string | null } | { readonly startError: string }>((resolve) => {
		child.once('error', (e: unknown) => {
			const code = (e as { code?: unknown } | null)?.code;
			resolve({ startError: typeof code === 'string' && ACP_CODE_SHAPE.test(code) ? code : 'an error with no code' });
		});
		child.once('close', (code, signal) => resolve({ code, signal }));
	});
	child.stdin.on('error', () => undefined);
	return {
		pid: child.pid,
		write: (line) => {
			if (child.stdin.writable) child.stdin.write(`${line}\n`);
		},
		onLine: (listener) => {
			listeners.push(listener);
		},
		exited,
		closeStdin: () => {
			child.stdin.end();
		},
		terminate: () => {
			child.kill('SIGTERM');
		},
		kill: () => {
			child.kill('SIGKILL');
		}
	};
}

/** The call itself, never throwing: the version first, then devin ~~in the folder~~ ⭐ (L17b6, D94) its ACP session in the folder. */
async function callIn(
	call: { readonly folder: HistorianFolder; readonly model: string; readonly boundMs: number },
	spawnOf: HistorianSpawn,
	versionOf: HistorianVersionOf,
	waits: HistorianWaits
): Promise<HistorianCallOutcome> {
	const { folder } = call;
	let reported: string;
	try {
		reported = await versionOf();
	} catch (e) {
		// ⭐ L17b4 — design D93 (`REG-F-685`; the lead's §13.3 (a)) — ~~`devin's version could not be read (devin --version: ${describedThrow(e)}), and the
		// Historian's two tool lists are true of the version they ` +`~~: execFile's message names the program's own path, under the home folder where its
		// override sets it or a start fails, and holds devin's stderr. So the read is recorded by its kind alone, by the one definition, at its own bound.
		// ⭐ L17b6 round 3 (the lead's §43.5) — ~~`why: \`devin's version could not be read (devin --version: ${devinFailureKindAndNames(e,
		// DEVIN_VERSION_BOUND_MS)}; devin's own words are not recorded, REG-F-685), and the Historian's two tool lists are true of the version they \` +
		// \`were measured at, ${DEVIN_HISTORIAN_MEASURED_VERSION}: so it is not run (L17b2 ruling 2 (A))\``~~: the same words, worded once
		// (`historianVersionReadFailure`), which D84's probes word it by too.
		return { ran: false, why: historianVersionReadFailure(e) };
	}
	// ⭐ L17b2 (2c) — the one reading of the version, which the live lane's paid boot shares (`historianVersionRefusal`): its words as they were here.
	const versionRefused = historianVersionRefusal(reported);
	if (versionRefused !== undefined) return { ran: false, why: versionRefused };
	// ⭐ L17b4 — design D93 (the lead's L4-Q3) — ~~`const prompt = await readFile(folder.promptPath, 'utf8').catch(() => '');`~~: read only for the check
	// that measured the prompt out of the failure's words, which has left this path, since the record holds none of them.
	// ⭐⭐ STRUCK BY L17b6 — design D94 (`REG-F-689`; the lead's §39) — ~~`const { stdout } = await exec(DEVIN_BIN, ['--print', '--model', call.model,
	// '--prompt-file', folder.promptPath, '--export', folder.exportPath, '--respect-workspace-trust', 'false'], { cwd: folder.folder, timeout:
	// call.boundMs, maxBuffer: 16 * 1024 * 1024, windowsHide: true });`~~, ~~its export read~~, and, in its catch, ~~`const failure =
	// devinFailureRecord(e, call.boundMs);`~~ with ~~the export read on failure~~: print mode ended the Historian's run at a refused call, and its
	// reply was read whole. Now its ACP session (`historianSession`): the workbench answers each permission request, and a refusal returns to the model.
	return historianSession({ ...call, folder }, spawnOf, waits);
}

/**
 * ⭐⭐ D86, rulings 2 (A), 6, 8 — ONE CALL OF THE HISTORIAN: devin's version read and held to the one measured; then ~~`devin --print` in the folder, its
 * prompt ~~, export and configuration~~ ⭐ and export (L17b4, D93: no `--config`) named, at the time bound handed in; its export read, on success and on
 * failure; ⭐ a failure recorded by its kind alone (`devinFailureRecord`)~~ ⭐ (L17b6, D94) its ACP session in the folder (`historianSession`), at the
 * time bound handed in, a failure recorded by its kind alone (`historianAcpFailureRecord`); and the folder and its host removed after, whatever came of
 * it. `given` is the stage's seam (~~`historianExec`~~ ⭐ `historianSpawn`, `historianVersionOf`; ⭐ and the waits after the bound, §41): absent, the real
 * program and the named waits.
 */
export async function devinHistorianCall(
	call: { readonly folder: HistorianFolder; readonly model: string; readonly boundMs: number },
	given: { readonly spawn?: HistorianSpawn; readonly versionOf?: HistorianVersionOf; readonly waits?: Partial<HistorianWaits> } = {}
): Promise<HistorianCallOutcome> {
	// ⭐ L17b6 (D94) — ~~`const outcome = await callIn(call, given.exec ?? (run as unknown as HistorianExec), given.versionOf ?? devinVersion);`~~
	const outcome = await callIn(call, given.spawn ?? historianAcpSpawn, given.versionOf ?? devinVersion, { ...HISTORIAN_DEFAULT_WAITS, ...given.waits });
	const notRemoved = await removeFolders(call.folder.folder, call.folder.host);
	return notRemoved === undefined ? outcome : { ...outcome, folderNotRemoved: notRemoved };
}

/** ⭐ Rulings 2 (B), 17 — the findings ~~an export's tool calls give~~ ⭐ (L17b6, D94) a session's tool calls give, read from its notices, each MATERIAL. */
export const HISTORIAN_READ_OUTSIDE_FOLDER = 'HISTORIAN_READ_OUTSIDE_FOLDER';
export const HISTORIAN_TOOL_NOT_ALLOWED = 'HISTORIAN_TOOL_NOT_ALLOWED';
export const HISTORIAN_TOOL_CALLS_UNREADABLE = 'HISTORIAN_TOOL_CALLS_UNREADABLE';

/**
 * One tool call, as the stage record holds it: its name, its paths as the call gave them, whether each is inside the folder, and whether it is allowed.
 * ⭐ L17b6 (D94; the lead's §39, Q3, §41) — and its `toolCallId`, which ties it to its request; its kind; and its last status, where an update gave one.
 * `allowed` is its kind `read` or `search` and its tool among the allowed, both (§39, Q9).
 */
export interface HistorianToolCall {
	readonly toolCallId: string;
	readonly name: string;
	readonly kind: string;
	readonly paths: readonly string[];
	readonly inside: boolean;
	readonly allowed: boolean;
	readonly status?: string;
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

/**
 * One call read, or why it is not in the read shape. ⭐ L17b6 (D94) — ~~from an export's `steps[].tool_calls[]` entry (`function_name`, `arguments`)~~:
 * from its notices, merged (`mergeNotice`) — its `toolCallId`; its tool's name, devin's own (`_meta`'s `cognition.ai/inferenceToolName`, cut to `name`
 * by `noticeFields`); its kind; its `rawInput`, read as the arguments were; each of its `locations`; and its last `status`.
 */
function callOf(c: unknown, folder: string): HistorianToolCall | string {
	if (typeof c !== 'object' || c === null || Array.isArray(c)) return 'is not an object';
	const o = c as { toolCallId?: unknown; name?: unknown; kind?: unknown; rawInput?: unknown; locations?: unknown; status?: unknown };
	if (typeof o.toolCallId !== 'string' || o.toolCallId === '') return 'names no toolCallId';
	// ⭐ L17b6 — ~~`if (typeof o.function_name !== 'string' || o.function_name === '') return 'names no function';`~~
	if (typeof o.name !== 'string' || o.name === '') return 'names no tool';
	if (typeof o.kind !== 'string' || o.kind === '') return 'gives no kind';
	// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — ~~`o.arguments ?? {}`~~: arguments that are
	// missing are none, as a tool with no arguments is called; arguments that are null are not an object — the check below refuses them, never a clean bill.
	// ⭐ L17b6 (D94) — ~~`let args: unknown = o.arguments === undefined ? {} : o.arguments;`~~: the notice's `rawInput`, read as the arguments were.
	let args: unknown = o.rawInput === undefined ? {} : o.rawInput;
	if (typeof args === 'string')
		try {
			args = JSON.parse(args);
		} catch {
			return 'has a rawInput that is not JSON';
		}
	if (typeof args !== 'object' || args === null || Array.isArray(args)) return 'has a rawInput that is not an object';
	const placed = placesOf(o.locations);
	if (typeof placed === 'string') return placed;
	const a = args as Record<string, unknown>;
	const named = [
		...PATH_ARGUMENTS.flatMap((k) => (typeof a[k] === 'string' ? [a[k]] : [])),
		...(Array.isArray(a.paths) ? a.paths.filter((p): p is string => typeof p === 'string') : [])
	];
	// ⭐ L17b2 addendum (the lead's §27, item 5) — and, failing closed, every other string among its arguments, under any name and at any depth, that
	// is read as a path (`pathLike`). ⭐ L17b6 (D94) — and each place its `locations` name.
	const paths = [...named, ...stringsIn(a).filter((s) => pathLike(s) && !named.includes(s))];
	for (const p of placed) if (!paths.includes(p)) paths.push(p);
	return {
		toolCallId: o.toolCallId,
		name: o.name,
		kind: o.kind,
		paths,
		inside: paths.every((p) => insideFolder(p, folder)),
		allowed: HISTORIAN_ALLOWED_KINDS.includes(o.kind) && HISTORIAN_ALLOWED_TOOLS.includes(o.name),
		...(typeof o.status === 'string' ? { status: o.status } : {})
	};
}

/** ⭐ L17b6 (D94) — the places a call's `locations` name, or why they are not in the read shape. */
function placesOf(locations: unknown): string[] | string {
	if (locations === undefined) return [];
	if (!Array.isArray(locations)) return 'has locations that are not a list';
	const out: string[] = [];
	for (const l of locations) {
		const p = (l as { path?: unknown } | null)?.path;
		if (typeof p !== 'string') return 'has a location with no path';
		out.push(p);
	}
	return out;
}

/** ⭐ L17b6 round 3 (the lead's §43.4) — what a call is, which its first notice says: no later notice of its id may give another of these. */
const CALL_FIXED_FIELDS = ['name', 'kind', 'rawInput', 'locations'] as const;

/**
 * ⭐ L17b6 (D94; the lead's §39, Q9) — ONE NOTICE MERGED INTO ITS CALL: a `tool_call` begins it, and each `tool_call_update` that gives ~~a kind, an input,
 * places or~~ a status changes it — the call as the audit, and the permission answer, read it (one definition). An update of any other kind is passed
 * over. Why the notice is not in the read shape, or undefined. ⭐ L17b6 round 3 (the lead's §43.4, failing closed) — A CALL IS WHAT ITS FIRST NOTICE
 * SAYS: a later notice of its id, an update or a second `tool_call`, that gives a name, kind, `rawInput` or locations other than the first gave (a value
 * where the first gave none among them) is why the notices are unreadable, naming the call and the field; one may give its status, and the rest of it
 * (its `content`, its `title`, the rest of its `_meta`) is not read.
 */
function mergeNotice(merged: Map<string, Record<string, unknown>>, n: unknown): string | undefined {
	if (typeof n !== 'object' || n === null || Array.isArray(n)) return 'is not an object';
	const o = n as Record<string, unknown>;
	if (o.sessionUpdate !== 'tool_call' && o.sessionUpdate !== 'tool_call_update') return undefined;
	if (typeof o.toolCallId !== 'string' || o.toolCallId === '') return 'names no toolCallId';
	// An update's null changes nothing; a call's first notice keeps its null, which `callOf` refuses (L17B2C-A03's rule, never a clean bill).
	const given = Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== 'sessionUpdate' && v !== undefined && (o.sessionUpdate === 'tool_call' || v !== null)));
	// ⭐ L17b6 round 3 (§43.4) — ~~`merged.set(o.toolCallId, { ...merged.get(o.toolCallId), ...given });`~~ whatever the notice gave: what the call is stays
	// what its first notice said, compared by value (`isDeepStrictEqual`: an input's keys in another order are the same input).
	const first = merged.get(o.toolCallId);
	const changed = first === undefined ? undefined : CALL_FIXED_FIELDS.find((k) => given[k] !== undefined && !isDeepStrictEqual(given[k], first[k]));
	if (changed !== undefined) return `gives the call ${o.toolCallId} another ${changed} than its first notice gave`;
	merged.set(o.toolCallId, { ...first, ...given });
	return undefined;
}

/**
 * ⭐⭐ L17b6 round 3 — the lead's §43.4 (failing closed; paired guards share one definition) — ONE CALL, READ FROM THE NOTICES OF ITS ID AS THE AUDIT READS
 * THEM (`mergeNotice`, then `callOf`): the permission answer's reading, so that the answer and the audit never read a call apart. Undefined where no notice
 * names it, where one of its notices does not read — a later one giving another name, kind, input or places among them — or where it is not in the
 * read shape.
 */
function noticedCall(notices: readonly unknown[], toolCallId: string, folder: string): HistorianToolCall | undefined {
	const merged = new Map<string, Record<string, unknown>>();
	for (const n of notices) if ((n as { toolCallId?: unknown } | null)?.toolCallId === toolCallId && mergeNotice(merged, n) !== undefined) return undefined;
	const notice = merged.get(toolCallId);
	const call = notice === undefined ? undefined : callOf(notice, folder);
	return typeof call === 'string' ? undefined : call;
}

/**
 * ⭐⭐ Rulings 2 (B), 17 — ~~THE EXPORT READ FOR ITS TOOL CALLS~~ ⭐ (L17b6, D94) EACH TOOL CALL READ FROM ITS NOTICES: each call's name, kind and paths,
 * each path resolved against the folder; a call reaching outside it `HISTORIAN_READ_OUTSIDE_FOLDER`, naming the path, and a call not allowed — ~~a tool
 * not allowed~~ ⭐ its kind not `read` or `search`, or its tool not among the allowed — `HISTORIAN_TOOL_NOT_ALLOWED`, naming it, in the calls' order.
 * ⛔ ~~An export that is missing, does not parse, or holds a step whose calls are not in the read shape~~ ⭐ Notices that are missing, or that hold one not
 * in the read shape, give no calls and ONE finding, `HISTORIAN_TOOL_CALLS_UNREADABLE` — never a clean bill. The export is not read. ⭐ L17b6 round 4 (the
 * lead's §45.3) — and so does a session whose output held a line that is not a JSON object (`unreadLines`, the session's count, a blank line not among
 * them), naming the count: such a line may hold a call's notice this reading cannot see. Both readers hand the count in, the session's `calls`
 * (`sessionOf`) and the stage's record (`historian-part.ts`), so the two cannot read the calls apart.
 */
export function historianToolCallsOf(
	notices: readonly unknown[] | undefined,
	folder: string,
	unreadLines = 0
): { readonly calls: readonly HistorianToolCall[]; readonly findings: readonly HistorianToolFinding[] } {
	const unreadable = (why: string) => ({
		calls: [],
		findings: [
			{
				code: HISTORIAN_TOOL_CALLS_UNREADABLE,
				severity: 'MATERIAL' as const,
				statement: `its tool calls could not be read from its notices: ${why}, so what it read is not known — never a clean bill (L17b2 ruling 17; D94)`
			}
		]
	});
	// ⭐ L17b6 (D94) — ~~`if (exportText === undefined) return unreadable('there is no export');`~~ and the export's parse, its steps and their tool_calls,
	// read no more: the notices are the call's own reading of the session.
	if (!Array.isArray(notices)) return unreadable('there are no notices');
	// ⭐ L17b6 round 4 (§45.3) — a line that is not a JSON object, failing closed, the count named.
	if (unreadLines > 0) return unreadable(`devin wrote ${unreadLines} ${unreadLines === 1 ? 'line' : 'lines'} that could not be read as a message`);
	const merged = new Map<string, Record<string, unknown>>();
	for (const [i, n] of notices.entries()) {
		const why = mergeNotice(merged, n);
		if (why !== undefined) return unreadable(`its notice ${i + 1} ${why}`);
	}
	const calls: HistorianToolCall[] = [];
	for (const n of merged.values()) {
		const read = callOf(n, folder);
		if (typeof read === 'string') return unreadable(`a call ${read}`);
		calls.push(read);
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
						statement: `the Historian called ${c.name}, a call of kind ${c.kind}, not among the allowed (kinds ${HISTORIAN_ALLOWED_KINDS.join(', ')}; tools ${HISTORIAN_ALLOWED_TOOLS.join(', ')}) (design D86, D94; L17b2 ruling 2 (B))`
					}
				])
	]);
	return { calls, findings };
}
