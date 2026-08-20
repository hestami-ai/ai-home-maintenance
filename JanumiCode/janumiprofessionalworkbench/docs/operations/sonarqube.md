# SonarQube Operations — JPWB

**This document is the REG-E-019 placement**: the home, inside JPWB, of the SonarQube operating
procedure that the Engineering Constitution's quality section (L1186) previously reached only by
pointing into the sibling directory. Driver *mechanics* — how the headless SonarLint language
server is spawned, initialized, and driven over LSP — remain documented in
`../../../janumicode_v2/docs/sonarqube-headless-remediation-guide.md`, referenced here **as a
tool**, the way one references bun or vitest. What must not live only there, and now does not, is
the JPWB-specific procedure below.

Authority: Engineering Constitution L1186 (procedure pointer), L1188 (complexity findings addressed
"fully"), L1220 (documented exceptions), reconciled per REG-E-018 as **"explicit recorded
exception, never silence."** Register context: REG-E-019, REG-F-180 P4, REG-F-100.

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

Headless, via the SonarLint language-server driver documented in the sibling guide (§3 quick
start, §6 reconstruction, §7 tooling). Machine-specific prerequisites (extension root, JRE, LS
jar, eslint-bridge, Node path) are in guide §2. The tooling lives in
`janumicode_v2/.sonar-remediation/` (gitignored; reconstructible from guide §6). Findings are
byte-identical to the IDE Problems panel. Batch mode pays the ~30–40 s boot once and streams
files at ~2–4 s each; a stale `ledger.json` in the output dir silently skips files, so a true
re-sweep needs a fresh output dir.

## 3. The JPWB gate per remediation batch

All execution is central (the orchestrator), never inside fix agents; fix/review agents are
edit-only (guide §4.1, learned the hard way). Package manager is **bun** — npm/npx are blocked by
`devEngines`. Per batch:

1. `bun run check-types` — includes `verif/` and `scripts/` tsconfigs; both are part of the tell
   when an instrument edit breaks.
2. Re-sonar the changed files against the pre-batch baseline: targeted findings cleared AND no
   introduced findings (decompositions routinely spawn S107/S7778/S6551/S2301).
3. `bunx vitest run` on the affected projects; `bun run test` for a full pass.
4. `bunx vitest run --project=verif verif/mutant-ledger.test.ts` — **non-negotiable whenever any
   file carrying a ledger anchor was touched** (see §4).
5. `bun run boundary`; `bun run csaa:inventory:check` when any provenance-listed file changed
   (regenerate with `bun run csaa:inventory` — inventory drift is expected whenever docs or
   provenance-listed sources change).
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

L1188 says "fully"; L1220 permits documented exceptions; REG-E-018's reconciliation — explicit
recorded exception, never silence — governs. In practice:

- A finding deferred rather than fixed is **ruled**, with its verification rather than its
  argument, either in the register (pattern: `cd0bad4d`, which settled two deferred regex findings
  under delegated authority) or as an inline justification comment naming the rule ID (S####) at
  the site — the repository carries many; follow their form.
- A principled won't-fix records its rationale where the next scan will meet it. Silence is not a
  disposition.
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
