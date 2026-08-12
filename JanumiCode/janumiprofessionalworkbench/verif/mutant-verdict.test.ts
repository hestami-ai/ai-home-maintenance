// THE RUNNER MUST NOT STATE A CAUSE IT DID NOT MEASURE — JAN-VERIF V-4b (REG-F-116).
//
// `scripts/mutants/run.ts` decides every verdict from the exit status of a test run. V-4a proved that bit can be
// non-zero for a reason that has nothing to do with the mutation, and that the runner then reported a CAUSE:
// `SURVIVED: … declared a CONTROL, but a test FAILED on it — something asserts on prose`, when the actual output
// read `Error: Test timed out in 5000ms`. The operator is sent to look for a test that asserts on prose. There is
// none. That cost four attempts and three confident wrong diagnoses.
//
// `timeoutEvidence` is the predicate that separates "measured and bad" from "not measured". It is a pure function
// over the run's combined output precisely so it can be tested — `run.ts` is a script with top-level side effects
// and exports nothing, so nothing in it has ever been under test. This file is the seam.
//
// ⚠ WHAT THIS FILE DOES **NOT** PROVE, stated here because a green tick beside a partial claim is how this
// programme's findings get manufactured. It proves the PREDICATE. It does not prove the WIRING — that `run.ts`
// calls it before verdict attribution and blocks on the result. That half was proved by driving it: a deliberately
// hung victim under the real runner, which reported INCONCLUSIVE instead of KILLED. Recorded in REG-F-116, not
// claimed here.
import { describe, expect, it } from 'vitest';
import { timeoutEvidence } from '../scripts/mutants/measured.js';

/**
 * The ACTUAL failure text from V-4a, not a plausible reconstruction of one.
 *
 * A fixture written from memory tests the memory. This is the shape vitest emitted when
 * `enforcement-register.test.ts` re-read the 2.6 MB canon corpus once per registered rule and tipped over the
 * 5000ms default under full-suite load.
 */
const VITEST_TIMEOUT = [
	' FAIL  packages/rph-domain/src/enforcement-register.test.ts > the enforcement register > every rule cites canon',
	'Error: Test timed out in 5000ms.',
	'If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".',
	' Test Files  1 failed | 41 passed (42)',
	'      Tests  1 failed | 3377 passed (3378)'
].join('\n');

/** A slow arrangement rather than a slow assertion — vitest words this one differently, and a check that reads only
 *  the `Test timed out` phrasing would call a hung `beforeEach` a genuine kill. */
const VITEST_HOOK_TIMEOUT = [
	' FAIL  packages/rph-application/src/handlers/execution.test.ts',
	'Error: Hook timed out in 10000ms.',
	'      Tests  0 failed | 12 passed (12)'
].join('\n');

/** The e2e path. `run.ts` reaches `apps/` through Playwright, which reports timeouts in its own words entirely. */
const PLAYWRIGHT_TIMEOUT = [
	'  1) [edge] › pwa-node-graph.e2e.ts:31:2 › the composition tree renders ',
	'    Test timeout of 30000ms exceeded.',
	'    1 failed'
].join('\n');

/**
 * A REAL assertion failure — the case the runner is entitled to attribute to the mutation.
 *
 * ⚠ THIS IS THE CONTROL THE OTHER THREE CASES ARE WORTHLESS WITHOUT. Every positive assertion below is satisfied
 * by a function that returns a constant string, and such a function would turn every genuine SURVIVED and every
 * genuine KILLED into INCONCLUSIVE — a gate that reports "not measured" for everything and therefore measures
 * nothing.
 *
 * THE FIXTURE IS THE V-4a REPAIR'S OWN TEST NAME, and that is not a cute touch — it is the realistic trap. A check
 * written as `out.includes('timed out')` rather than against the runner's actual marker reads the WORDS in a test
 * TITLE as evidence of a timeout, and the titles most likely to contain them belong to the very tests written to
 * stop timeouts. This suite's own names would trip it too.
 */
const GENUINE_FAILURE = [
	' FAIL  packages/rph-domain/src/enforcement-register.test.ts > the canon corpus is read once so this suite is not timed out by the register it reads',
	"AssertionError: expected 6 to be 1 // Object.is equality",
	'  - Expected: 1',
	'  + Received: 6',
	'      Tests  1 failed | 3377 passed (3378)'
].join('\n');

