import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	acceptAgentCandidate,
	registerStipulation
} from './support/harness';
import { expectTheHintOnScreen } from './support/floor-panel';

// ⭐ `JAN-ESCREC` D3 (`REG-D-089`; `REG-D-090`) — BESIDE A REVIEW ITS REVIEWER ESCALATED, THE PWA PAGE SAYS SO: THE REVIEW IS
// ROUTED TO A HUMAN, NO HUMAN'S REVIEW CAN BE RECORDED YET, AND REVISING THE GRAPH DOES NOT ADDRESS IT.
//
// ⛔ WHAT WAS WRONG. Until `JAN-ESCREC` no review the product ran could escalate (`REG-F-473`), and an ESCALATED review that
// reached this page — only ever staged — was answered with the generic "the Reasoning Review did not reach a verdict"
// sentence, beside a floor chip that read UNASSESSED: the read-back's hand-written ladder knew SATISFIED, REJECTED and
// nothing else. Rule (a) now escalates a clean review whose reviewer recommends ESCALATED (`rph-assurance` D1) and records
// the recommendation (D2); the page's blocked hint gains its fourth answer, `ROUTE_TO_HUMAN`, and the chip asks the
// package's `aggregateDisposition`, which reads a required ESCALATED review INCONCLUSIVE.
//
// ⭑ WHAT MUST HOLD. The hint reads the fourth sentence — asserted WHOLE — names no waiver (ASR-3), does not say "revise the
// graph and re-run", and does not say to run assurance again: a re-run re-runs the same automated reviewer, which is
// `REG-F-474`'s, not a remedy. The chip reads INCONCLUSIVE, and the recommendation is not listed among the reasoning-review
// findings (it is not one). ⭑ The other three sentences are held whole by `assurance-floor-review-failure-hint.e2e.ts`, so
// a page that answered every operational block with this sentence reddens there.
//
// ⭑ THE ARRANGEMENT IS THE WAIVER SPEC'S. A SATISFIED candidate is accepted, so the floor on screen is CANONICAL with no
// fork in play; then a fresh reasoning-review assessment is posted through `/test-api/dispatch` — the bus the UI uses —
// carrying the recommendation exactly as the floor's recorder writes it (code, type RECOMMENDATION, INFORMATIONAL, the
// fixed statement) and CONCLUDED ESCALATED, beside the schema/invariant and identity/provenance policies the accepted floor
// left SATISFIED. ⚠ In the product an escalated review reaches this page through a staged candidate's FORK, and the
// candidate's resume banner then names the escalation too; no browser test renders that banner (no reviewer this lane can
// select recommends ESCALATED). `authoring-route-escalated-review.test.ts` drives the route and holds the banner's DATA
// and its sentence, whole, as the load hands it to the page (`resumeHintText`); `authoring-turn-resume-hint.test.ts` holds
// every branch of that sentence, and `resume-hint.e2e.ts` holds the template's rendering of it in the browser.
//
// ⭐ AND BESIDE A REVIEW THAT IS NOT ROUTED TO A HUMAN — a REJECTED one, its reviewer also recommending ESCALATED — ONE LINE
// beside the findings says so (the ER-1 app verifier's finding [7]); the second case holds it whole, AFTER the blocked hint
// and with the hint wholly on screen (the re-verifier's finding [1]: rendered first, the line pushed the hint below the
// floor panel's fold). ⭑ The server answers WHICH sentence (`escalationRecommendationNote`): beside an INCOMPLETE review —
// concluded INCONCLUSIVE, no finding at all — the line says the review reached no usable verdict, and the third case holds
// that whole (the re-verifier's finding [0]: it said "beside the findings, which are addressed first" there too). ⭑ Each
// case also reads the header chip, the aggregate in words (`floorChipLabel`).
// ⭐ AND THE PLACEMENT IS HELD BESIDE EVERY REVIEW STAGED HERE (the second fix round's re-verifier's finding [2]; `ER1-V201`,
// `ER1-V205`): the fold and the order were checked beside the REJECTED review alone, so the incomplete review's sentence
// could move above the hint, and either sentence below the waiver form, with every case green. Each case now asks the
// hint's fold (`expectTheHintOnScreen`, shared with `assurance-floor-review-failure-hint.e2e.ts`), and each case with a
// line asks its place (`expectTheLineInItsPlace`): after the hint — and before the waiver's form and the note a recorded
// waiver adds, which the second case records to ask.
// ⭐ THE HINT IS FIRST IN THE PANEL'S BODY (the third fix round's re-verifier's finding [0], ruled): the reasoning-review
// findings and the reviewer's answer rendered above it and pushed it below the fold — beside a review whose program did not
// run, on a second authoring turn, beside a waived floor — so it now renders FIRST in the panel's body, before the floor's
// own head and its policy list, the line directly after it, and both before the findings and the answer. So the panel's cap
// is unchanged, and the fold is asked of the waived step too. ⚠ THE SECOND AUTHORING TURN IS NOT STAGED HERE, AND CANNOT
// BE ON THIS LANE: what put the reviewer's answer above the hint there is a recorded model exchange, and the lane's only
// selectable reviewer — the declared stand-in — records none, nor recommends ESCALATED; an exchange staged through
// `/test-api/dispatch` would be a hand-written record of a reviewer call that never happened (thirty contract fields,
// content refs the panel re-hashes). It was measured out of the repository instead, with a stand-in for the devin program
// (ER-1's fourth fix round).
// ⭐ AND THE WAIVER FORM ONLY WHERE THERE IS A TARGET (the third fix round's re-verifier's finding [7], ruled): beside a
// review whose only observation is the reviewer's recommendation — the ESCALATED one, and the incomplete one — no form is
// offered, because the recommendation is never a waiver's target and the action would refuse it.
const POLICY = 'floor.reasoning-review';
const POLICY_VERSION = '1';
/** The staged reviews' ids — each its PWA's LATEST assessment, so the one the panel reads. */
const ESCALATED_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FD1';
const REJECTED_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FD4';
const INCONCLUSIVE_ASSESSMENT = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FD5';

