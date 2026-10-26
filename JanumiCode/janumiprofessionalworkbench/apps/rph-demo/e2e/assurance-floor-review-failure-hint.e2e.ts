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
import { expectTheHintOnScreen } from './support/floor-panel';

// ⭐ `JAN-SELRES` D8 (`REG-F-462`), AS REVISED IN RS-3 — THE BLOCKED HINT FOLLOWS THE FLOOR'S OWN CLASSIFIER: BESIDE A
// BLOCK REVISING THE GRAPH DOES NOT ANSWER, IT DOES NOT SAY "REVISE THE GRAPH", AND BESIDE ONE REVISING ANSWERS ONLY IN
// PART, IT SAYS WHICH PART.
//
// ⛔ WHAT WAS WRONG. `routes/pwa/[id]/+page.svelte`'s blocked hint read *"Publishing is blocked until the floor is
// SATISFIED — revise the graph and re-run."* on EVERY unsatisfied floor. Beside a review that did not execute, the
// guidance the same floor carries says *"Do not revise the PWA or record a waiver in response to this execution
// failure"* (`lib/server/floor.ts`) — so the page told the operator to do what the record says will not help, and a
// revision re-runs the same broken reviewer. RS-3 first keyed the hint on the recorded CODES, and that left "revise"
// beside every block the classifier answers without one — an incomplete review, an escalation, a missing result.
//
// ⭑ WHAT MUST HOLD. Where `classifyFloorRemediation` answers the block with an operational action, the hint reads the
// revised D8 sentence — asserted whole and positively — names no waiver (ASR-3), and does not say "revise the graph and
// re-run"; a waiver recorded through the page's own form does not turn it back. Where a schema/invariant or
// identity/provenance policy ALSO rejected the graph, the hint says to revise the graph for those findings AND that the
// review reached no verdict revising can answer — a two-way hint said "revising it does not address this" there (the
// RS-3 re-verifier's MAJOR). Where the classifier answers a SUBJECT finding, the hint still says "revise the graph and
// re-run", whole: that is this spec's CONTROL, the last test.
//
// ⭑ TWO ARRANGEMENTS, AND THE SECOND IS THE PRODUCT'S. (1) The waiver spec's: a SATISFIED candidate is accepted, so the
// floor on screen is CANONICAL with no fork in play, then a fresh reasoning-review assessment is posted through
// `/test-api/dispatch` — the bus the UI uses. (2) `resume-hint.e2e.ts`'s: an unregistered draft is authored in the
// default lane and its review stages BLOCKED_EXTERNAL, INCOMPLETE — the floor on screen is the candidate's FORK, and
// canonical holds none. In the product a failed or incomplete review reaches this page only that way: the floor runs on
// an authoring turn, and only a satisfied candidate is accepted.
//
// ⭐ `JAN-ESCREC` D3 (the third fix round's re-verifier's finding [0], ruled) — AND EACH HINT IS WHOLLY ON SCREEN, beside
// every review staged here, the waived one included (`expectTheHintOnScreen`). The reasoning-review findings rendered above
// the hint in the capped floor panel, and at the lane's default 1280x720 they pushed it below the panel's fold: 24 of its
// 101px were on screen beside a review that did not execute, none once a waiver was recorded (measured by ER-1's third fix
// round). The hint now renders FIRST in the panel's body, before the floor's own head — whose "waiver recorded" badge
// wraps — and its policy list.
const POLICY = 'floor.reasoning-review';
const POLICY_VERSION = '1';

/** D8's sentence as revised in RS-3 (`DESIGN-the-selection-residuals.md` D8), whole. */
const NOT_ANSWERED_BY_REVISION_HINT =
	"Publishing is blocked until the floor is SATISFIED — the Reasoning Review did not reach a verdict that revising the graph can answer, so revising it does not address this. Run assurance again once the review's own cause is addressed.";

/** The hint beside an operational review AND a non-review policy that REJECTED the graph (`floorBlockedHint`), whole. */
const REVISE_AND_REVIEW_HINT =
	"Publishing is blocked until the floor is SATISFIED — revise the graph for the findings the floor records against it; the Reasoning Review itself did not reach a verdict that revising can answer, so run assurance again once the review's own cause is addressed.";

