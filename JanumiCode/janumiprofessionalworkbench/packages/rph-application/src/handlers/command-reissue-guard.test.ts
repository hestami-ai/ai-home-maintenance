// JAN-NOOP-01 — a command RE-ISSUED against an aggregate already in its target state must be REFUSED.
//
// Why this file exists. `classifyTransition` returns NOOP whenever from === to, and `checkTransition` admits NOOP as
// legal — so the shared `advanceStatus` primitive ran its whole write path for a command that changed nothing: it
// re-ran `mutate` against the ALREADY-mutated state, bumped the revision (and semanticVersion where the call site
// bumps it), and appended a fresh immutable event whose payload could CONTRADICT the first. Events record ACCEPTED
// STATE CHANGES (DOC-002 §27; DOC-007 §9.1 carries "the accepted facts, not the original request"), the log is
// append-only, and the corpus supplies no retraction mechanism — so a false entry is permanent.
//
// The idempotency layer does NOT cover this: it keys strictly on idempotencyKey, and every key producer in the repo
// is a monotonic counter, so it absorbs an exact replay and nothing else. A re-issue with a fresh key is a DISTINCT
// request, which is why these are rejections rather than absorbed duplicates.
//
// Each test below is a defect that was REPRODUCED against the real engine before the guard existed. The sites are
// hand-authored from each machine's own in-arrows — deliberately NOT generated from the vocab's `drivesFrom`, which
// has no ratified authority, is absent for twelve commands, and names the wrong machine for at least one.
import type { DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';

const TS = '2026-07-22T00:00:00Z';
const USER_1 = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'First approver' };
const USER_2 = { actorId: 'u2', actorType: 'HUMAN' as const, displayName: 'Second actor' };

const BINDING = 'rb_01ARZ3NDEKTSV4RRFFQ69GN100';
const STEP = 'step_01ARZ3NDEKTSV4RRFFQ69GN110';
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69GN120';

