// JAN-CMDPRE DWP-01b — the Precondition module in isolation, plus its wiring into the real write primitive.
// Each migrated call site's REFUSAL behavior is killed by a named re-issue test in its own fixture file
// (command-reissue-guard: authorize/deny/revoke RuntimeBinding, reviseIntent; decision-kind-guard: the Decision
// family; assurance-independence: the three completeAssuranceAssessment branches; baseline-open-blocking-
// observation: approveBaseline; pwa-authoring: publishPwa). This file proves the MECHANISM: refusal codes,
// message shape byte-for-byte, ALL_OF ordering/short-circuit, the (state, PAYLOAD) contract, and that
// advanceStatus actually hands a predicate the loaded state + payload + a working (and copy-on-read) reader —
// the critique-B4 signature, which stays unused by production predicates until DWP-08, so an untested wiring
// would be a promise, not a ruling.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import type { Logger } from '@janumipwb/rph-ports';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from '../index.js';
import {
	allOf,
	evaluatePrecondition,
	fromStates,
	predicate,
	type PredicateInput,
	type PreconditionReader
} from './command-precondition.js';
import { advanceStatus, preconditionReader, type HandlerContext } from './kit.js';

const TS = '2026-07-23T00:00:00Z';
const HUMAN: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'User' };

const command = (commandType = 'AdvanceThing', targetAggregateId = 'thing-1'): DomainCommand => ({
	commandId: 'c-1',
	commandType,
	commandSchemaVersion: 1,
	targetAggregateType: 'THING',
	targetAggregateId,
	issuedAt: TS,
	issuedBy: HUMAN,
	correlationId: 'corr',
	idempotencyKey: 'k-1',
	payload: { note: 'p' }
});

const stubReader: PreconditionReader = {
	objectState: () => undefined,
	aggregateEvents: () => []
};

const input = (state: Record<string, unknown>, cmd = command()): PredicateInput => ({
	state,
	payload: cmd.payload,
	command: cmd,
	read: stubReader
});

const SITE = { statusField: 'status', subject: 'THING', eventType: 'ThingAdvanced' };

describe('fromStates — the state-set special case', () => {
	it('admits a state in the set', () => {
		expect(evaluatePrecondition(fromStates('A', 'B'), input({ status: 'B' }), SITE)).toBeNull();
	});

	it("refuses a state outside the set with RPH_ILLEGAL_STATE_TRANSITION and DWP-00's message shape", () => {
		const refusal = evaluatePrecondition(fromStates('A', 'B'), input({ status: 'C' }), SITE);
		expect(refusal?.code).toBe('RPH_ILLEGAL_STATE_TRANSITION');
		expect(refusal?.message).toBe(
			'AdvanceThing requires THING thing-1 to be A or B, but it is C. Re-issuing it would append a second ThingAdvanced recording a change that did not happen.'
		);
	});
});

