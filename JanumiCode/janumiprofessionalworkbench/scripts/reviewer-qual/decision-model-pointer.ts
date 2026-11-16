// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54's POINTER COMPONENT OF THE REVIEWER FINGERPRINT (`REG-D-146`;
// `DESIGN-data-flow-order-and-deliverable-review.md` §12.6, revision 9; roadmap §9b.5b, Z2 predicted red 8): everything the decision
// model's indications rest on but the scores themselves, as one text the fingerprint hashes beside the probes (`DECISION-MODEL`,
// `fingerprint.ts`), so a change to any part of it moves the fingerprint, and a server update requires new records (`REG-F-608`).
//
// ⭑ THE PARTS, AND HOW EACH IS COVERED — the text is canonical JSON of what the product's own code DOES with fixed witnesses, so
// code is covered as surely as text:
//   1. the request's fixed text and this evaluation's own inner names (D51) — the exact bodies `decisionModelBody` writes for a
//      witness check and a witness statement, and `unloadBody`'s: every fixed text, every inner name of the state, the key order and
//      Python's `json.dumps` are in those bytes (a witness material and questions holding non-ASCII, an astral character, quotes and
//      controls, so the escapes are exercised);
//   2. both questions and their answers — in the same bodies: each question's opening and its two answers;
//   3. both cuts — the checks `checksOf` reads off a witness rubric and the statements `statementsOf` reads off a witness head, every
//      region label among them, an answer of every JSON kind, Python's whitespace and a list's items; and `materialOf`'s material;
//   4. the block's wording and format — `REVIEW_SECTION_TEXT` whole, and `indicationsBlock` rendered for witness scores holding the
//      exact ties Python rounds to even (0.125, 0.375, 0.625, 0.875), equal scores, and a statement past 700 code points;
//   5. the cold path — the requests the product's client makes, in order, against a server held in memory (no socket, no model):
//      the identity reads, the unload request for a model found loaded, `/api/ps` read until the model is absent before every
//      request, each body's hash and the scores read back; and D51's bounds (`DECISION_MODEL_BOUNDS`);
//   6-8. the model, its digest and the server version — `DECISION_MODEL_RECORDS_IDENTITY`, the identity the records must have;
//   9. ⭐⭐ package L9 — D64 (`REG-D-153`; design §12.18) — a witness of D64's branch: a work product whose answer, shown whole, has
//      statements that pass the growth bound when listed, its account small, rendered by the product's `reviewPrompt` through the
//      same client against the same server held in memory — no new record of the decision model (`REG-D-152`) — its prompt's
//      sha256 kept (`answerUnlisted`), which lists none of the answer's statements under the variant sentence.
// ⛔ It holds no score: the records' scores reach the fingerprint through the prompts the probes and cases render from them.
import { createHash } from 'node:crypto';
import { SEEDED_REASONING_REVIEW_CRITERIA, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import { createDecisionModelClient, DECISION_MODEL_BOUNDS } from '../../apps/rph-demo/src/lib/server/assurance/decision-model-client.js';
import {
	DECISION_MODEL_RECORDS_IDENTITY,
	type DecisionModelRecordsIdentity
} from '../../apps/rph-demo/src/lib/server/assurance/decision-model-identity.js';
import {
	DECISION_MODEL_TEXT,
	decisionModelBody,
	materialOf,
	unloadBody,
	type DecisionModelQuestion,
	type DecisionModelText
} from '../../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import { reviewPrompt } from '../../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { checksOf, statementsOf } from '../../apps/rph-demo/src/lib/server/assurance/review-cuts.js';
import { workProductReviewInput } from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { indicationsBlock, REVIEW_SECTION_TEXT, type ReviewSectionText } from '../../apps/rph-demo/src/lib/server/assurance/review-section.js';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const F = '<<<UNTRUSTED-07>>>';

/** ⭐ A witness head: the preamble's four lines, then one region of every label the statement cut reads, and one it does not. */
export const WITNESS_HEAD = [
	'You are an independent assurance reviewer.',
	'Quoted material starts at a fence line.',
	'Line three.',
	'Line four.',
	'The instruction:',
	F,
	'Summarise — the log, “all” of it.',
	F,
	'The WORK PRODUCT to review (its answer):',
	F,
	'{"summary":"Three records were read.  Each one parsed.","count":3,"ratio":1.0,"tiny":1e-05,"nested":{"b":[1,"x"],"a":null},"summary":"Last value wins. Twice."}',
	F,
	"The producing agent's PROFESSIONAL RATIONALE SUMMARY:",
	F,
	`It read the log.\u001cIt counted records.\u0085Then it stopped. A sentence\ufeff Not split here.`,
	F,
	'Assumptions relied on:',
	F,
	'  - The log is complete. -',
	'',
	'- Clocks agree',
	F,
	'Limitations the producer declares:',
	F,
	'  - No second source.',
	F,
	'Residual uncertainty:',
	F,
	'  - Rotation may drop lines.',
	F,
	''
].join('\n');

/** ⭐ A witness rubric: brackets kept and removed, an id's suffix, a decimal digit of another script, and a line no check reads. */
export const WITNESS_RUBRIC = [
	'Evaluate EACH derivational-integrity failure class below.',
	'- RR-01: The answer follows from the evidence. [if unmet: BLOCKING]',
	'- RR-02b: Nothing asserted past its scope.',
	'- AC-0١: A check numbered in another script. [if unmet: ADVISORY]',
	'-  RR-03: Two spaces: no check.',
	''
].join('\n');

/** ⭐ Witness questions: non-ASCII, an astral character, quotes, a backslash, controls. */
export const WITNESS_QUESTIONS: readonly DecisionModelQuestion[] = [
	// S7780: kept - under Bun 1.3.14 String.raw returns the non-ASCII characters of its raw text as \uXXXX escapes, so it would change this witness and the pointer's bytes (Node does not)
	{ kind: 'check', key: 'c00', id: 'RR-01', label: 'Läbel — “quoted” \\ back' },
	{ kind: 'statement', key: 's00', statement: 'summary: Ünïcode \u{1F600} line\nbreak\ttab "q"' }
];

/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L9 — D64 (`REG-D-153`; design §12.18) — A WITNESS OF D64'S BRANCH, in the fourth run's shape
 * (`REG-F-626`): a work product whose answer, one JSON object, carries its document in one text field, shown whole, its
 * statements past the growth bound when listed, and its account small. Built by the product's own builder.
 */
export const WITNESS_ANSWER_UNLISTED: ReasoningReviewInput = workProductReviewInput({
	criteria: SEEDED_REASONING_REVIEW_CRITERIA,
	producingPrompt: 'Write the requirements of the wordfreq command line as one JSON object, the document in one text field.',
	answer: JSON.stringify({
		document: Array.from(
			{ length: 96 },
			(_, i) => `Requirement ${i + 1} is that the command counts the words of its input and prints each count.`
		).join(' '),
		format: 'markdown'
	}),
	rationale: {
		rationale: 'The requirements are written in one document. Each is numbered.',
		assumptions: ['The input is UTF-8.'],
		limitations: [],
		residualUncertainty: []
	}
});

/** A server held in memory, answering as Ollama does: the model listed at the start, and for one read after each request. */
function memoryServer(identity: DecisionModelRecordsIdentity) {
	const seen: string[] = [];
	let lingering = Number.POSITIVE_INFINITY;
	const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
	const serve = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input as string));
		const method = init?.method ?? 'GET';
		const body = typeof init?.body === 'string' ? init.body : '';
		const type = new Headers(init?.headers).get('content-type') ?? '';
		const hashPart = body === '' ? '' : ` ${sha256(body)}`;
		const typePart = type === '' ? '' : ` ${type}`;
		seen.push(`${method} ${url.pathname}${hashPart}${typePart}`);
		if (url.pathname === '/api/tags') return json({ models: [{ name: identity.model, model: identity.model, digest: identity.digest }] });
		if (url.pathname === '/api/version') return json({ version: identity.serverVersion });
		if (url.pathname === '/api/ps') {
			const listed = lingering > 0;
			if (lingering > 0) lingering -= 1;
			return json({ models: listed ? [{ name: identity.model, model: identity.model }] : [] });
		}
		const parsed = JSON.parse(body) as { questions: Record<string, unknown> };
		lingering = 1;
		return json({
			model: identity.model,
			answers: Object.fromEntries(Object.keys(parsed.questions).map((k) => [k, { type: 'noul', noul: Number.parseInt(sha256(body).slice(0, 8), 16) / 2 ** 32 }])),
			usage: { input_tokens: 1, output_tokens: 1 }
		});
	}) as typeof globalThis.fetch;
	return { seen, fetch: serve };
}

