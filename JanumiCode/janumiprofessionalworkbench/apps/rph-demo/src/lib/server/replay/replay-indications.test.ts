// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — A REPLAY SERVES ITS RECORDED INDICATIONS (`REG-D-146`; design §12.3, D51's record;
// package Z1's departure 10; the Z2b brief's item 7).
//   · The recording holds each decision-model request of the run (`RECORDING_FILES.indications`): its key, the model, the hash of
//     its body with every string in it scrubbed (`indicationBodySha256`), and its score — or why it got none. Step 1's unload
//     request asks no question, and is not among them.
//   · ⭐ The replay's decision model (`ReplayRun.indications`) answers each request of a replayed review from the recorded requests,
//     in the order the run made them, each matched by its body: the body the product builds for it (`decisionModelBody`, the
//     recorded model, the review's material), scrubbed, must hash to the recorded one.
//   · ⛔ A request with no recorded exchange — past the recording's last, or not the body recorded in its place — refuses the
//     replayed review before any reviewer call, and poisons the replay, as every arm's mismatch does; a recorded request that got
//     no score refuses it too, naming why.
// ⭑ PREDICTED RED, WRITTEN FIRST: before Z2b a recording held no decision-model request, and a replay carried no decision model,
// so every replayed review was refused before its first call (`NO_INDICATIONS_SOURCE_STATEMENT`).
// ⛔ HERMETIC: every score and every reply is the recording's; nothing is spawned, no model is asked.
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ValidatorContext
} from '@janumipwb/rph-assurance';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearingJudgement } from '../assurance/clearing-reviewer.testing.js';
import { decisionModelBody } from '../assurance/decision-model-request.js';
import {
	createAgyReasoningReviewValidator,
	type IndicationsSource,
	type IndicationRequest
} from '../assurance/reasoning-review-validator.js';
import {
	indicationBodySha256,
	readRecording,
	RECORDING_FILES,
	RECORDING_FORMAT,
	recordingFiles,
	SCRUB_TOKENS,
	sha256Hex,
	type RecordedIndication,
	type Recording
} from './recording.js';
import { createReplayRun, type ReplayRun } from './replay-run.js';
import { fixtureManifest } from './replay-fixture.testing.js';

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_replayed_indications',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'execution.model-invocation', modelId: 'fixture-executor-model', providerId: 'fixture-provider' }
};
const CTX: ValidatorContext = {
	reasoningReview: {
		criteria: SEEDED_REASONING_REVIEW_CRITERIA,
		framing: 'WORK_PRODUCT',
		prompt: 'Write the requirements for wordfreq.',
		content: '{"requirements":["R1: it counts words","R2: it ignores case"]}',
		narration: ''
	}
};
const CLEAN = clearingJudgement(SEEDED_REASONING_REVIEW_CRITERIA);
const REVIEWER = { agentId: 'devin', modelId: 'fixture-reviewer-model', providerId: 'devin' } as const;
const MODEL = 'pplx-decider:27b-q4_K_M';
const identity = (s: string): string => s;

/** The run's decision model: each request scored by its body's own bytes, as the stub scores them — and every body it built. */
function runSource(): { readonly source: IndicationsSource; readonly asked: { request: IndicationRequest; body: string; score: number }[] } {
	const asked: { request: IndicationRequest; body: string; score: number }[] = [];
	return {
		asked,
		source: async (requests, material) => {
			const scores: Record<string, number> = {};
			for (const r of requests) {
				const body = decisionModelBody(MODEL, material, r);
				const score = parseInt(sha256Hex(body).slice(0, 8), 16) / 2 ** 32;
				asked.push({ request: r, body, score });
				scores[r.key] = score;
			}
			return { scores };
		}
	};
}

/** The run, recorded: the prompt its review sent, and its decision-model requests as the recorder keeps them. */
async function theRun(): Promise<{ readonly prompt: string; readonly indications: RecordedIndication[] }> {
	const run = runSource();
	const sent: string[] = [];
	await createAgyReasoningReviewValidator({
		indications: run.source,
		print: async (p) => {
			sent.push(p);
			return CLEAN;
		},
		modelId: REVIEWER.modelId
	}).evaluate(SUBJECT, CTX);
	return {
		prompt: sent[0]!,
		indications: run.asked.map((a) => ({
			key: a.request.key,
			model: MODEL,
			bodySha256: indicationBodySha256(a.body, identity),
			outcome: { kind: 'SCORED', score: a.score }
		}))
	};
}

const recordingOf = (prompt: string, indications: readonly RecordedIndication[]): Recording => ({
	manifest: {
		format: RECORDING_FORMAT,
		commit: 'fixture-commit',
		reviewerFingerprint: 'fixture-fingerprint',
		...fixtureManifest(),
		models: {
			executor: { agentId: 'execution.model-invocation', modelId: 'fixture-executor-model', providerId: 'fixture-provider' },
			reviewer: { ...REVIEWER, callBoundMs: 480_000 }
		},
		scrub: { tokens: [...SCRUB_TOKENS] },
		expectedMatrix: []
	},
	executor: [],
	commands: [],
	reviewer: [
		{
			unit: 'requirements',
			framing: 'work-product',
			role: 'initial',
			promptSha256: sha256Hex(prompt),
			prompt,
			reply: { status: 'ANSWERED', text: CLEAN },
			evaluator: { ...REVIEWER },
			elapsedMs: 1_000
		}
	],
	indications
});