describe('predicate — the general case', () => {
	it('admits on null and refuses with the returned message at RPH_VALIDATION_SEMANTIC_FAILED by default', () => {
		const rule = predicate('the flag must be set', ({ state }) =>
			state.flag ? null : 'flag is not set'
		);
		expect(evaluatePrecondition(rule, input({ flag: true }), SITE)).toBeNull();
		const refusal = evaluatePrecondition(rule, input({ flag: false }), SITE);
		expect(refusal?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(refusal?.message).toBe('flag is not set');
	});

	it('honours a custom errorCode', () => {
		const rule = predicate('never admissible', () => 'no', 'RPH_INVARIANT_VIOLATION');
		expect(evaluatePrecondition(rule, input({}), SITE)?.code).toBe('RPH_INVARIANT_VIOLATION');
	});

	it('sees the command payload — DS-001 D1 rules over (state, PAYLOAD), so the payload half must be live', () => {
		// No production predicate reads payload until DWP-08, so pin it here or the (state, payload) contract is
		// an untested promise: a predicate that inspects payload decides on it.
		const rule = predicate('payload.note must equal APPROVE', ({ payload }) =>
			(payload as { note?: string }).note === 'APPROVE' ? null : 'note was not APPROVE'
		);
		const cmd = command();
		expect((cmd.payload as { note?: string }).note).toBe('p'); // the helper's payload
		expect(evaluatePrecondition(rule, input({}, cmd), SITE)?.message).toBe('note was not APPROVE');
		const approving = { ...cmd, payload: { note: 'APPROVE' } };
		expect(evaluatePrecondition(rule, input({}, approving), SITE)).toBeNull();
	});
});

describe('allOf — ordered conjunction, first refusal wins', () => {
	it('short-circuits: a later rule is not consulted after an earlier refusal', () => {
		let consulted = 0;
		const first = predicate('kind check', () => 'kind refused');
		const second = predicate('state check', () => {
			consulted += 1;
			return null;
		});
		const refusal = evaluatePrecondition(allOf(first, second), input({}), SITE);
		expect(refusal?.message).toBe('kind refused');
		expect(consulted).toBe(0);
	});

	it('admits only when every rule admits, and preserves declaration order in the refusal', () => {
		const combined = allOf(
			predicate('kind', ({ state }) => (state.kind === 'RIGHT' ? null : 'wrong kind')),
			fromStates('OPEN')
		);
		expect(
			evaluatePrecondition(combined, input({ kind: 'RIGHT', status: 'OPEN' }), SITE)
		).toBeNull();
		// Both would refuse — the FIRST (kind) must win, with its semantic code.
		const refusal = evaluatePrecondition(
			combined,
			input({ kind: 'WRONG', status: 'CLOSED' }),
			SITE
		);
		expect(refusal?.code).toBe('RPH_VALIDATION_SEMANTIC_FAILED');
		expect(refusal?.message).toBe('wrong kind');
	});
});

describe('preconditionReader — the critique-B4 read-only surface, against the real store', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;

	const silent: Logger = {
		log: () => {},
		debug: () => {},
		info: () => {},
		warn: () => {},
		error: () => {},
		fatal: () => {},
		child: () => silent
	};

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		let seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	it('reads a committed object state and an aggregate event stream', () => {
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V00';
		const r = engine.dispatch({
			commandId: 'c-cap',
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: INTENT,
			issuedAt: TS,
			issuedBy: HUMAN,
			correlationId: 'corr',
			idempotencyKey: 'k-cap',
			payload: {
				intentId: INTENT,
				originatingExpression: 'a captured intent',
				ontologyId: 'ont-1',
				ontologyVersion: '1.0.0'
			}
		});
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');

		const read = preconditionReader({
			store,
			now: () => TS,
			newEventId: () => 'e-reader',
			logger: silent
		});
		expect(read.objectState(INTENT)?.intentStatus).toBe('RAW');
		expect(read.objectState('missing-id')).toBeUndefined();
		const events = read.aggregateEvents('INTENT', INTENT);
		expect(events).toHaveLength(1);
		expect(events[0]?.eventType).toBe('IntentCaptured');
	});

	it('advanceStatus WIRES the loaded state, the command payload, and a working reader into the predicate', () => {
		// The reader test above proves preconditionReader reads; this proves the PRIMITIVE actually hands a
		// predicate all three inputs — otherwise the reader is a function nothing calls until DWP-08. Seed a real
		// INTENT to load, then drive advanceStatus with a predicate that captures what it was given and refuses
		// (so no valid transition is needed).
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V10';
		expect(
			engine.dispatch({
				commandId: 'c-cap2',
				commandType: 'CaptureIntent',
				commandSchemaVersion: 1,
				targetAggregateType: 'INTENT',
				targetAggregateId: INTENT,
				issuedAt: TS,
				issuedBy: HUMAN,
				correlationId: 'corr',
				idempotencyKey: 'k-cap2',
				payload: {
					intentId: INTENT,
					originatingExpression: 'x',
					ontologyId: 'ont-1',
					ontologyVersion: '1.0.0'
				}
			}).status
		).toBe('ACCEPTED');

		let seen: { stateStatus?: unknown; payloadNote?: unknown; readerStatus?: unknown } | undefined;
		const capture = predicate('capture inputs and refuse', (i) => {
			seen = {
				stateStatus: i.state.intentStatus,
				payloadNote: (i.payload as { note?: string }).note,
				readerStatus: i.read.objectState(INTENT)?.intentStatus
			};
			return 'captured — refusing so no transition is needed';
		});
		const ctx: HandlerContext = { store, now: () => TS, newEventId: () => 'e-w', logger: silent };
		const result = advanceStatus(
			ctx,
			{
				commandId: 'c-adv',
				commandType: 'AdvanceIntentThroughPrimitive',
				commandSchemaVersion: 1,
				targetAggregateType: 'INTENT',
				targetAggregateId: INTENT,
				issuedAt: TS,
				issuedBy: HUMAN,
				correlationId: 'corr',
				idempotencyKey: 'k-adv',
				payload: { note: 'from-the-command' }
			},
			{
				objectType: 'INTENT',
				statusField: 'intentStatus',
				machine: 'Intent.intentStatus',
				target: 'UNDER_DISCOVERY',
				eventType: 'IntentDiscoveryStarted',
				precondition: capture
			}
		);
		expect(result.status).toBe('REJECTED');
		expect(seen).toEqual({
			stateStatus: 'RAW',
			payloadNote: 'from-the-command',
			readerStatus: 'RAW'
		});
	});

	it('hands the predicate a CLONE — a mutating check cannot corrupt the object the primitive commits', () => {
		// The critique-B4 no-write property is mechanical: state/payload are cloned before the predicate sees them.
		const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69G5V20';
		expect(
			engine.dispatch({
				commandId: 'c-cap3',
				commandType: 'CaptureIntent',
				commandSchemaVersion: 1,
				targetAggregateType: 'INTENT',
				targetAggregateId: INTENT,
				issuedAt: TS,
				issuedBy: HUMAN,
				correlationId: 'corr',
				idempotencyKey: 'k-cap3',
				payload: {
					intentId: INTENT,
					originatingExpression: 'x',
					ontologyId: 'ont-1',
					ontologyVersion: '1.0.0'
				}
			}).status
		).toBe('ACCEPTED');

		const vandal = predicate('mutate the inputs, then refuse', (i) => {
			(i.state as Record<string, unknown>).intentStatus = 'HIJACKED';
			(i.state as Record<string, unknown>).injected = true;
			return 'refused';
		});
		const ctx: HandlerContext = { store, now: () => TS, newEventId: () => 'e-v', logger: silent };
		advanceStatus(
			ctx,
			{
				commandId: 'c-adv2',
				commandType: 'AdvanceIntentThroughPrimitive',
				commandSchemaVersion: 1,
				targetAggregateType: 'INTENT',
				targetAggregateId: INTENT,
				issuedAt: TS,
				issuedBy: HUMAN,
				correlationId: 'corr',
				idempotencyKey: 'k-adv2',
				payload: {}
			},
			{
				objectType: 'INTENT',
				statusField: 'intentStatus',
				machine: 'Intent.intentStatus',
				target: 'UNDER_DISCOVERY',
				eventType: 'IntentDiscoveryStarted',
				precondition: vandal
			}
		);
		// The committed object is untouched: the predicate mutated only its own clone.
		const after = store.loadObject(INTENT)?.state as Record<string, unknown>;
		expect(after.intentStatus).toBe('RAW');
		expect(after.injected).toBeUndefined();
	});
});
