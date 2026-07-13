import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Slice — PWA publication lifecycle continuation (RPH-DOC-010 §11). The publication FSM does not end at PUBLISHED:
// a published PWA can be DEPRECATED (superseded, still referenceable) and then RETIRED (withdrawn). Each step drives
// the real engine (DeprecatePwa / RetirePwa), so the UI reflects true aggregate state, not just rendered markup.
test.describe('PWA lifecycle — deprecate then retire a published PWA', () => {
	test.beforeEach(async ({ request }) => {
		// The reference workbench seeds a PUBLISHED "Product Realization" PWA — our starting state.
		await resetEngine(request, 'reference');
	});

	test('advance a PUBLISHED PWA through DEPRECATED to RETIRED', async ({ page, request }) => {
		// 1. Open the seeded PWA from the Library. Read the card link href and navigate to it (rather than clicking)
		//    so we never race a click against Svelte hydration / enhance.
		await gotoHydrated(page, '/');
		const href = await page.getByRole('link', { name: /Product Realization/ }).getAttribute('href');
		expect(href, 'the seeded PWA card should link to its overview').toBeTruthy();
		await gotoHydrated(page, href!);
		// level:1 targets the PWA title h1 specifically — the seeded root PWU Type is also named "Product
		// Realization" and renders as an h3 in the inspector, so an unpinned heading match is ambiguous.
		await expect(
			page.getByRole('heading', { name: 'Product Realization', level: 1 })
		).toBeVisible();

		// 2. Deprecate the published PWA.
		await page.getByRole('button', { name: /^Deprecate$/ }).click();

		// SEMANTIC: the publication status pill now reads DEPRECATED.
		await expect(page.getByText('DEPRECATED', { exact: true })).toBeVisible();

		// TRUTH: the engine really transitioned the PWA's publicationStatus (find it by name, never by hardcoded id).
		let snap = await introspect(request);
		let seeded = snap.pwas.find((p) => p.state.name === 'Product Realization');
		expect(seeded, 'the seeded PWA should exist in engine truth').toBeTruthy();
		expect(seeded?.state.publicationStatus).toBe('DEPRECATED');

		// 3. Retire the now-deprecated PWA.
		await page.getByRole('button', { name: /^Retire$/ }).click();

		// SEMANTIC: the publication status pill now reads RETIRED.
		await expect(page.getByText('RETIRED', { exact: true })).toBeVisible();

		// TRUTH: the engine really recorded the terminal RETIRED state.
		snap = await introspect(request);
		seeded = snap.pwas.find((p) => p.state.name === 'Product Realization');
		expect(seeded?.state.publicationStatus).toBe('RETIRED');

		// VISUAL: capture the retired PWA for review.
		await page.screenshot({ path: 'e2e-results/pwa-lifecycle.png', fullPage: true });
	});
});
