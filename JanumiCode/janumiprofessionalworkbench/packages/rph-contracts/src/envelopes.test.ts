import { describe, expect, it } from 'vitest';
import {
	CommandResultSchema,
	DomainCommandSchema,
	DomainEventSchema,
	ObjectEnvelopeSchema
} from './envelopes.js';
import { mintId } from './ids.js';
import { validateAgainst } from './validate.js';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const actor = { actorId: 'user-1', actorType: 'HUMAN', displayName: 'Alice' };
const provenance = { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] };

function validEnvelope(): Record<string, unknown> {
	return {
		id: mintId('INTENT', () => ULID),
		objectType: 'INTENT',
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'RAW',
		createdAt: '2026-07-10T22:00:00Z',
		createdBy: actor,
		updatedAt: '2026-07-10T22:00:00Z',
		updatedBy: actor,
		provenance,
		tags: [],
		extensions: []
	};
}

// ~~describe('ObjectEnvelope (RPH-CON-001/002/004)')~~ — THE RULE IDS WERE ON THE WRONG SUBJECT (REG-F-011,
// corrected 2026-08-04, struck rather than deleted so the claim and its clearing are both visible).
//
// All three of those rules are about COMMANDS: RPH-CON-001 "a COMMAND ENVELOPE containing all required fields
// validates successfully against the COMMAND SCHEMA"; RPH-CON-002 "a canonical COMMAND PAYLOAD with an undeclared
// property fails"; RPH-CON-004 "a COMMAND containing a non-RFC-3339 timestamp fails". Every test below asserts
// `ObjectEnvelopeSchema` — the OBJECT envelope. Same word, different subject, which is the substitution DS-001 §4
// records at the layer level and this register has now found four times at the subject level.
//
// THE TESTS ARE GOOD AND STAY; only the ids move. The Object envelope genuinely needs these assertions. And the
// tests that DO discharge the command rules were already here, in the next describe block, carrying no ids at all
// — so the manifest's file-level cite was never false, it was just unfalsifiable at the granularity that matters.
// That is the more precise diagnosis than REG-F-011's "the manifest cites the wrong test": the FILE was right and
// the LABEL was wrong, and a file-granularity cite cannot tell those apart.
describe('ObjectEnvelope (object-level shape; the CON rules are command-level, see below)', () => {
	it('accepts a valid object envelope', () => {
		expect(ObjectEnvelopeSchema.safeParse(validEnvelope()).success).toBe(true);
	});

	it('rejects an undeclared property with RPH_VALIDATION_SCHEMA_FAILED', () => {
		const r = validateAgainst(
			ObjectEnvelopeSchema,
			{ ...validEnvelope(), sneaky: true },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('rejects a non-RFC-3339 timestamp', () => {
		expect(
			ObjectEnvelopeSchema.safeParse({ ...validEnvelope(), createdAt: '2026-07-10' }).success
		).toBe(false);
		expect(
			ObjectEnvelopeSchema.safeParse({ ...validEnvelope(), createdAt: 'not-a-date' }).success
		).toBe(false);
	});

	it('rejects a malformed id and an invalid objectType', () => {
		expect(ObjectEnvelopeSchema.safeParse({ ...validEnvelope(), id: 'not-an-id' }).success).toBe(
			false
		);
		expect(ObjectEnvelopeSchema.safeParse({ ...validEnvelope(), objectType: 'FOO' }).success).toBe(
			false
		);
	});

	it('accepts optional ontology fields but rejects an unknown extension key shape', () => {
		expect(
			ObjectEnvelopeSchema.safeParse({
				...validEnvelope(),
				ontologyId: 'product-realization-pwa',
				ontologyVersion: '1.0.0'
			}).success
		).toBe(true);
		expect(
			ObjectEnvelopeSchema.safeParse({
				...validEnvelope(),
				extensions: [{ namespace: 'x', schemaVersion: 1 }]
			}).success
		).toBe(false); // missing `data`
	});
});

describe('command / event / result envelopes', () => {
	const baseCommand = {
		commandId: 'cmd-1',
		commandType: 'CaptureIntent',
		commandSchemaVersion: 1,
		targetAggregateType: 'INTENT',
		targetAggregateId: 'int_' + ULID,
		issuedAt: '2026-07-10T22:00:00Z',
		correlationId: 'corr-1',
		idempotencyKey: 'idem-1',
		payload: { title: 'x' }
	};

	// RPH-CON-001, on its actual subject: "a command envelope containing all required fields validates
	// successfully against the COMMAND SCHEMA". This assertion has been here all along, unlabelled, while the id
	// sat on an object-envelope test one block up.
	it('RPH-CON-001: accepts a well-formed command and allows an optional expectedRevision', () => {
		expect(DomainCommandSchema.safeParse(baseCommand).success).toBe(true);
		expect(DomainCommandSchema.safeParse({ ...baseCommand, expectedRevision: 3 }).success).toBe(
			true
		);
	});

	it('RPH-CON-001 (complement): rejects a command missing a required transport field', () => {
		const { idempotencyKey, ...missing } = baseCommand;
		void idempotencyKey;
		expect(DomainCommandSchema.safeParse(missing).success).toBe(false);
	});

	// RPH-CON-004 — "a COMMAND containing a non-RFC-3339 timestamp fails schema validation". Added 2026-08-04:
	// the only assertion carrying this id tested `createdAt` on the OBJECT envelope, so the command half had
	// NEVER been asserted. The schema does enforce it; nothing had asked.
	//
	// This does NOT re-certify the rule. `RPH-CON-004` is PARTIAL in the manifest and stays PARTIAL: the ratified
	// statement is about a command reaching the ENGINE, and this is the contract in isolation. What it removes is
	// the situation where a rule's own id pointed exclusively at a different subject.
	it('RPH-CON-004: rejects a command whose issuedAt is not RFC-3339', () => {
		expect(DomainCommandSchema.safeParse({ ...baseCommand, issuedAt: '2026-07-10' }).success).toBe(
			false
		);
		expect(DomainCommandSchema.safeParse({ ...baseCommand, issuedAt: 'not-a-date' }).success).toBe(
			false
		);
		// The control: the SAME command with a well-formed timestamp is accepted, so the refusals above are
		// attributable to the timestamp and not to some other field of the fixture.
		expect(DomainCommandSchema.safeParse(baseCommand).success).toBe(true);
	});

	it('accepts a well-formed event', () => {
		expect(
			DomainEventSchema.safeParse({
				eventId: 'evt-1',
				eventType: 'IntentCaptured',
				eventSchemaVersion: 1,
				aggregateType: 'INTENT',
				aggregateId: 'int_' + ULID,
				aggregateRevision: 1,
				occurredAt: '2026-07-10T22:00:00Z',
				recordedAt: '2026-07-10T22:00:01Z',
				actor,
				correlationId: 'corr-1',
				payload: {}
			}).success
		).toBe(true);
	});

	it('accepts a CommandResult and validates the embedded error shape', () => {
		expect(
			CommandResultSchema.safeParse({
				commandId: 'cmd-1',
				status: 'ACCEPTED',
				producedEventIds: ['evt-1']
			}).success
		).toBe(true);
		expect(
			CommandResultSchema.safeParse({
				commandId: 'cmd-1',
				status: 'CONFLICT',
				producedEventIds: [],
				error: {
					code: 'RPH_REVISION_CONFLICT',
					category: 'CONCURRENCY',
					message: 'stale',
					retryable: false,
					targetObjectIds: ['int_' + ULID],
					correlationId: 'corr-1'
				}
			}).success
		).toBe(true);
	});
});
