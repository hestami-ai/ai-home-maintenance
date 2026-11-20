// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54's STATIC SOURCE (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-review.md` §12.6,
// revision 9; roadmap §9b.5b, Z2 records and control 7) — the potential indications the gate reads, from the committed records and
// never from a model: each request's body is the product's (`decisionModelBody`, the records' model, the review's material), and
// its score is the record whose body hash is that body's.
// ⛔ Its refusals, each recorded VALIDATOR_EXECUTION_FAILED with its reason and no reviewer call: a request with no record (never a
// fallback score, never 0.00); a body two records score differently (the records contradict themselves); two files whose
// identities disagree; records whose identity is not the one the product is held to (`DECISION_MODEL_RECORDS_IDENTITY`).
// ⛔ No model: the records here are made by the product's own client against the local stub (`decision-model-stub.testing.ts`).
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	createValidatorRegistry,
	FLOOR_POLICY_IDS,
	runFloorAndPlanRecording,
	SEEDED_REASONING_REVIEW_CRITERIA,
	type AssuranceSubject,
	type ReasoningReviewInput
} from '@janumipwb/rph-assurance';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DECISION_MODEL_RECORDS_IDENTITY } from '../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import { startDecisionModelStub, stubScore, STUB_MODEL } from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import { decisionModelBody } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import { refusedRequestReason } from '../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import {
	createAgyReasoningReviewValidator,
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { workProductReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { makeRecords, type RecordsEntry } from '../scripts/reviewer-qual/decision-model-records.js';
import {
	committedRecords,
	committedRecordsIdentity,
	readDecisionModelRecords,
	recordedIndications,
	type DecisionModelRecords
} from '../scripts/reviewer-qual/recorded-indications.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const DIR = mkdtempSync(join(tmpdir(), 'jpwb-recorded-indications-'));
afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
	vi.unstubAllEnvs();
});

const SUBJECT: AssuranceSubject = {
	subjectId: 'art_recorded',
	objectType: 'ARTIFACT',
	semanticVersion: 1,
	isAiProduced: true,
	producer: { actorType: 'AGENT', agentId: 'producer', modelId: 'producer-model', providerId: 'producer-provider' }
};
const answer = (text: string): ReasoningReviewInput =>
	workProductReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, producingPrompt: 'Summarise the log.', answer: text });
const A = answer('{"summary":"The log holds 3 records. Each was read."}');
const B = answer('{"summary":"The log is empty."}');
const UNRECORDED = answer('{"summary":"No record was made of this review."}');

