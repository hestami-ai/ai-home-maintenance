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

		// SEMANTIC: the new PWU Type shows as a node in the Work Architecture graph.
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Delivery Realization' })
		).toBeVisible();

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

	// ── ⭑⭑ JAN-EXECGOV EG-06 — THE HELP A PROFESSIONAL READS DOES NOT CLAIM GOVERNANCE THAT DOES NOT EXIST ──
	//
	// Measured across the twenty controls of this form: five help strings asserted a guarantee the code does not
	// make. The worst was `completionRule` — "When an Instance of this type is DONE ... (no green without
	// assurance)" — where NOTHING evaluates the field, and "no green without assurance" is a REAL guarantee made
	// by requireGoverningPolicies and the locked floor, keyed on other fields entirely. A true guarantee attached
	// to an inert textbox is a reason to trust it.
	//
	// ⚠ THIS SPEC EXISTS BECAUSE THE GATE CANNOT SEE A BROWSER. verif/authoring-field-disposition.test.ts asserts
	// the admission is in the string and that the string is referenced by the markup; only this asserts a person
	// can read it. Content authored, validated, and terminated at the surface boundary is this repository's own
	// recurring finding.
	test('an unenforced PWU Type setting admits that, where the author reads it (EG-06)', async ({ page }) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Help Honesty PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Help Honesty PWA/ }).getAttribute('href'))!
		);
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();

		const form = page.locator('form.typeform');
		// ⛔ THE ADMISSION. Before EG-06 this box claimed to decide when work is DONE.
		await expect(form.getByText(/RECORDED AND SHOWN, not evaluated/i)).toBeVisible();
		await expect(form.getByText(/no gate reads it/i)).toBeVisible();
		// ⭑ AND IT REDIRECTS the author to what actually holds a PWU back, rather than only warning them off.
		await expect(form.getByText(/locked floor plus the policies selected by/i)).toBeVisible();
		// The composition claim: it builds the graph, it does not permit or forbid. ⚠ THIS ASSERTION IS WHY THE
		// E2E EARNED ITS PLACE — it first failed, because the string EG-06 corrected for this control
		// (`permittedChildTypeIds`) was rendered by NOTHING. The admission was folded into the help that IS
		// rendered, and the dead entry deleted.
		await expect(form.getByText(/NOT AN ALLOW-LIST/i)).toBeVisible();

		// ⭑⭑ CONTROL — a field that IS enforced still says so. Without this the remedy degrades into
		// "disclaim everything", and a professional told that nothing works stops reading the notes at all.
		await expect(form.getByText(/Publishing requires a root/i)).toBeVisible();
	});
});
