// JAN-TOOLSUITE TS-02/TS-03 — which tool executes a work unit.
//
// ⚠ THIS FILE EXISTS BECAUSE ITS ABSENCE MADE A GREEN GATE MEANINGLESS. `getExecutionPrint` had NO test, so
// wiring the backing-tool suite into it left 235 tests passing while nothing exercised the new branch at all.
// A suite that cannot redden for a change is not evidence about that change.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deterministicExecutionPrint, getExecutionPrint } from './model.js';

const SAVED = process.env.JPWB_EXECUTOR;

afterEach(() => {
	if (SAVED === undefined) delete process.env.JPWB_EXECUTOR;
	else process.env.JPWB_EXECUTOR = SAVED;
});

describe('JAN-TOOLSUITE — the execution producer names its OWN tool', () => {
	it('⛔ REFUSES when JPWB_EXECUTOR is unset, instead of defaulting to the assurance tool', () => {
		// ⭑⭑ THE MUTANT THIS EXISTS FOR: `return (prompt) => agyPrint(prompt)` as a fallback. That is exactly the
		// state this slice removed — the producing tool silently becoming the REVIEWING tool, so producer and
		// reviewer were identical by construction and DIFFERENT_MODEL could only refuse (REG-F-356).
		//
		// ⚠ Note the mutant is INVISIBLE without this assertion: every other test in the app still passes with the
		// fallback in place, which is precisely how the collision arrived the first time.
		delete process.env.JPWB_EXECUTOR;
		expect(() => getExecutionPrint()).toThrow(/JPWB_EXECUTOR is not set/);
	});

	it('⛔ REFUSES an unknown tool rather than substituting one that exists', () => {
		process.env.JPWB_EXECUTOR = 'nosuchtool';
		expect(() => getExecutionPrint()).toThrow(/Unknown backing tool 'nosuchtool'/);
	});

	it('⭑ selects a REAL backing tool, and it is not the deterministic fixture', () => {
		// THE MUTANT: return `deterministicExecutionPrint` outside test mode. The demo would then look like it ran
		// a model while every answer was a canned echo — the rubber stamp, one layer down from assurance.
		process.env.JPWB_EXECUTOR = 'agy';
		const print = getExecutionPrint();
		expect(typeof print).toBe('function');
		expect(print).not.toBe(deterministicExecutionPrint);
	});

	it('⭑ selecting pi does NOT spawn or import Pi until the call is actually made', () => {
		// ⚠ The Pi adapter is dynamic-imported INSIDE the returned function on purpose: selecting a tool must be
		// free, or the gate pulls Pi's heavy Node deps on every import of this module.
		// THE MUTANT: a top-level `import { piExecute }`. This test still passes, but the whole suite slows and
		// the mock path loads Pi — so the assertion below is about the SEAM, and the docblock is the warrant.
		process.env.JPWB_EXECUTOR = 'pi';
		const print = getExecutionPrint();
		expect(typeof print).toBe('function');
		expect(print).not.toBe(deterministicExecutionPrint);
	});

	it('⭑ CONTROL — the deterministic fixture still answers in the DELIMITED shape retention requires', async () => {
		// Without this control the refusals above are satisfiable by "everything throws". And the shape matters:
		// `REG-F-351` records that the §9.7 split locates a JSON object, so an UNDELIMITED prose answer is
		// blocked from retention and a step's work product is never kept.
		const answer = await deterministicExecutionPrint('Assess the northern route against the safety rubric.');
		const parsed = JSON.parse(answer) as {
			workProduct?: { finding?: string; basis?: string };
			rationale?: { rationale?: string };
		};
		expect(parsed.workProduct?.finding).toBeTruthy();
		// It echoes a fragment of the prompt, so a test can prove the model SAW the rendered template.
		expect(parsed.workProduct?.basis).toContain('Assess the northern route');
		// ⭑ AND IT MODELS A COMPLIANT ANSWER (`JAN-EXECRAT`). A fixture that omitted the rationale would take the
		// shortfall branch on every gate run, so the compliant path would be exercised by nothing.
		expect(parsed.rationale?.rationale, 'the fixture must honour the execution contract').toBeTruthy();
	});
});

describe('JAN-LIVEEXEC LE-01 — the executor no longer borrows the ASSURANCE switch', () => {
	// ⚠ `TEST_MODE` IS READ AT MODULE LOAD, so these cases need a fresh module with the env already set.
	// Without the reset the branch below is simply unreachable and the tests would assert nothing while
	// showing green — the hollow-green shape this file's header already records.
	// ⚠ THE ENV MUST STILL BE SET WHEN THE ASSERTION RUNS, and my first version restored it in a `finally`
	// before the caller ever called `getExecutionPrint()` — which reads the environment at CALL time, not at
	// import time. The helper was wrong and the code was right; it now runs the assertion INSIDE the window.
	async function inTestModeWith(
		env: Record<string, string | undefined>,
		assertion: (m: typeof import('./model.js')) => void
	) {
		vi.resetModules();
		const saved = { ...process.env };
		process.env.RPH_DEMO_MODE = 'test';
		for (const [k, v] of Object.entries(env)) {
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		}
		try {
			assertion(await import('./model.js?le01=' + Math.random().toString(36).slice(2)));
		} finally {
			process.env = saved;
		}
	}

	it('⭑ CONTROL — in test mode with NOTHING configured, the deterministic fixture is returned', async () => {
		// ⛔ THE MOST IMPORTANT ASSERTION IN THIS FILE. If this regresses, every gate run starts spawning real
		// model calls: slow, billed, non-deterministic, and network-dependent.
		await inTestModeWith({ JPWB_EXECUTOR: undefined, JPWB_ASSESSOR: undefined }, (m) => {
			expect(m.getExecutionPrint()).toBe(m.deterministicExecutionPrint);
		});
	});

	it('⭑ configuring the EXECUTOR selects a real tool — with the ASSURANCE switch unset entirely', async () => {
		// ⭑⭑ THIS IS THE DEFECT LE-01 REMOVED. Running the executor live used to require setting the ASSURANCE
		// variable to the literal string 'agy' — while also naming Devin as the assurance tool, a configuration
		// that reads as a contradiction. THE MUTANT: restore `JPWB_ASSESSOR !== 'agy'`; this reddens because
		// JPWB_ASSESSOR is not set at all here.
		await inTestModeWith({ JPWB_EXECUTOR: 'agy', JPWB_ASSESSOR: undefined }, (m) => {
			expect(m.getExecutionPrint()).not.toBe(m.deterministicExecutionPrint);
		});
	});

	it('⛔ and the ASSURANCE switch alone NO LONGER makes the executor live', async () => {
		// The converse mutant: keep reading JPWB_ASSESSOR. Without this, "reads the new variable" cannot be told
		// apart from "reads both", and the borrowed switch survives in a form nothing detects.
		await inTestModeWith({ JPWB_EXECUTOR: undefined, JPWB_ASSESSOR: 'agy' }, (m) => {
			expect(m.getExecutionPrint()).toBe(m.deterministicExecutionPrint);
		});
	});
});
