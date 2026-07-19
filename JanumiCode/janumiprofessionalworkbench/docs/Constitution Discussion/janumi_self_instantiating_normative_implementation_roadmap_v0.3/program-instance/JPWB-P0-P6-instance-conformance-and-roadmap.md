# JAN-IRP JPWB Program Instance — P0–P6 (Conformance + Repository-Specific Roadmap)

**Program:** Janumi Implementation Realization Program (`JAN-IRP-000` v0.3.0). **Repository:** `hestami-ai` / `JanumiCode/janumiprofessionalworkbench` (JPWB). **Assessed revision:** `44a1fd45` on `main`. **Authority:** coding agent under delegated sponsor authority (procedure change 2026-07-19: drive the full program without pausing at gates; commits are the authorization; review at the end). **Method note:** this instance is produced with high-confidence current-state knowledge from the immediately-preceding JAN-ROADMAP-001 realization (W0–W10, 20 commits), which built and *tested* much of the C1–C6 substrate — the P1/P2 evidence is that work's gate packages + the live test suite.

---

## P0 — Program Foundation (source baseline)

- **Source corpus:** the `JAN-IRP-000` package (16 docs + baseline 157-requirement register + control JSON) is materialized and controlled. Authority hierarchy per `JAN-IRP-001` §10 (Constitution → foundations/doctrine → PWU/RPH/architecture → runtime profiles → **this program** → operating plan → evidence).
- **Requirement register:** the incorporated 157-requirement register (`baseline/JAN-REQ-001`) is accepted **for audit** (not infallible, per README §5). Families: GOV 14, JCODE 22, JEM 18, JSDL 10, + others. They map into the C1–C11 capability catalog (`JAN-IRP-008`), which is the primary target for this instance.
- **Known source gap:** the corpus assumes a **PostgreSQL + multi-tenant + OpenTelemetry** target profile (esp. C3/C11), whereas JPWB is **better-sqlite3, single-node, no OTel**. This is a legitimate current-vs-target profile discrepancy → reconciled at P4 (below), not a defect.

## P1 — Repository Intake (evidence identity)

