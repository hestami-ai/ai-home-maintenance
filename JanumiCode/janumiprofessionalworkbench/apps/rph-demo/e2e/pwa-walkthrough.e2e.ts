import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// JAN-PWADESIGNER-DR-001 DWP-04 — the hand-off dependency walkthrough. A READ-ONLY reading aid: step the graph in
// hand-off DEPENDENCY order (never execution order, §9.1), with per-LAYER dependency-step numbers (shared within a
// concurrent layer), an in-layer picker, and a strict non-authoritative guarantee (it writes NOTHING to the engine).
// The graph: Root outputs {a,b}; Left consumes a; Right consumes b → layer 1 = [Root], layer 2 = [Left, Right]
// (concurrent). This exercises stepping, the shared-within-layer badge, the picker, and the non-authoritative reload.

async function defineType(
	page: import('@playwright/test').Page,
	opts: { name: string; kind: string; root?: boolean; inputs?: string; outputs?: string }
): Promise<void> {
	await page.getByRole('button', { name: '+ Define PWU Type' }).click();
	await page.locator('input[name="name"]').fill(opts.name);
	await page.locator('input[name="pwuKind"]').fill(opts.kind);
	if (opts.root) await page.getByLabel(/Root type/).check();
	if (opts.inputs) await page.locator('[name="requiredInputs"]').fill(opts.inputs);
	if (opts.outputs) await page.locator('[name="requiredOutputs"]').fill(opts.outputs);
	await page.getByRole('button', { name: 'Add type' }).click();
	await expect(page.locator('.svelte-flow__node').filter({ hasText: opts.name })).toBeVisible();
}

const badgeOf = (page: import('@playwright/test').Page, nodeName: string) =>
	page.locator('.svelte-flow__node').filter({ hasText: nodeName }).getByTestId('step-badge');

test.describe('PWA Designer — hand-off dependency walkthrough', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('steps hand-off dependency layers with shared per-layer numbers + a picker, and writes nothing', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Walk PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await gotoHydrated(
			page,
			(await page.getByRole('link', { name: /Walk PWA/ }).getAttribute('href'))!
		);

		await defineType(page, { name: 'Root', kind: 'ROOT', root: true, outputs: 'a, b' });
		await defineType(page, { name: 'Left', kind: 'LEFT', inputs: 'a' });
		await defineType(page, { name: 'Right', kind: 'RIGHT', inputs: 'b' });

		// Ground truth BEFORE the walkthrough — the walkthrough must not change it.
		const before = await introspect(request);

		// OFF by default: no controller, no step badges.
		await expect(page.getByTestId('walkthrough-controller')).toHaveCount(0);
		await expect(page.getByTestId('step-badge')).toHaveCount(0);

		// Turn it on.
		await page.getByTestId('walkthrough-toggle').locator('input[type=checkbox]').check();
		await expect(page.getByTestId('walkthrough-controller')).toBeVisible();
		await expect(page.getByTestId('walk-stepcount')).toContainText('Dependency step 1 of 2');

		// The dependency-step badges: Root is step 1; Left and Right SHARE step 2 (a concurrent layer — a partial
		// order, not a fabricated total order). This is the positive category-discipline check.
		await expect(badgeOf(page, 'Root')).toHaveText('1');
		await expect(badgeOf(page, 'Left')).toHaveText('2');
		await expect(badgeOf(page, 'Right')).toHaveText('2');

		// The panel + controller frame it as DEPENDENCY, never execution order.
		await expect(page.getByTestId('walkthrough-panel')).toBeVisible();
		await expect(page.getByTestId('walk-caveat')).toContainText('dependency');
		await expect(page.getByTestId('walk-caveat')).toContainText('NOT an execution schedule');

		// Step to the concurrent layer → the in-layer picker appears with both members.
		await page.getByRole('button', { name: 'Next dependency step' }).click();
		await expect(page.getByTestId('walk-stepcount')).toContainText('Dependency step 2 of 2');
		const picker = page.getByTestId('walk-picker');
		await expect(picker).toBeVisible();
		await expect(picker.getByRole('button', { name: 'Left' })).toBeVisible();
		await expect(picker.getByRole('button', { name: 'Right' })).toBeVisible();

		// NON-AUTHORITATIVE: reload → engine event log is byte-identical (content, not just length).
		await gotoHydrated(page, page.url());
		const after = await introspect(request);
		expect(after.events).toHaveLength(before.events.length);
		expect(JSON.stringify(after.events)).toBe(JSON.stringify(before.events));
		// And the walkthrough is ephemeral — it reset to OFF on reload.
		await expect(page.getByTestId('walkthrough-controller')).toHaveCount(0);
	});
});
