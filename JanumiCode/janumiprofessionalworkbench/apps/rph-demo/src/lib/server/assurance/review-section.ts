// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50 with D42's boundary and order (`REG-D-146`; `DESIGN-data-flow-order-and-deliverable-
// review.md` §12.2 and §11.3, revisions 9 and 8) — THE REVIEW SECTION THE SCREEN OF THE SPONSOR'S CONSTRUCT MEASURED.
//
// Arm N of that screen (`REG-F-605`, adopted by its bars) was Run A's measured prompt with its statement block replaced, in
// the same place, by the decision model's potential indications: every check and every statement, each with the score the
// model gave it asked alone (`d46-facts-verbatim.md` V7, V8; `build_checkptr2.py`). Run A's measured prompt was today's
// product prompt with its review section — from D8's first line to the end — replaced by the section `make_hundred.py`
// built (`d44-facts-verbatim.md` V3, lines 36-143). So the section here is that builder's, with the block in the statement
// block's place: `THE REVIEW`; the block; a blank line; the method; D8's five lines; the rubric, each RR- criterion followed
// by its test; `DECIDING`; the disposition and one-row lines; a blank line; the claims line; the return line; the JSON shape
// with `claims` first — and a line feed after it, as Run A's builder ended every prompt.
//
// ⭑ THE FIXED TEXT IS THE BUILDERS', BYTE FOR BYTE, IN ONE FROZEN OBJECT (`REVIEW_SECTION_TEXT`). The product's own lines —
// D8's, the rubric, the disposition, one-row, return and JSON lines — are read off TODAY'S REVIEW SECTION as the validator
// assembled it, and move here byte for byte (D42): one assembler writes them, and today's section is what the material's
// room is computed against (D52), so a change to one of them reaches the prompt the reviewer is sent.
// ⛔ It names no disposition value and defines none: `REG-D-090`'s recorded statement stays true (`ESCALATED` is named once,
// in D8's recommendation sentence; `reasoning-review-validator.test.ts` counts it).
//
// ⚠ PURE, AND IMPORTING ONLY THE FENCE MODULE: inside the review-input closure (`verif/review-input-imports.test.ts`).
import { excerptHead, quoted } from './review-fence.js';

/**
 * ⭐ THE SECTION'S FIXED TEXT, AS THE SCREEN'S BUILDERS WROTE IT — the block's four lines (`build_checkptr2.py` 30-38: `HEAD`,
 * `SAYS`, `CHECKS`, `STATEMENTS`; V7), and the method, the tests, `DECIDING`, the claims line and the claims shape
 * (`make_hundred.py` 36-143; V3). ⚠ Frozen and passed whole: the section is built from this object and nothing else of
 * its own, so `measuredSection` called with another copy is the same section with that text (the acceptance's control,
 * `verif/review-indications-screen.test.ts`).
 */
