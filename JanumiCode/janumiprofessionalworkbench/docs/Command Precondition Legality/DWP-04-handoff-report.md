# JAN-CMDPRE DWP-04 — Handoff report (DOC-004 §6.3)

**Engagement:** JAN-CMDPRE two-phase deep-spec + implementation (`DWP-04-agent-prompt.md`). *(The Phase-1 deep reference was commissioned as a canon SPEC but reclassified by the sponsor as a JAN-CMDPRE program reference, not canon — see §6.)*
**Date:** 2026-07-24. **Author authority:** sponsor grant 2026-07-24 ("Proceed").
**Status:** DELIVERED. Full gate green; mutation-red-proofed live; adversarially verified clean.

---

## 1. What was delivered

**Phase 1 (normative reference).** `docs/Command Precondition Legality/JAN-CMDPRE-SPEC-001 Command Precondition and Transition Legality.md` (v0.1.0 DRAFT, HYPOTHESIS; a JAN-CMDPRE program reference, **not** canon) + its `.provenance.md` sidecar + `JAN-CMDPRE-SPEC-001 findings 2026-07-24.md`. Catalogs all 26 state machines and classifies all 84 commands; §5.2 specifies the six DWP-04 fixtures. Presented at the phase gate; forks F-2/F-3/F-4/F-5 adopted as delegated authority on "Proceed".

**Phase 2 (implementation).** Six `precondition: fromStates(...)` declarations added to two handler files, plus one new conformance-fixture file. Each set is authored from its machine's own in-arrows (SPEC-001 INV-4), sited ahead of the retained domain guard (INV-3). No existing guard removed.

Files touched:
- `packages/rph-application/src/handlers/governance.ts` — `revokeDecision`, `promoteBaseline`, `supersedeBaseline`.
- `packages/rph-application/src/handlers/assurance.ts` — `activateAssurancePolicy`, `suspendAssurancePolicy`, `supersedeAssurancePolicy`.
- `packages/rph-application/src/handlers/dwp04-precondition-coverage.test.ts` — NEW (18 tests).
- `docs/Command Precondition Legality/JAN-CMDPRE-DR-001 …Roadmap.md` — DWP-04 → DELIVERED; D4 traceability row.
- `docs/Command Precondition Legality/JAN-CMDPRE-SPEC-001 …md` §6 — fork adoption marker; `JAN-CMDPRE-SPEC-001 findings 2026-07-24.md` — PILOT-005/006.

---

## 2. Per-site table

Columns: **site · machine (rows) · authored set S · negative kill fixture + mutation red-proof · refusal-code · disposition.**

