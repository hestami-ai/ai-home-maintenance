// Fidelity: the generated JSON Schema must accept/reject the same values as its Zod source, and the
// committed schemas/ artifacts must not have drifted from the source (single-source generation, docs D4).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emittedSchemas } from './gen/schema-manifest.js';
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

	// ── N-14: THIS SUITE CHECKED ONE ARTIFACT OUT OF 107 WHILE CLAIMING TO CHECK THEM ALL ──────────────────────
	//
	// The header above has always said "the committed schemas/ artifacts must not have drifted from the source".
	// Exactly one file was read. A missed regeneration of any other artifact was invisible to the test written to
	// catch precisely that — the same false-record shape as N-13, in the suite meant to prevent it.
	//
	// The enumeration is SHARED with the emitter (`gen/schema-manifest.ts`) rather than re-listed here: a list
	// maintained in two places is maintained in one. `emit.ts` itself cannot be imported — it rewrites `schemas/`
	// at module scope, so reading its list would regenerate the files under test and the comparison would pass by
	// construction.
	describe('EVERY committed artifact, not just one', () => {
		const emitted = emittedSchemas();
		const pathOf = (s: { dir: string; name: string }) =>
			join(schemasDir, s.dir, `${s.name}.json`);

		it('emits a plausible number of schemas, so the per-file checks cannot pass vacuously', () => {
			// The floor the two assertions below rest on: an enumeration that returned nothing would satisfy
			// "every schema matches" and "no file is stale" trivially — N-14's own shape, one level up.
			expect(emitted.length).toBeGreaterThan(100);
		});

		it.each(emittedSchemas().map((s) => [`${s.dir}/${s.name}.json`, s] as const))(
			'%s is not drifted from the Zod source',
			(_label, s) => {
				expect(existsSync(pathOf(s)), `${pathOf(s)} is missing — run \`bun run gen\``).toBe(true);
				expect(JSON.parse(readFileSync(pathOf(s), 'utf8'))).toEqual(s.json);
			}
		);

		it('leaves no STALE artifact behind — a deleted schema must not keep its file', () => {
			// The direction a per-file loop cannot see: a schema removed from the source stops being emitted, and
			// its committed file simply stays, describing a contract that no longer exists. Callers generating
			// clients from `schemas/` would keep honouring it.
			const expected = new Set(emitted.map((s) => `${s.dir}/${s.name}.json`));
			const actual = (['objects', 'enums'] as const).flatMap((dir) =>
				readdirSync(join(schemasDir, dir))
					.filter((f) => f.endsWith('.json'))
					.map((f) => `${dir}/${f}`)
			);
			expect(actual.filter((f) => !expected.has(f))).toEqual([]);
		});
	});

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
