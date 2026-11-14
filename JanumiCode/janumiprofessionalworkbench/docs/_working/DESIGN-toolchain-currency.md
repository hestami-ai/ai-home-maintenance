# DESIGN — JAN-TOOLCUR: keeping JPWB's runtimes, compiler and tools current, pinned and compatible

**Programme:** `JAN-TOOLCUR` · **Status:** DESIGN, sponsor questions ruled 2026-11-13 · **Opened:** 2026-11-13 · **Occasioned by:** the sponsor —
*"We need a repeatable methodology such that this can be done periodically as well."*
**Companion:** `JAN-SONARCM` (`DESIGN-sonar-configuration-management.md`) puts the Sonar method under configuration
management; the Sonar engine is one row of this design's matrix. **Evidence base:** the worktree at `e299baef`
(`E:/Projects/hestami-sonar`). Paths are relative to `JanumiCode/janumiprofessionalworkbench/` unless stated.

---

## 0. In short

**The problem.** No package in JPWB's lockfile has changed version since the code arrived here on 2026-07-12 (0 of
392), while machine tools moved (SonarLint; Ollama and Edge update themselves). The versions JPWB states are checked
by nothing that runs (the Ollama server's is the one exception), and its Node floor, ">=22", is below what two of its
own tests need (Node 24.6 or 22.19, per Node's docs; not run). There is no upgrade routine, and the obvious first
step, TypeScript 6, would make one gate step check nothing while still printing green (read from its code; not run).

**What will change.**
- A committed compatibility matrix (a JSON file and a page) records each component's range, locked version, floor
  (the oldest version JPWB promises to run on), support window and blockers. A new first gate step, `toolchain:check`,
  fails when the machine, the installed packages or the lockfile disagree with it.
- Node: floor 24.15.0; day to day 24.22.3 (the 2026-11-11 security release), written in `.node-version`.
- TypeScript 6.0.3, exact; ES2025 in the 16 programs that type-check JPWB, the app's 3 included; a browser floor.
- dependency-cruiser moves to 18 first, and the gate step that checks package boundaries fails if it checks no files.
- A monthly review writes a dated report. Security fixes and end-of-life dates trigger work in between.
- Every upgrade follows one procedure: a trial in a scratch copy, the lockfile change, regenerated baselines in the
  same commit, the full gate, a gate run on the floor Node, and records. Four pinned measurements your rulings govern
  (the reviewer fingerprint, the decision-model server, the fence digest, the Pi version) move only after you rule.

**What you already decided (2026-11-13).** *"update to Node 24 (or higher if compatible) to keep node and bun in as
close as sync as possible"*; *"We do want to have a VS Code extension built so that is a compatibility matrix factor
as well"*; *"update to Typescript 6.0+ ... which should allow us to update to ES2025"*; *"The other corrections you
mentioned are agreeable as well."* Your three conditions, answered:
- "Higher if compatible": not yet. No VS Code release up to 1.145 and no stable Electron runs Node 26, and Bun 1.3.14
  reports itself as Node 24. Node 26 stays a watched candidate.
- "Tracking the runtimes": TypeScript follows the yearly JavaScript editions, not Node or Bun. 6.0 is the first that
  can name ES2025, and Node 24 and Bun 1.3.14 both pass all 8 ES2025 checks we ran.
- "6.0+": 6.0.3, not 7. TypeScript 7 has no compiler API yet, and 3 of the 4 tools checked exclude it as installed
  (all 4 in their newest releases).

**Your rulings (2026-11-13),** each *"agree as fully recommended"*:
1. **QT1. Browser floor: Chrome/Edge 136, Firefox 138, Safari 26,** the first versions with all of ES2025 (all from
   2025). It drops Firefox ESR 115, which still gets updates, but only on Windows 7-8.1 and old macOS, until March 2027.
2. **QT2. Bun 1.4: stay on 1.3.14 until T1-T3 land** (Node and TypeScript; ESLint; Svelte and Vite), then evaluate it
   as its own package. 1.4 is a rewrite in Rust that changes `bun update`, writes new lockfile versions and says it
   reports Node 26, not 24. The cost: a Bun security issue could force the move early (1.3.14 is the last 1.3).
Also approved: *"Node security update"*, to 24.22.3 on this machine.

---

## 1. Basis and authority

### 1.1 What binds

1. **The sponsor's request (R0) and rulings (R1), 2026-11-13.** R0: *"It's probably worth reviewing and proposing how
   to systematically update to latest versions of software components for JPWB like node, bun, typescript, svelte,
   sveltekit, etc. for version pinning needs and compatibility matrix, etc.. We need a repeatable methodology such
   that this can be done periodically as well. [...]"* (the rest of R0, on Sonar, binds `JAN-SONARCM`). R1 is quoted
   in full at D-1. R1 also accepts the corrections of the lead's ES-level report (*"The other corrections you
   mentioned are agreeable as well."*); D-5 lists them.
2. **JAN-ENGC-001 §7.1** — *"The repository's checked-in tooling, configuration, scripts, and accepted operations
   documentation define how quality gates are executed."* (`docs/Recursive Professional Harness/Janumi Professional
   Workbench - Engineering Constitution.md:480`). So the matrix, the check and the review script live in JPWB.
3. **JAN-ENGC-001 §7.2** — *"A gate that could not run SHALL be reported as not run, together with the reason and
   residual risk."* (`:486`). This governs the floor lane and the Sonar re-scan in D-11.
4. **DOC-004 §7.6** — *"Modifying an oracle — a conformance fixture, an acceptance test, a gate configuration, a
   reference artifact — is a separately authorized act"* (`docs/canon/JPWB-DOC-004 Agent Operating Protocol.md:256`),
   with its own limit: *"this rule governs weakening, rewriting, or removing judgments that predate the change"*
   (`:256`); and *"A pre-commit hook or local gate run is developer convenience — valuable, and never the guarantee"*
   (`:258`). Once `toolchain:check` reads the matrix, the matrix's hand-written fields are a gate configuration (I7).
5. **REG-D-012 (3)** — local conveniences are *"permitted only as **marked interim carriers** executing the same
   policy artifacts"* (`docs/canon/JPWB-REG-005 Decision and Divergence Register.md:128`).
6. **REG-Q-049's safe default and REG-D-046 Ruling 3.** Dependency and vulnerability scanning is a gate family that
   *"Becomes mandatory at the first production-facing slice"* (REG-005 `:430`) and *"remain deferred"*
   (`:27127-27130`). This design therefore uses `bun audit` only as an input to a dated report and to the security
   trigger, never as a gate step (D-10).
7. **The rulings that govern instruments an upgrade can move:** REG-D-146, REG-D-149 and REG-D-153 (the reviewer
   fingerprint); REG-F-608 and REG-D-152 (the decision-model server's identity); REG-F-481 and REG-D-013 (the fence
   digest); REG-D-114 (19) (the Pi pins). D-11 re-pins none of them without a new ruling.

### 1.2 Provenance only

- **JAN-CSAA-011** is a Draft with *"Authority: None."* (`docs/ASTs and Code Analysis/JAN-CSAA-011 - TypeScript and
  Analysis Tool Integration Standard.md:17`). Its §15 rules (`:560-566`, e.g. *"Automatic update SHALL default to
  disabled for qualified providers."*) agree with this design, which does not rest on them.
- **The roadmap's tech-stack table** (`docs/JPWB Implementation Roadmap and Tracker.md:61-74`) is a plan, not a pin.
  It says *"TypeScript ^6"* and *"`target ES2022`"* (`:69`) and *"eslint ^10"* (`:74`), and it has disagreed with the
  lock since import (history review).
- **The two workflow reviews** (ES level, `wf_80efd7bd-1be`; toolchain and Sonar, `wf_5eb961a6-be1`) and the lead's
  measurements of 2026-11-13 are evidence, not authority.
- **The platform (`janumi`) and `janumicode_v2`** supply observed versions for the matrix's alignment columns only.

This design assigns no register numbers. Each decision is filed as a REG-D entry when it lands.

---

## 2. Scope, and what is out of scope

**In scope:** JPWB's two runtimes (Node, Bun); its compiler (TypeScript) and language level; its 35 declared npm
packages and the transitive ones that decide behaviour (the nested vite, better-sqlite3's native addon); the machine
tools that decide gate behaviour; the gate step that enforces the pins; the periodic review; the upgrade procedure;
and the order of the first upgrades, as a preview for the roadmap.

**Out of scope:**
- Building the VS Code extension. Only its version chain enters the matrix (D-2).
- Adopting Bun 1.4. QT2, ruled 2026-11-13, settled only when to evaluate it: after T1-T3.
- The platform's own toolchain. Its versions appear only as alignment columns.
- CI. None runs: JPWB's `ci.yml` is nested where GitHub does not look, and the root workflow filters
  `JanumiCode/janumicode/**` (REG-F-419, OPEN). Moving or removing the nested file is a separate decision.
- The Sonar method itself, which `JAN-SONARCM` designs. The Sonar engine version is a matrix row here.

**Terms, each defined once:**
- **Floor:** the oldest version JPWB promises to work on (for Node, `engines.node`).
- **Day-to-day version:** the exact version the gate runs on (for Node, `.node-version`).
- **Observed version:** a version read from the machine (for example the Edge major), not from the lockfile.
- **Coupling group:** components that must move together because their declared ranges bind each other.
- **Matrix:** the committed compatibility record of D-7.
- **Re-baseline:** regenerating a committed baseline that an upgrade moved. *Ordinary* re-baselines need no ruling;
  *governed* ones do.
- **Predicted red:** the check a change must first see fail, so that it is known the check can fail.
- **Floor lane:** a run of the gate on the floor Node instead of the day-to-day one.

---

## 3. Findings

### F-1. Nothing in the lock has been upgraded since import; machine tools moved on their own

- 0 of the 392 lock entries present at import (`19a1b20f`, 2026-07-12) has changed version. HEAD has 542 entries: 150
  added, 0 removed, 0 changed. This design re-derived those counts from the two `bun.lock` texts; they match the
  history review.
- 35 of 35 declared components still resolve to the version they were first locked at; 24 of them since 2026-07-12,
  124 days ago (history review).
- One declared range was ever edited: typescript `^5.9.2` → `5.9.3` exact in `689ac61b` (2026-08-11). The lock
  already held 5.9.3 (history review).
- Machine tools did move, outside the lock: the SonarLint extension 6.3.0 was installed on 2026-11-12 (history
  review); the Ollama server updated itself from 0.40.11 to 0.40.15 and then to 0.40.16, installed 2026-11-11
  (history and inventory reviews); Edge 157.0.4341.46 is staged beside 157.0.4341.42 (instruments review I25).
- No binding text covers upgrades, lock refresh or end of life (history review's search). The only SHALL-worded
  discipline is JAN-CSAA-011's, which has no authority (§1.2).
- Against the npm registry on 2026-11-13, 19 of the 35 declared packages are at least one breaking line behind, 14
  are behind within their line, and 2 are current (web-versions review).

### F-2. The stated pins are enforced by nothing, and the Node floor is too low

- Bun: `package.json:58-63` `"devEngines": { "packageManager": { "name": "bun", "version": "1.3.14" } }`. Bun reads
  none of `packageManager`, `engines` or `devEngines`. Bun PR #46656 (open) says *"Bun never reads either field, so
  `bun install` and `bun run check` on bun 1.4.3 print nothing."* (https://api.github.com/repos/oven-sh/bun/pulls/46656);
  `devEngines` support is open issue #26512 (critic C5, F2).
- Node: `package.json:64-66` `"engines": { "node": ">=22" }`. No `.nvmrc`, `.node-version`, `.tool-versions` or
  volta field is tracked (`git ls-files`, 0 hits).
- The only check is `.github/workflows/ci.yml:14-16` (`bun-version: 1.3.14`), and that workflow never runs. The
  repository root's workflow triggers only on `paths: ['JanumiCode/janumicode/**']`
  (`E:/Projects/hestami-sonar/.github/workflows/ci.yml:5`, `:8`). REG-F-419 (REG-005 `:36724`): *"JPWB has no CI that
  runs"*.
- The one version the product checks at run time is the Ollama server's:
  `apps/rph-demo/src/lib/server/assurance/decision-model-client.ts:231` refuses a server whose version is neither the
  identity's nor one accepted beside it (REG-D-152). The history review: *"The only version pin the product enforces
  at runtime is the Ollama server's."*
- The code needs more than ">=22". Four of the five tests in `apps/rph-demo/src/lib/server/harness-keep-alive.test.ts`
  read `server.keepAliveTimeoutBuffer`, through the helper `timeoutsOf` (`:29`) or directly (`:78`). Node documents it
  as *"Added in: v24.6.0, v22.19.0"* (https://nodejs.org/api/http.html; critic C1). By that, two would fail below
  those versions: the test at `:74` (the sum at `:78` becomes `NaN`) and the control at `:83` (it expects
  `keepAliveTimeoutBuffer: 1_000` at `:89`). The tests at `:63` and `:122` compare against `createServer()`'s own
  values and would pass. Inference from the docs; not run. (The critic and the brief counted "three tests" from the
  three lines `:29`, `:78` and `:89`.) The Pi SDK 0.80.6 declares node `">=22.19.0"`.
- `@types/node` 24.13.3 marks that field *"@since v24.6.0"* (`node_modules/@types/node/http.d.ts:469`). Under a
  ">=22" floor the type check therefore accepts Node-24-only APIs (inference, inventory and critic).
- Nothing records the gate passing on any Node other than 24.11.1 (critic G10).

### F-3. The gate runs on two runtimes, and the repository disagrees with itself about which runs what

- Bun runs every `bun run scripts/*.ts` step, the generators, `gate:tail` and `reviewer:qual:check`. Node runs
  vitest, Playwright, the dev server and the tool bins: 10 of 10 bins checked start `#!/usr/bin/env node`, and Bun's
  docs say *"By default, Bun respects this shebang and executes the script with `node`."*
  (https://bun.com/docs/cli/run; inventory review).
- `verif/fence-skeleton-determinism.test.ts:39` asserts it: `expect(process.versions.bun, 'the in-process limb runs
  under node, not bun').toBeUndefined();`. `packages/rph-ports/src/ports/process-runner.ts:60` agrees: *"VITEST'S OWN
  WORKERS ARE NODE — measured, not assumed"*.
- Three comments say the opposite: `packages/rph-ports/src/ports/workspace.ts:180` *"vitest under bun"*,
  `packages/rph-ports/src/ports/workspace.test.ts:72` *"this repository runs both — vitest under bun and"* the
  SvelteKit server under node, and `apps/rph-demo/src/lib/server/execution/filesystem-workspace.test.ts:301`
  *"MEASURED UNDER BUN, THE RUNTIME THIS REPOSITORY'S OWN SUITES RUN ON"* (critic G12 named the first and the third).
- Bun 1.3.14 reports itself as Node `v24.3.0` (the lead's measurement). It still behaves differently: *"bun (Unicode
  15.0) and node (Unicode 16.0) read"* code points apart (`scripts/fence-skeleton/digest.ts:5`), and *"under Bun
  1.3.14 String.raw returns the non-ASCII characters of its raw text as \uXXXX escapes"*
  (`scripts/reviewer-qual/decision-model-pointer.ts:96`). Three instruments require Bun and Node to agree byte for
  byte: the reviewer fingerprint, the fence digest and the case-set freshness check (instruments review I17, I19,
  I20).

### F-4. Node's support windows and today's versions

- Node's schedule (https://raw.githubusercontent.com/nodejs/Release/main/schedule.json, fetched 2026-11-13, as the
  web-versions review read it): v22 ends 2027-04-30; v24 became LTS on 2025-10-28, entered maintenance on 2026-10-20
  and ends 2028-04-30; v26 became LTS on 2026-10-28, enters maintenance on 2027-10-20 and ends 2029-04-30. Node's
  policy: *"Production applications should only use _Active LTS_ or _Maintenance LTS_ releases."*
  (https://nodejs.org/en/about/previous-releases).
- The machine runs 24.11.1. The 24 line's newest is 24.22.3, from the security release of 2026-11-11
  (https://nodejs.org/en/blog/vulnerability/november-2026-security-releases: *"Updates are now available for the 26.x,
  24.x, 22.x Node.js release lines"*). The web-versions reviewer read the advisory as 16 issues, 7 rated high, fixed
  in v22.23.5, v24.22.3 and v26.13.1; that count is the reviewer's summary across the three lines, not a quote.

### F-5. The VS Code chain: VS Code → Electron → Node → Chromium

- From each VS Code tag's `.npmrc` `target=` and Electron's release list (the lead's table,
  `toolchain/vscode-node/vscode-electron-node-npmrc.txt`): 1.122.0 runs Electron 39.8.8 and Node 22.22.1. **1.123.0 is
  the first on Node 24**: Electron 42.3.0, Node 24.15.0. 1.144.0 and 1.145.0 run Electron 43.8.3 and Node 24.22.0.
  The table's next row, 1.146.0, has no value.
- Installed here (measured): VS Code 1.145.3 runs Node 24.22.1, and Devin 1.141.2 runs Node 24.22.0. Both pass 8 of
  8 ES2025 checks.
- No stable Electron runs Node 26 (https://releases.electronjs.org/releases.json, saved by the lead on 2026-11-13).
  The newest stable, 45.3.2 (2026-11-12), runs Node 24.22.2. Node 26.13.0 appears only in pre-releases, from
  2026-11-02: 46.0.0-alpha.5 to alpha.10 (6 alphas, 2026-11-02 to 2026-11-11; alpha.1 to alpha.4 run Node 24.22.1)
  and the 47.0.0 nightlies from 47.0.0-nightly.20261102 to 47.0.0-nightly.20261112 (8 nightlies). That is 14
  pre-releases and no stable release. *This corrects the brief, which named 43.8.3 as the newest Electron; 43.8.3 is
  the newest one a VS Code release ships.*
- At 1.123.0, webviews run Chromium 148: 148.0.7778.180 under Electron 42.3.0 (the `.npmrc` table), or 148.0.7778.97
  under 42.2.0 (the second table, next bullet).
- A second table in the same folder (`vscode-electron-node.txt`) disagrees with the `.npmrc` table. For
  1.123.0-1.127.0 it gives Electron 42.2.0 against 42.3.0, with the same Node 24.15.0. For 1.136.0-1.146.0 it gives
  no Electron and Node 24.18.1 (its lines 28-38), where the `.npmrc` table gives 24.20.0 for 1.139.0, 24.21.0 for
  1.140.0-1.143.0 and 24.22.0 for 1.144.0-1.145.0 (its lines 18-24). So the two disagree on Node for 7 releases. This
  design uses the `.npmrc` table.

### F-6. TypeScript: what 5.9, 6.0 and 7.0 can do for JPWB

- 5.9.3 cannot name ES2025. Asked for it, it answers `TS6046 ... 'es2023', 'es2024', 'esnext'`, and its lib folder
  has no `lib.es2025.d.ts` (the lead's measurement).
- *"TypeScript 6.0 adds support for the `es2025` option for both `target` and `lib`."*
  (https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/). 6.0.3 (2026-04-16) is the last 6.x: *"we do
  not intend to release a TypeScript 6.1"*, and patches cover *"security issues, high-severity regressions"*
  (https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025).
- 7.0.2 has been npm's `latest` since 2026-07-08. *"While TypeScript 7.0 is here, it does not ship with an API."*
  (https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). Its main export holds only `version` and
  `versionMajorMinor` (https://unpkg.com/typescript@7.0.2/lib/version.cjs). Its registry entry also lists
  `./unstable/sync` and `./unstable/async` subpaths (https://registry.npmjs.org/typescript/7.0.2), which no reviewer
  examined. The 7.1 beta (2026-10-20) *"ships a new API"* at `typescript/sync` and `typescript/async`, with an RC *"in
  about a month from now"* (https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/).
- Four tools JPWB uses exclude TypeScript 7 in their newest releases:
  - typescript-eslint *"`>=4.8.4 <6.1.0`"* (https://typescript-eslint.io/users/dependency-versions);
  - svelte-check 4.7.8 `"^5.0.0 || ^6.0.0"`, a range it took in 4.7.4 (https://registry.npmjs.org/svelte-check),
    whose README says *"TypeScript 7 support currently requires the `--tsgo` or `--tsgo-experimental-api` flag. You
    need to install both TypeScript 7 and TypeScript 6."* (https://unpkg.com/svelte-check@4.7.8/README.md);
  - SvelteKit 2.69.2 `"^5.3.3 || ^6.0.0"` and 3.2.0 `"^6.0.0"` (https://registry.npmjs.org/@sveltejs/kit/2.69.2,
    https://registry.npmjs.org/@sveltejs/kit/3.2.0);
  - dependency-cruiser 18.7.2 `"<7.0.0"` (https://registry.npmjs.org/dependency-cruiser).

  At the installed versions, 3 of the 4 exclude 7: typescript-eslint 8.63.0, SvelteKit 2.69.2 and dependency-cruiser
  16.10.4 (`<6.0.0`, F-7). The installed svelte-check 4.7.2 declares `"typescript": ">=5.0.0"`
  (`node_modules/svelte-check/package.json:36-39`; `bun.lock:1130`). Microsoft: *"Projects using Vue, MDX, Astro,
  Svelte, and others will need to continue using TypeScript 6.0 for now."* (the 7.0 announcement above).
- 26 tracked files import the compiler API. This design's `git grep` lists 3 scripts, 19 verif files (3 of them
  non-test modules: `verif/slice-ledger.ts`, `verif/arrow-command-census.ts`, `verif/e2e-harness-imports.ts`) and 4
  app test files, as the inventory review counts. The instruments review splits the same 26 as 3 scripts, 1 verif
  library and 22 test files; this design's listing does not reproduce that split.
- **The dry run** (`toolchain/measure-ts6.ps1`; log `toolchain/ts6/summary.txt`). TypeScript 6.0.3 from the registry,
  its sha512 matching `dist.integrity`, type-checks 16 programs (the 13 that extend `base.json` plus the app's 3) with
  0 errors as they are, and 0 at es2025 (the app at es2025 + dom + dom.iterable). Controls: 5.9.3 at es2025 gives
  `TS6046` twice; 6.0.3 at es2021 gives 49 errors in scripts. **Limit:** the repository's own `import ts from
  'typescript'` still resolved to 5.9.3, so the run says nothing about the 26 compiler-API files, typescript-eslint,
  svelte-check or dependency-cruiser under 6.0, or about 6.0's emitted output.
- 6.0 changes two defaults that could move a build: *"`rootDir` now defaults to `.`"* and *"`types` now defaults to
  `[]`"* (6.0 announcement). 10 of 10 packages set `"rootDir": "src"` (`packages/*/tsconfig.json:5`), and
  `base.json:22` sets `"types": ["node"]`, so neither default reaches them (inference from the configs; emit not
  measured).

### F-7. dependency-cruiser 16.10.4 goes blind under TypeScript 6, and nothing would notice

- `node_modules/dependency-cruiser/src/meta.cjs:15` reads `typescript: ">=2.0.0 <6.0.0",`. With TypeScript out of
  that range, `src/extract/transpile/try-import-available.mjs:30-36` returns `false`, `meta.mjs:39`, `:68` and
  `:127-129` drop `.ts` from the scannable extensions, and `src/config-utl/extract-ts-config.mjs:34` says *"Silently
  fails if a supported version of the typescript compiler isn't available"* (critic F1; re-read in the installed
  package).
- `packages/` holds 420 tracked `.ts` files and 0 `.js` files (`git ls-files`), and `boundary` cruises only
  `packages` (`package.json:19`). So the cruise would reach no package source and still print the green line built
  at `src/report/error.mjs:122-129` (*"no dependency violations found ("*, then `pResults.summary.totalCruised`, then
  *"modules, ..."*) with exit 0. This is read from source, not run.
- No test counts cruised modules. A search for `cruised|totalCruised` in `verif/` and `scripts/` finds 2 lines, both
  in one comment (`verif/product-boundary.test.ts:6`, `:11`). dependency-cruiser first accepts TypeScript `<7.0.0` in
  17.3.9 (2026-03-12; https://registry.npmjs.org/dependency-cruiser), and 18.1.0 adds a run-time warning:
  *"dependency-cruiser now also warns at runtime if it detects typescript is needed, but (a usable version of the)
  typescript compiler isn't present"* (https://github.com/sverweij/dependency-cruiser/releases/tag/v18.1.0).

### F-8. ES2025 runs in Node 24, Bun 1.3.14 and the VS Code hosts, and the level is set in two places

- The lead's probe checks 8 ES2025 items: iterator helpers, `Set.prototype.union`, `Promise.try`, `RegExp.escape`,
  `Float16Array`, `Math.f16round`, RegExp modifiers and duplicate named groups. Node 24.0.0, Node 24.11.1, Bun 1.3.14,
  VS Code 1.145.3 and Devin 1.141.2 pass 8 of 8; Bun passes 10 of 10 in the refuter's wider probe; Node 22.23.5
  passes 2 of 8. The control deletes three built-ins, and the probe then reports each one missing.
- `packages/typescript-config/base.json:11` `"lib": ["ES2022"],` and `:21` `"target": "ES2022",` set the level for
  13 programs. The app uses SvelteKit's generated `lib ["esnext","DOM","DOM.Iterable"]`, `target "esnext"`
  (`apps/rph-demo/.svelte-kit/tsconfig.json`, rewritten on every sync), and `apps/rph-demo/svelte.config.js:7-13` sets
  no `kit.typescript.config`. The app's 3 programs all inherit that generated file: `apps/rph-demo/tsconfig.json:2`
  extends it, and `e2e/tsconfig.json:2` and `tsconfig.vitest-config.json:6` extend that `tsconfig.json`. So one
  `kit.typescript.config` setting reaches all three.
- 28 tsconfig files are tracked (`git ls-files`): these 16 programs; the 10 packages' `tsconfig.build.json`, each
  extending its package's `tsconfig.json` (ES-level review K2); the root `tsconfig.json`, which extends `base.json` and
  builds nothing; and a docs prototype with its own settings
  (`docs/Additional Concepts/Janumi Vision Website Prototype/tsconfig.json`), which this design leaves alone.
- Under 5.9.3, raising ES2022 to ES2024 changed no emitted file: 524 files, 0 differ by sha256. Control: at ES2019,
  22 of 48 rph-engine files differ (the lead's measurement). 6.0.3's emit is not measured.
- `@types/node` 24.13.3 already loads `esnext.disposable` and `esnext.float16` into every base program
  (`node_modules/@types/node/index.d.ts:28-30`), so some post-ES2022 built-ins type-check today (ES-level critic).
- The raise touches four texts that state ES2022: `scripts/tsconfig.json:8-9`, `scripts/mutants/run.ts:1016`,
  `apps/rph-demo/e2e-live-exec/phase7-operator.ts:970` and the roadmap's `:69`. It does not touch the five
  `ts.ScriptTarget.ES2022` parser literals, which choose an AST parse, not a lib level: `verif/slice-ledger.ts:197`,
  `verif/arrow-command-census.ts:664` and `:885`, `verif/arrow-command-census.test.ts:194` and
  `verif/agy-stderr-unbound.test.ts:362`. The last is the find text of mutants P2B-ah and P2B-ai
  (`scripts/mutants/ledger.ts:8214`, `:8225`).
- The raise lets the 11 open S7750 `findLast` fixes land. 3 of the 11 sit inside live mutant anchors:
  `packages/rph-ports/src/ports/process-runner.ts:252` (P2B-a, `ledger.ts:7881`), `scripts/phase7/half-b.ts:453`
  (E3-M21, `:28374`) and `scripts/phase7/run-report-core.ts:3132` (P6X-M-M15, `:37254`). At
  `scripts/reviewer-qual/run.ts:276`, `findLast` would stop rejecting a results file that has a `null` line before
  the last SELECTION (refuter, K15).

### F-9. The browser runs package code, and no floor is declared

- `apps/rph-demo/vite.config.ts:23` puts `'source'` first in `resolve.conditions`, so the browser gets package source:
  53 modules from 5 packages, all reached from `routes/pwa/[id]/+page.svelte` — rph-projections 20, rph-domain 19,
  rph-contracts 10, rph-authoring (`./catalog`) 1, rph-application (`./execution-invocation`) 3 (ES-level sites
  review).
- 0 of 13 manifests has a browserslist entry, and `vite.config.ts` sets no `build.target` (this design's grep). Vite
  7.3.6's default therefore applies: *"Specifically, it is `['chrome107', 'edge107', 'firefox104', 'safari16']`."*
  (https://raw.githubusercontent.com/vitejs/vite/v7.3.6/docs/config/build-options.md, line 11; ES-level facts review).
- The page already needs Chrome/Edge 119, Firefox 121 or Safari 17.4, because @xyflow/svelte 1.6.2 calls
  `Promise.withResolvers()` (`node_modules/@xyflow/svelte/dist/lib/store/index.js:80`; MDN BCD 8.1.9).
- First browser versions with each ES2025 item, Chrome / Edge / Firefox / Safari (MDN BCD 8.1.9,
  https://unpkg.com/@mdn/browser-compat-data@8.1.9/data.json, read from the reviewers' saved copy):
  - `RegExp.escape` 136 / 136 / 134 / 18.2; `Promise.try` 128 / 128 / 134 / 18.2; `Float16Array` 135 / 135 / 129 / 18.2;
  - `Iterator.prototype.map` 122 / 122 / 131 / 18.4; `Set.prototype.union` 122 / 122 / 127 / 17;
  - RegExp modifiers 125 / 125 / 132 / 26; duplicate named groups 125 / 125 / 129 / 17;
  - import attributes, including `type: 'json'`: 123 / 123 / 138 / 17.2. TC39 lists Import Attributes and JSON
    Modules under 2025 (https://raw.githubusercontent.com/tc39/proposals/main/finished-proposals.md, lines 26-27 of
    the copy saved at `sonar6/eslevel/wf/external-facts/dl-tc39/`); the lead's probe did not cover them;
  - `Intl.DurationFormat`, which TypeScript's es2025 lib declares (`lib.es2025.d.ts` references `es2025.intl`, read
    in the ES-level review's saved copy of TypeScript 6.0.2): 129 / 129 / 136 / 16.4.
- So the items checked here — 9 of TC39's 10 proposals for 2025 (the tenth is in §8), plus `Intl.DurationFormat` —
  need Chrome 136 (2025-04-29), Edge 136 (2025-05-01), Firefox 138 (2025-04-29) and Safari 26 (2025-09-15). Today's
  releases are Chrome 157, Edge 157, Firefox 160 and Safari 27.2 (BCD 8.1.9 "current").
- No JPWB source uses an import attribute today: 0 files under `packages/*/src` and `apps/*/src` match `with { type:`
  or `assert { type:`, and 0 import a `.json` file (this design's `git grep`).
- Firefox ESR 115 still gets updates, but only on old systems: *"We have decided to extend support to ESR 115 only on
  Windows 7-8.1 and macOS 10.12-10.14 up to March 2027"*, and its branch ends 2027-04-06
  (https://whattrainisitnow.com/release/?version=esr). It has none of the items above; the lowest needs Firefox 127.
  ESR 153 (2026-07-21) is above every version listed here.

### F-10. Turbo can replay a cached result after a runtime upgrade

- `turbo.json:5-18` caches `build`, `check-types`, `lint` and `test` and declares no `globalDependencies` or
  `globalEnv`. Turborepo's documented hash inputs name no runtime, OS or tool version
  (https://turborepo.dev/docs/crafting-your-repository/caching; critic F3).
- `turbo run test` runs one suite, the app's `vitest run --passWithNoTests` (`apps/rph-demo/package.json:13`): 0 of the
  11 manifests under `packages/` declares a `test` script (this design's grep). That suite is the only one that loads
  the SvelteKit plugin, so after a Node, Bun or Edge upgrade with no lock change it can come from the cache.
  `test:dist` and `test:coverage` run vitest outside turbo.

### F-11. Upgrades move instruments, some loudly and some silently

- The instruments review lists 35 instruments an upgrade can move. **Ordinary** re-baselines run in the same commit
  with no ruling: `bun run gen`, `coverage:floor`, `guards:export`, `slices:ledger`, and ledger re-anchoring.
  **Governed** ones need a ruling: the reviewer fingerprint (REG-D-146, REG-D-149, REG-D-153), the Ollama identity
  (REG-F-608), the fence digest (REG-F-481, REG-D-013), the Pi pins (REG-D-114 (19)) and a ledger `abolishedBy`, which
  must name an existing REG-D ruling (`verif/mutant-ledger.test.ts:131`).
- Tool output that instruments pin: prettier (`gen:check`, I01) and zod (120 committed JSON Schemas, I02) byte for
  byte; vitest and @vitest/coverage-v8 by count, through the global coverage thresholds (I04) and the per-file
  uncovered-count floor (I05), which the instruments review lists as ratchets, not byte pins. @vitest/coverage-v8
  peers vitest exactly (`"vitest": "4.1.10"`, `bun.lock:626`).
- One instrument the review missed (critic G14): the seeded faults. `scripts/phase7/seeded-faults.ts:395` finds
  mutation sites with `ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)`, and `:618`
  checks each mutant with `node --check`, so TypeScript and Node upgrades can move it. The critic rates it low risk.
- Some would not turn red (instruments review): timeout markers read from free text (I15); the Bun `spawnSync` tuning
  (I16); a fall in the per-file floor, which passes unrecorded (I05, REG-F-586); the keep-alive plugin becoming a
  no-op (I22); turbo replay (I30); Edge and Ollama updating themselves (I25, I18); the CI file that never runs (I31).
- Precedents: vitest 4 removed `--reporter=basic`, and a mutation harness then reported nothing (REG-005 `:571`,
  `:35140`); the Ollama server updated itself and the scores changed (REG-F-608).

### F-12. Machine-installed tools decide behaviour outside the lock

- e2e runs the system Edge: 3 of 3 Playwright configs set `channel: 'msedge'` (`apps/rph-demo/playwright.config.ts:55`,
  `playwright.live.config.ts:40`, `playwright.live-exec.config.ts:103`). The machine has Edge 157.0.4341.42 with
  157.0.4341.46 staged (instruments review I25). Playwright 1.61.1's own browser, Chromium 149.0.7827.55
  (`node_modules/playwright-core/browsers.json:6-8`), is not used; its revision 1228 is already in this machine's
  Playwright cache (inventory review).
- **The search for `msedge` the brief asked for.** Terms `msedge`, `system Edge`, `Edge (Chromium)` and
  `bundled Chromium`, case-insensitive, over `docs/` in this worktree (the register included) and over the main
  checkout's register. It found one recorded reason for Edge: *"The browser is the SYSTEM Edge (Chromium) via
  `channel`, so no Playwright browser download is required."* (`playwright.config.ts:13`), echoed by commit `473b0f06`
  (2026-07-13): *"system-Edge channel (no browser download)"*. The register has 1 hit, REG-F-263 (REG-005
  `:22285-22287`, OPEN), which quotes that line and adds *"On `runs-on: ubuntu-latest` (`ci.yml:11`) there is no
  system Edge"*; the main checkout's register gives the same single hit. `msedge` has 5 more hits in the docs: four
  'Runtime identity' rows reading *"Vitest + Playwright (msedge, `RPH_DEMO_MODE=test`)"* (JAN-EXECPLAN-DR-001 to
  DR-004) and one gate list, *"Playwright (msedge)"* (JAN-PWADESIGNER-DS-001 `:114`). `system Edge` adds runtime rows
  of the same kind (for example JAN-PRPWA-DR-001 `:18`, JAN-PWADESIGNER-DR-001 `:19`, JAN-W0-DR-001 `:32`) and an
  inventory line (JAN-CSAA-005 `:1098`). None of them gives a reason. The search found no ruling that chose Edge; a
  ruling worded differently could exist.
- Other machine tools (inventory review): SonarLint 6.3.0 with its bundled JRE 21.0.12.1, and Java on PATH (Temurin
  21.0.7); the devin CLI 3000.11.234, self-updating; Ollama 0.40.16, accepted beside the recorded 0.40.15 under
  REG-D-152; git 2.53.0.windows.1; Python 3.14.0; the pi CLI 1.4.0, beside the in-process SDK 0.80.6.

### F-13. Registry facts the method must handle

- ESLint 9 reached end of life on 2026-08-06 (https://eslint.org/version-support/), and npm marks 58 of 58 eslint 9.x
  versions deprecated, 9.39.5 with *"This version is no longer supported."* (https://registry.npmjs.org/eslint;
  web-versions review).
- Two deprecated versions the review must skip:
  - @eslint/js 10.0.0, published 2024-07-26: *"This version should not be used."* The newest is 10.0.1
    (https://registry.npmjs.org/@eslint/js).
  - elkjs 0.13.0, published 2026-10-28 and since deprecated (*"this package has been deprecated"*), with `latest` left
    on 0.12.1. It is elkjs's highest version, so a tool that takes the highest version would pick it (npm registry,
    per the web-versions review; its row names no URL).
- pi-coding-agent puts breaking changes in patch releases: 11 "Breaking Changes" sections after 0.80.6, 5 of them in
  patches — 0.80.7, 0.80.8, 0.84.3, 1.0.3, 1.5.1
  (https://unpkg.com/@earendil-works/pi-coding-agent@1.5.2/CHANGELOG.md). typebox must equal Pi's exact pin
  (`bun.lock:258`, `:260`, `:262`: `"typebox": "1.1.38"`).
- Playwright lists *Breaking Changes* in minor release 1.65, and the web-versions review quotes changes of the same
  kind in 1.64 (*"JSX in your test files now follows your tsconfig.json."*) and 1.63 (*"Ubuntu 20.04 is not supported
  anymore."*) (https://playwright.dev/docs/release-notes).
- Bun 1.3.14 already has `bun outdated` (its docs list no JSON output), `bun update -i/--latest`, `bun audit` (exit 1
  on vulnerabilities) and `install.minimumReleaseAge`, which Bun 1.3 introduced (*"requiring packages to be published
  for a minimum time before installation"*, https://bun.com/blog/bun-v1.3). The current docs say *"Configure a minimum
  age (in seconds) for npm package versions."* and also list `install.minimumReleaseAgeExcludes`
  (https://bun.com/docs/runtime/bunfig). Those docs describe current Bun, 1.4.x (critic C6, G20), so the seconds unit
  and the excludes setting are not established for 1.3.14. `bun audit fix` needs 1.4.
- endoflife.date's product list (API v1, generated 2026-11-13) tracks nodejs, bun, svelte, eslint, sqlite,
  sonarqube-community, sonarqube-server, electron, chrome, firefox, eclipse-temurin, git and python. It does not list
  typescript, sveltekit, vite, vitest, playwright, prettier, turborepo or zod (the drafter's check of the saved list,
  names and aliases).
- Renovate's local dry run needs node `"^24.11.0 || ^26.13.0"` (https://registry.npmjs.org/renovate);
  npm-check-updates 23 needs `"^22.22.2 || ^24.15.0 || >=26.0.0"` (https://registry.npmjs.org/npm-check-updates).

### F-14. The Svelte/Vite chain is split today

- The app runs vite 7.3.6 (`bun.lock:1182`). vitest 4.1.10 brings its own vite 8.1.4 (`bun.lock:1258`), and the app's
  own vitest run merges the `sveltekit()` plugin into it (`apps/rph-demo/vitest.config.ts:15-19`). But
  vite-plugin-svelte 6.2.4 declares vite `"^6.3.0 || ^7.0.0"` only (`bun.lock:558`).
- SvelteKit 2.69.2 already admits vite 8, TypeScript 6 and vite-plugin-svelte 7: its peers read `vite "... ||
  ^8.0.0"`, `typescript "^5.3.3 || ^6.0.0"`, `vite-plugin-svelte "... || ^7.0.0"` (`bun.lock:554`;
  https://registry.npmjs.org/@sveltejs/kit/2.69.2). The binding constraint is vite-plugin-svelte 6.x. *This
  qualifies the brief, which credits 2.70.x with accepting them.*
- SvelteKit 3 (2026-10-01) needs *"Node v22.17"*, *"Svelte v5.57.1"*, *"Vite v8.0.12"*, *"TypeScript v6"* and
  *"`@sveltejs/vite-plugin-svelte` v7"*, and adapter-auto 8. Its guide says *"We recommend upgrading to the most
  recent 2.x version before upgrading to 3.0"* (https://svelte.dev/docs/kit/migrating-to-sveltekit-3). The newest 2.x
  is 2.70.4 (2026-11-05).

### F-15. Bun 1.4 is a different program

- From its announcement (https://bun.com/blog/bun-v1.4, 2026-08-20): *"And it rewrites Bun from Zig to Rust."*;
  *"`bun update` now updates the dependencies of your dependencies too"*; *"New lockfiles use version 2"*; *"Lockfiles
  written as v0/v1 keep loading without these checks. Existing projects do not break."*; *"Lockfiles that use nested
  or version-scoped overrides are `lockfileVersion: 3`. Older Bun cannot read version 3."*; *"Bun now reports Node.js
  26"*; *"`process.versions.modules` is now `147`."* None of this was measured here. JPWB declares no overrides (0
  hits for `overrides`, `resolutions` or `patchedDependencies` in its 13 manifests and `bun.lock`).
- 1.3.14 is the last 1.3.x. Bun's security policy lists only `1.x.x`, with no backport statement
  (https://github.com/oven-sh/bun/security/policy). The platform builds on `oven/bun:1.3.14`
  (`E:/Projects/hestami-ai/janumi/apps/control-plane/Dockerfile:15`) and runs on `oven/bun:1.3.14-slim` (`:38`).
  JPWB's lock is `"lockfileVersion": 1`, `"configVersion": 1` (`bun.lock:2-3`).

---

## 4. Decisions

### D-1 (SPONSOR RULING). Node: floor 24.15.0, day to day 24.22.3, not 26

- **Question.** Which Node does JPWB require, and which does it run?
- **Ruling (R1, 2026-11-13).** *"I think we should update to Node 24 (or higher if compatible) to keep node and bun
  in as close as sync as possible in terms of minimizing compatibility and behavior differences. We do want to have a
  VS Code extension built so that is a compatibility matrix factor as well. I think we should also update to
  Typescript 6.0+ as well assuming that that is tracking the node and bun runtimes which should allow us to update to
  ES2025. The other corrections you mentioned are agreeable as well."*
- **Options.** (a) keep `>=22`; (b) `>=24.0.0`; (c) `>=24.15.0`; (d) Node 26.
- **Choice: (c).** `engines.node` becomes `">=24.15.0"`. The day-to-day version is the newest 24.x patch, today
  24.22.3, recorded in a committed `.node-version`. That file is the one record of it: the matrix's day-to-day field
  is generated from it, and `toolchain:check` asserts they agree (D-7, D-9). No version manager is on this machine's
  PATH (critic G10), so `.node-version` is a record that `toolchain:check` reads, not a switch. Node 26 gets a matrix
  row "candidate; blocked by VS Code/Electron", re-checked at every monthly review.
- **Why 24.15.0 rather than 24.0.0.**
  - VS Code 1.123.0 is the first release on Node 24, and it ships 24.15.0 (F-5). That is the extension's floor (D-2).
  - It is above what the gate itself needs: 24.6.0 for `keepAliveTimeoutBuffer` (F-2).
  - It satisfies each of these 13 engine ranges, among those the reviews read: pi-* `>=22.19.0`; vite 7 and 8
    `^20.19.0 || >=22.12.0`; vite-plugin-svelte 6.2.4 `^20.19 || ^22.12 || >=24`; vitest 4 `^20.0.0 || ^22.0.0 ||
    >=24.0.0`; better-sqlite3 12.11.1 `... 24.x ...`; dependency-cruiser 18 `^22||^24||>=26`; SvelteKit 3 `>=22.17`;
    ESLint 10 `^20.19.0 || ^22.13.0 || >=24`; Playwright 1.61.1 `>=18`; the SonarJS bridge `^22.12.0 || ^24.0.0 ||
    ^26.0.0`; @sonar/scan `>=22.12.0`; Renovate `^24.11.0 || ^26.13.0`; npm-check-updates 23 `^24.15.0` on the 24 line.
- **Why not 26, although the ruling says "higher if compatible".** No VS Code release up to 1.145 and no stable
  Electron runs Node 26 (F-5). Bun 1.3.14 reports Node 24 (F-3). Nothing has been tested on 26.
- **Why not stay on 22.** Node 22 support ends 2027-04-30, and Node 22.23.5 passes 2 of 8 ES2025 checks (F-4, F-8).
- **The sponsor's "in sync" goal.** On 24, Node (24.22.3) and Bun (reporting 24.3.0) share a major. Bun's reported
  version is a compatibility claim, not a Node build: the Unicode and `String.raw` differences of F-3 remain, and the
  three byte-for-byte instruments keep checking them.
- **Cost.** Node 24 has been in Maintenance LTS since 2026-10-20 and ends 2028-04-30, a year before Node 26
  (2029-04-30). The machine's Node, 24.11.1, is below the new floor, so it must move before T1a lands (D-13).

### D-2 (SPONSOR RULING). The planned VS Code extension is a matrix factor

- **Question.** How does an extension that does not exist yet constrain versions now?
- **Ruling (R1).** *"We do want to have a VS Code extension built so that is a compatibility matrix factor as well."*
- **Options.** (a) ignore it until it is built; (b) record its version chain now and set its floor when its manifest
  exists.
- **Choice: (b).** The matrix carries a VS Code coupling group, one chain of rows: VS Code version → Electron → Node in
  the extension host → Chromium for webviews. `engines.vscode` becomes `">=1.123.0"` when the extension's manifest
  exists. Forks are recorded as observed versions: Devin 1.141.2 runs Node 24.22.0; VS Code 1.145.3 runs 24.22.1.
- **Why.** The extension host's Node is the runtime of the planned LOCAL tier, *"a Visual Studio Code extension
  host"* (`docs/_working/DESIGN-undertaking-execution-sandbox.md:396`). At 1.123.0 its webviews run Chromium 148,
  above the browser floor of D-6 (F-5).
- **Left open for the extension's own design: the native addon.** The installed better-sqlite3 12.11.1 targets Node
  24's ABI 137 and does not load under Bun (`packages/rph-persistence/src/sql-driver.ts:49-53`, *"better-sqlite3 is a
  Node native addon; bun#4290"*). Inside Electron it must match Electron's ABI. better-sqlite3 13 moved to N-API:
  *"prebuilt binaries should theoretically work across different versions of Node.js and Electron"*
  (https://github.com/WiseLibs/better-sqlite3/releases/tag/v13.0.0). The alternative, `node:sqlite`, is experimental
  (critic C2) and already imported by `scripts/phase7/run-archive.ts:60`, `verif/phase7-run-archive.test.ts:27` and
  `verif/phase7-half-b.test.ts:23`. This design does not decide it.

### D-3 (SPONSOR RULING). TypeScript 6.0.3, exact; not 7

- **Question.** Which TypeScript, and pinned how?
- **Ruling (R1).** *"I think we should also update to Typescript 6.0+ as well assuming that that is tracking the node
  and bun runtimes which should allow us to update to ES2025."*
- **Options.** (a) stay on 5.9.3; (b) 6.0.3 exact; (c) 7.0.2, npm's `latest`; (d) 6 and 7 side by side through the
  `@typescript/typescript6` alias.
- **Choice: (b).** The pin rule is **"latest compatible", never "latest"**. Taking `latest` blindly would install
  7.0.2 and break everything F-6 lists. The matrix records TypeScript 7 as "candidate; blocked by: no stable API (7.1
  pending), typescript-eslint `<6.1.0`, SvelteKit `^5.3.3 || ^6.0.0` (3.x `^6.0.0`), dependency-cruiser `<7.0.0`,
  svelte-check `^5.0.0 || ^6.0.0` from 4.7.4 (TypeScript 7 only through `--tsgo`), 26 compiler-API files".
- **Why not (c) or (d).** 7.0 has no programmatic API, and 3 of the 4 tools checked exclude it at their installed
  versions, all 4 at their newest (F-6). (d) adds a second compiler that no tool here needs yet; svelte-check's
  `--tsgo` route needs both installed.
- **What "tracking the runtimes" means here.** TypeScript follows the yearly ECMAScript editions, not Node or Bun
  directly. 6.0 is the first version that can name ES2025 (F-6), and Node 24 and Bun 1.3.14 implement it (F-8). So
  the sponsor's assumption holds in this sense: the runtimes already run ES2025, and 6.0 is the first TypeScript that
  can say so.
- **Support.** 6.0.3 is the last 6.x; no 6.1 is planned, and patches are limited to security issues and severe
  regressions (F-6). No end date for 6.x support was found (web-versions review).

### D-4 (LEAD DECISION, a prerequisite of D-3). dependency-cruiser before TypeScript, and a population guard

- **Question.** What must land before TypeScript 6 can?
- **Options.** (a) move both together; (b) dependency-cruiser first; (c) TypeScript first.
- **Choice: (b), plus a guard.** dependency-cruiser moves to `>=17.3.9` (today 18.x) before TypeScript moves. The
  boundary step gains a population guard: the number of package modules cruised must equal an independent census, and
  0 always fails.
- **Why.** Under (a) or (c), a green `boundary` would prove nothing (F-7). The guard is what makes the next upgrade of
  either tool visible.
- **Where the guard sits.** Its own `gate:fast` step or part of the `boundary` script; the roadmap chooses. Either
  choice changes a pinned judgment, which T0 re-baselines with its reason (§6): a new step changes the composition pin
  (`verif/assurance-surface.test.ts:220`), and a longer `boundary` script changes its exact pin (`:269`).
- **A detail for the roadmap (drafter's inference).** The one recorded cruise count cannot be compared with today's
  420 package `.ts` files. The probe that printed *"867 modules, 4705 dependencies cruised"*
  (`verif/product-boundary.test.ts:11`) ran when that file was written, committed on 2026-09-11 (`48784248`). At that
  commit `packages/` held 854 tracked `.ts` files (478 in `packages/csaa`, removed on 2026-09-12 by `91e76aea`) and 3
  `.js`/`.mjs`/`.cjs` files. Whether `totalCruised` also counts modules outside package source is not established. So
  the guard should count cruised modules under `packages/` from dependency-cruiser's JSON output, and the census
  should be the tracked package source the config does not exclude. The exact rule is for the roadmap.

### D-5 (SPONSOR RULING). ES2025 for both lib and target, everywhere

- **Question.** Which language level, and set where?
- **Ruling (R1).** *"... which should allow us to update to ES2025. The other corrections you mentioned are agreeable
  as well."* The corrections accepted (the lead's ES-level report): (1) the app is pinned to the same level through
  `kit.typescript.config`; (2) `@types/node` matches the Node floor; (3) the 3 anchored S7750 sites are re-anchored in
  the same commit; (4) `scripts/reviewer-qual/run.ts:276` gets a guard; (5) there is no "raise the platform's base"
  decision, because the platform's ES2022 `base.json` is an unused create-turbo template copy that none of its 6
  tsconfigs extends; (6) the 4 ES2022 texts are restated and the 5 parser literals stay.
- **Options.** (a) ES2024, the most 5.9.3 can name; (b) ES2025 with TypeScript 6; (c) esnext.
- **Choice: (b).**
  - `base.json:11` and `:21` become ES2025 (13 programs).
  - The app gets lib ES2025 + DOM + DOM.Iterable and target ES2025 through `kit.typescript.config` in
    `apps/rph-demo/svelte.config.js`, because the generated tsconfig is rewritten on every sync.
  - `@types/node` is pinned exactly, at a release no newer than the floor (D-8).
  - The 5 parser literals stay (F-8).
- **Why not esnext.** It moves when TypeScript is upgraded: *"The special `ESNext` value refers to the highest
  version your version of TypeScript supports."*
  (https://raw.githubusercontent.com/microsoft/TypeScript-Website/v2/packages/tsconfig-reference/copy/en/options/target.md,
  lines 17-18; ES-level review K6). That is why the app is pinned too.
- **One level only.** The platform's spec corpus holds a staged overlay for JPWB, *"merge-ready overlay; not applied"*
  (`E:/Projects/hestami-ai/janumi/docs/JPSpecs/Janumi_Product_Provider_Assurance_Contract_Corpus_v0_16/23-wave-10-repository-adoption/integration/janumiprofessionalworkbench/README.md:4`).
  Its script copies a `tsconfig.json` into the new package (`scripts/apply-overlay.mjs:48`), and the corpus's
  `23-wave-10-repository-adoption/tsconfig.json` sets `"target": "ES2023"` (`:3`) and `"lib": ["ES2023"]` (`:17`),
  with no `extends` (ES-level critic; re-read here). If the overlay is ever applied, its package's tsconfig extends
  JPWB's `base.json` instead.
- **Evidence.** F-8 (runtimes 8 of 8; emit unchanged ES2022 → ES2024 under 5.9.3) and F-6 (0 errors in 16 programs at
  es2025 under 6.0.3). The 6.0.3 emit is not yet measured (§8).

### D-6 (LEAD DECISION; RULED by the sponsor 2026-11-13, QT1: *"agree as fully recommended"*). A declared browser floor

- **Question.** Which browsers must the PWA page support?
- **Options.** (a) leave it undeclared, so Vite's default `chrome107/edge107/firefox104/safari16` stands; (b) the
  floor the page already needs, Chrome/Edge 119, Firefox 121, Safari 17.4; (c) the first versions with all of ES2025:
  Chrome/Edge 136, Firefox 138, Safari 26.
- **Choice: (c),** recorded in the matrix and as Vite's `build.target` (QT1, ruled 2026-11-13).
- **Why.** (a) misstates today's need: the page already needs Chrome/Edge 119 (F-9). (b) would break silently once
  package code uses ES2025, because Vite lowers syntax to `build.target` but does not polyfill built-ins (Oxc: *"You
  will need to use a polyfill together to support older browsers."*,
  https://oxc.rs/docs/guide/usage/transformer/lowering; ES-level facts review). (c) makes the lib level and the
  browser floor say the same thing. All four versions shipped in 2025; Chrome and Edge are now at 157, 21 releases
  later (F-9).
- **The Firefox number.** 138 counts import attributes, which TC39 lists under 2025 (F-9). Counting only what
  TypeScript's es2025 lib declares gives 136 (`Intl.DurationFormat`). The brief's earlier 134 counted only the 8
  probed built-ins. Not checked: whether an import attribute can ever reach the browser. No JPWB source uses one today
  (F-9), and if Vite resolves JSON imports itself in dev and build (inference), the page never needs them. This design
  writes 138, by the brief's rule "the versions that have all of ES2025"; the lead confirms the number before §0 goes
  to the sponsor (§8 item 2).
- **Cost.** Firefox ESR 115 users are excluded; ESR 153 is included (F-9).
- **Limit.** Only syntax lowering is enforced by a tool. Built-in use is held by the ES2025 lib, which the floor
  covers by construction. No test runs the page on the floor browsers (§8).

### D-7 (LEAD DECISION). The configuration item is the lockfile plus a committed compatibility matrix

- **Question.** What is the record of truth for versions?
- **Options.** (a) `bun.lock` alone; (b) `bun.lock` and the manifests; (c) `bun.lock` plus a committed,
  machine-readable matrix and a human page.
- **Choice: (c).** The lead proposes the place: `scripts/toolchain/matrix.json`, plus a section in a new
  `docs/operations/toolchain.md`.
- **Each row records:** the component and its coupling group; the declared range and the lock-resolved version; the
  pin style; the floor and the day-to-day version; what it was tested on; the support window or end of life; its
  upgrade blockers; the instruments it moves; the platform's and janumicode_v2's versions.
- **Who writes what: three kinds of field.**
  - **Generated** by a script: the declared range and the lock-resolved version, with nested copies listed per row
    (vite 7.3.6 at `bun.lock:1182` and `vitest/vite` 8.1.4 at `:1258`); and the day-to-day Node, read from
    `.node-version`.
  - **Observed**: versions read from the machine (the running Node and Bun, the Edge major, SonarLint, Java, the
    agent CLIs, the Ollama server) and from the platform and janumicode_v2, with what each component was tested on
    and its support window. When `toolchain:check` reports drift, whoever ran it records the new observed version
    with its date.
  - **Hand-written**: the coupling group, the floor, the pin style, the blockers, the instruments it moves, and the
    reason for each. These are the judgments `toolchain:check` enforces; I7 says which changes to them need separate
    authority.
- **Coupling groups**, from the inventory, by name: Svelte/Vite; vitest; lint; TypeScript; Node/native; Pi SDK; e2e;
  graph layout; xstate; codegen (zod and prettier); the Sonar runner; agent CLIs; VS Code (new). The inventory also
  labels G0 runtimes (Bun), G12 host tools (git, python, OS tools), G14 CI, G15 data pins (the fence skeleton's
  Unicode data) and G16 model configuration, and calls turbo, ulid and fast-check standalone. Here runtimes and host
  tools become matrix rows (D-1, D-8), and Appendix A's "runtime" and "standalone" come from those labels. When
  `JAN-SONARCM` S2 lands, eslint-plugin-sonarjs, eslint-plugin-unicorn and eslint-plugin-import join the lint group
  (D-13).
- **Why.** `bun.lock` records no runtime, no machine tool, no floor and no reason (F-1, F-2, F-12).

### D-8 (LEAD DECISION). Pin rules

- **Question.** How is each component pinned?
- **Options.** (a) caret ranges everywhere, with `bun.lock` as the record; (b) exact pins everywhere; (c) a pin style
  by kind, as in the table.
- **Choice: (c).**

| Component | Pin | Why |
| --- | --- | --- |
| Runtimes | Node: the floor in `engines`, plus the exact day-to-day version in `.node-version`. Bun: exact. | Bun reads none of `packageManager`, `engines` or `devEngines` (F-2), so `toolchain:check` enforces both (D-9). |
| The compiler | Exact. | F-6. |
| `@types/node` | Exact, at the newest 24.x types release whose minor is not above the floor's (24.15); the roadmap checks which releases exist. Today's 24.13.3 qualifies. | A caret range (`package.json:47` `"^24.0.0"`) lets `bun update` take 24.19.2, which may describe APIs above the floor; accepted correction 2 says the types match the floor (D-5). |
| Packages that put breaking changes in patch or minor releases | Exact, with a changelog read on every bump. | pi-coding-agent in patches: 0.80.7, 0.80.8, 0.84.3, 1.0.3 and 1.5.1 (F-13). typebox must equal Pi's pin. Playwright in minors (F-13). |
| Tools whose output an instrument pins, byte for byte or by count | Exact: prettier (`gen:check`), zod (the committed JSON Schemas), vitest and @vitest/coverage-v8 (the coverage thresholds and the per-file floor). | F-11. |
| A dependency that is exact today | Stays exact until a decision loosens it; the roadmap records its reason, or that none was found. Today: @dagrejs/dagre, @statelyai/graph, @xstate/svelte, elkjs and xstate (`apps/rph-demo/package.json:22`, `:32`, `:33`, `:35`, `:38`) and fast-check (`packages/rph-domain/package.json:34`). | Loosening a pin weakens a judgment (I7). elkjs, for one, is tied to 0.11's entry layout (`apps/rph-demo/vite.config.ts:19-22`). |
| Everything else | Caret ranges, with `bun.lock` as the configuration item (`bun install --frozen-lockfile`). | F-1. |

- **Why (c).** Both failure kinds are on record: breaking changes in patch and minor releases (F-13), and tool output
  that instruments pin (F-11). Elsewhere an exact pin adds update work for no measured gain, and the lock already
  records the installed version (I4).
- **Machine-installed tools that decide behaviour** get matrix rows with their observed versions: the system Edge
  157.0.4341.42, the only e2e browser, which updates itself; the SonarLint extension 6.3.0, its JRE 21.0.12.1, and
  Java on PATH (Temurin 21.0.7); the devin CLI 3000.11.234, self-updating; the Ollama server 0.40.16, which updates
  itself and is governed by REG-D-152; git and Python; the pi CLI 1.4.0 (F-12).
- **Registry hygiene.** Skip versions npm marks deprecated; @eslint/js 10.0.0 and elkjs 0.13.0 are live examples
  (F-13). Use a release-age cooldown of about 7 days: Bun's `install.minimumReleaseAge` exists from Bun 1.3, and the
  current docs give it in seconds, so 604800 (F-13); §7 shows it on 1.3.14 before anything relies on it.
- **A cooldown detail (drafter's inference).** A 7-day cooldown would also hold back a security fix released this
  week. The security trigger of D-10 therefore names the package in `install.minimumReleaseAgeExcludes` for that
  install and records it in the review report. Not checked: whether Bun 1.3.14 has that setting; the page that names
  it documents current Bun, 1.4.x (critic C6, G20). The first package shows it in scratch (§7); if 1.3.14 lacks it,
  the roadmap chooses another way and records it.

### D-9 (LEAD DECISION). Enforce the pins in the gate: `toolchain:check`

- **Question.** What makes a stated pin true on the machine that runs the gate?
- **Options.** (a) documentation only; (b) a check inside an existing step; (c) a new first `gate:fast` step.
- **Choice: (c).** `toolchain:check` runs first. It fails on any of eight conditions:
  1. **Runtimes:** the running Node (`node --version` on PATH, the Node the tool bins start with) differs from the
     day-to-day version, or from the floor in the declared floor-lane mode; or the running Bun differs from the
     matrix's exact version. The check itself runs under Bun, whose `process.version` reads `v24.3.0` (F-3), so it
     must ask the Node on PATH.
  2. **Installed tree and lock:** for a matrix component, the installed version
     (`node_modules/<package>/package.json`), the `bun.lock` version and the matrix disagree, nested copies included.
     `gate:fast` runs no install (`package.json:27`), so `node_modules` can drift from `bun.lock`.
  3. **Manifests:** a manifest disagrees with the matrix: a declared range, a pin style, `engines.node` (`">="` plus
     the floor) or `devEngines`' Bun.
  4. **Peers:** a declared peer range is violated (for example TypeScript inside typescript-eslint's and
     dependency-cruiser's ranges, I5).
  5. **Cross-row rules:** the VS Code floor's Node is below the Node floor, or the day-to-day Node is below the floor.
  6. **Browser floor:** Vite's `build.target` differs from the matrix's browser floor (the roadmap chooses how:
     `vite.config.ts` reading the floor from the matrix file, or the check reading the config).
  7. **Machine tools:** a machine tool that decides gate behaviour drifted: the Edge major and the SonarLint version,
     found through the committed machine-path config of `JAN-SONARCM` S1 (D-13).
  8. **Empty population:** the matrix or the lock is empty or unreadable, or the lock holds no matrix component (I6).
- **Why (c) over (b).** A first step fails in seconds, before any step uses the runtime and before any cached step
  (F-10). Inside an existing step it would run after earlier steps had already measured on an unrecorded runtime.
- **`turbo.json` adds `globalDependencies`** on the matrix file and `.node-version`, so a runtime change also changes
  turbo's hash (F-10). With `toolchain:check` first, the gate never reaches a cached step on a runtime the matrix does
  not record.
- **Which runtime runs which step.** The matrix records it per gate step (instruments review). `toolchain:check` reads
  each step's command and the bin it starts (10 of 10 bins checked start `#!/usr/bin/env node`, F-3), so a step that
  names Bun where the matrix records Node fails; and condition 1 fails if `node` on PATH were Bun, which reports
  `v24.3.0`.
  `verif/fence-skeleton-determinism.test.ts:39` stays the in-process witness for vitest. The three contrary comments
  of F-3 are corrected.
- **Two details for the roadmap (drafter's inference).**
  - The floor lane (D-11) needs the declared floor-lane mode of condition 1. Without it, the floor lane fails at
    step 1.
  - SonarLint decides no `gate:fast` step today. Checking it here keeps one place that checks every matrix row, at the
    cost of stopping `gate:fast` for a tool it does not run; `JAN-SONARCM`'s runner checks it again at run time.
- **Authority.** Like the rest of `gate:fast`, this check runs on the operator's machine. Under DOC-004 §7.6 that is
  *"developer convenience — valuable, and never the guarantee"*; it is filed as an interim carrier (REG-D-012 (3))
  when this lands.

### D-10 (LEAD DECISION). Cadence and triggers

- **Question.** How often is currency reviewed, and what forces work between reviews?
- **Options.** (a) triggers only; (b) a monthly review plus triggers; (c) a quarterly review plus triggers.
- **Choice: (b).** A monthly currency review produces a dated report, `docs/operations/toolchain-reviews/YYYY-MM.md`,
  written by a committed `bun run toolchain:review`. It reads:
  - `bun outdated` and `bun audit` (Bun 1.3.14 has outdated, `update -i/--latest` and audit; audit exits 1 on
    vulnerabilities; `bun audit fix` needs 1.4). `bun outdated` lists no JSON output, so the machine-readable part
    comes from the registry (drafter's note);
  - Node's `schedule.json`;
  - endoflife.date's API for what it tracks (F-13), and the npm registry for the rest;
  - the VS Code → Electron → Node table;
  - the deprecated-version filter.
- **Triggers outside the monthly review:** a security advisory on a used component (act within days); an end of life
  within 90 days; a blocked upgrade's blocker lifting, for example TypeScript 7.1's API (its RC was promised for about
  a month after 2026-10-20, F-6); a needed feature.
- **Why (b).** Triggers alone depend on someone noticing; the review is what reads the advisories and end-of-life
  dates. 124 days passed with no upgrade (F-1), and ESLint 9's end of life is over three months past (F-13). A
  quarterly review could leave a 90-day end-of-life window unread for most of its length. A monthly review also runs
  beside `JAN-SONARCM`'s monthly full sweep.
- **Optional cross-check.** Renovate in `--platform=local` dry-run mode. It needs Node `^24.11` or `^26.13` (F-13).
- **Authority.** `bun audit` feeds the report and the security trigger only, never a gate step, because dependency
  scanning stays deferred as a gate family (§1.1 item 6).

### D-11 (LEAD DECISION). The upgrade procedure: one coupling group per package

- **Question.** How is an upgrade done so that it changes nothing it should not?
- **Options.** (a) one batch upgrade of everything that is behind; (b) one coupling group per package.
- **Choice: (b).** Each upgrade runs on its own branch and worktree, in this order:
  1. A dry run in scratch, as done for TypeScript 6.0.3: an integrity-checked copy, no repository change.
  2. The lock update.
  3. Ordinary re-baselines in the same commit: `bun run gen`, `coverage:floor`, `guards:export`, `slices:ledger`, and
     ledger re-anchoring. When a tool upgrade moves `JAN-SONARCM` S2's per-file lint baseline, a FALL in its counts is
     an ordinary re-baseline, with the counts before and after recorded. A RISE is not: *(amended 2026-11-13 by the
     lead, reconciling this step with `JAN-SONARCM` D-2)* under the sponsor's QS2 ruling a new finding fails unless it
     is fixed, recorded as an exception (`JAN-SONARCM` D-5), or ruled, so a rise caused by a tool or engine upgrade is
     governed like any other.
  4. Governed instruments only after a sponsor ruling: the reviewer fingerprint (REG-D-146, REG-D-149, REG-D-153),
     the Ollama identity (REG-F-608), the fence digest (REG-F-481, REG-D-013) and the Pi pins (REG-D-114 (19)). A
     ledger `abolishedBy` must name an existing REG-D ruling (`verif/mutant-ledger.test.ts:131`), so an upgrade that
     abolishes a mutant waits for one.
  5. The full `gate:fast`, whose last step already runs the e2e suite (`scripts/gate-tail.ts:25-28`), and
     `mutants:changed` for any source edit. A diff of manifests, `bun.lock` and tsconfigs selects almost no mutant:
     `mutants:changed` asks *"for the region a diff actually touches, is there a declared guard over it"*
     (`scripts/mutants/scope.ts:10-11`; its limit at `:34-35`). 0 ledger entries anchor in a manifest, `bun.lock`, a
     tsconfig, `turbo.json` or `bunfig.toml`, and 1 anchors in `apps/rph-demo/vite.config.ts` (P6K-M7,
     `ledger.ts:32720`). So an upgrade that changes the compiler, svelte-check, or a lib or target level also runs
     `bun run mutants:preflight` (`package.json:24`) over every live mutant, in its own worktree. Preflight
     *"Checks ONLY that each mutant still ANCHORS and still COMPILES"* (`scripts/mutants/run.ts:71`), a
     type-prevented mutant that now compiles is a SURVIVED verdict (`:466-473`; 5 `expectNoCompile` entries), and
     preflight writes into the tree (ES-level review). Its run time over 4,405 live entries is not measured.
  6. A floor lane: the gate on the floor Node, from a portable official zip. Nothing records a gate run on any Node
     but 24.11.1 (critic G10). If it cannot run, it is reported as not run with the reason (JAN-ENGC-001 §7.2).
  7. A Sonar re-scan (`JAN-SONARCM`) of the changed files; or, when a tsconfig's lib or target changes,
     `JAN-SONARCM`'s full sweep (1394-1409 s for 457 files, sonar-state review), compared with the previous sweep
     under the same engine version before findings are counted (ES-level review: *"Re-scan after the change, and
     compare against the cycle-6 result before counting findings."*). A changed-files scan sees only edited files,
     while a lib or target change can move findings in files no one edited (inference).
  8. Records: the matrix, the register entry, and the currency report.
- **"The upgrade changed nothing it should not"** means: the `dist` byte-diff, unchanged test counts, an unchanged
  reviewer fingerprint, the mutation preflight where step 5 calls for it, and the Bun-equals-Node agreement checks
  (F-3).
- **Separate authority.** Step 4 always needs a sponsor ruling (I3). Step 8 needs separate authority when it weakens,
  rewrites or removes a hand-written matrix field that no existing ruling covers (I7). A routine upgrade that moves
  only generated and observed fields needs neither.
- **Why (b).** A red after a batch upgrade cannot be traced to one change, and F-11's silent instruments are caught
  only by comparing before and after one change.

### D-12 (LEAD DECISION). The first upgrades, in order (a preview for the roadmap)

- **Question.** In what order do the first upgrades land?
- **Options.** (a) one batch; (b) instruments first, then one coupling group per package, in dependency order.
- **Choice: (b).**
- **T0, instruments first.** The matrix, `toolchain:check`, the boundary population guard and turbo's
  `globalDependencies`. Each is proved with a predicted red (§7). T0 records today's tree and machine as they are:
  today's ranges and pin styles, Node 24.11.1 in a new `.node-version`, Bun 1.3.14 and the Edge major 157. So it
  passes on today's machine. The D-8 pin-style changes that move no version (prettier, zod, vitest and
  @vitest/coverage-v8 to exact at their locked versions) land in T0 with their matrix rows. T0 also re-baselines the
  gate's own pins (§6): each change is additive at DOC-004 §7.6's judgment grain (a new step or guard, every existing
  judgment kept), and each is recorded with its reason, as `verif/assurance-surface.test.ts:226` did for `gen:check`.
- **T1, split in three,** so that each package moves one coupling group (D-11) and dependency-cruiser moves before
  TypeScript (D-4). Each passes the full gate before the next starts, and each lands with its register DECISION
  entry.
  - **T1a, Node/native.** The floor `">=24.15.0"`, `.node-version` 24.22.3, and `@types/node` exact (D-8).
    **Prerequisite:** the machine's Node moves from 24.11.1 to 24.22.3 (D-13). The move also moves V8 and
    `node:sqlite`'s SQLite (Appendix A); if V8 moves the coverage counts, that is `coverage:floor`'s ordinary
    re-baseline, recorded with the counts.
  - **T1b, dependency-cruiser 18,** with T0's boundary guard green against the census. It accepts TypeScript
    `<7.0.0`, so it runs with 5.9.3 and with 6.0.3 (F-7).
  - **T1c, TypeScript 6.0.3 with ES2025:** ES2025 in `base.json` and the app; the browser floor; the 4 restated texts.
    ES2025 cannot come before TypeScript 6.0.3, because 5.9.3 rejects `es2025` with `TS6046` (F-6). The seeded-fault
    instrument parses at `ts.ScriptTarget.Latest` (F-11), so it is among the instruments this package can move.
- **T2.** ESLint 9 → 10, with @eslint/js 10 (not 10.0.0), typescript-eslint and globals. ESLint 9 reached end of life
  on 2026-08-06, and npm marks 58 of 58 9.x versions deprecated (F-13). Its order against `JAN-SONARCM` S2 is in D-13.
- **T3, the Svelte/Vite chain.**
  - First: vite 8 and vite-plugin-svelte 7, with SvelteKit moved to the newest 2.x (2.70.x), as SvelteKit's guide
    advises before 3.0. This ends the split of F-14. SvelteKit 2.69.2 already admits vite 8, TypeScript 6 and
    vite-plugin-svelte 7, so the binding change is vite-plugin-svelte (F-14).
  - Later: SvelteKit 3 (released 2026-10-01; needs Node 22.17, Svelte 5.57.1, Vite 8.0.12, TypeScript 6,
    vite-plugin-svelte 7 and adapter-auto 8).
- **T4.** The 11 S7750 fixes and the 2 S4043 fixes (`toReversed`), and the `scripts/reviewer-qual/run.ts:276` guard.
  - The S7750 fixes carry 3 re-anchors (F-8).
  - The two S4043 sites sit inside 5 live anchors, each a find that contains the `.reverse()` call: one at
    `apps/rph-demo/src/lib/server/assurance/review-fence.ts:291` (PQ1-M1107, `ledger.ts:18654`) and four at `:309`
    (PQ1-V1001 `:17996`, PQ1-V1003 `:18014`, PQ1-V902 `:18113`, PQ1-M1292 `:18194`). None is superseded, duplicated
    or abolished (ledger lines as of `e299baef`). A `toReversed` rewrite of both lines re-anchors all 5, and each
    keeps its mutation's meaning and stays killed.
  - Three T4 sites sit in code the reviewer fingerprint loads or hashes: `scripts/reviewer-qual/fingerprint.ts:102`
    imports `chooseFence` from `review-fence.ts`, and `:338-341` hashes how that reader reads a slice, recording that
    *"a reader changed where no plant stood moved no fingerprint"*; `:107` loads `devin-reviewer.ts`, whose `:503` is
    an S7750 site. So T4's commit shows `reviewer:qual:check` green (it runs in `gate:tail`,
    `scripts/gate-tail.ts:25-28`) with `REVIEWER_FINGERPRINT_TODAY` (`verif/reviewer-qualification-cases.test.ts:4204`)
    unmoved. A moved fingerprint stops T4 for a ruling (I3).
  - T4 may run in the Sonar track. Its order against `JAN-SONARCM` S7 is in D-13.
- **T5 (QT2, ruled 2026-11-13: after T1-T3).** Evaluating Bun 1.4.
- **T6.** Pin the e2e browser: use Playwright's bundled Chromium (1.61.1 bundles Chromium 149, already in this
  machine's Playwright cache, F-12) instead of the self-updating system Edge, unless a reason for `msedge` is found.
  The search found only *"no Playwright browser download is required"* and no ruling (F-12).
  - **Its place.** The brief lists T6 after T5. Until T6 lands, every Edge major stops `toolchain:check` on every
    branch carrying T0 until the new major is recorded and merged (D-13). Edge 153 to 158 came 13 or 14 days apart
    (BCD 8.1.9: 2026-09-11, 09-24, 10-08, 10-22, 11-05, and 158 in beta for 11-19). Landing T6 right after T0 removes
    that. It also changes the browser of the live lanes the paid runs use (`playwright.live.config.ts:40`,
    `playwright.live-exec.config.ts:103`), so it lands between paid runs. The lead decides its place (§9).
- **Later.** TypeScript 7, when its blockers lift; Node 26, when VS Code ships it.
- **Why this order.** The instruments must exist before the first upgrade, so that the upgrade's reds can be seen
  (§7). dependency-cruiser moves before TypeScript (D-4), and ES2025 after TypeScript 6 (F-6).

### D-13 (LEAD DECISION). Coordination with the main line

- **Question.** Where and when does each package land, while another session works on the main line?
- **Options.** (a) land on the Sonar worktree's branch (`sonar/jpwb-remediation-2026-11-12`); (b) land each package
  on a branch from the newest main-line tip.
- **Choice: (b),** with these rules:
  - `package.json` and `bun.lock` changes collide with the other session's branch (`jan-exec/phase7c`). Its tip
    differs from `e299baef` in toolchain files by one comment today (history review), but any dependency it adds will
    conflict. Each package lands on a branch from the newest main-line tip, and `bun.lock` is regenerated after merges.
  - Nothing touches the main checkout during a paid run.
  - Machine-level software (Node, Edge, Bun) changes only between paid runs, with the sponsor's go-ahead. The 7th paid
    run uses Node through the SvelteKit dev server (LEAD-FACTS), so the T1a prerequisite waits for it to end.
  - **The machine's Node and the main line move together.** Every worktree on this machine shares one Node, one Edge
    and one SonarLint. Once T0 is on the main line, moving the machine's Node to 24.22.3 fails `toolchain:check` on
    every branch whose matrix still records 24.11.1. So the Node move and T1a's merge into the main line are one step,
    taken between paid runs with the sponsor's go-ahead, and each live branch carrying T0 merges or rebases onto T1a
    before its next gate run.
  - **A self-updated machine tool** (an Edge major; a SonarLint update) fails `toolchain:check` on every branch
    carrying T0 until its new observed version is recorded. Recording it is an ordinary re-baseline (I7), committed on
    the main line and merged into live branches. T6 takes Edge out of this.
  - T4's re-anchors edit `scripts/mutants/ledger.ts`, to which the other session appends entries; T4 is timed between
    paid runs too.
- **With `JAN-SONARCM`.**
  - S2 adds eslint-plugin-sonarjs, eslint-plugin-unicorn, eslint-plugin-import and typed linting to the lint group
    that T2 moves from ESLint 9 to 10. unicorn 65.0.1, the version SonarJS 14.4 bundles, peers eslint `">=9.38.0"`,
    so it fits ESLint 9 and 10; the newest, 79.0.0, needs eslint `">=10.4"`
    (https://registry.npmjs.org/eslint-plugin-unicorn, as the toolchain review read it). The order of T2 and S2, and
    which unicorn S2 takes (65.0.1 for parity with the IDE engine, or the newest the ESLint pin allows), are settled
    with `JAN-SONARCM` (§9).
  - S7 splits `scripts/mutants/ledger.ts`, which T4 re-anchors. They land one after the other, between paid runs.
    This design names ledger entries by id; its ledger line numbers are as of `e299baef`.
  - S1's committed machine-path config is where `toolchain:check` finds Edge and SonarLint, with no hard-coded
    `C:/Users` paths. If T0 lands first, T0 defines that config.
- **Why (b).** The manifests and the lock collide with the other session's work, and machine-level software is
  shared by every worktree on this machine.

---

## 5. Invariants

- **I1.** No gate step passes on a runtime or tool version that the matrix does not record.
- **I2.** An upgrade lands with its ordinary re-baselines in the same commit.
- **I3.** A governed instrument is never re-pinned without a sponsor ruling.
- **I4.** The matrix and `bun.lock` agree.
- **I5.** Every pin satisfies every declared peer range ("latest compatible").
- **I6.** A check whose population is empty fails; it never passes. This covers boundary, coverage and every census.
- **I7 (drafter's addition, from DOC-004 §7.6).** The matrix's hand-written fields (D-7: coupling group, floor, pin
  style, blockers, instruments moved, and the reason for each) are the judgments `toolchain:check` enforces, so they
  are a gate configuration. Weakening, rewriting or removing one that predates the change (lowering a floor,
  loosening a pin style, deleting a blocker whose condition has not lifted) is a separately authorized act: declared,
  attributed in a register entry, and processed at the authority grade of the behaviour it protects, today the
  sponsor's. Adding a row or a blocker is authorship, DOC-004's own non-example. Moving a value as an existing ruling
  directs (the day-to-day Node to the newest 24.x patch, D-1) applies that ruling. Generated and observed fields are
  records of fact: they are regenerated or recorded in the same commit, as ordinary re-baselines.

---

## 6. What changes where (design-level map, not the roadmap)

| Where | Change | Decision (package) |
| --- | --- | --- |
| `package.json` | prettier `3.9.5`, vitest `4.1.10` and `@vitest/coverage-v8` `4.1.10` exact (today `:52` `"^3.7.4"`, `:56` `"^4.0.0"`, `:48` `"^4.0.0"`); a `toolchain:check` script, first in `gate:fast`; a `toolchain:review` script | D-8, D-9, D-10 (T0) |
| `packages/rph-application/package.json:37`, `packages/rph-contracts/package.json:45`, `packages/rph-domain/package.json:30` | zod `4.4.3` exact (today `"^4.4.3"`) | D-8 (T0) |
| `.node-version` (new) | `24.11.1`, the machine as it is | D-1, D-9 (T0) |
| `scripts/toolchain/` (new) | `matrix.json`, the check, the review, the generator of the generated fields | D-7, D-9, D-10 (T0) |
| the machine-path config (`JAN-SONARCM` S1) | where `toolchain:check` finds Edge and SonarLint; defined by whichever lands first | D-9, D-13 (T0) |
| `docs/operations/toolchain.md` (new) | the matrix page and the procedure | D-7, D-11 (T0) |
| `docs/operations/toolchain-reviews/` (new) | monthly reports | D-10 |
| `turbo.json` | `globalDependencies` on the matrix and `.node-version` | D-9 (T0) |
| `bunfig.toml` | `install.minimumReleaseAge = 604800`, once §7 shows it on 1.3.14 | D-8 (T0) |
| the `boundary` step | the population guard | D-4 (T0) |
| `verif/assurance-surface.test.ts` | T0's pin re-baselines, each recorded with its reason: `bun run toolchain:check` first in the composition pin (`:220`), with the argument for its position; `REQUIRED_ROOT_COMMANDS` 12 → 13 (`:135-161`, `:204`); the exact `boundary` pin (`:269`) if the guard joins that script (`verif/dependency-boundary-rules.test.ts:194` matches a prefix only) | D-4, D-9 (T0) |
| `packages/rph-ports/src/ports/workspace.ts:180`, `packages/rph-ports/src/ports/workspace.test.ts:72`, `apps/rph-demo/src/lib/server/execution/filesystem-workspace.test.ts:301` | comments corrected | D-9 (T0) |
| `package.json` | `engines.node` `">=24.15.0"`; `@types/node` exact, no newer than the floor (today `:47` `"^24.0.0"`) | D-1, D-5, D-8 (T1a) |
| `.node-version` | `24.22.3` | D-1 (T1a) |
| `package.json` | dependency-cruiser `^18` | D-4 (T1b) |
| `package.json`, `apps/rph-demo/package.json` | typescript `6.0.3` | D-3 (T1c) |
| `packages/typescript-config/base.json:11`, `:21` | ES2025 | D-5 (T1c) |
| `apps/rph-demo/svelte.config.js` | `kit.typescript.config`: lib ES2025 + DOM + DOM.Iterable, target ES2025 | D-5 (T1c) |
| `apps/rph-demo/vite.config.ts` | `build.target` = the browser floor | D-6 (T1c) |
| `scripts/tsconfig.json:8-9`, `scripts/mutants/run.ts:1016`, `apps/rph-demo/e2e-live-exec/phase7-operator.ts:970`, roadmap `:69` | restated | D-5 (T1c) |
| the 11 S7750 sites: `apps/rph-demo/src/lib/server/tools/devin-reviewer.ts:503`, `packages/rph-engine/src/replay.ts:107`, `:108`, `packages/rph-ports/src/ports/process-runner.ts:252`, `scripts/mutants/run.ts:1031`, `scripts/phase7/half-b.ts:453`, `scripts/phase7/run-archive.ts:883` (~~`:879`~~ in cycle 6's tree, before L15 changed the lines above it; restated at M0's merge), `scripts/phase7/run-report-core.ts:1854`, `:3132`, `:3730`, `scripts/reviewer-qual/run.ts:276` (with its guard); the 2 S4043 sites `apps/rph-demo/src/lib/server/assurance/review-fence.ts:291`, `:309` | `findLast` and `toReversed` (ES-level sites review) | D-12 (T4) |
| `scripts/mutants/ledger.ts` | 3 + 5 re-anchors | D-12 (T4) |
| the three Playwright configs | the bundled Chromium | D-12 (T6) |
| the register | DECISION entries, filed when each package lands | §1.1 |

---

## 7. How each decision is verified

Each check names the red it must show first, and why it can go red. Each red is built to trip one condition, and the
check asserts its message, so that the red proves which condition failed.

| Decision | Check | Predicted red | Why it can go red |
| --- | --- | --- | --- |
| D-1 | `toolchain:check`, normal mode (D-9 condition 1) | With `.node-version` 24.22.3, the check run on Node 24.11.1 fails, its message naming the day-to-day version. | Normal mode compares only with the day-to-day version. Today's machine is the red case. |
| D-1 | `toolchain:check`, floor mode (D-9 condition 1) | On the official Node 24.0.0 zip (the lead has one, checksum verified), floor mode fails, its message naming the floor 24.15.0. | Floor mode compares only with the floor. |
| D-1, D-11 | the keep-alive tests, run alone with vitest outside `gate:fast` | On the 24.0.0 zip, the tests at `harness-keep-alive.test.ts:74` and `:83` fail; on 24.15.0 they pass. | `keepAliveTimeoutBuffer` is *"Added in: v24.6.0"*: on 24.0.0 the sum at `:78` is `NaN`, and the field read at `:29` is undefined, not the `1_000` expected at `:89`. Inference from the docs; not run. Run outside the gate because floor mode refuses 24.0.0 at step 1. |
| D-2 | cross-row rule (D-9 condition 5) | A scratch matrix with the VS Code floor at 1.122.0 fails, naming its Node 22.22.1. | 1.122.0 runs Node 22.22.1, below 24.15.0 (F-5). |
| D-3, I5 | peer ranges (D-9 condition 4) | A fixture whose matrix, lock and installed tree all hold typescript 7.0.2 fails only the peer check, naming typescript-eslint `<6.1.0`. | The three agree, so condition 2 stays green; the ranges are read from the installed packages' manifests. |
| D-4, I6 | the boundary population guard | In a scratch copy with TypeScript 6.0.3 and dependency-cruiser 16.10.4, today's `bun run boundary` exits 0 with the green line; with the guard it exits non-zero. | `meta.cjs:15` excludes 6.x, so no package module is cruised (F-7). This run is also the first proof of F-7, which so far is read from source. |
| D-5 (lib) | `check-types` | A scratch package file calling `RegExp.escape` fails today and passes after the raise. | ES2022's lib lacks it; the es2021 control (49 errors) shows lib changes are visible. |
| D-5 (app) | the app's `check` | A scratch app file calling `Error.isError` type-checks today and fails after the pin. | 5.9.3's esnext includes `esnext.error` (ES-level review K6), and TC39 lists `Error.isError` under 2026, outside ES2025. |
| D-6 | browser floor (D-9 condition 6) | A scratch `vite.config.ts` with `build.target: 'chrome107'` fails. | A plain comparison. No test runs the page on the floor browsers (§8). |
| D-7, I4 | lock agreement (D-9 condition 2) | A fixture whose lock and installed tree hold turbo 2.11.11 while the matrix records 2.10.4 fails, naming turbo's lock-versus-matrix disagreement. | turbo has no exact peer, so condition 4 stays green, and the tree and the lock agree. |
| I1 | installed tree (D-9 condition 2) | A fixture whose matrix and lock hold turbo 2.10.4 while `node_modules` holds 2.11.11 fails, naming the installed version. | `gate:fast` runs no install (`package.json:27`). |
| D-8 | pin style (D-9 condition 3) | `"typescript": "^6.0.3"`, or `"elkjs": "^0.11.1"`, in a scratch manifest fails. | The matrix records `exact`; the lock still resolves the same version, so condition 2 stays green. |
| D-8 | the cooldown | In scratch on Bun 1.3.14, `bun install` refuses a version published less than 7 days ago, and lets it through when `install.minimumReleaseAgeExcludes` names it. | Documented for current Bun only (F-13); to be shown on 1.3.14, not assumed. |
| D-9 | Bun (D-9 condition 1) | A scratch matrix recording Bun 1.3.13 fails, naming Bun. | The running Bun is 1.3.14. |
| D-9 | machine tools (D-9 condition 7) | A scratch matrix recording the Edge major 156 fails, naming Edge. | The machine runs Edge 157. |
| D-9, I6 | empty population (D-9 condition 8) | An empty `matrix.json` makes `toolchain:check` exit non-zero. | Without condition 8, an empty matrix would compare nothing and pass. |
| D-9 | runtime per step | A scratch `gate:fast` step running `bun --bun vitest run` fails, naming the step and its runtime. | The matrix records Node for vitest (F-3). |
| D-9 | turbo's hash | Two `turbo run test --dry=json` runs give equal hashes; editing `.node-version` makes them differ. | turbo hashes `globalDependencies` file contents (F-10). |
| D-9 | wired into `gate:fast` | Once T0 adds `toolchain:check` to the composition pin (`verif/assurance-surface.test.ts:220`), removing it from `gate:fast` in a scratch manifest fails that pin. | The pin reads `package.json`'s `gate:fast` step by step. |
| D-10 | `toolchain:review` | A scratch matrix recording @eslint/js 10.0.0, or a row whose end of life is within 90 days, is flagged in the report. | Deprecation and end-of-life dates are read live. |
| D-11 | the `dist` byte-diff | Building at target ES2019 makes 22 of 48 rph-engine files differ (measured under 5.9.3). | The diff can see an emit change. |
| D-12 (T4) | the anchor census | Applying the `findLast` rewrite at `process-runner.ts:252` without re-anchoring P2B-a fails `verif/mutant-ledger.test.ts:254` (*"every measurable mutant still occurs EXACTLY ONCE in its file"*), naming P2B-a. | The anchor's find text no longer occurs. |
| D-12 (T4) | the D53 precheck (`scripts/reviewer-qual/run.ts:274-277`) | A unit test with the lines `[null, <a SELECTION line>]` fails against a bare `findLast` rewrite and passes with the guard. | `findLast` stops at the last SELECTION and never reads the `null` before it (refuter K15). |

---

## 8. Self-critique

1. **Unmeasured.** Nothing records a gate run on Node 24.15.0 or 24.22.3 (critic G10). 6.0.3's emit is not measured,
   and neither are the 26 compiler-API files, typescript-eslint, svelte-check or dependency-cruiser under 6.0.3 (F-6's
   limit). dependency-cruiser 18 has not run on JPWB. The page has not run on Chrome 136, Firefox 138 or Safari 26.
   Bun 1.4's reported Node is the announcement's claim. No predicted red of §7 has run yet; each is designed.
   `mutants:preflight`'s time over 4,405 live entries is not measured (D-11).
2. **Where this design departs from the brief.** Each needs the lead's eye, and the first two before §0 goes to the
   sponsor:
   - QT1's Firefox number is 138, not 134 (D-6). 134 counted only the 8 probed built-ins; 136 if import attributes
     are not counted.
   - 3 of the 4 tools exclude TypeScript 7 as installed, not 4; svelte-check excludes it only from 4.7.4 (F-6).
   - The newest Electron is 45.3.2, not 43.8.3 (F-5).
   - SvelteKit 2.69.2 already admits vite 8 and TypeScript 6, so the T3 order rests on SvelteKit's own advice, not on
     a peer range (F-14).
   - The two S4043 sites sit inside 5 live anchors, not 2 (D-12 T4).
   - Two keep-alive tests need Node 24.6, not three (F-2).
   - T1 is split into T1a-T1c, to keep D-11's one-group rule and D-4's order (D-12).
   - T6 may move ahead of T1 (D-12; the lead decides, §9).

   It also restates six smaller points: e2e already runs inside `gate:fast`'s last step (D-11 step 5); the
   advisory's "16 issues" is a reviewer's count across three release lines, not "16 CVEs" fixed by 24.22.3 (F-4);
   vitest and @vitest/coverage-v8 are pinned by count, not byte for byte (F-11, D-8); Playwright breaks in minor
   releases, not patches (D-8); Firefox ESR 115 still gets updates on old systems until March 2027 (F-9); and nothing
   *records* a gate run on another Node, which is not the same as none having happened (F-2).
3. **The ES2025 coverage.** TC39 lists 10 proposals under 2025. The lead's probe runs 7 of them in the runtimes. This
   design looked up Import Attributes and JSON Modules in BCD only (Firefox 138; Node 20.10.0; Bun 1.0.0), without
   running them. The tenth, redeclarable global `eval`-introduced `var`s, was not checked anywhere.
4. **Node 24 ends a year before Node 26** (2028-04-30 against 2029-04-30), and it is already in Maintenance LTS. If
   VS Code moves to Node 26 late, the floor must move under time pressure.
5. **One machine serves every worktree.** Once T0 is on the main line, the machine's Node move and each Edge major
   fail `toolchain:check` on every live branch at once, the other session's included. D-13 contains this (the Node
   move lands with T1a; a new observed version is recorded as an ordinary re-baseline), and T6 takes Edge out of it.
   If the friction still leads people to skip the check, it fails as a guard.
6. **Bun 1.3.14 has no backport policy.** A Bun security issue could force 1.4 before T5 is evaluated. The monthly
   review must watch Bun's advisories, and QT2's answer would then be overtaken.
7. **`@types/node` against the floor.** The exact pin (D-8) keeps the type check from describing APIs above the floor,
   if a release no newer than 24.15 exists; today's 24.13.3 is one. Which releases exist between 24.13.3 and the 24
   line's newest, 24.19.2, was not checked.
8. **The local gate is not the binding boundary.** DOC-004 §7.6 says so, and there is no CI. A check the operator
   does not run does not run.
9. **Nothing schedules the monthly review.** It depends on someone running it.
10. **Weak evidence used here:** the CVE count is a reviewer's summary (F-4); the 1.146.0 row of the lead's VS Code
    table has no value; the two VS Code tables disagree, on Electron for 1.123.0-1.127.0 and on Node for
    1.139.0-1.145.0, and this design uses the `.npmrc` table (F-5); `install.minimumReleaseAgeExcludes` and the
    seconds unit are documented for current Bun only (F-13); the elkjs deprecation has no URL in the sources (F-13).
11. **`bun audit` and the deferral.** Using it only in a report is this design's reading of REG-Q-049 and REG-D-046
    Ruling 3, not a ruling (§9).
12. **Ordinary re-baselines can weaken.** *(Restated 2026-11-13 by the lead, with D-11 step 3.)* A `coverage:floor`
    baseline that an upgrade raises is still an ordinary re-baseline, as the brief classifies it; only the counts
    before and after keep that visible. A lint baseline that rises is governed. After a vitest or Playwright upgrade,
    the mutation runner's reading of their output (instruments I14, I15) is checked by no step of D-11 short of a full
    `bun run mutants`, which the repository last recorded at about 15 hours on 4 lanes (instruments review).

---

## 9. Open items

1. **The extension's native addon** (D-2): better-sqlite3 built for Electron's ABI, better-sqlite3 13 on N-API, or
   `node:sqlite`. For the extension's own design.
2. **Import attributes and Vite** (D-6): whether an import attribute can reach the browser through Vite was not
   checked. T1c's dry run checks it.
3. **`@types/node` against the floor** (D-8, §8 item 7): the roadmap checks which types releases exist.
4. **The boundary guard** (D-4): its census rule, and whether it is its own step or part of `boundary`; defined in the
   roadmap.
5. **The nested `ci.yml`** (REG-F-419, OPEN): moving or removing it is a separate decision. It also states Bun 1.3.14
   (`.github/workflows/ci.yml:16`), so any Bun move must restate it or remove the file.
6. **`bun audit` in a report under the REG-Q-049 deferral** (D-10): the lead confirms this reading before T0; if it
   needs a ruling, the lead adds it to the brief's question list first.
7. **Playwright's support for a branded Edge 157** (critic G11): moot once T6 lands.
8. **Register entries to file when this lands, without numbers here:** the Node floor and `.node-version`;
   TypeScript 6.0.3; ES2025 with the four restated texts; the browser floor; `toolchain:check` as an interim carrier;
   the pin rules, `@types/node` included; the matrix's hand-written fields as gate configuration (I7).
9. **T6's place and browser** (D-12): the lead decides whether T6 moves ahead of T1, and checks for a reason for
   `msedge` outside the repository before T6.
10. **Coordination with `JAN-SONARCM`** (D-13): the order of T2 and S2, and the unicorn version S2 takes; T4 against
    S7's ledger split; which package defines the machine-path config. For the lead, with that design.

---

## Appendix A. First matrix rows (preview)

Versions as of 2026-11-13 (web-versions and inventory reviews; for `node:sqlite` and V8, critic C2 and G16 and the
lead's measurements). "Proposed pin" applies D-8.

| Component | Group | Declared → locked | Newest | Proposed pin | Blocker or note |
| --- | --- | --- | --- | --- | --- |
| Node | Node/native | `>=22`; machine 24.11.1 | 24.22.3 (24 line); 26.13.1 | floor 24.15.0; day to day 24.22.3 | 26: VS Code and Electron (F-5) |
| `node:sqlite` | Node/native | built into Node: SQLite 3.50.4 on Node 24.11.1; imported by `scripts/phase7/run-archive.ts:60` and 2 verif tests | moves with Node | follows the Node pin | experimental; Node 26.11.0 renamed `DatabaseSync` (documentation-only) |
| V8 | Node/native | built into Node: 13.6.233.10-node.28 on 24.11.1 (13.6.233.8 on 24.0.0) | moves with Node | follows the Node pin | coverage counts (I04, I05) |
| Bun | runtime (G0) | `devEngines` 1.3.14 | 1.4.4 | exact 1.3.14 | 1.4: evaluate after T1-T3 (QT2, ruled; F-15) |
| typescript | TypeScript | 5.9.3 exact | 6.0.3 (6.x); 7.0.2 (`latest`) | exact 6.0.3 | 7: no API; 3 tools as installed, 4 at newest (F-6) |
| dependency-cruiser | TypeScript | `^16.0.0` → 16.10.4 | 18.7.2 | caret | 16.x: TypeScript `<6` (F-7) |
| typescript-eslint | lint | `^8.0.0` → 8.63.0 | 8.72.2 | caret | TypeScript `<6.1.0` |
| eslint, @eslint/js | lint | `^9.37.0` → 9.39.5 | 10.14.0; 10.0.1 | caret | 9 end of life 2026-08-06; skip @eslint/js 10.0.0 |
| globals | lint | `^15.0.0` → 15.15.0 | 17.14.0 | caret | two majors behind |
| svelte | Svelte/Vite | `^5.0.0` → 5.56.4 | 5.57.3 | caret | SvelteKit 3 needs 5.57.1 |
| @sveltejs/kit | Svelte/Vite | `^2.22.0` → 2.69.2 | 2.70.4 (2.x); 3.2.0 | caret | 3 needs vite 8 and vite-plugin-svelte 7 |
| @sveltejs/vite-plugin-svelte | Svelte/Vite | `^6.0.0` → 6.2.4 | 7.3.1 | caret | 6.x: vite `^6.3.0 \|\| ^7.0.0` (F-14) |
| @sveltejs/adapter-auto | Svelte/Vite | `^6.0.0` → 6.1.1 | 8.0.1 | caret | 8 needs SvelteKit 3 |
| svelte-check | Svelte/Vite | `^4.0.0` → 4.7.2 | 4.7.8 | caret | 4.7.2 peers TypeScript `>=5.0.0`; `^5 \|\| ^6` from 4.7.4; 7 only via `--tsgo` |
| vite (app) | Svelte/Vite | `^7.0.0` → 7.3.6 | 7.3.8 (7.x); 8.3.8 | caret | vite-plugin-svelte 6.x |
| vitest, @vitest/coverage-v8 | vitest | `^4.0.0` → 4.1.10 | 4.1.12 (4.x); 5.1.0 | exact | coverage counts; exact peer |
| prettier | codegen | `^3.7.4` → 3.9.5 | 3.10.1 | exact | `gen:check` bytes |
| zod | codegen | `^4.4.3` → 4.4.3 | 4.6.7 | exact | 120 committed schemas |
| @playwright/test | e2e | 1.61.1 exact | 1.65.0 | exact | breaking changes in minors |
| pi-ai, pi-coding-agent, pi-agent-core | Pi SDK | 0.80.6 exact | 1.5.2 | exact | breaking changes in patches; governed (REG-D-114 (19)) |
| typebox | Pi SDK | 1.1.38 exact | 1.4.7 | exact, equal to Pi's | moves with Pi |
| better-sqlite3 | Node/native | `^12.8.0` → 12.11.1 | 13.1.1 | caret | ABI 137; Electron (D-2) |
| @types/node | Node/native | `^24.0.0` → 24.13.3 | 24.19.2 (24.x); 26.6.6 | exact, no newer than the floor | must not run ahead of the floor (D-8) |
| elkjs | graph layout | 0.11.1 exact | 0.12.1 | exact (stays exact) | skip 0.13.0; 0.12.0 *"adds GPL-3.0 as a secondary license"*; tied to 0.11's entry layout |
| @dagrejs/dagre, @statelyai/graph | graph layout | 3.0.0, 2.1.0 exact | 3.1.3, 2.6.0 | exact (stays exact) | reasons to record (D-8) |
| xstate, @xstate/svelte | xstate | 5.32.5, 5.0.0 exact | 5.33.4, 5.0.1 | exact (stays exact) | reasons to record (D-8) |
| fast-check | standalone (tests) | 4.9.0 exact | 4.10.2 | exact (stays exact) | reason to record (D-8) |
| turbo | standalone | `^2.10.4` → 2.10.4 | 2.11.11 | caret | cache key (F-10) |
| System Edge | e2e (machine) | `channel: 'msedge'` | 157.0.4341.42 (.46 staged) | observed; major checked | T6 |
| SonarLint, SonarJS | Sonar runner (machine) | not in the repository | 6.3.0; 14.4.0.46458 | observed; checked | `JAN-SONARCM` |
| VS Code | VS Code (new) | no extension yet | 1.145.0 on Node 24.22.0 (`.npmrc`); the installed 1.145.3 runs 24.22.1 (measured) | floor 1.123.0 | (F-5) |
