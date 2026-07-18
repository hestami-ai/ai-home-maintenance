import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// The authoring agent's chat history is DOMAIN state (event-sourced in the engine — the AUTHORING_CONVERSATION
// aggregate, a precursor to the governed stream), not a separate side store. Before acceptance it lives in the
// in-process candidate; exact acceptance commits it with the graph, after which it is durable canonical state.
test.describe('PWA Designer — agent chat history is retained', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('a staged turn survives reload in-process and becomes durable only on acceptance', async ({
		page,
		request
	}) => {
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Memory PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Memory PWA/ });
		await expect(card).toBeVisible();
		const href = (await card.getAttribute('href'))!;
		await gotoHydrated(page, href);

		// Drive one agent turn (mock, via the chat).
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
		// Wait for the route-owned terminal lifecycle, not a transient streamed tool line that can be replaced while
		// the final candidate transcript reload is still in flight.
		await expect(page.getByTestId('authoring-candidate-banner')).toContainText('READY_TO_COMMIT', {
			timeout: 15_000
		});

		// Canonical truth is unchanged before acceptance, but a reload can still resolve the in-process preview.
		const staged = await introspect(request);
		expect(staged.conversations).toEqual([]);
		expect(staged.authoringCandidates).toHaveLength(1);
		expect(staged.authoringCandidates[0]!.conversations).toHaveLength(1);
		await gotoHydrated(page, href);
		await expect(page.getByTestId('agent-log')).toContainText('You:');
		await expect(page.getByTestId('agent-log')).toContainText('Defined');

		await page.getByRole('button', { name: 'Accept exact candidate' }).click();
		const snap = await introspect(request);
		expect(snap.conversations).toHaveLength(1);
		expect(String(snap.conversations[0]!.state.pwaId)).toBe(snap.pwas[0]!.id);
		expect(snap.events.some((e) => e.eventType === 'ConversationEntriesAppended')).toBe(true);

		// After guarded commit, a second reload restores the canonical event-sourced transcript.
		await gotoHydrated(page, href);
		const logAfter = page.getByTestId('agent-log');
		await expect(logAfter).toContainText('You:');
		await expect(logAfter).toContainText('Defined');
	});
});
