# JAN-CMDPRE DWP-05 — Handoff report (DOC-004 §6.3)

**Increment:** execution PLAN-level (7) + pwa-authoring publication (4) preconditions.
**Date:** 2026-07-24. **Authority:** sponsor grant 2026-07-24 ("Proceed" on the DWP-05 step-1 proposal + four fork resolutions as delegated authority).
**Status:** DELIVERED. Full gate green; mutation-red-proofed live; adversarially verified clean.

---

## 1. Method — establish before author (AX-8)

DWP-05 was `knowledge_status: PARTIAL` (the roadmap required the plan-level exposures be established empirically before authoring). Step 1 ran a **16-site establish→verify→synthesize workflow** (`wf_aa098578-c84`): each candidate site's mechanism, machine in-arrows, current NOOP-re-issue behavior + code, and proposed source set were established from source and adversarially verified. Outcome: **9 clean sites confirmed, RetirePwa CORRECTED** (an establish agent's "wrong-state parity ⇒ no code change" fallacy — the NOOP closure still requires the source edit), **2 sites established directly** after they failed the batch (ApplyTacticalChange, DeprecatePwa), and **5 sites re-classified out** into DWP-08 (`commitState`, not status advances). The 11-site proposal was presented to the sponsor and approved before any code was authored.

## 2. The 11 sites (each set = its machine's full in-arrow source set — `illegal:[]` on both machines)

| Site (handler) | Set | Machine | Class / note |
|---|---|---|---|
| `approveExecutionPlan` | `UNDER_REVIEW` | ExecutionPlan.status | NONE; assumption guard retained (a wrong-state + dead-assumption case now refuses on state ahead of it) |
| `activateExecutionPlan` | `APPROVED` | ExecutionPlan.status | GUARD_ONLY_ACCIDENTAL → **code change** `RPH_INVARIANT_VIOLATION → RPH_ILLEGAL_STATE_TRANSITION`; `canActivatePlan` retained (RPH-EXE-001 one-active-plan stays `RPH_INVARIANT_VIOLATION`) |
| `cancelExecutionPlan` | `APPROVED, ACTIVE` | ExecutionPlan.status | NONE; **two-source** positive fixture |
| `completeExecutionPlan` | `ACTIVE` | ExecutionPlan.status | NONE; **guard-mask fix** (step-success guard) |
| `failExecutionPlan` | `ACTIVE` | ExecutionPlan.status | NONE (stale "checkTransition guards the source" comment corrected) |
| `supersedeExecutionPlan` | `PROPOSED, UNDER_REVIEW, APPROVED, ACTIVE` | ExecutionPlan.status | NONE; **guard-mask fix** (successor guard); **four-source**, 3 reachable (PROPOSED machine-legal but unreachable — `ProposeExecutionPlan` creates plans in `UNDER_REVIEW`; in the set for machine fidelity, INV-4) |
| `applyTacticalChange` | `ACTIVE` **(declared hold)** | ExecutionPlan.status | ACTIVE→ACTIVE admitted + **repeatable**; the redundant hand-rolled guard **removed**; load-bearing beyond NOOP closure (blocks the `APPROVED→ACTIVE` backdoor activation) |
| `submitPwaForReview` | `DRAFT` | PWA.publicationStatus | NONE |
| `validatePwa` | `UNDER_REVIEW` | PWA.publicationStatus | NONE; **guard-mask fix** (the PILOT-002 `pwaCompositionGate`-before-`checkTransition` ordering; mirrors landed publishPwa/DWP-01b) |
| `deprecatePwa` | `PUBLISHED` | PWA.publicationStatus | NONE |
| `retirePwa` | `DEPRECATED` | PWA.publicationStatus | NONE (the CORRECTED site) |

## 3. Enumerated behavioral changes

- **One refusal-code change (INV-7):** `ActivateExecutionPlan` re-issue on an already-ACTIVE plan — `canActivatePlan`'s `canTransition` (NOOP-excluding) refused it `RPH_INVARIANT_VIOLATION`; the precondition ahead of the guard now refuses `RPH_ILLEGAL_STATE_TRANSITION`. Fourth JAN-CMDPRE instance (after the decision factory, publishPwa — DWP-01b — and PromoteBaseline — DWP-04). No consumer depends on the old code for a re-issue (regression lens); the one-active-plan `RPH_INVARIANT_VIOLATION` (RPH-EXE-001) is a *different* case and unchanged (verified by `execution-plan-activation-guard.test.ts`).
- **Three guard-mask corrections (INV-3):** `CompleteExecutionPlan` (step guard), `SupersedeExecutionPlan` (successor guard), `ValidatePwa` (composition gate) — a wrong-state input previously surfaced the content/structural guard's code (masking the state); the precondition ahead of the guard now refuses on state. Guards retained for legitimate inputs.
- **One guard removal:** `ApplyTacticalChange`'s hand-rolled `state.status === 'ACTIVE'` check — replaced by `fromStates('ACTIVE')`, which checks the identical fact and returns the identical code. The removed guard held no other rule (the old doc-comment's "authorizing policy" was never implemented — confirmed by the adversarial lens).

