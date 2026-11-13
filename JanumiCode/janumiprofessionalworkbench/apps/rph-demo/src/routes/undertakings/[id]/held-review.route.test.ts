// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L13 — design D68 (`REG-D-157`; `REG-F-630`; `REG-D-059`; the lead's decision (c)) — ON THE EXECUTION
// PLANE: A UNIT WHOSE REVIEW THE FLOOR HOLDS INCONCLUSIVE FOR A FAILED CHECK GETS ANOTHER TRY, THE CHECK AMONG THE EXECUTOR'S FINDINGS;
// AND A UNIT STOPPED SO IS OFFERED WHAT A REVIEW THAT CONCLUDED AGAINST THE WORK IS OFFERED.
//
// ⛔ WHAT WAS WRONG. The work-product floor asks the authoring plane's classifier (`floor-over-subject.ts`, *"THE SAME CLASSIFIER, NOT A
// SECOND ONE"*), and the classifier sent no INCONCLUSIVE review's observation back: a unit whose reviewer passed its work with one
// check failed — held INCONCLUSIVE by the floor, not the reviewer — ended its loop after one try, its check never given to its
// executor, and the person was offered a re-review of a review that had named a problem. The sponsor: *"Units too"* (`REG-D-157`).
// ⭑ WHAT MUST HOLD. Such a review is answered as a REJECTED one is (`REFINE_SUBJECT`): another try within the unit's bound, the
// executor's repair turn listing the check; and once stopped, the recovery a concluded refusal has — re-run the work with the
// findings, or abandon; no re-review (`REG-D-105` (3)). A review that could not tell — a check left unanswered — still sends nothing
// back and is offered as today.
//
// ⭑ THE ARRANGEMENT is `stopped-unit-recovery.route.test.ts`'s, restated because a route test's mocks are its own file's (those of
// its mocks no case here needs are left out): test mode; the executor unconfigured, so the selector answers the declared STAND-IN,
// whose session is the real one, observed (every turn, with the session it went to); the reviewer devin, NAMED with a model, its real
// `devinPrint` handed an exec seam that answers as the case scripts. The decision model is the product's double, which asks no model.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; the stand-in opens no program; no process is started; PATH finds none.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	/** Every call of the devin program, in order. */
	devin: [] as { readonly file: string; readonly args: readonly string[] }[],
	/** What devin's program answers on call N (1-based). */
	script: [] as string[],
	/** What devin answers once the script runs out. */
	answer: '',
	/** Every turn the producer was sent, in order, each with the session it was sent on (1-based). */
	turns: [] as { readonly session: number; readonly text: string }[],
	/** How many producer sessions were opened. */
	sessions: 0
}));

vi.mock('../../../lib/server/execution/model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../lib/server/execution/model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) => {
			const open = actual.getExecutionSession(selection, {
				agyExec: async (_file, args) => ({
					stdout: await actual.deterministicExecutionPrint(args[1] ?? '')
				}),
				openPi: async () => {
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			});
			// ⭑ THE REAL SESSION, OBSERVED: each opening counted, and every turn recorded with the session it went to.
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				const n = ++seam.sessions;
				return {
					...session,
					turn: (text: string) => {
						seam.turns.push({ session: n, text });
						return session.turn(text);
					}
				};
			};
		})
	};
});

