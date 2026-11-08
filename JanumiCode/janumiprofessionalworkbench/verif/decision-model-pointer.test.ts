// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D54's POINTER COMPONENT (`REG-D-146`; design §12.6, revision 9; roadmap §9b.5b, Z2 predicted
// red 8): the request's fixed text and inner names, both questions and their answers, both cuts, the block's wording and format, the
// cold path, the model, its digest and the server version — one text the reviewer fingerprint hashes beside the probes
// (`DECISION-MODEL`), so a change to any part moves the fingerprint. ⭑ Pinned whole here: each part's mutant reddens this pin
// (`P6X-Z2B-*`), and the controls below show each part the text carries as data moves it.
// ⛔ No model and no socket: the cold path is driven against a server held in memory.
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DECISION_MODEL_TEXT } from '../apps/rph-demo/src/lib/server/assurance/decision-model-request.js';
import { REVIEW_SECTION_TEXT } from '../apps/rph-demo/src/lib/server/assurance/review-section.js';
import { decisionModelPointer, PRODUCT_POINTER_PARTS } from '../scripts/reviewer-qual/decision-model-pointer.js';
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
const POINTER_TODAY = 'ff350eefcd3df28dde7e8b7daed4a6cb2d1a8247cc34e97b8d772ac475bb0fac';

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
		expect(Object.keys(c)).toEqual(['bodies', 'cuts', 'block', 'sectionText', 'cold', 'identity']);
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
