// ⭐ `JAN-EXEC` Phase 7, P7-4d (DESIGN-the-live-end-to-end-run.md §6) — THE PER-COMMAND RE-RUNNER, TESTED ON THE REFERENCE
// FIXTURE: each recorded `node --test` command's evidence verdict, beside our own re-run of the same argv.
//
// `scripts/phase7/rerun-commands.ts` reads a COMMAND MANIFEST (its format is defined there, for round 2's live lane to
// write) and re-runs ONE UNIT's `node --test` commands on private copies of THAT UNIT's archived workspace, with
// `--test-timeout` and the child-process runner's environment allowlist. It says, per command, whether the re-run
// reproduces the recorded exit. So:
//   · ⭐ the two things it MIRRORS from the product — the allowlist and the per-command timeout, neither exported — are
//     read back out of the product's own source, at the lines the mirror cites, and must match;
//   · ⭐ the manifest's format is enforced: each malformed field is refused BY NAME, before anything runs — ⛔ an argument
//     naming an absolute path among them, which named the operator's account and let a re-run reach the original tree;
//   · ⭐ a recorded exit the re-run reproduces AGREES — and ⛔ one it does not (the fixture's first command records exit 1
//     for a suite that passes) DISAGREES: the tool can disagree;
//   · ⛔ ONE UNIT, ON ITS OWN ARCHIVE: a manifest of two units' commands names one (`--unit`), and the workspace given must
//     be the tree the manifest records for that unit (`treeSha256`) — a later unit's archive is refused, never re-run
//     against an earlier unit's record and read as a record that does not reproduce;
//   · ⛔ a command that is not `node --test` is NOT_RERUN, never started — `node bin/wordfreq.js --help` included — and
//     so is one whose argument climbs out of the workspace;
//   · ⛔ a re-run never cuts what the record allowed: its default per-test deadline is the command's, and a re-run whose
//     shorter deadline cut a test is NOT_COMPARABLE, never DISAGREES;
//   · ⛔ THE ALLOWLIST IS APPLIED, NOT DECLARED: a probe test that fails when a variable outside the list reaches it passes
//     under the re-runner with that variable set in the parent — and the same probe, run with the parent's whole
//     environment, FAILS, so the probe is shown able to see a leak;
//   · ⭐ the given workspace is never touched by the re-runner — and ⛔ a test that writes into it anyway, by an absolute
//     path in its own code, is caught doing so, and the commands after it still run on the tree as it was.
//
// No model is called.
import { createHash } from 'node:crypto';
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runNodeTests, workspaceTreeSha256 } from '../scripts/phase7/node-tests.js';
import {
	EXECUTION_COMMAND_TIMEOUT_MS,
	INHERITED_ENVIRONMENT_NAMES,
	MIRRORED_FROM,
	runnerEnvironment
} from '../scripts/phase7/runner-environment.js';
import {
	exitAgreement,
	isNodeTestRun,
	main,
	manifestProblems,
	rerunArgv,
	rerunCommands,
	type CommandManifest,
	type RerunReport
} from '../scripts/phase7/rerun-commands.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = join(ROOT, 'verif', 'fixtures', 'phase7');
const REFERENCE = join(FIXTURES, 'reference');
const MANIFEST = JSON.parse(readFileSync(join(FIXTURES, 'command-manifest.json'), 'utf8')) as CommandManifest;
const RUN_BUDGET_MS = 180_000;

