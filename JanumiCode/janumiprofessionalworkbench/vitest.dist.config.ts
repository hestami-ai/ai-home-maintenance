// The ARTIFACT gate — JAN-BINDEXCL / N-16. The mode that tests what actually ships.
//
// WHAT THIS RUNS THAT `test:src` DOES NOT. Nothing here aliases `@janumipwb/*`, so every cross-package specifier
// resolves through the package export map to `dist/index.js` — the emitted JavaScript, behind the emitted `.d.ts`,
// selected by the export conditions, containing exactly what `tsconfig.build.json` chose to include. A test that
// passes under `test:src` and fails here is a BUILD/EMIT DIVERGENCE, and it is the only kind of defect neither the
// typechecker nor the source-mode suite can see: `check-types` proves the SOURCE is well-typed and `build` proves
// tsc EMITTED something, but nothing proved the emitted thing behaves.
//
// WHY IT IS A ROOT CONFIG AND NOT TEN PER-PACKAGE ONES. Ten files rot independently, and a package added without
// one is silently unmeasured — which is N-16's own failure mode, reintroduced by the fix for it. One config over a
// SHARED, FILESYSTEM-DERIVED project list makes "both modes cover the same set" true by construction rather than
// by maintenance.
//
// ── WHY IT HAD TO BE WRITTEN AT ALL (N-16) ──────────────────────────────────────────────────────────────────
//
// This mode is not new. It was the DEFAULT — each package's `test` script was a bare `vitest run`, and with no
// root config to find, it resolved cross-package imports to dist. Adding `vitest.config.ts` in JAN-VERIF V-0 gave
// those bare invocations a config whose `projects[]` are rooted at the REPO root; from a package directory they
// match nothing, and `--passWithNoTests` in every package script turned "found no test files" into exit 0.
//
// So the mode was not deliberately retired — it was silently deleted, by the commit whose header asserts it was
// left "UNCHANGED", and stayed dead for four work packages. This file restores it explicitly, where a config that
// stops matching files FAILS instead of passing.
//
// NO COVERAGE HERE, DELIBERATELY. v8 coverage of `dist` attributes to emitted JavaScript, not to source lines, so
// the number would be uncomparable to the ratchet and actively misleading beside it. Coverage and mutation belong
// to `test:src`, where attribution and reachability are to real source. This mode answers one question — does the
// shipped artifact behave — and answering only that is what keeps its verdict readable.
import { defineConfig } from 'vitest/config';
import { projectsFor } from './vitest.projects.js';

export default defineConfig({
	// NO `resolve.alias`. Its ABSENCE is the whole content of this config, which is exactly why
	// `verif/source-resolution.test.ts` asserts the resulting resolution rather than trusting it: an absent line
	// cannot be reviewed, and a silently-restored alias would make this file's verdict identical to `test:src`'s
	// while still reading as a second, independent gate.
	test: {
		// The mirror of `test:src`'s `RPH_TEST_RESOLVE: 'source'`. Declared in the config rather than plumbed through
		// a shell variable so the flag cannot drift from the resolution it names.
		env: { RPH_TEST_RESOLVE: 'dist' },
		projects: projectsFor(true)
	}
});
