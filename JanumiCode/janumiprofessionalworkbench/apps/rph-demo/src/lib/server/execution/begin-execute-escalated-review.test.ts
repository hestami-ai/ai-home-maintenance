// ⭐ `JAN-ESCREC` D3 (`REG-D-090`) — ON THE EXECUTION PLANE, AN ESCALATED REVIEW SAYS WHAT AN ESCALATION IS, ON BOTH ARMS.
//
// ⛔ WHAT WAS WRONG (`DESIGN-the-escalation-recommendation.md` §2 G5). The execution plane never shows the classifier's
// guidance — it is written for a PWA (*"PublishPwa remains blocked…"*). It shows the recorded observations as
// `code: statement` and the remediation's ACTION NAME (`routes/undertakings/[id]/+page.server.ts`, `loopEnded`), and the
// process-result refusal (`execution/evidence-join.ts` `describeRefusedEvidence`) shows observations only. So beside a
// review its reviewer escalated, the operator read a recommendation and the word `ESCALATE_REVIEW`, and nothing said what
// either asks of them, or that no human's review can be recorded here.
//
// ⭑ WHAT MUST HOLD. Beside an ESCALATED review's observations, on the model step's message AND on each refused process
// result, the fixed sentence: *"The reviewer recommended escalation to a human reviewer; this workbench cannot record a
// human's review yet (REG-F-474)."* — keyed on the classifier's ACTION, never on prose; the try count unmoved. ⭑ And the
// message carries each refused process result WHETHER OR NOT the work product's own floor passed: the two reviews are
// independent calls, and the arm for a passed work product printed only the engine's text (the ER-1 app verifier's MAJOR
// 1, its probe `ER1-VP1`, landed below as the third case). ⭑ On that arm a REJECTED result is described too, with no
// human sentence, and with NOTHING refused the message is the hand-over's full stop and the engine's text, whole (the ER-1
// app re-verifier's finding [4], its mutants `ER1-V150` and `ER1-V155`: the arm had been held beside an escalation alone).
// ⭑ AND A REJECTED REVIEW THE REVIEWER ALSO ESCALATED PRINTS NO SUCH SENTENCE: its outcome is REJECTED, *"which is more
// actionable"* (`REG-D-089`), the classifier answers it REFINE_SUBJECT as the PWA page does, and the recommendation is
// still printed among its observations. Its repair turn never carries the recommendation to the producer.
//
// ⭑ THE PRODUCTION COMPOSITION, IN TEST MODE, on `begin-execute-substituted-reviewer.test.ts`'s arrangement: the executor
// is unconfigured, so the selector answers the declared STAND-IN; the reviewer is devin, NAMED with a model. Only devin's
// PROGRAM is replaced: `devinPrint` is the real adapter handed an exec seam that writes the ATIF export naming the
// CONFIGURED model, and answers the reply a case scripts. The stand-in's session is the real one, observed: its turns are
// recorded, and a case may say the host ran one command (`processRuns`), which the route then joins as evidence and
// reviews — the one arm the stand-in cannot reach by itself, because it runs no commands.
//
// ⛔ HERMETIC. devin's exec seam starts nothing; the agy executor's seam answers the fixture and Pi's opener refuses,
// though the stand-in opens neither; no process is started (the run is a value); PATH finds no program.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What the seams saw and answer. Hoisted: the mock factories below run before this file's body. */
const seam = vi.hoisted(() => ({
	agy: [] as { readonly file: string; readonly args: readonly string[] }[],
	pi: [] as string[],
	devin: [] as { readonly file: string; readonly args: readonly string[] }[],
	/** What devin answers every review. */
	answer: '',
	/** What devin answers review N, in the order the reviews run — the work product's, then each command result's — and
	 *  `answer` once they run out. Empty unless a case says so: the two reviews are independent calls. */
	answers: [] as string[],
	/** What a case does WHILE devin answers review N (1-based), before the answer returns — unset unless a case says so. */
	duringReview: undefined as undefined | ((n: number) => void),
	/** Every turn the producer was sent, in order — the first is the instruction, any later one a repair. */
	turns: [] as string[],
	/** The commands the host "ran" for the producer this step: none unless a case says so. */
	runs: [] as unknown[]
}));

