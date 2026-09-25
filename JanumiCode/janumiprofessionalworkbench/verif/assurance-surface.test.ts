// JPWB'S OWN ASSURANCE SURFACE IS WATCHED FROM `verif/` — JAN-CSAAEXT S1, salvaged from `csaa:inventory:check`.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────────────────────
// `csaa:inventory:check` is `gate:fast` step 2 today, and among its 303 required-path assertions it is the ONLY
// thing in this repository that notices two kinds of silent loss:
//   · a `verif/` TEST FILE disappearing — vitest collects what is on disk, so a deleted file is simply not
//     collected. `passWithNoTests: false` (verif/test-modes.test.ts) fires only when a whole PROJECT observes
//     nothing; it cannot see ONE file of the population go missing. This is N-16's shape one level down.
//   · a ROOT GATE COMMAND disappearing from `package.json` — `gate:fast` would simply run a shorter gate.
// JAN-CSAAEXT moves CSAA out of JPWB, so that pin stops being consulted. Per the programme's Rule 1 —
// SALVAGE BEFORE DECOUPLE, the rule under which JAN-CSAADEC CD-01/CD-02 survived that programme's withdrawal —
// this file reproduces the guarantee BEFORE the incumbent is removed.
//
// ── THE ABSENCE WAS SEARCHED FOR IN BOTH DIRECTIONS, WITH POSITIVE CONTROLS ───────────────────────────────────
// Because a false zero here is indistinguishable from a finding (REG-F-093). Population `verif/**/*.ts` +
// `scripts/**/*.ts` excluding `packages/csaa`, searched 2026-09-11:
//   · anything counting or pinning the `verif/` test-file population ............. 0 hits
//   · CONTROL, same population, same tool: `readdirSync` ......................... 48 hits
// So the walk reaches these directories and the zero is real. The OTHER direction: the same query over
// `packages/**/*.ts` finds it only inside `packages/csaa` — the package being extracted. Nothing outside CSAA
// would notice a verif test file being deleted.
//
// ⚠ AND ONE NEAR-MISS IS RECORDED BECAUSE IT WOULD HAVE CLOSED THIS FILE BEFORE IT WAS WRITTEN. A looser grep
// for the nine required paths returns 52 hits in `verif/`. Every one is PROSE inside an `evidence:` string in
// `guard-enforcement-ledger.data.ts`. A filename mentioned in a citation is not an assertion that the file
// exists, and reading that 52 as coverage would have retired a real gap by counting narrative.
//
// ── WHY THIS IS DERIVED AND NOT THE NINE PATHS CSAA ENUMERATED ────────────────────────────────────────────────
// Of the 303 paths `csaa:inventory:check` asserts, nine survive CSAA's departure. FIVE OF THE NINE NEED NOTHING
// HERE, and are deliberately not pinned, because module resolution already guarantees them — deleting them
// breaks an import loudly: `verif/arrow-command-census.ts` (imported by 8), `verif/guard-enforcement-ledger.ts`
// (3), `verif/guard-enforcement-ledger.data.ts` (2, plus a readFileSync at
// verif/recomposition-ungoverned.test.ts:165), `verif/arrow-command-census.baseline.json` (read at
// verif/arrow-command-census.test.ts:54), and `package.json` (read below and at
// verif/dependency-boundary-rules.test.ts:182). Pinning them would be a duplicate guard.
//
// The remaining FOUR are test files with no importer. ⛔ But SO IS EVERY OTHER ONE: measured over the 62 files
// present before this one, ZERO `verif/*.test.ts` is imported by anything. So pinning those four by name would
// enumerate an ARBITRARY SUBSET — the four CSAA happened to list — and leave fifty-eight equally exposed.
// Hand-listing is the defect one level up, and the general form is the population itself.
//
// ── WHY THE FLOOR IS AT THE POPULATION AND NOT BELOW IT ───────────────────────────────────────────────────────
// ⚠ THIS IS THE OPPOSITE OF `verif/dependency-boundary-rules.test.ts`, WHICH ARGUES THE FLOOR MUST SIT BELOW THE
// PINNED COUNT, so said out loud rather than left to look like an oversight. That file has TWO detectors — a
// floor owning collapse and a VANISHED check owning individual loss — so a floor at the population would make
// one deletion trip both, and an arrangement that trips two guards proves neither. THIS file has exactly ONE
// detector. A floor BELOW the population would not redden on a deletion at all, which is the only failure it
// is here to catch. So the floor IS the population. ⭑ Stated without a number on purpose: a rationale that
// repeats the constant has to be maintained in two places, and the copy that rots is never the one under test.
//
// ── WHAT THIS DELIBERATELY DOES NOT CLOSE ─────────────────────────────────────────────────────────────────────
// ⛔ A DELETION PAIRED WITH AN ADDITION NETS TO ZERO AND PASSES. Stated rather than netted out of a stronger-
// sounding claim: this counts, it does not identify. Closing that needs a committed name list, which churns on
// every added test; the trade was taken deliberately, because the failure actually seen in this repository is
// silent LOSS (N-16), not substitution. Whoever needs substitution-detection must EXTEND this file rather than
// write a second one beside it.
// ⛔ IT ASSERTS EXISTENCE, NEVER CONTENT. A test file emptied to `describe.skip` still counts. That property is
// owned by `verif/test-modes.test.ts` (`passWithNoTests: false` per project) and by the mutation ledger.
//
// ── A THIRD TEST WAS WRITTEN HERE AND DELETED BEFORE COMMIT, RECORDED BECAUSE THE REASON IS THE POINT ─────────
// It read the manifest and asserted the script surface was plausibly large — offered as a CONTROL proving the
// reader had landed on a real file. ⛔ IT COULD NOT FAIL ALONE. The only mutation that reddens it — a `scripts`
// object too small to hold seven commands — necessarily reddens the command check above it too, because those
// seven ARE scripts. A control that cannot redden while its subject stays green proves nothing about the
// subject, and this repository has shipped several. Both checks below already fail LOUDLY on reader breakage:
// an empty `scripts` names all seven as missing, and an empty `readdirSync` gives 0 against the floor.
//
// ── THE MUTANTS, DRIVEN BY HAND ON A DISPOSABLE COPY AND RECORDED ─────────────────────────────────────────────
// Never on this tree: a harness that edits what it measures has already cost this repository a measurement to a
// `finally` a kill skipped. Both limbs were driven and both were observed RED before this file was committed;
// the transcript is in the JAN-CSAAEXT S1 commit message.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The `verif/` test-file population as measured 2026-09-11. RAISE THIS DELIBERATELY when tests are added — an
 * addition never reddens the check, so a stale-low floor silently buys back the exposure this file closes.
 *
 * ⚠ IT WAS 62 WHEN FIRST WRITTEN, AND THIS FILE MADE IT 63. Recorded because it is the first instance of the
 * very failure the sentence above warns about, committed in the act of writing that warning: the population was
 * measured before the measuring file existed. A floor is a claim about a population the claimant is inside.
 *
 * 63 -> 64 (2026-09-11, JAN-CSAAEXT S2): `verif/product-boundary.test.ts`. ⭑ RAISED BY THE VERY NEXT INCREMENT,
 * which is the discipline this comment asks for working rather than the warning repeating: the addition did NOT
 * redden anything — a floor never does — so nothing would have prompted the raise except reading this note.
 *
 * ⛔ 64 -> 63 (2026-09-11, JAN-CSAAEXT S5): `verif/svelte-name-projection.test.ts` MOVED to
 * `packages/csaa/src/providers/svelte/name-projection.test.ts`, with its module. ⚠ THIS IS THE ONE DIRECTION THE
 * FLOOR ACTUALLY GUARDS, so lowering it is the one edit that must never be made casually — it is made here
 * because the population genuinely shrank by a deliberate, recorded move, and NOT because the check complained.
 * ⭑ The distinction is the whole value of the floor: it reddened (63 against a floor of 64), the move was
 * checked against this note, and only then was the number lowered. A floor lowered to silence a red is the
 * failure this guard exists to prevent; a floor lowered to record a move is its intended use.
 * WHY THE MOVE: measured, `verif/svelte-name-projection.ts` had ZERO consumers across every tracked file, and
 * its one JPWB-subject limb — that every application file projects with zero parse diagnostics — is owned by
 * `svelte-check`, which `apps/rph-demo`'s `check` runs as a `gate:fast` step. Its instrument is CSAA's 612-line
 * svelte provider, so it follows its instrument rather than being vendored into JPWB.
 *
 * ⛔ 63 -> 62 (2026-09-12, JAN-CSAAEXT S6): `verif/csaa-technical-completion.test.ts` MOVED to
 * `JanumiCode/csaa/scripts/` with the wrapper it imports. Its subject was CSAA's own completion steps, so it
 * follows CSAA out of the repository subtree entirely — the second recorded DECREASE, and the last one this
 * programme expects.
 *
 * 64 -> 65 (2026-09-12, JAN-PFA R3): `verif/export-guard.test.ts`. ⭑ IT TESTS THREE JUDGMENTS, not an
 * arithmetic — what counts as a CONSUMER, what counts as a FILE, and what counts as a FINDING — each of which
 * was wrong once and between them moved the measured obligation by hundreds of exports.
 *
 * 63 -> 64 (2026-09-12, JAN-PFA R2): `verif/mutants-scope.test.ts`. ⭑ IT CARRIES TWO REGRESSION CASES FOR
 * DEFECTS THE FEATURE SHIPPED AND HAD REMOVED, in opposite directions, both in the classifier that decides
 * whether a finding is being claimed at all. A defect found by running rather than reading returns the moment
 * the reasoning that produced it is repeated, so it is pinned rather than remembered.
 *
 * 62 -> 63 (2026-09-12, JAN-PFA R1): `verif/coverage-floor.test.ts`. ⭑ IT IS HERE BECAUSE THE THING IT DRIVES
 * IS A GATE STEP, and because the per-file ratchet's two limbs must be shown to fail SEPARATELY — which the
 * gate step itself, a single pass/fail over 106 files, structurally cannot show. Its fixtures are private temp
 * dirs, so it asserts over the mechanism rather than over today's coverage numbers.
 *
 * ⚠ 65 -> 79 (2026-09-24, JAN-CRITREAD J2-3): measured before this increment's files the population was 76, not 65 —
 * eleven files had landed since the last raise and nothing prompted one, which is the stale-low floor the note above
 * warns about, found by the act of raising it. This increment adds three: `verif/reviewer-qualification-fingerprint`,
 * `verif/reviewer-qualification-check` and `verif/gate-tail` (`.test.ts` each). The floor is set to the population.
 */
