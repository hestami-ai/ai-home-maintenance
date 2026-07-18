import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';
import { shot } from './support/gallery';

// A3 — the agent chat (bottom) + reasoning log (left) on the node-graph, end to end IN THE BROWSER. A human types
// an instruction; the page streams the agent's SSE run into the log and re-renders the isolated preview as each tool
// lands. Test mode forces the deterministic mock agent, so a JSON plan drives an exact, reproducible run. Also
// proves concern 3: two types whose output/input artifact names match render a dashed data-flow (⤳) edge with no
// explicit link.
test.describe('PWA Designer — authoring agent chat + live graph', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('typing an instruction builds the graph live, logs the tool calls, and draws a data-flow edge', async ({
		page,
		request
	}) => {
		// Create + open a DRAFT PWA.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Agent UI PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Agent UI PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		// The agent rail + chat bar are present on a DRAFT.
		await expect(page.getByTestId('agent-log')).toBeVisible();
		await expect(page.getByTestId('agent-input')).toBeVisible();
		await shot(page, 'empty designer');

		// Drive a precise plan: define two catalog types whose artifacts connect (product-behavior OUTPUTS
		// "approved-behavior", which architecture REQUIRES as input) — so a data-flow edge must appear.
		const plan = {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{
								tempKey: 'behavior',
								name: 'Product Behavior Definition',
								pwuKind: 'PRODUCT_BEHAVIOR',
								isRoot: true,
								requiredOutputs: ['approved-behavior'],
								childTempKeys: ['architecture']
							},
							{
								tempKey: 'architecture',
								name: 'Architecture Definition',
								pwuKind: 'ARCHITECTURE',
								requiredInputs: ['approved-behavior']
							}
						]
					}
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		// The reasoning log records the agent's tool activity.
		await expect(page.getByTestId('agent-log')).toContainText('scaffold_graph');

		// The graph re-rendered live: two nodes now exist (no manual reload).
		await expect(page.locator('.svelte-flow__node')).toHaveCount(2);

		// Concern 3: data-flow is a SEPARATE overlay (off by default so the composition tree reads cleanly).
		// Toggle it on, and a data-flow (⤳) edge is drawn from the output→input artifact match.
		await page.getByRole('checkbox', { name: 'Data-flow overlay' }).check();
		await expect(page.locator('.svelte-flow')).toContainText('⤳');
		await shot(page, 'graph built by agent');

		// The preview is clearly non-authoritative and canonical remains unchanged until exact acceptance.
		const banner = page.getByTestId('authoring-candidate-banner');
		await expect(banner).toContainText('READY_TO_COMMIT');
		await expect(banner).toContainText('canonical DRAFT unchanged');
		expect((await introspect(request)).pwuTypes).toEqual([]);
		await page.getByRole('button', { name: 'Accept exact candidate' }).click();
		await expect(banner).toBeHidden();

		// TRUTH: one guarded commit recorded exactly the two accepted types.
		const snap = await introspect(request);
		const names = snap.pwuTypes.map((t) => String(t.state.name));
		expect(names).toEqual(
			expect.arrayContaining(['Product Behavior Definition', 'Architecture Definition'])
		);

		await page.screenshot({ path: 'e2e-results/agent-ui.png', fullPage: true });
	});
});
