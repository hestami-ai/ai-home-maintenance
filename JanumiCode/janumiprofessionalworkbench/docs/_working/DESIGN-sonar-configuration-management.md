# DESIGN — JAN-SONARCM: the Sonar method under configuration management, checked during builds

**Programme:** `JAN-SONARCM` · **Status:** DESIGN, QS1-QS3 ruled 2026-11-13 · **Opened:** 2026-11-13 · **Occasioned by:** the sponsor —
*"we probably should formalize the sonarqube methodology and bring that under full configuration management as well"*

**Companion:** `JAN-TOOLCUR` (`docs/_working/DESIGN-toolchain-currency.md`). Its compatibility matrix and its
`toolchain:check` gate step carry the Sonar engine's version rows; this design relies on both.
**Evidence base:** the Sonar worktree at `e299baef` (paths below are relative to `JanumiCode/janumiprofessionalworkbench/`
unless they say otherwise), the main-line tip `4e05ee0d`, the toolchain and Sonar review (workflow `wf_5eb961a6-be1`)
and the ES-level review (workflow `wf_80efd7bd-1be`). Only read-only commands (searches, `git log`, `git show`,
`git cat-file`, `git ls-tree`) were run to write this; no checkout changed.

---

## 0. In short

**The problem.** Sonar is the code-quality checker JPWB uses, and it lives outside the repository. The engine is an
editor extension on one machine, driven by an untracked script in another project, with no committed rule list, and
no build step runs it. So findings wait for the next campaign: the last gap was 86 days, and that sweep found 512.

**What will change.**
1. Everything Sonar moves into JPWB under git: the runner and cycle tools, the rule list, the scope, the engine
   version (checked at every run) and the record of each cycle.
2. `bun run lint` gains Sonar's rules that exist as ESLint rules, with type information, as errors: Sonar's own plugin
   and the upstream rules Sonar borrows (21 and 26 of the 47 rule keys JPWB has met). Lint already runs in every
   `gate:fast`, so a new finding of those rules stops the gate on the day it is written.
3. `bun run sonar:changed` runs the real Sonar engine on the files a change touched (35 s for 3 files, 376 s for 95),
   per wave and per commit. A full sweep (about 23 minutes) runs monthly and whenever the engine changes. The
   engine's result is the one that counts, and it covers the rules lint lacks; lint is the fast early check.
4. A finding left in place gets a numbered, committed exception (why, risk, approver, owner, review date) and a
   marker that ESLint and Sonar should both honour. Today's findings are held by a per-file count that may only fall.
5. Cycle 6's 152 unfixed findings are sorted: 90 become fix packages ("Tier E"); 62 become exceptions, each with a
   checked reason and approved by a register ruling (today, yours).
6. `scripts/mutants/ledger.ts` (9.9 MB on the main line) is split into parts under 1,000 KB, so Sonar can read it.

**Already decided by you (2026-11-13).** *"we probably should formalize the sonarqube methodology and bring that
under full configuration management as well - ideally in such a way that it funs [runs] during builds so that issues
can be identified and resolved closer or closest to when changes are made."* And *"update to Typescript 6.0+ ...
which should allow us to update to ES2025"* with *"The other corrections you mentioned are agreeable as well"*,
which together settle how the 11 open findLast findings are fixed.

**Your rulings (2026-11-13).**
- **QS1. The licence.** Ruled: carry on as now. *"Since this is OSS and Sonar has an free OSS license I will look into
  getting this project qualified as such so in the meantime we will carry on as we have been."* You are also
  evaluating Aikido Security's free developer tier (*"TBD if it has the same licensing issues"*). So nothing waits on
  a legal reading (D-9, §6.1).
- **QS2. Fail the gate.** Ruled: *"agree as fully recommended"*. Sonar rules are lint errors from the first package,
  and today's findings are held by the per-file count: no old finding blocks a change, and a new one fails unless it
  replaces a fixed one of the same rule in the same file (§8). The ruling also approves that first count (DOC-004 §7.6).
- **QS3. Split ledger.ts.** Ruled: *"Yes, proceed with the revised ledger.ts split."* No agreement with the other
  session is needed: the split keeps the newest entries, and every new one, in `ledger.ts` (D-7), so its appends merge
  as before. Only an edit to a moved older entry needs a hand merge, which git flags and the checks verify; the other
  session gets a heads-up at merge.

---

## 1. Basis and authority

**Terms used once and kept.** A *finding* is one issue a Sonar rule reports at one place. A *rule key* is Sonar's id
for a rule, such as `S3776`. The *engine of record* is SonarQube for IDE 6.3.0 (SonarJS 14.4.0.46458) driven
headless by the runner; its results are the ones that count. The *lint channel* is `bun run lint` carrying Sonar's
rules. The *scope* is the set of files Sonar judges. An *exception* is a finding left in place on purpose, recorded
with JAN-ENGC-001 §7.4's fields. A *marker* is the comment at the finding that names its rule and its exception. A
*baseline* is a committed, derived count of today's findings per file and rule that may only fall. A *sweep* is one
engine run over the whole scope.

### 1.1 What binds

| Text | What it says (quoted) | What it asks of this design |
| --- | --- | --- |
| JAN-ENGC-001 §7.1 (`docs/Recursive Professional Harness/Janumi Professional Workbench - Engineering Constitution.md:480`; Normative, effective 2026-07-17, `:3-6`) | "The repository's checked-in tooling, configuration, scripts, and accepted operations documentation define how quality gates are executed. An out-of-repository guide MAY be consulted as background, but it SHALL NOT silently control a repository whose own configuration differs." | D-1: the runner, rules, scope and records live in JPWB. |
| JAN-ENGC-001 §7.2 (`:484`, `:486`) | "Every change SHALL run the applicable ... static-analysis checks" and "A gate that could not run SHALL be reported as not run, together with the reason and residual risk." | D-2, D-3; J4 (a check with nothing to judge reports "not run", never a pass). |
| JAN-ENGC-001 §7.3 (`:490`, `:492`) | "Quality findings SHALL be remediated fully by default." (`:490`) "Effort, schedule pressure, or the fact that a finding predates the current change is not by itself sufficient justification to ignore a finding introduced or materially worsened by the change." (`:492`) | D-2's baseline holds old findings only while their fix or exception is pending (D-10, including the findings only lint reports). A count cannot see a held finding made worse (§8, item 15). |
| JAN-ENGC-001 §7.4 (`:496-505`) | An exception SHALL record "the tool, rule, finding, and affected location", why, "the risk", "compensating evidence or controls", "the approving authority", "an owner and a removal condition, review date, or expiry". "Convenience and silence SHALL NOT." | D-5 and J1. |
| JAN-ENGC-001 §10.1 (`:597`) | "An AI agent or the author of a deviation SHALL NOT self-approve it." | J6; D-5's approving authority. |
| JPWB-DOC-004 §7.5 (`docs/canon/JPWB-DOC-004 Agent Operating Protocol.md:250`) | "Never suppress a finding just to make a gate green." "Gates on changed code bind at the changed-module grain — repository-wide averages dilute accountability and are diagnostics only." | Baselines are per file and per rule, never one total. |
| JPWB-DOC-004 §7.6 (`:256`, `:258`) | "The identity that authors a change SHALL NOT hold, within that change, the authority to alter the artifacts that judge it." A local gate run "is developer convenience — valuable, and never the guarantee"; an interim carrier "is recorded in the register as an interim carrier with a planned authority transfer". | An exception or a baseline rise is approved by a separate authority (today the sponsor, per `:256`); the new gate steps are recorded as interim carriers (§9). |
| REG-D-012 (3) (`docs/canon/JPWB-REG-005 Decision and Divergence Register.md:128`; sponsor-directed) | "Gates are authored as versioned, policy-shaped reference artifacts ... single-operator conveniences (hooks, local CI) are permitted only as **marked interim carriers** executing the same policy artifacts, with a recorded authority-transfer plan". | The committed rule set and exceptions register are those artifacts; the lint step and `sonar:changed` are marked carriers, and the lint block is generated from the rule set (proposal, D-2). |
| REG-Q-041 safe default (register `:388`), which DOC-004 §7.5 says governs until ruled | "Address findings fully; an exception requires a recorded justification in the change itself; procedure follows the repository's own tooling configuration, not an out-of-repo document." | D-5 (the justification sits in the change); D-1. |
| The sponsor's request and decisions, 2026-11-13 (§0) | Quoted in §0. | The whole design; D-10 for the findLast fixes. |

### 1.2 Provenance only

