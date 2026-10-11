// Shared E2E harness helpers. These talk to the TEST-MODE-ONLY /test-api endpoints so a spec can (a) reset the
// engine to a known state between tests and (b) read the engine's GROUND TRUTH — the append-only event log and
// every object's materialized state — to assert the UI reflects real engine state, not just rendered markup.
//
// ⭐⭐ AND EVERY SPEC TAKES ITS `test` FROM HERE (`JAN-CRITREAD` J1-3; `DESIGN-what-the-tests-prove.md` §4.8), because
// this `test` carries THE LANE CONTROL's automatic fixture. `verif/e2e-harness-import-census.test.ts` reddens on any
// other `test` taken from `@playwright/test` under `e2e/`, so no current or future spec escapes it.
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

/**
 * ⭐ THE LANE CONTROL, PER TEST (§4.8; `REG-D-072` D8). The CHECK is the server's — both limbs of §4.8 over the event
 * log since the last reset mark, and over every staged candidate — and so is what it KEEPS: every reset closes the
 * segment it ends, and `e2e/lane-control-teardown.ts` fails the RUN on anything kept, so a violation that passes on
 * retry, or a floor that completes after its test, cannot hide. This fixture adds ATTRIBUTION: it names the test to
 * the server at setup, and after the test (after its `afterEach` hooks) fails it with whatever the server finds that
 * this test is the first to see.
 *
 * ⚠ AUTOMATIC, so a spec cannot forget it — and the import census makes a spec that takes Playwright's own `test`
 * impossible to land unseen.
 */
export const test = base.extend<{ laneControl: void }>({
	laneControl: [
		async ({ request }, use, testInfo) => {
			const name = `${testInfo.titlePath.join(' › ')}${testInfo.retry > 0 ? ` (retry ${testInfo.retry})` : ''}`;
			const announced = await request.post('/test-api/lane-control', { data: { announce: name } });
			expect(announced.ok(), `the lane control did not take the test's name: ${await announced.text()}`).toBeTruthy();
			await use();
			const res = await request.post('/test-api/lane-control', { data: { check: name } });
			expect(res.ok(), `the lane control's after-test check failed: ${await res.text()}`).toBeTruthy();
			const { violations } = (await res.json()) as { violations: { limb: number; where: string; assessmentId: string; reason: string }[] };
			expect(
				violations.map((v) => `limb ${v.limb} · ${v.where} · ${v.assessmentId}: ${v.reason}`),
				'LANE CONTROL (JAN-CRITREAD J1-3; DESIGN-what-the-tests-prove.md §4.8): this test left a reasoning-review pass the lane may not rest on'
			).toEqual([]);
		},
		{ auto: true }
	]
});

export interface ObjectRow {
	readonly id: string;
	readonly state: Record<string, unknown>;
}

