// ⭐⭐ `JAN-EXEC` Phase 7 `P7-2b` (`REG-D-102` (2)) — A REVIEWER CALL THAT THROWS SHORT OF ITS TOOL'S BOUND, WITH NO REPLY,
// IS RUN ONCE MORE, AND BOTH CALLS ARE RECORDED.
//
// ⛔ WHAT WAS WRONG (`REG-F-525`, `REG-F-499`; `docs/_working/DESIGN-the-live-end-to-end-run.md` §5 K2r, §6 P7-2b). The
// Reasoning Review validator ran each call through `timed`, whose catch rethrew a sanitised error and captured NOTHING:
// a devin transport failure — 3 of the selected reviewer's last 133 calls, each short of its 240 s bound (`REG-F-499`) —
// left no `MODEL_EXCHANGE` on either plane, its cause and its time in no record, and ended the review INCONCLUSIVE,
// which on the execution plane stops the unit for good (`REG-F-511`). At those rates a run of 20 to 40 reviews meets one
// with a probability of about a third to two thirds (design §8).
//
// ⭑ WHAT MUST HOLD — the sponsor's (b) (`REG-D-102`), the qualification's own rule (`JAN-PRQUAL` design §7.3):
//   (i)   a call that throws short of its tool's bound, with no reply, is run once more. The failed call is recorded
//         NO_RESPONSE under its OWN role, carrying the sanitised cause the tool printed (`REG-F-499`'s first remedy);
//         its successor is recorded RETRY, naming it as predecessor.
//   (ii)  a second throw counts: both are NO_RESPONSE, the second is rethrown sanitised exactly as before, and the floor
//         reads VALIDATOR_EXECUTION_FAILED, INCONCLUSIVE.
//   (iii) a throw AT or past the bound is a timeout and is not run again — and is still recorded.
//   (iv)  a substituted model is not run again: its refusal is not a throw from `print` (`JAN-SELREV` D6).
//   (v)   a malformed reply still takes the REPAIR path, and a repair call that throws is run once more too.
// ⭐ AND THREE MORE, FROM THE LANDING'S ADVERSARIAL VERIFICATION:
//   (vi)   a call that threw reported nothing, so its record names the identity the HOST configured, ungraded — never an
//          earlier call's report, graded `PROVIDER_REPORTED` (E-3), which would say a provider confirmed the model for a
//          call that returned nothing.
//   (vii)  a time the clock cannot place — a response stamped before its request, or a reading that is no time — is not
//          shown to be short of the bound, so the call is not run again.
//   (viii) when the failed call's record cannot be kept, the retention fault reaches the floor in place of the call's own
//          error, and the call is not run again (`REG-F-338`'s rule). ⚠ `REG-F-525`'s remedy proposed the reverse,
//          untested; this pins which rule the code follows.
// ⭑ AND WHERE IT APPLIES: only where the validator knows the bound of the tool it runs — the product's devin branch
// (240 s, `devinPrint`'s kill) and its agy default (180 s, agy's own print timeout). An injected `print` that declares no
// bound — the reviewer fingerprint's, the qualification runner's — throws as it did, once, and is recorded.
//
// ⛔ HERMETIC. Every tool here is a function or an adapter's exec seam, and PATH names an empty directory wherever an
// adapter is reached — both layers, as `no-programs.testing.ts` asks. ⚠ agy's own adapter, which the validator's default
// `print` reaches, ran at first with its REAL `execFile`, hermetic by PATH alone (the landing's adversarial verification);
// it now runs on an exec seam this file scripts (`vi.mock` below), which records each start it is asked for and fails as
// a program that is not there does, and PATH stays the second layer, for a seam a mutant bypassed.
import { vi } from 'vitest';

/** What agy's exec seam was asked to start. Hoisted: the mock factory below runs before this file's body. */
const agyProgram = vi.hoisted(() => ({
	/** The argv of every start of agy's program, in order. */
	calls: [] as (readonly string[])[]
}));

// ⭑ agy's REAL adapter — its argv, its bounds, its sanitising catch — with its PROGRAM replaced at the seam, for the
// validator's default `print`. A caller that hands `agyPrint` its own exec (the bound case below) keeps it.
vi.mock('./agy-cli.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./agy-cli.js')>();
	return {
		...actual,
		agyPrint: (prompt: string, exec?: Parameters<typeof actual.agyPrint>[1]) =>
			actual.agyPrint(
				prompt,
				exec ??
					(async (_file, args) => {
						agyProgram.calls.push([...args]);
						// What Node's `execFile` rejects with when the program is not found.
						throw Object.assign(new Error('spawn agy ENOENT'), { code: 'ENOENT' });
					})
			)
	};
});

