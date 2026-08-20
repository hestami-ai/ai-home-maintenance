# JPWB Backlog

Standing open-work list, seeded 2026-08-20 from a register sweep (REG-F-100..196) plus staleness
findings made while attempting REG-F-120. **Rule inherited from the register: every item here is a
HYPOTHESIS about the tree until re-verified at pickup time** — two of the four items checked on
2026-08-17 were already stale when read, and the SonarQube campaign (58ddb228..172c5c18) has since
rewritten 136 files, so age everything below accordingly.

Retire items by STRIKING in place (`~~item~~` + disposition + commit), never by deleting.

## Actionable now
- [ ] **W-3 finding (i): ~~13 of~~ ALL 14 ratified DOC-002 §34.5 queries are name-ABSENT** —
  `getBaseline`, `getEventHistory`, `getProfessionalWorkGraph` and eleven more appear nowhere in
  packages/+apps/ (consumer-walk with fired positive control; roster: `census/w3-verdicts.ndjson`).
  **CORRECTED 2026-08-20 (REG-F-199): the count AND the named survivor were both wrong.** The walk
  matched unanchored SUBSTRINGS, so `getPwu` read as present inside `getPwuTemplate`
  (`rph-product-realization-pwa/src/ontology.ts:34`, an unrelated ontology lookup) — the sole
  positive result in the population the walk existed to measure was a coincidence of spelling, and
  this bullet's own claim that "`getAssuranceStatus`-adjacent naming survives" named a query
  (`getPwuAssuranceStatus`) that the same roster lists as ABSENT. Fixed:
  `scripts/tracker/match.ts` + `verif/tracker-name-match.test.ts` +
  `MU-TRACKER-01-boundary-check-always-passes`. Blast radius DERIVED over all 118 consumer-walk
  items: one tier, two witness citations. ⚠ STILL OPEN — name-level absence is not capability
  absence; equivalents may exist under other names, and the delta investigation is owed before any
  is filed as a gap. Also name-ABSENT: the ratified **Execution Workbench** surface.
- [x] ~~**W-3 finding (ii): CaptureIntent's ratified birth state is observed by NOTHING**~~ —
  **FIXED 2026-08-20, and the recorded mechanism was WRONG first** (the citation-currency lesson,
  in miniature): the ratified axis state WAS observed (`intent.test.ts` asserts
  `state.intentStatus === 'RAW'`); the unobserved thing was the ENVELOPE MIRROR at birth
  (`lifecycleStatus`, fused with the axis on every transition, set independently in the birth
  literal). Assertion added and proven RED against the exact surviving mutation; correction +
  OBSERVED verdict appended to `census/w3-probes.ndjson`; gate asserts the full history.
- [ ] **W-3b: the 192 invariants' prose→code mapping** — judgment work (lanes + refuters, the
  REG-F-197 pattern), deliberately NOT done by grep in W-3. The canon 62 FAM-N invariants are the
  priority slice.
- [x] ~~**Implementation ground-truth program**~~ — **W-0..W-5 ALL LANDED 2026-08-20 (REG-F-198)**:
  substrate + ingest + census + measured verdicts + DRIVEN bridge + `tracker:build` in `gate:fast`.
  Remaining program residue: W-3b invariant mapping (below), the query-name delta (below), and the
  optional semantic layer (design §4, opt-in, never gate-load-bearing).
  Originally: design + roadmap landed 2026-08-20
  (`DESIGN-implementation-ground-truth.md`, `ROADMAP-implementation-ground-truth.md`): a bun:sqlite
  INDEX over the existing trackers (never a peer tracker) + the capability census with the
  stub-proof verdict ladder. Next: W-0 (substrate, with a check that can FAIL). Driven facts on
  record: better-sqlite3 does not load under bun; bun:sqlite has FTS5 (3.53.0); the corpus has
  zero INV-* ids; R1 checkboxes do not encode ratification.

- [x] ~~**REG-F-180 P4 re-audit (REG-E-019, Sonar placement)**~~ — **DONE 2026-08-20.** Search was
  stale (hits now exist) but none was the placement — the properties header itself pointed into the
  sibling repo, L1186's defect in a second location. **Placement authored: `docs/operations/sonarqube.md`**
  (scope authority, per-batch gate, the REG-F-100/`f9b8642f` mutation-anchor constraint, L1188/L1220
  exception discipline). REG-F-180 P4 + REG-E-019 updated in place. **Remaining sponsor act:** only REG-E-019's formal
  closure on Ratify Sheet R1 — the L1186 pointer already retired WITH its document on 2026-07-17
  (JAN-ENGC-001 §7.1 replaced it; both audits missed this — see the register's same-day correction).
- [x] ~~**REG-F-180 P2: the REG-D-008 shape-survivorship audit**~~ — **PERFORMED 2026-08-20,
  REG-F-197.** 247 schemas: 163 ENFORCED, 35 DIVERGENT_FILED, 18 DIVERGENT_UNFILED, 11
  REFERENCE_NO_FIXTURE, 3 PLACEHOLDER, 17 ABSENT. Full roster with evidence preserved at
  `AUDIT-shape-survivorship-2026-08-20.md` — the REG-F-120 lesson applied. Residue below.
- [ ] **REG-F-197 residue (i): file-or-moot the 18 DIVERGENT_UNFILED** — each divergence needs a
  register filing (deliberate, like the 35 filed) or a drift fix. Rostered in the audit artifact.
  ⚠ 28 of the DOC-007/008/009 actionables are UNREFUTED hypotheses with a measured ~36%% overturn
  rate — re-verify each before acting on it.
- [ ] **REG-F-197 residue (ii): the three PLACEHOLDER types** (`assurance_assessment_evidence`
  z.record, `ControlActionRecommendation`, DOC-004 §33 validator output) — the REG-F-005 shape,
  alive. Real types + fixtures, or a filed exception.
- [ ] **REG-F-197 residue (iii, SPONSOR): the DOC-000 vocabulary-governance fork** — JPWB-DOC-002
  claims to SUCCEED the “retired” charter; REG-D-034 makes the source corpora SOURCE OF RECORD.
  Which governs family-level vocabulary decides whether the DOC-000 ABSENT rows are findings.
- [ ] **REG-F-197 residue (iv, SPONSOR): build-or-moot the DOC-009 legacy-migration table family**
  (`migration_batches`, `legacy_object_mappings`, `dialogue_migration_status`,
  `migration_comparisons`) — greenfield repo, possibly never-to-be-built ground; needs a ruling,
  not a guess. ⚠ ~~"P1/P2 audits (never performed)"~~ — **P1 WAS performed,
  at REG-F-183, the same day as REG-F-180 and three entries later**; this backlog inherited
  REG-F-180's bullet without reading past it (the citation-currency failure, again). REG-F-183:
  all 58 REG-Q-045 items ARE carried, but 36 live in prose strings gated by NOTHING (four carriers:
  `purpose`/`sourceSection`/`completionClaims` on `PwuTemplate`, `appliesToRisk` on
  `ConformanceProfile`).
- [ ] **REG-F-183's remedy increment** — move the 36 prose-carried items to structured, gated
  carriage. Design-first; separate increment by the register's own no-riding rule. Related but
  distinct: `AUDIT-vocab-sourceSection.md` (81% of field-bearing vocab entries cite sources that
  never define their fields — provenance theater; unworked since 2026-07-16).
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