These inform the design and bind nothing:
- `docs/operations/sonarqube.md` is the current §7.1 procedure (`:3` "This document is the artifact JAN-ENGC-001 §7.1
  names"). This design rewrites parts of it (§6), so its present text is the starting point, not a constraint.
- `janumicode_v2/docs/sonarqube-headless-remediation-guide.md`: background only (`docs/operations/sonarqube.md:7-9`).
  Two committed texts still point to it or to its driver: `sonar-project.properties:2-4` and the tracker row
  `docs/JPWB Implementation Roadmap and Tracker.md:445` (F-2). This design restates both (§6).
- JAN-CSAA-011, a Draft that says "**Authority:** None" (`docs/ASTs and Code Analysis/JAN-CSAA-011 - TypeScript and
  Analysis Tool Integration Standard.md:17`). Its Sonar row (`:143`) already said "component terms and AI-use
  implications require legal review".
- `verif/csaa/jan-csaa-005.inventory.baseline.json:5254-5256` (sonar "NOT_GATE_WIRED"): a dated snapshot that
  "Nothing regenerates" (`verif/csaa/DISPOSITION.md:41-42`).
- The cycle-6 commit messages (`e31c2f8a`, `a318be36`, `e299baef`), the cycle-6 scratch tools and the two reviews.
- REG-Q-049 (register `:427-431`) defers "SAST" and other security gate families; adoption is "by assurance-policy
  authoring under the REG-D-012 pattern ... never by ad-hoc CI accretion" (`:430`), and REG-D-046's ruling 3 keeps
  them deferred (register `:27127-27133`). This design turns on no REG-Q-049 family by name. But the plugin's
  recommended set, which D-2 runs as errors by the lead's decision, holds 59 rules of Sonar's VULNERABILITY type
  (F-6); whether they count as that "SAST" is open (§9).

---

## 2. Scope, and what is out of scope

**In scope.**
- Configuration management of every Sonar piece: the runner and cycle tools, the engine version, the rule set, the
  scope, the cycle records, the exceptions.
- Checks during builds: the lint channel inside `gate:fast`, `sonar:changed` in the edit loop, the monthly sweep.
- How today's refusals are recorded: the register's form (D-5) and the sorting rule (D-10), for the 23 refusals at
  their sites and the 76 family refusals still open (79 less the 3 fixed in `e299baef`). Writing each entry is the
  exception packages' work (below).
- The three items cycle 6 left open: how to record the 152 unfixed findings, "Tier E", and splitting `ledger.ts`.

**Out of scope.**
- Writing each exception entry and each fix: the exception packages and Tier E's packages do that, each as its own
  package (D-10). Fixing the 176 findings still open after cycle 6 (the lead's count, F-14).
- Analysing `.svelte` beyond the ESLint route (D-6).
- SonarQube Cloud, Community Build, the SonarQube CLI and the SonarQube MCP server (D-8 says why).
- Security gate families under REG-Q-049 (§1.2 and §9 for the one boundary question).
- CI. None runs (REG-F-419, register `:36724-36731`). Whether JPWB's nested `ci.yml` is moved or removed is a separate
  decision, as `JAN-TOOLCUR` also says.
- The toolchain matrix and `toolchain:check` themselves (`JAN-TOOLCUR`). This design only adds Sonar and lint rows.

---

## 3. Findings

**F-1. No build step runs Sonar, and campaigns are far apart.**
- `docs/operations/sonarqube.md:32` — "**No gate or CI step runs a scan today.**" `package.json:10-43` names no Sonar
  script.
- JPWB's `.github/workflows/ci.yml` sits "where Actions does not look" (REG-F-419, register `:36728-36731`).
- 29 commits whose subjects name Sonar remediation fall into six date groups (history reviewer; re-derived with
  `git log`). The longest gap is 2026-08-18 to 2026-11-12, 86 days. The sweep after it found "512 findings in 126
  files" (`e31c2f8a` message).
- Lint warnings never fail: `package.json:13` is `"lint": "eslint ."`, with no `--max-warnings` (critic G17).

**F-2. The engine, its driver and the cycle tools sit outside JPWB and are tied to one machine.**
- The runner is `janumicode_v2/.sonar-remediation/batch-runner.js`, which that project's `.gitignore:25` hides
  (sonar-state CM-04, CM-13). It hard-codes `const EXT_BASE = 'C:/Users/mchen/.devin/extensions';` (`:14`) and
  `const NODE_PATH = 'C:/Program Files/nodejs/node.exe';` (`:27`), and it picks "the highest installed SonarLint
  version" (`:15`).
- It resumes from `<outDir>/ledger.json` and queues only the files not yet done (`:56-60`, CM-13); the procedure warns
  that "a stale `ledger.json` in the output dir silently skips files" (`docs/operations/sonarqube.md:42-44`).
- It introduces itself to the server as `productVersion:'5.5.0.78541'` (`:203`), so the engine version must be read
  elsewhere: the extension's `jarDependencies` (SonarJS 14.4.0.46458) or the server's log line "Plugin version:
  [14.4.0.46458]" (CM-18).
- `driver.js:13` still pins extension 5.5.0, which is no longer installed (CM-14). `docs/operations/sonarqube.md:46-48`
  warned on 2026-08-20 that the tooling's "hardcoded machine paths ROT".
- Only a per-user editor setting holds the engine at 6.3.0: Devin's `extensions.json` marks it `"pinned": true`, which
  VS Code-based editors use to stop auto-update (inference from VS Code's meaning of the flag; critic C4). The 6.3.0
  folder was created on 2026-11-12, the day cycle 6 began (history reviewer).
- Only 2 of the 29 Sonar commits record the analyzer version (`e31c2f8a`, `a318be36`; history reviewer).
- Cycle 6's tooling is 40 scripts in a session scratch folder (CM-16). Cycle 1's scratch folders survive as 10 empty
  directories (CM-17).
- Two committed texts still send the method outside JPWB: `sonar-project.properties:2-4` ("scans run headless via the
  janumicode_v2 SonarLint driver") and the tracker row `docs/JPWB Implementation Roadmap and Tracker.md:445` ("Run
  SonarLint/SonarQube headless per the v2 remediation guide ... Wire into CI from **M0**").

**F-3. No rule set is committed, so the engine runs whatever its version activates by default.**
- The language server's own log reads `includedRules=[]`, `excludedRules=[]`, `ruleParameters={}` (CM-19, quoting
  `ls-log.txt:23` from cycle 6's control run). The runner answers configuration requests with `({})` (`:115`) and
  starts the server with `rules:{}` (`:206`) (CM-13).
- The IDE's rule settings are changes against the defaults: "Disable a rule that is enabled by default" and "Enable a
  rule that is disabled by default" (https://docs.sonarsource.com/sonarqube-for-vs-code/using/rules.md, cached
  `vsc-using_rules.md:172-173`).
- For TypeScript, the built-in "Sonar way" of SonarJS 14.4.0.46458 has 440 rules, exactly the 440 typescript rules of
  the hestami-ai Cloud organisation's default profile (web-sonar, measured; 0 differences either way).
- Inference: an extension update changes the active rules, and nothing in git records the change.

**F-4. The scope file is not what the engine reads.**
- `sonar-project.properties:18-22` names 4 source roots and 5 tsconfig globs, and `docs/operations/sonarqube.md:21`
  calls the file "the single scope authority".
- The server's log says it "Found 17 tsconfig.json file(s)", among them `apps/rph-demo/.svelte-kit/tsconfig.json`,
  `apps/rph-demo/e2e/tsconfig.json` and a docs prototype. The 5 globs match 14 tracked files (re-counted with
  `git ls-files`: the root, 10 under `packages/`, `apps/rph-demo`, `verif` and `scripts`; 16 `tsconfig.json` files are
  tracked in all). The log comes from cycle 6's control run of a copy of the runner that differs only in passing
  analyzer properties (CM-01). Strongly supported inference: the language server does not read
  `sonar-project.properties`.
- The only working copy of the scope is hard-coded in a scratch script (`mk_filelist.py:23-25`, CM-01).

**F-5. The refusals on record are in a form no tool honours and §7.4 does not accept.**
- There are 23 refusal comments in 18 files, such as `packages/rph-domain/src/governance.ts:286` "// S6582: kept
  explicit - ...". There are 0 `NOSONAR` and 0 `eslint-disable` lines in the tracked files of `packages/`, `apps/`,
  `verif/` and `scripts/` (`git grep`, case-insensitive, `ledger.ts` included; critic F4). The only hits on disk are in
  untracked build output under `apps/rph-demo/.svelte-kit/` and `apps/rph-demo/node_modules/.vite/`.
- Of the 23: 0 name an approver, an owner, a risk, or a review date or expiry; 2 name a ruling date (sonar-state
  CM-05). The one "expiry/review" hit in `exception-fields.txt` is `scripts/mutants/run.ts:1017`, "`scripts/` was
  outside every type gate until 2026-08-09", which is history, not an expiry. The full list is Appendix C.
- The 79 refusals made by rule family exist only in `e31c2f8a`'s message and a scratch script (CM-06). Two commits
  later, Tier D (`e299baef`) found "The one-line reasons were wrong or incomplete at 32 of the 79 sites" (its message).
- Sonar honours two in-line forms: "Adding the `//NOSONAR` comment at the end of the line will suppress all issues on
  that line. For JavaScript and TypeScript, the use of ESLint disable directives is also supported."
  (https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/languages/javascript-typescript-css/, cached by
  web-sonar as `pages/cloud-jsts.html.txt`).
- SonarJS 14.4 matches a directive on the last segment of the rule name (`return ruleId?.split('/').at(-1)!;`), and it
  registers aliases for the Sonar key, the plugin's ESLint name and the upstream names of modified rules (critic F4,
  reading `packages/analysis/src/jsts/linter/pragmas.ts` at the 14.4 build commit through a summarising fetch tool;
  not run).
- 15 of the plugin's 295 rule names equal an ESLint 9.39.5 core rule (12), a typescript-eslint 8.63.0 rule (2) or both
  (1: `no-unused-vars`, S1481) (web-sonar option A, measured). Under last-segment matching, a directive meant for one
  of those rules may also silence the Sonar rule of the same name in the engine (inference).
- One open finding sits in a file whose bytes a test pins. `verif/fixtures/phase7/reference/src/options.js` (S3776 at
  16) is part of the reference tree whose digest `verif/phase7-rerun-commands.test.ts:175-176` pins ("An edit to any
  file of the reference changes this digest"); cycle 6 restored its decomposition because "four of its tests then
  found changed" (`a318be36` message). The Sonar scope includes it (`sonar-project.properties:18`, `:21`).
- Today's procedure tells authors to keep the plain form: `docs/operations/sonarqube.md:100-103`, "as an inline
  justification comment naming the rule ID (S####) at the site — the repository carries many; follow their form."

**F-6. The in-build route exists, covers part of Sonar way, and today's lint would run it half-blind.**
- eslint-plugin-sonarjs 4.2.2 has 295 rules; its 230 recommended rules are exactly the "Sonar way" rules among them,
  0 differences either way (web-sonar, measured against the 14.4 jar's metadata). By Sonar's type, the 230 are 113 code
  smells, 59 vulnerabilities and 58 bugs (my count over web-sonar's `jar-14.4-rules.json`).
- By the same metadata, 443 Sonar way rules apply to TypeScript (the profile web-sonar measured has 440; the 3 are not
  reconciled). The plugin carries 217 of them. Sonar runs the other 226 as upstream ESLint rules: 88 involve framework
  plugins (React, JSX a11y, Vue, Angular, Testing Library) and 138 do not, namely unicorn 61, ESLint core 44,
  typescript-eslint 26, import 4, promise 1, one shared by ESLint core and typescript-eslint, and S1101, written after
  4.2.2 (my count over `jar-14.4-rules.json` and `notin-14.4-classified.json`).
- The repository records 47 distinct rule keys, all of them Sonar way rules for TypeScript. The plugin implements 21 of
  them, 6 needing type information. The other 26 come from eslint-plugin-unicorn (14), ESLint core (6),
  typescript-eslint (5) and eslint-plugin-import (1); neither unicorn nor import is in `bun.lock` (critic F5). 13 of the
  26 are "decorated", that is, modified by Sonar (Appendix A).
- `eslint.config.mjs:28-30` sets only `globals`, with no parser options, so no type information reaches lint. Without
  it, 3 of the 6 type-aware rules JPWB has met (S1874, S2871, S4043) report nothing and say nothing: each returns `{}`
  when parser services are missing (`cjs/S2871/rule.js:86-87`, `S1874/rule.js:65-66`, `S4043/rule.js:75-76`). The other
  3 (S3735, S5843, S6353) still run and use types only where present (`S3735/rule.js:91-100`, `S5843/rule.js:82`,
  `helpers/regex/rule-template.js:53-55`), so their findings change once types arrive (read in web-sonar's 4.2.2
  download, not run).
- Sonar runs borrowed rules with its own parameters, which are not copied into ESLint (web-sonar option B). Sonar's
  profile allows 7 parameters for S107 (`maximumFunctionParameters` 7, cached `cloud-ts-comprehensive-backup.xml`),
  while ESLint's `max-params` defaults to 3 (`lib/rules/max-params.js:70` in the 9.39.5 download).
- The plugin is a SonarJS master snapshot of 2026-09-28, 189 commits behind the 14.4 build, and lacks 14.4's
  false-positive fixes on S2699, S6324, S1848, S2245 and S4043 (web-sonar option A). Its README (`:596`) says modified
  rules "may differ from the results you may get using SonarQube".
- Typed linting reaches only files that a tsconfig includes. 18 tracked `.js`/`.mjs` files that lint covers under the
  four roots are in none: `scripts/tsconfig.json:17` and `verif/tsconfig.json:23` include only `**/*.ts`, and the app's
  generated tsconfig includes, besides its own type files, only `vite.config`, `src/`, `test/` and `tests/` (the file
  as generated in the worktree today). With `projectService`, typescript-eslint refuses such a file: "... was not
  found by the project service. Consider either including it in the tsconfig.json or including it in
  allowDefaultProject." (`node_modules/@typescript-eslint/typescript-estree/dist/useProgramFromProjectService.js:91`,
  8.63.0).
- Lint ignores `**/harness/**` (`eslint.config.mjs:21-22`), which the Sonar scope includes
  (`apps/rph-demo/harness/pwa-judge-panel.workflow.js` is tracked).
- Typed linting has never been timed on JPWB (critic G09). The TypeScript 6.0.3 dry run type-checked 16 programs, 13
  that extend `base.json` and the app's 3 (LEAD-FACTS). typescript-eslint's guidance: "your lint times should be
  roughly the same as your build times" (https://typescript-eslint.io/troubleshooting/typed-linting/performance).

**F-7. ESLint 9.39.5, the version JPWB has installed (CM-03), already contains a per-file, per-rule count baseline.**
Read in web-sonar's download of the eslint 9.39.5 package (`toolchain/wf/web-sonar/dl-eslint-9.39.5/`), not run on
JPWB:
- `lib/cli.js:440` reads a suppressions file, by default `"eslint-suppressions.json"`.
- `lib/services/suppressions-service.js:129-132`: "If the number of violations is less or equal to the counter,
  messages are moved to `LintResult#suppressedMessages` and ignored. Otherwise, all violations are reported as usual."
  The file keeps only file, rule and count, for errors that carry a rule id (`:249-256`), so a parse error cannot be
  held.
- While a file's count for a rule stays at or under the recorded number, all of that rule's findings there are hidden
  (`:170-174`). So one held finding fixed and a new one of the same rule added in the same file pass unseen.
- `lib/cli.js:528-538`: when an entry no longer occurs, ESLint prints "There are suppressions left that do not occur
  anymore" and returns 2, unless `--pass-on-unpruned-suppressions` is given. But an entry is checked only for a file
  linted in that run (`suppressions-service.js:149-154`). An entry for a path that no longer exists is never reported;
  only `--prune-suppressions` removes it (`:115-121`).
- A directive naming a rule the configuration does not define is an error, not a no-op: `createDisableDirectives`
  keeps a directive only for a defined rule (`lib/linter/linter.js:360`) and otherwise reports "Definition for rule
  '<id>' was not found." (`:391`; `lib/linter/file-report.js:93-96`).
- `lib/config/default-config.js:62`: `reportUnusedDisableDirectives: 1`, so a marker that suppresses nothing is only
  a warning by default.
- ESLint fails on its own only when a pattern matches no file or every matched file is ignored
  (`lib/eslint/eslint-helpers.js:77-84`, `:119-128`, `:416`, `:420`). Losing part of the population passes.

**F-8. Measured costs** (sonar-state M-01, from the runner's own ledgers):
- a full sweep of 457 files: 1,394 s and 1,409 s (two sweeps);
- 95 changed files: 376 s; 35 files: 166 s; 3 files: 35 s (each includes the server's start-up);
- `gate:fast`: 63 min 48 s to 64 min 55 s (`e299baef` message).

**F-9. One file is too big for the engine, and it keeps growing.**
- SonarQube for IDE drops files over a fixed 5 MiB before any analyzer runs:
  `MAX_AUTO_ANALYSIS_FILE_SIZE_BYTES = 5L * 1024 * 1024` (sonarlint-core master, `FileExclusionService.java:73`; the
  installed 6.3.0.79979 class holds the constant 5242880; web-sonar). No setting changes it.
- SonarJS has its own default limit of 1000 KB ("By default, the analysis will exclude all files that are larger than
  1000 KB", Cloud JS/TS page above), which a scanner can raise with `sonar.javascript.maxFileSize`. SonarJS 14.4
  compares a file's bytes with that value × 1000 (`filter-size.ts:21`, web-sonar's copy).
- `scripts/mutants/ledger.ts` is the only tracked `.ts`, `.js`, `.svelte`, `.css` or `.html` file over 1,000,000 bytes
  under the four roots (web-sonar). Two tracked JSON evidence files under `verif/csaa/` are larger too: 7,028,184 and
  1,467,590 bytes (`git ls-tree -l`). The ledger is 9,627,077 bytes at `e299baef` and 9,864,385 bytes at the main-line
  tip `4e05ee0d`, 237,308 bytes more after 7 commits (`git cat-file -s`). Cycle 6 saw that it "returned no findings in
  11 seconds, most likely skipped for size by the analyzer" (`e31c2f8a` message). The lead's later cycle-6 run with a
  raised limit failed for the reason above (the lead's record; not re-run for this design).
- Six files import it: `scripts/mutants/run.ts:20`, `scripts/mutants/scope.ts:46`, `scripts/mutants/show.ts:6`,
  `scripts/export-guard.ts:57`, `verif/mutant-verdict.test.ts:24`, `verif/mutant-ledger.test.ts:22`. Its exports are
  `DeclaredMutant` (`:93`), `isHistory` (`:167`) and `DECLARED_MUTANTS` (`:171`).
- One entry targets the ledger itself: `DD0-M1-abolished-entries-count-as-measured` (`:2407-2408`), anchored on the
  body of `isHistory` (a search for `file: "scripts/mutants/ledger.ts"`, either quote style).
- On the main line, each of the 23 first-parent commits since 2026-10-15 whose subject contains the word "Package"
  changed `ledger.ts`. Of the 174 first-parent commits in that window, 92 did by `git log --first-parent --
  scripts/mutants/ledger.ts`, or 96 when each commit is diffed against its first parent, which adds 4 merges that
  bring ledger changes in (read-only git on `jan-exec/phase7c`).

**F-10. `.svelte` files are outside every Sonar channel and outside lint.**
- JPWB tracks 11 `.svelte` files, all under `apps/rph-demo/` (`git ls-files`). `docs/operations/sonarqube.md:29-30`:
  they "have not been covered by any campaign to date".
- The Cloud JS/TS page lists supported frameworks as "React JSX, Angular, Vue.js, Node.js, Express, Flow", and the
  word "svelte" appears 0 times on it (cached page). The engine's bridge bundles no Svelte parser (CM-18).
- Lint does not reach them either: no `files` glob in `eslint.config.mjs` matches `.svelte` and no Svelte parser is
  installed (CM-03, inference from flat-config rules; LA-01). `svelte-check` is their only check.
- A Sonar staff member wrote in May 2026, "I'm not currently aware of any plans for Svelte" (web-sonar, quoted
  through a summarising fetch tool; the thread's address was not recorded, so this quote is unverified here).

**F-11. The gate already has the patterns this design needs.**
- `mutants:changed` (`package.json:40`) works on the change, not the file (`scripts/mutants/scope.ts:10-11`), keeps
  "broken" and "nothing was watching" on separate exit codes (`:17-23`), and is kept out of `gate:fast` because
  after a commit "`git diff HEAD` is empty" (`:39-41`). With nothing to examine it prints "This is not a pass" but
  exits 0 (`:128-133`).
- `coverage:floor` (`package.json:38-39`) records counts per file, "you may not add uncovered code"
  (`scripts/coverage-floor.ts:12-17`), fails a rise and a population change separately (`:27-33`), and keeps its
  baseline derived: "Regenerate it with `--write` in the SAME COMMIT as the change that moved it" (`:35-41`). Its
  `--write` records what is measured, rises included (`:134-140`); against an unearned rise there is only review:
  "Editing a number here to make a gate pass is indistinguishable, afterwards, from the work that would have earned
  it" (`:37-38`).
- `guards:export` (`package.json:41-42`) "refuses a STALE CENSUS" (`scripts/export-guard.ts:36-38`), and its
  `--baseline=<path>` flag lets a test hand it a doctored copy (`:77-80`; used at `verif/export-guard.test.ts:242-249`).
- A test pins the whole of `gate:fast`, every step in order, `bun run lint` among them
  (`verif/assurance-surface.test.ts:218-259`, `expect(steps).toEqual([...])`); `verif/gen-freshness.test.ts:137-138`
  pins its own step's wiring.
- The ledger names its anchors by text, not line (`verif/guard-enforcement-ledger.ts:56`), and a ruling it cites must
  exist: "`verif/mutant-ledger.test.ts` resolves it against the register" (`scripts/mutants/ledger.ts:155-157`).

**F-12. The hosted and self-hosted servers do not fit today.** (web-sonar options C and E unless noted)
- Cloud's Free plan: unlimited public projects, private code "Up to 50k LOC", "Only main branch analysis", custom
  quality profiles "Not available"
  (https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans.md).
- Free and Team terms: "SonarSource may use Customer Data and Usage Data provided to Free and Team Plans to develop,
  train, tune, and improve SonarSource's products, services, and machine learning models"
  (https://www.sonarsource.com/legal/cloud-free-and-team/).
- The organisation's default quality gate fails new code below 80% coverage, and JPWB writes no LCOV report
  (`vitest.config.ts:131` `reporter: ['text', 'json-summary', 'html']`). How Cloud would score that is open (G07).
- New organisations default to "Sonar way core": 248 TypeScript rules, without S3776 or S7780.
- Cloud runs 49 security and 7 architecture rules for TypeScript that the IDE does not ("tssecurity" and
  "tsarchitecture" in the organisation's default profile).
- Community Build 26.11.0.134175 bundles SonarJS 14.3.0.46350, one minor behind the IDE and Cloud, and runs as a
  service: in Docker (Docker Desktop 29.9.2 runs here), or from a ZIP with Java 21 (Temurin 21.0.7 is installed), an
  install Sonar says "will be removed in a future release". "Commercial-level rules are not available in SonarQube
  Community Build" (https://docs.sonarsource.com/sonarqube-for-vs-code/using/rules.md). Its main-branch-only limit is
  sourced from Server 10.8 documentation and the docs site's assistant, not a 26.x page (critic G19).
- The SonarQube CLI checks code quality on local changes only through its "Vortex" analysis, which needs a paid plan;
  "Secrets detection runs locally and needs no SonarQube connection"
  (https://docs.sonarsource.com/sonarqube-cli/analysis/analysis.md; web-sonar option G). The SonarQube MCP Server
  works one file at a time, and "analyze_code_snippet will be removed in a future release"
  (https://docs.sonarsource.com/sonarqube-mcp-server/reference/tools.md; option H).

**F-13. The analyzers' licence has an AI clause that reads onto our workflow.**
- SSAL v1.0.1, "Last Updated November 20th, 2025", is the text Sonar publishes today
  (https://www.sonarsource.com/license/ssal/; checked against the cached page text). Its grant is "for any
  Non-competitive Purpose", which excludes "(c) employing, using, or engaging artificial intelligence technology that
  is not part of the Program to ingest, interpret, analyze, train on, or interact with the data provided by the
  Program, or to engage with the Program in any manner".
- The IDE's analyzer names only "Plugin-License: SSALv1" (`sonarjs.jar` manifest), and Community Build's bundled
  analyzers are SSALv1 too (web-sonar option E). eslint-plugin-sonarjs 4.2.2's `LICENSE` file is "SONAR
  Source-Available License v1.0, Last Updated November 13, 2024", while its npm metadata says "LGPL-3.0-only"
  (web-sonar). Clause (c) reads word for word the same in v1.0 (`dl-esps-4.2.2/package/LICENSE:52-57`) and in v1.0.1.
- A Sonar staff member wrote on 2026-06-17 that he was clarifying "whether the eslint-plugin-sonarjs project is
  actually SSALv1 or not, because currently, in GitHub, LGPLv3 is attached"; the last post, 2026-06-22, gave no answer
  (https://community.sonarsource.com/t/would-sonarsource-permit-a-rust-implementation-of-eslint-plugin-sonarjs-for-oxc/183564;
  quoted through a summarising fetch tool).
- Sonar's announcement, 2024-11-19
  (https://community.sonarsource.com/t/a-new-sonar-license-for-sonarqube-analyzers/130731): "If you are scanning your
  code using SonarQube Community Build or SonarQube for IDE, don't worry—nothing will change!" and, in the same post,
  "The use of AI technology to engage with the software outside of what is already included in the software is
  strictly prohibited".
- Cycle 6 handed each fix agent "Sonar's message verbatim" (`e31c2f8a` message).

**F-14. Cycle 6 left 152 findings unfixed, in three kinds.**
- Counted from the three commit messages (my arithmetic): 64 "Left open" in Tier A/B + 12 "Not decomposed" in
  Tier C + 79 family refusals − 3 fixed in Tier D = 152. The 76 family refusals still open are S9382 ×54, S7750 ×11,
  S4036 ×7, S7503 ×3 and S7784 ×1.
- The lead's classification sorts them into three kinds: 51 where Sonar's fix is wrong here (48 S9382 deliberate
  sequential awaits, 3 S7503 interface-shaped async functions), 90 that are valid but need an amendment the repository
  controls, and 11 where a fix gains nothing. The per-finding list is in the lead's cycle-6 records, not in the
  repository; this design did not re-derive it.
- 176 findings remain open after cycle 6 by the lead's count. The commit messages alone give 512 − 284 − 45 − 3 = 180
  not cleared by a fix; I could not explain the difference of 4 from them (Appendix B).

---

## 4. Decisions

Each decision gives the question it settles, the options, the choice and the reason. Where this design adds a
mechanism the lead did not name, it says **(proposal)**, so the lead can keep or drop it; §9 lists them.

### D-1. Everything Sonar lives in JPWB under git — LEAD DECISION

**Question.** Where do the runner, the tools, the engine pin, the rule set, the scope and the records live?

**Options.** (a) As today: runner in `janumicode_v2`, tools in scratch, scope hard-coded, rules unstated. (b) All of
it in JPWB, with machine paths from committed configuration. (c) Drop the IDE engine for a server (D-8).

**Choice: (b).**
- The headless runner moves into JPWB (proposed: `scripts/sonar/`), with the cycle tooling: the file list, triage,
  classify, compare and the wave helpers (CM-16 lists them).
- Machine paths come from a committed configuration read with `JAN-TOOLCUR`'s matrix. No absolute machine path
  (`C:/Users/...`, `C:/Program Files/...`) is written in code. **(proposal)** The configuration holds the pinned
  versions and a location relative to the user's profile; the engine's rows (extension 6.3.0, language server
  6.3.0.79979, SonarJS 14.4.0.46458, bundled JRE 21.0.12.1) belong to the matrix's "Sonar runner" coupling group, and
  the runner uses the Node the matrix records, not a fixed path.
- The engine version is pinned and checked at every run. The runner refuses a different version unless it is
  re-baselining (D-4). Between runs, `JAN-TOOLCUR`'s `toolchain:check` (its first `gate:fast` step) also fails when
  the installed SonarLint version drifts from the matrix. **(proposal)** The version recorded with a result is read
  from the extension's `jarDependencies` and the server's "Plugin version" log line, never from the runner's own
  `productVersion`, which says 5.5.0.78541 (F-2).
- A committed rule set lists the active rule keys and their parameters. **(proposal)** The runner hands it to the
  server as differences from the pinned engine version's defaults (included rules = the list less the defaults,
  excluded rules = the defaults less the list, and the parameters that differ), because the IDE's settings are
  changes against the defaults (F-3). It records the server's echo of them with each result. The server exposes
  `includedRules`, `excludedRules` and `ruleParameters` (CM-19). That the headless server applies a list this way is
  unverified; the first package proves it (V-4).
- The runner derives the scope from `sonar-project.properties`, because the server does not read it (F-4).
  **(proposal)** It also passes the 5 tsconfig globs to the server as analyzer properties; whether the server
  honours them is unverified (V-3).
- **(proposal)** Every run writes to a new, empty output folder. Resuming needs an explicit flag and covers only files
  whose content hash matches the folder's ledger entry. A listed file with no fresh result is reported as not
  analysed (J4), never skipped in silence (F-2; V-20).
- Cycle records live in `docs/operations/sonarqube.md`, which also fixes its stale points: §3 step 5 names
  `bun run csaa:inventory:check` (`:64`), a script that left with CSAA (`verif/csaa/DISPOSITION.md:41`), and §6's
  history stops at 2026-08-19 (`:118-126`).

**Reason.** §7.1 forbids what exists today, and the pieces have already rotted once (F-2).

### D-2. The in-build check runs in `bun run lint` — LEAD DECISION; RULED by the sponsor 2026-11-13 (QS2)

**Question.** How does a Sonar finding surface during the build, close to the change?

**Options.** (a) Nothing in the build (today). (b) eslint-plugin-sonarjs alone: 21 of the 47 keys met. (c) The plugin
plus unicorn and import, the matching ESLint core and typescript-eslint rules, and typed linting: the 47 keys,
approximately, and more of Sonar way (see "Coverage" below). (d) The engine itself inside `gate:fast`: a full sweep
takes about 23 minutes, and a diff is empty once work is committed (F-11). (e) A server-backed scanner (D-8).

**Choice: (c).**
- Add eslint-plugin-sonarjs (4.2.2; 295 rules; its recommended set is the part of Sonar way the plugin carries) to
  `bun run lint`. The recommended set runs whole, so its 59 vulnerability-type rules run as errors too (F-6; §9).
- Add eslint-plugin-unicorn and eslint-plugin-import, and turn on the upstream rules behind the other 26 keys
  (Appendix A); which borrowed rules beyond those 26 is "Coverage" below.
- Turn on typed linting (`projectService`), because 6 of the plugin's 21 rules need type information and lint has
  none today (F-6).
- Sonar's rules are errors for new code; today a warning never fails (F-1).
- Existing findings are either recorded exceptions (D-5) or held by a per-file baseline that may not rise, the
  pattern of `coverage:floor` and `guards:export` (F-11).
- Measure lint time first: typed linting has never been timed on JPWB (F-6, G09).
- Parity is approximate. The plugin is a 2026-09-28 master snapshot; the engine is SonarJS 14.4.0.46458. So the
  engine's sweep stays the judge of record (D-4), and the lint channel is the early check.

**(proposals, within this decision)**
- **Coverage.** Route (i): the lint block is generated from the committed rule set (D-1): every entry that has an
  ESLint form, which is the plugin's 217 Sonar way rules for TypeScript and the 138 borrowed rules outside framework
  plugins (F-6). One artifact with two readers is what REG-D-012 (3) asks of an interim carrier (§1.1). It needs
  eslint-plugin-promise for one rule, and S1101 waits for a newer plugin. Route (ii): only the 26 keys met, so lint
  runs 243 of the 443 rules (217 + 26), and a new finding of the other 112 non-framework rules is seen only by
  `sonar:changed` or the sweep. This design proposes (i); the lead chooses (§9). Either way, unicorn and import
  supply only the rules named, not their own recommended presets.
- **Parameters.** Each borrowed rule runs with the parameters the rule set records for its Sonar key, for example
  `max-params` at 7 for S107, not ESLint's default 3 (F-6). V-21 checks it.
- **Typed files.** Typed linting covers the scope's TypeScript files only. The 18 `.js`/`.mjs` files no tsconfig
  includes run the untyped rules, or go in `allowDefaultProject`. Otherwise each is a parse error with no rule id,
  which the suppressions file cannot hold, and lint is red from its first run (F-6, F-7; inference about how the
  configuration would be written).
- **The baseline.** Use ESLint's own suppressions file (F-7). It already refuses a rise (all of a rule's findings in
  the file are then reported) and a stale entry for a file it lints (exit 2). Entries for paths that no longer exist
  pass silently, so two checks are added. (1) Compared with the base, counts may only fall, netting each rule's
  counts across a rename git reports (`git diff -M`), so `--suppress-all` cannot buy a pass and moving a held file is
  not a rise. (2) Every entry names a file in the tree. The base is the merge-base with the branch the change lands
  on, because after a commit `git diff HEAD` is empty (`scripts/mutants/scope.ts:39-41`). A rise needs the sponsor's
  separate authority (DOC-004 §7.6, `:256`); QS2's answer is that authority for the first baseline. Residual: a rise
  already merged into the base branch is invisible to later runs, unless the baseline's register entry lists each
  approved rise by ruling id and a test resolves it, as `verif/mutant-ledger.test.ts` resolves `abolishedBy` (F-11).
- **Its record.** Each baseline is one entry in the exceptions register (D-5): why (findings older than the gate), the
  risk, the compensating control (the count may only fall), the approving authority (the sponsor's answer to QS2), an
  owner and a review date. The entry links the record that lists each held finding by file, line and message at
  baseline time (the first lint run's output, and D-4's sweep record), because ESLint's file keeps only file, rule and
  count (F-7) while §7.4 asks for "the tool, rule, finding, and affected location" (`:498`). Then J1 holds for held
  findings too.
- **Upgrades.** An upgrade that moves the lint baseline re-records it in the upgrade's own commit. A fall is
  ordinary; a rise is governed and filed with the upgrade's register entry (J3). `JAN-TOOLCUR`'s D-11 step 3, as
  amended 2026-11-13, now says the same of the lint baseline; the engine baseline follows D-4 (§9).
- **Scope.** Apply the Sonar rule block to the Sonar scope from `sonar-project.properties`, so both channels judge the
  same files, except `apps/rph-demo/harness/`, which lint ignores (F-6); the census names it. The properties file
  excludes `*.test.ts` and `__tests__/` (`sonar-project.properties:21`), so Sonar rules in lint skip them too, while
  lint's other rules still cover tests (`eslint.config.mjs:43-48`).
- **Population.** The number of files lint judges with the Sonar block equals a committed census and is never 0
  (J4). ESLint fails on its own only on an empty population (F-7); losing part of it passes.
- **Pins.** eslint, @eslint/js, typescript-eslint and the three plugins are pinned exactly, because the lint baseline
  pins their output, as `JAN-TOOLCUR`'s D8 pins vitest and @vitest/coverage-v8 for the coverage floor; they join the
  matrix's lint group (G3). Today the first three are caret ranges (`package.json:45`, `:50`, `:55`). unicorn 65.0.1,
  which SonarJS 14.4 bundles, declares ESLint ">=9.38.0", so it admits ESLint 10 too (whether it runs there is
  unmeasured); 79.0.0 needs ">=10.4" (web-sonar option B). Parity with the engine argues for 65.0.1 on either major.

**Reason.** The sponsor asked for issues to be found "closer or closest to when changes are made". Lint already runs
on every `gate:fast` (`package.json:27`, step 6 of the 13 `bun run` steps there) and in any editor with ESLint, and
the plugin's recommended set is the part of Sonar way the plugin carries. The engine stays the authority because the
copies differ.

### D-3. A per-change check with the engine of record: `sonar:changed` — LEAD DECISION

**Question.** How does the engine itself judge a change before it lands, without slowing `gate:fast`?

**Options.** (a) In `gate:fast`: after a commit the diff is empty (F-11). (b) In the edit loop, per wave and per
commit, like `mutants:changed`. (c) Only the monthly sweep.

**Choice: (b).** `bun run sonar:changed` runs the committed runner on the files changed against a base (`HEAD` or a
`--range`), the same mechanics as `mutants:changed`. Measured: 3 files 35 s, 35 files 166 s, 95 files 376 s (F-8).
The orchestrator runs it per wave and per commit; it stays out of `gate:fast`.

**(proposals, within this decision)**
- Its comparison basis is the engine's own committed baseline, per file and per rule, written by the full sweep
  (D-4). It only falls: `sonar:changed --write` lowers the counts of the changed files and refuses a rise, which needs
  a ruling as in D-2. This departs from `coverage:floor --write`, which records rises too (F-11). The alternative,
  analysing the base version of each changed file too, doubles the cost.
- Exit codes keep the signals apart, as `scope.ts:17-23` does: 1 for a new finding with no exception, 2 for an engine
  that could not run or is the wrong version, and a separate non-zero code for "nothing analysable" (only `.svelte`,
  `.md` or test files changed). That last one departs from `scope.ts:128-133`, which exits 0, because J4 and §7.2
  (`:486`) require a check that judged nothing to report "not run", never a pass.
- A file the engine skips for size is reported as not analysed, never as clean (`e31c2f8a`'s ledger lesson, F-9).

**Reason.** It gives the engine's own verdict on each change in minutes, not at the next campaign.

### D-4. The periodic full sweep — LEAD DECISION

**Question.** How often does the engine judge the whole scope, and how are results compared over time?

**Options.** (a) Campaigns when someone remembers (today; one gap was 86 days). (b) Monthly, and whenever the engine
changes. (c) On every commit: 1,394-1,409 s each.

**Choice: (b).** The sweep runs monthly with `JAN-TOOLCUR`'s currency review, and whenever the engine version changes
(a re-baseline). Each result records the engine version, and finding counts are never compared across engine
versions (J2, J3). **(proposal)** Each sweep appends a cycle record to `docs/operations/sonarqube.md` and writes only
falls into the engine baseline D-3 reads; a finding missing from the baseline is reported as new, to be fixed or
excepted. A re-baseline under a new engine version is a governed act, filed with a ruling, like the governed
instruments of `JAN-TOOLCUR`'s D11 (its step 4).

**Reason.** The lint channel is approximate, so the engine must still see everything regularly. Two engine versions
can run different rules, or the same rule differently (F-3), so a count compared across them says nothing reliable.

### D-5. Exceptions under JAN-ENGC-001 §7.4 — LEAD DECISION

**Question.** How is a finding left in place on purpose recorded so that every channel honours it and §7.4 is met?

**Options.** (a) Plain comments plus commit messages (today): no tool honours them and 0 of 23 carry the required
fields (F-5). (b) `//NOSONAR`: silences every rule on its line and holds no fields. (c) Exclusions set on a Sonar
server: outside git (J5). (d) A committed register with §7.4's fields, and an ESLint directive at the site that names
the rule and the register entry.

**Choice: (d).**
- A committed exceptions register, proposed as `docs/operations/sonar-exceptions.md` or a JSON file beside it. Each
  entry records §7.4's fields: tool, rule, location, why, risk, compensating controls, approving authority, owner,
  and expiry or review date.
- The site marker: `// eslint-disable-next-line sonarjs/<rule> -- EXC-nnn <reason>`.
- Do not use `NOSONAR`.
- Sonar honours ESLint directives (F-5), and SonarJS 14.4 resolves a directive by the last segment of the rule name,
  so one directive should satisfy both ESLint and the engine. This is read from source, not run: the first package
  verifies it with a run (V-9).

**(proposals, within this decision)**
- For the 26 keys outside the plugin, the marker must name the rule as ESLint knows it, because `sonarjs/<name>`
  exists only for the plugin's 295 rules. Examples: `no-await-in-loop` for S9382, `@typescript-eslint/require-await`
  for S7503, `unicorn/prefer-code-point` for S7758 (rule names from SonarJS 14.4's metadata, web-sonar
  `notin-14.4-classified.json`).
- A marker names only a rule the lint configuration loads for that file, because ESLint reports any other as an
  error (F-7). So markers sit only in files the Sonar block covers (D-2).
- A marker's last segment must mean the Sonar rule it excepts. 15 plugin rule names are shared with ESLint core or
  typescript-eslint (F-5), so a marker for one may also silence the other in the engine; the register lists the 15,
  and V-9 measures the effect.
- The register's machine-readable form is the JSON, because the gate must join markers to entries. The page is
  generated from it and checked for freshness, as `gen:check` checks generated code.
- The approving authority is a register ruling: by the sponsor, or under a delegation the register records (DOC-004
  §7.6, `:256`, names "delegation records"; the procedure's own precedent `cd0bad4d` settled two findings "under
  delegated authority", `docs/operations/sonarqube.md:101-102`). A test checks that the ruling exists, the way
  `verif/mutant-ledger.test.ts` resolves `abolishedBy` (F-11). It is never the change's own author (DOC-004 §7.6;
  JAN-ENGC-001 `:597`). The 2 sites that already cite a ruling date (F-5) are matched to their rulings.
- An entry locates its finding by its marker text, not by a line number (the ledger's own reason, F-11).
- Moving the 23 site comments into markers follows `docs/operations/sonarqube.md:85-90`: list the file's ledger
  anchors first, because rewriting a comment inside anchored text detaches a mutant (REG-F-100, register `:2983`).
- Files whose bytes a test pins cannot take a marker without re-pinning. Any edit under
  `verif/fixtures/phase7/reference/` changes the digest `verif/phase7-rerun-commands.test.ts:175-176` pins, and one
  open finding sits there (F-5). Two routes: (a) take that folder out of the Sonar scope, with the register entry
  `docs/operations/sonarqube.md:26-27` requires before the scope is narrowed; or (b) record its findings as exceptions
  with no marker, located by path, rule and count and held by the baselines, flagged so V-8's "entry with no marker"
  limb exempts them. This design leans to (b), which narrows nothing; the lead chooses (§9).
- Whether a marker that suppresses nothing is an error (`reportUnusedDisableDirectives`) waits for V-9: for a
  modified rule the two channels can disagree on a line, so a marker the engine needs could look unused to ESLint.

**Reason.** It is the only option that lives in git, carries §7.4's fields and can be honoured by both channels.

### D-6. Svelte — LEAD DECISION

**Question.** What judges the 11 `.svelte` files?

**Options.** (a) `svelte-check` only (today). (b) Later, eslint-plugin-svelte with svelte-eslint-parser, so ESLint
rules reach `.svelte`. (c) An untested idea: list `.svelte` in `sonar.javascript.html.file.suffixes`; web-sonar
expects false positives on variables used only in markup.

**Choice: (b), as a later step; `svelte-check` stays.** No Sonar channel analyses `.svelte` (F-10). The ESLint route
is unofficial: Sonar staff called it "not an officially tested configuration" (2026-03-12,
https://community.sonarsource.com/t/javascript-s4030-no-unused-collection-crashes-on-svelte-use-directive/179385,
quoted through a summarising fetch tool).

**Reason.** It is the only route that exists; making it a later step keeps the first packages to supported paths.

### D-7. Split `ledger.ts` — LEAD DECISION, revised 2026-11-13 after the sponsor's question; RULED (QS3): *"Yes, proceed with the revised ledger.ts split."*

**Question.** How does the 9.9 MB ledger come inside the engine's reach?

**Options.** (a) Leave it: the engine never reads it, and its 5 MiB limit is fixed (F-9). (b) A scanner run with
`sonar.javascript.maxFileSize` at 9865 or more could include it at the main-line tip's 9,864,385 bytes, since SonarJS
excludes a file whose bytes exceed that value × 1000 (F-9); web-sonar's 9628 fitted `e299baef`'s 9,627,077 bytes, and
the figure rises as the ledger grows. No scanner is in use (D-8), and the IDE never can. (c) Split it.

**Choice: (c).**
- Move the older entries of `DECLARED_MUTANTS`, in their order and with their bytes unchanged, into parts under
  1,000 KB each. At today's 9,864,385 bytes that is at least 10 parts. Leave headroom in `ledger.ts` (proposal: its
  own bytes under about 200 KB after a split).
- `ledger.ts` keeps the interface, `isHistory` and the NEWEST entries, and joins the older parts in front of them, so
  the six importers do not change (F-9) and the place where new entries are written does not move.
- Re-point the entries that target `ledger.ts` itself. My search found one, `DD0-M1`, anchored in `isHistory`, which
  stays, so it may need only a check that its anchor is still unique; its note on why it keeps a leading tab
  (`:2412`) must be re-read once the entry's own text moves to a part.
- Prove the split by a deep-equal of the joined array: same ids, same order. That shows no judgment changed, which is
  the grain DOC-004 §7.6 measures alteration at (`:256`).
- Merging with the main line (revised after the sponsor asked, 2026-11-13: *"Why does it need to be agreed with the
  other session for the ledger.ts edit and testing since this is running under its own git worktree for this
  Sonarqube work?"*). The worktree keeps the split and its tests apart, so no agreement is needed to do them. The
  coupling is only at merge: each of the main line's 23 "Package" commits since 2026-10-15 changed the ledger (F-9),
  and because new entries stay in `ledger.ts`, those appends merge as before. An edit the other session makes to an
  entry that moved to a part shows as a git conflict, never silently; it is resolved by applying the edit in the part,
  and the anchor census (`verif/mutant-ledger.test.ts`) and the deep-equal check prove the resolution. The other
  session gets a heads-up at merge, through the sponsor, that older entries now live in parts. Merge between paid
  runs.

**(proposals, within this decision)**
- Each part carries its entries' bytes unchanged, with no formatter pass: `ledger.ts` "is prettier-non-conformant at
  HEAD and stays that way", because reformatting it detached anchors before (`docs/operations/sonarqube.md:114-116`).
  New entries still go at the end of `ledger.ts`. When `ledger.ts` nears 1,000,000 bytes, a committed script moves
  its oldest entries, bytes unchanged, into a new part (a mechanical rotation, proved by the same deep-equal), so
  text that tells builders where to append stays true.
- A gate test that no file the engine analyses (the scope's JavaScript and TypeScript files) exceeds 1,000,000 bytes,
  so a part cannot grow past the limit unseen (V-12). The ledger grew by 237,308 bytes in 7 main-line commits, so
  about 200 KB in `ledger.ts` after a split leaves room for roughly 20 such commits; propose a warning at 800,000
  bytes so the rotation is planned rather than forced by a red.

**Reason.** An instrument the engine of record cannot read is outside the Sonar check that counts (the lint channel
would reach it, but only approximately, D-2); the scope file itself says "An instrument nothing measures is an
instrument nobody can trust" (`sonar-project.properties:16-17`).

### D-8. Not SonarQube Cloud or Community Build, for now — LEAD DECISION

**Question.** Should a Sonar server judge JPWB?

**Options.** (a) Cloud through a local scanner. (b) Community Build on this machine. (c) Neither, for now.

**Choice: (c). Revisit if CI arrives.**

**Reason.** No CI runs (F-1). Cloud's Free plan analyses only the main branch, allows no custom profile or gate, lets
Sonar train on customer data, and its default gate's coverage condition would meet a repository with no LCOV report
(F-12). A new Cloud organisation's default profile lacks S3776 and S7780. Cloud alone would add rules, 49 security
and 7 architecture rules; security scanning is a family REG-Q-049 defers (inference: those 49 fall in it).
Community Build carries an older analyzer (14.3.0.46350), lacks those commercial rules, and needs a service kept
running. The SonarQube CLI's quality check needs a paid plan, and the MCP server works one file at a time (F-12), so
neither replaces the runner.

### D-9. The licence — SPONSOR RULING (2026-11-13, QS1): go on as now

**Question.** Does the SSAL's AI clause (v1.0.1 on Sonar's site, v1.0 in the plugin's own `LICENSE`, the clause the
same in both; F-13) allow JPWB's agents to read and fix findings from Sonar's analyzers?

**Options.** (a) Go on as now. (b) Get a short legal reading before building more automation on the analyzers.

**Ruling: (a).** *"Since this is OSS and Sonar has an free OSS license I will look into getting this project
qualified as such so in the meantime we will carry on as we have been. I'm also looking at the free developer tier
for Aikido Security which I recently installed and appears to provide the same capabilities as Sonarqube and maybe
more. TBD if it has the same licensing issues."* The lead had recommended (b); the two readings below stay as the
record of why the question was asked (not legal advice).

**Consequences.** Nothing in §6.1 waits on a legal reading. If the project qualifies for Sonar's OSS plan (on
SonarQube Cloud: public projects, unlimited branches and pull requests, custom profiles and gates; F-12), D-8 is
revisited. If Aikido Security is taken up, it is one more channel: its rule coverage, how it runs locally or in the
build, and its licence terms (any clause on AI use included) are checked before it gates anything. The exception
register (D-5) and the per-file count (D-2) record the tool per finding, so they stay tool-neutral.

**The two readings.**
- *Reading 1, the clause covers us.* Our fix agents are "artificial intelligence technology that is not part of the
  Program", and handing them "Sonar's message verbatim" uses AI "to ingest, interpret, analyze ... the data provided
  by the Program". The grant is only "for any Non-competitive Purpose". Sonar's announcement also says AI use
  "outside of what is already included in the software is strictly prohibited".
- *Reading 2, it does not reach ordinary use.* The same announcement told IDE and Community Build users "nothing will
  change!". The clause's two neighbours, (a) and (b), are about competing with SonarQube; on this reading (an
  interpretation, not a quote) the licence aims at products built on Sonar's output. And the plugin's own licence is
  unsettled (npm says LGPL-3.0-only; F-13).

**Why the lead had recommended (b).** Both readings are plausible, the second rests partly on a forum notice rather than the licence
text, and JPWB's method depends on agents. An earlier JPWB draft reached the same view: "component terms and AI-use
implications require legal review" (JAN-CSAA-011 `:143`, provenance only).

### D-10. Fold in what cycle 6 left open — LEAD DECISION, resting on the SPONSOR RULING of 2026-11-13 (R1)

**Question.** What happens to the 152 unfixed findings, to "Tier E", and to the ledger split?

**Options.** (a) Leave the 152 where cycle 6 left them: in commit messages and a scratch script (F-5). (b) Send them
all back to fix agents, although for 62 of them a fix is wrong here or gains nothing. (c) Sort them by kind: amend
kind 2, record kinds 1 and 3 as exceptions.

**Choice: (c).**
- **The 152 by kind** (F-14). Kind 2, the 90 valid findings that need an amendment, becomes Tier E: amendment work
  packages. Kinds 1 and 3, the 51 where Sonar's fix is wrong here and the 11 where a fix gains nothing, become
  exceptions in the register (D-5), each reason checked site by site before it is recorded; the 32 of the 79 one-line
  reasons found wrong or incomplete show why one reason per rule is not enough (F-5).
- **Tier E** is the planned amendments, grouped by the amendment each needs: ledger re-anchoring, raising `lib`,
  re-pinning a fixture, a new test, fixed paths. Examples from the commit messages (my reading, not the lead's
  list): 56 Tier A/B findings that "sit inside anchored mutation-ledger text or are named by a mutation's replace
  text"; Tier C's "five whose agents found that reaching 15 would move anchored ledger text";
  `faithful-wordfreq.js`, whose find strings the seeded faults pin; and `completeAssuranceAssessment`, where
  `coverage:floor:check` refused a branch "no test reaches".
- **SPONSOR RULING** (2026-11-13, *"The other corrections you mentioned are agreeable as well"*), on the findLast
  group, the 11 open S7750 findings. 3 of the 11 fixes sit inside live mutation-ledger anchors and re-anchor them in
  the same commit: `packages/rph-ports/src/ports/process-runner.ts:252` (P2B-a), `scripts/phase7/half-b.ts:453`
  (E3-M21), `scripts/phase7/run-report-core.ts:3132` (P6X-M-M15). The fix at `scripts/reviewer-qual/run.ts:276` gets
  a guard, because `findLast` would stop rejecting a malformed results file (a null line before the last SELECTION).
- The group rests on the same ruling's other sentence, *"update to Typescript 6.0+ ... which should allow us to
  update to ES2025"* (§0): it waits for `JAN-TOOLCUR` to raise `lib`, because `findLast` is ES2023 and the shared base
  is ES2022 today (`scripts/mutants/run.ts:1016-1020`). The same raise opens Sonar's preferred fix for 2 S4043
  findings (ES-level review); both S4043 fixes (`toReversed`) re-anchor their mutants in the same commit,
  `apps/rph-demo/src/lib/server/assurance/review-fence.ts:291` (1 mutant) and `:309` (4 mutants). The group is done
  once, either as `JAN-TOOLCUR` T4 or in Tier E; the roadmap picks one.
- **The ledger split** is D-7.
- **(proposal) Findings only lint reports.** Decorated rules, the plugin's older snapshot and different options make
  lint report findings the engine does not (13 of the 26 borrowed rules JPWB has met are decorated; F-6). D-2's first
  baseline holds them under their own register entry with a review date; each is then fixed, excepted with a reason
  that names the channel difference, or removed by matching the lint rule's options or scope to the engine.
- Until its fix or exception lands, each of the 152 is held by the baselines (D-2, D-3), never left silent (J1).

**Reason.** It turns the open list into recorded work and recorded exceptions, the two dispositions §7.3 and §7.4
allow.

---

## 5. Invariants

The rules the work must keep true. J1-J5 are the lead's; J6 and J3's second sentence are proposals.
- **J1.** A Sonar finding is fixed or carries a committed exception with §7.4's fields. Silence is never a
  disposition. (A finding held by a baseline is covered by that baseline's register entry and the finding list it
  links, D-2.)
- **J2.** The engine version, the rule set and the scope used for a result are recorded with that result.
- **J3.** Counts are compared only under the same engine version. **(proposal)** Lint counts likewise, only under the
  same lint versions: ESLint, @eslint/js, typescript-eslint, the three plugins and TypeScript.
- **J4.** A Sonar check with an empty file population fails. A file the engine skipped counts as not analysed.
- **J5.** Nothing Sonar-related controls the repository from outside it (JAN-ENGC-001 §7.1).
- **J6 (proposal).** No change both introduces a finding and approves its own exception, or raises the baseline that
  holds it: "An AI agent or the author of a deviation SHALL NOT self-approve it" (JAN-ENGC-001 `:597`). Approval comes
  from a ruling that exists in the register.

---

## 6. What changes where

A design-level map, not the roadmap. Proposed names are marked "proposed".

| Where | What changes | Decision |
| --- | --- | --- |
| `scripts/sonar/` (proposed, new) | The headless runner, moved from `janumicode_v2/.sonar-remediation/batch-runner.js`, with a fresh output folder per run, and the cycle tools (file list, triage, classify, compare, wave helpers); `sonar:changed` and the sweep entry point | D-1, D-3, D-4 |
| `JAN-TOOLCUR`'s matrix (proposed there as `scripts/toolchain/matrix.json`) and a small Sonar configuration beside it | Engine rows (extension, language server, SonarJS, JRE) and location patterns, no absolute machine paths; lint-group rows for the three plugins (proposal) | D-1, D-2 |
| A committed rule-set file in `scripts/sonar/` (proposed) | The active rule keys and parameters the engine is given, and under D-2's route (i) the source of the lint block | D-1, D-2 |
| `sonar-project.properties` | The scope keys unchanged, and the runner now reads them; lines 2-4 restated to name the JPWB runner instead of janumicode_v2's driver | D-1, J5 |
| `docs/JPWB Implementation Roadmap and Tracker.md:445` | Restated to name the JPWB runner, the lint channel and `sonar:changed`, with the v2 guide as background | D-1, J5 |
| `docs/operations/sonarqube.md` | Rewritten procedure; cycle records from cycle 6 on; `:64` and `:118-126` corrected; `:42-44`'s stale-ledger warning replaced by the fresh output folder; `:100-103` replaced by the marker and register | D-1, D-4, D-5 |
| `eslint.config.mjs` | The Sonar block: the plugin's recommended set and the borrowed rules with Sonar's parameters (generated from the rule set under route (i)); typed linting for the scope's TypeScript files; errors; scoped as the properties file says | D-2 |
| `package.json`, `bun.lock` | The three plugins, and eslint, @eslint/js and typescript-eslint, pinned exactly (proposal); the lint command's suppressions location; `sonar:changed` and a sweep script | D-2, D-3, D-4 |
| `eslint-suppressions.json` (ESLint's default name, proposed location the JPWB root) | The lint baseline, derived | D-2 |
| A new engine-baseline file in `verif/floors/` (the folder holds `per-file-floor.baseline.json` and `export-guard.baseline.json` today; file name proposed) | The engine baseline the sweep writes and `sonar:changed` reads | D-3, D-4 |
| `docs/operations/sonar-exceptions.json` and a generated `.md` (proposed) | The exceptions register | D-5 |
| The 23 refusal sites in 18 files (Appendix C) | Plain comments become markers with register entries | D-5 |
| `scripts/mutants/ledger.ts` and its parts (location proposed by the roadmap) | The split; `ledger.ts` keeps the interface and `isHistory` | D-7 |
| `verif/` | New tests: register and marker join, no `NOSONAR`, baselines only fall, lint population census, file-size limit, lint wiring, split equivalence, lint block equals rule set, fresh runner output, the 152's dispositions (§7) | D-1, D-2, D-5, D-7, D-10 |
| The register | A REG-D entry when this lands; the interim-carrier records for the lint step and `sonar:changed`; the register entries of the two baselines; the ruling that approves the first exceptions | §1.1, D-2, D-5 |
| `janumicode_v2/docs/sonarqube-headless-remediation-guide.md` | Nothing; it stays background | J5 |

### 6.1 Order and dependencies (proposal; a preview for the roadmap)

1. After `JAN-TOOLCUR` T0 (the matrix and `toolchain:check`): D-1, that is, the runner's move, its configuration,
   the engine pin and the rule set (V-1 to V-4, V-20).
2. D-5's register format, with the V-9 run that settles the marker form.
3. D-4's first recorded sweep, which writes the engine baseline; then D-3's `sonar:changed`, which reads it.
4. D-2's lint step: measure lint time first. Record the lint baseline after `JAN-TOOLCUR` T2 (ESLint 10), or let T2
   re-record it under its own register entry (D-2's upgrade rule).
5. D-7's split (QS3 ruled yes, 2026-11-13). It can be built and tested in the worktree at any time; it merges between
   paid runs.
6. D-10's exception packages and Tier E. The findLast group follows `JAN-TOOLCUR` T1's `lib` raise. In
   `scripts/mutants/run.ts`, the S7750 fix at `:1031` lands in the same commit as the restatement of the findLast note
   at `:1016-1020` (ES-level review), and the S6325 marker for `:1022-1026` sits in the same comment block, so it
   lands with or after that commit.

QS1 was ruled on 2026-11-13 (carry on as now), so no step waits on a legal reading.

---

## 7. How each decision is verified

Each check names the run or test that must go RED first, and why it can. Fixtures are temporary copies, never edits
to the committed tree: editing in place "edits the very thing it measures, and a `finally` does not run on a KILL"
(`scripts/gen-freshness.ts:29-30`).

| # | Check | Predicted red | Why it can go red |
| --- | --- | --- | --- |
| V-1 | The runner refuses a wrong engine (D-1) | Point the configuration at a temporary copy of the 6.3.0 extension folder whose `package.json` names another version (the extension's and SonarJS's in `jarDependencies`): the runner exits 2 and names both versions. | Today's runner takes the highest installed folder without a word (`batch-runner.js:15`). The obsolete 6.2.0 folder is not the fixture: it is marked for removal (`.obsolete`, CM-18) and may go at the editor's next start (inference). |
| V-2 | No machine path in committed Sonar tooling (D-1, J5) | A census test over `scripts/sonar/` fails on a copy containing an absolute drive path (for example `C:/Users/` or `C:/Program Files/`). | The runner being moved has two such literals: `C:/Users/mchen/.devin/extensions` (`:14`) and `C:/Program Files/nodejs/node.exe` (`:27`). |
| V-3 | The scope comes from the properties file (D-1) | (a) A `.ts` file added under `scripts/` without regenerating the census fails the population check. (b) The server's log must list the tsconfigs the 5 globs match. | (b) is red against today's runner by construction: cycle 6's control run of a copy that differs only in passing analyzer properties logged "Found 17" (CM-01, F-4). |
| V-4 | The engine runs the committed rule set (D-1, J2) | A control rule set that drops S3776, run on a seeded function of cognitive complexity 16: the committed runner reports no S3776, and the server's echo lists S3776 under `excludedRules`. | Today's runner sends `rules:{}` (`batch-runner.js:206`) and reports S3776 on that seed. An echo alone cannot tell "list applied" from "defaults" when the list equals Sonar way, because the settings are changes against the defaults (F-3). |
| V-5 | Lint catches a new Sonar finding (D-2) | A copy with a seeded function of cognitive complexity 16: `bun run lint` exits 1 naming `sonarjs/cognitive-complexity`. | S3776's default threshold is 15 (web-sonar). |
| V-6 | Typed rules really run (D-2) | A seeded `.sort()` with no compare function on a `number[]` is reported by S2871 with `projectService` on; the control, the same seed with it off, is silent. | `S2871/rule.js:86-87` returns `{}` without parser services (F-6), so the two runs must differ. S2871 reports a zero-argument sort-like call on an array-like type unless the sort only normalises a comparison (`S2871/rule.js:91-96`; read, not run), so the seed must not sit inside such a comparison. |
| V-7 | The lint baseline only falls (D-2) | (a) One more held finding in a held file: all of that rule's findings there are reported, exit 1. (b) A held finding fixed but not pruned: exit 2. (c) A doctored suppressions file with one count raised against the merge-base: the no-rise check exits 1. (d) An entry for a path not in the tree: the entry check exits 1. | (a) and (b) are ESLint 9.39.5's own behaviour (F-7); (c) uses the `--baseline=` pattern of `verif/export-guard.test.ts:242-249`; for (d), ESLint alone passes such an entry (F-7). |
| V-8 | The register meets §7.4 and joins its markers (D-5, J1) | Four fixtures, each failing alone: an entry with no owner; an approval citing a ruling the register lacks; a marker with no entry; an entry with no marker that is not flagged as a pinned-bytes file. | Each limb has its own fixture, so one check cannot hide inside another (`scripts/coverage-floor.ts:32-33`). |
| V-9 | One directive satisfies both channels (D-5) | First package, a run of both channels on a seeded finding: no marker, both report it; a marker naming the rule, neither does; a marker naming another rule, both still report it; a marker naming a rule lint does not load, lint fails. Two measurements beside it: whether a marker using one of the 15 shared names (F-5) also silences the Sonar rule in the engine; and whether the engine still reports S2925 in `apps/rph-demo/e2e/` once the runner passes the properties' test inclusions (S2925's scope is "Tests" in the 14.4 metadata, and `sonar-project.properties:20` classes only `*.test.ts` and `__tests__/` as tests). | The cross-channel effect is read from source only (F-5); if the engine ignores the directive, the second case stays red. The fourth case follows from `lib/linter/linter.js:360`, `:391` (F-7), read but not run. |
| V-10 | No `NOSONAR` (D-5) | A copy with one `//NOSONAR` fails a census test that expects 0 in the scope. | It silences every rule on its line (F-5). |
| V-11 | `sonar:changed` judges the change (D-3) | In a temporary worktree: a seeded finding in a changed file exits 1 naming file and rule; a change to `.svelte` only exits with the "nothing analysable" code; a wrong engine exits 2; `--write` after the seeded finding refuses to raise the engine baseline. | The seeded file is in the diff, and each limb has its own exit code (F-11). |
| V-12 | No file the engine analyses exceeds 1,000,000 bytes (D-7, J4) | Red on today's tree: `ledger.ts` is 9,627,077 bytes at `e299baef`. The check covers the scope's `.js`, `.jsx`, `.cjs`, `.mjs`, `.ts`, `.tsx`, `.cts` and `.mts` files (SonarJS's default suffixes, less `.vue`; web-sonar); the two JSON evidence files under `verif/csaa/` (7,028,184 and 1,467,590 bytes) are outside it. | It is red until the split lands, then guards the parts as the ledger grows (F-9). |
| V-13 | The split changed no judgment (D-7) | A deep-equal of the joined array against the pre-split array, read from git in the split's commit, fails when a copy drops one entry, and again when it swaps two. If kept afterwards, it checks that the pre-split ids are a prefix of the joined array, because the ledger keeps growing. | Ids and order are both compared. `verif/mutant-ledger.test.ts` must stay green, `DD0-M1` included. |
| V-14 | The engine reads every part (D-7) | A sweep of the parts reports each as analysed; the control, a copy with one known finding seeded into a part, must report it. | Cycle 6's "returned no findings in 11 seconds" was silence, not proof (F-9). |
| V-15 | Counts compared under one engine only; each result carries its configuration (D-4, J2, J3) | The compare tool given two records with different engine versions refuses; a record that lacks the engine version, the rule-set hash or the scope hash is refused too. | Doctored records; J3 forbids the comparison and J2 requires the fields. |
| V-16 | Lint's population (D-2, J4) | A copy of the config that ignores `scripts/` makes the census check fail. | ESLint alone fails only on an empty population (F-7), never on a partial one. |
| V-17 | The lint step stays wired (D-2) | A doctored `package.json` whose `lint` script lacks the suppressions location fails a new wiring test. Removing `bun run lint` from `gate:fast` is already red today (`verif/assurance-surface.test.ts:218-259`). | The new test reads the root scripts the way `verif/gen-freshness.test.ts:137-138` does. |
| V-18 | Each of the 152 has one disposition (D-10, J1) | A census over the committed cycle-6 record: each of the 152 is named by exactly one Tier E package or one register entry. Two fixtures, each failing alone: a finding in neither, and a finding in both. | Red today: the per-finding list is not in the repository (F-14). |
| V-19 | The `scripts/reviewer-qual/run.ts:276` guard keeps rejecting a malformed results file (D-10) | A results file with a JSON `null` line before the last SELECTION is rejected after the `findLast` rewrite. | A plain `findLast` rewrite accepts it and returns that SELECTION, where the `filter().at(-1)` form throws a TypeError (ES-level review, K15). The test belongs to whichever package lands the findLast group. |
| V-20 | A run never reuses an old result (D-1, J4) | Run the runner twice on one output folder, editing a seeded file between the runs: the second run reports the edited file's new result, or reports it as not analysed, never its first result. | Today's runner resumes from `<outDir>/ledger.json` and skips files already done (`:56-60`), so it returns the first run's result (F-2). |
| V-21 | The lint block runs the committed rule set (D-2) | A census test: the Sonar keys and parameters in the lint block equal the rule set's entries that have an ESLint form. Two fixtures, each failing alone: a rule set with one key removed; S107's parameter set to 3. | Without it, the two drift apart unseen, and ESLint's defaults differ from Sonar's (`max-params` 3 against 7; F-6). |

---

## 8. Self-critique: what could be wrong, what is unmeasured, the risks

1. **Parity is approximate, and unmeasured.** Modified ("decorated") rules and a plugin 189 commits behind the engine
   mean the lint channel will report a different population from the engine. How many findings the new lint rules
   raise on today's tree is unknown; it could exceed the engine's 176. Measure before turning errors on. D-10's
   fourth group (proposal) gives the findings only lint reports a disposition.
2. **Lint time is unmeasured.** Typed linting over the scope, which spans most of the dry run's 16 programs
   (inference), could add minutes to a `gate:fast` that already takes about 65 minutes (F-8, G09).
3. **The one-directive claim is unproven.** It rests on source read through a summarising fetch tool (F-5). If it
   fails, a site may need a second form for the engine, and D-5's marker changes. The 15 shared rule names may also
   let one marker silence two rules in the engine. V-9 is the first test to run.
4. **Unused markers can clash across channels.** For a modified rule, a marker the engine needs may look unused to
   ESLint; this is why D-5 defers `reportUnusedDisableDirectives`.
5. **A marker naming a rule lint does not load fails lint** (F-7; read in the 9.39.5 download, not run). D-5 therefore
   keeps markers to files the Sonar block covers; V-9 confirms it with a run.
6. **The runner drives an editor engine Sonar does not support headless.** "This isn't something that we (Sonar)
   support" (2025-02-24, https://community.sonarsource.com/t/sonarlint-commandline-to-check-code-quality-during-development/135622).
   Pinning plus V-1 turns a silent break into a refusal; it does not make the next version work.
7. **ESLint 9 is end of life** (since 2026-08-06; `JAN-TOOLCUR` T2). Parity with the engine pulls the other way:
   SonarJS 14.4 bundles eslint 9.39.5, typescript-eslint 8.72.1 and unicorn 65.0.1 (CM-18). unicorn 65.0.1's peer
   range admits ESLint 10, so T2 need not move it (D-2).
8. **ESLint's suppressions are keyed by file path** (`suppressions-service.js:150`). A rename shows as new findings at
   the new path (exit 1 until they are re-recorded). The old path's entry is never reported, and only
   `--prune-suppressions` drops entries for files that no longer exist (F-7). So a held count could outlive its file
   and pass to a new file at the same path; D-2's entry check refuses such entries, and its no-rise check nets
   renames.
9. **The baseline is a weakening of judgments**, so DOC-004 §7.6 makes it the sponsor's act. QS2 was ruled yes on
   2026-11-13; had it been declined, the lint step could not fail on Sonar rules until every finding was fixed or
   excepted.
10. **The licence may change the method.** If Reading 1 holds, agent-driven remediation on Sonar's analyzers changes;
    this design's configuration-management parts do not depend on agents. The lint step is the most exposed piece:
    it puts the plugin's findings in front of every agent that runs `gate:fast` (inference; D-9).
11. **Counts I could not reconcile.** 176 against the 180 the commit messages give (F-14); the 51/90/11 split was not
    re-derived; 443 Sonar way TypeScript rules by metadata against the 440 web-sonar measured (F-6). (The 29 Sonar
    commits, their six date groups and the 86-day gap re-derive from `git log`; only calling the groups "cycles 1-6"
    is the history reviewer's inference.)
12. **Typed linting of app files depends on SvelteKit's generated tsconfig.** The import needed a fix because that
    file "did not exist yet on a cold start" (history reviewer); a cold typed lint may hit the same gap (inference).
13. **Everything here is a local run.** With no CI (F-1), DOC-004 §7.6 calls these "developer convenience ... never
    the guarantee". The checks are as strong as the habit of running `gate:fast` before landing.
14. **The split collides with the main line,** whose 23 "Package" commits since 2026-10-15 each changed the ledger (F-9).
    Timing it between paid runs and landing it on the newest main-line tip limit the conflict; they do not remove it.
15. **A count cannot see a swap or a worsened finding.** One held finding fixed and a new one of the same rule added
    in the same file pass, and a held S3776 function that grows from 20 to 30 stays one finding (F-7). §7.3's
    qualifier is about a finding "introduced or materially worsened by the change" (`:492`). Recording each held
    finding's message in the engine baseline would let `sonar:changed` see both, since S3776's message states the
    complexity ("Refactor this function to reduce its Cognitive Complexity from 60 to the 15 allowed.", cycle-6
    scratch `sonar6/classify-final.txt:46`). This design does not yet propose it, so it is a residual risk.
16. **The S2925 sites may move between channels.** S2925 is a Tests-scope rule, and the 6 S2925 markers sit in e2e
    files the properties file does not class as tests; once the runner applies that classification, the engine and
    lint may disagree there (inference; V-9 measures it).

---

## 9. Open items

- QS1, QS2 and QS3 were ruled on 2026-11-13. The sponsor is seeking Sonar's OSS plan and
  evaluating Aikido Security; either result feeds D-8 and, for Aikido, the checks D-9's consequences name.
- **For the lead: keep or drop each (proposal).** D-1: the configuration, the version source, the rule set as
  differences, the fresh output folder. D-2: route (i) or (ii) for coverage, parameters, typed files, the baseline's
  checks and base, its record, upgrades, scope, population, pins. D-3 and D-4: the engine baseline only falls. D-5:
  the marker rules, the approving authority, route (a) or (b) for pinned-bytes files. D-7: the no-reformat rule and
  the size test. D-10: the fourth group. J3's second sentence; J6; §6.1's order.
- **Register entries, filed when this lands:** a REG-D entry adopting this design; the interim-carrier records
  DOC-004 §7.6 and REG-D-012 require for the lint step and `sonar:changed`, each with its authority-transfer plan;
  the register entries of the lint and engine baselines; the ruling that approves the first exceptions (kinds 1
  and 3); and, under D-5's route (a), the entry required before the scope is narrowed.
- **First-package proofs:** V-9 (the directive form and its two measurements), V-4 (passing a rule list to the
  server), V-3 (passing the tsconfig globs), V-20 (no reused result), and the lint-time measurement.
- **For `JAN-TOOLCUR`:** its D11 lists of ordinary and governed re-baselines should name the lint baseline and the
  engine baseline, and its step 7 ("A Sonar re-scan of the changed files") finds nothing in an upgrade that changes
  no source, so it could read "the lint baseline check, plus `sonar:changed` on any source the upgrade changed". Where
  the findLast group lands, T4 or Tier E, once (D-10).
- **The moved runner's runtime and language.** `batch-runner.js` runs under `node` today; JPWB's scripts run under
  Bun; the cycle tools are Python. Port or keep is the roadmap's choice. If the runner moves to Bun,
  `sonar.nodejs.executable` must still name a Node binary: Bun 1.3.14 reports `v24.3.0` (LEAD-FACTS) and would pass a
  version check (untested).
- **Plugin choices:** eslint-plugin-import or its fork eslint-plugin-import-x (neither was researched); under route
  (i), eslint-plugin-promise for one rule.
- **Test files.** D-2's scope proposal follows the properties file, so Sonar rules in lint skip `*.test.ts` and
  `__tests__/`; whether to extend them to tests is a later choice, made with the Svelte step.
- **Whether Sonar way's 59 vulnerability-type rules count as REG-Q-049's "SAST".** D-2 runs them as errors by the
  lead's decision, and cycle 6 handled S4036 and S5332 as ordinary findings; I found no text that settles it. If they
  do count, REG-D-046's ruling 3 keeps that family deferred, and the lead decides whether lint keeps them (the
  engine's sweeps run them either way, as part of Sonar way).
- **If D-8 is ever revisited:** how Cloud scores a missing coverage report (G07); a 26.x source for Community Build's
  branch limit (G19).
- **The per-finding list of the 152** goes into the register (kinds 1 and 3) and the Tier E roadmap (kind 2); V-18
  checks it.
- **The Svelte step** (D-6) and its own design.

---

## Appendix A. The 47 rule keys the repository records, by channel (critic F5)

| Source | Keys |
| --- | --- |
| eslint-plugin-sonarjs 4.2.2 (21; type-aware marked *) | S1121, S1854, S1874*, S2310, S2871*, S2925, S3358, S3699, S3735*, S3776, S4030, S4036, S4043*, S4144, S4158, S4323, S4624, S5332, S5843*, S6353*, S8786 |
| eslint-plugin-unicorn (14; decorated marked †) | S7718, S7744, S7747, S7750, S7755†, S7758, S7763†, S7765, S7773, S7776, S7778†, S7780†, S7781†, S7784† |
| ESLint core (6) | S107† `max-params`, S878 `no-sequences`, S1516 `no-multi-str`, S6325 `prefer-regex-literals`, S6644 `no-unneeded-ternary`, S9382† `no-await-in-loop` |
| typescript-eslint (5) | S4138† `prefer-for-of`, S6551† `no-base-to-string`, S6571† `no-redundant-type-constituents`, S6582† `prefer-optional-chain`, S7503† `require-await` |
| eslint-plugin-import (1) | S3863 `no-duplicates` |

The 47 come from the three cycle-6 commit messages, the rule ids in code comments and web-sonar's set of 25. All 47
are in "Sonar way" for TypeScript (critic F5; re-checked against `jar-14.4-rules.json`). "Decorated" (†) means Sonar
modified the upstream rule: 13 of the 26 outside the plugin (`notin-14.4-classified.json`).

## Appendix B. Cycle 6 in numbers, from the commit messages

| Step | Count | Source |
| --- | --- | --- |
| Fresh sweep at `5fad05f3` | 512 findings in 126 files | `e31c2f8a` |
| Tier A/B cleared by a fix | 284 | `e31c2f8a` |
| Tier A/B refused at the site | 22 findings, on 20 comment lines | `e31c2f8a`; CM-05 |
| Tier A/B left open | 64 (56 inside anchored ledger text or named by a mutation's replace text) | `e31c2f8a` |
| Refused by rule family, sent to no agent | 79: S9382 ×54, S7750 ×12, S4036 ×7, S7503 ×4, S7784, S5332 | `e31c2f8a` |
| Tier C: S3776 functions above 15 | 57; 45 cleared, 12 not decomposed | `a318be36` |
| Tier D: family sites fixed after checking | 3 (one each of S7750, S7503, S5332) | `e299baef` |
| Family refusals still open | 76: S9382 ×54, S7750 ×11, S4036 ×7, S7503 ×3, S7784 ×1 | above |
| Unfixed, by my arithmetic | 64 + 12 + (79 − 3) = 152 | above |
| Not cleared by a fix | 512 − 284 − 45 − 3 = 180 (the lead counts 176 open) | above; F-14 |

## Appendix C. The 23 refusals at their sites today (sonar-state, `exception-fields.txt`, at `e299baef`)

The ESLint name is the rule a marker would name (D-5); names come from SonarJS 14.4's metadata.

| Site | Key | ESLint name |
| --- | --- | --- |
| `verif/arrow-command-census.ts:1160` | S4158 | `sonarjs/no-empty-collection` |
| `packages/rph-domain/src/governance.ts:286` | S6582 | `@typescript-eslint/prefer-optional-chain` |
| `packages/rph-projections/src/handoff-order.ts:120` | S4138 | `@typescript-eslint/prefer-for-of` |
| `apps/rph-demo/e2e/phase7-half-b.e2e.ts:151`, `:336` | S2925 | `sonarjs/no-fixed-wait-in-tests` |
| `scripts/fence-skeleton/core.ts:782` | S7758 | `unicorn/prefer-code-point` |
| `verif/unread-refusal-guard.ts:46` (block `:43-62`) | S8786 | `sonarjs/super-linear-regex` |
| `apps/rph-demo/e2e/pwa-designer-gallery.e2e.ts:17`, `:27`, `:77`, `:82` | S2925 | `sonarjs/no-fixed-wait-in-tests` |
| `scripts/census/derive-invariant-limbs.ts:54` | S8786 | `sonarjs/super-linear-regex` |
| `scripts/reviewer-qual/record.ts:595` | S6582 | `@typescript-eslint/prefer-optional-chain` |
| `apps/rph-demo/src/lib/server/authoring-turn.ts:913` | S7747 | `unicorn/no-useless-spread` |
| `scripts/phase7/run-report-core.ts:4995` | S8786 | `sonarjs/super-linear-regex` |
| `scripts/reviewer-qual/decision-model-pointer.ts:96` | S7780 | `unicorn/prefer-string-raw` |
| `scripts/reviewer-qual/decision-model-live-check.ts:79` | S6582 | `@typescript-eslint/prefer-optional-chain` |
| `scripts/phase7/faithful-wordfreq.js:105` | S3358 | `sonarjs/no-nested-conditional` |
| `packages/rph-application/src/handlers/decomposition.ts:71` | S6582 | `@typescript-eslint/prefer-optional-chain` |
| `scripts/mutants/run.ts:1022` (lines `:1022-1026`; the findLast note at `:1016-1020` shares the comment block and is restated by `JAN-TOOLCUR`) | S6325 | `prefer-regex-literals` |
| `apps/rph-demo/src/lib/server/assurance/review-fence.ts:379`, `:394` | S7758 | `unicorn/prefer-code-point` |
| `verif/canon-provenance.ts:138` (block `:136-155`) | S8786 | `sonarjs/super-linear-regex` |

By key: S2925 6, S6582 4, S8786 4, S7758 3, and one each of S3358, S4138, S4158, S6325, S7747, S7780: 23 in all.
One site shows two rules in conflict: at `scripts/mutants/run.ts:1022-1026`, Sonar's S6325 asks for a regex literal,
and ESLint's `no-control-regex`, on through `js.configs.recommended`, rejects that literal.
