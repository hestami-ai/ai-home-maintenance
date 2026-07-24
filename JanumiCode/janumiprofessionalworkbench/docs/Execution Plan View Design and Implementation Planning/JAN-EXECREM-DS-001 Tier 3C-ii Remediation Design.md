# JAN-EXECREM-DS-001 — Tier 3C-ii Remediation Design

*v0.1.0 · 2026-07-24 · Design authority for the remediation of the JAN-EXECPLAN Tier 3C-ii subsystem
(transition grammar + flow interpreter). Provenance: the adversarial post-build review recorded in
`JAN-EXECPLAN-T3Cii-review-findings-2026-07-24.md`. Working papers (six family designs, six adversarial
critiques, the integration synthesis): `JAN-EXECREM-design-working-papers.md`. Implementation roadmap:
`JAN-EXECREM-DR-001`.*

---

## 1. Why this program exists

JAN-EXECPLAN Tier 3C-ii shipped as nine commits (DWP-01…09). Its roadmap (`JAN-EXECPLAN-DR-004`) still records
every DWP `delivery_state: NOT_STARTED` with a footer reading *"Nothing built"*, and the **post-build adversarial
verification its own exit criterion mandates ("ultracode, before the final commit") was never executed**. Its
sibling DR-003 has a real §20 delivery-and-verification record; this one has none.

That verification has now been executed: **118 agents, 56 findings raised → 40 CONFIRMED, 6 PLAUSIBLE, 10
refuted; no lens returned clean.** Every surviving finding passed two independent, perspective-diverse refuters
(code-semantics + test-evidence, the latter able to probe the running engine). Deduplicated, the 46 surviving
findings are **~28 distinct defects: 7 BLOCKERs, ~11 MAJORs, ~7 MINORs, 3 unsettled**.

**Sponsor decisions (2026-07-24), not to be re-litigated:**
- **Scope:** ALL 40 CONFIRMED findings are in scope, plus an explicit disposition for each of the 6 PLAUSIBLE.
- **Containment:** **fix forward.** No feature flag, no disablement of the Tier 3C-ii surface.
- Standing bias: **systemic and holistic fixes over the "simplest" option.**

## 2. The seven BLOCKERs, stated plainly

| # | Defect | Consequence |
|---|---|---|
| F-01 | `validateStepCompletion({hasOutput, explicitNoOutput: !hasOutput})` evaluates `hasOutput \|\| !hasOutput` | **A tautology.** RPH-EXE-006 is unenforced and its reject is dead code. Naming no outputs yields zero floor subjects, so the **§8.4 de minimis assurance floor loop never runs** — an unassessed AI-produced step succeeds. *Reproduced live.* |
| F-03/04/05 | A contract-legal plan-entry edge (no `sourceStepId`) empties `liveStepIds` | The whole graph reads unreachable: fan-out never fires and **Prune becomes a universal waiver bypass** — every step becomes waiver-free prunable. |
| F-02/07/24 | `mutateStep` records the BRANCH selection before the branch's own `ExecutionStepSucceeded` is committed | **A BRANCH cannot branch on its own result** — `RESULT_EQUALS`/`OUTPUT_COUNT`/`STEP_SUCCEEDED` over the completing step evaluate pre-completion facts, so the DEFAULT arm is always recorded. |
| F-06 | A CANCELLED/SUPERSEDED predecessor leaves its downstream "live" forever | The only exit — a waiver-skip — **RESURRECTS the dead arm**. This class has now recurred **three** times (DWP-07, DWP-08, F-06). |
| F-08 | `rejectUnbackedExecutionSuccess` tests `steps.some(s => s.stepState === 'SUCCEEDED')` with no plan-status term | A non-ACTIVE or barely-started plan **backs a PWU `executionState = SUCCEEDED` claim**. |
| F-09/27 | DS-004's "steps rest QUEUED — a convention this design ENFORCES" is enforced nowhere | An authored `NOT_READY` step is accepted and is a **permanent deadlock**: no command drives `NOT_READY` out, and terminal-success is unreachable. |
| F-10 | `ProposeExecutionPlan` never checks step-id uniqueness | A duplicate id creates a step **no command can ever address** (`advanceStep` resolves by `findIndex`). |

## 3. Root cause — six families, one disease

The 28 defects are not 28 mistakes. They are six mechanisms, and the six share a single pathology:
**an authority is asserted in prose and implemented per-call-site, with nothing that can enumerate, cross-check,
or falsify it.**

- **F1 · Unenforced/vacuous rules.** A ratified rule's check is tautological (`b || !b`), re-implemented weaker
  in a second place, silently omitted at some call sites, or built and never called. `canResumeExecutionOnPwu`
  (RPH-PWU-010) has exactly two repo-wide references: its definition and its own unit test.
