# DESIGN — how a work-unit type's work is discharged, said out loud

**Status:** DESIGN (pre-roadmap) · **Date:** 2026-09-05 · **Programme:** `JAN-DISCHARGE`
**Follows:** `REG-D-058` (the type owns a prompt), `REG-F-352` (a model-executed step meets the floor)
**Sponsor:** *"Proceed with both follow ons."* (2026-09-05)

---

## 1. The defect: one silence standing for three different facts

After `JAN-EXECRUN`, a type with no ACTIVE prompt template falls back to the demo's existing lifecycle. That
fallback is correct *behaviour* and a **wrong representation**, because these three are indistinguishable:

| What is true | How it looks today |
|---|---|
| A model does this work | ACTIVE template present |
| **A person does this work** — legitimate and common | **no template** |
| **Nobody has decided yet** | **no template** |

⭑ **A professional cannot tell an unfinished type from a deliberately human one**, and the system cannot
either. This is the same shape this repository keeps recording elsewhere — *"a reader cannot tell 'purged on
schedule' from 'never stored' from 'lost'"* — arriving on the authoring plane.

**And it is not an edge case. Measured:**

- **The authoring catalog's blueprints carry ZERO prompts** (`grep -c "promptTemplate"
  packages/rph-authoring/src/catalog.ts` → **0**). Every type a user starts from a blueprint begins in the
  undistinguished state.
  ⚠ **A first draft of this said "11 blueprint types", counted with `grep -c "pwuKind:"`. That instrument
  counts the INTERFACE's own field declaration and a help-text key as well as the entries — the answer is
  **9**, derived by loading the built module and reading `PWU_TYPE_CATALOG.length` rather than counting lines
  that look like entries. A count taken from a pattern that matches more than the thing being counted is the
  defect this repository files against itself most often.
- The seeded reference architecture's types likewise carry none.

**And the existing boundary field does not cover it.** `ExecutionBoundarySchema` is
`['INTERNAL', 'DELEGATED_EXTERNAL']` (`packages/rph-contracts/src/enums.ts:427`) — *inside* versus *delegated
out*. Neither says whether a **person** or a **model** discharges the work.

## 2. Design

Add `workDischarge` to `PWU_TYPE`, a **closed** union, **optional**:

| Value | Means |
|---|---|
| `MODEL` | a model attempts this work, per the type's own prompt template |
| `HUMAN` | a person does this work — a first-class answer, not a silence |
| `UNDECLARED` | ⭑ **the author saw the question and deferred.** A deliberate "not yet", which is a real state |

### 2.1 ⭑ Absent and `UNDECLARED` are DIFFERENT, and that is the repository's own pattern

`PER-2` forces the field optional: every `PwuTypeDefined` already written carries none, and a required field
would demand an upcaster inventing an answer nobody gave. So the data has **absent** as well as the three
members — and rather than treat that as an accident, it carries a fact:

- **absent** — *authored before the question existed.* Nobody was asked.
- **`UNDECLARED`** — *asked and deferred.*

⭑ **This is exactly `ExchangeIdentityFact`'s ratified shape one object over** (`objects.ts:252-257`), whose
`availability` distinguishes `REPORTED` / `UNREPORTED` / `UNRESOLVABLE` / **`NOT_PROBED`**. *"Nobody looked"*
and *"looked and found nothing"* are different facts there for the same reason they are different here.
**The surface renders both as owing an answer; the record keeps them apart.**

### 2.2 ⛔ There is no `EXTERNAL_PARTY` member, deliberately

`executionBoundary: DELEGATED_EXTERNAL` **already says the work leaves the organisation**, and its
`boundaryContract` names the counterparty. A second way to say the same thing is the duplication defect this
repository records against restated vocabulary. **Coherence rule instead:** a `DELEGATED_EXTERNAL` type
declares no discharge mode — the counterparty's contract answers it.

### 2.3 The coherence rules, and they run BOTH ways

1. **`MODEL` requires an ACTIVE prompt template.** A type that says a model does the work and gives it nothing
   to do is a promise with no content.
2. ⭑ **An ACTIVE prompt template requires `MODEL`.** Without this the reverse drift is silent: a type carries
   a carefully authored prompt, declares `HUMAN`, and the prompt is inert — authored, reviewed, published, and
   never used, with nothing saying so. **The rule that only runs one way is the one that lets the defect in.**
3. **`DELEGATED_EXTERNAL` must not declare a discharge mode** (§2.2).

### 2.4 The execute button declares rather than sniffs

`beginExecute` currently infers a model step from `promptTemplate?.status === 'ACTIVE'`. It will read
`workDischarge === 'MODEL'` instead. ⭑ **A declaration is a decision someone made; an inference is a guess the
code makes on their behalf** — and rule 2 keeps the two from disagreeing.

## 3. Two steps, no flag day

**Now:** optional, with the surface showing absent/`UNDECLARED` as *owing an answer*.
**Then:** once the blueprints and the seed carry real answers, tighten to required.

⚠ **The second step is not scheduled here and this design does not pretend otherwise.** Requiring it makes
every undeclared type invalid, which is a migration with a fixture sweep; naming it as owed is the alternative
to it arriving as a surprise.

## 4. Boundaries

No new values for the four unratified columns (`REG-Q-056`) · no change to `executionBoundary` · no migration ·
every blueprint answers **in this programme**, enforced by making the field REQUIRED on `PwuTypeTemplate` ·
no CSAA.
