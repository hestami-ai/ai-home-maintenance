// ⭐⭐ JAN-EXEC PHASE 3 — the victim for CAPABILITY → TOOLS, BY ABSENCE.
//
// ⛔ THE CLAIM UNDER TEST IS AN ABSENCE, which is why it has to be asserted here rather than read off the
// source: an ungranted tool is NEVER MINTED, so there is no handler to call, no refusal to observe, and nothing
// in a trace to distinguish "the model was offered it and declined" from "the model was never told". The only
// thing that can carry that claim is a case which arranges the grant and counts what came back.
//
// ⚠ EVERY DIRECTORY HERE IS UNDER `os.tmpdir()`, NEVER UNDER THE REPOSITORY — the rule
// `filesystem-workspace.test.ts` states, for the reason this whole phase exists.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordPlaneNameSchema } from '@janumipwb/rph-contracts';
import {
	createInMemoryWorkspace,
	createRefusingProcessRunner,
	type ProcessRunOutcome,
	type ProcessRunRequest,
	type ProcessRunner
} from '@janumipwb/rph-ports';
import { createFilesystemWorkspace } from '../execution/filesystem-workspace.js';
import {
	EXECUTION_TOOL_CATALOG,
	mintExecutionTools,
	type ExecutionToolTemplate
} from './execution-tool-surface.js';

let container = '';
let dir = '';

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-tools-'));
	dir = join(container, 'workspace');
	await mkdir(dir, { recursive: true });
});
afterEach(async () => {
	await rm(container, { recursive: true, force: true });
});

const deliverable = () =>
	createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_01ARZ3NDEKTSV4RRFFQ69G5PAA',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: dir
	});

/**
 * A runner that RECORDS what it was asked to run and answers without spawning anything.
 *
 * ⛔ A STUB, AND ITS LIMIT IS STATED RATHER THAN LEFT TO BE ASSUMED. What it can prove is the WIRING — that the
 * `cwd` came from the workspace and not from a caller, that the argv arrives unchanged, that a refusal is
 * reported as a refusal and a non-zero exit is not. What it CANNOT prove is that a real process starts; that is
 * `child-process-runner.test.ts`'s subject, and the live drive's.
 */
function recordingRunner(
	over: Partial<Extract<ProcessRunOutcome, { ran: true }>> = {}
): ProcessRunner & { seen: ProcessRunRequest[] } {
	const seen: ProcessRunRequest[] = [];
	return {
		kind: 'REAL',
		seen,
		run: async (request) => {
			seen.push(request);
			return {
				ran: true,
				exitCode: 0,
				timedOut: false,
				stdout: 'ok\n',
				stderr: '',
				omittedRegions: [],
				outputComplete: true,
				retention: { retained: false, notRetainedBecause: 'stub runner retains nothing' },
				durationMs: 1,
				...over
			};
		}
	};
}

/**
 * The status a live, usable binding carries.
 *
 * ⛔ NAMED, so the REVOKED arrangements below differ from every capability arrangement by exactly ONE token.
 * An arrangement that changed two things would leave the empty mint attributable to either.
 */
const AUTHORIZED = 'AUTHORIZED';

const mint = (
	granted: readonly string[],
	runner: ProcessRunner = recordingRunner(),
	// ⛔ `B-1` — THE BINDING'S STATUS IS PART OF EVERY MINT, because a capability list is not an authorization.
	// Defaulted HERE, in the helper, and never in `mintExecutionTools`: a default on the production function
	// would make "mint without asking whether the binding still stands" expressible by omission.
	bindingAuthorizationStatus: string = AUTHORIZED
) =>
	mintExecutionTools({
		ports: { workspace: deliverable(), runner },
		grantedCapabilities: granted,
		bindingAuthorizationStatus
	});

const names = (granted: readonly string[]) => mint(granted).map((t) => t.name);

