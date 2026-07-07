# Conversational Layer Redesign — Design Review & Proposal

**Status:** Proposal for review — recommended architecture, not yet implemented
**Date:** 2026-07-07
**Author:** Synthesis of a 4-proposal / 3-judge-panel design review (15-agent workflow), curated + anchor-verified
**Scope:** `JanumiCode/janumicode_v2/src/lib/` (agent) and `src/webview/` (UI)
**Decision:** Adopt a **Governed ReAct Loop over a Capability Broker** — the minimal-agent-loop delivery vehicle (P1) built on object-capability tier-scoped context objects (P4), with structural card-mode selection and the scope-gatekeeper guard (P2), the delta-only gate re-certification spec and streaming-first sequencing (P3).

> **Verification note.** The load-bearing file:line anchors below were independently spot-checked against the live tree on 2026-07-07, including the surprising/actionable ones: the single-pass synthesizer (`synthesizer.ts:120-225`), the classifier gate (`classifier.ts:40`), the client-side slash switch (`IntentComposer.svelte:142-189`), cards having no sub-chat (`Card.svelte`), the **dormant feedback loop** (`runBloomRoundWithFeedbackLoop` reads `free_text_feedback` at `phase1.ts:2146` but `allow_free_text:false` at `:2091` and nothing writes it; `MAX_FEEDBACK_ITERATIONS=3` at `:2228`), the **reverse authority-laundering** default (`resolveAuthorityLevel`, `governedStreamWriter.ts:601/638`), and the **`memory_edge` column bug** (`db.ts:248,285` query `source_id`/`target_id` but the columns are `source_record_id`/`target_record_id`, `schema.ts:190`). All confirmed accurate.

---

## 1. Problem statement

Today's conversational layer is not brittle because it "parses commands badly." It parses commands fine — `/status` reaches `forceCapability:'getStatus'`, `@bundle:` tokens resolve, `submitIntent` routes cleanly. **The framing "we need better command parsing" is wrong and will waste the redesign.** The real defect is architectural: the layer is a *single-pass dispatcher hard-gated by one JSON classification, with no thread structure, no item-scoped write primitive, and no way to observe what a tool did.* Command parsing is a symptom surface, not the disease.

The six real gaps, each with evidence:

**Gap 1 — The synthesizer is a one-shot dispatcher that cannot observe, chain, or recover.** `synthesizer.ts:120-225` `handleToolCalls` emits tool calls once, executes them deterministically, and ends with a terminal `return` at `:120`. Outputs are `formatResponse()`-string-concatenated (`:209`, `:219-224`) and **never re-fed to the model**. There is no A→observe→B, no error-aware retry, no narration. When a capability errors — hallucinated tool name (`:154-158`), precondition fail (`:162-169`), execute throw (`:199-205`) — the raw error string lands verbatim in the user-facing answer. When the model emits neither text nor a tool call, the turn dead-ends on a canned "try rephrasing" message (`:133-141`). This is the single highest-leverage seam in the codebase.

**Gap 2 — The classifier is an unrecoverable gate that silently misroutes.** `classifier.ts:40` makes one JSON call (`:60`, `responseFormat:'json'`, temp 0.2) that selects *both* the retrieval strategy *and* the tool set. There is no re-classification. On any failure it collapses to `ambient_clarification` / `confidence 0.3` (`:73-75`, `:94-100`) — wrong retrieval, wrong tools, **no user signal**. On a weak local model this is a silent, per-turn correctness lottery with zero mitigation. It is consumed as a hard gate at `clientLiaisonAgent.ts:211`.

**Gap 3 — There is no item-scoped feedback primitive and no scoped re-run routing.** Every write path is coarse and run-level with no `derived_from` link to a targeted `US-*`/`AC-*`/component (`contextManagement/index.ts:25,57`). There is no `submitItemFeedback`/`annotateArtifact`/`authorItem`. The engine's targeted re-entry `advanceToNextPhase(runId, reviseTo)` (`orchestratorEngine.ts:823-828`) is unexposed; `resumeWorkflow` re-runs only the *current* phase; `escalateInconsistency` needs ≥2 conflicting ids and hard-routes to bloom-and-prune. Worse, the one existing feedback loop is dormant on the real path: `runBloomRoundWithFeedbackLoop` (`phase1.ts:2177`, `MAX_FEEDBACK_ITERATIONS=3`) *reads* `resolution.payload.free_text_feedback` (`:2146`) but **nothing ever writes it** — `DecisionRouter.routeBundle` doesn't populate it and product-bloom bundles set `menu.allow_free_text:false` (`:2091`).

**Gap 4 — Slash commands are a client-side 5-command hardcode with unknown→no-op.** `IntentComposer.svelte:142-189 handleSlash()` is a literal switch; unknown slashes render a synthetic local `system_info` card (`:173-188`) that **never reaches the host**. There is no server-side slash registry — `forceCapability` is the only slash→capability bridge. New capabilities get no slash without editing client code.

**Gap 5 — There is exactly one free-text surface, and no sub-chats.** The global bottom-anchored `IntentComposer` is the only sending textarea (`:336-346`); its mode is a global singleton derived from `composerStore.currentPhase` (`composer.svelte.ts:59-61`, `:138`). Card textareas are edit buffers staging a decision action, not chats (`DecisionBundleCard.svelte:210-215`, `MirrorCard.svelte:219-228`). "Ask more" prefixes a `@bundle:<recordId>:<section>:<itemId>` token into the one shared composer (`DecisionBundleCard.svelte:86-94`) — scoping is a text prefix, not structure. There is no Thread abstraction; a "turn" is three append-only records chained only by `derived_from[0]` (`clientLiaisonAgent.ts:153,200,280`).

