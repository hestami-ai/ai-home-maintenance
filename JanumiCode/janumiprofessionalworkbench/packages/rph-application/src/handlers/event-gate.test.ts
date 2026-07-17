// THE EVENT GATE (kit.ts step d2) — proves the governed stream refuses a malformed RATIFIED event payload.
//
// Why this file exists as a separate, adversarial test: turning the gate on made ZERO tests fail. That is the
// shape of a lock nobody has watched fail. A green suite after adding an enforcement point is evidence the
// enforcement point might be dead, not evidence the system is clean. These tests drive `commitState` — the gate's
// actual call site — against a real SqliteStorageAdapter, and assert on BOTH sides of the boundary:
//
//   1. a RATIFIED event with a bad payload is REFUSED and never reaches the store (the store is re-read to prove
//      the write did not land — a rejected CommandResult would look identical if the commit still happened);
//   2. an UNRATIFIED-AUTHORED event with an equally bad payload is ALLOWED, because we do not enforce shapes we
//      authored ourselves as though the corpus had ratified them. This is the gate's scope, stated as a test.
//
// If (2) ever goes red, someone has widened RATIFIED_EVENT_PAYLOADS to cover authored shapes and the map has
// stopped meaning "ratified".
import { RATIFIED_EVENT_PAYLOADS, type DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitState, makeEvent, type HandlerContext } from './kit.js';

const TS = '2026-07-17T00:00:00Z';
const PWU_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FB0';
const actor = { actorId: 'user-1', actorType: 'HUMAN' as const, displayName: 'Alice' };

const silent: Logger = {
	log: () => undefined,
	debug: () => undefined,
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
	fatal: () => undefined,
	child: () => silent
};

describe('kit (d2) event gate', () => {
	let store: SqliteStorageAdapter;
	let ctx: HandlerContext;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		ctx = { store, now: () => TS, newEventId: () => `evt_${++seq}`, logger: silent };
	});

	const cmd = (commandType: string): DomainCommand => ({
		commandId: `cmd-${++seq}`,
		commandType,
		commandSchemaVersion: 1,
		targetAggregateType: 'PROFESSIONAL_WORK_UNIT',
		targetAggregateId: PWU_ID,
		issuedAt: TS,
		issuedBy: actor,
		correlationId: 'corr-1',
		idempotencyKey: `idem-${seq}`,
		payload: {}
	});

	// A minimally well-formed PWU object so the (d1) OBJECT check passes and we reach (d2). If the object schema
	// were the thing rejecting, this file would prove nothing about the event gate.
	const pwuState = (): Record<string, unknown> => ({
		id: PWU_ID,
		objectType: 'PROFESSIONAL_WORK_UNIT',
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'READY',
		createdAt: TS,
		createdBy: actor,
		updatedAt: TS,
		updatedBy: actor,
		provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] },
		tags: [],
		extensions: [],
		pwuKind: 'PRODUCT_REALIZATION',
		title: 'T',
		description: 'D',
		intentId: 'int_01ARZ3NDEKTSV4RRFFQ69G5FAV',
		boundaries: {
			inScope: ['a'],
			outOfScope: ['b'],
			permittedChanges: [],
			prohibitedChanges: []
		},
		obligationIds: [],
		constraintIds: [],
		assumptionIds: [],
		dependencyIds: [],
		inputRequirements: [],
		expectedOutputs: [{ name: 'o', description: 'd' }],
		evidenceRequirementIds: [],
		verificationCriterionIds: [],
		assurancePolicyIds: [],
		workLifecycleState: 'READY',
		executionState: 'NOT_PLANNED',
		assuranceState: 'UNASSESSED',
		shapeIntegrityState: 'PRESERVED',
		riskProfile: {
			consequence: 'LOW',
			uncertainty: 'LOW',
			irreversibility: 'LOW',
			securitySensitivity: 'NONE',
			regulatoryExposure: 'NONE'
		}
	});

	function commitWith(eventType: string, payload: unknown) {
		const command = cmd('ChangePwuState');
		const event = makeEvent(ctx, command, {
			eventType,
			aggregateType: 'PROFESSIONAL_WORK_UNIT',
			aggregateId: PWU_ID,
			aggregateRevision: 0,
			payload
		});
		return commitState(ctx, command, {
			objectType: 'PROFESSIONAL_WORK_UNIT',
			aggregateId: PWU_ID,
			expectedRevision: undefined,
			newRevision: 0,
			newSemanticVersion: 1,
			nextState: pwuState(),
			event
		});
	}

	// The premise of every assertion below. If PwuStateChanged ever leaves the ratified map, the "refuses" tests
	// would pass vacuously (nothing to enforce) while proving nothing — so pin the premise itself.
	it('PREMISE: PwuStateChanged is ratified-and-gated; PwuMarkedReady is authored-and-ungated', () => {
		expect(
			RATIFIED_EVENT_PAYLOADS['PwuStateChanged'],
			'PwuStateChanged must be gated'
		).toBeDefined();
		expect(
			RATIFIED_EVENT_PAYLOADS['PwuMarkedReady'],
			'PwuMarkedReady payload is AUTHORED (no corpus doc schematizes it) — gating it would enforce our own invention as though ratified'
		).toBeUndefined();
	});

	it('REFUSES a ratified event whose payload is missing required fields — and does not write it', () => {
		// The exact pre-2026-07-17 markPwuReady defect: a MarkPwuReadyPayload emitted as a PwuStateChanged.
		const r = commitWith('PwuStateChanged', {
			shapeReadinessAssessmentId: 'assess_shape',
			expectedSemanticVersion: 1
		});
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
		expect(r.error?.message).toContain('PwuStateChanged');
		expect(r.producedEventIds).toEqual([]);
		// The rejection must be a REFUSAL TO WRITE, not a report about a write that happened anyway.
		expect(store.loadObject(PWU_ID), 'a refused event must leave no state behind').toBeUndefined();
	});

	it('REFUSES a ratified event with an unrecognized extra key (strictObject is load-bearing)', () => {
		const r = commitWith('PwuStateChanged', {
			previousState: 'SHAPING',
			newState: 'READY',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: [],
			smuggled: 'not in DOC-007 §11.5'
		});
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.message).toContain('smuggled');
	});

	it('REFUSES a ratified event whose enum field carries an off-vocabulary value', () => {
		const r = commitWith('PwuStateChanged', {
			previousState: 'SHAPING',
			newState: 'DEFINITELY_NOT_A_STATE',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});
		expect(r.status).toBe('VALIDATION_FAILED');
		expect(r.error?.message).toContain('newState');
	});

	it('ADMITS a ratified event whose payload conforms', () => {
		const r = commitWith('PwuStateChanged', {
			previousState: 'SHAPING',
			newState: 'READY',
			executionState: 'NOT_PLANNED',
			assuranceState: 'UNASSESSED',
			shapeIntegrityState: 'PRESERVED',
			reasonCode: 'CONTROLLER',
			supportingObjectIds: []
		});
		expect(r.status, r.error?.message).toBe('ACCEPTED');
		expect(r.producedEventIds).toHaveLength(1);
	});

	it('ADMITS an UNRATIFIED-AUTHORED event with a garbage payload — the gate enforces the corpus, not our inventions', () => {
		const r = commitWith('PwuMarkedReady', { total: 'garbage', not: 'a real payload' });
		expect(
			r.status,
			'gating an authored shape would dress our own invention as a ratified requirement'
		).toBe('ACCEPTED');
	});
});
