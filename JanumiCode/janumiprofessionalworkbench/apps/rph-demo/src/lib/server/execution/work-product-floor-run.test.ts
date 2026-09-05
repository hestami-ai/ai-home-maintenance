// JAN-WPREVIEW — the floor run over a work product, driven against a real engine.
//
// ⭑ THIS TEST EXISTS BECAUSE THE E2E COULD NOT TELL ME WHY. The browser spec showed the review coming back
// INCONCLUSIVE and server stdout is not surfaced on an assertion failure, so three rounds of probing learned
// nothing. The floor run is an in-process function; driving it in-process is where the answer was.
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
	process.env.RPH_DEMO_MODE = 'test';
});
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { createEngine, seedFloorPolicies } from '@janumipwb/rph-engine';
import { SqliteStorageAdapter } from '@janumipwb/rph-persistence';
import { ontology } from '@janumipwb/rph-product-realization-pwa';
import { SESSION_CREDENTIAL, standaloneAuthenticator } from '../identity.js';
import { reasoningReviewCriteria } from '../floor.js';
import { runWorkProductFloor } from './work-product-floor.js';

const TS = '2026-09-05T00:00:00Z';
const ANSWER = '{"workProduct":"Assessment complete.","basis":"the northern route"}';

function harness() {
	let n = 0;
	const store = new SqliteStorageAdapter({ now: () => TS });
	const host = createEngine({
		authenticate: standaloneAuthenticator(),
		store,
		now: () => TS,
		newEventId: () => `e${++n}`,
		ontology
	});
	const session = host.as(SESSION_CREDENTIAL);
	seedFloorPolicies(session);
	const artifacts = createInMemoryArtifactStore();
	return { session, artifacts, newId: (p: string) => `${p}_01ARZ3NDEKTSV4RRFFQ69G5${String(++n).padStart(3, '0')}` };
}

describe('JAN-WPREVIEW — the floor over a work product', () => {
	it('⭑ a substantive work product SATISFIES the floor', async () => {
		const { session, artifacts, newId } = harness();
		const ref = await artifacts.put({
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
			contentDurability: artifacts.durability
		};
		const out = await runWorkProductFloor(
			{
				artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5A01',
				artifact: { semanticVersion: 1, provenance: {}, producingPwuId: 'pwu_1' },
				exchange: {
					exchangeId: 'mex_1',
					materializedInputRef: stored,
					rawOutputBeforeCoercionRef: stored,
					answerSpanRef: stored,
					volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
				} as never,
				answer: ANSWER,
				producingPrompt: 'Assess the northern delivery route.',
				producerModelId: 'test-model'
			},
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);
		expect(out.satisfied, `not satisfied: ${JSON.stringify(out.observations)}`).toBe(true);
	});

	it('⛔ and an EMPTY work product does NOT satisfy it — the refusal path, driven', async () => {
		// ⭑ THE COUNTERPART TO THE CASE ABOVE, and it is what keeps "satisfied" meaningful. Without a driven
		// refusal, the passing case cannot be told apart from a floor that satisfies anything — the rubber
		// stamp the offline reviewer's own docblock records it once was.
		//
		// THE MUTANT: teach the work-product arm to pass any parseable content. The case above still passes and
		// this one flips — exactly the pair that separates a review from a parse.
		const { session, artifacts, newId } = harness();
		const EMPTY = '{"workProduct":"","notes":[]}';
		const ref = await artifacts.put({
			tenantPrefix: 'tnt-t',
			bytes: EMPTY,
			mediaType: 'text/plain',
			purgeability: 'RETAINED_BY_PARTICIPATION'
		});
		const stored = {
			status: 'STORED' as const,
			storageKey: ref.storageKey,
			contentHash: ref.contentHash,
			byteSize: ref.byteSize,
			purgeability: 'RETAINED_BY_PARTICIPATION' as const,
			contentDurability: artifacts.durability
		};
		const out = await runWorkProductFloor(
			{
				artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5A02',
				artifact: { semanticVersion: 1, provenance: {}, producingPwuId: 'pwu_1' },
				exchange: {
					exchangeId: 'mex_2',
					materializedInputRef: stored,
					rawOutputBeforeCoercionRef: stored,
					answerSpanRef: stored,
					volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
				} as never,
				answer: EMPTY,
				producingPrompt: 'Assess the northern delivery route.',
				producerModelId: 'test-model'
			},
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);
		expect(out.satisfied, 'a work product that says nothing must not be assured').toBe(false);
		expect(out.observations.map((o) => o.code)).toContain('RR-04-no-proxy-satisfaction');
	});
});
