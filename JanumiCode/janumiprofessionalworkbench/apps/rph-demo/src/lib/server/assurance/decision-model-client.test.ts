// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51's CLIENT (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.3, revision 9;
// `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z2 predicted reds 4, 5 and 6) — the product's source of a review's potential
// indications: pplx-decider over Ollama, one cold request per check and per statement, exactly as step 1 measured it
// (`step1_single.py`; `d46-facts-verbatim.md` V11, V12), held to a configured identity, and recorded request by request.
//
// ⛔ PREDICTED RED 4 — COLD ONLY. Before a review's first request, the model found loaded is unloaded by step 1's own unload
// request; before EVERY request, `/api/ps` is read until the model is absent (step 1's `wait_gone`), and a model still listed after
// 120 s refuses the review; then the request's exact bytes, `content-type: application/json`, `keep_alive` 0.
// ⛔ PREDICTED RED 5 — REFUSAL BEFORE A REVIEWER CALL, one test each: no server; no model; another digest; another server version;
// an HTTP error, a 413 among them; a request past 120 s; a review's requests past 1,200 s together; a score missing; a score
// extra. Each is recorded `VALIDATOR_EXECUTION_FAILED` with its reason, and no reviewer call is made.
// ⛔ PREDICTED RED 6 — DURABLE CUSTODY. Every request is a try of its own on the record (PER-9, PER-11): its resolved identity
// (provider, model, digest, server version), its exact body as the materialized input, the response before any reading, the
// parse outcome, the other loaded models, its times — in the same store and sink as the reviewer's tries; the review's first
// reviewer exchange points at the set.
// ⛔ No model: a local stub server answers for Ollama (`decision-model-stub.testing.ts`), on the loopback only.
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { createInMemoryArtifactStore } from '@janumipwb/rph-ports';
import { afterEach, describe, expect, it } from 'vitest';
import { createDecisionModelClient, DECISION_MODEL_BOUNDS, type DecisionModelClientOptions } from './decision-model-client.js';
import { decisionModelBody, DECISION_MODEL_PROVIDER, unloadBody } from './decision-model-request.js';
import {
	scoredAnswer,
	startDecisionModelStub,
	stubScore,
	STUB_DIGEST,
	STUB_MODEL,
	STUB_VERSION,
	type DecisionModelStub,
	type StubOptions
} from './decision-model-stub.testing.js';
import { createExchangeSink } from './exchange-capture.js';
import { toRecordModelExchange } from './exchange-recorder.js';
import {
	createAgyReasoningReviewValidator,
	indicationsRefusedStatement,
	type IndicationRequest,
	type IndicationsSource
} from './reasoning-review-validator.js';
import { workProductReviewInput } from './review-input.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_decision_model',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'producer', modelId: 'producer-model', providerId: 'producer-provider' }
};
const MATERIAL = 'The instruction:\n<<<UNTRUSTED-00>>>\nSummarise the log.\n<<<UNTRUSTED-00>>>\n';
const REQUESTS: readonly IndicationRequest[] = [
	{ kind: 'check', key: 'c00', id: 'RR-01', label: 'The answer follows from the evidence.' },
	{ kind: 'check', key: 'c01', id: 'RR-02', label: 'Nothing is asserted past the evidence’s scope.' },
	{ kind: 'statement', key: 's00', statement: 'summary: The log holds 3 records — all read.' }
];
/** A review the product sends: a work product's answer of two sentences, under the seeded rubric. */
const INPUT: ReasoningReviewInput = workProductReviewInput({
	criteria: SEEDED_REASONING_REVIEW_CRITERIA,
	producingPrompt: 'Summarise the log.',
	answer: '{"summary":"The log holds 3 records. Each was read."}'
});

/** A reply answering every criterion clean, so the review sends no repair: one reviewer call. */
const CLEAN = JSON.stringify({
	findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'absent' })),
	recommendation: 'SATISFIED'
});

const stubs: DecisionModelStub[] = [];
afterEach(async () => {
	for (const s of stubs.splice(0)) await s.close();
});
async function stub(o: StubOptions = {}): Promise<DecisionModelStub> {
	const s = await startDecisionModelStub(o);
	stubs.push(s);
	return s;
}

