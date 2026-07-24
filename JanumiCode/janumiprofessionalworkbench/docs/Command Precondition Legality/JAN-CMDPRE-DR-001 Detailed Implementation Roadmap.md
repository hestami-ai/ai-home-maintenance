# JAN-CMDPRE-DR-001 — Detailed Implementation Roadmap

*`PROPOSED` / **v0.2.0** — reconciled against an EXECUTED 3-lens roadmap critique (§19: 4 blockers + 5 majors folded in; one blocker is a LIVE exploit the design had not named). Design authority: **JAN-CMDPRE-DS-001 v0.2.1** (`READY_TO_ROADMAP`; D8/D9 amended by this roadmap's critique). Scope: the engine-wide command re-issue defect. **DWP-00 is LANDED** (the demonstrated exploits, security-first per sponsor ruling). Self-critique EXECUTED — see §19.*

---

## 1. Document control and repository identity

- **Repository:** `JanumiCode/janumiprofessionalworkbench` (Turborepo + Bun 1.3.14).
- **Design authority:** `docs/Command Precondition Legality/JAN-CMDPRE-DS-001 Command Precondition Legality Design.md` v0.2.1.
- **Series identity:** `JAN-CMDPRE`. The increment already landed under the working tag `JAN-NOOP-01` is **DWP-00** here; the tag was retired because `NOOP` is implementation vocabulary with zero corpus ground (DS §3-3).
- **Sponsor rulings carried:** D3 reject-not-absorb; security-first sequencing (both 2026-07-22, delegated authority).
- **Boundary:** commits by explicit path, human runs git, NO PUSH.

## 2. Activated scope

Every state-advancing write site in `packages/rph-application/src/handlers/` reachable through the four `checkTransition` call sites, plus the eight unchecked `commitState` sites. **Out of scope, disclosed:** the `expectedRevision` migration (DS F-13); retraction of already-written events (DS §3-5); projection-level contradiction surfacing (DS F-14).

## 3. Normative-source digest

- **DOC-002 §27** / **DOC-005 §3.2** / **DOC-007 §9.1** — events record ACCEPTED changes; payload is the accepted facts; events are immutable. *This is the whole ratified footing: an event for a change that did not happen is a false entry in an append-only record.*
- **DOC-002 §27.2** — handlers must validate preconditions (duty exists; no specific allowlist named).
- **DOC-002 §24.2 / DOC-009 RPH-BAS-005 / P7** — an authoritative baseline is immutable (the one corpus ruling on a self-edge).
- **DOC-007 §25.1** — `RPH_ILLEGAL_STATE_TRANSITION` already exists; **no new error code is minted**.
- **Constitution:431** — for every affected machine, cover changed legal transitions, relevant illegal transitions, guards.
- **Silent (⇒ sponsor-ruled, not derived):** non-key re-issue; `drivesFrom` authority; whether a zero-change control action is recordable.

**Machines in scope** (Constitution:431 applies to each): `Intent.intentStatus`, `PWU.workLifecycleState` + its three sub-axes, `ExecutionPlan.status`, `RuntimeBinding.authorizationStatus`, `Decision.status`, `Baseline.status`, `AssuranceAssessment.state`, `AssurancePolicy.status`, `DecompositionContract.status`, `RecompositionContract.status`, `PWA.publicationStatus`, **`Evidence.status`**, **`Assumption.status`**. *(The last two were absent from v0.1.0 entirely — `AdmitEvidence`, `InvalidateEvidence` and `ExpireAssumption` were covered by aggregate COUNT but named in no DWP, so §12's per-machine obligation was unmeetable as scoped. Critique M3.)*

## 4. Current-state findings and evidence

Carried verbatim from DS §4 (F-1…F-15), grounded by a 6-lens read-only workflow with per-lens adversarial audit. Load-bearing for this roadmap:

- **F-1** exactly **four** `checkTransition` sites engine-wide — the surface is closed.
- **F-5** 41 sites on permissive paths: 21 HARMFUL / 11 BENIGN / 2 UNCLEAR / 7 unexamined.
- **F-6** the primitive has four hand-written copies plus an inline fifth; `advancePwuLifecycle` is **already strict** and is the in-repo precedent.
- **F-10** the wrong-source half is live and, at `DenyWaiver`, unreachable by any state set.
- **F-12** transport retries are already absorbed, so a re-issue IS a distinct request.

## 5. Legacy semantic classification

No legacy semantics are being preserved or migrated. `requireFrom` (DWP-00's optional shape) is **superseded within this series** by the general `precondition` field in DWP-01b — a same-series refactor, not a compatibility surface. DWP-01a deliberately AUTHORS ON the DWP-00 shape (a guard-sited predicate + `requireFrom`), accepting one extra migration in DWP-01b in exchange for landing the live exploit closure without the guard reorder's fourteen-site refusal-code change.

## 6. Target-state gap analysis

| Concern | Today | Target |
|---|---|---|
| Re-issue at a demonstrated exploit site | ACCEPTED, appends a contradicting event | REFUSED (**DWP-00, landed**) |
| `DenyWaiver` aimed at a non-waiver decision | ACCEPTED | REFUSED by a payload predicate (DWP-01a) |
| `ChangePwuState` all-axes-held re-issue | ACCEPTED, second contradicting event | REFUSED by an at-least-one-axis-differs predicate (DWP-02) |
| The other 31 advanceStatus/advanceIntent sites | unguarded | precondition authored per site (DWP-03…05) |
| A NEW call site omitting the declaration | silently unguarded | compile error (DWP-06) |
| `checkTransition` vs `canTransition` | undocumented disagreement, accidental protection | reconciled + documented (DWP-07) |
| A machine that wants to forbid a self-edge | cannot express it (stripped at codegen) | expressible + enforced (DWP-07) |
| The eight `commitState` sites | no check of any kind | explicit precondition (DWP-08) |
| Contradictions already in the store | invisible | audited + registered, not rewritten (DWP-09) |

## 7. Alternatives considered and selected strategy

Per DS §6: **D1** per-command precondition (state set = the common special case); **D2** the rule lives in the write primitive, not the classifier; **D3** REJECT not absorb; **D4** hand-authored from machine in-arrows, never generated from `drivesFrom`; **D5** mandatory **last**, as a zero-behaviour type flip; **D6** baseline edge + generator + classifier reorder, or dropped; **D7** disclose history, do not repair; **D8/D9/D10** wrong-source, `commitState`, and `ChangePwuState` each in scope with their own increments.

## 8. Repository architecture and change map

- **MODIFY (primitives):** `packages/rph-application/src/handlers/kit.ts` (`advanceStatus` — the `precondition` field + enforcement), `intent.ts` (`advanceIntent`, the independent copy), `pwu.ts` (`changePwuState`'s inline loop).
- **MODIFY (call sites):** `runtime-binding.ts`, `governance.ts`, `assurance.ts`, `pwa-authoring.ts`, `decomposition.ts`, `execution.ts` (the 7 plan-level sites), `intent.ts`.
- **MODIFY (kernel, DWP-07):** `packages/rph-domain/src/stateMachine.ts` (classifier order), `packages/rph-domain/src/gen/gen-transitions.ts` (stop stripping declared self-edges), `packages/rph-domain/vocab/m2-transitions.json` (the §24.2 row is already there — it is the generator that drops it).
- **CREATE:** `packages/rph-application/src/handlers/command-precondition.ts` (the `Precondition` type + `fromStates` helper + the census export); per-family test files; `docs/Command Precondition Legality/RESIDUALS.md` (DWP-09).
- **NO** DB migration, **NO** new error code, **NO** contract/vocab change (this is handler-layer only, except DWP-07's generator/table fidelity work).

**Naming discipline (critique M1).** Every site below is named by **exported symbol**, never by line number. v0.1.0's line references were captured before DWP-00 landed and were uniformly stale (`intent.ts` +13, `decomposition.ts:435-461` past EOF), and one "site" it assigned to DWP-05 was actually DWP-00's. Line numbers in a roadmap rot between the writing and the building; symbols do not.

**Counting discipline (critique B1/M4).** The census counts **registered command types that reach a write primitive**, not `advanceStatus` call sites. These differ: `makeDecisionEffective` is a FACTORY with one `advanceStatus` literal serving **two** command types, so a site-based count both double-owns it across DWPs and cannot express two different preconditions.

## 9. Detailed work-package register

```yaml
id: JAN-CMDPRE-DWP-00
title: "Demonstrated exploits closed (security-first)"
outcome: "requireFrom added to advanceStatus + advanceIntent (optional shape) and applied at AuthorizeRuntimeBinding / DenyRuntimeBinding / RevokeRuntimeCapability / ApproveBaseline / CompleteAssuranceAssessment (x3 branches) / ReviseIntent / PublishPwa. Regression suite command-reissue-guard.test.ts, incl. a POSITIVE test that PARTIALLY_AUTHORIZED -> AUTHORIZED still works."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-01a
title: "The Decision family closed SYMMETRICALLY (two live exploits) — security half, split in flight"
master_work_packages: [DS-001:D1, DS-001:D8]
split_rationale: "§19 residual 1 predicted this split. The two live exploits do NOT depend on the guard reorder: at makeDecisionEffective the factory OWNS the guard, so a precondition parameter composed at the guard's head is live; denyWaiver has NO guard, so DWP-00's shipped requireFrom + a guard-sited predicate are both live. Landing them first avoids coupling a security fix to the fourteen-site refusal-code change."
outcome: "The Decision family is closed in BOTH directions on DWP-00's shipped shape: ApproveDecision requires decisionType !== WAIVER; GrantWaiver/DenyWaiver require === WAIVER; DenyWaiver additionally requires status PROPOSED (the machine's EFFECTIVE -> SUPERSEDED arrow belongs to supersede flows, and unmaking a GRANTED waiver is RevokeDecision's act). No mechanism module, no reorder, no migration."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "governance.ts makeDecisionEffective (the FACTORY, not its single advanceStatus literal) — gains a precondition PARAMETER sited at the HEAD of the factory-owned guard; approveDecision and grantWaiver each pass their own"
    - "governance.ts denyWaiver — the WAIVER predicate (guard) + requireFrom ['PROPOSED']"
    - "governance.ts revokeDecision — AUDIT of the same asymmetry, recorded in a comment (its precondition is DWP-04's to author)"
    - "apps/rph-demo decisions route (+page.server.ts, +page.svelte) — companion change found by post-build verification: WAIVER removed from the propose dropdown (ProposeDecision cannot carry §12.2 WaiverDetail); PROPOSED waiver rows gain Grant/Deny actions mirroring the engine's preconditions (§11)"
required_changes:
  - "makeDecisionEffective takes a `precondition` parameter; approveDecision passes `decisionType !== 'WAIVER'`, grantWaiver passes `=== 'WAIVER'`. Attaching one predicate to the shared literal would refuse every ApproveDecision on a non-waiver decision and take the SEED down (reference-undertaking.ts approves a PROMOTE_BASELINE decision — which is also why the predicate is !== WAIVER, not === APPROVAL)."
  - "Refusal code for the kind mismatch: RPH_VALIDATION_SEMANTIC_FAILED (the state arrow is legal; the command addresses the wrong KIND of decision). The state half at denyWaiver refuses as RPH_ILLEGAL_STATE_TRANSITION via requireFrom."
  - "Do NOT add requireFrom to the factory sites: PROPOSED -> EFFECTIVE is the machine's ONLY in-arrow to EFFECTIVE and authorizeDecisionEffective routes through canTransition (NOOP-excluding), so every wrong-state source is already refused by the guard that runs FIRST — a requireFrom behind it is dead code (critique B3's exact shape). Record that in the factory comment; DWP-01b makes it explicit once enforcement moves ahead of the guard."
invariants:
  - "ApproveDecision on a PROPOSED WAIVER is REFUSED — the floor gate can no longer be discharged by a decision that never recorded a waiver fact."
  - "DenyWaiver on a non-WAIVER decision is REFUSED regardless of status; DenyWaiver on an EFFECTIVE (granted) waiver is REFUSED; a legitimate DenyWaiver on a PROPOSED waiver still succeeds."
  - "GrantWaiver on a genuine waiver still succeeds, and the seed drives END TO END unchanged."
prohibited_shortcuts:
  - "Do NOT express either waiver check as a state set — provably unreachable (DS §5)."
  - "Do NOT attach a precondition to the shared advanceStatus literal inside makeDecisionEffective."
  - "Do NOT start the mechanism module, the signature decision, the reorder, or the nine-site migration here (DWP-01b)."
tests:
  - "handler: ApproveDecision on a PROPOSED WAIVER -> REJECTED, decision stays PROPOSED, and the floor gate still blocks publish; the same waiver then granted legitimately -> publish succeeds."
  - "handler: DenyWaiver on an EFFECTIVE non-waiver -> REJECTED with no event; DenyWaiver on an EFFECTIVE waiver -> REJECTED; DenyWaiver on a PROPOSED waiver -> ACCEPTED, WaiverDenied appended, status SUPERSEDED."
  - "handler: GrantWaiver on a PROPOSED non-waiver -> REJECTED with no event."
  - "handler: DenyWaiver RE-ISSUED on an already-SUPERSEDED waiver -> REJECTED with WaiverDenied still singular (kills the requireFrom ['PROPOSED','SUPERSEDED'] mutant its verification named)."
  - "seed: the reference undertaking drives unchanged (the acceptance gate for the factory change)."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-01b
title: "The precondition MECHANISM: union type, signature settled, enforcement ahead of the guard, migration"
master_work_packages: [DS-001:D1, DS-001:D8]
outcome: "Both primitives gain a general `precondition` over (loadedState, payload) — a union whose `from` variant is the state-set special case. Enforcement is sited BEFORE `args.guard`, not merely before checkTransition. DWP-00's NINE sites and DWP-01a's three command types migrate onto the union; the factory sites' now-reachable source sets become explicit."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "NEW packages/rph-application/src/handlers/command-precondition.ts — the Precondition union, fromStates(...), evaluatePrecondition(...)"
    - "kit.ts advanceStatus + intent.ts advanceIntent — the field, enforced BEFORE args.guard"
    - "runtime-binding.ts, governance.ts, assurance.ts, pwa-authoring.ts, intent.ts — migrate DWP-00's NINE sites (authorize/deny/revoke RuntimeBinding, approveBaseline, the three completeAssuranceAssessment branches, reviseIntent, publishPwa) + DWP-01a's ApproveDecision/GrantWaiver/DenyWaiver"
required_changes:
  - "SIGNATURE SETTLED (critique B4, ruling recorded in command-precondition.ts): PREDICATE's check receives { state, payload, command, read } where `read` is a NARROW READ-ONLY reader ({ objectState(id), aggregateEvents(type, id) }) — never HandlerContext, whose commit/transaction surface would let a declaration write. aggregateEvents is exactly what DWP-08's duplicate-evidence rule needs; the reader is UNUSED by production predicates until DWP-08 but its wiring INTO the primitive is behavior-tested NOW (advanceStatus is driven with a capturing predicate that asserts it received the loaded state, the command payload, and a working reader)."
  - "NO-WRITE IS MECHANICAL, not conventional (post-build verification, semantics lens). `loaded.state` is later spread into the committed next state and `command.payload` is the default event payload, so the primitives hand the predicate structuredClone()s of both; the reader is already copy-on-read at the storage adapters. A test drives a mutating predicate through advanceStatus and asserts the committed object is untouched."
  - "ENFORCEMENT MOVED AHEAD OF `args.guard` (DR-001 roadmap critique B3) in advanceStatus, and ahead of `precheck` (the local guard analogue) in advanceIntent. Refusal-DISPOSITION changes were ENUMERATED BY CENSUS, not assumed: of the 12 migrated sites, exactly TWO coexistence points have a guard — publishPwa (floor gate) and the makeDecisionEffective factory (authority guard). At those two points the change is not code-only: (a) re-issued ApproveDecision/GrantWaiver on an EFFECTIVE decision now returns error.code RPH_ILLEGAL_STATE_TRANSITION AND CommandResult.status REJECTED, where the guard's legality arm previously surfaced RPH_AUTHORITY_INSUFFICIENT / status UNAUTHORIZED — authority was never the defect; (b) PublishPwa on a never-validated AI DRAFT now refuses on state (RPH_ILLEGAL_STATE_TRANSITION) where the floor guard fired RPH_INVARIANT_VIOLATION first (both map to status REJECTED). The enumeration is by REPRESENTATIVE input: any wrong-state input at either coexistence point shifts to the state code/disposition — that is the whole point of siting the precondition first — and the representative re-issue tests pin it. NO existing assertion's expected value was changed (verified by grep + full suite green); the critique's '14 guarded sites' figure describes the eventual DWP-03..05 exposure, enumerated at those DWPs."
  - "The factory sites gained their explicit allOf(kindPredicate, fromStates('PROPOSED')) — KIND-first so DWP-01a's refusal codes hold at every previously-tested input; denyWaiver identically. ALL_OF is an ORDERED conjunction for exactly this reason. ApproveDecision's kind-refusal message was tightened during migration ('no waiver fact' -> 'no WaiverGranted fact recorded') — a third, message-only observable delta (no test asserts the text; the demo surfaces it verbatim), disclosed here."
  - "`requireFrom` DELETED from both primitives (same-series supersession, §5). execution.ts's step-level requireFrom is JAN-EXECPLAN's own primitive over plan-internal steps, not an aggregate-status advance — out of this series' scope, unchanged."
invariants:
  - "A state-set precondition behaves identically to DWP-00's requireFrom EXCEPT at the two enumerated coexistence points, where a wrong-state input shifts to the state code/disposition — enumerated and tested, not discovered."
  - "Every DWP-01a refusal still fires with its DWP-01a code (kind-first ALL_OF ordering preserves them)."
  - "Every migrated fromStates set has a NAMED re-issue kill test — reverting or weakening it fails that test (verified live for publishPwa: adding PUBLISHED to the set fails the re-publish test). The six sites the initial build left uncovered (deny RuntimeBinding, the three completeAssuranceAssessment branches, approveBaseline, re-publish) gained tests in the post-build reconciliation."
prohibited_shortcuts:
  - "Do NOT make the field mandatory here (DWP-06)."
tests:
  - "unit: command-precondition.test.ts — refusal codes, DWP-00 message shape byte-for-byte, ALL_OF short-circuit + ordering, the (state, PAYLOAD) contract, advanceStatus wiring (state+payload+reader), and the clone/no-write property."
  - "kill coverage: every migrated site has a re-issue test in its fixture file (command-reissue-guard, decision-kind-guard, assurance-independence, baseline-open-blocking-observation, pwa-authoring)."
  - "regression: every DWP-00 + DWP-01a test green with NO assertion's expected value changed; the deliberate code changes carried by NEW tests (decision-kind-guard x2, pwa-authoring x1)."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-02
title: "ChangePwuState — the at-least-one-axis-differs precondition (the vacuity trap)"
master_work_packages: [DS-001:D10]
outcome: "changePwuState's inline four-machine path gains its own precondition: the command is REFUSED when all four axes equal current, because that is a re-issue that can only append a contradicting PwuStateChanged. A hold of SOME axes remains legal — it is the dominant case (24 of the seed's 67 workLifecycle dispatches)."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-application/src/handlers/pwu.ts changePwuState — the `changeNothingPrecondition` (module-level PREDICATE) evaluated via evaluatePrecondition, sited AFTER the previousState staleness check and BEFORE the sub-axis loop"
    - "packages/rph-application/src/handlers/pwu.test.ts — the all-four-equal + single-orthogonal-axis-hold tests"
    - "packages/rph-engine/src/reference-undertaking.ts — READ ONLY, the validation fixture (drove unchanged: rph-engine 69/69)"
required_changes:
  - "Precondition (PREDICATE kind, from the DWP-01b command-precondition module — NOT a bespoke inline if, so the rule is a first-class discoverable Precondition even though changePwuState is not an advanceStatus site): refuse iff newState === current.workLifecycleState AND executionState/assuranceState/shapeIntegrityState each === current. Message NAMES all four axes with their values, per the roadmap. DONE."
  - "Do NOT attempt a state-set declaration here: all four targets are payload-derived and the only correct set is the machine's entire state list (DS D10). HELD — it is a PREDICATE."
invariants:
  - "The seeded reference undertaking drives UNCHANGED end to end (it holds at least one axis on every ChangePwuState dispatch). VERIFIED: rph-engine 69/69, including reference-undertaking."
  - "A partial hold (>=1 axis moves) is ACCEPTED exactly as today. VERIFIED by the single-orthogonal-axis-hold test."
  - "An all-axes-equal re-issue is REFUSED and appends no event. VERIFIED, mutation-checked live (neutralising the guard fails the test)."
prohibited_shortcuts:
  - "Do NOT ban same-state sub-axis transitions — 33/35/57 of the seed's sub-axis dispatches are holds. HELD: the rule fires only when ALL FOUR are equal."
  - "Do NOT rely on a type or lint to catch a vacuous declaration here; for this command the vacuous value IS correct (DS D10)."
tests:
  - "handler: all-four-axes-equal re-issue REFUSED (RPH_ILLEGAL_STATE_TRANSITION, no event, no revision bump); a hold advancing a single orthogonal axis ACCEPTED. Axes read live from state so the fixture cannot drift."
  - "seed: the reference undertaking + full rph-engine suite stay green — the explicit acceptance gate for this DWP."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-03
title: "Author preconditions — intent, runtime-binding, decomposition"
master_work_packages: [DS-001:D4]
outcome: "Every remaining advanceIntent site (4) and advanceStatus site in runtime-binding (0 remaining) and decomposition (4) carries a hand-authored precondition derived from its machine's in-arrows, each citing the rows it came from."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "intent.ts beginIntentDiscovery, provisionIntent, formalizeIntent, approveIntent"
    - "assurance.ts admitEvidence, invalidateEvidence (Evidence.status) and expireAssumption (Assumption.status) — two machines v0.1.0 never named (critique M3)"
    - "decomposition.ts validateDecomposition, reviseDecomposition, beginRecomposition, completeRecomposition. NOTE (critique M2): v0.1.0 said *Propose*Decomposition — that is a createObject, not a state-advancing site. RE-CHECK FINDING (at DWP-03's own start): the two sites v0.1.0 called 'D10-shaped, not state sets' — validateDecomposition (payload-derived target VALID|CONDITIONALLY_VALID|INVALID) and completeRecomposition (evaluation-derived target COMPOSABLE|CONFLICTED|INSUFFICIENT) — are in fact CLEAN state sets. A payload/evaluation-derived TARGET does not imply a varying SOURCE: every one of validateDecomposition's targets is reachable ONLY from UNDER_REVIEW, and every one of completeRecomposition's ONLY from EVALUATING (unlike DWP-02's ChangePwuState, where the source itself varied and included holds). So fromStates('UNDER_REVIEW') / fromStates('EVALUATING') fully cover them — a re-issue (a same-disposition NOOP, or a settled-outcome re-complete) is refused by the single source alone. v0.1.0 conflated target-shape with source-shape."
required_changes:
  - "DONE. Eleven sites authored, each fromStates(...) derived from its machine's in-arrows with the rows cited in-comment: intent.ts beginIntentDiscovery(RAW)/provisionIntent(UNDER_DISCOVERY)/formalizeIntent(PROVISIONAL)/approveIntent(FORMALIZED,REVISED); assurance.ts admitEvidence(PROPOSED)/invalidateEvidence(ADMISSIBLE)/expireAssumption(PROPOSED,DISCLOSED,UNDER_VERIFICATION,ACCEPTED); decomposition.ts validateDecomposition(UNDER_REVIEW)/reviseDecomposition(VALID,CONDITIONALLY_VALID,INVALID)/beginRecomposition(READY,CONFLICTED,INSUFFICIENT)/completeRecomposition(EVALUATING). runtime-binding had 0 remaining (DWP-00/01b)."
  - "ApproveIntent authored the MACHINE's FORMALIZED|REVISED (two in-arrows to APPROVED), deliberately WIDER than the vocab's drivesFrom=FORMALIZED-only — vocab disagreement recorded in-comment (DS D4). Tested: the REVISED->APPROVED re-approval cycle still succeeds."
  - "BeginRecomposition UNCLEAR row RESOLVED: no consumer treats a duplicate RecompositionStarted as a distinct attempt — replay-conformance checks event-TYPE set membership only, and the §26 canonical fixture carries exactly one (the live seed drives no recomposition at all — pinned in replay-conformance's `missing` list). So the machine's full set READY|CONFLICTED|INSUFFICIENT is correct: it admits legitimate re-evaluation (CONFLICTED/INSUFFICIENT->EVALUATING, which re-emits) and refuses only the EVALUATING->EVALUATING NOOP. Not a rubber stamp; not a finding-against."
invariants:
  - "No precondition is NARROWER than its machine's in-arrows unless the narrowing is deliberate, stated, and tested. HELD: every set is exactly the machine's in-arrow set (verified by the post-build set-correctness lens — zero mismatches)."
tests:
  - "NEW dwp03-precondition-coverage.test.ts (14): per-site re-issue REFUSED (RPH_ILLEGAL_STATE_TRANSITION, no second event) + the two non-seed legitimate in-arrows (approveIntent from REVISED; beginRecomposition re-evaluation from CONFLICTED) + reviseDecomposition from all three of VALID/CONDITIONALLY_VALID/INVALID. Mutation-verified live through BOTH primitives (advanceIntent + advanceStatus). Seed drives unchanged (rph-engine 69/69)."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-04
title: "Author preconditions — assurance and governance (the highest-stakes families)"
master_work_packages: [DS-001:D4]
outcome: "The SIX highest-stakes advanceStatus sites carry authored preconditions: governance.ts revokeDecision(EFFECTIVE), promoteBaseline(APPROVED), supersedeBaseline(AUTHORITATIVE) and assurance.ts activateAssurancePolicy(DRAFT|SUSPENDED), suspendAssurancePolicy(ACTIVE), supersedeAssurancePolicy(ACTIVE|SUSPENDED). SCOPE CORRECTED by JAN-CMDPRE-SPEC-001 §3.1/§5.2: the v0.1.0 'assurance (6) + governance (6)' framing over-counted — ApproveDecision/GrantWaiver are DWP-01a's (critique B1); EditAssurancePolicy + SubmitEvidenceForAssessment are commitState / reader-precondition sites (no status advance) deferred to F-6/DWP-08; admitEvidence/invalidateEvidence/expireAssumption were DWP-03. DWP-04's true advanceStatus surface is these six."
knowledge_status: CONFIRMED
delivered_under: "JAN-CMDPRE two-phase engagement (DWP-04-agent-prompt.md). Phase 1: authored JAN-CMDPRE-SPEC-001 Command Precondition and Transition Legality (docs/Command Precondition Legality/) — the program deep reference these six implement against; commissioned as a canon SPEC but reclassified by the sponsor (2026-07-24) as a JAN-CMDPRE program reference, NOT canon. Phase 2: this implementation. Forks F-2 (accept the guarded-site code change), F-3 (PromoteBaseline = fromStates(APPROVED) + keep canPromoteBaseline), F-4 (the three AssurancePolicy sets UNRATIFIED-AUTHORED from the machine), F-5 (revision out of INV-6) ADOPTED as delegated authority (sponsor 'Proceed', 2026-07-24)."
repository_scope:
  files_or_symbols:
    - "governance.ts revokeDecision(:279), promoteBaseline(:549), supersedeBaseline(:676)"
    - "assurance.ts activateAssurancePolicy(:344), suspendAssurancePolicy(:333), supersedeAssurancePolicy(:311) — the three with NO drivesFrom, authored from the machine and marked UNRATIFIED-AUTHORED (F-4)"
required_changes:
  - "DONE. Six fromStates(...) sets authored from each machine's own in-arrows, rows cited in-comment; each EQUALS its machine in-arrow set (adversarial set-correctness lens: zero mismatches, none narrower/wider). The retained guards (canPromoteBaseline; rejectIfFloorLocked ×3) are INDEPENDENT domain rules kept AFTER the precondition (INV-3 non-example), never removed."
  - "RECLASSIFICATION (DS §10 residual 2, as anticipated): PromoteBaseline is GUARD_ONLY_ACCIDENTAL, not NONE — canPromoteBaseline already refused the AUTHORITATIVE re-issue via canTransition (NOOP-excluding) but with the WRONG code RPH_INVARIANT_VIOLATION. ENUMERATED CODE CHANGE (INV-7 / DS §14): the re-issue now refuses RPH_ILLEGAL_STATE_TRANSITION from the precondition, ahead of the guard. Third instance of the family code change (after makeDecisionEffective and publishPwa, both DWP-01b)."
  - "revokeDecision carries NO decisionType predicate — revocation legitimately addresses BOTH an APPROVAL-family decision and a WAIVER from EFFECTIVE (tested on both)."
invariants:
  - "SupersedeAssurancePolicy's tags array cannot grow on a re-issue (DS F-4 / SPEC INV-6). VERIFIED: the negative fixture supplies a DIFFERENT supersededByPolicyId and asserts tags did not grow."
  - "No currently-refused command becomes accepted; the widest legal in-arrow still succeeds (INV-5). VERIFIED: two-source positive fixtures for Activate and Supersede accept BOTH sources; full gate green (1069 vitest, 49 playwright incl. policy-manager lifecycle e2e)."
tests:
  - "NEW dwp04-precondition-coverage.test.ts (18): per-site negative kill (re-issue from target + a wrong source) at RPH_ILLEGAL_STATE_TRANSITION with no second event / no revision bump; positive widest-in-arrow (two-source for Activate/Supersede); the PromoteBaseline code-change assertion; the F-4 tags-not-compounded assertion. Mutation red-proof performed LIVE: weakening all six sets made EXACTLY the six kill tests RED and left all 12 positives green (CON-000 B7)."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-05
title: "Author preconditions — pwa-authoring publication (4) and the SEVEN execution PLAN-level sites"
master_work_packages: [DS-001:D4, DS-001:D8]
outcome: "The 11 ELEVEN status-advancing sites are authored: execution.ts approveExecutionPlan(UNDER_REVIEW), activateExecutionPlan(APPROVED), cancelExecutionPlan(APPROVED|ACTIVE), completeExecutionPlan(ACTIVE), failExecutionPlan(ACTIVE), supersedeExecutionPlan(PROPOSED|UNDER_REVIEW|APPROVED|ACTIVE), applyTacticalChange(ACTIVE, the declared hold); pwa-authoring.ts submitPwaForReview(DRAFT), validatePwa(UNDER_REVIEW), deprecatePwa(PUBLISHED), retirePwa(DEPRECATED). The 5 commitState/edit-append sites (DeletePwa, EditPwa, EditPwuType, RemovePwuType, AppendConversationEntries) are NOT status advances and are deferred to DWP-08 (reader-precondition variant)."
knowledge_status: CONFIRMED
delivered_under: "DWP-05 step 1 (empirical establishment via a 16-site establish->verify->synthesize workflow, run wf_aa098578-c84) CONFIRMED the PARTIAL exposures and CORRECTED RetirePwa; the sponsor approved the target-set proposal ('Proceed') and the four fork resolutions as delegated authority (2026-07-24). Every set authored from its machine's own in-arrows (ExecutionPlan.status transitions.data.ts:1355-1420; PWA.publicationStatus :1616-1630)."
repository_scope:
  files_or_symbols:
    - "execution.ts approveExecutionPlan(:262), activateExecutionPlan(:323), cancelExecutionPlan(:367), completeExecutionPlan(:392), failExecutionPlan(:431), supersedeExecutionPlan(:455), applyTacticalChange(:490)"
    - "pwa-authoring.ts submitPwaForReview(:695), validatePwa(:786), deprecatePwa(:853), retirePwa(:863)"
required_changes:
  - "DONE. ApplyTacticalChange declares fromStates('ACTIVE') (the honest hold, DS §5) and its redundant hand-rolled status guard was REMOVED — the precondition is the single authoritative source-state declaration. Load-bearing beyond NOOP closure: without it, APPROVED->ACTIVE is a LEGAL transition, so a tactical change would be a backdoor activation bypassing canActivatePlan (proven by the mutation red-proof)."
  - "DONE. ENUMERATED CODE CHANGE (INV-7): activateExecutionPlan was GUARD_ONLY_ACCIDENTAL — canActivatePlan's canTransition (NOOP-excluding) refused an already-ACTIVE re-issue with the WRONG code RPH_INVARIANT_VIOLATION; now RPH_ILLEGAL_STATE_TRANSITION from the precondition ahead of the guard. The one-active-plan-per-PWU rule (RPH-EXE-001) is retained in the guard (INV-3 non-example), verified unaffected by execution-plan-activation-guard.test.ts."
  - "DONE. Guard-mask corrections (INV-3): completeExecutionPlan (step guard), supersedeExecutionPlan (successor guard), validatePwa (pwaCompositionGate, the PILOT-002 ordering issue) all sit the precondition ahead of a content/structural guard, so a wrong-state input now refuses on STATE. Guards retained for legitimate inputs."
  - "RECLASSIFICATION (DWP-05 step 1): RetirePwa was recorded codeChange=none by the establish agent (a wrong-state parity fallacy); the verify agent CORRECTED it — the NOOP closure still requires the source edit. The 5 commitState sites were re-classified out of DWP-05 into DWP-08 (no status advance)."
invariants:
  - "The declared ACTIVE->ACTIVE hold still works and is REPEATABLE (two distinct tactical changes accepted); a re-issue from a non-ACTIVE state does not. VERIFIED (dwp05-precondition-coverage.test.ts)."
  - "No currently-refused command becomes accepted; every reachable source still succeeds (INV-5 two-source Cancel; the 3 reachable sources of the 4-source Supersede — PROPOSED is machine-legal but unreachable, ProposeExecutionPlan creates plans in UNDER_REVIEW). VERIFIED. Full gate green (check-types 21/21, vitest full-monorepo incl. rph-application 338, lint, boundary 0, playwright 49/49)."
tests:
  - "NEW dwp05-precondition-coverage.test.ts (18): per-site negative kill (re-issue from target + a wrong source) at RPH_ILLEGAL_STATE_TRANSITION with no second event / no revision bump; two-source Cancel + 3-reachable-source Supersede positives; the ActivateExecutionPlan code-change assertion; the Complete/Supersede/Validate guard-mask corrections; the ApplyTacticalChange declared-hold (admitted + repeatable) + wrong-state refusal. Mutation red-proof performed LIVE: weakening all 11 sets (widen 10, delete the hold's) made EXACTLY the 11 kill/wrong-state tests RED and left all 7 positives green (CON-000 B7). No existing test needed updating."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-06
title: "Make the declaration MANDATORY (zero-behaviour type flip at census 0)"
master_work_packages: [DS-001:D5]
outcome: "`precondition` is now a REQUIRED property on both primitives' args (kit.ts advanceStatus, intent.ts advanceIntent). The compiler enforces that every status advance declares a source-state precondition — a new call site cannot silently omit it. `advancePwuLifecycle` (the third primitive, pwu.ts:299) is independent (does not route through advanceStatus) and out of scope — the F-6 PWU-lifecycle sites."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["kit.ts advanceStatus args", "intent.ts advanceIntent args", "governance.ts submitBaselineForReview (the one site the flip surfaced)"]
required_changes:
  - "DONE. Flipped `precondition?` -> `precondition` (required) on both primitives. The flip surfaced EXACTLY ONE previously-uncovered advanceStatus site — submitBaselineForReview (Baseline.status CANDIDATE->UNDER_REVIEW), a NONE site OUTSIDE DWP-04's six — precisely the 'if any call site needs a set authored here, DWP-01a..05 was incomplete and THAT is the finding' case this DWP anticipated. Closed it: `precondition: fromStates('CANDIDATE')` + a kill test + live mutation red-proof (weakening to include UNDER_REVIEW makes the kill test RED)."
  - "The compiler requirement SUBSUMES the census test the plan called for: a missing declaration is now a compile error (initial flip reported exactly one TS2345 at governance.ts submitBaselineForReview), so the count cannot silently regress — no separate census test needed."
invariants:
  - "check-types is the gate: it is now a compile error to omit the declaration. VERIFIED (21/21 after the fix)."
  - "Zero behavioural change from the flip itself — every PRE-EXISTING test passed untouched (zero assertion edits). The only NEW test is dwp06-precondition-coverage.test.ts (1) for the surfaced site. Full gate green (vitest rph-application 339, rph-demo 104; lint; boundary 0; playwright 49/49)."
prohibited_shortcuts:
  - "HELD: no sentinel/escape-hatch value introduced — sequencing this LAST made it unnecessary (DS D5, B3)."
  - "HELD: landed only after the census reached (effectively) zero — the flip found ONE residual site, not a 31-site red branch, confirming DWP-01a..05 had authored the rest."
tests: ["NEW dwp06-precondition-coverage.test.ts (1): submitBaselineForReview accepts CANDIDATE->UNDER_REVIEW and refuses a re-issue from UNDER_REVIEW (RPH_ILLEGAL_STATE_TRANSITION, one event, no rev bump), mutation-red-proofed. The rest of the suite is UNTOUCHED — the proof of zero behaviour change for the flip."]
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-07
title: "Kernel reconciliation — the checkTransition/canTransition split, and the ratified self-edge"
master_work_packages: [DS-001:D2, DS-001:D6]
outcome: "The two sibling helpers stop disagreeing silently: the split is documented, and a machine that DECLARES a self-edge illegal has that declaration honoured end to end — vocab row restored, generator stops stripping it, classifier consults the illegal table BEFORE the from===to shortcut."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "packages/rph-domain/src/stateMachine.ts:40-50 (classifier ORDER), :53-55 (canTransition), :62-70 (assertTransition — zero production callers)"
    - "packages/rph-domain/src/gen/gen-transitions.ts:133 (`if (i.from === i.to) continue;`)"
    - "packages/rph-domain/vocab/m2-transitions.json (the §24.2 Baseline row — already present)"
    - "packages/rph-domain/src/transitions.test.ts (the illegal-row invariant that goes RED without the reorder)"
required_changes:
  - "DONE. classifyTransition (stateMachine.ts) consults `m.illegal` BEFORE the from===to shortcut. Verified safe: EXACTLY ONE declared illegal self-edge exists across all 27 machines (Baseline AUTHORITATIVE->AUTHORITATIVE — a vocab scan + the new differential test confirm it), so exactly one classification changes and every UNdeclared self-edge still classifies NOOP."
  - "DONE. The generator's self-loop drop (`gen-transitions.ts` classifyIllegal `if (i.from === i.to) continue`) is removed, so the corpus's §24.2 row reaches the table. Regenerated via `bun run gen` + prettier; the transitions.data.ts diff is EXACTLY the one illegal row (gen output is compact and round-trips to the committed file under prettier — no content drift; the 1653-line raw-gen scare was formatting-only). The generator's OTHER drop branches (cross-axis lift, `guarded` reclassification) are untouched."
  - "DONE. The checkTransition (LEGAL|NOOP, kit.ts) vs canTransition (LEGAL only, stateMachine.ts) split is documented at BOTH definitions, naming which sites depend on which (guards use canTransition and must refuse the NOOP; advanceStatus uses checkTransition and refuses the NOOP one layer up via the precondition)."
invariants:
  - "Baseline AUTHORITATIVE->AUTHORITATIVE classifies ILLEGAL_EXPLICIT and canTransition is false. VERIFIED (new test + the existing illegal-row invariant now covers the restored row)."
  - "transitions.test.ts's illegal-row invariant passes WITHOUT deleting or weakening any assertion — it now iterates the restored row and asserts ILLEGAL_EXPLICIT (it would be RED without the reorder). VERIFIED (34 -> 37 tests, all green)."
  - "No machine other than Baseline changes classification. VERIFIED three ways: the regenerated diff is one row; the new differential test asserts exactly one declared illegal self-edge; every non-illegal self-edge still classifies NOOP."
  - "No OBSERVABLE command behaviour change — this is kernel defense-in-depth BELOW the precondition: promoteBaseline's DWP-04 fromStates('APPROVED') refuses an AUTHORITATIVE re-issue before checkTransition, and canPromoteBaseline's canTransition was already false for it. Full gate green (vitest all packages incl. rph-domain 220, rph-application 339; check-types 21/21; lint; boundary 0; playwright 49/49)."
prohibited_shortcuts:
  - "HELD: no failing assertion deleted — the illegal-row invariant passes on its own terms."
  - "HELD: no blanket from===to ban — every UNdeclared self-edge still classifies NOOP (proven by the differential test across all machines + the seed/full suite)."
  - "HELD: the generator's cross-axis + guarded drop branches are untouched (the regen diff is one row)."
tests:
  - "NEW dwp07 block in transitions.test.ts (3): Baseline AUTHORITATIVE->AUTHORITATIVE is ILLEGAL_EXPLICIT (canTransition false + assertTransition throws); exactly one declared illegal self-edge exists across all machines; every non-illegal self-edge still classifies NOOP. Plus the existing illegal-row invariant now covers the restored row."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-08
title: "The eight unchecked commitState sites"
master_work_packages: [DS-001:D9]
outcome: "The eight commitState sites that mutate-and-emit with NO transition check gain an explicit precondition. They are EDITS, not transitions, so the rule differs in kind — the state set does not apply and a predicate is authored per site."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["assurance.ts:297,706", "pwa-authoring.ts:89,149,465,521,612,681"]
required_changes:
  - "Author a per-site rule TABLE split by rule KIND — these are not one rule (critique B4, DS D9 amended): EDIT (must change something) · DELETION (must exist / not already removed: deletePwa, removePwuType) · EVENT-LOG-DEPENDENT (submitEvidenceForAssessment) · DERIVED (bumpPwaSemanticVersion)."
  - "submitEvidenceForAssessment commits with NO state delta BY DESIGN — its own comment says the received-evidence fact lives on the EVENT. A generic no-change rule REFUSES it and takes down the claim->evidence->assessment->decision->baseline chain and the seed. Its real defect is the same evidenceId submitted twice, which is undecidable from (state,payload) and needs the reader settled in DWP-01b."
  - "REMOVE bumpPwaSemanticVersion from the class as a disclosed residual: it is a derived write with no command of its own and a synthesised idempotency key, firing nine times on one aggregate in the seed."
  - "Confirm the count is EIGHT — DS F-11 originally said nine and wrongly included pwu.ts:298, which IS guarded via canTransition."
invariants:
  - "Each site's rule is stated per KIND; there is no single cross-site invariant."
  - "The reference seed drives unchanged, and the pwa-authoring dispatchBatch e2e stays green — this is the only site-authoring DWP that had no seed or positive-path gate in v0.1.0."
prohibited_shortcuts:
  - "Do NOT force these into the state-set shape; they are not transitions."
  - "Do NOT apply a blanket no-change rule — it is false at submitEvidenceForAssessment."
tests: ["NEW dwp08-precondition-coverage.test.ts (10): per site the refusable case is REFUSED and the LEGITIMATE case still SUCCEEDS — incl. submitEvidence's zero-delta FIRST submission (a generic no-change rule would have refused it), and a legitimately-recurring IDENTICAL conversation batch (proving the deferred dup-batch rule was NOT shipped). Mutation red-proof: neutering kit.checkPrecondition (the shared DWP-08 enforcement point) made EXACTLY the 6 kill tests RED and the 4 legitimate tests green (CON-000 B7). Seed drives unchanged (rph-engine 69) + PWA/dispatchBatch e2e green (playwright 49/49)."]
delivered_under: "6 predicates authored via a new kit.checkPrecondition (factored from advanceStatus' inline logic) + command-precondition.noOpEditPrecondition (deep-equal via node:util isDeepStrictEqual). KINDs: EDIT no-op (editAssurancePolicy, editPwa, editPwuType) · DELETION (removePwuType, status==='REMOVED', RPH_INVARIANT_VIOLATION matching deletePwa) · EVENT-LOG-DEPENDENT reader (submitEvidenceForAssessment, dup (evidenceId,requirement) via read.aggregateEvents — the seed trap: it commits NO state delta by design) · EDIT sub-rule (appendConversationEntries empty-batch). deletePwa was ALREADY covered (explicit already-DISCARDED guard) -> documented, not double-authored (stale docstring corrected). RESIDUALS: bumpPwaSemanticVersion (DERIVED, disclosed) + the appendConversationEntries duplicate-BATCH rule (DEFERRED — entries carry no per-batch id, so a content-only key would OVER-REFUSE a legitimately recurring identical turn; the establishment's adversarial verify CAUGHT this over-refusal; awaits a stable per-batch id). Count confirmed 8 = 6 authored + deletePwa documented + bumpPwaSemanticVersion residual; pwu.ts:298 (changePwuState) is DWP-02 + guarded, not a DWP-08 site."
delivery_state: DELIVERED
```

```yaml
id: JAN-CMDPRE-DWP-09
title: "History audit + disclosed-residual register"
master_work_packages: [DS-001:D7]
outcome: "The seeded workbench and any stored history are AUDITED for pre-existing contradictions (duplicate terminal events, a re-pointed PWA root), reported in a residual register. Nothing is rewritten — events are ratified immutable and the corpus supplies no retraction."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["NEW docs/Command Precondition Legality/RESIDUALS.md", "a read-only audit script (scratch, not shipped)"]
required_changes:
  - "Scan for >1 event of the same terminal type per aggregate; report aggregate, event ids, and the contradicting fields."
  - "State explicitly which contradictions are UNREPAIRABLE and why (DOC-007 §9.1)."
invariants: ["The audit is READ-ONLY. No event is modified, deleted, or compensated."]
tests: ["the audit runs against the reference seed and its output is committed as the register."]
delivered_under: "A read-only scratch runner (packages/rph-engine/src/_dwp09-audit.test.ts — run then REMOVED, not shipped; source embedded in the register §5 for reproducibility) seeded a fresh store via seedWorkbench (the superset history: policy library + Product Realization PWA + Field Service Management Undertaking + reference-undertaking chain) and scanned engine.readAllEvents() only. Scale: 299 events, 104 aggregates. FINDING: ZERO contradictions — no duplicate terminal/once-only event on any aggregate (no DecisionRevoked/BaselineSuperseded/AssurancePolicySuperseded occurs at all; BaselinePromoted/DecisionEffective/BaselineApproved each land once per aggregate, the ×2 tallies being across two DISTINCT aggregates), and ZERO re-pointed PWA roots (one PwaPublished, one rootPwuTypeId, one isRoot type). The only per-aggregate multiplicities are BENIGN and disclosed: PwaEdited ×9 (the bumpPwaSemanticVersion derived write = residual R1) and distinct-payload PwuStateChanged lifecycle steps. docs/Command Precondition Legality/RESIDUALS.md commits the audit + the §3 UNREPAIRABLE rationale (JPWB-DOC-003 §9 PER-1/PER-2 + JPWB-CON-000 AX-7; the roadmap's legacy 'DOC-007 §9.1' resolves to these) + the R1-R5 residual register (R1 bumpPwaSemanticVersion + R2 AppendConversationEntries duplicate-BATCH rule = the two DWP-08 disclosures; R3-R5 = DS-001 §15 standing deferrals). Nothing rewritten — the audit is read-only. No package/gate change (the scratch runner was removed); check-types/test/lint/boundary confirmed unchanged."
delivery_state: DELIVERED
```

## 10. Data and persistence changes

**None.** No DB migration, no `SCHEMA_VERSION` change, no contract/vocab object change. DWP-07 touches the generated transition TABLES (fidelity), not persisted data.

## 11. Execution, compatibility, and migration strategy

Land order **01a → 09** (§17). Each: land → central gate → commit by explicit path. **Back-compat:** DWP-01a…05 refuse commands that are already semantically inapplicable; no currently-*legitimate* flow may start failing, which is why every DWP carries a positive test for its widest legal path. **Known behaviour change outside `packages/`** (DS F-15): the demo's form actions surface a 400 on a double-submit that silently succeeded before, and a rejecting command aborts its `dispatchBatch` — accepted under D3, verified per DWP. **DWP-01a's companion demo change** (found by its post-build verification): the Decision Center's propose form offered `WAIVER` — minting decisions that carried no §12.2 WaiverDetail and could never discharge anything — and rendered an Approve button the new precondition refuses on first submit, with no grant/deny affordance anywhere. `WAIVER` is removed from the propose dropdown (RequestWaiver is the authoring path) and PROPOSED waiver rows now offer Grant/Deny, mirroring the engine's own preconditions.

## 12. Assurance, tests, and evidence plan

- **Per DWP:** refusal test + **positive widest-legal-path test** + no-event/no-revision assertion.
- **Constitution:431:** for every affected machine, changed legal transitions, relevant illegal transitions, and guards.
- **Mutation discipline:** for each enforcement point, confirm that reverting it makes a *named* test fail. The prior series' most damning finding was fixtures shaped so the defect could not appear.
- **Seed gate:** the reference undertaking must drive unchanged (DWP-02's explicit acceptance criterion).
- **Central gate, never in a sub-agent:** `check-types` · `test` · `lint` 0 · `boundary` 0 · svelte-check 0 · Playwright.
- **Post-build adversarial verification** (read-only) before the series is called complete.

## 13. Security, authority, and tenant-impact analysis

DWP-00 closed a **live privilege escalation** (`AuthorizeRuntimeBinding` re-authorization replacing the granted capability set wholesale, exceeding what was requested, by a second actor, with no new authorization decision). DWP-01a closes **two** governance-authority holes, which are mirrors of each other: `DenyWaiver` driving a non-waiver approval decision to SUPERSEDED, and — found by the roadmap critique, named nowhere in the design until now — **`ApproveDecision` aimed at a PROPOSED WAIVER driving it EFFECTIVE and thereby DISCHARGING THE ASSURANCE FLOOR**, because `authorizeDecisionEffective` never checks `decisionType` and `floor-gate.ts` honours the resulting object without regard to which command produced it. The second is the more serious: it retires an assurance obligation while writing `DecisionEffective` where a `WaiverGranted` should be, so no waiver fact exists to audit, review or expire. No DWP grants, withholds, or re-scopes any actor's authority; every change REFUSES commands the domain already implies are inapplicable. No tenant surface.

## 14. Observability, recovery, and rollback

A wrong-STATE refusal returns `RPH_ILLEGAL_STATE_TRANSITION` (status `REJECTED`); since DWP-01b sited precondition enforcement ahead of `args.guard`, this now holds even at the two guarded coexistence points (the makeDecisionEffective factory and publishPwa), where a wrong-state re-issue previously surfaced the guard's code — `RPH_AUTHORITY_INSUFFICIENT` (status `UNAUTHORIZED`) at the factory, `RPH_INVARIANT_VIOLATION` at the floor gate. A wrong-KIND refusal (DWP-01a's decisionType mismatch, where the state arrow is legal) returns `RPH_VALIDATION_SEMANTIC_FAILED`. Every refusal carries a message naming the command, the aggregate, the expected precondition and the actual state — so a refused double-submit is diagnosable from the response alone. **Rollback:** each DWP is a self-contained commit and independently revertible; DWP-06 is the only one with a cross-cutting type dependency, which is why it is sequenced last.

## 15. Risks, assumptions, unknowns, decisions, deferrals, divergences

- **RISK:** authoring a precondition NARROWER than the machine silently breaks a legitimate path. *Mitigation:* the mandatory positive test per site.
- **RISK:** DWP-05's four unconfirmed plan-level exposures may turn out benign, making that DWP smaller than scoped. *Mitigation:* `knowledge_status: PARTIAL`, establish empirically first.
- **ASSUMPTION:** the 11 BENIGN classifications hold. *Held loosely* — DS §10 residual 2 expects at least one reclassification; each is re-verified at authoring time.
- **~~UNKNOWN~~ RESOLVED (DWP-03):** no consumer treats a duplicate `RecompositionStarted` as a distinct attempt — replay-conformance keys on event-TYPE set membership; the §26 canonical fixture carries exactly one; the live seed drives no recomposition. So `beginRecomposition` safely carries the machine's full `READY|CONFLICTED|INSUFFICIENT` set (admits re-evaluation, refuses only the NOOP).
- **DEFERRED, disclosed:** `expectedRevision` migration; retraction of written events; projection-level contradiction surfacing.
- **DIVERGENCE:** preconditions are authored from the MACHINE, deliberately diverging from the vocab's `drivesFrom` where they disagree; each divergence is recorded in-comment.

## 16. Traceability matrix

| Design decision | DWP | Primary files | Verified by |
|---|---|---|---|
| D1 precondition shape | 01b | command-precondition.ts, kit.ts, intent.ts | unit + DWP-00 tests unchanged |
| D8 wrong-source half | 01a | governance.ts | DenyWaiver-on-approval refused |
| D10 ChangePwuState | 02 | pwu.ts | seed drives unchanged |
| D4 authored allowlists | **03 (intent+evidence/assumption+decomp/recomp, DELIVERED)**, **04 (governance ×3 + AssurancePolicy ×3, DELIVERED)**, **05 (execution plan-level ×7 + pwa-authoring publication ×4, DELIVERED)** | intent.ts, assurance.ts, decomposition.ts, governance.ts, execution.ts, pwa-authoring.ts | refusal + widest-legal-path per site (dwp03-/dwp04-/dwp05-precondition-coverage.test.ts); DWP-04/05 mutation-red-proofed live + adversarially verified |
| D5 mandatory | **06 (DELIVERED)** | kit.ts, intent.ts, governance.ts (submitBaselineForReview — the one gap the flip surfaced) | check-types is the gate (compile error to omit); zero edits to existing assertions; dwp06-precondition-coverage.test.ts + mutation-red-proof |
| D2 + D6 kernel | **07 (DELIVERED)** | stateMachine.ts, gen-transitions.ts, transitions.data.ts (regen), kit.ts | illegal-row invariant green (no assertion weakened); regen diff = exactly the Baseline AUTHORITATIVE→AUTHORITATIVE row; differential test proves exactly one changed classification; split documented at both helpers |
| D9 commitState | **08 (DELIVERED)** | assurance.ts, pwa-authoring.ts, kit.ts (checkPrecondition), command-precondition.ts (noOpEditPrecondition) | 6 per-KIND predicates (EDIT/DELETION/reader/empty-batch); refusable refused + legitimate succeeds; mutation-red-proofed; seed unchanged; deletePwa already-covered; dup-batch + bumpPwaSemanticVersion = disclosed residuals (dwp08-precondition-coverage.test.ts) |
| D7 history | **09 (DELIVERED)** | RESIDUALS.md | read-only audit committed: 299 events / 104 aggregates, ZERO contradictions (no duplicate terminal event, no re-pointed root); §3 UNREPAIRABLE rationale grounded in DOC-003 §9 PER-1/PER-2 + CON-000 AX-7; R1-R5 residual register (R1/R2 = DWP-08 disclosures, R3-R5 = DS-001 §15 deferrals); scratch runner removed (not shipped) |

## 17. Implementation ordering and concurrency plan

Critical path **01a → 01b → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09**, sequential. Rationale for the order: the **live wrong-source exploits first** (01a — the security half, split from the mechanism per §19 residual 1), then the **mechanism that generalises them** (01b), then the **vacuity trap on the busiest write path** (02), then the families in ascending stakes (03 → 04 → 05), then the type flip **only once the census is zero** (06), then the kernel (07 — independent, but deliberately after the call sites so a classifier change lands against a fully-guarded engine), then the different-in-kind class (08), then the audit (09). **07 and 08 are the only pair that could run concurrently**; they are kept sequential because both touch invariant tests.

## 18. Exit criteria and gate package requirements

**Series complete when:** DWP-00…09 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · Playwright); every state-advancing site carries a declared precondition and omitting one is a compile error; the reference seed drives unchanged; a re-issue at every previously-demonstrated exploit is refused with no event appended; the ratified §24.2 self-edge is honoured end to end; the residual register is committed; **post-build adversarial verification executed + reconciled**. Gate package `G-CMDPRE-001`.

**SERIES COMPLETE (DWP-09 delivered).** All ten increments DWP-00…09 are `DELIVERED`. Every state-advancing site carries a compiler-mandatory precondition (D5/DWP-06); the `commitState` sites carry per-KIND predicates (D9/DWP-08); the kernel honours the ratified §24.2 illegal self-edge (D2+D6/DWP-07); the reference seed drives unchanged across the whole series; and the residual register (RESIDUALS.md) is committed with a read-only audit finding ZERO pre-existing contradictions and disclosing residuals R1–R5. The only remaining open items are the disclosed residuals in that register — none a defect, each with a stated disposition.

## 19. Self-critique and readiness determination

**A 3-lens adversarial critique was EXECUTED** (DWP feasibility · sequencing/integration · gate & test completeness), read-only against the built engine. **19 findings; 4 blockers + 5 majors**, all folded in above. Two of the three weaknesses v0.1.0 self-flagged were confirmed; the fourth blocker was something none of them named.

- **B1 → FIXED.** `GrantWaiver` has no call site of its own. `makeDecisionEffective` is a FACTORY with one `advanceStatus` literal serving both `ApproveDecision` and `GrantWaiver`, so v0.1.0 both double-owned it (DWP-01 and DWP-04) and made its own fix impossible: one predicate on that literal refuses every `ApproveDecision` and takes the seed down. The factory now takes a precondition PARAMETER; the census counts command types, not call sites.
- **B2 → FIXED, and it is a LIVE EXPLOIT the design had not named.** `ApproveDecision` on a PROPOSED WAIVER drives it EFFECTIVE and discharges the assurance floor with no waiver fact recorded. Verified in source: `authorizeDecisionEffective` checks only legality + authority; `floor-gate.ts:224-233` filters on the OBJECT's `decisionType`/`status`, never on the event type. §13's "DWP-01 closes a governance-authority hole" was an overclaim while its mirror was open. The family is now closed symmetrically. **DS D8 amended.**
- **B3 → FIXED.** `advanceStatus` runs `args.guard` BEFORE the precondition slot, so at the four `canTransition`-guarded sites a precondition would be **dead code** — DWP-04's headline outcome unreachable, and §12's mutation discipline unsatisfiable there, which is the "fixtures shaped so the defect could not appear" failure §12 exists to prevent, reproduced at the sites DWP-04 exists for. Enforcement moves ahead of the guard in DWP-01b, and the consequence is accepted explicitly: the migration is **not** zero-behaviour at guarded sites, because the refusal code changes.
- **B4 → FIXED. DS D9 amended.** DWP-08's single invariant is false at `submitEvidenceForAssessment`, whose zero-state-delta commit is DESIGNED, and wrong-shaped at three more sites. It also forced a decision that had to move to the FIRST increment: whether `Precondition.check` receives a reader, since the only correct rule at that site depends on the event log.
- **M1…M5 → FIXED.** Stale line numbers (all references now by exported symbol); `ProposeDecomposition` was not a state-advancing site; nine commands were covered by aggregate COUNT but named in no DWP — including three on `Evidence.status` and `Assumption.status`, two machines the roadmap never mentioned, making §12's per-machine obligation unmeetable; the per-DWP counts summed to 33 against 31 real sites; DWP-00's site count is NINE, not eight.

**Residual weaknesses I still hold, disclosed:**

1. **DWP-01 was larger than v0.1.0's, not smaller — and the predicted split WAS TAKEN in flight** (v0.2.1): DWP-01a lands the two live exploits on DWP-00's shipped shape (the security half, small and revertible); DWP-01b carries the mechanism, the signature decision, the guard reorder and the migration. The split is sound because neither exploit depends on the reorder — the factory owns its guard, and `denyWaiver` has none. Cost accepted: DWP-01a's three command types are one more thing DWP-01b migrates.
2. **The BENIGN classifications remain second-hand** (DS §10 residual 2), now compounded: the critique reclassified sites in three DWPs, so I expect further reclassification during DWP-03/04/05.
3. **DWP-07's ordering is still unsettled.** The critique did not conclusively establish that the classifier reorder is behaviour-neutral for all 26 non-Baseline machines; until it is measured, "late is safe" is an assumption.

**Readiness: DWP-01a `DELIVERED`** (post-build 4-lens adversarial verification EXECUTED: 11 agents, 6 distinct confirmed findings — the bypass lens found NO remaining path to either exploit; the survivors were 1 MAJOR demo-affordance regression + 5 documentation/test-discipline MINORs, all reconciled in the same changeset). **DWP-01b `DELIVERED`** (mechanism + B4 signature ruling + B3 reorder + 12-site migration). Its post-build 4-lens verification (20 agents) EXECUTED and RECONCILED: 15 confirmed findings — the semantics lens found NO logic defect in the mechanism; the four MAJORs were a single class (six migrated fromStates sets the initial build left without kill coverage), now each carried by a named re-issue test with the mutation discipline verified live; the 11 MINORs (the no-write property made mechanical via clone, a B3 mis-attribution, an unenumerated status-flip/message-reword, stale comments, payload/reader-wiring tests, doc precision) all folded into this changeset. **DWP-02 `DELIVERED`** — ChangePwuState's vacuity PREDICATE (all-four-axes-equal REFUSED) on the DWP-01b mechanism; seed drove unchanged (rph-engine 69/69), the mutant verified killed live, and its post-build 3-lens verification (semantics · seed-regression · mechanism-fit) returned ZERO findings after substantial investigation. **DWP-03 `DELIVERED`** — 11 preconditions authored across intent/evidence-assumption/decomposition-recomposition, each the machine's own in-arrow set; the re-check found the roadmap's two "D10-shaped" worries were over-cautious (both clean state sets — a payload/evaluation-derived target does not imply a varying source) and RESOLVED the BeginRecomposition UNCLEAR row (no consumer counts RecompositionStarted). Seed unchanged (69/69); mutation-verified through both primitives; post-build 4-lens verification found NO logic defect (the set-correctness and not-D10 lenses were clean) — 3 MINORs (roadmap update, a seed-count sub-claim in a comment, a positive-coverage gap) all reconciled in-changeset. **`READY_TO_BUILD` for DWP-04 next.** DWP-04…09 carry the residuals above; each is re-checked against the tree at its own start. DWP-00 `DELIVERED`.

---

*`SERIES COMPLETE` / v1.0.0 — design authority JAN-CMDPRE-DS-001 v0.2.1. Self-critique EXECUTED: 4 blockers + 5 majors reconciled, one of them a live exploit (B2) carried back into the design. §19 residual 1's predicted split TAKEN in flight: DWP-01 → DWP-01a (security half) + DWP-01b (mechanism). **All ten increments DWP-00, 01a, 01b, 02, 03, 04, 05, 06, 07, 08, 09 `DELIVERED`**, each with post-build adversarial verification executed AND reconciled (01a: 6 findings; 01b: 15 findings incl. six kill-coverage gaps closed; 02: 0 findings; 03: 3 MINORs; 04/05: 2 independent lenses clean; 06: the mandatory flip surfaced submitBaselineForReview as predicted; 07: regen diff = exactly the §24.2 self-edge; 08: adversarial verify caught the AppendConversationEntries over-refusal, deferred as residual R2; 09: read-only audit, ZERO contradictions, residuals R1–R5 registered). Residual weaknesses §19.1–.3 all discharged in flight. Standing open items = the RESIDUALS.md register only (R1–R5), none a defect.*
