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
				passWithNoTests: false
			}
		}))
	];
}
