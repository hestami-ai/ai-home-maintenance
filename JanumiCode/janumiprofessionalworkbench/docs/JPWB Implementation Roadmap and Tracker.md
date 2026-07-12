# Janumi Professional Workbench (JPWB) — Implementation Roadmap & Tracker

> **Living document.** JPWB is the **Recursive Professional Harness (RPH) engine** — a deterministic,
> event-sourced domain core, built as a host-agnostic TypeScript library over better-sqlite3, consumed by
> downstream surfaces (VS Code extension, SvelteKit web + desktop, mobile) and destined to become the
> platform's `products/janumipwb/engine`.
>
> Authored 2026-07-10. Status legend: ⬜ not started · 🟡 in progress · ✅ done · ⏸️ deferred · ❌ dropped.

---

## 0. Sponsor decisions (locked 2026-07-10)

| # | Decision | Choice | Consequence |
|---|----------|--------|-------------|
| D1 | **Home & role** | JPWB **IS** the platform's engine; **incubate then port** | Build as a standalone Bun+Turborepo workspace here, then lift into `janumi/products/janumipwb/` to resolve the parked **M1** engine milestone. Conform to `@janumi` ports + Postgres-projection contracts from day one. |
| D2 | **Migration scope** | **Greenfield only** | No live legacy datastore. DOC-005 / DOC-009 §21–29 migration/dual-run/cutover apparatus **not built** (❌). Legacy phases survive only as a *derived, non-authoritative* compatibility projection. |
| D3 | **First increment DoD** | **Broader — include execution** | 0.1.x extends past intent→Architecture-Baseline through Maker/implementation execution, dynamic decomposition, runtime bindings, and restart recovery. Sequenced spine-first internally. |
| D4 | **Schema tech** | **Zod-as-source → JSON Schema** | `rph-contracts` authors Zod v4, generates JSON Schema Draft 2020-12 + TS types from one source. Matches the monorepo `packages/api-contract` chain. |

---

## 1. The load-bearing idea (do not lose this)

JPWB represents an undertaking as a **graph of persistent Professional Work Objects**, not a workflow. Its
single non-negotiable commitment is that **five professional concerns stay orthogonal**: **Shape** (what the
work is), **Execution** (did machinery run), **Assurance** (is completion justified by admissible evidence
under policy), **Governance** (who authorized, with what authority), **Baseline** (what is authoritative).

Every Professional Work Unit carries **four independent state axes** —
`workLifecycleState / executionState / assuranceState / shapeIntegrityState`. The canonical anti-collapse
rule the whole engine exists to guarantee:

> **`executionState = SUCCEEDED` MUST NOT imply `assuranceState = SATISFIED`** (INV-5 / property P1).

Validators only *recommend*; a separate **Assurance Service** sets the authoritative disposition; only a
**Governance Decision** exercises authority; only an **authorized, version-bound decision** promotes an
**immutable Baseline**. Aggregate assurance is the *strictest-unresolved* disposition — never a numeric
average. **The conformance tests (DOC-008), the invariant catalog (DOC-002), and the FSM reference fixture
(DOC-006) ARE the definition of done and outrank any implementation shortcut.**

---

## 2. Product identity & home (incubate → port)

- **Now (incubation):** a self-contained **Bun workspaces + Turborepo** monorepo rooted at
  `JanumiCode/janumiprofessionalworkbench/`, mirroring the platform's tooling so the eventual port is a move,
  not a rewrite. Packages scoped **`@janumipwb/rph-*`** (product scope = destination scope).
- **Later (port = platform M1):** lift `@janumipwb/rph-*` under `janumi/products/janumipwb/`, add the
  `DbosPorts` adapter + Postgres served-projection, wire Cerbos as the `CapabilityAuthorizer`. Because the
  engine is pure + ports-injected, the port is additive.
