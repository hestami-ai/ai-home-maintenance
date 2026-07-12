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

describe('ObjectEnvelope (RPH-CON-001/002/004)', () => {
	it('RPH-CON-001: accepts a valid envelope', () => {
		expect(ObjectEnvelopeSchema.safeParse(validEnvelope()).success).toBe(true);
	});

	it('RPH-CON-002: rejects an undeclared property with RPH_VALIDATION_SCHEMA_FAILED', () => {
		const r = validateAgainst(
			ObjectEnvelopeSchema,
			{ ...validEnvelope(), sneaky: true },
			{ correlationId: 'c1' }
		);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.error.code).toBe('RPH_VALIDATION_SCHEMA_FAILED');
	});

	it('RPH-CON-004: rejects a non-RFC-3339 timestamp', () => {
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
		issuedBy: actor,
		correlationId: 'corr-1',
		idempotencyKey: 'idem-1',
		payload: { title: 'x' }
	};

	it('accepts a well-formed command and allows an optional expectedRevision', () => {
		expect(DomainCommandSchema.safeParse(baseCommand).success).toBe(true);
		expect(DomainCommandSchema.safeParse({ ...baseCommand, expectedRevision: 3 }).success).toBe(
			true
		);
	});

	it('rejects a command missing a required transport field', () => {
		const { idempotencyKey, ...missing } = baseCommand;
		void idempotencyKey;
		expect(DomainCommandSchema.safeParse(missing).success).toBe(false);
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
