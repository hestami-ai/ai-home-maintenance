/**
 * JAN-PFA `R2` / `S2.4` — change-scoped mutation's pure core, driven on fixtures.
 *
 * WHY NOT DRIVE THE CLI. `mutants:changed` answers a single question about whatever the working tree happens to
 * hold, and it needs git, a staged index and ~4s per selected mutant. None of that can demonstrate the property
 * that actually matters: that the THREE outcomes it reports — *you broke a guarantee*, *nothing was watching*,
 * and *the instrument could not run* — are independent. One says the code is worse; one says the code was never
 * watched; one says nothing was measured at all. Collapsing any pair reproduces the defect this whole programme
 * exists to remove.
 *
 * ⛔ AND TWO OF THE THREE WERE COLLAPSED, IN OPPOSITE DIRECTIONS, IN THE FIRST TWO FORMS OF THE CLASSIFIER.
 * Both are regression cases below, because both were found by RUNNING the thing rather than reading it, and a
 * defect found that way returns the moment the reasoning that produced it is repeated.
 */
import { describe, expect, it } from 'vitest';
import {
	anchorRange,
	classifyRunnerTranscript,
	isProductionPath,
	overlaps,
	parseUnifiedDiff
} from '../scripts/mutants/scope-core.js';

describe('JAN-PFA R2 — parseUnifiedDiff turns a diff into the regions an agent actually changed', () => {
	it('reads the NEW-side range of each hunk, across several files', () => {
		const diff = [
			'diff --git a/packages/x/src/a.ts b/packages/x/src/a.ts',
			'--- a/packages/x/src/a.ts',
			'+++ b/packages/x/src/a.ts',
			'@@ -10,2 +10,3 @@',
			'+added',
			'diff --git a/packages/y/src/b.ts b/packages/y/src/b.ts',
			'--- a/packages/y/src/b.ts',
			'+++ b/packages/y/src/b.ts',
			'@@ -1 +1 @@',
			'-old',
			'+new'
		].join('\n');
		expect(parseUnifiedDiff(diff)).toEqual([
			{ file: 'packages/x/src/a.ts', startLine: 10, endLine: 12 },
			{ file: 'packages/y/src/b.ts', startLine: 1, endLine: 1 }
		]);
	});

	// ⭑ A DELETION IS THE EDIT MOST LIKELY TO REMOVE A GUARANTEE, so it must never be the one shape the reader
	// drops. `+0` has no lines on the new side to point at; it is reported as the join the removal sits against.
	it('a PURE DELETION hunk (+0) is still reported as a region, not dropped', () => {
		const diff = ['+++ b/packages/x/src/a.ts', '@@ -20,3 +19,0 @@', '-gone', '-gone', '-gone'].join('\n');
		expect(parseUnifiedDiff(diff)).toEqual([
			{ file: 'packages/x/src/a.ts', startLine: 19, endLine: 19 }
		]);
	});

	it('a file deleted outright (/dev/null on the new side) contributes no regions', () => {
		const diff = ['+++ /dev/null', '@@ -1,5 +0,0 @@'].join('\n');
		expect(parseUnifiedDiff(diff)).toEqual([]);
	});
});

describe('JAN-PFA R2 — anchorRange locates a guard, and refuses to guess', () => {
	const text = 'line one\nline two\nTARGET start\nTARGET end\nline five\n';

	it('returns the 1-based inclusive line span of a multi-line anchor', () => {
		expect(anchorRange(text, 'TARGET start\nTARGET end')).toEqual({ startLine: 3, endLine: 4 });
	});

	// ⛔ BOTH FAILURE MODES RETURN A REASON, NOT A RANGE, AND NEITHER MAY BE READ AS "not guarded". An anchor
	// that cannot be located means the LEDGER cannot decide what is guarded — the instrument reporting that it
	// cannot see, which the CLI escalates to exit 2 rather than folding into the absence signal.
	it('an ABSENT anchor is a reported reason, never a silent miss', () => {
		expect(anchorRange(text, 'NOT PRESENT')).toBe('anchor occurs 0 times (expected exactly 1)');
	});

	it('an AMBIGUOUS anchor is a reported reason, never the first match', () => {
		expect(anchorRange(text, 'TARGET')).toBe('anchor occurs 2 times (expected exactly 1)');
	});
});