**Gap 6 — No content streaming.** The synthesizer awaits the full `LLMCallResult` with no token callback; the response is persisted once and returned whole. The only live signal is queue telemetry (`priorityLLMCaller.ts:95,122,152`). On local models a turn is invisible until the entire 2-round-trip resolves, and there is no in-flight preemption (`priorityLLMCaller.ts:116`, `maxParallel:1`), so a user turn can stall behind one phase inference.

**The through-line:** the layer lacks (a) an agent loop, (b) a recoverable router, (c) a governed item-scoped write path, (d) a thread/surface model, and (e) live output. Fixing slash parsing touches none of these.

---

## 2. Design principles

### Non-negotiable invariants (the fundamental workflow)

These are hard constraints. The redesign preserves every one; where a proposal's convenience conflicts with an invariant, the invariant wins.

1. **The governed stream is the single source of truth, append-only.** Every meaningful turn and response is a record with `derived_from_record_ids`, `janumicode_version_sha`, `workflow_run_id`, `phase_id`, `authority_level`, `produced_by_agent_role`. **Never UPDATE/DELETE an artifact in place.** Supersession = new records + `supersedes`/`supersedByRollback` edges.
2. **Authority elevation is gate-exclusive.** Authority 6 is produced **only** by `certifyPhaseGate`→ingest→`validates` edges (`effectiveAuthority.ts`). Chat may mint at most `HumanEdited`; nothing chat-side may fabricate certified authority.
3. **Gate + `phase_gates` integrity.** `phase_gate_approved` must carry `approved_artifact_ids` and be ingested before `advanceToNextPhase`. `certifyPhaseGate` (`orchestratorEngine.ts:1008`) stays the sole certifier. No side-channel phase advance.
4. **Escalation, not unilateral rollback.** "This is wrong" degrades to `escalateInconsistency`→`consistency_challenge_escalation`→Orchestrator bloom-and-prune (`decisionHistory:156`, ≥2 conflicting ids). Chat cannot roll back.
5. **DMR grounding + record-id citation.** Responses cite `[ref:<id>]`; the `escalatedToOrchestrator` flag must correspond to a real `escalateInconsistency` call — a bare synthesis flag is dead code and must not be reintroduced.
6. **Blocking `pauseForDecision` + idempotent re-entry.** Resolution arrives by the *exact* presented surface record id via `resolveDecision` (`orchestratorEngine.ts:1634`); `recreatePendingFromRecord` on reload; handlers idempotent on re-entry (`:1667`). Never spawn a competing surface for the same decision.
7. **Serial-pipeline halt semantics.** `executeCurrentPhase` converts any handler throw to `success:false` and halts. Feedback is a **bounded** re-run loop (`MAX_FEEDBACK_ITERATIONS=3`), fail-loud — not an open mutation surface.

### North star

**Goose/OpenCode robustness *within* the governed workflow.** We want the streaming, tool-observing, self-repairing feel of a modern coding agent — but every mutation is a governed record and every gate stays a gate. Two derived principles make this tractable:

- **Safety is decoupled from model quality.** A hallucinating small model's blast radius must equal the *reachable tool set*, not its reasoning. We enforce containment by object references (tier-scoped context objects), not by prompt discipline or correct tool-menu configuration.
- **Reuse the substrate; build no new memory.** The governed stream **is** the session log; the DMR `ContextPacket` (`deepMemoryResearch.ts:141-178`) **is** compaction. We add a loop and a tier contract, not a runtime substrate. No DDL migration (`content` is untyped `Record<string,unknown>`, `records.ts:54`; `json_extract` already used at `governedStreamWriter.ts:373`).

---

## 3. Recommended architecture

The recommended architecture is a **bounded, streaming ReAct loop** whose every tool invocation passes through a single **CapabilityBroker** chokepoint that hands each capability a **tier-scoped context object** it cannot exceed. This is P1's minimal-refactor loop (cheapest, most incremental, guaranteed-answer) fused with P4's object-capability spine (structural safety), sequenced streaming-first per P3.

### (a) The agent loop that replaces single-pass synthesis

Rewrite the dispatch region `synthesizer.ts:120-225` into a bounded observe-and-retry loop. Remove the terminal `return` at `:120`; tool results become **observations fed back into the message array**, not `formatResponse()` string concatenation.

```
messages = [ system(toolMenu, packet vars :79-83, classifier HINT), history, user ]
provenance = ∅
for i in 0..MAX_LOOP_ITERATIONS (=4):
    result = broker.call(messages, tier-filtered tools, priority:'user_query',
                         stream = (this is the answer turn))
    if result.tool_calls:
        for call in result.tool_calls:
            obs = broker.dispatch(call)          # tier-scoped ctx; see (c)
            messages.append({role:'tool', content: obs})   # <-- fed back, no return
            provenance.add(obs.citedRecordIds)
        if no_progress_or_duplicate(call): nudge("already ran; synthesize now")
        continue
    else:
        return finalize(result.text, provenance)   # model produced final text
# budget/iteration exhausted -> FORCED FINAL TURN, never a dead-end:
result = broker.call(messages, toolChoice:'none', stream:true)
return finalize(result.text, provenance)
```

