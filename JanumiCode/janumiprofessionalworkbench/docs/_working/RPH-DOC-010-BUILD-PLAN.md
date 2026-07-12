# RPH-DOC-010 Full Live Buildout — Implementation Plan

> **Scope decision (sponsor, 2026-07-12).** Build the complete PWA Designer + Undertaking Workbench UX of
> RPH-DOC-010 as a **full live stack**: every action drives the event-sourced engine end to end. This means
> (a) implementing the ~40 deferred Undertaking command handlers (the M9–M13 "live-command-drive" depth),
> (b) building a **new PWA-authoring bounded context** (PWA / PWU Type / rules as governed, versioned,
> event-sourced aggregates with a draft→publish lifecycle), and (c) the full multi-context Svelte 5 UI.
> Cadence: **autonomous full run** — build all slices, document questions in OPEN-QUESTIONS, present at the end.
> Vocabulary: **adopt the design-system visuals, re-map every label to the Canonical Vocabulary Charter.**

## 1. Architecture: two bounded contexts over shared infrastructure

RPH-DOC-010 §35 is explicit that "PWA Design" and "Undertaking" are different objects with different authority
boundaries. We mirror that as two bounded contexts sharing one persistence + command pipeline:

```
                       ┌────────────────────────────────────────────┐
                       │  SvelteKit app (apps/workbench) — NODE side  │
                       │  createEngine(...)  +  createPwaDesigner(...)│  ← engine hosts live here (Node)
                       └───────────────┬───────────────┬─────────────┘
        server actions / +server.ts    │               │   server load() → getProjection/query
        (dispatch commands)            ▼               ▼
   ┌───────────────────────────┐   ┌───────────────────────────────────────────────┐
   │ PWA AUTHORING CONTEXT (new)│   │ RPH RUNTIME CONTEXT (existing engine)          │
   │ @janumipwb/rph-pwa-authoring│  │ contracts/domain/persistence/application/       │
   │ Pwa, PwuType, Relationship, │  │ assurance/projections/engine                    │
   │ DecompositionRule, Assurance│  │ 17 Professional Work Objects, 4 PWU state axes  │
   │ Assignment, RoleDef,        │  │ ~40 commands → handlers → events → projections  │
   │ BaselineType, ExecStrategy, │  │                                                 │
   │ ConformanceFixture;         │  │ Undertaking binds to a PUBLISHED PWA version    │
   │ draft→published FSM         │──┼─▶ (published PWA version → EngineOntology)       │
   └───────────────────────────┘   └───────────────────────────────────────────────┘
                       ▲                                   │
                       └─── browser (Svelte, PURE) renders projections only ──┘
```

**Key seam.** A *published PWA version* projects to an `EngineOntology` (the structural type `createEngine`
already accepts). `Instantiate PWA` (§42) binds an Undertaking to that snapshot. The existing
`@janumipwb/rph-product-realization-pwa` ontology package = the **seed published Product Realization PWA v1.3**
(a `Pwa` aggregate replayed from a seed event stream, or adopted as an immutable published record). The
authoring context can also mint successor versions (§43).

**Browser purity is preserved.** The Node engine (better-sqlite3 / node:crypto) runs only in the SvelteKit
**server**. The browser bundle imports only pure `rph-projections` view types + posts commands to server
endpoints. This upholds the charter's "engine never renders" and the `projections-browser-safe` boundary rule.

## 2. What already exists (leverage, do not rebuild)

- **Domain kernels are built and conformance-tested** (M9 decomposition, M10 governance/baseline, M11 execution,
  M7 assurance rules). Handlers CALL these guards — e.g. `ActivateExecutionPlan→canActivatePlan`,
  `PromoteBaseline→canPromoteBaseline`, `ApproveDecision→authorizeDecisionEffective`, `StartExecutionStep→canStartStep`.
- **Command→event→transition BINDINGS are data** (`messages.ts` `BINDINGS`, generated from
  `vocab/m3-commands-events.json`). Each command declares `drivesMachine`/`drivesFrom`/`drivesTo`/`emitsEvent`.
- **Pipeline is command-agnostic** (`rph-application/command-bus.ts`): idempotency → validate payload → produce
  state+event → validate produced state (fail-loud) → atomic commit (events+outbox+receipt) → CommandResult.
  Only the *handler dispatch* is hardcoded to CaptureIntent; that's the registry refactor (P3).
- **Projection framework** (`rph-projections`): `Projector<V>`, `rebuildProjection`, `IncrementalProjection`,
  `workProjector`, the pure `graph-view` seam + `isQualifiedSuccess` (INV-5).
- **Engine facade** `createEngine({ ontology, store, ... }) → EngineHandle`.

## 3. Vocabulary re-mapping (design mockups → Canonical Vocabulary Charter)

The design comps are the **visual** authority; the Charter (RPH-DOC-000) outranks UI convenience. Re-map:

