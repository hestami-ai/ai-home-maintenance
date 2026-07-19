# G3 Gate Package — RPH Vertical-Slice Proof

**Wave:** W3 — Intent-to-Architecture RPH Vertical Slice. **Gate:** G3. **Predecessor:** G2 APPROVE (2026-07-19).
**Assembled per:** `JAN-ROADMAP-001` §17. **Decision:** `APPROVE_WITH_CONDITIONS` (recorded §6, delegated sponsor authority per the 2026-07-19 procedure change).

## 1. Master work-package status

| WP | Status | Evidence |
| --- | --- | --- |
| 3-001 PWA reg + Undertaking | **CONFORMANT** | `CreateUndertaking` binds a PUBLISHED PWA exact version (RPH-CON-009); ownership enforced per child |
| 3-002 Intent capture/formalize | **CONFORMANT** | full lifecycle; originating expression preserved; intent traceable into every PWU |
| 3-003 Intent assurance + baseline | **CONFORMANT (assurance-gate deferred)** | **W3-INC-1: ApproveIntent enforces exact version binding (`4e9c3912`)**; Intent Baseline exists; intent-fidelity/completeness assessment gate → C3-1 |
| 3-004 Arch decomposition assurance | **CONFORMANT (kernel) / DEFER (slice-drive)** | P2/P3 conservation + recomposition wired (W1) + non-vacuously unit-tested; driving real allocation in the slice → DEF-W3-002 |
| 3-005 Execution Plan + harness | **CONFORMANT** | plan/steps/AI-floor gate driven end-to-end; RuntimeBinding drive → DEF-W3-002 |
| 3-006 Assumption + evidence | **CONFORMANT** | first-class assumption minted in slice; §8.11 admissibility enforced at AdmitEvidence |
| 3-007 Coverage/Preservation assurance | **PARTIAL → C3-1** | policies seeded ACTIVE + typed + declared; assessments run under fitness_for_purpose only — drive coverage/preservation assessments |
| 3-008 Reshape/impact/reassessment | **PARTIAL → improved / DEF-W3-001** | **W3-INC-2: expiry transition + RPH-ASM-006 gate at ApproveExecutionPlan (`9bcdca57`)**; falsification + reshape loop → DEF-W3-001 |
| 3-009 Governance + baseline promotion | **CONFORMANT** | canPromoteBaseline + WIRE-4 + WIRE-3b; driven to AUTHORITATIVE Architecture Baseline |

## 2. Headline

W3's normative outcome — **one complete path from raw intent to an authoritative Architecture Baseline** — is **reached and driven live** (two real-pipeline drives; terminal state = promoted AUTHORITATIVE Architecture Baseline). W3 was a closure wave over a working slice. Two genuine enforcement gaps closed red-first + controlled: intent exact-version binding (INC-1) and the RPH-ASM-006 dead-assumption gate (INC-2). The remaining gaps are demonstration/fixture-enrichment + a bounded reshape-loop sub-program, disclosed — not missing controls.

## 3. Conformance baseline

`check-types` 21/21 · full `bun run test` 21/21 tasks · `lint` clean · `boundary` 174 modules / 0 violations · reference fixture green. Every W3 code increment red-first (the violating input goes red before the fix) + controlled (a green case proves the gate is not a blanket reject).

## 4. Wave exit criteria (master §14 W3)

- End-to-end raw-intent → Architecture-Baseline path passes — **MET** (driven live).
- Architecture execution may succeed while architecture assurance rejects, without state conflation — **MET** (INV-5 upheld; Mobile & Offline CONDITIONALLY_SATISFIED, not qualified).
- Human decisions bind exact semantic versions — **MET + strengthened** (intent version binding now enforced, INC-1; baseline promotion already enforced, WIRE-4).
- Assumptions, evidence, findings, and traceability are canonical — **MET** (first-class assumption + admissibility; Traceability projection W2-INC-3).
- Restart and uncertain-operation recovery tests pass — **MET** for the outbox (W2-INC-2); execution-plane external-op reconciliation folds forward (DEF-W1-001).

## 5. Decisions, deferrals, divergences

- **DEC-W3-001** (EFFECTIVE): W3 is a closure wave over a working slice; close enforcement gaps, disposition demonstration gaps.
- **DEF-W3-001**: FalsifyAssumption + the ReshapePwu → successor-version → reassessment loop (WP-3-008 remainder) — a bounded sub-program.
- **DEF-W3-002**: drive real obligation allocation (WP-3-004) + a RuntimeBinding (WP-3-005) in the reference slice — fixture enrichment (P2/P3 + capability authorization already tested).
- **Carried:** C2 (auth gap, hard-gated pre-multi-tenant); DIV-W1-003 (successor-master, input recorded in the change-control note).

## 6. Recommendation & decision

**`APPROVE_WITH_CONDITIONS`.**

**Condition C3-1:** the Architecture-Coverage and Intent-Preservation assessments (WP-3-007) SHALL be driven in the reference undertaking before W4's demonstration UX claims to surface intent-specific assurance — the assurance mechanism is proven, but the intent-specific evaluations are not yet demonstrated. Tracked as a W3/W4-boundary fixture-enrichment increment.

```yaml
gate: G3
decision: APPROVE_WITH_CONDITIONS
authority: Coding agent under delegated sponsor authority (procedure change 2026-07-19)
date: 2026-07-19
conditions: [C3-1]                 # drive coverage + preservation assessments (WP-3-007)
deferrals: [DEF-W3-001, DEF-W3-002]
carried: [C2, DIV-W1-003]
commits: [4e9c3912, 9bcdca57]
notes: >
  Vertical slice reaches an authoritative Architecture Baseline live. Two enforcement gaps closed
  red-first (intent version binding; RPH-ASM-006 dead-assumption gate). Remaining gaps are
  demonstration/fixture-enrichment + the reshape-loop sub-program, disclosed not fabricated.
```

## 7. Proposed next — W4

`JAN-W4-DR-001` (Demonstration PWA and Undertaking UX). The `rph-demo` SvelteKit app already renders much of the PWA/Undertaking/Professional-Work-Graph surfaces; W4 grounds the genuine UX gaps against the reference undertaking's now-authoritative terminal state, and folds in C3-1 (surfacing the coverage/preservation assessments once driven).