/** The client as the product configures it, against `server`, with the bounds a test shortens. */
const clientOf = (server: string, o: Partial<DecisionModelClientOptions> = {}): IndicationsSource =>
	createDecisionModelClient({
		server,
		model: STUB_MODEL,
		identity: { digest: '733585a9ebb6', serverVersion: STUB_VERSION },
		// ⭑ The model's leaving held to 2 s: no stub here keeps it listed past a few reads unless a test means it to.
		bounds: { pollMs: 1, unloadMs: 2_000, ...o.bounds },
		clock: () => '2026-11-06T00:00:00.000Z',
		...o
	});

/** What a call came to within the test's own 3 s — or this, which is no answer: so a bound removed fails by an assertion. */
const NO_ANSWER = 'no answer within the test’s own 3 s';
const within = <T>(p: Promise<T>, ms = 3_000): Promise<T | typeof NO_ANSWER> =>
	Promise.race([p, new Promise<typeof NO_ANSWER>((r) => setTimeout(() => r(NO_ANSWER), ms))]);
/** A result's refusal, or `false` for an answer or no answer at all. */
const refusalOf = (r: unknown): string | false =>
	typeof r === 'object' && r !== null && 'refusal' in r ? (r as { refusal: string }).refusal : false;

const questionPosts = (s: DecisionModelStub) =>
	s.requests.filter((r) => r.method === 'POST' && r.path === '/v1/systemone' && !r.body.includes('"state": "unload"'));
const unloadPosts = (s: DecisionModelStub) => s.requests.filter((r) => r.method === 'POST' && r.body.includes('"state": "unload"'));

describe('⛔ PREDICTED RED 4 (Z2; D51) — cold only, as step 1 measured it', () => {
	it('⭐ the identity first; the model found loaded unloaded by step 1’s own request; before every request `/api/ps` read until it is absent; then the exact bytes', async () => {
		const s = await stub({ loadedAtStart: true, lingerPolls: 2 });
		const result = await clientOf(s.url)(REQUESTS, MATERIAL);
		expect('scores' in result ? result.scores : result).toEqual(
			Object.fromEntries(REQUESTS.map((r) => [r.key, stubScore(decisionModelBody(STUB_MODEL, MATERIAL, r))]))
		);
		expect(s.requests.slice(0, 2).map((r) => r.path), 'the served digest and the server version, before any request').toEqual(['/api/tags', '/api/version']);
		expect(unloadPosts(s).map((r) => r.body), 'step 1’s unload request, once, before the first question').toEqual([unloadBody(STUB_MODEL)]);
		expect(s.requests.indexOf(unloadPosts(s)[0]!)).toBeLessThan(s.requests.indexOf(questionPosts(s)[0]!));
		const posts = questionPosts(s);
		expect(posts.map((r) => r.body), 'one question a request, each the exact bytes D51 writes').toEqual(
			REQUESTS.map((r) => decisionModelBody(STUB_MODEL, MATERIAL, r))
		);
		for (const p of posts) {
			expect(p.contentType).toBe('application/json');
			const before = s.requests[s.requests.indexOf(p) - 1]!;
			expect([before.path, before.listed], 'the read just before each request found the model absent').toEqual(['/api/ps', false]);
		}
		// ⭑ step 1 waited out the model each `keep_alive` 0 request left listed: two reads listing it, before every later request.
		expect(s.requests.filter((r) => r.path === '/api/ps' && r.listed).length).toBeGreaterThanOrEqual(2 * REQUESTS.length);
		expect(JSON.parse(posts[0]!.body)).toMatchObject({ model: STUB_MODEL, keep_alive: 0 });
	});

	it('⭐ a review with no question asks nothing: the server is not read at all', async () => {
		const s = await stub({ loadedAtStart: true });
		expect(await clientOf(s.url)([], MATERIAL)).toEqual({ scores: {}, exchanges: [] });
		expect(s.requests).toEqual([]);
	});

	it('⭐ a model not loaded is not unloaded: no request but the questions', async () => {
		const s = await stub();
		await clientOf(s.url)(REQUESTS, MATERIAL);
		expect(unloadPosts(s)).toEqual([]);
		expect(questionPosts(s)).toHaveLength(REQUESTS.length);
	});

	it('⛔ a model still listed past the bound is refused, before any question is asked', async () => {
		const s = await stub({ loadedAtStart: true, neverUnloads: true });
		const result = await within(clientOf(s.url, { bounds: { pollMs: 1, unloadMs: 60 } })(REQUESTS, MATERIAL));
		expect(refusalOf(result)).toMatch(/^the model pplx-decider:27b-q4_K_M was still loaded 0\.06 s after the request to unload it/);
		expect(questionPosts(s)).toEqual([]);
	});

	it('⭐ the other models the server held are recorded with each request, and refuse nothing (the sponsor’s ruling of 2026-11-06, to be registered)', async () => {
		const s = await stub({ others: ['llama3.2:3b'] });
		const result = await clientOf(s.url)(REQUESTS, MATERIAL);
		expect('scores' in result).toBe(true);
		expect(result.exchanges?.map((e) => e.otherModels)).toEqual(REQUESTS.map(() => ['llama3.2:3b']));
	});

	it('⭑ the product’s bounds: 120 s a request, 1,200 s a review’s requests together, 120 s for the model to leave', () => {
		expect(DECISION_MODEL_BOUNDS).toMatchObject({ requestMs: 120_000, reviewMs: 1_200_000, unloadMs: 120_000, pollMs: 500 });
	});
});