describe('⭐⭐ GRANT BY ABSENCE — an unauthorised tool is never minted', () => {
	it('⛔ granted `network` only mints NOTHING — a model step with no file or process grant has no hands', () => {
		// ⭐ THE BASELINE CLAIM OF THE WHOLE PHASE. `network` is what the step REQUIRES to reach a provider; it
		// authorises no tool at all. THE MUTANT: mint the catalog unconditionally — every model step in the
		// system silently acquires a filesystem seam and a child process.
		expect(names(['network'])).toEqual([]);
	});

	// ── ⭐⭐ `B-1` — A REVOKED BINDING MINTED THE FULL TOOL SURFACE, AND §22.1 IS RATIFIED ─────────────────────
	//
	// ⛔ THE ARRANGEMENT IS WHAT THE STORE ACTUALLY HOLDS AFTER `RevokeRuntimeCapability`, which is what makes
	// it a test rather than a strawman: the handler advances `authorizationStatus` to REVOKED and DELIBERATELY
	// leaves `grantedCapabilities` INTACT, because the revocation EVENT is derived from the set the binding
	// held. So the grant below is FULL — and before this limb, minting saw exactly what it saw for a live
	// binding and handed a model a filesystem seam and a child process on an authorization that was withdrawn.
	it('⭐⭐ a REVOKED binding mints NOTHING, on a grant that authorises EVERY tool', () => {
		expect(
			mint(['network', 'file-system', 'process-execution'], recordingRunner(), 'REVOKED')
		).toEqual([]);
	});

	it('⛔ a DENIED binding mints nothing either — the kernel predicate names both terminal states', () => {
		expect(mint(['file-system', 'process-execution'], recordingRunner(), 'DENIED')).toEqual([]);
	});

	it('⭑⭑ CONTROL — the SAME full grant under AUTHORIZED mints both tools, so this is not "mint nothing"', () => {
		// ⭐ ONE TOKEN OF DIFFERENCE FROM THE CASE ABOVE. Without it the limb is satisfied by a `mintExecutionTools`
		// that returns `[]` unconditionally — *a control that cannot fail*, and one that would silently disarm
		// the entire tool surface while every refusal assertion in this file stayed green.
		expect(names(['network', 'file-system', 'process-execution'])).toEqual([
			'write_file',
			'run_command'
		]);
	});

	it('⭑ CONTROL — PARTIALLY_AUTHORIZED mints what it granted, because a NARROW grant is lawful', () => {
		// ⚠ THE OVER-REFUSAL THIS LIMB IS MOST AT RISK OF. `RPH-EXE-004`'s own example is a partial grant, and
		// the ratified machine has this state precisely for it. Refusing to mint here would strand every
		// least-privilege authorization the platform exists to express.
		expect(
			mint(['file-system'], recordingRunner(), 'PARTIALLY_AUTHORIZED').map((t) => t.name)
		).toEqual(['write_file']);
	});

	it('⭐⭐ THE PRECISION CONTROL — `file-system` granted, `process-execution` NOT: `write_file` minted, `run_command` WITHHELD', () => {
		// ⛔ THE CASE THIS PHASE EXISTS TO BE ABLE TO FAIL, and the one a tool seam that cannot refuse would pass
		// by accident. It is also why `process-execution` is its OWN capability: collapsed into `file-system`,
		// this arrangement is inexpressible and the assertion below could not be written at all.
		// THE MUTANT: give `run_command` the `file-system` capability, or drop the `capabilityAuthorized` filter.
		expect(names(['file-system'])).toEqual(['write_file']);
	});

	it('⭑ the converse, so this is not "mint the first tool" — `process-execution` alone mints `run_command`', () => {
		// ⚠ WITHOUT THIS THE CASE ABOVE IS SATISFIED BY A FILTER THAT ALWAYS KEEPS THE FIRST ENTRY, which is a
		// control that cannot fail wearing the shape of one that can.
		expect(names(['process-execution'])).toEqual(['run_command']);
	});

	it('⭑ CONTROL — both granted mints both, so this is not "refuse everything"', () => {
		expect(names(['network', 'file-system', 'process-execution']).sort()).toEqual([
			'run_command',
			'write_file'
		]);
	});

	it('⛔ EXACT MEMBERSHIP — a prefix, a truncation, an extension and a case fold all mint NOTHING', () => {
		// ⭑ `capabilityAuthorized` is `granted.includes(required)`, and this asserts that nothing here re-derives
		// it more loosely. THE MUTANT: `startsWith`, `includes` on the STRING rather than the array, or a
		// `toLowerCase()` "for convenience" — each of the four below then mints a real filesystem tool against a
		// grant that names no capability this host understands.
		for (const near of ['file', 'file-syste', 'file-system-extra', 'FILE-SYSTEM', ' file-system'])
			expect(names([near]), near).toEqual([]);
	});

	it('⛔ an EMPTY grant mints nothing — the fail-closed arm a forgetful caller lands on', () => {
		expect(names([])).toEqual([]);
	});
});

