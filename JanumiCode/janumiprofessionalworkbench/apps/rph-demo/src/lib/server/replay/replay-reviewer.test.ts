// ⭐⭐ `JAN-EXEC` Phase 8 (`DESIGN-phase-7-completion.md` §5 D2; `REG-D-111` (5); `REG-F-530`) — THE REPLAY REVIEWER: the
// product's own Reasoning Review validator, its `print` the replay's (`replay-run.ts`, `reviewerPrint`) and its clock the
// replay's virtual time. It FAILS CLOSED, and never answers by order alone (`REG-D-067`).
//
// ⭑ WHAT MUST HOLD:
//   (i)   a recorded THROWN reply is thrown again, and the RECORDED elapsed time decides whether it is run once more —
//         short of the tool's bound, the retry takes the next recorded reply, exactly as the run's did;
//   (ii)  at or past the bound, it is not run again, and the review fails as the run's did;
//   (iii) a prompt whose hash is not the recorded one is REPLAY_STALE, naming the call and both hashes; the floor reads
//         it as a failed review; and the retry the validator gives that throw is refused too — it never takes the next
//         recorded reply;
//   (iv)  a call past the recording's end is REPLAY_EXHAUSTED;
//   (v)   no replayed exchange is graded PROVIDER_REPORTED: no provider reported it;
//   (vi)  the floor registry's REPLAY arm builds exactly this reviewer, outranks an injected `print`, and records a
//         recording it cannot read as a refusal.
// ⭑ PREDICTED REDS, WRITTEN FIRST: (i) — the precedent `replayReplies` refuses a transport failure outright
// (`scripts/reviewer-qual/runner.ts:495-498`), and this replay was first built to its rule; (iii) — a replay that served
// replies by order alone (the control mutant) answers SATISFIED to a stale prompt.
//
// ⛔ HERMETIC. Every reply is the recording's; nothing is spawned, and PATH names an empty directory for (vi), where the
// registry is built from the process's environment.
import {
	FLOOR_POLICY_IDS,
	createValidatorRegistry,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../agent/exchange-record.js';
import { clearingJudgement } from '../assurance/clearing-reviewer.testing.js';
import { createExchangeSink } from '../assurance/exchange-capture.js';
import { createFloorRegistry } from '../assurance/index.js';
import { noProgramsDirectory } from '../assurance/no-programs.testing.js';
import {
	createAgyReasoningReviewValidator,
	type AgyPrint
} from '../assurance/reasoning-review-validator.js';
import {
	RECORDING_FORMAT,
	recordingFiles,
	SCRUB_TOKENS,
	sha256Hex,
	type RecordedReply,
	type Recording,
	type ReviewerCall
} from './recording.js';
import {
	createReplayRun,
	forgetReplayRuns,
	REPLAY_EPOCH_MS,
	type ReplayRun
} from './replay-run.js';
import { fixtureManifest } from './replay-fixture.testing.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_replayed_review',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: {
		actorType: 'AGENT',
		agentId: 'execution.model-invocation',
		modelId: 'fixture-executor-model',
		providerId: 'fixture-provider'
	}
};

const CTX: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Write the requirements for wordfreq.',
		content: '{"requirements":["R1: it counts words"]}',
		narration: ''
	}
};

const CLEAN = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
const REVIEWER = {
	agentId: 'devin',
	modelId: 'fixture-reviewer-model',
	providerId: 'devin'
} as const;
const BOUND = 240_000;
/** What devin's program threw, before the validator's seam sanitised it (`sanitiseToolFailure`). */
const TRANSPORT = 'devin exited with code 1: connection reset by peer';

/** The prompt the validator sends for CTX — captured from the validator itself, as the recorder reads it off a run. */
async function promptOf(ctx: ValidatorContext = CTX): Promise<string> {
	const seen: string[] = [];
	const capture: AgyPrint = async (p) => {
		seen.push(p);
		return CLEAN;
	};
	await createAgyReasoningReviewValidator({ print: capture, modelId: REVIEWER.modelId }).evaluate(
		SUBJECT,
		ctx
	);
	return seen[0]!;
}

const call = (
	prompt: string,
	reply: RecordedReply,
	elapsedMs: number,
	over: Partial<ReviewerCall> = {}
): ReviewerCall => ({
	unit: 'requirements',
	framing: 'work-product',
	role: 'initial',
	promptSha256: sha256Hex(prompt),
	prompt,
	reply,
	evaluator: { ...REVIEWER },
	elapsedMs,
	...over
});

