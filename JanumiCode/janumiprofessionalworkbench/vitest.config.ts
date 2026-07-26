// Root vitest configuration — JAN-VERIF V-0.
//
// WHY THIS FILE EXISTS. Until now this monorepo had NO vitest config at all: each package ran `vitest run` on
// defaults, so there was no way to produce one merged coverage report, and coverage had never been measured.
//
// THE ROOT FACT IT SOLVES, established by experiment (JAN-VERIF-DS-001 §2). Mutating
// `packages/rph-domain/src/execution.ts` without rebuilding:
//
//     rph-domain      (own src)   -> RED    (sees src)
//     rph-application (cross-pkg) -> GREEN  (reads DIST)
//
// Cross-package tests exercise the BUILT `dist`, never `src`. Every package's export map declares
// `"source": "./src/index.ts"` next to `"import": "./dist/index.js"`, and NOTHING consumed the `source`
// condition. Three consequences followed, and all three had already bitten:
//
//   1. Merged coverage was impossible — rph-application's 552 tests exercise rph-domain heavily and that
//      exercise attributes to `dist/index.js`. So per-package numbers are LOWER BOUNDS, and rph-persistence's
//      48.6% / command-bus.ts's 53.8% are ARTIFACTS: every rph-application test constructs SqliteStorageAdapter
//      and every rph-engine test drives the bus.
//   2. The dist trap was STRUCTURAL. Any cross-package mutant is silently meaningless without a rebuild — it
//      produced a false GREEN twice in one working session.
//   3. Nobody had ever seen the real number. Not "it is low" — UNMEASURED.
//
// TWO MODES, EXPLICITLY, NEITHER IMPLICIT (DS §3-R1). Source resolution fixes all three and is ALSO a real
// behaviour change: `bun run test` currently validates the SHIPPED ARTIFACT — the emit, the .d.ts boundary, the
// export map — and source resolution silently stops testing any of it. A bad `tsconfig.build.json` exclude or an
// export-map typo would go undetected. So both are kept:
//
//   bun run test          per-package via turbo, resolves DIST. UNCHANGED. The artifact gate, and the default
//                         precisely because it is the only thing that tests what ships.
//   bun run test:src      this config, resolves SOURCE. The basis for coverage and mutation, where attribution
//                         and reachability must be to real source lines.
//
// A test that passes under one and fails under the other is a BUILD/EMIT DIVERGENCE — a finding in its own
// right. The two modes cross-check each other, which the single mode never could.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const PKG_ROOT = fileURLToPath(new URL('./packages', import.meta.url));

/**
 * Map every `@janumipwb/…` specifier to source.
 *
 * TWO PATTERNS, AND THE ORDER MATTERS. Vite's object-form alias does PREFIX replacement, so a single entry for
 * `@janumipwb/rph-contracts` rewrote `@janumipwb/rph-contracts/hash` into `…/src/index.ts/hash` and 78 test files
 * failed to import. Subpath exports are real here — `rph-contracts/hash` and `rph-authoring/catalog` — so the
 * SUBPATH pattern is listed FIRST and anchored, and the bare pattern is anchored with `$` so it cannot swallow
 * one.
 *
 * Derived by regex rather than enumerated per subpath, so a new subpath export needs no change here — the
 * alternative is a list that silently rots, which is the failure mode this whole programme is about.
 */
const WORKSPACE_ALIAS = [
	{ find: /^@janumipwb\/([a-z0-9-]+)\/(.+)$/, replacement: `${PKG_ROOT}/$1/src/$2.ts` },
	{ find: /^@janumipwb\/([a-z0-9-]+)$/, replacement: `${PKG_ROOT}/$1/src/index.ts` }
];

/** The packages that own a test suite. `rph-ports` and the typescript-config package have none of consequence. */
const PACKAGES = [
	'rph-contracts',
	'rph-domain',
	'rph-application',
	'rph-projections',
	'rph-assurance',
	'rph-persistence',
	'rph-engine',
	'rph-authoring',
	'rph-ports',
	'rph-product-realization-pwa'
];

export default defineConfig({
	resolve: {
		// THE WHOLE POINT: `@janumipwb/rph-*` must resolve to `src/index.ts`, not `dist/index.js`.
		//
		// EXPLICIT ALIASES RATHER THAN THE `source` EXPORT CONDITION, and the first attempt is why. Declaring
		// `conditions: ['source', …]` here did NOT work: vitest resolves through Vite's SSR pipeline, where
		// `resolve.conditions` is not the operative option, so the package specifier still landed on dist. The
		// proof test below caught it immediately — which is the entire argument for writing that test first.
		// Aliases are version-independent, and they say what they mean at the cost of one line per package.
		alias: WORKSPACE_ALIAS
	},
	test: {
		// Declared HERE rather than plumbed through a shell env var, because this config IS the source-resolving
		// mode — so the flag is correct by construction and cannot drift from the `resolve.conditions` above it.
		// Cross-platform env plumbing in npm scripts needs `cross-env`; this needs nothing.
		env: { RPH_TEST_RESOLVE: 'source' },
		projects: [
			// The infrastructure proof (see verif/source-resolution.test.ts). Its own project because it is not part
			// of any package: it asserts that THIS config's alias is in effect, and it must live outside every
			// package's rootDir to be able to import across the boundary at all.
			{ extends: true, test: { name: 'verif', root: '.', include: ['verif/**/*.test.ts'] } },
			...PACKAGES.map((name) => ({
				extends: true,
				test: {
					name,
					root: `./packages/${name}`,
					include: ['src/**/*.test.ts'],
					passWithNoTests: true
				}
			}))
		],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary', 'html'],
			reportsDirectory: './coverage',
			// Source only, and only what SHIPS. Test files, fixtures and generators are instruments, not subjects:
			// measuring them inflates the number without measuring anything that runs in production.
			include: ['packages/*/src/**/*.ts'],
			exclude: [
				'**/*.test.ts',
				'**/__tests__/**',
				'**/src/gen/**',
				// Generated contract artifacts — emitted from vocab by `bun run gen`, reviewed as a diff, not
				// hand-written. Their coverage is a property of the generator's inputs, not of any test's rigour.
				'packages/rph-contracts/src/{objects,messages,enums,schemas}.ts',
				'packages/rph-domain/src/transitions.data.ts',
				'**/*.d.ts',
				'**/index.ts'
			],
			// Thresholds land in V-2, set at MEASURED values so the gate ratchets and cannot silently regress.
			// Deliberately absent here: an aspirational threshold gets disabled the first time it blocks someone.
			thresholds: undefined
		}
	}
});