describe('⭐⭐ THE R11-OWED RULING — a host may not mint a name the record plane cannot hold', () => {
	// ⛔ `R11` recorded this as owed to *"the increment that first HAS a tool surface"*: a host that mints a name
	// `RecordPlaneNameSchema` refuses makes the WHOLE exchange record unwritable, because a call to a minted tool
	// is recorded `MINTED_BY_HOST` WITH its spelling. The answer taken is the fourth one — refuse at MINTING
	// time, when no model has been told anything and no record is owed yet.

	const holdable: ExecutionToolTemplate = {
		name: 'probe_tool',
		capability: 'file-system',
		description: 'A catalog entry whose name the record plane can hold.',
		parameters: {},
		mint: () => async () => ({ ok: true, summary: 'probe' })
	};
	const unholdable = (name: string): ExecutionToolTemplate => ({ ...holdable, name });

	it('⛔ REFUSES a catalog name with a space, a path, a NUL byte or 200 characters', () => {
		// ⭑ THE REVIEWER'S OWN `W2` VECTORS, aimed at the point where the host chooses rather than at the point
		// where the record is written. THE MUTANT: drop the `RecordPlaneNameSchema.safeParse` loop — every one of
		// these mints happily, and the failure surfaces later as an exchange record that cannot be dispatched.
		for (const bad of [
			'write file',
			'C:\\Users\\someone\\tool',
			'tool\u0000name',
			'_leading_underscore',
			'x'.repeat(200)
		])
			expect(
				() =>
					mintExecutionTools(
						{
							ports: PORTS(),
							grantedCapabilities: ['file-system'],
							bindingAuthorizationStatus: AUTHORIZED
						},
						[unholdable(bad)]
					),
				bad
			).toThrow(/cannot mint a tool named/);
	});

	it('⛔ the refusal fires even when the grant would NOT have minted that tool', () => {
		// ⚠ THE GRANT IS EMPTY HERE AND AUTHORISES THE TOOL IN THE CASE ABOVE, DELIBERATELY. An arrangement that
		// trips two guards proves neither: with BOTH cases ungranted, a mutation that moved the check inside the
		// capability filter would redden both and nothing would say which claim had failed.
		// ⭐ THE DORMANT CASE, AND IT IS THE REASON THE WHOLE CATALOG IS CHECKED RATHER THAN THE MINTED SUBSET.
		// Checking only what a grant authorised leaves an unholdable name asleep until the day a grant WIDENS —
		// a live step, a model mid-turn, and an exchange record that cannot be written. THE MUTANT: move the
		// check inside the `.filter`, after the capability test; this case goes green and the bomb stays armed.
		expect(() =>
			mintExecutionTools(
				{ ports: PORTS(), grantedCapabilities: [], bindingAuthorizationStatus: AUTHORIZED },
				[unholdable('bad name')]
			)
		).toThrow(/cannot mint a tool named/);
	});

	it('⛔ the NAME BOUND still fires for a REVOKED binding — the dormancy defect reached by a second road', () => {
		// ⭐ THE ORDERING, ASSERTED RATHER THAN ASSUMED. The catalog check is a property of THIS HOST, not of one
		// grant, so returning early on a revoked binding would make an unholdable name dormant for every revoked
		// binding — `P3-d`'s exact defect arriving through the §22.1 limb instead of through the capability
		// filter. THE MUTANT: move the revocation check above the catalog loop; this goes green and the bomb is
		// re-armed by the fix that was supposed to be unrelated to it.
		expect(() =>
			mintExecutionTools(
				{ ports: PORTS(), grantedCapabilities: [], bindingAuthorizationStatus: 'REVOKED' },
				[unholdable('bad name')]
			)
		).toThrow(/cannot mint a tool named/);
	});

	it('⚠ the refusal names the ruling and the three answers it rejects, not just the failure', () => {
		// A refusal a reader cannot act on is the silent omission `PER-9` forbids one plane over. The reader here
		// is whoever added the tool, and what they need is WHY renaming is the answer rather than a cast.
		let message = '';
		try {
			mintExecutionTools(
				{ ports: PORTS(), grantedCapabilities: [], bindingAuthorizationStatus: AUTHORIZED },
				[unholdable('bad name')]
			);
		} catch (e) {
			message = e instanceof Error ? e.message : String(e);
		}
		expect(message).toMatch(/NOT_MINTED is\s+false/);
		expect(message).toMatch(/third provenance member/);
		expect(message).toMatch(/Rename the tool/);
	});

	it('⭑⭑ CONTROL — a HOLDABLE name mints normally, so the refusal is not "throw on every injected catalog"', () => {
		// ⛔ WITHOUT THIS THE THREE CASES ABOVE ARE SATISFIED BY A FUNCTION THAT THROWS UNCONDITIONALLY, which is
		// the shape this repository has shipped before and named *a control that cannot fail*. Same injected
		// catalog, same ports, one character different in the name.
		expect(
			mintExecutionTools(
				{
					ports: PORTS(),
					grantedCapabilities: ['file-system'],
					bindingAuthorizationStatus: AUTHORIZED
				},
				[holdable]
			).map((t) => t.name)
		).toEqual(['probe_tool']);
	});

	it('⭐ EVERY name in the REAL catalog satisfies the bound — derived, never hand-listed', () => {
		// ⚠ DERIVED FROM THE CATALOG. Naming `write_file` and `run_command` here would be a list that rots the
		// day a third tool lands — the hand-listing defect this repository files one level up. The injectable
		// parameter exists so the REFUSAL is reachable; this is the claim about what is actually shipped.
		expect(EXECUTION_TOOL_CATALOG.length).toBeGreaterThan(0);
		for (const template of EXECUTION_TOOL_CATALOG)
			expect(RecordPlaneNameSchema.safeParse(template.name).success, template.name).toBe(true);
	});
});

