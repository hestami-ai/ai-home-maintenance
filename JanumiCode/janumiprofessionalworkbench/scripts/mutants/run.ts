// The MUTATION RUNNER — JAN-VERIF V-1. `bun run mutants`
//
// Applies each mutant in `ledger.ts`, runs ONLY the suites that mutant claims it reddens, restores the file, and
// verifies the tree is clean again. Four verdicts, three of which are failures (see the ledger's header).
//
// IT RUNS UNDER SOURCE RESOLUTION, AND THAT IS THE WHOLE REASON V-0 CAME FIRST. Cross-package tests otherwise
// read the built `dist`, so a `rph-domain` mutant validated by an `rph-application` suite is silently
// meaningless — that produced a FALSE GREEN twice in one working session, and the second adversarial review
// flagged it as unaccounted-for in its own method. The root `vitest.config.ts` aliases every `@janumipwb/*`
// specifier to `src`, so no rebuild is needed and the trap cannot recur here BY CONSTRUCTION rather than by
// remembering.
//
// SAFETY. The file is restored in a `finally`, and the run ABORTS if `git status --porcelain` is not clean at
// the end — a mutation harness that leaves a mutant behind is worse than none, and one of the review agents in
// this repo did exactly that mid-run.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECLARED_MUTANTS, type DeclaredMutant } from './ledger.js';
import { timeoutEvidence } from './measured.js';
import { gradeControl, gradeNamedVictim, nonCompletion } from './verdict.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Records the mutant currently applied, so a KILLED run can be recovered from. See `recoverAbandonedMutant`. */
const JOURNAL = `${ROOT}scripts/mutants/.in-flight`;
/** Where HARVEST writes its candidate victims. Gitignored: it is an input to a judgment, never a record. */
const HARVEST_OUT = `${ROOT}scripts/mutants/.harvest.json`;
/** Vitest's machine-readable run report, read back by HARVEST. Also gitignored, also never a record. */
const HARVEST_REPORT = `${ROOT}scripts/mutants/.harvest-run.json`;
/** The UNMUTATED whole-suite report a control's verdict is differenced against (REG-F-116). Gitignored. */
const BASELINE_REPORT = `${ROOT}scripts/mutants/.baseline-run.json`;
/** One control's whole-suite report, compared against `BASELINE_REPORT`. Gitignored. */
const CONTROL_REPORT = `${ROOT}scripts/mutants/.control-run.json`;

type Verdict =
	| 'KILLED'
	| 'SURVIVED'
	| 'UNANCHORED'
	| 'RETIRED'
	| 'TYPE_PREVENTED'
	| 'NO_COMPILE'
	| 'KILLED_UNNAMED'
	| 'ABORTED_DIRTY'
	| 'CONTROL_HELD'
	// NOT MEASURED — the run never exercised the mutation, so no verdict about it is available. See `measured.ts`
	// and REG-F-116. It BLOCKS, like every other "the instrument did not work" verdict here, because a gate cannot
	// pass on an unmeasured mutant; what it must never do is masquerade as a finding about the code.
	| 'INCONCLUSIVE'
	| 'DUPLICATE'
	// PREFLIGHT ONLY, and deliberately not a measurement. See `PREFLIGHT` below.
	| 'APPLICABLE';

// ── PREFLIGHT (`MUTANTS_PREFLIGHT=1`) ────────────────────────────────────────────────────────────────────────
//
// Checks ONLY that each mutant still ANCHORS and still COMPILES, and runs no tests at all. It exists because the
// two verdicts that mean "the ledger has rotted" — UNANCHORED and NO_COMPILE — are both decided before a single
// test runs, yet finding them costs a full run: **roughly 44-47 minutes of subprocess time over 205 mutations**
// (2615.5s at 52dc5e1a, 2848.7s at 7df537cd) by `printTimings` below — targeted vitest ~20%, whole-suite vitest
// ~20%, Playwright ~17%, tsc ~27%, per-victim baselines ~12%; no single leg dominates.
// ⚠ A RANGE, NOT A POINT, AND THE REASON IS REG-F-174. `tsc packages/rph-application` runs 78 identical calls
// every run and spread 302-352s across four of them — a +16.3% swing on a leg NOTHING changed. Any before/after
// delta smaller than that is machine variance, so single-run totals here are quoted as a band.
// ⚠ UP FROM 37.2 min AT e070c462, AND THE RISE IS A GUARANTEE BOUGHT, NOT A REGRESSION: REG-F-171 added the
// per-victim baseline so a KILLED means the victim went GREEN -> RED rather than merely being red.
// ⚠ DATED ON PURPOSE, AND IT REPLACES AN UNDATED GUESS (REG-F-164). This said "~40-minute run" and a
// sibling comment said "~30-minute" — two numbers, disagreeing, neither dated, both written when the
// ledger held roughly half its entries, and both used to justify speedups. A duration in a comment is a
// measurement with no instrument behind it; re-measure and re-date rather than adjusting the adjective.
//
// Triaging rot against a fast loop is the difference between a ledger that gets repaired and one that accumulates.
//
// IT IS NOT A WEAKER FULL RUN. A mutant that anchors and compiles reports `APPLICABLE`, which says only that it
// COULD be measured — never that it was. Preflight refuses to print a verdict summary for exactly that reason: a
// table of APPLICABLE rows must not be readable as evidence about any guard.
const PREFLIGHT = process.env.MUTANTS_PREFLIGHT === '1';

// ── HARVEST (`MUTANTS_HARVEST=1`) ────────────────────────────────────────────────────────────────────────────
//
// Runs ONLY the mutants that have no named victim, and records WHICH test files actually reddened. It exists
// because the summary below has been reporting the same records defect for every run since V-1 — 46 mutants
// killed "package-wide", i.e. by something — with no cheap way to convert that into the stronger claim.
//
// THE HONEST LIMIT, and it is the reason this mode WRITES NOTHING INTO THE LEDGER. What a harvest observes is
// every suite that FAILED, which is not the same as every suite that TESTS THE GUARD. A broad integration test
// reddens on almost any mutation; recording it as the victim would produce a ledger that reports KILLED while the
// guard is untested — the exact shape (F-28) this programme keeps finding, manufactured by its own instrument.
// So the output is CANDIDATES, the choice among them is a judgment made against the suites' actual assertions,
// and the choice is then PROVED by a normal run: a wrongly-named victim no longer reddens, so the mutant reports
// SURVIVED and the gate fails. The harvest proposes; the gate disposes.
const HARVEST = process.env.MUTANTS_HARVEST === '1';

interface Result {
	readonly mutant: DeclaredMutant;
	readonly verdict: Verdict;
	readonly detail: string;
	/** HARVEST only: the test files that actually reddened, repo-relative. Candidates, never a conclusion. */
	readonly victims?: readonly string[];
}

/** `cwd` defaults to the repo root; an e2e victim overrides it with the app that owns the Playwright config. */
/**
 * ⚠ `env` IS PASSED EXPLICITLY, NOT INHERITED (REG-F-110, second attempt).
 *
 * The first fix set `process.env.RPH_MUTANT_APPLIED` in the parent and relied on `spawnSync` inheriting it. Under
 * Bun it did not reach the child: the full suite passed by hand with the variable exported in the shell, and the
 * SAME suite under this runner still failed. Measured, not reasoned — the mechanism was right and the delivery was
 * silent. `env: { ...process.env, ...env }` makes the hand-run and the runner-run the same run.
 */
const sh = (
	cmd: string,
	args: readonly string[],
	cwd: string = ROOT,
	env: NodeJS.ProcessEnv = {}
) =>
	spawnSync(cmd, args, {
		cwd,
		encoding: 'utf8',
		// ⚠ NO `shell: true`, AND ITS REMOVAL IS THE FIX FOR A MEASURED EVIDENCE LOSS (REG-F-176).
		//
		// Under Bun, a child that EXITED 0 having written more than 1,048,576 bytes was reported to this runner as
		// `{ status: 1, signal: null, error: undefined, stdout: '' }` — a PASSING suite delivered as a failure with
		// its evidence emptied, which the kill arm scored KILLED and `timeoutEvidence` could not see because it
		// scans that buffer. All four combinations were measured:
		//     shell:true  + no maxBuffer -> status 1,    0 bytes,  no error
		//     shell:true  + maxBuffer64M -> status 1,    0 bytes,  no error   <- the knob is INERT under a shell
		//     shell:false + no maxBuffer -> status null, 1.08 MB,  ENOBUFS    <- `nonCompletion` CATCHES this
		//     shell:false + maxBuffer64M -> status 0,    1.26 MB,  no error   <- correct
		// **The shell wrapper is what erases the evidence**, so `maxBuffer` alone could never work — REG-F-168
		// removed it as an inert knob rather than keep a guard that provably cannot fire.
		//
		// ⚠ SAFE ON WINDOWS, AND MEASURED RATHER THAN ASSUMED. `shell: true` existed to resolve `bunx`; both
		// `bunx vitest --version` and `bun --version` return status 0 with `shell: false` here, and a resolution
		// failure would be LOUD (`ENOENT` through `nonCompletion`) rather than silent. Dropping the shell also
		// removes an interpolation layer from every path this runner passes.
		maxBuffer: 64 * 1024 * 1024,
		env: { ...process.env, ...env },
		// ⚠ NO `maxBuffer` HERE, AND ITS ABSENCE IS DELIBERATE (REG-F-168). I added `maxBuffer: 64MB` as the fix
		// for the truncation described below, then DROVE it: **it changed nothing.** Measured under Bun, same
		// child, all four combinations:
		//     shell:true  + no maxBuffer -> status 1,    0 bytes,  no error
		//     shell:true  + maxBuffer64M -> status 1,    0 bytes,  no error   <- the knob is INERT
		//     shell:false + no maxBuffer -> status null, 1.08 MB,  ENOBUFS
		//     shell:false + maxBuffer64M -> status 0,    1.26 MB,  no error   <- correct
		// So `shell: true` is the cause and `maxBuffer` cannot reach it. A knob that provably does nothing is the
		// hollow this repository keeps deleting rather than keeping "just in case" — see the `createObject`
		// exemption removed under REG-F-086 for the same reason. The real fix is dropping `shell: true`, which
		// changes how every one of the 205 spawns resolves `bunx` on Windows and is its own increment.
	});

