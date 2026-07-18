import { test, expect } from '@playwright/test';
import { gotoHydrated, introspect, resetEngine } from './support/harness';

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}

// UI-backbone gate: the browser must execute the intended Stately Graph -> ELK path, canvas history must remain
// presentation-only, and the XState actor must remain a local lifecycle-topology simulation with no engine writes.
test.describe('PWA Designer — authoring backbone', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('ELK layout, canvas undo, and lifecycle simulation stay non-authoritative', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		const link = page.getByRole('link', { name: /Product Realization/ }).first();
		const href = await link.getAttribute('href');
		expect(href).toBeTruthy();
		const eventsBefore = (await introspect(request)).events.length;

		await gotoHydrated(page, href!);
		await expect(page.getByTestId('layout-engine')).toHaveText('Layout: ELK');
		await expect(page.getByLabel('PWA composition layout')).toHaveValue('RIGHT');
		await expect(page.getByText('PWU work-lifecycle axis', { exact: true })).toBeVisible();
		await expect(
			page.getByText(/executionState.*assuranceState.*shapeIntegrityState.*not simulated/)
		).toBeVisible();

		const flowNodes = page.locator('.svelte-flow__node');
		await expect(flowNodes.first()).toBeVisible();
		const cardGeometry = await flowNodes.evaluateAll((elements) =>
			elements.map((element) => {
				const style = getComputedStyle(element);
				return { width: style.width, height: style.height };
			})
		);
		for (const geometry of cardGeometry) {
			expect(geometry).toEqual({ width: '240px', height: '160px' });
		}

		const expectNodesClearOfPanels = async () => {
			const panelBoxes = (
				await Promise.all(
					[
						page.getByTestId('agent-panel'),
						page.getByTestId('inspector-panel'),
						page.getByTestId('assurance-panel'),
						page.getByTestId('overlay-toggle')
					].map(async (panel) => ((await panel.count()) === 0 ? null : panel.boundingBox()))
				)
			).filter((box): box is Box => box !== null);
			for (const nodeBox of await flowNodes.evaluateAll((elements) =>
				elements.map((element) => element.getBoundingClientRect().toJSON() as Box)
			)) {
				for (const panelBox of panelBoxes) expect(overlaps(nodeBox, panelBox)).toBe(false);
			}
		};
		await expectNodesClearOfPanels();
		await page.getByRole('button', { name: 'Fit View' }).click();
		await expectNodesClearOfPanels();

		const rootNode = page.locator('.svelte-flow__node').filter({ hasText: 'Product Realization' });
		await expect(rootNode).toBeVisible();
		const undo = page.getByRole('button', { name: 'Undo canvas move' });
		const redo = page.getByRole('button', { name: 'Redo canvas move' });
		await expect(undo).toBeDisabled();
		const assuranceRail = rootNode.getByRole('region', {
			name: 'Assurance policies for Product Realization'
		});
		await assuranceRail.focus();
		const beforeRailKey = await rootNode.boundingBox();
		await page.keyboard.press('ArrowDown');
		const afterRailKey = await rootNode.boundingBox();
		expect(afterRailKey).toEqual(beforeRailKey);
		await expect(undo).toBeDisabled();

		const beforeBox = await rootNode.boundingBox();
		expect(beforeBox).not.toBeNull();
		await page.mouse.move(
			beforeBox!.x + beforeBox!.width / 2,
			beforeBox!.y + beforeBox!.height / 2
		);
		await page.mouse.down();
		await page.mouse.move(
			beforeBox!.x + beforeBox!.width / 2 + 90,
			beforeBox!.y + beforeBox!.height / 2 + 45,
			{ steps: 6 }
		);
		await page.mouse.up();
		await expect(undo).toBeEnabled();
		await undo.click();
		const restoredBox = await rootNode.boundingBox();
		expect(restoredBox).not.toBeNull();
		expect(Math.abs(restoredBox!.x - beforeBox!.x)).toBeLessThan(2);
		expect(Math.abs(restoredBox!.y - beforeBox!.y)).toBeLessThan(2);

		// Native Svelte Flow arrow-key movement must enter the same history instead of silently bypassing it.
		await rootNode.focus();
		const beforeKeyboardBox = await rootNode.boundingBox();
		expect(beforeKeyboardBox).not.toBeNull();
		await page.keyboard.press('ArrowRight');
		await expect(undo).toBeEnabled();
		await expect(redo).toBeDisabled();
		const keyboardMovedBox = await rootNode.boundingBox();
		expect(keyboardMovedBox).not.toBeNull();
		expect(keyboardMovedBox!.x).toBeGreaterThan(beforeKeyboardBox!.x);
		await undo.click();
		const keyboardRestoredBox = await rootNode.boundingBox();
		expect(keyboardRestoredBox).not.toBeNull();
		expect(Math.abs(keyboardRestoredBox!.x - beforeKeyboardBox!.x)).toBeLessThan(2);
		expect(Math.abs(keyboardRestoredBox!.y - beforeKeyboardBox!.y)).toBeLessThan(2);

		await expect(page.getByText('Simulated state')).toBeVisible();
		await expect(page.locator('output').filter({ hasText: 'Simulated state' })).toContainText(
			'PROPOSED'
		);
		await page.getByRole('button', { name: 'Simulate PROPOSED to SHAPING' }).click();
		await expect(page.locator('output').filter({ hasText: 'Simulated state' })).toContainText(
			'SHAPING'
		);
		await page.getByRole('button', { name: 'Simulate SHAPING to READY' }).click();
		await expect(page.locator('output').filter({ hasText: 'Simulated state' })).toContainText(
			'READY'
		);
		await page.getByRole('button', { name: 'Restart simulation' }).click();
		await expect(page.locator('output').filter({ hasText: 'Simulated state' })).toContainText(
			'PROPOSED'
		);

		// Reload proves the actor snapshot was never persisted; engine truth proves neither simulation nor canvas
		// movement emitted a canonical Event.
		await gotoHydrated(page, href!);
		await expect(page.getByTestId('layout-engine')).toHaveText('Layout: ELK');
		await expect(page.locator('output').filter({ hasText: 'Simulated state' })).toContainText(
			'PROPOSED'
		);
		expect((await introspect(request)).events).toHaveLength(eventsBefore);

		await page.screenshot({ path: 'e2e-results/pwa-authoring-backbone.png', fullPage: true });
	});
});