- **Revision:** `44a1fd45` (immutable git commit), branch `main`, atop `c2b853b1`. Working tree clean except the unrelated `ai_os_home_cam_service_provider/signoz` submodule (another agent's; excluded from scope).
- **Baseline build/test (no remediation):** `bun run check-types` 21/21 · `bun run test` 21/21 tasks · `lint` clean · `boundary` 174 modules / 0 violations · Playwright (rph-demo) green. Reproducible; this IS the baseline evidence.
- **Surface inventory:** Turbo monorepo — `packages/rph-contracts` (generated semantic contracts), `rph-domain` (pure kernels), `rph-application` (command handlers + engine bus), `rph-persistence` (SQLite adapter, 5 tables), `rph-projections` (rebuildable read models), `rph-ports`, `rph-assurance`, `rph-product-realization-pwa` (ontology), `rph-engine` (composition + reference undertaking); `apps/rph-demo` (SvelteKit workbench on the real engine).

## P2 — Current-State Reconstruction (semantic model)

Event-sourced-with-current-state hybrid on SQLite: atomic state+version+events+outbox+receipt commit; optimistic concurrency; idempotent dispatch; rebuildable projections; 21 first-class object types; independent PWU state axes (work/execution/assurance/shape); the assurance/claim/evidence/decision/baseline governance kernel; a governed authoring agent (fork + hash-matched accept). The "RPH" is realized **conceptually** (a program coordinating PWUs via decomposition + execution plans) — there is **no first-class durable RPH object**. No reconciliation/attention entities. No authentication (server fabricates a HUMAN principal). Single-node; no tenant scoping enforced.

## P3 — C1–C11 Conformance Assessment (the core)

Status vocabulary per `JAN-IRP-002` §8. Evidence = the cited JAN-ROADMAP-001 commits + the live suite.

| Cap | Outcome | Status | Evidence / gap |
| --- | --- | --- | --- |
| **C1** Semantic identity & contract foundation | machine-readable, versioned, deterministic shared contract | **CONFORMANT** | generated `rph-contracts` (single vocab source → enums/objects/messages + schemas, reproducible); opaque ULID identity + provenance + semver; identity survives rename/revision (property-tested); incompatible-change detection via schema-version guard (`16d1ff6e`). *Gap vs corpus:* tenant/org scope in identity → C11/auth. |
| **C2** Intent/Outcome/Participant/PWU kernel | smallest coherent work context | **CONFORMANT** | Intent lifecycle + PWU with independent work/exec/assurance/shape axes; AI-vs-human ActorType; PWU-not-a-generic-task; a PWU cannot become ready without shape (readiness guard); professional≠activity completion (INV-5). Intent exact-version binding (`4e9c3912`). |
| **C3** Command/event/projection spine | authenticated, authorized, atomic, evented, projected | **PARTIALLY_CONFORMANT** | atomic commit + optimistic concurrency + idempotency + immutable per-aggregate event order + rebuildable projections + typed errors + causation/correlation/provenance — all built/hardened (`16d1ff6e`, `c1262abe`, `8307f89d`). **Gaps:** authentication (fabricated principal), tenant-scoped persistence/query, OpenTelemetry traces → C11/auth-gated. |
| **C4** PWU cognitive vertical slice | create→frame→…→complete→reopen through commands + workspace | **CONFORMANT** | the reference undertaking drives the critical journey live to an authoritative Architecture Baseline; the demo renders the four-axis workspace + role-aware commands + traceability (`d46bf08b`). Reopen-by-new-evidence partially (reshape loop = C8 gap). |
| **C5** Evidence-bearing reasoning & decision | explicit Question/Evidence/Claim/Confidence/Decision | **CONFORMANT** | first-class Claim/Evidence/Assumption/Decision; evidence admissibility (§8.11); contradictory-evidence + invalidation cascade (`6dc18d00`); AI recommendation stays proposed; decision requires authority; inconclusive≠pass. |
| **C6** Recursive decomposition & recomposition | children preserve parent coherence | **CONFORMANT** | **obligation conservation P2 + constraint propagation P3 at ValidateDecomposition (`6020f92f`); recomposition §14.1 — completed children do NOT complete an incoherent parent, conflict ⇒ CONFLICTED (`20a3733e`)**. This is exactly C6's headline proof obligation, wired live. |
| **C7** RPH coordination & adaptive tactics | durable RPH frames/plans/allocates/waits/resumes/escalates | **NOT_IMPLEMENTED** | **no first-class durable RPH object exists** (21 object types cover PWU/decomposition/assurance/governance, not RPH coordination). Restart-survival, no-progress/tactic-change, escalation, synthesis-queue — all absent as a durable plane. **The flagship orthogonal gap → P7.** |
| **C8** Continuous reconciliation & attention | detected incoherence → governed, observable process | **PARTIALLY_CONFORMANT** | assumption expiry + RPH-ASM-006 gate (`9bcdca57`); evidence-invalidation pull-guard (`6dc18d00`). **Gaps:** no Reconciliation/Attention entities, no falsification→reshape→reassessment loop, no durable attention items → P7/DEFER. |
| **C9** JanumiCode end-to-end product realization | Intent→…→Release→Observation→Reconciliation | **PARTIALLY_CONFORMANT** | the intent→architecture→baseline chain is live; product-behavior/implementation/V&V/release modeling is the native residue folded from JAN-ROADMAP-001 W7 → forward work. |
| **C10** Governed agentic execution | bounded, attributable, evidence-bearing agent work | **PARTIALLY_CONFORMANT** | the demo's authoring agent runs over an engine fork with **proposed-state default + hash-matched accept** (agent completion ≠ PWU completion; can't broaden scope silently). **Gaps:** first-class Agent/tool-call/sandbox contract objects, resource governance, restart of execution state → P7/DEFER. |
| **C11** Operational beta assurance | tenant isolation, security, observability, recovery | **NONCONFORMANT (blocked)** | outbox restart recovery + durable persist/replay built (`16d1ff6e`, `c1262abe`); **but** no authentication, no tenant isolation, no OTel, no off-host backup, no PostgreSQL, single-node — **auth-gated (the C2/DIV-W0-003 authentication gap) + external infrastructure.** → DEFER (BLOCKED). |

