# G2 Gate Package — Durable Runtime Foundation

**Wave:** W2 — Durable Persistence, Events, and Projections. **Gate:** G2. **Predecessor:** G1 APPROVE (2026-07-19).
**Assembled per:** `JAN-ROADMAP-001` §17. **Decision:** `APPROVE` (recorded §7, delegated sponsor authority per the 2026-07-19 procedure change).

## 1. Master work-package status

| Master WP | Outcome | Status | Evidence |
| --- | --- | --- | --- |
| WP-2-001 Canonical schema & migrations | normalized versioned structures + enforceable keys | **CONFORMANT** | 5 tables pre-existing; **added `SCHEMA_VERSION`/`PRAGMA user_version` migration baseline + fail-closed-on-newer guard** (`16d1ff6e`) |
| WP-2-002 Aggregate repositories & optimistic concurrency | expected-revision, invariant validation, version snapshots, append history | **CONFORMANT** | pre-existing `commit()` in one transaction + revision guard + version history; **durability proven** by file round-trip (`16d1ff6e`) |
| WP-2-003 Event store & transactional outbox | immutable events + transactionally consistent outbox | **CONFORMANT (single-node)** | pre-existing atomic state+events+outbox+receipt commit; a durable cross-process relay/broker is DEFERRED to W10 (multi-process) |
| WP-2-004 Command receipts & idempotency | no duplicate decisions/baselines/side effects | **CONFORMANT** | pre-existing dedup at dispatch; covers successes (a failed re-send produced no side effect, safe to retry) |
| WP-2-005 Artifact & evidence storage | immutable/versioned, content-hashed, access-controlled | **PARTIAL — DEFERRED** | artifacts/evidence persist as immutable versioned rows; blob content-hashing + §18.3 supersession + access control → ArtifactStore/CapabilityAuthorizer ports (W3/W10; access control auth-gated, C2) |
| WP-2-006 Rebuildable read projections | Work/Execution/Assurance/Traceability/compatibility views derived + rebuildable | **CONFORMANT** | Work/Assurance already event-folds; **added rebuildable Traceability (typed link graph — lands DEF-W1-002) + Compatibility (legacy-phase milestone) projections** (`8307f89d`) |
| WP-2-007 Restart recovery & reconciliation | recover durable waits without blind duplicate execution | **CONFORMANT (outbox) / DEFERRED (external-op)** | **added `recoverOutbox()` restart recovery, re-drives PENDING exactly-once across a real file-backed restart** (`c1262abe`); external-operation (execution-plane) reconciliation → W3 (DEF-W1-001) |

## 2. Code-grounded headline

W2 was a **narrow closure wave, not a build-from-zero**: the durable foundation (5 tables, atomic commit, optimistic concurrency, idempotent dispatch, Work/Assurance projections) already existed and was conformance-tested (RPH-PER-006/007) — the honest current-state truth W0/W1 established, confirmed by a 45-read code inventory (`evidence/persistence-current-state.md`). Three genuine gaps were closed, each red-first + controlled + full-gate-green:

1. **Durability + migration baseline** (`16d1ff6e`): file-backed persist→reopen→byte-identical canonical state (adapter-level + the full Reference Undertaking), and a schema-version stamp that fails closed on a newer store.
2. **Restart recovery** (`c1262abe`): `recoverOutbox()` re-drives PENDING outbox exactly-once across a simulated crash-restart; a second recovery delivers nothing (no duplicate side effect).
3. **Projections** (`8307f89d`): rebuildable Traceability (typed link graph, folding the W1-deferred DEF-W1-002 plane into its correct home as a derived read-model) + Compatibility (legacy-phase milestone) projections.

## 3. Conformance baseline

`check-types` 21/21 · full `bun run test` **21/21 tasks** · `lint` clean · `boundary` 173 modules / 0 violations · reference fixture green. (Process note: a hardcoded schema-registry tally in `validate.test.ts` had lagged the W1 contract additions; corrected in `320cc465`, and the W2 gate now runs the FULL `bun run test`, not just touched packages.)

