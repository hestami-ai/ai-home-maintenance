# JAN-EXECREM — Divergence & Residual Register

*Deliverable of **JAN-EXECREM WP-17** (roadmap `JAN-EXECREM-DR-001`, design `JAN-EXECREM-DS-001`). The single
authoritative record of what this remediation authored, what it declined to do, what it deliberately left in
place, and what it newly found. Authored under the sponsor's standing "Proceed" authority (JAN-ROADMAP-001).*

> **Why this document exists at all.** `JAN-EXECPLAN-DR-004 §15` affirmatively certified *"Divergences from
> DS-004: **none intended**"* — while two shipped (F-38, F-42), and the roadmap had no mechanism that could have
> detected either. An affirmative "none" backed by no search is the absence of evidence presented as evidence of
> absence. This register is written so that the same sentence cannot be true of JAN-EXECREM: every item below is
> a positive claim someone can go and check, and the ones that could be made machine-checked *have* been.

**Programme:** 18 work packages (WP-0 … WP-17, with WP-12 split a/b/c), 46 findings from the 2026-07-24 post-build
adversarial review of Tier 3C-ii (40 CONFIRMED including 7 BLOCKERs, 6 PLAUSIBLE). All seven BLOCKERs closed.

---

## 0. THE UNMET EXIT CRITERION — this programme has had no post-build adversarial review

**Owed, not done.** `JAN-EXECREM-DS-001 §4` rules that fixing defects without fixing *how they got in* schedules
the next recurrence. The reason the 46 findings below existed is that `JAN-EXECPLAN-DR-004 §18`'s mandated
post-build adversarial verification was **never executed** at the time of building. **JAN-EXECREM has not had one
either.** Recorded here — first, before anything else — because a register of what is owed that omits the largest
owed item repeats the exact omission it exists to prevent.

**This is NOT one of the residuals in §4, and it is not one of the findings in §5, and the distinction matters.**
A residual is a hazard that was seen, argued, and deliberately left standing; a finding is a defect that was
found. Both are *known*. The missing review is the unknown-unknowns problem, and by construction nothing in this
document bounds it: the same author wrote the code, chose the tests, picked the mutants, and wrote this register.
Anything not seen is absent from all four. §8's machine-checked list is real and is **not** a substitute — it
proves the properties someone thought to state.

**What the gates DO establish, precisely.** WP-16's registries make three specific defect shapes fail the build
rather than wait for a review: a ratified rule with no enforcement site, an enforcement site with no kill test,
and a guard whose declared inputs cannot disagree. On their first run they found three more ratified rules
enforced nowhere (§5) — which is evidence the mechanism works, and evidence that it finds things a human pass had
already missed twice. Neither is evidence that nothing else is wrong.

**Scoping note for whoever runs it.** The surface has changed materially since 2026-07-24 and the review should be
scoped to what this programme actually wrote, not re-run against the old one. Highest-value lenses, in the order I
would rank them by where I am least able to check my own work:

1. **The registers themselves** (`step-command-spec.ts`, `enforcement-register.ts`, `ATTEMPT_EFFECTS`, the arrow
   census) — a declaration is only as good as its rationale, and I wrote both the rationale and the test that
   reads it. §9's honest limit is the stated attack surface: consistent edits across production + register +
   probe map pass.
2. **The five argued divergences in §3** — each is a place I did not do what the design said. They are the items
   with the least independent scrutiny in the whole programme.
3. **The two authored rule extensions in §2** — shipped behaviour wider than its ratified text.
4. **The seams** (`plan-fixtures.ts`, `pwu-fixtures.ts`) — a fixture that can arrange an impossible aggregate lets
   a suite rehearse against a state the engine cannot produce, which is how `floor-fixtures.ts`'s own defect arose.
5. **The mutation ledgers** — ~60 declared mutants across the programme, all reported RED. A mutant that does not
   reach the code proves nothing, and a mutant chosen by the person defending the guard is not adversarial.

---

## 1. Authored contract additions (`UNRATIFIED-AUTHORED`)

Each is a shape the corpus does not ratify, landed because a ratified RULE was unenforceable without it. All are
**optional** on the wire, so no stored history becomes invalid.

