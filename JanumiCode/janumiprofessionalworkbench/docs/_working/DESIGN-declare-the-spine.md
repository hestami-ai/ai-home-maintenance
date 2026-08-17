# DESIGN — declare the PWU spine, and make one machine SOUND (REG-F-118's named residue)

**Status:** DESIGNED, not built. Every number below was measured on 2026-08-13, not reasoned.

## What is missing, and who performs it

REG-F-118 named eight undeclared `PWU.workLifecycleState` arrows. They form **a spine with one fork** — the path
the workbench drives every day:

```
READY → PLANNED → EXECUTING → EVIDENCE_PENDING → UNDER_ASSURANCE → SATISFIED → RECOMPOSING → RECOMPOSED
                                                       └────────→ CONDITIONALLY_SATISFIED
```

⚠ This said *"one unbroken chain"*, named eight arrows, and drew **seven** — the eighth parenthesised below the
line as an aside. `UNDER_ASSURANCE` has TWO out-arrows in the undeclared set. **The tidier word cost the shape:**
a fork at the assurance verdict is not an aside, it is the whole reason that state exists, and a reader checking
"eight" against the diagram would have counted seven and had to decide which to believe.

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
range **corresponds to** the complement of `PWU_SEMANTIC_LIFECYCLE_COMMANDS`.

⚠ **"CORRESPONDS TO", NOT "IS COMPUTED FROM" — see the correction at design item 2.** This section originally said
the range *"is not a list to be authored"* and cited `OwnedLifecycleTarget` as an existing anti-rot narrowing. That
type has **zero consumers** and narrows nothing, and computing the range would make an existing gate unfalsifiable.
**The complement is how you CHECK the transcription, not how you produce it.**

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

⚠ **CORRECTED 2026-08-13 by an adversarial verification pass — the original claim here was FALSE, and it
contradicted a measurement I had taken one step earlier.** It read *"the first machine in the repository with
COMPLETE arrow coverage"*. It would be the **FIFTH**. Four are already complete AND already occupancy-analysable:
`AssurancePolicy.status` (5 arrows), `PWA.publicationStatus` (5), `RuntimeBinding.authorizationStatus` (6),
`ValidatorRegistryEntry.status` (5). REG-F-118's own re-pin had already told me four machines were analysed; I
wrote "first" anyway. **A superlative is a measurement, and this one was available and ignored.**

**The accurate claim is stronger for being true.** `PWU.workLifecycleState` carries **57 arrows over 20 states** —
an order of magnitude larger than every machine now analysable, whose totals are 5, 5, 6 and 5 — and it is the
**first PWU axis** to qualify. Under REG-F-118, completeness is the precondition for a sound unreachability claim,
so this is the first time that analysis would mean anything on a machine anyone cares about.

## The first real hazard, which the original design did not mention

⚠ **A LITERAL `sourceStates` CHECK WOULD REFUSE THE REFERENCE UNDERTAKING.** The seed HOLDS at
`EXECUTING → EXECUTING` (`packages/rph-engine/src/reference-undertaking.ts:728, :775`) and
`UNDER_ASSURANCE → UNDER_ASSURANCE` (`:1010`) through its `chg` helper (`:586-608`). The declared source for
`EXECUTING` is `['PLANNED']` and for `UNDER_ASSURANCE` is `['EVIDENCE_PENDING']`, so a source check without a hold
exemption refuses the seed itself, plus the demo route and the e2e suite.

**This is the one way the increment reaches production, and it is the opposite of the case everyone was watching.**
The hold discussion had been scoped to OWNED targets, where production is clean; a `sourceStates` check keys on the
COMPLEMENT targets, which is exactly where the holds live.

## The design

1. **A spec table for the setter**, read by the census as DATA — its existing second idiom, exactly as
   `PWU_LIFECYCLE_COMMAND_SPECS` and `STEP_COMMAND_SPECS` are. No new AST idiom: REG-F-114's warning that
   "widening a reader is how C-0b dropped 30%" applies with full force to a fourth call shape.
2. ~~**Targets DERIVED from the complement**, never typed — `WorkLifecycleState` minus `OwnedLifecycleTarget`.~~
   ⚠ **INVERTED: TRANSCRIBE THE EIGHT, DO NOT DERIVE THEM.** Three independent reasons, all verified:
   - **The derivation source does not exist as a mechanism.** `OwnedLifecycleTarget` has **zero consumers**
     repo-wide, and `as const satisfies Readonly<Record<string, string>>` types its keys as bare `string`, so it
     catches nothing — not even a typo. The anti-rot property I cited it for is not one it has. **I "corrected"
     the count in its docstring from SEVENTH to TWELFTH one commit earlier without checking whether the mechanism
     the sentence describes works at all.** It does not.
   - **Deriving it in `rph-domain` would be boundary-illegal** — the table lives in `rph-application`, and
     `.dependency-cruiser.cjs` domain-purity is severity `error`, gated by `boundary` in `gate:fast`.
   - ⚠ **DERIVING WOULD MAKE AN EXISTING GATE UNFALSIFIABLE, which is the decisive reason.**
     `verif/lifecycle-arrow-declarations.test.ts:81-93` asks whether any ratified arrow is unaccounted for. If the
     setter's targets are the complement *by construction*, then `COMMAND_TARGETS ∪ GENERIC_TARGETS` is all 20
     states **necessarily**, and the gate can never fail. **A control that cannot fail** — authored, again, inside
     a fix. The transcription IS the value: it lets the gate compare two independently authored artifacts.
