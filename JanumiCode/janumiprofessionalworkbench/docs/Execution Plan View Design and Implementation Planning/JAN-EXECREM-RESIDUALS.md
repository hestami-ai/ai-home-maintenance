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

**EXECUTED 2026-07-25 — and it did NOT discharge the exit criteria.** 80 agents, 36 candidates, 24 confirmed (19 distinct: 1 BLOCKER, 10 MAJOR, 8 MINOR), 12 refuted. The BLOCKER and a shipped regression were both introduced the SAME DAY, by the work package closing this lineage's last open finding. Remediation: `JAN-REVREM-DS-001` / `-DR-001`. The section below is kept as written, because its argument was right.

**Was: owed, not done.** `JAN-EXECREM-DS-001 §4` rules that fixing defects without fixing *how they got in* schedules
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

## 0b. RECORD CORRECTIONS forced by the post-build review (2026-07-25)

The review ran (80 agents; 19 distinct confirmed defects) and **four claims in this document and in the code's
own test files were FALSE.** Each is corrected below rather than quietly edited, because a register that
silently self-heals teaches nothing — and because every one of them was false in the *reassuring* direction.

| # | The claim | The truth | Where |
|---|---|---|---|
| **C-1** | §2 recorded the closed-PWU rule as *"derived rather than hardcoded"* | True of the AUTHORITY, **false of the read-model**, which held a hand-copied `new Set(['BASELINED','ABANDONED','SUPERSEDED'])` under a comment calling it "the machine's own terminal set". **Now genuinely derived** (`JAN-REVREM` RW-1, `90d0eddd`) and pinned by a test that asserts EQUALITY with the machine instead of retyping the literals. | `execution-view.ts` |
| **C-2** | §1 A-3 recorded prune provenance **CLOSED** | **NOT closed.** `pruneProvenance` bails on non-BRANCH sources, so a prune below a CANCELLED step still emits `{stepId, stepState:'SKIPPED'}` — content-identical to a waived skip, which is the sole justification DR-004 §19-M1 gave for minting a separate event. A-3 is re-opened as **N-8**. | `transition-gate.ts:658` |
| **C-3** | `execrem-wp1-dormancy.test.ts` declared three fields DORMANT with an advertised "tripwire" | All three had producers since WP-10/13/14, and **the tripwire never fired** because the fixture cannot reach any emitter (`transitions: []`, non-BRANCH steps, no `retryReason` passed). A negative claim over a fixture that cannot produce the thing is unfalsifiable by construction — the vacuous-negative shape, applied to this programme's own scaffolding. Replaced by a POSITIVE census. | `execrem-wp1-dormancy.test.ts` |
| **C-4** | `exebind-wp1` P4 claimed to cover the fail-open allowlist limb | It activated **with** the allowlist and dispatched no Start; inverting the branch left 545/545 green. Moot as of RW-0 — the limb is withdrawn — but recorded because the test was wrong before it was moot. | `exebind-wp1-binding-authority.test.ts` |

### The finding I refused — AND THE REFUSAL WAS WRONG (corrected by RW-4, 2026-07-25)

**Review finding #7** said `startableStepIds` lacks a graph-incoherence floor *and therefore* offers a Start the
engine refuses. RW-2 accepted the first half and **refused the second**, writing: *"no floor was added, and that
is the disciplined answer rather than the lazy one … a guard whose inputs cannot disagree … There is no gap."*

**There is a gap.** The second adversarial review found it, and I reproduced it:

```
steps [s1 QUEUED, s2 CANCELLED]; edges [(→s1), (s2→s1), (s1→s2)]
entryStepIds = []          (incoherent)
startableStepIds = ['s1']  (the read-model offers Start)
startStepGate(s1).ok = false  (the engine refuses)
```

