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
import { readdirSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { DECLARED_MUTANTS, isHistory } from '../scripts/mutants/ledger.js';
import { timeoutEvidence } from '../scripts/mutants/measured.js';
import { compileProjectOf, ROOT_CONFIGS_PROJECT, tscArgv } from '../scripts/mutants/verdict.js';

/**
 * The ACTUAL failure text from V-4a, not a plausible reconstruction of one.
 *
 * A fixture written from memory tests the memory. This is the shape vitest emitted when
 * `enforcement-register.test.ts` re-read the ~1.19 MB canon corpus once per registered rule and tipped over the
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
 * ⚠ SO FOR **THIS** FIXTURE THE PREFIX IS WHAT SEPARATES THEM, AND SAYING THAT WITHOUT A QUANTIFIER WAS THE ERROR
 * (REG-F-120). This line read "Line-anchoring alone does not separate them; the runner's own prefix does" — true
 * of the two VITEST markers and false of the Playwright one, which has no prefix at all and is held by its anchor
 * alone. A conclusion measured on one member of a class, written as a rule about the class. The control below
 * exists because of it.
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

	// ⚠ THE PLAYWRIGHT HALF, WHICH NOTHING HELD UNTIL AN AUDIT OF THIS FILE MEASURED IT (REG-F-120).
	//
	// The vitest markers carry TWO defences — the `Error: ` prefix and the line anchor — and the prefix does the
	// separating on its own: dropping `^[ \t]*` from them leaves all seven cases GREEN, measured. **The Playwright
	// marker has NO prefix.** Its anchor is its entire defence, and dropping that was ALSO green, because every
	// fixture below that could poison it was a VITEST one. So the anchor on line 61 of `measured.ts` was
	// unguarded: a reader could delete it as redundant — the vitest evidence says it is — and re-open the
	// self-poisoning hole on the e2e path alone.
	//
	// The fixture is the shape a failing assertion about Playwright text actually takes: the value printed on its
	// own line, in quotes. The QUOTE is what the anchor rejects and an unanchored marker accepts.
	it('CONTROL — a quoted PLAYWRIGHT fixture is not a timeout either, and only the ANCHOR says so', () => {
		const quotedPlaywright = [
			' FAIL  verif/mutant-verdict.test.ts > reports a PLAYWRIGHT timeout',
			"AssertionError: expected null to be 'Test timeout of 30000ms exceeded' // Object.is equality",
			'',
			'- Expected:',
			'"Test timeout of 30000ms exceeded"',
			'',
			'+ Received:',
			'null',
			'      Tests  1 failed | 6 passed (7)'
		].join('\n');
		expect(
			timeoutEvidence(quotedPlaywright),
			'the Playwright marker has no `Error: ` prefix, so its line anchor is the ONLY thing separating a ' +
				'runner diagnostic from a quoted fixture — this is the case that holds it'
		).toBeNull();
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

// ── A PATH ERROR IS NOT A COMPILE VERDICT — JAN-SELREV SR-1 ─────────────────────────────────────────────────────
//
// SR-1 declared the first two ledger mutants on ROOT-LEVEL files (`SR1-M27` on `vitest.config.ts`, `SR1-M28` on
// `vitest.dist.config.ts`), and `bun run mutants` reported both NO_COMPILE with
// `error TS5058: The specified path does not exist: 'vitest.config.ts/tsconfig.json'`. Nothing had failed to
// compile: `pkgOf` takes a path's first segment as its project, which for a file with no directory is the file,
// and the runner then asked `tsc` for a tsconfig inside it. The same blocking verdict `pkgOf`'s own comment records
// for `verif/x.test.ts`, one case further out — and `verif/dependency-boundary-rules.test.ts` had already named it
// for `.dependency-cruiser.cjs` and driven its mutants by hand to avoid it.
//
// A root-level file now compiles under `tsconfig.root-configs.json`. Two things are held here: the mapping, and —
// the `.svelte` lesson in `compileVerdict` — that the mutated file is one of that program's ROOT files. A tsconfig
// that exists but leaves the file out compiles green whatever the mutation did (NO_COMPILE unreachable rather than
// wrong, which no run would ever show), or checks it only while some other root file still imports it.
//
// ⚠ AND THE SAME HOLE WAS OPEN INSIDE `apps/rph-demo`, WHERE NOTHING WAS REPORTED AT ALL. Held to EVERY measurable
// entry rather than the root-level two, this census found seven compiled with `-p apps/rph-demo/tsconfig.json`, a
// program that does not hold their file: J13-M15..M19 (`e2e/**` and `playwright.config.ts`), and SR-1's own SR1-M29
// (`vitest.config.ts`) and SR1-M30 (`playwright.config.ts`). No TS5058 there — the tsconfig exists, it just builds
// other files — so each compile leg passed whatever the mutation did, and NO_COMPILE could never fire. The
// programs that do hold them already existed and `check-types` already ran them: `apps/rph-demo/e2e/tsconfig.json`
// and `apps/rph-demo/tsconfig.vitest-config.json`.
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Parsed once per distinct program: the ledger census alone names 16 programs for 1040 entries. */
const parsedPrograms = new Map<string, { files: ReadonlySet<string> } | { error: string }>();

/** The ROOT FILES `tsc -p <project>` builds, repo-relative — parsed by TypeScript itself, `extends` and all. */
function rootFilesOf(project: string): { files: ReadonlySet<string> } | { error: string } {
	const cached = parsedPrograms.get(project);
	if (cached !== undefined) return cached;
	const program = parseRootFiles(project);
	parsedPrograms.set(project, program);
	return program;
}

/** ⚠ `apps/rph-demo/tsconfig.json` extends the GENERATED `.svelte-kit/tsconfig.json` (the app's `prepare` script,
 *  `svelte-kit sync`, writes it on install). Without it the parse reports TS5083 ("Cannot read file") AND still
 *  returns a file list — the default `include`, a different program — so any parse error is an error here, never
 *  a file list to measure against. */
function parseRootFiles(project: string): { files: ReadonlySet<string> } | { error: string } {
	let unrecoverable: string | undefined;
	const parsed = ts.getParsedCommandLineOfConfigFile(`${REPO_ROOT}${project}`, undefined, {
		...ts.sys,
		onUnRecoverableConfigFileDiagnostic: (d) => {
			unrecoverable = ts.flattenDiagnosticMessageText(d.messageText, '\n');
		}
	});
	if (parsed === undefined || unrecoverable !== undefined)
		return { error: unrecoverable ?? `${project} could not be parsed` };
	if (parsed.errors.length > 0)
		return {
			error: parsed.errors
				.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
				.join('; ')
		};
	return {
		files: new Set(parsed.fileNames.map((f) => relative(REPO_ROOT, f).replaceAll('\\', '/')))
	};
}

describe('SR-1 — the runner maps a mutated file to the program that holds it', () => {
	// The LITERAL as well as the constant: asserted against `ROOT_CONFIGS_PROJECT` alone, this stayed green when the
	// constant named another real program (`verif/tsconfig.json`, which holds the root configs only as imports).
	it('maps a ROOT-LEVEL file to the root-configs project, not to `<file>/tsconfig.json`', () => {
		expect(ROOT_CONFIGS_PROJECT).toBe('tsconfig.root-configs.json');
		expect(compileProjectOf('vitest.config.ts')).toEqual({
			key: 'tsconfig.root-configs.json',
			tsconfig: 'tsconfig.root-configs.json'
		});
		expect(compileProjectOf('vitest.dist.config.ts').tsconfig).toBe('tsconfig.root-configs.json');
	});

	// Key and tsconfig both, as the CONTROL below explains: each program gets its own timing leg and cache file.
	it('maps an app file its `tsconfig.json` leaves out to the app program that holds it', () => {
		const e2e = {
			key: 'apps/rph-demo/e2e/tsconfig.json',
			tsconfig: 'apps/rph-demo/e2e/tsconfig.json'
		};
		expect(compileProjectOf('apps/rph-demo/e2e/support/harness.ts')).toEqual(e2e);
		expect(compileProjectOf('apps/rph-demo/e2e/agent-retention.e2e.ts')).toEqual(e2e);
		expect(compileProjectOf('apps/rph-demo/playwright.config.ts')).toEqual(e2e);
		expect(compileProjectOf('apps/rph-demo/e2e-live/sdlc-pwa.live.ts')).toEqual(e2e);
		expect(compileProjectOf('apps/rph-demo/playwright.live-exec.config.ts')).toEqual(e2e);
		expect(compileProjectOf('apps/rph-demo/vitest.config.ts')).toEqual({
			key: 'apps/rph-demo/tsconfig.vitest-config.json',
			tsconfig: 'apps/rph-demo/tsconfig.vitest-config.json'
		});
	});

	// CONTROL — the fix must not move any path that HAS a directory. Key and tsconfig both, because the key names the
	// timing leg and the incremental cache file, and a changed key is a cold cache on every package.
	it('CONTROL — every path with a directory keeps the project it always had', () => {
		expect(compileProjectOf('packages/rph-domain/src/execution.ts')).toEqual({
			key: 'packages/rph-domain',
			tsconfig: 'packages/rph-domain/tsconfig.json'
		});
		expect(compileProjectOf('apps/rph-demo/src/lib/server/tools/devin-reviewer.ts')).toEqual({
			key: 'apps/rph-demo',
			tsconfig: 'apps/rph-demo/tsconfig.json'
		});
		// The near miss: a config at the app's root that its own program DOES hold (`.svelte-kit/tsconfig.json`
		// includes `../vite.config.ts`), so a rule widened to "every app-root config" moves it and reddens here.
		expect(compileProjectOf('apps/rph-demo/vite.config.ts')).toEqual({
			key: 'apps/rph-demo',
			tsconfig: 'apps/rph-demo/tsconfig.json'
		});
		expect(compileProjectOf('verif/live-backend-isolation.ts')).toEqual({
			key: 'verif',
			tsconfig: 'verif/tsconfig.json'
		});
		expect(compileProjectOf('scripts/mutants/run.ts')).toEqual({
			key: 'scripts',
			tsconfig: 'scripts/tsconfig.json'
		});
	});

	// The project's own comment claims `files` is EVERY `.ts` at the root. `tsc` already refuses a listed file that is
	// missing (TS6053); this holds the other direction — a new root `.ts` that no project owns.
	it('the root-configs project lists every `.ts` file at the repository root', () => {
		const program = rootFilesOf(ROOT_CONFIGS_PROJECT);
		if ('error' in program) throw new Error(program.error);
		const onDisk = readdirSync(REPO_ROOT, { withFileTypes: true })
			.filter((e) => e.isFile() && /\.[cm]?ts$/.test(e.name))
			.map((e) => e.name)
			.sort((a, b) => a.localeCompare(b));
		expect([...program.files].sort((a, b) => a.localeCompare(b))).toEqual(onDisk);
	});
});

/** Build output, caches and reports: never a program anyone type-checks. Dot-directories (`.svelte-kit`, `.turbo`)
 *  are skipped by name below — `.svelte-kit/tsconfig.json` is a BASE the app extends, not a program of its own. */
const NOT_PROGRAM_DIRS = new Set([
	'build',
	'coverage',
	'dist',
	'e2e-results',
	'node_modules',
	'playwright-report',
	'test-results'
]);

/** Every `tsconfig*.json` at the root and under the four workspace roots — the programs that EXIST, found on disk
 *  rather than listed, so a new one cannot be missed by forgetting to name it here. */
function programsOnDisk(): string[] {
	const isTsconfig = (name: string): boolean => /^tsconfig.*\.json$/.test(name);
	const found = readdirSync(REPO_ROOT).filter(isTsconfig);
	const walk = (dir: string): void => {
		for (const e of readdirSync(`${REPO_ROOT}${dir}`, { withFileTypes: true })) {
			if (!e.isDirectory()) {
				if (isTsconfig(e.name)) found.push(`${dir}/${e.name}`);
			} else if (!e.name.startsWith('.') && !NOT_PROGRAM_DIRS.has(e.name)) walk(`${dir}/${e.name}`);
		}
	};
	for (const root of ['apps', 'packages', 'scripts', 'verif']) walk(root);
	return found.sort((a, b) => a.localeCompare(b));
}

/** Everything the runner type-checks with `tsc`: not history (never compiled; its file may be gone), not `.svelte`
 *  (`compileVerdict` sends those to `svelte-check`, which reads the app's `.svelte` files — REG-F-175). */
function measuredByTsc(): typeof DECLARED_MUTANTS {
	return DECLARED_MUTANTS.filter((m) => !isHistory(m) && !m.file.endsWith('.svelte'));
}

describe('SR-1 — every mutant compiles under a program that contains its file', () => {
	// ⚠ SELECTED BY WHAT THE RUNNER COMPILES, NOT BY THE MAPPING UNDER TEST, so a mapping that sends an entry to the
	// wrong program reddens here rather than shrinking the census. ROOT files, not every file the program loads: a
	// file reached only by import is checked only while that import survives (REG-F-097's shape).
	it('every measurable ledger mutant compiled by `tsc` is a ROOT FILE of the program the runner compiles for it', () => {
		const measured = measuredByTsc();
		expect(measured.length, 'a census over no entries proves nothing').toBeGreaterThan(0);
		const outside = measured.flatMap((m) => {
			const { tsconfig } = compileProjectOf(m.file);
			const program = rootFilesOf(tsconfig);
			if ('error' in program) return [`${m.id}: ${tsconfig} — ${program.error}`];
			return program.files.has(m.file) ? [] : [`${m.id}: ${m.file} is not in ${tsconfig}'s files`];
		});
		expect(outside).toEqual([]);
	});

	// THE ARGV THE RUNNER SPAWNS, PINNED LITERALLY. `run.ts` is imported by nothing, so while it built this array
	// inline, putting back the pre-SR-1 `-p <pkg>/tsconfig.json` SURVIVED every suite that reaches the harness (the
	// SR-1 verifier's V8). The mapping above can be right and the leg still compile the wrong program.
	it('the compile leg runs `tsc -p` on the program `compileProjectOf` names, with the cache file it is given', () => {
		const argv = (file: string): string[] => tscArgv(compileProjectOf(file), 'CACHE.tsbuildinfo');
		expect(argv('vitest.config.ts')).toEqual([
			'tsc',
			'--noEmit',
			'--incremental',
			'--tsBuildInfoFile',
			'CACHE.tsbuildinfo',
			'-p',
			'tsconfig.root-configs.json'
		]);
		expect(argv('apps/rph-demo/e2e/support/harness.ts').slice(-2)).toEqual([
			'-p',
			'apps/rph-demo/e2e/tsconfig.json'
		]);
		expect(argv('apps/rph-demo/vitest.config.ts').slice(-2)).toEqual([
			'-p',
			'apps/rph-demo/tsconfig.vitest-config.json'
		]);
		expect(argv('packages/rph-domain/src/execution.ts').slice(-2)).toEqual([
			'-p',
			'packages/rph-domain/tsconfig.json'
		]);
	});

	// THE MAPPING HELD TO THE PROGRAMS' OWN FILE LISTS, for files no ledger entry targets yet. `compileProjectOf` names
	// its secondary programs by path (see why in `verdict.ts`); this is what keeps that table from drifting away from
	// the tsconfigs it mirrors — a file some program type-checks, routed to one that does not hold it, is the next
	// J13-M15 waiting for its mutant.
	it('every file ANY program type-checks is routed to a program that holds it', () => {
		const programs = programsOnDisk();
		const named = [...new Set(measuredByTsc().map((m) => compileProjectOf(m.file).tsconfig))];
		expect(
			named.filter((p) => !programs.includes(p)),
			'the walk must find every program the runner compiles, or this census is over the wrong set'
		).toEqual([]);
		const misrouted = programs.flatMap((p) => {
			const own = rootFilesOf(p);
			if ('error' in own) return [`${p} — ${own.error}`];
			return [...own.files].flatMap((f) => {
				const { tsconfig } = compileProjectOf(f);
				const target = rootFilesOf(tsconfig);
				if ('error' in target) return [`${f} (a root file of ${p}): ${tsconfig} — ${target.error}`];
				return target.files.has(f)
					? []
					: [`${f} (a root file of ${p}) is not in ${tsconfig}'s files`];
			});
		});
		expect(misrouted).toEqual([]);
	});
});