/** The hint's fourth sentence (`DESIGN-the-escalation-recommendation.md` D3; `REG-D-090`), whole. */
const ROUTE_TO_HUMAN_HINT =
	"Publishing is blocked until the floor is SATISFIED — the Reasoning Review recommended escalation to a human reviewer, and this workbench cannot record a human's review yet (REG-F-474). Revising the graph does not address this.";

/** The observation the recorder writes for an ESCALATED recommendation (`REG-D-090`), byte for byte. */
const RECOMMENDATION = {
	findingCode: 'REVIEWER_RECOMMENDED_ESCALATION',
	severity: 'INFORMATIONAL',
	statement:
		"The reviewing model's recommendation was ESCALATED. The review prompt does not define ESCALATED; the Assurance Policy Catalog defines it as: the validator implementation or policy-designated authority cannot resolve the issue within its authority or competence."
};

/** One observation to stage on a review: its own id, the §21 type the recorder gives it, and what it records. */
interface StagedObservation {
	readonly observationId: string;
	readonly observationType: 'FINDING' | 'RECOMMENDATION';
	readonly findingCode: string;
	readonly severity: string;
	readonly statement: string;
}
const STAGED_RECOMMENDATION: StagedObservation = {
	observationId: 'obs_01ARZ3NDEKTSV4RRFFQ69G5FD2',
	observationType: 'RECOMMENDATION',
	...RECOMMENDATION
};
/** A SUBJECT finding the review failed the graph on — typed FINDING at its criterion's BLOCKING severity. */
const STAGED_FINDING: StagedObservation = {
	observationId: 'obs_01ARZ3NDEKTSV4RRFFQ69G5FD3',
	observationType: 'FINDING',
	findingCode: 'RR-01-no-problem-substitution',
	severity: 'BLOCKING',
	statement: 'The graph substitutes an easier problem for the one stated.'
};