**Coverage:** every capability has a status + evidence; no critical claim is unevidenced; unknowns are none (the substrate is the just-tested JAN-ROADMAP-001 baseline).

## P4 — Reconciliation (discrepancy dispositions)

| Discrepancy | Classification | Disposition |
| --- | --- | --- |
| C7 durable RPH object absent | IMPLEMENTATION_DEFECT (missing capability) | **CREATE** — instantiate the plane (P7 flagship) |
| C8 reconciliation/attention entities absent | IMPLEMENTATION_DEFECT | **CREATE** (bounded; seed at P7, loop deferred) |
| Corpus assumes PostgreSQL/multi-tenant/OTel; JPWB is SQLite/single-node/no-OTel | VALID_EXISTING_BEHAVIOR + SPECIFICATION profile mismatch | **PRESERVE** the single-node profile as the *declared* release profile (C11 §declared availability); the Postgres/tenant/OTel target is a later profile, **BLOCKED_BY_UPSTREAM** on the authentication gap (C2) |
| Authentication fabricates a HUMAN principal | IMPLEMENTATION_DEFECT (CRITICAL) | **ESCALATE** — carried as the standing C2 gap; hard-gates C11 multi-tenant. No multi-tenant surface may ship until closed |

No material discrepancy is left silently unresolved; the auth defect has an explicit upstream owner (security workstream).

## P5 — Transition Architecture

- **C1–C6:** PRESERVE (conformant + tested). **C7:** CREATE a first-class `RECURSIVE_PROFESSIONAL_HARNESS` object + coordination commands, additively (no existing plane to migrate). **C8:** CREATE reconciliation/attention entities incrementally atop the existing assumption/evidence guards. **C9/C10:** ADAPT the existing execution/agent surfaces forward. **C11:** DEFER (declared single-node profile now; Postgres/tenant/OTel is a governed future migration gated on C2).
- **No-loss:** all new planes are additive; the reference fixture + full suite gate every increment (pre-change state reconstructable from git + the event log).

## P6 — Repository-Specific Roadmap Instance (capability binding)

| Capability | Binding disposition | Increment |
| --- | --- | --- |
| C1, C2, C4, C5, C6 | **PRESERVE** (accepted CONFORMANT on the JAN-ROADMAP-001 evidence) | none — carried |
| **C7** | **CREATE** | **IRP-INC-1 (P7): mint the durable RPH coordination object + restart-survival proof** (the flagship; this instance's first executable increment) |
| C8 | CREATE (seed) | IRP-INC-2 (deferred): Reconciliation/Attention entities + the reshape loop |
| C3, C9, C10 | ADAPT (forward) | folded — the substrate is conformant; the deltas are auth/tenant (C3) + product-path (C9) + agent-contract objects (C10) |
| C11 | DEFER (BLOCKED) | gated on C2 authentication + external infra (PostgreSQL/OTel/off-host backup) |

**First increment (IRP-INC-1) is bounded and executable:** instantiate the `RECURSIVE_PROFESSIONAL_HARNESS` object plane (the C7 proof-obligation "RPH survives restart while waiting" is directly provable via the durable-store round-trip established in W2-INC-1). Later C7 increments (allocation, tactic-change, escalation, synthesis) build on it; they cannot silently redefine it.

**Gate P6 → P7 AUTHORIZED** (delegated authority): the DAG is acyclic (C7 depends only on the conformant C1–C3 substrate), the first increment is bounded, and future increments cannot redefine earlier semantics.
