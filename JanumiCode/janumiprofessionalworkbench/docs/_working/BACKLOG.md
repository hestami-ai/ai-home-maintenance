# JPWB Backlog

Standing open-work list, seeded 2026-08-20 from a register sweep (REG-F-100..196) plus staleness
findings made while attempting REG-F-120. **Rule inherited from the register: every item here is a
HYPOTHESIS about the tree until re-verified at pickup time** — two of the four items checked on
2026-08-17 were already stale when read, and the SonarQube campaign (58ddb228..172c5c18) has since
rewritten 136 files, so age everything below accordingly.

Retire items by STRIKING in place (`~~item~~` + disposition + commit), never by deleting.

## Actionable now
- [x] ~~**W-3 finding (i): the §34.5 query roster**~~ — **CLOSED 2026-08-20, REG-F-199, in both halves.**
  (a) THE INSTRUMENT: the walk matched unanchored SUBSTRINGS, so `getPwu` read as present inside
  `getPwuTemplate` — the sole positive result in the population it was commissioned to measure. The
  roster is **14 of 14** name-absent, not 13, and this bullet's own named survivor
  (`getAssuranceStatus`-adjacent) was in the ABSENT column all along. Fixed:
  `scripts/tracker/match.ts` + `verif/tracker-name-match.test.ts` +
  `MU-TRACKER-01-boundary-check-always-passes` (KILLED). Blast radius DERIVED over all 118
  consumer-walk items: one tier, two witness citations.
  (b) THE DELTA INVESTIGATION (5 lanes, investigate → adversarially refute, 15 subjects):
  **0 ABSENT · 2 EQUIVALENT · 13 PARTIAL.** No ratified capability is missing outright, so nothing
  from this roster may be filed as a bare gap. **§34.5 is an early, non-exhaustive enumeration, not a
  by-name contract** (REG-F-083 ratifies §34 as a MINIMUM surface and records its own omissions; the
  section supplies no signatures) — **§32.x/§29.x are the contract, and that is where the deltas
  are.** Per-subject roster: `census/f199-query-delta.ndjson`, gated in `tracker-ingest.test.ts`.

### REG-F-199 residue — the deltas the investigation found (each verified by a refuter; re-verify at pickup)

- [ ] **(1) `getObject` is the "unrestricted CRUD" read §34's own preamble forbids** — it is type-blind
  (`queries.ts:214`), stands in for four ratified typed queries, and no call site asserts the
  discriminator. Live consequence, confirmed: `/undertakings/<any-object-id>` renders a PWU, Baseline
  or Decision **as an Undertaking** instead of 404-ing (the loader's only guard is existence,
  `+page.server.ts:250`; `objectType` appears zero times in it). The discriminator IS in materialized
  state and IS checked — on the WRITE side only (`pwu.ts:192`). ⚠ This is the one limb of §34 that
  binds on substance rather than by name.
- [ ] **(2) The OPEN-observation filter is tautological in two read models** —
  `professional-work-graph.ts:100` and `work-projection.ts:113-135` test the RECORDING EVENT's
  `disposition`, hard-coded `'OPEN'` at `assurance.ts:2386`, so a WAIVED or REMEDIATED finding would
  still suppress a green node (DOC-004 §38 limb 2). Every GATE does it correctly, loading current
  state (`assurance.ts:2076-2077` says so in terms) — an intra-repo divergence on one fact.
  ⚠ CAVEAT THAT MUST TRAVEL WITH IT: `RecordAssuranceObservation` is the only observation command and
  no command transitions `disposition`, so today every observation IS open and the defect is
  **unobservable at runtime** — it must be judged from the code, and a probe would wrongly clear it.
- [ ] **(3) `getPwuHierarchy` returns a SUPERSET of the hierarchy** — `professional-work-graph.ts:45-50`
  emits parent→child edges on `DecompositionProposed` alone and never consults the contract's later
  status, so a decomposition validated INVALID (`DecompositionRejected`, a real dispatchable outcome)
  keeps its edges in the graph forever. Also no tombstone filter on nodes, where `listPwas`/`listPwuTypes`
  both have one.