| # | Shape | Why it had to be authored | WP |
|---|---|---|---|
| A-1 | `NoOutputResult {reason, detail}` + `CompleteExecutionStep.noOutputResult` | RPH-EXE-006 requires outputs **or** an explicit no-output result — and the explicit case had **no wire representation**, so the handler derived it as `!hasOutput` and the guard evaluated `b \|\| !b`. **A guard cannot be non-vacuous while one of its inputs is unrepresentable.** `detail` is required because a bare boolean records the claim without its justification. | WP-1, WP-11 |
| A-2 | `ExecutionStepSucceeded.selectedTransitionId`, `ExecutionStepSkipped.selectedTransitionId` | A BRANCH's chosen arm was held only in aggregate state; the event stream could not reconstruct it, so a replay could reach a different arm than the run did. | WP-1, WP-10 |
| A-3 | `ExecutionStepPruned.excludedEdgeId` (with `selectedByBranchStepId` / `selectedEdgeId` moved from **caller-asserted** to **gate-derived**) | The pruned event's payload was `{stepId, stepState:'SKIPPED'}` — indistinguishable in content from a *waived* skip, which is the exact conflation the separate event type was minted to prevent. | WP-1, WP-14 |
| A-4 | `EXECUTION_PLAN.authorizedRuntimeBindingIds` | `ActivateExecutionPlan` carried the ids in its payload and **no ratified object field held them**, so any rule citing "the authorized bindings" was dead on arrival. | WP-14 |
| A-5 | `ExecutionSkipAuthorization` (a DECISION of type REPLAN\|WAIVER, plan-scoped subject + explicit step list) | §21.1's "an authorized plan revision or waiver" was satisfied by `!!p.waiverOrRevisionId` — **any non-empty string**. Reusing the assurance plane's `WaiverDetail` would let a FLOOR waiver authorize an EXECUTION act: an INV-5 boundary crossing. | WP-12c |
| A-6 | `ExecutionStepRetried.retryReason` | Optional; a retry recorded no reason at all. | WP-1 |

**Landed as a scope deviation:** A-5 was scheduled for WP-1's single regeneration batch and deliberately held
back. DS-001 §6 CONFLICT-11 had ruled the design's skip-authorization fix unimplementable as specified, so its
*shape* was WP-12's to determine; landing a ratified type for a design flagged as needing re-scope would have cost
a second correction, which is worse than the second regeneration.

## 2. Authored extensions to ratified RULES

Two places where the shipped rule is **wider than its ratified text**. Both are labelled as authored in the code,
at the site, rather than presented as the ratified rule.

- **`canResumeExecutionOnPwu` generalised from `BASELINED` to the machine's own terminal set** (WP-12b).
  RPH-PWU-010's text names BASELINED only. Opening execution on an ABANDONED or SUPERSEDED unit of work is at
  least as wrong, and the set is **derived** from `PWU.workLifecycleState.terminalStates` rather than hardcoded —
  following this codebase's own stated preference for deriving from authoritative state. BASELINED keeps its own
  ratified error code (`RPH_BASELINED_PWU_NO_RESUME`); the generalised limb has a distinct one
  (`RPH_CLOSED_PWU_NO_NEW_EXECUTION`), so the two are distinguishable at the observation point and are registered
  as **separate** rows (RPH-PWU-010 / RPH-PWU-009) in the enforcement register.
- **`CancelExecutionStep.sourceStates` widened to include `FAILED`** (WP-5). WP-4 made a FAILED in-edge PENDING
  (correctly — FAILED is the only terminal state the machine can leave), which **removed a capability**:
  proceeding past an arm nobody intends to retry. Restoring it by relaxing the barrier would have reinstated the
  defect, so it is restored the other way — the operator abandons the arm explicitly, on the record, with a
  reason. A widened source set with no re-issue kill test is the exact unkilled-mutant shape this codebase has
  produced three times, so the widening ships with one.

## 3. Divergences from the design and the findings, argued and taken

Five places where I did **not** do what DS-001 / DR-001 / the finding register prescribed. Each was a considered
refusal, not an omission.

