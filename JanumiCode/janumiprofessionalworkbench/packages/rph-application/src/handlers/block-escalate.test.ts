// JAN-PWUWP W-5 — BLOCKED and ESCALATED get named commands, and DELIBERATELY get no authority guard.
//
// Every other act this programme has named needed one. These two do not, and the difference is the point:
// JPWB-DOC-001 §5.2 reserves waiver, risk acceptance, rejection, abandonment and promotion to Governance —
// **not blocking and not escalation**. Their arrows' VERBATIM corpus triggers are facts and absences: "Missing
// information", "Runtime dependency unavailable", "Evidence impossible to obtain".
//
// ⚠ SO THE CONTROLS HERE POINT THE OTHER WAY FROM USUAL. The risk being tested is not that trouble can be
// recorded without permission — it is that some later increment ADDS permission and makes trouble harder to
// report than progress, which this repository names in terms as worse than checking neither.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import {
	expectPwuReplayEquivalence,
	seedPwuWorkLifecycleState_FIXTURE
} from './__tests__/pwu-fixtures.js';

const TS = '2026-08-09T00:00:00Z';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69H9100';
const PWU = 'pwu_01ARZ3NDEKTSV4RRFFQ69H9110';

describe('JAN-PWUWP W-5 — BlockPwu and EscalatePwu', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const dispatch = (commandType: string, payload: unknown, id = PWU, aggType = 'PROFESSIONAL_WORK_UNIT') => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			correlationId: 'w5',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	};
	const ok = (r: { status: string; error?: { message?: string } }, what: string) => {
		expect(r.status, `${what}: ${r.error?.message}`).toBe('ACCEPTED');
		return r;
	};
	const lifecycle = () =>
		(store.loadObject(PWU)!.state as { workLifecycleState: string }).workLifecycleState;
	const emitted = () =>
		store.readAggregateEvents('PROFESSIONAL_WORK_UNIT', PWU).map((e) => e.eventType);


	const replayMatchesMaterialized = () => expectPwuReplayEquivalence(store, PWU);
	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
		ok(
			dispatch(
				'CaptureIntent',
				{ intentId: INTENT, originatingExpression: 'x', ontologyId: 'o', ontologyVersion: '1' },
				INTENT,
				'INTENT'
			),
			'intent'
		);
		ok(
			dispatch('ProposePwu', {
				pwuId: PWU,
				pwuKind: 'ARCHITECTURE',
				title: 'Arch',
				description: 'd',
				intentId: INTENT,
				boundaries: {
					inScope: ['the governed work under test'],
					outOfScope: ['not yet known'],
					permittedChanges: [],
					prohibitedChanges: []
				},
				obligationIds: [],
				constraintIds: [],
				assumptionIds: [],
				expectedOutputs: [{ outputId: 'out_1', kind: 'DOCUMENT' }],
				assurancePolicyIds: [],
				riskProfile: {
					consequence: 'MEDIUM',
					uncertainty: 'MEDIUM',
					irreversibility: 'LOW',
					securitySensitivity: 'LOW',
					regulatoryExposure: 'NONE'
				}
			}),
			'pwu'
		);
		ok(dispatch('BeginPwuShaping', {}), 'shaping');
	});

	// ── BlockPwu ──────────────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS a block from SHAPING with a reason and NOTHING else cited', () => {
		ok(dispatch('BlockPwu', { blockReason: 'the upstream interface contract is not published' }), 'block');
		expect(lifecycle()).toBe('BLOCKED');
		expect(emitted(), 'the semantic event, not the generic one').toContain('PwuBlocked');
		expect(emitted()).not.toContain('PwuStateChanged');
	});

	it('REJECTS a block with no reason — the CONTRACT requires it, an unexplained halt records nothing', () => {
		const r = dispatch('BlockPwu', {});
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(lifecycle()).toBe('SHAPING');
	});

	it('ACCEPTS a block that cannot itemise what is missing — the trigger is an ABSENCE', () => {
		// `missingObjectIds` is optional on purpose. "Missing information" frequently cannot enumerate itself,
		// and requiring the list would make the honest case unreportable.
		ok(dispatch('BlockPwu', { blockReason: 'we do not yet know what we are missing' }), 'block');
		expect(lifecycle()).toBe('BLOCKED');
	});

	// ── EscalatePwu ───────────────────────────────────────────────────────────────────────────────────────────
	it('ACCEPTS an escalation from EVIDENCE_PENDING, emitting the event authored for it', () => {
		// ARRANGEMENT, NOT THE SUBJECT: EVIDENCE_PENDING sits behind the whole execution chain (a cited plan with
		// a succeeded step). The named escape hatch validates against the ratified schema AND machine before
		// writing, so it cannot arrange a shape the contract forbids.
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(
			dispatch('EscalatePwu', { escalationReason: 'the evidence cannot be obtained at any cost' }),
			'escalate'
		);
		expect(lifecycle()).toBe('ESCALATED');
		expect(emitted(), 'PwuEscalated did not exist before W-5 — this is its first emission').toContain(
			'PwuEscalated'
		);
	});

	it('REJECTS an escalation with no reason (CON-000 AX-8: a transfer of responsibility must say why)', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		expect(dispatch('EscalatePwu', {}).status).toBe('VALIDATION_FAILED');
		expect(lifecycle()).toBe('EVIDENCE_PENDING');
	});

	// ── CONTROL 1: THE SETTER IS CLOSED FOR BOTH, in the commit that minted them ──────────────────────────────
	// Predicted red for the mutant deleting either row from PWU_SEMANTIC_LIFECYCLE_COMMANDS, and only for it.
	it('CONTROL — the generic setter refuses both arrows and names the command', () => {
		const setter = (previousState: string, newState: string) =>
			dispatch('ChangePwuState', {
				previousState,
				newState,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			});
		expect(setter('SHAPING', 'BLOCKED').error?.message).toContain('Dispatch BlockPwu instead');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		expect(setter('EVIDENCE_PENDING', 'ESCALATED').error?.message).toContain(
			'Dispatch EscalatePwu instead'
		);
	});

	// ── TROUBLE STAYS CHEAP TO REPORT — asserted, but NOT counted as a control ───────────────────────────────
	// ⚠ HONEST LABELLING, and the second time this programme has had to do it. This was written as "CONTROL 2"
	// on the reasoning that a future increment adding an authority conjunct would redden it and nothing else.
	// Mutation says otherwise: adding a `missingObjectIds` requirement to `BlockPwu` reddens FOUR tests — this
	// one and three accept cases, because none of them cites anything either. It reddens WITH THE HERD, so it is
	// not a control by this repository's standard. Kept because the property it states is the one most at risk
	// of quiet drift, and demoted in name so the count of real controls stays true.
	it('blocking and escalating need no decision, no evidence, no citation', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block with nothing cited');
		expect(lifecycle()).toBe('BLOCKED');
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(dispatch('EscalatePwu', { escalationReason: 'r' }), 'escalate with nothing cited');
		expect(lifecycle()).toBe('ESCALATED');
	});

	// ── CONTROL 3: THE REPLAY FOLD IS LOAD-BEARING FOR BOTH EVENTS ───────────────────────────────────────────
	// ⚠ THIS TEST EXISTS BECAUSE A MUTANT FOUND ITS ABSENCE, and it is the SECOND time this exact defect has
	// been built. W-1 added `PwuAbandoned`/`PwuRejected` as emitters and to nothing else; W-4.5 discovered it two
	// increments later, and only by accident — `BASELINED` happens to be in the reference seed. W-5 then added
	// `PwuBlocked`/`PwuEscalated` to `pwu-replay.ts` in the same commit, believing that closed it.
	//
	// It did not. Deleting BOTH fold cases left 1203 tests GREEN. The fold entries were dead code, because
	// `replay-equivalence.test.ts` walks the reference undertaking and the seed BLOCKS AND ESCALATES NOTHING —
	// the same structural blindness, one increment on. Folding in the right commit is necessary and not
	// sufficient: the fold must be DRIVEN by a test that actually emits the event.
	//
	// Predicted red for the fold mutant, and measured: 0 tests before this one, 2 after.
	it('CONTROL — a BLOCKED PWU rebuilds from its own event stream', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		replayMatchesMaterialized();
	});

	it('CONTROL — an ESCALATED PWU rebuilds from its own event stream', () => {
		seedPwuWorkLifecycleState_FIXTURE(store, PWU, 'EVIDENCE_PENDING');
		ok(dispatch('EscalatePwu', { escalationReason: 'r' }), 'escalate');
		replayMatchesMaterialized();
	});

	// ── CONTROL 4: BLOCKED IS A ONE-WAY DOOR, and the machine does not advertise it ──────────────────────────
	// BLOCKED is NOT in `terminalStates`, yet its only out-arrows are ABANDONED and SUPERSEDED. The roadmap's
	// W-5 named an `UnblockPwu`; there is no arrow for one to perform. Asserted so the absence is a recorded
	// fact rather than a discovery, and so that ADDING a recovery arrow reddens here and gets noticed.
	it('CONTROL — a BLOCKED PWU has no way back; recovery is not a missing command but a missing arrow', () => {
		ok(dispatch('BlockPwu', { blockReason: 'r' }), 'block');
		for (const back of ['SHAPING', 'PLANNED', 'EXECUTING', 'READY']) {
			const r = dispatch('ChangePwuState', {
				previousState: 'BLOCKED',
				newState: back,
				executionState: 'NOT_PLANNED',
				assuranceState: 'UNASSESSED',
				shapeIntegrityState: 'PRESERVED',
				reasonCode: 'CONTROLLER',
				supportingObjectIds: []
			});
			expect(r.status, `BLOCKED -> ${back} must not be performable`).toBe('REJECTED');
		}
		expect(lifecycle()).toBe('BLOCKED');
	});
});