import {
	FLOOR_POLICY_IDS,
	createValidatorRegistry,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import type { ArtifactStore } from '@janumipwb/rph-ports';
import { writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../agent/exchange-record.js';
import { devinPrint } from '../tools/devin-reviewer.js';
import { agyPrint } from './agy-cli.js';
import { clearingJudgement } from './clearing-reviewer.testing.js';
import { createExchangeSink } from './exchange-capture.js';
import { createFloorRegistry } from './index.js';
import { noProgramsDirectory } from './no-programs.testing.js';
import {
	createAgyReasoningReviewValidator,
	REVIEWER_CALL_BOUND_MS,
	type AgyPrint,
	type AgyValidatorOptions
} from './reasoning-review-validator.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_thrown_call',
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

/** A reply that judged every criterion and faulted none. */
const CLEAN = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
const JUDGE = 'fixture-reviewer-model';
/** The repair instruction the validator appends (`reasoning-review-validator.ts`, `repairPrompt`). */
const REPAIR_TAIL = 'IMPORTANT: reply with ONLY the minified JSON object.';
/**
 * devin's bound, as the product's devin branch is given it — written here as a number so these cases measure the RULE
 * with a bound they declare. ⭑ That the product's own bound IS this number, and is devin's own kill, is held below.
 */
const BOUND = 240_000;

/** What a transport failure looks like when it leaves `devinPrint` (`tools/devin-reviewer.ts`): no reply, a cause. */
const TRANSPORT =
	'devin invocation failed: Command failed: devin --print — upstream connection reset by peer';

const T0 = Date.parse('2026-10-09T12:00:00.000Z');

/**
 * A clock that reads `T0 + offsets[i]` at its i-th reading, the last repeating. The validator reads it once before and
 * once after each call, so the offsets come in pairs: when a call was sent, and when it answered or threw.
 */
function clockAt(...offsets: readonly number[]): () => string {
	let n = 0;
	return () => new Date(T0 + offsets[Math.min(n++, offsets.length - 1)]!).toISOString();
}

/** A clock that reads `readings` in turn, the last repeating — for a reading no offset from `T0` can write. */
function clockReading(...readings: readonly string[]): () => string {
	let n = 0;
	return () => readings[Math.min(n++, readings.length - 1)]!;
}

/**
 * A backing tool that meets its calls in turn: a string is its reply, an Error is what its `print` throws. ⚠ A call the
 * script does not name throws too, so a call no case asked for shows in `prompts` rather than passing unseen.
 */
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

/** The validator under a declared bound, with a sink for its tries. */
function reviewer(print: AgyPrint, clock: () => string, over: Partial<AgyValidatorOptions> = {}) {
	const exchanges = createExchangeSink();
	const validator = createAgyReasoningReviewValidator({
		print,
		modelId: JUDGE,
		clock,
		exchanges,
		callBoundMs: BOUND,
		...over
	});
	return { validator, exchanges };
}

/** The evaluation's result or what it threw, so a case can assert the calls before the outcome. */
const settle = (p: Promise<unknown>): Promise<unknown> =>
	p.then(
		(result) => result,
		(thrown: unknown) => thrown
	);

/** The record of each try, reduced to what these cases are about. */
const shape = (records: readonly ExchangeRecord[]) =>
	records.map((r) => ({
		exchangeId: r.exchangeId,
		role: r.exchangeRole,
		disposition: r.disposition,
		predecessor: r.predecessorExchangeId,
		outcome: r.parseOutcome.outcome
	}));

/** The Reasoning Review assessment a floor run would RECORD, over a registry holding `validator` alone. */
async function recordedReview(validator: ReturnType<typeof createAgyReasoningReviewValidator>) {
	const registry = createValidatorRegistry();
	registry.register(validator);
	const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);
	if (!review) throw new Error('the floor recorded no reasoning-review assessment at all');
	return review;
}

describe('⭐ P7-2b (i) — a call that throws short of its bound is run once more, and both calls are recorded', () => {
	it('⛔ throw, then answer: SATISFIED, two calls of one prompt, the first NO_RESPONSE with its cause, the second RETRY after it', async () => {
		const { prompts, print } = tool(new Error(TRANSPORT), CLEAN);
		// The first call throws 97 674 ms in — `REG-F-499`'s own figure, short of the 240 s bound.
		const { validator, exchanges } = reviewer(print, clockAt(0, 97_674, 97_700, 124_300));

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'the call that threw was not run once more').toHaveLength(2);
		expect(prompts[1], 'the second call is the SAME call, not a repair').toBe(prompts[0]);
		expect(outcome, 'the review did not stand on its second call').not.toBeInstanceOf(Error);
		expect((outcome as { dispositionRecommendation: string }).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const records = exchanges.drain();
		expect(shape(records)).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'no-response',
				predecessor: undefined,
				outcome: 'NOT_ATTEMPTED'
			},
			{
				exchangeId: 'exch-2',
				role: 'retry',
				disposition: 'accepted',
				predecessor: 'exch-1',
				outcome: 'PARSED'
			}
		]);
		const [failed, retried] = records;
		// ⭐ `REG-F-499`'s first remedy: the cause the tool printed, SANITISED by the seam, beside the time it failed at.
		expect(failed!.parseOutcome.detail, 'the failed call does not say why it failed').toContain(
			`reasoning-review backing tool invocation failed: ${TRANSPORT}`
		);
		expect(
			failed!.parseOutcome.detail,
			'the failed call does not say when, against which bound'
		).toContain(
			`after 97674 ms with no reply, short of the tool’s ${BOUND} ms bound, so it is run once more`
		);
		expect([failed!.requestedAt, failed!.respondedAt]).toEqual([
			new Date(T0).toISOString(),
			new Date(T0 + 97_674).toISOString()
		]);
		expect([retried!.requestedAt, retried!.respondedAt]).toEqual([
			new Date(T0 + 97_700).toISOString(),
			new Date(T0 + 124_300).toISOString()
		]);
		expect([failed!.attemptOrdinal, retried!.attemptOrdinal]).toEqual([1, 2]);
		// ⛔ A CALL THAT RETURNED NOTHING DOES NOT CLAIM IT RETURNED A STRING (`R11`): the default observation says the tool
		// "returned only an answer string", which a thrown call did not.
		expect(failed!.observedToolCalls).toMatchObject({ observation: 'NOT_OBSERVABLE' });
		expect(JSON.stringify(failed!.observedToolCalls)).toContain('failed with no reply');
	});
});