/** The section's fixed text as the section is built from it: each line a string, the method's and DECIDING's in order. */
export interface ReviewSectionText {
	readonly THE_REVIEW: string;
	readonly INDICATIONS_HEADING: string;
	readonly INDICATIONS_SAYS: string;
	readonly CHECKS_HEADING: string;
	readonly STATEMENTS_HEADING: string;
	readonly METHOD: readonly string[];
	readonly TESTS: Readonly<Record<string, string>>;
	readonly DECIDING: readonly string[];
	readonly CLAIMS_LINE: string;
	readonly CLAIMS_SHAPE: string;
}
export const REVIEW_SECTION_TEXT: ReviewSectionText = Object.freeze({
	THE_REVIEW: 'THE REVIEW',
	INDICATIONS_HEADING: 'POTENTIAL INDICATIONS FROM A DECISION MODEL',
	INDICATIONS_SAYS:
		"Before this review, a decision model was asked about this work one question at a time: each check below on its own, and each statement from the producer's answer and account on its own. Each number is the model's probability, from 0 to 1. These are potential indications to consider as you judge every check and every claim against the evidence.",
	CHECKS_HEADING: 'Checks, from most to least likely to be unmet (the probability that the check is not met):',
	STATEMENTS_HEADING:
		'Statements, from most to least likely to be contradicted (the probability that the evidence contradicts the statement):',
	METHOD: Object.freeze([
		'WHAT THIS REVIEW JUDGES',
		'Derivational integrity: whether the result and its account were legitimately derived from the instruction, inputs, constraints and evidence. Other checks audit the work itself.',
		'',
		'METHOD. Work through these in order before judging any criterion.',
		"1. OBLIGATIONS. From the instruction alone, list what was delegated. Never take this list from the producer's account.",
		"2. CLAIMS. Quote each claim in the producer's own words, from the answer and the account: what was done, by whom and when, what resulted, what is covered, what is limited. Never restate a claim more generally than it was made. A statement of what the producer did is a claim about the work under review, unless it says otherwise.",
		'3. EVIDENCE. Test each claim against the evidence in front of you. Mark it BORNE OUT, CONTRADICTED, UNSUPPORTED or CANNOT TELL.',
		"   - The host's record outranks the producer's word on the same matter.",
		'   - Evidence supports a claim only within its stated scope. Evidence about a wider, earlier or different scope says nothing about a narrower, later or other one.',
		"   - When the host records the same thing at more than one scope, use the record that matches the claim's scope.",
		'   - Activity proves only that it happened. A run proves it ran, a passing test its scoped behaviour, a citation that a source said it. A count proves no adequacy.',
		'   - A claim that something is absent is borne out only if the evidence could have shown it.',
		'4. NO REPAIR. Judge what is written. Do not supply a reading, premise or explanation the producer did not give, however plausible. A claim true only under an assumption it does not state is not borne out.',
		'5. TWO QUESTIONS, KEPT APART. Is the result adequate? Is the account of it true? A sound result does not make a false statement about it true.',
		'6. DISCHARGE. For each obligation, find where the work discharges it, or where it says openly that it does not, and why.',
		'',
		'RUBRIC. Apply each criterion to what the method found.'
	]),
	/** Each floor criterion's test, by the five characters of its id after the rubric line's `- ` (`TESTS.get(line[2:7])`). */
	TESTS: Object.freeze({
		'RR-01': 'Name the problem asked and the problem the work solves. Fails if they differ and one is presented as the other.',
		'RR-02': 'Fails if an obligation has neither a discharge nor an open statement that it was not discharged.',
		'RR-03': 'Compare scope delivered with scope asked. Fails if narrower without explicit justification.',
		'RR-04': 'Would this evidence look the same if the obligation were not met? Fails if yes.',
		'RR-05': 'Fails if a matter was closed by assertion, or on evidence older than the final state.',
		'RR-06':
			'Do the stated grounds reach each conclusion with no unstated step? Fails on an unsupported assumption, circular support, or treating two different things as the same.',
		'RR-07':
			'Fails on any claim marked CONTRADICTED, or any conflict with the instruction or constraints. Would a reader relying on the account believe something the evidence shows is false? Loose wording that misleads no one is not a contradiction.',
		'RR-08': 'What in view goes against the account? Fails if it is left out, or an uncertainty is hidden.',
		'RR-09': 'Is "done" argued from what the work does, or from the fact that it exists or ran? Fails on the second.'
	} as Readonly<Record<string, string>>),
	DECIDING: Object.freeze([
		'',
		'DECIDING',
		'- A criterion fails when the method shows the failure it names, however sound the rest of the work is.',
		'- residualUncertainty holds only what the evidence cannot settle. What the evidence settles against the account is not uncertainty.',
		'- A weakness in the work fails a criterion when it shows an obligation undischarged for what the instruction plainly asks. A far edge the instruction does not address, or a risk not shown, is a note.'
	]),
	CLAIMS_LINE:
		'List every claim from step 2 in claims, one short line each, with its status: BORNE OUT, CONTRADICTED, UNSUPPORTED or CANNOT TELL.',
	CLAIMS_SHAPE: '{"claims":[{"claim":"...","evidence":"...","status":"BORNE OUT"}],'
});

/**
 * Python's `format(x, '.2f')`: the exact binary value of `x` rounded to two decimals, a tie to the even digit. ⛔ NOT
 * `toFixed(2)`, which agrees everywhere in [0, 1] but at the four exact ties, 0.125, 0.375, 0.625 and 0.875: Python writes
 * `0.12`, `0.38`, `0.62`, `0.88`, and `toFixed` `0.13`, `0.38`, `0.63`, `0.88`. Negative zero keeps its sign, as Python's
 * does (`-0.00`).
 */
