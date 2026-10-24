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
// ⭐⭐ `JAN-EXEC` Phase 7, the review in parts, B7 (`REG-D-125`; DESIGN-authoring-review-in-parts.md §5) — AND THE PART ARM,
// THROUGH THE PRODUCT'S TWO BUILDERS: a part case's graph is exported by `buildPwaGraphExport`, cut into its parts by
// `pwaTypeParts` — the export-to-parts function the authoring floor is to cut a candidate with — and its part's review input
// built by `pwaTypeReviewInput`, the one builder of a part's review. ⛔ Never a part literal, and never the graph's builder.
import type { ReasoningReviewInput } from '@janumipwb/rph-assurance';
import type { AssessmentCriterion } from '@janumipwb/rph-contracts';
import { buildPwaGraphExport, pwaTypeParts } from '@janumipwb/rph-projections';
import {
	declaredPolicyReviewInput,
	graphReviewInput,
	processResultReviewInput,
	pwaTypeReviewInput,
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
		case 'DECLARED_POLICY': {
			// ⭐⭐ `JAN-EXEC` Phase 7 completion E2 (design B5) — THE DECLARED ARM, through the builder Record Assurance builds with
			// (`declaredPolicyReviewInput`). ⛔ ITS CRITERIA ARE THE CASE'S OWN POLICY'S, never `criteria` — the floor's seeded
			// rubric, which a declared review never sees.
			const { policy, ...work } = c.input;
			return declaredPolicyReviewInput({
				policy: { policyId: policy.policyId, name: policy.name, purpose: policy.purpose },
				criteria: policy.criteria,
				// ⭐ `E12F` F4 — every declared case's instruction is its unit's rendered prompt (`case-set-v5.ts`: THE
				// INSTRUCTION), the prompt its one producer was given: the phase's shape, never the root's.
				instructionIs: 'PRODUCING_PROMPT',
				...work
			});
		}
		case 'PWA_TYPE': {
			// ⭐⭐ B7 — ONE TYPE OF THE GRAPH, AS ITS PART: the export cut by `pwaTypeParts`, the case's type's part handed to
			// `pwaTypeReviewInput` with the request, the account and the narration, as the graph's builder is handed them.
			// ⛔ A type the graph does not hold is refused: no other part is reviewed in its place.
			const { pwa, nodes, typeId, ...rest } = c.input;
			const part = pwaTypeParts(buildPwaGraphExport(pwa, nodes)).find((p) => p.typeId === typeId);
			if (part === undefined)
				throw new Error(`${c.id}: a part case names the type ${typeId}, which its graph does not hold`);
			return pwaTypeReviewInput({ criteria, part, ...rest });
		}
		default: {
			const none: never = c;
			throw new Error(`a case of no arm this assembly knows: ${JSON.stringify((none as { arm?: unknown }).arm)}`);
		}
	}
}
