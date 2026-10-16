// ⭐⭐ `JAN-EXEC` Phase 8 (`REG-D-112` (c)) — THE AUTHORING TURN IS OUTSIDE THE REPLAY, AND THE ROUTE SAYS SO.
//
// ⛔ `REG-D-112` (c): *"The replay covers the execution half from the published PWA"*, and *"The authoring turn is not
// replayed, because its calls are not recorded"* — `pi-agent.ts`'s turn leaves no exchange, and the recorder leaves out the
// authoring floor's reviews. So with `JPWB_REPLAY` set, an authoring turn has nothing to replay from: run with the mock
// agent it would ask the REPLAY reviewer a PWA review the recording does not hold and poison the replay; run with
// `JPWB_AGENT=pi` beside the switch it would be a LIVE, paid authoring turn in a process that asked for a replay.
// ⭑ WHAT MUST HOLD: with the switch set, the route refuses the turn BEFORE anything begins — one `error` event naming the
// rule, then `done`; no authoring turn begun and no agent created — whichever agent is configured.
// ⭑ PREDICTED RED, observed 2026-10-15 with the route's own check removed: the mock agent's case went red, *"an authoring
// agent was created while a replay was switched on"*, because the preflight answered the REPLAY reviewer ready. ⚠ The
// `JPWB_AGENT=pi` case stayed green then, and rightly: with the agent named beside the switch, the preflight's selector
// refuses first (`REVIEWER_REPLAY_BESIDE_A_LIVE_SELECTION`; its red is `replay-selection.test.ts`'s), so that case is held
// twice, and this file's red is the mock's.
//
// ⛔ HERMETIC. PATH finds no program, and `createAuthoringAgent` is replaced by one that THROWS: a route that reached it
// records the call and starts nothing — never the live Pi agent, whatever `JPWB_AGENT` says.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

vi.mock('./agent/index.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agent/index.js')>();
	return {
		...actual,
		createAuthoringAgent: vi.fn(async () => {
			throw new Error('hermetic: no authoring agent is created here');
		})
	};
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../../routes/pwa/[id]/agent/+server.js';
import { createAuthoringAgent } from './agent/index.js';
import { clearAuthoringTurns, getPendingAuthoringTurn } from './authoring-turn.js';
import { noProgramsDirectory } from './assurance/no-programs.testing.js';
import { dispatch, mintUiId, resetEngine } from './workbench.js';

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
		name: 'Replay authoring fixture',
		description:
			'A DRAFT PWA the authoring route is asked to work on while a replay is switched on.',
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
	for (const v of [
		'JPWB_ASSURANCE_TOOL',
		'JPWB_ASSURANCE_MODEL',
		'JPWB_JUDGE_MODEL',
		'JPWB_AGENT',
		'JPWB_AGENT_MODEL',
		'JPWB_REPLAY'
	])
		vi.stubEnv(v, undefined);
});
afterEach(() => {
	clearAuthoringTurns();
	vi.unstubAllEnvs();
});

describe('⭐ REG-D-112 (c) — with the replay switched on, the authoring route refuses the turn before anything begins', () => {
	for (const [label, agent] of [
		['the mock agent (JPWB_AGENT unset)', undefined],
		['the live Pi agent named beside the switch (JPWB_AGENT=pi, REG-D-112 (c))', 'pi']
	] as const)
		it(`⛔ ${label}: one error naming the rule, then done — no turn begun, no agent created`, async () => {
			// ⭑ A folder the route only names: a refusal that read it would be refusing something else.
			vi.stubEnv('JPWB_REPLAY', 'recordings/never-read');
			if (agent !== undefined) vi.stubEnv('JPWB_AGENT', agent);
			const pwaId = draftPwa();

			const events = await postInstruction(pwaId);

			expect(
				vi.mocked(createAuthoringAgent),
				'an authoring agent was created while a replay was switched on'
			).not.toHaveBeenCalled();
			expect(
				events.map((e) => e.kind),
				`the route did not refuse before the turn: ${JSON.stringify(events).slice(0, 600)}`
			).toEqual(['error', 'done']);
			expect(events[0]!.message).toContain('JPWB_REPLAY');
			expect(events[0]!.message).toContain('REG-D-112');
			expect(getPendingAuthoringTurn(pwaId), 'an authoring turn was begun').toBeUndefined();
		});
});
