// ⭐ `JAN-CRITREAD` J2-1 — A CASE, THROUGH THE REVIEWER-SIDE ASSEMBLY PRODUCTION USES, AND NOTHING ELSE (§5.2).
//
// The graph arm's literal `PwaMeta` + `PwaGraphNode[]` go through the already-pure `buildPwaGraphExport`, and each
// arm through the builder its production floor calls (`review-input.ts`, held to both floors byte for byte by
// `review-input.test.ts`). The criteria are the caller's: the qualification runs judge a case under the policy's
// criteria as seeded, which is what a fresh deployment holds.
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { buildPwaGraphExport } from '@janumipwb/rph-projections';
import {
	graphReviewInput,
	workProductReviewInput
} from '../../apps/rph-demo/src/lib/server/assurance/review-input.js';
import type { QualificationCase } from './cases.js';

/** What the reasoning reviewer is handed for `c`, under `criteria`. */
export function caseReviewInput(c: QualificationCase, criteria: readonly AssessmentCriterion[]): ReasoningReviewInput {
	if (c.arm === 'PWA_GRAPH') {
		const { pwa, nodes, ...rest } = c.input;
		return graphReviewInput({ criteria, graph: buildPwaGraphExport(pwa, nodes), ...rest });
	}
	return workProductReviewInput({ criteria, ...c.input });
}
