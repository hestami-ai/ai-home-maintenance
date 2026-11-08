// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 1b — D54 RESTATED (`REG-D-146`; the lead's decision, ~~to be filed in d48 as~~ filed in d48 as `REG-F-611`;
// `z2b-p1-rulings.md`, "The records run's stop: two probes past the server's 64 KiB limit") — A REQUEST THE DECISION MODEL'S SERVER
// REFUSES AS TOO LARGE (HTTP 413, "text and schema must not exceed 64 KiB") IS RECORDED AS RETURNED, AND EVERY READER REPLAYS IT AS
// THE CLIENT MET IT:
//   · the static source answers a body recorded refused with the client's own refusal words, made by the client's own formatter
//     from the recorded status and the server's answer (`refusedRequestReason`), never a copy of them; a body recorded both scored
//     and refused, or refused twice with two answers, is a contradiction; a refused request is admitted only with status 413 and
//     its body hash;
//   · the history source (tests only) replays it as the static source does;
//   · the stub refuses, as the server does, a request past 64 KiB by the bytes as sent — the lead's inference;
//   · the fingerprint's probes past that limit (`SERVER_REFUSAL_PROBES`) are kept byte for byte, and refused so, each with the
//     statement the validator throws; and the probes under it that reach every branch they reached (`UNDER_THE_LIMIT_SUCCESSORS`)
//     are pinned by their input, each request under the limit by a margin.
// ⭑ GREEN BEFORE THE RECORDS: every record here is made against the local stub, so these rows hold in phase 1b, and their mutants
// are measured now. The fingerprint's own pins of the two refusals wait for the committed records
// (`reviewer-qualification-fingerprint.test.ts`).
// ⛔ No model, and no server but the local stub.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { refusedRequestReason } from '../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import { DECISION_MODEL_RECORDS_IDENTITY } from '../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { decisionModelBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	startDecisionModelStub,
	STUB_MODEL,
	type DecisionModelStub,
	type StubOptions
} from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import {
	createAgyReasoningReviewValidator,
	indicationsRefusedStatement,
	reviewPrompt,
	REASONING_REVIEW_BUDGET,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { workProductReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { makeRecords, type RecordsEntry } from '../scripts/reviewer-qual/decision-model-records.js';
import { canonicalJson } from '../scripts/reviewer-qual/digest.js';
import { PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import * as PROBES from '../scripts/reviewer-qual/probes.js';
import { readDecisionModelRecords, recordedIndications, type RecordsRead } from '../scripts/reviewer-qual/recorded-indications.js';
import { historyIndications } from './reviewer-qualification-history.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const DIR = mkdtempSync(join(tmpdir(), 'jpwb-dm-refusals-'));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));
const stubs: DecisionModelStub[] = [];
afterEach(async () => {
	for (const s of stubs.splice(0)) await s.close();
});
/** The stub, serving the identity the product is held to — so its records are read as the product's would be. */
async function stub(o: StubOptions = {}): Promise<DecisionModelStub> {
	const s = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version: DECISION_MODEL_RECORDS_IDENTITY.serverVersion, ...o });
	stubs.push(s);
	return s;
}

/** The probe set's declarations, read through the module so a missing one is named, not a crash. */
const Z2B = PROBES as unknown as {
	readonly SERVER_REFUSAL_PROBES?: Readonly<Record<string, string>>;
	readonly UNDER_THE_LIMIT_SUCCESSORS?: Readonly<Record<string, readonly string[]>>;
};
const probeInput = (id: string): ReasoningReviewInput => {
	const p = PROBES.FINGERPRINT_PROBES.find((x) => x.id === id);
	if (p === undefined) throw new Error(`${id}: no probe of the set`);
	return p.input(PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult, PRODUCT_SEAMS.declaredPolicies);
};

/** Ollama's answer to a request past its limit (`d46-facts-verbatim.md` V19), and the server's limit, as the API reference states it. */
const TOO_LARGE_ERROR = 'text and schema must not exceed 64 KiB';
const LIMIT = 64 * 1024;
/** ⭐ The margin each successor's requests keep below the limit, as sent: a quarter of it. */
const MARGIN = 16 * 1024;

/** ⭐ Records made as D54's are made — the product's own client, the records script's format — against the stub, here. */
async function stubRecords(entries: readonly RecordsEntry[], name: string, o: StubOptions = {}): Promise<string> {
	const s = await stub(o);
	const file = join(DIR, `${name}.ndjson`);
	const out = await makeRecords({
		server: s.url,
		model: STUB_MODEL,
		digest: DECISION_MODEL_RECORDS_IDENTITY.digest.slice(0, 12),
		file,
		set: name,
		entries,
		controls: [],
		log: () => undefined,
		bounds: { pollMs: 1 }
	});
	if (out.stopped) throw new Error(out.stopped);
	return file;
}
const read = (...paths: string[]): RecordsRead => readDecisionModelRecords(paths.map((p) => ({ name: p, text: readFileSync(p, 'utf8') })));
const linesOf = (path: string): string[] => readFileSync(path, 'utf8').trimEnd().split('\n');

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_refused',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'producer', modelId: 'producer-model', providerId: 'producer-provider' }
};
const answer = (text: string): ReasoningReviewInput =>
	workProductReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, producingPrompt: 'Summarise the log.', answer: text });
