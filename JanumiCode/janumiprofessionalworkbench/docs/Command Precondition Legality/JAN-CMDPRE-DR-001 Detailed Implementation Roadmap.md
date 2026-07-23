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
    - "decomposition.ts validateDecomposition, reviseDecomposition, beginRecomposition, completeRecomposition. NOTE (critique M2): v0.1.0 said *Propose*Decomposition — that is a createObject, not a state-advancing site. TWO of these are D10-shaped, not state sets: validateDecomposition's target is payload-derived across VALID|CONDITIONALLY_VALID|INVALID, and completeRecomposition's is evaluation-derived. A re-issued ValidateDecomposition can flip a contract's recorded disposition and append a contradicting DecompositionValidated."
required_changes:
  - "For each: read the machine's in-arrows to the target, author the set, cite the rows in the comment."
  - "ApproveIntent: the machine legalises FORMALIZED|REVISED even though the vocab drivesFrom says FORMALIZED only, and the handler docstring already says FORMALIZED|REVISED — author the MACHINE's set, and record the vocab disagreement (DS D4)."
  - "BeginRecomposition is one of the two UNCLEAR rows: establish whether a duplicate RecompositionStarted is treated as a distinct attempt by any consumer BEFORE authoring; if it is, that is a finding, not a rubber stamp."
invariants:
  - "No precondition is NARROWER than its machine's in-arrows unless the narrowing is deliberate, stated, and tested."
tests:
  - "per site: a re-issue is REFUSED; the widest legitimate in-arrow still succeeds (the regression I am most likely to cause)."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-CMDPRE-DWP-04
title: "Author preconditions — assurance and governance (the highest-stakes families)"
master_work_packages: [DS-001:D4]
outcome: "The remaining assurance (6) and governance (6) advanceStatus sites carry authored preconditions. The three sites protected only by canTransition (ApproveDecision, GrantWaiver, PromoteBaseline) gain an EXPLICIT precondition so their safety stops being accidental."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols:
    - "assurance.ts:312,333,344 (Supersede/Suspend/ActivateAssurancePolicy — the three with NO drivesFrom at all), :318,339,350,425 (guarded sites)"
    - "governance.ts promoteBaseline, supersedeBaseline, revokeDecision — NOT makeDecisionEffective, which DWP-01a owns (critique B1: one literal, two command types, double-owned in v0.1.0)"
required_changes:
  - "The three AssurancePolicy commands have no drivesFrom anywhere; author from the machine and mark UNRATIFIED-AUTHORED. ActivateAssurancePolicy has TWO legal sources — the set is a list, not a scalar."
  - "Make the canTransition-accidental protection EXPLICIT. This only works because DWP-01b moved enforcement ahead of `args.guard`; without that these preconditions are unreachable and the mutation test cannot fail (critique B3). Do not remove the canTransition guards — they carry other domain rules."
  - "Re-verify the BENIGN classification of every site in these families before accepting it (DS §10 residual 2 expects at least one reclassification)."
invariants:
  - "SupersedeAssurancePolicy's tags array cannot grow on a re-issue (the compounding case, DS F-4)."
  - "No currently-refused command becomes accepted."
tests:
  - "handler: the compounding case (tags) is refused; each policy-lifecycle command refuses a re-issue; the two-source ActivateAssurancePolicy accepts BOTH sources."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-CMDPRE-DWP-05
title: "Author preconditions — pwa-authoring and the SEVEN execution PLAN-level sites"
master_work_packages: [DS-001:D4, DS-001:D8]
outcome: "pwa-authoring's remaining 4 sites and the 7 execution PLAN-level sites — the seam no grounding inventory covered, in the file a prior commit claimed to have hardened — carry authored preconditions."
knowledge_status: PARTIAL
repository_scope:
  files_or_symbols:
    - "pwa-authoring.ts:792,836 + the remaining unguarded sites"
    - "execution.ts:263 (Approve), :324 (Activate — canActivatePlan-protected), :368 (CancelPlan), :393 (CompletePlan — its guard is re-issue-STABLE and does not protect), :433 (FailPlan), :457 (SupersedePlan), :491 (ApplyTacticalChange — the DECLARED HOLD)"
