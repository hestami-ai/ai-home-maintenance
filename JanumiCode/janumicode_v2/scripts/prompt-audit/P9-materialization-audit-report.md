# Phase-9 Prompt-Materialization Audit — Synthesis

## Verdict

**Phase-9 prompts are materially INCORRECT and INCOMPLETE.** P9 is the manifestation of every upstream output, and at exactly that seam two ground-truth axes are dropped:

1. **The P5.1b entity-ownership axis** (the DDD elected owner / owned-vs-referenced split) is invisible to the entire P9 scaffold path — grep of `scaffoldingAgent.ts` for `ownership_role`/`owner_component_id`/`owner_entity_id`/`entity_ownership_map` is empty. Both the scaffold renderer and the module-ownership planner re-derive ownership by first-seen / sync-sink heuristics that contradict the elected owner.
2. **The recon area boundary** is not a component partition (areas carry `components:0`), so the global 17-component / ~39-DM / 9-contract roster is fanned identically into every area prompt, all re-rooted at `src/`.

The same mechanisms were independently reproduced across **all 8 scaffold-area targets** (core-api, backend-services, web-frontend, native-clients, infrastructure, area-native, area-node, area-sveltekit), and the sister defects appear in the module-ownership planner and the packet layer. Every load-bearing line was re-verified against HEAD.

## Defect Matrix (CONFIRMED first, then PLAUSIBLE; REFUTED dropped)

| # | Defect | Sev | Status | Where | Targets |
|---|--------|-----|--------|-------|---------|
| D1 | Shared DMs keyed to first-seen component, not P5.1b elected owner | high | CONFIRMED | `scaffoldingAgent.ts` `renderSharedDataModels:202` | all 8 areas |
| D2 | Divergent shapes force-merged into one 'reconcile to ONE' shared-kernel type | high | CONFIRMED | `renderSharedDataModels:208-236` | all 8 areas |
| D3 | Global roster fanned into every area, all rooted at `src/` → collision | high | CONFIRMED | `runScaffoldingAgentSubPhase:45-88`, `reconcileAreaLayout:424` | all 8 areas |
| D4 | Cross-stack separator: node-hyphen dirs handed to python/other areas | high | CONFIRMED | `gatherComponentDirs(…plan.areas[0].stack):56` | backend-services, infra, native |
| D5 | module-ownership planner inverts DDD owner (sink/first-seen) | high | CONFIRMED | `moduleOwnershipPlanner.ts` `resolveOwner` | module_ownership plan |
| D6 | Recon sentinel stack rendered as language ('IDIOMATIC other') | high | CONFIRMED | `buildAreaScaffoldingPrompt` | native-clients |
| D7 | 8000-char budget drops ~25/39 shared entities behind unreachable pointer | high | CONFIRMED | `renderSharedDataModels:145/240/246` | all 8 areas |
| D8 | Relationship targets '→ ?' from wrong upstream key read | medium | CONFIRMED | `renderSharedDataModels:218` | all 8 areas |
| D9 | Recon sentinel manifest name rendered as literal filename | medium | CONFIRMED | `buildAreaScaffoldingPrompt` | native, area-native |
| D10 | C1: 7 atomic tasks double-assigned, persistent to fixpoint | medium | CONFIRMED | `coherenceVerifier.ts:383-390` | packet layer |
| D11 | P1: story-less infra tasks hard-fail, persistent to fixpoint | medium | CONFIRMED | `coherenceVerifier.ts:179-185` | packet layer |
| D12 | module-ownership over-collapses generic barrels (models/db) | medium | CONFIRMED | `moduleOwnershipPlanner.ts` `isShared:270` | module_ownership plan |
| D13 | module-ownership drops owner_entity_id (no join to elected DM) | medium | CONFIRMED | `moduleOwnershipPlanner.ts` `SharedModule:83-102` | module_ownership plan |
| D14 | area gate_commands + source_refs dropped from scaffold prompt | medium | CONFIRMED | `buildAreaScaffoldingPrompt` | all areas |
| D15 | Cross-phase DM id split-brain (scaffold first-seen vs packet owner) | high | PLAUSIBLE | `renderSharedDataModels:202` vs packets | cross-phase |
| D16 | Wrong-scope / (older) unstripped-runtime contracts fanned to all areas | medium | PLAUSIBLE | `gatherContracts:298` / `stripContractRuntimeFields:263` | native, sveltekit |

## Key Evidence (re-verified at HEAD)

