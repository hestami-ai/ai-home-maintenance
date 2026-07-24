# JAN-CMDPRE — Post-Build Adversarial Surface Review (2026-07-24)

*The series-level post-build adversarial verification the exit criterion (`JAN-CMDPRE-DR-001` §18) requires,
run over the **entire** CMDPRE surface (DWP-00…09) after all ten increments were DELIVERED. Commissioned by the
sponsor (explicit ultracode opt-in) because several increments — notably the execution-plan/step family — were
implemented outside the multi-agent review the earlier DWPs each received.*

## Method

A deterministic multi-agent workflow (read-only): a **code-truth map** (2 agents — 64 in-scope command sites +
every declared illegal self-edge across all 27 machines + the SPEC "DELIVERED" claims), then **7 adversarial
lenses** over the whole surface (bypass · narrowing/over-refusal · mutation-coverage · kernel · refusal-code ·
register · doc-fidelity), each finding handed to an **independent skeptic** that reads the exact code and tries to
**refute** it (default REFUTED under uncertainty), then a **completeness critic**. **27 agents; 17 findings
raised → 9 refuted, 8 confirmed** (0 required a live check the agents could not settle statically). The
gold-standard live mutation red-proofs were performed by the reconciling engineer (this changeset), not the
agents.

**Clean lenses (no surviving finding):** bypass (single commit chokepoint `commitState`; every advancing/commitState
command routes through its precondition; none sited behind a same-input guard as dead code) and kernel (the DWP-07
`classifyTransition` reorder is behaviour-neutral for all machines except the one ratified Baseline
`AUTHORITATIVE→AUTHORITATIVE` self-edge — all 5 non-empty `illegal[]` tables were read).

## Findings and disposition

