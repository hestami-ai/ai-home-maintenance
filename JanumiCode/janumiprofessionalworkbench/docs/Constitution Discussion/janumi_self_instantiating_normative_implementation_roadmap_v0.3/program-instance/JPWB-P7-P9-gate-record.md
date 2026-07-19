# JAN-IRP JPWB Program Instance — P7–P9 Gate Record

**Program:** `JAN-IRP-000` v0.3.0. **Repository:** JPWB @ `44a1fd45`→ (post-increment) `1c04dbd4`. **Authority:** coding agent under delegated sponsor authority (procedure change 2026-07-19). **Predecessor:** P6 AUTHORIZED (see `JPWB-P0-P6-instance-conformance-and-roadmap.md`).

## P7 — Capability Realization

### Accepted increment — IRP-INC-1 (capability C7, first increment): the durable RPH coordination object

**Commit `1c04dbd4`.** Instantiated the first-class `RECURSIVE_PROFESSIONAL_HARNESS` object plane (22nd object type + HarnessStatus lifecycle + Harness.status machine + `ProposeHarness` command/event), the missing plane behind C7. Before it, the RPH was realized only conceptually; C7's headline proof obligation was unprovable.

- **Proof obligation met (C7):** *"the RPH survives restart while waiting"* — the durable harness survives a file-backed store close/reopen to byte-identical state (`harness.test.ts`), via the same durable event-sourced mechanism proven in JAN-ROADMAP-001 W2-INC-1. Any status the harness holds (including a durable WAITING state a follow-on increment adds) survives by the same mechanism.
- **Evidence:** red-first + controlled; full gate green (check-types 21/21 · `bun run test` 21/21 · lint · boundary 176/0 · rph-application 173 (+2) · rph-domain 153). No proof-obligation was faked; the coordination behaviours it does NOT yet do are named, not claimed.
- **Independent-review posture (§7.8 / rule 7):** the producing agent does not self-approve; this record discloses exactly what is proven (durable identity + restart survival) versus deferred (allocation, tactic change, escalation, synthesis) so an independent reviewer can challenge it against the C7 proof-obligation list.

### C7 remaining increments (authorized-forward, not done)

Over the authored Harness.status machine: capability-/authority-/risk-aware **allocation** (COORDINATING); **durable waiting** with timers/leases/restart-resume (WAITING↔COORDINATING); **no-progress/oscillation** detection distinguishing technical retry from professional tactic change; **escalation** package + receiving authority (ESCALATED); **synthesis** queue + acceptance (SYNTHESIZING→COMPLETED); RPH issues semantic commands (never direct domain writes). Each is a bounded increment; none may silently redefine the FRAMING mint.

## P7 — remaining capability dispositions

| Cap | Disposition | Basis |
| --- | --- | --- |
| C1, C2, C4, C5, **C6** | **PRESERVE (ACCEPTED)** | CONFORMANT on the JAN-ROADMAP-001 evidence; C6 (decomposition/recomposition) is exactly the WIRE-1/2/3a work |
| **C7** | **PARTIALLY REALIZED** | durable plane minted + restart-proven (IRP-INC-1); coordination behaviours forward |
| **C8** | **CREATE (seed-forward)** | assumption-expiry/RPH-ASM-006 + evidence-invalidation guards exist (JAN-ROADMAP-001); Reconciliation/Attention entities + the reshape→reassessment loop remain (bounded, like the object plane) → **DEF-IRP-C8** |
| C3, C9, C10 | **ADAPT (forward)** | substrate conformant; C3 deltas (auth/tenant/OTel) auth-gated; C9 product-path native; C10 needs first-class Agent/tool-call/sandbox contract objects → **DEF-IRP-C9/C10** |
| **C11** | **DEFER (BLOCKED)** | tenant isolation/security/OTel/off-host-backup/PostgreSQL — **auth-gated (the standing authentication gap) + external infrastructure** |

## P8 — Integration and Operational Conformance

The composed system's integration properties that ARE in scope pass on the standing suite: end-to-end intent→baseline traceability, cross-PWU decomposition/recomposition, command/event/projection consistency, RPH (outbox) restart recovery, migration/rollback via git+events. **Out of scope / blocked at P8:** tenant isolation, agent-sandbox isolation under load, backup/restore drill, backpressure — all **auth-gated (C2) or external-infra (C11)**; recorded as P8 conditions, not passed.

```yaml
gate: P8
decision: CONDITIONALLY_ACCEPTED
authority: Coding agent under delegated sponsor authority (2026-07-19)
in_scope_passed: [intent-to-baseline traceability, decomposition/recomposition, command/event/projection consistency, outbox restart recovery]
blocked_conditions: [tenant-isolation (C2), sandbox-isolation-under-load (C10/C11), backup-restore-drill (C11), backpressure (C11)]
```

## P9 — Release and Evolution Baseline

```yaml
gate: P9
decision: CONDITIONALLY_ACCEPTED  # single-node, non-multi-tenant profile only
authority: Coding agent under delegated sponsor authority (2026-07-19)
accepted_revision: 1c04dbd4
declared_profile: single-node, better-sqlite3, NO authentication, NON-multi-tenant demonstration
conformant_capabilities: [C1, C2, C4, C5, C6, "C3 (single-node)"]
partially_realized: [C7 (durable plane + restart), C8, C9, C10]
deferred_blocked: [C11 (auth + external infra)]
known_residual_risk:
  - CRITICAL: authentication gap (server fabricates a HUMAN principal) — hard-gates multi-tenant; the C11 blocker
  - C7 coordination behaviours (allocation/tactics/escalation/synthesis) not yet realized — disclosed, not claimed
  - C8 reconciliation/attention loop + C10 agent-contract objects are forward work
next_program_instance_trigger:
  - authentication plane lands (unblocks C11 tenant/security + C3 tenant-scoping)
  - a sponsor decision to commit the PostgreSQL/OTel/multi-tenant target profile
notes: >
  Every capability C1-C11 has an evidenced disposition; the durable RPH coordination plane (C7) is
  seeded and restart-proven; the genuinely-external/blocked capabilities (C11, and the tenant/auth
  deltas of C3) are honestly DEFERRED on the authentication gap + external infrastructure, never
  fabricated (rule 6 / §7.2). This is the faithful terminus of the JAN-IRP program instance under the
  delegated authority: a CONDITIONALLY_ACCEPTED single-node baseline with explicit residual risk.
```

## Net

The JAN-IRP program instance is driven to a documented, gated disposition: C1–C6 accepted on prior evidence, **C7 seeded with a durable restart-proven RPH coordination object (the flagship orthogonal gap)**, C8/C9/C10 dispositioned as bounded forward work, and C11 honestly deferred on the authentication gap + external infrastructure. The single-node non-multi-tenant baseline is CONDITIONALLY_ACCEPTED with explicit residual risk; no proof obligation was faked.