/**
 * Is the working tree free of MODIFICATIONS? The harness must never leave a mutant behind.
 *
 * `--untracked-files=no` deliberately. What this guard exists to catch is a leaked mutation, and a mutation is always
 * an edit to an existing tracked file — the runner reads `m.file` before it writes, so it cannot create one. Counting
 * untracked files as dirt therefore blocks nothing dangerous and blocks something ordinary: adding a test in the same
 * change as the mutant that proves it. That is a bad trade, because a harness which refuses to run until the tree is
 * pristine is a harness that gets run less often, and this one earns its keep by being run.
 */
/**
 * The paths cleanliness is judged over: the three source trees, PLUS every directory a declared mutant actually
 * targets — DERIVED from the ledger rather than listed.
 *
 * ⚠ THE HARDCODED LIST HAD A HOLE AND WIDENING IT BY HAND WOULD HAVE BEEN THE WRONG FIX. `scripts` was absent, so
 * a mutant declared against the runner or the ledger could leak and nothing would notice. But simply adding
 * `scripts` would forbid running the harness while a NEW ledger entry is uncommitted — and that is the workflow
 * that found REG-F-097 (a run over an edited ledger reported the NO_COMPILE that exposed the missing type gate).
 * Deriving from `m.file` gets both: no mutant target can be outside the check, and a directory nothing mutates
 * imposes nothing — but it is no longer free. RE-MEASURED at HEAD: five entries target `scripts/mutants/measured.ts`
 * (four from REG-F-116, one from REG-F-120), so since 2026-08-12 `scripts` IS in the derived set and a run over an
 * UNCOMMITTED ledger or runner edit now aborts at `treeIsClean`. That is the price of closing the leak hole; do NOT
 * re-hardcode the three trees to buy the workflow back. ⚠ The trigger test this paragraph used to state was itself
 * mis-specified — nothing targets `run.ts`, the widening came from a SIBLING in the same tree, so a reader applying
 * that test literally would have re-confirmed the stale sentence forever.
 */
const CLEANLINESS_PATHS = [
	...new Set([
		'packages',
		'apps',
		'verif',
		...DECLARED_MUTANTS.map((m) => m.file.split('/')[0] ?? '').filter((d) => d !== '')
	])
];

function treeIsClean(): boolean {
	const r = sh('git', ['status', '--porcelain', '--untracked-files=no', '--', ...CLEANLINESS_PATHS]);
	return (r.stdout ?? '').trim() === '';
}

/**
 * Everything decidable WITHOUT applying the mutation: history, contamination, and ledger rot. Returns either the
 * settled verdict or the pristine file content the caller must restore.
 *
 * Split out from `runMutant` so that the three "the ledger has rotted" paths are readable as one group — they are
 * the verdicts this instrument exists to surface, and they must be decided before anything is written to disk.
 */
function preApplyVerdict(m: DeclaredMutant): { result: Result } | { original: string } {
	// RETIRED is decided BEFORE anything is applied. A mutant whose target the code legitimately removed is
	// history, not a run: attempting it would report UNANCHORED or NO_COMPILE depending on whether its `find` or
	// its `replace` referenced the removed code, which is an implementation detail of the rot rather than a fact
	// about the guard.
	if (m.supersededBy !== undefined)
		return {
			result: {
				mutant: m,
				verdict: 'RETIRED',
				detail: `superseded by ${m.supersededBy.split(' —')[0]}`
			}
		};

	// DUPLICATE, likewise decided before anything is applied. Running a byte-identical copy re-measures a guard
	// already measured and, worse, counts the same kill twice — which is exactly how "90 mutants" came to be reported
	// for 87 distinct mutations.
	if (m.duplicateOf !== undefined)
		return {
			result: {
				mutant: m,
				verdict: 'DUPLICATE',
				detail: `same mutation as ${m.duplicateOf.split(' —')[0]}`
			}
		};

	// CLEANLINESS IS CHECKED BEFORE **EVERY** MUTANT, not just at the ends — and the reason is a real corruption
	// this harness suffered.
	//
	// A single leaked mutation poisons everything after it, silently and permanently: the next mutant on that file
	// snapshots the ALREADY-MUTATED content as its `original`, so its "restore" faithfully writes the mutation back.
	// One leak becomes the new baseline. Worse, every later mutant's typecheck then fails on the LEAKED edit — in a
	// file it never touched — and reports NO_COMPILE, which reads exactly like a well-behaved verdict.
	//
	// That happened here twice: once when an external timeout killed a run mid-mutant, and once when a manual
	// verification of one mutant was run CONCURRENTLY with a full run. Both produced a full, plausible, entirely
	// worthless verdict table. Failing loudly at the first sign of dirt is the only way the output means anything.
	if (!treeIsClean())
		return {
			result: {
				mutant: m,
				verdict: 'ABORTED_DIRTY',
				detail:
					'the tree was already dirty when this mutant began — every verdict after this point is void'
			}
		};

	let original: string;
	try {
		original = readFileSync(`${ROOT}${m.file}`, 'utf8');
	} catch {
		return { result: { mutant: m, verdict: 'UNANCHORED', detail: `file not found: ${m.file}` } };
	}

	// The anchor must be UNIQUE. Zero occurrences means the code moved out from under a declared mutation;
	// several means the mutation is ambiguous and would land somewhere nobody chose. Both are ledger rot, and
	// both are the verdict this codebase most needed — two register mutations had silently become unapplicable.
	const hits = original.split(m.find).length - 1;
	if (hits !== 1)
		return {
			result: {
				mutant: m,
				verdict: 'UNANCHORED',
				detail: hits === 0 ? 'anchor text is GONE' : `anchor occurs ${hits}x — ambiguous`
			}
		};
	return { original };
}

/**
 * Which suites this mutant claims it reddens.
 *
 * A mutant with NO NAMED VICTIM is still worth running, against a weaker claim — but since JAN-VERIF V-3c that
 * claim no longer passes the gate: `unnamedVictims` is added into `failures`, so KILLED_UNNAMED FAILS THE BUILD
 * rather than being reported separately in the summary. The mutants inherited from JAN-EXECREM WP-2..WP-15
 * ARRIVED in this state — their work packages declared the mutation but never said WHICH test reddens — and V-3
 * measured and named them. RE-MEASURED at HEAD rather than carried over: of the 87 `.py`-sourced entries, 75 now
 * carry a victim, and NO entry expected to be KILLED has an empty `expectRed`. The ~~17~~ **19** still empty are
 * 10 `duplicateOf`, ~~4~~ **6** `expectSurvive` controls, 2 `expectNoCompile` and 1 `supersededBy` — for every one
 * of which an empty `expectRed` is CORRECT, so the empty-target path below is LIVE and must not be re-documented
 * as dead. (17 -> 19 on 2026-08-13, REG-F-134's two demonstration controls. **DERIVED by importing the ledger,
 * not by adding 2 to the sentence** — the previous number was right, which is the only reason this correction is
 * arithmetic rather than an audit.)
 *
 * ⚠ AND THESE 19 ARE EXACTLY THE ENTRIES A SLOW FOREIGN SUITE CAN DISABLE, which stopped being hypothetical on
 * 2026-08-13. An empty `expectRed` means the WHOLE workspace runs, so `packages/csaa`'s 5000ms timeouts make
 * every one of them INCONCLUSIVE — 8 genuinely so, since the 11 `duplicateOf`/`supersededBy` are decided before
 * anything is applied. **The controls are the part of this instrument that proves it can fail, and they are the
 * part a foreign package's test performance takes offline first.** That is not a reason to scope them down: a
 * control that only runs the suites you already suspect has stopped being a control.
 *
 * Running the whole workspace tells us whether the guard is tested AT ALL; it cannot say which test does it, so
 * the verdict is KILLED_UNNAMED rather than KILLED. Weaker evidence, honestly labelled, beats no evidence — and it
 * beats GUESSING a victim, which is precisely how a mutant comes to "pass" for the wrong reason.
 *
 * An empty result means "every project", which is slower and correct.
 */
