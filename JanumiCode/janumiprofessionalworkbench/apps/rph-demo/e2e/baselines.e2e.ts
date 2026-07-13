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
});
