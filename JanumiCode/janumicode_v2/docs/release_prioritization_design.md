# Release-Based Prioritization — Design

**Status**: Draft · **Owner**: mchendricks1 · **Last updated**: 2026-04-22

## Context

JanumiCode v2 currently produces decomposition trees (Phase 2 FR/NFR) and downstream artifacts (Phase 3 architecture, Phase 7+ implementation plan) as essentially flat pools of work. When the source intent describes a phased delivery — as the Hestami product description did with its three-pillar sequencing (Home Real Property Assistant → Field Services → Community Association Management) — that ordering is captured in Phase 1's `intent_discovery.phasingStrategy` and in each `userJourney.implementationPhase`, but it does **not** propagate past Phase 2's LLM prompt context.

Concretely:

- **Phase 1** extracts the phasing and stores `phasingStrategy: PhasingPhase[]` on `intent_discovery`, plus a per-journey `implementationPhase: "Phase N"` tag. The LLM proposes it; a human reviews journeys but not the phasing separately.
- **Phase 2.1/2.1a** passes journey summaries (with their phase tag as a visible annotation) into the decomposer prompt as *context*. Each emitted `user_story` gets `traces_to: [journey_id, …]`, but the phase/release assignment is never computed or stored on the decomposition node itself.
- **Phase 3+** has **zero references** to `phasingStrategy`, `implementationPhase`, or any release concept. All FR/NFR leaves are treated as one pool. Only per-story `priority: critical|high|medium|low` influences ordering downstream.

For the first Hestami end-to-end run this would yield an implementation plan that intermixes Home Assistant, Field Services, and CAM work with no structural ordering — misaligning with the user-declared pillar sequencing.

Scope of this design: make a user-authored release plan a first-class artifact that propagates through the **requirements → architecture → tasks** decomposition chain, so each tree's structure and every downstream planning decision respects the declared release order.

## Terminology

Hestami's "pillar" was a product-specific term. The industry-standard term we adopt is **release** — "what ships together, in which order". This is framework-neutral (unlike SAFe's *Release Train* / *PI*), has a natural ordinal, and does not collide with JanumiCode's already-used word *phase* (the 0–10 workflow phases).

- **ReleasePlan** — the artifact listing all releases for a run, with their order.
- **Release** — one entry in the plan; has an ordinal, a name, description, rationale.
- **Release assignment** — the `release_id` a decomposition node (FR, NFR, architecture element, task) is tagged with.
- **Backlog** — `release_id: null`, the bucket for items that do not fit any current release.

## Resolved design questions

| # | Question | Decision |
|---|---|---|
| 1 | Cross-release dependencies | Allowed: Release 2 work can depend on Release 1 artifacts. NOT allowed: Release 1 depends on Release 2 — that's a release-plan error and should fail validation (signal to re-plan). |
| 2 | Assign-on-revision vs re-derive | **Preserve.** When a decomposition node is re-emitted (Step 4b downgrade, pruned, deferred, or other supersession), the new revision carries forward the prior revision's `release_id` unchanged. Release assignment is treated as a commitment — tree-structure changes do not silently relocate leaves across releases. Explicit human action (or a new gate) is required to change assignment. |
| 3 | Unreleased / deferred items | Supported via **backlog**: `release_id: null`. Plan synthesis surfaces the backlog as a named bucket; downstream phases can consume it last or flag it for future release-plan iteration. |
| 4 | Human override granularity | **Subtree-level.** Humans move a whole subtree from one release to another (e.g. all descendants of FR-ACCT-1 shift from Release 2 to Release 1). Leaf-level moves are rejected — they would orphan the leaf from its parent's release and invite inconsistency. This is enforced at the gate surface where reassignment is offered. |

## Data model

### New content type

