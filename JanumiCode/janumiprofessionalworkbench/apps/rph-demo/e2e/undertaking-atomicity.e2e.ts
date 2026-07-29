import { test, expect } from '@playwright/test';
import { resetEngine, introspect, gotoHydrated, declareRisk } from './support/harness';

// JPWB-SPEC-001 SPEC-001-INV-14 / FORK-23 (b) — a multi-Command Affordance is ATOMIC where an atomic dispatch
// exists, and a partially-applied sequence SHALL NOT leave committed state behind.
//
// THE DEFECT THIS PINS, measured in a browser on 2026-07-28. The seeded reference Undertaking parks its ROOT PWU
// ("Product Realization") at workLifecycle EXECUTING with executionState QUEUED (reference-undertaking.ts:835).
// The overview row therefore offers Record Assurance (+page.svelte:207-229 branches on workLifecycleState alone),
// whose sequence ends in `chg(pwuId, 'EXECUTING', 'EVIDENCE_PENDING', 'SUCCEEDED', …)`. QUEUED -> SUCCEEDED is not
// an arrow on PWU.executionState — the only success arrow is RUNNING -> SUCCEEDED (transitions.data.ts:505-509) —
// so the engine refuses. Correctly. But `runSteps` dispatched the sequence ONE COMMAND AT A TIME and returned on
// the first refusal, so the two assurance Commands that preceded the refused hop had already committed: every
// click minted an orphan ASSURANCE_ASSESSMENT that then appeared in the Assurance tab.
//
// WHY IT WAS INVISIBLE. The refusal IS surfaced, so the UI looks honest; and no test asserted on what the engine
// held afterwards. The engine has carried an atomic envelope the whole time — `dispatchBatch` wraps the loop in
// `store.transaction()` and rolls back every commit on the first non-accepted result (command-bus.ts:169-188) —
// and this same application already uses it in the PWA Designer (pwa/[id]/+page.server.ts:632) and the authoring
// turn (authoring-turn.ts:452). Only the Undertaking Workbench did not.
//
// THE PREDICTED RED, stated so a reader can re-run it: against the pre-fix `runSteps` this spec FAILS on the final
// assertion with 2 extra assessments, not on the refusal assertion. A version of this test that only checked for
// the error alert would have passed against the defect — which is the whole reason it asserts on engine ground
// truth through /test-api/introspect rather than on rendered markup.
const SEEDED_UNDERTAKING = 'und_01ARZ3NDEKTSV4RRFFQ69G5Z10';

test.describe('Undertaking Workbench — multi-Command atomicity (SPEC-001-INV-14)', () => {
	test.beforeEach(async ({ request }) => {
		await resetEngine(request, 'reference');
	});

	test('a REFUSED multi-Command action commits nothing — no orphan assessments', async ({
		page,
		request
	}) => {
		const before = await introspect(request);
		const rootPwu = before.pwus.find((p) => p.state.title === 'Product Realization');
		expect(rootPwu, 'the reference seed must carry a root Product Realization PWU').toBeTruthy();
		// The arrangement this test depends on. If the seed ever drives the root past EXECUTING/QUEUED the action
		// below stops being offered and the test would pass vacuously, so the precondition is asserted, not assumed.
		expect(rootPwu!.state.workLifecycleState).toBe('EXECUTING');
		expect(rootPwu!.state.executionState).toBe('QUEUED');

		await gotoHydrated(page, `/undertakings/${SEEDED_UNDERTAKING}`);
		await page.getByRole('button', { name: 'overview', exact: true }).click();

		const rootRow = page.locator('tr').filter({ hasText: 'Product Realization' }).first();
		await expect(rootRow.getByRole('button', { name: 'Record Assurance' })).toBeVisible();
		await rootRow.getByRole('button', { name: 'Record Assurance' }).click();

		// The engine refuses, and the Surface says so verbatim — INV-08. This half already held before the fix.
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByRole('alert')).toContainText(/Illegal transition|RPH_/i);

		// THE HALF THAT WAS BROKEN: nothing may have been committed by the refused sequence.
		const after = await introspect(request);
		expect(
			after.assessments.length,
			'a refused multi-Command action must commit NO assurance assessment'
		).toBe(before.assessments.length);
		expect(after.events.length, 'a refused multi-Command action must append NO event').toBe(
			before.events.length
		);

		// And the PWU itself is untouched on every axis — a partial application would have moved the assurance axis.
		const rootAfter = after.pwus.find((p) => p.state.title === 'Product Realization')!;
		expect(rootAfter.state.workLifecycleState).toBe('EXECUTING');
		expect(rootAfter.state.executionState).toBe('QUEUED');
		expect(rootAfter.state.assuranceState).toBe(rootPwu!.state.assuranceState);
	});

	test('CONTROL: an ACCEPTED multi-Command action still commits in full', async ({
		page,
		request
	}) => {
		// The mirror of the case above, and the reason the fix cannot be "make runSteps commit nothing ever".
		// Without this, replacing runSteps with a no-op would satisfy the first test.
		await gotoHydrated(page, '/undertakings');
		await page.getByRole('button', { name: '+ New Undertaking' }).click();
		await page.getByPlaceholder(/Undertaking name/i).fill('Atomicity Control');
		await page.getByRole('combobox', { name: 'Instantiate from published PWA' }).selectOption({ index: 1 });
		await declareRisk(page); // DR-002 W-4: the form refuses without a judgement
		await page.getByRole('button', { name: 'Create Undertaking' }).click();
		const link = page.getByRole('link', { name: /Atomicity Control/ });
		await gotoHydrated(page, (await link.getAttribute('href'))!);
		await page.getByRole('button', { name: 'overview', exact: true }).click();
		await page.getByRole('combobox', { name: 'Select a PWU Type' }).selectOption({ label: 'Architecture Definition' });
		await page.getByPlaceholder(/Instance title/i).fill('Atomic Work');
		await declareRisk(page); // DR-002 W-4: the form refuses without a judgement
		await page.getByRole('button', { name: 'Instantiate PWU' }).click();
		await expect(page.getByText('Atomic Work')).toBeVisible();

		const before = await introspect(request);
		// ROW-SCOPED since DR-002 W-3 — the Undertaking now instantiates its PWA's tree on creation, so eight
		// auto-instantiated PROPOSED PWUs render the same button and a bare locator resolves to nine.
		await page
			.getByRole('row', { name: /Atomic Work/ })
			.getByRole('button', { name: 'Begin & Execute' })
			.click();
		await expect(page.getByRole('button', { name: 'Record Assurance' })).toBeVisible();

		// beginExecute is the largest sequence in the file (eleven Commands). All of them, or none.
		const after = await introspect(request);
		expect(after.events.length).toBeGreaterThan(before.events.length);
		const pwu = after.pwus.find((p) => p.state.title === 'Atomic Work')!;
		expect(pwu.state.executionState).toBe('SUCCEEDED');
	});
});
