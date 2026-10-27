// ⭐⭐ `JAN-EXEC` Phase 7, package O-2 — D28 (`REG-D-137`, Q46; `REG-F-583`; `DESIGN-data-flow-order-and-deliverable-review.md` D28,
// revision 4) — THE SPONSOR'S "HASH FOR HASH" (`REG-D-136`), PINNED WITHOUT THE PROTOTYPE'S FILES.
//
// Three cases of case set v12 as the sponsor confirmed it, copied verbatim (`verif/fixtures/reviewer-qual/`): W12-CLEAN, with the
// empty view production hands; W12-CSV-CLEAN, a unit that changed nine files over thirteen acts; and D12-TA-08, a declared review
// shown three files and four acts. Each is rendered through the repository's own case assembly (`caseReviewInput`) and the
// product's validator with a stub transport — as the lead's acceptance check renders all 56 — and each first prompt's SHA-256 is
// the confirmed one, written here. ⭑ Each is a unit's FIRST step, so D28's re-run wording must leave it byte for byte.
// ⭑ AND THE PIN CAN FAIL: the same input marked a work re-run renders another prompt, which holds the re-run's words.
// No model is called.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { QualificationCase } from '../scripts/reviewer-qual/cases.js';
import { PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';

const REPO = fileURLToPath(new URL('../', import.meta.url))
	.replace(/\\/g, '/')
	.replace(/\/$/, '');
const FIXTURE = JSON.parse(readFileSync(`${REPO}/verif/fixtures/reviewer-qual/v12-confirmed-first-steps.json`, 'utf8')) as {
	readonly caseSetVersion: number;
	readonly cases: readonly QualificationCase[];
};

/** ⭐ Each case's first prompt as the confirmed prototype rendered it (`REG-D-136`): its SHA-256, written here. */
const CONFIRMED: readonly (readonly [caseId: string, sha256: string])[] = [
	['W12-CLEAN', '18526400fb50470f009b42b12116af6cd6a985df56e64e2a61f853b781087d75'],
	['W12-CSV-CLEAN', 'c0055dd908072cd09e2fbbe7e25448f35203ae90522f1bd65bf6ae095216a096'],
	['D12-TA-08', '93703bf2d777b9f154b38b33294a1bcbaa5b1f8aff7c42d9acbd6429684a3d40']
];

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** The first prompt the product's validator sends for a case, its transport a stub that answers SATISFIED. */
async function firstPromptOf(c: QualificationCase): Promise<string> {
	const sent: string[] = [];
	const validator = PRODUCT_SEAMS.validator(async (p) => {
		sent.push(p);
		return JSON.stringify({ findings: [], recommendation: 'SATISFIED' });
	});
	await validator.evaluate(c.subject, { reasoningReview: caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult) });
	return sent[0] ?? '';
}

/** The same case as a WORK RE-RUN's (D28): its view marked, or — a declared case — its first unit's work product. */
function asRerun(c: QualificationCase): QualificationCase {
	const input = c.input as unknown as Record<string, unknown>;
	if (c.arm === 'WORK_PRODUCT')
		return { ...c, input: { ...input, deliverable: { ...(input.deliverable as object), workRerun: true } } } as unknown as QualificationCase;
	const [first, ...rest] = input.workProducts as readonly Record<string, unknown>[];
	return { ...c, input: { ...input, workProducts: [{ ...first, workRerun: true }, ...rest] } } as unknown as QualificationCase;
}

describe('⭐⭐ package O-2 — D28: three confirmed cases of v12, each a unit’s first step, render the confirmed prompts hash for hash (REG-D-136)', () => {
	it('⛔ THE PIN — W12-CLEAN, W12-CSV-CLEAN and D12-TA-08, unmarked as confirmed: each first prompt is the confirmed one, byte for byte', async () => {
		expect([FIXTURE.caseSetVersion, FIXTURE.cases.map((c) => c.id)], 'arrangement: the fixture’s cases').toEqual([12, CONFIRMED.map(([id]) => id)]);
		expect(JSON.stringify(FIXTURE), 'arrangement: a confirmed case carries a re-run’s mark').not.toContain('workRerun');
		const rendered: [string, string][] = [];
		for (const c of FIXTURE.cases) rendered.push([c.id, sha256(await firstPromptOf(c))]);
		expect(rendered, 'a confirmed first step’s prompt moved').toEqual(CONFIRMED);
	});

	it('⭑ CONTROL — the pin can fail: each case marked a work re-run renders another prompt, which holds the re-run’s words', async () => {
		for (const c of FIXTURE.cases) {
			const prompt = await firstPromptOf(asRerun(c));
			expect(sha256(prompt), `${c.id}: marked a work re-run, it rendered the confirmed prompt`).not.toBe(CONFIRMED.find(([id]) => id === c.id)![1]);
			expect(prompt, `${c.id}: marked a work re-run, it reads none of the re-run’s words`).toMatch(
				c.arm === 'WORK_PRODUCT' ? /since its first step began/ : /"workRerun":true/
			);
		}
	});
});