- [ ] **(4) DEF-W4-002 is a FALSE-NEGATIVE deferral, live in four documents** — `G4-gate-package.md:14,:43`,
  `JAN-W4-DR-001:21`, `PROGRAM-STATUS.md:47` all say the Execution Workbench drill-down is deferred; it
  is **built** (JAN-EXECPLAN DWP-01..05, DR-004 DWP-06, JAN-EXECREM). Correct the records, and record the
  genuine residue instead: **the authoring half**. All 19 Undertaking-Workbench form actions were
  enumerated and none authors a plan; the only `ProposeExecutionPlan` path mints a hard-coded single
  TRANSFORMATION step with all four policy bags as empty literals, then auto-approves and activates.
  `ApplyTacticalChange` — a ratified §34.3 command with a real handler — has zero occurrences under `apps/`.
- [ ] **(5) The successor-version gap (the driven half of the headline)** — once PUBLISHED a `pwaId`'s
  `version` is frozen forever (`EditPwa` refuses outside DRAFT; the publication machine has no arrow
  back), so `PwaVersionReference`'s one-pwaId-many-versions addressing has no representation and
  Ref-Demo §19 L741's "changes create a successor version" is unimplementable. ⚠ The *other* half of that
  finding — "RPH-CON-009's version limb is a control that cannot fail" — was **REFUTED by driving it**;
  `packages/rph-application/src/handlers/pwa-version-binding.test.ts` shows the guard firing and
  discriminating. Do not re-file the dead-control claim.
- [ ] **(6) The ratified REL-4 traceability chain breaks at two named hops** — `TraceLinkType`
  (`traceability-view.ts:12-20`) has no PRODUCES/artifact member and `linksFor` has no `ArtifactRecorded`
  case, though `ArtifactRecorded` IS emitted with `producingPwuId` (`artifact.ts:74`); no `DecisionProposed`
  case either. And the consumer keeps a link only if an endpoint is a PWU, so Evidence–SUPPORTS→Claim is
  DROPPED — the exact chain §32.4 names is what the view cannot show. `TraceLinkSchema` is minted by nothing.
- [ ] **(7) Built-but-unreachable seams** — `readAggregateEvents` is implemented
  (`sqlite-storage-adapter.ts:251`) and is NOT a member of `EngineHandle`, so no read surface can ask for
  one object's history; the §28.2 assurance aggregate is computed (`+page.server.ts:131`), serialized, and
  **rendered nowhere**; `plansForPwus` has no per-PWU entry point. Each is a seam, not a build.
