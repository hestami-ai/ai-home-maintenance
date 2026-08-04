// REG-F-018 — the contracts and the hash agree about what a number is.
//
// `contentHash` canonicalizes every persisted object state and REJECTS a non-integer: "the domain models
// quantities as integers or strings; a float in hashed content is a modeling smell and is rejected loudly". The
// generated schemas admitted one anyway, so the promise the contract made and the value the store could hold had
// drifted apart — and `ArtifactObjectSchema.byteSize` is where that stopped being theoretical.
//
// THESE ASSERT THE AGREEMENT ITSELF, not just the constraint: for the same value, the schema's verdict and
// `contentHash`'s verdict now match. A test that only checked `.int()` would pass if `contentHash` were later
// loosened, and the pairing is the actual invariant.
//
// WHY THIS IS NOT COVERED BY THE ENGINE'S OWN FLOAT TEST: `command-bus.ts` step 0c hashes the payload BEFORE
// payload validation runs, so at the bus the hashability gate answers first and the schema is never consulted.
// Revert the `.int()` mapping and no engine test reddens. This file is where that revert is caught.
import { describe, expect, it } from 'vitest';
import { contentHash } from './hash.js';
import { RecordArtifactPayloadSchema } from './messages.js';
import { ArtifactObjectSchema } from './objects.js';

const ACTOR = { actorId: 'u1', actorType: 'HUMAN' as const, displayName: 'A' };

// Composed from `objectEnvelopeShape` field by field rather than approximated — the first draft of this fixture
// omitted `updatedBy` / `provenance` / `tags` / `extensions` and put `originType` at the top level, and the
// CONTROL below is what caught it. A fixture that fails validation for the WRONG reason makes every refusal test
// above it pass vacuously.
const artifactState = (byteSize: number) => ({
	id: 'art_01ARZ3NDEKTSV4RRFFQ69J8003',
	objectType: 'ARTIFACT' as const,
	schemaVersion: 1,
	semanticVersion: 1,
	revision: 0,
	lifecycleStatus: 'AVAILABLE',
	createdAt: '2026-08-04T00:00:00Z',
	createdBy: ACTOR,
	updatedAt: '2026-08-04T00:00:00Z',
	updatedBy: ACTOR,
	provenance: { originType: 'HUMAN_DECISION', sourceObjectIds: [], sourceEventIds: [] },
	tags: [],
	extensions: [],
	artifactType: 'DOCUMENT',
	mediaType: 'text/plain',
	storageProvider: 'local',
	storageKey: 'k',
	contentHash: 'sha256:abc',
	byteSize,
	securityClassification: 'INTERNAL',
	retentionClass: 'STANDARD',
	status: 'AVAILABLE'
});

const artifactPayload = (byteSize: number) => ({
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
});

describe('REG-F-018: a schema admits a number exactly when the hash can take it', () => {
	it('the OBJECT schema refuses a fractional byteSize — the field that crashed dispatch', () => {
		const parsed = ArtifactObjectSchema.safeParse(artifactState(1.5));
		expect(parsed.success, 'ArtifactObjectSchema.byteSize was a bare z.number()').toBe(false);
		expect(
			parsed.error?.issues.some((i) => i.path.join('.') === 'byteSize'),
			`the refusal names the field: ${JSON.stringify(parsed.error?.issues)}`
		).toBe(true);
		// The agreement: what the schema now refuses is exactly what the hash could never take.
		expect(() => contentHash(artifactState(1.5))).toThrow(/Non-integer/);
	});

	it('the PAYLOAD schema refuses it too, so it is caught before it can reach state', () => {
		expect(RecordArtifactPayloadSchema.safeParse(artifactPayload(1.5)).success).toBe(false);
	});

	// CONTROL — the integer form is accepted by BOTH, so the tests above are not passing because the fixture is
	// simply invalid. Without this, `.int()` could have been `z.never()` and everything above would still pass.
	it('CONTROL: the integer form is accepted by the schema AND hashable', () => {
		const parsed = ArtifactObjectSchema.safeParse(artifactState(1024));
		expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
		expect(RecordArtifactPayloadSchema.safeParse(artifactPayload(1024)).success).toBe(true);
		expect(contentHash(artifactState(1024))).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	// The version fields are the ones with a NAMED constrained schema (`SemanticVersionSchema`) that the generated
	// surface never used. They were shielded only by exact-equality checks in handlers — a reason unrelated to
	// hashability, which is why they needed the constraint rather than the accident.
	it('a fractional semanticVersion is refused by the object envelope', () => {
		expect(ArtifactObjectSchema.safeParse({ ...artifactState(1024), semanticVersion: 1.5 }).success).toBe(
			false
		);
	});
});