/** A recording holding only `reviewer` calls — the executor and the runner are not reached here. */
const recordingOf = (
	reviewer: readonly ReviewerCall[],
	callBoundMs: number | null = BOUND
): Recording => ({
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		...fixtureManifest(),
		models: {
			executor: {
				agentId: 'execution.model-invocation',
				modelId: 'fixture-executor-model',
				providerId: 'fixture-provider'
			},
			reviewer: { ...REVIEWER, callBoundMs }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: []
	},
	executor: [],
	commands: [],
	reviewer
});

/** The product's validator as the floor registry's REPLAY arm builds it, on `run`. */
function replayed(run: ReplayRun) {
	const exchanges = createExchangeSink();
	const validator = createAgyReasoningReviewValidator({
		print: run.reviewerPrint,
		clock: run.clock,
		exchanges,
		agentId: REVIEWER.agentId,
		modelId: REVIEWER.modelId,
		providerId: REVIEWER.providerId,
		callBoundMs: BOUND
	});
	return { validator, exchanges };
}

const settle = (p: Promise<unknown>): Promise<unknown> =>
	p.then(
		(result) => result,
		(thrown: unknown) => thrown
	);

const shape = (records: readonly ExchangeRecord[]) =>
	records.map((r) => ({
		role: r.exchangeRole,
		disposition: r.disposition,
		outcome: r.parseOutcome.outcome
	}));

const at = (ms: number): string => new Date(REPLAY_EPOCH_MS + ms).toISOString();

describe('⭐ the replay reviewer — the product’s validator on recorded replies (D2)', () => {
	it('(i) ⛔ a recorded THROWN reply is thrown again, and its RECORDED elapsed time runs it once more, as the run did', async () => {
		const prompt = await promptOf();
		const run = createReplayRun(
			recordingOf([
				call(prompt, { status: 'THROWN', message: TRANSPORT }, 97_674),
				call(prompt, { status: 'ANSWERED', text: CLEAN }, 26_600, { role: 'retry' })
			]),
			() => '/unused'
		);
		const { validator, exchanges } = replayed(run);

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(outcome, 'the replayed review did not stand on its retry').not.toBeInstanceOf(Error);
		expect((outcome as { dispositionRecommendation: string }).dispositionRecommendation).toBe(
			'SATISFIED'
		);
		const records = exchanges.drain();
		expect(shape(records)).toEqual([
			{ role: 'initial', disposition: 'no-response', outcome: 'NOT_ATTEMPTED' },
			{ role: 'retry', disposition: 'accepted', outcome: 'PARSED' }
		]);
		// ⭐ The recorded cause, sanitised by the seam as the run's was, and the RECORDED time against the bound.
		expect(records[0]!.parseOutcome.detail).toContain(
			`reasoning-review backing tool invocation failed: ${TRANSPORT}`
		);
		expect(records[0]!.parseOutcome.detail).toContain(
			`after 97674 ms with no reply, short of the tool’s ${BOUND} ms bound, so it is run once more`
		);
		expect([
			records[0]!.requestedAt,
			records[0]!.respondedAt,
			records[1]!.requestedAt,
			records[1]!.respondedAt
		]).toEqual([at(0), at(97_674), at(97_674), at(124_274)]);
		expect(run.consumed().reviewer).toBe(2);
	});

	it('(ii) at the bound the recorded throw is a timeout: not run again, and the review fails as the run’s did', async () => {
		const prompt = await promptOf();
		const run = createReplayRun(
			recordingOf([
				call(prompt, { status: 'THROWN', message: TRANSPORT }, BOUND),
				call(prompt, { status: 'ANSWERED', text: CLEAN }, 1)
			]),
			() => '/unused'
		);
		const { validator, exchanges } = replayed(run);

		const outcome = await settle(validator.evaluate(SUBJECT, CTX));

		expect(outcome).toBeInstanceOf(Error);
		expect((outcome as Error).message).toContain(TRANSPORT);
		expect(shape(exchanges.drain())).toEqual([
			{ role: 'initial', disposition: 'no-response', outcome: 'NOT_ATTEMPTED' }
		]);
		expect(run.consumed().reviewer, 'the recorded reply after a timeout was taken').toBe(1);
	});

	it('(iii) ⛔ a stale prompt is REPLAY_STALE, naming the call and both hashes — and its retry never takes the next reply', async () => {
		const prompt = await promptOf();
		// The recording was made over `prompt`; the run now asks about a changed instruction, so its prompt differs.
		const run = createReplayRun(
			recordingOf([
				call(prompt, { status: 'ANSWERED', text: CLEAN }, 10),
				call(prompt, { status: 'ANSWERED', text: CLEAN }, 10)
			]),
			() => '/unused'
		);
		const { validator, exchanges } = replayed(run);

		const registry = createValidatorRegistry();
		registry.register(validator);
		const plan = await runFloorAndPlanRecording(
			SUBJECT,
			{
				reasoningReview: {
					...CTX.reasoningReview!,
					prompt: `${CTX.reasoningReview!.prompt} (changed)`
				}
			},
			registry
		);
		const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW);

		expect(review?.disposition, 'a stale prompt was answered').toBe('INCONCLUSIVE');
		const said = JSON.stringify(review);
		expect(said).toContain('REPLAY_STALE');
		expect(said).toContain('reviewer call 1 (unit requirements, work-product, initial)');
		expect(said).toContain(sha256Hex(prompt));
		// ⛔ Poisoned: the validator's one retry of the throw is refused as stale too, and no recorded reply was served.
		expect(shape(exchanges.drain()).map((r) => r.disposition)).toEqual([
			'no-response',
			'no-response'
		]);
		expect(run.consumed().reviewer, 'a recorded reply was served to a stale prompt').toBe(0);
		expect(run.poisonedBy()?.code).toBe('REPLAY_STALE');
	});

	it('(iv) a call past the recording’s end is REPLAY_EXHAUSTED', async () => {
		const run = createReplayRun(recordingOf([]), () => '/unused');
		await expect(run.reviewerPrint('anything')).rejects.toThrow(
			'REPLAY_EXHAUSTED: reviewer call 1 was asked for, and the recording holds 0'
		);
	});

	it('(v) ⛔ no replayed exchange is graded PROVIDER_REPORTED: the host asserts the recorded identity', async () => {
		const prompt = await promptOf();
		const run = createReplayRun(
			recordingOf([call(prompt, { status: 'ANSWERED', text: CLEAN }, 5)]),
			() => '/unused'
		);
		const { validator, exchanges } = replayed(run);
		await validator.evaluate(SUBJECT, CTX);
		const [record] = exchanges.drain();
		expect(record!.resolvedModelIdentity).toEqual({
			kind: 'resolved',
			modelId: REVIEWER.modelId,
			providerId: REVIEWER.providerId,
			evidence: 'HOST_CONFIGURED'
		});
	});
});

