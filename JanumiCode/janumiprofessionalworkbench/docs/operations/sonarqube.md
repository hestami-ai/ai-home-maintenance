# SonarQube Operations — JPWB

**This document is the artifact JAN-ENGC-001 §7.1 names** — the "accepted operations
documentation" through which the repository defines how its quality gates are executed — and the
REG-E-019 placement. Since 2026-11-17 the driver itself is JPWB's: `scripts/sonar/batch-runner.cjs`
spawns the headless SonarLint language server and drives it over LSP under the pinned engine, the
committed rule set and the scope census (JAN-SONARCM D-1, package S1; §7). The janumicode_v2 guide,
`../../../janumicode_v2/docs/sonarqube-headless-remediation-guide.md`, is background per §7.1: it MAY
be consulted but SHALL NOT silently control this repository. From 2026-07-17 until S1, its gitignored
runner was the only working driver anywhere — precisely the state §7.1 forbids.

Authority: **JAN-ENGC-001** (normative, effective 2026-07-17) §7.1 repository-local procedure,
§7.3 findings remediated fully by default, §7.4 recorded exceptions. Provenance, not authority:
the retired pre-control Constitution's L1186 pointer / L1188 "fully" / L1220 exceptions
(`docs/Recursive Professional Harness/retired/`, preserved as non-normative historical evidence —
its README forbids citing it as current authority), reconciled historically per REG-E-018.
Register context: REG-E-019, REG-F-180 P4, REG-F-100.

## 1. What is scanned

`sonar-project.properties` at the repository root is the single scope authority. Since 2026-08-17
it includes the instruments — `sonar.sources=packages,apps,verif,scripts` — because leaving
`verif/` and `scripts/` unscanned was the analysis half of REG-F-097's check-types blind spot: the
first scan of the newly included paths found 34 findings in 9 files, including a cognitive
complexity of 62 in `verif/arrow-command-census.ts`, larger than anything in the product code it
audits. The properties file's own comments carry that rationale; do not narrow the scope without a
register entry.

Scans analyze TypeScript/JavaScript (sonarjs + eslint-bridge). `.svelte` single-file components
exist under `apps/` and have not been covered by any campaign to date. `docs/` is not scanned.

**No gate or CI step runs a scan today.** Scans are run on demand and in campaigns; `gate`,
`gate:fast`, and `.github/workflows/ci.yml` do not invoke one. A finding therefore persists
silently until the next scan — which is why campaign completion notes record their end state.

## 2. How a scan is run

