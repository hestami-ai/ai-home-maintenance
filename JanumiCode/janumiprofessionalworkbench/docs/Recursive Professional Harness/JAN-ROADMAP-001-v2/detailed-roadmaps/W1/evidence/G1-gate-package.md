# G1 Gate Package — Semantic Kernel Conformance

**Wave:** W1 — RPH Semantic Kernel and Contract Foundation. **Gate:** G1. **Predecessor:** G0 APPROVE_WITH_CONDITIONS (C1 authorized the W1 re-baseline).
**Assembled per:** `JAN-ROADMAP-001` §17. **Decision:** `APPROVE` (recorded §8, delegated sponsor authority per the 2026-07-19 procedure change — see below).

> **PROCEDURE CHANGE (2026-07-19).** The sponsor delegated gate-decision authority to the coding agent: "use rigor and judgement to implement the full roadmap without consulting me at these gate decision points… my agreement / authorization… will be represented by committing the code and documentation." Under this authority the coding agent resolved this gate's one open condition (C1 below) by **building the object-plane sub-program within W1** rather than deferring it, and records the gate decision itself. The commits ARE the authorization.
>
> **The material scope decision `DIV-W1-001`/`DIV-W1-002` is now RESOLVED, not open.** The runtime object/graph planes the conservation/cascade family decides over — first-class Obligation/Constraint objects, the RecompositionContract, and the claim→evidence support chain — have been INSTANTIATED and the five WIRE kernels are now enforced non-vacuously at their live write paths. The "hollow governed layer" is closed for the W1 semantic kernel.

## 1. Master work-package status

| Master WP | Outcome | Status | Evidence |
| --- | --- | --- | --- |
| WP-1-001 Contract scaffold | single canonical source; reject-unknown | **CONFORMANT** | gen reproducible (no drift modulo prettier); 47 `strictObject`/0 loose |
| WP-1-002 Registry & identity | opaque identity + provenance + semver | **CONFORMANT** | 30 object types; ULID; P8 presentation-independence property-tested |
| WP-1-003 Intent aggregate | version-bound intent authority | **CONFORMANT (verify)** | intent lifecycle live; pwaVersion precision (Increment S) |
| WP-1-004 PWU + independent state | independent work/exec/assurance/shape states; legal/illegal transitions | **CONFORMANT** | transition enforcement live via `classifyTransition`/`checkTransition` (`kit.ts:424`); exec≠assurance (INV-5/P1) enforced 3 ways |
| WP-1-005 Obligation/Constraint/Assumption | conservation survives decomposition; assumptions first-class | **CONFORMANT** | first-class Obligation/Constraint objects minted (`AssertObligation`/`AssertConstraint`, commit `28e077f5`); **obligation conservation (P2) now enforced at ValidateDecomposition** (WIRE-1, `6020f92f`); assumptions already first-class (`DetectAssumption`) |
| WP-1-006 Decomposition/Recomposition | children-complete ⇏ parent-satisfied | **CONFORMANT** | **constraint propagation (P3) enforced at ValidateDecomposition** (WIRE-2, `6020f92f`); RecompositionContract minted (`ProposeRecomposition`) + **CompleteRecomposition now evaluates** (conflict ⇒ CONFLICTED even when all children SATISFIED) (WIRE-3a, `20a3733e`) |
| WP-1-007 Claim/Evidence/Assurance | claims + admissible evidence; invalidation cascade | **CONFORMANT** | assurance rule-arrays ENFORCED (R–Y); **evidence-invalidation now blocks promotion** via the pull-guard (WIRE-3b / P4 / CT-10, `6dc18d00`) |
| WP-1-008 Decision/Baseline/Traceability | version-bound decisions; immutable baselines; typed links | **CONFORMANT (typed-link plane DEFERRED)** | stale-decision-version blocks promotion (WIRE-4, RPH-GOV-003/P5, `eb32a8bf`); immutable baselines enforced; typed trace-link plane DEFERRED to W2 (DEF-W1-002) — not a W1 exit blocker |

Detailed WPs: DWP-001 CONFORMANT; the five WIRE increments (obligation conservation, constraint propagation, recomposition evaluation, evidence-invalidation pull-guard, stale-decision version) all COMPLETE + red-first + full-gate-green.

## 2. Code-grounded findings (headline)

1. **The census's 55 "dead" functions collapsed to 5 genuine gaps** (19 DEAD_BY_DESIGN, 24 DEFER-to-W2/W3, 8 already-live). W1 is a far smaller wave than the census implied — the honest current-state truth W0 promised. See `hollow-kernel-triage.md`.
2. **All five WIRE gaps are now CLOSED** — each red-first, mutation-proven, routed through the existing kernel, full-gate-green:
   - WIRE-1 obligation conservation (P2) + WIRE-2 constraint propagation (P3) at `ValidateDecomposition` (`6020f92f`);
   - WIRE-3a recomposition evaluation (§14.1 conflict ⇒ CONFLICTED) at `CompleteRecomposition` (`20a3733e`);
   - WIRE-3b evidence-invalidation pull-guard (P4/CT-10) at `PromoteBaseline` (`6dc18d00`);
   - WIRE-4 stale-decision version binding (P5/RPH-GOV-003) at `PromoteBaseline` (`eb32a8bf`).
