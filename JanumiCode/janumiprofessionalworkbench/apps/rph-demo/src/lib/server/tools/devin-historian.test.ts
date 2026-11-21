// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D86 (`REG-D-167` (3); the lead's rulings 2, 6, 8, 9, 16 and 17 on L17b2's Stage 0) — THE
// HISTORIAN IS A DEVIN SESSION WITH READ-ONLY TOOLS, IN A FRESH FOLDER OF COPIES.
//
// ⭑ ITS TOOLS, AT DEVIN 3000.11.234 (ruling 2): allowed `read`, `grep`, `find_file_by_name` — this version's read-only finder, in devin's own
// read-only group — and `glob` as D86 names it; every other name devin lists at that version, and MH-0a's names it does not offer, disabled in
// the user configuration passed as `--config` AND denied by name in the folder's project configuration, beside `Fetch(*)` and `mcp__*`;
// `subagents_enabled: false`; the seven `read_config_from` false. ⭑ The lists are true of ONE version: before the call devin's version is read,
// and any other is not run (ruling 2 (A)). The 25 names below are that version's own listing (`agent.tool_definitions` of an export it wrote:
// all 673 exports on disk outside the run folders list the same 25 — L17b2 facts §2.4).
// ⭑ ITS FOLDER (ruling 8): `prompt.txt`, `.devin/config.json`, `records/` with `records/INDEX.md`, `workspace/` (a copy of the shared
// workspace); beside it a host folder with the `--config` file and the export, outside what it may read; both removed after the call.
// ⭑ ITS EXPORT (rulings 2 (B), 17): each tool call read for its name and its paths; a read outside the folder, and a tool not allowed, are
// findings on the assessment; an export whose calls cannot be read is a finding too, never a clean bill. ⚠ The shape read —
// `steps[].tool_calls[].function_name` and `arguments` — is the multi-harness design's reading of ATIF; no export on disk records a call at
// this version, so D84's measurement confirms it.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import type { HistorianExec } from './devin-historian.js';
import {
	DEVIN_HISTORIAN_MEASURED_VERSION,
	HISTORIAN_ALLOWED_TOOLS,
	HISTORIAN_BOUND_UNSET,
	HISTORIAN_CALL_MS_VARIABLE,
	HISTORIAN_DISABLED_TOOLS,
	HISTORIAN_PROJECT_CONFIG,
	HISTORIAN_USER_CONFIG,
	HistorianCopyRefusal,
	NOT_TEXT_NOT_COPIED,
	devinHistorianCall,
	historianCallBound,
	historianToolCallsOf,
	historianWorkspaceFiles,
	recordNameClash,
	workspaceCopyClash,
	writeHistorianFolder
} from './devin-historian.js';

/** devin 3000.11.234's own tool listing, as an export it wrote holds it (the fixture ruling 2 (A) names). */
const EXPORT_TOOL_NAMES_3000_11_234 = [
	'ask_user_question', 'browser_preview', 'close_browser_preview', 'edit', 'exec', 'find_file_by_name', 'get_output', 'grep', 'kill_shell',
	'mcp_call_tool', 'mcp_list_servers', 'mcp_list_tools', 'mcp_read_resource', 'notebook_edit', 'notebook_read', 'read', 'read_subagent',
	'request_scope', 'run_subagent', 'skill', 'todo_write', 'web_search', 'webfetch', 'write', 'write_to_process'
] as const;
/** MH-0a's `disabled_tools` names that 3000.11.234 does not offer the selected model (DESIGN-multi-harness-executor.md §4.1). */
const MH0A_NOT_OFFERED = ['code_search', 'apply_patch', 'shell_command', 'view_image'] as const;
const READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();
const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('⭐⭐ L17b2 (D86; ruling 2) — the Historian’s two configurations, at devin 3000.11.234', () => {
	it('⛔ RED FIRST — every tool that version names is allowed, or both disabled and denied; the allowed are the three D86 names with this version’s finder', () => {
		expect(DEVIN_HISTORIAN_MEASURED_VERSION).toBe('3000.11.234');
		expect.soft(sorted(HISTORIAN_ALLOWED_TOOLS), 'the allowed tools').toEqual(sorted(['read', 'grep', 'find_file_by_name', 'glob']));
		const user = JSON.parse(HISTORIAN_USER_CONFIG) as { disabled_tools?: string[] };
		const project = JSON.parse(HISTORIAN_PROJECT_CONFIG) as { permissions?: { deny?: string[] } };
		const disabled = new Set(user.disabled_tools ?? []);
		const denied = new Set(project.permissions?.deny ?? []);
		for (const name of EXPORT_TOOL_NAMES_3000_11_234) {
			const allowed = HISTORIAN_ALLOWED_TOOLS.includes(name);
			expect.soft(allowed || (disabled.has(name) && denied.has(name)), `${name} is neither allowed nor both disabled and denied`).toBe(true);
			if (allowed) expect.soft(disabled.has(name) || denied.has(name), `${name} is allowed and still disabled or denied`).toBe(false);
		}
		const expectedDisabled = [...EXPORT_TOOL_NAMES_3000_11_234.filter((n) => !HISTORIAN_ALLOWED_TOOLS.includes(n)), ...MH0A_NOT_OFFERED];
		expect.soft(sorted(HISTORIAN_DISABLED_TOOLS), 'the 26 disabled names').toEqual(sorted(expectedDisabled));
		expect.soft(sorted(disabled), 'the user configuration’s disabled_tools').toEqual(sorted(expectedDisabled));
		expect.soft(sorted(denied), 'the project configuration’s deny list').toEqual(sorted([...expectedDisabled, 'Fetch(*)', 'mcp__*']));
	});

	it('⛔ RED FIRST — the user configuration: subagents off, the seven read_config_from off; both files two-space JSON with a closing line break', () => {
		const user = JSON.parse(HISTORIAN_USER_CONFIG) as { subagents_enabled?: unknown; read_config_from?: Record<string, unknown> };
		expect.soft(user.subagents_enabled).toBe(false);
		expect.soft(user.read_config_from).toEqual(Object.fromEntries(READ_CONFIG_FROM.map((k) => [k, false])));
		for (const [name, text] of [['user', HISTORIAN_USER_CONFIG], ['project', HISTORIAN_PROJECT_CONFIG]] as const)
			expect.soft(text, `the ${name} configuration’s form`).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
	});
});

