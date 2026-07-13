import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// Decision Center authoring — a governance Decision must be proposeable (PROPOSED) and then approveable
// (PROPOSED -> EFFECTIVE), each step driving the real engine. Approval is gated by the decision's HUMAN
// authority (RPH-GOV-001/002): a PROPOSED recommendation is not approval until authority makes it EFFECTIVE.
test.describe('Decision Center — propose and approve a governance Decision', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('propose an APPROVAL decision, then approve it to EFFECTIVE', async ({ page, request }) => {
		await gotoHydrated(page, '/decisions');

		// 1. Reveal the propose form and author an APPROVAL decision.
		await page.getByRole('button', { name: '+ Propose Decision' }).click();
		await page.getByLabel(/Decision type/i).selectOption('APPROVAL');
		await page.getByPlaceholder(/Chosen option/i).fill('Approve delivery v0.1.0');
		await page.getByPlaceholder(/Why this decision/i).fill('Meets acceptance criteria');
		await page.getByRole('button', { name: 'Propose', exact: true }).click();

		// SEMANTIC: the new decision appears as PROPOSED with an Approve action.
		await expect(page.getByText('PROPOSED')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();

		// TRUTH: the engine recorded exactly one PROPOSED APPROVAL decision.
		const proposedSnap = await introspect(request);
		expect(proposedSnap.decisions).toHaveLength(1);
		const proposed = proposedSnap.decisions.find((d) => d.state.decisionType === 'APPROVAL');
		expect(proposed).toBeDefined();
		expect(proposed?.state.status).toBe('PROPOSED');

		// 2. Approve it.
		await page.getByRole('button', { name: 'Approve' }).click();

		// SEMANTIC: the decision now shows EFFECTIVE and the Approve action is gone.
		await expect(page.getByText('EFFECTIVE')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);

		// TRUTH: the engine really transitioned the decision to EFFECTIVE (not just rendered text).
		const approvedSnap = await introspect(request);
		expect(approvedSnap.decisions).toHaveLength(1);
		expect(approvedSnap.decisions[0].state.status).toBe('EFFECTIVE');
		expect(approvedSnap.decisions[0].state.decisionType).toBe('APPROVAL');

		// VISUAL: capture the effective decision for review.
		await page.screenshot({ path: 'e2e-results/decisions.png', fullPage: true });
	});
});
