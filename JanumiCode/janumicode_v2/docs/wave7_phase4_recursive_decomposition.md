# Wave 7 — Phase 4 Recursive Component Decomposition

> **Status:** Design draft. Not yet implemented.
> **Predecessor:** Wave 6 (Phase 2.1a / 2.2a recursive requirements decomposition, landed 2026-04-20).
> **Successor (deferred):** Wave 8 (Phase 6 recursive task decomposition), Wave 9+ (Phase 5 partial / Phase 7 selective).
> **Calibration motivation:** [`cal-22b`](../test-and-evaluation/calibration-workspaces/calibration-workspace-cal-22b/) produced **9 components** for the Hestami AI Real Property OS spec — a system whose realistic production architecture has 30–50. The single-pass component bloom in Phase 4.2 is the bottleneck.

---

## 1. Problem statement

Phase 4 currently produces a **flat** Component Model in one pass:

> [phase4 prompt template](../.janumicode/prompts/phases/phase_04_architecture/sub_phase_04_2_component_decomposition/component_decomposition.product.system.md): "Decompose each Software Domain into a set of Components. Each Component MUST have a unique `id`, a unique `responsibility` text within its domain, and a list of dependencies."

For a multi-pillar platform (Hestami: Home Real Property Assistant + Service Provider FSM + Community Association Management) the LLM produces ~9 macro components and stops. The actual implementation surface is at module-level granularity (`comp-work-order-lifecycle` is itself a multi-week subsystem with state machines, media validators, audit hooks, async event emitters). Downstream phases compound the problem:

- **Phase 5** writes one data-model / API / error / config block *per component*. Nine components → nine thin tech-spec entries. The system's actual data-model surface (Hestami CDM lists 40+ entities) collapses into a few aggregate tables.
- **Phase 6** writes one task per `(component × responsibility)`. Nine components × ~3 responsibilities = ~30 tasks for what is genuinely months of engineering.
- **Phase 9** runs each task as a single executor session. With 30 macro tasks, every session is doing too much; verification becomes "sandbox blocked node" because the agent never reaches a coherent atomic completion.

The **root cause** is that Phase 4.2 cannot self-decompose. It produces what the LLM thinks fits in one prompt response, not what the system actually requires.

## 2. Goal

Replicate Wave 6's tier-based saturation loop for **Component decomposition** so that Phase 4.2 produces a **tree** rooted at top-level components, with depth determined by saturation (no new sub-components surface) plus safety caps. Atomic leaves are the units Phase 5/6/7 plan and Phase 9 implements.

**Non-goals (this wave):**
- Phase 5 data-model recursion — separate, smaller wave.
- Phase 6 task recursion — Wave 8.
- Phase 7 / Phase 8 recursion — selective, lower priority.
- Cross-phase tree merging (Phase 4 components ↔ Phase 2 FR leaves) — already partially in place via `getFrozenFrLeaves`; component leaves consume FRs, not the other way around.

## 3. Tier rubric for components

Wave 6 used Tier A/B/C/D for *requirements*. The rubric reskins for *components* as follows:

| Tier | Component meaning | Decomposer routing |
|---|---|---|
| **A — Macro Subsystem** | A coherent business or technical area that has internal sub-systems and is too large for any single executor session. Requires further decomposition. | Recurse without gating. Example: `comp-work-order-lifecycle`. |
| **B — Bounded Domain** | A scope commitment — names a body of behavior the system *does* commit to delivering, but at a granularity humans should review before further decomposition. Mirror-gated. Example: `comp-vendor-compliance-gate` (commits to credential verification + non-compliance refusal). |
| **C — Module** | A bounded set of cohesive responsibilities expected to fit in a small number of sibling sub-modules. One more decomposition pass. Example: `comp-work-order-state-machine`. |
| **D — Atomic Component** | One coherent module that maps to one Phase 5 tech-spec block, drives one cluster of Phase 6 tasks, and yields a known set of files. Terminal — frozen. Example: `comp-work-order-state-transition-validator`. |

**Saturation criterion:** a pass whose `semantic_delta` (newly surfaced sub-components not duplicates of prior siblings, by embedding dedup) is zero AND whose work queue is empty. This is the desired exit path — safety caps (depth, fanout, budget) can also terminate but produce explicit `status='deferred'` supersessions, never silent gaps. Mirror-rejected branches land as `status='pruned'`.

