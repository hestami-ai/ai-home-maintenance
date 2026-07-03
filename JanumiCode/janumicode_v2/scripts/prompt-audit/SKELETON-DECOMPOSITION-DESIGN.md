# SKELETON-DECOMPOSITION-DESIGN — generalize the P6.1 chunked-coverage pattern to the other monolithic skeleton passes

Companion to FIX-BACKLOG-SPECS.md / FIX-BACKLOG.md. Execution-ready design doc; no source was modified in producing it. Verify line numbers before editing (they drift).

## Problem statement (the reframe)

The P1–8 core LLM is now **gpt-oss:20b** — fast and competent for its size, but easily exceeded by a monolithic materialized prompt. The 828-call audit (`audit-out/`, dimension **A3 = monolithic ask**) shows the calls that blow the 20B envelope are the **SKELETON** passes: a single call told to *enumerate/cover N independent items in one response*. The per-item **saturation** loops that follow each skeleton are already chunked and are fine — out of scope.

The A3 findings land on exactly six sub-phases, four of which are our targets (the fifth, `p6_task_skeleton`, is the already-shipped **exemplar** fix; the sixth, `p6_task_saturation`, is a saturation pass, out of scope):

| target | A3 sev | audit one-liner (numbers) |
|---|---|---|
| SD-1 P3 `system_requirements` | med | 255-id (FR+NFR) enumeration invariant in one call → 13-id coverage miss incl NFR-003/NFR-010 |
| SD-2 P4 `adr_capture` | low | monolithic "every significant choice across all 53 components" → under-covers component-model thresholds (SHA-256, 0.01% margin, 500ms/60-min SLAs get no ADR) |
| SD-3 P5 `data_model_skeleton` | med | "every input component_id covered by ≥1 models[]" over 46 leaf components in one call → mid-response format drift (dropped `type` keys → invalid JSON / DM-001) |
| SD-4 P7 `test_case_skeleton` | med | "every AC has a test case" over 307 ACs / 17 components in ONE call → ~28% AC coverage/pass; catalog injected twice (~115K chars) |

Every A3 `suggested_fix` says the same thing: *chunk per-component/per-domain and let the orchestrator own coverage via an iterate-until-covered reconciliation loop, mirroring the P6.1 task_skeleton fix.*

---

## 1. P6.1 anatomy — the exemplar (`src/lib/orchestrator/phases/phase6.ts`)

The `task_skeleton` decomposition replaced a single monolithic call (one response enumerating ~100–200 tasks covering 300+ leaf ACs across 60+ components — the model looped/timed out, and its rare 30-min "success" covered ~41% of leaf ACs) with **per-component generation + an orchestrator-owned coverage-reconciliation loop**. Doc comment at **phase6.ts:624–641**.

### Control flow — `Phase6Handler.runTaskDecomposition` (phase6.ts:642–773)

1. **Load templates** (642–653): `implementation_planner` / `task_skeleton` for generation; the reconciliation call loads `implementation_planner` / `task_reconciliation` (phase6.ts:791). Both go through `engine.callForRole('requirements_agent', …)` with the real `agentRole` in `traceContext`.
2. **Primary fan-out — one bounded call per leaf component** (`for (const component of leafComponents)`, **689–726**): renders the `task_skeleton` template scoped to THIS component's block (`renderComponentBlockForTask`, 691/696) + the full AC menu as a *passive lookup*; parses via `parseImplementationTasks` (716); `backfillTracesFromCriteria` on each task (717); `pushUnique` dedups by `task.id` across chunks (676–686). **A single component's failure is caught and logged, never sinks the phase** (719–725) — the reconciliation pass below recovers any ACs it would have covered.
3. **Coverage-driven reconciliation loop — orchestrator owns the 100% guarantee** (**730–757**):
   - `computeUncoveredAcIds(allTasks, leafAcIdSet)` (738) → the deterministic **coverage oracle** (phase6.ts:1208): an AC counts as covered if it appears in a task's `traces_to` **or** any completion-criterion's `verifies_acceptance_criteria` (the two fields the model uses interchangeably).
   - `chunkUncoveredByStory(uncovered, leafAcceptanceCriteria, maxAcsPerBatch)` (740, def 1252) → bounded batches (default 25 ACs; grouped by owning leaf story, a story kept whole). This exists because the first recon design handed ALL 170 orphans to one call → a 16-min / 25,826-token response whose tasks were dropped (same monolithic-scale failure).
   - Per batch: `reconcileUncoveredAcs(...)` (747, def 781–835) — one focused call seeing only the uncovered ACs (`renderUncoveredAcsMenu`, 795) + a compact routing menu (`renderComponentMenu`, 796). **Credit is robust**: a recon task is accepted only if `taskCoversAny(t, batch)` (753, def 1286) — it actually covers a still-uncovered AC in this batch.
   - **Bounded passes** `JANUMICODE_P6_RECON_PASSES` default 2 (735); **stop early** if a whole pass adds nothing (756, `if (addedThisPass === 0) break`).
