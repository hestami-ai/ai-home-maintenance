import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

// S-1 of ROADMAP-decision-subject-scope (REG-F-077) — ABANDONMENT, one of the three acts JPWB-DOC-001 §5.2
// reserves to Governance by name.
//
// WHAT WAS MISSING WAS THE ACT. W-1 gave abandonment a real guard (`resolveAbandonAuthorization`: an EFFECTIVE
// `ABANDON` Decision NAMING this PWU), and REG-F-070's surviving limb was that no surface could satisfy it.
// Measured before this spec: `AbandonPwu` was dispatched NOWHERE in `apps/rph-demo`.
//
// ⚠ THIS SPEC DRIVES THE ENGINE'S REFUSAL, WHICH S-0's COULD NOT. On the baselines route the surface resolves the
// authorizing decision itself, so it refuses before dispatching and the engine's own findings are unreachable
// from that page. Here the unauthorized attempt is posted straight at the command bus through `/test-api/dispatch`
// — the SAME bus the UI uses, no back door — so what refuses it is `resolveAbandonAuthorization`, not a form.
test.describe('Undertaking Workbench — abandonment is a governance act', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('AbandonPwu is REFUSED without an authorizing Decision, and the surface performs it with one', async ({
		page,
		request
	}) => {
		// An Undertaking created from the published PWA auto-instantiates its composition tree, so its PWUs are
		// PROPOSED — i.e. ACTIVE, which is the source set of the machine's `Any active -> ABANDONED`.
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Abandonment Pilot');
		await page.getByPlaceholder(/Objective/i).fill('Prove the governance act end to end');
		await page.getByPlaceholder(/Intended product/i).fill('Abandonment Pilot App');
		await page
			.getByRole('combobox', { name: 'Instantiate from published PWA' })
			.selectOption({ index: 1 });
		await declareRisk(page);
		await page.getByRole('button', { name: 'Create Undertaking' }).click();

		const row = page.getByRole('link', { name: /Abandonment Pilot/ });
		await expect(row).toBeVisible();
		const href = await row.getAttribute('href');
		await gotoHydrated(page, href!);

		let snap = await introspect(request);
		const undertaking = snap.undertakings.find((u) => u.state.name === 'Abandonment Pilot')!;
		const target = snap.pwus.find(
			(p) => p.state.undertakingId === undertaking.id && p.state.workLifecycleState === 'PROPOSED'
		)!;
		expect(target, 'an ACTIVE PWU to abandon').toBeTruthy();

		// 1. THE ENGINE REFUSES AN UNAUTHORIZED ABANDONMENT. Posted at the command bus directly, because the UI
		//    (correctly) never offers this shape — the decision id names an object that is not an ABANDON
		//    authorization for this PWU.
		const unauthorized = await request.post('/test-api/dispatch', {
			data: {
				steps: [
					[
						'AbandonPwu',
						'PROFESSIONAL_WORK_UNIT',
						target.id,
						{ abandonmentDecisionId: 'dec_does_not_exist', reasonCode: 'NO_LONGER_REQUIRED' }
					]
				]
			}
		});
		const refused = (await unauthorized.json()) as {
			ok: boolean;
			results: { status: string; message?: string }[];
		};
		expect(refused.ok, 'an unauthorized abandonment must not be accepted').toBe(false);
		expect(refused.results[0]!.message ?? '').toContain('names no recorded object');

		// TRUTH: the engine did not move it, and invented no Decision to let the act through.
		snap = await introspect(request);
		expect(snap.pwus.find((p) => p.id === target.id)!.state.workLifecycleState).toBe('PROPOSED');
		const abandonDecisionsBefore = snap.decisions.filter(
			(d) => d.state.decisionType === 'ABANDON'
		);
		expect(abandonDecisionsBefore).toHaveLength(0);

		// 2. THE SURFACE PERFORMS IT — authorize and abandon in one atomic action, the subject DERIVED from the
		//    row rather than picked.
		await page.getByRole('button', { name: 'overview' }).click();
		await page
			.getByRole('row', { name: new RegExp(String(target.state.title)) })
			.getByRole('button', { name: 'Abandon', exact: true })
			.click();
		await expect(page.getByText('abandoned', { exact: true }).first()).toBeVisible();

		// TRUTH: the PWU is ABANDONED, and exactly one ABANDON decision exists — NAMING this PWU. Asserting the
		// rendered badge alone would pass on a decision carrying `subjectObjectIds: []`, which is the defect.
		snap = await introspect(request);
		expect(snap.pwus.find((p) => p.id === target.id)!.state.workLifecycleState).toBe('ABANDONED');
		const authorizations = snap.decisions.filter((d) => d.state.decisionType === 'ABANDON');
		expect(authorizations).toHaveLength(1);
		expect(authorizations[0]!.state.status).toBe('EFFECTIVE');
		expect(authorizations[0]!.state.subjectObjectIds).toEqual([target.id]);

		// ⚠ NO STALENESS CASE IS ASSERTED, AND ITS ABSENCE IS DELIBERATE (DESIGN §4).
		// `resolveAbandonAuthorization` also checks the pinned version against the PWU's current one, but
		// `bumpSemanticVersion: true` exists at exactly two sites — `decomposition.ts` and `intent.ts` — and
		// NEITHER is in `pwu.ts`, so a PWU's `semanticVersion` is 1 at creation and never moves. The conjunct is
		// INERT on this path; a test here would assert an arrangement the engine cannot produce. Only the
		// promotion path (S-0) has subjects that can version.
		expect(authorizations[0]!.state.subjectSemanticVersions).toEqual({ [target.id]: 1 });
	});
});