describe('JAN-PFA R2 — overlaps selects a guard when the diff touches ANY line of its anchor', () => {
	const range = { startLine: 10, endLine: 12 };
	const at = (startLine: number, endLine: number) => ({ file: 'f.ts', startLine, endLine });

	it('selects on a one-line touch inside the anchor', () => {
		expect(overlaps('f.ts', range, at(11, 11))).toBe(true);
	});

	it('selects on either boundary — the first and last lines of a guard are part of it', () => {
		expect(overlaps('f.ts', range, at(10, 10))).toBe(true);
		expect(overlaps('f.ts', range, at(12, 12))).toBe(true);
	});

	it('does NOT select an adjacent-but-disjoint region', () => {
		expect(overlaps('f.ts', range, at(9, 9))).toBe(false);
		expect(overlaps('f.ts', range, at(13, 13))).toBe(false);
	});

	it('does NOT select across files, however well the line numbers line up', () => {
		expect(overlaps('other.ts', range, at(11, 11))).toBe(false);
	});
});

describe('JAN-PFA R2 — isProductionPath decides what a change is even ASKED about', () => {
	it('admits package and app source', () => {
		expect(isProductionPath('packages/rph-domain/src/governance.ts')).toBe(true);
		expect(isProductionPath('apps/rph-demo/src/lib/x.svelte')).toBe(true);
	});

	// ⚠ EXCLUDING TESTS IS A JUDGMENT, NOT AN OVERSIGHT. Editing a test is not a change to the behaviour a guard
	// protects; reporting "unguarded change" for every test anyone writes is how a signal becomes noise.
	it('excludes test files, verif/ and scripts/', () => {
		expect(isProductionPath('packages/rph-domain/src/governance.test.ts')).toBe(false);
		expect(isProductionPath('verif/anything.test.ts')).toBe(false);
		expect(isProductionPath('scripts/mutants/run.ts')).toBe(false);
		expect(isProductionPath('docs/_working/NOTES.md')).toBe(false);
	});
});

describe('JAN-PFA R2 — classifyRunnerTranscript keeps "no verdict" apart from "a bad verdict"', () => {
	const SUMMARY = '=== MUTATION LEDGER SUMMARY ===\nKILLED      3\nSURVIVED    0\nABORTED_DIRTY 0\n';

	it('a clean run with a summary and exit 0 is OK', () => {
		expect(classifyRunnerTranscript(SUMMARY, 0)).toBe('OK');
	});

	// ── REGRESSION 1 ───────────────────────────────────────────────────────────────────────────────────────
	// The first form was `status !== 0` alone, which announced a BROKEN GUARANTEE about a mutation that was
	// never applied, because the runner had refused to mutate a dirty tree.
	it('an ABORTED run is INSTRUMENT_DID_NOT_RUN, never a broken guarantee', () => {
		const aborted = 'ABORT: tracked worktree does not match a stable staged index baseline — refusing to mutate.\n';
		expect(classifyRunnerTranscript(aborted, 2)).toBe('INSTRUMENT_DID_NOT_RUN');
		expect(classifyRunnerTranscript(aborted, 1)).toBe('INSTRUMENT_DID_NOT_RUN');
	});

	// ── REGRESSION 2, AND IT IS THE MORE DANGEROUS ONE ─────────────────────────────────────────────────────
	// The fix for regression 1 matched `ABORTED_DIRTY` as a bare substring — which every HEALTHY run contains,
	// because the summary prints one row per verdict kind including `ABORTED_DIRTY 0`. A genuinely surviving
	// mutant was therefore reported as "the instrument did not run", SUPPRESSING the finding this command
	// exists to raise. A false negative here is silent; a false positive at least gets investigated.
	it('a SURVIVED verdict is a BROKEN GUARANTEE even though the summary prints the text ABORTED_DIRTY', () => {
		const survived = '=== MUTATION LEDGER SUMMARY ===\nKILLED      1\nSURVIVED    1\nABORTED_DIRTY 0\n';
		expect(survived).toContain('ABORTED_DIRTY');
		expect(classifyRunnerTranscript(survived, 1)).toBe('BROKEN_GUARANTEE');
	});

	it('a NON-ZERO ABORTED_DIRTY row is a real abort, so the row is read by its VALUE', () => {
		const reallyAborted = '=== MUTATION LEDGER SUMMARY ===\nKILLED      0\nABORTED_DIRTY 1\n';
		expect(classifyRunnerTranscript(reallyAborted, 1)).toBe('INSTRUMENT_DID_NOT_RUN');
	});

	it('output with NO summary banner claims nothing, whatever the exit status', () => {
		expect(classifyRunnerTranscript('bun: command not found\n', 127)).toBe('INSTRUMENT_DID_NOT_RUN');
		// ⛔ Including the flattering case: a zero exit with no verdict is still nothing measured.
		expect(classifyRunnerTranscript('', 0)).toBe('INSTRUMENT_DID_NOT_RUN');
	});
});