vi.mock('./model.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./model.js')>();
	return {
		...actual,
		getExecutionSession: vi.fn((selection: Parameters<typeof actual.getExecutionSession>[0]) => {
			const open = actual.getExecutionSession(selection, {
				agyExec: async (file, args) => {
					seam.agy.push({ file, args });
					return { stdout: await actual.deterministicExecutionPrint(args[1] ?? '') };
				},
				openPi: async (_context, modelId) => {
					seam.pi.push(modelId);
					throw new Error('hermetic: no route test opens a real Pi session');
				}
			});
			// ⭑ THE REAL SESSION, OBSERVED: every turn is recorded, and `processRuns` reports what the case scripted.
			return async (context: Parameters<typeof open>[0]) => {
				const session = await open(context);
				return {
					...session,
					turn: (text: string) => {
						seam.turns.push(text);
						return session.turn(text);
					},
					processRuns: () =>
						seam.runs.length > 0
							? {
									runs: [...seam.runs] as ReturnType<typeof session.processRuns>['runs'],
									observedCount: seam.runs.length,
									recordedLimit: 32
								}
							: session.processRuns()
				};
			};
		})
	};
});

// ⭑ THE REAL devin ADAPTER, ITS PROGRAM REPLACED AT THE SEAM — the CONFIGURED model reported, so the review is not refused
// for who answered, and `execFile` is never reached.
vi.mock('../tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (file, args) => {
				seam.devin.push({ file, args: [...args] });
				seam.duringReview?.(seam.devin.length);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-assurance-model' } }] }),
						'utf8'
					);
				return { stdout: seam.answers[seam.devin.length - 1] ?? seam.answer };
			})
		)
	};
});

import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { listByType } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import { dispatch, getEngine, resetEngine } from '../workbench.js';
import type { ObservedProcessRun } from '../tools/process-run-observer.js';
import { beginExecute, modelWorkUnit } from './begin-execute.testing.js';

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

/** `REG-D-090`'s sentence for the execution plane, verbatim (design D3). */
const HUMAN_SENTENCE =
	"The reviewer recommended escalation to a human reviewer; this workbench cannot record a human's review yet (REG-F-474).";
/** `REG-D-090`'s observation: the code as a literal — the RECORDED word — and the statement byte for byte. */
const RECOMMENDATION_CODE = 'REVIEWER_RECOMMENDED_ESCALATION';
const RECOMMENDATION_STATEMENT =
	"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence.";
/** Where the model step's message hands over to the process-result refusal (`routes/undertakings/[id]/+page.server.ts`). */
const COMMAND_EVIDENCE = ' — and the command evidence did not pass its own floor: ';
/** ⭐ The third fix round's note after observations that hold NO finding (`evidence-join.ts` `noFindingNote`; the second
 *  fix round's re-verifier's finding [0]): what refused the review, in the engine's `policyId=disposition` form, whole.
 *  ⛔ Never beside an ESCALATED review, which the human sentence explains (the third fix round's re-verifier's [1]). */
const NO_FINDING_INCONCLUSIVE = ' — no finding recorded (floor.reasoning-review=INCONCLUSIVE).';

/** devin's reply over the seeded criteria, recommending ESCALATED: every criterion unfailed, or the first faulted. */
const escalated = (faultFirst = false): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
			criterionId: c.id,
			failed: faultFirst && i === 0,
			statement:
				faultFirst && i === 0
					? 'The work product substitutes an easier problem.'
					: 'evaluated; the failure class is absent'
		})),
		recommendation: 'ESCALATED',
		residualUncertainty: []
	});

/** devin's reply over the seeded criteria, every one answered unfailed and recommending SATISFIED: a review that passes. */
const CLEAN_SATISFIED = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	})),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

/** devin's reply answering every criterion but the LAST, unfailed: an INCOMPLETE review (ASR-2), so INCONCLUSIVE with nothing
 *  failed — recommending `recommendation`. D2 records an ESCALATED recommendation on it, its ONLY observation; a SATISFIED
 *  one leaves it with none (`evidence-join.test.ts`'s `skipping` reply). */
const skipped = (recommendation: 'SATISFIED' | 'ESCALATED'): string =>
	JSON.stringify({
		findings: SEEDED_REASONING_REVIEW_CRITERIA.slice(0, -1).map((c) => ({
			criterionId: c.id,
			failed: false,
			statement: 'evaluated; the failure class is absent'
		})),
		recommendation,
		residualUncertainty: []
	});

/** devin's reply with the FIRST criterion failed, recommending REJECTED: a review that judged its subject and found a fault —
 *  no escalation anywhere in it. */
