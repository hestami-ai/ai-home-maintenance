// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54's POINTER COMPONENT (`REG-D-146`; design §12.6, revision 9; roadmap §9b.5b, Z2 predicted
// red 8): the request's fixed text and inner names, both questions and their answers, both cuts, the block's wording and format, the
// cold path, the model, its digest and the server version — one text the reviewer fingerprint hashes beside the probes
// (`DECISION-MODEL`), so a change to any part moves the fingerprint. ⭑ Pinned whole here: each part's mutant reddens this pin
// (`P6X-Z2B-*`), and the controls below show each part the text carries as data moves it.
// ⛔ No model and no socket: the cold path is driven against a server held in memory.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DECISION_MODEL_TEXT } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import {
	REASONING_REVIEW_BUDGET,
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { REVIEW_SECTION_TEXT } from '../apps/rph-demo/src/lib/server/assurance/review-section.js';
import { decisionModelPointer, PRODUCT_POINTER_PARTS } from '../scripts/reviewer-qual/decision-model-pointer.js';
// ⭐⭐ Package L9 — D64 — read through the module, so a red names what is missing.
import * as POINTER_MODULE from '../scripts/reviewer-qual/decision-model-pointer.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

// ⭑ The fingerprint's probes, rendered by the row below, ask the decision model: through the history's source
// (`reviewer-qualification-history.ts`), which answers a probe's question from D54's committed records where they hold it and with
// the placeholder's 0 where they do not — the row compares two fingerprints that differ in the pointer alone, so either serves.
vi.mock('../scripts/reviewer-qual/recorded-indications.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../scripts/reviewer-qual/recorded-indications.js')>();
	const { historyIndications } = await import('./reviewer-qualification-history.js');
	return { ...actual, COMMITTED_INDICATIONS: historyIndications(() => actual.committedRecords(new URL('../', import.meta.url))) };
});
// ⛔ No program can be found from this process while the fingerprint is computed (`reviewer-qualification-hermetic.ts`).
beforeAll(() => {
	vi.stubEnv('PATH', NO_PROGRAMS);
});
afterAll(() => {
	vi.unstubAllEnvs();
});

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** ⭐ The component as the product makes it today. ⚠ Restated with any change to a part it covers. */
// ⛔ MOVED 2026-11-11 (`JAN-EXEC` Phase 7, package L9 — D64; `REG-D-153`; the lead's decision (d)) —
// ~~'ff350eefcd3df28dde7e8b7daed4a6cb2d1a8247cc34e97b8d772ac475bb0fac'~~: the section's text gains the variant sentence, and the
// component the witness of D64's branch (`answerUnlisted`); its other five parts unchanged.
const POINTER_TODAY = 'bb333e2be5da4a8d07b633eff357d1f6d717621236f6c609937e9d4adf38cf49';

