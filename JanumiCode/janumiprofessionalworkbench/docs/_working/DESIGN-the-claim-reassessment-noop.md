# DESIGN — the Claim re-assessment NOOP: what "nothing changed" means when nothing is stored

**Status: DESIGN. Nothing has landed.** Follows the DRIVEN finding in `ROADMAP-the-fifteen-unratified.md` §3.

## 1. The defect, as driven (2026-08-13, real bus)

`AssertClaim` → `RecordClaimAssessment(UNDER_ASSESSMENT)` → admit evidence → `RecordClaimAssessment(SUPPORTED)`
→ **a second, byte-identical `RecordClaimAssessment(SUPPORTED)` is ACCEPTED**, leaving
`["ClaimAsserted","ClaimUnderAssessment","ClaimSupported","ClaimSupported"]`.

The second `ClaimSupported` records a status change that did not occur. AX-7: a permanent false entry in an
append-only log. Same shape as governance's `REVOKED -> REVOKED` (fixed by `fromStates`) and RuntimeBinding's
N-22 (fixed by a narrow "added nothing" guard).

## 2. Why the obvious fix is WRONG, on this repository's own precedent

The obvious fix is to forbid the self-edge — narrow `fromStates` so `SUPPORTED` cannot be a source when the
target is `SUPPORTED`. `runtime-binding.ts` records itself trying exactly that and withdrawing it:

> *"MY FIRST FORMULATION REFUSED EVERY `from === to`, AND IT WAS OVER-BROAD … **the defect is 'NOTHING CHANGED',
> not 'THE STATUS STAYED THE SAME'**."*

A second assessment that reaches the same conclusion **by a distinct assessment** is a real professional act:
`RecordClaimAssessmentPayloadSchema` carries `assessmentId`, `rationale` and `contradictingEvidenceIds`, so it is
expressible today. Refusing it would strand a legitimate act — the over-refusal half.

## 3. ⚠ THE PROBLEM: `noOpEditPrecondition` CANNOT BE REUSED HERE, and the reason is a hollow

`noOpEditPrecondition` (DWP-08) compares **payload fields against the object's current state**:

```ts
const changed = fields.some((f) => p[f] !== undefined && !isDeepStrictEqual(p[f], s[f]));
```

That works only for fields the handler PERSISTS. Measured against `recordClaimAssessment`'s `mutate`:

| payload field | persisted to the object? | on the event? |
|---|---|---|
| `targetStatus` | yes — as `status` | yes |
| `contradictingEvidenceIds` | **yes**, when non-empty | yes (ClaimContested) |
| `assessmentId` | **NO** | yes |
| `rationale` | **NO** | yes (default arm) |

So a second assessment carrying a **fresh `assessmentId`** is, by STATE, indistinguishable from the first.
Handing `['targetStatus','assessmentId','rationale']` to `noOpEditPrecondition` would compare `assessmentId`
against `state.assessmentId`, which is `undefined` **always** — making `p[f] !== undefined && !isDeepStrictEqual(...)`
true for *every* assessment that supplies one. **The guard would pass whenever an `assessmentId` is present and
refuse only when it is absent** — precisely inverted from the rule we want, and it would look like it worked.

⚠ That is a control that cannot fail wearing a helper's clothes. Do not reach for the existing helper because it
is there.

## 4. The three candidate comparison bases

- **(a) STATE-only.** Compare `targetStatus` (and `contradictingEvidenceIds`) against state. Refuses the
  identical re-issue — but ALSO refuses a genuine distinct re-assessment, since the distinguishing fields are not
  in state. **Over-refuses; rejected for the same reason N-22's first formulation was withdrawn.**
- **(b) LAST-EVENT.** Compare the incoming payload against the last event this claim emitted. Distinguishes a
  fresh `assessmentId`/`rationale` from a repeat. Needs an event-log read in a precondition — which this
  repository already does elsewhere (`submitEvidenceForAssessment`'s duplicate check reads
  `read.aggregateEvents`, JAN-CMDPRE DWP-08), so it is an established shape and not a new capability.
- **(c) PERSIST THE DISCRIMINATOR.** Write `assessmentId` onto the claim, then (a) works. **Rejected:** it
  changes the object's shape to serve a guard, and the claim object's fields are contract-declared — the tail
  wagging the aggregate.

**Recommendation: (b).** It compares the act against the record of the previous act, which is what "did anything
happen?" actually means in an event-sourced system, and it needs no contract change.

## 5. ⚠ What must be settled BEFORE writing the guard

1. **Is an assessment with NO `assessmentId` and no `rationale`, repeated, the only case to refuse?** If a caller
   supplies neither field twice, (b) sees two identical events and refuses — correct. If a caller supplies a
   fresh `assessmentId` each time with no other change, (b) admits every re-issue, and the log fills with
   `ClaimSupported` events distinguished only by an id the caller chose. **That may be right** (each is a real
   assessment) **or it may be an unbounded-append hole** (a caller can mint ids). This is the same question
   `AppendConversationEntries` hit and DEFERRED as residual **R2** — *"a content-only key over-refuses a
   legitimately recurring identical turn"* — and it was deferred awaiting a stable per-batch id. **Cite R2; do
   not re-decide it silently.**
2. **Which refusal code.** `noOpEditPrecondition` uses `RPH_VALIDATION_SEMANTIC_FAILED`; RuntimeBinding's N-22
   uses `RPH_INVARIANT_VIOLATION`. Pick by what the refusal IS about and state the choice — REG-F-114's lesson
   that a refusal code is a claim.
3. **The other two self-edges come free or they do not.** `CONTESTED -> CONTESTED` and
   `UNDER_ASSESSMENT -> UNDER_ASSESSMENT` ride the same handler, so one guard covers all three — but their event
   payloads differ (`ClaimContested` carries `contradictingEvidenceIds`, which IS persisted), so "nothing
   changed" is a different comparison for each arm. **Drive all three before claiming one guard covers them.**

## 6. Verification the increment owes

- A red-first test per self-edge: the identical re-issue refuses, and a **distinct** re-assessment still
  succeeds — the second is the control, without which the guard is indistinguishable from `fromStates` narrowing.
- A mutant that widens the guard to refuse every `from === to`, whose predicted red is the distinct-re-assessment
  control. That mutant is the one that proves the fix is the NARROW one.