**The error was one word.** RW-2 wrote that the escape "requires a step whose ONLY in-edges are source-less,
[and] `entryStepIds` counts such a step as an ENTRY". It does not. It requires **one source-less in-edge and no
PENDING real-source in-edge** — and a real-source edge off a CANCELLED or SUPERSEDED step is
`IRRECOVERABLE_TERMINAL` ⇒ **NEUTRALIZED**, which is not PENDING and does not block the barrier.
`localEdgeDisposition` returns SATISFIED for a source-less edge unconditionally; it never consults liveness.

**And the pin test was written so it could not notice.** All four of its original fixtures gave `s1` a PENDING
in-edge, so `!anyPending` failed for a reason unrelated to incoherence. Four probes were run before the refusal
and **every one used a QUEUED source.** A negative asserted over fixtures that cannot produce the thing is
unfalsifiable by construction — which is the *exact defect RW-2 corrected in the dormancy register, in the same
work package, about ninety minutes earlier*.

**Disposition: the floor is added** (`transition-gate.ts`, RW-4) and proved live — removing it turns four named
cases RED. The pin now carries the CANCELLED and SUPERSEDED shapes plus a case asserting that at least one
fixture can expose the gap, so the array cannot be quietly narrowed back into agreement with itself.

**The lesson, kept rather than tidied away:** *"I could not construct a counterexample" is a claim about my
search, not about the world* — see the same failure at N-2/N-3 — **and a test written to confirm that claim
will confirm it.** Refusing a finding is a real option and RW-2 was right to treat it as one; the discipline it
skipped was writing the fixture that would have proved itself wrong.

## 1. Authored contract additions (`UNRATIFIED-AUTHORED`)

Each is a shape the corpus does not ratify, landed because a ratified RULE was unenforceable without it. All are
**optional** on the wire, so no stored history becomes invalid.

| # | Shape | Why it had to be authored | WP |
|---|---|---|---|
| A-1 | `NoOutputResult {reason, detail}` + `CompleteExecutionStep.noOutputResult` | RPH-EXE-006 requires outputs **or** an explicit no-output result — and the explicit case had **no wire representation**, so the handler derived it as `!hasOutput` and the guard evaluated `b \|\| !b`. **A guard cannot be non-vacuous while one of its inputs is unrepresentable.** `detail` is required because a bare boolean records the claim without its justification. | WP-1, WP-11 |
| A-2 | `ExecutionStepSucceeded.selectedTransitionId`, `ExecutionStepSkipped.selectedTransitionId` | A BRANCH's chosen arm was held only in aggregate state; the event stream could not reconstruct it, so a replay could reach a different arm than the run did. | WP-1, WP-10 |
| A-3 | ~~CLOSED~~ **RE-OPENED as N-8 (see §0b C-2)** — `ExecutionStepPruned.excludedEdgeId` (with `selectedByBranchStepId` / `selectedEdgeId` moved from **caller-asserted** to **gate-derived**) | The pruned event's payload was `{stepId, stepState:'SKIPPED'}` — indistinguishable in content from a *waived* skip, which is the exact conflation the separate event type was minted to prevent. | WP-1, WP-14 |
| A-4 | `EXECUTION_PLAN.authorizedRuntimeBindingIds` | `ActivateExecutionPlan` carried the ids in its payload and **no ratified object field held them**, so any rule citing "the authorized bindings" was dead on arrival. | WP-14 |
| A-5 | `ExecutionSkipAuthorization` (a DECISION of type REPLAN\|WAIVER, plan-scoped subject + explicit step list) | §21.1's "an authorized plan revision or waiver" was satisfied by `!!p.waiverOrRevisionId` — **any non-empty string**. Reusing the assurance plane's `WaiverDetail` would let a FLOOR waiver authorize an EXECUTION act: an INV-5 boundary crossing. | WP-12c |
| A-6 | `ExecutionStepRetried.retryReason` | Optional; a retry recorded no reason at all. | WP-1 |

| A-7 | `PruneCause` enum + `ExecutionStepPruned.{cause, deadPredecessorStepId, deadPredecessorStepState}` | A prune cut by an irrecoverably-terminal predecessor had NO vocabulary — provenance was branch-shaped, so the event carried none at all and was byte-identical in content to a waived skip (N-8). | RW-7 |

