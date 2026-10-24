// ⭐⭐ `JAN-EXEC` Phase 7, THE REVIEW IN PARTS, PACKAGE E, E1 (the lead's decision on package B's check;
// DESIGN-authoring-review-in-parts.md D5, D8) — THROUGH THE AUTHORING ROUTE: A ROUND WHOSE CONCLUDED PART ASKS FOR REVISION, BESIDE
// A PART WHOSE REVIEW FAILED OPERATIONALLY, IS ANSWERED BY REVISION.
//
// ⛔ WHAT WAS WRONG. One part's failed review — no reply — beside another part's REJECTED review made the whole round
// operational: the classifier answered RETRY_OR_CONFIGURE_REVIEWER with no finding, so the one automatic refinement never ran,
// the candidate was staged BLOCKED_EXTERNAL, and the resume banner said the review produced no usable verdict while the panel
// listed the rejected part's finding.
// ⭑ WHAT MUST HOLD. The refinement runs once, sent the rejected part's finding and the failed part's name; after it EVERY part
// is reviewed again, the failed one included (design D8); and the candidate is staged for revision, the banner and the hint
// naming the failed part.
//
// ⭑ THE PRODUCTION COMPOSITION, on `authoring-route-escalated-review.test.ts`'s arrangement: the route POSTed in-process in
// test mode, the deterministic mock agent authoring a JSON plan, the floor running the product's own devin branch with only
// devin's PROGRAM replaced at its exec seam — which answers each part by the type its prompt's subject names: no reply for
// "Check", a faulting reply for "Realize", a clean one for any other.
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
	/** Every instruction the agent was run on, in order: the operator's, then any auto-refinement directive. */
	instructions: [] as string[],
	/** The reply devin's program gives a part's review, by the type its subject names; '' is no reply. */
	answerFor: (_typeName: string): string => ''
}));

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
import { listByType } from '@janumipwb/rph-engine';
import { SEEDED_REASONING_REVIEW_CRITERIA } from '@janumipwb/rph-assurance';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	getPendingAuthoringTurn,
	markAuthoringTurnRevisionRequired,
	markAuthoringTurnValid,
	resumeAuthoringTurn,
	summarizeAuthoringTurn,
	type AuthoringTurnSummary
} from './authoring-turn.js';
import type { FloorBlockedHint } from './floor.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
type LoadEvent = Parameters<typeof load>[0];

const FAULT = 'Realize claims the product is verified, and no type verifies it.';
/** devin's reply with the FIRST criterion failed and the rest unfailed: REJECTED. */
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

/** A root over one child: two types, two parts. */
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

function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Failed part fixture',
		description: 'A DRAFT PWA one of whose parts gets no review.',
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

async function loadThePage(pwaId: string): Promise<{
	floorBlockedHint?: FloorBlockedHint;
	floorFailedReviews?: string;
	authoringTurn?: AuthoringTurnSummary;
	resumeHint?: string;
}> {
	return (await load({ params: { id: pwaId } } as unknown as LoadEvent)) as {
		floorBlockedHint?: FloorBlockedHint;
		floorFailedReviews?: string;
		authoringTurn?: AuthoringTurnSummary;
		resumeHint?: string;
	};
}