1. **WP-13 — refused the finding's fix.** F-25 proposed registering `ExecutionStepWaiting` and
   `ExecutionStepWaitResolved` in `RATIFIED_EVENT_PAYLOADS`. That registry is **derived** from vocab provenance —
   an event is in it iff its `sourceSection` is present and not `UNRATIFIED-AUTHORED` — and both events are
   annotated `UNRATIFIED-AUTHORED` because DOC-007 schematizes no interface for them. Registering them would have
   **falsified a provenance annotation** to make a conformance sweep pass. Built a stronger,
   provenance-independent sweep instead: every step event driven through the real dispatch path is `safeParse`d
   against its own declared schema.
2. **WP-12b — rejected the design's separate `execution-authority.ts` module.** A second table over the same nine
   commands is the "two lists that must agree" pathology, which is the *cause* of this defect family, not a
   remedy for it. Extended WP-8's existing `STEP_COMMAND_SPECS` with `planLiveness` / `pwuOpenness` columns and
   their rationales instead, so there is exactly one declaration and the engine, the read-model and both gates all
   read it.
3. **WP-11 — dropped the design's fourth input to `FloorSubjectAdmissibility`.** `explicitNoOutput` could not
   change the answer; a 16-cell table over it would have been 8 duplicated rows presented as coverage.
4. **WP-16 — scoped the enforcement register to `RPH-EXE-*` + `RPH-PWU-009/010`, not all of taxonomy layer 3.**
   The scope is *derived* (total over the whole `RPH-EXE` id family, so a new one cannot be ratified without a
   disposition) rather than chosen, but it excludes the Intent lifecycle and the PWU shape/baseline rules —
   command surfaces this remediation never touched. Extending the register to them is real work and is listed in
   §6 rather than faked.
5. **WP-16 — disclosed three unenforced rules rather than wiring them.** See §5. Wiring a new refusal is a
   behaviour change owing its own kill test; smuggling it into the gate that found it would leave the fix
   unreviewed and the gate unproven.

## 4. Residuals: things this programme deliberately left in place

Carried forward from DS-001 §8 (still true after the build), plus what the build itself added.

| # | Residual | Why it stands |
|---|---|---|
| R-1 | **`rejectUnbackedExecutionSuccess` remains an ENTRY gate.** A PWU's SUCCEEDED claim is backed at the moment of the claim and never re-validated; a plan later superseded or failed leaves a standing claim. | DS-001 §6 CONFLICT-12: removing the early exit breaks the reference seed, which re-asserts `executionState: 'SUCCEEDED'`. WP-12a strengthened the backing *within* the entry semantics. |
| R-2 | **Legacy stored plans are never re-validated.** WP-6's propose-time rules gate only new proposals. | Load-time re-validation would wedge legacy plans fail-closed with **no remediation command** — worse than the defect. The one place this residual is reachable (`pwuOpennessRefusal`'s wrong-type branch) is now *killable* via a named `_LEGACY_ONLY` fixture seam rather than merely disclosed. |
| R-3 | **Tautology detection is not attempted.** `.min(1)` closed the empty-combinator slip; `ATTEMPTS >= 0` remains unconditionally true. | Not detectable without a solver. Named so the next reader knows it was considered, not missed. |
| R-4 | **`structuredResult` individuation survives.** An AI step naming one floor-satisfied artifact can still ship large inline content un-individuated (the §8.4 gap `floor-gate.ts` already discloses). | Out of this programme's scope; it is an assurance-plane subject question. |
| R-5 | **`noOutputResult` is still, ultimately, a caller's assertion.** WP-11 added the state-derived corroboration limb (`declaresOutputBindings` — the *authored step's* own declaration, which the caller cannot fabricate at completion time), so the two facts can now disagree. A step authored with no `outputBindings` can still assert a no-output result untruthfully. | The authored plan is the only thing recorded state can say back. Making it stronger needs an output-obligation contract that does not exist. |
| R-6 | **Prune's source set cannot be isolated through the bus.** Its declared sources are exactly the machine's in-arrows to SKIPPED, so its only residual state is the self-edge — and its own prunability precheck refuses a terminal step first. | The guard is *masked*, not unguarded: the same inputs are refused, under a different code. WP-16 promotes this from a prose disclosure to a **declared MASKED cell** in the arrow census, held in both directions — if the evaluation order ever moves, the cell goes RED and someone has to look. |
| R-7 | **WP-15's affordance gate fails OPEN on an absent `pwuWorkLifecycleState`.** The field is optional; absent means ungated. | A caller that cannot supply the PWU's state gets pre-WP-15 behaviour rather than a silently emptied action column. The engine still refuses, so the cost is a rejected click, never an illegal act. It has its own test. |
| R-8 | **Two enforcement probes seed their PWU arrangement rather than driving it.** RPH-PWU-010's BASELINED (and RPH-PWU-009's SUPERSEDED) states are set through a named fixture seam. | BASELINED has two in-arrows (SATISFIED, RECOMPOSED — `READY → BASELINED` is explicitly ILLEGAL), so arranging it through the bus means driving the whole assurance chain, which can fail for eight reasons unrelated to the rule — each presenting as *"RPH-PWU-010 is not enforced"*. **The arrangement is seeded; the refusal is driven**, and the refusal is the half the gate is about. |
| R-9 | **The conformance ledger's honest limit.** A deliberate widening edited consistently across production, the register and the probe map **passes**. | Intended. It converts a silent one-character mutation into a three-file, justification-bearing, reviewable change. What it cannot do is let an *omission* through in silence. |