| # | Sev | Lens | Finding | Disposition |
|---|---|---|---|---|
| 1 | MAJOR | mutation-coverage | `FailExecutionStep` `requireFrom:['RUNNING']` had **no kill test** — every test fails a RUNNING step; a re-issue on an already-FAILED step (admitted as a `checkTransition` NOOP if the gate were removed) would append a second, contradicting `ExecutionStepFailed`. CON-000 B7 anti-vacuity. | **FIXED.** New `execution-step-reissue-guard.test.ts` kill test. **Live mutation red-proof:** widening `requireFrom` to `['RUNNING','FAILED']` makes exactly that test RED, unmutated GREEN. |
| 2 | MAJOR | mutation-coverage | `RetryExecutionStep` `requireFrom:['FAILED']` had **no non-vacuous kill test** — its two negative tests reject via a *precheck* (retry-cap / plan-ACTIVE), not the source-state gate; a re-issue from QUEUED (post-retry) would append a second `ExecutionStepRetried`. | **FIXED.** New kill test (re-retry from QUEUED → REJECTED, one event). **Live mutation red-proof:** widening to `['FAILED','QUEUED']` makes exactly that test RED, unmutated GREEN. |
| 3 | MAJOR | doc-fidelity | SPEC §3/§3.1 classify ~25 sites present-tense as un-hardened (`NONE`/`GUARD_ONLY_ACCIDENTAL`), contradicting the same document's §5.2–§5.4/§7 (DELIVERED) and the shipped code; §1.4 falsely claimed §3 reflects the **current** mechanism. | **FIXED.** §3/§3.1 reframed with an **AS-OF banner** as the design-time (pre-remediation) remediation baseline — which §3.1 is literally titled — pointing readers to the shipped handler + `dwpNN` kill test + §5.2–§5.4/§7 + the DR-001 §16 matrix for current state. §1.4's "current/complete" claim corrected. (No 25-row hand-reclassification — that would risk new drift; any future regen must come from the handlers.) |
| 4 | MINOR | narrowing | `PruneExecutionStep` declares `NOT_READY` in `requireFrom` (D5: an excluded not-taken arm "must still be prunable or the plan deadlocks"), but the ExecutionStep machine had **no** `NOT_READY→SKIPPED` arrow — so `checkTransition` refused the prune (`RPH_ILLEGAL_STATE_TRANSITION`); a not-taken NOT_READY step could never reach terminal-success. Latent (no real flow produces NOT_READY). INV-4 violation. | **FIXED.** Added `NOT_READY→SKIPPED` (trigger `ExecutionStepPruned`, prune-only — `skipExecutionStep.requireFrom` stays `READY\|QUEUED`) to `vocab/m2-transitions.json`; regenerated `transitions.data.ts` (diff = exactly that one arrow). New end-to-end test prunes a NOT_READY interior step of a dead arm and drives the plan to completion. |
| 5 | MINOR | register | RESIDUALS §2.1 stated "contradiction-free" more broadly than the census actually scans (it sees only same-`eventType` duplicates + root re-pointing). | **FIXED.** §2.1 conclusion scoped to the three shapes scanned; the four unscanned shapes (mutually-exclusive terminal pair, terminal-then-non-self, non-monotonic revision, cross-aggregate stale reference) explicitly enumerated as out of the census's reach and tied to the deferred R5. |
| 6 | MINOR | register | RESIDUALS §4 "the residual set is complete in one place" omitted F-6 (`advancePwuLifecycle`: 6 PWU-lifecycle commands not under compiler-mandatory INV-1). | **FIXED.** Added **R6** (the F-6 family) and softened the completeness claim; noted the F-1 execution-plan/pwa target sets are DELIVERED (DWP-05), not residual. |
| 7 | MINOR | register | Claimed the embedded repro script's key-parse is a bug (`k.split('')` → per-character split). | **REFUTED (false positive) — clarity-improved.** The raw bytes show a `` delimiter (`k.split('')`), which is correct; the control char renders invisibly, fooling **both** the finder and its verifier. The register's conclusions never depended on it. Nonetheless replaced the invisible delimiter with a JSON-tuple key carried in the map value (no re-parse) so no future reader — human or agent — repeats the misread. |
| 8 | MINOR | register | RESIDUALS §3 quoted an INV-2-WHY sentence as a direct quote of CON-000 **AX-7**, which does not contain that wording. | **FIXED.** Attributed the sentence to SPEC-001 INV-2 WHY; quoted AX-7's actual text as the ratified principle it restates. |

**Refuted (representative):** a refusal-code finding that `ActivateExecutionPlan` is a shipped guarded-site code
change absent from INV-7's enumeration — refuted on inspection (it is a NONE→precondition addition, its wrong-state
code is `RPH_ILLEGAL_STATE_TRANSITION` from the precondition, not an enumerable guard-code *change*).

## Reconciliation gate (full)

`check-types` 21/21 · vitest all 21 package tasks green — **rph-application 352 + 1 skipped** (45 files; +3 tests,
+1 file: the two step-reissue kill tests + the NOT_READY prune test), **rph-domain 220 + 1 skipped**, rph-engine
69 (seed unchanged), rph-demo 104 · `lint` clean · `boundary` 0 (209 modules) · svelte-check 0/0 · **Playwright
49/49**. `execution.ts` is byte-identical to pre-review (the mutation red-proofs were applied and reverted).

## Outcome

The bypass and kernel lenses — the two highest-severity classes — were **clean**: no command can reach commit
without its precondition, and the DWP-07 kernel change is behaviour-neutral but for the one ratified self-edge.
The two MAJOR survivors were **anti-vacuity gaps** (correct guards with no kill test) in the execution **step**
family — exactly the surface implemented outside the earlier per-DWP reviews — now each carried by a live
mutation-red-proofed kill test. The one MINOR code defect (a machine/command inconsistency) is reconciled at the
kernel. The doc findings are reconciled without inventing content. **The `JAN-CMDPRE-DR-001` §18 post-build
adversarial verification is EXECUTED and RECONCILED; no confirmed finding remains open.**
