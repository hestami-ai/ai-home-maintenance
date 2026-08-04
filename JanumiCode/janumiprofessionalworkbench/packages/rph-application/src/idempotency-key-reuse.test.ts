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
import { createSqliteDriver, SqliteStorageAdapter } from '@janumipwb/rph-persistence';
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

	// ── THE THIRD DIMENSION (2026-08-04) ─────────────────────────────────────────────────────────────────────
	//
	// PER-5's actual words are "reuse of a key with a different PAYLOAD fails" — the dimension the first pass
	// named as owed rather than approximating. It is closed by `command_receipts.payload_hash`
	// (`contentHash(command.payload)`), stored at the receipt write and compared before the replay.
	//
	// NOT derivable from `result_hash`, which is `contentHash(nextState)` — the RESULTING OBJECT. Getting that
	// far means having executed the command, which is what idempotency exists to avoid.
	it('the SAME command on the SAME target with a DIFFERENT PAYLOAD is refused, not swallowed', () => {
		expect(capture(INTENT_A, KEY).status).toBe('ACCEPTED');

		const second = dispatch(
			'CaptureIntent',
			{
				intentId: INTENT_A,
				originatingExpression: 'ship something else entirely',
				ontologyId: 'o',
				ontologyVersion: '1'
			},
			INTENT_A,
			'INTENT',
			KEY
		);
		expect(second.status, JSON.stringify(second.error)).toBe('REJECTED');
		expect(second.error?.message).toContain('IDEMPOTENCY_KEY_REUSED');
		expect(second.error?.message, 'and it says WHICH dimension differed').toContain('payload');
		expect(
			(store.loadObject(INTENT_A)?.state as { originatingExpression?: string })
				?.originatingExpression,
			'THE POINT: the second expression is nowhere, and the caller used to be told it had already happened'
		).toBe('ship it');
	});

	// ABSENCE IS SKIPPED, NOT FAILED — and this is the mutant for the `prior.payloadHash !== undefined` guard,
	// which nothing else can redden. A receipt written before schema v2 carries NULL, and reading NULL as "the
	// payload differed" would turn every legitimate replay in an upgraded DURABLE store into a refusal — a
	// regression against RPH-PER-002's ratified replay contract, caused by treating an absence as evidence.
	it('a PRE-v2 receipt (no stored payload hash) still replays as DUPLICATE rather than refusing', () => {
		const driver = createSqliteDriver();
		const migrated = new SqliteStorageAdapter({ driver, now: () => TS });
		let n = 0;
		const eng = new Engine({ store: migrated, now: () => TS, newEventId: () => `x${++n}` });
		const cmd = (expression: string): DomainCommand => ({
			commandId: `c-${++n}`,
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: INTENT_A,
			issuedAt: TS,
			issuedBy: ACTOR,
			correlationId: 'reg-f-012-pre-v2',
			idempotencyKey: KEY,
			payload: {
				intentId: INTENT_A,
				originatingExpression: expression,
				ontologyId: 'o',
				ontologyVersion: '1'
			}
		});
		expect(eng.dispatch(cmd('ship it')).status).toBe('ACCEPTED');

		// Age the receipt to what the v1 → v2 migration produces: the column exists and holds NULL.
		driver.prepare('UPDATE command_receipts SET payload_hash = NULL').run();
		expect(migrated.getReceipt(KEY)?.payloadHash).toBeUndefined();

		const replay = eng.dispatch(cmd('ship it'));
		expect(replay.status, JSON.stringify(replay.error)).toBe('DUPLICATE');
		expect(replay.error).toBeUndefined();
		driver.close();
	});

	// CONTROL for the dimension above, and it needs its OWN mutant: neutralising the payload comparison must
	// redden the test above and leave this one green. A payload-hash check that refused every replay would pass
	// the test above for the wrong reason.
	it('CONTROL: a replay whose payload is byte-identical but key-REORDERED is still a DUPLICATE', () => {
		expect(capture(INTENT_A, KEY).status).toBe('ACCEPTED');
		// Same fields, different insertion order. `contentHash` canonicalizes (keys sorted), so this is the SAME
		// payload — a hash over `JSON.stringify` would refuse it, and that would be a false refusal.
		const replay = dispatch(
			'CaptureIntent',
			{
				ontologyVersion: '1',
				ontologyId: 'o',
				originatingExpression: 'ship it',
				intentId: INTENT_A
			},
			INTENT_A,
			'INTENT',
			KEY
		);
		expect(replay.status, JSON.stringify(replay.error)).toBe('DUPLICATE');
		expect(replay.error).toBeUndefined();
	});

	// THE COST OF HASHING THE PAYLOAD, stated as a test rather than left as a surprise — and this case is a
	// pre-existing CRASH, not a new restriction. `contentHash` canonicalizes, and canonical JSON admits only
	// FINITE INTEGERS. Thirty-two contract fields are `z.number()` with no `.int()` (REG-F-018), so a float gets
	// past Zod. `recordArtifact` copies `byteSize` STRAIGHT INTO STATE, so before this gate a `RecordArtifact`
	// carrying `byteSize: 1.5` reached `contentHash(args.nextState)` in `kit.ts` and threw a `CanonicalJsonError`
	// OUT of `dispatch` — a throw where the contract promises a CommandResult, REG-F-011's crash class.
	//
	// Hashing the payload at the bus would have added a SECOND such throw; refusing converts BOTH into one
	// classified refusal. Measured before shipping: 0 of 16,612 dispatches across the suite fail to canonicalize.
	const artifact = (byteSize: number, key: string) =>
		dispatch(
			'RecordArtifact',
			{
				artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69J8003',
				artifactType: 'DOCUMENT',
				mediaType: 'text/plain',
				storageProvider: 'local',
				storageKey: 'k',
				contentHash: 'sha256:abc',
				byteSize,
				securityClassification: 'INTERNAL',
				retentionClass: 'STANDARD',
				status: 'AVAILABLE'
			},
			'art_01ARZ3NDEKTSV4RRFFQ69J8003',
			'ARTIFACT',
			key
		);

	it('a payload that cannot be canonicalized is REFUSED, not thrown out of dispatch', () => {
		const r = artifact(1.5, 'float-key');
		expect(r.status, JSON.stringify(r.error)).toBe('VALIDATION_FAILED');
		expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
		expect(r.error?.message).toContain('cannot be canonicalized');
		expect(
			store.loadObject('art_01ARZ3NDEKTSV4RRFFQ69J8003'),
			'and nothing was written'
		).toBeUndefined();
	});

	// CONTROL: 0c is a HASHABILITY gate, not a filter on numbers. The integer form of the very same field is
	// accepted and the artifact is created — so the test above cannot be passing because RecordArtifact is broken.
	it('CONTROL: the same payload with an INTEGER byteSize is ACCEPTED', () => {
		const r = artifact(1024, 'int-key');
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(store.loadObject('art_01ARZ3NDEKTSV4RRFFQ69J8003')).toBeDefined();
	});
});