## 4. Wave exit criteria (master §14 W2)

- The reference fixture persists and replays to the same canonical state — **MET** (`16d1ff6e`).
- Event and outbox writes are atomic — **MET** (pre-existing).
- Commands are idempotent and concurrency-safe — **MET** (pre-existing).
- Work, Execution, Assurance, Traceability, and compatibility projections can be rebuilt — **MET** (Work/Assurance pre-existing; Traceability + Compatibility added; Execution reads via listByType — a query projection, adequate for the wave).
- Restart recovery avoids duplicate external side effects — **MET** for the outbox (`c1262abe`); execution-plane external-op reconciliation is W3 (DEF-W1-001).

## 5. Decisions, deferrals, divergences

- **DEC-W2-001** (EFFECTIVE): W2 is a closure wave; do not rebuild the conformant foundation, close only the genuine gaps.
- **DEF-W2-001**: WP-2-005 blob content-hashing + §18.3 artifact supersession + access control → W3 execution / W10 security (access control auth-gated, carried C2).
- **DEF-W2-002**: durable cross-process outbox relay/broker (WP-2-003) → W10 (multi-process deployment); the in-process drain + startup re-drive suffices for single-node durability.
- **DEF-W2-003**: `expectedRevision`-required-on-every-update (WP-2-002) → opportunistic call-site sweep; honored-when-sent today.
- **Carried:** C2 (auth gap, hard-gated pre-multi-tenant); DIV-W1-003 (successor-master re-baseline owed — see the W3 note on the legacy-removed re-scope of W5–W7).

## 6. Residual risk

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Outbox delivery is at-least-once (crash between deliver and markPublished) | Low | Documented; subscribers must be idempotent; `markOutboxPublished` is the dedup checkpoint |
| Compatibility milestone derivation is a baseline (kind→milestone), not the full versioned rules | Low (by design) | Full RPH-DOC-005 rules are W5/WP-5-003; the projector's `handlerVersion` absorbs the refinement without a shape change |
| No durable host configured (demo runs `:memory:`) | Low | Durability is opt-in by filename; proven by test, not forced on the demo |

## 7. Gate decision (recorded)

```yaml
gate: G2
decision: APPROVE
authority: Coding agent under delegated sponsor authority (procedure change 2026-07-19)
date: 2026-07-19
conditions_carried: [C2, DIV-W1-003]
deferrals: [DEF-W2-001, DEF-W2-002, DEF-W2-003]
commits: [16d1ff6e, c1262abe, 8307f89d, 320cc465]
notes: >
  Narrow closure wave over a conformant, conformance-tested foundation. Three genuine gaps closed
  red-first + controlled; full bun run test 21/21. Artifact content-hashing/access-control and a
  cross-process outbox relay deferred with reason to W3/W10.
```

## 8. Proposed next — W3

`JAN-W3-DR-001` (Intent-to-Architecture RPH Vertical Slice). The Reference Undertaking already exercises much of the intent→PWU→assurance→decision→baseline path; W3 grounds the genuine gaps and folds in the execution-plane external-op reconciliation (DEF-W1-001) + artifact/evidence content-hashing (DEF-W2-001). **Material note for the successor master (DIV-W1-003):** legacy JanumiCode was classified REMOVE at W0, which re-scopes the legacy-migration waves W5 (shadow mode), W6 (pilot authority transfer), and W7 (legacy phase retirement) — there is no writable legacy plane to shadow, cut over, or retire. Their genuine residue (compatibility-milestone *versioned* derivation WP-5-003; per-Undertaking authority mode WP-6-001 as a native RPH concept; product-behavior/implementation modeling WP-7-001..007) is real and folds forward into W3/W8; the legacy-dependent WPs are recorded for DEFER/REMOVE at their gates with the owed successor-master revision.
