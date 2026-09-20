// JAN-ORPHANED `OR-03`/`OR-05` — ONE PLACE THAT STANDS IN FOR A CLEARING REVIEWER, AND ONE PLACE THAT PUTS
// THE PROCESS BACK.
//
// ⛔ WHY A SHARED HELPER RATHER THAN FIVE COPIES. `JPWB_ASSURANCE_TOOL` and `JPWB_JUDGE_MODEL` are
// PROCESS-WIDE, and `createFloorRegistry` reads them at call time: `testMode && !JPWB_ASSURANCE_TOOL` selects
// the deterministic structural checker. So an injected `print` alone does NOT reach the reviewer seam — the
// env must move too, and it must move back. `process-result-floor.test.ts` already warns about this in a
// `finally`; five hand-copied versions of that warning is how one leak becomes routine, and a leak here does
// not fail loudly — it silently switches every LATER test in the same worker onto the live reviewer path.
//
// ⚠ NOTHING IN THE RESTORE MAY THROW. A throw from the cleanup would replace the test's real failure with this
// module's — the rule this repository files as "cleanup must survive".

/**
 * A reviewer's reply that EVALUATED EVERY CRITERION AND FAULTED NONE.
 *
 * ⭐ DERIVED FROM THE CRITERIA THE CALLER IS ABOUT TO HAND THE VALIDATOR, never hand-listed and never from
 * a second import. Nine written-out ids would silently stop covering a tenth — and a helper that read the
 * policy list ITSELF could drift from the list the validator was actually given, which is the same defect
 * one layer over. ⭑ This is what a live reviewer measurably returns: `REG-F-412` recorded nine rows in five
 * of five reviews, including explicit `failed: false` rows.
 *
 * ⚠ TAKING THE LIST AS A PARAMETER ALSO KEEPS THIS FILE OUT OF THE PRODUCTION IMPORT GRAPH. `guards:export`
 * asks the RELATIONAL question *“is this consumer a test?”* and keys it on the filename; a `.testing.ts`
 * helper importing a package export would have been counted as a production consumer and inflated that
 * ratchet's obligation with a promise nothing ships.
 */
export function clearingJudgement(criteria: readonly { readonly id: string }[]): string {
	return JSON.stringify({
		findings: criteria.map((c) => ({
			criterionId: c.id,
			failed: false,
			statement: 'evaluated; the failure class is absent'
		})),
		recommendation: 'SATISFIED',
		residualUncertainty: []
	});
}

/**
 * ⭐⭐ A CLEARING REPLY THAT STILL KNOWS WHICH FRAMING IT WAS ASKED UNDER (`OR-03`).
 *
 * ⛔ A FIXED REPLY IS FRAMING-BLIND, AND ONE TEST'S WHOLE STATED RED IS THE FRAMING. `process-result-floor`'s
 * case names it: *"Before `R14` this returned INCONCLUSIVE whatever the facts said: the subject's `objectType`
 * selected the reviewer's framing, `'EVIDENCE'` was not `'ARTIFACT'`, and the graph arm cannot read a build
 * log."* A reply that answers identically under every framing would leave that test green even with `R14`
 * reverted — the control-that-cannot-fail shape, introduced by the very change meant to restore the test.
 *
 * ⭑ SO IT REFUSES THE FRAMING IT WAS NOT WRITTEN FOR. The prompt carries the framing verbatim (`framingText`),
 * and this asserts on it: asked under any other framing, the reply is a REJECTION naming the mismatch, so the
 * floor cannot clear and the test that depends on routing still reddens when routing breaks.
 *
 * ⚠ IT KEYS ON THE PROMPT TEXT, WHICH IS A COUPLING AND IS DECLARED AS ONE. If `framingText` is reworded this
 * helper stops discriminating and the tests using it go red — which is the correct direction for a coupling to
 * fail in, but it is a coupling.
 */
export function clearingReviewerFor(
	expectFraming: string,
	criteria: readonly { readonly id: string }[]
): (prompt: string) => Promise<string> {
	return async (prompt: string) => {
		if (!prompt.includes(expectFraming))
			return JSON.stringify({
				findings: [
					{
						criterionId: 'RR-01-no-problem-substitution',
						failed: true,
						statement:
							`This reviewer was configured for the ${expectFraming} framing and the prompt does not ` +
							'carry it, so the subject was routed to a reviewer that cannot read it.',
						severity: 'BLOCKING'
					}
				],
				recommendation: 'REJECTED',
				residualUncertainty: []
			});
		return clearingJudgement(criteria);
	};
}

/**
 * Run `body` with the live reviewer seam selected, and put the process back afterwards.
 *
 * ⭑ THE PRIOR VALUES ARE CAPTURED AND RESTORED rather than deleted, so a caller that legitimately had these
 * set (a live lane) is not silently disarmed by a unit test that ran beside it.
 */
export async function withLiveReviewerSeam<T>(body: () => Promise<T>): Promise<T> {
	const priorTool = process.env.JPWB_ASSURANCE_TOOL;
	const priorModel = process.env.JPWB_JUDGE_MODEL;
	process.env.JPWB_ASSURANCE_TOOL = 'agy';
	process.env.JPWB_JUDGE_MODEL = 'test-judge-model';
	try {
		return await body();
	} finally {
		// ⛔ RESTORE, NEVER DELETE, and never throw. Two assignments and two deletes, no logic.
		if (priorTool === undefined) delete process.env.JPWB_ASSURANCE_TOOL;
		else process.env.JPWB_ASSURANCE_TOOL = priorTool;
		if (priorModel === undefined) delete process.env.JPWB_JUDGE_MODEL;
		else process.env.JPWB_JUDGE_MODEL = priorModel;
	}
}