const dirs: string[] = [];
afterAll(() => {
	for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
afterEach(() => {
	vi.unstubAllEnvs();
});

/** The quoted strings of the array literal declared as `const <name> = [` in `text`, or undefined if none is. */
function declaredList(text: string, name: string): string[] | undefined {
	const m = new RegExp(`const ${name} = \\[([^\\]]*)\\];`).exec(text);
	if (!m) return undefined;
	return [...m[1]!.matchAll(/'([^']*)'/g)].map((q) => q[1]!);
}

/** The 1-based line of `text` on which `needle` first appears, or undefined. */
function lineOf(text: string, needle: string): number | undefined {
	const at = text.indexOf(needle);
	return at === -1 ? undefined : text.slice(0, at).split('\n').length;
}

function treeDigest(dir: string): Record<string, string> {
	const out: Record<string, string> = {};
	const walk = (d: string) => {
		for (const name of readdirSync(d)) {
			const p = join(d, name);
			if (statSync(p).isDirectory()) walk(p);
			else out[relative(dir, p).split('\\').join('/')] = createHash('sha256').update(readFileSync(p)).digest('hex');
		}
	};
	walk(dir);
	return out;
}

function copyOfReference(extra: Readonly<Record<string, string>> = {}): string {
	const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-rerun-'));
	dirs.push(ws);
	cpSync(REFERENCE, ws, { recursive: true });
	for (const [file, text] of Object.entries(extra)) writeFileSync(join(ws, file), text);
	return ws;
}

type Command = CommandManifest['commands'][number];

const command = (over: Partial<Command>): Command => ({
	unit: 'IMPLEMENTATION',
	ordinal: 1,
	argv: ['node', '--test', 'test/unit/*.test.js'],
	cwd: '.',
	exitCode: 0,
	timedOut: false,
	evidenceId: 'evd_01M9P7X4K8W2N6Q3R5T7V9Y1Z1',
	evidenceVerdict: 'SATISFIED',
	...over
});

/** A one-unit manifest of `commands` whose unit's tree is `ws` as it is now. */
const manifestOn = (ws: string, commands: readonly Command[]): CommandManifest => ({
	manifestVersion: 1,
	units: [...new Set(commands.map((c) => c.unit))].map((unit) => ({ unit, treeSha256: workspaceTreeSha256(ws) })),
	commands
});

const outcomes = (r: RerunReport) => r.outcomes.map((o) => o.outcome);

describe('JAN-EXEC P7-4d — what the re-runner mirrors from the product', () => {
	const runner = readFileSync(join(ROOT, MIRRORED_FROM.environment.file), 'utf8');
	const surface = readFileSync(join(ROOT, MIRRORED_FROM.timeout.file), 'utf8');

	it('⭐ the environment allowlist is the child-process runner’s own, declared at the line the mirror cites', () => {
		expect(declaredList(runner, 'INHERITED_ENVIRONMENT_NAMES')).toEqual([...INHERITED_ENVIRONMENT_NAMES]);
		expect(lineOf(runner, 'const INHERITED_ENVIRONMENT_NAMES = [')).toBe(MIRRORED_FROM.environment.line);
		// ⛔ Still not exported: were it exported, the mirror should become an import.
		expect(runner).not.toMatch(/export const INHERITED_ENVIRONMENT_NAMES/);
	});

	it('⭐ the per-command timeout is the execution tool surface’s own, declared at the line the mirror cites', () => {
		const declared = /const EXECUTION_COMMAND_TIMEOUT_MS = ([0-9_]+);/.exec(surface)?.[1];
		expect(declared, 'the declaration is found').toBeDefined();
		expect(Number(declared?.replace(/_/g, ''))).toBe(EXECUTION_COMMAND_TIMEOUT_MS);
		expect(lineOf(surface, 'const EXECUTION_COMMAND_TIMEOUT_MS =')).toBe(MIRRORED_FROM.timeout.line);
		expect(surface).not.toMatch(/export const EXECUTION_COMMAND_TIMEOUT_MS/);
	});

	it('⛔ CONTROL — the source reader is not blind: it finds a list, and a changed list is a different list', () => {
		const list = declaredList(runner, 'INHERITED_ENVIRONMENT_NAMES');
		expect(list?.length).toBeGreaterThan(20);
		expect(declaredList(runner.replace("'TZ'", "'TZ',\n\t'JPWB_SECRET'"), 'INHERITED_ENVIRONMENT_NAMES')).not.toEqual([
			...INHERITED_ENVIRONMENT_NAMES
		]);
		expect(declaredList('nothing here', 'INHERITED_ENVIRONMENT_NAMES')).toBeUndefined();
	});

	it('⭐ runnerEnvironment keeps a name on the list, matched case-insensitively, and drops everything else', () => {
		expect(
			runnerEnvironment({ Path: 'p', TEMP: 't', JPWB_ASSURANCE_MODEL: 'secret-model', OPENAI_API_KEY: 'k', tz: 'UTC' })
		).toEqual({ Path: 'p', TEMP: 't', tz: 'UTC' });
	});
});

describe('JAN-EXEC P7-4d — the command manifest', () => {
	it('⭐ the fixture manifest is well formed', () => {
		expect(manifestProblems(MANIFEST)).toEqual([]);
	});

	it('⭐ the fixture records the reference as the tree both its units ended on — pinned, so an edit to the reference re-pins it', () => {
		// Both units of the fixture ran on the reference, unchanged: IMPLEMENTATION's end state IS the reference, and
		// END_TO_END wrote nothing. ⚠ An edit to any file of the reference changes this digest; the fixture's two
		// `treeSha256` are then re-pinned to `workspaceTreeSha256(REFERENCE)`, deliberately.
		const tree = workspaceTreeSha256(REFERENCE);
		expect(MANIFEST.units.map((u) => [u.unit, u.treeSha256])).toEqual([
			['IMPLEMENTATION', tree],
			['END_TO_END', tree]
		]);
	});

	it('⭐ the tree digest is the one the format defines: one "<sha256> <path>" line per file, by path, `.git` left out', () => {
		const ws = mkdtempSync(join(tmpdir(), 'jpwb-p7-tree-'));
		dirs.push(ws);
		mkdirSync(join(ws, 'b'));
		mkdirSync(join(ws, '.git'));
		writeFileSync(join(ws, 'b', 'z.txt'), 'zed');
		writeFileSync(join(ws, 'a.txt'), 'ay');
		writeFileSync(join(ws, '.git', 'HEAD'), 'ref: refs/heads/main');
		const sha = (s: string) => createHash('sha256').update(s).digest('hex');
		const expected = sha(`${sha('ay')} a.txt\n${sha('zed')} b/z.txt\n`);
		expect(workspaceTreeSha256(ws)).toBe(expected);
		// ⛔ It sees one byte: the digest is not blind to content.
		writeFileSync(join(ws, 'b', 'z.txt'), 'zee');
		expect(workspaceTreeSha256(ws)).not.toBe(expected);
	});

	const units = [{ unit: 'IMPLEMENTATION', treeSha256: 'a'.repeat(64) }];
	it.each([
		['a missing version', { ...MANIFEST, manifestVersion: undefined }, 'manifestVersion must be 1'],
		['an unknown top-level key', { ...MANIFEST, extra: 1 }, 'unknown key "extra" at the top level'],
		['an unknown command key', { ...MANIFEST, commands: [{ ...command({}), exit_code: 0 }] }, 'commands[0]: unknown key "exit_code"'],
		['an empty argv', { ...MANIFEST, commands: [command({ argv: [] })] }, 'commands[0].argv must be a non-empty array of strings'],
		['an absolute cwd', { ...MANIFEST, commands: [command({ cwd: 'C:/Users/someone/ws' })] }, 'commands[0].cwd must be relative to the workspace'],
		['a POSIX absolute cwd', { ...MANIFEST, commands: [command({ cwd: '/home/someone/ws' })] }, 'commands[0].cwd must be relative to the workspace'],
		['a cwd that climbs out', { ...MANIFEST, commands: [command({ cwd: '../elsewhere' })] }, 'commands[0].cwd may not leave the workspace'],
		['a fractional exit code', { ...MANIFEST, commands: [command({ exitCode: 1.5 })] }, 'commands[0].exitCode must be an integer or null'],
		['an unknown verdict', { ...MANIFEST, commands: [command({ evidenceVerdict: 'PASSED' as never })] }, 'commands[0].evidenceVerdict must be one of'],
		['evidence with no id', { ...MANIFEST, commands: [command({ evidenceId: null })] }, 'commands[0]: evidenceId is null exactly when evidenceVerdict is NOT_EVIDENCE'],
		['no evidence with an id', { ...MANIFEST, commands: [command({ evidenceVerdict: 'NOT_EVIDENCE' })] }, 'commands[0]: evidenceId is null exactly when evidenceVerdict is NOT_EVIDENCE'],
		['a repeated unit and ordinal', { ...MANIFEST, commands: [command({}), command({})] }, 'commands[1]: IMPLEMENTATION #1 is recorded twice'],
		['no units', { manifestVersion: 1, commands: [command({})] }, 'units must be an array'],
		['a unit with no entry in units', { manifestVersion: 1, units: [], commands: [command({})] }, 'commands[0]: unit "IMPLEMENTATION" has no entry in units'],
		['a unit listed twice', { manifestVersion: 1, units: [...units, ...units], commands: [command({})] }, 'units[1]: IMPLEMENTATION is listed twice'],
		['a malformed tree digest', { manifestVersion: 1, units: [{ unit: 'IMPLEMENTATION', treeSha256: 'ABC' }], commands: [command({})] }, 'units[0].treeSha256 must be 64 lower-case hex digits'],
		['an unknown units key', { manifestVersion: 1, units: [{ ...units[0], sha: 'x' }], commands: [command({})] }, 'units[0]: unknown key "sha"'],
		[
			'an absolute Windows path in argv',
			{ ...MANIFEST, commands: [command({ argv: ['node', '--test', 'C:/Users/someone/ws/test/unit/a.test.js'] })] },
			'commands[0].argv[2] names an absolute path'
		],
		[
			'an absolute POSIX path in argv',
			{ ...MANIFEST, commands: [command({ argv: ['node', '--test', '/home/someone/ws/test/unit/a.test.js'] })] },
			'commands[0].argv[2] names an absolute path'
		],
		[
			'a UNC path in argv',
			{ ...MANIFEST, commands: [command({ argv: ['node', '--test', '\\\\host\\share\\a.test.js'] })] },
			'commands[0].argv[2] names an absolute path'
		],
		[
			'an absolute path in an option’s value',
			{ ...MANIFEST, commands: [command({ argv: ['node', '--test-reporter-destination=C:\\out\\r.txt', '--test'] })] },
			'commands[0].argv[1] names an absolute path'
		],
		[
			'a file: URL in argv',
			{ ...MANIFEST, commands: [command({ argv: ['node', '--import=file:///C:/x/setup.mjs', '--test'] })] },
			'commands[0].argv[1] names an absolute path'
		]
	])('⛔ %s is refused, by name', (_label, manifest, message) => {
		const problems = manifestProblems(manifest);
		expect(problems.some((p) => p.startsWith(message)), problems.join('\n')).toBe(true);
	});

	it('⭐ a test-name pattern is not a path: /…/ given to --test-name-pattern or --test-skip-pattern is no absolute path', () => {
		for (const argv of [
			['node', '--test', '--test-name-pattern=/^reads/', 'test/unit/a.test.js'],
			['node', '--test', '--test-name-pattern', '/^reads/', 'test/unit/a.test.js'],
			['node', '--test', '--test-skip-pattern=/slow/i']
		])
			expect(manifestProblems({ ...MANIFEST, commands: [command({ argv })] }), argv.join(' ')).toEqual([]);
	});
});

describe('JAN-EXEC P7-4d — which commands are re-run, and how', () => {
	it('⭐ a node --test run, by program name and the --test flag', () => {
		expect(isNodeTestRun(['node', '--test', 'test/unit/*.test.js'])).toBe(true);
		expect(isNodeTestRun(['node.exe', '--test'])).toBe(true);
		expect(isNodeTestRun(['C:\\Program Files\\nodejs\\node.exe', '--test', 'x.test.js'])).toBe(true);
		expect(isNodeTestRun(['/usr/bin/node', '--experimental-test-coverage', '--test'])).toBe(true);
		expect(isNodeTestRun(['node', 'bin/wordfreq.js', '--help'])).toBe(false);
		expect(isNodeTestRun(['node', '--test-only', 'x.test.js'])).toBe(false);
		expect(isNodeTestRun(['git', 'status'])).toBe(false);
		expect(isNodeTestRun(['bun', '--test'])).toBe(false);
	});

	it('⭐ --test-timeout is added after the program unless the argv already sets one', () => {
		expect(rerunArgv(['node', '--test', 'a.test.js'], 30_000)).toEqual(['node', '--test-timeout=30000', '--test', 'a.test.js']);
		expect(rerunArgv(['node', '--test-timeout=5000', '--test'], 30_000)).toEqual(['node', '--test-timeout=5000', '--test']);
		expect(rerunArgv(['node', '--test-timeout', '5000', '--test'], 30_000)).toEqual(['node', '--test-timeout', '5000', '--test']);
	});

	it('⭐ an exit agrees when its code AND its timing out agree — ⛔ a signal kill and a deadline kill are not the same exit', () => {
		expect(exitAgreement({ exitCode: 0, timedOut: false }, { exitCode: 0, timedOut: false })).toBe(true);
		expect(exitAgreement({ exitCode: 1, timedOut: false }, { exitCode: 0, timedOut: false })).toBe(false);
		// Both report no exit code: one because a signal ended it, the other because the deadline did.
		expect(exitAgreement({ exitCode: null, timedOut: false }, { exitCode: null, timedOut: true })).toBe(false);
		expect(exitAgreement({ exitCode: null, timedOut: true }, { exitCode: null, timedOut: true })).toBe(true);
	});
});

describe('JAN-EXEC P7-4d — re-running one unit’s commands on its own archive', () => {
	it(
		'⭐ unit IMPLEMENTATION: AGREES where the re-run reproduces the recorded exit; ⛔ DISAGREES where it does not; NOT_RERUN for anything else',
		async () => {
			const before = treeDigest(REFERENCE);
			const r = await rerunCommands(MANIFEST, REFERENCE, { unit: 'IMPLEMENTATION' });
			expect(r.unit).toBe('IMPLEMENTATION');
			expect(
				r.outcomes.map((o) => [o.unit, o.ordinal, o.outcome, o.recorded.exitCode, o.rerun?.exitCode ?? null, o.lastOfItsArgv])
			).toEqual([
				// The fail-then-fix shape: the first run of the suite recorded 1; on the archived workspace it passes.
				['IMPLEMENTATION', 1, 'DISAGREES', 1, 0, false],
				['IMPLEMENTATION', 2, 'NOT_RERUN', 0, null, true],
				['IMPLEMENTATION', 3, 'AGREES', 0, 0, true]
			]);
			expect(r.counts).toEqual({
				commands: 3,
				rerun: 2,
				agrees: 1,
				disagrees: 1,
				notComparable: 0,
				notRerun: 1,
				notStarted: 0,
				touchedOriginal: 0
			});
			// The evidence verdict is carried beside each outcome, never compared to an exit code.
			expect(r.outcomes.map((o) => o.evidenceVerdict)).toEqual(['REJECTED', 'SATISFIED', 'SATISFIED']);
			// ⛔ The per-test deadline is the COMMAND's, so a re-run never cuts a test the recorded run was allowed to finish.
			expect(r.testTimeoutMs).toBe(EXECUTION_COMMAND_TIMEOUT_MS);
			expect(r.outcomes[2]?.rerun?.argv).toEqual(['node', '--test-timeout=120000', '--test', 'test/unit/*.test.js']);
			expect(r.outcomes[2]?.rerun?.tests).toEqual({ passed: 40, failed: 0, cancelled: 0 });
			expect(r.commandTimeoutMs).toBe(EXECUTION_COMMAND_TIMEOUT_MS);
			expect(treeDigest(REFERENCE), 'the given workspace is byte-identical afterwards').toEqual(before);
		},
		RUN_BUDGET_MS
	);

	it(
		'⭐ unit END_TO_END: its one command, on the same tree, AGREES',
		async () => {
			const r = await rerunCommands(MANIFEST, REFERENCE, { unit: 'END_TO_END' });
			expect(r.outcomes.map((o) => [o.unit, o.ordinal, o.outcome, o.evidenceVerdict])).toEqual([
				['END_TO_END', 1, 'AGREES', 'NOT_EVIDENCE']
			]);
		},
		RUN_BUDGET_MS
	);

	it('⛔ a manifest of two units’ commands with no unit named runs nothing, and says which units there are', async () => {
		await expect(rerunCommands(MANIFEST, REFERENCE)).rejects.toThrow(
			/holds the commands of 2 units \(IMPLEMENTATION, END_TO_END\): name one/
		);
		await expect(rerunCommands(MANIFEST, REFERENCE, { unit: 'DESIGN' })).rejects.toThrow(/unit "DESIGN" is not in the manifest/);
	});

	it(
		'⛔ TWO UNITS, TWO ARCHIVES: a unit’s commands run on its own archive, and a later unit’s archive is refused for them',
		async () => {
			// The later unit added a test that fails, and recorded its run of the same argv as exit 1. On the earlier unit's
			// archive the argv passes; on the later one it fails. Re-run against the wrong archive, the earlier unit's honest
			// exit 0 would read DISAGREES — "a record that does not reproduce" — for a tree it never ran on.
			const earlier = copyOfReference();
			const later = copyOfReference({
				'test/unit/later.test.js':
					"import assert from 'node:assert/strict';\nimport { test } from 'node:test';\ntest('added by the later unit', () => assert.equal(1, 2));\n"
			});
			const manifest: CommandManifest = {
				manifestVersion: 1,
				units: [
					{ unit: 'IMPLEMENTATION', treeSha256: workspaceTreeSha256(earlier) },
					{ unit: 'END_TO_END', treeSha256: workspaceTreeSha256(later) }
				],
				commands: [
					command({ unit: 'IMPLEMENTATION', ordinal: 1, exitCode: 0 }),
					command({ unit: 'END_TO_END', ordinal: 1, exitCode: 1, evidenceVerdict: 'REJECTED' })
				]
			};
			const mine = await rerunCommands(manifest, earlier, { unit: 'IMPLEMENTATION' });
			expect(mine.outcomes.map((o) => [o.unit, o.outcome, o.lastOfItsArgv])).toEqual([['IMPLEMENTATION', 'AGREES', true]]);
			const theirs = await rerunCommands(manifest, later, { unit: 'END_TO_END' });
			expect(theirs.outcomes.map((o) => [o.unit, o.outcome, o.rerun?.exitCode])).toEqual([['END_TO_END', 'AGREES', 1]]);
			await expect(rerunCommands(manifest, later, { unit: 'IMPLEMENTATION' })).rejects.toThrow(
				/is not the archive the manifest records for unit IMPLEMENTATION/
			);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ a manifest the format refuses runs nothing: rerunCommands throws, naming the problems',
		async () => {
			await expect(rerunCommands({ ...MANIFEST, manifestVersion: 2 } as never, REFERENCE)).rejects.toThrow(
				/manifestVersion must be 1/
			);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ an argv naming the workspace by its ABSOLUTE path is refused before anything runs: the original tree is never reached',
		async () => {
			// The verifier's arrangement: the test writes a marker beside ITSELF. Named by the original's absolute path, a
			// re-run would run the ORIGINAL file, and write the marker into the original tree.
			const marker = [
				"import { writeFileSync } from 'node:fs';",
				"import { test } from 'node:test';",
				"test('writes a marker beside itself', () => writeFileSync(new URL('./ran-here.txt', import.meta.url), 'x'));",
				''
			].join('\n');
			const ws = copyOfReference({ 'test/unit/marker.test.js': marker });
			const before = treeDigest(ws);
			const manifest = manifestOn(ws, [command({ argv: ['node', '--test', join(ws, 'test', 'unit', 'marker.test.js')] })]);
			await expect(rerunCommands(manifest, ws, {})).rejects.toThrow(/commands\[0\]\.argv\[2\] names an absolute path/);
			expect(existsSync(join(ws, 'test', 'unit', 'ran-here.txt'))).toBe(false);
			expect(treeDigest(ws)).toEqual(before);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ an argument that climbs out of the workspace is NOT_RERUN, and never started: nothing outside the copy runs',
		async () => {
			// A test placed where `..` from a COPY would reach it — beside the copies, in the OS temp folder — writes a
			// marker if it is ever run.
			const outside = mkdtempSync(join(tmpdir(), 'jpwb-p7-outside-'));
			dirs.push(outside);
			writeFileSync(
				join(outside, 'escape.test.js'),
				"import { writeFileSync } from 'node:fs';\nimport { test } from 'node:test';\n" +
					"test('runs outside', () => writeFileSync(new URL('./ran-outside.txt', import.meta.url), 'x'));\n"
			);
			const ws = copyOfReference();
			const r = await rerunCommands(
				manifestOn(ws, [command({ argv: ['node', '--test', `../${basename(outside)}/escape.test.js`] })]),
				ws
			);
			expect(outcomes(r)).toEqual(['NOT_RERUN']);
			expect(r.outcomes[0]?.rerun).toBeNull();
			expect(r.outcomes[0]?.note).toMatch(/leaves the workspace/);
			expect(existsSync(join(outside, 'ran-outside.txt'))).toBe(false);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ a re-run whose shorter per-test deadline cut a test is NOT_COMPARABLE — never DISAGREES — and the cut is counted',
		async () => {
			const slow = [
				"import { test } from 'node:test';",
				"test('takes a second and a half', async () => { await new Promise((done) => setTimeout(done, 1500)); });",
				''
			].join('\n');
			const ws = copyOfReference({ 'test/unit/slow.test.js': slow });
			const manifest = manifestOn(ws, [command({ argv: ['node', '--test', 'test/unit/slow.test.js'] })]);
			const cut = await rerunCommands(manifest, ws, { testTimeoutMs: 300 });
			expect(outcomes(cut)).toEqual(['NOT_COMPARABLE']);
			expect(cut.outcomes[0]?.rerun?.tests).toEqual({ passed: 0, failed: 0, cancelled: 1 });
			expect(cut.outcomes[0]?.note).toMatch(/cut 1 test/);
			expect(cut.counts.notComparable).toBe(1);
			// ⭐ At the default — the command's own deadline — the same test runs to its end, and the record reproduces.
			const whole = await rerunCommands(manifest, ws);
			expect(outcomes(whole)).toEqual(['AGREES']);
			expect(whole.outcomes[0]?.rerun?.tests).toEqual({ passed: 1, failed: 0, cancelled: 0 });
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ CONTROL — the allowlist is APPLIED: a variable outside it never reaches the re-run, and the probe can see one',
		async () => {
			const probe = [
				"import assert from 'node:assert/strict';",
				"import { test } from 'node:test';",
				"test('no stray variable', () => assert.equal(process.env.JPWB_P7_RERUN_PROBE, undefined));",
				''
			].join('\n');
			const ws = copyOfReference({ 'test/unit/probe.test.js': probe });
			vi.stubEnv('JPWB_P7_RERUN_PROBE', 'leaked');
			const r = await rerunCommands(manifestOn(ws, [command({ argv: ['node', '--test', 'test/unit/probe.test.js'] })]), ws);
			expect(outcomes(r)).toEqual(['AGREES']);
			// ⛔ The probe is not blind: given the parent's WHOLE environment, the same test fails.
			const leaked = await runNodeTests({
				cwd: ws,
				files: ['test/unit/probe.test.js'],
				env: Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))
			});
			expect(leaked.exitCode).toBe(1);
			expect(leaked.failed).toBe(1);
		},
		RUN_BUDGET_MS
	);

	it(
		'⭐ the given workspace is never touched: a command that writes into its copy leaves the original identical',
		async () => {
			const writer = [
				"import { writeFileSync } from 'node:fs';",
				"import { test } from 'node:test';",
				"test('writes a file into the workspace', () => writeFileSync('written-by-a-test.txt', 'x'));",
				''
			].join('\n');
			const ws = copyOfReference({ 'test/unit/writer.test.js': writer });
			const before = treeDigest(ws);
			const r = await rerunCommands(manifestOn(ws, [command({ argv: ['node', '--test', 'test/unit/writer.test.js'] })]), ws);
			expect(outcomes(r)).toEqual(['AGREES']);
			expect(r.outcomes[0]?.touchedOriginal).toBe(false);
			expect(treeDigest(ws)).toEqual(before);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ a test that writes into the ORIGINAL by an absolute path in its own code is caught, and the next command still runs on the tree as it was',
		async () => {
			// No argv rule can see this: the path is in the test's code. So the original is hashed after every command, and
			// every copy is taken from a private copy made before the first — never from the original, which may have changed.
			const ws = copyOfReference();
			const escaped = join(ws, 'escaped.txt');
			writeFileSync(
				join(ws, 'test', 'unit', 'escape.test.js'),
				"import { writeFileSync } from 'node:fs';\nimport { test } from 'node:test';\n" +
					`test('writes into the original', () => writeFileSync(${JSON.stringify(escaped)}, 'x'));\n`
			);
			writeFileSync(
				join(ws, 'test', 'unit', 'check.test.js'),
				"import assert from 'node:assert/strict';\nimport { existsSync } from 'node:fs';\nimport { test } from 'node:test';\n" +
					"test('its copy holds no escaped file', () => assert.equal(existsSync('escaped.txt'), false));\n"
			);
			const manifest = manifestOn(ws, [
				command({ ordinal: 1, argv: ['node', '--test', 'test/unit/escape.test.js'] }),
				command({ ordinal: 2, argv: ['node', '--test', 'test/unit/check.test.js'] })
			]);
			const dir = mkdtempSync(join(tmpdir(), 'jpwb-p7-rerun-cli-'));
			dirs.push(dir);
			writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest));
			const said: string[] = [];
			const out = join(dir, 'report.json');
			await expect(
				main(['--manifest', join(dir, 'manifest.json'), '--workspace', ws, '--out', out], (s) => said.push(s))
			).resolves.toBe(3);
			const r = JSON.parse(readFileSync(out, 'utf8')) as RerunReport;
			expect(r.outcomes.map((o) => [o.ordinal, o.outcome, o.touchedOriginal])).toEqual([
				[1, 'AGREES', true],
				[2, 'AGREES', false]
			]);
			expect(r.outcomes[0]?.note).toMatch(/wrote into the given workspace/);
			expect(r.counts.touchedOriginal).toBe(1);
			expect(said.join('')).toMatch(/the given workspace CHANGED/);
			expect(existsSync(escaped)).toBe(true);
		},
		RUN_BUDGET_MS
	);

	it(
		'⛔ a cwd the copy does not hold is NOT_STARTED, with the reason, and is not counted as a re-run',
		async () => {
			const r = await rerunCommands(manifestOn(REFERENCE, [command({ cwd: 'no-such-dir' })]), REFERENCE);
			expect(outcomes(r)).toEqual(['NOT_STARTED']);
			expect(r.outcomes[0]?.note).toMatch(/no-such-dir/);
			expect(r.counts).toMatchObject({ commands: 1, rerun: 0, agrees: 0, disagrees: 0, notRerun: 0, notStarted: 1 });
		},
		RUN_BUDGET_MS
	);
});

describe('JAN-EXEC P7-4d — the command line', () => {
	/** ⚠ A throw becomes the code's value, so a refusal that is missing fails as an ASSERTION naming the throw, never as the throw. */
	const run = async (args: readonly string[]) => {
		const said: string[] = [];
		const code = await main(args, (s) => said.push(s)).catch((e: unknown) => `threw: ${(e as Error).message}`);
		return { code, said: said.join('') };
	};
	const files = () => {
		const dir = mkdtempSync(join(tmpdir(), 'jpwb-p7-rerun-cli-'));
		dirs.push(dir);
		writeFileSync(join(dir, 'manifest.json'), JSON.stringify(MANIFEST));
		return { manifest: join(dir, 'manifest.json'), out: join(dir, 'report.json') };
	};

	it('⛔ two units and no --unit: refused, exit 2, nothing written', async () => {
		const f = files();
		const r = await run(['--manifest', f.manifest, '--workspace', REFERENCE, '--out', f.out]);
		expect(r.code).toBe(2);
		expect(r.said).toMatch(/name one/);
		expect(existsSync(f.out)).toBe(false);
	});

	it('⛔ --unit with a workspace that is not that unit’s archive: refused, exit 2, nothing written', async () => {
		const f = files();
		const other = copyOfReference({ 'NOTES.md': 'a file the unit never had\n' });
		const r = await run(['--manifest', f.manifest, '--workspace', other, '--out', f.out, '--unit', 'END_TO_END']);
		expect(r.code).toBe(2);
		expect(r.said).toMatch(/is not the archive the manifest records for unit END_TO_END/);
		expect(existsSync(f.out)).toBe(false);
	});

	it(
		'⭐ --unit with that unit’s archive: written, exit 0',
		async () => {
			const f = files();
			const r = await run(['--manifest', f.manifest, '--workspace', REFERENCE, '--out', f.out, '--unit', 'END_TO_END']);
			expect(r.code).toBe(0);
			expect((JSON.parse(readFileSync(f.out, 'utf8')) as RerunReport).outcomes.map((o) => o.outcome)).toEqual(['AGREES']);
		},
		RUN_BUDGET_MS
	);
});
