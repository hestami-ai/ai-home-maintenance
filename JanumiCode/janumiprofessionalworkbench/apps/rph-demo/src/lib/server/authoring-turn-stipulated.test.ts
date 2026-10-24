// ⭐ A STIPULATED CLEAN TURN, END TO END — through the production composition (`JAN-CRITREAD` J1-2; `REG-D-071`).
//
// The module engine (test mode, so it admits stipulations), a real authoring turn, the floor run exactly as the
// agent route runs it — on `turn.engine`, which is the turn's hand-written RECORDER — and the commit. Only the
// stipulation is the test's: the checker's own RR-04 and RR-09 are real judgements of the draft.
//
// ⛔ WHAT THIS GUARDS: every link the lane's greens will rest on. The stand-in is selected in test mode; the floor
// caller hands it the registry; the RECORDER forwards the engine's flag, so the ladder admits what Gate E admits;
// the commit replays on canonical, whose Gate E admits too. Break any one and a registered clean turn stops passing.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { listByType, type AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, resetEngine } from './workbench.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	commitAuthoringTurn,
	markAuthoringTurnAssured,
	markAuthoringTurnValid
} from './authoring-turn.js';
import { runPwaFloor, type FloorProducer } from './floor.js';
import { registerStipulation } from './stipulations.js';

const TS = '2026-09-23T09:00:00Z';
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5T00';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };

let session: AuthedEngineHandle;

beforeEach(() => {
	resetEngine('empty');
	session = getEngine().as(SESSION_CREDENTIAL);
	const create: DomainCommand = {
		commandId: 'setup-1',
		commandType: 'CreatePwa',
		commandSchemaVersion: 1,
		targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
		targetAggregateId: PWA,
		issuedAt: TS,
		correlationId: 'setup',
		idempotencyKey: 'setup-idem-1',
		payload: { pwaId: PWA, name: 'Stipulated', description: 'A DRAFT PWA.', domain: 'software', version: '1.0.0' }
	};
	expect(session.dispatch(create).status).toBe('ACCEPTED');
});

afterEach(() => {
	clearAuthoringTurns();
});

/** A clean one-type draft, reviewed as the agent route reviews it, and the recorded reasoning-review assessment. */
async function reviewCleanDraft() {
	const turn = beginAuthoringTurn(PWA);
	expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
	const subjectHash = markAuthoringTurnValid(turn);
	const floor = await runPwaFloor(
		PWA,
		{ prompt: 'Author the plan.', producer: PRODUCER, candidateSubjectHash: subjectHash },
		turn.engine
	);
	expect(floor, 'the floor did not run').toBeDefined();
	const review = listByType(turn.engine, 'ASSURANCE_ASSESSMENT').find(
		(a) => a.state.assurancePolicyId === 'floor.reasoning-review'
	);
	return { turn, subjectHash, floor: floor!, review };
}

describe('⭐ a registered clean draft is SATISFIED through the production composition, and commits', () => {
	it('⭐ with a registration: the floor is satisfied on the turn, under the stand-in, and the commit lands', async () => {
		// THE MUTANTS THIS FILE OWNS: the recorder forwards `admitStipulatedAnswers: false`; the floor caller stops
		// passing the flag to the ladder; the floor caller stops handing the stand-in the registry. Each turns this
		// SATISFIED into INCONCLUSIVE.
		// ⭐ The review in parts, B6 (`REG-D-125`) — the floor reviews the draft's one type as a part, on the part arm.
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_TYPE', remaining: 'CLEAN' });
		const { turn, subjectHash, floor, review } = await reviewCleanDraft();

		expect(floor.satisfied, JSON.stringify(floor.policies)).toBe(true);
		expect(review?.state.assessmentState).toBe('SATISFIED');
		expect(
			(review?.state.evaluator as { modelId?: string } | undefined)?.modelId,
			'the declared stand-in reviewed it, and the record names it'
		).toBe('standin');

		const result = commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash));
		expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
	});

	it('⛔ without a registration: the same clean draft is NOT satisfied — the stand-in answers nothing it cannot judge', async () => {
		const { floor, review } = await reviewCleanDraft();
		expect(floor.satisfied).toBe(false);
		expect(review?.state.assessmentState).toBe('INCONCLUSIVE');
	});
});
