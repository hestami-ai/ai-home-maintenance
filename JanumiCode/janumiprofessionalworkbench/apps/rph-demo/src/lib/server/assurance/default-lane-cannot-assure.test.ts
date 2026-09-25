// ⭐⭐ THE CHECKER CONTROL — THE STRUCTURAL CHECKER CANNOT JUDGE THE REASONING-REVIEW RUBRIC ALONE, ASSERTED RATHER THAN
// NOTED (`JAN-EXEC` `R32` Control A; retitled in place by `JAN-CRITREAD` J1-3, `REG-D-071` Q3c).
//
// ⭑ WHAT IT MEASURES IS THE CHECKER, NOT THE LANE. It was written as "the gate's default lane cannot assure this floor",
// when thirteen e2e specs were accepted red for exactly that reason (`REG-D-067`). The lane now goes green on the
// declared stand-in: the checker's real judgements plus a remainder each test STIPULATES, recorded as nobody's
// judgement and disclosed on every surface (`DESIGN-what-the-tests-prove.md` §4). That changes nothing measured here.
// The checker still judges TWO of the policy's NINE criteria per arm, and DECLARES so; under `R26` the other seven
// arrive `UNABLE_TO_DETERMINE`, every one mandatory (`severityIfNotMet: 'BLOCKING'`), and `dispositionFromFindings`
// returns `INCONCLUSIVE` for a PERFECTLY CLEAN subject. It is incapable, and it says so — which is also why each
// stipulation on the lane is needed at all.
//
// ⛔ DELETE WHEN THE CHECKER ITSELF IS REPLACED, OR JUDGES ALL NINE. It is written to DIE on its own remedy, the pattern
// `REG-F-409` praises in `REG-F-407`: its failure is the signal that the checker's gap closed — and a checker that
// CLAIMED all nine without judging them (`R26`'s option 3, not chosen) would redden it the same way, which is why
// `mock-reasoning-review-validator.test.ts` guards the declaration separately.
//
// ⛔ AND IT DERIVES THE MANDATORY SET RATHER THAN NAMING IT. `REG-F-409`'s own exit named FIVE criteria; the
// measured undetermined set is SEVEN per arm, and differs BETWEEN arms (`REG-F-417`). A hand-listed expectation
// here would have encoded that same error and then defended it.
import { describe, expect, it } from 'vitest';
import type { ObservedToolCallReport } from '@janumipwb/rph-contracts';
import { createMockReasoningReviewValidator } from './mock-reasoning-review-validator.js';
import {
	dispositionFromFindings,
	SEEDED_REASONING_REVIEW_CRITERIA,
	BLOCKING_SEVERITIES
} from '@janumipwb/rph-assurance';
import { buildPwaGraphExport, type PwaGraphNode } from '@janumipwb/rph-projections';

const SUBJECT = { id: 'pwa-1', semanticVersion: 1 };

/** ⭑ DERIVED FROM THE POLICY, exactly as `reasoningReviewResultFromJudgement` derives it. */
const MANDATORY = SEEDED_REASONING_REVIEW_CRITERIA.filter((c) =>
	BLOCKING_SEVERITIES.has(c.severityIfNotMet)
).map((c) => c.id);

/**
 * ⛔ TAKEN FROM `mock-reasoning-review-validator.test.ts`, WHICH RECORDS WHY IT MUST BE. Its docblock:
 * *“BUILT WITH THE REAL BUILDER, NOT HAND-WRITTEN JSON. The first version of this fixture invented a
 * shape (`edges` instead of `permits`) and `analyzePwaGraph` threw — a control that fails for its OWN
 * reason proves nothing about the subject.”*
 *
 * ⚠ I MADE THAT EXACT MISTAKE WRITING THIS FILE, one directory over from the warning: an invented
 * `pwuKind`/`expectedOutputs` node made `buildPwaGraphExport` return something `analyzePwaGraph` could
 * not read, and two assertions failed for a reason that had nothing to do with their subject.
 */
const ROOT: PwaGraphNode = {
	id: 'root',
	name: 'root',
	pwuKind: 'PRODUCT_REALIZATION',
	isRoot: true,
	permittedChildTypeIds: [],
	requiredInputs: [],
	requiredOutputs: []
} as PwaGraphNode;

const OBSERVED: ObservedToolCallReport = {
	observation: 'OBSERVED',
	calls: [
		{ ordinal: 1, nameProvenance: 'MINTED_BY_HOST', toolName: 'run_command', outcome: 'COMPLETED' }
	],
	observedCount: 1,
	recordedLimit: 32
};

