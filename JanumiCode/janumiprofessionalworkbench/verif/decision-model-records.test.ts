// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's RECORDS-GENERATION SCRIPT, HELD BEFORE ITS LONG RUN (`REG-D-146`; design §12.6; roadmap
// §9b.5b, Z2 records and control 7) — the script the lead runs outside the gate, about ten hours of free local requests, driven here
// against a local stub of the server (no model): what it writes, that it resumes, and each of its stops.
//   · each entry's questions asked through the product's client, written whole: key, kind, the sha256 of the exact body sent and
//     the score as returned; the model, digest and server version once a file; a review refused before any request recorded so;
//   · the plan printed before the first request: how many, and the time at 16.3 s a request;
//   · step 1's controls asked twice, exactly equal — and a repeat that differs stops the run;
//   · another model loaded refuses the start; a server version changed between entries stops it; a stopped entry writes nothing.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
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

// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b phase 1b — D54 RESTATED (`REG-D-146`; the lead's decision, ~~to be filed in d48 as~~ filed in d48 as `REG-F-611`;
// `z2b-p1-rulings.md`, "The records run's stop") — A REQUEST THE SERVER REFUSES WITH HTTP 413 IS RECORDED AS RETURNED: the entry's
// line holds the questions answered before it, and the refused request's key, kind, body sha256, status and the server's answer
// as it arrived — at most one, since the client stops a review at its first refusal — and the run goes on. ⛔ Every other refusal
// still stops the run and writes nothing for that entry (the row above). ⭑ The records run stopped so at its 24th probe:
// "STOPPED: W-OVERSIZE-EDGES: the client refused its review: request c00 was refused: HTTP 413: text and schema must not exceed
// 64 KiB" (`records-facts.md` §4).
// ⭑ PREDICTED RED, WRITTEN FIRST: the script has no form for a request the server refuses, so it stops at the first 413.
describe('⛔ PREDICTED RED (Z2b phase 1b; D54 restated) — a request the server refuses with HTTP 413 is recorded as returned', () => {
	/** Ollama's answer to a request past its limit (`d46-facts-verbatim.md` V19). */
	const TOO_LARGE = { status: 413, json: { error: 'text and schema must not exceed 64 KiB' } } as const;

	it('⭐ the questions answered before it, then the refused request — key, kind, body sha256, 413 and the server’s answer — and the run goes on', async () => {
		// ⭑ A's third request refused, as the server refuses a body past its limit; every other request answered.
		const s = await stub({ answer: ({ body, parsed, n }) => (n === 3 ? TOO_LARGE : scoredAnswer(body, parsed)) });
		const r = runOf(s.url, { controls: [] });
		const out = await r.go();
		expect(out.stopped, 'the run goes on past a 413').toBeUndefined();
		const [, a, b] = linesOf(r.file);
		const sent = posts(s);
		expect(a, 'A: the two questions answered before it, scored as returned').toMatchObject({ kind: 'CASE', id: 'A' });
		expect((a!.questions as { key: string; bodySha256: string }[]).map((q) => [q.key, q.bodySha256])).toEqual([
			['c00', sha256(sent[0]!.body)],
			['c01', sha256(sent[1]!.body)]
		]);
		expect(a!.refusedRequest, 'A: the refused request, as the server returned it').toEqual({
			key: 'c02',
			kind: 'check',
			bodySha256: sha256(sent[2]!.body),
			status: 413,
			response: JSON.stringify(TOO_LARGE.json)
		});
		expect('refused' in a!, 'no refusal before any request').toBe(false);
		expect(b, 'B: asked after it, whole').toMatchObject({ kind: 'CASE', id: 'B' });
		expect('refusedRequest' in b!).toBe(false);
		expect(r.log, 'the log names the refusal').toContain('CASE A: 2 question(s), then request c02 refused by the server: HTTP 413');
		expect(out.requests, 'the requests made, the refused one among them').toBe(sent.length);
		// ⭑ And it resumes: a held entry, refused or not, is not asked again.
		const before = posts(s).length;
		const again = await runOf(s.url, { file: r.file, controls: [] }).go();
		expect([again.made, posts(s).length - before, again.stopped]).toEqual([0, 0, undefined]);
	});

	it('⭐ a 413 whose answer is empty is a 413 too: recorded as returned, its answer empty, and the run goes on', async () => {
		const s = await stub({ answer: ({ body, parsed, n }) => (n === 1 ? { status: 413, raw: '' } : scoredAnswer(body, parsed)) });
		const r = runOf(s.url, { controls: [] });
		const out = await r.go();
		expect(out.stopped, 'the run goes on past a 413 with no answer').toBeUndefined();
		const [, a, b] = linesOf(r.file);
		expect([a!.questions, a!.refusedRequest]).toEqual([[], { key: 'c00', kind: 'check', bodySha256: sha256(posts(s)[0]!.body), status: 413, response: '' }]);
		expect(b, 'B: asked after it, whole').toMatchObject({ kind: 'CASE', id: 'B' });
	});

	it('⛔ a file whose line holds a refused request that is no 413 with its body hash stops the run, naming the line', async () => {
		const s = await stub();
		const r = runOf(s.url, { controls: [] });
		await r.go();
		const [head, a, b] = readFileSync(r.file, 'utf8').trimEnd().split('\n');
		const line = JSON.parse(a!) as Record<string, unknown>;
		const forged = { ...line, refusedRequest: { key: 'c09', kind: 'check', bodySha256: sha256('x'), status: 500, response: '{}' } };
		writeFileSync(r.file, `${[head, JSON.stringify(forged), b].join('\n')}\n`, 'utf8');
		const out = await runOf(s.url, { file: r.file, controls: [] }).go();
		expect(out.stopped).toBe(
			`STOPPED: ${r.file} line 2 holds a refused request that is no 413 with its key, kind, body hash and the server’s answer (D54)`
		);
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L8 — design D63 (`REG-D-152`) — THE RECORDS ARE MADE ON ONE VERSION, AND THEIR CLIENT ACCEPTS NONE
// BESIDE IT (`alsoAccepted: []`), though the product's now accepts 0.40.16 beside 0.40.15. ⭑ Seen in behaviour: the run reads the
// server's identity itself before each entry and stops on a change, but the server can be updated between that read and the client's
// own — and then the client is what refuses it. ⭑ A GUARD, green at HEAD and after: a client accepting 0.40.16 would score the entry on
// it, and the file would hold it under its 0.40.15.
describe('⭐⭐ L8 (D63; REG-D-152) — the records are made on one version: their client accepts none beside it', () => {
	it('⛔ the server updated between the run’s read before an entry and the client’s: the client refuses it, and nothing of the entry is written', async () => {
		let versionReads = 0;
		// ⭑ read at the start and by the run before A, as 0.40.15; then the server is updated, before the client reads it for A.
		const s = await stub({ version: () => ((versionReads += 1) > 2 ? '0.40.16' : STUB_VERSION) });
		const r = runOf(s.url);
		const out = await r.go();
		expect(out.stopped).toBe('STOPPED: A: the client refused its review: the server is Ollama 0.40.16, not 0.40.15 (D51; REG-F-608)');
		expect(linesOf(r.file).map((l) => l.kind)).toEqual(['IDENTITY']);
		expect(posts(s), 'no question asked').toEqual([]);
	});
});