/** A clean run. The runner reads status 0, so this text is what a CONTROL_HELD or a SURVIVED is decided against. */
const CLEAN_RUN = [
	' Test Files  42 passed (42)',
	'      Tests  3378 passed (3378)',
	'   Duration  74.21s'
].join('\n');

/**
 * THE CHECK'S OWN OUTPUT WHEN A MUTANT KILLS A TEST IN THIS VERY FILE — copied verbatim from the run, not composed.
 *
 * ⚠ THIS IS THE CONTROL THAT WAS MISSING, AND ITS ABSENCE WAS MEASURED RATHER THAN IMAGINED. The first run of
 * `F116-a-hung-arrangement-is-graded-as-a-kill` and `F116-the-e2e-runner-loses-its-timeout-marker` both reported
 * INCONCLUSIVE instead of KILLED: `run.ts` scans the child's stdout, the child had just failed a test that ASSERTS
 * on timeout text, and vitest duly printed that text into stdout. **The instrument read the fixture of the failing
 * test as a diagnostic from the runner.** A mutant that its victim killed cleanly was reported as unmeasured.
 *
 * Note what the diff looks like: the marker sits at the START of its line, in quotes, with no `Error: ` prefix.
 * Line-anchoring alone does not separate them; the runner's own prefix does.
 */
const KILLED_BY_ITS_OWN_FIXTURE = [
	' FAIL  |verif| verif/mutant-verdict.test.ts > REG-F-116 — a timeout is not a measurement, in either direction > reports a HOOK timeout — a hung arrangement measures the mutation exactly as little',
	"AssertionError: expected null to be 'Hook timed out in 10000ms' // Object.is equality",
	'',
	'- Expected:',
	'"Hook timed out in 10000ms"',
	'',
	'+ Received:',
	'null',
	'',
	' ❯ verif/mutant-verdict.test.ts:85:48',
	'      Tests  1 failed | 5 passed (6)'
].join('\n');

describe('REG-F-116 — a timeout is not a measurement, in either direction', () => {
	it('reports the vitest timeout that made V-4a report an unrelated CONTROL as SURVIVED', () => {
		expect(timeoutEvidence(VITEST_TIMEOUT)).toBe('Error: Test timed out in 5000ms');
	});

	it('reports a HOOK timeout — a hung arrangement measures the mutation exactly as little', () => {
		expect(timeoutEvidence(VITEST_HOOK_TIMEOUT)).toBe('Error: Hook timed out in 10000ms');
	});

	it('reports a PLAYWRIGHT timeout, which the other runner words entirely differently', () => {
		expect(timeoutEvidence(PLAYWRIGHT_TIMEOUT)).toBe('Test timeout of 30000ms exceeded');
	});

	// CONTROL — the verdicts that must keep flowing.
	it('CONTROL — a genuine assertion failure is NOT a timeout, so the mutation keeps its verdict', () => {
		expect(
			timeoutEvidence(GENUINE_FAILURE),
			'a check this loose would report every kill as unmeasured'
		).toBeNull();
	});

	it('CONTROL — a clean run is not a timeout either', () => {
		expect(timeoutEvidence(CLEAN_RUN)).toBeNull();
	});

	// CONTROL — THE ONE THE MUTANTS THEMSELVES DEMANDED. Without it, this check reports its own test fixtures as
	// runner diagnostics and grades a clean kill as unmeasured.
	it('CONTROL — a fixture QUOTED in a failing diff is not a timeout, however exactly it reads like one', () => {
		expect(
			timeoutEvidence(KILLED_BY_ITS_OWN_FIXTURE),
			'the instrument must not read its subject’s DATA as its own SIGNAL'
		).toBeNull();
	});

	// ⚠ THE EVIDENCE IS THE MATCHED TEXT, NOT A BOOLEAN, and that is load-bearing rather than cosmetic: the whole
	// finding is that the runner asserted a cause the operator could not check. A verdict that says "timed out" and
	// quotes the line it read is checkable; one that says it on its own authority repeats V-4a with a new sentence.
	it('returns the matched text so the verdict can QUOTE what it observed', () => {
		const evidence = timeoutEvidence(VITEST_TIMEOUT);
		expect(evidence).not.toBeNull();
		expect(VITEST_TIMEOUT).toContain(evidence as string);
	});
});