const COMMAND_FAULT = 'The command result substitutes an easier problem.';
const REJECTED_FIRST = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
		criterionId: c.id,
		failed: i === 0,
		statement: i === 0 ? COMMAND_FAULT : 'evaluated; the failure class is absent'
	})),
	recommendation: 'REJECTED',
	residualUncertainty: []
});

/** What the engine says, whole, when a step that is no longer RUNNING is completed — `stepId` FAILED under it. */
const ENGINE_REFUSES_A_FAILED_STEP = (stepId: string): string =>
	`CompleteExecutionStep requires step ${stepId} to be RUNNING, but it is FAILED. The stepState machine may permit that arrow for a DIFFERENT command; this command declares drivesFrom RUNNING.`;

/** The work unit's execution plan and its one step, as the route proposed them. */
function planOf(pwuId: string): { readonly planId: string; readonly stepId: string } {
	const plan = listByType(getEngine(), 'EXECUTION_PLAN').find((p) => p.state.workUnitId === pwuId);
	const stepId = (plan?.state.steps as readonly { readonly id: string }[] | undefined)?.[0]?.id;
	expect(plan, 'arrangement: the work unit has no execution plan').toBeDefined();
	expect(stepId, 'arrangement: the execution plan has no step').toBeDefined();
	return { planId: plan!.id, stepId: stepId! };
}

/** One command the host ran to completion and retained — a result the floor's deterministic policies pass. */
const A_RUN: ObservedProcessRun = {
	ordinal: 1,
	argv: ['npm', 'test'],
	exitCode: 0,
	timedOut: false,
	durationMs: 12,
	outputComplete: true,
	omittedRegions: [],
	retention: {
		retained: true,
		workspaceOwnerId: 'und_1',
		purgeability: 'PURGEABLE_AT_EXPIRY',
		stdoutPath: 'captures/escrec/stdout.txt',
		stderrPath: 'captures/escrec/stderr.txt',
		omittedRegions: [],
		omissionsPath: 'captures/escrec/omissions.json'
	},
	stdout: '12 passed\n',
	stderr: ''
};

beforeEach(() => {
	resetEngine('reference');
	seam.agy.length = 0;
	seam.pi.length = 0;
	seam.devin.length = 0;
	seam.turns.length = 0;
	seam.runs.length = 0;
	seam.answer = escalated();
	seam.answers.length = 0;
	seam.duringReview = undefined;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of LIVE_BACKEND_VARIABLES) vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-assurance-model');
});
afterEach(() => {
	vi.unstubAllEnvs();
});