/** A review through the product's validator with the client: the reviewer calls it made, and the floor's recorded statement. */
async function reviewed(indications: IndicationsSource) {
	const prompts: string[] = [];
	const registry = createValidatorRegistry();
	registry.register(
		createAgyReasoningReviewValidator({
			print: async (p) => {
				prompts.push(p);
				return CLEAN;
			},
			modelId: 'jpwb-judge',
			indications
		})
	);
	const plan = await runFloorAndPlanRecording(SUBJECT, { reasoningReview: INPUT }, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return { prompts, failed: review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement) };
}

/** Each refusal D51 lists: the arrangement, and the reason the review is refused with. */
const REFUSALS: readonly (readonly [name: string, arrange: () => Promise<{ server: string; o?: Partial<DecisionModelClientOptions> }>, reason: RegExp])[] = [
	[
		'no server',
		async () => {
			const s = await startDecisionModelStub();
			await s.close();
			return { server: s.url };
		},
		/^the decision model’s server at http:\/\/127\.0\.0\.1:\d+ did not answer \/api\/tags/
	],
	['no model', async () => ({ server: (await stub({ serves: false })).url }), /^the server serves no model named pplx-decider:27b-q4_K_M/],
	[
		'another digest',
		async () => ({ server: (await stub({ digest: `abcdef012345${'0'.repeat(52)}` })).url }),
		/^the server serves pplx-decider:27b-q4_K_M with digest abcdef012345, not 733585a9ebb6/
	],
	['another server version', async () => ({ server: (await stub({ version: '0.40.16' })).url }), /^the server is Ollama 0\.40\.16, not 0\.40\.15/],
	[
		'an HTTP error',
		async () => ({ server: (await stub({ answer: () => ({ status: 500, json: { error: 'model runner crashed' } }) })).url }),
		/^request c00 was refused: HTTP 500: model runner crashed/
	],
	[
		'a 413 refusal',
		async () => ({ server: (await stub({ answer: () => ({ status: 413, json: { error: 'text and schema must not exceed 64 KiB' } }) })).url }),
		/^request c00 was refused: HTTP 413: text and schema must not exceed 64 KiB/
	],
	[
		'a request past its bound',
		async () => ({ server: (await stub({ answer: () => ({ hang: true }) })).url, o: { bounds: { pollMs: 1, requestMs: 80 } } }),
		/^request c00 had no answer within 0\.08 s/
	],
	[
		'a review’s requests past their bound together',
		async () => ({
			server: (await stub({ answer: ({ body, parsed }) => ({ ...scoredAnswer(body, parsed), delayMs: 40 }) })).url,
			o: { bounds: { pollMs: 1, reviewMs: 60 } }
		}),
		/the review’s requests passed 0\.06 s together/
	],
	[
		'a score missing',
		async () => ({ server: (await stub({ answer: () => ({ json: { model: STUB_MODEL, answers: {}, usage: { input_tokens: 1, output_tokens: 1 } } }) })).url }),
		/^request c00’s answer holds no score for c00/
	],
	[
		'a score extra',
		async () => ({
			server: (await stub({ answer: ({ body, parsed }) => scoredAnswer(body, { ...parsed, questions: { ...(parsed.questions as object), c99: {} } }) })).url
		}),
		/^request c00’s answer holds a score for 1 question\(s\) it was not asked \(c99\)/
	]
];