vi.mock('../../../lib/server/tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../lib/server/tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.devin.push({ file, args: [...args] });
				const step = seam.script[seam.devin.length - 1];
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				return { stdout: step ?? seam.answer };
			})
		)
	};
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 (`REG-D-146`): the product's configured decision model, stood in for by a double that calls
// no model, as the reviewer's program is (`stopped-unit-recovery.route.test.ts`).
vi.mock('../../../lib/server/assurance/decision-model.js', async (importOriginal) => {
	const { TEST_INDICATIONS } = await import('../../../lib/server/assurance/indications.testing.js');
	return { ...(await importOriginal<typeof import('../../../lib/server/assurance/decision-model.js')>()), configuredIndications: () => TEST_INDICATIONS };
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { getObject, listByType } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../../../lib/server/assurance/no-programs.testing.js';
import { actionEvent, beginExecute, modelWorkUnit } from '../../../lib/server/execution/begin-execute.testing.js';
import {
	RERUN_WORK_AFTER_CONCLUDED_CITATION,
	RERUN_WORK_AFTER_NOT_CONCLUDED_CITATION
} from '../../../lib/server/execution/recovery-authority.js';
import { getEngine, resetEngine } from '../../../lib/server/workbench.js';
import { actions, load } from './+page.server.js';

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

/** The check the held reply fails: the sixth run's, `RR-07`. */
const HELD_CHECK = 'RR-07-no-contradiction';
const HELD_FAULT = 'The work product says every input is validated, and its own handler accepts an empty file unchecked.';
/** devin's reply failing `HELD_CHECK` at the reviewer's own severity ADVISORY and recommending SATISFIED, the rest unfailed: the floor
 *  holds the review INCONCLUSIVE, the check beside it at the policy's BLOCKING. */
const HELD = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) =>
		c.id === HELD_CHECK
			? { criterionId: c.id, failed: true, statement: HELD_FAULT, severity: 'ADVISORY' }
			: { criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' }
	),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});
/** A review that passes. */
const CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});
/** A reply answering every check but the LAST, unfailed: a review that could not tell — INCONCLUSIVE, nothing failed. ⭑ Its one
 *  criterion repair (package L, D13) is answered the same way, so the review stays INCONCLUSIVE. */
const SKIPPED = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.slice(0, -1).map((c) => ({ criterionId: c.id, failed: false, statement: 'evaluated; the failure class is absent' })),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

type Result = { readonly advanced?: string; readonly data?: { readonly error?: string } };
const act = async (action: 'rerunWork', fields: Readonly<Record<string, string>>): Promise<Result> =>
	(await actions[action](actionEvent(action, fields) as never)) as Result;

/** The reasoning reviews over the unit's work products, in the order recorded. */
const reviewStates = (pwuId: string): string[] => {
	const products = new Set(
		listByType(getEngine(), 'ARTIFACT')
			.filter((a) => a.state.producingPwuId === pwuId)
			.map((a) => a.id)
	);
	return listByType(getEngine(), 'ASSURANCE_ASSESSMENT')
		.filter(
			(a) =>
				a.state.assurancePolicyId === 'floor.reasoning-review' &&
				(a.state.subjectObjectIds as readonly string[]).some((s) => products.has(s))
		)
		.map((a) => String(a.state.assessmentState));
};

/** The REPLAN Decisions naming the unit. */
const decisionsOf = (pwuId: string) =>
	listByType(getEngine(), 'DECISION').filter((d) => (d.state.subjectObjectIds as readonly string[]).includes(pwuId));

/** The page's recovery view of the unit, as `load` returns it. */
async function recoveryShown(pwuId: string) {
	const undertakingId = String((getObject(getEngine(), pwuId) as Record<string, unknown>).undertakingId);
	const data = (await load({ params: { id: undertakingId } } as never)) as unknown as {
		readonly recoveryByPwu: Readonly<
			Record<
				string,
				{
					readonly kind: string;
					readonly offers: Record<string, boolean>;
					readonly findings: number;
				}
			>
		>;
	};
	return data.recoveryByPwu[pwuId];
}

