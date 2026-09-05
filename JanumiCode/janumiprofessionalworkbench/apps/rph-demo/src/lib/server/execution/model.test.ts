// JAN-TOOLSUITE TS-02/TS-03 — which tool executes a work unit.
//
// ⚠ THIS FILE EXISTS BECAUSE ITS ABSENCE MADE A GREEN GATE MEANINGLESS. `getExecutionPrint` had NO test, so
// wiring the backing-tool suite into it left 235 tests passing while nothing exercised the new branch at all.
// A suite that cannot redden for a change is not evidence about that change.
import { afterEach, describe, expect, it } from 'vitest';
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
		const parsed = JSON.parse(answer) as { workProduct?: string; basis?: string };
		expect(parsed.workProduct).toBeTruthy();
		// It echoes a fragment of the prompt, so a test can prove the model SAW the rendered template.
		expect(parsed.basis).toContain('Assess the northern route');
	});
});
