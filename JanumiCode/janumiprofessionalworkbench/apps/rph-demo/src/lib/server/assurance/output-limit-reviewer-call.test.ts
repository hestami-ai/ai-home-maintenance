// ⭐⭐ `JAN-EXEC` Phase 7 P5, package A (F1) — A REVIEWER CALL WHOSE REPLY THE TOOL ENDED AT THE MODEL'S OUTPUT-TOKEN LIMIT
// IS RECORDED AS ITS OWN CLASS: never NO_RESPONSE, never a call with no reply.
//
// ⛔ WHAT WAS WRONG (P5's analysis of run-5). 7 of P5's 44 reviewer calls ended at devin's output-token cap, and each was
// recorded `NO_RESPONSE`, its detail *"failed … with no reply"* — though devin had cut a reply, one of them a whole verdict
// short of its last field — its partial reply dropped, its identity HOST_CONFIGURED, its export deleted unread.
// ⭑ WHAT MUST HOLD, through the REAL validator with its tool's `print` throwing what `devinPrint` throws for such a call
// (`OutputLimitReached`, `tools/output-limit.ts`):
//   (i)   the try is recorded REJECTED — a reply arrived and nothing is judged from it — with E-4's output truncation
//         DECLARED, and E-5 NOT_ATTEMPTED, its detail opening with the class's marker and saying what the tool reported;
//   (ii)  its partial reply is kept WHOLE, PURGEABLE_AT_EXPIRY, for diagnosis — even where a span can be located in it —
//         and never in E-5's detail; its export is kept and pointed at; its identity is the one the export reported;
//   (iii) the thrown call's rule is unchanged: short of the bound it is run once more, a second cut stands, and the floor
//         reads VALIDATOR_EXECUTION_FAILED, INCONCLUSIVE;
//   (iv)  the floor's projection carries the class: `outputTruncation: DECLARED`, and `outputLimitOf` reads it back.
// No model is called: the tool is a function.
import {
	FLOOR_POLICY_IDS,
	createValidatorRegistry,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { createInMemoryArtifactStore, type ArtifactStore } from '@janumipwb/rph-ports';
import { describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../agent/exchange-record.js';
import { OUTPUT_LIMIT, OutputLimitReached, outputLimitOf } from '../tools/output-limit.js';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { createExchangeSink } from './exchange-capture.js';
import { mintIdsFor, toRecordModelExchange } from './exchange-recorder.js';
import { createAgyReasoningReviewValidator, type AgyPrint } from './reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_output_limit',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'fixture-executor',
		modelId: 'fixture-executor-model',
		providerId: 'fixture-provider'
	}
};

const CTX: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Assess a delivery route for operational risk.',
		content: '{"finding":"the route is viable","risks":["a closed bridge"]}',
		narration: ''
	}
};

const CLEAN = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
const JUDGE = 'glm-5-3-flash-max';
const BOUND = 240_000;

/** `devinPrint`'s diagnostic for such a call — devin's two stderr lines, verbatim from P5's records, after the command. */
const DIAGNOSTIC =
	'devin invocation failed: Command failed: devin --print --model glm-5-3-flash-max --prompt-file jpwb-devin-FIXTURE/prompt.txt ' +
	'--export jpwb-devin-FIXTURE/export.json --respect-workspace-trust false\n' +
	'warning: response truncated (model hit max output token limit)\n' +
	'Error: Response truncated: model hit max output token limit. The output above is incomplete.\n';

/** A reply cut inside its last field — P5's dramatic-mimosa's shape: a span CAN be located in it (first `{` to last `}`). */
const PARTIAL =
	'{"findings":[{"criterionId":"RR-01","failed":false,"statement":"met"}],"recommendation":"SATISFIED","residualUncertainty":["the verification doc';

const EXPORT = JSON.stringify({
	schema_version: 'ATIF-v1.7',
	steps: [{ step_id: 2, source: 'agent', metrics: { completion_tokens: 25_000 }, extra: { generation_model: JUDGE } }]
});

