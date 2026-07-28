import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// JPWB-SPEC-001 SPEC-001-INV-02 / FORK-9 — a Projection SHALL be bound to a declared Projection Scope and SHALL
// NOT present objects outside it.
//
// THE DEFECT THIS PINS, measured in a browser on 2026-07-28. A brand-new Undertaking with zero PWUs rendered the
// SEEDED Undertaking's governance records: 65 assurance assessments, 2 decisions, 2 baselines. Cause:
// `queries.ts:46-51` — `listAssessments`, `listObservations`, `listDecisions` and `listBaselines` took only
// `(h: EngineHandle)` and returned every object of that type in the workspace, while the loader consumed all four
// unscoped (`undertakings/[id]/+page.server.ts:256, 297, 303, 309`).
//
// FOUR OF THE SEVEN TABS WERE ALREADY CORRECT, which is what made this invisible: graph, overview, execution and
// traceability all scope to the Undertaking's PWUs. The execution plane was fixed once, for exactly this bug,
// and its comment names it — "fixing the F-6 bug (listExecutionPlans is engine-GLOBAL, unlike graph/pwuList/
// trace)". Its four siblings in the same file were left. On the seeded Undertaking the leak is invisible because
// that Undertaking owns every object in the workspace; it only shows on a SECOND one.
//
// THE PREDICTED RED: against the pre-fix loader this spec fails on the assessment assertion with 65, not 0.
test.describe('Undertaking Workbench — projections are scoped to their subject (SPEC-001-INV-02)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a second Undertaking shows NONE of the first one\'s governance records', async ({
		page,
		request
	}) => {
		// The arrangement asserted rather than assumed: the workspace must already hold records belonging to the
		// seeded Undertaking, or a scoped view and a broken one are indistinguishable (both empty).
		const seeded = await introspect(request);
		expect(
			seeded.assessments.length,
			'the reference seed must carry assessments for the leak to be observable'
		).toBeGreaterThan(0);
		expect(seeded.baselines.length).toBeGreaterThan(0);
		expect(seeded.decisions.length).toBeGreaterThan(0);

		// Arrange: a second, empty Undertaking.
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Scope Probe');
		await page.getByRole('combobox').selectOption({ index: 1 });
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const link = page.getByRole('link', { name: /Scope Probe/ });
		await expect(link).toBeVisible();
		await gotoHydrated(page, (await link.getAttribute('href'))!);

		// It owns no PWUs, so it owns no assessments, decisions or baselines either.
		for (const tab of ['assurance', 'decisions', 'baselines'] as const) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			const idCells = page.locator('main tbody tr td:first-child');
			const leaked = await idCells.filter({ hasText: /^(asm_|dec_|bsl_|obs_)/ }).count();
			expect(leaked, `the ${tab} tab must show no record belonging to another Undertaking`).toBe(0);
		}

		// Traceability is the CONTROL: it was already scoped before this fix and must remain so. If it ever starts
		// leaking, the repair regressed something it was supposed to leave alone.
		await page.getByRole('button', { name: 'traceability', exact: true }).click();
		await expect(page.getByText(/No traceability links/i)).toBeVisible();
	});

	test('CONTROL: the seeded Undertaking still shows ITS OWN records', async ({ page, request }) => {
		// The mirror. Without it, scoping everything to the empty set would satisfy the test above — the exact
		// over-correction FORK-9's NON-EXAMPLE warns against (scoping must not forbid a legitimate subject view).
		const seeded = await introspect(request);
		await gotoHydrated(page, '/undertakings');
		const link = page.getByRole('link', { name: /Field Service Management/ });
		await gotoHydrated(page, (await link.getAttribute('href'))!);

		await page.getByRole('button', { name: 'assurance', exact: true }).click();
		const shown = await page
			.locator('main tbody tr td:first-child')
			.filter({ hasText: /^asm_/ })
			.count();
		expect(shown, 'the owning Undertaking must still see its own assessments').toBeGreaterThan(0);
		expect(shown).toBeLessThanOrEqual(seeded.assessments.length);

		await page.getByRole('button', { name: 'baselines', exact: true }).click();
		await expect(
			page.locator('main tbody tr td:first-child').filter({ hasText: /^bsl_/ }).first()
		).toBeVisible();
	});
});
