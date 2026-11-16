# Toolchain currency: the matrix and the procedure

How JPWB records the runtimes, compiler and tools it runs on, checks them at the start of every gate, and moves them.
The design is `docs/_working/DESIGN-toolchain-currency.md` (JAN-TOOLCUR); the package order is
`docs/_working/ROADMAP-toolchain-and-sonar.md`. This page is the operating summary; where it and the design differ, the
design governs.

## What is recorded where

| File | What it holds |
| --- | --- |
| `bun.lock` | The configuration item for every installed package: the exact version of each copy, nested copies included. `bun install --frozen-lockfile` reproduces it. |
| `scripts/toolchain/matrix.json` | The compatibility matrix: one row per runtime, declared package and machine tool, with its coupling group, pin style, blockers, the instruments it moves and the reason for each. |
| `.node-version` | The day-to-day Node, exact. The floor is `engines.node` in `package.json`. |
| `scripts/toolchain/machine-paths.json` | Where the check finds Edge and SonarLint, and how it asks the host tools their versions. Paths are profile- or environment-relative, never a path that names a user. JAN-SONARCM S1 extends this file. |
| `docs/operations/toolchain-reviews/YYYY-MM.md` | The monthly currency reviews. |

### Three kinds of field in the matrix

- **Generated** by `bun run scripts/toolchain/generate.ts`: each package's declared ranges, its lock-resolved version and
  its nested copies, and the day-to-day Node read from `.node-version`. Regenerating is an ordinary re-baseline. The
  same command rewrites the table below; running it twice gives the same bytes, and `--check` says whether the
  committed files are current.
- **Observed** from the machine, each with its date: the Edge major, the SonarLint version, the host tools and the VS
  Code installs. When `toolchain:check` reports drift, whoever ran it records the new value and its date. That is an
  ordinary re-baseline too.
- **Hand-written** judgments: coupling group, floor, pin style, blockers, the instruments a component moves, the runtime
  each gate step runs on, and the reason for each. `toolchain:check` enforces them, so they are gate configuration.
  Weakening, rewriting or removing one (lowering a floor, loosening a pin style, deleting a blocker whose condition has
  not lifted) is a separately authorized act: declared, attributed in a register entry, and processed at the authority
  of the behaviour it protects, today the sponsor's (I7). Adding a row or a blocker is authorship and needs no ruling.

## The matrix

<!-- matrix table: written by scripts/toolchain/generate.ts; do not edit by hand -->