required_changes:
  - "ApplyTacticalChange declares fromStates(['ACTIVE']) and drives to ACTIVE — the hold stated honestly, per DS §5. Its hand-rolled status guard then becomes redundant; remove it or keep it and say which is authoritative."
  - "CompleteExecutionPlan: its existing guard is trivially still true on an already-COMPLETED plan (DS F-7) — the precondition is what actually protects it."
  - "Establish the four unconfirmed exposures (Cancel/Fail/Supersede/Complete plan) empirically before authoring; knowledge_status is PARTIAL for exactly this reason."
invariants:
  - "The declared ACTIVE->ACTIVE hold still works; a re-issued ApplyTacticalChange that changes nothing does not."
  - "Plan-terminal e2e (execution-tier3) stay green."
tests:
  - "handler: double ApproveExecutionPlan -> REJECTED with ONE ExecutionPlanApproved (the one executed exposure); each plan-terminal command refuses a re-issue."
  - "e2e: the full execution suite regression."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-CMDPRE-DWP-06
title: "Make the declaration MANDATORY (zero-behaviour type flip at census 0)"
master_work_packages: [DS-001:D5]
outcome: "`precondition` becomes a REQUIRED property on both primitives' args. Because DWP-01a..05 authored every site, this is a pure type change with no behavioural diff — and from here a NEW call site cannot silently omit the declaration."
knowledge_status: CONFIRMED
repository_scope:
  files_or_symbols: ["kit.ts advanceStatus args", "intent.ts advanceIntent args"]
required_changes:
  - "Flip optional -> required. The diff must contain NO logic change; if any call site needs a set authored here, DWP-01a..05 was incomplete and THAT is the finding."
  - "Add a census test asserting every advanceStatus/advanceIntent call site is accounted for, so the count cannot silently regress."
invariants:
  - "check-types is the gate: it is a compile error to omit the declaration."
  - "Zero behavioural change — every test passes untouched."
prohibited_shortcuts:
  - "Do NOT introduce a sentinel/escape-hatch value. Sequencing this LAST is what makes the sentinel unnecessary (DS D5, B3)."
  - "Do NOT land this before the census reaches zero — it is a 31-site red branch otherwise."
tests: ["the entire suite passes with NO assertion edited — that is the proof of zero behaviour change."]
delivery_state: NOT_STARTED
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
  - "Reorder classifyTransition to check `m.illegal` BEFORE the from===to shortcut. Verified safe: 27 machines / 202 states / ZERO declared self-edges today, exactly one after this DWP."
  - "Stop the generator dropping declared self-edges (BOTH tables), so the corpus's own §24.2 rule can reach the tables at all."
  - "Document the checkTransition (LEGAL|NOOP) vs canTransition (LEGAL only) split at both definitions, naming which commands depend on which."
invariants:
  - "Baseline AUTHORITATIVE->AUTHORITATIVE classifies ILLEGAL_EXPLICIT and canTransition is false."
  - "transitions.test.ts's illegal-row invariant passes WITHOUT deleting or weakening any assertion."
  - "No machine other than Baseline changes classification (a 27-machine differential test)."
prohibited_shortcuts:
  - "Do NOT delete the failing assertion to make the row land — that is the exact failure this DWP exists to prevent."
  - "Do NOT introduce a blanket from===to ban (breaks the seed + two green tests, DS D2)."
  - "Do NOT disturb the generator's other drop branches (cross-axis drops, `guarded` reclassification) — they are load-bearing."
tests:
  - "unit: the restored row classifies ILLEGAL_EXPLICIT; a 27-machine before/after differential shows exactly one changed classification."
delivery_state: NOT_STARTED
```

```yaml
id: JAN-CMDPRE-DWP-08
title: "The eight unchecked commitState sites"
master_work_packages: [DS-001:D9]
outcome: "The eight commitState sites that mutate-and-emit with NO transition check gain an explicit precondition. They are EDITS, not transitions, so the rule differs in kind — the state set does not apply and a predicate is authored per site."
knowledge_status: PARTIAL
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
tests: ["per site and per KIND: the refusable case is refused; the legitimate case still succeeds; seed + dispatchBatch e2e green."]
delivery_state: NOT_STARTED
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
delivery_state: NOT_STARTED
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
- **UNKNOWN:** whether any consumer treats a duplicate `RecompositionStarted` as a distinct attempt (DWP-03).
- **DEFERRED, disclosed:** `expectedRevision` migration; retraction of written events; projection-level contradiction surfacing.
- **DIVERGENCE:** preconditions are authored from the MACHINE, deliberately diverging from the vocab's `drivesFrom` where they disagree; each divergence is recorded in-comment.

