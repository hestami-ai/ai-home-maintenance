// JAN-EXECREVIEW XA-01 — the facts the floor judges a work product on.
//
// ⭑ THE VALIDATORS DO NOT INSPECT THE SUBJECT (`REG-F-354`), so these facts ARE the assessment. A fact that
// is asserted rather than derived is a floor step that certifies itself — the defect `floor.ts` records
// against its own history, where five literal `true`s made identity/provenance unfailable.
import { describe, expect, it } from 'vitest';
import { schemaInvariantValidator, type AssuranceSubject } from '@janumipwb/rph-assurance';
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
		// ⚠ REQUIRED: `differs()` fails closed on absence, so a provider-based rung with this missing is a
		// permanent block rather than a strict check.
		producerProviderId: 'test-provider',
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
		// "conforms to its contract" cannot be decided. What is decided is that the answer is ~~locatable~~ located and
		// that the located span parses (`REG-F-557` AS2; the describe block at the end of this file).
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

// ⭐ `REG-F-557` — THE SCHEMA FLOOR, DRIVEN THROUGH ITS OWN VALIDATOR (`DESIGN-the-answer-span.md` §3, predicted reds 1
// and 3). P2: six of seven work products were ONE JSON object whose document held a code block, and `floor.schema-invariant`
// refused each as `SCHEMA_INVALID`, stopping three of the four phases. The first measured run: a fenced TypeScript type
// held a brace pair, and the floor passed that fragment. Each fixture is asked of the floor exactly as production asks
// it: these facts, then the deterministic validator that judges them.
describe('REG-F-557 — the schema floor asks whether the work product PARSES (AS1, AS2)', () => {
	const SUBJECT: AssuranceSubject = {
		subjectId: 'art_1',
		objectType: 'ARTIFACT',
		semanticVersion: 1,
		isAiProduced: true,
		producer: {
			agentId: 'execution.model-invocation:art_1',
			modelId: 'test-judge-model',
			providerId: 'test-provider'
		}
	};
	const schemaFloor = async (answer: string) => {
		const store = createInMemoryArtifactStore();
		const facts = await workProductFloorFacts(await subjectFor(store, { answer }), store);
		return schemaInvariantValidator(SUBJECT, facts.schemaInvariant);
	};

	it('⭐ a P2-shaped work product — one JSON object whose document holds a fenced block — is SATISFIED', async () => {
		// Built with JSON.stringify, as P2's were written: the fence is INSIDE a string. At HEAD the reader took that
		// fence's contents as the answer, found no brace pair in them, and the floor refused valid work.
		const P2_SHAPED = JSON.stringify({
			documents: [
				{ path: 'docs/requirements.md', text: '# Req\n\n```text\nnode bin/x.js [options]\n```\n' }
			]
		});
		const r = await schemaFloor(P2_SHAPED);
		expect(r.dispositionRecommendation, JSON.stringify(r.observations)).toBe('SATISFIED');
	});

	it('⛔ markdown prose holding a fenced brace pair is REJECTED: a locatable fragment is not a parse (AS2)', async () => {
		// THE MUTANT: `schemaValid` is the span's `located` alone, as it was - the brace pair in a TypeScript type is
		// "locatable", and the floor certifies a fragment that is not JSON.
		const PROSE = '# Design\n\nThe CLI reads its flags into\n\n```ts\n{ help: boolean }\n```\n\nand prints usage.';
		const r = await schemaFloor(PROSE);
		expect(r.dispositionRecommendation).toBe('REJECTED');
		expect(r.observations.map((o) => o.code)).toEqual(['SCHEMA_INVALID', 'WORK_PRODUCT_NOT_PARSEABLE']);
	});

	it('CONTROL — a work product wrapped in a ```json fence is still SATISFIED: it is the LOCATED span that parses', async () => {
		// Without this the refusal above is satisfiable by parsing the WHOLE answer, which would refuse every fenced
		// work product - the false refusal back, by another route. THE MUTANT: parse `subject.answer`, not the span.
		const r = await schemaFloor('```json\n{"finding":"the route is viable"}\n```');
		expect(r.dispositionRecommendation, JSON.stringify(r.observations)).toBe('SATISFIED');
	});
});
