# W3 Evidence — Intent-to-Architecture Vertical Slice Current-State (code-grounded)

**Method:** 31-read fan-out inventory across `packages/rph-application/src/handlers/*` and the driven fixtures (`rph-engine/src/reference-undertaking.ts`, `seed-workbench.ts`). Discharges master §15 (code-grounded detailed roadmap).

**Headline:** the vertical slice **EXISTS and runs end-to-end through the real command pipeline.** `seedWorkbench` (and standalone `driveReferenceUndertaking`) drives raw intent → published PWA → Undertaking → 13-PWU graph → decomposition → real execution steps → earned assurance → **PROMOTED, AUTHORITATIVE Architecture Baseline** (`reference-undertaking.ts:862-872`; asserted `seed-workbench.test.ts:120-128`, `reference-undertaking.test.ts:154-159`). The slice terminates exactly at the wave's normative outcome (an authoritative Architecture Baseline) and correctly does NOT reach a Product Baseline (out of W3 scope). Two live drives exist through `engine.dispatch`, not replayed logs.

## Per-WP verdicts

| WP | Verdict | Core finding |
| --- | --- | --- |
| 3-001 PWA reg + Undertaking instantiation | **EXISTS** | `CreateUndertaking` binds a PUBLISHED PWA exact version (fails closed otherwise, RPH-CON-009); ownership enforced per child at `proposePwu`. Standalone reference drive is Undertaking-local (doesn't bind); the seed path binds. |
| 3-002 Intent capture/formalize | **EXISTS** | Full RAW→…→APPROVED lifecycle; originating expression preserved; intentId traces into every PWU. Gap: discovery/provision mint no first-class ambiguity artifacts. |
| 3-003 Intent assurance + Intent Baseline | **PARTIAL → improved (W3-INC-1)** | No fidelity/completeness assessment gate before ApproveIntent; **approvedSemanticVersion was recorded but not enforced → NOW ENFORCED (W3-INC-1, `4e9c3912`)**; Intent Baseline exists as an object (backed by generic fitness policy). |
| 3-004 Arch decomposition assurance | **PARTIAL** | Conservation gate (P2/P3, wired W1) + recomposition are correct but the reference decomposes with EMPTY obligations, so they are **non-vacuously unit-tested but not driven in the slice**; `AssertObligation`/real allocation never exercised end-to-end. |
| 3-005 Execution Plan + harness | **EXISTS end-to-end** | Plan lifecycle + steps + AI-floor gate genuinely enforced and driven (`shapeAndExecute`). RuntimeBinding (authorized roles/tools/capabilities) is only unit-tested — `authorizedRuntimeBindingIds: []` in the slice. |
| 3-006 Assumption + evidence admission | **EXISTS** | `DetectAssumption` mints a first-class MATERIAL assumption in the slice; `AdmitEvidence` enforces §8.11 admissibility (6 of 8 conditions). Step-carried `detectedAssumptionIds` disclosure plumbed but not driven. |
| 3-007 Coverage/Preservation assurance | **PARTIAL** | Policies `pol_architecture_coverage`/`pol_intent_preservation` (+fidelity/completeness) are **seeded ACTIVE with typed findings** and declared on the PWU Types, but **every assessment in the slice runs under `pol_fitness_for_purpose`** — they are never instantiated as distinct evaluations. |
| 3-008 Reshape/impact/reassessment | **PARTIAL → improved (W3-INC-2)** | Handlers (Reshape/Challenge/Invalidate/Supersede) + impact kernels exist but were **never triggered**. The Assumption lifecycle was un-instantiated beyond PROPOSED (only DetectAssumption). **W3-INC-2 (`9bcdca57`) instantiated the expiry transition + wired `canAuthorizeNewWork` (RPH-ASM-006) at ApproveExecutionPlan.** The falsification transition + the full reshape→successor-version→reassessment loop remain. |
| 3-009 Governance + baseline promotion | **EXISTS** | Fully wired (canPromoteBaseline + WIRE-4 stale-version + WIRE-3b invalidated-evidence guards) and driven to AUTHORITATIVE; immutability afterwards. |

## Genuine gaps (post-W3-increments)

1. **WP-3-007** (largest remaining): the coverage/preservation/fidelity policies are declared + typed + seeded but never run as assessments in the slice — the slice proves the assurance MECHANISM (independence, gates, findings) under a single fitness policy, not the intent-specific evaluations. Closing this = drive at least one Architecture-Coverage and one Intent-Preservation assessment in the reference undertaking. **Genuine, in-repo, but touches the conformance-oracle fixture** (adds events) — a careful fixture-enrichment increment.
2. **WP-3-008 remainder**: FalsifyAssumption (with impact) + the ReshapePwu → successor-semantic-version → reassessment loop trigger. A bounded sub-program (like W1's object plane).
3. **WP-3-004**: exercise real obligation allocation in the slice (move P2/P3 from unit-tested to driven) — fixture enrichment.
4. **WP-3-005**: exercise a RuntimeBinding (authorized capability) end-to-end — fixture enrichment.

These four are **fixture-enrichment / bounded-sub-program** work, not missing enforcement — the enforcements exist and are (unit- or slice-) tested. They are dispositioned at G3.