describe('⭐ P7-2b (ii) — a second throw counts', () => {
	it('⛔ throw twice: two calls, two NO_RESPONSE records, and the second call’s failure rethrown sanitised as before', async () => {
		const { prompts, print } = tool(new Error('first failure'), new Error('second failure'));
		const { validator, exchanges } = reviewer(print, clockAt(0, 5_000, 5_100, 9_000));

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a thrown call is run once more, and only once').toHaveLength(2);
		// ⛔ RETHROWN EXACTLY AS BEFORE: the seam's sanitised form, of the call that broke the review — the second.
		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toBe(
			'reasoning-review backing tool invocation failed: second failure'
		);
		const records = exchanges.drain();
		expect(shape(records)).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'no-response',
				predecessor: undefined,
				outcome: 'NOT_ATTEMPTED'
			},
			{
				exchangeId: 'exch-2',
				role: 'retry',
				disposition: 'no-response',
				predecessor: 'exch-1',
				outcome: 'NOT_ATTEMPTED'
			}
		]);
		expect(records[1]!.parseOutcome.detail).toContain(
			'reasoning-review backing tool invocation failed: second failure'
		);
		// ⭑ AND THE SECOND SAYS IT STANDS — a record that read "so it is run once more" here would claim a third call.
		expect(
			records[1]!.parseOutcome.detail,
			'the failed retry claims a call that never came'
		).not.toContain('run once more');
		expect(records[1]!.parseOutcome.detail).toContain('so this failure stands');
	});

	it('⛔ at the floor: VALIDATOR_EXECUTION_FAILED with the second call’s sanitised cause, and INCONCLUSIVE', async () => {
		const { print } = tool(new Error('first failure'), new Error('second failure'));
		const { validator } = reviewer(print, clockAt(0, 5_000, 5_100, 9_000));

		const review = await recordedReview(validator);

		expect(review.disposition).toBe('INCONCLUSIVE');
		expect(
			review.observations
				.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED')
				.map((o) => o.statement)
		).toEqual(['reasoning-review backing tool invocation failed: second failure']);
	});
});

