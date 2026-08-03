// The ONE list of vitest projects, shared by both resolution modes — JAN-BINDEXCL / N-16.
//
// WHY THIS FILE EXISTS. `vitest.config.ts` (source mode) and `vitest.dist.config.ts` (artifact mode) must cover
// EXACTLY the same set of test files, or the two-mode cross-check DS §3-R1 buys is silently partial: a package
// present in one list and absent from the other is measured in one mode and unmeasured in the other, and nothing
// says so. Two hand-maintained arrays would drift on the first new package. One array cannot.
//
// `packagesWithTests()` derives the list FROM THE FILESYSTEM rather than from a literal, for the same reason the
// alias patterns in `vitest.config.ts` are regexes rather than an enumeration: a list that must be edited when a
// package is added is a list that will silently rot, and this whole programme is about that failure mode. The
// literal it replaced was also already WRONG — it carried a comment claiming `rph-ports` had "none of consequence"
// while `rph-ports` has a test file.
import { readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** REG-F-015's standing guard — see `verif/unread-refusal-guard.ts`. Absolute, because each project sets its own
 *  `root` and a repo-relative path would resolve inside the package. */
const SETUP_UNREAD_REFUSAL = join(ROOT, 'verif', 'unread-refusal-guard.ts');

/** Every `*.test.ts` under `dir`, recursively. Returns count only — the projects declare their own globs. */
function countTests(dir: string): number {
	if (!existsSync(dir)) return 0;
	let n = 0;
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) n += countTests(full);
		else if (entry.endsWith('.test.ts')) n += 1;
	}
	return n;
}

/**
 * The packages that own at least one test file, discovered rather than declared.
 *
 * A package with NO tests is excluded rather than included-and-tolerated, which is what makes
 * `passWithNoTests: false` safe to set below — see the note there. Excluding it is also the honest record: the
 * project list then says "these are measured", not "these might be".
 */
export function packagesWithTests(): string[] {
	const pkgDir = join(ROOT, 'packages');
	return readdirSync(pkgDir)
		.filter((name) => countTests(join(pkgDir, name, 'src')) > 0)
		.sort();
}

/**
 * The apps that own at least one test file — discovered, for the same reason packages are.
 *
 * An app is a first-class subject here: `apps/rph-demo` is the SURFACE coverage layer the enforcement register
 * gained in DR-001 S-3, and a layer the instruments cannot see is a layer nothing is claimed about.
 */
export function appsWithTests(): string[] {
	const appDir = join(ROOT, 'apps');
	if (!existsSync(appDir)) return [];
	return readdirSync(appDir)
		.filter((name) => countTests(join(appDir, name, 'src')) > 0)
		.sort();
}

/**
 * The project list for one resolution mode.
 *
 * `passWithNoTests: false` IS THE FIX FOR N-16, and it is the part that generalises. The defect was not that a
 * config was wrong; it was that a runner which observed NOTHING exited 0 and read as success for ten packages
 * across four work packages. Every package here is known to own tests, so "found none" can only mean the runner
 * is looking in the wrong place — and it must fail rather than pass.
 */
export function projectsFor(extendsConfig: true): Array<Record<string, unknown>> {
	return [
		// The infrastructure proof (verif/source-resolution.test.ts). Its own project because it belongs to no
		// package: it asserts which resolution mode is actually in effect, and must live outside every package's
		// rootDir to import across the boundary at all. It runs in BOTH modes — that is the whole point of it, and
		// until N-16 was fixed its artifact-mode branch had never executed once.
		{
			extends: extendsConfig,
			test: { name: 'verif', root: '.', include: ['verif/**/*.test.ts'], passWithNoTests: false }
		},
		...packagesWithTests().map((name) => ({
			extends: extendsConfig,
			test: {
				name,
				root: `./packages/${name}`,
				include: ['src/**/*.test.ts'],
				passWithNoTests: false,
				// REG-F-015's standing half. Fails any test that dispatches a command, has it REFUSED, and never
				// reads the result — the shape that let `floor-waiver-scope.test.ts` pass for months while
				// arranging nothing. Declared HERE rather than per-package so a new package cannot opt out by
				// omission, for the same reason the project list itself is derived rather than enumerated.
				setupFiles: [SETUP_UNREAD_REFUSAL]
			}
		})),
		// THE APPS, and the blind spot they were in until DR-002 W-2 tried to use the ledger on one.
		//
		// `packagesWithTests()` scans `packages/` only, so twenty test files under `apps/rph-demo` ran ONLY under
		// `turbo run test` (each app's own vitest, its own config) and were absent from BOTH modes here. Three
		// consequences, and the third is the dangerous one:
		//
		//   1. No source resolution — so an app test exercising engine source measured the built dist instead.
		//   2. No presence in the two-mode cross-check that DS §3-R1 exists to buy.
		//   3. THE MUTATION LEDGER COULD NOT NAME THEM. `scripts/mutants/run.ts` invokes `bunx vitest run <victim>`
		//      from the repo root, against THIS project list. A victim under `apps/` matched no project, vitest
		//      exited non-zero for "no test files found", and the runner would have recorded a **KILLED that no
		//      mutation caused** — the same vacuity `S3-CONTROL-e2e-victim-is-actually-run` was added to detect on
		//      the Playwright path, waiting on the vitest one.
		//
		// S-3 taught the runner to reach `apps/` through Playwright. This is the other half: the unit path.
		...appsWithTests().map((name) => ({
			extends: extendsConfig,
			// ONLY `$lib` — SvelteKit's own alias, which nothing outside an app declares. The `@janumipwb/*`
			// resolution is deliberately NOT restated here: it is what DISTINGUISHES the two modes, and pinning it
			// at project level would resolve app tests to source even under `test:dist`, quietly exempting the apps
			// from the artifact half of the cross-check. Vite concatenates alias arrays when a project extends a
			// config, so this adds to the mode's resolution rather than replacing it.
			resolve: {
				alias: [{ find: /^\$lib\/(.*)$/, replacement: `${join(ROOT, 'apps', name, 'src', 'lib')}/$1` }]
			},
			test: {
				name: `app:${name}`,
				root: `./apps/${name}`,
				include: ['src/**/*.test.ts'],
				passWithNoTests: false,
				// The apps dispatch too, and they are the layer this list forgot once already — see above. An
				// unread refusal in an app test is the same defect as in a package test.
				setupFiles: [SETUP_UNREAD_REFUSAL]
			}
		}))
	];
}
