import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// The authoring agent's chat history is DOMAIN state (event-sourced in the engine — the AUTHORING_CONVERSATION
// aggregate, a precursor to the governed stream), not ephemeral client memory. So it survives a page reload /
// navigation: this drives one agent turn, reloads the page, and asserts the transcript is restored — plus the
// engine ground truth (a conversation object + a ConversationEntriesAppended event).
test.describe('PWA Designer — agent chat history is retained', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('a turn survives a full page reload (durable, event-sourced)', async ({ page, request }) => {
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
				{ tool: 'define_from_template', args: { templateKey: 'product-realization', isRoot: true } }
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();
		await expect(page.getByTestId('agent-log')).toContainText('Defined');

		// TRUTH: the conversation is event-sourced in the engine.
		const snap = await introspect(request);
		expect(snap.conversations).toHaveLength(1);
		expect(String(snap.conversations[0]!.state.pwaId)).toBe(snap.pwas[0]!.id);
		expect(snap.events.some((e) => e.eventType === 'ConversationEntriesAppended')).toBe(true);

		// RELOAD the page from scratch — the transcript is restored, not lost.
		await gotoHydrated(page, href);
		const logAfter = page.getByTestId('agent-log');
		await expect(logAfter).toContainText('You:');
		await expect(logAfter).toContainText('Defined');
	});
});
