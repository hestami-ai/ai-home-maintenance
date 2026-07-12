// Fidelity: the generated JSON Schema must accept/reject the same values as its Zod source, and the
// committed schemas/ artifacts must not have drifted from the source (single-source generation, docs D4).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ObjectEnvelopeSchema } from './envelopes.js';
import { mintId } from './ids.js';
import { jsonSchemaFor, schemaId } from './validate.js';

// ajv/dist/2020 is CJS (`export =`); under NodeNext the default import is the class at runtime but typed
// as the module namespace. Cast to a minimal constructor type (no `any`) — this is a test-only interop shim.
type AjvCtor = new (opts?: { strict?: boolean }) => {
	compile: (schema: unknown) => (data: unknown) => boolean;
};
const Ajv2020 = Ajv2020Module as unknown as AjvCtor;

const schemasDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const actor = { actorId: 'u1', actorType: 'HUMAN', displayName: 'A' };
const validEnvelope = (): Record<string, unknown> => ({
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
	provenance: { originType: 'USER_INPUT', sourceObjectIds: [], sourceEventIds: [] },
	tags: [],
	extensions: []
});

describe('JSON Schema fidelity (single Zod source -> JSON Schema)', () => {
	const committed = JSON.parse(
		readFileSync(join(schemasDir, 'objects', 'ObjectEnvelope.json'), 'utf8')
	);

	it('committed ObjectEnvelope.json is not drifted from the Zod source', () => {
		expect(committed).toEqual(
			jsonSchemaFor(ObjectEnvelopeSchema, schemaId('object', 'ObjectEnvelope'))
		);
	});

	const ajv = new Ajv2020({ strict: false });
	const validate = ajv.compile(committed);

	it('ajv ACCEPTS what Zod accepts (valid envelope)', () => {
		expect(ObjectEnvelopeSchema.safeParse(validEnvelope()).success).toBe(true);
		expect(validate(validEnvelope())).toBe(true);
	});

	it('ajv REJECTS what Zod rejects (unknown property)', () => {
		const bad = { ...validEnvelope(), sneaky: 1 };
		expect(ObjectEnvelopeSchema.safeParse(bad).success).toBe(false);
		expect(validate(bad)).toBe(false);
	});

	it('ajv REJECTS what Zod rejects (bad timestamp)', () => {
		const bad = { ...validEnvelope(), createdAt: '2026-07-10' };
		expect(ObjectEnvelopeSchema.safeParse(bad).success).toBe(false);
		expect(validate(bad)).toBe(false);
	});
});
