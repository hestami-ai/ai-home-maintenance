// ⭐ `JAN-SELRES` RS-3 (`REG-F-469`) — THE EXECUTION PLANE COUNTS THE TRIES THAT RAN.
//
// ⛔ WHAT WAS WRONG. The loop in `routes/undertakings/[id]/+page.server.ts` pushes each unsatisfied try's open-finding
// count onto `openPerTry` BEFORE it decides whether to stop, and the failure message then printed
// `reviewed over ${openPerTry.length + 1} …`. On that path every try has already been pushed, so the count was one too
// high on every run: a single review read "2 tries" (`begin-execute-substituted-reviewer.test.ts` saw it and reported
// it). A try is a billed call, and this is `REG-F-460`'s general form — an operator surface beside a failed review that
// misstates what happened.
//
// ⭑ WHAT MUST HOLD. The message counts the tries that RAN — `openPerTry.length`, singular for one — and the count is
// held against an INDEPENDENT one: every try records its own EXECUTION exchange (`PER-9`), so the number of those is
// the number of tries, whatever the message says.
//
// ⛔ HERMETIC, on `begin-execute-executor-selection.test.ts`'s arrangement: agy through a capturing ~~`AgyExec`~~ ⭐
// `openCli` (`JAN-MHX` MH-5: agy executes as a CLI) that answers with the fixture's envelope or what a case scripted —
// a one-shot session, not agy's real one, which passes no turn until agy's record can prove its tool surface
// (`tools/agy-executor-driver.ts`) — Pi through an opener that refuses, devin's reviewer adapter
// refusing, and PATH finding no program. Test mode, and no reviewer named, so the declared stand-in reviews.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the executor seams saw, and what agy answers next — the RS-1 queue: each ~~call~~ ⭐ turn takes the next, then the
 *  fixture. `trend` scripts the loop's trend for the one case that must run to the repair bound; unset, the real one
 *  answers. ⭐ `JAN-MHX` MH-5 — `agy` holds the text of each turn agy's CLI executor was given. */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly text: string }[],
	pi: [] as string[],
	agyAnswers: [] as string[],
	trend: undefined as 'CONVERGING' | undefined
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	const { oneShotSession } = await import('./producer-session.js');
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) =>
			actual.getExecutionSession(selection, {
				openCli: async () =>
					oneShotSession(async (text: string) => {
						seam.agy.push({ text });
						return seam.agyAnswers.shift() ?? (await actual.deterministicExecutionPrint(text));
					}),
				openPi: async (_context, modelId) => {
					seam.pi.push(modelId);
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			})
		)
	};
});

// ⛔ devin's REVIEWER ADAPTER REFUSES HERE: nothing below names devin, so a green case never reaches it, and a mutation
// that did would fail on this throw rather than on a program PATH happened not to hold.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	return {
		...actual,
		devinPrint: vi.fn(async () => {
			throw new Error('hermetic: no route test runs a real devin review');
		})
	};
});

// ⭑ THE TREND, SCRIPTED ONLY WHERE A CASE SAYS SO (the RS-3 verifier's bound probe). Three identical restatements read
// STALLED after two tries, so the loop would stop short of `DEFAULT_REPAIR_BOUND`; the bound case scripts CONVERGING to
// reach it. Every other case is classified by the real function.
vi.mock('./loop-detection.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./loop-detection.js')>();
	return {
		...actual,
		classifyTrend: vi.fn(
			(openFindingsPerTry: readonly number[]) =>
				seam.trend ?? actual.classifyTrend(openFindingsPerTry)
		)
	};
});

import { listByType } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { devinPrint } from '../tools/devin-reviewer.js';
import { getEngine, resetEngine } from '../workbench.js';
import { beginExecute, modelWorkUnit } from './begin-execute.testing.js';
import { DEFAULT_REPAIR_BOUND } from './loop-detection.js';

/** D8's live-backend variables — each case sets only what it names. */
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
	vi.mocked(devinPrint).mockClear();
	seam.agy.length = 0;
	seam.pi.length = 0;
	seam.agyAnswers.length = 0;
	seam.trend = undefined;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
});
afterEach(() => {
	vi.unstubAllEnvs();
});

/** `REG-D-090`'s sentence for the execution plane, verbatim (`JAN-ESCREC` design D3) — printed beside an ESCALATED review
 *  only. Restated, not imported: it is the operator's word, so a change to it must redden here rather than be followed. */
const HUMAN_SENTENCE =
	"The reviewer recommended escalation to a human reviewer; this workbench cannot record a human's review yet (REG-F-474).";

/** The number of tries that RAN, counted apart from the message: one EXECUTION exchange per try (`PER-9`). */
const triesRecorded = (): number =>
	listByType(getEngine(), 'MODEL_EXCHANGE').filter(
		(x) => (x.state as Record<string, unknown>).plane === 'EXECUTION'
	).length;

