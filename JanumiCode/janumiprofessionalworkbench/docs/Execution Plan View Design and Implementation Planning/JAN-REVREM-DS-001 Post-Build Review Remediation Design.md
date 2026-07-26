# JAN-REVREM-DS-001 — Post-Build Review Remediation: Design

*v0.1.0 · 2026-07-25 · Provenance: the **post-build adversarial verification of JAN-EXECREM (WP-0…17) and
JAN-EXEBIND (WP-B0…B3)** — 80 agents, 36 candidates, **24 confirmed / 19 distinct** (1 BLOCKER, 10 MAJOR,
8 MINOR), 12 refuted. Every finding survived two independent refuters that defaulted to REFUTED. Roadmap:
`JAN-REVREM-DR-001`.*

---

## 1. The verdict, stated plainly

**The review that JAN-EXECREM recorded as OWED has now been executed, and it did not discharge the exit
criteria.** It found a BLOCKER and a shipped regression, both introduced **the same day**, by the work package
that was supposed to be closing this lineage's last open finding.

**The through-line, and it is the same one as the original 46:** every one of the 19 defects is compatible with a
green suite. `check-types` 21/21, vitest 21/21, 545 application tests, `rph-engine` 69 unchanged, boundary 0,
Playwright 50 — all green, with a BLOCKER live in the code.

## 2. The BLOCKER, and why it is the worst possible instance

> `bindingAuthorityRefusal` has **one call site**. **Two arrows drive a step into RUNNING.**

`startExecutionStep` carries the guard; `resolveExecutionStepWait` (`execution.ts:1414`) passes **no precheck at
all**. Proved live through `Engine.dispatch`:

```
Start (binding AUTHORIZED, allowlisted)  -> ACCEPTED
EnterExecutionStepWait                   -> WAITING
RevokeRuntimeCapability                  -> binding REVOKED
ResolveExecutionStepWait                 -> ACCEPTED     <-- step is RUNNING against a REVOKED binding
```

**Revocation is unenforceable for any step that can be parked in WAITING.** The engine's own refusal message says
this state is impossible: *"a step may only execute against an AUTHORIZED or PARTIALLY_AUTHORIZED binding
(RPH-EXE-003 / §8.1)"*.

