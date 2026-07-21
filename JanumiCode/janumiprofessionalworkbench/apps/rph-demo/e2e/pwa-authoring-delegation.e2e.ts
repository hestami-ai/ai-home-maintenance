import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// JAN-PRPWA-DS-001 STD-2/STD-3 (DWP-05, RC-4): a human can author a DELEGATED_EXTERNAL leaf through the PWA
// Designer form — the child block yields to a boundary-contract sub-form — and the delegated leaf round-trips
// through the engine (executionBoundary + boundaryContract persisted, children cleared at the write boundary) and
// renders in the inspector with a DELEGATED badge and its contract.
test.describe('PWA Designer — delegated-leaf authoring', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('author a DELEGATED_EXTERNAL leaf: child block hides, contract appears, round-trips + inspects', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Encounter PWA');
		await page.getByPlaceholder(/Domain/i).fill('healthcare');
		await page.getByRole('button', { name: 'Create draft' }).click();
		await page.getByRole('link', { name: /Encounter PWA/ }).click();
		await expect(page.getByRole('heading', { name: 'Encounter PWA' })).toBeVisible();

		// An INTERNAL root, then a DELEGATED leaf.
		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Patient Encounter');
		await page.locator('input[name="pwuKind"]').fill('ENCOUNTER');
		await page.getByLabel(/Root type/i).check();
		await page.getByRole('button', { name: 'Add type' }).click();
		await expect(
			page.locator('.svelte-flow__node').filter({ hasText: 'Patient Encounter' })
		).toBeVisible();

		await page.getByRole('button', { name: /Define PWU Type/i }).click();
		await page.locator('input[name="name"]').fill('Bloodwork');
		await page.locator('input[name="pwuKind"]').fill('BLOODWORK');

		// Before delegation: the composition (child) block is present; the contract sub-form is not.
		await expect(page.getByText('Permitted child types + cardinality')).toBeVisible();
		await expect(page.getByTestId('boundary-contract')).toHaveCount(0);

		// Delegate across the boundary — the child block yields to the STD-3 contract sub-form.
		await page.locator('select[name="executionBoundary"]').selectOption('DELEGATED_EXTERNAL');
		await expect(page.getByText('Permitted child types + cardinality')).toHaveCount(0);
		await expect(page.getByTestId('boundary-contract')).toBeVisible();

		await page.locator('input[name="counterpartyLabel"]').fill('Contract Lab — Hematology');
		await page.locator('input[name="boundaryApplicabilityNote"]').fill('STAT panels only');
		await page.getByRole('button', { name: 'Add type' }).click();

		// TRUTH: the engine persisted a DELEGATED_EXTERNAL leaf with its contract and NO children (INV-1).
		const snap = await introspect(request);
		const bloodwork = snap.pwuTypes.find((t) => t.state.name === 'Bloodwork');
		expect(bloodwork, 'Bloodwork type exists').toBeTruthy();
		expect(bloodwork!.state.executionBoundary).toBe('DELEGATED_EXTERNAL');
		expect(bloodwork!.state.permittedChildTypeIds).toEqual([]);
		const contract = bloodwork!.state.boundaryContract as {
			counterpartyLabel: string;
			attestedAssurancePolicyIds: string[];
			applicabilityNote?: string;
		};
		expect(contract.counterpartyLabel).toBe('Contract Lab — Hematology');
		expect(contract.applicabilityNote).toBe('STAT panels only');

		// INSPECTOR: the delegated node shows a DELEGATED badge + its boundary contract (via the shared leafKind).
		await page.locator('.svelte-flow__node').filter({ hasText: 'Bloodwork' }).click();
		await expect(page.getByTestId('inspector-boundary')).toContainText('DELEGATED');
		await expect(page.getByTestId('inspector-boundary')).toContainText('Delegated leaf');
		await expect(page.getByTestId('inspector-boundary-contract')).toContainText(
			'Contract Lab — Hematology'
		);
	});
});