- **Contract alignment from day one** (so the port is clean):
  - Engine keeps **per-run better-sqlite3 as its working store**; **Postgres = served projection** (the
    platform's already-decided projection model — the reason better-sqlite3 was specified).
  - Host coupling flows through a ports seam that maps onto the platform's `EnginePorts`
    (`invokeLLM / runSandbox / persist / requestGovernance / emit / newId / now`).
  - Engine is **AGPL community core** — zero `ee/` coupling, no editor/UI/host assumptions.

---

## 3. Tech stack (pinned; proven-together across `janumicode_v2` + `janumi/`)

NOTA BENE: Wherever possible, be sure to use the component's official setup tools. E.g., with SvelteKit, use the sveltekit CLI tool to setup that environment.

| Concern | Choice | Notes |
|---|---|---|
| Runtime / PM | **Bun 1.3.14** | `bunfig.toml [install] linker="hoisted"`; **no** `trustedDependencies` override (breaks Prisma-style postinstalls). |
| Monorepo | **Turborepo** (`create-turbo`) | Scaffold via official CLI; strip example content. |
| Language | **TypeScript ^6** | `target ES2022`, `module/moduleResolution node16`, `strict`, `declaration + declarationMap` (library!). |
| Schema source | **Zod ^4** → JSON Schema | Single source per D4; JSON Schema Draft 2020-12, `additionalProperties:false`, `$id urn:janumi:rph:schema:<cat>:<name>:<ver>`. |
| Runtime validation | Zod (+ **ajv ^8** / `ajv-formats` for JSON-Schema-boundary checks if needed) | Validate at every write boundary. |
| Persistence | **better-sqlite3 ^12.8** (`@types/better-sqlite3 ^7.6`) | Synchronous single-writer; whole command pipeline in one `db.transaction()`. |
| Tests | **vitest ^4** + **fast-check** (property P1–P8) | Conformance suite is the CI gate. |
| Lint / boundaries | **eslint ^10** + typescript-eslint ^8 + **dependency-cruiser** | Enforce package layering + no-UI-in-core. |
| Ids | app-generated **prefixed ULID/UUIDv7** | `int_ pwu_ obl_ con_ asm_ clm_ evd_ pol_ assess_ obs_ dec_ art_ plan_ step_ bind_ base_ trace_ cmd_ evt_ attempt_`. |
| Hashing | **SHA-256 over canonical JSON** | Resolves the DOC-007 SHOULD/MUST gap; MUST for baseline items + admitted evidence. |

Scaffolding rule: **use official CLI scaffolders** (`create-turbo`, `bun init`) — do not hand-write configs.

---

## 4. Package architecture (10 engine packages + conformance)

| Package | Responsibility | Depends on |
|---|---|---|
| `@janumipwb/rph-contracts` | Zod schema **source** → TS types + JSON Schema. Envelope, 17 object types, command/event envelopes, all closed enums, `ApplicabilityExpression` DSL, error codes, id factories. | — |
| `@janumipwb/rph-ports` | Injectable interfaces: `StorageAdapter`, `EventSink/Outbox`, `IdentityProvider` (independence), `CapabilityAuthorizer` (→ Cerbos), `ArtifactStore`, `ContentHasher`, `Clock`, `IdGenerator`, `Logger`. | contracts |
| `@janumipwb/rph-domain` | Pure I/O-free kernel: state machines + guards, invariant predicates, decomposition obligation-conservation, semanticVersion-vs-revision rules. | contracts |
| `@janumipwb/rph-persistence` | better-sqlite3 adapter: registry + per-type tables + append-only events/versions + outbox + idempotency ledger + state-history + trace links, behind a dialect-neutral seam (Postgres later). | contracts, domain, ports |
| `@janumipwb/rph-assurance` | Policy registry, ValidatorContract/registry, admissibility (8 conditions), independence, strictest-unresolved aggregate disposition, waivers. Validators are ports. | contracts, domain, ports |
| `@janumipwb/rph-application` | Command bus (fixed 10-step pipeline), queries, idempotency, optimistic concurrency, atomic event+outbox, post-commit dispatch. | contracts, domain, assurance, persistence, ports |
| `@janumipwb/rph-controller` | The loop: read assurance recommendation → select one canonical ControlAction → re-dispatch. Reconciliation service. | contracts, domain, assurance, application |
| `@janumipwb/rph-projections` | Rebuildable read-models (Work/Execution/Assurance/Traceability/Change-Impact + derived Compatibility). Data only — never renders. | contracts, domain, persistence, ports |
| `@janumipwb/rph-product-realization-pwa` | Product Realization PWA ontology as **versioned data**: PWU Type / artifact-type templates, seed policies, roles, conformance profiles, legacy-phase mapping. | contracts |
| `@janumipwb/rph-engine` | Composition facade: `createEngine(deps) → EngineHandle` (the PWA ontology is injected). The single public seam. | all rph-* except product-realization-pwa (PWA injected as data) |
| `@janumipwb/rph-conformance` *(dev)* | FSM fixture (DOC-006) + 7-layer conformance suite (DOC-008) + property tests + builders/doubles. Runs against better-sqlite3 (Postgres parity optional). | rph-engine |

**Public API seam** (`EngineHandle`): `dispatch(command) → CommandResult` · `query(name, args)` ·
`getProjection(view, rootId)` · `subscribe(handler)` · `registerValidator(contract, transport)` ·
`loadOntology(profile@version)` · `rebuildProjections()`. **No CRUD; every write is a command. The engine
never renders** — "green node", canvas layout, and Playwright/webview tests are **surface** obligations.

---

## 5. M0 reconciliation ratify sheet *(first M0 work item — I own these; ratify, don't re-derive)*

The nine specs evolved by exploration and carry internal drift. Resolved by the docs' own authority
precedence (*domain invariants > fixture; assurance/authority > legacy phase; canonical semantics > DB/UI;
conformance tests > shortcuts*). **Status: ✅ RATIFIED 2026-07-10 — full detail in
[`docs/JPWB Reconciliation Ratify Sheet (M0).md`](JPWB%20Reconciliation%20Ratify%20Sheet%20(M0).md) (14
cross-doc conflicts resolved + 11 sponsor-open items in `docs/_working/OPEN-QUESTIONS.md`). Machine source:
`packages/rph-contracts/vocab/canonical-vocabulary.json`.**

| Item | Canonical resolution |
|---|---|
| Assurance enums | One frozen module. `WAIVED` = authoritative disposition/assessment-state **only**, never a validator recommendation. One "evidence-missing" token (`EVIDENCE_PENDING`) + explicit assessment-state→aggregate-disposition map. |
| ControlAction | Canonical **superset** + a normalization map from `AssuranceAssessment.recommendedControlAction` (RESHAPE/REPLAN) → controller actions (RESHAPE_PWU/REPLAN_EXECUTION). |
| TraceRelation | **DOC-007's 17-value set** is engine-canonical; Product Realization PWA edge names reduce to these; drop diagram-only edges. |
| Assumption status | **8-value** set incl. `UNDER_VERIFICATION` (DOC-002/007); correct DOC-001 §7.5. Preserve `ACCEPTED ≠ VERIFIED`. |
| Id scheme | Opaque prefixed-ULID (DOC-007). Human-readable strings (`FSM-ARCH-001`) are **display labels only**; reconcile fixture ids to one canonical form. |
| Version fields | Keep 4 distinct: `contractVersion`(str) / `schemaVersion`(int) / `semanticVersion`(int) / `revision`(bigint). Semantic-version-increment policy per DOC-009. |
| `workLifecycleState` coupling | **Controller-computed rollup** of the three sub-axes (sub-axes are independently-commanded facts); transition guards reference sub-axis preconditions so P1 holds and no contradictory composite state passes per-axis checks. |
| Command↔event↔transition | Produce one **explicit, testable binding table** (incl. condition-triggered exception transitions with no named command); reconcile name drift (`MarkPwuReady`↔`PwuMarkedReady`). |
| Content hash | **SHA-256 over canonical JSON**; MUST for baseline items + admitted evidence (resolve SHOULD/MUST). |
| ApplicabilityExpression | Adopt DOC-007's **code-free** op set (`ALL/ANY/NOT/EQUALS/IN/CONTAINS/EXISTS/RISK_AT_LEAST`); deterministic, serializable to a JSON column. |
| Policy registry | One versioned registry with stable ids on **DOC-004's 12 core policies**; DOC-003 per-PWU names = aliases. |
| Injected data (needs authoring, I draft for review) | (a) **risk→mandatory-policy** + **risk→independence-tier** matrix; (b) **missing policy criteria** (IP-* + ~8 policies lacking criteria/severity). |
| Injected ports (needs your platform to supply data later) | `IdentityProvider` (resolved agent/model/provider/org for independence) + `CapabilityAuthorizer` (authority verification → Cerbos). Engine defines the interface; platform supplies the adapter. |

---

## 6. Milestone roadmap

Internal sequencing is **spine-first** (walking skeleton → assurance/governance/baseline → then thicken into
execution/dynamic decomposition), even though the 0.1.x DoD (§7) spans through execution.

| M | Name | Goal | Key exit criteria (conformance ids) | Deps | Status |
|---|------|------|-------------------------------------|------|--------|
| **M0** | Contract tooling, envelope & id primitives | Zod-source pipeline emitting TS+JSON-Schema; ObjectEnvelope, ActorReference, AuthorityReference, ProvenanceRecord, id/version primitives; **the §5 ratify sheet**. | RPH-CON-001..004; codegen proves one source → TS+JSON-Schema; per-type valid/invalid battery. | — | ✅ |
| **M1** | Canonical domain model (17 objects) | All 17 object types as Zod+JSON-Schema; every closed enum; the ~30 named-but-undefined helper sub-schemas. | Every object validates min+full, rejects unknown props; all DOC-006 per-object fixtures validate (RPH-FIX-002). | M0 | ✅ (RPH-FIX-002 → M13) |
| **M2** | State machines (four PWU axes) | Transition tables + guards for all lifecycles; illegal transitions rejected; workLifecycleState rollup rule. | RPH-INT-001..007, RPH-PWU-001..010; §8.3 illegal transitions rejected; **P1** holds. | M1 | ✅ |
| **M3** | Command/event contracts + binding table | Command + immutable event envelopes; CommandResult set; RphError (15 codes); first-slice command/event payloads; the binding table. | RPH-CON-005..008; `ExecutionStepSucceeded` provably cannot set assurance SATISFIED. | M2 | ✅ |
| **M4** | Persistence core on better-sqlite3 *(walking skeleton)* | Event store + same-tx outbox + idempotency ledger + optimistic concurrency; `CaptureIntent→IntentCaptured→persist→outbox→projection` end-to-end. | RPH-PER-001..010; aggregate replay == materialized state; DOC-009 CONF-10. | M3 | ✅ |
| **M5** | Read projections (rebuildable) | Work/Execution/Assurance/Traceability/Change-Impact + derived Compatibility; checkpoints; full rebuild. | RPH-PER-007/009, RPH-PRJ-001..005, RPH-CMP-001..004; commands never validate against projections. | M4 | 🟡 (framework + Work view + green-node done; other views fill in with M6/M7/M11 events) |
| **M6** | Traceability + impact/invalidation | 17-relation trace graph + directionality; intent→baseline path; conservative invalidation cascade. | RPH-TRC-001..005; DOC-006 CT-3/CT-10; **P4**. | M4 | ✅ |
| **M7** | Assurance subsystem | Policy registry, ApplicabilityExpression evaluator, ValidatorContract, assessment FSM, admissibility, independence, strictest-unresolved disposition, waivers, boundary rejection. | DOC-004 Tests 1–12; INV-1..20; RPH-ASR-001..012, RPH-EVD-001..007. | M4, M6 | 🟡 (rule library done: DSL, disposition ladder, strictest-unresolved, admissibility, independence, waivers, validator-classification; PolicyRegistry + AssuranceService orchestration → M10/M13) |
| **M8** | Product Realization PWA ontology + seed policies | Versioned templates; the 6 FSM-fixture seed policies fully authored; conformance-profile applicability. | DOC-003 OVR-1..10 + §46; RPH-FIX-004; assessments always cite a policy version (INV-11). | M7 | ✅ (6 of 12 core policies seeded; rest authored later) |
| **M9** | Decomposition/recomposition + obligation·constraint·assumption | Obligation-conservation gate; recomposition conflict resolution; assumption reification; **dynamic decomposition** (D3). | RPH-DEC-001..007, RPH-CNS-001..004, RPH-ASM-001..006; **P2/P3** (the doc ids are Property P2/P3 §25 + the RPH-DEC/CNS/ASM tests — the earlier "CT-2/CT-4" placeholders don't exist in the specs). | M8 | ✅ (kernel + adversarial-reviewed; commands/BINDINGS wiring → M10/M11) |
| **M10** | Controller, governance & baseline promotion | Controller decision sequence; ControlAction superset; authority-verified decisions (version-bound); immutable baseline gate. | RPH-GOV-001..007, RPH-BAS-001..007; **P5/P7** (CT-5/6/8/9 are placeholder names; real ids are the RPH-GOV/RPH-BAS tests). | M9 | ✅ (executable kernel + adversarial-reviewed; command handlers → M11/M13) |
| **M11** | Execution model, runtime bindings & restart recovery | Static + governed execution plans; runtime-binding authorization; **Maker/implementation execution**; reconcile uncertain side-effects on restart. | RPH-EXE-001..009, RPH-PER-011..014; RPH-E2E-006 (restart, no duplicate side-effects); **P1/P6** (exec≠assurance is P1; P6 idempotency). | M10 | ✅ (execution kernel + adversarial-reviewed; handler-registry + command handlers + sub-type tightening → M13) |
| **M12** | Executable conformance suite (7 layers) | Full DOC-008 taxonomy + property P1–P8 + builders/doubles + mutation testing on critical handlers; CI gate. | DOC-008 DoD (all 17 items); CI fails on any single invariant violation. | M2,M4,M5,M6,M7,M9,M10,M11 | ✅ core (property P1–P8 + 7-layer taxonomy accounting-gate + adversarial-reviewed; builders/doubles + mutation-testing + closing PER/E2E/FIX → M13) |
| **M13** | Reference Undertaking replay (FSM) | Seed/Replay/Conformance modes over the 72-step trace; intent→Architecture-Baseline proven; root PWU legitimately incomplete. | DOC-006 §33 (15 criteria) + CT-1..10; RPH-FIX-001..006; RPH-E2E-001; DOC-009 §44. | M12 | ✅ core (rph-engine facade + event-history replay conformance over the 72-step trace: RPH-FIX-001..006 + P1/P5/P6; live-command-drive handlers deferred) |
| **M14** | Demonstration UI — PWO graph (Svelte Flow) | A purpose-built **SvelteKit surface** (scaffold via `sv create`) using **Svelte Flow (`@xyflow/svelte`)** to visualize the Professional Work Object graph and let users view / edit / interact — drive commands, inspect assurance, adjudicate governance decisions — as a demonstration and to capture human feedback. A **client surface, outside the engine**: consumes only the `rph-engine` public seam (`getProjection` / `subscribe` / `dispatch`); renders nothing inside `rph-*`. | Renders the FSM-fixture graph; a human drives the full 0.1.x loop through the UI (approve intent → review CONDITIONALLY_SATISFIED → approve/reject decision → see baseline); surface enforces *no-green-without-assurance* (execution vs assurance visually distinct); zero UI ↔ rph-core-internal imports. | M13 (renders M5 projections) | ✅ core (rph-engine graph-view projection [tested] + apps/rph-demo SvelteKit + Svelte Flow surface over the engine seam, no-green-without-assurance visualized; UI not build-verified headless) |
| **MP** | **Port to platform** (resolves M1) | Lift `@janumipwb/rph-*` into `janumi/products/janumipwb/`; add `DbosPorts` + Postgres projection adapter + Cerbos authorizer; run conformance for parity. | Conformance suite green against the Postgres adapter; engine consumed by the control-plane host. | M13 | ⏸️ (post-0.1.x) |
| ~~(dropped)~~ | ~~Legacy migration/dual-run/cutover~~ | — | **Dropped (D2 greenfield).** DOC-005/DOC-009 migration = conceptual compatibility projection only. | — | ❌ |

---

## 7. First increment (0.1.x) — Definition of Done

> This is the **scope** DoD for the 0.1.x increment. The **per-change / per-milestone** engineering DoD
> (tests, observability, comments, SonarQube) lives in §11.3.

Per **D3 (broader — include execution)**, 0.1.x proves the full professional loop end-to-end:

1. **Spine (M0–M10, M12–M13):** raw request → `CaptureIntent` → `FormalizeIntent` → `ApproveIntent`
   (Intent Fidelity + Completeness assessments) → **Intent Baseline** → `ProposePwu` (Architecture PWU) +
   validated `DecompositionContract` → execution step produces an Architecture Artifact
   (`executionState=SUCCEEDED`) → Assumption Disclosure reifies material assumptions → Architecture Coverage
   assessment returns **CONDITIONALLY_SATISFIED** with an OPEN observation (**proves execution≠assurance**) →
   governed human `ApproveDecision` bound to the exact architecture `semanticVersion` → **PromoteBaseline**
   to an immutable Architecture Baseline pinned by `id + semanticVersion + contentHash`. Validated by the FSM
   fixture's 72-step trace in replay/conformance mode (M13).
2. **Execution extension (M9-dynamic + M11):** dynamic decomposition of the architecture into implementation
   PWUs; runtime bindings authorized (requested ≠ granted capabilities); Maker/implementation execution
   attempts with idempotency + external-operation reconciliation; **restart mid-execution reconciles with no
   duplicate side-effects** (RPH-E2E-006). *This extends beyond the canonical fixture, so it carries its own
   conformance targets (RPH-EXE-*, RPH-PER-011..014).*
3. **Demonstration surface (M14):** a SvelteKit + Svelte Flow client that renders the PWO graph and lets a
   human drive and adjudicate the loop end-to-end — the channel through which the *human feedback* the
   governed loop depends on actually arrives. A client only: consumes the `rph-engine` public seam and holds
   no engine logic.

**Explicitly out of 0.1.x:** multi-tenant runtime isolation, autonomous privilege changes, confidence
fusion, user-authored ontologies, marketplace templates, the Postgres/DBOS port (MP), and any migration
apparatus (D2).

---

## 8. Coverage rollup (every spec doc → milestones; nothing orphaned)

| Doc | Title (short) | Primary milestones |
|---|---|---|
| RPH-DOC-001 | Migration / Architecture & Feature Spec | Scope contract for **all**; §20 invariants → M2/M7/M10 |
| RPH-DOC-002 | Canonical Domain Model, Invariants, FSMs, Events | M1, M2, M3, M6 |
| RPH-DOC-003 | Product Realization PWA Ontology & Assurance Policy Spec | M8 (+ M9 templates) |
| RPH-DOC-004 | Assurance Policy Catalog & Validator Contract | M7 (+ §5 policy registry) |
| RPH-DOC-005 | Semantic Inventory & RPH Conformance Mapping | M5 Compatibility projection (**conceptual only**, D2) |
| RPH-DOC-006 | Reference Undertaking (FSM fixture + event trace) | M13 (fixtures used from M1 onward) |
| RPH-DOC-007 | Command/Event/Schema Contract Package | M0, M1, M3 |
| RPH-DOC-008 | Executable Invariant & Conformance Tests | M12 (test ids referenced throughout) |
| RPH-DOC-009 | Persistence, Migration, Dual-Run, Cutover | M4 (target-state persistence); §21–29 **dropped** (D2) |

---

## 9. Critical path & top risks

**Critical path:** M0 → M1 → M2 → M3 → **M4 (walking skeleton)** → M7 → M9 → M10 → M13 → *(then M11 execution
extension)* → MP.

**Top risks (mitigation):**
1. **State-axis coupling** — resolved in §5 (rollup rule); lock before M2.
2. **Postgres-shaped persistence on single-writer SQLite** — re-realize outbox/optimistic-concurrency/
   single-authority at the application level behind the dialect-neutral adapter; keep a written portability
   contract to Postgres/RLS. De-risk first in M4.
3. **Enum/vocabulary drift across 9 docs** — the §5 ratify sheet is the M0 gate; build no tables before it closes.
4. **ApplicabilityExpression DSL** — must be deterministic, serializable, host-access-free (M0/M7).
5. **Independence enforcement** needs resolved runtime identity the engine doesn't own — define the
   `IdentityProvider` port + risk→independence matrix early (M0/M7).
6. **Content-hash canonicalization** — fix the algorithm now (§5); it underpins baseline binding + evidence integrity.
7. **UI/host leakage** — dependency-cruiser rule: `rph-*` core may not import any UI/editor/host module.

---

## 10. Progress log

- **2026-07-10** — Reviewed all 9 RPH specs (parallel deep-read + synthesis). Locked sponsor decisions
  D1–D4. Authored this roadmap & tracker. Added M14 (Svelte Flow demonstration UI). Adopted the v2
  Engineering Constitution with library interpretations (§11).
- **2026-07-10 — M0 COMPLETE ✅** (autonomous build; own git repo, no push). Scaffolded Bun 1.3.14 +
  Turborepo workspace + toolchain (tsconfig/eslint/prettier/dependency-cruiser/CI/sonar). Extracted +
  reconciled the canonical vocabulary (pass; 84 enums / 22 id prefixes / 16 error codes / 22 envelopes)
  → `packages/rph-contracts/vocab/` + §5 ratify sheet. Built `@janumipwb/rph-contracts` (content hash,
  generated enums, ids, errors, version quartet, envelopes, validation, JSON-Schema emit → 80 committed
  schemas) and `@janumipwb/rph-ports` (Logger). **120 tests pass** (RPH-CON-001/002/004 + enum/JSON-Schema
  fidelity via ajv + hash/ids/errors/validate/logger); build/check-types/lint/boundary/format all green.
  Commits `c62fb78`→`df2e7e7`. 
- **2026-07-10 — M1 COMPLETE ✅** (`2fbfc27`). Grounded field extraction of all 17 object types (DOC-002
  prose + DOC-007 serialized) → `vocab/m1-object-fields.json`; `objects.ts` GENERATED (17 schemas composing
  the envelope + 8 full helpers + 40 permissive placeholders for the helper types the specs
  reference-but-never-define — documented, not fabricated). 143 tests (per-object field-fidelity + representative
  validation); registry = 97 schemas. RPH-FIX-002 (DOC-006 fixtures validate) deferred to M13.
  **Next:** M2 — `rph-domain` state machines (4 PWU axes + all lifecycle guards; illegal-transition rejection).
- **2026-07-11 — M2 COMPLETE ✅** (`1532d31`). Grounded extraction of all **23 lifecycle state machines**
  (DOC-002 + DOC-004 assurance FSM) → `rph-domain/vocab/m2-transitions.json`; `transitions.data.ts` GENERATED.
  `stateMachine.ts` = generic guard engine (classify/can/assertTransition, fail-loud
  RPH_ILLEGAL_STATE_TRANSITION); `pwuGuards.ts` = PWU cross-axis guards enforcing **property P1/INV-5**
  (execution success never implies assurance satisfaction). Codegen handles umbrella-state expansion,
  cross-axis-rule lifting, and guarded-vs-absolute-illegal split. 36 tests (179 total); all gates green.
  **Next:** M3 — command/event payload contracts + the command↔event↔transition binding table.
- **2026-07-11 — M3 COMPLETE ✅** (`dd6fc0f`). Grounded extraction of DOC-007 §32/§33 + DOC-002 §26 →
  `vocab/m3-commands-events.json` (43 commands, 98 events, 43 bindings). `messages.ts` GENERATED — payload
  schema per command/event + `COMMANDS`/`EVENTS`/`BINDINGS` registries (registry now 238). RPH-CON-008 proven
  (ExecutionStepSucceeded payload has no assurance field). NEW M3↔M2 integration guard: every first-slice
  binding transition is legal in the state machines. 185 tests; all gates green.
  **Next:** M4 — persistence core on better-sqlite3 (event store, outbox, idempotency, optimistic concurrency) — the walking skeleton.
- **2026-07-11 — M4 COMPLETE ✅ (WALKING SKELETON) (`932482c`).** Two new packages: `rph-persistence`
  (`SqlDriver` seam over better-sqlite3; SQLite event-sourced-with-current-state schema; `SqliteStorageAdapter`
  implementing the NEW `StorageAdapter` port — atomic commit, optimistic concurrency, idempotency, outbox,
  replay) + `rph-application` (`Engine.dispatch` pipeline + `drainOutbox`). **CaptureIntent flows end-to-end**
  (validate → IntentCaptured → persist events+outbox+receipt atomically → drain → projection), with idempotent
  DUPLICATE, RPH_REVISION_CONFLICT, and VALIDATION_FAILED all proven. Driver note: better-sqlite3 works in
  vitest/Node; Bun is only the task runner (OPEN-QUESTIONS §C). 196 tests; all gates green.
  **Next:** M5 — rebuildable read projections (Work/Execution/Assurance/Traceability/Change-Impact/Compatibility).
- **2026-07-11 — M5 CORE 🟡 (`64832fd`).** New `rph-projections` package: rebuildable projection framework
  (`Projector` fold, deterministic `rebuildProjection` = RPH-PER-007, idempotent `IncrementalProjection`) +
  the Work view (4 PWU axes distinct + `isQualifiedSuccess` = the no-green-without-assurance rule). 6 tests;
  202 total. Remaining views (Execution/Assurance/Traceability/Change-Impact/Compatibility) are
  framework-ready and backfill as M6/M7/M11 emit their events. **Next:** M6 — typed traceability + impact/invalidation.
- **2026-07-11 — M6 COMPLETE ✅ (`472c9d5`).** `rph-domain/traceability.ts`: TRACE_DIRECTIONALITY (17
  relations, §25.1) + validated immutable TraceGraph + findPath; 7-value ImpactClassification +
  evidence-invalidation cascade (CT-10/P4 — supported claims → REVALIDATION) + conservative downstream impact.
  9 tests; 211 total. **Next:** M7 — assurance subsystem (policies, validator contract, DSL evaluator,
  disposition engine).
- **2026-07-11 — M7 CORE 🟡 (`84d5360`).** New `rph-assurance` package: the code-free ApplicabilityExpression
  DSL evaluator + the assurance rule library (disposition precedence ladder; **strictest-unresolved aggregate,
  never a numeric average**; 8-condition evidence admissibility; multi-dimensional independence; exact
  waiver version-binding; VALIDATOR_FAILED/BOUNDARY_REJECTED ≠ disposition-REJECTED). 26 tests; 237 total.
  PolicyRegistry + AssuranceService orchestration integrates in M10/M13; seed policies in M8.
  **Next:** M8 — Product Realization PWA ontology package + seed assurance policies.
- **2026-07-11 — M8 COMPLETE ✅ (`dfb472e`).** New `rph-product-realization-pwa` package: the ontology as versioned data
  (14 PWU templates incl. PRODUCT_REALIZATION root; 6 fully-specified seed policies; 3 conformance profiles;
  compatibility-phase map) + accessors + `validateOntology` (OVR integrity; policy refs resolve across the
  `_vN` version suffix, INV-11). 6 tests; 243 total. (6 of 12 core policies seeded; rest authored later.)
  **Next:** M9 — decomposition/recomposition + obligation·constraint·assumption enforcement.
- **2026-07-11 — M9 COMPLETE ✅ (`8ab509b` kernel, `aa7ae7c` review fixes, `10f9259`/docs).** New
  `rph-domain/src/decomposition.ts` pure kernel: obligation conservation (P2/RPH-DEC-002/007), constraint
  5-disposition **per-relevant-child** non-drop (P3/RPH-CNS-001..004/RPH-DEC-003), recomposition conflict
  resolution (§14.1/RPH-DEC-005/006 — CONFLICTED though children satisfied), assumption reify-or-reject gate
  + lifecycle predicates (RPH-ASM-001..006), and `validateDecomposition` composing all with the §13.2
  parent-PLANNED gate. Grounded via a 3-reader resolve pass; **audited by a 5-lens adversarial-review
  pass (24 agents)** that confirmed 3 defects (per-child constraint drop HIGH, reify-gate MEDIUM, expired-
  waiver LOW) — all fixed — and refuted 16. Also tightened 6 rph-contracts placeholder sub-schemas (generator
  FORCE_FULL + inline z.enum) so the real fixture sub-instances validate. **Fixed an upstream M2 generator
  defect:** slash-compound transition sources (`ACTIVE/ALLOCATED→…`) were silently dropped — 25 legal edges
  across 16 machines restored. 271 tests; all gates green. Commands/BINDINGS wiring deferred to M10/M11.
  **Next:** M10 — Controller, governance decisions & baseline promotion.
- **2026-07-11 — M10 COMPLETE ✅ (`8bb3e05` kernel, `5d63799` review fixes, `4c84ae5`/docs).** New
  `rph-domain/src/governance.ts` makes the previously TEXT-ONLY Decision/Baseline machine guards +
  CROSS_AXIS_RULES prose EXECUTABLE: authority verification (RPH-GOV-001/002), version-binding
  (RPH-GOV-003 / Property P5), waiver scope + expiry + override-preserves-findings (RPH-GOV-004/005/006,
  RPH-CNS-004), the full baseline-promotion gate (RPH-BAS-001..004, §15.2, "no green without assurance"),
  immutability/supersession (Property P7 / RPH-BAS-005/007), revocation impact (RPH-GOV-007), and controller
  control-action selection (§37 normalize + no-fabricated-order decisive selection). Grounded via a 3-reader
  pass (`vocab/m10-governance.json`); reuses existing Decision/Baseline schemas + machines. **Adversarially
  reviewed (4-lens/22-agent pass)** — confirmed 2 defects (invented control-action precedence, RPH-GOV-004
  uncovered), both fixed; refuted 16. 290 tests; all gates green. Baseline lifecycle commands+BINDINGS deferred
  to M11/M13 (events + machines exist; commands need handlers).
  **Next:** M11 — Execution model, runtime bindings & restart recovery.
- **2026-07-11 — M11 COMPLETE ✅ (`8f4c92d` kernel, `75cb61b` review fixes, `2d07627`/docs).** New
  `rph-domain/src/execution.ts` makes the PROSE-ONLY ExecutionPlan/ExecutionStep/RuntimeBinding machine guards
  EXECUTABLE: plan lifecycle (RPH-EXE-001 one-active-plan, RPH-EXE-002 no-step-under-superseded, RPH-PWU-010
  baselined-no-resume), runtime binding (RPH-EXE-003 authorized-before-execute, RPH-EXE-004 requested≠granted),
  step (RPH-EXE-005 precondition gate, RPH-EXE-006 explicit result, canSkipStep §21.1, RPH-EXE-009 untrusted
  output), retry cap (RPH-EXE-008 → alternate control action on exhaustion), exec≠assurance (Property P1 /
  RPH-PWU-005/007 — success routes to EVIDENCE_PENDING never SATISFIED, reuses pwuGuards), and restart
  reconciliation + idempotency (RPH-PER-012 classify-don't-blindly-retry with reconciled-external-status
  authoritative, RPH-PER-002 command idempotency, RPH-EXE-007 attempt-level side-effect idempotency).
  Grounded via a 3-reader pass (`vocab/m11-execution.json`); reuses existing execution schemas + machines.
  **Adversarially reviewed (4-lens/17-agent pass)** — confirmed 3 defects (unsafe restart conflict-
  classification, missing attempt-level idempotency, missing skip-mandatory guard), all fixed; refuted 9.
  311 tests; all gates green. **Deferred to M13:** the Engine handler-registry + execution/RuntimeBinding
  command handlers + execution sub-type tightening (exercised end-to-end by the Reference Undertaking replay).
  **Next:** M12 — Executable conformance suite (7 layers) + property tests P1–P8.
- **2026-07-11 — M12 CORE COMPLETE ✅ (`e299fdf` core, `5be2d06` review fixes, `6599855`/docs).** Grounded via
  a 3-reader pass (`vocab/m12-conformance.json`: §3 7-layer taxonomy, 125 RPH-* rules across 17 prefixes,
  Properties P1–P8, 9 mutations, + a coverage map of the 199 pre-existing tests). Added: **property tests
  P1–P8** via fast-check@4.9.0 (300 runs each — exec≠assurance, obligation-conservation, constraint-non-drop,
  evidence-invalidation, version-binding, idempotency, baseline-immutability, presentation-independence); the
  **P8 predicate** (`presentation.ts` — the one previously-uncovered property); and the **conformance GATE**
  (`conformance-manifest.ts` + `conformance.test.ts`) that loads the 125-rule catalog and FAILS CI on any
  UNACCOUNTED rule — an honest COVERED/PARTIAL/DEFERRED overlay + a cited-test-file-exists check. **Adversarially
  reviewed (2-lens/21-agent pass)** — confirmed 15/19 (4 weak properties + manifest over-claims), all fixed
  (properties now exercise both branches; over-claimed families honestly downgraded to PARTIAL). 327 tests;
  all gates green. **Deferred to M13:** builders/doubles, mutation-testing (stryker), and closing the
  RPH-PER/E2E/FIX families via the replay harness; the `rph-engine`/`rph-conformance` packages.
  **Next:** M13 — Reference Undertaking (FSM) replay: seed/replay/conformance modes.
- **2026-07-11 — M13 CORE COMPLETE ✅ (`4fddc82`).** NEW package `@janumipwb/rph-engine` — the single public
  seam: `createEngine(deps)` composes contracts + persistence + application + projections + domain + product-realization-pwa
  (validated fail-loud); drives the walking-skeleton flow through the facade. The **Reference Undertaking replay**
  (the headline): `fixtures/expected-events.jsonl` (the authored 72-step §26 trace) + `replay.ts` seed/replay/
  conformance modes. Conformance replays the trace and asserts, from the event history + the contract event
  catalog: RPH-FIX-001 (contiguous), RPH-FIX-002 (every event is a registered contract), RPH-FIX-003a/b/c (both
  baselines promoted; ends AUTHORITATIVE Architecture Baseline + BASELINED Architecture PWU; Behavior PWU
  satisfied-not-baselined), P1 (exec-success-never-implied-assurance via the ConditionallySatisfied-before-
  baseline ordering), RPH-GOV-003/P5 (version-bound approval before authoritative baseline), RPH-FIX-006
  (offline residual represented), RPH-PER-002/P6 (idempotent double-replay). Closed RPH-FIX-002 by adding the
  4 fixture-trace events the catalog lacked (98→102 events; registry 238→242). 335 tests; all gates green.
  **Deferred (remaining M13 depth):** the live-command-drive replay = a command-bus handler-registry refactor +
  the ~20 deferred M9/M10/M11 handlers + 8 missing commands + execution sub-type tightening.
  **Next:** M14 — Demonstration UI (SvelteKit + Svelte Flow) over the rph-engine seam.
- **2026-07-11 — M14 CORE COMPLETE ✅ (`a0d46b1`).** Engine seam (tested): `rph-engine/src/graph-view.ts`
  `buildReferenceUndertakingGraph()` → UI-ready PWU nodes (4 axes + no-green-without-assurance via
  `isQualifiedSuccess`) + edges + open residuals; 5 tests. UI: `apps/rph-demo` — a SvelteKit + `@xyflow/svelte`
  client surface consuming ONLY the engine seam (`src/lib/toFlow.ts` → Svelte Flow nodes/edges with state-driven
  colour: green=qualified, amber=succeeded-but-unassured, indigo=baselined). Runs `npm install && npm run dev`.
  Kept OUTSIDE the root gate (a demonstration surface; depcruise scans `packages/` only; the forbidden
  packages→apps edge keeps the engine UI-agnostic). 340 tests; all gates green. (UI not build-verified in this
  headless env; the graph-view data the demo UI renders IS unit-tested.)
  **STATUS: all 14 milestones (M0–M14) have a delivered, gate-green increment. 13 packages, 338 tests.**
  Remaining depth is documented per-milestone in OPEN-QUESTIONS (chiefly the M13 live-command-drive handlers,
  the M12 builders/doubles + mutation-testing, and the 6-of-12 M8 core policies) — none blocking.
- **2026-07-12 — CHARTER VOCABULARY REMEDIATION ✅ (housekeeping, post-M14).** Aligned all generated artifacts to
  the ratified **Product Architecture & Canonical Vocabulary Charter (RPH-DOC-000)**. (1) Renamed package
  `@janumipwb/rph-product-lens` → **`@janumipwb/rph-product-realization-pwa`** (`Product Lens` retired →
  **Product Realization PWA**): directory (`git mv`), identifiers (`PRODUCT_REALIZATION_PWA_ONTOLOGY`,
  `RPH_PRODUCT_REALIZATION_PWA_VERSION`), all importers, the `ontologyId` data value, the dependency-cruiser
  regexes, and the generator. Regenerating was deterministic and incidentally **reconciled two stale schemas**
  (`DecompositionContract`/`RecompositionContract` still held the pre-M9 permissive placeholder). (2) **JPW →
  JPWB** everywhere; renamed the two `JPW …` docs → `JPWB …`. (3) Reworded build-tooling "workflow" → "pass"
  (reserving "workflow" for the temporal **Execution Workflow**). (4) Repointed 6 vocab files' spec references to
  the sponsor's renamed specs. (5) **Structural fix** (charter: the engine never renders; a UI consumes only a
  pure seam): relocated the pure `graph-view.ts` View seam from the Node facade `rph-engine` → **`rph-projections`**
  (browser-safe read-model) and repointed `apps/rph-demo` onto it — the **demo now builds** (`vite build` had been
  failing because the engine dragged `better-sqlite3`/`node:crypto` into the browser bundle). Added a
  `projections-browser-safe` boundary rule; dropped the now-dead `rph-engine → rph-projections` dependency.
  Vetted by 3 charter-conformance review agents; findings applied. **340 tests; check-types / test / lint /
  dependency-cruiser green; `bun run build` green incl. `rph-demo`.** Flagged for sponsor (OPEN-QUESTIONS §R):
  (C1) the hardcoded Reference Undertaking *instance* graph still lives in a reusable package; (C2) `rph-engine`
  defaults to one specific PWA; (C4) `rph-contracts` leaks `node:crypto` through its barrel.
- **2026-07-12 (after sponsor review) — C1 + C2 APPLIED ✅.** Sponsor resolved the §R design questions. **C1:**
  moved the hardcoded field-service Undertaking *instance* out of the reusable package to
  `apps/rph-demo/src/lib/referenceUndertakingGraph.ts` (demo seed data); `rph-projections/graph-view.ts` now
  exposes only the reusable seam — the View types + the `pwuGraphNode()` builder — whose test asserts the INV-5
  no-green-without-assurance rule across five branches (the 5 instance-shape assertions became demo seed data →
  **340 → 338 tests**, stronger invariant coverage). **C2:** `createEngine({ ontology, … })` now **requires** an
  injected PWA; `rph-engine` imports no concrete PWA (`EngineOntology` = generic structural type), and
  `@janumipwb/rph-product-realization-pwa` moved to a **devDependency** (the engine test is the composition root);
  validation = a generic root-cardinality gate + an optional injected `validateOntology()`. **C4 (also DONE —
  Option 1):** dropped `hash.js` from the `rph-contracts` barrel, exposed it as **`@janumipwb/rph-contracts/hash`**
  (package `exports` subpath), and repointed the one importer (`command-bus.ts`). The contracts barrel is now
  browser-safe (verified: its `dist/index.js` re-exports no hash module → no `node:crypto` in its import graph);
  `contentHash` stays synchronous. Breaking: import hash symbols from the `/hash` subpath. All gates green incl.
  `bun run build` + `rph-demo`; 338 tests.

---

## 11. Engineering Constitution (adopted — with library interpretations)

This section is **the operating standard I (the coding agent) follow while building JPWB** — how I write
code, comments, tests, and diagnostics as I work each milestone (M0→M13). It is my working discipline, **not**
a description of RPH's domain semantics. The **JanumiCode v2 Engineering Constitution**
(`JanumiCode/janumicode_v2/docs/JanumiCode v2 Engineering Constitution.md`) — its four parts
(**Commenting**, **Debugging & Observability**, **AI-Native Testing**, **Code Quality / SonarQube**) — is
**adopted as binding** for that work. It applies verbatim except where JPWB is a **host-agnostic library, not a
running service** (§11.2 makes those judgment calls explicit). The constitution supplies the *how* of
building; the specs (DOC-002/004/008) supply the *what* to build.

### 11.1 Leverage points (the architecture lowers the cost of meeting the standard — it does not excuse skipping it)

I apply every practice regardless. These are places where JPWB's design happens to give me the
constitution's *outcome* with little extra ceremony, so I lean on them deliberately — leverage, not a waiver:

| Constitution practice I follow | Design leverage I use to meet it |
|---|---|
| "Reconstruct behavior from emitted evidence" (observability) | **Event sourcing** — the append-only `domain_events` + `AssuranceObservation`s I write are already durable, replayable, queryable evidence. |
| "Trace decisions, not just failures" | I model each decision as a **first-class object/event** (assessment, observation, control-action record, governance decision) recording trigger/evidence/authorizing-policy/actor. |
| "Typed & classified errors" | I return **`RphError` + its 15 frozen codes** (VALIDATION / AUTHORIZATION / STATE_TRANSITION_DENIED / IDEMPOTENCY_CONFLICT / **INVARIANT_VIOLATION** / RETRY_EXHAUSTED / MODEL_OUTPUT_INVALID …); §5 aligns the names to the constitution's taxonomy. |
| "Fail loudly on invariants; never silently repair state" | My command pipeline **rejects + emits no event** on violation; I never write silent state repair (INV-5 / P1). |
| "Every bug becomes a permanent test / replay test" | I turn a failing scenario into a **Seed/Replay/Conformance** fixture (M13) rather than a one-off. |
| "Correlation IDs everywhere" | I propagate `correlationId` / `causationId` through the **command + event envelopes**. |
| The evidence pyramid | I build to **DOC-008's 7-layer conformance taxonomy + property tests P1–P8** (M12). |

### 11.2 Library interpretations (the judgment calls)

| Constitution pillar | Verdict for JPWB | Interpretation |
|---|---|---|
| **Observability — traces/metrics/OTel** | **Adapt** | **No OTel collector, no metrics backend, no HTTP health/readiness endpoints in the engine.** Logging goes through an injected **`Logger` port** (leveled debug/info/warn/error/fatal, structured records) — default **no-op**; the *host* wires console/pino/OTel. The engine's **events + observations are the primary telemetry**; metrics are **derived by the host** from projections/events (e.g. open-observation counts by severity are projection data), never pushed by the library. |
| **Health / readiness checks** | **Defer to host** | An embedded library has no service to probe. The `StorageAdapter` may expose a cheap **integrity/self-check**; liveness/readiness/dependency-health belong to the platform host at **MP**. |
| **Correlation IDs** | **Adopt (native)** | Envelope `correlationId`/`causationId`; every command→event→projection hop is traceable without a tracing backend. |
| **Structured logs at boundaries** | **Adopt** | Log via the `Logger` port at the trust boundaries the engine owns: command ingress, validator/`CapabilityAuthorizer`/`ArtifactStore`/`StorageAdapter` port calls, state transitions, idempotency/dedup, invariant checks. **Structured records only; never prose; never secrets/PII/raw payloads.** |
| **AI-Native Testing pyramid** | **Adopt = M12** | DOC-008's 7 layers + property tests (fast-check, P1–P8) + typed builders + the doubles roster. **Real better-sqlite3 (`:memory:`) over mocks** for integration. Every fixed bug adds a conformance/replay fixture. |
| **AI-specific tests (prompt-regression, agent-trajectory)** | **Out of core** | The **engine calls no LLM** — validators/executors are ports. Prompt/trajectory tests live in the **host/adapter** repos. The core instead tests **untrusted validator/model output** via doubles (malformed / contradictory / timeout / same-agent independence-violator) → the `VALIDATOR_FAILED` boundary-rejection path. "Treat model output as untrusted" = the ValidatorResult schema-boundary rejection. |
| **Chaos / resilience (Layer 9)** | **Adapt** | For a library: **restart/crash reconciliation** (RPH-E2E-006), duplicate events, malformed inputs, uncertain external side-effects — *not* infra chaos. |
| **Production validation (Layer 10)** | **Defer to host** | Belongs to the platform host at MP; the library's equivalent is **deterministic replay** (M13). |
| **Commenting standard** | **Adopt fully** | The Invariant / Boundary / Tradeoff / Context comment taxonomy fits a spec-dense engine. Cite the **smallest useful fragment** of a `DOC-###`/`INV-#`/`RPH-*` test id (the constitution's "US-142 AC-3" pattern → our RPH ids). `TODO(JPWB-###)` with owner/reason/risk/resolution. No comment drift. |
| **Code quality / SonarQube** | **Adopt fully** | Run SonarLint/SonarQube headless per the v2 remediation guide (see [[project_sonarlint_headless_driver]]). **Complexity findings addressed fully** (NOTA BENE). Wire into CI from **M0**. `dependency-cruiser` additionally enforces package layering + **no-UI/host-in-core**. |
| **Secrets in code/logs/comments** | **Adopt (native)** | The engine holds **no secrets** (BYOK / host-injected); nothing to leak. Logger records are structured + redacted by contract. |

### 11.3 Definition of Done — per change / per milestone

Distinct from the *increment* DoD (§7). Every JPWB change (and every milestone exit) must satisfy:

- **Evidence:** requirements implemented deterministically **with tests** — unit + property/invariant, and
  integration / contract / boundary / **state-transition** where applicable; the relevant **`RPH-*`
  conformance ids** referenced (per §6).
- **Observability:** structured `Logger` events + domain events/observations at every boundary, transition,
  and decision the change touches; errors are **typed `RphError`s**; invariants **fail loud**, never silently repair.
- **Comments:** why / invariant / boundary / tradeoff updated in the same change; no drift; TODOs actionable
  (`TODO(JPWB-###)`).
- **Quality:** SonarQube run, findings addressed (**complexity fully**); `dependency-cruiser` boundary green.
- **Regression:** every bug fix adds a **conformance/replay fixture** so the same failure cannot recur.
- **Docs:** public interfaces document their contracts (the `EngineHandle` seam especially).

### 11.4 Where it lands in the roadmap

Commenting + observability + typed errors + Sonar/boundary gate = **every milestone from M0**. The testing
pyramid consolidates at **M12**. Replay-as-regression = **M13**. AI-specific + production-validation layers =
**host, at MP** (out of the library core).
