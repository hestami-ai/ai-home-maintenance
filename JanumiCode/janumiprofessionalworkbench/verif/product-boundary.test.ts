// PRODUCT CODE MUST NOT IMPORT THE ANALYZER — JAN-CSAAEXT S2, salvaged from `scripts/csaa-product-boundary.ts`.
//
// ── WHY THIS EXISTS, AND WHY IT IS NOT A DEPENDENCY-CRUISER RULE ──────────────────────────────────────────────
// `.dependency-cruiser.cjs` declares `product-does-not-import-csaa` with `from: '^(packages/rph-|apps/)'`. ⛔ THE
// `apps/` ARM OF THAT RULE HAS NEVER BEEN ABLE TO FIRE (REG-F-389): `boundary` runs `depcruise packages` — one
// positional scan root — so no `apps/` file ever enters the cruised graph, and a cruiser reports violations only
// on files it scanned. The absence of a violation and the absence of a scan are the same observation.
//
// ⭑ THAT WAS DEMONSTRATED, NOT DERIVED, BEFORE THIS FILE WAS WRITTEN. A probe importing CSAA was placed at
// `apps/rph-demo/src/lib/__boundary-probe.ts` and `depcruise packages` reported
// "no dependency violations found (867 modules, 4705 dependencies cruised)", EXIT 0. The probe was never
// committed. Making the guard fail first is the only way to show that fixing it changed anything, and its
// absence is exactly how this defect survived.
//
// ── THE RECORDED REMEDY WAS TESTED AND IS WRONG, WHICH IS WHY THIS IS A WALK AND NOT A WIDER CRUISE ───────────
// `REG-F-389` and ROADMAP S2 both said the fix was to widen the perimeter to `depcruise packages apps`. ⛔ IT IS
// NOT. Measured with the same probe in place, `depcruise packages apps` yields 69 errors: ONE real
// `product-does-not-import-csaa` and **68 `not-to-unresolvable`** — SvelteKit's `$lib/...` and `./$types`
// aliases, which resolve only through `apps/rph-demo/.svelte-kit/tsconfig.json`, a generated file that
// `.dependency-cruiser.cjs:74-76` EXCLUDES and `:77` does not reference (`tsConfig` names the root
// `tsconfig.json`). Widening alone would trade a silent gap for an unusable gate.
//
// ⭑ SO THE INSTRUMENT IS DELIBERATELY DIFFERENT. This walks the tree and reads module specifiers with
// `ts.preProcessFile`, which SCANS rather than RESOLVES. It therefore sees `.svelte` files and alias-bearing
// imports without needing to resolve them, which is precisely the capability dependency-cruiser lacks here.
// That is not a workaround; it is why the incumbent script was written this way in the first place.
//
// ── WHAT IS SALVAGED, AND WHAT CHANGES ───────────────────────────────────────────────────────────────────────
// `inspectProductBoundary` (packages/csaa/src/subject/product-boundary.ts, 108 lines) is CSAA-owned and leaves
// under JAN-CSAAEXT. Its two imported helpers are four lines each (`compareText`, `isInsideRoot`) and are
// inlined below rather than re-imported, so nothing here depends on the package being extracted.
//
// ⚠ ITS TARGET TEST HAS TWO ARMS AND ONLY ONE SURVIVES THE MOVE, which is stated here because the expiry is
// silent otherwise:
//   · the NPM SPECIFIER arm (`@janumipwb/csaa` and subpaths) — survives S6 and is the load-bearing one after it;
//   · the RELATIVE-PATH arm (a specifier resolving inside `packages/csaa`) — goes permanently dead at S6, when
//     the directory moves to `JanumiCode/csaa/`. It is kept until then because it is what catches a violation
//     TODAY, and removing it early would open the gap this file exists to close.
// The third test below exercises the specifier arm directly, so the arm that outlives the move is proven to
// discriminate NOW rather than being discovered inert after it.
//
// ── WHAT THIS DELIBERATELY DOES NOT CLOSE ─────────────────────────────────────────────────────────────────────
// ⛔ IT IS A SPECIFIER TEST, NOT A REACHABILITY TEST. Product code that reaches CSAA through a third module it
// imports legitimately is invisible here, exactly as it is to the incumbent. Closing that needs the module graph,
// which is dependency-cruiser's job for the `packages/` perimeter and is unaffected by this file.
// ⛔ IT DOES NOT REPLACE `product-does-not-import-csaa`. That rule still owns the `packages/rph-` perimeter under
// `depcruise packages`, and `verif/dependency-boundary-rules.test.ts:125` still pins its name. This file owns the
// `apps/` perimeter that rule cannot reach.

import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = realpathSync(fileURLToPath(new URL('..', import.meta.url)));

/** Directories that are build output, caches or vendored code — never product source. */
const EXCLUDED = new Set([
	'.svelte-kit',
	'.turbo',
	'build',
	'coverage',
	'dist',
	'e2e-results',
	'node_modules',
	'playwright-report',
	'test-results'
]);
const SOURCE = /\.[cm]?[jt]sx?$|\.svelte$/;