4. **Honest residual — NO fabrication** (**759–770**): recompute uncovered; if non-empty, log `summarizeResidualDivergence(...)` (def 1307) — groups the residual by owning leaf story (largest gaps first) as "upstream component/FR divergence, not fabricated"; else log 100% coverage.
5. **Merge / roll-up**: the single `allTasks` accumulator with a `seenIds` set is the merge; return `{ tasks: allTasks }` (772).

### The reusable building blocks already exported (phase6.ts)

`renderComponentBlockForTask` (1095), `renderComponentMenu` (1140), `backfillTracesFromCriteria` (1188), `computeUncoveredAcIds` (1208), `renderUncoveredAcsMenu` (1223), `chunkUncoveredByStory` (1252), `taskCoversAny` (1286), `summarizeResidualDivergence` (1307), `parseImplementationTasks` (1340). Coercion guards `asStringArray`/`asRecordArray` (1165/1170) make every field read non-array-safe (cal-29 emitted `verifies_acceptance_criteria: true`, which crashed `for..of`). **These are the load-bearing primitives the extraction is built from.**

### The invariant the exemplar embodies

> Chunk the *reasoning* small (per primary item), let deterministic code own 100% via *iterate-until-covered*; the orchestrator owns the deterministic coverage axis, the LLM owns judgment. Residual is reported honestly, never fabricated.

---

## 2. Extractability verdict

**VERDICT: YES — the P6.1 loop is extractable into one reusable helper `chunkedCoverageBloom`.** The generation-fan-out + oracle + bounded-batch-reconciliation + honest-residual skeleton is byte-for-byte identical across SD-1, SD-3, SD-4 (all have an *enumerable id coverage set* — FR/NFR-ids, component-ids, AC-ids). The only per-phase variation is: what a "chunk" is, how to render/parse each call, which ids a produced item covers, and how to batch the uncovered set — all injectable as callbacks. The existing phase6 primitives (`chunkUncoveredByStory`, `renderUncoveredAcsMenu`, `summarizeResidualDivergence`, `renderComponentMenu`, the `asStringArray` guards) are passed in unchanged.

**SD-2 (ADR) is the partial exception** — its coverage set is *not* a clean enumerable id set ("every significant architectural choice"). SD-2 uses the **per-chunk fan-out half** of the helper (per software-domain) with an **empty/optional coverage set**, OR — per the audit's own fix — supplies an enumerated *component-model-threshold obligation set* as the coverage oracle (the SHA-256 / margin / SLA thresholds the prompt flags HIGH). The helper supports both by making the coverage oracle optional: when `targetCoverageSet` is empty the reconciliation loop is a no-op and the pass is pure per-chunk fan-out.

### Proposed helper — new file `src/lib/orchestrator/phases/chunkedCoverageBloom.ts`

```ts
// src/lib/orchestrator/phases/chunkedCoverageBloom.ts
export interface ChunkedCoverageBloomConfig<TChunk, TProduced> {
  /** Primary items to fan out over — ONE focused LLM call each
   *  (e.g. leaf components, business domains, release cohorts). */
  chunks: TChunk[];

  /** One focused generation call for a chunk → produced items.
   *  MUST catch its own LLM/parse errors and return [] (a chunk failure
   *  is recovered by the reconciliation loop; it never sinks the phase). */
  generateForChunk: (chunk: TChunk, index: number) => Promise<TProduced[]>;

  /** Stable id for cross-chunk + cross-pass dedup (e.g. task.id, DM-*,
   *  suite_id). Return '' to opt an item out of dedup. */
  idOf: (produced: TProduced) => string;

  /** The deterministic coverage oracle: the full id set that MUST be
   *  covered (leaf FR∪NFR ids / component ids / leaf-AC ids). Empty Set
   *  ⇒ no reconciliation (pure per-chunk fan-out, e.g. SD-2 ADR). */
  targetCoverageSet: Set<string>;

  /** Which target ids a produced item covers — read every binding field
   *  the model uses interchangeably (traces_to ∪ CC.verifies, array-safe).
   *  Drives BOTH uncovered computation AND recon crediting. */
  coveredBy: (produced: TProduced) => Iterable<string>;

  /** Partition the still-uncovered set into BOUNDED batches (typically a
   *  thin wrapper over chunkUncoveredByStory). */
  chunkUncovered: (uncovered: Set<string>) => Set<string>[];

  /** One focused reconciliation call per uncovered batch → produced items.
   *  MUST catch its own errors and return []. */
  reconcileBatch: (
    batch: Set<string>,
    passInfo: { pass: number; batchIndex: number; batchCount: number },
  ) => Promise<TProduced[]>;

  /** Bounded reconciliation passes (env-driven per phase; 0 ⇒ generation only). */
  maxReconPasses: number;

  /** Honest residual reporter — NO fabrication (usually wraps summarizeResidualDivergence). */
  onResidual: (residual: Set<string>) => void;

  /** structured-log tag, e.g. 'Phase 5.1'. */
  logLabel: string;
}

export interface ChunkedCoverageBloomResult<TProduced> {
  produced: TProduced[];      // deduped, merged across all chunks + passes
  coveragePct: number;        // 100 when targetCoverageSet empty or fully covered
  residual: Set<string>;      // uncovered target ids after the budget is spent
}

export async function chunkedCoverageBloom<TChunk, TProduced>(
  cfg: ChunkedCoverageBloomConfig<TChunk, TProduced>,
): Promise<ChunkedCoverageBloomResult<TProduced>>;
```