describe('⛔ PREDICTED RED 8 (Z2; D54) — the fingerprint’s pointer component: every part the indications rest on but the scores', () => {
	it('⭐ the reviewer fingerprint hashes it beside the probes: one part changed moves `probes`, and no other component', async () => {
		const { reviewerFingerprint, PRODUCT_SEAMS } = await import('../scripts/reviewer-qual/fingerprint.js');
		const base = await reviewerFingerprint([]);
		const moved = await reviewerFingerprint([], {
			...PRODUCT_SEAMS,
			pointer: { ...PRODUCT_SEAMS.pointer, identity: { ...PRODUCT_SEAMS.pointer.identity, serverVersion: '0.40.16' } }
		});
		expect(moved.components.probes, 'the probes move').not.toBe(base.components.probes);
		expect({ ...moved.components, probes: '' }, 'and nothing else').toEqual({ ...base.components, probes: '' });
		expect(moved.probePrompts, 'no probe’s own prompt moves: the pointer is an entry of its own').toEqual(base.probePrompts);
	}, 120_000);

	it('⭐ the component, whole, as the product makes it', async () => {
		expect(sha256(await decisionModelPointer())).toBe(POINTER_TODAY);
	});

	it('⭐ it carries each part: the bodies, both cuts, the block, the section’s text, the cold path and the identity', async () => {
		const c = JSON.parse(await decisionModelPointer()) as Record<string, unknown>;
		// ⛔ RESTATED 2026-11-11 (`JAN-EXEC` Phase 7, package L9 — D64; `REG-D-153`; the lead's decision (d)): ~~six parts~~ — and the
		// witness of D64's branch, its prompt hashed (`answerUnlisted`), the L9 rows below.
		expect(Object.keys(c)).toEqual(['bodies', 'cuts', 'block', 'sectionText', 'cold', 'identity', 'answerUnlisted']);
		const cold = c.cold as { requests: string[]; result: { scores?: Record<string, number> } };
		expect(cold.requests.slice(0, 4), 'the identity, then the model found loaded, unloaded by step 1’s own request').toEqual([
			'GET /api/tags',
			'GET /api/version',
			'GET /api/ps',
			expect.stringMatching(/^POST \/v1\/systemone [0-9a-f]{64} application\/json$/)
		]);
		expect(Object.keys(cold.result.scores ?? {})).toEqual(['c00', 's00']);
		const cuts = c.cuts as { checks: unknown[]; statements: { text: string }[] };
		expect(cuts.checks).toHaveLength(3);
		expect(cuts.statements.map((s) => s.text)).toContain('summary: Last value wins.');
	});

	it('⭑ CONTROL — one character of a fixed text, of the section’s text, or of the model, digest or version moves it', async () => {
		const today = sha256(await decisionModelPointer());
		const edits = [
			{ ...PRODUCT_POINTER_PARTS, text: { ...DECISION_MODEL_TEXT, OBJECTIVE: `${DECISION_MODEL_TEXT.OBJECTIVE} ` } },
			{ ...PRODUCT_POINTER_PARTS, text: { ...DECISION_MODEL_TEXT, STATEMENT_TRUE: `${DECISION_MODEL_TEXT.STATEMENT_TRUE} ` } },
			{ ...PRODUCT_POINTER_PARTS, sectionText: { ...REVIEW_SECTION_TEXT, CHECKS_HEADING: `${REVIEW_SECTION_TEXT.CHECKS_HEADING} ` } },
			{ ...PRODUCT_POINTER_PARTS, identity: { ...PRODUCT_POINTER_PARTS.identity, model: 'pplx-decider:27b-q8_0' } },
			{ ...PRODUCT_POINTER_PARTS, identity: { ...PRODUCT_POINTER_PARTS.identity, digest: `${'0'.repeat(63)}1` } },
			{ ...PRODUCT_POINTER_PARTS, identity: { ...PRODUCT_POINTER_PARTS.identity, serverVersion: '0.40.16' } }
		];
		const moved: number[] = [];
		for (const [i, parts] of edits.entries()) if (sha256(await decisionModelPointer(parts)) !== today) moved.push(i);
		expect(moved).toEqual(edits.map((_, i) => i));
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L8 — design D63 (`REG-D-152`) — the pointer's client accepts no version beside its identity's
// (`alsoAccepted: []`), though the product's now accepts 0.40.16 beside 0.40.15. ⭑ A SOURCE CHECK, NAMED AS SUCH: the pointer's server,
// held in memory, answers its identity's own version, so no behaviour can show a version accepted beside it — the component, and so
// the fingerprint, stay as they are. Its source is read instead: the one client it builds lists none.
describe('⭐⭐ L8 (D63; REG-D-152) — the pointer’s client accepts no version beside its identity’s', () => {
	it('⭑ SOURCE CHECK — the one client the pointer builds is given `alsoAccepted: []`, and no list of the product’s', () => {
		const source = readFileSync(new URL('../scripts/reviewer-qual/decision-model-pointer.ts', import.meta.url), 'utf8');
		const calls = source.split('createDecisionModelClient(').slice(1);
		expect(calls, 'one client built').toHaveLength(1);
		expect(calls[0]!.slice(0, calls[0]!.indexOf(');'))).toContain('alsoAccepted: []');
		expect(source).not.toContain('DECISION_MODEL_ALSO_ACCEPTED');
	});
});

// ⭐⭐ `JAN-EXEC` Phase 7, package L9 — design D64 (`REG-D-153`; the lead's decision (d)) — THE COMPONENT HOLDS A WITNESS OF D64'S
// BRANCH: a work product whose answer, shown whole, has statements that pass the growth bound when listed, its account small,
// rendered by the product's `reviewPrompt` through the pointer's own client against its server held in memory — no new record of the
// decision model (`REG-D-152`) — its prompt's sha256 the component's last part. ⛔ PREDICTED RED at 62cd8341: the component holds no
// such part, and the module no such witness.
describe('⭐⭐ L9 (D64; REG-D-153) — the component holds a witness of D64’s branch, its prompt hashed', () => {
	const zeros: IndicationsSource = async (requests) => ({ scores: Object.fromEntries(requests.map((r) => [r.key, 0])) });
	const witness = (POINTER_MODULE as unknown as { readonly WITNESS_ANSWER_UNLISTED?: ReasoningReviewInput }).WITNESS_ANSWER_UNLISTED;

	it('⭐ the witness’s review is SENT through the pointer’s own client: its prompt’s sha256 is the component’s last part', async () => {
		const c = JSON.parse(await decisionModelPointer()) as Record<string, unknown>;
		expect(c.answerUnlisted, 'sent, its prompt hashed').toEqual({ prompt: expect.stringMatching(/^[0-9a-f]{64}$/) });
	});

	it('⭐ the witness is the fourth run’s review in shape: its answer’s statements, listed, pass the growth bound; its prompt lists the account’s statements alone, under the variant sentence, and the decision model is asked those alone', async () => {
		expect(witness?.framing, 'a work product’s review').toBe('WORK_PRODUCT');
		const asked: (readonly IndicationRequest[])[] = [];
		const prompt = await reviewPrompt(witness!, async (requests, material) => {
			asked.push(requests);
			return zeros(requests, material);
		});
		const lines = prompt.split('\n');
		expect(lines[lines.indexOf(REVIEW_SECTION_TEXT.INDICATIONS_HEADING) + 1], 'the variant sentence').toBe(REVIEW_SECTION_TEXT.INDICATIONS_SAYS_ANSWER_UNLISTED);
		expect(asked.map((requests) => requests.flatMap((r) => (r.kind === 'statement' ? [r.statement] : []))), 'the account’s statements alone').toEqual([
			['The requirements are written in one document.', 'Each is numbered.', 'The input is UTF-8.']
		]);
		expect(asked[0]!.filter((r) => r.kind === 'check'), 'and every check').toHaveLength(9);
		// ⭑ The full list, read with the variant sentence padded past every bound: refused for its growth, past 9,500.
		const padded = {
			...REVIEW_SECTION_TEXT,
			INDICATIONS_SAYS_ANSWER_UNLISTED: `${REVIEW_SECTION_TEXT.INDICATIONS_SAYS_ANSWER_UNLISTED}${'x'.repeat(REASONING_REVIEW_BUDGET.WHOLE_PROMPT_MAX)}`
		};
		const full = await reviewPrompt(witness!, zeros, padded).then(
			() => '',
			(e: unknown) => (e as Error).message
		);
		const growth = /^This review was not sent: its growth beyond today’s prompt would be (\d+) characters/.exec(full);
		expect(Number(growth?.[1]), 'the answer’s statements, listed, pass the growth bound').toBeGreaterThan(REASONING_REVIEW_BUDGET.SECTION_GROWTH_MAX);
	});

	it('⭑ CONTROL — one character of the variant sentence moves the witness’s part, not only the section’s text the component holds', async () => {
		const today = JSON.parse(await decisionModelPointer()) as Record<string, unknown>;
		const edited = JSON.parse(
			await decisionModelPointer({
				...PRODUCT_POINTER_PARTS,
				sectionText: { ...REVIEW_SECTION_TEXT, INDICATIONS_SAYS_ANSWER_UNLISTED: `${REVIEW_SECTION_TEXT.INDICATIONS_SAYS_ANSWER_UNLISTED} ` }
			})
		) as Record<string, unknown>;
		expect(today.answerUnlisted, 'arrangement: a witness today').toBeDefined();
		expect(edited.answerUnlisted, 'the witness’s prompt moves').not.toEqual(today.answerUnlisted);
	});
});
