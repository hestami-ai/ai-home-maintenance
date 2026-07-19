# JAN-W3-DR-001 — Detailed Implementation Roadmap

**Wave:** W3 — Intent-to-Architecture RPH Vertical Slice. **Master:** `JAN-ROADMAP-001@2.0.0-draft`. **Predecessor gate:** G2 APPROVE (2026-07-19). **Standard:** `JAN-ROADMAP-001-A`. **Language:** normative.

## 1. Normative outcome (master §14 W3)

One complete professional path SHALL operate through the RPH from raw intent to an authoritative Architecture Baseline.

## 2. Current-state finding (see `evidence/vertical-slice-current-state.md`)

**The outcome is already reached.** `seedWorkbench` / `driveReferenceUndertaking` drives intent → published PWA → Undertaking → 13-PWU graph → decomposition → real execution steps → earned assurance → a PROMOTED AUTHORITATIVE Architecture Baseline, live through `engine.dispatch`. WP-3-005 (execution), WP-3-006 (assumption/evidence admission), and WP-3-009 (governance/promotion) are genuinely done and driven. W3 is therefore, like W1/W2, a **closure wave over a working slice** — the remaining gaps are precise enforcements + fixture enrichment, not a missing path.

## 3. Selected strategy & increments

The wave closes the two genuine **enforcement** gaps red-first (done), and dispositions the remaining **fixture-enrichment / sub-program** gaps at G3:

| Increment | WP | Outcome (normative) | Status |
| --- | --- | --- | --- |
| **W3-INC-1** | 3-003 | ApproveIntent SHALL bind an exact semantic version (approvedSemanticVersion == the intent's current version), else reject (master invariant 7; Intent analog of RPH-GOV-003). | **DONE** `4e9c3912` (red-first + controlled) |
| **W3-INC-2** | 3-008 | An expired/falsified/superseded assumption SHALL NOT authorize new work: ExpireAssumption instantiates the expiry transition, and ApproveExecutionPlan rejects on a dead assumption (RPH-ASM-006, kernel `canAuthorizeNewWork`). | **DONE** `9bcdca57` (red-first + controlled) |

## 4. Dispositioned at G3 (genuine, but not enforcement gaps)

These are **fixture-enrichment or bounded sub-programs**, not missing controls — the controls exist and are unit- or slice-tested. They are recorded as G3 conditions/deferrals, not silently dropped:

- **WP-3-007** (coverage/preservation assessments): the `pol_architecture_coverage` / `pol_intent_preservation` / fidelity / completeness policies are seeded ACTIVE with typed findings and declared on the PWU Types, but the slice runs every assessment under `pol_fitness_for_purpose`. **Condition C3-1:** drive at least one Architecture-Coverage + one Intent-Preservation assessment in the reference undertaking (a fixture-enrichment increment touching the conformance oracle). The assurance MECHANISM (independence, Gates A–D, typed findings) is already proven.
- **WP-3-008 remainder:** FalsifyAssumption (with impact analysis) + the ReshapePwu → successor-semantic-version → reassessment loop. **Deferral DEF-W3-001:** a bounded sub-program (like W1's object plane); the expiry/`canAuthorizeNewWork` slice is closed (INC-2).
- **WP-3-004** (drive real obligation allocation) + **WP-3-005** (drive a RuntimeBinding end-to-end): **DEF-W3-002** — move P2/P3 conservation + capability authorization from unit-tested to slice-driven via fixture enrichment.

## 5. Legacy re-scope note

Per `../../MASTER-CHANGE-CONTROL-2026-07-19-legacy-removal.md`, the product-behavior/implementation modeling that W7 (as written) carried folds forward from this vertical slice; W3 remains the intent→architecture proof and is unaffected by legacy removal.

## 6. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| The version-binding gate could reject a legitimate approval of a just-revised intent | Low | It requires the approval to name the CURRENT version — the correct, master-invariant-7 behavior; re-approve the current version |
| The assumption gate is vacuous where PWUs carry no assumptions | Low (by design) | Non-breaking; fires only on a genuinely dead assumption; the reference slice (empty assumptionIds) is unaffected |
| WP-3-007 assessments not yet driven → the slice under-demonstrates intent-specific assurance | Medium | Disclosed C3-1; the mechanism is proven; the gap is demonstration, not capability |

## 7. Gate G3

Assembled per master §17 on completion of INC-1/INC-2 with full gate green. Recorded by the coding agent under delegated authority.