| Component | Group | Pin | Declared → locked | Nested copies | Blockers |
| --- | --- | --- | --- | --- | --- |
| Node | Node/native | floor and day to day | `>=22`; day to day 24.22.3 | — | Node 26: no stable Electron, and so no VS Code, runs it (F-5); the planned extension's host decides (D-2). |
| Bun | runtime (G0) | exact | 1.3.14 | — | Bun 1.4: evaluated as its own package after T1-T3 (QT2, ruled; F-15). |
| svelte | Svelte/Vite | caret | apps/rph-demo: `^5.0.0` → 5.56.4 | — | SvelteKit 3 needs svelte 5.57.1 (D-12 T3). |
| @sveltejs/kit | Svelte/Vite | caret | apps/rph-demo: `^2.22.0` → 2.69.2 | — | SvelteKit 3 needs vite 8, vite-plugin-svelte 7, TypeScript 6 and adapter-auto 8 (D-12 T3); T3a moves to the newest 2.x first. |
| @sveltejs/vite-plugin-svelte | Svelte/Vite | caret | apps/rph-demo: `^6.0.0` → 6.2.4 | — | 6.x peers vite "^6.3.0 \|\| ^7.0.0", so the app stays on vite 7 while vitest runs its own vite 8: the split of F-14, which T3a ends. |
| @sveltejs/adapter-auto | Svelte/Vite | caret | apps/rph-demo: `^6.0.0` → 6.1.1 | — | 8 needs SvelteKit 3. |
| svelte-check | Svelte/Vite | caret | apps/rph-demo: `^4.0.0` → 4.7.2 | — | 4.7.2 peers TypeScript ">=5.0.0"; "^5 \|\| ^6" from 4.7.4; TypeScript 7 only through --tsgo. |
| vite | Svelte/Vite | caret | apps/rph-demo: `^7.0.0` → 7.3.6 | vitest/vite 8.1.4 | vite-plugin-svelte 6.x admits vite "^6.3.0 \|\| ^7.0.0" (F-14). |
| vitest | vitest | exact | .: `4.1.10` → 4.1.10 | — | — |
| @vitest/coverage-v8 | vitest | exact | .: `4.1.10` → 4.1.10 | — | moves with vitest: its peer range on vitest is exact. |
| eslint | lint | caret | .: `^9.37.0` → 9.39.5 | — | ESLint 9 reached end of life on 2026-08-06, and npm marks every 9.x version deprecated (F-13); T2 moves the lint group to 10. |
| @eslint/js | lint | caret | .: `^9.37.0` → 9.39.5 | — | Skip 10.0.0, which npm marks deprecated: "This version should not be used." (F-13). |
| typescript-eslint | lint | caret | .: `^8.0.0` → 8.63.0 | — | 8.x peers TypeScript "<6.1.0". |
| globals | lint | caret | .: `^15.0.0` → 15.15.0 | @eslint/eslintrc/globals 14.0.0 | two majors behind (17.x); moves with the lint group in T2. |
| typescript | TypeScript | exact | .: `5.9.3`, apps/rph-demo: `5.9.3` → 5.9.3 | — | 6.0.3 waits for dependency-cruiser 18 (T1b, D-4); 7: no compiler API, and typescript-eslint and dependency-cruiser cap it (F-6). |
| dependency-cruiser | TypeScript | caret | .: `^16.0.0` → 16.10.4 | — | 16.x admits TypeScript "<6": under 6 it cruises no package module (F-7), which the boundary population guard now fails; T1b moves it to 18 before TypeScript moves (D-4). |
| @types/node | Node/native | caret | .: `^24.0.0` → 24.13.3 | — | must not run ahead of the Node floor (D-8): a caret lets bun update take types for APIs above the floor. |
| better-sqlite3 | Node/native | caret | packages/rph-persistence: `^12.8.0` → 12.11.1 | — | a native addon on Node 24's ABI 137, which does not load under Bun; inside Electron it must match Electron's ABI, which 13's N-API builds may settle (D-2, left to the extension's design). |
| @types/better-sqlite3 | Node/native | caret | packages/rph-persistence: `^7.6.13` → 7.6.13 | — | moves with better-sqlite3. |
| @earendil-works/pi-ai | Pi SDK | exact | apps/rph-demo: `0.80.6` → 0.80.6 | — | breaking changes in patches after 0.80.6: 0.80.7, 0.80.8, 0.84.3, 1.0.3, 1.5.1 (F-13); a move needs a sponsor ruling. |
| @earendil-works/pi-coding-agent | Pi SDK | exact | apps/rph-demo: `0.80.6` → 0.80.6 | — | breaking changes in patches after 0.80.6: 0.80.7, 0.80.8, 0.84.3, 1.0.3, 1.5.1 (F-13); a move needs a sponsor ruling. |
| @earendil-works/pi-agent-core | Pi SDK | exact | apps/rph-demo: `0.80.6` → 0.80.6 | — | moves with pi-coding-agent; a move needs a sponsor ruling. |
| typebox | Pi SDK | exact | apps/rph-demo: `1.1.38` → 1.1.38 | — | moves with Pi. |
| @playwright/test | e2e | exact | apps/rph-demo: `1.61.1` → 1.61.1 | — | T6 moves the e2e browser from the system Edge to Playwright's bundled Chromium. |
| elkjs | graph layout | exact | apps/rph-demo: `0.11.1` → 0.11.1 | — | Skip 0.13.0, which npm marks deprecated; 0.12.0 "adds GPL-3.0 as a secondary license" (F-13). |
| @dagrejs/dagre | graph layout | exact | apps/rph-demo: `3.0.0` → 3.0.0 | — | — |
| @statelyai/graph | graph layout | exact | apps/rph-demo: `2.1.0` → 2.1.0 | — | — |
| @xyflow/svelte | graph layout | caret | apps/rph-demo: `^1.4.0` → 1.6.2 | — | — |
| xstate | xstate | exact | apps/rph-demo: `5.32.5` → 5.32.5 | — | — |
| @xstate/svelte | xstate | exact | apps/rph-demo: `5.0.0` → 5.0.0 | — | moves with xstate. |
| zod | codegen | exact | packages/rph-application: `4.4.3`, packages/rph-contracts: `4.4.3`, packages/rph-domain: `4.4.3` → 4.4.3 | — | — |
| prettier | codegen | exact | .: `3.9.5` → 3.9.5 | — | — |
| ajv | codegen | caret | packages/rph-contracts: `^8.17.0` → 8.20.0 | @eslint/eslintrc/ajv 6.15.0, eslint/ajv 6.15.0 | — |
| ajv-formats | codegen | caret | packages/rph-contracts: `^3.0.0` → 3.0.1 | — | moves with ajv. |
| turbo | standalone | caret | .: `^2.10.4` → 2.10.4 | — | — |
| ulid | standalone | caret | apps/rph-demo: `^2.3.0`, packages/rph-authoring: `^2.3.0`, packages/rph-contracts: `^2.3.0` → 2.4.0 | — | — |
| fast-check | standalone (tests) | exact | packages/rph-domain: `4.9.0` → 4.9.0 | — | — |
| edge | e2e (machine) | observed, major checked | 157 (2026-11-16) | — | The system Edge, the only e2e browser (channel 'msedge' in all three Playwright configs), which updates itself: launcher 157.0.4341.42, with 157.0.4341.46 and 157.0.4341.60 staged. T6 replaces it with Playwright's bundled Chromium. |
| sonarlint | Sonar runner (machine) | observed, version checked | 6.3.0 (2026-11-16) | — | The SonarLint extension the Sonar runner drives (~/.devin/extensions), bundling SonarJS 14.4.0.46458 and its JRE 21.0.12.1. It decides no gate:fast step today (D-9); JAN-SONARCM's runner checks it again at run time. |
| java | host tools (G12) | observed | 21.0.7 (2026-11-16) | — | Java on PATH: Temurin 21.0.7. |
| git | host tools (G12) | observed | 2.53.0.windows.1 (2026-11-16) | — | git on PATH. |
| python | host tools (G12) | observed | 3.14.0 (2026-11-16) | — | Python on PATH. |
| devin | agent CLIs | observed | 3000.11.234 (2026-11-16) | — | The devin CLI, which updates itself. |
| pi | agent CLIs | observed | 1.4.0 (2026-11-16) | — | The pi CLI, beside the in-process SDK the app pins (0.80.6). |
| ollama | agent CLIs | observed | 0.40.16 (2026-11-16) | — | The Ollama server, which updates itself; its version is governed at run time by REG-D-152 (0.40.16 accepted beside the recorded 0.40.15). |
| VS Code | VS Code (new) | floor | 1.123.0: Electron 42.3.0, Node 24.15.0 | — | F-5's table from each VS Code tag's .npmrc target= and Electron's release list; 1.123.0 is the first VS Code on Node 24, and engines.vscode becomes ">=1.123.0" when the extension's manifest exists (D-2). |

