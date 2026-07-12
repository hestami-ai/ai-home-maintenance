// M1 fidelity: the generated object schemas must (a) cover all 17 canonical object types and (b) expose
// exactly the shared envelope fields + the ratified type-specific fields for each. This binds objects.ts
// to the grounded field extraction (vocab/m1-object-fields.json) and fails loudly on drift.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { objectEnvelopeShape } from './envelopes.js';
import { mintId } from './ids.js';
import { IntentObjectSchema, OBJECT_SCHEMAS } from './objects.js';

const spec = JSON.parse(
	readFileSync(
		join(dirname(fileURLToPath(import.meta.url)), '..', 'vocab', 'm1-object-fields.json'),
		'utf8'
	)
) as { objects: { objectType: string; tsName: string; fields: { field: string }[] }[] };

const envelopeKeys = Object.keys(objectEnvelopeShape);
const registry = OBJECT_SCHEMAS as unknown as Record<
	string,
	{ schema: { shape: Record<string, unknown> }; tsName: string }
>;

describe('M1 object schemas', () => {
	it('registers all 17 canonical Professional Work Object types', () => {
		expect(Object.keys(registry).sort()).toEqual(spec.objects.map((o) => o.objectType).sort());
	});

	it.each(spec.objects.map((o) => [o.objectType, o.fields.map((f) => f.field)] as const))(
		'%s exposes exactly the envelope + ratified type-specific fields',
		(objectType, fields) => {
			const shape = registry[objectType]!.schema.shape;
			const expected = [...new Set([...envelopeKeys, ...fields])].sort();
			expect(Object.keys(shape).sort()).toEqual(expected);
		}
	);
});

describe('M1 representative validation', () => {
	const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
	const actor = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
	const envelope = {
		id: mintId('INTENT', () => ULID),
		objectType: 'INTENT',
		schemaVersion: 1,
		semanticVersion: 1,
		revision: 0,
		lifecycleStatus: 'RAW',
		createdAt: '2026-07-10T00:00:00Z',
		createdBy: actor,
		updatedAt: '2026-07-10T00:00:00Z',
		updatedBy: actor,
		provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] },
		tags: [],
		extensions: []
	};
	const intent = {
		...envelope,
		originatingExpression: 'Build a field service app',
		formalizedObjective: 'A SaaS for field service management',
		desiredOutcomes: [],
		successConditions: [],
		nonGoals: [],
		ambiguityIds: [],
		constraintIds: [],
		stakeholderIds: [],
		intentStatus: 'RAW'
	};

	it('validates a representative Intent object', () => {
		expect(IntentObjectSchema.safeParse(intent).success).toBe(true);
	});

	it('rejects an unknown property (RPH-CON-002 for objects)', () => {
		expect(IntentObjectSchema.safeParse({ ...intent, sneaky: 1 }).success).toBe(false);
	});

	it('rejects an invalid enum value in a type-specific field', () => {
		expect(IntentObjectSchema.safeParse({ ...intent, intentStatus: 'NONSENSE' }).success).toBe(
			false
		);
	});

	it('rejects a missing required type-specific field', () => {
		// originatingExpression is required; formalizedObjective is (correctly) optional until FORMALIZED.
		const { originatingExpression, ...missing } = intent;
		void originatingExpression;
		expect(IntentObjectSchema.safeParse(missing).success).toBe(false);
	});

	it('treats formalizedObjective as optional (RAW intents are not yet formalized)', () => {
		const { formalizedObjective, ...raw } = intent;
		void formalizedObjective;
		expect(IntentObjectSchema.safeParse(raw).success).toBe(true);
	});
});
