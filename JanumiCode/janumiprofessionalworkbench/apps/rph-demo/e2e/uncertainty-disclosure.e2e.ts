import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated } from './support/harness';

// JPWB-SPEC-001-DR-002 W-5 — the uncertainty plane gets a surface.
//
// O-8-R1 (SHALL): "A Surface presenting a PWU SHALL disclose that PWU's material uncertainty."
// O-8-R2 (SHALL): "Absence of a disclosure SHALL be reportable, not merely undetectable."
// O-8-R7 (SHALL NOT): a Surface SHALL NOT present incomplete professional understanding as settled.
//
// THE DEFECT (roadmap finding F-F/AX-3). `residualUncertainty` is produced by the agent path, validated, written
// into ASSURANCE_ASSESSMENT state, and folded by the §38 projection — and then NO `.svelte` file in the
// application rendered it. The data flowed the entire way and terminated at the surface boundary. A professional
// looking at the workbench could not see what the assurance actually left unresolved.
//
// AND THE PROJECTION DROPS IT FOR EVERY DISPOSITION BUT ONE. `assurance-view.ts:214` folds residuals into
// `openConditions` only when the disposition is CONDITIONALLY_SATISFIED — a defensible reading of §38, whose
// "open conditions" ARE conditional by definition. But O-8-R1 is about MATERIAL UNCERTAINTY, not open conditions:
// uncertainty a validator recorded against a SATISFIED assessment is still uncertainty, and reading it through
// the §38 slot would silently disclose nothing for exactly the case a reader is most likely to over-trust. So the
// disclosure reads the ASSESSMENT OBJECT's own `residualUncertainty`, which is populated regardless.
//
// THE THREE STATES ARE THE WHOLE POINT, and collapsing any two of them is the O-8-R7 defect:
//
//   not yet assessed          — no assessment exists.        Nothing is known.
//   assessed, none declared   — an assessment declared none. Something is known: a validator looked.
//   assessed, N declared      — the statements.
//
// "No uncertainty shown" is true of all three. Only the middle one means "a professional considered this and
// found nothing outstanding", and rendering it the same as the first presents incomplete understanding as
// settled. The CONTROL below exists for that distinction and mutant `W5-b` attacks it directly.
test.describe('Undertaking Workbench — material uncertainty is disclosed (DR-002 W-5)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a residual-uncertainty statement the engine holds is visible on the workbench', async ({
		page,
		request
	}) => {
		// THE ARRANGEMENT, ASSERTED — AND ITS FIRST FORM WAS WRONG IN THE MOST INSTRUCTIVE WAY. It read
		// `assessment.state.residualUncertainty` and failed with 0, which looked like "the seed records no
		// uncertainty". It is not: the OBJECT field is always `[]` by construction, and the values live on the
		// completion EVENTS. Measured: 0 across every assessment object, 1 across 32 completion events. Had the
		// arrangement not been asserted, that 0 would have been read as "the UI does not render it".
		const snap = await introspect(request);
		const statements = snap.events
			.filter((e) => e.eventType === 'AssuranceAssessmentCompleted')
			.flatMap((e) => {
				const p = (e as { payload?: Record<string, unknown> }).payload ?? {};
				return Array.isArray(p.residualUncertainty) ? (p.residualUncertainty as string[]) : [];
			});
		expect(
			statements.length,
			'the reference seed must record residual uncertainty on a completion EVENT, or this proves nothing'
		).toBeGreaterThan(0);

		const undertakingId = snap.undertakings[0]!.id;
		await gotoHydrated(page, `/undertakings/${undertakingId}`);
		await page.getByRole('button', { name: 'assurance', exact: true }).click();

		// The statement itself, not a count and not a badge: a disclosure a professional cannot read is not a
		// disclosure. Sliced because the panel truncates long statements for layout.
		const probe = statements[0]!.slice(0, 40);
		await expect(
			page.getByText(probe, { exact: false }).first(),
			'the recorded uncertainty must be readable on the surface that presents the work'
		).toBeVisible();
	});

	test('CONTROL — "none declared" is distinguishable from "not yet assessed"', async ({
		page,
		request
	}) => {
		// A new Undertaking's PWUs are PROPOSED and unassessed; the seeded one carries completed assessments. The
		// two must not render the same words. Without this, a disclosure region that always printed "No residual
		// uncertainty" would satisfy every other assertion here while asserting, of unassessed work, that a
		// professional had looked and found nothing.
		const seededId = (await introspect(request)).undertakings[0]!.id;
		await gotoHydrated(page, `/undertakings/${seededId}`);
		await page.getByRole('button', { name: 'assurance', exact: true }).click();

		// Asserted over ALL rows, not `.first()`. The first draft read the first row and failed against
		// UNASSESSED — which was the seed being honest (the seeded Undertaking's first PWU genuinely is
		// unassessed), not a defect. A control that depends on row order tests the order.
		const states = await page.locator('[data-disclosure]').evaluateAll((els) =>
			els.map((el) => el.getAttribute('data-disclosure'))
		);
		expect(states.length, 'the seeded Undertaking must render disclosures at all').toBeGreaterThan(0);
		expect(
			states,
			'a PWU whose validator recorded uncertainty must read DECLARED'
		).toContain('DECLARED');
		expect(
			new Set(states).size,
			'the seeded workbench mixes assessed and unassessed PWUs, and they must not render alike'
		).toBeGreaterThan(1);

		// O-8-R2: the count is reportable, so a surface that silently renders nothing FAILS rather than passing
		// quietly. A region with no rows and a region that was never rendered look identical without it.
		const reported = await page.locator('[data-disclosure-count]').first().getAttribute('data-disclosure-count');
		expect(reported, 'the number of disclosures rendered must be reportable').not.toBeNull();
		expect(Number(reported)).toBeGreaterThanOrEqual(0);
	});
});