/**
 * Vitest projects held out of every WHOLE-SUITE run, by name.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS A LIST OF NAMES RATHER THAN A SWITCH ──────────────────────────────────────
 * REG-F-136: a mutant with a named victim runs one file, but a CONTROL declares `expectRed: []` and therefore
 * runs the WHOLE workspace by construction. `packages/csaa` times out at the 5000ms default under that load, so
 * every control and every `expectNoCompile` entry — 8 of them — returned INCONCLUSIVE, and the whole gate exited
 * BLOCKING on a package none of them measures. The controls are the part of this instrument that proves it can
 * fail, and they were the first part a foreign suite took offline.
 *
 * ⚠ THIS IS A REAL WEAKENING AND IS NAMED SO IT CANNOT GROW QUIETLY. REG-F-136 itself argued that "a control
 * that runs only the suites you already suspect has stopped being a control", and that argument still stands.
 * What makes this admissible is that it is not a scope-down to the suspected suites: it is the whole workspace
 * MINUS ONE NAMED PACKAGE, which is outside this programme's remit by standing instruction, is never staged from
 * this worktree, and measures none of the code these mutants touch. A SECOND name in this array is a different
 * decision and must be argued on its own, which is why it is a pinned list and not a boolean.
 *
 * ⚠ AND IT IS ANNOUNCED ON EVERY RUN. A control graded against a partial workspace must never be READ as one
 * graded against the whole; `CONTROL_HELD` means "held over everything except these names".
 *
 * The BASELINE must use the identical filter — a control's verdict is a DIFFERENCE against it, and differencing
 * a filtered run against an unfiltered baseline would attribute the excluded project's failures to the mutation.
 */
const EXCLUDED_PROJECTS: readonly string[] = ['csaa'];
const projectFilters = (): string[] => EXCLUDED_PROJECTS.map((p) => `--project=!${p}`);

function targetSuites(m: DeclaredMutant): string[] {
	// `MUTANTS_TARGET` overrides the suite selection for an investigation — e.g. asking whether a rph-domain mutant
	// that survived its OWN package is caught by rph-application's command-layer tests. Kept as an env override
	// rather than a ledger field so it can never silently become part of a recorded verdict.
	const override = process.env.MUTANTS_TARGET;
	if (override !== undefined && override !== '') return [override];
	// UNNAMED VICTIMS RUN THE WHOLE WORKSPACE, and the first attempt at this was WRONG in a way worth recording.
	// It scoped them to `pkgOf(m.file)` — the mutant's own package — and two rph-domain mutants duly "SURVIVED".
	// Both were then killed immediately by rph-application. Of course they were: THE CENTRAL FACT OF THIS CODEBASE
	// IS THAT DOMAIN PREDICATES ARE ENFORCED AT THE COMMAND LAYER, so a pure predicate's real tests live in another
	// package. Scoping a domain mutant to domain tests reproduces F-28 — a pure-predicate assertion accepted as
	// evidence for a command-layer rule — inside the instrument built to detect F-28.
	return [...m.expectRed];
}

/**
 * The decisions the COMPILER alone settles, with the mutation already on disk. Returns null when the mutated tree
 * builds and there is real work left for the test run.
 *
 * Typechecking comes first because a mutant that does not compile never reached the code, so a RED test run would
 * be measuring the compiler rather than the guard — an easy and flattering mistake.
 */
/**
 * WHERE THE TIME GOES — instrumentation only, and it decides NOTHING.
 *
 * ⚠ ADDED BECAUSE THE COST OF THIS GATE WAS BEING OPTIMISED FROM PROSE (REG-F-162). Two numbers were in
 * circulation — `~40-minute run` in this file's own header and `~30-minute run` in `mutant-ledger.test.ts` —
 * BOTH UNDATED, disagreeing with each other, and both written when the ledger held roughly half its current
 * entries. Every speedup proposed against them was arithmetic over a guessed constant.
 *
 * ⚠ IT MUST NOT BE ABLE TO CHANGE A VERDICT, which is the whole design constraint. `timed` returns its callback's
 * value untouched and the accumulators are never read by any arm that decides anything — they are printed after
 * the summary and nowhere else. A timing hook that can alter what is measured is the observer defect this
 * repository has recorded in three other instruments.
 */
const legs: Record<string, { ms: number; n: number }> = {};
function timed<T>(leg: string, fn: () => T): T {
	const t0 = Date.now();
	try {
		return fn();
	} finally {
		const acc = (legs[leg] ??= { ms: 0, n: 0 });
		acc.ms += Date.now() - t0;
		acc.n += 1;
	}
}

/**
 * Where the compile leg's incremental state lives, one file per package.
 *
 * ⚠ THIS RE-CHECKS THE WHOLE PACKAGE FOR A ONE-LINE EDIT, ONCE PER MUTANT, AND THAT IS THE COST BEING ATTACKED.
 * `tsc packages/rph-application` was the single largest compile leg of the 6642430c run — **314.6 s over 78 calls**,
 * one call per live entry in that package — and every one of those 78 calls re-typechecked the entire package from
 * scratch to judge a mutation of a single line.
 *
 * ⚠ IT MUST LIVE OUTSIDE THE TREE `treeIsClean` JUDGES. A run writes this file on every mutant; inside `packages/`
 * or `scripts/` that is a new file appearing mid-run, and while `--untracked-files=no` means it would not currently
 * trip the guard, resting on that flag would make the harness's own cleanliness check depend on a `git status`
 * option. `node_modules/.cache/` is gitignored by construction and is destroyed by `bun install`, which is exactly
 * the invalidation this wants.
 *
 * ⚠ KEPT ACROSS RUNS DELIBERATELY, AND SAFE BECAUSE TYPESCRIPT VALIDATES BY CONTENT. A `.tsbuildinfo` records a
 * per-file version derived from the text, plus the options and the compiler version, and discards itself when any of
 * the three disagree — so a cache left behind by a DIFFERENT commit does not make a changed file go unchecked, it
 * makes it re-checked. Deleting it per run would throw away the cold-start saving on the first mutant of every
 * package for no gain in soundness.
 */
function buildInfoFor(pkg: string): string {
	const dir = `${ROOT}node_modules/.cache/jpwb-mutants`;
	// Created here rather than once at start-up so the path and its directory cannot drift apart: `mkdirSync` with
	// `recursive` is idempotent, and a compile leg that fails because a cache directory was missing would report
	// NO_COMPILE — the instrument's failure wearing a verdict's name.
	mkdirSync(dir, { recursive: true });
	return `${dir}/${pkg.replace(/[/\\]/g, '__')}.tsbuildinfo`;
}

function compileVerdict(m: DeclaredMutant, target: readonly string[]): Result | null {
	// ⚠ A `.svelte` MUTANT MUST BE CHECKED BY THE COMPILER THAT CAN READ IT (REG-F-175). `tsc` does not load
	// `.svelte` AT ALL — measured: `tsc --noEmit -p apps/rph-demo/tsconfig.json --listFiles` reports 1640 files
	// and ZERO of them `.svelte`, because the app's config extends the generated `.svelte-kit/tsconfig.json`.
	// Six ledger entries target `.svelte` files, so for those six this leg was typechecking a program that
	// **never contained the mutated file**: `NO_COMPILE` was structurally unreachable, the leg's time was spent
	// proving nothing, and a `KILLED` could not exclude *"the page simply failed to build"* — which is the
	// separation `compileVerdict` exists to provide.
	//
	// ⚠ IT INVOKES THE APP'S OWN SCRIPT RATHER THAN REIMPLEMENTING ITS COMMAND. `apps/rph-demo`'s `check` is
	// `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json`, and `svelte-check` reads 1660 files including
	// every `.svelte` — a SUPERSET of what `tsc` saw. Calling the script by name means the gate cannot drift from
	// what the app actually checks: change the app's checker and this follows, with nothing to remember. The
	// harness was compiling the app with a WEAKER compiler than the app's own gate, and copying the command here
	// would have re-created that gap the next time the app changed.
	const isSvelte = m.file.endsWith('.svelte');
	const pkg = pkgOf(m.file);
	const types = isSvelte
		? timed(`svelte-check ${pkg}`, () => sh('bun', ['run', '--cwd', pkg, 'check']))
		: timed(`tsc ${pkg}`, () =>
				sh('bunx', [
					'tsc',
					'--noEmit',
					'--incremental',
					'--tsBuildInfoFile',
					buildInfoFor(pkg),
					'-p',
					`${pkg}/tsconfig.json`
				])
			);
	const compiles = types.status === 0;
	// A mutant may be declared as EXPECTED not to compile (`expectNoCompile`). For those, refusing to typecheck IS
	// the guarantee: the defect is UNEXPRESSIBLE rather than merely caught, which is stronger — a test can be
	// deleted, a type cannot be worked around without a deliberate signature change. A mutant that suddenly
	// COMPILES is then the finding, because the type-level guarantee has been lost.
	if (m.expectNoCompile !== undefined)
		return compiles
			? {
					mutant: m,
					verdict: 'SURVIVED',
					detail: 'declared type-prevented, but it COMPILES — the type-level guarantee is gone'
				}
			: { mutant: m, verdict: 'TYPE_PREVENTED', detail: `${m.expectNoCompile.slice(0, 88)}…` };
	if (!compiles) {
		const out = types.stdout ?? types.stderr ?? '';
		// Preflight prints SEVERAL error lines, because reformulating a rotted mutant needs the actual diagnostic
		// and the first line is often only the outermost of a cascade.
		return {
			mutant: m,
			verdict: 'NO_COMPILE',
			detail: PREFLIGHT ? errorLines(out) : firstLine(out)
		};
	}
	// Preflight stops HERE, before any test runs. `APPLICABLE` is the honest label for what has been established:
	// the mutant still lands somewhere, and the mutated tree still builds. Nothing more.
	if (PREFLIGHT)
		return {
			mutant: m,
			verdict: 'APPLICABLE',
			detail: `would run: ${target.length > 0 ? target.join(', ') : 'workspace'}`
		};
	return null;
}

