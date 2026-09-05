// JAN-EXECREVIEW XA-01 — the facts the floor judges a work product on.
//
// ⭑ THE VALIDATORS DO NOT INSPECT THE SUBJECT (`REG-F-354`), so these facts ARE the assessment. A fact that
// is asserted rather than derived is a floor step that certifies itself — the defect `floor.ts` records
// against its own history, where five literal `true`s made identity/provenance unfailable.
import { describe, expect, it } from 'vitest';
import { createInMemoryArtifactStore, type ArtifactStore } from '@janumipwb/rph-ports';
import { workProductFloorFacts, type WorkProductSubject } from './work-product-floor.js';

const ANSWER = '{"finding":"the route is viable"}';

async function subjectFor(
	store: ArtifactStore,
	over: Partial<WorkProductSubject> = {}
): Promise<WorkProductSubject> {
	const ref = await store.put({
		tenantPrefix: 'tnt-t',
		bytes: ANSWER,
		mediaType: 'text/plain',
		purgeability: 'RETAINED_BY_PARTICIPATION'
	});
	const stored = {
		status: 'STORED' as const,
		storageKey: ref.storageKey,
		contentHash: ref.contentHash,
		byteSize: ref.byteSize,
		purgeability: 'RETAINED_BY_PARTICIPATION' as const,
		contentDurability: store.durability
	};
	return {
		artifactId: 'art_1',
		artifact: { semanticVersion: 1, provenance: { originType: 'MODEL_GENERATION' }, producingPwuId: 'pwu_1' },
		exchange: {
			exchangeId: 'mex_1',
			materializedInputRef: { status: 'PENDING_CONTENT_PLANE', reason: 'not under test' },
			rawOutputBeforeCoercionRef: stored,
			answerSpanRef: stored,
			volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none arrived' }
		},
		answer: ANSWER,
		producingPrompt: 'Assess the route.',
		producerModelId: 'test-judge-model',
		...over
	};
}

describe('JAN-EXECREVIEW — the work product’s floor facts are DERIVED', () => {
	it('a well-formed work product yields all-true', async () => {
		// ⭑ THE CONTROL, AND IT COMES FIRST BECAUSE WITHOUT IT EVERY REFUSAL BELOW IS SATISFIABLE BY "always
		// false" — which is how a floor becomes unpassable rather than rigorous, and is the mirror of the
		// self-certifying defect this file's header names.
		const store = createInMemoryArtifactStore();
		const facts = await workProductFloorFacts(await subjectFor(store), store);
		expect(facts.schemaInvariant).toEqual({ schemaValid: true, invariantViolations: [] });
		expect(facts.identityProvenance).toEqual({
			hasStableId: true,
			hasSemanticVersion: true,
			hasProvenance: true,
			hasProducer: true,
			traceComplete: true
		});
	});

	it('⛔ an UNPARSEABLE work product fails schemaValid, and the code says PARSEABLE not CONFORMANT', async () => {
		// ⚠ THE NAME OF THE VIOLATION IS THE POINT. `outputContract` is free text and NOT machine-checkable, so
		// "conforms to its contract" cannot be decided. What is decided is that the answer is locatable.
		//
		// THE MUTANT: report `WORK_PRODUCT_VIOLATES_OUTPUT_CONTRACT`. Identical behaviour, and the record now
		// claims a measurement nobody made — the fabricated-measurement defect, wearing a more useful name.
		const store = createInMemoryArtifactStore();
		const facts = await workProductFloorFacts(
			await subjectFor(store, { answer: 'The route is viable, broadly speaking.' }),
			store
		);
		expect(facts.schemaInvariant.schemaValid).toBe(false);
		expect(facts.schemaInvariant.invariantViolations).toEqual(['WORK_PRODUCT_NOT_PARSEABLE']);
		expect(
			facts.schemaInvariant.invariantViolations.join(),
			'the code must not claim contract conformance'
		).not.toMatch(/CONTRACT|CONFORM/i);
	});

	it('⭑ traceComplete is MEASURED against the store, not asserted', async () => {
		// THE MUTANT: `traceComplete: true`. Every other fact still passes and the floor certifies a trace
		// nobody followed — five literal `true`s, one layer over.
		//
		// The arrangement: the record names a key the store does not hold. `verifyExchangeContent` re-hashes and
		// reports UNRESOLVABLE, so `intact` is false.
		const store = createInMemoryArtifactStore();
		const base = await subjectFor(store);
		const broken: WorkProductSubject = {
			...base,
			exchange: {
				...base.exchange,
				answerSpanRef: {
					...(base.exchange.answerSpanRef as unknown as Record<string, unknown>),
					storageKey: 'tnt-t/RETAINED_BY_PARTICIPATION/never-written'
				}
			} as WorkProductSubject['exchange']
		};
		const facts = await workProductFloorFacts(broken, store);
		expect(facts.identityProvenance.traceComplete).toBe(false);
	});

	it('⛔ hasProducer needs the MODEL, not only the work unit', async () => {
		// `producingPwuId` says which work unit; only the exchange says WHO made it. THE MUTANT: require just
		// the PWU id. A work product then passes identity/provenance without naming any producer at all — and
		// `REG-F-352` records that naming the operator instead would be a fiction.
		const store = createInMemoryArtifactStore();
		const facts = await workProductFloorFacts(
			await subjectFor(store, { producerModelId: '' }),
			store
		);
		expect(facts.identityProvenance.hasProducer).toBe(false);
	});

	it('⛔ and hasProducer needs the work unit too, so the CONVERSE mutant is also caught', async () => {
		// Without this, "require both" could not be told apart from "require only the model".
		const store = createInMemoryArtifactStore();
		const base = await subjectFor(store);
		const facts = await workProductFloorFacts(
			{ ...base, artifact: { ...base.artifact, producingPwuId: undefined } },
			store
		);
		expect(facts.identityProvenance.hasProducer).toBe(false);
	});
});