/** The parts the component is made of — the product's own, but where a test shows that a change to one of them moves it. */
export interface PointerParts {
	readonly text: DecisionModelText;
	readonly sectionText: ReviewSectionText;
	readonly identity: DecisionModelRecordsIdentity;
}
export const PRODUCT_POINTER_PARTS: PointerParts = { text: DECISION_MODEL_TEXT, sectionText: REVIEW_SECTION_TEXT, identity: DECISION_MODEL_RECORDS_IDENTITY };

/** ⭐⭐ THE POINTER COMPONENT'S TEXT: canonical JSON of the eight parts, as the product's code makes them from the witnesses. */
export async function decisionModelPointer(parts: PointerParts = PRODUCT_POINTER_PARTS): Promise<string> {
	const { text, sectionText, identity } = parts;
	const material = materialOf(WITNESS_HEAD);
	// 1, 2 — the bodies: fixed texts, inner names, both questions and their answers, the serializer.
	const bodies = [...WITNESS_QUESTIONS.map((q) => decisionModelBody(identity.model, material, q, text)), unloadBody(identity.model, text)];
	// 3 — both cuts, and the material.
	const cuts = { checks: checksOf(WITNESS_RUBRIC), statements: statementsOf(WITNESS_HEAD, F), material };
	// 4 — the block's wording and format.
	const long = `${'a'.repeat(720)} done.`;
	const block = indicationsBlock(
		[0.125, 0.375, 0.625, 0.875, 0.5, 0.5].map((score, i) => ({ id: `RR-0${i + 1}`, score })),
		[0.125, 0.5, 0.5, 0.875].map((score, i) => ({ text: i === 3 ? long : `statement ${i}`, score })),
		F,
		700,
		sectionText
	);
	// 5 — the cold path, against a server held in memory.
	const server = memoryServer(identity);
	const client = createDecisionModelClient({
		server: 'https://decision-model.invalid',
		model: identity.model,
		// ⭐⭐ Package L8 — D63 (`REG-D-152`): the identity's version, and none beside it.
		identity: { digest: identity.digest, serverVersion: identity.serverVersion, alsoAccepted: [] },
		bounds: { pollMs: 0 },
		clock: () => '1970-01-01T00:00:00.000Z',
		text,
		fetch: server.fetch
	});
	const result = await client(WITNESS_QUESTIONS, material);
	const cold = {
		bounds: DECISION_MODEL_BOUNDS,
		// ⭑ The requests as they stood after the witness questions: the witness review below asks the same server.
		requests: [...server.seen],
		result: 'refusal' in result ? { refusal: result.refusal } : { scores: result.scores, exchanges: (result.exchanges ?? []).map((x) => [x.key, x.outcome.kind]) }
	};
	// 6-8 — the identity the records must have.
	// 9 — ⭐⭐ Package L9 — D64: the witness's review, through the same client against the same server — its prompt's sha256, or
	// its refusal, which no product's code makes of it.
	const answerUnlisted = await reviewPrompt(WITNESS_ANSWER_UNLISTED, client, sectionText).then(
		(prompt) => ({ prompt: sha256(prompt) }),
		(e: unknown) => ({ refused: e instanceof Error ? e.message : String(e) })
	);
	return JSON.stringify({ bodies, cuts, block, sectionText, cold, identity, answerUnlisted });
}
