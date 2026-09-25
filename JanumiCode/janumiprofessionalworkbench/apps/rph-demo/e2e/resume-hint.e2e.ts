import { expect } from '@playwright/test';
import { test, resetEngine, gotoHydrated } from './support/harness';

// ⛔ REG-F-447 — AN INCONCLUSIVE REVIEW IS NOT A FAILED CALL, AND THE PAGE MUST NOT SAY IT IS.
//
// A draft the declared stand-in cannot fully judge — nothing registered, so the seven criteria the structural
// checker cannot answer arrive UNABLE_TO_DETERMINE — stages BLOCKED_EXTERNAL, as it did under the mock. The page
// used to print "The reviewer call failed (external/operational)" for every BLOCKED_EXTERNAL; the reviewer ran,
// and could not settle every mandatory question. The hint now carries the floor's own guidance.
test.describe('Assurance floor — the resume hint names the recorded cause', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('an unregistered clean draft is described as an INCOMPLETE review, not a failed call', async ({ page }) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Resume Hint PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Resume Hint PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		const plan = {
			plan: [{ tool: 'scaffold_graph', args: { types: [{ tempKey: 'plan', name: 'Plan', pwuKind: 'PLAN', isRoot: true }] } }]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('BLOCKED_EXTERNAL');
		const hint = page.getByTestId('candidate-resume-hint');
		await expect(hint).toContainText('is incomplete');
		await expect(hint).not.toContainText('reviewer call failed');
	});
});