export interface EngineSnapshot {
	readonly events: ReadonlyArray<Record<string, unknown>>;
	readonly pwas: ObjectRow[];
	readonly pwuTypes: ObjectRow[];
	readonly undertakings: ObjectRow[];
	readonly pwus: ObjectRow[];
	readonly executionPlans: ObjectRow[];
	readonly assessments: ObjectRow[];
	/** JAN-EXECRUN — what the engine holds after an execution step ran. */
	readonly modelExchanges: ObjectRow[];
	readonly artifacts: ObjectRow[];
	/**
	 * ⭑ JAN-EXECGOV EG-02 — the ground truth for `STA-8`, *"Execution requires an approved plan and AUTHORIZED
	 * Runtime Bindings."* Until that slice the production count was ZERO, so a spec asserting it had nothing to
	 * read. ⚠ Declared HERE and not only in the endpoint, for the reason the `assurancePolicies` note below
	 * records: an under-described payload pushes its consumers into inline casts, which is hand-annotation
	 * where the type should have spoken.
	 */
	readonly runtimeBindings: ObjectRow[];
	// ⚠ MISSING UNTIL REG-F-166, AND NOTHING COULD HAVE TOLD ANYONE. `test-api/introspect/+server.ts` has
	// returned `assurancePolicies` all along; this interface simply did not say so, and `apps/rph-demo/e2e/` was
	// under NO type gate at all — 38 specs typechecked by nothing — so the omission could not surface. The specs
	// that read it compensated with inline casts, which is what an under-described payload looks like from the
	// consumer side: hand-annotation where the type should have spoken.
	readonly assurancePolicies: ObjectRow[];
	readonly observations: ObjectRow[];
	/** JAN-SLICE-SWP-06 — the evidence stage's ground truth, so a SURFACE Slice asserts the ENGINE and not the page. */
	readonly evidence: ObjectRow[];
	readonly decisions: ObjectRow[];
	readonly baselines: ObjectRow[];
	readonly conversations: ObjectRow[];
	readonly authoringCandidates: ReadonlyArray<{
		readonly pwaId: string;
		readonly summary: {
			readonly status: string;
			readonly candidateHash?: string;
			readonly commandCount: number;
		};
		readonly pwuTypes: ObjectRow[];
		readonly assessments: ObjectRow[];
		readonly conversations: ObjectRow[];
		/** ⭐ J1-3 — the candidate's OWN `AssuranceCriterionEvaluated` events: what a staged review rests on. */
		readonly criterionEvents: ReadonlyArray<Record<string, unknown>>;
		/** ⭐ J1-3 — the candidate's OWN `AssuranceAssessmentCompleted` events. */
		readonly completionEvents: ReadonlyArray<Record<string, unknown>>;
	}>;
	/** ⭐ J1-3 — the stipulation registry as the server holds it; a reset discards it. */
	readonly stipulations: ReadonlyArray<{ readonly pwaId: string; readonly framing: string; readonly remaining: string }>;
	/** ⭐ J1-3 — the lane control's marks (one per boot or reset) and the violations it has kept. */
	readonly lane: {
		readonly marks: ReadonlyArray<{ readonly id: number; readonly openedBy: string; readonly mark: number; readonly tests: readonly string[] }>;
		readonly violations: ReadonlyArray<Record<string, unknown>>;
	};
}

/** Reset the engine to a known state between specs (test mode only): 'empty' for authoring-from-scratch flows,
 *  'reference' for the seeded FSM workbench used by visualization flows. */
export async function resetEngine(
	request: APIRequestContext,
	// `bare` seeds NOTHING — `empty` still seeds the policy library, so it is not empty of governed objects. See
	// resetEngine in $lib/server/workbench and REG-F-108.
	seed: 'reference' | 'empty' | 'bare'
): Promise<void> {
	const res = await request.post('/test-api/reset', { data: { seed } });
	expect(res.ok(), `reset(${seed}) should succeed`).toBeTruthy();
}

/**
 * ⭐ `JAN-CRITREAD` J1-2 — declare that this test STIPULATES the reasoning-review remainder CLEAN for one PWA on one arm
 * (`/test-api/reviewer-script`). The declared stand-in then answers what the structural checker cannot judge, and the
 * record says so: `UNABLE_TO_DETERMINE` with `stipulated: 'MET'` beside it.
 *
 * ⚠ CALL IT IN THE TEST BODY, after the reset and after the PWA exists, with the id READ FROM THE STORE — never
 * computed, and never at `describe`/`beforeAll` level, which the next reset wipes (ids restart at every reset).
 */
export async function registerStipulation(
	request: APIRequestContext,
	pwaId: string,
	// ⭐ `JAN-EXEC` Phase 7 completion E2 — and `DECLARED_POLICY`: each declared policy of the PWA's units, stipulated CLEAN
	// by the declared stand-in, recorded NOT JUDGED (`declared-policy-review.ts`).
	framing: 'PWA_GRAPH' | 'WORK_PRODUCT' | 'DECLARED_POLICY'
): Promise<void> {
	const res = await request.post('/test-api/reviewer-script', { data: { pwaId, framing, remaining: 'CLEAN' } });
	expect(res.ok(), `registerStipulation(${pwaId}, ${framing}): ${await res.text()}`).toBeTruthy();
	expect(((await res.json()) as { registered: unknown }).registered).toEqual({ pwaId, framing, remaining: 'CLEAN' });
}

