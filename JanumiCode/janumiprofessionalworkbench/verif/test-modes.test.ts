// JAN-BINDEXCL / N-16 — the two resolution modes cover the same set, and neither can go silently empty.
//
// WHY THIS EXISTS. `bun run test` executed ZERO tests for all ten packages for four work packages and reported
// success every time. Nothing was wrong with any test; the RUNNER stopped finding them, and `--passWithNoTests`
// rendered that indistinguishable from passing. The defect was invisible for the most ordinary reason there is:
// green is unfalsifiable unless you already know what it should say. It surfaced only because a change was made
// that HAD to redden two named tests, and they stayed silent.
//
// So the guard cannot be "check the config is right" — the old config was right, for the mode it described. It has
// to be: A MODE THAT OBSERVES NOTHING MUST FAIL. That is `passWithNoTests: false`, asserted here per project, plus
// the two structural facts that make the pair meaningful: both modes cover the SAME files, and they genuinely
// resolve DIFFERENTLY. A pair of identical gates is one gate wearing two names.
//
// THE ANTI-VACUITY PROBLEM IS THIS FILE'S OWN. Every assertion below is over a discovered list, and a discovery
// that returns nothing would satisfy "every project sets X" trivially — which is N-16's exact shape, one level up.
// Hence the explicit floor on the count before anything is asserted about the members.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import srcConfig from '../vitest.config.js';
import distConfig from '../vitest.dist.config.js';
import { packagesWithTests } from '../vitest.projects.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface Project {
	readonly test?: { readonly name?: string; readonly passWithNoTests?: boolean };
}

const projectsOf = (config: unknown): Project[] =>
	((config as { test?: { projects?: Project[] } }).test?.projects ?? []) as Project[];

const namesOf = (config: unknown) => projectsOf(config).map((p) => p.test?.name ?? '(unnamed)');

/** Package directories holding at least one `*.test.ts`, found independently of `vitest.projects.ts`. */
function packagesHoldingTests(): string[] {
	const walk = (dir: string): number => {
		if (!existsSync(dir)) return 0;
		let n = 0;
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) n += walk(full);
			else if (entry.endsWith('.test.ts')) n += 1;
		}
		return n;
	};
	return readdirSync(join(ROOT, 'packages'))
		.filter((name) => walk(join(ROOT, 'packages', name, 'src')) > 0)
		.sort();
}

describe('N-16 — the artifact gate and the source gate are both real, and both non-empty', () => {
	it('discovers a plausible number of packages, so nothing below can pass vacuously', () => {
		// The floor this file's own assertions rest on. Ten packages own tests today; a discovery that suddenly
		// returns two has broken, and every "every project…" assertion below would still pass.
		expect(packagesHoldingTests().length).toBeGreaterThanOrEqual(8);
	});

	it('covers EVERY package that holds a test file — a new package cannot be silently unmeasured', () => {
		// Re-derived here rather than imported, so this asserts the discovery is CORRECT rather than merely
		// self-consistent. The literal list this replaced was already wrong: it carried a comment claiming
		// `rph-ports` had "none of consequence" while `rph-ports` has a test file.
		expect(packagesWithTests()).toEqual(packagesHoldingTests());
	});

	it('runs the SAME project set in both modes, or the cross-check is silently partial', () => {
		// A package measured in one mode and not the other looks covered and is half-covered. Sharing one derived
		// list makes this true by construction; the assertion is what stops someone re-forking them.
		expect(namesOf(distConfig)).toEqual(namesOf(srcConfig));
		expect(namesOf(srcConfig)).toContain('verif');
	});

	it('sets passWithNoTests: false on every project in both modes — THE fix for N-16', () => {
		for (const config of [srcConfig, distConfig])
			for (const project of projectsOf(config))
				expect(project.test?.passWithNoTests, `${project.test?.name}: observing nothing must FAIL`).toBe(
					false
				);
	});

	it('keeps the two modes genuinely different: src aliases to source, dist does not alias at all', () => {
		// If the dist config ever acquired the alias, both gates would resolve to src and the artifact mode would
		// pass identically while testing nothing that ships — a false SECOND opinion, which is worse than one
		// opinion honestly labelled. (`source-resolution.test.ts` proves the resulting resolution at runtime; this
		// proves the configs still declare the intent.)
		const aliasOf = (c: unknown) => (c as { resolve?: { alias?: unknown } }).resolve?.alias;
		expect(aliasOf(srcConfig), 'the source mode must alias @janumipwb/* to src').toBeDefined();
		expect(aliasOf(distConfig), 'the artifact mode must NOT alias — that is its whole content').toBeUndefined();
	});

	it('lets no package re-introduce a --passWithNoTests script, which is how the gate went silent', () => {
		// Not a ban on per-package test scripts: a ban on the flag that turned "found nothing" into exit 0. Every
		// package's script was `vitest run --passWithNoTests`, and after a root config appeared they all found
		// nothing — ten green runs observing zero tests.
		const offenders: string[] = [];
		for (const name of readdirSync(join(ROOT, 'packages'))) {
			const file = join(ROOT, 'packages', name, 'package.json');
			if (!existsSync(file)) continue;
			const scripts = (JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> })
				.scripts;
			if (scripts?.test?.includes('--passWithNoTests')) offenders.push(name);
		}
		expect(offenders).toEqual([]);
	});
});
