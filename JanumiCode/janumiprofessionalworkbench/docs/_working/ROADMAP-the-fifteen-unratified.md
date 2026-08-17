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

**⚠ ONE OF THE TEN IS NOW DRIVEN, and it confirms the criterion rather than merely illustrating it.** While
arranging the §3 drive I issued `RecordClaimAssessment(SUPPORTED)` against a claim in OPEN — i.e.
`Claim.status OPEN -> SUPPORTED`, one of these ten — and the engine refused it:
`RPH_ILLEGAL_STATE_TRANSITION … ILLEGAL_UNDEFINED: transition OPEN -> SUPPORTED is not in the Claim.status
matrix`. **The refusal comes from the MACHINE, exactly as §0 predicts for every `from ≠ to` member**, and it
arrived as an accident of arranging a different test — which is worth recording, because it is the only member
of the ten that has been driven at all. The other nine rest on the §0 criterion, which is sound but is an
argument; do not write "all ten are refused" as though all ten were observed.

⚠ **Do NOT "fix" this by intersecting declarations with the machine.** That would make the census's output a
function of the machine table — REG-F-114's forbidden inference — and would silently repair a real over-claim
into a clean number, destroying the very signal this list exists to carry.

## 3. INCREMENT 3 — the five self-edges: one ruling each, and two are already written

- `ExecutionPlan ACTIVE -> ACTIVE` — **ruled** (DWP-05 declared HOLD). Cite and close.
- `RuntimeBinding PARTIALLY -> PARTIALLY` — **ruled** (N-22 narrowed; incremental multi-party authorization is
  expressible and needs no new arrow). Cite and close. ⚠ Its own docblock at `runtime-binding.ts:170-186` still
  says the OPPOSITE and must be struck in this increment or the citation points at prose that contradicts it.
- `Claim.status` × 3 — **DRIVEN 2026-08-13, AND IT IS A LIVE DEFECT.** Through the real bus: AssertClaim →
  RecordClaimAssessment(UNDER_ASSESSMENT) → admit evidence → RecordClaimAssessment(SUPPORTED) → **a second,
  byte-identical RecordClaimAssessment(SUPPORTED) was ACCEPTED**, leaving
  `["ClaimAsserted","ClaimUnderAssessment","ClaimSupported","ClaimSupported"]` — **a second `ClaimSupported`
  recording a change that did not happen.** That is AX-7's permanent false entry in an append-only log, the same
  shape as the governance `REVOKED -> REVOKED` re-issue and as RuntimeBinding's N-22 before it was guarded.

  **⚠ AND THE FIX IS THE NARROW ONE, on the N-22 precedent: refuse "nothing changed", NOT "the status stayed the
  same".** `RecordClaimAssessmentPayloadSchema` carries optional `assessmentId`, `rationale` and
  `contradictingEvidenceIds`, so a SECOND assessment that reaches the same conclusion by a distinct assessment
  IS expressible and IS a real act — refusing every self-edge would strand it, which is exactly the over-refusal
  `runtime-binding.ts:221-228` records itself withdrawing. Only an assessment that adds nothing is the false
  entry.

  **⚠ AND THE DESIGN QUESTION THAT MUST BE ANSWERED BEFORE ANY CODE:** what counts as "changed" here is NOT
  simply payload-vs-state, so `noOpEditPrecondition` (DWP-08) may not fit as-is. `mutate` persists only
  `contradictingEvidenceIds` and a derived `supportingEvidenceIds`; `assessmentId` and `rationale` ride the
  EVENT and are never written to the object. So a second assessment carrying a fresh `assessmentId` is
  indistinguishable from the first BY STATE, and a state-only comparison would refuse a legitimate distinct
  assessment. Deciding the comparison basis — state, last event, or the pair — is its own design step.

## 4. What this roadmap will NOT do

- No `transitions.data.ts` edit. `Claim.status`'s 15 arrows are AUTHORED and disclosed (REG-F-045); adding a
  self-arrow is an authoring act with its own disclosure, and it is not needed — a hold is admitted by the NOOP
  rule and needs DECLARING, not ratifying (`runtime-binding.ts:221-228`'s recorded reasoning).
- No single "unratified" number in any commit message or register entry after Increment 1.