const VERIF_TEST_FLOOR = 79;

/**
 * The root commands JPWB owns, salvaged from `assertJpwbRequiredRootCommands`. ⚠ That list has 34 names and
 * TWENTY-SEVEN of them are `csaa:*`, which leave with the engine; these seven are the whole of the residue.
 * Enumeration is correct HERE — unlike the test-file population — because this is a small, stable, deliberate
 * set whose membership is a design decision rather than a growing consequence of other work.
 */
const REQUIRED_ROOT_COMMANDS = [
	'boundary',
	'check-types',
	// JAN-PFA R1 (2026-09-12): 7 -> 8. The per-file coverage ratchet's CHECK arm is gate material and is named
	// here so it cannot vanish from `package.json` the way this file exists to prevent. ⚠ Its WRITER
	// (`coverage:floor`) is deliberately NOT listed: a writer that regenerates the artifact is not a guarantee,
	// and requiring it would invite someone to satisfy the gate by rewriting the baseline.
	'coverage:floor:check',
	'gate',
	// JAN-EXEC R11 (2026-09-15): 9 -> 10. The generated-artifact freshness gate. It is named here for exactly
	// the reason this list exists — a root command that VANISHES makes `gate:fast` run a shorter gate with no
	// other symptom — and it is the command whose absence is hardest to notice, because a stale generated
	// contract compiles, passes every type check and passes every test written against itself.
	// ⚠ Its WRITER (`gen`) is deliberately NOT listed, on the same reasoning recorded for `coverage:floor`
	// three lines up: requiring the regenerator would invite satisfying the gate by regenerating.
	'gen:check',
	'guards:export:check',
	'gate:fast',
	'lint',
	'test',
	'test:coverage',
	// JAN-CRITREAD J2-3 (2026-09-24): 10 -> 12. The reviewer-qualification check and the runner that puts it in the
	// gate's tail beside the browser tests (DESIGN-what-the-tests-prove.md §5.6). Either vanishing makes `gate:fast`
	// run a shorter gate — and the sequencing pin resolves the check through `gate:tail`'s exported steps.
	'reviewer:qual:check',
	'gate:tail'
] as const;