describe('⭐⭐ L17b2 (D86; rulings 8, 9) — the Historian’s folder', () => {
	it('⛔ RED FIRST — a fresh folder holding the prompt, its project configuration, its records with their index, and a copy of the workspace; its configuration and export in a host folder beside it', async () => {
		// ⭐ §7 (Q1) — RESTATED: ~~a directory made for the case, `src/wordfreq.ts` in it, handed in as `workspaceDir`~~ the shared workspace's files as
		// the port gives them (`historianWorkspaceFiles`, below), handed in as `workspaceFiles`: the folder writer copies what it is handed, path for path.
		const records = [
			{ file: 'asm_round_one.json', what: 'the first round’s rejecting verdict', text: '{"assessmentId":"asm_round_one"}' },
			{ file: 'source--pwu_source.md', what: 'the recorded conversation of “Source” (pwu_source)', text: 'part 1 of 1\n' }
		];
		const workspaceFiles = [{ path: 'src/wordfreq.ts', text: 'export const reader = 1;\n' }];
		const f = await writeHistorianFolder({ prompt: 'You are the Historian.', records, workspaceFiles });
		dirs.push(f.folder, f.host);
		expect.soft(readFileSync(join(f.folder, 'prompt.txt'), 'utf8')).toBe('You are the Historian.');
		expect.soft(readFileSync(join(f.folder, '.devin', 'config.json'), 'utf8')).toBe(HISTORIAN_PROJECT_CONFIG);
		for (const r of records) expect.soft(readFileSync(join(f.folder, 'records', r.file), 'utf8'), r.file).toBe(r.text);
		const index = readFileSync(join(f.folder, 'records', 'INDEX.md'), 'utf8');
		for (const r of records) expect.soft(index, `the index does not name ${r.file}`).toContain(`${r.file} — ${r.what}`);
		expect.soft(readFileSync(join(f.folder, 'workspace', 'src', 'wordfreq.ts'), 'utf8')).toBe('export const reader = 1;\n');
		expect.soft(sorted(readdirSync(f.folder)), 'the folder holds only these').toEqual(sorted(['.devin', 'prompt.txt', 'records', 'workspace']));
		expect.soft(readFileSync(f.userConfigPath, 'utf8')).toBe(HISTORIAN_USER_CONFIG);
		expect.soft(f.userConfigPath.startsWith(f.host) && f.exportPath.startsWith(f.host), 'the configuration and the export are not in the host folder').toBe(true);
		expect.soft(f.host.startsWith(f.folder + '/') || f.host.startsWith(f.folder + '\\'), 'the host folder is inside what the Historian may read').toBe(false);
	});

	// ⭐ L17b2 addendum (the lead's §27, item 7) — two of its record files of one name would be written one over the other: the folder is not
	// written at all, naming the name. ⭑ Names that differ only in case are one name, as Windows' file system reads them.
	it('⛔ RED FIRST — two record files of one name: the folder is not written, naming the name; names that differ only in case are one name', async () => {
		const token = `two-record-files-of-one-name-${process.pid}-${Date.now()}`;
		const record = (file: string, text: string) => ({ file, what: `the record ${text}`, text });
		for (const [first, second] of [
			['a.json', 'a.json'],
			['B.json', 'b.json']
		] as const) {
			const settled = await writeHistorianFolder({ prompt: `${token} ${second}`, records: [record(first, '1'), record(second, '2')], workspaceFiles: [] }).then(
				(f) => ({ ok: true as const, f }),
				(e: unknown) => ({ ok: false as const, why: e instanceof Error ? e.message : String(e) })
			);
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect.soft(settled.ok, `${first} and ${second}: the folder was written`).toBe(false);
			expect.soft(settled.ok ? '' : settled.why, `${first} and ${second}: the refusal does not name the name`).toContain(`records/${second}`);
		}
		const promptOf = (d: string): string => {
			try {
				return readFileSync(join(tmpdir(), d, 'prompt.txt'), 'utf8');
			} catch {
				return '';
			}
		};
		expect
			.soft(
				readdirSync(tmpdir()).filter((d) => d.startsWith('jpwb-historian-') && promptOf(d).startsWith(token)),
				'a folder holding its prompt was written'
			)
			.toEqual([]);
		expect.soft(recordNameClash([record('a.json', '1'), record('c.json', '2')]), '⭑ CONTROL — two names, each its own, read as one').toBeUndefined();
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 3) — TESTS THE MUTANTS OWED: the folder writer's two refusals, each limb driven as a
	// mutant first and each SURVIVING every test (no test handed the writer a name or a path it refuses). ⭑ A write that is refused removes what it
	// made: no folder holding its prompt is left under the OS temporary folder.
	/** The Historian folders under the OS temporary folder whose prompt begins with `token`: what a refused write left behind. */
	const foldersLeftBy = (token: string): string[] =>
		readdirSync(tmpdir()).filter((d) => {
			if (!d.startsWith('jpwb-historian-')) return false;
			try {
				return readFileSync(join(tmpdir(), d, 'prompt.txt'), 'utf8').startsWith(token);
			} catch {
				return false;
			}
		});
	/** A write settled: the folder written, or why it was refused. */
	const settledWrite = (input: Parameters<typeof writeHistorianFolder>[0]) =>
		writeHistorianFolder(input).then(
			(f) => ({ ok: true as const, f }),
			(e: unknown) => ({ ok: false as const, why: e instanceof Error ? e.message : String(e) })
		);

	it('⛔ RED FIRST — a record’s file name is one plain file name under records/, and not the index’s: an empty name, “.”, “..”, a name holding “/”, a backslash or “:”, and INDEX.md are each refused in the writer’s own words, naming the name, and no folder is left', async () => {
		const token = `a-record-file-name-refused-${process.pid}-${Date.now()}`;
		for (const bad of ['', '.', '..', 'sub/a.json', '../a.json', 'sub\\a.json', 'a:b.json', 'INDEX.md']) {
			const settled = await settledWrite({ prompt: `${token} ${JSON.stringify(bad)}`, records: [{ file: bad, what: 'a record', text: '{}' }], workspaceFiles: [] });
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect.soft(settled.ok ? 'the folder was written' : settled.why, `${JSON.stringify(bad)}: not refused as a record file name`).toBe(
				`the record file name ${JSON.stringify(bad)} is not one plain file name under records/`
			);
		}
		expect.soft(foldersLeftBy(token), 'a refused write left its folder').toEqual([]);
	});

	it('⛔ RED FIRST — a workspace file is written under workspace/ alone: a path that is the workspace itself, one that climbs out of it and — on Windows — one on another drive are each refused in the writer’s own words, naming the path, and no folder is left', async () => {
		const token = `a-workspace-path-refused-${process.pid}-${Date.now()}`;
		// ⭑ On Windows, a path on a drive the machine does not have: its way from the workspace is an absolute one. Elsewhere every path has a relative
		// way from the workspace, so that limb of the refusal has no case to refuse.
		const noDrive = process.platform === 'win32' ? [...'ZYXWVUTSRQPONMLKJIHGFEDCBA'].find((l) => !existsSync(`${l}:\\`)) : undefined;
		for (const bad of ['.', '../escaped.txt', 'sub/../../escaped.txt', ...(noDrive === undefined ? [] : [`${noDrive}:\\escaped.txt`])]) {
			const settled = await settledWrite({ prompt: `${token} ${JSON.stringify(bad)}`, records: [], workspaceFiles: [{ path: bad, text: 'x' }] });
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect.soft(settled.ok ? 'the folder was written' : settled.why, `${JSON.stringify(bad)}: not refused as leaving workspace/`).toBe(
				`the workspace path ${JSON.stringify(bad)} would leave the Historian's workspace/`
			);
		}
		expect.soft(foldersLeftBy(token), 'a refused write left its folder').toEqual([]);
	});

	// ⭐⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A02; the lead's r26 (2)) — TWO WORKSPACE FILES THAT LAND ON ONE NAME IN
	// THE COPY: an in-memory workspace may hold `A.txt` and `a.txt`, and on a volume that does not tell case apart the copy wrote one over the other while
	// its index said every file is copied. The same check the records have (`recordNameClash`), made of the copy targets before any folder is made.
	it('⛔ RED FIRST — an in-memory workspace holding A.txt and a.txt: its copy is refused before any folder is made, both paths named, as Windows compares names; and no folder is left', async () => {
		const token = `two-workspace-files-of-one-name-${process.pid}-${Date.now()}`;
		const ws = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_a02', purgeability: 'RETAINED_BY_PARTICIPATION' });
		await ws.writeFile('A.txt', 'upper');
		await ws.writeFile('a.txt', 'lower');
		const read = await historianWorkspaceFiles(ws);
		expect(read.ok, read.ok ? '' : read.why).toBe(true);
		const files = read.ok ? read.files : [];
		expect(files.map((f) => f.path).sort(), 'arrangement: the port lists both, each read whole').toEqual(['A.txt', 'a.txt']);
		expect(files.every((f) => 'text' in f), 'arrangement: both are copied').toBe(true);
		const settled = await settledWrite({ prompt: `${token} A.txt a.txt`, records: [], workspaceFiles: files });
		if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
		expect.soft(settled.ok ? 'the folder was written, one workspace file over the other' : settled.why, 'the copy is not refused, naming both paths').toBe(
			"two of the workspace's files land on one name in its copy, workspace/A.txt and workspace/a.txt, case not told apart: its folder is not written, so that neither is written over the other (design D86)"
		);
		// ⭑ And one path handed twice, as two record files of one name are refused: in the writer's own words.
		const twice = await settledWrite({ prompt: `${token} twice`, records: [], workspaceFiles: [{ path: 'src/a.txt', text: '1' }, { path: 'src/a.txt', text: '2' }] });
		if (twice.ok) dirs.push(twice.f.folder, twice.f.host);
		expect.soft(twice.ok ? 'the folder was written, one workspace file over the other' : twice.why, 'one path handed twice is not refused').toBe(
			"two of the workspace's files land on one name in its copy, workspace/src/a.txt, twice: its folder is not written, so that neither is written over the other (design D86)"
		);
		expect.soft(foldersLeftBy(token), 'a refused write left its folder').toEqual([]);
	});

	it('⭑ CONTROL — two workspace files whose names differ in more than case are each copied at its own path; and a name equal to a copied one but for case, itself not copied, writes nothing over it', async () => {
		const token = `two-workspace-files-each-its-own-${process.pid}-${Date.now()}`;
		const settled = await settledWrite({
			prompt: token,
			records: [],
			workspaceFiles: [
				{ path: 'A.txt', text: 'upper' },
				{ path: 'b.txt', text: 'lower' },
				{ path: 'a.txt', notCopied: NOT_TEXT_NOT_COPIED, byteSize: 3 }
			]
		});
		if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
		expect(settled.ok ? '' : settled.why, 'a copy of files each its own was refused').toBe('');
		if (settled.ok)
			expect([readFileSync(join(settled.f.folder, 'workspace', 'A.txt'), 'utf8'), readFileSync(join(settled.f.folder, 'workspace', 'b.txt'), 'utf8')]).toEqual([
				'upper',
				'lower'
			]);
	});

	// ⭐⭐ L17b2 (the lead's r27, r27a) — A02'S GENERAL FORM: the case check above closes the pair Codex's review found, not every form of two names
	// that land on one file. On a volume that makes 8.3 short names, `ABCDEF~1.TXT` is a second name of `abcdefghij.txt`; lower-cased the two still
	// differ, so only the write can find it. The copy creates each file and writes over none (`flag: 'wx'`): the second name is refused in D86's words,
	// the path as the workspace gave it, never the absolute path EEXIST's own message holds. Where the volume of tmpdir(), on which the writer makes its
	// folder, makes no short names, the pair is two files there, and the test is skipped, saying so.
	/** ⭐ r27 — whether the volume of tmpdir() makes 8.3 short names: `long` written in a fresh folder there, then opened by `short`; said as found. */
	const shortNameOpens = (long: string, short: string): { readonly made: boolean; readonly found: string } => {
		const probe = mkdtempSync(join(tmpdir(), 'jpwb-short-names-'));
		try {
			writeFileSync(join(probe, long), 'the long name');
			let read = '';
			try {
				read = readFileSync(join(probe, short), 'utf8');
			} catch (e) {
				read = `(${(e as { code?: string }).code ?? 'unread'})`;
			}
			const made = read === 'the long name';
			return {
				made,
				found: made
					? `in a fresh folder on the volume of tmpdir(), ${short} opens ${long}: that volume makes 8.3 short names`
					: `in a fresh folder on the volume of tmpdir(), ${short} does not open ${long} ${read}: that volume makes no 8.3 short name for it, so the pair is two files there`
			};
		} finally {
			rmSync(probe, { recursive: true, force: true });
		}
	};

	it('⛔ RED FIRST — an in-memory workspace holding abcdefghij.txt then ABCDEF~1.TXT, its 8.3 short name: the write is refused in D86’s words, the path as the workspace gave it and no absolute one, and no folder is left; skipped, saying why, where the volume of tmpdir() makes no short names', async (ctx) => {
		const volume = shortNameOpens('abcdefghij.txt', 'ABCDEF~1.TXT');
		ctx.skip(!volume.made, `skipped: ${volume.found}`);
		const token = `a-workspace-name-the-copy-holds-${process.pid}-${Date.now()}`;
		const files = [
			{ path: 'abcdefghij.txt', text: 'the long name' },
			{ path: 'ABCDEF~1.TXT', text: 'the short name' }
		];
		expect(workspaceCopyClash(files), 'arrangement: the case check catches the pair, so it is not the write’s to find').toBeUndefined();
		const settled = await settledWrite({ prompt: `${token} 8.3`, records: [], workspaceFiles: files });
		let written = '';
		if (settled.ok) {
			dirs.push(settled.f.folder, settled.f.host);
			const index = readFileSync(join(settled.f.folder, 'records', 'INDEX.md'), 'utf8');
			const long = readFileSync(join(settled.f.folder, 'workspace', 'abcdefghij.txt'), 'utf8');
			written = `the folder was written: its index says ${index.includes('Every file it lists is copied.') ? 'every file is copied' : 'a file is not copied'}, and abcdefghij.txt holds ${JSON.stringify(long)}`;
		}
		expect.soft(settled.ok ? written : settled.why, `the write is not refused in D86’s words, its path as the workspace gave it (${volume.found})`).toBe(
			'a workspace file of its copy, workspace/ABCDEF~1.TXT, lands on a name its copy already holds, as this volume reads names: its folder is not written, so that neither is written over the other (design D86)'
		);
		expect
			.soft(settled.ok ? [false, false] : [settled.why.includes(tmpdir()), /[A-Za-z]:[\\/]/.test(settled.why)], 'the refusal names an absolute path')
			.toEqual([false, false]);
		expect.soft(foldersLeftBy(token), 'a folder is left of a write that should be refused').toEqual([]);
	});

	it('⭑ CONTROL — pairs that are two files on this volume — a.txt and a.txt with a trailing dot, b.txt and b.txt with a trailing space — are each copied as two files, each with its own bytes', async () => {
		const token = `pairs-that-are-two-files-${process.pid}-${Date.now()}`;
		const files = [
			{ path: 'a.txt', text: 'a' },
			{ path: 'a.txt.', text: 'a, a trailing dot' },
			{ path: 'b.txt', text: 'b' },
			{ path: 'b.txt ', text: 'b, a trailing space' }
		];
		const settled = await settledWrite({ prompt: token, records: [], workspaceFiles: files });
		if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
		expect(settled.ok ? '' : settled.why, 'a copy of pairs that are two files was refused').toBe('');
		if (settled.ok) {
			const workspace = join(settled.f.folder, 'workspace');
			expect.soft(sorted(readdirSync(workspace)), 'the copy does not hold the four as four files').toEqual(sorted(files.map((f) => f.path)));
			expect
				.soft(files.map((f) => readFileSync(join(workspace, f.path), 'utf8')), 'a file of a pair does not hold its own bytes')
				.toEqual(files.map((f) => f.text));
		}
	});

	// ⭐⭐ L17b2 (the lead's r28 (2); Codex's L17B2F-A02) — A FILE OF THE COPY AT A FOLDER OF ANOTHER'S PATH: the check above compared whole targets alone,
	// and a workspace file's folder is made before its guarded write, so `A` then `a/x.txt` met the volume's own EEXIST at the folder, its absolute path
	// in it, and the Historian was recorded failing. Each copied target's folders are now compared, case not told apart, with the copied files' targets,
	// in either order and at any depth, before any folder is made; and a folder's `mkdir` that meets a name the copy holds (EEXIST, ENOTDIR), which only
	// the volume can know — at an 8.3 short name — is a `HistorianCopyRefusal`, in D86's words.
	it('⛔ RED FIRST — a file of the copy at a folder of another’s path — A then a/x.txt, a/x.txt then A, a then a/x.txt, A then a/b/x.txt — is refused before any folder is made, both paths named, the file first; and no folder is left', async () => {
		const token = `a-file-at-a-folder-of-the-copy-${process.pid}-${Date.now()}`;
		const cases: readonly (readonly [readonly string[], string])[] = [
			[["A", "a/x.txt"], "two of the workspace's files land on one name in its copy, workspace/A as a file and as a folder of workspace/a/x.txt, case not told apart: its folder is not written, so that neither is written over the other (design D86)"],
			[["a/x.txt", "A"], "two of the workspace's files land on one name in its copy, workspace/A as a file and as a folder of workspace/a/x.txt, case not told apart: its folder is not written, so that neither is written over the other (design D86)"],
			[["a", "a/x.txt"], "two of the workspace's files land on one name in its copy, workspace/a as a file and as a folder of workspace/a/x.txt: its folder is not written, so that neither is written over the other (design D86)"],
			[["A", "a/b/x.txt"], "two of the workspace's files land on one name in its copy, workspace/A as a file and as a folder of workspace/a/b/x.txt, case not told apart: its folder is not written, so that neither is written over the other (design D86)"]
		];
		for (const [paths, words] of cases) {
			const settled = await settledWrite({ prompt: `${token} ${paths.join(' ')}`, records: [], workspaceFiles: paths.map((path) => ({ path, text: path })) });
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect.soft(settled.ok ? 'the folder was written' : settled.why, `${paths.join(' then ')}: not refused before any folder is made, both paths named`).toBe(words);
		}
		expect.soft(foldersLeftBy(token), 'a refused write left its folder').toEqual([]);
	});

	it('⛔ RED FIRST — a folder of the copy at an 8.3 short name — abcdefghij.txt then ABCDEF~1.TXT/x.txt, and then ABCDEF~1.TXT/b/x.txt — is refused at the write as a HistorianCopyRefusal, in D86’s words, the path as the workspace gave it and no absolute one, and no folder is left; skipped, saying why, where the volume of tmpdir() makes no short names', async (ctx) => {
		const volume = shortNameOpens('abcdefghij.txt', 'ABCDEF~1.TXT');
		ctx.skip(!volume.made, `skipped: ${volume.found}`);
		const token = `a-folder-at-a-name-the-copy-holds-${process.pid}-${Date.now()}`;
		const cases: readonly (readonly [string, string])[] = [
			['ABCDEF~1.TXT/x.txt', 'a folder of a workspace file of its copy, workspace/ABCDEF~1.TXT/x.txt, lands on a name its copy already holds, as this volume reads names: its folder is not written, so that neither is written over the other (design D86)'],
			['ABCDEF~1.TXT/b/x.txt', 'a folder of a workspace file of its copy, workspace/ABCDEF~1.TXT/b/x.txt, lands on a name its copy already holds, as this volume reads names: its folder is not written, so that neither is written over the other (design D86)']
		];
		for (const [second, words] of cases) {
			const files = [
				{ path: 'abcdefghij.txt', text: 'the long name' },
				{ path: second, text: 'a file under the short name' }
			];
			expect(workspaceCopyClash(files), `arrangement: ${second}: the check before any folder is made catches it, so it is not the write’s to find`).toBeUndefined();
			const settled = await writeHistorianFolder({ prompt: `${token} ${second}`, records: [], workspaceFiles: files }).then(
				(f) => ({ ok: true as const, f }),
				(e: unknown) => ({ ok: false as const, why: e instanceof Error ? e.message : String(e), named: e instanceof HistorianCopyRefusal })
			);
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect
				.soft(settled.ok ? 'the folder was written' : settled.why, `${second}: the folder’s refusal is not said in D86’s words, its path as the workspace gave it (${volume.found})`)
				.toBe(words);
			expect
				.soft(settled.ok ? [false, false] : [settled.why.includes(tmpdir()), /[A-Za-z]:[\\/]/.test(settled.why)], `${second}: the refusal names an absolute path`)
				.toEqual([false, false]);
			expect.soft(!settled.ok && settled.named, `${second}: the refusal is not a HistorianCopyRefusal`).toBe(true);
		}
		expect.soft(foldersLeftBy(token), 'a refused write left its folder').toEqual([]);
	});

	it('⭑ CONTROL — names that are no file at a folder of another’s path are each copied, each with its own bytes: src/x.ts and SRC/y.ts, two files of one folder as this volume reads it; a and ab/x.txt; a.b/x.txt and a; and A, not copied, beside a/x.txt', async () => {
		const token = `no-file-at-a-folder-of-the-copy-${process.pid}-${Date.now()}`;
		for (const paths of [['src/x.ts', 'SRC/y.ts'], ['a', 'ab/x.txt'], ['a.b/x.txt', 'a']]) {
			const settled = await settledWrite({ prompt: `${token} ${paths.join(' ')}`, records: [], workspaceFiles: paths.map((path) => ({ path, text: `the bytes of ${path}` })) });
			if (settled.ok) dirs.push(settled.f.folder, settled.f.host);
			expect.soft(settled.ok ? '' : settled.why, `${paths.join(' and ')}: a copy of names that are no file at a folder of another’s was refused`).toBe('');
			if (settled.ok) {
				const workspace = join(settled.f.folder, 'workspace');
				expect
					.soft(paths.map((p) => readFileSync(join(workspace, p), 'utf8')), `${paths.join(' and ')}: a file does not hold its own bytes`)
					.toEqual(paths.map((p) => `the bytes of ${p}`));
			}
		}
		// ⭑ And a file not copied, which writes nothing: A, not copied, beside a/x.txt.
		const notCopied = await settledWrite({
			prompt: `${token} A not copied`,
			records: [],
			workspaceFiles: [
				{ path: 'A', notCopied: NOT_TEXT_NOT_COPIED, byteSize: 3 },
				{ path: 'a/x.txt', text: 'the bytes of a/x.txt' }
			]
		});
		if (notCopied.ok) dirs.push(notCopied.f.folder, notCopied.f.host);
		expect.soft(notCopied.ok ? '' : notCopied.why, 'A, not copied, beside a/x.txt: the copy was refused').toBe('');
		if (notCopied.ok)
			expect
				.soft(readFileSync(join(notCopied.f.folder, 'workspace', 'a', 'x.txt'), 'utf8'), 'A, not copied, beside a/x.txt: a/x.txt does not hold its own bytes')
				.toBe('the bytes of a/x.txt');
	});
});

describe('⭐⭐ L17b2 (D86; rulings 2 (A), 6, 16) — the call', () => {
	/** A fresh folder to call over. */
	const aFolder = async () => {
		// ⭐ §7 (Q1) — ~~`workspaceDir`, an empty directory made for the case~~ no files handed in.
		const f = await writeHistorianFolder({ prompt: 'P', records: [], workspaceFiles: [] });
		dirs.push(f.folder, f.host);
		return f;
	};

	it('⛔ RED FIRST — devin is called in the folder, its prompt, export and configuration named, at the time bound, and the export read before the folder and its host are removed', async () => {
		const f = await aFolder();
		const seen: { file: string; args: readonly string[]; cwd: string; timeout: number }[] = [];
		const exec: HistorianExec = async (file, args, options) => {
			seen.push({ file, args, cwd: options.cwd, timeout: options.timeout });
			writeFileSync(args[args.indexOf('--export') + 1]!, '{"schema_version":"ATIF-v1.7","steps":[]}');
			return { stdout: '{"findings":[]}' };
		};
		const out = await devinHistorianCall({ folder: f, model: 'swe-2-max', boundMs: 600_000 }, { exec, versionOf: async () => 'devin 3000.11.234 (92c83011d113)' });
		expect.soft(seen.map((s) => s.args), 'the argv').toEqual([
			['--print', '--model', 'swe-2-max', '--prompt-file', f.promptPath, '--export', f.exportPath, '--respect-workspace-trust', 'false', '--config', f.userConfigPath]
		]);
		expect.soft(seen[0]?.cwd, 'devin’s working folder').toBe(f.folder);
		expect.soft(seen[0]?.timeout, 'the time bound').toBe(600_000);
		expect.soft(out).toMatchObject({ ran: true, stdout: '{"findings":[]}', sessionExport: '{"schema_version":"ATIF-v1.7","steps":[]}' });
		expect.soft(existsSync(f.folder), 'the folder was kept').toBe(false);
		expect.soft(existsSync(f.host), 'the host folder was kept').toBe(false);
	});

	it('⛔ RED FIRST — any devin version but the one whose tools were measured is not run, both named; and the folder is removed', async () => {
		const f = await aFolder();
		let called = false;
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			{ exec: async () => ((called = true), { stdout: '' }), versionOf: async () => 'devin 3000.11.300 (abc)' }
		);
		expect.soft(called, 'devin was called at another version').toBe(false);
		expect.soft(out.ran).toBe(false);
		expect.soft(out.ran ? '' : out.why).toContain('3000.11.300');
		expect.soft(out.ran ? '' : out.why).toContain('3000.11.234');
		expect.soft(existsSync(f.folder) || existsSync(f.host), 'a folder was kept').toBe(false);
	});

	it('⛔ RED FIRST — a call devin fails is the call’s failure, named; the folder is removed all the same', async () => {
		const f = await aFolder();
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			{ exec: async () => { throw new Error('devin exited 2'); }, versionOf: async () => 'devin 3000.11.234 (92c83011d113)' }
		);
		expect.soft(out.ran && out.failure).toContain('devin exited 2');
		expect.soft(existsSync(f.folder) || existsSync(f.host), 'a folder was kept').toBe(false);
	});

	it('⛔ RED FIRST — the time bound is required, with no default: unset or not a positive whole number of milliseconds, the Historian is not run, and why', () => {
		expect(HISTORIAN_CALL_MS_VARIABLE).toBe('JPWB_HISTORIAN_CALL_MS');
		expect.soft(historianCallBound({})).toEqual({ ok: false, why: HISTORIAN_BOUND_UNSET });
		expect.soft(HISTORIAN_BOUND_UNSET).toBe('its time bound is not set: design D84 measures it');
		for (const bad of ['', '0', '-5', '1.5', 'ten minutes'])
			expect.soft(historianCallBound({ JPWB_HISTORIAN_CALL_MS: bad }).ok, JSON.stringify(bad)).toBe(false);
		expect.soft(historianCallBound({ JPWB_HISTORIAN_CALL_MS: '600000' })).toEqual({ ok: true, ms: 600_000 });
	});

	// ⭐ L17b2 addendum (the lead's §27, item 6) — Node keeps a timer of at most 2147483647 ms (`REG-F-638`'s number) and sets a larger one to 1 ms,
	// so the call would end at once: such a bound is refused as the others are, naming the limit.
	it('⛔ RED FIRST — a time bound above Node’s largest timer, 2147483647 ms, is refused as the others are, naming the limit; ⭑ CONTROL: that largest one is kept', () => {
		const above = historianCallBound({ JPWB_HISTORIAN_CALL_MS: '2147483648' });
		expect.soft(above.ok, 'a bound above 2147483647 ms was kept, which Node sets to 1 ms').toBe(false);
		expect.soft(above.ok ? '' : above.why, 'the refusal does not name the limit').toContain('2147483647');
		expect.soft(historianCallBound({ JPWB_HISTORIAN_CALL_MS: '2147483647' }), 'the largest timer Node keeps was refused').toEqual({ ok: true, ms: 2_147_483_647 });
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 3) — TESTS THE MUTANTS OWED: a folder that could not be removed, and a `devin --version`
	// that throws — each driven as a mutant first, and each SURVIVING every test (every call of the tests removed both folders; no test's version threw).
	it('⛔ RED FIRST — a folder that cannot be removed is said on the call’s outcome, named with why, and the other is removed all the same, whatever came of the call; ⭑ CONTROL: both removed, nothing is said', async () => {
		const f = await aFolder();
		// A folder Node cannot remove: its path holds a NUL, which every file-system call refuses. Its host beside it is one Node can.
		const kept = `${f.folder}\0kept`;
		const out = await devinHistorianCall(
			{ folder: { ...f, folder: kept }, model: 'swe-2-max', boundMs: 600_000 },
			{ exec: async () => ({ stdout: '{"findings":[]}' }), versionOf: async () => 'devin 3000.11.234 (92c83011d113)' }
		);
		expect.soft(out.folderNotRemoved ?? '', 'a folder that could not be removed is not said, named with why').toContain(`${kept} could not be removed: `);
		expect.soft(out.ran && out.failure === undefined ? out.stdout : 'no answer', 'the call’s own outcome does not stand beside it').toBe('{"findings":[]}');
		expect.soft(existsSync(f.host), 'the host folder was kept: the removal stopped at the folder that failed').toBe(false);
		const g = await aFolder();
		const clean = await devinHistorianCall(
			{ folder: g, model: 'swe-2-max', boundMs: 600_000 },
			{ exec: async () => ({ stdout: '{"findings":[]}' }), versionOf: async () => 'devin 3000.11.234 (92c83011d113)' }
		);
		expect.soft('folderNotRemoved' in clean, '⭑ CONTROL — both folders removed, and one is said to be kept').toBe(false);
	});

	it('⛔ RED FIRST — a `devin --version` that throws: the Historian is not run, saying that its version could not be read and why; devin is never called; and the folder is removed', async () => {
		const f = await aFolder();
		let called = false;
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			{
				exec: async () => ((called = true), { stdout: '' }),
				versionOf: async () => {
					throw new Error('spawn devin ENOENT');
				}
			}
		);
		expect.soft(called, 'devin was called though its version could not be read').toBe(false);
		expect.soft(out.ran, 'the Historian ran though its version could not be read').toBe(false);
		const why = out.ran ? '' : out.why;
		expect.soft(
			[why.includes('version could not be read (devin --version: '), why.includes('spawn devin ENOENT'), why.includes(DEVIN_HISTORIAN_MEASURED_VERSION)],
			`why it is not run does not say that its version could not be read, why, and the version its tools were measured at: ${why}`
		).toEqual([true, true, true]);
		expect.soft(existsSync(f.folder) || existsSync(f.host), 'a folder was kept').toBe(false);
	});
});

