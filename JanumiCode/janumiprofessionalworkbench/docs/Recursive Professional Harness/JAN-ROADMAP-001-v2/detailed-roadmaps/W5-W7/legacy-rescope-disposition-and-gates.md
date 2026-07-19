# W5–W7 — Legacy-Removed Re-Scope Disposition and Gate Records (G5, G6, G7)

**Waves:** W5 (Legacy Shadow Mode), W6 (RPH Authority for Pilots), W7 (Full Product Realization Migration).
**Governs by:** `../../MASTER-CHANGE-CONTROL-2026-07-19-legacy-removal.md`. **Authority:** coding agent under delegated sponsor authority (procedure change 2026-07-19). **Predecessor:** G4 APPROVE_WITH_CONDITIONS.

> **Why these three waves are dispositioned together and mostly without new code.** All three are legacy-MIGRATION waves — shadow-observing, authority-transferring, and retiring a *running legacy phase-engine*. The sponsor's W0 ruling (legacy = REMOVE; JPWB is the live subject, not a migration source) means **there is no writable legacy semantic plane** in this repository to shadow, cut over, or retire. The master §19 prohibition on *"inventing repository facts to make a roadmap appear complete"* forbids fabricating a legacy engine to migrate from. The faithful outcome is therefore: **REMOVE the legacy-dependent WPs, RETAIN the native residue, and record honest gates** — exactly what a successor-master revision would encode (the change-control note is that revision's input; DIV-W1-003).

## W5 — Legacy Shadow Mode and Conformance Comparison → Gate G5

| WP | Disposition | Basis |
| --- | --- | --- |
| 5-001 Legacy instrumentation & correlation | **REMOVE** | nothing legacy to instrument |
| 5-002 Shadow RPH object/event mapping | **REMOVE** | no legacy runs to shadow-map |
| 5-004 Legacy/RPH divergence comparison | **REMOVE** | no legacy outputs to compare |
| 5-005 Shadow side-effect isolation | **REMOVE** | no shadow mode |
| 5-006 Representative shadow cohort + gate report | **REMOVE** | no shadow cohort |
| **5-003 Compatibility milestone derivation** | **RETAIN (native) — baseline BUILT** | invariant 11 "legacy phases → derived compatibility projections": the rebuildable Compatibility projection (kind → legacy-phase milestone) shipped in **W2-INC-3 (`8307f89d`)**. The *versioned* derivation (milestone advancement as a PWU progresses through its axes) is a native refinement → **DEF-W5-001** (a follow-up over `compatibilityProjector.handlerVersion`, no shape change). |

```yaml
gate: G5
decision: APPROVE_WITH_CONDITIONS
authority: Coding agent under delegated sponsor authority (2026-07-19)
disposition: legacy-shadow WPs REMOVED (no writable legacy plane); WP-5-003 RETAINED (baseline built W2-INC-3)
deferrals: [DEF-W5-001]   # versioned compatibility-milestone derivation (RPH-DOC-005 rules)
carried: [DIV-W1-003]     # successor-master revision formalizing this re-scope
```

## W6 — RPH Authority for Pilot Undertakings → Gate G6

| WP | Disposition | Basis |
| --- | --- | --- |
| 6-001 Per-Undertaking authority mode | **SATISFIED-BY-CONSTRUCTION (native)** | the WP's own core requirement — "RPH-authoritative Undertakings SHALL reject legacy semantic writes" and "no Undertaking has two independently writable semantic state models" — is the invariant the whole engine already upholds: there is exactly ONE writable semantic authority (the command bus; §19 "Maintaining two writable semantic state machines" is the prohibited shortcut, and it is structurally impossible here). No second plane exists to gate. |
| 6-002 Legacy execution adapter under RPH control | **REMOVE** | no legacy execution component to adapt |
| 6-003 Pilot rollback of authority transfer | **REMOVE** | no authority transfer occurs (RPH is authoritative from creation) |
| 6-004 Pilot cohort controls + telemetry | **DEFER → W10** | operational telemetry is a native production concern, folds into W10 observability (WP-10-005) |
| 6-005 Pilot semantic/outcome evaluation | **DEFER → W10** | native evaluation folds into production readiness |
| 6-006 Default-new-Undertaking cutover prep | **REMOVE** | RPH is already the default (and only) authority for new Undertakings |

```yaml
gate: G6
decision: APPROVE_WITH_CONDITIONS
authority: Coding agent under delegated sponsor authority (2026-07-19)
disposition: authority-transfer/legacy-adapter WPs REMOVED; WP-6-001 SATISFIED-BY-CONSTRUCTION (single writable authority)
deferrals: [6-004, 6-005 → W10 observability/readiness]
carried: [DIV-W1-003]
```

## W7 — Full Product Realization PWA Migration → Gate G7

| WP | Disposition | Basis |
| --- | --- | --- |
| **7-001 Product behavior work model** (actors/capabilities/journeys/requirements/acceptance-criteria) | **RETAIN (native) → W8** | genuine forward work — extend the PWA's PWU-Type composition (already authorable via the PWA Designer) with the product-behavior work outputs. Folds into W8 self-hosting (authoring the PWA through JPWB). |
| **7-002 Implementation planning + dynamic PWU decomposition** | **RETAIN (native) → W8** | dynamic implementation-PWU decomposition over the existing decomposition kernel (W1); folds into W8 |
| **7-003 Product implementation + coding-agent integration** | **RETAIN (native)** | the executor/coding-agent integration is a native execution-plane concern; the demo already runs a governed authoring agent over an engine fork |
| **7-004 Integrated product V&V** | **RETAIN (native) → W8** | product-level assurance over the existing assurance kernel + policy library |
| **7-005 Historical consistency / narrative memory** | **DEFER** | a native scoped-evidence concern; not a legacy-migration item |
| **7-006 Intent-to-Product-Baseline traceability** | **PARTLY BUILT** | the Traceability projection (W2-INC-3) + UI (W4-INC-1) already provide typed intent-to-baseline links; extends to Product Baseline once the full product path is driven |
| **7-007 Commit/deployment/handoff/baseline separation** | **RETAIN (native) → W9/W10** | invariant 12 "commits and deployments distinct from baselines" is already upheld (baselines are governance objects, not commits); export/handoff folds into W9 Product Shape Package |
| **7-008 Legacy phase authority retirement** | **REMOVE** | nothing to retire — no legacy phase authority exists |

```yaml
gate: G7
decision: APPROVE_WITH_CONDITIONS
authority: Coding agent under delegated sponsor authority (2026-07-19)
disposition: legacy-retirement WP REMOVED; product-behavior/implementation/V&V modeling (7-001..004,006,007) RETAINED as native forward work folding into W8/W9
deferrals: [7-001..004 → W8, 7-005 narrative memory, 7-007 → W9/W10]
carried: [DIV-W1-003]
notes: >
  W7's genuine residue is the full product path (behavior → implementation → integrated V&V → Product
  Baseline), which is native RPH work, NOT legacy migration. It is authored/exercised through JPWB
  self-hosting (W8) rather than migrated from a legacy engine. Recorded as retained-forward, not done.
```

## Net effect

W5–W7 are driven to documented, honest gates: the legacy-migration WPs are REMOVED (no legacy plane — fabricating one is the §19 prohibition), the invariants they existed to establish (single writable authority; legacy phases as derived projections) are **already upheld by construction**, and the genuine native residue (compatibility-milestone refinement; the full product path) is **retained and folded forward into W8/W9/W10**, not silently dropped. The successor-master revision (DIV-W1-003) formalizing this re-scope remains the one owed governance artifact, its substance recorded here and in the change-control note.
