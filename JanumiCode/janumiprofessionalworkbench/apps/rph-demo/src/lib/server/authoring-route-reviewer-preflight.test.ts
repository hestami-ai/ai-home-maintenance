// ⭐ `JAN-SELREV` SR-1 (D3, D5) — THE AUTHORING ROUTE ASKS THE SELECTOR WITH THE ENVIRONMENT THE FLOOR REGISTRY READS.
//
// ⛔ WHY THE ROUTE, AND NOT ONLY THE TWO FUNCTIONS. `preflight.test.ts` holds `assurancePreflight` and
// `createFloorRegistry` to one answer, but the disagreement `REG-F-443` filed lived in the ROUTE's CALL: the route
// handed the preflight the retired `JPWB_ASSESSOR`, which the registry never read. A route that hands the preflight
// any environment other than the process's — `env: {}`, say — is the same defect again, and no function-level test
// can see it: every function would still agree when asked directly.
//
// ⭑ WHAT MUST HOLD. In test mode, with devin NAMED and no model, the registry refuses the review; so the route must
// refuse the turn with the selector's guidance BEFORE anything begins — one `error` event naming devin's missing
// model and `REG-D-119`, then `done`; no authoring turn begun and no agent created. And the route must ask in the mode
// the host runs in: outside test mode an unset tool is a refusal, which a route that always said `testMode: true`
// would answer with the stand-in.
//
// ⛔ HERMETIC. PATH finds no program, the agent is the deterministic mock (test mode, `JPWB_AGENT` unset), and the
// refused arrangement names devin with no model — so even a route that skipped the preflight would record a refused
// review and start nothing.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./agent/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agent/index.js')>();
	return { ...actual, createAuthoringAgent: vi.fn(actual.createAuthoringAgent) };
});

// ⭑ THE PREFLIGHT'S MODE, SWITCHABLE ALONE: `isTestMode()` answers a load-time constant, and the agent's mode, the reset
// and the id sequence read their own (`workbench.ts`), so switching this moves only what the route hands the preflight.
vi.mock('./workbench.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./workbench.js')>();
	return { ...actual, isTestMode: vi.fn(actual.isTestMode) };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { createAuthoringAgent } from './agent/index.js';
import { clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { dispatch, isTestMode, mintUiId, resetEngine } from './workbench.js';

type RouteEvent = Parameters<typeof POST>[0];
interface StreamedEvent {
	readonly kind: string;
	readonly message?: string;
}

/** A DRAFT PWA to author — the only kind the route opens a turn on. */
function draftPwa(): string {
	const pwaId = mintUiId('pwa');
	const r = dispatch('CreatePwa', 'PROFESSIONAL_WORK_ARCHITECTURE', pwaId, {
		pwaId,
		name: 'Route preflight fixture',
		description: 'A DRAFT PWA the authoring route is asked to work on.',
		domain: 'software',
		version: '0.1.0'
	});
	expect(r.status, `arrangement: CreatePwa — ${r.error?.message ?? ''}`).toBe('ACCEPTED');
	return pwaId;
}

/** POST the route in-process and read its whole Server-Sent Event stream. */
async function postInstruction(pwaId: string): Promise<StreamedEvent[]> {
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
		.map((chunk) => JSON.parse(chunk.slice('data: '.length)) as StreamedEvent);
}

beforeEach(() => {
	clearAuthoringTurns();
	resetEngine('reference');
	vi.mocked(createAuthoringAgent).mockClear();
	vi.stubEnv('PATH', noProgramsDirectory());
	for (const v of ['JPWB_ASSURANCE_TOOL', 'JPWB_ASSURANCE_MODEL', 'JPWB_JUDGE_MODEL', 'JPWB_AGENT'])
		vi.stubEnv(v, undefined);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
	// Back to the real answer — a `vi.fn(impl)` resets to `impl`.
	vi.mocked(isTestMode).mockReset();
});

describe('⭐ D5 — the authoring route refuses a turn its floor registry would refuse to review', () => {
	it('⛔ devin named with no model (test mode): one error with the guidance, then done — no turn begun, no agent created', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(
			events.map((e) => e.kind),
			`the route did not refuse before the turn: ${JSON.stringify(events).slice(0, 600)}`
		).toEqual(['error', 'done']);
		expect(events[0]!.message).toContain(
			"The reviewing tool 'devin' has no model: JPWB_ASSURANCE_MODEL is not set"
		);
		expect(events[0]!.message).toContain('REG-D-119');
		expect(
			vi.mocked(createAuthoringAgent),
			'an authoring agent was created for a refused turn'
		).not.toHaveBeenCalled();
		expect(
			getPendingAuthoringTurn(pwaId),
			'an authoring turn was begun for a refused turn'
		).toBeUndefined();
	});

	it('⛔ OUTSIDE TEST MODE an unset tool refuses the turn — the route asks in the mode the host runs in', async () => {
		const pwaId = draftPwa();
		vi.mocked(isTestMode).mockReturnValue(false);

		const events = await postInstruction(pwaId);

		expect(
			events.map((e) => e.kind),
			`the route did not refuse before the turn: ${JSON.stringify(events).slice(0, 600)}`
		).toEqual(['error', 'done']);
		expect(events[0]!.message).toContain('JPWB_ASSURANCE_TOOL is not set');
		expect(events[0]!.message).toContain('REG-D-119');
		expect(vi.mocked(createAuthoringAgent)).not.toHaveBeenCalled();
		expect(getPendingAuthoringTurn(pwaId)).toBeUndefined();
	});

	it('⭑ CONTROL — nothing named (test mode) selects the stand-in, so the same POST begins the turn and creates the agent', async () => {
		// Without this, "not called" and "undefined" above could hold because the spy and the turn lookup observe
		// nothing at all: here the same two observers must SEE the turn the route began.
		const pwaId = draftPwa();

		const events = await postInstruction(pwaId);

		expect(events.at(-1)?.kind).toBe('done');
		expect(
			events.filter((e) => e.kind === 'error' && (e.message ?? '').includes('has no model'))
		).toEqual([]);
		expect(vi.mocked(createAuthoringAgent)).toHaveBeenCalledTimes(1);
		expect(
			getPendingAuthoringTurn(pwaId),
			'the stand-in turn left no staged candidate'
		).toBeDefined();
	});
});