// ⚠ Each case drives Begin & Execute, floors and all, and some a recovery act after it: under the full suite's load that outlasts
// vitest's default 5 s, as `stopped-unit-recovery.route.test.ts`'s cases do.
vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
	resetEngine('reference');
	seam.devin.length = 0;
	seam.script.length = 0;
	seam.answer = CLEAN;
	seam.turns.length = 0;
	seam.sessions = 0;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe('⭐⭐ L13 — D68, on the execution plane: a unit’s review held INCONCLUSIVE for a failed check is answered as a rejected one', () => {
	// ⛔ PREDICTED RED, read from the code at 230574f3: the work-product floor's remediation is RETRY_OR_CONFIGURE_REVIEWER with autoRefine
	// false, so the loop ends after one try — no repair turn — and the completion is refused, the unit left waiting.
	it('⭐ RED — another try: the executor’s repair turn lists the check, the second try’s review passes, and the step completes', async () => {
		seam.script.push(HELD);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);

		expect(seam.turns.length, 'the unit was given no further try').toBe(2);
		expect(seam.turns[1]?.text, 'the executor’s repair turn does not list the check').toContain(`- ${HELD_CHECK}: ${HELD_FAULT}`);
		expect(reviewStates(pwuId).sort(), 'arrangement: one try’s review held INCONCLUSIVE, the other’s passed').toEqual([
			'INCONCLUSIVE',
			'SATISFIED'
		]);
		expect(result, `the step did not complete: ${result.data?.error ?? ''}`).toEqual({ advanced: 'executed' });
	});

	// ⛔ PREDICTED RED, read from the code at 230574f3: one try, then the stop is NOT_CONCLUDED's — a re-review offered, no finding to
	// carry; and the re-run of the work carries nothing, citing REG-D-104 (1) alone.
	it('⭐ RED — a unit stopped so is offered what a concluded refusal is: re-run the work with the check, or abandon; no re-review — and the re-run carries the check', async () => {
		seam.answer = HELD;
		const pwuId = await modelWorkUnit();

		const stopped = await beginExecute(pwuId);

		expect(stopped.data?.error ?? '', 'arrangement: the floor did not refuse the completion').toMatch(/the assurance floor is NOT satisfied/);
		expect(await recoveryShown(pwuId), 'the stop is not offered what a concluded refusal is').toMatchObject({
			kind: 'CONCLUDED',
			offers: { rerunReview: false, rerunWork: true, abandon: true },
			findings: 1
		});
		const instruction = seam.turns[0]!.text;
		const sessions = seam.sessions;
		seam.answer = CLEAN;
		expect(await act('rerunWork', { pwuId, rationale: 'Address the failed check.' })).toEqual({ advanced: 'work-rerun' });
		const first = seam.turns.find((t) => t.session === sessions + 1)!.text;
		expect(first.startsWith(instruction), 'arrangement: the fresh session’s first turn does not open with the instruction').toBe(true);
		expect(first, 'the re-run of the work does not carry the check').toContain(`- ${HELD_CHECK}: ${HELD_FAULT}`);
		expect(String(decisionsOf(pwuId)[0]?.state.rationale)).toBe(`Address the failed check.\n\n${RERUN_WORK_AFTER_CONCLUDED_CITATION}`);
	});
});

describe('⭑ L13 — D68, on the execution plane, control: a review that could not tell sends nothing back, and its stop is offered as today', () => {
	it('⭑ CONTROL — a check left unanswered: one try, no repair turn; the stop offers a re-review; the re-run of the work carries nothing, citing REG-D-104 (1) alone', async () => {
		seam.answer = SKIPPED;
		const pwuId = await modelWorkUnit();

		const stopped = await beginExecute(pwuId);

		expect(stopped.data?.error ?? '', 'arrangement: the floor did not refuse the completion').toMatch(/the assurance floor is NOT satisfied/);
		expect(seam.turns, 'a review that could not tell was sent back to the producer').toHaveLength(1);
		expect(await recoveryShown(pwuId)).toMatchObject({
			kind: 'NOT_CONCLUDED',
			offers: { rerunReview: true, rerunWork: true, abandon: true },
			findings: 0
		});
		const instruction = seam.turns[0]!.text;
		const sessions = seam.sessions;
		seam.answer = CLEAN;
		expect(await act('rerunWork', { pwuId, rationale: 'Try the work again.' })).toEqual({ advanced: 'work-rerun' });
		expect(seam.turns.find((t) => t.session === sessions + 1)?.text).toBe(instruction);
		expect(String(decisionsOf(pwuId)[0]?.state.rationale)).toBe(`Try the work again.\n\n${RERUN_WORK_AFTER_NOT_CONCLUDED_CITATION}`);
	});
});
