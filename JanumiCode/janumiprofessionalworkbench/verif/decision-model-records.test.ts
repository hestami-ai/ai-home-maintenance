// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's RECORDS-GENERATION SCRIPT, HELD BEFORE ITS LONG RUN (`REG-D-146`; design §12.6; roadmap
// §9b.5b, Z2 records and control 7) — the script the lead runs outside the gate, about ten hours of free local requests, driven here
// against a local stub of the server (no model): what it writes, that it resumes, and each of its stops.
//   · each entry's questions asked through the product's client, written whole: key, kind, the sha256 of the exact body sent and
//     the score as returned; the model, digest and server version once a file; a review refused before any request recorded so;
//   · the plan printed before the first request: how many, and the time at 16.3 s a request;
//   · step 1's controls asked twice, exactly equal — and a repeat that differs stops the run;
//   · another model loaded refuses the start; a server version changed between entries stops it; a stopped entry writes nothing.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEEDED_REASONING_REVIEW_CRITERIA, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
	scoredAnswer,
	startDecisionModelStub,
	STUB_DIGEST,
	STUB_MODEL,
	STUB_VERSION,
	type DecisionModelStub,
	type StubOptions
} from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import { pwaTypeContentBudget } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { workProductReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { makeRecords, SECONDS_A_REQUEST, type RecordsEntry } from '../scripts/reviewer-qual/decision-model-records.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const DIR = mkdtempSync(join(tmpdir(), 'jpwb-dm-records-'));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));
const stubs: DecisionModelStub[] = [];
afterEach(async () => {
	for (const s of stubs.splice(0)) await s.close();
});
async function stub(o: StubOptions = {}): Promise<DecisionModelStub> {
	const s = await startDecisionModelStub(o);
	stubs.push(s);
	return s;
}

const answer = (text: string): ReasoningReviewInput =>
	workProductReviewInput({ criteria: SEEDED_REASONING_REVIEW_CRITERIA, producingPrompt: 'Summarise the log.', answer: text });
const ENTRIES: readonly RecordsEntry[] = [
	{ kind: 'CASE', id: 'A', input: answer('{"summary":"The log holds 3 records. Each was read."}') },
	{ kind: 'CASE', id: 'B', input: answer('{"summary":"The log is empty."}') }
];
/** A review refused before any request: a part past its room. */
const PAST_THE_ROOM: RecordsEntry = (() => {
	const base = { criteria: SEEDED_REASONING_REVIEW_CRITERIA, framing: 'PWA_TYPE' as const, prompt: 'Author a PWA', narration: '' };
	return { kind: 'PROBE', id: 'P-PAST', input: { ...base, content: 'x'.repeat(pwaTypeContentBudget(base) + 1) } };
})();

let n = 0;
/** A run of the script against `server`, into a file of its own. */
function runOf(server: string, o: { entries?: readonly RecordsEntry[]; controls?: readonly string[]; file?: string } = {}) {
	const log: string[] = [];
	const file = o.file ?? join(DIR, `records-${(n += 1)}.ndjson`);
	return {
		file,
		log,
		go: () =>
			makeRecords({
				server,
				model: STUB_MODEL,
				digest: '733585a9ebb6',
				file,
				set: 'v13',
				entries: o.entries ?? ENTRIES,
				controls: o.controls ?? ['A'],
				log: (line) => log.push(line),
				bounds: { pollMs: 1 }
			})
	};
}
const linesOf = (file: string) => readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
const posts = (s: DecisionModelStub) => s.requests.filter((r) => r.method === 'POST' && !r.body.includes('"state": "unload"'));

describe('⭐ Z2a (D54) — the records script: every question through the product’s client, written whole, on one server version', () => {
	it('⭐ the identity once; each entry’s questions, each body’s sha256 and its score as returned; the control asked twice, equal; the plan first', async () => {
		const s = await stub();
		const r = runOf(s.url);
		const out = await r.go();
		expect(out.stopped).toBeUndefined();
		const [head, ...rest] = linesOf(r.file);
		expect(head).toMatchObject({ kind: 'IDENTITY', set: 'v13', model: STUB_MODEL, digest: STUB_DIGEST, serverVersion: STUB_VERSION });
		expect(rest.map((l) => [l.kind, l.id])).toEqual([
			['CASE', 'A'],
			['CONTROL', 'A'],
			['CASE', 'B']
		]);
		const sent = posts(s);
		const asked = [...(rest[0]!.questions as { bodySha256: string; score: number; key: string; kind: string }[]), ...(rest[2]!.questions as never[])];
		expect(asked.length + (rest[1]!.questions as unknown[]).length, 'every question asked, the control twice').toBe(sent.length);
		const first = rest[0]!.questions as { bodySha256: string; score: number; key: string; kind: string }[];
		expect(first.map((q) => q.bodySha256), 'each body’s sha256, as sent').toEqual(sent.slice(0, first.length).map((p) => sha256(p.body)));
		expect(first.map((q) => q.kind).slice(0, 2)).toEqual(['check', 'check']);
		expect(first.at(-1)!.kind).toBe('statement');
		for (const [i, q] of first.entries()) {
			const scored = scoredAnswer(sent[i]!.body, JSON.parse(sent[i]!.body) as Record<string, unknown>).json as { answers: Record<string, { noul: number }> };
			expect(q.score, 'the score as returned').toBe(scored.answers[q.key]!.noul);
		}
		expect(rest[1]!.questions, 'the control: exactly the first asking').toEqual(rest[0]!.questions);
		const plan = r.log[0]!;
		const planned = sent.length;
		expect(plan).toBe(
			`v13: ${STUB_MODEL} 733585a9ebb6 on Ollama ${STUB_VERSION}; 2 entries, 0 already recorded; ${planned} requests to make, about ${((planned * SECONDS_A_REQUEST) / 3600).toFixed(1)} h at 16.3 s a request`
		);
	});

	it('⭐ it resumes: a second run asks nothing the file holds', async () => {
		const s = await stub();
		const r = runOf(s.url);
		await r.go();
		const before = posts(s).length;
		const again = await runOf(s.url, { file: r.file }).go();
		expect([again.made, posts(s).length - before, again.stopped]).toEqual([0, 0, undefined]);
	});

	it('⭐ a review refused before any request makes none, and is recorded refused', async () => {
		const s = await stub();
		const r = runOf(s.url, { entries: [PAST_THE_ROOM], controls: [] });
		await r.go();
		expect(posts(s)).toEqual([]);
		expect(linesOf(r.file)[1]).toMatchObject({ kind: 'PROBE', id: 'P-PAST', questions: [] });
		expect((linesOf(r.file)[1]!.refused as string).startsWith('This review was not sent')).toBe(true);
	});

	it('⛔ another model loaded: the run does not start — no request, no file', async () => {
		const s = await stub({ others: ['llama3.2:3b'] });
		const r = runOf(s.url);
		const out = await r.go();
		expect(out.stopped).toBe('STOPPED: another model is loaded (llama3.2:3b): the records are made with none');
		expect([posts(s).length, existsSync(r.file)]).toEqual([0, false]);
	});

	it('⛔ the server’s version changed between two entries: the run stops, the second entry unwritten', async () => {
		let versionReads = 0;
		// ⭑ read at the start, by the run before A, by the client asking A, by the client asking A again: then the server is updated.
		const s = await stub({ version: () => ((versionReads += 1) > 4 ? '0.40.16' : STUB_VERSION) });
		const r = runOf(s.url);
		const out = await r.go();
		expect(out.stopped).toMatch(/^STOPPED: before B, the server serves pplx-decider:27b-q4_K_M 733585a9ebb6 on Ollama 0\.40\.16, not the file's 733585a9ebb6 on Ollama 0\.40\.15/);
		expect(linesOf(r.file).map((l) => [l.kind, l.id ?? null])).toEqual([
			['IDENTITY', null],
			['CASE', 'A'],
			['CONTROL', 'A']
		]);
	});

	it('⛔ a control whose repeat differs stops the run, and its repeat is not written', async () => {
		const seen = new Set<string>();
		const s = await stub({
			answer: ({ body, parsed }) => {
				const again = seen.has(body);
				seen.add(body);
				return scoredAnswer(body, parsed, () => (again ? 0.5 : 0.25));
			}
		});
		const r = runOf(s.url, { entries: [ENTRIES[0]!], controls: ['A'] });
		const out = await r.go();
		expect(out.stopped).toBe("STOPPED: A: the control's repeat differs from its first asking");
		expect(linesOf(r.file).map((l) => l.kind)).toEqual(['IDENTITY', 'CASE']);
	});

	it('⛔ a server that refuses a review stops the run, and the entry is not written', async () => {
		const s = await stub({ answer: () => ({ status: 500, json: { error: 'model runner crashed' } }) });
		const r = runOf(s.url);
		const out = await r.go();
		expect(out.stopped).toBe('STOPPED: A: the client refused its review: request c00 was refused: HTTP 500: model runner crashed');
		expect(linesOf(r.file).map((l) => l.kind)).toEqual(['IDENTITY']);
	});
});
