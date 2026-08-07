// JAN-CMDPRE DWP-06 (D5) — the `precondition` field is now REQUIRED on `advanceStatus` (kit.ts) and `advanceIntent`
// (intent.ts): the compiler enforces that every status advance declares a source-state precondition, so no site can
// silently omit one again. Flipping the field to required surfaced ONE previously-uncovered `advanceStatus` site —
// `submitBaselineForReview` (a Baseline.status NONE site, outside DWP-04's six) — which this file covers. The flip
// itself needed ZERO edits to existing assertions; this is the one gap it revealed, now closed with the same
// kill-test + mutation-red-proof discipline as every other JAN-CMDPRE site.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-24T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'User' };

describe('DWP-06 — submitBaselineForReview (the gap the required-precondition flip surfaced)', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;
	const BASE = 'base_01ARZ3NDEKTSV4RRFFQ69GF600';

	function d(commandType: string, payload: unknown) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: 'BASELINE',
			targetAggregateId: BASE,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'dwp06',
			idempotencyKey: `k-${n}`, // distinct each time — a re-issue is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	}
	const statusOf = () => (store.loadObject(BASE)?.state as { status?: string })?.status ?? '';
	const revisionOf = () => store.loadObject(BASE)?.revision;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
		// CreateBaseline nominates a CANDIDATE; item versions default to 1 for absent items (best-effort, createBaseline).
		expect(
			d('CreateBaseline', {
				baselineType: 'ARCHITECTURE',
				itemObjectIds: ['pwu_01ARZ3NDEKTSV4RRFFQ69GF610']
			}).status
		).toBe('ACCEPTED');
		expect(statusOf()).toBe('CANDIDATE');
	});

	it('accepts CANDIDATE -> UNDER_REVIEW; refuses a re-issue from UNDER_REVIEW (no 2nd event, no rev bump)', () => {
		expect(d('SubmitBaselineForReview', {}).status).toBe('ACCEPTED');
		expect(statusOf()).toBe('UNDER_REVIEW');
		const rev = revisionOf();

		// The kill test: weakening fromStates('CANDIDATE') to include UNDER_REVIEW makes this go RED.
		const again = d('SubmitBaselineForReview', {});
		expect(again.status).toBe('REJECTED');
		expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(eventsOfType('BaselineSubmittedForReview')).toHaveLength(1);
		expect(revisionOf(), 'no silent revision bump').toBe(rev);
	});
});