<!-- end of matrix table -->

## `bun run toolchain:check`, the gate's first step

It runs first in `gate:fast` so that a machine or tree the matrix does not record fails in seconds, before any step
measures on it and before any cached step (`turbo.json` hashes the matrix and `.node-version`). It fails on any of:

1. **Runtimes.** The Node on PATH differs from the day-to-day Node (in floor-lane mode, from the floor), or the running
   Bun differs from its exact pin. The check asks the `node` that PATH finds, because Bun reports itself as Node
   `v24.3.0`.
2. **Installed tree and lock.** For a matrix package, a copy in `bun.lock` disagrees with the matrix (nested copies
   included), or an installed copy disagrees with the lock. `gate:fast` runs no install, so `node_modules` can drift.
3. **Manifests.** A declared range or pin style disagrees with the matrix; a manifest declares a package with no row; a
   row names a declaration no manifest makes; or `engines.node`, `devEngines`' Bun or `.node-version` disagrees.
4. **Peer ranges.** An installed package declares a peer range on a matrix package that the copy it resolves (as
   `bun.lock` records it) does not satisfy.
5. **Cross-row rules.** The VS Code floor's Node, or the day-to-day Node, is below the Node floor.
6. **Browser floor.** Vite's `build.target` and the matrix's browser floor disagree. Both are absent until T1c sets them.
7. **Machine tools.** The Edge major installed (a staged update counts) or the SonarLint version differs from the one
   recorded.