describe('⭐ P7-2b (iii) — a throw at or past the bound is a timeout, and is not run again', () => {
	it('⛔ a throw AT the bound: one call, one NO_RESPONSE record naming the bound, and the throw stands', async () => {
		const { prompts, print } = tool(new Error('Command failed: devin --print'), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, BOUND));

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a timeout was run again').toHaveLength(1);
		expect((thrown as Error).message).toBe(
			'reasoning-review backing tool invocation failed: Command failed: devin --print'
		);
		const records = exchanges.drain();
		expect(shape(records)).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'no-response',
				predecessor: undefined,
				outcome: 'NOT_ATTEMPTED'
			}
		]);
		expect(records[0]!.parseOutcome.detail).toContain(
			`after ${BOUND} ms with no reply, at or past the tool’s ${BOUND} ms bound — a timeout, which is not run again`
		);
	});

	it('⛔ a throw past the bound is not run again either', async () => {
		const { prompts, print } = tool(new Error('Command failed: devin --print'), CLEAN);
		const { validator } = reviewer(print, clockAt(0, BOUND + 412));
		await settle(validator.evaluate(SUBJECT, CTX));
		expect(prompts).toHaveLength(1);
	});

	it('⭑ CONTROL — one millisecond short of the bound IS run again: the line is the bound itself', async () => {
		const { prompts, print } = tool(new Error('Command failed: devin --print'), CLEAN);
		const { validator } = reviewer(print, clockAt(0, BOUND - 1, BOUND, BOUND + 20_000));
		const outcome = await settle(validator.evaluate(SUBJECT, CTX));
		expect(prompts, 'a throw short of the bound was not run again').toHaveLength(2);
		expect(outcome).not.toBeInstanceOf(Error);
	});
});

/** A tool that REPORTS who answered — devin's shape — scripted per call: a reply under a model, or a throw. */
function reporting(...script: readonly ({ model: string; text: string } | Error)[]) {
	const prompts: string[] = [];
	const print: AgyPrint = async (p) => {
		prompts.push(p);
		const step = script[prompts.length - 1];
		if (step === undefined) throw new Error(`fixture: call ${prompts.length} was not scripted`);
		if (step instanceof Error) throw step;
		return {
			answer: { arrived: true, text: step.text },
			rawOutput: step.text,
			producer: { agentId: 'devin', modelId: step.model, providerId: 'devin' },
			identityEvidence: 'PROVIDER_REPORTED' as const,
			observedToolCalls: {
				canObserve: false as const,
				reason: 'Fixture: this stand-in returns an answer and observes nothing.'
			}
		};
	};
	return { prompts, print };
}

/** The options the product's devin branch builds its validator with (`assurance/index.ts`), beside the declared bound. */
const DEVIN = { agentId: 'devin', providerId: 'devin', requireReportedModel: true } as const;

describe('⭐ P7-2b (iv) — a substituted model is not run again: its refusal is not a throw from print', () => {
	it('⛔ a reply from another model: one call, refused, recorded REJECTED, no retry', async () => {
		const { prompts, print } = reporting({ model: 'substituted-model', text: CLEAN });
		const { validator, exchanges } = reviewer(print, clockAt(0, 1_000), DEVIN);

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a substituted model was asked again').toHaveLength(1);
		expect((thrown as Error).message).toContain("'substituted-model'");
		expect(shape(exchanges.drain())).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'rejected',
				predecessor: undefined,
				outcome: 'NOT_ATTEMPTED'
			}
		]);
	});

	it('⛔ a throw, then a retry answered by another model: the retry is refused as RETRY after the NO_RESPONSE — no third call', async () => {
		const { prompts, print } = reporting(new Error(TRANSPORT), {
			model: 'substituted-model',
			text: CLEAN
		});
		const { validator, exchanges } = reviewer(print, clockAt(0, 2_000, 2_100, 3_000), DEVIN);

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts).toHaveLength(2);
		expect(thrown, 'the retry’s substitute was accepted').toBeInstanceOf(Error);
		expect((thrown as Error).message).toContain("'substituted-model'");
		expect(shape(exchanges.drain())).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'no-response',
				predecessor: undefined,
				outcome: 'NOT_ATTEMPTED'
			},
			{
				exchangeId: 'exch-2',
				role: 'retry',
				disposition: 'rejected',
				predecessor: 'exch-1',
				outcome: 'NOT_ATTEMPTED'
			}
		]);
	});
});