/**
 * ANTI-VACUITY FLOOR, and its job is the OPPOSITE of the floor in `verif/assurance-surface.test.ts`. That one
 * sits AT its population because it owns deletion-detection. This one owns WALK COLLAPSE — a renamed root, a
 * broken `readdirSync`, an exclusion that swallowed everything — so it sits well below the 548 files measured
 * 2026-09-11. A floor at the population would redden on every ordinary file deletion and teach its reader to
 * raise it without looking, which is how a floor stops being read at all.
 */
const INSPECTED_FLOOR = 400;

function slash(path: string): string {
	return path.split(sep).join('/');
}

/** Inlined from CSAA's `subject/paths.ts` so this file survives the extraction. */
function isInsideRoot(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

/** Inlined from CSAA's `inventory/canonical.ts`. */
function compareText(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

/**
 * TRUE when a module specifier names CSAA. Exported shape kept identical to the incumbent's `targetsCsaa` so the
 * salvage is a move rather than a rewrite — see the header on which of the two arms survives S6.
 */
export function targetsCsaa(sourcePath: string, specifier: string): boolean {
	if (specifier === '@janumipwb/csaa' || specifier.startsWith('@janumipwb/csaa/')) return true;
	if (!specifier.startsWith('.')) return false;
	const candidate = resolve(dirname(sourcePath), specifier);
	const csaaRoot = resolve(ROOT, 'packages', 'csaa');
	return candidate === csaaRoot || isInsideRoot(csaaRoot, candidate);
}

function moduleSpecifiers(source: string): string[] {
	const preprocessed = ts.preProcessFile(source, true, true);
	return [
		...preprocessed.importedFiles,
		...preprocessed.referencedFiles,
		...preprocessed.typeReferenceDirectives
	]
		.map((reference) => reference.fileName)
		.sort(compareText);
}

interface BoundaryResult {
	readonly inspectedFiles: number;
	readonly violations: readonly { readonly moduleSpecifier: string; readonly path: string }[];
}

function inspectProductBoundary(): BoundaryResult {
	const roots = [
		...readdirSync(resolve(ROOT, 'packages'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && entry.name.startsWith('rph-'))
			.map((entry) => resolve(ROOT, 'packages', entry.name)),
		...readdirSync(resolve(ROOT, 'apps'), { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => resolve(ROOT, 'apps', entry.name))
	];
	const files: string[] = [];
	const visited = new Set<string>();
	const walk = (path: string): void => {
		const info = lstatSync(path);
		if (info.isSymbolicLink()) {
			const target = realpathSync(path);
			// A symlink out of the tree would let product code import CSAA past this walk entirely.
			if (!isInsideRoot(ROOT, target)) {
				throw new Error(`Product-boundary symlink escapes repository root: ${slash(relative(ROOT, path))}`);
			}
			walk(target);
			return;
		}
		if (info.isFile()) {
			if (SOURCE.test(path)) files.push(path);
			return;
		}
		if (!info.isDirectory() || EXCLUDED.has(basename(path))) return;
		const real = realpathSync(path);
		if (visited.has(real)) return;
		visited.add(real);
		for (const entry of readdirSync(path, { withFileTypes: true }).sort((left, right) =>
			compareText(left.name, right.name)
		)) {
			if (!EXCLUDED.has(entry.name)) walk(resolve(path, entry.name));
		}
	};
	for (const root of roots) {
		if (statSync(root).isDirectory()) walk(root);
	}
	files.sort(compareText);
	const violations: { moduleSpecifier: string; path: string }[] = [];
	for (const path of files) {
		for (const specifier of moduleSpecifiers(readFileSync(path, 'utf8'))) {
			if (targetsCsaa(path, specifier)) {
				violations.push({ moduleSpecifier: specifier, path: slash(relative(ROOT, path)) });
			}
		}
	}
	return { inspectedFiles: files.length, violations };
}

describe('JAN-CSAAEXT S2 — product code does not import the analyzer, on the perimeter depcruise cannot reach', () => {
	const result = inspectProductBoundary();

	it('no file under apps/ or packages/rph-* imports CSAA — one that does is NAMED', () => {
		// Named rather than counted: a bare "expected 1 to be 0" would not say which file crossed the boundary.
		expect(result.violations).toEqual([]);
	});

	it('the walk inspected a real perimeter, so a collapsed walk cannot pass as a clean one', () => {
		// Asserted as text so the failure message carries BOTH the count and the floor it missed.
		expect(`product files inspected: ${result.inspectedFiles >= INSPECTED_FLOOR}`).toBe(
			'product files inspected: true'
		);
	});

	it('the NPM-SPECIFIER arm discriminates — the arm that outlives the directory move', () => {
		// ⭑ ITS OWN CONTROL, not a restatement of the check above. After S6 the relative-path arm is permanently
		// dead and this is the whole guard, so it is proven to discriminate NOW: it must accept the package name
		// and its subpaths, and must reject a neighbour that merely shares a prefix.
		const anyFile = resolve(ROOT, 'apps', 'rph-demo', 'src', 'lib', 'x.ts');
		expect({
			bare: targetsCsaa(anyFile, '@janumipwb/csaa'),
			subpath: targetsCsaa(anyFile, '@janumipwb/csaa/subject'),
			neighbour: targetsCsaa(anyFile, '@janumipwb/csaa-adjacent'),
			unrelated: targetsCsaa(anyFile, '@janumipwb/rph-domain')
		}).toEqual({ bare: true, subpath: true, neighbour: false, unrelated: false });
	});
});