/**
 * ⭐ E2 — stipulate the DECLARED policies CLEAN for every PWA the engine holds, for a spec over the reference seed whose
 * sign-off must conclude (`registerStipulation`'s rule: after the reset, ids read from the store).
 */
export async function stipulateDeclaredPolicies(request: APIRequestContext): Promise<void> {
	for (const pwa of (await introspect(request)).pwas) await registerStipulation(request, pwa.id, 'DECLARED_POLICY');
}

/** Navigate and wait for Svelte to hydrate (so toggle/enhance handlers are attached before we interact). One call
 *  per full page load suffices — subsequent in-app link clicks are SPA navigations and stay hydrated. */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.locator('html[data-hydrated="true"]').waitFor({ state: 'attached' });
}

/** Read the engine's ground truth (event log + every object's state) for INV-5-style truth assertions. */
export async function introspect(request: APIRequestContext): Promise<EngineSnapshot> {
	const res = await request.get('/test-api/introspect');
	expect(res.ok(), 'introspect should succeed').toBeTruthy();
	return (await res.json()) as EngineSnapshot;
}

/**
 * Accept the exact assured hash emitted by the staged agent SSE turn through the real SvelteKit form action.
 *
 * ⛔ `res.ok()` IS NOT ACCEPTANCE (`REG-F-426`). `request.post` sends no `Accept: text/html`, so SvelteKit answers
 * the form action with its JSON envelope — HTTP 200 even when the action returned `fail(409)`. A refused
 * acceptance passed this helper and surfaced only at later assertions that named a symptom, never the cause;
 * that is how `REG-F-425` hid. The envelope's `type` is the action's own verdict, so it is what is asserted, and
 * a refusal is quoted whole so the red says why.
 */
export async function acceptAgentCandidate(
	request: APIRequestContext,
	pwaId: string,
	sseBody: string
): Promise<string> {
	const candidateHash = /sha256:[0-9a-f]{64}/.exec(sseBody)?.[0];
	expect(candidateHash, 'agent SSE should expose the exact assured candidate hash').toBeTruthy();
	const res = await request.post(`/pwa/${pwaId}?/acceptAgentCandidate`, {
		form: { candidateHash: candidateHash! }
	});
	expect(res.ok(), 'exact candidate acceptance should succeed').toBeTruthy();
	const envelope = (await res.json()) as { type?: string; data?: unknown };
	expect(envelope.type, `exact candidate acceptance was refused: ${JSON.stringify(envelope)}`).toBe(
		'success'
	);
	expect(String(envelope.data), 'the action accepted a different candidate').toContain(
		candidateHash!
	);
	return candidateHash!;
}

/**
 * Declare a risk judgement on whichever authoring form is open (DR-002 W-4).
 *
 * The Undertaking and PWU forms both REQUIRE one — a fabricated default is the defect W-4 removed, so there is
 * nothing to fall back to and every spec that creates work must now say what kind of work it is.
 *
 * Defaults to a MODERATE posture rather than the old fabricated constant, and deliberately not to
 * MEDIUM/MEDIUM/MEDIUM/MEDIUM/LOW: a helper that reproduced that exact tuple would let a regression to the
 * hardcoded profile pass every spec that uses it, which is the whole failure W-4 exists to prevent.
 *
 * NOTE THE SCALES DIFFER. consequence / uncertainty / irreversibility are LOW|MEDIUM|HIGH|CRITICAL;
 * securitySensitivity and regulatoryExposure are NONE|LOW|MEDIUM|HIGH — passing CRITICAL to either is refused
 * with "Schema validation failed", which reads like a wiring fault and is not one.
 */
export async function declareRisk(
	page: Page,
	overrides: Partial<Record<string, string>> = {}
): Promise<void> {
	const declared: Record<string, string> = {
		Consequence: 'HIGH',
		Uncertainty: 'MEDIUM',
		Irreversibility: 'LOW',
		'Security sensitivity': 'LOW',
		'Regulatory exposure': 'NONE',
		...overrides
	};
	for (const [label, level] of Object.entries(declared))
		await page.getByRole('combobox', { name: label, exact: true }).selectOption(level);
}