3. **The structural blockage is RESOLVED, not disclosed.** Three of the five gaps were blocked at first grounding because the runtime object/graph planes were un-instantiated. Per the delegated authority + C1, those planes were BUILT (not force-wired over emptiness): `AssertObligation`/`AssertConstraint` mint first-class Obligation/Constraint objects carrying `strength` (`28e077f5`); `ProposeRecomposition` mints the RecompositionContract; the evidence-invalidation guard follows the existing forward claim→evidence chain. No vacuous gate was shipped — the gates fire only when there is genuinely something to conserve / a real conflict / real invalidated evidence, and the Field Service reference fixture (which carries none) stays green throughout.

## 3. Conformance baseline (re-attested)

`check-types` 21/21 · `rph-application` 167 pass / 1 pre-existing skip (+20 across the sub-program: 3 mint, 8 conservation, 6 recomposition, 3 evidence-invalidation) · `rph-engine` reference fixture 64 pass · all packages `test` green · `lint` clean · `boundary` 165 modules / 0 violations · contract regen reproducible (no enums/objects/schema-JSON drift modulo prettier). The gate proves the kernel **and** the production wiring for all five WIRE targets, each red-first (the violating input goes red before the fix) and controlled (a discriminating green case proves the gate is not a blanket reject).

## 4. Decisions, deferrals, divergences

- **DEC-W1-001** (EFFECTIVE): adopt the wiring method (route through kernel, red-first, fail-closed, no fabrication).
- **DEC-W1-002** (EFFECTIVE, 2026-07-19): resolve C1 by building the object-plane sub-program WITHIN W1 (delegated authority). Instantiate the missing runtime planes rather than defer — WP-1-005's own mandate ("material obligations SHALL become first-class traceable objects").
- **DIV-W1-001** (MATERIAL, **RESOLVED** `28e077f5`+`6020f92f`+`20a3733e`): the Obligation/Constraint/RecompositionContract object model is now instantiated; conservation (P2), propagation (P3), and recomposition (§14.1) are enforced non-vacuously.
- **DIV-W1-002** (MATERIAL, **RESOLVED** `6dc18d00`): the evidence-invalidation gap is closed as a PULL-GUARD at `PromoteBaseline` (P4/CT-10) over the forward claim→evidence chain — the corpus's own framing (§16.2), not a push-cascade.
- **DIV-W1-003 / carried DIV-W0-001** (OPEN): the successor Master Roadmap revision formalizing the wave re-baseline remains owed (see §20 master change-control — the W1 route refinements are Standard §9 living-roadmap updates and do not by themselves require a master revision; the re-baseline of the *legacy-migration framing* to *JPWB-live* does).
- **DEF-W1-001**: execution-plane / persistence-recovery kernel functions (24) → W2/W3.
- **DEF-W1-002**: the typed trace-link plane (`validateLinkDirectionality`, `impactedObjects`, typed SUPPORTS/DERIVES links) → W2 (persistence/projections is where a durable trace graph naturally lands). WIRE-3b intentionally does NOT depend on it (forward references suffice for the promotion guard).

## 5. Residual risk

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Conservation/cascade invariants unenforced at runtime | **Closed** | WIRE-1/2/3a/3b + object planes instantiated; enforced at live write paths, red-first + controlled |
| Stale-version promotion | Closed | WIRE-4 (`eb32a8bf`) |
| Constraint relevance model is "all children of the decomposition" (fail-closed) | Low | Faithful §11.2 reading; a not-relevant child is dispositioned INAPPLICABLE; a live constraint (PROPOSED/ACTIVE) only — waived/inapplicable are ungated |
| Child-acceptability derived from `assuranceState` couples recomposition to the assurance rollup | Low | Correct per §14.1; caller cannot fake it; kernel precedence unit-tested |
| Typed trace-link plane still absent | Low | DEF-W1-002 → W2; the P4 promotion guard does not need it |
| Authentication gap (`DIV-W0-003`) | Med (multi-tenant) / Low (today) | C2 carried — hard-gated before multi-tenant |

## 6. Recommendation & decision

**`APPROVE`.** W1's contract + identity + transition-enforcement + intent + exec≠assurance substrate is CONFORMANT, and all five genuine governance gaps the census surfaced are now **closed and gated at their live write paths** — the "hollow governed layer" W0 hypothesized is genuinely closed for the semantic kernel, with no vacuous enforcement shipped. The wave exit criteria (§14 W1) are met: the reference fixture validates against the canonical contracts; legal/illegal transitions are enforced; execution, assurance, and shape-integrity states are independent; all W1 invariant + contract tests pass.

## 7. Proposed next — W2

`JAN-W2-DR-001` (Durable Persistence, Events, and Projections) proceeds. Fold in the DEFERRED items: the typed trace-link plane (DEF-W1-002) lands naturally with the durable event store + rebuildable projections, and the 24 execution/recovery kernel functions (DEF-W1-001) are W2/W3. See `../../W2/JAN-W2-DR-001-detailed-implementation-roadmap.md`.

## 8. Gate decision (recorded)

```yaml
gate: G1
decision: APPROVE
authority: Coding agent under delegated sponsor authority (procedure change 2026-07-19; the commits ARE the authorization)
date: 2026-07-19
conditions_resolved: [C1]      # object-plane sub-program built within W1 (DEC-W1-002)
conditions_carried: [C2, C3]   # C2 auth gap hard-gated pre-multi-tenant; C3 successor-master re-baseline owed
notes: >
  All five WIRE targets closed red-first + controlled + full-gate-green (commits 28e077f5, 6020f92f,
  20a3733e, 6dc18d00, and prior eb32a8bf). No vacuous gate shipped; reference fixture green throughout.
  Typed trace-link plane deferred to W2 (DEF-W1-002); does not block W1 exit.
```