describe('⭐ P7-2b (v) — a malformed reply still takes the repair path, and a repair call that throws is run once more', () => {
	it('⭑ a malformed reply: the REPAIR prompt follows it, never the same prompt again, and no record says retry', async () => {
		const { prompts, print } = tool('not JSON, and no judgement either', CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, 1_000, 1_100, 2_000));

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(outcome).not.toBeInstanceOf(Error);
		expect(prompts).toHaveLength(2);
		expect(prompts[1], 'a malformed reply was answered with the same call, not a repair').toBe(
			`${prompts[0]}\n\n${REPAIR_TAIL}`
		);
		expect(shape(exchanges.drain())).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'repair-requested',
				predecessor: undefined,
				outcome: 'JSON_EXTRACTION_FAILED'
			},
			{
				exchangeId: 'exch-2',
				role: 'repair',
				disposition: 'accepted',
				predecessor: 'exch-1',
				outcome: 'PARSED'
			}
		]);
	});

	it('⛔ a repair call that throws is run once more, as RETRY after the repair’s NO_RESPONSE, and the review stands', async () => {
		const { prompts, print } = tool('not JSON', new Error(TRANSPORT), CLEAN);
		const { validator, exchanges } = reviewer(
			print,
			clockAt(0, 1_000, 1_100, 60_000, 60_100, 80_000)
		);

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'the repair call that threw was not run once more').toHaveLength(3);
		expect(prompts[2], 'the repair’s retry is the repair call again').toBe(prompts[1]);
		expect(outcome).not.toBeInstanceOf(Error);
		expect((outcome as { dispositionRecommendation: string }).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		expect(shape(exchanges.drain())).toEqual([
			{
				exchangeId: 'exch-1',
				role: 'initial',
				disposition: 'repair-requested',
				predecessor: undefined,
				outcome: 'JSON_EXTRACTION_FAILED'
			},
			{
				exchangeId: 'exch-2',
				role: 'repair',
				disposition: 'no-response',
				predecessor: 'exch-1',
				outcome: 'NOT_ATTEMPTED'
			},
			{
				exchangeId: 'exch-3',
				role: 'retry',
				disposition: 'accepted',
				predecessor: 'exch-2',
				outcome: 'PARSED'
			}
		]);
	});

	it('⭑ the worst case is four calls: each of the two calls thrown once and run once more', async () => {
		const { prompts, print } = tool(
			new Error(TRANSPORT),
			'not JSON',
			new Error(TRANSPORT),
			'still not JSON'
		);
		const { validator, exchanges } = reviewer(print, clockAt(0, 10, 20, 30, 40, 50, 60, 70));

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(thrown, 'a reply malformed after its repair still fails the review').toBeInstanceOf(
			Error
		);
		expect(prompts).toHaveLength(4);
		expect(shape(exchanges.drain()).map((r) => `${r.role}:${r.disposition}`)).toEqual([
			'initial:no-response',
			'retry:repair-requested',
			'repair:no-response',
			'retry:rejected'
		]);
	});
});

/** Each try's role and disposition, in the order the tries were recorded. */
const roleAndDisposition = (records: readonly ExchangeRecord[]) =>
	records.map((r) => `${r.exchangeRole}:${r.disposition}`);