describe('write_file — bound to the workspace, and it REFUSES rather than coercing', () => {
	const writeFileTool = () => mint(['file-system'])[0]!;

	it('⭑ writes into the Undertaking’s workspace, and the bytes are on disk', async () => {
		const out = await writeFileTool().run({
			path: 'src/index.ts',
			contents: 'export const x = 1;\n'
		});
		expect(out.ok).toBe(true);
		expect(await readFile(join(dir, 'src/index.ts'), 'utf8')).toBe('export const x = 1;\n');
	});

	it('⛔ a path that escapes the workspace is REFUSED, and nothing lands outside it', async () => {
		// ⚠ THE CONTAINMENT PREDICATE IS THE PORT'S, NOT THIS TOOL'S — `containedWorkspacePath` is exported from
		// `workspace.ts` precisely so *"a second adapter cannot quietly implement a weaker one"*. THE MUTANT:
		// re-check the path here and let the workspace through; the second, weaker predicate is the one that
		// answers, with a model on the other end of it.
		for (const escape of [
			'../escaped.txt',
			'a/../../escaped.txt',
			'/etc/passwd',
			'C:\\escaped.txt'
		]) {
			const out = await writeFileTool().run({ path: escape, contents: 'x' });
			expect(out.ok, escape).toBe(false);
		}
		expect(existsSync(join(container, 'escaped.txt'))).toBe(false);
	});

	it('⛔ a missing or non-string argument is REFUSED, never coerced', async () => {
		// ⭑ THE STANDING INSTRUCTION ON THIS SEAM: prefer refusal and structure over sanitisation. `String(v)`
		// on an absent argument yields `'undefined'` — a plausible relative path — and on an object
		// `'[object Object]'`. Both are files nobody chose. THE MUTANT: `String(args.path)`; the first case
		// below writes a file called `undefined`.
		for (const args of [
			{},
			{ path: 'a.txt' },
			{ contents: 'x' },
			{ path: 42, contents: 'x' },
			{ path: '', contents: 'x' }
		]) {
			const out = await writeFileTool().run(args as Record<string, unknown>);
			expect(out.ok, JSON.stringify(args)).toBe(false);
		}
		expect(existsSync(join(dir, 'undefined'))).toBe(false);
	});

	it('⭑ an EMPTY string is a lawful `contents` and stays distinct from a missing one', async () => {
		// ⚠ `requiredString` refuses `''`, which is right for a PATH and wrong for CONTENTS — an empty file is a
		// file. THE MUTANT: reuse `requiredString` for both; writing an empty file becomes impossible and the
		// refusal blames the model for an argument it supplied correctly.
		const out = await writeFileTool().run({ path: 'empty.txt', contents: '' });
		expect(out.ok).toBe(true);
		expect(await readFile(join(dir, 'empty.txt'), 'utf8')).toBe('');
	});
});