// ── A FINDING THAT DISSOLVED, AND THE PROPERTY THAT SURVIVED IT ──────────────────────────────────────────────
//
// While closing the payload dimension a survey reported that 257 of 16,453 receipts written across the whole
// suite store a `target_aggregate_id` DIFFERENT from the command's declared `targetAggregateId` — every one a
// `DefinePwuType` / `EditPwuType` / `RemovePwuType`. `kit.ts` writes `args.aggregateId` (the aggregate the
// handler WROTE) into a column the bus compares against the DECLARED target, so that read as a false-refusal
// defect in REG-F-012's own remediation: a true replay of those three commands refused as
// `IDEMPOTENCY_KEY_REUSED`, latent in the suite and reachable from the demo's `ui-idem-*` keys.
//
// IT IS NOT ONE. The test below was written to be the red that proved it and came back GREEN, so the claim got
// the verification the claim itself had not: (a) the receipt was read directly — for `DefinePwuType` it holds
// the PWU_TYPE, i.e. the declared target; (b) the mechanism was traced — `bumpPwaSemanticVersion` derives a
// SEPARATE command with `idempotencyKey: `${key}#pwa-version`` and commits the PWA under THAT key, which is why
// two commits in one dispatch do not collide on a primary-keyed receipt table; (c) the survey was re-run
// recording `commandId`, and ALL 259 mismatches are `#pwa-version` commands. Zero primary receipts mismatch.
//
// So the existing column already holds what the bus compares, and the second column this nearly grew — a
// `command_target_aggregate_id` "fix" — would have been schema added for a defect that does not exist. Kept as
// the standing proof of the property, because the property is real and load-bearing: the suffix is what keeps
// the derived commit out of the outer command's receipt.
describe('a replay of a command whose handler ALSO commits a derived one', () => {
	const PWA = 'pwa_01ARZ3NDEKTSV4RRFFQ69J9100';
	const ROOT = 'pwut_01ARZ3NDEKTSV4RRFFQ69J9110';
	let store: SqliteStorageAdapter;
	let engine: Engine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ store, now: () => TS, newEventId: () => `e${++seq}` });
	});

	const d = (commandType: string, id: string, aggType: string, payload: unknown, key: string) => {
		const n = ++seq;
		return engine.dispatch({
			commandId: `c-${n}`,
			commandType,
			commandSchemaVersion: 1,
			targetAggregateType: aggType,
			targetAggregateId: id,
			issuedAt: TS,
			issuedBy: ACTOR,
			correlationId: 'reg-f-018',
			idempotencyKey: key,
			payload
		} as DomainCommand);
	};

	const defineRoot = (key: string) =>
		d(
			'DefinePwuType',
			ROOT,
			'PWU_TYPE',
			{
				pwuTypeId: ROOT,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			key
		);

	beforeEach(() => {
		expect(
			d(
				'CreatePwa',
				PWA,
				'PROFESSIONAL_WORK_ARCHITECTURE',
				{ pwaId: PWA, name: 'A', description: 'd', domain: 'software', version: '1.0.0' },
				'pwa-key'
			).status
		).toBe('ACCEPTED');
	});

	it('is a DUPLICATE — and the two commits land under two DIFFERENT keys', () => {
		const first = defineRoot('define-key');
		expect(first.status, JSON.stringify(first.error)).toBe('ACCEPTED');
		const eventsAfterFirst = store.readAllEvents().length;

		// The outer receipt records the command as issued: its type, and the target it DECLARED.
		const outer = store.getReceipt('define-key');
		expect(outer?.commandType).toBe('DefinePwuType');
		expect(outer?.targetAggregateId, 'the DECLARED target, not the PWA the bump wrote').toBe(ROOT);

		// The derived PWA version bump is a separate command under a SUFFIXED key. Drop the suffix and this row
		// collides with the outer one on `command_receipts.idempotency_key` (PRIMARY KEY) — which is the mutant:
		// removing `#pwa-version` from `bumpPwaSemanticVersion` makes the insert throw.
		const derived = store.getReceipt('define-key#pwa-version');
		expect(derived, 'the bump wrote its own receipt').toBeDefined();
		expect(derived?.commandId).toContain('#pwa-version');

		const replay = defineRoot('define-key');
		expect(replay.status, JSON.stringify(replay.error)).toBe('DUPLICATE');
		expect(replay.error, 'a replay is not an error').toBeUndefined();
		expect(replay.producedEventIds).toEqual(first.producedEventIds);
		expect(store.readAllEvents()).toHaveLength(eventsAfterFirst);
	});

	// CONTROL with its OWN mutant: the fix must not make the target dimension vacuous for these commands.
	// A genuinely different declared target under the same key is still refused.
	it('CONTROL: a DIFFERENT declared target under the same key is still refused', () => {
		expect(defineRoot('define-key').status).toBe('ACCEPTED');
		const other = 'pwut_01ARZ3NDEKTSV4RRFFQ69J9120';
		const second = d(
			'DefinePwuType',
			other,
			'PWU_TYPE',
			{
				pwuTypeId: other,
				pwaId: PWA,
				pwuKind: 'PRODUCT_REALIZATION',
				name: 'R',
				purpose: 'root',
				isRoot: true
			},
			'define-key'
		);
		expect(second.status, JSON.stringify(second.error)).toBe('REJECTED');
		expect(second.error?.message).toContain('IDEMPOTENCY_KEY_REUSED');
	});
});
