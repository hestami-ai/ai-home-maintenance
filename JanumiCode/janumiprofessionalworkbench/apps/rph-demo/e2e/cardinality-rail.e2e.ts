import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// §11.7.2 / §11.7.4 — authoring per-child cardinality (M1/M+/C1/C+) and declared assurance policies through the
// inspector form, then seeing them render: a cardinality badge on each permitted child + the assurance rail (locked
// de-minimis floor + declared policies). Verifies the full round-trip form -> command -> engine -> load -> inspector.
test.describe('PWA Designer — cardinality + assurance rail', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('author a permitted child with M+ cardinality + a declared policy, and see the rail', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Rail PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Rail PWA/ }).getAttribute('href'))!
		);

		// Define a root + a child type.
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Realization Root');
		await page.locator('input[name="pwuKind"]').fill('REALIZATION');
		await page.getByLabel(/Root type/).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Behavior Definition');
		await page.locator('input[name="pwuKind"]').fill('BEHAVIOR');
		await page.getByRole('button', { name: 'Add type' }).click();

		// Edit the root: permit the child with M+ cardinality, and declare the Intent Preservation policy.
		await page.locator('.svelte-flow__node').filter({ hasText: 'Realization Root' }).click();
		await page.getByRole('button', { name: 'Edit', exact: true }).click();
		await page.getByRole('checkbox', { name: 'Behavior Definition', exact: true }).check();
		await page.getByRole('combobox', { name: 'Cardinality for Behavior Definition' }).selectOption('M+');
		await page.getByRole('checkbox', { name: 'Intent Preservation', exact: true }).check();
		await page.getByRole('button', { name: 'Save changes' }).click();

		// TRUTH: the engine recorded the cardinality rule + the declared policy on the root type.
		const snap = await introspect(request);
		const root = snap.pwuTypes.find((t) => t.state.name === 'Realization Root')!;
		const child = snap.pwuTypes.find((t) => t.state.name === 'Behavior Definition')!;
		expect(root.state.permittedChildTypeIds).toContain(child.id);
		expect(root.state.permittedChildren).toContainEqual(
			expect.objectContaining({ typeId: child.id, cardinality: 'M+' })
		);
		expect(root.state.requiredAssurancePolicyIds).toContain('pol_intent_preservation');

		// SEMANTIC: the inspector shows the cardinality badge, the locked floor, and the declared policy.
		await page.locator('.svelte-flow__node').filter({ hasText: 'Realization Root' }).click();
		const inspector = page.locator('.inspectorpanel');
		await expect(inspector.locator('.cardbadge', { hasText: 'M+' })).toBeVisible();
		await expect(inspector.getByText('de minimis floor')).toBeVisible();
		await expect(inspector.getByText('+ Intent Preservation')).toBeVisible();
	});
});
