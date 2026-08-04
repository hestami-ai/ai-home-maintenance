// REG-F-012: an idempotency key reused for a DIFFERENT command must not be swallowed as a replay.
//
// THE OBSERVED DEFECT. `command-bus.ts` step 1 returned `DUPLICATE` on the mere EXISTENCE of a receipt for the
// key, comparing nothing. So a wholly different command reusing a key was silently discarded: it produced no
// events, created no aggregate, and reported `DUPLICATE` — a status the demo's own multi-step authoring path
// treats as SUCCESS. The caller is told its command already happened. It never did.
//
// THE DETECTION MATERIAL WAS ALREADY PERSISTED AND ALREADY RETURNED. `command_receipts` stores `command_type`
// and `target_aggregate_id`; `getReceipt` reads them; `CommandReceiptRecord` carries them. Step 1 discarded both.
// The refusal was one comparison away from free.
//
// CANON: JPWB-DOC-003 PER-5 — reuse of a key with a different payload FAILS. This closes two of that rule's three
// dimensions (command type, target aggregate). The THIRD — same command, same target, different PAYLOAD — is not
// closed here and is not silently skipped: the receipt stores `resultHash`, which is `contentHash(nextState)` —
// a hash of the RESULTING OBJECT, not of the payload. Comparing payloads needs a stored payload hash, i.e. a
// persistence schema change, and detecting it via `resultHash` would require executing the command first, which
// is exactly what idempotency exists to avoid. Recorded as owed rather than approximated.
//
// THE ERROR CODE IS A RATIFIED ONE CARRYING A LABEL, per the WP-11 discipline REG-F-012 names.
// `RPH_IDEMPOTENCY_CONFLICT` would be the natural code and is NOT among the ratified fifteen; minting one is a
// sponsor act, not a repository one. `RPH_IDEMPOTENCY_DUPLICATE` is ratified but belongs to the REPLAY, which
// REG-F-010 records as correctly carrying no error at all. So the refusal uses
// `RPH_VALIDATION_SEMANTIC_FAILED` — the command is semantically inapplicable given the receipt on record — and
// puts `IDEMPOTENCY_KEY_REUSED` in the message where a reader and a future code can both find it.
//
// SURVEYED BEFORE CHANGING BEHAVIOUR. Instrumented across the whole suite: exactly TWO dispatches ever reach the
// duplicate path, and BOTH are true replays (same command type, same target). No caller anywhere reuses a key
// across commands, so this refuses nothing the engine accepts today.
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const TS = '2026-08-04T00:00:00Z';
const ACTOR: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT_A = 'int_01ARZ3NDEKTSV4RRFFQ69J8001';
const INTENT_B = 'int_01ARZ3NDEKTSV4RRFFQ69J8002';
const KEY = 'the-one-key';

describe('REG-F-012: an idempotency key is bound to the command that claimed it', () => {
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	const dispatch = (
		commandType: string,
		payload: unknown,
		id: string,
		aggType: string,
		idempotencyKey: string
	) => {
		const n = ++seq;
		const command: DomainCommand = {
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: ACTOR,
			correlationId: 'reg-f-012',
			idempotencyKey,
			payload
		};
		return engine.dispatch(command);
	};

	const capture = (id: string, key: string) =>
		dispatch(
			'CaptureIntent',
			{ intentId: id, originatingExpression: 'ship it', ontologyId: 'o', ontologyVersion: '1' },
			id,
			'INTENT',
			key
		);

	it('a DIFFERENT target under the same key is refused, not swallowed', () => {
		expect(capture(INTENT_A, KEY).status, 'the first command claims the key').toBe('ACCEPTED');

		const second = capture(INTENT_B, KEY);
		expect(second.status, JSON.stringify(second.error)).toBe('REJECTED');
		expect(second.error?.message).toContain('IDEMPOTENCY_KEY_REUSED');
		expect(
			store.loadObject(INTENT_B),
			'THE POINT: the swallowed command used to create nothing while reporting success'
		).toBeUndefined();
	});

	it('a DIFFERENT command type under the same key is refused', () => {
		expect(capture(INTENT_A, KEY).status).toBe('ACCEPTED');

		// Same target, different command. Under the old bus this reported DUPLICATE and did nothing.
		const second = dispatch('BeginIntentDiscovery', {}, INTENT_A, 'INTENT', KEY);
		expect(second.status, JSON.stringify(second.error)).toBe('REJECTED');
		expect(second.error?.message).toContain('IDEMPOTENCY_KEY_REUSED');
		expect(
			(store.loadObject(INTENT_A)?.state as { intentStatus?: string })?.intentStatus,
			'and the intent did not advance'
		).toBe('RAW');
	});

	// CONTROL — the behaviour this must NOT break. A true replay is RPH-PER-002's ratified contract: the prior
	// result, no new event, no error. Without this the guard could refuse every repeated key and both tests above
	// would still pass.
	it('CONTROL: a TRUE replay still returns DUPLICATE with the prior result and no new event', () => {
		const first = capture(INTENT_A, KEY);
		expect(first.status).toBe('ACCEPTED');
		const eventsAfterFirst = store.readAllEvents().length;

		const replay = capture(INTENT_A, KEY);
		expect(replay.status, JSON.stringify(replay.error)).toBe('DUPLICATE');
		expect(replay.error, 'a replay is not an error').toBeUndefined();
		expect(replay.producedEventIds, 'it returns the PRIOR events').toEqual(first.producedEventIds);
		expect(store.readAllEvents(), 'and appends nothing').toHaveLength(eventsAfterFirst);
	});

	// A distinct key is untouched by any of this — the guard keys on the RECEIPT, not on the command shape.
	it('CONTROL: the same command under a DIFFERENT key is accepted normally', () => {
		expect(capture(INTENT_A, KEY).status).toBe('ACCEPTED');
		expect(capture(INTENT_B, 'another-key').status).toBe('ACCEPTED');
		expect(store.loadObject(INTENT_B)).toBeDefined();
	});
});
