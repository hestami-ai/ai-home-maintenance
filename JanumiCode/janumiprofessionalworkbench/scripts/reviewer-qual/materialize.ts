// ⭐ `JAN-CRITREAD` J2-1 — A CASE, THROUGH THE REVIEWER-SIDE ASSEMBLY PRODUCTION USES, AND NOTHING ELSE (§5.2).
//
// The graph arm's literal `PwaMeta` + `PwaGraphNode[]` go through the already-pure `buildPwaGraphExport`, and each
// arm through the builder its production floor calls (`review-input.ts`, held to both floors byte for byte by
// `review-input.test.ts`). The criteria are the caller's: the qualification runs judge a case under the policy's
// criteria as seeded, which is what a fresh deployment holds.
// ⭐ `JAN-PRQUAL` `PQ-2` (DESIGN-process-result-qualification.md D4) — AND THE PROCESS-RESULT ARM, EXHAUSTIVELY: a case's
// run literal is rendered HERE, at materialize time, by the builder `runProcessResultFloor` builds through
// (`processResultReviewInput`, held to that floor byte for byte by `review-input.test.ts`'s third block), so a change to
// what the reviewer of a process result reads reaches the case's prompt and owes a RUN. ⛔ Every arm is a case of the
// switch below, and an arm it does not name is refused — by the type checker, and at run time: before `PQ-2` a
// process-result case went to the work-product builder, and no prompt could be built from it (design G5).
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { buildPwaGraphExport } from '@janumipwb/rph-projections';
import {
	graphReviewInput,
	processResultReviewInput,
	workProductReviewInput
} from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';
import type { QualificationCase } from './cases.js';
import type { ProcessResultBuilder } from './probes.js';

/**
 * What the reasoning reviewer is handed for `c`, under `criteria`.
 *
 * ⭐ `PQ-2` — `processResult` is the builder a process-result case is rendered through: the product's own everywhere but
 * where the fingerprint measures its builder seam (`fingerprint.ts` `casePromptsOf` hands it the seams' `processResult`,
 * so a renderer change made at that seam is measured on the case prompts it reaches, never as one that reaches none).
 */
export function caseReviewInput(
	c: QualificationCase,
	criteria: readonly AssessmentCriterion[],
	processResult: ProcessResultBuilder = processResultReviewInput
): ReasoningReviewInput {
	switch (c.arm) {
		case 'PWA_GRAPH': {
			const { pwa, nodes, ...rest } = c.input;
			return graphReviewInput({ criteria, graph: buildPwaGraphExport(pwa, nodes), ...rest });
		}
		case 'WORK_PRODUCT':
			return workProductReviewInput({ criteria, ...c.input });
		case 'PROCESS_RESULT':
			return processResult({ criteria, ...c.input });
		default: {
			const none: never = c;
			throw new Error(`a case of no arm this assembly knows: ${JSON.stringify((none as { arm?: unknown }).arm)}`);
		}
	}
}
