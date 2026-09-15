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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import {
	createInMemoryWorkspace,
	type PurgeOutcome,
	type Workspace,
	type WorkspaceWriteOutcome
} from '@janumipwb/rph-ports';
import { createChildProcessRunner } from './child-process-runner.js';

/** The cap `child-process-runner.ts` declares. ⚠ RESTATED, NOT IMPORTED — see the truncation case. */
const CAP_BYTES = 64 * 1024;

let container = '';
let cwd = '';
let output: Workspace;

/** A child that evaluates `script`. `process.execPath` is whichever runtime is running this spec. */
function node(script: string, ...args: string[]): string[] {
	return [process.execPath, '-e', script, ...args];
}

beforeEach(async () => {
	container = await mkdtemp(join(tmpdir(), 'jpwb-runner-'));
	cwd = join(container, 'workspace');
	await mkdir(cwd, { recursive: true });
	output = createInMemoryWorkspace({
		ownerKind: 'UNDERTAKING',
		ownerId: 'und_2b',
		purgeability: 'PURGEABLE_AT_EXPIRY'
	});
});

afterEach(async () => {
	await rm(container, { recursive: true, force: true });
});

describe('createChildProcessRunner — a command actually runs, and every failure stays distinguishable', () => {
	it('⭐ CONTROL — it RUNS: an exit code, and BOTH streams, observed from a real process', async () => {
		// ⛔ WITHOUT THIS, EVERY REFUSAL BELOW IS SATISFIED BY "REFUSES EVERYTHING" — which is what the Phase 1
		// default already does, and shipping it again under a new name would pass a suite made only of negatives.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
		expect(out.omittedRegions, 'nothing was cut, and that is stated rather than left empty by accident').toEqual([]);
	});

	it('⛔ NO SHELL — a `>` in the argv is an ARGUMENT, never a redirection', async () => {
		// ⭑ DRIVEN RATHER THAN ASSERTED FROM THE OPTION. `shell: false` is one word in a spawn call and reading it
		// proves nothing about what the operating system did; a redirection that LANDS is the only thing that
		// distinguishes the two. THE MUTANT: `shell: true` — measured, it creates `pwned.txt` in the cwd.
		// ⛔ AND THE STAKE IS THE WHOLE SEAM: argv comes from a model in Phase 3. A shell would make every
		// metacharacter in a model's chosen argument an instruction to the host.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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

	it('⚠ `timedOut` is OBSERVED at the kill — and a SIGKILLed process reports a NULL exit code', async () => {
		// ⛔ §36.2 SEPARATES TIMEOUT FROM TOOL_FAILURE, and the runner must report the kill it issued rather than
		// leave the caller to guess it back out. THE MUTANT: `timedOut: false` — the watchdog still kills and the
		// record no longer says why the process died.
		// ⚠ AND THE OBVIOUS MUTANT — `timedOut: exitCode === null` — SURVIVES ON THIS HOST, WHICH IS RECORDED IN
		// THE ADAPTER'S HEADER WITH THE FOUR MEASUREMENTS THAT EXPLAIN IT. On Windows a null exit code arises
		// only from the kill this runner itself issued, so the inference and the observation coincide HERE; on
		// POSIX an external SIGKILL delivers null and they do not. The flag is pinned in both directions instead.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
			argv: ['jpwb-no-such-program-2b', '--version'],
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(false);
		expect(Object.hasOwn(out, 'exitCode')).toBe(false);
		expect(Object.hasOwn(out, 'stdout')).toBe(false);
		expect(Object.hasOwn(out, 'timedOut')).toBe(false);
		expect(out.ran === false && out.refusedBecause).toContain('ENOENT');
		expect(out.ran === false && out.refusedBecause).toContain('jpwb-no-such-program-2b --version');
	});

	it('⛔ an argv the PLATFORM refuses is a refusal too — `run` never throws, and never echoes it back', async () => {
		// ⚠ FOUND BY PROBING THE ADAPTER, NOT BY READING IT. `spawn` raises `ERR_INVALID_ARG_VALUE` SYNCHRONOUSLY
		// for an embedded NUL and for an empty program name — measured, all three arrangements — so those never
		// reach the `error` event, and before this arm existed they left `run` as a REJECTED PROMISE: a stack
		// trace where the port requires a fact a step can record. THE MUTANT: fabricate a run for it.
		// ⭑ AND THE ARGV IS NOT QUOTED BACK, WHICH IS THE SECOND LIMB. A NUL byte in a `refusedBecause` travels
		// into a governed record and into a model's context; the code and the SHAPE of the fault are what a
		// reader acts on.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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

	it('⛔ and the refusal names the workspace DIRECTORY, never the host’s absolute path', async () => {
		// ⚠ PHASE 2's `F4`, WHICH WAS FOUND IN THE REFUSING DEFAULT AND WOULD HAVE BEEN REINTRODUCED HERE. A
		// `refusedBecause` is defined by the port as a fact a step RECORDS, so it travels into a governed record
		// and into a model's context; the host's filesystem layout belongs in neither. THE MUTANT: interpolate
		// `request.cwd`.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
			argv: ['jpwb-no-such-program-2b'],
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran === false && out.refusedBecause, 'it still says WHERE').toContain(basename(cwd));
		expect(
			out.ran === false && out.refusedBecause,
			'and never by leaking the host absolute path into a recorded refusal'
		).not.toContain(cwd);
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
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
		expect(cut.byteOffset + cut.byteSize, 'and the two reconstruct what the process emitted').toBe(emitted);
		expect(Buffer.byteLength(out.stdout, 'utf8'), 'the retained half is what the offset says it is').toBe(
			CAP_BYTES - 1
		);
		expect(out.stdout, 'and no character the process never emitted').not.toContain('�');
		expect(cut.reason).toMatch(/bounded/);
	});

	it('⚠ and stderr is bounded by the SAME rule — the hazard is not stdout-shaped', async () => {
		// ⛔ `R7` IS ABOUT BOTH STREAMS, AND A BOUND APPLIED TO ONE OF THEM IS THE DEFECT THIS REPOSITORY KEEPS
		// FILING: a rule stated generally and implemented once. THE MUTANT: bound stdout only.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
			const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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

describe('⭐⭐ REG-Q-066 / R7 — the retention disposition, driven rather than documented', () => {
	it('⭐ BOTH STREAMS ARE RETAINED, and the outcome POINTS AT THEM so nothing is an orphan', async () => {
		// ⛔ `REG-F-336` C-2 FORBIDS *"content on the content plane with no record on the record plane pointing at
		// it"*. THE MUTANT: retain the bytes and return `retained: false` (or drop the paths) — the bytes are
		// still there and nothing names them, which is the orphan produced by the function written to prevent it.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
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
	});

	it('⭐ AND BOTH COME UNDER PURGE — driven, because that is the clause that makes retaining them lawful', async () => {
		// ⛔ THIS IS THE HALF `R7` TURNS ON, AND IT IS THE HALF A COMMENT CANNOT CARRY. `ArtifactStore`'s header:
		// *"a store with `put` and no `purge` would not make retention lawful — it would move the unlawfulness
		// behind an interface."* THE MUTANT: declare the output workspace `RETAINED_BY_PARTICIPATION` in
		// `workspace-host.ts` — `purge` then REFUSES and these bytes could never be destroyed.
		// ⚠ AND THE ENTRY MUST SURVIVE ITS OWN PURGE, so *"purged on schedule"* stays distinguishable from
		// *"never written"* and from *"lost"*.
		const out = await createChildProcessRunner({ outputWorkspace: output }).run({
			argv: node('process.stderr.write("secret-ish diagnostic")'),
			cwd,
			timeoutMs: 30_000
		});
		if (!out.ran || !out.retention.retained) throw new Error('the run did not retain, so purge is untestable');
		const { stderrPath, purgeability } = out.retention;
		expect(purgeability, 'the class R7 forces — see the adapter header').toBe('PURGEABLE_AT_EXPIRY');
		const purged = await output.purge(stderrPath);
		expect(purged.purged, 'R7: it comes under purge').toBe(true);
		expect(await output.readFile(stderrPath), 'the bytes are gone').toBeUndefined();
		const entry = (await output.list()).find((e) => e.path === stderrPath);
		expect(entry?.purged, 'and the ENTRY survives, so the purge stays explicable').toBe(true);
	});

	it('⛔ the factory REFUSES an output workspace whose bytes could never be purged', async () => {
		// ⭐ THIS IS THE `REG-Q-066` DISPOSITION MADE STRUCTURAL. `R7` says both streams come under purge; `PER-8`
		// makes `purge` REFUSE on a workspace declared to have participated; so wiring one here would produce a
		// runner that captures `stderr` into bytes nothing can ever destroy — the exact surface the question is
		// about, reached through a one-word host mistake. THE MUTANT: drop the check.
		expect(() =>
			createChildProcessRunner({
				outputWorkspace: createInMemoryWorkspace({
					ownerKind: 'UNDERTAKING',
					ownerId: 'und_2b',
					purgeability: 'RETAINED_BY_PARTICIPATION'
				})
			})
		).toThrow(/R7/);
	});

	it('⚠ a HALF-written pair is not a retention — it is refused, and the half that landed is swept', async () => {
		// ⛔ THE ORPHAN ARRIVES THROUGH THE PARTIAL CASE, NOT THE TOTAL ONE. Reporting `retained: false` while
		// leaving `stdout.txt` on disk is exactly `REG-F-336` C-2: bytes on the content plane that no record
		// names. THE MUTANT: return the refusal without purging what landed.
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
		const out = await createChildProcessRunner({ outputWorkspace: refusing }).run({
			argv: node('process.stdout.write("half")'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran, 'the RUN still happened — a retention failure is not a run failure').toBe(true);
		if (!out.ran) return;
		expect(out.retention.retained).toBe(false);
		expect(out.retention.retained === false && out.retention.notRetainedBecause).toContain(
			'the arranged refusal'
		);
		expect(purges.map((p) => p.endsWith('stdout.txt')), 'the half that landed was swept').toEqual([true]);
		expect(written.size, 'so no bytes remain that nothing points at').toBe(0);
	});

	it('⛔ a run whose capture is REFUSED still reports the exit code it observed', async () => {
		// ⚠ THE OPPOSITE FAILURE, AND IT IS THE ONE THAT WOULD BE TEMPTING TO GET WRONG THE OTHER WAY. Retention
		// is a fact about the bytes; the exit code is a fact about the process. Collapsing a retention refusal
		// into `ran: false` would DESTROY an observation this runner actually made — and `ran: false` says no
		// process ran, which would be false. THE MUTANT: return `ran: false` when retention refuses.
		const refusing: Workspace = {
			...output,
			writeFile: async () => ({ written: false, refusedBecause: 'nothing may be written' }),
			purge: async () => ({ purged: true })
		};
		const out = await createChildProcessRunner({ outputWorkspace: refusing }).run({
			argv: node('process.exit(5)'),
			cwd,
			timeoutMs: 30_000
		});
		expect(out.ran).toBe(true);
		expect(out.ran === true && out.exitCode).toBe(5);
		expect(out.ran === true && out.retention.retained).toBe(false);
	});
});
