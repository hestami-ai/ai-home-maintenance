import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// N1 — the node-graph PWA Designer. PWU Types render as nodes on a Svelte Flow canvas; a permitted-child link
// renders as a composition edge. Clicking a node selects it into the inspector for editing. This is the surface
// the agent will drive (generating nodes + edges by proposing DefinePwuType / EditPwuType).
test.describe('PWA Designer — node graph', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('PWU Types render as nodes and a permitted-child link renders as an edge', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Graph PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Graph PWA/ }).getAttribute('href'))!
		);

		// Define two PWU Types.
		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Alpha Root');
		await page.locator('input[name="pwuKind"]').fill('ALPHA_ROOT');
		await page.getByLabel(/Root type/).check();
		await page.getByRole('button', { name: 'Add type' }).click();

		await page.getByRole('button', { name: '+ Define PWU Type' }).click();
		await page.locator('input[name="name"]').fill('Beta Child');
		await page.locator('input[name="pwuKind"]').fill('BETA_CHILD');
		await page.getByRole('button', { name: 'Add type' }).click();

		// Two nodes render on the canvas.
		await expect(page.locator('.svelte-flow__node')).toHaveCount(2);

		// Link Alpha Root -> Beta Child (permitted child) by clicking the Alpha node and editing it.
		await page.locator('.svelte-flow__node').filter({ hasText: 'Alpha Root' }).click();
		await page.getByRole('button', { name: 'Edit', exact: true }).click();
		await page.getByLabel('Beta Child').check();
		await page.getByRole('button', { name: 'Save changes' }).click();

		// TRUTH: the engine recorded the composition link.
		const snap = await introspect(request);
		const alpha = snap.pwuTypes.find((t) => t.state.name === 'Alpha Root')!;
		const beta = snap.pwuTypes.find((t) => t.state.name === 'Beta Child')!;
		expect(alpha.state.permittedChildTypeIds).toContain(beta.id);

		// SEMANTIC: a composition edge now renders.
		await expect(page.locator('.svelte-flow__edge')).toHaveCount(1);
		await page.screenshot({ path: 'e2e-results/pwa-node-graph.png', fullPage: true });
	});
});
