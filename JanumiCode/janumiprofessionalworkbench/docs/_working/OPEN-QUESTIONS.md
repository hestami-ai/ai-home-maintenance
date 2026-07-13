# JPWB Build — Open Questions for Sponsor

> Non-blocking questions raised during autonomous build (2026-07-10 onward). I proceeded using best
> judgment per the docs' authority-precedence; each item notes the assumption I ran with so you can confirm
> or redirect. Full reconciliation detail: `docs/JPWB Reconciliation Ratify Sheet (M0).md`.

## A. Decided by best judgment — please confirm or correct (non-blocking)

**The one most worth your eyes — A-1 (RphError code→category mapping).** DOC-007 §25 lists the 15 error
codes and, separately, the 10 categories, but gives **no mapping**. I authored this (in `rph-contracts/src/errors.ts`):

| Code | Category |
|------|----------|
| RPH_VALIDATION_SCHEMA_FAILED | VALIDATION |
| RPH_VALIDATION_SEMANTIC_FAILED | VALIDATION |
| RPH_AUTHORITY_INSUFFICIENT | AUTHORIZATION |
| RPH_REVISION_CONFLICT | CONCURRENCY |
| RPH_ILLEGAL_STATE_TRANSITION | INVARIANT |
| RPH_INVARIANT_VIOLATION | INVARIANT |
| RPH_EVIDENCE_MISSING | ASSURANCE |
| RPH_EVIDENCE_INVALIDATED | ASSURANCE |
| RPH_VALIDATOR_OUTPUT_INVALID | ASSURANCE |
| RPH_VALIDATOR_INDEPENDENCE_VIOLATION | ASSURANCE |
| RPH_POLICY_VERSION_MISMATCH | ASSURANCE |
| RPH_SUBJECT_VERSION_MISMATCH | ASSURANCE |
| RPH_BASELINE_VERSION_MISMATCH | INVARIANT |
| RPH_IDEMPOTENCY_DUPLICATE | CONCURRENCY |
| RPH_EXTERNAL_OPERATION_UNCERTAIN | EXTERNAL_DEPENDENCY |

Unused categories (NOT_FOUND, EXECUTION, PERSISTENCE, SCHEMA_COMPATIBILITY) are reserved for codes added
later (aggregate-not-found, step failures, storage errors, upcast failures).

- **A-2** `VALIDATOR_FAILED` treated as an **AssuranceAssessmentState**, not an RphError code (per DOC-004). OK?
- **A-3** `AssurancePolicyDefinition.riskProfiles` **retained as optional** (absent from DOC-007 §17 serialized
  contract, but required by DOC-004 §3.1 — looks like an unintended omission). Confirm it belongs.
- **A-4** Id prefixes **`obl_/art_/dcp_/rcp_`** ratified for the 4 union types DOC-007 §5.1 didn't cover. Confirm tokens.
- **A-5** `pwuKind` and `artifactType` modeled as **validated strings** (ontology-defined data, M8), not global
  enums — no doc enumerates them. Confirm the Product Realization PWA ontology is the right home for the closed sets.
- **A-6** ControlAction `WAIVE` (DOC-002 §37) **normalized to `REQUEST_WAIVER`** (DOC-004 §11 canonical);
  `WAIVE` is not persisted as a distinct action. OK?
- **A-7** `intentStatus` treated as the canonical typed field; `lifecycleStatus` as the generic envelope
  mirror (DOC-006 fixture carried both). OK?
- **A-8** Two distinct aggregate-disposition enums kept (read-model DOC-007 §26.2 = 9 vs composition
  DOC-004 §28.2 = 6). Confirm they should stay separate rather than converge.

## B. Genuinely open (would like input; not blocking)

*(none open — the M4 SQLite-driver question below resolved cleanly; noted in §C for the record.)*

## C. Deferred to a later milestone (not urgent now)

