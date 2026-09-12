/**
 * The PURE half of `mutants:changed` — diff parsing, anchor location, and the intersection between them.
 *
 * ⭑ IT IS SEPARATE FROM `scope.ts` SO IT CAN BE DRIVEN WITHOUT GIT. The CLI's answer is a single pass/fail over
 * whatever the working tree happens to hold, which cannot demonstrate that the two signals — *you broke a
 * guarantee* and *nothing was watching* — are independent. `verif/mutants-scope.test.ts` drives these functions
 * on fixtures instead, so each limb is shown to fail alone.
 */

/** A contiguous region of a file the diff touches, on the NEW side. */
export interface Hunk {
	readonly file: string;
	readonly startLine: number;
	readonly endLine: number;
}

/** Where a mutant's `find` sits in its file, in 1-based inclusive lines. */
export interface Range {
	readonly startLine: number;
	readonly endLine: number;
}

/**
 * Parse `git diff --unified=0 --relative` output into per-file line ranges.
 *
 * ⚠ A HUNK WITH `+0` IS A PURE DELETION and has no lines on the new side to point at. It is reported as the
 * single line the removal sits against rather than DROPPED — deleting a guarded block is precisely the edit
 * that removes a guarantee, so it is the last thing this should be blind to.
 */
export function parseUnifiedDiff(stdout: string): Hunk[] {
	const hunks: Hunk[] = [];
	let file: string | undefined;
	for (const line of stdout.split('\n')) {
		if (line.startsWith('+++ ')) {
			const p = line.slice(4).trim();
			file = p === '/dev/null' ? undefined : p.replace(/^b\//, '');
			continue;
		}
		if (!line.startsWith('@@') || file === undefined) continue;
		const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
		if (m === null) continue;
		const start = Number(m[1]);
		const count = m[2] === undefined ? 1 : Number(m[2]);
		hunks.push({ file, startLine: start, endLine: count === 0 ? start : start + count - 1 });
	}
	return hunks;
}

/**
 * Locate an anchor in a file's text. Returns a REASON string rather than a range when the anchor is absent or
 * ambiguous — an unlocatable anchor means the ledger cannot decide what is guarded, which must be reported
 * loudly and must never be silently treated as "not guarded".
 */
export function anchorRange(text: string, find: string): Range | string {
	const parts = text.split(find);
	const hits = parts.length - 1;
	if (hits !== 1) return `anchor occurs ${hits} times (expected exactly 1)`;
	const startLine = parts[0]!.split('\n').length;
	return { startLine, endLine: startLine + find.split('\n').length - 1 };
}

/** Inclusive overlap on the same file. Touching a single line of a multi-line anchor selects that guard. */
export const overlaps = (file: string, range: Range, hunk: Hunk): boolean =>
	file === hunk.file && range.startLine <= hunk.endLine && hunk.startLine <= range.endLine;

/**
 * Production source only. ⚠ Test files are EXCLUDED deliberately: editing a test is not a change to the
 * behaviour a guard protects, and treating it as one would report "unguarded change" for every test someone
 * writes — which is how a signal becomes noise and then becomes ignored.
 */
export const isProductionPath = (p: string): boolean =>
	/^(packages|apps)\//.test(p) && /\.(ts|tsx|svelte)$/.test(p) && !/\.(test|spec)\.ts$/.test(p);

/** What a runner invocation actually established. Exactly one of these is a finding about the code. */
export type RunOutcome = 'OK' | 'BROKEN_GUARANTEE' | 'INSTRUMENT_DID_NOT_RUN';

/**
 * Classify a `run.ts` invocation from its transcript and exit status.
 *
 * ⛔ THIS FUNCTION EXISTS BECAUSE ITS FIRST TWO FORMS WERE BOTH WRONG, IN OPPOSITE DIRECTIONS, AND BOTH WERE
 * FOUND BY RUNNING IT RATHER THAN READING IT.
 *
 *   1. `status !== 0` alone reported BROKEN GUARANTEE when the runner had ABORTED on a dirty tree — announcing
 *      a broken guarantee about a mutation that was never applied. A non-zero exit means several things and
 *      only one of them is a finding.
 *   2. Detecting the abort with `transcript.includes('ABORTED_DIRTY')` then did the opposite: the runner's
 *      summary prints ONE ROW PER VERDICT KIND, so every healthy run contains the literal `ABORTED_DIRTY 0`.
 *      A genuinely SURVIVED mutant was therefore classified as "the instrument did not run" — suppressing the
 *      exact finding this command exists to raise.
 *
 * ⭑ THE RULE THAT SURVIVED BOTH: a verdict is claimed ONLY when the runner demonstrably reached one (its
 * summary banner is present) and did not abort (its abort line is absent, and the abort ROW is zero). Anything
 * else is the instrument reporting that it could not work, which is never a claim about the code.
 */
export function classifyRunnerTranscript(transcript: string, status: number | null): RunOutcome {
	const reachedAVerdict = transcript.includes('MUTATION LEDGER SUMMARY');
	const aborted = /^ABORT:/m.test(transcript) || /ABORTED_DIRTY\s+[1-9]/.test(transcript);
	if (aborted || !reachedAVerdict) return 'INSTRUMENT_DID_NOT_RUN';
	return status === 0 ? 'OK' : 'BROKEN_GUARANTEE';
}
