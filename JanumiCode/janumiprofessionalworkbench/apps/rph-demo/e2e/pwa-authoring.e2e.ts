import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Slice 1 — PWA Designer authoring (RPH-DOC-010 §6/§11). A DRAFT PWA must be extensible with PWU Types and
// advanceable through the publication lifecycle DRAFT -> UNDER_REVIEW -> VALIDATED -> PUBLISHED, every step driving
// the real engine. This closes "creating a new PWA only lets you create it — you can't define its PWU Types".
test.describe('PWA Designer — author PWU Types and publish', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('author a draft PWA, define a root PWU Type, and publish it', async ({ page, request }) => {
		// 1. Create a DRAFT PWA from the Library.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Delivery Operations PWA');
		await page.getByPlaceholder(/Domain/i).fill('logistics');
		await page.getByRole('button', { name: 'Create draft' }).click();

		// 2. Open it — Library cards link to /pwa/[id].
		await page.getByRole('link', { name: /Delivery Operations PWA/ }).click();
		await expect(page.getByRole('heading', { name: 'Delivery Operations PWA' })).toBeVisible();

		// 3. Define a root PWU Type — the authoring control that was the dead-end.
		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Delivery Realization');
		await page.locator('input[name="pwuKind"]').fill('DELIVERY_REALIZATION');
		await page.getByLabel(/Root type/i).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		// SEMANTIC: the new PWU Type shows in the Work Architecture list.
		await expect(page.getByRole('button', { name: /Delivery Realization/ })).toBeVisible();

		// 4. Advance the publication lifecycle to PUBLISHED.
		await page.getByRole('button', { name: /Submit for Review/i }).click();
		await page.getByRole('button', { name: /Validate/i }).click();
		await page.getByRole('button', { name: /^Publish$/ }).click();

		// SEMANTIC: the PWA is now published + immutable.
		await expect(page.getByText(/Published versions are immutable/i)).toBeVisible();

		// TRUTH: the engine really recorded a PUBLISHED PWA with exactly one root PWU Type (not just rendered text).
		const snap = await introspect(request);
		expect(snap.pwas).toHaveLength(1);
		expect(snap.pwas[0].state.publicationStatus).toBe('PUBLISHED');
		const roots = snap.pwuTypes.filter((t) => t.state.isRoot === true);
		expect(roots).toHaveLength(1);
		expect(roots[0].state.name).toBe('Delivery Realization');

		// VISUAL: capture the published PWA for review.
		await page.screenshot({ path: 'e2e-results/pwa-authoring-published.png', fullPage: true });
	});
});