- **SQLite driver (M4) — RESOLVED, FYI.** `better-sqlite3` (your choice) is the driver and works everywhere the
  engine actually runs: vitest's Node test workers and Node hosts (VS Code extension, platform control-plane).
  Bun (the package manager / task runner) cannot `dlopen` it for *direct* `bun run` execution (bun#4290), but
  no engine code executes SQLite under direct Bun. A thin **`SqlDriver`** seam keeps it swappable — a
  `bun:sqlite` backend can be added behind the same interface if a direct-Bun host ever appears. No action needed.

- **38 helper sub-types are referenced but never defined in the specs** (DesiredOutcome, WorkBoundary,
  OutputDefinition, ObligationAllocation, RetryPolicy, InputBinding, EvidenceRequirement, AssessmentCriterion,
  FindingDefinition, …). For M1 these are modeled as permissive structured placeholders (`z.record`), NOT
  fabricated with invented fields. Each is tightened in the milestone that actually defines/uses it
  (assurance→M7, decomposition→M9, execution→M11). Not a decision needed now — just flagging that the specs
  leave these open, so their shapes will be designed (and surfaced for review) as those milestones land.

- **RecompositionContract conflictType/action** value sets — free-form strings for now; may become a registry (M9).
- **PolicyExpression grammar** — planned to unify with the DOC-007 §18 ApplicabilityExpression op set (one DSL, M7).
- **Live validator/executor model adapters** (host concern) — need the Ollama/GPU setup (see `janumicode_v2`);
  out of scope for M0–M13; parked until MP/host work. The engine core calls no LLM.
- **M3 event-name drift** — `MarkPwuReady` emits the generic `PwuStateChanged` (DOC-007 §11.5, the only one
  carrying a payload schema); the semantic name `PwuMarkedReady` (DOC-002 §33) is treated as a display alias.
  Bindings are canonicalized to the command's `emitsEvent`. Confirm this is the right canonical choice.
- **M3 cross-doc transition gap** — `CancelExecutionPlan` (DOC-007) drives `ExecutionPlan.status ACTIVE→CANCELLED`,
  but DOC-002's machine omits that edge. Allowlisted for now; the edge is added when execution lands (M11).
- **M3 unschematized first-slice events** — `ExecutionPlanProposed`, `EvidenceProposed`,
  `AssuranceAssessmentRequested` have no payload schema in DOC-007; modeled as empty/permissive payloads,
  tightened when their subsystem lands.

---

## M9 (decomposition/recomposition + obligation·constraint·assumption) — 2026-07-11

**Please confirm or correct (best judgment, non-blocking):**
- **State-machine defect fixed (upstream M2).** The transition generator (`gen-transitions.expandFrom`) silently
  DROPPED every *slash-compound* source state — e.g. `DISCLOSED/UNDER_VERIFICATION → ACCEPTED`,
  `ACTIVE/ALLOCATED → SATISFIED/WAIVED/VIOLATED`, `RUNNING/RETRYING → FAILED`,
  `SATISFIED/CONDITIONALLY_SATISFIED → INVALIDATED`. **25 legal transitions across 16 machines were missing**
  (Assumption `ACCEPTED`/`FALSIFIED` were unreachable; several PWU/Obligation/Claim/Baseline edges too). Found
  because the Assumption acceptance test failed. Fixed by splitting `/` in `expandFrom`; regenerated
  `transitions.data.ts` (+25 edges); all prior M2 assertions still hold. Flagging because this changed the
  generated machines for many objects — please confirm the newly-restored edges are all intended (they match
  the vocab verbatim).
- **Two composite shapes are genuinely undefined in ALL specs and were AUTHORED by M9:** `IntentMapping`
  (`{childWorkUnitId, servesParentIntentOrObligationId, rationale?}` from §13.2) and `AssumptionPropagation`
  (`{assumptionId, childWorkUnitIds, rationale?}` from §13.1). The other four (`ObligationAllocation`,
  `ConstraintPropagation`, `AggregationRule`, `ConflictResolutionRule`) were pinned from the fixture/persistence.
  The contract-level `ObligationAllocation = {obligationId, allocatedTo[]}` matches the fixture; persistence
  normalizes it to `pwu_obligation_allocations(allocation_type ∈ ALLOCATED/RETAINED/SATISFIED/WAIVED)`.

**Deferred to a later milestone (not urgent):**
- **M9 command + BINDINGS wiring → M10/M11.** The M9 lifecycle events (ObligationAllocated/Retained/…,
  ConstraintPropagated/…, AssumptionDisclosed/Accepted/Verified/Falsified/Expired, RecompositionConflictDetected/
  Failed) and their state machines all exist, but no *command* emits most of them and no BINDINGS rows exist. The
  emitting commands need application handlers, which are governance (waiver/acceptance = M10) and execution
  (assumption-detection, recomposition = M11) concerns. M9 delivers the pure enforcement kernel; wiring lands with
  its owning subsystem.
- **RPH-CNS-004 (expired-waiver) baseline half → M10.** The constraint-side "an expired waiver no longer satisfies
  the disposition" is enforceable in the kernel, but the "affected work becomes review-required + baseline
  promotion blocked" half is a governance/baseline concern (M10). M9 checks WAIVED requires an authority decision;
  the temporal expiry + baseline block is M10.
- **CoverageClaim linkage not persisted inline.** `decomposition_coverage_claims` (§9.3) stores only
  `(contract_id, claim_id, coverage_type, rationale)`; `parentObligationIds`/`childWorkUnitIds` are reconstructed
  via the claim object / trace_links. Rehydration is a persistence-layer join — noted for the persistence pass.

---

## M10 (governance decisions & baseline promotion) — 2026-07-11

**Please confirm or correct (best judgment, non-blocking) — the grounding surfaced 8 genuine cross-doc issues:**
- **ControlAction has THREE non-identical definitions.** Canonical §37 = 18 values (uses `WAIVE`); Assurance
  Policy Catalog §11 / Contract §21 = 23 values (uses `REQUEST_WAIVER`, adds CLARIFY/GATHER_CONTEXT/
  CHANGE_VALIDATOR/INVALIDATE_DEPENDENTS/REQUEST_HUMAN_DECISION); AssuranceAssessment.recommendedControlAction
  §18 = 10 values (spells RESHAPE/REPLAN, not RESHAPE_PWU/REPLAN_EXECUTION). **I took Canonical §37 as
  authoritative for the controller** and normalize the §18 validator spellings into it. The existing generated
  `ControlActionSchema` enum actually carries the 23-value merged set. Confirm §37-as-authoritative.
- **`Decision.authority` is typed `ActorReference`, not `AuthorityReference`.** Both §23.1 and Contract §22 type
  it as identity, yet RPH-GOV-001 needs an AUTHORITY check (scope/validFrom/validUntil). My kernel takes a
  caller-computed `authorityHeld` boolean (the injected authorizer port resolves actor→authority); the field-type
  gap is a spec ambiguity, not a kernel decision. Confirm the port approach.
- **`subjectSemanticVersions` (version-binding) is in Contract §22 + persistence but ABSENT from Canonical §23.1.**
  It's what RPH-GOV-003/P5 depend on; the existing `DecisionObjectSchema` already carries it. Contract shape taken
  as operative.
- **Baseline item shape drift:** Canonical §24.1 `itemObjectIds: string[]` vs Contract §23 `itemObjectVersions`
  (objectId+semanticVersion+contentHash). RPH-BAS-001/002 need the Contract shape (hash per item); the existing
  `BaselineObjectSchema` uses `itemObjectVersions`. Contract taken as operative.
- **Promotion disposition predicate is imprecise in the docs.** RPH-BAS-004 says required assessments must be
  "complete"; §39 Scenario 4 permits promotion with a waiver (assurance WAIVED). I gate promotion on disposition
  ∈ {SATISFIED, WAIVED} and treat CONDITIONALLY_SATISFIED as not-yet-promotable (matches the fixture, which
  re-ran to SATISFIED). Confirm this reading of "no green without assurance".
- **No standalone Waiver object/table.** A waiver is a `DECISION` of decisionType WAIVER + a policy WaiverRule +
  Waiver* events. Expiry-detection mechanism (scheduler vs lazy-on-read) is unspecified — my kernel is clock-free
  (caller supplies `expired`). Flagging that WaiverExpired has no emitting command yet.
- **decisionType RESHAPE/REPLAN vs ControlAction RESHAPE_PWU/REPLAN_EXECUTION** naming mismatch — handled by
  `normalizeControlAction`.
- **Event/status coverage gaps (§26.6):** Decision.status has SUPERSEDED but no `DecisionSuperseded` event;
  DenyWaiver binds to no DecisionStatus value (DecisionStatus lacks DENIED/REJECTED). I did NOT invent enum values
  (the authoritative DecisionStatus is 4 values). Flagging the DenyWaiver→no-status gap for a spec decision.

**Deferred to M11/M13:** baseline lifecycle commands + BINDINGS (SubmitBaselineForReview / ApproveBaseline /
RevokeBaseline / ExpireWaiver) — the events and state machines exist, but the emitting commands need application
handlers, which are M11 (execution) / M13 (replay) concerns.

---

## M11 (execution model, runtime bindings & restart recovery) — 2026-07-11

**Please confirm or correct (best judgment, non-blocking):**
- **RPH-EXE-008 "attempts" vs "retries" ambiguity.** The test title says "maximum three attempts" but the body
  says "the third retry fails ... must not issue a fourth retry" — 3 attempts vs 3 retries (=4 attempts). I
  implemented the cap as MAX TOTAL ATTEMPTS (`retryDecision`: `mayRetry = attemptsMade < maxAttempts`), read
  from the plan's RetryPolicy, never hardcoded. Confirm the intended interpretation.
- **RetryPolicy (and TacticalChange/Escalation/Termination) shapes are undefined in ALL docs.** My kernel takes
  a caller-supplied `maxAttempts`; tightening the actual `RetryPolicySchema` sub-type (currently a permissive
  placeholder) is deferred with the other execution sub-types.
- **`reconciliation_state` has no enumerated values in the docs** (Persistence §35 gives a prose classification;
  the column is free-text). M11 DEFINES the enum `ReconciliationClass` = {DEFINITELY_NOT_STARTED,
  RUNNING_WITH_EXTERNAL_ID, SUCCEEDED_UNRECORDED, FAILED, COMPLETION_UNCERTAIN}. Confirm these names.
- **Citation corrections from grounding** (the earlier roadmap/plan used imprecise refs): the verbatim
  exec≠assurance boundary "`ExecutionStepSucceeded` cannot directly produce `AssuranceState = SATISFIED`" lives
  in the **Contract Package §35.2** (the Canonical doc labels the property §35.1); the execution-vs-assurance
  property is **P1** (not "P6/P8" — P6 = idempotency, P8 = presentation-independence); and the duplicate-command
  guarantee is Persistence **§16** / Contract §35.7 / RPH-PER-002 (Persistence §33 is Data Retention).

**Deferred to M13** (needs the command-bus dispatch refactor; exercised end-to-end by the Reference Undertaking
replay): the Engine **handler-registry** replacing the hardcoded CaptureIntent-only branch; **execution +
RuntimeBinding command handlers** (ProposeExecutionPlan/ApproveExecutionPlan/ActivateExecutionPlan/StartExecutionStep/
CompleteExecutionStep/FailExecutionStep/RetryExecutionStep + RequestRuntimeBinding/AuthorizeRuntimeBinding/...);
and **tightening the execution placeholder sub-types** (RetryPolicy/InputBinding/OutputBinding/Condition/
ExecutionTransition/ModelSelectionPolicy/CapabilityRequest/CapabilityGrant/SandboxPolicy — the objects.ts header
earmarks these for M11, done via the vocab + gen). The RPH-PER-006/008/011 integration properties (aggregate
replay equivalence, outbox atomicity, projection catch-up) are exercised by the M4 persistence layer + M13 replay,
not the pure kernel.

---

## M12 (executable conformance suite + property tests) — 2026-07-11

**Please confirm or correct (best judgment, non-blocking):**
- **`fast-check@4.9.0` added** as a devDependency of `rph-domain` (the spec/tracker name it as the intended
  property-testing lib in three places; it was not installed). The install succeeded (network available).
- **The assurance conformance surface is keyed to Inv-N / §-labels, not `RPH-ASR-*`/`RPH-EVD-*` ids.** The
  `rph-assurance` tests (26) assert the disposition ladder, strictest-unresolved aggregation, evidence
  admissibility, independence, waiver binding, and validator classification — the *behavior* of RPH-ASR-001..012
  and RPH-EVD-001..007 — but by invariant/section label. The conformance manifest marks these families COVERED
  "by concern". If you want per-id RPH-ASR/EVD traceability, that's a labeling pass (low value).
- **`rph-conformance` / `rph-engine` packages (§4 table) are NOT created.** M12's property + gate tests live in
  `rph-domain`. `rph-engine` (the `createEngine(ports, ontology)` composition facade) does not exist yet and is a
  prerequisite for the M13 Reference Undertaking replay — I'll build it as part of M13, and a standalone
  `rph-conformance` package can wrap it then if desired.

**Deferred to M13 / follow-up:** builders/doubles fixtures; **mutation testing** (stryker — a second uninstalled
tool named in M12's §6 goal "mutation testing on critical handlers"); and closing the **RPH-PER (restart/replay)
/ RPH-E2E / RPH-FIX** families, which the M13 Reference Undertaking replay harness executes end-to-end.

---

## M13 (Reference Undertaking replay + rph-engine facade) — 2026-07-11

**Please confirm or correct (best judgment, non-blocking):**
- **`@janumipwb/rph-engine` created** as the composition facade `createEngine(deps)` (the §4 "single public seam").
  Today `deps` effectively supplies `store` (defaults to in-memory `SqliteStorageAdapter`) + optional `now`/
  `newEventId`/`logger`/`ontology` — the fuller §4/§5 port roster (CapabilityAuthorizer, ArtifactStore, Clock,
  IdGenerator, …) lands as those subsystems do. `rph-conformance` (§4) is still not created; the M12 gate +
  M13 replay live in rph-domain/rph-engine.
- **4 events added to the M2/M3 event catalog** to make the fixture trace schema-valid (RPH-FIX-002): PwuBaselined,
  IntentConstraintRefined, ExecutionPlanRevised, ClarificationRequested (with faithful but minimal payloads —
  plain-typed fields). Confirm the payload shapes when the live handlers are wired.
- **Replay approach.** The spec defines replay mode as "feed the event history and rebuild from it." The M13
  harness proves the trace's END-STATE + invariants directly against the authored `expected-events.jsonl` + the
  contract event catalog (RPH-FIX-001..006, P1/P5/P6). It does NOT yet drive the real command pipeline for all
  72 steps — that needs the deferred handlers (below).

**Deferred (the remaining M13 depth — a real follow-on):** the LIVE-command-drive replay: (1) refactor
`rph-application/command-bus.ts` from the hardcoded CaptureIntent branch to a handler registry keyed by
commandType; (2) implement the ~20 deferred M9/M10/M11 command handlers, each calling its rph-domain kernel
guard (ActivateExecutionPlan→canActivatePlan, PromoteBaseline→canPromoteBaseline, ApproveDecision→
authorizeDecisionEffective, StartExecutionStep→canStartStep, …); (3) add the 8 missing commands + BINDINGS
(BeginIntentDiscovery, StartAssuranceAssessment, MarkPwuSatisfied, RequestRuntimeBinding, AuthorizeRuntimeBinding,
SubmitBaselineForReview, ApproveBaseline, DenyRuntimeBinding/RevokeRuntimeCapability) via the m3 vocab + gen;
(4) tighten the execution placeholder sub-types (RetryPolicy/InputBinding/OutputBinding/Condition/etc.).
Also: **M13 is the one milestone not yet adversarially reviewed** (M9–M12 were).

---

## M14 (demonstration UI) — 2026-07-11

- **`apps/rph-demo` (SvelteKit + `@xyflow/svelte`) is hand-scaffolded and NOT build-verified in this headless
  environment** (no browser; installing SvelteKit is heavy). The engine-side seam it renders —
  `rph-engine`'s `buildReferenceUndertakingGraph()` — IS unit-tested (5 tests). Please `cd apps/rph-demo &&
  npm install && npm run dev` to view it, and confirm the `@xyflow/svelte` v1 + Svelte 5 API usage in
  `src/routes/+page.svelte` (I wrote it to the documented API but could not run svelte-check here).
- The demo shows the Reference Undertaking's TERMINAL state (a static seed graph). Wiring the UI to DRIVE real
  commands (approve intent / waive / promote) depends on the M13 live-command-drive handlers (deferred).

---

## SESSION SUMMARY — 2026-07-11

All 14 milestones (M0–M14) have a delivered, gate-green increment: 13 packages, 340 tests, clean check-types /
lint / dependency-cruiser / prettier. This session built M9–M14: five kernels/suites (M9 decomposition, M10
governance/baseline, M11 execution/recovery, M12 conformance+properties, M13 replay, M14 demo) grounded via
parallel-reader passes, and M9–M12 each adversarially reviewed (23 confirmed defects fixed, incl. a real
upstream state-machine generator bug and honest correction of over-claimed test coverage). Every previously
text-only guard across the RPH state machines is now an executable, conformance-tested predicate, and the
fixture's 72-step event trace replays into the proven end-state. Remaining depth is documented above and in
RESUME-STATE (chiefly M13 live-command handlers, M12 mutation-testing, M8 remaining policies) — none blocking.

---

## Charter Vocabulary Remediation (§R) — 2026-07-12

Housekeeping pass aligning all my generated artifacts to the ratified **Product Architecture & Canonical
Vocabulary Charter (RPH-DOC-000)**. Mechanical fixes — package rename `rph-product-lens` →
`rph-product-realization-pwa`, JPW→JPWB (incl. renaming the two `JPW …` docs), build-tooling "workflow"→"pass"
(reserving "workflow" for the temporal Execution Workflow), and repointing 6 vocab files' stale spec references —
are done and gate-green. Three charter-conformance review agents (code vocabulary / architecture / docs)
confirmed the migration is clean. The items below are **design decisions surfaced by the architecture review,
flagged for your call — none blocking.** I implemented only the minimal charter-correct fix (R-1) and did NOT
unilaterally redesign the engine API.

- **R-1 — the one structural fix I DID make; please confirm.** The pure **graph-view View seam** (the UI-ready
  PWU graph projection) lived inside the Node composition facade `rph-engine`, so `apps/rph-demo` imported the
  engine and `vite build` failed (the engine drags `better-sqlite3`/`node:crypto` into a browser bundle). Per the
  charter ("the engine never renders; a UI consumes only a pure seam"), I **moved `graph-view.ts` from
  `rph-engine` → `rph-projections`** (the pure, browser-safe read-model package that already owns
  `isQualifiedSuccess`) and repointed the demo onto `rph-projections`. The demo now builds; the dead
  `rph-engine → rph-projections` dep was dropped and a `projections-browser-safe` boundary rule added. Confirm
  this is the right home for the View seam.
- **R-2 (C1) — deferred, your call.** `buildReferenceUndertakingGraph()` hardcodes ONE specific Undertaking
  *instance* (the field-service SaaS terminal graph, `pwu_fsm_*` ids). Charter-strictly, an Undertaking instance
  is not reusable-package material. Options: (a) leave it in `rph-projections` as a clearly-labelled reference
  fixture (current); (b) move the hardcoded instance to `apps/rph-demo` as demo seed data, keeping only the pure
  builder/types + `isQualifiedSuccess` in `rph-projections` (most charter-pure, but the demo has no test harness,
  so the INV-5 colouring test needs a new home). I recommend (b) as a follow-up; kept (a) for now.
- **R-3 (C2) — deferred, your call.** `rph-engine` imports `@janumipwb/rph-product-realization-pwa` as a hard
  dependency and uses it as the **default** ontology in `createEngine()`. The engine is meant to be PWA-agnostic
  mechanism that *loads* a PWA as data; baking one PWA in as the default couples mechanism to one instance (it IS
  injectable via `deps.ontology` — this is only about the convenience default). Keep the ergonomic default, or
  make the PWA a required injected dependency (purest)? API-ergonomics decision for you. No change made.
- **R-4 (C4) — deferred, your call.** `rph-contracts` re-exports `hash.ts` (imports `node:crypto`) from its
  package barrel, so ANY browser surface that value-imports the contracts barrel breaks. `rph-projections` stays
  browser-safe today only because its `rph-contracts` imports are all **type-only** (erased); the new
  `projections-browser-safe` rule pins that. Durable fix if future browser surfaces need contract *values*
  (enums/id helpers): isolate hashing behind a subpath export (`@janumipwb/rph-contracts/hash`) or a port. Not
  required now.
- **R-5 — informational, no question.** Regenerating after the rename reconciled two **stale JSON schemas**
  (`DecompositionContract`/`RecompositionContract`) that still carried the pre-M9 permissive placeholder while
  `objects.ts` already had the tightened M9 shapes — the committed schemas had simply never been re-emitted. Now
  correct and consistent with the source-of-truth.

### §R.1 — Resolutions (sponsor decisions, 2026-07-12)

- **R-1 — CONFIRMED (built on by R-2).** The graph-view View seam stays in `rph-projections`; you approved the
  approach by greenlighting C1/C2, which extend it.
- **R-2 (C1) — DONE; you chose (b).** Moved the hardcoded field-service instance to
  **`apps/rph-demo/src/lib/referenceUndertakingGraph.ts`** (demo seed data). `rph-projections/graph-view.ts` now
  holds only the **reusable** seam — the `PwuAxesView`/`GraphNode`/`GraphEdge`/`DemoGraph` types + the exported
  **`pwuGraphNode()`** builder — and its test asserts the INV-5 (no-green-without-assurance) rule across five
  branches. The demo builds its instance from `pwuGraphNode()`. *Trade:* the 5 instance-shape assertions became
  untested demo seed data, replaced by 3 stronger INV-5-branch tests → **total 340 → 338**.
- **R-3 (C2) — DONE; you chose: require injected PWA.** `createEngine({ ontology, … })` now **requires** an
  injected ontology; `rph-engine` imports **no** concrete PWA (`EngineOntology` is a generic structural type), and
  `@janumipwb/rph-product-realization-pwa` moved to a **devDependency** (used only by the engine test, which acts
  as the composition root). Validation: a generic always-on gate (exactly one root PWU Type) + an optional
  injected `validateOntology()` the composition root supplies for full PWA-specific OVR.
- **R-4 (C4) — DONE; you chose Option 1 (subpath export).** Dropped `export * from './hash.js'` from the
  `rph-contracts` barrel and exposed it as **`@janumipwb/rph-contracts/hash`** (added to the package `exports`
  map). The one runtime importer of the hash function (`rph-application/src/command-bus.ts`) now imports from the
  subpath. The `@janumipwb/rph-contracts` barrel is now genuinely **browser-safe** — verified: `dist/index.js`
  re-exports no hash module, so its import graph never reaches `node:crypto`; enums/ids/schemas/types are
  value-importable in a browser. `contentHash` stays **synchronous**; `hash.ts` and its tests are unchanged
  (relative import). **Breaking-API note:** any code that imported `contentHash`/`sha256Hex`/`canonicalJson`/
  `CanonicalJsonError` from the barrel must switch to `@janumipwb/rph-contracts/hash`. (Option 3 — isomorphic sync
  SHA-256 — remains the future move only if a browser surface must someday *compute* hashes.)

---

## RPH-DOC-010 Full Live Buildout (P2/P3 — live command-drive) — 2026-07-12

**Please confirm or correct (best judgment, non-blocking):**
- **Two intent commands + one event added to make the Intent machine drivable live.** The Intent state machine
  is `RAW → UNDER_DISCOVERY → PROVISIONAL → FORMALIZED → APPROVED ↔ REVISED` (DOC-002 §6), but the command
  catalog had no command to reach `UNDER_DISCOVERY` or `PROVISIONAL` (the old M13 proof *replayed* an authored
  event log rather than driving commands). Added, via the vocab+gen pipeline: **`BeginIntentDiscovery`**
  (RAW→UNDER_DISCOVERY, emits the existing `IntentDiscoveryStarted`) and **`ProvisionIntent`**
  (UNDER_DISCOVERY→PROVISIONAL, records known ambiguities). `ProvisionIntent` needed a target event — DOC-002
  §6.1 defines the *transition* but §26.2 lists no event for it — so I added **`IntentProvisioned`** with a
  minimal faithful payload (`ambiguityIds`), the same posture as the 4 M13-added events. Registry now 45
  commands / 103 events / 45 bindings. Confirm the names, or point me at a canonical event if one exists.
- **Command handler registry replaces the hardcoded CaptureIntent branch** (the deferred M13 refactor).
  `rph-application/command-bus.ts` now runs the generic pre-stages (idempotency + payload validation) then
  routes to `HANDLERS[commandType]`; a command with no handler is `REJECTED` (`RPH_VALIDATION_SEMANTIC_FAILED`)
  — same posture the skeleton had for non-CaptureIntent, so the surface fills in one group at a time. Handlers
  live in `rph-application/src/handlers/*` and share a kit (`kit.ts`) that enforces the fail-loud pipeline
  (validate produced state, then atomic commit). `zod` added as a direct dep of rph-application (to type the
  schema the kit validates against).

### P2/P3 continued (execution / assurance / governance / decomposition) — 2026-07-12

Modeling choices made so the machines are drivable by commands (all faithful to the transition triggers;
confirm or correct):
- **ProposeExecutionPlan creates the plan at UNDER_REVIEW** (the PROPOSED→UNDER_REVIEW trigger reads
  "proposeExecutionPlan / ExecutionPlanProposed then submitted for review", DOC-002 §20.1) — the distinct
  PROPOSED state is a transient the create skips, so Approve→Activate is a clean chain. Same pattern for
  **ProposeDecomposition → UNDER_REVIEW**.
- **RequestAssuranceAssessment creates the assessment already in ASSESSING** (request-and-begin); the
  EVIDENCE_PENDING/READY prep states of the 15-value AssuranceAssessment.state machine are a deeper increment.
  **CompleteAssuranceAssessment** reads the disposition from `payload.validatorResult.dispositionRecommendation`
  (one of SATISFIED|CONDITIONALLY_SATISFIED|REJECTED|INCONCLUSIVE|ESCALATED) and the state machine's illegal/
  guarded edges enforce INV-8/9/10.
- **Authority = HUMAN (or SYSTEM) actor.** Approve/GrantWaiver set a Decision EFFECTIVE only when the decision's
  `authority.actorType` is HUMAN/SYSTEM — an AGENT/MODEL actor may recommend but not approve (GOV-001/002). A
  full authorizer port (scope/validFrom/validUntil) is a later refinement.
- **DenyWaiver → PROPOSED→SUPERSEDED** (DecisionStatus has no DENIED value — the §23.1 gap noted in the M10
  questions). **SubmitBaselineForReview + ApproveBaseline** commands added (their events already existed).
- **Deferred (documented in RESUME-STATE), not yet handled:** embedded per-step execution
  (Start/Complete/Fail/Retry ExecutionStep mutate the plan's steps[] array), RuntimeBinding commands
  (Request/Authorize/Deny/Revoke), ApplyTacticalChange, and wiring the rich decomposition coverage kernels
  (validateObligationConservation / validateConstraintPropagation) into ValidateDecomposition.