**Safety caps (initial — calibration may revise):**
- `depth_cap`: 6 (lower than Phase 2's 10; component trees are typically shallower than requirement trees).
- `budget_cap`: 200 LLM calls per workflow run (component decomposition is more expensive per call because the prompt carries domain + sibling-component context).
- `fanout_cap`: 12 children per node (higher than Phase 2's 8; software domains can legitimately have many components).

## 4. Workflow shape

### 4.1 Existing Phase 4 sub-phases (today)

| Sub-phase | Output | Status |
|---|---|---|
| 4.1 — Software Domains | `software_domains` artifact | unchanged |
| 4.2 — Component Decomposition | `component_model` artifact (flat) | **becomes recursive** |
| 4.3 — Interface Contracts | `interface_contracts` artifact (per component) | adapted: contracts on leaves |
| 4.4 — ADRs | `architectural_decision_record` artifacts | unchanged |
| 4.5 — Implementability Review | `implementability_review` artifact | adapted: reviews leaves |

### 4.2 New sub-phase: 4.2a — Recursive Component Decomposition

Inserted immediately after 4.2 produces the depth-0 root components. Saturation loop runs over those roots until atomic leaves are reached or caps trip.

```
Phase 4.1 — Software Domains (single-pass, unchanged)
Phase 4.2 — Top-Level Components (single-pass; produces depth-0 root nodes)
  ↓ writes `component_decomposition_node` records at depth=0, tier='root', status='pending'
Phase 4.2a — Recursive Component Saturation Loop ←── new
  Pass 1:
    - Pull `pending` nodes from queue
    - For each: classify-first (atomic_leaf | decomposable | invalid_parent)
      - atomic_leaf → status='atomic', frozen
      - decomposable → emit children with tier A/B/C, surface assumptions
      - invalid_parent → status='pruned' with reason
    - Emit `assumption_set_snapshot` for the pass
    - Tier-B children whose parent is at depth 2 trigger a mirror gate
      → Promise.all(pauseForDecision per Tier-B batch)
      → human accepts / rejects each Tier-B
    - Step 4b: detect Tier-B-children-under-accepted-B → tier-downgrade supersession
    - Step 4c (config-flag-gated): reasoning_review AC-shape audit on Tier-C output
  Pass 2-N: repeat until semantic_delta=0 AND queue empty, OR caps trip
Phase 4.3 — Interface Contracts (adapted: emits contracts on leaves only)
Phase 4.4 — ADRs (unchanged)
Phase 4.5 — Implementability Review (adapted: reviews leaf set, not flat list)
```

### 4.3 Existing Wave 6 mechanisms reused as-is

- `runSaturationLoop` (pattern, not the same function — separate instance for components)
- `rebuildSaturationStateFromStream` (per-decomposition-kind; Wave 6 already parameterizes by `root_kind`)
- Mirror-gate at Tier-B-emergence (Promise.all batch)
- Append-only supersession with `status='downgraded' | 'pruned' | 'deferred' | 'atomic'`
- Per-pass `assumption_set_snapshot`
- `pipeline_id` chain so the webview can render one card per Phase 4.2a run

## 5. Schema additions

### New record types

| Record type | Purpose | Mirror of |
|---|---|---|
| `component_decomposition_node` | One node in the Phase 4.2a tree. Carries `node_id` (UUID, stable across revisions), `display_key` (semantic id like `comp-work-order-state-machine-2`), `parent_node_id`, `root_component_id`, `tier`, `status`, `depth`, `pass_number`, `responsibility_set`, `dependencies`, `surfaced_assumptions`, `release_id`, `release_ordinal`. | `requirement_decomposition_node` |
| `component_decomposition_pipeline` | One pipeline-container record per saturation run. Carries `pipeline_id`, `pass_count`, `total_nodes`, `tier_distribution`, `cap_trip_reasons`. Latest-per-pipeline_id surfaces as one webview card. | `requirement_decomposition_pipeline` |
| `component_assumption_set_snapshot` | Per-pass snapshot of accumulated assumptions about the component model. Distinct from Phase 2's snapshots — these track architectural assumptions ("auth is in a separate component", "audit log is centralized"). | `assumption_set_snapshot` |

### Schema files to add

- `.janumicode/schemas/artifacts/component_decomposition_node.schema.json`
- `.janumicode/schemas/artifacts/component_decomposition_pipeline.schema.json`
- `.janumicode/schemas/artifacts/component_assumption_set_snapshot.schema.json`

### Existing schemas to extend

- `component_model.schema.json` — adds optional `decomposition_tree_pipeline_id` reference. The flat `components[]` list is preserved (downstream phases that haven't been lifted yet still consume it; lift is incremental). The list now contains **leaf** components when a tree exists, falling back to roots otherwise — exact same lift pattern Wave 6 used for `getFrozenFrLeaves`.

### `workflow_runs` columns (new)

- `component_decomposition_budget_calls_used INTEGER DEFAULT 0`
- `component_decomposition_max_depth_reached INTEGER DEFAULT 0`
- `active_component_pipeline_id TEXT`

## 6. Prompt templates

### New (replacing 4.2's flat prompt)

- `.janumicode/prompts/phases/phase_04_architecture/sub_phase_04_2a_component_decomposition/component_decomposition.product.system.md` — unified tier-based decomposer prompt. Mirrors `requirements_decomposition.product.system.md` shape:
  - Classify-first: `parent_branch_classification: "atomic_leaf" | "decomposable" | "invalid_parent"`.
  - Then `parent_tier_assessment` (the parent's own tier, given the children it actually emits).
  - Then `children[]` with tier A/B/C/D and `surfaced_assumptions[]`.
  - Active-constraints block carries the **technical constraints** captured in Phase 1 (so a component decomposition for "comp-frontend-portal" knows it's SvelteKit + Better-Auth, not invented React).

### Modified

- `04_2_component_decomposition.product.system.md` — becomes the **root-emission** prompt: produce only the depth-0 macro components per software domain. The recursive part moves to 4.2a.

## 7. Downstream phase consumption

Wave 6 introduced `getFrozenFrLeaves` + `buildEffectiveFrView` in `phaseContext.ts`. Wave 7 adds the analogous helpers for components:

```ts
// New helpers in phaseContext.ts
getFrozenComponentLeaves(workflowRunId): ComponentNode[];
buildEffectiveComponentView(workflowRunId): ComponentModel;
```

`buildEffectiveComponentView` returns leaf components when a Phase 4.2a tree exists, root components otherwise. Phases that need updating:

| Phase | Currently | After Wave 7 |
|---|---|---|
| Phase 5 (Tech Spec) | iterates flat `components[]` | iterates `getFrozenComponentLeaves(...)`; one tech-spec block per leaf |
| Phase 6 (Impl Plan) | iterates flat `components[]` | iterates leaves; task count scales with tree size, not root count |
| Phase 7 (Test Plan) | iterates FR leaves | unchanged (FR leaves are orthogonal to component leaves; cross-product happens in Phase 6) |
| Phase 4.3 (Interface Contracts) | emits contracts per flat component | emits contracts per leaf component, plus aggregated parent-level contracts derived from union of children |
| Phase 4.5 (Implementability Review) | reviews flat `components[]` | reviews leaf set + audits depth distribution |

The `getFrozenComponentLeaves` cutover is **incremental** — Phase 5 / 6 / 4.3 / 4.5 each switch independently, falling back to the flat list when no tree exists. This mirrors Wave 6's incremental lift onto FR leaves.

## 8. Reasoning Review (Step 4c) for components

Wave 6's Step 4c audits Tier-C children for AC-shape (verifiable / measurable / non-tautological). For components, the analogous audit is **responsibility-shape**:

- Are the responsibilities **verb-led action statements** (not nouns or vague titles)?
- Are they **mutually exclusive within the component** (no overlapping responsibilities)?
- Do they **collectively exhaust** the parent's responsibility (no gaps)?
- Are dependencies **directional** (no circular declarations)?

Same flag-gated rollout as Wave 6: `decomposition.component_reasoning_review_on_tier_c` (default off until calibration evidence supports flipping).

## 9. Mirror gate UX

The webview already has `DecompositionNodeCard` and `DecompositionPipelineCard` for Phase 2. Wave 7 needs analogous cards for Phase 4.2a:

- `ComponentDecompositionNodeCard.svelte` — node detail with tier badge, responsibility set, dependencies, parent link.
- `ComponentDecompositionPipelineCard.svelte` — pipeline summary with tier distribution, depth distribution, cap trip reasons.
- Mirror gate UI: same Promise.all batch as Wave 6. Tier-B components surface as accept/reject decisions.

## 10. Integration with Phase 1.0c (technical constraints)

Wave 7's prompt MUST consume Phase 1.0c's `technical_constraints_discovery` artifact in the active-constraints block. This is the load-bearing channel that makes downstream phases honor the user's stated stack:

```
Active Constraints (verbatim from Phase 1.0c):
- TECH-SVELTEKIT-1: SvelteKit for frontend web portals.
- TECH-BUN-1: Node.js (Bun) for backend runtime.
- TECH-POSTGRES-1: PostgreSQL with RLS.
- TECH-DBOS-1: DBOS for workflow engine.
- ...
```

When the decomposer proposes a component like "Vendor Matching Engine," the constraints anchor its sub-decomposition: Bun service + PostgreSQL aggregate + DBOS workflow handler — not Python + FastAPI + Celery (the cal-22b drift).

**Prerequisite:** the [Phase 1.0c normalizer bug](../src/lib/orchestrator/phases/phase1.ts#L2028) must be fixed first (it currently drops every constraint because `text` is missing on the LLM emission). Without that fix, the active-constraints block stays empty and Wave 7 can't anchor sub-components.

## 11. Files to create / modify

### Create

| Path | Purpose |
|---|---|
| `src/lib/orchestrator/phases/phase4_2a.ts` | Recursive component saturation loop (mirrors `phase2.ts` saturation loop section) |
| `src/lib/orchestrator/phaseHelpers/componentLeafProjection.ts` | `getFrozenComponentLeaves`, `buildEffectiveComponentView` |
| `.janumicode/prompts/phases/phase_04_architecture/sub_phase_04_2a_component_decomposition/component_decomposition.product.system.md` | Recursive decomposer prompt |
| `.janumicode/schemas/artifacts/component_decomposition_node.schema.json` | New record schema |
| `.janumicode/schemas/artifacts/component_decomposition_pipeline.schema.json` | New record schema |
| `.janumicode/schemas/artifacts/component_assumption_set_snapshot.schema.json` | New record schema |
| `src/webview/components/ComponentDecompositionNodeCard.svelte` | Webview node card |
| `src/webview/components/ComponentDecompositionPipelineCard.svelte` | Webview pipeline card |
| `src/test/unit/orchestrator/phase4ComponentDecomposition.test.ts` | Unit tests (saturation, mirror gate, mislabel downgrade, AC-shape audit, idempotent resume) |
| `scripts/extract-phase4-decomposition.js` | Gold capture extractor mirroring `extract-phase2-decomposition.js` |

### Modify

| Path | Change |
|---|---|
| `src/lib/orchestrator/phases/phase4.ts` | Wire 4.2a between 4.2 and 4.3; rebuildSaturationState on resume; emit pipeline container records |
| `src/lib/orchestrator/phases/phase5.ts` | Consume `getFrozenComponentLeaves` instead of flat list (incremental — falls back) |
| `src/lib/orchestrator/phases/phase6.ts` | Same lift |
| `src/lib/orchestrator/phaseContext.ts` | Export new helpers |
| `src/lib/database/schema.ts` | Add three workflow_runs columns + new record_type values |
| `src/lib/types/records.ts` | Type definitions for new record types and `ComponentDecompositionNodeContent` |
| `src/lib/config/configManager.ts` | Add `decomposition.component_*` config block (depth_cap, budget_cap, fanout_cap, reasoning_review_on_tier_c) |

## 12. Tests

Mirroring `phase2ProductLens.test.ts`, the Wave 7 test plan is:

1. **Happy path:** depth-0 roots emitted; saturation loop runs to completion on a small fixture (3 domains, ~7 components total); leaf count > root count; tree shape matches expected.
2. **Mirror gate:** Tier-B components emerge at depth 2; pauseForDecision called once per Tier-B batch; accept/reject paths both produce correct supersession records.
3. **Rejection pruning:** rejected Tier-B branch produces `status='pruned'` records; descendants of rejected branch are not decomposed.
4. **Mislabel downgrade:** Tier-B child under an accepted Tier-B parent triggers tier-downgrade supersession with `[Scope expansion]` note.
5. **AC-shape audit (Step 4c):** flag-on, verb-led / mutually-exclusive / non-overlapping checks fire; verdicts recorded.
6. **Cap trips:** depth_cap, budget_cap, fanout_cap each individually trigger `status='deferred'` supersessions and surface as `cap_trip_reasons` in the pipeline record.
7. **Idempotent resume:** mid-run kill + `--resume-from-db --resume-at-phase 4` reproduces the same final tree (zero duplicate emissions).
8. **Tech-constraints anchoring:** when Phase 1.0c constraints include `TECH-SVELTEKIT-1` and `TECH-BUN-1`, leaf components in the frontend domain reference SvelteKit; backend domain leaves reference Bun. Asserts via fixture comparison.
9. **Empty input:** zero domains → zero roots → zero passes; pipeline record still emitted with `pass_count=0`.
10. **Cross-component dependency cycles:** decomposer emits a cycle (A depends on B which depends on A); Phase 4.5 implementability review flags it post-loop. (Loop itself doesn't validate cycles — that's downstream.)

Plus 5–7 prompt-probe tests in `src/test/prompt-probes/phase4_2a.probe.ts`.

## 13. Calibration plan

Following the Wave 6 cal-1 → cal-4 pattern:

1. **wave7-cal-1:** small fixture (test-workspace todo app) — proves saturation terminates cleanly under fast model, no caps trip, leaf count plausible.
2. **wave7-cal-2:** Hestami spec under llamacpp/qwen3.5-35b-a3b. Targets: 30–50 leaf components, 3–5 levels deep, all 21 Phase 1.0c technical constraints surface in at least one leaf's active-constraints block.
3. **wave7-cal-3:** strong reasoning_review (gemma-4-e4b-it via llama-swap) on Tier-C components. Targets: ≥80% policy-verdict rate; flag-default decision evidence.
4. **wave7-cal-4:** brownfield resume from cal-2 DB to validate idempotent re-execution.

## 14. Open design questions

1. **When a component has dependencies on a sibling that's still being decomposed**, does the parent wait, or does the dependency declaration use the *parent* of the sibling? **Tentative:** declare against the deepest currently-frozen ancestor of the dependency target. Re-resolve on saturation.
2. **How does `release_id` propagate down the component tree?** Phase 1.8 produces `release_plan`; root components inherit a release assignment via the bloom step. Children inherit their parent's release unless explicitly re-assigned. Same pattern Wave 6 uses for FR nodes.
3. **Should Phase 4.3 interface contracts emit at every level or only at leaves?** **Tentative:** leaves emit detailed contracts; intermediate nodes emit aggregated contracts derived deterministically from the union of their children's contracts. Phase 4.5 implementability review checks aggregation correctness.
4. **Cross-cutting concerns (auth, audit, RLS).** These don't fit a tree — they're horizontal. Wave 6 handled them as Tier-B *root* commitments. Wave 7 should follow suit: cross-cutting concerns become first-class top-level components rather than getting buried inside every domain. Phase 4.1 software-domains step needs prompt nudge to surface them.
5. **Backward compatibility.** The flat `component_model.components[]` array stays in the artifact. New consumers use leaves; legacy consumers see the same shape they always did. Eventually the flat list can be deprecated, but not in this wave.

## 15. Deferred to later waves

- **Phase 6 recursive task decomposition** (Wave 8) — depends on stable component leaves from Wave 7.
- **Phase 5 data-model recursion** — only if Wave 7 calibration shows shallow data models post-cutover.
- **Phase 7 selective recursion** for complex e2e scenarios — lower priority.
- **Phase 9 release-plan-driven sequencing** — independent track; needs design doc of its own (working title: *Wave R — Phase 9 Release-Plan Execution Sequencing*). The recursive decomposition waves (6, 7, 8) generate the inputs; the release wave figures out how to traverse them.

## 16. Acceptance criteria for Wave 7 close-out

- [ ] All 10 unit tests pass; full test suite stays green.
- [ ] cal-22b-equivalent run produces ≥30 leaf components for the Hestami spec.
- [ ] Phase 5 / Phase 6 consume leaves; their output sizes scale 3-5× over cal-22b.
- [ ] Technical constraints from Phase 1.0c surface verbatim in leaf-component active-constraints.
- [ ] Mirror gate fires at least once and accept/reject paths both work end-to-end.
- [ ] Cap-trip paths produce `status='deferred'` records, never silent gaps.
- [ ] Idempotent resume validated.
- [ ] DecompositionPipelineCard renders in webview with tier distribution + depth histogram.
