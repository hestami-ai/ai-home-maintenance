# JAN-PWADESIGNER-DS-001 — Simulator Walkthrough (Phase C #4)

**Status:** DESIGN-FIRST — for sponsor alignment. Nothing built. (Phase C is design-first by sponsor direction.)
**Date:** 2026-07-21
**Scope:** the in-app PWA Designer (`apps/rph-demo`). A read-only *reading aid* over an authored PWA graph.

---

## 1. What it is (one line)

A **hand-off dependency walk**: a stepped traversal of an authored PWA's PWU-Type graph, following the **artifact hand-off plane** (`requiredOutputs → requiredInputs`), that surfaces, for the node(s) at each step, a per-node panel — inputs/producers, outputs/consumers, the assurance floor, the generic PWU work-lifecycle topology, and any coherence findings. It answers *"what must be produced before what can be consumed, and what does each unit look like?"* — a comprehension aid for an author reviewing a PWA.

## 2. What it is NOT (the guardrails — this is the load-bearing part)

The walkthrough sits on the **three planes** (see the system prompt / DS-001 D-1a) and its correctness is defined by keeping them distinct. Recording the boundaries up front, because the naïve version of this feature *is* a category error:

- **NOT an execution schedule.** The hand-off plane is a **dependency** relation, not a temporal order (§11.7.2 "composition ≠ order"; the system prompt's "hand-off is not schedule"). The walk MUST be labeled and shaped as a *dependency* walk, never "the order the work runs in." Temporal order, concurrency, and iteration belong to an **Execution Plan / Workflow**, authored elsewhere and outside these PWA-authoring surfaces (canon: Coding Agent Guide §9.1 + §3 — see §2.1).
- **NOT a real Undertaking run.** No PWU is instantiated, no command is dispatched, nothing is persisted. It is a projection of the authored *definition*, which carries no instance state.
- **NOT authoritative.** Exactly like the existing lifecycle simulation (`pwuBehaviorMachine` — "does not evaluate authoritative guards, dispatch Commands, persist snapshots, or mutate professional state"), the walkthrough writes nothing to the engine.
- **NOT a composition traversal.** The permits tree ("what is this made of") is a *different* plane and is already the graph's primary rendering. The walk is over hand-off, not composition.
- **NOT a fabricated total order.** Hand-off is a **partial** order. Where the data admits several valid orderings, the walkthrough SHALL show them as concurrent (a layer), never invent a single line (see §5).

## 2.1 Canonical grounding (Coding Agent Guide) — this boundary is canon, not a preference

The prohibition on execution-order sequencing at the PWA / PWU-Type level is explicit in the canon, so the walkthrough's numbering is a **dependency** numbering, never an **execution** one:

- **§9.1 (Plan, workflow, step, and binding), opening line:** *"A PWU defines professional work. It does not embed its runtime sequence."* Runtime sequence lives in the **Execution Plan** ("versioned and governed… steps/transitions, retry, tactic-change, escalation, termination"), the **Execution Step** ("temporal machinery… wait, branch, parallel group…"), over PWU **Instances** in an Undertaking — never on a PWU Type.
- **§3 canonical distinctions:** `PWU ≠ Task` · `RPH ≠ Workflow Engine` · **`PWA ≠ Execution Workflow`** · `Work Graph ≠ Execution Graph` · **`semantic progression ≠ temporal execution sequence`**.
- **§3 glossary / view rules:** a PWA *"is not primarily a sequence"*; the **PWA Work Architecture View** *"displays reusable definitions and type-level rules, not concrete state or temporal execution order"*; *"reserve workflow for temporal execution."*
- **Why not even in principle:** one PWA → many Undertakings, each with its own Execution Plan ("one active Execution Plan exists per PWU"); cardinality (`M+`/`C*`) + iteration/retry + conditional applicability (*"Not every possible child is instantiated"*) mean there is **no single well-defined execution order** to number. A fixed per-Type number would be false for most Undertakings.

**Consequence for this feature:** the walkthrough MAY number its **hand-off dependency layers** (a partial order — "what must be produced before what can be consumed"), because that constraint holds for *every* Undertaking; it MUST NOT present those numbers as *execution* order. True execution sequencing is a separate, future surface (§13). This is the sponsor-ratified resolution of fork #1 (2026-07-21).

## 3. The plane it walks, and the planes it reads

| Plane | Role in the walkthrough | Source |
| :-- | :-- | :-- |
| 1 — Composition (permits) | Context only (which parent a node hangs under); NOT the traversal order | `PwaGraphExport.permits` |
| 2 — Artifact hand-off | **The traversal axis** — the dependency DAG the walk steps through | `PwaGraphExport.dataFlow` / `artifacts` |
| 3 — PWU lifecycle | Per-node panel content (the generic Envision→Assure topology, simulated locally) | `buildPwuBehaviorProjection()` + `compilePwuBehaviorMachine` |

## 4. Data footing — all reused, no new authored data (grounded in code)

Everything the walkthrough needs already exists; it is an **orchestration layer**, not new domain modeling. No contract, handler, or engine change.

- **Hand-off DAG + artifact index:** `packages/rph-projections/src/pwa-graph.ts` — `dataFlow: {producer, consumer, artifact}[]` and `artifacts: {name, producedBy[], consumedBy[]}[]`.
- **Coherence findings:** `analyzePwaGraph(...)` → `report` (structural validity, `conservation` advisories, `delegatedAssurance`). Node-scoped findings are filtered from this.
- **Assurance floor per node:** the existing §11.7.4 card rail (locked floor + declared policies + delegated attestation-substitute), already fed by `pwaFlow` / `PwuTypeCard`.
- **Lifecycle topology:** `buildPwuBehaviorProjection()` (called once today at `+page.svelte`) + `PwuBehaviorPanel` (the "behaviorlens", already keyed to the selected node) — reuse verbatim; the topology is the *generic* PWU work-lifecycle (same for every Type; Types carry no instance state).
- **Leaf kind:** the shared `leafKind` classifier (`packages/rph-projections/src/leaf.ts`).
- **Overlay + panel patterns:** the `showDataFlow` off-by-default overlay toggle and the Svelte-Flow `<Panel>` clusters in `+page.svelte` are the template for the walkthrough's controls.

## 5. The hand-off dependency walk (the one genuinely new computation)

A new **pure, browser-safe** projection function (candidate home: `packages/rph-projections/src/pwa-graph.ts` or a sibling `handoff-order.ts`), unit-tested, producing an **honest layering** of the hand-off DAG:

1. Build the dependency DAG from `dataFlow`: an edge `producer → consumer` for each hand-off (a consumer depends on its producer).
2. **Kahn layering (partial order, not a line).** Repeatedly emit the set of nodes whose producers are all already emitted. Each emitted **set is a layer** — nodes in the same layer are mutually independent (concurrent), and the walkthrough shows them together, explicitly *unordered*. This is how the partial order stays honest: it never claims order that the data does not establish.
3. **Cycles (true SCCs).** Compute the strongly-connected components of the dependency graph (Tarjan). An **SCC of size > 1** (A's output feeds B and B's feeds A) has *no* internal ordering → surface it as a **mutually-dependent cluster**. Cycle detection is OWNED by this projection (the graph's existing `analyzePwaGraph` detects only *permits* cycles, never hand-off cycles — verified), and it is **advisory: it never gates `valid`** (unlike `acyclic-permits`); it is a finding, mirroring `conservation`.
4. **Blocked (downstream of a cycle).** A node that is not in a cycle but whose dependency-closure passes *through* a cycle can never be Kahn-emitted (a producer it transitively depends on is stuck in the cluster). It is NOT a cycle member and NOT hand-off-less — it goes in a distinct **`blocked`** bucket ("unresolvable — depends on a hand-off cycle"). *This is the case a naïve "any un-emitted node is a cycle member" rule mis-labels; it must be separated.*
5. **No declared hand-off.** Nodes with no hand-off edge at all (composition-only leaves, isolated types) cannot be placed by dependency. Put them in an explicit trailing **"no declared hand-off"** (`unordered`) bucket — visible, not silently dropped or fabricated into a layer.

Output shape: `{ layers: string[][], cycles: string[][], blocked: string[], unordered: string[] }` — a **strict 4-way partition** of every node (layers = partial-order steps; cycles = SCC>1 clusters; blocked = downstream-of-cycle; unordered = hand-off-less). Invariant: every node appears exactly once; for every dataFlow edge with both endpoints in `layers`, `layer(producer) < layer(consumer)`. The panel's coherence-findings limb and the step controller both read `cycles`/`blocked` from THIS projection (not `analyzePwaGraph`, which has no hand-off-cycle detection).

**Stepping & numbering.** The walk advances layer-by-layer (forward / back / reset). Each layer carries a visible **dependency-step number** (1, 2, 3 …), and every node in a layer **shares** that number — concurrency is shown, never hidden behind a fake unique index. The number is labeled **"dependency step"** (what must be produced before what can be consumed), explicitly NOT an execution-order index (§2.1). This is the honest form of the "sequence numbers" affordance: it is true for *every* Undertaking (a consumer can never precede its producer). A step highlights its layer's node(s) on the canvas and opens the per-node panel.

## 6. Per-node panel (all five limbs reused)

For the node(s) at the current step:

1. **Inputs / producers** — `requiredInputs`, each resolved to the upstream node(s) that produce that artifact (`artifacts.producedBy`).
2. **Outputs / consumers** — `requiredOutputs`, each resolved to the downstream consumer(s) (`artifacts.consumedBy`).
3. **Assurance floor** — locked floor + declared policies; for a delegated leaf, the attestation-substitute — never Reasoning-Review-satisfied for external work (INV-2). Source: `current.requiredAssurancePolicyIds` + `current.executionBoundary`/`boundaryContract` + the `ASSURANCE_FLOOR` constant, applying the **card adapter's** INV-2 conditioning logic (delegated ⇒ the two deterministic limbs + substitute) — NOT the inspector rail's rendering, which shows the full floor (incl. Reasoning Review) unconditionally.
4. **Lifecycle** — the `PwuBehaviorPanel` generic work-lifecycle sim, captioned as topology-only / non-authoritative.
5. **Coherence findings** — leaf-kind (`leafKind`), the node's structured `delegatedAssurance` record (keyed by `nodeId`), any hand-off `cycles`/`blocked` membership (from the §5 projection), and its conservation advisories. Because `analyzePwaGraph.findings`/`conservation` are flat `string[]` (node identified only by name-in-message), a small **additive structured per-node finding projection** (pure export, like §5) supplies node-keyed findings — no brittle name-substring matching.

## 7. UI / UX integration

- A new **"Walkthrough"** mode toggle in the bottom-center control cluster, **off by default** (mirroring `showDataFlow`). Turning it on auto-enables the data-flow overlay (the walk *is* over hand-off) and reveals a **step controller** `<Panel>` (⏮ prev / ⏭ next / ⤾ reset, "dependency step k of N", a cycle/orphan indicator). Each node carries a small **dependency-step number badge** (shared within a layer), captioned so it never reads as execution order.
- Non-current nodes dim; the current layer highlights; the per-node panel (extend the existing behaviorlens, don't add a competing inspector) shows the five limbs.
- A persistent **caveat banner** in the controller: *"Hand-off dependency order — what must be produced before what can be consumed. NOT an execution schedule; temporal order belongs to an Execution Plan."*

## 8. Non-authoritative guarantee (must be provable)

Pure presentation state (Svelte `$state`), no server action, no command. An e2e MUST prove: entering/using the walkthrough and reloading leaves engine truth byte-identical — mirroring the existing `pwa-authoring-backbone` proof that the lifecycle sim + canvas are non-authoritative.

## 9. Honest labeling — the "Likely undertaking flow"

The walkthrough is the deterministic, structural counterpart to the authoring agent's already-demonstrated *caveated* "Likely undertaking flow" narrative. Both are **reading aids**, not authority. The walkthrough derives purely from `dataFlow` (deterministic, non-authoritative); it does NOT consume or depend on the agent's narrative. The caveat (§7) is always present.

## 10. Open forks — the decisions I need from you to finalize

1. **Ordering presentation — RESOLVED (sponsor 2026-07-21):** layered partial order **with visible dependency-step numbers** (option a + numbering). Each number is labeled "dependency step," never "execution order" (§2.1). This gives authors the sequence-number affordance honestly and canon-clean; true execution numbering is deferred to the Execution Plan view (§13).
2. **Cycle handling.** Flag the cluster as a coherence finding and present it as mutually-dependent (*recommended*) vs. refuse to walk a cyclic hand-off graph. — *Rec: flag + present.*
3. **Orphan (no-hand-off) nodes.** Trailing "no declared hand-off" bucket (*recommended*) vs. omit from the walk. — *Rec: bucket.*
4. **Walk scope.** Whole PWA (*recommended* first) vs. a focus-on-selected-subtree mode (later). — *Rec: whole PWA first.*
5. **Panel home.** Extend the existing behaviorlens panel (*recommended*, one inspector) vs. a dedicated walkthrough inspector. — *Rec: extend.*
6. **Composition awareness.** Should a layer visually group by parent (composition context) or purely by dependency depth? — *Rec: purely dependency; show parent as a label only.*

## 11. Verification approach

- **Unit** (the new projection): Kahn layering correctness; cycle detection (SCC>1); orphan bucketing; determinism; empty/single-node/disconnected graphs.
- **Component:** the panel renders all five limbs for a node; delegated node shows the attestation-substitute (INV-2), never RR-satisfied.
- **E2E:** walkthrough toggles on (off by default); stepping highlights the expected layer; the caveat banner is present; **non-authoritative** (reload → engine truth unchanged); a hand-off cycle surfaces as a finding, not a fabricated order.
- **Category discipline (explicit test):** the UI text asserts "dependency / not a schedule" and never renders hand-off order as execution/temporal order.

## 12. Increment plan (each: land → gate → commit)

1. **Projection** — the pure hand-off layering/cycle/orphan function + unit tests (`rph-projections`). No UI.
2. **Panel** — assemble the five-limb per-node panel from existing pieces (extend behaviorlens) + component tests.
3. **Mode + stepper** — the off-by-default Walkthrough toggle, step controller, highlight/dim, caveat banner.
4. **E2E + polish** — non-authoritative proof, stepping, cycle/orphan surfacing, category-discipline assertion.

Central gate throughout: `check-types` · `test` · `lint` · `boundary` · svelte-check · Playwright (msedge). `rph-projections` stays browser-safe (no server-only imports — the new projection is pure).

## 13. Deferred (canonical seam): the Execution Plan view is the true home for execution sequence

Execution *sequence* — the actual order the work runs in, with branches, loops, waits, retries, and parallel groups — is canonically an **Execution Plan / Execution Workflow** over PWU **Instances** in an **Undertaking** (§9.1), NOT a property of the PWA / PWU Types this Designer edits. That is a distinct, future surface on the **Undertaking Workbench** side, where unrestricted execution numbering, timeline/Gantt rendering, and step/attempt state are all legitimate *because they attach to instances under a governed, versioned Plan* ("one active Execution Plan exists per PWU").

This walkthrough is the **design-time preview** of that: a deterministic, non-authoritative projection of the *dependency constraints* the PWA imposes on any future Plan. The caveated "likely undertaking flow" (§9) is the bridge — it hints at what an Execution Plan *might* look like without being one. When the Execution Plan view is built, this walkthrough's dependency layering becomes its **constraint-checker** (no Plan may order a consumer before its producer), and execution-order numbering lives there, over instances — exactly where §9.1 puts it.

---

*Design-first. Fork #1 (ordering presentation) RESOLVED — layered partial order with dependency-step numbers, canon-grounded in §2.1. Forks #2–#6 stand at their recommendations pending your confirmation; the build would start at Increment 1 (the pure layering projection) on the resolved design.*