/** ⭐ `JAN-ESCREC` D3 (`REG-D-089`) — the panel's informational line beside a review that is NOT routed to a human, whole. */
const ESCALATION_RECOMMENDED_LINE =
	'The reviewer also recommended escalation to a human reviewer. The recommendation is recorded beside the findings, which are addressed first (REG-D-089).';
/** ⭐ `JAN-ESCREC` D3 (`REG-D-089`; the ER-1 app re-verifier's finding [0]) — the line beside an INCOMPLETE review, whole. */
const ESCALATION_RECOMMENDED_WITH_AN_INCOMPLETE_REVIEW =
	'The reviewer also recommended escalation to a human reviewer. The review reached no usable verdict; the recommendation is recorded with it (REG-D-089).';
/** The blocked hint's NOT_BY_REVISION sentence, whole (`assurance-floor-review-failure-hint.e2e.ts` holds it too). */
const NOT_BY_REVISION_HINT =
	"Publishing is blocked until the floor is SATISFIED — the Reasoning Review did not reach a verdict that revising the graph can answer, so revising it does not address this. Run assurance again once the review's own cause is addressed.";

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
	await registerStipulation(request, pwaId, 'PWA_GRAPH');

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
 * The reasoning review's LATEST assessment — the one the panel reads — carrying `observations` in that order, each as
 * the recorder types it, and CONCLUDED as given. The verdict is in DOC-007 §20's sixteen-field shape, without the
 * evaluator and criterion rows the floor's own recorder also sends (`rph-engine` `record-assurance.ts`); no producer is
 * named, so no independence is checked.
 * ⛔ NEVER A POSITIVE DISPOSITION: the lane control fails the run on any positive reasoning review but the declared
 * stand-in's (`lib/server/lane-control.ts`, LIMB 2), and a staged one is not the stand-in's. So a CONDITIONALLY_SATISFIED
 * review is never staged here; `floor.test.ts` holds its read-back, and the header chip's words, in-process.
 */
