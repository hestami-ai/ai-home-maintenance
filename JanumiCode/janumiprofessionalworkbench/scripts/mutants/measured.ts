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
 * Vitest reports `Error: Test timed out in 5000ms.` and, for a slow `beforeEach`, `Error: Hook timed out in 10000ms.`
 * Playwright reports `Test timeout of 30000ms exceeded.` on a line of its own.
 *
 * ⚠ EACH MARKER IS ANCHORED TO THE START OF ITS LINE, AND THE VITEST ONES REQUIRE THE `Error: ` PREFIX. THIS IS NOT
 * TIDINESS — WITHOUT IT THIS CHECK POISONS ITSELF, MEASURED THE FIRST TIME ITS OWN MUTANTS RAN.
 *
 * `run.ts` scans the CHILD'S stdout. A test that ASSERTS on timeout text prints that text into stdout the moment it
 * fails — vitest's diff renders the expected value on its own line, in quotes:
 *
 *     - Expected:
 *     "Hook timed out in 10000ms"
 *
 * So a substring scan reads the FIXTURE of the failing test as a diagnostic from the runner, and reports
 * INCONCLUSIVE for a mutant its victim killed cleanly. Observed, not feared: `F116-a-hung-arrangement-is-graded-as-
 * a-kill` and `F116-the-e2e-runner-loses-its-timeout-marker` both reported INCONCLUSIVE on their first run, and the
 * only reason the third did not is that `run.ts` holds the UNMUTATED function in memory while the child holds the
 * mutated one.
 *
 * THE GENERAL FORM, AND IT IS THE THIRD SIGHTING IN THIS REGISTER: an instrument that reads a free-text channel
 * cannot distinguish its subject's DATA from its own SIGNAL — and the test written to prove the instrument is
 * precisely the one most likely to contain that data. REG-F-110: the anchor census could not run under the runner
 * that mutates anchors. REG-F-113: prose ABOUT a status counted as a status. Here: a fixture QUOTING a timeout
 * counted as a timeout. The repair is the same in all three — separate the signal structurally, at the narrowest
 * rule that does it, rather than loosening the check.
 *
 * THE RESIDUAL IS DISCLOSED AND ITS POLARITY IS THE REASON IT IS TOLERABLE. A test that dumps a whole multi-line
 * fixture into a diff — one whose second line genuinely begins `Error: Test timed out in …ms` — would still be
 * misread. That is over-detection, and over-detection here FAILS CLOSED: it produces a loud BLOCKING
 * `INCONCLUSIVE`, never a silent false KILL. Under-detection is the dangerous direction, and the anchoring cannot
 * cause it: a real runner diagnostic is always emitted on a line of its own.
 *
 * ⚠ THE TWO MARKERS ARE NOT DEFENDED EQUALLY, AND SAYING "THE PREFIX SEPARATES THEM" WAS AN OVER-GENERALISATION
 * FROM THE VITEST CASE (REG-F-120). Measured: drop `^[ \t]*` from the vitest marker and all cases stay green —
 * the `Error: ` prefix is doing the separating there, exactly as REG-F-116 claimed. **But the Playwright marker
 * has no prefix to fall back on.** Its line anchor is its ENTIRE defence, and for a while nothing held it: the
 * poisoning fixtures were all vitest-shaped, so dropping that anchor was green too. A reader could have deleted
 * it as redundant — the vitest evidence says redundant — and re-opened the hole on the e2e path alone.
 * `verif/mutant-verdict.test.ts` now carries a quoted-Playwright fixture whose only objector is that anchor.
 */
const TIMEOUT_MARKERS: readonly RegExp[] = [
	/^[ \t]*Error: (?:Test|Hook) timed out in \d+ms/m,
	/^[ \t]*Test timeout of \d+ms exceeded/m
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
		if (hit !== null) return hit[0].trim();
	}
	return null;
}
