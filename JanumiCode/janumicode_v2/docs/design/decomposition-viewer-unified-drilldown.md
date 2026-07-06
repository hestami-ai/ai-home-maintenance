# Decomposition Viewer — Unified Drill-Down (Phase 1-8 central view)

**Status:** proposed (awaiting approval). **Author:** investigation 2026-07-06 against cal-40 clone.

## Context

The Decomposition Viewer today loads **only** `requirement_decomposition_node` and renders the Phase-2 user-story tree. It ignores the four other decomposition families that already exist in the same DB, and its header ("Phase 6/task_saturation") is just the run's *current phase* echoed from `workflow_runs` — decoupled from what the tree shows. That mismatch is what makes it look broken: at Phase 6 the governed stream shows tasks, but the viewer still shows Phase-2 user stories and can't descend to them.

The operator's intent: the viewer should be the **central navigable view across Phases 1-8** — a spine from **User Journey → User Story → leaf Acceptance Criterion → {Component · Task · Data Model} (→ Test)**. All of that data and its linkage **already exist in the governed stream**; the viewer simply never loads or joins it.

Evidence (cal-40 clone, `is_current_version=1`): requirement 37 (8 roots), component 55 (8 roots), data_model 220 (92 roots), task 139 (42 roots), test 0 (Phase 7 not reached), plus 8 user journeys. The "only 8 user stories" observation is **correct and consistent** across the `functional_requirements`, `system_requirements`, and `release_plan` artifacts — not a viewer bug; the sparse US ids (001,002,004,006,010,014) are a Phase-1/2 numbering artifact worth a separate look by the workflow-correctness thread.

## Confirmed join graph (field-level; verified empirically)

```
user_journey_bloom artifact ──> Journey (UJ-*)            [8; already loaded as Phase-1 anchors]
  requirement_decomposition_node root  content.user_story.traces_to ⊇ UJ-*   (journey→US; 7/8; NFR has none)
  └─ requirement tree (tiers A/B/C/D → atomic leaves)     [existing viewer tree]
       leaf: content.user_story.id (==display_key), content.user_story.acceptance_criteria[].id (AC-*)
       └─ leaf AC ──realizes──> Task / Component / Data Model
task_decomposition_node
   content.task.traces_to[] ⊇ AC-*  ──resolveAcs──> leaf story ──canonicalize──> root US
   content.task.component_id (comp-*) ═> component node display_key/component.id (100% at all depths)
component_decomposition_node   content.component.id/display_key  ⇐ task.component_id, data_model entity.component_id
data_model_decomposition_node  content.entity.component_id ═> component; content.entity.traces_to ⊇ US-* ──canonicalize──> US
test_decomposition_node        content.test_case.acceptance_criterion_ids[] ──resolveAcs──> leaf; component_ids[] ═> component
```

**Reuse (do not reinvent — regex-free structural resolution):**
- `buildRequirementLineage(records)` → `resolveAcs`, `canonicalize`, `resolveTraces` — `src/lib/orchestrator/phases/packetSynthesis/idResolution.ts`.
- `collectLeafAcceptanceCriteria`, `computeTaskAcCoverage`, `componentRootStorySet` — `src/lib/orchestrator/phases/phase6.ts`.
- Id-extraction spec per family — `src/lib/orchestrator/phases/packetSynthesis/upstreamIndex.ts`.
- Existing join/canonicalize pattern in the viewer — `dagModel` + `buildSatisfiedByMap`/`resolveRoot` in `src/webview/decompViewer/stores/snapshot.ts:602-686`.

## Approach

