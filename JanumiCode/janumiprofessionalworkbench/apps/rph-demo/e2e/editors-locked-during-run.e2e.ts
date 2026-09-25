import { expect } from '@playwright/test';
import { test, resetEngine, gotoHydrated } from './support/harness';

// ⭐ NO MANUAL EDITOR IS OFFERED WHILE AN AGENT RUN IS LIVE (`JAN-CRITREAD` `DD-4`, `REG-D-070` §5.6). The page shows
// the draft's FORK from the moment a run begins; an edit made then would write canonical, be invisible on this page,
// and refuse the draft at acceptance. The editors used to be offered EXACTLY while the run was
// (`editable = isDraft && (!hasStagedCandidate || running)`). The server refuses such a write anyway; this is the page
// no longer offering it.
//
// The run is HELD OPEN by intercepting its request, so "during the run" is a state this test stands in rather than a
// race it hopes to win.
test.describe('PWA Designer — no manual edit while the agent runs', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('the manual editors go while a run is live, stay gone while its candidate is staged, and return on discard', async ({
		page
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Locked PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Locked PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		const define = page.getByRole('button', { name: '+ Define PWU Type' });
		const details = page.getByRole('button', { name: 'Edit details' });
		// CONTROL: offered before any run — without it, "gone" below would hold for a page that never offered them.
		await expect(define).toBeVisible();
		await expect(details).toBeVisible();

		let release!: () => void;
		const held = new Promise<void>((resolve) => (release = resolve));
		await page.route('**/agent', async (route) => {
			await held;
			await route.continue();
		});
		const plan = {
			plan: [
				{
					tool: 'define_pwu_type',
					args: { name: 'Product Realization', pwuKind: 'PRODUCT_REALIZATION', isRoot: true }
				}
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		// THE RUN IS LIVE — its request is held open — and no manual editor is offered.
		await expect(page.getByTestId('agent-log')).toContainText('You:');
		await expect(define).toHaveCount(0);
		await expect(details).toHaveCount(0);

		release();
		// ⚠ ANY STAGED STATUS, DELIBERATELY. In the default lane the reviewer call fails and the candidate lands in
		// BLOCKED_EXTERNAL (`REG-D-067`'s accepted reds wait for READY_TO_COMMIT and fail for exactly that reason); the
		// property here is about ANY staged candidate, so waiting for READY_TO_COMMIT would add a red it does not own.
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('Staged agent candidate', {
			timeout: 15_000
		});
		// The candidate is STAGED: still none.
		await expect(define).toHaveCount(0);
		await expect(details).toHaveCount(0);

		await page.getByRole('button', { name: 'Discard candidate' }).click();
		await expect(page.getByTestId('authoring-candidate-banner')).toHaveCount(0);
		// Released: offered again.
		await expect(define).toBeVisible();
		await expect(details).toBeVisible();
	});
});
