# ROADMAP — self-declaring lifecycle arrows

Implements `DESIGN-self-declaring-lifecycle-arrows.md`. **One vertical slice (PWU), not divisible** — a table
without its reader is the hollow it exists to cure. Intent is an identical second slice, deliberately excluded.

Order within the slice is chosen so that each step's red is visible before the next hides it.

---

## A-1 — the agreement gate FIRST, against an empty table

**Red first, and deliberately backwards.** Write `verif/lifecycle-arrow-declarations.test.ts` before the table
exists: every in-edge of `PWU.workLifecycleState` must be CLAIMED by a spec or listed UNIMPLEMENTED. With an
empty table every arrow is unclaimed, so the gate reddens with the **full list of arrows the machine declares** —
which is also the worksheet for A-2, derived rather than transcribed by hand.

⚠ This ordering is the point. Writing the table first and the gate second means the gate is written to fit the
table, which is how a census comes to agree with the thing it audits.

## A-2 — the table

`PWU_LIFECYCLE_COMMAND_SPECS` in `rph-domain`, one row per `advancePwuLifecycle` call site (11 measured), each
`sourceStates` taken **from the gate's own red output**, not from reading the handlers. Any in-edge no command
performs goes on the `UNIMPLEMENTED` list with a reason — this is where a genuine coverage gap gets recorded
rather than absorbed.

**Gate:** A-1 goes green, and its shrink-only limb now guards the list.

## A-3 — the handler reads it and refuses outside it

`advancePwuLifecycle` takes `spec` instead of `target`; refuses a source outside `sourceStates` **before**
`canAdvanceWorkLifecycle`, with an *undeclared arrow* reason distinct from *illegal transition*.

**Red first:** a synthetic spec omitting a machine-allowed state must be REFUSED, and the refusal must name the
undeclared-arrow reason — not the illegal-transition one. Two mistakes, two messages.

**CONTROL:** every one of the 11 real commands still performs its arrow. Without it, the refusal above is
equally consistent with a handler that refuses everything. This control is the reason A-3 cannot be split.

## A-4 — the census reads the table, and the pin moves

`declaredArrows()` gains the table as a data source (its third), exactly as it already reads
`STEP_COMMAND_SPECS`. Then `verif/arrow-census-coverage.test.ts` **reddens by design** — it pins 115/304 and
14/27 — and its pin is updated to the measured values **in the same commit**, which is the mechanism REG-F-087
built for this moment.

⚠ **The new numbers are recorded from the run, never predicted.** Writing an expected figure and then making it
true is the inverse of measuring.

## A-5 — mutants, register, gate

- **Mutant** `F114-the-declared-source-set-stops-being-checked`: delete the source-set refusal in
  `advancePwuLifecycle`. Predicted red: the synthetic-spec test alone. Without this the declaration is a comment.
- **Mutant** `F114-a-machine-arrow-goes-unclaimed-quietly`: drop the unclaimed-in-edge limb of the gate.
  Predicted red: the agreement test alone.
- **Register:** amend REG-F-087 (its residue is discharged, coverage restated) and REG-F-114 (built), both by
  striking rather than overwriting — and both must keep exactly one live `**Status:**`, per REG-F-113's gate.
- **Full gate**, including `bun run mutants`.

---

## Not in scope

`advanceIntent` (identical second slice); normalising any handler onto `advanceStatus`; and — named because it
is the cheap-looking path REG-F-114 warns about — **inferring `from` from `STATE_MACHINES` inside the census.**
That would turn every pin green while leaving the arrows exactly as undeclared.
