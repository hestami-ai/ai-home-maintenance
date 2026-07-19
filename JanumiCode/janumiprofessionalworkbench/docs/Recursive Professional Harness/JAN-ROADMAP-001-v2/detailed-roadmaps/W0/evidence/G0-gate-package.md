# G0 Gate Package — Code-Grounded Migration Authorization

**Wave:** W0 — Normative Baseline and Code Grounding. **Gate:** G0. **Assembled by:** `JAN-W0-DWP-007`.
**Assembled per:** `JAN-ROADMAP-001` §17. **Decision requested:** `APPROVE` / `APPROVE_WITH_CONDITIONS` / `REJECT` / `DEFER`.

> **This gate carries one material decision** (DIV-W0-001): whether to accept a **reframed W0** and re-baseline W1+ against the realized JPWB engine. No later wave may assume G0 passed until an effective decision exists (master §14).

## 1. Master and detailed work-package status

| Master WP | Discharge | Delivery | Conformance |
| --- | --- | --- | --- |
| JAN-WP-0-001 Document manifest + source authority | `document-manifest-and-source-authority.md` | IMPLEMENTED | CONFORMANT |
| JAN-WP-0-002 Canonical vocabulary | `canonical-vocabulary-report.md` (JPWB: 0 "Product Lens"/0 "Lens") | IMPLEMENTED | CONFORMANT |
| JAN-WP-0-003 Impl-unit/storage/service/source-of-truth inventory | `jpwb-current-state-inventory.md` | IMPLEMENTED | CONFORMANT |
| JAN-WP-0-004 Phase/substate grounding | `legacy-classification.md` (11-phase engine located; legacy `REMOVE`) | IMPLEMENTED | CONFORMANT (reframed) |
| JAN-WP-0-005 Validator/assurance inventory | legacy `REMOVE`; JPWB assurance in inventory §7 | IMPLEMENTED | CONFORMANT (reframed) |
| JAN-WP-0-006 Side-effect/recovery inventory | inventory §7 (execution plane; recovery gaps named) | IMPLEMENTED | CONDITIONALLY_CONFORMANT (recovery deferred to W2) |
| JAN-WP-0-007 Trace corpus + divergence register + ADR baseline | `divergence-register.md` | IMPLEMENTED | CONFORMANT |

Detailed WPs `JAN-W0-DWP-001…007`: all IMPLEMENTED; conformance as above.

## 2. Code-grounded findings and deviations (headline)

1. **JPWB is a mature RPH engine**, not a greenfield-from-legacy build. It realizes the substance of master W1 (semantic kernel, 30 object types, single-source contracts) and W2 (event-sourced five-table persistence + outbox + receipts + rebuildable projections), with an enforced package boundary (159 modules / 0 violations).
2. **The legacy codebases (`janumicode`, `janumicode_v2`) are `REMOVE`** — nothing to migrate/inherit (sponsor direction). The 11-phase engine is located (`janumicode/src/lib/workflow/orchestrator.ts`) but not mined.
3. **JPWB canonical vocabulary is conformant** (0 "Product Lens", 0 bare "Lens"; term confined to `REMOVE` legacy).
4. **The hollow governed layer is real** (LIVE 19 / DEAD 55): green tests prove the kernel, not production wiring. Closure is in progress (rule-array enforcement thread complete).
5. **Deviation from the master framing:** W0-as-written (legacy migration inventory) is not the true next step; the true next step is conformance verification + re-baseline. Surfaced as DIV-W0-001.

## 3. Conformance-baseline (gate) result — re-attested at G0 assembly

- `check-types`: **21/21** (FULL TURBO cache; no code changed by W0).
- `boundary` (depcruise): **159 modules / 0 violations**.
- `test` (last full run this session): rph-application 145 (+1 pre-existing skip), rph-engine 64, rph-authoring 25, rph-demo 85 — green.
- `lint`: clean. `Playwright` E2E: **25/25** (last full run; unaffected by docs-only W0 additions).
- **Caveat (R1):** this baseline proves the *kernel*, not full corpus conformance; the dead-kernel census is retained as counter-evidence.

## 4. Migration, recovery, security, and operational evidence

