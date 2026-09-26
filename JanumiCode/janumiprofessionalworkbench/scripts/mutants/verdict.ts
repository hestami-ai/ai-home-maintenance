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
 * So `status: 1` alone cannot be trusted either — and NOTHING here can catch that case, because it is a
 * well-formed completion by every field available. `maxBuffer` at the call site does NOT help: it was tried and
 * measured INERT under `shell: true`, which is the actual cause (see the seam in `run.ts`). This predicate
 * catches the residue that arrives as a genuine non-completion, and the truncation is recorded as UNGUARDED.
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

/**
 * GRADE A NAMED-VICTIM MUTANT ON THE DIFFERENCE, NOT ON THE EXIT CODE — REG-F-168/171.
 *
 * ⚠ THE ARGUMENT FOR THIS WAS ALREADY WRITTEN IN `run.ts`, TWO LINES ABOVE THE CODE THAT IGNORED IT: *"The exit
 * status cannot answer 'did this mutation redden anything'; the DIFFERENCE against the unmutated baseline can,
 * and it is the only question actually being asked."* REG-F-116 built that remedy and applied it to the NINE
 * controls. The 193 entries carrying the gate's actual claim kept reading `run.status === 0` alone.
 *
 * The consequence was measured, not feared: those 193 ride on only **70 distinct victim files**, thirteen of them
 * on `execrem-wp12-skip-authorization.test.ts` and 46 on the top five. **One unrelated red in one file converted
 * thirteen mutants to KILLED**, each recorded as a guard proven by evidence that had nothing to do with it.
 *
 * `victimWasGreen` is the whole point: a red that follows a green is ATTRIBUTABLE, and a red that follows a red
 * is not. When the victim was already failing there is no verdict to give — the mutation was never measured —
 * and INCONCLUSIVE says so and BLOCKS, rather than a KILLED that would read as proof.
 */
