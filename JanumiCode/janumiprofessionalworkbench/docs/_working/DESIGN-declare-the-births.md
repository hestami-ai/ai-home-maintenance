# DESIGN — declare the births, so occupancy can be analysed at all (REG-F-086, unblocked)

**Status:** DESIGNED, not built. Derived and verified 2026-08-12; every claim below was measured, not reasoned.

## Why now

REG-F-087 argued a birth declaration for `PWU.workLifecycleState` was pointless: *"`occupiable()` seeds from
births and then grows along `declaredArrows()`, and the PWU has no visible arrows to grow along."* That is now
false twice over — **REG-F-114 gave the PWU 49 arrows and REG-F-117 gave Intent 6**. Both machines have since
moved `orphans → unanalysed`, which is the state meaning *"has arrows, lacks a declared birth"*.

Measured now, from `verif/arrow-command-census.baseline.json`:

```
unanalysed: ['ExecutionStep.stepState', 'Intent.intentStatus', 'PWU.workLifecycleState']
```

## The blocker REG-F-086 recorded, re-verified

That entry recorded the remedy as impossible for two machines: *"the birth census reads only `createObject(...)`,
and `captureIntent`/`proposePwu` never call it."* **Re-checked, and it is accurate** — `computeBirthStates()`
matches `node.expression.text !== 'createObject'` (`verif/arrow-command-census.ts`), while `captureIntent`
(`intent.ts`) and `proposePwu` (`pwu.ts`) both commit through `commitState` directly.

**But the conclusion drawn from it — that the birth cannot be declared — does not follow.** It is the same shape
REG-F-117 just corrected: the declaration mechanism is attached to one primitive, and the sites that need it use
another.

## The design

**`births` is already load-bearing and must stay that way.** `createObject` validates the committed state against
the declared values and REFUSES on mismatch (`kit.ts`), under a docstring that states the reason in terms: *"a
field that only a census reads is the hollow this programme keeps finding."* Anything added here inherits that bar.

1. **Extract the birth check** from `createObject` into a shared helper in `kit.ts`.
2. **`commitState` gains the same optional `births`** and runs that helper. ⚠ `createObject` **delegates to
   `commitState`** (verified), so it must NOT forward `births` — each checks its own, or the check runs twice and
   the forwarding site (`births: args.births`) is not an array literal, which the census rejects by design.
3. **`captureIntent` and `proposePwu` declare their births** — `Intent.intentStatus` at `RAW`, `PWU.workLifecycleState`
   at `PROPOSED` (both read from the committed state, not from `initialState`, which lies for five machines).
4. **The census gains a NAME, not a code path:** `BIRTH_PRIMITIVES = new Set(['createObject', 'commitState'])`,
   mirroring REG-F-117's `ADVANCE_PRIMITIVES`.
5. **THE RATCHET, and it is the part that makes this more than two declarations.** A creation is *structurally*
   distinguishable from an advance: it commits `newRevision: 0` with `expectedRevision: undefined`. So the census
   must `fail()` on any `commitState` site that creates and declares no `births`. That converts "declare if you
   like" into **a creation cannot be added without declaring its birth** — the same settlement `advanceStep`'s
   docblock records for step commands, and what REG-F-114 built for arrows.

## Predicted effects — to be checked against the run, never written first and made true

- `unanalysed` **3 → 1**; only `ExecutionStep.stepState` remains, and **its cause has not been established** —
  it is not known whether steps are created through a third path. Do not assume it falls out of this work.
- `occupiable()` can seed both machines and grow along their 49 + 6 declared arrows, so **dead-arrow analysis
  becomes possible for them for the first time**. `dead` (currently 11) may move in either direction; it is a
  measurement, not a target.
- 20 direct `commitState` sites exist. Only the two adding `births` should contribute; the other 18 are advances.
  **If the ratchet in (5) reddens on any of the 18, that is a finding, not a nuisance** — it means a creation is
  committing through a path nobody declared.

## Risks

- **`kit.ts` is a core primitive.** The change is additive (an optional field plus a check that only fires when
  the field is present), but every handler routes through it. The full gate is the acceptance, not the unit tests.
- **The ratchet may reveal creations the census cannot see today.** That is the point, and it may widen the
  increment. Size it before absorbing it.
- **Do not seed occupancy from `initialState`.** It lies for five machines (`DecompositionContract`,
  `RecompositionContract`, `ExecutionPlan`, `AssuranceAssessment`, `Baseline`), which is why the declaration lives
  at the site that performs the birth. REG-F-089 records the consequence of the fiction.

## Acceptance

Behavioural, as REG-F-114's was: a declared birth that disagrees with the committed state must REFUSE the command;
a creation that declares nothing must fail the census. Mutants for both, with predicted reds stated before the run.
The C-0 baseline moves in the same commit, re-pinned with `PIN_ARROW_BASELINE=1` from `census()` itself.
