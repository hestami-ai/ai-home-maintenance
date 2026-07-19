# JAN-W1-DR-001 — W1 Detailed Implementation Roadmap

**Wave:** W1 — RPH Semantic Kernel and Contract Foundation
**Gate:** G1 — Semantic Kernel Conformance
**Conforms to:** `JAN-ROADMAP-001-A` §4 (19 required sections)
**Machine companion:** `JAN-W1-DR-001.yaml` (Template `JAN-ROADMAP-001-E`)
**Predecessor:** `JAN-W0-DR-001` (G0 APPROVE_WITH_CONDITIONS, 2026-07-19)

---

## 0. Reading note — normative language and the W1 re-baseline

This roadmap uses **SHALL / SHOULD / MAY / INFORMATIVE** per `JAN-ROADMAP-001` §3. It is generated under the **G0 re-baseline authorization** (condition C1; `DIV-W0-001` RESOLVED): because the live repository is a **mature RPH engine (JPWB)**, W1 is **not** a from-scratch build of the semantic kernel. W1 is executed as **conformance verification + hollow-layer closure** against the realized kernel. The master normative *outcomes* for `JAN-WP-1-001…008` are preserved unchanged; only the *route* is re-baselined (master §20 successor-revision to formalize the wave framing is a standing follow-up, per C1).

A W1 work package is complete only when its master outcome is **enforced in production and proven by a red-first test** — not merely present in a tested-but-unwired kernel.

---

## 1. Document control and repository identity

| Field | Value |
| --- | --- |
| Detailed roadmap ID | `JAN-W1-DR-001` |
| Version | `0.1.0-draft` |
| Status | `PROPOSED` |
| Master roadmap | `JAN-ROADMAP-001@2.0.0-draft` |
| Master wave | `W1` (activated by G0 APPROVE_WITH_CONDITIONS) |
| Activated master WPs | `JAN-WP-1-001` … `JAN-WP-1-008` |
| Repository / root / branch | `hestami-ai` / `E:/Projects/hestami-ai` / `main` |
| Revision at grounding | `c2b853b1` (last engineering-content `d37f0dd3`) |
| Subject-of-record | `JanumiCode/janumiprofessionalworkbench/` (JPWB) |
| Standing conditions carried from G0 | C2 (auth — WS-I/W10), C3 (corpus ratification), C4 (hollow-layer closure tracked here) |

Repository identity, packages, persistence, and vocabulary are as established in `JAN-W0-DR-001` §1/§4 and `evidence/jpwb-current-state-inventory.md` (not repeated). Legacy lineages remain `REMOVE`; W1 touches JPWB only.

---

## 2. Activated master scope

| Master WP | Master normative outcome (preserved) |
| --- | --- |
| `JAN-WP-1-001` | A single canonical source generates/validates machine contracts for first-slice objects, commands, events, policies, validator results, projections. |
| `JAN-WP-1-002` | All canonical objects have stable opaque identity, provenance, semantic version, revision, lifecycle metadata. |
| `JAN-WP-1-003` | Runtime represents raw/formalized/approved/revised/superseded/withdrawn Intent with version-bound authority. |
| `JAN-WP-1-004` | PWU purpose/boundaries/obligations/constraints/assumptions/outputs + independent work/execution/assurance/shape-integrity states. |
| `JAN-WP-1-005` | Mandatory obligations & constraints survive decomposition; material assumptions are first-class traceable objects. |
| `JAN-WP-1-006` | Every material decomposition allocates parent obligations/constraints and defines recomposition into the parent claim. |
| `JAN-WP-1-007` | Completion/preservation assertions are explicit claims evaluated under versioned assurance policies using admissible evidence. |
| `JAN-WP-1-008` | Authority via version-bound decisions; accepted states as immutable baselines and typed trace links. |

Exit: the Field Service reference fixture validates against canonical contracts; legal/illegal transitions enforced; execution/assurance/shape-integrity independent; all W1 invariant/contract tests pass. Gate **G1**.

---

## 3. Normative-source digest

Primary: `RPH-DOC-002` (domain model, invariants, state machines), `RPH-DOC-007` (contracts), `RPH-DOC-008` (executable invariants — the RPH-CON/INT/PWU/CNS/ASM/DEC/EVD/ASR/GOV/BAS/TRC test families named in register B are the W1 conformance targets), `RPH-DOC-004` (assurance for WP-1-007). Applicable master prohibited-shortcuts (§19): *one generic COMPLETE status*, *phase state as PWU state*, *storing material assumptions only in prose*, *treating all children complete as parent satisfied*, *validator recommendation mutating state directly*, *treating commit as baseline*, *editing baselines in place*. Standard §6 quality bar applies to each wiring.