- **D1/D2** — `renderSharedDataModels` (scaffoldingAgent.ts): line 202 sets the id from the first-seen component (`DM-${compId}-${name}`, set only on first creation); lines 208-214 union fields by name; line 236 emits `[divergent — … reconcile to ONE canonical shape]`. Grep of the whole file for the five ownership symbols = **0**. `ownership_map.json` elects `DM-property-service-propertyrecord`; the prompt renders `DM-audit-log-retriever-propertyrecord`. `entityOwnershipBridge.ts` explicitly states the shared-kernel merge is 'the coupling we must avoid … Divergent per-context field sets are PRESERVED, not merged' — the scaffold does exactly what the bridge forbids.
- **D3** — lines 45-46 gather DM/contracts once; line 56 gathers componentDirs once; line 62 loops `for (const area of plan.areas)`; line 88 passes the identical three globals to `buildAreaScaffoldingPrompt` every iteration. `reconcileAreaLayout:424` = `commonParentRoot(componentDirs.map(c=>c.dir)) ?? 'src'` → every area root becomes `src`. The DM-header block is byte-identical (same md5) across areas.
- **D4** — line 56: `gatherComponentDirs(engine, runId, plan.areas[0]?.stack)`. With areas[0]=node, python areas receive `src/workorder-service` (hyphen) while the python executor resolves `src/workorder_service` (underscore) — slice-156 duplicate-dir failure across areas.
- **D5** — `module_ownership.json`: `property` → owner `comp-audit-log-retriever` (owner_source `data_model_owner`), consumer `[comp-property-service]`; `ownership_map.json` elects `comp-property-service`. 3 of 8 `data_model_owner` modules invert; in each the sole consumer is the true elected owner. The planner keeps only entity_name+component_id (L468-469) and never reads the map (the 8 grep hits are the planner's own output field `owner_component_id`).
- **D7** — `SCAFFOLD_DM_BUDGET=8000` (line 145); drop at item boundary (line 240) + note (line 246) '… (25 more shared entities elided … materialize the remainder from the data_models artifact)'. 14 rendered / 25 dropped; dropped set includes elected-owner aggregates (Permission, Job, UserAccount, AuditLog, TenantConfiguration, EmailQueue, UserRoleAssignment, BoardVotingAuditTrail, RolePermission). The mimo session cwd = `<ws>/project`; the artifact lives only in the control-plane DB → pointer unactionable.
- **D8** — line 218: `ro.target_entity_id ?? ro.target ?? '?'`. Actual key frequencies in the reconciled data_models: `target_entity`=45, `references`=49, `target`=20, `target_entity_id`=0 → the majority render '→ ?' purely from the key mismatch. FK columns survive as scalar fields, so severity is medium.
- **D10/D11** — C1=7 and P1=6 are **constant across all six cycle records including the converged fixpoint** (`77e62673`). C1 auto-routing is 'log-only' (`packetSynthesis.ts:645`); packets returned unfiltered (line 680). P1 exempts only `task_type==='refactoring'`; the offending tasks are `standard`.

## What is NOT a defect (refuted — do not action)

- **`?` → 'FK undefined'** — refuted: the FK columns are materialized as scalar entity fields; the '→ ?' lines are supplementary annotations a skeleton executor ignores. (The key-mismatch itself, D8, is still real but medium.)
- **module_ownership_plan 'not carried into scaffold'** — refuted: it is intentionally threaded into the **implementation-leaf** executor via `executionScheduler.setOwnershipPlan` ('import the existing shared module … do NOT create your own copy'); the scaffold correctly draws canonical-modules from recon's own curated list.
- **Packet 110/110 failure / ai_proposed_root=0 / P4 / P3 / 1034-advisory 'flood'** — refuted: these are transient first-cycle states that heal across the six-record convergence (110→12→8→8→8→8); `ai_proposed_root` is a provenance annotation, not a remediation channel.
- **scaffold-synthesis single-TS-kernel** — refuted: it is the deterministic catastrophic **safety-net fallback** (`phase9.ts:184`), not the operative polyglot path; `brownfield_detected` (real package.json/tsconfig on disk) correctly outranks recon.
- **Interface-contract runtime-field mis-frame (PD-9)** — already fixed at HEAD by `stripContractRuntimeFields` (line 263); only older cal-40 captures carried it. Contracts use a separate 5000-char budget, so they do **not** feed the DM truncation.

## Root Causes

1. **RC1 — the entity_ownership_map is never consulted in Phase 9.** `renderSharedDataModels` and `buildModuleOwnershipPlan` both re-derive ownership by first-seen/sync-sink and ignore the elected owner. Single origin of D1, D2, D5, D13, D15.
2. **RC2 — a ReconArea has no component roster** (`components:0`); areas are build/stack units, so there is nothing to scope the global roster by → global gather fanned to every area (D3).
3. **RC3 — `reconcileAreaLayout` collapses every area root to `src`** via `commonParentRoot`, and `areaWriteScope` keeps the collision in-scope (D3).
4. **RC4 — component-dir separator pinned to `plan.areas[0].stack`** → wrong dir convention for non-primary polyglot areas (D4).
5. **RC5 — wrong upstream relationship keys + ownership tags ignored** in the merge (D8, D2 field-union facet).
6. **RC6 — recon sentinels and gate/source_refs interpolated/dropped verbatim** with no normalization (D6, D9, D14).
7. **RC7 — the 8000-char DM budget drops shared types behind a pointer** to an artifact the headless executor cannot open (D7).
8. **RC8 — coherenceVerifier exempts only refactoring from P1 and never repartitions C1** (auto-routing log-only), so both persist to the fixpoint (D10, D11).

## Recommended Fixes (file / function)

1. **`scaffoldingAgent.ts`** — add `gatherEntityOwnership()` reading `getArtifactByKind(runId,'entity_ownership_map')`; in `renderSharedDataModels` key each shared entity to `owner_entity_id`/`owner_component_id`, render the owner's shape ONCE + reference projections for non-owners (drop the field-union + 'reconcile to ONE'), and build the member list from `member_component_ids`. → D1, D2.
2. **`phase9Recon.ts`** — add a `components` roster to `ReconArea`; populate for mixed/brownfield (source_roots ∩ canonical dir). Prerequisite for D3.
3. **`scaffoldingAgent.ts` `runScaffoldingAgentSubPhase`/`buildAreaScaffoldingPrompt`** — move `gatherComponentDirs`/`gatherDataModels`/`gatherContracts` inside the per-area loop (or filter by area membership); pass per-area subsets. → D3.
4. **`scaffoldingAgent.ts` `reconcileAreaLayout`** — stop forcing `root='src'`; use each area's own `source_roots`; designate exactly ONE shared-types session to author `src/shared/*` once, others import. → D3.
5. **`scaffoldingAgent.ts` `gatherComponentDirs`/`canonicalComponentDir`** — derive the separator per-area from each area's stack, not `plan.areas[0].stack`. → D4.
6. **`scaffoldingAgent.ts` `renderSharedDataModels:218`** — also read `ro.target_entity` and `ro.references`. → D8.
7. **`scaffoldingAgent.ts` `buildAreaScaffoldingPrompt`** — normalize recon sentinels (split 'other'/native into Swift/Kotlin; render a real manifest name or omit); render `area.gate_commands` + `area.source_refs`. → D6, D9, D14.
8. **`scaffoldingAgent.ts` `SCAFFOLD_DM_BUDGET`/`renderSharedDataModels`** — raise/remove the cap or fan shared-DM authoring into a dedicated shared-types session; never point at an unreachable artifact. → D7.
9. **`moduleOwnershipPlanner.ts` `resolveOwner`/`buildModuleOwnershipPlan`** — consult `entity_ownership_map` owner for data-model-backed modules; carry `owner_entity_id` on `SharedModule`; exclude generic infra barrels (`models`/`db`/`migrations`, `category=''`) from the ≥2-consumer collapse. → D5, D12, D13.
10. **`coherenceVerifier.ts`** — add an infra/NFR story-less exemption for P1; repartition C1 double-assigned tasks in the re-synthesis loop (promote C1 auto-routing from log-only). → D10, D11.

## Bottom line

The highest-leverage fix is **RC1**: wiring the P5.1b `entity_ownership_map` into `renderSharedDataModels` and `moduleOwnershipPlanner` removes the wrong-owner ids, the shared-kernel force-merge, and the module-ownership inversion in one stroke (D1, D2, D5, D12, D13, and the substrate for D15). **RC2/RC3** (give areas a component roster and stop collapsing every root to `src`) removes the 8-way fan-out and path collisions. Together they convert the current 'every area re-authors the whole project as one coupled kernel' output into a correctly partitioned, owner-aligned skeleton — which is precisely what the P9 0-artifact / collision outcome demanded.