// ⭐⭐ `JAN-EXEC` P7-6 fix round C, C2 (`REG-F-433`; `DESIGN-the-stopped-unit-recovery.md` RD10, as corrected;
// `DESIGN-the-reviewer-isolated.md` §4d I5; `REG-F-552`) — THE PWA PAGE SHOWS THE ANSWER OF THE REVIEW IT SHOWS.
//
// The page renders a floor — canonical's, or a staged candidate's fork — and, under it, "What the reviewer returned"
// (`loadReviewerAnswer`, MXREAD-03). ⛔ THE READER WAS JOINED TO NOTHING THE PAGE SHOWS. After B7 it returned the most
// recent floor run's answer on the subject, by the record's order — and a floor run's exchanges are CANONICAL wherever
// its assessments go (`floor.ts`, the drain): a DISCARDED authoring turn's exchanges stay recorded while its assessments
// die with the fork, so the page showed that turn's answer beside a floor that never concluded from it. And within a run
// it returned the HIGHEST ordinal: for a P7-6 I5 chain whose repair did not parse, the repair's prose, though the
// assessment kept the FIRST reply's judgement.
// ⭐ So the reader now takes the floor-run token of the assessment the page DISPLAYS (the assessment's correlation, the
// exchanges' `runToken` — one token per floor run, B7), reads the exchanges from CANONICAL, where every run's are, and
// within that run returns the reply the review CONCLUDED from: an answering criterion repair concludes it; otherwise
// the first reply (the I5 rule the run report reads by, `scripts/phase7/run-report-core.ts`).
//
// ⭑ THROUGH THE PAGE'S OWN LOAD, in-process, over the workbench's engine in test mode: the cases hold the page's call as
// well as the reader. The reviewer is the real agy validator with its model stubbed (`print`), as `floor-recording.test.ts`
// drives it. No model is called.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType } from '@janumipwb/rph-engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { clearingJudgement } from './assurance/clearing-reviewer.testing.js';
import { beginAuthoringTurn, clearAuthoringTurns, discardAuthoringTurn } from './authoring-turn.js';
import { reasoningReviewCriteria, runPwaFloor, type FloorProducer } from './floor.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { dispatch, getEngine, resetEngine } from './workbench.js';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5J00';
/** ⭐ The review in parts, B3 (`REG-D-125`) — the PWA's one type: its review, and so its reviewer's answer, is the part's. */
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5J10';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };

/** `load` only ever reads `params.id`; the rest of the SvelteKit event is not touched. */
const event = { params: { id: PWA } } as unknown as Parameters<typeof load>[0];
type Answer = { readonly attemptOrdinal: number; readonly answer?: string };
type Shown = {
	readonly floor?: { readonly policies: readonly { readonly policyId: string; readonly disposition: string }[] };
	readonly reviewerAnswer?: Answer;
	readonly partAnswers: readonly { readonly typeId: string; readonly answer: Answer }[];
};
/**
 * ⭐ B3 — the page's load, its one part's answer read where the review now is: under the part (`partAnswers`). ⛔ And the
 * PWA's own answer is asked to be absent every time: a round in parts records no reviewer call under the PWA.
 */
const page = async (): Promise<Shown & { readonly reviewerAnswer?: Answer }> => {
	const shown = (await load(event)) as Shown;
	expect(shown.reviewerAnswer, 'the PWA itself has no reviewer answer once its review is in parts').toBeUndefined();
	expect(shown.partAnswers.map((p) => p.typeId), 'the answer is not under the part').toEqual([ROOT]);
	return { ...shown, reviewerAnswer: shown.partAnswers[0]!.answer };
};

/** A reply answering every criterion of the seeded policy, met — told apart from another by `run`. */
const answering = (run: string): string =>
	clearingJudgement(reasoningReviewCriteria(getEngine().as(SESSION_CREDENTIAL))).replaceAll(
		'evaluated; the failure class is absent',
		`evaluated in ${run}; the failure class is absent`
	);
/** A reply that PARSES and answers no criterion — the measured run's own shape, which draws P7-6 I5's one repair. */
const NO_ROWS = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}';

/** A model stub giving each reply in turn. */
const replies =
	(...texts: string[]) =>
	async (): Promise<string> =>
		texts.shift() ?? '';

/** The reasoning review's disposition on the floor the page shows. */
const reviewShown = (shown: Shown): string | undefined =>
	shown.floor?.policies.find((p) => p.policyId === 'floor.reasoning-review')?.disposition;