/**
 * Where this mutant's run should write vitest's machine-readable report, or `undefined` for the exit code alone.
 *
 * Two callers want it for different reasons: HARVEST records which suites reddened for a mutant with no named
 * victim, and a CONTROL needs the set of failing files to difference against the baseline (REG-F-116). They write
 * to separate paths deliberately — one is an input to a human judgment and the other is an input to a verdict, and
 * a shared file would let a stale harvest decide a control.
 */
function jsonReportFor(m: DeclaredMutant): string | undefined {
	if (HARVEST) return HARVEST_REPORT;
	if (m.expectSurvive !== undefined) return CONTROL_REPORT;
	return undefined;
}

/**
 * A CONTROL's verdict, graded on the DIFFERENCE against the unmutated baseline rather than on the exit code.
 *
 * See `takeBaseline` for why: a control runs the whole workspace, so a non-zero exit is a claim about every test in
 * the repository, and three controls were reported SURVIVED on this gate's first run because one unrelated pinned
 * literal in another package was red.
 */
/**
 * ⚠ THE DECISION MOVED TO `verdict.ts` AND THIS IS NOW ONLY THE I/O (REG-F-165). The grading logic lived here,
 * inside a module with ZERO exports that executes on import — so no suite could reach it, and a fail-open sat in
 * it undetected: a run that exited non-zero and wrote a report naming NO failing test file was graded
 * CONTROL_HELD, one line below the arm written to refuse exactly that. **The layer deciding what every other
 * verdict means was the only layer with no test on it**, and it stayed that way because a script's logic is
 * untestable by default rather than by decision.
 *
 * What remains here is the part that must touch the world — reading the report — and it is deliberately the only
 * part: `gradeControl` is pure so fixtures can enter the arms no healthy run can reach.
 */
function controlVerdict(m: DeclaredMutant, passed: boolean): Result {
	const { verdict, detail } = gradeControl(passed, failedFiles(CONTROL_REPORT), baseline, m.expectSurvive ?? '');
	return { mutant: m, verdict, detail };
}

/**
 * WAS THIS VICTIM GREEN BEFORE THE MUTATION? — the question the KILLED arm never asked (REG-F-168/171).
 *
 * ⚠ MEASURED, NOT ASSUMED, AND CACHED BY VICTIM RATHER THAN BY MUTANT. 193 killable entries name only 70
 * DISTINCT victims, so the honest question costs 70 runs, not 193 — and 13 of those entries share one file, which
 * is exactly why one unrelated red used to convert thirteen mutants to KILLED at once.
 *
 * ⚠ IT MUST RUN ON A CLEAN TREE, which is why it is called from `runMutant` AFTER `preApplyVerdict` (whose
 * `treeIsClean` gate has already passed) and BEFORE the mutation is written. Running it with a mutant on disk
 * would bake the mutation into its own baseline — the defect REG-F-116 recorded for the whole-suite baseline,
 * and there is no reason to re-learn it here.
 */
/**
 * CONFIRM A RED BEFORE BELIEVING IT — REG-F-173, and it closes the half REG-F-172 left open.
 *
 * A per-victim baseline (REG-F-171) catches ENVIRONMENTAL failures, because those fail the baseline too. It is
 * blind to FLAKES: a timing-dependent test can pass the baseline and fail the mutated run for reasons that have
 * nothing to do with the mutation, and that was still scored KILLED.
 *
 * ⚠ THE ASYMMETRY THAT MADE THIS CHEAP TO FIX, AND IT WAS ALREADY HALF-DONE. `playwright.config.ts:30` sets
 * `retries: 1`, so the e2e channel has ALWAYS confirmed its reds; a fail-then-pass exits zero and reports
 * SURVIVED. **Vitest had neither a retry nor a `testTimeout` override**, so its victims had no confirmation at
 * all — while REG-F-169 measured that this repository's real flake mechanism is precisely a load-dependent
 * crossing of vitest's 5000 ms DEFAULT. The unprotected channel was the one whose flakes had been observed.
 *
 * `--retry=1` re-runs only the FAILED TEST, not the suite, so confirmation costs milliseconds rather than the
 * ~20% a whole re-run of every red victim would have cost.
 *
 * ⚠ AND IT IS A CLOSED PREDICATE, NOT AN ENUMERATION (REG-F-172's rule). It does not ask "did this fail in one of
 * the ways I listed"; it asks whether the failure REPRODUCES. Any nondeterministic failure gets a second chance,
 * including ones nobody has thought of.
 *
 * ⚠⚠ APPLIED TO EVERY VITEST INVOCATION, BASELINE INCLUDED, AND THE SYMMETRY IS LOAD-BEARING. Retrying only the
 * mutated run would let a flaky BASELINE red stand, flipping `victimWasGreen` to false and manufacturing a
 * spurious INCONCLUSIVE. That is REG-F-116's rule — *"the baseline must carry the IDENTICAL filter as the
 * control run"* — restated for a different option, and the reason it is a shared constant rather than a literal
 * typed at four call sites.
 *
 * WHAT A FLAKE BECOMES: a fail-then-pass exits zero, so the mutant reports SURVIVED and BLOCKS. That is a false
 * BLOCKING finding, never a false KILL — the same polarity Playwright has always had, and the safe direction.
 */
const CONFIRM_RED = ['--retry=1'];

const victimGreen = new Map<string, boolean>();

function victimWasGreen(target: readonly string[]): boolean {
	const key = [...target].sort((a, b) => a.localeCompare(b)).join('\u0000');
	const cached = victimGreen.get(key);
	if (cached !== undefined) return cached;
	const leg = isE2eTarget(target) ? 'playwright BASELINE' : 'vitest victim BASELINE';
	const run = timed(leg, () =>
		isE2eTarget(target)
			? runPlaywright(target, {})
			: sh('bunx', ['vitest', 'run', ...CONFIRM_RED, ...target], ROOT)
	);
	// A non-completion is not a green baseline and not a red one; treat it as NOT green so the mutant reports
	// INCONCLUSIVE rather than being graded against a measurement that never happened.
	const green = nonCompletion(run) === null && run.status === 0;
	victimGreen.set(key, green);
	if (!green) console.log(`  victim NOT green before mutation: ${target.join(', ')}`);
	return green;
}

