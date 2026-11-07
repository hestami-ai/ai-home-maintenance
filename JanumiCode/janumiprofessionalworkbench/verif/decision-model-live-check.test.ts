// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's LIVE CHECK, ITS COMPARISON HELD BEFORE ITS RUN (`REG-D-146`; design §12.6; roadmap
// §9b.5b, Z2 live acceptance 10). The check runs outside the gate — step 1's own Python path against the product's client, on one
// server version — and decides by `compareAnswers`: every question's score exactly equal and its body's sha256 equal. Held here:
// a score one unit in the last place apart differs, a body apart differs, a question one side lacks differs; and the product's cut
// of a rendered prompt, which asks the six `W14-` cases, is the screen's (`requestsOfText`).
import { describe, expect, it } from 'vitest';
import { answersOf, compareAnswers, requestsOfText, SCREENED_V13, SCREENED_W14 } from '../scripts/reviewer-qual/decision-model-live-check.js';

const A = { score: 0.1234, bodySha256: 'a'.repeat(64) };

describe('⭐ Z2a (D54) — the live check’s comparison: exact, both ways', () => {
	it('⭑ the 17 screened cases, as step 1 named them', () => {
		expect([SCREENED_V13.length, SCREENED_W14.length]).toEqual([11, 6]);
	});

	it('⭐ equal: the same keys, each score the same double, each body the same bytes', () => {
		expect(compareAnswers({ X: { checks: { c00: A } } }, { X: { checks: { c00: { ...A } } } })).toEqual({ equal: 1, differ: [] });
	});

	it('⛔ a score one unit in the last place apart, a body apart, a key one side lacks: each a difference', () => {
		const next = { ...A, score: 0.12340000000000001 };
		expect(next.score === A.score, 'arrangement: the next double').toBe(false);
		expect(compareAnswers({ X: { checks: { c00: A } } }, { X: { checks: { c00: next } } }).differ).toHaveLength(1);
		expect(compareAnswers({ X: { checks: { c00: A } } }, { X: { checks: { c00: { ...A, bodySha256: 'b'.repeat(64) } } } }).differ).toHaveLength(1);
		expect(compareAnswers({ X: { checks: { c00: A } } }, { X: { checks: {} } }).differ).toEqual([`X checks c00: product 0.1234 ${'a'.repeat(12)}, step 1 none`]);
		expect(compareAnswers({}, { X: { statements: { s00: A } } }).differ).toHaveLength(1);
	});

	it('⭐ a rendered prompt’s requests by the product’s cut: the rubric’s checks, the bracket removed, then the statements; the material', () => {
		const text = [
			'line 1',
			'line 2',
			'line 3',
			'line 4',
			'The WORK PRODUCT to review:',
			'<<<UNTRUSTED-00>>>',
			'{"summary":"Three records. Each read."}',
			'<<<UNTRUSTED-00>>>',
			'Evaluate EACH derivational-integrity failure class below. For each, decide.',
			'- RR-01: The answer follows from the evidence. [if unmet: BLOCKING]',
			''
		].join('\n');
		const { requests, material } = requestsOfText(text);
		expect(requests).toEqual([
			{ kind: 'check', key: 'c00', id: 'RR-01', label: 'The answer follows from the evidence.' },
			{ kind: 'statement', key: 's00', statement: 'summary: Three records.' },
			{ kind: 'statement', key: 's01', statement: 'summary: Each read.' }
		]);
		expect(material).toBe('The WORK PRODUCT to review:\n<<<UNTRUSTED-00>>>\n{"summary":"Three records. Each read."}\n<<<UNTRUSTED-00>>>\n');
	});

	it('⛔ a client’s result read as answers: a refusal, a question unscored, another model loaded — none an answer', () => {
		const requests = [{ kind: 'check' as const, key: 'c00', id: 'RR-01', label: 'x' }];
		const served = { model: 'm', digest: 'd', serverVersion: 'v' };
		const x = { key: 'c00', body: '{}', response: '{}', requestedAt: '', respondedAt: '', served, otherModels: [], outcome: { kind: 'SCORED' as const, score: 0.5 } };
		expect(answersOf(requests, { refusal: 'no server' })).toBe('no server');
		expect(answersOf(requests, { scores: {}, exchanges: [] })).toBe('c00 holds no score');
		expect(answersOf(requests, { scores: { c00: 0.5 }, exchanges: [{ ...x, otherModels: ['llama3.2:3b'] }] })).toBe(
			'another model was loaded when c00 was sent (llama3.2:3b)'
		);
		expect(answersOf(requests, { scores: { c00: 0.5 }, exchanges: [x] })).toEqual({
			checks: { c00: { score: 0.5, bodySha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a' } },
			statements: {}
		});
	});
});