export function gradeNamedVictim(
	victimWasGreen: boolean,
	passedAfterMutation: boolean,
	victim: string,
	detailFromOutput: string
): { verdict: 'KILLED' | 'SURVIVED' | 'INCONCLUSIVE'; detail: string } {
	if (!victimWasGreen)
		return {
			verdict: 'INCONCLUSIVE',
			detail:
				`the named victim ${victim} was ALREADY RED before this mutation was applied, so its failure ` +
				'afterwards attributes nothing — fix the suite, then re-run; a kill measured against a red ' +
				'baseline is not evidence about this guard'
		};
	if (passedAfterMutation) return { verdict: 'SURVIVED', detail: detailFromOutput };
	return { verdict: 'KILLED', detail: detailFromOutput };
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

/**
 * `packages/rph-domain/src/x.ts` -> `packages/rph-domain`; `verif/x.test.ts` -> `verif`.
 *
 * ⚠ THE SECOND CASE WAS MISSING AND IT REPORTED NO_COMPILE, WHICH READS LIKE A VERDICT. Blind two-segment slicing
 * turns `verif/x.test.ts` into `verif/x.test.ts`, so the preflight typecheck ran `tsc -p verif/x.test.ts/tsconfig.json`
 * and failed with TS5058 — a path error dressed as a compile verdict, on a mutant that in fact kills cleanly.
 * `packages` and `apps` are the workspace roots and nest one level; every other top-level directory is its own
 * project. Named explicitly rather than inferred from the presence of a tsconfig, because a MISSING tsconfig must
 * stay loud: it means the mutated file is under no type gate at all, which is REG-F-097's whole subject.
 *
 * MOVED HERE FROM `run.ts` (JAN-SELREV SR-1) so a suite can reach it — see this file's header. A ROOT-LEVEL file has
 * no directory to be a project, and is not this function's case: `compileProjectOf` below settles it first.
 */
const NESTED_ROOTS = new Set(['packages', 'apps']);
export const pkgOf = (file: string): string => {
	const parts = file.split('/');
	return NESTED_ROOTS.has(parts[0] ?? '') ? parts.slice(0, 2).join('/') : (parts[0] ?? '');
};

/** The tracked project that type-checks every `.ts` file at the repository root (`check-types` runs it). */
export const ROOT_CONFIGS_PROJECT = 'tsconfig.root-configs.json';

/** What the compile leg builds: `tsconfig` is what `tsc -p` is given; `key` names the timing leg and the cache. */
export interface CompileProject {
	readonly key: string;
	readonly tsconfig: string;
}

/**
 * THE PROGRAMS INSIDE A PACKAGE THAT HOLD FILES ITS `tsconfig.json` LEAVES OUT — each mirrors its tsconfig's own
 * `include`/`files`, directory by directory and file by file.
 *
 * ⚠ NAMED BY PATH, NOT DERIVED BY PARSING THE TSCONFIGS AT RUN TIME, for three reasons. This file is pure (see its
 * header), and a parse is filesystem work. The app's main program is knowable only through `.svelte-kit/tsconfig.json`,
 * which `svelte-kit sync` GENERATES, so a derived rule would let generated state choose which program judges a
 * mutation. And the derivation still happens — in the test, where drift can be seen: `verif/mutant-verdict.test.ts`
 * parses EVERY `tsconfig*.json` with TypeScript itself and holds each root file of each one, and each ledger mutant's
 * file, to being a root file of the program this names. A table that falls behind its tsconfig reddens there.
 */
const SECONDARY_PROGRAMS: readonly {
	readonly tsconfig: string;
	readonly dirs: readonly string[];
	readonly files: readonly string[];
}[] = [
	{
		// `e2e/tsconfig.json`: `**/*.ts` under `e2e/`, the two live-suite directories, and the three Playwright configs.
		tsconfig: 'apps/rph-demo/e2e/tsconfig.json',
		dirs: ['apps/rph-demo/e2e/', 'apps/rph-demo/e2e-live/', 'apps/rph-demo/e2e-live-exec/'],
		files: [
			'apps/rph-demo/playwright.config.ts',
			'apps/rph-demo/playwright.live.config.ts',
			'apps/rph-demo/playwright.live-exec.config.ts'
		]
	},
	{
		tsconfig: 'apps/rph-demo/tsconfig.vitest-config.json',
		dirs: [],
		files: ['apps/rph-demo/vitest.config.ts']
	}
];

/**
 * WHICH PROGRAM `tsc` BUILDS TO JUDGE A MUTATION OF `file` — the cases `pkgOf` never had (JAN-SELREV SR-1).
 *
 * ⚠ THE `verif/` DEFECT ONE LEVEL FURTHER OUT, AND IT BLOCKED THE SAME WAY. `SR1-M27` (`vitest.config.ts`) and
 * `SR1-M28` (`vitest.dist.config.ts`) are the ledger's first ROOT-LEVEL targets, and `pkgOf` returns such a file as
 * its own project, so the runner ran `tsc -p vitest.config.ts/tsconfig.json` and reported both
 * `NO_COMPILE — error TS5058: The specified path does not exist`. A root-level file has no directory; it compiles
 * under `ROOT_CONFIGS_PROJECT`.
 *
 * ⚠ AND THE SAME DEFECT INSIDE THE APP, WHERE IT WAS SILENT. `apps/rph-demo/tsconfig.json` exists, so no TS5058 —
 * but its program holds none of `e2e/**`, `playwright.config.ts` or `vitest.config.ts`, and seven ledger entries
 * (J13-M15..M19, SR1-M29, SR1-M30) were compiled under it: a leg that passed whatever the mutation did, so
 * NO_COMPILE could never fire (`compileVerdict`'s `.svelte` lesson, for `.ts`). They compile under the
 * `SECONDARY_PROGRAMS` that hold them, which `check-types` already runs.
 *
 * Every other path maps exactly as before — same `-p`, same timing leg, same `.tsbuildinfo`. A new program's key is
 * its tsconfig path, so its timing leg and cache file are its own.
 */
export function compileProjectOf(file: string): CompileProject {
	if (!file.includes('/')) return { key: ROOT_CONFIGS_PROJECT, tsconfig: ROOT_CONFIGS_PROJECT };
	const owner = SECONDARY_PROGRAMS.find(
		(p) => p.files.includes(file) || p.dirs.some((dir) => file.startsWith(dir))
	);
	if (owner !== undefined) return { key: owner.tsconfig, tsconfig: owner.tsconfig };
	const pkg = pkgOf(file);
	return { key: pkg, tsconfig: `${pkg}/tsconfig.json` };
}

/**
 * THE `tsc` ARGUMENTS FOR ONE COMPILE LEG (after `bunx`) — built here, not in `run.ts`, so a suite can pin them.
 *
 * ⚠ THE LEG'S TRUST RESTS ON `-p` NAMING THE PROGRAM `compileProjectOf` CHOSE, and when this was an inline array in
 * `run.ts` nothing observed it: a mutant putting back the pre-SR-1 `-p <pkg>/tsconfig.json` SURVIVED every suite
 * that reaches the harness, because `run.ts` is imported by nothing. `buildInfo` is the cache file's path, which
 * `run.ts` owns because creating its directory is filesystem work.
 */
export function tscArgv(project: CompileProject, buildInfo: string): string[] {
	return [
		'tsc',
		'--noEmit',
		'--incremental',
		'--tsBuildInfoFile',
		buildInfo,
		'-p',
		project.tsconfig
	];
}