With JPWB's runner, from the JPWB root (§7 has the procedure): `bun run sonar:scan -- --out <new
folder> --all` analyses every file of `scripts/sonar/scope-census.json`, which `bun run sonar:census`
writes from `sonar-project.properties`; `--files <list>` analyses named census files. The runner
refuses (exit 2) an engine other than the matrix's pins, a rule set the engine cannot run, a server
whose echo of the rules, the scope settings or the tsconfigs differs from what it was given, and a used folder.
Each run writes into a new, empty folder (`--resume` reuses a result only for unchanged bytes), so a
stale ledger can no longer skip files in silence: a listed file with no fresh result is named, exit 4.

Machine paths come from `scripts/toolchain/machine-paths.json` (profile-relative) and the engine's
versions from the matrix's Sonar rows, which `toolchain:check` and the runner check; so the 2026-08-20
warning that the tooling's "hardcoded machine paths ROT" is answered, and the engine moves only by a
governed re-baseline (JAN-SONARCM D-4).

## 3. The JPWB gate per remediation batch

All execution is central (the orchestrator), never inside fix agents; fix/review agents are
edit-only (guide §4.1, learned the hard way). Package manager is **bun** — npm/npx are blocked by
`devEngines`. Per batch:

1. `bun run check-types` — includes `verif/` and `scripts/` tsconfigs; both are part of the tell
   when an instrument edit breaks.
2. Re-scan the changed files and compare them with the pre-batch run (`sonar:scan --files`, then
   `sonar:compare`): targeted findings cleared AND none introduced (decompositions spawn S107/S7778/S6551/S2301).
3. `bunx vitest run` on the affected projects; `bun run test` for a full pass.
4. `bunx vitest run --project=verif verif/mutant-ledger.test.ts` — **non-negotiable whenever any
   file carrying a ledger anchor was touched** (see §4).
5. `bun run boundary`. ~~`bun run csaa:inventory:check` when any provenance-listed file changed~~:
   that script left JPWB with CSAA (`verif/csaa/DISPOSITION.md:41`), so this step no longer runs it;
   and `bun run sonar:census` when a file entered or left the scope (its test names the file otherwise).
6. A claim of the FULL gate additionally requires playwright (`e2e`) — vitest alone is not the
   full gate.

## 4. The mutation-ledger constraint — the hazard specific to this repository

The mutation ledger (`scripts/mutants/ledger.ts`) holds anchors that must occur **exactly once**
in their target files (`verif/mutant-ledger.test.ts` enforces it). Sonar remediation is control-flow
restructuring, which is precisely what detaches them. This is not hypothetical:

- **REG-F-100**: a prior remediation campaign detached **ten** mutants — seven in one
  cognitive-complexity decomposition (`2bda6423`), three in one mechanical sweep (`6992b7b0`).
  *A behaviour-preserving refactor is not evidence-preserving.*
- **`f9b8642f`** (2026-08-19): the first decomposition of `verif/arrow-command-census.ts` passed
  tsc, every test, and an adversarial equivalence review — and was **reverted anyway**, because it
  made mutant F122 *inexpressible*: the mutation's replacement referenced variables the extraction
  had moved out of scope. **The anchor gate counts `find` strings, not whether a mutation still
  means what its entry says.** Anchor-count green is necessary, not sufficient.

Procedure, proven by that second attempt: before touching a file, enumerate its anchors from the
ledger (`arrow-command-census.ts` alone carries nine). Leave every anchored block **byte-identical
at its exact nesting depth** and extract the code **around** it. After the edit, run the anchor
gate AND re-read each affected entry asking whether its `find`/`replace` still expresses the
defect it declares. If an anchor must move, re-anchor **in the same commit** on content without
leading whitespace (ledger rule #4), or supersede the entry explicitly.

## 5. Exception discipline

JAN-ENGC-001 §7.3 (remediate fully by default) and §7.4 (a finding MAY remain only under an
explicit, reviewable exception recording tool/rule/location, why, risk, compensating controls,
approving authority, owner and expiry — "Convenience and silence SHALL NOT" justify one) govern.
REG-E-018's earlier reconciliation — explicit recorded exception, never silence — is the same rule
as register precedent. In practice:

- A finding deferred rather than fixed is **ruled**, with its verification rather than its
  argument, by a register ruling (pattern: `cd0bad4d`, which settled two deferred regex findings
  under delegated authority) that names its entry in the exceptions register, and its site carries
  the marker `// eslint-disable-next-line <rule> -- EXC-nnn <reason>`; never `NOSONAR` (§8).
- A principled won't-fix records its rationale where the next scan will meet it. Silence is not a
  disposition.
- Standing refusal families a future sweep must not re-open: **S2871 sort comparators are
  `Number(a>b)-Number(a<b)`, never `localeCompare`** — Sonar's own message recommends
  `localeCompare` and it is wrong for this package (locale-dependent order would break pinned
  canonical orderings). The recorded mechanism travels with each site.
- **Never hand-gloss a rule ID.** Derive rule-id→message pairs from the sweep worklist itself:
  in the 2026-08-19 campaign 11 of 22 hand-written glosses were materially wrong — agents were
  handed a confident description of a different rule — costing three findings re-issued
  (`32299e6c`, instrument-defect section).
- **`scripts/mutants/ledger.ts` is prettier-non-conformant at HEAD and stays that way**:
  wholesale reformatting it is the REG-F-194 Finding 3 churn trap (238 rewritten lines around an
  18-line edit, four anchors detached in a prior sweep). Conformance arrives edit-by-edit.

## 6. Campaign history

- **~2026-08-04..13** (REG-F-100 era): remediation preceded the anchor discipline; 10 detached
  mutants found and re-anchored after the fact.
- **2026-08-19** (`58ddb228..172c5c18`, 18 commits): instruments + csaa campaign — bands A–D,
  cleared cx 212/176/134 and the 1476-line monster, ruled the deferred regex findings, taught the
  gate csaa's cost, and moved no mutation anchor (the one attempt that would have, was reverted
  and redesigned). Register: REG-F-180's sonar-adjacent bullets.