3. **`sourceStates` TRANSCRIBED and GATED, exactly as `PWU_LIFECYCLE_COMMAND_SPECS` already are** — held equal to
   the machine's in-edges in BOTH directions by `verif/lifecycle-arrow-declarations.test.ts`. ⚠ This is NOT the
   inference REG-F-114 forbade: that prohibition was on the CENSUS inferring a `from` where no declaration exists,
   and here an author writes one and a gate compares it against an independently generated artifact.

   ⚠⚠ **AND IT MUST NOT BECOME A DISPATCH CHECK — the original justification for this item said "ENFORCING it at
   dispatch is what makes it a declaration rather than a decoration", and that sentence is now known to be a
   production outage.** See the hazard section: the seed HOLDS at `EXECUTING → EXECUTING` and
   `UNDER_ASSURANCE → UNDER_ASSURANCE`, whose declared sources are `['PLANNED']` and `['EVIDENCE_PENDING']`. A
   literal source check refuses the reference undertaking.

   **So this table's honest value is DRIFT and VISIBILITY, not a new guard** — the same bargain REG-F-114 struck
   for the eleven, and it said so in those words: *"It narrows nothing today."* Claiming more would be the thing
   this programme keeps recording.
4. ~~**Enforced at dispatch**, or it is decoration: `changePwuState` must refuse a target outside its declared
   range — which is REG-F-072's rule, now stated in one place instead of implied by an ownership table.~~
   ⚠ **STRUCK. IT ALREADY SHIPS, AND MY WORDING WOULD HAVE BROKEN PRODUCTION.**
   `rejectArrowOwnedBySemanticCommand` (`packages/rph-application/src/handlers/pwu.ts:1187-1208`, called at
   `:1329-1335`) already refuses an owned target at dispatch and already cites REG-F-072. For MOVES my proposal is
   extensionally identical to a guard that exists — **I proposed building something I had not checked for.**
   For HOLDS it is worse than redundant: `pwu.ts:1193` exempts `newState === current` **deliberately** (rationale
   at `:1184-1185`, "the dominant case"), and `generic-setter-scope.test.ts:197-202` pins a hold at the owned state
   `READY` as ACCEPTED. My wording — *"refuse a target outside its declared range"*, a predicate on `newState`
   alone — refuses every hold parked in an owned state.

   **This is the third time in two days a recorded remedy described code its author had not reopened**, and this
   time the author was me, writing about a file I had edited hours earlier.

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

## A SEPARATE FINDING, surfaced by this audit and NOT part of this increment

⚠ **THE CENSUS ALREADY INFERS THE FROM-HALF FROM `STATE_MACHINES` — the exact thing REG-F-114 forbade — and it
does so today.** `verif/arrow-command-census.ts:322`:

```ts
const from = sources ?? def!.transitions.filter((t) => t.to === to).map((t) => t.from);
```

When a call site's `fromStates` is unreadable, `sources` is `undefined` and the census silently substitutes the
machine's in-edges. REG-F-114's ruling was explicit: *"Do NOT widen the census to infer `from` from
`STATE_MACHINES` … a census reporting 100% coverage of declarations that do not exist."* The census's own comment
at `:351` describes an invariant it does not hold.

**MEASURED, because scale decides whether this is a crisis or a chore: 45 sites declare a readable `fromStates`;
ONE infers.** That one is `packages/rph-application/src/handlers/governance.ts:293`, where `precondition` is a
**shorthand property** and the census's walk (`:294`) requires a `PropertyAssignment`. So the coverage number is
not systemically inflated — but it is not purely declared either, and the difference is exactly the one REG-F-118
was about.

**Why it is listed here rather than fixed here.** Making that site readable changes what the census reads from the
machine's in-edges to the site's *declared* sources, which may be narrower — so the arrow count can MOVE, and the
C-0 baseline with it. That is its own increment with its own re-pin and its own predicted red, and folding it into
the spine work would make two movements indistinguishable in one diff.

~~**Safe default until then:** the census's arrow count is *"declared, except one site inferred"*, and no argument
that rests on the from-half being universally declared may cite it.~~

**RESOLVED — REG-F-122 (2026-08-13).** The site declares `fromStates('PROPOSED')` at the factory literal, the
census's inference expression is DELETED (the walk now refuses any from-half it cannot read, held by synthetic
fixtures through the new `declaredArrowsInFile` seam plus one mutant), and the re-pin moved NOTHING —
`Decision.status` has a single in-arrow to EFFECTIVE, so the movement this section predicted could never occur on
this machine. The caution was the right reason to keep the increment separate, and wrong about the direction: the
coincidence of the fabricated set with the declared one is what let the violation sit harmless for so long. The
safe default above is retired; arguments may now rest on the from-half being universally declared.
