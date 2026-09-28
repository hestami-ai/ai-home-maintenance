// ⭐ `JAN-SELRES` RS-1 (D4) — A MODEL STEP'S EXECUTOR IS SELECTED ONCE, BEFORE DISPATCH, AND THAT ONE SELECTION OPENS
// THE EXECUTOR AND NAMES THE RECORD.
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-selection-residuals.md` §2 G1–G4). The executor's configuration was read in three
// places and none of them before dispatch: an unset or unknown tool, devin (declared for EXECUTION, no adapter) and an
// unset model were all found when the executor OPENED — after `StartExecutionStep` — and recorded as a started-then-
// failed step. And the agy executor ran `JPWB_JUDGE_MODEL` while the record named `JPWB_EXECUTOR_MODEL`, so with agy on
// both sides both calls ran one model while the record showed two (`REG-F-458`).
//
// ⭑ WHAT MUST HOLD (§4.3, §4.4).
//   · Every refusal code reachable here — UNSET, UNKNOWN, UNWIRED, MODEL_UNSET — refuses in SERVER mode with the
//     reviewer ADMITTED (devin with a model, no captured `JPWB_DEVIN_BIN`), so the only refusal is the executor's: the
//     guidance is returned, nothing is dispatched, and the executor is never opened. PROGRAM_OVERRIDDEN needs agy-cli to
//     have CAPTURED `JPWB_AGY_BIN` at load, so it has a file of its own (`begin-execute-program-overridden.test.ts`).
//   · A server-mode TRANSFORMATION step with NOTHING configured succeeds — the control, which can fail: in test mode
//     (the reviewer file's control) the selector answers STAND_IN, so it could not.
//   · The model agy is asked to run is the model recorded (`REG-F-458`) — on EVERY try, a repair turn included — and a
//     stand-in records no configured model.
//   · The REVIEWER is asked first (D4): with both refused, the operator is shown the reviewer's refusal.
//
// ⛔ HERMETIC. Every session the route opens goes through the seams — agy through a capturing `AgyExec` that answers
// with the fixture's envelope (or what a case scripted), Pi through an opener that refuses — devin's reviewer adapter
// refuses too, and PATH finds no program. The server-mode refusals admit devin as the REVIEWER, and on their green path
// nothing is dispatched; a mutant that let one dispatch would reach `devinPrint`, so it is replaced here rather than
// left to PATH alone (`JAN-SELRES` RS-1's verification). Admitted SERVER-mode executors are pinned at SELECTOR level
// (`executor-selection.test.ts`), so no route test can open a real Pi.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/**
 * What the executor seams saw, and what agy answers next. Hoisted, because the `model.js` factory below runs before
 * this file's body. `agyAnswers` is a queue a case may fill: each agy call takes the next, and the fixture's envelope
 * once it is empty.
 */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly file: string; readonly args: readonly string[] }[],
	pi: [] as string[],
	agyAnswers: [] as string[]
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		// ⭑ THE ROUTE'S OWN SELECTION IS OPENED — only the two runnable seams are replaced, never the choice.
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				agyExec: async (file, args) => {
					seam.agy.push({ file, args });
					return {
						stdout:
							seam.agyAnswers.shift() ?? (await actual.deterministicExecutionPrint(args[1] ?? ''))
					};
				},
				openPi: async (_context, modelId) => {
					seam.pi.push(modelId);
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

// ⭑ THE MODE `beginExecute` HANDS BOTH SELECTORS, SWITCHABLE ALONE (`workbench.ts` reads it once, at load).
vi.mock('../workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../workbench.js')>();
	return { ...actual, isTestMode: vi.fn(actual.isTestMode) };
});

// ⛔ devin's REVIEWER ADAPTER REFUSES HERE — see the header: the floor reaches `devinPrint` only through this.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	return {
		...actual,
		devinPrint: vi.fn(async () => {
			throw new Error('hermetic: no route test runs a real devin review');
		})
	};
});

import { getObject, listByType, listPwuTypes, SEED_PWA } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { devinPrint } from '../tools/devin-reviewer.js';
import { getEngine, isTestMode, resetEngine } from '../workbench.js';
import {
	beginExecute,
	eventCount,
	lifecycleOf,
	modelWorkUnit,
	proposeWorkUnit
} from './begin-execute.testing.js';
import { EXECUTOR_GUIDANCE } from './executor-selection.js';
import { getExecutionSession } from './model.js';

/** A work unit of the seeded TRANSFORMATION type (`Architecture Definition`), proposed through the page's action. */
async function transformationWorkUnit(): Promise<string> {
	const architecture = listPwuTypes(getEngine(), SEED_PWA).find(
		(t) => t.state.name === 'Architecture Definition'
	);
	expect(architecture, 'arrangement: the seeded TRANSFORMATION type').toBeDefined();
	return proposeWorkUnit(architecture!.id, 'Arch Work');
}

/** The eight live-backend variables — each case sets only what it names. */
const LIVE_BACKEND_VARIABLES = [
	'JPWB_ASSURANCE_TOOL',
	'JPWB_ASSURANCE_MODEL',
	'JPWB_JUDGE_MODEL',
	'JPWB_EXECUTOR',
	'JPWB_EXECUTOR_MODEL',
	'JPWB_AGENT',
	'JPWB_DEVIN_BIN',
	'JPWB_AGY_BIN'
] as const;

beforeEach(() => {
	resetEngine('reference');
	vi.mocked(getExecutionSession).mockClear();
	vi.mocked(devinPrint).mockClear();
	seam.agy.length = 0;
	seam.pi.length = 0;
	seam.agyAnswers.length = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.mocked(isTestMode).mockReset();
});

/** The server-mode arrangement: the reviewer ADMITTED (devin with a model), so any refusal is the executor's. */
function inServerModeWithTheReviewerAdmitted(): void {
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
	vi.mocked(isTestMode).mockReturnValue(false);
}

describe('⭐ D4 — beginExecute asks the executor selector before it dispatches a MODEL step (server mode)', () => {
	const REFUSED: readonly {
		readonly name: string;
		readonly env: Readonly<Record<string, string>>;
		readonly says: string;
	}[] = [
		{ name: 'EXECUTOR_TOOL_UNSET', env: {}, says: 'JPWB_EXECUTOR is not set' },
		{
			name: 'EXECUTOR_TOOL_UNKNOWN',
			env: { JPWB_EXECUTOR: 'nosuchtool', JPWB_EXECUTOR_MODEL: 'fixture-executor-model' },
			says: "Unknown backing tool 'nosuchtool'"
		},
		{
			name: 'EXECUTOR_TOOL_UNWIRED',
			env: { JPWB_EXECUTOR: 'devin', JPWB_EXECUTOR_MODEL: 'fixture-executor-model' },
			says: "The executing tool 'devin' (JPWB_EXECUTOR) declares the EXECUTION role, but no executor adapter"
		},
		{
			name: 'EXECUTOR_MODEL_UNSET (agy)',
			env: { JPWB_EXECUTOR: 'agy' },
			says: "The executing tool 'agy' has no model: JPWB_EXECUTOR_MODEL is not set"
		},
		{
			name: 'EXECUTOR_MODEL_UNSET (pi)',
			env: { JPWB_EXECUTOR: 'pi' },
			says: "The executing tool 'pi' has no model: JPWB_EXECUTOR_MODEL is not set"
		}
	];
	for (const c of REFUSED)
		it(`⛔ ${c.name}: the guidance is returned, nothing is dispatched, the executor is never opened`, async () => {
			for (const [k, v] of Object.entries(c.env)) vi.stubEnv(k, v);
			const pwuId = await modelWorkUnit();
			const before = eventCount();
			inServerModeWithTheReviewerAdmitted();

			const result = await beginExecute(pwuId);

			expect(
				result.data?.error ?? '',
				'the step was not refused with the executor’s reason'
			).toContain(c.says);
			// ⭑ AND WITH THE GUIDANCE BESIDE IT — both variables, and ASR-13's independence rule.
			expect(result.data?.error).toContain('JPWB_EXECUTOR_MODEL');
			expect(result.data?.error).toContain('ASR-13');
			expect(result.status).toBe(400);
			expect(eventCount(), 'a refused step dispatched something').toBe(before);
			expect(
				vi.mocked(getExecutionSession),
				'the executor was opened for a refused step'
			).not.toHaveBeenCalled();
			expect(seam.agy, 'agy was called for a refused step').toEqual([]);
			expect(seam.pi, 'Pi was opened for a refused step').toEqual([]);
			expect(
				vi.mocked(devinPrint),
				'a refused step reached the devin reviewer'
			).not.toHaveBeenCalled();
			expect(lifecycleOf(pwuId)).toBe('PROPOSED');
		});

	it('⭑ CONTROL — a server-mode TRANSFORMATION step with NOTHING configured succeeds: it asks neither selector', async () => {
		// ⛔ THE MUTANT: ask the executor selector for every step. Only SERVER mode tells the two apart — in test mode an
		// unset executor is the stand-in — so this control is the one that can fail for this guard.
		const pwuId = await transformationWorkUnit();
		vi.mocked(isTestMode).mockReturnValue(false);

		const result = await beginExecute(pwuId);

		expect(result.data?.error, 'a TRANSFORMATION step was refused').toBeUndefined();
		expect(getObject(getEngine(), pwuId)?.executionState).toBe('SUCCEEDED');
		expect(vi.mocked(getExecutionSession)).not.toHaveBeenCalled();
	});
});

describe('⭐ D4 — the REVIEWER is asked first: with both refused, the operator is shown the reviewer’s refusal', () => {
	it('⛔ server mode, devin with no model AND no executor configured → the reviewer’s guidance, not the executor’s; nothing is dispatched', async () => {
		// ⛔ THE MUTANT: ask the executor selector before the reviewer preflight. Every other arrangement here leaves one
		// of the two ADMITTED — the refusals above admit the reviewer, the reviewer file's admit the executor — so only
		// both refused tells the two orders apart (`JAN-SELRES` RS-1's verification, ADV-M1).
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		const pwuId = await modelWorkUnit();
		const before = eventCount();
		vi.mocked(isTestMode).mockReturnValue(false);

		const result = await beginExecute(pwuId);

		expect(
			result.data?.error ?? '',
			'the step was not refused with the REVIEWER’s reason'
		).toContain("'devin' has no model: JPWB_ASSURANCE_MODEL is not set");
		expect(result.data?.error).toContain('REG-D-084');
		expect(result.data?.error, 'the executor was asked first').not.toContain(
			'JPWB_EXECUTOR is not set'
		);
		expect(result.data?.error).not.toContain(EXECUTOR_GUIDANCE);
		expect(result.status).toBe(400);
		expect(eventCount(), 'a refused step dispatched something').toBe(before);
		expect(
			vi.mocked(getExecutionSession),
			'the executor was opened for a refused step'
		).not.toHaveBeenCalled();
		expect(seam.agy).toEqual([]);
		expect(seam.pi).toEqual([]);
		expect(vi.mocked(devinPrint)).not.toHaveBeenCalled();
		expect(lifecycleOf(pwuId)).toBe('PROPOSED');
	});
});

/** A word of the rendered instruction (`Assess {subject}.`), which the first test-mode answer below restates. */
const RESTATED = 'Assess';

/**
 * A COMPLIANT envelope whose work product's only value restates its prompt — the structural checker's `RR-01` fault
 * ("every element restates its own prompt"), which the declared stand-in reports as its own: REJECTED, with a finding
 * that may be sent back to the producer.
 */
const RESTATEMENT = JSON.stringify({
	workProduct: { restated: RESTATED },
	rationale: {
		rationale: 'The instruction asked for an assessment.',
		assumptions: ['The rendered instruction is complete.'],
		limitations: ['This answer restates the instruction.'],
		residualUncertainty: []
	}
});

/** Every EXECUTION-plane exchange the route recorded, oldest first. */
const executionExchanges = () =>
	listByType(getEngine(), 'MODEL_EXCHANGE')
		.map((x) => x.state as Record<string, unknown>)
		.filter((x) => x.plane === 'EXECUTION');

describe('⭐ D2 + D4 — the model agy runs is the model recorded, from one selection (REG-F-458)', () => {
	it('⛔ agy executing with JPWB_EXECUTOR_MODEL=x and JPWB_JUDGE_MODEL=y: argv carries x, never y, and the record names x, HOST_CONFIGURED', async () => {
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-x');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-y');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		// ⚠ THE FLOOR MAY STILL REFUSE THE WORK PRODUCT — the declared stand-in reviewer judges only what its checker can —
		// and that is not this test's question. The MODEL RAN is.
		expect(result.data?.error ?? 'The model ran', 'the agy step did not run').toMatch(
			/^The model ran/
		);
		expect(seam.agy.length, 'agy was never called').toBeGreaterThan(0);
		for (const { args } of seam.agy) {
			expect(args[args.indexOf('--model') + 1], 'the model agy was asked to run').toBe(
				'fixture-executor-x'
			);
			expect(args, 'the judge model reached the executor’s argv').not.toContain('fixture-judge-y');
		}
		const exchanges = executionExchanges();
		expect(exchanges.length, 'no EXECUTION exchange was recorded').toBeGreaterThan(0);
		for (const x of exchanges) {
			expect(x.resolvedModel).toMatchObject({
				value: 'fixture-executor-x',
				evidence: 'HOST_CONFIGURED'
			});
			expect(x.resolvedProvider).toMatchObject({ value: 'agy', evidence: 'HOST_CONFIGURED' });
		}
	});

	it('⛔ and on a REPAIR turn too: the second agy call runs x, and both tries’ EXECUTION records name x', async () => {
		// ⭑ ONE SELECTION, EVERY TRY. The model is read once, before dispatch, and the session and the record's fallback
		// identity both come from it — so a per-try re-read would show only on a turn after the first, which no other
		// case here reaches. The first answer's only value restates its prompt: the stand-in reports the structural
		// checker's own RR-01 fault (REJECTED), that finding is sent back to the producer, and agy runs a second time.
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-x');
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge-y');
		seam.agyAnswers.push(RESTATEMENT);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? 'The model ran', 'the agy step did not run').toMatch(
			/^The model ran/
		);
		expect(seam.agy.length, 'no repair turn ran — no finding was sent back').toBe(2);
		expect(seam.agy[0]!.args[1], 'arrangement: the first answer restates its own prompt').toContain(
			RESTATED
		);
		expect(seam.agy[1]!.args[1], 'the second turn is the REPAIR, carrying the finding').toContain(
			'RR-01-no-problem-substitution'
		);
		for (const { args } of seam.agy) {
			expect(args[args.indexOf('--model') + 1], 'the model agy was asked to run').toBe(
				'fixture-executor-x'
			);
			expect(args, 'the judge model reached the executor’s argv').not.toContain('fixture-judge-y');
		}
		const exchanges = executionExchanges();
		expect(exchanges.length, 'one EXECUTION exchange per try').toBe(2);
		for (const x of exchanges) {
			expect(x.resolvedModel).toMatchObject({
				value: 'fixture-executor-x',
				evidence: 'HOST_CONFIGURED'
			});
			expect(x.resolvedProvider).toMatchObject({ value: 'agy', evidence: 'HOST_CONFIGURED' });
		}
	});

	it('⛔ the STAND-IN records no configured model — a stray JPWB_EXECUTOR_MODEL names nothing that ran', async () => {
		// ⭑ THE MUTANT: read the record's model from the environment again (`resolveExecutorModel()`). With no tool named,
		// test mode answers the fixture, so a model variable left set would be recorded as the producer of work the
		// fixture produced — the fiction `REG-D-052` forbids, one field over.
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'stray-executor-model');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(result.data?.error ?? 'The model ran', 'the stand-in step did not run').toMatch(
			/^The model ran/
		);
		expect(seam.agy).toEqual([]);
		const exchanges = executionExchanges();
		expect(exchanges.length, 'no EXECUTION exchange was recorded').toBeGreaterThan(0);
		for (const x of exchanges) {
			expect(x.resolvedModel).toMatchObject({ value: 'unresolved', evidence: 'HOST_CONFIGURED' });
			expect(x.resolvedProvider).toMatchObject({
				value: 'unresolved',
				evidence: 'HOST_CONFIGURED'
			});
		}
	});
});
