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
import {
	clearingReviewerFor,
	withLiveReviewerSeam
} from '../assurance/clearing-reviewer.testing.js';
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
		const out = await withLiveReviewerSeam(async () =>
			runWorkProductFloor(
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
				producerProviderId: 'test-provider',
				producerModelId: 'test-model'
			},
			session,
			{
				artifacts,
				now: () => TS,
				newId,
				criteria: reasoningReviewCriteria(session),
				// ⭐ `JAN-ORPHANED` `OR-02` — a CLEARING reviewer, framed for a work product.
				// ⛔ ITS PARTNER BELOW STAYS ON THE DETERMINISTIC CHECKER, DELIBERATELY: that half asserts the
				// EMPTY product is refused WITH an `RR-04` observation, which is the checker's own judgement and
				// must keep being tested. ⚠ The two halves therefore run on different instruments, and the
				// positive half no longer proves `judgeWorkProduct` ACCEPTS anything —
				// `work-product-review.test.ts`'s own CONTROL is that guard, and it is green.
				print: clearingReviewerFor('The WORK PRODUCT to review', reasoningReviewCriteria(session))
			}
			)
		);
		expect(out.satisfied, `not satisfied: ${JSON.stringify(out.observations)}`).toBe(true);
	});

	// ⭐⭐ `JAN-EXEC` P7-6 B7 — `REG-F-433`'s JOIN KEY ON THE EXECUTION PLANE (`DESIGN-the-stopped-unit-recovery.md` RD10, as
	// corrected). ⛔ THE GAP THE ENTRY RECORDS HERE TOO: the assessments were correlated by `runLabel:subjectId` — the same for
	// every run on the subject — and the exchanges took a separately minted `runToken` and `model-exchange:<subject>`. So a
	// re-review (P7-6R's `rerunReview`, which runs this floor again over the same work product) could not be told from the
	// review it re-ran: the run report reported every re-reviewed subject not pairable. ONE token per run now does all three.
	it('⛔ REG-F-433 — ONE token per floor run: two runs over one work product, each run’s assessments correlated by the runToken its own reviewer calls carry', async () => {
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
		const artifactId = 'art_01ARZ3NDEKTSV4RRFFQ69G5A03';
		for (let run = 0; run < 2; run += 1)
			await withLiveReviewerSeam(async () =>
				runWorkProductFloor(
					{
						artifactId,
						artifact: { semanticVersion: 1, provenance: {}, producingPwuId: 'pwu_1' },
						exchange: {
							exchangeId: 'mex_3',
							materializedInputRef: stored,
							rawOutputBeforeCoercionRef: stored,
							answerSpanRef: stored,
							volunteeredReasoningRef: { status: 'PENDING_CONTENT_PLANE', reason: 'none' }
						} as never,
						answer: ANSWER,
						producingPrompt: 'Assess the northern delivery route.',
						producerProviderId: 'test-provider',
						producerModelId: 'test-model'
					},
					session,
					{
						artifacts,
						now: () => TS,
						newId,
						criteria: reasoningReviewCriteria(session),
						print: clearingReviewerFor('The WORK PRODUCT to review', reasoningReviewCriteria(session))
					}
				)
			);
		const events = session.readAllEvents();
		const correlationsOf = (type: string) => [
			...new Set(events.filter((e) => e.aggregateType === type).map((e) => e.correlationId))
		];
		const tokens = [
			...new Set(
				events
					.filter((e) => e.aggregateType === 'MODEL_EXCHANGE')
					.map((e) => (e.payload as { runToken?: unknown }).runToken)
			)
		];
		expect(tokens, 'arrangement: two floor runs, each with its reviewer’s calls').toHaveLength(2);
		expect(correlationsOf('ASSURANCE_ASSESSMENT'), 'the assessments are not correlated by their run’s token').toEqual(tokens);
		expect(correlationsOf('MODEL_EXCHANGE'), 'the exchanges are not correlated by their run’s token').toEqual(tokens);
		// ⭑ LOSSLESS: the token keeps what the correlation said before it — the run's label and its subject.
		for (const t of tokens) expect(String(t)).toMatch(new RegExp(`^work-product-floor:${artifactId}:`));
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
				producerProviderId: 'test-provider',
				producerModelId: 'test-model'
			},
			session,
			{ artifacts, now: () => TS, newId, criteria: reasoningReviewCriteria(session) }
		);
		expect(out.satisfied, 'a work product that says nothing must not be assured').toBe(false);
		expect(out.observations.map((o) => o.code)).toContain('RR-04-no-proxy-satisfaction');
	});
});

describe('JAN-TOOLSUITE TS-08 — independence is DECIDED on the recorded producer identity', () => {
	// ⭑⭑ THIS IS THE PAIR THE WHOLE SLICE EXISTS FOR, and it is deterministic because the offline reviewer
	// declares a fixed identity (`modelId: 'mock-reasoning-review'`). Before `JAN-TOOLSUITE` the producer was
	// labelled with `resolveJudgeModel()` — the REVIEWER's model — so the two sides were the same string BY
	// CONSTRUCTION and only the refusing half of this pair was reachable.
	//
	// ⚠ A BROWSER E2E CANNOT PROVE THIS. Under `RPH_DEMO_MODE=test` both the executor and the judge resolve to
	// the same placeholder, so the two cases below are indistinguishable through the UI. Driving the floor
	// in-process is where the distinction lives — the same lesson this file's header already records.

	async function runWith(producerModelId: string) {
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
		return withLiveReviewerSeam(async () =>
			runWorkProductFloor(
			{
				artifactId: 'art_01ARZ3NDEKTSV4RRFFQ69G5B01',
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
				producerProviderId: 'openai-codex',
				producerModelId
			},
			session,
			{
				artifacts,
				now: () => TS,
				newId,
				criteria: reasoningReviewCriteria(session),
				print: clearingReviewerFor('The WORK PRODUCT to review', reasoningReviewCriteria(session))
			}
			)
		);
	}

	it('⭑ a producer whose model DIFFERS from the reviewer is assured', async () => {
		// Pi on `gpt-5.4-mini` producing, the reviewer on its own model. This is the arrangement the sponsor
		// asked for, reduced to the one fact `checkIndependence` actually reads.
		const out = await runWith('gpt-5.4-mini');
		expect(out.satisfied, `not satisfied: ${JSON.stringify(out.observations)}`).toBe(true);
	});

	it('⛔ and the SAME model on both sides is REFUSED — which is the check working, not a fault', async () => {
		// THE MUTANT: drop the producer identity back to the judge's model (what the call site used to pass).
		// The case above then flips to this one, and every model-executed step becomes unassurable.
		//
		// ⚠ THE ASSERTION IS ON THE OBSERVATION, NOT MERELY ON `satisfied`. An empty work product is ALSO not
		// satisfied, so `satisfied === false` alone cannot tell a non-independent review apart from a rejected
		// one — an arrangement that trips two guards proves neither.
		// ⭐ `JAN-ORPHANED`: `'test-judge-model'`, NOT `'mock-reasoning-review'`. The pair turns on producer and
		// reviewer carrying the SAME model id, and under the live reviewer seam the reviewer's id is the
		// configured judge model. ⛔ Moving only the passing half would have broken this one — the identity
		// literal has to move with it, which is why both halves are on the seam.
		const out = await runWith('test-judge-model');
		expect(out.satisfied).toBe(false);
		expect(JSON.stringify(out.observations)).toMatch(/INDEPENDENCE/i);
	});
});
