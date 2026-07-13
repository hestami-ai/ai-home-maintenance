import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// PWA deletion (discard). A draft PWA the user no longer wants can be deleted from the Library, behind a
// confirmation. Engine truth: it leaves the live set (tombstoned DISCARDED) and a PwaDeleted event is recorded.
// (The engine BLOCKS deleting a PWA that has Undertakings instantiated from it — covered by the handler unit test.)
test.describe('PWA Library — delete a PWA', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('a draft PWA can be deleted, behind a confirmation', async ({ page, request }) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Disposable PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await expect(page.getByRole('link', { name: /Disposable PWA/ })).toBeVisible();
		expect((await introspect(request)).pwas).toHaveLength(1);

		// Reveal the confirmation, then confirm the delete.
		await page.getByRole('button', { name: /Delete Disposable PWA/ }).click();
		await expect(page.getByText(/Delete this draft PWA/)).toBeVisible();
		await page.getByRole('button', { name: 'Delete', exact: true }).click();

		// UI: the card is gone.
		await expect(page.getByRole('link', { name: /Disposable PWA/ })).toHaveCount(0);

		// TRUTH: no live PWA remains and a PwaDeleted event was recorded.
		const snap = await introspect(request);
		expect(snap.pwas).toHaveLength(0);
		expect(snap.events.some((e) => e.eventType === 'PwaDeleted')).toBe(true);
	});
});
