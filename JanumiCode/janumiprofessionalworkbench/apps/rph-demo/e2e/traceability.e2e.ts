import { expect, test } from '@playwright/test';
import { gotoHydrated, resetEngine } from './support/harness';

// W4-INC-1 (WP-4-007): the Undertaking Workbench's traceability tab renders the typed intent-to-baseline link
// graph, consuming the rph-projections traceabilityProjector (built in W2-INC-3) — previously a backend-only
// projection with no UI consumer. Read-only, derived, no authority.
test.describe('Undertaking Workbench — traceability surface (WP-4-007)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('the traceability tab surfaces typed intent-to-baseline links for the seeded undertaking', async ({
		page
	}) => {
		await gotoHydrated(page, '/undertakings');
		// open the seeded reference undertaking (the only one in 'reference' state)
		const row = page.locator('a.row[href^="/undertakings/und_"]').first();
		await expect(row).toBeVisible();
		const href = await row.getAttribute('href');
		expect(href).toMatch(/\/undertakings\/und_/);
		await gotoHydrated(page, href!);

		await page.getByRole('button', { name: 'traceability' }).click();
		const panel = page.getByTestId('traceability-panel');
		await expect(panel).toBeVisible();

		// the decomposition edges + intent traces the reference undertaking produced are surfaced
		await expect(panel.getByText('DECOMPOSES', { exact: false }).first()).toBeVisible();
		await expect(panel.getByText('TRACES_TO_INTENT', { exact: false }).first()).toBeVisible();
	});
});
