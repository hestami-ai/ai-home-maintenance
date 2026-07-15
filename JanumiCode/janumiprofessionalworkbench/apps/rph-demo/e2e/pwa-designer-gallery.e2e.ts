import { test } from '@playwright/test';
import { resetEngine, gotoHydrated } from './support/harness';
import { shot } from './support/gallery';

// Review gallery for the PWA Designer renderer (§11.7): the composition TREE, collapse/expand, and the data-flow
// OVERLAY. These tests exist to populate e2e-results/gallery/index.html with the marquee views — the assertions are
// deliberately light (the correctness of these surfaces is proven by pwa-node-graph / cardinality-rail / agent-ui).
test.describe('PWA Designer — review gallery', () => {
	test('the seeded reference PWA renders as a composition tree, and a subtree collapses', async ({
		page,
		request
	}) => {
		await resetEngine(request, 'reference');
		await gotoHydrated(page, '/');
		const link = page.getByRole('link', { name: /Product Realization/ }).first();
		await gotoHydrated(page, (await link.getAttribute('href'))!);
		await page.locator('.svelte-flow__node').first().waitFor();
		await page.waitForTimeout(600);
		await shot(page, 'seeded reference PWA — full composition tree + assurance rail');

		// Collapse the Architecture Definition subtree (hides its Architecture Concern child).
		await page
			.locator('.svelte-flow__node')
			.filter({ hasText: 'Architecture Definition' })
			.getByRole('button', { name: 'Collapse subtree' })
			.click();
		await page.waitForTimeout(400);
		await shot(page, 'Architecture Definition subtree collapsed');
	});

	test('an authored graph shows the data-flow overlay off by default, then toggled on', async ({
		page,
		request
	}) => {
		await resetEngine(request, 'empty');
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Gallery Flow PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Gallery Flow PWA/ }).getAttribute('href'))!
		);

		// Scaffold a linked pair whose output/input artifact names match, so a data-flow edge exists to reveal.
		const plan = {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{
								tempKey: 'beh',
								name: 'Product Behavior Definition',
								pwuKind: 'PRODUCT_BEHAVIOR',
								isRoot: true,
								requiredOutputs: ['approved-behavior'],
								childTempKeys: ['arch'],
								childCardinalities: [{ tempKey: 'arch', cardinality: 'M1' }]
							},
							{
								tempKey: 'arch',
								name: 'Architecture Definition',
								pwuKind: 'ARCHITECTURE',
								requiredInputs: ['approved-behavior'],
								requiredOutputs: ['architecture-baseline']
							}
						]
					}
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await page.locator('.svelte-flow__node').nth(1).waitFor();
		await page.waitForTimeout(600);
		await shot(page, 'composition tree — data-flow overlay OFF (clean by default)');

		await page.getByRole('checkbox', { name: 'Data-flow overlay' }).check();
		await page.waitForTimeout(400);
		await shot(page, 'data-flow overlay ON — the ⤳ hand-off edge appears');
	});
});
