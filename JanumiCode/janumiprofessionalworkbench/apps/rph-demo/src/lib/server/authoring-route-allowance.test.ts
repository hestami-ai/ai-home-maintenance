// ⭐⭐ `JAN-EXEC` Phase 7, PACKAGE L2 — D20 (`REG-F-580`; `REG-D-135` (4); DESIGN-data-flow-order-and-deliverable-review.md D20) —
// THROUGH THE AUTHORING ROUTE: THE SERVER'S ALLOWANCE STOPS A ROUND BEFORE ITS FIRST REVIEWER CALL, AND THE CANDIDATE IS NOT
// ACCEPTED.
//
// ⭑ THE PRODUCTION COMPOSITION, on `authoring-route-failed-part.test.ts`'s arrangement: the route POSTed in-process in test mode,
// the deterministic mock agent authoring a JSON plan, the floor running the product's own devin branch with only devin's PROGRAM
// replaced at its exec seam. ⭐ The route passes the floor no allowance, so the floor reserves against THE PROCESS'S
// (`processAuthoringReviewAllowance`), which this file replaces with one made per test from the product's own constructor — so a
// floor that did not ask the process's allowance would review every part here.
//
// ⛔ HERMETIC, as that file is: the exec seam starts nothing and PATH finds no program; the agent is always the mock, whatever
// mode the route asks for (`JPWB_AGENT=pi` reaches auto-refinement), and the module that imports Pi's SDK is mocked to throw.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

/** What happened, in order: each reviewer call, by the type its subject names, and each agent run. Hoisted: the mocks run first. */
const seam = vi.hoisted(() => ({
	timeline: [] as string[],
	instructions: [] as string[],
	/** The reply devin's program gives a part's review, by the type its subject names. */
	answerFor: (_typeName: string): string => '',
	/** The allowance the process holds in this test: set in each test, from the product's constructor. */
	allowance: undefined as undefined | { reserve(worstCase: number): unknown }
}));

vi.mock('./assurance/review-allowance.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./assurance/review-allowance.js')>();
	return {
		...actual,
		processAuthoringReviewAllowance: vi.fn(() => {
			if (seam.allowance === undefined) throw new Error('arrangement: this test set no allowance');
			return seam.allowance;
		})
	};
});

vi.mock('./tools/devin-reviewer.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./tools/devin-reviewer.js')>();
	const { writeFile } = await import('node:fs/promises');
	return {
		...actual,
		devinPrint: vi.fn((prompt: string) =>
			actual.devinPrint(prompt, async (_file, args) => {
				const typeName = /\{"subject":\{"type":\{"id":"[^"]+","name":"([^"]+)"/.exec(prompt)?.[1] ?? '';
				seam.timeline.push(`review ${typeName}`);
				const exportPath = args[args.indexOf('--export') + 1];
				if (exportPath !== undefined)
					await writeFile(
						exportPath,
						JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-devin-model' } }] }),
						'utf8'
					);
				return { stdout: seam.answerFor(typeName) };
			})
		)
	};
});

vi.mock('./agent/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agent/index.js')>();
	return {
		...actual,
		createAuthoringAgent: vi.fn(
			async (broker: Parameters<typeof actual.createAuthoringAgent>[0]): Promise<AuthoringAgent> => {
				const mock = await actual.createAuthoringAgent(broker, 'mock');
				return {
					run: (instruction, emit, signal) => {
						seam.instructions.push(instruction);
						seam.timeline.push(`agent run ${seam.instructions.length}`);
						return mock.run(instruction, emit, signal);
					},
					rationale: () => mock.rationale(),
					materializedInputs: () => mock.materializedInputs()
				};
			}
		)
	};
});

vi.mock('./agent/pi-agent.js', () => {
	throw new Error('hermetic: no route test loads Pi');
});

import type { AuthoringAgent } from './agent/index.js';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { authoringReviewAllowanceSetting, createAuthoringReviewAllowance } from './assurance/review-allowance.js';
import { clearAuthoringTurns, getPendingAuthoringTurn, summarizeAuthoringTurn } from './authoring-turn.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
type LoadEvent = Parameters<typeof load>[0];

const FAULT = 'Realize claims the product is verified, and no type verifies it.';
const FAULTING = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c, i) => ({
		criterionId: c.id,
		failed: i === 0,
		statement: i === 0 ? FAULT : 'evaluated; the failure class is absent'
	})),
	recommendation: 'REJECTED',
	residualUncertainty: []
});
const CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({
		criterionId: c.id,
		failed: false,
		statement: 'evaluated; the failure class is absent'
	})),
	recommendation: 'SATISFIED',
	residualUncertainty: []
});

/** A root over one child: two types, two parts — a round's worst case is 2 × 6 = 12 reviewer calls. */
const PLAN = JSON.stringify({
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{ tempKey: 'root', name: 'Realize', pwuKind: 'PRODUCT_REALIZATION', isRoot: true, childTempKeys: ['check'] },
					{ tempKey: 'check', name: 'Check', pwuKind: 'VERIFICATION' }
				]
			}
		}
	]
});
const WORST = 2 * 6;
/** The refinement's round: the plan's two types and the two the mock agent's canned graph adds — 4 × 6 = 24. */
const REFINED_REVIEWS = ['review Realize', 'review Check', 'review Product Realization', 'review Architecture Definition'];
const REFINED_WORST = 4 * 6;

