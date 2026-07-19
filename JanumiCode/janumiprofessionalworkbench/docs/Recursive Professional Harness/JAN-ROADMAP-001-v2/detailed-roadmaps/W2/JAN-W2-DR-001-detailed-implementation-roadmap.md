# JAN-W2-DR-001 — Detailed Implementation Roadmap

**Wave:** W2 — Durable Persistence, Events, and Projections. **Master:** `JAN-ROADMAP-001@2.0.0-draft`. **Predecessor gate:** G1 APPROVE (2026-07-19). **Standard:** `JAN-ROADMAP-001-A`. **Language:** normative (SHALL/SHOULD/MAY).

## 1. Normative outcome (from master §14 W2)

Canonical RPH state SHALL be durable, replayable, recoverable, auditable, and projectable without semantic dependence on any legacy workflow phase.

## 2. Current-state finding (code-grounded — see `evidence/persistence-current-state.md`)

The durable-runtime **foundation already exists and is conformance-tested**: 5 tables (`professional_work_objects`, `professional_work_object_versions`, `domain_events`, `outbox_messages`, `command_receipts`); atomic state+version+events+outbox+receipt commit inside one `db.transaction`; optimistic concurrency (`expectedRevision`); idempotent dispatch (receipt dedup); aggregate-replay equivalence (RPH-PER-006) and Work/Assurance projection rebuild (RPH-PER-007). W2 is therefore a **narrow closure wave**, not a build-from-zero — the same honest-current-state truth W0/W1 established.

## 3. Legacy classification (per master §9)

Legacy JanumiCode was classified **REMOVE** at W0 (sponsor: "legacy codebases, we don't have anything to import/migrate/inherit"). Therefore the W2 "compatibility projection" is NOT a legacy-phase shadow of a running legacy engine; it is the **derived legacy-phase-label projection** (RPH-DOC-005 §derivation) computed from RPH canonical state — a rebuildable read model that lets a viewer see the familiar phase labels without any writable legacy plane. It carries no authority (master invariant 11: "legacy phases SHALL become derived compatibility projections").

## 4. Selected strategy & work packages

The wave SHALL close exactly the three genuine gaps the current-state inventory surfaced, each as a red-first (or property) increment routed through the existing ports/framework, gated green, committed:

| Increment | Master WP | Outcome (normative) | Exit test |
| --- | --- | --- | --- |
| **W2-INC-1** | WP-2-001, WP-2-002 | A file-backed engine SHALL persist canonical state and, on reopen, SHALL reconstruct byte-identical canonical state for every aggregate (the reference fixture round-trips). The schema SHALL carry a `PRAGMA user_version` baseline and SHALL fail closed when opened against a **newer** schema version than the code supports (migration foundation). | Reference fixture → file DB → close → reopen → every `loadObject` state deep-equals; opening a `user_version`+1 DB is rejected. |
| **W2-INC-2** | WP-2-007 | On engine open against a durable store, restart recovery SHALL re-drive every PENDING outbox message exactly once and SHALL NOT re-deliver an already-PUBLISHED message (no duplicate external side effect across a restart). | Commit N events (PENDING outbox) → simulate restart (reopen) → recovery delivers each PENDING once; a second recovery delivers none. |
| **W2-INC-3** | WP-2-006 | The **Compatibility** (legacy-phase-label) projection and a **rebuildable Traceability** projection (typed links folded from events — landing the W1-deferred DEF-W1-002 plane) SHALL be derived, idempotent, and rebuildable from the event log via the existing `Projector`/`rebuildProjection` framework. | `rebuildProjection` from the reference fixture events yields the expected phase labels + trace links; re-applying the same events is idempotent (RPH-PER-007-style). |

## 5. Out of scope for W2 (deferred, with reason)

- **WP-2-005** artifact/evidence content-hashing over blob bytes, §18.3 artifact supersession, and access control → the `ArtifactStore`/`CapabilityAuthorizer` ports (`ports/index.ts`) land with W3 execution / W10 security; access control is authentication-gated (carried condition C2). NOT a W2 exit blocker (artifacts/evidence already persist immutably as versioned rows).
- **WP-2-002** `expectedRevision`-required-on-every-update → a cross-cutting call-site migration, low risk today (honored when the client sends it). SHOULD land opportunistically, not gating.
- **WP-2-003** durable cross-process outbox relay/broker → unnecessary until multi-process deployment (W10). The in-process drain + startup re-drive (INC-2) satisfies the single-node durability the wave requires.

## 6. Migration / compatibility / rollback

No destructive DB migration: the schema is additive (`PRAGMA user_version` is set on a fresh DB; existing `:memory:` hosts are unaffected). The compatibility projection is read-only and grants no authority (invariant 10). Rollback = revert the increment commit; no data migration to undo.

## 7. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| A file-backed default changes host behavior (durability where a demo expected ephemerality) | Low | Durability is opt-in by filename; the demo host stays `:memory:` unless a path is configured. The persist/replay proof is a test, not a host default change. |
| Recovery double-delivers on a crash between deliver and markPublished | Medium | Delivery SHALL be idempotent at the subscriber (the outbox is at-least-once); `markOutboxPublished` is the dedup checkpoint. Disclosed as at-least-once semantics. |
| Compatibility projection re-introduces a writable legacy plane | Low (by design) | It is a pure read-model fold; no command writes it; it carries no authority (invariant 11). |

## 8. Gate G2

Assembled per master §17 on completion of INC-1..3 with full gate green (check-types, all package tests, lint, boundary, reference fixture). Recorded by the coding agent under delegated authority (procedure change 2026-07-19).