describe('⛔ PREDICTED RED 5 (Z2; D51) — each refusal recorded VALIDATOR_EXECUTION_FAILED with its reason, no reviewer call made', () => {
	it.each(REFUSALS)('⛔ %s', async (_name, arrange, reason) => {
		const { server, o } = await arrange();
		const result = await within(clientOf(server, o)(REQUESTS, MATERIAL));
		expect(refusalOf(result)).toMatch(reason);
		const review = await within(reviewed(clientOf(server, o)));
		expect(review, 'the review ended within the test’s own bound').not.toBe(NO_ANSWER);
		const { prompts, failed } = review as Awaited<ReturnType<typeof reviewed>>;
		expect(prompts, 'no reviewer call').toEqual([]);
		expect(failed).toHaveLength(1);
		expect(failed[0]).toMatch(/^This review was not sent: its potential indications could not be had from the decision model — /);
		expect(failed[0]!.slice(indicationsRefusedStatement('').indexOf(' — ') + 3)).toMatch(reason);
	});

	it('⭑ CONTROL — the same client against a server that answers: the review is sent, once, with no failure', async () => {
		const s = await stub();
		const { prompts, failed } = await reviewed(clientOf(s.url));
		expect([prompts.length, failed]).toEqual([1, []]);
	});

	it('⛔ a score that is no probability is refused too', async () => {
		const s = await stub({ answer: ({ body, parsed }) => scoredAnswer(body, parsed, () => 1.5) });
		const result = await clientOf(s.url)(REQUESTS, MATERIAL);
		expect('refusal' in result && result.refusal).toMatch(/^request c00’s score is not a probability from 0 to 1/);
	});
});