| Site (handler) | Machine — in-arrows to target | Authored set `S` | Negative kill fixture · red-proof | Refusal code (re-issue) | Disposition |
|---|---|---|---|---|---|
| `revokeDecision` (governance.ts:279) | `Decision.status` — `EFFECTIVE→REVOKED` (`transitions.data.ts:1529-1535`), the only in-arrow | `fromStates('EFFECTIVE')` | re-issue from REVOKED → REJECTED, one `DecisionRevoked`, no rev bump; + wrong-source PROPOSED. Weaken→`+REVOKED` makes it RED. | `RPH_ILLEGAL_STATE_TRANSITION` | NONE site — **no code change** (was already this via `checkTransition`). No `decisionType` predicate (both kinds revocable). |
| `promoteBaseline` (governance.ts:549) | `Baseline.status` — `APPROVED→AUTHORITATIVE` (`:1565`); `UNDER_REVIEW→AUTHORITATIVE` is in `illegal[]` (`:1583-1587`) | `fromStates('APPROVED')` (guard `canPromoteBaseline` retained) | re-issue from AUTHORITATIVE → REJECTED **at `RPH_ILLEGAL_STATE_TRANSITION`**, one `BaselinePromoted`, no rev bump. Delete precond → guard returns `RPH_INVARIANT_VIOLATION` → assertion RED. | `RPH_ILLEGAL_STATE_TRANSITION` | GUARD_ONLY_ACCIDENTAL → **ENUMERATED CODE CHANGE** `RPH_INVARIANT_VIOLATION → RPH_ILLEGAL_STATE_TRANSITION` (INV-7; F-2/F-3). 3rd family instance. |
| `supersedeBaseline` (governance.ts:676) | `Baseline.status` — `AUTHORITATIVE→SUPERSEDED` (`:1571-1577`), only in-arrow | `fromStates('AUTHORITATIVE')` | re-issue from SUPERSEDED → REJECTED, one `BaselineSuperseded`; + wrong-source APPROVED. Weaken→`+SUPERSEDED` makes it RED. | `RPH_ILLEGAL_STATE_TRANSITION` | NONE site — no code change. |
| `activateAssurancePolicy` (assurance.ts:344) | `AssurancePolicy.status` — `DRAFT→ACTIVE` (`:1062`), `SUSPENDED→ACTIVE` (`:1064`) | `fromStates('DRAFT','SUSPENDED')` (guard `rejectIfFloorLocked` retained) | re-issue from ACTIVE → REJECTED, one `AssurancePolicyActivated`. Weaken→`+ACTIVE` makes it RED. **Two-source positive** accepts DRAFT and SUSPENDED. | `RPH_ILLEGAL_STATE_TRANSITION` | NONE site (UNRATIFIED-AUTHORED, F-4). Benign ordering: floor Activate now refuses on state before floor-lock (SPEC §5.2 note). |
| `suspendAssurancePolicy` (assurance.ts:333) | `AssurancePolicy.status` — `ACTIVE→SUSPENDED` (`:1063`), only in-arrow | `fromStates('ACTIVE')` (guard `rejectIfFloorLocked` retained) | re-issue from SUSPENDED → REJECTED, one `AssurancePolicySuspended`; + wrong-source DRAFT. Weaken→`+SUSPENDED` makes it RED. | `RPH_ILLEGAL_STATE_TRANSITION` | NONE site (UNRATIFIED-AUTHORED, F-4). Floor-lock refusal in a legal source unchanged. |
| `supersedeAssurancePolicy` (assurance.ts:311) | `AssurancePolicy.status` — `ACTIVE→SUPERSEDED` (`:1066`), `SUSPENDED→SUPERSEDED` (`:1070`) | `fromStates('ACTIVE','SUSPENDED')` (guard `rejectIfFloorLocked` + tags `mutate` retained) | re-issue from SUPERSEDED with a **different** `supersededByPolicyId` → REJECTED, one `AssurancePolicySuperseded`, **`tags` did NOT grow** (F-4/INV-6). Weaken→`+SUPERSEDED` makes it RED. | `RPH_ILLEGAL_STATE_TRANSITION` | NONE site (UNRATIFIED-AUTHORED, F-4). The concrete accumulative-field case INV-6 generalizes. |

---

## 3. The enumerated behavioral change (INV-7 / §7.4 mutation evidence)

**One refusal code changes:** `PromoteBaseline` re-issue on an already-AUTHORITATIVE baseline. Before DWP-04 the retained `canPromoteBaseline` guard refused it (its `canTransition` excludes the NOOP) with `RPH_INVARIANT_VIOLATION`; the precondition now runs first and refuses `RPH_ILLEGAL_STATE_TRANSITION`. This is deliberate (F-2/F-3), the third instance of the JAN-CMDPRE family code change, and is asserted directly by the negative fixture. No consumer depends on the old code for a re-issue (adversarial regression lens: the existing `RPH_INVARIANT_VIOLATION` baseline assertions all target *first-promote* guard rejections from APPROVED, which are unaffected).

The other five sites are NONE-class: their wrong-source code was already `RPH_ILLEGAL_STATE_TRANSITION` from `checkTransition`; the precondition changes only *which* re-issue is refused (the same-state NOOP), never the code.

---

## 4. Verification