```ts
// in src/lib/types/records.ts

export type ReleaseOrdinal = number; // 1, 2, 3, …; stable within a ReleasePlan.

export interface Release {
  /** Canonical logical UUID — stable across revisions of this Release entry. */
  release_id: string;
  /** Ordinal position in the plan (1-based, contiguous). Ordering is strict. */
  ordinal: ReleaseOrdinal;
  /** Short human name, e.g. "Home Real Property Assistant". */
  name: string;
  /** One-paragraph description of what ships in this release. */
  description: string;
  /** Why this sits at this ordinal — dependencies, value-ordering, etc. */
  rationale: string;
  /** Journey ids (from Phase 1 bloom) that belong to this release. */
  traces_to_journeys: string[];
  /**
   * Business-domain ids that predominantly belong to this release. Optional —
   * many domains span multiple releases (e.g. `DOM-DATA` usually underpins
   * every release, so it goes in Release 1).
   */
  traces_to_domains?: string[];
}

export interface ReleasePlanContent {
  kind: 'release_plan';
  schemaVersion: '1.0';
  releases: Release[];
  /** Human confirmation that this plan is the one downstream phases should honor. */
  approved: boolean;
  /** Free-text note from the human at the approval gate. */
  approval_note?: string;
}
```

### Extensions to existing decomposition content

```ts
// in RequirementDecompositionNodeContent (Phase 2 — FR + NFR)
// + analogous fields on architecture + task decomposition node types
// when those are formalised.

export interface RequirementDecompositionNodeContent {
  // ... existing fields ...
  /**
   * Release assigned to this node. Inherited from parent, or from the
   * root's `release_id` when assigned at root. `null` = backlog.
   * Preserved across supersessions (downgrade / prune / defer / atomic).
   */
  release_id: string | null;
  /**
   * Cached release ordinal at the time this node was most recently
   * written. Denormalized for downstream sort-by-release without a
   * ReleasePlan join. Must be refreshed if the ReleasePlan is edited.
   */
  release_ordinal: number | null;
}
```

### New workflow-runs column

```sql
-- Seeded by the Phase 1.7 release-plan gate; read by Phase 2+.
-- Points at the current-version governed_stream row of kind
-- `release_plan`. Null until the release plan is approved.
ALTER TABLE workflow_runs ADD COLUMN active_release_plan_record_id TEXT;
```

## Pipeline flow

```
┌────────────────────────────────────────────────────────────────────┐
│ Phase 1 — Intent Capture                                           │
│ 1.6 Intent statement (existing)                                    │
│ 1.7 NEW — ReleasePlan proposal + human gate                        │
│     - LLM proposes releases from phasingStrategy + journeys + domains│
│     - Human reviews: reorder, rename, merge, split, move-journey   │
│     - Approved ReleasePlan record is written                       │
│     - active_release_plan_record_id is set on workflow_runs        │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ Phase 2 — Requirements Decomposition                               │
│ 2.1 FR bloom → depth-0 roots                                       │
│ 2.1a FR saturation                                                 │
│   Root assignment: match root's primary `traces_to` journey        │
│     against ReleasePlan.releases[*].traces_to_journeys → release_id│
│   Child inheritance: child.release_id = parent.release_id          │
│   Unmatched roots → release_id=null (backlog)                      │
│ 2.2 NFR bloom — same pattern                                       │
│ 2.2a NFR saturation                                                │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ Phase 3 — Architecture                                             │
│ Each architectural element inherits release_id from the FR/NFR     │
│ leaves it realizes. If an element spans multiple releases, it      │
│ belongs to the LOWEST ordinal (earliest release) that needs it.    │
│ Cross-release dependency check: no architecture element may depend │
│ on an element with a higher ordinal.                               │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ Phase 7+ — Implementation Plan / Task Decomposition                │
│ Tasks inherit release_id from the architecture element they        │
│ implement. Plan synthesis groups tasks by release_ordinal,         │
│ scheduling lower ordinals first. Backlog tasks appear as a         │
│ separate section surfaced for future release-plan iteration.       │
└────────────────────────────────────────────────────────────────────┘
```

## New Phase 1.7 — ReleasePlan proposal + human gate

