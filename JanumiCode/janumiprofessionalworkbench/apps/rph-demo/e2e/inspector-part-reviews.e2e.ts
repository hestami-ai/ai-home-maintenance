import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	acceptAgentCandidate,
	registerStipulation,
	theRootPartOfTheLatestRound
} from './support/harness';
import { shot } from './support/gallery';

// ⭐⭐ `JAN-EXEC` Phase 7, THE REVIEW OF AN AUTHORED PWA IN PARTS, B5 (`REG-D-125`; DESIGN-authoring-review-in-parts.md D7; roadmap
// 9a.6) — THE INSPECTOR SHOWS EACH TYPE'S OWN REVIEW UNDER THAT TYPE, AND THE PWA ITS DETERMINISTIC POLICIES AND STRICTEST AGGREGATE.
//
// The floor reviews each type of an authored PWA as a part (B3). ⛔ The page showed one Reasoning Review row — the fold of every
// part — and under it the PWA's own reviewer answer, which a round in parts never records: the person accepting a candidate saw
// that the review failed, and not which type failed, on which criterion, or what the reviewer said of it. Now the read-only
// inspector shows, under the type it shows, that type's own review in the round the floor panel shows — its disposition, its
// criteria and what a test stipulated of them ⭐ (package C's check: each criterion by its id, its recorded result and any
// stipulation beside it), its findings ⭐ (each with the criterion it faults) and its reviewer's answer — beside F2's prompt
// display; and the floor panel lists the types' reviews beside the PWA's two deterministic policies and their strictest
// aggregate.
//
// ⭑ CONTROLS: a failed part beside a satisfied sibling; an incomplete round, a type the round holds no review of; an
// unavailable retained answer; a review whose round token joins no recorded call, beside an older round's call about the same
// type; and a newer round's own call, shown in place of the older round's. ⚠ The declared stand-in records no reviewer call, so
// every answer here is staged through the bus the UI uses (`/test-api/dispatch`), each with its bytes disclosed as not retained:
// a VERIFIED answer, and one whose prose names another type, are the load's (`src/lib/server/pwa-type-reviews.test.ts`).

const ROOT_TEXT = ['Synthesize the realized product from its parts.', '  Cite what each part produced.'].join('\n');
/** The finding the structural checker records against a type whose output feeds no consumer (`judgePwaTypePart`). */
const DEAD_END = '1 output(s) this type produces feed no consumer (dead-end).';
/** ⭐ Package C's check — the one criterion that checker judges, the dead-end check (`RR_PROXY`); the test stipulates the rest. */
const JUDGED = 'RR-04-no-proxy-satisfaction';
/** What a criterion row the test stipulated says beside its id. */
const STIPULATED_ROW = 'UNABLE_TO_DETERMINE · stipulated MET by the test, not reviewed';

/** Select a node, and wait until the inspector shows that type. */
async function inspect(page: Page, name: string): Promise<void> {
	await page.locator('.svelte-flow__node').filter({ hasText: name }).click();
	await expect(page.getByTestId('inspector-panel').getByRole('heading', { name, exact: true })).toBeVisible();
}

/** A draft PWA, created through the home page, its id read from the store and the test's stipulation registered for it. */
async function createDraft(page: Page, request: APIRequestContext, name: string): Promise<{ pwaId: string; href: string }> {
	await gotoHydrated(page, '/');
	await page.getByRole('button', { name: '+ New PWA' }).click();
	await page.getByPlaceholder(/PWA name/i).fill(name);
	await page.getByRole('button', { name: 'Create draft' }).click();
	const card = page.getByRole('link', { name: new RegExp(name) });
	await expect(card).toBeVisible();
	const pwaId = (await introspect(request)).pwas.find((p) => p.state.name === name)!.id;
	// ⭐ THE TEST STIPULATES THE REVIEW'S REMAINDER (`JAN-CRITREAD` J1-3), in the body, after the reset, the id read from the store.
	await registerStipulation(request, pwaId, 'PWA_TYPE');
	return { pwaId, href: (await card.getAttribute('href'))! };
}