- **F2 · Graph seeding & liveness.** One question — *"can this in-edge conduct?"* — has **three** answers in the
  code (`inEdgeDisposition`, `branchExcludes`, and the entry in-degree rule), and they disagree.
- **F3 · Commit ordering.** A decision that must be a recorded point-in-time fact is derived at the wrong moment
  (before its own event commits) or never recorded at all (Skip/Prune record no selection).
- **F4 · Guard anti-vacuity.** `requireFrom` guards with no kill test, or whose only "negative" test is refused
  by a *different* guard — the identical class already fixed twice on this surface (Fail/Retry).
- **F5 · Propose-time validation.** `ProposeExecutionPlan` accepts plans that are structurally impossible to
  execute; the failure surfaces much later as a deadlock or a permanently-false guard.
- **F6 · Read-model & affordance fidelity.** The UI offers what the engine will refuse, and the attempt
  read-model never closes a cancelled attempt.

## 4. Why they survived every prior review — and the anti-recurrence ruling

This is the most important section of this design. Four compounding reasons, each verified:

1. **A tautology is invisible to mutation discipline.** The established B7 practice is *"weaken the guard, watch
   a named test go RED"*. Deleting the F-01 guard outright changes **no** test, because the branch was never
   reachable from the application layer. It is not an unkilled mutant — it is **dead code**, and mutation
   testing cannot see it.
2. **The conformance gate certified an unenforced rule.** `conformance-manifest.ts` maps a rule → *some* test
   file, with no notion of **layer**. RPH-PWU-010's ratified statement is *"the command is rejected"*; its cited
   coverage is a pure-function call. The gate that exists to stop unaccounted rules **certified an unwired one**.
3. **Tests codified the holes as intent.** A `complete` helper passes empty output arrays on every step with the
   comment *"no floor subject → no assurance gate"* and asserts ACCEPTED; a fixture skips a MANDATORY step with
   a `waiverOrRevisionId` recorded nowhere and asserts ACCEPTED. A suite that encodes the defect as expected
   behaviour is a **ratchet**: it converts a hole into a regression barrier.
4. **Reviews audited the guards, not the guards' premises.** The fail-closed lens verified `mandatory ?? true`
   and stopped; the *other* argument to the same call — `hasAuthorizedWaiverOrRevision: !!p.waiverOrRevisionId`,
   a truthiness test on a free optional string — was never examined. Same shape at `explicitNoOutput`.

**RULING.** Fixing 28 defects without fixing *how they got in* schedules the fourth recurrence. Therefore this
remediation makes execution authority **declared data, consumed by one evaluator, proved by registry-driven
census** — so that a rule with no enforcement site, a site with no kill test, and a guard whose inputs cannot
disagree become *structurally* unshippable. That is WP-16, and it is not optional.

## 5. Shared mechanisms (build once, not per symptom)

| | Mechanism | Purpose |
|---|---|---|
| **SM-1** | `GateContext` | ONE canonical liveness/disposition computation with indexes + memos; dissolves the per-edge recomputation (cubic in fan-out) without changing semantics. |
| **SM-2** | `STEP_COMMAND_SPECS` | ONE declaration of every step command's contract (target, source states, event, authority). Sited in `rph-domain` so `rph-projections` may consume it (verified against `.dependency-cruiser.cjs`). |
| **SM-3** | `advanceStep` v2 | One primitive, a **total** compile-required argument, one adjudicated evaluation order — replacing three optional per-call-site extension points. |
| **SM-4** | `validateProposedPlan` | ONE pure propose-time validator absorbing the three ad-hoc handler validators verbatim (message- and code-preserving) and adding the step-set rules nothing owned. |
| **SM-5** | `evaluateGuardExpression` | ONE hardened, fail-closed guard evaluation used by **both** the handler and the projection — collapsing two evaluators that could drift. |
| **SM-6** | Conformance harness + three registry-totality gates | The anti-recurrence engine (§4 RULING). |
| **SM-7** | `__tests__/plan-fixtures.ts` | The test seeding seam — lets tests seed states that the new propose rules forbid, **without weakening the rule to keep tests green** (the exact inversion that produced F5). |
| **SM-8** | `stepAffordances` / `planAffordancesFor` | ONE affordance projection derived from SM-2; zero UI-side conditions, so an offered affordance cannot be one the engine refuses. |

## 6. Conflicts resolved (the design's real work)

All six family designs returned `NEEDS_REVISION` from their adversarial critics, and integration found **14
cross-family conflicts**. The consequential rulings:

- **C-1/C-2 — four families rewrote `transition-gate.ts` liveness.** Resolved into one canonical four-valued edge
  disposition + three-valued step liveness (WP-4). Note F2's proposed invariant was itself **vacuously true** for
  a zero-in-edge frontier seed — the shape every current graph plan's entry step has.
- **C-3 — four families redefined `advanceStep`'s argument type, three incompatibly.** Resolved into SM-3 with a
  single adjudicated order.
- **C-4 — two families added the same field to the same ratified event.** One vocab edit. Hard-gated:
  `ExecutionStepSucceeded` is the only step event in `RATIFIED_EVENT_PAYLOADS`, so emitting a new field before
  regeneration would make **every BRANCH completion reject at runtime** — and the seed authors no BRANCH, so it
  would give zero signal. This is why WP-1 batches all vocab edits first.
- **C-11 — BLOCKING: F1's waiver-validation fix is unimplementable as specified.** `approveDecision` refuses
  `decisionType === 'WAIVER'` outright, and the only WAIVER→EFFECTIVE path (`RequestWaiver` → `GrantWaiver`)
  mandates assurance-plane fields. **Ruling:** re-scope to resolve-and-classify the referenced object against the
  real waiver path (WP-12); do not force the kill test through a path the governance family forbids.
- **C-12 — BLOCKING: F1's "one success definition" would BREAK the reference seed.**
  `rejectUnbackedExecutionSuccess` is an **entry** gate (it early-returns when the current state is already
  SUCCEEDED) and the seed re-asserts `executionState: 'SUCCEEDED'`. **Ruling:** preserve entry-gate semantics;
  strengthen the backing test *within* them, and disclose the residual (§8).
- **C-9 — F5's at-rest rule and F4's conformance sweep are mutually exclusive as designed.** Resolved by SM-7:
  the sweep seeds forbidden states through a test-only seam, never through `ProposeExecutionPlan`.

## 7. Enumerated behaviour changes

Fix-forward means some previously-accepted inputs will now refuse. Each is deliberate and tested:
`CompleteExecutionStep` with neither outputs nor an explicit no-output assertion → **REFUSED**; an AI-produced
step naming zero assessable subjects → **REFUSED** (fail-closed floor); `ProposeExecutionPlan` with duplicate
step ids, a non-QUEUED at-rest step, a `CONDITIONAL` edge with no expression, an off-contract `STEP_STATE.state`,
or an empty `ALL`/`ANY` operand list → **REFUSED**; a re-issue of Cancel/Skip/EnterWait/ResolveWait from a
non-source state → **REFUSED** with `RPH_ILLEGAL_STATE_TRANSITION`. A FAILED in-edge now wedges its successors,
so **WP-5 adds the abandon primitive** that preserves the capability WP-4 removes — without it the remediation
would be a net capability loss.

## 8. Residual risks, disclosed

1. **F-08's guard remains an ENTRY gate.** A PWU's SUCCEEDED claim is backed *at the moment of the claim* and
   never re-validated; a plan later superseded/failed leaves a standing claim. Removing the early exit would
   break the seed (C-12).
2. **Legacy stored plans are never re-validated.** Propose-time rules gate only new proposals. Adding load-time
   re-validation would wedge legacy plans fail-closed with no remediation command — worse than the defect.
3. **Tautology detection is deliberately not attempted.** `.min(1)` closes the empty-combinator slip;
   `ATTEMPTS >= 0` remains unconditionally true and is not detectable without a solver.
4. **`structuredResult` individuation survives.** An AI step naming one floor-satisfied artifact can still ship
   large inline content un-individuated (the §8.4 gap already disclosed in `floor-gate.ts`).
5. **The conformance ledger's honest limit:** a deliberate widening edited consistently across production, the
   expected ledger, and the arrow ledger **passes**. That is intended — it converts a silent one-character
   mutation into a three-file, justification-bearing, reviewable change.
6. Full list (19 items) in the working papers.

## 9. Exit criteria

WP-0…WP-17 delivered; every CONFIRMED finding either fixed or explicitly dispositioned; each PLAUSIBLE finding
dispositioned; the reference seed drives unchanged (`rph-engine` 69); full gate green (check-types · test ·
lint 0 · boundary 0 · svelte-check 0 · Playwright); every new/repaired guard carries a **live mutation-red-proofed**
kill test; the three registry-totality gates green; `JAN-EXECPLAN-DR-004`'s stale delivery record corrected.

---

*`READY_TO_BUILD` — six family designs adversarially critiqued (all `NEEDS_REVISION`, all reconciled), 14
cross-family conflicts resolved including two blocking, 8 shared mechanisms adopted, 19 residual risks disclosed.
Roadmap: `JAN-EXECREM-DR-001`.*
