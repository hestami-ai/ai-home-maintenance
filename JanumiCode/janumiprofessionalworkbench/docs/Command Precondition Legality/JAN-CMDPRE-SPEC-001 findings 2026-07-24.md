# JAN-CMDPRE-SPEC-001 / DWP-04 findings (2026-07-24)

Findings from authoring `JAN-CMDPRE-SPEC-001 Command Precondition and Transition Legality` and implementing DWP-04 against it. Entry discipline borrows JPWB-REG-005 §9.2's shape (`PILOT-nnn`, date, type, statement, safe default, divergence class where applicable, proposed merge target) — "PILOT" here means piloting the deep-design→implement method, not a canon pilot. This is a JAN-CMDPRE program findings log; it is not REG-005 (which is append-only and sponsor-governed).

> **RECLASSIFICATION NOTE (2026-07-24, post-authoring).** These findings were written while the deliverable was framed as a canon SPEC-series artifact (per the DWP-04 commission prompt). On review the sponsor ruled that `JAN-CMDPRE-SPEC-001` is a **JAN-CMDPRE program deep reference, not a canon artifact** — a cross-cutting concern surfaced by a remediation program, not a per-subsystem canon SPEC (CON-000 B1 reserves the SPEC-nnn series for the latter). The entries below keep their original wording as the reasoning-at-the-time; read every "SPEC-series / canon pilot" phrase through this note. PILOT-004's open question is thereby answered: the obligation surface lives in a PROGRAM reference, not (for now) a canon SPEC — the sponsor may elevate it later via REG-005.

---

**PILOT-001** · 2026-07-24 · **DECISION (process observation)**
Statement: The SPEC-series genre (CON-000 B1) was exercised for the first time. The commission's "honest classification" requirement — every command's current precondition mechanism classified by reading the handler — caught a roadmap mischaracterization: `JAN-CMDPRE-DR-001` DWP-04 hinted `PromoteBaseline` was `NONE`, but it is `GUARD_ONLY_ACCIDENTAL` (its `canPromoteBaseline` guard incidentally refuses the re-issue via `canTransition`, with the wrong code). The catalog-then-classify method surfaced this where a prose reading would not have.
Merge target: none (process evidence for the canon pilot). Confirms the SPEC-series pulls its weight.

---

**PILOT-002** · 2026-07-24 · **DIVERGENCE FINDING** · class `ACCIDENTAL_CODE_BEHAVIOR`
Statement: `ValidatePwa` (`pwa-authoring.ts`) runs its `pwaCompositionGate` (`args.guard`) BEFORE `checkTransition`, so a `ValidatePwa` issued from the wrong state whose graph is *also* invalid surfaces the guard's `RPH_INVARIANT_VIOLATION` instead of the state code. This is the same precondition-before-guard ordering the JAN-CMDPRE series fixed for `PublishPwa` (DWP-01b), left latent here because `ValidatePwa` is still a `NONE` site (no precondition). Evidence: `advanceStatus` runs `guard` (kit.ts) then `checkTransition`; `ValidatePwa` is a `NONE` site in §3.1.
Safe default: leave unfixed — it is outside DWP-04's six sites (governance + AssurancePolicy) and belongs to the pwa-authoring remediation continuation (SPEC-001 fork F-6). Recording it now so the continuation increment inherits it rather than rediscovering it.
Merge target: SPEC-001 §7 (Deliberately Unspecified — pwa-authoring row) already references it; a future DWP fixes it under fork F-6.

---

**PILOT-003** · 2026-07-24 · **OPEN QUESTION**
Statement: The command-precondition remediation surface is larger than the JAN-CMDPRE roadmap's per-DWP framing implies: the catalog shows **22 `NONE` + 9 `GUARD_ONLY_ACCIDENTAL`** state-advancing sites, of which DWP-04 remediates 6. The remainder (execution plan-level ×6, pwa-authoring publication ×~7, PWU-lifecycle ×6, plus `EditAssurancePolicy`/`SubmitEvidenceForAssessment`/`Submit*ForReview`/`DeletePwa`) is a real backlog.
Safe default: schedule the remainder as DWP-05..N under SPEC-001 (fork F-6), lowest priority for the PWU-lifecycle `advancePwuLifecycle` sites since their accidental protection at least returns the correct `RPH_ILLEGAL_STATE_TRANSITION`. Do not attempt them in DWP-04.
Merge target: SPEC-001 forks F-1/F-6; the roadmap's DWP register.

---