function runMutant(m: DeclaredMutant): Result {
	const pre = preApplyVerdict(m);
	if ('result' in pre) return pre.result;
	const { original } = pre;
	const target = targetSuites(m);
	const unnamed = m.expectRed.length === 0;

	// ⚠ ESTABLISH THE VICTIM'S UNMUTATED STATE FIRST — the tree is still clean here (REG-F-171). A control is
	// graded on a DIFFERENCE and always has been; a named victim was graded on an exit code alone until now.
	const baselineGreen = unnamed ? true : victimWasGreen(target);

	writeFileSync(JOURNAL, m.file, 'utf8');
	writeFileSync(`${ROOT}${m.file}`, original.replace(m.find, m.replace), 'utf8');
	// ⚠ TELL THE ANCHOR CENSUS WHICH MUTANT IS CURRENTLY APPLIED (REG-F-110).
	//
	// REG-F-100's census reads the WORKING TREE and requires every measurable mutant's `find` to occur exactly
	// once. That is exactly right at `gate:fast`, where nothing is mutated — and it is unsatisfiable HERE, because
	// this runner has just replaced one of those strings. The consequence was not a nuisance, it was a BLOCKING
	// FALSE VERDICT: a CONTROL declares `expectRed: []`, so `targetSuites` is empty and vitest runs the WHOLE
	// suite, which includes the census, which fails on every mutation — so all four declared controls reported
	// "SURVIVED: declared a CONTROL, but a test FAILED on it" and the gate blocked on the instrument rather than
	// on the code. Every KILLED verdict whose victim is the census was equally suspect for the same reason.
	//
	// The exemption is exactly ONE id, and it is deliberately not "skip the census under the runner": a mutation
	// that rots a DIFFERENT mutant's anchor must still be caught, which is precisely what
	// `F100-a-a-refactor-rewrites-an-anchored-line` exists to prove. Narrowing the exemption to the applied id
	// makes that mutant sharper, not weaker — it can now only be killed by the two anchors it really breaks.
	//
	// The id travels to every child EXPLICITLY, never by inheritance — `sh` spreads it into `env` (REG-F-110 second
	// attempt; the `sh` docblock records that Bun did NOT inherit it). This parent assignment is what reaches the
	// `tsc` child, for which `sh` is called without an `env` argument; `mutantEnv` below carries it to the vitest and
	// Playwright children. Cleared in the same `finally` that restores the file, for the same reason: a leaked
	// exemption is a disabled guard.
	process.env.RPH_MUTANT_APPLIED = m.id;
	try {
		const settled = compileVerdict(m, target);
		if (settled) return settled;

		// HARVEST asks vitest for the machine-readable report as WELL as the human one, so `summarise` keeps
		// working unchanged and the two views cannot disagree about the same run.
		// The applied mutant's id travels to the child so REG-F-100's anchor census can exempt EXACTLY it.
		//
		// A CONTROL ASKS FOR THE SAME REPORT, for a different reason: its verdict is the DIFFERENCE against the
		// unmutated baseline (REG-F-116), and a difference needs the set of failing files, not an exit code.
		// Scraping them from the human reporter is what `failedFiles` exists to avoid — a dropped filename there
		// would silently convert a real finding into a held control.
		const mutantEnv = { RPH_MUTANT_APPLIED: m.id };
		const jsonTo = jsonReportFor(m);
		// ⚠ DELETE THE REPORT BEFORE THE RUN, SO "NO REPORT" MEANS "THIS RUN WROTE NONE" (REG-F-120).
		//
		// `controlVerdict`'s passing arm returns CONTROL_HELD without calling `failedFiles`, and only `failedFiles`
		// deletes. So a control that PASSES leaves its report on disk, and the next control that exits non-zero
		// WITHOUT writing one reads the stale file, sees `[]`, computes `fresh.length === 0` and is graded HELD —
		// the exact fail-open the `reported === undefined` arm below was added to close, walked around by a file
		// that outlived its run.
		//
		// ⚠⚠ IT IS LATENT TODAY AND ARMS ITSELF WHEN THE REPOSITORY GETS HEALTHIER, which is why it is fixed now
		// rather than when it bites. No control currently reaches the passing arm: one suite is red, so every
		// control exits non-zero, takes the differencing path, and `failedFiles` deletes the report on the way
		// through. **The day that suite goes green, controls start passing, the report starts surviving, and the
		// hole opens.** A defect whose precondition is "the gate is finally clean" is the worst kind to leave.
		//
		// Deleting BEFORE the spawn is strictly stronger than deleting after the read: it also covers an invocation
		// killed mid-flight, whose report would otherwise be inherited by the next run entirely.
		if (jsonTo !== undefined) rmSync(jsonTo, { force: true });
		const leg = isE2eTarget(target)
			? 'playwright'
			: target.length === 0
				? 'vitest WHOLE-SUITE'
				: 'vitest targeted';
		const run = timed(leg, () => isE2eTarget(target)
			? runPlaywright(target, mutantEnv)
			: sh(
					'bunx',
					jsonTo !== undefined
						? [
								'vitest',
								'run',
								...CONFIRM_RED,
								'--reporter=default',
								'--reporter=json',
								`--outputFile=${jsonTo}`,
								...(target.length === 0 ? projectFilters() : []),
								...target
							]
						: ['vitest', 'run', ...CONFIRM_RED, ...(target.length === 0 ? projectFilters() : []), ...target],
					ROOT,
					mutantEnv
				));
		const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
		// ⚠ DID THIS RUN MEASURE THE MUTATION? ASKED BEFORE ANY VERDICT IS ATTRIBUTED (REG-F-116, JAN-VERIF V-4b).
		//
		// Every arm below reads ONE bit — `run.status` — and states a CONCLUSION about the mutation. That inference
		// is only sound if the run exercised it. V-4a proved it need not have: an unrelated suite tipped over its
		// 5000ms default under load, vitest exited non-zero, and this runner printed `SURVIVED: … declared a
		// CONTROL, but a test FAILED on it — something asserts on prose`. There was no such test. **The runner
		// stated a cause it never measured**, and the operator spent four attempts and three confident wrong
		// diagnoses looking for it.
		//
		// IT IS PLACED HERE, ABOVE BOTH ARMS, BECAUSE THE DAMAGE RUNS IN BOTH DIRECTIONS. A control's whole-suite
		// run turns a timeout into a FALSE BLOCKING — loud, and expensive. A NAMED victim's run turns the same
		// timeout into a FALSE KILL: status is non-zero, the ledger records the guard as proven, and nothing that
		// ran ever touched it. REG-F-110 named that asymmetry — *"a false KILL is quieter than a false BLOCK and it
		// had been sitting under a green tick."* One check above both arms is the only placement that catches both.
		//
		// THE COST IS DISCLOSED IN `measured.ts`: a mutation that genuinely HANGS its victim now reports
		// INCONCLUSIVE rather than KILLED, and its author must say so deliberately. That is the correct polarity —
		// the ledger's claim is "this named test reddens BECAUSE it asserts the guard", which a hang cannot establish.
		const timedOut = timeoutEvidence(out);
		if (timedOut !== null) {
			// ⚠ NAME THE SUITE, DO NOT JUST REPORT THE MARKER. The first version of this verdict quoted the timeout
			// text and stopped there, and diagnosing the next blocking run meant inferring the culprit from the
			// milliseconds in the marker. That is the same shortfall REG-F-116 is about, one notch smaller: a
			// verdict is worth what the reader can CHECK, and the failing suites are already in the report a
			// control writes. Absent (a named victim writes no report) it says so rather than guessing.
			const failing = jsonTo === undefined ? undefined : failedFiles(jsonTo);
			const where =
				failing === undefined
					? 'no report was written, so the timed-out suite cannot be named here — re-run with MUTANTS_HARVEST=1'
					: failing.length === 0
						? 'the report names no failing suite'
						: `in: ${failing.slice(0, 3).join(', ')}`;
			return {
				mutant: m,
				verdict: 'INCONCLUSIVE',
				// The observed text is QUOTED rather than summarised, because the entire finding is that a verdict
				// asserted something the reader could not check.
				detail: `the run TIMED OUT (${timedOut}) ${where} — it did not measure this mutation, so neither KILLED nor SURVIVED is available. Fix the slow test; do not raise the timeout. ${summarise(out)}`
			};
		}
		const victims = HARVEST ? readVictims() : undefined;
		// A mutation declared `expectSurvive` is a CONTROL: it edits something behaviour cannot depend on — a
		// rationale string, a comment — so its survival proves the suite is not failing spuriously. For those,
		// survival is the PASS and a KILL is the finding, because a test that reddens when only prose changed is
		// asserting on prose.
		//
		// ⚠ "A KILL" MEANS A **NEW** RED, NOT A NON-ZERO EXIT — REG-F-116's second limb. A control runs the WHOLE
		// workspace, so its exit status is a claim about every test in the repository, and reading it as a claim
		// about this prose edit is only sound if the suite was green to begin with. On this gate's first run it was
		// not: one pinned literal in another package's unit test was red, and all THREE declared controls reported
		// `SURVIVED — something asserts on prose`. Three false findings from one unrelated failure. The exit status
		// cannot answer "did this mutation redden anything"; the DIFFERENCE against the unmutated baseline can, and
		// it is the only question actually being asked.
		// ⚠ DID THE PROCESS FINISH AT ALL? ASKED FIRST, BECAUSE EVERY ARM BELOW READS `status` AND CONCLUDES
		// SOMETHING ABOUT THE MUTATION (REG-F-168). A child killed by a signal, a spawn that failed, or a
		// `maxBuffer` overrun arrives here with `status` non-zero or null and used to be scored KILLED — the
		// runner stating a finding about the guard on the strength of a process that never reported a test result.
		// This is REG-F-116's rule applied to the fields it did not reach: a non-measurement must say so.
		const incomplete = nonCompletion(run);
		if (incomplete !== null) return { mutant: m, verdict: 'INCONCLUSIVE', detail: incomplete, victims };
		if (m.expectSurvive !== undefined) return controlVerdict(m, run.status === 0);
		if (unnamed)
			return {
				mutant: m,
				verdict: run.status === 0 ? 'SURVIVED' : 'KILLED_UNNAMED',
				detail: summarise(out),
				victims
			};
		const graded = gradeNamedVictim(baselineGreen, run.status === 0, target.join(', '), summarise(out));
		return { mutant: m, verdict: graded.verdict, detail: graded.detail, victims };
	} finally {
		writeFileSync(`${ROOT}${m.file}`, original, 'utf8');
		rmSync(JOURNAL, { force: true });
		delete process.env.RPH_MUTANT_APPLIED;
	}
}

/**
 * `packages/rph-domain/src/x.ts` -> `packages/rph-domain`; `verif/x.test.ts` -> `verif`.
 *
 * ⚠ THE SECOND CASE WAS MISSING AND IT REPORTED NO_COMPILE, WHICH READS LIKE A VERDICT. Blind two-segment slicing
 * turns `verif/x.test.ts` into `verif/x.test.ts`, so the preflight typecheck ran `tsc -p verif/x.test.ts/tsconfig.json`
 * and failed with TS5058 — a path error dressed as a compile verdict, on a mutant that in fact kills cleanly.
 * `packages` and `apps` are the workspace roots and nest one level; every other top-level directory is its own
 * project. Named explicitly rather than inferred from the presence of a tsconfig, because a MISSING tsconfig must
 * stay loud: it means the mutated file is under no type gate at all, which is REG-F-097's whole subject.
 */
