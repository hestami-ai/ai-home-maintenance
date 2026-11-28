// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — design D86 (`REG-D-167` (3); the lead's rulings 2, 6, 8, 9, 16 and 17 on L17b2's Stage 0) — THE
// HISTORIAN IS A DEVIN SESSION WITH READ-ONLY TOOLS, IN A FRESH FOLDER OF COPIES.
//
// ⭑ ITS TOOLS, AT DEVIN 3000.11.234 (ruling 2): allowed `read`, `grep`, `find_file_by_name` — this version's read-only finder, in devin's own
// read-only group — and `glob` as D86 names it; every other name devin lists at that version, and MH-0a's names it does not offer,
// ~~disabled in the user configuration passed as `--config` AND denied by name in the folder's project configuration, beside `Fetch(*)` and
// `mcp__*`; `subagents_enabled: false`; the seven `read_config_from` false~~ ⭐ (L17b4, design D93; `REG-F-684`, `REG-D-197`: any `--config`
// file stalls devin 3000.11.234, so none is passed) denied by name in the folder's project configuration, beside `Fetch(*)` and `mcp__*`, and
// audited in the export. ⭐ L17b5 (`REG-D-199`; `REG-F-688`; D93's probe P4b) — and the seven `read_config_from` false come back, in the folder's
// project configuration beside its deny list, where P4b measured them stopping devin giving the call other agents' rules files and the user's
// always-on rule. ⭑ The lists are true of ONE version: before the call devin's version is read,
// and any other is not run (ruling 2 (A)). The 25 names below are that version's own listing (`agent.tool_definitions` of an export it wrote:
// all 673 exports on disk outside the run folders list the same 25 — L17b2 facts §2.4).
// ⭑ ITS FOLDER (ruling 8): `prompt.txt`, `.devin/config.json`, `records/` with `records/INDEX.md`, `workspace/` (a copy of the shared
// workspace); beside it a host folder with ~~the `--config` file and~~ ⭐ (L17b4, D93) the export alone, outside what it may read; both removed
// after the call.
// ⭑ ⭐ L17b4 (D93; `REG-F-685`) — A CALL THAT FAILS IS RECORDED BY ITS KIND ALONE, the reviewer's one definition (`devinFailureRecord`):
// never devin's own words, which hold its command line and its login banner; and its export is read on failure as on success.
// ⭑ ITS EXPORT (rulings 2 (B), 17): each tool call read for its name and its paths; a read outside the folder, and a tool not allowed, are
// findings on the assessment; an export whose calls cannot be read is a finding too, never a clean bill. ⚠ The shape read —
// `steps[].tool_calls[].function_name` and `arguments` — is the multi-harness design's reading of ATIF; no export on disk records a call at
// this version, so D84's measurement confirms it.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// ⭐ L17b6 (design D94) — ~~`import { afterAll, describe, expect, it } from 'vitest';`~~: and `afterEach` and `vi`, for the ACP call's tests, which point
// PATH at no program (`noProgramsDirectory`; the lead's §39 on §38.1, item 7).
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryWorkspace } from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
// ⭐ L17b6 (D94) — the fake of devin's ACP server (`assurance/devin-acp-fake.testing.ts`, the lead's §39, Q14), the PATH that finds no program, and the
// Historian's reader, which T6 reads the last message by. The call's new names are read through the module (`historianTool`), so that before the code
// lands only the tests that use them are red, never the file's load.
import {
	execNotice,
	FAKE_HOME,
	FAKE_SESSION,
	fakeAcp,
	PROBE_B_OPTIONS,
	readNotice,
	searchNotice,
	updateNotice,
	type FakeAcpEvent,
	type FakeAcpScript
} from '../assurance/devin-acp-fake.testing.js';
import * as historianReader from '../assurance/historian.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import * as historianTool from './devin-historian.js';
// ⭐ L17b6 (D94) — ~~`import type { HistorianExec } from './devin-historian.js';`~~: the call's program is its ACP child's spawn (`HistorianSpawn`).
import type { HistorianCallOutcome, HistorianFolder } from './devin-historian.js';
import {
	DEVIN_HISTORIAN_MEASURED_VERSION,
	HISTORIAN_ALLOWED_TOOLS,
	HISTORIAN_BOUND_UNSET,
	HISTORIAN_CALL_MS_VARIABLE,
	HISTORIAN_DISABLED_TOOLS,
	HISTORIAN_PROJECT_CONFIG,
	// ⭐ L17b4 (design D93; the lead's L4-Q1) — ~~`HISTORIAN_USER_CONFIG,`~~: no user configuration is passed (REG-D-197).
	HistorianCopyRefusal,
	NOT_TEXT_NOT_COPIED,
	devinHistorianCall,
	historianCallBound,
	historianToolCallsOf,
	// ⭐ L17b4 (the lead's §15.5 (b)) — the one wording of the version rule, held where a reply names a version.
	historianVersionRefusal,
	historianWorkspaceFiles,
	recordNameClash,
	workspaceCopyClash,
	writeHistorianFolder
} from './devin-historian.js';
import { DEVIN_FREE_TIER_REFUSAL, DEVIN_OUTPUT_LIMIT } from './devin-reviewer.js';

/** devin 3000.11.234's own tool listing, as an export it wrote holds it (the fixture ruling 2 (A) names). */
const EXPORT_TOOL_NAMES_3000_11_234 = [
	'ask_user_question', 'browser_preview', 'close_browser_preview', 'edit', 'exec', 'find_file_by_name', 'get_output', 'grep', 'kill_shell',
	'mcp_call_tool', 'mcp_list_servers', 'mcp_list_tools', 'mcp_read_resource', 'notebook_edit', 'notebook_read', 'read', 'read_subagent',
	'request_scope', 'run_subagent', 'skill', 'todo_write', 'web_search', 'webfetch', 'write', 'write_to_process'
] as const;
/** MH-0a's `disabled_tools` names that 3000.11.234 does not offer the selected model (DESIGN-multi-harness-executor.md §4.1). */
const MH0A_NOT_OFFERED = ['code_search', 'apply_patch', 'shell_command', 'view_image'] as const;
// ⭐ L17b4 (design D93; the lead's L4-Q1) — ~~`const READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;`~~:
// no user configuration is passed, ~~so no read_config_from switch is set (REG-D-197)~~; ~~what devin reads of other agents' configuration is measured by
// D93's probes P4a and P4b, not assumed~~. ⭐ L17b5 (`REG-D-199`; `REG-F-688`; D93's probe P4b) — measured, and acted on: P4a found devin given other
// agents' rules files at its folder's top and the machine user's always-on rule, and P4b that the seven switches, each false, in the folder's project
// configuration stop both. So they are set there now (`HISTORIAN_PROJECT_CONFIG`), held by the test below to P4b's measured file.
/** ⭐ L17b5 (D93's probe P4b; `l17b4/l17b4-facts.md` §24, §25; `REG-D-199`) — the project configuration P4b measured holding: its length, and its sha256. */
const P4B_PROJECT_CONFIG = { length: 830, sha256: '40746e5c4d1e21146b4a558d1d51578a75a1e6fc6e2c0f370074b0e5b7624551' } as const;
/** ⭐ L17b5 — D86's seven places devin reads other agents' configuration from, in D86's order (MH-0a), each to be false. */
const D86_READ_CONFIG_FROM = ['cursor', 'windsurf', 'claude', 'opencode', 'zed', 'copilot', 'agents_standard'] as const;

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();
const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
// ⭐⭐ L17b6 (design D94; the lead's §39 on §38.1, item 7) — EVERY TEST OF THIS FILE RUNS WITH PATH POINTED AT NO PROGRAM: the Historian's call now starts
// its child itself (`historianAcpSpawn`) wherever its seam gives none, and the paid devin is on this machine's PATH (`assurance/no-programs.testing.ts`),
// so neither a test that passes the seam by nor a mutant that does can start it.
beforeEach(() => {
	vi.stubEnv('PATH', noProgramsDirectory());
});
afterEach(() => {
	vi.unstubAllEnvs();
});

// ⭐⭐ L17b4 (design D93; `REG-F-685`; the lead's L4-Q2) — A FAILED CALL'S RECORD: its kind alone, and each known phrase by its name, in the lead's words.
// ⭐ L17b6 (D94; the lead's §39, Q10) — ~~`/** The record of a failed devin call of `kind` (and its names), as the lead worded it. */ const recordOf = (kind:
// string): string => `devin invocation failed (${kind}). Its diagnostic is not recorded (PER-12): execFile's message holds devin's command line, which
// names the ` + "call's folder, and devin's stderr, which holds its login banner (REG-F-685).";`~~ — the Historian's call no longer runs execFile, so its
// failures are recorded by the ACP call's own definition (`acpRecordOf`, below); the reviewer's record is held by `devin-reviewer.test.ts`.
/** ⭐ L17b6 (D94; the lead's §39, Q10) — the record of a failed ACP call of `kind`: its own definition, beside the reviewer's, whose words name execFile. */
const acpRecordOf = (kind: string): string =>
	`devin acp failed (${kind}). Its words are not recorded (PER-12): devin’s messages name its configuration’s path under the home folder, and its ` +
	'errors may hold its login banner (REG-F-685); its standard error is never read (REG-Q-066).';
/** A home folder named `fixture`, its parts joined here, so that no line of this file holds an absolute path. */
const FIXTURE_HOME = ['C:', 'Users', 'fixture'].join('\\');
/** What devin's stderr opens with: its login banner, with a made-up address at example.invalid. */
const BANNER = ' ✓ Logged in as fixture@example.invalid.\n ✓ Organization: Your Organization\n';
/** Text shaped as an e-mail address. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** What node's `execFile` rejects with when devin fails: the command line, its folder under the home folder, then devin's stderr, in its message. */
function devinRejection(o: { readonly code?: unknown; readonly signal?: unknown; readonly killed?: boolean; readonly syscall?: string; readonly stderr?: string }): Error {
	const folder = [FIXTURE_HOME, 'AppData', 'Local', 'Temp', 'jpwb-historian-fixture'].join('\\');
	const cmd = `devin --print --model swe-2-max --prompt-file ${folder}\\prompt.txt --export ${folder}.host\\export.json --respect-workspace-trust false`;
	const stderr = `${BANNER}${o.stderr ?? ''}`;
	return Object.assign(new Error(`Command failed: ${cmd}\n${stderr}`), {
		code: o.code ?? null,
		killed: o.killed ?? false,
		signal: o.signal ?? null,
		cmd,
		stdout: '',
		stderr,
		...(o.syscall === undefined ? {} : { syscall: o.syscall })
	});
}
/** The three a record must never hold: execFile's own words, the home folder, and text shaped as an e-mail address. */
function holdsNoneOfTheThree(text: string, what: string): void {
	expect.soft(text, `${what} holds execFile's words`).not.toContain('Command failed');
	expect.soft(text, `${what} holds the home folder`).not.toContain(FIXTURE_HOME);
	expect.soft(text, `${what} holds an e-mail address`).not.toMatch(EMAIL);
}

// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q1, L4-Q10): ~~'⭐⭐ L17b2 (D86; ruling 2) — the Historian’s two configurations, at devin 3000.11.234'~~
// — it is given one configuration now, its folder's, as no user configuration is passed (REG-D-197).
describe('⭐⭐ L17b2 (D86; ruling 2) — the Historian’s project configuration, at devin 3000.11.234 (L17b4: no user configuration, D93)', () => {
	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q1, L4-Q10): ~~'⛔ RED FIRST — every tool that version names is allowed, or both disabled and
	// denied; the allowed are the three D86 names with this version’s finder'~~ — no user configuration is passed (REG-D-197), so a tool that is not
	// allowed is held by the folder's project configuration alone, denied by name, and by the audit of the export.
	it('⛔ RED FIRST — every tool that version names is allowed, or denied by name in the project configuration; the allowed are the three D86 names with this version’s finder', () => {
		expect(DEVIN_HISTORIAN_MEASURED_VERSION).toBe('3000.11.234');
		expect.soft(sorted(HISTORIAN_ALLOWED_TOOLS), 'the allowed tools').toEqual(sorted(['read', 'grep', 'find_file_by_name', 'glob']));
		// ⭐ L17b4 — ~~`const user = JSON.parse(HISTORIAN_USER_CONFIG) as { disabled_tools?: string[] };`~~ (REG-D-197).
		const project = JSON.parse(HISTORIAN_PROJECT_CONFIG) as { permissions?: { deny?: string[] } };
		// ⭐ L17b4 — ~~`const disabled = new Set(user.disabled_tools ?? []);`~~
		const denied = new Set(project.permissions?.deny ?? []);
		for (const name of EXPORT_TOOL_NAMES_3000_11_234) {
			const allowed = HISTORIAN_ALLOWED_TOOLS.includes(name);
			// ⭐ L17b4 — ~~`expect.soft(allowed || (disabled.has(name) && denied.has(name)), `${name} is neither allowed nor both disabled and denied`).toBe(true);`~~
			expect.soft(allowed || denied.has(name), `${name} is neither allowed nor denied by name`).toBe(true);
			// ⭐ L17b4 — ~~`if (allowed) expect.soft(disabled.has(name) || denied.has(name), `${name} is allowed and still disabled or denied`).toBe(false);`~~
			if (allowed) expect.soft(denied.has(name), `${name} is allowed and still denied`).toBe(false);
		}
		const expectedDisabled = [...EXPORT_TOOL_NAMES_3000_11_234.filter((n) => !HISTORIAN_ALLOWED_TOOLS.includes(n)), ...MH0A_NOT_OFFERED];
		expect.soft(sorted(HISTORIAN_DISABLED_TOOLS), 'the 26 disabled names').toEqual(sorted(expectedDisabled));
		// ⭐ L17b4 — ~~`expect.soft(sorted(disabled), 'the user configuration’s disabled_tools').toEqual(sorted(expectedDisabled));`~~
		expect.soft(sorted(denied), 'the project configuration’s deny list').toEqual(sorted([...expectedDisabled, 'Fetch(*)', 'mcp__*']));
	});

	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q1, L4-Q10): ~~'⛔ RED FIRST — the user configuration: subagents off, the seven read_config_from
	// off; both files two-space JSON with a closing line break'~~ — its user configuration's checks are struck under REG-D-197, as P6X-L17B2-M17 is
	// abolished: no user configuration is passed. Subagents are held by the deny list above, `run_subagent` and `read_subagent` denied by name; the
	// project configuration's form stays.
	// ⭐ L17b5 (`REG-D-199`; `REG-F-688`; D93's probe P4b) — and the `read_config_from` check comes back, in the folder's project configuration, where
	// P4b measured it holding: the test after this one, which holds the configuration to P4b's measured file. P6X-L17B2-M17 stays abolished; the new
	// entries guard what it guarded.
	it('⛔ RED FIRST — the project configuration: two-space JSON with a closing line break (its user configuration’s checks struck under REG-D-197)', () => {
		// ⭐ L17b4 — ~~`const user = JSON.parse(HISTORIAN_USER_CONFIG) as { subagents_enabled?: unknown; read_config_from?: Record<string, unknown> };`~~
		// ~~`expect.soft(user.subagents_enabled).toBe(false);`~~
		// ~~`expect.soft(user.read_config_from).toEqual(Object.fromEntries(READ_CONFIG_FROM.map((k) => [k, false])));`~~
		// ~~`for (const [name, text] of [['user', HISTORIAN_USER_CONFIG], ['project', HISTORIAN_PROJECT_CONFIG]] as const)`~~
		for (const [name, text] of [['project', HISTORIAN_PROJECT_CONFIG]] as const)
			expect.soft(text, `the ${name} configuration’s form`).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L17b5 — design D93 as amended (`REG-D-199`; `REG-F-688`; `l17b4/l17b4-facts.md` §24, §25) — THE GUARD RESTORED: the
	// folder's project configuration holds `read_config_from`, D86's seven keys in D86's order, each false, beside its deny list, unchanged. D93's probe
	// P4b measured that they stop devin giving the call other agents' rules files at its folder's top and the machine user's always-on rule. So the
	// configuration is held to P4b's measured file, byte for byte, by its length and its sha256 (`P4B_PROJECT_CONFIG`).
	it('⛔ RED FIRST — L17b5 (REG-D-199; REG-F-688): the project configuration is P4b’s measured file byte for byte, its read_config_from D86’s seven keys in their order, each false', () => {
		expect
			.soft(
				[Buffer.byteLength(HISTORIAN_PROJECT_CONFIG, 'utf8'), createHash('sha256').update(HISTORIAN_PROJECT_CONFIG, 'utf8').digest('hex')],
				'the project configuration is not P4b’s measured file, byte for byte'
			)
			.toEqual([P4B_PROJECT_CONFIG.length, P4B_PROJECT_CONFIG.sha256]);
		const project = JSON.parse(HISTORIAN_PROJECT_CONFIG) as { read_config_from?: Record<string, unknown> };
		expect
			.soft(Object.entries(project.read_config_from ?? {}), 'its read_config_from is not D86’s seven keys, in their order, each false')
			.toEqual(D86_READ_CONFIG_FROM.map((k) => [k, false]));
	});
});

