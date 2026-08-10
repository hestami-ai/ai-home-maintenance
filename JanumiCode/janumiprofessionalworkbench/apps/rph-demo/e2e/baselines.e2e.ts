import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Baselines authoring — a Baseline candidate must be creatable and advanceable through the authoring lifecycle
// CANDIDATE -> UNDER_REVIEW -> APPROVED, every step driving the real engine. (Promotion to AUTHORITATIVE is a
// documented follow-up: canPromoteBaseline needs an effective promotion Decision + satisfied assessments.)
test.describe('Baseline Manager — create, submit, approve', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('create a baseline candidate and advance it to APPROVED', async ({ page, request }) => {
		await gotoHydrated(page, '/baselines');

		// 1. Create a CANDIDATE baseline of type ARCHITECTURE.
		await page.getByRole('button', { name: '+ Create Baseline' }).click();
		await page.getByLabel('Baseline type').selectOption('ARCHITECTURE');
		await page.getByRole('button', { name: 'Create baseline', exact: true }).click();

		// SEMANTIC: the new baseline shows as a CANDIDATE of type ARCHITECTURE. Scope to the table cell so we match
		// the row (not the identically-named <option> still present in the open create form).
		await expect(page.getByRole('cell', { name: 'ARCHITECTURE', exact: true })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'CANDIDATE', exact: true })).toBeVisible();

		// 2. Submit for review: CANDIDATE -> UNDER_REVIEW.
		await page.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect(page.getByRole('cell', { name: 'UNDER_REVIEW', exact: true })).toBeVisible();

		// 3. Approve: UNDER_REVIEW -> APPROVED.
		await page.getByRole('button', { name: 'Approve', exact: true }).click();
		await expect(page.getByRole('cell', { name: 'APPROVED', exact: true })).toBeVisible();

		// TRUTH: the engine really recorded exactly one Baseline in the APPROVED status (not just rendered text).
		const snap = await introspect(request);
		expect(snap.baselines).toHaveLength(1);
		expect(snap.baselines[0].state.status).toBe('APPROVED');
		expect(snap.baselines[0].state.baselineType).toBe('ARCHITECTURE');

		// VISUAL: capture the approved baseline for review.
		await page.screenshot({ path: 'e2e-results/baselines.png', fullPage: true });
	});

	// ── S-0 OF ROADMAP-decision-subject-scope: THE ACT END, NOT THE WRITE END (REG-F-077) ────────────────────
	//
	// The design's first hollowness mode is a subject picker that ships with every gate it feeds still
	// unreachable. Measured before this test existed: `PromoteBaseline` appeared NOWHERE in `apps/rph-demo` —
	// not in a route, not in an e2e — so `canPromoteBaseline`'s scope conjunct had no caller from the surface at
	// all. This spec makes the act reachable, and it asserts the ACT rather than a render: the refusal and the
	// promotion are both read back out of the ENGINE.
	//
	// Promotion is deliberately S-0 rather than a later step: it is the one authorization whose subjects can
	// version (`bumpSemanticVersion` exists only on INTENT and DECOMPOSITION_CONTRACT), so it is the only path
	// where a staleness arrangement is constructible at all — DESIGN §4.
	test('promotion is REFUSED without an authorizing Decision, and ACCEPTED with one that names the baseline', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/baselines');
		await page.getByRole('button', { name: '+ Create Baseline' }).click();
		await page.getByLabel('Baseline type').selectOption('RELEASE');
		await page.getByRole('button', { name: 'Create baseline', exact: true }).click();
		await page.getByRole('button', { name: 'Submit', exact: true }).click();
		await page.getByRole('button', { name: 'Approve', exact: true }).click();
		await expect(page.getByRole('cell', { name: 'APPROVED', exact: true })).toBeVisible();

		// 1. REFUSED. The baseline is APPROVED and legally promotable, so the ONLY thing standing between it and
		//    AUTHORITATIVE is the authorization — which is what makes this a test of the gate rather than of the
		//    transition.
		await page.getByRole('button', { name: 'Promote', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('no effective PROMOTE_BASELINE decision');

		// TRUTH, not text: the engine did not move it, and no Decision was invented to make the act succeed.
		let snap = await introspect(request);
		expect(snap.baselines[0].state.status).toBe('APPROVED');
		expect(snap.decisions).toHaveLength(0);

		// 2. AUTHORIZE — the subject is DERIVED from the row being acted on, never picked. That is the whole of
		//    the design's answer to REG-F-077: site the authorization next to its object.
		await page.getByRole('button', { name: 'Authorize promotion', exact: true }).click();
		// `getByText`, not `getByRole('cell')`: the action cell also holds the Promote button, so its accessible
		// name is not the badge alone. The engine assertions below are the truth; this only waits for the render.
		await expect(page.getByText('AUTHORIZED', { exact: true })).toBeVisible();

		snap = await introspect(request);
		expect(snap.decisions).toHaveLength(1);
		const decision = snap.decisions[0].state as {
			decisionType: string;
			status: string;
			subjectObjectIds: string[];
			subjectSemanticVersions: Record<string, number>;
		};
		expect(decision.decisionType).toBe('PROMOTE_BASELINE');
		expect(decision.status).toBe('EFFECTIVE');
		// THE ASSERTION REG-F-077 EXISTS FOR: the stored decision NAMES the baseline. Asserting the form, or the
		// rendered badge, would pass on a decision that carried `[]` — which is the defect.
		expect(decision.subjectObjectIds).toEqual([snap.baselines[0].id]);
		// And the engine pinned the version itself; the surface never sent one (DESIGN §1.3).
		expect(decision.subjectSemanticVersions[snap.baselines[0].id]).toBe(1);

		// 3. PROMOTED, through the real gate.
		await page.getByRole('button', { name: 'Promote', exact: true }).click();
		await expect(page.getByRole('cell', { name: 'AUTHORITATIVE', exact: true })).toBeVisible();

		snap = await introspect(request);
		expect(snap.baselines[0].state.status).toBe('AUTHORITATIVE');
	});
});
