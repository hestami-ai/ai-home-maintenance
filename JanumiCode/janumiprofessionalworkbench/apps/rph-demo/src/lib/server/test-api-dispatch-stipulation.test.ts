// ⛔ `/test-api/dispatch` CANNOT CARRY A STIPULATION — the whole request is refused before anything is dispatched
// (`JAN-CRITREAD` J1-1d; `DESIGN-what-the-tests-prove.md` §4.3; `REG-D-071` Q5).
//
// In an engine built for tests, a criterion recorded `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` counts as met.
// The only lawful writer of that field on the lane is the declared stand-in, deriving its remainder from what the
// checker could not judge. `/test-api/dispatch` would otherwise let a spec hand-write one past it.
//
// ⛔ WHY THE WHOLE REQUEST, AND WHY BEFORE ANYTHING RUNS: the route dispatches step by step with NO transaction
// around the batch. A per-step refusal would still land every step before and after the refused one — a
// stipulated row refused, then a `CompleteAssuranceAssessment` admitted. So the refusal names the step and
// dispatches nothing.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5K00';

/** A fresh test-mode workbench and the route, posting `steps`. */
async function dispatchUnderTest(steps: unknown[]) {
	vi.resetModules();
	vi.stubEnv('RPH_DEMO_MODE', 'test');
	vi.stubEnv('JPWB_HARNESS', '');
	vi.stubEnv('JPWB_DEMO_DB', '');
	// ⭑ A BARE BOOT: this test needs an engine, not the reference workbench — seeding it costs seconds, and under a
	// loaded package run that alone tripped the 5 s default.
	vi.stubEnv('JPWB_SEED', 'bare');
	const { getEngine } = await import('./workbench.js');
	const { POST } = await import('../../routes/test-api/dispatch/+server.js');
	const before = getEngine().readAllEvents().length;
	const call = () =>
		POST({
			request: new Request('http://localhost/test-api/dispatch', {
				method: 'POST',
				body: JSON.stringify({ steps })
			})
		} as never);
	return { call, landed: () => getEngine().readAllEvents().length - before };
}

const recordStep = (payload: Record<string, unknown>) => [
	'RecordCriterionResult',
	'ASSURANCE_ASSESSMENT',
	'assess_01ARZ3NDEKTSV4RRFFQ69G5K01',
	{ criterionId: 'RR-01-no-problem-substitution', result: 'UNABLE_TO_DETERMINE', ...payload }
];
/** A step that LANDS on its own — so a route that dispatched anything is observable in the event log. */
const landingStep = [
	'CaptureIntent',
	'INTENT',
	INTENT,
	{
		intentId: INTENT,
		originatingExpression: 'a step that lands on its own',
		ontologyId: 'product-realization-pwa',
		ontologyVersion: '1.0.0'
	}
];

describe('⛔ /test-api/dispatch refuses a stipulation — the whole request, before anything is dispatched', () => {
	it('⛔ a request whose first step carries `stipulated` is refused, naming the step, and NOTHING lands', async () => {
		// PREDICTED RED BEFORE J1-1d: the route dispatches step by step, so the second step lands.
		// THE MUTANT: delete the refusal.
		const d = await dispatchUnderTest([recordStep({ stipulated: 'MET' }), landingStep]);
		await expect(d.call()).rejects.toMatchObject({ status: 422 });
		await expect(d.call()).rejects.toMatchObject({
			body: { message: expect.stringContaining('step 0 (RecordCriterionResult) carries `stipulated`') }
		});
		expect(d.landed(), 'a refused request must dispatch nothing').toBe(0);
	});

	it('⭐ CONTROL — the same request WITHOUT `stipulated` is dispatched as before', async () => {
		// Without this the refusal above is satisfied by a route that refuses everything.
		const d = await dispatchUnderTest([recordStep({}), landingStep]);
		const res = (await d.call()) as Response;
		expect(res.status).toBe(200);
		const body = (await res.json()) as { results: { commandType: string; status: string }[] };
		expect(body.results.map((r) => r.commandType)).toEqual(['RecordCriterionResult', 'CaptureIntent']);
		expect(d.landed(), 'the landing step landed').toBeGreaterThan(0);
	});
});