| A-8 | `CapabilityRequest.capability` | The type was `Source TBD`, so RPH-EXE-004 and §22.1's containment invariant had no comparable identity. | JAN-CAPBIND WP-0 |
| A-9 | `CapabilityGrant.capability` | Same; deliberately the same shape, because "requested is not granted" has no content unless the two are comparable. | JAN-CAPBIND WP-0 |
| A-10 | `InputBinding.{artifactId, required}` | RPH-EXE-005's *"required input artifact"* had no subject. Both optional on the wire; `required ?? true` fail-closed at the point of use. | JAN-CAPBIND WP-0 |

**A-8…A-10 were authored under an EXPLICIT sponsor grant** answering the N-5 escalation, and the premise was
verified three ways first (above). **There are no invented fields**: every one traces to a ratified sentence or to
existing data, and every candidate that did not — a `kind` enum, `scope`, `justification`, `grantedBy`, `expiresAt`,
a `name` label — was refused with its reason recorded in the vocab note. The `kind` enum was the tempting one; it
would have forbidden capabilities the corpus never enumerated while adding nothing, because §22.1's secret-vs-tool
invariant is satisfied **structurally** by the containment rule.

**A-7 is an extension of an entry that was itself authored, which is why it needed no escalation.**
`ExecutionStepPruned`'s own `sourceSection` reads `UNRATIFIED-AUTHORED (2026-07-22, JAN-EXECPLAN-DR-004 DWP-03)`, so
its payload is this lineage's to widen — unlike N-5, escalated precisely because authoring those shapes would invent
semantics the corpus withholds. The distinction was checked in the vocab before the field was added, not assumed
from the fact that it was convenient.