const A = answer('{"summary":"The log holds 3 records. Each was read."}');

/** A review through the product's validator with `indications`: its reviewer calls, and the floor's recorded failure. */
async function reviewed(input: ReasoningReviewInput, indications: IndicationsSource) {
	const prompts: string[] = [];
	const registry = createValidatorRegistry();
	registry.register(
		createAgyReasoningReviewValidator({
			print: async (p) => {
				prompts.push(p);
				return JSON.stringify({
					findings: SEEDED_REASONING_REVIEW_CRITERIA.map((c) => ({ criterionId: c.id, failed: false, statement: 'absent' })),
					recommendation: 'SATISFIED'
				});
			},
			modelId: 'jpwb-judge',
			indications
		})
	);
	const plan = await runFloorAndPlanRecording(SUBJECT, { reasoningReview: input }, registry);
	const review = plan.assessments.find((a) => a.policyId === FLOOR_POLICY_IDS.REASONING_REVIEW)!;
	return { prompts, failed: review.observations.filter((o) => o.code === 'VALIDATOR_EXECUTION_FAILED').map((o) => o.statement) };
}
/** A review's requests and material, asked of no model. */
async function askedOf(input: ReasoningReviewInput): Promise<{ readonly requests: readonly IndicationRequest[]; readonly material: string }> {
	let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
	await reviewPrompt(input, async (requests, material) => {
		asked = { requests, material };
		return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
	}).catch(() => undefined);
	if (asked === undefined) throw new Error('the review was refused before any request');
	return asked;
}

/**
 * ⭐ A RECORDS FILE WHOSE ENTRY `A` WAS REFUSED AT ITS REQUEST `key`, by hand, from one the stub scored whole: the questions before it
 * kept, the refused request's key, kind and body hash its own, `response` the server's answer. ⭑ Made so it needs nothing of the
 * records script's own form for a 413, which the script's rows hold (`decision-model-records.test.ts`).
 */
async function refusedAt(key: string, response: string, name: string, extra: Record<string, unknown> = {}): Promise<string> {
	const whole = await stubRecords([{ kind: 'CASE', id: 'A', input: A }], `${name}-whole`);
	const [head, line] = linesOf(whole);
	const entry = JSON.parse(line!) as { questions: { key: string; kind: string; bodySha256: string }[] };
	const at = entry.questions.findIndex((q) => q.key === key);
	expect(at, `arrangement: ${key} is one of A's questions`).toBeGreaterThanOrEqual(0);
	const refused = entry.questions[at]!;
	const file = join(DIR, `${name}.ndjson`);
	const refusedLine = {
		...entry,
		questions: entry.questions.slice(0, at),
		refusedRequest: { key: refused.key, kind: refused.kind, bodySha256: refused.bodySha256, status: 413, response, ...extra }
	};
	writeFileSync(file, `${head}\n${JSON.stringify(refusedLine)}\n`, 'utf8');
	return file;
}
const OLLAMA_413 = JSON.stringify({ error: TOO_LARGE_ERROR });

