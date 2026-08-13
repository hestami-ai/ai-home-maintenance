# ROADMAP — disposing the fifteen unratified declarations

**Derived from** `DESIGN-the-nineteen-unratified.md` (§4b's three populations). **Status: ROADMAP — nothing has
landed from it.** Written after REG-F-124 emptied the first population.

## 0. The split is DERIVABLE, exactly, and that is what makes this tractable

An unratified pair is one no machine ratifies. `advanceStatus` commits only what `checkTransition` admits, and
`checkTransition` admits **LEGAL or NOOP**. Unratified ⇒ not LEGAL. **So an unratified pair can reach the store
only as a NOOP — i.e. only when `from === to`** (and `classifyTransition` consults `illegal` BEFORE the NOOP
shortcut, so a self-edge the machine lists illegal would not qualify; **measured: all three machines below
declare `illegal: []`**).

The criterion needs no judgement and no machine inference — it reads only what the site declared:

| | criterion | count | remedy owner |
|---|---|---|---|
| **(b) OVER-CLAIM** | unratified ∧ `from ≠ to` | **10**, all `assurance.ts:770` | the SITE's precision |
| **(c) MACHINE-ADMITTED SELF-EDGE** | unratified ∧ `from === to` ∧ not illegal | **5**, three sites | a per-site RULING |

⚠ **"MACHINE-ADMITTED" IS NOT "FIRES"**, and the distinction is the one REG-F-120 exists for. The criterion
proves the MACHINE would admit it; whether the command actually performs it depends on the site's `guard`,
which is per-site and must be read per-site. Measured so far: `ExecutionPlan ACTIVE -> ACTIVE` is the declared
HOLD (JAN-CMDPRE DWP-05); `RuntimeBinding PARTIALLY -> PARTIALLY` fires for an incremental grant and is refused
only when nothing changed (N-22), driven green by `partauth-derived-outcome.test.ts`. **The three `Claim.status`
self-edges are NOT yet driven** — the guard constrains only SUPPORTED (requiring admissible evidence), so they
appear admissible, but that is a reading and not a drive.

## 1. INCREMENT 1 — the instrument reports the split instead of one conflated number

**Why first:** every later decision quotes this list, and today it is a single count that hides three different
things. REG-F-121 pinned "19" precisely so the question stayed visible; REG-F-124 then proved a count can be
wrong in a way its own framing cannot express. A number that cannot express its own categories is the same
defect one level up.

- Add to `verif/arrow-command-census.ts` a derived split — `unratifiedDeclarations(): { overClaimed[], machineAdmittedSelfEdges[] }` — computed from the criterion in §0. **No machine inference:** it reads `from`/`to` off the declaration and consults `illegal` only, never `transitions`.
- Replace the single `toBe(15)` pin in `verif/arrow-census-coverage.test.ts` with **both lists pinned BY NAME**, since a name-pin cannot be satisfied by deleting an arrow (REG-F-121's own lesson about `toBeLessThan`).
- **Predicted red:** the existing single-count assertion. Measure it, do not assume it.
- **Mutant:** collapse the split back to one list. **Predicted red:** the two name-pins, not the count.
- ⚠ **Control needed, or the split proves nothing:** a case asserting that a pair with `from ≠ to` is NOT classified as a hold. Without it, a classifier returning "everything is an over-claim" passes.

## 2. INCREMENT 2 — the ten over-claims: RULE, do not narrow

**The disposition is to leave `recordClaimAssessment` ALONE and say why in the register.** The site refuses to
correlate deliberately and records the reason where it declares: *"Which DESTINATIONS are legal from each is the
machine's judgement; duplicating it here would create a second, drifting copy of the arrow table (REG-F-027's
shape)."* That reasoning predates this work (2026-08-06) and is sound: a hand-written per-target source map is
exactly the artifact that drifts, and REG-F-119 already recorded what a drifted transcription costs.

Nothing is lost by leaving them: they cannot fire, they never enter the coverage numerator (§4b, measured), and
they are pinned by name. **The register entry is the deliverable** — that these ten are a KNOWN, BOUNDED
imprecision of the rectangle idiom, not an unresolved question.

⚠ **Do NOT "fix" this by intersecting declarations with the machine.** That would make the census's output a
function of the machine table — REG-F-114's forbidden inference — and would silently repair a real over-claim
into a clean number, destroying the very signal this list exists to carry.

## 3. INCREMENT 3 — the five self-edges: one ruling each, and two are already written

- `ExecutionPlan ACTIVE -> ACTIVE` — **ruled** (DWP-05 declared HOLD). Cite and close.
- `RuntimeBinding PARTIALLY -> PARTIALLY` — **ruled** (N-22 narrowed; incremental multi-party authorization is
  expressible and needs no new arrow). Cite and close. ⚠ Its own docblock at `runtime-binding.ts:170-186` still
  says the OPPOSITE and must be struck in this increment or the citation points at prose that contradicts it.
- `Claim.status` × 3 — **OPEN, and the only real question left.** A re-assessment that records new evidence
  without changing status is either (i) the product working, in which case the hold is declared and disclosed on
  the REG-D-024 precedent, or (ii) a duplicate `ClaimSupported`/`ClaimContested` event for a change that did not
  happen, which is the governance-NOOP defect shape. **Decide by DRIVING it first** — issue a second
  `RecordClaimAssessment` at the same status and read what is appended — not by reasoning from the guard.

## 4. What this roadmap will NOT do

- No `transitions.data.ts` edit. `Claim.status`'s 15 arrows are AUTHORED and disclosed (REG-F-045); adding a
  self-arrow is an authoring act with its own disclosure, and it is not needed — a hold is admitted by the NOOP
  rule and needs DECLARING, not ratifying (`runtime-binding.ts:221-228`'s recorded reasoning).
- No single "unratified" number in any commit message or register entry after Increment 1.
