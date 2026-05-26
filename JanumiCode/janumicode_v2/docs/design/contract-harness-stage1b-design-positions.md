# Contract Harness — Stage 1b Design Positions on the Eight Gaps

Status: design positions, written before Stage 2 scaffolding
Date: 2026-05-20
Authority: design decisions delegated; positions written from "what Phase 9 needs to be maximally informed × what upstream phases can produce."

This document takes a position on each of the eight design gaps surfaced by the Stage 1 enumeration. Each section: position, rationale, what changes, generality check.

## Guiding principle

Phase 9's executor needs ten things to do its job without inventing:

1. Component contract (id, name, responsibilities, dependencies)
2. **User-facing purpose** (which user stories does this work serve)
3. **Acceptance criteria** (what must hold true post-implementation)
4. NFRs that apply to this component
5. Test cases this implementation must pass
6. Evaluation criteria
7. Data models for entities the component owns
8. APIs the component exposes
9. Technical constraints scoped to this work
10. Domain context (business domain this work serves)

Items 2 and 3 are the structural gap underlying the ts-17 packet starvation. The positions below add the minimum upstream edges needed to deliver them, with no LLM workload added that doesn't serve a downstream consumer.

---

## Gap #1 — Phase 6 `task.traces_to` semantic

**Position:** `task.traces_to` MAY include US ids but is NOT required to. Required content remains "responsibility ids, SR ids, or component ids" per the existing prompt. US tracing is provided to the executor by **inheritance from `component.traces_to`** (see Gap #2), not by per-task LLM annotation.

**Rationale:**
- Phase 6 task population now has two origins: LLM (infrastructure) and deterministic delta synthesizer (user-facing). Delta tasks already trace to US directly. Original Phase 6 tasks need the *narrative context* of US, not a tight per-task US edge — they implement component responsibilities, not user stories.
- Adding per-task US annotation requires plumbing FR/US into Phase 6's input, adding ~30 LLM annotations per project. Per-component annotation via Gap #2 achieves the same narrative context for ~9 annotations per project.
- Phase 6 also needs to stop emitting responsibility *statements* (prose) in `traces_to` and instead emit responsibility *ids* (e.g. `res-send-email`). One prompt clarification.

**What changes:**
- Phase 6 prompt (`implementation_task_decomposition.system.md` line 51): tighten language to clarify that `traces_to` entries must be ids (not statement prose). Add: "if the task implements a user-facing behavior cited in a delta cycle, also include the US id."
- Phase 9 packet builder: `findUserStoriesForTask` Pass 1 (literal US match) remains; Pass 2 now reads the component's `traces_to` (see Gap #2) instead of the current component-fallback that searches `US.traces_to`.

**Generality:** universal — applies regardless of project.

---

## Gap #2 — Phase 4 `component.traces_to` field

**Position:** `component.traces_to` MUST exist and MUST cite the US ids the component serves. This is the canonical US ↔ component edge. Component model schema is extended to require it.

**Rationale:**
- Phase 4's job is to design components that satisfy user needs. Declaring "this component serves US-X, US-Y" is the architectural commitment Phase 4 is already implicitly making.
- Granularity matches Phase 9's narrative needs: an executor implementing any task on `comp-abuse-notification-service` benefits from knowing which user stories the component as a whole exists to serve. Task-level granularity (Gap #1) is unnecessary for infrastructure tasks.
- Phase 4 currently receives `system_requirements_summary` (SR-* ids). SR ids derive from FR/NFR. Adding `functional_requirements_summary` (US ids + role/action/outcome) as a Phase 4 input is structurally honest — Phase 4 is supposed to know what users need.

**What changes:**
- Phase 4 component-skeleton prompt: add `functional_requirements_summary` as required_variable. Add `traces_to` to the output schema with description: "US ids this component's responsibilities collectively serve (one or more)."
- Phase 4 component-saturation prompt: child components inherit/refine the parent's `traces_to`.
- Phase 9 packet builder Pass 2: read `task.component_id` → look up component → use `component.traces_to` as the US set. Existing Pass 2 (which walks `US.traces_to` for component refs) is removed.

**Generality:** universal — every project has a US-to-component mapping conceptually; we're surfacing it explicitly.

---

## Gap #3 — Phase 2 `US.traces_to` content

**Position:** `US.traces_to` MUST cite upstream-only ids: UJ-*, WF-*, ENT-* (journey, workflow, entity). It MUST NOT cite COMP-* ids. The 2-of-17 COMP refs observed in ts-17 are noise to be removed by prompt clarification.

**Rationale:**
- Phase 2 runs *before* Phase 4. Components don't exist yet. A US referring to a component creates a forward dependency that the LLM has to fabricate, which is what the inconsistent 2/17 pattern reflects (LLM inferring component names from intent prose).
- The US ↔ component edge belongs in Phase 4 (Gap #2), where both sides exist.
- Phase 2's job is to capture *needs*, not *structure*. UJ/WF/ENT refs are needs-tier and correct.

**What changes:**
- Phase 2 FR-bloom prompt: explicit constraint — `traces_to` is restricted to UJ-*/WF-*/ENT-* ids; emit nothing else.

**Generality:** universal.

---

## Gap #4 — Phase 5.1 `data_models` shape

**Position:** Upstream shape stays as `models[].entities[].fields[]` (component-grouped, entities nested). Consumer code (`packetBuilder.findDataModelsForComponent`) is fixed to walk the nesting. The contract declares the nested shape as canonical.

**Rationale:**
- The nested shape is more naturally structured for a component that owns multiple entities. Flattening at the producer side would lose the component → entities relationship, which the consumer needs anyway.
- It's a pure code bug — the consumer expected the wrong shape. No LLM work involved.
- Forcing the producer to emit flat would require schema change + prompt edit + every existing artifact regenerated. Forcing the consumer to walk nesting requires a few lines.

**What changes:**
- `src/lib/orchestrator/phases/packetSynthesis/packetBuilder.ts` `findDataModelsForComponent`: walk `models[].entities[]`, emit one `PacketDataModel` per (component, entity) pair.
- `BuilderDataModel` interface revised to match nested shape.
- Contract codifies: producer emits `models[component_id, entities[name, fields[name, type, constraints]]]`.

**Generality:** universal — same shape every project.

---

## Gap #5 — Phase 5.2 `api_definitions` shape

**Position:** Same as Gap #4. Upstream shape stays as `definitions[].endpoints[]`. Consumer code is fixed to walk nesting.

**Rationale:** Identical to Gap #4.

**What changes:**
- `packetBuilder.findApisForComponent`: walk `definitions[].endpoints[]`, emit one `PacketApiDefinition` per (component, endpoint).
- `BuilderApiDef` interface revised.
- Contract codifies: `definitions[component_id, endpoints[path, method, inputs, outputs, error_codes, auth_requirement]]`.

**Generality:** universal.

---

## Gap #6 — Phase 3 `SR.source_requirement_ids` content

**Position:** `SR.source_requirement_ids` MUST cite BOTH originating user-story ids (US-*) AND any NFR ids the SR aggregates. SR becomes a multi-axis bridge between needs (US/NFR) and components (Phase 4 SR allocation).

**Rationale:**
- Today SR-009 traces to NFR-019 only, even though the SR captures behavior demanded by US-012 ("Administrator… abuse flagged URLs can be blocked"). The chain `task → SR → US` would close cleanly if SR carried US refs.
- This is a *secondary* fallback — Gap #2 (component.traces_to) is the primary US source for packets. SR enrichment is for cases where component.traces_to is too coarse (rare) and for cross-phase coherence reporting.
- One prompt addition in Phase 3: "for each SR, list every FR (US id) and NFR id whose behavior this SR aggregates."

**What changes:**
- Phase 3 system-requirements prompt: extend `source_requirement_ids` description to require both US and NFR ids where applicable.
- Phase 4 component-skeleton: SR allocation continues to work as today (this isn't an SR ↔ component change, just SR ↔ source).

**Generality:** universal.

---

## Gap #7 — `user_journey_bloom` non-empty invariant

**Position:** `user_journey_bloom` MUST be non-empty whenever any UJ id is referenced by *any* other artifact in the same workflow run. The empty-array observation in ts-17 is a regression to investigate as a separate Phase 1 defect. Contract enforces the invariant; failure is a hard blocker, not advisory.

**Rationale:**
- UJ ids appear in 17 of 17 US `traces_to` lists in ts-17. They appear in `workflow.backs_journeys`. They appear in `release_plan.contains.journeys`. The bloom is empty. This means downstream code that resolves UJ refs to journey definitions silently fails.
- It's not specific to ts-17 — the contract layer will catch it on every future run.
- Investigating the underlying Phase 1.3a defect (why it emitted zero journeys despite the data flowing through everywhere else) is *separate work*. The contract just declares the invariant.

**What changes:**
- Contract clause: "if any artifact in the run references `UJ-*`, the `user_journey_bloom` artifact must contain at least one journey for each unique UJ id referenced."
- Diagnostic CLI flags this immediately on every run.
- Followup ticket: investigate Phase 1.3a normalizer / prompt / state-machine path that allowed it to emit zero items.

**Generality:** universal.

---

## Gap #8 — Domain id namespace (`DOM-*` vs `domain-*`)

**Position:** Phase 4 `software_domains` artifact MUST emit a populated `maps_to_business_domains` field mapping each software-domain id (its own `domain-*` lowercase namespace) to one or more Phase 1 business-domain ids (`DOM-*` caps namespace). The field already exists in the schema with value `{}`; the prompt simply isn't populating it.

**Rationale:**
- The two namespaces represent the same concept at different abstraction levels: Phase 1 captures *business* domains (DOM-ABUSE-PREVENTION), Phase 4 captures *software* domains (domain-abuse, often 1:1 with business but sometimes splitting/combining).
- The mapping is the canonical reconciliation point. With it populated, any cross-phase code can walk `component.domain_id → software_domain → maps_to_business_domains → DOM-* → workflow.businessDomainId`.
- Without it, every consumer reinvents a string-normalization heuristic (which is what would have to happen for any path-E-style deterministic fallback).

**What changes:**
- Phase 4 software-domains prompt: require `maps_to_business_domains` populated for every software domain. Include the Phase 1 `business_domains_bloom` artifact as input context.
- Contract clause: "every software_domain.maps_to_business_domains entry MUST be non-empty and MUST cite ids present in business_domains_bloom."
- Optional downstream consumers (component traceability, future cross-phase coherence checks) can rely on the mapping.

**Generality:** universal.

---

## Roll-up by phase — what these positions change

| Phase / sub-phase | Change | Cost |
|---|---|---|
| 1.3a `user_journey_bloom` | Separate defect to investigate; contract enforces non-empty invariant | Investigation effort + contract clause |
| 2.1 `fr_bloom_skeleton` | Prompt clarification: `US.traces_to` restricted to UJ/WF/ENT, no COMP-* | One prompt edit |
| 3.2 `system_requirements` | Prompt addition: SR.source_requirement_ids cites both US and NFR | One prompt edit |
| 4.1 `software_domains` | Prompt addition: populate `maps_to_business_domains`; add business_domains_bloom to input | Prompt edit + new input var |
| 4.2 `component_skeleton` | Add `functional_requirements_summary` as required_variable; new `traces_to` field in output schema citing US ids | Prompt edit + new input var + schema extension |
| 4.2a `component_saturation` | Child components inherit/refine parent `traces_to` | Prompt edit |
| 5.1 `data_models` | No producer change (nested shape stays); consumer code fix in packetBuilder | Code fix only |
| 5.2 `api_definitions` | No producer change; consumer code fix | Code fix only |
| 6.1 `task_skeleton` | Prompt clarification: `task.traces_to` entries must be ids not prose; optional US ids allowed | One prompt edit |
| 9.0 `packet_synthesis` | `findUserStoriesForTask` Pass 2 reads `component.traces_to`; data_models/apis shape fixes | Code changes |

**Net LLM-workload impact per project run:**
- Phase 4.2: +1 paragraph of US summary in input (~17 lines for ts-17 scale), +9 short annotations in output (~50 tokens total).
- Phase 4.1: +1 paragraph of business_domains in input.
- Phase 3.2, 2.1, 6.1, 4.2a: token-neutral prompt clarifications.
- No new sub-phases. No new LLM calls. Existing input variables already include comparable summary blocks.

**Net code-only deterministic fixes:**
- packetBuilder data_models shape walk
- packetBuilder api_definitions shape walk
- packetBuilder Pass 2 source change
- 8 new contract clauses + invariant enforcement
- diagnostic CLI

---

## What this positioning explicitly does NOT do

- **No new sub-phase.** No "US-to-component bridging pass" or similar. All edges live in existing phase outputs.
- **No retroactive fixup.** ts-17's DB stays as-is. The next run (ts-18) starts with the new contracts and edited prompts.
- **No abandoning the cycle controller.** Delta synthesis still runs when packet coherence flags gaps. With Gap #2 in place, gaps should be rarer — but the safety net stays.
- **No commitment on whether Phase 6 should *also* eventually emit per-task US ids.** That's deferred until we have evidence that component-level US tracing is too coarse for narrative context. If/when it is, Gap #1 reopens as a follow-up.

---

## What's now ready for Stage 2

With these positions, every contract has a well-defined target:

- For 8.1/8.2/8.3 → 9.0 boundary: contract asserts `target_id` shape and presence per US/NFR.
- For 7.1 → 9.0: contract asserts test_suite.component_id presence + AC reference correctness.
- For 6.1 → 9.0: contract asserts `task.traces_to` content is ids (not prose), `task.component_id` resolves into component model.
- For 5.1/5.2 → 9.0: contract asserts the nested shape this document declares canonical.
- For 4.2 → 6.1: contract asserts `component.traces_to` non-empty for every component.
- For 4.1 → 4.2: contract asserts `software_domains.maps_to_business_domains` non-empty.
- For 3.2 → 4.2: contract asserts `SR.source_requirement_ids` non-empty and cites valid US/NFR ids.
- For 2.1 → all downstream: contract asserts `US.traces_to` restricted to UJ/WF/ENT.
- For 1.3a → 2.1: contract asserts `user_journey_bloom` non-empty when UJ refs exist.

Stage 2 can proceed: scaffolding (`src/test/contracts/` + types + runner + diagnose CLI skeleton), no design decisions pending.

Stage 3 starts at the bottom of the ladder (Phase 9 boundary contracts) and works upward, populating contracts against the positions in this document.
