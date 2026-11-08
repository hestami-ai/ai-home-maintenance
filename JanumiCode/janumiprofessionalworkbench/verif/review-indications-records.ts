// ⭐⭐ `JAN-EXEC` Phase 7, package Z2b — D50's ACCEPTANCE AND CONTROL 9, THE PRODUCT'S SIDE (`REG-D-146`;
// `DESIGN-data-flow-order-and-deliverable-review.md` §12.2, revision 9; `ROADMAP-undertaking-execution-sandbox.md` §9b.5b, Z2
// "Acceptance and control 9"): the first prompt the product's validator sends for a case, its potential indications from a records
// source — the committed records' static source in the committed test (`review-indications-records.test.ts`), records made against
// the stub outside it — and the control's prompt, rendered by the function the validator sends through with one character of the
// block's fixed text changed.
// ⭑ The reference builder's side is Python's: `build_checkptr2.py`'s `new_block` and `build_n` applied to Run A's measured prompt
// with the records' scores (`z2b-facts.md`), its hashes written to the fixture the committed test reads.
import { createHash } from 'node:crypto';
import {
	createAgyReasoningReviewValidator,
	reviewPrompt,
	type IndicationsSource
} from '../apps/rph-demo/src/lib/server/assurance/reasoning-review-validator.js';
import { REVIEW_SECTION_TEXT, type ReviewSectionText } from '../apps/rph-demo/src/lib/server/assurance/review-section.js';
import type { QualificationCase } from '../scripts/reviewer-qual/cases.js';
import { PRODUCT_SEAMS } from '../scripts/reviewer-qual/fingerprint.js';
import { caseReviewInput } from '../scripts/reviewer-qual/materialize.js';

export const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

/** ⭐ The control's edit: one character of the block's fixed text removed (`one question at a time` → `one question at a tim`). */
export const CONTROL_TEXT: ReviewSectionText = {
	...REVIEW_SECTION_TEXT,
	INDICATIONS_SAYS: REVIEW_SECTION_TEXT.INDICATIONS_SAYS.replace('one question at a time', 'one question at a tim')
};

const inputOf = (c: QualificationCase) => caseReviewInput(c, PRODUCT_SEAMS.criteria, PRODUCT_SEAMS.processResult);

/** The first prompt the product's validator sends for `c`, its reviewer a capture, its indications `source`. */
export async function firstPromptOf(c: QualificationCase, source: IndicationsSource): Promise<string> {
	const sent: string[] = [];
	await createAgyReasoningReviewValidator({
		agentId: 'jpwb-acceptance',
		modelId: 'jpwb-acceptance-reviewer',
		providerId: 'jpwb-acceptance',
		clock: () => '1970-01-01T00:00:00.000Z',
		indications: source,
		print: async (p) => {
			sent.push(p);
			return JSON.stringify({ findings: [], recommendation: 'SATISFIED' });
		}
	}).evaluate(c.subject, { reasoningReview: inputOf(c) });
	if (sent[0] === undefined) throw new Error(`${c.id}: no prompt was sent`);
	return sent[0];
}

/** One case's acceptance: its first prompt's hash; the control's, through `reviewPrompt` with `CONTROL_TEXT`; and whether
 *  `reviewPrompt` with the product's text renders exactly what the validator sent — so the control's difference is the edit's. */
export async function acceptanceOf(
	c: QualificationCase,
	source: IndicationsSource
): Promise<{ readonly prompt: string; readonly control: string; readonly rendersAsSent: boolean }> {
	const sent = await firstPromptOf(c, source);
	const rendered = await reviewPrompt(inputOf(c), source);
	return { prompt: sha256(sent), control: sha256(await reviewPrompt(inputOf(c), source, CONTROL_TEXT)), rendersAsSent: rendered === sent };
}
