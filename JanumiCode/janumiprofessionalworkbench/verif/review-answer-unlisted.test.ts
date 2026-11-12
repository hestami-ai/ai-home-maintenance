// ⭐⭐ `JAN-EXEC` Phase 7, package L9 — D64 (`REG-D-153`; `REG-F-626`; `REG-F-609`; design §12.18) — WHAT STAYS REFUSED.
//
// D64 lists none of an answer's statements where a work product's review, listing every statement, would pass a bound of D52's
// room — and only where that prompt then fits. D52's six refusal probes stay refused, each with its statement byte for byte: five
// are no work product's review (a part's, and process results'), so their cuts hold no statement of an answer; and
// `W-ACCOUNT-BREAKS`'s one statement of the answer, 87 characters, is 143 characters of its 9,781 of growth as the block lists it
// under an 18-character fence, while the variant sentence is 156 characters longer than today's — so without it the growth is
// 9,794, past 9,500 still (the lead's arithmetic, D64), which the product's own code is made to show here.
// ⛔ PREDICTED RED at 62cd8341 (`l9-facts.md` §3): the arithmetic's row — no variant sentence there, and no review of it sent. The
// six refusals are the CONTROL, green there and after. ⛔ No model and no network: every source is a function here, and PATH names an
// empty directory.
import { SEEDED_REASONING_REVIEW_CRITERIA, type ReasoningReviewInput } from '@janumipwb/rph-assurance';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { reviewPrompt, type IndicationsSource } from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { answerItems } from '../apps/rph-demo/src/lib/server/assurance/review-cuts.js';
import { processResultReviewInput } from '../apps/rph-demo/src/lib/server/assurance/review-input.js';
import { REVIEW_SECTION_TEXT, type ReviewSectionText } from '../apps/rph-demo/src/lib/server/assurance/review-section.js';
import { BLOCK_SAYS, BLOCK_SAYS_ANSWER_UNLISTED } from '../apps/rph-demo/src/lib/server/assurance/review-section.testing.js';
import { D52_REFUSAL_PROBES, FINGERPRINT_PROBES } from '../scripts/reviewer-qual/probes.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

beforeAll(() => {
	vi.stubEnv('PATH', NO_PROGRAMS);
});
afterAll(() => {
	vi.unstubAllEnvs();
});

/** ⭑ Each of D52's six refusal probes' statements, byte for byte, as the product refused each at 62cd8341 (`REG-F-609`; D56). */
const REFUSED_AT_HEAD: Readonly<Record<string, string>> = {
	'T-ACCOUNT-BREAKS':
		'This review was not sent: its growth beyond today’s prompt would be 9638 characters, past its bound of 9500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.',
	'W-ACCOUNT-BREAKS':
		'This review was not sent: its growth beyond today’s prompt would be 9781 characters, past its bound of 9500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.',
	'P-ACCOUNT-BREAKS':
		'This review was not sent: its growth beyond today’s prompt would be 9638 characters, past its bound of 9500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.',
	'P-OVERSIZE-SURROGATE':
		'This review was not sent: its whole prompt would be 47246 characters, past its bound of 35500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.',
	'P-OVERSIZE-ROOM-EDGES':
		'This review was not sent: its whole prompt would be 47242 characters, past its bound of 35500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.',
	'P-OVERSIZE-ALL':
		'This review was not sent: its whole prompt would be 43099 characters, past its bound of 35500 (REG-D-146; D52). No indication is dropped to fit it, so the review is refused. No model was called.'
};

/** A probe's input, built as the fingerprint builds it: the floor's criteria, a process result through the product's builder. */
const inputOf = (id: string): ReasoningReviewInput =>
	FINGERPRINT_PROBES.find((p) => p.id === id)!.input(SEEDED_REASONING_REVIEW_CRITERIA, processResultReviewInput);

/** A source scoring every request 0, counting the calls made of it. */
const counting = () => {
	let calls = 0;
	const source: IndicationsSource = async (requests) => {
		calls += 1;
		return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
	};
	return { source, calls: () => calls };
};

