# Assurance Assessment lifecycle — restoring the three skipped states (REG-F-021)

> **Status: DESIGN. No code accompanies it.** This records the ratified target, the measured current state, the
> one blocker that had to be resolved before the increment could be called feasible at all, the blast radius, and
> the decisions that remain. It is written because the increment is a domain change — two new commands, two new
> event contracts, and a re-sequencing of every caller that today requests-and-starts in one dispatch — and this
> repository's practice is design → roadmap → implementation, never straight to code.

---

## 1. The ratified target

`packages/rph-domain/src/transitions.data.ts`, machine `AssuranceAssessment.state`, verbatim:

| from | to | trigger | guard |
|---|---|---|---|
| `REQUESTED` | `EVIDENCE_PENDING` | `AssuranceAssessmentRequested`; claims instantiated, evidence requirements evaluated, missing evidence requested (`AssuranceEvidenceRequired`) | one or more required EvidenceRequirements not yet satisfied |
| `EVIDENCE_PENDING` | `READY` | `submitEvidenceForAssessment` (`AssuranceEvidenceReceived`) | all required evidence present and admissible per §6.2 |
| `READY` | `ASSESSING` | `selectAssuranceEvaluator` (`AssuranceEvaluatorSelected`) **then** `beginAssuranceAssessment` (`AssuranceAssessmentStarted`) | — |
| `ASSESSING` | `SATISFIED` / `CONDITIONALLY_SATISFIED` / `REJECTED` / `INCONCLUSIVE` / `ESCALATED` | `completeAssuranceAssessment` | per outcome |

The lifecycle is **ratified**. This is not an elicitation item, and REG-F-021 first recorded it as one — that
record was a claim about a search, corrected in place.

## 2. The measured current state

`requestAssuranceAssessment` (`handlers/assurance.ts`) creates the assessment object with
`assessmentState: 'ASSESSING'`, `startedAt: command.issuedAt`, and emits **`AssuranceAssessmentStarted`** — the
event belonging to the *last* arrow.

Measured, not read:

* `REQUESTED`, `EVIDENCE_PENDING` and `READY` are written by **no production line** (`assessmentState: '<S>'`
  appears zero times for each outside tests).
* `AssuranceAssessmentRequested` is **declared and bound** in the vocab and **emitted by nothing** — the finding
  that started this.
* Of the four commands `completeAssuranceAssessment`'s own note calls missing, **three** are:
  `selectAssuranceEvaluator`, `recordCriterionResult`, `beginAssuranceAssessment`.
  `submitEvidenceForAssessment` **has since been built and is registered**; the note was stale in the safe
  direction and is corrected.

**What the collapse does and does not cost.** Evidence admissibility is *not* unchecked: `admitEvidence` runs the
ratified `evidenceAdmissibility` rule (RPH-EVD-007, with its own enforcement probe). What is lost is the
**ordering** the machine specifies — nothing requires admitted evidence to be in place *before* an assessment is
in `ASSESSING`.

## 3. The blocker that had to be resolved first, and its resolution

The `EVIDENCE_PENDING → READY` guard is *"all required evidence present and admissible"*. The **de minimis floor**
recording path (`rph-engine/src/record-assurance.ts`) requests assessments with `claimIds: []` and **never submits
or admits any evidence** — zero references to `SubmitEvidenceForAssessment`, `AdmitEvidence` or `ProposeEvidence`.

Taken naively that deadlocks the floor, and the floor gates publication and step completion. It would have made
this increment infeasible rather than merely large.

**It does not deadlock, and the reason is measurable:** the three floor policies declare **no policy-level
`requiredEvidence`** (zero occurrences in `floor-policies.ts`; the `requiredEvidenceIds: []` hits are
*criterion*-level and are all empty). `requiredEvidenceIds` therefore derives to `[]`, and *"all required evidence
present"* is **vacuously true**. A floor assessment can take `EVIDENCE_PENDING → READY` immediately.

