// JAN-EXEC Phase 1 — the join between the two ports, which is the one failure this seam must never have.
//
// ⛔ A `ProcessRunner` NEEDS A REAL `cwd`; AN IN_MEMORY `Workspace` HAS NONE. A host that wires a REAL runner
// against an in-memory workspace must be caught BEFORE anything runs — otherwise the command executes in some
// other directory, most likely the server's own source tree, while the record says it ran in the workspace.
// `openPiExecutionSession` hardcodes `process.cwd()` twice today, so this is measured, not hypothetical.
import { describe, expect, it } from 'vitest';
import { planProcessRun } from './process-runner.js';
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