---

## 4. Current-state findings and evidence — per-WP conformance classification

Grading: **CONFORMANT** (enforced in production + tested), **PARTIAL** (present + partly enforced; gaps), **HOLLOW** (kernel exists and is tested but production calls a weaker path — the dead-kernel condition), **DEFER** (belongs to a later wave). Evidence base: `evidence/jpwb-current-state-inventory.md`, `docs/_working/dead-kernel-census.txt` (LIVE 19 / DEAD 55; **W0-baseline snapshot — W1 re-verifies each function's current liveness**, since the recent harmonization increments R–Y have since wired several), and `HARMONIZATION-LOG.md`.

| Master WP | Classification | Grounding | Closure needed |
| --- | --- | --- | --- |
| WP-1-001 Contract scaffold | **CONFORMANT** | `packages/rph-contracts/vocab/*.json` → `bun run gen` single source; schema reject-unknown; generated-type drift guarded by `format:check` + build. | Verify RPH-CON drift test exists; otherwise none. |
| WP-1-002 Registry & identity | **CONFORMANT (verify)** | 30 `ProfessionalWorkObjectType`; ULID opaque ids + provenance + `(id,revision)`. | Property test for identity immutability across presentation/execution change (RPH-CON). |
| WP-1-003 Intent aggregate | **PARTIAL** | Intent lifecycle present; recent work bound `pwaVersion` precision. | Verify approve-binds-exact-version + revision-triggers-impact (RPH-INT-001..007); wire any dead guard. |
| WP-1-004 PWU + independent state | **PARTIAL / HOLLOW** | Independent state axes exist; **state-machine kernel dead**: `getMachine`, `machineNames`, `isValidState`, `initialStateOf`, `isTerminalState`, `assertTransition`, plus `isPresentationOnlyChange`/`applyPresentationChange`. | Route transition enforcement + presentation-vs-semantic edit classification through the kernel (RPH-PWU, property P1). |
| WP-1-005 Obligation/Constraint/Assumption | **HOLLOW** | Dead: `validateObligationConservation`, `validateConstraintPropagation`, `requiresReification`, `validateAssumptionReification`. | Wire conservation/propagation/reification at the decomposition + PWU write paths (RPH-CNS/ASM, P2/P3). |
| WP-1-006 Decomposition/Recomposition | **HOLLOW** | Dead: `validateDecomposition`, `evaluateRecomposition`, `coverageFor`. | Block invalid/uncovered decompositions before child execution; enforce recomposition (RPH-DEC-001..007). |
| WP-1-007 Claim/Evidence/Assurance | **PARTIAL** (assurance rule-arrays wired R–Y) / **HOLLOW** (claim/evidence) | Wired: 5/6 ASSURANCE_POLICY rule arrays enforced. Dead: `assessAcceptance`, `assessFalsification`, `evidenceAdmissibility`, `evaluateApplicability`, `classifyEvidenceInvalidation`, `assessModelOutput`, `executionAloneSatisfiesAssurance`, `controllerMarksPwuSatisfied`, `normalizeControlAction`, `selectControlAction`. | Wire claim acceptance/falsification + evidence admissibility/applicability + control-action selection at completion (RPH-EVD/ASR). |
| WP-1-008 Decision/Baseline/Traceability | **HOLLOW** | Dead: `isEffectiveApproval`, `decisionAuthorizesVersions`, `assessDecisionRevocation`, `waiverCovers`, `waiverStillDischarges`, `waiverPreservesFindings`, `isWaiverApplicable`, `assertBaselineItemSetImmutable`, `canSupersedeBaseline`, `blocksIrreversibleWork`, `canAuthorizeNewWork`, `validateLinkDirectionality`, `impactedObjects`, `resolvePath`. | Wire effective-approval/version-authorization + baseline immutability/supersession + typed-link directionality (RPH-GOV/BAS/TRC). |
| Execution-plane fns (`canStartStep*`, `bindingPermitsExecution`, `retryDecision`, `resolveIdempotency`, `attemptWouldDuplicateSideEffect`, `mayReexecuteWithoutReconciliation`, `classifyInterruptedAttempt`, `executionSuccessOutcome`, `capabilityAuthorized`, …) | **DEFER → W2/W3** | Execution/harness + idempotency/recovery are master W2 (WP-2-004/007) and W3 (WP-3-005) territory. | Recorded, not wired in W1. |

**Headline finding (CONFIRMED):** the master W1 *contract + object + identity* substrate (WP-1-001/002) is **already conformant**; the W1 gap is **enforcement wiring** of the governed kernel (WP-1-004…008) — exactly the "hollow governed layer" (`DIV-W0-004`). W1 is therefore a **wiring wave**, and it is a direct continuation of the harmonization program already in progress this session.

---

## 5. Legacy semantic classification

**Not applicable.** Legacy lineages are `REMOVE` (W0 `DEC-W0-002`). W1 introduces, preserves, or wires only JPWB code. No legacy element is in scope.

---

## 6. Target-state gap analysis

The gap is the set of **HOLLOW** kernel enforcements (§4), i.e. the still-dead subset of the census mapped to WP-1-004…008. For each, the target is: the governed kernel rule **decides at the production write path**, a violating input is **rejected/blocked** (fail closed), and a **red-first test** proves the previously-passing violation now fails. The recomposition/decomposition and claim/evidence gaps are the highest-value (they gate whether "children done ⇒ parent satisfied" and "generated output ⇒ evidence" — the two shortcuts the master §19 most forbids).

**Re-verification obligation:** because the census is a W0-baseline snapshot and increments R–Y have since wired parts of WP-1-007, each DWP **SHALL** re-run the liveness check on its functions before wiring, and record any already-closed as CONFORMANT rather than re-wire.

---

## 7. Alternatives considered and selected strategy

| # | Alternative | Disposition |
| --- | --- | --- |
| A1 | Rebuild the kernel from scratch per the literal master W1. | **Rejected** — the kernel exists and is tested; rebuilding discards conformant work and violates the re-baseline (C1). |
| A2 | Declare WP-1-001…008 conformant because tests pass. | **Rejected** — green tests prove the kernel, not the wiring (`DIV-W0-004`); violates master §19 (inventing completeness). |
| A3 (selected) | **Route production call sites through the existing kernel**, red-test-first, fail-closed, no new rule invented and no weaker literal added; verify the already-conformant WPs; defer execution-plane functions to W2/W3. | **Selected.** This is the established harmonization *wiring* method (`HARMONIZATION-LOG.md`), proven this session (rule-array enforcement thread). |

**Selected strategy.** Each HOLLOW enforcement is closed by: (1) write the red wiring test asserting the call site rejects a violating input (must go red today); (2) route the call site through the existing kernel function — do **not** author a new rule or add a literal; (3) gate green (full gate); (4) mutation-check the enforcement; (5) commit by path. Where the kernel rule's *shape* is genuinely undefined (as `RemediationRule` was), fail closed + disclose rather than fabricate. Ordinary wiring choices are delegated; a material-decision trigger (weakening an invariant, transferring authority, an irreversible migration) escalates.

---

## 8. Repository architecture and change map

W1 is **code-mutating** (unlike W0). Changes are concentrated in the **application layer** (`packages/rph-application/src/handlers/*`) routing to the **kernel** (`packages/rph-domain`, `packages/rph-assurance`), plus tests.

| Action | Locus | WP |
| --- | --- | --- |
| modify | handler write-paths to call kernel guards (decomposition, recomposition, obligation/constraint/assumption, claim/evidence, decision/baseline/waiver, transitions) | WP-1-004…008 |
| create | red-first wiring tests per closed function | all |
| verify | contract drift + identity-immutability property tests | WP-1-001/002 |
| no change | `rph-contracts` vocab/schema (unless a genuine shape gap surfaces — then escalate) | — |
| defer | execution-plane + persistence recovery | W2/W3 |

Persistence schema is **not** changed in W1 (that is W2). The package boundary (159 modules / 0 violations) **SHALL** remain clean.

---

## 9. Detailed work-package register

One DWP per HOLLOW/PARTIAL master WP (WP-1-001/002 are verification-only). Machine form in `JAN-W1-DR-001.yaml`.

| DWP | Maps | Outcome | Dead functions to wire (re-verify first) | Tests | Exit |
| --- | --- | --- | --- | --- | --- |
| `JAN-W1-DWP-001` | WP-1-001/002 | Verify contract single-source + identity immutability. | (none — verify) | RPH-CON drift; identity-immutability property | Contracts reject unknown props; identity survives presentation/execution change. |
| `JAN-W1-DWP-002` | WP-1-003 | Enforce Intent version-bound authority + revision→impact. | any dead Intent guard | RPH-INT-001..007 | Approval binds exact version; revision triggers impact. |
| `JAN-W1-DWP-003` | WP-1-004 | Wire state-machine transition enforcement + presentation/semantic edit classification. | `getMachine`, `machineNames`, `isValidState`, `initialStateOf`, `isTerminalState`, `assertTransition`, `isPresentationOnlyChange`, `applyPresentationChange` | RPH-PWU; property P1 | Illegal transition rejected; presentation edit cannot change PWU meaning. |
| `JAN-W1-DWP-004` | WP-1-005 | Wire obligation conservation, constraint propagation, assumption reification. | `validateObligationConservation`, `validateConstraintPropagation`, `requiresReification`, `validateAssumptionReification` | RPH-CNS/ASM; P2/P3 | No mandatory obligation/constraint silently disappears; material assumptions reified. |
| `JAN-W1-DWP-005` | WP-1-006 | Block invalid/uncovered decomposition before child execution; enforce recomposition. | `validateDecomposition`, `evaluateRecomposition`, `coverageFor` | RPH-DEC-001..007 | "children complete" cannot satisfy parent without valid coverage + recomposition. |
| `JAN-W1-DWP-006` | WP-1-007 | Wire claim acceptance/falsification, evidence admissibility/applicability, control-action selection. | `assessAcceptance`, `assessFalsification`, `evidenceAdmissibility`, `evaluateApplicability`, `classifyEvidenceInvalidation`, `assessModelOutput`, `executionAloneSatisfiesAssurance`, `controllerMarksPwuSatisfied`, `normalizeControlAction`, `selectControlAction` | RPH-EVD/ASR | Satisfied claim traces to admissible evidence + policy assessment; generated output is not evidence automatically. |
| `JAN-W1-DWP-007` | WP-1-008 | Wire effective-approval/version-authorization, baseline immutability/supersession, waiver discharge, typed-link directionality, impact traversal. | `isEffectiveApproval`, `decisionAuthorizesVersions`, `assessDecisionRevocation`, `waiverCovers`, `waiverStillDischarges`, `waiverPreservesFindings`, `isWaiverApplicable`, `assertBaselineItemSetImmutable`, `canSupersedeBaseline`, `blocksIrreversibleWork`, `canAuthorizeNewWork`, `validateLinkDirectionality`, `impactedObjects`, `resolvePath` | RPH-GOV/BAS/TRC | No baseline without effective decision + exact versions; baselines immutable; links typed/directional. |
| `JAN-W1-DWP-008` | G1 | Reference-fixture conformance + G1 gate package + proposed W2-DR-001. | — | full gate + reference fixture | G1 package complete. |

---

## 10. Data and persistence changes

**None in W1.** Enforcement wiring reads existing state and blocks illegal writes; it does not alter the five-table schema. Persistence/recovery gaps (idempotency, reconciliation, event-store hardening) are **W2** (`DEFER`).

## 11. Execution, compatibility, and migration strategy

Greenfield-forward; no legacy dual-run. Each wiring is **behavior-tightening** (a previously-accepted illegal input becomes rejected). Compatibility risk: existing seeds/fixtures/demo drives that *relied on* the missing enforcement will break and **SHALL** be fixed at the premise (a fixture asserting something the corpus forbids is corrected; an expectation is suspended only as a visible `it.skip` with reason + un-skip condition, never deleted) — the discipline proven in the harmonization program.

## 12. Assurance, tests, and evidence plan

**Red-test-first is mandatory** (master §19 anti-shortcut + the wiring method): every closed function ships with a test that goes **red** when the enforcement is reverted (mutation-proven). The W1 conformance evidence is the RPH-* test families (§3) passing **against production paths**, plus the standing gate (`check-types` 21/21, Vitest, `lint`, `boundary` 159/0, Playwright 25/25). W1 **SHALL NOT** claim a WP conformant on kernel-test evidence alone.

## 13. Security, authority, and tenant-impact analysis

W1 does **not** close `DIV-W0-003` (auth — C2, owned by WS-I/W10); it **SHALL NOT** regress it. Several WP-1-008 wirings (effective-approval, version-authorization) *interact* with the authority model — W1 wires the *rule* (only an effective decision authorizes), while *who* is authenticated remains the C2 gap. W1 wiring MUST fail closed on missing authority context (consistent with DOC-002 §27.2), which strengthens the pre-auth posture without substituting for authentication. No tenant impact.

## 14. Observability, recovery, and rollback

Per-DWP, per-function **increment commits** (one enforcement + its red test), each independently `git revert`-able. No runtime/data migration to recover. Progress tracked in `HARMONIZATION-LOG.md` (the established increment ledger) + this roadmap's living updates.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **R1 (census staleness):** the dead-kernel census is a W0 snapshot; some functions are already wired (increments R–Y). *Mitigation:* per-DWP liveness re-verification (§6) before wiring; already-closed → CONFORMANT.
- **R2 (compatibility breakage):** wiring tightens behavior; seeds/demo may break. *Mitigation:* fix at the premise; suspend expectations only visibly with un-skip conditions.
- **R3 (undefined kernel shape):** a target enforcement whose kernel rule shape is genuinely undefined (the `RemediationRule` situation). *Mitigation:* fail closed + disclose; escalate as a material-decision trigger; do not fabricate.
- **DEC-W1-001:** adopt the wiring method (A3) as the W1 strategy. Authority: agent within the C1 re-baseline authorization.
- **DEF-W1-001:** execution-plane + persistence-recovery functions → W2/W3.
- **DIV-W1-001 (carried):** the successor Master Roadmap revision formalizing the wave re-baseline (from `DIV-W0-001`) remains a standing governance follow-up; W1 proceeds under the C1 authorization in the interim.
- **UNK-W1-001:** exact count of still-dead functions after R–Y (resolved by DWP liveness re-verification).

## 16. Traceability matrix

Per `JAN-ROADMAP-001-F`: each row maps a master invariant (RPH-DOC-008 family) → master WP → DWP → wired kernel function → red-first test → `HARMONIZATION-LOG` increment. Populated instance in `JAN-W1-DR-001.yaml` `traceability_updates`.

## 17. Implementation ordering and concurrency plan

1. `DWP-001` (verify contract/identity) + `DWP-002` (Intent) — low-risk, first.
2. `DWP-003` (state machines) — foundational to all transition enforcement; before 004–007.
3. `DWP-004` (obligation/constraint/assumption) → `DWP-005` (decomposition/recomposition) — 005 depends on 004's conservation.
4. `DWP-006` (claim/evidence/assurance) — builds on the R–Y assurance work.
5. `DWP-007` (decision/baseline/traceability/waiver) — depends on the assurance + approval chain.
6. `DWP-008` (reference fixture + G1 package) — last.

Wirings are largely independent per function; the multi-agent Git policy (`JAN-ENG-POL-GIT-001`) governs (stage by path; never `-A`; no push authority — prepare commits, human pushes).

## 18. Exit criteria and gate package requirements

**W1 exit (master §14 W1):** reference fixture validates against canonical contracts; legal/illegal transitions enforced **in production**; execution/assurance/shape-integrity independent; all W1 invariant/contract tests pass **against production paths**; no WP left HOLLOW without a recorded DEFER. **G1 package** (master §17): master+detailed WP status; per-function liveness+wiring evidence; RPH-* test results; residual risk; decisions/deferrals/divergences; recommendation; proposed `JAN-W2-DR-001`.

## 19. Self-critique and readiness determination

- **Normative coverage:** all eight W1 outcomes mapped; 1-2 conformant (verify), 5-6 hollow (wire), execution-plane deferred with rationale. No difficult requirement omitted — the two hardest anti-shortcuts (decomposition coverage; evidence-is-not-automatic) are DWP-005/006, first-class.
- **Legacy preservation:** N/A (REMOVE).
- **Migration safety:** behavior-tightening only; compatibility breakage handled at the premise; per-function revertible increments.
- **Security/authority:** C2 not closed by W1 and not regressed; WP-1-008 wirings strengthen the pre-auth posture (fail-closed on authority context) without substituting for authentication.
- **Overengineering check:** no new kernel rules invented; wiring reuses the existing, tested kernel; no schema churn. This is the leanest closure of `DIV-W0-004`.
- **Sequencing/reversibility:** ordered by dependency; each increment revertible.
- **Contradiction with code/corpus:** the census may overstate the gap (staleness) — mitigated by mandatory re-verification, so the roadmap cannot over-claim work.

**Readiness determination:** `PROPOSED`. This roadmap is competent, code-grounded, and continues an already-proven method. It is presented for **W1 authorization**. On authorization, execution proceeds methodically per master §16, pausing only at a material-decision trigger (undefined kernel shape, invariant weakening, authority transfer) or the G1 gate. **W1 execution mutates production code**, so — unlike W0 — it awaits explicit authorization of this roadmap before the first wiring increment.