Extend the existing pipeline (host `src/lib/decompViewer/` → single `init`/`snapshot_update` message → webview `src/webview/decompViewer/`), reusing the loader + join patterns already there. Render a unified drill-down where a requirement **leaf AC** expands into its realizing **components → tasks** and **data models** (matching the operator's sketch), with **user journeys as the top spine**.

### 1. Data provider — load the other families + build the realization join
File: `src/lib/decompViewer/decompViewerDataProvider.ts`
- Generalize `loadNodes` into `loadDecompNodes(recordType, rootKeyField)` and call it for `component_decomposition_node`, `data_model_decomposition_node`, `task_decomposition_node`, `test_decomposition_node` (same `is_current_version=1 AND workflow_run_id=?` + `collectGovernedStream` paging). Each becomes a `ViewerDecompositionNode` with a new `layer` discriminator (`'requirement'|'component'|'data_model'|'task'|'test'`).
- Build a **`realizationModel`** using the authoritative resolver: instantiate `buildRequirementLineage(requirementNodes)`; for each task/test invert `task.traces_to`∪`completion_criteria[].verifies_acceptance_criteria` via `resolveAcs`→`canonicalize` to get `{leafAcId → tasks[]}` and `{US → tasks[]}`; map `component_id` (tasks, data models, tests) to component nodes (match `display_key`/`component.id` at all depths, canonicalize to root); union each data-model `root_entity_id` group to get both `entity.component_id` (→component) and child `entity.traces_to` (→US). Reuse `computeTaskAcCoverage` for AC coverage/gap sets.
- **Surface drift, don't fabricate:** AC ids in `task.traces_to` that resolve to no leaf (e.g. the malformed `AC-US-001D1C-004`) and component ids that resolve to no node become explicit `drift`/`unresolved` markers (reuse the `synthesizePhantomAnchors` pattern) — the viewer becomes a diagnostic surface for the workflow thread.

### 2. Snapshot + types (host + webview, hand-mirrored)
Files: `src/lib/decompViewer/types.ts` **and** `src/webview/decompViewer/stores/snapshot.ts` (two mirrored type worlds — every field added in both).
- `ViewerDecompositionNode` gains `layer` and per-node realization id-lists (`realized_by_task_ids[]`, `realized_by_component_ids[]`, `realized_by_data_model_ids[]`, `acceptance_criteria` already present) — mirroring the existing derived `children_display_keys` precedent.
- Snapshot gains sibling arrays for the new families + the realization edge maps. Keep the requirement spine as-is so all existing views keep working.

### 3. Webview rendering — the unified drill-down
Files: `src/webview/decompViewer/components/{IndentedTreeView,DagTreeView,NodeRow}.svelte`, `App.svelte`, `stores/snapshot.ts`.
- Make **Journey the top spine** (generalize the existing `dagModel` journey-anchor grouping so it drives the drill-down, not just the DAG tab).
- Under a requirement **leaf**, render synthetic **AC nodes**; under each AC, its **components → tasks** and **data models** — a `realizedByParent` map built alongside `childrenByParent`, consumed by the flat Indented walker (engineered for ~1300 nodes) so the walk crosses layers.
- `NodeRow.svelte`: add a small `layer` badge (parallel to the tier badge) + a muted `drift` chip for unresolved refs. No new recursive components (keep the flat walker for scale).

### 4. Scale / lazy-load (apply the pagination discipline we just used on the governed stream)
Files: `decompViewerEditorProvider.ts` (inbound switch + poll loop), data provider, `types.ts`.
- Ship the **spine eagerly** in `init` (journeys + US roots + requirement tree + AC nodes + component roots ≈ ~120 nodes). **Lazy-load the high-fan-out layers** (tasks 139, data models 220) on expand via a new inbound `{type:'load_realization', node_id|leaf_ac_id}` → outbound `{type:'realization', parent, nodes[]}`. This confines growth to a request/response path instead of a 3 s full-payload poll.
- Split `computeRevision` into **per-record content-hashes** so `snapshot_update` can carry only changed nodes (`changed_nodes[]` delta) rather than the whole array — the provider header already flags this as the intended 10K-node fix.

### 5. Header + affordances
- Fix the misleading header to state the layer/lens shown (e.g. "Requirement → Realization · run at Phase 6") instead of implying the tree is the current phase.
- Layer filter chips (Requirement/Component/Task/Data-Model) so the operator can scope the drill-down; keep the existing release rail + tier bands.

## Critical files
- `src/lib/decompViewer/decompViewerDataProvider.ts` — generalized loaders + realization join (the bulk of the work).
- `src/lib/decompViewer/types.ts` + `src/webview/decompViewer/stores/snapshot.ts` — mirrored node/snapshot model.
- `src/webview/decompViewer/components/{IndentedTreeView,DagTreeView,NodeRow}.svelte`, `App.svelte` — drill-down rendering.
- `src/lib/decompViewer/decompViewerEditorProvider.ts` — lazy-load message + delta poll.
- Reused as-is: `packetSynthesis/idResolution.ts`, `phases/phase6.ts`, `packetSynthesis/upstreamIndex.ts`.

## Milestones
1. **Data provider + join** (host-only; unit-testable against the clone): load 4 families, build `realizationModel` via `buildRequirementLineage`, drift markers. Gated join test asserts coverage (8 journeys, 8 US, 39/40 leaf ACs covered, task/component/data-model edge counts).
2. **Snapshot/types** mirrored; spine ships in `init`.
3. **Rendering:** journey spine + AC nodes + realization children + layer badges/drift chips.
4. **Lazy-load** tasks/data-models + per-record delta.
5. **Header/filters** polish + test-case (Phase-7) layer wired for when runs reach it.

## Verification
- **Gated host join test** (new, `JANUMICODE_CAL40_DB`, skips w/o clone): build the realization model from the clone and assert — journeys=8, US roots=8, leaf-AC coverage 39/40, every task resolves to ≥1 US, task→component 12/12 resolved (all depths), data-model→component ≥210/220, and the one malformed AC surfaces as drift (not a fabricated edge). Mirror the `scripts/decomp-probe/hierarchy.mjs` assertions.
- **Visual:** the persistent Tier-2 replay instance (already running against the clone) — open the Decomposition Viewer, drill US-005 → AC → component/task, confirm journeys at the top and tasks/data-models appear; confirm memory stays bounded under the lazy-load path (reuse the governed-stream memory lesson).
- **Regression:** existing decompViewer unit tests + phase-indicator tests stay green; `pnpm build` + `tsc --noEmit`.

## Notes / caveats (from the investigation)
- Route US↔component through **tasks** (`component ← task.component_id`, `task → AC → US`); component nodes carry `res-*` responsibility ids, not US/AC, in this run.
- Data-model linkage is split by depth (aggregate root has `component_id`; child entity has US `traces_to`) — union across `root_entity_id`.
- Use `node_id`/`parent_node_id` (UUIDs) for all tree walks; never regex on display ids ([[feedback_no_regex_id_resolution]]).
- The "8 user stories" is valid; the sparse US numbering is a separate Phase-1/2 question for the workflow thread.
