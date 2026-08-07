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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECLARED_MUTANTS, type DeclaredMutant } from './ledger.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Records the mutant currently applied, so a KILLED run can be recovered from. See `recoverAbandonedMutant`. */
const JOURNAL = `${ROOT}scripts/mutants/.in-flight`;
/** Where HARVEST writes its candidate victims. Gitignored: it is an input to a judgment, never a record. */
const HARVEST_OUT = `${ROOT}scripts/mutants/.harvest.json`;
/** Vitest's machine-readable run report, read back by HARVEST. Also gitignored, also never a record. */
const HARVEST_REPORT = `${ROOT}scripts/mutants/.harvest-run.json`;

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
	| 'DUPLICATE'
	// PREFLIGHT ONLY, and deliberately not a measurement. See `PREFLIGHT` below.
	| 'APPLICABLE';

// ── PREFLIGHT (`MUTANTS_PREFLIGHT=1`) ────────────────────────────────────────────────────────────────────────
//
// Checks ONLY that each mutant still ANCHORS and still COMPILES, and runs no tests at all. It exists because the
// two verdicts that mean "the ledger has rotted" — UNANCHORED and NO_COMPILE — are both decided before a single
// test runs, yet finding them cost a full ~40-minute run. Triaging rot against a fast loop is the difference
// between a ledger that gets repaired and one that accumulates.
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
const sh = (cmd: string, args: readonly string[], cwd: string = ROOT) =>
	spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true });

/**
 * Is the working tree free of MODIFICATIONS? The harness must never leave a mutant behind.
 *
 * `--untracked-files=no` deliberately. What this guard exists to catch is a leaked mutation, and a mutation is always
 * an edit to an existing tracked file — the runner reads `m.file` before it writes, so it cannot create one. Counting
 * untracked files as dirt therefore blocks nothing dangerous and blocks something ordinary: adding a test in the same
 * change as the mutant that proves it. That is a bad trade, because a harness which refuses to run until the tree is
 * pristine is a harness that gets run less often, and this one earns its keep by being run.
 */