## 5. New findings raised BY this programme (open, not fixed)

WP-16's gate found these on its first run. They are the F-28 shape — *a ratified rule, correctly implemented as a
pure predicate, asked by nothing, and certified COVERED* — three more times, in the same family. Each is a
**checked** row (`UNENFORCED_DISCLOSED`) in `packages/rph-domain/src/enforcement-register.ts`: the gate greps the
tree and asserts the predicate's production reference set, so wiring any of them turns the build RED and forces
the row to be re-dispositioned as ENFORCED with a probe.

| # | Rule | Statement | Dead predicate | Note |
|---|---|---|---|---|
| N-1 | **RPH-EXE-003** | "Starting execution with a runtime binding still in REQUESTED is rejected." | `bindingPermitsExecution` | `StartExecutionStep` never resolves the step's `runtimeBindingId` to a RUNTIME_BINDING object at all. A step can start against a REQUESTED, DENIED or REVOKED binding. **Buildable today** — WP-14 persisted `authorizedRuntimeBindingIds` on the plan, which is where the check would read from. |
| N-2 | **RPH-EXE-004** | "Requested capability is not granted capability." | `capabilityAuthorized` | The purest instance: **no reference anywhere** outside its definition and its own unit test, not even an intra-kernel caller. Enforcing it needs a runtime capability plane (a binding's granted set consulted at the point of an operation) that this engine does not have. **Not buildable today**; recorded as such rather than as a task. |
| N-3 | **RPH-EXE-005** | "Starting a step whose required input artifact is absent leaves the step not ready." | `stepMayBecomeReady` | Reachable only through `canStartStep`, itself uncalled. Also unenforceable as the machine stands: NOT_READY and READY are the command-unreachable population disclosed under F-27, so there is no `NOT_READY → READY` transition for a precondition gate to guard. **Two facts, recorded as one**: the predicate is dead AND the transition it would guard is unreachable. |

**Consequence already applied:** the M12 conformance manifest's `RPH-EXE` family row was downgraded from
`COVERED` ("001..009 by id") to `PARTIAL`. That claim was true of the **predicates** and false of the **engine**.

## 6. Deferred, with reasons

- **Extend the enforcement register beyond the execution surface** — the Intent lifecycle (RPH-INT-003/007) and
  the PWU shape/baseline rules (RPH-PWU-004/008) are layer-3 command refusals owned by other command surfaces.
  The register's three-way disposition generalises to them unchanged; only the probes are missing.
- **A step-level supersede command.** The machine's `* → SUPERSEDED` step arrows
  (`transitions.data.ts:1479-1483`) have **no command at all**. Named in F-26's rider and still open.
- **Timer/condition WAIT auto-resolve**, **assumption-liveness in the condition subject**, **explicit k-of-n
  joins**, **§10.2 step-level `Condition[]`**, **post-proposal transition editing** — DS-004 §5's original
  deferral list, unchanged by this programme.

## 7. Record corrections made by WP-17

| Record | Was | Now |
|---|---|---|
| `JAN-EXECPLAN-DS-004 §5` | "NEUTRALIZED = … a source that reached **SKIPPED** or a terminal-non-success state"; "PENDING = the source is not yet terminal" | The shipped **four-valued** rule. A LIVE SKIPPED source SATISFIES (a waived skip advances the plan); FAILED is **PENDING** (the machine can leave it); UNRESOLVED is the honest fourth. **F-38** |
| `JAN-EXECPLAN-DS-004 §6 D7` | "correctly neutralizes pruned/branch/**non-success** in-edges" | "pruned/branch-excluded/**irrecoverable**" — a FAILED in-edge deliberately *does* wedge its join until the arm is explicitly abandoned. |
| `JAN-EXECPLAN-DS-004 §6 D6` and `DR-004` DWP-04 (×4 places) | "**Both** plan-ACTIVE-guarded" | Enter is `CLEANUP_EXEMPT`; Resolve requires an ACTIVE plan. Code unchanged — the code was right. **F-42** |
| `JAN-EXECPLAN-DR-004 §3` | "plan-ACTIVE prechecks on start/skip/retry/**wait** hold" | The authority is `STEP_COMMAND_SPECS.planLiveness`, declaring all nine commands with a rationale each. A prose list can drift from the code; a table the engine reads cannot. |
| `JAN-EXECPLAN-DR-004 §15` | "Divergences from DS-004: **none intended**" | The two that shipped, named, plus a pointer here. |
| `JAN-EXECPLAN-DR-004` — six `delivery_state:` fields, §1 Status, §19 | `NOT_STARTED` / "Nothing built" | `DELIVERED`. The 2026-07-24 correction left them false "as evidence of the drift", which meant the document carried six machine-readable fields contradicting the paragraph above them. **Two records disagreeing is the shape this remediation is about**; the drift is preserved in prose, and the field stops lying. `DELIVERED` means *built and committed* — not sound. |
| `docs/_working/dead-kernel-census.txt`, `…/W1/evidence/hollow-kernel-triage.md` | `canResumeExecutionOnPwu` DEAD / deferred to W2 | WIRED by WP-12b. These were the last two records still saying the rule was deferred **while the conformance manifest certified it COVERED** — three artefacts disagreeing about one rule. |

## 8. What is now machine-checked rather than written down

The point of WP-16, restated as a list, because a register whose entries are all prose has the same failure mode
as the one it replaces:

- Every `RPH-EXE-*` rule has a disposition, or the build fails (totality over the ratified catalog).
- Every ENFORCED rule is **observed refusing through `Engine.dispatch`**, with a distinct ≥20-character marker,
  and every probe carries a **control** — the same command accepted before the arranging act.
- Every ENFORCED rule's coverage citation must be at the **COMMAND layer**; every UNENFORCED one may not be
  certified COVERED anywhere.
- Every unenforced disclosure's dead predicate has its production reference set asserted against the tree.
- Every step command has a census cell for **every** residual source state and an accepted case for **every**
  declared one — so widening a source set loses a cell and narrowing one fails a positive.
- Every `ExecutionStep*` event has a declared attempt-fold effect (WP-13).
- Every step command declares `planLiveness`, `pwuOpenness` and `branchDecision` **with a rationale**, and both
  the engine and the read-model derive from that one declaration.
- The gate's own analysis primitives are selftested against literal synthetic input and required to **report
  failure**.

---

*JAN-EXECREM WP-0 … WP-17 delivered. Series gate `G-EXECREM-001` green: check-types · vitest · lint 0 ·
boundary 0 · svelte-check 0 · Playwright · `rph-engine` 69 (reference seed unchanged) · the registry-totality
gates · every new or repaired guard live mutation-red-proofed.*

***One exit criterion is UNMET: the post-build adversarial verification of this programme itself (§0). Delivered
is not the same as verified, and the difference is exactly what produced the 46 findings this programme fixed.***