// ── the stub's limit ───────────────────────────────────────────────────────────────────────────────────────────────────────
// ⭑ PREDICTED RED, WRITTEN FIRST: the stub answers every request, whatever its size, so phase 1's stub-made records scored all 95
// probes (`records-facts.md` §5).
describe('⛔ PREDICTED RED (Z2b phase 1b) — the stub refuses, as the server does, a request past 64 KiB by the bytes as sent', () => {
	/** A POST of exactly `bytes` bytes as sent: JSON, padded. */
	const ofBytes = (bytes: number): string => {
		const bare = JSON.stringify({ model: STUB_MODEL, pad: '' });
		return JSON.stringify({ model: STUB_MODEL, pad: 'x'.repeat(bytes - bare.length) });
	};
	const post = async (s: DecisionModelStub, body: string) => {
		const res = await fetch(`${s.url}/v1/systemone`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
		return { status: res.status, text: await res.text() };
	};

	it('⭐ a request of exactly 64 KiB as sent is answered; one byte more is refused with HTTP 413 and the server’s words', async () => {
		const s = await stub();
		expect(Buffer.byteLength(ofBytes(LIMIT)), 'arrangement: exactly the limit').toBe(LIMIT);
		expect((await post(s, ofBytes(LIMIT))).status, 'at the limit: answered').toBe(200);
		expect(await post(s, ofBytes(LIMIT + 1)), 'one byte past it: refused as the server refuses').toEqual({ status: 413, text: OLLAMA_413 });
	});

	it('⭐ by the bytes as sent, not the text decoded: an escaped body past the limit is refused though its text is not', async () => {
		const s = await stub();
		// ⭑ U+200B (`\u200b`) is six bytes as sent, three as UTF-8 decoded, one code point: past 64 KiB as sent, under it by every decoded measure.
		const bare = JSON.stringify({ model: STUB_MODEL, pad: '' });
		const count = Math.ceil((LIMIT + 1 - bare.length) / 6);
		const body = bare.replace('"pad":""', `"pad":"${'\\u200b'.repeat(count)}"`);
		expect(Buffer.byteLength(body), 'arrangement: past the limit as sent').toBeGreaterThan(LIMIT);
		expect(Buffer.byteLength(JSON.parse(body).pad as string), 'arrangement: under it decoded').toBeLessThan(LIMIT);
		expect((await post(s, body)).status).toBe(413);
	});
});

// ── the static source and the history source ──────────────────────────────────────────────────────────────────────────────
// ⭑ PREDICTED RED, WRITTEN FIRST: the reader knows no refused request, so a refused body is one no record holds — refused, but in the
// static source's own words, not the client's; and the history source answers it 0.
describe('⛔ PREDICTED RED (Z2b phase 1b) — a body recorded refused is answered as the client met it: its own words, from its own formatter', () => {
	it('⭐ the static source refuses the review with the client’s words for the recorded status and answer — exactly W-OVERSIZE-EDGES’s', async () => {
		const file = await refusedAt('c01', OLLAMA_413, 'refused-c01');
		const { prompts, failed } = await reviewed(A, recordedIndications(read(file)));
		expect(prompts, 'no reviewer call').toEqual([]);
		expect(failed).toEqual([indicationsRefusedStatement('request c01 was refused: HTTP 413: text and schema must not exceed 64 KiB')]);
	});

	it('⭐ the words follow the record, through the client’s own formatter — another answer, another key — never a copy of either', async () => {
		const answers = [JSON.stringify({ error: 'the request is too large (65537 bytes)' }), '{"error": 42}', 'not JSON', ''];
		for (const [n, response] of answers.entries()) {
			const file = await refusedAt('c00', response, `refused-c00-${n}`);
			const asked = await askedOf(A);
			const result = await recordedIndications(read(file))(asked.requests, asked.material);
			expect(result, `the client’s own words for ${JSON.stringify(response)}`).toEqual({ refusal: refusedRequestReason('c00', 413, response) });
		}
		expect(refusedRequestReason('c00', 413, '{"error": 42}'), 'arrangement: the formatter names no error that is not text').toBe('request c00 was refused: HTTP 413');
	});

	it('⛔ a body recorded both scored and refused is a contradiction, refused as one', async () => {
		const refused = await refusedAt('c00', OLLAMA_413, 'contradiction');
		const whole = await stubRecords([{ kind: 'CASE', id: 'A', input: A }], 'contradiction-scored');
		const asked = await askedOf(A);
		const result = await recordedIndications(read(refused, whole))(asked.requests, asked.material);
		expect('refusal' in result && result.refusal).toMatch(/^the records hold a refusal and another answer for request c00’s body [0-9a-f]{12}…: they contradict themselves$/);
		// ⭑ And refused twice with two answers: a contradiction too.
		const other = await refusedAt('c00', JSON.stringify({ error: 'another limit' }), 'contradiction-other');
		const twice = await recordedIndications(read(refused, other))(asked.requests, asked.material);
		expect('refusal' in twice && twice.refusal).toMatch(/^the records hold a refusal and another answer for request c00’s body [0-9a-f]{12}…: they contradict themselves$/);
	});

	it('⛔ a refused request is admitted only with status 413 and its body hash — every malformed one refused by name', async () => {
		const malformed: readonly [string, Record<string, unknown>][] = [
			['another status', { status: 500 }],
			['no status', { status: undefined }],
			['no body hash', { bodySha256: 'abc' }],
			['no key', { key: '' }],
			['another kind', { kind: 'question' }],
			['an answer that is no text', { response: 42 }]
		];
		for (const [what, change] of malformed) {
			const file = await refusedAt('c00', OLLAMA_413, `malformed-${what.replaceAll(' ', '-')}`, change);
			const records = read(file);
			expect('refusal' in records && records.refusal, `${what}: refused by name`).toBe(
				`${file} line 2 holds a refused request that is no 413 with its key, kind, body hash and the server’s answer (D54)`
			);
		}
		// ⭑ And a line refused both before any request and at one: no review is both.
		const both = await refusedAt('c00', OLLAMA_413, 'malformed-both');
		const [head, line] = linesOf(both);
		writeFileSync(both, `${head}\n${JSON.stringify({ ...JSON.parse(line!), refused: 'This review was not sent' })}\n`, 'utf8');
		const r = read(both);
		expect('refusal' in r && r.refusal).toBe(
			`${both} line 2 holds a refused request that is no 413 with its key, kind, body hash and the server’s answer (D54)`
		);
		// ⭑ And a refused request whose key its own line also scores: no request is both answered and refused.
		const scoredToo = await refusedAt('c01', OLLAMA_413, 'malformed-scored-too', { key: 'c00' });
		const s = read(scoredToo);
		expect('refusal' in s && s.refusal).toBe(
			`${scoredToo} line 2 holds a refused request that is no 413 with its key, kind, body hash and the server’s answer (D54)`
		);
	});

	it('⭐ the history source (tests only) replays a recorded refusal as the static source does: the client’s words, never 0', async () => {
		const file = await refusedAt('c01', OLLAMA_413, 'history');
		const asked = await askedOf(A);
		const history = await historyIndications(() => read(file))(asked.requests, asked.material);
		const committed = await recordedIndications(read(file))(asked.requests, asked.material);
		expect(history, 'the history source').toEqual({ refusal: 'request c01 was refused: HTTP 413: text and schema must not exceed 64 KiB' });
		expect(history, 'as the static source').toEqual(committed);
	});
});

// ── the fingerprint's probes past the limit, and their successors under it ────────────────────────────────────────────────
// ⭑ PREDICTED RED, WRITTEN FIRST: the probe set declares no probe the server refuses, and no successor under its limit.
describe('⛔ PREDICTED RED (Z2b phase 1b) — the probes past the server’s limit are refusal probes; their successors are sent under it', () => {
	it('⭐ THE TWO PAST 64 KiB AS SENT ARE THE SERVER’S REFUSAL PROBES — kept byte for byte, each refused at its first request', async () => {
		// ⭑ One line a probe: a refusal withdrawn (its record shows answers) is its line struck here and in the map, nothing else.
		expect(Z2B.SERVER_REFUSAL_PROBES, 'the probe set declares the probes the server refuses, each with the request it refuses').toEqual({
			'W-OVERSIZE-EDGES': 'c00',
			'P-OVERSIZE-FENCES': 'c00'
		});
		for (const id of Object.keys(Z2B.SERVER_REFUSAL_PROBES ?? {}))
			expect(sha256(canonicalJson(probeInput(id))), `${id}: its input, byte for byte as at 6b4f6c7b`).toBe(SERVER_REFUSAL_PROBE_INPUT_SHA256[id]);
	});

	it('⭐ each, recorded by the records script against the stub, is refused by the validator with the client’s words — the statement the fingerprint hashes', async () => {
		const ids = Object.keys(Z2B.SERVER_REFUSAL_PROBES ?? {});
		expect(ids.length, 'arrangement: the declared refusal probes').toBeGreaterThan(0);
		const file = await stubRecords(ids.map((id) => ({ kind: 'PROBE' as const, id, input: probeInput(id) })), 'refusal-probes');
		const lines = linesOf(file).slice(1).map((l) => JSON.parse(l) as { id: string; questions: unknown[]; refusedRequest?: { key: string; status: number; response: string } });
		for (const id of ids) {
			const line = lines.find((l) => l.id === id)!;
			const key = Z2B.SERVER_REFUSAL_PROBES![id]!;
			expect([line.questions, line.refusedRequest?.key, line.refusedRequest?.status, line.refusedRequest?.response], `${id}: recorded as the server refused it`).toEqual([
				[],
				key,
				413,
				OLLAMA_413
			]);
			const { prompts, failed } = await reviewed(probeInput(id), recordedIndications(read(file)));
			expect(prompts, `${id}: no reviewer call`).toEqual([]);
			expect(failed, `${id}: the statement the validator throws`).toEqual([
				indicationsRefusedStatement(`request ${key} was refused: HTTP 413: text and schema must not exceed 64 KiB`)
			]);
		}
	});

	it('⭐ EVERY BRANCH A REFUSAL PROBE REACHED IS REACHED BY A SUCCESSOR SENT UNDER THE LIMIT — pinned by its input, every request within a quarter of the limit, answered by the stub', async () => {
		expect(Object.keys(Z2B.UNDER_THE_LIMIT_SUCCESSORS ?? {}), 'successors for each probe past the limit').toEqual(['W-OVERSIZE-EDGES', 'P-OVERSIZE-FENCES']);
		const successors = Object.values(Z2B.UNDER_THE_LIMIT_SUCCESSORS ?? {}).flat();
		expect(successors, 'the successors').toEqual(Object.keys(SUCCESSOR_INPUT_SHA256));
		for (const s of successors) {
			const input = probeInput(s);
			expect(sha256(canonicalJson(input)), `${s}: its input, pinned`).toBe(SUCCESSOR_INPUT_SHA256[s]);
			const asked = await askedOf(input);
			const largest = Math.max(...asked.requests.map((r) => Buffer.byteLength(decisionModelBody(STUB_MODEL, asked.material, r))));
			expect(largest, `${s}: every request under the limit as sent, by a quarter of it`).toBeLessThanOrEqual(LIMIT - MARGIN);
		}
		// ⭑ And sent: the stub, which refuses past the limit, answers every request of each.
		const file = await stubRecords(successors.map((id) => ({ kind: 'PROBE' as const, id, input: probeInput(id) })), 'successors');
		for (const line of linesOf(file).slice(1).map((l) => JSON.parse(l) as { id: string; questions: unknown[] }))
			expect([line.id, 'refusedRequest' in line, line.questions.length > 0], `${line.id}: answered whole`).toEqual([line.id, false, true]);
	});

	it('⭐ W-OVERSIZE-EDGES-SENT stands on both of W-OVERSIZE-EDGES’s edges — its instruction EXACTLY at USER_INTENT_MAX; its kept HEAD declared in code points, astral characters in it', async () => {
		const input = probeInput('W-OVERSIZE-EDGES-SENT');
		expect(input.prompt, 'the instruction, as W-OVERSIZE-EDGES’s').toBe(probeInput('W-OVERSIZE-EDGES').prompt);
		expect(input.prompt.length, 'EXACTLY USER_INTENT_MAX units').toBe(REASONING_REVIEW_BUDGET.USER_INTENT_MAX);
		const prompt = await reviewPrompt(input, async (requests) => ({ scores: Object.fromEntries(requests.map((r) => [r.key, 0])) }));
		const declared = / — the first (\d+) of its (\d+) code points are shown; the last (\d+) are removed\.\]/.exec(
			prompt.split('\n').find((l) => l.startsWith('[CUT FOR THIS REVIEW: the work product'))!
		);
		expect(declared, 'the answer is cut, head only').not.toBeNull();
		const kept = Number(declared![1]);
		const head = [...input.content].slice(0, kept).join('');
		expect(prompt.includes(head), 'the HEAD it declares is the one the prompt carries').toBe(true);
		expect(head.length - kept, 'astral characters in the kept HEAD: its code points and its UTF-16 units differ').toBeGreaterThanOrEqual(3);
	});

	it('⭐ P-OVERSIZE-FENCES-SENT holds every plant of P-OVERSIZE-FENCES, its stdout cut inside each run a reader does not see — and the account’s three lookalikes (REG-F-497 (a))', () => {
		let run: { stdout: string; stderr: string; argv: readonly string[] } | undefined;
		const view = PROBES.FINGERPRINT_PROBES.find((x) => x.id === 'P-OVERSIZE-FENCES-SENT')!.input(PRODUCT_SEAMS.criteria, (source) => {
			run = source.run as never;
			return PRODUCT_SEAMS.processResult(source);
		}).content;
		const original = probeInput('P-OVERSIZE-FENCES');
		const sent = probeInput('P-OVERSIZE-FENCES-SENT');
		expect([sent.prompt, sent.rationale, sent.observedToolCalls], 'its instruction, account and calls, as P-OVERSIZE-FENCES’s').toEqual([
			original.prompt,
			original.rationale,
			original.observedToolCalls
		]);
		const account = [sent.rationale!.rationale, ...sent.rationale!.assumptions, ...sent.rationale!.residualUncertainty].join('\n');
		for (const c of ['\u200b', '\u2076', '\u0415']) expect(account.includes(c), `the account’s lookalike U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).toBe(true);
		const m = / — the first (\d+) \(HEAD\) and the last (\d+) \(TAIL\) of its (\d+) code points are shown/.exec(
			view.split('\n').find((l) => l.startsWith('[CUT FOR THIS REVIEW: stdout'))!
		);
		expect(m, 'stdout is cut, head and tail').not.toBeNull();
		const points = [...run!.stdout];
		const head = points.slice(0, Number(m![1]));
		const tail = points.slice(points.length - Number(m![2]));
		const runAt = (p: readonly string[], from: 'end' | 'start'): number => {
			let n = 0;
			for (const c of from === 'end' ? [...p].reverse() : p) {
				if (c !== '\u200b') break;
				n += 1;
			}
			return n;
		};
		// ⭑ Inside each run, with room on both sides of the cut: so a room moved by less than that keeps each cut inside its run.
		expect(runAt(head, 'end'), 'the HEAD ends inside the first run').toBeGreaterThanOrEqual(256);
		expect(runAt(tail, 'start'), 'the TAIL begins inside the second').toBeGreaterThanOrEqual(256);
		const removed = points.slice(head.length, points.length - tail.length);
		expect(runAt(removed, 'start'), 'the first run goes on past the HEAD').toBeGreaterThanOrEqual(256);
		expect(runAt(removed, 'end'), 'the second run begins before the TAIL').toBeGreaterThanOrEqual(256);
		// ⭑ And its plants decide what P-OVERSIZE-FENCES's decide: the view's own token, `19`, past every plant below it.
		const fenceLines = (v: string): string[] => [...new Set(v.split('\n').filter((l) => /^<<<UNTRUSTED-\d\d>>>$/.test(l)))];
		expect(fenceLines(view), 'the view’s fence, as P-OVERSIZE-FENCES’s').toEqual(fenceLines(original.content));
		expect(fenceLines(view), 'the view’s own token').toEqual(['<<<UNTRUSTED-19>>>']);
	});
});

/** The two probes' inputs as they were at `6b4f6c7b` — the canonical JSON's sha256: kept byte for byte. */
const SERVER_REFUSAL_PROBE_INPUT_SHA256: Readonly<Record<string, string>> = {
	'W-OVERSIZE-EDGES': '2072a851a16f91b4ee79ba8aab6ea6d5d69cfa98e3a44f6e67006c7d11fa8ea6',
	'P-OVERSIZE-FENCES': '077becca3e27c9e37843cc4b9e4db6a3f315f780a9da562c50eaeb98aa429090'
};
/** ⭐ Each successor's input, pinned: the canonical JSON's sha256, so the request the lead records is the one this commit sends. */
const SUCCESSOR_INPUT_SHA256: Readonly<Record<string, string>> = {
	'W-OVERSIZE-EDGES-SENT': 'dfcd3a3521c22a663d3fb8d0f20e1225f6b01b8355db08948661dbc1f7268304',
	'P-OVERSIZE-FENCES-SENT': 'c87e6c8a943ac0e092a67b2421225a3a5604e65d76ffdc78bd1fb49a6145f1a6'
};
