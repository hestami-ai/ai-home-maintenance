# JPWB Backlog

Standing open-work list, seeded 2026-08-20 from a register sweep (REG-F-100..196) plus staleness
findings made while attempting REG-F-120. **Rule inherited from the register: every item here is a
HYPOTHESIS about the tree until re-verified at pickup time** — two of the four items checked on
2026-08-17 were already stale when read, and the SonarQube campaign (58ddb228..172c5c18) has since
rewritten 136 files, so age everything below accordingly.

Retire items by STRIKING in place (`~~item~~` + disposition + commit), never by deleting.

## Actionable now

- [x] ~~**REG-F-180 P4 re-audit (REG-E-019, Sonar placement)**~~ — **DONE 2026-08-20.** Search was
  stale (hits now exist) but none was the placement — the properties header itself pointed into the
  sibling repo, L1186's defect in a second location. **Placement authored: `docs/operations/sonarqube.md`**
  (scope authority, per-batch gate, the REG-F-100/`f9b8642f` mutation-anchor constraint, L1188/L1220
  exception discipline). REG-F-180 P4 + REG-E-019 updated in place. **Remaining sponsor act:** only REG-E-019's formal
  closure on Ratify Sheet R1 — the L1186 pointer already retired WITH its document on 2026-07-17
  (JAN-ENGC-001 §7.1 replaced it; both audits missed this — see the register's same-day correction).
- [ ] **REG-F-180 P1/P2 audits (never performed)** — REG-Q-045's survivorship hold (does the seeded
  Product Realization PWA carry RPH-DOC-003/004's hierarchy, catalog, profiles, taxonomies
  losslessly?) and REG-D-008's shape-survivorship audit (an enforced repository reference artifact
  for every ratified schema in six source documents). Each is substantial; the entry's own warning
  applies: *"a partial audit that does not name its own scope reads as a complete one."*
- [ ] **REG-F-120 residue** — see Dispositions below; only the orphaned-docstring hunt remained
  performable, worked 2026-08-20.

## Blocked / awaiting sponsor

- [ ] **REG-F-180 P3 (REG-E-020 per-concern coverage floors)** — a ratified floor (100 % guard-logic
  / 90 % projection / risk-based UI) vs `vitest.config.ts`'s explicit, reasoned rejection of
  `perFile` thresholds. Discharging is not typing numbers into a config: it is choosing between a
  ratified floor and a measured ratchet. **Sponsor decision required.**

## Standing policy (not tasks — do not sweep)

- **REG-F-100's 64 grandfathered register entries** — burned down as each is next touched,
  explicitly *"not in a sweep."*
- **`format:check` red at HEAD for `scripts/mutants/ledger.ts`** — reformatting it wholesale is the
  REG-F-194 Finding 3 churn trap. Conformance arrives edit-by-edit. ⚠ Re-verify before citing: the
  sonar campaign touched `ledger.ts`; this fact may have aged.

## Handed off (CSAA coding agent — touch only if we break it)

- **REG-F-196 Finding 1 (OPEN, the material one)** — the only end-to-end capsule witness
  (`repository-smoke.test.ts`, behind `CSAA_REPOSITORY_SMOKE=1`) is in no gate and failed on `main`
  (`PROGRAM_CREATION_FAILED` on `packages/rph-ports/package.json`) before reaching the arrow census.
  Binding until settled: no increment may cite an end-to-end capsule run as evidence.
  ⚠ The sonar campaign has since rewritten much of `packages/csaa` — the failure needs re-confirming
  before being cited.
  ⚠ A SECOND smoke suite is also known-failing: `csaa:semantic:smoke:declaration-context-analysis`
  (~72 min/run, opt-in) was found failing since BEFORE the campaign and REPORTED rather than fixed
  (`ef1f884c`, final section) — same class as Finding 1.
- **csaa CONTROLs remain ungradeable** while `EXCLUDED_PROJECTS = ['csaa']` holds — the filter
  reaches whole-workspace runs only (`run.ts`), so named-victim mutants are unaffected.

## Dispositions (recorded so they are not re-litigated)

- ~~REG-F-120: "21 further findings survived refutation and are not yet worked"~~ — **the population
  is UNRECOVERABLE and the named third of it was already done.** The 18 unnamed findings exist in no
  audit artifact anywhere in the repository (searched 2026-08-17, re-searched 2026-08-20); of the
  3 named: `failedFiles` docstring **fixed in place** (`run.ts:865-877`, survived the sonar rewrite),
  `OwnedLifecycleTarget` hollow **resolved in place** (`pwu.ts:465-475` — kept, narrowly scoped, "a
  NAME for the owned set … NO enforcement behind it", real protection named as
  `rejectArrowOwnedBySemanticCommand` + `verif/lifecycle-arrow-declarations.test.ts`), orphaned
  docstrings **already fixed at `e802fa22`, the same day the entry was filed** (plus two more at
  `8996e5d5` the entry never named). A five-file hunt over the entry's own merge-target files returned
  zero candidates — the orphans lived in `verif/` and `handlers/`, which the recorded remedy never named.
  Full chronology struck into REG-F-120 in place, 2026-08-20.