## 16. Traceability matrix

| Design decision | DWP | Primary files | Verified by |
|---|---|---|---|
| D1 precondition shape | 01b | command-precondition.ts, kit.ts, intent.ts | unit + DWP-00 tests unchanged |
| D8 wrong-source half | 01a | governance.ts | DenyWaiver-on-approval refused |
| D10 ChangePwuState | 02 | pwu.ts | seed drives unchanged |
| D4 authored allowlists | 03, 04, 05 | six handler families | refusal + widest-legal-path per site |
| D5 mandatory | 06 | kit.ts, intent.ts | check-types; zero assertion edits |
| D2 + D6 kernel | 07 | stateMachine.ts, gen-transitions.ts | illegal-row invariant green, 27-machine differential |
| D9 commitState | 08 | assurance.ts, pwa-authoring.ts | no-change edit refused |
| D7 history | 09 | RESIDUALS.md | audit output committed |

## 17. Implementation ordering and concurrency plan

Critical path **01a → 01b → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09**, sequential. Rationale for the order: the **live wrong-source exploits first** (01a — the security half, split from the mechanism per §19 residual 1), then the **mechanism that generalises them** (01b), then the **vacuity trap on the busiest write path** (02), then the families in ascending stakes (03 → 04 → 05), then the type flip **only once the census is zero** (06), then the kernel (07 — independent, but deliberately after the call sites so a classifier change lands against a fully-guarded engine), then the different-in-kind class (08), then the audit (09). **07 and 08 are the only pair that could run concurrently**; they are kept sequential because both touch invariant tests.

## 18. Exit criteria and gate package requirements

**Series complete when:** DWP-00…09 `DELIVERED`; full gate green (check-types · test · lint 0 · boundary 0 · svelte-check 0 · Playwright); every state-advancing site carries a declared precondition and omitting one is a compile error; the reference seed drives unchanged; a re-issue at every previously-demonstrated exploit is refused with no event appended; the ratified §24.2 self-edge is honoured end to end; the residual register is committed; **post-build adversarial verification executed + reconciled**. Gate package `G-CMDPRE-001`.

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

**Readiness: DWP-01a `DELIVERED`** (post-build 4-lens adversarial verification EXECUTED: 11 agents, 6 distinct confirmed findings — the bypass lens found NO remaining path to either exploit; the survivors were 1 MAJOR demo-affordance regression + 5 documentation/test-discipline MINORs, all reconciled in the same changeset). **DWP-01b `DELIVERED`** (mechanism + B4 signature ruling + B3 reorder + 12-site migration). Its post-build 4-lens verification (20 agents) EXECUTED and RECONCILED: 15 confirmed findings — the semantics lens found NO logic defect in the mechanism; the four MAJORs were a single class (six migrated fromStates sets the initial build left without kill coverage), now each carried by a named re-issue test with the mutation discipline verified live; the 11 MINORs (the no-write property made mechanical via clone, a B3 mis-attribution, an unenumerated status-flip/message-reword, stale comments, payload/reader-wiring tests, doc precision) all folded into this changeset. **DWP-02 `DELIVERED`** — ChangePwuState's vacuity PREDICATE (all-four-axes-equal REFUSED) on the DWP-01b mechanism; seed drove unchanged (rph-engine 69/69), the mutant verified killed live, and its post-build 3-lens verification (semantics · seed-regression · mechanism-fit) returned ZERO findings after substantial investigation. **`READY_TO_BUILD` for DWP-03 next.** DWP-03…09 carry the residuals above; each is re-checked against the tree at its own start. DWP-00 `DELIVERED`.

---

*`READY_TO_BUILD` (DWP-03) / v0.2.5 — design authority JAN-CMDPRE-DS-001 v0.2.1. Self-critique EXECUTED: 4 blockers + 5 majors reconciled, one of them a live exploit (B2) now carried back into the design. §19 residual 1's predicted split TAKEN in flight: DWP-01 → DWP-01a (security half) + DWP-01b (mechanism). DWP-00, DWP-01a, DWP-01b, DWP-02 all `DELIVERED`, each with post-build adversarial verification executed AND reconciled (01a: 6 findings; 01b: 15 findings incl. six kill-coverage gaps closed; 02: 0 findings). DWP-03…09 `NOT_STARTED`.*