describe('run_command — the cwd is the workspace’s, and it cannot be chosen', () => {
	const runTool = (runner: ProcessRunner) => mint(['process-execution'], runner)[0]!;

	it('⭑⭑ the request’s `cwd` is the WORKSPACE’s own directory, supplied by nothing the model can reach', async () => {
		// ⛔ THE DEFECT THIS REPLACES WAS A HARDCODED `process.cwd()` — the server's own source tree. There is no
		// `cwd` parameter on this tool at all, so there is no field for a model to fill in. THE MUTANT: add one,
		// or build the request by hand with `process.cwd()`.
		const runner = recordingRunner();
		const out = await runTool(runner).run({ argv: ['node', '--version'] });
		expect(out.ok).toBe(true);
		expect(runner.seen).toHaveLength(1);
		expect(runner.seen[0]!.cwd).toBe(dir);
		expect(runner.seen[0]!.argv).toEqual(['node', '--version']);
		expect(runner.seen[0]!.cwd).not.toBe(process.cwd());
		// ⛔ AND THE DEADLINE IS THE HOST'S, FINITE AND POSITIVE — there is no `timeoutMs` parameter on this
		// tool, because an untrusted party choosing how long it may hold the host is not a bound. ⚠ The
		// ASSERTION IS THE PROPERTY, NOT THE NUMBER: a case naming 120000 would redden on a deliberate
		// re-timing and say nothing about the hazard, which is a FABRICATING bound — `0` kills every command
		// instantly and reports TIMEOUT for a process that never ran, `Infinity` makes TIMEOUT unreachable.
		// (`planProcessRun` refuses both; this asserts the host never hands it one.)
		expect(Number.isFinite(runner.seen[0]!.timeoutMs)).toBe(true);
		expect(runner.seen[0]!.timeoutMs).toBeGreaterThan(0);
	});

	it('⛔ a NON-ZERO exit is `ok: true` — the call completed and the exit code is what it returned', async () => {
		// ⭐ `ProcessRunOutcome`'s founding distinction, carried up one layer: *"a runner that will not run says
		// `ran: false`"*. Folding a failing test suite into "the tool failed" would make an honest red result
		// indistinguishable from a seam that refused to run anything — and the adapter grades `details.ok`
		// as REFUSED, so the observed tool-call record would say a governed refusal happened when none did.
		// THE MUTANT: `ok: outcome.exitCode === 0`.
		const out = await runTool(
			recordingRunner({ exitCode: 1, stdout: '', stderr: '2 tests failed\n' })
		).run({ argv: ['npm', 'test'] });
		expect(out.ok).toBe(true);
		expect(out.summary).toContain('exit 1');
		expect(out.summary).toContain('2 tests failed');
	});

	it('⛔ a runner that REFUSES is `ok: false`, and the reason travels back', async () => {
		const runner: ProcessRunner = {
			kind: 'REAL',
			run: async () => ({
				ran: false,
				refusedBecause: 'there is no such program on this host (ENOENT)'
			})
		};
		const out = await runTool(runner).run({ argv: ['nope-missing'] });
		expect(out.ok).toBe(false);
		expect(out.summary).toContain('ENOENT');
	});

	it('⛔ the REFUSING default runner never runs anything, and says so', async () => {
		// ⚠ `planProcessRun` refuses the hermetic pairing BEFORE anything starts, which is the early cheap
		// refusal — never the control. THE MUTANT: skip the plan and call `runner.run` directly; with the
		// refusing default nothing happens, but the `cwd` would then have to be assembled by hand.
		const out = await runTool(createRefusingProcessRunner()).run({ argv: ['node', '--version'] });
		expect(out.ok).toBe(false);
	});

	it('⛔ an IN_MEMORY workspace refuses the run — there is no directory to run in', async () => {
		const tools = mintExecutionTools({
			ports: {
				workspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_mem',
					purgeability: 'RETAINED_BY_PARTICIPATION'
				}),
				runner: recordingRunner()
			},
			grantedCapabilities: ['process-execution'],
			bindingAuthorizationStatus: AUTHORIZED
		});
		const out = await tools[0]!.run({ argv: ['node', '--version'] });
		expect(out.ok).toBe(false);
		expect(out.summary).toMatch(/IN_MEMORY/);
	});

	it('⛔ an argv that is not a non-empty array of non-empty strings is REFUSED, never coerced', async () => {
		// ⭑ EVERY ELEMENT IS CHECKED. A single non-string element would be coerced by the runtime at spawn time,
		// which is the same fabrication one layer lower. THE MUTANT: check `Array.isArray` alone.
		const runner = recordingRunner();
		const tool = runTool(runner);
		for (const args of [
			{},
			{ argv: 'node --version' },
			{ argv: [] },
			{ argv: ['node', 42] },
			{ argv: ['', 'x'] }
		]) {
			const out = await tool.run(args as Record<string, unknown>);
			expect(out.ok, JSON.stringify(args)).toBe(false);
		}
		expect(runner.seen, 'nothing may reach the runner').toHaveLength(0);
	});

	it('⚠ a TRUNCATED stream says so in what the model is handed', async () => {
		// ⛔ A BOUNDED CAPTURE THAT DOES NOT DECLARE ITS CUT HANDS BACK A PREFIX THAT READS AS THE WHOLE — `RULE
		// 6` arriving through the output instead of the exit code. The runner already declares its cuts; this
		// asserts they are not dropped on the way to the model. THE MUTANT: return `outcome.stdout` alone.
		const out = await runTool(
			recordingRunner({
				stdout: 'first 64KiB…',
				omittedRegions: [
					{ stream: 'STDOUT', reason: 'capture is bounded', byteSize: 139264, byteOffset: 65536 }
				]
			})
		).run({ argv: ['noisy'] });
		expect(out.summary).toContain('STDOUT TRUNCATED');
		expect(out.summary).toContain('139264');
		expect(out.summary).toContain('65536');
	});
});

/** The ports for the minting-time cases, which never reach a tool handler. */
function PORTS() {
	return { workspace: deliverable(), runner: recordingRunner() };
}