const NESTED_ROOTS = ['packages', 'apps'];
const pkgOf = (file: string): string => {
	const parts = file.split('/');
	return NESTED_ROOTS.includes(parts[0] ?? '') ? parts.slice(0, 2).join('/') : (parts[0] ?? '');
};

/** The app that owns the Playwright project. Its config, its webServer, its `bunx playwright test`. */
const E2E_APP = 'apps/rph-demo';

/**
 * Does this victim set belong to Playwright rather than vitest? (JPWB-SPEC-001 FORK-19, roadmap S-3.)
 *
 * WHY THIS EXISTS. Until 2026-07-28 the runner always invoked `bunx vitest run <victim>`, so **no guard whose only
 * red-proof is an e2e could be carried by this ledger** — the census was zero `apps/` entries and zero `*.e2e.ts`
 * victims. That is a gap and not a policy: SPEC-001's invariants are surface obligations, and the instrument that
 * measures whether a guard is tested could not reach the surface at all.
 *
 * THE TRAP THIS CLOSES, and it is why the gap could not simply be ignored. Naming an e2e victim under the old
 * runner did NOT fail cleanly: vitest matched no spec, exited non-zero under `passWithNoTests: false`, and the
 * runner recorded **KILLED** — a verdict produced by the file-matcher rather than by any guard, and indistinguishable
 * in the summary from a real kill. A fake measurement is worse than a declared absence, which is why the atomicity
 * guard shipped with no ledger entry and a comment saying so.
 *
 * A MIXED SET IS A DECLARED ERROR, never a silent partial run: one mutant cannot be measured half by Playwright and
 * half by vitest without the verdict meaning two different things at once.
 */
function isE2eTarget(target: readonly string[]): boolean {
	const e2e = target.filter((t) => t.endsWith('.e2e.ts'));
	if (e2e.length === 0) return false;
	if (e2e.length !== target.length)
		throw new Error(
			`mutant victim set mixes e2e and unit specs, which cannot be run as one measurement: ${target.join(', ')}`
		);
	return true;
}

/**
 * Run an e2e victim through Playwright, from the app that owns the config.
 *
 * Paths are made app-relative because the ledger records repo-relative victims (so every entry reads the same way)
 * while `playwright test` resolves against its own config root. The translation is done here rather than in the
 * ledger so that a future second Playwright app needs a table entry, not a different victim spelling.
 */
function runPlaywright(target: readonly string[], env: NodeJS.ProcessEnv): ReturnType<typeof sh> {
	const rel = target.map((t) => (t.startsWith(`${E2E_APP}/`) ? t.slice(E2E_APP.length + 1) : t));
	return sh('bunx', ['playwright', 'test', ...rel, '--reporter=line'], `${ROOT}${E2E_APP}`, env);
}

/**
 * HARVEST: which test FILES failed, from vitest's JSON report, repo-relative and POSIX.
 *
 * Read from the report file rather than scraped from the console output, and the difference is not cosmetic: the
 * human reporter prints a `FAIL` line per failing TEST, truncates, colours, and interleaves stderr from other
 * workers — parsing it would silently drop victims, and a harvest that drops a victim is worse than none because
 * the survivor it hides looks like a clean result.
 *
 * ⚠ RETURNS `undefined` — NOT `[]` — ON A MISSING OR UNREADABLE REPORT, and this docstring asserted the opposite
 * for as long as the fix existed. It read: *"Returns `[]` on a missing or unreadable report, which is honest: the
 * caller records 'no candidates observed', not 'no candidates exist'."* That WAS the behaviour, and REG-F-116
 * removed it precisely because `[]` conflated **"the run reported no failures"** with **"there is no report"** —
 * a control whose run crashed would have been graded HELD. The code changed in that commit; this sentence did
 * not, so the function's own documentation described the fail-open its body had just closed.
 *
 * A reader trusting the docstring would write `failedFiles(p).length === 0` and reintroduce the hole in one line.
 * The two states are now distinct at the type level: `undefined` means NOTHING WAS RECORDED, `[]` means NOTHING
 * FAILED, and every caller must decide which it is looking at — `readVictims` coalesces deliberately (a harvest
 * with no report honestly observed no candidates), `controlVerdict` reports INCONCLUSIVE, `takeBaseline` refuses
 * to run at all.
 */
function failedFiles(reportPath: string): readonly string[] | undefined {
	let raw: string;
	try {
		raw = readFileSync(reportPath, 'utf8');
	} catch {
		// ⚠ `undefined`, NOT `[]` — the two mean opposite things and conflating them is a fail-OPEN hole in the fix
		// for a fail-open hole. `[]` says "the run reported NO failures"; a missing report says "there is no
		// measurement here at all", which for a control that exited non-zero is `INCONCLUSIVE`, not `held`. Caught
		// by reading my own diff rather than by the gate, which would have graded a crashed control as HELD.
		return undefined;
	}
	rmSync(reportPath, { force: true });
	const report = JSON.parse(raw) as {
		testResults?: { name?: string; status?: string }[];
	};
	const rootPosix = ROOT.replaceAll('\\', '/');
	const rel = (abs: string): string => {
		const p = abs.replaceAll('\\', '/');
		// Case-insensitively rooted on Windows, where vitest reports `E:/…` and `ROOT` may be `e:/…`.
		return p.toLowerCase().startsWith(rootPosix.toLowerCase()) ? p.slice(rootPosix.length) : p;
	};
	return [
		...new Set(
			(report.testResults ?? [])
				.filter((t) => t.status === 'failed' && typeof t.name === 'string')
				.map((t) => rel(t.name as string))
		)
	].sort((a, b) => a.localeCompare(b));
}

/** HARVEST's candidates. An unreadable report is honestly "no candidates OBSERVED", never "none exist". */
const readVictims = (): readonly string[] => failedFiles(HARVEST_REPORT) ?? [];

/**
 * WHICH SUITES ARE ALREADY RED **WITHOUT** ANY MUTATION — REG-F-116's second limb, and the one the first run of
 * this gate proved was missing.
 *
 * ⚠ A CONTROL IS GRADED ON THE WHOLE WORKSPACE, SO ITS VERDICT IS A CLAIM ABOUT EVERY TEST IN THE REPOSITORY. It
 * declares `expectRed: []`, `targetSuites` is empty, and vitest runs everything. `run.status !== 0` was then read
 * as "a test reddened BECAUSE of this prose edit" — which is only sound if the suite was GREEN to begin with.
 *
 * IT WAS NOT, AND THE FAILURE WAS NOT EVEN OURS. A single pinned literal in another package's unit test
 * (`packages/csaa`'s whole-repository root-population census, which any new file under `scripts/` or `verif/`
 * moves) was red, and **all three declared controls duly reported SURVIVED: "declared a CONTROL, but a test FAILED
 * on it — something asserts on prose"**. Three false findings from one unrelated red, in a repository two agents
 * are working in at once.
 *
 * V-4b's first pass caught only the TIMEOUT case, because a timeout was the instance I had seen. **That was the
 * defect one size too small**: the general fact is that a whole-suite run cannot attribute its failures to the
 * mutation at all, and a timeout is merely one way for it to fail. So a control is now graded on the DIFFERENCE —
 * did this mutation redden anything that was not ALREADY red — which is the only question its exit status can
 * actually answer.
 *
 * THE BASELINE IS TAKEN ONCE, BEFORE ANY MUTATION IS APPLIED, and only when a control is actually selected: it is
 * a full unmutated suite run and nothing else in this file costs that much. Taking it lazily inside `runMutant`
 * would take it with a mutation on disk, which would bake the mutant into its own baseline — a control that
 * cannot fail, arriving inside the fix for controls that could not pass.
 */
let baseline: readonly string[] | undefined;
function takeBaseline(): void {
	if (baseline !== undefined) return;
	console.log(
		`Taking the unmutated whole-suite BASELINE (a control is graded against it, not against zero), ` +
			`EXCLUDING ${EXCLUDED_PROJECTS.join(', ')} — see EXCLUDED_PROJECTS…`
	);
	// ⚠ TIMED SEPARATELY FROM THE CONTROL RUNS, AND IT WAS MISSING FROM THE FIRST MEASUREMENT (REG-F-164).
	// This is a whole-suite run costing about as much as a control, and leaving it out made the instrument
	// UNDER-REPORT its own subject — the smaller sibling of the defect that made the instrument silent.
	timed('vitest BASELINE', () =>
		sh('bunx', [
			'vitest',
			'run',
			...CONFIRM_RED,
			'--reporter=default',
			'--reporter=json',
			`--outputFile=${BASELINE_REPORT}`,
			// The identical filter as the control runs above. A control's verdict is a DIFFERENCE against this
			// baseline, so a filtered run differenced against an unfiltered baseline would read the excluded
			// project's failures as caused by the mutation.
			...projectFilters()
		])
	);
	// A MISSING BASELINE REPORT IS NOT AN EMPTY ONE. `undefined` here would silently become "nothing was red", which
	// makes every control's difference the whole of its own failure set — the pre-REG-F-116 behaviour, restored by
	// an unreadable file. Left as `undefined` so the differencing arm cannot mistake it for a clean baseline.
	baseline = failedFiles(BASELINE_REPORT);
	if (baseline === undefined) {
		console.error(
			'FAIL: the unmutated baseline run wrote no report, so no control can be graded. Refusing to guess.'
		);
		process.exit(2);
	}
	console.log(
		baseline.length === 0
			? 'BASELINE: the whole suite is GREEN — every control is measurable against zero.\n'
			: `⚠ BASELINE: ${baseline.length} suite(s) ALREADY RED before any mutation — ${baseline.join(', ')}.\n` +
					'  Controls are graded on the DIFFERENCE. A control whose run adds no NEW failure still HELD.\n'
	);
}
const firstLine = (s: string): string =>
	(s.split('\n').find((l) => l.includes('error')) ?? s).trim().slice(0, 160);