**Internal algorithm** (a verbatim generalization of phase6.ts:674–770): accumulate `produced[]` with a `seen` id-set (`idOf` dedup) → fan-out `generateForChunk` over `chunks` → for `pass` in `1..maxReconPasses`: `uncovered = targetCoverageSet \ ⋃ coveredBy(produced)`; break if empty; `chunkUncovered(uncovered)` → per batch `reconcileBatch` then credit only items whose `coveredBy ∩ batch ≠ ∅`; break the pass if it added nothing → finally recompute residual, call `onResidual` if non-empty, return.

**Adoption of the exemplar itself:** refactor `runTaskDecomposition` to call `chunkedCoverageBloom` as the single source of truth (its per-component loop, `computeUncoveredAcIds`, `reconcileUncoveredAcs`, and `summarizeResidualDivergence` map 1:1 onto the callbacks), **gated on the existing P6.1 unit tests staying green**. Recommended but optional — can trail the four target adoptions so the proven path is not destabilized first.

**House-rule compliance the helper preserves:** no regex id resolution (callers pass structural sets); each phase normalizes its own output *before* handing items to `coveredBy`/`idOf` (bridges live in the producer); residual is reported, never fabricated; deterministic backstops become the loop's oracle, not discarded.

---

## 3. Per-target specs

Format mirrors FIX-BACKLOG-SPECS.md. All four generation calls today route through `engine.callForRole('requirements_agent', …)` with the phase's real `agentRole` in `traceContext` — keep that.