- [ ] **(8) Write-only fields (the REG-F-005 shape, alive) — RE-VERIFIED 2026-08-20 with
  identifier-boundary searches, and ONE OF THE FOUR TURNED OUT NOT TO BE A DEFECT.** Confirmed
  written-and-never-read: `affectedClaimIds` (writer `assurance.ts:642`, schema `messages.ts`, one
  test — no production reader), `downstreamImpactObjectIds` (writer `governance.ts:593`, schema
  `objects.ts:374` — those are its ONLY two occurrences in the tree), and
  `professional_work_object_versions` (CREATE at `schema.ts:81`, one INSERT at
  `sqlite-storage-adapter.ts:197`, zero SELECTs). Those three are the REG-F-005 shape and are
  sweep-or-file.
  ⚠ **`activeExecutionPlanId` IS NOT ONE OF THEM — DO NOT SWEEP IT.** It is ratified with zero
  writers and zero readers, and that is a RECORDED DECISION, not drift. RPH-EXE-001 ("a PWU has at
  most one active Execution Plan") is ENFORCED, by DERIVING the fact from authoritative plan state;
  writing the pointer was considered and REJECTED, because it hangs off the PWU aggregate while the
  command targets the Execution aggregate (DOC-002 §3.3), so maintaining it would mean a
  cross-aggregate write plus a PWU event type no contract defines — "inventing a shape to satisfy a
  guard". The reasoning is at `packages/rph-application/src/handlers/execution.ts:394-408`, and it
  also records the original defect: the guard USED to read the pointer, which was permanently
  `undefined`, so its one-active-plan limb was unreachable — "the kernel was wired; the fact it
  decides on was not."
  ⚠ **A READING TRAP, recorded because it nearly caught me.** `enforcement-register.ts:2222` says
  `currentBaselineId` is dead and "that is precisely the shape `activeExecutionPlanId` had before
  RPH-EXE-001 was enforced". That is literally true and easy to misread as "so the field was
  populated" — it was not; the RULE was enforced around it. The register row is about
  `currentBaselineId`'s own liveness, which remains a live finding THERE, not here.
- **NOT residue — already ruled, do not re-file:** `getImpactAnalysis`'s deltas belong to **REG-F-006**
  (OPEN/NARROWED, blocked on sponsor escalation REG-E-030), and `getPwuExecutionStatus`'s missing rollup
  is **corpus-CONFORMANT** under REG-F-080's ratified safe default ("`PWU.executionState` … is
  caller-asserted").
- [x] ~~**W-3 finding (ii): CaptureIntent's ratified birth state is observed by NOTHING**~~ —
  **FIXED 2026-08-20, and the recorded mechanism was WRONG first** (the citation-currency lesson,
  in miniature): the ratified axis state WAS observed (`intent.test.ts` asserts
  `state.intentStatus === 'RAW'`); the unobserved thing was the ENVELOPE MIRROR at birth
  (`lifecycleStatus`, fused with the axis on every transition, set independently in the birth
  literal). Assertion added and proven RED against the exact surviving mutation; correction +
  OBSERVED verdict appended to `census/w3-probes.ndjson`; gate asserts the full history.
- [ ] **A format-conformance RATCHET** — `format:check` is red for 267 files and is invoked by no
  gate, so the standing "conformance arrives edit-by-edit" policy has no measurement and cannot
  fail. A ratchet (the count may not increase, pinned the way the mutation ratchets are) makes the
  policy real without triggering the REG-F-194 wholesale-reformat churn trap. Design-first: it
  changes `gate:fast`.
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
- **`format:check` is red for ~~`scripts/mutants/ledger.ts`~~ 267 FILES, and is in NO gate** —
  **CORRECTED 2026-08-20 by measuring what the note actually claims.** This bullet named ONE file;
  `bunx prettier --check "**/*.ts"` (the exact `format:check` command, `.prettierignore` already
  excluding node_modules/dist/coverage/docs) reports **267**: rph-application 105, rph-demo 38,
  rph-domain 27, rph-engine 17, rph-projections 16, csaa 6, contracts 4, authoring 3,
  scripts/mutants 2, and 3 loose files. `scripts/mutants/ledger.ts` is not a special case; it is two
  of two hundred and sixty-seven. The policy stands — wholesale reformatting is the REG-F-194
  Finding 3 churn trap, and conformance arrives edit-by-edit (verify your edited REGION against
  `bunx prettier <file>`'s output, not the whole file). What changes is that the note no longer
  reads as "one stubborn file".
  ⚠ **AND THE POLICY IS CURRENTLY UNFALSIFIABLE.** `format:check` is referenced by NOTHING —
  derived: no `gate`, `gate:fast`, `test` or `check-types` leg invokes it. So nothing measures
  whether "edit-by-edit convergence" is converging, and the number could rise without any signal.
  That is the hollow-instrument shape this programme is built to name, applied to formatting.
  A RATCHET (the count may not increase) would make the policy real, the way the mutation and
  coverage ratchets do. Recorded as an item below rather than done here, because it touches
  `gate:fast` and is a policy change, not a fix. NOT measured: whether 267 is rising or falling —
  there is no history to compare against, which is itself the point.

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
