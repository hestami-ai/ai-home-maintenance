// ⭐ `JAN-SELRES` RS-2 (D7) — THE AUTHORING ROUTE MARKS EVERY REMEDIATION THE WAY ITS ACTION SAYS: THE SUBJECT'S
// PROBLEM → REVISION_REQUIRED, THE REVIEW'S → BLOCKED_EXTERNAL.
//
// ⛔ WHAT IS AT STAKE. `applyFloorDisposition` (`routes/pwa/[id]/agent/+server.ts`) now asks `isOperationalRemediation`
// (`floor.ts`) instead of enumerating actions. `floor.test.ts` holds that function's truth table, and
// `authoring-route-substituted-reviewer.test.ts` holds the route for a substitution and for a subject finding — but a
// route that answered anything other than a refinement as external (`action !== 'REFINE_SUBJECT'`) passed both, and
// marked a candidate with a schema or identity finding BLOCKED_EXTERNAL: the producer never told to fix its own graph.
// So this file drives the ROUTE once per action.
//
// ⭑ ONLY THE FLOOR RUN IS REPLACED. `runPwaFloor` returns a hand-built view per case; the route's own classifier, its
// operational test, its guidance and its turn marking all run as in production, and each case first asserts that the
// real classifier answers its view with the action named — so the table cannot drift from what it claims to cover.
// ⚠ `NONE` NEVER REACHES THE DECISION: the classifier answers `NONE` only for a satisfied floor, and the route stages
// a satisfied floor as the assured candidate before it asks. Its row asserts exactly that.
//
// ⛔ HERMETIC. No reviewer runs at all (the floor run is replaced), PATH finds no program, and the agent is the
// deterministic mock (test mode, `JPWB_AGENT` unset).
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./floor.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./floor.js')>();
	return { ...actual, runPwaFloor: vi.fn(actual.runPwaFloor) };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import {
	classifyFloorRemediation,
	runPwaFloor,
	type FloorPolicyView,
	type FloorRemediationAction,
	type FloorView
} from './floor.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];

/** A DRAFT PWA to author — the only kind the route opens a turn on. */
function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Floor disposition fixture',
		description: 'A DRAFT PWA whose floor is answered by each remediation in turn.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

/** POST the route in-process and read its whole Server-Sent Event stream. */
async function postInstruction(pwaId: string): Promise<readonly { readonly kind: string }[]> {
	const response = await POST({
		params: { id: pwaId },
		request: new Request(`http://localhost/pwa/${pwaId}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ instruction: 'Author a minimal product realization graph.' })
		})
	} as unknown as RouteEvent);
	const body = await response.text();
	return body
		.split('\n\n')
		.filter((chunk) => chunk.startsWith('data: '))
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as { readonly kind: string });
}

/** A floor policy result, clean unless overridden. */
const policy = (policyId: string, overrides: Partial<FloorPolicyView> = {}): FloorPolicyView => ({
	policyId,
	disposition: 'SATISFIED',
	independenceOk: true,
	observations: [],
	...overrides
});
const review = (overrides: Partial<FloorPolicyView> = {}): FloorPolicyView =>
	policy('floor.reasoning-review', overrides);
/** An unsatisfied floor over `policies`. */
const unsatisfied = (...policies: FloorPolicyView[]): FloorView => ({
	subjectId: 'pwa-under-review',
	aggregate: 'REJECTED',
	satisfied: false,
	waived: false,
	policies,
	reasoningGaps: []
});
const executionFailed = {
	code: 'VALIDATOR_EXECUTION_FAILED',
	severity: 'MATERIAL',
	statement: 'The reviewer did not run.'
};

/** ⭑ A `Record` over the union: an action added to `FloorRemediationAction` without a row here fails to COMPILE. */
const CASES: Readonly<
	Record<
		FloorRemediationAction,
		{
			readonly view: FloorView;
			readonly status: 'READY_TO_COMMIT' | 'REVISION_REQUIRED' | 'BLOCKED_EXTERNAL';
		}
	>
> = {
	NONE: {
		view: { ...unsatisfied(review()), aggregate: 'SATISFIED', satisfied: true },
		status: 'READY_TO_COMMIT'
	},
	REFINE_SUBJECT: {
		view: unsatisfied(
			review({
				disposition: 'REJECTED',
				observations: [
					{
						code: 'RR-02-no-obligation-elision',
						severity: 'BLOCKING',
						statement: 'A delegated deployment obligation is absent.'
					}
				]
			})
		),
		status: 'REVISION_REQUIRED'
	},
	RESOLVE_OTHER_FLOOR_FINDINGS: {
		view: unsatisfied(
			review(),
			policy('floor.schema-invariant', {
				disposition: 'REJECTED',
				observations: [
					{ code: 'SI-01-schema', severity: 'BLOCKING', statement: 'The graph fails its schema.' }
				]
			})
		),
		status: 'REVISION_REQUIRED'
	},
	RETRY_OR_CONFIGURE_REVIEWER: {
		view: unsatisfied(review({ disposition: 'INCONCLUSIVE', observations: [executionFailed] })),
		status: 'BLOCKED_EXTERNAL'
	},
	REQUALIFY_OR_RESELECT_REVIEWER: {
		view: unsatisfied(
			review({
				disposition: 'INCONCLUSIVE',
				independenceOk: false,
				observations: [
					executionFailed,
					{
						code: 'VALIDATOR_MODEL_SUBSTITUTED',
						severity: 'MATERIAL',
						statement: 'The reviewing tool reported that another model answered.'
					}
				]
			})
		),
		status: 'BLOCKED_EXTERNAL'
	},
	CHANGE_REVIEWER: {
		view: unsatisfied(review({ disposition: 'REJECTED', independenceOk: false })),
		status: 'BLOCKED_EXTERNAL'
	},
	ESCALATE_REVIEW: {
		view: unsatisfied(review({ disposition: 'ESCALATED' })),
		status: 'BLOCKED_EXTERNAL'
	}
};

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	vi.mocked(runPwaFloor).mockReset();
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐ D7 — the authoring route marks each remediation by its action: the subject’s → REVISION_REQUIRED, the review’s → BLOCKED_EXTERNAL', () => {
	for (const [action, { view, status }] of Object.entries(CASES) as [
		FloorRemediationAction,
		(typeof CASES)[FloorRemediationAction]
	][])
		it(`${action} → ${status}`, async () => {
			const remediation = classifyFloorRemediation(view);
			expect(remediation.action, 'arrangement: the classifier answers this view').toBe(action);
			vi.mocked(runPwaFloor).mockResolvedValue(view);
			const pwaId = draftPwa();

			const events = await postInstruction(pwaId);

			expect(events.at(-1)?.kind).toBe('done');
			expect(
				vi.mocked(runPwaFloor),
				'arrangement: the route ran the floor once'
			).toHaveBeenCalledTimes(1);
			const turn = getPendingAuthoringTurn(pwaId);
			expect(turn, 'the turn left no staged candidate').toBeDefined();
			expect(turn!.status, `${action} marked the candidate wrongly`).toBe(status);
			if (status !== 'READY_TO_COMMIT') expect(turn!.detail).toBe(remediation.guidance);
		});
});
