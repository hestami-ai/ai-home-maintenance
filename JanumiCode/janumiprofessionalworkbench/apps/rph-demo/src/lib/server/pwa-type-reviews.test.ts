// ⭐⭐ `JAN-EXEC` Phase 7, THE REVIEW OF AN AUTHORED PWA IN PARTS, B5 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D7; roadmap
// 9a.6) — THE PWA PAGE'S LOAD HANDS THE INSPECTOR EACH TYPE'S OWN REVIEW.
//
// The floor reviews each type of the PWA as a part and records the round under one floor-run token (B3). The page's load handed
// the panel the floor's three policy rows, whose Reasoning Review is the FOLD of every part, and one reviewer answer, the PWA's,
// which a round in parts never records: no type's own disposition, criteria, findings or answer reached the inspector. Its
// `typeReviews` are the shown round's parts, in the export's order, each read whole from its own part — its disposition, or
// `MISSING`; its criteria; its findings; and its reviewer's answer, joined to the part's subject and the round's token.
//
// ⭑ THROUGH THE PAGE'S OWN LOAD, in-process, over the workbench's engine in test mode: the real recorder and the real validator,
// its model replaced at the `print` seam by a reply chosen per part, read off the part's own subject line, as
// `floor-parts.test.ts` drives it. No model is called: `withLiveReviewerSeam` points PATH at an empty directory.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { createInMemoryArtifactStore, type ArtifactStore } from '@janumipwb/rph-ports';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { load } from '../../routes/pwa/[id]/+page.server.js';
import { clearingJudgement, withLiveReviewerSeam } from './assurance/clearing-reviewer.testing.js';
import { clearAuthoringTurns } from './authoring-turn.js';
import { reasoningReviewCriteria, runPwaFloor, type FloorProducer } from './floor.js';
import { SESSION_CREDENTIAL } from './identity.js';
import { registerStipulation } from './stipulations.js';
import { getEngine, resetEngine } from './workbench.js';

const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5T00';
/** Two types, defined in this order — the export's, and so the parts'. */
const BUILD = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5T11';
const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5T10';
/** A third, defined after a round, so the round holds no review of it. */
const CHECK = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5T12';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };

/** `load` only ever reads `params.id`; the rest of the SvelteKit event is not touched. */
const event = { params: { id: PWA } } as unknown as Parameters<typeof load>[0];
interface Review {
	readonly typeId: string;
	readonly typeName: string;
	readonly semanticVersion: number;
	readonly disposition: string;
	readonly reviewed: boolean;
	readonly criteria?: { readonly evaluated: number; readonly stipulated: number };
	readonly criterionResults?: readonly { readonly criterionId: string; readonly result?: string; readonly stipulated?: string }[];
	readonly findings: readonly { readonly code: string; readonly statement: string }[];
	readonly escalationRecommended: boolean;
	readonly answer?: { readonly attemptOrdinal: number; readonly answer?: string; readonly disclosure: string };
}
interface Shown {
	readonly floor?: { readonly aggregate: string; readonly policies: readonly { readonly policyId: string; readonly disposition: string }[] };
	readonly typeReviews: readonly Review[];
}
const shown = async (): Promise<Shown> => (await load(event)) as Shown;
const reviewOf = (s: Shown, typeId: string): Review => {
	const r = s.typeReviews.find((x) => x.typeId === typeId);
	expect(r, `no review of ${typeId} is handed to the inspector`).toBeDefined();
	return r!;
};

let session: AuthedEngineHandle;
let sequence = 0;