## 4. Verification

- **Conformance:** `dwp05-precondition-coverage.test.ts` — 18 tests, all green. Per site: negative kill (re-issue from target + a wrong source) at `RPH_ILLEGAL_STATE_TRANSITION` with no second event / no revision bump; two-source Cancel + 3-reachable-source Supersede positives; the Activate code-change assertion; the Complete/Supersede/Validate guard-mask corrections; the ApplyTacticalChange declared-hold (admitted + repeatable) + wrong-state refusal.
- **Mutation red-proof (CON-000 B7), live:** all 11 sets weakened simultaneously (widen 10 by adding the target; **delete** ApplyTacticalChange's, since a hold's set already *is* `{target}`) → **exactly the 11 kill/wrong-state tests went RED; all 7 positives stayed green.** ApplyTacticalChange's deletion additionally exposed that without the precondition `APPROVED→ACTIVE` is a legal transition — a backdoor activation — so the precondition is load-bearing beyond NOOP closure. Reverted; markers grep-clean; re-run 18/18 green.
- **Central gate:** `check-types` 21/21 (svelte-check 0/0); `test` full-monorepo green (`rph-application` 338 incl. these 18; `rph-demo` 104); `lint` clean; `boundary` 0 violations (205 modules); Playwright **49/49**. **No existing test needed updating** (the activation-guard `RPH_INVARIANT_VIOLATION` case is the one-active-plan conflict on an APPROVED plan — a valid source — so it is unaffected; completion/supersede wrong-state cases already used the state code).
- **Adversarial verification (two independent lenses, refute-by-default):**
  - *Set-correctness / dead-code / code-change / hold:* **clean** — all 11 authored sets EXACTLY equal their machine in-arrow sets (none narrower → no INV-5 break; none wider → no NOOP/illegal admitted); none is dead code (precondition strictly before guard); the Activate code change traced real through `canActivatePlan`; RPH-EXE-001 not subsumed; the hold is admitted+repeatable and the guard removal lost nothing; the PILOT-002 ordering is fixed.
  - *Regression / consumer:* **clean** — no double-issue path anywhere (`reference-undertaking.ts` mints a fresh `planId` per Approve→Activate; `seed-workbench.ts` drives Submit→Validate→Publish once; the demo's execution + PWA-lifecycle buttons are status-gated to exactly the new allowed sources; e2e drives each command once per aggregate); the removed `ApplyTacticalChange` guard has **zero** dependents (repo-wide grep of the old message string); replay is a pure event fold (no re-dispatch); the unreachable `PROPOSED` source is a harmless dead entry. Benign delta: `ApplyTacticalChange`'s wrong-state refusal **message** changed from the bespoke string to the generic (more informative) precondition message — code unchanged (`RPH_ILLEGAL_STATE_TRANSITION`), no consumer depends on it.

## 5. Divergence classification (DOC-004 §8)

- `ActivateExecutionPlan`: `ACCIDENTAL_CODE_BEHAVIOR` → intentional (enumerated code change).
- `CompleteExecutionPlan` / `SupersedeExecutionPlan` / `ValidatePwa`: `ACCIDENTAL_CODE_BEHAVIOR` (guard-mask) → intentional, state-first.
- The remaining seven: `CODE_BEHAVIOR_UNDOCUMENTED` NONE sites → hardened by-design and mutation-provable.
- **Residual (DWP-08):** the 5 `commitState`/edit-append sites (`DeletePwa` — already idempotency-guarded; `EditPwa`; `EditPwuType` + `RemovePwuType` — real INV-6 owning-PWA `semanticVersion` leaks; `AppendConversationEntries` — duplicated entries) need the reader-precondition/predicate variant (DS-001 critique B4), not a `fromStates` set.

## 6. Filing

- **Program reference:** `JAN-CMDPRE-SPEC-001` bumped to **v0.2.0** — §5.3 authors the 11 fixture rows; §7 narrowed to the DWP-08 `commitState` remainder; fork F-1 marked RESOLVED.
- **Task record:** `JAN-CMDPRE-DR-001` DWP-05 → `delivery_state: DELIVERED` (`knowledge_status` PARTIAL → CONFIRMED, `delivered_under` the establishment workflow + sponsor approval); D4 traceability row updated.

## 7. What remains in the JAN-CMDPRE series

- **DWP-06** — flip `precondition?` → mandatory (D5). Now unblocked on the advanceStatus surface: with DWP-05 landed, every advanceStatus site declares a precondition (the declared holds — ApplyTacticalChange, ChangePwuState — state their own target). A pure type change.
- **DWP-07** — D2+D6 kernel (`stateMachine.ts` illegal-row invariant).
- **DWP-08** — the 5 `commitState`/reader-precondition sites (critique B4).
- **F-6 residual** — the PWU-lifecycle `advancePwuLifecycle` sites (GUARD_ONLY, already return the correct code), lowest priority.
