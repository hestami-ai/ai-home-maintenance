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
import censusConfig from '../vitest.census.config.js';
import { CSAA_CENSUS, censusProjectsFor, packagesWithTests } from '../vitest.projects.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

interface Project {
	readonly test?: {
		readonly name?: string;
		readonly passWithNoTests?: boolean;
		readonly include?: readonly string[];
		readonly exclude?: readonly string[];
	};
}

/** The three harness watchdogs `CD-03b` found set on one of two sibling configs and not the other. */
const watchdogsOf = (config: unknown) => {
	const t = ((config as { test?: Record<string, unknown> }).test ?? {}) as Record<string, unknown>;
	return { hookTimeout: t.hookTimeout, testTimeout: t.testTimeout, maxWorkers: t.maxWorkers };
};

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

describe('JAN-CSAADEC CD-04 — the census lane is a PARTITION of the csaa lane, not a hole in it', () => {
	// WHY THESE LIVE HERE rather than in a new `verif/` file: adding a file to `verif/` moves the very population
	// the census pins, so a gate ABOUT the census that churns the census would be its own first defect. This file
	// already owns the class — it is where "both modes run the same project set" and "passWithNoTests is false
	// everywhere" are asserted.
	//
	// ⛔ AND WHAT IS DELIBERATELY *NOT* ASSERTED HERE, BECAUSE THE ROADMAP ASKED FOR IT AND IT IS UNBUILDABLE.
	// `CD-04` was specified as *"no file in the csaa lane reads the live workbench tree"*. Measured, SIX csaa-lane
	// files transitively reach a live-tree module and pass perfectly well — importing `collect-inventory.ts` is
	// not executing its assertions. That check would have failed on its first run. Pinning the reachable SET
	// instead would fire on any CSAA change, inside the gate that runs on everything — which is precisely the
	// coupling `CD-03` removed, reintroduced one file over. ⭑ Exhaustiveness is answered BEHAVIOURALLY by `CD-05`
	// (perturb the tree, diff the verdicts), on demand and not in the gate. This block gates the LIST; it does not
	// pretend to gate the JUDGEMENT that produced it.

	it('names a plausible, non-empty census, so nothing below can pass over an empty list', () => {
		// The floor the three assertions after this rest on — the same guard this file already puts under its
		// package discovery. `for (const x of [])` is green and proves nothing.
		expect(CSAA_CENSUS.length).toBeGreaterThan(0);
		expect(CSAA_CENSUS.length).toBeLessThan(20);
	});

	it('names only files that EXIST — the one rot `passWithNoTests: false` does NOT catch', () => {
		// ⭑ THIS IS THE REAL HOLE. `passWithNoTests: false` fires only when ALL census files vanish. Delete or
		// mistype ONE of three and the lane finds the other two, exits 0, and the third is silently unmeasured —
		// N-16's exact shape, scoped to a list of three instead of a list of packages.
		for (const rel of CSAA_CENSUS)
			expect(
				existsSync(join(ROOT, 'packages', 'csaa', rel)),
				`CSAA_CENSUS names ${rel}, which does not exist`
			).toBe(true);
	});

	it('excludes from the csaa lane EXACTLY what the census lane includes', () => {
		// The partition, stated. Both sides read the same constant, so this cannot drift — which is exactly why it
		// is worth asserting: the next edit that "helpfully" inlines one side is what this catches.
		const csaa = projectsOf(srcConfig).find((p) => p.test?.name === 'csaa');
		expect(csaa, 'the csaa project must still exist').toBeDefined();
		for (const rel of CSAA_CENSUS)
			expect(csaa?.test?.exclude ?? [], `${rel} is in the census but not excluded from the gated lane`)
				.toContain(rel);
		expect(projectsOf(censusConfig)[0]?.test?.include).toEqual(CSAA_CENSUS);
		expect(censusProjectsFor(true)).toHaveLength(1);
	});

	it('keeps the census lane OUT of both gate configs — which is what "decoupled" means here', () => {
		// If `csaa-census` ever appears in either gate config, the three pins are back in the default gate and
		// every product commit is obliged to re-pin them again. Nothing else would say so: the gate would simply
		// start failing on unrelated work, which is how this began.
		expect(namesOf(srcConfig)).not.toContain('csaa-census');
		expect(namesOf(distConfig)).not.toContain('csaa-census');
		expect(namesOf(censusConfig)).toEqual(['csaa-census']);
	});

	it('gives both gate configs the SAME harness watchdogs — CD-03b, and REG-F-024s shape', () => {
		// `vitest.dist.config.ts` carried hookTimeout/testTimeout/maxWorkers with a header explaining why; the
		// SOURCE config — the default, and the basis for coverage and mutation — carried none of the three. The
		// divergence was invisible because it only ever showed up as flakiness: 38 failures at the vitest default
		// versus 4 at 120s on one unchanged tree, and a suite reporting six failures or three depending on load.
		// A gate that covers one of two writers is not a gate.
		expect(watchdogsOf(srcConfig)).toEqual(watchdogsOf(distConfig));
		// ⛔ AND THE NON-VACUITY HALF, WITHOUT WHICH THE LINE ABOVE IS A CONTROL THAT CANNOT FAIL: two configs
		// that both declare NOTHING compare equal and read as agreement. Removing the settings from both must
		// redden this, not satisfy it.
		expect(watchdogsOf(srcConfig).hookTimeout, 'both modes must actually SET a hook watchdog').toBe(60_000);
		expect(watchdogsOf(srcConfig).testTimeout).toBe(60_000);
		expect(watchdogsOf(srcConfig).maxWorkers).toBe(4);
	});
});