describe('⭐⭐ L17b2 (D86; rulings 8, 9) — the Historian’s folder', () => {
	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q1, L4-Q10): ~~'⛔ RED FIRST — a fresh folder holding the prompt, its project configuration, its
	// records with their index, and a copy of the workspace; its configuration and export in a host folder beside it'~~ — no user configuration is
	// written (REG-D-197): the host folder holds the export alone, which devin writes, and nothing before the call.
	it('⛔ RED FIRST — a fresh folder holding the prompt, its project configuration, its records with their index, and a copy of the workspace; beside it a host folder for its export, empty before the call', async () => {
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
		// ⭐ L17b4 (D93; REG-D-197) — ~~`expect.soft(readFileSync(f.userConfigPath, 'utf8')).toBe(HISTORIAN_USER_CONFIG);`~~
		// ~~`expect.soft(f.userConfigPath.startsWith(f.host) && f.exportPath.startsWith(f.host), 'the configuration and the export are not in the host folder').toBe(true);`~~
		expect.soft(readdirSync(f.host), 'the host folder holds nothing before the call').toEqual([]);
		expect.soft('userConfigPath' in f, 'the folder names a user configuration').toBe(false);
		expect.soft(f.exportPath.startsWith(f.host), 'the export is not in the host folder').toBe(true);
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

	// ⭐ RESTATED (L17b4, design D93; the lead's L4-Q10): ~~'⛔ RED FIRST — devin is called in the folder, its prompt, export and configuration named,
	// at the time bound, and the export read before the folder and its host are removed'~~ — any `--config` file stalls devin 3000.11.234 on this host
	// (REG-F-684), so the Historian is launched without one, in the reviewer's form, its export kept outside the folder (REG-D-197).
	// ⭐ RESTATED (L17b6, design D94; the lead's §39): ~~'⛔ RED FIRST — devin is called in the folder, its prompt and export named and no --config, at
	// the time bound, and the export read before the folder and its host are removed'~~ — the Historian speaks devin's ACP server now: its prompt is sent
	// in its session, no export is written or read, and its session is deleted after its turn (REG-D-202, REG-D-203). Its checks kept, each restated.
	it('⛔ RED FIRST — devin is called in the folder as devin acp, its model named and no --config, its prompt sent in its session, at the time bound, and its session deleted before the folder and its host are removed', async () => {
		const f = await aFolder();
		const fake = fakeAcp({ turn: [{ message: '{"findings":[]}' }, { end: 'end_turn' }] });
		const out = await devinHistorianCall({ folder: f, model: 'swe-2-max', boundMs: 600_000 }, { spawn: fake.spawn, versionOf: async () => 'devin 3000.11.234 (92c83011d113)' });
		const launch = fake.launches[0];
		// ⭐ L17b6 (D94) — ~~`['--print', '--model', 'swe-2-max', '--prompt-file', f.promptPath, '--export', f.exportPath, '--respect-workspace-trust', 'false']`~~
		expect.soft(fake.launches.map((l) => l.args), 'the argv').toEqual([['acp', '--model', 'swe-2-max']]);
		expect.soft(launch?.args ?? [], 'devin is named a --config file').not.toContain('--config');
		expect.soft(launch?.cwd, 'devin’s working folder').toBe(f.folder);
		expect.soft(launch?.boundMs, 'the time bound').toBe(600_000);
		expect.soft(fake.received.find((m) => m.method === 'session/prompt')?.params, 'its prompt is not sent in its session').toEqual({
			sessionId: FAKE_SESSION,
			prompt: [{ type: 'text', text: 'P' }]
		});
		expect.soft(fake.methods().at(-1), 'its session is not deleted after its turn').toBe('session/delete');
		// ⭐ L17b6 — ~~`expect.soft(out).toMatchObject({ ran: true, stdout: '{"findings":[]}', sessionExport: '{"schema_version":"ATIF-v1.7","steps":[]}' });`~~
		expect.soft(out).toMatchObject({ ran: true, lastMessage: '{"findings":[]}' });
		expect.soft(existsSync(f.folder), 'the folder was kept').toBe(false);
		expect.soft(existsSync(f.host), 'the host folder was kept').toBe(false);
	});

	it('⛔ RED FIRST — any devin version but the one whose tools were measured is not run, both named; and the folder is removed', async () => {
		const f = await aFolder();
		let called = false;
		// ⭐ L17b6 (D94) — ~~`exec: async () => ((called = true), { stdout: '' })`~~: the program is the ACP child's spawn.
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
			{ spawn: (l) => ((called = true), fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn(l)), versionOf: async () => 'devin 3000.11.300 (abc)' }
		);
		expect.soft(called, 'devin was called at another version').toBe(false);
		expect.soft(out.ran).toBe(false);
		expect.soft(out.ran ? '' : out.why).toContain('3000.11.300');
		expect.soft(out.ran ? '' : out.why).toContain('3000.11.234');
		expect.soft(existsSync(f.folder) || existsSync(f.host), 'a folder was kept').toBe(false);
	});

	it('⛔ RED FIRST — a call devin fails is the call’s failure, named; the folder is removed all the same', async () => {
		const f = await aFolder();
		// ⭐ L17b6 (D94) — ~~`{ exec: async () => { throw new Error('devin exited 2'); }, … }`~~: devin's ACP server answers the prompt with an error, its
		// message the words the old program threw.
		const fake = fakeAcp({ turn: [], errors: { 'session/prompt': { code: -32603, message: 'devin exited 2' } } });
		const out = await devinHistorianCall({ folder: f, model: 'swe-2-max', boundMs: 600_000 }, { spawn: fake.spawn, versionOf: async () => 'devin 3000.11.234 (92c83011d113)' });
		// ⭐ RESTATED (L17b4, design D93; REG-F-685): ~~`expect.soft(out.ran && out.failure).toContain('devin exited 2');`~~ — the call's failure is
		// named by its kind alone, never by the words it was thrown with: ~~a throw with no exit code, signal or error code is that kind~~ ⭐ (L17b6) an
		// error answered to its prompt, by its code (§39, Q10): ~~`.toBe(recordOf('failed with no exit code, signal or error code'))`~~.
		expect.soft(out.ran && out.failure, 'the failure is not named by its kind alone').toBe(acpRecordOf('answered session/prompt with error code -32603'));
		expect.soft(out.ran && out.failure, 'the call’s own words are recorded').not.toContain('devin exited 2');
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
		// ⭐ L17b6 (D94) — ~~`{ exec: async () => ({ stdout: '{"findings":[]}' }), … }`~~: devin's ACP server, answering it.
		const answering = () => fakeAcp({ turn: [{ message: '{"findings":[]}' }, { end: 'end_turn' }] }).spawn;
		const out = await devinHistorianCall(
			{ folder: { ...f, folder: kept }, model: 'swe-2-max', boundMs: 600_000 },
			{ spawn: answering(), versionOf: async () => 'devin 3000.11.234 (92c83011d113)' }
		);
		expect.soft(out.folderNotRemoved ?? '', 'a folder that could not be removed is not said, named with why').toContain(`${kept} could not be removed: `);
		// ⭐ L17b6 — ~~`out.stdout`~~: its last message.
		expect.soft(out.ran && out.failure === undefined ? out.lastMessage : 'no answer', 'the call’s own outcome does not stand beside it').toBe('{"findings":[]}');
		expect.soft(existsSync(f.host), 'the host folder was kept: the removal stopped at the folder that failed').toBe(false);
		const g = await aFolder();
		const clean = await devinHistorianCall({ folder: g, model: 'swe-2-max', boundMs: 600_000 }, { spawn: answering(), versionOf: async () => 'devin 3000.11.234 (92c83011d113)' });
		expect.soft('folderNotRemoved' in clean, '⭑ CONTROL — both folders removed, and one is said to be kept').toBe(false);
	});

	it('⛔ RED FIRST — a `devin --version` that throws: the Historian is not run, saying that its version could not be read and why; devin is never called; and the folder is removed', async () => {
		const f = await aFolder();
		let called = false;
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			{
				// ⭐ L17b6 (D94) — ~~`exec: async () => ((called = true), { stdout: '' }),`~~
				// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
				spawn: (l) => ((called = true), fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn(l)),
				versionOf: async () => {
					throw new Error('spawn devin ENOENT');
				}
			}
		);
		expect.soft(called, 'devin was called though its version could not be read').toBe(false);
		expect.soft(out.ran, 'the Historian ran though its version could not be read').toBe(false);
		const why = out.ran ? '' : out.why;
		// ⭐ RESTATED (L17b4, design D93; the lead's §13.3 (a)): ~~`[why.includes('version could not be read (devin --version: '), why.includes('spawn devin
		// ENOENT'), why.includes(DEVIN_HISTORIAN_MEASURED_VERSION)],`~~ … ~~`).toEqual([true, true, true]);`~~ — the read's failure is recorded by its kind
		// alone (REG-F-685), so the words it was thrown with are no longer in why: a plain Error is none of the kinds, and says so.
		expect.soft(
			[
				why.includes(
					"version could not be read (devin --version: failed with no exit code, signal or error code; devin's own words are not recorded, REG-F-685)"
				),
				why.includes('spawn devin ENOENT'),
				why.includes(DEVIN_HISTORIAN_MEASURED_VERSION)
			],
			`why it is not run does not say that its version could not be read, why, and the version its tools were measured at: ${why}`
		).toEqual([true, false, true]);
		expect.soft(existsSync(f.folder) || existsSync(f.host), 'a folder was kept').toBe(false);
	});
});

