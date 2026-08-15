// THE CONTROL-GRADING DECISION, EXTRACTED SO IT CAN BE TESTED — REG-F-165.
//
// ── WHY THIS FILE EXISTS AT ALL, AND IT IS NOT TIDINESS ──────────────────────────────────────────────────────
//
// `run.ts` has ZERO exports and executes on import: it is a script, not a module. So every verdict predicate in
// it — `controlVerdict`, `compileVerdict`, `pkgOf` — was unreachable by any test, and the mutation ledger cannot
// mutate what no suite can observe. **The layer that decides what every other verdict MEANS was the one layer
// with no test on it.** That is not a coincidence; a script's decision logic is invisible to testing by default,
// so it stays invisible until someone moves it.
//
// The defect that proved it: `gradeControl`'s `reported.length === 0` case. A control run that EXITED NON-ZERO
// and wrote a report naming NO failing test file was graded `CONTROL_HELD` — a non-measurement scored as a pass —
// **one line below the arm written to prevent exactly that**. `failedFiles` had been carefully taught to return
// `undefined` rather than `[]` for a MISSING report, with a comment recording that conflating them would be
// "a fail-OPEN hole in the fix for a fail-open hole". The empty-but-present report is the third case, and it
// takes the same path as a genuine hold.
//
// ⚠ KEPT PURE ON PURPOSE. No filesystem, no process, no clock — the inputs are exactly what the runner observed.
// A verdict function that reads the world cannot be put under fixtures, and this whole file exists because the
// previous one could not be.

/**
 * DID THE CHILD PROCESS ACTUALLY FINISH? — REG-F-168, and it is asked BEFORE any verdict is attributed.
 *
 * `run.ts` read exactly one field of the spawn result, `status`, and treated every non-zero value as proof that
 * the mutation was caught. `spawnSync` reports three other outcomes through fields it never looked at:
 *   - `signal` non-null — the child was KILLED (SIGTERM, an external `taskkill`, an OOM kill);
 *   - `error` defined   — the spawn itself failed, or the output exceeded `maxBuffer` (ENOBUFS);
 *   - `status` null     — either of the above; there is no exit code to read.
 * All three arrived at `run.status === 0 ? SURVIVED : KILLED` and came out **KILLED**.
 *
 * ⚠ AND ONE OF THEM IS NOT HYPOTHETICAL ON THIS RUNTIME. MEASURED 2026-08-14: under Bun, `spawnSync` with this
 * runner's exact options reports a child that **exited 0** and wrote more than 1,048,576 bytes as
 * `{ status: 1, signal: null, error: undefined, stdout: '' }`. A PASSING suite, reported as a failure, with the
 * evidence buffer emptied — indistinguishable at every field the runner inspects from a genuine kill, and
 * `timeoutEvidence` blinded because it scans output that is now the empty string.
 *
 * So `status: 1` alone cannot be trusted either; `maxBuffer` is raised at the call site to make the truncation
 * far less reachable, and this predicate catches the residue that still arrives as a non-completion.
 */
export interface SpawnOutcome {
	readonly status: number | null;
	readonly signal: NodeJS.Signals | null;
	readonly error?: Error;
}

/** `null` when the process completed normally; otherwise WHY no verdict about the mutation is available. */
export function nonCompletion(run: SpawnOutcome): string | null {
	if (run.error !== undefined)
		return `the child process did not run to completion (${run.error.name}: ${run.error.message}) — no verdict about this mutation is available`;
	if (run.signal !== null)
		return `the child process was KILLED by ${run.signal} rather than exiting — a signal is not a test result, so no verdict about this mutation is available`;
	if (typeof run.status !== 'number')
		return 'the child process reported no exit status at all — no verdict about this mutation is available';
	return null;
}

export type ControlVerdict = 'CONTROL_HELD' | 'INCONCLUSIVE' | 'SURVIVED';

export interface ControlGrade {
	readonly verdict: ControlVerdict;
	readonly detail: string;
}

/**
 * Grade a CONTROL — an entry whose declared, correct outcome is SURVIVAL.
 *
 * @param passed         did the run exit zero?
 * @param reported       failing test files named by the run's report; `undefined` means NO REPORT WAS WRITTEN,
 *                       which is a different fact from "no failures" and must not be conflated (see `failedFiles`).
 * @param baselineFiles  files already failing in the UNMUTATED baseline, so the verdict is a DIFFERENCE.
 * @param expectSurvive  the entry's own declared rationale, echoed into the detail.
 */
export function gradeControl(
	passed: boolean,
	reported: readonly string[] | undefined,
	baselineFiles: readonly string[] | undefined,
	expectSurvive: string
): ControlGrade {
	if (passed) return { verdict: 'CONTROL_HELD', detail: expectSurvive.slice(0, 88) };

	// NO REPORT AT ALL — the run exited non-zero and wrote nothing, so there is no difference to take. That is a
	// non-measurement and must say so; grading it HELD would be the fail-open this arm exists to refuse.
	if (reported === undefined)
		return {
			verdict: 'INCONCLUSIVE',
			detail:
				'the run FAILED and wrote no report, so the difference against the baseline could not be taken — ' +
				'no verdict about this control is available'
		};

	// ⚠ A REPORT THAT NAMES NOTHING, AFTER A NON-ZERO EXIT, IS ALSO A NON-MEASUREMENT (REG-F-165). Something made
	// the run fail and no test file owns it: a setup or teardown throw, an unhandled rejection, a worker crash, a
	// config error. The failure is REAL and its cause is UNATTRIBUTED, so the one thing that cannot be concluded is
	// that the control held. This case previously fell through to the `fresh.length === 0` arm below and was graded
	// CONTROL_HELD — the missing third case in a two-case distinction that was itself written to close a fail-open.
	if (reported.length === 0)
		return {
			verdict: 'INCONCLUSIVE',
			detail:
				'the run FAILED but its report names NO failing test file, so nothing attributes the failure — ' +
				'a control cannot be held on an unattributed failure'
		};

	const already = new Set(baselineFiles ?? []);
	const fresh = reported.filter((f) => !already.has(f));
	// NOTHING NEW REDDENED — the control HELD. The disclosure travels WITH the verdict, because "held against a red
	// baseline" is a weaker statement than "held against a green one" and must not read as the same.
	if (fresh.length === 0)
		return {
			verdict: 'CONTROL_HELD',
			detail: `${expectSurvive.slice(0, 60)} — held on the DIFFERENCE; ${already.size} suite(s) already red without it`
		};

	// A GENUINELY NEW RED. Now the original sentence is earned — and it NAMES what reddened instead of asserting a
	// cause, which was the whole of V-4a's cost.
	//
	// ⚠ IT NO LONGER SAYS "the prose-only edit" (REG-F-165). Only ONE of the nine controls edits prose; the rest
	// mutate live code or checked data, so that clause stated a CAUSE the runner never measured — the exact defect
	// `measured.ts` was written to end, surviving in the detail string of the arm that reports it.
	return {
		verdict: 'SURVIVED',
		detail: `declared a CONTROL, but the mutation NEWLY reddened ${fresh.length} suite(s) — something observes it: ${fresh.slice(0, 3).join(', ')}`
	};
}