describe('⭐ JAN-ESCREC D3 — the execution plane says what an escalated review asks, on both arms', () => {
	it('⛔ the work product’s review is escalated: beside its observations, the human sentence — one try, and nothing sent back', async () => {
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(seam.devin.length, 'arrangement: an escalated review was reviewed again').toBe(1);
		expect(message, 'the escalation’s one try was miscounted').toContain('reviewed over 1 try,');
		expect(message, 'arrangement: the review was not escalated').toContain('(ESCALATE_REVIEW)');
		// ⭐ THE CLAIM: the recommendation, as recorded, and the sentence BESIDE it.
		expect(message).toContain(`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT}`);
		expect(message, 'the operator was not told what the escalation asks').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE}`
		);
		// ⛔ NOT THE PWA'S GUIDANCE: this plane has no PWA, and the classifier's text is written for one.
		expect(message).not.toContain('PublishPwa remains blocked');
		expect(seam.turns, 'the escalation was sent back to the producer as work').toHaveLength(1);
		expect(seam.pi, 'arrangement: the stand-in executor opened no Pi').toEqual([]);
	});

	it('⛔ a command result’s review is escalated too: the process-result refusal carries the sentence beside ITS observations', async () => {
		seam.runs.push(A_RUN);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(
			seam.devin.length,
			'arrangement: the work product and the command result were not both reviewed'
		).toBe(2);
		const [workProduct, evidence] = message.split(COMMAND_EVIDENCE);
		expect(evidence, 'arrangement: the command evidence did not refuse').toBeDefined();
		expect(evidence, 'arrangement: the refusal does not name the command').toContain(
			'(["npm","test"]): '
		);
		// ⭐ EACH ARM ITS OWN SENTENCE: the work product's before the hand-over, the command result's after it.
		expect(workProduct, 'the work product’s arm dropped the sentence').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE}`
		);
		expect(evidence, 'the process-result refusal did not say what the escalation asks').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE}`
		);
	});

	it('⛔ the work product PASSED and only a command result’s review is escalated: the refusal still carries the command evidence’s floor, the sentence beside ITS observations, before the engine’s text', async () => {
		// ⭐ The ER-1 app verifier's MAJOR 1 (its probe `ER1-VP1`). The two reviews are independent calls, so the work
		// product can pass while a command's result is escalated — and the step's refusal then came from the arm that
		// printed only the engine's text, whose fallback is `policyId=disposition` (design G5): no observation, no
		// sentence. Any executor that runs a command can produce this shape.
		seam.answers.push(CLEAN_SATISFIED);
		seam.runs.push(A_RUN);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			seam.devin.length,
			'arrangement: the work product and the command result were not both reviewed'
		).toBe(2);
		const [workProduct, evidence] = message.split(COMMAND_EVIDENCE);
		expect(
			evidence,
			'the operator was not told the command evidence did not pass its own floor'
		).toBeDefined();
		// ⭑ THE WORK PRODUCT'S HALF, WHOLE: its floor passed, the step did not complete — and nothing it did not review.
		expect(workProduct, 'arrangement: the work product’s floor did not pass').toBe(
			'The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete'
		);
		expect(evidence, 'the refusal does not name the command').toMatch(/^evd_\w+ \(\["npm","test"\]\): /);
		// ⭐ THE CLAIM: the command result's recommendation, as recorded, and the sentence BESIDE it — then the engine's
		// own text, after it and unchanged.
		expect(evidence, 'the process-result refusal did not say what the escalation asks').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE} CompleteExecutionStep: `
		);
		expect(evidence, 'the engine’s refusal was dropped').toContain(
			'(floor.reasoning-review=ESCALATED)'
		);
		expect(seam.turns, 'a passed work product was sent back to the producer as work').toHaveLength(
			1
		);
	});

	it('⛔ the work product PASSED and a command result’s review REJECTED it: the refusal carries the result’s finding, before the engine’s text, and no human sentence', async () => {
		// ⭐ The ER-1 app re-verifier's finding [4] (its mutant `ER1-V150`): the satisfied arm was pinned only beside an
		// ESCALATED command result, so an arm that described only the escalated results passed every test — and printed
		// "did not pass its own floor:" followed by nothing beside a REJECTED one, the shape MAJOR 1 named. A failed test
		// suite the reviewer rejects is the commoner case. ⭑ No escalation here: no sentence says one.
		seam.answers.push(CLEAN_SATISFIED, REJECTED_FIRST);
		seam.runs.push(A_RUN);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			seam.devin.length,
			'arrangement: the work product and the command result were not both reviewed'
		).toBe(2);
		const [workProduct, evidence] = message.split(COMMAND_EVIDENCE);
		expect(workProduct, 'arrangement: the work product’s floor did not pass').toBe(
			'The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete'
		);
		// ⭐ THE CLAIM: the refused result named, ITS finding as recorded — `code: statement` — and THEN the engine's text.
		expect(evidence, 'the refusal does not name the command').toMatch(/^evd_\w+ \(\["npm","test"\]\): /);
		expect(
			evidence,
			'the refused command result’s finding is not printed before the engine’s text'
		).toContain(
			`(["npm","test"]): ${SEEDED_REASONING_REVIEW_CRITERIA[0]!.id}: ${COMMAND_FAULT} CompleteExecutionStep: `
		);
		expect(evidence, 'the engine’s refusal was dropped').toContain(
			'(floor.reasoning-review=REJECTED)'
		);
		expect(message, 'a REJECTED command result was told as an escalation').not.toContain(
			HUMAN_SENTENCE
		);
		expect(message).not.toContain(RECOMMENDATION_CODE);
	});

	it('⭑ the work product PASSED and NOTHING was refused, yet the step did not complete: the message is the hand-over’s full stop and the engine’s text — WHOLE', async () => {
		// ⭐ The ER-1 app re-verifier's finding [4] (its mutant `ER1-V155`): with nothing refused the fix round said this
		// message is byte-identical to before, and nothing held it — the arm's full stop could go and every test passed.
		// ⭑ THE ENGINE REFUSES FOR A REASON NO FLOOR GAVE: while the work product is under review the step is failed — as an
		// operator in a second tab would fail it — so its completion is refused, and no command evidence was refused at all.
		seam.answer = CLEAN_SATISFIED;
		const pwuId = await modelWorkUnit();
		let failedTheStep = '';
		seam.duringReview = (n) => {
			if (n !== 1) return;
			const { planId, stepId } = planOf(pwuId);
			failedTheStep = dispatch('FailExecutionStep', 'EXECUTION_PLAN', planId, {
				stepId,
				failureReason: 'failed by the operator while its work product was under review'
			}).status;
		};

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			failedTheStep,
			'arrangement: the running step could not be failed under the review'
		).toBe('ACCEPTED');
		expect(seam.devin.length, 'arrangement: only the work product was reviewed').toBe(1);
		expect(message, 'arrangement: nothing refused, yet a command result was named').not.toContain(
			COMMAND_EVIDENCE
		);
		expect(message).toBe(
			`The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete. CompleteExecutionStep: ${ENGINE_REFUSES_A_FAILED_STEP(planOf(pwuId).stepId)}`
		);
	});

	it('⭑ the work product PASSED and a command result’s review observed NOTHING: the refusal says so, naming INCONCLUSIVE, before the engine’s text', async () => {
		// ⭐ The second fix round's re-verifier's finding [4] (its mutant `ER1-V204`): round two's "no observation recorded" was
		// held only in `evidence-join.test.ts`, so an arm that printed only the refused results carrying an observation passed
		// every route test — and beside this result printed "did not pass its own floor:" and then nothing before the
		// engine's text: `REG-F-415`'s empty colon, the shape MAJOR 1 named. The command result's reviewer skipped the last
		// criterion and recommended SATISFIED, so the review is INCONCLUSIVE and records no observation at all.
		seam.answers.push(CLEAN_SATISFIED, skipped('SATISFIED'));
		seam.runs.push(A_RUN);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			seam.devin.length,
			'arrangement: the work product and the command result were not both reviewed'
		).toBe(2);
		const [workProduct, evidence] = message.split(COMMAND_EVIDENCE);
		expect(workProduct, 'arrangement: the work product’s floor did not pass').toBe(
			'The model ran, its work product is recorded, and the assurance floor is satisfied — but the step still did not complete'
		);
		expect(evidence, 'the refusal does not name the command').toMatch(/^evd_\w+ \(\["npm","test"\]\): /);
		// ⭐ THE CLAIM: the result named, what its floor recorded — nothing — and what refused it, THEN the engine's text.
		expect(
			evidence,
			'a refused command result that observed nothing is not said before the engine’s text'
		).toContain(
			'(["npm","test"]): no observation recorded (floor.reasoning-review=INCONCLUSIVE). CompleteExecutionStep: '
		);
	});

	it('⛔ the work product’s review is INCOMPLETE and recommends ESCALATED: its arm names INCONCLUSIVE after the recommendation, and says no escalation — WHOLE', async () => {
		// ⭐ The second fix round's re-verifier's finding [0] (its drive E7): the reviewer left the last criterion unanswered
		// AND recommended ESCALATED, so the review is INCONCLUSIVE and its one observation is the recommendation — which this
		// arm printed alone, naming INCONCLUSIVE nowhere, beside the action that says to retry or reconfigure the reviewer.
		seam.answer = skipped('ESCALATED');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(seam.devin.length, 'arrangement: an incomplete review was reviewed again').toBe(1);
		expect(message).toBe(
			`The model ran, its work product was reviewed over 1 try, and the assurance floor is NOT satisfied: ${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT}${NO_FINDING_INCONCLUSIVE} — The review did not produce findings that may be sent back to the producer (RETRY_OR_CONFIGURE_REVIEWER).`
		);
		expect(message, 'an incomplete review was told as an escalation').not.toContain(HUMAN_SENTENCE);
	});

	it('⭑ CONTROL — the work product’s review is INCOMPLETE and observed NOTHING: the arm prints the engine’s text, which names the disposition, and no note', async () => {
		// An EMPTY list is not the note's (`evidence-join.ts` `noFindingNote`): with no observation this arm prints the
		// engine's refusal, whose fallback already names each policy as `policyId=disposition` — a note after it would name
		// INCONCLUSIVE twice, and say "no finding" where nothing at all was observed.
		seam.answer = skipped('SATISFIED');
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(seam.devin.length, 'arrangement: an incomplete review was reviewed again').toBe(1);
		expect(
			message,
			'arrangement: the work product’s floor recorded an observation, or its arm printed something else'
		).toMatch(
			/^The model ran, its work product was reviewed over 1 try, and the assurance floor is NOT satisfied: CompleteExecutionStep: /
		);
		expect(message, 'arrangement: the engine’s text does not name the disposition').toContain(
			'floor.reasoning-review=INCONCLUSIVE'
		);
		expect(message, 'an empty list of observations was told it holds no finding').not.toContain(
			'no finding recorded'
		);
	});

	it('⛔ an ESCALATED work product beside a command result whose review is INCOMPLETE and recommends ESCALATED: the command half names INCONCLUSIVE, the work-product half carries the human sentence', async () => {
		// ⭐ The second fix round's re-verifier's finding [0] (its drive E8): the command result's reply skipped the last
		// criterion and recommended ESCALATED. Beside the work product's human sentence, its refusal read as an escalation —
		// the recommendation and nothing else, INCONCLUSIVE named nowhere — while its remedy is to re-run or reconfigure
		// the reviewer. ⭑ Each half now names its own disposition, and only the escalated one says what escalation asks.
		seam.answers.push(escalated(), skipped('ESCALATED'));
		seam.runs.push(A_RUN);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(
			seam.devin.length,
			'arrangement: the work product and the command result were not both reviewed'
		).toBe(2);
		expect(message, 'arrangement: the work product was not escalated').toContain(
			'(ESCALATE_REVIEW)'
		);
		const [workProduct, evidence] = message.split(COMMAND_EVIDENCE);
		expect(evidence, 'arrangement: the command evidence did not refuse').toBeDefined();
		// ⭐ THE WORK PRODUCT'S HALF: escalated — the recommendation, then what the escalation asks, and no note between them:
		// the sentence explains an escalated review (the caller's ruling on the third fix round's re-verifier's finding [1]).
		expect(workProduct, 'the escalated work product’s half dropped the human sentence').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT} — ${HUMAN_SENTENCE}`
		);
		// ⭐ THE COMMAND HALF, WHOLE: incomplete — INCONCLUSIVE named after the recommendation, and no human sentence.
		expect(evidence, 'the refusal does not name the command').toMatch(/^evd_\w+ \(\["npm","test"\]\): /);
		expect(
			evidence,
			'the incomplete command result’s refusal does not name INCONCLUSIVE'
		).toContain('floor.reasoning-review=INCONCLUSIVE');
		expect((evidence ?? '').replace(/^evd_\w+ /, '')).toBe(
			`(["npm","test"]): ${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT}${NO_FINDING_INCONCLUSIVE}`
		);
		expect(evidence, 'an incomplete command result was told as an escalation').not.toContain(
			HUMAN_SENTENCE
		);
	});

	it('⭑ a REJECTED review the reviewer ALSO escalated prints NO human sentence — its outcome is REJECTED — while the recommendation is printed, and never sent back to the producer', async () => {
		// `REG-D-089`: *"If a criterion failed, the outcome stays REJECTED, which is more actionable, with the escalation
		// recorded beside it."* The classifier answers it REFINE_SUBJECT, so the loop sends the FINDING back — and only it.
		seam.answer = escalated(true);
		const pwuId = await modelWorkUnit();

		const result = await beginExecute(pwuId);
		const message = result.data?.error ?? '';

		expect(message, 'the model step did not run to its review').toMatch(/^The model ran/);
		expect(message, 'arrangement: the faulted criterion was not reported').toContain(
			'The work product substitutes an easier problem.'
		);
		expect(message, 'the recommendation recorded beside the rejection was not printed').toContain(
			`${RECOMMENDATION_CODE}: ${RECOMMENDATION_STATEMENT}`
		);
		expect(message, 'a REJECTED review was told as an escalation').not.toContain(HUMAN_SENTENCE);
		// ⛔ AND NOT AS AN INCOMPLETE ONE (the third fix round's re-verifier's finding [5]; `ER1-V302`): its observations carry
		// a FINDING, so the note that names what refused a review holding none is not said — on this arm, whose call of
		// `noFindingNote` no other case here controls.
		expect(message, 'a REJECTED review carrying a finding was told it holds none').not.toContain(
			'no finding recorded'
		);
		// ⛔ THE PRODUCER: a repair turn was sent, carrying the subject finding and never the recommendation.
		expect(seam.turns.length, 'arrangement: no repair turn was sent').toBeGreaterThan(1);
		const repairs = seam.turns.slice(1);
		expect(
			repairs.every((t) => t.includes('The work product substitutes an easier problem.')),
			'arrangement: a repair turn did not carry the subject finding'
		).toBe(true);
		expect(
			repairs.filter((t) => t.includes(RECOMMENDATION_CODE)),
			'the reviewer’s recommendation was sent back to the producer as a finding'
		).toEqual([]);
	});
});
