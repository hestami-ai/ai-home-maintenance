# Packet Prompt Remediation — Findings and Proposal

Status: report for discussion, not a locked design
Date: 2026-05-20
Source run: ts-17 (Phase 9 log `phase09_9_1__b3049aae-d309-4ad0-95f7-ae8721b3a064.log`, DB `thin-slice-workspace-17/.janumicode/test-harness/1779203577683.db`)

## 1. Why this report exists

ts-17 produced a Phase 9 executor invocation that stalled mid-run with the Ollama-side error `Stream decode error: Ollama stream stalled: no data received for 30s. This may indicate the model is overwhelmed by the request payload.` The agent had spent ~2,000 reasoning tokens looping "Let me check the workspace structure" without ever writing a file. Inspecting the prompt revealed it was ~30 KB of largely irrelevant context for a task whose declared complexity was `"low"`.

Initial review surfaced ten distinct issues spanning prompt-content quality and prompt assembly structure. Deeper investigation revealed those ten were symptoms of three deeper problems, only one of which is project-specific. This document records what was found and proposes a fix path.

## 2. What the Phase 9 prompt actually looks like

The Phase 9 executor receives a prompt assembled from **two stacked sources**:

1. **Packet block** (top, ~30 lines): from `formatPacketAsExecutorContext` in [src/lib/orchestrator/phases/packetSynthesis/packetContextFormatter.ts](../../src/lib/orchestrator/phases/packetSynthesis/packetContextFormatter.ts). Introduced in the b.3+b.4 packet-synthesis push. Designed to be the canonical executor context.
2. **Legacy template block** (below, ~2,500 lines): from [src/lib/orchestrator/executionContextBuilder.ts](../../src/lib/orchestrator/executionContextBuilder.ts), rendered via the `implementation_task_execution.system.md` template. Pre-existing Phase 9 prompt assembly.

For the abuse-notification task in ts-17, the packet block emitted only:

- Component Contract
- Technical Constraints
- Packet Coherence Notes

It omitted: User Stories + ACs, NFRs, Data Models, API Endpoints, Test Cases, Evaluation Criteria, Compliance items. The formatter is gated on "section is empty → don't print," so each missing section reflects an empty array in the packet record itself.

The legacy template then filled in some of these from the artifact path (test cases, eval criteria) — but with different contents than what the packet *should* have produced, and with several known-broken renderings (`Responsibility: undefined`, empty `### Component Model Summary` header, 8 unrelated eval criteria, ~600 lines of inline deep-memory packet, duplicated ADR section).

The executor read **two overlapping, contradictory sources** of upstream context and consumed enough tokens to overflow goose's 30-second Ollama stream-stall window before producing any artifact.

## 3. Why the packet block was empty

[`packetBuilder.ts`](../../src/lib/orchestrator/phases/packetSynthesis/packetBuilder.ts) builds each packet by starting at `findUserStoriesForTask`. If that returns `[]`, the downstream cascade collapses:

```
findUserStoriesForTask returns []
  → usIds = {} and acIds = {}
  → findTestCasesForAcs returns []         (gated on acIds)
  → findEvalsForUserStoriesAndNfrs returns [] (gated on usIds/nfrIds)
  → complianceRefs is empty                (gated on matched US.traces_to)
```

One upstream miss starves the entire packet. The fallback strategies in `findUserStoriesForTask` are:

- **Pass 1**: literal match — `task.traces_to` contains US ids
- **Pass 2**: component-fallback — some US has `traces_to` citing `task.component_id` or one of the component's responsibility ids

Both passes failed for the abuse task — and a closer read shows both passes are **structurally guaranteed to fail for every original Phase 6 task in this project**, and likely for every project on the current prompt stack. See §4.

## 4. The tracing graph audit

Direct DB queries against the ts-17 governed stream:

### What `task.traces_to` contains

Phase 6's `implementation_task_decomposition.system.md` prompt explicitly tells the LLM (line 51): `traces_to` may contain "Responsibility ids, Technical Specification ids, or Component Model item ids this task satisfies." **It does not include US ids in the allowed set.**