/** A review through the product's validator as the floor's REPLAY arm builds it on `run`: its own decision model and print. */
async function replayedReview(run: ReplayRun) {
	const registry = createValidatorRegistry();
	registry.register(
		createAgyReasoningReviewValidator({
			print: run.reviewerPrint,
			clock: run.clock,
			indications: run.indications,
			agentId: REVIEWER.agentId,
			modelId: REVIEWER.modelId,
			providerId: REVIEWER.providerId,
			callBoundMs: 480_000
		})
	);
	const plan = await runFloorAndPlanRecording(SUBJECT, CTX, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return {
		result: review.disposition,
		failed: review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement),
		reviewerCalls: run.consumed().reviewer
	};
}

const made: string[] = [];
afterEach(() => {
	for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('⭐⭐ Z2b (item 7) — a replay serves its recorded indications, matched by body', () => {
	it('⭐ arrangement: the run asked one question a check and a statement, and its prompt quotes their scores', async () => {
		const { prompt, indications } = await theRun();
		expect(indications.length, 'the run’s requests').toBeGreaterThan(SEEDED_REASONING_REVIEW_CRITERIA.length);
		expect(new Set(indications.map((i) => i.bodySha256)).size, 'each request its own body').toBe(indications.length);
		expect(prompt).toContain('POTENTIAL INDICATIONS FROM A DECISION MODEL');
	});

	it('⭐ the recording holds them: written and read back whole, in the order the run made them', async () => {
		const { prompt, indications } = await theRun();
		const recording = recordingOf(prompt, indications);
		const dir = mkdtempSync(join(tmpdir(), 'jpwb-replay-indications-'));
		made.push(dir);
		const files = recordingFiles(recording);
		expect(Object.keys(files), 'the recording’s files').toContain(RECORDING_FILES.indications);
		for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
		expect(readRecording(dir).indications).toEqual(indications);
	});

	it('⭐ the replayed review is answered from them: the prompt the run sent, its one recorded reply, SATISFIED', async () => {
		const { prompt, indications } = await theRun();
		const out = await replayedReview(createReplayRun(recordingOf(prompt, indications)));
		expect(out.failed, 'no refusal').toEqual([]);
		expect(out.result).toBe('SATISFIED');
		expect(out.reviewerCalls, 'the recorded reply, served to the recorded prompt').toBe(1);
	});

	it('⛔ a request with no recorded exchange — past the last — refuses the replayed review before any reviewer call', async () => {
		const { prompt, indications } = await theRun();
		const run = createReplayRun(recordingOf(prompt, indications.slice(0, -1)));
		const out = await replayedReview(run);
		expect(out.reviewerCalls, 'no reviewer call').toBe(0);
		expect(out.failed).toHaveLength(1);
		expect(out.failed[0]).toContain(`REPLAY_EXHAUSTED: decision-model request ${indications.length} (${indications.at(-1)!.key}) was asked for`);
		expect(run.poisonedBy()?.code, 'the replay is poisoned, as by any arm’s mismatch').toBe('REPLAY_EXHAUSTED');
	});

	it('⛔ a request whose body is not the one recorded in its place refuses it too, naming both hashes — matched by body, never by order alone', async () => {
		const { prompt, indications } = await theRun();
		const swapped = [indications[1]!, indications[0]!, ...indications.slice(2)];
		const run = createReplayRun(recordingOf(prompt, swapped));
		const out = await replayedReview(run);
		expect(out.reviewerCalls, 'no reviewer call').toBe(0);
		expect(out.failed[0]).toContain(
			`REPLAY_STALE: decision-model request 1 (${indications[0]!.key}): its body hashes to ${indications[0]!.bodySha256}, and the recording holds ${indications[1]!.bodySha256} in its place`
		);
		expect(run.poisonedBy()?.code).toBe('REPLAY_STALE');
		// ⭑ And under the request's own key, a body recorded for another material: refused the same — the key is not the match.
		const other = indicationBodySha256(decisionModelBody(MODEL, 'Another material.\n', { kind: 'check', key: indications[0]!.key, id: 'RR-01', label: 'x' }), identity);
		const sameKey = createReplayRun(recordingOf(prompt, [{ ...indications[0]!, bodySha256: other }, ...indications.slice(1)]));
		const again = await replayedReview(sameKey);
		expect(again.reviewerCalls, 'no reviewer call').toBe(0);
		expect(again.failed[0]).toContain(`its body hashes to ${indications[0]!.bodySha256}, and the recording holds ${other} in its place`);
	});

	it('⛔ a recorded request that got no score refuses the replayed review, naming why the run got none', async () => {
		const { prompt, indications } = await theRun();
		const failed: RecordedIndication = { ...indications[2]!, outcome: { kind: 'FAILED', reason: 'the request took more than 120 s (D51)' } };
		const out = await replayedReview(createReplayRun(recordingOf(prompt, [...indications.slice(0, 2), failed, ...indications.slice(3)])));
		expect(out.reviewerCalls, 'no reviewer call').toBe(0);
		expect(out.failed[0]).toContain(
			`decision-model request 3 (${indications[2]!.key}) got no score in the recorded run: the request took more than 120 s (D51)`
		);
	});
});
