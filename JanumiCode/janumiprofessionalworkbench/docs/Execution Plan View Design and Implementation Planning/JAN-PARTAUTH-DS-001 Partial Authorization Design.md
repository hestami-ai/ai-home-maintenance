# JAN-PARTAUTH-DS-001 — Partial Authorization: making `PARTIALLY_AUTHORIZED` reachable

**Status:** design, authored 2026-07-26. Closes **N-6**. Register: `JAN-EXECREM-RESIDUALS.md`.

---

## 1. The finding, and the correction to how this register described it

`RuntimeBinding.authorizationStatus` ratifies five states. The machine declares `REQUESTED →
PARTIALLY_AUTHORIZED` with the trigger *"partial grant"*, and `bindingPermitsExecution` — the ratified kernel
RPH-EXE-003 rests on — **permits execution on a PARTIALLY_AUTHORIZED binding**. No command produces that state.
So a ratified rule has an acceptance limb the command bus cannot reach, and the only test covering it had to
**seed the aggregate** (`seedRuntimeBindingStatus_FIXTURE`).

**This register previously concluded that closing N-6 "needs a real `PartiallyAuthorizeRuntimeBinding` command".
That was wrong, and the reasoning was wrong in a way worth naming.** It rested on two premises:

| Premise | Verdict |
|---|---|
| *"`m2-transitions.json` declares the arrow with its own trigger, so it is a distinct event."* | **FALSE.** Triggers in this corpus are overwhelmingly PROSE, not event names: **206 of 290** are not event-name-shaped (`Begin discovery`, `Approve plan`, `Missing information`). *"partial grant"* is a description of a CONDITION, exactly like its neighbours. |
| *"`advanceStatus` takes a single `target`, so one command cannot drive two arrows."* | **TRUE, AND IRRELEVANT.** That is a property of a helper in `kit.ts`, not of the domain. It is a mechanical obstacle, and I read it as a semantic one. |

**And the corpus already answers the question positively, in the place I did not look.**
`m3-commands-events.json`'s `RuntimeBindingAuthorized` declares its payload field:

```json
{ "field": "authorizationStatus", "required": true, "type": "enum",
  "enumRef": "AuthorizationStatusSchema", "note": "REQUESTED->AUTHORIZED|PARTIALLY_AUTHORIZED" }
```

**One event, two outcomes, distinguished by a field the vocabulary already declares as REQUIRED.** The authored
vocabulary says the resulting status is a *property of the authorization*, not a different act. So the design is
to **derive the target**, and there is no new command, no new event, and no vocab change at all.

> This is the fourth time in this programme that a conclusion of the form *"the corpus does not provide X"* has
> been a statement about my search. The standing counter-measure applies: read the **field lists**, not only the
> section that names the thing.

## 2. The rule

Let `R` = the binding's `requestedCapabilities` identities, `G` = the payload's `grantedCapabilities` identities,
`G₀` = what is already granted.

| Condition | Outcome |
|---|---|
| `G ⊄ R` | **REFUSED** — N-4, already enforced (`grantedWithinRequest`). Granting what was never requested is expansion without its own authorization event (§22.1). |
| `G ⊉ G₀` | **REFUSED — NEW (§3 below).** |
| `G ⊇ R` | `AUTHORIZED` |
| otherwise | `PARTIALLY_AUTHORIZED` |

The outcome is a pure function of `(R, G)` and belongs in `rph-domain` beside `grantedWithinRequest`, for the
reason every other decision in this lineage lives there: the read-model and any future authorizer must be able to
reach the same verdict without a store.

## 3. Why a monotonicity guard is IN SCOPE, and is not scope creep

`AuthorizeRuntimeBinding`'s `mutate` writes `grantedCapabilities` **wholesale** from the payload. Its precondition
already admits `PARTIALLY_AUTHORIZED`. So once this state is reachable, a second authorization carrying a smaller
set **silently drops granted capabilities**, recording the removal as a `RuntimeBindingAuthorized` event — while
`RevokeRuntimeCapability` exists precisely to record removal, drives to a terminal state, and carries a reason.

**That path is unreachable today only because `PARTIALLY_AUTHORIZED` is unreachable — which this work package
fixes.** Landing the derivation without the guard would not leave an existing defect alone; it would *create* a
live one. The machine's own trigger for that arrow reads *"new authorization event (privilege expansion)"*: this
arrow authorizes **expansion**, and reduction is a different act with a different command and a different event.

## 4. What is DELIBERATELY NOT decided

**An empty grant from `REQUESTED` is ALLOWED, and that is a disclosure rather than a preference.** `G = ∅` with
`R ≠ ∅` yields `PARTIALLY_AUTHORIZED` with nothing granted — and `bindingPermitsExecution` permits execution on
that binding. It is tempting to refuse it and direct the authorizer to `DenyRuntimeBinding` (which *is* reachable
from `REQUESTED`, so refusing would not wedge). **I am not doing that**, because the corpus says nothing about it
and JAN-CAPBIND's withdrawn `scope` field is the standing lesson: *"partial grant" implies granting some* is my
inference, not a ratified rule. Recorded as **N-18**, with its consequence stated, for a sponsor ruling.

**`capabilityAuthorized` still gets no production caller.** Operation-level capability enforcement is N-2's open
half and needs a runtime that hosts invocations. Wiring it here to make a register row look better is the exact
substitution the enforcement register exists to prevent.

## 5. Work packages

| WP | Change | Gate |
|---|---|---|
| **1** | `authorizationOutcome(R, G)` and `grantIsMonotone(G₀, G)` in `rph-domain`; `advanceStatus`'s `target` accepts a deriver `(state) => string` (every existing call site passes a literal and is unaffected). | check-types + rph-domain suite |
| **2** | `authorizeRuntimeBinding` derives its target and gains the monotonicity guard beside N-4's. | rph-application suite |
| **3** | **Retire `seedRuntimeBindingStatus_FIXTURE`.** It exists *because* this state was unreachable; exebind `P2` now drives it through `Engine.dispatch`, which is strictly stronger evidence. Its header is a finding record — that record moves to the register as CLOSED rather than being deleted. | exebind suite |
| **4** | Batteries + declared mutants + register: N-6 CLOSED with the mis-diagnosis corrected in place, N-18 recorded. | full gate |
