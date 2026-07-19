# Master Roadmap Change-Control Record — Legacy Removal Re-Scope

**Discharges:** `DIV-W0-001` / `DIV-W1-003` (the owed successor-master revision input). **Authority:** Coding agent under delegated sponsor authority (procedure change 2026-07-19). **Triggers (master §20):** a change to *semantic-authority strategy* and to *program scope*, both of which §20 says require a successor Master Roadmap revision. This record is that revision's normative input; it does not itself edit `JAN-ROADMAP-001-v2` in place (master §20: repository-route changes update Detailed Roadmaps, but a wave-order / capability-outcome change updates the Master).

## 1. The triggering decision

At W0 the sponsor ruled: **"janumicode and janumicode v2 are legacy codebases, we don't have anything to import, migrate, inherit, etc. from them at this point."** Legacy JanumiCode was therefore classified **REMOVE**, and JPWB (the RPH engine in this repository) is the **live subject of record** — a mature, greenfield RPH implementation, not a system being migrated *from* a running legacy phase-engine.

## 2. What this changes in the Master Roadmap

`JAN-ROADMAP-001-v2` §1 frames the program as "migrating legacy JanumiCode from its hardcoded phase-oriented architecture to the canonical Janumi model." That brownfield-migration framing is **falsified by the repository evidence**: there is no writable legacy semantic plane in JPWB to shadow, cut over, or retire. Three waves are materially re-scoped:

| Wave | As written (legacy-migration) | Re-scoped outcome (legacy removed) |
| --- | --- | --- |
| **W5 — Legacy Shadow Mode & Conformance Comparison** | Observe real legacy Product Lens executions; shadow-map legacy runs; compare legacy vs RPH; classify divergence | **DEFER/REMOVE the shadow-comparison WPs** (WP-5-001/002/004/005/006 — nothing legacy to instrument or compare). **RETAIN WP-5-003 "Compatibility Milestone Derivation"** as a native RPH concern — the *versioned* legacy-phase-label derivation that refines the W2 baseline Compatibility projection (already built, `8307f89d`). |
| **W6 — RPH Authority for Pilot Undertakings** | Selected Undertakings operate with RPH as sole authority while legacy serves as governed adapter; pilot rollback of authority transfer | **REMOVE the authority-transfer/legacy-adapter WPs** (WP-6-001's "reject legacy semantic writes", WP-6-002 legacy execution adapter, WP-6-003 pilot rollback of transfer). RPH is *already* the sole semantic authority (there is no second writable plane — the very invariant W6 exists to establish). **RETAIN** the native residue: per-Undertaking authority *mode* as an RPH concept, operational telemetry, and cohort evaluation, folded into W3/W8. |
| **W7 — Full Product Realization PWA Migration** | Complete software-product realization path through the PWA/RPH; **retire hardcoded phase state as semantic authority** | **REMOVE the "legacy phase authority retirement" WP** (WP-7-008 — nothing to retire). **RETAIN as genuine forward work** the product-behavior/implementation/validation modeling (WP-7-001..007): actors/capabilities/journeys/requirements/acceptance-criteria as traceable work outputs, dynamic implementation-PWU decomposition, coding-agent integration, integrated V&V, intent-to-Product-Baseline traceability, and commit/deployment/baseline separation. These are NOT legacy-migration; they extend the vertical slice (W3) to the full product path and fold forward into W8+ / W3. |

Waves **W3, W4, W8, W9** are essentially unchanged by legacy removal (they are about the RPH vertical slice, demonstration UX, JPWB self-hosting, and tenant customization — all native). Wave **W10** (productization: platform tenancy, Square billing, multi-surface, enterprise hardening) is unchanged in intent but remains gated on external infrastructure + the authentication gap (carried condition **C2**).

## 3. Semantic-authority-strategy change (the §20 trigger)

Master §7 completion condition #3 ("legacy phases reduced to derived compatibility milestones") and invariant 11 ("Legacy phases SHALL become derived compatibility projections before full cutover") are **already satisfied by construction**: JPWB has no authoritative legacy phase state; the phase labels exist only as the derived, non-authoritative Compatibility projection (W2-INC-3). "Before full cutover" is vacuous — there is no cutover, because there is no legacy authority to cut over from.

## 4. Net effect on the completion condition (master §7)

The program mission narrows to its genuine, native form: **establish JPWB + the Product Realization PWA operating through the RPH end-to-end (intent → Product Baseline), with JPWB able to author/evolve the PWA it uses (self-hosting), tenant derivation + Product Shape export, and production platform integration.** The "safely migrating legacy JanumiCode" clause is **struck** (satisfied vacuously by removal). No mandatory invariant or prohibited shortcut is weakened; the change is a *scope contraction* (fewer WPs) plus a re-labelling of the compatibility/authority residue as native.

## 5. Disposition

- **This record is the successor-master revision input.** A formal `JAN-ROADMAP-001 v2.1` incorporating §2's re-scope MAY be issued by the sponsor; until then, each affected wave's Detailed Roadmap gate records the DEFER/REMOVE disposition of its legacy-dependent WPs against this record, and `DIV-W0-001`/`DIV-W1-003` are marked **RESOLVED-PENDING-RATIFICATION** (the substance is decided and recorded; only the formal master re-issue remains, which is a sponsor editorial act).
- No code change accompanies this record; it is a governance artifact (WS-A).
