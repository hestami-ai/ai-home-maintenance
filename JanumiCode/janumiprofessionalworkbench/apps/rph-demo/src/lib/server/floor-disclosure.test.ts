// ⭐ THE DISCLOSURE — every surface that shows a reasoning-review verdict says what it rests on (`JAN-CRITREAD` J1-2;
// `DESIGN-what-the-tests-prove.md` §4.4; `B7`, `V1`).
//
// In test engines a reasoning review can be SATISFIED over criteria nobody judged, because the test stipulated them.
// The assessment's own state — the one field every gate reads — says SATISFIED with no mark (option C was
// rejected), so the disclosure lives where people read the verdict: the per-criterion tally on the floor view, the
// agent's status line, the "assured candidate" line, the PWA panel and chip, and the Undertaking page's Assurance
// tab. This file pins the parts that are code rather than markup.
import { vi } from 'vitest';

vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});

import { FLOOR_POLICY_IDS } from '@janumipwb/rph-assurance';
import type { AuthedEngineHandle } from '@janumipwb/rph-engine';
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SESSION_CREDENTIAL } from './identity.js';
import { getEngine, resetEngine } from './workbench.js';
import {
	beginAuthoringTurn,
	clearAuthoringTurns,
	commitAuthoringTurn,
	markAuthoringTurnAssured,
	markAuthoringTurnExternalBlock,
	markAuthoringTurnValid,
	summarizeAuthoringTurn
} from './authoring-turn.js';
import {
	assuredCandidateLine,
	floorStatusLine,
	loadPwaFloor,
	runPwaFloor,
	tallyCriteria,
	type FloorPolicyView,
	type FloorProducer,
	type FloorView
} from './floor.js';
import { registerStipulation } from './stipulations.js';

// ⭑ Crockford base32 — no I, L, O or U. The first draft used `…G5U00`, which the schema refuses, so CreatePwa was
// REJECTED and both engine-backed tests went red on the ARRANGEMENT, not on the code under test.
const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69G5V00';
const PRODUCER: FloorProducer = { agentId: 'jpwb-authoring-agent', modelId: 'pi-authoring', providerId: 'janumi' };

const view = (rr: FloorPolicyView['criteria'], satisfied = true): FloorView =>
	({
		subjectId: PWA,
		aggregate: satisfied ? 'SATISFIED' : 'INCONCLUSIVE',
		satisfied,
		waived: false,
		policies: [
			{ policyId: FLOOR_POLICY_IDS.SCHEMA_INVARIANT, disposition: 'SATISFIED', independenceOk: true, observations: [] },
			{
				policyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				disposition: satisfied ? 'SATISFIED' : 'INCONCLUSIVE',
				independenceOk: true,
				observations: [],
				...(rr ? { criteria: rr } : {})
			}
		],
		reasoningGaps: []
	}) as FloorView;

describe('⭐ the tally — who answered each recorded criterion', () => {
	it('counts evaluated rows and stipulated rows apart, from either the floor’s rows or the recorded events', () => {
		expect(
			tallyCriteria([
				{ outcome: 'MET' },
				{ outcome: 'NOT_MET' },
				{ outcome: 'UNABLE_TO_DETERMINE', stipulated: 'MET' },
				{ result: 'UNABLE_TO_DETERMINE', stipulated: 'MET' },
				{ result: 'UNABLE_TO_DETERMINE' }
			])
		).toEqual({ evaluated: 2, stipulated: 2 });
	});
});