describe('⭐ P7-2b (vi) — a call that threw reported nothing: its record names the identity the host configured, ungraded', () => {
	it('⛔ a malformed reply the tool reported, then a repair call that throws: the repair’s NO_RESPONSE carries no grade, not the PROVIDER_REPORTED the first call earned', async () => {
		// The product's devin branch: its first reply names the configured model and is no judgement; the repair call fails
		// at the transport, short of the bound; its retry answers clean.
		const { prompts, print } = reporting({ model: JUDGE, text: 'not JSON' }, new Error(TRANSPORT), {
			model: JUDGE,
			text: CLEAN
		});
		const { validator, exchanges } = reviewer(
			print,
			clockAt(0, 1_000, 1_100, 2_000, 2_100, 3_000),
			DEVIN
		);

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(outcome, 'the review did not stand on the repair’s retry').not.toBeInstanceOf(Error);
		expect(prompts).toHaveLength(3);
		const records = exchanges.drain();
		expect(roleAndDisposition(records)).toEqual([
			'initial:repair-requested',
			'repair:no-response',
			'retry:accepted'
		]);
		const reportedByDevin = {
			kind: 'resolved',
			modelId: JUDGE,
			providerId: 'devin',
			evidence: 'PROVIDER_REPORTED'
		};
		// ⭑ CONTROL — the two calls that ANSWERED reported their model, and their records say so: a record with no grade
		// below is the thrown call's own fact, not a fixture that reports nothing.
		expect(records[0]!.resolvedModelIdentity).toStrictEqual(reportedByDevin);
		expect(records[2]!.resolvedModelIdentity).toStrictEqual(reportedByDevin);
		// ⛔ THE CALL THAT THREW reported nothing: the identity the host configured, with no grade — `HOST_CONFIGURED`.
		expect(
			records[1]!.resolvedModelIdentity,
			'a call that returned nothing is recorded as a model the provider confirmed'
		).toStrictEqual({ kind: 'resolved', modelId: JUDGE, providerId: 'devin' });
	});

	it('⛔ and the id with it: after a reply that reported ANOTHER model, a thrown call names the model and provider the host configured', async () => {
		// No identity check (`requireReportedModel` unset), so a reply from another model is recorded, not refused; the
		// bound is declared, so the repair call that throws is run once more.
		const { print } = reporting(
			{ model: 'reported-model', text: 'not JSON' },
			new Error(TRANSPORT),
			{ model: 'reported-model', text: CLEAN }
		);
		const { validator, exchanges } = reviewer(
			print,
			clockAt(0, 1_000, 1_100, 2_000, 2_100, 3_000),
			{ providerId: 'configured-provider' }
		);

		await settle(validator.evaluate(SUBJECT, CTX));

		const records = exchanges.drain();
		expect(roleAndDisposition(records)).toEqual([
			'initial:repair-requested',
			'repair:no-response',
			'retry:accepted'
		]);
		expect(records[0]!.resolvedModelIdentity).toStrictEqual({
			kind: 'resolved',
			modelId: 'reported-model',
			providerId: 'devin',
			evidence: 'PROVIDER_REPORTED'
		});
		expect(
			records[1]!.resolvedModelIdentity,
			'a call that returned nothing is recorded under the model an earlier call reported'
		).toStrictEqual({ kind: 'resolved', modelId: JUDGE, providerId: 'configured-provider' });
	});
});

describe('⭐ P7-2b (vii) — a time the clock cannot place is not shown to be short of the bound, so the call is not run again', () => {
	/** The failed call's whole E-5: no time, because none can be read, and the clause that says so. */
	const unplaced =
		'The reviewing tool’s call failed with no reply, its time cannot be read off the clock, so it is not shown ' +
		`to be short of the tool’s ${BOUND} ms bound and is not run again. ` +
		`What the tool reported, sanitised: reasoning-review backing tool invocation failed: ${TRANSPORT}`;

	it('⛔ a response stamped BEFORE its request — a clock stepped back: one call, and the record says why, with no time', async () => {
		const { prompts, print } = tool(new Error(TRANSPORT), CLEAN);
		const { validator, exchanges } = reviewer(print, clockAt(0, -5));

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a call whose time the clock could not place was run again').toHaveLength(1);
		expect((thrown as Error).message).toBe(
			`reasoning-review backing tool invocation failed: ${TRANSPORT}`
		);
		const records = exchanges.drain();
		expect(roleAndDisposition(records)).toEqual(['initial:no-response']);
		expect(records[0]!.parseOutcome.detail).toBe(unplaced);
	});

	it('⛔ a response time the clock wrote unreadably: one call, and the same clause', async () => {
		const { prompts, print } = tool(new Error(TRANSPORT), CLEAN);
		const { validator, exchanges } = reviewer(
			print,
			clockReading(new Date(T0).toISOString(), 'not a time')
		);

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a call whose time could not be read was run again').toHaveLength(1);
		expect((thrown as Error).message).toBe(
			`reasoning-review backing tool invocation failed: ${TRANSPORT}`
		);
		const records = exchanges.drain();
		expect(roleAndDisposition(records)).toEqual(['initial:no-response']);
		expect(records[0]!.parseOutcome.detail).toBe(unplaced);
	});
});

/**
 * A content store whose FIRST put rejects and whose later puts succeed — `reasoning-review-validator.test.ts`'s
 * `failOncePut`, restated. ⚠ ONCE, ON PURPOSE (`REG-F-338`'s masking effect): a store that always failed would fail a
 * retry's capture too, so a validator that ran the call again would fail all the same, and the retry would go unseen.
 */
function failOncePut(): ArtifactStore {
	let calls = 0;
	return {
		durability: 'PROCESS_LOCAL',
		async put() {
			calls += 1;
			if (calls === 1) throw new Error('content store unavailable');
			return {
				storageProvider: 'x',
				storageKey: `k${calls}`,
				contentHash: 'sha256:0',
				byteSize: 1
			};
		},
		async get() {
			return undefined;
		},
		async stat() {
			return undefined;
		},
		async purge() {
			return { purged: false as const, refusedBecause: 'n/a' };
		}
	} as unknown as ArtifactStore;
}

