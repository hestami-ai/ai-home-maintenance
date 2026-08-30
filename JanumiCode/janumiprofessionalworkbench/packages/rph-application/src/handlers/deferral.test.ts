// DeferScope — the act that makes ASR-9 limb 10 performable (JAN-SLICE-SWP-02a, REG-D-046 Ruling 2).
//
// ⚠ WHY THIS FILE IS REQUIRED AND NOT OPTIONAL. `verif/command-dispatch-census.test.ts` refuses a ratified,
// routable command whose handler has never run, in its own words: *"its preconditions, its emitted payload and
// its event-gate conformance are claims nothing checks."* That census reddened the moment `DeferScope` was
// registered — the repository refusing a declared-but-unexercised command, which is the hollow-governed-layer
// defect it has recorded against itself before.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Engine } from '../index.js';

const TS = '2026-07-12T00:00:00Z';
const DEFERRAL = 'dfr_01ARZ3NDEKTSV4RRFFQ69G0099';
const SUBJECT = 'pwu_01ARZ3NDEKTSV4RRFFQ69G5A80';
const CARRIER = 'asu_01ARZ3NDEKTSV4RRFFQ69G0021';
const AUTHORITY = {
	authorityId: 'auth_architecture_lead',
	authorityType: 'ORGANIZATIONAL_ROLE',
	scope: ['ARCHITECTURE'],
	validFrom: TS
};

describe('DeferScope — deferred scope becomes a governed fact', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	const wellFormed = (over: Record<string, unknown> = {}) => ({
		deferralId: DEFERRAL,
		statement: 'Offline behavior deferred from the first implementation increment',
		subjectObjectIds: [SUBJECT],
		carrierObjectIds: [CARRIER],
		revisitCondition: 'Reconsidered at the next Architecture Baseline.',
		rationale: 'First-increment scope decision: connectivity assumed at job start.',
		authority: AUTHORITY,
		...over
	});

	function defer(payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType: 'DeferScope',
			commandSchemaVersion: 1,
			targetAggregateType: 'DEFERRAL',
			targetAggregateId: DEFERRAL,
			issuedAt: TS,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`,
			payload
		};
		return engine.dispatch(command);
	}

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({
			authenticate: testAuthenticator(),
			store,
			now: () => TS,
			newEventId: () => `e${++seq}`
		}).as(TEST_CRED.human);
	});

	it('mints a DEFERRAL and emits ScopeDeferred carrying the subject and its carriers', () => {
		expect(defer(wellFormed()).status, 'the command must be ACCEPTED').toBe('ACCEPTED');
		const events = store.readAllEvents().filter((e) => e.eventType === 'ScopeDeferred');
		expect(events, 'exactly one ScopeDeferred').toHaveLength(1);
		const p = events[0]!.payload as { subjectObjectIds: string[]; carrierObjectIds: string[] };
		expect(p.subjectObjectIds, 'the unit whose work the scope left').toEqual([SUBJECT]);
		expect(p.carrierObjectIds, 'the ASR-9 limb 10 carriers that hold it').toEqual([CARRIER]);
	});

	// ⚠ THE CLAUSE THAT MAKES THIS A DEFERRAL RATHER THAN AN ABANDONMENT. `revisitCondition` encodes "postponed,
	// not abandoned" without a status field that merely restates the object's own type. Scope that leaves the
	// work with no stated way back is not deferred — it is gone, wearing a governed name.
	it('REFUSES a deferral with an empty revisit condition — that is an abandonment', () => {
		expect(
			defer(wellFormed({ revisitCondition: '' })).status,
			'an empty revisit condition must not be accepted'
		).not.toBe('ACCEPTED');
		expect(
			store.readAllEvents().filter((e) => e.eventType === 'ScopeDeferred'),
			'and no event may be written for a refused command'
		).toHaveLength(0);
	});

	it('REFUSES a deferral naming no carrier — ASR-9 limb 10 requires it to STAY REPRESENTED', () => {
		expect(
			defer(wellFormed({ carrierObjectIds: [] })).status,
			'a deferral carried by nothing is not represented'
		).not.toBe('ACCEPTED');
	});

	// CONTROL — THE REFUSALS DISCRIMINATE. Without this, a handler that rejected every payload would pass both
	// refusal tests above and prove nothing about either clause.
	it('CONTROL — the well-formed payload is accepted, so the refusals are about the clauses', () => {
		expect(defer(wellFormed()).status).toBe('ACCEPTED');
	});
});