// ⭐⭐ §7 (Q1, the lead's ruling) — THE HISTORIAN'S `workspace/` IS READ FROM THE SHARED WORKSPACE THROUGH THE PORT (`list`, then `readFile`, each live
// file at its path), whatever its materialization; the helpers keep their directory copies. ⭑ No partial copy: a file the port lists but cannot read,
// or a listing that fails, gives no copy at all, naming the file or why — the Historian is then not run. ⭑ Against a directory copy (`cpSync`, as the
// helpers copy): the same files, path for path and byte for byte, but for the three differences measured at Stage 1 and named (L17b2 facts §8):
// a file whose bytes are not UTF-8 (the port reads text), an empty folder (the port lists files), and a link (the port leaves it out).
describe('⭐⭐ L17b2 (§7, Q1) — the shared workspace read through the port for the Historian’s `workspace/`: whole, or not at all; and what that copy holds against a directory copy', () => {
	/** Every entry under `dir`, by its `/`-separated path: a file with its size and sha256, a folder, or a link. */
	const treeOf = (dir: string): Record<string, string> => {
		const out: Record<string, string> = {};
		const walk = (at: string, rel: string): void => {
			for (const name of readdirSync(at).sort()) {
				const p = join(at, name);
				const r = rel === '' ? name : `${rel}/${name}`;
				const info = lstatSync(p);
				if (info.isSymbolicLink()) out[r] = 'LINK';
				else if (info.isDirectory()) {
					out[`${r}/`] = 'DIR';
					walk(p, r);
				} else out[r] = `FILE ${info.size} ${createHash('sha256').update(readFileSync(p)).digest('hex')}`;
			}
		};
		walk(dir, '');
		return out;
	};
	// ⭐ §9 (1) — ~~`(files: readonly { readonly path: string; readonly text: string }[])`~~: the read carries each file it lists, copied (its text) or
	// named and not copied (its size and why), so the sort takes any entry with a path; no assertion moves.
	const byPath = (files: readonly { readonly path: string }[]) => [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

	it('⛔ RED FIRST — a workspace in memory is read whole: each file it lists, at its path, with its text', async () => {
		const ws = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_q1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		await ws.writeFile('src/reader.ts', 'export const read = () => "";\n');
		await ws.writeFile('.jpwb/accepted/specification--pwu_1.txt', 'the accepted specification\n');
		const read = await historianWorkspaceFiles(ws);
		expect(read.ok, read.ok ? '' : read.why).toBe(true);
		expect(read.ok ? byPath(read.files) : []).toEqual([
			{ path: '.jpwb/accepted/specification--pwu_1.txt', text: 'the accepted specification\n' },
			{ path: 'src/reader.ts', text: 'export const read = () => "";\n' }
		]);
	});

	it('⛔ RED FIRST — no partial copy: a file the port lists but cannot read, or a listing that fails, gives no copy at all, naming the file or why', async () => {
		const ws = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_q1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		await ws.writeFile('src/reader.ts', 'export const read = () => "";\n');
		await ws.writeFile('notes/plan.md', '# The plan\n');
		const unreadable = await historianWorkspaceFiles({ ...ws, readFile: async (path: string) => (path === 'src/reader.ts' ? undefined : ws.readFile(path)) });
		expect.soft(unreadable.ok, 'a copy was made without a file the port lists').toBe(false);
		expect.soft(unreadable.ok ? '' : unreadable.why, 'the file it could not read is not named').toContain('src/reader.ts');
		const unlisted = await historianWorkspaceFiles({
			...ws,
			list: async () => {
				throw new Error('the listing failed: EIO');
			}
		});
		expect.soft(unlisted.ok, 'a copy was made from a listing that failed').toBe(false);
		expect.soft(unlisted.ok ? '' : unlisted.why, 'why the listing failed is not said').toContain('the listing failed: EIO');
	});

	it('⛔ RED FIRST — for a workspace on disk, the copy holds exactly the files a cpSync of its directory holds, path for path and byte for byte — `.jpwb/`’s among them — but for the three differences measured and named: a file whose bytes are not UTF-8 (the port reads text), an empty folder (the port lists files), and a link (the port leaves it out) ⭐ (§9 (1)): that file named in records/INDEX.md with its size, and not copied; a UTF-8 file with a byte-order mark copied as it is', async () => {
		const root = mkdtempSync(join(tmpdir(), 'jpwb-historian-q1-'));
		dirs.push(root);
		const dir = join(root, 'demo.sqlite.workspaces', 'und-q1');
		const outside = join(root, 'outside');
		mkdirSync(outside, { recursive: true });
		writeFileSync(join(outside, 'secret.txt'), 'outside the workspace\n');
		const text: Record<string, string> = {
			'src/reader.ts': 'export const read = () => "";\n',
			'.jpwb/accepted/specification--pwu_1.txt': 'the accepted specification\n',
			'.jpwb/tactic/verification--pwu_2.json': '{"notice":"taken"}',
			'.jpwb/record/source--pwu_3.md': 'part 1 of 1\n',
			'.hidden': 'a dotfile\n',
			'docs/notes/deep/a.md': '# deep\n',
			'unicode/naïve – ✓.txt': 'ünïcödé ✓\n',
			// ⭐ §9 (1) — a UTF-8 file with a byte-order mark among the cases: its read reproduces its bytes, so it is copied, never called not text.
			'bom/with-bom.txt': '﻿a byte-order mark first\n'
		};
		for (const [p, t] of Object.entries(text)) {
			mkdirSync(dirname(join(dir, p)), { recursive: true });
			writeFileSync(join(dir, p), t);
		}
		mkdirSync(join(dir, 'bin'), { recursive: true });
		writeFileSync(join(dir, 'bin', 'data.bin'), Buffer.from([0xff, 0xfe, 0x00, 0x41, 0xc3]));
		mkdirSync(join(dir, 'empty'), { recursive: true });
		symlinkSync(outside, join(dir, 'linked'), 'junction');
		const read = await historianWorkspaceFiles(
			createFilesystemWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und-q1', purgeability: 'RETAINED_BY_PARTICIPATION', directoryPath: dir })
		);
		expect(read.ok, read.ok ? '' : read.why).toBe(true);
		if (!read.ok) return;
		const f = await writeHistorianFolder({ prompt: 'P', records: [], workspaceFiles: read.files });
		dirs.push(f.folder, f.host);
		const cpCopy = join(root, 'cp-copy');
		cpSync(dir, cpCopy, { recursive: true, verbatimSymlinks: true, errorOnExist: true, force: false });
		const port = treeOf(join(f.folder, 'workspace'));
		const cp = treeOf(cpCopy);
		expect.soft(
			Object.keys(text).filter((p) => port[p] === undefined || port[p] !== cp[p]),
			'a file is not the same in both copies, path for path and byte for byte'
		).toEqual([]);
		expect.soft(Object.keys(port).filter((k) => cp[k] === undefined), 'the port’s copy holds what the directory does not').toEqual([]);
		// ⭐ §9 (1) — RESTATED: ~~`port['bin/data.bin'] !== undefined && port['bin/data.bin'] !== cp['bin/data.bin']`, "a file whose bytes are not UTF-8 is
		// no longer changed by the port’s text read"~~ — a file whose read through the port does not reproduce its bytes is NAMED, NOT WRITTEN: absent
		// from `workspace/`, named in `records/INDEX.md` with its byte size and why ("not text: not copied"), and carried by the read as not copied, so the
		// copy never holds bytes the workspace does not. ⭑ The old promise kept: the difference from a directory copy is still there, and still named.
		expect.soft(port['bin/data.bin'], 'NAMED DIFFERENCE: a file whose bytes are not text was written into the port’s copy').toBeUndefined();
		expect.soft(cp['bin/data.bin'], 'arrangement: the directory copy holds the file the port’s copy leaves out').toBeDefined();
		const indexLine = readFileSync(join(f.folder, 'records', 'INDEX.md'), 'utf8')
			.split('\n')
			.find((l) => l.includes('bin/data.bin'));
		expect.soft(
			[indexLine?.includes('5 bytes'), indexLine?.includes('not text: not copied')],
			`NAMED DIFFERENCE: the file not copied is not named in the index with its size and why: ${indexLine ?? '(no line names it)'}`
		).toEqual([true, true]);
		expect.soft(
			read.files.filter((x) => 'notCopied' in x).map((x) => x.path),
			'the read does not carry the file it does not copy, and only it'
		).toEqual(['bin/data.bin']);
		expect.soft(port['bom/with-bom.txt'], 'a UTF-8 file with a byte-order mark was not copied byte for byte: called not text by mistake').toBe(
			cp['bom/with-bom.txt']
		);
		expect.soft([port['empty/'], port['linked/'], port.linked], 'NAMED DIFFERENCE: an empty folder, or a link, is in the port’s copy').toEqual([
			undefined,
			undefined,
			undefined
		]);
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 3) — A TEST THE MUTANTS OWED: each limb of the read's check alone. The one file the test
	// above leaves out, `bin/data.bin`, trips both — its read is 11 bytes for the listing's 5, and holds U+FFFD — so one arrangement proved neither:
	// each limb, dropped, SURVIVED every test. Here each is tripped alone: a UTF-8 file that holds U+FFFD itself, its read as long as its listing; and a
	// read three bytes short of its listing that holds none (a file changed between its listing and its read, or a read that drops bytes).
	it('⛔ RED FIRST — each limb of the read’s check alone (§9 (1)): a read as long as the listing says that holds U+FFFD is named and not copied; a read of another length than the listing says, holding none, is named and not copied; ⭑ CONTROL: a read of the listed length holding none is copied', async () => {
		const ws = createInMemoryWorkspace({ ownerKind: 'UNDERTAKING', ownerId: 'und_q1', purgeability: 'RETAINED_BY_PARTICIPATION' });
		await ws.writeFile('mark.txt', 'a�b\n');
		await ws.writeFile('plain.txt', 'short\n');
		const listed = await ws.list();
		expect(
			['mark.txt', 'plain.txt'].map((p) => listed.find((e) => e.path === p)?.byteSize),
			'arrangement: the listing gives each file its UTF-8 length'
		).toEqual([6, 6]);
		const fileOf = (read: Awaited<ReturnType<typeof historianWorkspaceFiles>>, path: string) => (read.ok ? read.files.find((x) => x.path === path) : read.why);
		const whole = await historianWorkspaceFiles(ws);
		expect.soft(fileOf(whole, 'mark.txt'), 'the mark alone: a read of the listed length that holds U+FFFD was copied').toEqual({
			path: 'mark.txt',
			byteSize: 6,
			notCopied: NOT_TEXT_NOT_COPIED
		});
		const longer = await historianWorkspaceFiles({
			list: async () => listed.map((e) => (e.path === 'plain.txt' ? { ...e, byteSize: e.byteSize + 3 } : e)),
			readFile: (path: string) => ws.readFile(path)
		});
		expect.soft(fileOf(longer, 'plain.txt'), 'the length alone: a read of another length than the listing says, holding no U+FFFD, was copied').toEqual({
			path: 'plain.txt',
			byteSize: 9,
			notCopied: NOT_TEXT_NOT_COPIED
		});
		expect.soft(fileOf(whole, 'plain.txt'), '⭑ CONTROL — a read of the listed length holding no U+FFFD was not copied').toEqual({ path: 'plain.txt', text: 'short\n' });
	});
});

describe('⭐⭐ L17b2 (D86; rulings 2 (B), 17) — the export read for its tool calls', () => {
	const FOLDER = join(tmpdir(), 'jpwb-historian-fixture');
	const exportOf = (calls: readonly { name: string; args: Record<string, unknown> }[]): string =>
		JSON.stringify({
			schema_version: 'ATIF-v1.7',
			steps: [{ step_id: 1, source: 'agent', tool_calls: calls.map((c, i) => ({ tool_call_id: `call_${i}`, function_name: c.name, arguments: c.args })) }]
		});

	it('⛔ RED FIRST — each call read for its name and paths; a read outside the folder and a tool not allowed are each a finding, named', () => {
		const read = historianToolCallsOf(
			exportOf([
				{ name: 'read', args: { file_path: 'records/INDEX.md' } },
				{ name: 'grep', args: { pattern: 'stdin', path: 'workspace' } },
				{ name: 'find_file_by_name', args: { pattern: '*.ts' } },
				{ name: 'read', args: { file_path: join(tmpdir(), 'elsewhere', 'secret.txt') } },
				{ name: 'read', args: { file_path: '../outside.txt' } },
				{ name: 'exec', args: { command: 'ls' } }
			]),
			FOLDER
		);
		expect.soft(read.calls.map((c) => [c.name, c.inside, c.allowed])).toEqual([
			['read', true, true],
			['grep', true, true],
			['find_file_by_name', true, true],
			['read', false, true],
			['read', false, true],
			['exec', true, false]
		]);
		expect.soft(read.findings.map((f) => f.code)).toEqual([
			'HISTORIAN_READ_OUTSIDE_FOLDER',
			'HISTORIAN_READ_OUTSIDE_FOLDER',
			'HISTORIAN_TOOL_NOT_ALLOWED'
		]);
		expect.soft(read.findings[0]?.statement).toContain(join(tmpdir(), 'elsewhere', 'secret.txt'));
		expect.soft(read.findings[1]?.statement).toContain('../outside.txt');
		expect.soft(read.findings[2]?.statement).toContain('exec');
	});

	it('⛔ RED FIRST — an export that is missing, not JSON, or whose calls are not in the read shape is a finding, never a clean bill', () => {
		for (const text of [undefined, 'not json', JSON.stringify({ steps: [{ step_id: 1, tool_calls: 'not a list' }] }), JSON.stringify({ steps: 'none' })]) {
			const read = historianToolCallsOf(text, FOLDER);
			expect.soft(read.findings.map((f) => f.code), String(text)).toEqual(['HISTORIAN_TOOL_CALLS_UNREADABLE']);
			expect.soft(read.findings[0]?.statement ?? '', String(text)).toContain('its tool calls could not be read from its export');
		}
	});

	it('⭑ CONTROL — an export with no tool call, as every export on disk at this version, reads no call and no finding', () => {
		expect(historianToolCallsOf(JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [{ step_id: 1, source: 'agent', message: '{}' }] }), FOLDER)).toEqual({
			calls: [],
			findings: []
		});
	});

	// ⭐⭐ L17b2 addendum (the lead's §27, item 5) — A READ OUTSIDE THE FOLDER, FAILING CLOSED. Besides its named path arguments, every other string
	// among a call's arguments — under any name, at any depth — that begins with `~`, is absolute, or holds a `..` segment is a path it names; a path
	// that begins with `~` is never inside (devin may expand it: D84 measures whether it does). Each allowed tool's argument names are D84's to measure.
	const insideOf = (calls: readonly { name: string; args: Record<string, unknown> }[]) => historianToolCallsOf(exportOf(calls), FOLDER);

	it('⛔ RED FIRST — a path that begins with “~” is read as outside the folder, under a named argument or any other', () => {
		const read = insideOf([
			{ name: 'read', args: { file_path: '~/notes.txt' } },
			{ name: 'grep', args: { pattern: 'key', path: '~' } },
			{ name: 'glob', args: { pattern: '*.md', root: '~user/docs' } }
		]);
		expect.soft(read.calls.map((c) => c.inside), 'a path that begins with “~” was read as inside the folder').toEqual([false, false, false]);
		expect.soft(read.findings.map((f) => f.code)).toEqual(['HISTORIAN_READ_OUTSIDE_FOLDER', 'HISTORIAN_READ_OUTSIDE_FOLDER', 'HISTORIAN_READ_OUTSIDE_FOLDER']);
		expect.soft(read.findings.map((f) => f.statement).join(' | '), 'a finding does not name its path').toMatch(/~\/notes\.txt.*: ~ .*~user\/docs/);
	});

	it('⛔ RED FIRST — a string argument under any name, at any depth, whose value is absolute and outside the folder is read as outside', () => {
		const elsewhere = join(tmpdir(), 'elsewhere');
		const read = insideOf([
			{ name: 'grep', args: { pattern: 'TODO', directory: elsewhere } },
			{ name: 'find_file_by_name', args: { pattern: '*.ts', options: { roots: [join(elsewhere, 'src')] } } }
		]);
		expect.soft(read.calls.map((c) => c.inside), 'an absolute place outside the folder, under another name or deeper, was not read').toEqual([false, false]);
		expect.soft(read.calls.map((c) => c.paths)).toEqual([[elsewhere], [join(elsewhere, 'src')]]);
		expect.soft(read.findings.map((f) => f.code)).toEqual(['HISTORIAN_READ_OUTSIDE_FOLDER', 'HISTORIAN_READ_OUTSIDE_FOLDER']);
		expect.soft(read.findings[1]?.statement ?? '', 'a finding does not name its path').toContain(join(elsewhere, 'src'));
	});

	it('⛔ RED FIRST — a string argument under any name, at any depth, with a “..” segment that climbs out of the folder is read as outside, “\\” a separator too', () => {
		const read = insideOf([
			{ name: 'glob', args: { pattern: '../**/*.md' } },
			{ name: 'grep', args: { pattern: 'secret', include: ['records', 'workspace\\..\\..\\elsewhere'] } }
		]);
		expect.soft(read.calls.map((c) => c.inside), 'a “..” that climbs out of the folder, under another name or deeper, was not read').toEqual([false, false]);
		expect.soft(read.calls.map((c) => c.paths)).toEqual([['../**/*.md'], ['workspace\\..\\..\\elsewhere']]);
		expect.soft(read.findings.map((f) => f.code)).toEqual(['HISTORIAN_READ_OUTSIDE_FOLDER', 'HISTORIAN_READ_OUTSIDE_FOLDER']);
	});

	it('⭑ CONTROL — what names no place outside the folder is not a finding: words, a relative pattern, a place inside under any name, a “..” that stays inside', () => {
		const read = insideOf([
			{ name: 'grep', args: { pattern: 'TODO|FIXME', path: 'records' } },
			{ name: 'grep', args: { pattern: 'a..b', glob: 'records/*.json' } },
			{ name: 'read', args: { file_path: join(FOLDER, 'records', 'INDEX.md') } },
			{ name: 'find_file_by_name', args: { pattern: '*.ts', root: join(FOLDER, 'workspace') } },
			{ name: 'read', args: { file_path: 'records/../records/INDEX.md' } }
		]);
		expect.soft(read.calls.map((c) => c.inside), 'a call that names no place outside the folder was read as reaching outside').toEqual([true, true, true, true, true]);
		expect.soft(read.findings, 'a finding where nothing reached outside').toEqual([]);
	});

	// ⭐⭐ L17b2, Stage 3b (the lead's §33, item 4; brief-3b item 3) — TESTS THE MUTANTS OWED. ⭑ EACH UNREADABLE SHAPE, ONE BY ONE, IN ITS OWN WORDS: the
	// test above reads four shapes for the finding's code and the words every shape shares, so a shape said in another's words, a step or a call that is
	// not an object read as one with no tool call (a clean bill), and a reader that throws on a null each SURVIVED every test. A read that throws is
	// caught here and shown as such, so that each shape fails at its own check. ⭑ EACH NAMED PATH ARGUMENT: no test read a call's recorded paths but for
	// a place outside the folder, which the fail-closed reader names under any argument — so each named argument, dropped, SURVIVED.
	it('⛔ RED FIRST — each unreadable shape of an export, one by one, is ONE finding, HISTORIAN_TOOL_CALLS_UNREADABLE, in its own words, and no call: no export; not JSON; JSON that is null; steps that are not a list; a step that is a word, null or a list; a step’s tool_calls that is not a list; a call that is a word, null or a list; a call naming no function — none, one that is not a string, an empty one; arguments that are not JSON; arguments that are a number, null or a list', () => {
		const steps = (...listed: unknown[]): string => JSON.stringify({ schema_version: 'ATIF-v1.7', steps: listed });
		const calls = (listed: unknown): string => steps({ step_id: 1, source: 'agent', tool_calls: listed });
		const call = (c: Record<string, unknown>): string => calls([{ tool_call_id: 'call_0', ...c }]);
		const shapes: readonly (readonly [string, string | undefined, string])[] = [
			['no export', undefined, 'there is no export'],
			['not JSON', 'not json', 'the export is not JSON'],
			['JSON that is null', 'null', 'its steps are not a list'],
			['steps that are a word', JSON.stringify({ steps: 'none' }), 'its steps are not a list'],
			['no steps', JSON.stringify({ schema_version: 'ATIF-v1.7' }), 'its steps are not a list'],
			['a step that is a word', steps('a step'), 'its step 1 is not an object'],
			['a step that is null', steps({ step_id: 1, source: 'agent' }, null), 'its step 2 is not an object'],
			['a step that is a list', steps([]), 'its step 1 is not an object'],
			['tool_calls that are a word', calls('not a list'), "its step 1's tool_calls is not a list"],
			['a call that is a word', calls(['read']), 'a call of its step 1 is not an object'],
			['a call that is null', calls([null]), 'a call of its step 1 is not an object'],
			['a call that is a list', calls([[]]), 'a call of its step 1 is not an object'],
			['a call with no name', call({ arguments: {} }), 'a call of its step 1 names no function'],
			['a call whose name is a number', call({ function_name: 7, arguments: {} }), 'a call of its step 1 names no function'],
			['a call whose name is empty', call({ function_name: '', arguments: {} }), 'a call of its step 1 names no function'],
			['arguments that are not JSON', call({ function_name: 'read', arguments: '{not json' }), 'a call of its step 1 has arguments that are not JSON'],
			['arguments that are a number', call({ function_name: 'read', arguments: 7 }), 'a call of its step 1 has arguments that are not an object'],
			['arguments that are null, as JSON', call({ function_name: 'read', arguments: 'null' }), 'a call of its step 1 has arguments that are not an object'],
			// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — and null itself, as the export writes
			// it: the row above is a string that parses to null, and so never reached the reader's default for arguments that are missing.
			['arguments that are null', call({ function_name: 'read', arguments: null }), 'a call of its step 1 has arguments that are not an object'],
			['arguments that are a list', call({ function_name: 'read', arguments: ['records'] }), 'a call of its step 1 has arguments that are not an object']
		];
		for (const [shape, text, words] of shapes) {
			let read: { readonly calls: readonly unknown[]; readonly findings: readonly { readonly code: string; readonly statement: string }[] };
			try {
				read = historianToolCallsOf(text, FOLDER);
			} catch (e) {
				read = { calls: ['the reader threw'], findings: [{ code: 'THE READER THREW', statement: String(e) }] };
			}
			expect.soft([read.calls.length, read.findings.map((f) => f.code)], `${shape}: not one unreadable finding and no call`).toEqual([0, ['HISTORIAN_TOOL_CALLS_UNREADABLE']]);
			expect.soft(read.findings[0]?.statement ?? '', `${shape}: the finding is not in its own words`).toBe(
				`its tool calls could not be read from its export: ${words}, so what it read is not known — never a clean bill (L17b2 ruling 17)`
			);
		}
	});

	// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — the row above refuses explicit null; a call
	// that gives no arguments at all is still a call with none, as a tool with no arguments is called.
	it('⭑ CONTROL — a call with no arguments field is read as a call with none: its name, no place, inside the folder, and no finding', () => {
		const read = historianToolCallsOf(JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [{ step_id: 1, source: 'agent', tool_calls: [{ tool_call_id: 'call_0', function_name: 'read' }] }] }), FOLDER);
		expect.soft(read.calls, 'a call with no arguments field was not read as a call with none').toEqual([{ name: 'read', paths: [], inside: true, allowed: true }]);
		expect.soft(read.findings, 'a call with no arguments field is a finding').toEqual([]);
	});

	it('⛔ RED FIRST — each argument a call names a place by is read for it, as the call gave it: file_path, path, notebook_path, cwd, and each string of the list paths', () => {
		const named: readonly (readonly [string, Record<string, unknown>, readonly string[]])[] = [
			['file_path', { file_path: 'records/INDEX.md' }, ['records/INDEX.md']],
			['path', { pattern: 'stdin', path: 'workspace' }, ['workspace']],
			['notebook_path', { notebook_path: 'workspace/notes.ipynb' }, ['workspace/notes.ipynb']],
			['cwd', { pattern: '*.md', cwd: 'records' }, ['records']],
			['paths', { pattern: 'stdin', paths: ['records', 7, 'workspace/src'] }, ['records', 'workspace/src']]
		];
		const read = insideOf(named.map(([, args]) => ({ name: 'grep', args })));
		for (const [i, [name, , paths]] of named.entries()) expect.soft(read.calls[i]?.paths, `${name}: not read for the place it names`).toEqual(paths);
		expect.soft(read.findings, '⭑ CONTROL — a place inside the folder, named, is a finding').toEqual([]);
	});
});
