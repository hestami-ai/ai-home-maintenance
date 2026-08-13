# DESIGN — declare the PWU spine, and make one machine SOUND (REG-F-118's named residue)

**Status:** DESIGNED, not built. Every number below was measured on 2026-08-13, not reasoned.

## What is missing, and who performs it

REG-F-118 named eight undeclared `PWU.workLifecycleState` arrows, and they form one unbroken chain — the main
lifecycle spine the workbench drives every day:

```
READY → PLANNED → EXECUTING → EVIDENCE_PENDING → UNDER_ASSURANCE → SATISFIED → RECOMPOSING → RECOMPOSED
                                                (also UNDER_ASSURANCE → CONDITIONALLY_SATISFIED)
```

**They are not unimplemented.** They are performed by `changePwuState` — the GENERIC setter — whose target comes
from `payload.newState` at runtime. None of the eleven `PWU_SEMANTIC_LIFECYCLE_COMMANDS` targets any spine state:
the named commands own `SHAPING, READY, CHALLENGED, RESHAPING, INVALIDATED, SUPERSEDED, BLOCKED, ESCALATED,
BASELINED, ABANDONED, REJECTED` and nothing else.

⚠ **This is a FOURTH idiom, not a variant of the other three.** `changePwuState` is bespoke — it calls
`checkTransition` per sub-axis directly, and reaches neither `advanceStatus` (whose `targetStates` mechanism the
census already reads) nor `advancePwuLifecycle`. That is the whole reason the census cannot see the spine.

## The derivation, which is the non-obvious part

REG-F-072 already established the rule the declaration should follow: **the generic setter may not reach a target a
semantically named command owns** (JPWB-DOC-003 §9 PER-3, "no generic CRUD/PATCH path"). So the setter's reachable
range is not a list to be authored — it is the **COMPLEMENT** of `PWU_SEMANTIC_LIFECYCLE_COMMANDS`, which already
exists as a typed table with its own anti-rot narrowing (`OwnedLifecycleTarget`).

Measured:

```
complement (9): CONDITIONALLY_SATISFIED, EVIDENCE_PENDING, EXECUTING, PLANNED,
                PROPOSED, RECOMPOSED, RECOMPOSING, SATISFIED, UNDER_ASSURANCE
ratified in-arrows per state: all 1, except PROPOSED = 0 (it is the BIRTH)
TOTAL declarable: 8
```

**8 is exactly the gap.** 49 named + 8 generic = 57 = every ratified arrow on the machine, with no residue and
nothing hand-listed.

## Why this is worth more than +8 arrows

`PWU.workLifecycleState` would become **the first machine in the repository with COMPLETE arrow coverage**. Under
REG-F-118 that is the precondition for a sound unreachability claim — so it becomes the first machine whose
occupancy analysis means anything, and the first that can leave `unanalysed` for a reason other than a missing
birth. Today only four machines are analysable at all, and none of them is a PWU axis.

## The design

1. **A spec table for the setter**, read by the census as DATA — its existing second idiom, exactly as
   `PWU_LIFECYCLE_COMMAND_SPECS` and `STEP_COMMAND_SPECS` are. No new AST idiom: REG-F-114's warning that
   "widening a reader is how C-0b dropped 30%" applies with full force to a fourth call shape.
2. **Targets DERIVED from the complement**, never typed — `WorkLifecycleState` minus `OwnedLifecycleTarget`. A
   twelfth named command then removes a target from the setter's range automatically, which is the same anti-rot
   property `PWU_SEMANTIC_LIFECYCLE_COMMANDS` already buys.
3. **`sourceStates` generated from `STATE_MACHINES`**, as `PWU_LIFECYCLE_COMMAND_SPECS` already does. ⚠ This is
   NOT the inference REG-F-114 forbade. That prohibition was on the CENSUS inferring a `from` where no declaration
   exists; generating a declaration from the machine and then ENFORCING it at dispatch is the established pattern,
   and the enforcement is what makes it a declaration rather than a decoration.
4. **Enforced at dispatch**, or it is decoration: `changePwuState` must refuse a target outside its declared range
   — which is REG-F-072's rule, now stated in one place instead of implied by an ownership table.

## Predicted, to be checked against the run

- `arrowsSeen` **170 → 178**; `PWU.workLifecycleState` **49/57 → 57/57**.
- The machine enters `occupancyAnalysable()` and leaves `unanalysed` in C-0, C-0c and C-0d.
- ⚠ **`dead` may move, and its direction is NOT predicted.** Occupancy will run for real on this machine for the
  first time. If a spine state turns out unreachable from PROPOSED along all 57 arrows, that is a genuine finding;
  if none is, `dead` stays 2. **Do not pin a number here in advance** — REG-F-118 exists because someone did.

## Risks

- **Enforcing the range may redden real dispatches.** The reference seed makes 67 workLifecycle dispatches through
  this setter. If any targets an owned state, that is REG-F-072's rule being violated in production and is a
  finding, not a reason to widen the range.
- **`PROPOSED` is in the complement with zero in-arrows.** The setter may legitimately never target it. Declaring
  a target with no arrows is harmless to the census but should be stated, not silently dropped.
- The comment above `OwnedLifecycleTarget` says a **"SEVENTH"** semantic command cannot be added without a row —
  there are ELEVEN. A stale count in prose beside a live table; correct it in passing (P-5), same disease as the
  blind-set comment REG-F-117 fixed.