describe('⭐ P7-2b (viii) — the failed call’s record cannot be kept: the retention fault reaches the floor, and the call is not run again', () => {
	it('⛔ the store refuses the failed call’s record: one call, no record, and the floor reads the STORE’s fault in place of the call’s own (REG-F-338’s rule; REG-F-525’s remedy proposed the reverse)', async () => {
		// The thrown call's record retains one blob — its prompt, since there is no answer — so that put is the one refused.
		const { prompts, print } = tool(new Error(TRANSPORT), CLEAN);
		const exchanges = createExchangeSink();
		const validator = createAgyReasoningReviewValidator({
			print,
			modelId: JUDGE,
			clock: clockAt(0, 5_000, 5_100, 9_000),
			exchanges,
			artifacts: failOncePut(),
			callBoundMs: BOUND
		});

		const review = await recordedReview(validator);

		// ⛔ NOT RUN AGAIN: a retry must name the failed call's record as its predecessor (PER-9-a), and there is none —
		// a review standing on its retry would stand on a chain with the call that broke it missing.
		expect(prompts, 'a call whose record could not be kept was run again').toHaveLength(1);
		expect(review.disposition).toBe('INCONCLUSIVE');
		// ⛔ WHICH ERROR: the retention fault, loud, as from every capture in this validator (`REG-F-338`) — so the call's
		// own sanitised cause reaches no observation, and no record holds it either.
		expect(
			review.observations
				.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED')
				.map((o) => o.statement)
		).toEqual(['content store unavailable']);
		expect(exchanges.drain(), 'a record of the failed call was kept after all').toEqual([]);
	});
});