/** The candidate's type named `name`, read from the turn's fork. */
function typeIdOf(pwaId: string, name: string): string {
	const t = listByType(getPendingAuthoringTurn(pwaId)!.engine, 'PWU_TYPE').find(
		(r) => r.state.pwaId === pwaId && r.state.name === name
	);
	expect(t, `arrangement: no type ${name}`).toBeDefined();
	return t!.id;
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	seam.timeline.length = 0;
	seam.instructions.length = 0;
	seam.answerFor = (typeName) => (typeName === 'Check' ? '' : typeName === 'Realize' ? FAULTING : CLEAN);
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

describe('⭐⭐ package E, E1 — through the route: a rejected part beside a part whose review failed is answered by revision', () => {
	it('⭐ RED — the one refinement runs, sent the finding and the failed part’s name; every part is reviewed again after it; the candidate is staged for revision, the banner and the hint naming the failed part', async () => {
		vi.stubEnv('JPWB_AGENT', 'pi');
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId, PLAN);

		expect(events.at(-1)?.kind).toBe('done');
		const check = typeIdOf(pwaId, 'Check');
		const named = `"Check" (${check})`;
		// ⭐ THE REFINEMENT RAN, ONCE.
		expect(seam.instructions, 'no auto-refinement pass ran beside the rejected part’s finding').toHaveLength(2);
		const directive = seam.instructions[1]!;
		expect(directive, 'the directive did not carry the rejected part’s finding').toContain(FAULT);
		expect(directive, 'the directive did not name the part whose review failed').toContain(
			`Do not change them on account of that failure:\n- ${named}\n`
		);
		// ⭐ AND AFTER IT EVERY PART IS REVIEWED AGAIN, THE FAILED ONE INCLUDED (design D8).
		const after = seam.timeline.slice(seam.timeline.indexOf('agent run 2') + 1);
		expect(seam.timeline.indexOf('agent run 2'), 'arrangement: the refinement is not in the timeline').toBeGreaterThan(0);
		expect(after, 'the failed part was not reviewed again').toContain('review Check');
		expect(after, 'the rejected part was not reviewed again').toContain('review Realize');
		// ⭐ THE CANDIDATE IS STAGED FOR REVISION, NEVER AS AN EXTERNAL BLOCK.
		const turn = getPendingAuthoringTurn(pwaId);
		expect(turn?.status, 'the round was staged as a review that produced no usable verdict').toBe('REVISION_REQUIRED');
		expect(summarizeAuthoringTurn(turn!).failedReviews, 'the turn does not name the failed part').toBe(named);
		expect(
			events.filter((e) => e.kind === 'status').map((e) => e.text ?? ''),
			'the operator was not told the failed part is reviewed again'
		).toContainEqual(expect.stringContaining(`The Reasoning Review of ${named} failed operationally and recorded no finding`));
		const data = await loadThePage(pwaId);
		expect(data.resumeHint).toBe(
			`Revision requested by the findings of the types whose reviews concluded — the Reasoning Review of ${named} failed operationally and recorded no finding, and every type, the failed ones included, is reviewed again when the revised candidate is. This candidate is preserved. Refine it in the chat below (it continues on the same candidate), or Discard.`
		);
		expect(data.floorBlockedHint, 'the hint did not say revision answers it').toBe('REVISE_BESIDE_FAILED_REVIEWS');
		expect(data.floorFailedReviews, 'the page does not name the failed part').toBe(named);
	});

	it('⭑ CONTROL — the default lane (no refinement): the same round, staged for revision at once, the banner naming the failed part', async () => {
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		expect(seam.instructions, 'arrangement: the mock agent refined').toHaveLength(1);
		const named = `"Check" (${typeIdOf(pwaId, 'Check')})`;
		expect(getPendingAuthoringTurn(pwaId)?.status).toBe('REVISION_REQUIRED');
		expect((await loadThePage(pwaId)).authoringTurn?.failedReviews).toBe(named);
	});

	it('⭑ CONTROL — every part’s review failed: an external block, as before, and no part named', async () => {
		seam.answerFor = () => '';
		const pwaId = draftPwa();

		await postInstruction(pwaId, PLAN);

		const turn = getPendingAuthoringTurn(pwaId)!;
		expect(turn.status).toBe('BLOCKED_EXTERNAL');
		expect(summarizeAuthoringTurn(turn).remediationAction).toBe('RETRY_OR_CONFIGURE_REVIEWER');
		expect(summarizeAuthoringTurn(turn).failedReviews).toBeUndefined();
	});
});

describe('⭐ package E, E1 — the summary names the failed parts of the stop the turn is IN', () => {
	it('⛔ a resumed turn forgets them: resumed, and then stopped for revision with none, it names none', () => {
		const pwaId = draftPwa();
		const turn = beginAuthoringTurn(pwaId);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		markAuthoringTurnValid(turn);
		markAuthoringTurnRevisionRequired(turn, 'The candidate did not satisfy the floor.', '"Plan" (pwut_x)');
		expect(summarizeAuthoringTurn(turn).failedReviews, 'arrangement: the stop did not carry them').toBe('"Plan" (pwut_x)');

		const resumed = resumeAuthoringTurn(pwaId)!;
		expect(summarizeAuthoringTurn(resumed).failedReviews, 'a resumed turn still named the parts it stopped on').toBeUndefined();
		markAuthoringTurnRevisionRequired(resumed, 'The candidate did not satisfy the floor.');
		expect(summarizeAuthoringTurn(resumed).failedReviews).toBeUndefined();
	});
});
