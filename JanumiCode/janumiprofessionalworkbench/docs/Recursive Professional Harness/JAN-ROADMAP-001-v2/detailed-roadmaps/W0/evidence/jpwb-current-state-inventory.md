# W0 Evidence — JPWB Current-State Inventory (implementation units, storage, boundaries, sources of truth)

**Discharges:** `JAN-WP-0-003` (via `JAN-W0-DWP-003`) and the JPWB-facing portion of `JAN-WP-0-005`/`JAN-WP-0-006` (via `JAN-W0-DWP-005`).
**Grounding:** direct read of `package.json` dependency edges, `enums.ts`, `registry.ts`/handlers, `rph-persistence/src/schema.ts`, `rph-projections`, `rph-assurance`, and `docs/_working/dead-kernel-census.txt`. Standard §6 quality bar applied (ownership of state, data flow, boundaries, coupling), not filenames alone.

## 1. Implementation units and layering (CONFIRMED — acyclic)

JPWB is a layered RPH engine of ten first-party packages plus a demo surface. Internal dependency edges (`@janumipwb/*`):

```text
rph-contracts            (foundation; NO internal deps; the single source of truth)
  ← rph-domain           (contracts)                        # pure kernel rules
  ← rph-ports            (contracts)                        # storage/port interfaces
  ← rph-persistence      (contracts, ports)                 # better-sqlite3 adapter
  ← rph-assurance        (contracts, domain, ports)         # assurance kernel
  ← rph-projections      (contracts, domain, ports)         # read models
  ← rph-application      (assurance, contracts, domain, ports, projections)   # command handlers
  ← rph-engine           (application, assurance, contracts, domain, persistence, ports, projections)  # composition root
  ← rph-authoring        (contracts, engine)                # PWA authoring
rph-product-realization-pwa (contracts)                     # PWA definition data (standalone)
apps/rph-demo            (SvelteKit demo surface)
```

The `boundary` gate (depcruise) reports **159 modules / 0 dependency violations** — the layering is enforced, not aspirational. **Ownership of semantic state** is centralized in `rph-application` handlers writing through `rph-persistence`; **no second writable semantic state machine exists** (master rule 1, kernel-level — CONFIRMED for the engine; per-Undertaking authority mode is a later-wave verification).

## 2. Canonical object model (CONFIRMED)

- **30 `ProfessionalWorkObjectType` members** (`packages/rph-contracts/src/enums.ts`) — the canonical object taxonomy (Intent, PWU, Obligation, Constraint, Assumption, Claim, Evidence, Assurance Policy/Assessment/Observation, Decision, Baseline, Execution Plan, Runtime Binding, PWU Type, PWA, Undertaking, etc.).
- **Identity/provenance/versioning:** ULID opaque ids (Crockford base32) with typed prefixes; provenance envelope; `(id, revision)` version keying. This substantially realizes master `JAN-WP-1-002` (Registry and Identity).

## 3. Sources of truth (CONFIRMED)

| Concern | Canonical source of truth | Note |
| --- | --- | --- |
| Machine contracts (objects/commands/events/enums/schemas) | `packages/rph-contracts/vocab/*.json` → generated `src/enums.ts\|objects.ts\|messages.ts` + `schemas/*.json` via `bun run gen` | **Single source of truth** (master `JAN-WP-1-001` substance met). Generated files are committed; `format:check` guards `.ts` formatting; schema JSON is generator-emitted (not prettier-formatted). |
| Semantic object state | `professional_work_objects` + `professional_work_object_versions` (SQLite) | Current-state snapshot + append version history. |
| Event history | `domain_events` | Immutable append log. |
| Async delivery | `outbox_messages` | Transactional outbox. |
| Command idempotency | `command_receipts` (PK `idempotency_key`) | Command-replay dedup (distinct from any per-attempt idempotency key). |
| PWA definition data | `packages/rph-product-realization-pwa` + seed | Reusable architecture; standalone package. |

## 4. Persistence model (CONFIRMED — realizes master W2 substance)

`packages/rph-persistence/src/schema.ts` defines **exactly five tables**: `professional_work_objects`, `professional_work_object_versions` (keyed `(id, revision)`, whole-`currentState` serialized), `domain_events`, `outbox_messages`, `command_receipts`. This is an **event-sourced-with-current-state hybrid** (DOC-009). Aggregate mutation enforces expected revision, appends events, and writes the outbox + receipt atomically (`commitState`). **No dedicated migration tool** is present (schema is code-defined) — a forward gap for W2 re-baseline.

**Current-state facts to carry to W2 re-baseline:** (a) whole-`currentState` re-serialization per version row → O(N²) storage risk for high-revision aggregates (documented in `DESIGN-execution-attempt-staged.md`); (b) restart-recovery / external-operation reconciliation exists in contract but its production wiring is a hollow-layer candidate (§6).

## 5. Command/handler and projection surface (CONFIRMED)

- **12 command-handler modules** (`packages/rph-application/src/handlers/*.ts`, non-test) route commands through the kernel and persist via `commitState`.
- **8 projection modules** (`packages/rph-projections/src/*.ts`) derive read models (Work, Execution, Assurance, Traceability views) — rebuildable from events (master `JAN-WP-2-006` substance).
- **7 assurance-kernel modules** (`packages/rph-assurance/src/*.ts`) — policies, criteria, disposition, independence, evidence admissibility.

## 6. The hollow governed layer (CONFIRMED — carries as DIV-W0-004)

`docs/_working/dead-kernel-census.txt`: of the professional kernel surface, **LIVE 19 / DEAD 55** — 55 kernel functions are reachable **only from tests**, not production call sites (e.g. `evaluateRecomposition`, `validateDecomposition`, `evidenceAdmissibility`, `retryDecision`, `resolveIdempotency`, `canAuthorizeNewWork`, `isWaiverApplicable`). The kernel is correct and tested; the application layer historically called a weaker literal beside each governed rule. The session's harmonization program is progressively wiring these (the rule-array enforcement thread is complete: five of six ASSURANCE_POLICY rule arrays now ENFORCED at completion/waiver time). **This is the single most important JPWB current-state truth: green tests prove the kernel, not that production is wired to it.** W0 preserves the census as counter-evidence to any "already conformant" claim.

## 7. Assurance and execution side-effect posture (INFERRED — forward-flagged)

- **Assurance (RPH-DOC-004 target):** JPWB has a native, versioned assurance kernel (policies, evidence, observations, dispositions, independence, waivers). Recent harmonization made the six ASSURANCE_POLICY rule arrays settable and five ENFORCED. Legacy validators are **not** migrated (§ `legacy-classification.md`).
- **Execution side effects (RPH-DOC-008/009):** the execution plane records `ExecutionProvenance` (contracted), `executionAttemptId` (carried as a free string), and runtime bindings; **no Execution Attempt record/table is constructed** and there is **no per-attempt idempotency key or attempt-open runtime-binding bind** yet (see `DESIGN-execution-attempt-staged.md`). Recovery/reconciliation is a **forward gap** for W2 re-baseline, not a W0 fix.

## 8. Exit-criterion attestation

Every material JPWB implementation unit, semantic-state store, side-effect store, service boundary, and canonical source of truth is identified (§1–§7). `JAN-WP-0-003` exit criterion **met**; the JPWB-facing portions of `JAN-WP-0-005`/`006` are inventoried with hollow-layer and recovery gaps **named** (not resolved — deferred to their waves).
