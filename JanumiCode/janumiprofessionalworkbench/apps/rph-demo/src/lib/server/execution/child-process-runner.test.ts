// JAN-EXEC Phase 2b — the victim for the REAL `ProcessRunner`, and for the `REG-Q-066` disposition it lands with.
//
// ⭐ THE SUITE IS ARRANGED AROUND THE TWO THINGS THAT MUST NOT COME APART. The runner half proves a command
// actually runs, and that every way it can go wrong stays DISTINGUISHABLE in the record: refused vs ran, timed
// out vs exited non-zero, complete vs truncated. The retention half proves `R7` — both streams retained, both
// reachable by `purge` — because a runner that captures `stderr` without that is the surface `REG-Q-066` asks
// about, arriving as a debugging convenience, which the gate that guards it forbids in terms.
//
// ⚠ IT SPAWNS REAL CHILD PROCESSES, WHICH IS WHY IT IS HERE AND NOT IN `packages/`. `rph-ports/src/index.ts`
// promises, verbatim, that the defaults ship beside the ports so that *"no test gains a real filesystem or a
// real child process by importing them"*; an adapter that does both is a host's, and its suite is a host's too.
//
// ⚠ AND THE SUBJECT IS NESTED ONE LEVEL INSIDE A CONTAINER THIS SPEC CREATED — Phase 2's recorded lesson. The
// no-shell case deliberately provokes a redirection into the process's `cwd`, and a mutant that succeeds at it
// writes a file: with the cwd AT the `mkdtemp` root that lands in the system temp directory, which `afterEach`
// does not own, and it survived into a later run once already.
//
// ══ ⛔⛔ THE RETENTION HALF RUNS ON `createFilesystemWorkspace`, AND IT USED TO RUN ON A MAP ══════════════════
// Every retention case here — "both streams are retained", "both come under purge", the partial-capture sweep —
// was arranged against `createInMemoryWorkspace`, so each proved its property ABOUT A `Map` and none of them
// about the only adapter `workspace-host.ts` actually wires. That is not a stylistic point: the guard those
// cases were supposed to be defending checked `purgeability` and NOT `materialization`, and an adversary drove
// `retained: true` with a `stdoutPath` out of a workspace whose `directoryPath` was `undefined` — bytes in a Map
// reported as the durable copy a purge can reach. A suite that never used the real adapter could not have
// noticed. Both workspaces below are real directories now, and the construction guard REFUSES the in-memory one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';
import {
	createInMemoryWorkspace,
	type ProcessOutputRetention,
	type PurgeOutcome,
	type Workspace,
	type WorkspaceWriteOutcome
} from '@janumipwb/rph-ports';
import { createChildProcessRunner, observeChildRun } from './child-process-runner.js';
import { createFilesystemWorkspace } from './filesystem-workspace.js';

/** The cap `child-process-runner.ts` declares. ⚠ RESTATED, NOT IMPORTED — see the truncation case. */
const CAP_BYTES = 64 * 1024;

/**
 * The argv the adversary used, verbatim, and it is the whole of `B1`.
 *
 * ⛔ IT IS AN ARGUMENT AND NOTHING ELSE. `spawn` with `shell: false` passes it as `argv[1]`; only a target the
 * platform hands to `cmd.exe` turns the `&` into a further command. Driven under bun before the refusal existed:
 * exit 0, `INJECTED-VIA-ARGV` on stdout, and `pwned.txt` on disk.
 */
const INJECTION_ARGUMENT = 'x" & echo INJECTED-VIA-ARGV & echo PWNED > pwned.txt & rem ';

/** A batch file that echoes its first argument — a plausible `build.cmd`, not a contrivance. */
const BATCH_BODY = '@echo off\r\necho building %1\r\n';

/**
 * What `settledWithin` reports when nothing arrived. ⚠ A SENTINEL RATHER THAN A REJECTION, so the assertion
 * that follows names the property instead of surfacing as an unhandled error.
 */
const NO_OUTCOME = 'NO OUTCOME WAS PRODUCED' as const;

/**
 * Await an outcome under a BOUND, because `run` must ALWAYS produce a fact and a spec that proves that by
 * HANGING measures nothing.
 *
 * ⛔ THIS EXISTS BECAUSE THE INSTRUMENT SAID SO, AND IT IS THE THIRD TIME IN THIS PROGRAMME THAT MY SCAFFOLDING
 * WAS WEAKER THAN THE CODE. `P2B-z` removes the post-kill grace — the exact defect the last case below is
 * written for — and the declared-mutant run reported **INCONCLUSIVE: the run TIMED OUT (Test timed out in
 * 60000ms), no report**, not KILLED. A case that demonstrates "it always settles" by waiting forever when it
 * does not hands the ledger an UNMEASURED verdict, which BLOCKS and says nothing about the guard. Bounded, the
 * same mutation fails in seconds against an assertion that names the promise it broke.
 *
 * ⚠ THE UNDERLYING PROMISE IS LEFT PENDING, DELIBERATELY: cancelling it would be inventing a capability `run`
 * does not have, and every caller here kills its own child afterwards.
 */
async function settledWithin<T>(ms: number, outcome: Promise<T>): Promise<T | typeof NO_OUTCOME> {
	let lapse: ReturnType<typeof setTimeout> | undefined;
	const nothing = new Promise<typeof NO_OUTCOME>((report) => {
		lapse = setTimeout(() => report(NO_OUTCOME), ms);
	});
	try {
		return await Promise.race([outcome, nothing]);
	} finally {
		if (lapse !== undefined) clearTimeout(lapse);
	}
}

let container = '';
let cwd = '';
let outputDirectory = '';
let deliverable: Workspace;
let output: Workspace;

/** A child that evaluates `script`. `process.execPath` is whichever runtime is running this spec. */
function node(script: string, ...args: string[]): string[] {
	return [process.execPath, '-e', script, ...args];
}

/** The runner as the host wires it: both workspaces, both on disk. */
function runner() {
	return createChildProcessRunner({ deliverableWorkspace: deliverable, outputWorkspace: output });
}

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-runner-'));
	cwd = join(container, 'workspace');
	// ⭑ THE SIBLING ARRANGEMENT `workspace-host.ts` PRODUCES, reproduced rather than approximated: the capture
	// workspace is `<deliverable>.process-output`, so nothing a step can spell inside the deliverable reaches it.
	outputDirectory = `${cwd}.process-output`;
	await mkdir(cwd, { recursive: true });
	await mkdir(outputDirectory, { recursive: true });
	deliverable = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_2b',
		purgeability: 'RETAINED_BY_PARTICIPATION',
		directoryPath: cwd
	});
	output = createFilesystemWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_2b',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		directoryPath: outputDirectory
	});
});