describe('⭐ the agent’s lines carry the disclosure beside the verdict — and keep the prefix every reader matches', () => {
	it('⛔ a SATISFIED floor resting on stipulations says so, with the counts', () => {
		// THE MUTANT: drop the disclosure. The log would then say "an independent reasoning review" passed.
		const line = floorStatusLine(view({ evaluated: 2, stipulated: 7 }));
		expect(line.startsWith('⚖ Assurance floor SATISFIED')).toBe(true);
		expect(line).toContain('reasoning review: 2 criteria evaluated, 7 stipulated by the test, not reviewed');
		expect(line).not.toContain('independent reasoning review all pass');
	});

	it('⭐ CONTROL — a floor nobody stipulated reads exactly as before', () => {
		expect(floorStatusLine(view({ evaluated: 9, stipulated: 0 }))).toBe(
			'⚖ Assurance floor SATISFIED — schema, provenance, and an independent reasoning review all pass.'
		);
		expect(floorStatusLine(view(undefined, false))).toBe('⚖ Assurance floor INCONCLUSIVE.');
	});

	it('⛔ the "assured candidate" line carries the same disclosure beside the ✓', () => {
		expect(assuredCandidateLine('sha256:abc', view({ evaluated: 2, stipulated: 7 }))).toContain(
			'rests on 7 criteria stipulated by the test, not reviewed'
		);
		expect(assuredCandidateLine('sha256:abc', view({ evaluated: 9, stipulated: 0 }))).toBe(
			'✓ Assured candidate sha256:abc is staged. Canonical DRAFT is unchanged until you accept this exact preview.'
		);
	});
});

describe('⭐ the floor view carries the tally on the run AND on the read-back', () => {
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
			issuedAt: '2026-09-23T09:00:00Z',
			correlationId: 'setup',
			idempotencyKey: 'setup-idem-1',
			payload: { pwaId: PWA, name: 'Disclosed', description: 'A DRAFT PWA.', domain: 'software', version: '1.0.0' }
		};
		expect(session.dispatch(create).status).toBe('ACCEPTED');
	});
	afterEach(() => clearAuthoringTurns());

	it('⛔ the run reports 2 evaluated / 7 stipulated, and so does the canonical read-back after acceptance', async () => {
		// THE MUTANTS: the run's view drops the tally; the read-back folds nothing. Either makes the panel and the
		// chip show a plain SATISFIED for a verdict that rests on seven criteria nobody judged.
		registerStipulation(getEngine(), { pwaId: PWA, framing: 'PWA_GRAPH', remaining: 'CLEAN' });
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		const subjectHash = markAuthoringTurnValid(turn);
		const floor = await runPwaFloor(PWA, { prompt: 'Author.', producer: PRODUCER, candidateSubjectHash: subjectHash }, turn.engine);
		const rr = (f: FloorView | undefined) => f?.policies.find((p) => p.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
		expect(rr(floor)?.criteria).toEqual({ evaluated: 2, stipulated: 7 });

		expect(commitAuthoringTurn(turn, markAuthoringTurnAssured(turn, subjectHash))).toMatchObject({ ok: true });
		expect(rr(loadPwaFloor(PWA, session))?.criteria).toEqual({ evaluated: 2, stipulated: 7 });
	});
});

describe('⛔ REG-F-447 — a stopped turn carries WHY, in the floor’s own words', () => {
	afterEach(() => clearAuthoringTurns());

	it('the summary the page renders carries the recorded cause, not one fixed sentence per status', () => {
		// The page used to print "The reviewer call failed" for every BLOCKED_EXTERNAL — including an INCONCLUSIVE
		// review, whose call did not fail. THE MUTANT: drop `detail` from the summary.
		resetEngine('empty');
		const session = getEngine().as(SESSION_CREDENTIAL);
		session.dispatch({
			commandId: 'setup-1',
			commandType: 'CreatePwa',
			commandSchemaVersion: 1,
			targetAggregateType: 'PROFESSIONAL_WORK_ARCHITECTURE',
			targetAggregateId: PWA,
			issuedAt: '2026-09-23T09:00:00Z',
			correlationId: 'setup',
			idempotencyKey: 'setup-idem-1',
			payload: { pwaId: PWA, name: 'Stopped', description: 'A DRAFT PWA.', domain: 'software', version: '1.0.0' }
		});
		const turn = beginAuthoringTurn(PWA);
		expect(turn.broker.defineType({ name: 'Plan', pwuKind: 'PLAN', isRoot: true }).ok).toBe(true);
		markAuthoringTurnValid(turn);
		const guidance =
			'PublishPwa remains blocked because the mandatory Reasoning Review is incomplete but produced no valid subject finding.';
		markAuthoringTurnExternalBlock(turn, guidance);
		expect(summarizeAuthoringTurn(turn)).toMatchObject({ status: 'BLOCKED_EXTERNAL', detail: guidance });
	});
});