/** ⭐ Records made as D54's are made — the product's own client, the records script's format — against the stub, here. */
async function stubRecords(
	entries: readonly RecordsEntry[],
	name: string,
	version: string = DECISION_MODEL_RECORDS_IDENTITY.serverVersion
): Promise<string> {
	const stub = await startDecisionModelStub({ digest: DECISION_MODEL_RECORDS_IDENTITY.digest, version });
	try {
		const file = join(DIR, `${name}.ndjson`);
		const out = await makeRecords({
			server: stub.url,
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
	} finally {
		await stub.close();
	}
}
const ENTRIES: readonly RecordsEntry[] = [
	{ kind: 'CASE', id: 'A', input: A },
	{ kind: 'CASE', id: 'B', input: B }
];
const files = { v13: '', probes: '' };

// ⭐⭐ Z2b (the brief's item 3) — THE PRODUCT'S IDENTITY IS THE COMMITTED RECORDS': `DECISION_MODEL_RECORDS_IDENTITY` — the identity the
// client is held to and the pointer hashes — equals the IDENTITY lines of both committed files, read by the static source itself.
// ⚠ Until D54's records are committed this is red, the records absent: it waits for them (package Z2b, phase 2).
describe('⭐ Z2b — the committed records are the ones the product is held to', () => {
	it('⭐ both committed files read, and their identity is `DECISION_MODEL_RECORDS_IDENTITY`', () => {
		expect(committedRecordsIdentity()).toEqual({ ...DECISION_MODEL_RECORDS_IDENTITY });
	});
});

// ⭐⭐ Z2b (the brief's item 2) — THE RE-SCORING READS THE COMMITTED RECORDS (`rescore.ts`), so a case no committed record holds is not
// re-scorable today: its prompt cannot be rebuilt as a run would build it. ⛔ With the placeholder it was re-scored on 0.00 scores.
describe('⭐ Z2b — the re-scoring reads the committed records, never the placeholder', () => {
	it('⛔ a case no committed record holds is not re-scorable: the records’ own refusal, named', async () => {
		// ⛔ No program can be found from this process: the re-scoring loads the runner (`reviewer-qualification-hermetic.ts`).
		const { NO_PROGRAMS } = await import('./reviewer-qualification-hermetic.js');
		vi.stubEnv('PATH', NO_PROGRAMS);
		const { NotRescorable, rescoreEvaluation } = await import('../scripts/reviewer-qual/rescore.js');
		const { CURRENT_CASE_SET_FILE } = await import('../scripts/reviewer-qual/cases.js');
		const c = (JSON.parse(readFileSync(new URL(`../${CURRENT_CASE_SET_FILE}`, import.meta.url), 'utf8')) as { cases: { id: string; input: { producingPrompt: string } }[] }).cases[0]!;
		// ⭑ The current set's first case (a work product's), its producing prompt changed: a material no record holds.
		const input = c.input;
		const unrecorded = { ...c, id: 'Z2B-UNRECORDED', input: { ...input, producingPrompt: `${input.producingPrompt} No record was made of this review.` } };
		const run = { candidate: { transport: 'stub', agentId: 'stub', provider: 'stub', modelLabel: 'stub' } } as never;
		const out = await rescoreEvaluation(run, unrecorded as never, [], 'x').then(
			() => 'rescored',
			(e: unknown) => e
		);
		expect(out).toBeInstanceOf(NotRescorable);
		expect(String((out as Error).message)).toMatch(/the committed decision-model records are absent|the records hold no score for request/);
	});
});
const read = (...paths: string[]) => readDecisionModelRecords(paths.map((p) => ({ name: p, text: readFileSync(p, 'utf8') })));

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

describe('⭐ Z2b (D54) — the static source answers each request from the records, by its body', () => {
	it('⭐ arrangement: records made by the product’s client against the stub, in the records’ format', async () => {
		files.v13 = await stubRecords(ENTRIES, 'v13');
		files.probes = await stubRecords([{ kind: 'PROBE', id: 'P', input: B }], 'probes');
		expect(readFileSync(files.v13, 'utf8').split('\n')[0]).toContain('"kind":"IDENTITY"');
	});

	it('⭐ every request of a recorded review scored as the record of its body says — the score the client got, exactly', async () => {
		const records = read(files.v13, files.probes);
		expect('refusal' in records ? records.refusal : records.identity).toEqual(DECISION_MODEL_RECORDS_IDENTITY);
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		const source = recordedIndications(records);
		await reviewPrompt(A, async (requests, material) => {
			asked = { requests, material };
			return source(requests, material);
		});
		const result = await source(asked!.requests, asked!.material);
		expect('scores' in result && result.scores).toEqual(
			Object.fromEntries(asked!.requests.map((r) => [r.key, stubScore(decisionModelBody(STUB_MODEL, asked!.material, r))]))
		);
		const { prompts, failed } = await reviewed(A, source);
		expect([prompts.length, failed]).toEqual([1, []]);
	});

	it('⛔ a request no record holds refuses the review, naming it: no fallback score, no reviewer call', async () => {
		const source = recordedIndications(read(files.v13, files.probes));
		const { prompts, failed } = await reviewed(UNRECORDED, source);
		expect(prompts, 'no reviewer call').toEqual([]);
		expect(failed).toHaveLength(1);
		expect(failed[0]).toMatch(/^This review was not sent: its potential indications could not be had from the decision model — the records hold no score for request c00 \(its body [0-9a-f]{12}…\)/);
	});

	it('⛔ two records scoring one body differently refuse every request of that body: the records contradict themselves', async () => {
		const lines = readFileSync(files.v13, 'utf8').trimEnd().split('\n');
		const a = JSON.parse(lines[1]!) as { questions: { score: number }[] };
		a.questions[0]!.score = a.questions[0]!.score === 0.5 ? 0.25 : 0.5;
		const forked = join(DIR, 'forked.ndjson');
		writeFileSync(forked, `${[lines[0], JSON.stringify({ ...a, id: 'A-again' }), ...lines.slice(1)].join('\n')}\n`, 'utf8');
		const { prompts, failed } = await reviewed(A, recordedIndications(read(forked)));
		expect(prompts).toEqual([]);
		expect(failed[0]).toMatch(/the records hold two scores for request c00’s body [0-9a-f]{12}…: they contradict themselves/);
	});

	it('⛔ files whose identities disagree, or records of an identity the product is not held to, are refused, never read', async () => {
		const lines = readFileSync(files.probes, 'utf8').trimEnd().split('\n');
		const head = JSON.parse(lines[0]!) as Record<string, unknown>;
		const other = join(DIR, 'other.ndjson');
		writeFileSync(other, `${[JSON.stringify({ ...head, serverVersion: '0.40.16' }), ...lines.slice(1)].join('\n')}\n`, 'utf8');
		const disagree = read(files.v13, other);
		expect('refusal' in disagree && disagree.refusal).toMatch(/^the records disagree on their identity: .*v13\.ndjson.* 0\.40\.15.*other\.ndjson.* 0\.40\.16/);
		const alone = read(other);
		expect('refusal' in alone && alone.refusal).toMatch(
			/^the records were made on pplx-decider:27b-q4_K_M 733585a9ebb6 on Ollama 0\.40\.16, not the identity the product is held to: pplx-decider:27b-q4_K_M 733585a9ebb6 on Ollama 0\.40\.15 \(D51; REG-F-608\)/
		);
		const { prompts, failed } = await reviewed(A, recordedIndications(alone));
		expect([prompts.length, failed[0]?.includes('not the identity the product is held to')]).toEqual([0, true]);
	});

	it('⛔ no records at all, or a file with no identity line first, is refused with its reason', () => {
		expect(readDecisionModelRecords([])).toEqual({ refusal: 'no decision-model records were found (D54)' });
		const r = readDecisionModelRecords([{ name: 'x.ndjson', text: '{"kind":"CASE","id":"A","questions":[]}\n' }]);
		expect('refusal' in r && r.refusal).toBe('x.ndjson does not begin with its IDENTITY line (D54)');
		// ⭑ And a first line that carries an identity's fields but is no IDENTITY line: its kind is read, not only its fields.
		const { model, digest, serverVersion } = DECISION_MODEL_RECORDS_IDENTITY;
		const posing = readDecisionModelRecords([{ name: 'y.ndjson', text: `${JSON.stringify({ kind: 'CASE', id: 'A', model, digest, serverVersion, questions: [] })}\n` }]);
		expect('refusal' in posing && posing.refusal).toBe('y.ndjson does not begin with its IDENTITY line (D54)');
		expect(sha256('')).toHaveLength(64);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L17b2 — §20 (the sponsor's choice, *"Record on 0.40.16, labelled"*) — THE RECORDS' SECOND FILE, READ
// UNDER ITS OWN IDENTITY. The original files are read as before, under `DECISION_MODEL_RECORDS_IDENTITY`: the tests above hold that any
// other identity among them is refused, never read — the old promise, unchanged. Beside them, one file, `probes-0.40.16.ndjson`: the
// records' model and digest on server version 0.40.16, and nothing else. It is refused, never read, where its model, its digest or its
// version is another; where it holds a body another file holds; and where a further file appears beside the three. Each score the
// reader gives carries the server version of the file that holds it.
describe('⭐⭐ L17b2 (§20) — the records’ second file, labelled 0.40.16, read under its own identity', () => {
	const LABELLED = 'probes-0.40.16.ndjson';
	const FOLDER = 'docs/tracking/reviewer-qualification/decision-model/';
	const ON_16 = { ...DECISION_MODEL_RECORDS_IDENTITY, serverVersion: '0.40.16' };
	const made = { v13: '', probes: '', u: '', a: '' };
	const asText = (p: string, name: string = p) => ({ name, text: readFileSync(p, 'utf8') });
	const originals = () => [asText(made.v13), asText(made.probes)];
	/** The body hashes a review asks, by the records' model. */
	const bodiesOf = async (input: ReasoningReviewInput): Promise<string[]> => {
		let out: string[] = [];
		await reviewPrompt(input, async (requests, material) => {
			out = requests.map((r) => sha256(decisionModelBody(STUB_MODEL, material, r)));
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
		return out;
	};
	/** The second file with its IDENTITY line's `field` set to `value`. */
	const relabelled = (field: string, value: string) => {
		const [head, ...rest] = readFileSync(made.u, 'utf8').trimEnd().split('\n');
		return { name: LABELLED, text: `${[JSON.stringify({ ...(JSON.parse(head!) as object), [field]: value }), ...rest].join('\n')}\n` };
	};
	/** The three readers' views of one call: the read's refusal, or the word 'read'. */
	const outcome = (r: ReturnType<typeof readDecisionModelRecords>): string => ('refusal' in r ? r.refusal : 'read');
	/** `readDecisionModelRecords`, handed the second file as its third argument (§20's form). */
	const readWith = (labelled: { name: string; text: string }) =>
		(readDecisionModelRecords as (...a: unknown[]) => ReturnType<typeof readDecisionModelRecords>)(originals(), DECISION_MODEL_RECORDS_IDENTITY, labelled);

	it('⭐ arrangement: the original files on the product’s identity; the second file on 0.40.16, made by the same client against the stub', async () => {
		made.v13 = await stubRecords(ENTRIES, 'l17b2-v13');
		made.probes = await stubRecords([{ kind: 'PROBE', id: 'P', input: B }], 'l17b2-probes');
		made.u = await stubRecords([{ kind: 'PROBE', id: 'U', input: UNRECORDED }], 'l17b2-labelled-u', '0.40.16');
		made.a = await stubRecords([{ kind: 'PROBE', id: 'A', input: A }], 'l17b2-labelled-a', '0.40.16');
		expect(JSON.parse(readFileSync(made.u, 'utf8').split('\n')[0]!)).toMatchObject({ kind: 'IDENTITY', ...ON_16 });
	});

	it('⛔ RED FIRST — accepted under its own identity: a review only it holds is sent, and each score carries the server version of its file', async () => {
		const records = readWith(asText(made.u, LABELLED));
		expect.soft(outcome(records), 'the records read').toBe('read');
		const r = records as unknown as {
			identity?: unknown;
			labelled?: unknown;
			scoreVersions?: ReadonlyMap<string, string>;
		};
		expect.soft(r.identity, 'the originals’ identity, the product’s').toEqual(DECISION_MODEL_RECORDS_IDENTITY);
		expect.soft(r.labelled, 'the second file, by its name and its identity').toEqual({ name: LABELLED, identity: ON_16 });
		const [a, u] = [await bodiesOf(A), await bodiesOf(UNRECORDED)];
		expect.soft(a.map((s) => r.scoreVersions?.get(s)), 'the originals’ scores, each on 0.40.15').toEqual(a.map(() => '0.40.15'));
		expect.soft(u.map((s) => r.scoreVersions?.get(s)), 'the second file’s scores, each on 0.40.16').toEqual(u.map(() => '0.40.16'));
		const { prompts, failed } = await reviewed(UNRECORDED, recordedIndications(records));
		expect.soft([prompts.length, failed], 'the review only the second file holds, sent').toEqual([1, []]);
	});

	it('⛔ RED FIRST — refused, never read, where its identity is another: its model, its digest, or a server version but its label’s', () => {
		const otherDigest = `${DECISION_MODEL_RECORDS_IDENTITY.digest.slice(0, 12)}${'f'.repeat(52)}`;
		for (const [field, value] of [
			['model', 'another-model:7b'],
			['digest', otherDigest],
			['serverVersion', '0.40.17'],
			['serverVersion', DECISION_MODEL_RECORDS_IDENTITY.serverVersion]
		] as const) {
			const r = readWith(relabelled(field, value));
			expect.soft(outcome(r), `${field} ${value}: refused`).toContain(`${LABELLED} was made on `);
			expect.soft(outcome(r), `${field} ${value}: the identity it is held to, named`).toContain(
				`not the identity its label names: ${ON_16.model} ${ON_16.digest} on Ollama 0.40.16`
			);
			expect.soft(outcome(r), `${field} ${value}: its own value, named`).toContain(value);
		}
	});

	it('⛔ RED FIRST — refused, never read, where it holds a body another file holds', () => {
		const r = readWith(asText(made.a, LABELLED));
		expect.soft(outcome(r)).toMatch(/^probes-0\.40\.16\.ndjson holds a body another file holds: [0-9a-f]{12}… in .*l17b2-v13\.ndjson/);
	});

	it('⛔ RED FIRST — the committed folder: the second file read beside the originals, and a further file refused, never read', () => {
		const root = join(DIR, 'l17b2-root');
		const folder = join(root, ...FOLDER.split('/').filter((s) => s !== ''));
		mkdirSync(folder, { recursive: true });
		copyFileSync(made.v13, join(folder, 'v13.ndjson'));
		copyFileSync(made.probes, join(folder, 'probes.ndjson'));
		copyFileSync(made.u, join(folder, LABELLED));
		const url = pathToFileURL(`${root}/`);
		const read = committedRecords(url);
		expect.soft(outcome(read), 'the three files read').toBe('read');
		expect.soft((read as { labelled?: unknown }).labelled, 'the second file among them').toEqual({ name: `${FOLDER}${LABELLED}`, identity: ON_16 });
		copyFileSync(made.u, join(folder, 'probes-0.40.17.ndjson'));
		const further = committedRecords(url);
		expect.soft(outcome(further), 'a further file, refused').toContain(`the records folder holds a further file: ${FOLDER}probes-0.40.17.ndjson`);
	});

	// ⭐⭐ §22 (the lead's reading of `withLabelledFile`) — AN ENTRY'S REFUSAL IS ITS REVIEW'S: the refusal the product meets first. An original
	// set asks a review whole, from its first request to the client's first refusal; the second set asks only the bodies no file held, so
	// its line for an entry is the review's tail. The records run made two such lines (`W-OVERSIZE-EDGES`, `P-OVERSIZE-FENCES`): the
	// originals hold each review refused at `c00`, and the second file a refusal at `c01`, a body after it the product never sends. Here the
	// same shape on review A, built by hand: the originals refuse its first request, the second file its second.
	it('⛔ RED FIRST — an entry the originals record refused at its first request keeps their words: the second file’s refusal of a later request is no refusal of the entry’s review (§22)', async () => {
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		await reviewPrompt(A, async (requests, material) => {
			asked = { requests, material };
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
		const [first, second] = asked!.requests;
		const response = '{"error":"text and schema must not exceed 64 KiB"}';
		const refusedAt = (r: IndicationRequest) => ({
			kind: 'PROBE',
			id: 'E',
			questions: [],
			refusedRequest: { key: r.key, kind: r.kind, bodySha256: sha256(decisionModelBody(STUB_MODEL, asked!.material, r)), status: 413, response }
		});
		const fileOf = (identity: object, line: object) => `${JSON.stringify({ kind: 'IDENTITY', set: 'by-hand', ...identity })}\n${JSON.stringify(line)}\n`;
		const records = readDecisionModelRecords(
			[{ name: 'original.ndjson', text: fileOf(DECISION_MODEL_RECORDS_IDENTITY, refusedAt(first!)) }],
			DECISION_MODEL_RECORDS_IDENTITY,
			{ name: LABELLED, text: fileOf(ON_16, refusedAt(second!)) }
		);
		expect(outcome(records), 'arrangement: the two files read').toBe('read');
		const words = refusedRequestReason(first!.key, 413, response);
		const met = await recordedIndications(records)(asked!.requests, asked!.material);
		expect('refusal' in met ? met.refusal : '', 'the control: the review is refused at its first request, as the product meets it').toBe(words);
		expect
			.soft('refusal' in records ? undefined : records.refusedEntries.get('PROBE E'), 'the entry’s words: its review’s refusal, not the second file’s later request')
			.toBe(words);
	});

	// ⭐⭐ §24 ruling 1 — THE SECOND FILE GIVES THE READER BODIES ALONE: its scores, each on its version, and its refused requests, by body.
	// A line of it records requests, not a review (its set asks only bodies no file holds, and each body once across entries), so its lines
	// join neither `entries` nor `refusedEntries`; and the file is the probes', so a line of any other kind refuses the whole read.
	/** Review A's requests and material, asked of no model, and a request's body hash by the records' model. */
	const reviewA = async () => {
		let asked: { requests: readonly IndicationRequest[]; material: string } | undefined;
		await reviewPrompt(A, async (requests, material) => {
			asked = { requests, material };
			return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
		});
		return { ...asked!, body: (r: IndicationRequest) => sha256(decisionModelBody(STUB_MODEL, asked!.material, r)) };
	};
	const fileWith = (identity: object, ...lines: object[]) =>
		`${[JSON.stringify({ kind: 'IDENTITY', set: 'by-hand', ...identity }), ...lines.map((l) => JSON.stringify(l))].join('\n')}\n`;
	const ORIGINAL = { name: 'original.ndjson', text: fileWith(DECISION_MODEL_RECORDS_IDENTITY, { kind: 'PROBE', id: 'P0', questions: [] }) };

	it('⛔ RED FIRST — §24 ruling 1: a PROBE id only the second file holds joins neither `entries` nor `refusedEntries`; its score, its version and its refused request are read', async () => {
		const a = await reviewA();
		const [first, second] = a.requests;
		const line = {
			kind: 'PROBE',
			id: 'ONLY-SECOND',
			questions: [{ key: first!.key, kind: first!.kind, bodySha256: a.body(first!), score: 0.25 }],
			refusedRequest: { key: second!.key, kind: second!.kind, bodySha256: a.body(second!), status: 413, response: '{"error":"text and schema must not exceed 64 KiB"}' }
		};
		const records = readDecisionModelRecords([ORIGINAL], DECISION_MODEL_RECORDS_IDENTITY, { name: LABELLED, text: fileWith(ON_16, line) });
		expect(outcome(records), 'arrangement: the two files read').toBe('read');
		const r = records as DecisionModelRecords;
		expect.soft(r.entries.has('PROBE ONLY-SECOND'), 'the second file’s id among the entries').toBe(false);
		expect.soft(r.refusedEntries.has('PROBE ONLY-SECOND'), 'the second file’s id among the refused entries').toBe(false);
		expect.soft(r.entries.has('PROBE P0'), 'the control: the originals’ id among the entries').toBe(true);
		expect.soft(r.scores.get(a.body(first!)), 'its score, read').toBe(0.25);
		expect.soft(r.scoreVersions.get(a.body(first!)), 'on its version').toBe('0.40.16');
		expect.soft(r.refused.get(a.body(second!))?.key, 'its refused request, by body').toBe(second!.key);
	});

	it('⛔ RED FIRST — §24 ruling 1: a line of the second file of any kind but PROBE refuses the whole read, naming the line — a CASE line, and a CONTROL line', async () => {
		const a = await reviewA();
		const [first] = a.requests;
		const probe = { kind: 'PROBE', id: 'Q', questions: [{ key: first!.key, kind: first!.kind, bodySha256: a.body(first!), score: 0.5 }] };
		for (const kind of ['CASE', 'CONTROL'] as const) {
			const r = readDecisionModelRecords([ORIGINAL], DECISION_MODEL_RECORDS_IDENTITY, {
				name: LABELLED,
				text: fileWith(ON_16, probe, { kind, id: 'Q', questions: [] })
			});
			expect.soft(outcome(r), `a ${kind} line`).toBe(
				`${LABELLED} line 3 is a ${kind} line: the second file holds probe questions alone, and every case is scored from the originals (D54; §24 ruling 1)`
			);
		}
		const control = readDecisionModelRecords([ORIGINAL], DECISION_MODEL_RECORDS_IDENTITY, { name: LABELLED, text: fileWith(ON_16, probe) });
		expect.soft(outcome(control), 'the control: its PROBE lines alone, read').toBe('read');
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 2 — the lead's ruling 3 (b) on phase 1's departure 1 — THE HISTORY SOURCE
// STAYS TESTS-ONLY. `verif/reviewer-qualification-history.ts` answers a body no record holds with 0, as the placeholder did; the
// product, the gate's check, the re-scoring and the qualification CLI must refuse such a body (D54). The repository's dependency
// rules (`.dependency-cruiser.cjs`) hold the packages' graph and say nothing of `verif/`, and no lint rule names it, so this row is
// what keeps it out: no file outside `verif/` imports it, by any form of import. ⭑ Its control: the same walk finds the six
// `vi.mock` factories and the refusals test, so a walk that read nothing could not pass.
describe('⭐ Z2b phase 2 — the history source (tests only) is imported by no file outside verif/', () => {
	const ROOT = new URL('../', import.meta.url);
	const SKIP = new Set(['node_modules', 'dist', '.svelte-kit', '.turbo', 'coverage', 'test-results', 'build']);
	const SOURCE = /\.(?:ts|js|mjs|cjs|svelte)$/;
	const walk = (dir: string): string[] =>
		readdirSync(new URL(dir, ROOT), { withFileTypes: true }).flatMap((e) =>
			e.isDirectory() ? (SKIP.has(e.name) ? [] : walk(`${dir}${e.name}/`)) : SOURCE.test(e.name) ? [`${dir}${e.name}`] : []
		);
	/** Any import of it by a specifier naming the file — a statement at a line’s start (`import … from`, a bare `import`,
	 * `export … from`), or `import(…)` or `require(…)` anywhere: so a mutation's text the ledger holds in a string is no import. */
	const IMPORTS = /^\s*(?:import|export)\b[^;]*?['"][^'"\n]*reviewer-qualification-history(?:\.[jt]s)?['"]|\bimport\s*\(\s*['"`][^'"`\n]*reviewer-qualification-history|\brequire\s*\(\s*['"`][^'"`\n]*reviewer-qualification-history/m;
	const importers = (dirs: readonly string[]): string[] => dirs.flatMap(walk).filter((f) => IMPORTS.test(readFileSync(new URL(f, ROOT), 'utf8')));

	it('⛔ no file of apps/, packages/ or scripts/ imports the history source — and the same walk finds its importers in verif/', () => {
		expect(importers(['apps/', 'packages/', 'scripts/']), 'files outside verif/ that import the history source').toEqual([]);
		const inside = importers(['verif/']);
		expect(inside, 'the control: the walk reaches verif/’s importers').toEqual(
			expect.arrayContaining(['verif/reviewer-qualification-fingerprint.test.ts', 'verif/decision-model-refusals.test.ts'])
		);
		expect(inside.length, 'the six vi.mock factories and the refusals test').toBeGreaterThanOrEqual(7);
	});
});