/** The scaffold of a root over one child, the child producing `childOutputs`. */
const scaffold = (childOutputs: string[]) => ({
	plan: [
		{
			tool: 'scaffold_graph',
			args: {
				types: [
					{
						tempKey: 'root',
						name: 'Product Realization',
						pwuKind: 'PRODUCT_REALIZATION',
						isRoot: true,
						workDischarge: 'MODEL',
						promptTemplateText: ROOT_TEXT,
						promptActive: true,
						childTempKeys: ['arch']
					},
					{ tempKey: 'arch', name: 'Architecture Definition', pwuKind: 'ARCHITECTURE', requiredOutputs: childOutputs }
				]
			}
		}
	]
});

/** A clean candidate accepted: canonical then holds its floor, one round reviewing both types. */
async function acceptedClean(page: Page, request: APIRequestContext, name: string): Promise<string> {
	const { pwaId } = await createDraft(page, request, name);
	const res = await request.post(`/pwa/${pwaId}/agent`, { data: { instruction: JSON.stringify(scaffold([])) } });
	const body = await res.text();
	expect(body, 'arrangement: the clean candidate is not assured').toContain('Assurance floor SATISFIED');
	await acceptAgentCandidate(request, pwaId, body);
	return pwaId;
}

/** Dispatch `steps` through the bus the UI uses, under `correlationId` when given; every step must be accepted. */
async function dispatchSteps(
	request: APIRequestContext,
	steps: readonly (readonly [string, string, string, Record<string, unknown>])[],
	correlationId?: string
): Promise<void> {
	const res = await request.post('/test-api/dispatch', { data: { steps, ...(correlationId ? { correlationId } : {}) } });
	const outcome = (await res.json()) as { ok: boolean };
	expect(outcome.ok, `staging must succeed: ${JSON.stringify(outcome)}`).toBeTruthy();
}

/**
 * One reviewer call about `subjectId` in the floor run `runToken` names, as the floor's drain records it — its answer's bytes
 * DISCLOSED AS NOT RETAINED, `reason` saying why: the page's reader can show no answer, only why it shows none.
 */
async function stageReviewerCall(
	request: APIRequestContext,
	call: { readonly exchangeId: string; readonly subjectId: string; readonly version: number; readonly runToken: string; readonly reason: string }
): Promise<void> {
	const pending = (reason: string) => ({ status: 'PENDING_CONTENT_PLANE', reason });
	const unprobed = { availability: 'NOT_PROBED', evidence: 'NONE', rationale: 'staged by the test: no model was called' };
	await dispatchSteps(
		request,
		[
			[
				'RecordModelExchange',
				'MODEL_EXCHANGE',
				call.exchangeId,
				{
					exchangeId: call.exchangeId,
					exchangeRole: 'INITIAL',
					attemptOrdinal: 1,
					runToken: call.runToken,
					plane: 'ASSURANCE',
					invokerId: 'e2e.staged-reviewer',
					assurancePolicyId: 'floor.reasoning-review',
					subjectObjectId: call.subjectId,
					subjectObjectType: 'PWU_TYPE',
					subjectSemanticVersion: call.version,
					resolvedProvider: unprobed,
					resolvedModel: unprobed,
					resolvedModelVersion: unprobed,
					materializedInputRef: pending('staged by the test: no prompt was sent'),
					rawOutputBeforeCoercionRef: pending('staged by the test: no reply arrived'),
					answerSpanRef: pending(call.reason),
					volunteeredReasoningRef: pending('staged by the test: no reply arrived'),
					inputRedactionManifestRef: pending('staged by the test: no prompt was sent'),
					redactionState: 'NOT_IMPLEMENTED',
					inputTruncation: 'NONE_DECLARED',
					outputTruncation: 'NONE_DECLARED',
					omittedRegions: [],
					disposition: 'ACCEPTED',
					parseOutcome: { outcome: 'PARSED', detail: '' },
					requestedAt: '2026-10-24T00:00:00Z',
					respondedAt: '2026-10-24T00:00:01Z',
					workProductDerivation: {
						relation: 'NO_WORK_PRODUCT_EXPECTED',
						reason: 'staged by the test: a review answers criteria and produces no work product'
					},
					observedToolCalls: { observation: 'NOT_OBSERVABLE', reason: 'staged by the test: no tool ran' }
				}
			]
		],
		call.runToken
	);
}

