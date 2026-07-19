# W1 Evidence — Hollow-Kernel Triage (the real wiring worklist)

**Discharges:** the R1 mitigation of `JAN-W1-DR-001` §15 (census staleness) + §6 (per-DWP liveness re-verification).
**Method:** liveness re-verification against current code, then an 8-agent adversarial triage (workflow `wf_4b384bbf-1b2`) classifying every still-dead function as **WIRE / DEAD_BY_DESIGN / DEFER** with a code-grounded production write-path.

## 1. Result

| Stage | Count |
| --- | --- |
| Census (W0 snapshot) DEAD | 55 |
| Now-LIVE (wired by increments R–Y + other work) | 8 |
| Still-dead re-verified | 47 |
| → **WIRE** (genuine W1 hollow gaps) | **5** |
| → **DEAD_BY_DESIGN** (introspection / sibling-API / already-enforced-live) | 19 |
| → **DEFER** (execution-plane / persistence-recovery → W2/W3) | 24 (+ `coverageFor` counted twice) |

**Headline:** the census's "55 dead" overstated the *genuine* W1 governance gap by an order of magnitude. The real W1 wiring worklist is **five functions** — and they are precisely the highest-value invariants master §19 most forbids (obligation/constraint conservation, "children complete ⇏ parent satisfied", evidence-invalidation cascade, and stale-decision version binding).

## 2. WIRE — the 5 genuine gaps (the W1 code work)

| # | Function (kernel def) | Write-path (production) | Invariant | Red-first test |
| --- | --- | --- | --- | --- |
| 1 | `validateObligationConservation` (`rph-domain/src/decomposition.ts:62`) | `handlers/decomposition.ts:86` `ValidateDecomposition` | P2 / RPH-DEC-002/007 / §35.1 "no obligation disappears" | `ValidateDecomposition{VALID}` on a contract whose parent has a MANDATORY obligation left un-allocated/-retained/-satisfied/-waived must be **REJECTED**. |
| 2 | `validateConstraintPropagation` (`decomposition.ts`) | `handlers/decomposition.ts:86` `ValidateDecomposition` (same site) | P3 / RPH-CNS-001..004 / §35.1 "no constraint drops" | `ValidateDecomposition{VALID}` where a MANDATORY applicable parent constraint leaves a relevant child undispositioned must be **REJECTED**. |
| 3 | `evaluateRecomposition` (`decomposition.ts`) | `handlers/decomposition.ts:140` `CompleteRecomposition` | RPH-DEC-005/006 / §14.1 "recomposition ≠ concatenation" | `CompleteRecomposition` with a `detectedConflict` while every child is SATISFIED must go **CONFLICTED** (parent NOT satisfied), not COMPOSABLE. |
| 4 | `classifyEvidenceInvalidation` (`rph-domain/src`) | `handlers/assurance.ts:431` `InvalidateEvidence` | P4 / CT-10 "invalidated evidence re-examines supported claims" | Admit E supporting claim C; `InvalidateEvidence(E)` must flag C for REVALIDATION, not leave it silently supported. |
| 5 | `decisionAuthorizesVersions` (`rph-domain/src`) | `handlers/governance.ts:471` `PromoteBaseline` | P5 / RPH-GOV-003 "decision binds exact versions" | `PromoteBaseline` where the promotion Decision bound S@v1 but the baseline freezes S@v2 must be **REJECTED**. |

Dependency order for wiring: 1+2 (same site) → 3 → 4 → 5. Each ships as one committed increment, red-first + mutation-proven, routing the write-path through the existing kernel (no new rule invented).

## 3. DEAD_BY_DESIGN — recorded, NOT wired (19)

Force-wiring these would duplicate a live gate or decide nothing:

- **State-machine group** (`machineNames`, `isValidState`, `initialStateOf`, `isTerminalState`, `assertTransition`) — introspection accessors and the throwing-API sibling of the **live** `classifyTransition`/`checkTransition` path (`kit.ts:112,424`; `execution.ts:248`; `pwu.ts:669`). Transition legality + unknown-state + terminal-immutability are already enforced there. `assertTransition` would replace typed `CommandResult` rejections with thrown exceptions — a regression.
- **Presentation** (`isPresentationOnlyChange`, `applyPresentationChange`) — P8 is *vacuously* preserved: no persisted-layout domain surface exists (PWA node positions are client-side UI, never entered into the governed store). WIRE candidate only if persisted presentation state is later introduced.
- **`executionAloneSatisfiesAssurance`** — a degenerate constant-false (no input to reject). INV-5/P1 (exec≠assurance) is already enforced live three ways: the `EXECUTING→SATISFIED` illegal matrix edge, `satisfiesP1` in `changePwuState`, and `canAdvanceWorkLifecycle`.
- **`requiresReification`, `coverageFor`, `isEffectiveApproval`, `waiverPreservesFindings`, `isWaiverApplicable`, `assertBaselineItemSetImmutable`, `canSupersedeBaseline`, `resolvePath`** — superseded by live sibling paths or structural enforcement (per-agent evidence in the workflow transcript).
- **Utilities** (`prefixOf`, `citedConcreteTestFiles`) — test/id tooling, not governance rules.

## 4. DEFER → W2/W3 (24)

Execution-plane + persistence-recovery, correctly out of the W1 semantic kernel:

- **W2 idempotency / recovery (WP-2-004/007):** `resolveIdempotency`, `attemptWouldDuplicateSideEffect`, `classifyInterruptedAttempt`, `mayReexecuteWithoutReconciliation`, `canResumeExecutionOnPwu`, `assessDecisionRevocation`, `assessAcceptance`, `assessFalsification`.
- **W3 execution harness (WP-3-005):** `canStartStep`, `canStartStepUnderPlan`, `canSkipStep`, `stepMayBecomeReady`, `bindingPermitsExecution`, `capabilityAuthorized`, `canReuseBindingForNewAttempt`, `assessModelOutput`, `selectControlAction`, `normalizeControlAction`, `blocksIrreversibleWork`, `canAuthorizeNewWork`, `executionSuccessOutcome`.
- **W2/W3 traceability/impact plane:** `validateLinkDirectionality`, `impactedObjects` (need a TraceLink-minting command surface first).
- **Blocked on a contract gap:** `validateAssumptionReification` — deferred beyond DWP-004 (needs an assumption-reification surface); recorded, not forced.

These enter their wave's detailed roadmap (`JAN-W2-DR-001` / `JAN-W3-DR-001`), not W1.

## 4a. STRUCTURAL BLOCKAGE — three of the five WIRE targets operate over un-instantiated runtime planes → **RESOLVED 2026-07-19** (see §4b)

Code-grounding the five WIRE targets during execution revealed a deeper truth than "missing call": **the governance kernels are correct and tested, but the runtime object/graph planes they decide over are never instantiated.** Force-wiring them would produce **vacuous gates** (empty inputs → always "ok" → false assurance), so per the wiring method (R3) they are **failed-closed and disclosed**, not fabricated.

| WIRE | Kernel | Plane it needs | Instantiated at runtime? | Disposition |
| --- | --- | --- | --- | --- |
| WIRE-1 | `validateObligationConservation` | parent Obligation objects (with `strength`) | **No** — zero Obligation commands in the vocab; no minting; `ObligationAllocation` = `{obligationId, allocatedTo[]}` carries no strength; fixture `obligationIds:[]` | **BLOCKED** |
| WIRE-2 | `evaluateRecomposition` | Constraint objects + child-result read-model | **No** — same class; Constraint objects not minted | **BLOCKED** |
| WIRE-3 | `classifyEvidenceInvalidation` | a `TraceGraph` of `SUPPORTS` trace links | **No** — zero `TraceLink`/`Trace*` commands or events; no production `TraceGraph` construction | **BLOCKED (trace-graph form)** |
| WIRE-4 | `decisionAuthorizesVersions` | Decision + Baseline objects + subject versions | **Yes** — all minted (`ProposeDecision`/`ApproveDecision`/`CreateBaseline`/`PromoteBaseline`) | **WIRED (commit `eb32a8bf`)** |

