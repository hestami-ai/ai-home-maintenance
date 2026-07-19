# JAN-W4-DR-001 — Detailed Implementation Roadmap

**Wave:** W4 — Demonstration PWA and Undertaking UX. **Master:** `JAN-ROADMAP-001@2.0.0-draft`. **Predecessor gate:** G3 APPROVE_WITH_CONDITIONS (2026-07-19). **Standard:** `JAN-ROADMAP-001-A`. **Language:** normative.

## 1. Normative outcome (master §14 W4)

The Product Realization PWA and the Field Service Management SaaS Undertaking SHALL be intelligible and operable through clearly separated PWA-definition and Undertaking-instance surfaces.

## 2. Current-state finding (code-grounded — 36-read inventory of `apps/rph-demo`)

The demonstration app is **substantially built and runs the REAL engine** (not mocked): `server/workbench.ts` constructs a live `createEngine` + `seedWorkbench` (authors/publishes the Product Realization PWA, instantiates the FSM Undertaking, drives it to a promoted authoritative Architecture Baseline); pages read live projections; form actions dispatch real `DomainCommand`s; the agent runs over an engine fork with hash-matched accept. `RPH_DEMO_MODE=test` gives a deterministic engine + `/test-api` introspection for E2E (~23 specs).

**EXISTS (strong):** WP-4-001 (PWA Library + Designer — composition tree, inspector, publication FSM, floor rail), WP-4-002 (Undertaking Portfolio + version-bound instantiation), WP-4-003 (Professional Work Graph + four independent axes), WP-4-006 (dual assurance workbench: PWA floor + §38 Assurance View + policy manager), and the Decision half of WP-4-007. A PWA-Design-vs-Undertaking context banner enforces the master's "clearly separated surfaces."

## 3. Genuine gaps + disposition

| Gap | WP | Disposition |
| --- | --- | --- |
| **Traceability UI absent** (the traceabilityProjector had zero UI consumer) | 4-007 | **CLOSED — W4-INC-1 (`d46bf08b`)**: a read-only traceability tab in the Undertaking Workbench rendering the typed intent-to-baseline link graph, E2E-proven |
| Object Inspector + 4-way edit classification (presentation/execution/semantic/governance) | 4-004 | **DEF-W4-001**: no edit-classification taxonomy exists anywhere; a bounded design increment (define the classification + gate every edit). The presentation-vs-command boundary is already enforced structurally (canvas moves are presentation-only; agent candidates require hash-matched accept) |
| Execution Workbench drill-down (steps/attempts/runtime-binding/recovery/provenance) | 4-005 | **DEF-W4-002**: the execution machinery is driven; only the drill-down UI (beyond the summary table) is missing |
| Baseline promotion-to-AUTHORITATIVE in the UI (engine supports it; the demo route stubs it) | 4-007 | **DEF-W4-003**: the engine's `promoteBaseline` is fully wired (WIRE-4/3b); the UI needs the promotion-decision orchestration form |
| Accessibility verified/gated (a11y is practiced — aria/roles/keyboard — but not audited) | 4-008 | **DEF-W4-004**: add an axe/contrast automated a11y gate |

## 4. Selected strategy

W4 is, like W1–W3, a **closure wave over a substantially-built surface**. The one "backend-built, UI-absent" enforcement-adjacent gap (traceability) is closed with a real, E2E-tested increment (INC-1). The remaining gaps are genuine but bounded UI features (edit-classification, execution drill-down, baseline-promotion form, a11y gate) — dispositioned as W4 deferrals, not silently dropped, because the underlying capabilities all exist and are tested at the engine layer.

## 5. Carried from G3

**C3-1** (drive the Architecture-Coverage + Intent-Preservation assessments in the reference undertaking): folds into the assurance-workbench surface — once driven, the §38 Assurance View already renders them. Remains a fixture-enrichment increment (DEF-W3-002 sibling).

## 6. Gate G4

Assembled per master §17 on completion of INC-1 with full gate + E2E green. Recorded by the coding agent under delegated authority.