/** Counted from DISK, not from git: vitest collects what is on disk, and that is the population at risk. */
function verifTestFiles(): string[] {
	return readdirSync(`${ROOT}verif`, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
		.map((entry) => entry.name)
		.sort();
}

function rootScripts(): Record<string, string> {
	const manifest = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as {
		scripts: Record<string, string>;
	};
	return manifest.scripts;
}

describe('JAN-CSAAEXT S1 — JPWB watches its own assurance surface', () => {
	it('the verif test population has not silently shrunk — a deleted test is not a passing test', () => {
		const found = verifTestFiles().length;
		// Asserted as text rather than `toBeGreaterThanOrEqual`, so the failure message carries BOTH the number
		// found and the floor it missed. A bare "expected 61 to be >= 62" does not say which population was read.
		expect(`verif test files on disk: ${found} (floor ${VERIF_TEST_FLOOR})`).toBe(
			`verif test files on disk: ${Math.max(found, VERIF_TEST_FLOOR)} (floor ${VERIF_TEST_FLOOR})`
		);
	});

	it('every root gate command JPWB owns is still declared — one that VANISHED is named', () => {
		const scripts = rootScripts();
		const missing = REQUIRED_ROOT_COMMANDS.filter((name) => typeof scripts[name] !== 'string');
		// Named rather than counted: the point of the check is to say WHICH command left.
		expect(missing).toEqual([]);
	});

	it('the required-command list is not empty, or the check above passes on nothing', () => {
		// ⛔ THIS CLOSES A HOLE THE CHECK ABOVE CANNOT SEE, FOUND WHILE DECLARING ITS MUTANTS (S3). `missing` is
		// `[]` both when every command is present AND when `REQUIRED_ROOT_COMMANDS` is empty — a satisfied guard
		// and an absent one are the same observation, which is this repository's most-recorded defect shape.
		// ⭑ AND IT IS INDEPENDENT, NOT A RESTATEMENT: emptying the list reddens THIS and leaves the check above
		// green, while removing a command from `package.json` reddens the check above and leaves this green.
		// ⚠ THE RESIDUAL IS STATED RATHER THAN CLAIMED AWAY: someone who removes a command AND decrements this
		// number has made a deliberate, reviewable edit. That is the most a population pin can buy, and it is
		// the same bargain `COLLAPSE_FLOOR` strikes in `verif/dependency-boundary-rules.test.ts`.
		expect(REQUIRED_ROOT_COMMANDS).toHaveLength(12);
	});

	// ── S1D / S4 — THE GATE'S OWN COMPOSITION, PINNED FROM JPWB FOR THE FIRST TIME ───────────────────────────
	// `packages/csaa/src/inventory/boundary-policy.test.ts:31-33` pinned `gate:fast` as OPENING with two CSAA
	// steps. ⚠ `JAN-CSAADEC` `CD-02` deliberately declined to reproduce it, recording why in
	// `verif/dependency-boundary-rules.test.ts:177-180`: *"`CD-05` makes that assertion false by design, and
	// copying it here would be authoring a gate against the increment it belongs to."* `CD-05` was withdrawn and
	// `JAN-CSAAEXT` `D-1` changes the composition instead — so the reason for the gap has expired, and the pin is
	// authored here against the POST-DETACHMENT shape rather than salvaged verbatim.
	//
	// ⭑ IT PINS THE DETACHMENT ITSELF, WHICH THE INCUMBENT COULD NOT. CSAA asserted that its own steps came
	// FIRST; this asserts they are ABSENT. A re-added `csaa:*` step reddens here — so the coupling this programme
	// removed cannot return unnoticed, which is the guarantee `D-1` actually bought.
	it('gate:fast runs JPWB steps only, in order, with no csaa step anywhere in it', () => {
		const steps = (rootScripts()['gate:fast'] ?? '').split(' && ').map((step) => step.trim());
		expect(steps).toEqual([
			'bun run slices:ledger:check',
			// JAN-PFA R3 (2026-09-12): the export-guard ratchet. It sits SECOND because it is a static census
			// over source and the ledger — it needs no build, no tests and no coverage — so a lost guard fails
			// the gate in seconds rather than after the twelve minutes the rest of the run costs.
			'bun run guards:export:check',
			// ⭐⭐ JAN-EXEC R11 (2026-09-15): 13 STEPS -> 14, AND THE PIN IS UPDATED WITH ITS REASON RATHER THAN
			// WORKED AROUND. `REG-005` carries *"no `gen` freshness gate exists"* as an open finding; R11 is a
			// VOCAB change that regenerates three committed TypeScript contracts plus 119 JSON Schemas, which is
			// exactly the drift that finding names, so the check arrives WITH the act rather than after it.
			//
			// ⛔ IT SITS THIRD, AND THE POSITION IS AN ARGUMENT. Like the two static censuses above it, it needs
			// no build, no tests and no coverage — it copies three packages, runs six generators and compares
			// bytes, in seconds. ⚠ AND IT MUST PRECEDE `check-types`, `build` AND `test`: every one of those
			// measures the GENERATED source, so a stale contract does not make them fail — it makes them pass,
			// against the wrong artifact. A freshness check placed after them would be reporting on a run that
			// had already drawn its conclusions from the file it was about to condemn.
			'bun run gen:check',
			'bun run tracker:build',
			'bun run check-types',
			'bun run lint',
			'bun run boundary',
			'bun run build',
			'bun run test',
			'bun run test:coverage',
			// JAN-PFA R1 (2026-09-12): the per-file coverage ratchet. It sits HERE and nowhere else because it
			// reads `test:coverage`'s output and nothing else — one JSON comparison, no second measurement — and
			// because placing it before its producer would make it a checker that blames the wrong step.
			'bun run coverage:floor:check',
			'cd apps/rph-demo',
			'bun run check',
			// ⭐⭐ JAN-CRITREAD J2-3 (2026-09-24): `bun run e2e` -> `cd ../.. && bun run gate:tail`, AND THE POSITION IS AN
			// ARGUMENT (DESIGN-what-the-tests-prove.md §5.6). The tail runs `reviewer:qual:check` from the root and the
			// browser tests in `apps/rph-demo`, BOTH ALWAYS, and exits with the worse (`scripts/gate-tail.ts`,
			// `verif/gate-tail.test.ts`). ⛔ The check could not simply be chained: placed early, a red check would blind
			// every step after it; appended after e2e, any e2e red would skip it without a word. ⚠ It is LAST because it
			// reads the record, which nothing earlier in the gate produces, and because the browser tests were last.
			'cd ../..',
			'bun run gate:tail'
		]);
	});

	it('boundary cruises the packages perimeter and invokes no csaa script', () => {
		// ⚠ ITS SIBLING IN JPWB ASSERTS THE PREFIX ONLY. `verif/dependency-boundary-rules.test.ts:181-188` pins
		// that `boundary` STARTS with `depcruise packages --config …`, which stayed green through the detachment
		// because a prefix match cannot see a removed tail. That is not a criticism of it — it was scoped to the
		// cruise on purpose — but it does mean the disappearance of the CSAA half was watched by nothing until
		// this line. The two are complementary: that one owns the cruise, this one owns the absence.
		const boundary = rootScripts().boundary ?? '';
		expect(boundary).toBe('depcruise packages --config .dependency-cruiser.cjs');
	});
});