afterEach(async () => {
	// ⚠ `maxRetries` BECAUSE A CHILD THIS SPEC DELIBERATELY OUTLIVED MAY STILL HOLD THE DIRECTORY AS ITS `cwd`,
	// and Win32 answers EBUSY for that. A cleanup that fails is a red that says nothing about the subject.
	await rm(container, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
});

describe('createChildProcessRunner — a command actually runs, and every failure stays distinguishable', () => {
	it('⭐ CONTROL — it RUNS: an exit code, and BOTH streams, observed from a real process', async () => {
		// ⛔ WITHOUT THIS, EVERY REFUSAL BELOW IS SATISFIED BY "REFUSES EVERYTHING" — which is what the Phase 1
		// default already does, and shipping it again under a new name would pass a suite made only of negatives.
		const out = await runner().run({
			argv: node('process.stdout.write("OUT");process.stderr.write("ERR");process.exit(7)'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.exitCode).toBe(7);
		expect(out.stdout).toBe('OUT');
		expect(out.stderr, 'stderr is BOUND — which is what reopens REG-Q-066').toBe('ERR');
		expect(out.timedOut).toBe(false);
		expect(out.durationMs).toBeGreaterThanOrEqual(0);
		expect(
			out.omittedRegions,
			'nothing was cut, and that is stated rather than left empty by accident'
		).toEqual([]);
		expect(out.outputComplete, 'both pipes reached EOF, so the capture is the whole of it').toBe(
			true
		);
	});

	it('⛔ NO SHELL — a `>` in the argv is an ARGUMENT, never a redirection', async () => {
		// ⭑ DRIVEN RATHER THAN ASSERTED FROM THE OPTION. `shell: false` is one word in a spawn call and reading it
		// proves nothing about what the operating system did; a redirection that LANDS is the only thing that
		// distinguishes the two. THE MUTANT: `shell: true` — measured, it creates `pwned.txt` in the cwd.
		// ⛔ AND THE STAKE IS THE WHOLE SEAM: argv comes from a model in Phase 3. A shell would make every
		// metacharacter in a model's chosen argument an instruction to the host.
		const out = await runner().run({
			argv: node('process.stdout.write(JSON.stringify(process.argv.slice(1)))', '>', 'pwned.txt'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		expect(out.ran === true && out.stdout).toContain('pwned.txt');
		expect(
			existsSync(join(cwd, 'pwned.txt')),
			'a shell would have redirected this into a file; no shell is involved, so it is argv'
		).toBe(false);
	});

	it('⛔⛔ B1 — A `.cmd` TARGET IS REFUSED, BECAUSE `shell: false` DOES NOT STOP `cmd.exe` RE-PARSING ARGUMENTS', async () => {
		// ⭐ THE ADVERSARY'S OWN VECTOR, UNCHANGED. Win32 cannot load a batch file as a program image, so the
		// runtime hands the command line to `cmd.exe`, which interprets `&` INSIDE an argument. Node refuses this
		// as CVE-2024-27980; **bun does not**, and bun is this repository's declared package manager and the
		// runtime this very spec runs under. DRIVEN before the refusal existed: `ran: true`, `exitCode: 0`,
		// `INJECTED-VIA-ARGV` on stdout and `pwned.txt` LEFT ON DISK.
		// ⛔ THE MUTANT: drop the batch check. Under bun the file below appears; under node the refusal survives
		// but says something FALSE about its input, which the last two assertions are `B10` and catch either way.
		const target = join(cwd, 'jpwb-build.cmd');
		await writeFile(target, BATCH_BODY, 'utf8');
		const out = await runner().run({ argv: [target, INJECTION_ARGUMENT], cwd, timeoutMs: 30_000 });
		expect(out.ran, 'a target whose arguments a command interpreter re-parses is REFUSED').toBe(
			false
		);
		expect(out.ran === false && out.refusedBecause).toContain('jpwb-build.cmd');
		expect(
			out.ran === false && out.refusedBecause,
			'and it says WHY, so a reader can act on it'
		).toContain('cmd.exe');
		// ⚠⚠ THIS LIMB IS VACUOUS UNDER THE RUNTIME THIS SUITE RUNS ON, AND SAYING SO IS THE POINT. Vitest's
		// workers are NODE (`process.execPath` measured: `node.exe`), and node raises EINVAL for a batch target
		// with `shell: false`, so the file cannot appear here even with the guard removed — measured. It is the
		// artefact assertion for BUN, where the breach was actually driven and where nothing else stops it. The
		// limbs that DISCRIMINATE on this runtime are the message ones above and the two below; a control that
		// fails the same way as its subject reads as agreement, which is why this is written down rather than
		// left to look like proof.
		expect(
			existsSync(join(cwd, 'pwned.txt')),
			'THE BREACH ITSELF: an injected `&` wrote this file through a .cmd target under bun'
		).toBe(false);
		// ⛔ B10 — THE REFUSAL MAY NOT STATE A CLOSED DISJUNCTION OF CAUSES IT DID NOT ESTABLISH. Under real node
		// this target raised EINVAL synchronously and the arm that caught it answered "an embedded NUL byte, or an
		// empty program name" — neither true of an ordinary path to a `.cmd`. Phase 2 recorded that a refusal
		// stating something false about its input is worse than no refusal.
		expect(
			out.ran === false && out.refusedBecause,
			'B10: it does not invent a NUL byte'
		).not.toMatch(/NUL/i);
		expect(
			out.ran === false && out.refusedBecause,
			'B10: and it does not claim the program name was empty'
		).not.toMatch(/empty program name/i);
	});

	it('⛔ B1 — a `.bat` is the same class, and a TRAILING DOT does not spell its way past the predicate', async () => {
		// ⚠ `.bat` AND `.cmd` ARE ONE RULE AND THIS REPOSITORY'S MOST-RECORDED DEFECT IS A RULE IMPLEMENTED ONCE.
		// ⭑ AND THE TRAILING DOT IS PHASE 2's `F1` ARRIVING AT A NEW FIELD: Win32 strips trailing dots and spaces
		// and `node:path` keeps them, so `build.bat.` OPENS `build.bat` while spelling something else. DRIVEN
		// under bun against a real `.cmd`: `x.cmd`, `x.cmd.`, `x.cmd ` and `x.cmd..` ALL ran the batch file and
		// ALL executed the injected `&`. THE MUTANT: drop the `[. ]+$` strip from `namesABatchTarget`.
		const target = join(cwd, 'jpwb-build.bat');
		await writeFile(target, BATCH_BODY, 'utf8');
		for (const spelling of [target, `${target}.`, `${target} `, `${target}..`]) {
			const out = await runner().run({
				argv: [spelling, INJECTION_ARGUMENT],
				cwd,
				timeoutMs: 30_000
			});
			expect(out.ran, `spelling ${JSON.stringify(spelling)} must be refused`).toBe(false);
			// ⛔ THE MESSAGE, NOT MERELY `ran: false` — AND THAT DISTINCTION IS THIS CASE'S WHOLE VALUE. Measured
			// with the trailing-dot strip removed: under NODE every one of these spellings still refused, because
			// libuv reaches the filesystem through the long-path prefix and `build.bat.` is then simply ENOENT.
			// The arrangement would have passed against the defect, proving the OTHER guard. Under BUN the same
			// four spellings ALL executed the batch file and ALL wrote `pwned.txt` — driven. So the assertion is
			// on the refusal this gate is about.
			expect(
				out.ran === false && out.refusedBecause,
				`spelling ${JSON.stringify(spelling)} must be refused AS A BATCH TARGET, not by ENOENT`
			).toContain('cmd.exe');
		}
		expect(existsSync(join(cwd, 'pwned.txt'))).toBe(false);
	});

	it('⛔⛔ B1 — and a BARE name that RESOLVES to a `.cmd` through PATH and PATHEXT is refused too', async () => {
		// ⭐ THIS IS THE ONE THAT MATTERS IN PRACTICE, AND A SPELLED-EXTENSION CHECK ALONE MISSES IT ENTIRELY.
		// `npm`, `tsc`, `yarn` and every other Node toolchain entry point on Windows IS a `.cmd` shim, reached by
		// a bare name with no extension at all. DRIVEN under bun against the real `npm`: `spawn('npm', ['--version',
		// <the argument above>])` printed the version AND executed the injected command AND wrote `pwned.txt`.
		// A shim is planted here rather than depending on the host's `npm`, so the case asserts the mechanism.
		// ⛔ THE MUTANT: check only the spelled extension and skip the resolution.
		const binaries = join(container, 'bin');
		await mkdir(binaries, { recursive: true });
		await writeFile(join(binaries, 'jpwb-shim-2b.cmd'), BATCH_BODY, 'utf8');
		const restore = process.env.PATH;
		process.env.PATH = `${binaries}${delimiter}${restore ?? ''}`;
		try {
			const out = await runner().run({
				argv: ['jpwb-shim-2b', INJECTION_ARGUMENT],
				cwd,
				timeoutMs: 30_000
			});
			expect(out.ran, 'the program named no extension, and still reaches a batch target').toBe(
				false
			);
			// ⚠ CASE-INSENSITIVE, BECAUSE THE SPELLING THE PLATFORM SEARCHES IS `PATHEXT`'s AND THE FILE'S IS THE
			// AUTHOR'S. Win32 opens one file for both; asserting the file's spelling would be asserting something
			// about this fixture rather than about the search.
			expect(out.ran === false && out.refusedBecause).toMatch(/jpwb-shim-2b\.cmd/i);
			expect(existsSync(join(cwd, 'pwned.txt'))).toBe(false);
		} finally {
			process.env.PATH = restore;
		}
	});

	it('⭑ CONTROL — the batch refusal DISCRIMINATES: an ordinary program with the same argument still runs', async () => {
		// ⛔ WITHOUT THIS, "refuse everything whose argv looks alarming" satisfies every case above — and the
		// repository has the receipt for a control that could not fail. The SAME argument, the same runner, an
		// executable target: it runs, and the `&` arrives as one argument rather than as three commands.
		const out = await runner().run({
			argv: node('process.stdout.write(String(process.argv.slice(1).length))', INJECTION_ARGUMENT),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		expect(out.ran === true && out.stdout, 'exactly ONE argument, not a command line').toBe('1');
		expect(existsSync(join(cwd, 'pwned.txt'))).toBe(false);
	});

	it('⛔⛔ B8 — A `cwd` OUTSIDE THE DELIVERABLE WORKSPACE IS REFUSED, AND NOTHING RUNS THERE', async () => {
		// ⭐ THE OUTCOME THIS WHOLE PHASE EXISTS TO PREVENT, DRIVEN: `run({ argv: [...], cwd: <the repository
		// root> })` executed IN THE SERVER'S OWN TREE. `ProcessRunRequest.cwd` is a required field on a plain
		// interface, `planProcessRun` has ZERO production call sites, and a convention with no call sites is not a
		// control. The runner is CONSTRUCTED against the deliverable workspace now, so it can check.
		// ⛔ THE MUTANT: drop the comparison — the write below then lands in a directory the record never names.
		// ⚠ AND THE TARGET IS A SIBLING UNDER THIS SPEC'S OWN CONTAINER RATHER THAN THIS REPOSITORY, WHICH IS A
		// DELIBERATE DIVERGENCE FROM THE DRIVEN VECTOR AND IS RECORDED SO IT DOES NOT READ AS A WEAKER
		// ARRANGEMENT. The property under test is "a cwd that is not the deliverable workspace is REFUSED", and
		// `elsewhere` has exactly that property; what the repository root adds is CONSEQUENCE, not
		// discrimination. And the consequence is the reason not to use it: a mutant that defeats this check
		// SUCCEEDS at the write, and this suite's own header records a file from a defeated case surviving into a
		// later run once already. Phase 2's lesson is to point a proving write at something `afterEach` owns.
		const elsewhere = join(container, 'elsewhere');
		await mkdir(elsewhere, { recursive: true });
		const out = await runner().run({
			argv: node('require("node:fs").writeFileSync("escaped.txt","a step wrote here")'),
			cwd: elsewhere,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		expect(
			existsSync(join(elsewhere, 'escaped.txt')),
			'THE BREACH ITSELF: a command executed in a directory the caller chose'
		).toBe(false);
		expect(
			out.ran === false && out.refusedBecause,
			'it names the workspace it may run in'
		).toContain(basename(cwd));
		expect(out.ran === false && out.refusedBecause, 'and the directory it was asked for').toContain(
			'elsewhere'
		);
		expect(
			out.ran === false && out.refusedBecause,
			'by NAME on both sides — never the host path'
		).not.toContain(elsewhere);
	});

	it('⭑ CONTROL — the SAME command in the workspace’s own directory runs and writes there', async () => {
		// Without this, `B8` is satisfied by refusing every cwd, and the runner would be the Phase 1 default again.
		const out = await runner().run({
			argv: node('require("node:fs").writeFileSync("landed.txt","in the workspace")'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran === true && out.exitCode).toBe(0);
		expect(existsSync(join(cwd, 'landed.txt'))).toBe(true);
	});

	it('⛔⛔ B11 — THE DELIVERABLE DIRECTORY, SWAPPED FOR A JUNCTION AFTER CONSTRUCTION, IS REFUSED', async () => {
		// ⭐ THE THIRD ADVERSARIAL PASS'S ONE BREACH, DRIVEN WITH ITS OWN VECTOR. The check was
		// `resolvePath(request.cwd) !== deliverableRoot` — two path STRINGS, one of them fixed at construction
		// — so an `mklink /J` junction standing where the workspace directory used to be matched EXACTLY, the
		// operating system followed it, and the command wrote `PWNED_IN_SERVER_TREE.txt` INTO THE STAND-IN
		// SERVER TREE while every path in the record still spelled the workspace. That is the one outcome this
		// phase exists to prevent, reached without a single malformed field on the request.
		// ⛔ THE MUTANT: compare the RESOLVED path on BOTH sides — `realpath(cwd) === realpath(root)`, the shape
		// `insideResolvedRoot` uses one module over. MEASURED, under node AND under bun: it answers TRUE here,
		// because both sides walk through the same junction. What closes this is comparing the resolved cwd
		// with the DECLARED directory, which is the one name the swap cannot move.
		// ⚠ A JUNCTION NEEDS NO ADMINISTRATOR RIGHT AND NO DEVELOPER MODE — measured on this host — which is
		// why it is the vector and a symlink is not. `symlink(..., 'junction')` is `mklink /J` without a shell.
		const standIn = join(container, 'server-tree');
		await mkdir(standIn, { recursive: true });
		// ⭑ CONSTRUCTED WHILE THE WORKSPACE IS A REAL DIRECTORY, which is the whole of the arrangement: a root
		// resolved once, at construction, cannot notice what happens to it afterwards.
		const subject = runner();
		await rm(cwd, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
		await symlink(standIn, cwd, 'junction');
		const out = await subject.run({
			// ⭑ LAWFUL: this IS the workspace's own `directoryPath`, derived exactly as `planProcessRun` derives
			// it. Nothing about the REQUEST is wrong; the directory underneath it is.
			argv: node('require("node:fs").writeFileSync("PWNED_IN_SERVER_TREE.txt","a step wrote here")'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		expect(
			existsSync(join(standIn, 'PWNED_IN_SERVER_TREE.txt')),
			'THE BREACH ITSELF: a command ran in the tree the junction pointed at'
		).toBe(false);
		const why = out.ran === false ? out.refusedBecause : '';
		expect(why, 'it names the workspace it may run in').toContain(basename(cwd));
		expect(why, 'and says the NAME no longer reaches the directory').toContain('REDIRECTS');
		// ⛔ AND IT MUST NOT SAY WHAT THE OTHER ARM SAYS. The cwd spells the workspace exactly — a refusal
		// reading "carries a cwd naming 'workspace' instead" would state something FALSE about its own input,
		// which this adapter already has a recorded finding for (`B10`). THE MUTANT: one message for both arms.
		expect(why, 'rather than the refusal for a cwd naming somewhere else').not.toContain(
			'carries a cwd naming'
		);
		expect(why, 'and where it now leads is not disclosed').not.toContain(standIn);
		expect(why, 'not even by its directory name').not.toContain(basename(standIn));
	});

	it('⛔ B11 — a cwd the filesystem cannot resolve AT ALL is REFUSED, never decided by the path text', async () => {
		// ⭐ A CHECK THAT CANNOT BE ANSWERED REFUSES — §16 fail-closed, at the one place the fix could have
		// reintroduced the defect it removes. The path TEXT is exactly what a directory that has been replaced
		// or removed still spells correctly, so falling back to it when `realpath` raises would decide
		// containment with the instrument the breach defeated.
		// ⛔ THE MUTANT: treat an unresolvable cwd as contained (the `catch` returns the lexical answer) — the
		// arrangement then reaches `spawn`, which refuses it for an entirely different reason, and the record
		// carries a SPAWN failure where a containment refusal belongs. The two are different facts, which is why
		// the message is asserted and `ran: false` is not enough.
		await rm(cwd, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
		const out = await runner().run({
			argv: node('process.stdout.write("ok")'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		const why = out.ran === false ? out.refusedBecause : '';
		expect(why, 'it says the CHECK could not be answered').toContain('could not resolve');
		expect(why, 'and names the errno the platform gave').toContain('ENOENT');
		expect(why, 'and it is a containment refusal, not a spawn failure').not.toContain(
			'could not be started'
		);
		expect(why, 'the workspace is named by its directory name').toContain(basename(cwd));
	});

	it('⚠ `timedOut` is OBSERVED at the kill — and a SIGKILLed process reports a NULL exit code', async () => {
		// ⛔ §36.2 SEPARATES TIMEOUT FROM TOOL_FAILURE, and the runner must report the kill it issued rather than
		// leave the caller to guess it back out. THE MUTANT: `timedOut: false` — the watchdog still kills and the
		// record no longer says why the process died.
		// ⚠ AND THE OBVIOUS MUTANT — `timedOut: exitCode === null` — SURVIVES ON THIS HOST, WHICH IS RECORDED IN
		// THE ADAPTER'S HEADER WITH THE FOUR MEASUREMENTS THAT EXPLAIN IT. On Windows a null exit code arises
		// only from the kill this runner itself issued, so the inference and the observation coincide HERE; on
		// POSIX an external SIGKILL delivers null and they do not. The flag is pinned in both directions instead.
		const out = await runner().run({
			argv: node('setTimeout(() => {}, 60000)'),
			cwd,
			timeoutMs: 400
		});
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.timedOut).toBe(true);
		expect(out.exitCode).toBeNull();
	});

	it('⭑ CONTROL — a process that CHOSE to exit non-zero is NOT a timeout', async () => {
		// Without this, `timedOut: true` always satisfies the case above. This is the arrangement that separates
		// the two failure classes §36.2 requires to stay separate.
		const out = await runner().run({
			argv: node('process.exit(2)'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran === true && out.timedOut).toBe(false);
		expect(out.ran === true && out.exitCode).toBe(2);
	});

	it('⛔ RULE 5 — a program that does not exist DID NOT RUN, and carries no exit code at all', async () => {
		// ⭑ `Object.hasOwn`, NOT `toBeUndefined`, for the reason Phase 1 recorded: `{ran: true, exitCode:
		// undefined}` passes the weaker form while claiming a command ran.
		// ⛔ AND 127 IS THE TEMPTING FABRICATION. It is the shell's convention for "command not found", so a
		// runner that reported it would let a step record a FAILED COMMAND where no command existed — and "the
		// build failed" and "there is no build tool on this host" are different facts with different remedies.
		const out = await runner().run({
			argv: ['jpwb-no-such-program-2b', '--version'],
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		expect(Object.hasOwn(out, 'exitCode')).toBe(false);
		expect(Object.hasOwn(out, 'stdout')).toBe(false);
		expect(Object.hasOwn(out, 'timedOut')).toBe(false);
		expect(out.ran === false && out.refusedBecause).toContain('ENOENT');
		expect(out.ran === false && out.refusedBecause).toContain('jpwb-no-such-program-2b');
	});

	it('⛔ an argv the PLATFORM refuses is a refusal too — `run` never throws, and never echoes it back', async () => {
		// ⚠ FOUND BY PROBING THE ADAPTER, NOT BY READING IT. `spawn` raises `ERR_INVALID_ARG_VALUE` SYNCHRONOUSLY
		// for an embedded NUL and for an empty program name — measured, all three arrangements — so those never
		// reach the `error` event, and before this arm existed they left `run` as a REJECTED PROMISE: a stack
		// trace where the port requires a fact a step can record. THE MUTANT: fabricate a run for it.
		// ⭑ AND THE ARGV IS NOT QUOTED BACK, WHICH IS THE SECOND LIMB. A NUL byte in a `refusedBecause` travels
		// into a governed record and into a model's context; the code and the SHAPE of the fault are what a
		// reader acts on.
		const out = await runner().run({
			argv: [`jpwb${String.fromCharCode(0)}nul`],
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		expect(Object.hasOwn(out, 'exitCode')).toBe(false);
		expect(out.ran === false && out.refusedBecause).toContain('ERR_INVALID_ARG_VALUE');
		expect(
			out.ran === false && out.refusedBecause,
			'the malformed argv must not travel into a record'
		).not.toContain(String.fromCharCode(0));
	});

	it('⛔⛔ B5 — THE REFUSAL NAMES THE PROGRAM’S FILE NAME, AND NEITHER THE HOST PATH NOR THE ARGUMENTS', async () => {
		// ⭐ THE TEST THAT USED TO CERTIFY THIS ARRANGED A **RELATIVE** ARGV, SO IT COULD NOT SEE THE BREACH. The
		// message interpolated `request.argv.join(' ')` raw, and an ABSOLUTE program path produced
		// *"'C:\Program Files\nodejs\nope-missing.exe --flag' could not be started"* — under bun, a path carrying
		// the operating user's own name — in the field the port defines as travelling into a governed record AND
		// into a model's context. So the argv here is absolute AND its argument carries a host path.
		// ⛔ THE MUTANT: interpolate `request.argv.join(' ')`, or `request.cwd`.
		const absentProgram = join(container, 'nope-missing.exe');
		const out = await runner().run({
			argv: [absentProgram, `--out=${join(container, 'secret-directory')}`],
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		const why = out.ran === false ? out.refusedBecause : '';
		expect(why, 'it still says WHAT could not be started').toContain('nope-missing.exe');
		expect(why, 'and WHERE, by directory NAME').toContain(basename(cwd));
		expect(why, 'THE BREACH ITSELF: the host’s absolute path').not.toContain(container);
		expect(why, 'and the arguments do not travel either').not.toContain('--out');
		expect(why, 'nor anything they carry').not.toContain('secret-directory');
		expect(why, 'and never the workspace’s absolute path').not.toContain(cwd);
	});

	it('⭐ TRUNCATION IS DECLARED, IN UTF-8 BYTES, AND THE CUT DOES NOT INVENT A CHARACTER', async () => {
		// ⛔ A SILENTLY TRUNCATED STDOUT THAT A TEST RESULT IS READ FROM IS A FABRICATED PASS. THE MUTANT:
		// `omittedRegions: []`, which leaves an outcome that looks complete and is a prefix.
		// ⭑ THE CHARACTER IS THREE BYTES ON PURPOSE. 64 KiB is not a multiple of 3, so the cap lands MID-CHARACTER
		// — and a capture that decoded the raw cut would append U+FFFD, a character the process never emitted, to
		// a record whose whole claim is that it says what the process emitted. The trim is accounted for in
		// `byteOffset`, so `byteOffset + byteSize` still reconstructs what was really written.
		// ⚠ `CAP_BYTES` IS RESTATED HERE RATHER THAN IMPORTED, deliberately: importing the bound from the subject
		// would assert that the subject agrees with itself, which it cannot fail to do.
		const emitted = 30_000 * 3;
		const out = await runner().run({
			argv: node('process.stdout.write("\\u20AC".repeat(30000))'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		const cut = out.omittedRegions.find((region) => region.stream === 'STDOUT');
		expect(cut, 'the record must SAY the output was truncated').toBeDefined();
		if (cut === undefined) return;
		expect(cut.byteOffset, 'the last WHOLE character inside the bound').toBe(CAP_BYTES - 1);
		expect(cut.byteSize, 'what was removed, in bytes').toBe(emitted - (CAP_BYTES - 1));
		expect(cut.byteOffset + cut.byteSize, 'and the two reconstruct what the process emitted').toBe(
			emitted
		);
		expect(
			Buffer.byteLength(out.stdout, 'utf8'),
			'the retained half is what the offset says it is'
		).toBe(CAP_BYTES - 1);
		expect(out.stdout, 'and no character the process never emitted').not.toContain('�');
		expect(cut.reason).toMatch(/bounded/);
	});

	it('⚠ and stderr is bounded by the SAME rule — the hazard is not stdout-shaped', async () => {
		// ⛔ `R7` IS ABOUT BOTH STREAMS, AND A BOUND APPLIED TO ONE OF THEM IS THE DEFECT THIS REPOSITORY KEEPS
		// FILING: a rule stated generally and implemented once. THE MUTANT: bound stdout only.
		const out = await runner().run({
			argv: node('process.stderr.write("z".repeat(100000))'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran === true && out.omittedRegions.map((r) => r.stream)).toEqual(['STDERR']);
		expect(out.ran === true && Buffer.byteLength(out.stderr, 'utf8')).toBe(CAP_BYTES);
	});

	it('⛔ the child does NOT inherit this server’s environment — with a CONTROL that it inherits what it must', async () => {
		// ⚠ A COMMAND'S STDERR CAN ECHO THE ENVIRONMENT IT RAN IN, and this server's environment holds model
		// provider credentials. The allowlist is what makes "the model chooses the argv" survivable: there is no
		// secret in the child's environment for any command to print. THE MUTANT: `env: process.env`.
		// ⭑ THE CONTROL IS NOT DECORATIVE. An environment of `{}` would pass the first assertion and break every
		// real toolchain — and it would break it at a distance, as "the interpreter is not on PATH".
		process.env.JPWB_PHASE2B_SECRET_PROBE = 'this-must-not-reach-a-child';
		try {
			const out = await runner().run({
				argv: node(
					'process.stdout.write(String(process.env.JPWB_PHASE2B_SECRET_PROBE) + "|" + String(process.env.PATH !== undefined))'
				),
				cwd,
				timeoutMs: 30_000
			});
			expect(out.ran === true && out.stdout).toBe('undefined|true');
		} finally {
			delete process.env.JPWB_PHASE2B_SECRET_PROBE;
		}
	});
});

describe('⛔⛔ B2 / B3 — the outcome comes from the CHILD, and `run` always produces one', () => {
	/** How both children below begin: a DETACHED grandchild that inherits their stdout and stderr. */
	const STARTS_A_GRANDCHILD_HOLDING_THE_PIPES =
		'const {spawn}=require("node:child_process");' +
		// ⚠ THE GRANDCHILD'S `cwd` IS THE SYSTEM TEMP ROOT, NOT THE WORKSPACE. It outlives the run by design, and a
		// live process holding the workspace as its working directory makes Win32 refuse to remove it — a teardown
		// failure that would read as a finding about the subject.
		'const g=spawn(process.execPath,["-e","setTimeout(()=>{},60000)"],{cwd:require("node:os").tmpdir(),stdio:["ignore","inherit","inherit"],detached:true});' +
		'g.unref();';

	/**
	 * A child that hands its inherited stdout and stderr to a DETACHED grandchild and then exits immediately.
	 *
	 * ⭐ THIS IS THE ADVERSARY'S ARRANGEMENT AND IT IS NOT EXOTIC: any build tool that forks a watcher or a
	 * daemon does exactly this. The grandchild keeps the PIPE open, so `close` never fires — measured, `exit` at
	 * 151ms and `close` NEVER — and an adapter whose only settle path was `close` was still pending 9028ms after
	 * a 2000ms timeout, having meanwhile set `timedOut: true` for a process that exited 0 in milliseconds.
	 */
	const HOLDS_THE_PIPES =
		STARTS_A_GRANDCHILD_HOLDING_THE_PIPES + 'process.stdout.write(String(g.pid));process.exit(0);';

	/**
	 * ⭐ `REG-F-452` — B2'S CHILD, WHICH SAYS WHEN IT EXITS: the same grandchild, and then, as its last act, one JSON line —
	 * the grandchild's pid, to reap, and `exitAt`, its own `Date.now()` as it exits, on the clock this process reads too.
	 * ⭑ It exits in the write's callback, so the line it wrote is never lost to the exit; `exitAt` is read before both.
	 */
	const TELLS_ITS_EXIT =
		STARTS_A_GRANDCHILD_HOLDING_THE_PIPES +
		'const exitAt=Date.now();process.stdout.write(JSON.stringify({pid:g.pid,exitAt}),()=>process.exit(0));';

	/** What `TELLS_ITS_EXIT` printed, or undefined when it printed nothing whole (its deadline killed it first). */
	function toldExit(stdout: string): { readonly pid: number; readonly exitAt: number } | undefined {
		try {
			const told = JSON.parse(stdout) as { pid?: unknown; exitAt?: unknown };
			return typeof told.pid === 'number' && typeof told.exitAt === 'number'
				? { pid: told.pid, exitAt: told.exitAt }
				: undefined;
		} catch {
			return undefined;
		}
	}

	/**
	 * Whatever the child reported as the grandchild's pid, killed so nothing outlives the spec.
	 * ⛔ `REG-F-452` — ONLY A POSITIVE INTEGER IS KILLED. The child prints nothing when its deadline kills it first, and
	 * `Number('')` is 0: on Windows `process.kill(0, …)` ends the CALLING process, so this cleanup killed the vitest worker
	 * running the file (driven 2026-10-10, under node and bun). A pid the child never printed has no grandchild to reap.
	 */
	function reap(pid: string): void {
		const n = Number(pid.trim());
		if (!Number.isInteger(n) || n <= 0) return;
		try {
			process.kill(n, 'SIGKILL');
		} catch {
			// Already gone, or never started: the spec's cleanup is not a place to fail.
		}
	}

	/** `STREAM_DRAIN_GRACE_MS`, restated rather than imported, as `CAP_BYTES` is. */
	const DRAIN_MS = 1_000;
	/** How long before B2's deadline its child's recorded exit must come. */
	const MARGIN_MS = 250;

	/** What one B2 attempt recorded: each event's place in the order this process saw them, and the times it records. */
	interface B2Attempt {
		/** The run's exit code; undefined when it did not run. */
		readonly exitCode: number | null | undefined;
		/** When the child said it exited, by its own `Date.now()`; undefined when it said nothing whole. */
		readonly toldExitAt: number | undefined;
		readonly armedAt: number;
		readonly timeoutMs: number;
		readonly exitSeen: number | undefined;
		readonly deadlineFired: number | undefined;
		readonly settled: number | undefined;
		/**
		 * ⭐ Where the DRAIN SENTINEL fell: armed as the exit was read, by a listener added AHEAD of the runner's, with the
		 * runner's drain delay — the same delay shares one list of timers, served in the order armed, so it fires no later
		 * than the runner's drain. Undefined when it never fired.
		 */
		readonly drainFired: number | undefined;
	}

	/** ⭐ Whether a B2 attempt shows, by what it recorded, that its arrangement held: each clause B2's comment lists. */
	const b2ArrangementHeld = (a: B2Attempt): boolean =>
		a.exitCode === 0 &&
		a.toldExitAt !== undefined &&
		a.toldExitAt + MARGIN_MS <= a.armedAt + a.timeoutMs &&
		a.exitSeen !== undefined &&
		a.deadlineFired !== undefined &&
		a.exitSeen < a.deadlineFired &&
		a.settled !== undefined &&
		a.settled > a.deadlineFired &&
		(a.drainFired === undefined || a.settled < a.drainFired);

	it('⛔ B2’s own instrument — an attempt that settled after its DRAIN SENTINEL fired asserts nothing: the drain, not the deadline, may have settled it', () => {
		// ⭑ The re-review of E4's fix round: B2 took the order alone — settled after the sentinel — as the deadline having
		// settled the run. Node serves a timer armed a millisecond after the sentinel in a later pass when its list is not
		// yet due, so a drain due between the two settled the run there, and `timedOut` was false whatever the deadline's
		// arm does — an attempt P2B-x could pass.
		const held: B2Attempt = {
			exitCode: 0,
			toldExitAt: 1_100,
			armedAt: 1_000,
			timeoutMs: 725,
			exitSeen: 1,
			deadlineFired: 2,
			settled: 3,
			drainFired: undefined
		};
		expect(b2ArrangementHeld(held), 'CONTROL: settled by the deadline, the drain sentinel never fired').toBe(true);
		expect(
			b2ArrangementHeld({ ...held, drainFired: 4 }),
			'CONTROL: settled by the deadline, the drain sentinel after it'
		).toBe(true);
		expect(
			b2ArrangementHeld({ ...held, drainFired: 3, settled: 4 }),
			'settled after the drain sentinel, in the order the deadline would have given'
		).toBe(false);
	});

	it('⛔ REG-F-452 — the reaper kills only a pid the child printed: an empty stdout is Number("") = 0, which Windows reads as THIS process', () => {
		// ⭐ DRIVEN 2026-10-10: `process.kill(0, 'SIGKILL')` ended the calling process itself, under node and under bun
		// alike, on this host (exit 1, nothing printed after it). Under a loaded gate the B2 arrangement's deadline can
		// kill the child before it prints its grandchild's pid (`REG-F-452`), the stdout is empty, and the reaper killed
		// the vitest worker running this file: four gate runs ended *"Worker exited unexpectedly"* with this file unrun.
		// ⚠ `process.kill` IS REPLACED for the arrangement, so a reaper that still kills by 0 reddens this test instead of
		// ending the worker that runs it.
		const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);
		try {
			for (const text of ['', '  ', '\n', '0', '-1', 'abc', '12.5']) reap(text);
			expect(kill, 'a text that names no positive pid is killed by nothing').not.toHaveBeenCalled();
			reap(' 4242\n');
			expect(kill).toHaveBeenCalledWith(4242, 'SIGKILL');
		} finally {
			kill.mockRestore();
		}
	});

	it('⛔⛔ B3 — a DESCENDANT HOLDING THE PIPES no longer costs the caller its outcome', async () => {
		// ⛔ `run()` PRODUCING NO FACT AT ALL IS THE WORST OUTCOME THIS PORT CAN HAVE — its entire premise is that
		// "a refusal is a fact a step can record", and silence is not a refusal. THE MUTANT: settle on `close`
		// instead of `exit`, which this arrangement never lets fire.
		// ⚠ THE WAIT IS BOUNDED, AND THE BOUND IS PART OF THE ASSERTION rather than a convenience — see
		// `settledWithin`. A case that proved "it always settles" by waiting forever when it does not would hand
		// the declared-mutant ledger an UNMEASURED verdict, and that is not a hypothetical: it happened to the
		// backstop case below, which came back INCONCLUSIVE instead of KILLED.
		// ⭑ `durationMs` BELOW THE BUDGET IS THE ASSERTION THAT BITES: it says the outcome came from the CHILD's
		// exit and not from the deadline, which is the only thing that distinguishes the fix from a shorter hang.
		const settled = await settledWithin(
			25_000,
			runner().run({ argv: node(HOLDS_THE_PIPES), cwd, timeoutMs: 8_000 })
		);
		expect(settled, 'run() must ALWAYS produce a fact — silence is not a refusal').not.toBe(
			NO_OUTCOME
		);
		if (settled === NO_OUTCOME) return;
		const out = settled;
		expect(out.ran, 'a fact, and not silence').toBe(true);
		if (!out.ran) return;
		reap(out.stdout);
		expect(out.exitCode, 'the child exited on its own').toBe(0);
		expect(out.durationMs, 'settled on the CHILD, long before the deadline').toBeLessThan(8_000);
		expect(
			out.outputComplete,
			'and the capture DECLARES that a pipe was still open rather than reading as the whole'
		).toBe(false);
	});

	it('⛔⛔ B2 — and it is NOT a timeout: a child that exited 0 in milliseconds did not time out', async () => {
		// ⭐ THE FABRICATION, DRIVEN: `timedOut` was set AT THE TIMER and never reconciled with whether the kill
		// did anything — and `child.kill` on an exited process is a no-op that does not say so consistently
		// (measured: bun returned `true`, node returned `false`, for the same already-exited child). §36.2's
		// TIMEOUT class was therefore MINTED FOR A PASSING COMMAND.
		// ⛔ THE BUDGET IS SHORTER THAN THE ARRANGEMENT'S DRAIN ON PURPOSE, so the deadline genuinely passes over
		// an already-exited child — which is the condition the old code could not tell from a real timeout.
		// THE MUTANT: set `timedOut = true` at the timer without asking whether the child was still running.
		// ⭑ THE BUDGET IS PLACED INSIDE THE DRAIN WINDOW ON PURPOSE. ~~The child exits in about 70ms on this host and
		// the capture then drains for a second, so a 500ms deadline is one that genuinely PASSES OVER AN EXITED
		// CHILD — the condition the old code could not tell from a real timeout. The window is an order of
		// magnitude wider than the startup it has to clear.~~ (Under load it was not: `REG-F-452`, below.) The capture
		// drains for a second after the child exits, so a deadline inside that second genuinely PASSES OVER AN EXITED
		// CHILD — the condition the old code could not tell from a real timeout.
		// ⛔ `REG-F-452` — ~~a 500ms deadline~~ THE DEADLINE IS PLACED AFTER AN OBSERVED EXIT, NOT AN ASSUMED ONE. Under a
		// loaded gate a node child took longer than 500ms to start, so the deadline passed over a child still RUNNING:
		// `timedOut: true` was then the true observation, and the test reported it as the defect (exit `null`, not 0).
		// ~~So the deadline steps up, 500ms at a time … the attempt whose OWN OUTCOME shows the arrangement held: exit 0,
		// and settled at or after its deadline.~~ That pair did not show the child exited BEFORE the deadline — one still
		// running when it fired, exiting 0 as the kill landed, gave the same pair — and B2 went red on such an attempt.
		// ⭐ SO THE CHILD SAYS WHEN IT EXITED (`TELLS_ITS_EXIT`), AND THE DEADLINE IS DRIVEN FROM THAT. Each attempt aims
		// its deadline `AIM_MS` past the exit the attempt before it recorded — the middle of the drain window, past the
		// margin (the first attempt, with nothing recorded yet, at 500ms; one whose child printed nothing, at twice its
		// deadline) — and the assertion is made only on an attempt that shows, by what it recorded, that the arrangement
		// held:
		//   · the child exited on its own (exit 0), and its RECORDED exit came at least `MARGIN_MS` before the deadline;
		//   · THIS process had read that exit before the deadline fired — the child's `exit` event, which the runner reads
		//     too, came before a sentinel timer armed just ahead of the runner's own, with its delay: it fires ~~in the same
		//     pass,~~ never after the runner's ⭐ (in the same pass, or a pass before it when the runner's was armed a
		//     millisecond later), so an exit read before it was the runner's fact when its deadline fired (a
		//     process too starved to read an exit before its own timer fires observes `timedOut: true` truly, as this entry
		//     says of a child still running);
		//   · and the DEADLINE settled the run — the runner handed its capture over after the sentinel fired, ~~in that same
		//     pass, so neither the drain nor the pipes' `close` did, which run in passes of their own~~ ⭐ and before a
		//     DRAIN SENTINEL fired: armed as the exit was read, by a listener added ahead of the runner's, with the drain's
		//     delay, it fires no later than the runner's drain, so a run settled before it was not settled by the drain (the
		//     re-review of E4's fix round: the order alone did not show it — a runner's timer armed a millisecond after the
		//     sentinel waits for a later pass, and a drain due between the two settled the run there). The pipes' `close`
		//     cannot come first: the grandchild holds them until it is reaped, after the outcome. `b2ArrangementHeld` asks
		//     each of these.
		// ⭑ So it is driven through `observeChildRun`, the runner's own seam (`run` hands it the child it started, and
		// returns its outcome), with a real child and the real kill — which is what lets the test arm beside its timer.
		// ⛔ An attempt where any of these did not hold asserts nothing; if none holds, the test fails listing every one.
		const AIM_MS = (MARGIN_MS + DRAIN_MS) / 2;
		const missed: string[] = [];
		let timeoutMs = 500;
		for (let attempt = 1; attempt <= 16; attempt += 1) {
			/** Where each event fell, in the order this process saw them. */
			let order = 0;
			let deadlineFired: number | undefined;
			let exitSeen: number | undefined;
			let settled: number | undefined;
			let drainFired: number | undefined;
			let drainSentinel: ReturnType<typeof setTimeout> | undefined;
			const child = spawn(process.execPath, ['-e', TELLS_ITS_EXIT], {
				cwd,
				shell: false,
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true
			});
			// ⭐ Added BEFORE the runner's own `exit` listener, so it runs first in the emit: the drain sentinel is armed just
			// ahead of the runner's drain, with its delay.
			child.on('exit', () => {
				drainSentinel ??= setTimeout(() => {
					drainFired = ++order;
				}, DRAIN_MS);
			});
			const armedAt = Date.now();
			// ⭑ ARMED FIRST, WITH THE RUNNER'S DELAY: the same delay shares one list of timers, served in the order armed.
			const sentinel = setTimeout(() => {
				deadlineFired = ++order;
			}, timeoutMs);
			const outcome = observeChildRun({
				child,
				terminate: () => {
					child.kill('SIGKILL');
				},
				timeoutMs,
				startedAt: armedAt,
				workspaceName: basename(cwd),
				programName: 'jpwb-tells-its-exit',
				retain: async (): Promise<ProcessOutputRetention> => {
					settled ??= ++order;
					return { retained: false, notRetainedBecause: 'not reached on this arm' };
				}
			});
			// ⭑ Added after the runner's own `exit` listener, so it runs in the same emit, just after the runner's.
			child.on('exit', () => {
				exitSeen ??= ++order;
			});
			const out = await outcome;
			clearTimeout(sentinel);
			clearTimeout(drainSentinel);
			const told = toldExit(out.ran ? out.stdout : '');
			if (told !== undefined) reap(String(told.pid));
			if (
				out.ran &&
				b2ArrangementHeld({
					exitCode: out.exitCode,
					toldExitAt: told?.exitAt,
					armedAt,
					timeoutMs,
					exitSeen,
					deadlineFired,
					settled,
					drainFired
				})
			) {
				expect(out.timedOut, 'a deadline that passes over an EXITED child is not a timeout').toBe(false);
				return;
			}
			const recorded = told === undefined ? 'nothing' : `${told.exitAt - armedAt}ms`;
			missed.push(
				`deadline ${timeoutMs}ms: exit ${out.ran ? out.exitCode : 'none'}, its recorded exit ${recorded}, the ` +
					`order exit/deadline/settled/drain ${exitSeen ?? '-'}/${deadlineFired ?? '-'}/${settled ?? '-'}/` +
					`${drainFired ?? '-'}`
			);
			timeoutMs =
				told === undefined
					? Math.min(timeoutMs * 2, 16_000)
					: Math.max(told.exitAt - armedAt, 0) + AIM_MS;
		}
		expect.fail(
			`the arrangement was never established, a deadline passing over an EXITED child: ${missed.join('; ')}`
		);
	}, 120_000);

	it('⛔ and a child that outlives its deadline AND the kill is a REFUSAL, never silence and never a fake code', async () => {
		// ⭐ THE LAST THING BETWEEN `run` AND A PROMISE THAT NEVER SETTLES. `SIGKILL` cannot be survived on either
		// platform, so the only way to observe what this runner does when a kill accomplishes NOTHING is to hand
		// it a kill that accomplishes nothing — against a REAL child, with real streams and real events, so the
		// arrangement differs from production in exactly the one fact under test.
		// ⛔ THE MUTANT: drop the post-kill grace; `run` then never settles for a child the kill did not reach.
		// ⭑ AND IT MUST NOT FABRICATE: `exitCode: null` reads as "terminated by a signal", which is precisely what
		// was NOT observed, so this arm carries no exit code at all.
		const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
			cwd,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		});
		try {
			// ⛔ BOUNDED, AND THE BOUND IS THE ASSERTION. The post-kill grace is 2s, so 10s is ample; what the
			// bound buys is that removing that grace fails HERE, naming the broken promise, instead of running out
			// the runner's own 60s clock and being recorded as UNMEASURED. Driven: it was.
			const settled = await settledWithin(
				10_000,
				observeChildRun({
					child,
					terminate: () => undefined,
					timeoutMs: 300,
					startedAt: Date.now(),
					workspaceName: basename(cwd),
					programName: 'jpwb-unkillable',
					retain: async (): Promise<ProcessOutputRetention> => ({
						retained: false,
						notRetainedBecause: 'not reached on this arm'
					})
				})
			);
			expect(settled, 'run() must ALWAYS produce a fact — silence is not a refusal').not.toBe(
				NO_OUTCOME
			);
			if (settled === NO_OUTCOME) return;
			const out = settled;
			expect(out.ran, 'a fact, and not silence').toBe(false);
			expect(Object.hasOwn(out, 'exitCode'), 'and no exit code was invented').toBe(false);
			expect(out.ran === false && out.refusedBecause).toContain('SIGKILL');
			expect(out.ran === false && out.refusedBecause).toContain(basename(cwd));
			expect(
				out.ran === false && out.refusedBecause,
				'it says the process may still be alive'
			).toMatch(/still be running/);
		} finally {
			child.kill('SIGKILL');
		}
	});

	it('⭑ CONTROL — the SAME observer with a REAL kill reports a RAN outcome, so the refusal discriminates', async () => {
		// ⛔ WITHOUT THIS, "always refuse after the deadline" satisfies the case above — and the receipt for a
		// control that could not fail is already on this repository's record. One fact differs: the kill works.
		const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
			cwd,
			shell: false,
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		});
		const out = await observeChildRun({
			child,
			terminate: () => {
				child.kill('SIGKILL');
			},
			timeoutMs: 300,
			startedAt: Date.now(),
			workspaceName: basename(cwd),
			programName: 'jpwb-killable',
			retain: async (): Promise<ProcessOutputRetention> => ({
				retained: false,
				notRetainedBecause: 'not reached on this arm'
			})
		});
		expect(out.ran, 'the kill worked, so there IS an outcome').toBe(true);
		expect(
			out.ran === true && out.timedOut,
			'and the child WAS still running at the deadline'
		).toBe(true);
	});
});

describe('⭐⭐ REG-Q-066 / R7 — the retention disposition, driven on the REAL workspace adapter', () => {
	it('⭐ BOTH STREAMS ARE RETAINED, and the outcome POINTS AT THEM so nothing is an orphan', async () => {
		// ⛔ `REG-F-336` C-2 FORBIDS *"content on the content plane with no record on the record plane pointing at
		// it"*. THE MUTANT: retain the bytes and return `retained: false` (or drop the paths) — the bytes are
		// still there and nothing names them, which is the orphan produced by the function written to prevent it.
		// ⭑ AND THE BYTES ARE NOW ON A REAL FILESYSTEM: `existsSync` is asked as well as the workspace, because
		// the workspace answering about its own Map was how `B7` went unnoticed.
		const out = await runner().run({
			argv: node('process.stdout.write("built ok");process.stderr.write("warning: unused")'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		if (!out.ran) return;
		expect(out.retention.retained, 'R7: BOTH streams are retained').toBe(true);
		if (!out.retention.retained) return;
		expect(out.retention.workspaceOwnerId).toBe('und_2b');
		expect(await output.readFile(out.retention.stdoutPath)).toBe('built ok');
		expect(await output.readFile(out.retention.stderrPath), 'stderr too — not stdout only').toBe(
			'warning: unused'
		);
		expect(
			existsSync(join(outputDirectory, out.retention.stdoutPath)),
			'and the durable copy is a FILE ON DISK, not an entry in a Map'
		).toBe(true);
		expect(existsSync(join(outputDirectory, out.retention.stderrPath)), 'both of them').toBe(true);
	});

	it('⛔⛔ B6 — THE CUT TRAVELS WITH THE DURABLE COPY, or the durable copy is a prefix that reads as the whole', async () => {
		// ⭐ DRIVEN: 200 KiB of stdout declared `{ STDOUT, byteSize: 139264, byteOffset: 65536 }` on the TRANSIENT
		// outcome, while `captures/<uuid>/stdout.txt` was EXACTLY 65536 bytes with NOTHING beside it saying so —
		// and `retention` is documented as naming *"the DURABLE copy and the only one a purge can reach"*. The
		// port's own hazard sentence names the consequence: a prefix that reads as the whole is a pass nothing
		// produced. THE MUTANT: drop `omissions.json`, or drop `retention.omittedRegions`.
		const emitted = 200 * 1024;
		const out = await runner().run({
			argv: node(`process.stdout.write("q".repeat(${emitted}))`),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		if (!out.ran || !out.retention.retained)
			throw new Error('the run did not retain, so B6 is untestable');
		const stored = await output.readFile(out.retention.stdoutPath);
		expect(Buffer.byteLength(stored ?? '', 'utf8'), 'the durable copy IS a bounded prefix').toBe(
			CAP_BYTES
		);
		// ⭑ LIMB ONE — THE RECORD THAT NAMES THE BYTES CARRIES THE CUT.
		expect(
			out.retention.omittedRegions,
			'the retention declares it, not only the transient outcome'
		).toEqual(out.omittedRegions);
		expect(out.retention.omittedRegions.length).toBe(1);
		// ⭑ LIMB TWO — THE DIRECTORY HOLDING THE BYTES DECLARES IT, for a reader who never sees the record.
		expect(
			dirname(out.retention.omissionsPath),
			'the declaration is a SIBLING of the bytes it is about'
		).toBe(dirname(out.retention.stdoutPath));
		const declaredText = await output.readFile(out.retention.omissionsPath);
		expect(declaredText, 'and it is ON DISK beside them').toBeDefined();
		const declared = JSON.parse(declaredText ?? '{}') as {
			note: string;
			omittedRegions: { stream: string; byteSize: number; byteOffset: number }[];
		};
		expect(declared.note, 'it says the capture is not the whole output').toMatch(/INCOMPLETE/);
		expect(declared.omittedRegions[0]?.stream).toBe('STDOUT');
		expect(
			(declared.omittedRegions[0]?.byteOffset ?? 0) + (declared.omittedRegions[0]?.byteSize ?? 0),
			'REG-D-057: enough structure to undo it — the two reconstruct what was emitted'
		).toBe(emitted);
	});

	it('⭑ CONTROL — a capture with NOTHING cut says so, rather than saying nothing', async () => {
		// ⛔ WITHOUT THIS, `omissions.json` could be written only when there IS a cut — and its ABSENCE would then
		// be ambiguous between "complete" and "nobody looked", which is the exact ambiguity the port refuses for
		// `omittedRegions`. The declaration is unconditional, and this is the arm that proves it.
		const out = await runner().run({
			argv: node('process.stdout.write("small")'),
			cwd,
			timeoutMs: 30_000
		});
		if (!out.ran || !out.retention.retained) throw new Error('the run did not retain');
		expect(out.retention.omittedRegions).toEqual([]);
		const declared = JSON.parse((await output.readFile(out.retention.omissionsPath)) ?? '{}') as {
			note: string;
		};
		expect(declared.note).toMatch(/COMPLETE/);
	});

	it('⭐ AND BOTH COME UNDER PURGE — driven, because that is the clause that makes retaining them lawful', async () => {
		// ⛔ THIS IS THE HALF `R7` TURNS ON, AND IT IS THE HALF A COMMENT CANNOT CARRY. `ArtifactStore`'s header:
		// *"a store with `put` and no `purge` would not make retention lawful — it would move the unlawfulness
		// behind an interface."* THE MUTANT: declare the output workspace `RETAINED_BY_PARTICIPATION` in
		// `workspace-host.ts` — `purge` then REFUSES and these bytes could never be destroyed.
		// ⚠ AND THE ENTRY MUST SURVIVE ITS OWN PURGE, so *"purged on schedule"* stays distinguishable from
		// *"never written"* and from *"lost"*.
		// ⭑ ON THE REAL ADAPTER: `existsSync` is asked too, because a Map that forgot a key and a file that was
		// actually removed are the same answer from `readFile` and completely different facts on a host.
		const out = await runner().run({
			argv: node('process.stderr.write("secret-ish diagnostic")'),
			cwd,
			timeoutMs: 30_000
		});
		if (!out.ran || !out.retention.retained)
			throw new Error('the run did not retain, so purge is untestable');
		const { stderrPath, purgeability } = out.retention;
		expect(purgeability, 'the class R7 forces — see the adapter header').toBe(
			'PURGEABLE_AT_EXPIRY'
		);
		const purged = await output.purge(stderrPath);
		expect(purged.purged, 'R7: it comes under purge').toBe(true);
		expect(await output.readFile(stderrPath), 'the bytes are gone').toBeUndefined();
		expect(
			existsSync(join(outputDirectory, stderrPath)),
			'gone from the DISK, not from a Map'
		).toBe(false);
		const entry = (await output.list()).find((e) => e.path === stderrPath);
		expect(entry?.purged, 'and the ENTRY survives, so the purge stays explicable').toBe(true);
	});

	it('⛔ the factory REFUSES an output workspace whose bytes could never be purged', async () => {
		// ⭐ THIS IS THE `REG-Q-066` DISPOSITION MADE STRUCTURAL. `R7` says both streams come under purge; `PER-8`
		// makes `purge` REFUSE on a workspace declared to have participated; so wiring one here would produce a
		// runner that captures `stderr` into bytes nothing can ever destroy — the exact surface the question is
		// about, reached through a one-word host mistake. THE MUTANT: drop the check.
		// ⚠ THE ARRANGEMENT IS A **FILESYSTEM** WORKSPACE, DELIBERATELY. An arrangement that trips TWO conjuncts
		// proves NEITHER, and the in-memory one this case used to use trips the materialization guard below too.
		const participating = createFilesystemWorkspace({
			ownerKind: 'UNDERTAKING',
			ownerId: 'und_2b',
			purgeability: 'RETAINED_BY_PARTICIPATION',
			directoryPath: outputDirectory
		});
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: participating
			})
		).toThrow(/R7/);
	});

	it('⛔⛔ B7 — and it REFUSES an IN_MEMORY output workspace, whatever class it declares', async () => {
		// ⭐ THE GUARD CHECKED `purgeability` AND NOT `materialization`, so a workspace with the right class and NO
		// DIRECTORY was ACCEPTED and returned `kind: 'REAL'`. DRIVEN: a real child ran, `retention` said
		// `retained: true` and handed back a `stdoutPath`, while `materialization === 'IN_MEMORY'` and
		// `directoryPath === undefined` — bytes in a Map presented as the durable copy a purge can reach, which is
		// `R7` false at the moment it is asserted true. THE MUTANT: check only the class.
		// ⚠ THE CLASS HERE IS THE LAWFUL ONE, so this arrangement trips THIS conjunct and no other.
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: deliverable,
				outputWorkspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_2b',
					purgeability: 'PURGEABLE_AT_EXPIRY'
				})
			})
		).toThrow(/IN_MEMORY/);
	});

	it('⛔⛔ B8 — and it REFUSES to be constructed against a deliverable workspace with no directory at all', async () => {
		// ⭑ THE STRUCTURAL HALF OF `B8`: a runner that cannot name the one directory it may run in cannot check a
		// `cwd`, and `RULE 5` says the arm with no directory keeps the REFUSING default. THE MUTANT: accept it —
		// every `cwd` then compares against `undefined` and the containment check is decided by an absence.
		expect(() =>
			createChildProcessRunner({
				deliverableWorkspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_2b',
					purgeability: 'RETAINED_BY_PARTICIPATION'
				}),
				outputWorkspace: output
			})
		).toThrow(/deliverable workspace/);
	});

	it('⭑ CONTROL — the lawful wiring is accepted, so all three refusals above DISCRIMINATE', async () => {
		// ⛔ A FACTORY THAT THREW AT EVERYTHING WOULD SATISFY EVERY CASE ABOVE, and this repository has the
		// receipt for exactly that shape of vacuous green.
		expect(() =>
			createChildProcessRunner({ deliverableWorkspace: deliverable, outputWorkspace: output })
		).not.toThrow();
	});

	it('⚠ a PARTIALLY written capture is not a retention — it is refused, and whatever landed is swept', async () => {
		// ⛔ THE ORPHAN ARRIVES THROUGH THE PARTIAL CASE, NOT THE TOTAL ONE. Reporting `retained: false` while
		// leaving `stdout.txt` on disk is exactly `REG-F-336` C-2: bytes on the content plane that no record
		// names. THE MUTANT: return the refusal without purging what landed.
		// ⚠ THIS ONE IS STILL A STUB, AND THAT IS STATED RATHER THAN HIDDEN: a partial failure needs a write that
		// refuses while its siblings succeed, and a real filesystem does not offer that on demand. It SPREADS the
		// real adapter, so the class, the materialization and the directory are the real ones; only `writeFile`
		// and `purge` are arranged. The TOTAL case below is driven on the real filesystem with no stub at all.
		const purges: string[] = [];
		const written = new Map<string, string>();
		const refusing: Workspace = {
			...output,
			async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
				if (path.endsWith('stderr.txt'))
					return { written: false, refusedBecause: 'the arranged refusal' };
				written.set(path, contents);
				return { written: true, path, byteSize: Buffer.byteLength(contents, 'utf8') };
			},
			async purge(path: string): Promise<PurgeOutcome> {
				purges.push(path);
				written.delete(path);
				return { purged: true };
			}
		};
		const out = await createChildProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: refusing
		}).run({ argv: node('process.stdout.write("half")'), cwd, timeoutMs: 30_000 });
		expect(out.ran, 'the RUN still happened — a retention failure is not a run failure').toBe(true);
		if (!out.ran) return;
		expect(out.retention.retained).toBe(false);
		expect(out.retention.retained === false && out.retention.notRetainedBecause).toContain(
			'the arranged refusal'
		);
		expect(
			purges.map((p) => basename(p)).sort(),
			'every part that landed was swept — the declaration as well as the stream'
		).toEqual(['omissions.json', 'stdout.txt']);
		expect(written.size, 'so no bytes remain that nothing points at').toBe(0);
	});

	it('⚠ W2 — and a purge that RAISES leaves an orphan, so the record says there is one', async () => {
		// ⭐ THE THIRD PASS DISCLOSED THIS AS ADAPTER-CONTINGENT AND IT WAS A REAL HOLE. `Workspace.purge` is
		// promised to refuse rather than throw and both adapters in this repository do — but `retain` ALREADY
		// declines to trust that same promise for `writeFile`, and the sweep did not. Driven with the stub
		// below before the fix: the throw escaped to `retain`'s outer catch, which answered for a WRITE that
		// never failed, dropped the part-by-part reasons, and said NOTHING about the `stdout.txt` it had just
		// left on disk — `REG-F-336` C-2's orphan, through the one function written to prevent it, twice.
		// ⛔ THE MUTANT: remove the try/catch and let the throw escape — the record then reports a workspace
		// that "raised rather than refusing" and a reader auditing it concludes there is nothing to purge.
		// ⚠ THE STUB IS THE SAME SHAPE AS THE PARTIAL-CAPTURE CASE ABOVE, and for the same reason: a real
		// filesystem does not raise out of `purge` on demand. It SPREADS the real adapter, so the class, the
		// materialization and the directory are real; only the two methods are arranged.
		const written = new Map<string, string>();
		const raised: string[] = [];
		const raising: Workspace = {
			...output,
			async writeFile(path: string, contents: string): Promise<WorkspaceWriteOutcome> {
				if (path.endsWith('stderr.txt'))
					return { written: false, refusedBecause: 'the arranged refusal' };
				written.set(path, contents);
				return { written: true, path, byteSize: Buffer.byteLength(contents, 'utf8') };
			},
			purge(path: string): Promise<PurgeOutcome> {
				raised.push(path);
				const cause: NodeJS.ErrnoException = new Error('the arranged raise');
				cause.code = 'EPERM';
				throw cause;
			}
		};
		const out = await createChildProcessRunner({
			deliverableWorkspace: deliverable,
			outputWorkspace: raising
		}).run({ argv: node('process.stdout.write("half")'), cwd, timeoutMs: 30_000 });
		expect(out.ran, 'the RUN still happened — a retention failure is not a run failure').toBe(true);
		if (!out.ran) return;
		expect(out.retention.retained).toBe(false);
		const why = out.retention.retained === false ? out.retention.notRetainedBecause : '';
		expect(raised.length, 'the sweep was attempted').toBeGreaterThan(0);
		expect(why, 'the record NAMES the bytes nothing points at').toContain('orphan');
		expect(why, 'and says why they are still there').toContain('EPERM');
		expect(why, 'and still carries the write refusal that started it').toContain(
			'the arranged refusal'
		);
		expect(written.size, 'and the bytes ARE still there — the record is not lying about it').toBe(2);
	});

	it('⛔ a run whose capture the REAL FILESYSTEM refuses still reports the exit code it observed', async () => {
		// ⚠ THE OPPOSITE FAILURE, AND IT IS THE ONE THAT WOULD BE TEMPTING TO GET WRONG THE OTHER WAY. Retention
		// is a fact about the bytes; the exit code is a fact about the process. Collapsing a retention refusal
		// into `ran: false` would DESTROY an observation this runner actually made — and `ran: false` says no
		// process ran, which would be false. THE MUTANT: return `ran: false` when retention refuses.
		// ⭐ AND THE REFUSAL IS THE FILESYSTEM'S OWN: a FILE is planted where the capture directory has to be, so
		// `mkdir` under it cannot succeed. No stub is involved — this is `createFilesystemWorkspace` refusing.
		await writeFile(join(outputDirectory, 'captures'), 'a file where a directory must go', 'utf8');
		const out = await runner().run({ argv: node('process.exit(5)'), cwd, timeoutMs: 30_000 });
		expect(out.ran).toBe(true);
		expect(out.ran === true && out.exitCode).toBe(5);
		expect(out.ran === true && out.retention.retained).toBe(false);
		expect(
			out.ran === true && out.retention.retained === false && out.retention.notRetainedBecause,
			'and it says which part could not be kept'
		).toContain('stdout');
	});

	it('⛔⛔ B4 — A RUN THAT PRODUCED NO OUTCOME RETAINS NOTHING, however late the events arrive', async () => {
		// ⭐ THE ORPHAN MINTED BY THE FUNCTION WRITTEN TO PREVENT IT. `close` fires AFTER `error`, the close
		// handler called `retain()` UNCONDITIONALLY, and only the OUTCOME was guarded against being settled twice.
		// DRIVEN with a program that does not exist: `run` resolved `{ ran: false }` with no retention field and
		// an EMPTY captures directory — and 400ms later `stdout.txt` and `stderr.txt` EXISTED and `list()`
		// reported them live. Content on the content plane, no record naming it, on the arm the adapter itself
		// calls the commonest outcome of a model naming a tool the host does not have.
		// ⛔ THE MUTANT: call `retain` from the close handler rather than from inside the claimed outcome.
		// ⚠ THE WAIT IS THE WHOLE CASE. Asserting emptiness immediately passes against the defect.
		const out = await runner().run({ argv: ['no-such-tool-zzz'], cwd, timeoutMs: 30_000 });
		expect(out.ran).toBe(false);
		expect(Object.hasOwn(out, 'retention'), 'a refusal carries no retention at all').toBe(false);
		await new Promise((settle) => setTimeout(settle, 400));
		expect(await output.list(), 'THE BREACH ITSELF: bytes that appeared after the refusal').toEqual(
			[]
		);
		expect(
			existsSync(join(outputDirectory, 'captures')),
			'and no capture directory was ever made'
		).toBe(false);
	});
});