describe('JAN-NOOP-01 — a re-issued command cannot append a contradicting fact', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	function dispatch(
		commandType: string,
		payload: unknown,
		id: string,
		aggType: string,
		issuedBy = USER_1
	) {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy,
			correlationId: 'corr',
			idempotencyKey: `k-${n}`, // a DISTINCT key each time — this is a new request, not a transport retry
			payload
		};
		return engine.dispatch(command);
	}

	const stateOf = (id: string) => store.loadObject(id)?.state as Record<string, unknown>;
	const eventsOfType = (t: string) => store.readAllEvents().filter((e) => e.eventType === t);

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	// THE SECURITY CASE. A runtime binding gates what an execution step may actually do, and §22.1 is explicit that a
	// REQUESTED capability is not a GRANTED one. Re-authorizing replaced the granted set wholesale.
	describe('AuthorizeRuntimeBinding — privilege escalation', () => {
		const request = () =>
			dispatch(
				'RequestRuntimeBinding',
				{
					runtimeBindingId: BINDING,
					executionStepId: STEP,
					roleId: 'role-executor',
					requestedCapabilities: [{ capability: 'fs.read' }]
				},
				BINDING,
				'RUNTIME_BINDING'
			);

		it('REFUSES a second authorization, so granted capabilities cannot exceed what was requested', () => {
			expect(request().status).toBe('ACCEPTED');
			expect(
				dispatch(
					'AuthorizeRuntimeBinding',
					{ grantedCapabilities: [{ capability: 'fs.read' }] },
					BINDING,
					'RUNTIME_BINDING'
				).status
			).toBe('ACCEPTED');

			// A DIFFERENT actor now tries to widen the grant with no new request and no new authorization decision.
			const escalation = dispatch(
				'AuthorizeRuntimeBinding',
				{ grantedCapabilities: [{ capability: 'fs.read' }, { capability: 'shell.exec' }] },
				BINDING,
				'RUNTIME_BINDING',
				USER_2
			);
			expect(escalation.status).toBe('REJECTED');
			expect(escalation.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');

			expect(stateOf(BINDING).grantedCapabilities).toEqual([{ capability: 'fs.read' }]);
			expect(eventsOfType('RuntimeBindingAuthorized')).toHaveLength(1);
		});

		it('REFUSES a re-revocation (it would rewrite the recorded revocation)', () => {
			request();
			dispatch(
				'AuthorizeRuntimeBinding',
				{ grantedCapabilities: [{ capability: 'fs.read' }] },
				BINDING,
				'RUNTIME_BINDING'
			);
			expect(
				dispatch(
					'RevokeRuntimeCapability',
					{ reason: 'engagement ended' },
					BINDING,
					'RUNTIME_BINDING'
				).status
			).toBe('ACCEPTED');
			const again = dispatch(
				'RevokeRuntimeCapability',
				{ reason: 'a different, contradicting reason' },
				BINDING,
				'RUNTIME_BINDING',
				USER_2
			);
			expect(again.status).toBe('REJECTED');
			expect(eventsOfType('RuntimeCapabilityRevoked')).toHaveLength(1);
		});

		it('still permits the legitimate PARTIALLY_AUTHORIZED → AUTHORIZED widening path', () => {
			// requireFrom must not be narrower than the machine: PARTIALLY_AUTHORIZED is a real in-arrow to AUTHORIZED.
			request();
			const partial = stateOf(BINDING);
			expect(partial.authorizationStatus).toBe('REQUESTED');
			expect(
				dispatch(
					'AuthorizeRuntimeBinding',
					{ grantedCapabilities: [{ capability: 'fs.read' }] },
					BINDING,
					'RUNTIME_BINDING'
				).status
			).toBe('ACCEPTED');
			expect(stateOf(BINDING).authorizationStatus).toBe('AUTHORIZED');
		});
	});

	// THE GOVERNANCE CASE. semanticVersion is load-bearing: ApproveIntent requires approvedSemanticVersion to equal the
	// current one, so inflating it voids an approval that is already outstanding.
	describe('ReviseIntent — semanticVersion inflation cannot void an approval', () => {
		function approvedIntent() {
			expect(
				dispatch(
					'CaptureIntent',
					{
						intentId: INTENT,
						originatingExpression: 'x',
						ontologyId: 'o',
						ontologyVersion: '1'
					},
					INTENT,
					'INTENT'
				).status
			).toBe('ACCEPTED');
			expect(dispatch('BeginIntentDiscovery', {}, INTENT, 'INTENT').status).toBe('ACCEPTED');
			expect(dispatch('ProvisionIntent', { ambiguityIds: [] }, INTENT, 'INTENT').status).toBe(
				'ACCEPTED'
			);
			expect(
				dispatch(
					'FormalizeIntent',
					{
						formalizedObjective: 'Ship the thing',
						desiredOutcomes: [{ description: 'the thing ships' }],
						successConditions: [{ statement: 'it shipped' }],
						nonGoals: [],
						ambiguityIds: [],
						constraintIds: [],
						stakeholderIds: []
					},
					INTENT,
					'INTENT'
				).status
			).toBe('ACCEPTED');
			const v = Number(stateOf(INTENT).semanticVersion);
			expect(
				dispatch(
					'ApproveIntent',
					{ decisionId: 'dec_1', approvedSemanticVersion: v, approvalScope: 'full' },
					INTENT,
					'INTENT'
				).status
			).toBe('ACCEPTED');
		}

		it('REFUSES a second revision from REVISED, holding semanticVersion still', () => {
			approvedIntent();
			expect(
				dispatch('ReviseIntent', { changeRationale: 'a real revision' }, INTENT, 'INTENT').status
			).toBe('ACCEPTED');
			const afterFirst = Number(stateOf(INTENT).semanticVersion);

			const again = dispatch(
				'ReviseIntent',
				{ changeRationale: 'a second rationale for a revision that changed nothing' },
				INTENT,
				'INTENT',
				USER_2
			);
			expect(again.status).toBe('REJECTED');
			expect(again.error?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
			expect(Number(stateOf(INTENT).semanticVersion)).toBe(afterFirst);
			expect(eventsOfType('IntentRevised')).toHaveLength(1);
		});
	});

	// The generic property, stated once: the guard is about the append-only record, not about tidiness.
	it('appends NO event for a refused re-issue — the log records only accepted changes', () => {
		dispatch(
			'RequestRuntimeBinding',
			{
				runtimeBindingId: BINDING,
				executionStepId: STEP,
				roleId: 'r',
				requestedCapabilities: []
			},
			BINDING,
			'RUNTIME_BINDING'
		);
		dispatch('AuthorizeRuntimeBinding', { grantedCapabilities: [] }, BINDING, 'RUNTIME_BINDING');
		const before = store.readAllEvents().length;
		const revision = store.loadObject(BINDING)?.revision;

		dispatch('AuthorizeRuntimeBinding', { grantedCapabilities: [] }, BINDING, 'RUNTIME_BINDING');

		expect(store.readAllEvents()).toHaveLength(before);
		expect(store.loadObject(BINDING)?.revision, 'no silent revision bump').toBe(revision);
	});
});