| Mockup / DESIGN.md term | Charter-conformant UI term | Rule |
| --- | --- | --- |
| `PHASE: DISCOVERY / ARCHITECTURE / IMPLEMENTATION` on nodes | (drop "phase") node = a **PWU Type**; group label = **Work Area** / lifecycle stage from §7 | `phase` is legacy/compatibility-only |
| Node accent keyed to "phase" | **PWA/type side:** accent by Work Area (categorical). **Undertaking/instance side:** accent by state/assurance (INV-5 colouring) | §27 / §35.1: no execution state on the type side |
| "Workflow Approval" toggle | **"Approval"** / **"Governance rule"** | `workflow` reserved for temporal Execution Workflow |
| "Commit Definition" (draft type edit) | **"Save Type Definition"** (draft save) | commit ≠ Baseline; publishing a PWA version is the governed act |
| Generic placeholder types (Intent Definition, Functional Requirements, System Architecture, Module Implementation) | Real Product Realization PWU Types (§7/§10): Intent & Product Definition, Product Behavior Definition, Architecture Definition, … | Fidelity to the PWA |
| Sidebar "Portfolios" | **"Undertaking Portfolio"** (Undertakings context) | §37 naming |
| top-level nav | Two visibly-distinct contexts: **PWA Design** (PWA Library, PWA Designer) and **Undertaking** (Portfolio, Workbench, Execution, Assurance, Decisions, Baselines, Diagnostics) | §5, §35: reviewer must always know which level |

**Retained visual language (DESIGN.md):** dark-flux tonal layering (no-line rule → background shifts),
Space Grotesk / Inter / Source Code Pro, the token palette, glassmorphism for floating panels, canvas node
cards, right-side inspector, card grids, status bars. Ported to a Tailwind theme + Svelte 5 components.

## 4. Design assumptions honored (from OPEN-QUESTIONS — do not re-litigate)

- ControlAction: Canonical §37 authoritative; normalize §18 spellings (`normalizeControlAction`).
- `Decision.authority` is an `ActorReference`; authority is a caller-computed boolean via an injected authorizer port.
- Baseline items = `itemObjectVersions` (objectId + semanticVersion + contentHash).
- Baseline promotion gate: disposition ∈ {SATISFIED, WAIVED}; CONDITIONALLY_SATISFIED not yet promotable ("no green without assurance").
- Waiver = a `DECISION` of decisionType WAIVER (no standalone Waiver object).
- Retry cap (RPH-EXE-008) = MAX TOTAL ATTEMPTS, read from the plan RetryPolicy.
- INV-5 / property P1: `executionState=SUCCEEDED` MUST NOT imply `assuranceState=SATISFIED`.

## 5. Phase plan (P1–P12) — see TodoWrite for live status

- **P1 PWA-authoring context** — new package: contracts (aggregates + draft→publish FSM + commands/events via the
  vocab→gen pattern), domain guards (publish preconditions §20), handlers, persistence reuse, projections
  (Library / Overview / Work-Architecture / PWU-Type). Seed Product Realization PWA v1.3 from the ontology.
- **P2 Undertaking runtime handlers** — implement all ~40 contract commands as handlers over the existing kernels;
  add the 8 missing commands (BeginIntentDiscovery, StartAssuranceAssessment, MarkPwuSatisfied,
  RequestRuntimeBinding, AuthorizeRuntimeBinding, SubmitBaselineForReview, ApproveBaseline, Deny/RevokeRuntimeBinding)
  via vocab+gen; tighten execution sub-types. Each handler: load state → guard → transition → event → commit. Tested.
- **P3 Command registry** — replace the hardcoded CaptureIntent branch with `Map<commandType, Handler>`;
  a generic transition-applying handler for BINDINGS-driven commands + specific handlers where a kernel guard applies.
- **P4 Projection + query surface** — every RPH-DOC-010 view as a projector/query.
- **P5 Reference Undertaking fixture** — the full §30 FSM graph as a seed **command stream** (driven live, not a
  hand-authored event log) + the seed published PWA. This supersedes the terminal-only `referenceUndertakingGraph.ts`.
- **P6–P10 UI slices** (§47 order): concept separation → PWA inspection → Undertaking instantiation → PWA editing →
  migration/learning + Execution/Assurance/Decision/Baseline/Diagnostics contexts.
- **P11 Gate + conformance** — build/check-types/test/lint/boundary/format green; DOC-008 conformance; fast-check
  P1–P8; explicit §46 20-criteria acceptance checklist.
- **P12 Docs + memory + final commit + presentation.**

## 6. Acceptance

1. `bun run build` (incl. the app), `check-types`, `test`, `lint`, `boundary` (dependency-cruiser), `format:check` all green.
2. DOC-008 conformance suite + the conformance-manifest accounting gate pass; fast-check P1–P8 pass.
3. All 20 §46 UX acceptance criteria demonstrably hold (checklist in P11).
4. The complete §30 Reference Undertaking is driven **live** (commands → events → projections) end to end.
5. Browser bundle contains no `better-sqlite3` / `node:crypto`; `projections-browser-safe` rule holds.