- Sibling-repo methodology provenance: ~660 fixes in janumicode_v2 (guide §9).
- **2026-11-12..13** (cycle 6: `e31c2f8a`, `a318be36`, `e299baef`): the first sweep in 86 days
  found 512 findings in 126 files; Tiers A/B, C and D left 176, of which 24 are refused at their
  sites and 152 await a fix package or an exception (JAN-SONARCM D-10). The lead's record is in
  [`sonar-cycles/cycle-6/`](sonar-cycles/cycle-6/README.md), byte for byte, and the cycle's
  hand-written tools are kept as records in [`sonar-cycles/cycle-6/tools/`](sonar-cycles/cycle-6/tools/README.md).
- **2026-11-17** (JAN-SONARCM S1): the runner, the rule set and the scope census move into JPWB
  (§7). The engine of record is SonarLint 6.3.0: language server 6.3.0.79979, SonarJS 14.4.0.46458.

## 7. The runner (JAN-SONARCM S1)

**What pins a result (J2).** Three committed inputs, each recorded in every run (the engine by its versions,
the rule set and the census by their hashes):
- *The engine.* The SonarLint extension the matrix's `sonarlint` row pins, and the three rows it
  bundles, `check: "runner"`: the language server, SonarJS and the JRE (`scripts/toolchain/matrix.json`).
  The runner takes the extension whose own `package.json` names the pinned version, never the highest
  installed, and refuses a bundle that differs, naming both versions; it reads SonarJS's version again
  from the server's own "Plugin version" line. The extension's folder and layout come from
  `scripts/toolchain/machine-paths.json`. The bridge runs on the Node that runs the runner, which must be
  the matrix's day-to-day Node: run the runner with node, never Bun.
