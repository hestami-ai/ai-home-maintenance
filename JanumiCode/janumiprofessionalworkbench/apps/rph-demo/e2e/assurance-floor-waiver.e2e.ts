import { expect, type APIRequestContext, type Page } from '@playwright/test';
import {
	test,
	resetEngine,
	introspect,
	gotoHydrated,
	acceptAgentCandidate,
	registerStipulation
} from './support/harness';

// A RECORDED WAIVER DOES NOT CLEAR THE DE MINIMIS FLOOR — asserted at the SURFACE (ASR-3, REG-F-202).
//
// ASR-3 (JPWB-DOC-003 §Semantic Model, ratified) — "The de minimis assurance floor is UNCONDITIONAL. Risk
// proportionality governs assurance above a mandatory floor; it never makes the floor optional." Commit d24c19ec
// deleted the discharge apparatus from `handlers/floor-gate.ts`. That headline was proven at package level and
// NOWHERE on the demo surface, which went on saying the opposite in four places.
//
// ⚠ THE ARRANGEMENT IS THE HARD PART, AND A CHEAPER ONE IS WRONG. The obvious staging — an agent turn whose floor
// comes back REJECTED — puts a blocking floor ON SCREEN but not in canonical state: the panel is rendered from a
// fork (`+page.server.ts` hands `loadPwaFloor` `candidate?.engine ?? canonicalEngine`), while `recordWaiver` reads
// canonical, and `agent/+server.ts` stages a candidate for acceptance ONLY when `floor.satisfied`. In that
// arrangement the action answers "Nothing to waive: the floor is not blocking" and NOTHING is recorded — so a spec
// built on it would assert the non-discharge of a waiver that never existed, which is a control that cannot fail.
//
// So this accepts a SATISFIED candidate first (canonical floor, no fork in play), then posts a fresh
// reasoning-review assessment through `/test-api/dispatch` — the same bus the UI uses — leaving the floor's LATEST
// reasoning-review assessment non-SATISFIED with a real BLOCKING observation for the waiver to name. Driven, not
// assumed: without the observation `recordWaiver` refuses, because DOC-004 §12.2 makes a waiver name its finding.
//
// ⚠ NOT A REFUSAL AT `RequestWaiver`. That was considered and rejected as over-refusal: ASR-14 ("a waiver accepts
// risk; it never rewrites truth") narrows a waiver's REACH, not its RECORDABILITY. The waiver here is EXPECTED to
// record and to become EFFECTIVE. What is asserted is that it moves no gate and claims to move none.
const POLICY = 'floor.reasoning-review';
const POLICY_VERSION = '1';