8. **Population.** The matrix or the lock is empty or unreadable, or the lock holds no matrix package. A check over
   nothing would pass, so it fails instead.

It also derives the runtime of each `gate:fast` step from its command and the shebang of the bin it starts, and fails
when that differs from the runtime the matrix records (for example a step that runs `bun --bun vitest run` where the
matrix records Node).

**Floor-lane mode.** Set `JPWB_TOOLCHAIN_FLOOR_LANE=1` to run the unchanged `bun run gate:fast` on the floor Node (a
portable official zip first on PATH). Condition 1 then compares the Node on PATH with the recorded floor. The floor
lane runs from T1a on; T0 keeps today's floor, which the code already needs more than.

**When it fails.** Read the condition and the line under it; each names what disagrees with what.

- A runtime or package that moved by itself: put the machine or the tree back (for a package, `bun install
  --frozen-lockfile`), or, if the move is wanted, make it as an upgrade (below).
- A machine tool that updated itself: record its new observed value and date in the matrix (an ordinary re-baseline),
  run `bun run scripts/toolchain/generate.ts`, and commit both.

**Its authority.** Like the rest of `gate:fast`, it runs on the operator's machine: under DOC-004 §7.6, developer
convenience, valuable and never the guarantee. It is filed in the register as an interim carrier when T0 lands.

## Machine tools that update themselves, and the main line

Every worktree on this machine shares one Node, one Edge and one SonarLint, so a self-updated tool fails
`toolchain:check` on every branch that carries the check until its new value is recorded (D-13).

- **Who records it on the main line.** The session that first meets the red records the new observed value and its
  date in `matrix.json` on a branch from the main-line tip, runs the gate, and asks the sponsor to land it between paid
  runs, as for any other change to the main line. Under the sponsor's ruling of 2026-11-16 the toolchain session makes
  any merge this needs; where its merges and the main line's landings race, the sponsor may ask the JAN-EXEC session to
  hold its landings for the hour a merge and its gate take.
- **How live branches take it.** Each live branch merges the main line (or takes the one-line change) before its next
  gate run.
- **Edge until T6.** Edge's majors arrive about every two weeks. T6 moves the e2e suite to Playwright's bundled
  Chromium, which the lock pins, and takes Edge out of this.

## The upgrade procedure: one coupling group per package (D-11)

Each upgrade runs on its own branch and worktree, from the newest main-line tip, in this order:

1. A dry run in scratch: an integrity-checked copy, no repository change.
2. The lock update.
3. Ordinary re-baselines in the same commit: `bun run gen`, `coverage:floor`, `guards:export`, `slices:ledger`, ledger
   re-anchoring, and `bun run scripts/toolchain/generate.ts`. A fall in a lint count is ordinary; a rise is governed.
4. Governed instruments only after a sponsor ruling: the reviewer fingerprint, the Ollama identity, the fence digest,
   the Pi pins, and any ledger `abolishedBy`.
