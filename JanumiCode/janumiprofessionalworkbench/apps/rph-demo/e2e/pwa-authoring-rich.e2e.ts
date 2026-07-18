import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Foundations F1/F2/F3 — the PWA Designer authoring overhaul. Proves the fixes to "the create flow doesn't explain
// the fields", "the fields don't match the full ambition", and "you can specify PWUs but can't edit them":
// rich fields with inline help, a copy-on-use template catalog, and edit + remove of PWU Types (DRAFT-only).
test.describe('PWA Designer — rich PWU Type authoring (fields, help, template, edit, remove)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('define from a template with rich fields, see field help, edit, and remove', async ({
		page,
		request
	}) => {
		// Create + open a DRAFT PWA.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Ops PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Ops PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		// Open the define form from a collapsed inspector. Define is an explicit mode transition, so it must expand the
		// inspector and expose the field HELP (the guidance the create flow was missing).
		await page.getByRole('button', { name: 'Collapse inspector' }).click();
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await expect(page.locator('#pwu-type-form-heading')).toBeFocused();
		await expect(page.getByText(/SCREAMING_SNAKE token classifying the work/)).toBeVisible();

		// FROM A TEMPLATE (the copy-on-use PWU library) + a custom completion rule + mark root (rich fields).
		await page.getByLabel('Start from template').selectOption({ label: 'Architecture Definition' });
		await page.locator('input[name="completionRule"]').fill('architecture done rule');
		await page.getByLabel(/Root type/).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		// TRUTH: persisted with the template's kind + the custom completion rule + root.
		let snap = await introspect(request);
		let t = snap.pwuTypes.find((x) => x.state.name === 'Architecture Definition');
		expect(t, 'the defined PWU Type exists in engine truth').toBeTruthy();
		expect(t!.state.pwuKind).toBe('ARCHITECTURE');
		expect(t!.state.completionRule).toBe('architecture done rule');
		expect(t!.state.isRoot).toBe(true);

		// EDIT the type in place (the control that was missing) — it auto-selects into the inspector after define.
		await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Edit', exact: true }).click();
		await page.locator('textarea[name="purpose"]').fill('the revised architecture purpose');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
		snap = await introspect(request);
		t = snap.pwuTypes.find((x) => x.state.name === 'Architecture Definition');
		expect(t!.state.purpose).toBe('the revised architecture purpose');
		expect(t!.state.completionRule).toBe('architecture done rule'); // untouched field preserved

		// REMOVE the type — it disappears from the Work Architecture (tombstoned).
		await page.getByRole('button', { name: 'Remove', exact: true }).click();
		await expect(page.locator('.svelte-flow__node')).toHaveCount(0);
		snap = await introspect(request);
		expect(snap.pwuTypes.some((x) => x.state.name === 'Architecture Definition')).toBe(false);

		await page.screenshot({ path: 'e2e-results/pwa-authoring-rich.png', fullPage: true });
	});
});
