import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';
import { shot } from './support/gallery';

// Layer B, IN-PRODUCT: after an authoring turn, a judge DISTINCT from the executor (the deterministic structural
// assessor under TEST_MODE — exec != assurance) scores the DRAFT PWA's faithfulness to its prompt. The verdict is
// recorded as durable, event-sourced domain state (AUTHORING_ASSESSMENT) and surfaced in the designer (chip + panel).
// A non-faithful result auto-refines ONCE, then escalates to the human-in-the-loop; the human resolves it here.
test.describe('PWA Designer — faithfulness assessment (Layer B, in-product)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'empty');
	});

	test('an authoring turn is assessed, recorded in the engine, and surfaced in the UI', async ({
		page,
		request
	}) => {
		// Create + open a DRAFT PWA.
		await gotoHydrated(page, '/');
		await page.getByRole('button', { name: '+ New PWA' }).click();
		await page.getByPlaceholder(/PWA name/i).fill('Faithfulness PWA');
		await page.getByRole('button', { name: 'Create draft' }).click();
		const card = page.getByRole('link', { name: /Faithfulness PWA/ });
		await expect(card).toBeVisible();
		await gotoHydrated(page, (await card.getAttribute('href'))!);

		// Drive a precise plan so the mock agent builds a graph → the loop assesses it.
		const plan = {
			plan: [
				{ tool: 'define_from_template', args: { templateKey: 'product-behavior', isRoot: true } },
				{ tool: 'define_from_template', args: { templateKey: 'architecture' } }
			]
		};
		await page.getByTestId('agent-input').fill(JSON.stringify(plan));
		await page.getByRole('button', { name: 'Send' }).click();

		// The reasoning log records the build AND the faithfulness assessment (⚖) that follows.
		await expect(page.getByTestId('agent-log')).toContainText('define_from_template');
		await expect(page.getByTestId('agent-log')).toContainText('Faithfulness');

		// The assurance chip + panel surface the verdict in-product (a distinct capability from the graph-health chip).
		await expect(page.getByTestId('assurance-chip')).toBeVisible();
		await expect(page.getByTestId('assurance-panel')).toBeVisible();
		await expect(page.getByTestId('assurance-verdict')).toHaveText(/FAITHFUL|PARTIAL|POOR/);
		await shot(page, 'faithfulness assessed');

		// TRUTH: the engine recorded at least one AUTHORING_ASSESSMENT with the verdict + the assessor vendor (the
		// separation-of-duties record). Under TEST_MODE the assessor is the deterministic mock (providerId 'jpwb').
		const snap = await introspect(request);
		expect(snap.authoringAssessments.length).toBeGreaterThanOrEqual(1);
		const latest = snap.authoringAssessments[snap.authoringAssessments.length - 1];
		expect(['FAITHFUL', 'PARTIAL', 'POOR']).toContain(String(latest.state.verdict));
		expect(String((latest.state.assessor as { providerId?: string })?.providerId ?? '')).toBe(
			'jpwb'
		);

		// If the loop escalated (still unfaithful after the one automatic refinement), exercise the human-in-the-loop
		// resolution — the iteration-2 gate. (Otherwise the first pass was faithful and there is nothing to resolve.)
		const accept = page.getByRole('button', { name: 'Accept as-is' });
		if (await accept.isVisible().catch(() => false)) {
			await accept.click();
			await expect(page.getByTestId('assurance-panel')).toContainText(/resolved/i);
			const after = await introspect(request);
			expect(after.authoringAssessments.some((x) => x.state.status === 'RESOLVED')).toBe(true);
			await shot(page, 'assessment resolved by human');
		}
	});
});