- **Migration:** greenfield-forward; **no legacy dual-run/shadow substrate** (legacy `REMOVE`) — master W5/W6 legacy apparatus is moot here (DIV-W0-002).
- **Recovery:** JPWB restart-recovery / external-operation reconciliation exists in contract; production wiring is a hollow-layer candidate — **deferred to W2 re-baseline** (WP-2-007).
- **Security:** no endpoint authenticates; demo fabricates a HUMAN principal (DIV-W0-003). A genuine unconditional-MUST corpus violation (DOC-002 §27.2 "authenticate actor"; DOC-007 §39 "human decisions require authenticated identity") — **calibrated severity LOW today / CRITICAL if shipped multi-tenant** (adversarially verified, workflow `wf_effc0248-e39`). The fabricated `HUMAN` actively passes the kernel authority gate (`governance.ts:170`); the independence control fails safe (skipped under NONE). **SHALL NOT** ship multi-tenant until resolved. See `divergence-register.md` DIV-W0-003.
- **Operational:** W0 is non-mutating; rollback = `git revert` of the W0 docs commit.

## 5. Decisions, deferrals, waivers, divergences

- **Decisions:** DEC-W0-001 (adopt reframed W0 — pending this gate), DEC-W0-002 (legacy `REMOVE` — effective).
- **Deferrals:** DEF-W0-001 (per-capability conformance scoring → later waves).
- **Waivers:** none.
- **Divergences:** DIV-W0-001 (MATERIAL, decision trigger), DIV-W0-002 (MATERIAL), DIV-W0-003 (CRITICAL, security), DIV-W0-004 (MATERIAL, in-progress), DIV-W0-005 (governance). See `divergence-register.md`.

## 6. Residual risk

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Treating green gate as full corpus conformance | Medium | Dead-kernel census retained as counter-evidence; per-capability scoring deferred, not skipped. |
| Reframe rejected at G0 → return to literal W0 | Low value if rejected | DIV-W0-001 surfaced early and explicitly; literal W0 remains available. |
| Unauthenticated runtime shipped multi-tenant | **Critical if realized** | Hard security gate (DIV-W0-003) before any multi-tenant deployment. |

## 7. Recommendation

**`APPROVE_WITH_CONDITIONS`.**

W0's grounding purpose is complete and code-grounded: the document manifest, canonical-vocabulary conformance, JPWB current-state inventory, legacy `REMOVE` classification, and divergence register + ADR baseline are delivered, and no unresolved *critical* item is silent. The single item requiring sponsor authority is the **re-baseline** (DIV-W0-001), which is a master-level change (master §20) and therefore cannot be self-authorized.

**Conditions:**

1. **C1 (re-baseline authorization).** The sponsor **SHALL** decide DIV-W0-001: authorize a successor Master Roadmap revision re-baselining **W1** as *RPH-kernel conformance verification + hollow-layer closure* (not a from-scratch build), **W2** as *persistence conformance verification + recovery/reconciliation closure*, and **W5/W6** as *not-applicable-legacy / reinterpreted*. Until decided, W1 activation is on the *literal* master text.
2. **C2 (security gate).** DIV-W0-003 (authentication) **SHALL** be entered on the security workstream and **SHALL** hard-block any multi-tenant deployment.
3. **C3 (corpus ratification).** RPH-DOC-002…010 ratification status **SHALL** be recorded; W1+ conformance claims are "against provisional corpus" until ratified (DIV-W0-005).
4. **C4 (hollow-layer closure tracking).** DIV-W0-004 closure (kernel wiring) **SHALL** continue under the W1 re-baseline with the divergence register as the tracker.

## 8. Proposed next-wave detailed roadmap

Sufficient evidence exists to propose that **W1's detailed roadmap (`JAN-W1-DR-001`) be generated as a *conformance-verification + gap-closure* roadmap** against JPWB's realized kernel, rather than a from-scratch build — contingent on C1. Its inputs are already in hand: the JPWB inventory, the dead-kernel census (the concrete gap list), and the harmonization corpus (the closure method). This proposal is **not** executed pending the G0 decision.

## 9. Gate decision (recorded)

```yaml
gate: G0
decision: APPROVE_WITH_CONDITIONS
authority: Sponsor (Architecture/Migration Authority)
date: 2026-07-19
conditions: [C1, C2, C3, C4]
notes: >
  Sponsor approved the reframed W0 and the gate recommendation. C1 authorizes the W1+
  re-baseline: W1 proceeds as RPH-kernel conformance verification + hollow-layer closure
  against the realized JPWB engine (DIV-W0-001 RESOLVED; DEC-W0-001 EFFECTIVE). C2 (auth
  gap DIV-W0-003) hard-gated before any multi-tenant deployment; owned by WS-I / W10.
  C3 (corpus ratification recorded — DIV-W0-005) and C4 (hollow-layer closure tracked in
  the divergence register under W1) remain standing conditions. Next artifact: JAN-W1-DR-001.
```