> **This must be an EXPLICIT vacuous-pass, not an accident.** If the arrow is implemented as "advance when the
> required set is empty", that is a real rule with a real reason. If it is implemented as "advance unless
> something objects", the floor passes for a reason nobody wrote down, and the first policy that declares
> `requiredEvidence` silently changes floor behaviour. The seeded catalog policies **do** declare
> `requiredEvidenceTypes` — a *different* field (types, not ids) — and whether it participates in this guard is
> open (§5.3).

## 4. What must be built

**Two commands**, both absent: `selectAssuranceEvaluator`, `beginAssuranceAssessment`.

**Two event contracts**, both absent from `EVENTS`: `AssuranceEvaluatorSelected`, `AssuranceEvidenceRequired`.
Both are named only in trigger prose. DOC-007 schematizes neither, so both would be **UNRATIFIED-AUTHORED** under
the standing sponsor grant — the same status as `WaiverRequested`, and subject to the same rule this session
established: an authored shape that cannot carry what its consumer needs is the defect, and authored shapes are
ours to correct.

**Blast radius — four production callers** that today request-and-start in one dispatch, plus fixtures:

| caller | notes |
|---|---|
| `rph-engine/src/record-assurance.ts` | the de minimis floor path; bulk, no evidence (§3) |
| `rph-engine/src/reference-undertaking.ts` | the canonical drive. It **admits** evidence (`AdmitEvidence`) but never calls `SubmitEvidenceForAssessment` — so even the drive does not take the `EVIDENCE_PENDING → READY` arrow by its ratified trigger. Checked, because "the drive already does this" was the comfortable assumption |
| `apps/rph-demo/src/routes/undertakings/[id]/+page.server.ts` | a UI action |
| `handlers/__tests__/floor-fixtures.ts` | fixture helper, already throws on non-ACCEPTED |

## 5. Decisions that remain — none of them mine to make silently

**5.1 Does `RequestAssuranceAssessment` still create the object?** Creating it in `REQUESTED` and reaching
`ASSESSING` in four dispatches is faithful to the machine and costs the floor path four times the traffic for a
result it reaches unconditionally. The alternative — a composite that performs the arrows internally and emits
all four events — records the lifecycle honestly while keeping one dispatch, but invents a command shape the
corpus does not name.

**5.2 Is `AssuranceEvidenceRequired` an event or prose?** The trigger text names it parenthetically alongside
"missing evidence requested". If it is an event, it needs a contract and an emitter; if it is prose describing the
`EVIDENCE_PENDING` state's meaning, it needs neither. Nothing in DOC-007 settles it.

**5.3 Does `requiredEvidenceTypes` participate in the `EVIDENCE_PENDING → READY` guard?** §3's vacuous pass holds
only if the guard reads `requiredEvidence` (ids). Seeded catalog policies declare `requiredEvidenceTypes`; if the
guard is meant to read *those*, every catalog assessment needs evidence of each named type before it may proceed,
and the reference undertaking's current evidence may not satisfy it.

**5.4 What happens to `startedAt`?** Today it is stamped at request. Under the restored machine the assessment is
*started* at `beginAssuranceAssessment`, so the field moves to a later moment. **Measured: no production reader
consumes an assessment's `startedAt`** (the `startedAt` hits in `rph-projections` belong to execution attempts),
so this is a free correction today and a trap tomorrow — it should move deliberately rather than be noticed later
by whoever first reads it.

## 6. What this design does not claim

It does not claim the increment is small. It does not claim §5's decisions have obvious answers — 5.1 in
particular trades fidelity against the floor's ergonomics, and the floor is the mechanism this product exists to
demonstrate. It does not claim the ratified machine is complete: `ASSESSING → INDEPENDENCE_VIOLATION`,
`WAIVED`, `INVALIDATED` and `WAIVER_EXPIRED` arrows exist and are out of this increment's scope.

**Standing gate meanwhile.** `verif/event-surface-census.test.ts` pins the three unoccupied states and the
unemitted event. The day a handler writes `assessmentState: 'REQUESTED'`, that assertion reddens and the pin
comes out — so this design cannot be quietly half-implemented.