**THE ROOT CAUSE IS THE DEFECT FAMILY THIS ENTIRE LINEAGE EXISTS TO ELIMINATE.** JAN-EXECREM WP-8 built
`STEP_COMMAND_SPECS` because *"an omission is invisible in a list that does not exist"*; WP-12b moved
`planLiveness` and `pwuOpenness` into it as **columns**, evaluated once in `stepAuthorityRefusal`, precisely so
that no command could omit an authority. JAN-EXEBIND then added a third authority as **a hand-inlined precheck at
one call site** — the exact shape WP-8 replaced. The design document even specified it that way (*"sited inside
`startExecutionStep`'s existing precheck"*) and never asked which **other** commands target RUNNING.

A guard that must be remembered at each call site will be forgotten at one of them. That is not a lesson this
codebase needed to learn again.

## 3. The regression: an unrecoverable wedge whose remedy is forbidden

JAN-EXEBIND's §15.3 allowlist limb refuses a binding absent from `plan.authorizedRuntimeBindingIds`, and its
message instructs: *"Re-activate the plan naming this binding"*. `activateExecutionPlan` requires status
`APPROVED`; the plan is `ACTIVE`. **The prescribed remedy is categorically refused.** Proved live: Start →
`RPH_INVARIANT_VIOLATION`; re-activate → `RPH_ILLEGAL_STATE_TRANSITION … but it is ACTIVE`; Start → refused again.

And **both shipped activation sites hardcode `authorizedRuntimeBindingIds: []`** —
`packages/rph-engine/src/reference-undertaking.ts:563` and
`apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts:544`. So any step naming a binding is permanently
unstartable and its plan can never complete.

**RULING R2 — WITHDRAW THE LIMB.** Not repair it. The analysis that should have preceded it:

- If activation **derives** the list from the plan's own steps, the check always passes — vacuous.
- If a human supplies it, production supplies `[]` — everything with a binding bricks.
- There is no UI, API or command by which a sponsor could supply a meaningful list.

**The limb is inherently either vacuous or wedging, and there is no third state.** It was AUTHORED — §15.3
ratifies the *field*, not a refusal — so withdrawing it removes no ratified rule. `authorizedRuntimeBindingIds`
returns to what WP-14 left: persisted, read by nothing. **That is recorded as an open item, not as closed.** A
field written and never read is a real problem; a refusal that bricks the engine is a worse one, and shipping the
worse one to avoid admitting the first is how this family propagates.

## 4. What the review says about the RECORDS — the part that matters most

Four claims in JAN-EXECREM's own documents are **false**, and each is false in the reassuring direction:

| Record | Claims | Actually |
|---|---|---|
| `RESIDUALS.md` §2 | the closed-PWU set is *"derived rather than hardcoded"* | `execution-view.ts:217` hardcodes a **second copy**; nothing binds it to `terminalStates`; the only test retypes the same literal |
| `RESIDUALS.md` §1 A-3 | prune provenance **CLOSED** | `pruneProvenance` bails on non-BRANCH sources, so a prune below a CANCELLED step emits a payload **content-identical to a waived skip** — the sole justification DR-004 §19-M1 gave for minting the event |
| `execrem-wp1-dormancy.test.ts` | three fields DORMANT, with a *"deliberate tripwire"* | all three have producers since WP-10/13/14; the tripwire never fired because the fixture cannot reach any emitter |
| `exebind-wp1` P4 | covers the fail-open allowlist limb | it activates **with** the allowlist and **dispatches no Start**; inverting the branch leaves **545/545 green** |

**This is the seventh through tenth instance of one habit**, and it now has a name in this repo: recording the
absence of evidence as evidence of absence. Every one was written by the same author who wrote the code and chose
the tests. The gates cannot catch it — a register checks that a claim is *present*, never that it is *true*.

## 5. Rulings

- **R1 — Binding authority becomes a COLUMN**, `bindingAuthority`, on `STEP_COMMAND_SPECS`, evaluated in
  `stepAuthorityRefusal` beside `planLiveness` and `pwuOpenness`. Total over the nine commands, with a written
  rationale each, so adding a tenth command without declaring its binding disposition is a **compile error**.
  This closes the BLOCKER *and* the class, and it is the fix WP-8's own header prescribes.
- **R2 — Withdraw the §15.3 allowlist limb** (§3). Record the field's unread status honestly.
- **R3 — Derive `CLOSED_PWU_STATES` in the read-model** from the machine, as the authority does. The
  "one declaration" claim becomes true instead of asserted.
- **R4 — Prune joins the affordance filter.** `PruneExecutionStep` is absent from `COMMAND_BY_AFFORDANCE`, so the
  totality type could not see the omission — the same invisibility, one layer down. It gains a row.
- **R5 — Correct the four false records, and do not soften them.** Each keeps a struck-through statement of what
  it used to claim, per the standard set in WP-17.
- **R6 — Do NOT chase the MINORs in this series.** Eight are real and none is urgent; batching them behind the
  BLOCKER would delay the fix that matters. They land in RW-3 with the vacuous-test repairs.

## 6. Conflicts

- **C-1 — the enforcement register's `enforcedAt` for RPH-EXE-003 names a site that is about to move.** It must
  be updated in the same commit, or the register documents a call site that no longer exists.
- **C-2 — withdrawing the allowlist limb kills two tests** (`exebind` K5 and the "different plan" case) and the
  register's third `declaredMutation`. They are **deleted, not weakened** — the limb they prove is going away.
  The mutation ledger loses a row and gains the two-arrows mutant, which is a better trade than it sounds: the
  old row could not redden its own probe (MINOR #14).
- **C-3 — the read-model cannot see binding status.** `ExecutionStepInput` carries no `authorizationStatus`, so
  MAJOR #5 (the UI offering Start on a step the engine now refuses) is **not fully closable** without threading a
  fourth input through the projection. Scoped to RW-1 and disclosed if it does not land there.

## 6b. RW-6 — closing MAJOR #5, the finding C-3 disclosed rather than fixed

C-3 scoped MAJOR #5 as *"not fully closable without threading a fourth input through the projection"* and disclosed
it. This section rules on how, because the obvious threading would reintroduce the exact defect RW-0 and RW-1 both
existed to remove.

**The finding restated precisely.** `stepAuthorityRefusal` now consults **three** authority columns —
`planLiveness`, `pwuOpenness`, `bindingAuthority`. The read-model's `planPermitsAffordance` consults **two.** So the
UI offers **Start** (and **Resolve**) on a step whose runtime binding is `REQUESTED`, `DENIED`, `REVOKED`, or
authorized for a *different step*, and the engine refuses the click. This is F-29's invariant — *"no affordance the
engine would reject"* — broken in a new place **by its own remedy**, for the third time in this lineage:

| when | new engine authority | read-model counterpart | how it was found |
|---|---|---|---|
| WP-12b | RPH-PWU-010 (closed PWU) | added late, by WP-15 | F-29 review |
| RW-0 | `PruneExecutionStep` gating | absent — prune was not even in the affordance map | review #2 finding #4 |
| RW-0 | `bindingAuthority` column | **absent** | review #2 MAJOR #5 |

Three instances of one mechanism: **an authority limb is added to the engine and the read-model is not told.** The
fix therefore has to make the *next* limb impossible to forget, not just supply this one.

### Ruling R7 — the read-model gates on the COLUMN, never on a list of affordances

`planPermitsAffordance` already derives plan-status gating from `spec.planLiveness` and PWU gating from
`spec.pwuOpenness`. It gains a third limb reading `spec.bindingAuthority`, and it reads it **off the same
`STEP_COMMAND_SPECS` row the engine reads.** Nothing anywhere names `start` and `resolve` as "the two that need a
binding": the column already says so, totally, over all nine commands, with a compile error for a tenth. A future
command declaring `REQUIRES_AUTHORIZED_BINDING` is gated in the UI **on the day it is declared**, with no second
edit — which is the only version of this fix that stops the table above from gaining a fourth row.

### Ruling R8 — the four-check verdict moves to `rph-domain`, and both layers call it

The refusal lives in `rph-application/handlers/execution.ts` as `bindingAuthorityRefusal`, which needs `ctx.store`
and returns a `reject(...)`. The read-model can use neither. The tempting answer — re-derive the checks in the
projection — is refused: **its four-check ORDER is itself load-bearing** (scope before status, argued at length in
that function's header and pinned in both directions by S1 and K1–K3), and an order encoded in one place and
mirrored by hand in another is precisely the shape that produced the BLOCKER this series opened with. It is also
literally the `CLOSED_PWU_STATES` mistake R3 corrected: a second copy whose comment claims it is derived.

So the pure core becomes `bindingAuthorityVerdict(stepId, facts)` in `rph-domain`, over a **fact record** the caller
resolves:

```
BindingAuthorityFacts = {
  bindingId?: string            // absent or '' => OUT OF SCOPE, not unauthorized
  bindingResolves?: boolean      // did the id resolve to a RUNTIME_BINDING?
  boundStepId?: string           // the binding's own ratified executionStepId
  authorizationStatus?: string   // fed to the ratified kernel predicate
}
```

The handler resolves the facts from the store and renders the verdict as a `reject` with its established message and
marker; the read-model resolves them from its input and reads `verdict.ok`. **One declaration of the rule, two
consumers, and the order stated once.** The verdict carries a `limb` discriminator so each existing kill test can go
on asserting *which* check fired rather than merely that something did.

### Ruling R9 — absent facts fail OPEN, and that is disclosed, not hidden

Two distinct absences, and conflating them would break the reference seed:

- **No `bindingId`** — the step names no binding. The engine returns `null` here (out of scope: the rule's antecedent
  is *"with a runtime binding"*), and the reference seed authors no `RuntimeBinding` at all, so treating this as
  unauthorized would make **every existing plan unstartable.** Ledger mutant `B5` exists to prove exactly that, by
  asserting the reference seed breaks if the absent case is refused.
- **A `bindingId` the caller could not resolve into facts** — the projection was given no status. This fails **OPEN**,
  identically to `pwuWorkLifecycleState` and for the same stated reason: a caller who cannot supply it gets the
  pre-RW-6 behaviour rather than a silently emptied action column. The engine still refuses, so the cost is a
  rejected click, not an illegal act.

The distinction is in the type: `bindingResolves: false` is a *resolved negative fact* and gates; `bindingResolves`
absent is *no information* and does not. A single optional boolean could not express both, which is why the facts
record carries the id separately from the resolution.

### What RW-6 does NOT close

The read-model mirrors the engine; it is not a second authority. A caller that supplies facts inconsistent with the
store gets an affordance set that disagrees with the engine, and only the engine's answer is binding. That is the
same trust boundary every other input to this projection sits behind, and it is why the engine check is **not**
removed — this adds a filter, it does not relocate a guard.

## 6c. RW-7 — the N-8 ruling: what a NON-BRANCH cut records

N-8 was re-opened because A-3 was recorded CLOSED and is not. It was left needing *"a ruling on what a non-branch
cut should record, which is design work, not a patch."* This is that ruling.

**Reproduced live before ruling on it, because the register's own note says the reachability claim was contested:**

```
plan: s1 --t12--> s2(CANCELLED) --t23--> s3(QUEUED)
prunableStepIds(plan)  -> ['s3']          the gate offers the prune
pruneProvenance(s3)    -> undefined       and can say nothing about why
```

So `ExecutionStepPruned` for `s3` carries `{ stepId, stepState: 'SKIPPED' }` — **byte-identical in content to a
waived skip**, which is precisely the conflation DR-004 §19-M1 minted a distinct event to prevent (*"do not conflate
a system prune with a user waiver"*). The header claim that a non-BRANCH cut is "unreachable through an authorable
plan" is false: `CancelExecutionStep` is a live command and `transition-gate-disposition.test.ts:67-82` builds this
exact plan to assert the prune is offered. **The fixture proving reachability and the comment denying it are in the
same package.**

### The actual defect is the TYPE, not the walk

`PruneProvenance` is `{ branchStepId, selectedEdgeId?, excludedEdgeId? }` — **branch-shaped**. A non-branch cut has
no branch and no selected edge; it has a *predecessor that can never conduct*. `pruneProvenance` correctly declines
to fabricate a `branchStepId` for it, and then has nothing it is allowed to say. The walk is not wrong; the vocabulary
it must speak in cannot express what happened.

### Ruling R10 — provenance becomes CAUSE-discriminated, and the cause is named

```
PruneProvenance =
  | { cause: 'BRANCH_DECISION';  branchStepId: string; selectedEdgeId?: string; excludedEdgeId?: string }
  | { cause: 'DEAD_PREDECESSOR'; deadStepId: string;   deadStepState: string;   excludedEdgeId?: string }
```

`DEAD_PREDECESSOR` carries `deadStepState` — `CANCELLED` or `SUPERSEDED` — because *which* irrecoverable terminal
state killed the arm is the auditor's next question, and it is already in the gate's hands at the moment it decides.

**Rejected: reusing `branchStepId` for the dead predecessor.** It is the cheap fix and it makes the record lie — a
field named `branchStepId`, read by every consumer as a branch, holding a step that is not one. That is the
`CLOSED_PWU_STATES` failure in record form: a name asserting something the value does not honour. Worse here,
because an event stream is the audit trail, and a misnamed field in it is undetectable after the fact.

**Rejected: emitting nothing and disclosing it.** That is the status quo, and the status quo is the finding. A prune
event indistinguishable from a waived skip defeats the only reason the event type exists.

### Ruling R11 — the event gains the two fields, as an AUTHORED extension, recorded

`ExecutionStepPruned` is `UNRATIFIED-AUTHORED` by this lineage (m3 `sourceSection`, 2026-07-22, DR-004 DWP-03), so
extending its payload is within this programme's authority rather than a corpus question — unlike N-5, which is
escalated precisely because it would invent semantics the corpus withholds. It gains `cause` (required),
`deadPredecessorStepId` and `deadPredecessorStepState` (both optional). Recorded in `JAN-EXECREM-RESIDUALS.md` §1 as
an authored contract addition, with the reason.

~~`cause` is **required** deliberately. Optional would let a producer emit provenance that names no cause — which is
the shape this whole finding is about — and `PruneProvenance` is DERIVED by the gate, never asserted by a caller, so
there is no external producer to break.~~

**CORRECTED DURING IMPLEMENTATION — the ruling above was wrong, and an existing test caught it on the first run.**
`cause` is **OPTIONAL**. The argument for required considered producers and forgot the consumer that matters:
**replay.** Every `ExecutionStepPruned` already written by an earlier build carries no `cause`, so a required field
makes the schema unable to describe events *this system itself wrote*. JAN-EXECREM WP-1 states the invariant in as
many words — *"absent-legal, so no existing caller or **stored event** becomes invalid"* — and
`execrem-wp1-fields.test.ts` went red immediately.

The guarantee is not weakened, only relocated: **the schema describes what a valid event may look like across every
version of the system; the producer guarantees what THIS version emits.** Every prune this engine emits names its
cause, asserted at the engine layer for both causes in `execrem-wp14-provenance.test.ts` and proved by ledger mutant
`P1`. Enforcing it in the schema instead would have bought nothing that the producer test does not already buy, at
the price of making historical streams unreadable.

Recorded rather than quietly amended, because "I reasoned about producers and forgot replay" is the same shape as
the absence-of-evidence error this lineage has now made eight times — a conclusion drawn from the part of the system
I was looking at.

### Ruling R12 — the existing three provenance fields keep their meaning exactly

`selectedByBranchStepId` / `selectedEdgeId` / `excludedEdgeId` continue to mean what they mean, and remain absent on a
`DEAD_PREDECESSOR` prune. Any consumer reading them today keeps working; it simply learns nothing about the new case,
which is strictly better than learning something false. This is the constraint that makes R10 an extension rather
than a migration.

## 7. Enumerated behaviour changes

`ResolveExecutionStepWait` on a step whose binding is not `AUTHORIZED`/`PARTIALLY_AUTHORIZED` → **REFUSED**
(new). Any step whose binding is absent from the plan's activation allowlist → **ACCEPTED** (the withdrawn limb).
Prune affordances on a closed PWU → **withheld** by the read-model (the engine already refused them).

## 8. Exit criteria

The BLOCKER closed **as a class, not as an instance** — proved by a mutant that removes the column from any one
command and turns a *named* test RED. The wedge gone, with both production activation sites re-verified. The four
false records corrected. Full gate green, `rph-engine` 69. And — the criterion this lineage keeps rediscovering —
**this remediation gets its own adversarial review before it is called complete.**

---

*`READY_TO_BUILD` — 19 confirmed defects, 1 BLOCKER, 1 shipped regression, 4 false records. The review that found
them was the one JAN-EXECREM recorded as owed; it took 80 agents to find what a green suite could not.*