/** What the product does with `input`: the prompt it sends, or the statement it refuses with. */
const outcomeOf = (input: ReasoningReviewInput, source: IndicationsSource, text?: ReviewSectionText) =>
	reviewPrompt(input, source, text).then(
		(sent) => ({ sent }),
		(e: unknown) => ({ refused: (e as Error).message })
	);

describe('⭐⭐ L9 (D64; REG-D-153) — D52’s refusal probes stay refused, and W-ACCOUNT-BREAKS by the lead’s arithmetic', () => {
	it('⭑ CONTROL — D52’s six refusal probes are each refused with its statement, byte for byte as at 62cd8341, the decision model not asked; five are no work product’s review', async () => {
		expect(Object.keys(D52_REFUSAL_PROBES), 'the six').toEqual(Object.keys(REFUSED_AT_HEAD));
		for (const [id, statement] of Object.entries(REFUSED_AT_HEAD)) {
			const { source, calls } = counting();
			expect(await outcomeOf(inputOf(id), source), id).toEqual({ refused: statement });
			expect(calls(), `${id}: the decision model not asked`).toBe(0);
		}
		expect(
			Object.keys(REFUSED_AT_HEAD).filter((id) => inputOf(id).framing === 'WORK_PRODUCT'),
			'one is a work product’s review: the others’ subjects carry other lines before their regions'
		).toEqual(['W-ACCOUNT-BREAKS']);
	});

	it('⛔ W-ACCOUNT-BREAKS stays refused, by the lead’s arithmetic checked through the product’s own code: its answer’s one statement is 143 characters of its 9,781 of growth, the variant sentence 156 longer than today’s, so without it the growth is 9,794', async () => {
		const input = inputOf('W-ACCOUNT-BREAKS');
		expect(answerItems(input.content), 'its answer: one statement, the whole answer').toEqual([{ from: 'answer', text: input.content }]);
		expect(input.content.length, 'of 87 characters').toBe(87);
		expect(REVIEW_SECTION_TEXT.INDICATIONS_SAYS_ANSWER_UNLISTED, 'the product’s variant sentence, the design’s words').toBe(BLOCK_SAYS_ANSWER_UNLISTED);
		expect(BLOCK_SAYS_ANSWER_UNLISTED.length - BLOCK_SAYS.length, 'the variant sentence, 156 characters longer than today’s').toBe(156);
		// ⭑ The edge, read through the product's code: the growth of the prompt that lists none of the answer's statements, with a
		// variant of `n` characters, is 9,781 − 143 + (n − 345); so a variant of 207 characters fits, exactly 9,500, and 208 does not.
		const EDGE = 9_500 - (9_781 - 143) + BLOCK_SAYS.length;
		expect(EDGE).toBe(207);
		const withVariant = (n: number) => ({ ...REVIEW_SECTION_TEXT, INDICATIONS_SAYS_ANSWER_UNLISTED: 'x'.repeat(n) });
		const fits = await outcomeOf(input, counting().source, withVariant(EDGE));
		expect('sent' in fits, 'a variant of 207 characters: sent').toBe(true);
		const sent = 'sent' in fits ? fits.sent : '';
		const fence = sent.split('\n').find((l) => /^<<<UNTRUSTED-\d+>>>$/.test(l)) ?? '';
		expect(fence.length, 'its fence, 18 characters').toBe(18);
		expect(`Statement, 0.00:\n${fence}\n${input.content}\n${fence}\n`.length, 'the answer’s statement as the block lists it').toBe(143);
		expect(sent.includes(input.content), 'and the answer shown whole').toBe(true);
		expect(await outcomeOf(input, counting().source, withVariant(EDGE + 1)), 'one more: refused, with the full list’s statement').toEqual({
			refused: REFUSED_AT_HEAD['W-ACCOUNT-BREAKS']
		});
		expect(9_781 - 143 + (BLOCK_SAYS_ANSWER_UNLISTED.length - BLOCK_SAYS.length), 'so with the variant sentence, 9,794: past 9,500').toBe(9_794);
		expect(await outcomeOf(input, counting().source), 'and the review is refused with the full list’s statement, byte for byte').toEqual({
			refused: REFUSED_AT_HEAD['W-ACCOUNT-BREAKS']
		});
	});
});