- *The rule set.* `scripts/sonar/rules.json`: the rules the engine runs, in the repositories it governs
  (TypeScript, JavaScript and Secrets: the ones that report on the scope's files), and any parameters.
  At each run the runner asks the server for its defaults (`sonarlint/listAllRules`), holds the server's
  first configuration request until it has them, and sends the differences: listed rules off by
  default, on; defaults not listed, off; the parameters. It refuses a listed rule the engine does not
  have, a server whose echo ("Global settings updated") differs from what was sent, and an analysis whose
  active-rule count in a governed repository differs from the rule set's.
- *The scope.* `scripts/sonar/scope-census.json`, written by `bun run sonar:census` from
  `sonar-project.properties` and the tracked files: the files in scope and the tsconfigs the properties'
  globs match. The runner gives the server those globs (`sonar.typescript.tsconfigPaths`) and the test
  pattern, and refuses when the server echoes other scope settings ("WorkspaceFolderSettings") or reports
  finding other tsconfigs (without the globs it finds SvelteKit's generated one among 17; with them, the
  14 tracked ones).

**Commands**, from the JPWB root:
- `bun run sonar:census` after a file in `packages/`, `apps/`, `verif/` or `scripts/` is added, removed
  or renamed; `verif/sonar-runner.test.ts` fails, naming the file, until the census is rewritten.
- `bun run sonar:scan -- --out <new folder> --all` for a full sweep; `--files <list>` (paths, one per
  line) for named census files; `--resume` to reuse an earlier run's results in that folder for files whose
  bytes, engine, rule set and census are unchanged; `--rules <file>` for a control rule set (recorded).
- `bun run sonar:compare -- <before folder> <after folder> [--files <list>] [--fail-on-introduced]`: what
  a change cleared and introduced, matched per file by rule and message. It refuses runs under different
  engines or rule sets (J3) and a run that does not record its engine, rule set or census (J2).

**What a run writes**, into its folder: `run.json` (the tree's commit, the Node, the engine, the rule set's
hash, what was sent and the server's echo, the active-rule counts, the census's hash, the scope settings and
their echo, the server's tsconfig list, and each file's status), `results.json` (each file's findings and the hash of the bytes
analysed), `ls-log.txt` (everything the server logged) and `catalogue.json` (the server's rule list).

**Exit codes.** 0, every listed file analysed; 2, refused (the engine, the Node, the rule set, the scope,
an echo that differs, a used folder, or usage), with the reason in `run.json` when the server had
started; 3, nothing analysable; 4, a listed file not analysed, each named in `run.json` (J4).

**Changing what pins a result.** The engine moves only by a governed re-baseline (JAN-SONARCM D-4):
detecting drift is not permission to adopt a new engine. The rule set is a reviewed change; a rule
removed is a class of finding no longer looked for, never a way to silence one finding (that is an
exception, §5). The scope is `sonar-project.properties`, then the census; narrowing it needs a register
entry (§1).

## 8. Exceptions: the register and the marker (JAN-SONARCM S5)

**When.** A finding the engine reports stays only under JAN-ENGC-001 §7.4: a false positive, generated or
vendor-controlled code, or a demonstrated conflict with a higher-order requirement; never convenience or
silence (§5). Fix it when a safe, coherent fix exists.

**The register entry.** In `docs/operations/sonar-exceptions.json`, under the next free id (`EXC-` and three
digits), with §7.4's fields: `tool` (`SonarJS`); `rule`, the engine's key (`typescript:S3776`, which the
committed rule set must hold) and `eslintName`, the name the marker uses; `finding`, the engine's message;
`locations`, each file and how many markers cite the entry there; `why`, `risk` and `controls`; `approval`;
`owner`; and `term`: `temporary`, and when it is true a `removal` condition, a `review` date or an `expiry`
date (`YYYY-MM-DD`). Each text is one line.

**The approval.** A ruling in the decision register (`docs/canon/JPWB-REG-005 Decision and Divergence
Register.md`), named in `approval.ruling`, whose text names the entry's id: a `SPONSOR RULING`
(`"kind": "sponsor"`), or a `DELEGATED` ruling under a delegation that is itself a sponsor ruling
(`"kind": "delegated"`). Never the author's own decision: "An AI agent or the author of a deviation SHALL
NOT self-approve it" (JAN-ENGC-001 §10.1).

**The marker.** On the line above the finding: `// eslint-disable-next-line <rule> -- EXC-nnn <reason>`.
One rule, named as ESLint knows it: the plugin's rules as `sonarjs/<name>`, a borrowed rule by its
upstream name (`@typescript-eslint/<name>`, `unicorn/<name>`, or ESLint core's bare name). Lint must load
that rule for the file, or it fails ("Definition for rule ... was not found."), so a `sonarjs/` marker
cannot land until JAN-SONARCM S2 loads the plugin. V-9 measured the form in both channels; its record is
on `docs/operations/sonar-exceptions.md`.

**What the Sonar scope does not admit.** No other ESLint directive that can turn a rule off: no block
`eslint-disable` or `eslint-enable`, no `eslint-disable-line`, no inline `/* eslint <rule>: off */`, and no
`eslint-disable-next-line` without an exception. The engine matches a directive by its rule name's last
segment, so any directive can silence a Sonar rule. And no `NOSONAR`: the engine honours a comment that
starts with it, in any case, and silences every rule on its line, while the committed rule set does not
hold S1291, the rule that would report it, so only this check sees one.

**Files whose bytes a test pins.** A finding there takes no marker. Its entry gives `pinned` (the file and
its number of findings) instead of `locations`, and the file lies under a folder the register's
`pinnedFolders` declares, with the test that pins it and the pin's words, which the check finds in that
test. The engine baseline holds the count (JAN-SONARCM D-4).

**Commands**, from the JPWB root:
- `bun run sonar:exceptions` writes `docs/operations/sonar-exceptions.md` from the register, and writes
  nothing from a register whose form fails.
- `bun run sonar:exceptions --check` runs every check: the register, the rulings, the declared pins, the
  scan of the Sonar scope and its join with the register, NOSONAR, and the page. It also lists each review
  date and expiry that has passed; the monthly sweep (JAN-SONARCM S4) judges expiry, and the gate judges
  no date.

`verif/sonar-exceptions.test.ts` runs the same checks in `gate:fast`. The 23 refusal comments cycle 6 left
(`docs/_working/DESIGN-sonar-configuration-management.md`, Appendix C) are records awaiting JAN-SONARCM
X1, which converts them into markers with entries; they are not a form to copy.