async function stageAReview(
	request: APIRequestContext,
	pwaId: string,
	assessmentId: string,
	observations: readonly StagedObservation[],
	concludeAs: 'ESCALATED' | 'REJECTED' | 'INCONCLUSIVE'
): Promise<void> {
	const pwa = (await introspect(request)).pwas.find((p) => p.id === pwaId)!;
	const version = Number(pwa.state.semanticVersion ?? 1);
	const res = await request.post('/test-api/dispatch', {
		data: {
			steps: [
				[
					'RequestAssuranceAssessment',
					'ASSURANCE_ASSESSMENT',
					assessmentId,
					{
						assessmentId,
						assurancePolicyId: POLICY,
						policyVersion: POLICY_VERSION,
						subjectObjectIds: [pwaId],
						subjectSemanticVersions: { [pwaId]: version },
						claimIds: []
					}
				],
				['BeginAssuranceAssessment', 'ASSURANCE_ASSESSMENT', assessmentId, {}],
				...observations.map(({ observationId, observationType, ...recorded }) => [
					'RecordAssuranceObservation',
					'ASSURANCE_OBSERVATION',
					observationId,
					{ assessmentId, observationType, ...recorded }
				]),
				[
					'CompleteAssuranceAssessment',
					'ASSURANCE_ASSESSMENT',
					assessmentId,
					{
						validatorResult: {
							validatorId: 'e2e.staged-reasoning-review',
							validatorVersion: '1',
							policyId: POLICY,
							policyVersion: POLICY_VERSION,
							assessmentId,
							subjectObjectIds: [pwaId],
							subjectSemanticVersions: { [pwaId]: version },
							claimResults: [],
							evidenceConsideredIds: [],
							evidenceRejected: [],
							observations: observations.map(
								({ observationId: _id, observationType: _type, ...recorded }) => ({
									...recorded,
									subjectObjectIds: [pwaId]
								})
							),
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

/**
 * ⭐ `JAN-ESCREC` D3 (the second fix round's re-verifier's finding [2]; `ER1-V205`) — AND THE LINE IN ITS DECIDED PLACE: it
 * FOLLOWS the hint, in the document whatever the viewport, and PRECEDES the waiver's affordances — the form that records
 * accepted risk, and the note a recorded waiver adds — because the recommendation is part of why publishing is blocked, not
 * a footnote to recording accepted risk. ⭐ THE FORM IS OFFERED ONLY WHERE THERE IS A TARGET (the third fix round's
 * re-verifier's finding [7], ruled; `hasWaiverTarget`): beside a review carrying a finding a waiver can name the form is
 * there and the line precedes it (`A_FINDING`); beside a review whose only observation is the recommendation, which a
 * waiver never names, it is ABSENT (`ONLY_THE_RECOMMENDATION`) — and the order limbs then ask the note, where there is one.
 */
async function expectTheLineInItsPlace(
	page: Page,
	review: 'A_FINDING' | 'ONLY_THE_RECOMMENDATION'
): Promise<void> {
	const order = await page.evaluate(() => {
		const follows = (a: Element | null, b: Element | null): boolean =>
			a !== null &&
			b !== null &&
			Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
		const hint = document.querySelector('[data-testid="floor-blocked-hint"]');
		const line = document.querySelector('[data-testid="floor-escalation-recommended"]');
		const note = document.querySelector('[data-testid="floor-waiver-nondischarge"]');
		const form = document.querySelector('form.floorwaiver');
		return {
			afterTheHint: follows(hint, line),
			formOffered: form !== null,
			beforeTheForm: form === null || follows(line, form),
			beforeTheNote: note === null || follows(line, note)
		};
	});
	expect(order.afterTheHint, 'the escalation line is not rendered after the blocked hint').toBe(
		true
	);
	if (review === 'ONLY_THE_RECOMMENDATION')
		expect(
			order.formOffered,
			'a waiver form is offered beside a review whose only observation is the recommendation, which a waiver never names'
		).toBe(false);
	else
		expect(
			order.formOffered,
			'no waiver form is offered beside a review carrying a finding a waiver can name'
		).toBe(true);
	expect(order.beforeTheForm, 'the escalation line is rendered after the waiver form').toBe(true);
	expect(
		order.beforeTheNote,
		'the escalation line is rendered after the note a recorded waiver adds'
	).toBe(true);
}

test.describe('Assurance floor — an escalated review is routed to a human', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('⭐ a review concluded ESCALATED, the rest of the floor SATISFIED: the hint routes it to a human, whole, and the chip reads INCONCLUSIVE', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Escalated Review Hint');
		await stageAReview(request, pwaId, ESCALATED_ASSESSMENT, [STAGED_RECOMMENDATION], 'ESCALATED');

		// Arrangement, from the store: the staged review concluded ESCALATED, and the recommendation is recorded on it as
		// the recorder types it.
		const snapshot = await introspect(request);
		expect(
			snapshot.assessments.find((a) => a.id === ESCALATED_ASSESSMENT)?.state.assessmentState,
			'arrangement: the staged review did not conclude ESCALATED'
		).toBe('ESCALATED');
		expect(
			snapshot.observations
				.filter((o) => o.state.assessmentId === ESCALATED_ASSESSMENT)
				.map((o) => `${String(o.state.findingCode)}/${String(o.state.observationType)}`),
			'arrangement: the recommendation is not recorded on the staged review'
		).toEqual(['REVIEWER_RECOMMENDED_ESCALATION/RECOMMENDATION']);

		await gotoHydrated(page, `/pwa/${pwaId}`);
		// Arrangement: the two other floor policies the accepted floor recorded still pass.
		await expect(page.locator('ul.floorpolicies li.ok')).toHaveCount(2);
		await expect(page.locator('ul.floorpolicies li.bad')).toHaveCount(0);
		// ⭐ THE CHIP: a required ESCALATED review reads INCONCLUSIVE (`aggregateDisposition`), never UNASSESSED.
		await expect(page.getByTestId('assurance-disposition')).toHaveText('⚖ INCONCLUSIVE');
		// ⭑ And the header chip says so in words — the label the server answers (`floorChipLabel`), rendered as it is.
		await expect(page.getByTestId('assurance-chip')).toHaveText('⚖ floor inconclusive');
		// ⛔ NOT A FINDING: the recommendation is not listed among the reasoning-review findings.
		await expect(page.locator('ul.floorgaps')).toHaveCount(0);

		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toHaveCount(1);
		// ⭐ THE CLAIM, POSITIVELY AND WHOLE: the fourth sentence and nothing else.
		await expect(hint).toHaveText(ROUTE_TO_HUMAN_HINT);
		// ⛔ NO ROUTE PAST THE FLOOR (ASR-3), NOT A REVISION, AND NOT A RE-RUN OF THE SAME AUTOMATED REVIEWER.
		await expect(hint).not.toContainText(/waiv/i);
		await expect(hint).not.toContainText('revise the graph and re-run');
		await expect(hint).not.toContainText(/run assurance again/i);
		// ⛔ AND SAID ONCE: the hint names the escalation, so the line that tells it beside the findings is not shown.
		await expect(page.getByTestId('floor-escalation-recommended')).toHaveCount(0);
		// ⭐ THE LONG HINT, WHOLLY ON SCREEN at the default viewport (the second fix round's re-verifier's finding [2]).
		await expectTheHintOnScreen(page);
		// ⭐ AND NO WAIVER FORM (the third fix round's re-verifier's finding [7], ruled): the review's only observation is the
		// recommendation, which a waiver never names, so recording accepted risk here is refused — and not offered.
		await expect(
			page.locator('form.floorwaiver'),
			'a waiver form is offered beside a review whose only observation is the recommendation, which a waiver never names'
		).toHaveCount(0);
	});

	test('⭐ a review REJECTED for a finding, its reviewer also recommending ESCALATED: the hint says revise, and one line beside the findings says the escalation was recommended, whole', async ({
		page,
		request
	}) => {
		// ⛔ The ER-1 app verifier's finding [7]: the recommendation is recorded beside a REJECTED review (`REG-D-089`: *"the
		// escalation recorded beside it"*), and the page showed it nowhere — not among the findings (it is not one), not in
		// the hint (the review was not escalated), not in the policy list. ⭑ One informational line now says it, outside
		// "Reasoning-review findings", naming no waiver and no route past the floor.
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Escalation Recommended');
		await stageAReview(
			request,
			pwaId,
			REJECTED_ASSESSMENT,
			[STAGED_FINDING, STAGED_RECOMMENDATION],
			'REJECTED'
		);
		const snapshot = await introspect(request);
		expect(
			snapshot.assessments.find((a) => a.id === REJECTED_ASSESSMENT)?.state.assessmentState,
			'arrangement: the staged review did not conclude REJECTED'
		).toBe('REJECTED');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).toHaveText('⚖ REJECTED');
		await expect(page.getByTestId('assurance-chip')).toHaveText('⚖ floor rejected');
		// The finding is listed among the findings, and the recommendation is not.
		await expect(page.locator('ul.floorgaps li')).toHaveText([STAGED_FINDING.statement]);
		await expect(page.getByTestId('floor-blocked-hint')).toHaveText(
			'Publishing is blocked until the floor is SATISFIED — revise the graph and re-run.'
		);
		const line = page.getByTestId('floor-escalation-recommended');
		await expect(line).toHaveCount(1);
		// ⭐ THE CLAIM, WHOLE — and OUTSIDE the findings list.
		await expect(line).toHaveText(ESCALATION_RECOMMENDED_LINE);
		await expect(
			page.locator('ul.floorgaps').getByTestId('floor-escalation-recommended')
		).toHaveCount(0);
		await expect(line).not.toContainText(/waiv/i);

		// ⭐ `JAN-ESCREC` D3 (the ER-1 app re-verifier's finding [1]) — AND THE INSTRUCTION STAYS ON SCREEN, with the line after
		// it and before the waiver's form, which is offered here: the review carries a finding a waiver can name.
		await expectTheHintOnScreen(page);
		await expectTheLineInItsPlace(page, 'A_FINDING');

		// ⭑ AND WITH A WAIVER RECORDED, the line also precedes the note the waiver adds — so that limb of the order is asked of
		// a page that shows the note, never vacuously. The waiver names the subject finding, never the recommendation
		// (`waiver-target-recommendation.test.ts`), and clears nothing (`assurance-floor-waiver.e2e.ts`). ⭐ AND THE FOLD IS
		// ASKED HERE TOO (the third fix round's re-verifier's finding [0]): the "waiver recorded" badge wraps the panel's
		// header, and with the findings above it the hint spanned y 627-661 against the fold at 642; first in the body, it
		// is whole.
		await page
			.locator('form.floorwaiver input[name="rationale"]')
			.fill('Accepted: the substituted problem is understood and owned.');
		await page.locator('form.floorwaiver').getByRole('button').click();
		await expect
			.poll(async () =>
				(await introspect(request)).decisions.map(
					(d) => `${String(d.state.decisionType)}/${String(d.state.status)}`
				)
			)
			.toEqual(['WAIVER/EFFECTIVE']);
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('floor-waiver-nondischarge')).toHaveCount(1);
		await expect(page.getByTestId('floor-escalation-recommended')).toHaveText(
			ESCALATION_RECOMMENDED_LINE
		);
		await expectTheHintOnScreen(page);
		await expectTheLineInItsPlace(page, 'A_FINDING');
	});

	test('⭐ an INCOMPLETE review — concluded INCONCLUSIVE, its reviewer also recommending ESCALATED: the hint says revising does not address it, and the line says the review reached no usable verdict, whole', async ({
		page,
		request
	}) => {
		// ⛔ The ER-1 app re-verifier's finding [0] (its probe P6): D2 records the recommendation on a VALID INCONCLUSIVE
		// review too — a reply that left a criterion unanswered — and the line said *"recorded beside the findings, which are
		// addressed first"* beside a review with NO finding, under a hint saying revising does not address the block. The
		// operator was told something false. ⭑ The server now answers WHICH sentence (`escalationRecommendationNote`), and
		// beside an incomplete review the line says the review reached no usable verdict, the recommendation recorded with it.
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Escalation Incomplete');
		await stageAReview(
			request,
			pwaId,
			INCONCLUSIVE_ASSESSMENT,
			[STAGED_RECOMMENDATION],
			'INCONCLUSIVE'
		);
		const snapshot = await introspect(request);
		expect(
			snapshot.assessments.find((a) => a.id === INCONCLUSIVE_ASSESSMENT)?.state.assessmentState,
			'arrangement: the staged review did not conclude INCONCLUSIVE'
		).toBe('INCONCLUSIVE');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).toHaveText('⚖ INCONCLUSIVE');
		await expect(page.getByTestId('assurance-chip')).toHaveText('⚖ floor inconclusive');
		// ⛔ NOT A FINDING, AND NO FINDING AT ALL: nothing is listed under "Reasoning-review findings".
		await expect(page.locator('ul.floorgaps')).toHaveCount(0);
		await expect(page.getByTestId('floor-blocked-hint')).toHaveText(NOT_BY_REVISION_HINT);
		const line = page.getByTestId('floor-escalation-recommended');
		await expect(line).toHaveCount(1);
		// ⭐ THE CLAIM, WHOLE: the second sentence — never "beside the findings, which are addressed first".
		await expect(line).toHaveText(ESCALATION_RECOMMENDED_WITH_AN_INCOMPLETE_REVIEW);
		await expect(line).not.toContainText(/waiv/i);
		// ⭐ AND IN ITS PLACE, BESIDE THIS REVIEW TOO (the second fix round's re-verifier's finding [2]; `ER1-V201`): the long
		// NOT_BY_REVISION hint wholly on screen and the line after it. Above the hint, this sentence would leave 26 of the
		// hint's 101px on screen (measured by that re-verifier). ⭐ And no waiver form: the review's only observation is the
		// recommendation (the third fix round's re-verifier's finding [7], ruled).
		await expectTheHintOnScreen(page);
		await expectTheLineInItsPlace(page, 'ONLY_THE_RECOMMENDATION');
	});
});
