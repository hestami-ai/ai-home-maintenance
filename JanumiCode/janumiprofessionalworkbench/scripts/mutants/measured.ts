// DID THE RUN MEASURE THE MUTATION, OR MERELY FAIL TO FINISH? — JAN-VERIF V-4b (REG-F-116).
//
// The mutation runner decides every verdict from ONE bit: the exit status of a test run. That bit is only evidence
// about the mutation if the run actually EXERCISED it. A run that timed out did not. V-4a is the proof: the full
// gate reported `SURVIVED: WP12B-M3 … declared a CONTROL, but a test FAILED on it — something asserts on prose`,
// and the truth was `Error: Test timed out in 5000ms` in an unrelated suite whose cost had grown with the register.
// The mutation was irrelevant. The runner had stated a CAUSE it never measured.
//
// ⚠ AND IT CUTS BOTH WAYS, WHICH IS WHY THIS IS NOT A CONTROL-ONLY REPAIR. A control's whole-suite run turns a
// timeout into a FALSE BLOCKING (loud, and it cost a long investigation). A NAMED victim's run turns a timeout into
// a FALSE KILL — vitest exits non-zero, `run.ts` reads "the victim reddened", and the ledger records a guard as
// proven that nothing exercised. REG-F-110 recorded that asymmetry in terms: *"a false KILL is quieter than a false
// BLOCK and it had been sitting under a green tick."* So the check runs BEFORE verdict attribution, on the run
// output, for every mutant — one check, both directions.
//
// WHAT THIS DELIBERATELY GIVES UP, disclosed rather than discovered. A mutation CAN genuinely cause a timeout — cut
// a loop bound and the victim hangs. Under this rule that reports INCONCLUSIVE rather than KILLED, and its author
// must say so deliberately. That is the correct polarity: the ledger's claim is *"this named test reddens because it
// asserts the guard"*, and a hang does not establish it. A timeout is never automatically evidence, in either
// direction.

/**
 * The timeout markers of the two runners `run.ts` can invoke — and it is exactly two, derived from the runner
 * rather than guessed at: `sh('bunx', ['vitest', …])` for a unit victim and `runPlaywright(…)` for an e2e victim.
 * A third runner would arrive with its own marker and no row here, which is why the derivation is recorded next to
 * the list instead of the list being presented as complete on its own authority.
 *
 * Vitest reports `Error: Test timed out in 5000ms.` and, for a slow `beforeEach`, `Hook timed out in 10000ms.`
 * Playwright reports `Test timeout of 30000ms exceeded.`
 */
const TIMEOUT_MARKERS: readonly RegExp[] = [
	/(?:Test|Hook) timed out in \d+ms/,
	/Test timeout of \d+ms exceeded/
];

/**
 * The timeout evidence in a run's combined stdout+stderr, or `null` when the run failed (or passed) for reasons
 * that are about the code.
 *
 * Returns the MATCHED TEXT rather than a boolean so the verdict can quote what was observed. The whole point of
 * this module is that the runner stopped inventing causes; a bare `true` would leave the operator reading a verdict
 * that asserts "timed out" with nothing to check it against.
 */
export function timeoutEvidence(out: string): string | null {
	for (const marker of TIMEOUT_MARKERS) {
		const hit = marker.exec(out);
		if (hit !== null) return hit[0];
	}
	return null;
}