### SD-1 — P3 `system_requirements` (`phase3.ts`)
- **status:** design-ready · **risk:** low-med · **effort:** M · **deterministic-bridge:** true · **deps:** shared helper · **A3:** med (13-id miss incl NFR-003/NFR-010)
- **Call site:** the monolithic `await engine.callForRole(...)` is **phase3.ts:501–512**, inside `Phase3Handler.runSystemRequirementsDerivation` (**466–533**); template `findTemplate('systems_agent','system_requirements')` at **474**; sub_phase `system_requirements`; label "Phase 3.2 — System Requirements Derivation". Envelope-tolerant parse at 526–531.
- **Coverage contract:** the template's tail rule — *"Every FR and NFR id received in `functional_requirements_summary` MUST appear in ≥1 item's `source_requirement_ids[]`"* — over ~255 leaf ids. The **enforcing verifier**: `Phase3Handler.runConsistencyCheck` (**608–676**) computes `coveredFrIds` from `sysReq.items[].source_requirement_ids` and flags `uncoveredFr` (**618–635**) — but **only for FRs (`frStories`), and only as a WARNING**, not blocking; **NFRs are not checked in code** (they ride in only via `nfrSummary`). This FR check IS the coverage oracle to reuse — **it must be generalized to FR∪NFR** (the audit's 13-id miss was NFRs).
- **Chunk key:** **per release-ordinal**. `frView = buildEffectiveFrView(...)` (**124**) returns `stories` each carrying `release_ordinal` (phaseContext.ts:554/564/571). Group `frStories` by `release_ordinal` (null → "Backlog" cohort). NFRs (`nfrIdList`, **142–143**) are cross-cutting and carry no release ordinal → emit them as one dedicated "cross-cutting NFR" chunk (or distribute by nfr category). Alternative key = per-business-domain (needs a story→domain map from Phase-1 `business_domains_bloom`; more wiring — prefer release for v1).
- **Existing deterministic backstop:** the `uncoveredFr` computation (phase3.ts:625–627) — becomes `targetCoverageSet = new Set([...frIds, ...nfrIdList])` and `coveredBy(sr) = sr.source_requirement_ids`.
- **Following saturation loop:** **NONE.** P3 sub-phases are `system_boundary` / `system_requirements` / `interface_contracts` only — there is no `system_requirements_saturation`. (The FR/NFR saturation loops live upstream in P2 and are already per-item.) So SD-1 is a pure skeleton fix with no downstream saturation to protect.
- **Idiom landmines:** (a) `runSystemRequirementsDerivation` returns a hard-coded `SR-001` fallback (476–483) on missing template / empty parse — the per-chunk generator must return `[]` on failure (never the fallback) so reconciliation can recover; keep ONE final fallback only if the whole bloom yields zero SRs. (b) Envelope drift is real (shapes #1/#2/#3 handled at 526–531) — reuse `pickItemsArray`/`pickEnvelope` inside each chunk's parse. (c) SR ids must stay globally unique across chunks — mint/renumber deterministically in the producer after merge (don't let two release cohorts both emit `SR-001`); `idOf(sr)=sr.id` dedup is not enough because ids collide, so re-id on merge. (d) The A3 report also flags a separate `[object Object]×21` boundary-serializer defect in the *same* prompt — not this fix, but note it so a co-editor doesn't conflate.
- **Implementation plan:**
  1. `execute()` (~120–160): build `srTargetSet = new Set([...frIds, ...nfrIdList])`; build `releaseCohorts: Map<number|null, stories[]>` from `frView.stories` + one NFR cohort.
  2. Replace the single `runSystemRequirementsDerivation` call with `chunkedCoverageBloom({ chunks: cohorts, generateForChunk: renderScopedSR(cohort), targetCoverageSet: srTargetSet, coveredBy: sr => sr.source_requirement_ids ?? [], chunkUncovered: uncovered => chunkBySourceStory(uncovered, …), reconcileBatch: reconcileUncoveredSRs, maxReconPasses: env JANUMICODE_P3_RECON_PASSES ?? 2, onResidual: r => log summarizeResidualDivergence-style, logLabel: 'Phase 3.2' })`.
  3. Deterministic re-id of merged SRs (unique `SR-###`) in the producer.
  4. Generalize `runConsistencyCheck` FR-coverage assertion to FR∪NFR (still a warning; the bloom is the real closer).
- **Template(s):** the `system_requirements` template needs a **per-cohort variant** (scope: "derive SRs for the FR/NFR ids in THIS release cohort; the full roster is a reference lookup, global coverage is closed by the orchestrator") — mirror the `implementation_task_decomposition` single-scope reframe. New **`system_requirements_reconciliation`** template (uncovered FR/NFR menu + compact SR-context) mirroring `task_reconciliation`.

### SD-2 — P4 `adr_capture` (`phase4.ts`)
- **status:** design-ready · **risk:** low · **effort:** M · **deterministic-bridge:** partial · **deps:** shared helper (fan-out half) · **A3:** low
- **Call site:** monolithic `await engine.callForRole(...)` at **phase4.ts:1075–1086** inside `Phase4Handler.runADRCapture` (**1038–1090**); template `findTemplate('architecture_agent','adr_capture')` at **1046**; sub_phase `adr_capture`; label "Phase 4.3 — Architectural Decision Capture". Called from `execute()` at **776–778** with `componentSummary` = the ALL-component roll-up (735–739) built over `adrComponentsSource` (leaf components, 721–734, each carrying `domain_id` at 725).
- **Coverage contract:** the audit-flagged contract is *"capture every significant architectural choice across ~53 components; silent omission of an upstream-mandated threshold is HIGH severity."* This is **NOT a clean enumerable id set** — "significant choices" can't be listed. There is **NO deterministic ADR-coverage verifier** in code: after capture, `execute()` only resolves each ADR's `governs_components` against the component-id oracle via `resolveAgainstOracle` and drops non-resolving ids (**784–792**) — it never checks that every component/threshold is governed. So the "under-covers thresholds" A3 is real but unenforced.
- **Chunk key:** **per software-domain** — directly available: `adrComponentsSource` items carry `domain_id` (725); group them by `domain_id` and pass `domainsSummary`/`domainIds` (already in scope, 750) per chunk. One focused ADR call per domain (its components + that domain's TECH-* slice) instead of all 53 at once.
- **Existing deterministic backstop:** none for coverage. `resolveAgainstOracle` (789) is an id-hygiene pass, not a coverage oracle. The `governs_components` component-id oracle (`componentOracle`, 785) is the closest structural set.
- **Following saturation loop:** **NONE.** ADR capture (4.3) is followed by `architecture_synthesis` (4.4), not a saturation pass. (The per-node `component_saturation` loop is 4.2a, *upstream* of ADR, and is already per-component — see PA-6.) So SD-2 is also a pure skeleton fix.
- **Idiom landmines:** (a) `runADRCapture` returns a hard-coded `ADR-001` fallback (1048–1059) — per-domain generator returns `[]` on failure; one final fallback only if zero ADRs overall. (b) ADR ids must be globally unique across domain chunks → deterministic re-id on merge (same as SD-1). (c) `governs_components` resolution (784–792) must run **after** the merge, over the full component oracle (don't run it per-chunk against a partial oracle). (d) TECH-* roster is passed verbatim (`technicalConstraintsSummary`, 761–774) to let the model self-check non-contradiction — keep that per chunk, scoped to the domain's TECH slice (ties into PA-6's domain scoping). (e) The audit also flags one injected `undefined` dependency id in the same prompt — adjacent serializer hygiene, not this fix.
- **Implementation plan:**
  1. `execute()` (~735): group `adrComponentsSource` by `domain_id` → `domainChunks`.
  2. `chunkedCoverageBloom({ chunks: domainChunks, generateForChunk: renderScopedADR(domain), targetCoverageSet: <empty> OR enumeratedThresholdObligations, coveredBy: adr => adr.governs_components ?? [], chunkUncovered, reconcileBatch, maxReconPasses: env ?? (0 if no oracle), onResidual, logLabel: 'Phase 4.3' })`. With an **empty coverage set** it degrades to pure per-domain fan-out (recommended v1 — cardinality is the disease, and thresholds aren't reliably enumerable). If the team wants the audit's stronger fix, build `thresholdObligations` from the component-model NFR/quality thresholds and set that as `targetCoverageSet` with a `component_threshold_reconciliation` template (defer to v2).
  3. Deterministic re-id + run `governs_components` oracle resolution once, post-merge.
- **Template(s):** `adr_capture` needs a **per-domain variant** ("capture ADRs for the components in THIS software domain"). Reconciliation template only if the threshold-oracle v2 is taken.
- **Note:** SD-2 is the **lowest-value / lowest-risk** of the four (A3 sev=low, econ=4). The fan-out alone fixes the cardinality; reconciliation is optional.

### SD-3 — P5 `data_model_skeleton` (`phase5.ts`)
- **status:** design-ready · **risk:** low-med · **effort:** M · **deterministic-bridge:** true · **deps:** shared helper · **A3:** med (46-component monolith → dropped `type` keys / DM-001)
- **Call site:** monolithic `await engine.callForRole(...)` at **phase5.ts:565–568** inside `Phase5Handler.runDataModelSpecification` (**538–577**); template `findTemplate('technical_spec_agent','data_model_skeleton')` at **543**; sub_phase `data_model_skeleton`; label "Phase 5.1 — Data Model Specification". Called from `execute()` at **185–187**; `componentIds` list already built at **136–138**; `componentSummary` is the whole-catalog roll-up.
- **Coverage contract:** template rule *"Every input `component_id` (from `component_model_summary`) MUST be covered by ≥1 `models[]` entry"* over 46 leaf components. **There is NO deterministic verifier for this in code** — `runConsistencyCheck` (phase5.ts:692) only checks DM-001 (no field without a type) and endpoints-without-auth; a broad grep for component→model coverage across `src/lib/orchestrator` returns nothing. The contract is only implicit in the seeding: `execute()` at **238–259** flatMaps `dataModelsContent.models → entities → per-entity depth-0 roots`; a component with no model simply produces no roots and is silently dropped. **So the coverage oracle must be BUILT** (it's a clean enumerable set: `componentIds`).
- **Chunk key:** **per-component** (cleanest — each call = one component's models; `componentIds` at 136–138) or per-domain (`effectiveComponents.components` carry `domain_id`). Per-component is the direct analogue of the P6.1 exemplar and gives the tightest prompt.
- **Existing deterministic backstop:** none — **new oracle**: `targetCoverageSet = new Set(componentIds)`; `coveredBy(model) = [model.component_id]` (every `models[]`, `data_models[]`, `entities[]` element carries `component_id` — phase5.ts:37/50/66/76). This is stronger than P6.1's AC oracle because the id is a direct field, not a traces_to walk.
- **Following saturation loop:** **YES — already per-entity chunked.** `runDataModelSaturationLoop` (phase5_1a.ts:283) iterates `for (const entry of passEntries)` (399) over per-entity depth-0 roots seeded at phase5.ts:238–259. **Do not touch it.** The skeleton fix must keep producing the same `dataModelsContent.models` shape so the seeding at 241–259 is unchanged.
- **Idiom landmines:** (a) `runDataModelSpecification` returns **empty `{models:[]}` on failure, NEVER a fabricated fallback** (544–548, ts-117) — preserve this: per-component generator returns `[]`, and the honest-residual log replaces any temptation to fabricate. (b) `normalizeIdsInTree(..., 'component_id', normalizeComponentIdRef)` (196) canonicalizes `COMP-001→comp-001` — run per-chunk output through the SAME normalizer before `coveredBy` reads `component_id`, else the oracle misses on case drift. (c) `mintEntityIds` (199) mints stable `DM-*` ids — must run **once on the merged tree**, not per chunk (else id collisions / re-mint). (d) `idOf` for dedup should key on the minted `DM-*`/entity id post-normalize.
- **Implementation plan:**
  1. `execute()` (~136): `dmTargetSet = new Set(componentIds)`; chunks = `componentIds` (or per-domain groups).
  2. Replace the single `runDataModelSpecification` call with `chunkedCoverageBloom({ chunks: componentIds, generateForChunk: renderScopedDM(cid) /* scope component_model_summary + SR/tech slice to THIS component */, idOf: entityId, targetCoverageSet: dmTargetSet, coveredBy: m => [normalizeComponentIdRef(m.component_id)], chunkUncovered: uncovered => batchComponents(uncovered), reconcileBatch: reconcileUncoveredComponents, maxReconPasses: env JANUMICODE_P5_RECON_PASSES ?? 2, onResidual, logLabel: 'Phase 5.1' })` → merged `models[]`.
  3. Run `normalizeIdsInTree` + `mintEntityIds` on the merged tree (unchanged 195–199), then the existing seeding (238–259) proceeds untouched.
- **Template(s):** `data_model_skeleton` needs a **per-component variant** ("design entities for THIS component; others are reference-only; global coverage closed by orchestrator"). New **`data_model_reconciliation`** template (uncovered component menu + component_model context) mirroring `task_reconciliation`.

### SD-4 — P7 `test_case_skeleton` (`phase7.ts`) — this is backlog item PA-15
- **status:** confirmed (already spec'd in FIX-BACKLOG-SPECS.md PA-15) · **risk:** med · **effort:** L · **deterministic-bridge:** true · **deps:** shared helper, PA-3 (component→leaf-AC map), PA-9 (AC namespace) · **A3:** med (~28% AC coverage/pass; ~115K-char catalog injected twice)
- **Call site:** monolithic `await engine.callForRole(...)` at **phase7.ts:442–445** inside `Phase7Handler.runTestCaseGeneration` (**406–454**); template `findTemplate('test_design_agent','test_case_skeleton')` at **411**; sub_phase `test_case_skeleton`; label "Phase 7.1 — Test Case Generation". Renders `functional_requirements_summary` (all ~307 ACs) + `component_id_list` (all 17) + `component_model_summary` in one call.
- **Coverage contract:** template invariant *"Every Acceptance Criterion must have ≥1 Test Case"* AND *"every component listed must appear as a `suite.component_id`"* over 307 ACs / 17 components. **The enforcing verifier is visibility-only and there is no closed loop today:** `runCoverageAnalysis` (**463–496**) computes AC `gaps` + `component_gaps` but only feeds `has_unresolved_warnings` (the gate never fails on it, phase7.ts:393); `backfillMissingComponentSuites` (**506–538**) closes COMPONENT gaps with **empty stub suites** (`acceptance_criterion_ids: []` → covers ZERO ACs); 7.1a saturation only refines existing roots, never mints coverage for an AC that got no case. **So AC coverage is silently ~28%.**
- **Chunk key:** **per-component** (with a deterministic per-component AC scope — P7's advantage over P6: `componentAcMap: componentId → Set<AC-*>` built from `prior.implementationPlan.content.tasks` (each task's `component_id × traces_to`), full-menu fallback for unmapped components).
- **Existing deterministic backstop:** `runCoverageAnalysis` AC-gap computation (**468–478**) → becomes the oracle basis; `targetCoverageSet` = full leaf-AC id set (`allAcIds`); `coveredBy(suite) = suite.test_cases.flatMap(tc => tc.acceptance_criterion_ids)`. `backfillMissingComponentSuites` stays as the component-coverage backstop (unchanged).
- **Following saturation loop:** **YES — already per-node chunked.** `runTestSaturationLoop` (phase7_1a.ts:423) iterates `for (const entry of passEntries)` (539). Do not touch. Keep `normalizeTestPlanAcRefs` (phase7.ts:157) + `backfillMissingComponentSuites` (162) + gatekeeper downstream unchanged.
- **Idiom landmines:** (a) `runTestCaseGeneration` fallback (413–421) hard-codes a `TS-001` suite — per-component generator returns `[]` on failure. (b) `parseTestSuites` must tolerate the `{test_plan}` / `{test_plan:[…]}` / `{test_suites}` envelopes seen at 447–452. (c) `acceptance_criterion_ids` can arrive as a non-array/boolean (same class as cal-29) — read through `asStringArray`. (d) The A3 D4 finding notes the catalog is injected **twice** (~115K chars) — per-component scoping fixes this by construction; ensure the reconciliation template does not re-inject the full FR summary.
- **Implementation plan:** exactly PA-15 (FIX-BACKLOG-SPECS.md §PA-15), with **one improvement: implement it by calling the shared `chunkedCoverageBloom` rather than hand-rolling `reconcileUncoveredTestAcs`.** PA-15's per-component loop + `computeUncoveredTestAcIds` + reconciliation map 1:1 onto the helper's callbacks; it already reuses `chunkUncoveredByStory`/`renderUncoveredAcsMenu`/`renderComponentMenu`/`summarizeResidualDivergence` (imported from phase6). New templates: rewrite `test_case_generation.system.md` to per-component scope (+ fix the stray `"type":"functional"` example on L41 → `unit|integration|end_to_end|property`), add `test_case_reconciliation.system.md`.
- **Template(s):** see PA-15 (component-scoped rewrite of `test_case_generation` + new `test_case_reconciliation`). Env: `JANUMICODE_P7_RECON_PASSES` (2), `JANUMICODE_P7_RECON_BATCH_AC` (25).

---

## 4. Recommended sequence + parallelizability

```
Step 0  chunkedCoverageBloom.ts        [SHARED — must land first]  new file, S/low-risk
        (+ pure-helper unit tests; optionally retrofit P6.1 behind its green tests)
                              │
        ┌─────────────────────┼─────────────────────┬─────────────────────┐
Step 1  SD-3 P5 (phase5.ts)   SD-1 P3 (phase3.ts)   SD-2 P4 (phase4.ts)    │   ← fully parallel
        clean new oracle       generalize FR→FR∪NFR  fan-out only            │     (4 different files)
                              │                                              │
Step 2                        └──────────────────────────────────── SD-4 P7 (phase7.ts) = PA-15
                                        depends on PA-3 (component→leaf-AC map) + PA-9 (AC namespace)
                                        + reuses phase6 exports
```

- **Helper first (Step 0):** the new `chunkedCoverageBloom.ts` is a pure module with no phase deps — land + unit-test it before any target. Low risk, gates the other four.
- **SD-1 / SD-2 / SD-3 are mutually independent** (`phase3.ts`, `phase4.ts`, `phase5.ts` — three distinct files, no shared symbols beyond the helper) → **safe for three parallel implementation agents** once the helper exists. Each also touches only its own phase template(s) → no template conflicts.
- **SD-4 (phase7.ts) = PA-15** is last: it **depends on PA-3** (the `buildRequirementLineage.canonicalize` component→leaf-AC map, structural tree-walk, no regex) and **PA-9** (unified AC id namespace so the coverage loop keys correctly), and **imports the already-exported phase6 primitives**. It is file-independent of SD-1/2/3 but ordering-dependent on PA-3/PA-9.
- **File-level conflict watch:** none among SD-1/2/3/4 (four different phase files). The only shared write is the new helper file (Step 0). SD-4 *reads* phase6 exports but doesn't edit phase6 (unless the optional P6.1 retrofit is taken — if so, sequence the retrofit before SD-4 to avoid a phase6/phase7 interleave, or keep them in one PR).
- **Value ordering** (independent of deps): SD-4 (fixes 28%→~100% AC coverage, highest correctness value) ≈ SD-3 (46-component format drift) > SD-1 (13-id NFR miss) > SD-2 (low sev, fan-out-only). If effort-constrained, ship SD-3 + SD-4 first.

---

## 5. Test plan

Every target gets three test layers, following the established conventions (`frNfrSaturationCategoryConsistency.test.ts` for file-reading template guards; `phase6LeafAcBinding.test.ts` / `phase7_1aSaturation.test.ts` for MockLLMProvider loop-driven prompt capture via `mock.getCallLog()`).

### Shared helper — `src/test/unit/orchestrator/phases/chunkedCoverageBloom.test.ts`
Pure, no LLM (pass stub async `generateForChunk`/`reconcileBatch`): (1) fan-out calls `generateForChunk` once per chunk, merges + dedups by `idOf`; (2) when produced items cover the full `targetCoverageSet`, zero reconciliation passes fire; (3) when a subset is covered, reconciliation fires for exactly the uncovered remainder, credits only items intersecting the batch, and reaches 100%; (4) `maxReconPasses` bound + "pass added nothing ⇒ stop" both terminate; (5) residual after budget calls `onResidual` with the exact uncovered set and returns it (no fabrication); (6) empty `targetCoverageSet` ⇒ pure fan-out, no recon, coveragePct=100 (the SD-2 path); (7) a `generateForChunk` that throws-and-returns-[] doesn't sink the bloom.

### SD-1 (P3)
- **Anti-monolith / scoping (loop-driven):** seed FR stories across 2 release ordinals + NFRs; run the derivation; assert via `getCallLog()` that **no single prompt contains all 255 ids** — each generation prompt carries only its cohort's ids; the full roster appears only as a reference index.
- **Coverage closes deterministically:** mock per-cohort SRs covering a SUBSET → assert reconciliation fires for the orphan FR/NFR ids (incl an NFR id, the audit's miss) and merged SRs reach FR∪NFR = 100%; SR ids are globally unique post-merge (no duplicate `SR-001`).
- **Oracle guard (pure):** generalized `runConsistencyCheck` flags an uncovered NFR (today it does not).
- **Residual honesty:** exhaust the budget → residual logged, no fabricated SR.
- **Template guard (file-read):** `system_requirements` variant states per-cohort scope + "global coverage reconciled by the orchestrator"; `system_requirements_reconciliation` exists with the uncovered-menu variable.

### SD-2 (P4)
- **Anti-monolith:** seed leaf components across 2 `domain_id`s; assert each ADR prompt carries only its domain's components (no 53-component prompt).
- **Fan-out merge:** per-domain mock ADRs merge with globally-unique ids; `governs_components` oracle resolution runs once post-merge over the full component set (a valid id in domain B still resolves for a domain-A ADR).
- **(v2 only, if threshold oracle taken):** uncovered thresholds route through reconciliation.
- **Template guard:** `adr_capture` variant is per-domain scoped.

### SD-3 (P5)
- **New-oracle pure tests:** `coveredBy` reads `component_id` after `normalizeComponentIdRef` (a `COMP-001` model credits `comp-001`); `targetCoverageSet=new Set(componentIds)`; uncovered = components with no model.
- **Anti-monolith:** seed 3 components; assert each generation prompt scopes `component_model_summary` to ONE component (no 46-component prompt).
- **Coverage closes:** mock per-component models covering a SUBSET → reconciliation covers the orphan components → merged `models[]` covers 100% of `componentIds`; `mintEntityIds` runs once on the merged tree (stable `DM-*`, no collisions).
- **No-fabrication:** a failing chunk returns `[]`; residual component logged honestly, empty `{models:[]}` never becomes a fake model.
- **Seeding intact:** after the bloom, the per-entity depth-0 seeding (238–259) produces the same root shape (regression against `phase5_1aDataModelScope.test.ts`).

### SD-4 (P7) — per PA-15 unit-test plan
Pure: `buildComponentAcMap`, `computeUncoveredTestAcIds`, `parseTestSuites` (envelope-tolerant), `renderScopedAcMenu` (component-scoped, full fallback when unmapped), `caseCoversAny`. Integration (MockLLMProvider): (a) exactly one generation call per component, each prompt carries only that component's ACs — **assert no prompt ever carries all components/all ACs** (the anti-monolith regression); (b) reconciliation fires for orphan ACs → merged plan reaches 100% leaf-AC coverage; (c) suite/case-id dedup across chunks; (d) budget exhausted ⇒ honest residual, no fabricated case; (e) component absent from `componentAcMap` falls back to the full menu (no starvation).

---

## Appendix — audit evidence (A3, `audit-out/results/*.json`)

- **SD-1** `p3_system_requirements_9d734b91.json` (intent 4, econ 3): *"'Every FR and NFR id … MUST appear in ≥1 item's source_requirement_ids[]' … over 255 leaf ids in one call. Failing it produces a HIGH-severity finding and a REVISE-or-worse harness decision."* Fix: *"Chunk the derivation by domain/release with an orchestrator-owned coverage-reconciliation loop (as done for Phase 6.1)."*
- **SD-2** `p4_adr_capture_56150027.json` (intent 4, econ 4): *"11 ADRs all derived from TECH-*; component-model thresholds (SHA-256, 0.01% margin, 500ms/60-min SLAs) get no ADR … 'Silent omission of an upstream-mandated threshold is a defect (HIGH severity).'"* Fix: *"chunk ADR capture (per-domain) or enumerate the upstream thresholds each must be ADR-covered."*
- **SD-3** `p5_data_model_skeleton_a14028f6.json` (intent 4, econ 3): *"'Every input component_id … MUST be covered by ≥1 models[] entry' — 46 leaf components enumerated in one call → dropped 'type' keys → invalid JSON / DM-001."* Fix: *"Chunk 5.1 per-component (or per-domain) as was done for P6.1; let orchestrator own coverage via iterate-until-covered."*
- **SD-4** `p7_test_case_skeleton_800a40b5.json` (intent 4, econ 2): *"single monolithic ask for a test case across all 307 ACs/17 components yields only ~28% AC coverage; catalog injected twice (~115K chars)."* Fix: *"Chunk per-component (or per-US subtree) + orchestrator iterate-until-covered reconciliation loop, mirroring the P6.1 fix."*
```
