// REG-F-011: the command ENVELOPE is validated at the bus.
//
// `DomainCommandSchema` was validated NOWHERE in production. Its four references were all inside `rph-contracts`
// — its own definition, the generated schema manifest, and its registration into a `SchemaRegistry` that itself
// had no production consumer. `command-bus.ts` validated only `command.payload`, against `COMMANDS[type].payload`.
//
// So the engine's public entry point accepted commands its own ratified transport contract forbids. These are
// REG-F-011's own measurements, each turned from a recorded observation into a standing assertion — the point
// being that a finding whose evidence is a paragraph rots, and one whose evidence is a test does not.
//
// SEQUENCING, because it is load-bearing rather than incidental:
//   `commandId` / `correlationId`  — refused EARLIER (the crash half, 2026-08-02). Their absence breaks the
//                                    store's NOT NULL columns before any schema could speak, and it used to let a
//                                    raw SqliteError ESCAPE `dispatch` — a throw where the contract promises a
//                                    CommandResult. `command-envelope-identity.test.ts` owns that.
//   the envelope                    — here, BEFORE idempotency: a malformed envelope must not be answered from a
//                                    receipt.
//   the payload                     — after, unchanged.
//
// THE SURVEY CORRECTED THE FINDING THAT ORDERED IT. REG-F-011 recorded that "several test fixtures in this
// repository omit envelope fields today and would begin failing, which is the honest cost and also the argument
// for doing it". Instrumented across the whole suite before the change: ALL 16,609 DISPATCHES ALREADY PASSED. The
// cost was zero, and the estimate — a reasonable guess, written carefully — was simply wrong. Recorded because
// the lesson is not "guess better" but "the survey is cheap; run it".
import type { ActorReference, DomainCommand } from '@janumipwb/rph-contracts';
import type { AuthedEngine } from '@janumipwb/rph-application';
import { TEST_CRED, testAuthenticator } from '@janumipwb/rph-ports/testing';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { beforeEach, describe, expect, it } from 'vitest';
import { Engine } from './index.js';

const TS = '2026-08-04T00:00:00Z';
const ACTOR: ActorReference = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const INTENT = 'int_01ARZ3NDEKTSV4RRFFQ69J9001';

describe('REG-F-011: the command envelope is validated at the bus', () => {
	let store: SqliteStorageAdapter;
	let engine: AuthedEngine;
	let seq = 0;

	beforeEach(() => {
		store = new SqliteStorageAdapter({ now: () => TS });
		seq = 0;
		engine = new Engine({ authenticate: testAuthenticator(), store, now: () => TS, newEventId: () => `e${++seq}` }).as(TEST_CRED.human);
	});

	/** A complete, well-formed CaptureIntent envelope. Every case below is this minus (or plus) one field. */
	const wellFormed = (): DomainCommand => {
		const n = ++seq;
		return {
			commandId: `c-${n}`,
			commandType: 'CaptureIntent',
			commandSchemaVersion: 1,
			targetAggregateType: 'INTENT',
			targetAggregateId: INTENT,
			issuedAt: TS,
			correlationId: 'reg-f-011',
			idempotencyKey: `k-${n}`,
			payload: {
				intentId: INTENT,
				originatingExpression: 'ship it',
				ontologyId: 'o',
				ontologyVersion: '1'
			}
		};
	};

	const without = (field: keyof DomainCommand): DomainCommand => {
		const command = { ...wellFormed() } as Record<string, unknown>;
		delete command[field];
		return command as unknown as DomainCommand;
	};

	// CONTROL FIRST, because every assertion below is a refusal and a bus that refused everything would satisfy
	// them all.
	it('CONTROL: the well-formed command is ACCEPTED and creates its aggregate', () => {
		const r = engine.dispatch(wellFormed());
		expect(r.status, JSON.stringify(r.error)).toBe('ACCEPTED');
		expect(store.loadObject(INTENT)).toBeDefined();
	});

	// The four fields REG-F-011 measured as omissible. Each was ACCEPTED before this change.
	it.each(['commandSchemaVersion', 'targetAggregateType', 'targetAggregateId', 'idempotencyKey'] as const)(
		'a command omitting %s is refused at the envelope',
		(field) => {
			const r = engine.dispatch(without(field));
			expect(r.status, `${field}: ${JSON.stringify(r.error)}`).toBe('VALIDATION_FAILED');
			expect(r.error?.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
			expect(
				r.error?.details,
				'the refusal carries structured issues, in the same shape the payload path produces'
			).toBeDefined();
			expect(store.loadObject(INTENT), 'and nothing was created').toBeUndefined();
		}
	);

	// `DomainCommandSchema` is a z.strictObject and, asked directly, reports `unrecognized_keys`. Nothing asked.
	it('a command carrying an undeclared ENVELOPE-level property is refused', () => {
		const r = engine.dispatch({
			...wellFormed(),
			smuggled: 'this is not a declared envelope field'
		} as unknown as DomainCommand);
		expect(r.status, JSON.stringify(r.error)).toBe('VALIDATION_FAILED');
		const issues = (r.error?.details as { issues?: { path: string; code: string }[] })?.issues ?? [];
		expect(
			issues.some((i) => i.code === 'unrecognized_keys'),
			`expected an unrecognized_keys issue, got ${JSON.stringify(issues)}`
		).toBe(true);
	});

	// ORDERING. A malformed envelope must not be answered from a receipt — otherwise a caller could claim a key
	// with a good command and then replay junk under it and be told DUPLICATE.
	it('the envelope is checked BEFORE idempotency: a malformed replay is refused, not answered', () => {
		const first = wellFormed();
		expect(engine.dispatch(first).status).toBe('ACCEPTED');

		const malformedReplay = { ...without('targetAggregateType'), idempotencyKey: first.idempotencyKey };
		const r = engine.dispatch(malformedReplay);
		expect(r.status, 'not DUPLICATE').toBe('VALIDATION_FAILED');
	});

	// And the payload path still works — the envelope check is additive, not a replacement. A well-formed
	// envelope carrying a bad payload still fails at the payload, which is where RPH-CON-002 is observed.
	it('a well-formed envelope with an invalid PAYLOAD still fails at the payload', () => {
		const r = engine.dispatch({ ...wellFormed(), payload: { intentId: INTENT } });
		expect(r.status).toBe('VALIDATION_FAILED');
		const issues = (r.error?.details as { issues?: { path: string }[] })?.issues ?? [];
		expect(
			issues.every((i) => !i.path.startsWith('payload')),
			'payload issues are reported by path WITHIN the payload, so they are distinguishable from envelope issues'
		).toBe(true);
	});
});
