// ⭐⭐ `JAN-EXEC` Phase 7, package Z1 — D50, D52 (`REG-D-146`; design §12.2, §12.4) — THE MEASURED SECTION'S FIXED TEXT, NAMED
// FROM THE DESIGN, AND TODAY'S PROMPT BESIDE THE ONE SENT: what `review-section.test.ts` pins the section byte for byte with,
// and what the restated room pins elsewhere read a sent prompt back to.
// ⚠ IMPORTING TYPES ONLY, as `clearing-reviewer.testing.ts` keeps itself out of the production graph — and binding no stream
// of a run (`verif/agy-stderr-unbound.test.ts` reads every non-test file): the five framing inputs live in the test file.
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';

// ── The section's fixed text, NAMED HERE FROM THE DESIGN — never read from the product (`d46-facts-verbatim.md` V7;
// `d44-facts-verbatim.md` V3): a product that wrote other bytes is another section.
export const FENCE = '<<<UNTRUSTED-00>>>';
export const BLOCK_HEAD = 'POTENTIAL INDICATIONS FROM A DECISION MODEL';
export const BLOCK_SAYS =
	"Before this review, a decision model was asked about this work one question at a time: each check below on its own, and each statement from the producer's answer and account on its own. Each number is the model's probability, from 0 to 1. These are potential indications to consider as you judge every check and every claim against the evidence.";
/**
 * ⭐⭐ `JAN-EXEC` Phase 7, package L9 — D64 (`REG-D-153`; design §12.18; the lead's words) — THE VARIANT SENTENCE, named from the
 * design: the block's second line in a prompt that lists none of the answer's statements.
 */
export const BLOCK_SAYS_ANSWER_UNLISTED =
	"Before this review, a decision model was asked about this work one question at a time: each check below on its own, and each statement from the producer's account on its own. The statements of the producer's answer were not asked about and are not listed, since listing them would make this prompt too long; the answer itself is shown above. Each number is the model's probability, from 0 to 1. These are potential indications to consider as you judge every check and every claim against the evidence.";
export const BLOCK_CHECKS = 'Checks, from most to least likely to be unmet (the probability that the check is not met):';
export const BLOCK_STATEMENTS =
	'Statements, from most to least likely to be contradicted (the probability that the evidence contradicts the statement):';
export const METHOD = [
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
];
export const TESTS: Readonly<Record<string, string>> = {
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
};
export const DECIDING = [
	'',
	'DECIDING',
	'- A criterion fails when the method shows the failure it names, however sound the rest of the work is.',
	'- residualUncertainty holds only what the evidence cannot settle. What the evidence settles against the account is not uncertainty.',
	'- A weakness in the work fails a criterion when it shows an obligation undischarged for what the instruction plainly asks. A far edge the instruction does not address, or a risk not shown, is a note.'
];
export const CLAIMS_LINE =
	'List every claim from step 2 in claims, one short line each, with its status: BORNE OUT, CONTRADICTED, UNSUPPORTED or CANNOT TELL.';
/** D8's five lines and its recommendation sentence, the sponsor's answers byte for byte (design §9.3 D8). */
export const D8_INSTRUCTION = [
	'Evaluate EACH derivational-integrity failure class below. For each, decide whether the FAILURE is PRESENT',
	'(failed=true): present means the artifact does NOT MEET that criterion. What an unmet criterion costs is the',
	"policy's, shown in brackets beside it, whatever severity you give; a concern that leaves the criterion met",
	'is not a failure, so put it in residualUncertainty, not in a failed finding. For each failure give a',
	'one-sentence statement citing specifics, and a severity (INFORMATIONAL|ADVISORY|MATERIAL|BLOCKING|CRITICAL):'
];
export const D8_RECOMMENDATION = [
	'Then give an overall disposition RECOMMENDATION: SATISFIED (no criterion is unmet, except ones the policy',
	'marks ADVISORY or INFORMATIONAL), CONDITIONALLY_SATISFIED (an unmet criterion the policy marks MATERIAL, and',
	'none it marks BLOCKING or CRITICAL), REJECTED (an unmet criterion the policy marks BLOCKING or CRITICAL),',
	'INCONCLUSIVE, or ESCALATED.'
];
export const ONE_ROW =
	'Give exactly one row in findings for each criterion listed above: failed=false where the criterion is met, failed=true where it is not. A criterion that is met is recorded as met; a concern that shows a criterion is not met is recorded failed=true, and never moved to residualUncertainty. An empty findings list leaves every criterion unassessed.';
export const RETURN_LINE = 'Return ONLY a single-line minified JSON object (no markdown, no prose) shaped EXACTLY as:';

/** The rubric's lines as the policy's criteria give them, each RR- criterion of the design's tests followed by its test. */
export const rubricWithTests = (criteria: readonly AssessmentCriterion[]): string[] =>
	criteria.flatMap((c) => {
		const line = `- ${c.id}: ${c.description} [if unmet: ${c.severityIfNotMet}]`;
		const test = TESTS[c.id.slice(0, 5)];
		return test === undefined ? [line] : [line, `  Test: ${test}`];
	});

// ── ⭐⭐ Package Z1 — D52 (`REG-D-146`; design §12.4) — TODAY'S PROMPT, BESIDE THE ONE SENT ─────────────────────────────────
// The material's room is computed against TODAY's review section for the same input, so every cut and every room of the
// prompt before the measured section is today's. These read a sent prompt back to the two parts a pin about the room is
// about: its head, and today's prompt — the head and today's review section, written here from the design (D8's lines, the
// rubric, the recommendation, one-row, return and JSON lines), never read from the product.

/** The prompt before its measured section — its head, the last line feed included. */
export function headOf(prompt: string): string {
	const at = prompt.indexOf('\nTHE REVIEW\n');
	if (at < 0) throw new Error('the prompt has no measured section: no line THE REVIEW');
	return prompt.slice(0, at + 1);
}

/** Today's review section for `criteria`, as D8 lays it out (design §9.3 D8): D8's lines, the rubric, then the rest. */
export function todaySectionFor(criteria: readonly AssessmentCriterion[]): string {
	return [
		...D8_INSTRUCTION,
		...criteria.map((c) => `- ${c.id}: ${c.description} [if unmet: ${c.severityIfNotMet}]`),
		'',
		...D8_RECOMMENDATION,
		'',
		ONE_ROW,
		RETURN_LINE,
		`{"findings":[{"criterionId":"${criteria[0]?.id ?? 'CRITERION-ID'}","failed":false,"statement":"...","severity":"MATERIAL"}],`,
		'"recommendation":"SATISFIED","residualUncertainty":["..."]}'
	].join('\n');
}

/** Today's prompt for the input a sent `prompt` was built for: its head, then today's review section — what the room is computed with. */
export const todayPromptOf = (prompt: string, criteria: readonly AssessmentCriterion[]): string =>
	headOf(prompt) + todaySectionFor(criteria);

/** The indications block's lines in a sent prompt: from its heading to the blank line before the method. */
export function blockOf(prompt: string): string[] {
	const lines = prompt.split('\n');
	const at = lines.indexOf(BLOCK_HEAD);
	const to = lines.indexOf('WHAT THIS REVIEW JUDGES', at);
	return lines.slice(at, to - 1);
}