/** A Reasoning Review of `subjectId` in the floor run `runToken` names, concluded REJECTED with one finding. */
async function stageRejectedReview(
	request: APIRequestContext,
	review: { readonly subjectId: string; readonly version: number; readonly runToken: string; readonly statement: string }
): Promise<void> {
	const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5PB1';
	const subject = { subjectObjectIds: [review.subjectId], subjectSemanticVersions: { [review.subjectId]: review.version } };
	const observation = { findingCode: 'RR-04', severity: 'BLOCKING', statement: review.statement };
	await dispatchSteps(
		request,
		[
			[
				'RequestAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{ assessmentId, assurancePolicyId: 'floor.reasoning-review', policyVersion: '1', ...subject, claimIds: [] }
			],
			['BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}],
			[
				'RecordAssuranceObservation',
				'ASSURANCE_OBSERVATION',
				'obs_01ARZ3NDEKTSV4RRFFQ69G5PB2',
				{ assessmentId, observationType: 'FINDING', ...observation }
			],
			[
				'CompleteAssuranceAssessment',
				'ASSURANCE_ASSESSMENT',
				assessmentId,
				{
					validatorResult: {
						validatorId: 'e2e.staged-floor.reasoning-review',
						validatorVersion: '1',
						policyId: 'floor.reasoning-review',
						policyVersion: '1',
						assessmentId,
						...subject,
						claimResults: [],
						evidenceConsideredIds: [],
						evidenceRejected: [],
						observations: [{ ...observation, subjectObjectIds: [review.subjectId] }],
						dispositionRecommendation: 'REJECTED',
						recommendedControlActions: [],
						residualUncertainty: [],
						limitations: [],
						executionProvenance: {}
					}
				}
			]
		],
		review.runToken
	);
}

test.describe('PWA Designer — the inspector shows each type’s own review, and the PWA its policies and strictest aggregate (the review in parts, B5)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	// ⛔ PREDICTED RED, read from the code: the inspector showed no review at all, and the floor panel one Reasoning Review row,
	// the fold of every part, with the PWA's reviewer answer under it, which a round in parts never records.
	test('⭐ RED — with a candidate staged, a failed part beside a satisfied sibling: each type’s own review under it, the PWA’s policies and strictest aggregate at the PWA, F2’s prompt kept', async ({
		page,
		request
	}) => {
		const { pwaId, href } = await createDraft(page, request, 'Inspector Part Reviews');
		await gotoHydrated(page, href);
		await page.getByTestId('agent-input').fill(JSON.stringify(scaffold(['architecture-baseline'])));
		await page.getByRole('button', { name: 'Send' }).click();
		// Arrangement: the candidate is staged, its child's output a dead end the checker faults, canonical unchanged.
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('REVISION_REQUIRED', { timeout: 15_000 });
		expect((await introspect(request)).pwuTypes.filter((t) => t.state.pwaId === pwaId), 'arrangement: canonical holds the types').toEqual([]);

		// ⭐ AT THE PWA: its two deterministic policies passed, and its aggregate is the strictest — the failed part's.
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.locator('ul.floorpolicies li.ok')).toHaveCount(2);
		const parts = page.getByTestId('floor-part');
		await expect(parts).toHaveCount(2);
		await expect(parts.nth(0)).toContainText('Product Realization');
		await expect(parts.nth(0)).toContainText('SATISFIED');
		await expect(parts.nth(1)).toContainText('Architecture Definition');
		await expect(parts.nth(1)).toContainText('REJECTED');

		// ⭐ UNDER THE SATISFIED SIBLING: its own review, and nothing of the failed part's.
		const review = page.getByTestId('inspector-review');
		await inspect(page, 'Product Realization');
		await expect(review.getByTestId('inspector-review-disposition')).toHaveText('SATISFIED');
		await expect(review.getByTestId('inspector-review-criteria')).toHaveText('1 criteria evaluated · 8 stipulated by the test, not reviewed');
		// ⭐ Package C's check (roadmap 9a.6, "criterion results") — each criterion by its id: the one the checker judged, with its
		// result, and each the test stipulated, said so beside its result.
		const rows = review.getByTestId('inspector-review-criterion-results').locator('li');
		await expect(rows).toHaveCount(9);
		await expect(rows.filter({ hasText: JUDGED })).toHaveText(`${JUDGED} MET`);
		await expect(rows.filter({ hasText: STIPULATED_ROW })).toHaveCount(8);
		await expect(review.getByTestId('inspector-review-findings')).toHaveCount(0);
		await expect(review.getByTestId('inspector-review-no-findings')).toBeVisible();
		await expect(review.getByTestId('inspector-review-answer-none')).toBeVisible();
		// ⭑ F2's prompt display kept, beside the review.
		await expect(page.getByTestId('inspector-prompt-text')).toHaveJSProperty('textContent', ROOT_TEXT);

		// ⭐ UNDER THE FAILED PART: its rejection, its finding ⭐ with the criterion it faults, its criteria ⭐ and the one it failed on.
		await inspect(page, 'Architecture Definition');
		await expect(review.getByTestId('inspector-review-disposition')).toHaveText('REJECTED');
		await expect(review.getByTestId('inspector-review-findings').locator('li')).toHaveText([`${JUDGED} ${DEAD_END}`]);
		await expect(review.getByTestId('inspector-review-criteria')).toHaveText('1 criteria evaluated · 8 stipulated by the test, not reviewed');
		await expect(rows).toHaveCount(9);
		await expect(rows.filter({ hasText: JUDGED }), 'the criterion it failed on is not said').toHaveText(`${JUDGED} NOT_MET`);
		await expect(rows.filter({ hasText: STIPULATED_ROW })).toHaveCount(8);
		await review.scrollIntoViewIfNeeded();
		await shot(page, 'inspector shows a failed part’s own review');
	});

	test('⛔ an incomplete round: a type the shown round holds no review of is said NOT REVIEWED under it and at the PWA, and the floor is not satisfied', async ({
		page,
		request
	}) => {
		const pwaId = await acceptedClean(page, request, 'Inspector Incomplete Round');
		// ⭑ A type defined on canonical after the round: the round holds no review of it.
		const typeId = 'pwut_01ARZ3NDEKTSV4RRFFQ69G5PA1';
		await dispatchSteps(request, [
			[
				'DefinePwuType',
				'PWU_TYPE',
				typeId,
				{
					pwuTypeId: typeId,
					pwaId,
					pwuKind: 'RELEASE_APPROVAL',
					name: 'Release Check',
					purpose: 'Check the release',
					isRoot: false,
					permittedChildTypeIds: [],
					requiredInputs: [],
					requiredOutputs: [],
					requiredAssurancePolicyIds: []
				}
			]
		]);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).not.toContainText('SATISFIED');
		const parts = page.getByTestId('floor-part');
		await expect(parts).toHaveCount(3);
		const missing = parts.filter({ hasText: 'Release Check' });
		await expect(missing).toContainText('NOT REVIEWED');
		// ⭑ Selected from the floor panel's list, the type opens in the inspector, its review said to be missing.
		await missing.getByRole('button', { name: 'Release Check' }).click();
		await expect(page.getByTestId('inspector-panel').getByRole('heading', { name: 'Release Check', exact: true })).toBeVisible();
		const review = page.getByTestId('inspector-review');
		await expect(review.getByTestId('inspector-review-missing')).toContainText('NOT REVIEWED');
		await expect(review.getByTestId('inspector-review-missing')).toContainText('holds no review of this type');
		await expect(review.getByTestId('inspector-review-disposition')).toHaveCount(0);
		// ⭑ CONTROL — the round's reviewed types keep their own reviews.
		await inspect(page, 'Product Realization');
		await expect(review.getByTestId('inspector-review-disposition')).toHaveText('SATISFIED');
	});

	test('⛔ each type’s answer is its review’s, in the round shown: unretained bytes are said to be so; a newer round whose token joins no call shows none, never the older round’s; that round’s own call, once recorded, is shown in its place', async ({
		page,
		request
	}) => {
		const pwaId = await acceptedClean(page, request, 'Inspector Part Answers');
		const root = await theRootPartOfTheLatestRound(request, pwaId);
		const review = page.getByTestId('inspector-review');
		const ROUND_ONE = 'staged in round one: no bytes were kept for this answer';
		const ROUND_TWO = 'staged in round two: no bytes were kept for this answer';

		// ⭐ AN UNAVAILABLE RETAINED ANSWER: the round's call about the root, its bytes not retained — the panel says why.
		await stageReviewerCall(request, {
			exchangeId: 'mex_01ARZ3NDEKTSV4RRFFQ69G5PC1',
			subjectId: root.typeId,
			version: root.version,
			runToken: root.correlationId,
			reason: ROUND_ONE
		});
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await inspect(page, 'Product Realization');
		const answer = review.getByTestId('inspector-review-answer');
		await expect(answer).toBeVisible();
		// ⭐ Package E, E4 — WHOLE, so a disclosure naming no exchange (`not retained for undefined`) fails here.
		await expect(answer.locator('.revansnote')).toHaveText(`The answer span was not retained for mex_01ARZ3NDEKTSV4RRFFQ69G5PC1: ${ROUND_ONE}`);
		await expect(answer.locator('.revanstext'), 'bytes the page could not read were shown as the answer').toHaveCount(0);
		// ⭑ CONTROL — the sibling's review made no call in the round, and none is shown under it.
		await inspect(page, 'Architecture Definition');
		await expect(review.getByTestId('inspector-review-answer-none')).toBeVisible();

		// ⛔ A NEWER ROUND, ITS ROOT'S REVIEW RECORDED UNDER A TOKEN NO CALL CARRIES: no answer, never the older round's.
		const roundTwo = 'authoring-floor:sha256:e2e-round-two:floorrun_e2e';
		await stageRejectedReview(request, {
			subjectId: root.typeId,
			version: root.version,
			runToken: roundTwo,
			statement: 'Staged finding of round two.'
		});
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await inspect(page, 'Product Realization');
		await expect(review.getByTestId('inspector-review-disposition'), 'arrangement: the round shown is the newer one').toHaveText('REJECTED');
		// ⭐ Package C's check — the finding with the criterion it faults: the staged observation's code.
		await expect(review.getByTestId('inspector-review-findings').locator('li')).toHaveText(['RR-04 Staged finding of round two.']);
		await expect(review.getByTestId('inspector-review-answer-none'), 'the older round’s call was shown under the newer round’s review').toBeVisible();
		await expect(review).not.toContainText(ROUND_ONE);

		// ⭐ THE NEWER ROUND'S OWN CALL, once recorded, is the one shown.
		await stageReviewerCall(request, {
			exchangeId: 'mex_01ARZ3NDEKTSV4RRFFQ69G5PC2',
			subjectId: root.typeId,
			version: root.version,
			runToken: roundTwo,
			reason: ROUND_TWO
		});
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await inspect(page, 'Product Realization');
		await expect(review.getByTestId('inspector-review-answer').locator('.revansnote')).toHaveText(
			`The answer span was not retained for mex_01ARZ3NDEKTSV4RRFFQ69G5PC2: ${ROUND_TWO}`
		);
		await expect(review).not.toContainText(ROUND_ONE);
	});
});