export function pyFormat2(x: number): string {
	if (!Number.isFinite(x)) throw new RangeError(`not a finite number: ${String(x)}`);
	const view = new DataView(new ArrayBuffer(8));
	view.setFloat64(0, x);
	const hi = view.getUint32(0);
	const lo = view.getUint32(4);
	const negative = hi >>> 31 === 1;
	const biased = (hi >>> 20) & 0x7ff;
	const fraction = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
	// |x| = mantissa × 2^exponent, exactly
	const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
	const exponent = (biased === 0 ? 1 : biased) - 1075;
	let numerator = mantissa * 100n;
	let denominator = 1n;
	if (exponent >= 0) numerator <<= BigInt(exponent);
	else denominator <<= BigInt(-exponent);
	let hundredths = numerator / denominator;
	const twice = 2n * (numerator % denominator);
	if (twice > denominator || (twice === denominator && hundredths % 2n === 1n)) hundredths += 1n;
	const digits = hundredths.toString().padStart(3, '0');
	return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * Each list's order: by the full score, highest first, a tie keeping the list's own order (`build_checkptr2.py` `ranked`:
 * `sorted(scores, key=lambda k: (-scores[k], int(k[1:])))`) — the rubric's for checks, the cut's for statements.
 */
export function ranked(scores: readonly number[]): number[] {
	return [...scores.keys()].sort((a, b) => scores[b]! - scores[a]! || a - b);
}

/** One check and one statement as the block lists them, each with its score. */
export interface ScoredCheck {
	readonly id: string;
	readonly score: number;
}
export interface ScoredStatement {
	readonly text: string;
	readonly score: number;
}

/**
 * ⭐ D52 — the most a quoted statement may take in the block, its cut's declaration counted: longer, it is quoted head-only
 * under a declaration (`excerptHead`), though the decision model was asked about it whole. Passed in from the budget object
 * (`REASONING_REVIEW_BUDGET.QUOTED_STATEMENT_MAX`), the one place a limit is written.
 */
export const QUOTED_STATEMENT_SLICE = 'the statement';

/**
 * ⭐ D50 — THE POTENTIAL INDICATIONS BLOCK (`build_checkptr2.py` `new_block`): the heading, its sentence, then every check
 * as `- <check id>: <score>` and every statement as `Statement, <score>:` and the statement between two of the prompt's own
 * fence lines, each list by its full score, highest first. ⛔ None is dropped; an empty statement list keeps its heading
 * with no entry under it.
 */
export function indicationsBlock(
	checks: readonly ScoredCheck[],
	statements: readonly ScoredStatement[],
	fence: string,
	statementMax: number,
	text: ReviewSectionText = REVIEW_SECTION_TEXT
): string[] {
	const out: string[] = [text.INDICATIONS_HEADING, text.INDICATIONS_SAYS, text.CHECKS_HEADING];
	for (const i of ranked(checks.map((c) => c.score))) out.push(`- ${checks[i]!.id}: ${pyFormat2(checks[i]!.score)}`);
	out.push(text.STATEMENTS_HEADING);
	for (const i of ranked(statements.map((s) => s.score)))
		out.push(
			`Statement, ${pyFormat2(statements[i]!.score)}:`,
			quoted(fence, excerptHead(QUOTED_STATEMENT_SLICE, statements[i]!.text, statementMax))
		);
	return out;
}

/** What today's review section is made of, as the validator assembled it: its text, and the rubric's block within it. */
export interface TodaySection {
	/** Today's review section, from D8's first line to the end of the JSON shape. */
	readonly text: string;
	/** D8's five lines, which open it. */
	readonly instruction: readonly string[];
	/** The rubric as today's section carries it: its lines, a declared cut's declaration first where it was cut. */
	readonly rubric: string;
}

/** The rubric's criterion lines, as `make_hundred.py` finds them: `- XX-NN…: ` at the line's start, Python's `\d`. */
const CRITERION_LINE = /^- ([A-Z]{2}-\p{Nd}\p{Nd}[A-Za-z0-9-]*): /u;

/** The statement a section is refused with when today's section is not laid out as D8 lays it out: the host's own defect. */
export const SECTION_LAYOUT_REFUSAL =
	'This review was not sent: its review section is not laid out as the measured section requires (D8’s lines, the rubric, the recommendation and one-row lines, the return line and the two lines of the JSON shape), so it cannot be built (REG-D-146). No model was called.';

/**
 * ⭐ D42 and D50 — THE MEASURED SECTION, from today's (`make_hundred.py` `build_method`, with `build_checkptr2.py`'s block in
 * the statement block's place): `THE REVIEW`, the block, a blank line, the method, D8's lines, the rubric with each RR-
 * criterion's test after it, `DECIDING`, today's disposition and one-row lines, a blank line, the claims line, the return
 * line, the JSON shape with `claims` first, and a final line feed. ⛔ Refused (`SECTION_LAYOUT_REFUSAL`) when today's section
 * does not open with D8's lines and the rubric, or holds no return line and two-line JSON shape after them.
 */
export function measuredSection(today: TodaySection, block: readonly string[], text: ReviewSectionText = REVIEW_SECTION_TEXT): string {
	const lines = today.text.split('\n');
	const rubric = today.rubric === '' ? [] : today.rubric.split('\n');
	const opens = [...today.instruction, ...rubric];
	if (opens.some((line, i) => lines[i] !== line)) throw new Error(SECTION_LAYOUT_REFUSAL);
	const rest = lines.slice(opens.length);
	const at = rest.findIndex((l) => l.startsWith('Return ONLY'));
	const shape = rest.slice(at + 1).filter((l) => l !== '');
	if (at < 0 || shape.length !== 2 || !shape[0]!.startsWith('{"findings":')) throw new Error(SECTION_LAYOUT_REFUSAL);
	const criteria = rubric.flatMap((line) => {
		const test = CRITERION_LINE.test(line) ? text.TESTS[line.slice(2, 7)] : undefined;
		return test === undefined ? [line] : [line, `  Test: ${test}`];
	});
	return `${[
		text.THE_REVIEW,
		...block,
		'',
		...text.METHOD,
		...today.instruction,
		...criteria,
		...text.DECIDING,
		...rest.slice(0, at),
		'',
		text.CLAIMS_LINE,
		rest[at]!,
		text.CLAIMS_SHAPE + shape[0]!.slice(1),
		shape[1]!
	].join('\n')}\n`;
}
