// REG-F-021 increment 0 — proving the state-conditional invariant is WIRED, not merely written.
//
// `state-conditional-fields.test.ts` proves the PREDICATE decides correctly. It cannot prove the predicate is
// CALLED: delete the `(d1b)` block from `commitState` and every assertion in that file still passes, because no
// command can currently produce an ASSESSING assessment without `startedAt` (the handler always stamps it). A
// guard whose call site is untested is REG-F-016's shape — "a dead-predicate guard could not see the wiring it
// existed to detect" — and the whole increment turns on this guard being the thing that keeps the schema
// relaxation honest.
//
// So this file drives `commitState` DIRECTLY against a real store, with a state no handler would build, and
// asserts BOTH sides of the boundary the way the event gate does:
//   1. the write is REJECTED with RPH_INVARIANT_VIOLATION, and
//   2. the store is RE-READ to prove nothing landed — a rejected CommandResult looks identical whether or not the
//      commit happened, so the result alone is not evidence.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { commitState, makeEvent, type HandlerContext } from './kit.js';

const TS = '2026-08-04T00:00:00Z';
const ASSESSMENT_ID = 'asmt_01ARZ3NDEKTSV4RRFFQ69G5FC0';
const POLICY_ID = 'pol_01ARZ3NDEKTSV4RRFFQ69G5FC1';
const SUBJECT_ID = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5FC2';
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

describe('kit (d1b) state-conditional field invariant — the wiring, not the predicate', () => {
	let store: SqliteStorageAdapter;
	let ctx: HandlerContext;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		ctx = { store, now: () => TS, newEventId: () => `evt_${++seq}`, logger: silent };
	});

	const cmd = (): DomainCommand => ({
		commandId: `cmd-${++seq}`,
		commandType: 'RequestAssuranceAssessment',
		commandSchemaVersion: 1,
		targetAggregateType: 'ASSURANCE_ASSESSMENT',
		targetAggregateId: ASSESSMENT_ID,
		issuedAt: TS,
		issuedBy: actor,
		correlationId: 'corr-1',
		idempotencyKey: `idem-${seq}`,
		payload: {}
	});

	/** A minimally well-formed ASSURANCE_ASSESSMENT so the (d1) OBJECT check PASSES and we reach (d1b). If the
	 *  object schema were what rejected, this file would prove nothing about the invariant. */
	const assessmentState = (over: Record<string, unknown>): Record<string, unknown> => ({
		id: ASSESSMENT_ID,
		objectType: 'ASSURANCE_ASSESSMENT',
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'ASSESSING',
		createdAt: TS,
		createdBy: actor,
		updatedAt: TS,
		updatedBy: actor,
		provenance: { originType: 'DERIVED', sourceObjectIds: [], sourceEventIds: [] },
		tags: [],
		extensions: [],
		assurancePolicyId: POLICY_ID,
		policyVersion: '1.0.0',
		policySemanticVersion: 1,
		subjectObjectIds: [SUBJECT_ID],
		subjectSemanticVersions: { [SUBJECT_ID]: 1 },
		claimIds: [],
		evidenceConsideredIds: [],
		rejectedEvidence: [],
		observationIds: [],
		residualUncertainty: [],
		recommendedControlActions: [],
		...over
	});

	function commitWith(state: Record<string, unknown>) {
		const command = cmd();
		const event = makeEvent(ctx, command, {
			eventType: 'AssuranceAssessmentStarted',
			aggregateType: 'ASSURANCE_ASSESSMENT',
			aggregateId: ASSESSMENT_ID,
			aggregateRevision: 0,
			payload: {
				assessmentId: ASSESSMENT_ID,
				assurancePolicyId: POLICY_ID,
				policyVersion: '1.0.0',
				subjectObjectIds: [SUBJECT_ID],
				subjectSemanticVersions: { [SUBJECT_ID]: 1 },
				claimIds: []
			}
		});
		return commitState(ctx, command, {
			objectType: 'ASSURANCE_ASSESSMENT',
			aggregateId: ASSESSMENT_ID,
			expectedRevision: undefined,
			newRevision: 0,
			newSemanticVersion: 1,
			nextState: state,
			event
		});
	}

	it('CONTROL: the same state WITH startedAt commits — so a rejection below is the invariant, not the fixture', () => {
		const r = commitWith(assessmentState({ assessmentState: 'ASSESSING', startedAt: TS }));
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(store.loadObject(ASSESSMENT_ID)).toBeTruthy();
	});

	it('REFUSES an ASSESSING assessment with no startedAt, and NOTHING is written', () => {
		const r = commitWith(assessmentState({ assessmentState: 'ASSESSING' }));
		expect(r.status).toBe('REJECTED');
		expect(r.error?.code).toBe('RPH_INVARIANT_VIOLATION');
		expect(r.error?.message).toContain('startedAt');
		// THE HALF A REJECTED RESULT CANNOT SHOW: re-read the store. A guard that refuses AFTER committing would
		// return this identical CommandResult.
		expect(
			store.loadObject(ASSESSMENT_ID),
			'the refusal must happen before the write — an object that landed and then reported REJECTED is worse ' +
				'than no guard, because the audit trail disagrees with the store'
		).toBeUndefined();
		expect(r.producedEventIds).toEqual([]);
	});

	it('PERMITS a REQUESTED assessment with no startedAt — the state the whole relaxation exists to allow', () => {
		const r = commitWith(
			assessmentState({ assessmentState: 'REQUESTED', lifecycleStatus: 'REQUESTED' })
		);
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		const landed = store.loadObject(ASSESSMENT_ID)?.state as { startedAt?: string } | undefined;
		expect(landed).toBeTruthy();
		expect(
			landed?.startedAt,
			'a REQUESTED assessment must be persistable with NO startedAt at all — not with an invented one'
		).toBeUndefined();
	});
});