beforeEach(() => {
	// ⭑ THE REAL REVIEWER, NAMED (`floor-recording.test.ts`'s switch): the declared stand-in captures nothing, so its
	// floor would record no exchange and the page would have no answer to show. The model call is the stub (`print`).
	process.env.JPWB_ASSURANCE_TOOL = 'agy';
	process.env.JPWB_JUDGE_MODEL = 'test-judge-model';
	clearAuthoringTurns();
	resetEngine('empty');
	const created = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'Reviewer answer join fixture',
		description: 'A DRAFT PWA whose floor runs more than once.',
		domain: 'software',
		version: '1.0.0'
	});
	expect(created.status, `arrangement: CreatePwa — ${created.error?.message ?? ''}`).toBe('ACCEPTED');
	const typed = dispatch('DefinePwuType', 'PWU_TYPE', ROOT, {
		pwuTypeId: ROOT,
		pwaId: PWA,
		pwuKind: 'PLAN',
		name: 'Plan',
		purpose: 'Plan the work',
		isRoot: true,
		permittedChildTypeIds: [],
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: []
	});
	expect(typed.status, `arrangement: DefinePwuType — ${typed.error?.message ?? ''}`).toBe('ACCEPTED');
});
afterEach(() => {
	clearAuthoringTurns();
	delete process.env.JPWB_ASSURANCE_TOOL;
	delete process.env.JPWB_JUDGE_MODEL;
});

describe('⭐⭐ P7-6 C2 — the PWA page shows the reviewer answer of the floor it shows (REG-F-433, REG-F-552)', () => {
	it('⛔ a DISCARDED authoring turn: its exchanges stay canonical, its floor dies with the fork — the page shows the DISPLAYED floor’s answer', async () => {
		const displayed = answering('the run the page shows');
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(displayed) });
		const turn = beginAuthoringTurn(PWA);
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(answering('the discarded turn')) }, turn.engine);
		expect(discardAuthoringTurn(PWA), 'arrangement: the turn is discarded').toBe(true);
		expect(
			new Set(listByType(getEngine(), 'MODEL_EXCHANGE').map((r) => (r.state as { runToken?: string }).runToken)).size,
			'arrangement: canonical holds BOTH runs’ exchanges — the discarded turn’s among them'
		).toBe(2);
		const shown = await page();
		expect(reviewShown(shown), 'arrangement: the page shows canonical’s floor').toBe('SATISFIED');
		expect(shown.reviewerAnswer?.answer, 'the page showed the discarded turn’s answer beside canonical’s floor').toBe(displayed);
	});

	it('⛔ a STAGED candidate: the page shows the fork’s floor, and the answer of THAT turn — which canonical holds, not the fork', async () => {
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(answering('the canonical run')) });
		const staged = answering('the staged turn');
		const turn = beginAuthoringTurn(PWA);
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(staged) }, turn.engine);
		const shown = await page();
		expect(reviewShown(shown), 'arrangement: the page shows a floor').toBe('SATISFIED');
		expect(shown.reviewerAnswer?.answer, 'the page showed another run’s answer beside the staged turn’s floor').toBe(staged);
	});

	it('⛔ an I5 chain whose criterion repair answered in PROSE: the review kept the FIRST reply’s judgement — the page shows that reply, not the repair’s', async () => {
		await runPwaFloor(PWA, {
			prompt: 'assess it',
			producer: PRODUCER,
			print: replies(NO_ROWS, "I'll check the files the graph names first.")
		});
		expect(
			listByType(getEngine(), 'MODEL_EXCHANGE').map((r) => {
				const s = r.state as { exchangeRole?: string; disposition?: string };
				return `${s.exchangeRole}:${s.disposition}`;
			}),
			'arrangement: an I5 chain whose repair did not parse'
		).toEqual(['INITIAL:REPAIR_REQUESTED', 'REPAIR:REJECTED']);
		const shown = await page();
		expect([shown.reviewerAnswer?.attemptOrdinal, shown.reviewerAnswer?.answer], 'the page showed the repair the review did not conclude from').toEqual([1, NO_ROWS]);
	});

	it('⭑ CONTROL — an I5 chain whose criterion repair ANSWERS: that repair concluded the review, and the page shows it', async () => {
		const repaired = answering('the criterion repair');
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(NO_ROWS, repaired) });
		const shown = await page();
		expect(reviewShown(shown), 'arrangement: the repair concluded the review').toBe('SATISFIED');
		expect([shown.reviewerAnswer?.attemptOrdinal, shown.reviewerAnswer?.answer]).toEqual([2, repaired]);
	});

	it('⭑ CONTROL — two canonical runs, one try each (REG-F-433’s own tie): the page shows the SECOND, whose floor it shows', async () => {
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(answering('the first run')) });
		const second = answering('the second run');
		await runPwaFloor(PWA, { prompt: 'assess it', producer: PRODUCER, print: replies(second) });
		expect((await page()).reviewerAnswer?.answer).toBe(second);
	});
});