/** What `devinPrint` throws for a reply devin ended at the model's output-token limit. */
const cut = (partialReply = PARTIAL) =>
	new OutputLimitReached(DIAGNOSTIC, {
		facts: { outputTokens: 25_000 },
		partialReply,
		producer: { agentId: 'devin', modelId: JUDGE, providerId: 'devin' },
		observedToolCalls: { canObserve: false, reason: 'The devin adapter cannot observe tool calls (fixture).' },
		sessionExport: EXPORT
	});

const T0 = Date.parse('2026-10-18T17:00:00.000Z');
function clockAt(...offsets: readonly number[]): () => string {
	let n = 0;
	return () => new Date(T0 + offsets[Math.min(n++, offsets.length - 1)]!).toISOString();
}

/** A tool that meets its calls in turn: a string is its reply, an Error what its `print` throws. */
function tool(...script: readonly (string | Error)[]) {
	const prompts: string[] = [];
	const print: AgyPrint = async (p) => {
		prompts.push(p);
		const step = script[prompts.length - 1];
		if (step === undefined) throw new Error(`fixture: call ${prompts.length} was not scripted`);
		if (step instanceof Error) throw step;
		return step;
	};
	return { prompts, print };
}

function reviewer(print: AgyPrint, clock: () => string, store?: ArtifactStore) {
	const exchanges = createExchangeSink();
	const validator = createAgyReasoningReviewValidator({
		print,
		modelId: JUDGE,
		clock,
		exchanges,
		callBoundMs: BOUND,
		...(store ? { artifacts: store } : {})
	});
	return { validator, exchanges };
}

const settle = (p: Promise<unknown>): Promise<unknown> =>
	p.then(
		(r) => r,
		(e: unknown) => e
	);

/** Each try's record as the floor projects it (`toRecordModelExchange`). */
function projected(records: readonly ExchangeRecord[]) {
	let n = 0;
	const ids = mintIdsFor(records, () => `mex_${++n}`);
	return records.map((rec) =>
		toRecordModelExchange(
			rec,
			{
				runToken: 'run_1',
				plane: 'ASSURANCE',
				invokerId: 'floor.reasoning-review',
				assurancePolicyId: 'floor.reasoning-review',
				subjectObjectId: SUBJECT.subjectId,
				subjectObjectType: 'ARTIFACT',
				subjectSemanticVersion: 1,
				newId: (prefix) => `${prefix}_unused`
			},
			ids
		)
	);
}