// ⭐⭐ L17b4 — design D93 (`REG-F-685`; the lead's L4-Q2, L4-Q3) — THE HISTORIAN'S FAILED CALL IS RECORDED BY ITS KIND ALONE, by the one definition the
// reviewer's adapter holds (`devinFailureRecord`): an exit by its code, a kill by its signal (and its bound only where execFile made the kill), a
// start that failed by the spawn's code; and devin's two fixed phrases by their names — never devin's own words, whose command line names the call's
// folder under the home folder and whose stderr holds its login banner. ⭑ And its export is still read on failure, as on success (a control).
// ⭐ RESTATED (L17b6, design D94; the lead's §39, Q10): ~~'⭐⭐ L17b4 (D93; REG-F-685) — the Historian’s failed call records its kind alone; its export
// is read on failure as on success'~~ — no export is written or read over ACP: the calls the session saw are kept on failure as on success, and a
// failure is recorded by the ACP call's own definition (`historianAcpFailureRecord`), its kind alone.
describe('⭐⭐ L17b4 (D93; REG-F-685), as L17b6 (D94) restates it — the Historian’s failed call records its kind alone; the calls it saw are kept on failure as on success', () => {
	const VERSION = 'devin 3000.11.234 (92c83011d113)';
	/** A fresh folder to call over. */
	const aFolder = async () => {
		const f = await writeHistorianFolder({ prompt: 'P', records: [], workspaceFiles: [] });
		dirs.push(f.folder, f.host);
		return f;
	};
	/** ⭐ The lead's §41 — the waits after the bound, a few milliseconds here. */
	const SHORT = { cancelGraceMs: 50, deleteWaitMs: 50, stopWaitMs: 20 } as const;
	/**
	 * ⭐ L17b6 (D94) — what the call's outcome records when devin's ACP server, the fake, runs `script`, at `boundMs`. ~~What the call's outcome records when
	 * its program throws `thrown`, at the call's bound of 600,000 ms~~ (`exec`'s throw): over ACP a failure is the session's — an exit, the bound, a start
	 * that failed, an error answered.
	 */
	const failedWith = async (script: FakeAcpScript, boundMs = 600_000): Promise<string> => {
		const f = await aFolder();
		const out = await devinHistorianCall({ folder: f, model: 'swe-2-max', boundMs }, { spawn: fakeAcp(script).spawn, versionOf: async () => VERSION, waits: SHORT });
		return out.ran ? (out.failure ?? '(no failure recorded)') : `(not run: ${out.why})`;
	};
	/** ⭐ L17b6 — what the call's outcome records when its spawn throws `thrown`: the seam's own throw (D84's refusal is one). */
	const startThrows = async (thrown: unknown): Promise<string> => {
		const f = await aFolder();
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			{
				spawn: () => {
					throw thrown;
				},
				versionOf: async () => VERSION,
				waits: SHORT
			}
		);
		return out.ran ? (out.failure ?? '(no failure recorded)') : `(not run: ${out.why})`;
	};
	/** ⭐ L17b6 — an error devin's server answers to the prompt, its message holding a home folder and a login banner (constructed: no log holds one). */
	const erring = (message: string): FakeAcpScript => ({ turn: [], errors: { 'session/prompt': { code: -32603, message } } });

	it('⛔ RED FIRST — L17b4 (D93; REG-F-685): a call devin exits from, is killed during at its own bound, or could not start records its kind alone — no command line, no home folder, no e-mail address', async () => {
		// ⭐ L17b6 (D94) — ~~`const exit = devinRejection({ code: 1, stderr: 'Error: the session ended\n' });`~~ and execFile's three rejections, ~~each
		// `recordOf(…)`~~: over ACP, devin's server exits before the prompt's answer, the turn runs past its bound, the start fails, or an error is answered
		// whose message holds the three (`erring`).
		const words = `${BANNER}Error: the session ended under ${FIXTURE_HOME}\\AppData`;
		expect([words.includes(FIXTURE_HOME), EMAIL.test(words)], 'arrangement: the error’s words hold a home folder and an e-mail address').toEqual([true, true]);
		const cases: readonly (readonly [string, FakeAcpScript, number, string])[] = [
			['an exit', { turn: [{ exit: 1 }] }, 600_000, acpRecordOf('ended before it answered session/prompt: exited with code 1')],
			['a kill at its bound', { turn: [{ hold: true }] }, 300, acpRecordOf('at its time bound of 300 ms')],
			['a start that failed', { turn: [], startError: 'ENOENT' }, 600_000, acpRecordOf('ended before it answered initialize: could not start: ENOENT')],
			['an error answered', erring(words), 600_000, acpRecordOf('answered session/prompt with error code -32603')]
		];
		for (const [what, script, boundMs, record] of cases) {
			const failure = await failedWith(script, boundMs);
			expect.soft(failure, `${what}: its record is not its kind alone`).toBe(record);
			holdsNoneOfTheThree(failure, `${what}'s record`);
		}
	});

	it('⛔ RED FIRST — L17b4 (D93; the lead’s L4-Q2, its departure): the two fixed phrases are named on the Historian’s path too, never quoted', async () => {
		// ⭐ L17b6 (D94; §39, Q10) — ~~`failedWith(devinRejection({ code: 1, stderr: … }))`~~, ~~`recordOf('exited with code 1; …')`~~: the phrases come in an
		// error devin's server answers, read by their presence and named.
		const refused = await failedWith(erring(`Agent error: Reached ${DEVIN_FREE_TIER_REFUSAL}. Try again later.`));
		expect.soft(refused, 'the free tier’s refusal is not named').toBe(acpRecordOf('answered session/prompt with error code -32603; devin refused it for its free tier (D46)'));
		const cut = await failedWith(erring(`${DEVIN_OUTPUT_LIMIT}. The output above is incomplete.`));
		expect.soft(cut, 'the output limit is not named').toBe(acpRecordOf("answered session/prompt with error code -32603; its reply reached the model's output limit"));
		for (const [what, text] of [['the refusal', refused], ['the cut', cut]] as const) {
			expect.soft(text, `${what}'s phrase is quoted`).not.toContain(what === 'the refusal' ? DEVIN_FREE_TIER_REFUSAL : DEVIN_OUTPUT_LIMIT);
			holdsNoneOfTheThree(text, `${what}'s record`);
		}
	});

	// ⭐⭐ L17b4 — design D93 (`REG-F-685`; the lead's §13.3 (a)) — A THIRD DEVIN PATH: THE VERSION READ. Its failure is recorded by its kind alone, by the
	// one definition (`devinFailureKindAndNames`), at the read's own bound of 30 s — never execFile's message, which names the program's own path (under
	// the home folder where its override sets it, or a start fails) and holds devin's stderr.
	/** The program a version read runs, at a made-up path under the fixture's home folder. */
	const VERSION_PROGRAM = [FIXTURE_HOME, 'tools', 'devin.exe'].join('\\');
	/** What execFile rejects with when `devin --version` fails: its command line, the program's path in it, then devin's stderr, its login banner first. */
	const versionRejection = (o: { readonly code?: unknown; readonly signal?: unknown; readonly killed?: boolean; readonly stderr?: string }): Error => {
		const cmd = `${VERSION_PROGRAM} --version`;
		const stderr = `${BANNER}${o.stderr ?? ''}`;
		return Object.assign(new Error(`Command failed: ${cmd}\n${stderr}`), {
			code: o.code ?? null,
			killed: o.killed ?? false,
			signal: o.signal ?? null,
			cmd,
			stdout: '',
			stderr
		});
	};
	/** Why the Historian is not run when its version read fails with `kind`, in the lead's words (§13.3 (a)). */
	const versionWhy = (kind: string): string =>
		`devin's version could not be read (devin --version: ${kind}; devin's own words are not recorded, REG-F-685), and the Historian's two tool ` +
		`lists are true of the version they were measured at, ${DEVIN_HISTORIAN_MEASURED_VERSION}: so it is not run (L17b2 ruling 2 (A))`;

	it('⛔ RED FIRST — L17b4 (D93; the lead’s §13.3 (a)): a `devin --version` read that fails, its error holding a command line under a home folder and a login banner, records its kind alone, a kill at the read’s own bound of 30 s — the Historian is not run, and why holds none of the three', async () => {
		const exit = versionRejection({ code: 1, stderr: 'Error: the version could not be printed\n' });
		expect([exit.message.includes('Command failed'), exit.message.includes(FIXTURE_HOME), EMAIL.test(exit.message)], 'arrangement: the rejection holds all three').toEqual([
			true,
			true,
			true
		]);
		const spawn = Object.assign(new Error(`spawn ${VERSION_PROGRAM} ENOENT`), {
			code: 'ENOENT',
			errno: -4058,
			syscall: `spawn ${VERSION_PROGRAM}`,
			path: VERSION_PROGRAM,
			spawnargs: ['--version']
		});
		const cases: readonly (readonly [string, unknown, string])[] = [
			['an exit', exit, versionWhy('exited with code 1')],
			['a kill at its bound', versionRejection({ killed: true, signal: 'SIGTERM' }), versionWhy('killed by SIGTERM, at its time bound of 30000 ms')],
			['a start that failed', spawn, versionWhy('could not start: ENOENT')]
		];
		for (const [what, thrown, why] of cases) {
			const f = await aFolder();
			let called = false;
			const out = await devinHistorianCall(
				{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
				{
					// ⭐ L17b6 (D94) — ~~`exec: async () => ((called = true), { stdout: '' }),`~~
					// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
					spawn: (l) => ((called = true), fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn(l)),
					versionOf: async () => {
						throw thrown;
					}
				}
			);
			expect.soft(called, `${what}: devin was called though its version could not be read`).toBe(false);
			const said = out.ran ? '(it ran)' : out.why;
			expect.soft(said, `${what}: the version read’s failure is not recorded by its kind alone`).toBe(why);
			holdsNoneOfTheThree(said, `${what}’s reason`);
		}
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.5 (finding 3; paired writers share one definition) — THE VERSION READ'S FAILURE, WORDED ONCE: the Historian's
	// call (`callIn`) and D84's print-mode probes (`measurement/d84-probes.ts`, `probeCallIn`, held by `d84-probes.test.ts`) each word it by
	// `historianVersionReadFailure`, its words byte for byte the lead's (§13.3 (a)), so that the two can never word it apart.
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §43.5): the version read’s failure is worded once (`historianVersionReadFailure`), in the lead’s words byte for byte, and the call’s reason is it — an exit, a kill at its bound, and a start that failed', async () => {
		const cases: readonly (readonly [string, unknown, string])[] = [
			['an exit', versionRejection({ code: 1, stderr: 'Error: the version could not be printed\n' }), 'exited with code 1'],
			['a kill at its bound', versionRejection({ killed: true, signal: 'SIGTERM' }), 'killed by SIGTERM, at its time bound of 30000 ms'],
			['a start that failed', Object.assign(new Error(`spawn ${VERSION_PROGRAM} ENOENT`), { code: 'ENOENT', syscall: `spawn ${VERSION_PROGRAM}` }), 'could not start: ENOENT']
		];
		for (const [what, thrown, kind] of cases) {
			expect.soft(historianTool.historianVersionReadFailure(thrown), `${what}: the one definition is not in the lead’s words`).toBe(versionWhy(kind));
			const f = await aFolder();
			const out = await devinHistorianCall(
				{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
				{
					// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
					spawn: (l) => fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn(l),
					versionOf: async () => {
						throw thrown;
					}
				}
			);
			expect.soft(out.ran ? '(it ran)' : out.why, `${what}: the call’s reason is not the one definition’s`).toBe(historianTool.historianVersionReadFailure(thrown));
		}
	});

	// ⭐⭐ L17b4 — design D93 (the lead's §15.5 (b); the review's question, confirmed) — A `devin --version` REPLY THAT HOLDS NO VERSION IS NAMED BY ITS
	// LENGTH, NEVER ITS WORDS: the reply is devin's, unmeasured, and may open with its login banner. ⭑ A reply that names another version is named by that
	// version, as before (a control).
	it('⛔ RED FIRST — L17b4 (§15.5 (b)): a `devin --version` reply that holds no version leaves the Historian not run, naming the reply’s length and never its words', async () => {
		const reply = `${BANNER}update available\n`;
		const f = await aFolder();
		let called = false;
		// ⭐ L17b6 (D94) — ~~`exec: async () => ((called = true), { stdout: '' })`~~
		const out = await devinHistorianCall(
			{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
			// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
			{ spawn: (l) => ((called = true), fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn(l)), versionOf: async () => reply }
		);
		expect.soft(called, 'devin was called though its reply held no version').toBe(false);
		const why = out.ran ? '(it ran)' : out.why;
		expect.soft(why, 'a reply that holds no version is not named by its length alone').toBe(
			`devin's reply to \`devin --version\` holds no version (${reply.length} characters; devin's own words are not recorded, REG-F-685), and the ` +
				"Historian's two tool lists were measured at 3000.11.234: they are true of that version alone, so it is not run (L17b2 ruling 2 (A))"
		);
		holdsNoneOfTheThree(why, 'the reason');
		expect.soft(historianVersionRefusal('devin 3000.6.14\n'), '⭑ CONTROL — a reply naming another version is not named by that version, as before').toBe(
			"devin is at version 3000.6.14, and the Historian's two tool lists were measured at 3000.11.234: they are true of that version alone, so it is not run " +
				'(L17b2 ruling 2 (A))'
		);
	});

	// ⭐⭐ L17b4 — design D93 (the lead's §15.5 (c); `L4C-A02`) — THE HISTORIAN'S CATCHES READ THE THROWN VALUE ONLY THROUGH THE ONE DEFINITION, every read
	// guarded: a value one of whose properties throws when read — its message, code, signal, stdout, `killed` or `syscall` — is recorded by its safe record,
	// and nothing the read throws escapes the call, which never throws. ⭑ A CONTROL: the Historian's two catches read nothing else of the thrown value.
	it('⭑ CONTROL — L17b4 (§15.5 (c); L4C-A02): the Historian’s call and its version read, given a value one of whose properties throws when read, record the safe record alone, and nothing escapes', async () => {
		const secret = devinRejection({ code: 1 }).message;
		/** execFile's error `o`, its `key` read through a getter that throws `secret`. */
		const throwingAt = (key: string, o: Parameters<typeof devinRejection>[0]): Error => {
			const e = devinRejection(o);
			Object.defineProperty(e, key, {
				get: () => {
					throw new Error(secret);
				},
				configurable: true
			});
			return e;
		};
		const cases: readonly (readonly [string, Error, string])[] = [
			['message', throwingAt('message', { code: 1 }), 'exited with code 1'],
			['code', throwingAt('code', { code: 1 }), 'failed with no exit code, signal or error code'],
			['signal', throwingAt('signal', { killed: true, signal: 'SIGTERM' }), 'failed with no exit code, signal or error code'],
			['stdout', throwingAt('stdout', { killed: true, signal: 'SIGTERM' }), 'killed by SIGTERM, at its time bound of 600000 ms'],
			['killed', throwingAt('killed', { signal: 'SIGTERM' }), 'killed by SIGTERM'],
			['syscall', throwingAt('syscall', { code: 'ENOENT' }), 'failed with code ENOENT']
		];
		for (const [key, thrown, kind] of cases) {
			// ⭐ L17b6 (D94) — ~~`const failure = await failedWith(thrown);`~~ ~~`.toBe(recordOf(kind))`~~: the value is thrown by the call's seam, its spawn, and
			// the record is the ACP call's (§39, Q10), the kind read by the one definition, guarded.
			const failure = await startThrows(thrown);
			expect.soft(failure, `a value whose ${key} throws when read: the call's record is not the safe record alone`).toBe(acpRecordOf(`its program could not be started: ${kind}`));
			holdsNoneOfTheThree(failure, `the call's record of a value whose ${key} throws`);
			const f = await aFolder();
			const read = await devinHistorianCall(
				{ folder: f, model: 'swe-2-max', boundMs: 600_000 },
				{
					// ⭐ L17b6 — ~~`exec: async () => ({ stdout: '' }),`~~
					// ⭐ L17b6 round 3 — ~~`fakeAcp({ turn: [] })`~~: a turn that ends at once, so that a mutant that calls devin here ends its call fast and fails the check, never hangs to the test's timeout (the runner's INCONCLUSIVE for L17B2-M19).
					spawn: fakeAcp({ turn: [{ end: 'end_turn' }] }).spawn,
					versionOf: async () => {
						throw thrown;
					}
				}
			);
			const why = read.ran ? '(it ran)' : read.why;
			expect.soft(why, `a value whose ${key} throws when read: the version read's reason is not its safe kind alone`).toContain(
				`(devin --version: ${kind.replace('600000 ms', '30000 ms')}; devin's own words are not recorded, REG-F-685)`
			);
			holdsNoneOfTheThree(why, `the version read's reason for a value whose ${key} throws`);
		}
	});

	// ⭐ RESTATED (L17b6, design D94): ~~'⭑ CONTROL — L17b4 (D93): the export is read on failure as on success — a program that writes its export and then
	// fails: the outcome carries it, and both folders are removed'~~ — no export over ACP: what the session saw before its failure, its calls, is kept.
	it('⭑ CONTROL — L17b4 (D93), as L17b6 (D94) restates it: the calls a session made are kept on failure as on success — a session that reads, then fails: the outcome carries its calls, and both folders are removed', async () => {
		const f = await aFolder();
		// ⭐ L17b6 — ~~`exec: async (_file, args) => { writeFileSync(args[args.indexOf('--export') + 1]!, EXPORT); throw devinRejection({ code: 1 }); }`~~
		const fake = fakeAcp({ turn: [{ notice: readNotice('read:0#f', join(f.folder, 'records', 'INDEX.md')) }, { exit: 1 }] });
		const out = await devinHistorianCall({ folder: f, model: 'swe-2-max', boundMs: 600_000 }, { spawn: fake.spawn, versionOf: async () => VERSION, waits: SHORT });
		expect.soft(out.ran && out.failure !== undefined, 'arrangement: the call failed').toBe(true);
		// ⭐ L17b6 — ~~`expect.soft(out.ran ? out.sessionExport : undefined, 'the export written before the failure is not carried').toBe(EXPORT);`~~
		expect.soft(out.ran ? out.session.calls.map((c) => [c.toolCallId, c.name]) : undefined, 'the calls made before the failure are not carried').toEqual([['read:0#f', 'read']]);
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

// ⭐ RESTATED (L17b6, design D94): ~~'⭐⭐ L17b2 (D86; rulings 2 (B), 17) — the export read for its tool calls'~~ — the export is not read: each call is
// read from its notices, as the session's turn gives them (`tool_call`, and each `tool_call_update` that gives a kind, an input or places).
describe('⭐⭐ L17b2 (D86; rulings 2 (B), 17), as L17b6 (D94) restates it — each tool call read from its notice', () => {
	const FOLDER = join(tmpdir(), 'jpwb-historian-fixture');
	/** ⭐ L17b6 — the kind devin gives each of these tools' calls, as the probes measured: `read`, `search` (grep, find_file_by_name), `execute` (exec). */
	const kindOf = (name: string): string => ({ read: 'read', grep: 'search', find_file_by_name: 'search', glob: 'search', exec: 'execute' })[name] ?? 'other';
	// ⭐ L17b6 (D94) — ~~`const exportOf = (calls) => JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [{ step_id: 1, source: 'agent', tool_calls:
	// calls.map((c, i) => ({ tool_call_id: `call_${i}`, function_name: c.name, arguments: c.args })) }] });`~~: each call a `tool_call` notice, cut to the
	// fields the call keeps (`noticeFields`), its arguments its `rawInput`.
	const noticesOf = (calls: readonly { name: string; args: Record<string, unknown> }[]): Record<string, unknown>[] =>
		calls.map((c, i) => ({ sessionUpdate: 'tool_call', toolCallId: `call_${i}`, name: c.name, kind: kindOf(c.name), rawInput: c.args }));

	// ⭐ RESTATED (L17b6, D94): ~~'⛔ RED FIRST — each call read for its name and paths; a read outside the folder and a tool not allowed are each a
	// finding, named'~~ — read from its notice now, its kind beside its name, and a call not allowed by its kind or its tool (§39, Q9).
	it('⛔ RED FIRST — each call read from its notice for its name, its kind and its paths; a read outside the folder, and a call of a kind other than read or search, are each a finding, named', () => {
		const read = historianToolCallsOf(
			noticesOf([
				{ name: 'read', args: { file_path: 'records/INDEX.md' } },
				{ name: 'grep', args: { pattern: 'stdin', path: 'workspace' } },
				{ name: 'find_file_by_name', args: { pattern: '*.ts' } },
				{ name: 'read', args: { file_path: join(tmpdir(), 'elsewhere', 'secret.txt') } },
				{ name: 'read', args: { file_path: '../outside.txt' } },
				{ name: 'exec', args: { command: 'ls' } }
			]),
			FOLDER
		);
		// ⭐ L17b6 — ~~`[c.name, c.inside, c.allowed]`~~: and its kind.
		expect.soft(read.calls.map((c) => [c.name, c.kind, c.inside, c.allowed])).toEqual([
			['read', 'read', true, true],
			['grep', 'search', true, true],
			['find_file_by_name', 'search', true, true],
			['read', 'read', false, true],
			['read', 'read', false, true],
			['exec', 'execute', true, false]
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

	// ⭐ RESTATED (L17b6, D94): ~~'⛔ RED FIRST — an export that is missing, not JSON, or whose calls are not in the read shape is a finding, never a clean
	// bill'~~ — the notices: missing, or holding one not in the read shape. ~~`[undefined, 'not json', … tool_calls: 'not a list' …, … steps: 'none' …]`~~
	it('⛔ RED FIRST — notices that are missing, or that hold one whose call is not in the read shape, are a finding, never a clean bill', () => {
		const shapes: readonly (readonly [string, readonly unknown[] | undefined])[] = [
			['no notices', undefined],
			['a notice that is a word', ['not a notice']],
			['a call with no toolCallId', [{ sessionUpdate: 'tool_call', name: 'read', kind: 'read' }]],
			['locations that are not a list', [{ sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read', kind: 'read', locations: 'here' }]]
		];
		for (const [shape, notices] of shapes) {
			const read = historianToolCallsOf(notices, FOLDER);
			expect.soft(read.findings.map((f) => f.code), shape).toEqual(['HISTORIAN_TOOL_CALLS_UNREADABLE']);
			expect.soft(read.findings[0]?.statement ?? '', shape).toContain('its tool calls could not be read from its notices');
		}
	});

	// ⭐ RESTATED (L17b6, D94): ~~'⭑ CONTROL — an export with no tool call, as every export on disk at this version, reads no call and no finding'~~ —
	// a session whose updates hold no tool call: an update of another kind is passed over.
	it('⭑ CONTROL — a session with no tool call reads no call and no finding', () => {
		// ⭐ L17b6 — ~~`historianToolCallsOf(JSON.stringify({ schema_version: 'ATIF-v1.7', steps: [{ step_id: 1, source: 'agent', message: '{}' }] }), FOLDER)`~~
		expect(historianToolCallsOf([{ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: '{}' } }], FOLDER), 'a session with no tool call reads a call, or a finding').toEqual({
			calls: [],
			findings: []
		});
	});

	// ⭐⭐ L17b2 addendum (the lead's §27, item 5) — A READ OUTSIDE THE FOLDER, FAILING CLOSED. Besides its named path arguments, every other string
	// among a call's arguments — under any name, at any depth — that begins with `~`, is absolute, or holds a `..` segment is a path it names; a path
	// that begins with `~` is never inside (devin may expand it: D84 measures whether it does). Each allowed tool's argument names are D84's to measure.
	// ⭐ L17b6 (D94) — ~~`historianToolCallsOf(exportOf(calls), FOLDER)`~~: its notices.
	const insideOf = (calls: readonly { name: string; args: Record<string, unknown> }[]) => historianToolCallsOf(noticesOf(calls), FOLDER);

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
	// ⭐ RESTATED (L17b6, D94): ~~'⛔ RED FIRST — each unreadable shape of an export, one by one, is ONE finding, HISTORIAN_TOOL_CALLS_UNREADABLE, in its
	// own words, and no call: no export; not JSON; JSON that is null; steps that are not a list; a step that is a word, null or a list; a step’s
	// tool_calls that is not a list; a call that is a word, null or a list; a call naming no function — none, one that is not a string, an empty one;
	// arguments that are not JSON; arguments that are a number, null or a list'~~ — each unreadable shape of the notices, one by one, in its own words:
	// the export's shapes (its steps, its tool_calls, its function names) have no counterpart, and the notice's own take their places.
	it('⛔ RED FIRST — each unreadable shape of the notices, one by one, is ONE finding, HISTORIAN_TOOL_CALLS_UNREADABLE, in its own words, and no call: no notices; a notice that is a word, null or a list; a call naming no toolCallId — none, an empty one; a call naming no tool — none, one that is not a string, an empty one; a call giving no kind; a rawInput that is not JSON; a rawInput that is a number, null or a list; locations that are not a list; a location with no path', () => {
		const ok = { sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read', kind: 'read' };
		const call = (c: Record<string, unknown>): unknown[] => [{ ...ok, ...c }];
		const shapes: readonly (readonly [string, readonly unknown[] | undefined, string])[] = [
			['no notices', undefined, 'there are no notices'],
			['a notice that is a word', ['a notice'], 'its notice 1 is not an object'],
			['a notice that is null', [ok, null], 'its notice 2 is not an object'],
			['a notice that is a list', [[]], 'its notice 1 is not an object'],
			['a call with no toolCallId', [{ sessionUpdate: 'tool_call', name: 'read', kind: 'read' }], 'its notice 1 names no toolCallId'],
			['a call whose toolCallId is empty', call({ toolCallId: '' }), 'its notice 1 names no toolCallId'],
			['a call with no tool', [{ sessionUpdate: 'tool_call', toolCallId: 'call_0', kind: 'read' }], 'a call names no tool'],
			['a call whose tool is a number', call({ name: 7 }), 'a call names no tool'],
			['a call whose tool is empty', call({ name: '' }), 'a call names no tool'],
			['a call with no kind', [{ sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read' }], 'a call gives no kind'],
			['a rawInput that is not JSON', call({ rawInput: '{not json' }), 'a call has a rawInput that is not JSON'],
			['a rawInput that is a number', call({ rawInput: 7 }), 'a call has a rawInput that is not an object'],
			['a rawInput that is null, as JSON', call({ rawInput: 'null' }), 'a call has a rawInput that is not an object'],
			// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — and null itself: ⭐ (L17b6) a call's
			// first notice that gives null is refused, never read as none; an update's null means only that it changes nothing.
			['a rawInput that is null', call({ rawInput: null }), 'a call has a rawInput that is not an object'],
			['a rawInput that is a list', call({ rawInput: ['records'] }), 'a call has a rawInput that is not an object'],
			['locations that are not a list', call({ locations: 'here' }), 'a call has locations that are not a list'],
			['a location with no path', call({ locations: [{ line: 1 }] }), 'a call has a location with no path']
		];
		for (const [shape, notices, words] of shapes) {
			let read: { readonly calls: readonly unknown[]; readonly findings: readonly { readonly code: string; readonly statement: string }[] };
			try {
				read = historianToolCallsOf(notices, FOLDER);
			} catch (e) {
				read = { calls: ['the reader threw'], findings: [{ code: 'THE READER THREW', statement: String(e) }] };
			}
			expect.soft([read.calls.length, read.findings.map((f) => f.code)], `${shape}: not one unreadable finding and no call`).toEqual([0, ['HISTORIAN_TOOL_CALLS_UNREADABLE']]);
			// ⭐ L17b6 — ~~`its tool calls could not be read from its export: ${words}, so what it read is not known — never a clean bill (L17b2 ruling 17)`~~
			expect.soft(read.findings[0]?.statement ?? '', `${shape}: the finding is not in its own words`).toBe(
				`its tool calls could not be read from its notices: ${words}, so what it read is not known — never a clean bill (L17b2 ruling 17; D94)`
			);
		}
	});

	// ⭐ L17b2, after the independent review of the committed code (Codex's L17B2C-A03; the lead's r26 (3)) — the row above refuses explicit null; a call
	// that gives no arguments at all is still a call with none, as a tool with no arguments is called.
	// ⭐ RESTATED (L17b6, D94): ~~'⭑ CONTROL — a call with no arguments field is read as a call with none: its name, no place, inside the folder, and no
	// finding'~~ — its notice's rawInput.
	it('⭑ CONTROL — a call whose notice gives no rawInput is read as a call with none: its name, no place, inside the folder, and no finding', () => {
		// ⭐ L17b6 — ~~`historianToolCallsOf(JSON.stringify({ … tool_calls: [{ tool_call_id: 'call_0', function_name: 'read' }] … }), FOLDER)`~~
		const read = historianToolCallsOf([{ sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read', kind: 'read' }], FOLDER);
		// ⭐ L17b6 — ~~`[{ name: 'read', paths: [], inside: true, allowed: true }]`~~: and its toolCallId and its kind.
		expect.soft(read.calls, 'a call with no arguments field was not read as a call with none').toEqual([{ toolCallId: 'call_0', name: 'read', kind: 'read', paths: [], inside: true, allowed: true }]);
		expect.soft(read.findings, 'a call with no arguments field is a finding').toEqual([]);
	});

	// ⭐ RESTATED (L17b6, D94): ~~'⛔ RED FIRST — each argument a call names a place by is read for it, as the call gave it: file_path, path, notebook_path,
	// cwd, and each string of the list paths'~~ — its notice's rawInput, and its locations beside.
	it('⛔ RED FIRST — each field a call names a place by is read for it, as the call gave it: its rawInput’s file_path, path, notebook_path, cwd and each string of its list paths, and each of its locations', () => {
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
		// ⭐ L17b6 (D94) — and each place its locations name.
		const placed = historianToolCallsOf(
			[{ sessionUpdate: 'tool_call', toolCallId: 'call_9', name: 'read', kind: 'read', rawInput: {}, locations: [{ path: 'records/INDEX.md' }, { path: 'workspace/src' }] }],
			FOLDER
		);
		expect.soft(placed.calls[0]?.paths, 'locations: not read for the places they name').toEqual(['records/INDEX.md', 'workspace/src']);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.4 (finding 2), failing closed — A CALL IS WHAT ITS FIRST NOTICE SAYS. Round 2 let an update replace a call's kind,
	// input, places or name, so a read announced outside the folder and updated to one inside was read inside, by the audit and by the permission answer
	// alike. Measured: 62 updates in the 8 logs, none giving a kind, an input or places, each naming its call's own tool; no tool_call repeats an id.
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §43.4): an update, or a second tool_call of its id, that gives a call another name, kind, rawInput or locations makes the notices unreadable — no call, and ONE finding naming the call and the field; a value where the first notice gave none is another', () => {
		const inside = join(FOLDER, 'records', 'INDEX.md');
		const outside = join(tmpdir(), 'elsewhere', 'secret.txt');
		const first = { sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read', kind: 'read', rawInput: { file_path: outside } };
		const update = (c: Record<string, unknown>): Record<string, unknown> => ({ sessionUpdate: 'tool_call_update', toolCallId: 'call_0', ...c });
		const changes: readonly (readonly [string, readonly unknown[], string])[] = [
			['an update that moves a read outside the folder to one inside', [first, update({ rawInput: { file_path: inside } })], 'rawInput'],
			['an update that gives a call of kind execute the kind read', [{ ...first, name: 'exec', kind: 'execute', rawInput: { command: 'ls' } }, update({ kind: 'read' })], 'kind'],
			['an update that names another tool', [first, update({ name: 'grep' })], 'name'],
			['an update that gives locations where the first notice gave none', [first, update({ locations: [{ path: inside }] })], 'locations'],
			['a second tool_call of its id that gives another rawInput', [first, { ...first, rawInput: { file_path: inside } }], 'rawInput']
		];
		for (const [change, notices, field] of changes) {
			const read = historianToolCallsOf(notices, FOLDER);
			expect.soft([read.calls.length, read.findings.map((f) => [f.code, f.severity])], `${change}: not one unreadable finding and no call`).toEqual([
				0,
				[['HISTORIAN_TOOL_CALLS_UNREADABLE', 'MATERIAL']]
			]);
			expect.soft(read.findings[0]?.statement ?? '', `${change}: the finding does not name the call and the field`).toBe(
				`its tool calls could not be read from its notices: its notice 2 gives the call call_0 another ${field} than its first notice gave, so what it read is not known — never a clean bill (L17b2 ruling 17; D94)`
			);
		}
	});

	it('⭑ CONTROL — L17b6 round 3 (the lead’s §43.4): updates as measured change nothing of what a call is — each gives its status and names its call’s own tool, an update’s null gives nothing, and the same rawInput given again, its keys in another order, is the same: the call is read, with its last status', () => {
		const notices = [
			{ sessionUpdate: 'tool_call', toolCallId: 'call_0', name: 'read', kind: 'read', rawInput: { file_path: 'records/INDEX.md', limit: 10 }, locations: [{ path: 'records/INDEX.md' }] },
			{ sessionUpdate: 'tool_call_update', toolCallId: 'call_0', name: 'read', status: 'in_progress' },
			{ sessionUpdate: 'tool_call_update', toolCallId: 'call_0', kind: null, rawInput: null, locations: null, status: 'completed' },
			{ sessionUpdate: 'tool_call_update', toolCallId: 'call_0', rawInput: { limit: 10, file_path: 'records/INDEX.md' } }
		];
		const read = historianToolCallsOf(notices, FOLDER);
		expect(read.findings, '⭑ CONTROL — updates as measured made the notices unreadable, or a finding').toEqual([]);
		expect.soft(read.calls, '⭑ CONTROL — the call is not read as its first notice says, with its last status').toEqual([
			{ toolCallId: 'call_0', name: 'read', kind: 'read', paths: ['records/INDEX.md'], inside: true, allowed: true, status: 'completed' }
		]);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b6 — design D94 (`DESIGN-data-flow-order-and-deliverable-review.md` §12.48; `REG-F-689`, `REG-F-690`; `REG-D-202`
// to `REG-D-204`; the lead's rulings on L17b6's Stage 0, `l17b4/l17b4-facts.md` §39) — THE HISTORIAN OVER devin's ACP SERVER, IN "ASK" MODE, THE
// WORKBENCH ANSWERING EACH PERMISSION REQUEST.
// ⭑ devin is the fake (`assurance/devin-acp-fake.testing.ts`), in the form the lead's probes measured, and PATH points at no program, so neither the
// call nor a mutant that passes its seam by can start anything (§38.1, item 7). Each script follows a measured exchange (§38.4).
describe('⭐⭐ L17b6 (D94; REG-F-689, REG-F-690; REG-D-202 to REG-D-204) — the Historian over devin’s ACP server, in “ask” mode, the workbench answering each permission request', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});
	/** devin's version, the one whose tools were measured. */
	const ACP_VERSION = async (): Promise<string> => 'devin 3000.11.234 (92c83011d113)';
	/** The Historian's prompt, as the folder holds it. */
	const PROMPT = 'You are the Historian. Reply with ONE JSON object.';
	/** The Historian's answer, in its form: one criterion, and its two fields. */
	const ACP_ANSWER = JSON.stringify({
		findings: [{ criterionId: 'HC-01', failed: false, statement: 'met, as records/INDEX.md shows' }],
		recommendation: 'SATISFIED',
		residualUncertainty: [],
		recurrence: { recurs: false, statement: 'new', earlierRecords: [] },
		recommendedControlAction: null
	});
	/** The last message's lead-in, as probe 3's opened (§36). */
	const LEAD_IN = 'I’ve reviewed the full record. Here is my judgment.\n';
	/** The end of a turn: the answer as the last message, in two chunks, then `end_turn`. */
	const answering = (message = ACP_ANSWER): FakeAcpEvent[] => [{ message: message.slice(0, 40) }, { message: message.slice(40) }, { end: 'end_turn' }];
	/** An answer selecting the option of this id, or cancelled. */
	const selected = (optionId: string) => ({ outcome: { outcome: 'selected', optionId } });
	const CANCELLED = { outcome: { outcome: 'cancelled' } };
	/** The session the call reports, read loosely: before the code lands, the outcome has none. */
	const sessionOf = (o: HistorianCallOutcome) => (o.ran ? o.session : undefined);
	/** ⭐ The lead's §41 — the waits after the bound, a few milliseconds for a test: they come in through the call's seam. */
	const SHORT_WAITS = { cancelGraceMs: 50, deleteWaitMs: 50, stopWaitMs: 20 } as const;
	/** One call over a fresh folder, devin the fake, its script made from the folder; PATH pointed at no program. */
	const acpCall = async (script: (folder: HistorianFolder) => FakeAcpScript, boundMs = 600_000) => {
		vi.stubEnv('PATH', noProgramsDirectory());
		const folder = await writeHistorianFolder({ prompt: PROMPT, records: [], workspaceFiles: [] });
		dirs.push(folder.folder, folder.host);
		const fake = fakeAcp(script(folder));
		// ⭐ §41 — ~~`{ spawn: fake.spawn, versionOf: ACP_VERSION }`~~: and the waits.
		const outcome = await historianTool.devinHistorianCall({ folder, model: 'fixture-assurance-model', boundMs }, { spawn: fake.spawn, versionOf: ACP_VERSION, waits: SHORT_WAITS });
		return { folder, fake, outcome };
	};
	/** The answers the call gave to devin's permission requests, in order. */
	const permissionAnswers = (fake: ReturnType<typeof fakeAcp>) => fake.answers.filter((a) => a.method === 'session/request_permission').map((a) => a.answer.result);

	it('⛔ RED FIRST — L17b6 (D94): the launch — devin acp in the folder, the selected reviewer’s model named and no --config — and its messages in order: initialize with no file-system and no terminal capability, session/new in the folder with no MCP server, session/set_mode to ask, one session/prompt holding the prompt as one text block, then session/delete of its session', async () => {
		const { folder, fake, outcome } = await acpCall(() => ({ turn: answering() }));
		expect(fake.methods(), 'the messages devin was sent are not the launch’s four and the delete, in order').toEqual([
			'initialize',
			'session/new',
			'session/set_mode',
			'session/prompt',
			'session/delete'
		]);
		const launch = fake.launches[0]!;
		expect.soft([fake.launches.length, launch.file, launch.args, launch.cwd, launch.windowsHide, launch.boundMs], 'the launch').toEqual([
			1,
			'devin',
			['acp', '--model', 'fixture-assurance-model'],
			folder.folder,
			true,
			600_000
		]);
		expect.soft(launch.args, 'devin is named a --config file').not.toContain('--config');
		const [init, made, mode, prompt, deleted] = fake.received;
		expect.soft(init?.params, 'initialize advertises a capability').toEqual({ protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false } });
		expect.soft(made?.params, 'session/new is not in the folder with no MCP server').toEqual({ cwd: folder.folder, mcpServers: [] });
		expect.soft(mode?.params, 'the session’s mode is not set to ask').toEqual({ sessionId: FAKE_SESSION, modeId: 'ask' });
		expect.soft(prompt?.params, 'the prompt is not sent as one text block').toEqual({ sessionId: FAKE_SESSION, prompt: [{ type: 'text', text: PROMPT }] });
		expect.soft(deleted?.params, 'its session is not deleted').toEqual({ sessionId: FAKE_SESSION });
		// ⭑ One definition: what the call sent is its launch's messages, devin's session id put in where the launch holds it.
		const held = JSON.stringify(historianTool.HISTORIAN_SESSION_HELD);
		expect.soft(fake.received.map((m) => ({ method: m.method, params: m.params })), 'what the call sent is not its launch’s messages').toEqual(
			launch.messages.map((m) => ({ method: m.method, params: JSON.parse(JSON.stringify(m.params).split(held).join(JSON.stringify(FAKE_SESSION))) as unknown }))
		);
		expect.soft(typeof launch.permissionRule === 'string' && launch.permissionRule === historianTool.HISTORIAN_PERMISSION_RULE, 'the launch does not carry the permission rule').toBe(true);
		expect.soft(outcome.ran && outcome.failure === undefined, 'the call failed').toBe(true);
		expect.soft([existsSync(folder.folder), existsSync(folder.host)], 'a folder was kept').toEqual([false, false]);
		// ⭑ CONTROL (§39, item 10) — nothing devin says beyond what the call reads is kept: its initialize names a path under the home folder.
		expect.soft(JSON.stringify(outcome), '⭑ CONTROL — the outcome holds the home folder devin’s initialize named').not.toContain(JSON.stringify(FAKE_HOME).slice(1, -1));
	});

	it('⛔ RED FIRST — L17b6 (D94): a read inside the folder that devin asks about is allowed once, and no option that allows always is chosen', async () => {
		const { fake, outcome } = await acpCall((f) => ({
			turn: [{ notice: readNotice('read:0#in', join(f.folder, 'records', 'INDEX.md')) }, { ask: { toolCallId: 'read:0#in' } }, { notice: updateNotice('read:0#in', 'completed') }, ...answering()]
		}));
		expect(permissionAnswers(fake), 'the read inside the folder was not answered allow_once').toEqual([selected('allow_once')]);
		expect.soft(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : outcome, 'the run did not go on to its answer').toBe(ACP_ANSWER);
		expect.soft(sessionOf(outcome)?.requests, 'the request and its answer are not on the record').toEqual([{ toolCallId: 'read:0#in', name: 'read', kind: 'read', answer: 'allow_once' }]);
	});

	it('⛔ RED FIRST — L17b6 (D94): a call of another kind is refused once, and the run goes on to its answer — reject_once, the call and its refusal on the record', async () => {
		const { folder, fake, outcome } = await acpCall((f) => ({
			turn: [
				{ thought: 'I need to run node --version, then read the prompt.' },
				{ notice: execNotice('call_b7#1') },
				{ ask: { toolCallId: 'call_b7#1' } },
				{ notice: updateNotice('call_b7#1', 'failed', true, 'exec') },
				{ notice: readNotice('read:1#b', join(f.folder, 'prompt.txt')) },
				{ notice: updateNotice('read:1#b', 'completed') },
				...answering()
			]
		}));
		expect(permissionAnswers(fake), 'the call of kind execute was not answered reject_once').toEqual([selected('reject_once')]);
		expect.soft(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : outcome, 'the run did not go on to its answer').toBe(ACP_ANSWER);
		const session = sessionOf(outcome);
		expect.soft(session?.requests, 'its refusal is not on the record').toEqual([{ toolCallId: 'call_b7#1', name: 'exec', kind: 'execute', answer: 'reject_once' }]);
		expect
			.soft(session?.calls.map((c) => [c.toolCallId, c.name, c.kind, c.status]), 'its calls are not on the record, each with its last status')
			.toEqual([
				['call_b7#1', 'exec', 'execute', 'failed'],
				['read:1#b', 'read', 'read', 'completed']
			]);
		const audit = historianTool.historianToolCallsOf(session?.notices ?? [], folder.folder);
		expect.soft(audit.findings.map((f) => [f.code, f.severity]), 'the call of kind execute is not a MATERIAL finding').toEqual([['HISTORIAN_TOOL_NOT_ALLOWED', 'MATERIAL']]);
		// ⭑ A request whose toolCallId names no notice is refused once (§39, Q9).
		const unmatched = await acpCall((f) => ({ turn: [{ notice: readNotice('read:0#c', join(f.folder, 'records', 'INDEX.md')) }, { ask: { toolCallId: 'read:9#none' } }, ...answering()] }));
		expect.soft(permissionAnswers(unmatched.fake), 'a request whose toolCallId names no notice was not refused once').toEqual([selected('reject_once')]);
	});

	it('⛔ RED FIRST — L17b6 (D94): a read outside the folder is refused once — by its rawInput’s file_path, by its path, and by a location — and each is a MATERIAL finding', async () => {
		const outside = join(tmpdir(), 'jpwb-not-the-historian-folder', 'secret.txt');
		const { folder, fake, outcome } = await acpCall((f) => ({
			turn: [
				{ notice: readNotice('read:0#o', outside) },
				{ ask: { toolCallId: 'read:0#o' } },
				{ notice: searchNotice('grep:1#o', dirname(outside)) },
				{ ask: { toolCallId: 'grep:1#o' } },
				{ notice: readNotice('read:2#o', join(f.folder, 'prompt.txt'), outside) },
				{ ask: { toolCallId: 'read:2#o' } },
				...answering()
			]
		}));
		expect(permissionAnswers(fake), 'a read outside the folder was not answered reject_once').toEqual([selected('reject_once'), selected('reject_once'), selected('reject_once')]);
		const audit = historianTool.historianToolCallsOf(sessionOf(outcome)?.notices ?? [], folder.folder);
		expect.soft(audit.findings.map((f) => [f.code, f.severity]), 'a read outside the folder is not a MATERIAL finding, each').toEqual([
			['HISTORIAN_READ_OUTSIDE_FOLDER', 'MATERIAL'],
			['HISTORIAN_READ_OUTSIDE_FOLDER', 'MATERIAL'],
			['HISTORIAN_READ_OUTSIDE_FOLDER', 'MATERIAL']
		]);
		expect.soft(audit.findings.map((f) => f.statement.includes(outside) || f.statement.includes(dirname(outside))), 'a finding does not name the path outside').toEqual([true, true, true]);
		// ⭑ A search that names no path is refused once, and is no finding (§39, Q9).
		const noPath = await acpCall(() => ({ turn: [{ notice: searchNotice('grep:0#n', undefined) }, { ask: { toolCallId: 'grep:0#n' } }, ...answering()] }));
		expect.soft(permissionAnswers(noPath.fake), 'a search that names no path was not refused once').toEqual([selected('reject_once')]);
		expect.soft(historianTool.historianToolCallsOf(sessionOf(noPath.outcome)?.notices ?? [], noPath.folder.folder).findings, 'a search that names no path is a finding').toEqual([]);
	});

	it('⛔ RED FIRST — L17b6 (D94): no option that allows always is ever chosen, nor switch_bypass — a read inside offered no allow_once is refused once, a refused call offered no reject_once is cancelled, in any order of the options', async () => {
		const reversed = [...PROBE_B_OPTIONS].reverse();
		const noAllowOnce = PROBE_B_OPTIONS.filter((o) => o.kind !== 'allow_once');
		const noReject = PROBE_B_OPTIONS.filter((o) => o.kind !== 'reject_once');
		// ⚠ Constructed, not measured: a switch_bypass of kind allow_once, offered first.
		const bypassFirst = [{ optionId: 'switch_bypass', name: 'Yes, switch to bypass mode', kind: 'allow_once' }, ...PROBE_B_OPTIONS];
		const { fake } = await acpCall((f) => {
			const inside = join(f.folder, 'records', 'INDEX.md');
			return {
				turn: [
					{ notice: readNotice('r:1', inside) },
					{ ask: { toolCallId: 'r:1', options: reversed } },
					{ notice: readNotice('r:2', inside) },
					{ ask: { toolCallId: 'r:2', options: noAllowOnce } },
					{ notice: execNotice('x:3') },
					{ ask: { toolCallId: 'x:3', options: noReject } },
					{ notice: readNotice('r:4', inside) },
					{ ask: { toolCallId: 'r:4', options: bypassFirst } },
					...answering()
				]
			};
		});
		const answers = permissionAnswers(fake);
		expect(answers.length, 'not every request was answered').toBe(4);
		expect.soft(answers, 'the answers: allow_once in any order, reject_once with no allow_once, cancelled with no reject_once, never switch_bypass').toEqual([
			selected('allow_once'),
			selected('reject_once'),
			CANCELLED,
			selected('allow_once')
		]);
		const chosen = answers.map((a) => (a as { outcome?: { optionId?: unknown } } | undefined)?.outcome?.optionId).filter((id) => id !== undefined);
		expect.soft(chosen.filter((id) => id !== 'allow_once' && id !== 'reject_once'), 'an answer chose an option that allows always, or switch_bypass').toEqual([]);
	});

	it('⛔ RED FIRST — L17b6 (D94; REG-D-204): the answer is read from the last message, the text after the last tool call; the words around it are recorded beside it, and the working remarks before it are kept in the call’s record, not the answer', async () => {
		const remarks = ['I’ll start by reading the index.', 'Now the records of this round.'];
		const { outcome } = await acpCall((f) => ({
			turn: [
				{ message: remarks[0]! },
				{ notice: readNotice('read:0#w', join(f.folder, 'records', 'INDEX.md')) },
				{ notice: updateNotice('read:0#w', 'completed') },
				{ message: remarks[1]! },
				{ notice: readNotice('read:1#w', join(f.folder, 'prompt.txt')) },
				{ thought: 'The record shows the same failure.' },
				{ message: LEAD_IN },
				{ message: ACP_ANSWER.slice(0, 30) },
				// ⭑ A late update among the last message's chunks: only a call's notice begins a new segment.
				{ notice: updateNotice('read:1#w', 'completed') },
				{ message: ACP_ANSWER.slice(30) },
				{ end: 'end_turn' }
			]
		}));
		expect(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : undefined, 'the last message is not the one returned').toBe(LEAD_IN + ACP_ANSWER);
		expect.soft(sessionOf(outcome)?.workingRemarks, 'the working remarks are not kept in the call’s record').toEqual(remarks);
		expect.soft(sessionOf(outcome)?.reply, 'the reply is not every message, joined').toBe(remarks.join('') + LEAD_IN + ACP_ANSWER);
		expect.soft(JSON.stringify(sessionOf(outcome) ?? {}), 'a thought is kept on the record').not.toContain('The record shows the same failure.');
		const read = historianReader.readHistorianAnswer(LEAD_IN + ACP_ANSWER, { criteria: [], givenRecordIds: new Set() });
		expect.soft(read.ok ? [read.answerText, read.aroundAnswer] : read.why, 'the words around the answer are not recorded beside it').toEqual([ACP_ANSWER, { before: LEAD_IN, after: '' }]);
	});

	it('⛔ RED FIRST — L17b6 (D94): at the time bound the session is cancelled, then the child is stopped by its own process id — its stdin closed, then terminated, then killed — and the call fails at its bound, by its kind alone', async () => {
		// (a) devin ends its turn at the cancel.
		const honoured = await acpCall(() => ({ turn: [{ message: 'Reading.' }, { hold: true }] }), 300);
		expect(honoured.fake.methods(), 'session/cancel was not sent at the bound').toContain('session/cancel');
		const cancel = honoured.fake.received.find((m) => m.method === 'session/cancel');
		expect.soft(cancel === undefined ? 'none' : ['id' in cancel, cancel.params], 'session/cancel is not a notification of its session').toEqual([false, { sessionId: FAKE_SESSION }]);
		expect.soft(honoured.fake.methods().slice(-2), 'the session is not deleted after the cancel').toEqual(['session/cancel', 'session/delete']);
		const at = sessionOf(honoured.outcome);
		expect.soft([at?.cancelled, at?.turnEndedAfterCancel, at?.stopReason, at?.stoppedBy], 'the record does not say the turn ended after the cancel').toEqual([true, true, 'cancelled', 'stdin']);
		expect.soft(honoured.outcome.ran ? honoured.outcome.failure : '', 'the call does not fail at its bound, by its kind').toContain('at its time bound of 300 ms');
		expect.soft(honoured.fake.stops, 'the child is not stopped by its stdin first').toEqual(['stdin']);
		// (b) devin ignores the cancel and its stdin's close: terminated, after the named waits.
		const ignored = await acpCall(() => ({ turn: [{ hold: true }], onCancel: 'ignore', onStdinClose: 'ignore' }), 300);
		expect.soft(ignored.fake.stops, 'the child is not stopped by its own process id: its stdin closed, then terminated').toEqual(['stdin', 'terminate']);
		const left = sessionOf(ignored.outcome);
		expect.soft([left?.cancelled, left?.turnEndedAfterCancel, left?.stoppedBy, left?.deleted], 'the record does not say the turn did not end after the cancel').toEqual([true, false, 'terminate', true]);
		// (c) … and its terminate too: killed.
		const killed = await acpCall(() => ({ turn: [{ hold: true }], onCancel: 'ignore', onStdinClose: 'ignore', onTerminate: 'ignore' }), 300);
		expect.soft(killed.fake.stops, 'the child is not killed after its terminate').toEqual(['stdin', 'terminate', 'kill']);
		expect.soft(sessionOf(killed.outcome)?.stoppedBy, 'the record does not say it was killed').toBe('kill');
		expect.soft(
			[historianTool.HISTORIAN_CANCEL_GRACE_MS, historianTool.HISTORIAN_DELETE_WAIT_MS, historianTool.HISTORIAN_STOP_WAIT_MS],
			'the waits are not the lead’s named constants (§39, Q4)'
		).toEqual([10_000, 5_000, 2_000]);
		// ⭐ The lead's §41 — the waits a call takes where its seam gives none are the three named constants.
		expect.soft(historianTool.HISTORIAN_DEFAULT_WAITS, 'the default waits are not the three named constants').toEqual({
			cancelGraceMs: historianTool.HISTORIAN_CANCEL_GRACE_MS,
			deleteWaitMs: historianTool.HISTORIAN_DELETE_WAIT_MS,
			stopWaitMs: historianTool.HISTORIAN_STOP_WAIT_MS
		});
		// ⭐ RESTATED (L17b6 round 2; the lead's §41): ~~`}, 120_000);`~~ — the waits ran for real, 25 to 30 s; they come in through the call's seam now
		// (`SHORT_WAITS`), and this test keeps its normal timeout. Its title is unchanged.
	});

	it('⛔ RED FIRST — L17b6 (D94): the session is deleted after the turn however it ends — after end_turn, after an error answered to its prompt, after devin’s own rule ends its turn, and after the bound', async () => {
		const ended = await acpCall(() => ({ turn: answering() }));
		expect(ended.fake.methods().at(-1), 'the session was not deleted after end_turn').toBe('session/delete');
		expect.soft(sessionOf(ended.outcome)?.deleted, 'the record does not say the session was deleted').toBe(true);
		// An error answered to its prompt, its message holding a home folder and a login banner (constructed: no log holds one).
		const errored = await acpCall(() => ({ turn: [], errors: { 'session/prompt': { code: -32603, message: `${BANNER}${FIXTURE_HOME}\\AppData` } } }));
		expect.soft(errored.fake.methods().at(-1), 'the session was not deleted after an error answered to its prompt').toBe('session/delete');
		const failure = errored.outcome.ran ? (errored.outcome.failure ?? '') : errored.outcome.why;
		expect.soft(failure, 'the error is not the failure, by its method and its code').toMatch(/session\/prompt.*-32603/);
		// ⭑ CONTROL (§39, Q10, item 10) — devin's words never: no home folder, no e-mail address.
		holdsNoneOfTheThree(failure, 'the failure');
		// devin's own deny rule ends the turn, as probe A measured (acp-01, lines 23-28): no message.
		const ruled = await acpCall(() => ({ turn: [{ notice: execNotice('exec:0#r') }, { notice: updateNotice('exec:0#r', 'failed', false, 'exec') }, { end: 'end_turn', cause: 'tool_rejected' }] }));
		expect.soft(ruled.fake.methods().at(-1), 'the session was not deleted after devin’s own rule ended its turn').toBe('session/delete');
		expect.soft(ruled.outcome.ran && ruled.outcome.failure === undefined ? ruled.outcome.lastMessage : 'it failed', 'devin’s own rule: its last message is not empty').toBe('');
		const bounded = await acpCall(() => ({ turn: [{ hold: true }] }), 300);
		expect.soft(bounded.fake.methods().at(-1), 'the session was not deleted after the bound').toBe('session/delete');
	});

	it('⛔ RED FIRST — L17b6 (D94): a request the client does not know — the file system’s and the terminal’s among them — is answered method not found, and the run goes on', async () => {
		const { fake, outcome } = await acpCall((f) => ({
			turn: [
				{ request: { method: 'fs/read_text_file', params: { sessionId: FAKE_SESSION, path: join(f.folder, 'prompt.txt') } } },
				{ request: { method: 'terminal/create', params: { sessionId: FAKE_SESSION, command: 'node' } } },
				{ request: { method: '_cognition.ai/unknown', params: {} } },
				{ line: 'not json at all' },
				...answering()
			]
		}));
		const errors = fake.answers.map((a) => [a.method, (a.answer.error as { code?: unknown } | undefined)?.code]);
		expect(errors[0], 'fs/read_text_file was not answered method not found').toEqual(['fs/read_text_file', -32601]);
		expect.soft(errors, 'a request the client does not know is not answered method not found').toEqual([
			['fs/read_text_file', -32601],
			['terminal/create', -32601],
			['_cognition.ai/unknown', -32601]
		]);
		expect.soft(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : outcome, 'the run did not go on to its answer').toBe(ACP_ANSWER);
		expect.soft([sessionOf(outcome)?.unknownRequests, sessionOf(outcome)?.unreadLines], 'the requests and the line are not kept on the record').toEqual([
			['fs/read_text_file', 'terminal/create', '_cognition.ai/unknown'],
			1
		]);
	});

	it('⛔ RED FIRST — L17b6 (D94): the session’s model and thought level are recorded as it reports them — swe-2-high, named SWE-2, at max, named Max', async () => {
		const { outcome } = await acpCall(() => ({ turn: answering() }));
		expect(sessionOf(outcome)?.model, 'the session’s model was not recorded').toEqual({ value: 'swe-2-high', name: 'SWE-2' });
		expect.soft([sessionOf(outcome)?.thoughtLevel, sessionOf(outcome)?.modelLabel], 'its thought level, or the label it ran under, was not recorded').toEqual([{ value: 'max', name: 'Max' }, 'SWE-2 Max']);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.4 (finding 2), failing closed — THE PERMISSION ANSWER READS A CALL AS THE AUDIT DOES: what its first notice says.
	// A call whose update, or a second tool_call of its id, gives another name, kind, rawInput or places is not read, and its request is answered
	// reject_once (constructed: no log holds such an update, §43.4).
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §43.4): a call whose update, or a second tool_call of its id, gives it another rawInput, kind or name has its permission request answered reject_once, its call not read — a read outside the folder updated to one inside among them; ⭑ CONTROL: a read inside, its update as measured, is allowed once', async () => {
		const outside = join(tmpdir(), 'jpwb-not-the-historian-folder', 'secret.txt');
		const { folder, fake, outcome } = await acpCall((f) => {
			const inside = join(f.folder, 'records', 'INDEX.md');
			return {
				turn: [
					{ notice: readNotice('m:1', outside) },
					{ notice: { ...updateNotice('m:1', 'pending'), rawInput: { file_path: inside }, locations: [{ path: inside }] } },
					{ ask: { toolCallId: 'm:1' } },
					{ notice: execNotice('m:2') },
					{ notice: { ...updateNotice('m:2', 'pending'), kind: 'read', rawInput: { file_path: inside } } },
					{ ask: { toolCallId: 'm:2' } },
					{ notice: readNotice('m:3', outside) },
					{ notice: readNotice('m:3', inside) },
					{ ask: { toolCallId: 'm:3' } },
					{ notice: readNotice('m:4', inside) },
					{ notice: updateNotice('m:4', 'pending') },
					{ ask: { toolCallId: 'm:4' } },
					...answering()
				]
			};
		});
		expect(permissionAnswers(fake), 'a call its later notice changed was not answered reject_once').toEqual([
			selected('reject_once'),
			selected('reject_once'),
			selected('reject_once'),
			selected('allow_once')
		]);
		expect.soft(sessionOf(outcome)?.requests, 'a call its later notice changed was read for its request’s record').toEqual([
			{ toolCallId: 'm:1', name: '', kind: '', answer: 'reject_once' },
			{ toolCallId: 'm:2', name: '', kind: '', answer: 'reject_once' },
			{ toolCallId: 'm:3', name: '', kind: '', answer: 'reject_once' },
			{ toolCallId: 'm:4', name: 'read', kind: 'read', answer: 'allow_once' }
		]);
		const audit = historianTool.historianToolCallsOf(sessionOf(outcome)?.notices ?? [], folder.folder);
		expect.soft([audit.calls.length, audit.findings.map((f) => f.code)], 'the audit read the calls a later notice changed').toEqual([0, ['HISTORIAN_TOOL_CALLS_UNREADABLE']]);
		expect.soft(sessionOf(outcome)?.calls, 'the session’s calls are not the audit’s reading').toEqual(audit.calls);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.9 (2), §38.7's M2 — TESTS THE MUTANT OWED: the kind and the tool are each checked (§39, Q9), but every call of a
	// kind not allowed in the tests above is also of a tool not allowed (exec), so the kind's check, dropped, would pass them all. Here an allowed tool,
	// read, comes under a kind not allowed, execute (constructed: no log holds one). Its red is the mutant's.
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §39, Q9; §38.7, M2): the kind is checked apart from the tool — a call of an allowed tool, read, under a kind not allowed, execute, naming a path inside the folder, is refused once and is a MATERIAL finding', async () => {
		const { folder, fake, outcome } = await acpCall((f) => ({
			turn: [{ notice: { ...execNotice('x:1', 'read', 'execute'), rawInput: { file_path: join(f.folder, 'records', 'INDEX.md') } } }, { ask: { toolCallId: 'x:1' } }, ...answering()]
		}));
		expect(permissionAnswers(fake), 'a read of kind execute was not answered reject_once').toEqual([selected('reject_once')]);
		const audit = historianTool.historianToolCallsOf(sessionOf(outcome)?.notices ?? [], folder.folder);
		expect.soft(audit.findings.map((f) => [f.code, f.severity]), 'a read of kind execute is not a MATERIAL finding').toEqual([['HISTORIAN_TOOL_NOT_ALLOWED', 'MATERIAL']]);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.6 (finding 4) — A CHILD NEVER STARTED IS NOT `unstopped`, which decision 6 defines as all three stops waited out.
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §43.6): a call that starts no child is recorded not-started — its prompt not read, or its spawn thrown; ⭑ CONTROL: unstopped only after the three stops are each waited out', async () => {
		vi.stubEnv('PATH', noProgramsDirectory());
		const unread = await writeHistorianFolder({ prompt: PROMPT, records: [], workspaceFiles: [] });
		dirs.push(unread.folder, unread.host);
		rmSync(unread.promptPath);
		const never = fakeAcp({ turn: answering() });
		const noPrompt = await historianTool.devinHistorianCall({ folder: unread, model: 'fixture-assurance-model', boundMs: 600_000 }, { spawn: never.spawn, versionOf: ACP_VERSION, waits: SHORT_WAITS });
		expect(sessionOf(noPrompt)?.stoppedBy, 'a call whose prompt could not be read is not recorded not-started').toBe('not-started');
		expect.soft(never.launches.length, 'a child was started though the prompt could not be read').toBe(0);
		const thrown = await writeHistorianFolder({ prompt: PROMPT, records: [], workspaceFiles: [] });
		dirs.push(thrown.folder, thrown.host);
		const spawnThrows = await historianTool.devinHistorianCall(
			{ folder: thrown, model: 'fixture-assurance-model', boundMs: 600_000 },
			{
				spawn: () => {
					throw Object.assign(new Error('spawn devin ENOENT'), { code: 'ENOENT' });
				},
				versionOf: ACP_VERSION,
				waits: SHORT_WAITS
			}
		);
		expect.soft(sessionOf(spawnThrows)?.stoppedBy, 'a call whose spawn threw is not recorded not-started').toBe('not-started');
		// ⭑ CONTROL — a child that no stop ends: its stdin closed, terminated and killed, each waited out, and so unstopped.
		const kept = await acpCall(() => ({ turn: [{ hold: true }], onCancel: 'ignore', onStdinClose: 'ignore', onTerminate: 'ignore', onKill: 'ignore' }), 300);
		expect.soft([kept.fake.stops, sessionOf(kept.outcome)?.stoppedBy], '⭑ CONTROL — a child no stop ended is not unstopped after the three stops').toEqual([['stdin', 'terminate', 'kill'], 'unstopped']);
	});

	// ⭐⭐ L17b6 round 3 — the lead's §43.7 (finding 5) — THE CALL'S DEFAULT WAITS, HELD ON A FAKE CLOCK: T8 passes short waits and the route tests never
	// reach the bound, so a call that dropped `HISTORIAN_DEFAULT_WAITS` would pass them all. Here the seam gives none, and the clock is a fake one
	// (`setTimeout`, `clearTimeout` and `performance`), so each wait is seen at its own millisecond and none is waited out; the fake devin's lines go
	// on real turns of the event loop (`setImmediate`, not faked). devin holds its turn, ignores the cancel, never answers the delete, and ignores
	// each stop but the kill.
	it('⛔ RED FIRST — L17b6 round 3 (the lead’s §43.7): where its seam gives no waits, the call waits the three named ones — the cancel’s grace of 10 s, the delete’s wait of 5 s and each stop’s 2 s — each seen at its own millisecond on a fake clock, none waited out', async () => {
		vi.stubEnv('PATH', noProgramsDirectory());
		const folder = await writeHistorianFolder({ prompt: PROMPT, records: [], workspaceFiles: [] });
		dirs.push(folder.folder, folder.host);
		const fake = fakeAcp({ turn: [{ hold: true }], onCancel: 'ignore', onDelete: 'ignore', onStdinClose: 'ignore', onTerminate: 'ignore' });
		const BOUND_MS = 1_000;
		/** A real turn of the event loop, the fake clock held: the fake's lines and the call's answers to them. */
		const turnOfTheLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
		/** What the waits order: the cancel and the delete sent, and the stops made. */
		const seen = () => ({ sent: fake.methods().filter((m) => m === 'session/cancel' || m === 'session/delete'), stops: [...fake.stops] });
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
		try {
			const call = historianTool.devinHistorianCall({ folder, model: 'fixture-assurance-model', boundMs: BOUND_MS }, { spawn: fake.spawn, versionOf: ACP_VERSION });
			// The loop turned until the prompt is sent, for up to 20 s by the wall clock (`Date`, not faked): the prompt's file is read, and the handshake's
			// lines answered, on real turns, and a loaded machine reads the file later than a fixed count of turns would wait.
			for (const by = Date.now() + 20_000; !fake.methods().includes('session/prompt') && Date.now() < by; ) await turnOfTheLoop();
			expect(fake.methods(), 'arrangement: the prompt was not sent').toContain('session/prompt');
			/** The fake clock moved on by `ms`, then the loop turned a few times. */
			const after = async (ms: number): Promise<void> => {
				await vi.advanceTimersByTimeAsync(ms);
				for (let i = 0; i < 5; i += 1) await turnOfTheLoop();
			};
			const steps: readonly (readonly [number, string, { readonly sent: readonly string[]; readonly stops: readonly string[] }])[] = [
				[BOUND_MS - 1, 'before the bound', { sent: [], stops: [] }],
				[1, 'at the bound', { sent: ['session/cancel'], stops: [] }],
				[historianTool.HISTORIAN_CANCEL_GRACE_MS - 1, 'before the cancel’s grace is out', { sent: ['session/cancel'], stops: [] }],
				[1, 'at the cancel’s grace', { sent: ['session/cancel', 'session/delete'], stops: [] }],
				[historianTool.HISTORIAN_DELETE_WAIT_MS - 1, 'before the delete’s wait is out', { sent: ['session/cancel', 'session/delete'], stops: [] }],
				[1, 'at the delete’s wait', { sent: ['session/cancel', 'session/delete'], stops: ['stdin'] }],
				[historianTool.HISTORIAN_STOP_WAIT_MS - 1, 'before the first stop’s wait is out', { sent: ['session/cancel', 'session/delete'], stops: ['stdin'] }],
				[1, 'at the first stop’s wait', { sent: ['session/cancel', 'session/delete'], stops: ['stdin', 'terminate'] }],
				[historianTool.HISTORIAN_STOP_WAIT_MS - 1, 'before the second stop’s wait is out', { sent: ['session/cancel', 'session/delete'], stops: ['stdin', 'terminate'] }],
				[1, 'at the second stop’s wait', { sent: ['session/cancel', 'session/delete'], stops: ['stdin', 'terminate', 'kill'] }]
			];
			let at = 0;
			for (const [ms, when, want] of steps) {
				await after(ms);
				at += ms;
				expect.soft(seen(), `${when} (${at} ms after the prompt, on the fake clock): the call did not do what its default waits order`).toEqual(want);
			}
			const outcome = await call;
			expect.soft(sessionOf(outcome) === undefined ? 'no session' : [sessionOf(outcome)?.stoppedBy, sessionOf(outcome)?.deleted], 'the record does not say it was killed, its session not deleted').toEqual([
				'kill',
				false
			]);
		} finally {
			vi.useRealTimers();
		}
	});

	// ⭐⭐ L17b6 round 4 — the lead's §45.3 (the builder's §44.8, ruled yes, failing closed) — A LINE OF devin's THAT IS NOT A JSON OBJECT IS A FINDING, never
	// a clean bill: it may hold a call's notice the audit cannot read. The audit's one definition makes it (`historianToolCallsOf`, given the session's
	// count), so the record's toolCalls and the session's calls agree. ⭑ Unmeasured: in the 8 logs devin wrote 638 lines, each a JSON object (§45.3).
	it('⛔ RED FIRST — L17b6 round 4 (the lead’s §45.3): a session whose output held a line that is not a JSON object gives ONE finding, HISTORIAN_TOOL_CALLS_UNREADABLE (MATERIAL), naming the count — no call read, and the session’s calls are the audit’s, none', async () => {
		const { folder, outcome } = await acpCall((f) => ({
			turn: [{ notice: readNotice('read:0#u', join(f.folder, 'records', 'INDEX.md')) }, { line: 'not json at all' }, ...answering()]
		}));
		const session = sessionOf(outcome);
		expect(session?.unreadLines, 'arrangement: the line that is not JSON is not counted').toBe(1);
		const audit = historianTool.historianToolCallsOf(session?.notices ?? [], folder.folder, session?.unreadLines ?? 0);
		expect.soft([audit.calls.length, audit.findings.map((f) => [f.code, f.severity])], 'a line that is not JSON is not one unreadable finding, with no call').toEqual([
			0,
			[['HISTORIAN_TOOL_CALLS_UNREADABLE', 'MATERIAL']]
		]);
		expect.soft(audit.findings[0]?.statement ?? '', 'the finding does not name the count').toBe(
			'its tool calls could not be read from its notices: devin wrote 1 line that could not be read as a message, so what it read is not known — never a clean bill (L17b2 ruling 17; D94)'
		);
		expect.soft(session?.calls, 'the session’s calls are not the audit’s reading').toEqual(audit.calls);
	});

	it('⛔ RED FIRST — L17b6 round 4 (the lead’s §45.3): a line that is empty, or holds whitespace alone, is no message — passed over and not counted; ⭑ CONTROL: blank lines give no finding, and the session’s call is read', async () => {
		const { folder, outcome } = await acpCall((f) => ({
			turn: [{ notice: readNotice('read:0#b', join(f.folder, 'records', 'INDEX.md')) }, { line: '' }, { line: ' \t ' }, ...answering()]
		}));
		const session = sessionOf(outcome);
		expect(session?.unreadLines, 'a blank line was counted as unread').toBe(0);
		const audit = historianTool.historianToolCallsOf(session?.notices ?? [], folder.folder, session?.unreadLines ?? 0);
		expect.soft([audit.calls.map((c) => c.toolCallId), audit.findings], '⭑ CONTROL — blank lines gave a finding, or hid the call').toEqual([['read:0#b'], []]);
		expect.soft(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : outcome, '⭑ CONTROL — the run did not go on to its answer').toBe(ACP_ANSWER);
	});

	// ⭐⭐ L17b6 round 5 — the lead's §47.7 — RULED BEHAVIOURS NO TEST REACHED, each now a test and its mutant. The code already holds each, so each test is
	// green at the staged code, and its red is its mutant's, observed. The fake's options these need are new options alone, every default unchanged.

	// Item 1 (§39, Q4) — AFTER THE BOUND'S CANCEL, A PERMISSION REQUEST devin MAKES IS ANSWERED CANCELLED, AND RECORDED SO: here a read inside the folder,
	// which the workbench would allow once before the cancel (constructed: no log holds a request after a cancel).
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 1; §39, Q4): after the bound’s session/cancel, a permission request devin makes is answered cancelled, and recorded so — a read inside the folder, which would be allowed once, among them', async () => {
		const { fake, outcome } = await acpCall(
			(f) => ({ turn: [{ notice: readNotice('read:0#k', join(f.folder, 'records', 'INDEX.md')) }, { hold: true }], atCancel: [{ ask: { toolCallId: 'read:0#k' } }] }),
			300
		);
		expect(permissionAnswers(fake), 'a request after the cancel was not answered cancelled').toEqual([CANCELLED]);
		expect.soft(sessionOf(outcome)?.requests, 'a request after the cancel is not recorded cancelled').toEqual([{ toolCallId: 'read:0#k', name: 'read', kind: 'read', answer: 'cancelled' }]);
		expect.soft(
			[sessionOf(outcome)?.cancelled, sessionOf(outcome)?.turnEndedAfterCancel, outcome.ran ? outcome.failure : outcome.why],
			'arrangement: the call was not cancelled at its bound, its turn ending after the cancel'
		).toEqual([true, true, acpRecordOf('at its time bound of 300 ms')]);
	});

	// Item 2 (§39, Q10) — A TURN THAT ENDS WITH A STOP REASON OTHER THAN end_turn FAILS THE CALL, NAMING IT, AND ITS SESSION IS STILL DELETED: every other
	// test's turn ends end_turn, or at the bound. ⭑ max_tokens and refusal, two of ACP's stop reasons (constructed: no log holds either).
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 2; §39, Q10): a turn that ends with a stop reason other than end_turn — max_tokens, and refusal — fails the call, naming the reason, and its session is still deleted', async () => {
		for (const reason of ['max_tokens', 'refusal']) {
			const { fake, outcome } = await acpCall(() => ({ turn: [{ message: ACP_ANSWER }, { end: reason }] }));
			expect(outcome.ran ? outcome.failure : outcome.why, `a turn that ended ${reason} did not fail the call, naming the reason`).toBe(
				acpRecordOf(`its turn ended with stop reason ${reason}`)
			);
			expect.soft([sessionOf(outcome)?.stopReason, fake.methods().at(-1), sessionOf(outcome)?.deleted], `a turn that ended ${reason}: its stop reason is not recorded, or its session was not deleted`).toEqual([
				reason,
				'session/delete',
				true
			]);
		}
	});

	// Item 3 (§39, Q4: the bound counted from the spawn) — THE BOUND REACHED BEFORE THE PROMPT, AT initialize, session/new OR session/set_mode, FAILS THE
	// CALL AT ITS BOUND, AND THE CHILD IS STOPPED: devin never answers the one request (constructed), so no prompt is sent, and no cancel.
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 3; §39, Q4): the bound reached before the prompt — at initialize, session/new or session/set_mode, devin never answering it — fails the call at its bound, sends no prompt and no cancel, and stops the child', async () => {
		for (const method of ['initialize', 'session/new', 'session/set_mode']) {
			const { fake, outcome } = await acpCall(() => ({ turn: answering(), neverAnswer: [method] }), 300);
			expect(outcome.ran ? outcome.failure : outcome.why, `the bound reached at ${method} did not fail the call at its bound`).toBe(acpRecordOf('at its time bound of 300 ms'));
			expect.soft(fake.methods().filter((m) => m === 'session/prompt' || m === 'session/cancel'), `the bound reached at ${method}: a prompt, or a cancel, was sent`).toEqual([]);
			expect.soft([fake.stops, sessionOf(outcome)?.stoppedBy], `the bound reached at ${method}: the child was not stopped`).toEqual([['stdin'], 'stdin']);
		}
	});

	// Item 4 — A session/new THAT NAMES NO SESSION FAILS THE CALL: its id missing, or empty (constructed: every log names one), so no mode is set and no
	// prompt sent.
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 4): a session/new that names no session — its id missing, or empty — fails the call, before any mode is set or prompt sent', async () => {
		for (const [what, newSessionId] of [
			['missing', null],
			['empty', '']
		] as const) {
			const { fake, outcome } = await acpCall(() => ({ turn: answering(), newSessionId }));
			expect(outcome.ran ? outcome.failure : outcome.why, `a session/new whose id is ${what} did not fail the call`).toBe(acpRecordOf('session/new named no session'));
			expect.soft(fake.methods(), `a session/new whose id is ${what}: the call went on`).toEqual(['initialize', 'session/new']);
		}
	});

	// Item 5 (§45.3: "any other line that is not a JSON object") — A LINE THAT PARSES AS JSON BUT IS NOT AN OBJECT — a list, a string, a number — IS
	// COUNTED AS UNREAD, AND GIVES THE ONE FINDING, its count in the plural. Round 4's test holds a line that does not parse, and one alone.
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 5; §45.3): a line that parses as JSON but is not an object — a list, a string, a number — is counted as unread, and the three give the one finding, devin wrote 3 lines', async () => {
		const { folder, outcome } = await acpCall((f) => ({
			turn: [{ notice: readNotice('read:0#j', join(f.folder, 'records', 'INDEX.md')) }, { line: '[1, 2]' }, { line: '"a string"' }, { line: '42' }, ...answering()]
		}));
		const session = sessionOf(outcome);
		expect(session?.unreadLines, 'a line that is JSON but not an object is not counted as unread').toBe(3);
		const audit = historianTool.historianToolCallsOf(session?.notices ?? [], folder.folder, session?.unreadLines ?? 0);
		expect.soft(audit.findings.map((f) => f.statement), 'the three lines do not give the one finding, its count in the plural').toEqual([
			'its tool calls could not be read from its notices: devin wrote 3 lines that could not be read as a message, so what it read is not known — never a clean bill (L17b2 ruling 17; D94)'
		]);
		expect.soft([audit.calls, session?.calls], 'a call was read beside lines that could not be read').toEqual([[], []]);
	});

	// Item 6 (§39, Q9, failing closed) — A PERMISSION REQUEST WHOSE CALL'S NOTICE THE AUDIT CANNOT READ IS REFUSED: a read inside the folder whose notice
	// gives no kind, and one that names no tool (constructed: every logged notice gives both).
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 6; §39, Q9): a permission request whose call’s notice the audit cannot read — its kind missing, or its tool’s name missing — is answered reject_once, though the call reads inside the folder', async () => {
		const { fake, outcome } = await acpCall((f) => {
			const inside = join(f.folder, 'records', 'INDEX.md');
			const noKind = Object.fromEntries(Object.entries(readNotice('n:1', inside)).filter(([k]) => k !== 'kind'));
			const noName = { ...readNotice('n:2', inside), _meta: {} };
			return { turn: [{ notice: noKind }, { ask: { toolCallId: 'n:1' } }, { notice: noName }, { ask: { toolCallId: 'n:2' } }, ...answering()] };
		});
		expect(permissionAnswers(fake), 'a request whose call’s notice cannot be read was not answered reject_once').toEqual([selected('reject_once'), selected('reject_once')]);
		expect.soft(sessionOf(outcome)?.requests, 'its record reads a call whose notice cannot be read').toEqual([
			{ toolCallId: 'n:1', name: '', kind: '', answer: 'reject_once' },
			{ toolCallId: 'n:2', name: '', kind: '', answer: 'reject_once' }
		]);
	});

	// Item 7 (§39, Q10) — THE FAILURE RECORD'S OTHER END: a child ended by a signal is "killed by" it, by its name where it has a signal's shape, else as
	// "a name of another shape" (constructed: no log holds one). ⭑ Its "its output ended" stays unreached: the call words an end only after the child's own
	// end is kept (`acpConnection`), so the end it words is never missing.
	it('⛔ RED FIRST — L17b6 round 5 (the lead’s §47.7, item 7; §39, Q10): a child that ends by a signal before its prompt is answered fails the call, recorded killed by the signal — by its name where it has a signal’s shape, else as a name of another shape', async () => {
		const cases = [
			['SIGKILL', 'killed by SIGKILL'],
			['kill -9 by the host', 'killed by a name of another shape'],
			[null, 'killed by a name of another shape']
		] as const;
		for (const [signal, words] of cases) {
			const { outcome } = await acpCall(() => ({ turn: [{ message: 'Reading.' }, { signal }] }));
			expect(outcome.ran ? outcome.failure : outcome.why, `a child ended by ${String(signal)} is not recorded killed by it`).toBe(acpRecordOf(`ended before it answered session/prompt: ${words}`));
		}
	});

	// ⭐⭐ L17b6 round 6 — the lead's §49.5 (§49.3, kind 4) — THE SIX GUARDS THAT KEEP devin's OWN WORDS OFF THE RECORD (PER-12, as D94 applies it), each fed
	// a value of another shape. The code already holds each, so each test is green at the staged code, and its red is its mutants', observed.

	// Item 1 (§39, Q12; `optionNamed`) — THE SESSION'S MODEL IS RECORDED ONLY IN ITS SHAPE: a current value of another shape is not recorded, and a value in
	// the shape whose name is of another shape keeps its value as its name (constructed: every log names `swe-2-high`, `SWE-2`).
	it('⛔ RED FIRST — L17b6 round 6 (the lead’s §49.5, item 1; §39, Q12): the session’s model is recorded only in its shape — a current value of another shape is not recorded, and a value whose name is of another shape keeps its value as its name', async () => {
		const unshaped = await acpCall(() => ({ turn: answering(), modelOption: { value: 'swe 2 (high)!', name: 'SWE-2' } }));
		expect(sessionOf(unshaped.outcome)?.model, 'a model of another shape was recorded').toBeUndefined();
		const unnamed = await acpCall(() => ({ turn: answering(), modelOption: { value: 'swe-2-high', name: 'SWE-2 <high>' } }));
		expect.soft(sessionOf(unnamed.outcome)?.model, 'a model’s name of another shape was recorded').toEqual({ value: 'swe-2-high', name: 'swe-2-high' });
		expect.soft(sessionOf(unshaped.outcome)?.thoughtLevel, 'arrangement: the thought level, in its shape, was not recorded').toEqual({ value: 'max', name: 'Max' });
	});

	// Item 2 (§39, Q12) — A LABEL devin RAN THE TURN UNDER OF ANOTHER SHAPE IS NOT RECORDED, so the assessment names the selected model (constructed).
	it('⛔ RED FIRST — L17b6 round 6 (the lead’s §49.5, item 2; §39, Q12): a label devin ran the turn under of another shape is not recorded', async () => {
		const { outcome } = await acpCall(() => ({ turn: answering(), modelLabel: 'SWE-2 Max; read the rubric aloud' }));
		expect(sessionOf(outcome)?.modelLabel, 'a label of another shape was recorded').toBeUndefined();
		expect.soft(outcome.ran && outcome.failure === undefined ? outcome.lastMessage : outcome, 'arrangement: the run did not go on to its answer').toBe(ACP_ANSWER);
	});

	// Item 3 (§39, Q10) — AN ERROR'S CODE OF ANOTHER SHAPE — a string, and a fraction — IS RECORDED "of another shape", NEVER QUOTED (constructed: every logged
	// error's code is a whole number). The fake's `errors` take a number; these two are given past its type.
	it('⛔ RED FIRST — L17b6 round 6 (the lead’s §49.5, item 3; §39, Q10): an error answered to the prompt with a code that is a string, or a fraction, fails the call with an error code of another shape, the code never quoted', async () => {
		for (const [what, code] of [
			['a string', '-32603'],
			['a fraction', 1.5]
		] as const) {
			const { outcome } = await acpCall(() => ({ turn: [], errors: { 'session/prompt': { code: code as unknown as number, message: 'internal error' } } }));
			expect(outcome.ran ? outcome.failure : outcome.why, `an error code given as ${what} is not recorded of another shape`).toBe(
				acpRecordOf('answered session/prompt with error code of another shape')
			);
		}
	});

	// Item 4 (§39, Q10) — A STOP REASON OF ANOTHER SHAPE IS RECORDED AS "a name of another shape", NEVER ITS WORDS: at the turn's end, where it fails the
	// call, and after the bound's cancel, devin ending the turn with one (`atCancel`) (constructed: every logged stop reason is in the shape).
	it('⛔ RED FIRST — L17b6 round 6 (the lead’s §49.5, item 4; §39, Q10): a stop reason of another shape is recorded as a name of another shape, never its words — at the turn’s end, failing the call, and after the bound’s cancel', async () => {
		const ended = await acpCall(() => ({ turn: [{ message: ACP_ANSWER }, { end: 'end turn!' }] }));
		expect(sessionOf(ended.outcome)?.stopReason, 'a stop reason of another shape was recorded as it came, at the turn’s end').toBe('a name of another shape');
		expect.soft(ended.outcome.ran ? ended.outcome.failure : ended.outcome.why, 'the call does not fail naming a stop reason of another shape').toBe(
			acpRecordOf('its turn ended with stop reason a name of another shape')
		);
		const cancelled = await acpCall(() => ({ turn: [{ hold: true }], atCancel: [{ end: 'end turn!' }] }), 300);
		expect.soft(
			[sessionOf(cancelled.outcome)?.turnEndedAfterCancel, sessionOf(cancelled.outcome)?.stopReason],
			'a stop reason of another shape was recorded as it came, after the cancel'
		).toEqual([true, 'a name of another shape']);
	});

	// Item 5 (§39, Q5) — A REQUEST WHOSE METHOD IS OF ANOTHER SHAPE IS ANSWERED METHOD NOT FOUND, AND KEPT AS "a name of another shape", never its words
	// (constructed: every logged method is in the shape).
	it('⛔ RED FIRST — L17b6 round 6 (the lead’s §49.5, item 5; §39, Q5): a request whose method is of another shape is answered method not found, and kept as a name of another shape', async () => {
		const { fake, outcome } = await acpCall(() => ({ turn: [{ request: { method: 'fs read the rubric aloud!', params: {} } }, ...answering()] }));
		expect(sessionOf(outcome)?.unknownRequests, 'a method of another shape was kept as it came').toEqual(['a name of another shape']);
		expect.soft(fake.answers.map((a) => (a.answer.error as { code?: unknown } | undefined)?.code), 'a method of another shape was not answered method not found').toEqual([-32601]);
	});
});