describe('⛔ PREDICTED RED 6 (Z2; D51) — every request a try of its own on the record, the review’s first exchange pointing at the set', () => {
	/** A review through the validator with the client, a store and a sink: what the sink holds, and the store. */
	async function recorded(s: DecisionModelStub, reply = CLEAN) {
		const store = createInMemoryArtifactStore();
		const sink = createExchangeSink();
		let error: unknown;
		try {
			await createAgyReasoningReviewValidator({
				print: async () => reply,
				modelId: 'jpwb-judge',
				providerId: 'jpwb-judge-provider',
				indications: clientOf(s.url),
				artifacts: store,
				exchanges: sink,
				clock: () => '2026-11-06T00:00:01.000Z'
			}).evaluate(SUBJECT, { reasoningReview: INPUT });
		} catch (e) {
			error = e;
		}
		return { store, records: sink.drain(), error };
	}

	it('⭐ each request: the identity it was held to, its exact body stored, its response before any reading, its score, its times, the other models', async () => {
		const s = await stub({ loadedAtStart: true });
		const { store, records, error } = await recorded(s);
		expect(error).toBeUndefined();
		const asked = records.filter((r) => r.resolvedModelIdentity.kind === 'resolved' && r.resolvedModelIdentity.providerId === DECISION_MODEL_PROVIDER);
		const posts = s.requests.filter((r) => r.method === 'POST');
		expect(asked.map((r) => r.attemptOrdinal), 'the unload request and each question, in the order sent, before the reviewer’s').toEqual(posts.map((_, i) => i + 1));
		for (const [i, rec] of asked.entries()) {
			expect(rec.resolvedModelIdentity).toEqual({
				kind: 'resolved',
				modelId: STUB_MODEL,
				providerId: 'ollama',
				evidence: 'PROVIDER_REPORTED',
				version: `${STUB_DIGEST} on Ollama ${STUB_VERSION}`
			});
			expect([rec.exchangeRole, rec.predecessorExchangeId], 'no try succeeds another').toEqual(['initial', undefined]);
			expect(await store.get(rec.materializedInputRef.storageKey!), 'E-1: the exact bytes sent').toBe(posts[i]!.body);
			expect(rec.rawOutputBeforeCoercionRef.status, 'E-2: the response kept').toBe('STORED');
			expect(rec.disposition).toBe('accepted');
			expect([rec.requestedAt, rec.respondedAt]).toEqual(['2026-11-06T00:00:00.000Z', '2026-11-06T00:00:00.000Z']);
			expect(rec.observedToolCalls.observation).toBe('NOT_OBSERVABLE');
			expect(rec.observedToolCalls.reason, 'the other models the server held, as step 1 recorded them').toContain('the server held no other model');
			expect(rec.workProductDerivation.relation).toBe('NO_WORK_PRODUCT_EXPECTED');
		}
		const questions = asked.slice(1);
		expect(questions.map((r) => r.parseOutcome.outcome)).toEqual(questions.map(() => 'PARSED'));
		const first = JSON.parse((await store.get(asked[1]!.rawOutputBeforeCoercionRef.storageKey!))!) as { answers: Record<string, { noul: number }> };
		expect(asked[1]!.parseOutcome.detail).toBe(`answers.c00.noul read: ${first.answers.c00!.noul}`);
		expect(asked[0]!.parseOutcome).toEqual({ outcome: 'NOT_ATTEMPTED', detail: 'Step 1’s unload request: its answer is not read (D51).' });
		const reviewer = records.filter((r) => !asked.includes(r));
		expect(reviewer).toHaveLength(1);
		expect(reviewer[0]!.attemptOrdinal).toBe(asked.length + 1);
		expect(reviewer[0]!.workProductDerivation.reason, 'the review’s first exchange points at the set').toContain(
			`⭑ Its prompt quotes the decision model’s potential indications: ${asked.length} request(s) made before it in this run, each recorded as an exchange of its own, attempts 1 to ${asked.length} (D51).`
		);
	});

	it('⭐ on the record plane: plane ASSURANCE as the run says, and the version arm REPORTED — digest and server version', async () => {
		const s = await stub();
		const { records } = await recorded(s);
		const minted = new Map(records.map((r, i) => [r.exchangeId, `mex_${i}`]));
		const payload = toRecordModelExchange(
			records[0]!,
			{
				runToken: 'run_1',
				plane: 'ASSURANCE',
				invokerId: 'agy.reasoning-review',
				assurancePolicyId: FLOOR_POLICY_IDS.REASONING_REVIEW,
				subjectObjectId: SUBJECT.subjectId,
				subjectObjectType: 'ARTIFACT',
				subjectSemanticVersion: 1,
				newId: () => 'mex_x'
			},
			minted
		);
		expect(payload.plane).toBe('ASSURANCE');
		expect([payload.resolvedProvider.value, payload.resolvedModel.value]).toEqual(['ollama', STUB_MODEL]);
		expect(payload.resolvedModelVersion).toEqual({ availability: 'REPORTED', evidence: 'PROVIDER_REPORTED', value: `${STUB_DIGEST} on Ollama ${STUB_VERSION}` });
	});

	it('⛔ a review refused at its second request: both requests recorded — the second rejected with its body — and no reviewer try', async () => {
		const s = await stub({ answer: ({ body, parsed, n }) => (n === 2 ? { status: 500, json: { error: 'model runner crashed' } } : scoredAnswer(body, parsed)) });
		const { store, records, error } = await recorded(s);
		expect((error as Error).message).toMatch(/request c01 was refused: HTTP 500/);
		expect(records.map((r) => [r.disposition, r.parseOutcome.outcome])).toEqual([
			['accepted', 'PARSED'],
			['rejected', 'NOT_ATTEMPTED']
		]);
		expect(await store.get(records[1]!.rawOutputBeforeCoercionRef.storageKey!)).toBe('{"error":"model runner crashed"}');
	});

	it('⛔ a request with no answer: recorded no-response, and nothing stored as its reply', async () => {
		const s = await stub({ answer: () => ({ hang: true }) });
		const store = createInMemoryArtifactStore();
		const sink = createExchangeSink();
		await expect(
			within(
				createAgyReasoningReviewValidator({
					print: async () => '{}',
					modelId: 'jpwb-judge',
					indications: clientOf(s.url, { bounds: { pollMs: 1, requestMs: 50 } }),
					artifacts: store,
					exchanges: sink
				}).evaluate(SUBJECT, { reasoningReview: INPUT })
			)
		).rejects.toThrow(/request c00 had no answer within 0\.05 s/);
		expect(sink.drain().map((r) => [r.disposition, r.rawOutputBeforeCoercionRef.status])).toEqual([['no-response', 'PENDING_CONTENT_PLANE']]);
	});
});