describe('⭐⭐ P5 package A (F1) — a call cut at the model’s output-token limit is recorded as its own class', () => {
	it('⛔ cut, then answered: SATISFIED by the retry; the cut try REJECTED, its output declared truncated, its detail the class’s — never NO_RESPONSE', async () => {
		const store = createInMemoryArtifactStore();
		const { prompts, print } = tool(cut(), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 120_000), store);

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a cut call short of the bound is run once more, as a thrown call is').toHaveLength(2);
		expect((outcome as { dispositionRecommendation?: string }).dispositionRecommendation).toBe('SATISFIED');
		const [first, retried] = exchanges.drain();
		expect([first!.exchangeRole, retried!.exchangeRole, retried!.predecessorExchangeId]).toEqual([
			'initial',
			'retry',
			first!.exchangeId
		]);
		// ⛔ THE MUTANT: the cut call captured as a thrown one — `no-response`, "with no reply", its reply dropped.
		expect(first!.disposition, 'a cut reply was recorded as no reply').toBe('rejected');
		expect(first!.outputTruncationState, 'E-4 does not say the output was cut').toBe('declared');
		expect(first!.truncationState, 'the INPUT was cut by nothing').toBe('unknown');
		expect(first!.parseOutcome.outcome).toBe('NOT_ATTEMPTED');
		const detail = first!.parseOutcome.detail;
		expect(detail.startsWith(OUTPUT_LIMIT), 'E-5 does not open with the class’s marker').toBe(true);
		expect(detail).toContain(
			'The reviewing tool ended the model’s reply after 90010 ms: finish_reason not reported, output_tokens 25000.'
		);
		expect(detail).toContain(`Its partial reply, ${PARTIAL.length} characters, is kept unparsed for diagnosis`);
		expect(detail).toContain(`short of the tool’s ${BOUND} ms bound, so it is run once more (REG-D-102)`);
		expect(detail.endsWith(`What the tool reported, sanitised: reasoning-review backing tool invocation failed: ${DIAGNOSTIC}`)).toBe(true);
		expect(detail, 'the class’s detail claims no reply').not.toContain('with no reply');
		// ⛔ NO BYTE OF THE PARTIAL REPLY ON THE RECORD PLANE: it is model-written, and kept on the content plane alone.
		expect(detail).not.toContain('the verification doc');
	});

	it('⛔ the partial reply is kept WHOLE, purgeable, though a span can be located in it — the span refs pending, saying why', async () => {
		const store = createInMemoryArtifactStore();
		const { print } = tool(cut(), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 120_000), store);
		await settle(validator.evaluate(SUBJECT, CTX));
		const [first] = exchanges.drain();
		// ⛔ THE MUTANT: the reply separated as an answered one is — its located "answer", cut short and judged from nothing,
		// kept RETAINED_BY_PARTICIPATION, as if a judgement rested on it.
		expect(first!.rawOutputBeforeCoercionRef.status, 'the partial reply is not kept whole').toBe('STORED');
		expect(first!.rawOutputBeforeCoercionRef.purgeability).toBe('PURGEABLE_AT_EXPIRY');
		expect(await store.get(first!.rawOutputBeforeCoercionRef.storageKey!)).toBe(PARTIAL);
		expect(first!.answerSpanRef.status, 'a cut reply’s span was kept as an answer').toBe('PENDING_CONTENT_PLANE');
		expect(first!.answerSpanRef.reason).toContain('output-token limit');
		expect(first!.omittedRegions).toEqual([]);
		// ⭐ Its identity is the one the tool's export reported, graded so; and the export is kept and pointed at.
		expect(first!.resolvedModelIdentity).toEqual({
			kind: 'resolved',
			modelId: JUDGE,
			providerId: 'devin',
			evidence: 'PROVIDER_REPORTED'
		});
		expect(first!.observedToolCalls.observation).toBe('NOT_OBSERVABLE');
		expect(first!.observedToolCalls.reason).toContain('The devin adapter cannot observe tool calls (fixture).');
		expect(first!.observedToolCalls.reason).toContain('own export of this session');
	});

	it('⛔ cut twice: both tries the class, the second stands, and the floor reads VALIDATOR_EXECUTION_FAILED, INCONCLUSIVE', async () => {
		const { prompts, print } = tool(cut(), cut(''));
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 180_000));

		const registry = createValidatorRegistry();
		registry.register(validator);
		const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);

		expect(prompts, 'a cut call is given one further call, never two').toHaveLength(2);
		const records = exchanges.drain();
		expect(records.map((r) => [r.exchangeRole, r.disposition, r.outputTruncationState])).toEqual([
			['initial', 'rejected', 'declared'],
			['retry', 'rejected', 'declared']
		]);
		expect(records[1]!.parseOutcome.detail).toContain('so this failure stands');
		expect(records[1]!.parseOutcome.detail).toContain('Its partial reply, 0 characters,');
		expect(review?.disposition).toBe('INCONCLUSIVE');
		expect(
			review?.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement)
		).toEqual([`reasoning-review backing tool invocation failed: ${DIAGNOSTIC}`]);
	});

	// ⭐ P5 package C (F5 (a); package A's check, finding 4) — AN I5 CRITERION REPAIR CUT AT THE OUTPUT-TOKEN LIMIT KEEPS THE FIRST
	// REPLY'S JUDGEMENT, as one that got no reply does: the repair may only ADD a conclusion (`REG-F-552`; `REG-D-090`). The
	// cut's error is among those `criterionRepair` absorbs (`noReply`); ⛔ outside it, the cut failed a review its first reply
	// had already judged. `reviewer-answer.test.ts` holds the READER of this chain; this holds the VALIDATOR.
	it('⛔ an I5 criterion repair cut twice at the output-token limit: the review resolves on the FIRST reply’s judgement, never failing', async () => {
		/** A reply that PARSES and answers no criterion — the measured run's shape (`REG-F-552`). */
		const NO_ROWS = '{"findings":[],"recommendation":"SATISFIED","residualUncertainty":["x"]}';
		const { prompts, print } = tool(NO_ROWS, cut(), cut(''));
		const { validator, exchanges } = reviewer(print, clockAt(0, 1_000, 1_100, 91_000, 91_100, 181_000));

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'the first reply, its repair, and the repair’s one further call').toHaveLength(3);
		expect(
			exchanges.drain().map((r) => [r.exchangeRole, r.disposition, r.outputTruncationState ?? null]),
			'arrangement: the repair was cut, and its retry too'
		).toEqual([
			['initial', 'repair-requested', null],
			['repair', 'rejected', 'declared'],
			['retry', 'rejected', 'declared']
		]);
		// ⛔ THE MUTANT: the cut's error not absorbed — the review failed on a repair that could only have added a conclusion.
		expect(outcome instanceof Error ? outcome.message : null, 'the cut repair failed the review').toBeNull();
		const result = outcome as { executionFailed: boolean; dispositionRecommendation?: string; criteria: readonly { outcome: string }[] };
		expect(result.executionFailed).toBe(false);
		expect(result.dispositionRecommendation, 'the first reply’s recommendation').toBe('SATISFIED');
		expect(new Set(result.criteria.map((c) => c.outcome)), 'every criterion unassessed, as the first reply left them').toEqual(
			new Set(['UNABLE_TO_DETERMINE'])
		);
	});

	it('⛔ with no store, the record still says its output was cut — the class is the record’s, not the store’s', async () => {
		const { print } = tool(cut(), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 120_000));
		await settle(validator.evaluate(SUBJECT, CTX));
		const [first] = exchanges.drain();
		expect([first!.disposition, first!.outputTruncationState]).toEqual(['rejected', 'declared']);
	});
});