/**
 * Up to three `error TSxxxx` lines, for preflight.
 *
 * Reformulating a rotted mutant is done AGAINST the diagnostic, and the first line is frequently only the outermost
 * of a cascade — a mutant that broke a narrowing reports the narrowing site, not the eight later uses that made it
 * fail. Guessing from one line is how a "reformulation" turns into a second broken formulation.
 */
const errorLines = (s: string): string =>
	s
		.split('\n')
		.filter((l) => / error TS\d+/.test(l))
		.slice(0, 3)
		.map((l) => l.trim().slice(0, 150))
		.join(' ⏎ ');
// `filter(...).at(-1)` rather than `findLast`: the shared tsconfig targets ES2022 and `findLast` is ES2023, so
// this line did not typecheck. It ran anyway under Bun — `scripts/` was outside every type gate until 2026-08-09
// (REG-F-097), which is the same reason the unread-refusal ratchet could die unnoticed. Kept at the repo's one
// declared lib level rather than raising a second one for two lines: a divergent `lib` in tooling is the kind of
// thing that gets copied into a package.
const summarise = (s: string): string =>
	(s
		.split('\n')
		.filter((l) => l.includes('Tests '))
		.at(-1) ?? '')
		.replaceAll(new RegExp(String.raw`\[[0-9;]*m`, 'g'), '')
		.trim();

// ── CRASH RECOVERY, added after this runner LOST a mutant ────────────────────────────────────────────────────
//
// The `finally` restore and the end-of-run cleanliness check are both defeated by EXTERNAL TERMINATION: a
// 10-minute command timeout killed a full 90-mutant run mid-mutant and left `validateStepCompletion`'s
// contradictory-cell guard mutated to `if (false && …)` in the working tree. Every subsequent test run would have
// been GREEN against a disabled guard — the precise failure mode this harness exists to prevent, produced by the
// harness itself.
//
// So the in-flight mutant is journalled to disk BEFORE it is applied and cleared after it is restored. A later
// run finds the journal, restores from git, and refuses to continue until the tree is clean. A `finally` is not a
// guarantee when the process can be killed; a file on disk survives.
function recoverAbandonedMutant(): void {
	if (!existsSync(JOURNAL)) return;
	const file = readFileSync(JOURNAL, 'utf8').trim();
	console.error(
		`RECOVERING: a previous run was killed while ${file} was mutated. Restoring from git.`
	);
	sh('git', ['checkout', '--', file]);
	rmSync(JOURNAL, { force: true });
}

recoverAbandonedMutant();

if (!treeIsClean()) {
	console.error('ABORT: working tree is not clean — refusing to mutate over uncommitted changes.');
	process.exit(2);
}

// ⚠ EVERY ARGUMENT IS A FILTER, NOT JUST THE FIRST. This read was `process.argv[2]`, which silently DISCARDED
// argv[3..]: `bun run mutants -- MU-A MU-B` measured MU-A alone and printed `KILLED 1 / SURVIVED 0`, a summary
// that reads as "both passed" over a population of one. The banner's honest count was the only tell.
//
// Found while measuring MU-FRESH-18-C and -D together. Both do kill — verified by running them SEPARATELY,
// which is the check that exposed this. Safe to widen: PREFLIGHT/HARVEST/ADVISORY are environment variables
// (`MUTANTS_PREFLIGHT`, `MUTANTS_HARVEST`, `MUTANTS_ADVISORY` — grep the NAMES; the line numbers this cited had
// already drifted), so no argv entry is ever a flag, and a single argument behaves exactly as before.
const only = process.argv.slice(2);
const chosen =
	only.length > 0
		? DECLARED_MUTANTS.filter((m) => only.some((pattern) => m.id.includes(pattern)))
		: DECLARED_MUTANTS;
// HARVEST narrows to exactly the population the summary complains about: measurable mutants with no named victim.
// A mutant declared `expectSurvive` or `expectNoCompile` is NOT in that population — an empty `expectRed` is CORRECT
// for both (one must redden nothing, the other never reaches a test run), and harvesting a "victim" for either would
// invent a defect to fix.
const selected = HARVEST
	? chosen.filter(
			(m) =>
				m.expectRed.length === 0 &&
				m.supersededBy === undefined &&
				m.duplicateOf === undefined &&
				m.expectSurvive === undefined &&
				m.expectNoCompile === undefined
		)
	: chosen;
function banner(): string {
	if (PREFLIGHT)
		return `PREFLIGHT over ${selected.length} declared mutant(s): anchors and typecheck ONLY, no tests run.\n`;
	if (HARVEST)
		return (
			`HARVEST over ${selected.length} mutant(s) with NO NAMED VICTIM: recording which suites redden.\n` +
			'This proposes CANDIDATES and writes nothing into the ledger — see the HARVEST note in this file.\n'
		);
	return `Running ${selected.length} declared mutant(s) under SOURCE resolution.\n`;
}
console.log(banner());

// ⚠ THE BASELINE IS TAKEN BEFORE THE LOOP, NOT INSIDE IT (REG-F-116). Inside, a mutation would already be on disk
// and the baseline would contain the mutant being graded against it — a control that cannot fail, arriving inside
// the fix for controls that could not pass. It is skipped entirely when no control is selected, because it costs a
// full unmutated suite run and nothing else here does.
if (!PREFLIGHT && selected.some((m) => m.expectSurvive !== undefined)) takeBaseline();

const results: Result[] = [];
for (const m of selected) {
	const r = runMutant(m);
	results.push(r);
	console.log(`${r.verdict.padEnd(14)} ${m.id.padEnd(34)} ${r.detail}`);
	if (r.verdict === 'ABORTED_DIRTY') {
		// STOP. Every verdict after a leak is measured against a tree nobody chose, and a full table of plausible
		// verdicts that happens to be worthless is far more dangerous than a short table that says why it stopped.
		console.error(
			[
				'',
				'ABORTED: the tree went dirty mid-run. Nothing after this point was measured.',
				'Restore with `git checkout -- packages`, then re-run with NOTHING else touching the tree —',
				'in particular, never run a manual mutation while a full run is in flight.'
			].join('\n')
		);
		break;
	}
}

if (!treeIsClean()) {
	console.error('\nFAIL: the working tree is DIRTY after the run — a mutant was left behind.');
	process.exit(2);
}

const by = (v: Verdict) => results.filter((r) => r.verdict === v);

// HARVEST PRINTS NO VERDICT SUMMARY EITHER, and for a stronger reason than preflight's.
//
// Every row here is KILLED_UNNAMED by construction — that is the population it selected — so a summary would say
// only what the selection already said. What it emits instead is the candidate table and a JSON file, both of which
// are INPUTS TO A JUDGMENT. It exits 0 whatever it finds: a harvest that could fail the build would eventually be
// run to make the build pass, and the one thing that must not happen is a victim chosen to satisfy a gate.
if (HARVEST) {
	const rows = results.filter((r) => r.victims !== undefined);
	const surprises = results.filter((r) => r.verdict !== 'KILLED_UNNAMED');
	writeFileSync(
		HARVEST_OUT,
		`${JSON.stringify(
			rows.map((r) => ({ id: r.mutant.id, file: r.mutant.file, victims: r.victims })),
			null,
			'\t'
		)}\n`,
		'utf8'
	);
	for (const r of rows) {
		console.log(`\n${r.mutant.id}\n  ${r.mutant.file}`);
		// A mutant reddening ONE suite is the easy case and the strongest: there is no judgment left to make. Many
		// suites is where the judgment lives, and where naming the wrong one manufactures a false KILLED.
		for (const v of r.victims ?? []) console.log(`    ${v}`);
		if ((r.victims ?? []).length === 0)
			console.log('    (none observed — the JSON report was missing or the run reddened nothing)');
	}
	console.log(
		`\n=== HARVEST: ${rows.length} mutant(s), ${rows.filter((r) => (r.victims ?? []).length === 1).length} with a SINGLE candidate ===\n` +
			`Written to ${HARVEST_OUT.replace(ROOT, '')}. NOT A MEASUREMENT of any guard: these are the suites that\n` +
			'FAILED, not the suites that TEST the guard. Choose against the assertions, then prove the choice with a\n' +
			'normal run — a wrongly-named victim reports SURVIVED.'
	);
	for (const r of surprises)
		console.log(`\nUNEXPECTED VERDICT: ${r.mutant.id} -> ${r.verdict}\n  ${r.detail}`);
	process.exit(0);
}