### Proposer (LLM)
Runs after 1.6 intent-statement approval. Reads:
- `intent_statement.product_concept`
- `intent_discovery.phasingStrategy` (initial LLM-derived ordering — the model's starting suggestion)
- `journeys_workflows_bloom.userJourneys` (each with `implementationPhase`)
- `business_domains_bloom.domains`

Emits a `ReleasePlanContent` proposal.

### Human gate
Presented via an MMP bundle. Supports:
- **Reorder**: swap ordinals.
- **Rename**: edit name + description + rationale.
- **Merge**: two releases collapse into one (union of journey/domain traces).
- **Split**: one release becomes two (human-provided partition of journeys/domains).
- **Move journey**: a journey id moves from one release's `traces_to_journeys` to another's.
- **Approve**: lock the plan. `approved: true` + optional `approval_note`.

Rejection re-triggers the proposer with the human's mirror decisions as feedback (same pattern as Phase 1 bloom feedback-loop).

### Output
`active_release_plan_record_id` on the workflow_runs row points at the approved ReleasePlan. Downstream phases read it via a new helper `resolveActiveReleasePlan(workflowRunId)` in `phaseContext.ts`.

## Propagation mechanics

### Phase 2 root assignment (Phase 2.1, Phase 2.2)
At depth-0 node write time, for each root FR (or NFR) with `traces_to: [UJ-1, UJ-2]`:

```ts
function assignReleaseToRoot(
  rootStory: UserStory,
  plan: ReleasePlanContent,
): { release_id: string | null; release_ordinal: number | null } {
  // Pick the lowest-ordinal release among those whose traces_to_journeys
  // intersect rootStory.traces_to. Ties go to the earliest ordinal.
  // If no intersection: backlog.
  const candidates = plan.releases
    .filter(r => r.traces_to_journeys.some(j => rootStory.traces_to?.includes(j)))
    .sort((a, b) => a.ordinal - b.ordinal);
  const picked = candidates[0];
  return picked
    ? { release_id: picked.release_id, release_ordinal: picked.ordinal }
    : { release_id: null, release_ordinal: null };
}
```

### Phase 2.1a / 2.2a child inheritance
At every child write inside the saturation loop:

```ts
content: {
  // ...
  release_id: parentContent.release_id,       // inherited
  release_ordinal: parentContent.release_ordinal,
}
```

### Supersession preservation (Question 2)
`writePrunedSupersession`, `writeDeferredSupersession`, and Step 4b downgrade re-emit carry the prior revision's `release_id` + `release_ordinal` forward unchanged. `content.user_story` and `content.release_id` are both read from the original and re-written verbatim.

### Downstream — Phase 3 and Phase 7+
Same inherit-from-parent pattern. Architecture elements lookup: if an element consolidates requirements across multiple releases, it belongs to the lowest ordinal (pulled forward so downstream phases can implement it in time).

## Human override granularity — subtree moves

A gate surface exposes two operations:

1. **Move subtree to release**: given a node, reassign it and every descendant (current-version only) to a different release. Backend walks the tree via `parent_node_id` logical UUID and writes supersession rows with the new `release_id` + `release_ordinal` for each affected node. All other fields preserved.
2. **Move subtree to backlog**: same, with `release_id: null`.

Leaf-level moves (moving a single node without its descendants) are **rejected** at the gate — the UI surfaces a hint suggesting either subtree-move or split-and-reassign.

Rationale: subtree-level preserves the inheritance invariant (parent.release_id == child.release_id) trivially; leaf-level would require per-node exceptions that complicate every downstream join.

## Validation rules

Enforced at gate-approval time (and re-checked in Phase 3 before architecture assignment):

1. **Ordinals are contiguous 1..N.** No gaps.
2. **All journeys are assigned or explicitly unreleased.** Every journey id in the bloom output appears in exactly one release's `traces_to_journeys` or is enumerated in a `backlog_journeys` meta field (future work — not in v1).
3. **No cross-release backward dependencies.** Release K cannot depend on Release K+1. Enforced at Phase 3 — if an architecture element in Release K derives from a requirement in Release K+N, validation fails with a re-plan prompt.
4. **Root-to-release stability on resume.** On workflow resume, root-to-release assignments from the persisted stream are trusted; the proposer is not re-invoked unless the human explicitly requests a re-plan.

## Files touched (when implemented)

| Action | Path |
|---|---|
| Create | [src/lib/types/records.ts](JanumiCode/janumicode_v2/src/lib/types/records.ts) — add `Release`, `ReleasePlanContent`, extend `RequirementDecompositionNodeContent` with `release_id` + `release_ordinal` |
| Create | `.janumicode/schemas/artifacts/release_plan.schema.json` |
| Modify | [src/lib/database/schema.ts](JanumiCode/janumicode_v2/src/lib/database/schema.ts) — add `active_release_plan_record_id TEXT` to workflow_runs |
| Modify | [src/lib/database/init.ts](JanumiCode/janumicode_v2/src/lib/database/init.ts) — idempotent ALTER for the new column |
| Modify | [src/lib/orchestrator/stateMachine.ts](JanumiCode/janumicode_v2/src/lib/orchestrator/stateMachine.ts) — `setActiveReleasePlanRecordId`, `getActiveReleasePlan`, read `active_release_plan_record_id` |
| Create | Phase 1.7 proposer + gate logic in [src/lib/orchestrator/phases/phase1.ts](JanumiCode/janumicode_v2/src/lib/orchestrator/phases/phase1.ts) — new method `runReleasePlanProposal` and `handleReleasePlanApproval` |
| Create | `.janumicode/prompts/phases/phase_01_intent_capture/sub_phase_01_7_release_plan/*.system.md` (product lens only for v1) |
| Modify | [src/lib/orchestrator/phases/phase2.ts](JanumiCode/janumicode_v2/src/lib/orchestrator/phases/phase2.ts) — call `assignReleaseToRoot` at depth-0 writes (FR + NFR); inherit at every child write; preserve across supersessions |
| Modify | [src/lib/orchestrator/phases/phaseContext.ts](JanumiCode/janumicode_v2/src/lib/orchestrator/phases/phaseContext.ts) — `resolveActiveReleasePlan(runId)` helper + `FrozenFrLeaf.release_id` + `release_ordinal` on the projection; update summary formatting to group by release |
| Modify | Phase 3+ (when it consumes FR leaves) — inherit release_id from realized FR/NFR leaves; enforce no backward cross-release dependencies |
| Create | [src/webview/components/ReleasePlanCard.svelte](JanumiCode/janumicode_v2/src/webview/components/ReleasePlanCard.svelte) — editable card for the 1.7 gate (reorder / rename / merge / split / move-journey / subtree-reassign operations) |
| Modify | [scripts/export-decomposition-to-markdown.js](JanumiCode/janumicode_v2/scripts/export-decomposition-to-markdown.js) — group roots by `release_ordinal`, render a release-by-release document structure |
| Create | Unit tests: release-plan schema validation, root assignment, child inheritance, subtree-move supersession chain, supersession preservation, cross-release dependency check |

## Implementation phasing

Ship in three increments to bound risk:

1. **v1 — data model + Phase 1.7 gate + Phase 2 inheritance.** Ship the `ReleasePlanContent` record, the 1.7 proposer + gate, and the root-assignment + child-inheritance plumbing in Phase 2. Downstream phases continue flat-pooling; markdown exporter groups by release. This gets Hestami-shaped outputs visibly release-ordered end of Phase 2 without touching Phase 3+.
2. **v2 — Phase 3 inheritance + cross-release validation.** Architecture elements inherit; backward-dep check fires before architecture approval.
3. **v3 — Phase 7 plan synthesis + subtree-move gate surface.** Task trees inherit; plan synthesis groups output by release; human override gate lands.

## Open items for a future iteration

- **Release-scoped budget**: distinct `budget_cap` per release (Release 1 might warrant 2× the budget of Release 3). Out of scope for v1 — budget stays per-root.
- **Re-plan workflow**: when the human decides mid-run that the release order was wrong, re-run 1.7 against the already-decomposed tree and walk all nodes updating `release_id` where traces still hold. Needs careful supersession semantics (subtree moves cascade).
- **Cross-run release continuity**: when a brownfield run is continuing a prior run's architecture, the release plan should either be inherited or explicitly re-approved. Not v1.