5. The full `bun run gate:fast`, and `bun run mutants:changed -- --run` for any source edit. A change to the compiler,
   svelte-check, or a lib or target level also runs `bun run mutants:preflight` over every live mutant, in its own
   worktree.
6. The floor lane: the gate on the floor Node, in floor-lane mode. If it cannot run, it is reported as not run, with
   its reason.
7. A Sonar re-scan of the changed files; a lib or target change runs the full sweep.
8. Records: the matrix, the register entry, and the currency report.

"The upgrade changed nothing it should not" means: the `dist` byte-diff, unchanged test counts, an unchanged reviewer
fingerprint, the mutation preflight where step 5 calls for it, and the Bun-equals-Node agreement checks. The `dist`
byte-diff and the test counts come from `scripts/toolchain/compare-builds.ts`:

```sh
bun run scripts/toolchain/compare-builds.ts record --out=<before.json> [--build] [--tests-from=<gate log> ...]
# ... make the change ...
bun run scripts/toolchain/compare-builds.ts record --out=<after.json> --build [--tests-from=<gate log> ...]
bun run scripts/toolchain/compare-builds.ts compare <before.json> <after.json>
```

## Pin rules (D-8)

| Kind | Pin |
| --- | --- |
| Runtimes | Node: the floor in `engines`, and the day-to-day version in `.node-version`. Bun: exact. |
| The compiler | Exact. |
| `@types/node` | Exact from T1a, at the newest 24.x types release whose minor is not above the floor's. |
| Packages that put breaking changes in patch or minor releases | Exact, with a changelog read on every bump (Pi, typebox, Playwright). |
| Tools whose output an instrument pins | Exact: prettier, zod, vitest, @vitest/coverage-v8. |
| A dependency that is exact today | Stays exact until a decision loosens it; its row records its reason, or that none was found and where the search looked. |
| Everything else | A caret range, with `bun.lock` as the configuration item. |

Skip versions npm marks deprecated (`@eslint/js` 10.0.0 and `elkjs` 0.13.0 are live examples).

**The release-age cooldown.** `bunfig.toml` sets `install.minimumReleaseAge = 604800`: Bun refuses to resolve a version
published less than 7 days ago. It was shown on Bun 1.3.14 before it was set (2026-11-16): a version 2 days old was
refused ("blocked by minimum-release-age: 604800 seconds"), one 10 days old installed, and a frozen install of the
committed lock still passed. A security fix released this week is installed by naming its package in
`install.minimumReleaseAgeExcludes` for that one install (Bun 1.3.14 has the setting; shown the same day), restoring
`bunfig.toml` in the same commit, and recording it in the monthly review. The cooldown is never left off.

## The monthly review and its triggers (D-10)

`bun run toolchain:review` writes `docs/operations/toolchain-reviews/YYYY-MM.md`. It reads the npm registry (newest
versions, deprecations), Node's release schedule, endoflife.date for the products it tracks, Electron's releases (for
the VS Code chain), `bun outdated` and `bun audit`, and the host tools' versions. It flags deprecated versions, an end of
life within 90 days, and machine tools that drifted from their recorded value. `bun audit` feeds the report and the
security trigger only, never a gate step: dependency scanning stays deferred as a gate family (REG-Q-049).

Act between reviews on: a security advisory on a used component (within days); an end of life within 90 days; a blocked
upgrade's blocker lifting; a needed feature.

## The boundary step's population guard (D-4)

`bun run boundary` first runs the rules' cruise unchanged, then `scripts/toolchain/boundary.ts`, which runs its own
JSON cruise of the same perimeter and compares the package source files it cruised with the ones git tracks (less the
config's exclusion). It fails on zero package modules, a tracked file not cruised, a cruised path that is not tracked
package source, or a path cruised twice. dependency-cruiser 16 cruises nothing under TypeScript 6 and still prints its
green line (F-7); this guard is what turns that into a red.
