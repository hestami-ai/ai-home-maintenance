// JAN-EXEC Phase 1 — the join between the two ports, which is the one failure this seam must never have.
//
// ⛔ A `ProcessRunner` NEEDS A REAL `cwd`; AN IN_MEMORY `Workspace` HAS NONE. A host that wires a REAL runner
// against an in-memory workspace must be caught BEFORE anything runs — otherwise the command executes in some
// other directory, most likely the server's own source tree, while the record says it ran in the workspace.
// `openPiExecutionSession` hardcodes `process.cwd()` twice today, so this is measured, not hypothetical.
import { describe, expect, it } from 'vitest';
import { planProcessRun, programFileName, workspaceDirectoryName } from './process-runner.js';
import { createInMemoryWorkspace } from '../defaults/workspace.js';
import { createRefusingProcessRunner } from '../defaults/process-runner.js';

const MEMORY = createInMemoryWorkspace({
	ownerKind: 'UNDERTAKING',
	ownerId: 'und_7',
	purgeability: 'PURGEABLE_AT_EXPIRY'
});

/** A materialized workspace, declared by hand — Phase 2 builds the adapter that produces one for real. */
const ON_DISK = {
	ownerId: 'und_7',
	ownerKind: 'UNDERTAKING',
	materialization: 'FILESYSTEM',
	directoryPath: '/var/jpwb/und_7'
} as const;

const REAL = { kind: 'REAL' } as const;

describe('planProcessRun — the two ports are NOT independent', () => {
	it('⛔⛔ REFUSES a REAL runner against an IN_MEMORY workspace, naming the materialization', async () => {
		// ⭑ THE REFUSAL MUST NAME THE MATERIALIZATION, because that is the fact the host has to change. THE
		// MUTANT: plan the run anyway and let the runner sort it out — there is nothing to sort out, because
		// `cwd` is REQUIRED on the request, so the caller would supply `process.cwd()` and the command would
		// execute in the server's source tree with every record still reading as correct.
		const plan = planProcessRun({
			runner: REAL,
			workspace: MEMORY,
			argv: ['node', '--test'],
			timeoutMs: 30_000
		});
		expect(plan.planned).toBe(false);
		expect(!plan.planned && plan.refusedBecause).toContain('IN_MEMORY');
		expect(!plan.planned && plan.refusedBecause, 'and that this is the host’s error').toMatch(
			/WIRING ERROR/
		);
		expect(!plan.planned && plan.refusedBecause).toMatch(/some other directory/);
	});

	it('⚠ the REFUSING runner is refused too — but DISTINGUISHABLY, because it is the hermetic default', () => {
		// ⭑ COLLAPSING THE TWO MESSAGES WOULD MAKE A MISCONFIGURATION READ EXACTLY LIKE THE DEFAULT, and the
		// library's own default combination is the one every existing test is in. A host debugging "why did
		// nothing run" must be able to tell "you wired this wrong" from "you wired nothing".
		const plan = planProcessRun({
			runner: createRefusingProcessRunner(),
			workspace: MEMORY,
			argv: ['node', '--test'],
			timeoutMs: 30_000
		});
		expect(plan.planned).toBe(false);
		expect(!plan.planned && plan.refusedBecause).toMatch(/hermetic default/);
		expect(!plan.planned && plan.refusedBecause, 'this is NOT the wiring error').not.toMatch(
			/WIRING ERROR/
		);
	});

	it('⭑⭑ CONTROL — a FILESYSTEM workspace and a REAL runner PLAN, and the cwd is the WORKSPACE’s own', async () => {
		// ⛔ WITHOUT THIS THE CHECK IS SATISFIABLE BY REFUSING EVERYTHING, and Phase 2 would find the seam
		// unusable. ⭑ The second assertion is the one that matters: `cwd` comes FROM `directoryPath` and is not
		// something the caller supplied, which is what makes "the command ran in the workspace" a fact rather
		// than a hope.
		const plan = planProcessRun({
			runner: REAL,
			workspace: ON_DISK,
			argv: ['node', '--test'],
			timeoutMs: 30_000
		});
		expect(plan.planned, !plan.planned ? plan.refusedBecause : '').toBe(true);
		expect(plan.planned && plan.request.cwd).toBe('/var/jpwb/und_7');
		expect(plan.planned && plan.request.argv).toEqual(['node', '--test']);
		expect(plan.planned && plan.request.timeoutMs).toBe(30_000);
	});

	it('⛔ REFUSES a workspace whose DECLARATION and directoryPath disagree', () => {
		// ⚠ TRUSTING THE ENUM AND READING `directoryPath!` WOULD HAND `undefined` TO `spawn`, WHICH INHERITS THE
		// PARENT PROCESS'S cwd — the exact escape this function exists to close, arriving through the arm that
		// was supposed to be the safe one. THE MUTANT: drop this check; the FILESYSTEM arm then plans a run with
		// `cwd: undefined` and the containment guarantee is gone while every other assertion here still passes.
		const plan = planProcessRun({
			runner: REAL,
			workspace: { ...ON_DISK, directoryPath: undefined },
			argv: ['node', '--test'],
			timeoutMs: 30_000
		});
		expect(plan.planned).toBe(false);
		expect(!plan.planned && plan.refusedBecause).toMatch(/no directoryPath/);
	});

	it('⛔ REFUSES an empty argv — nothing to start is not an empty command', () => {
		// THE MUTANT: pass it through. `spawn` then throws ENOENT for a missing program, and a stack trace
		// arrives where a refusal a step could record belongs.
		for (const argv of [[], ['']]) {
			const plan = planProcessRun({ runner: REAL, workspace: ON_DISK, argv, timeoutMs: 1000 });
			expect(plan.planned, `argv ${JSON.stringify(argv)} must not plan`).toBe(false);
			expect(!plan.planned && plan.refusedBecause).toMatch(/No program was named/);
		}
	});

	it('⛔ REFUSES a timeout that would make `timedOut` an artifact of configuration', () => {
		// ⭐ §36.2 SEPARATES TIMEOUT FROM TOOL_FAILURE, so `timedOut` has to be something the runner OBSERVED.
		// A bound of 0 kills the process before it can do anything and reports TIMEOUT for a command that never
		// ran; Infinity makes the class unreachable. Both convert an observation into a configuration artifact,
		// which is this programme's rule 6 arriving through the timeout rather than through the exit code.
		for (const timeoutMs of [0, -1, Number.POSITIVE_INFINITY, Number.NaN]) {
			const plan = planProcessRun({
				runner: REAL,
				workspace: ON_DISK,
				argv: ['node'],
				timeoutMs
			});
			expect(plan.planned, `timeoutMs ${String(timeoutMs)} must not plan`).toBe(false);
			expect(!plan.planned && plan.refusedBecause).toMatch(/§36\.2/);
		}
	});
});