What the LLM actually emitted for the abuse task: `["Send email to administrator within 2 min of abuse flag", "SR-009"]` — the responsibility *statement* (prose) plus an SR id. The prose is byte-identical to `comp-abuse-notification-service.responsibilities[0].statement`; the LLM is emitting the human text instead of `res-send-email`. Two non-compliances in one field.

### What `US.traces_to` contains

User stories trace to journey, entity, and workflow ids: `UJ-*`, `ENT-*`, `WF-*`. Distribution across all 17 user stories: 17 UJ refs, 25 ENT refs, 17 WF refs, **2 COMP refs**. So 2 of 17 stories *do* include a component-tier id — proving the data shape supports it — but the Phase 2 prompt doesn't enforce or even mention it.

### What `component_model` contains

`components[*].traces_to` is **undefined** for every component. Phase 4's `component_skeleton/component_decomposition.system.md` output schema declares fields `id, name, domain_id, responsibilities, dependencies` — there is no `traces_to` slot.

### What `SR.source_requirement_ids` contains

System requirements trace to NFRs, not US. SR-009 in ts-17: `source_requirement_ids: ["NFR-019"]`. The chain `task → SR → US` dead-ends one hop in.

### Bloom artifacts

| Artifact | Component linkage? |
|---|---|
| `user_journey_bloom` | **Empty array (0 items)** — separate Phase 1 bug; UJ ids exist as references throughout the run but the bloom itself was never populated |
| `system_workflow_bloom` | 22 workflows, each with `businessDomainId` (e.g. `DOM-ABUSE-PREVENTION`) and `backs_journeys` (UJ ids). **No component id field.** |
| `entities_bloom` | 44 entities, no component refs |

### Domain namespace mismatch

A bridge via domain ids might have rescued some indirect chain. It doesn't: components use `domain-abuse`, workflows use `DOM-ABUSE-PREVENTION`, and the `software_domains` artifact that's supposed to map between them has empty `{}` for every mapping field.

### Conclusion of §4

