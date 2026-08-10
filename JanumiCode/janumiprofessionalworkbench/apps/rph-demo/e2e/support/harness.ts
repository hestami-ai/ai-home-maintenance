// Shared E2E harness helpers. These talk to the TEST-MODE-ONLY /test-api endpoints so a spec can (a) reset the
// engine to a known state between tests and (b) read the engine's GROUND TRUTH — the append-only event log and
// every object's materialized state — to assert the UI reflects real engine state, not just rendered markup.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

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
	readonly observations: ObjectRow[];
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
	}>;
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

/** Accept the exact assured hash emitted by the staged agent SSE turn through the real SvelteKit form action. */
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