test.describe('Assurance floor — a recorded waiver does not clear it', () => {
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
		// ⭐ THE TEST STIPULATES THE REVIEW'S REMAINDER (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md` §4.5,
		// §4.6): in the body — this helper runs in each test's — after the reset, with the PWA's id READ FROM THE STORE.
		// The declared stand-in then answers what the structural checker cannot judge — recorded as not judged, and
		// disclosed. No assertion here changes.
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
		// The fork is gone: everything below reads the SAME canonical store the action reads.
		expect((await introspect(request)).authoringCandidates).toEqual([]);
		return pwaId;
	}

	/**
	 * Leave the LATEST reasoning-review assessment non-SATISFIED, carrying a BLOCKING finding a waiver can name, CONCLUDED
	 * with the disposition given.
	 *
	 * ⭐ `JAN-SELRES` RS-3 (`REG-F-462`) — THE FIXTURE WAS THE TELL. This left every caller's review ASSESSING, which the
	 * floor's own recorder does not do (`record-assurance.ts` completes every assessment it begins), and the floor's
	 * classifier calls an unconcluded review with its finding open an INCOMPLETE review: *"Do not revise the PWA or record
	 * a waiver merely to clear an incomplete review"*. Yet the first test below is about a SUBJECT rejection: "the panel
	 * offers revision". D8 first bent the page's hint around this fixture (keyed on recorded codes, so it would keep saying
	 * "revise" here), and that left "revise" beside every incomplete review in the product. The hint now follows the
	 * classifier, and each test concludes its review:
	 *   · the first `REJECTED` with the same finding, which the classifier answers `REFINE_SUBJECT` — what its title says;
	 *   · the second `INCONCLUSIVE`, the review that reached no verdict. ⛔ NOT `REJECTED`, ON PURPOSE: its PublishPwa
	 *     refusal is the victim of `MU-F202-the-floor-blocks-only-on-REJECTED`, which is killed only because this floor
	 *     blocks WITHOUT a REJECTED review. Any non-REJECTED review does that; ASSESSING was never what it needed (a
	 *     second test concluded `REJECTED` lets that mutant SURVIVE, driven).
	 * No assertion in this file changed.
	 */
	async function blockTheFloor(
		request: APIRequestContext,
		pwaId: string,
		concludeAs: 'REJECTED' | 'INCONCLUSIVE'
	): Promise<void> {
		const pwa = (await introspect(request)).pwas.find((p) => p.id === pwaId)!;
		const version = Number(pwa.state.semanticVersion ?? 1);
		const assessmentId = 'assess_01ARZ3NDEKTSV4RRFFQ69G5FA1';
		const observationId = 'obs_01ARZ3NDEKTSV4RRFFQ69G5FA2';
		const finding = {
			findingCode: 'RR-04',
			severity: 'BLOCKING',
			statement: 'Staged blocking reasoning-review finding.'
		};
		// The verdict in DOC-007 §20's sixteen-field shape, without the evaluator and criterion rows the floor's own
		// recorder also sends (`rph-engine` `record-assurance.ts`): no producer is named, so no independence is checked.
		const conclude = [
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
					observations: [{ ...finding, subjectObjectIds: [pwaId] }],
					dispositionRecommendation: concludeAs,
					recommendedControlActions: [],
					residualUncertainty: [],
					limitations: [],
					executionProvenance: {}
				}
			}
		];
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
					[
						'RecordAssuranceObservation',
						'ASSURANCE_OBSERVATION',
						observationId,
						{ assessmentId, observationType: 'FINDING', ...finding }
					],
					conclude
				]
			}
		});
		const outcome = (await res.json()) as { ok: boolean; results: { status: string }[] };
		expect(outcome.ok, `staging must succeed: ${JSON.stringify(outcome)}`).toBeTruthy();
	}

	test('the panel offers revision, and the waiver is framed as accepted risk', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Waiver Framing');
		// A SUBJECT rejection, concluded — see `blockTheFloor` for why this arrangement changed in RS-3.
		await blockTheFloor(request, pwaId, 'REJECTED');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		const hint = page.getByTestId('floor-blocked-hint');
		await expect(hint).toBeVisible();
		await expect(hint).toContainText(/revise/i);
		// ⚠ THE CLAIM. The one route past the floor is revision, and this sentence may not name a second.
		await expect(hint).not.toContainText(/waiv/i);

		// The affordance survives (ASR-14) but may not promise publication.
		const form = page.locator('form.floorwaiver');
		await expect(form).toHaveCount(1);
		await expect(form.getByRole('button')).not.toContainText(/allow publish/i);
		await expect(form.locator('input[name="rationale"]')).not.toHaveAttribute(
			'placeholder',
			/why publish/i
		);
	});

	test('recording one succeeds, says it clears nothing, and PublishPwa still refuses', async ({
		page,
		request
	}) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Waiver Nondischarge');
		// A review that reached no verdict, concluded — see `blockTheFloor` for why it is not REJECTED.
		await blockTheFloor(request, pwaId, 'INCONCLUSIVE');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await page
			.locator('form.floorwaiver input[name="rationale"]')
			.fill('Accepted: the reasoning gap is understood and owned.');
		await page.locator('form.floorwaiver').getByRole('button').click();

		// 1. IT RECORDED. ASR-14 keeps a waiver recordable; a spec that asserted refusal here would be enforcing
		//    the over-refusal the sponsor's ruling explicitly rejected.
		await expect
			.poll(async () =>
				(await introspect(request)).decisions.map(
					(d) => `${String(d.state.decisionType)}/${String(d.state.status)}`
				)
			)
			.toEqual(['WAIVER/EFFECTIVE']);

		// 2. THE SURFACE SAYS WHAT IT IS. This block used to read "publishing is permitted despite the floor".
		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-waived')).toBeVisible();
		const note = page.getByTestId('floor-waiver-nondischarge');
		await expect(note).toBeVisible();
		await expect(note).toContainText(/does not clear the floor/i);
		// The blocked hint does NOT disappear because a waiver exists — that disappearance was the old lie.
		await expect(page.getByTestId('floor-blocked-hint')).toBeVisible();

		// 3. THE HEADLINE, at the engine, through the same bus the UI uses: an EFFECTIVE waiver over the blocking
		//    policy leaves PublishPwa refusing — and the refusal no longer names a waiver as the way out.
		// ⚠ THE FSM GUARD FIRES FIRST, so a DRAFT PublishPwa refuses for being DRAFT and proves nothing about the
		// floor. Drive the publish FSM to VALIDATED so the FLOOR is the reason the last hop refuses — and note the
		// floor did NOT block the earlier hops: it gates PUBLICATION, not review.
		const rootTypeId = (await introspect(request)).pwuTypes.find(
			(t) => t.state.isRoot === true && String(t.state.pwaId) === pwaId
		)!.id;
		const pub = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					['SubmitPwaForReview', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
					['ValidatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {}],
					['PublishPwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, { rootPwuTypeId: rootTypeId }]
				]
			}
		});
		const outcome = (await pub.json()) as {
			results: { status: string; message?: string }[];
		};
		// The two review hops must PASS — otherwise the publish refusal below could be a knock-on and the floor
		// assertion would be vacuous.
		expect(
			outcome.results.slice(0, 2).map((r) => r.status),
			'the review hops must succeed, or the publish refusal proves nothing'
		).toEqual(['ACCEPTED', 'ACCEPTED']);
		const refusal = outcome.results[2]!;
		expect(refusal.status).toBe('REJECTED');
		expect(refusal.message).toContain('de minimis assurance floor is not SATISFIED');
		expect(refusal.message).toContain('no governance waiver discharges it');
		expect(
			refusal.message,
			'the refusal must not offer a waiver as an alternative route'
		).not.toMatch(/or a governance waiver/i);
	});

	// THE CONTROL, with its own failure mode rather than a mirror of the two above: a panel that rendered the
	// blocked hint UNCONDITIONALLY would pass both, while lying on every satisfied floor. This fails in that world.
	test('a SATISFIED floor shows no blocked hint and no waiver form', async ({ page, request }) => {
		const pwaId = await draftWithSatisfiedFloor(page, request, 'Floor Waiver Control');

		await gotoHydrated(page, `/pwa/${pwaId}`);
		await expect(page.getByTestId('assurance-disposition')).toContainText('SATISFIED');
		await expect(page.getByTestId('floor-blocked-hint')).toHaveCount(0);
		await expect(page.getByTestId('floor-waiver-nondischarge')).toHaveCount(0);
		await expect(page.locator('form.floorwaiver')).toHaveCount(0);
	});
});
