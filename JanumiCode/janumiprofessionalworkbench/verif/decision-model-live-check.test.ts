// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D54's LIVE CHECK, ITS COMPARISON HELD BEFORE ITS RUN (`REG-D-146`; design §12.6; roadmap
// §9b.5b, Z2 live acceptance 10). The check runs outside the gate — step 1's own Python path against the product's client, on one
// server version — and decides by `compareAnswers`: every question's score exactly equal and its body's sha256 equal. Held here:
// a score one unit in the last place apart differs, a body apart differs, a question one side lacks differs; and the product's cut
// of a rendered prompt, which asks the six `W14-` cases, is the screen's (`requestsOfText`).
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { startDecisionModelStub, STUB_MODEL, STUB_VERSION } from '../apps/rph-demo/src/lib/server/assurance/decision-model-stub.testing.js';
import { answersOf, compareAnswers, main, requestsOfText, SCREENED_V13, SCREENED_W14 } from '../scripts/reviewer-qual/decision-model-live-check.js';
import { NO_PROGRAMS } from './reviewer-qualification-hermetic.js';

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

// ⭐⭐ `JAN-EXEC` Phase 7, package L8 — design D63 (`REG-D-152`) — THE LIVE CHECK IS MADE ON ONE VERSION, AND ITS CLIENT ACCEPTS NONE
// BESIDE IT (`alsoAccepted: []`), though the product's now accepts 0.40.16 beside 0.40.15. ⭑ Seen in behaviour, through the canary: the
// check reads the server's identity itself before each case, but the server can be updated between that read and the client's own —
// and then the client is what refuses it. ⭑ A GUARD, green at HEAD and after: a client accepting 0.40.16 would ask the case on it and
// keep its answers, the check stopping only at its next read. ⛔ No step 1: either way the run ends before step 1's Python path is
// spawned, and no program can be found from it (`NO_PROGRAMS`).
describe('⭐⭐ L8 (D63; REG-D-152) — the live check is made on one version: its client accepts none beside it', () => {
	it('⛔ the server updated between the check’s read before the canary and the client’s: the client refuses it, and nothing of the case is kept', async () => {
		let versionReads = 0;
		// ⭑ read when the check begins and by the check before the canary, as 0.40.15; then the server is updated, before the client reads it.
		const s = await startDecisionModelStub({ version: () => ((versionReads += 1) > 2 ? '0.40.16' : STUB_VERSION) });
		const out = mkdtempSync(join(tmpdir(), 'jpwb-dm-live-check-'));
		const errors: string[] = [];
		vi.stubEnv('PATH', NO_PROGRAMS);
		const error = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
			errors.push(a.join(' '));
		});
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			const code = await main(['--server', s.url, '--model', STUB_MODEL, '--digest', '733585a9ebb6', '--step1', 'step1_single.py', '--out', out, '--canary', 'W12-CLEAN']);
			expect([code, errors]).toEqual([1, ['STOPPED: W12-CLEAN: the server is Ollama 0.40.16, not 0.40.15 (D51; REG-F-608)']]);
			expect(existsSync(join(out, 'product.ndjson')), 'nothing of the case kept').toBe(false);
			expect(s.requests.filter((r) => r.path === '/v1/systemone'), 'no question asked').toEqual([]);
		} finally {
			error.mockRestore();
			log.mockRestore();
			vi.unstubAllEnvs();
			await s.close();
			rmSync(out, { recursive: true, force: true });
		}
	}, 60_000);
});