describe('⚠ W1 — what a refusal may disclose about WHAT, and the residue that is DISCLOSED not fixed', () => {
	/**
	 * ⛔ THE RULE IS A BOUND, AND THIS IS THE BOUND DRIVEN RATHER THAN DESCRIBED. `B5` drove the unbounded
	 * form: `argv.join(' ')` put an absolute program path and the operating user's name into a field this port
	 * defines as travelling into a governed record AND a model's context. What replaced it discloses AT MOST
	 * ONE SEGMENT — and a third adversarial pass named what that still costs, which is `W1`.
	 */
	const HOST_SHAPED: readonly string[] = [
		'C:\\Program Files\\nodejs\\node.exe',
		'/opt/toolchains/acme-14.2/bin/tsc',
		'C:/Users/mchen/AppData/Local/Temp/build.exe'
	];

	it('⛔ AT MOST ONE SEGMENT TRAVELS — nothing above it does, from any spelling', () => {
		// ⛔ THE MUTANT: return the last TWO segments, or the path itself. Either re-opens `B5` by degrees,
		// and "by degrees" is how a bound that was once argued for quietly stops holding.
		for (const program of HOST_SHAPED) {
			const named = programFileName(program);
			expect(named, `${program} discloses no separator`).not.toMatch(/[\\/]/);
			for (const above of program.split(/[\\/]+/).slice(0, -1).filter((s) => s !== ''))
				expect(named, `nor the segment '${above}' above it`).not.toContain(above);
		}
	});

	it('⚠ AND THE RESIDUE IS PINNED, BECAUSE IT IS DISCLOSED RATHER THAN CLOSED (`W1`)', () => {
		// ⭐ RULED 2026-09-15: DISCLOSED. A model-chosen `argv[0]` that is a host path fragment still leaks its
		// DEEPEST name — and that is written down here, as a case, rather than left in prose where it cannot
		// fail. What makes it the right trade is in `programFileName`'s own doc: something must name the failed
		// program, every alternative is either unactionable or a normaliser, and the segment that survives is
		// one the CALLER supplied rather than one the host disclosed.
		// ⛔ IF THIS CASE EVER HAS TO CHANGE, THE DISCLOSURE HAS CHANGED WITH IT — which is the whole point of
		// converting a disclosed weakness into a gated statement.
		expect(programFileName('C:\\Users\\mchen'), 'W1, verbatim from the pass that named it').toBe(
			'mchen'
		);
		// ⭑ AND THE SAME RULE, THE SAME BODY: the WHERE half discloses exactly as much as the WHAT half, which
		// is why they share a private implementation and neither can drift.
		expect(workspaceDirectoryName('C:\\Users\\mchen\\workspaces\\und_7')).toBe('und_7');
	});

	it('⭑ CONTROL — a name with nothing above it is returned whole, so the bound is not a truncation', () => {
		// ⛔ WITHOUT THIS, "discloses at most one segment" is satisfied by returning `''` for everything — a
		// guard that cannot fail, and `RULE 6`'s fabricated name in a governed record.
		expect(programFileName('tsc')).toBe('tsc');
		expect(programFileName('/'), 'a path with no nameable segment is itself, never empty').toBe('/');
	});
});