async function judgeCleanly(framing: 'PWA_GRAPH' | 'WORK_PRODUCT' | 'PROCESS_RESULT') {
	const content =
		framing === 'PWA_GRAPH'
			? JSON.stringify(
					buildPwaGraphExport(
						{ id: 'pwa_t', name: 'T', domain: 'software', version: '0.1.0', publicationStatus: 'DRAFT' } as never,
						[ROOT]
					)
				)
			: JSON.stringify({ finding: 'The route is viable.', basis: 'the whole instruction' });
	return createMockReasoningReviewValidator().evaluate(SUBJECT as never, {
		reasoningReview: {
			content,
			criteria: SEEDED_REASONING_REVIEW_CRITERIA,
			framing,
			prompt: 'x',
			...(framing === 'PROCESS_RESULT' ? { observedToolCalls: OBSERVED } : {})
		}
	} as never);
}

describe('⛔ the checker control — the structural checker judges two of nine per arm and CANNOT assure the reasoning-review floor alone, and says so (delete when the checker itself is replaced, or judges all nine)', () => {
	it('⭐ precondition: EVERY reasoning-review criterion is mandatory, derived from the policy', () => {
		// ⛔ THIS IS WHAT MAKES THE REST OF THE FILE MEAN ANYTHING, and it is the limb a severity downgrade
		// attacks. If a criterion's `severityIfNotMet` drops below BLOCKING it stops being mandatory, an
		// `UNABLE_TO_DETERMINE` on it stops forcing INCONCLUSIVE — and the floor starts SATISFYING over criteria
		// nobody judged, which is `REG-F-409` verbatim. ⚠ Measured during costing: that one-line edit is caught
		// by 2 tests out of 4202, NEITHER of them in `packages/`. This is the guard that was missing.
		expect(MANDATORY.length, 'a reasoning-review criterion stopped being mandatory').toBe(
			SEEDED_REASONING_REVIEW_CRITERIA.length
		);
	});

	for (const framing of ['PWA_GRAPH', 'WORK_PRODUCT', 'PROCESS_RESULT'] as const) {
		it(`⛔ ${framing}: a CLEAN subject still leaves mandatory criteria unjudged, so the floor is INCONCLUSIVE`, async () => {
			// THE MUTANT THAT KILLS THIS: teach the checker to claim it evaluated all nine — `R26`'s option 3,
			// which the sponsor did not choose (`REG-F-446`). This file then goes green-by-fabrication, which is why
			// `mock-reasoning-review-validator.test.ts` guards the DECLARATION separately.
			const r = await judgeCleanly(framing);
			const undetermined = r.criteria
				.filter((c) => c.outcome === 'UNABLE_TO_DETERMINE')
				.map((c) => c.criterionId);

			expect(
				undetermined.filter((id) => MANDATORY.includes(id)).length,
				`${framing}: no mandatory criterion is unjudged — the checker may now judge all nine`
			).toBeGreaterThan(0);

			// ⭑ THE COMPOSITION, NOT JUST THE MAPPING. `reviewer-silence-is-not-a-pass` asserts the rule in
			// isolation; this asserts what the rule does to a real validator's real output.
			expect(
				dispositionFromFindings({ findings: [], criteria: r.criteria }),
				`${framing}: the checker alone reached a definite verdict over criteria nobody judged`
			).toBe('INCONCLUSIVE');
		});
	}

	it('⭐ CONTROL — the criteria it DOES examine are genuinely judged, so this is not "nothing works"', async () => {
		// ⛔ WITHOUT THIS, EVERY ASSERTION ABOVE PASSES FOR A CHECKER THAT EXAMINES NOTHING AT ALL — and
		// "INCONCLUSIVE because it judged nothing" would be indistinguishable from "INCONCLUSIVE because it
		// judged two of nine". The lane's stipulations rest on the SECOND being true: the stand-in completes only a
		// subject the checker READ (§4.1 rule 2).
		const r = await judgeCleanly('PWA_GRAPH');
		const judged = r.criteria.filter((c) => c.outcome !== 'UNABLE_TO_DETERMINE');
		expect(judged.length, 'the checker judged nothing at all').toBeGreaterThan(0);
		expect(
			judged.every((c) => c.outcome === 'MET'),
			'a clean subject produced a fault on a criterion the checker DID examine'
		).toBe(true);
	});
});
