# ROADMAP — `JAN-DISCHARGE`: a work-unit type says how its work is discharged

**Design:** `DESIGN-work-discharge-declaration.md` · **Date:** 2026-09-05

---

## Stages

### `WD-01` — the field

`workDischarge?: 'MODEL' | 'HUMAN' | 'UNDECLARED'` on `PWU_TYPE` and on both authoring payloads. Optional
under `PER-2`, with **absent** and `UNDECLARED` kept apart (design §2.1).

**Exit:** `bun run gen` clean; the emitted schema carries a closed union.

### `WD-02` — the coherence rules, both directions

In `pwa-authoring.ts`, refuse:

1. `MODEL` with no ACTIVE template;
2. an ACTIVE template with a discharge that is not `MODEL`;
3. any discharge on a `DELEGATED_EXTERNAL` type.

**Predicted reds — and rule 2's mutant is the one that matters:**

| Mutant | Must redden |
|---|---|
| drop rule 1 | `MODEL` + no template is accepted |
| **drop rule 2** | **an ACTIVE prompt sits on a `HUMAN` type and nothing says the prompt is inert** |
| drop rule 3 | a delegated type declares a discharge the counterparty owns |
| **CONTROL** | a coherent `MODEL` type, a coherent `HUMAN` type and a `DELEGATED_EXTERNAL` type are all ACCEPTED — or "refuse everything" would pass the three above |

### `WD-03` — the surface

A discharge selector on the PWU type editor. **Absent and `UNDECLARED` both render as owing an answer** — the
whole point is that the gap stops being invisible.

**Exit:** an e2e that authors a `HUMAN` type and reads it back, and one that sees the incomplete state.

### `WD-04` — the button declares rather than sniffs

`beginExecute` keys on `workDischarge === 'MODEL'`, not on the template's status.

⚠ **The existing execution e2e must still pass unchanged** — its type declares `MODEL` because rule 2 forces
it to, so the switch is invisible to it. **If that spec needs editing, the change was not behaviour-preserving
and the roadmap wants to know.**

### `WD-05` — every blueprint answers, and the interface makes that structural

`workDischarge` is **REQUIRED on `PwuTypeTemplate`** and optional on the object. The object must tolerate
absence (`PER-2`); a blueprint written today has no such excuse, and a new one omitting the answer would hand
every type copied from it a question nobody was shown.

⚠ **THIS STAGE'S FIRST WORDING WAS WRONG AND IS CORRECTED HERE.** It read *"leaving them undeclared would
propagate the exact defect"*. The defect was **ambiguity** — one silence standing for three facts — not the
absence of a decision. A blueprint cannot know whether a given organisation discharges Intent Definition by a
person or a model, and guessing would put an answer in the professional's mouth. **All nine declare
`UNDECLARED`, which removes the ambiguity and hands over a VISIBLE open question** — exactly what the field
was added to do.

⚠ **And there are NINE, not eleven.** The design's first draft counted with `grep -c "pwuKind:"`, which also
matches the interface's own field and a help-text key. Derived instead by loading the built module:
`PWU_TYPE_CATALOG.length` → **9**, all 9 answered.

### `WD-06` — the honesty items

File the outcome; re-run `REG-F-348`'s derivation (**run it**); state plainly that requiring the field is
owed and unscheduled.

---

## Gates

`bun run check-types` · `bun run lint` · vitest across every project but CSAA (**265 files / 2221 baseline**)
· playwright for `WD-03`/`WD-04`.

## Boundaries

No new values for the four unratified columns · no change to `executionBoundary` · no migration · no CSAA.