**PILOT-004** · 2026-07-24 · **OPEN QUESTION**
Statement: DOC-003 §6 defers "the exact state enumerations and the closed transition/guard tables" to "repository shapes" without naming where the *enumerated obligation surface over those tables* lives. CON-000 B1 introduces the SPEC-series as that home. SPEC-001 is the first instance and treats `transitions.data.ts` as the shape authority for the rows while owning the precondition/legality obligation over them. Confirm this division is the intended one (the SPEC carries the obligation surface; the repository carries the row shapes), so future SPECs follow the same seam.
Safe default: adopt the division as authored (SPEC owns the obligation, repository owns the rows) — it is the plain reading of B1 + §2.3. No invariant weakened, no shape invented.
Merge target: confirmation into the SPEC-series convention (CON-000 B1 commentary or a REG-005 note); no artifact change required if confirmed.

---

---

**PILOT-005** · 2026-07-24 · **DECISION (delegated-authority adoption)**
Statement: Phase 2 of the DWP-04 engagement proceeded on the sponsor's *"Proceed"*, which the DWP-04 prompt's phase gate treats as pre-authorization to adopt the recommended fork defaults, mark them, and continue. Adopted as **delegated authority**: **F-2** (accept the guarded-site refusal-code change), **F-3** (`PromoteBaseline` = `fromStates('APPROVED')` **and** retain `canPromoteBaseline`), **F-4** (the three `AssurancePolicy.status` sets are UNRATIFIED-AUTHORED from the machine's in-arrows), **F-5** (`revision` is out of INV-6 scope). F-1 / F-6 remain the scheduled continuation (DWP-05…N). The adoption changes no ratified fact — SPEC-001 stays HYPOTHESIS/PENDING (CON-000 B1/B2 no self-ratify); a later sponsor ruling re-opens exactly the citations each fork names.
Merge target: SPEC-001 §6 (adoption marker added); JAN-CMDPRE-DR-001 DWP-04 (`delivered_under`).

---

**PILOT-006** · 2026-07-24 · **DECISION (implementation confirms the Phase-1 reclassification)**
Statement: The Phase-1 catalog's reclassification of `PromoteBaseline` (roadmap hint `NONE` → cataloged `GUARD_ONLY_ACCIDENTAL`, PILOT-001) was CONFIRMED at implementation and adversarially re-verified: `canPromoteBaseline` (rph-domain `governance.ts`) routes through `canTransition('Baseline.status', status, 'AUTHORITATIVE')`, and `classifyTransition` returns `NOOP` for `from === to`, which `canTransition` (LEGAL-only) excludes — so an `AUTHORITATIVE → AUTHORITATIVE` re-issue was already refused, but as `RPH_INVARIANT_VIOLATION` (an `ILLEGAL_PROMOTION_TRANSITION` finding), the wrong code. DWP-04 authored `fromStates('APPROVED')` ahead of the retained guard, so the re-issue now refuses `RPH_ILLEGAL_STATE_TRANSITION` — the third instance of the enumerated JAN-CMDPRE code change (INV-7; after `makeDecisionEffective` and `publishPwa`, both DWP-01b). This is the case the honest-classification requirement (PILOT-001) exists to catch: a prose reading would have shipped a `NONE`-shaped fix and missed the code change.
Evidence: the code change is proven by the negative fixture asserting `RPH_ILLEGAL_STATE_TRANSITION` (`dwp04-precondition-coverage.test.ts`), which goes RED when the precondition is deleted (mutation red-proof performed live: weakening all six sets made exactly the six kill tests RED, all 12 positives green — CON-000 B7). Full gate green (check-types 21/21, vitest 1069, lint, boundary 0, playwright 49/49 incl. the policy-lifecycle e2e). Two independent adversarial lenses (set-correctness/dead-code + regression/consumer) returned clean with file:line evidence: all six sets EQUAL their machine in-arrow sets (none narrower → no INV-5 break; none wider), none is dead code, no double-issue/replay-re-dispatch/old-code-consumer path exists.
Merge target: none (delivery evidence for DWP-04). Confirms the SPEC-series → conformance-fixture → mutation-red-proof pipeline is load-bearing.

---

**Pilot-findings count: 6** (3 process/decision DECISIONs incl. 1 delegated-authority adoption, 1 DIVERGENCE FINDING [ACCIDENTAL_CODE_BEHAVIOR, left for continuation], 2 OPEN QUESTIONS with safe defaults). No canon contradiction found; no retired material consulted as authority; no prohibition over-applied (the AX-8 fail-closed default was applied to the DWP-05 scope deferral rather than inventing target sets). DWP-04's six sites are delivered, gated green, mutation-red-proofed, and adversarially verified clean; JAN-CMDPRE-SPEC-001 is a program reference (HYPOTHESIS), not submitted for canon ratification.
