// REG-F-042 — CONDITIONALLY SATISFIED WORK CANNOT ENTER RECOMPOSITION, AND THE ENGINE USED TO LET IT.
//
// TWO CANON RULES EXCLUDE IT BY NAME, in the same document, each citing the other.
//   JPWB-DOC-003 §7 DEC-6: "'Assured required child results' EXCLUDES conditionally satisfied dispositions: a
//   conditionally satisfied child contributes to recomposition or promotion ONLY THROUGH AN EXPLICIT,
//   POLICY-PERMITTED ACT THAT CLOSES ITS CONDITION (STA-4, ASR-9)."
//   JPWB-DOC-003 §6 STA-4: "conditionally satisfied work CANNOT ENTER RECOMPOSITION or baseline promotion."
//
// The engine's acceptable-child set admitted it anyway, and there is no condition-closing act in the machine —
// so it was admitting the antecedent of an exception whose discharge cannot be performed. Fail-closed is the
// only honest reading.
//
// HOW IT SURVIVED IS THE INSTRUCTIVE PART: the comment above the set cited "§14.1", a section of RPH-DOC-002,
// which CON-000 B1 makes HISTORICAL MATERIAL (REG-F-049). A set contradicting canon read as sourced because
// its citation pointed at the weaker document. The rules that actually bind are canon and say the opposite.
//
// ⚠ THIS IS THE WEAKER OF THE TWO POSSIBLE TESTS, AND IT SAYS SO. The stronger one drives a real child to
// CONDITIONALLY_SATISFIED through the assurance path and asserts the recomposition lands INSUFFICIENT. It is
// not written here for two reasons, both disclosed rather than convenient: reaching that disposition honestly
// requires a policy, an assessment and a MATERIAL finding (fabricating `assuranceState` directly is forbidden
// in this repository — `pwu.test.ts` records a test corrected for exactly that), and recomposition is
// undispatched in production, so an end-to-end drive would exercise a path nothing walks. What this test does
// buy is the future: it reddens the day somebody re-adds the value, and it names the two rules in the failure.

import { describe, expect, it } from 'vitest';
import { ACCEPTABLE_CHILD_ASSURANCE } from './decomposition.js';

describe('REG-F-042 — the acceptable-child set matches canon, not the historical citation it carried', () => {
	it('CONDITIONALLY_SATISFIED is excluded — DEC-6 and STA-4 both say so by name', () => {
		expect(
			ACCEPTABLE_CHILD_ASSURANCE.has('CONDITIONALLY_SATISFIED'),
			'JPWB-DOC-003 §7 DEC-6 excludes conditionally satisfied dispositions from "assured required child ' +
				'results" unless an explicit, policy-permitted act closes the condition, and §6 STA-4 says such work ' +
				'"cannot enter recomposition". NO CONDITION-CLOSING ACT EXISTS IN THIS ENGINE, so admitting the state ' +
				'admits the antecedent of an exception that cannot be discharged. If a closing act has since been ' +
				'built, change this test WITH it — not before it.'
		).toBe(false);
	});

	// THE CONTROL. Without it, an empty set would satisfy the assertion above and no child would ever be
	// acceptable — a recomposition that can never succeed is not stricter, it is broken. REG-F-015's anatomy:
	// a true assertion about an arrangement that never happened.
	it('CONTROL — SATISFIED remains acceptable, so the set still admits something', () => {
		expect(ACCEPTABLE_CHILD_ASSURANCE.has('SATISFIED'), 'the set must not be empty').toBe(true);
	});

	// WAIVED IS KEPT, AND THE DISTINCTION IS DEC-6'S OWN. A waiver is a ratified, scoped, authority-bearing act
	// — plausibly the very "explicit, policy-permitted act" the rule contemplates. CONDITIONALLY_SATISFIED is
	// the opposite case: its condition is BY DEFINITION still open. Pinned so that a future tightening that
	// removes WAIVED has to argue against DEC-6's exception clause rather than drift past it.
	it('WAIVED remains acceptable — a waiver is the closing act DEC-6 contemplates', () => {
		expect(ACCEPTABLE_CHILD_ASSURANCE.has('WAIVED')).toBe(true);
	});

	// EXACT MEMBERSHIP, so a THIRD value cannot be added silently. The three assertions above would all still
	// pass if someone added `UNASSESSED`.
	it('the set is exactly {SATISFIED, WAIVED}', () => {
		expect([...ACCEPTABLE_CHILD_ASSURANCE].sort()).toEqual(['SATISFIED', 'WAIVED']);
	});
});