describe('⭐⭐ P5 package A (F1) — the floor’s projection carries the class, and `outputLimitOf` reads it back', () => {
	it('⛔ the cut try projects REJECTED with outputTruncation DECLARED, its input UNKNOWN; outputLimitOf reads its facts', async () => {
		const { print } = tool(cut(), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 120_000));
		await settle(validator.evaluate(SUBJECT, CTX));
		const [first, retried] = projected(exchanges.drain());
		// ⛔ THE MUTANT: one truncation state answering both — the output's DECLARED dropped, or the input's claimed.
		expect([first!.disposition, first!.outputTruncation, first!.inputTruncation]).toEqual([
			'REJECTED',
			'DECLARED',
			'UNKNOWN'
		]);
		expect(outputLimitOf(first), 'the class’s reader does not read the class').toEqual({
			finishReason: null,
			outputTokens: 25_000
		});
		expect(retried!.outputTruncation, 'an answered try claims a cut').toBe('UNKNOWN');
		expect(outputLimitOf(retried)).toBeUndefined();
	});

	it('⭑ CONTROL — a thrown call with no reply is not the class: NO_RESPONSE, its output UNKNOWN', async () => {
		const { print } = tool(new Error('devin invocation failed: upstream connection reset by peer'), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 5_000, 5_100, 9_000));
		await settle(validator.evaluate(SUBJECT, CTX));
		const [threw] = projected(exchanges.drain());
		expect([threw!.disposition, threw!.outputTruncation]).toEqual(['NO_RESPONSE', 'UNKNOWN']);
		expect(outputLimitOf(threw)).toBeUndefined();
	});

	it('⭑ CONTROL — the class is the PAIR: the marker without DECLARED, or DECLARED without the marker, is not it', async () => {
		const { print } = tool(cut(), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 90_010, 90_100, 120_000));
		await settle(validator.evaluate(SUBJECT, CTX));
		const [first] = projected(exchanges.drain());
		// The one edit each: E-4, then E-5's detail.
		expect(outputLimitOf({ ...first!, outputTruncation: 'UNKNOWN' }), 'read by its marker alone').toBeUndefined();
		expect(
			outputLimitOf({ ...first!, parseOutcome: { outcome: 'NOT_ATTEMPTED', detail: 'The reviewing tool’s call failed.' } }),
			'read by its truncation alone'
		).toBeUndefined();
	});
});