**WIRE-3 has an inline escape the others lack:** the `Claim` object carries `supportingEvidenceIds` inline (set by `AssertClaim`), and the `Claim.status` machine has a `CONTESTED` state — so P4 ("invalidated evidence cannot leave a claim silently SUPPORTED") is enforceable *without* a trace graph. But it is a **design increment, not a wire**: it requires a decision between a **push-cascade** (one `InvalidateEvidence` command contesting N claim aggregates — breaks the single-aggregate-per-command model) and a **pull-guard** (check-on-use: a claim relying on invalidated evidence cannot authorize promotion/satisfaction — the corpus's own framing, `transitions.data.ts` §16.2 note: *"guard on claim support, not an intra-machine transition"*). The current handler defers it "to the controller" — which is not built. This is recorded as `DIV-W1-002` and proposed as its own increment.

**The material finding (for the sponsor at G1):** closing WIRE-1/2/3 is **not** "wire three calls." It is **instantiating the missing runtime planes** — first-class Obligation/Constraint objects (master WP-1-005's own mandate: *"material obligations SHALL become first-class traceable objects"*) and the trace-link/claim-support machinery (WP-1-008) — plus the cascade/guard design for P4. That is a **structural sub-program**, materially larger than a wiring, and its scope/sequencing is a sponsor decision.

## 4b. RESOLUTION — the object-plane sub-program (2026-07-19, delegated authority / DEC-W1-002)

Under the 2026-07-19 procedure change the coding agent resolved the material decision (C1) by **building the object-plane sub-program within W1**, then wiring all five kernels. Each increment is red-first + controlled + full-gate-green.

| WIRE | Plane instantiated | Kernel wired at | Commit |
| --- | --- | --- | --- |
| WIRE-1 | `AssertObligation` mints first-class OBLIGATION objects (carry `strength`) | `validateObligationConservation` at `ValidateDecomposition` (P2) | `28e077f5` + `6020f92f` |
| WIRE-2 | `AssertConstraint` mints first-class CONSTRAINT objects (carry `strength`) | `validateConstraintPropagation` at `ValidateDecomposition` (P3) | `28e077f5` + `6020f92f` |
| WIRE-3a | `ProposeRecomposition` mints the RECOMPOSITION_CONTRACT | `evaluateRecomposition` at `CompleteRecomposition` (§14.1: conflict ⇒ CONFLICTED even when all children SATISFIED) | `20a3733e` |
| WIRE-3b | (no new plane) forward claim→evidence chain + decision considered-evidence | pull-guard at `PromoteBaseline` (P4/CT-10) — corpus §16.2 framing, NOT a push-cascade or trace graph | `6dc18d00` |
| WIRE-4 | (already instantiated) Decision + Baseline | `decisionAuthorizesVersions` at `PromoteBaseline` (P5) | `eb32a8bf` |

**Why this is not a vacuous gate.** Every gate LOADS the real objects and fires only when there is genuinely something to conserve (a mandatory obligation/constraint the decomposition leaves unaccounted), a real detected conflict, or real invalidated evidence. The Field Service reference fixture — whose PWUs carry `obligationIds:[]`/`constraintIds:[]` and whose decompositions allocate nothing — passes untouched (64/64 engine tests green throughout). The one plane deliberately NOT built is the typed trace-link graph (`validateLinkDirectionality`/`impactedObjects`): WIRE-3b was designed to need only forward references so it did not depend on it, and it is deferred to W2 (DEF-W1-002) where the durable event store + rebuildable projections make a trace graph natural.

## 5. Consequence for the W1 roadmap

`JAN-W1-DR-001` DWP-003 (state machines) is **already CONFORMANT** (transition enforcement live via `classifyTransition`); its only WIRE items were presentation functions, now DEAD_BY_DESIGN. DWP-004/005/006/007 collapse to the **five** WIRE increments above. This is recorded as a route refinement (Standard §9, living roadmap) — the master W1 *outcomes* are unchanged; the *gap* is smaller and sharper than the census implied.