function treeIsClean(): boolean {
	const r = sh('git', [
		'status',
		'--porcelain',
		'--untracked-files=no',
		'--',
		'packages',
		'apps',
		'verif'
	]);
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
 * A mutant with NO NAMED VICTIM is still worth running, against a weaker claim. Most of the mutants inherited
 * from JAN-EXECREM WP-2..WP-15 are in this state: their work packages declared the mutation but never said WHICH
 * test reddens. That is itself a records defect, and it is reported separately in the summary.
 *
 * Running the whole workspace tells us whether the guard is tested AT ALL; it cannot say which test does it, so
 * the verdict is KILLED_UNNAMED rather than KILLED. Weaker evidence, honestly labelled, beats no evidence — and it
 * beats GUESSING a victim, which is precisely how a mutant comes to "pass" for the wrong reason.
 *
 * An empty result means "every project", which is slower and correct.
 */
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
function compileVerdict(m: DeclaredMutant, target: readonly string[]): Result | null {
	const types = sh('bunx', ['tsc', '--noEmit', '-p', `${pkgOf(m.file)}/tsconfig.json`]);
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

function runMutant(m: DeclaredMutant): Result {
	const pre = preApplyVerdict(m);
	if ('result' in pre) return pre.result;
	const { original } = pre;
	const target = targetSuites(m);
	const unnamed = m.expectRed.length === 0;

	writeFileSync(JOURNAL, m.file, 'utf8');
	writeFileSync(`${ROOT}${m.file}`, original.replace(m.find, m.replace), 'utf8');
	try {
		const settled = compileVerdict(m, target);
		if (settled) return settled;

		// HARVEST asks vitest for the machine-readable report as WELL as the human one, so `summarise` keeps
		// working unchanged and the two views cannot disagree about the same run.
		const run = isE2eTarget(target)
			? runPlaywright(target)
			: sh(
					'bunx',
					HARVEST
						? [
								'vitest',
								'run',
								'--reporter=default',
								'--reporter=json',
								`--outputFile=${HARVEST_REPORT}`,
								...target
							]
						: ['vitest', 'run', ...target]
				);
		const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;
		const victims = HARVEST ? readVictims() : undefined;
		// A mutation declared `expectSurvive` is a CONTROL: it edits something behaviour cannot depend on — a
		// rationale string, a comment — so its survival proves the suite is not failing spuriously. For those,
		// survival is the PASS and a KILL is the finding, because a test that reddens when only prose changed is
		// asserting on prose.
		if (m.expectSurvive !== undefined)
			return run.status === 0
				? { mutant: m, verdict: 'CONTROL_HELD', detail: m.expectSurvive.slice(0, 88) }
				: {
						mutant: m,
						verdict: 'SURVIVED',
						detail: 'declared a CONTROL, but a test FAILED on it — something asserts on prose'
					};
		if (run.status === 0)
			return { mutant: m, verdict: 'SURVIVED', detail: summarise(out), victims };
		return {
			mutant: m,
			verdict: unnamed ? 'KILLED_UNNAMED' : 'KILLED',
			detail: summarise(out),
			victims
		};
	} finally {
		writeFileSync(`${ROOT}${m.file}`, original, 'utf8');
		rmSync(JOURNAL, { force: true });
	}
}

/** `packages/rph-domain/src/x.ts` -> `packages/rph-domain`. */
const pkgOf = (file: string): string => file.split('/').slice(0, 2).join('/');

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
function runPlaywright(target: readonly string[]): ReturnType<typeof sh> {
	const rel = target.map((t) => (t.startsWith(`${E2E_APP}/`) ? t.slice(E2E_APP.length + 1) : t));
	return sh('bunx', ['playwright', 'test', ...rel, '--reporter=line'], `${ROOT}${E2E_APP}`);
}

/**
 * HARVEST: which test FILES failed, from vitest's JSON report, repo-relative and POSIX.
 *
 * Read from the report file rather than scraped from the console output, and the difference is not cosmetic: the
 * human reporter prints a `FAIL` line per failing TEST, truncates, colours, and interleaves stderr from other
 * workers — parsing it would silently drop victims, and a harvest that drops a victim is worse than none because
 * the survivor it hides looks like a clean result.
 *
 * Returns `[]` on a missing or unreadable report, which is honest: the caller records "no candidates observed",
 * not "no candidates exist".
 */
function readVictims(): readonly string[] {
	let raw: string;
	try {
		raw = readFileSync(HARVEST_REPORT, 'utf8');
	} catch {
		return [];
	}
	rmSync(HARVEST_REPORT, { force: true });
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
const summarise = (s: string): string =>
	(s.split('\n').findLast((l) => l.includes('Tests ')) ?? '')
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
// (lines 54, 69, 589), so no argv entry is ever a flag, and a single argument behaves exactly as before.
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

console.log('\n=== MUTATION LEDGER SUMMARY ===');
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
	'DUPLICATE'
] as const)
	console.log(`${v.padEnd(11)} ${by(v).length}`);

// THE HONEST DENOMINATOR. `DECLARED_MUTANTS.length` counts ENTRIES; what a reader wants is how many DISTINCT
// mutations were measured. Printing the entry count alone is how "90 mutants, 0 SURVIVED" was reported for 87.
console.log(
	`\n${selected.length} entries -> ${selected.length - by('DUPLICATE').length - by('RETIRED').length} distinct mutations measured ` +
		`(${by('DUPLICATE').length} duplicate, ${by('RETIRED').length} retired).`
);

for (const r of [...by('SURVIVED'), ...by('UNANCHORED'), ...by('NO_COMPILE')])
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

const failures =
	by('ABORTED_DIRTY').length +
	by('SURVIVED').length +
	by('UNANCHORED').length +
	by('NO_COMPILE').length +
	unnamedVictims;
if (failures > 0)
	console.log(
		`\n${failures} mutant(s) need attention. ${blocking ? 'BLOCKING.' : 'ADVISORY — MUTANTS_ADVISORY=1 was set, so this run cannot fail the gate.'}`
	);
process.exit(blocking && failures > 0 ? 1 : 0);
