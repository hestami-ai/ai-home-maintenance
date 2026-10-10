// ⭐⭐ `JAN-EXEC` Phase 7 P7-6R, fix A3 (`P76F-A`; `docs/_working/DESIGN-the-stopped-unit-recovery.md` RD4; `REG-D-104` (1);
// `REG-D-105` (3)) — WHAT AUTHORISES A PERSON'S CHOICE ON A WAITING UNIT, CITED IN ITS DECISION.
//
// RD4: *"The authorising policy is the ruling itself, cited in the rationale's template. No policy object exists for a
// person's re-run, and the record says so rather than inventing one."*
// ⛔ THE FIRST BUILD RECORDED THE TYPED TEXT ALONE. Its Decision's `authority` is the person (a HUMAN actor, `REG-F-014`), but
// what AUTHORISED the act was named nowhere — and a reader looking for the governing policy found none and no sentence
// saying so, which reads as a policy missing rather than one that does not exist. So each Decision's rationale is now the
// person's own words, VERBATIM, then one fixed citation per act: the ruling, and the statement that no policy object
// authorises the choice.
// ⭑ A MODULE OF ITS OWN, WITH NO IMPORTS, so the page's end-to-end specs can pin the exact citation the server writes
// without loading the engine.

/** ⭐ The ruling's three acts, as `REG-D-104` (1) names them — the clause every citation below opens with. */
const RULING =
	'Authority: the sponsor’s ruling REG-D-104 (1) — a work unit whose review refused it waits for a person, who re-runs its review, re-runs its work with the findings, or abandons it';

/** ⭐ RE-RUN THE REVIEW — `REG-D-104` (1), and `REG-D-105` (3), which offers it only after a review that did not conclude. */
export const RERUN_REVIEW_CITATION =
	`${RULING}; and REG-D-105 (3), which offers a re-run of the review only after a review that did not conclude. ` +
	'No policy object authorises a person’s re-run, and none is cited: the ruling is the authority (DESIGN-the-stopped-unit-recovery.md RD4).';

/** ⭐ RE-RUN THE WORK — `REG-D-104` (1), and `REG-D-105` (3), which keeps it after a review that concluded against the work. */
export const RERUN_WORK_CITATION =
	`${RULING}; and REG-D-105 (3), which keeps a re-run of the work, with the findings, after a review that concluded against the work. ` +
	'No policy object authorises a person’s re-run, and none is cited: the ruling is the authority (DESIGN-the-stopped-unit-recovery.md RD4).';

/**
 * ⭐ ABANDON A WAITING UNIT — `REG-D-104` (1) alone: `REG-D-105` (3) rules which RE-RUNS are offered, and abandonment is
 * offered after every refusal. ⚠ Only for a unit WAITING after a refusal; abandoning any other unit is the S-1 path, whose
 * rationale is what the person gave and nothing more.
 */
export const ABANDON_FROM_WAITING_CITATION =
	`${RULING}. ` +
	'No policy object authorises a person’s choice to abandon a waiting unit, and none is cited: the ruling is the authority, and this Decision is the one AbandonPwu requires (DESIGN-the-stopped-unit-recovery.md RD4).';

/**
 * ⭐ THE DECISION'S RATIONALE: the person's typed text, VERBATIM, a blank line, then the act's citation. ⛔ Nothing in the
 * typed text is altered — not its line breaks, not its punctuation — so the reason a person gave is the reason recorded.
 */
export function decisionRationale(typed: string, citation: string): string {
	return `${typed}\n\n${citation}`;
}