/** The hint beside a block revising DOES answer — unchanged since `REG-F-202`, whole. */
const REVISE_HINT =
	'Publishing is blocked until the floor is SATISFIED — revise the graph and re-run.';

/** What a Validator that did not execute records — a statement the operator can act on, and no subject finding. */
const EXECUTION_FAILED_STATEMENT =
	'The reviewing tool did not run: JPWB_ASSURANCE_MODEL is not set (staged execution failure).';
const EXECUTION_FAILED = {
	findingCode: 'VALIDATOR_EXECUTION_FAILED',
	severity: 'MATERIAL',
	statement: EXECUTION_FAILED_STATEMENT
};

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L2's check, finding 2 (`REG-F-580`; design D20) — what a round the authoring review's
 * allowance stopped records for each of its parts (`floor.ts` `allowanceStoppedRegistry`): the stated reason under the
 * execution failure, FIRST, and beside it its own code (`VALIDATOR_ALLOWANCE_STOPPED`, `rph-assurance` D6), whose statement
 * is the product's (`assurance/review-allowance.ts` `ALLOWANCE_STOPPED_NO_REVIEWER_FAILED`).
 */
const ALLOWANCE_STOP_REASON = {
	findingCode: 'VALIDATOR_EXECUTION_FAILED',
	severity: 'MATERIAL',
	statement:
		'No reviewer call was made for this type: the authoring review’s allowance stopped its round before the round’s first call (staged allowance stop).'
};
const ALLOWANCE_STOPPED = {
	findingCode: 'VALIDATOR_ALLOWANCE_STOPPED',
	severity: 'MATERIAL',
	statement:
		'No reviewer failed: the authoring review’s allowance (JPWB_AUTHORING_REVIEW_ALLOWANCE) stopped this review before any reviewer call, so retrying, configuring or changing the reviewer does not change it (REG-F-580; design D20).'
};
/** ⭐⭐ The hint beside a round the allowance stopped (`floorBlockedHint`, `'FIT_THE_ALLOWANCE'`), whole. */
const FIT_THE_ALLOWANCE_HINT =
	'Publishing is blocked until the floor is SATISFIED — the authoring review’s allowance stopped the Reasoning Review before its first reviewer call, so no type was reviewed; retrying or changing the reviewer does not address this. Revise the graph for any findings the floor records against it. The review runs once its round fits the allowance: an allowance that holds it, set when the server starts, or a candidate with fewer types.';

/** What the schema/invariant policy records against a graph that is not well formed (`floor.ts` `runPwaFloor`). */
const NOT_WELL_FORMED = {
	findingCode: 'PWA_GRAPH_NOT_WELL_FORMED',
	severity: 'BLOCKING',
	statement: 'Deterministic invariant violated: PWA_GRAPH_NOT_WELL_FORMED'
};

/** A SUBJECT finding — the one the waiver spec's revision test concludes REJECTED. */
const SUBJECT_FINDING = {
	findingCode: 'RR-04',
	severity: 'BLOCKING',
	statement: 'Staged blocking reasoning-review finding.'
};

