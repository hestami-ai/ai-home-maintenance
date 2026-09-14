// JAN-EXEC Phase 1 — the refusing default, and the one assertion that is not about a value but about a FIELD.
//
// ⭐ RULE 6 OF THIS PROGRAMME'S ROADMAP: *"NO DEFAULT THAT FABRICATES. A no-op ProcessRunner returning
// {exitCode: 0} is indistinguishable downstream from a command that ran and passed — a step, a test, or an
// assurance policy would record a passing result nothing produced."*
import { describe, expect, it } from 'vitest';
import { createRefusingProcessRunner } from './process-runner.js';

const REQUEST = { argv: ['node', '--test'], cwd: '/work/und_1', timeoutMs: 30_000 } as const;

describe('createRefusingProcessRunner — the default that cannot invent a result', () => {
	it('⛔⛔ carries NO exitCode FIELD AT ALL — not zero, not null, not undefined-by-accident', async () => {
		// ⭑ THE ASSERTION IS `hasOwn`, AND THAT IS DELIBERATE. `expect(out.exitCode).toBeUndefined()` passes for
		// a runner that returns `{ran: true, exitCode: undefined}` — a shape that claims a command RAN and then
		// says nothing about how it went, which is worse than either honest answer. Only the presence of the
		// field discriminates. ⚠ This repository has the receipt for the weaker form: `stored?.bytes ?? ''` made
		// an assertion that could not fail, green, and proving nothing.
		const out = await createRefusingProcessRunner().run(REQUEST);
		expect(out.ran).toBe(false);
		expect(
			Object.hasOwn(out, 'exitCode'),
			'the refusing arm must be structurally unable to report an exit code'
		).toBe(false);
		expect(Object.hasOwn(out, 'stdout'), 'nor any output it did not observe').toBe(false);
		expect(Object.hasOwn(out, 'timedOut'), 'nor a timeout for a command that never started').toBe(
			false
		);
	});

	it('⭑ CONTROL — it still says WHAT was not run and WHERE, so the refusal is actionable', async () => {
		// Without this, "return nothing at all" satisfies the test above while the step records an absence a
		// reader cannot act on — the silent omission `PER-9` forbids one layer up. THE MUTANT: return a bare
		// `{ran: false, refusedBecause: 'no'}`.
		const out = await createRefusingProcessRunner().run(REQUEST);
		expect(out.ran === false && out.refusedBecause).toContain('node --test');
		expect(out.ran === false && out.refusedBecause).toContain('/work/und_1');
		expect(out.ran === false && out.refusedBecause, 'and how to get a real one').toMatch(/REAL/);
	});

	it('⭑ DECLARES itself REFUSING, so a caller knows before it writes "the command ran" anywhere', () => {
		// THE MUTANT: declare `REAL`. `planProcessRun` would then plan runs against it as though commands could
		// execute, and every refusal would arrive as a surprise at the point of use rather than at wiring time.
		expect(createRefusingProcessRunner().kind).toBe('REFUSING');
	});
});