**There is no path from task → user story through any current tracing edge.** Each gap (Phase 6 prompt restricts `traces_to`; Phase 4 schema has no `traces_to`; Phase 2 inconsistently emits COMP refs; SR doesn't trace US; bloom artifacts don't carry component refs; domain ids don't reconcile) is structural to the prompt set, not specific to TinyURL.

## 5. The cycle controller is already partially compensating

A surprising query result: `implementation_plan` contains 28 tasks, of which **17 are delta tasks named `task-delta-us-001-*` etc.** Their `traces_to` correctly cites US ids. Their `completion_criteria` reference US ACs. These are the output of our deterministic `synthesizeDeltaTasks` from b.4-deltas.

This means: in ts-17, a cycle ran. Phase 9 saw a `packet_synthesis_failure` with US-coverage gaps. The cycle controller routed back to Phase 6 in delta mode. The deterministic synthesizer produced 17 US-traceable delta tasks to fill the gap. **The self-healing loop is working.**

What it does *not* do is repair the original 11 Phase 6 tasks — including the abuse task — which remain in the plan with prose-only `traces_to`. Those produce starved packets, and Phase 9 executes against them anyway.

## 6. A reframing of what the packet block needs to contain

This is the key shift in my analysis.

There are now two task populations in the implementation plan:

| Task population | Source | Trace to US? | Nature of work |
|---|---|---|---|
| Original Phase 6 tasks | LLM in Phase 6 | No (prose + SR ids) | Component infrastructure — *"implement responsibility X of component Y"* |
| Delta tasks | Deterministic synthesizer | Yes (one US per task) | User-facing — *"implement the behavior of US-N"* |

For an **infrastructure task** like the abuse-notification email-send function, the executor doesn't strictly need a user story to do its work. The completion criteria are well-formed (`"An abuse flag triggers an email sent to the configured administrator address"`, verification `test_execution`, artifact ref pointing at a specific test file). What it *does* need:

- Component contract ✓ (already works)
- Data model for the abuse-notification entity
- API endpoints (if any) on this component
- Test cases for this component
- Evaluation criteria for this component
- Technical constraints scoped to what this task implements
- Completion criteria (already in the legacy template, not in the packet block)

For a **delta task** like `task-delta-us-001-create-a-short-url`, the user story IS the work definition. Its packet already gets US/ACs correctly because the synthesizer emits a clean `traces_to: [US-001]`.

The packet design assumed every task needed US tracing. Empirically, only the user-facing tasks do, and those already get it for free.

## 7. Bugs discovered while auditing

Two artifact shape mismatches that silently drop content from packets:

**Data models.** The `data_models` artifact emits:
```json
{ "kind": "data_models", "models": [{ "component_id": "comp-X", "entities": [{ "name", "fields": [...] }] }] }
```
`packetBuilder.findDataModelsForComponent` reads `models[]` expecting `{ id, name, component_id, fields }` flat at the top level. It walks one level too shallow and emits nothing.

**API definitions.** The `api_definitions` artifact emits:
```json
{ "kind": "api_definitions", "definitions": [{ "component_id": "comp-X", "endpoints": [{ "path", "method", ... }] }] }
```
`packetBuilder.findApisForComponent` reads `definitions[]` expecting `{ id, method, path, request_shape, response_shape, error_codes, component_id }`. Same depth error.

Both are pure code bugs — deterministic to fix. Both apply to every project, not just ts-17. Neither has anything to do with the tracing-graph debate.

Two additional renderer bugs in the legacy template, already documented in the initial issue list (`Responsibility: undefined` reading `component.responsibility` (singular) when the shape is `responsibilities[]`; empty `### Component Model Summary` header).

## 8. Solution space — determinism × generalization × workload

After elimination:

| Path | Determinism | LLM workload added | Generalizes? | Closes loop for original tasks? |
|---|---|---|---|---|
| A. Phase 6 emits `task.traces_to: [US-…]` | LLM | per-task (~30/project); also needs US plumbed into P6 input; widens `traces_to` semantic | Yes | Yes |
| B. Phase 4 emits `component.traces_to: [US-…]` | LLM | per-component (~9/project); also needs US plumbed into P4 input; new schema field | Yes | Yes (via packetBuilder Pass 2) |
| C. PacketBuilder keyword/release heuristic | Deterministic | None | Partial (fragile across domains) | Often, but unreliably |
| D. Bridge through SR | Half-and-half | Depends on P3 prompt | Yes if P3 fixed | Only if SR→US edge added |
| E. Bridge through blooms | Would-be deterministic, but **data not present** | None | N/A | No |
| **N. Deterministic packet repair** (see §9) | Deterministic | None | Yes | Yes, by reframing what "closure" means |

Paths A and B both turn out to require nearly identical plumbing once you account for needing FRs/US in a phase that currently doesn't see them, plus a schema extension. The "+1 prompt instruction" framing of my initial scope was wrong.

Path C is universally a bandaid.

Path D dead-ends at SR's existing trace shape unless we also fix Phase 3.

Path E was the cheapest fix if it had worked. It doesn't — the bloom artifacts don't carry the edges, the domain bridge is broken, and `user_journey_bloom` is empty in this run anyway.

## 9. Path N — fully deterministic, accept the task-population split

The proposed direction: stop trying to add a tracing edge that the prompt stack doesn't naturally produce. Instead, embrace the fact that the cycle controller + delta synthesizer already cover user-facing work, and make the packet builder competent at infrastructure-task content.

Six concrete changes, all in `src/lib/orchestrator/`:

1. **Fix data_models shape mismatch.** In `upstreamIndex.ts` and/or `packetBuilder.findDataModelsForComponent`: walk `models[].entities[]`, flatten to one `PacketDataModel` per (component, entity).

2. **Fix api_definitions shape mismatch.** Walk `definitions[].endpoints[]`, flatten to one `PacketApiDefinition` per (component, endpoint).

3. **Broaden `findTestCasesForAcs`.** When AC-based matching returns zero, fall back to matching by `suite.component_id === task.component_id`. Test suites are already component-keyed in `test_plan`; this edge has always been there.

4. **Broaden `findEvalsForUserStoriesAndNfrs`.** When US/NFR matching returns zero, fall back to eval criteria whose `target_id` matches the component id or one of its responsibility ids. Same idea: the linkage exists in the eval criterion's `target_id`, the packetBuilder just doesn't look there.

5. **`packetContextFormatter`: emit user_stories explicitly when empty.** Replace silent omission with `_(this is an infrastructure task — no user stories trace to it; completion criteria are authoritative)_`. The executor reads explicit absence as information; today it reads silent absence as "this section doesn't exist."

6. **Wave 1 dedup — packet block becomes the sole upstream-context source.** Strip the legacy template's Component Context / Component Model Summary / Test Cases / Evaluation Criteria blocks when a packet is present. Legacy template retains only: governing constraints, ADRs, write-scope, completion criteria, refactoring constraints, detail file reference. This removes the duplication and the broken `Responsibility: undefined` / empty-header / 8-unrelated-eval-criteria renderings in one step (those bugs all live in the dropped blocks).

Plus the small legacy-template fixes that are still relevant outside the dropped blocks (issues #11, #12 from the initial list): make deep-memory inline opt-in, deduplicate the ADR section.

### What Path N achieves
- The abuse task's packet would render: component contract + data models (AbuseNotification entity) + APIs (whatever endpoints exist) + tech constraints + test cases (TS-ABUSE-01 via component fallback) + eval criteria (whatever evals target this component) + coherence notes. Plus an explicit "infrastructure task — no US trace" note.
- Prompt size collapses from ~30 KB to an estimated ~5 KB. The goose stream-stall window stops being load-bearing.
- Every fix generalizes to every project.

### What Path N does NOT solve
- **The Phase 1 `user_journey_bloom` empty-array bug.** Separate issue, surfaces elsewhere in the workflow.
- **The Phase 6 prompt non-compliance** (LLM emits responsibility *statements* instead of *ids*; LLM emits SR ids though the spec is ambiguous about whether that's intended). Worth a small prompt clarification eventually, but not blocking.
- **The structural absence of US ↔ component tracing.** Path N sidesteps it by leaning on the cycle/delta mechanism that already exists. If a future evidence pattern shows that infrastructure tasks routinely need US narrative context to execute well, Path A or B can be added later. We'd have evidence from ts-18+ to decide.
- **The Phase 2 inconsistency** (2/17 US trace to COMP, rest don't). Same disposition — not blocking, fixable later.
- **The technical-constraint scoping** (issue #5 from the original list): TECH-AES-256-ENCRYPTION attaches to a task that doesn't store URLs. Solving this means filtering `task.active_constraints` more strictly. Probably belongs in Path N as a 7th item; flagging here for completeness.

## 10. What I'm uncertain about and want input on

1. **Is the "task-population split" framing acceptable?** Specifically: is it correct to say infrastructure tasks (Phase 6 originals) don't need US tracing as long as user-facing tasks (delta synthesizer outputs) do? This affects whether Path N is sufficient or merely a holding action.

2. **Are the structural prompt gaps (no US ↔ component edge) worth fixing in their own right** even if Path N closes the immediate symptom? They reflect a missing concept in the workflow — the "what users need" tier and the "what we build" tier never explicitly meet — which may matter for downstream phases I haven't traced.

3. **Should the `user_journey_bloom` empty-array finding be promoted to a higher-priority investigation** ahead of any of this? An empty journey bloom undercuts Phase 2 (US trace to UJ ids that don't resolve), Phase 4 (no journey context informs component decomposition), and the cycle controller's coverage signals.

4. **For Path N item 6 (dedup):** is "drop the legacy template's overlapping sections" the right call, or should we keep both for a transition window and just fix the bugs in the legacy renderings? The dual-source assembly was introduced recently (b.3); dropping it now is the cleanest version of "single source of truth," but it loses any safety net if the packet block ever fails to populate.

These four feel like they could each redirect the implementation path materially. The technical changes in §9 are easy to write; the harder question is whether they're the right changes to write.
