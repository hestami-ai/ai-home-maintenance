import { test, expect } from '@playwright/test';
import { resetEngine, gotoHydrated } from './support/harness';
import { snapshotPwaGraph } from './support/gallery';

// The harness validates the generated PWA against a QUERYABLE structural report (canonical export → invariants),
// not a screenshot. Deterministic coverage of that path (mock agent, JSON plans): a proper decomposition is
// well-formed; an unlinked type is caught as an orphan. This is the machine-checkable "did the agent generate a
// valid PWA?" gate the live run also uses.
test.describe('PWA graph — structural validity report', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	async function openDraft(page: import('@playwright/test').Page, name: string) {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill(name);
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: new RegExp(name) });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);
	}

	async function runPlan(page: import('@playwright/test').Page, plan: unknown) {
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 15_000 });
	}

	test('a proper decomposition is well-formed (all invariants pass)', async ({ page, request }) => {
		await openDraft(page, 'Valid Graph PWA');
		await runPlan(page, {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{
								tempKey: 'root',
								name: 'Realization',
								pwuKind: 'REALIZATION',
								isRoot: true,
								childTempKeys: ['mid'],
								requiredInputs: ['intent'],
								requiredOutputs: ['intent']
							},
							{
								tempKey: 'mid',
								name: 'Definition',
								pwuKind: 'DEFINITION',
								childTempKeys: ['leaf'],
								requiredInputs: ['intent'],
								requiredOutputs: ['design']
							},
							{ tempKey: 'leaf', name: 'Build', pwuKind: 'BUILD', requiredInputs: ['design'] }
						]
					}
				}
			]
		});
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('READY_TO_COMMIT');
		await page.getByRole('button', { name: 'Accept exact candidate' }).click();

		const { report } = await snapshotPwaGraph(request, 'valid-graph');
		expect(report.valid, JSON.stringify(report.invariants)).toBe(true);
		expect(report.metrics.rootCount).toBe(1);
		expect(report.metrics.orphanCount).toBe(0);
		expect(report.metrics.cycleCount).toBe(0);
		expect(report.metrics.maxDepth).toBeGreaterThanOrEqual(2);
	});

	test('an unlinked type is caught as an orphan (connected invariant fails)', async ({ page }) => {
		await openDraft(page, 'Orphan Graph PWA');
		await runPlan(page, {
			plan: [
				{
					tool: 'scaffold_graph',
					args: {
						types: [
							{ tempKey: 'root', name: 'Root', pwuKind: 'ROOT', isRoot: true },
							{ tempKey: 'stray', name: 'Stray', pwuKind: 'STRAY' }
						]
					}
				}
			]
		});

		// An invalid candidate is intentionally not commit-eligible, so assert the structured preview report rather
		// than blurring it into canonical introspection.
		const health = page.getByTestId('graph-health');
		await expect(health).toHaveAttribute('data-graph-valid', 'false');
		await expect(health).toHaveAttribute('data-orphan-count', '1');
		await expect(health).toHaveAttribute('title', /connected/i);
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('REVISION_REQUIRED');
	});
});