function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Allowance fixture',
		description: 'A DRAFT PWA whose review an allowance bounds.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

async function postInstruction(pwaId: string, instruction: string): Promise<{ kind: string; text?: string }[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction })
		})
	} as unknown as RouteEvent);
	return (await response.text())
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as { kind: string; text?: string });
}

interface PageData {
	readonly floor?: { readonly satisfied: boolean; readonly reasoningGaps: readonly string[] };
	readonly typeReviews?: readonly { readonly typeName: string; readonly disposition?: string }[];
}
const loadThePage = async (pwaId: string): Promise<PageData> =>
	(await load({ params: { id: pwaId } } as unknown as LoadEvent)) as PageData;

const allowanceOf = (calls: number) => createAuthoringReviewAllowance(authoringReviewAllowanceSetting(String(calls)));
const reviews = (timeline: readonly string[]) => timeline.filter((t) => t.startsWith('review '));
/** The page's reasoning-review lines that state a stop — beside each, the floor's own `validator execution failed`. */
const stoppedGaps = (data: PageData) =>
	(data.floor?.reasoningGaps ?? []).filter((g) => g.startsWith('No reviewer call was made for this type'));

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.timeline.length = 0;
	seam.instructions.length = 0;
	seam.allowance = undefined;
	seam.answerFor = () => CLEAN;
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
	vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
	vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐⭐ L2 — D20, through the route: the process’s allowance bounds the authoring review', () => {
	// ⛔ PREDICTED RED, read from the code at 59135143: the floor asks no allowance, so the turn's round reviews both parts.
	it('⛔ RED — a turn whose round’s worst case passes the allowance makes no reviewer call; the candidate is staged BLOCKED_EXTERNAL, never accepted, and the page reads the reason', async () => {
		seam.allowance = allowanceOf(WORST - 1);
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		expect(reviews(seam.timeline), 'the round made reviewer calls past the allowance').toEqual([]);
		const turn = getPendingAuthoringTurn(pwaId)!;
		expect(turn.status, 'a candidate whose round the allowance stopped was accepted or sent for revision').toBe(
			'BLOCKED_EXTERNAL'
		);
		expect(summarizeAuthoringTurn(turn).remediationAction).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		const data = await loadThePage(pwaId);
		expect(data.floor?.satisfied).toBe(false);
		const stated = stoppedGaps(data);
		expect(stated, 'the page does not say, for each type, why the round made no call').toHaveLength(2);
		for (const gap of stated)
			expect(gap).toContain(
				`its worst case is 2 × 6 = ${WORST} reviewer calls, and the allowance of ${WORST - 1} has ${WORST - 1} left, 0 reserved by earlier rounds`
			);
		expect(data.typeReviews?.map((r) => [r.typeName, r.disposition])).toEqual([
			['Realize', 'INCONCLUSIVE'],
			['Check', 'INCONCLUSIVE']
		]);
	});

	// ⛔ PREDICTED RED, read from the code at 59135143: nothing is reserved, so the refinement's round reviews every part again.
	// ⭑ The refinement's round has FOUR parts: the mock agent, given the directive rather than a plan, stages its canned graph's
	// two types beside the plan's (measured at the skeleton stage: Realize, Check, Product Realization, Architecture Definition) —
	// so its worst case is 4 × 6 = 24, and the first round's 12 reserved leaves it one call short of an allowance of 35.
	it('⛔ RED — the refinement’s round, past what the first round left, is stopped before its first call, and the candidate is not accepted', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		seam.answerFor = (typeName) => (typeName === 'Realize' ? FAULTING : CLEAN);
		seam.allowance = allowanceOf(WORST + REFINED_WORST - 1);
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		expect(seam.instructions, 'arrangement: the refinement ran').toHaveLength(2);
		const second = seam.timeline.slice(seam.timeline.indexOf('agent run 2') + 1);
		expect(reviews(seam.timeline.slice(0, seam.timeline.indexOf('agent run 2'))), 'arrangement: the first round').toEqual([
			'review Realize',
			'review Check'
		]);
		expect(reviews(second), 'the refinement’s round made reviewer calls past what the first left').toEqual([]);
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('BLOCKED_EXTERNAL');
		const data = await loadThePage(pwaId);
		const stated = stoppedGaps(data);
		expect(stated, 'the page does not read the refinement round’s reason, for each of its types').toHaveLength(4);
		expect(stated[0]).toContain(
			`its worst case is 4 × 6 = ${REFINED_WORST} reviewer calls, and the allowance of ${WORST + REFINED_WORST - 1} has ` +
				`${REFINED_WORST - 1} left, ${WORST} reserved by earlier rounds`
		);
	});

	it('⭑ CONTROL — an allowance holding both rounds reviews both, and the refined candidate is staged for revision as today', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		seam.answerFor = (typeName) => (typeName === 'Realize' ? FAULTING : CLEAN);
		seam.allowance = allowanceOf(WORST + REFINED_WORST);
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		const second = seam.timeline.slice(seam.timeline.indexOf('agent run 2') + 1);
		expect(reviews(second)).toEqual(REFINED_REVIEWS);
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('REVISION_REQUIRED');
	});

	it('⭑ CONTROL — a round EXACTLY at the allowance is reviewed, and its clean candidate is assured', async () => {
		seam.allowance = allowanceOf(WORST);
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		expect(reviews(seam.timeline)).toEqual(['review Realize', 'review Check']);
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('READY_TO_COMMIT');
	});
});
