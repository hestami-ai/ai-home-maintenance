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
//   bun run test:dist     `vitest.dist.config.ts`, resolves DIST. The artifact gate — the only thing that tests
//                         what ships: the emit, the .d.ts boundary, the export map, tsconfig.build's excludes.
//   bun run test:src      this config, resolves SOURCE. The basis for coverage and mutation, where attribution
//                         and reachability must be to real source lines.
//
// A test that passes under one and fails under the other is a BUILD/EMIT DIVERGENCE — a finding in its own
// right. The two modes cross-check each other, which the single mode never could.
//
// ── WHAT THIS HEADER USED TO SAY, AND WHY THE CORRECTION IS LEFT VISIBLE (N-16) ─────────────────────────────
//
// The three lines above replace: "bun run test — per-package via turbo, resolves DIST. UNCHANGED. The artifact
// gate, and the default precisely because it is the only thing that tests what ships."
//
// THAT SENTENCE WAS FALSIFIED BY THE COMMIT THAT WROTE IT. Adding this file gave every package's bare
// `vitest run` a config to find — this one, whose `projects[]` roots are relative to the REPO root — so from a
// package directory it resolved no test files for its own CWD, and each package's `--passWithNoTests` turned
// "observed nothing" into exit 0. For four work packages `bun run test` executed ZERO tests for all ten
// packages while reporting success, and the artifact half of the cross-check above did not exist.
//
// The instrument built to catch precisely this was made unreachable by the same change:
// `verif/source-resolution.test.ts` carries the mirror assertion "If this ever starts failing, the default
// `test` has silently stopped validating the shipped artifact — which is the one thing it exists to do",
// behind `it.runIf(!SOURCE_RESOLVED)`, in a project that existed only in THIS config. It had never run.
//
// The correction is recorded here rather than quietly applied because the failure was not a wrong config — it
// was a CLAIM about a gate that nobody checked. Deleting the claim would leave the next reader with no reason
// to check the replacement.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { projectsFor } from './vitest.projects.js';

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
		// SHARED WITH `vitest.dist.config.ts` (N-16). The two modes must cover exactly the same files, or the
		// cross-check above is silently partial; the list is derived from the filesystem rather than enumerated so
		// a new package cannot be silently unmeasured; and it carries `passWithNoTests: false`, which is the fix
		// that generalises — a runner that observes NOTHING must fail, not pass.
		projects: projectsFor(true),
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
			// ── THE RATCHET (JAN-VERIF V-2c) ─────────────────────────────────────────────────────────────
			//
			// Set from the MEASURED merged figures — 94.57% statements / 82.99% branches / 95.72% functions /
			// 96.69% lines — rounded DOWN to the nearest half point. Never aspirational: an aspirational threshold
			// gets disabled the first time it blocks someone, and then it measures nothing at all.
			//
			// WHY A HALF-POINT OF SLACK RATHER THAN THE EXACT NUMBER. A threshold pinned to 94.57 fails on a wobble
			// of one statement — adding a defensive `default:` arm, or a legitimately untestable `catch` — and that
			// gate gets switched off just as surely as an aspirational one. Half a point is roughly 22 statements or
			// 17 branches here: far too small to hide a regression anyone would care about, and large enough that
			// the gate only ever fires on a real one.
			//
			// GLOBAL, NOT `perFile`. A per-file floor would fail on day one — `sqlite-storage-adapter.ts` sits at
			// 62% because most of it is error paths behind a driver this suite fakes — and a day-one failure is a
			// day-one disablement. Per-file gaps are argued individually in DR-001 §4, where the rule is that an
			// unreachable branch is DELETED or DECLARED, never coloured green.
			//
			// `autoUpdate` stays off, deliberately: a threshold that rewrites itself downward is not a ratchet.
			// BRANCHES RATCHETED 82.5 -> 83.0 on 2026-07-26 (V-2d). Measured 83.34 after the ontology validator's
			// five failure kinds became reachable; rounded DOWN to the nearest half point, per the rule above. A
			// ratchet that is not tightened when the measurement supports it is a ratchet in name only.
			//
			// THREE OF FOUR RATCHETED on 2026-07-28 (DR-002 W-2), and the CAUSE matters more than the numbers. W-2
			// added `apps/*` to the vitest project list: twenty app test files had been absent from BOTH resolution
			// modes, so the engine source they exercise was attributed to nothing. Bringing them in did not make the
			// code better — it revealed coverage that had always existed and was never counted, exactly as the
			// header above says per-package numbers were LOWER BOUNDS. Measured 95.22 / 83.53 / 97.00 / 97.16.
			//
			//   statements  94.5 -> 95.0   (measured 95.22, slack 0.22 ≈ 10 statements)
			//   functions   95.5 -> 96.5   (measured 97.00 — see below)
			//   lines       96.5 -> 97.0   (measured 97.16, slack 0.16 ≈ 6 lines)
			//   branches    83.0 UNCHANGED (measured 83.53 — see below)
			//
			// THE RULE IS "ROUND DOWN TO THE NEAREST HALF POINT", AND FOLLOWING ITS LETTER HERE WOULD HAVE BROKEN
			// ITS PURPOSE. That rule exists to leave slack, because "a threshold pinned to 94.57 fails on a wobble
			// of one statement, and that gate gets switched off just as surely as an aspirational one" (above). It
			// produces slack only when the measurement sits comfortably above a half-point boundary. These two do
			// not: branches at 83.53 would leave 0.03 — ONE branch — and functions at exactly 97.00 would leave
			// NOTHING AT ALL. A threshold one uncovered branch away from failing is not a ratchet, it is a tripwire,
			// and W-3/W-4/W-5 land new code behind it. So each steps down one further half point, and branches
			// therefore does not move at all: the measurement does not support tightening it with adequate slack.
			//
			// Recorded rather than quietly applied, because a reader comparing 83.53 against 83.0 will otherwise
			// conclude the ratchet was simply forgotten.
			//
			// LOAD-BEARING IN A SECOND WAY: these floors now also pin the apps INTO the measurement. Dropping
			// `appsWithTests()` from the project list would take coverage back below them and fail the gate, rather
			// than silently un-measuring 108 tests the way their absence did for months.
			thresholds: {
				statements: 95,
				branches: 83,
				functions: 96.5,
				lines: 97,
				autoUpdate: false
			}
		}
	}
});