Load-bearing properties (grafted from P1, endorsed by all three judges):

- **Forced-final-turn** (`toolChoice:'none'`) on budget/iteration exhaustion **structurally eliminates** the raw-error and empty-turn dead-ends (`synthesizer.ts:133-141`, `:154-158`, `:162-169`, `:199-205`). Every turn yields a coherent NL answer.
- **Errors are observations, not user strings.** A hallucinated tool name feeds back `{error:"unknown tool X", availableTools:[…]}`; the model self-repairs within budget. The error only reaches the user if the loop exhausts.
- **No-progress / duplicate-call guard** (structural id-match, not regex, per `feedback_no_regex_id_resolution`): identical tool+params twice → short-circuit with a cached result and a nudge. Stops weak-model thrash.
- **Cost budget preserved.** The common case (status report, single ASK) resolves in one iteration = today's 2 round-trips. Extra round-trips occur only when the model genuinely needs to chain — exactly the cases that previously produced nothing. The `runForcedCapability` fast path (`clientLiaisonAgent.ts:226-236`) is **kept** for pure-deterministic slashes so `/getStatus`/`/help` stay at cost ≈ today.
- **Intermediate observations stay in-memory** (message array); only the ordered loop trace is persisted into `client_liaison_response.capability_calls` (`:269`). This keeps the append-only 3-record turn shape and needs no DDL. *(Auditability tradeoff noted in §9; optional `liaison_reasoning_step` records are a future toggle.)*

### (b) The fate of the classifier

**Demoted from gate to advisory hint, allowed to be wrong.** `classifier.ts:40` still runs as LLM #1 (cheap, temp 0.2), but its `queryType` only (i) sets retriever priority and (ii) seeds a *suggested* opening tool subset in the loop system prompt. The tool-selection-as-gate role is **deleted**: the loop always sees the full READ tier + scope-relevant PROPOSE/GOVERN. On the existing failure collapse (`:73-75`, `:94-100`) we **skip the hint** and default retrieval to DMR (`retriever.ts:90 DMR_DELEGATED`, the safe superset). A misclassification now degrades *quality*, not *correctness* — the loop re-retrieves via the READ tools it already holds. This closes Gap 2's zero-mitigation.

### (c) The READ / PROPOSE / GOVERN tiered tool contract

This is the structural safety spine (P4), grafted onto the loop by unanimous judge mandate. Today every capability's `execute(params, ctx)` receives one `ctx` carrying `writer`, `engine`, `db` — so a READ capability *could* mutate if the model called it wrongly (P1/P2/P3 all left this selection-based; the integrity judge docked them for it). We physically partition `ctx`:

| Tier | Context object handed to `execute()` | Reachable effects | Members |
|---|---|---|---|
| **READ** | `ReadCtx` — read views over `db` + DMR. **No `writer`, no `engine` mutators.** | Nothing. A wrongly-called READ cap changes nothing. | the 15 read caps: `getStatus, getPhaseHistory, searchRecords, getRecentActivity, dryRunResearch, showArtifact, explainArtifact, listArtifacts, listConstraints, explainDecision, listDecisions, getAlternatives, getVersion, getSettings, help` |
| **PROPOSE** | `ProposeCtx` = `ReadCtx` + a `writer` allow-listed to *inert* record types, authority capped at `HumanEdited`. **No `certifyPhaseGate`, no `advanceToNextPhase`, no elevation.** | Mints inert governed records only. | `addConstraint` (`contextManagement:57`), `attachFile` (`:25`), `pauseWorkflow` (advisory), **new** `submitItemFeedback`, **new** `authorItem` |
| **GOVERN** | `GovernCtx` = `ProposeCtx` + `DecisionRouter` handle + orchestrator targeted re-entry. **Only reachable after a confirmation turn.** | Routes through the existing gate/orchestrator lane; never an in-place artifact write. | `startWorkflow, resumeWorkflow, cancelWorkflow, escalateInconsistency`, **new** `requestScopedRerun`/`regenerateCollection` |

Enforcement:

- **CapabilityBroker** is the *only* object that may call a capability's `execute()`. It validates args against the cap's JSON schema, looks up the declared `tier`, hands the correct tier-scoped ctx, enforces the confirmation ritual for GOVERN, and converts schema/precondition/throw failures into structured observations for the loop.
- **A registration-time `tier` field** on the cap registration type (`capabilities/index.ts:68-71`, `system/index.ts:41`) plus a **CI lint** that asserts each cap's tier matches the ctx it destructures — *a READ cap that references `writer`/`engine` fails the build.* This makes the partition a build-time invariant, not a runtime hope. It is now safety-critical infrastructure (§9).
- **The loop runtime holds no reference to `certifyPhaseGate`/`resolveDecision`/`DecisionRouter`** (P3's insight). Authority 6 stays producible only through the gate path (invariant 2), enforced structurally, not by prompt.
- **The confirmation ritual generalizes from `cancelWorkflow`-only to ALL GOVERN caps** (`synthesizer.ts:176-189` preserved verbatim; a GOVERN cap becomes a terminal loop state: emit the confirmation prompt as the final answer, end the turn, await user, re-enter next turn).

### (d) Streaming

The webview plumbing already exists (`llm:stream_chunk → streamChunk → streamingStore.append`, consumed `App.svelte`); nothing feeds it today. Add an `onToken` callback to the `LLMCall` (`synthesizer.ts:99`, `priorityLLMCaller.ts:95,122,152`) and drop the full-result await. Tokens stream **only on the answer turn**; intermediate tool-call turns run non-streamed and emit a compact `llmStatus` line per iteration ("running getStatus…") so chains aren't silent. This ships **first**, standalone (P3 graft), to de-risk the Goose feel early.

### (e) Robustness tactics for weak local models

- **Structural mode selection on the mutating path** (P2 graft, all three judges): card feedback mode is chosen by the UI affordance → `forceCapability`, which *skips the classifier entirely* and *bypasses free-form tool selection*. The free-form loop is reserved for ASK/READ. This directly neutralizes the loop's own honest risk that a weak model burns its budget on malformed tool JSON when mutating.
- **AUTHOR emits zero tool JSON** — a structured in-card form posts `{kind, fields}` to a deterministic capability (P2 graft).
- **Shrunken card tool menus** — a card sub-chat exposes 3–5 anchor-relevant tools, not 22 (P3 graft). Smaller decision space is the single biggest weak-model lever.
- **Object-capability containment** means a wrong call's blast radius is the reachable ctx, independent of reasoning quality.
- **Forced-final-turn + dedup guard + error-as-observation self-repair** (P1) keep the loop from spinning or dead-ending.
- **Deterministic scaffolding does the load-bearing work**: DMR `basePacket` (`deepMemoryResearch.ts:984`) builds structural signals with no LLM; preconditions, confirmation, and dedup are deterministic; the model only narrates/selects.

---

## 4. Main chat redesign

The global `IntentComposer` submits to the loop with a `thread_id` and no anchor — the **root thread**, full 22-cap tiered menu.

**"Give me a status report of the decomposition," end-to-end:**

1. `handleUserInput` (`clientLiaisonAgent.ts:134`) writes the `open_query_received` record with `content.thread_id` (`:148`).
2. Classifier hints `status_check` → retriever pulls `getRecentRecords` (`retriever.ts`). Hint is advisory.
3. Loop iteration 1: model calls `getStatus` (READ, `ReadCtx`) → observes counts → chains `getPhaseHistory`/`listArtifacts`/`explainDecision` for coverage rollup (impossible today — Gap 1) → observations fed back.
4. Loop iteration 2: model synthesizes the report from the fed-back results, **streaming** the final answer with `[ref:<id>]` citations.
5. One `client_liaison_response` persisted (`:269`) with the ordered loop trace in `capability_calls` and accumulated `provenance_record_ids`. Zero mutation reachable — the loop held `ReadCtx`.

**Arbitrary scoped NL requests** work by the same loop: the model reads what it needs and answers, grounded, bounded, guaranteed to terminate in an answer.

**Slash commands become thin sugar** (Gap 4 fix). Delete the hardcoded switch (`IntentComposer.svelte:142-189`). Introduce a **server-side slash registry** with the convention **slash name = capability name**:
- Known slash → `submitOpenQuery` with `forceCapability` pre-bound; deterministic caps take the `runForcedCapability` fast path (`:226-236`). New caps auto-get a slash with zero client changes.
- Unknown slash → send the whole text as a natural-language open query into the loop (removes the `:173-188` synthetic-local-card no-op).

---

## 5. Sub-chat / card model

This is a priority for the operator and ports a proven v1 pattern. The abstraction is a **Thread as a projection over the existing append-only stream** (P2's cleanest framing) — never a new table. The main chat is the root thread; every card spawns an **item-anchored sub-thread**; both are the *same* liaison, the *same* `CapabilityRegistry`, the *same* stream and loop. A sub-thread differs only in that its context is anchored to an item id, which deterministically pre-seeds retrieval and (for feedback) pre-selects the tier — killing the classifier's role exactly where weak models hurt most.

### The Thread abstraction and anchored retrieval

A card sub-chat is the same loop, constructed with an anchor-scoped `RetrievalBrief` — **no new retrieval engine** (brief §E):

- A `focusResolver` seeds the anchor id set into `RetrievalBrief.knownRelevantRecordIds` @ materiality 1.0 (`retriever.ts:91,119-124`; `deepMemoryResearch.ts:558-575`, preserved by `scoreCandidates:597`).
- When the anchor is a component, set `brief.focusComponentId` (`deepMemoryResearch.ts:131-139`).
- Findings on the item join `knownRelevantRecordIds` (findingSurfacing/findingsLoader binds by cited ids).
- Neighborhood expansion routes through **DMR Stage-4 `expandRelationships`** (`deepMemoryResearch.ts:748`, depth-1 outbound `memory_edge` @0.7×) plus Stage-5 supersession/contradiction touching the anchor. **Never** `db.getDownstreamDependencies`/`traverseEdges` — those query `source_id`/`target_id` against real schema columns `source_record_id`/`target_record_id` (`db.ts:248,285` vs `schema.ts:190-191`) and throw. We also **fix that one-line column bug as explicit cleanup** (cost-risk graft) to remove the latent footgun, but the design does not depend on it.

### One stream, two views

Storage stays one append-only stream. Rendering splits by reusing the *existing* projection mechanism: records with `content.anchor_item_id===X` are suppressed from the main stream (add `!record.content.anchor_item_id` to the top-level filter — a mirror of the existing `isChildOfInvocation`/`isReferencedByDmrPipeline` suppression, `records.svelte.ts:341,379`) and rendered inside card X via `childrenByParent`/`getChildren` (`:107,221,324`) when scoped turns stamp `derived_from=[surfaceRecordId]`. `Card.svelte` gains an optional per-card composer + nested thread view; `composerStore` is de-singletonized (`composer.svelte.ts:138`) so each card owns its `text`/`mode`/`isSubmitting`, and the response-unlock lifecycle (`App.svelte:57-59`) keys on `thread_id`.

### The three card-feedback modes as first-class flows

Mode is chosen by the card affordance → `forceCapability`, not inferred (P2 graft). Each maps explicitly to a tier.

#### (a) ASK — scoped Q&A (READ tier)

*"Why is this journey admin-only?"* on a user-journey card. `submitOpenQuery{focus, forceCapability?}` runs the loop with an anchor-scoped brief and a shrunken READ menu (`explainArtifact, showArtifact, explainDecision, getAlternatives, searchRecords, dryRunResearch`). The loop retrieves the anchor's lineage + related records + findings via DMR, answers citing ids, and is handed `ReadCtx` — **provably cannot mutate**. Zero governance impact.

*New capabilities needed:* none — the existing 15 read caps, grounded on the anchor.

#### (b) REFINE / REGENERATE (PROPOSE → GOVERN tier)

Covers per-item corrections/nuance **and** collection-level "generate more user journeys" as a scoped re-bloom that preserves accepted items. **Never a direct artifact edit** (invariant 1). Two capabilities:

- `submitItemFeedback({targetRecordId, anchorItemId, feedbackText, requestRerun?, scope})` — baseline (PROPOSE) mints an inert `human_item_feedback` record (`HumanEdited`, `derived_from=[targetRecordId]`, `content.anchor_item_id`) — the card-scoped provenance link missing today (Gap 3). The target artifact is untouched.
- `requestScopedRerun`/`regenerateCollection({collectionKind, phaseId, expand:true, preserve_accepted_ids, guidance})` — GOVERN, confirmation-gated.

**Routing distinction (P2 graft, all three judges), by gate state:**

- **Case A — gate still pending** (phase handler blocked at `presentProductBloomGate`, `phase1.ts:2289`). Route through `DecisionRouter.routeBundle` (`decisionRouter.ts:280`) resolving the **exact pending id** (invariant 6), hoisting `free_text_feedback` into the `decision_bundle_resolution` payload — the field `phase1.ts:2146` already *reads* but nothing writes (Gap 3) — and flipping `menu.allow_free_text:true` on the feedback path (`phase1.ts:2091`). This wakes the dormant `runBloomRoundWithFeedbackLoop` (`phase1.ts:2177`, `MAX_FEEDBACK_ITERATIONS=3`), which re-runs the proposer with accumulated feedback and re-presents. **No new re-entry machinery needed** — this is the lower-risk path and the natural home for "generate more" *during* a gate.

- **Case B — collection already certified (Authority 6).** Route through the existing targeted re-entry `advanceToNextPhase(runId, reviseTo)` (`orchestratorEngine.ts:823-828`, first exposed here), carrying `preserve_accepted_ids`. **Scope Case B to un-consumed collections only** (P2 graft): if a downstream phase already consumed the collection (e.g. Phase 2 bloomed FRs off the journeys), **degrade to `escalateInconsistency` / the existing Cross-Run Impact machinery** (`project_phase05_cross_run_impact`) — do not reinvent reconciliation in chat.

**Preserving accepted items = do not supersede.** Because the stream is append-only, "preserve" means the re-bloom receives the accepted set as **frozen context** ("here are N accepted journeys; generate ADDITIONAL ones; do not restate these"); net-new journeys are appended as new records; accepted journeys are not re-emitted. A **deterministic, non-regex post-filter dedups** new outputs against accepted ids (structural, per `feedback_no_regex_id_resolution`).

**When a re-bloom forces gate re-certification (delta-only, P3+P1 spec):**

- Already-certified items are passed as `preserve_accepted_ids` and re-emitted unchanged; they keep Authority 6, their `phase_gates` row, and their `validates` edges. **The accepted core is never re-gated.**
- The delta (new/changed items) enters at Authority 2, pending. The runtime emits a `gate_recertification_required` signal and pauses **only the new/changed items** at a scoped decision bundle (`pauseForDecision(...,'decision_bundle')`). The new gate record **supersedes** the prior `phase_gates` row; its `approved_artifact_ids = old_set ∪ newly_accepted` — extending, never de-certifying legitimately-approved items.
- **A REFINE that genuinely *changes* a previously-certified item forces a `supersedes` edge and a gate revisit of that item** (P1 graft, invariant 4) — never silent retention of a stale certification.
- The whole cycle is the bounded `MAX_FEEDBACK_ITERATIONS=3` loop, fail-loud (invariant 7). `certifyPhaseGate` stays sole certifier; no side-channel advance (invariant 3).

*New capabilities needed:* `submitItemFeedback`, `regenerateCollection`; the `free_text_feedback` write into `routeBundle`; the `allow_free_text` flip; exposure of `advanceToNextPhase(reviseTo)` behind a GOVERN cap; the `gate_recertification_required` signal.

#### (c) AUTHOR — manually input a new item (PROPOSE tier)

The operator hand-writes a new journey/AC/component. `authorItem({anchorKind, kind, fields, collectionId})` mints a proper `artifact_produced` record — correct `record_type`/`kind`, `produced_by_agent_role` = a human-authoring role, `derived_from` linking the authoring turn + collection context. This **generalizes `addConstraint`** (`contextManagement:57`, today the only place the liaison mints an Authority-elevated artifact) from constraints to arbitrary item kinds. It enters the governed stream exactly like a generated item and is ingested by the next bloom round and the phase gate; it reaches Authority 6 only through the gate (invariant 2).

Three integrity requirements (P2/P3 grafts — the sharpest hidden bugs in the set):

1. **`authorItem` MUST pass `authority_level: HumanEdited` explicitly.** `resolveAuthorityLevel` (`governedStreamWriter.ts:601,645`) gives *any* `artifact_produced` in a bloom sub-phase Authority 1 Exploratory by default — without the explicit override a hand-written journey silently lands at Authority 1 and looks agent-generated (reverse authority-laundering). Mirror the `addConstraint` override at `contextManagement/index.ts:62`; add `content.provenance:'human_authored'`, `content.authored_by:'user'`.
2. **A real `produced_by_agent_role` value must exist in the `AgentRole` union** (`records.ts:78`) or authority resolution mis-defaults to 2 (`governedStreamWriter.ts:601`). Add a human-authoring role explicitly (P3 graft).
3. **`runScopeGatekeeperForBloom` (`phase1.ts:2265`) MUST exclude `provenance==='human_authored'` (authority ≥ 4) items from its prune set.** Otherwise a hand-written journey is silently pruned by the next bloom's gatekeeper. This is the sharpest gate-integrity risk of AUTHOR mode and needs a dedicated replay assertion.

**AUTHOR emits zero tool JSON** — a structured in-card form posts `{kind, fields}` to the deterministic `authorItem` cap. No tool-selection ambiguity for weak models.

*New capabilities needed:* `authorItem`; the explicit-authority override; the AgentRole value; the gatekeeper exclusion.

---

## 6. Data-model deltas

**No DDL migration** — `content` is untyped `Record<string,unknown>` (`records.ts:54`); `json_extract` already used (`governedStreamWriter.ts:373`). Everything is additive on `content` or reuses existing fields.

| Delta | Where | Notes |
|---|---|---|
| `content.thread_id` (UUID) on the 3 turn records | `clientLiaisonAgent.ts:148,195,269` | First user turn mints; classification + response copy. `getRecentConversationTurns` (`db.ts:214`) switches its pairing predicate to `content.thread_id=X`. `derived_from[0]` stays the intra-turn link. |
| `content.anchor_item_id` + `content.anchor_kind` | same 3 records | `anchor_kind ∈ {user_journey, requirement_node, acceptance_criterion, component, data_model, task, …}` — semantic ids collide across namespaces, so the discriminator is required. |
| Anchor into `derived_from_record_ids` **only when a real UUID** | response record `:280` | Frees provenance + `getChildren` indexing under the card. Semantic ids (`COMP-001`, `US-003`) are **not** UUIDs (`records.ts:411-422`) — they live only in `content.anchor_item_id`. |
| `client_liaison_response.capability_calls` extended | `:269` | Holds the ordered loop trace (tool → result summary) for auditability without new records. |
| New record types: `human_item_feedback`, `collection_regeneration_requested`; human-authored reuse `artifact_produced` | union `records.ts:235` | Add explicit authority handling in `resolveAuthorityLevel` (`governedStreamWriter.ts:601`; `:628` already special-cases `raw_intent_received→5`): `human_item_feedback→HumanEdited`; human-authored `artifact_produced→HumanEdited`. **Never Authority 6.** |
| New `tier` field on cap registration | `capabilities/index.ts:68-71`, `system/index.ts:41` | `'read'|'propose'|'govern'`; CI-lint-enforced against ctx destructure. |
| Webview: `threadKey:{recordId,itemId,anchorKind}` on `submitOpenQuery` | `governedStreamViewProvider.ts:474`; threaded through `makeUserInput` `clientLiaisonAgent.ts:472-496` + `UserInput`/`OpenQuery` types | First-class scope field, replacing `@bundle:` text-prefix scoping. |

**No-migration path is achievable and is the recommended path.** Promote any `content.*` field to a real indexed column *only if* SQL-indexed scale queries later demand it (fine at calibration scale). **Documented boundary (P3 graft):** the `workflow_run_id NOT NULL` FK (brief §F) is a structural wall — there is no run-independent conversation table, so `thread_id` is scoped *within* a run. There is no pre-run or cross-run chat session; this is inherited, not introduced, and is an explicit non-goal (§9).

---

## 7. What changes vs what stays

| Area | Keep unchanged | Change / add |
|---|---|---|
| **Governed stream** | Append-only, 3-record turn shape, provenance/authority/version stamping | Add `content.thread_id` / `anchor_item_id` / `anchor_kind` |
| **CapabilityRegistry** | All 22 caps; `confirmation.prompt` ritual (`synthesizer.ts:176-189`); `runForcedCapability` fast path (`:226-236`) | Add `tier` field; add `submitItemFeedback`, `authorItem`, `regenerateCollection`; expose `advanceToNextPhase(reviseTo)` behind GOVERN; generalize confirmation to ALL GOVERN |
| **DMR / ContextPacket** | Entirely unchanged — session memory + compaction; deterministic-first `basePacket` (`deepMemoryResearch.ts:984`) | Seed `knownRelevantRecordIds`@1.0 + `focusComponentId` for anchored briefs (already-supported hook) |
| **Priority lane** | Two-lane `user_query`/`phase` scheduler (`priorityLLMCaller.ts`); both liaison calls tagged `user_query` | Add `onToken` streaming callback; every loop call still `user_query`-tagged |
| **DecisionRouter / gates** | `pauseForDecision`, `resolveDecision`, `certifyPhaseGate` as sole certifier; idempotent re-entry | Populate `free_text_feedback` in `routeBundle` (`decisionRouter.ts:280`); flip `allow_free_text` (`phase1.ts:2091`); emit `gate_recertification_required`; gatekeeper `human_authored` exclusion (`phase1.ts:2265`) |
| **Synthesizer** | Packet template vars (`synthesizer.ts:79-83`) | **Replace single-pass dispatch (`:120-225`) with the bounded ReAct loop behind CapabilityBroker** |
| **Classifier** | Runs as LLM #1 (cheap) | **Demote from gate to advisory hint** (`classifier.ts:40`); DMR default on failure |
| **Capability context** | — | **Split `ctx` into `ReadCtx`/`ProposeCtx`/`GovernCtx`**; CapabilityBroker chokepoint; CI lint |
| **Slash handling** | `forceCapability` bridge | **Delete client switch (`IntentComposer.svelte:142-189`)**; server-side registry, slash=cap, unknown→NL |
| **Threads / sub-chats** | Existing projection/suppression (`records.svelte.ts:341,379`); `childrenByParent`/`getChildren` | **Add Thread abstraction**; per-card composer on `Card.svelte`; de-singletonize `composerStore` (`composer.svelte.ts:138`); per-thread unlock (`App.svelte:57-59`) |
| **Graph helpers** | DMR edge traversal (correct) | **Fix `db.ts:248,285` `source_id`→`source_record_id`** as cleanup |

---

## 8. Phased roadmap

Each increment is independently shippable and testable **GPU-free** via the existing replay harness (`project_replay_harness_and_pagination`: Tier-1 record-playback via `JANUMICODE_REPLAY_MODE`, Tier-2 engine replay via `JANUMICODE_REPLAY_ENGINE`, `prep-replay-db.mjs` cloning cal-40 / clone-p9). New loop paths use a **deterministic stub model** returning canned tool-call→final sequences (added as a replay fixture model). Because tool dispatch is deterministic, the whole loop replays.

**Increment 1 — Streaming (standalone, ships first).** Add `onToken` to the synthesizer LLM call (`synthesizer.ts:99`); wire to the existing `llm:stream_chunk → streamingStore.append` path; add per-iteration `llmStatus` progress lines. *Test:* replay a recorded chunk sequence renders incrementally; no behavior change. De-risks the Goose-like feel early (P3 graft).

**Increment 2 — Governed ReAct loop + CapabilityBroker + `ReadCtx` + classifier demotion.** Rewrite `synthesizer.ts:120-225` into the bounded loop behind the broker; errors-as-observations; forced-final-turn; no-progress guard. Split `ReadCtx` first (the highest-safety, lowest-cost slice per cost-risk judge) with the CI lint. Demote classifier to hint. *Tests:* replay-parity on recorded single-tool turns (assert identical final answers); scripted multi-tool chain resolves; hallucinated-tool fixture → self-repair; **adversarial safety-property test — a READ cap that then attempts to escalate is rejected (no `writer` reachable)** (P4/cost-risk graft); classifier-JSON-failure fixture → turn still completes correctly (vs today's silent misroute).

**Increment 3 — Slash sugar + server-side registry.** Delete `IntentComposer.svelte:142-189`; slash=cap convention; unknown→NL open query. *Test:* unknown slash reaches host as an open query (no synthetic card).

**Increment 4 — Thread plumbing + Card ASK + full tier split.** Additive no-LLM thread stamping + `getRecentConversationTurns` filter (`db.ts:214`); `focusResolver` + retriever seed (`retriever.ts:91,119-124`); **fix `db.ts:248,285` column bug**; de-singletonize `composerStore` (`composer.svelte.ts:138`); `threadKey` on `submitOpenQuery`; suppression/nesting render; complete `ProposeCtx`/`GovernCtx` split + confirmation generalized to all GOVERN. Card ASK with shrunken 3–5-tool READ menu. *Test:* replay `clone-p9` (345 bound findings); ASK on a `US-*` card seeds `knownRelevantRecordIds@1.0`, neighborhood via DMR Stage-4 (not `getDownstreamDependencies`), cites ids; **assert no mutation records written**.

**Increment 5 — REFINE / REGENERATE.** `submitItemFeedback` (PROPOSE→GOVERN) + `regenerateCollection` (GOVERN). Case A: hoist `free_text_feedback` into `routeBundle` (`decisionRouter.ts:280`), flip `allow_free_text` (`phase1.ts:2091`), wake `runBloomRoundWithFeedbackLoop` (`phase1.ts:2177`). Case B: expose `advanceToNextPhase(reviseTo)` (`orchestratorEngine.ts:823-828`), preserve-set, delta-only re-cert, degrade-to-escalate for consumed collections. *Test (highest-integrity-risk phase — heaviest coverage):* replay a phase-1 cal DB at a `user_journey` gate; drive "generate more journeys"; assert (a) a `HumanEdited` feedback record with anchor provenance, (b) re-bloom emits **only new** records, (c) accepted journeys unchanged / no supersession, (d) new items Authority 2 pending while accepted keep Authority 6, (e) `approved_artifact_ids = old_set ∪ newly_accepted`, (f) a *changed* certified item forces a `supersedes` edge + revisit, (g) bounded to 3 iterations, fail-loud on the 4th.

**Increment 6 — AUTHOR + gatekeeper guard + AgentRole.** `authorItem` structured form (zero-JSON); explicit `HumanEdited` authority (`governedStreamWriter.ts:601`); human `produced_by_agent_role` value (`records.ts:78`); `runScopeGatekeeperForBloom` exclusion of `provenance==='human_authored'` (`phase1.ts:2265`). *Test:* author a `user_journey` by hand; assert a `HumanEdited` `artifact_produced` with human provenance, that it **survives the gatekeeper**, is ingested by the next re-bloom as frozen input, and is certified to 6 **only** after the gate.

After the replay increments, one **live GPU cal run** (resume-not-fresh, per `feedback_prefer_resume_over_fresh_cal_run`) validates weak-model tool-selection accuracy and loop-convergence — the one thing replay cannot cover.

---

## 9. Risks, open questions, and non-goals

### Risks

- **Scoped gate re-certification is the hardest, riskiest piece — all four proposals and all three judges agree.** Delta-merging `approved_artifact_ids` and the `phase_gates` row for an expanded/authored collection risks double-counting, de-certifying the accepted core, or orphaning `validates` edges — a bug here breaks invariant 3. This gets the heaviest replay coverage (Increment 5/6) and rigorous idempotency tests before it ships.
- **Weak-model tool-JSON fidelity across observe iterations is empirically unknown** (honest across P3/P1). Mitigated by reserving the free-form loop for ASK, structural mode selection on the mutating path, shrunken menus, self-repair, and forced-final-turn — but must be measured on `gpt-oss:20b`, `gemma4:31b`, `ornith:35b`.
- **Loop cost on single-resource Ollama.** Worst case 4 calls vs 2; no in-flight preemption (`priorityLLMCaller.ts:116`, `maxParallel:1`), so a long chain can stall phase work despite the priority lane. Bounded by the ≤3 cap + forced-final-turn; not eliminated.
- **Tier mis-tagging is a hole.** The CI lint (ctx-destructure audit) is now safety-critical infrastructure; a mis-tag with no lint coverage is a silent mutator leak.
- **Semantic near-duplicate re-bloom outputs** slip past the structural id dedup — a quality risk, not an integrity risk (the gate catches gross errors). We explicitly do not attempt semantic dedup.
- **Composer de-singletonization** is the riskiest UI change (`composer.svelte.ts:138`, `App.svelte:57-59`): the unlock lifecycle must key on `thread_id` or one card's in-flight turn locks all cards.
- **Observability tradeoff:** intermediate observations are in-memory (summarized in `capability_calls`), so a failed production loop is harder to reconstruct — intentional for data-model minimalism; a `liaison_reasoning_step` persistence toggle is available if needed.
- **Mid-loop confirmation UX** interrupts a multi-step plan; the model must re-plan on re-entry, which can feel disjointed.

### Open questions

- Iteration-budget and token-budget calibration per model (empirical, live cal).
- Whether to persist intermediate reasoning steps as records (auditability vs minimalism) — default no; revisit after Increment 2.
- Case A/B detection race — if the gate resolves concurrently while the operator types feedback. Mitigate by resolving strictly by the exact pending id; if the pending id is gone, fall to Case B.
- The detection heuristic for "collection already consumed by a downstream phase" that triggers degrade-to-escalate (Case B boundary).

### Explicit non-goals

- **In-flight LLM preemption.** We keep queue-priority (`priorityLLMCaller.ts:117`) and accept one-inference worst-case latency (unchanged from today).
- **Fixing bloom quality / semantic dedup.** Preservation uses structural id-namespacing + supersession only (per `feedback_no_regex_id_resolution`).
- **Pre-run or cross-run chat sessions.** The `workflow_run_id NOT NULL` FK wall means `thread_id` is run-scoped; conversing before `startWorkflow` is out of scope.
- **Grammar-constrained / schema-enforced tool decoding.** Would help weak models but exceeds this scope; noted as a future lever.
- **A new memory store or session table.** The governed stream *is* the session log; the DMR `ContextPacket` *is* compaction. We build a loop and a tier contract, nothing more.
- **Promoting `content.*` thread fields to indexed columns.** Only if scale queries later demand it.

---

**Net.** The recommendation is decisive: rewrite the single terminal seam (`synthesizer.ts:120-225`) into a bounded, streaming ReAct loop; demote the classifier from gate to hint; contain every mutation behind object-capability tier-scoped context objects verified by a CI lint; select card-feedback mode structurally via the UI affordance so weak models never gamble on the write path; and route the three card modes (ASK/READ, REFINE-REGENERATE/PROPOSE→GOVERN, AUTHOR/PROPOSE) into governed records and the existing gate machinery — with delta-only re-certification that never re-gates the accepted core and never launders authority. It ships in six GPU-free-testable increments, keeps the common turn at today's 2-round-trip cost, and preserves all seven hard invariants by construction rather than by prompt discipline.