// PREFLIGHT PRINTS NO VERDICT SUMMARY, deliberately.
//
// Every row it produced is either APPLICABLE — which asserts nothing about any guard — or one of the two rot
// verdicts. Printing those under the same "MUTATION LEDGER SUMMARY" heading a real run uses would make a
// no-tests-were-run table indistinguishable at a glance from a measurement, and this harness has already shipped
// two full tables that were quietly worthless. The rot rows are listed below on their own terms.
if (PREFLIGHT) {
	const rot = [...by('UNANCHORED'), ...by('NO_COMPILE')];
	console.log(
		`\n=== PREFLIGHT: ${by('APPLICABLE').length} applicable, ${rot.length} rotted, ` +
			`${by('RETIRED').length} retired, ${by('DUPLICATE').length} duplicate, ` +
			`${by('TYPE_PREVENTED').length} type-prevented ===\n` +
			'NOT A MEASUREMENT. No test ran; APPLICABLE means only that the mutant still lands and still builds.'
	);
	for (const r of rot) console.log(`\n${r.verdict}: ${r.mutant.id}\n  ${r.detail}`);
	// Preflight blocks on rot too, by the same default. Rot is the one thing preflight can establish on its own
	// authority — an entry that does not anchor or does not compile is broken regardless of any test.
	process.exit(rot.length > 0 && process.env.MUTANTS_ADVISORY !== '1' ? 1 : 0);
}

function printTimings(): void {
	const rows = Object.entries(legs).sort((a, b) => b[1].ms - a[1].ms);
	if (rows.length === 0) return;
	const total = rows.reduce((n, [, v]) => n + v.ms, 0);
	const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
	// NOT A VERDICT, and said so in the heading for the same reason PREFLIGHT and HARVEST refuse the summary
	// banner: a table printed beside a measurement gets read as one.
	console.log('\n=== WHERE THE TIME WENT (instrumentation, NOT a verdict) ===');
	for (const [leg, v] of rows)
		console.log(
			`${leg.padEnd(30)} ${secs(v.ms).padStart(9)}  ${String(v.n).padStart(4)} call(s)  ` +
				`avg ${secs(v.ms / v.n).padStart(7)}  ${((v.ms / total) * 100).toFixed(1)}%`
		);
	console.log(`${'TOTAL (subprocess time only)'.padEnd(30)} ${secs(total).padStart(9)}`);
}

// ⚠ REGISTERED ON `exit`, NOT CALLED AT THE END OF THE FILE — AND THE FIRST VERSION WAS THE HOLLOW (REG-F-163).
//
// I appended `printTimings()` as the last statement of this module. Every path out of this runner ends in
// `process.exit(...)` — there are SIX — so the call was UNREACHABLE and the very first instrumented run printed
// no table at all. Types passed, lint passed, the gate passed: nothing anywhere can tell that a `console.log`
// never happened. **An instrument added to measure this gate, which did not run, in the commit whose register
// entry is about instruments that measure nothing.**
//
// `process.on('exit')` fires on every path including `process.exit`, so the ABORTED_DIRTY and preflight exits
// report their legs too — which is what a reader wants from a run that stopped early. The handler must stay
// SYNCHRONOUS (console.log only); an async one would silently not run, which is this same defect again.
process.on('exit', printTimings);

console.log('\n=== MUTATION LEDGER SUMMARY ===');
// ⚠ STATED WITH THE NUMBERS, EVERY RUN. A whole-suite verdict — CONTROL_HELD above all — means "held over
// everything EXCEPT these projects", and a reader who does not know that will over-read it. REG-F-136.
console.log(`(whole-suite runs EXCLUDE the project(s): ${EXCLUDED_PROJECTS.join(', ')})`);
for (const v of [
	'KILLED',
	'TYPE_PREVENTED',
	'RETIRED',
	'SURVIVED',
	'UNANCHORED',
	'NO_COMPILE',
	'KILLED_UNNAMED',
	'ABORTED_DIRTY',
	'CONTROL_HELD',
	'INCONCLUSIVE',
	'DUPLICATE'
] as const)
	console.log(`${v.padEnd(11)} ${by(v).length}`);

// THE HONEST DENOMINATOR. `DECLARED_MUTANTS.length` counts ENTRIES; what a reader wants is how many DISTINCT
// mutations were measured. Printing the entry count alone is how "90 mutants, 0 SURVIVED" was reported for 87.
console.log(
	`\n${selected.length} entries -> ${selected.length - by('DUPLICATE').length - by('RETIRED').length} distinct mutations measured ` +
		`(${by('DUPLICATE').length} duplicate, ${by('RETIRED').length} retired).`
);

// INCONCLUSIVE prints WITH the failures, and the ordering is deliberate: it is listed LAST so that a run which is
// partly unmeasured cannot be skimmed as if the measured part were the whole story.
for (const r of [...by('SURVIVED'), ...by('UNANCHORED'), ...by('NO_COMPILE'), ...by('INCONCLUSIVE')])
	console.log(
		`\n${r.verdict}: ${r.mutant.id}\n  guard: ${r.mutant.why}\n  from:  ${r.mutant.source}\n  ${r.detail}`
	);

// BLOCKING BY DEFAULT since JAN-VERIF V-2c, and the polarity is the point.
//
// V-0..V-2b ran ADVISORY on purpose: the job was to SIZE the rot honestly, and a ledger inherited from eighteen work
// packages was expected to contain entries the code had moved past. That is done — all 23 are cleared, the ledger is
// at 0 SURVIVED / 0 UNANCHORED / 0 NO_COMPILE — so the question is now what happens to the NEXT one.
//
// It used to take `MUTANTS_BLOCKING=1` to fail the build, which means the gate was armed only by remembering to arm
// it. An opt-in gate is not a gate; it is a suggestion with an exit code. So the default is inverted: any SURVIVED,
// UNANCHORED, NO_COMPILE or ABORTED_DIRTY fails, and `MUTANTS_ADVISORY=1` is the deliberate, visible way to look at
// a table without being blocked by it — a triage tool, never something a gate can be configured into.
const blocking = process.env.MUTANTS_ADVISORY !== '1';

// KILLED_UNNAMED IS NOW A FAILURE (JAN-VERIF V-3c), and the polarity change is the whole point of V-3.
//
// It was reported-but-tolerated for every run from V-1 to V-3, because 46 mutants inherited from JAN-EXECREM
// WP-2..WP-15 arrived with an empty `expectRed` and a blocking gate would have meant a build nobody could make
// green. That is now settled: `MUTANTS_HARVEST=1` measured the candidates, each victim was CHOSEN against what
// the candidate suites assert, and the choice was proved by this very runner — a wrongly-named victim no longer
// reddens, so it reports SURVIVED. The count is 0.
//
// So the question is what happens to the FORTY-SEVENTH, and the answer must not be "someone notices the summary
// line". A records defect that is merely PRINTED is a records defect that accumulates: this one accumulated for
// eighteen work packages while being truthfully reported every single run.
//
// WHAT THIS COSTS, disclosed rather than discovered: a genuinely diffuse mutant — one whose kill really is spread
// across many suites — now costs its author an argument instead of a blank field. Intended. The `expectSurvive`
// and `expectNoCompile` arms are untouched, because an empty `expectRed` is CORRECT for both: a control must
// redden nothing, and a type-prevented mutant never reaches a test run.
const unnamedVictims = by('KILLED_UNNAMED').length;
if (unnamedVictims > 0)
	console.log(
		`
${unnamedVictims} mutant(s) had NO NAMED VICTIM and were run package-wide. That is a records defect in ` +
			`the work packages that declared them: "something caught it" is a weaker claim than "this named test ` +
			`caught it", and only the latter survives a refactor of the suite.\n` +
			'Run `bun run mutants:harvest` to measure the candidate suites, then CHOOSE against what they assert — ' +
			'never paste the whole list, which records the suites that FAILED rather than the ones that TEST the guard.'
	);

// ⚠ `INCONCLUSIVE` BLOCKS, and the reason is the one this whole file is built on: a gate that passes on a mutant it
// did not measure is a gate reporting a guarantee nobody obtained. It joins `UNANCHORED`, `NO_COMPILE` and
// `ABORTED_DIRTY` — the verdicts that say the INSTRUMENT did not work — rather than `SURVIVED`, which says the CODE
// did not. Same exit code, different sentence, and the sentence is the point (REG-F-116).
const failures =
	by('ABORTED_DIRTY').length +
	by('SURVIVED').length +
	by('UNANCHORED').length +
	by('NO_COMPILE').length +
	by('INCONCLUSIVE').length +
	unnamedVictims;
if (failures > 0)
	console.log(
		`\n${failures} mutant(s) need attention. ${blocking ? 'BLOCKING.' : 'ADVISORY — MUTANTS_ADVISORY=1 was set, so this run cannot fail the gate.'}`
	);
process.exit(blocking && failures > 0 ? 1 : 0);