describe('⭐ the floor registry’s REPLAY arm (D2)', () => {
	const saved = {
		replay: process.env.JPWB_REPLAY,
		path: process.env.PATH,
		tool: process.env.JPWB_ASSURANCE_TOOL
	};
	let dir = '';
	afterEach(() => {
		forgetReplayRuns();
		for (const [k, v] of [
			['JPWB_REPLAY', saved.replay],
			['PATH', saved.path],
			['JPWB_ASSURANCE_TOOL', saved.tool]
		] as const)
			if (v === undefined) delete process.env[k];
			else process.env[k] = v;
		if (dir !== '') rmSync(dir, { recursive: true, force: true });
		dir = '';
	});

	const floorOver = async (print?: AgyPrint) => {
		const exchanges = createExchangeSink();
		const plan = await runFloorAndPlanRecording(
			SUBJECT,
			CTX,
			createFloorRegistry({ testMode: true, exchanges, ...(print ? { print } : {}) })
		);
		return {
			review: plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW),
			exchanges
		};
	};

	it('(vi) builds the replay reviewer from JPWB_REPLAY, outranks an injected print, and refuses an unreadable recording', async () => {
		const prompt = await promptOf();
		dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-floor-'));
		// ⭑ A throw, then its retry: the arm must hand the validator the replay's CLOCK and the recording's BOUND, or the
		// recorded 1 000 ms is not what decides the retry (no bound: the throw stands; the wall clock: other times).
		for (const [file, text] of Object.entries(
			recordingFiles(
				recordingOf([
					call(prompt, { status: 'THROWN', message: TRANSPORT }, 1_000),
					call(prompt, { status: 'ANSWERED', text: CLEAN }, 5, { role: 'retry' })
				])
			)
		))
			writeFileSync(join(dir, file), text);
		delete process.env.JPWB_ASSURANCE_TOOL;
		process.env.PATH = noProgramsDirectory();
		process.env.JPWB_REPLAY = dir;
		// ⛔ An injected print that would REJECT is never asked: the replay is the reviewer.
		const { review, exchanges } = await floorOver(async () => {
			throw new Error('the injected print outranked the replay');
		});
		expect(review?.disposition).toBe('SATISFIED');
		const records = exchanges.drain();
		expect(
			records.map((r) => [r.exchangeRole, r.disposition, r.requestedAt, r.respondedAt])
		).toEqual([
			['initial', 'no-response', at(0), at(1_000)],
			['retry', 'accepted', at(1_000), at(1_005)]
		]);
		// The answered call names the recorded evaluator, graded HOST_CONFIGURED; the thrown one, the recording's reviewer.
		expect(records[1]!.resolvedModelIdentity).toEqual({
			kind: 'resolved',
			modelId: REVIEWER.modelId,
			providerId: REVIEWER.providerId,
			evidence: 'HOST_CONFIGURED'
		});

		forgetReplayRuns();
		process.env.JPWB_REPLAY = join(dir, 'no-such-recording');
		const refused = await floorOver();
		expect(refused.review?.disposition).toBe('INCONCLUSIVE');
		expect(JSON.stringify(refused.review)).toContain('REPLAY_RECORDING_REFUSED');
	});

	it('(vii) ⛔ the replay holds the validator to the PRODUCT’s bound, and refuses a recording whose throws that bound would dispose otherwise', async () => {
		const prompt = await promptOf();
		delete process.env.JPWB_ASSURANCE_TOOL;
		process.env.PATH = noProgramsDirectory();
		// ⭑ Two recordings that say their bound was other than devin's 240 000 ms: one ran a 300 000 ms throw once more
		// (a bound of 500 000), one let a 200 000 ms throw stand (a bound of 120 000). Under the product's bound the first
		// is a timeout and the second is retried, so neither is the run this code would make.
		const arrangements = [
			{
				bound: 500_000,
				calls: [
					call(prompt, { status: 'THROWN', message: TRANSPORT }, 300_000),
					call(prompt, { status: 'ANSWERED', text: CLEAN }, 5, { role: 'retry' })
				]
			},
			{
				bound: 120_000,
				calls: [
					call(prompt, { status: 'THROWN', message: TRANSPORT }, 200_000),
					call(prompt, { status: 'ANSWERED', text: CLEAN }, 5)
				]
			}
		];
		for (const { bound, calls } of arrangements) {
			forgetReplayRuns();
			if (dir !== '') rmSync(dir, { recursive: true, force: true });
			dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-bound-'));
			for (const [file, text] of Object.entries(recordingFiles(recordingOf(calls, bound))))
				writeFileSync(join(dir, file), text);
			process.env.JPWB_REPLAY = dir;
			const { review } = await floorOver();
			expect(review?.disposition, `a recording made under a ${bound} ms bound replayed`).toBe(
				'INCONCLUSIVE'
			);
			const said = JSON.stringify(review);
			expect(said).toContain('REPLAY_RECORDING_REFUSED');
			expect(said).toContain('reviewer call 1');
			expect(said).toContain('240000 ms');
		}
	});

	it('(viii) the replayed review is marked as one: its validator is the replay’s, never the live reviewer’s id', async () => {
		const prompt = await promptOf();
		dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-id-'));
		for (const [file, text] of Object.entries(
			recordingFiles(recordingOf([call(prompt, { status: 'ANSWERED', text: CLEAN }, 5)]))
		))
			writeFileSync(join(dir, file), text);
		delete process.env.JPWB_ASSURANCE_TOOL;
		process.env.PATH = noProgramsDirectory();
		process.env.JPWB_REPLAY = dir;
		expect(
			createFloorRegistry({ testMode: true }).get(FLOOR_POLICY_IDS.REASONING_REVIEW)?.validatorId
		).toBe('replay.reasoning-review');
		// ⭑ And the assessment the floor records names it too: the validator writes its own id into its result, which the
		// replay arm rewrites — the registry's id alone would leave the record saying agy reviewed.
		const { review } = await floorOver();
		expect(review?.disposition).toBe('SATISFIED');
		expect(review?.validatorId).toBe('replay.reasoning-review');
	});

	it('(ix) ⭐ the validator’s bound is the PRODUCT’s even where the recording names another, and the throws agree', async () => {
		const prompt = await promptOf();
		// ⭑ The recording says its reviewer declared NO bound, and holds a 1 000 ms throw the run retried — as the product's
		// devin bound (240 000 ms) disposes it. Held to the recording's bound, the throw would stand and the review fail.
		dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-product-bound-'));
		for (const [file, text] of Object.entries(
			recordingFiles(
				recordingOf(
					[
						call(prompt, { status: 'THROWN', message: TRANSPORT }, 1_000),
						call(prompt, { status: 'ANSWERED', text: CLEAN }, 5, { role: 'retry' })
					],
					null
				)
			)
		))
			writeFileSync(join(dir, file), text);
		delete process.env.JPWB_ASSURANCE_TOOL;
		process.env.PATH = noProgramsDirectory();
		process.env.JPWB_REPLAY = dir;
		const { review, exchanges } = await floorOver();
		expect(review?.disposition, 'the recording’s own bound decided the retry').toBe('SATISFIED');
		expect(exchanges.drain().map((r) => r.exchangeRole)).toEqual(['initial', 'retry']);
	});
});
