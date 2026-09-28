// ⭐ `JAN-SELRES` RS-1 (D3) — OUTSIDE TEST MODE THE AGY EXECUTOR'S PROGRAM IS NOT REPLACED (`REG-F-459`).
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-selection-residuals.md` §2 G5). `agy-cli.ts` captures `JPWB_AGY_BIN` when it loads and
// runs what it names for the life of the process. `JAN-SELREV` D7 refused that for an agy REVIEW outside test mode, and
// nothing refused it for the agy EXECUTOR: its work was recorded as agy's, whatever the replacement was.
//
// ⭑ WHY A FILE OF ITS OWN. The override the selector refuses is the one the adapter CAPTURED, so this process must have
// `JPWB_AGY_BIN` set BEFORE `agy-cli.ts` loads — `vi.hoisted` does that, ahead of every import — and every other test
// file must not.
//
// ⭑ THE REVIEWER, PER MODE. Outside test mode it is devin with a model — ADMITTED, and untouched by that override — so
// the only refusal is the executor's, and nothing is dispatched. In test mode the step DOES dispatch, so its floor runs
// a review: that case unsets the assurance variables, and the review is the declared STAND-IN's, never a real one.
//
// ⛔ HERMETIC. The override names a program in a directory that does not exist, PATH finds no program, every session
// the route opens goes through the agy exec seam, which records what it was handed and starts nothing — and devin's
// adapter is replaced by one that refuses, asserted never called. ⚠ CORRECTED (`JAN-SELRES` RS-1's verification): this
// said "the only refusal is the executor's" and "every session the route opens goes through the agy exec seam", while
// the test-mode case kept devin as its reviewer — so its floor ran the REAL `devinPrint` through the real `execFile`,
// stopped by nothing but PATH ("spawn devin ENOENT").
import { vi } from 'vitest';

const STAND_IN_PROGRAM = 'C:/no-such-directory/agy-stand-in.exe';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
	// ⚠ RESTATED, NOT THE CONSTANT ABOVE: `vi.hoisted` runs before this file's declarations exist.
	process.env.JPWB_AGY_BIN = 'C:/no-such-directory/agy-stand-in.exe';
});

/** What the agy exec seam was handed. Hoisted, because the `model.js` factory below runs before this file's body. */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly file: string; readonly args: readonly string[] }[]
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async (file, args) => {
					seam.agy.push({ file, args });
					return { stdout: await actual.deterministicExecutionPrint(args[1] ?? '') };
				},
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return { ...actual, isTestMode: vi.fn(actual.isTestMode) };
});

// ⛔ devin's ADAPTER REFUSES HERE, so no case — and no mutant that lets the refused step dispatch — can start a real
// devin review: the floor reaches `devinPrint` only through this, and every case asserts it was never called.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	return {
		...actual,
		devinPrint: vi.fn(async () => {
			throw new Error('hermetic: no route test runs a real devin review');
		})
	};
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AGY_BIN_OVERRIDE } from '../assurance/agy-cli.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { devinPrint } from '../tools/devin-reviewer.js';
import { isTestMode, resetEngine } from '../workbench.js';
import { beginExecute, eventCount, lifecycleOf, modelWorkUnit } from './begin-execute.testing.js';
import { getExecutionSession } from './model.js';

beforeEach(() => {
	resetEngine('reference');
	vi.mocked(getExecutionSession).mockClear();
	vi.mocked(devinPrint).mockClear();
	seam.agy.length = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	// ⭑ THE REVIEWER ADMITTED IN SERVER MODE: devin with a model, and no `JPWB_DEVIN_BIN` captured. (The test-mode case
	// unsets both: its step dispatches, and its review must be the stand-in's.)
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
	vi.stubEnv('JPWB_EXECUTOR', 'agy');
	vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-model');
	// ⭑ SET, SO NOTHING ELSE CAN REFUSE THE STEP: the refusal below is the program's alone, and the judge model must
	// still never reach the executor.
	vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(isTestMode).mockReset();
});

describe('⭐ D3 — an agy executor whose program was replaced is refused outside test mode, before dispatch', () => {
	it('⭑ arrangement — agy-cli.ts CAPTURED the override when it loaded', () => {
		expect(AGY_BIN_OVERRIDE).toBe(STAND_IN_PROGRAM);
	});

	it('⛔ EXECUTOR_PROGRAM_OVERRIDDEN: the guidance is returned, nothing is dispatched, the executor is never opened', async () => {
		const pwuId = await modelWorkUnit();
		const before = eventCount();
		vi.mocked(isTestMode).mockReturnValue(false);

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? '', 'the step was not refused for its replaced program').toContain(
			`The executing tool 'agy' would run a replaced program: JPWB_AGY_BIN=${JSON.stringify(STAND_IN_PROGRAM)}`
		);
		expect(result.data?.error).toContain('ASR-13');
		expect(result.status).toBe(400);
		expect(eventCount(), 'a refused step dispatched something').toBe(before);
		expect(
			vi.mocked(getExecutionSession),
			'the executor was opened for a refused step'
		).not.toHaveBeenCalled();
		expect(seam.agy, 'the replaced program was handed to the exec seam').toEqual([]);
		expect(
			vi.mocked(devinPrint),
			'a refused step reached the devin reviewer'
		).not.toHaveBeenCalled();
		expect(lifecycleOf(pwuId)).toBe('PROPOSED');
	});

	it('⭑ in TEST mode the same override is HONOURED — the program it names is the one handed to the seam', async () => {
		// ⛔ THE MUTANT: refuse the override in test mode too. Test mode is where an override is the tests' own — the
		// harness's argv assertion and this file both rely on it being run, not refused.
		// ⛔ THIS STEP DISPATCHES, SO ITS FLOOR RUNS A REVIEW: with the assurance variables unset, test mode answers the
		// declared stand-in — no reviewer adapter is reached, and the mocked `devinPrint` proves it.
		vi.stubEnv('JPWB_ASSURANCE_TOOL', undefined);
		vi.stubEnv('JPWB_ASSURANCE_MODEL', undefined);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? 'The model ran', 'the test-mode agy step did not run').toMatch(
			/^The model ran/
		);
		expect(seam.agy.length, 'agy was never called').toBeGreaterThan(0);
		expect(seam.agy.map((c) => c.file)).toEqual(seam.agy.map(() => STAND_IN_PROGRAM));
		for (const { args } of seam.agy)
			expect(args[args.indexOf('--model') + 1]).toBe('fixture-executor-model');
		expect(
			vi.mocked(devinPrint),
			'the dispatched step was reviewed by devin'
		).not.toHaveBeenCalled();
	});
});