describe('⭐ P7-2b — where the rule applies: the product’s own reviewers, and no injected print that declares no bound', () => {
	beforeEach(() => {
		agyProgram.calls.length = 0;
		vi.stubEnv('PATH', noProgramsDirectory());
		for (const v of [
			'JPWB_ASSURANCE_TOOL',
			'JPWB_ASSURANCE_MODEL',
			'JPWB_JUDGE_MODEL',
			'JPWB_AGY_BIN',
			'JPWB_DEVIN_BIN'
		])
			vi.stubEnv(v, undefined);
	});
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('⭐ the product’s devin branch (`createFloorRegistry`): devin’s program fails once, then answers — SATISFIED over two calls, both recorded', async () => {
		vi.stubEnv('JPWB_ASSURANCE_TOOL', 'devin');
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		const calls: string[][] = [];
		const exec = async (_file: string, args: readonly string[]) => {
			calls.push([...args]);
			if (calls.length === 1)
				throw new Error('devin exited with code 1: upstream connection reset by peer');
			// The export devin writes, naming the CONFIGURED model, so the identity check passes.
			const exportPath = args[args.indexOf('--export') + 1]!;
			await writeFile(
				exportPath,
				JSON.stringify({ steps: [{ extra: { generation_model: 'fixture-devin-model' } }] }),
				'utf8'
			);
			return { stdout: CLEAN };
		};
		const exchanges = createExchangeSink();
		const registry = createFloorRegistry({ testMode: false, devinExec: exec, exchanges });
		const validator = registry.get(FLOOR_POLICY_IDS.REASONING_REVIEW);
		if (!validator) throw new Error('arrangement: the registry holds no reasoning review');

		const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);

		expect(calls, 'devin’s program was not run once more after it failed').toHaveLength(2);
		expect(review?.disposition).toBe('SATISFIED');
		const records = exchanges.drain();
		expect(records.map((r) => `${r.exchangeRole}:${r.disposition}`)).toEqual([
			'initial:no-response',
			'retry:accepted'
		]);
		expect(records[0]!.parseOutcome.detail).toContain(
			'devin invocation failed: devin exited with code 1: upstream connection reset by peer'
		);
		expect(records[0]!.parseOutcome.detail).toContain(
			`short of the tool’s ${REVIEWER_CALL_BOUND_MS.devin} ms bound`
		);
	});

	it('⭐ the agy default — no `print` — runs agy’s own adapter, which finds no program: thrown short of agy’s 180 s bound, run once more, INCONCLUSIVE', async () => {
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge');
		const exchanges = createExchangeSink();
		const validator = createAgyReasoningReviewValidator({
			modelId: 'fixture-judge',
			exchanges,
			clock: clockAt(0, 5, 10, 15)
		});

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(thrown).toBeInstanceOf(Error);
		expect((thrown as Error).message).toMatch(
			/^reasoning-review backing tool invocation failed: agy invocation failed/
		);
		// ⭐ Both calls reached agy's program through its exec seam, which started nothing (`vi.mock`, above).
		expect(
			agyProgram.calls.map((args) => args[args.indexOf('--model') + 1]),
			'agy’s program was not asked for twice, through its seam'
		).toEqual(['fixture-judge', 'fixture-judge']);
		const records = exchanges.drain();
		expect(records.map((r) => `${r.exchangeRole}:${r.disposition}`)).toEqual([
			'initial:no-response',
			'retry:no-response'
		]);
		expect(records[0]!.parseOutcome.detail).toContain(
			`short of the tool’s ${REVIEWER_CALL_BOUND_MS.agy} ms bound, so it is run once more`
		);
	});

	it('⭑ and agy’s bound is ITS OWN: a throw at 180 s from agy is a timeout, where devin’s bound would run it again', async () => {
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge');
		const exchanges = createExchangeSink();
		const validator = createAgyReasoningReviewValidator({
			modelId: 'fixture-judge',
			exchanges,
			clock: clockAt(0, 180_000)
		});

		await settle(validator.evaluate(SUBJECT, CTX));

		expect(
			agyProgram.calls,
			'agy’s program was asked for again after its own timeout'
		).toHaveLength(1);
		const records = exchanges.drain();
		expect(records.map((r) => `${r.exchangeRole}:${r.disposition}`)).toEqual([
			'initial:no-response'
		]);
		expect(records[0]!.parseOutcome.detail).toContain('180000 ms bound — a timeout');
	});

	it('⛔ an injected print that declares no bound — the fingerprint’s and the qualification runner’s shape — throws once, as before, and is recorded', async () => {
		// The qualification applies its own rule to a WHOLE evaluation (design §7.3) and records each call under the two
		// roles its record knows (`scripts/reviewer-qual/record.ts`, `CALL_ROLES`), so a retry inside the validator would
		// double its rule and mislabel a call: it must see exactly one call per throw.
		const { prompts, print } = tool(new Error(TRANSPORT), CLEAN);
		const exchanges = createExchangeSink();
		const validator = createAgyReasoningReviewValidator({
			agentId: 'devin',
			modelId: 'fixture-label',
			providerId: 'devin',
			clock: () => '1970-01-01T00:00:00.000Z',
			print,
			exchanges
		});

		const thrown = await settle(validator.evaluate(SUBJECT, CTX));

		expect(prompts, 'a print with no declared bound was run again').toHaveLength(1);
		expect((thrown as Error).message).toBe(
			`reasoning-review backing tool invocation failed: ${TRANSPORT}`
		);
		// ⭑ `REG-F-525` — RECORDED ALL THE SAME: the thrown call is a try that happened, retried or not.
		const records = exchanges.drain();
		expect(records.map((r) => `${r.exchangeRole}:${r.disposition}`)).toEqual([
			'initial:no-response'
		]);
		expect(records[0]!.parseOutcome.detail).toContain('declares no bound');
	});

	it('⭑ each bound is the one its adapter hands its program — devin’s kill, and agy’s own print timeout, the earlier of agy’s two', async () => {
		vi.stubEnv('JPWB_ASSURANCE_MODEL', 'fixture-devin-model');
		let devinKill = 0;
		await devinPrint('p', async (_file, _args, options) => {
			devinKill = options.timeout;
			return { stdout: '{}' };
		});
		vi.stubEnv('JPWB_JUDGE_MODEL', 'fixture-judge');
		let agyArgs: readonly string[] = [];
		let agyKill = 0;
		await agyPrint('p', async (_file, args, options) => {
			agyArgs = args;
			agyKill = options.timeout;
			return { stdout: '{}' };
		});
		const printTimeout = agyArgs[agyArgs.indexOf('--print-timeout') + 1];
		expect(printTimeout, 'agy’s own print timeout is no longer in minutes').toMatch(/^\d+m$/);
		const agyOwn = Number.parseInt(printTimeout!, 10) * 60_000;

		expect(REVIEWER_CALL_BOUND_MS.devin).toBe(devinKill);
		expect(REVIEWER_CALL_BOUND_MS.agy).toBe(Math.min(agyOwn, agyKill));
		expect(REVIEWER_CALL_BOUND_MS.agy, 'agy stops itself before the kill').toBe(agyOwn);
		expect(BOUND, 'these cases declare a bound other than the product’s devin bound').toBe(
			REVIEWER_CALL_BOUND_MS.devin
		);
	});
});