function send(commandType: string, aggregateType: string, id: string, payload: unknown): void {
	sequence += 1;
	const command: DomainCommand = {
		commandId: `type-reviews-${sequence}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: aggregateType,
		targetAggregateId: id,
		issuedAt: '2026-10-24T09:00:00Z',
		correlationId: 'setup',
		idempotencyKey: `type-reviews-${sequence}`,
		payload
	};
	const r = session.dispatch(command);
	expect(r.status, `arrangement: ${commandType} ${id} — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
}

function defineType(id: string, name: string, isRoot: boolean, children: string[] = []): void {
	send('DefinePwuType', 'PWU_TYPE', id, {
		pwuTypeId: id,
		pwaId: PWA,
		pwuKind: name.toUpperCase(),
		name,
		purpose: `${name} the work`,
		isRoot,
		permittedChildTypeIds: children,
		requiredInputs: [],
		requiredOutputs: [],
		requiredAssurancePolicyIds: []
	});
}

/** The type a part's prompt reviews: its subject line's type id, which the export writes first. */
const partOf = (prompt: string): string | undefined => /\{"subject":\{"type":\{"id":"([^"]+)"/.exec(prompt)?.[1];

/** A reply answering every criterion met, told apart from another by `said`, which its statements carry. */
const answering = (said: string): string =>
	clearingJudgement(reasoningReviewCriteria(session)).replaceAll(
		'evaluated; the failure class is absent',
		`evaluated, ${said}; the failure class is absent`
	);
/** A reply faulting the policy's first criterion with `statement`, every other criterion answered unfailed. */
const rejecting = (statement: string): string =>
	JSON.stringify({
		findings: reasoningReviewCriteria(session).map((c, i) => ({
			criterionId: c.id,
			failed: i === 0,
			statement: i === 0 ? statement : 'evaluated; the failure class is absent'
		})),
		recommendation: 'REJECTED',
		residualUncertainty: []
	});

/** A clean reply its reviewer recommends ESCALATED — rule (a)'s subject (`REG-D-089`). */
const escalatingClean = (): string =>
	JSON.stringify({ ...JSON.parse(answering('escalated')), recommendation: 'ESCALATED' });

/** One round on canonical, a reply per part (`answers[typeId]`, a clean one otherwise), its bytes kept in `artifacts`. */
async function runRound(answers: Record<string, string> = {}, artifacts?: ArtifactStore): Promise<void> {
	await withLiveReviewerSeam(() =>
		runPwaFloor(
			PWA,
			{
				prompt: 'Author the realization of wordfreq.',
				producer: PRODUCER,
				canonical: session,
				...(artifacts === undefined ? {} : { artifacts }),
				print: async (prompt) => answers[partOf(prompt) ?? ''] ?? answering('clean')
			},
			session
		)
	);
}

beforeEach(() => {
	sequence = 0;
	clearAuthoringTurns();
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	send('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', PWA, {
		pwaId: PWA,
		name: 'wordfreq',
		description: 'A PWA whose types are reviewed in parts.',
		domain: 'software',
		version: '1.0.0'
	});
	defineType(BUILD, 'Build', false);
	defineType(ROOT, 'Realize', true, [BUILD]);
});
afterEach(() => {
	clearAuthoringTurns();
});

describe('⭐⭐ B5 — the page’s load hands the inspector each type’s own review (REG-D-125; design D7)', () => {
	// ⛔ PREDICTED RED, read from the code: the load carried no type's review, only the answers of the parts that had one
	// (`partAnswers`), and the panel rendered the fold of every part as one policy row.
	it('⭐ RED — one review per part of the shown round, in the export’s order: its disposition, criteria, findings and answer, each its own', async () => {
		await runRound({ [BUILD]: answering('Build’s own reply'), [ROOT]: answering('Realize’s own reply') });
		const s = await shown();
		expect(s.typeReviews.map((r) => [r.typeId, r.typeName, r.disposition, r.reviewed])).toEqual([
			[BUILD, 'Build', 'SATISFIED', true],
			[ROOT, 'Realize', 'SATISFIED', true]
		]);
		const criteria = reasoningReviewCriteria(session).length;
		for (const typeId of [BUILD, ROOT]) {
			const r = reviewOf(s, typeId);
			// ⭑ The tally as a pair, evaluated then stipulated: an object naming the second would read as a stipulation's writer
			// to `verif/stipulation-writers.test.ts`, and this file writes none.
			expect([[r.criteria?.evaluated, r.criteria?.stipulated], r.findings, r.escalationRecommended, r.semanticVersion]).toEqual([
				[criteria, 0],
				[],
				false,
				session.loadObject(typeId)!.semanticVersion
			]);
			// ⭐ Package C's check (roadmap 9a.6, "criterion results") — and each criterion's own result, by its id, as its review
			// recorded it: which criterion a type failed on is read here, never only how many were evaluated.
			expect(r.criterionResults?.map((c) => [c.criterionId, c.result, c.stipulated]), 'no criterion’s own result is handed').toEqual(
				reasoningReviewCriteria(session).map((c) => [c.id, 'MET', undefined])
			);
		}
		expect(reviewOf(s, BUILD).answer?.answer).toBe(answering('Build’s own reply'));
		expect(reviewOf(s, ROOT).answer?.answer).toBe(answering('Realize’s own reply'));
	});

	it('⛔ a failed part beside a satisfied sibling: the failure, its findings and its disposition are the failed part’s alone, and the PWA’s aggregate is the strictest', async () => {
		await runRound({ [BUILD]: rejecting('Build drops the required failure paths.') });
		const s = await shown();
		expect(s.floor?.aggregate, 'the PWA’s aggregate is not the strictest part’s').toBe('REJECTED');
		const [faulted, ...met] = reasoningReviewCriteria(session).map((c) => c.id);
		// ⭐ Package C's check — each finding with the criterion it faults (its observation's code), and that criterion NOT_MET
		// among the part's criterion results.
		expect([reviewOf(s, BUILD).disposition, reviewOf(s, BUILD).findings]).toEqual([
			'REJECTED',
			[{ code: faulted, statement: 'Build drops the required failure paths.' }]
		]);
		expect(reviewOf(s, BUILD).criterionResults?.map((c) => [c.criterionId, c.result]), 'the criterion it failed on is not said').toEqual([
			[faulted, 'NOT_MET'],
			...met.map((id) => [id, 'MET'])
		]);
		expect(
			[reviewOf(s, ROOT).disposition, reviewOf(s, ROOT).findings],
			'the satisfied sibling was handed another type’s review'
		).toEqual(['SATISFIED', []]);
	});

	it('⛔ an incomplete round: a type the round holds no review of is handed to the inspector as such — MISSING, nothing recorded — never left out', async () => {
		await runRound();
		defineType(CHECK, 'Check', false);
		const s = await shown();
		expect(s.typeReviews.map((r) => r.typeId), 'a type the round did not review was left out').toEqual([BUILD, ROOT, CHECK]);
		expect(reviewOf(s, CHECK)).toEqual({
			typeId: CHECK,
			typeName: 'Check',
			semanticVersion: session.loadObject(CHECK)!.semanticVersion,
			disposition: 'MISSING',
			reviewed: false,
			findings: [],
			escalationRecommended: false
		});
		expect(reviewOf(s, BUILD).reviewed, 'arrangement: the reviewed parts are still the round’s').toBe(true);
	});

	it('⭐ a part its reviewer escalated: the recommendation is said beside its findings, never listed among them', async () => {
		await runRound({ [BUILD]: escalatingClean() });
		const s = await shown();
		expect(reviewOf(s, BUILD).disposition, 'arrangement: the clean part its reviewer escalated').toBe('ESCALATED');
		expect([reviewOf(s, BUILD).findings, reviewOf(s, BUILD).escalationRecommended]).toEqual([[], true]);
		expect(reviewOf(s, ROOT).escalationRecommended, 'the sibling was said to be escalated').toBe(false);
	});

	it('⭐ two rounds with distinct answers: each type is handed the SHOWN round’s answer — the latest — never the earlier one', async () => {
		await runRound({ [BUILD]: answering('round one, Build'), [ROOT]: answering('round one, Realize') });
		await runRound({ [BUILD]: answering('round two, Build'), [ROOT]: answering('round two, Realize') });
		const s = await shown();
		expect([reviewOf(s, BUILD).answer?.answer, reviewOf(s, ROOT).answer?.answer]).toEqual([
			answering('round two, Build'),
			answering('round two, Realize')
		]);
	});

	// ⛔ A ROUND WHOSE TOKEN JOINS NO CALL OF THE TYPE: the stand-in reviews the second round and records no exchange, while the
	// first round's calls about the same types are recorded. An answer joined by its subject alone would show the first's.
	it('⛔ an assessment whose round token joins no recorded call: no answer is handed, never an older round’s about the same type', async () => {
		await runRound({ [BUILD]: answering('round one, Build'), [ROOT]: answering('round one, Realize') });
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		await runPwaFloor(PWA, { prompt: 'Author it.', producer: PRODUCER }, session);
		const s = await shown();
		expect(s.typeReviews.map((r) => [r.disposition, (r.criteria?.stipulated ?? 0) > 0]), 'arrangement: the stand-in’s round is the one shown').toEqual([
			['SATISFIED', true],
			['SATISFIED', true]
		]);
		expect(
			s.typeReviews.map((r) => r.answer),
			'an answer of another round was handed beside the shown round’s review'
		).toEqual([undefined, undefined]);
	});

	// ⭐ Package C's check (roadmap 9a.6, "criterion results", "stipulation disclosures") — under the stand-in, which judges one
	// criterion of a part (`RR-04`, the dead-end check) and stipulates the rest where a test registered it.
	it('⭐ each criterion’s own row: the one the checker judged with its result, each one the test stipulated with its result and the stipulation beside it', async () => {
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		await runPwaFloor(PWA, { prompt: 'Author it.', producer: PRODUCER }, session);
		const judged = 'RR-04-no-proxy-satisfaction';
		const rows = reasoningReviewCriteria(session).map((c) =>
			c.id === judged ? [c.id, 'MET', undefined] : [c.id, 'UNABLE_TO_DETERMINE', 'MET']
		);
		expect(
			reasoningReviewCriteria(session).some((c) => c.id === judged),
			'arrangement: the policy declares the criterion the checker judges'
		).toBe(true);
		expect(
			(await shown()).typeReviews.map((r) => r.criterionResults?.map((c) => [c.criterionId, c.result, c.stipulated])),
			'a stipulated row was handed as a reviewed one, or not at all'
		).toEqual([rows, rows]);
	});

	it('⛔ an unavailable retained answer: the record names bytes the page cannot read, and the inspector is handed why — never an answer', async () => {
		// ⭑ The round's bytes kept in a store of its own, so the page's reader finds none of them. ⚠ Replies no other test sends:
		// the store keys bytes by their hash, and the page's store keeps what earlier tests' rounds put there.
		await runRound(
			{ [BUILD]: answering('kept elsewhere, Build'), [ROOT]: answering('kept elsewhere, Realize') },
			createInMemoryArtifactStore()
		);
		const s = await shown();
		for (const typeId of [BUILD, ROOT]) {
			const answer = reviewOf(s, typeId).answer;
			expect(answer, 'no record of the type’s call was handed').toBeDefined();
			expect(answer?.answer, 'an answer the page could not verify was handed').toBeUndefined();
			expect(answer?.disclosure).toContain('not RETAINED_BY_PARTICIPATION');
		}
	});

	it('⛔ a valid answer whose prose names another type stays under its own: the type its review was recorded about, never the one it names', async () => {
		await runRound({
			[BUILD]: answering('of the Realize type, whose decomposition this Build part serves'),
			[ROOT]: answering('Realize’s own reply')
		});
		const s = await shown();
		expect(reviewOf(s, BUILD).answer?.answer, 'the answer naming Realize left the type it is about').toBe(
			answering('of the Realize type, whose decomposition this Build part serves')
		);
		expect(reviewOf(s, ROOT).answer?.answer, 'the type the prose names was handed another type’s answer').toBe(
			answering('Realize’s own reply')
		);
	});
});