test.describe('Assurance floor — the blocked hint follows the floor’s own classifier', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	async function draftWithSatisfiedFloor(
		page: Page,
		request: APIRequestContext,
		name: string
	): Promise<string> {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill(name);
		await page.getByRole('button', { name: 'Create draft' }).click();
		await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
		const pwaId = (await introspect(request)).pwas[0]!.id;
		// ⭐ THE TEST STIPULATES THE REVIEW'S REMAINDER (`JAN-CRITREAD` J1-3), in the body, after the reset, with the PWA's
		// id READ FROM THE STORE — as the waiver spec does. The SATISFIED floor below is disclosed as stipulated.
		await registerStipulation(request, pwaId, 'PWA_TYPE');

		const res = await request.post(`/pwa/${pwaId}/agent`, {
			data: {
				instruction: JSON.stringify({
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
										childTempKeys: ['arch']
									},
									{ tempKey: 'arch', name: 'Architecture Definition', pwuKind: 'ARCHITECTURE' }
								]
							}
						}
					]
				})
			}
		});
		const body = await res.text();
		expect(body).toContain('Assurance floor SATISFIED');
		await acceptAgentCandidate(request, pwaId, body);
		// The fork is gone: the panel below reads the canonical store the staging writes to.
		expect((await introspect(request)).authoringCandidates).toEqual([]);
		return pwaId;
	}

	/**
	 * Record one assessment of `policyId` against the PWA — its LATEST, so the one the panel reads — carrying one
	 * observation and CONCLUDED with the disposition given. The verdict is in DOC-007 §20's sixteen-field shape, without
	 * the evaluator and criterion rows the floor's own recorder also sends (`rph-engine` `record-assurance.ts`); no
	 * producer is named, so no independence is checked. The observation type is the recorder's for the policy.
	 * ⭐ The review in parts, B3 (`REG-D-125`): a REASONING REVIEW is staged against the PWA's root type, its part, and every
	 * assessment INTO the accepted floor's round (`theRootPartOfTheLatestRound`), so the rest of the round stays as recorded.
	 */
	async function stageAnAssessment(
		request: APIRequestContext,
		pwaId: string,
		staged: {
			readonly policyId: string;
			readonly assessmentId: string;
			readonly observationId: string;
			readonly observation: typeof EXECUTION_FAILED;
			readonly concludeAs: 'REJECTED' | 'INCONCLUSIVE';
			/** ⭐ Package E, E1 — a reasoning review of this type, named, in place of the root's. */
			readonly onType?: string;
			/** ⭐⭐ Package L2's check, finding 2 — a second observation, recorded after the first, as a carried failure is. */
			readonly also?: { readonly observationId: string; readonly observation: typeof EXECUTION_FAILED };
		}
	): Promise<void> {
		const { policyId, assessmentId, observationId, observation, concludeAs } = staged;
		const observed = [
			{ observationId, observation },
			...(staged.also === undefined ? [] : [staged.also])
		];
		const snapshot = await introspect(request);
		const pwa = snapshot.pwas.find((p) => p.id === pwaId)!;
		const part = await theRootPartOfTheLatestRound(request, pwaId);
		const named = snapshot.pwuTypes.find((t) => t.state.pwaId === pwaId && t.state.name === staged.onType);
		const reviewed = named === undefined ? part : { typeId: named.id, version: Number(named.state.semanticVersion ?? 1) };
		const subjectId = policyId === POLICY ? reviewed.typeId : pwaId;
		const version = policyId === POLICY ? reviewed.version : Number(pwa.state.semanticVersion ?? 1);
		const res = await request.post('/test-api/dispatch', {
			data: {
				correlationId: part.correlationId,
				steps: [
					[
						'RequestAssuranceAssessment',
						'ASSURANCE_ASSESSMENT',
						assessmentId,
						{
							assessmentId,
							assurancePolicyId: policyId,
							policyVersion: POLICY_VERSION,
							subjectObjectIds: [subjectId],
							subjectSemanticVersions: { [subjectId]: version },
							claimIds: []
						}
					],
					['BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}],
					// ⭐⭐ Package L2's check, finding 2 — each observation in order: the first, then any `also`.
					...observed.map((o) => [
						'RecordAssuranceObservation',
						'ASSURANCE_OBSERVATION',
						o.observationId,
						{
							assessmentId,
							observationType: policyId === POLICY ? 'FINDING' : 'POLICY_VIOLATION',
							...o.observation
						}
					]),
					[
						'CompleteAssuranceAssessment',
						'ASSURANCE_ASSESSMENT',
						assessmentId,
						{
							validatorResult: {
								validatorId: `e2e.staged-${policyId}`,
								validatorVersion: '1',
								policyId,
								policyVersion: POLICY_VERSION,
								assessmentId,
								subjectObjectIds: [subjectId],
								subjectSemanticVersions: { [subjectId]: version },
								claimResults: [],
								evidenceConsideredIds: [],
								evidenceRejected: [],
								observations: observed.map((o) => ({ ...o.observation, subjectObjectIds: [subjectId] })),
								dispositionRecommendation: concludeAs,
								recommendedControlActions: [],
								residualUncertainty: [],
								limitations: [],
								executionProvenance: {}
							}
						}
					]
				]
			}
		});
		const outcome = (await res.json()) as { ok: boolean; results: { status: string }[] };
		expect(outcome.ok, `staging must succeed: ${JSON.stringify(outcome)}`).toBeTruthy();
	}

	/** The reasoning review's latest assessment, carrying one observation, concluded as given. */
	async function stageAReview(
		request: APIRequestContext,
		pwaId: string,
		observation: typeof EXECUTION_FAILED,
		concludeAs: 'REJECTED' | 'INCONCLUSIVE'
	): Promise<void> {
		await stageAnAssessment(request, pwaId, {
			policyId: POLICY,
			assessmentId: 'assess_01ARZ3NDEKTSV4RRFFQ69G5FB1',
			observationId: 'obs_01ARZ3NDEKTSV4RRFFQ69G5FB2',
			observation,
			concludeAs
		});
	}

	/** The schema/invariant policy's latest assessment REJECTS the graph: a defect revising answers. */
	async function stageAGraphRejection(request: APIRequestContext, pwaId: string): Promise<void> {
		await stageAnAssessment(request, pwaId, {
			policyId: 'floor.schema-invariant',
			assessmentId: 'assess_01ARZ3NDEKTSV4RRFFQ69G5FC1',
			observationId: 'obs_01ARZ3NDEKTSV4RRFFQ69G5FC2',
			observation: NOT_WELL_FORMED,
			concludeAs: 'REJECTED'
		});
	}

	test('a review that did not execute: the hint says revising the graph does not address it, and names no waiver', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Review Failure Hint');
		// Concluded INCONCLUSIVE, as the floor completes a validator that threw (`rph-assurance` `failedResult`); the
		// classifier's execution-failure branch answers it whatever the disposition.
		await stageAReview(request, pwaId, EXECUTION_FAILED, 'INCONCLUSIVE');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the floor on screen is the blocked one, and the review's own finding is on the panel.
		await expect(page.getByTestId('assurance-disposition')).not.toContainText('SATISFIED');
		await expect(page.locator('ul.floorgaps')).toContainText(EXECUTION_FAILED_STATEMENT);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		// ⭐ THE CLAIM, POSITIVELY AND WHOLE: D8's sentence and nothing else.
		await expect(hint).toHaveText(NOT_ANSWERED_BY_REVISION_HINT);
		// ⛔ NOT THE ROUTE THE RECORD RULES OUT, AND NO ROUTE PAST THE FLOOR (ASR-3).
		await expect(hint).not.toContainText('revise the graph and re-run');
		await expect(hint).not.toContainText(/waiv/i);
		// ⭐ AND ON SCREEN, though the review's finding is listed too.
		await expectTheHintOnScreen(page);
	});

	// ⭐⭐ `JAN-EXEC` Phase 7, package L2's check, finding 2 (`REG-F-580`; design D20) — A ROUND THE AUTHORING REVIEW'S ALLOWANCE
	// STOPPED. ⛔ It read the sentence above, "revising it does not address this. Run assurance again once the review's own cause
	// is addressed": false — a candidate with fewer types can fit what is left — and the review's cause is no reviewer's, so a
	// re-run under the same allowance is stopped again. ⭑ Staged as the product records it: EVERY part of the round stopped,
	// each with the stated reason first and its own code beside it. ⛔ PREDICTED RED, read from the code at de18c9e0: the
	// classifier had no branch for the code, so this floor read NOT_BY_REVISION's sentence.
	test('⭐⭐ a round the authoring review’s allowance stopped: the hint says no reviewer failed and what lets the review run, whole — never that revising does not address it', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Allowance Stop Hint');
		for (const [n, onType] of [
			[1, undefined],
			[2, 'Architecture Definition']
		] as const)
			await stageAnAssessment(request, pwaId, {
				policyId: POLICY,
				assessmentId: `assess_01ARZ3NDEKTSV4RRFFQ69G5FE${n}`,
				observationId: `obs_01ARZ3NDEKTSV4RRFFQ69G5FF${n}`,
				observation: ALLOWANCE_STOP_REASON,
				also: { observationId: `obs_01ARZ3NDEKTSV4RRFFQ69G5FG${n}`, observation: ALLOWANCE_STOPPED },
				concludeAs: 'INCONCLUSIVE',
				...(onType === undefined ? {} : { onType })
			});

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the floor on screen is the stopped one, and each part's reason and code are on the panel.
		await expect(page.getByTestId('assurance-disposition')).not.toContainText('SATISFIED');
		await expect(page.locator('ul.floorgaps')).toContainText(ALLOWANCE_STOP_REASON.statement);
		await expect(page.locator('ul.floorgaps')).toContainText(ALLOWANCE_STOPPED.statement);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		// ⭐ THE CLAIM, POSITIVELY AND WHOLE.
		await expect(hint).toHaveText(FIT_THE_ALLOWANCE_HINT);
		// ⛔ Not the sentence that is false of it, and no route past the floor (ASR-3).
		await expect(hint).not.toContainText('revising it does not address this');
		await expect(hint).not.toContainText(/waiv/i);
		await expectTheHintOnScreen(page);
	});

	test('⭐ a staged candidate whose review is INCOMPLETE — the page a professional sees: the hint beside the banner says revising does not address it', async ({
		page,
		request
	}) => {
		// `resume-hint.e2e.ts`'s arrangement: nothing registered, so the declared stand-in cannot settle the criteria the
		// structural checker cannot answer, and the review comes back incomplete with no subject finding.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Floor Incomplete Review Hint');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Floor Incomplete Review Hint/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		const plan = {
			plan: [
				{
					tool: 'scaffold_graph',
					args: { types: [{ tempKey: 'plan', name: 'Plan', pwuKind: 'PLAN', isRoot: true }] }
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		// Arrangement: the candidate is staged BLOCKED_EXTERNAL with the classifier's incomplete-review guidance, and the
		// floor on screen is the FORK's — canonical holds no reasoning review, and the fork's recorded no finding.
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('BLOCKED_EXTERNAL');
		await expect(page.getByTestId('candidate-resume-hint')).toContainText(
			'Do not revise the PWA or record a waiver merely to clear an incomplete review'
		);
		const snapshot = await introspect(request);
		const reasoningReviews = (rows: readonly { state: Record<string, unknown> }[]) =>
			rows.filter((a) => a.state.assurancePolicyId === POLICY).map((a) => a.state.assessmentState);
		expect(
			reasoningReviews(snapshot.assessments),
			'arrangement: canonical holds a reasoning review, so this case could not tell the fork from canonical'
		).toEqual([]);
		expect(
			snapshot.authoringCandidates.map((c) => reasoningReviews(c.assessments)),
			'arrangement: the fork does not hold one incomplete reasoning review'
		).toEqual([['INCONCLUSIVE']]);
		await expect(page.locator('ul.floorgaps')).toHaveCount(0);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		// ⭐ THE CLAIM, POSITIVELY AND WHOLE, beside the banner whose guidance says not to revise the PWA.
		await expect(hint).toHaveText(NOT_ANSWERED_BY_REVISION_HINT);
		await expect(hint).not.toContainText('revise the graph and re-run');
		await expect(hint).not.toContainText(/waiv/i);
		await expectTheHintOnScreen(page);
	});

	test('⭐ a review that did not execute BESIDE a schema policy that rejected the graph: the hint says revise the graph for its findings AND run the review again, whole', async ({
		page,
		request
	}) => {
		// The canonical form of FD3/FD4 (the RS-3 re-verifier's MAJOR): the classifier answers the REVIEW operationally,
		// and a two-way hint said "revising it does not address this" beside a graph defect revising does address.
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Revise And Review Hint');
		await stageAGraphRejection(request, pwaId);
		await stageAReview(request, pwaId, EXECUTION_FAILED, 'INCONCLUSIVE');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the schema policy rejected the graph, the review did not execute, and its finding is on the panel.
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.locator('ul.floorpolicies li.bad')).toHaveCount(1);
		await expect(page.locator('ul.floorgaps')).toContainText(EXECUTION_FAILED_STATEMENT);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		// ⭐ THE CLAIM, POSITIVELY AND WHOLE: both halves, and no route past the floor (ASR-3).
		await expect(hint).toHaveText(REVISE_AND_REVIEW_HINT);
		await expect(hint).not.toContainText('revise the graph and re-run');
		await expect(hint).not.toContainText(/waiv/i);
		await expectTheHintOnScreen(page);
	});

	test('⭐ a waiver recorded through the page’s form does not turn the hint back to "revise the graph": revising still does not address the block', async ({
		page,
		request
	}) => {
		// ASR-3: a waiver moves nothing, so it may not move this sentence either. A hint that yielded to `data.floor.waived`
		// would put "revise the graph and re-run" back beside a review that did not execute (the RS-3 re-verifier's N1, N2).
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Waived Review Failure Hint');
		await stageAReview(request, pwaId, EXECUTION_FAILED, 'INCONCLUSIVE');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await page
			.locator('form.floorwaiver input[name="rationale"]')
			.fill('Accepted: the reviewer outage is understood and owned.');
		await page.locator('form.floorwaiver').getByRole('button').click();
		await expect
			.poll(async () =>
				(await introspect(request)).decisions.map(
					(d) => `${String(d.state.decisionType)}/${String(d.state.status)}`
				)
			)
			.toEqual(['WAIVER/EFFECTIVE']);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the page reads the waiver, and the floor it shows is still the blocked one.
		await expect(page.getByTestId('assurance-waived')).toBeVisible();
		await expect(page.locator('ul.floorgaps')).toContainText(EXECUTION_FAILED_STATEMENT);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		await expect(hint).toHaveText(NOT_ANSWERED_BY_REVISION_HINT);
		await expect(hint).not.toContainText(/waiv/i);
		// ⭐ AND ON SCREEN beside the waived floor, whose "waiver recorded" badge wraps the panel's header: with the finding
		// above it, none of this hint was on screen.
		await expectTheHintOnScreen(page);
	});

	// THE CONTROL, with its own failure mode: a page that rendered the new sentence beside EVERY unsatisfied floor would
	// pass the tests above that expect it. Asserted WHOLE, so it does not rest on /revise/ happening not to match "revising".
	test('⭑ CONTROL — a concluded SUBJECT rejection: the hint still says "revise the graph and re-run", whole', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Subject Rejection Hint');
		await stageAReview(request, pwaId, SUBJECT_FINDING, 'REJECTED');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the review judged the graph, and its finding is on the panel.
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.locator('ul.floorgaps')).toContainText(SUBJECT_FINDING.statement);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		await expect(hint).toHaveText(REVISE_HINT);
		await expectTheHintOnScreen(page);
	});

	// ⭐ The review in parts, package E, E1 (the lead's decision) — ONE PART'S REVIEW FAILED BESIDE ANOTHER PART'S REJECTION: the
	// round is answered by revision, so the hint says to revise for the findings, names the part whose review failed, and says
	// every type is reviewed again. ⛔ It said revising does not address the block, beside the rejected part's finding.
	test('⭐ a part’s review that did not execute BESIDE another part’s rejection: the hint says revise for the findings, and names the failed part, whole', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Failed Part Beside A Rejection Hint');
		await stageAReview(request, pwaId, EXECUTION_FAILED, 'INCONCLUSIVE');
		await stageAnAssessment(request, pwaId, {
			policyId: POLICY,
			assessmentId: 'assess_01ARZ3NDEKTSV4RRFFQ69G5FD1',
			observationId: 'obs_01ARZ3NDEKTSV4RRFFQ69G5FD2',
			observation: SUBJECT_FINDING,
			concludeAs: 'REJECTED',
			onType: 'Architecture Definition'
		});
		const root = await theRootPartOfTheLatestRound(request, pwaId);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the root's review did not execute, the child's rejected the graph, and both are on the panel.
		await expect(page.getByTestId('assurance-disposition')).toContainText('REJECTED');
		await expect(page.locator('ul.floorgaps')).toContainText(EXECUTION_FAILED_STATEMENT);
		await expect(page.locator('ul.floorgaps')).toContainText(SUBJECT_FINDING.statement);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		await expect(hint).toHaveText(
			`Publishing is blocked until the floor is SATISFIED — revise the graph for the findings the floor records against it and re-run. The Reasoning Review of "Product Realization" (${root.typeId}) failed operationally and recorded no finding; every type, the failed ones included, is reviewed again when the floor re-runs.`
		);
		await expect(hint).not.toContainText(/waiv/i);
		await expectTheHintOnScreen(page);
	});
});