- **Conformance:** `dwp04-precondition-coverage.test.ts` — 18 tests, all green. Per site: negative kill (target re-issue + a wrong source) + positive widest-in-arrow (two-source for Activate/Supersede) + the PromoteBaseline code-change assertion + the F-4 tags assertion.
- **Mutation red-proof (CON-000 B7 / §7.4):** all six sets weakened simultaneously (target added to each) → **exactly the six negative kill tests went RED; all 12 positive/wrong-source tests stayed green.** Reverted; markers grep-clean; re-run 18/18 green. This proves each precondition is live (not dead code) and no kill assertion is vacuous.
- **Central gate:** `check-types` 21/21 (svelte-check 0/0); `test` **1069 passing** across 11 packages (rph-application 320 incl. these 18; rph-demo 104); `lint` clean; `boundary` 0 violations (204 modules); Playwright **49/49** (incl. `policy-manager.e2e.ts`, which drives Create→Activate→Suspend→Activate→Version through the UI).
- **Adversarial verification (two independent lenses, refute-by-default):**
  - *Set-correctness / dead-code / code-change / F-4:* every authored set EQUALS its machine in-arrow set (none narrower → no INV-5 break; none wider → no NOOP/illegal admitted); none is dead code (precondition strictly before guard; retained guards are floor-id or promotion-rule checks, orthogonal to state); the PromoteBaseline code change traced real through `canPromoteBaseline`; the F-4 tag-push is only reachable after the precondition passes.
  - *Regression / consumer:* no double-issue path anywhere (reference-undertaking mints fresh baseline ids; seed activates each policy once; demo UI buttons are status-gated to exactly the new allowed sources; `newPolicyVersion` mints a fresh successor); replay/rebuild folds events and never re-dispatches commands; no consumer depends on the old re-issue code.

---

## 5. Divergence classification (DOC-004 §8) & residuals

- **`PromoteBaseline`:** `ACCIDENTAL_CODE_BEHAVIOR` → made intentional. The re-issue protection existed but by accident, with the wrong code; DWP-04 makes it by-design and mutation-provable (INV-3). Enumerated per §8.
- **The three `AssurancePolicy` sets:** `CODE_BEHAVIOR_UNDOCUMENTED` in the sense that no `drivesFrom` exists — authored from the machine and marked **UNRATIFIED-AUTHORED** (F-4). Machine rows are the shape authority (CON-000 B3).
- **Residual / not in scope (F-6, DWP-05…N):** `EditAssurancePolicy` and `SubmitEvidenceForAssessment` are `commitState`/hand-rolled sites (no status advance); their re-issue harm needs the reader-precondition variant (DS-001 critique B4), deferred to DWP-08. The execution PLAN-level (×6), pwa-authoring publication (×~7), and PWU-lifecycle (×6, already returning the correct code) sites are the DWP-05…N backlog. `ValidatePwa` carries a latent precondition-before-guard ordering issue filed as PILOT-002.

---

## 6. Filing

- **Program findings:** `docs/Command Precondition Legality/JAN-CMDPRE-SPEC-001 findings 2026-07-24.md` — PILOT-005 (fork adoption as delegated authority), PILOT-006 (reclassification confirmed + code change + red-proof + adversarial-clean).
- **Task record:** `JAN-CMDPRE-DR-001` DWP-04 → `delivery_state: DELIVERED`, with `delivered_under`, corrected scope, and the reclassification recorded; D4 traceability row updated.
- **Program reference:** `JAN-CMDPRE-SPEC-001` §6 carries the fork-adoption marker. It is a JAN-CMDPRE program deep reference (HYPOTHESIS), **not** a canon artifact and not submitted for canon ratification (sponsor reclassification 2026-07-24); the concern may later be elevated into the canon SPEC-nnn series via a separate REG-005 act.

## 7. What the sponsor should decide next

1. **Confirm SPEC-001's status** — it is now a JAN-CMDPRE program reference (HYPOTHESIS), the operative backbone for DWP-05…N; the six DWP-04 sites are its first conformance evidence. Optionally decide later whether to elevate this cross-cutting concern into the canon SPEC-nnn series (a separate REG-005 act).
2. **Schedule the F-6 backlog** (DWP-05…N): plan-level, pwa-authoring publication, PWU-lifecycle, and the two `commitState` sites (DWP-08).
3. **Commit** the uncommitted set (six-site handlers + new test + this report + roadmap/SPEC/pilot-findings edits) — the human runs commits by explicit path.