/**
 * A COMPLIANT envelope whose work product's only value restates its prompt (`Assess {subject}.`) — the structural
 * checker's `RR-01` fault, which the declared stand-in reports as REJECTED with a finding that may be sent back, so the
 * producer is asked for a REPAIR. RS-1's arrangement (`begin-execute-executor-selection.test.ts`).
 */
const RESTATEMENT = JSON.stringify({
	workProduct: { restated: 'Assess' },
	rationale: {
		rationale: 'The instruction asked for an assessment.',
		assumptions: ['The rendered instruction is complete.'],
		limitations: ['This answer restates the instruction.'],
		residualUncertainty: []
	}
});

describe('⭐ REG-F-469 — "reviewed over N tries" counts the tries that ran', () => {
	it('⛔ ONE review runs (the stand-in executor, nothing sent back) → "reviewed over 1 try", never "2 tries"', async () => {
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(triesRecorded(), 'arrangement: exactly one try ran').toBe(1);
		expect(message, 'the message miscounted the one try that ran').toContain(
			'its work product was reviewed over 1 try, and the assurance floor is NOT satisfied'
		);
		// ⭐ `JAN-ESCREC` D3 (`REG-D-090`; the ER-1 app verifier's finding [2]) — A REVIEW THAT REACHED NO VERDICT IS NOT AN
		// ESCALATION. The stand-in's review is incomplete — the commonest refusal in this lane — and the classifier answers it
		// RETRY_OR_CONFIGURE_REVIEWER; the human-review sentence is keyed on ESCALATE_REVIEW alone, so it is not printed.
		expect(message, 'arrangement: the review was not answered as incomplete').toContain(
			'(RETRY_OR_CONFIGURE_REVIEWER)'
		);
		expect(
			message,
			'an incomplete review was told as an escalation to a human reviewer'
		).not.toContain(HUMAN_SENTENCE);
		expect(seam.agy, 'arrangement: the stand-in executor called no agy').toEqual([]);
		expect(vi.mocked(devinPrint), 'arrangement: no devin review').not.toHaveBeenCalled();
	});

	it('⛔ a REPAIR turn runs (agy, RR-01 sent back once) → "reviewed over 2 tries", never "3 tries"', async () => {
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-x');
		seam.agyAnswers.push(RESTATEMENT);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(seam.agy.length, 'arrangement: no repair turn ran — no finding was sent back').toBe(2);
		expect(seam.agy[1]!.text, 'arrangement: the second turn is the REPAIR').toContain(
			'RR-01-no-problem-substitution'
		);
		expect(triesRecorded(), 'arrangement: one EXECUTION exchange per try').toBe(2);
		expect(message, 'the message miscounted the two tries that ran').toContain(
			'its work product was reviewed over 2 tries, and the assurance floor is NOT satisfied'
		);
		expect(seam.pi, 'arrangement: agy executing opened no Pi').toEqual([]);
		expect(vi.mocked(devinPrint), 'arrangement: no devin review').not.toHaveBeenCalled();
	});

	it('⛔ the loop runs to the REPAIR BOUND (agy, RR-01 sent back twice, the trend CONVERGING) → "reviewed over 3 tries", as the bound itself says', async () => {
		// ⭑ AT THE BOUND the count meets two other statements of it in the same message — the bound's own reason and the
		// trend line — and all three must agree with the EXECUTION exchanges recorded.
		expect(DEFAULT_REPAIR_BOUND, 'arrangement: the bound this case runs to').toBe(3);
		vi.stubEnv('JPWB_EXECUTOR', 'agy');
		vi.stubEnv('JPWB_EXECUTOR_MODEL', 'fixture-executor-x');
		seam.trend = 'CONVERGING';
		seam.agyAnswers.push(RESTATEMENT, RESTATEMENT, RESTATEMENT);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(seam.agy.length, 'arrangement: the loop stopped short of the bound').toBe(3);
		expect(triesRecorded(), 'arrangement: one EXECUTION exchange per try').toBe(3);
		expect(message, 'the message miscounted the three tries that ran').toContain(
			'its work product was reviewed over 3 tries, and the assurance floor is NOT satisfied'
		);
		expect(message, 'arrangement: the loop did not stop at the bound').toContain(
			'The repair bound of 3 tries is reached'
		);
		expect(message, 'arrangement: the trend line counts the same tries').toContain(
			'Trend after 3 tries: CONVERGING.'
		);
		expect(seam.pi, 'arrangement: agy executing opened no Pi').toEqual([]);
		expect(vi.mocked(devinPrint), 'arrangement: no devin review').not.toHaveBeenCalled();
	});
});
