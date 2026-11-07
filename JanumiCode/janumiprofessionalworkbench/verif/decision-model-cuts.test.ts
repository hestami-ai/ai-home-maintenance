// ⭐⭐ `JAN-EXEC` Phase 7, package Z2a — D51's CUTS, OVER THE WHOLE CASE SET (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-
// review.md` §12.3, revision 9; `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z2 predicted red 3).
//
// ⛔ PREDICTED RED 3 — CUT ACCEPTANCE. The decision model is asked about each check of the policy's list — the rubric's lines, the
// policy's bracket removed — and each statement of the producer's answer and account, by D43's host-label cut: the answer's
// items, the account's sentences, then its assumptions, limitations and residual uncertainty. The reference is the screen's own
// cut (`wide_common.py`, `d46-facts-verbatim.md` V10), run by Python itself over the 97 prompts the product rendered for Run A
// (`decision-model-cuts-v13.json`). The product's requests must ask exactly those, in that order, for 97 of 97 v13 cases.
// ⭑ ITS CONTROL — the same comparison sees one statement changed, one dropped and two swapped.
// ⚠ The nine scratch cases (Run A's three `P14-` and the six `W14-`) are checked outside these tests (`z2a-facts.md`).
// ⛔ No model and no network: the decision model's seam is a function here, which records what it was asked.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	reviewPrompt,
	type IndicationRequest,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { committedCaseSet, PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';
import type { QualificationCase } from '../scripts/reviewer-qual/cases.js';

const ROOT = new URL('../', import.meta.url);

interface Cut {
	readonly checks: readonly (readonly [id: string, label: string])[];
	readonly statements: readonly (readonly [from: string, statement: string])[];
}
const REFERENCE = (
	JSON.parse(readFileSync(new URL('verif/fixtures/reviewer-qual/decision-model-cuts-v13.json', ROOT), 'utf8')) as {
		readonly cases: Readonly<Record<string, Cut>>;
	}
).cases;
const CASES = committedCaseSet(ROOT).cases;

/** ⭐ What the product asks the decision model for `c`, as [id, label] for each check and the text of each statement. */
async function productCut(c: QualificationCase): Promise<{ readonly checks: string[][]; readonly statements: string[] }> {
	let seen: readonly IndicationRequest[] | undefined;
	const source: IndicationsSource = async (requests) => {
		seen = requests;
		return { scores: Object.fromEntries(requests.map((r) => [r.key, 0])) };
	};
	await reviewPrompt(caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult), source);
	if (seen === undefined) throw new Error(`${c.id}: the decision model was not asked`);
	return {
		checks: seen.flatMap((r) => (r.kind === 'check' ? [[r.id, r.label]] : [])),
		statements: seen.flatMap((r) => (r.kind === 'statement' ? [r.statement] : []))
	};
}

/** Whether the product's cut of a case is the reference's, check for check and statement for statement, in order. */
const sameCut = (mine: { checks: string[][]; statements: string[] }, ref: Cut): boolean =>
	JSON.stringify(mine.checks) === JSON.stringify(ref.checks) &&
	JSON.stringify(mine.statements) === JSON.stringify(ref.statements.map(([, s]) => s));

describe('⛔ PREDICTED RED 3 (Z2; D51) — the product asks of the decision model exactly the screen’s cut, 97 of 97 v13 cases', () => {
	it('⭐ arrangement: the reference holds every current case, and 848 checks and 856 statements among them', () => {
		expect(Object.keys(REFERENCE).sort()).toEqual(CASES.map((c) => c.id).sort());
		expect(Object.values(REFERENCE).reduce((n, r) => n + r.checks.length, 0)).toBe(848);
		expect(Object.values(REFERENCE).reduce((n, r) => n + r.statements.length, 0)).toBe(856);
	});

	it('⭐ 97 of 97 equal: every check by its id and label, the bracket removed, and every statement in the cut’s order', async () => {
		const differ: string[] = [];
		for (const c of CASES) if (!sameCut(await productCut(c), REFERENCE[c.id]!)) differ.push(c.id);
		expect(differ, 'the cases whose cut differs from the screen’s').toEqual([]);
	});

	it('⭑ CONTROL — the comparison sees one statement changed, one dropped, two swapped, and a check’s bracket kept', async () => {
		const c = CASES.find((x) => x.id === 'W12-CSV-CLEAN')!;
		const mine = await productCut(c);
		const ref = REFERENCE[c.id]!;
		expect(sameCut(mine, ref), 'arrangement: the case’s own cut is equal').toBe(true);
		const [first, second, ...rest] = mine.statements;
		for (const statements of [[`${first!}x`, second!, ...rest], [second!, ...rest], [second!, first!, ...rest]])
			expect(sameCut({ ...mine, statements }, ref), JSON.stringify(statements.slice(0, 2))).toBe(false);
		const checks = mine.checks.map(([id, label], i) => (i === 0 ? [id!, `${label!} [if unmet: BLOCKING]`] : [id!, label!]));
		expect(sameCut({ ...mine, checks }, ref)).toBe(false);
	});
});