**`cause` is OPTIONAL, and the first ruling had it REQUIRED.** DS-001 §6c R11 reasoned that provenance is derived
rather than caller-asserted, so no producer could break — considering producers and forgetting **replay.** Every
`ExecutionStepPruned` already written carries no `cause`, so a required field makes the schema unable to describe
events this system itself wrote. This section's own invariant says so (`OPTIONAL … no existing caller or **stored
event** becomes invalid`) and `execrem-wp1-fields.test.ts` went red on the first run. The guarantee lives at the
producer instead, asserted for both causes at the engine layer and proved by mutant `P1`.

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
| N-1 | **RPH-EXE-003** | "Starting execution with a runtime binding still in REQUESTED is rejected." | ~~`bindingPermitsExecution`~~ | **CLOSED 2026-07-25 by `JAN-EXEBIND` WP-B1, re-sited and corrected by `JAN-REVREM` RW-0/RW-3/RW-5.** `StartExecutionStep` resolved no binding at all, so a step started freely against a REQUESTED, DENIED or REVOKED one. Now `ENFORCED` via the `bindingAuthority` COLUMN on `STEP_COMMAND_SPECS`, evaluated once in `stepAuthorityRefusal` for **both** commands that drive a step into RUNNING, and observed through `Engine.dispatch`. It also enforces SCOPE: a binding authorizes the step its ratified `executionStepId` NAMES and no other (RW-3). ~~with §15.3's `authorizedRuntimeBindingIds` wired as a separate limb~~ — **that limb was WITHDRAWN** (RW-0); see N-9. ~~7 declared mutants, all RED~~ — that count referred to WP-B1's battery, two of whose mutants no longer apply; the current ledger is in `enforcement-register.ts`'s `declaredMutations`. |
| N-2 | **RPH-EXE-004** | "Requested capability is not granted capability." | `capabilityAuthorized` | The purest instance of a dead predicate: **no reference anywhere** outside its definition and its own unit test, not even an intra-kernel caller. Blocked on **N-5** — the corpus does not define what a capability IS. ~~*"Enforcing it needs a runtime capability plane … that this engine does not have."*~~ **That reason was WRONG — see the correction below.** |
| N-3 | **RPH-EXE-005** | "Starting a step whose required input artifact is absent leaves the step not ready." | `stepMayBecomeReady` | Blocked on **N-5**: `InputBindingSchema` is `z.record(z.string(), z.unknown())`, so *"the required input artifact"* has nothing to quantify over. The predicate being reachable only through the uncalled `canStartStep`, and `NOT_READY`/`READY` being command-unreachable (F-27), are both true and both **secondary** — the subject gap survives fixing either. |
| **N-4** | *(no rule id — see note)* | An `AuthorizeRuntimeBinding` may grant a capability the binding **never requested**. | — | **NEW, raised 2026-07-25 (JAN-EXEBIND-DS-001 §3.3).** `authorizeRuntimeBinding`'s `mutate` writes `grantedCapabilities` from the payload **wholesale, unchecked against `requestedCapabilities`**. Its own comment names the hazard and then guards only the RE-authorization case via `fromStates`; the **first** authorization is unconstrained. The ratified machine's guard on `REQUESTED → AUTHORIZED` reads *"requested capability is NOT granted capability; capability scope must be explicit (§22.1)"* — **enforced nowhere.** Deliberately **not** filed under RPH-EXE-004, whose statement is about *operations*: accepting evidence for one rule as evidence for another is the substitution this programme exists to stop. Blocked on N-5. |
| **N-9** | *(open, by withdrawal)* | `EXECUTION_PLAN.authorizedRuntimeBindingIds` is persisted and read by NOTHING. | — | **RECORDED 2026-07-25 by JAN-REVREM RW-5, and it should have been written by RW-0.** RW-0 withdrew the §15.3 allowlist limb (an unrecoverable wedge whose refusal prescribed a remedy the engine forbids) and its design said the field "returns to what WP-14 left: persisted, read by nothing. **That is recorded as an open item, not as closed.**" **No such record was written for three commits** — the second adversarial review found it, making this the FIFTH false record in this lineage and the first one produced by a work package whose *subject* was correct. The field remains ratified (§15.3) and unread; making it load-bearing needs a way for a sponsor to supply a meaningful list, which no UI, API or command provides. **STILL OPEN after JAN-REVREM RW-6, and deliberately not claimed as closed** — RW-6 reads the BINDING's own ratified `authorizationStatus` and `executionStepId`, never the plan's allowlist, so the field is exactly as unread as before. What RW-6 does change is the ARGUMENT: the authority question the allowlist was meant to answer is now answered from the binding itself at BOTH layers, so a future wiring of this field would be not merely vacuous-or-wedging (RW-0's dichotomy) but also **redundant**. That weakens the case for ever wiring it; it does not close the finding, and recording a weakened case as a closure is the move this register exists to prevent. |
| **N-8** | *(re-opened)* | Prune provenance is **not** closed for the irrecoverable-terminal cut. | — | **A-3 was recorded CLOSED and is not** (review finding #8). `pruneProvenance` (`transition-gate.ts:658`) bails on non-BRANCH sources, so pruning a step below a CANCELLED predecessor emits `{stepId, stepState:'SKIPPED'}` — byte-identical in content to a waived skip, which is precisely the conflation DR-004 §19-M1 minted `ExecutionStepPruned` to prevent. The header claim that the non-BRANCH cut is "unreachable through an authorable plan" is contradicted by a fixture in the same package (`transition-gate-disposition.test.ts:67-82`). ~~Open; the fix needs a ruling on what a non-branch cut should record, which is design work, not a patch.~~ **CLOSED 2026-07-26 by `JAN-REVREM` RW-7** (design ruling `JAN-REVREM-DS-001 §6c`, R10–R12). Reproduced live first, because this entry's own note recorded the reachability claim as contested: `pruneProvenance` returned `undefined` for `s1 → s2(CANCELLED) → s3` while `prunableStepIds` offered the prune. **The defect was the TYPE, not the walk** — `PruneProvenance` was branch-shaped, so the walk was correctly declining to fabricate a `branchStepId` and then had nothing it was permitted to say. It is now cause-discriminated (`BRANCH_DECISION` \| `DEAD_PREDECESSOR`), the latter carrying `deadStepId` + `deadStepState`; `ExecutionStepPruned` gains `cause`, `deadPredecessorStepId`, `deadPredecessorStepState` as an authored extension (§1 below). Reusing `branchStepId` for a non-branch predecessor was rejected — a field named for a branch holding a step that is not one makes the audit trail lie. Proved by 11 named tests plus an engine-layer payload test, and by mutants `P1` (KILLED), `P2` (KILLED, the order proof) and `P3` (a declared CONTROL over a provably unreachable fail-safe). **Two of my own errors on the way, both recorded rather than smoothed:** I declared `cause` REQUIRED, forgetting that every already-written event carries none (WP-1's stored-event invariant caught it); and I deleted the arm's `IRRECOVERABLE_TERMINAL` check as a "duplicated derivation" when a guard-false conditional edge off a non-BRANCH source is also NEUTRALIZED (the WP-14 suite caught it). |
| **N-7** | *(review blindness)* | A **one-arrow** semantic change shipped inside a **4,144-line** diff. | — | **NEW, raised 2026-07-25 while trying to run this programme's own review.** WP-5 (`868f595e`) added exactly one machine arrow (`FAILED → CANCELLED`) to `packages/rph-domain/vocab/m2-transitions.json`, and the committed diff is 4,144 lines because the file's indentation changed wholesale in the same commit. `git diff -w` on it is **81 insertions / 15 deletions**. The cause is not established — the repo's `format` script covers only `**/*.ts`, so it was not `bun run format` — but the effect is the finding: **a semantic edit buried in 4,000 lines of whitespace is how a change rides in unreviewed**, and this one file is 19% of the diff that made `/code-review ultra` refuse the branch as too large (97 files, 22,586 lines vs an 8,000-line limit). Not reverted: restoring the old indentation would only re-churn on the next write. Mitigation is procedural — reformat generated/vocab artifacts in their OWN commit, never alongside a semantic change, and read them with `git diff -w`. |
| **N-6** | *(dead arrow)* | `RuntimeBinding.authorizationStatus` ratifies `REQUESTED → PARTIALLY_AUTHORIZED`; **no command drives it.** | — | **NEW, raised 2026-07-25 (JAN-EXEBIND WP-B1).** `registry.ts` wires Request / Authorize / Deny / Revoke and nothing else, so a ratified state exists that no command can produce. It matters because `bindingPermitsExecution` **permits** execution on a PARTIALLY_AUTHORIZED binding — RPH-EXE-003 therefore has an *acceptance* limb the bus cannot reach, and without a fixture seam it would go untested while looking covered. Same shape as the `* → SUPERSEDED` step arrows F-26's rider named. Recorded; not this work package's to fix. |
| **N-5** | *(corpus gap)* | Four ratified helper sub-types are **`Source TBD`**. | — | **NEW, and the root cause of N-2, N-3 and N-4.** `InputBinding`, `OutputBinding`, `CapabilityRequest` and `CapabilityGrant` are each declared in `m1-object-fields.json` with `"field": "(undefined)", "type": "—", "note": "… NOT field-defined. Source TBD."`, so `gen-objects.ts` emits `z.record(z.string(), z.unknown())`. Every one is referenced by a ratified rule. The tell nobody noticed: `capabilityAuthorized` takes `string[]` while the contract holds `Record<string,unknown>[]` — **the predicate and the contract it guards do not typecheck against each other.** ESCALATED as a corpus gap; authoring the shapes would invent normative semantics the corpus withholds (JAN-EXEBIND-DS-001 §4-R3). |

### JAN-CAPBIND, 2026-07-26 — N-5 answered, and with it N-3 and N-4

The sponsor authorized authoring the four `Source TBD` sub-types, so `escalate it` stopped being an available
answer. Design: `JAN-CAPBIND-DS-001`. Work packages WP-0…WP-3.

**The premise was verified before anything was authored**, because this repo has a documented instance of the
opposite error — `m1-object-fields.json` records `ApplicabilityRule` as *"RATIFIED AFTER ALL"*, its note having said
`NOT field-defined … Source TBD` **while citing the section that defines its nine fields**. My four notes were
citation-bearing in exactly the same way. Three independent checks confirmed the gap real: the 2026-07-16
placeholder audit (full 14-file corpus, adversarial refutation, hand re-verification) lists all four as genuinely
undefined; `§31` is a **bare list of table names** with no columns; `§21`'s `ExecutionStep` declares
`inputBindings: InputBinding[]` — a **usage**, the category that audit explicitly disqualified.

| # | Was | Now |
|---|---|---|
| **N-5** | four sub-types `Source TBD`, three rules with nothing to quantify over | **CLOSED.** `CapabilityRequest`/`CapabilityGrant`/`InputBinding` authored (A-8…A-10); `OutputBinding` and `SandboxPolicy` **dispositioned** rather than authored. |
| **N-4** | `AuthorizeRuntimeBinding` wrote `grantedCapabilities` wholesale, unchecked | **CLOSED (WP-2).** `grantedWithinRequest` at `advanceStatus`'s `guard` slot. 9 kill tests; mutants `C1`/`C2`/`C3` KILLED. |
| **N-3** | RPH-EXE-005 unenforceable — `InputBinding` had no shape | **CLOSED (WP-3).** A fourth declared column, `inputReadiness`, total over the nine step commands; `inputReadinessRefusal` as the fourth limb of `stepAuthorityRefusal`. 10 kill tests; `C4`/`C5`/`C6`/`C7` KILLED. |
| **N-2** | RPH-EXE-004 unenforced, `capabilityAuthorized` dead | **PARTIAL, and stated as such.** Its *decidable core* — a grant may not exceed its request — is now enforced by N-4's fix. Its **operation-level** half ("network operations fail authorization") remains outside an engine that governs plans rather than hosting invocations, and `capabilityAuthorized` still has no production caller **by design**: it answers a different question (single-operation containment), and wiring it merely to clear the census would be the substitution this register exists to prevent. |
| **N-6** | `PARTIALLY_AUTHORIZED` unreachable | **RE-CLASSIFIED as a PRECONDITION on N-2**, not an adjacent finding. `m2-transitions.json` declares `REQUESTED → PARTIALLY_AUTHORIZED` with its own trigger *"partial grant"*, and `advanceStatus` takes a single `target` — so deriving the status inside `AuthorizeRuntimeBinding` would make one command drive two ratified arrows the machine says are distinct. Needs a real `PartiallyAuthorizeRuntimeBinding` command; scheduled, not absorbed. |

**§22.1's *"Capability scope must be explicit"* is resolved as POLICY-BY-REFERENCE, and no `scope` field was minted.**
The first design derived one and called it forced; that was **over-authoring**, and the adversarial pass caught it.
The sentence admits two readings — a distinct `scope` field, or an identity named precisely enough to be explicit —
and the existing data votes for the second (`fs.read`, `shell.exec` are already scoped identities). Minting the
field would have picked a side *and* imposed a command-boundary obligation on every caller.

The resolution came from the corpus's own shape plus the platform's: three of `RuntimeBinding`'s policy fields are
already **ids** (`contextAssemblyPolicyId`, `observabilityPolicyId`, `memoryPolicyId`), and the JanumiCode platform
has ruled that every principal *including agents* resolves to a Cerbos principal → policy decision → audit event,
behind an abstracted runtime boundary that exists so the concrete sandbox tool stays swappable. So the runtime bound
belongs to the policy plane, and `SandboxPolicy` is re-dispositioned from `Source TBD` to **deferred to it**.

> **DISCLOSED COST, so it is not discovered later:** path- or host-limited grants — *"file-system, but only under
> `/tmp`"* — are **inexpressible**, not merely unenforced. Minting `scope` requires choosing a value domain the
> corpus does not give, and a string landed today would have to be **replaced** rather than extended if a structured
> shape were later ratified, with anything written meanwhile unmigratable.

**New findings raised by this series:**

| # | Severity | Statement |
|---|---|---|
| **N-10** | MINOR | **Two capability vocabularies in one repo.** Fixtures carry both `file-system`/`network` (verbatim from RPH-EXE-004's ratified statement) and `fs.read`/`shell.exec` (a dotted convention from nowhere). Tidiness while nothing consumed capabilities; a real problem once a broker must map them — and the dotted form encodes a **verb granularity the target platform cannot enforce**. Recommended ruling: the corpus's nouns. |
| **N-14** | MINOR | `json-schema.test.ts` reads **exactly one** committed artifact (`ObjectEnvelope.json`) while its header claims *"the committed `schemas/` artifacts must not have drifted"*. A missed regeneration of any other artifact is invisible to it. |
| **N-15** | MINOR | **The generator emitted full helpers in ALPHABETICAL order.** A helper referencing another that sorts later produced a TDZ `ReferenceError` at import — the whole module failing to load. Latent and invisible because every referent had been a placeholder (emitted first as a block); the moment `InputBinding` became real, `ExecutionStep` sorted before it. **Fixed in WP-0** by topological ordering; recorded because it would have hit any future authoring of a placeholder. |

### Re-derived 2026-07-26 by a fresh review — and these are NOT "the lost 8 MINORs"

Ruling R13 refused to reconstruct the 8 MINOR findings from their ordinals and required a fresh review instead. That
review ran: 7 lenses, every candidate attacked by **two independent refuters both defaulting to REFUTED**, a finding
admitted only on a unanimous survival, then a completeness critic. **Three survived.**

**They are not the lost eight, and must never be recorded as though they were.** The lost eight were findings about
an *earlier* state of this code, most of which has since been rewritten by RW-0…RW-7; whatever they said is gone.
These three are what a fresh review of the CURRENT surface finds. Retiring the ordinals against these would be the
substitution R13 forbids — so **the ordinals stay open and unrecoverable**, and these get their own numbers.

Note what they are: **two of the three are defects in the remediation work itself**, and the third is a false record
created by it. A fresh review of a lineage that has just been heavily reworked finds the rework.

| # | Severity | Statement |
|---|---|---|
| **N-11** | **MAJOR** | **`validateProposedPlan` never checks that a step's `runtimeBindingId` resolves to a binding scoped to THAT step, and no command can rewrite it afterwards — so RW-3's SCOPE limb refuses Start on such a step permanently, and its refusal's remedy is INERT.** `plan-proposal.ts:78-102` checks a step's id, `executionPlanId`, `stepState` and `selectedTransitionId`; `PlanProposalStep` does not even declare `runtimeBindingId`. Two steps may therefore name one binding and the plan ACTIVATES. Start on the second is then refused forever by the RW-3 limb, whose message says *"Request a binding for this step"* — an act that mints a new binding **no step names**, because `ProposeExecutionPlan` is the only writer of `steps[]` (`advanceStep` rewrites only `stepState`/`selectedTransitionId`) and `executionStepId` is written once at `runtime-binding.ts:21`. **This is the near-wedge class RW-0 withdrew the §15.3 allowlist limb for, reintroduced by RW-3 on a different axis** — and `plan-proposal.ts:88-95` already refuses an authored NOT_READY step with the *verbatim* rationale ("can never start … permanently blocks plan completion") that applies here. **Refuter correction, and it matters:** it is *not* a dead aggregate. A REPLAN Decision driven to EFFECTIVE authorizes `SkipExecutionStep` (§21.1), `SKIPPED` is terminal-success, and `Fail`/`Supersede` remain — so the cost is a plan that can only be abandoned or skipped past, plus the loss of the already-executed step's credit. That correction is why this is MAJOR and not a BLOCKER. **Fix belongs in `validateProposedPlan`** (refuse at propose, where it is repairable) rather than in the refusal message. |
| **N-12** | **MAJOR** | **F-29's FOURTH instance: the read-model does not mirror the RPH-EXE-008 retry cap.** `planPermitsAffordance` gates on exactly three authority columns; the retry cap is a **fourth, purely state-derived** command-layer refusal the projection cannot see, because `ExecutionPlanInput` carries neither `retryPolicy` nor an attempt count. So `retry` is offered on every FAILED step under an ACTIVE plan and open PWU — including one already at the cap — and the click is refused. **The demo's loader already computes `attemptsByStepId` from the same event stream on the same request** (`+page.server.ts:336`) and never passes it. Sharpens the DS §6b table from three instances of "an authority limb was added to the engine and the read-model was not told" to four, and shows the mechanism is **not** confined to the spec-table columns R7 gates on: a refusal derived from event history is invisible to a column-driven filter by construction. |
| **N-13** | MINOR | **FALSE RECORD inside one object literal.** `conformance-manifest.ts:94-99`'s RPH-EXE family comment still lists **EXE-003** among rules *"implemented as correct, unit-tested kernel functions with NO production caller"* that are *"disclosed in `enforcement-register.ts` with a checked call-site census"* — while the same file's row at `:51` certifies EXE-003 at the COMMAND layer, the same file's note at `:101` says the opposite of its own comment, and `ENFORCEMENT_REGISTER['RPH-EXE-003'].kind === 'ENFORCED'` with **no `referencedOnlyBy` census at all** (that field exists only on `UnenforcedRule`). Stale since JAN-EXEBIND wired the rule. **No gate can catch it:** `enforcement-register.test.ts` reads `coverageFor(id).status` and `.testFile`, never the prose. §7 below already had to correct three artefacts disagreeing about RPH-PWU-010 in exactly this way — so this is that shape recurring in the artefact whose over-claiming started the family. |

> **CORRECTION (2026-07-25) — two entries in this section were WRONG, and wrong in the reassuring direction.**
>
> N-2 said enforcing RPH-EXE-004 *"needs a runtime capability plane … that this engine does not have."* **The
> plane exists.** `RUNTIME_BINDING` is a first-class aggregate with an id prefix, a registry entry and a
> five-state ratified machine; `RequestRuntimeBinding` / `AuthorizeRuntimeBinding` / `DenyRuntimeBinding` /
> `RevokeRuntimeCapability` are all live; the object carries both `requestedCapabilities` and
> `grantedCapabilities`. N-3 named the unreachable transition as its blocker when the subject gap is the one that
> would survive fixing the machine.
>
> **Both are the same error, and it is the one this codebase has now made seven times: I searched, found nothing,
> and recorded the absence as a property of the world rather than of my search.** It is recorded rather than
> silently patched because a register whose entries are wrong in the *comfortable* direction is worse than no
> register — it converts an open hole into a closed one on paper, and the next reader has no reason to look again.
> Finding N-4 was sitting behind that wrong sentence the whole time.
>
> **What was right:** all three rules really are unenforced, and WP-16's gate really did catch them. The error was
> in the *reasons* — which is precisely the part a gate cannot check, and therefore the part that needs saying out
> loud.

**Consequence already applied:** the M12 conformance manifest's `RPH-EXE` family row was downgraded from
`COVERED` ("001..009 by id") to `PARTIAL`. That claim was true of the **predicates** and false of the **engine**.

**N-1 is being closed** by `JAN-EXEBIND-DS-001` / `JAN-EXEBIND-DR-001` (WP-B0…B3): everything RPH-EXE-003
quantifies over is ratified and typed, so the fix is a load and a call. N-2, N-3, N-4 stay open behind N-5.
**This register remains the authoritative index for all five** — one register, not two.

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
